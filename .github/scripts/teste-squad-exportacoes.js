/* Adequação à Squad — exportações (PR 6, parte 2):
 *   - Excel das avaliações (todas / filtradas / selecionadas), na ordem da tela:
 *     aba "Resumo" (uma linha por avaliação, com os vereditos por extenso) e aba
 *     "Respostas" (uma linha por resposta S1–S8, com a redação da época);
 *   - PDF consolidado (filtradas / selecionadas) pelo motor de blocos, SEM página
 *     em branco, também com muitas avaliações longas e no celular;
 *   - textos dos vereditos em Excel e PDF; o PDF individual segue igual.
 * Desktop e celular (375 px). Hermético: sem rede, sem segredo. */
const { chromium } = require('playwright');
const { esperarSessaoAssentada } = require('./esperas');
const fs = require('fs');
const path = require('path');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const XLSX = require(path.join(__dirname, '..', '..', 'forca-agil', 'xlsx.mini.min.js'));
const EMAIL = 'adm@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };
let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }
const longo = 'Texto longo de justificativa para encher a página. '.repeat(40);
const CODIGOS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];

function av(i, nome, extra, longa) {
  const respostas = {};
  CODIGOS.forEach((c, n) => { respostas[c] = { codigoPergunta: c, textoPerguntaNaEpoca: 'Pergunta ' + c + ' (época)', resposta: n % 3 ? 'sim' : 'nao', justificativaUsuario: longa ? longo : 'ok ' + c, questionnaireContentVersion: 1 }; });
  const n2 = String(i).padStart(2, '0');
  return Object.assign({
    itemNome: nome, itemId: 'i' + i, status: 'concluido', respostas, questionnaireContentVersion: 1, motorSquadVersion: 1,
    necessidadeCapacidadeDedicada: 'DEMONSTRADA', condicoesParaSquad: 'PRESENTES', indicacaoOrganizacional: 'FORTE_ADERENCIA_SQUAD_DEDICADA',
    evidenciasFavoraveis: ['S2', 'S3'], pontosADesenvolver: ['S1'], criadoPor: { name: 'Avaliadora ' + i, email: 'a' + i + '@previ.com.br' },
    criadoEm: '2026-04-' + n2 + 'T10:00:00.000Z', atualizadoEm: '2026-04-' + n2 + 'T10:00:00.000Z', dataConclusao: '2026-04-' + n2 + 'T11:00:00.000Z', excluido: false
  }, extra || {});
}
function paginasEImagens(buf) {
  const txt = buf.toString('latin1');
  const paginas = (txt.match(/\/Type\s*\/Page(?![s])/g) || []).length;
  const imgs = []; const objDaImagem = [];
  const re = /\/Filter\s*\/DCTDecode/g; let m;
  while ((m = re.exec(txt))) {
    let ini = txt.indexOf('stream', m.index); if (ini < 0) continue;
    const antes = txt.slice(0, m.index); const o = [...antes.matchAll(/(\d+) 0 obj/g)].pop();
    ini += 6; if (txt[ini] === '\r') ini++; if (txt[ini] === '\n') ini++;
    const fim = txt.indexOf('endstream', ini);
    imgs.push(buf.subarray(ini, fim).toString('base64')); objDaImagem.push(o ? Number(o[1]) : -1);
  }
  /* Imagens que alguma página DESENHA: o jsPDF não comprime o conteúdo das
     páginas, então "/I<n> Do" aparece em claro, e o dicionário de recursos liga
     "/I<n>" ao objeto da imagem. Uma imagem de uma página removida (a sobra em
     branco) fica no arquivo, mas nenhuma página a desenha. */
  const nomeParaObj = {}; for (const x of txt.matchAll(/\/I(\d+) (\d+) 0 R/g)) nomeParaObj[x[1]] = Number(x[2]);
  const usadasObj = new Set(); for (const x of txt.matchAll(/\/I(\d+) Do/g)) if (nomeParaObj[x[1]] != null) usadasObj.add(nomeParaObj[x[1]]);
  const usadas = []; objDaImagem.forEach((o, i) => { if (usadasObj.has(o)) usadas.push(i); });
  return { paginas, imgs, usadas };
}
/* o próprio Chromium decodifica o JPEG e mede quanto da imagem NÃO é branco */
async function proporcaoDeTinta(page, b64) {
  return page.evaluate(async (b64) => {
    const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([u], { type: 'image/jpeg' }));
    const c = document.createElement('canvas'); c.width = Math.min(bmp.width, 400); c.height = Math.min(bmp.height, 600);
    const g = c.getContext('2d'); g.drawImage(bmp, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height).data; let tinta = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235) tinta++;
    return tinta / (d.length / 4);
  }, b64);
}


