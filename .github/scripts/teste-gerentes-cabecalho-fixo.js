/* ADMIN › Gerentes: os títulos das colunas continuam à vista ao descer a lista. Firebase falso; 1280 px, 900 px e 375 px.
 *
 * O QUE ELE EXIGE:
 *   1. 1280 px: rolando a página até o meio da lista, os títulos ficam logo abaixo do menu, sem rolagem interna;
 *   2. 900 e 375 px: a tabela rola por dentro e os títulos ficam no topo do quadro, que não passa da tela;
 *   3. nos três: fundo opaco (as linhas não aparecem por trás), os 6 títulos presentes, e o título acompanha a coluna quando
 *      a tabela rola para o lado; sem rolagem lateral da página; nenhum erro de JavaScript. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const ADM = 'adm@previ.com.br';

function banco() {
  const gerentes = {};
  for (let i = 1; i <= 40; i++) { const e = 'gerente.' + i + '@previ.com.br'; gerentes[chave(e)] = { email: e, name: 'GERENTE ' + i, addedAt: '2026-10-23T14:35:00.000Z' }; }
  return {
    'fa-users': { [chave(ADM)]: { name: 'ADMIN', email: ADM, area: 'INFOR' } }, 'fa-admins': { [chave(ADM)]: { email: ADM, name: 'ADMIN' } }, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-gerentes': gerentes, 'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {}, avaliacoes: {}, pedidos: {}, holocron: {}
  };
}

(async () => {
  const browser = await chromium.launch();
  let falhas = 0, oks = 0;
  const anota = (r, ok, d) => { if (ok) { oks++; console.log('  ok    ' + r); } else { falhas++; console.error('  FALHA ' + r + (d ? ' — ' + d : '')); } };
  try {
    for (const [nome, opt, interna] of [
      ['1280 px', { viewport: { width: 1280, height: 800 } }, false],
      ['900 px', { viewport: { width: 900, height: 800 } }, true],
      ['375 px', { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, true]
    ]) {
      const ctx = await browser.newContext(opt);
      const page = await ctx.newPage();
      const erros = [];
      page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
      await page.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(), user: { email: ADM, emailVerified: true, uid: 'u-adm' }, delayDefault: 5 }) + ';');
      await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
      await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
      await page.route('**fonts.gstatic.com**', (r) => r.abort());
      await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
      await esperarSessaoAssentada(page);
      await esperarCondicao(page, () => Array.from(document.querySelectorAll('.admin-tab-btn')).some((x) => x.textContent.trim() === 'Gerentes'), null, { limite: 15000, descricao: 'a aba Gerentes' });
      await page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => x.textContent.trim() === 'Gerentes').click());
      await esperarCondicao(page, () => document.querySelectorAll('#adminGerentes tbody tr').length === 40, null, { limite: 15000, descricao: 'as 40 linhas' });

      /* desce até o meio da lista: a página (desktop) ou o quadro (tela menor) */
      await page.evaluate((interna) => {
        document.documentElement.style.scrollBehavior = 'auto';
        const w = document.querySelector('#adminGerentes .table-scroll-wrap'), l = document.querySelectorAll('#adminGerentes tbody tr')[20];
        if (interna) { w.scrollIntoView({ block: 'center' }); w.scrollTop = l.offsetTop - 100; } else window.scrollTo(0, l.getBoundingClientRect().top + window.scrollY - 300);
      }, interna);
      await page.waitForTimeout(200);
      const m = await page.evaluate(() => {
        const w = document.querySelector('#adminGerentes .table-scroll-wrap'), th = document.querySelector('#adminGerentes thead th'), r = th.getBoundingClientRect(), rw = w.getBoundingClientRect();
        const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 73;
        const prim = document.querySelector('#adminGerentes tbody tr').getBoundingClientRect();
        const cor = getComputedStyle(th).backgroundColor, topoEl = document.elementFromPoint(r.left + 4, r.top + 4);
        return { top: Math.round(r.top), bottom: Math.round(r.bottom), wTop: Math.round(rw.top), wBottom: Math.round(rw.bottom), nav, primeiraPassou: prim.top < r.top,
          titulos: Array.from(document.querySelectorAll('#adminGerentes thead th')).length, rolaDentro: w.scrollHeight > w.clientHeight + 1, altTela: window.innerHeight,
          opaco: !/rgba\(.*, 0(\.\d+)?\)|transparent/.test(cor), cor, porCima: !!(topoEl && topoEl.closest('thead')), pagina: document.documentElement.scrollWidth <= window.innerWidth + 1 };
      });
      if (interna) anota(nome + ': os títulos param no topo do quadro, e o quadro rola por dentro sem passar da tela',
        Math.abs(m.top - m.wTop) <= 2 && m.rolaDentro && m.primeiraPassou && m.wBottom - m.wTop <= m.altTela, JSON.stringify(m));
      else anota(nome + ': os títulos param logo abaixo do menu, sem rolagem interna', m.top >= m.nav - 2 && m.top <= m.nav + 40 && !m.rolaDentro && m.primeiraPassou, JSON.stringify(m));
      anota(nome + ': os 6 títulos, por cima das linhas, com fundo opaco; sem rolagem lateral da página', m.titulos === 6 && m.opaco && m.porCima && m.pagina, JSON.stringify(m));

      /* na tela menor, o título acompanha a coluna na rolagem lateral */
      const lateral = await page.evaluate(() => {
        const w = document.querySelector('#adminGerentes .table-scroll-wrap'); w.scrollLeft = w.scrollWidth;
        const th = document.querySelectorAll('#adminGerentes thead th')[2].getBoundingClientRect(), td = document.querySelector('#adminGerentes tbody tr').children[2].getBoundingClientRect();
        return { th: Math.round(th.left), td: Math.round(td.left), cabe: w.scrollWidth <= w.clientWidth + 1 };
      });
      anota(nome + ': o título acompanha a coluna quando a tabela rola para o lado', lateral.th === lateral.td, JSON.stringify(lateral));
      if (process.env.FA_SHOTS) await page.screenshot({ path: path.join(process.env.FA_SHOTS, 'cab-' + opt.viewport.width + '.png') });
      anota(nome + ': nenhum erro de JavaScript', !erros.length, erros.join(' | '));
      await ctx.close();
    }
  } catch (e) {
    falhas++;
    console.error('  FALHA inesperada: ' + e.message);
  } finally {
    await browser.close();
  }
  console.log('\n' + oks + ' ok, ' + falhas + ' falha(s)');
  process.exit(falhas ? 1 : 0);
})();
