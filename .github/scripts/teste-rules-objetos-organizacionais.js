/* ═════════════════════════════════════════════════════════════════
   Regras do banco — OBJETOS ORGANIZACIONAIS e a PORTA 2 do Posicionamento Organizacional (PR 1 da Porta 2).

   Roda contra o EMULADOR real do Realtime Database (teste-rules.yml) com o database.rules.json de produção. As
   gravações são as que o código real monta: forca-agil/objetos-organizacionais-nucleo.js (objetos) e o núcleo da tela
   de Posicionamento (faAvaliacaoPosicionamentoNucleo). Prova, pelo BANCO:
   A. Leitura: os três perfis da Avaliação leem os 3 nós; sem perfil e sem login, não.
   B. Escrita: só "Avaliação + Configuração" e admin geral; "Avaliação" não cria, não altera, não encerra.
   C. Criação: revisão 1, ativo, horário do SERVIDOR, autoria do token, auditoria "criacao" na mesma gravação, campos
      obrigatórios sem texto em branco, nada além do previsto.
   D. Alteração: revisão anterior + 1, criação e referência fixas, auditoria "alteracao" com antes → depois verdadeiros.
   E. Encerramento: motivo obrigatório, auditoria "encerramento", final (nada mais se grava), nada se apaga; recusado
      com rascunho de Posicionamento aberto ou com estrutura responsável ativa.
   F. Referência informativa a um item P1–P16: um objeto ativo por item; recusada se o item tem Posicionamento vigente
      ou rascunho aberto; o índice não se grava nem se apaga sozinho; encerrar libera a referência.
   G. Auditoria só de acréscimo.
   H. Posicionamento pela Porta 2: nasce só para objeto ATIVO, sem base P1–P16, com o nome do objeto e com hipótese
      inicial válida; origem e hipótese fixas; conclui com o resultado exato do motor (a hipótese não muda nada: resultado
      igual à hipótese mas diferente do motor é recusado); decisão final como na Porta 1; reavaliação mantém a origem.
   I. Porta 1: hipótese inicial obrigatória em todo registro novo (PR 3) e não inicia Posicionamento de item referenciado
      por objeto ativo; o resto como antes.
   ═════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const RAIZ = path.join(__dirname, '..', '..');
const O = require(path.join(RAIZ, 'forca-agil', 'objetos-organizacionais-nucleo.js'));
const M = require(path.join(RAIZ, 'forca-agil', 'motor-posicionamento.js'));
const MOTOR_OK = { motorVersion: require('./montar-regras-posicionamento.js').MOTOR_PRODUTO, motorVersionArquitetura: 1 };

/* o núcleo da tela de Posicionamento, como em teste-rules-posicionamento-decisao.js (com o critério de reavaliação) */
function carregarNucleoPosicionamento() {
  const raiz = path.join(RAIZ, 'forca-agil');
  const ctx = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, setTimeout, clearTimeout, setInterval, clearInterval, parseFloat, parseInt, isNaN };
  ctx.window = ctx;
  const el = () => ({ addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, style: {}, classList: { add() {}, remove() {}, contains() { return false; } } });
  ctx.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: el(), documentElement: el() };
  ctx.firebase = { database: () => ({ ref: () => ({ on() {}, off() {}, once() { return Promise.resolve({ val: () => null }); }, update() {}, child() { return this; }, push() { return { key: 'k' }; } }) }) };
  ctx.navigator = {}; ctx.location = { hash: '' }; ctx.localStorage = { getItem() { return null; }, setItem() {} };
  vm.createContext(ctx);
  for (const f of ['questionarios-config.js', 'motor-arquitetura.js', 'avaliacao-produto.js', 'motor-posicionamento.js', 'motor-posicionamento-nucleo.js']) vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8'), ctx, { filename: f });
  delete ctx.document;
  vm.runInContext(fs.readFileSync(path.join(raiz, 'avaliacao-posicionamento.js'), 'utf8'), ctx, { filename: 'avaliacao-posicionamento.js' });
  ctx.faPosicionamentos = { nome: (c) => 'Nome de ' + c, usandoContingencia: () => false };
  if (!ctx.faCriterioReavaliacao) throw new Error('faCriterioReavaliacao não carregou');
  return ctx.faAvaliacaoPosicionamentoNucleo;
}
const N = carregarNucleoPosicionamento();

