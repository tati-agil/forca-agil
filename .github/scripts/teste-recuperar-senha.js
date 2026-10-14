/* RECUPERAÇÃO DE SENHA — "Esqueci minha senha" (login) e "Redefinir senha" (ADMIN › Cadastrados). Desktop e 375 px.
 * Hermético: Firebase falso, sem rede, sem segredo — NENHUM e-mail é enviado (o falso só registra o pedido).
 * O que se prova:
 *   1. Textos: nada de "senha temporária" nem de "o administrador enviará"; o painel diz que chega um LINK.
 *   2. Sucesso: mensagem neutra (igual para qualquer e-mail — a proteção contra enumeração não deixa saber se a conta
 *      existe), com o remetente e a orientação de olhar a quarentena.
 *   3. O pedido vai ao Firebase com o e-mail em minúsculas, idioma pt-BR (languageCode no momento do envio) e o
 *      endereço de volta ao site (actionCodeSettings.url).
 *   4. Falhas com a causa: rede, excesso de tentativas, e-mail inválido; código desconhecido → genérica com o código;
 *      sem resposta → aviso de prazo (sem ficar "Aguarde…" para sempre). Botão travado durante o envio (sem duplo envio).
 *   5. E-mail fora de @previ.com.br: barrado na tela, sem pedido ao Firebase.
 *   6. O console nunca recebe o e-mail.
 *   7. ADMIN: confirmação → o MESMO envio (mesmos parâmetros); mensagem neutra; falhas com a causa; nenhuma mensagem de
 *      "sem cadastro" (com a proteção ligada ela seria falsa) nem err.message cru. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const ADM = 'adm@previ.com.br', PESSOA = 'Pessoa.Teste@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

function banco() {
  const users = {}; users[chave(ADM)] = { name: 'ADMIN', email: ADM, area: 'INFOR' };
  users[chave(PESSOA)] = { name: 'Pessoa Teste', email: PESSOA.toLowerCase(), area: 'GEPES', createdAt: '2026-10-01T09:00:00.000Z' };
  const admins = {}; admins[chave(ADM)] = { email: ADM, name: 'ADMIN' };
  return { 'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {} };
}
async function abrir(browser, viewport, hash, cfgExtra) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const erros = [], consoleTxt = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  page.on('console', (m) => consoleTxt.push(m.text()));
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(Object.assign({ db: banco(), delayDefault: 10 }, cfgExtra || {})) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  return { ctx, page, erros, consoleTxt };
}
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent : ''; }, sel);
/* visível de verdade: o estilo calculado, não só o atributo hidden (o CSS pode anulá-lo) */
const visivel = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.offsetParent !== null; }, sel);
const pedidos = (page) => page.evaluate(() => (window.__CFG.__resets || []).slice());
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
async function abrirPainel(page) {
  await page.waitForFunction(() => !!window.faOpenAuthModal, null, { timeout: 15000 });
  await page.evaluate(() => window.faOpenAuthModal('login'));
  await page.click('#forgotPassword');
  await page.waitForSelector('#auth-forgot:not([hidden])');
}
async function pedir(page, email) {
  await page.fill('#forgotEmail', email);
  await page.click('#forgotForm [type=submit]');
}
const esperarResposta = (page, limite) => esperarCondicao(page, () => !document.getElementById('forgotOk').hidden || !document.getElementById('forgotErr').hidden, undefined, { limite: limite || 8000 });