async function abrir(browser, viewport, squad) {
  const admins = {}; admins[chave(EMAIL)] = { email: EMAIL };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-espera': {},
    'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {}, eventos: {}, 'turmas-publico': {}, 'eventos-publico': {},
    'avaliacoes-produto': {}, 'avaliacoes-squad': squad, 'motor-squad-config': {}, 'motor-squad-auditoria': {},
    'motor-arquitetura-config': {}, 'motor-arquitetura-auditoria': {}, 'fa-avaliacao-acessos': {} };
  const ctx = await browser.newContext({ viewport: viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  const erros = []; page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify({ db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true }) + ';');
  await ctx.addInitScript(`
    window.__blocos = [];
    new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) {
      if (n.nodeType !== 1 || n.parentNode !== document.body) return;
      var doc = n.classList && n.classList.contains('pdf-doc') ? n : (n.querySelector && n.querySelector('.pdf-doc'));
      if (doc && !doc.__visto) { doc.__visto = true; var t = doc.innerText; if (!window.__blocos.some(function (b) { return b.texto === t; })) window.__blocos.push({ texto: t, cab: !!doc.querySelector('.pdf-header'), altura: n.scrollHeight }); }
    }); }); }).observe(document, { childList: true, subtree: true });`);
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page); /* login decidido e acessos resolvidos (antes: opções no lugar do argumento, engolida) */
  await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelArquitetura"]', { timeout: 8000 });
  await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
  await page.waitForSelector('#avpAdequacaoSquadListaBtn', { timeout: 8000 });
  await page.click('#avpAdequacaoSquadListaBtn');
  await page.waitForSelector('#sqExportarBtn');
  return { ctx, page, erros };
}
async function baixar(page, abrirMenu, seletor) {
  await page.evaluate(() => { window.__blocos = []; }); /* os blocos observados valem só para ESTE arquivo */
  if (abrirMenu) await page.click(abrirMenu);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 280000 }), page.click(seletor)]);
  const arq = path.join(require('os').tmpdir(), 'sq-' + Date.now() + '-' + Math.random().toString(36).slice(2) + path.extname(dl.suggestedFilename()));
  await dl.saveAs(arq);
  const buf = fs.readFileSync(arq); fs.unlinkSync(arq);
  return { nome: dl.suggestedFilename(), buf };
}
const planilha = (buf, aba) => { const wb = XLSX.read(buf, { type: 'buffer', cellStyles: true }); return { wb, linhas: XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, defval: '' }) }; };
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const AV3 = () => ({
  a1: av(1, 'Item Alfa', {}), a2: av(2, 'Item Beta', { indicacaoOrganizacional: 'NECESSIDADE_SQUAD_DEDICADA_NAO_DEMONSTRADA', necessidadeCapacidadeDedicada: 'NAO_DEMONSTRADA', condicoesParaSquad: 'PARCIAIS' }),
  a3: av(3, 'Item Gama Rascunho', { status: 'rascunho', necessidadeCapacidadeDedicada: null, condicoesParaSquad: null, indicacaoOrganizacional: null, dataConclusao: null })
});
async function verificarPdf(page, r, esperados, titulo) {
  const { paginas, imgs, usadas } = paginasEImagens(r.buf);
  const tintas = []; for (const i of usadas) tintas.push(await proporcaoDeTinta(page, imgs[i]));
  afirma(paginas >= 1 && usadas.length >= 1, titulo + ': PDF com ' + paginas + ' página(s), ' + usadas.length + ' imagem(ns) realmente usada(s)');
  afirma(tintas.length && tintas.every((t) => t > 0.004), titulo + ': nenhuma página em branco (menor proporção de tinta entre as imagens usadas: ' + Math.min.apply(null, tintas).toFixed(4) + ')');
  const blocos = await page.evaluate(() => window.__blocos);
  const texto = blocos.map((b) => b.texto).join('\n');
  esperados.forEach((nome) => afirma((texto.match(new RegExp(nome, 'g')) || []).length === 1, titulo + ': "' + nome + '" aparece uma vez'));
  afirma(blocos.filter((b) => b.cab).length === 1 && blocos[0].cab, titulo + ': cabeçalho do relatório uma vez só, no primeiro bloco');
  afirma(Math.max.apply(null, blocos.map((b) => b.altura)) <= 4400, titulo + ': nenhum bloco passa da altura segura (maior: ' + Math.max.apply(null, blocos.map((b) => b.altura)) + ' px, ' + blocos.length + ' bloco(s))');
  return blocos;
}

