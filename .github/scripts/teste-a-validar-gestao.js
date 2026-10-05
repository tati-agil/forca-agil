/* "A validar" por gestão ponta a ponta (P8) — explicação específica (correção editorial).
 *
 * Na versão 5 do motor, P8 = SIM é requisito obrigatório de Produto/Serviço principal e de Unidade
 * de valor associada. Quando P8 = NÃO é a ÚNICA condição que falta, o item cai no fallback "A
 * validar" — e recebia o texto genérico ("não reúnem evidência suficiente…"), sem motivo, com a
 * interpretação de P8 dizendo que o critério "isoladamente, não determina" a classificação.
 * Decisão aprovada (opção B): nesses casos — e só neles — a classificação gravada ganha a marca
 * camadaSugerida.impedidaPorGestao ('produto-principal' | 'unidade-valor-associada'), o motivo
 * "Gestão ponta a ponta como solução: NÃO", a justificativa e a interpretação de P8 aprovadas.
 * Rótulo continua "A validar". A marca é metadado explicativo: nunca participa da decisão.
 * Correção EDITORIAL (precedente de 30/09/2026, #288 e #289): nenhuma classificação, regra ou
 * precedência muda; MOTOR_VERSION e questionário intactos; avaliações gravadas antes (sem a marca)
 * continuam exatamente como eram.
 *
 * PARTE A (sem navegador — código real em vm, as 65.536 combinações):
 *   - versão 5: os itens marcados são EXATAMENTE os 8 previstos pela definição (P1–P4 = SIM,
 *     P8 = NÃO, P9–P16 = NÃO; P5 = SIM → Produto/Serviço principal, P5 = NÃO → Unidade de valor;
 *     P6/P7 livres), com justificativa, motivo, rótulo e interpretação de P8 exatos;
 *   - os outros 1.072 casos de fallback (inclusive os 536 com P8 = NÃO e mais alguma condição
 *     faltando) continuam com o texto genérico, sem motivo e sem marca;
 *   - classificação (camada, resultado, rótulo, relação, conflito, incoerência) das 65.536
 *     combinações idêntica à do código sem a detecção — versão 5 e fábrica;
 *   - fábrica, versão 3 e versão 4 (P8 não era requisito): nenhuma marca;
 *   - a marca não participa da decisão (o motor não a lê; uma marca forjada na entrada não muda nada);
 *   - prova inversa embutida: sem a detecção, ou com a detecção "qualquer fallback com P8 = NÃO",
 *     a conferência falha.
 * PARTE B (navegador, banco falso, desktop e 375 px): um item de cada grupo concluído ANTES (texto
 *   genérico, sem marca) mostra o comportamento da época na tela, no PDF e no Excel; reprocessado
 *   com a versão 5, tela, PDF e Excel mostram justificativa, motivo e interpretação de P8 novos,
 *   rótulo "A validar", sem rolagem horizontal e sem erro de JS.
 * Hermético: sem rede, sem segredo. Dados fictícios. */
const { chromium } = require('playwright');
const { esperarSessaoAssentada } = require('./esperas');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const XLSX = require(path.join(RAIZ, 'xlsx.mini.min.js'));
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

const MOTOR_VERSION_ESPERADA = '2026.09.29-2';
const ROTULO = { 'produto-principal': 'Produto/Serviço principal', 'unidade-valor-associada': 'Unidade de valor associada' };
const JUSTIFICATIVA = (alvo) => 'As respostas atendem às demais condições exigidas para ' + ROTULO[alvo] + ', mas indicam que o item não poderia ser gerido de ponta a ponta como uma solução. ' +
  'Como esse é um requisito obrigatório para essa classificação, o item permanece como A validar para análise.';
const INTERPRETACAO = (alvo) => 'Esta resposta impediu a classificação como ' + ROTULO[alvo] +
  ', porque a gestão ponta a ponta é um requisito obrigatório para essa classificação e as demais condições foram atendidas.';
