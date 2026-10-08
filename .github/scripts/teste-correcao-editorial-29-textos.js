/* Correção editorial dos 29 textos aprovados (P1–P16 e S1–S8) — preparação, sem publicar.
 *
 * O código entrega os 29 textos como duas correções editoriais (CORRECOES_EDITORIAIS em
 * questionarios-config.js). Nada é publicado sozinho: uma administradora vê a proposta em
 * ADMIN › Arquitetura › Questionários e versões e decide quando clicar em Aplicar, que cria uma
 * versão NOVA do questionário pelo mesmo publicarConteudo de qualquer edição.
 *
 * O que este teste prova:
 *   1. os 29 textos do código são exatamente os aprovados (dados/textos-aprovados-29.json), e cada
 *      "de" é o texto de fábrica ou o de uma correção anterior;
 *   2. a situação de cada ajuste: campo simples, campo aninhado (textoAjuda.significado), campo
 *      novo, campo retirado, divergente (editado à mão) e substituído por correção posterior;
 *   3. aplicar pela tela cria uma versão nova; a anterior fica byte a byte igual; nenhum campo
 *      divergente é sobrescrito; fora do questionário e da auditoria dele, nada no banco muda;
 *   4. nenhuma regra muda: motores e versões de motor iguais, e as decisões das 65.536
 *      combinações P1–P16 e das 256 S1–S8 são as mesmas antes e depois;
 *   5. uma avaliação nova depois da aplicação vê a P15 nova (pergunta, ajuda e exemplo, sem a
 *      ajuda extra antiga) e é classificada como antes.
 *
 * Banco falso em persistenciaReal (grava/lê como o Firebase de verdade). Hermético: sem rede,
 * sem segredo. Desktop e celular (375 px). */
const { chromium } = require('playwright');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const APROVADOS = JSON.parse(fs.readFileSync(path.join(__dirname, 'dados', 'textos-aprovados-29.json'), 'utf8'));
const EMAIL = 'teste@previ.com.br';
const KEY = EMAIL.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const copia = (o) => JSON.parse(JSON.stringify(o));
let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (cond || detalhe === undefined ? '' : ' — ' + detalhe)); if (!cond) falhas++; }

const ORDEM = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao',
  'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
const lerCampo = (p, campo) => campo.split('.').reduce((v, k) => (v == null || typeof v !== 'object' ? undefined : v[k]), p);
const vazio = (v) => v == null || v === '';

/* ---- questionário: módulo real, com a config injetada (sem navegador) */
function carregarQuestionarios(config) {
  const ctx = { console: { log() {}, warn() {}, error() {} } };
  ctx.window = ctx;
  const ref = function r(p) { return { on(ev, cb) { if (config) { let v = { 'questionarios-config': config }; p.split('/').forEach((k) => { v = v == null ? v : v[k]; }); cb({ val: () => copia(v == null ? null : v) }); } }, once() {}, off() {}, child: (c) => r(p + '/' + c) }; };
  ctx.firebase = { database: () => ({ ref }) };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'questionarios-config.js'), 'utf8'), ctx);
  const Q = ctx.window.faQuestionarios;
  ['CLASSIFICACAO_ARQUITETURAL', 'ADEQUACAO_SQUAD'].forEach((c) => Q.onMudanca(c, () => {}));
  return Q;
}
const Q0 = carregarQuestionarios(null);
const FABRICA = { CLASSIFICACAO_ARQUITETURAL: copia(Q0.PADRAO.CLASSIFICACAO_ARQUITETURAL.perguntas), ADEQUACAO_SQUAD: copia(Q0.PADRAO.ADEQUACAO_SQUAD.perguntas) };
const ajustesDe = (Q, id) => Q.listarCorrecoesEditoriais().filter((c) => c.id === id)[0].ajustes;
const versao = (perguntas, n) => ({ versaoPublicada: n, versoes: { [n]: { perguntas: perguntas, publicadoEm: '2026-10-08T00:00:00.000Z', publicadoPor: 'teste' } } });
const pergunta = (perguntas, cod) => perguntas.find((p) => p.codigoEstavel === cod);