(async () => {
  const browser = await chromium.launch();
  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');
    let { ctx, page, erros } = await abrir(browser, viewport, AV3());

    console.log('\n== Excel ==');
    await page.click('#sqExportarBtn');
    afirma(await page.locator('#sqExportarExcelFiltradas').count() === 1 && await page.locator('#sqExportarExcelTodas').count() === 1, 'Excel: filtradas e todas');
    afirma(await page.locator('#sqExportarExcelSelecionadas').count() === 0 && await page.locator('#sqExportarPdfSelecionadas').count() === 0, 'sem seleção: não oferece "só as selecionadas"');
    const ordemTela = await page.locator('.avp-table tbody tr td[data-label="Item"]').allTextContents();
    let r = await baixar(page, null, '#sqExportarExcelTodas');
    afirma(/^Avaliacoes_Adequacao_Squad_Todas_\d{4}-\d{2}-\d{2}\.xlsx$/.test(r.nome), 'nome: ' + r.nome);
    let pl = planilha(r.buf, 'Resumo');
    afirma(JSON.stringify(pl.wb.SheetNames) === JSON.stringify(['Resumo', 'Respostas']), 'abas: ' + pl.wb.SheetNames.join(' | '));
    afirma(pl.linhas.length === 4, 'Resumo: cabeçalho + 3 avaliações (' + pl.linhas.length + ' linhas)');
    afirma(JSON.stringify(pl.linhas.slice(1).map((l) => l[1])) === JSON.stringify(ordemTela), 'mesma ordem da tela: ' + ordemTela.join(', '));
    const alfa = pl.linhas.find((l) => l[1] === 'Item Alfa');
    afirma(/Demonstrada/.test(alfa[9]) && /Presentes/.test(alfa[10]) && /Forte aderência/.test(alfa[11]), 'vereditos por extenso (não o código): ' + alfa[9] + ' / ' + alfa[10]);
    afirma(alfa[3] === 'Concluída' && pl.linhas.find((l) => /Rascunho/.test(l[1]))[3] === 'Rascunho', 'status por extenso');
    afirma(pl.wb.Sheets.Resumo['!autofilter'] && pl.wb.Sheets.Resumo['!cols'].length === 15, 'autofiltro e larguras de coluna');
    const resp = planilha(r.buf, 'Respostas').linhas;
    afirma(resp.length === 1 + 3 * 8, 'Respostas: 8 respostas por avaliação (' + (resp.length - 1) + ')');
    afirma(resp[1][2] === 'S1' && /Pergunta S1 \(época\)/.test(resp[1][3]) && /^(SIM|NÃO)$/.test(resp[1][4]), 'respostas com código, redação da época e SIM/NÃO');
    await page.fill('#sqFiltroTexto', 'beta');
    r = await baixar(page, '#sqExportarBtn', '#sqExportarExcelFiltradas');
    afirma(/Filtradas/.test(r.nome) && planilha(r.buf, 'Resumo').linhas.length === 2 && planilha(r.buf, 'Resumo').linhas[1][1] === 'Item Beta', 'filtradas: só o item do filtro');
    await page.fill('#sqFiltroTexto', '');
    await page.locator('.sq-sel[aria-label="Selecionar Item Alfa"]').check();
    r = await baixar(page, '#sqExportarBtn', '#sqExportarExcelSelecionadas');
    afirma(/Selecionadas/.test(r.nome) && planilha(r.buf, 'Resumo').linhas.length === 2 && planilha(r.buf, 'Resumo').linhas[1][1] === 'Item Alfa', 'selecionadas: só a marcada');
    afirma(await larguraOk(page), 'sem rolagem horizontal na lista');

    console.log('\n== PDF (2 concluídas; o rascunho fica de fora) ==');
    await page.click('#sqExportarBtn');
    afirma(/2 concluídas/.test(await page.locator('#sqExportarPdfFiltradas').textContent()), 'PDF filtradas conta só as 2 concluídas');
    afirma(await page.locator('#sqExportarPdfSelecionadas').count() === 1, 'com seleção: oferece PDF só das selecionadas');
    r = await baixar(page, null, '#sqExportarPdfFiltradas');
    afirma(/^Avaliacoes_Adequacao_Squad_Filtradas_\d{4}-\d{2}-\d{2}\.pdf$/.test(r.nome), 'nome: ' + r.nome);
    await verificarPdf(page, r, ['Item Alfa', 'Item Beta'], 'PDF 2 avaliações');
    afirma(!/Item Gama Rascunho/.test((await page.evaluate(() => window.__blocos)).map((b) => b.texto).join('')), 'o rascunho não entra no PDF');

    console.log('\n== PDF individual segue igual ==');
    await page.locator('.sq-act-abrir[data-key="a2"]').click();
    await page.waitForSelector('#sqGerarPdfBtn');
    r = await baixar(page, null, '#sqGerarPdfBtn');
    afirma(/^Avaliacao_Adequacao_Squad_/.test(r.nome) && paginasEImagens(r.buf).paginas >= 1, 'PDF individual mantém o nome e gera: ' + r.nome);
    await page.click('#sqVoltarListaResultado');
    await page.waitForSelector('#sqExportarBtn');

    console.log('\n== Textos dos vereditos ==');
    await page.click('#sqMotorConfigBtn');
    await page.waitForSelector('#sqMotorVereditosExcelBtn');
    r = await baixar(page, null, '#sqMotorVereditosExcelBtn');
    pl = planilha(r.buf, 'Textos dos vereditos');
    afirma(/^Textos_Vereditos_Adequacao_Squad_/.test(r.nome) && pl.linhas.length === 12, 'Excel dos vereditos: cabeçalho + 11 textos (' + pl.linhas.length + ' linhas)');
    afirma(pl.linhas[1][0].indexOf('Eixo A') === 0 && pl.linhas[4][0].indexOf('Eixo B') === 0 && pl.linhas[7][0].indexOf('Combinação') === 0, 'agrupados em Eixo A, Eixo B e Combinação');
    afirma(pl.linhas.every((l, i) => i === 0 || (l[2] && l[3])), 'todo texto tem rótulo e interpretação');
    r = await baixar(page, null, '#sqMotorVereditosPdfBtn');
    await verificarPdf(page, r, ['Eixo A — Necessidade'], 'PDF dos vereditos');
    afirma(paginasEImagens(r.buf).paginas >= 1, 'PDF dos vereditos gerado: ' + r.nome);
    afirma(await larguraOk(page), 'sem rolagem horizontal no painel do motor');
    await ctx.close();
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
  }

  console.log('\n######## muitas avaliações longas (PDF em blocos) ########');
  const muitas = {}; for (let i = 1; i <= 8; i++) muitas['m' + i] = av(i, 'Avaliação longa ' + i, {}, true);
  const o = await abrir(browser, DESKTOP, muitas);
  const rr = await baixar(o.page, '#sqExportarBtn', '#sqExportarPdfFiltradas');
  const blocos = await verificarPdf(o.page, rr, Array.from({ length: 8 }, (_, i) => 'Avaliação longa ' + (i + 1) + '\\b'), 'PDF 8 avaliações longas');
  afirma(blocos.length >= 8, 'várias avaliações viram vários blocos (' + blocos.length + ')');
  const ordemPdf = blocos.map((b) => (/Avaliação longa (\d)/.exec(b.texto) || [])[1]).filter(Boolean);
  afirma(ordemPdf.join(',') === '8,7,6,5,4,3,2,1', 'ordem do PDF = ordem da tela (mais recente primeiro): ' + ordemPdf.join(','));
  await o.ctx.close();
  afirma(o.erros.length === 0, 'nenhum erro de JS (' + o.erros.length + ')');

  await browser.close();
  console.log('\n============================\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
