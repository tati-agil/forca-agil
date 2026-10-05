/* Textos automáticos de P5 e da classificação Informação/Documento.
 *
 * Pedido "CORRIGIR TEXTOS AUTOMÁTICOS DE P5 E DA CLASSIFICAÇÃO INFORMAÇÃO/
 * DOCUMENTO". Caso real: Trilha de Educação Previdenciária — P1 SIM, P2 SIM,
 * P3 SIM, P4 SIM, P5 NÃO, P6 SIM, P7 SIM, P8 NÃO, P9 NÃO, P10 SIM, P11-P16 NÃO —
 * corretamente "Não é Produto/Serviço principal", camada Informação/Documento.
 * A classificação está certa; a NARRATIVA automática não estava:
 *   - relação arquitetural: "entregue a partir de outro Produto/Serviço"
 *     (nenhuma resposta sustenta essa dependência);
 *   - justificativa: "...e não como uma solução com resultado próprio" (nega o
 *     que P2 = SIM afirma);
 *   - P5 = NÃO: "depende estruturalmente de outro Produto/Serviço" (P5 = NÃO só
 *     diz que a autonomia estrutural não foi demonstrada).
 * É uma correção editorial/interpretativa, não lógica.
 *
 * PARTE A (sem navegador, sobre o código real carregado em vm): as 65.536
 *   combinações das 16 respostas.
 *   - a classificação (resultado, camada, motivos, conflito, incoerência,
 *     especialização, papel estrutural, essenciais, exclusões) é BYTE A BYTE a
 *     de antes da correção (impressão digital fixada abaixo);
 *   - com P2 = SIM, nenhum texto automático (relação e justificativa) nega
 *     resultado próprio — em nenhuma das 32.768 combinações;
 *   - nas camadas em que a dependência de outro Produto/Serviço NÃO faz parte do
 *     significado da camada (Informação/Documento, Canal, Capacidade
 *     organizacional, A validar), nenhum texto automático afirma dependência;
 *   - a Trilha produz exatamente os textos pedidos.
 * PARTE B (tela, banco falso em persistenciaReal): a correção de P5 entra pelo
 *   mecanismo PARAMETRIZADO (card "Aplicar correção"), criando uma versão NOVA do
 *   questionário — motorVersion e motorVersionArquitetura não mudam, ninguém vira
 *   "Motor desatualizado", nada é reprocessado; a Trilha nova usa os textos
 *   novos; a Trilha antiga mantém, byte a byte, os textos da época.
 * Hermético: sem rede, sem segredo. */
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
const SRC_AVP = fs.readFileSync(path.join(RAIZ, 'avaliacao-produto.js'), 'utf8');
const MOTOR_VERSION = /var MOTOR_VERSION = '([^']+)'/.exec(SRC_AVP)[1];
const EMAIL = 'teste@previ.com.br';
const KEY = EMAIL.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

const ORDEM = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao',
  'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
const CODIGO = {}; ORDEM.forEach((id, i) => { CODIGO[id] = 'P' + (i + 1); });
/* Trilha: P1-P4 SIM, P5 NÃO, P6-P7 SIM, P8 NÃO, P9 NÃO, P10 SIM, P11-P16 NÃO */
const TRILHA = { necessidade: 'sim', resultado: 'sim', solucao: 'sim', fronteira: 'sim', autonomia: 'nao', jornada: 'sim', medicao: 'sim', gestao: 'nao', canal: 'nao', artefato: 'sim' };
const valorTrilha = (id) => TRILHA[id] || 'nao';

/* Textos ANTES (o que as avaliações já gravadas guardam) e DEPOIS (pedidos) */
const RELACAO_ANTIGA = 'É um documento ou informação entregue a partir de outro Produto/Serviço.';
const JUSTIFICATIVA_ANTIGA = 'O item foi classificado como Informação/Documento, e não como Produto/Serviço principal, porque funciona predominantemente como um documento ou informação entregue ao cliente, e não como uma solução com resultado próprio.';
const P5_NAO_ANTIGO = 'NÃO — O item depende estruturalmente de outro Produto/Serviço para existir ou fazer sentido.';
const RELACAO_NOVA = 'É uma entrega cuja natureza predominante é informacional, documental ou de conteúdo.';
const JUSTIFICATIVA_NOVA = 'Embora o item possa possuir identidade e produzir resultado percebido pelo usuário, sua natureza predominante é informacional, documental ou de conteúdo. Por isso, foi classificado como Informação/Documento, e não como Produto/Serviço principal.';
const P5_NAO_NOVO = 'O item não demonstra autonomia estrutural suficiente para ser tratado como uma solução principal independente.';