const MOTIVO = 'Gestão ponta a ponta como solução: NÃO';
const JUSTIFICATIVA_GENERICA = 'As respostas não reúnem evidência suficiente para indicar com segurança nenhuma das categorias arquiteturais previstas. ' +
  'Revise as respostas do questionário ou registre uma decisão manual com a justificativa correspondente.';
const INTERPRETACAO_GENERICA = 'Este critério, isoladamente, não determina se o item é gerido como processo, capacidade ou suporte compartilhado — a classificação final considera o conjunto das respostas.';

const ORDEM = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao',
  'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
const bit = (m, cod) => (m >> (Number(cod.slice(1)) - 1)) & 1;
const clone = (x) => JSON.parse(JSON.stringify(x));

/* Os 8 casos previstos pela DEFINIÇÃO (oráculo independente do código): P1–P4 = SIM, P8 = NÃO,
   P9–P16 = NÃO, P6/P7 livres; P5 decide qual classificação foi impedida. */
function esperadoPelaDefinicao(m) {
  const sim = (c) => bit(m, c) === 1;
  if (!['P1', 'P2', 'P3', 'P4'].every(sim) || sim('P8')) return null;
  if (['P9', 'P10', 'P11', 'P12', 'P13', 'P14', 'P15', 'P16'].some(sim)) return null;
  return sim('P5') ? 'produto-principal' : 'unidade-valor-associada';
}

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
  vm.runInContext(src.avp.slice(0, fim) + '\nwindow.__avpTeste = { computeResultado: computeResultado, gerarJustificativaAutomatica: gerarJustificativaAutomatica, interpretacaoSistema: interpretacaoSistema, TODAS_PERGUNTAS: TODAS_PERGUNTAS };\n' + src.avp.slice(fim), ctx, { filename: 'avaliacao-produto.js' });
  if (config !== undefined) ctx.window.faMotorArquitetura.onMudanca(function () {});
  return { M: ctx.window.faMotorArquitetura, av: ctx.__avpTeste };
}
function configs() {
  const { M } = carregar(SRC);
  const v3 = M.regrasVersao3Esperadas();
  const v4 = M.construirPropostaConflitoNaturezas(v3);
  const v5 = clone(v4);
  ['PRODUTO_SERVICO_PRINCIPAL', 'UNIDADE_VALOR_ASSOCIADA'].forEach((c) => v5.find((r) => r.codigo === c).condicoes.all.push({ campo: 'P8', valor: 'SIM' }));
  const versoes = { 3: { regras: v3 }, 4: { regras: v4 }, 5: { regras: v5 } };
  return { v3: { versaoPublicada: 3, versoes: { 3: versoes[3] } }, v4: { versaoPublicada: 4, versoes: { 3: versoes[3], 4: versoes[4] } }, v5: { versaoPublicada: 5, versoes } };
}

/* Varre as 65.536 combinações e devolve, por combinação, o que a tela/PDF/Excel usam. */
function varrer(src, config) {
  const { M, av } = carregar(src, config);
  const defGestao = av.TODAS_PERGUNTAS.find((d) => d.id === 'gestao');
  const out = [];
  for (let m = 0; m < 65536; m++) {
    const respostas = {};
    av.TODAS_PERGUNTAS.forEach((d, i) => { const v = (m >> i) & 1 ? 'sim' : 'nao'; respostas[d.id] = { valor: v, justificativaAuto: v === 'sim' ? d.justSim : d.justNao }; });
    const atual = { respostas };
    const x = av.computeResultado(atual);
    const just = av.gerarJustificativaAutomatica(atual, x);
    const interp = respostas.gestao.valor === 'nao' ? av.interpretacaoSistema(defGestao, respostas.gestao, { status: 'concluido', camadaSugerida: x.camadaSugerida }) : null;
    out.push({ m, x, just, interp });
  }
  return { versao: M.versaoAtual(), out, M, av };
}
/* A classificação sem o que é explicação: camada, resultado, rótulo, relação, conflito, incoerência, especialização. */
const classificacao = (r) => JSON.stringify([r.x.camadaSugerida.id, r.x.resultadoAutomatico, r.x.camadaSugerida.label, r.x.camadaSugerida.relacao,
  r.x.camadaSugerida.conflito, r.x.camadaSugerida.incoerencia, r.x.camadaSugerida.especializacao, r.x.camadaSugerida.conflitoNaturezas || false,
  r.x.essenciaisFalhos, r.x.criteriosAtendidos, r.x.exclusoesConflitantes]);

