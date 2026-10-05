/* Correção editorial (R3 da auditoria): Relação arquitetural de Unidade de valor associada.
 *
 * A redação anterior afirmava "resultado próprio, fronteira, jornada e mensuração identificáveis",
 * mas P6 (jornada) e P7 (mensuração) são evidências AUXILIARES — a regra da versão 5 não as exige,
 * e uma Unidade de valor pode ter P6 = NÃO e/ou P7 = NÃO. Texto aprovado:
 *   "Depende estruturalmente de um Produto/Serviço principal, mas constitui uma unidade
 *    reconhecível e gerenciável, com resultado próprio para o cliente."
 * Correção EDITORIAL (precedente de 30/09/2026): nenhuma regra, precedência, camada ou resultado
 * muda; não incrementa a versão do motor nem do questionário; avaliações já concluídas guardam o
 * texto da época; só as novas ou reprocessadas usam o texto novo.
 *
 * PARTE A (sem navegador — código real em vm, as 65.536 combinações, fábrica e versão 5):
 *   - tudo, menos a relação de Unidade de valor, é EXATAMENTE o de antes (impressões digitais
 *     calculadas com o código da main antes da correção, com a relação de Unidade de valor
 *     trocada por um marcador);
 *   - em toda combinação que vira Unidade de valor — inclusive P6 = NÃO e/ou P7 = NÃO — a relação
 *     é exatamente o texto aprovado e não menciona jornada nem mensuração;
 *   - a versão do motor (MOTOR_VERSION) não mudou;
 *   - prova inversa embutida: com o texto antigo, a conferência falha.
 * PARTE B (navegador, banco falso, desktop e 375 px): uma Unidade de valor com P6 = P7 = NÃO,
 *   concluída antes da correção, mostra o texto da época (histórico preservado); reprocessada com
 *   a versão 5, tela e PDF mostram o texto aprovado, sem jornada nem mensuração.
 * Hermético: sem rede, sem segredo. Dados fictícios. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const SRC = {
  qc: fs.readFileSync(path.join(RAIZ, 'questionarios-config.js'), 'utf8'),
  motor: fs.readFileSync(path.join(RAIZ, 'motor-arquitetura.js'), 'utf8'),
  avp: fs.readFileSync(path.join(RAIZ, 'avaliacao-produto.js'), 'utf8')
};
const EMAIL = 'adm@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };
const SHOTS = process.env.FA_SHOTS_DIR || null;

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

const RELACAO_APROVADA = 'Depende estruturalmente de um Produto/Serviço principal, mas constitui uma unidade reconhecível e gerenciável, com resultado próprio para o cliente.';
const RELACAO_ANTIGA = 'Pertence estruturalmente a um Produto/Serviço maior, mas constitui uma Unidade de Valor com resultado próprio, fronteira, jornada e mensuração identificáveis para o cliente.';
const AUXILIARES = /jornada|mensura/i;
/* Versão do motor antes da correção — uma correção editorial não a incrementa. */
const MOTOR_VERSION_ESPERADA = '2026.09.29-2';
/* Impressões digitais das 65.536 combinações (computeResultado + justificativa), calculadas com
   o código da main ANTES da correção (e3d911c), com a relação de Unidade de valor trocada pelo
   marcador RELACAO_UVA. Só podem mudar se algo além dessa relação mudar. */
const DIGITAL_FABRICA = '731750c349f3280d4495e7186219f854b29a2468141684c214300ec231f4a6bb';
const DIGITAL_V5 = '84c8a5fbb2c78b62ec023bc60f57424cf3327a0e9810d5526cc7ad4563b55c55';

const ORDEM = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao',
  'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
const clone = (x) => JSON.parse(JSON.stringify(x));
const respostasDe = (m) => { const r = {}; ORDEM.forEach((id, i) => { r[id] = { valor: (m >> i) & 1 ? 'sim' : 'nao' }; }); return r; };

/* Código REAL num vm; o banco falso só serve motor-arquitetura-config. O gancho __avpTeste é
   acrescentado em memória — não existe no arquivo de produção. */
