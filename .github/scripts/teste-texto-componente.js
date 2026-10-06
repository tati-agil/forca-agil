/* Correção editorial: a justificativa de Componente deixa de negar "jornada própria".
 *
 * A regra de Componente exige P5 = NÃO (autonomia) e P2 = NÃO (resultado), mas NÃO verifica P6
 * (jornada): na versão 5, metade das combinações de Componente tem P6 = SIM, e a frase anterior
 * ("não possui autonomia estrutural, jornada própria nem resultado autônomo…") negava a jornada
 * afirmada. Texto aprovado (versão 5):
 *   "O item não possui autonomia estrutural nem resultado autônomo suficiente para caracterizar
 *    Produto/Serviço principal. As respostas indicam que ele pertence estruturalmente a outra
 *    solução e exerce um papel estrutural dentro dela. Por isso, sua classificação predominante é
 *    Componente."
 * Só a primeira frase muda. "Elemento configurável" (P13 = SIM, alcançável só com regras antigas,
 * ex.: restauração da versão 3) fica exatamente como estava. Correção EDITORIAL (precedente de
 * 30/09/2026 e #288): nenhuma regra, precedência, camada ou resultado muda; MOTOR_VERSION e
 * questionário intactos; avaliações concluídas guardam o texto da época.
 *
 * PARTE A (sem navegador — código real em vm, as 65.536 combinações, versão 5 e fábrica):
 *   - tudo, menos a justificativa de Componente, é EXATAMENTE o de antes (impressões digitais
 *     calculadas com o código da main antes da correção, com essa justificativa trocada por um
 *     marcador — e só ela);
 *   - versão 5: toda combinação de Componente — com P6 = SIM e com P6 = NÃO — recebe exatamente o
 *     texto aprovado, sem "jornada";
 *   - fábrica: toda justificativa de Componente começa pela frase aprovada, sem "jornada", e a
 *     variante "elemento configurável" (P13 = SIM) continua idêntica no resto;
 *   - prova inversa embutida: com a frase antiga, a conferência falha.
 * PARTE B (navegador, banco falso, desktop e 375 px): um Componente com P6 = SIM concluído antes da
 *   correção mostra o texto da época; reprocessado com a versão 5, tela e PDF mostram o texto
 *   aprovado, sem "jornada".
 * Hermético: sem rede, sem segredo. Dados fictícios. */
const { chromium } = require('playwright');
const { esperarSessaoAssentada } = require('./esperas');
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

const FRASE_APROVADA = 'O item não possui autonomia estrutural nem resultado autônomo suficiente para caracterizar Produto/Serviço principal. ';
const FRASE_ANTIGA = 'O item não possui autonomia estrutural, jornada própria nem resultado autônomo suficiente para caracterizar Produto/Serviço principal. ';
const TEXTO_APROVADO = FRASE_APROVADA + 'As respostas indicam que ele pertence estruturalmente a outra solução e exerce um papel estrutural dentro dela. Por isso, sua classificação predominante é Componente.';
const JORNADA = /jornada/i;
const MOTOR_VERSION_ESPERADA = '2026.09.29-2';
/* Impressões digitais das 65.536 combinações (computeResultado + justificativa), calculadas com o
   código da main ANTES da correção (a690dc3), com a justificativa de Componente — e só ela —
   trocada pelo marcador JUSTIFICATIVA_COMPONENTE. */
const DIGITAL_FABRICA = '208ce060b165ce993a52c343e87323800551635d8ddb4c642036e532e03c6c6b';
const DIGITAL_V5 = '05e2745f648d355abf80019771ec471c022ac989ca479d58b2d5b8332e8fd102';

/* Correção editorial de 05/10/2026 (teste-a-validar-gestao.js): o "A validar" em que P8 = NÃO é a única
   condição que impede Produto/Serviço principal ou Unidade de valor associada ganhou marca, motivo e
   justificativa específicos. Para as impressões digitais fixadas ANTES dela, o estado da época é
   recolocado SÓ nesses itens (marca impedidaPorGestao presente e justificativa nova exata). */
const JUSTIFICATIVA_FALLBACK_DA_DIGITAL = 'As respostas não reúnem evidência suficiente para indicar com segurança nenhuma das categorias arquiteturais previstas. ' +
  'Revise as respostas do questionário ou registre uma decisão manual com a justificativa correspondente.';
