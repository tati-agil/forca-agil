/* A FLORESTA — CONSULTAS DE CADA AVALIAÇÃO a partir de Trabalhos (correção da regressão das PRs #399/#400: as listas,
 * os filtros, as fichas e os PDFs tinham ficado no fim de Trabalhos, recolhidos, depois de uma lista que misturava
 * naturezas). Firebase falso em persistência real; hermético; nada é gravado. Desktop e 375 px. Percursos reais:
 *   1. A Floresta: "Continuar um trabalho" com acesso direto às quatro consultas.
 *   2. Trabalhos: as consultas (Produto/Serviço, Posicionamento, Squad, análises de áreas) vêm primeiro, à vista; os
 *      registros vêm depois, separados por tipo (nunca numa lista só).
 *   3. P1–P16: lista com busca, filtros e Exportar (Excel/PDF em lote) → busca "Capec" → ficha → "Gerar PDF" → Voltar à
 *      lista com a busca preservada → Voltar aos Trabalhos.
 *   4. O1–O9: lista com o filtro de históricas e Exportar → ficha de Capec → "Gerar PDF" → Voltar à lista.
 *   5. S1–S8: lista com filtro e Exportar → ficha de Capec → "Gerar PDF" → Voltar à lista.
 *   6. Análises de áreas: a lista abre.
 *   Sempre: nenhum erro de página e nenhuma rolagem lateral. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const SJ = require('./semente-jornada');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
let falhas = 0;
function afirma(c, msg, det) { console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + JSON.stringify(det) : '')); if (!c) falhas++; }
const CODIGOS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];
/* uma Adequação à Squad concluída de Capec (a mesma forma das sementes de teste-squad-exportacoes.js) */
function squadCapec() {
  const respostas = {};
  CODIGOS.forEach((c) => { respostas[c] = { codigoPergunta: c, textoPerguntaNaEpoca: 'Pergunta ' + c, resposta: 'sim', justificativaUsuario: 'ok ' + c, questionnaireContentVersion: 1 }; });
  return { itemNome: 'Capec', itemId: 'pCapec', avaliacaoArquiteturalId: 'pCapec', status: 'concluido', respostas, questionnaireContentVersion: 1, motorSquadVersion: 1,
    necessidadeCapacidadeDedicada: 'DEMONSTRADA', condicoesParaSquad: 'PRESENTES', indicacaoOrganizacional: 'FORTE_ADERENCIA_SQUAD_DEDICADA', evidenciasFavoraveis: CODIGOS, pontosADesenvolver: [],
    criadoPor: { name: 'Avaliadora', email: SJ.ARQ }, criadoEm: '2026-04-01T10:00:00.000Z', atualizadoEm: '2026-04-01T10:00:00.000Z', dataConclusao: '2026-04-01T11:00:00.000Z', excluido: false };
}
async function abrir(browser, vp, hash) {
  const db = SJ.semente();
  db['fa-admins'] = { [SJ.chave(SJ.ARQ)]: { email: SJ.ARQ, name: 'ADMIN' } };
  db['avaliacoes-squad'] = { sCapec: squadCapec() };
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify({ db, user: { email: SJ.ARQ, emailVerified: true, uid: 'u1' }, delayDefault: 5, persistenciaReal: true }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const hash = (page) => page.evaluate(() => location.hash);
const visivel = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && e.getBoundingClientRect().width > 0 && (!e.checkVisibility || e.checkVisibility()); }, sel);
const ver = (page, sel, d) => esperarCondicao(page, (s) => { const e = document.querySelector(s); return !!e && e.getBoundingClientRect().width > 0 && (!e.checkVisibility || e.checkVisibility()); }, sel, { limite: 15000, descricao: d || sel });
const naHash = (page, h, d) => esperarCondicao(page, (x) => location.hash === x, h, { limite: 15000, descricao: d || h });
const semRolagemLateral = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const topo = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top + window.scrollY : null; }, sel);
/* "Gerar PDF": o botão existe e gera o arquivo (o download do navegador) */
async function gerarPdf(page, sel) {
  /* sem .catch: se o PDF não for gerado, a espera falha e o teste reprova (esperas caladas são proibidas) */
  const [down] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click(sel)]);
  return /\.pdf$/i.test(down.suggestedFilename());
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [nome, vp] of [['desktop', { width: 1280, height: 900 }], ['375 px', { width: 375, height: 812 }]]) {
      console.log('\n######## ' + nome + ' ########');
      const { ctx, page, erros } = await abrir(browser, vp, '#arquitetura');

      console.log('\n== 1. A Floresta: acesso direto às consultas ==');
      await ver(page, '#avpInicioConsultas', 'as consultas no Início');
      const links = await page.$$eval('#avpInicioConsultas a', (as) => as.map((a) => a.getAttribute('href')));
      afirma(JSON.stringify(links) === JSON.stringify(['#arquitetura?av=lista', '#arquitetura?po=lista', '#arquitetura?sq=lista', '#arquitetura?an=lista']), 'Início: Produto/Serviço, Posicionamento, Adequação à Squad e Análises de áreas, a um clique', links);

      console.log('\n== 2. Trabalhos: consultas primeiro, registros separados por tipo ==');
      await page.click('#avpInicioTrabalhos');
      await ver(page, '#avpTrabIrProdutos', 'as consultas em Trabalhos');
      const ordem = [await topo(page, '#mfTrabListas'), await topo(page, '#mfTrabContinuarVaga'), await topo(page, '#mfCatalogo')];
      afirma(ordem[0] < ordem[1] && ordem[1] < ordem[2], 'Trabalhos: Consultar avaliações → Continuar de onde parou → Registros', ordem);
      afirma(await visivel(page, '#avpTrabIrPosicionamentos') && await visivel(page, '#avpTrabIrSquad') && await visivel(page, '#avpTrabIrAreas'), 'as quatro consultas à vista (nada recolhido)');
      /* a lista é redesenhada quando os dados chegam: espera os dois grupos e lê tudo de uma vez (no mesmo desenho) */
      await esperarCondicao(page, () => document.querySelectorAll('#mfItens .mf-grupo-tipo').length === 2, null, { limite: 15000, descricao: 'os dois grupos de registros' });
      const { grupos, ordemTipos } = await page.evaluate(() => {
        const ls = [...document.querySelectorAll('#mfItens > li')];
        return { grupos: ls.filter((l) => l.classList.contains('mf-grupo-tipo')).map((g) => g.textContent.replace(/\s+/g, ' ').trim()),
          ordemTipos: ls.map((l) => l.classList.contains('mf-grupo-tipo') ? 'G' : (/Responsabilidade/.test(l.textContent) ? 'R' : 'P')).join('') };
      });
      afirma(grupos.length === 2 && /^Produtos\/Serviços/.test(grupos[0]) && /^Responsabilidades organizacionais/.test(grupos[1]) && /^GP+GR+$/.test(ordemTipos), 'registros separados por tipo: Produtos/Serviços e Responsabilidades organizacionais', { grupos, ordemTipos });
      afirma(await semRolagemLateral(page), 'Trabalhos sem rolagem lateral');

      console.log('\n== 3. P1–P16: Capec → ficha → PDF → Voltar ==');
      await page.click('#avpTrabIrProdutos');
      await naHash(page, '#arquitetura?av=lista', 'a lista de Produto/Serviço');
      await esperarCondicao(page, () => document.querySelectorAll('#avaliacoesPainel .avp-table tbody tr').length > 0, null, { limite: 15000, descricao: 'as avaliações' });
      afirma(await visivel(page, '#avpBusca') && await visivel(page, '#avpFiltrosBtn') && await visivel(page, '#avpExportarBtn') && await visivel(page, '#avpLixeiraBtn'), 'lista P1–P16: busca, filtros, Exportar e Lixeira');
      await page.click('#avpExportarBtn');
      afirma(await visivel(page, '#avpExportarExcelFiltrados') && await visivel(page, '#avpExportarPdfFiltrados'), 'Exportar: Excel e PDF em lote');
      await page.click('#avpExportarBtn');
      await page.fill('#avpBusca', 'Capec');
      await esperarCondicao(page, () => document.querySelectorAll('#avaliacoesPainel .avp-table tbody tr').length === 1, null, { limite: 10000, descricao: 'a busca por Capec' });
      await page.click('.avp-act-ver[data-key="pCapec"]');
      await ver(page, '#avpGerarPdfBtn', 'a ficha de Capec');
      afirma(/^#arquitetura\?avp=pCapec/.test(await hash(page)), 'ficha P1–P16 de Capec aberta', await hash(page));
      afirma(await gerarPdf(page, '#avpGerarPdfBtn'), 'ficha P1–P16: "Gerar PDF" gera o arquivo');
      await page.click('#avpVoltarListaResultado');
      await naHash(page, '#arquitetura?av=lista', 'de volta à lista');
      afirma(await page.inputValue('#avpBusca') === 'Capec', 'Voltar: a lista com a busca "Capec" preservada');
      await page.click('#avpVoltarInicio');
      await ver(page, '#avpTrabIrPosicionamentos', 'os Trabalhos de novo');
      afirma(await hash(page) === '#arquitetura?tr=1', 'Voltar da lista: de volta aos Trabalhos (a origem)', await hash(page));

      console.log('\n== 4. O1–O9: Capec → ficha → PDF → Voltar ==');
      /* responsabilidades: a consulta com busca e os filtros por área e por situação */
      await page.click('#avpTrabIrResponsabilidades');
      await naHash(page, '#arquitetura?po=todas', 'todas as responsabilidades');
      await ver(page, '#poTodasBusca', 'a busca das responsabilidades');
      afirma(await visivel(page, '#poTodasArea') && await visivel(page, '#poTodasSituacao'), 'responsabilidades (O1–O9): busca e filtros por área e por situação');
      await page.goBack(); await ver(page, '#avpTrabIrPosicionamentos', 'os Trabalhos');
      await page.click('#avpTrabIrPosicionamentos');
      await naHash(page, '#arquitetura?po=lista', 'a lista de Posicionamento');
      await ver(page, '.po-abrir[data-key="gC"]', 'a avaliação de Capec na lista');
      afirma(await visivel(page, '#poExportarBtn'), 'lista O1–O9: Exportar (o filtro de históricas aparece quando há versões antigas, como antes)');
      await page.click('.po-abrir[data-key="gC"]');
      await ver(page, '#poGerarPdfBtn', 'a ficha O1–O9 de Capec');
      afirma(await gerarPdf(page, '#poGerarPdfBtn'), 'ficha O1–O9: "Gerar PDF" gera o arquivo');
      await page.click('#poVoltar');
      await naHash(page, '#arquitetura?po=lista', 'de volta à lista O1–O9');
      afirma(true, 'Voltar: a lista de Posicionamento');
      await page.goBack(); await ver(page, '#avpTrabIrSquad', 'os Trabalhos');
      afirma(await hash(page) === '#arquitetura?tr=1', 'Voltar do navegador: os Trabalhos', await hash(page));

      console.log('\n== 5. S1–S8: Capec → ficha → PDF → Voltar ==');
      await page.click('#avpTrabIrSquad');
      await naHash(page, '#arquitetura?sq=lista', 'a lista da Squad');
      await ver(page, '.sq-act-abrir[data-key="sCapec"]', 'a avaliação de Capec na lista da Squad');
      afirma(await visivel(page, '#sqFiltroTexto') && await visivel(page, '#sqExportarBtn'), 'lista S1–S8: filtro e Exportar');
      await page.click('.sq-act-abrir[data-key="sCapec"]');
      await ver(page, '#sqGerarPdfBtn', 'a ficha S1–S8 de Capec');
      afirma(await gerarPdf(page, '#sqGerarPdfBtn'), 'ficha S1–S8: "Gerar PDF" gera o arquivo');
      await page.click('#sqVoltarListaResultado');
      await naHash(page, '#arquitetura?sq=lista', 'de volta à lista S1–S8');
      afirma(true, 'Voltar: a lista da Squad');
      await page.click('#sqVoltarArquitetura');
      await ver(page, '#avpTrabIrAreas', 'os Trabalhos');
      afirma(await hash(page) === '#arquitetura?tr=1', 'Voltar da lista da Squad: os Trabalhos (a origem)', await hash(page));

      console.log('\n== 6. Análises de áreas ==');
      await page.click('#avpTrabIrAreas');
      await naHash(page, '#arquitetura?an=lista', 'a lista de análises');
      afirma(true, 'a lista de análises de áreas abre');
      afirma(erros.length === 0, 'nenhum erro de página', erros);
      await ctx.close();
    }
  } catch (e) { console.error(e); falhas++; }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
