/* COERÊNCIA DA CURADORIA E DA DECISÃO FINAL — três regras, provadas na tela
 * (desktop e celular 375 px), no PDF (HTML capturado) e no Excel, com o banco
 * falso em persistenciaReal:
 *
 *   1. REAVALIAÇÃO NÃO DESCARTA DECISÃO MANUAL EM SILÊNCIO
 *      - item com decisão manual: antes de criar a nova versão, a tela avisa
 *        (nova versão; decisão manual da anterior fica preservada NAQUELA versão;
 *        a nova começa pela recomendação do sistema e exige nova decisão);
 *      - cancelar não cria nada; confirmar cria a v2 sem herdar a decisão;
 *      - a v2 nasce com uma linha de auditoria própria ("criada por reavaliação
 *        da v1"), gravada na MESMA gravação da avaliação (se o banco recusar a
 *        auditoria, a v2 também não nasce); a v1 fica idêntica.
 *   2. DECISÃO FINAL: UMA REGRA SÓ em tela, lista, PDF e Excel
 *      - registro legado sem decisaoFinal → vale resultadoAutomatico;
 *      - nem decisaoFinal nem resultado → "—" / vazio, NUNCA "Não é Produto/Serviço".
 *   3. CURADORIA × FORMA DA DECISÃO
 *      - especialização só DERIVADA do questionário não é curadoria: não entra no
 *        bloco Curadoria, não vira "complementações" e aparece à parte
 *        ("identificada pelo questionário"), igual em tela, PDF e Excel;
 *      - especialização/papel CADASTRADOS por alguém são curadoria;
 *      - valor cadastrado que a camada atual não admite (mudança de camada) não
 *        conta nem aparece, e NADA é apagado do banco.
 * Hermético: sem rede, sem segredo. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const SRC_AVP = fs.readFileSync(path.join(RAIZ, 'avaliacao-produto.js'), 'utf8');
const MOTOR_VERSION = /var MOTOR_VERSION = '([^']+)'/.exec(SRC_AVP)[1];
const XLSX = require(path.join(RAIZ, 'xlsx.mini.min.js'));
const EMAIL = 'teste@previ.com.br';
const KEY = EMAIL.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

const ORDEM = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao',
  'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
const CODIGO = {}; ORDEM.forEach((id, i) => { CODIGO[id] = 'P' + (i + 1); });
const respostasDe = (m) => { const r = {}; ORDEM.forEach((id, i) => { r[id] = { valor: (m >> i) & 1 ? 'sim' : 'nao' }; }); return r; };

/* Usa o código REAL para achar, entre as 65.536 combinações, respostas que dão cada camada */
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
  const src = SRC_AVP.slice(0, fim) + '\nwindow.__avpTeste = { computeResultado: computeResultado };\n' + SRC_AVP.slice(fim);
  vm.runInContext(src, ctx, { filename: 'avaliacao-produto.js' });
  return ctx.__avpTeste;
}
const av = carregarCodigo();
/* Primeira combinação de respostas que dá a camada pedida (e, se pedido, que satisfaz `serve`). */
function acharCamada(id, serve) {
  for (let m = 0; m < 65536; m++) {
    const c = av.computeResultado({ respostas: respostasDe(m) });
    if (c.camadaSugerida.id === id && (!serve || serve(c))) return { m, c };
  }
  throw new Error('nenhuma combinação dá ' + id);
}

