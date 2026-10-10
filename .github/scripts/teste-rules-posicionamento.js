/* ═════════════════════════════════════════════════════════════════
   Regras do banco — AVALIAÇÃO DE POSICIONAMENTO ORGANIZACIONAL O1–O9 (PR E).

   Roda contra o EMULADOR real do Realtime Database (firebase emulators:exec, ver teste-rules.yml) com o
   database.rules.json de produção. O que se prova (pelo BANCO, não pela tela):
   A. Leitura: admin geral, "Avaliação" e "Avaliação + Arquitetura" leem; quem não está na lista e quem não
      tem login, não.
   B. Escrita só de "Avaliação + Arquitetura" e admin geral: "Avaliação" NÃO cria, salva, conclui nem descarta.
   C. Pré-condição: só item com Avaliação de Produto/Serviço concluída e não excluída (qualquer classificação).
   D. Criação atômica: avaliação + reserva (posicionamento-rascunho-por-item) + auditoria "criacao", ou nada;
      um rascunho por item; duas criações simultâneas → uma só entra, sem avaliação órfã.
   E. Rascunho: revisão otimista (anterior + 1); campos fixos; CAMINHO — resposta, observação e diagnóstico só
      onde o caminho alcançado permite (nada fora dele, nem por gravação parcial); nada de resultado ou decisão.
   F. Conclusão: os 36 estados completos concluem com o resultado EXATO do motor v1; qualquer campo calculado
      adulterado, versão do motor desconhecida, dado incompleto ou diagnóstico pendente é recusado; conclusão
      cria o ponteiro posicionamento-vigente-por-item, libera a reserva e grava a auditoria, juntos.
   G. Vigente: um só Posicionamento concluído por item; o ponteiro não é reescrito nem apagado; concluída é final.
   H. Descarte: motivo (não vazio, até 500), libera a reserva, auditoria "descarte"; descartada é final; nada se apaga.
   I. Auditoria só de acréscimo e sempre ligada à avaliação.
   J. As gravações que a TELA monta (faAvaliacaoPosicionamentoNucleo, o código real de avaliacao-posicionamento.js)
      passam nas regras: criar → salvar → concluir nos 36 estados, descartar, e a limpeza de ramo — quem pode
      editar, consegue gravar.
   ═════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const T = require('./regras-posicionamento-tabela.js');
const M = require(path.join(__dirname, '..', '..', 'forca-agil', 'motor-posicionamento.js'));
const vm = require('vm');

/* O núcleo da tela (sem DOM), carregado do arquivo real, com o questionário de fábrica e nomes fixos da Taxonomia. */
function carregarNucleo() {
  const raiz = path.join(__dirname, '..', '..', 'forca-agil');
  const ctx = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, setTimeout, clearTimeout };
  ctx.window = ctx;
  ctx.firebase = { database: () => ({ ref: () => ({ on() {}, off() {}, once() { return Promise.resolve({ val: () => null }); } }) }) };
  vm.createContext(ctx);
  for (const f of ['questionarios-config.js', 'motor-posicionamento.js', 'avaliacao-posicionamento.js']) vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8'), ctx, { filename: f });
  ctx.faPosicionamentos = { nome: (c) => 'Nome de ' + c, usandoContingencia: () => false };
  return ctx.faAvaliacaoPosicionamentoNucleo;
}

let total = 0, falhas = 0;
function anota(linha, ok, detalhe) {
  total++;
  if (ok) { console.log('  ok    ' + linha); return; }
  falhas++;
  console.error('  FALHA ' + linha + (detalhe ? ' → ' + detalhe : ''));
}
function emailKey(email) { return String(email || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64); }

const SUPER = 'tatianefdirene@previ.com.br';
const ADMIN = 'admin.geral@previ.com.br';
const AVAL = 'avaliacao@previ.com.br';
const ARQ = 'arquitetura@previ.com.br';
const SEM = 'sem.acesso@previ.com.br';
const AV = 'avaliacoes-posicionamento', RES = 'posicionamento-rascunho-por-item', VIG = 'posicionamento-vigente-por-item', AUD = 'posicionamento-auditoria';
const QUANDO = '2026-10-09T12:00:00.000Z';
const clone = (v) => JSON.parse(JSON.stringify(v));

