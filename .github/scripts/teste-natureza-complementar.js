/* NATUREZA COMPLEMENTAR — retirada (17/10/2026) com o histórico preservado.
 *
 * Decisão da responsável: a Natureza Complementar deixa de ser funcionalidade ativa (sem necessidade
 * arquitetural demonstrada além de P1–P16, da Taxonomia e do Posicionamento O1–O9). O campo e o
 * catálogo não aceitam mais operações; o que já foi registrado continua preservado e consultável.
 *
 * O que prova (banco falso em persistenciaReal — grava/lê como o Firebase), desktop e 375 px:
 *   - ficha: nenhum campo nem botão de natureza; a natureza já registrada aparece como "registro
 *     histórico" (nome e descrição DA ÉPOCA, quem registrou e quando), inclusive no formato antigo
 *     {id, rotulo}; sem natureza, nada aparece;
 *   - lista: a etiqueta continua, marcada como registro histórico;
 *   - PDF e Excel: "Natureza complementar (registro histórico)" com o valor gravado; a trilha do PDF
 *     traz a linha antiga da auditoria da natureza;
 *   - salvar de novo uma avaliação existente (rascunho com natureza no formato antigo) grava a
 *     natureza EXATAMENTE como estava — sem migrar, sem limpar;
 *   - reavaliar um item com natureza: a versão nova nasce sem ela; a anterior fica intacta;
 *   - ADMIN: sem o cadastro (nenhum cartão, nenhuma menção); o endereço antigo #admin?arq=naturezas
 *     cai no Início;
 *   - nada é gravado nos nós naturezas-complementares-config/-auditoria;
 *   - o módulo do catálogo (naturezas-config.js) saiu do site; o motor continua sem ler a natureza.
 * As regras do banco (ninguém grava os campos nem os nós; registro existente mantém o valor;
 * registro novo não o tem) são provadas no emulador: teste-rules-avaliacoes.js e
 * teste-rules-perfis-avaliacao.js. Hermético: sem rede, sem segredo. */
const { chromium } = require('playwright');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const fs = require('fs');
const path = require('path');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const RAIZ = path.join(__dirname, '..', '..');
const SRC_AVP = fs.readFileSync(path.join(RAIZ, 'forca-agil', 'avaliacao-produto.js'), 'utf8').replace(/\r\n/g, '\n');
const SRC_MOTOR = fs.readFileSync(path.join(RAIZ, 'forca-agil', 'motor-arquitetura.js'), 'utf8').replace(/\r\n/g, '\n');
const INDEX = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const MOTOR_VERSION = /var MOTOR_VERSION = '([^']+)'/.exec(SRC_AVP)[1];
const XLSX = require(path.join(RAIZ, 'forca-agil', 'xlsx.mini.min.js'));
const EMAIL = 'teste@previ.com.br';
const KEY = EMAIL.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
let falhas = 0;
function afirma(cond, msg, det) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && det !== undefined ? ' → ' + JSON.stringify(det) : '')); if (!cond) falhas++; }

const CLUBE = 'Clube de Benefícios PREVI';
const LEGADO = 'Programa Mais Previ (registro antigo)';
const SEM = 'Item sem natureza';
const RASCUNHO = 'Rascunho com natureza antiga';
const PLATAFORMA = 'Plataforma/estrutura de benefícios e parcerias';
const DESC_PLATAFORMA = 'Estrutura que reúne benefícios e parcerias oferecidos aos participantes.';
const ORDEM = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao',
  'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
const CODIGO = {}; ORDEM.forEach((id, i) => { CODIGO[id] = 'P' + (i + 1); });
const CAMPOS_NATUREZA = ['naturezaComplementarCodigo', 'naturezaComplementarNomeNaEpoca', 'naturezaComplementarDescricaoNaEpoca',
  'naturezaComplementarDefinidaPor', 'naturezaComplementarDefinidaEm', 'naturezaComplementar'];