/* Frases que uma narrativa automática NÃO pode conter quando a resposta registrada não as sustenta */
const NEGA_RESULTADO_PROPRIO = /não (possui|tem) resultado próprio|(sem|nem) (ter|possuir|resultado)[^.]*resultado próprio|e não como uma solução com resultado próprio|sem ter, ele mesmo, um resultado próprio/i;
const AFIRMA_DEPENDENCIA = /depende(m)? estruturalmente|depend(e|em) de outro|entregue a partir de outro|pertence(nte)? a outro|pertencente a outro|do Produto\/Serviço ao qual pertence/i;

/* Impressão digital da classificação das 65.536 combinações ANTES da correção
   (sem o campo de texto "relacao"). Só muda se a LÓGICA do motor mudar — e aí
   este número deve ser recalculado de propósito, nunca "para o teste passar". */
const DIGITAL_CLASSIFICACAO = '6b2697590ff8e269237a58d0697a6db6f2fffbfda24b8eb9aa81957d3c63106e';

/* ------------------------------------------------------------------------- *
 * Carrega o código REAL (questionarios-config, motor-arquitetura e
 * avaliacao-produto) num vm, com um gancho só de teste para alcançar as funções
 * internas. O gancho é acrescentado aqui, em memória — nada disso existe no
 * arquivo de produção.
 * ------------------------------------------------------------------------- */
function carregarCodigo() {
  const ctx = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, setTimeout, clearTimeout, setInterval, clearInterval, parseFloat, parseInt, isNaN };
  ctx.window = ctx; ctx.window.window = ctx;
  const el = () => ({ addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, style: {}, classList: { add() {}, remove() {}, contains() { return false; } } });
  ctx.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: el(), documentElement: el() };
  ctx.firebase = { database: () => ({ ref: () => ({ on() {}, once() {}, update() {}, child() { return this; }, push() { return { key: 'k' }; } }) }) };
  ctx.navigator = {}; ctx.location = { hash: '' }; ctx.localStorage = { getItem() { return null; }, setItem() {} };
  vm.createContext(ctx);
  for (const f of ['questionarios-config.js', 'motor-arquitetura.js']) vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), ctx, { filename: f });
  const fim = SRC_AVP.lastIndexOf('})();');
  const src = SRC_AVP.slice(0, fim) + '\nwindow.__avpTeste = { computeResultado: computeResultado, gerarJustificativaAutomatica: gerarJustificativaAutomatica };\n' + SRC_AVP.slice(fim);
  vm.runInContext(src, ctx, { filename: 'avaliacao-produto.js' });
  return ctx.__avpTeste;
}
const respostasDe = (m) => { const r = {}; ORDEM.forEach((id, i) => { r[id] = { valor: (m >> i) & 1 ? 'sim' : 'nao' }; }); return r; };
const respostasTrilha = () => { const r = {}; ORDEM.forEach((id) => { r[id] = { valor: valorTrilha(id) }; }); return r; };

