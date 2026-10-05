/* QUEBRA DE PÁGINA DO PDF — título/subtítulo nunca fica órfão no fim da página.
 *
 * Problema (real, medido no PDF baixado): "Como chegamos até aqui" e "Histórico de versões" ficavam no
 * fim da página 1 e a tabela de versões começava na 2. O html2pdf trata `page-break-after:avoid` em
 * h2/h3 como regra FRACA; o que de fato segura título e conteúdo juntos é o bloco indivisível
 * (`pdf-decisao-bloco`, o mesmo da Curadoria e da Decisão).
 *
 * O que se prova, hermeticamente, no HTML que vira PDF (a paginação em si é do html2pdf e depende de
 * canvas/fonte — o teste garante a ESTRUTURA que a impede de separar):
 *   - com histórico de versões: o título da seção, "Histórico de versões" e a tabela estão no MESMO bloco;
 *   - o subtítulo da trilha está no mesmo bloco do seu primeiro conteúdo (frase de aviso ou 1ª alteração);
 *   - sem histórico (versão única): título da seção + subtítulo da trilha + 1º conteúdo, juntos;
 *   - o CSS do bloco indivisível continua valendo;
 *   - conteúdo, nomes e ordem do PDF NÃO mudam (mesmo texto de antes).
 * Desktop e 375 px. Hermético: sem rede, sem segredo. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { arquivoTemporario } = require('./arquivo-temporario');
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
const SV = 'sem-vinculo';
const ESP = CAD.especializacaoCadastrada;
const ESP_DERIVADA = 'Opção/configuração de personalização';

const U = (name, email) => ({ name: name, email: email });
const AUDITORIA_CAD2 = {
  a1: { tipo: 'alteracao_decisao_final', avaliacaoId: 'cad2', valorAnterior: { decisaoFinal: 'nao-produto', decisaoManual: false, justificativa: null, confirmada: true },
    valorNovo: { decisaoFinal: null, decisaoManual: false, justificativa: null, confirmada: false, pendente: true }, origem: 'usuario',
    reavaliacao: { deKey: 'cad1', deVersao: 1, paraVersao: 2 }, usuario: U('Beltrana', 'b@previ.com.br'), dataHora: '2026-09-30T09:00:00.000Z' },
  a2: { tipo: 'alteracao_especializacao', avaliacaoId: 'cad2', valorAnterior: null, valorNovo: ESP, origem: 'usuario',
    usuario: U('Cicrana', 'c@previ.com.br'), dataHora: '2026-09-30T09:30:00.000Z' },
  a3: { tipo: 'alteracao_decisao_final', avaliacaoId: 'cad2', valorAnterior: { decisaoFinal: 'nao-produto', decisaoManual: false, justificativa: null, confirmada: true },
    valorNovo: { decisaoFinal: 'produto', decisaoManual: true, justificativa: 'Decidido por pessoa.', confirmada: true }, justificativa: 'Decidido por pessoa.', origem: 'usuario',
    usuario: U('Fulana', 'f@previ.com.br'), dataHora: '2026-09-30T10:00:00.000Z' },
  a4: { tipo: 'alteracao_especializacao', avaliacaoId: 'cad2', valorAnterior: ESP, valorNovo: ESP, confirmacao: true, camada: { id: 'componente', label: 'Componente' },
    origem: 'reprocessamento-automatico', reprocessamento: 'lote', motorVersion: 'motor-xyz', usuario: U('Dedé', 'd@previ.com.br'), dataHora: '2026-09-30T11:00:00.000Z' },
  /* autor sem nome (só e-mail): a exportação NUNCA mostra e-mail */
  a5: { tipo: 'alteracao_papel_estrutural', avaliacaoId: 'cad2', valorAnterior: null, valorNovo: 'essencial', origem: 'usuario',
    usuario: { email: 'sem-nome@previ.com.br' }, dataHora: '2026-09-30T12:00:00.000Z' }
};
const AUDITORIA_NAT_CAD2 = {
  n1: { tipo: 'alteracao_natureza_complementar', avaliacaoId: 'cad2', valorAnterior: null, valorNovo: { codigo: 'PROGRAMA', nome: 'Programa transversal' },
    usuario: U('Gigi', 'g@previ.com.br'), dataHora: '2026-09-30T09:45:00.000Z' }
};
const AVALIACOES = () => ({
  /* cadeia v1 → v2: mudou classificação, decisão e forma; v2 tem curadoria vigente + decisão manual */
  cad1: itemDe('Item Cadeia', 'canal', { itemId: 'cad', responsavel: { email: 'so-email@previ.com.br' } }),
  cad2: itemDe('Item Cadeia', 'componente', { itemId: 'cad', versao: 2, versaoAnteriorKey: 'cad1', decisaoManual: true, decisaoFinal: 'produto', decisaoConfirmada: true,
    justificativaDecisao: 'Decidido por pessoa.', alteradoPor: U('Fulana', 'f@previ.com.br'), alteradoEm: '2026-09-30T10:00:00.000Z',
    criadoEm: '2026-09-30T09:00:00.000Z', atualizadoEm: '2026-09-30T10:00:00.000Z' }, CAD),
  sc: itemDe('Item Sem Curadoria', 'canal'),
  rv: itemDe('Item A Revisar', 'componente', null, Object.assign({}, CAD, { especializacaoCamadaConfirmada: SV, papelEstruturalCamadaConfirmada: SV })),
  se: itemDe('Item Sem Efeito', 'canal', null, CAD),
  /* Componente cuja especialização só vem do questionário (nada cadastrado) */
  der: itemDe('Item Derivado', 'componente', null, null, (c) => c.camadaSugerida.especializacao === ESP_DERIVADA),
  /* reavaliação v1 (decisão manual) → v2 AINDA SEM decisão registrada */
  pend1: itemDe('Item Pendente', 'componente', { itemId: 'pend', decisaoManual: true, decisaoFinal: 'produto', decisaoConfirmada: true,
    justificativaDecisao: 'Decidido na v1.', alteradoPor: U('Fulana', 'f@previ.com.br'), alteradoEm: '2026-09-29T11:00:00.000Z' }),
  pend2: itemDe('Item Pendente', 'componente', { itemId: 'pend', versao: 2, versaoAnteriorKey: 'pend1', decisaoManual: false, decisaoConfirmada: false,
    criadoEm: '2026-09-30T09:00:00.000Z', atualizadoEm: '2026-09-30T09:00:00.000Z' })
});
const AUDITORIA = () => ({ 'curadoria-auditoria': { cad2: AUDITORIA_CAD2 }, 'naturezas-complementares-auditoria': { cad2: AUDITORIA_NAT_CAD2 } });
(function () {
  const a = AVALIACOES();
  if (a.cad1.camadaSugerida.id === a.cad2.camadaSugerida.id) throw new Error('fixture: v1 e v2 deveriam ter classificações diferentes');
  if (a.cad2.resultadoAutomatico === 'produto') throw new Error('fixture: a v2 precisa divergir da decisão (manual = produto)');
  if (a.der.camadaSugerida.especializacao !== ESP_DERIVADA) throw new Error('fixture: "der" sem especialização derivada');
  if (a.pend2.resultadoAutomatico === 'produto') throw new Error('fixture: pend2 precisa divergir da decisão manual da v1');
})();