const ROTULO_GESTAO = { 'produto-principal': 'Produto/Serviço principal', 'unidade-valor-associada': 'Unidade de valor associada' };
function explicacaoDaEpocaGestao(x, just) {
  const c = x.camadaSugerida, alvo = c.impedidaPorGestao;
  if (c.id !== 'a-validar' || !ROTULO_GESTAO[alvo]) return just;
  const nova = 'As respostas atendem às demais condições exigidas para ' + ROTULO_GESTAO[alvo] + ', mas indicam que o item não poderia ser gerido de ponta a ponta como uma solução. ' +
    'Como esse é um requisito obrigatório para essa classificação, o item permanece como A validar para análise.';
  if (just !== nova || JSON.stringify(c.motivos) !== JSON.stringify(['Gestão ponta a ponta como solução: NÃO'])) return just;
  delete c.impedidaPorGestao;
  c.motivos = [];
  return JUSTIFICATIVA_FALLBACK_DA_DIGITAL;
}

const ORDEM = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao',
  'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
const clone = (x) => JSON.parse(JSON.stringify(x));
const respostasDe = (m) => { const r = {}; ORDEM.forEach((id, i) => { r[id] = { valor: (m >> i) & 1 ? 'sim' : 'nao' }; }); return r; };

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
/* Versão 5 publicada: proposta da versão 4 (sobre a 3 esperada) + P8 = SIM em Produto/Serviço
   principal e em Unidade de valor associada. */
function configV5() {
  const { M } = carregar(SRC);
  const v3 = M.regrasVersao3Esperadas();
  const v4 = M.construirPropostaConflitoNaturezas(v3);
  const v5 = clone(v4);
  ['PRODUTO_SERVICO_PRINCIPAL', 'UNIDADE_VALOR_ASSOCIADA'].forEach((c) => v5.find((r) => r.codigo === c).condicoes.all.push({ campo: 'P8', valor: 'SIM' }));
  return { versaoPublicada: 5, versoes: { 3: { regras: v3 }, 4: { regras: v4 }, 5: { regras: v5 } } };
}

/* Varre as 65.536 combinações: impressão digital de todo o resto + as justificativas de Componente. */
function varrer(src, config) {
  const { M, av } = carregar(src, config);
  const h = crypto.createHash('sha256');
  const comp = [];
  for (let m = 0; m < 65536; m++) {
    const atual = { respostas: respostasDe(m) };
    const x = av.computeResultado(atual);
    let just = explicacaoDaEpocaGestao(x, av.gerarJustificativaAutomatica(atual, x));
    if (x.camadaSugerida.id === 'componente') {
      comp.push({ m, p6: atual.respostas.jornada.valor, p13: atual.respostas.modalidade.valor, just });
      just = 'JUSTIFICATIVA_COMPONENTE';
    }
    h.update(JSON.stringify([m, x, just]) + '\n');
  }
  return { versao: M.versaoAtual(), digital: h.digest('hex'), comp };
}

