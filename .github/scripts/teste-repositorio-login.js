/* Repositório: as leituras esperam a sessão, são refeitas no login e nunca ficam em espera infinita.
 * Desktop e celular (375 px). Hermético: Firebase falso, sem rede, sem segredo.
 *
 * POR QUE ESTE TESTE EXISTE
 * O Smoke com o Firebase real (PR #304) achou o Repositório preso em "Carregando conteúdos…". As
 * três leituras da tela (holocron, fa-seeds-hidden, fa-holocron-hidden) exigem login nas regras do
 * banco, mas eram abertas no instante em que repo.js carregava — antes do login. Quem entrava pelo
 * formulário com a página já aberta tinha as três recusadas; o Firebase cancela uma escuta recusada
 * e não a refaz; e os cartões, que só são desenhados dentro dessas escutas, nunca apareciam.
 * O Firebase falso daqui ganhou __CFG.exigeLogin para imitar exatamente isso (recusa sem sessão e
 * cancelamento da escuta).
 *
 *   1. Página aberta ANTES do login → leitura inicial recusaria → login pelo formulário → o
 *      Repositório carrega normalmente.
 *   2. Página aberta com a sessão já válida → o Repositório carrega normalmente.
 *   3. Leitura que falha de verdade → sai de "Carregando…" e mostra o erro com "Tentar novamente".
 *   4. "Tentar novamente" refaz a leitura e recupera a tela quando a fonte volta a responder.
 *   5. Leitura que nunca responde → depois do limite, o erro com "Tentar novamente" (não espera
 *      infinita); se o dado chegar depois, os cartões aparecem por cima do aviso. */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao } = require('./esperas');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const PESSOA = 'pessoa@previ.com.br';
const LEITURAS = ['holocron', 'fa-seeds-hidden', 'fa-holocron-hidden'];

function banco() {
  const users = {};
  users[chave(PESSOA)] = { name: 'PESSOA', email: PESSOA, area: 'TI' };
  return {
    'fa-users': users, 'fa-admins': {}, 'fa-diretores': {}, 'fa-facilitadores': {}, 'fa-avaliacao-autorizados': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-interesse-log': {},
    'turmas-config': {}, 'turmas-checkin': {}, 'turmas-publico': {}, 'eventos-publico': {},
    'turmas-equipe': {}, 'turmas-sorteio': {}, avaliacoes: {}, pedidos: {},
    holocron: { h1: { type: 'video', title: 'CONTEÚDO DA PESSOA', url: 'https://exemplo.com/video', desc: 'Enviado pelo site.', authorName: 'PESSOA', authorEmail: PESSOA, createdAt: '2026-10-01T10:00:00Z' } },
    'fa-seeds-hidden': {}, 'fa-holocron-hidden': {},
  };
}

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

async function abrir(browser, opts, cfg, rota) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(Object.assign({ db: banco(), delayDefault: 20, exigeLogin: LEITURAS }, cfg)) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#' + (rota || 'repositorio'), { waitUntil: 'domcontentloaded' });
  return { ctx, page, erros };
}
const estadoGrade = (page) => page.evaluate(() => {
  const g = document.getElementById('repoGrid');
  return { cartoes: g.querySelectorAll('.repo-card').length, pessoa: /CONTEÚDO DA PESSOA/.test(g.textContent),
    carregando: /Carregando conteúdos…/.test(g.textContent), erro: !!document.getElementById('repoErroCarregar'),
    tentar: !!document.getElementById('repoTentarDeNovo') };
});
const carregou = (page, descricao, limite) => esperarCondicao(page, () => {
  const g = document.getElementById('repoGrid');
  return !!g && g.querySelectorAll('.repo-card').length > 0 && /CONTEÚDO DA PESSOA/.test(g.textContent);
}, null, { limite: limite || 8000, descricao });