/* `cad` = { especializacaoCadastrada, papelEstruturalCadastrado } — o cálculo usa o PRÓPRIO motor, como o app. */
function itemDe(nome, camadaId, extra, cad, serve) {
  const { m } = acharCamada(camadaId, serve);
  const respostas = respostasDe(m);
  const c = av.computeResultado(Object.assign({ respostas: respostas }, cad || {}));
  ORDEM.forEach((id) => { Object.assign(respostas[id], { justificativaAuto: 'interpretação', observacao: '', codigoPergunta: CODIGO[id], textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 }); });
  return Object.assign({
    nome: nome, descricao: '', publico: '', necessidade: '', observacoesGerais: '',
    status: 'concluido', respostas: respostas,
    resultadoAutomatico: c.resultadoAutomatico, decisaoFinal: c.resultadoAutomatico, decisaoManual: false, decisaoConfirmada: false,
    camadaSugerida: JSON.parse(JSON.stringify(c.camadaSugerida)),
    justificativaAutomatica: 'justificativa gerada', criteriosEssenciaisFalhos: [], exclusoesConflitantes: null, criteriosAtendidos: 5,
    motorVersion: MOTOR_VERSION, motorVersionArquitetura: 1, questionnaireContentVersion: 1,
    criadoEm: '2026-09-29T10:00:00.000Z', atualizadoEm: '2026-09-29T10:00:00.000Z',
    responsavel: { name: 'Teste', email: EMAIL }, versao: 1, versaoAnteriorKey: null, excluido: false, itemId: nome
  }, cad || {}, extra || {});
}
const CAD = { especializacaoCadastrada: 'Instituto previdenciário', papelEstruturalCadastrado: 'essencial' };
const ESP_DERIVADA = 'Opção/configuração de personalização';
const AVALIACOES = () => {
  const ok = {
    /* decisão MANUAL (diverge da recomendação do sistema) — para a reavaliação */
    man: itemDe('Item Manual', 'componente', { decisaoManual: true, decisaoFinal: 'produto', decisaoConfirmada: true, justificativaDecisao: 'Decidido por pessoa.',
      alteradoPor: { name: 'Fulana', email: 'f@previ.com.br' }, alteradoEm: '2026-09-30T10:00:00.000Z' }),
    /* decisão automática, sem curadoria — para a reavaliação sem decisão manual */
    auto: itemDe('Item Automatico', 'canal'),
    /* legado: sem decisaoFinal, mas com resultadoAutomatico "produto" */
    leg: itemDe('Item Legado', 'produto-principal'),
    /* sem decisaoFinal E sem resultadoAutomatico */
    sem: itemDe('Item Sem Decisao', 'canal'),
    /* Componente cuja especialização só vem do questionário (nada cadastrado) */
    der: itemDe('Item Derivado', 'componente', null, null, (c) => c.camadaSugerida.especializacao === ESP_DERIVADA),
    /* Componente com especialização e papel CADASTRADOS por alguém */
    cadx: itemDe('Item Cadastrado', 'componente', null, CAD),
    /* camada mudou (Canal não admite especialização nem papel): o cadastro antigo ficou inaplicável */
    orf: itemDe('Item Orfao', 'canal', null, CAD),
    /* par v1 (cadastrada) → v2 (vigente), para ver a v1 em modo SÓ LEITURA */
    cad: itemDe('Item Par', 'componente', { itemId: 'par' }, CAD),
    par2: itemDe('Item Par', 'componente', { itemId: 'par', versao: 2, versaoAnteriorKey: 'cad', criadoEm: '2026-09-30T09:00:00.000Z', atualizadoEm: '2026-09-30T09:00:00.000Z' })
  };
  delete ok.leg.decisaoFinal;
  delete ok.sem.decisaoFinal; delete ok.sem.resultadoAutomatico;
  return ok;
};
(function () {
  const a = AVALIACOES(); /* valida as fixtures */
  if (a.der.camadaSugerida.especializacao !== ESP_DERIVADA) throw new Error('fixture "der" sem especialização derivada');
  if (a.cadx.camadaSugerida.especializacao !== CAD.especializacaoCadastrada || a.cadx.camadaSugerida.papelEstrutural !== 'Essencial') throw new Error('fixture "cadx" inválida');
  if (a.orf.camadaSugerida.especializacao || a.orf.camadaSugerida.papelEstrutural) throw new Error('fixture "orf" inválida');
  if (a.leg.resultadoAutomatico !== 'produto' || a.man.resultadoAutomatico === 'produto') throw new Error('fixture de decisão inválida');
})();

