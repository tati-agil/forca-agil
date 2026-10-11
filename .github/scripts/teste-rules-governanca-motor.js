/* B3 (H2-b) — GOVERNANÇA PERSISTIDA do motor de Posicionamento, no emulador real do RTDB.
 * Roda em teste-rules.yml (emulators:exec). As gravações são montadas pelos MESMOS montadores que a tela usa
 * (faGovernancaPosicionamento.montarProposta / montarAprovacao / montarRetirada). Prova, nas regras (não na tela):
 *   A. leitura: admin geral, Avaliação e Avaliação + Arquitetura; ninguém mais;
 *   B. proposta: só Avaliação + Arquitetura ou admin geral; alvo = redação PUBLICADA (versão e digest); motor ≠ em
 *      vigor; impacto coerente e sem violação; autoria pelo UID e horário do servidor; índice de proposta aberta e
 *      auditoria na mesma gravação; lista fechada; uma proposta aberta por versão (inclusive simultâneas);
 *   C. imutabilidade: nada da proposta muda nem se apaga (inclusive por caminho superior); o índice não é apagado
 *      nem reapontado enquanto a proposta está aberta;
 *   D. aprovação dupla: duas posições fixas (a1 → a2), cada uma criada uma vez; proponente não aprova; a mesma
 *      pessoa não ocupa as duas; ao menos um admin geral (o banco confere — a tela não declara); reconhecimento =
 *      números do alvo; a 2ª aprovação marca "aprovada" e LIBERA o índice na mesma gravação; aprovada é final e
 *      não impede uma nova proposta;
 *   E. retirada: só o proponente ou admin geral, com motivo, auditoria e liberação do índice na mesma gravação; final;
 *   F. auditoria: obrigatória, vinculada nos dois sentidos, só acréscimo, autoria pelo UID, horário do servidor;
 *   G. vigência: ninguém grava pelo cliente (reservada à fronteira confiável do B4). */