(async () => {
  const browser = await chromium.launch();
  for (const [nome, opts] of [['desktop', { viewport: { width: 1280, height: 900 } }], ['celular 375px', { ...devices['iPhone 13'], viewport: { width: 375, height: 800 } }]]) {
    console.log('\n######## ' + nome + ' ########');

    console.log('\n== 1. Página aberta antes do login, login pelo formulário ==');
    {
      const { ctx, page, erros } = await abrir(browser, opts, { user: null }, 'home');
      await page.waitForSelector('#loginEmail', { state: 'visible', timeout: 15000 });
      /* tempo para qualquer leitura feita sem sessão ser recusada (e a escuta, cancelada) */
      await page.waitForTimeout(300);
      await page.fill('#loginEmail', PESSOA);
      await page.evaluate((v) => { const el = document.getElementById('loginEmail'); if (el.value !== v) el.value = v; }, PESSOA);
      await page.fill('#loginPassword', '12345678');
      await page.click('#loginForm button[type="submit"]');
      await esperarCondicao(page, () => { const m = document.getElementById('authModal'); return !!m && m.hidden === true; }, null, { limite: 10000, descricao: 'o login fechar o modal' });
      await page.evaluate(() => { location.hash = '#repositorio'; });
      await carregou(page, 'os cartões aparecerem depois do login');
      const e = await estadoGrade(page);
      afirma(e.pessoa && !e.carregando && !e.erro, 'depois do login o Repositório carrega (com o conteúdo enviado pela pessoa), sem "Carregando…" nem erro', JSON.stringify(e));
      afirma(erros.length === 0, 'nenhum erro de JavaScript', erros.join(' | '));
      await ctx.close();
    }

    console.log('\n== 2. Página aberta com a sessão já válida ==');
    {
      const { ctx, page, erros } = await abrir(browser, opts, { user: { email: PESSOA, emailVerified: true, uid: 'u1' } });
      await carregou(page, 'os cartões aparecerem com a sessão já válida');
      const e = await estadoGrade(page);
      afirma(e.pessoa && !e.carregando && !e.erro, 'com sessão guardada o Repositório carrega normalmente', JSON.stringify(e));
      afirma(erros.length === 0, 'nenhum erro de JavaScript', erros.join(' | '));
      await ctx.close();
    }

    console.log('\n== 3/4. Leitura que falha de verdade, e "Tentar novamente" ==');
    {
      const { ctx, page, erros } = await abrir(browser, opts, { user: { email: PESSOA, emailVerified: true, uid: 'u1' }, fail: LEITURAS });
      await page.waitForSelector('#repoTentarDeNovo', { state: 'visible', timeout: 8000 });
      const e = await estadoGrade(page);
      afirma(e.erro && e.tentar && !e.carregando, 'leitura recusada sai de "Carregando…" e mostra o erro com "Tentar novamente"', JSON.stringify(e));
      /* Enquanto a fonte continua falhando, tentar de novo volta ao mesmo aviso (não trava). */
      await page.click('#repoTentarDeNovo');
      await page.waitForSelector('#repoTentarDeNovo', { state: 'visible', timeout: 8000 });
      afirma(true, 'tentar de novo com a fonte ainda falhando mostra o aviso de novo, sem travar');
      /* A fonte volta a responder. */
      await page.evaluate(() => { window.__CFG.fail = []; });
      await page.click('#repoTentarDeNovo');
      await carregou(page, 'os cartões aparecerem depois de "Tentar novamente"');
      const d = await estadoGrade(page);
      afirma(d.pessoa && !d.erro && !d.carregando, '"Tentar novamente" refaz a leitura e recupera a tela', JSON.stringify(d));
      afirma(erros.length === 0, 'nenhum erro de JavaScript', erros.join(' | '));
      await ctx.close();
    }

    console.log('\n== 5. Leitura que nunca responde ==');
    {
      const delays = {}; LEITURAS.forEach((l) => { delays[l] = 22000; });
      const { ctx, page, erros } = await abrir(browser, opts, { user: { email: PESSOA, emailVerified: true, uid: 'u1' }, delays });
      const t0 = Date.now();
      await page.waitForSelector('#repoTentarDeNovo', { state: 'visible', timeout: 20000 });
      const espera = Math.round((Date.now() - t0) / 1000);
      afirma(espera >= 12 && espera <= 19, 'sem resposta, o aviso com "Tentar novamente" aparece no limite (~15 s), não fica em espera infinita', espera + ' s');
      await carregou(page, 'o dado que chega depois do aviso desenhar os cartões', 15000);
      afirma(true, 'quando a resposta atrasada chega, os cartões substituem o aviso');
      afirma(erros.length === 0, 'nenhum erro de JavaScript', erros.join(' | '));
      await ctx.close();
    }
  }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nOK — Repositório carrega com login tardio e com sessão guardada, e recusa/espera viram aviso com "Tentar novamente" que funciona (desktop e 375 px).');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