const LINHA_DETECCAO = 'var impedidaPorGestao = camadaImpedidaPorGestao(contexto, regras, decisao);';
const SEM_DETECCAO = Object.assign({}, SRC, { avp: SRC.avp.replace(LINHA_DETECCAO, 'var impedidaPorGestao = null;') });

/* Confere a versão 5; devolve a lista de problemas (vazia = tudo certo). */
function conferirV5(r) {
  const problemas = [];
  const marcados = { 'produto-principal': 0, 'unidade-valor-associada': 0 };
  let fallbackGenerico = 0, p8NaoOutros = 0;
  r.out.forEach(({ m, x, just, interp }) => {
    const c = x.camadaSugerida, esperado = esperadoPelaDefinicao(m);
    if (esperado) {
      if (c.impedidaPorGestao !== esperado) { problemas.push(m + ': marca = ' + c.impedidaPorGestao + ' (esperado ' + esperado + ')'); return; }
      marcados[esperado]++;
      if (c.id !== 'a-validar' || x.resultadoAutomatico !== 'a-validar' || c.label !== 'A validar') problemas.push(m + ': rótulo/resultado = ' + c.label + '/' + x.resultadoAutomatico);
      if (just !== JUSTIFICATIVA(esperado)) problemas.push(m + ': justificativa = ' + just);
      if (JSON.stringify(c.motivos) !== JSON.stringify([MOTIVO])) problemas.push(m + ': motivos = ' + JSON.stringify(c.motivos));
      if (interp !== INTERPRETACAO(esperado)) problemas.push(m + ': interpretação de P8 = ' + interp);
      if (/evidência suficiente|isoladamente/.test(just + ' ' + interp)) problemas.push(m + ': ainda fala em evidência insuficiente / "isoladamente"');
      return;
    }
    if ('impedidaPorGestao' in c) problemas.push(m + ': marca fora dos 8 casos (' + c.impedidaPorGestao + ')');
    if (just.indexOf('gerido de ponta a ponta') !== -1 || (interp && interp.indexOf('impediu a classificação') !== -1)) problemas.push(m + ': explicação de gestão fora dos 8 casos');
    if (c.id === 'a-validar' && !c.incoerencia && !c.conflitoNaturezas) {
      fallbackGenerico++;
      if (just !== JUSTIFICATIVA_GENERICA || c.motivos.length) problemas.push(m + ': fallback mudou (' + just.slice(0, 60) + ', motivos ' + JSON.stringify(c.motivos) + ')');
      if (bit(m, 'P8') === 0) { p8NaoOutros++; if (interp !== INTERPRETACAO_GENERICA) problemas.push(m + ': interpretação de P8 mudou no fallback comum: ' + interp); }
    }
  });
  return { problemas, marcados, fallbackGenerico, p8NaoOutros };
}

