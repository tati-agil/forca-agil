/* B2 (H2-b) — REDAÇÃO PUBLICADA IMUTÁVEL da trilha questionarios-config/<código>/motores/<v>, no emulador real do RTDB.
 * Roda em teste-rules.yml (emulators:exec). Prova, nas regras (não na tela):
 *   A. compatibilidade: rascunho da redação v2 e a trilha principal (v1) continuam como hoje;
 *   B. publicar: perfis atuais (admin geral, Avaliação + Arquitetura); Avaliação e sem login, não;
 *   C. imutabilidade: alterar, sobrescrever e apagar versão publicada — também por caminho superior (versoes,
 *      motores/2, motores, questionário inteiro, raiz do nó);
 *   D. ponteiro: só avança de 1 em 1 e na mesma gravação que cria a versão; nunca volta, nunca é apagado;
 *   E. autoria e horário: UID e e-mail da sessão; horário do servidor (now) na versão e na auditoria;
 *   F. auditoria: obrigatória, mesma versão e mesmo digest, só acréscimo; sem auditoria órfã;
 *   G. publicada ≠ validada: a tela não consegue gravar "validada"/qualquer campo fora da lista;
 *   H. concorrência e repetição: duas publicações da mesma versão → só uma; versão repetida recusada;
 *   I. suspensão (plano de reversão): só admin geral suspende/retoma, com motivo, auditoria e horário do
 *      servidor; suspensa → nenhuma publicação nova; o histórico continua imutável; a suspensão não se apaga. */
