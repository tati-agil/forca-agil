/* Menu superior em notebook e celular: o "Sair" (e todo o menu) sempre alcançável.
 *
 * O smoke test com login real mostrou o defeito: com todos os itens do menu
 * (administradora — Início … Admin, 11 itens + nome + Sair), em 1280 px o "Sair"
 * ficava com a borda direita em 1408 px, FORA da tela, e o menu tinha 1421 px.
 * Agora: 1241–1499 px usa o menu compacto, até 1240 px vira hamburguer.
 *
 * Prova, em larguras de celular a monitor grande, com um nome LONGO no menu:
 *   - o "Sair" está inteiro dentro da tela e nada o cobre;
 *   - o menu não passa da largura da tela e não há rolagem horizontal;
 *   - no menu completo, os itens não encostam na marca; no hamburguer, ele abre
 *     e todos os 11 itens ficam dentro da tela e alcançáveis.
 * Hermético: sem rede, sem segredo. */
const { chromium } = require('playwright');
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
  const cfg = { db: db, user: { email: EMAIL, emailVerified: true, uid: 'u1', displayName: 'Maria Aparecida de Souza Albuquerque Neto' }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport: viewport });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.body.classList.contains('aguardando-auth'), { timeout: 16000 }).catch(() => {});
  await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelArquitetura"]', { timeout: 8000 });
  await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
  await page.waitForSelector('#avpConfigQuestionariosBtn', { timeout: 8000 });
  return { ctx, page, erros };
}

const LARGURAS = [375, 600, 601, 768, 920, 921, 1024, 1180, 1240, 1241, 1280, 1366, 1440, 1499, 1500, 1920];

(async () => {
  const browser = await chromium.launch();
  for (const w of LARGURAS) {
    const { ctx, page, erros } = await abrir(browser, { width: w, height: 720 });
    await page.evaluate(() => { location.hash = '#turmas'; });
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const nav = document.querySelector('.nav');
      const sair = document.getElementById('navLogout');
      const bb = sair.getBoundingClientRect();
      const cx = Math.round(bb.left + bb.width / 2), cy = Math.round(bb.top + bb.height / 2);
      const topo = document.elementFromPoint(cx, cy);
      const tog = document.querySelector('.nav-toggle');
      const links = document.querySelector('.nav-links');
      const itens = Array.from(links.querySelectorAll('a')).filter((a) => !a.hidden && getComputedStyle(a).display !== 'none');
      const marca = document.querySelector('.brand').getBoundingClientRect();
      return {
        esq: Math.round(bb.left), dir: Math.round(bb.right), larg: window.innerWidth,
        navScroll: nav.scrollWidth, pagScroll: document.documentElement.scrollWidth,
        sairVisivel: sair.offsetParent !== null, sairNoTopo: topo === sair || sair.contains(topo),
        hamb: getComputedStyle(tog).display !== 'none', nItens: itens.length,
        sobrepoeMarca: getComputedStyle(links).position !== 'absolute' && itens.some((a) => a.getBoundingClientRect().left < marca.right - 1)
      };
    });
    const rot = w + ' px';
    afirma(r.sairVisivel && r.esq >= 0 && r.dir <= r.larg, rot + ': "Sair" inteiro dentro da tela (' + r.esq + '–' + r.dir + ' de ' + r.larg + ')');
    afirma(r.sairNoTopo, rot + ': nada cobre o "Sair" (dá para clicar)');
    afirma(r.navScroll <= r.larg && r.pagScroll <= r.larg + 1, rot + ': o menu e a página não passam da largura (menu ' + r.navScroll + ', página ' + r.pagScroll + ')');
    afirma(r.nItens >= 11, rot + ': todos os itens do menu existem (' + r.nItens + ')');
    afirma(!r.sobrepoeMarca, rot + ': os itens não encostam na marca');
    afirma(r.hamb === (w <= 1240), rot + ': ' + (w <= 1240 ? 'hamburguer' : 'menu completo') + ' na faixa certa');
    if (w > 600) {
      /* o nome ao lado do "Sair" continua visível e clicável (o smoke real, em 1280 px, clica nele) */
      const nome = await page.evaluate(() => { const n = document.querySelector('#navProfile .nav-profile-name'); if (!n) return null; const b = n.getBoundingClientRect(); return { vis: n.offsetParent !== null, esq: Math.round(b.left), dir: Math.round(b.right), larg: window.innerWidth }; });
      afirma(!!nome && nome.vis && nome.esq >= 0 && nome.dir <= nome.larg, rot + ': o nome ao lado do "Sair" aparece inteiro na tela');
      await page.click('#navProfile .nav-profile-name', { timeout: 4000 });
      await page.waitForFunction(() => location.hash === '#treinamento', null, { timeout: 4000 }).catch(() => {});
      afirma(await page.evaluate(() => location.hash) === '#treinamento', rot + ': clicar no nome leva para o Treinamento');
      await page.evaluate(() => { location.hash = '#turmas'; });
      await page.waitForTimeout(300);
    }
    if (r.hamb) {
      await page.click('.nav-toggle');
      await page.waitForSelector('.nav-links.open', { timeout: 3000 });
      await page.waitForTimeout(450);
      const m = await page.evaluate(() => {
        const itens = Array.from(document.querySelectorAll('.nav-links.open a')).filter((a) => !a.hidden && getComputedStyle(a).display !== 'none');
        const rs = itens.map((a) => a.getBoundingClientRect());
        return { n: itens.length, dentro: rs.every((b) => b.left >= 0 && b.right <= window.innerWidth + 1 && b.height > 0), ultimoBaixo: Math.round(Math.max.apply(null, rs.map((b) => b.bottom))), alt: window.innerHeight };
      });
      afirma(m.n >= 11 && m.dentro, rot + ': hamburguer aberto mostra os ' + m.n + ' itens, todos dentro da largura da tela');
      afirma(m.ultimoBaixo <= m.alt, rot + ': o último item do menu aberto fica visível sem rolar (' + m.ultimoBaixo + ' de ' + m.alt + ')');
    }
    await ctx.close();
    afirma(erros.length === 0, rot + ': nenhum erro de JS');
  }
  await browser.close();
  console.log('\n============================\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
