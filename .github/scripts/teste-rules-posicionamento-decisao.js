/* ═════════════════════════════════════════════════════════════════
   Regras do banco — POSICIONAMENTO ORGANIZACIONAL: DECISÃO HUMANA, REAVALIAÇÃO E VIGÊNCIA (PR F).

   Roda contra o EMULADOR real do Realtime Database (firebase emulators:exec, ver teste-rules.yml) com o
   database.rules.json de produção. Todas as gravações "boas" são montadas pelo NÚCLEO REAL da tela
   (faAvaliacaoPosicionamentoNucleo, de avaliacao-posicionamento.js) — quem pode decidir/reavaliar consegue gravar.
   A. Leitura de posicionamento-decisoes: os três perfis leem; quem não está na lista e sem login, não.
   B. Decidir só "Avaliação + Arquitetura" e admin geral; "Avaliação" NÃO decide.
   C. Os três tipos: CONFIRMACAO (justificativa opcional), DIVERGENCIA e RESOLUCAO_A_VALIDAR (justificativa
      obrigatória, nem vazia nem só espaço).
   D. codigoFinal só entre os 8 firmes: LINHA, PLATAFORMA, A_VALIDAR e desconhecido recusados.
   E. Adulterações: tipo, liberaSquad, código/versão/tipo A_VALIDAR automáticos, versão da avaliação, autor,
      campo extra, sem auditoria, auditoria isolada ou divergente.
   F. Imutável e só da vigente: segunda decisão, alteração e exclusão recusadas; rascunho, descartada e
      histórica não recebem decisão.
   G. Reavaliar: só da vigente, versão = anterior + 1, motivo obrigatório (≤ 500, não só espaço), auditoria
      com anterior e motivo; "Avaliação" não reavalia; duas reavaliações simultâneas → uma só entra.
   H. Descarte da reavaliação: o vigente não muda; depois dele a decisão passa (prova extra 2).
   I. Conclusão por compare-and-set: o vigente troca para vN+1 só se ainda é a anterior; não se apaga, não pula
      versão, não troca para qualquer uma; a decisão antiga fica, histórica (prova extra 3); a nova versão
      começa sem decisão e pode ser decidida.
   J. D4 — concorrência (e seção M: na mesma multipath): reavaliação primeiro → decisão recusada (prova extra 1); decisão primeiro →
      reavaliação permitida; "vN vigente + decisão vN + rascunho vN+1" é estado válido.
   K. liberaSquad da decisão = faMotorPosicionamento.liberaSquadParaCodigoFirme, igual ao liberaSquad do motor em
      todo resultado firme (prova extra 4); invertido é recusado, para os 8 códigos.
   L. Registro do PR E (sem decisão, sem anterior) pode ser decidido e reavaliado.
   M. Multipath: decisão junto com a conclusão, o descarte ou o início de uma reavaliação, na MESMA gravação →
      recusada (vigente e sem reavaliação ANTES e DEPOIS); decisão isolada → aceita.
   N. H0: a reavaliação também passa pelo gate P1–P16 (base com Motor atual; equivalente não libera).
   O. Invariante Linha × Squad, com o esperado LITERAL (não lido do motor): AREA_ESPECIALIZADA e COE → liberaSquad
      false; os 6 firmes do ramo Linha → true, na decisão e na conclusão; o contrário é recusado.
   (E também: a auditoria "decisao" leva justificativa e liberaSquad, conferidos contra a decisão.)
   ═════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const T = require('./regras-posicionamento-tabela.js');
const M = require(path.join(__dirname, '..', '..', 'forca-agil', 'motor-posicionamento.js'));
/* H0: a base P1–P16 precisa estar com Motor atual */
const MOTOR_OK = { motorVersion: require('./montar-regras-posicionamento.js').MOTOR_PRODUTO, motorVersionArquitetura: 1 };

/* O núcleo da tela (sem DOM), com o critério de reavaliação de Produto/Serviço (avaliacao-produto.js) carregado. */
function carregarNucleo() {
  const raiz = path.join(__dirname, '..', '..', 'forca-agil');
  const ctx = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, setTimeout, clearTimeout, setInterval, clearInterval, parseFloat, parseInt, isNaN };
  ctx.window = ctx;
  const el = () => ({ addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, style: {}, classList: { add() {}, remove() {}, contains() { return false; } } });
  ctx.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: el(), documentElement: el() };
  ctx.firebase = { database: () => ({ ref: () => ({ on() {}, off() {}, once() { return Promise.resolve({ val: () => null }); }, update() {}, child() { return this; }, push() { return { key: 'k' }; } }) }) };
  ctx.navigator = {}; ctx.location = { hash: '' }; ctx.localStorage = { getItem() { return null; }, setItem() {} };
  vm.createContext(ctx);
  for (const f of ['questionarios-config.js', 'motor-arquitetura.js', 'avaliacao-produto.js', 'motor-posicionamento.js', 'motor-posicionamento-nucleo.js']) vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8'), ctx, { filename: f });
  /* a tela de posicionamento roda sem DOM: o núcleo para em `typeof document === 'undefined'` */
  delete ctx.document;
  vm.runInContext(fs.readFileSync(path.join(raiz, 'avaliacao-posicionamento.js'), 'utf8'), ctx, { filename: 'avaliacao-posicionamento.js' });
  ctx.faPosicionamentos = { nome: (c) => 'Nome de ' + c, usandoContingencia: () => false };
  if (!ctx.faCriterioReavaliacao) throw new Error('faCriterioReavaliacao não carregou');
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
const DEC = 'posicionamento-decisoes';
const QUANDO = '2026-10-10T12:00:00.000Z';
const js = (v) => JSON.parse(JSON.stringify(v));
const pessoa = (email) => ({ name: 'Pessoa ' + email.split('@')[0], email });

