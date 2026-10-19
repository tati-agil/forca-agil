/* I2 — Regras do banco da integração Posicionamento Organizacional × Adequação à Squad. Roda no emulador real
 * (teste-rules.yml). A origem da liberação gravada é montada pelo núcleo real da tela (liberacaoSquad /
 * origemLiberacaoSquad). A antiga Exigência de Posicionamento (posicionamento-config/exigirParaSquad) foi retirada
 * (decisão da responsável, 2026-10-17): a avaliação S1–S8 não depende do O1–O9. Prova:
 *   A. o interruptor antigo e a auditoria dele: ninguém grava (nem o admin geral); o histórico continua legível;
 *   B. a criação de uma avaliação S não depende do Posicionamento;
 *   C. com o interruptor antigo gravado como LIGADO, nada muda: item sem Posicionamento, não liberado, A_VALIDAR sem
 *      decisão e decisão final CoE criam S normalmente; rascunhos e avaliações existentes continuam;
 *   D. a origem da liberação é imutável (não muda, não some, não aparece depois em S antiga).
 *   E. Porta 2: objeto organizacional ENCERRADO não recebe nova avaliação S; a S que já existia continua sendo salva. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
let total = 0, falhas = 0;
async function caso(nome, p, deve) {
  total++;
  try { await (deve ? assertSucceeds(p) : assertFails(p)); console.log('  ok    ' + nome); }
  catch (e) { falhas++; console.log('  FALHA ' + nome + ' → ' + String((e && e.message) || e).split('\n')[0]); }
}
function carregarNucleo() {
  const raiz = path.join(__dirname, '..', '..', 'forca-agil');
  const ctx = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, setTimeout, clearTimeout };
  ctx.window = ctx;
  const el = () => ({ addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, style: {}, classList: { add() {}, remove() {}, contains() { return false; } } });
  ctx.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: el(), documentElement: el() };
  ctx.navigator = {}; ctx.location = { hash: '' }; ctx.localStorage = { getItem() { return null; }, setItem() {} }; ctx.setInterval = () => 0; ctx.clearInterval = () => {};
  ctx.firebase = { database: () => ({ ref: () => ({ on() {}, off() {}, once() { return Promise.resolve({ val: () => null }); }, update() {}, child() { return this; }, push() { return { key: 'k' }; } }) }) };
  vm.createContext(ctx);
  for (const f of ['motor-posicionamento-nucleo.js', 'governanca-posicionamento.js', 'questionarios-config.js', 'motor-arquitetura.js', 'avaliacao-produto.js', 'motor-posicionamento.js', 'avaliacao-posicionamento.js']) vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8'), ctx, { filename: f });
  ctx.faPosicionamentos = { nome: (c) => 'Nome de ' + c, usandoContingencia: () => false };
  return ctx.faAvaliacaoPosicionamentoNucleo;
}
const T = carregarNucleo();
const clone = (v) => JSON.parse(JSON.stringify(v));
const M = require('../../forca-agil/motor-posicionamento.js');
const ADM = 'tatianefdirene@previ.com.br', ARQ = 'arquitetura@previ.com.br', AVAL = 'avaliacao@previ.com.br';
const k = (e) => e.replace(/[@.]/g, '_');
const QUANDO = '2026-10-11T12:00:00.000Z';
const SQ = 'avaliacoes-squad', CF = 'posicionamento-config', CFA = 'posicionamento-config-auditoria';
/* Posicionamento GRAVADO (como as regras do Posicionamento o aceitam): vigente por item, avaliação concluída, decisão */
function concluida(itemId, codigo, liberaSquad) {
  return { itemId, status: 'concluido', versao: 1, resultadoAutomatico: { codigoResultado: codigo, liberaSquad, regra: 'R', versaoMotor: 1 } };
}
const POSIC = {
  'posicionamento-vigente-por-item': { iL: 'gL', iAE: 'gAE', iAV: 'gAV', iDiv: 'gDiv', iAVno: 'gAVno' },
  'avaliacoes-posicionamento': { gL: concluida('iL', 'NEGOCIOS', true), gAE: concluida('iAE', 'AREA_ESPECIALIZADA', false), gAV: concluida('iAV', 'A_VALIDAR', false),
    gDiv: concluida('iDiv', 'NEGOCIOS', true), gAVno: concluida('iAVno', 'A_VALIDAR', false) },
  'posicionamento-decisoes': {
    gAV: { itemId: 'iAV', codigoFinal: 'PLATAFORMA_CANAIS', liberaSquad: M.liberaSquadParaCodigoFirme('PLATAFORMA_CANAIS') },
    gDiv: { itemId: 'iDiv', codigoFinal: 'COE', liberaSquad: M.liberaSquadParaCodigoFirme('COE') } }
};
const dados = (p) => ({ vigentes: p['posicionamento-vigente-por-item'], registros: p['avaliacoes-posicionamento'], decisoes: p['posicionamento-decisoes'] });
/* a avaliação S como a tela grava na criação (salvarRegistro), com a origem montada pelo núcleo real */
function squad(itemId, comOrigem) {
  const r = { itemId, itemNome: 'Item ' + itemId, avaliacaoArquiteturalId: 'p' + itemId, questionarioCodigo: 'ADEQUACAO_SQUAD', questionnaireContentVersion: 1, status: 'rascunho',
    criadoEm: QUANDO, atualizadoEm: QUANDO, criadoPor: { name: 'P', email: ARQ }, atualizadoPor: { name: 'P', email: ARQ }, respostas: {}, excluido: false };
  if (comOrigem !== false) r.origemLiberacao = T.origemLiberacaoSquad(T.liberacaoSquad(itemId, dados(POSIC)), QUANDO);
  return r;
}

