/* ESTRUTURA DA FICHA (tela de resultado) — a ordem responde, nesta sequência, a
 *   1. O que o sistema concluiu?      Resultado + Classificação (+ relação, + "por quê" recolhido)
 *   2. O que uma pessoa complementou? Curadoria
 *   3. O que uma pessoa decidiu?      Decisão final
 *   4. Como chegamos até aqui?        Históricos + questionário (evidência, no fim)
 * e prova, em desktop e celular 375 px:
 *   - ordem das seções; Reavaliar e GERAR PDF como ações do item (cabeçalho); faixa-resumo curta;
 *   - Identificação compacta (sem perder informação);
 *   - Especialização derivada só na área automática; cadastrada só na Curadoria; estados do #273 preservados;
 *   - "Forma da decisão" sem citar Curadoria; SALVAR DECISÃO / ✓ DECISÃO SALVA, perto do formulário;
 *   - rótulos dos Salvar da Curadoria iguais ao que realmente salvam e com o mesmo peso visual;
 *   - históricos fora da Curadoria (Curadoria e Decisão separados), recolhidos;
 *   - a justificativa automática não incorpora Especialização/Papel cadastrados;
 *   - navegação existente não piora (Voltar, versão anterior).
 * Hermético: sem rede, sem segredo. */
const { chromium } = require('playwright');
const { esperarSessaoAssentada } = require('./esperas');
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
  const src = SRC_AVP.slice(0, fim) + '\nwindow.__avpTeste = { computeResultado: computeResultado, gerarJustificativaAutomatica: gerarJustificativaAutomatica };\n' + SRC_AVP.slice(fim);
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
const ESP = 'Instituto previdenciário';
const ESP_DERIVADA = 'Opção/configuração de personalização';
const SV = 'sem-vinculo';
const CAMPOS_ID = { descricao: 'Descrição longa do item de teste.', publico: 'Público de teste', necessidade: 'Necessidade de teste', observacoesGerais: 'Observação de teste' };
const AVALIACOES = () => ({
  /* Componente com cadastro VIGENTE (legado, sem marcador) */
  cadx: itemDe('Item Cadastrado', 'componente', CAMPOS_ID, CAD),
  /* Componente só com especialização DERIVADA */
  der: itemDe('Item Derivado', 'componente', CAMPOS_ID, null, (c) => c.camadaSugerida.especializacao === ESP_DERIVADA),
  /* estados do #273 */
  rev: itemDe('Item Revisao', 'componente', null, Object.assign({}, CAD, { especializacaoCamadaConfirmada: SV, papelEstruturalCamadaConfirmada: SV })),
  cana: itemDe('Item Canal Antigo', 'canal', null, CAD),
  uva: itemDe('Item UVA', 'unidade-valor-associada', null, CAD),
  /* decisão MANUAL */
  man: itemDe('Item Manual', 'componente', null, null, null),
  /* par v1 → v2 */
  v1: itemDe('Item Par', 'componente', { itemId: 'par' }),
  v2: itemDe('Item Par', 'componente', { itemId: 'par', versao: 2, versaoAnteriorKey: 'v1', criadoEm: '2026-09-30T09:00:00.000Z', atualizadoEm: '2026-09-30T09:00:00.000Z' }),
});
(function () {
  const a = AVALIACOES();
  Object.assign(a.man, { decisaoManual: true, decisaoFinal: 'produto', decisaoConfirmada: true, justificativaDecisao: 'Decidido por pessoa.', alteradoPor: { name: 'Fulana', email: 'f@previ.com.br' }, alteradoEm: '2026-09-30T10:00:00.000Z' });
  if (a.der.camadaSugerida.especializacao !== ESP_DERIVADA) throw new Error('fixture "der" inválida');
  if (a.man.resultadoAutomatico === 'produto') throw new Error('fixture "man" inválida');
})();
const AV = () => { const a = AVALIACOES(); Object.assign(a.man, { decisaoManual: true, decisaoFinal: 'produto', decisaoConfirmada: true, justificativaDecisao: 'Decidido por pessoa.', alteradoPor: { name: 'Fulana', email: 'f@previ.com.br' }, alteradoEm: '2026-09-30T10:00:00.000Z' }); return a; };

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
  page.setDefaultTimeout(8000);
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
  await esperarSessaoAssentada(page); /* login decidido e acessos resolvidos (antes: opções no lugar do argumento, engolida + 800 ms + 300 ms fixos) */
  await page.waitForSelector('#avpNovoBtn', { timeout: 8000 });
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
  const arq = arquivoTemporario('avp-coerencia-', '.xlsx');
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
const txt = (page, sel) => page.locator(sel).first().innerText().catch(() => '');
const topo = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().top + window.scrollY) : -1; }, sel);
const caixa = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top + window.scrollY), bottom: Math.round(r.bottom + window.scrollY), left: Math.round(r.left), right: Math.round(r.right) }; }, sel);
async function passo(nome, fn) { try { await fn(); } catch (e) { afirma(false, nome + ' — exceção: ' + String(e.message || e).split('\n')[0]); } }