/* estados concluíveis por resultado */
const EST = T.estadosConcluiveis().map((x) => ({ est: x.est, res: M.avaliar(x.est.respostas, x.est.diagnosticos) }));
const porCodigo = (cod) => EST.filter((x) => x.res.codigoResultado === cod)[0].est;
const EST_AE = porCodigo('AREA_ESPECIALIZADA');          /* firme, liberaSquad false */
const EST_NEG = porCodigo('NEGOCIOS');                   /* firme, liberaSquad true */
const EST_AV = EST.filter((x) => x.res.codigoResultado === 'A_VALIDAR' && x.res.tipoAValidar === 'CONFLITO')[0].est;

async function main() {
  const N = carregarNucleo();
  const rules = fs.readFileSync(process.env.RULES_PATH || path.join(__dirname, '..', '..', 'database.rules.json'), 'utf8');
  const testEnv = await initializeTestEnvironment({ projectId: 'demo-kyber-agil-rules-posicionamento-decisao', database: { rules } });
  const db = (email) => (email ? testEnv.authenticatedContext(emailKey(email), { email }) : testEnv.unauthenticatedContext()).database();
  const semear = (fn) => testEnv.withSecurityRulesDisabled((c) => fn(c.database()));
  const ler = async (p) => { let v; await semear(async (a) => { v = (await a.ref(p).once('value')).val(); }); return v; };
  async function pode(rotulo, prom) { try { await assertSucceeds(prom); anota(rotulo, true); } catch (e) { anota(rotulo, false, 'foi NEGADO: ' + String(e.message || e).slice(0, 160)); } }
  async function nega(rotulo, prom) { try { await assertFails(prom); anota(rotulo, true); } catch (e) { anota(rotulo, false, 'foi PERMITIDO (deveria negar)'); } }
  const up = (email, p) => db(email).ref().update(js(p));
  /* adultera a decisão E a auditoria dela do mesmo jeito: a auditoria confere justificativa e liberaSquad contra a
     decisão, e sem isso cada regra da decisão não seria provada sozinha (a divergência já recusaria) */
  const nosDois = (x, id, fn) => { const d = x[DEC + '/' + id], a = x[AUD + '/' + id + '/' + d.auditoriaId]; fn(d); if (a) fn(a); return x; };

  async function base(nItens) {
    await testEnv.clearDatabase();
    await semear(async (a) => {
      const u = {};
      u['fa-admins/' + emailKey(ADMIN)] = { email: ADMIN };
      u['fa-avaliacao-autorizados/' + emailKey(AVAL)] = { email: AVAL, tipo: 'avaliacao' };
      u['fa-avaliacao-autorizados/' + emailKey(ARQ)] = { email: ARQ, tipo: 'avaliacao-arquitetura' };
      for (let i = 1; i <= (nItens || 12); i++) u['avaliacoes-produto/p' + i] = { itemId: 'p' + i, nome: 'Item p' + i, status: 'concluido', resultadoAutomatico: 'produto', decisaoFinal: 'produto', ...MOTOR_OK };
      await a.ref().update(u);
    });
  }
  let seq = 0;
  const chave = (pre) => (pre + (++seq)).replace(/[^A-Za-z0-9_-]/g, '');
  /* cria, preenche e conclui a primeira versão do item, pelo núcleo da tela; devolve o id */
  async function vigenteV1(item, est, email) {
    email = email || ARQ;
    const id = chave('v1-' + item + '-'), quem = pessoa(email);
    const pc = N.payloadCriacao({ id, audId: chave('kc'), itemId: item, itemNome: 'Item ' + item, avaliacaoArquiteturalId: item, versao: 1, usuario: quem, agora: QUANDO });
    await assertSucceeds(up(email, pc));
    const reg = js(pc[AV + '/' + id]);
    reg.respostas = {};
    Object.keys(est.respostas).forEach((q) => { reg.respostas[q] = js(N.snapshotResposta(q, est.respostas[q], 1, null, QUANDO)); });
    Object.keys(est.diagnosticos).forEach((n) => { reg.diagnosticos = reg.diagnosticos || {}; reg.diagnosticos[n] = js(N.snapshotDiagnostico(est.diagnosticos[n], N.papeisDoPar(reg, n), 1, null, QUANDO)); });
    await assertSucceeds(up(email, N.payloadSalvar(id, reg, quem, QUANDO, 1)));
    await assertSucceeds(up(email, N.payloadConclusao(id, reg, quem, QUANDO, 2, chave('kz')).payload));
    return id;
  }
  async function reg(id) { return js(await ler(AV + '/' + id)); }
  async function decisao(id, codigoFinal, justificativa, email) {
    email = email || ARQ;
    return N.payloadDecisao({ id, reg: await reg(id), codigoFinal, justificativa, usuario: pessoa(email), agora: QUANDO, audId: chave('kdec') });
  }
  /* reavaliação montada pelo núcleo; a auditoria de criação é 'kre' + id */
  async function iniciarReavaliacao(anteriorId, motivo, email) {
    email = email || ARQ;
    const ant = await reg(anteriorId), id = chave('re');
    return { id, p: js(N.payloadReavaliacao({ id, audId: 'kre' + id, anteriorId, anterior: ant, itemNome: ant.itemNome, avaliacaoArquiteturalId: ant.avaliacaoArquiteturalId,
      versao: 1, motivo, usuario: pessoa(email), agora: QUANDO })) };
  }
  async function concluirReavaliacao(id, email) {
    email = email || ARQ;
    const r = await reg(id);
    return N.payloadConclusao(id, r, pessoa(email), QUANDO, r.revisao, chave('kzr')).payload;
  }

  console.log('\n== A. Leitura das decisões ==');
  await base();
  const a1 = await vigenteV1('p1', EST_AE);
  await assertSucceeds(up(ARQ, await decisao(a1, 'AREA_ESPECIALIZADA')));
  for (const [quem, email] of [['"Avaliação"', AVAL], ['"Avaliação + Arquitetura"', ARQ], ['admin geral', ADMIN]]) {
    await pode(quem + ' lê as decisões', db(email).ref(DEC).once('value'));
  }
  await nega('quem não está na lista NÃO lê as decisões', db(SEM).ref(DEC).once('value'));
  await nega('sem login NÃO lê as decisões', db(null).ref(DEC).once('value'));

  console.log('\n== B. Quem decide ==');
  await base();
  const b1 = await vigenteV1('p1', EST_AE), b2 = await vigenteV1('p2', EST_AE), b3 = await vigenteV1('p3', EST_AE);
  await nega('"Avaliação" NÃO decide (gravação completa e válida)', up(AVAL, await decisao(b1, 'AREA_ESPECIALIZADA', null, AVAL)));
  await nega('quem não está na lista NÃO decide', up(SEM, await decisao(b1, 'AREA_ESPECIALIZADA', null, SEM)));
  await pode('"Avaliação + Arquitetura" decide', up(ARQ, await decisao(b1, 'AREA_ESPECIALIZADA')));
  await pode('admin geral (fa-admins) decide', up(ADMIN, await decisao(b2, 'AREA_ESPECIALIZADA', null, ADMIN)));
  await pode('admin geral (e-mail fixo) decide', up(SUPER, await decisao(b3, 'AREA_ESPECIALIZADA', null, SUPER)));
  const gb = await ler(DEC + '/' + b1);
  anota('…campos: CONFIRMACAO, nomeNaDecisao, decididoPor, versaoAvaliacao 1, versaoMotor 1, codigoAutomatico',
    gb && gb.tipoDecisao === 'CONFIRMACAO' && gb.nomeNaDecisao.nome === 'Nome de AREA_ESPECIALIZADA' && gb.nomeNaDecisao.contingencia === false &&
    gb.decididoPor.email === ARQ && gb.versaoAvaliacao === 1 && gb.versaoMotor === 1 && gb.codigoAutomatico === 'AREA_ESPECIALIZADA' && gb.itemId === 'p1', JSON.stringify(gb));
  anota('…e a auditoria "decisao" da mesma gravação', (await ler(AUD + '/' + b1 + '/' + gb.auditoriaId + '/tipo')) === 'decisao');
  anota('o resultado automático não muda com a decisão', (await ler(AV + '/' + b1 + '/resultadoAutomatico/codigoResultado')) === 'AREA_ESPECIALIZADA' && (await ler(AV + '/' + b1 + '/status')) === 'concluido');

  console.log('\n== C. Os três tipos de decisão ==');
  await base();
  const c1 = await vigenteV1('p1', EST_AE), c2 = await vigenteV1('p2', EST_AE), c3 = await vigenteV1('p3', EST_AV), c4 = await vigenteV1('p4', EST_AE);
  await pode('CONFIRMACAO sem justificativa', up(ARQ, await decisao(c1, 'AREA_ESPECIALIZADA')));
  await pode('CONFIRMACAO com justificativa', up(ARQ, await decisao(c4, 'AREA_ESPECIALIZADA', 'Confirmo pela leitura do caso.')));
  anota('DIVERGENCIA sem justificativa: o núcleo recusa montar', (() => { try { N.payloadDecisao({ id: c2, reg: { itemId: 'p2', versao: 1, resultadoAutomatico: { codigoResultado: 'AREA_ESPECIALIZADA', versaoMotor: 1 } }, codigoFinal: 'COE', usuario: pessoa(ARQ), agora: QUANDO, audId: 'k' }); return false; } catch (e) { return /justificativa/.test(e.message); } })());
  const div = await decisao(c2, 'COE', 'Justificativa');
  const semJust = nosDois(js(div), c2, (o) => { delete o.justificativa; });
  await nega('DIVERGENCIA sem justificativa (gravação montada à mão)', up(ARQ, semJust));
  for (const [rot, t] of [['vazia', ''], ['só espaço', '   '], ['só tabulação/quebra', '\t\n\r ']]) {
    const x = nosDois(js(div), c2, (o) => { o.justificativa = t; });
    await nega('DIVERGENCIA com justificativa ' + rot, up(ARQ, x));
  }
  const longa = nosDois(js(div), c2, (o) => { o.justificativa = 'x'.repeat(2001); });
  await nega('justificativa com mais de 2000 caracteres', up(ARQ, longa));
  await pode('DIVERGENCIA com justificativa', up(ARQ, div));
  anota('…tipo DIVERGENCIA, código final COE', (await ler(DEC + '/' + c2 + '/tipoDecisao')) === 'DIVERGENCIA' && (await ler(DEC + '/' + c2 + '/codigoFinal')) === 'COE');
  const rav = await decisao(c3, 'COE', 'Resolvido em reunião');
  const ravSem = nosDois(js(rav), c3, (o) => { delete o.justificativa; });
  await nega('RESOLUCAO_A_VALIDAR sem justificativa', up(ARQ, ravSem));
  await pode('RESOLUCAO_A_VALIDAR com justificativa', up(ARQ, rav));
  const gc3 = await ler(DEC + '/' + c3);
  anota('…registra o A_VALIDAR automático e o tipo (CONFLITO)', gc3.tipoDecisao === 'RESOLUCAO_A_VALIDAR' && gc3.codigoAutomatico === 'A_VALIDAR' && gc3.tipoAValidarAutomatico === 'CONFLITO');

  console.log('\n== D. Código final só entre os 8 firmes ==');
  await base();
  const d1 = await vigenteV1('p1', EST_AE);
  const boa = await decisao(d1, 'COE', 'Justificativa');
  for (const cod of ['LINHA', 'PLATAFORMA', 'A_VALIDAR', 'SQUAD', '']) {
    const x = js(boa); x[DEC + '/' + d1].codigoFinal = cod; x[AUD + '/' + d1 + '/' + boa[DEC + '/' + d1].auditoriaId].codigoFinal = cod;
    await nega('codigoFinal ' + (cod || '(vazio)') + ' recusado', up(ARQ, x));
  }
  anota('o núcleo também recusa montar LINHA, PLATAFORMA e A_VALIDAR', ['LINHA', 'PLATAFORMA', 'A_VALIDAR'].every((cod) => { try { N.payloadDecisao({ id: d1, reg: { itemId: 'p1', versao: 1, resultadoAutomatico: { codigoResultado: 'AREA_ESPECIALIZADA', versaoMotor: 1 } }, codigoFinal: cod, justificativa: 'j', usuario: pessoa(ARQ), agora: QUANDO, audId: 'k' }); return false; } catch (e) { return true; } }));

  console.log('\n== E. Adulterações ==');
  await base();
  const e1 = await vigenteV1('p1', EST_AE), e2 = await vigenteV1('p2', EST_AV);
  const okE = await decisao(e1, 'NEGOCIOS', 'Justificativa');
  const audE = AUD + '/' + e1 + '/' + okE[DEC + '/' + e1].auditoriaId;
  const mexe = (fn) => { const x = js(okE); fn(x[DEC + '/' + e1], x); return x; };
  await nega('tipo CONFIRMACAO com código diferente', up(ARQ, mexe((d, x) => { d.tipoDecisao = 'CONFIRMACAO'; x[audE].tipoDecisao = 'CONFIRMACAO'; })));
  await nega('tipo DIVERGENCIA com o MESMO código do automático', up(ARQ, (() => { const x = js(okE); const d = x[DEC + '/' + e1]; d.codigoFinal = 'AREA_ESPECIALIZADA'; d.tipoDecisao = 'DIVERGENCIA'; d.liberaSquad = false;
    d.nomeNaDecisao = { nome: 'Nome de AREA_ESPECIALIZADA', contingencia: false }; x[audE].codigoFinal = 'AREA_ESPECIALIZADA'; x[audE].tipoDecisao = 'DIVERGENCIA'; x[audE].liberaSquad = false; return x; })()));
  await nega('tipo RESOLUCAO_A_VALIDAR com automático firme', up(ARQ, mexe((d, x) => { d.tipoDecisao = 'RESOLUCAO_A_VALIDAR'; x[audE].tipoDecisao = 'RESOLUCAO_A_VALIDAR'; })));
  await nega('liberaSquad invertido', up(ARQ, mexe((d, x) => { d.liberaSquad = !d.liberaSquad; x[audE].liberaSquad = d.liberaSquad; })));
  await nega('codigoAutomatico adulterado', up(ARQ, mexe((d, x) => { d.codigoAutomatico = 'COE'; x[audE].codigoAutomatico = 'COE'; })));
  await nega('versaoMotor adulterada', up(ARQ, mexe((d) => { d.versaoMotor = 2; })));
  await nega('versaoAvaliacao adulterada', up(ARQ, mexe((d, x) => { d.versaoAvaliacao = 2; x[audE].versaoAvaliacao = 2; })));
  await nega('tipoAValidarAutomatico inventado num resultado firme', up(ARQ, mexe((d) => { d.tipoAValidarAutomatico = 'CONFLITO'; })));
  await nega('decisão em nome de outra pessoa', up(ARQ, mexe((d) => { d.decididoPor = pessoa(SUPER); })));
  await nega('itemId de outro item', up(ARQ, mexe((d) => { d.itemId = 'p2'; })));
  await nega('campo extra', up(ARQ, mexe((d) => { d.estruturaConcreta = 'Diretoria X'; })));
  await nega('sem nomeNaDecisao', up(ARQ, mexe((d) => { delete d.nomeNaDecisao; })));
  await nega('sem a auditoria "decisao"', up(ARQ, (() => { const x = js(okE); delete x[audE]; return x; })()));
  await nega('auditoria com outro código final', up(ARQ, (() => { const x = js(okE); x[audE].codigoFinal = 'COE'; return x; })()));
  anota('a auditoria montada pela tela leva justificativa e liberaSquad', okE[audE].justificativa === 'Justificativa' && okE[audE].liberaSquad === true, JSON.stringify(okE[audE]));
  await nega('auditoria com outra justificativa', up(ARQ, (() => { const x = js(okE); x[audE].justificativa = 'Outra'; return x; })()));
  await nega('auditoria SEM a justificativa da decisão', up(ARQ, (() => { const x = js(okE); delete x[audE].justificativa; return x; })()));
  await nega('auditoria com liberaSquad invertido', up(ARQ, (() => { const x = js(okE); x[audE].liberaSquad = false; return x; })()));
  await nega('auditoria SEM liberaSquad', up(ARQ, (() => { const x = js(okE); delete x[audE].liberaSquad; return x; })()));
  await nega('auditoria com justificativa numa CONFIRMACAO sem justificativa', up(ARQ, await (async () => {
    const x = js(await decisao(e1, 'AREA_ESPECIALIZADA')), a = Object.keys(x).filter((k) => k.indexOf(AUD + '/') === 0)[0];
    x[a].justificativa = 'inventada'; return x; })()));
  await nega('auditoria "decisao" ISOLADA (sem a decisão)', db(ARQ).ref(audE).set(okE[audE]));
  await nega('decisão ISOLADA (sem a auditoria)', db(ARQ).ref(DEC + '/' + e1).set(okE[DEC + '/' + e1]));
  const okAv = await decisao(e2, 'COE', 'Justificativa');
  const audAv = AUD + '/' + e2 + '/' + okAv[DEC + '/' + e2].auditoriaId;
  await nega('A_VALIDAR: tipo DIVERGENCIA', up(ARQ, (() => { const x = js(okAv); x[DEC + '/' + e2].tipoDecisao = 'DIVERGENCIA'; x[audAv].tipoDecisao = 'DIVERGENCIA'; return x; })()));
  await nega('A_VALIDAR: sem o tipo do A_VALIDAR automático', up(ARQ, (() => { const x = js(okAv); delete x[DEC + '/' + e2].tipoAValidarAutomatico; return x; })()));
  await nega('A_VALIDAR: tipo do A_VALIDAR adulterado', up(ARQ, (() => { const x = js(okAv); x[DEC + '/' + e2].tipoAValidarAutomatico = 'RECORTE'; return x; })()));
  await pode('as duas gravações íntegras passam', Promise.all([up(ARQ, okE), up(ARQ, okAv)]));

  console.log('\n== F. Imutável e só da vigente ==');
  await nega('segunda decisão para a mesma versão', up(ARQ, await decisao(e1, 'COE', 'Outra')));
  await nega('alterar a justificativa', db(ARQ).ref(DEC + '/' + e1 + '/justificativa').set('mudada'));
  await nega('alterar o código final', db(SUPER).ref(DEC + '/' + e1 + '/codigoFinal').set('COE'));
  await nega('apagar a decisão (admin geral)', db(SUPER).ref(DEC + '/' + e1).remove());
  await nega('apagar a auditoria da decisão', db(SUPER).ref(audE).remove());
  await base();
  const pr = N.payloadCriacao({ id: 'fr', audId: 'kfr', itemId: 'p1', itemNome: 'Item p1', avaliacaoArquiteturalId: 'p1', versao: 1, usuario: pessoa(ARQ), agora: QUANDO });
  await assertSucceeds(up(ARQ, pr));
  const falsoConcl = { itemId: 'p1', versao: 1, resultadoAutomatico: { codigoResultado: 'AREA_ESPECIALIZADA', versaoMotor: 1 } };
  await nega('rascunho NÃO recebe decisão', up(ARQ, N.payloadDecisao({ id: 'fr', reg: falsoConcl, codigoFinal: 'AREA_ESPECIALIZADA', usuario: pessoa(ARQ), agora: QUANDO, audId: 'kd1' })));
  await assertSucceeds(up(ARQ, N.payloadDescarte('fr', await reg('fr'), pessoa(ARQ), QUANDO, 1, 'kfd', 'Engano')));
  await nega('descartada NÃO recebe decisão', up(ARQ, N.payloadDecisao({ id: 'fr', reg: falsoConcl, codigoFinal: 'AREA_ESPECIALIZADA', usuario: pessoa(ARQ), agora: QUANDO, audId: 'kd2' })));
  await nega('avaliação inexistente NÃO recebe decisão', up(ARQ, N.payloadDecisao({ id: 'nada', reg: falsoConcl, codigoFinal: 'AREA_ESPECIALIZADA', usuario: pessoa(ARQ), agora: QUANDO, audId: 'kd3' })));

  console.log('\n== G. Reavaliar ==');
  await base();
  const g1 = await vigenteV1('p1', EST_AE), g2 = await vigenteV1('p2', EST_NEG);
  for (const [rot, m] of [['sem motivo', ''], ['motivo só espaço', '  \t\n '], ['motivo com mais de 500', 'x'.repeat(501)]]) {
    const r = await iniciarReavaliacao(g1, 'ok');
    r.p[AV + '/' + r.id].motivoReavaliacao = m; r.p[AUD + '/' + r.id + '/kre' + r.id].motivo = m;
    if (!m) { delete r.p[AV + '/' + r.id].motivoReavaliacao; delete r.p[AUD + '/' + r.id + '/kre' + r.id].motivo; }
    await nega('reavaliação ' + rot, up(ARQ, r.p));
  }
  const rv = await iniciarReavaliacao(g1, 'Mudou a estrutura de clientes');
  const mexeR = (fn) => { const x = js(rv.p); fn(x[AV + '/' + rv.id], x[AUD + '/' + rv.id + '/kre' + rv.id], x); return x; };
  await nega('reavaliação com versão = anterior (1)', up(ARQ, mexeR((r) => { r.versao = 1; })));
  await nega('reavaliação pulando versão (3)', up(ARQ, mexeR((r) => { r.versao = 3; })));
  await nega('reavaliação apontando para avaliação inexistente', up(ARQ, mexeR((r, a) => { r.avaliacaoAnteriorId = 'nada'; a.avaliacaoAnteriorId = 'nada'; })));
  await nega('reavaliação apontando para a vigente de OUTRO item', up(ARQ, mexeR((r, a) => { r.avaliacaoAnteriorId = g2; a.avaliacaoAnteriorId = g2; })));
  await nega('reavaliação sem anterior com o item já vigente (versão 2, sem avaliacaoAnteriorId)', up(ARQ, mexeR((r, a) => { delete r.avaliacaoAnteriorId; delete a.avaliacaoAnteriorId; })));
  await nega('primeira versão com motivo de reavaliação', up(ARQ, (() => { const p = N.payloadCriacao({ id: 'gx', audId: 'kgx', itemId: 'p3', itemNome: 'Item p3', avaliacaoArquiteturalId: 'p3', versao: 1, usuario: pessoa(ARQ), agora: QUANDO }); p[AV + '/gx'].motivoReavaliacao = 'm'; p[AUD + '/gx/kgx'].motivo = 'm'; return p; })()));
  await nega('auditoria "criacao" sem o anterior', up(ARQ, mexeR((r, a) => { delete a.avaliacaoAnteriorId; })));
  await nega('auditoria "criacao" com outro motivo', up(ARQ, mexeR((r, a) => { a.motivo = 'outro'; })));
  await nega('"Avaliação" NÃO reavalia', up(AVAL, (await iniciarReavaliacao(g1, 'Motivo', AVAL)).p));
  /* duas reavaliações SIMULTÂNEAS da mesma vigente */
  const s1 = await iniciarReavaliacao(g2, 'Motivo A'), s2 = await iniciarReavaliacao(g2, 'Motivo B', ADMIN);
  const rs = await Promise.allSettled([up(ARQ, s1.p), up(ADMIN, s2.p)]);
  const entrou = rs.filter((r) => r.status === 'fulfilled').length, reserva = await ler(RES + '/p2');
  anota('duas reavaliações simultâneas: exatamente uma entra (' + entrou + ')', entrou === 1);
  anota('…a reserva aponta para a que entrou e a outra não deixou rastro', (reserva === s1.id || reserva === s2.id) && (await ler(AV + '/' + (reserva === s1.id ? s2.id : s1.id))) === null);
  await pode('reavaliação íntegra da vigente (versão 2, anterior, motivo)', up(ARQ, rv.p));
  const g1v2 = await ler(AV + '/' + rv.id);
  anota('…versão 2, anterior = v1, motivo gravado, auditoria com anterior e motivo', g1v2.versao === 2 && g1v2.avaliacaoAnteriorId === g1 && g1v2.motivoReavaliacao === 'Mudou a estrutura de clientes' &&
    (await ler(AUD + '/' + rv.id + '/kre' + rv.id + '/avaliacaoAnteriorId')) === g1 && (await ler(AUD + '/' + rv.id + '/kre' + rv.id + '/motivo')) === 'Mudou a estrutura de clientes');
  anota('…a anterior continua vigente enquanto o rascunho existe', (await ler(VIG + '/p1')) === g1);
  anota('…respostas da anterior pré-preenchidas (mesma versão do questionário)', JSON.stringify(Object.keys(g1v2.respostas || {}).sort()) === JSON.stringify(Object.keys(EST_AE.respostas).sort()));
  await nega('alterar o motivo da reavaliação no rascunho', (async () => { const r = js(g1v2); r.motivoReavaliacao = 'outro'; r.revisao = 2; r.atualizadoPor = pessoa(ARQ); return db(ARQ).ref(AV + '/' + rv.id).set(r); })());
  await nega('alterar a anterior no rascunho', (async () => { const r = js(g1v2); r.avaliacaoAnteriorId = g2; r.revisao = 2; r.atualizadoPor = pessoa(ARQ); return db(ARQ).ref(AV + '/' + rv.id).set(r); })());

  console.log('\n== H. Descarte da reavaliação ==');
  await assertSucceeds(up(ARQ, N.payloadDescarte(rv.id, await reg(rv.id), pessoa(ARQ), QUANDO, 1, 'khd', 'Não era necessário')));
  anota('descartar a reavaliação não muda o vigente', (await ler(VIG + '/p1')) === g1 && (await ler(AV + '/' + g1 + '/status')) === 'concluido');
  await pode('PROVA EXTRA 2: depois do descarte, a decisão da vigente passa', up(ARQ, await decisao(g1, 'AREA_ESPECIALIZADA')));
  const rv2 = await iniciarReavaliacao(g1, 'Segunda tentativa');
  await pode('nova reavaliação depois do descarte (versão 2 de novo)', up(ARQ, rv2.p));

  console.log('\n== I. Conclusão por compare-and-set ==');
  const conclV2 = await concluirReavaliacao(rv2.id);
  await nega('concluir mantendo o vigente na anterior', up(ARQ, (() => { const x = js(conclV2); delete x[VIG + '/p1']; return x; })()));
  await nega('concluir com auditoria sem vigenteAnterior', up(ARQ, (() => { const x = js(conclV2); Object.keys(x).filter((k) => k.indexOf(AUD + '/') === 0).forEach((k) => { delete x[k].vigenteAnterior; }); return x; })()));
  await nega('apagar o vigente', db(SUPER).ref(VIG + '/p1').remove());
  await nega('trocar o vigente para qualquer uma (a v1 de outro item)', db(SUPER).ref(VIG + '/p1').set(g2));
  await nega('trocar o vigente sozinho para a reavaliação em rascunho', db(SUPER).ref(VIG + '/p1').set(rv2.id));
  /* CAS: o vigente foi trocado por fora (semente) — a conclusão que esperava a anterior é recusada */
  await semear((a) => a.ref(VIG + '/p1').set('outra-coisa'));
  await nega('vigente não é mais a anterior: a conclusão é recusada (compare-and-set)', up(ARQ, conclV2));
  await semear((a) => a.ref(VIG + '/p1').set(g1));
  await pode('conclusão íntegra: vigente troca de v1 para v2', up(ARQ, conclV2));
  anota('…vigente = v2, reserva liberada, auditoria com vigenteAnterior = v1', (await ler(VIG + '/p1')) === rv2.id && (await ler(RES + '/p1')) === null &&
    Object.values((await ler(AUD + '/' + rv2.id)) || {}).some((a) => a.tipo === 'conclusao' && a.vigenteAnterior === g1));
  anota('PROVA EXTRA 3: a decisão da v1 continua lá, intacta (histórica)', (await ler(DEC + '/' + g1 + '/codigoFinal')) === 'AREA_ESPECIALIZADA' && (await ler(AV + '/' + g1 + '/status')) === 'concluido');
  anota('…a v2 começa sem decisão registrada', (await ler(DEC + '/' + rv2.id)) === null);
  /* histórica SEM decisão: só a regra "a vigente" a protege (a v1 de g1 já tinha decisão) */
  const i2 = await vigenteV1('p3', EST_AE), ri2 = await iniciarReavaliacao(i2, 'Reavaliação sem decidir a v1');
  await assertSucceeds(up(ARQ, ri2.p));
  await assertSucceeds(up(ARQ, await concluirReavaliacao(ri2.id)));
  await nega('versão histórica SEM decisão NÃO recebe decisão', up(ARQ, await decisao(i2, 'AREA_ESPECIALIZADA')));
  await nega('versão histórica com decisão NÃO recebe outra', up(ARQ, await decisao(g1, 'COE', 'Tarde demais')));
  await pode('a v2 vigente pode ser decidida', up(ARQ, await decisao(rv2.id, 'AREA_ESPECIALIZADA')));
  const rv3 = await iniciarReavaliacao(rv2.id, 'Terceira versão');
  const pulo = js(rv3.p); pulo[AV + '/' + rv3.id].avaliacaoAnteriorId = g1; pulo[AV + '/' + rv3.id].versao = 2; pulo[AUD + '/' + rv3.id + '/kre' + rv3.id].avaliacaoAnteriorId = g1;
  await nega('reavaliar a partir da histórica (v1), não da vigente', up(ARQ, pulo));
  await pode('reavaliar a v2 vigente (versão 3)', up(ARQ, rv3.p));
  anota('…versão 3', (await ler(AV + '/' + rv3.id + '/versao')) === 3);

  console.log('\n== J. D4 — decisão × reavaliação em andamento ==');
  await base();
  const j1 = await vigenteV1('p1', EST_AE), j2 = await vigenteV1('p2', EST_AE);
  /* ordem 1: reavaliação primeiro → decisão recusada */
  const decJ1 = await decisao(j1, 'AREA_ESPECIALIZADA');
  await assertSucceeds(up(ARQ, (await iniciarReavaliacao(j1, 'Revisão')).p));
  await nega('PROVA EXTRA 1: reavaliação em andamento → decisão da vigente recusada', up(ARQ, decJ1));
  anota('…nada da decisão ficou gravado', (await ler(DEC + '/' + j1)) === null);
  /* ordem 2: decisão primeiro → reavaliação permitida */
  await pode('decisão primeiro', up(ARQ, await decisao(j2, 'AREA_ESPECIALIZADA')));
  const rj2 = await iniciarReavaliacao(j2, 'Revisão depois da decisão');
  await pode('…depois, iniciar a reavaliação é PERMITIDO (reavaliar não exige ausência de decisão)', up(ARQ, rj2.p));
  anota('…estado válido: v1 vigente + decisão da v1 + rascunho v2', (await ler(VIG + '/p2')) === j2 && !!(await ler(DEC + '/' + j2)) && (await ler(RES + '/p2')) === rj2.id);
  /* as duas ao mesmo tempo: nunca termina com decisão gravada depois de reavaliação aberta sem que a decisão tenha vindo antes — o banco decide a ordem */
  const j3 = await vigenteV1('p3', EST_AE);
  const [rDec, rRe] = await Promise.allSettled([up(ARQ, await decisao(j3, 'AREA_ESPECIALIZADA')), up(ADMIN, (await iniciarReavaliacao(j3, 'Simultânea', ADMIN)).p)]);
  anota('decisão e reavaliação simultâneas: a reavaliação sempre entra; a decisão entra só se veio antes (' + rDec.status + '/' + rRe.status + ')', rRe.status === 'fulfilled');

  console.log('\n== K. liberaSquad da decisão = regra do motor ==');
  await base(M.CODIGOS_FIRMES.length + 2);
  let iguais = 0, firmes = 0;
  EST.forEach((x) => { if (M.CODIGOS_FIRMES.indexOf(x.res.codigoResultado) !== -1) { firmes++; if (M.liberaSquadParaCodigoFirme(x.res.codigoResultado) === x.res.liberaSquad) iguais++; } });
  anota('PROVA EXTRA 4: nos ' + firmes + ' resultados firmes concluíveis, liberaSquadParaCodigoFirme = liberaSquad do motor (' + iguais + ')', firmes > 0 && iguais === firmes);
  for (let i = 0; i < M.CODIGOS_FIRMES.length; i++) {
    const cod = M.CODIGOS_FIRMES[i], id = await vigenteV1('p' + (i + 1), EST_AE);
    const p = await decisao(id, cod, 'Justificativa ' + cod);
    const inv = nosDois(js(p), id, (o) => { o.liberaSquad = !o.liberaSquad; });
    await nega(cod + ': liberaSquad invertido recusado', up(ARQ, inv));
    await pode(cod + ': liberaSquad = ' + p[DEC + '/' + id].liberaSquad + ' (do motor) aceito', up(ARQ, p));
  }

  console.log('\n== L. Registro do PR E: sem decisão e sem anterior ==');
  await base();
  const l1 = await vigenteV1('p1', EST_NEG);
  anota('registro do PR E: sem avaliacaoAnteriorId, sem decisão', !(await ler(AV + '/' + l1 + '/avaliacaoAnteriorId')) && (await ler(DEC + '/' + l1)) === null);
  await pode('vigente sem decisão pode ser reavaliada (D8)', up(ARQ, (await iniciarReavaliacao(l1, 'Primeira reavaliação')).p));

  console.log('\n== M. Multipath: decisão junto com uma reavaliação na mesma gravação ==');
  await base();
  const m1 = await vigenteV1('p1', EST_AE), m2 = await vigenteV1('p2', EST_AE), m3 = await vigenteV1('p3', EST_AE), m4 = await vigenteV1('p4', EST_AE);
  const rm1 = await iniciarReavaliacao(m1, 'Reavaliação A'); await assertSucceeds(up(ARQ, rm1.p));
  const rm2 = await iniciarReavaliacao(m2, 'Reavaliação B'); await assertSucceeds(up(ARQ, rm2.p));
  const decM1 = await decisao(m1, 'AREA_ESPECIALIZADA'), concM1 = await concluirReavaliacao(rm1.id);
  await nega('decisão da v1 + conclusão da reavaliação (troca do vigente) na mesma multipath → recusada', up(ARQ, Object.assign({}, concM1, decM1)));
  anota('…nada entrou: v1 vigente, reavaliação em rascunho, sem decisão', (await ler(VIG + '/p1')) === m1 && (await ler(AV + '/' + rm1.id + '/status')) === 'rascunho' && (await ler(DEC + '/' + m1)) === null);
  await pode('…a conclusão sozinha passa', up(ARQ, concM1));
  await nega('…e a v1, agora histórica, não recebe a decisão', up(ARQ, decM1));
  const decM2 = await decisao(m2, 'AREA_ESPECIALIZADA');
  const descM2 = N.payloadDescarte(rm2.id, await reg(rm2.id), pessoa(ARQ), QUANDO, 1, 'kdm2', 'Descartar junto');
  await nega('decisão + descarte da reavaliação na mesma multipath → recusada', up(ARQ, Object.assign({}, descM2, decM2)));
  anota('…nada entrou: reavaliação em rascunho, sem decisão', (await ler(AV + '/' + rm2.id + '/status')) === 'rascunho' && (await ler(DEC + '/' + m2)) === null);
  await assertSucceeds(up(ARQ, descM2));
  await pode('…descartada antes, em gravação própria, a decisão passa', up(ARQ, decM2));
  const decM3 = await decisao(m3, 'AREA_ESPECIALIZADA'), rm3 = await iniciarReavaliacao(m3, 'Reavaliação C');
  await nega('decisão + início de reavaliação na mesma multipath → recusada', up(ARQ, Object.assign({}, rm3.p, decM3)));
  anota('…nada entrou: sem reserva, sem reavaliação, sem decisão', (await ler(RES + '/p3')) === null && (await ler(AV + '/' + rm3.id)) === null && (await ler(DEC + '/' + m3)) === null);
  await pode('decisão isolada, sem reavaliação antes nem depois → aceita', up(ARQ, await decisao(m4, 'COE', 'Justificativa isolada')));

  console.log('\n== N. H0 — a reavaliação também passa pelo gate P1–P16 (Motor atual) ==');
  await base();
  const n1 = await vigenteV1('p1', EST_NEG), n2 = await vigenteV1('p2', EST_NEG);
  await semear((a) => a.ref('avaliacoes-produto/p1/motorVersion').set('2000.01.01-1'));
  await nega('reavaliar com a base P1–P16 desatualizada (lógica em código antiga) → recusada', up(ARQ, (await iniciarReavaliacao(n1, 'Reavaliação')).p));
  await semear((a) => a.ref('motor-arquitetura-config/versaoPublicada').set(2));
  await nega('reavaliar com a base na versão 1 das regras e a publicada 2 (equivalente não libera) → recusada', up(ARQ, (await iniciarReavaliacao(n2, 'Reavaliação')).p));
  await semear((a) => a.ref('avaliacoes-produto/p2/motorVersionArquitetura').set(2));
  await pode('reavaliar com a base reconciliada/atualizada (versão 2 = publicada) → aceita', up(ARQ, (await iniciarReavaliacao(n2, 'Reavaliação')).p));

  console.log('\n== O. Invariante Linha × Squad (fixo, literal — não vem do motor) ==');
  /* Linhas são formadas por Squads; Área Especializada e CoE não. O esperado está ESCRITO aqui, não lido do motor:
     se o motor (ou as regras montadas dele) mudarem a regra, este bloco falha. */
  const LINHA_SQUAD = { AREA_ESPECIALIZADA: false, COE: false, ESTRATEGIA_CLIENTES: true, NEGOCIOS: true, PLATAFORMA_CANAIS: true,
    PLATAFORMA_HABILITADORA_NEGOCIOS: true, PLATAFORMA_HABILITADORA_TECNOLOGIA: true, PLATAFORMA_CORPORATIVA: true };
  anota('os 8 códigos firmes são exatamente os da tabela literal', JSON.stringify(M.CODIGOS_FIRMES.slice().sort()) === JSON.stringify(Object.keys(LINHA_SQUAD).sort()));
  const cods = Object.keys(LINHA_SQUAD);
  await base(2 * cods.length + 2);
  for (let i = 0; i < cods.length; i++) {
    const cod = cods[i], esperado = LINHA_SQUAD[cod];
    /* decisão: liberaSquad contrário ao invariante → recusado; o do invariante → aceito */
    const id = await vigenteV1('p' + (i + 1), EST_AE);
    const p = await decisao(id, cod, 'Justificativa ' + cod);
    await nega('decisão ' + cod + ' com liberaSquad = ' + !esperado + ' (contra o invariante) recusada', up(ARQ, nosDois(js(p), id, (o) => { o.liberaSquad = !esperado; })));
    await pode('decisão ' + cod + ' com liberaSquad = ' + esperado + ' aceita', up(ARQ, nosDois(js(p), id, (o) => { o.liberaSquad = esperado; })));
    /* conclusão: resultado firme com liberaSquad contrário ao invariante → recusado */
    const e = EST.filter((x) => x.res.codigoResultado === cod)[0];
    if (!e) { anota('há estado concluível com resultado ' + cod, false); continue; }
    const item = 'p' + (cods.length + i + 1), idc = chave('lq-' + item + '-'), quem = pessoa(ARQ);
    const pc = N.payloadCriacao({ id: idc, audId: chave('kc'), itemId: item, itemNome: 'Item ' + item, avaliacaoArquiteturalId: item, versao: 1, usuario: quem, agora: QUANDO });
    await assertSucceeds(up(ARQ, pc));
    const r = js(pc[AV + '/' + idc]); r.respostas = {};
    Object.keys(e.est.respostas).forEach((q) => { r.respostas[q] = js(N.snapshotResposta(q, e.est.respostas[q], 1, null, QUANDO)); });
    Object.keys(e.est.diagnosticos).forEach((n) => { r.diagnosticos = r.diagnosticos || {}; r.diagnosticos[n] = js(N.snapshotDiagnostico(e.est.diagnosticos[n], N.papeisDoPar(r, n), 1, null, QUANDO)); });
    await assertSucceeds(up(ARQ, N.payloadSalvar(idc, r, quem, QUANDO, 1)));
    const pz = js(N.payloadConclusao(idc, r, quem, QUANDO, 2, chave('kz')).payload);
    const comLibera = (x, val) => { const y = js(x); y[AV + '/' + idc].resultadoAutomatico.liberaSquad = val;
      Object.keys(y).forEach((k) => { if (k.indexOf(AUD + '/' + idc + '/') === 0 && y[k] && y[k].tipo === 'conclusao') y[k].liberaSquad = val; }); return y; };
    await nega('conclusão ' + cod + ' com liberaSquad = ' + !esperado + ' (contra o invariante) recusada', up(ARQ, comLibera(pz, !esperado)));
    await pode('conclusão ' + cod + ' com liberaSquad = ' + esperado + ' aceita', up(ARQ, comLibera(pz, esperado)));
  }

  await testEnv.cleanup();
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