'use strict';
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
let total = 0, falhas = 0;
async function caso(nome, p, deve) {
  total++;
  try { await (deve ? assertSucceeds(p) : assertFails(p)); console.log('  ok    ' + nome); }
  catch (e) { falhas++; console.log('  FALHA ' + nome + ' → ' + String((e && e.message) || e).split('\n')[0]); }
}
const TS = { '.sv': 'timestamp' };
(async () => {
  const rules = fs.readFileSync(path.join(__dirname, '..', '..', 'database.rules.json'), 'utf8');
  const env = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-redacao-motor', database: { rules } });
  await env.clearDatabase(); /* cada execução começa do zero, mesmo numa sessão de emulador já usada */
  const k = (e) => e.replace(/[@.]/g, '_');
  const ARQ = 'arq@previ.com.br', ARQ2 = 'arq2@previ.com.br', AVAL = 'aval@previ.com.br', ADM = 'tatianefdirene@previ.com.br';
  const uid = (e) => 'uid-' + k(e);
  const db = (e) => env.authenticatedContext(uid(e), { email: e }).database();
  await env.withSecurityRulesDisabled(async (c) => {
    const a = c.database();
    await a.ref('fa-avaliacao-autorizados/' + k(ARQ)).set({ email: ARQ, tipo: 'avaliacao-arquitetura' });
    await a.ref('fa-avaliacao-autorizados/' + k(ARQ2)).set({ email: ARQ2, tipo: 'avaliacao-arquitetura' });
    await a.ref('fa-avaliacao-autorizados/' + k(AVAL)).set({ email: AVAL, tipo: 'avaliacao' });
  });
  const C = 'POSICIONAMENTO_ORGANIZACIONAL', Q = 'questionarios-config/' + C, M = Q + '/motores/2', AUD = 'questionarios-motor-auditoria/' + C + '/2';
  const perg = [{ codigoEstavel: 'O1', texto: 't1' }];
  const DIG = '0123456789abcdef';
  function pub(e, n, o) {
    o = o || {};
    const audId = o.audId || ('aud' + n), u = {};
    u[M + '/versoes/' + n] = Object.assign({ perguntas: perg, motorCompativel: 2, publicadoEm: TS, publicadoPor: { uid: uid(e), email: e, name: 'Nome' }, auditoriaId: audId, digestRedacao: DIG }, o.versao || {});
    u[M + '/versaoPublicada'] = o.ponteiro !== undefined ? o.ponteiro : n;
    u[M + '/rascunho'] = null;
    if (!o.semAud) u[AUD + '/' + audId] = Object.assign({ tipo: 'publicacao', versao: n, digestRedacao: DIG, usuario: { uid: uid(e), email: e }, dataHora: TS }, o.aud || {});
    return u;
  }
  function susp(e, ativa, o) {
    o = o || {};
    const audId = o.audId || ('s' + Date.now() + Math.random().toString(36).slice(2, 6)), u = {};
    u[M + '/publicacaoSuspensa'] = Object.assign({ ativa, motivo: 'motivo', por: { uid: uid(e), email: e, name: 'Nome' }, em: TS, auditoriaId: audId }, o.s || {});
    if (!o.semAud) u[AUD + '/' + audId] = Object.assign({ tipo: ativa ? 'suspensao' : 'retomada', motivo: 'motivo', usuario: { uid: uid(e), email: e }, dataHora: TS }, o.aud || {});
    return u;
  }
  const raiz = (e) => db(e).ref();

  console.log('A. compatibilidade');
  await caso('rascunho da redação v2: salvar', db(ARQ).ref(M + '/rascunho').set({ perguntas: perg, motorCompativel: 2 }), true);
  await caso('rascunho da redação v2: descartar', db(ARQ).ref(M + '/rascunho').remove(), true);
  await caso('trilha principal (v1): publicar versão nova como hoje', raiz(ARQ).update({ [Q + '/versaoPublicada']: 2, [Q + '/versoes/2']: { perguntas: perg }, [Q + '/rascunho']: null, [Q + '/nome']: 'Posicionamento' }), true);
  await caso('trilha principal: P1–P16 (outro questionário) continua gravável', db(ADM).ref('questionarios-config/CLASSIFICACAO_ARQUITETURAL/rascunho').set({ perguntas: perg }), true);
  await caso('trilha principal: perfil Avaliação continua sem gravar', db(AVAL).ref(Q + '/rascunho').set({ perguntas: perg }), false);

  console.log('B. quem publica');
  await caso('Avaliação + Arquitetura publica a v1 da redação', raiz(ARQ).update(pub(ARQ, 1)), true);
  await caso('admin geral publica a v2', raiz(ADM).update(pub(ADM, 2)), true);
  await caso('perfil Avaliação não publica', raiz(AVAL).update(pub(AVAL, 3)), false);
  await caso('sem login não publica', env.unauthenticatedContext().database().ref().update(pub(ARQ, 3)), false);

  console.log('C. imutabilidade (inclusive por caminho superior)');
  await caso('alterar texto de versão publicada', db(ADM).ref(M + '/versoes/1/perguntas/0/texto').set('mudado'), false);
  await caso('alterar a autoria de versão publicada', db(ADM).ref(M + '/versoes/1/publicadoPor/email').set(ADM), false);
  await caso('sobrescrever versão publicada inteira', db(ADM).ref(M + '/versoes/1').set(pub(ADM, 1)[M + '/versoes/1']), false);
  await caso('apagar versão publicada', db(ADM).ref(M + '/versoes/1').remove(), false);
  await caso('apagar pelo caminho superior: versoes', db(ADM).ref(M + '/versoes').remove(), false);
  await caso('apagar pelo caminho superior: motores/2', db(ADM).ref(M).remove(), false);
  await caso('apagar pelo caminho superior: motores', db(ADM).ref(Q + '/motores').remove(), false);
  await caso('apagar pelo caminho superior: o questionário', db(ADM).ref(Q).remove(), false);
  await caso('apagar pelo caminho superior: questionarios-config', db(ADM).ref('questionarios-config').remove(), false);
  await caso('sobrescrever a trilha motores/2 inteira com set', db(ADM).ref(M).set({ versaoPublicada: 1 }), false);
  await caso('apagar versão por update multipath (null)', raiz(ADM).update({ [M + '/versoes/2']: null }), false);

  /* a ÚLTIMA versão (a do ponteiro) é a que mais depende do "só criar": as antigas também caem pela conferência do ponteiro */
  await caso('alterar texto da ÚLTIMA versão publicada (a do ponteiro)', db(ADM).ref(M + '/versoes/2/perguntas/0/texto').set('mudado'), false);
  await caso('sobrescrever a ÚLTIMA versão com o mesmo digest e auditoria', db(ADM).ref(M + '/versoes/2').set(Object.assign(pub(ADM, 2)[M + '/versoes/2'], { perguntas: [{ codigoEstavel: 'O1', texto: 'outro' }] })), false);
  await caso('apagar a ÚLTIMA versão publicada', db(ADM).ref(M + '/versoes/2').remove(), false);
  console.log('D. ponteiro');
  await caso('voltar o ponteiro (2 → 1)', db(ADM).ref(M + '/versaoPublicada').set(1), false);
  await caso('apagar o ponteiro', db(ADM).ref(M + '/versaoPublicada').remove(), false);
  await caso('pular versão (4 sem a 3)', raiz(ADM).update(pub(ADM, 4)), false);
  await caso('avançar o ponteiro sem criar a versão', db(ADM).ref(M + '/versaoPublicada').set(3), false);
  await caso('criar a versão sem avançar o ponteiro', raiz(ADM).update((() => { const u = pub(ADM, 3); delete u[M + '/versaoPublicada']; return u; })()), false);
  await caso('ponteiro que não é número', raiz(ADM).update(pub(ADM, 3, { ponteiro: '3' })), false);

  console.log('E. autoria (UID) e horário do servidor');
  await caso('publicadoPor com e-mail de outra pessoa', raiz(ARQ).update(pub(ARQ, 3, { versao: { publicadoPor: { uid: uid(ARQ), email: ARQ2 } } })), false);
  await caso('publicadoPor com UID de outra pessoa', raiz(ARQ).update(pub(ARQ, 3, { versao: { publicadoPor: { uid: uid(ARQ2), email: ARQ } } })), false);
  await caso('horário escolhido pela tela (não o do servidor) na versão', raiz(ARQ).update(pub(ARQ, 3, { versao: { publicadoEm: 1700000000000 } })), false);
  await caso('horário em texto na versão', raiz(ARQ).update(pub(ARQ, 3, { versao: { publicadoEm: '2026-10-11T00:00:00Z' } })), false);
  await caso('horário escolhido pela tela na auditoria', raiz(ARQ).update(pub(ARQ, 3, { aud: { dataHora: 1700000000000 } })), false);
  await caso('auditoria em nome de outra pessoa (UID)', raiz(ARQ).update(pub(ARQ, 3, { aud: { usuario: { uid: uid(ARQ2), email: ARQ } } })), false);

  console.log('F. auditoria');
  await caso('sem auditoria na mesma gravação', raiz(ARQ).update(pub(ARQ, 3, { semAud: true })), false);
  await caso('auditoria de outra versão', raiz(ARQ).update(pub(ARQ, 3, { aud: { versao: 2 } })), false);
  await caso('auditoria com outro digest', raiz(ARQ).update(pub(ARQ, 3, { aud: { digestRedacao: 'ffffffffffffffff' } })), false);
  await caso('auditoria órfã (sem a versão que ela cita)', db(ARQ).ref(AUD + '/orfa').set({ tipo: 'publicacao', versao: 9, digestRedacao: DIG, usuario: { uid: uid(ARQ), email: ARQ }, dataHora: TS }), false);
  await caso('auditoria com campo extra', raiz(ARQ).update(pub(ARQ, 3, { aud: { extra: 1 } })), false);
  await caso('alterar auditoria existente', db(ADM).ref(AUD + '/aud1/digestRedacao').set('x'), false);
  await caso('apagar auditoria existente', db(ADM).ref(AUD + '/aud1').remove(), false);
  await caso('apagar a auditoria pelo caminho superior', db(ADM).ref('questionarios-motor-auditoria').remove(), false);

  console.log('G. publicada não é validada');
  await caso('a tela não grava "validada" na versão', raiz(ARQ).update(pub(ARQ, 3, { versao: { validadaParaAtivacao: true } })), false);
  await caso('nem "validacao" depois', db(ADM).ref(M + '/versoes/1/validacao').set({ status: 'validada' }), false);
  await caso('digest fora do formato', raiz(ARQ).update(pub(ARQ, 3, { versao: { digestRedacao: 'x' }, aud: { digestRedacao: 'x' } })), false);
  await caso('motorCompativel diferente do motor da trilha', raiz(ARQ).update(pub(ARQ, 3, { versao: { motorCompativel: 3 } })), false);
  await caso('trilha do motor 1 (a v1 é a trilha principal)', db(ADM).ref(Q + '/motores/1/rascunho').set({ x: 1 }), false);
  await caso('campo desconhecido na trilha', db(ADM).ref(M + '/qualquer').set(1), false);

  console.log('H. concorrência e repetição');
  const [r1, r2] = await Promise.allSettled([raiz(ARQ).update(pub(ARQ, 3, { audId: 'audA' })), raiz(ARQ2).update(pub(ARQ2, 3, { audId: 'audB' }))]);
  let fim, fimAud;
  await env.withSecurityRulesDisabled(async (c) => { fim = (await c.database().ref(M).once('value')).val(); fimAud = (await c.database().ref(AUD).once('value')).val(); });
  total++;
  if ([r1, r2].filter((r) => r.status === 'fulfilled').length === 1 && fim.versaoPublicada === 3 && Object.keys(fimAud).filter((x) => /^aud[AB]$/.test(x)).length === 1) console.log('  ok    duas publicações simultâneas da v3: só uma entra, sem auditoria órfã');
  else { falhas++; console.log('  FALHA concorrência'); }
  await caso('publicar de novo a mesma versão (repetição)', raiz(ADM).update(pub(ADM, 3, { audId: 'audC' })), false);
  await caso('a v4 segue normalmente', raiz(ADM).update(pub(ADM, 4)), true);

  console.log('I. suspensão (reversão sem perder a proteção)');
  await caso('Avaliação + Arquitetura não suspende', raiz(ARQ).update(susp(ARQ, true)), false);
  await caso('suspender sem auditoria', raiz(ADM).update(susp(ADM, true, { semAud: true })), false);
  await caso('suspender sem motivo', raiz(ADM).update(susp(ADM, true, { s: { motivo: '' } })), false);
  await caso('suspender com horário da tela', raiz(ADM).update(susp(ADM, true, { s: { em: 1700000000000 } })), false);
  await caso('admin geral suspende', raiz(ADM).update(susp(ADM, true, { audId: 'susp1' })), true);
  await caso('suspensa: nenhuma publicação nova', raiz(ADM).update(pub(ADM, 5)), false);
  await caso('suspensa: histórico continua imutável', db(ADM).ref(M + '/versoes/1').remove(), false);
  await caso('suspensa: o rascunho continua editável', db(ARQ).ref(M + '/rascunho').set({ perguntas: perg }), true);
  await caso('suspender de novo (sem mudança)', raiz(ADM).update(susp(ADM, true)), false);
  await caso('apagar a suspensão (em vez de retomar com registro)', db(ADM).ref(M + '/publicacaoSuspensa').remove(), false);
  await caso('admin geral retoma, com auditoria', raiz(ADM).update(susp(ADM, false, { audId: 'ret1' })), true);
  await caso('retomada: publica a v5', raiz(ADM).update(pub(ADM, 5)), true);

  console.log('\n' + total + ' casos, ' + falhas + ' falha(s).');
  await env.cleanup();
  process.exit(falhas ? 1 : 0);
})();