/* registro de rascunho como a tela monta */
function rascunho(itemId, aaId, email, extra) {
  return Object.assign({
    itemId, itemNome: 'Item ' + itemId, avaliacaoArquiteturalId: aaId, questionarioCodigo: 'POSICIONAMENTO_ORGANIZACIONAL',
    questionnaireContentVersion: 1, versao: 1, status: 'rascunho', revisao: 1,
    criadoPor: { name: 'Pessoa', email }, criadoEm: QUANDO, atualizadoPor: { name: 'Pessoa', email }, atualizadoEm: QUANDO,
    auditoriaCriacaoId: 'kc-' + itemId
  }, extra || {});
}
function criar(id, itemId, aaId, email, extra) {
  const r = rascunho(itemId, aaId, email, extra);
  return {
    [AV + '/' + id]: r,
    [RES + '/' + itemId]: id,
    [AUD + '/' + id + '/' + r.auditoriaCriacaoId]: { tipo: 'criacao', itemId, avaliacaoArquiteturalId: aaId, usuario: { name: 'Pessoa', email }, dataHora: QUANDO }
  };
}
function respostaDe(q, v, extra) {
  return Object.assign({ resposta: v, codigoPergunta: q, tituloNaEpoca: 'Título ' + q, textoPerguntaNaEpoca: 'Texto ' + q,
    interpretacaoNaEpoca: v + ' — interpretação', questionnaireContentVersion: 1, dataResposta: QUANDO }, extra || {});
}
function diagDe(n, v, papeis) {
  return { resposta: v, papeis, tituloNaEpoca: 'Conflito ou recorte', textoPerguntaNaEpoca: 'Texto do diagnóstico', rotuloNaEpoca: v === 'mesma' ? 'Mesma responsabilidade' : 'Responsabilidades distintas',
    interpretacaoNaEpoca: 'interp', questionnaireContentVersion: 1, dataResposta: QUANDO };
}
function preencher(reg, respostas, diagnosticos) {
  const r = clone(reg);
  r.respostas = {};
  Object.keys(respostas).forEach((q) => { r.respostas[q] = respostaDe(q, respostas[q]); });
  if (diagnosticos && Object.keys(diagnosticos).length) {
    r.diagnosticos = {};
    Object.keys(diagnosticos).forEach((n) => {
      const papeis = T.NIVEIS[n].filter((q) => respostas[q] === 'SIM').map((q) => T.PAPEL[q]);
      r.diagnosticos[n] = diagDe(n, diagnosticos[n], papeis);
    });
  } else delete r.diagnosticos;
  return r;
}
/* o resultado do motor como a tela grava (Firebase descarta null e listas vazias) */
function resultadoGravavel(res) {
  const out = {};
  Object.keys(res).forEach((k) => {
    const v = res[k];
    if (v === null || (Array.isArray(v) && !v.length)) return;
    out[k] = v;
  });
  return out;
}
function concluir(id, reg, email, mexer) {
  const res = M.avaliar(Object.keys(reg.respostas || {}).reduce((o, q) => { o[q] = reg.respostas[q].resposta; return o; }, {}),
    Object.keys(reg.diagnosticos || {}).reduce((o, n) => { o[n] = reg.diagnosticos[n].resposta; return o; }, {}));
  const r = clone(reg);
  r.status = 'concluido';
  r.revisao = reg.revisao + 1;
  r.resultadoAutomatico = resultadoGravavel(res);
  r.nomesNaConclusao = {};
  [res.codigoResultado, res.nivelConfirmado].concat(res.papeisDetectados).forEach((k) => {
    if (k && k !== 'A_VALIDAR') r.nomesNaConclusao[k] = { nome: 'Nome ' + k, contingencia: false };
  });
  if (!Object.keys(r.nomesNaConclusao).length) delete r.nomesNaConclusao;
  r.concluidoPor = { name: 'Pessoa', email }; r.concluidoEm = QUANDO; r.atualizadoPor = { name: 'Pessoa', email };
  r.auditoriaConclusaoId = 'kf-' + reg.itemId;
  const p = {
    [AV + '/' + id]: r,
    [RES + '/' + reg.itemId]: null,
    [VIG + '/' + reg.itemId]: id,
    [AUD + '/' + id + '/' + r.auditoriaConclusaoId]: { tipo: 'conclusao', itemId: reg.itemId, codigoResultado: res.codigoResultado, regra: res.regra,
      versaoMotor: res.versaoMotor, liberaSquad: res.liberaSquad, usuario: { name: 'Pessoa', email }, dataHora: QUANDO }
  };
  if (mexer) mexer(p, r, res);
  return { p, res };
}
function descartar(id, reg, email, motivo) {
  const r = clone(reg);
  r.status = 'descartado'; r.revisao = reg.revisao + 1; r.motivoDescarte = motivo; r.descartadoPor = { name: 'Pessoa', email }; r.descartadoEm = QUANDO;
  r.atualizadoPor = { name: 'Pessoa', email };
  r.auditoriaDescarteId = 'kd-' + reg.itemId;
  return {
    [AV + '/' + id]: r,
    [RES + '/' + reg.itemId]: null,
    [AUD + '/' + id + '/' + r.auditoriaDescarteId]: { tipo: 'descarte', itemId: reg.itemId, motivo, usuario: { name: 'Pessoa', email }, dataHora: QUANDO }
  };
}