function parteA() {
  console.log('== PARTE A — código real, as 65.536 combinações ==');
  const av = carregarCodigo();

  console.log('\n-- T4: a classificação é exatamente a de antes --');
  const h = crypto.createHash('sha256');
  const contagemPorCamada = {};
  let comP2Sim = 0, negaResultado = [], afirmaDependencia = [], camadasSemDependenciaVistas = {};
  const CAMADAS_SEM_DEPENDENCIA = ['documento-informacao', 'canal', 'capacidade-organizacional', 'a-validar'];
  for (let m = 0; m < 65536; m++) {
    const atual = { respostas: respostasDe(m) };
    const c = av.computeResultado(atual);
    const { relacao, ...semTexto } = c.camadaSugerida;
    /* Única diferença INTENCIONAL desde a impressão digital original: o motor
       deixou de gravar os placeholders "não determinada pelo questionário" /
       "não determinado" (agora null). Para provar que NADA MAIS mudou, os dois
       valores são recolocados aqui antes de calcular — se o hash continua o de
       antes, só os placeholders deixaram de existir. */
    if (semTexto.especializacao === null && ['componente', 'unidade-valor-associada', 'funcionalidade-operacao', 'regra-condicao', 'documento-informacao', 'produto-principal'].indexOf(semTexto.id) !== -1) semTexto.especializacao = 'não determinada pelo questionário';
    if (semTexto.papelEstrutural === null && semTexto.id === 'componente') semTexto.papelEstrutural = 'não determinado';
    h.update(JSON.stringify([m, c.resultadoAutomatico, c.essenciaisFalhos, c.criteriosAtendidos, c.exclusoesConflitantes, semTexto]) + '\n');
    contagemPorCamada[c.camadaSugerida.id] = (contagemPorCamada[c.camadaSugerida.id] || 0) + 1;
    const just = av.gerarJustificativaAutomatica(atual, c);
    const textos = (relacao || '') + ' || ' + just;
    if (atual.respostas.resultado.valor === 'sim') {
      comP2Sim++;
      if (NEGA_RESULTADO_PROPRIO.test(textos) && negaResultado.length < 3) negaResultado.push(m + ' (' + c.camadaSugerida.id + '): ' + textos.slice(0, 160));
    }
    if (atual.respostas.autonomia.valor === 'nao' && CAMADAS_SEM_DEPENDENCIA.indexOf(c.camadaSugerida.id) !== -1) {
      camadasSemDependenciaVistas[c.camadaSugerida.id] = (camadasSemDependenciaVistas[c.camadaSugerida.id] || 0) + 1;
      if (AFIRMA_DEPENDENCIA.test(textos) && afirmaDependencia.length < 3) afirmaDependencia.push(m + ' (' + c.camadaSugerida.id + '): ' + textos.slice(0, 160));
    }
  }
  const digital = h.digest('hex');
  afirma(digital === DIGITAL_CLASSIFICACAO, 'impressão digital da classificação (resultado, camada, motivos, conflito, incoerência, especialização, papel estrutural, essenciais, exclusões) idêntica à de antes nas 65.536 combinações');
  afirma((contagemPorCamada['documento-informacao'] || 0) > 0 && Object.keys(contagemPorCamada).length === 11, 'as 11 camadas continuam alcançáveis (' + Object.keys(contagemPorCamada).length + ')');

  console.log('\n-- regra editorial: P2 = SIM nunca é negado --');
  afirma(comP2Sim === 32768, 'combinações com P2 = SIM examinadas: ' + comP2Sim);
  afirma(negaResultado.length === 0, 'nenhuma relação/justificativa nega "resultado próprio" quando P2 = SIM' + (negaResultado.length ? ' — ex.: ' + negaResultado[0] : ''));

  console.log('\n-- regra editorial: sem resposta que sustente, nenhuma dependência de outro Produto/Serviço --');
  const vistas = Object.keys(camadasSemDependenciaVistas).map((k) => k + ':' + camadasSemDependenciaVistas[k]).join(' ');
  afirma(camadasSemDependenciaVistas['documento-informacao'] > 0, 'examinadas combinações P5 = NÃO em Informação/Documento (' + vistas + ')');
  afirma(afirmaDependencia.length === 0, 'Informação/Documento, Canal, Capacidade e A validar (P5 = NÃO) não afirmam dependência de outro Produto/Serviço' + (afirmaDependencia.length ? ' — ex.: ' + afirmaDependencia[0] : ''));

  console.log('\n-- a Trilha: textos exatamente como pedidos --');
  const atual = { respostas: respostasTrilha() };
  const c = av.computeResultado(atual);
  const just = av.gerarJustificativaAutomatica(atual, c);
  afirma(c.resultadoAutomatico === 'nao-produto' && c.camadaSugerida.id === 'documento-informacao', 'resultado "Não é Produto/Serviço principal", camada Informação/Documento (preservados)');
  afirma(c.camadaSugerida.relacao === RELACAO_NOVA, 'T3: relação arquitetural = "' + c.camadaSugerida.relacao + '"');
  afirma(!/entregue a partir de outro/.test(c.camadaSugerida.relacao), 'T3: não diz "entregue a partir de outro Produto/Serviço"');
  afirma(just.startsWith(JUSTIFICATIVA_NOVA), 'T2: justificativa = "' + just.slice(0, 95) + '…"');
  afirma(!NEGA_RESULTADO_PROPRIO.test(just), 'T2: a justificativa não afirma "não possui resultado próprio" (P2 = SIM, P10 = SIM)');
  const comEspec = av.gerarJustificativaAutomatica(atual, { camadaSugerida: Object.assign({}, c.camadaSugerida, { especializacao: 'Material educativo' }) });
  afirma(comEspec === JUSTIFICATIVA_NOVA, 'a especialização cadastrada NÃO entra mais na justificativa automática (só a identificada pelo questionário entra; aqui não há)');
  const p2Nao = respostasTrilha(); p2Nao.resultado.valor = 'nao';
  const cNao = av.computeResultado({ respostas: p2Nao });
  afirma(cNao.camadaSugerida.id === 'documento-informacao' && av.gerarJustificativaAutomatica({ respostas: p2Nao }, cNao).startsWith(JUSTIFICATIVA_NOVA), 'com P2 = NÃO o texto continua neutro (não afirma nada que as respostas não sustentem)');
  const canalP2Sim = respostasTrilha(); canalP2Sim.canal.valor = 'sim'; canalP2Sim.artefato.valor = 'nao';
  const cCanal = av.computeResultado({ respostas: canalP2Sim });
  const jCanal = av.gerarJustificativaAutomatica({ respostas: canalP2Sim }, cCanal);
  afirma(cCanal.camadaSugerida.id === 'canal' && /^Embora o item possa possuir identidade/.test(jCanal) && !NEGA_RESULTADO_PROPRIO.test(jCanal), 'mesma regra no Canal com P2 = SIM: "' + jCanal.slice(0, 80) + '…"');
  const canalP2Nao = respostasTrilha(); canalP2Nao.canal.valor = 'sim'; canalP2Nao.artefato.valor = 'nao'; canalP2Nao.resultado.valor = 'nao';
  const jCanalNao = av.gerarJustificativaAutomatica({ respostas: canalP2Nao }, av.computeResultado({ respostas: canalP2Nao }));
  afirma(/^O item foi classificado como Canal, e não como Produto\/Serviço principal, porque funciona predominantemente como um canal de acesso ou relacionamento, e não como uma solução com resultado próprio\.$/.test(jCanalNao), 'Canal com P2 = NÃO: texto anterior preservado (a negação é coerente com a resposta)');

  console.log('\n-- não voltou a hardcodar por item --');
  afirma(!/Trilha|Educação Previdenciária/i.test(SRC_AVP.slice(SRC_AVP.indexOf('function relacaoArquitetural('), SRC_AVP.indexOf('function gerarJustificativaAutomatica(') + 6000)), 'nenhuma exceção por nome de item nas funções de texto');
}

