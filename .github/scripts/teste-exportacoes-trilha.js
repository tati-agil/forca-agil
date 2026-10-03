/* TRILHA NO PDF E NO EXCEL — o documento exportado espelha a ficha e conta a história:
 *
 *   PDF  : Identificação → O que o sistema concluiu → O que uma pessoa complementou →
 *          O que uma pessoa decidiu → Como chegamos até aqui → Respostas e evidências.
 *          "Classificação arquitetural" NÃO entra na tabela da Decisão final.
 *          Sem curadoria vigente: frase explícita (o bloco não some). "a revisar"/"sem efeito":
 *          só uma nota secundária, sem despejar o valor antigo.
 *          Trilha HÍBRIDA: histórico de versões sempre dos dados gravados; a auditoria
 *          (quem/quando/anterior → novo) vem de uma leitura extra. Se ela falhar ou demorar,
 *          o PDF continua válido e diz "Trilha indisponível" — nunca finge uma trilha vazia.
 *   Excel: Resumo (estado vigente; "Responsável pela avaliação", "Data da avaliação",
 *          "Situação da curadoria", "Versão do motor"), Histórico (uma linha por versão, colunas
 *          anterior/atual separadas + "Resumo da mudança") e Trilha (uma linha por alteração).
 * Mesmas funções da ficha — nenhuma segunda interpretação. Hermético: sem rede, sem segredo. */
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
  const arq = path.join(require('os').tmpdir(), 'avp-trilha-' + Date.now() + '.xlsx');
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