async function main() {
  const rules = fs.readFileSync(process.env.RULES_PATH || path.join(__dirname, '..', '..', 'database.rules.json'), 'utf8');
  const testEnv = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-rules-posicionamento', database: { rules } });
  const db = (email) => (email ? testEnv.authenticatedContext(emailKey(email), { email }) : testEnv.unauthenticatedContext()).database();
  const semear = (fn) => testEnv.withSecurityRulesDisabled((c) => fn(c.database()));
  const ler = async (p) => { let v; await semear(async (a) => { v = (await a.ref(p).once('value')).val(); }); return v; };
  async function pode(rotulo, prom) { try { await assertSucceeds(prom); anota(rotulo, true); } catch (e) { anota(rotulo, false, 'foi NEGADO: ' + String(e.message || e).slice(0, 160)); } }
  async function nega(rotulo, prom) { try { await assertFails(prom); anota(rotulo, true); } catch (e) { anota(rotulo, false, 'foi PERMITIDO (deveria negar)'); } }
  const up = (email, p) => db(email).ref().update(p);

  async function base(nItens) {
    await testEnv.clearDatabase();
    await semear(async (a) => {
      const u = {};
      u['fa-admins/' + emailKey(ADMIN)] = { email: ADMIN };
      u['fa-avaliacao-autorizados/' + emailKey(AVAL)] = { email: AVAL, tipo: 'avaliacao' };
      u['fa-avaliacao-autorizados/' + emailKey(ARQ)] = { email: ARQ, tipo: 'avaliacao-arquitetura' };
      for (let i = 1; i <= (nItens || 6); i++) u['avaliacoes-produto/p' + i] = { itemId: 'p' + i, nome: 'Item p' + i, status: 'concluido', resultadoAutomatico: 'produto', decisaoFinal: 'produto' };
      u['avaliacoes-produto/px'] = { itemId: 'px', nome: 'Excluído', status: 'concluido', excluido: true, resultadoAutomatico: 'produto', decisaoFinal: 'produto' };
      u['avaliacoes-produto/pr'] = { itemId: 'pr', nome: 'Rascunho', status: 'rascunho', resultadoAutomatico: null };
      u['avaliacoes-produto/pleg'] = { nome: 'Legado sem itemId', status: 'concluido', resultadoAutomatico: 'nao-produto', decisaoFinal: 'nao-produto' };
      u['avaliacoes-produto/pv2'] = { itemId: 'p1', nome: 'Item p1 v2', status: 'concluido', versao: 2, versaoAnteriorKey: 'p1', resultadoAutomatico: 'produto', decisaoFinal: 'produto' };
      await a.ref().update(u);
    });
  }

  console.log('\n== A. Leitura ==');
  await base();
  await semear((a) => a.ref().update(criar('a1', 'p1', 'p1', ARQ)));
  for (const [quem, email] of [['"Avaliação"', AVAL], ['"Avaliação + Arquitetura"', ARQ], ['admin geral', ADMIN]]) {
    await pode(quem + ' lê as avaliações de Posicionamento', db(email).ref(AV).once('value'));
    await pode(quem + ' lê as reservas de rascunho', db(email).ref(RES).once('value'));
    await pode(quem + ' lê o índice de vigentes', db(email).ref(VIG).once('value'));
    await pode(quem + ' lê a auditoria', db(email).ref(AUD + '/a1').once('value'));
  }
  await nega('quem não está na lista NÃO lê as avaliações', db(SEM).ref(AV).once('value'));
  await nega('quem não está na lista NÃO lê a auditoria', db(SEM).ref(AUD).once('value'));
  await nega('sem login NÃO lê', db(null).ref(AV).once('value'));

  console.log('\n== B. Escrita só de "Avaliação + Arquitetura" e admin geral ==');
  await base();
  await nega('"Avaliação" NÃO cria (gravação completa e válida)', up(AVAL, criar('b1', 'p1', 'p1', AVAL)));
  await nega('quem não está na lista NÃO cria', up(SEM, criar('b1', 'p1', 'p1', SEM)));
  await nega('sem login NÃO cria', db(null).ref().update(criar('b1', 'p1', 'p1', 'x@previ.com.br')));
  await pode('"Avaliação + Arquitetura" cria', up(ARQ, criar('b1', 'p1', 'p1', ARQ)));
  await pode('admin geral (fa-admins) cria', up(ADMIN, criar('b2', 'p2', 'p2', ADMIN)));
  await pode('admin geral (e-mail fixo) cria', up(SUPER, criar('b3', 'p3', 'p3', SUPER)));
  const b1 = await ler(AV + '/b1');
  const b1s = preencher(b1, { O1: 'NAO', O2: 'SIM', O3: 'NAO' }); b1s.revisao = 2; b1s.atualizadoPor = { name: 'P', email: AVAL };
  await nega('"Avaliação" NÃO salva rascunho', db(AVAL).ref(AV + '/b1').set(b1s));
  const b1c = concluir('b1', preencher(b1, { O1: 'NAO', O2: 'SIM', O3: 'NAO' }), AVAL).p;
  await nega('"Avaliação" NÃO conclui', up(AVAL, b1c));
  await nega('"Avaliação" NÃO descarta', up(AVAL, descartar('b1', b1, AVAL, 'motivo')));
  await nega('"Avaliação" NÃO grava na auditoria', db(AVAL).ref(AUD + '/b1/zz').set({ tipo: 'criacao', itemId: 'p1', usuario: { email: AVAL }, dataHora: QUANDO }));

  console.log('\n== C. Pré-condição: Avaliação de Produto/Serviço concluída e não excluída ==');
  await base();
  await nega('item com Avaliação de Produto EXCLUÍDA', up(ARQ, criar('c1', 'px', 'px', ARQ)));
  await nega('item com Avaliação de Produto em RASCUNHO', up(ARQ, criar('c1', 'pr', 'pr', ARQ)));
  await nega('avaliação de Produto inexistente', up(ARQ, criar('c1', 'pz', 'pz', ARQ)));
  await nega('itemId diferente do da avaliação de Produto', up(ARQ, criar('c1', 'p2', 'p1', ARQ)));
  await pode('versão 2 concluída do mesmo item (itemId p1, avaliação pv2)', up(ARQ, criar('c2', 'p1', 'pv2', ARQ)));
  await pode('avaliação de Produto legada sem itemId (itemId = a chave), classificada como não-produto: qualquer classificação serve', up(ARQ, criar('c3', 'pleg', 'pleg', ARQ)));

  console.log('\n== D. Criação atômica e um rascunho por item ==');
  await base();
  const sem = (p, k) => { const c = Object.assign({}, p); delete c[k]; return c; };
  await nega('criar SEM a reserva', up(ARQ, sem(criar('d1', 'p1', 'p1', ARQ), RES + '/p1')));
  await nega('criar SEM a auditoria "criacao"', up(ARQ, sem(criar('d1', 'p1', 'p1', ARQ), AUD + '/d1/kc-p1')));
  await nega('reserva apontando para outra avaliação', up(ARQ, Object.assign(criar('d1', 'p1', 'p1', ARQ), { [RES + '/p1']: 'outra' })));
  await nega('criar já concluída', up(ARQ, (() => { const p = criar('d1', 'p1', 'p1', ARQ); p[AV + '/d1'].status = 'concluido'; return p; })()));
  await nega('criar com revisão 2', up(ARQ, (() => { const p = criar('d1', 'p1', 'p1', ARQ); p[AV + '/d1'].revisao = 2; return p; })()));
  await nega('criar com versão 2 sem avaliação anterior (reavaliação: teste-rules-posicionamento-decisao.js)', up(ARQ, (() => { const p = criar('d1', 'p1', 'p1', ARQ); p[AV + '/d1'].versao = 2; return p; })()));
  await nega('criar com outro questionário', up(ARQ, (() => { const p = criar('d1', 'p1', 'p1', ARQ); p[AV + '/d1'].questionarioCodigo = 'ADEQUACAO_SQUAD'; return p; })()));
  await nega('criar em nome de outra pessoa', up(ARQ, (() => { const p = criar('d1', 'p1', 'p1', ARQ); p[AV + '/d1'].criadoPor.email = SUPER; return p; })()));
  await nega('criar com campo extra (decisaoFinal)', up(ARQ, (() => { const p = criar('d1', 'p1', 'p1', ARQ); p[AV + '/d1'].decisaoFinal = 'LINHA'; return p; })()));
  await nega('criar com resultado automático já preenchido', up(ARQ, (() => { const p = criar('d1', 'p1', 'p1', ARQ); p[AV + '/d1'].resultadoAutomatico = { codigoResultado: 'COE' }; return p; })()));
  const cri = criar('d1', 'p1', 'p1', ARQ);
  await nega('ISOLADO: só a avaliação (rascunho), sem reserva nem auditoria', db(ARQ).ref(AV + '/d1').set(cri[AV + '/d1']));
  await nega('ISOLADO: só a reserva', db(ARQ).ref(RES + '/p1').set('d1'));
  await nega('ISOLADO: só a auditoria "criacao"', db(ARQ).ref(AUD + '/d1/kc-p1').set(cri[AUD + '/d1/kc-p1']));
  await pode('criação completa: avaliação + reserva + auditoria, juntas', up(ARQ, cri));
  anota('…as três partes entraram', !!(await ler(AV + '/d1')) && (await ler(RES + '/p1')) === 'd1' && (await ler(AUD + '/d1/kc-p1/tipo')) === 'criacao');
  await nega('SEGUNDO rascunho para o mesmo item (reserva já existe)', up(ADMIN, criar('d2', 'p1', 'p1', ADMIN)));
  anota('…e nenhuma avaliação órfã ficou gravada', (await ler(AV + '/d2')) === null && (await ler(AUD + '/d2')) === null);
  await nega('a reserva NÃO é reescrita', db(ARQ).ref(RES + '/p1').set('d9'));
  await nega('a reserva NÃO é apagada enquanto o rascunho existe', db(ARQ).ref(RES + '/p1').remove());
  await nega('reserva solta, sem avaliação', db(ARQ).ref(RES + '/p2').set('d5'));
  /* duas criações SIMULTÂNEAS do mesmo item */
  const rs = await Promise.allSettled([up(ARQ, criar('d3', 'p2', 'p2', ARQ)), up(ADMIN, criar('d4', 'p2', 'p2', ADMIN))]);
  const okCount = rs.filter((r) => r.status === 'fulfilled').length;
  const vence = await ler(RES + '/p2');
  anota('duas criações simultâneas: exatamente uma entra (' + okCount + ')', okCount === 1);
  anota('…a reserva aponta para a que entrou e a outra não deixou rastro', (vence === 'd3' || vence === 'd4') && (await ler(AV + '/' + (vence === 'd3' ? 'd4' : 'd3'))) === null);

  console.log('\n== E. Rascunho: revisão, campos fixos e caminho ==');
  await base();
  await up(ARQ, criar('e1', 'p1', 'p1', ARQ));
  const e1 = await ler(AV + '/e1');
  const salvar = (reg, rev, mexer) => { const r = clone(reg); r.revisao = rev; r.atualizadoPor = { name: 'P', email: ARQ }; if (mexer) mexer(r); return db(ARQ).ref(AV + '/e1').set(r); };
  await pode('salvar O1–O3 com revisão anterior + 1', salvar(preencher(e1, { O1: 'SIM', O2: 'NAO', O3: 'NAO' }), 2));
  const e2 = await ler(AV + '/e1');
  await nega('salvar com a MESMA revisão (gravação desatualizada)', salvar(e2, 2));
  await nega('salvar pulando revisão (+2)', salvar(e2, 4));
  await nega('salvar com atualizadoPor de outra pessoa', salvar(e2, 3, (r) => { r.atualizadoPor.email = SUPER; }));
  await nega('mudar o itemId', salvar(e2, 3, (r) => { r.itemId = 'p2'; }));
  await nega('mudar a avaliação de Produto de origem', salvar(e2, 3, (r) => { r.avaliacaoArquiteturalId = 'pv2'; }));
  await nega('mudar a versão do questionário', salvar(e2, 3, (r) => { r.questionnaireContentVersion = 2; }));
  await nega('mudar quem criou', salvar(e2, 3, (r) => { r.criadoPor.email = SUPER; }));
  await nega('rascunho com resultadoAutomatico', salvar(e2, 3, (r) => { r.resultadoAutomatico = resultadoGravavel(M.avaliar({ O1: 'SIM', O2: 'NAO', O3: 'NAO' }, {})); }));
  await nega('rascunho com nomesNaConclusao', salvar(e2, 3, (r) => { r.nomesNaConclusao = { LINHA: { nome: 'Linha', contingencia: false } }; }));
  await nega('rascunho com campo de decisão (decisaoManual)', salvar(e2, 3, (r) => { r.decisaoManual = true; }));
  await pode('Linha confirmada: O4–O5 entram no caminho', salvar(preencher(e2, { O1: 'SIM', O2: 'NAO', O3: 'NAO', O4: 'NAO', O5: 'NAO' }), 3));
  const e3 = await ler(AV + '/e1');
  await pode('ramo Plataforma: O6–O9 entram (parcial)', salvar(preencher(e3, { O1: 'SIM', O2: 'NAO', O3: 'NAO', O4: 'NAO', O5: 'NAO', O6: 'SIM' }), 4));
  const e4 = await ler(AV + '/e1');
  await nega('resposta fora do caminho: O4 com O1 = NAO', salvar(preencher(e4, { O1: 'NAO', O2: 'SIM', O3: 'NAO', O4: 'NAO' }), 5));
  await nega('resposta fora do caminho: O4 com N1 incompleto', salvar(preencher(e4, { O1: 'SIM', O2: 'NAO', O4: 'NAO' }), 5));
  await nega('resposta fora do caminho: O6 com O5 = SIM', salvar(preencher(e4, { O1: 'SIM', O2: 'NAO', O3: 'NAO', O4: 'NAO', O5: 'SIM', O6: 'NAO' }), 5));
  await nega('NAO fora do caminho também não é gravado (O7 = NAO com O4 = SIM)', salvar(preencher(e4, { O1: 'SIM', O2: 'NAO', O3: 'NAO', O4: 'SIM', O5: 'NAO', O7: 'NAO' }), 5));
  await nega('GRAVAÇÃO PARCIAL que fecha o ramo deixando O6 para trás (só O1 = NAO)', db(ARQ).ref().update({ [AV + '/e1/respostas/O1/resposta']: 'NAO', [AV + '/e1/revisao']: 5 }));
  await nega('observação de pergunta fora do caminho (O4 só com observação)', salvar(e4, 5, (r) => { r.respostas = { O1: respostaDe('O1', 'NAO'), O2: respostaDe('O2', 'NAO'), O3: respostaDe('O3', 'SIM'), O4: { observacao: 'nota antiga' } }; }));
  await nega('observação sem resposta (O2 só com observação)', salvar(e4, 5, (r) => { r.respostas.O2 = { observacao: 'x' }; }));
  await pode('observação na pergunta respondida (até 2000)', salvar(e4, 5, (r) => { r.respostas.O1.observacao = 'x'.repeat(2000); }));
  const e5 = await ler(AV + '/e1');
  await nega('observação com mais de 2000 caracteres', salvar(e5, 6, (r) => { r.respostas.O1.observacao = 'x'.repeat(2001); }));
  await nega('resposta inválida ("TALVEZ")', salvar(e5, 6, (r) => { r.respostas.O1.resposta = 'TALVEZ'; }));
  await nega('resposta com código de outra pergunta', salvar(e5, 6, (r) => { r.respostas.O1.codigoPergunta = 'O2'; }));
  await nega('pergunta que não existe (O10)', salvar(e5, 6, (r) => { r.respostas.O10 = respostaDe('O10', 'SIM'); }));
  await pode('diagnóstico N1 com exatamente 2 SIM e os 2 papéis certos', salvar(preencher(e5, { O1: 'SIM', O2: 'SIM', O3: 'NAO' }, { N1: 'mesma' }), 6));
  const e6 = await ler(AV + '/e1');
  await nega('diagnóstico N1 com 1 SIM só', salvar(preencher(e6, { O1: 'NAO', O2: 'SIM', O3: 'NAO' }, {}), 7, (r) => { r.diagnosticos = { N1: diagDe('N1', 'mesma', ['AREA_ESPECIALIZADA']) }; }));
  await nega('diagnóstico N1 com 3 SIM (é recorte, sem diagnóstico)', salvar(preencher(e6, { O1: 'SIM', O2: 'SIM', O3: 'SIM' }), 7, (r) => { r.diagnosticos = { N1: diagDe('N1', 'mesma', ['LINHA', 'AREA_ESPECIALIZADA']) }; }));
  await nega('diagnóstico com os papéis errados', salvar(e6, 7, (r) => { r.diagnosticos.N1.papeis = ['LINHA', 'COE']; }));
  await nega('diagnóstico com resposta inválida (SIM)', salvar(e6, 7, (r) => { r.diagnosticos.N1.resposta = 'SIM'; }));
  await nega('diagnóstico N2 sem Linha confirmada', salvar(e6, 7, (r) => { r.diagnosticos.N2 = diagDe('N2', 'mesma', ['ESTRATEGIA_CLIENTES', 'NEGOCIOS']); }));
  await nega('diagnóstico com observação de mais de 2000', salvar(e6, 7, (r) => { r.diagnosticos.N1.observacao = 'y'.repeat(2001); }));
  await pode('diagnóstico N1 com observação', salvar(e6, 7, (r) => { r.diagnosticos.N1.observacao = 'nota'; }));
  await nega('apagar a avaliação', db(ARQ).ref(AV + '/e1').remove());
  await nega('apagar o nó inteiro', db(SUPER).ref(AV).remove());

  console.log('\n== F. Conclusão: os 36 estados completos, com o resultado exato do motor ==');
  const estados = T.estadosConcluiveis();
  await base(estados.length + 40);
  let aceitos = 0, falhou = [];
  for (let i = 0; i < estados.length; i++) {
    const id = 'f' + i, item = 'p' + (i + 1);
    await semear((a) => a.ref().update(criar(id, item, item, ARQ)));
    const reg = preencher(await ler(AV + '/' + id), estados[i].est.respostas, estados[i].est.diagnosticos);
    try { await assertSucceeds(up(ARQ, concluir(id, reg, ARQ).p)); aceitos++; } catch (e) { falhou.push(estados[i].regra.id + ' ' + JSON.stringify(estados[i].est) + ' ' + String(e.message).slice(0, 80)); }
  }
  anota('os ' + estados.length + ' estados completos concluem com o resultado do motor (' + aceitos + ')', aceitos === estados.length, falhou.slice(0, 3).join(' | '));
  anota('cada conclusão criou o vigente, liberou a reserva e gravou a auditoria', (await ler(VIG + '/p1')) === 'f0' && (await ler(RES + '/p1')) === null &&
    Object.values((await ler(AUD + '/f0')) || {}).some((x) => x.tipo === 'conclusao'));
  /* adulterações, num item novo */
  const ITEM = 'p' + (estados.length + 1), ID = 'fx';
  await semear((a) => a.ref().update(criar(ID, ITEM, ITEM, ARQ)));
  const regBase = await ler(AV + '/' + ID);
  const comp = preencher(regBase, { O1: 'SIM', O2: 'NAO', O3: 'NAO', O4: 'NAO', O5: 'NAO', O6: 'SIM', O7: 'SIM', O8: 'NAO', O9: 'NAO' }, { N3: 'distintas' });
  /* cada adulteração num rascunho NOVO, de outro item: se uma passasse, não mascararia as seguintes */
  let nAdult = 0;
  const RESPOSTAS_COMP = { O1: 'SIM', O2: 'NAO', O3: 'NAO', O4: 'NAO', O5: 'NAO', O6: 'SIM', O7: 'SIM', O8: 'NAO', O9: 'NAO' };
  const adult = async (rotulo, mexer) => {
    const id = 'fa' + (++nAdult), item = 'p' + (estados.length + 4 + nAdult);
    await semear((a) => a.ref().update(criar(id, item, item, ARQ)));
    const reg = preencher(await ler(AV + '/' + id), RESPOSTAS_COMP, { N3: 'distintas' });
    return nega(rotulo, up(ARQ, concluir(id, reg, ARQ, mexer ? (p, r, res) => mexer(p, r, res, id, item) : null).p));
  };
  /* a auditoria acompanha a adulteração (mesmos código, regra, versão e liberaSquad): quem recusa é a
     conferência do RESULTADO contra as respostas, não a da auditoria */
  const R = (fn) => (p, r, res, id, item) => {
    fn(r.resultadoAutomatico, r, p);
    const a = p[AUD + '/' + id + '/kf-' + item], ra = r.resultadoAutomatico;
    ['codigoResultado', 'regra', 'versaoMotor', 'liberaSquad'].forEach((k) => { a[k] = ra[k]; });
  };
  await adult('liberaSquad invertido', R((ra) => { ra.liberaSquad = !ra.liberaSquad; }));
  await adult('codigoResultado trocado (PLATAFORMA_CANAIS)', R((ra) => { ra.codigoResultado = 'PLATAFORMA_CANAIS'; ra.tipoAValidar = null; }));
  await adult('regra trocada (N3_CONFLITO)', R((ra) => { ra.regra = 'N3_CONFLITO'; }));
  await adult('motivo trocado', R((ra) => { ra.motivo = 'DIAGNOSTICO_MESMA'; }));
  await adult('tipoAValidar trocado (CONFLITO)', R((ra) => { ra.tipoAValidar = 'CONFLITO'; }));
  await adult('tipoAValidar apagado', R((ra) => { delete ra.tipoAValidar; }));
  await adult('nivelConfirmado trocado (LINHA)', R((ra) => { ra.nivelConfirmado = 'LINHA'; }));
  await adult('papeisDetectados trocados', R((ra) => { ra.papeisDetectados = ['PLATAFORMA_CANAIS', 'PLATAFORMA_CORPORATIVA']; }));
  await adult('papeisDetectados com um a mais', R((ra) => { ra.papeisDetectados = ra.papeisDetectados.concat(['COE']); }));
  await adult('niveisAlcancados trocados', R((ra) => { ra.niveisAlcancados = ['N1', 'N2']; }));
  await adult('perguntasForaDoCaminho preenchido', R((ra) => { ra.perguntasForaDoCaminho = ['O6']; }));
  await adult('versaoMotor 2 (versão desconhecida)', R((ra) => { ra.versaoMotor = 2; }));
  await adult('campo extra no resultado', R((ra) => { ra.observacao = 'x'; }));
  await adult('resultado ausente', (p, r) => { delete r.resultadoAutomatico; });
  await adult('sem criar o vigente', (p, r, res, id, item) => { delete p[VIG + '/' + item]; });
  await adult('vigente apontando para outra avaliação', (p, r, res, id, item) => { p[VIG + '/' + item] = 'f0'; });
  await adult('sem liberar a reserva', (p, r, res, id, item) => { delete p[RES + '/' + item]; });
  await adult('sem a auditoria "conclusao"', (p, r, res, id, item) => { delete p[AUD + '/' + id + '/kf-' + item]; });
  await adult('auditoria com outro resultado', (p, r, res, id, item) => { p[AUD + '/' + id + '/kf-' + item].codigoResultado = 'COE'; });
  await adult('auditoria com outro liberaSquad', (p, r, res, id, item) => { p[AUD + '/' + id + '/kf-' + item].liberaSquad = false; });
  await adult('concluidoPor de outra pessoa', (p, r) => { r.concluidoPor.email = SUPER; });
  await adult('nomesNaConclusao com código fora dos 10', (p, r) => { r.nomesNaConclusao = { SQUAD: { nome: 'Squad', contingencia: false } }; });
  await adult('nome na conclusão vazio', (p, r) => { r.nomesNaConclusao = { PLATAFORMA: { nome: '', contingencia: false } }; });
  await adult('campo de decisão junto (decisaoFinal)', (p, r) => { r.decisaoFinal = 'PLATAFORMA_CANAIS'; });
  /* incompletos: o motor dá A_VALIDAR, mas a tela operacional não conclui — e o banco também não */
  const incompleto = preencher(regBase, { O1: 'SIM', O2: 'NAO', O3: 'NAO', O4: 'NAO' });
  await nega('dados INCOMPLETOS (O5 sem resposta), mesmo com o resultado do motor (RESPOSTA_FALTANDO)', up(ARQ, concluir(ID, incompleto, ARQ).p));
  const pendente = preencher(regBase, { O1: 'SIM', O2: 'SIM', O3: 'NAO' });
  await nega('diagnóstico PENDENTE (2 SIM sem diagnóstico), mesmo com o resultado do motor', up(ARQ, concluir(ID, pendente, ARQ).p));
  await nega('"Avaliação" NÃO conclui (estado válido)', up(AVAL, concluir(ID, comp, AVAL).p));
  const cParte = concluir(ID, comp, ARQ).p;
  await nega('ISOLADO: só a avaliação vira concluída', db(ARQ).ref(AV + '/' + ID).set(cParte[AV + '/' + ID]));
  await nega('ISOLADO: só o vigente é criado', db(ARQ).ref(VIG + '/' + ITEM).set(ID));
  await nega('ISOLADO: só a auditoria "conclusao"', db(ARQ).ref(AUD + '/' + ID + '/kf-' + ITEM).set(cParte[AUD + '/' + ID + '/kf-' + ITEM]));
  await nega('ISOLADO: concluída + vigente, sem liberar a reserva e sem auditoria', up(ARQ, { [AV + '/' + ID]: cParte[AV + '/' + ID], [VIG + '/' + ITEM]: ID }));
  anota('…e nada mudou: rascunho, reserva, sem vigente nem auditoria de conclusão', (await ler(AV + '/' + ID + '/status')) === 'rascunho' && (await ler(RES + '/' + ITEM)) === ID &&
    (await ler(VIG + '/' + ITEM)) === null && (await ler(AUD + '/' + ID + '/kf-' + ITEM)) === null);
  await pode('controle: o mesmo estado, sem adulteração, conclui (avaliação + reserva liberada + vigente + auditoria, juntos)', up(ARQ, concluir(ID, comp, ARQ).p));
  anota('…tudo entrou junto', (await ler(AV + '/' + ID + '/status')) === 'concluido' && (await ler(RES + '/' + ITEM)) === null && (await ler(VIG + '/' + ITEM)) === ID &&
    (await ler(AUD + '/' + ID + '/kf-' + ITEM + '/tipo')) === 'conclusao');
  anota('gravado: RECORTE do N3, PLATAFORMA, liberaSquad true', (await ler(AV + '/' + ID + '/resultadoAutomatico/codigoResultado')) === 'A_VALIDAR' &&
    (await ler(AV + '/' + ID + '/resultadoAutomatico/tipoAValidar')) === 'RECORTE' && (await ler(AV + '/' + ID + '/resultadoAutomatico/liberaSquad')) === true);

  console.log('\n== G. Um Posicionamento vigente por item; concluída é final ==');
  const conc = await ler(AV + '/' + ID);
  await nega('nova avaliação para item com Posicionamento vigente', up(ARQ, criar('g1', ITEM, ITEM, ARQ)));
  await nega('o vigente NÃO é reescrito', db(ARQ).ref(VIG + '/' + ITEM).set('g9'));
  await nega('o vigente NÃO é apagado', db(SUPER).ref(VIG + '/' + ITEM).remove());
  await nega('vigente solto (sem conclusão na mesma gravação)', db(ARQ).ref(VIG + '/p40').set('f1'));
  await nega('concluída NÃO é alterada (observação)', db(ARQ).ref(AV + '/' + ID).set(Object.assign(clone(conc), { revisao: conc.revisao + 1, nomesNaConclusao: { PLATAFORMA: { nome: 'Outro', contingencia: false } } })));
  await nega('concluída NÃO volta a rascunho', db(ARQ).ref(AV + '/' + ID).set(Object.assign(clone(conc), { revisao: conc.revisao + 1, status: 'rascunho' })));
  await nega('concluída NÃO é descartada', up(ARQ, descartar(ID, conc, ARQ, 'motivo')));
  await nega('concluída NÃO é apagada', db(SUPER).ref(AV + '/' + ID).remove());
  /* uma SEGUNDA conclusão para o mesmo item (rascunho criado antes do vigente existir, por fora da tela) */
  const I2 = 'p' + (estados.length + 2);
  await semear((a) => a.ref().update(Object.assign(criar('g2', I2, I2, ARQ), criar('g3', 'p' + (estados.length + 3), 'p' + (estados.length + 3), ARQ))));
  const g2 = preencher(await ler(AV + '/g2'), { O1: 'NAO', O2: 'NAO', O3: 'SIM' });
  await pode('primeira conclusão do item cria o vigente', up(ARQ, concluir('g2', g2, ARQ).p));
  await semear((a) => a.ref().update({ [AV + '/g3/itemId']: I2, [RES + '/' + I2]: 'g3' }));  /* rascunho do mesmo item, forçado por fora */
  const g3 = preencher(await ler(AV + '/g3'), { O1: 'NAO', O2: 'SIM', O3: 'NAO' });
  await nega('SEGUNDA conclusão para o mesmo item (o vigente já existe), por escrita direta e completa', up(ARQ, concluir('g3', g3, ARQ).p));
  await nega('…nem pelo e-mail fixo de admin geral', up(SUPER, concluir('g3', g3, SUPER).p));
  await nega('…nem omitindo o vigente da gravação', up(ARQ, (() => { const p = concluir('g3', g3, ARQ).p; delete p[VIG + '/' + I2]; return p; })()));
  anota('o vigente continua o primeiro', (await ler(VIG + '/' + I2)) === 'g2');

  console.log('\n== H. Descarte ==');
  await base(8);
  await up(ARQ, criar('h1', 'p1', 'p1', ARQ));
  const h1 = preencher(await ler(AV + '/h1'), { O1: 'SIM' });
  await up(ARQ, { [AV + '/h1']: Object.assign(clone(h1), { revisao: 2, atualizadoPor: { name: 'P', email: ARQ } }) });
  const h2 = await ler(AV + '/h1');
  await nega('descartar sem motivo', up(ARQ, descartar('h1', h2, ARQ, '')));
  /* motivo só de espaço em branco: cada caso num rascunho PRÓPRIO, para uma aceitação indevida não mascarar os seguintes */
  const BRANCOS = [['só de espaços', '   '], ['só de tabulações', '\t\t'], ['só de quebras de linha', '\n\n'], ['só de retorno de carro + quebra', '\r\n'],
    ['misturando espaço, tabulação e quebra de linha', ' \t\n \r ']];
  for (let k = 0; k < BRANCOS.length; k++) {
    const idW = 'hw' + k, itW = 'p' + (k + 2);
    await up(ARQ, criar(idW, itW, itW, ARQ));
    await nega('descartar com motivo ' + BRANCOS[k][0], up(ARQ, descartar(idW, await ler(AV + '/' + idW), ARQ, BRANCOS[k][1])));
    anota('…e o rascunho continua rascunho, com a reserva (' + BRANCOS[k][0] + ')', (await ler(AV + '/' + idW + '/status')) === 'rascunho' && (await ler(RES + '/' + itW)) === idW);
  }
  await up(ARQ, criar('hw9', 'p8', 'p8', ARQ));
  await pode('controle: motivo com texto, mesmo cercado de espaço e quebra de linha, é aceito', up(ARQ, descartar('hw9', await ler(AV + '/hw9'), ARQ, ' Item errado\n')));
  await nega('descartar com motivo de mais de 500', up(ARQ, descartar('h1', h2, ARQ, 'm'.repeat(501))));
  await nega('descartar SEM liberar a reserva', up(ARQ, (() => { const p = descartar('h1', h2, ARQ, 'Item errado'); delete p[RES + '/p1']; return p; })()));
  await nega('descartar SEM a auditoria "descarte"', up(ARQ, (() => { const p = descartar('h1', h2, ARQ, 'Item errado'); delete p[AUD + '/h1/kd-p1']; return p; })()));
  await nega('descartar em nome de outra pessoa', up(ARQ, (() => { const p = descartar('h1', h2, ARQ, 'Item errado'); p[AV + '/h1'].descartadoPor.email = SUPER; return p; })()));
  await nega('descartar com resultado preenchido', up(ARQ, (() => { const p = descartar('h1', h2, ARQ, 'Item errado'); p[AV + '/h1'].resultadoAutomatico = { codigoResultado: 'COE' }; return p; })()));
  const dParte = descartar('h1', h2, ARQ, 'Item errado');
  await nega('ISOLADO: só a avaliação vira descartada (sem reserva nem auditoria)', db(ARQ).ref(AV + '/h1').set(dParte[AV + '/h1']));
  await nega('ISOLADO: só a reserva é removida', db(ARQ).ref(RES + '/p1').remove());
  await nega('ISOLADO: só a auditoria "descarte"', db(ARQ).ref(AUD + '/h1/kd-p1').set(dParte[AUD + '/h1/kd-p1']));
  anota('…e nada mudou: rascunho, reserva e auditoria como antes', (await ler(AV + '/h1/status')) === 'rascunho' && (await ler(RES + '/p1')) === 'h1' && (await ler(AUD + '/h1/kd-p1')) === null);
  await pode('descartar: status descartado + motivo + reserva liberada + auditoria, juntos', up(ARQ, descartar('h1', h2, ARQ, 'Item errado')));
  anota('o registro continua lá, descartado, com as respostas', (await ler(AV + '/h1/status')) === 'descartado' && (await ler(AV + '/h1/respostas/O1/resposta')) === 'SIM' && (await ler(RES + '/p1')) === null);
  const h3 = await ler(AV + '/h1');
  await nega('descartada NÃO volta a rascunho', db(ARQ).ref(AV + '/h1').set(Object.assign(clone(h3), { revisao: h3.revisao + 1, status: 'rascunho' })));
  await nega('descartada NÃO é concluída', up(ARQ, concluir('h1', preencher(h3, { O1: 'NAO', O2: 'NAO', O3: 'SIM' }), ARQ).p));
  await nega('descartada NÃO é apagada', db(SUPER).ref(AV + '/h1').remove());
  await pode('depois do descarte, um novo rascunho para o mesmo item', up(ARQ, criar('h2', 'p1', 'p1', ARQ)));

  console.log('\n== I. Auditoria só de acréscimo ==');
  await nega('auditoria NÃO é reescrita', db(ARQ).ref(AUD + '/h1/kd-p1').set({ tipo: 'descarte', itemId: 'p1', motivo: 'outro', usuario: { email: ARQ }, dataHora: QUANDO }));
  await nega('auditoria NÃO é apagada', db(SUPER).ref(AUD + '/h1/kd-p1').remove());
  await nega('auditoria "solta", sem a avaliação apontar para ela', db(ARQ).ref(AUD + '/h1/solta').set({ tipo: 'criacao', itemId: 'p1', usuario: { email: ARQ }, dataHora: QUANDO }));
  await nega('auditoria com tipo desconhecido', db(ARQ).ref(AUD + '/h2/x').set({ tipo: 'outro', itemId: 'p1', usuario: { email: ARQ }, dataHora: QUANDO }));

  console.log('\n== J. As gravações montadas pela tela passam nas regras ==');
  const N = carregarNucleo();
  const est36 = T.estadosConcluiveis();
  await base(est36.length + 4);
  const quem = { name: 'Arquiteta', email: ARQ };
  const js = (v) => JSON.parse(JSON.stringify(v));
  let okCriar = 0, okSalvar = 0, okConcluir = 0, iguais = 0;
  for (let i = 0; i < est36.length; i++) {
    const x = est36[i], id = 'nu' + i, item = 'p' + (i + 1);
    const pc = js(N.payloadCriacao({ id, audId: 'kc' + i, itemId: item, itemNome: 'Item ' + item, avaliacaoArquiteturalId: item, versao: 1, usuario: quem, agora: QUANDO }));
    try { await assertSucceeds(up(ARQ, pc)); okCriar++; } catch (e) { anota('criação montada pela tela (' + x.regra.id + ')', false, String(e.message).slice(0, 160)); continue; }
    const reg = js(pc[AV + '/' + id]);
    reg.respostas = {};
    Object.keys(x.est.respostas).forEach((q) => { reg.respostas[q] = js(N.snapshotResposta(q, x.est.respostas[q], 1, 'Observação de ' + q, QUANDO)); });
    Object.keys(x.est.diagnosticos).forEach((n) => { reg.diagnosticos = reg.diagnosticos || {}; reg.diagnosticos[n] = js(N.snapshotDiagnostico(x.est.diagnosticos[n], N.papeisDoPar(reg, n), 1, 'Nota ' + n, QUANDO)); });
    try { await assertSucceeds(up(ARQ, js(N.payloadSalvar(id, reg, quem, QUANDO, 1)))); okSalvar++; } catch (e) { anota('salvar montado pela tela (' + x.regra.id + ')', false, String(e.message).slice(0, 160)); continue; }
    const pz = N.payloadConclusao(id, reg, quem, QUANDO, 2, 'kz' + i);
    try { await assertSucceeds(up(ARQ, js(pz.payload))); okConcluir++; } catch (e) { anota('conclusão montada pela tela (' + x.regra.id + ')', false, String(e.message).slice(0, 160)); continue; }
    const gravado = await ler(AV + '/' + id + '/resultadoAutomatico');
    const ordenado = (o) => JSON.stringify(Object.keys(o || {}).sort().map((k) => [k, o[k]]));
    if (ordenado(gravado) === ordenado(js(N.resultadoGravavel(M.avaliar(x.est.respostas, x.est.diagnosticos))))) iguais++;
  }
  anota('criação montada pela tela aceita nos ' + est36.length + ' itens (' + okCriar + ')', okCriar === est36.length);
  anota('rascunho completo (com observações e diagnóstico) salvo pela tela (' + okSalvar + ')', okSalvar === est36.length);
  anota('conclusão montada pela tela aceita nos 36 estados (' + okConcluir + ')', okConcluir === est36.length);
  anota('o resultado que a tela grava é o do motor, como o banco guarda (' + iguais + ')', iguais === est36.length);
  /* mudança de ramo: com a limpeza da tela grava; sem a limpeza, o banco recusa */
  const iR = est36.length + 1, idR = 'nr', itemR = 'p' + iR;
  const pR = js(N.payloadCriacao({ id: idR, audId: 'kcr', itemId: itemR, itemNome: 'Item ' + itemR, avaliacaoArquiteturalId: itemR, versao: 1, usuario: quem, agora: QUANDO }));
  await pode('ramo: criação', up(ARQ, pR));
  const regR = js(pR[AV + '/' + idR]);
  regR.respostas = {};
  [['O1', 'SIM'], ['O2', 'NAO'], ['O3', 'NAO'], ['O4', 'NAO'], ['O5', 'NAO'], ['O6', 'SIM'], ['O7', 'SIM'], ['O8', 'NAO'], ['O9', 'NAO']].forEach(([q, v]) => { regR.respostas[q] = js(N.snapshotResposta(q, v, 1, 'obs ' + q, QUANDO)); });
  regR.diagnosticos = { N3: js(N.snapshotDiagnostico('mesma', N.papeisDoPar(regR, 'N3'), 1, 'nota', QUANDO)) };
  await pode('ramo: Plataforma completo, com diagnóstico do N3, salvo pela tela', up(ARQ, js(N.payloadSalvar(idR, regR, quem, QUANDO, 1))));
  const fechado = js(regR); fechado.respostas.O5 = js(N.snapshotResposta('O5', 'SIM', 1, null, QUANDO));
  await nega('ramo fechado SEM a limpeza (O6–O9 e diagnóstico ficam): o banco recusa', up(ARQ, js(N.payloadSalvar(idR, fechado, quem, QUANDO, 2))));
  const limpo = N.limparForaDoCaminho(fechado);
  anota('a limpeza da tela tira O6–O9, as observações e o diagnóstico (nada vira NAO)', JSON.stringify(Object.keys(limpo.reg.respostas).sort()) === JSON.stringify(['O1', 'O2', 'O3', 'O4', 'O5']) &&
    !limpo.reg.diagnosticos && limpo.diagsRemovidos.join() === 'N3' && limpo.obsRemovidas.length === 5);
  await pode('ramo fechado COM a limpeza da tela: grava', up(ARQ, js(N.payloadSalvar(idR, limpo.reg, quem, QUANDO, 2))));
  await nega('gravação sobre revisão antiga (2 de novo): recusada', up(ARQ, js(N.payloadSalvar(idR, limpo.reg, quem, QUANDO, 1))));
  await pode('descarte montado pela tela (motivo, revisão 4)', up(ARQ, js(N.payloadDescarte(idR, js(await ler(AV + '/' + idR)), quem, QUANDO, 3, 'kdr', 'Iniciado por engano'))));
  anota('descartado: registro fica e a reserva sai', (await ler(AV + '/' + idR + '/status')) === 'descartado' && (await ler(RES + '/' + itemR)) === null);

  await testEnv.cleanup();
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