/* ------------------------------ PARTE B ---------------------------------- */
function itemTrilhaAntiga() {
  const respostas = {};
  ORDEM.forEach((id) => {
    const v = valorTrilha(id);
    let auto = v === 'sim' ? 'SIM — padrão.' : 'NÃO — padrão.';
    if (id === 'autonomia') auto = P5_NAO_ANTIGO; /* snapshot gravado na época */
    respostas[id] = { valor: v, justificativaAuto: auto, observacao: '', codigoPergunta: CODIGO[id], textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 };
  });
  return {
    nome: 'Trilha de Educação Previdenciária (antiga)', descricao: '', publico: '', necessidade: '', observacoesGerais: '',
    status: 'concluido', respostas: respostas,
    resultadoAutomatico: 'nao-produto', decisaoFinal: 'nao-produto', decisaoManual: false, decisaoConfirmada: false,
    camadaSugerida: { id: 'documento-informacao', label: 'Informação/Documento', motivos: ['P10'], conflito: null, incoerencia: false, especializacao: null, papelEstrutural: null, relacao: RELACAO_ANTIGA },
    justificativaAutomatica: JUSTIFICATIVA_ANTIGA,
    criteriosEssenciaisFalhos: ['autonomia'], exclusoesConflitantes: ['artefato'], criteriosAtendidos: 6,
    motorVersion: MOTOR_VERSION, motorVersionArquitetura: 1, questionnaireContentVersion: 1,
    criadoEm: '2026-09-29T10:00:00.000Z', atualizadoEm: '2026-09-29T10:00:00.000Z',
    responsavel: { name: 'Teste', email: EMAIL }, itemId: 'trilhaantiga', versao: 1, versaoAnteriorKey: null, excluido: false
  };
}