/* Edições "à mão" (divergentes) sobre o texto de fábrica — usadas na unidade e no navegador */
const P15_SIM_A_MAO = 'SIM — Texto editado à mão pela curadoria.';
const P8_EXEMPLO_A_MAO = 'Exemplo editado à mão.';
const P15_QUANDO_NAO_A_MAO = 'Ajuda de NÃO escrita à mão antes da correção.';
const P15_EXTRA_A_MAO = 'Ajuda extra reescrita à mão.';
function comDivergencias() {
  const v = copia(FABRICA.CLASSIFICACAO_ARQUITETURAL);
  pergunta(v, 'P15').justSim = P15_SIM_A_MAO;
  pergunta(v, 'P8').exemplo = P8_EXEMPLO_A_MAO;
  pergunta(v, 'P15').textoAjuda = { quandoNao: P15_QUANDO_NAO_A_MAO };
  pergunta(v, 'P15').ajudaExtra = P15_EXTRA_A_MAO;
  return v;
}
const DIVERGENTES = ['P15.justSim', 'P8.exemplo', 'P15.textoAjuda.quandoNao', 'P15.ajudaExtra'];

function unidade() {
  console.log('== 1. Os 29 textos do código são exatamente os aprovados ==');
  const codigo = Q0.listarCorrecoesEditoriais().filter((c) => /^semantica-/.test(c.id));
  const doCodigo = codigo.map((c) => ({ id: c.id, codigo: c.codigo, ajustes: c.ajustes.map((a) => ({ pergunta: a.pergunta, campo: a.campo, de: a.de, para: a.para })) }));
  const aprovados = APROVADOS.correcoes.map((c) => ({ id: c.id, codigo: c.codigo, ajustes: c.ajustes.map((a) => ({ pergunta: a.pergunta, campo: a.campo, de: a.de, para: a.para })) }));
  afirma(JSON.stringify(doCodigo) === JSON.stringify(aprovados), 'pergunta, campo, "de" e "para" idênticos à lista aprovada, na mesma ordem');
  const total = doCodigo.reduce((n, c) => n + c.ajustes.length, 0);
  afirma(total === 29, '29 ajustes (P1–P16: ' + doCodigo[0].ajustes.length + ', S1–S8: ' + doCodigo[1].ajustes.length + ')', total);
  const anterior = ajustesDe(Q0, 'interpretacoes-p5-p15');
  doCodigo.forEach((c) => c.ajustes.forEach((a) => {
    const fabrica = lerCampo(pergunta(FABRICA[c.codigo], a.pergunta), a.campo);
    const daAnterior = anterior.find((o) => o.pergunta === a.pergunta && o.campo === a.campo);
    const ok = a.de === null ? vazio(fabrica) : (a.de === fabrica || (daAnterior && a.de === daAnterior.para));
    if (!ok) afirma(false, a.pergunta + '.' + a.campo + ': "de" não é o texto de fábrica nem o da correção anterior');
  }));
  afirma(true, 'cada "de" é o texto de fábrica (ou, em P15 justSim/justNao, o da correção "interpretacoes-p5-p15"); "de: null" só onde o campo não existe');

  console.log('== 2. Situação de cada ajuste ==');
  {
    const Q = carregarQuestionarios({});
    const p = Q.situacaoCorrecaoEditorial('semantica-p1-p16');
    const s = Q.situacaoCorrecaoEditorial('semantica-s1-s8');
    afirma(p.pendentes === 16 && p.divergentes === 0 && p.aAlterar === 11 && p.aCriar === 4 && p.aRemover === 1,
      'conteúdo de fábrica, P1–P16: 16 pendentes = 11 a alterar + 4 campos a criar + 1 a retirar', JSON.stringify(p));
    afirma(s.pendentes === 13 && s.divergentes === 0 && s.aAlterar === 13, 'conteúdo de fábrica, S1–S8: 13 pendentes, todos a alterar', JSON.stringify(s));
    const tipo = (sit, chave) => sit.ajustes.find((a) => a.pergunta + '.' + a.campo === chave);
    afirma(tipo(p, 'P1.textoAjuda.significado').tipo === 'alterar', 'campo aninhado (P1 textoAjuda.significado): alterar');
    afirma(['P15.textoAjuda.significado', 'P15.textoAjuda.quandoSim', 'P15.textoAjuda.quandoNao', 'P15.exemplo'].every((k) => tipo(p, k).tipo === 'criar' && tipo(p, k).atual === null),
      'P15 ganha ajuda (significado, SIM, NÃO) e exemplo: campos novos');
    afirma(tipo(p, 'P15.ajudaExtra').tipo === 'remover' && tipo(p, 'P15.ajudaExtra').estado === 'pendente', 'P15 ajuda extra antiga: retirar');
    afirma(tipo(p, 'P15.justSim').estado === 'pendente', 'P15 justSim com o texto de FÁBRICA (correção anterior não aplicada) é texto conhecido: pendente, não divergente');
  }
  {
    /* a correção anterior já aplicada: P15 justSim/justNao estão no texto dela */
    const v = copia(FABRICA.CLASSIFICACAO_ARQUITETURAL);
    ajustesDe(Q0, 'interpretacoes-p5-p15').forEach((a) => { pergunta(v, a.pergunta)[a.campo] = a.para; });
    const Q = carregarQuestionarios({ CLASSIFICACAO_ARQUITETURAL: versao(v, 2) });
    const p = Q.situacaoCorrecaoEditorial('semantica-p1-p16');
    afirma(p.pendentes === 16 && p.divergentes === 0, 'com "interpretacoes-p5-p15" já aplicada: os 16 continuam pendentes');
  }
  {
    const Q = carregarQuestionarios({ CLASSIFICACAO_ARQUITETURAL: versao(comDivergencias(), 2) });
    const p = Q.situacaoCorrecaoEditorial('semantica-p1-p16');
    const div = p.ajustes.filter((a) => a.estado === 'divergente').map((a) => a.pergunta + '.' + a.campo).sort();
    afirma(JSON.stringify(div) === JSON.stringify(DIVERGENTES.slice().sort()), 'editados à mão = divergentes (alterar, campo novo já preenchido e campo a retirar já reescrito)', div.join(','));
    afirma(p.pendentes === 12, 'os outros 12 continuam pendentes', p.pendentes);
    const d = p.ajustes.find((a) => a.pergunta + '.' + a.campo === 'P15.justSim');
    afirma(d.atual === P15_SIM_A_MAO, 'o divergente informa o texto atual, para comparar caso a caso');
  }
  {
    /* tudo aplicado (montado aqui, sem o código): aplicada; e a correção anterior vira "substituída" */
    const v = copia(FABRICA.CLASSIFICACAO_ARQUITETURAL);
    ajustesDe(Q0, 'semantica-p1-p16').forEach((a) => {
      const p = pergunta(v, a.pergunta); const partes = a.campo.split('.');
      if (partes.length === 2) { p[partes[0]] = p[partes[0]] || {}; p[partes[0]][partes[1]] = a.para; } else if (a.para === '') delete p[a.campo]; else p[a.campo] = a.para;
    });
    const Q = carregarQuestionarios({ CLASSIFICACAO_ARQUITETURAL: versao(v, 2) });
    const p = Q.situacaoCorrecaoEditorial('semantica-p1-p16');
    afirma(p.aplicada && p.pendentes === 0 && p.jaAplicados === 16, 'com os 16 em vigor: correção aplicada');
    const ant = Q.situacaoCorrecaoEditorial('interpretacoes-p5-p15');
    const est = ant.ajustes.map((a) => a.pergunta + '.' + a.campo + '=' + a.estado).join(',');
    afirma(est === 'P5.justNao=pendente,P15.justSim=substituida,P15.justNao=substituida', 'na correção anterior, P15 fica "substituída" (não divergente); P5 continua pendente', est);
  }
}

