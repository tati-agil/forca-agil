/* Roteador: decisão de rota que chega TARDE não pode jogar a pessoa para o topo. Desktop e celular (375 px).
 * Hermético: Firebase falso, sem rede, sem segredo.
 *
 * Com rede lenta, a informação de acesso (perfil da Avaliação, inscrição em turma, lista de admins…) chega
 * segundos depois de a página já estar na tela — e a pessoa já está rolando. O roteador refaz a decisão
 * de rota nesse momento (show(rota, true)). Antes desta correção, ele SEMPRE chamava scrollTo(topo), mesmo
 * sem mudar de página: a tela "pulava" para cima sozinha (era o "tela inicial rolada (50 px)" que aparecia
 * no CI em teste-admin-navegacao.js).
 *
 *   1. Mesma página + perfil da Avaliação chegando tarde (#admin › Arquitetura): a posição é preservada.
 *   2. Mesma página + lista de admins chegando tarde (#home, pessoa comum): a posição é preservada.
 *      (A inscrição em turma não serve aqui: ela é decidida antes de o site ser revelado.)
 *   3. Mudança REAL de página continua começando no topo (#admin → #ajuda → #home).
 * Em cada cenário o teste confere que a informação tardia chegou DEPOIS da rolagem (senão não prova nada). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const ADM = 'adm@previ.com.br', PESSOA = 'pessoa@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };
const TARDE = 5000; /* a leitura de acesso responde 5 s depois: bem depois de a pessoa rolar */

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

function base(admin) {
  const admins = {}; if (admin) admins[chave(ADM)] = { email: ADM };
  const users = {}; users[chave(PESSOA)] = { name: 'PESSOA', email: PESSOA, area: 'INFOR' }; users[chave(ADM)] = { name: 'ADMIN', email: ADM, area: 'INFOR' };
  return { turmas: {}, 'turmas-interesse': {}, 'fa-users': users, 'fa-admins': admins, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-espera': {},
    'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {}, eventos: {}, 'turmas-publico': {}, 'eventos-publico': {},
    'avaliacoes-produto': {}, 'avaliacoes-squad': {}, 'motor-squad-config': {}, 'motor-squad-auditoria': {},
    'motor-arquitetura-config': {}, 'motor-arquitetura-auditoria': {}, 'fa-avaliacao-acessos': {} };
}
async function abrir(browser, viewport, email, rota, delays, admin) {
  const cfg = { db: base(admin), user: { email, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true, delays };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  /* marca QUANDO cada decisão tardia chegou */
  await ctx.addInitScript(() => {
    window.__chegou = {};
    ['fa-avaliacao-ready', 'fa-enrolled-ready', 'fa-admin-ready'].forEach((ev) => window.addEventListener(ev, () => { window.__chegou[ev] = performance.now(); }));
  });
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#' + rota, { waitUntil: 'domcontentloaded' });
  return { ctx, page, erros };
}
const y = (page) => page.evaluate(() => Math.round(window.pageYOffset));
/* rola até o fim, sem animação (o site usa rolagem suave), e devolve a posição */
async function rolarAteOFim(page) {
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, left: 0, behavior: 'instant' }));
  return y(page);
}
/* espera o evento tardio chegar e a página assentar (1 s sem mexer depois dele) */
async function esperarDecisaoTardia(page, ev) {
  await esperarCondicao(page, (e) => !!window.__chegou[e] && performance.now() - window.__chegou[e] > 1000, ev, { limite: TARDE + 6000, descricao: ev + ' chegar e a página assentar' });
}

(async () => {
  const browser = await chromium.launch();
  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');

    console.log('\n== 1. #admin › Arquitetura: perfil da Avaliação chega tarde ==');
    {
      const { ctx, page, erros } = await abrir(browser, viewport, ADM, 'admin?arq=inicio', { 'fa-avaliacao-autorizados': TARDE }, true);
      await page.waitForSelector('#avpConfigNaturezasBtn', { state: 'visible', timeout: 12000 });
      const y0 = await rolarAteOFim(page);
      const antes = await page.evaluate(() => !window.__chegou['fa-avaliacao-ready']);
      afirma(y0 > 100 && antes, 'a pessoa rolou a tela inicial (' + y0 + ' px) ANTES de o perfil da Avaliação chegar');
      await esperarDecisaoTardia(page, 'fa-avaliacao-ready');
      const y1 = await y(page);
      afirma(y1 === y0, 'decisão tardia na MESMA página: a posição foi preservada (' + y0 + ' → ' + y1 + ' px)');
      afirma(/#admin/.test(page.url()), 'continua em #admin');

      console.log('\n== 3. Mudança real de página continua começando no topo ==');
      await page.evaluate(() => { location.hash = '#ajuda'; });
      await esperarCondicao(page, () => !document.getElementById('page-ajuda').hidden && Math.round(window.pageYOffset) === 0, null, { descricao: '#ajuda no topo' });
      afirma(true, '#admin (rolado) → #ajuda: começa no topo');
      const yA = await rolarAteOFim(page);
      await page.evaluate(() => { location.hash = '#home'; });
      await esperarCondicao(page, () => !document.getElementById('page-home').hidden && Math.round(window.pageYOffset) === 0, null, { descricao: '#home no topo' });
      afirma(yA > 0, '#ajuda (rolado ' + yA + ' px) → #home: começa no topo');
      afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
      await ctx.close();
    }

    console.log('\n== 2. #home: lista de admins chega tarde (pessoa comum) ==');
    {
      const { ctx, page, erros } = await abrir(browser, viewport, PESSOA, 'home', { 'fa-admins': TARDE }, false);
      await esperarCondicao(page, () => !document.getElementById('page-home').hidden && !document.body.classList.contains('aguardando-auth') && document.documentElement.scrollHeight > window.innerHeight + 200, null, { limite: 12000, descricao: 'home visível e rolável' });
      const y0 = await rolarAteOFim(page);
      const antes = await page.evaluate(() => !window.__chegou['fa-admin-ready']);
      afirma(y0 > 100 && antes, 'a pessoa rolou a home (' + y0 + ' px) ANTES de a lista de admins chegar');
      await esperarDecisaoTardia(page, 'fa-admin-ready');
      const y1 = await y(page);
      afirma(y1 === y0, 'decisão tardia na MESMA página: a posição foi preservada (' + y0 + ' → ' + y1 + ' px)');
      afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
      await ctx.close();
    }
  }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nOK — decisão de rota que chega tarde não muda a rolagem de quem continua na mesma página; troca real de página começa no topo (desktop e 375 px).');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