(async () => {
  const rules = fs.readFileSync(process.env.FA_REGRAS || path.join(__dirname, '..', '..', 'database.rules.json'), 'utf8'); /* FA_REGRAS: provas de mutação */
  const env = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-squad-liberacao', database: { rules } });
  await env.clearDatabase();
  const db = (e) => env.authenticatedContext('uid-' + k(e), { email: e }).database();
  const admin = async (f) => env.withSecurityRulesDisabled(async (c) => f(c.database()));
  const ler = async (p) => { let v; await admin(async (d) => { v = (await d.ref(p).once('value')).val(); }); return v; };
  await admin(async (d) => {
    await d.ref('fa-avaliacao-autorizados/' + k(ARQ)).set({ email: ARQ, tipo: 'avaliacao-arquitetura' });
    await d.ref('fa-avaliacao-autorizados/' + k(AVAL)).set({ email: AVAL, tipo: 'avaliacao' });
    for (const n of Object.keys(POSIC)) await d.ref(n).set(POSIC[n]);
  });
  const TS = { '.sv': 'timestamp' };
  const interruptor = (e, valor, o) => {
    o = o || {};
    const aud = o.aud || ('a' + Math.random().toString(36).slice(2, 8)), quem = { uid: o.uid || ('uid-' + k(e)), email: e }, motivo = o.motivo === undefined ? 'Motivo da alteração' : o.motivo;
    const w = { [CF]: { exigirParaSquad: valor, alteradoEm: TS, alteradoPor: quem, motivo, auditoriaId: aud },
      [CFA + '/' + aud]: { exigirParaSquad: valor, anterior: o.anterior === undefined ? null : o.anterior, motivo, usuario: quem, dataHora: TS } };
    if (o.mexer) o.mexer(w, aud);
    return w;
  };

  console.log('A. o interruptor antigo: ninguém grava; o histórico continua legível');
  await admin(async (d) => { await d.ref(CFA + '/aud0').set({ exigirParaSquad: false, anterior: null, motivo: 'registro antigo', usuario: { uid: 'x', email: ADM }, dataHora: 1 }); });
  await caso('admin geral NÃO grava mais o interruptor', db(ADM).ref().update(interruptor(ADM, true, { anterior: false })), false);
  await caso('admin geral NÃO grava mais só o valor', db(ADM).ref(CF + '/exigirParaSquad').set(true), false);
  await caso('admin geral NÃO acrescenta auditoria', db(ADM).ref(CFA + '/audN').set({ exigirParaSquad: true, anterior: false, motivo: 'm', usuario: { uid: 'uid-' + k(ADM), email: ADM }, dataHora: TS }), false);
  await caso('Avaliação + Configuração não grava', db(ARQ).ref().update(interruptor(ARQ, true, { anterior: false })), false);
  await caso('reescrever o histórico é recusado', db(ADM).ref(CFA + '/aud0/motivo').set('outro'), false);
  await caso('apagar o histórico é recusado', db(ADM).ref(CFA + '/aud0').remove(), false);
  await caso('admin geral lê o histórico', db(ADM).ref(CFA).once('value'), true);
  afirmaRegistro((await ler(CFA + '/aud0')).motivo === 'registro antigo', 'o histórico antigo continua intacto');

  console.log('B. a criação de uma avaliação S não depende do Posicionamento');
  await caso('cria S de item sem Posicionamento (sem origem)', db(AVAL).ref(SQ + '/s1').set(squad('iSem', false)), true);
  await caso('cria S de item Área Especializada (origem registrada)', db(AVAL).ref(SQ + '/s2').set(squad('iAE')), true);
  await caso('cria S de item novo (chave própria)', db(AVAL).ref(SQ + '/s3').set(Object.assign(squad('s3'), {})), true);

  console.log('E. Porta 2: objeto organizacional encerrado não recebe nova S');
  await admin(async (d) => { await d.ref('objetos-organizacionais/oEnc/situacao').set('encerrado'); await d.ref('objetos-organizacionais/oAtv/situacao').set('ativo'); });
  await caso('objeto ENCERRADO: nova S recusada', db(AVAL).ref(SQ + '/o1').set(squad('oEnc', false)), false);
  await caso('objeto ativo: nova S aceita', db(AVAL).ref(SQ + '/o2').set(squad('oAtv', false)), true);
  await admin(async (d) => { await d.ref('objetos-organizacionais/oAtv/situacao').set('encerrado'); });
  await caso('S que já existia continua sendo salva depois do encerramento do objeto', db(AVAL).ref(SQ + '/o2').set(Object.assign(squad('oAtv', false), { atualizadoEm: '2026-10-12T12:00:00.000Z' })), true);

  console.log('C. com o interruptor antigo gravado como LIGADO, nada muda (independência do O1–O9)');
  await admin(async (d) => { await d.ref(CF).set({ exigirParaSquad: true, alteradoEm: 1, alteradoPor: { uid: 'x', email: ADM }, motivo: 'm', auditoriaId: 'z' }); });
  await caso('item sem Posicionamento: aceita', db(AVAL).ref(SQ + '/c1').set(squad('iSem')), true);
  await caso('item novo (chave própria): aceita', db(AVAL).ref(SQ + '/c2').set(squad('c2')), true);
  await caso('Área Especializada (recomendação, não liberada): aceita', db(AVAL).ref(SQ + '/c3').set(squad('iAE')), true);
  await caso('A_VALIDAR sem decisão: aceita', db(AVAL).ref(SQ + '/c4').set(squad('iAVno')), true);
  await caso('recomendação Linha com decisão final CoE: aceita', db(AVAL).ref(SQ + '/c5').set(squad('iDiv')), true);
  await caso('A_VALIDAR com decisão final liberadora: aceita', db(AVAL).ref(SQ + '/c6').set(squad('iAV')), true);
  await caso('recomendação Linha (Negócios): aceita', db(AVAL).ref(SQ + '/c7').set(squad('iL')), true);
  await caso('rascunho criado antes: continua sendo salvo', db(AVAL).ref(SQ + '/s2').set(Object.assign(squad('iAE'), { respostas: { S1: { resposta: 'sim' } } })), true);
  await caso('… e concluído', db(AVAL).ref(SQ + '/s2/status').set('concluido'), true);
  await caso('rascunho sem origem criado antes: continua sendo salvo', db(AVAL).ref(SQ + '/s1').set(squad('iSem', false)), true);
  /* exclusão lógica como a tela grava (justificativa, autoria, horário do servidor e auditoria na mesma gravação) */
  await caso('exclusão lógica de uma S existente continua', db(AVAL).ref().update({ [SQ + '/s3/excluido']: true, [SQ + '/s3/justificativaExclusao']: 'duplicada', [SQ + '/s3/excluidoEm']: { '.sv': 'timestamp' }, [SQ + '/s3/excluidoPor']: { email: AVAL, name: 'P' }, [SQ + '/s3/auditoriaExclusaoId']: 'aex', ['avaliacoes-squad-auditoria/s3/aex']: { tipo: 'exclusao', justificativa: 'duplicada', em: { '.sv': 'timestamp' }, por: { email: AVAL, name: 'P' } } }), true);
  await caso('quem não tem perfil da Avaliação continua sem criar S', env.authenticatedContext('uid-sem', { email: 'sem.perfil@previ.com.br' }).database().ref(SQ + '/c9').set(squad('iL')), false);

  console.log('D. a origem da liberação é imutável');
  const s2 = await ler(SQ + '/s2');
  await caso('trocar a situação registrada: recusada', db(AVAL).ref(SQ + '/s2/origemLiberacao/situacao').set('liberado'), false);
  await caso('trocar o código registrado: recusada', db(AVAL).ref(SQ + '/s2').set(Object.assign(clone(s2), { origemLiberacao: Object.assign(clone(s2.origemLiberacao), { codigo: 'NEGOCIOS' }) })), false);
  await caso('remover a origem: recusada', db(AVAL).ref(SQ + '/s2').set(Object.assign(clone(s2), { origemLiberacao: null })), false);
  await caso('acrescentar origem a uma S antiga (sem origem): recusada', db(AVAL).ref(SQ + '/s1/origemLiberacao').set(squad('iL').origemLiberacao), false);
  await caso('regravar a S com a MESMA origem continua', db(AVAL).ref(SQ + '/s2').set(clone(s2)), true);
  afirmaRegistro(JSON.stringify((await ler(SQ + '/s2')).origemLiberacao) === JSON.stringify(s2.origemLiberacao) && s2.origemLiberacao.situacao === 'nao-liberado' && s2.origemLiberacao.codigo === 'AREA_ESPECIALIZADA',
    'a origem gravada na criação continua a mesma (Área Especializada, não liberada)');
  const canon = (v) => JSON.stringify(v, (kk, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, c) => { o[c] = x[c]; return o; }, {}) : x));
  afirmaRegistro(canon(await ler('avaliacoes-posicionamento')) === canon(POSIC['avaliacoes-posicionamento']) && canon(await ler('posicionamento-decisoes')) === canon(POSIC['posicionamento-decisoes']),
    'nenhuma avaliação ou decisão de Posicionamento mudou');

  await env.cleanup();
  console.log('\n' + (total - falhas) + '/' + total + ' casos.' + (falhas ? ' ' + falhas + ' falha(s).' : ' Tudo certo.'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
function afirmaRegistro(c, msg) { total++; if (c) console.log('  ok    ' + msg); else { falhas++; console.log('  FALHA ' + msg); } }