function parteA() {
  console.log('== PARTE A — código real, as 65.536 combinações ==');
  const C = configs();
  const MOTOR_VERSION = /var MOTOR_VERSION = '([^']+)'/.exec(SRC.avp)[1];
  afirma(MOTOR_VERSION === MOTOR_VERSION_ESPERADA, 'versão do motor (MOTOR_VERSION) não mudou: ' + MOTOR_VERSION + ' (correção editorial)');
  afirma(SRC.motor.indexOf('impedidaPorGestao') === -1, 'o motor (motor-arquitetura.js) não conhece a marca — ela não participa da decisão');
  afirma(SRC.avp.indexOf(LINHA_DETECCAO) !== -1, 'a detecção existe no código (base da prova inversa)');

  console.log('\n-- versão 5 publicada --');
  const r5 = varrer(SRC, C.v5);
  afirma(r5.versao === 5, 'motor lendo a versão 5');
  const k = conferirV5(r5);
  afirma(k.marcados['produto-principal'] === 4 && k.marcados['unidade-valor-associada'] === 4,
    'exatamente os 8 casos previstos recebem a explicação específica: 4 de Produto/Serviço principal (P5 = SIM) e 4 de Unidade de valor associada (P5 = NÃO) — ' + JSON.stringify(k.marcados));
  afirma(k.fallbackGenerico === 1072, 'os outros ' + k.fallbackGenerico + ' casos de fallback continuam com o texto genérico, sem motivo e sem marca (esperado 1.072)');
  afirma(k.p8NaoOutros === 536, 'inclusive os ' + k.p8NaoOutros + ' com P8 = NÃO e mais alguma condição faltando: interpretação de P8 de antes (esperado 536)');
  afirma(k.problemas.length === 0, 'justificativa, motivo, rótulo "A validar" e interpretação de P8 exatos; nada fora dos 8 casos', k.problemas.slice(0, 3).join(' | '));

  const r5sem = varrer(SEM_DETECCAO, C.v5);
  const difClass = r5.out.filter((r, i) => classificacao(r) !== classificacao(r5sem.out[i])).length;
  afirma(difClass === 0, 'nenhuma das 65.536 classificações muda (camada, resultado, rótulo, relação, conflito, incoerência) em relação ao código sem a detecção (' + difClass + ' diferenças)');
  const difResto = r5.out.filter((r, i) => !esperadoPelaDefinicao(r.m) && JSON.stringify([r.x, r.just, r.interp]) !== JSON.stringify([r5sem.out[i].x, r5sem.out[i].just, r5sem.out[i].interp])).length;
  afirma(difResto === 0, 'fora dos 8 casos, resultado, justificativa e interpretação de P8 idênticos aos do código sem a detecção (' + difResto + ' diferenças)');

  /* uma marca forjada na entrada não muda a decisão nem a explicação calculada */
  const { av } = carregar(SRC, C.v5);
  const respostas = {}; av.TODAS_PERGUNTAS.forEach((d, i) => { respostas[d.id] = { valor: (31 >> i) & 1 ? 'sim' : 'nao' }; });
  const limpo = av.computeResultado({ respostas });
  const forjado = av.computeResultado({ respostas, camadaSugerida: { id: 'a-validar', impedidaPorGestao: 'unidade-valor-associada' }, impedidaPorGestao: 'unidade-valor-associada' });
  afirma(JSON.stringify(limpo) === JSON.stringify(forjado) && limpo.camadaSugerida.impedidaPorGestao === 'produto-principal', 'a marca nunca é lida como entrada: uma marca forjada no item não muda nada');

  console.log('\n-- regras em que P8 não era requisito --');
  [['fábrica', undefined, 1], ['versão 3', C.v3, 3], ['versão 4', C.v4, 4]].forEach(([nome, cfg, ver]) => {
    const r = varrer(SRC, cfg);
    const marcadas = r.out.filter((o) => 'impedidaPorGestao' in o.x.camadaSugerida).length;
    const sem = varrer(SEM_DETECCAO, cfg);
    const dif = r.out.filter((o, i) => JSON.stringify([o.x, o.just, o.interp]) !== JSON.stringify([sem.out[i].x, sem.out[i].just, sem.out[i].interp])).length;
    afirma(r.versao === ver && marcadas === 0 && dif === 0, nome + ': nenhuma marca e nada muda nas 65.536 combinações (' + marcadas + ' marcas, ' + dif + ' diferenças)');
  });

  console.log('\n   prova inversa — a conferência falha sem a detecção ou com uma detecção errada:');
  const kSem = conferirV5(r5sem);
  afirma(kSem.problemas.length === 8, 'sem a detecção → a conferência FALHA (' + kSem.problemas.length + ' problemas; ex.: ' + (kSem.problemas[0] || '') + ')');
  const LARGA = Object.assign({}, SRC, { avp: SRC.avp.replace("if (!aplicada || !M.ehFallback(aplicada)) return null;",
    "if (!aplicada || !M.ehFallback(aplicada)) return null; if (contexto.P5 === 'SIM') return 'produto-principal';") });
  afirma(LARGA.avp !== SRC.avp, '(mutação "qualquer fallback com P8 = NÃO e P5 = SIM" aplicada em memória)');
  const kLarga = conferirV5(varrer(LARGA, C.v5));
  afirma(kLarga.problemas.length > 0, 'detecção larga demais → a conferência FALHA (' + kLarga.problemas.length + ' problemas; ex.: ' + (kLarga.problemas[0] || '') + ')');
}

