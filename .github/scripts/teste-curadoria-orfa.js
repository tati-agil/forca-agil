/* CURADORIA ANTERIOR SEM EFEITO / DISPONÍVEL PARA REVISÃO — o cadastro de
 * Especialização e de Papel estrutural que deixou de se aplicar à classificação
 * atual (a camada mudou) nunca é apagado, nunca conta como Curadoria vigente e,
 * quando a camada volta a admitir o campo, NÃO volta sozinho: exige confirmação.
 *
 *   - sem efeito (a camada atual não admite o campo): bloco próprio, informativo,
 *     separado da Curadoria vigente; fora de Forma da decisão, PDF e Excel;
 *   - disponível para revisão (admite de novo, mas o cadastro foi confirmado para
 *     outra classificação): bloco com "Confirmar"; só depois conta como vigente;
 *     alterar o valor em vez de confirmar também vale;
 *   - confirmar é ação humana e grava auditoria (mesma trilha da curadoria);
 *   - salvar Especialização NUNCA apaga o Papel (nem o contrário) quando o outro
 *     campo não é editado — o defeito que apagava o papel numa camada sem papel;
 *   - registro legado (sem marcador) segue como no #272: vale enquanto a camada
 *     admite; abrir a ficha NUNCA grava nada; o marcador nasce quando a camada
 *     muda (reprocessar/reavaliar) ou numa confirmação/alteração humana;
 *   - Especialização derivada do questionário e Natureza não entram nesse fluxo.
 * Desktop e celular 375 px. Hermético: sem rede, sem segredo. */
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
const ESP = 'Instituto previdenciário';
const SEM_VINCULO = { especializacaoCamadaConfirmada: SV, papelEstruturalCamadaConfirmada: SV };
const AVALIACOES = () => ({
  /* LEGADO (sem marcador) com cadastro que a camada atual (Canal) não admite */
  cana: itemDe('Item Canal Antigo', 'canal', null, CAD),
  /* LEGADO em camada que admite Especialização mas NÃO Papel (o caso que apagava o papel) */
  uva: itemDe('Item UVA', 'unidade-valor-associada', null, CAD),
  /* Componente: o cadastro perdeu o vínculo (camada mudou) e a camada voltou a admitir → revisar */
  rev: itemDe('Item Revisao', 'componente', null, Object.assign({}, CAD, SEM_VINCULO)),
  rev2: itemDe('Item Alteracao', 'componente', null, Object.assign({}, CAD, SEM_VINCULO)),
  /* Especialização a revisar, mas Papel já confirmado para Componente */
  rev3: itemDe('Item Papel Vigente', 'componente', null, Object.assign({}, CAD, { especializacaoCamadaConfirmada: SV, papelEstruturalCamadaConfirmada: 'componente' })),
  /* LEGADO vigente: Componente com cadastro e sem marcador (comportamento do #272) */
  cadx: itemDe('Item Legado Vigente', 'componente', null, CAD),
  /* fora do fluxo */
  der: itemDe('Item Derivado', 'componente', null, null, (c) => c.camadaSugerida.especializacao === ESP_DERIVADA),
  nat: itemDe('Item Natureza', 'canal', { naturezaComplementarCodigo: 'PROGRAMA', naturezaComplementarNomeNaEpoca: 'Programa transversal', naturezaComplementarDescricaoNaEpoca: null,
    naturezaComplementarDefinidaPor: { name: 'Fulana', email: 'f@previ.com.br' }, naturezaComplementarDefinidaEm: '2026-09-30T10:00:00.000Z' }),
  limpo: itemDe('Item Limpo', 'canal'),
});
const ESP_DERIVADA = 'Opção/configuração de personalização';
(function () {
  const a = AVALIACOES(); /* valida as fixtures */
  if (a.cana.camadaSugerida.especializacao || a.cana.camadaSugerida.papelEstrutural) throw new Error('fixture "cana" inválida');
  if (a.uva.camadaSugerida.especializacao !== ESP || a.uva.camadaSugerida.papelEstrutural) throw new Error('fixture "uva" inválida');
  if (a.der.camadaSugerida.especializacao !== ESP_DERIVADA) throw new Error('fixture "der" inválida');
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
const reg = async (page, key) => (await banco(page))['avaliacoes-produto'][key];
const txt = (page, sel) => page.locator(sel).first().innerText().catch(() => '');
const TIT_SEM_EFEITO = 'Curadoria anterior sem efeito nesta classificação';
const TIT_REVISAO = 'Curadoria anterior disponível para revisão';
async function passo(nome, fn) { try { await fn(); } catch (e) { afirma(false, nome + ' — exceção: ' + String(e.message || e).split('\n')[0]); } }
const esperaDb = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 8000 }).catch(() => {});
/* marca as 16 respostas conforme a máscara (clicando como a pessoa) */
async function marcarRespostas(page, mascara) {
  for (let i = 0; i < ORDEM.length; i++) {
    const sim = (mascara >> i) & 1;
    await page.locator('#avpQuestion-' + ORDEM[i] + ' .avp-choice-btn--' + (sim ? 'sim' : 'nao')).click();
  }
}