(async () => {
  const browser = await chromium.launch();
  const A = AVALIACOES();
  const L1 = A.cad1.camadaSugerida.label, L2 = A.cad2.camadaSugerida.label;
  const MUDOU = 'Classificação: ' + L1 + ' → ' + L2 + '; Decisão final: ' + rot(A.cad1.resultadoAutomatico) + ' → ' + rot('produto') + '; Forma da decisão: Recomendação do sistema aceita → Decisão manual';
  let totalErros = 0;

  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros } = await abrir(browser, { viewport });

    console.log('\n== PDF da v2 (curadoria vigente + decisão manual + trilha) ==');
    await abrirFicha(page, 'cad2');
    const p = await gerarPdf(page);
    const ordem = ['Identificação da avaliação', 'O que o sistema concluiu', 'O que uma pessoa complementou', 'O que uma pessoa decidiu', 'Como chegamos até aqui', 'Respostas e evidências'];
    const idx = ordem.map((s) => pos(p, s));
    afirma(idx.every((i) => i !== -1) && idx.every((i, k) => k === 0 || i > idx[k - 1]), 'PDF: seções na ordem da ficha (Identificação → sistema → pessoa complementou → decidiu → como chegamos → evidências) — posições ' + idx.join(','));
    afirma(pos(p, 'Critérios principais') > pos(p, 'Respostas e evidências'), 'PDF: as perguntas/evidências vêm por último');
    const blocoSistema = entre(p, 'O que o sistema concluiu', 'O que uma pessoa complementou');
    afirma(/Resultado sobre Produto\/Serviço/.test(blocoSistema) && new RegExp('Classificação arquitetural ' + L2).test(blocoSistema) && /Justificativa da classificação/.test(blocoSistema), 'PDF: "O que o sistema concluiu" traz Resultado, Classificação e Justificativa');
    const blocoCur = entre(p, 'O que uma pessoa complementou', 'O que uma pessoa decidiu');
    afirma(/Especialização Instituto previdenciário/.test(blocoCur) && /Papel estrutural Essencial/.test(blocoCur), 'PDF: "O que uma pessoa complementou" mostra só a curadoria vigente');
    afirma(!/Nenhuma informação de curadoria/.test(blocoCur), 'PDF: com curadoria vigente, a frase de "nenhuma" não aparece');
    const blocoDec = entre(p, 'O que uma pessoa decidiu', 'Como chegamos até aqui');
    afirma(/Recomendação do sistema .* Decisão final É Produto\/Serviço principal Forma da decisão Decisão manual Justificativa da decisão manual Decidido por pessoa\. Responsável pela decisão Fulana/.test(blocoDec), 'PDF: decisão = Recomendação → Decisão final → Forma → justificativa/responsável (manual)');
    afirma(!/Classificação arquitetural/.test(blocoDec), 'PDF: "Classificação arquitetural" NÃO está na tabela da Decisão final');
    const blocoHist = entre(p, 'Como chegamos até aqui', 'Respostas e evidências');
    afirma(/Histórico de versões/.test(blocoHist) && /O que mudou/.test(blocoHist) && blocoHist.indexOf(MUDOU) !== -1, 'PDF: histórico de versões com "O que mudou" (v1 → v2): ' + MUDOU);
    afirma(!/Resultado anterior|Classificação anterior|Decisão anterior/.test(blocoHist), 'PDF: só UMA coluna "O que mudou" (nada de colunas anterior/atual no PDF)');
    afirma(/Trilha da curadoria e da decisão/.test(blocoHist), 'PDF: seção "Trilha da curadoria e da decisão"');
    afirma(/Especialização: — → Instituto previdenciário/.test(blocoHist) && /Cicrana/.test(blocoHist), 'PDF: trilha — Especialização (anterior → novo) e quem alterou');
    afirma(/Decisão final: Não é Produto\/Serviço principal \(recomendação aceita\) → É Produto\/Serviço principal \(manual\)/.test(blocoHist) && /Justificativa: "Decidido por pessoa\."/.test(blocoHist) && /Fulana/.test(blocoHist), 'PDF: trilha — Decisão final (anterior → novo), justificativa e quem decidiu');
    afirma(/Nova versão criada por reavaliação da v1 \(v2\) por Beltrana/.test(blocoHist), 'PDF: trilha — criada por reavaliação');
    afirma(/Natureza complementar: — → Programa transversal/.test(blocoHist) && /Gigi/.test(blocoHist), 'PDF: trilha — Natureza complementar (lida da outra auditoria)');
    afirma(/Especialização confirmada/.test(blocoHist) && /Reprocessamento automático em lote — motor motor-xyz/.test(blocoHist), 'PDF: trilha — confirmação por reprocessamento automático em lote, com o motor');
    afirma(!/Trilha indisponível/.test(p), 'PDF: com a auditoria lida, não há "Trilha indisponível"');
    afirma(!/Abrangência/i.test(p), 'PDF: "Abrangência" não voltou');
    const h = await htmlPdf(page);
    afirma(h.indexOf('<h2 class="pdf-secao-titulo">Classificação arquitetural</h2>') !== -1 && h.indexOf('<h3 class="pdf-subsecao">Classificação arquitetural</h3>') === -1, 'PDF: "Classificação arquitetural" é um BLOCO PRÓPRIO (título de seção, não subtítulo do resultado)');
    afirma(/<h2 class="pdf-secao-titulo">Classificação arquitetural<\/h2><div class="pdf-decisao-bloco">/.test(h), 'PDF: o bloco da Classificação é indivisível (pdf-decisao-bloco: título e conteúdo não se separam na quebra de página)');
    const iRes = pos(p, 'O que o sistema concluiu'), iCla = p.indexOf('Classificação arquitetural ' + L2), iCom = pos(p, 'O que uma pessoa complementou');
    afirma(iRes !== -1 && iRes < iCla && iCla < iCom, 'PDF: ordem Resultado → Classificação arquitetural (bloco próprio) → Curadoria');
    const blocoRes = entre(p, 'O que o sistema concluiu', 'Classificação arquitetural');
    afirma(/Resultado sobre Produto\/Serviço/.test(blocoRes) && /Justificativa da classificação/.test(blocoRes) && blocoRes.indexOf(L2) === -1, 'PDF: o bloco do Resultado traz o resultado e a justificativa, sem a classificação');
    afirma(!/@/.test(p), 'PDF: nenhum e-mail (autor sem nome aparece como "—")');
    afirma(/<th>Versão<\/th><th>Data<\/th><th>Responsável<\/th><th>Resultado<\/th><th>Classificação<\/th><th>Decisão final<\/th><th>Forma da decisão<\/th><th>O que mudou<\/th>/.test(h), 'PDF: tabela de versões com Resultado e Forma da decisão (além de Decisão final e classificação)');
    afirma(/Recomendação do sistema aceita/.test(blocoHist) && /Decisão manual/.test(blocoHist), 'PDF: a tabela de versões mostra a Forma de cada versão (v1 aceita; v2 manual)');

    console.log('\n== PDF da v1: histórico de versões também aparece (item com cadeia) e sem trilha gravada ==');
    await page.click('.avp-hist-abrir[data-key="cad1"]');
    await page.waitForSelector('#avpAvisoVersaoAnterior', { timeout: 6000 });
    await page.waitForTimeout(300);
    const p1 = await gerarPdf(page);
    const h1 = entre(p1, 'Como chegamos até aqui', 'Respostas e evidências');
    afirma(/Histórico de versões/.test(h1), 'PDF v1: mostra o histórico de versões do item');
    afirma(/Nenhuma alteração registrada/.test(h1) && !/Trilha indisponível/.test(h1), 'PDF v1: sem auditoria gravada → "Nenhuma alteração registrada" (lido com sucesso, vazio de verdade)');
    await voltar(page);

    await voltar(page);
    console.log('\n== PDF: Classificação com especialização identificada e relação ==');
    await abrirFicha(page, 'der');
    const pd = await gerarPdf(page);
    const bd = entre(pd, 'Classificação arquitetural', 'O que uma pessoa complementou');
    afirma(new RegExp('Componente.*Especialização identificada pelo questionário: ' + ESP_DERIVADA.replace(/[/]/g, '\\/')).test(bd) && /Relação arquitetural:/.test(bd), 'PDF: o bloco da Classificação traz a classificação, a especialização identificada e a relação');
    afirma(!/Especialização identificada/.test(entre(pd, 'O que uma pessoa complementou', 'O que uma pessoa decidiu')), 'PDF: a especialização identificada NÃO entra na Curadoria');
    await voltar(page);

    console.log('\n== PDF e ficha: versão AINDA SEM decisão registrada ==');
    await abrirFicha(page, 'pend2');
    const tela = await page.locator('#avpSecaoDecisao').innerText();
    afirma(/Forma da decisão\s*Sem decisão registrada/i.test(tela) && /ainda não tem decisão arquitetural registrada: vale a recomendação do sistema até alguém decidir/.test(tela), 'ficha: Forma = "Sem decisão registrada" + o aviso já consolidado (mesma redação)');
    afirma(!/Forma da decisão\s*Recomendação do sistema aceita/i.test(tela), 'ficha: não parece que a recomendação foi aceita');
    const pp = await gerarPdf(page);
    const dp = entre(pp, 'O que uma pessoa decidiu', 'Como chegamos até aqui');
    afirma(/Decisão final .* Forma da decisão Sem decisão registrada/.test(dp), 'PDF: Forma da decisão = "Sem decisão registrada"');
    afirma(!/Recomendação do sistema aceita/.test(dp), 'PDF: não parece que a recomendação foi aceita');
    afirma(/ainda não tem decisão arquitetural registrada: vale a recomendação do sistema até alguém decidir/.test(dp) && /A decisão manual da v1 continua preservada na v1 e não foi herdada/.test(dp), 'PDF: a mesma frase da ficha, no bloco da decisão');
    afirma(/Forma da decisão: Decisão manual → Sem decisão registrada/.test(entre(pp, 'Como chegamos até aqui', 'Respostas e evidências')), 'PDF: o histórico de versões mostra a mudança "Decisão manual → Sem decisão registrada"');
    await voltar(page);

    console.log('\n== PDF sem curadoria / a revisar / sem efeito ==');
    await abrirFicha(page, 'sc');
    const ps = await gerarPdf(page);
    const cs = entre(ps, 'O que uma pessoa complementou', 'O que uma pessoa decidiu');
    afirma(/Nenhuma informação de curadoria registrada nesta versão\./.test(cs), 'PDF: sem curadoria → frase explícita (o bloco não some)');
    afirma(!/revisão|sem efeito/.test(cs), 'PDF: sem nada anterior, nenhuma nota secundária');
    afirma(!/Histórico de versões/.test(ps), 'PDF: item de uma versão só não ganha histórico de versões');
    await voltar(page);
    await abrirFicha(page, 'rv');
    const pr = await gerarPdf(page);
    const cr = entre(pr, 'O que uma pessoa complementou', 'O que uma pessoa decidiu');
    afirma(/Nenhuma informação de curadoria registrada nesta versão\./.test(cr) && /Há informações anteriores disponíveis para revisão/.test(cr), 'PDF: "a revisar" → frase de nenhuma + nota "Há informações anteriores disponíveis para revisão"');
    afirma(!/Instituto previdenciário|Essencial/.test(pr.slice(0, pos(pr, 'Respostas e evidências'))), 'PDF: o valor antigo NÃO é despejado');
    await voltar(page);
    await abrirFicha(page, 'se');
    const pe = await gerarPdf(page);
    const ce = entre(pe, 'O que uma pessoa complementou', 'O que uma pessoa decidiu');
    afirma(/Nenhuma informação de curadoria registrada nesta versão\./.test(ce) && /Há informação de curadoria anterior sem efeito nesta versão\./.test(ce), 'PDF: "sem efeito" → frase de nenhuma + nota "Há informação de curadoria anterior sem efeito nesta versão."');
    afirma(!/Instituto previdenciário|Essencial/.test(pe.slice(0, pos(pe, 'Respostas e evidências'))), 'PDF: o valor sem efeito NÃO é despejado');

    await voltar(page);
    console.log('\n== Excel ==');
    const ex = await lerExcel(page);
    afirma(JSON.stringify(ex.nomes) === JSON.stringify(['Resumo', 'Respostas do questionário', 'Histórico', 'Trilha']), 'Excel: abas = Resumo, Respostas do questionário, Histórico, Trilha (' + ex.nomes.join(' | ') + ')');
    const cab = ex.resumo[0];
    afirma(cab.includes('Responsável pela avaliação') && cab.includes('Data da avaliação') && !cab.includes('Responsável') && !cab.includes('Data'), 'Excel Resumo: "Responsável"→"Responsável pela avaliação", "Data"→"Data da avaliação"');
    afirma(cab.includes('Situação da curadoria') && cab.includes('Versão do motor'), 'Excel Resumo: colunas "Situação da curadoria" e "Versão do motor"');
    afirma(ex.celResumo('Item Sem Curadoria', 'Situação da curadoria') === 'Nenhuma registrada', 'Excel Resumo: sem curadoria → "Nenhuma registrada" (era: ' + ex.celResumo('Item Sem Curadoria', 'Situação da curadoria') + ')');
    afirma(ex.celResumo('Item A Revisar', 'Situação da curadoria') === 'Nenhuma registrada · 2 para revisar', 'Excel Resumo: a revisar → "Nenhuma registrada · 2 para revisar" (era: ' + ex.celResumo('Item A Revisar', 'Situação da curadoria') + ')');
    afirma(ex.celResumo('Item Sem Efeito', 'Situação da curadoria') === 'Nenhuma registrada · 2 sem efeito', 'Excel Resumo: sem efeito → "Nenhuma registrada · 2 sem efeito" (era: ' + ex.celResumo('Item Sem Efeito', 'Situação da curadoria') + ')');
    afirma(String(ex.celResumo('Item Cadeia', 'Situação da curadoria')).startsWith('2 campos registrados'), 'Excel Resumo: curadoria vigente → "2 campos registrados" (era: ' + ex.celResumo('Item Cadeia', 'Situação da curadoria') + ')');
    afirma(ex.celResumo('Item Sem Curadoria', 'Versão do motor') === MOTOR_VERSION, 'Excel Resumo: "Versão do motor" = ' + MOTOR_VERSION);
    const hc = ex.hist[0];
    const esperadoHist = ['ID do item', 'ID da avaliação', 'Versão', 'Data da avaliação', 'Responsável pela avaliação',
      'Especialização identificada pelo questionário', 'Especialização', 'Papel estrutural', 'Natureza complementar', 'Situação da curadoria',
      'Resultado anterior', 'Resultado atual', 'Classificação anterior', 'Classificação atual', 'Decisão anterior', 'Decisão atual', 'Forma anterior', 'Forma atual',
      'Responsável pela decisão', 'Data da decisão', 'Resumo da mudança', 'Justificativa de divergência'];
    afirma(JSON.stringify(hc) === JSON.stringify(esperadoHist), 'Excel Histórico: colunas anterior/atual separadas + Resumo da mudança (' + hc.join(' | ') + ')');
    afirma(ex.celHist('cad1', 'Resultado anterior') === '' && ex.celHist('cad1', 'Classificação anterior') === '' && ex.celHist('cad1', 'Resumo da mudança') === 'Versão inicial', 'Excel Histórico v1: anteriores vazios, "Versão inicial"');
    afirma(ex.celHist('cad1', 'Classificação atual') === L1 && ex.celHist('cad1', 'Decisão atual') === rot(A.cad1.resultadoAutomatico) && ex.celHist('cad1', 'Forma atual') === 'Recomendação do sistema aceita', 'Excel Histórico v1: atuais preenchidos');
    afirma(ex.celHist('cad2', 'Classificação anterior') === L1 && ex.celHist('cad2', 'Classificação atual') === L2, 'Excel Histórico v2: Classificação anterior/atual');
    afirma(ex.celHist('cad2', 'Decisão anterior') === rot(A.cad1.resultadoAutomatico) && ex.celHist('cad2', 'Decisão atual') === rot('produto'), 'Excel Histórico v2: Decisão anterior/atual');
    afirma(ex.celHist('cad2', 'Forma anterior') === 'Recomendação do sistema aceita' && ex.celHist('cad2', 'Forma atual') === 'Decisão manual', 'Excel Histórico v2: Forma anterior/atual');
    afirma(ex.celHist('cad2', 'Resumo da mudança') === MUDOU, 'Excel Histórico v2: Resumo da mudança = mesmo texto do PDF');
    afirma(ex.celHist('cad2', 'Justificativa de divergência') === 'Decidido por pessoa.', 'Excel Histórico v2: justificativa de divergência preservada');
    afirma(ex.celHist('cad2', 'Especialização') === ESP && ex.celHist('cad2', 'Papel estrutural') === 'Essencial' && String(ex.celHist('cad2', 'Situação da curadoria')).startsWith('2 campos registrados'), 'Excel Histórico v2: Curadoria vigente (Especialização, Papel) e situação da curadoria');
    afirma(ex.celHist('cad1', 'Especialização') === '' && ex.celHist('cad1', 'Situação da curadoria') === 'Nenhuma registrada', 'Excel Histórico v1: sem curadoria → "Nenhuma registrada"');
    afirma(ex.celHist('der', 'Especialização identificada pelo questionário') === ESP_DERIVADA && ex.celHist('der', 'Especialização') === '', 'Excel Histórico: especialização identificada pelo questionário fica na coluna própria (não é curadoria)');
    afirma(ex.celHist('rv', 'Situação da curadoria') === 'Nenhuma registrada · 2 para revisar', 'Excel Histórico: curadoria a revisar aparece como situação (sem despejar o valor antigo)');
    afirma(ex.celHist('cad2', 'Responsável pela decisão') === 'Fulana' && ex.celHist('cad2', 'Data da decisão') !== '' && ex.celHist('cad1', 'Responsável pela decisão') === '', 'Excel Histórico: responsável e data da decisão (só quando manual)');
    afirma(ex.celResumo('Item Pendente', 'Forma da decisão') === 'Sem decisão registrada' && ex.celHist('pend2', 'Forma atual') === 'Sem decisão registrada' && ex.celHist('pend2', 'Forma anterior') === 'Decisão manual', 'Excel: versão sem decisão registrada → "Sem decisão registrada" (Resumo e Histórico), nunca "Recomendação do sistema aceita"');
    afirma(/Forma da decisão: Decisão manual → Sem decisão registrada/.test(ex.celHist('pend2', 'Resumo da mudança')), 'Excel Histórico: Resumo da mudança cita Decisão manual → Sem decisão registrada');
    afirma(!/@/.test(JSON.stringify([ex.resumo, ex.hist, ex.trilha])), 'Excel: nenhum e-mail em nenhuma aba');
    const th = ex.trilha && ex.trilha[0];
    afirma(JSON.stringify(th) === JSON.stringify(['ID do item', 'ID da avaliação', 'Versão', 'Data e hora', 'Evento', 'Campo', 'Valor anterior', 'Valor novo', 'Responsável pela alteração', 'Origem', 'Observação']), 'Excel Trilha: colunas (' + (th || []).join(' | ') + ')');
    const lt = ex.linhasTrilha('cad2');
    afirma(lt.length === 6, 'Excel Trilha: uma linha por alteração da v2 (6; veio ' + lt.length + ')');
    const lEsp = lt.find((l) => l[5] === 'Especialização' && l[7] === ESP && l[6] === '—');
    afirma(!!lEsp && lEsp[8] === 'Cicrana' && lEsp[4] === 'Alteração', 'Excel Trilha: Evento "Alteração" · Campo "Especialização" — anterior "—", novo, responsável');
    const lDec = lt.find((l) => l[5] === 'Decisão final' && /manual/.test(l[7]));
    afirma(!!lDec && lDec[6] === 'Não é Produto/Serviço principal (recomendação aceita)' && lDec[7] === 'É Produto/Serviço principal (manual)' && /Decidido por pessoa\./.test(lDec[10]) && lDec[8] === 'Fulana' && lDec[4] === 'Alteração', 'Excel Trilha: Decisão final — anterior, novo, justificativa e quem');
    afirma(lt.some((l) => /reavaliação da v1/.test(l[9]) && l[4] === 'Criação por reavaliação' && l[5] === 'Decisão final'), 'Excel Trilha: Evento "Criação por reavaliação" (Campo Decisão final, origem citando a v1)');
    afirma(lt.some((l) => /Reprocessamento automático em lote/.test(l[9]) && l[4] === 'Reprocessamento automático' && l[5] === 'Especialização'), 'Excel Trilha: Evento "Reprocessamento automático" (Campo Especialização, origem em lote com o motor)');
    afirma(lt.some((l) => l[5] === 'Natureza complementar' && l[7] === 'Programa transversal'), 'Excel Trilha: Natureza complementar (outra auditoria)');
    afirma(lt.some((l) => l[5] === 'Papel estrutural' && l[8] === '—'), 'Excel Trilha: autor sem nome → "—" (nunca o e-mail)');
    afirma(ex.linhasTrilha('cad1').length === 0 && !ex.linhasTrilha('cad1').some((l) => /indispon/i.test(l[4])), 'Excel Trilha: versão sem auditoria → nenhuma linha (lida com sucesso)');
    afirma(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'tela sem rolagem horizontal');
    afirma(erros.length === 0, 'sem erros de página'); totalErros += erros.length;
    await ctx.close();
  }

  console.log('\n######## Trilha que FALHA (banco recusa a leitura da auditoria) ########');
  {
    const { ctx, page } = await abrir(browser, { fail: ['curadoria-auditoria'] });
    await abrirFicha(page, 'cad2');
    const p = await gerarPdf(page);
    const h = entre(p, 'Como chegamos até aqui', 'Respostas e evidências');
    afirma(p.length > 500 && /O que uma pessoa decidiu/.test(p), 'PDF continua sendo gerado e válido');
    afirma(/Trilha indisponível/.test(h) && /não foi possível/i.test(h), 'PDF: "Trilha indisponível" explícito');
    afirma(/Histórico de versões/.test(h) && h.indexOf(MUDOU) !== -1, 'PDF: o histórico de versões (dos dados gravados) continua completo');
    afirma(!/Nenhuma alteração registrada/.test(h), 'PDF: NUNCA finge trilha vazia');
    await voltar(page);
    const ex = await lerExcel(page);
    afirma(ex.hist.length >= 3 && ex.celHist('cad2', 'Resumo da mudança') === MUDOU, 'Excel: Histórico segue completo');
    const lt = ex.linhasTrilha('cad2');
    afirma(lt.length === 1 && lt[0][4] === 'Trilha indisponível', 'Excel Trilha: uma linha explícita "Trilha indisponível" por versão (nunca vazio de mentira)');
    await ctx.close();
  }

  console.log('\n######## Trilha que NUNCA responde (rede lenta): o PDF não trava ########');
  {
    const { ctx, page } = await abrir(browser, { delays: { 'curadoria-auditoria': 600000 } });
    await abrirFicha(page, 'cad2');
    const t0 = Date.now();
    const p = await gerarPdf(page);
    const dt = Date.now() - t0;
    const h = entre(p, 'Como chegamos até aqui', 'Respostas e evidências');
    afirma(/Trilha indisponível/.test(h) && p.length > 500, 'PDF: gerado com "Trilha indisponível" depois do tempo limite (' + dt + ' ms)');
    afirma(dt < 40000, 'PDF: o tempo de espera é limitado (< 40 s; foi ' + dt + ' ms)');
    await ctx.close();
  }

  await browser.close();
  console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