async function rodada(browser, viewport, rotulo) {
  console.log('\n=== ' + rotulo + ' ===');
  console.log('Login — "Esqueci minha senha"');
  let { ctx, page, erros, consoleTxt } = await abrir(browser, viewport, '#home', { user: null });
  await abrirPainel(page);
  const sub = await texto(page, '#auth-forgot .auth-sub');
  afirma(!/senha temporária|administrador receberá|enviará uma senha/i.test(await texto(page, '#auth-forgot')) && /link para criar uma nova senha/.test(sub), 'painel: chega um link (nada de senha temporária nem de administrador)', sub);
  afirma(await larguraOk(page), 'painel sem rolagem lateral');
  afirma(!(await visivel(page, '#forgotOk')) && !(await visivel(page, '#forgotErr')), 'antes do pedido: nenhuma caixa de sucesso ou erro à vista (nem vazia)');
  await pedir(page, 'alguem@gmail.com');
  await esperarResposta(page);
  afirma(/Use seu e-mail @previ\.com\.br/.test(await texto(page, '#forgotErr')) && (await pedidos(page)).length === 0, 'e-mail de fora: barrado na tela, sem pedido ao Firebase');
  await pedir(page, '  ' + PESSOA + ' ');
  await esperarResposta(page);
  const ok = await texto(page, '#forgotOk'), ped = await pedidos(page);
  afirma(/Pedido enviado\. Se houver uma conta com este e-mail/.test(ok) && /noreply@kyber-agil\.firebaseapp\.com/.test(ok) && /quarentena/.test(ok) && !/cadastrad[oa] com sucesso|existe/i.test(ok),
    'sucesso: mensagem neutra, com o remetente e a orientação de olhar a quarentena', ok);
  afirma(ped.length === 1 && ped[0].email === PESSOA.toLowerCase() && ped[0].languageCode === 'pt-BR' && ped[0].settings && /^https:\/\/kyber-agil\.web\.app\/$/.test(ped[0].settings.url),
    'pedido ao Firebase: e-mail em minúsculas, idioma pt-BR e endereço de volta ao site', JSON.stringify(ped));
  await pedir(page, 'nao.existe@previ.com.br');
  await esperarResposta(page);
  afirma((await texto(page, '#forgotOk')).replace(/\s+/g, ' ') === ok.replace(/\s+/g, ' '), 'e-mail sem conta: EXATAMENTE a mesma mensagem (nada revela se a conta existe)');
  const casos = [['auth/network-request-failed', /Sem conexão com o servidor/], ['auth/too-many-requests', /Muitas tentativas em pouco tempo/], ['auth/invalid-email', /^E-mail inválido\.$/],
    ['auth/internal-error', /Não foi possível enviar agora\. Tente de novo\. \(código: auth\/internal-error\)/]];
  for (const [codigo, re] of casos) {
    await page.evaluate((c) => { window.__CFG.resetFalha = c; }, codigo);
    await pedir(page, PESSOA);
    await esperarResposta(page);
    afirma(re.test((await texto(page, '#forgotErr')).trim()) && await visivel(page, '#forgotErr') && !(await visivel(page, '#forgotOk')), 'falha ' + codigo + ': mensagem com a causa', await texto(page, '#forgotErr'));
  }
  await page.evaluate(() => { window.__CFG.resetFalha = 'sem-resposta'; });
  await page.clock.install(); /* o prazo de 20 s corre no relógio falso: nada de esperar 20 s de verdade */
  await pedir(page, PESSOA);
  afirma(await page.evaluate(() => document.querySelector('#forgotForm [type=submit]').disabled), 'durante o envio: botão travado (sem duplo envio)');
  await page.clock.fastForward(21000);
  await esperarCondicao(page, () => !document.getElementById('forgotErr').hidden, undefined, { limite: 8000 });
  afirma(/não respondeu a tempo/.test(await texto(page, '#forgotErr')) && !(await page.evaluate(() => document.querySelector('#forgotForm [type=submit]').disabled)),
    'sem resposta do servidor: aviso de prazo e botão liberado (nunca "Aguarde…" para sempre)', await texto(page, '#forgotErr'));
  afirma(!consoleTxt.some((t) => /previ\.com\.br/i.test(t)) && consoleTxt.some((t) => /redefinição de senha não enviada: auth\/too-many-requests/.test(t)), 'console: só o código, nunca o e-mail');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();

  console.log('ADMIN › Cadastrados — "Redefinir senha"');
  ({ ctx, page, erros, consoleTxt } = await abrir(browser, viewport, '#admin', { user: { email: ADM, emailVerified: true, uid: 'u1' } }));
  await esperarSessaoAssentada(page);
  await page.waitForSelector('.admin-tab-btn', { timeout: 15000 });
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Cadastrados/i.test(x.textContent)); if (b) b.click(); });
  await page.waitForSelector('.cad-mais-btn', { timeout: 15000 });
  async function redefinir() {
    await page.evaluate((mail) => { const tr = Array.from(document.querySelectorAll('#adminCadastrados tbody tr')).find((x) => x.textContent.toLowerCase().indexOf(mail) !== -1); tr.querySelector('.cad-mais-btn').click(); }, PESSOA.toLowerCase());
    await page.waitForSelector('.cad-acoes-modal');
    await page.click('.cad-acao-btn[data-acao="senha"]');
    await page.waitForSelector('.admin-modal-confirm-btn');
    const conf = await page.evaluate(() => (document.querySelector('.admin-modal-confirm-btn').closest('.modal-box') || document.body).textContent);
    await page.click('.admin-modal-confirm-btn');
    await esperarCondicao(page, () => Array.from(document.querySelectorAll('.modal-box')).some((b) => /Pedido de redefinição|Sem conexão|Muitas tentativas|Não foi possível/.test(b.textContent)), undefined, { limite: 8000 });
    const msg = await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.modal-box')).filter((x) => /Pedido de redefinição|Sem conexão|Muitas tentativas|Não foi possível/.test(x.textContent)).pop(); return b ? b.textContent : ''; });
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.modal-box button')).pop(); if (b) b.click(); });
    return { conf, msg };
  }
  let r = await redefinir();
  const pedAdm = await pedidos(page);
  afirma(/Enviar o link de redefinição de senha/.test(r.conf), 'ADMIN: confirmação diz que é um link', r.conf);
  afirma(/Pedido de redefinição enviado/.test(r.msg) && /Se houver conta com esse endereço/.test(r.msg) && /noreply@kyber-agil\.firebaseapp\.com/.test(r.msg) && /quarentena/.test(r.msg) && !/E-mail enviado para/.test(r.msg),
    'ADMIN: mensagem neutra (pedido, não entrega), com o remetente e a quarentena', r.msg);
  afirma(pedAdm.length === 1 && pedAdm[0].email === PESSOA.toLowerCase() && pedAdm[0].languageCode === 'pt-BR' && pedAdm[0].settings && !!pedAdm[0].settings.url, 'ADMIN: o MESMO envio (idioma pt-BR e endereço de volta)', JSON.stringify(pedAdm));
  for (const [codigo, re] of [['auth/network-request-failed', /Sem conexão com o servidor/], ['auth/too-many-requests', /Muitas tentativas em pouco tempo/], ['auth/user-not-found', /Não foi possível enviar agora.*auth\/user-not-found/]]) {
    await page.evaluate((c) => { window.__CFG.resetFalha = c; }, codigo);
    r = await redefinir();
    afirma(re.test(r.msg) && !/ainda não tem cadastro ativo|falha simulada/.test(r.msg), 'ADMIN, falha ' + codigo + ': causa explicada, sem "sem cadastro" e sem a mensagem crua', r.msg);
  }
  afirma(!consoleTxt.some((t) => /previ\.com\.br/i.test(t)), 'ADMIN: console sem e-mail');
  afirma(await larguraOk(page), 'ADMIN sem rolagem lateral');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await rodada(browser, { width: 1280, height: 900 }, 'Desktop 1280');
    await rodada(browser, { width: 375, height: 812 }, 'Celular 375');
  } catch (e) { console.log('ERRO', e && e.stack || e); falhas++; }
  await browser.close();
  console.log('\n' + (falhas ? falhas + ' falha(s)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})();
