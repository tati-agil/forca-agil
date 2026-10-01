/* NATUREZA COMPLEMENTAR — Clube de Benefícios e Mais Previ.
 *
 * Pedido "IMPLEMENTAR NATUREZA COMPLEMENTAR — CLUBE DE BENEFÍCIOS E MAIS
 * PREVI". A natureza complementar é uma descrição MANUAL e OPCIONAL do tipo
 * de item, independente da decisão e fora do motor. Dois casos reais:
 *   1. Clube de Benefícios PREVI — resultado "Não é Produto/Serviço
 *      Principal", camada Canal (P9 = SIM), recomendação do sistema aceita.
 *      Ganha "Plataforma/estrutura de benefícios e parcerias" sem perder o Canal.
 *   2. Programa Mais Previ — recomendação automática "A validar". Decisão
 *      manual "Não Produto/Serviço Principal" + "Programa transversal"; a
 *      recomendação automática continua "A validar" no histórico.
 *
 * O que prova (banco falso em persistenciaReal — grava/lê como o Firebase):
 *   - salvar a natureza NÃO muda camada, respostas, resultado automático,
 *     motorVersion, motorVersionArquitetura nem atualizadoEm, e não marca
 *     "Motor desatualizado";
 *   - a natureza existe com a recomendação aceita (não depende de decisão
 *     manual) e pode ser alterada/removida depois, sem reavaliar, reprocessar
 *     nem criar nova avaliação;
 *   - cada alteração grava auditoria (alteracao_natureza_complementar) com
 *     valorAnterior preservado — na MESMA gravação atômica;
 *   - as opções vêm do catálogo configurável (naturezas-complementares-config),
 *     editável pela tela; renomear/desativar nunca reescreve o que foi
 *     registrado (nome/descrição da época);
 *   - PDF (seção "Decisão arquitetural"), lista (coluna "Natureza", "—" se
 *     vazio) e Excel mostram a natureza;
 *   - reavaliar herda a natureza; o formato antigo ({id, rotulo}) continua
 *     sendo lido e é migrado; reprocessar em lote não a toca;
 *   - rede lenta (catálogo ainda não chegou) e falha de gravação;
 *   - celular (375 px).
 * Hermético: sem rede, sem segredo. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const SRC_AVP = fs.readFileSync(path.join(RAIZ, 'avaliacao-produto.js'), 'utf8');
const SRC_MOTOR = fs.readFileSync(path.join(RAIZ, 'motor-arquitetura.js'), 'utf8');
const MOTOR_VERSION = /var MOTOR_VERSION = '([^']+)'/.exec(SRC_AVP)[1];
const XLSX = require(path.join(RAIZ, 'xlsx.mini.min.js'));
const EMAIL = 'teste@previ.com.br';
const KEY = EMAIL.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

const CLUBE = 'Clube de Benefícios PREVI';
const MAIS_PREVI = 'Programa Mais Previ de Educação Financeira e Previdenciária';
const PLATAFORMA = 'Plataforma/estrutura de benefícios e parcerias';
const ORDEM = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao',
  'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
const CODIGO = {}; ORDEM.forEach((id, i) => { CODIGO[id] = 'P' + (i + 1); });
const MAIS_PREVI_SIM = { necessidade: 'sim', resultado: 'sim', solucao: 'sim', medicao: 'sim', gestao: 'sim' };

const CAMPOS_NATUREZA = ['naturezaComplementarCodigo', 'naturezaComplementarNomeNaEpoca', 'naturezaComplementarDescricaoNaEpoca',
  'naturezaComplementarDefinidaPor', 'naturezaComplementarDefinidaEm', 'naturezaComplementar'];
const semNatureza = (it) => { const c = JSON.parse(JSON.stringify(it)); CAMPOS_NATUREZA.forEach((k) => delete c[k]); return JSON.stringify(c); };
const copia = (v) => JSON.parse(JSON.stringify(v));

function itemBase(nome, valorDe, extra) {
  const respostas = {};
  ORDEM.forEach((id) => {
    const v = valorDe(id);
    respostas[id] = { valor: v, justificativaAuto: (v === 'sim' ? 'SIM — padrão.' : 'NÃO — padrão.'), observacao: '',
      codigoPergunta: CODIGO[id], textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 };
  });
  return Object.assign({
    nome: nome, descricao: '', publico: '', necessidade: '', observacoesGerais: '',
    status: 'concluido', respostas: respostas,
    resultadoAutomatico: 'a-validar', decisaoFinal: 'a-validar', decisaoManual: false, decisaoConfirmada: false,
    camadaSugerida: { id: 'a-validar', label: 'A validar', motivos: [], conflito: null, incoerencia: false, especializacao: null, papelEstrutural: null, relacao: null },
    justificativaAutomatica: 'As respostas não reúnem evidência suficiente.',
    criteriosEssenciaisFalhos: ['fronteira', 'autonomia'], exclusoesConflitantes: null, criteriosAtendidos: 5,
    motorVersion: MOTOR_VERSION, motorVersionArquitetura: 1, questionnaireContentVersion: 1,
    criadoEm: '2026-09-29T10:00:00.000Z', atualizadoEm: '2026-09-29T10:00:00.000Z',
    responsavel: { name: 'Teste', email: EMAIL }, versao: 1, versaoAnteriorKey: null, excluido: false
  }, extra || {});
}
const itemMaisPrevi = (extra) => Object.assign(itemBase(MAIS_PREVI, (id) => MAIS_PREVI_SIM[id] || 'nao'), { itemId: 'maisprevi' }, extra || {});
/* avaliação anterior à parametrização dos questionários e ao motor declarativo */
function itemLegado(nome, extra) {
  const it = itemBase(nome, (id) => (id === 'necessidade' ? 'sim' : 'nao'), {
    resultadoAutomatico: 'nao-produto', decisaoFinal: 'nao-produto', motorVersion: '2026.08.01-1',
    camadaSugerida: { id: 'canal', label: 'Canal', motivos: ['m'] }
  });
  delete it.motorVersionArquitetura; delete it.questionnaireContentVersion;
  ORDEM.forEach((id) => { delete it.respostas[id].questionnaireContentVersion; delete it.respostas[id].codigoPergunta; delete it.respostas[id].textoPerguntaNaEpoca; delete it.respostas[id].tituloNaEpoca; });
  return Object.assign(it, extra || {});
}