/* ------------------------------ PARTE B ---------------------------------- */
function item(nome, mascara) {
  const respostas = {};
  const { av } = carregar(SRC);
  av.TODAS_PERGUNTAS.forEach((d, i) => {
    const v = (mascara >> i) & 1 ? 'sim' : 'nao';
    respostas[d.id] = { valor: v, observacao: '', justificativaAuto: v === 'sim' ? d.justSim : d.justNao, codigoPergunta: d.codigoEstavel, textoPerguntaNaEpoca: d.texto, tituloNaEpoca: d.titulo, questionnaireContentVersion: 1 };
  });
  return {
    nome, descricao: '', publico: '', necessidade: '', observacoesGerais: '', status: 'concluido', respostas,
    resultadoAutomatico: 'a-validar', decisaoFinal: 'a-validar', decisaoManual: false,
    camadaSugerida: { id: 'a-validar', label: 'A validar', motivos: [], conflito: null, incoerencia: false, especializacao: null, papelEstrutural: null, relacao: null },
    justificativaAutomatica: JUSTIFICATIVA_GENERICA,
    criteriosEssenciaisFalhos: [], exclusoesConflitantes: null, criteriosAtendidos: 5,
    motorVersion: MOTOR_VERSION_ESPERADA, motorVersionArquitetura: 4, questionnaireContentVersion: 1, criadoEm: '2026-10-04T10:00:00.000Z', atualizadoEm: '2026-10-04T10:00:00.000Z',
    responsavel: { name: 'Teste', email: EMAIL }, versao: 1, versaoAnteriorKey: null, excluido: false, excluidoEm: null, excluidoPor: null,
    justificativaExclusao: null, historicoMotor: null, itemId: nome
  };
}
/* combinação 31 (P1–P5 = SIM, resto NÃO) e 15 (P1–P4 = SIM, resto NÃO) — os exemplos do diagnóstico */
const CASOS = [
  { key: 'pp1', nome: 'Item ficticio gestao produto', mascara: 31, alvo: 'produto-principal' },
  { key: 'uva1', nome: 'Item ficticio gestao unidade', mascara: 15, alvo: 'unidade-valor-associada' }
];