function carregar(src, config) {
  const ctx = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, setTimeout, clearTimeout, setInterval, clearInterval, parseFloat, parseInt, isNaN };
  ctx.window = ctx; ctx.window.window = ctx;
  const el = () => ({ addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, style: {}, classList: { add() {}, remove() {}, contains() { return false; } } });
  ctx.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: el(), documentElement: el() };
  const ref = (p) => ({
    on(ev, cb) { if (p === 'motor-arquitetura-config' && config !== undefined) cb({ val: () => clone(config) }); },
    once() {}, off() {}, update() {}, set() {}, remove() {}, transaction() {}, child(c) { return ref(p + '/' + c); }, push() { return { key: 'k' }; }
  });
  ctx.firebase = { database: () => ({ ref }) };
  ctx.navigator = {}; ctx.location = { hash: '' }; ctx.localStorage = { getItem() { return null; }, setItem() {} };
  vm.createContext(ctx);
  vm.runInContext(src.qc, ctx, { filename: 'questionarios-config.js' });
  vm.runInContext(src.motor, ctx, { filename: 'motor-arquitetura.js' });
  const fim = src.avp.lastIndexOf('})();');
  vm.runInContext(src.avp.slice(0, fim) + '\nwindow.__avpTeste = { computeResultado: computeResultado, gerarJustificativaAutomatica: gerarJustificativaAutomatica };\n' + src.avp.slice(fim), ctx, { filename: 'avaliacao-produto.js' });
  if (config !== undefined) ctx.window.faMotorArquitetura.onMudanca(function () {});
  return { M: ctx.window.faMotorArquitetura, av: ctx.__avpTeste };
}
/* Versão 5 publicada: a proposta da versão 4 (sobre a 3 esperada) + P8 = SIM em Produto/Serviço
   principal e em Unidade de valor associada. */
function configV5() {
  const { M } = carregar(SRC);
  const v3 = M.regrasVersao3Esperadas();
  const v4 = M.construirPropostaConflitoNaturezas(v3);
  const v5 = clone(v4);
  ['PRODUTO_SERVICO_PRINCIPAL', 'UNIDADE_VALOR_ASSOCIADA'].forEach((c) => v5.find((r) => r.codigo === c).condicoes.all.push({ campo: 'P8', valor: 'SIM' }));
  return { versaoPublicada: 5, versoes: { 3: { regras: v3 }, 4: { regras: v4 }, 5: { regras: v5 } } };
}

/* Varre as 65.536 combinações: impressão digital de todo o resto + conferência da relação de
   Unidade de valor. Devolve os achados (usado também na prova inversa). */
function varrer(src, config) {
  const { M, av } = carregar(src, config);
  const h = crypto.createHash('sha256');
  const uva = []; const problemas = [];
  for (let m = 0; m < 65536; m++) {
    const atual = { respostas: respostasDe(m) };
    const x = av.computeResultado(atual);
    const just = av.gerarJustificativaAutomatica(atual, x);
    if (x.camadaSugerida.id === 'unidade-valor-associada') {
      const r = atual.respostas;
      uva.push({ m, p6: r.jornada.valor, p7: r.medicao.valor });
      if (x.camadaSugerida.relacao !== RELACAO_APROVADA) problemas.push(m + ': relação = ' + x.camadaSugerida.relacao);
      if (AUXILIARES.test(x.camadaSugerida.relacao || '')) problemas.push(m + ': relação menciona jornada/mensuração');
      x.camadaSugerida.relacao = 'RELACAO_UVA';
    }
    h.update(JSON.stringify([m, x, just]) + '\n');
  }
  return { versao: M.versaoAtual(), digital: h.digest('hex'), uva, problemas };
}