async function abrirApp(browser, avaliacoes, viewport, extra) {
  extra = extra || {};
  const admins = {}; admins[KEY] = { email: EMAIL };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {},
    'turmas-checkin': {}, 'turmas-espera': {}, 'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {},
    eventos: {}, 'turmas-publico': {}, 'eventos-publico': {}, 'avaliacoes-produto': avaliacoes, 'avaliacoes-squad': {},
    'motor-squad-config': {}, 'motor-squad-auditoria': {}, 'motor-arquitetura-auditoria': {} };
  Object.assign(db, extra.db || {});
  const cfg = { db: db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true, delays: extra.delays, fail: extra.fail };
  const ctx = await browser.newContext({ viewport: viewport || { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  /* captura o HTML do PDF no instante em que é montado (o PDF em si é imagem) */
  await ctx.addInitScript(`
    window.__pdfs = [];
    new MutationObserver(function (ms) {
      ms.forEach(function (m) { m.addedNodes.forEach(function (n) {
        if (n.nodeType !== 1 || n.parentNode !== document.body) return; /* só blocos reais do PDF, não as medições */
        var doc = n.classList && n.classList.contains('pdf-doc') ? n : (n.querySelector && n.querySelector('.pdf-doc'));
        if (!doc) return;
        var decisao = doc.querySelector('.pdf-decisao-bloco');
        window.__pdfs.push({ tudo: doc.innerText, decisao: decisao ? decisao.innerText : '' });
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
const avaliacoes = async (page) => (await banco(page))['avaliacoes-produto'] || {};
const auditoria = async (page, key) => Object.values(((await banco(page))['naturezas-complementares-auditoria'] || {})[key] || {});
const auditoriaCatalogo = async (page) => Object.values(((await banco(page))['naturezas-complementares-auditoria'] || {}).catalogo || {});
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
/* A natureza aparece como etiqueta sob o nome do item (não tem mais coluna própria): '' quando não há */
const naturezaNaLista = async (page, key) => { const l = linhaDe(page, key).locator('.avp-item-natureza'); return (await l.count()) ? (await l.innerText()).trim() : '—'; };
const linhaDe = (page, key) => page.locator('tr', { has: page.locator('[data-key="' + key + '"]') });

async function novaAvaliacao(page, nome, valorDe) {
  await page.click('#avpNovoBtn');
  await page.fill('#avpfNome', nome);
  await page.click('#avpIniciarBtn');
  await page.waitForTimeout(150);
  for (const id of ORDEM) await page.locator('#avpQuestion-' + id + ' .avp-choice-btn--' + valorDe(id)).click();
  await page.click('#avpConcluirBtn');
  await page.waitForSelector('#avpNaturezaBloco', { timeout: 8000 });
  await page.waitForTimeout(200);
}
async function abrirResultado(page, key) {
  await page.click('.avp-act-ver[data-key="' + key + '"]');
  await page.waitForSelector('#avpNaturezaBloco', { timeout: 6000 });
  await page.waitForFunction(() => !document.querySelector('#avpNaturezaComplementar').disabled, { timeout: 6000 }).catch(() => {});
}
async function salvarNatureza(page, codigo) {
  await page.selectOption('#avpNaturezaComplementar', codigo);
  await page.click('#avpSalvarNaturezaBtn');
  await page.waitForFunction(() => /Natureza complementar (salva|removida)/.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(200);
}
async function voltarLista(page) { await page.click('#avpVoltarListaResultado'); await page.waitForSelector('#avpNovoBtn'); await page.waitForTimeout(200); }
async function gerarPdf(page) {
  await page.evaluate(() => { window.__pdfs = []; });
  await Promise.all([page.waitForEvent('download', { timeout: 60000 }).catch(() => null), page.click('#avpGerarPdfBtn')]);
  await page.waitForTimeout(400);
  const pdf = await page.evaluate(() => {
    /* o PDF sai em blocos (e o html2pdf clona cada um): junta os textos distintos, na ordem */
    const textos = []; let decisao = '';
    (window.__pdfs || []).forEach((b) => { if (textos.indexOf(b.tudo) === -1) textos.push(b.tudo); if (!decisao && b.decisao) decisao = b.decisao; });
    return textos.length ? { tudo: textos.join('\n'), decisao: decisao } : null;
  });
  await page.waitForTimeout(800);
  return pdf;
}
async function lerExcel(page) {
  await page.click('#avpExportarBtn');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#avpExportarExcelTodas')]);
  const arq = path.join(require('os').tmpdir(), 'avp-natureza-' + Date.now() + '.xlsx');
  await dl.saveAs(arq);
  const wb = XLSX.read(fs.readFileSync(arq), { type: 'buffer' });
  const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  fs.unlinkSync(arq);
  return linhas;
}

/* A configuração (questionários, motores, naturezas) agora fica no ADMIN, fora da
   área Avaliação. Estes dois passos levam até lá e de volta. */
async function irAoAdmin(page) {
  await page.evaluate(() => { location.hash = '#admin'; });
  await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelArquitetura"]', { timeout: 8000 });
  await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
  /* o Admin lembra a subtela em que ficou: se não caiu no início, volta até ele */
  await page.waitForSelector('#avpConfigQuestionariosBtn, #avpConfigVoltar, #avpNaturezasVoltar, #avpMotoresVoltarLista, #avpUsuariosVoltar', { timeout: 8000 });
  if (!(await page.locator('#avpConfigQuestionariosBtn').count())) {
    await page.locator('#avpConfigVoltar, #avpNaturezasVoltar, #avpMotoresVoltarLista, #avpUsuariosVoltar').first().click();
  }
  await page.waitForSelector('#avpConfigQuestionariosBtn', { timeout: 8000 });
}
async function voltarParaAvaliacoes(page) {
  await page.evaluate(() => { location.hash = '#avaliacoes'; });
  await page.waitForSelector('#avpNovoBtn', { timeout: 8000 });
  await page.waitForTimeout(200);
}

(async () => {
  const browser = await chromium.launch();

  /* ========================================================================= */
  console.log('== CASO 1 — Clube de Benefícios: Canal, recomendação aceita, natureza "' + PLATAFORMA + '" ==');
  {
    const { ctx, page, erros } = await abrirApp(browser, { maisprevi: itemMaisPrevi() });
    /* o Clube é avaliado de verdade, pela tela: a camada Canal vem do motor real (P9 = SIM) */
    await novaAvaliacao(page, CLUBE, (id) => (id === 'necessidade' || id === 'canal' ? 'sim' : 'nao'));
    const key = Object.entries(await avaliacoes(page)).find(([, v]) => v.nome === CLUBE)[0];
    const antes = (await avaliacoes(page))[key];
    afirma(antes.camadaSugerida.id === 'canal' && antes.respostas.canal.valor === 'sim', 'pré-condição: camada = Canal, P9 = SIM (calculado pelo motor real)');
    afirma(antes.resultadoAutomatico === 'nao-produto' && !antes.decisaoManual, 'pré-condição: não é Produto/Serviço Principal, recomendação do sistema (sem decisão manual)');
    afirma(!antes.naturezaComplementarCodigo, 'pré-condição: sem natureza complementar');

    console.log('\n-- o campo: combobox opcional, opções vindas do catálogo --');
    const opcoes = await page.locator('#avpNaturezaComplementar option').allInnerTexts();
    afirma(opcoes.join('|') === 'Nenhuma|Programa transversal|' + PLATAFORMA, 'opções (catálogo, não hardcoded no componente): ' + opcoes.join(' | '));
    afirma(/Natureza complementar\s*\(opcional\)/.test(await page.locator('#avpNaturezaBloco label').first().innerText()), 'rótulo: "Natureza complementar (opcional)"');
    afirma(await page.locator('#avpNaturezaBloco').evaluate((el) => !!el.closest('.avp-decisao-card')), 'o campo está dentro da seção "Decisão arquitetural"');
    afirma(await page.locator('#avpSalvarNaturezaBtn').isDisabled(), 'SALVAR NATUREZA desabilitado enquanto nada mudou');
    afirma(await page.locator('input[name="avpDecisao"][value="auto"]').isChecked(), 'a recomendação do sistema continua selecionada (a natureza não exige decisão manual)');

    await salvarNatureza(page, 'PLATAFORMA_BENEFICIOS_PARCERIAS');
    const depois = (await avaliacoes(page))[key];
    afirma(depois.naturezaComplementarCodigo === 'PLATAFORMA_BENEFICIOS_PARCERIAS' && depois.naturezaComplementarNomeNaEpoca === PLATAFORMA, 'gravou código e nome da época: ' + depois.naturezaComplementarNomeNaEpoca);
    afirma(/benefícios e parcerias/.test(depois.naturezaComplementarDescricaoNaEpoca || ''), 'gravou a descrição da época');
    afirma(depois.naturezaComplementarDefinidaPor && depois.naturezaComplementarDefinidaPor.email === EMAIL && !isNaN(Date.parse(depois.naturezaComplementarDefinidaEm)), 'gravou quem definiu e quando');
    afirma(semNatureza(depois) === semNatureza(antes), 'TUDO o mais idêntico ao de antes: respostas, resultado automático, camada, decisão, motorVersion, motorVersionArquitetura, atualizadoEm');
    afirma(depois.camadaSugerida.id === 'canal' && depois.resultadoAutomatico === 'nao-produto' && depois.respostas.canal.valor === 'sim', 'camada continua Canal, P9 continua SIM, resultado continua "Não é Produto/Serviço Principal"');
    afirma(depois.motorVersion === antes.motorVersion && depois.motorVersionArquitetura === antes.motorVersionArquitetura, 'motorVersion e motorVersionArquitetura não mudaram');
    afirma(depois.decisaoManual === false && depois.decisaoFinal === 'nao-produto', 'decisão final continua "recomendação do sistema aceita"');
    const aud1 = await auditoria(page, key);
    afirma(aud1.length === 1 && aud1[0].tipo === 'alteracao_natureza_complementar' && aud1[0].avaliacaoId === key, 'auditoria: 1 linha, tipo alteracao_natureza_complementar, avaliacaoId');
    afirma(!aud1[0].valorAnterior && aud1[0].valorNovo.codigo === 'PLATAFORMA_BENEFICIOS_PARCERIAS' && aud1[0].valorNovo.nome === PLATAFORMA, 'auditoria: valorAnterior vazio, valorNovo = a plataforma');
    afirma(aud1[0].usuario && aud1[0].usuario.email === EMAIL && !isNaN(Date.parse(aud1[0].dataHora)), 'auditoria: usuario e dataHora');
    afirma(/Natureza complementar salva/.test(await page.locator('#avpFlashNatureza').innerText()) && /✓ NATUREZA SALVA/.test(await page.locator('#avpSalvarNaturezaBtn').innerText()) && await page.locator('#avpSalvarNaturezaBtn').isDisabled(),
      'tela: confirmação "salva" e botão "✓ NATUREZA SALVA" desabilitado');

    console.log('\n-- PDF: seção "Decisão arquitetural" (Classificação sugerida → Natureza → Decisão final) --');
    const pdf = await gerarPdf(page);
    afirma(!!pdf, 'HTML do PDF capturado');
    if (pdf) {
      const d = pdf.decisao.replace(/\s+/g, ' ');
      afirma(/Classificação sugerida Canal/.test(d) && new RegExp('Natureza complementar ' + PLATAFORMA.replace(/[/]/g, '\\/')).test(d) && /Decisão final Não é Produto\/Serviço Principal/.test(d), 'PDF: Classificação sugerida = Canal · Natureza = plataforma · Decisão final = Não é Produto/Serviço Principal');
      afirma(d.indexOf('Classificação sugerida') < d.indexOf('Natureza complementar') && d.indexOf('Natureza complementar') < d.indexOf('Decisão final'), 'PDF: ordem Classificação sugerida → Natureza complementar → Decisão final');
      afirma(/Forma da decisão Recomendação do sistema aceita/.test(d), 'PDF: a forma da decisão continua "Recomendação do sistema aceita"');
      afirma((pdf.tudo.match(/Natureza complementar/g) || []).length === 1, 'PDF: a natureza aparece uma única vez');
      afirma(!/Natureza complementar|benefícios e parcerias/.test(pdf.tudo.slice(0, pdf.tudo.indexOf('Decisão arquitetural'))), 'PDF: nada de natureza no resultado automático nem em "Como chegamos a essa conclusão"');
    }

    console.log('\n-- lista: natureza como etiqueta sob o item --');
    await voltarLista(page);
    const ths = await page.locator('.avp-tabela-wrap thead th').allInnerTexts();
    afirma(!ths.map((t) => t.trim().toLowerCase()).includes('natureza'), 'a natureza não ocupa coluna própria (lista enxuta): ' + ths.map((t) => t.trim()).filter(Boolean).join(' | '));
    const linhaClube = await linhaDe(page, key).innerText();
    afirma(/Canal/.test(linhaClube) && await naturezaNaLista(page, key) === PLATAFORMA, 'lista: Clube → Canal + natureza "' + PLATAFORMA + '"');
    afirma(await naturezaNaLista(page, 'maisprevi') === '—', 'lista: item sem natureza mostra "—"');
    afirma(await page.locator('.avp-tag-motor--desatualizado').count() === 0 && await page.locator('.avp-tag-motor--atual').count() === 2, 'nenhuma avaliação ficou "Motor desatualizado" — as duas seguem em "Motor atual"');
    afirma(await page.locator('#avpReprocessarTudoBtn').isDisabled(), 'nada a reprocessar (REPROCESSAR TUDO desabilitado)');

    console.log('\n-- Excel --');
    const linhas = await lerExcel(page);
    const iNat = linhas[0].indexOf('Natureza complementar');
    afirma(iNat !== -1, 'coluna "Natureza complementar" no Excel');
    const lClube = linhas.find((l) => l[1] === CLUBE), lMais = linhas.find((l) => l[1] === MAIS_PREVI);
    afirma(lClube && lClube[iNat] === PLATAFORMA, 'Excel: Clube = plataforma (mesmo com a recomendação aceita)');
    afirma(lMais && !lMais[iNat], 'Excel: sem natureza fica em branco');

    console.log('\n-- editar DEPOIS: sem reavaliar, sem reprocessar, sem nova avaliação --');
    const totalAntes = Object.keys(await avaliacoes(page)).length;
    await abrirResultado(page, key);
    afirma(await page.locator('#avpNaturezaComplementar').inputValue() === 'PLATAFORMA_BENEFICIOS_PARCERIAS', 'ao reabrir, o campo vem preenchido');
    const registro = (await page.locator('#avpNaturezaRegistro').innerText()).replace(/\s+/g, ' ');
    afirma(/^Registrada: Plataforma.* por \S+ em \d/.test(registro), 'mostra quem registrou e quando: ' + registro);
    const antesEd = (await avaliacoes(page))[key];
    await salvarNatureza(page, 'PROGRAMA_TRANSVERSAL');
    const edit = (await avaliacoes(page))[key];
    afirma(edit.naturezaComplementarCodigo === 'PROGRAMA_TRANSVERSAL' && edit.naturezaComplementarNomeNaEpoca === 'Programa transversal', 'natureza trocada para "Programa transversal"');
    afirma(semNatureza(edit) === semNatureza(antesEd) && edit.versao === 1, 'nada mais mudou; continua a versão 1');
    afirma(Object.keys(await avaliacoes(page)).length === totalAntes, 'nenhuma avaliação nova foi criada');
    let aud = await auditoria(page, key);
    const troca = aud.find((a) => a.valorNovo && a.valorNovo.codigo === 'PROGRAMA_TRANSVERSAL');
    afirma(aud.length === 2 && troca && troca.valorAnterior.codigo === 'PLATAFORMA_BENEFICIOS_PARCERIAS' && troca.valorAnterior.nome === PLATAFORMA, 'auditoria: o valor anterior foi PRESERVADO (2 linhas; a primeira continua lá)');
    afirma(aud.some((a) => a.valorNovo && a.valorNovo.codigo === 'PLATAFORMA_BENEFICIOS_PARCERIAS'), 'a linha da primeira gravação continua intacta (nada sobrescrito em silêncio)');
    await salvarNatureza(page, '');
    const vazio = (await avaliacoes(page))[key];
    afirma(!vazio.naturezaComplementarCodigo && !vazio.naturezaComplementarNomeNaEpoca && !vazio.naturezaComplementarDefinidaPor && !vazio.naturezaComplementarDefinidaEm, 'remover grava tudo vazio (null)');
    aud = await auditoria(page, key);
    const remocao = aud.find((a) => a.valorAnterior && a.valorAnterior.codigo === 'PROGRAMA_TRANSVERSAL');
    afirma(aud.length === 3 && remocao && !remocao.valorNovo, 'auditoria: a remoção também é registrada (valorAnterior = programa, valorNovo vazio)');
    afirma(/Natureza complementar removida/.test(await page.locator('#avpFlashNatureza').innerText()), 'tela: "Natureza complementar removida"');
    await voltarLista(page);
    afirma(await naturezaNaLista(page, key) === '—', 'lista: voltou a "—"');

    console.log('\n-- reavaliar herda a natureza (ela descreve o item, não uma rodada de respostas) --');
    await abrirResultado(page, key);
    await salvarNatureza(page, 'PLATAFORMA_BENEFICIOS_PARCERIAS');
    const natAntes = (await avaliacoes(page))[key];
    await voltarLista(page);
    await page.click('.avp-act-mais[data-key="' + key + '"]');
    await page.click('.avp-menu-item[data-acao="reavaliar"]');
    await page.waitForSelector('#avpConcluirBtn', { timeout: 6000 });
    await page.click('#avpConcluirBtn');
    await page.waitForSelector('#avpNaturezaBloco', { timeout: 8000 });
    await page.waitForTimeout(250);
    const todas = await avaliacoes(page);
    const nova = Object.entries(todas).find(([k, v]) => v.nome === CLUBE && v.versao === 2);
    afirma(!!nova && nova[1].versaoAnteriorKey === key, 'a reavaliação é um registro novo (versão 2)');
    afirma(nova && nova[1].naturezaComplementarCodigo === 'PLATAFORMA_BENEFICIOS_PARCERIAS' && nova[1].naturezaComplementarDefinidaEm === natAntes.naturezaComplementarDefinidaEm, 'a natureza foi herdada (mesmo código, mesma data/autoria da definição original)');
    afirma(todas[key].naturezaComplementarCodigo === 'PLATAFORMA_BENEFICIOS_PARCERIAS', 'a versão anterior manteve a sua');
    afirma(nova && nova[1].camadaSugerida.id === 'canal', 'a camada da reavaliação continua Canal (o motor decide pelas respostas)');

    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  /* ========================================================================= */
  console.log('\n== CASO 2 — Mais Previ: "A validar" preservado; decisão manual + "Programa transversal" ==');
  {
    const { ctx, page, erros } = await abrirApp(browser, { maisprevi: itemMaisPrevi() });
    const antes = (await avaliacoes(page)).maisprevi;
    afirma(antes.resultadoAutomatico === 'a-validar' && antes.camadaSugerida.id === 'a-validar', 'pré-condição: recomendação automática = A validar');
    await abrirResultado(page, 'maisprevi');
    const JUST = 'O Programa Mais Previ possui identidade, propósito, resultados e governança próprios, mas funciona como programa transversal que reúne diferentes iniciativas de educação financeira e previdenciária. Não apresenta fronteira única, jornada única nem autonomia estrutural suficientes para ser tratado como Produto/Serviço principal. Suas iniciativas podem ser avaliadas individualmente quando necessário.';
    await page.check('input[name="avpDecisao"][value="nao-produto"]');
    await page.fill('#avpJustificativaDecisao', JUST);
    await page.click('#avpSalvarDecisaoBtn');
    await page.waitForFunction(() => /Decisão salva/.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
    await salvarNatureza(page, 'PROGRAMA_TRANSVERSAL');
    const salvo = (await avaliacoes(page)).maisprevi;
    afirma(salvo.decisaoManual === true && salvo.decisaoFinal === 'nao-produto' && salvo.justificativaDecisao === JUST, 'decisão manual gravada: Não Produto/Serviço Principal + justificativa');
    afirma(salvo.naturezaComplementarCodigo === 'PROGRAMA_TRANSVERSAL' && salvo.naturezaComplementarNomeNaEpoca === 'Programa transversal', 'natureza gravada: Programa transversal');
    afirma(salvo.resultadoAutomatico === 'a-validar' && salvo.camadaSugerida.id === 'a-validar', 'a recomendação automática continua "A validar" (e a camada continua A validar)');
    afirma(JSON.stringify(salvo.respostas) === JSON.stringify(antes.respostas), 'respostas P1–P16 intactas');
    afirma(salvo.motorVersion === antes.motorVersion && salvo.motorVersionArquitetura === antes.motorVersionArquitetura, 'motorVersion e motorVersionArquitetura intactos');
    const resumo = await page.locator('#avpDecisaoResumo').innerText();
    afirma(/Recomendação automática\s+A validar/.test(resumo) && /Decisão arquitetural\s+Não é Produto\/Serviço Principal/.test(resumo), 'tela: a recomendação "A validar" segue visível ao lado da decisão manual');

    console.log('\n-- a decisão e a natureza são independentes --');
    await page.check('input[name="avpDecisao"][value="auto"]');
    await page.click('#avpSalvarDecisaoBtn');
    await page.waitForFunction(() => /Decisão salva/.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(200);
    const aceito = (await avaliacoes(page)).maisprevi;
    afirma(aceito.decisaoManual === false && aceito.decisaoFinal === 'a-validar', 'voltar a aceitar a recomendação desfaz a decisão manual');
    afirma(aceito.naturezaComplementarCodigo === 'PROGRAMA_TRANSVERSAL', 'a natureza NÃO é apagada por mudar a decisão');
    await page.check('input[name="avpDecisao"][value="nao-produto"]');
    await page.fill('#avpJustificativaDecisao', JUST);
    await page.click('#avpSalvarDecisaoBtn');
    await page.waitForFunction(() => /Decisão salva/.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(200);

    console.log('\n-- PDF (Mais Previ) --');
    const pdf = await gerarPdf(page);
    if (pdf) {
      const d = pdf.decisao.replace(/\s+/g, ' ');
      afirma(/Recomendação do sistema A validar/.test(d) && /Natureza complementar Programa transversal/.test(d) && /Decisão final Não é Produto\/Serviço Principal/.test(d), 'PDF: Recomendação A validar · Natureza Programa transversal · Decisão final Não Produto/Serviço Principal');
      afirma(d.indexOf('Natureza complementar') < d.indexOf('Decisão final'), 'PDF: a natureza vem antes da decisão final');
    } else afirma(false, 'HTML do PDF capturado');

    console.log('\n-- lista: A validar + natureza --');
    await voltarLista(page);
    const cels = await linhaDe(page, 'maisprevi').innerText();
    afirma(/A validar/.test(cels) && await naturezaNaLista(page, 'maisprevi') === 'Programa transversal', 'lista: Mais Previ → A validar + Programa transversal');
    afirma(await page.locator('.avp-tag-motor--desatualizado').count() === 0, 'não ficou "Motor desatualizado"');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  /* ========================================================================= */
  console.log('\n== CATÁLOGO configurável (naturezas-complementares-config) ==');
  {
    const snap = { naturezaComplementarCodigo: 'PROGRAMA_TRANSVERSAL', naturezaComplementarNomeNaEpoca: 'Programa transversal',
      naturezaComplementarDescricaoNaEpoca: 'descrição da época', naturezaComplementarDefinidaPor: { name: 'Teste', email: EMAIL }, naturezaComplementarDefinidaEm: '2026-09-29T12:00:00.000Z' };
    const { ctx, page, erros } = await abrirApp(browser, { maisprevi: itemMaisPrevi(snap), outro: itemBase('Item sem natureza', () => 'nao', { itemId: 'outro' }) });
    await irAoAdmin(page);
    await page.click('#avpConfigNaturezasBtn');
    await page.waitForSelector('#avpNaturezaNova', { timeout: 5000 });
    let linhas = await page.locator('#adminAvaliacaoProduto tbody tr').allInnerTexts();
    afirma(linhas.length === 2 && /PROGRAMA_TRANSVERSAL/.test(linhas[0]) && /PLATAFORMA_BENEFICIOS_PARCERIAS/.test(linhas[1]), 'tela do catálogo: as 2 opções de fábrica, com código estável');

    await page.click('#avpNaturezaNova');
    await page.fill('#avpNaturezaNome', 'Iniciativa estratégica');
    afirma(await page.locator('#avpNaturezaCodigo').innerText() === 'INICIATIVA_ESTRATEGICA', 'código gerado do nome (sem acento, maiúsculas)');
    await page.fill('#avpNaturezaDescricaoEd', 'Conjunto de ações com um objetivo comum.');
    await page.click('#avpNaturezaSalvar');
    await page.waitForFunction(() => /Opção criada/.test(document.body.innerText), { timeout: 6000 }).catch(() => {});
    let cfg = (await banco(page))['naturezas-complementares-config'] || {};
    afirma(cfg.INICIATIVA_ESTRATEGICA && cfg.INICIATIVA_ESTRATEGICA.nome === 'Iniciativa estratégica' && cfg.INICIATIVA_ESTRATEGICA.ativo === true && cfg.INICIATIVA_ESTRATEGICA.ordem === 3 && cfg.INICIATIVA_ESTRATEGICA.codigoEstavel === 'INICIATIVA_ESTRATEGICA',
      'gravou a opção nova: codigoEstavel, nome, descricao, ativo, ordem');
    afirma(await page.locator('#adminAvaliacaoProduto tbody tr').count() === 3, 'a tela já mostra a nova opção (3 linhas)');

    await page.click('#avpNaturezaNova');
    await page.fill('#avpNaturezaNome', 'iniciativa ESTRATÉGICA');
    await page.click('#avpNaturezaSalvar');
    afirma(/Já existe uma opção com esse nome/.test(await page.locator('#avpNaturezasErro').innerText()), 'nome repetido (ignorando caixa/acento) é recusado com aviso');
    await page.click('#avpNaturezaCancelar');

    /* renomear: o código é imutável e o que já foi registrado guarda o nome da época */
    await page.click('.avp-natureza-editar[data-codigo="PROGRAMA_TRANSVERSAL"]');
    afirma(await page.locator('#avpNaturezaCodigo').innerText() === 'PROGRAMA_TRANSVERSAL', 'editar: o código aparece e não muda');
    await page.fill('#avpNaturezaNome', 'Programa transversal (renomeado)');
    await page.click('#avpNaturezaSalvar');
    await page.waitForFunction(() => /Opção salva/.test(document.body.innerText), { timeout: 6000 }).catch(() => {});
    cfg = (await banco(page))['naturezas-complementares-config'];
    afirma(cfg.PROGRAMA_TRANSVERSAL.nome === 'Programa transversal (renomeado)', 'renomeada no catálogo');
    let audC = await auditoriaCatalogo(page);
    afirma(audC.some((a) => a.tipo === 'alteracao_catalogo_natureza' && a.codigo === 'PROGRAMA_TRANSVERSAL' && a.campo === 'nome' && a.valorAnterior === 'Programa transversal' && a.valorNovo === 'Programa transversal (renomeado)'), 'auditoria do catálogo: nome anterior preservado');

    /* desativar */
    await page.click('.avp-natureza-alternar[data-codigo="PLATAFORMA_BENEFICIOS_PARCERIAS"]');
    await page.waitForFunction(() => /Opção desativada/.test(document.body.innerText), { timeout: 6000 }).catch(() => {});
    cfg = (await banco(page))['naturezas-complementares-config'];
    afirma(cfg.PLATAFORMA_BENEFICIOS_PARCERIAS.ativo === false, 'desativada (nada é apagado: ativo = false)');

    await voltarParaAvaliacoes(page);
    afirma(await naturezaNaLista(page, 'maisprevi') === 'Programa transversal', 'lista: o item antigo segue com o NOME DA ÉPOCA, não com o renomeado');

    await abrirResultado(page, 'outro');
    let ops = (await page.locator('#avpNaturezaComplementar option').allInnerTexts()).join('|');
    afirma(ops === 'Nenhuma|Programa transversal (renomeado)|Iniciativa estratégica', 'item sem natureza: seletor com as opções ATIVAS e já renomeadas; a desativada some: ' + ops);
    await page.selectOption('#avpNaturezaComplementar', 'INICIATIVA_ESTRATEGICA');
    afirma(/Conjunto de ações/.test(await page.locator('#avpNaturezaDescricao').innerText()), 'mostra a descrição da opção escolhida');
    await voltarLista(page);
    await abrirResultado(page, 'maisprevi');
    ops = (await page.locator('#avpNaturezaComplementar option').allInnerTexts()).join('|');
    afirma(await page.locator('#avpNaturezaComplementar').inputValue() === 'PROGRAMA_TRANSVERSAL', 'item com natureza: continua selecionada');
    afirma(/Registrada:\s*Programa transversal\b(?! \()/.test((await page.locator('#avpNaturezaRegistro').innerText()).replace(/\s+/g, ' ')), 'o registro mostra o nome DA ÉPOCA');
    await salvarNatureza(page, 'INICIATIVA_ESTRATEGICA');
    await salvarNatureza(page, 'PROGRAMA_TRANSVERSAL');
    const reg = (await avaliacoes(page)).maisprevi;
    afirma(reg.naturezaComplementarNomeNaEpoca === 'Programa transversal (renomeado)', 'ao escolher de novo, grava o nome do catálogo de HOJE (nova decisão = nova época)');

    /* desativada mas já registrada: continua aparecendo no item que a usa */
    await voltarLista(page);
    await irAoAdmin(page);
    await page.click('#avpConfigNaturezasBtn');
    await page.waitForSelector('#avpNaturezaNova');
    await page.click('.avp-natureza-alternar[data-codigo="PLATAFORMA_BENEFICIOS_PARCERIAS"]');
    await page.waitForFunction(() => /Opção ativada/.test(document.body.innerText), { timeout: 6000 }).catch(() => {});
    afirma((await banco(page))['naturezas-complementares-config'].PLATAFORMA_BENEFICIOS_PARCERIAS.ativo === true, 'reativada');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  /* ========================================================================= */
  console.log('\n== COMPATIBILIDADE — formato antigo {id, rotulo} e reprocessamento em lote ==');
  {
    const antigo = itemBase('Item no formato antigo', () => 'nao', { itemId: 'antigo', decisaoManual: true, decisaoFinal: 'nao-produto', decisaoConfirmada: true, justificativaDecisao: 'j',
      alteradoPor: { name: 'Teste', email: EMAIL }, alteradoEm: '2026-09-29T11:00:00.000Z', naturezaComplementar: { id: 'programa', rotulo: 'Programa' } });
    const legadoComNatureza = itemLegado('Legada com natureza', { itemId: 'legada', naturezaComplementarCodigo: 'PLATAFORMA_BENEFICIOS_PARCERIAS', naturezaComplementarNomeNaEpoca: PLATAFORMA,
      naturezaComplementarDescricaoNaEpoca: 'd', naturezaComplementarDefinidaPor: { name: 'Teste', email: EMAIL }, naturezaComplementarDefinidaEm: '2026-09-29T12:00:00.000Z' });
    const { ctx, page, erros } = await abrirApp(browser, { antigo: antigo, legada: legadoComNatureza });
    afirma(await naturezaNaLista(page, 'antigo') === 'Programa', 'lista: o formato antigo continua aparecendo ("Programa")');
    await abrirResultado(page, 'antigo');
    afirma(await page.locator('#avpNaturezaComplementar').inputValue() === 'programa', 'tela: o seletor mostra a natureza antiga (mesmo fora do catálogo atual)');
    await salvarNatureza(page, 'PROGRAMA_TRANSVERSAL');
    const mig = (await avaliacoes(page)).antigo;
    afirma(mig.naturezaComplementarCodigo === 'PROGRAMA_TRANSVERSAL' && mig.naturezaComplementar === undefined, 'migrou para os campos novos e limpou o campo antigo');
    const a = await auditoria(page, 'antigo');
    afirma(a.length === 1 && a[0].valorAnterior.codigo === 'programa' && a[0].valorAnterior.nome === 'Programa', 'auditoria: o valor anterior (formato antigo) foi preservado');
    await voltarLista(page);

    console.log('\n-- reprocessar em lote NÃO toca na natureza --');
    const natAntes = (await avaliacoes(page)).legada;
    afirma(await page.locator('.avp-tag-motor--desatualizado').count() === 1, 'pré-condição: a avaliação legada está "Motor desatualizado"');
    await page.click('#avpReprocessarTudoBtn');
    await page.waitForSelector('#avpLoteConfirmar', { timeout: 3000 });
    await page.click('#avpLoteConfirmar');
    await page.waitForSelector('#avpLoteResumoFinal', { timeout: 15000 });
    const leg = (await avaliacoes(page)).legada;
    afirma(leg.motorVersion !== '2026.08.01-1', 'o reprocessamento rodou (motorVersion atualizado)');
    afirma(CAMPOS_NATUREZA.every((k) => JSON.stringify(leg[k]) === JSON.stringify(natAntes[k])), 'a natureza complementar permaneceu exatamente igual');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  /* ========================================================================= */
  console.log('\n== REDE LENTA e FALHA ==');
  {
    const { ctx, page, erros } = await abrirApp(browser, { maisprevi: itemMaisPrevi() }, null, { delays: { 'naturezas-complementares-config': 4000 } });
    await page.click('.avp-act-ver[data-key="maisprevi"]');
    await page.waitForSelector('#avpNaturezaBloco');
    afirma(await page.locator('#avpNaturezaComplementar').isDisabled() && /Carregando opções/.test(await page.locator('#avpNaturezaComplementar option').first().innerText()), 'catálogo ainda não chegou: seletor desabilitado em "Carregando opções…" (não assume a lista de fábrica)');
    afirma(await page.locator('#avpSalvarNaturezaBtn').isDisabled(), 'e o botão de salvar também');
    await page.waitForFunction(() => !document.querySelector('#avpNaturezaComplementar').disabled, { timeout: 9000 });
    afirma((await page.locator('#avpNaturezaComplementar option').allInnerTexts()).length === 3, 'quando o catálogo chega, o seletor habilita sozinho com as opções');
    await ctx.close();
  }
  {
    const { ctx, page } = await abrirApp(browser, { maisprevi: itemMaisPrevi() }, null, { fail: ['naturezas-complementares-config'] });
    await page.click('.avp-act-ver[data-key="maisprevi"]');
    await page.waitForSelector('#avpNaturezaBloco');
    await page.waitForTimeout(400);
    afirma(/Não foi possível carregar as opções/.test(await page.locator('#avpNaturezaBloco').innerText()) && await page.locator('#avpNaturezaComplementar').isDisabled(), 'catálogo com erro de leitura: aviso claro e seletor desabilitado (nunca uma lista inventada)');
    await ctx.close();
  }
  {
    const { ctx, page } = await abrirApp(browser, { maisprevi: itemMaisPrevi() }, null, { fail: ['naturezas-complementares-auditoria'] });
    await abrirResultado(page, 'maisprevi');
    const antes = (await avaliacoes(page)).maisprevi;
    await page.selectOption('#avpNaturezaComplementar', 'PROGRAMA_TRANSVERSAL');
    await page.click('#avpSalvarNaturezaBtn');
    await page.waitForFunction(() => /Não foi possível salvar a natureza/.test(document.body.innerText), { timeout: 6000 }).catch(() => {});
    afirma(/Não foi possível salvar a natureza complementar/.test(await page.locator('#avpNaturezaBloco').innerText()), 'falha ao gravar: a pessoa vê o erro (não some em silêncio)');
    afirma(JSON.stringify((await avaliacoes(page)).maisprevi) === JSON.stringify(antes), 'gravação atômica: se a auditoria não grava, a natureza também não (nada pela metade)');
    afirma(!(await page.locator('#avpSalvarNaturezaBtn').isDisabled()), 'o botão volta a ficar disponível para tentar de novo');
    await ctx.close();
  }

  /* ========================================================================= */
  console.log('\n== NÃO ALTERA O MOTOR e "se admin pode mexer, pode gravar" (checagens estáticas) ==');
  {
    const trecho = (nome) => { const i = SRC_AVP.indexOf('function ' + nome + '('); return SRC_AVP.slice(i, SRC_AVP.indexOf('\n  }\n', i)); };
    afirma(!/natureza/i.test(SRC_MOTOR), 'motor-arquitetura.js não menciona natureza');
    afirma(!/natureza/i.test(trecho('identificarCamada')) && !/natureza/i.test(trecho('computeResultado')), 'identificarCamada / computeResultado não leem a natureza');
    afirma(!/natureza/i.test(trecho('construirAtualizacaoReprocessamento')) && !/natureza/i.test(trecho('precisaReprocessar')), 'reprocessamento e "Motor desatualizado" não leem a natureza');
    const rules = JSON.parse(fs.readFileSync(path.join(RAIZ, '..', 'database.rules.json'), 'utf8')).rules;
    const admin = rules['questionarios-config']['.write'];
    afirma(rules['naturezas-complementares-config']['.write'] === admin && rules['naturezas-complementares-config']['.read'] === rules['questionarios-config']['.read'], 'regras: catálogo gravável por qualquer admin e legível como questionarios-config (consulta+ e admin) — quem abre a edição consegue gravar');
    /* a auditoria agora também aceita o GESTOR da avaliação criando entradas (o que a gravação da natureza de uma avaliação exige);
       o comportamento exato — quem lê, quem cria, ninguém altera — é provado no emulador (teste-rules-avaliacoes.js) */
    afirma(/fa-admins/.test(rules['naturezas-complementares-auditoria']['.write']) && /fa-admins/.test(rules['naturezas-complementares-auditoria']['.read']), 'regras: auditoria legível/gravável por admin (e, na gravação, pelo gestor da avaliação — ver teste de regras no emulador)');
    const html = fs.readFileSync(path.join(RAIZ, '..', 'index.html'), 'utf8');
    afirma(html.indexOf('naturezas-config.js') !== -1 && html.indexOf('naturezas-config.js') < html.indexOf('avaliacao-produto.js'), 'index.html carrega naturezas-config.js antes de avaliacao-produto.js');
  }

  /* ========================================================================= */
  console.log('\n== CELULAR (375 px) ==');
  {
    const { ctx, page, erros } = await abrirApp(browser, { maisprevi: itemMaisPrevi() }, { width: 375, height: 740 });
    afirma((await page.locator('.avp-item-natureza').count()) === 0, 'lista em cartões: item sem natureza não mostra etiqueta');
    await abrirResultado(page, 'maisprevi');
    afirma(await page.locator('#avpNaturezaComplementar').isVisible() && await larguraOk(page), 'resultado: campo visível e sem rolagem horizontal');
    await salvarNatureza(page, 'PROGRAMA_TRANSVERSAL');
    const box = await page.locator('#avpNaturezaBloco').boundingBox();
    afirma(box && box.x >= 0 && box.x + box.width <= 375, 'bloco da natureza cabe na tela (x ' + Math.round(box.x) + ' + ' + Math.round(box.width) + ' ≤ 375)');
    afirma((await avaliacoes(page)).maisprevi.naturezaComplementarCodigo === 'PROGRAMA_TRANSVERSAL', 'salvou no celular');
    await voltarLista(page);
    afirma(/Programa transversal/.test(await page.locator('.avp-item-natureza').first().innerText()), 'lista em cartões mostra a natureza salva');
    await irAoAdmin(page);
    await page.click('#avpConfigNaturezasBtn');
    await page.waitForSelector('#avpNaturezaNova');
    afirma(await larguraOk(page), 'catálogo: sem rolagem horizontal da página');
    await page.click('#avpNaturezaNova');
    const f = await page.locator('#avpNaturezaForm').boundingBox();
    afirma(f && f.x >= 0 && f.x + f.width <= 375 && await page.locator('#avpNaturezaSalvar').isVisible(), 'formulário do catálogo cabe na tela e o botão Salvar está visível');
    afirma(await larguraOk(page), 'formulário: sem rolagem horizontal da página');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  await browser.close();
  if (falhas) { console.log('\n' + falhas + ' FALHA(S)'); process.exit(1); }
  console.log('\nOK — natureza complementar: Clube continua Canal com "' + PLATAFORMA + '"; Mais Previ preserva "A validar" e aceita decisão manual + "Programa transversal"; nada do motor mudou.');
})().catch((e) => { console.error(e); process.exit(1); });