function parteA() {
  console.log('== PARTE A — código real, as 65.536 combinações ==');
  const v5 = configV5();
  const MOTOR_VERSION = /var MOTOR_VERSION = '([^']+)'/.exec(SRC.avp)[1];
  afirma(MOTOR_VERSION === MOTOR_VERSION_ESPERADA, 'versão do motor (MOTOR_VERSION) não mudou: ' + MOTOR_VERSION + ' (correção editorial)');

  console.log('\n-- versão 5 publicada --');
  const r5 = varrer(SRC, v5);
  afirma(r5.versao === 5, 'motor lendo a versão 5');
  afirma(r5.digital === DIGITAL_V5, 'classificação, rótulo, motivos, conflito, relações e justificativas das OUTRAS camadas idênticos aos de antes nas 65.536 combinações');
  const fora5 = r5.comp.filter((c) => c.just !== TEXTO_APROVADO);
  afirma(r5.comp.length > 0 && fora5.length === 0, 'Componente (' + r5.comp.length + ' combinações): justificativa é exatamente o texto aprovado', fora5.slice(0, 1).map((c) => c.m + ': ' + c.just).join(''));
  const p6Sim = r5.comp.filter((c) => c.p6 === 'sim').length, p6Nao = r5.comp.filter((c) => c.p6 === 'nao').length;
  afirma(p6Sim > 0 && p6Nao > 0, 'inclui Componentes com P6 = SIM (' + p6Sim + ') e com P6 = NÃO (' + p6Nao + ') — o texto é o mesmo nos dois');
  afirma(r5.comp.every((c) => !JORNADA.test(c.just)), 'nenhuma justificativa de Componente menciona "jornada"');

  console.log('\n-- regras de fábrica (como numa restauração de versão antiga) --');
  const rf = varrer(SRC, undefined);
  afirma(rf.digital === DIGITAL_FABRICA, 'tudo, menos a justificativa de Componente, idêntico ao de antes nas 65.536 combinações');
  afirma(rf.comp.length > 0 && rf.comp.every((c) => c.just.indexOf(FRASE_APROVADA) === 0 && !JORNADA.test(c.just)), 'Componente (' + rf.comp.length + '): toda justificativa começa pela frase aprovada, sem "jornada"');
  const conf = rf.comp.filter((c) => c.p13 === 'sim');
  afirma(conf.length > 0 && conf.every((c) => /funciona como elemento configurável dela/.test(c.just)), '"elemento configurável" (P13 = SIM, ' + conf.length + ' combinações) continua exatamente como estava — só a primeira frase mudou');
  afirma(rf.comp.filter((c) => c.p13 === 'nao').every((c) => c.just.indexOf(TEXTO_APROVADO) === 0), 'sem P13, o texto é o aprovado (seguido só da especialização identificada, quando houver)');

  {
    const { av } = carregar(SRC, v5);
    /* P1, P3, P4, P6, P15 = SIM; resto NÃO */
    const atual = { respostas: respostasDe((1 << 0) | (1 << 2) | (1 << 3) | (1 << 5) | (1 << 14)) };
    const x = av.computeResultado(atual);
    afirma(x.camadaSugerida.id === 'componente' && av.gerarJustificativaAutomatica(atual, x) === TEXTO_APROVADO, 'exemplo P1, P3, P4, P6 e P15 = SIM (P6 = SIM): Componente, com o texto aprovado');
  }

  /* o nome da classificação é interpolado da Taxonomia (classificacoes.js): a mutação troca só o trecho fixo da frase */
  console.log('\n   prova inversa — com a frase antiga, a conferência falha:');
  const antigo = Object.assign({}, SRC, { avp: SRC.avp.replace("return 'O item não possui autonomia estrutural nem resultado autônomo", "return 'O item não possui autonomia estrutural, jornada própria nem resultado autônomo") });
  afirma(antigo.avp !== SRC.avp, '(frase antiga recolocada em memória)');
  const ra = varrer(antigo, v5);
  afirma(ra.comp.some((c) => c.just !== TEXTO_APROVADO) && ra.comp.some((c) => c.p6 === 'sim' && JORNADA.test(c.just)), 'frase antiga → a conferência FALHA (Componente com P6 = SIM volta a negar a jornada)');
  afirma(ra.digital === DIGITAL_V5, 'e a impressão digital do resto continua a mesma (a diferença está SÓ na justificativa de Componente)');
}

/* ------------------------------ PARTE B ---------------------------------- */
const JUSTIFICATIVA_ANTIGA = FRASE_ANTIGA + 'As respostas indicam que ele pertence estruturalmente a outra solução e exerce um papel estrutural dentro dela. Por isso, sua classificação predominante é Componente.';
function itemComponente(nome) {
  const sims = ['P1', 'P3', 'P4', 'P6', 'P15'];
  const respostas = {};
  ORDEM.forEach((id, i) => {
    const cod = 'P' + (i + 1);
    respostas[id] = { valor: sims.indexOf(cod) !== -1 ? 'sim' : 'nao', observacao: '', justificativaAuto: 'auto', codigoPergunta: cod, textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 };
  });
  return {
    nome, descricao: '', publico: '', necessidade: '', observacoesGerais: '', status: 'concluido', respostas,
    resultadoAutomatico: 'nao-produto', decisaoFinal: 'nao-produto', decisaoManual: false,
    camadaSugerida: { id: 'componente', label: 'Componente', motivos: [], conflito: null, incoerencia: false, especializacao: null, papelEstrutural: null,
      relacao: 'Pertence estruturalmente a outro Produto/Serviço e atua como elemento da solução, sem autonomia para existir como solução independente.' },
    justificativaAutomatica: JUSTIFICATIVA_ANTIGA,
    criteriosEssenciaisFalhos: [], exclusoesConflitantes: null, criteriosAtendidos: 4,
    motorVersion: MOTOR_VERSION_ESPERADA, motorVersionArquitetura: 4, questionnaireContentVersion: 1, criadoEm: '2026-10-04T10:00:00.000Z', atualizadoEm: '2026-10-04T10:00:00.000Z',
    responsavel: { name: 'Teste', email: EMAIL }, versao: 1, versaoAnteriorKey: null, excluido: false, excluidoEm: null, excluidoPor: null,
    justificativaExclusao: null, historicoMotor: null, itemId: nome
  };
}