const naturezaDe = (it) => { const o = {}; CAMPOS_NATUREZA.forEach((k) => { if (it && it[k] != null) o[k] = it[k]; }); return JSON.stringify(o); };

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
    resultadoAutomatico: 'nao-produto', decisaoFinal: 'nao-produto', decisaoManual: false, decisaoConfirmada: true,
    camadaSugerida: { id: 'canal', label: 'Canal', motivos: ['m'], conflito: null, incoerencia: false, especializacao: null, papelEstrutural: null, relacao: null },
    justificativaAutomatica: 'O item é um canal.', criteriosEssenciaisFalhos: [], exclusoesConflitantes: null, criteriosAtendidos: 2,
    motorVersion: MOTOR_VERSION, motorVersionArquitetura: 1, questionnaireContentVersion: 1,
    criadoEm: '2026-09-29T10:00:00.000Z', atualizadoEm: '2026-09-29T10:00:00.000Z',
    responsavel: { name: 'Teste', email: EMAIL }, versao: 1, versaoAnteriorKey: null, excluido: false
  }, extra || {});
}
const canal = (id) => (id === 'necessidade' || id === 'canal' ? 'sim' : 'nao');
function semente() {
  return {
    clube: itemBase(CLUBE, canal, { itemId: 'clube',
      naturezaComplementarCodigo: 'PLATAFORMA_BENEFICIOS_PARCERIAS', naturezaComplementarNomeNaEpoca: PLATAFORMA,
      naturezaComplementarDescricaoNaEpoca: DESC_PLATAFORMA, naturezaComplementarDefinidaPor: { name: 'Gigi', email: 'gigi@previ.com.br' },
      naturezaComplementarDefinidaEm: '2026-10-01T12:00:00.000Z' }),
    legado: itemBase(LEGADO, canal, { itemId: 'legado', naturezaComplementar: { id: 'PROGRAMA_TRANSVERSAL', rotulo: 'Programa transversal' },
      decisaoManual: true, justificativaDecisao: 'Programa transversal, não é produto.', alteradoPor: { name: 'Fulana', email: 'f@previ.com.br' }, alteradoEm: '2026-09-30T10:00:00.000Z' }),
    semnat: itemBase(SEM, canal, { itemId: 'semnat' }),
    rasc: itemBase(RASCUNHO, canal, { itemId: 'rasc', status: 'rascunho', naturezaComplementar: { id: 'PROGRAMA_TRANSVERSAL', rotulo: 'Programa transversal' } })
  };
}
const AUDITORIA_NATUREZA = () => ({
  clube: { a1: { tipo: 'alteracao_natureza_complementar', avaliacaoId: 'clube', valorAnterior: null, valorNovo: { codigo: 'PLATAFORMA_BENEFICIOS_PARCERIAS', nome: PLATAFORMA },
    usuario: { name: 'Gigi', email: 'gigi@previ.com.br' }, dataHora: '2026-10-01T12:00:00.000Z' } },
  catalogo: { c1: { tipo: 'alteracao_catalogo_natureza', codigo: 'PLATAFORMA_BENEFICIOS_PARCERIAS', campo: 'nome', valorAnterior: null, valorNovo: PLATAFORMA, usuario: { email: 'gigi@previ.com.br' }, dataHora: '2026-09-30T20:00:00.000Z' } }
});
const CATALOGO = () => ({ PLATAFORMA_BENEFICIOS_PARCERIAS: { codigoEstavel: 'PLATAFORMA_BENEFICIOS_PARCERIAS', nome: PLATAFORMA, descricao: DESC_PLATAFORMA, ativo: true, ordem: 2 } });