async function abrir(browser, o) {
  o = o || {};
  const admins = {}; admins[KEY] = { email: EMAIL };
  const db = Object.assign({ turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {},
    'turmas-checkin': {}, 'turmas-espera': {}, 'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {},
    eventos: {}, 'turmas-publico': {}, 'eventos-publico': {}, 'avaliacoes-produto': AVALIACOES(), 'avaliacoes-squad': {},
    'motor-squad-config': {}, 'motor-squad-auditoria': {}, 'motor-arquitetura-auditoria': {} }, AUDITORIA());
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
        window.__pdfs.push({ tudo: doc.innerText, html: doc.outerHTML });
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
async function abrirFicha(page, key) {
  await page.click('.avp-act-ver[data-key="' + key + '"]');
  await page.waitForSelector('#avpGerarPdfBtn', { timeout: 6000 });
  await page.waitForTimeout(300);
}
async function voltar(page) {
  for (let i = 0; i < 4 && !(await page.locator('#avpNovoBtn').count()); i++) { await page.click('#avpVoltarListaResultado'); await page.waitForTimeout(300); }
  await page.waitForSelector('#avpNovoBtn'); await page.waitForTimeout(200);
}
async function gerarPdf(page) {
  await page.evaluate(() => { window.__pdfs = []; });
  await Promise.all([page.waitForEvent('download', { timeout: 90000 }).catch(() => null), page.click('#avpGerarPdfBtn')]);
  await page.waitForTimeout(500);
  return page.evaluate(() => { const t = []; (window.__pdfs || []).forEach((b) => { if (t.indexOf(b.tudo) === -1) t.push(b.tudo); }); return t.join('\n').replace(/\s+/g, ' '); });
}
const htmlPdf = (page) => page.evaluate(() => (window.__pdfs || []).map((b) => b.html).join('\n'));
async function lerExcel(page) {
  await page.click('#avpExportarBtn');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#avpExportarExcelTodas')]);
  const arq = arquivoTemporario('avp-trilha-', '.xlsx');
  await dl.saveAs(arq);
  const wb = XLSX.read(fs.readFileSync(arq), { type: 'buffer' });
  fs.unlinkSync(arq);
  const aba = (nome) => wb.Sheets[nome] ? XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, defval: '' }) : null;
  const resumo = aba('Resumo'), hist = aba('Histórico'), trilha = aba('Trilha');
  const cel = (linhas, colKey, chave, coluna) => { if (!linhas) return null; const l = linhas.find((x) => x[colKey] === chave); const i = linhas[0].indexOf(coluna); return (l && i !== -1) ? l[i] : null; };
  return { nomes: wb.SheetNames, resumo, hist, trilha,
    celResumo: (nome, coluna) => cel(resumo, 1, nome, coluna),
    celHist: (chave, coluna) => cel(hist, 1, chave, coluna),
    linhasTrilha: (chave) => (trilha || []).slice(1).filter((l) => l[1] === chave) };
}
const pos = (t, s) => t.indexOf(s);
const entre = (t, a, b) => { const i = t.indexOf(a); const j = t.indexOf(b, i + 1); return i === -1 ? '' : t.slice(i, j === -1 ? undefined : j); };
const rot = (r) => ({ produto: 'É Produto/Serviço principal', 'nao-produto': 'Não é Produto/Serviço principal', 'a-validar': 'A validar' }[r] || '');