'use strict';
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const G = require('../../forca-agil/governanca-posicionamento.js');
let total = 0, falhas = 0;
async function caso(nome, p, deve) {
  total++;
  try { await (deve ? assertSucceeds(p) : assertFails(p)); console.log('  ok    ' + nome); }
  catch (e) { falhas++; console.log('  FALHA ' + nome + ' → ' + String((e && e.message) || e).split('\n')[0]); }
}
const TS = { '.sv': 'timestamp' };
const clone = (o) => JSON.parse(JSON.stringify(o));
(async () => {
  /* FA_REGRAS: outro arquivo de regras (provas de mutação); padrão = o fonte legível */
  const rules = fs.readFileSync(process.env.FA_REGRAS || path.join(__dirname, '..', '..', 'database.rules.json'), 'utf8');
  const env = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-governanca-motor', database: { rules } });
  await env.clearDatabase(); /* cada execução começa do zero, mesmo numa sessão de emulador já usada */
  const k = (e) => e.replace(/[@.]/g, '_');
  const ARQ = 'arq@previ.com.br', ARQ2 = 'arq2@previ.com.br', ARQ3 = 'arq3@previ.com.br', AVAL = 'aval@previ.com.br', OUTRO = 'outro@previ.com.br';
  const ADM = 'tatianefdirene@previ.com.br', ADM3 = 'adm3@previ.com.br';
  const uid = (e) => 'uid-' + k(e);
  const db = (e) => env.authenticatedContext(uid(e), { email: e }).database();
  const raiz = (e) => db(e).ref();
  const DIG = '0123456789abcdef', DIG3 = 'fedcba9876543210';
  await env.withSecurityRulesDisabled(async (c) => {
    const a = c.database();
    for (const e of [ARQ, ARQ2, ARQ3]) await a.ref('fa-avaliacao-autorizados/' + k(e)).set({ email: e, tipo: 'avaliacao-arquitetura' });
    await a.ref('fa-avaliacao-autorizados/' + k(AVAL)).set({ email: AVAL, tipo: 'avaliacao' });
    await a.ref('fa-admins/' + k(ADM3)).set(true);
    const M = 'questionarios-config/POSICIONAMENTO_ORGANIZACIONAL/motores/';
    await a.ref(M + '2').set({ versaoPublicada: 1, versoes: { 1: { perguntas: [{ codigoEstavel: 'O1' }], motorCompativel: 2, publicadoEm: 1, publicadoPor: { uid: 'u', email: ARQ }, auditoriaId: 'x', digestRedacao: DIG } } });
    await a.ref(M + '3').set({ versaoPublicada: 1, versoes: { 1: { perguntas: [{ codigoEstavel: 'O1' }], motorCompativel: 3, publicadoEm: 1, publicadoPor: { uid: 'u', email: ARQ }, auditoriaId: 'x', digestRedacao: DIG3 } } });
  });
  const N = G.NOS;
  const ALVO = { digestDefinicao: '1111111111111111', versaoRedacao: 1, digestRedacao: DIG, digestImpacto: '2222222222222222', impacto: { total: 3, iguais: 1, alterados: 1, incomparaveis: 1, violacoes: 0 } };
  const usr = (e) => ({ uid: uid(e), email: e });
  let seq = 0;
  const id = (p) => p + (++seq);
  function proposta(e, o) {
    o = o || {};
    const propostaId = o.propostaId || id('p'), auditoriaId = o.auditoriaId || id('a');
    const u = G.montarProposta({ propostaId, auditoriaId, versaoMotor: o.versaoMotor || 2, alvo: Object.assign(clone(ALVO), o.alvo || {}), justificativa: 'motivo da proposta', usuario: usr(e), agora: TS });
    if (o.mexer) o.mexer(u, propostaId, auditoriaId);
    return { u, propostaId };
  }
  async function ler(p) { let v; await env.withSecurityRulesDisabled(async (c) => { v = (await c.database().ref(p).once('value')).val(); }); return v; }
  function aprovacao(e, propostaId, prop, o) {
    o = o || {};
    const auditoriaId = id('a');
    const u = G.montarAprovacao({ propostaId, proposta: prop, auditoriaId, usuario: usr(e), adminGeral: o.adminGeral !== undefined ? o.adminGeral : (e === ADM || e === ADM3), agora: TS });
    if (o.mexer) o.mexer(u, propostaId, auditoriaId);
    return u;
  }
  function retirada(e, propostaId, prop, o) {
    o = o || {};
    const auditoriaId = id('a');
    const u = G.montarRetirada({ propostaId, proposta: prop, auditoriaId, motivo: o.motivo !== undefined ? o.motivo : 'não vale mais', usuario: usr(e), agora: TS });
    if (o.mexer) o.mexer(u, propostaId, auditoriaId);
    return u;
  }
  const PR = (pid) => N.propostas + '/' + pid, AUD = (aid) => N.auditoria + '/' + aid, IDX = (v) => N.aberta + '/' + v;

  console.log('A. leitura');
  await caso('Avaliação lê as propostas', db(AVAL).ref(N.propostas).once('value'), true);
  await caso('Avaliação + Arquitetura lê a auditoria', db(ARQ).ref(N.auditoria).once('value'), true);
  await caso('admin geral lê a vigência', db(ADM).ref(N.vigencia).once('value'), true);
  await caso('pessoa sem perfil de Avaliação não lê', db(OUTRO).ref(N.propostas).once('value'), false);
  await caso('sem login não lê', env.unauthenticatedContext().database().ref(N.aberta).once('value'), false);

  console.log('B. proposta');
  await caso('perfil Avaliação não propõe', raiz(AVAL).update(proposta(AVAL).u), false);
  await caso('sem perfil não propõe', raiz(OUTRO).update(proposta(OUTRO).u), false);
  await caso('sem login não propõe', env.unauthenticatedContext().database().ref().update(proposta(ARQ).u), false);
  await caso('redação que não foi publicada (versão 2)', raiz(ARQ).update(proposta(ARQ, { alvo: { versaoRedacao: 2 } }).u), false);
  await caso('digest diferente do da redação publicada', raiz(ARQ).update(proposta(ARQ, { alvo: { digestRedacao: 'aaaaaaaaaaaaaaaa' } }).u), false);
  await caso('motor v1 (o que está em vigor)', raiz(ARQ).update(proposta(ARQ, { versaoMotor: 1 }).u), false);
  await caso('impacto com violação de Linha × Squad', raiz(ARQ).update(proposta(ARQ, { alvo: { impacto: { total: 3, iguais: 1, alterados: 1, incomparaveis: 1, violacoes: 1 } } }).u), false);
  await caso('impacto incoerente (iguais + alterados + incomparáveis ≠ total)', raiz(ARQ).update(proposta(ARQ, { alvo: { impacto: { total: 9, iguais: 1, alterados: 1, incomparaveis: 1, violacoes: 0 } } }).u), false);
  await caso('digest de impacto fora do formato', raiz(ARQ).update(proposta(ARQ, { alvo: { digestImpacto: 'x' } }).u), false);
  await caso('em nome de outra pessoa (UID)', raiz(ARQ).update(proposta(ARQ, { mexer: (u, p) => { u[PR(p)].propostoPor.uid = uid(ARQ2); } }).u), false);
  await caso('em nome de outra pessoa (e-mail)', raiz(ARQ).update(proposta(ARQ, { mexer: (u, p) => { u[PR(p)].propostoPor.email = ARQ2; } }).u), false);
  await caso('horário escolhido pela tela', raiz(ARQ).update(proposta(ARQ, { mexer: (u, p) => { u[PR(p)].propostoEm = 1700000000000; } }).u), false);
  await caso('sem o índice de proposta aberta', raiz(ARQ).update(proposta(ARQ, { mexer: (u) => { delete u[IDX(2)]; } }).u), false);
  await caso('índice apontando para outra proposta', raiz(ARQ).update(proposta(ARQ, { mexer: (u) => { u[IDX(2)] = 'outra'; } }).u), false);
  await caso('sem auditoria na mesma gravação', raiz(ARQ).update(proposta(ARQ, { mexer: (u, p, a) => { delete u[AUD(a)]; } }).u), false);
  await caso('auditoria de outro tipo', raiz(ARQ).update(proposta(ARQ, { mexer: (u, p, a) => { u[AUD(a)].tipo = 'retirada'; u[AUD(a)].motivo = 'x'; } }).u), false);
  await caso('auditoria de outra proposta', raiz(ARQ).update(proposta(ARQ, { mexer: (u, p, a) => { u[AUD(a)].propostaId = 'outra'; } }).u), false);
  await caso('já nasce "aprovada"', raiz(ARQ).update(proposta(ARQ, { mexer: (u, p) => { u[PR(p)].situacao = 'aprovada'; } }).u), false);
  await caso('já nasce com aprovação', raiz(ARQ).update(proposta(ARQ, { mexer: (u, p) => { u[PR(p)].aprovacoes = { a1: { uid: uid(ARQ2), email: ARQ2, em: TS, adminGeral: false, auditoriaId: 'z', reconhecimento: { digestImpacto: ALVO.digestImpacto, alterados: 1, incomparaveis: 1 } } }; } }).u), false);
  await caso('campo fora da lista', raiz(ARQ).update(proposta(ARQ, { mexer: (u, p) => { u[PR(p)].validada = true; } }).u), false);
  await caso('campo fora da lista no alvo', raiz(ARQ).update(proposta(ARQ, { mexer: (u, p) => { u[PR(p)].alvo.validadaFronteira = true; } }).u), false);
  await caso('justificativa vazia', raiz(ARQ).update(proposta(ARQ, { mexer: (u, p) => { u[PR(p)].justificativa = ''; } }).u), false);
  const p1 = proposta(ARQ);
  await caso('Avaliação + Arquitetura propõe a v2 (redação publicada v1, impacto sem violação)', raiz(ARQ).update(p1.u), true);
  await caso('segunda proposta aberta para a mesma versão', raiz(ARQ2).update(proposta(ARQ2).u), false);
  const c1 = proposta(ARQ, { versaoMotor: 3, alvo: { digestRedacao: DIG3 } }), c2 = proposta(ARQ2, { versaoMotor: 3, alvo: { digestRedacao: DIG3 } });
  const res = await Promise.allSettled([raiz(ARQ).update(c1.u), raiz(ARQ2).update(c2.u)]);
  total++;
  const entraram = res.filter((r) => r.status === 'fulfilled').length, idx3 = await ler(IDX(3));
  if (entraram === 1 && (idx3 === c1.propostaId || idx3 === c2.propostaId) && !!(await ler(PR(c1.propostaId))) !== !!(await ler(PR(c2.propostaId)))) console.log('  ok    duas propostas simultâneas para a mesma versão: só uma entra, sem órfã');
  else { falhas++; console.log('  FALHA duas propostas simultâneas: entraram ' + entraram); }

  console.log('C. imutabilidade');
  await caso('alterar o impacto reconhecido', db(ADM).ref(PR(p1.propostaId) + '/alvo/digestImpacto').set('3333333333333333'), false);
  await caso('alterar a justificativa', db(ARQ).ref(PR(p1.propostaId) + '/justificativa').set('outra'), false);
  await caso('alterar o autor', db(ADM).ref(PR(p1.propostaId) + '/propostoPor/email').set(ADM), false);
  await caso('sobrescrever a proposta inteira', db(ARQ).ref(PR(p1.propostaId)).set(p1.u[PR(p1.propostaId)]), false);
  await caso('apagar a proposta', db(ADM).ref(PR(p1.propostaId)).remove(), false);
  await caso('apagar pelo caminho superior', db(ADM).ref(N.propostas).remove(), false);
  await caso('apagar o índice com a proposta aberta', db(ADM).ref(IDX(2)).remove(), false);
  await caso('reapontar o índice', db(ADM).ref(IDX(2)).set(c1.propostaId), false);
  await caso('voltar a situação para outro valor qualquer', db(ADM).ref(PR(p1.propostaId) + '/situacao').set('ativa'), false);

  console.log('D. aprovação dupla');
  let P1 = await ler(PR(p1.propostaId));
  await caso('quem propôs não aprova', raiz(ARQ).update(aprovacao(ARQ, p1.propostaId, P1)), false);
  await caso('perfil Avaliação não aprova', raiz(AVAL).update(aprovacao(AVAL, p1.propostaId, P1)), false);
  await caso('aprovação em nome de outra pessoa (UID)', raiz(ARQ2).update(aprovacao(ARQ2, p1.propostaId, P1, { mexer: (u, p) => { u[PR(p) + '/aprovacoes/a1'].uid = uid(ARQ3); } })), false);
  await caso('declarar-se admin geral sem ser', raiz(ARQ2).update(aprovacao(ARQ2, p1.propostaId, P1, { adminGeral: true })), false);
  await caso('admin geral que se declara não admin', raiz(ADM).update(aprovacao(ADM, p1.propostaId, P1, { adminGeral: false })), false);
  await caso('reconhecimento com outros números', raiz(ARQ2).update(aprovacao(ARQ2, p1.propostaId, P1, { mexer: (u, p) => { u[PR(p) + '/aprovacoes/a1'].reconhecimento.incomparaveis = 0; } })), false);
  await caso('reconhecimento de outro impacto', raiz(ARQ2).update(aprovacao(ARQ2, p1.propostaId, P1, { mexer: (u, p) => { u[PR(p) + '/aprovacoes/a1'].reconhecimento.digestImpacto = '3333333333333333'; } })), false);
  await caso('horário escolhido pela tela', raiz(ARQ2).update(aprovacao(ARQ2, p1.propostaId, P1, { mexer: (u, p) => { u[PR(p) + '/aprovacoes/a1'].em = 1700000000000; } })), false);
  await caso('sem auditoria', raiz(ARQ2).update(aprovacao(ARQ2, p1.propostaId, P1, { mexer: (u, p, a) => { delete u[AUD(a)]; } })), false);
  await caso('auditoria de outra posição', raiz(ARQ2).update(aprovacao(ARQ2, p1.propostaId, P1, { mexer: (u, p, a) => { u[AUD(a)].posicao = 'a2'; } })), false);
  await caso('a2 antes de a1', raiz(ADM).update((() => { const u = aprovacao(ADM, p1.propostaId, Object.assign(clone(P1), { aprovacoes: { a1: { uid: 'x' } } })); return u; })()), false);
  await caso('a1 e a2 na mesma gravação', raiz(ADM).update(Object.assign(aprovacao(ARQ2, p1.propostaId, P1), aprovacao(ADM, p1.propostaId, Object.assign(clone(P1), { aprovacoes: { a1: { uid: 'x' } } })))), false);
  await caso('1ª aprovação: Avaliação + Arquitetura (outra pessoa)', raiz(ARQ2).update(aprovacao(ARQ2, p1.propostaId, P1)), true);
  P1 = await ler(PR(p1.propostaId));
  await caso('a1 não é sobrescrita (gravação completa, com auditoria)', raiz(ARQ3).update(aprovacao(ARQ3, p1.propostaId, Object.assign(clone(P1), { aprovacoes: null }))), false);
  await caso('a1 não é apagada', db(ADM).ref(PR(p1.propostaId) + '/aprovacoes/a1').remove(), false);
  await caso('a mesma pessoa na 2ª posição', raiz(ARQ2).update(aprovacao(ARQ2, p1.propostaId, P1)), false);
  await caso('2ª aprovação sem admin geral (nenhum dos dois é)', raiz(ARQ3).update(aprovacao(ARQ3, p1.propostaId, P1)), false);
  await caso('2ª aprovação sem marcar "aprovada"', raiz(ADM).update(aprovacao(ADM, p1.propostaId, P1, { mexer: (u, p) => { delete u[PR(p) + '/situacao']; } })), false);
  await caso('2ª aprovação sem liberar o índice', raiz(ADM).update(aprovacao(ADM, p1.propostaId, P1, { mexer: (u) => { delete u[IDX(2)]; } })), false);
  await caso('"aprovada" sem a 2ª aprovação', raiz(ADM).update({ [PR(p1.propostaId) + '/situacao']: 'aprovada', [IDX(2)]: null }), false);
  await caso('2ª aprovação: admin geral → aprovada, índice liberado', raiz(ADM).update(aprovacao(ADM, p1.propostaId, P1)), true);
  total++;
  if ((await ler(PR(p1.propostaId) + '/situacao')) === 'aprovada' && (await ler(IDX(2))) === null) console.log('  ok    banco: situação "aprovada" e índice liberado na mesma gravação');
  else { falhas++; console.log('  FALHA banco depois da 2ª aprovação'); }
  P1 = await ler(PR(p1.propostaId));
  await caso('aprovada não volta para aberta', db(ADM).ref(PR(p1.propostaId) + '/situacao').set('aberta'), false);
  await caso('aprovada não é retirada', raiz(ARQ).update(retirada(ARQ, p1.propostaId, P1)), false);
  await caso('aprovação de proposta aprovada não muda', db(ADM).ref(PR(p1.propostaId) + '/aprovacoes/a2/adminGeral').set(false), false);
  await caso('sem 3ª aprovação', db(ARQ3).ref(PR(p1.propostaId) + '/aprovacoes/a3').set({ uid: uid(ARQ3) }), false);
  const p2 = proposta(ARQ2);
  await caso('depois de aprovada, uma nova proposta pode ser feita (índice livre)', raiz(ARQ2).update(p2.u), true);
  let P2 = await ler(PR(p2.propostaId));
  await caso('1ª aprovação por admin geral', raiz(ADM).update(aprovacao(ADM, p2.propostaId, P2)), true);
  P2 = await ler(PR(p2.propostaId));
  await caso('o mesmo admin geral na 2ª posição', raiz(ADM).update(aprovacao(ADM, p2.propostaId, P2)), false);
  await caso('2ª aprovação por Avaliação + Arquitetura (a 1ª foi de admin geral)', raiz(ARQ3).update(aprovacao(ARQ3, p2.propostaId, P2)), true);
  const p5 = proposta(ARQ);
  await caso('nova proposta (para testar admin geral por fa-admins)', raiz(ARQ).update(p5.u), true);
  let P5 = await ler(PR(p5.propostaId));
  await caso('1ª aprovação: Avaliação + Arquitetura', raiz(ARQ2).update(aprovacao(ARQ2, p5.propostaId, P5)), true);
  P5 = await ler(PR(p5.propostaId));
  await caso('2ª aprovação: admin geral pela lista fa-admins', raiz(ADM3).update(aprovacao(ADM3, p5.propostaId, P5)), true);

  console.log('E. retirada');
  const p3 = proposta(ADM);
  await caso('admin geral também propõe', raiz(ADM).update(p3.u), true);
  let P3 = await ler(PR(p3.propostaId));
  await caso('Avaliação + Arquitetura que não propôs não retira', raiz(ARQ2).update(retirada(ARQ2, p3.propostaId, P3)), false);
  await caso('sem motivo', raiz(ADM).update(retirada(ADM, p3.propostaId, P3, { mexer: (u, p) => { u[PR(p) + '/retirada'].motivo = ''; } })), false);
  await caso('sem liberar o índice', raiz(ADM).update(retirada(ADM, p3.propostaId, P3, { mexer: (u) => { delete u[IDX(2)]; } })), false);
  await caso('sem auditoria', raiz(ADM).update(retirada(ADM, p3.propostaId, P3, { mexer: (u, p, a) => { delete u[AUD(a)]; } })), false);
  await caso('"retirada" sem o registro da retirada', raiz(ADM).update({ [PR(p3.propostaId) + '/situacao']: 'retirada', [IDX(2)]: null }), false);
  await caso('retirada em nome de outra pessoa', raiz(ADM).update(retirada(ADM, p3.propostaId, P3, { mexer: (u, p) => { u[PR(p) + '/retirada'].por.uid = uid(ARQ); } })), false);
  await caso('o proponente (admin geral) retira, com motivo', raiz(ADM).update(retirada(ADM, p3.propostaId, P3)), true);
  P3 = await ler(PR(p3.propostaId));
  await caso('retirada é final: não volta para aberta', db(ADM).ref(PR(p3.propostaId) + '/situacao').set('aberta'), false);
  await caso('retirada é final: não recebe aprovação', raiz(ARQ2).update(aprovacao(ARQ2, p3.propostaId, Object.assign(clone(P3), { situacao: 'aberta' }))), false);
  await caso('motivo da retirada não muda', db(ADM).ref(PR(p3.propostaId) + '/retirada/motivo').set('outro'), false);
  const p4 = proposta(ARQ2);
  await caso('nova proposta depois da retirada', raiz(ARQ2).update(p4.u), true);
  const P4 = await ler(PR(p4.propostaId));
  await caso('admin geral retira a proposta de outra pessoa', raiz(ADM).update(retirada(ADM, p4.propostaId, P4)), true);
  const p6 = proposta(ARQ);
  await caso('proposta de Avaliação + Arquitetura', raiz(ARQ).update(p6.u), true);
  await caso('o próprio proponente (Avaliação + Arquitetura) retira', raiz(ARQ).update(retirada(ARQ, p6.propostaId, await ler(PR(p6.propostaId)))), true);

  console.log('F. auditoria');
  const auds = await ler(N.auditoria), umaAud = Object.keys(auds)[0];
  await caso('alterar auditoria existente', db(ADM).ref(AUD(umaAud) + '/tipo').set('retirada'), false);
  await caso('apagar auditoria existente', db(ADM).ref(AUD(umaAud)).remove(), false);
  await caso('apagar a auditoria pelo caminho superior', db(ADM).ref(N.auditoria).remove(), false);
  await caso('auditoria órfã (sem a transição que ela cita)', db(ARQ).ref(AUD('orfa')).set({ tipo: 'proposta', propostaId: 'nao-existe', versaoMotor: 2, usuario: usr(ARQ), dataHora: TS }), false);
  const p7 = proposta(ARQ);
  await caso('auditoria em nome de outra pessoa', raiz(ARQ).update(proposta(ARQ, { mexer: (u, p, a) => { u[AUD(a)].usuario.uid = uid(ARQ2); } }).u), false);
  await caso('auditoria com horário da tela', raiz(ARQ).update(proposta(ARQ, { mexer: (u, p, a) => { u[AUD(a)].dataHora = 1700000000000; } }).u), false);
  await caso('auditoria com outra versão do motor', raiz(ARQ).update(proposta(ARQ, { mexer: (u, p, a) => { u[AUD(a)].versaoMotor = 3; } }).u), false);
  await caso('auditoria com campo extra', raiz(ARQ).update(proposta(ARQ, { mexer: (u, p, a) => { u[AUD(a)].extra = 1; } }).u), false);
  await caso('proposta válida com auditoria completa (controle)', raiz(ARQ).update(p7.u), true);

  console.log('G. vigência (reservada à fronteira confiável do B4)');
  await caso('admin geral não grava a versão em vigor', db(ADM).ref(N.vigencia + '/versaoEmVigor').set(2), false);
  await caso('Avaliação + Arquitetura não grava a versão em vigor', db(ARQ).ref(N.vigencia).set({ versaoEmVigor: 2 }), false);
  await caso('nem junto com uma aprovação', raiz(ADM).update(Object.assign({ [N.vigencia + '/versaoEmVigor']: 2 }, aprovacao(ADM, p7.propostaId, await ler(PR(p7.propostaId))))), false);
  total++;
  if ((await ler(N.vigencia)) === null) console.log('  ok    a vigência continua sem registro (v1 em vigor)');
  else { falhas++; console.log('  FALHA a vigência foi gravada'); }

  await env.cleanup();
  console.log('\n' + (total - falhas) + '/' + total + ' casos.' + (falhas ? ' ' + falhas + ' falha(s).' : ' Tudo certo.'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