async function abrir(browser, o) {
  o = o || {};
  const admins = {}; admins[KEY] = { email: EMAIL };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {},
    'turmas-checkin': {}, 'turmas-espera': {}, 'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {},
    eventos: {}, 'turmas-publico': {}, 'eventos-publico': {}, 'avaliacoes-produto': o.avaliacoes || AVALIACOES(), 'avaliacoes-squad': {},
    'motor-squad-config': {}, 'motor-squad-auditoria': {}, 'motor-arquitetura-auditoria': {} };
  const cfg = { db: db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true, fail: o.fail, delays: o.delays };
  const ctx = await browser.newContext({ viewport: o.viewport || DESKTOP, acceptDownloads: true });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
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
  await page.waitForTimeout(800);
  await page.waitForSelector('#avpNovoBtn', { timeout: 8000 });
  await page.waitForTimeout(300);
  return { ctx, page, erros };
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const aparece = (page, sel, ms) => page.waitForSelector(sel, { timeout: ms || 2500 }).then(() => true).catch(() => false);
async function abrirResultado(page, key) {
  await page.click('.avp-act-ver[data-key="' + key + '"]');
  await page.waitForSelector('#avpCuradoriaCard, #avpCuradoriaLeitura', { timeout: 6000 });
  await page.waitForFunction(() => { const s = document.getElementById('avpNaturezaComplementar'); return !s || !s.disabled; }, { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(200);
}
async function voltar(page) { await page.click('#avpVoltarListaResultado'); await page.waitForSelector('#avpNovoBtn'); await page.waitForTimeout(200); }
async function gerarPdf(page) {
  await page.evaluate(() => { window.__pdfs = []; });
  await Promise.all([page.waitForEvent('download', { timeout: 60000 }).catch(() => null), page.click('#avpGerarPdfBtn')]);
  await page.waitForTimeout(500);
  return page.evaluate(() => { const t = []; (window.__pdfs || []).forEach((b) => { if (t.indexOf(b.tudo) === -1) t.push(b.tudo); }); return t.join('\n').replace(/\s+/g, ' '); });
}
async function lerExcel(page) {
  await page.click('#avpExportarBtn');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#avpExportarExcelTodas')]);
  const arq = path.join(require('os').tmpdir(), 'avp-coerencia-' + Date.now() + '.xlsx');
  await dl.saveAs(arq);
  const wb = XLSX.read(fs.readFileSync(arq), { type: 'buffer' });
  const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  const hist = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[2]] || wb.Sheets[wb.SheetNames[wb.SheetNames.length - 1]], { header: 1 });
  fs.unlinkSync(arq);
  const celula = (nome, coluna) => { const l = linhas.find((x) => x[1] === nome); const i = linhas[0].indexOf(coluna); return (l && i !== -1) ? (l[i] || '') : null; };
  const celulaHist = (chave, coluna) => { const l = hist.find((x) => x[1] === chave); const i = hist[0].indexOf(coluna); return (l && i !== -1) ? (l[i] || '') : null; };
  return { linhas, hist, celula, celulaHist };
}
const textoDecisao = (page) => page.locator('#avpDecisaoResumo, #avpDecisaoLeitura').first().innerText();
const auditoriaDe = async (page, key) => Object.values(((await banco(page))['curadoria-auditoria'] || {})[key] || {}).sort((a, b) => String(a.dataHora).localeCompare(String(b.dataHora)));
const NAO_PRODUTO = /Não é Produto\/Serviço principal/;