async function abrirApp(browser, viewport, hash) {
  const admins = {}; admins[KEY] = { email: EMAIL };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {},
    'turmas-checkin': {}, 'turmas-espera': {}, 'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {},
    eventos: {}, 'turmas-publico': {}, 'eventos-publico': {}, 'avaliacoes-produto': semente(), 'avaliacoes-squad': {},
    'motor-squad-config': {}, 'motor-squad-auditoria': {}, 'motor-arquitetura-auditoria': {},
    'naturezas-complementares-auditoria': AUDITORIA_NATUREZA(), 'naturezas-complementares-config': CATALOGO() };
  const cfg = { db: db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport: viewport, acceptDownloads: true });
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
        if (doc) window.__pdfs.push(doc.innerText);
      }); });
    }).observe(document, { childList: true, subtree: true });`);
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + (hash || '#avaliacoes?av=lista'), { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const nosNatureza = async (page) => { const b = await banco(page); return JSON.stringify([b['naturezas-complementares-config'] || null, b['naturezas-complementares-auditoria'] || null]); };
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const linhaDe = (page, key) => page.locator('tr', { has: page.locator('[data-key="' + key + '"]') });
async function irLista(page) {
  await page.evaluate(() => { location.hash = '#avaliacoes?av=lista'; });
  await page.waitForSelector('#avpNovoBtn', { timeout: 10000 });
  await esperarCondicao(page, () => document.querySelectorAll('.avp-act-ver').length >= 3, null, { descricao: 'a lista com as avaliações' });
}
async function abrirFicha(page, key) {
  await page.evaluate((k) => { location.hash = '#avaliacoes?avp=' + encodeURIComponent(k); }, key);
  await page.waitForSelector('#avpCuradoriaCard, #avpCuradoriaLeitura', { timeout: 10000 });
}
async function gerarPdf(page) {
  await page.evaluate(() => { window.__pdfs = []; });
  await Promise.all([page.waitForEvent('download', { timeout: 60000 }).catch(() => null), page.click('#avpGerarPdfBtn')]);
  await esperarCondicao(page, () => (window.__pdfs || []).length > 0, null, { limite: 20000, descricao: 'o PDF montado' });
  const textos = await page.evaluate(() => Array.from(new Set(window.__pdfs)));
  await page.waitForTimeout(600);
  return textos.join('\n').replace(/\s+/g, ' ');
}
async function lerExcel(page) {
  await page.click('#avpExportarBtn');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#avpExportarExcelTodas')]);
  const arq = path.join(require('os').tmpdir(), 'avp-natureza-' + Date.now() + '.xlsx');
  await dl.saveAs(arq);
  const wb = XLSX.read(fs.readFileSync(arq), { type: 'buffer' });
  fs.unlinkSync(arq);
  return wb;
}

(async () => {
  console.log('== Código: o catálogo saiu do site; o motor não lê a natureza ==');
  afirma(!/naturezas-config\.js/.test(INDEX) && !fs.existsSync(path.join(RAIZ, 'forca-agil', 'naturezas-config.js')), 'naturezas-config.js fora do index.html e do repositório');
  afirma(!/faNaturezas|renderNaturezaBloco|salvarNatureza|abrirConfigNaturezas|renderConfigNaturezas|gravarOpcaoNatureza/.test(SRC_AVP), 'avaliacao-produto.js: sem catálogo, sem tela de edição, sem salvamento da natureza');
  afirma(!/naturezaComplementar|naturezas-complementares|faNaturezas/.test(SRC_MOTOR), 'o motor arquitetural não lê a natureza complementar');

  const browser = await chromium.launch();
  try {
    for (const [nome, vp] of [['desktop', { width: 1280, height: 900 }], ['375 px', { width: 375, height: 812 }]]) {
      console.log('\n######## ' + nome + ' ########');
      const { ctx, page, erros } = await abrirApp(browser, vp);
      await irLista(page);
      const nosAntes = await nosNatureza(page);

      console.log('\n== Lista: a etiqueta continua, como registro histórico ==');
      const tag = async (k) => { const l = linhaDe(page, k).locator('.avp-item-natureza'); return (await l.count()) ? { t: (await l.innerText()).trim(), title: await l.getAttribute('title') } : null; };
      const tc = await tag('clube'), tl = await tag('legado'), ts = await tag('semnat');
      afirma(tc && tc.t === PLATAFORMA && /registro histórico/.test(tc.title), 'Clube: etiqueta com o nome da época, marcada como registro histórico', tc);
      afirma(tl && tl.t === 'Programa transversal', 'formato antigo {id, rotulo}: etiqueta com o rótulo', tl);
      afirma(ts === null, 'item sem natureza: nenhuma etiqueta');

      console.log('\n== Ficha: sem campo nem botão; o registro aparece como histórico ==');
      await abrirFicha(page, 'clube');
      afirma(await page.locator('#avpNaturezaComplementar, #avpSalvarNaturezaBtn, #avpNaturezaBloco').count() === 0, 'nenhum seletor nem botão SALVAR NATUREZA');
      const hist = await page.locator('#avpNaturezaHistorica').innerText().catch(() => '');
      afirma(/Natureza complementar/.test(hist) && /registro histórico/i.test(hist), 'bloco "Natureza complementar (registro histórico)" na Curadoria', hist);
      afirma(hist.includes(PLATAFORMA) && hist.includes(DESC_PLATAFORMA), 'nome e descrição DA ÉPOCA');
      afirma(/Registrada por Gigi em/.test(hist), 'quem registrou e quando');
      afirma(/não aceita mais alterações/.test(hist), 'aviso: campo retirado, só consulta');
      afirma(await page.locator('#avpNaturezaHistorica').evaluate((el) => !!el.closest('.avp-curadoria-card')), 'dentro da Curadoria arquitetural');
      afirma(await larguraOk(page), 'sem rolagem lateral');

      console.log('\n== PDF: o valor gravado e a trilha antiga ==');
      const pdf = await gerarPdf(page);
      afirma(pdf.includes('Natureza complementar (registro histórico) ' + PLATAFORMA), 'PDF: "Natureza complementar (registro histórico)" com o valor', pdf.slice(pdf.indexOf('O que uma pessoa complementou'), pdf.indexOf('O que uma pessoa complementou') + 200));
      afirma(/Natureza complementar \(registro histórico\): — → Plataforma\/estrutura de benefícios e parcerias/.test(pdf) && /Gigi/.test(pdf), 'PDF: trilha com a linha antiga da auditoria da natureza');

      console.log('\n== Fichas sem natureza e no formato antigo ==');
      await abrirFicha(page, 'semnat');
      afirma(await page.locator('#avpNaturezaHistorica').count() === 0 && !/Natureza complementar/.test(await page.locator('#avpCuradoriaCard, #avpCuradoriaLeitura').innerText()), 'sem natureza registrada: nada aparece');
      await abrirFicha(page, 'legado');
      afirma(/Programa transversal/.test(await page.locator('#avpNaturezaHistorica').innerText().catch(() => '')), 'formato antigo: aparece como registro histórico');

      console.log('\n== Excel: coluna de registro histórico ==');
      await irLista(page);
      const wb = await lerExcel(page);
      const res = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      const iNat = res[0].indexOf('Natureza complementar (registro histórico)');
      const lin = (n) => res.find((l) => l.indexOf(n) !== -1) || [];
      afirma(iNat !== -1 && res[0].indexOf('Natureza complementar') === -1, 'Resumo: coluna "Natureza complementar (registro histórico)"');
      afirma(lin(CLUBE)[iNat] === PLATAFORMA && lin(LEGADO)[iNat] === 'Programa transversal' && !lin(SEM)[iNat], 'Resumo: valores gravados (e vazio sem natureza)', [lin(CLUBE)[iNat], lin(LEGADO)[iNat], lin(SEM)[iNat]]);

      console.log('\n== Salvar de novo uma avaliação existente: a natureza fica EXATAMENTE como estava ==');
      const antesRasc = (await banco(page))['avaliacoes-produto'].rasc;
      await page.evaluate(() => { location.hash = '#avaliacoes?editar=rasc'; });
      await page.waitForSelector('#avpSalvarRascunhoBtn', { timeout: 10000 });
      await page.click('#avpSalvarRascunhoBtn');
      await esperarCondicao(page, () => { const r = window.__CFG.__dbReal['avaliacoes-produto'].rasc; return !!r && r.atualizadoEm !== '2026-09-29T10:00:00.000Z'; }, null, { descricao: 'o rascunho regravado' });
      const depoisRasc = (await banco(page))['avaliacoes-produto'].rasc;
      afirma(naturezaDe(depoisRasc) === naturezaDe(antesRasc) && !depoisRasc.naturezaComplementarCodigo, 'formato antigo preservado: sem migrar para os campos novos, sem limpar', naturezaDe(depoisRasc));

      console.log('\n== Reavaliar: a versão nova nasce sem natureza; a anterior fica intacta ==');
      const antesClube = (await banco(page))['avaliacoes-produto'].clube;
      await page.evaluate(() => { location.hash = '#avaliacoes?reavaliar=clube'; });
      await page.waitForSelector('#avpSalvarRascunhoBtn', { timeout: 10000 });
      await page.click('#avpSalvarRascunhoBtn');
      await esperarCondicao(page, () => Object.values(window.__CFG.__dbReal['avaliacoes-produto']).some((v) => v.versaoAnteriorKey === 'clube'), null, { descricao: 'a reavaliação gravada' });
      const db1 = await banco(page);
      const nova = Object.values(db1['avaliacoes-produto']).find((v) => v.versaoAnteriorKey === 'clube');
      afirma(naturezaDe(nova) === '{}', 'reavaliação: nenhum campo de natureza na versão nova', naturezaDe(nova));
      afirma(JSON.stringify(db1['avaliacoes-produto'].clube) === JSON.stringify(antesClube), 'a versão anterior (com o registro histórico) ficou intacta');

      console.log('\n== ADMIN: o cadastro foi retirado ==');
      await page.evaluate(() => { location.hash = '#admin?arq=naturezas'; });
      await page.waitForSelector('#avpQuestP1P16Btn', { timeout: 15000 });
      afirma(/^#admin\?arq=inicio$/.test(await page.evaluate(() => location.hash)) || await page.locator('#avpNaturezasVoltar').count() === 0, '#admin?arq=naturezas (link antigo): fica no Início, sem tela de catálogo');
      afirma(await page.locator('#avpConfigNaturezasBtn, #avpNaturezasVoltar, #avpNaturezaNova').count() === 0 && !/Naturez/i.test(await page.locator('#adminAvaliacaoProduto').innerText()), 'nenhum cartão nem menção às Naturezas no ADMIN');
      afirma(await page.locator('#avpGrupoDocumentacao #avpDocumentacaoBtn').count() === 1, 'os Documentos de referência continuam, no grupo Documentação');
      afirma(await larguraOk(page), 'sem rolagem lateral');

      afirma(await nosNatureza(page) === nosAntes, 'nada foi gravado em naturezas-complementares-config nem -auditoria (histórico intacto)');
      afirma(erros.length === 0, 'nenhum erro de página', erros);
      await ctx.close();
    }
  } catch (e) { console.error(e); falhas++; }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