let total = 0, falhas = 0;
function anota(rotulo, ok, det) { total++; if (ok) console.log('  ok    ' + rotulo); else { falhas++; console.error('  FALHA ' + rotulo + (det ? ' → ' + det : '')); } }
const emailKey = (e) => String(e).toLowerCase().replace(/[@.]/g, '_');
const SUPER = 'tatianefdirene@previ.com.br', ADMIN = 'admin.geral@previ.com.br', ARQ = 'arquitetura@previ.com.br', AVAL = 'avaliacao@previ.com.br', SEM = 'sem.acesso@previ.com.br';
const OBJ = O.NODE, AUD = O.AUD, IDX = O.IDX_REF;
const AV = 'avaliacoes-posicionamento', RES = 'posicionamento-rascunho-por-item', VIG = 'posicionamento-vigente-por-item', AUDP = 'posicionamento-auditoria', DEC = 'posicionamento-decisoes';
const TS = { '.sv': 'timestamp' };
const QUANDO = '2026-10-13T12:00:00.000Z';
const js = (v) => JSON.parse(JSON.stringify(v));
const usuario = (e) => ({ uid: emailKey(e), email: e, name: 'Pessoa ' + e.split('@')[0] });
const quemPos = (e) => ({ name: 'Pessoa', email: e });
const DADOS = { nome: 'Assessoramento jurídico', descricao: 'Preventivo, consultivo, contencioso e negocial.', finalidade: 'Segurança jurídica das decisões.', contexto: 'Teste' };
let seq = 0;
const novaChave = (p) => p + (++seq);