async function abrir(browser, viewport) {
  const admins = {}; admins[chave(EMAIL)] = { email: EMAIL };
  const itens = {}; CASOS.forEach((c) => { itens[c.key] = item(c.nome, c.mascara); });
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-espera': {},
    'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {}, eventos: {}, 'turmas-publico': {}, 'eventos-publico': {},
    'avaliacoes-produto': itens, 'avaliacoes-squad': {}, 'motor-squad-config': {}, 'motor-squad-auditoria': {},
    'motor-arquitetura-config': configs().v5, 'motor-arquitetura-auditoria': {}, 'fa-avaliacao-acessos': {} };
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
const espaco = (t) => (t || '').replace(/\s+/g, ' ');
async function foto(locator, nome) { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await locator.screenshot({ path: path.join(SHOTS, nome + '.png') }); } }
async function abrirPorQue(page) { await page.evaluate(() => { const d = document.getElementById('avpPorQueDet'); if (d && !d.open) d.querySelector('summary').click(); }); }
/* textContent: a seção de respostas pode estar recolhida — o texto continua no DOM */
const interpretacaoP8Tela = (page) => page.evaluate(() => {
  const it = Array.from(document.querySelectorAll('.avp-reasoning-item')).find((d) => /^8\./.test((d.querySelector('.avp-reasoning-q') || {}).textContent || ''));
  const p = it && it.querySelector('.avp-reasoning-auto');
  return p ? p.textContent.replace(/^Interpretação do sistema:\s*/, '').replace(/\s+/g, ' ').trim() : null;
});
const motivosTela = (page) => page.evaluate(() => Array.from(document.querySelectorAll('#avpPorQueDet .avp-motivos-list li')).map((li) => li.textContent.trim()));
async function gerarPdf(page) {
  await page.evaluate(() => { window.__pdfs = []; });
  await Promise.all([page.waitForEvent('download', { timeout: 60000 }).catch(() => null), page.click('#avpGerarPdfBtn')]);
  await page.waitForTimeout(500);
  return page.evaluate(() => { const t = []; (window.__pdfs || []).forEach((b) => { if (t.indexOf(b.tudo) === -1) t.push(b.tudo); }); return t.join('\n').replace(/\s+/g, ' '); });
}
async function lerExcel(page) {
  await page.click('#avpExportarBtn');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#avpExportarExcelTodas')]);
  const arq = path.join(require('os').tmpdir(), 'avp-gestao-' + process.pid + '-' + Date.now() + '.xlsx');
  await dl.saveAs(arq);
  const wb = XLSX.read(fs.readFileSync(arq), { type: 'buffer' });
  fs.unlinkSync(arq);
  const aba = (nome) => wb.Sheets[nome] ? XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, defval: '' }) : [];
  const resumo = aba('Resumo'), resp = aba('Respostas do questionário');
  const col = (linhas, nome) => (linhas[0] || []).indexOf(nome);
  return {
    classificacao: (nomeItem) => { const l = resumo.find((x) => x[1] === nomeItem); return l ? l[col(resumo, 'Classificação arquitetural')] : null; },
    interpretacaoP8: (nomeItem) => { const l = resp.find((x) => x[1] === nomeItem && Number(x[col(resp, 'Número da pergunta')]) === 8); return l ? l[col(resp, 'Interpretação do sistema')] : null; }
  };
}
async function voltarLista(page) {
  await page.click('#avpVoltarListaResultado');
  await page.waitForSelector('#avpNovoBtn', { timeout: 8000 });
  await page.waitForTimeout(300);
}
async function abrirItem(page, key) {
  await page.click('.avp-act-ver[data-key="' + key + '"]');
  await page.waitForSelector('#avpSecaoSistema', { timeout: 8000 });
  await page.waitForTimeout(300);
  await abrirPorQue(page);
}

