/* CURADORIA ARQUITETURAL — organiza e audita o que a avaliação JÁ tinha, sem
 * conceito novo (sem Abrangência; papel estrutural só em Componente).
 *
 * Prova, na tela (desktop e celular 375 px), com banco falso em persistenciaReal,
 * no PDF (HTML capturado) e no Excel:
 *   - sequência: Resultado → Classificação arquitetural (a camada) → Curadoria
 *     arquitetural (Especialização, Papel estrutural, Natureza) → Decisão final;
 *   - a camada NÃO tem controle de edição; Especialização só nas camadas que a
 *     admitem; Papel estrutural só em Componente; Abrangência não existe;
 *   - placeholders ("não determinada pelo questionário"/"não determinado") em
 *     registros antigos NÃO aparecem em tela, PDF nem Excel (e nada é apagado);
 *   - salvar especialização/papel grava a auditoria (anterior, novo, quem,
 *     quando) na MESMA gravação; só do que mudou;
 *   - cada alteração da Decisão final grava histórico (decisão anterior, nova,
 *     quem, quando) e a recomendação do sistema nunca muda;
 *   - se o banco recusar a auditoria, nada é gravado (atomicidade);
 *   - rótulos iguais em tela, PDF e Excel: Recomendação do sistema,
 *     Classificação arquitetural, Curadoria arquitetural, Decisão final;
 *   - "Forma da decisão" derivada dos campos existentes.
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
function acharCamada(id) {
  for (let m = 0; m < 65536; m++) { const c = av.computeResultado({ respostas: respostasDe(m) }); if (c.camadaSugerida.id === id) return { m, c }; }
  throw new Error('nenhuma combinação dá ' + id);
}

function itemDe(nome, camadaId, extra) {
  const { m, c } = acharCamada(camadaId);
  const respostas = respostasDe(m);
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
  }, extra || {});
}
const AVALIACOES = () => ({
  comp: itemDe('Item Componente', 'componente'),
  canal: itemDe('Item Canal', 'canal'),
  /* registro ANTIGO: já tem os placeholders gravados em camadaSugerida */
  velho: itemDe('Item Antigo', 'componente'),
});
(function () {
  const v = AVALIACOES().velho; /* só para validar a fixture */
  if (v.camadaSugerida.id !== 'componente') throw new Error('fixture inválida');
})();
function comPlaceholders(db) {
  db.velho.camadaSugerida.especializacao = 'não determinada pelo questionário';
  db.velho.camadaSugerida.papelEstrutural = 'não determinado';
  return db;
}

async function abrir(browser, o) {
  o = o || {};
  const admins = {}; admins[KEY] = { email: EMAIL };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {},
    'turmas-checkin': {}, 'turmas-espera': {}, 'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {},
    eventos: {}, 'turmas-publico': {}, 'eventos-publico': {}, 'avaliacoes-produto': comPlaceholders(AVALIACOES()), 'avaliacoes-squad': {},
    'motor-squad-config': {}, 'motor-squad-auditoria': {}, 'motor-arquitetura-auditoria': {} };
  const cfg = { db: db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true, fail: o.fail, delays: o.delays };
  const ctx = await browser.newContext({ viewport: o.viewport || DESKTOP, acceptDownloads: true });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  /* captura o HTML do PDF no instante em que é montado (o PDF em si é imagem) */
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
const contar = (page, sel) => page.locator(sel).count();
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
  const arq = path.join(require('os').tmpdir(), 'avp-curadoria-' + Date.now() + '.xlsx');
  await dl.saveAs(arq);
  const wb = XLSX.read(fs.readFileSync(arq), { type: 'buffer' });
  const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  const hist = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[2]] || wb.Sheets[wb.SheetNames[wb.SheetNames.length - 1]], { header: 1 });
  fs.unlinkSync(arq);
  return { linhas, hist };
}
const posicaoH4 = (page, texto) => page.evaluate((t) => {
  const h = Array.from(document.querySelectorAll('#avaliacoesPainel h4')).find((x) => x.textContent.trim() === t);
  return h ? h.getBoundingClientRect().top + window.scrollY : -1;
}, texto);
const auditoriaCur = async (page, key) => Object.values(((await banco(page))['curadoria-auditoria'] || {})[key] || {}).sort((a, b) => String(a.dataHora).localeCompare(String(b.dataHora)));

