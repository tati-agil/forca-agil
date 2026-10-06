/* Acesso à Avaliação AO VIVO e Adequação à Squad na área AVALIAÇÃO.
 *
 * 1. A administradora concede, troca ou remove o acesso de alguém que já está com o site aberto:
 *    a tela dessa pessoa muda NA HORA, sem recarregar (antes o próprio registro em
 *    fa-avaliacao-autorizados era lido uma vez só, no login — as regras do banco já valiam na
 *    hora, a tela não). Remover tira a pessoa da área AVALIAÇÃO; dar "Avaliação + Arquitetura"
 *    mostra o ADMIN (só a Arquitetura) no menu.
 * 2. Quem tem o tipo "Avaliação" faz a Adequação à Squad dentro da área AVALIAÇÃO (sem ADMIN):
 *    vê "Adequação à Squad" na lista, abre a lista de squad, começa uma avaliação nova e volta
 *    para as avaliações; a configuração do motor de squad NÃO aparece para ele. No celular
 *    (375 px), que é o uso real.
 * A mudança do registro é simulada gravando no Firebase falso da própria página — o mesmo
 * caminho de um aviso do servidor (o ouvinte recebe o valor novo). Hermético. */
const { chromium } = require('playwright');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const fs = require('fs');
const path = require('path');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (email) => email.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };
const EM = 'pessoa@previ.com.br';

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