async function parteB(browser) {
  for (const [nomeTela, viewport, sufixo] of [['desktop', DESKTOP, 'desktop'], ['celular 375px', CELULAR, '375']]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros } = await abrir(browser, viewport);

    console.log('-- avaliações gravadas antes (sem a marca) --');
    for (const c of CASOS) {
      await abrirItem(page, c.key);
      const tela = espaco(await page.locator('#avpSecaoSistema').innerText());
      afirma(tela.indexOf(JUSTIFICATIVA_GENERICA) !== -1 && tela.indexOf('gerido de ponta a ponta') === -1, c.key + ': tela mostra a justificativa da época');
      afirma((await motivosTela(page)).length === 0, c.key + ': tela sem lista de motivos (como era)');
      afirma(await interpretacaoP8Tela(page) === INTERPRETACAO_GENERICA, c.key + ': interpretação de P8 da época', await interpretacaoP8Tela(page));
      const pdf = await gerarPdf(page);
      afirma(pdf.indexOf('Justificativa da classificação ' + JUSTIFICATIVA_GENERICA) !== -1 && pdf.indexOf(INTERPRETACAO_GENERICA) !== -1 && pdf.indexOf('impediu a classificação') === -1,
        c.key + ': PDF com justificativa e interpretação de P8 da época');
      await voltarLista(page);
    }
    let ex = await lerExcel(page);
    CASOS.forEach((c) => afirma(ex.interpretacaoP8(c.nome) === INTERPRETACAO_GENERICA && ex.classificacao(c.nome) === 'A validar',
      c.key + ': Excel com a interpretação de P8 da época e "A validar"', ex.interpretacaoP8(c.nome)));
    const gravado = (await banco(page))['avaliacoes-produto'];
    afirma(CASOS.every((c) => gravado[c.key].justificativaAutomatica === JUSTIFICATIVA_GENERICA && !('impedidaPorGestao' in gravado[c.key].camadaSugerida)),
      'nada foi recalculado ao exibir: texto gravado da época e sem marca');

    console.log('-- reprocessadas com a versão 5 --');
    for (const c of CASOS) {
      await abrirItem(page, c.key);
      await page.click('#avpReprocessarBtn');
      await page.click('.avp-modal-confirm-btn');
      await page.waitForFunction((k) => { const it = window.__CFG.__dbReal['avaliacoes-produto'][k]; return it && it.motorVersionArquitetura === 5; }, c.key, { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(300);
      const it = (await banco(page))['avaliacoes-produto'][c.key];
      afirma(it.motorVersionArquitetura === 5 && it.camadaSugerida.id === 'a-validar' && it.camadaSugerida.label === 'A validar' && it.resultadoAutomatico === 'a-validar',
        c.key + ': reprocessado com a versão 5 — continua "A validar"');
      afirma(it.camadaSugerida.impedidaPorGestao === c.alvo, c.key + ': marca gravada = ' + it.camadaSugerida.impedidaPorGestao);
      afirma(it.justificativaAutomatica === JUSTIFICATIVA(c.alvo), c.key + ': justificativa gravada = texto aprovado');
      afirma(JSON.stringify(it.camadaSugerida.motivos) === JSON.stringify([MOTIVO]), c.key + ': motivo gravado = "' + MOTIVO + '"');
      afirma(it.historicoMotor && Object.values(it.historicoMotor).some((h) => h.justificativaAutomatica === JUSTIFICATIVA_GENERICA), c.key + ': histórico do motor guarda o texto anterior');
      await abrirPorQue(page);
      const tela = espaco(await page.locator('#avpSecaoSistema').innerText());
      afirma(tela.indexOf('Camada identificada: A validar') !== -1, c.key + ': tela — rótulo "A validar"');
      afirma(tela.indexOf(JUSTIFICATIVA(c.alvo)) !== -1 && tela.indexOf('evidência suficiente') === -1, c.key + ': tela — justificativa nova, sem "evidência suficiente"');
      afirma(JSON.stringify(await motivosTela(page)) === JSON.stringify([MOTIVO]), c.key + ': tela — motivo "' + MOTIVO + '"');
      afirma(await interpretacaoP8Tela(page) === INTERPRETACAO(c.alvo), c.key + ': tela — interpretação de P8 nova', await interpretacaoP8Tela(page));
      afirma(await larguraOk(page), c.key + ': tela sem rolagem horizontal');
      await foto(page.locator('#avpSecaoSistema'), 'a-validar-gestao-' + c.key + '-' + sufixo);
      const pdf = await gerarPdf(page);
      afirma(pdf.indexOf('Justificativa da classificação ' + JUSTIFICATIVA(c.alvo)) !== -1, c.key + ': PDF — justificativa nova');
      afirma(pdf.indexOf(INTERPRETACAO(c.alvo)) !== -1 && pdf.indexOf(INTERPRETACAO_GENERICA) === -1, c.key + ': PDF — interpretação de P8 nova');
      afirma(pdf.indexOf('Classificação arquitetural A validar') !== -1, c.key + ': PDF — classificação "A validar"');
      await voltarLista(page);
    }
    ex = await lerExcel(page);
    CASOS.forEach((c) => afirma(ex.interpretacaoP8(c.nome) === INTERPRETACAO(c.alvo) && ex.classificacao(c.nome) === 'A validar',
      c.key + ': Excel — interpretação de P8 nova e "A validar"', ex.interpretacaoP8(c.nome) + ' / ' + ex.classificacao(c.nome)));
    afirma(await larguraOk(page), 'lista sem rolagem horizontal');
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