async function main() {
  const rules = fs.readFileSync(process.env.RULES_PATH || path.join(RAIZ, 'database.rules.json'), 'utf8');
  const env = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-rules-objetos', database: { rules } });
  const db = (e) => (e ? env.authenticatedContext(emailKey(e), { email: e }) : env.unauthenticatedContext()).database();
  const semear = (fn) => env.withSecurityRulesDisabled((c) => fn(c.database()));
  const ler = async (p) => { let v; await semear(async (a) => { v = (await a.ref(p).once('value')).val(); }); return v; };
  const up = (e, w) => db(e).ref().update(js(w));
  async function pode(rotulo, prom) { try { await assertSucceeds(prom); anota(rotulo, true); } catch (e) { anota(rotulo, false, 'NEGADO: ' + String(e.message || e).slice(0, 200)); } }
  async function nega(rotulo, prom) { try { await assertFails(prom); anota(rotulo, true); } catch (e) { anota(rotulo, false, 'foi ACEITO'); } }

  await env.clearDatabase();
  await semear(async (a) => {
    await a.ref('fa-admins/' + emailKey(ADMIN)).set({ email: ADMIN });
    await a.ref('fa-avaliacao-autorizados/' + emailKey(ARQ)).set({ email: ARQ, tipo: 'avaliacao-arquitetura' });
    await a.ref('fa-avaliacao-autorizados/' + emailKey(AVAL)).set({ email: AVAL, tipo: 'avaliacao' });
    /* itens P1–P16 (Porta 1) para referência e para a Porta 1 */
    for (const it of ['pLivre', 'pVig', 'pRasc', 'pDup', 'pP1', 'pRef2']) await a.ref('avaliacoes-produto/' + it).set(Object.assign({ itemId: it, nome: 'Item ' + it, status: 'concluido', excluido: false }, MOTOR_OK));
    await a.ref(VIG + '/pVig').set('posX');
    await a.ref(RES + '/pRasc').set('posY');
  });
  const criar = (e, extra) => {
    extra = extra || {};
    const id = extra.id || novaChave('o'), audId = novaChave('a');
    const w = O.payloadCriacao({ id, audId, dados: extra.dados || DADOS, referenciaItemId: extra.ref, usuario: usuario(extra.como || e), agora: TS });
    if (extra.mexer) extra.mexer(w, id, audId);
    return { id, audId, w };
  };

  console.log('\n== A. Leitura ==');
  const c0 = criar(ARQ);
  await pode('Avaliação + Configuração cria um objeto (para ler)', up(ARQ, c0.w));
  for (const e of [SUPER, ADMIN, ARQ, AVAL]) for (const n of [OBJ, AUD, IDX]) await pode(e.split('@')[0] + ' lê ' + n, db(e).ref(n).once('value'));
  for (const n of [OBJ, AUD, IDX]) { await nega('sem perfil NÃO lê ' + n, db(SEM).ref(n).once('value')); await nega('sem login NÃO lê ' + n, db(null).ref(n).once('value')); }

  console.log('\n== B. Escrita só de Avaliação + Configuração e admin geral ==');
  await nega('perfil Avaliação NÃO cria', up(AVAL, criar(AVAL).w));
  await nega('sem perfil NÃO cria', up(SEM, criar(SEM).w));
  await pode('admin geral (lista fixa) cria', up(SUPER, criar(SUPER).w));
  await pode('admin geral (fa-admins) cria', up(ADMIN, criar(ADMIN).w));
  const atual0 = await ler(OBJ + '/' + c0.id);
  await nega('perfil Avaliação NÃO altera', up(AVAL, O.payloadAlteracao({ id: c0.id, atual: atual0, audId: novaChave('a'), dados: Object.assign({}, DADOS, { nome: 'Outro' }), usuario: usuario(AVAL), agora: TS })));
  await nega('perfil Avaliação NÃO encerra', up(AVAL, O.payloadEncerramento({ id: c0.id, atual: atual0, audId: novaChave('a'), motivo: 'x', usuario: usuario(AVAL), agora: TS })));

  console.log('\n== C. Criação ==');
  anota('criado ativo, revisão 1, horário do servidor (número), auditoria apontada', atual0.situacao === 'ativo' && atual0.revisao === 1 && typeof atual0.criadoEm === 'number' && atual0.atualizadoEm === atual0.criadoEm &&
    atual0.auditoriaId === c0.audId && (await ler(AUD + '/' + c0.id + '/' + c0.audId + '/tipo')) === 'criacao');
  const nCria = (rotulo, mexer, extra) => nega(rotulo, up(ARQ, criar(ARQ, Object.assign({ mexer }, extra || {})).w));
  await nCria('sem auditoria: recusado', (w, id, aud) => { delete w[AUD + '/' + id + '/' + aud]; });
  await nCria('auditoria de outro tipo: recusado', (w, id, aud) => { w[AUD + '/' + id + '/' + aud].tipo = 'alteracao'; });
  await nCria('auditoria com depois diferente do objeto: recusado', (w, id, aud) => { w[AUD + '/' + id + '/' + aud].depois.nome = 'Outro nome'; });
  await nCria('revisão 2 na criação: recusado', (w, id, aud) => { w[OBJ + '/' + id].revisao = 2; w[AUD + '/' + id + '/' + aud].revisao = 2; });
  await nCria('já nasce encerrado: recusado', (w, id) => { w[OBJ + '/' + id].situacao = 'encerrado'; });
  await nCria('horário do cliente (não do servidor): recusado', (w, id) => { w[OBJ + '/' + id].criadoEm = 1791713600000; });
  await nCria('autoria de outra pessoa: recusado', null, { como: SUPER });
  await nCria('nome só com espaços: recusado', (w, id, aud) => { w[OBJ + '/' + id].nome = '   '; w[AUD + '/' + id + '/' + aud].depois.nome = '   '; });
  await nCria('sem finalidade: recusado', (w, id, aud) => { delete w[OBJ + '/' + id].finalidade; delete w[AUD + '/' + id + '/' + aud].depois.finalidade; });
  await nCria('campo fora do previsto: recusado', (w, id) => { w[OBJ + '/' + id].tipoOrganizacional = 'COE'; });
  await nCria('auditoria órfã (sem o objeto): recusado', (w, id) => { delete w[OBJ + '/' + id]; });
  let erroNucleo = null; try { O.payloadCriacao({ id: 'x1', audId: 'y1', dados: { nome: 'só nome' }, usuario: usuario(ARQ), agora: TS }); } catch (e) { erroNucleo = e.erros; }
  anota('o núcleo explica o que falta (descrição e finalidade obrigatórias)', JSON.stringify((erroNucleo || []).map((x) => x.campo)) === '["descricao","finalidade"]');

  console.log('\n== D. Alteração ==');
  const altera = (id, atual, dados, e, mexer) => { const w = O.payloadAlteracao({ id, atual, audId: novaChave('a'), dados, usuario: usuario(e || ARQ), agora: TS }); if (mexer) mexer(w); return w; };
  const d2 = Object.assign({}, DADOS, { nome: 'Assessoramento jurídico (novo nome)' });
  await nega('pulando revisão: recusado', up(ARQ, altera(c0.id, atual0, d2, ARQ, (w) => { w[OBJ + '/' + c0.id].revisao = 3; Object.values(w).forEach((x) => { if (x && x.tipo) x.revisao = 3; }); })));
  await nega('mudando a data de criação: recusado', up(ARQ, altera(c0.id, atual0, d2, ARQ, (w) => { w[OBJ + '/' + c0.id].criadoEm = 1; })));
  await nega('mudando quem criou: recusado', up(ARQ, altera(c0.id, atual0, d2, ARQ, (w) => { w[OBJ + '/' + c0.id].criadoPor = usuario(SUPER); })));
  await nega('auditoria com "antes" falso: recusado', up(ARQ, altera(c0.id, atual0, d2, ARQ, (w) => { Object.values(w).forEach((x) => { if (x && x.tipo) x.antes.nome = 'Inventado'; }); })));
  await nega('sem auditoria: recusado', up(ARQ, altera(c0.id, atual0, d2, ARQ, (w) => { Object.keys(w).forEach((k) => { if (k.indexOf(AUD) === 0) delete w[k]; }); })));
  await pode('alteração válida (revisão 2, antes → depois)', up(ARQ, altera(c0.id, atual0, d2)));
  const atual1 = await ler(OBJ + '/' + c0.id);
  anota('revisão 2, nome novo, criação intacta', atual1.revisao === 2 && atual1.nome === d2.nome && atual1.criadoEm === atual0.criadoEm);
  await nega('gravação sobre a revisão antiga (de novo 1 → 2): recusada', up(ARQ, altera(c0.id, atual0, Object.assign({}, DADOS, { nome: 'Terceiro' }))));
  let semAlt = null; try { altera(c0.id, atual1, Object.assign({}, d2)); } catch (e) { semAlt = e.erros && e.erros[0].codigo; }
  anota('o núcleo não monta gravação sem mudança (SEM_ALTERACAO)', semAlt === 'SEM_ALTERACAO');
  await nega('apagar o objeto: recusado', db(ARQ).ref(OBJ + '/' + c0.id).remove());

  console.log('\n== E. Encerramento ==');
  const encerra = (id, atual, motivo, e, mexer) => { const w = O.payloadEncerramento({ id, atual, audId: novaChave('a'), motivo, usuario: usuario(e || ARQ), agora: TS }); if (mexer) mexer(w); return w; };
  await nega('sem motivo (só espaços): recusado', up(ARQ, encerra(c0.id, atual1, 'x', ARQ, (w) => { w[OBJ + '/' + c0.id].encerramento.motivo = '  '; Object.values(w).forEach((x) => { if (x && x.tipo) x.motivo = '  '; }); })));
  await nega('mudando o nome ao encerrar: recusado', up(ARQ, encerra(c0.id, atual1, 'Fim', ARQ, (w) => { w[OBJ + '/' + c0.id].nome = 'Outro'; })));
  await nega('auditoria com motivo diferente: recusado', up(ARQ, encerra(c0.id, atual1, 'Fim', ARQ, (w) => { Object.values(w).forEach((x) => { if (x && x.tipo) x.motivo = 'Outro motivo'; }); })));
  await semear((a) => a.ref(RES + '/' + c0.id).set('posAberto'));
  await nega('com rascunho de Posicionamento aberto: recusado', up(ARQ, encerra(c0.id, atual1, 'Fim')));
  await semear((a) => a.ref(RES + '/' + c0.id).remove());
  await semear((a) => a.ref('estruturas-vinculos/ativo-por-objeto/' + c0.id).set('v1'));
  await nega('com estrutura responsável ativa: recusado', up(ARQ, encerra(c0.id, atual1, 'Fim')));
  await semear((a) => a.ref('estruturas-vinculos/ativo-por-objeto/' + c0.id).remove());
  await pode('encerramento válido (motivo, revisão 3)', up(ARQ, encerra(c0.id, atual1, 'Atuação incorporada a outra')));
  const atual2 = await ler(OBJ + '/' + c0.id);
  anota('encerrado com motivo, horário do servidor e auditoria', atual2.situacao === 'encerrado' && atual2.revisao === 3 && atual2.encerramento.motivo === 'Atuação incorporada a outra' && typeof atual2.encerramento.em === 'number' &&
    (await ler(AUD + '/' + c0.id + '/' + atual2.auditoriaId + '/tipo')) === 'encerramento');
  const reabrir = js(atual2); reabrir.situacao = 'ativo'; delete reabrir.encerramento; reabrir.revisao = 4;
  await nega('encerrado é final: reabrir é recusado', db(ARQ).ref(OBJ + '/' + c0.id).set(reabrir));
  await nega('encerrado é final: alterar texto é recusado', db(ARQ).ref(OBJ + '/' + c0.id + '/nome').set('Outro'));
  await nega('encerrado não se apaga', db(SUPER).ref(OBJ + '/' + c0.id).remove());

  console.log('\n== F. Referência informativa a um item P1–P16 ==');
  const cr = criar(ARQ, { ref: 'pLivre' });
  await pode('objeto com referência a item sem Posicionamento: aceito (com o índice)', up(ARQ, cr.w));
  anota('o índice aponta para o objeto', (await ler(IDX + '/pLivre')) === cr.id);
  await nega('segundo objeto com a mesma referência: recusado', up(ARQ, criar(ARQ, { ref: 'pLivre' }).w));
  await nega('referência a item com Posicionamento vigente: recusada', up(ARQ, criar(ARQ, { ref: 'pVig' }).w));
  await nega('referência a item com rascunho aberto (o caso do Jurídico): recusada', up(ARQ, criar(ARQ, { ref: 'pRasc' }).w));
  await nega('objeto com referência mas sem o índice: recusado', up(ARQ, criar(ARQ, { ref: 'pRef2', mexer: (w) => { delete w[IDX + '/pRef2']; } }).w));
  await nega('índice gravado sozinho: recusado', db(ARQ).ref(IDX + '/pRef2').set(cr.id));
  await nega('índice apagado com o objeto ativo: recusado', db(ARQ).ref(IDX + '/pLivre').remove());
  const atualR = await ler(OBJ + '/' + cr.id);
  await nega('mudar a referência numa alteração: recusado', up(ARQ, altera(cr.id, atualR, Object.assign({}, DADOS, { nome: 'Mudou' }), ARQ, (w) => { w[OBJ + '/' + cr.id].referenciaItemId = 'pRef2'; })));
  await nega('encerrar sem liberar o índice: recusado', up(ARQ, encerra(cr.id, atualR, 'Fim', ARQ, (w) => { delete w[IDX + '/pLivre']; })));
  await pode('encerrar libera o índice na mesma gravação', up(ARQ, encerra(cr.id, atualR, 'Fim')));
  anota('índice liberado', (await ler(IDX + '/pLivre')) === null);
  await pode('depois do encerramento, outro objeto pode referenciar o mesmo item', up(ARQ, criar(ARQ, { ref: 'pLivre' }).w));

  console.log('\n== G. Auditoria só de acréscimo ==');
  await nega('reescrever uma auditoria: recusado', db(SUPER).ref(AUD + '/' + c0.id + '/' + c0.audId + '/depois/nome').set('Reescrito'));
  await nega('apagar uma auditoria: recusado', db(SUPER).ref(AUD + '/' + c0.id + '/' + c0.audId).remove());

  console.log('\n== H. Posicionamento pela Porta 2 ==');
  const ob = criar(ARQ, { dados: Object.assign({}, DADOS, { nome: 'Disseminação de agilidade' }) });
  await pode('objeto para a Porta 2', up(ARQ, ob.w));
  const nomeObj = 'Disseminação de agilidade';
  const pc = (o) => N.payloadCriacao(Object.assign({ id: 'pz' + (++seq), audId: 'kz' + seq, itemId: ob.id, itemNome: nomeObj, origem: O.ORIGEM, hipoteseInicial: 'COE', versao: 1, usuario: quemPos(ARQ), agora: QUANDO }, o || {}));
  const chaveDe = (w) => Object.keys(w).find((k) => k.indexOf(AV + '/') === 0).split('/')[1];
  await nega('objeto inexistente: recusado', up(ARQ, pc({ itemId: 'naoExiste' })));
  await nega('sem hipótese: recusado', up(ARQ, pc({ hipoteseInicial: undefined })));
  await nega('hipótese que não é um posicionamento firme (LINHA): recusada', up(ARQ, pc({ hipoteseInicial: 'LINHA' })));
  await nega('com base P1–P16 junto: recusado', up(ARQ, pc({ avaliacaoArquiteturalId: 'pLivre' })));
  await nega('com nome diferente do objeto: recusado', up(ARQ, pc({ itemNome: 'Outro nome' })));
  await nega('perfil Avaliação NÃO cria', up(AVAL, N.payloadCriacao({ id: 'pzA', audId: 'kzA', itemId: ob.id, itemNome: nomeObj, origem: O.ORIGEM, hipoteseInicial: 'COE', versao: 1, usuario: quemPos(AVAL), agora: QUANDO })));
  const wP = pc();
  const idP = chaveDe(wP);
  await pode('Posicionamento da Porta 2: objeto ativo, sem P1–P16, hipótese CoE', up(ARQ, wP));
  anota('auditoria de criação com origem e hipótese', (await ler(AUDP + '/' + idP + '/' + wP[AV + '/' + idP].auditoriaCriacaoId + '/hipoteseInicial')) === 'COE');
  const reg = js(wP[AV + '/' + idP]);
  const sem = js(reg); delete sem.hipoteseInicial;
  await nega('tirar a hipótese num salvamento: recusado', up(ARQ, N.payloadSalvar(idP, sem, quemPos(ARQ), QUANDO, 1)));
  const outraH = js(reg); outraH.hipoteseInicial = 'NEGOCIOS';
  await nega('trocar a hipótese num salvamento: recusado', up(ARQ, N.payloadSalvar(idP, outraH, quemPos(ARQ), QUANDO, 1)));
  const semOrigem = js(reg); delete semOrigem.origem;
  await nega('tirar a origem num salvamento: recusado', up(ARQ, N.payloadSalvar(idP, semOrigem, quemPos(ARQ), QUANDO, 1)));
  /* respostas de Linha de Negócios — a hipótese é CoE: o motor decide pelas respostas */
  reg.respostas = {};
  [['O1', 'SIM'], ['O2', 'NAO'], ['O3', 'NAO'], ['O4', 'NAO'], ['O5', 'SIM']].forEach(([q, v]) => { reg.respostas[q] = js(N.snapshotResposta(q, v, 1, null, QUANDO)); });
  await pode('salvar o rascunho com as respostas', up(ARQ, N.payloadSalvar(idP, reg, quemPos(ARQ), QUANDO, 1)));
  const pzOk = N.payloadConclusao(idP, reg, quemPos(ARQ), QUANDO, 2, 'kzc');
  anota('a conclusão montada pelo núcleo é NEGOCIOS (o motor), não a hipótese CoE', pzOk.payload[AV + '/' + idP].resultadoAutomatico.codigoResultado === 'NEGOCIOS');
  const adulterado = js(pzOk.payload);
  adulterado[AV + '/' + idP].resultadoAutomatico.codigoResultado = 'COE'; adulterado[AV + '/' + idP].resultadoAutomatico.regra = 'N1_COE'; adulterado[AV + '/' + idP].resultadoAutomatico.liberaSquad = false;
  adulterado[AUDP + '/' + idP + '/kzc'].codigoResultado = 'COE'; adulterado[AUDP + '/' + idP + '/kzc'].regra = 'N1_COE'; adulterado[AUDP + '/' + idP + '/kzc'].liberaSquad = false;
  await nega('resultado igual à hipótese (CoE) mas diferente do motor: recusado', up(ARQ, adulterado));
  await semear((a) => a.ref(OBJ + '/' + ob.id + '/situacao').set('encerrado'));
  await nega('concluir com o objeto encerrado: recusado', up(ARQ, pzOk.payload));
  await semear((a) => a.ref(OBJ + '/' + ob.id + '/situacao').set('ativo'));
  await pode('conclusão com o resultado exato do motor (NEGOCIOS)', up(ARQ, pzOk.payload));
  anota('vigente do objeto aponta para a avaliação; hipótese e origem intactas', (await ler(VIG + '/' + ob.id)) === idP && (await ler(AV + '/' + idP + '/hipoteseInicial')) === 'COE' && (await ler(AV + '/' + idP + '/origem')) === O.ORIGEM);
  anota('a comparação: hipótese CoE × recomendação Negócios = não confirmada', O.compararHipotese('COE', 'NEGOCIOS') === 'nao-confirmada');
  const regC = await ler(AV + '/' + idP);
  await pode('decisão final na Porta 2 (divergência com justificativa)', up(ARQ, N.payloadDecisao({ id: idP, reg: regC, codigoFinal: 'COE', justificativa: 'A disciplina é a responsabilidade predominante.', usuario: quemPos(ARQ), agora: QUANDO, audId: 'kzd' })));
  const reav = (o) => N.payloadReavaliacao(Object.assign({ id: 'pr' + (++seq), audId: 'kr' + seq, anteriorId: idP, anterior: regC, itemNome: nomeObj, versao: 1, motivo: 'Revisão', usuario: quemPos(ARQ), agora: QUANDO, hipoteseInicial: 'COE' }, o || {}));
  const wR = reav();
  anota('a reavaliação montada pelo núcleo mantém a origem da anterior', wR[AV + '/' + chaveDe(wR)].origem === O.ORIGEM);
  const wRsem = reav(); delete wRsem[AV + '/' + chaveDe(wRsem)].origem; Object.keys(wRsem).forEach((k) => { if (k.indexOf(AUDP + '/') === 0) delete wRsem[k].origem; });
  await nega('reavaliação que perde a origem: recusada', up(ARQ, wRsem));
  await pode('reavaliação da Porta 2 (nova hipótese, mesma origem)', up(ARQ, wR));

  console.log('\n== I. Porta 1 intacta, salvo o índice de referência ==');
  const p1 = (item, o) => N.payloadCriacao(Object.assign({ id: 'p1' + (++seq), audId: 'k1' + seq, itemId: item, itemNome: 'Item ' + item, avaliacaoArquiteturalId: item, versao: 1, usuario: quemPos(ARQ), agora: QUANDO }, o || {}));
  await nega('Porta 1 sem hipótese inicial (PR 3: obrigatória em todo registro novo): recusada', up(ARQ, p1('pP1')));
  await pode('Porta 1 com hipótese (Não sei): aceita', up(ARQ, p1('pDup', { hipoteseInicial: 'NAO_SEI' })));
  await pode('Porta 1 com hipótese firme: aceita', up(ARQ, p1('pP1', { hipoteseInicial: 'NEGOCIOS' })));
  await nega('Porta 1 sem a base P1–P16: recusada', up(ARQ, p1('pRef2', { avaliacaoArquiteturalId: undefined, hipoteseInicial: 'NAO_SEI' })));
  const comRef = criar(ARQ, { ref: 'pRef2' });
  await pode('objeto ativo referenciando pRef2', up(ARQ, comRef.w));
  await nega('Porta 1 não inicia Posicionamento de item referenciado por objeto ativo', up(ARQ, p1('pRef2', { hipoteseInicial: 'NAO_SEI' })));
  await nega('Porta 1 com origem de Porta 2 e base P1–P16: recusada', up(ARQ, p1('pLivre', { origem: O.ORIGEM, hipoteseInicial: 'COE' })));

  await env.cleanup();
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