async function abrir(browser, viewport, tipo, hash) {
  const aut = {}; if (tipo) aut[chave(EM)] = { email: EM, nome: EM, tipo: tipo, concedidoPor: 'tatianefdirene@previ.com.br', concedidoEm: '2026-10-01T10:00:00.000Z' };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': {}, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-espera': {},
    'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {}, eventos: {}, 'turmas-publico': {}, 'eventos-publico': {},
    'avaliacoes-produto': {}, 'avaliacoes-squad': {}, 'motor-squad-config': {}, 'motor-squad-auditoria': {}, 'motor-arquitetura-config': {},
    'motor-arquitetura-auditoria': {}, 'fa-avaliacao-acessos': {}, 'fa-avaliacao-autorizados': aut, 'fa-avaliacao-autorizados-auditoria': {} };
  const ctx = await browser.newContext({ viewport: viewport });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify({ db: db, user: { email: EM, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const gravarAcesso = (page, tipo) => page.evaluate((a) => new Promise((ok, falha) => {
  const ref = firebase.database().ref('fa-avaliacao-autorizados/' + a.k);
  const cb = (err) => (err ? falha(err) : ok());
  if (a.tipo) ref.set({ email: a.em, nome: a.em, tipo: a.tipo, concedidoPor: 'tatianefdirene@previ.com.br', concedidoEm: '2026-10-06T10:00:00.000Z' }, cb);
  else ref.remove(cb);
}), { k: chave(EM), em: EM, tipo: tipo });
const linkMenu = (page, nav) => page.evaluate((n) => { const a = document.querySelector('a[data-nav-page="' + n + '"]'); return !!a && !a.hidden && getComputedStyle(a).display !== 'none'; }, nav);
const hash = (page) => page.evaluate(() => location.hash);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

(async () => {
  const browser = await chromium.launch();

  console.log('\n######## 1. Acesso concedido, trocado e removido sem recarregar ########');
  {
    const { ctx, page, erros } = await abrir(browser, DESKTOP, null, '#home');
    afirma(!(await linkMenu(page, 'avaliacoes')), 'sem autorização: o menu não mostra "Avaliação"');
    await gravarAcesso(page, 'avaliacao');
    await esperarCondicao(page, () => { const a = document.querySelector('a[data-nav-page="avaliacoes"]'); return !!a && !a.hidden; }, null, { descricao: 'o menu mostrar "Avaliação" depois da concessão' });
    afirma(true, 'concedido "Avaliação": o menu mostra "Avaliação" sem recarregar');
    await page.evaluate(() => { location.hash = '#avaliacoes'; });
    await page.waitForSelector('#avpNovoBtn', { timeout: 8000 });
    afirma(await hash(page) === '#avaliacoes', 'e a área AVALIAÇÃO abre');
    afirma(!(await linkMenu(page, 'admin')), '"Avaliação" não vê o ADMIN');
    await gravarAcesso(page, 'avaliacao-arquitetura');
    await esperarCondicao(page, () => { const a = document.querySelector('a[data-nav-page="admin"]'); return !!a && !a.hidden; }, null, { descricao: 'o menu mostrar "Admin" depois da troca de tipo' });
    afirma(true, 'trocado para "Avaliação + Arquitetura": o menu passa a mostrar "Admin" sem recarregar');
    await gravarAcesso(page, null);
    await esperarCondicao(page, () => location.hash !== '#avaliacoes', null, { descricao: 'sair da área AVALIAÇÃO depois da remoção' });
    afirma(await hash(page) !== '#avaliacoes', 'removido: sai da área AVALIAÇÃO sem recarregar (' + await hash(page) + ')');
    afirma(!(await linkMenu(page, 'avaliacoes')) && !(await linkMenu(page, 'admin')), 'removido: o menu não mostra mais "Avaliação" nem "Admin"');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  console.log('\n######## 2. "Avaliação" faz a Adequação à Squad na área AVALIAÇÃO — celular 375 px ########');
  {
    const { ctx, page, erros } = await abrir(browser, CELULAR, 'avaliacao', '#avaliacoes');
    await page.waitForSelector('#avpSquadBtn', { timeout: 8000 });
    afirma(await larguraOk(page), 'lista com o botão "Adequação à Squad" sem rolagem horizontal');
    await page.click('#avpSquadBtn');
    await page.waitForSelector('#avaliacoesSquad #sqNovaBtn', { timeout: 8000 });
    afirma(await page.locator('#avaliacoesPainel').isHidden(), 'a lista de squad toma o lugar da lista de avaliações');
    afirma(await page.locator('#sqMotorConfigBtn, #sqMotorEditarRegrasBtn').count() === 0, 'a configuração do motor de squad NÃO aparece aqui (é do ADMIN › Arquitetura)');
    afirma(/Voltar para Avaliações/.test(await page.locator('#sqVoltarArquitetura').innerText()), 'o Voltar diz "← Voltar para Avaliações"');
    await page.click('#sqNovaBtn');
    await page.waitForSelector('#sqfEscolhaNovo');
    await page.click('#sqfEscolhaNovo');
    await page.fill('#sqfNovoItemNome', 'Item da pessoa avaliadora');
    await page.click('#sqfNovoItemConfirmar');
    await page.waitForSelector('#avaliacoesSquad .avp-question', { timeout: 8000 });
    afirma(true, '"Avaliação" começa uma avaliação de squad nova');
    afirma(await larguraOk(page), 'checklist de squad sem rolagem horizontal');
    await page.click('#sqVoltarListaChecklist');
    if (await page.locator('.sq-modal-confirm-btn').count()) await page.click('.sq-modal-confirm-btn');
    await page.waitForSelector('#avaliacoesSquad #sqVoltarArquitetura');
    await page.click('#sqVoltarArquitetura');
    await page.waitForSelector('#avpSquadBtn', { state: 'visible', timeout: 8000 });
    afirma(await page.locator('#avaliacoesSquad').isHidden() && await page.locator('#avaliacoesPainel').isVisible(), 'Voltar devolve a lista de avaliações');
    await page.click('#avpSquadBtn');
    await page.waitForSelector('#avaliacoesSquad #sqNovaBtn', { state: 'visible', timeout: 8000 });
    await page.evaluate(() => { location.hash = '#home'; });
    await page.waitForSelector('#avaliacoesSquad', { state: 'hidden', timeout: 8000 });
    afirma(true, 'sair por outro caminho (menu/endereço) fecha a lista de squad');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  await browser.close();
  console.log('\n============================\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