(async () => {
  const browser = await chromium.launch();

  /* ---------- justificativa automática: sem valores de curadoria (função real, sem tela) ---------- */
  console.log('\n== A justificativa automática não incorpora Especialização/Papel cadastrados ==');
  await passo('J', async () => {
    const just = (camadaId, cad, serve) => {
      const { m } = acharCamada(camadaId, serve);
      const item = Object.assign({ respostas: respostasDe(m) }, cad || {});
      return av.gerarJustificativaAutomatica(item, av.computeResultado(item));
    };
    const jCad = just('componente', CAD);
    afirma(!/Instituto previdenciário/.test(jCad) && !/Papel estrutural/i.test(jCad), 'Componente com cadastro: o texto não cita a Especialização nem o Papel cadastrados');
    const jUva = just('unidade-valor-associada', CAD);
    afirma(!/Instituto previdenciário/.test(jUva), 'Unidade de valor associada com cadastro: o texto não cita a Especialização cadastrada');
    const jDer = just('componente', null, (c) => c.camadaSugerida.especializacao === ESP_DERIVADA);
    afirma(/Especialização identificada pelo questionário: Opção\/configuração de personalização/.test(jDer), 'Especialização derivada pelo questionário aparece, dita como "identificada pelo questionário"');
    const jDerCad = just('componente', Object.assign({}, CAD), (c) => c.camadaSugerida.especializacao === ESP_DERIVADA);
    afirma(!/Instituto previdenciário/.test(jDerCad), 'com cadastro por cima da derivada, o texto continua sem o valor cadastrado');
  });

  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros } = await abrir(browser, { viewport, avaliacoes: AV() });

    await passo('S1', async () => {
      console.log('\n== 1. Ordem das seções ==');
      await abrirResultado(page, 'cadx');
      const ids = ['#avpCabecalhoFicha', '#avpSecaoSistema', '.avp-result-card', '.avp-alt-card', '#avpSecaoCuradoria', '#avpCuradoriaCard', '#avpSecaoDecisao', '.avp-decisao-card', '#avpSecaoHistorico', '#avpQuestionarioCard'];
      const ys = []; for (const s of ids) ys.push(await topo(page, s));
      afirma(ys.every((y) => y >= 0), 'todas as seções existem');
      afirma(ys.every((y, i) => i === 0 || y >= ys[i - 1]), 'ordem: cabeçalho → sistema (Resultado → Classificação) → Curadoria → Decisão final → Históricos → Questionário (' + ys.join(' < ') + ')');
      for (const t of ['O que o sistema concluiu', 'O que uma pessoa complementou', 'O que uma pessoa decidiu', 'Como chegamos até aqui']) {
        afirma(new RegExp(t, 'i').test(await page.locator('#avaliacoesPainel').innerText()), 'título da seção: "' + t + '"');
      }
      afirma(await page.locator('#avpSecaoSistema .avp-result-card').count() === 1 && await page.locator('#avpSecaoSistema .avp-alt-card').count() === 1, 'Resultado e Classificação continuam cartões distintos, na mesma seção');
      afirma(/RESULTADO SOBRE PRODUTO\/SERVIÇO/.test(await txt(page, '.avp-result-card')) && /Classificação arquitetural/.test(await txt(page, '.avp-alt-card')), 'cada um com o seu próprio rótulo');
      afirma(await page.locator('.avp-alt-card:has-text("Relação arquitetural")').count() === await page.evaluate(() => 1), 'a Relação arquitetural está dentro do cartão da Classificação');
      afirma(await larguraOk(page), 'sem rolagem horizontal');
    });

    await passo('S2', async () => {
      console.log('\n== 2. "Por que o sistema chegou a essa conclusão": recolhido por padrão ==');
      const det = await page.evaluate(() => { const d = document.getElementById('avpPorQueDet'); return d ? { aberto: d.open, tag: d.tagName, texto: d.textContent } : null; });
      afirma(det && det.tag === 'DETAILS' && det.aberto === false, 'é um <details> fechado por padrão');
      afirma(det && /Justificativa da classificação/.test(det.texto) && /Por que o sistema chegou a essa conclusão/.test(det.texto) && /justificativa gerada/.test(det.texto), 'contém a justificativa e os motivos (continuam acessíveis)');
      const yPorQue = await topo(page, '#avpPorQueDet'), yCur = await topo(page, '#avpSecaoCuradoria');
      afirma(yPorQue !== -1 && yPorQue < yCur, 'fica na seção do sistema, antes da Curadoria');
    });

    await passo('S3', async () => {
      console.log('\n== 3. Cabeçalho: ações do item e faixa-resumo ==');
      const cab = '#avpCabecalhoFicha';
      afirma(await page.locator(cab + ' #avpReavaliarBtn').count() === 1 && await page.locator(cab + ' #avpGerarPdfBtn').count() === 1, 'Reavaliar e GERAR PDF estão no cabeçalho do item');
      afirma(await page.locator('.avp-result-actions-footer #avpGerarPdfBtn').count() === 0 && await page.locator('#avpReavaliarBtn').count() === 1, 'o GERAR PDF não fica mais só no rodapé, e o Reavaliar não está solto entre os cartões');
      const yRes = await topo(page, '.avp-result-card'), yBtn = await topo(page, '#avpGerarPdfBtn');
      afirma(yBtn !== -1 && yBtn < yRes, 'as ações vêm antes do Resultado');
      afirma(await page.locator('.avp-result-actions-footer #avpVoltarListaRodape').count() === 1, 'o rodapé continua com "← Voltar para avaliações"');
      const r = await txt(page, '#avpResumoFicha');
      afirma(/Resultado/i.test(r) && /Classificação/i.test(r) && /Decisão final/i.test(r) && /Curadoria/i.test(r), 'faixa-resumo: Resultado · Classificação · Decisão final · Curadoria');
      afirma(/Curadoria:?\s*2 campos registrados/i.test(r), 'indica a existência de Curadoria ("2 campos registrados")');
      afirma(await page.locator('#avpResumoFicha input, #avpResumoFicha button, #avpResumoFicha textarea, #avpResumoFicha select, #avpResumoFicha details').count() === 0 && !/justificativa gerada/.test(r), 'a faixa é só leitura: sem formulário, justificativa nem histórico');
      const cx = await caixa(page, '#avpResumoFicha');
      afirma(cx && (cx.bottom - cx.top) <= (viewport.width < 500 ? 260 : 120), 'e é curta (' + (cx && (cx.bottom - cx.top)) + ' px)');
    });

    await passo('S4', async () => {
      console.log('\n== 4. Identificação compacta, sem perder informação ==');
      const ident = await page.locator('#avpIdentificacao').textContent();
      afirma(/Item Cadastrado/.test(ident) && /Descrição longa do item de teste/.test(ident) && /Público de teste/.test(ident) && /Necessidade de teste/.test(ident) && /Observação de teste/.test(ident) && /Teste/.test(ident), 'nome, descrição, público, necessidade, observações e quem avaliou continuam na ficha');
      const yRes = await topo(page, '.avp-result-card'), cxR = await caixa(page, '#avpResumoFicha'), cxL = await caixa(page, '#avpVoltarListaResultado');
      afirma(cxR && cxL && (cxR.top - cxL.top) <= 300, 'a faixa-resumo (o estado vigente) começa a ' + (cxR && cxL && (cxR.top - cxL.top)) + ' px do "Voltar" — nada de Identificação longa antes');
      afirma(yRes > 0 && yRes <= (viewport.width < 500 ? 960 : 740), 'o Resultado começa em ' + yRes + ' px, já com ações do item e resumo no cabeçalho (antes: 665 no desktop e 796 no celular, sem eles)');
      afirma(await page.evaluate(() => { const b = document.getElementById('avpGerarPdfBtn'); return b.getBoundingClientRect().height < 60; }), 'o botão GERAR PDF cabe em uma linha');
    });

    await passo('S5', async () => {
      console.log('\n== 5. Especialização: derivada só na área automática; cadastrada só na Curadoria ==');
      afirma(await page.locator('#avpSecaoCuradoria #avpEspecializacaoCadastrada').inputValue() === ESP && await page.locator('#avpSecaoCuradoria #avpPapelEstruturalCadastrado').inputValue() === 'essencial', 'cadastrada (Item Cadastrado): está nos campos da Curadoria');
      afirma(!(await page.locator('#avpSecaoSistema').textContent()).includes(ESP), 'e não aparece em nenhum ponto da seção do sistema');
      afirma(await page.locator('#avpEspecializacaoDerivada').count() === 0, 'com cadastro por cima, não há linha "identificada pelo questionário"');
      await voltar(page);
      await abrirResultado(page, 'der');
      afirma(/Especialização identificada pelo questionário/.test(await txt(page, '#avpSecaoSistema #avpEspecializacaoDerivada')), 'derivada (Item Derivado): aparece na Classificação');
      afirma(!(await page.locator('#avpCuradoriaCard').textContent()).includes(ESP_DERIVADA) && await page.locator('#avpEspecializacaoIdentificada').count() === 0, 'e NÃO aparece dentro da Curadoria (nem como dica no editor)');
      afirma(await page.locator('#avpEspecializacaoCadastrada').inputValue() === '', 'o campo cadastrado da Curadoria está vazio');
      const ajuda = await page.locator('#avpEspecializacaoBloco').textContent();
      afirma(!/nunca inferida das respostas/i.test(ajuda) && /registrada por uma pessoa/.test(ajuda) && /identificada pelo questionário/.test(ajuda) && /não é curadoria/i.test(ajuda), 'o texto de ajuda distingue identificada pelo questionário × cadastrada pela Curadoria');
      await voltar(page);
    });

    await passo('S6', async () => {
      console.log('\n== 6. Estados do #273 preservados e dentro da Curadoria ==');
      await abrirResultado(page, 'rev');
      afirma(await page.locator('#avpSecaoCuradoria #avpCuradoriaRevisao').count() === 1 && /Curadoria anterior disponível para revisão/.test(await txt(page, '#avpCuradoriaRevisao')), 'a revisar: bloco dentro da Curadoria');
      afirma(await page.locator('#avpConfirmarEspecializacaoBtn').count() === 1 && await page.locator('#avpConfirmarPapelBtn').count() === 1, 'com os dois botões de confirmar');
      await voltar(page);
      await abrirResultado(page, 'cana');
      afirma(await page.locator('#avpSecaoCuradoria #avpCuradoriaSemEfeito').count() === 1 && /Curadoria anterior sem efeito nesta classificação/.test(await txt(page, '#avpCuradoriaSemEfeito')), 'sem efeito: bloco dentro da Curadoria');
      await voltar(page);
    });

    await passo('S7', async () => {
      console.log('\n== 7. Rótulos e peso dos Salvar da Curadoria ==');
      await abrirResultado(page, 'cadx');
      await page.fill('#avpEspecializacaoCadastrada', 'Outro valor');
      const bEsp = await page.evaluate(() => { const b = document.getElementById('avpSalvarEspecializacaoBtn'); return { t: b.textContent.trim(), c: b.className.replace(/\bavp-btn-decisao--salva\b/, '').trim() }; });
      const bNat = await page.evaluate(() => { const b = document.getElementById('avpSalvarNaturezaBtn'); return b ? { t: b.textContent.trim(), c: b.className.replace(/\bavp-btn-decisao--salva\b/, '').trim() } : null; });
      afirma(bEsp.t === 'SALVAR ESPECIALIZAÇÃO E PAPEL', 'Componente: o botão diz o que salva — "' + bEsp.t + '"');
      afirma(bNat && bNat.c === bEsp.c, 'Natureza tem o mesmo peso visual (mesmas classes): "' + (bNat && bNat.c) + '" × "' + bEsp.c + '"');
      await page.click('#avpSalvarEspecializacaoBtn');
      await page.waitForFunction(() => /✓ ESPECIALIZAÇÃO E PAPEL SALVOS/.test((document.getElementById('avpSalvarEspecializacaoBtn') || {}).textContent || ''), { timeout: 8000 }).catch(() => {});
      afirma(/✓ ESPECIALIZAÇÃO E PAPEL SALVOS/.test(await txt(page, '#avpSalvarEspecializacaoBtn')), 'depois de salvar: "✓ ESPECIALIZAÇÃO E PAPEL SALVOS"');
      await voltar(page);
      await abrirResultado(page, 'uva');
      await page.fill('#avpEspecializacaoCadastrada', 'Outra');
      afirma(/^SALVAR ESPECIALIZAÇÃO$/.test(await txt(page, '#avpSalvarEspecializacaoBtn')), 'camada sem Papel: o botão diz só "SALVAR ESPECIALIZAÇÃO"');
      await voltar(page);
    });

    await passo('S8', async () => {
      console.log('\n== 8. Decisão final: Forma sem Curadoria; botão perto do formulário ==');
      await abrirResultado(page, 'cadx');
      afirma(/Forma da decisão\s*Recomendação do sistema aceita\s*$/.test((await textoDecisao(page)).trim()), 'com Curadoria registrada, a Forma continua só "Recomendação do sistema aceita"');
      afirma(!/complementações/i.test(await page.locator('#avaliacoesPainel').innerText()), 'nenhuma menção a "complementações arquiteturais" na ficha');
      afirma(!/logo acima/.test(await txt(page, '.avp-decisao-card')), 'o texto não aponta "Reavaliar logo acima"');
      const h = await caixa(page, '.avp-decisao-card h4'), b = await caixa(page, '#avpSalvarDecisaoBtn'), r1 = await caixa(page, 'input[name="avpDecisao"]');
      afirma(b && h && (b.bottom - h.top) <= viewport.height, 'o SALVAR DECISÃO está a no máximo uma tela do título (' + (b && h && (b.bottom - h.top)) + ' px ≤ ' + viewport.height + ')');
      afirma(b && r1 && (b.bottom - r1.top) <= viewport.height - 80, 'e a no máximo uma tela das opções que controla');
      afirma(await page.locator('.avp-decisao-card #avpSalvarDecisaoBtn').count() === 1, 'o botão está dentro do cartão da Decisão');
      afirma(/^SALVAR DECISÃO$/.test(await txt(page, '#avpSalvarDecisaoBtn')), 'rótulo inicial "SALVAR DECISÃO"');
      await page.locator('input[name="avpDecisao"][value="produto"]').check();
      await page.fill('#avpJustificativaDecisao', 'Concordo.');
      afirma(/^SALVAR DECISÃO$/.test(await txt(page, '#avpSalvarDecisaoBtn')), 'ao mudar a escolha continua "SALVAR DECISÃO"');
      await page.click('#avpSalvarDecisaoBtn');
      await page.waitForFunction(() => /✓ DECISÃO SALVA/.test((document.getElementById('avpSalvarDecisaoBtn') || {}).textContent || ''), { timeout: 8000 }).catch(() => {});
      afirma(/✓ DECISÃO SALVA/.test(await txt(page, '#avpSalvarDecisaoBtn')), 'depois de salvar: "✓ DECISÃO SALVA"');
      await page.locator('input[name="avpDecisao"][value="nao-produto"]').check();
      afirma(/^SALVAR DECISÃO$/.test(await txt(page, '#avpSalvarDecisaoBtn')) && !/SALVAR ALTERAÇÃO/.test(await page.locator('#avaliacoesPainel').innerText()), 'mudar depois de salvo volta a "SALVAR DECISÃO" (nunca "SALVAR ALTERAÇÃO")');
      afirma(await larguraOk(page), 'sem rolagem horizontal');
      await voltar(page);
      await abrirResultado(page, 'man');
      afirma(/Forma da decisão\s*Decisão manual/.test(await textoDecisao(page)), 'decisão manual: Forma = "Decisão manual"');
      await voltar(page);
    });

    await passo('S9', async () => {
      console.log('\n== 9. Históricos fora da Curadoria, recolhidos ==');
      await abrirResultado(page, 'v2');
      afirma(await page.locator('#avpCuradoriaCard #avpCuradoriaHistoricoDet').count() === 0 && await page.locator('#avpCuradoriaCard #avpDecisaoHistoricoDet').count() === 0, 'a Curadoria não contém histórico');
      afirma(await page.locator('#avpSecaoHistorico #avpCuradoriaHistoricoDet').count() === 1 && await page.locator('#avpSecaoHistorico #avpDecisaoHistoricoDet').count() === 1, 'a seção "Como chegamos até aqui" tem o Histórico da Curadoria e o Histórico da Decisão final');
      afirma(await page.locator('#avpSecaoHistorico #avpHistoricoVersoes').count() === 1, 'e o Histórico de versões');
      afirma(await page.evaluate(() => !document.getElementById('avpCuradoriaHistoricoDet').open && !document.getElementById('avpDecisaoHistoricoDet').open), 'os dois detalhes vêm recolhidos');
      const yH = await topo(page, '#avpSecaoHistorico'), yQ = await topo(page, '#avpQuestionarioCard');
      afirma(yH < yQ, 'o questionário (evidência) vem por último');
      /* navegação existente */
      await page.click('.avp-hist-abrir[data-key="v1"]');
      await page.waitForSelector('#avpAvisoVersaoAnterior', { timeout: 5000 });
      afirma(await page.locator('#avpReavaliarBtn').count() === 0 && await page.locator('#avpAbrirVigente').count() === 1, 'versão anterior: sem Reavaliar, com "Abrir a versão vigente"');
      afirma(await page.locator('#avpCabecalhoFicha #avpGerarPdfBtn').count() === 1, 'e o GERAR PDF continua disponível');
      await page.click('#avpAbrirVigente');
      await page.waitForFunction(() => !document.getElementById('avpAvisoVersaoAnterior'), { timeout: 5000 }).catch(() => {});
      afirma(await page.locator('#avpAvisoVersaoAnterior').count() === 0, 'abrir a vigente funciona');
      await page.click('#avpVoltarListaRodape');
      afirma(await aparece(page, '#avpNovoBtn', 4000), 'o "← Voltar para avaliações" do rodapé continua levando à lista');
    });

    await passo('S10', async () => {
      console.log('\n== 10. GERAR PDF pelo cabeçalho ==');
      await abrirResultado(page, 'cadx');
      const pdf = await gerarPdf(page);
      afirma(/Decisão final/.test(pdf) && /O que uma pessoa complementou/.test(pdf), 'o botão do cabeçalho gera o PDF');
      await voltar(page);
    });

    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  /* ---------- ponta a ponta: justificativa regerada pela reavaliação ---------- */
  console.log('\n== Reavaliar um item com cadastro: a nova justificativa não traz o valor cadastrado ==');
  await passo('R', async () => {
    const { ctx, page } = await abrir(browser, { avaliacoes: AV() });
    const antes = await banco(page);
    await abrirResultado(page, 'cadx');
    await page.click('#avpReavaliarBtn');
    await page.waitForSelector('#avpConcluirBtn', { timeout: 5000 });
    await page.click('#avpConcluirBtn');
    await page.waitForSelector('#avpCuradoriaCard', { timeout: 8000 });
    await page.waitForTimeout(400);
    const b = await banco(page);
    const nova = Object.keys(b['avaliacoes-produto']).find((k) => !antes['avaliacoes-produto'][k]);
    const j = (b['avaliacoes-produto'][nova] || {}).justificativaAutomatica || '';
    afirma(!!j && !/Instituto previdenciário/.test(j) && !/Papel estrutural/i.test(j), 'a justificativa gerada na v2 não traz Especialização nem Papel cadastrados');
    await ctx.close();
  });

  await browser.close();
  console.log('\n============================');
  console.log(falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