function parteA() {
  console.log('== PARTE A — código real, as 65.536 combinações ==');
  const v5 = configV5();
  const MOTOR_VERSION = /var MOTOR_VERSION = '([^']+)'/.exec(SRC.avp)[1];
  afirma(MOTOR_VERSION === MOTOR_VERSION_ESPERADA, 'versão do motor (MOTOR_VERSION) não mudou: ' + MOTOR_VERSION + ' (correção editorial)');

  for (const [nome, cfg, digital] of [['versão 5 publicada', v5, DIGITAL_V5], ['regras de fábrica', undefined, DIGITAL_FABRICA]]) {
    console.log('\n-- ' + nome + ' --');
    const r = varrer(SRC, cfg);
    if (cfg) afirma(r.versao === 5, 'motor lendo a versão 5');
    afirma(r.digital === digital, 'classificação, rótulo, motivos, conflito, relações das OUTRAS camadas e justificativa idênticos aos de antes nas 65.536 combinações');
    afirma(r.uva.length > 0 && r.problemas.length === 0, 'Unidade de valor (' + r.uva.length + ' combinações): relação é exatamente o texto aprovado, sem jornada nem mensuração', r.problemas.slice(0, 2).join(' ; '));
    const p6p7Nao = r.uva.filter((u) => u.p6 === 'nao' && u.p7 === 'nao').length;
    const p6Nao = r.uva.filter((u) => u.p6 === 'nao').length, p7Nao = r.uva.filter((u) => u.p7 === 'nao').length;
    const so6 = r.uva.filter((u) => u.p6 === 'nao' && u.p7 === 'sim').length, so7 = r.uva.filter((u) => u.p6 === 'sim' && u.p7 === 'nao').length;
    afirma(p6p7Nao > 0 && p6Nao > 0 && p7Nao > 0, 'inclui Unidades de valor com P6 = NÃO (' + p6Nao + '), P7 = NÃO (' + p7Nao + ') e as duas NÃO (' + p6p7Nao + ')');
    afirma(so6 > 0 && so7 > 0, 'e os casos misturados: P6 = NÃO com P7 = SIM (' + so6 + ') e P6 = SIM com P7 = NÃO (' + so7 + ') — o texto é o mesmo em todos');
  }
  {
    const { av } = carregar(SRC, v5);
    /* P1, P2, P3, P4, P8 = SIM; P6 = P7 = NÃO; resto NÃO */
    const atual = { respostas: respostasDe((1 << 0) | (1 << 1) | (1 << 2) | (1 << 3) | (1 << 7)) };
    const x = av.computeResultado(atual);
    afirma(x.camadaSugerida.id === 'unidade-valor-associada' && x.camadaSugerida.relacao === RELACAO_APROVADA, 'exemplo P1–P4 e P8 = SIM, P6 = P7 = NÃO: Unidade de valor, relação "' + x.camadaSugerida.relacao + '"');
    const just = av.gerarJustificativaAutomatica(atual, x);
    afirma(!AUXILIARES.test(just), 'a justificativa da Unidade de valor também não menciona jornada nem mensuração (já não mencionava)');
  }

  console.log('\n   prova inversa — com o texto antigo, a conferência falha:');
  const antigo = Object.assign({}, SRC, { avp: SRC.avp.replace("return '" + RELACAO_APROVADA + "';", "return '" + RELACAO_ANTIGA + "';") });
  afirma(antigo.avp !== SRC.avp, '(texto antigo recolocado em memória)');
  const ra = varrer(antigo, v5);
  afirma(ra.problemas.length > 0 && ra.problemas.some((p) => /jornada\/mensuração/.test(p)), 'texto antigo → a conferência FALHA (' + ra.problemas.length + ' problemas; ex.: ' + (ra.problemas[0] || '').slice(0, 70) + '…)');
  afirma(ra.digital === DIGITAL_V5, 'e a impressão digital do resto continua a mesma (a diferença está SÓ na relação de Unidade de valor)');
}

/* ------------------------------ PARTE B ---------------------------------- */
function itemUVA(nome, extra) {
  const sims = ['P1', 'P2', 'P3', 'P4', 'P8'];
  const respostas = {};
  ORDEM.forEach((id, i) => {
    const cod = 'P' + (i + 1);
    respostas[id] = { valor: sims.indexOf(cod) !== -1 ? 'sim' : 'nao', observacao: '', justificativaAuto: 'auto', codigoPergunta: cod, textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 };
  });
  return Object.assign({
    nome, descricao: '', publico: '', necessidade: '', observacoesGerais: '', status: 'concluido', respostas,
    resultadoAutomatico: 'nao-produto', decisaoFinal: 'nao-produto', decisaoManual: false,
    camadaSugerida: { id: 'unidade-valor-associada', label: 'Unidade de valor associada', motivos: [], conflito: null, incoerencia: false, especializacao: null, papelEstrutural: null, relacao: RELACAO_ANTIGA },
    justificativaAutomatica: 'O item foi classificado como Unidade de valor associada, e não como Produto/Serviço principal, porque entrega um resultado próprio e perceptível para o cliente, mas depende estruturalmente de um Produto/Serviço maior para existir.',
    criteriosEssenciaisFalhos: [], exclusoesConflitantes: null, criteriosAtendidos: 5,
    motorVersion: MOTOR_VERSION_ESPERADA, motorVersionArquitetura: 4, questionnaireContentVersion: 1, criadoEm: '2026-10-04T10:00:00.000Z', atualizadoEm: '2026-10-04T10:00:00.000Z',
    responsavel: { name: 'Teste', email: EMAIL }, versao: 1, versaoAnteriorKey: null, excluido: false, excluidoEm: null, excluidoPor: null,
    justificativaExclusao: null, historicoMotor: null, itemId: nome
  }, extra || {});
}

