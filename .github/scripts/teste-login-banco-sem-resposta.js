/* Banco de dados que não responde: o site avisa em vez de esperar calado (incidente de 23/10/2026).
 *
 * A senha é conferida pelo Firebase Auth; o perfil (fa-users) vem do banco, outra conexão. Com o banco sem responder, o
 * login "dava certo", a página continuava em "Entrar", sem o ADMIN e sem dizer nada; e o botão "Turmas e parâmetros"
 * ficava em "Gerando…" para sempre. Roda com o Firebase falso, segurando as leituras com atraso por caminho.
 *
 * O QUE ELE EXIGE:
 *   1. login aceito com o perfil sem chegar: depois do prazo aparece o aviso "Login feito, mas seu perfil ainda não
 *      carregou", visível e dentro da tela — desktop e celular (375 px);
 *   2. o aviso não decide acesso: quando o perfil chega, ele some sozinho e a sessão entra normalmente;
 *   3. "📊 Turmas e parâmetros" com o banco sem responder: desiste, diz que o banco não respondeu e o botão volta;
 *   4. nenhum erro de JavaScript não tratado. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada } = require('./esperas');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const ADM = 'adm@previ.com.br', PESSOA = 'pessoa@previ.com.br';

function banco() {
  return {
    'fa-users': { [chave(ADM)]: { name: 'ADMIN', email: ADM }, [chave(PESSOA)]: { name: 'PESSOA UM', email: PESSOA } },
    'fa-admins': { [chave(ADM)]: { email: ADM, name: 'ADMIN' } }, 'fa-diretores': {}, 'fa-facilitadores': {}, 'fa-gerentes': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: { ev1: { nome: 'EPISÓDIO I', order: 1, publicado: true, cargaHoraria: '3' } },
    turmas: { t1: { label: 'TURMA 1', eventoKey: 'ev1', order: 1, dias: ['2027-11-03'] } },
    'turmas-interesse': {}, 'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-publico': {}, 'eventos-publico': {},
    'turmas-equipe': {}, 'turmas-sorteio': {}, avaliacoes: {}, pedidos: {}, holocron: {}
  };
}
async function abrir(browser, cfgExtra, opts, hash) {
  const ctx = await browser.newContext(opts || { viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify(Object.assign({ db: banco(), delayDefault: 20 }, cfgExtra)) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + (hash || '#home'), { waitUntil: 'domcontentloaded' });
  return { ctx, page, erros };
}
/* o caso de 23/10: estava logada, saiu e entrou de novo — agora com o banco segurando o perfil (atraso por caminho) */
const sairEEntrar = async (page, email, atrasoPerfil) => {
  /* a página já estava aberta e logada havia tempo (a primeira carga terminou) */
  await esperarSessaoAssentada(page);
  await page.evaluate(([e, ms]) => { window.__CFG.delays = { 'fa-users': ms }; return firebase.auth().signOut().then(() => { firebase.auth().signInWithEmailAndPassword(e, 'qualquer'); }); }, [email, atrasoPerfil]);
};
const aviso = (page) => page.evaluate(() => {
  const el = document.getElementById('avisoConexaoPerfil'); if (!el) return null;
  const r = el.getBoundingClientRect();
  return { texto: el.textContent, visivel: getComputedStyle(el).visibility !== 'hidden' && r.width > 0, dentro: r.left >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight };
});

(async () => {
  const browser = await chromium.launch();
  let falhas = 0;
  const anota = (linha, ok, detalhe) => { if (ok) console.log('  ok    ' + linha); else { falhas++; console.error('  FALHA ' + linha + (detalhe ? ' → ' + detalhe : '')); } };
  try {
    /* 1. perfil que não chega — desktop e celular */
    for (const [nome, opts] of [['desktop', null], ['375 px', { viewport: { width: 375, height: 760 }, isMobile: true, hasTouch: true }]]) {
      const { ctx, page, erros } = await abrir(browser, { user: { email: PESSOA, emailVerified: true, uid: 'u-p' } }, opts);
      await sairEEntrar(page, PESSOA, 600000);
      await page.waitForSelector('#avisoConexaoPerfil', { state: 'attached', timeout: 20000 });
      const a = await aviso(page);
      anota('1. (' + nome + ') login aceito e perfil sem chegar: aviso visível, dentro da tela, dizendo o que fazer',
        !!a && a.visivel && a.dentro && /Login feito, mas seu perfil ainda não carregou/.test(a.texto) && /recarregue a página/.test(a.texto), JSON.stringify(a));
      anota('1. (' + nome + ') e não inventa sessão (continua sem sessão enquanto o perfil não chega)', await page.evaluate(() => !window.faAuth.getSession()));
      anota('sem erro de JavaScript (' + nome + ')', !erros.length, erros[0]);
      await ctx.close();
    }
    /* 2. o perfil chega depois do prazo: o aviso some e a sessão entra */
    {
      const { ctx, page, erros } = await abrir(browser, { user: { email: PESSOA, emailVerified: true, uid: 'u-p' } });
      await sairEEntrar(page, PESSOA, 16000);
      await page.waitForSelector('#avisoConexaoPerfil', { state: 'attached', timeout: 20000 });
      await page.waitForFunction(() => !!(window.faAuth.getSession()), null, { timeout: 20000 });
      await page.waitForFunction(() => !document.getElementById('avisoConexaoPerfil'), null, { timeout: 5000 });
      anota('2. quando o perfil chega, o aviso some sozinho e a sessão entra normalmente', (await page.evaluate(() => window.faAuth.getSession().email)) === PESSOA);
      anota('sem erro de JavaScript (perfil atrasado)', !erros.length, erros[0]);
      await ctx.close();
    }
    /* 3. botão "Turmas e parâmetros" com o banco sem responder */
    {
      const { ctx, page, erros } = await abrir(browser, { user: { email: ADM, emailVerified: true, uid: 'u-adm' } }, null, '#admin');
      await page.waitForSelector('#exportTurmasParametrosBtn', { timeout: 20000 });
      await page.evaluate(() => { window.__CFG.delays = { 'turmas-interesse': 600000 }; });
      await page.click('#exportTurmasParametrosBtn');
      anota('3. enquanto lê, o botão diz "Gerando…"', /Gerando/.test(await page.$eval('#exportTurmasParametrosBtn', (b) => b.textContent)));
      await page.waitForFunction(() => Array.from(document.querySelectorAll('.modal-box')).some((b) => /não respondeu em 20 segundos/.test(b.textContent)), null, { timeout: 30000 });
      anota('3. depois do prazo: diz que o banco não respondeu e o botão volta', /Turmas e parâmetros/.test(await page.$eval('#exportTurmasParametrosBtn', (b) => b.textContent)) &&
        !(await page.$eval('#exportTurmasParametrosBtn', (b) => b.disabled)));
      anota('sem erro de JavaScript (botão)', !erros.length, erros[0]);
      await ctx.close();
    }
  } catch (e) {
    falhas++;
    console.error('  FALHA inesperada: ' + e.message);
  } finally {
    await browser.close();
  }
  console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