(async () => {
  const browser = await chromium.launch();

  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros } = await abrir(browser, { viewport });

    /* ================= 2. DECISÃO FINAL: uma regra só ================= */
    console.log('\n== 2. Registro legado SEM decisaoFinal: vale a recomendação do sistema ==');
    await abrirResultado(page, 'leg');
    let t = await textoDecisao(page);
    afirma(/Decisão final\s*É Produto\/Serviço principal/.test(t), 'tela: Decisão final = "É Produto/Serviço principal" (veio de resultadoAutomatico)');
    const pdfLeg = await gerarPdf(page);
    afirma(/Decisão final É Produto\/Serviço principal/.test(pdfLeg), 'PDF: Decisão final = "É Produto/Serviço principal"');
    afirma(!NAO_PRODUTO.test(pdfLeg), 'PDF: nada de "Não é Produto/Serviço principal" inventado');
    await voltar(page);

    console.log('\n== 2. Registro sem decisaoFinal E sem resultado: nunca vira "Não é Produto/Serviço" ==');
    await abrirResultado(page, 'sem');
    t = await textoDecisao(page);
    afirma(/Decisão final\s*—/.test(t) && !/Decisão final\s*Não é Produto/.test(t), 'tela: Decisão final = "—"');
    const pdfSem = await gerarPdf(page);
    afirma(/Decisão final —/.test(pdfSem) && !/Decisão final Não é Produto/.test(pdfSem), 'PDF: Decisão final = "—"');
    await voltar(page);

    console.log('\n== 2. Lista, Excel (Resumo e Histórico) usam a mesma regra ==');
    if (!(await page.locator('#avpFiltrosPainel').count())) await page.click('#avpFiltrosBtn');
    await page.waitForSelector('#avpFiltrosPainel');
    await page.selectOption('#avpFiltroResultado', 'produto');
    await page.waitForTimeout(200);
    afirma(await page.locator('.avp-act-ver[data-key="leg"]').count() === 1, 'lista: o filtro "É Produto/Serviço" inclui o legado (decisão resolvida = produto)');
    await page.selectOption('#avpFiltroResultado', 'nao-produto');
    await page.waitForTimeout(200);
    afirma(await page.locator('.avp-act-ver[data-key="leg"]').count() === 0, 'lista: o filtro "Não é Produto/Serviço" NÃO inclui o legado');
    await page.selectOption('#avpFiltroResultado', 'todos');
    await page.waitForTimeout(200);
    const ex = await lerExcel(page);
    afirma(ex.celula('Item Legado', 'Decisão final') === 'É Produto/Serviço principal', 'Excel (Resumo): legado → "É Produto/Serviço principal" (era: ' + ex.celula('Item Legado', 'Decisão final') + ')');
    afirma(ex.celulaHist('leg', 'Decisão final') === 'É Produto/Serviço principal', 'Excel (Histórico): legado → "É Produto/Serviço principal" (era: ' + ex.celulaHist('leg', 'Decisão final') + ')');
    afirma(ex.celula('Item Sem Decisao', 'Decisão final') === '' && ex.celulaHist('sem', 'Decisão final') === '', 'Excel: sem decisão nem resultado → célula vazia (nunca "Não é Produto/Serviço")');

    /* ================= 3. CURADORIA × FORMA DA DECISÃO ================= */
    console.log('\n== 3a. Especialização só DERIVADA do questionário ==');
    await abrirResultado(page, 'der');
    t = await textoDecisao(page);
    afirma(/Forma da decisão\s*Recomendação do sistema aceita\s*$/.test(t.trim()) || (/Forma da decisão\s*Recomendação do sistema aceita/.test(t) && !/complementações/.test(t)), 'tela: Forma da decisão = "Recomendação do sistema aceita" (derivado não é curadoria)');
    afirma(await page.locator('#avpEspecializacaoCadastrada').inputValue() === '', 'tela: o campo de Especialização (curadoria registrada) está vazio');
    const classif = await page.locator('.avp-alt-card').first().innerText();
    afirma(new RegExp('Especialização identificada pelo questionário:?\\s*' + ESP_DERIVADA.replace(/[/]/g, '\\/')).test(classif), 'tela: a derivada aparece à parte, no cartão da Classificação ("identificada pelo questionário")');
    const pdfDer = await gerarPdf(page);
    afirma(!/Curadoria arquitetural/.test(pdfDer), 'PDF: sem curadoria registrada, não há bloco "Curadoria arquitetural"');
    afirma(new RegExp('Especialização identificada pelo questionário:?\\s*' + ESP_DERIVADA.replace(/[/]/g, '\\/')).test(pdfDer), 'PDF: a derivada aparece à parte, na Classificação');
    afirma(/Forma da decisão Recomendação do sistema aceita(?! com)/.test(pdfDer), 'PDF: Forma da decisão = "Recomendação do sistema aceita"');
    await voltar(page);
    afirma(ex.celula('Item Derivado', 'Especialização') === '' && ex.celula('Item Derivado', 'Forma da decisão') === 'Recomendação do sistema aceita', 'Excel: Especialização (curadoria) em branco e Forma = "Recomendação do sistema aceita"');
    afirma(ex.celula('Item Derivado', 'Especialização identificada pelo questionário') === ESP_DERIVADA, 'Excel: coluna própria "Especialização identificada pelo questionário" traz o valor derivado');

    console.log('\n== 3b. Especialização e papel CADASTRADOS por alguém ==');
    await abrirResultado(page, 'cadx');
    t = await textoDecisao(page);
    afirma(/Forma da decisão\s*Recomendação do sistema aceita/.test(t) && !/complementações/.test(t), 'tela: Forma da decisão = "Recomendação do sistema aceita" (a Curadoria registrada não entra na Forma)');
    afirma(await page.locator('#avpEspecializacaoCadastrada').inputValue() === 'Instituto previdenciário' && await page.locator('#avpPapelEstruturalCadastrado').inputValue() === 'essencial', 'tela: os campos mostram o que foi cadastrado');
    afirma(!/identificada pelo questionário/.test(await page.locator('.avp-alt-card').first().innerText()), 'tela: valor registrado não é repetido como "derivado" na Classificação');
    const pdfCad = await gerarPdf(page);
    afirma(/Curadoria arquitetural Especialização Instituto previdenciário Papel estrutural Essencial/.test(pdfCad), 'PDF: bloco Curadoria com Especialização e Papel estrutural');
    afirma(/Forma da decisão Recomendação do sistema aceita(?! com)/.test(pdfCad) && !/identificada pelo questionário/.test(pdfCad), 'PDF: Forma sem citar Curadoria; sem linha "derivada"');
    await voltar(page);
    afirma(ex.celula('Item Cadastrado', 'Especialização') === 'Instituto previdenciário' && ex.celula('Item Cadastrado', 'Papel estrutural') === 'Essencial' && ex.celula('Item Cadastrado', 'Forma da decisão') === 'Recomendação do sistema aceita', 'Excel: Especialização e Papel batem com a tela; a Forma não cita Curadoria');
    afirma(ex.celula('Item Cadastrado', 'Especialização identificada pelo questionário') === '', 'Excel: coluna "identificada pelo questionário" vazia quando há cadastro');

    console.log('\n== 3c. Camada mudou: cadastro antigo ficou inaplicável ==');
    await abrirResultado(page, 'orf');
    t = await textoDecisao(page);
    afirma(/Forma da decisão\s*Recomendação do sistema aceita/.test(t) && !/complementações/.test(t), 'tela: Forma = "Recomendação do sistema aceita" (cadastro inaplicável não conta)');
    afirma(await page.locator('#avpEspecializacaoCadastrada').count() === 0 && await page.locator('#avpPapelEstruturalCadastrado').count() === 0, 'tela: a camada não admite os campos, e eles não aparecem');
    const pdfOrf = await gerarPdf(page);
    afirma(!/Curadoria arquitetural/.test(pdfOrf) && !/Instituto previdenciário/.test(pdfOrf), 'PDF: sem bloco Curadoria nem o valor inaplicável');
    afirma(/Forma da decisão Recomendação do sistema aceita(?! com)/.test(pdfOrf), 'PDF: Forma = "Recomendação do sistema aceita"');
    await voltar(page);
    afirma(ex.celula('Item Orfao', 'Especialização') === '' && ex.celula('Item Orfao', 'Papel estrutural') === '' && ex.celula('Item Orfao', 'Forma da decisão') === 'Recomendação do sistema aceita', 'Excel: Especialização e Papel em branco; Forma = "Recomendação do sistema aceita"');
    const regOrf = (await banco(page))['avaliacoes-produto'].orf;
    afirma(regOrf.especializacaoCadastrada === CAD.especializacaoCadastrada && regOrf.papelEstruturalCadastrado === 'essencial', 'banco: o cadastro antigo continua gravado (nada foi apagado)');

    console.log('\n== 3d. Versão anterior (SÓ LEITURA) mostra só o registrado ==');
    await abrirResultado(page, 'par2');
    await page.click('.avp-hist-abrir[data-key="cad"]');
    await page.waitForSelector('#avpCuradoriaLeitura', { timeout: 6000 });
    const leit = await page.locator('#avpCuradoriaResumo').innerText().catch(() => '');
    afirma(/Especialização\s*Instituto previdenciário/.test(leit) && /Papel estrutural\s*Essencial/.test(leit), 'leitura: Curadoria mostra o que foi registrado');
    afirma(/Forma da decisão\s*Recomendação do sistema aceita/.test(await textoDecisao(page)) && !/complementações/.test(await textoDecisao(page)), 'leitura: Forma da decisão sem citar Curadoria');
    await page.click('#avpVoltarListaResultado').catch(() => {});
    await page.waitForSelector('#avpNovoBtn', { timeout: 6000 }).catch(() => {});
    afirma(await larguraOk(page), 'sem rolagem horizontal');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  /* ================= 1. REAVALIAÇÃO × DECISÃO MANUAL ================= */
  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n== 1. Reavaliação de item com decisão manual — ' + nomeTela + ' ==');
    const { ctx, page, erros } = await abrir(browser, { viewport });
    const antes = await banco(page);
    await abrirResultado(page, 'man');
    await page.click('#avpReavaliarBtn');
    const modal = await aparece(page, '.modal-box .avp-modal-confirm-btn');
    afirma(modal, 'antes de criar a nova versão, a tela pede confirmação');
    const aviso = modal ? await page.locator('.modal-box').last().innerText() : '';
    afirma(/nova versão/i.test(aviso) && /v2/.test(aviso), 'o aviso diz que será criada uma nova versão (v2)');
    afirma(/decisão manual/i.test(aviso) && /v1/.test(aviso) && /preservad/i.test(aviso), 'o aviso diz que a decisão manual da v1 continua preservada naquela versão');
    afirma(/recomendação do sistema/i.test(aviso) && /nova decisão arquitetural/i.test(aviso), 'o aviso diz que a nova versão começa pela recomendação do sistema e exige nova decisão arquitetural');
    if (modal) {
      const caixa = await page.locator('.modal-box').last().boundingBox();
      afirma(caixa && caixa.x >= 0 && caixa.x + caixa.width <= viewport.width + 1, 'o aviso cabe na tela (' + viewport.width + 'px)');
      await page.click('.avp-modal-cancel-btn');
      await page.waitForTimeout(300);
    }
    let b = await banco(page);
    afirma(JSON.stringify(b['avaliacoes-produto']) === JSON.stringify(antes['avaliacoes-produto']) && !b['curadoria-auditoria'] && await page.locator('#avpConcluirBtn').count() === 0, 'cancelar não cria nada: nem avaliação, nem auditoria, nem checklist');

    await page.click('#avpReavaliarBtn', { timeout: 3000 }).catch(() => {}); /* no código antigo o 1º clique já abriu o checklist */
    if (await aparece(page, '.avp-modal-confirm-btn', 800)) await page.click('.avp-modal-confirm-btn');
    const checklist = await aparece(page, '#avpConcluirBtn', 4000);
    afirma(checklist, 'confirmando, abre a reavaliação (checklist)');
    if (checklist) {
      await page.click('#avpConcluirBtn');
      await page.waitForSelector('#avpVoltarListaResultado', { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(400);
    }
    b = await banco(page);
    const novas = Object.keys(b['avaliacoes-produto']).filter((k) => !antes['avaliacoes-produto'][k]);
    afirma(novas.length === 1, 'nasceu UMA avaliação nova');
    const v2 = b['avaliacoes-produto'][novas[0]] || {};
    afirma(JSON.stringify(b['avaliacoes-produto'].man) === JSON.stringify(antes['avaliacoes-produto'].man), 'a v1 ficou IDÊNTICA: a decisão manual, a justificativa, o autor e a data continuam nela');
    afirma(v2.versao === 2 && v2.versaoAnteriorKey === 'man', 'v2 aponta para a v1');
    afirma(v2.decisaoManual === false && v2.decisaoFinal === v2.resultadoAutomatico && !v2.justificativaDecisao && !v2.alteradoPor && !v2.alteradoEm && v2.decisaoConfirmada === false, 'a v2 NÃO herdou a decisão manual: começa pela recomendação do sistema, sem justificativa, autor nem data, e sem decisão confirmada');
    const aud = await auditoriaDe(page, novas[0]);
    const linha = aud.find((x) => x.reavaliacao);
    afirma(aud.length === 1 && !!linha, 'a v2 nasceu com UMA linha de auditoria própria (criada por reavaliação)');
    afirma(linha && linha.tipo === 'alteracao_decisao_final' && linha.reavaliacao.deKey === 'man' && linha.reavaliacao.deVersao === 1 && linha.reavaliacao.paraVersao === 2, 'a linha diz de qual versão veio (v1 → v2)');
    afirma(linha && linha.valorAnterior.decisaoManual === true && linha.valorAnterior.decisaoFinal === 'produto' && linha.valorNovo.decisaoManual === false, 'a linha registra a decisão da v1 (manual, produto) e que a v2 começa sem ela');
    afirma(linha && linha.usuario && linha.usuario.email === EMAIL && !isNaN(Date.parse(linha.dataHora)) && linha.origem === 'usuario', 'a linha traz usuário e data/hora');
    afirma(!(b['curadoria-auditoria'] || {}).man, 'a auditoria da v1 não foi tocada');
    /* tela da v2 */
    const nota = await page.locator('#avpDecisaoPendenteReav').innerText().catch(() => '');
    afirma(/v2/.test(nota) && /v1/.test(nota) && /preservad/i.test(nota) && /ainda não/i.test(nota), 'tela da v2: avisa que a decisão ainda não foi registrada e que a da v1 ficou preservada na v1');
    await page.locator('#avpDecisaoHistoricoDet summary').click();
    const hist = await page.locator('#avpDecisaoHistorico').innerText();
    afirma(/reavalia[çc][ãa]o da v1/i.test(hist) && /manual/i.test(hist), 'histórico da v2: "criada por reavaliação da v1", com a decisão manual da v1');
    afirma(await larguraOk(page), 'sem rolagem horizontal');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  console.log('\n== 1. Pela lista (menu ⋯) o aviso também aparece ==');
  {
    const { ctx, page, erros } = await abrir(browser, {});
    await page.click('.avp-act-mais[data-key="man"]');
    await page.click('.avp-menu-item[data-acao="reavaliar"]');
    afirma(await aparece(page, '.avp-modal-confirm-btn'), 'pelo menu da lista também pede confirmação para item com decisão manual');
    await page.click('.avp-modal-cancel-btn').catch(() => {});
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  console.log('\n== 1. Item SEM decisão manual: reavaliar segue direto, mas a v2 também registra a origem ==');
  {
    const { ctx, page, erros } = await abrir(browser, {});
    const antes = await banco(page);
    await abrirResultado(page, 'auto');
    await page.click('#avpReavaliarBtn');
    const modal = await aparece(page, '.avp-modal-confirm-btn', 800);
    afirma(!modal, 'sem decisão manual não há o que descartar: abre direto, sem pergunta extra');
    await page.waitForSelector('#avpConcluirBtn', { timeout: 4000 }).catch(() => {});
    await page.click('#avpConcluirBtn');
    await page.waitForSelector('#avpVoltarListaResultado', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);
    const b = await banco(page);
    const novas = Object.keys(b['avaliacoes-produto']).filter((k) => !antes['avaliacoes-produto'][k]);
    const aud = novas.length ? await auditoriaDe(page, novas[0]) : [];
    afirma(novas.length === 1 && aud.length === 1 && aud[0].reavaliacao && aud[0].reavaliacao.deKey === 'auto' && aud[0].valorAnterior.decisaoManual === false, 'a v2 tem a linha "criada por reavaliação da v1" (decisão anterior: recomendação aceita)');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  console.log('\n== 1. Atomicidade: se o banco recusar a auditoria, a v2 também não nasce ==');
  {
    const { ctx, page, erros } = await abrir(browser, { fail: ['curadoria-auditoria'] });
    const antes = await banco(page);
    await abrirResultado(page, 'man');
    await page.click('#avpReavaliarBtn');
    if (await aparece(page, '.avp-modal-confirm-btn', 800)) await page.click('.avp-modal-confirm-btn');
    await page.waitForSelector('#avpConcluirBtn', { timeout: 4000 }).catch(() => {});
    await page.click('#avpConcluirBtn', { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const b = await banco(page);
    afirma(Object.keys(b['avaliacoes-produto']).length === Object.keys(antes['avaliacoes-produto']).length && !b['curadoria-auditoria'], 'nada gravado: nem a v2, nem a auditoria');
    afirma(JSON.stringify(b['avaliacoes-produto'].man) === JSON.stringify(antes['avaliacoes-produto'].man), 'a v1 continua idêntica');
    await ctx.close();
  }

  await browser.close();
  console.log('\n============================');
  console.log(falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