(async () => {
  const browser = await chromium.launch();

  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros } = await abrir(browser, { viewport });

    await passo('A', async () => {
      console.log('\n== A. Cadastro que a camada atual (Canal) não admite: sem efeito, preservado ==');
      const antes = await banco(page);
      await abrirResultado(page, 'cana');
      const bloco = await txt(page, '#avpCuradoriaSemEfeito');
      afirma(new RegExp(TIT_SEM_EFEITO).test(bloco), 'bloco próprio "' + TIT_SEM_EFEITO + '"');
      afirma(/não se aplica à classificação arquitetural atual/.test(bloco) && /não conta como curadoria vigente/.test(bloco), 'texto: não se aplica à classificação atual, preservado, não conta como curadoria vigente');
      afirma(/Especialização anteriormente cadastrada:\s*Instituto previdenciário/.test(bloco) && /Papel estrutural anteriormente cadastrado:\s*Essencial/.test(bloco), 'mostra Especialização e Papel anteriormente cadastrados');
      afirma(/A classificação atual “[^”]+” não admite este campo\./.test(bloco), 'informa a camada atual e que ela não admite o campo');
      afirma(!/órf/i.test(await page.locator('#avaliacoesPainel').innerText()), 'a interface não usa o termo "órfã"');
      afirma(await page.locator('#avpCuradoriaSemEfeito button, #avpCuradoriaSemEfeito input, #avpCuradoriaSemEfeito select').count() === 0, 'o bloco é só informativo (sem botão nem campo)');
      afirma(await page.locator('#avpCuradoriaRevisao').count() === 0, 'não aparece como "disponível para revisão"');
      afirma(!/complementações/.test(await textoDecisao(page)), 'Forma da decisão não conta o cadastro sem efeito');
      afirma(await larguraOk(page), 'sem rolagem horizontal');
      afirma(JSON.stringify(await banco(page)) === JSON.stringify(antes), 'abrir a ficha NÃO grava nada (nenhuma leitura altera dado)');
      await voltar(page);
    });

    await passo('B', async () => {
      console.log('\n== B. Salvar Especialização NÃO apaga o Papel que a camada não admite ==');
      await abrirResultado(page, 'uva');
      const bloco = await txt(page, '#avpCuradoriaSemEfeito');
      afirma(/Papel estrutural anteriormente cadastrado:\s*Essencial/.test(bloco) && !/Especialização anteriormente cadastrada/.test(bloco), 'o bloco traz só o Papel (a Especialização é vigente nesta camada)');
      afirma(await page.locator('#avpEspecializacaoCadastrada').inputValue() === ESP && await page.locator('#avpPapelEstruturalCadastrado').count() === 0, 'a Especialização é editável e vigente; Papel só existe em Componente');
      await page.fill('#avpEspecializacaoCadastrada', 'Outra especialização');
      await page.click('#avpSalvarEspecializacaoBtn');
      await esperaDb(page, () => window.__CFG.__dbReal['avaliacoes-produto'].uva.especializacaoCadastrada === 'Outra especialização');
      const r = await reg(page, 'uva');
      afirma(r.especializacaoCadastrada === 'Outra especialização', 'gravou a nova Especialização');
      afirma(r.papelEstruturalCadastrado === 'essencial', 'o Papel antigo continua gravado (antes era apagado em silêncio)');
      const aud = await auditoriaDe(page, 'uva');
      afirma(aud.length === 1 && aud[0].tipo === 'alteracao_especializacao', 'a auditoria tem só a linha da Especialização (nenhuma sobre o Papel, que não mudou)');
      afirma(/Papel estrutural anteriormente cadastrado:\s*Essencial/.test(await txt(page, '#avpCuradoriaSemEfeito')), 'o bloco continua mostrando o Papel preservado');
      await voltar(page);
    });

    await passo('C', async () => {
      console.log('\n== C. Camada voltou a admitir: o cadastro antigo NÃO volta sozinho; confirmar → volta a valer ==');
      const antes = await banco(page);
      await abrirResultado(page, 'rev');
      const bloco = await txt(page, '#avpCuradoriaRevisao');
      afirma(new RegExp(TIT_REVISAO).test(bloco) && /voltou a ser compatível com a classificação atual/.test(bloco) && /Confirme se ele continua válido para esta classificação/.test(bloco), 'bloco "' + TIT_REVISAO + '" com o texto combinado');
      afirma(/Especialização anterior:\s*Instituto previdenciário/.test(bloco) && /Papel estrutural anterior:\s*Essencial/.test(bloco), 'mostra Especialização anterior e Papel anterior');
      afirma(await page.locator('#avpEspecializacaoCadastrada').inputValue() === '' && await page.locator('#avpPapelEstruturalCadastrado').inputValue() === '', 'os campos de curadoria vigente estão vazios (o antigo não é o vigente)');
      afirma(!/complementações/.test(await textoDecisao(page)), 'Forma da decisão NÃO conta o valor a revisar');
      afirma(await page.locator('#avpCuradoriaSemEfeito').count() === 0, 'não aparece como "sem efeito" (a camada admite o campo)');
      afirma(await larguraOk(page), 'sem rolagem horizontal');
      afirma(JSON.stringify(await banco(page)) === JSON.stringify(antes), 'abrir a ficha NÃO grava nada');
      const pdf = await gerarPdf(page);
      afirma(!/Curadoria arquitetural/.test(pdf) && !/Instituto previdenciário/.test(pdf), 'o PDF não conta o valor a revisar como curadoria');
      /* confirma a Especialização */
      await page.click('#avpConfirmarEspecializacaoBtn');
      await esperaDb(page, () => window.__CFG.__dbReal['avaliacoes-produto'].rev.especializacaoCamadaConfirmada === 'componente');
      let r = await reg(page, 'rev');
      afirma(r.especializacaoCadastrada === ESP && r.especializacaoCamadaConfirmada === 'componente', 'confirmar grava o marcador (camada Componente) e mantém o valor');
      afirma(r.papelEstruturalCadastrado === 'essencial' && r.papelEstruturalCamadaConfirmada === SV, 'o Papel segue pendente (confirmação é por campo)');
      let aud = await auditoriaDe(page, 'rev');
      afirma(aud.length === 1 && aud[0].tipo === 'alteracao_especializacao' && aud[0].confirmacao === true && aud[0].camada && aud[0].camada.id === 'componente', 'auditoria: UMA linha de Especialização marcada como confirmação, com a camada');
      afirma(!aud[0].valorAnterior && aud[0].valorNovo === ESP && aud[0].usuario.email === EMAIL && !isNaN(Date.parse(aud[0].dataHora)), 'a linha traz: vigente antes (nenhum), vigente depois, usuário e data/hora');
      afirma(await page.locator('#avpEspecializacaoCadastrada').inputValue() === ESP, 'a Especialização passa a ser a vigente (campo preenchido)');
      afirma(/Recomendação aceita com complementações arquiteturais/.test(await textoDecisao(page)), 'agora conta: Forma da decisão com complementações');
      let b2 = await txt(page, '#avpCuradoriaRevisao');
      afirma(!/Especialização anterior/.test(b2) && /Papel estrutural anterior/.test(b2), 'o bloco passa a mostrar só o Papel pendente');
      /* confirma o Papel */
      await page.click('#avpConfirmarPapelBtn');
      await esperaDb(page, () => window.__CFG.__dbReal['avaliacoes-produto'].rev.papelEstruturalCamadaConfirmada === 'componente');
      r = await reg(page, 'rev');
      aud = await auditoriaDe(page, 'rev');
      afirma(r.papelEstruturalCamadaConfirmada === 'componente' && aud.length === 2 && aud[1].tipo === 'alteracao_papel_estrutural' && aud[1].confirmacao === true, 'confirmar o Papel grava o marcador e a segunda linha de auditoria');
      afirma(await page.locator('#avpCuradoriaRevisao').count() === 0 && await page.locator('#avpPapelEstruturalCadastrado').inputValue() === 'essencial', 'o bloco some e o Papel passa a ser o vigente');
      await page.locator('#avpCuradoriaHistoricoDet summary').click();
      const histConf = await txt(page, '#avpCuradoriaHistorico');
      afirma(/Especialização confirmada: Instituto previdenciário/.test(histConf) && /Papel estrutural confirmado: Essencial/.test(histConf), 'o histórico mostra "Especialização confirmada" e "Papel estrutural confirmado" (não "alterada", sem seta)');
      afirma(/confirmada para a classificação/i.test(histConf) && !/—\s*→\s*Instituto/.test(histConf), 'e diz para qual classificação foi confirmada');
      afirma(await larguraOk(page), 'sem rolagem horizontal');
      await voltar(page);
    });

    await passo('D', async () => {
      console.log('\n== D. Alterar em vez de confirmar: passa a valer o valor novo ==');
      await abrirResultado(page, 'rev2');
      await page.fill('#avpEspecializacaoCadastrada', 'Valor novo');
      await page.selectOption('#avpPapelEstruturalCadastrado', 'opcional');
      await page.click('#avpSalvarEspecializacaoBtn');
      await esperaDb(page, () => window.__CFG.__dbReal['avaliacoes-produto'].rev2.especializacaoCadastrada === 'Valor novo');
      const r = await reg(page, 'rev2');
      afirma(r.especializacaoCadastrada === 'Valor novo' && r.papelEstruturalCadastrado === 'opcional' && r.especializacaoCamadaConfirmada === 'componente' && r.papelEstruturalCamadaConfirmada === 'componente', 'gravou os valores novos já vinculados a Componente');
      const aud = await auditoriaDe(page, 'rev2');
      const e = aud.find((x) => x.tipo === 'alteracao_especializacao');
      afirma(aud.length === 2 && e && e.valorNovo === 'Valor novo' && !e.valorAnterior && e.valorSemEfeitoSubstituido === ESP && !e.confirmacao, 'auditoria: a alteração registra o valor novo e guarda o valor anterior sem efeito que foi substituído');
      afirma(await page.locator('#avpCuradoriaRevisao').count() === 0 && /complementações/.test(await textoDecisao(page)), 'o bloco some e a curadoria passa a contar');
      await voltar(page);
    });

    await passo('E', async () => {
      console.log('\n== E. Salvar o Papel NÃO apaga a Especialização pendente de revisão ==');
      await abrirResultado(page, 'rev3');
      afirma(/Especialização anterior:\s*Instituto previdenciário/.test(await txt(page, '#avpCuradoriaRevisao')) && await page.locator('#avpPapelEstruturalCadastrado').inputValue() === 'essencial', 'Especialização a revisar; Papel já vigente');
      await page.selectOption('#avpPapelEstruturalCadastrado', 'opcional');
      await page.click('#avpSalvarEspecializacaoBtn');
      await esperaDb(page, () => window.__CFG.__dbReal['avaliacoes-produto'].rev3.papelEstruturalCadastrado === 'opcional');
      const r = await reg(page, 'rev3');
      afirma(r.papelEstruturalCadastrado === 'opcional' && r.especializacaoCadastrada === ESP && r.especializacaoCamadaConfirmada === SV, 'o Papel mudou; a Especialização antiga e o seu marcador ficaram intactos');
      afirma(/Especialização anterior/.test(await txt(page, '#avpCuradoriaRevisao')), 'a Especialização continua disponível para revisão');
      await voltar(page);
    });

    await passo('F', async () => {
      console.log('\n== F. Legado vigente, derivada, natureza e item limpo ficam fora do fluxo ==');
      const antes = await banco(page);
      await abrirResultado(page, 'cadx');
      afirma(await page.locator('#avpCuradoriaRevisao').count() === 0 && await page.locator('#avpCuradoriaSemEfeito').count() === 0 && await page.locator('#avpEspecializacaoCadastrada').inputValue() === ESP, 'legado sem marcador em camada que admite: segue vigente (como no #272), sem blocos');
      await voltar(page);
      for (const k of ['der', 'nat', 'limpo']) {
        await abrirResultado(page, k);
        afirma(await page.locator('#avpCuradoriaRevisao').count() === 0 && await page.locator('#avpCuradoriaSemEfeito').count() === 0, k + ': nenhum bloco');
        if (k === 'der') afirma(/Especialização identificada pelo questionário/.test(await txt(page, '.avp-alt-card')), 'der: a derivada segue à parte, na Classificação');
        await voltar(page);
      }
      afirma(JSON.stringify(await banco(page)) === JSON.stringify(antes), 'nada foi gravado só por abrir as fichas');
    });

    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  /* ---------- a camada MUDA (reprocessar): o vínculo é fixado no momento da mudança ---------- */
  console.log('\n######## camada muda e volta (desktop) ########');
  const STALE = '2026.08.01-1';
  const respComp = itemDe('x', 'componente').respostas;
  function reprocessavel(nome, camadaDasRespostas, cad) {
    const base = itemDe(nome, camadaDasRespostas, null, cad);
    const comp = itemDe(nome, 'componente', null, cad);
    return Object.assign(base, { motorVersion: STALE, camadaSugerida: comp.camadaSugerida, resultadoAutomatico: comp.resultadoAutomatico, decisaoFinal: comp.resultadoAutomatico });
  }
  let dbDepois = null;
  await passo('G1', async () => {
    console.log('\n== G1. Reprocessar muda a camada para Canal: o cadastro legado perde o vínculo, nada é apagado ==');
    const { ctx, page } = await abrir(browser, { avaliacoes: { rp: reprocessavel('Item Reproc', 'canal', CAD) } });
    afirma((await reg(page, 'rp')).camadaSugerida.id === 'componente' && !(await reg(page, 'rp')).especializacaoCamadaConfirmada, 'pré-condição: legado, camada gravada = Componente, sem marcador');
    await abrirResultado(page, 'rp');
    await page.click('#avpReprocessarBtn');
    await page.click('.avp-modal-confirm-btn');
    await esperaDb(page, () => window.__CFG.__dbReal['avaliacoes-produto'].rp.reprocessedAt);
    const r = await reg(page, 'rp');
    afirma(r.camadaSugerida.id === 'canal', 'a camada passou a Canal');
    afirma(r.especializacaoCadastrada === ESP && r.papelEstruturalCadastrado === 'essencial', 'cadastro preservado');
    afirma(r.especializacaoCamadaConfirmada === SV && r.papelEstruturalCamadaConfirmada === SV, 'marcadores: perderam o vínculo (a camada nova não admite os campos)');
    afirma(await page.locator('#avpCuradoriaSemEfeito').count() === 1, 'a ficha mostra "curadoria anterior sem efeito"');
    dbDepois = await banco(page);
    await ctx.close();
  });
  await passo('G2', async () => {
    console.log('\n== G2. Depois a camada volta a Componente: o cadastro NÃO volta sozinho ==');
    const av2 = JSON.parse(JSON.stringify(dbDepois['avaliacoes-produto']));
    Object.assign(av2.rp, { respostas: respComp, motorVersion: STALE });
    const { ctx, page } = await abrir(browser, { avaliacoes: av2 });
    await abrirResultado(page, 'rp');
    await page.click('#avpReprocessarBtn');
    await page.click('.avp-modal-confirm-btn');
    await esperaDb(page, () => window.__CFG.__dbReal['avaliacoes-produto'].rp.camadaSugerida.id === 'componente');
    const r = await reg(page, 'rp');
    afirma(r.camadaSugerida.id === 'componente' && r.camadaSugerida.especializacao !== ESP && !r.camadaSugerida.papelEstrutural, 'Componente de novo, e a camada calculada NÃO traz o cadastro antigo (só a derivada do questionário, se houver: esp=' + JSON.stringify(r.camadaSugerida.especializacao) + ' papel=' + JSON.stringify(r.camadaSugerida.papelEstrutural) + ')');
    afirma(r.especializacaoCadastrada === ESP && r.especializacaoCamadaConfirmada === SV, 'cadastro e marcador preservados');
    afirma(await page.locator('#avpCuradoriaRevisao').count() === 1 && await page.locator('#avpEspecializacaoCadastrada').inputValue() === '', 'a ficha oferece revisão; nada vigente');
    afirma(!/complementações/.test(await textoDecisao(page)), 'Forma da decisão não conta');
    await page.click('#avpConfirmarEspecializacaoBtn');
    await esperaDb(page, () => window.__CFG.__dbReal['avaliacoes-produto'].rp.especializacaoCamadaConfirmada === 'componente');
    const r2 = await reg(page, 'rp');
    afirma(r2.camadaSugerida.especializacao === ESP, 'depois de confirmar, a camada calculada passa a trazer a Especialização vigente');
    await ctx.close();
  });

  /* ---------- reavaliação: de Canal (cadastro sem efeito) para Componente ---------- */
  await passo('H', async () => {
    console.log('\n== H. Reavaliação leva o item de Canal a Componente: o cadastro vira "disponível para revisão" ==');
    const { ctx, page } = await abrir(browser, { avaliacoes: { cana: itemDe('Item Canal Antigo', 'canal', null, CAD) } });
    const antes = await banco(page);
    await abrirResultado(page, 'cana');
    await page.click('#avpReavaliarBtn');
    await page.waitForSelector('#avpConcluirBtn', { timeout: 5000 });
    await marcarRespostas(page, acharCamada('componente').m);
    await page.click('#avpConcluirBtn');
    await page.waitForSelector('#avpCuradoriaCard', { timeout: 8000 });
    await page.waitForTimeout(400);
    const b = await banco(page);
    const nova = Object.keys(b['avaliacoes-produto']).find((k) => !antes['avaliacoes-produto'][k]);
    const v2 = b['avaliacoes-produto'][nova] || {};
    afirma(v2.camadaSugerida && v2.camadaSugerida.id === 'componente', 'a v2 é Componente');
    afirma(v2.especializacaoCadastrada === ESP && v2.papelEstruturalCadastrado === 'essencial', 'a v2 preservou o cadastro');
    afirma(v2.especializacaoCamadaConfirmada === 'canal' && v2.papelEstruturalCamadaConfirmada === 'canal', 'e fixou o vínculo na camada anterior (Canal) — não vale para Componente sem confirmar');
    afirma(await page.locator('#avpCuradoriaRevisao').count() === 1 && await page.locator('#avpEspecializacaoCadastrada').inputValue() === '', 'a ficha da v2 oferece revisão e não conta como vigente');
    afirma(JSON.stringify(b['avaliacoes-produto'].cana) === JSON.stringify(antes['avaliacoes-produto'].cana), 'a v1 ficou idêntica');
    await ctx.close();
  });

  await browser.close();
  console.log('\n============================');
  console.log(falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