async function abrirApp(browser, viewport) {
  const admins = {}; admins[KEY] = { email: EMAIL };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {},
    'turmas-checkin': {}, 'turmas-espera': {}, 'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {},
    eventos: {}, 'turmas-publico': {}, 'eventos-publico': {}, 'avaliacoes-produto': { trilhaantiga: itemTrilhaAntiga() }, 'avaliacoes-squad': {},
    'motor-squad-config': {}, 'motor-squad-auditoria': {}, 'motor-arquitetura-auditoria': {} };
  const cfg = { db: db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport: viewport || { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await ctx.addInitScript(`
    window.__pdfs = [];
    new MutationObserver(function (ms) {
      ms.forEach(function (m) { m.addedNodes.forEach(function (n) {
        if (n.nodeType !== 1 || n.parentNode !== document.body) return; /* só blocos reais do PDF, não as medições */
        var doc = n.classList && n.classList.contains('pdf-doc') ? n : (n.querySelector && n.querySelector('.pdf-doc'));
        if (doc) window.__pdfs.push({ tudo: doc.innerText });
      }); });
    }).observe(document, { childList: true, subtree: true });`);
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#avaliacoes', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page); /* login decidido e acessos resolvidos (antes: opções no lugar do argumento, engolida + 800 ms + 300 ms fixos) */
  await page.waitForSelector('#avpNovoBtn', { timeout: 8000 });
  return { ctx, page, erros };
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const contar = (page, sel) => page.locator(sel).count();
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const textoTela = (page) => page.locator('#avaliacoesPainel').textContent().then((t) => t.replace(/\s+/g, ' '));
async function interpretacao(page, codigo) {
  const n = codigo.slice(1);
  return page.locator('.avp-reasoning-item', { has: page.locator('.avp-reasoning-q', { hasText: new RegExp('^' + n + '\\.') }) }).locator('.avp-reasoning-auto').innerText();
}
async function novaTrilha(page, nome) {
  await page.click('#avpNovoBtn');
  await page.fill('#avpfNome', nome);
  await page.click('#avpIniciarBtn');
  await page.waitForTimeout(150);
  for (const id of ORDEM) await page.locator('#avpQuestion-' + id + ' .avp-choice-btn--' + valorTrilha(id)).click();
  await page.click('#avpConcluirBtn');
  await page.waitForSelector('.avp-reasoning-list', { timeout: 8000 });
  await page.waitForTimeout(200);
}
async function aplicarCorrecao(page) {
  await irAoAdmin(page);
  await page.click('#avpConfigQuestionariosBtn');
  await page.waitForSelector('#avpCorrecao-interpretacoes-p5-p15', { timeout: 5000 });
  await page.click('.avp-correcao-aplicar-btn');
  await page.waitForTimeout(150);
  await page.click('.avp-modal-confirm-btn');
  await page.waitForFunction(() => /Correção aplicada/.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
  await page.click('.avp-modal-ok-btn').catch(() => {});
  await page.waitForTimeout(300);
  await voltarParaAvaliacoes(page);
}

async function parteB(browser) {
  console.log('\n== PARTE B — pela tela ==');
  const { ctx, page, erros } = await abrirApp(browser);
  const antigoAntes = (await banco(page))['avaliacoes-produto'].trilhaantiga;
  const motorAntes = await page.evaluate(() => JSON.stringify(window.__CFG.__dbReal['motor-arquitetura-config'] || null));

  console.log('\n-- T6: a Trilha antiga mostra os textos da época --');
  await page.click('.avp-act-ver[data-key="trilhaantiga"]');
  await page.waitForSelector('.avp-reasoning-list', { timeout: 5000 });
  let tela = await textoTela(page);
  afirma(tela.includes(RELACAO_ANTIGA) && tela.includes(JUSTIFICATIVA_ANTIGA), 'relação e justificativa gravadas na época continuam na tela');
  afirma((await interpretacao(page, 'P5')).includes(P5_NAO_ANTIGO.replace(/^NÃO\s*—\s*/, '')), 'P5 = NÃO: a interpretação registrada na época continua na tela');
  await page.click('#avpVoltarListaResultado');
  await page.waitForSelector('#avpNovoBtn');
  afirma(await contar(page, '.avp-tag-motor--atual') === 1 && await contar(page, '.avp-tag-motor--desatualizado') === 0, 'lista: "Motor atual"');

  console.log('\n-- a correção de P5 entra pela configuração parametrizada (versão NOVA do questionário) --');
  await aplicarCorrecao(page);
  const dep = await banco(page);
  const cfgQ = dep['questionarios-config'].CLASSIFICACAO_ARQUITETURAL;
  afirma(cfgQ.versaoPublicada === 2, 'T5: questionnaireContentVersion vigente: 1 → ' + cfgQ.versaoPublicada);
  afirma(cfgQ.versoes['2'].perguntas.find((x) => x.codigoEstavel === 'P5').justNao === 'NÃO — ' + P5_NAO_NOVO, 'P5 justNao (configuração parametrizada) = "' + P5_NAO_NOVO.slice(0, 60) + '…"');
  afirma(JSON.stringify(dep['motor-arquitetura-config'] || null) === motorAntes, 'T5: motor-arquitetura-config intocado — motorVersionArquitetura não muda');
  afirma(JSON.stringify(dep['avaliacoes-produto'].trilhaantiga) === JSON.stringify(antigoAntes), 'T6: a Trilha antiga ficou byte a byte igual no banco (nada reprocessado, nada reescrito)');
  afirma(await contar(page, '.avp-tag-motor--desatualizado') === 0 && await contar(page, '#avpReconciliarBar') === 0 && await page.locator('#avpReprocessarTudoBtn').isDisabled(),
    'T5: ninguém virou "Motor desatualizado"; nada a reprocessar; nada a reconciliar');

  console.log('\n-- T7: uma Trilha NOVA (P1-P4 SIM, P5 NÃO, P6-P7 SIM, P8 NÃO, P9 NÃO, P10 SIM, P11-P16 NÃO) --');
  await novaTrilha(page, 'Trilha de Educação Previdenciária');
  const chave = Object.entries((await banco(page))['avaliacoes-produto']).find(([, v]) => v.nome === 'Trilha de Educação Previdenciária')[0];
  const nova = (await banco(page))['avaliacoes-produto'][chave];
  afirma(nova.resultadoAutomatico === 'nao-produto' && nova.camadaSugerida.id === 'documento-informacao' && nova.camadaSugerida.label === 'Informação/Documento', 'resultado "Não é Produto/Serviço principal", camada Informação/Documento (preservado)');
  afirma(nova.questionnaireContentVersion === 2 && antigoAntes.questionnaireContentVersion === 1, 'T5: a avaliação nova usa a versão de conteúdo 2 (a antiga segue na 1)');
  afirma(nova.motorVersion === MOTOR_VERSION && nova.motorVersion === antigoAntes.motorVersion && nova.motorVersionArquitetura === antigoAntes.motorVersionArquitetura,
    'T5: motorVersion (' + nova.motorVersion + ') e motorVersionArquitetura (' + nova.motorVersionArquitetura + ') iguais aos da avaliação antiga');
  afirma(nova.camadaSugerida.relacao === RELACAO_NOVA, 'T3: relação gravada = "' + nova.camadaSugerida.relacao + '"');
  afirma(nova.justificativaAutomatica === JUSTIFICATIVA_NOVA, 'T2: justificativa gravada = a pedida');
  tela = await textoTela(page);
  afirma(tela.includes(RELACAO_NOVA) && tela.includes(JUSTIFICATIVA_NOVA), 'a tela mostra a relação e a justificativa novas');
  afirma(/Camada identificada:\s*Informação\/Documento/.test(await page.locator('.avp-alt-card').innerText()), 'a tela mostra a camada Informação/Documento');
  const p5 = await interpretacao(page, 'P5');
  afirma(p5.includes(P5_NAO_NOVO), 'T1: P5 = NÃO na tela: "' + p5.replace(/\s+/g, ' ').slice(0, 110) + '…"');
  afirma(!/depende estruturalmente de outro Produto\/Serviço/i.test(p5), 'T1: não aparece "depende estruturalmente de outro Produto/Serviço"');
  afirma(!NEGA_RESULTADO_PROPRIO.test(tela) && !/entregue a partir de outro/.test(tela), 'T2/T3: nenhum texto da tela nega resultado próprio nem diz "entregue a partir de outro Produto/Serviço"');

  console.log('\n-- PDF da Trilha nova --');
  await page.evaluate(() => { window.__pdfs = []; });
  await Promise.all([page.waitForEvent('download', { timeout: 60000 }).catch(() => null), page.click('#avpGerarPdfBtn')]);
  await page.waitForTimeout(400);
  const pdf = await page.evaluate(() => {
    /* o PDF sai em blocos (e o html2pdf clona cada um): junta os textos distintos, na ordem */
    const textos = [];
    (window.__pdfs || []).forEach((b) => { if (textos.indexOf(b.tudo) === -1) textos.push(b.tudo); });
    return textos.length ? { tudo: textos.join('\n') } : null;
  });
  afirma(!!pdf && pdf.tudo.replace(/\s+/g, ' ').includes(RELACAO_NOVA) && pdf.tudo.replace(/\s+/g, ' ').includes(JUSTIFICATIVA_NOVA) && !/entregue a partir de outro/.test(pdf.tudo), 'o PDF traz a relação e a justificativa novas');
  await page.waitForTimeout(800);

  console.log('\n-- T6 (de novo): depois de tudo, a Trilha antiga continua com os textos da época --');
  await page.click('#avpVoltarListaResultado');
  await page.waitForSelector('#avpNovoBtn');
  await page.click('.avp-act-ver[data-key="trilhaantiga"]');
  await page.waitForSelector('.avp-reasoning-list', { timeout: 5000 });
  tela = await textoTela(page);
  afirma(tela.includes(RELACAO_ANTIGA) && tela.includes(JUSTIFICATIVA_ANTIGA), 'a Trilha antiga ainda mostra a relação e a justificativa de antes (histórico intacto)');
  afirma((await interpretacao(page, 'P5')).includes(P5_NAO_ANTIGO.replace(/^NÃO\s*—\s*/, '')), 'e a interpretação de P5 gravada na época');
  afirma(JSON.stringify((await banco(page))['avaliacoes-produto'].trilhaantiga) === JSON.stringify(antigoAntes), 'e continua byte a byte igual no banco');
  afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
  await ctx.close();

  console.log('\n== Celular (375 px) ==');
  const m = await abrirApp(browser, { width: 375, height: 740 });
  await m.page.click('.avp-act-ver[data-key="trilhaantiga"]');
  await m.page.waitForSelector('.avp-reasoning-list', { timeout: 5000 });
  afirma(await larguraOk(m.page) && (await textoTela(m.page)).includes(RELACAO_ANTIGA), 'resultado da Trilha legível e sem rolagem horizontal a 375 px');
  afirma(m.erros.length === 0, 'nenhum erro de JS');
  await m.ctx.close();
}

/* A configuração (questionários, motores, naturezas) agora fica no ADMIN, fora da
   área Avaliação. Estes dois passos levam até lá e de volta. */
async function irAoAdmin(page) {
  await page.evaluate(() => { location.hash = '#admin'; });
  await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelArquitetura"]', { timeout: 8000 });
  await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
  /* o Admin lembra a subtela em que ficou: se não caiu no início, volta até ele */
  await page.waitForSelector('#avpConfigQuestionariosBtn, #avpConfigVoltar, #avpNaturezasVoltar, #avpMotoresVoltarLista, #avpUsuariosVoltar', { timeout: 8000 });
  for (var nivel = 0; nivel < 6 && !(await page.locator('#avpConfigQuestionariosBtn').count()); nivel++) {
    /* o "← Voltar para …" sobe um nível por vez; aviso de alteração não salva é confirmado */
    await page.locator('#avpConfigVoltar, #avpNaturezasVoltar, #avpMotoresVoltarLista, #avpUsuariosVoltar').first().click();
    var sair = page.locator('.avp-modal-confirm-btn');
    if (await sair.count()) await sair.click();
  }
  await page.waitForSelector('#avpConfigQuestionariosBtn', { timeout: 8000 });
}
async function voltarParaAvaliacoes(page) {
  await page.evaluate(() => { location.hash = '#avaliacoes'; });
  await page.waitForSelector('#avpNovoBtn', { timeout: 8000 });
  await page.waitForTimeout(200);
}

(async () => {
  parteA();
  const browser = await chromium.launch();
  await parteB(browser);
  await browser.close();
  if (falhas) { console.log('\n' + falhas + ' FALHA(S)'); process.exit(1); }
  console.log('\nOK — textos de P5 e de Informação/Documento refletem só o que as respostas sustentam; nenhuma regra nem versão lógica do motor mudou.');
})().catch((e) => { console.error(e); process.exit(1); });
