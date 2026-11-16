/* ADMIN › Administradores: ao digitar no "Adicionar administrador", aparecem os Cadastrados que combinam. Firebase falso;
 * 1280 px e 375 px.
 *
 * O QUE ELE EXIGE:
 *   1. digitar parte do nome (sem acento, minúsculas) mostra as pessoas de fa-users que combinam, com e-mail e área;
 *   2. quem já é admin aparece marcado "(já é admin)" e não pode ser escolhido;
 *   3. escolher uma sugestão preenche nome e e-mail e fecha a lista; digitar no e-mail também sugere;
 *   4. nome sem cadastro: a lista diz que não achou e o preenchimento à mão continua valendo (Adicionar grava);
 *   5. sem rolagem lateral da página; nenhum erro de JavaScript. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const SUPER = 'tatianefdirene@previ.com.br';

function banco() {
  const u = (name, email, area) => ({ name, email, area });
  return {
    'fa-users': {
      [chave(SUPER)]: u('TATIANE', SUPER, 'INFOR'),
      [chave('leonardo.vaz@previ.com.br')]: u('LEONARDO VAZ DE ARAÚJO', 'leonardo.vaz@previ.com.br', 'GEINF'),
      [chave('leonilda@previ.com.br')]: u('LEONILDA SOUZA', 'leonilda@previ.com.br', 'GECON'),
      [chave('caduh@previ.com.br')]: u('CARLOS EDUARDO', 'caduh@previ.com.br', 'DISEG')
    },
    'fa-admins': { [chave('caduh@previ.com.br')]: { email: 'caduh@previ.com.br', name: 'CARLOS EDUARDO', addedAt: '2026-06-15T15:42:00.000Z' } },
    'fa-diretores': {}, 'fa-facilitadores': {}, 'fa-gerentes': {}, 'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {}, avaliacoes: {}, pedidos: {}, holocron: {}
  };
}

(async () => {
  const browser = await chromium.launch();
  let falhas = 0, oks = 0;
  const anota = (r, ok, d) => { if (ok) { oks++; console.log('  ok    ' + r); } else { falhas++; console.error('  FALHA ' + r + (d ? ' — ' + d : '')); } };
  const itens = (page) => page.evaluate(() => {
    const l = document.getElementById('adminSugestoes');
    return { visivel: !!l && l.style.display !== 'none', li: l ? Array.from(l.children).map((x) => ({ t: x.textContent, escolhe: x.hasAttribute('tabindex') })) : [] };
  });
  try {
    for (const [nome, opt] of [
      ['1280 px', { viewport: { width: 1280, height: 800 } }],
      ['375 px', { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]
    ]) {
      const ctx = await browser.newContext(opt);
      const page = await ctx.newPage();
      const erros = [];
      page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
      await page.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(), user: { email: SUPER, emailVerified: true, uid: 'u-super' }, delayDefault: 5 }) + ';');
      await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
      await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
      await page.route('**fonts.gstatic.com**', (r) => r.abort());
      await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
      await esperarSessaoAssentada(page);
      await esperarCondicao(page, () => !!document.querySelector('.admin-tab-btn[data-panel="adminPanelAdmins"]'), null, { limite: 15000, descricao: 'a aba Administradores' });
      await page.evaluate(() => document.querySelector('.admin-tab-btn[data-panel="adminPanelAdmins"]').click());
      await esperarCondicao(page, () => !!document.getElementById('adminName'), null, { limite: 15000, descricao: 'o formulário Adicionar administrador' });

      await page.fill('#adminName', 'leon');
      await esperarCondicao(page, () => /LEONARDO/.test((document.getElementById('adminSugestoes') || {}).textContent || ''), null, { limite: 5000, descricao: 'as sugestões' });
      let s = await itens(page);
      anota(nome + ': "leon" sugere as duas pessoas que combinam, com e-mail e área',
        s.visivel && s.li.length === 2 && s.li.every((x) => x.escolhe) && /leonardo\.vaz@previ\.com\.br · GEINF/.test(s.li[0].t), JSON.stringify(s));

      await page.fill('#adminName', 'araujo');
      s = await itens(page);
      anota(nome + ': a busca ignora acento ("araujo" acha ARAÚJO)', s.li.length === 1 && /LEONARDO/.test(s.li[0].t), JSON.stringify(s));

      await page.fill('#adminName', 'carlos');
      s = await itens(page);
      anota(nome + ': quem já é admin aparece marcado e não pode ser escolhido', s.li.length === 1 && /já é admin/.test(s.li[0].t) && !s.li[0].escolhe, JSON.stringify(s));

      await page.fill('#adminName', '');
      await page.click('#adminEmail'); /* o foco escreve "@previ.com.br" com o cursor no começo, como no uso real */
      await page.keyboard.type('leonardo.v');
      s = await itens(page);
      anota(nome + ': digitar no e-mail também sugere', s.li.length === 1 && /LEONARDO/.test(s.li[0].t), JSON.stringify(s));

      await page.locator('#adminSugestoes li[tabindex]').first().click();
      const v = await page.evaluate(() => ({ n: document.getElementById('adminName').value, e: document.getElementById('adminEmail').value, aberta: document.getElementById('adminSugestoes').style.display !== 'none' }));
      anota(nome + ': escolher preenche nome e e-mail e fecha a lista', v.n === 'LEONARDO VAZ DE ARAÚJO' && v.e === 'leonardo.vaz@previ.com.br' && !v.aberta, JSON.stringify(v));

      await page.fill('#adminName', 'fulana sem cadastro');
      s = await itens(page);
      anota(nome + ': sem cadastro, a lista avisa e manda digitar à mão', s.li.length === 1 && /Nenhum cadastro encontrado/.test(s.li[0].t) && !s.li[0].escolhe, JSON.stringify(s));
      await page.fill('#adminEmail', 'fulana@previ.com.br');
      await page.press('#adminEmail', 'Escape');
      await page.click('#adminAddBtn');
      await esperarCondicao(page, () => /fulana@previ\.com\.br/.test((document.querySelector('#adminAdmins table') || {}).textContent || ''), null, { limite: 5000, descricao: 'a pessoa digitada à mão gravada' });
      anota(nome + ': preenchimento à mão continua gravando', true);

      const larg = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      anota(nome + ': sem rolagem lateral da página', larg);
      if (process.env.FA_SHOTS) {
        await page.fill('#adminName', 'leo');
        await page.screenshot({ path: path.join(process.env.FA_SHOTS, 'admin-sugestao-' + opt.viewport.width + '.png'), fullPage: false });
      }
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