(async () => {
  const browser = await chromium.launch();

  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros } = await abrir(browser, { viewport });

    console.log('\n== Sequência e conteúdo do bloco Curadoria (Componente) ==');
    await abrirResultado(page, 'comp');
    if (process.env.FA_SHOT) await page.screenshot({ path: process.env.FA_SHOT + '-' + nomeTela.split(' ')[0] + '.png', fullPage: true }); /* só para inspeção manual */
    const pClass = await posicaoH4(page, 'Classificação arquitetural');
    const pCur = await posicaoH4(page, 'Curadoria arquitetural');
    const pDec = await posicaoH4(page, 'Decisão final');
    afirma(pClass !== -1 && pCur !== -1 && pDec !== -1 && pClass < pCur && pCur < pDec, 'ordem na tela: Classificação arquitetural → Curadoria arquitetural → Decisão final');
    afirma(await contar(page, '#avpCuradoriaCard #avpEspecializacaoCadastrada') === 1 && await contar(page, '#avpCuradoriaCard #avpPapelEstruturalCadastrado') === 1 && await contar(page, '#avpCuradoriaCard #avpNaturezaComplementar') === 1,
      'Curadoria reúne Especialização, Papel estrutural (Componente) e Natureza complementar');
    afirma(!/abrang/i.test(await page.locator('#avaliacoesPainel').innerText()), 'Abrangência não existe na tela');
    const cardClass = page.locator('#avaliacoesPainel .avp-alt-card');
    afirma(await cardClass.locator('input, select, textarea, button').count() === 0, 'a Classificação arquitetural (camada do motor) não tem nenhum controle de edição');
    afirma(!/Especialização:|Papel estrutural:/.test(await cardClass.innerText()), 'especialização e papel saíram do card da classificação (ficam na Curadoria)');
    afirma(await page.locator('#avpDecisaoResumo').innerText().then((t) => /Recomendação do sistema/.test(t) && /Decisão final/.test(t) && /Forma da decisão/.test(t)), 'Decisão final mostra Recomendação do sistema, Decisão final e Forma da decisão');
    afirma(await larguraOk(page), 'sem rolagem horizontal');
    await voltar(page);

    console.log('\n== Canal: sem especialização nem papel (camada não os admite), natureza sim ==');
    await abrirResultado(page, 'canal');
    afirma(await contar(page, '#avpEspecializacaoCadastrada') === 0 && await contar(page, '#avpPapelEstruturalCadastrado') === 0 && await contar(page, '#avpNaturezaComplementar') === 1, 'Canal: só a natureza aparece na Curadoria');
    await voltar(page);

    console.log('\n== Registro ANTIGO com placeholders gravados: ausência de valor, nada apagado ==');
    await abrirResultado(page, 'velho');
    const txt = await page.locator('#avaliacoesPainel').innerText();
    afirma(!/não determinad/i.test(txt), 'a tela não mostra "não determinada pelo questionário" nem "não determinado"');
    afirma(await page.locator('#avpEspecializacaoCadastrada').inputValue() === '', 'o campo de especialização aparece vazio');
    const pdf = await gerarPdf(page);
    afirma(!!pdf && !/não determinad/i.test(pdf), 'o PDF não mostra placeholders');
    afirma(!/Curadoria arquitetural/.test(pdf), 'sem curadoria preenchida o PDF não mostra o bloco vazio');
    await voltar(page);
    const ex = await lerExcel(page);
    const iEsp = ex.linhas[0].indexOf('Especialização'), iPapel = ex.linhas[0].indexOf('Papel estrutural');
    const lVelho = ex.linhas.find((l) => l[1] === 'Item Antigo');
    afirma(iEsp !== -1 && iPapel !== -1 && lVelho && !lVelho[iEsp] && !lVelho[iPapel], 'o Excel deixa Especialização e Papel estrutural em branco');
    const dbAntes = (await banco(page))['avaliacoes-produto'].velho;
    afirma(dbAntes.camadaSugerida.especializacao === 'não determinada pelo questionário', 'o dado antigo continua gravado como estava (não foi migrado nem apagado)');

    console.log('\n== Rótulos iguais no Excel ==');
    const cab = ex.linhas[0].join('|');
    afirma(/Recomendação do sistema/.test(cab) && /Classificação arquitetural/.test(cab) && /Decisão final/.test(cab) && /Forma da decisão/.test(cab), 'Excel: Recomendação do sistema · Classificação arquitetural · Decisão final · Forma da decisão');
    afirma(!/Resultado automático|Tipo da decisão|Decisão arquitetural final|Classificação arquitetural sugerida/.test(cab + '|' + ex.hist[0].join('|')), 'Excel: nomes antigos não existem mais');
    afirma(ex.linhas[0].indexOf('Classificação arquitetural') < iEsp && iEsp < iPapel && iPapel < ex.linhas[0].indexOf('Natureza complementar') && ex.linhas[0].indexOf('Natureza complementar') < ex.linhas[0].indexOf('Decisão final'), 'Excel: mesma sequência — Classificação → Curadoria → Decisão final');

    console.log('\n== Salvar especialização e papel: auditoria na mesma gravação ==');
    await abrirResultado(page, 'comp');
    await page.fill('#avpEspecializacaoCadastrada', 'Instituto previdenciário');
    await page.selectOption('#avpPapelEstruturalCadastrado', 'essencial');
    await page.click('#avpSalvarEspecializacaoBtn');
    await page.waitForFunction(() => /Especialização salva/.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
    let b = await banco(page);
    let rc = b['avaliacoes-produto'].comp;
    afirma(rc.especializacaoCadastrada === 'Instituto previdenciário' && rc.papelEstruturalCadastrado === 'essencial', 'gravou especialização e papel na avaliação');
    let aud = await auditoriaCur(page, 'comp');
    const aEsp = aud.find((x) => x.tipo === 'alteracao_especializacao'), aPapel = aud.find((x) => x.tipo === 'alteracao_papel_estrutural');
    afirma(aud.length === 2 && aEsp && aPapel, 'gravou 2 linhas de auditoria (especialização e papel)');
    afirma(aEsp && !aEsp.valorAnterior && aEsp.valorNovo === 'Instituto previdenciário' && aEsp.usuario.email === EMAIL && !isNaN(Date.parse(aEsp.dataHora)) && aEsp.avaliacaoId === 'comp', 'especialização: anterior vazio, novo, usuário e data/hora');
    afirma(aPapel && !aPapel.valorAnterior && aPapel.valorNovo === 'essencial', 'papel: anterior vazio, novo = essencial');
    await page.selectOption('#avpPapelEstruturalCadastrado', 'opcional');
    await page.click('#avpSalvarEspecializacaoBtn');
    await page.waitForFunction(() => { const r = window.__CFG.__dbReal['avaliacoes-produto'].comp; return r.papelEstruturalCadastrado === 'opcional'; }, { timeout: 8000 }).catch(() => {});
    aud = await auditoriaCur(page, 'comp');
    const aPapel2 = aud.filter((x) => x.tipo === 'alteracao_papel_estrutural').pop();
    afirma(aud.length === 3 && aPapel2.valorAnterior === 'essencial' && aPapel2.valorNovo === 'opcional', 'mudar só o papel grava UMA linha nova (anterior = essencial, novo = opcional); a especialização não repete');
    b = await banco(page);
    afirma(b['avaliacoes-produto'].comp.resultadoAutomatico === rc.resultadoAutomatico && b['avaliacoes-produto'].comp.camadaSugerida.id === 'componente', 'a recomendação do sistema e a camada não mudaram');
    await page.locator('#avpCuradoriaHistoricoDet summary').click();
    const histTxt = await page.locator('#avpCuradoriaHistorico').innerText();
    afirma(/Especialização/.test(histTxt) && /Papel estrutural/.test(histTxt) && /Essencial → Opcional/.test(histTxt), 'o histórico aparece na tela, com os valores anterior → novo');
    afirma(await larguraOk(page), 'sem rolagem horizontal');

    console.log('\n== Decisão final: histórico a partir de agora ==');
    await page.locator('input[name="avpDecisao"][value="produto"]').check();
    await page.fill('#avpJustificativaDecisao', 'Concordo que é produto.');
    await page.click('#avpSalvarDecisaoBtn');
    await page.waitForFunction(() => /Decisão salva/.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
    b = await banco(page);
    const ra = b['avaliacoes-produto'].comp;
    afirma(ra.decisaoFinal === 'produto' && ra.decisaoManual === true && ra.resultadoAutomatico === rc.resultadoAutomatico, 'decisão manual gravada; a recomendação do sistema permanece intacta');
    aud = (await auditoriaCur(page, 'comp')).filter((x) => x.tipo === 'alteracao_decisao_final');
    afirma(aud.length === 1 && aud[0].valorAnterior.decisaoFinal === rc.resultadoAutomatico && aud[0].valorAnterior.decisaoManual === false && aud[0].valorNovo.decisaoFinal === 'produto' && aud[0].valorNovo.decisaoManual === true && aud[0].justificativa === 'Concordo que é produto.' && aud[0].usuario.email === EMAIL,
      'histórico: decisão anterior, nova, justificativa, usuário');
    afirma(/Decisão alterada manualmente/.test(await page.locator('#avpDecisaoResumo').innerText()), 'Forma da decisão: "Decisão alterada manualmente"');
    await page.locator('input[name="avpDecisao"][value="auto"]').check();
    await page.click('#avpSalvarDecisaoBtn');
    await page.waitForFunction(() => { const r = window.__CFG.__dbReal['avaliacoes-produto'].comp; return r.decisaoManual === false; }, { timeout: 8000 }).catch(() => {});
    aud = (await auditoriaCur(page, 'comp')).filter((x) => x.tipo === 'alteracao_decisao_final');
    afirma(aud.length === 2 && aud[1].valorAnterior.decisaoManual === true && aud[1].valorAnterior.decisaoFinal === 'produto' && aud[1].valorNovo.decisaoManual === false, 'voltar a aceitar a recomendação grava outra linha (anterior = manual, novo = aceita)');
    afirma(/Recomendação aceita com complementações arquiteturais/.test(await page.locator('#avpDecisaoResumo').innerText()), 'Forma da decisão: com curadoria preenchida e recomendação aceita → "Recomendação aceita com complementações arquiteturais"');

    console.log('\n== PDF: mesma sequência e mesmos rótulos ==');
    const pdf2 = await gerarPdf(page);
    const i1 = pdf2.indexOf('Classificação arquitetural'), i2 = pdf2.indexOf('Curadoria arquitetural'), i3 = pdf2.indexOf('Decisão final');
    afirma(i1 !== -1 && i1 < i2 && i2 < i3, 'PDF: Classificação arquitetural → Curadoria arquitetural → Decisão final');
    afirma(/Curadoria arquitetural Especialização Instituto previdenciário Papel estrutural Opcional/.test(pdf2), 'PDF: a Curadoria traz Especialização e Papel estrutural reais');
    afirma(/Recomendação do sistema/.test(pdf2) && /Forma da decisão Recomendação aceita com complementações arquiteturais/.test(pdf2), 'PDF: Recomendação do sistema e Forma da decisão derivada');
    afirma(/Avaliação original preservada — versão 1/.test(pdf2) && !/Documento revisado/.test(pdf2), 'PDF: cabeçalho "Avaliação original preservada — versão 1" (sem "Documento revisado")');
    afirma(!/Classificação arquitetural sugerida|Classificação sugerida|Decisão arquitetural\b/.test(pdf2), 'PDF: nomes antigos não existem mais');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  console.log('\n== Atomicidade: se o banco recusar a auditoria, a alteração também não grava ==');
  {
    const { ctx, page, erros } = await abrir(browser, { fail: ['curadoria-auditoria'] });
    await abrirResultado(page, 'comp');
    await page.fill('#avpEspecializacaoCadastrada', 'Algo');
    await page.click('#avpSalvarEspecializacaoBtn');
    await page.waitForSelector('.avp-modal-ok-btn', { timeout: 5000 });
    await page.click('.avp-modal-ok-btn');
    let b = await banco(page);
    afirma(!b['avaliacoes-produto'].comp.especializacaoCadastrada && !b['curadoria-auditoria'], 'especialização: nada gravado (nem a avaliação, nem a auditoria)');
    await page.locator('input[name="avpDecisao"][value="produto"]').check();
    await page.fill('#avpJustificativaDecisao', 'x');
    await page.click('#avpSalvarDecisaoBtn');
    await page.waitForSelector('.avp-modal-ok-btn', { timeout: 5000 });
    await page.click('.avp-modal-ok-btn');
    b = await banco(page);
    afirma(b['avaliacoes-produto'].comp.decisaoManual === false && !b['curadoria-auditoria'], 'decisão: nada gravado — a avaliação continua como estava');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  await browser.close();
  console.log('\n============================');
  console.log(falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