/* ---- navegador */
function bancoInicial(config) {
  const admins = {}; admins[KEY] = { email: EMAIL };
  return { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {},
    'turmas-checkin': {}, 'turmas-espera': {}, 'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {},
    eventos: {}, 'turmas-publico': {}, 'eventos-publico': {}, 'avaliacoes-produto': {}, 'avaliacoes-squad': {},
    'motor-squad-config': {}, 'motor-squad-auditoria': {}, 'motor-arquitetura-auditoria': {},
    'questionarios-config': config || {} };
}
async function abrirApp(browser, db, viewport) {
  const cfg = { db: db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport: viewport || { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#avaliacoes', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
async function abrirQuestionarios(page) {
  await page.evaluate(() => { location.hash = '#admin'; });
  await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelArquitetura"]', { timeout: 8000 });
  await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
  await page.waitForSelector('#avpConfigQuestionariosBtn', { timeout: 8000 });
  await page.click('#avpConfigQuestionariosBtn');
  await page.waitForSelector('#avpCorrecao-semantica-p1-p16', { timeout: 8000 });
}
async function aplicarNaTela(page, id) {
  await page.click('.avp-correcao-aplicar-btn[data-correcao="' + id + '"]');
  await page.waitForSelector('.avp-modal-confirm-btn', { timeout: 5000 });
  const confirmacao = await page.locator('body > .modal-overlay').last().innerText();
  await page.click('.avp-modal-confirm-btn');
  await page.waitForSelector('.avp-modal-ok-btn', { timeout: 8000 });
  const aviso = await page.locator('body > .modal-overlay').last().innerText();
  await page.click('.avp-modal-ok-btn');
  return { confirmacao, aviso };
}
/* Decisões dos motores em TODAS as combinações — um texto por combinação, comparado antes × depois */
const decisoes = (page) => page.evaluate(() => {
  const MA = window.faMotorArquitetura; const MS = window.faMotorSquad;
  const regrasA = MA.regrasDaVersao(MA.versaoAtual()); const regrasS = MS.regrasDaVersao(MS.versaoAtual());
  const a = []; const s = [];
  for (let n = 0; n < 65536; n++) {
    const r = {}; for (let i = 0; i < 16; i++) r['P' + (i + 1)] = (n >> (15 - i)) & 1 ? 'SIM' : 'NAO';
    a.push(MA.identificarCamada(r, regrasA).camada);
  }
  for (let n = 0; n < 256; n++) {
    const r = {}; for (let i = 0; i < 8; i++) r['S' + (i + 1)] = (n >> (7 - i)) & 1 ? 'SIM' : 'NAO';
    const x = MS.identificarAdequacaoSquad(r, regrasS, true);
    s.push(JSON.stringify([x.necessidadeCapacidadeDedicada, x.condicoesParaSquad, x.indicacaoOrganizacional]));
  }
  return { a: a.join(','), s: s.join(','), versaoA: MA.versaoAtual(), versaoS: MS.versaoAtual() };
});
const semQuestionario = (db) => { const c = copia(db); delete c['questionarios-config']; delete c['questionarios-auditoria']; return c; };

async function cenarioFabrica(browser, viewport, rotulo) {
  console.log('== 3. ' + rotulo + ': conteúdo de fábrica → aplicar pela tela ==');
  const { ctx, page, erros } = await abrirApp(browser, bancoInicial(), viewport);
  await abrirQuestionarios(page);
  const card = await page.locator('#avpCorrecao-semantica-p1-p16').innerText();
  afirma(/16 ajustes:.*11 a alterar.*4 campos a criar.*1 campo a retirar/.test(card), 'card mostra o resumo: 11 a alterar, 4 campos a criar, 1 a retirar', card.split('\n').slice(0, 5).join(' | '));
  afirma(card.includes('Novo: ' + APROVADOS.correcoes[0].ajustes.find((a) => a.pergunta === 'P15' && a.campo === 'exemplo').para), 'campo novo aparece como "Novo: …"');
  afirma(/Será retirado: Pergunte: se o produto principal deixasse de existir/.test(card), 'campo retirado aparece como "Será retirado: …"');
  afirma(/Antes: O item existe principalmente para que outro Produto\/Serviço consiga entregar seu resultado\?\s*Depois: O item é principalmente um elemento estrutural que compõe outro Produto\/Serviço\?/.test(card), 'P15: "Antes" e "Depois" da pergunta');
  afirma(/Ajuda — o que significa/.test(card) && !/textoAjuda\./.test(card), 'campos aninhados com rótulo legível (sem "textoAjuda.…")');
  afirma(await page.locator('#avpCorrecao-semantica-s1-s8').count() === 1, 'card dos 13 textos de S1–S8 também presente');
  afirma(await larguraOk(page), 'cabe na tela (sem rolagem lateral)');
  const antes = await banco(page);
  afirma(!antes['questionarios-config'] || !Object.keys(antes['questionarios-config']).length, 'nada publicado antes do clique: o questionário segue o de fábrica', String(JSON.stringify(antes['questionarios-config'])).slice(0, 300));
  const dec0 = await decisoes(page);

  const r1 = await aplicarNaTela(page, 'semantica-p1-p16');
  afirma(/cria a versão 2/.test(r1.confirmacao) && /16 ajustes/.test(r1.confirmacao), 'confirmação: versão 2, 16 ajustes', r1.confirmacao);
  const r2 = await aplicarNaTela(page, 'semantica-s1-s8');
  afirma(/versão 2/.test(r2.aviso), 'S1–S8: versão 2 do questionário da Squad', r2.aviso);
  const depois = await banco(page);
  const qa = depois['questionarios-config'].CLASSIFICACAO_ARQUITETURAL;
  const qs = depois['questionarios-config'].ADEQUACAO_SQUAD;
  afirma(qa.versaoPublicada === 2 && Object.keys(qa.versoes).join() === '2' && qs.versaoPublicada === 2, 'aplicar cria a versão 2 de cada questionário (a 1, de fábrica, não é regravada)');
  for (const c of APROVADOS.correcoes) {
    const v2 = (c.codigo === 'ADEQUACAO_SQUAD' ? qs : qa).versoes[2].perguntas;
    const errados = c.ajustes.filter((a) => (a.para === '' ? lerCampo(pergunta(v2, a.pergunta), a.campo) !== undefined : lerCampo(pergunta(v2, a.pergunta), a.campo) !== a.para));
    afirma(!errados.length, c.id + ': os ' + c.ajustes.length + ' textos aprovados estão na versão 2, literalmente', errados.map((a) => a.pergunta + '.' + a.campo).join(','));
    /* fora dos ajustes, cada pergunta é a de fábrica */
    const v2Limpa = copia(v2); const fab = copia(FABRICA[c.codigo]);
    c.ajustes.forEach((a) => { [v2Limpa, fab].forEach((lista) => { const p = pergunta(lista, a.pergunta); const partes = a.campo.split('.'); if (partes.length === 2) { if (p[partes[0]]) delete p[partes[0]][partes[1]]; if (p[partes[0]] && !Object.keys(p[partes[0]]).length) delete p[partes[0]]; } else delete p[a.campo]; }); });
    afirma(JSON.stringify(v2Limpa) === JSON.stringify(fab), c.id + ': nenhum outro campo mudou (inclusive os outros subcampos de textoAjuda)');
  }
  const p15 = pergunta(qa.versoes[2].perguntas, 'P15');
  afirma(!('ajudaExtra' in p15) && Object.keys(p15.textoAjuda).sort().join() === 'quandoNao,quandoSim,significado' && !!p15.exemplo, 'P15: ajuda extra retirada; ajuda (3 partes) e exemplo criados');
  const aud = Object.values(depois['questionarios-auditoria'].CLASSIFICACAO_ARQUITETURAL || {});
  afirma(aud.some((x) => x.pergunta === 'P15' && x.campo === 'ajudaExtra' && x.valorNovo == null && /^Pergunte:/.test(x.valorAnterior) && x.novaVersao === 2), 'auditoria registra a retirada da ajuda extra (valor novo vazio)');
  afirma(JSON.stringify(semQuestionario(depois)) === JSON.stringify(semQuestionario(antes)), 'fora do questionário e da auditoria dele, nada no banco mudou (motores, avaliações, Squad)');
  const dec1 = await decisoes(page);
  afirma(dec1.versaoA === dec0.versaoA && dec1.versaoS === dec0.versaoS, 'versões dos motores iguais (' + dec0.versaoA + ' / ' + dec0.versaoS + ')');
  afirma(dec1.a === dec0.a, 'P1–P16: as 65.536 combinações dão as mesmas decisões antes e depois');
  afirma(dec1.s === dec0.s, 'S1–S8: as 256 combinações dão as mesmas decisões antes e depois');
  afirma(/✓ Correção editorial aplicada/.test(await page.locator('#avpCorrecao-semantica-p1-p16').innerText()) && await page.locator('.avp-correcao-aplicar-btn[data-correcao="semantica-p1-p16"]').count() === 0,
    'card passa a "✓ Correção editorial aplicada", sem botão');
  const idem = await page.evaluate(() => new Promise((ok) => window.faQuestionarios.aplicarCorrecaoEditorial('semantica-p1-p16', null, (err) => ok(err))));
  afirma(idem === 'nada-a-aplicar', 'aplicar de novo não faz nada (idempotente)', idem);

  console.log('== 4. ' + rotulo + ': avaliação nova depois da aplicação ==');
  await page.evaluate(() => { location.hash = '#avaliacoes'; });
  await page.waitForSelector('#avpNovoBtn', { timeout: 8000 });
  await page.click('#avpNovoBtn');
  await page.fill('#avpfNome', 'Motor de cálculo do benefício');
  await page.click('#avpIniciarBtn');
  await page.waitForSelector('#avpQuestion-componente');
  const texto15 = await page.locator('#avpQuestion-componente .avp-question-text').innerText();
  afirma(texto15 === 'O item é principalmente um elemento estrutural que compõe outro Produto/Serviço?', 'a P15 nova aparece na avaliação', texto15);
  await page.click('.avp-help-btn[data-id="componente"]');
  const ajuda = await page.locator('#avpHelp-componente').innerText();
  afirma(/O que significa:.*Componente é um elemento estrutural/s.test(ajuda) && /Quando marcar SIM:/.test(ajuda) && /Quando marcar NÃO:/.test(ajuda) && /Exemplo: É componente: o motor de cálculo/.test(ajuda),
    'a ajuda da P15 mostra significado, SIM, NÃO e exemplo novos');
  afirma(!/Pergunte: se o produto principal deixasse de existir/.test(ajuda), 'e não mostra mais a ajuda extra antiga');
  afirma(await larguraOk(page), 'a ajuda cabe na tela (sem rolagem lateral)');
  const valores = { necessidade: 'nao', resultado: 'nao', solucao: 'nao', fronteira: 'sim', autonomia: 'nao', componente: 'sim' };
  for (const id of ORDEM) await page.locator('#avpQuestion-' + id + ' .avp-choice-btn--' + (valores[id] || 'nao')).click();
  await page.click('#avpConcluirBtn');
  await page.waitForSelector('.avp-reasoning-list', { timeout: 8000 });
  const db = await banco(page);
  const item = Object.values(db['avaliacoes-produto'])[0];
  afirma(item.questionnaireContentVersion === 2 && item.respostas.componente.questionnaireContentVersion === 2 && item.respostas.componente.textoPerguntaNaEpoca === texto15,
    'a avaliação nova registra a versão 2 e a P15 nova na resposta');
  const esperado = await page.evaluate((v) => {
    const r = {}; v.forEach((x, i) => { r['P' + (i + 1)] = x === 'sim' ? 'SIM' : 'NAO'; });
    return window.faMotorArquitetura.identificarCamada(r, window.faMotorArquitetura.regrasDaVersao(window.faMotorArquitetura.versaoAtual())).camada;
  }, ORDEM.map((id) => valores[id] || 'nao'));
  afirma(item.camadaSugerida && item.camadaSugerida.id === esperado, 'classificação = a do motor para as mesmas respostas (' + esperado + ')', item.camadaSugerida && item.camadaSugerida.id);
  afirma(erros.length === 0, 'sem erro de página', erros.join(' | '));
  await ctx.close();
}

async function cenarioDivergente(browser) {
  console.log('== 5. Versão 2 com campos editados à mão → aplicar não sobrescreve nenhum ==');
  const v2 = comDivergencias();
  const { ctx, page, erros } = await abrirApp(browser, bancoInicial({ CLASSIFICACAO_ARQUITETURAL: versao(v2, 2) }));
  await abrirQuestionarios(page);
  const card = await page.locator('#avpCorrecao-semantica-p1-p16').innerText();
  afirma(/4 divergentes \(não serão alterados\)/.test(card) && /compare abaixo e decida caso a caso/.test(card), 'card avisa: 4 divergentes, não serão alterados, conferir caso a caso');
  const div = await page.locator('#avpCorrecao-semantica-p1-p16 .avp-correcao-ajuste--divergente').allInnerTexts();
  afirma(div.length === 4 && div.every((t) => /Texto atual \(mantido\):/.test(t) && /Proposto:/.test(t)), 'cada divergente mostra o texto atual e o proposto, lado a lado');
  afirma(div.some((t) => t.includes(P15_SIM_A_MAO.replace(/^SIM — /, ''))), 'inclusive o texto editado à mão da P15');
  const antes = await banco(page);
  const r = await aplicarNaTela(page, 'semantica-p1-p16');
  afirma(/cria a versão 3/.test(r.confirmacao) && /12 ajustes/.test(r.confirmacao) && /4 campos divergentes ficam como estão/.test(r.confirmacao), 'confirmação: versão 3, 12 ajustes, 4 divergentes ficam como estão', r.confirmacao);
  afirma(/Mantidos, por já terem sido editados: .*P15\.justSim/.test(r.aviso), 'aviso final lista os mantidos', r.aviso);
  const depois = await banco(page);
  const qa = depois['questionarios-config'].CLASSIFICACAO_ARQUITETURAL;
  afirma(qa.versaoPublicada === 3, 'versão 3 publicada');
  afirma(JSON.stringify(qa.versoes[2]) === JSON.stringify(antes['questionarios-config'].CLASSIFICACAO_ARQUITETURAL.versoes[2]), 'a versão 2 continua byte a byte igual');
  const v3 = qa.versoes[3].perguntas;
  afirma(pergunta(v3, 'P15').justSim === P15_SIM_A_MAO && pergunta(v3, 'P8').exemplo === P8_EXEMPLO_A_MAO &&
    pergunta(v3, 'P15').textoAjuda.quandoNao === P15_QUANDO_NAO_A_MAO && pergunta(v3, 'P15').ajudaExtra === P15_EXTRA_A_MAO, 'nenhum divergente sobrescrito (alterar, criar e retirar)');
  const aj = APROVADOS.correcoes[0].ajustes;
  afirma(pergunta(v3, 'P15').textoAjuda.significado === aj.find((a) => a.pergunta === 'P15' && a.campo === 'textoAjuda.significado').para &&
    pergunta(v3, 'P15').textoAjuda.quandoSim === aj.find((a) => a.pergunta === 'P15' && a.campo === 'textoAjuda.quandoSim').para,
    'campos novos entram no objeto de ajuda que já existia, sem apagar o subcampo editado à mão');
  afirma(pergunta(v3, 'P15').texto === 'O item é principalmente um elemento estrutural que compõe outro Produto/Serviço?' && pergunta(v3, 'P15').justNao === aj.find((a) => a.pergunta === 'P15' && a.campo === 'justNao').para,
    'os não divergentes da mesma pergunta são aplicados');
  const card2 = await page.locator('#avpCorrecao-semantica-p1-p16').innerText();
  afirma(/Correção editorial disponível/.test(card2) && /4 divergentes/.test(card2) && await page.locator('.avp-correcao-aplicar-btn[data-correcao="semantica-p1-p16"][disabled]').count() === 1,
    'depois, sobram só os 4 divergentes, e o botão fica desabilitado ("nada a aplicar")');
  afirma(erros.length === 0, 'sem erro de página', erros.join(' | '));
  await ctx.close();
}

(async () => {
  unidade();
  const browser = await chromium.launch();
  try {
    await cenarioFabrica(browser, { width: 1280, height: 900 }, 'Desktop');
    await cenarioFabrica(browser, { width: 375, height: 812 }, 'Celular (375 px)');
    await cenarioDivergente(browser);
  } catch (e) {
    afirma(false, 'execução', String(e && e.stack || e));
  }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nOK — os 29 textos são os aprovados; aplicar cria versão nova, respeita divergentes e não muda regra.');
  process.exit(falhas ? 1 : 0);
})();
