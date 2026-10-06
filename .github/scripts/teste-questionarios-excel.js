/* "Questionários e versões" (PR 4 do prompt consolidado):
 *   - novo nome da tela e texto explicativo no topo;
 *   - exportação para Excel da versão PUBLICADA: um questionário (uma linha por
 *     pergunta) e todos (uma aba por questionário); só leitura, sem importação;
 *   - o arquivo sai com acentos, colunas largas e autofiltro, e nunca inclui rascunho.
 * Desktop e celular (375 px). Hermético: sem rede, sem segredo. */
const { chromium } = require('playwright');
const { esperarSessaoAssentada } = require('./esperas');
const fs = require('fs');
const path = require('path');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const EMAIL = 'adm@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

async function abrir(browser, viewport) {
  const admins = {}; admins[chave(EMAIL)] = { email: EMAIL };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-espera': {},
    'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {}, eventos: {}, 'turmas-publico': {}, 'eventos-publico': {},
    'avaliacoes-produto': {}, 'avaliacoes-squad': {}, 'motor-squad-config': {}, 'motor-squad-auditoria': {},
    'motor-arquitetura-config': {}, 'motor-arquitetura-auditoria': {}, 'fa-avaliacao-acessos': {} };
  const cfg = { db: db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport: viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page); /* login decidido e acessos resolvidos (antes: opções no lugar do argumento, engolida) */
  await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelArquitetura"]', { timeout: 8000 });
  await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
  await page.waitForSelector('#avpConfigQuestionariosBtn', { timeout: 8000 });
  return { ctx, page, erros };
}
const XLSX = require(path.join(__dirname, '..', '..', 'forca-agil', 'xlsx.mini.min.js'));
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function baixar(page, seletor) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click(seletor)]);
  const caminho = await dl.path();
  const wb = XLSX.read(fs.readFileSync(caminho), { type: 'buffer', cellStyles: true });
  return { nome: dl.suggestedFilename(), wb };
}
const linhasDe = (wb, aba) => XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, defval: '' });

(async () => {
  const browser = await chromium.launch();
  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros } = await abrir(browser, viewport);
    await page.click('#avpConfigQuestionariosBtn');
    await page.waitForSelector('#avpIntroQuestionarios');

    console.log('\n== Nome e texto explicativo ==');
    afirma(/Questionários e versões/.test(await page.locator('#adminAvaliacaoProduto h3').first().textContent()), 'título da tela: "Questionários e versões"');
    afirma((await page.locator('#avpIntroQuestionarios').textContent()).trim() ===
      'Aqui são mantidas as perguntas e os textos usados nas avaliações. Alterações publicadas geram nova versão e não modificam avaliações já concluídas.', 'texto explicativo exato no topo');
    afirma(!/Configuração dos Questionários/.test(await page.locator('#adminAvaliacaoProduto').innerText()), 'o nome antigo não aparece mais na tela');
    afirma(await larguraOk(page), 'sem rolagem horizontal');

    console.log('\n== Exportar um questionário (arquitetural) ==');
    let r = await baixar(page, '.avp-config-exportar-btn[data-codigo="CLASSIFICACAO_ARQUITETURAL"]');
    afirma(/^Questionarios_Classificacao_arquitetural_Produto_Servico_v\d+_\d{4}-\d{2}-\d{2}\.xlsx$/.test(r.nome), 'nome do arquivo: ' + r.nome);
    afirma(JSON.stringify(r.wb.SheetNames) === JSON.stringify(['Classificação arquitetural']), 'uma aba: ' + r.wb.SheetNames.join(' | '));
    let l = linhasDe(r.wb, 'Classificação arquitetural');
    afirma(l.length === 17, 'cabeçalho + 16 perguntas (' + l.length + ' linhas)');
    afirma(l[0][2] === 'Código' && l[0][4] === 'Pergunta' && l[0][11] === 'Interpretação quando SIM', 'cabeçalho com acentos: ' + l[0].slice(0, 5).join(' | '));
    afirma(l[1][2] === 'P1' && l[16][2] === 'P16', 'ordem P1 … P16');
    afirma(/necessidade/i.test(l[1][4]) && /^SIM — /.test(l[1][11]) && /^NÃO — /.test(l[1][12]), 'P1 traz pergunta e as duas interpretações, com acento');
    afirma(l[1][5] !== '' && l[1][6] !== '' && l[1][7] !== '', 'ajuda (significado, quando SIM, quando NÃO) preenchida');
    afirma(r.wb.Sheets['Classificação arquitetural']['!autofilter'] && r.wb.Sheets['Classificação arquitetural']['!cols'].length === 14, 'autofiltro e 14 larguras de coluna');
    afirma(await page.locator('#avpCfgExportStatus').count() === 1 && !/FALHA|Não foi possível/.test(await page.locator('#avpCfgExportStatus').innerText()), 'mensagem de sucesso na tela');

    console.log('\n== Exportar o de squad e todos ==');
    r = await baixar(page, '.avp-config-exportar-btn[data-codigo="ADEQUACAO_SQUAD"]');
    l = linhasDe(r.wb, 'Adequação à Squad');
    afirma(l.length === 9 && l[1][2] === 'S1' && l[8][2] === 'S8', 'squad: cabeçalho + S1…S8 (' + l.length + ' linhas)');
    r = await baixar(page, '#avpCfgExportarTodosBtn');
    afirma(/^Questionarios_Todos_\d{4}-\d{2}-\d{2}\.xlsx$/.test(r.nome), 'nome do arquivo de todos: ' + r.nome);
    afirma(JSON.stringify(r.wb.SheetNames) === JSON.stringify(['Classificação arquitetural', 'Adequação à Squad']), 'uma aba por questionário: ' + r.wb.SheetNames.join(' | '));
    afirma(linhasDe(r.wb, 'Classificação arquitetural').length === 17 && linhasDe(r.wb, 'Adequação à Squad').length === 9, 'as duas abas completas');

    console.log('\n== Só a versão publicada: rascunho não entra ==');
    await page.click('.avp-config-editar-btn[data-codigo="CLASSIFICACAO_ARQUITETURAL"]');
    await page.waitForSelector('#avpCfgSalvarRascunhoBtn');
    await page.locator('[data-campo="texto"]').first().fill('TEXTO SOMENTE NO RASCUNHO');
    await page.click('#avpCfgSalvarRascunhoBtn');
    await page.waitForSelector('.avp-flash-success');
    await page.click('#avpConfigVoltar');
    await page.waitForSelector('.avp-config-exportar-btn');
    r = await baixar(page, '.avp-config-exportar-btn[data-codigo="CLASSIFICACAO_ARQUITETURAL"]');
    afirma(!/TEXTO SOMENTE NO RASCUNHO/.test(JSON.stringify(linhasDe(r.wb, 'Classificação arquitetural'))), 'o texto do rascunho não vai para o Excel');
    afirma(await larguraOk(page), 'sem rolagem horizontal ao final');
    await ctx.close();
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
  }
  await browser.close();
  console.log('\n============================\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