const blocos = (page) => page.evaluate(() => {
  /* o último documento capturado de cada geração; usa todos e deduplica por conteúdo */
  const vistos = []; const docs = [];
  (window.__pdfs || []).forEach((b) => { if (vistos.indexOf(b.html) === -1) { vistos.push(b.html); docs.push(b.html); } });
  return docs;
});
/* Devolve, do primeiro documento que contém `titulo` como h2, os filhos do bloco que o contém (tags e textos). */
function filhosDoBloco(html, titulo) {
  const m = html.match(new RegExp('<div class="pdf-decisao-bloco"><h2 class="pdf-secao-titulo">' + titulo + '</h2>(.*?)</div>', 's'));
  return m ? m[1] : null;
}

(async () => {
  const browser = await chromium.launch();
  const A = AVALIACOES();
  let erros = 0;

  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros: errosPagina } = await abrir(browser, { viewport });

    console.log('\n== Item com histórico de versões (v2) ==');
    await abrirFicha(page, 'cad2');
    const texto = await gerarPdf(page);
    const htmls = (await blocos(page)).join('\n');
    const bloco = filhosDoBloco(htmls, 'Como chegamos até aqui');
    afirma(bloco !== null, 'o título "Como chegamos até aqui" abre um bloco indivisível (pdf-decisao-bloco)');
    afirma(!!bloco && bloco.indexOf('<h3 class="pdf-subsecao">Histórico de versões</h3>') === 0, 'no mesmo bloco, logo depois do título: o subtítulo "Histórico de versões"');
    afirma(!!bloco && /<h3 class="pdf-subsecao">Histórico de versões<\/h3><table class="pdf-tabela-versoes">/.test(bloco) && bloco.indexOf('</table>') !== -1, 'no mesmo bloco: a tabela de versões (título, subtítulo e tabela não se separam)');
    afirma(!!bloco && bloco.indexOf('Trilha da curadoria e da decisão') === -1, 'o bloco do histórico não engole a trilha (só título + subtítulo + tabela)');
    const trilha = htmls.match(/<div class="pdf-decisao-bloco"><h3 class="pdf-subsecao">Trilha da curadoria e da decisão<\/h3>(.*?)<\/div>/s);
    afirma(!!trilha && /<div class="pdf-trilha-item">/.test(trilha[1]), 'o subtítulo da trilha vem no mesmo bloco da sua 1ª alteração');
    afirma(/\.pdf-decisao-bloco\{page-break-inside:avoid;break-inside:avoid\}/.test(htmls), 'o CSS do bloco indivisível continua presente');
    const ordem = ['Como chegamos até aqui', 'Histórico de versões', 'Trilha da curadoria e da decisão', 'Respostas e evidências'].map((t) => texto.indexOf(t));
    afirma(ordem.every((i, k) => i !== -1 && (k === 0 || i > ordem[k - 1])), 'conteúdo e ordem iguais aos de antes: Como chegamos → Histórico de versões → Trilha → Respostas e evidências');
    afirma(/Versão Data Responsável Resultado Classificação Decisão final Forma da decisão O que mudou/.test(texto), 'a tabela de versões mantém as mesmas colunas');
    await voltar(page);

    console.log('\n== Item de versão única (sem histórico de versões) ==');
    await abrirFicha(page, 'sc');
    const t1 = await gerarPdf(page);
    const h1 = (await blocos(page)).join('\n');
    const b1 = filhosDoBloco(h1, 'Como chegamos até aqui');
    afirma(b1 !== null && b1.indexOf('<h3 class="pdf-subsecao">Trilha da curadoria e da decisão</h3>') === 0, 'título da seção + subtítulo da trilha no mesmo bloco indivisível');
    afirma(!!b1 && /<p>Nenhuma alteração registrada para esta versão\./.test(b1), 'e junto o 1º conteúdo (a frase de "nenhuma alteração")');
    afirma(!/Histórico de versões/.test(t1), 'sem histórico de versões, o subtítulo não aparece (como antes)');
    await voltar(page);

    console.log('\n== Trilha indisponível: o aviso também fica junto do subtítulo ==');
    await ctx.close();
    const falha = await abrir(browser, { viewport, fail: ['curadoria-auditoria'] });
    await abrirFicha(falha.page, 'cad2');
    await gerarPdf(falha.page);
    const hf = (await blocos(falha.page)).join('\n');
    const tf = hf.match(/<div class="pdf-decisao-bloco"><h3 class="pdf-subsecao">Trilha da curadoria e da decisão<\/h3>(.*?)<\/div>/s);
    afirma(!!tf && /Trilha indisponível/.test(tf[1]), 'subtítulo da trilha + "Trilha indisponível" no mesmo bloco');
    afirma(errosPagina.length === 0 && falha.erros.length === 0, 'sem erros de página'); erros += errosPagina.length + falha.erros.length;
    await falha.ctx.close();
  }

  await browser.close();
  console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
