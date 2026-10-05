/* Motor arquitetural P1–P16 legível (PR 5 do prompt consolidado) — só apresentação:
 *   - cada condição mostra "P14 — <título real da pergunta>" e a resposta esperada,
 *     com título e texto vindos do questionário publicado;
 *   - texto fixo explica precedência, fallback, Simular impacto e rascunho × publicação;
 *   - a lógica NÃO muda: abrir, ler e simular não altera nenhuma regra nem versão.
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
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const regrasHoje = (page) => page.evaluate(() => JSON.stringify({ v: window.faMotorArquitetura.versaoAtual(), r: window.faMotorArquitetura.regrasDaVersao() }));

(async () => {
  const browser = await chromium.launch();
  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros } = await abrir(browser, viewport);
    await page.click('#avpConfigMotoresBtn');
    await page.waitForSelector('#avpMotorArqEditarBtn');
    const antes = await regrasHoje(page);

    console.log('\n== Painel dos motores ==');
    afirma(await page.locator('.avp-motor-explica').count() === 1, 'painel traz o bloco "Como este motor decide"');
    afirma(await larguraOk(page), 'sem rolagem horizontal no painel');

    console.log('\n== Editar regras ==');
    await page.click('#avpMotorArqEditarBtn');
    await page.waitForSelector('.sq-cond-select');
    const explica = page.locator('.avp-motor-explica');
    await explica.locator('summary').click();
    const t = await explica.innerText();
    afirma(/Precedência/.test(t) && /primeira/.test(t), 'explica a precedência');
    afirma(/Fallback/.test(t) && /A validar/.test(t), 'explica o fallback "A validar"');
    afirma(/Simular impacto/.test(t) && /não grava nada/i.test(t), 'explica o que o Simular impacto faz e que não grava');
    afirma(/Rascunho/.test(t) && /Publicar nova versão/.test(t) && /reprocessamento/.test(t), 'explica rascunho × publicação e que nada é reprocessado sozinho');

    const folhas = await page.locator('.sq-cond-folha--legivel').evaluateAll((els) => els.map((e) => ({
      codigo: e.querySelector('.sq-cond-pergunta strong').textContent,
      linha: e.querySelector('.sq-cond-pergunta').textContent,
      texto: (e.querySelector('.sq-cond-texto') || {}).textContent || '',
      sel: e.querySelector('select').value
    })));
    afirma(folhas.length >= 16, 'toda condição aparece no formato legível (' + folhas.length + ' condições)');
    const titulos = await page.evaluate(() => {
      const o = {}; for (let i = 1; i <= 16; i++) { const q = window.faQuestionarios.conteudoPergunta('CLASSIFICACAO_ARQUITETURAL', 'P' + i); o['P' + i] = { titulo: q.titulo, texto: q.texto }; } return o;
    });
    const semTitulo = folhas.filter((f) => !titulos[f.codigo] || f.linha !== f.codigo + ' — ' + titulos[f.codigo].titulo);
    afirma(semTitulo.length === 0, 'cada condição mostra "Pn — título real da pergunta" (' + semTitulo.length + ' fora do padrão)');
    afirma(folhas.every((f) => titulos[f.codigo] && f.texto === titulos[f.codigo].texto), 'o texto da pergunta aparece sob cada condição');
    const p14 = folhas.find((f) => f.codigo === 'P14');
    afirma(!!p14 && /Regra\/condição/.test(p14.linha), 'exemplo: ' + (p14 ? p14.linha : 'P14 ausente'));
    const rotulos = await page.locator('.sq-regra-card .sq-regra-codigo').allInnerTexts();
    afirma(rotulos.every((r) => /classifica como/.test(r)), 'cada regra diz "→ classifica como <classificação>"');
    afirma(await page.locator('.sq-regra-card .sq-cond-rotulo', { hasText: 'regra de fallback' }).count() === 1, 'a regra de fallback é explicada');
    afirma(await larguraOk(page), 'sem rolagem horizontal na edição');
    afirma(await page.locator('.sq-cond-select').count() === folhas.length, 'todos os seletores SIM/NÃO continuam editáveis');

    console.log('\n== Simular impacto ==');
    await page.click('#avpMotorArqSimularBtn');
    await page.waitForSelector('.avp-motor-sim-explica', { timeout: 8000 });
    afirma(/ainda são um rascunho/.test(await page.locator('.avp-motor-sim-explica').innerText()), 'a simulação diz que são regras em rascunho e que nada vale ainda');
    afirma(await larguraOk(page), 'sem rolagem horizontal na simulação');
    await page.click('#avpMotoresVoltarLista');
    await page.waitForSelector('.sq-cond-select');
    await page.click('#avpMotorArqCancelarBtn');
    const modal = page.locator('.avp-modal-confirm-btn');
    if (await modal.count()) await modal.click();
    await page.waitForSelector('#avpMotorArqEditarBtn');
    afirma(await regrasHoje(page) === antes, 'a lógica não mudou: regras publicadas idênticas depois de abrir, ler e simular');
    await ctx.close();
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
  }
  await browser.close();
  console.log('\n============================\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