async function abrir(browser, viewport) {
  const admins = {}; admins[chave(EMAIL)] = { email: EMAIL };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-espera': {},
    'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {}, eventos: {}, 'turmas-publico': {}, 'eventos-publico': {},
    'avaliacoes-produto': { comp1: itemComponente('Item fictício componente com jornada') }, 'avaliacoes-squad': {}, 'motor-squad-config': {}, 'motor-squad-auditoria': {},
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
  await esperarSessaoAssentada(page); /* login decidido e acessos resolvidos (antes: opções no lugar do argumento, engolida + 600 ms fixos) */
  await page.waitForSelector('#avpNovoBtn', { timeout: 8000 });
  return { ctx, page, erros };
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal || window.__CFG.db)));
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
async function foto(locator, nome) { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await locator.screenshot({ path: path.join(SHOTS, nome + '.png') }); } }
async function abrirPorQue(page) { await page.evaluate(() => { const d = document.getElementById('avpPorQueDet'); if (d && !d.open) d.querySelector('summary').click(); }); }
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
    await page.click('.avp-act-ver[data-key="comp1"]');
    await page.waitForSelector('#avpSecaoSistema', { timeout: 8000 });
    await page.waitForTimeout(300);
    await abrirPorQue(page);
    const antes = (await page.locator('#avpSecaoSistema').innerText()).replace(/\s+/g, ' ');
    afirma(antes.indexOf(JUSTIFICATIVA_ANTIGA) !== -1, 'Componente concluído ANTES da correção: mostra o texto da época (histórico preservado, nada recalculado ao exibir)');
    afirma((await banco(page))['avaliacoes-produto'].comp1.justificativaAutomatica === JUSTIFICATIVA_ANTIGA, 'e o texto gravado continua o da época');

    await page.click('#avpReprocessarBtn');
    await page.click('.avp-modal-confirm-btn');
    await page.waitForFunction(() => { const it = window.__CFG.__dbReal['avaliacoes-produto'].comp1; return it && it.motorVersionArquitetura === 5; }, null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(300);
    const it = (await banco(page))['avaliacoes-produto'].comp1;
    afirma(it.motorVersionArquitetura === 5 && it.camadaSugerida.id === 'componente', 'reprocessado com a versão 5: continua Componente (P6 = SIM)');
    afirma(it.justificativaAutomatica === TEXTO_APROVADO, 'justificativa gravada = texto aprovado');
    await abrirPorQue(page);
    const tela = (await page.locator('#avpSecaoSistema').innerText()).replace(/\s+/g, ' ');
    afirma(tela.indexOf(TEXTO_APROVADO) !== -1, 'tela: "Justificativa da classificação" com o texto aprovado');
    const iniJ = tela.indexOf('Justificativa da classificação');
    afirma(iniJ >= 0 && !JORNADA.test(tela.slice(iniJ, iniJ + 'Justificativa da classificação'.length + TEXTO_APROVADO.length + 2)), 'tela: a justificativa não menciona "jornada"');
    afirma(await larguraOk(page), 'tela: sem rolagem horizontal');
    await foto(page.locator('#avpSecaoSistema'), 'componente-justificativa-' + sufixo);
    const pdf = await gerarPdf(page);
    afirma(pdf.indexOf('Justificativa da classificação ' + TEXTO_APROVADO) !== -1, 'PDF: "Justificativa da classificação" com o texto aprovado', pdf.slice(pdf.indexOf('Justificativa da classificação'), pdf.indexOf('Justificativa da classificação') + 260));
    afirma(pdf.indexOf(FRASE_ANTIGA.trim()) === -1, 'PDF: a frase antiga ("jornada própria") não aparece');
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