async function abrir(browser, viewport) {
  const admins = {}; admins[chave(EMAIL)] = { email: EMAIL };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-espera': {},
    'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {}, eventos: {}, 'turmas-publico': {}, 'eventos-publico': {},
    'avaliacoes-produto': { uva1: itemUVA('Item fictício unidade de valor sem jornada nem medição') }, 'avaliacoes-squad': {}, 'motor-squad-config': {}, 'motor-squad-auditoria': {},
    'motor-arquitetura-config': configV5(), 'motor-arquitetura-auditoria': {}, 'fa-avaliacao-acessos': {} };
  const cfgPagina = { db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfgPagina) + ';');
  await ctx.addInitScript(`
    window.__pdfs = [];
    new MutationObserver(function (ms) {
      ms.forEach(function (m) { m.addedNodes.forEach(function (n) {
        if (n.nodeType !== 1 || n.parentNode !== document.body) return;
        var doc = n.classList && n.classList.contains('pdf-doc') ? n : (n.querySelector && n.querySelector('.pdf-doc'));
        if (!doc) return;
        window.__pdfs.push({ tudo: doc.innerText });
      }); });
    }).observe(document, { childList: true, subtree: true });`);
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#avaliacoes', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.body.classList.contains('aguardando-auth'), { timeout: 16000 }).catch(() => {});
  await page.waitForSelector('#avpNovoBtn', { timeout: 8000 });
  await page.waitForTimeout(600);
  return { ctx, page, erros };
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal || window.__CFG.db)));
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
async function foto(locator, nome) { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await locator.screenshot({ path: path.join(SHOTS, nome + '.png') }); } }
async function gerarPdf(page) {
  await page.evaluate(() => { window.__pdfs = []; });
  await Promise.all([page.waitForEvent('download', { timeout: 60000 }).catch(() => null), page.click('#avpGerarPdfBtn')]);
  await page.waitForTimeout(500);
  return page.evaluate(() => { const t = []; (window.__pdfs || []).forEach((b) => { if (t.indexOf(b.tudo) === -1) t.push(b.tudo); }); return t.join('\n').replace(/\s+/g, ' '); });
}

async function parteB(browser) {
  for (const [nomeTela, viewport, sufixo] of [['desktop', DESKTOP, 'desktop'], ['celular 375px', CELULAR, '375']]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros } = await abrir(browser, viewport);
    await page.click('.avp-act-ver[data-key="uva1"]');
    await page.waitForSelector('#avpSecaoSistema', { timeout: 8000 });
    await page.waitForTimeout(300);
    const relAntes = await page.locator('.avp-alt-relacao').innerText().catch(() => '');
    afirma(relAntes.indexOf(RELACAO_ANTIGA) !== -1, 'avaliação concluída ANTES da correção: mostra o texto da época (histórico preservado, nada recalculado ao exibir)');
    afirma((await banco(page))['avaliacoes-produto'].uva1.camadaSugerida.relacao === RELACAO_ANTIGA, 'e o texto gravado continua o da época');

    await page.click('#avpReprocessarBtn');
    await page.click('.avp-modal-confirm-btn');
    await page.waitForFunction(() => { const it = window.__CFG.__dbReal['avaliacoes-produto'].uva1; return it && it.motorVersionArquitetura === 5; }, null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(300);
    const it = (await banco(page))['avaliacoes-produto'].uva1;
    afirma(it.motorVersionArquitetura === 5 && it.camadaSugerida.id === 'unidade-valor-associada', 'reprocessada com a versão 5: continua Unidade de valor associada (P6 = P7 = NÃO, P8 = SIM)');
    afirma(it.camadaSugerida.relacao === RELACAO_APROVADA, 'relação gravada = texto aprovado');
    const relTela = (await page.locator('.avp-alt-relacao').innerText().catch(() => '')).replace(/\s+/g, ' ');
    afirma(relTela.indexOf(RELACAO_APROVADA) !== -1 && !AUXILIARES.test(relTela), 'tela: "Relação arquitetural" com o texto aprovado, sem jornada nem mensuração', relTela);
    afirma(await larguraOk(page), 'tela: sem rolagem horizontal');
    await foto(page.locator('#avpSecaoSistema'), 'r3-relacao-unidade-valor-' + sufixo);
    const pdf = await gerarPdf(page);
    const ini = pdf.indexOf('Classificação arquitetural');
    const trecho = ini >= 0 ? pdf.slice(ini, ini + 600) : '';
    afirma(pdf.indexOf('Relação arquitetural: ' + RELACAO_APROVADA) !== -1, 'PDF: "Relação arquitetural:" com o texto aprovado', trecho.slice(0, 300));
    afirma(trecho.length > 0 && !AUXILIARES.test(trecho.slice(0, trecho.indexOf(RELACAO_APROVADA) + RELACAO_APROVADA.length)), 'PDF: o bloco da classificação não menciona jornada nem mensuração');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }
}

(async () => {
  parteA();
  const browser = await chromium.launch();
  try { await parteB(browser); } finally { await browser.close(); }
  console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
