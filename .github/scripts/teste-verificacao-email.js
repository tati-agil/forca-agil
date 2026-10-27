/* VERIFICAÇÃO DE E-MAIL — cadastro, painel "Confirme seu e-mail" e reenvio. Desktop e 375 px.
 * Hermético: Firebase falso, sem rede, sem segredo — NENHUM e-mail é enviado (o falso só registra o pedido).
 * O que se prova:
 *   1. Cadastro com envio ok: painel diz "Enviamos", mostra o remetente e a quarentena; o pedido vai em pt-BR e com
 *      endereço de volta ao site; a pessoa sai desconectada, então NÃO há botão de reenviar (que falharia) — o painel
 *      explica o caminho: entrar de novo.
 *   2. Cadastro com envio que falha (rede, código desconhecido): o painel NUNCA diz "Enviamos"; diz que a conta foi
 *      criada, mostra a falha com o código e o caminho para reenviar.
 *   3. Firebase recusa o endereço de volta: reenvia sem ele, e o painel diz "Enviamos".
 *   4. Envio sem resposta: aviso de prazo, botão do cadastro liberado (nunca "Aguarde…" para sempre).
 *   5. Cadastro com falha → volta ao login → entra com a conta não confirmada: mensagem NEUTRA (nunca "foi enviado"),
 *      botão de reenviar, reenvio em pt-BR com sucesso e falha tratados, acesso ao site continua barrado.
 *   5b. Login com conta não confirmada (conectada): botão de reenviar à vista; reenvio em pt-BR com endereço de volta,
 *      mensagem com o remetente e a quarentena; falha com a causa; sessão desconectada → orientação, sem pedido.
 *   6. Endereço de volta só nos domínios de produção (autorizados por padrão): kyber-agil.web.app e
 *      kyber-agil.firebaseapp.com voltam para si mesmos; prévia ou outro endereço → site oficial.
 *   7. O console nunca recebe o e-mail; nenhuma rolagem lateral; nenhum erro de página. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const NOVA = 'nova.pessoa@previ.com.br', PEND = 'pendente.teste@previ.com.br';
const OFICIAL = 'https://kyber-agil.web.app/';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

function banco() {
  const users = {}; users[chave(PEND)] = { name: 'PENDENTE TESTE', email: PEND, area: 'GEPES', emailVerificationRequired: true, createdAt: '2026-10-01T09:00:00.000Z' };
  return { 'fa-users': users, 'fa-admins': {}, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {} };
}
/* origem: serve o site local como se fosse outro endereço (para provar o endereço de volta por domínio) */
async function abrir(browser, viewport, cfgExtra, origem) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const erros = [], consoleTxt = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  page.on('console', (m) => consoleTxt.push(m.text()));
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(Object.assign({ db: banco(), delayDefault: 10 }, cfgExtra || {})) + ';');
  if (origem) {
    await page.route(origem + '/**', async (r) => {
      const u = new URL(r.request().url());
      const resp = await fetch(BASE + u.pathname);
      r.fulfill({ status: resp.status, headers: { 'content-type': resp.headers.get('content-type') || 'text/plain' }, body: Buffer.from(await resp.arrayBuffer()) });
    });
  }
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto((origem || BASE) + '/index.html#home', { waitUntil: 'domcontentloaded' });
  return { ctx, page, erros, consoleTxt };
}
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; }, sel);
const visivel = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.offsetParent !== null; }, sel);
const pedidos = (page) => page.evaluate(() => (window.__CFG.__verificacoes || []).slice());
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const painelVisivelTexto = (page) => page.evaluate(() => {
  const vp = document.getElementById('auth-verificacao');
  return Array.from(vp.querySelectorAll('h3, p')).filter((e) => !e.hidden && e.offsetParent !== null).map((e) => e.textContent.replace(/\s+/g, ' ').trim()).join(' | ');
});

async function cadastrar(page) {
  await page.waitForFunction(() => !!window.faOpenAuthModal, null, { timeout: 15000 });
  await page.evaluate(() => window.faOpenAuthModal('register'));
  await page.waitForSelector('#auth-register:not([hidden])');
  await page.fill('#regName', 'Nova Pessoa');
  await page.fill('#regPassword', '12345678');
  await page.fill('#regPasswordConfirm', '12345678');
  /* o e-mail por último e direto no valor: o campo completa "@previ.com.br" ao ganhar foco */
  await page.evaluate((e) => { document.getElementById('regEmail').value = e; document.getElementById('regArea').value = 'GEPES'; const t = document.getElementById('regTerms'); if (t) t.checked = true; }, NOVA);
  await page.evaluate(() => { document.getElementById('registerForm').requestSubmit(); });
}
const esperarPainel = (page, limite) => esperarCondicao(page, () => { const v = document.getElementById('auth-verificacao'); return v && !v.hidden; }, undefined, { limite: limite || 8000 });

async function rodada(browser, viewport, rotulo) {
  console.log('\n=== ' + rotulo + ' ===');

  console.log('Cadastro — envio ok');
  let { ctx, page, erros, consoleTxt } = await abrir(browser, viewport, { user: null, cadastroReal: true });
  await cadastrar(page);
  await esperarPainel(page);
  let painel = await painelVisivelTexto(page), ped = await pedidos(page);
  afirma(/Enviamos um link de confirmação para:/.test(painel) && painel.indexOf(NOVA) !== -1, 'painel: "Enviamos" e o e-mail de destino', painel);
  afirma(/noreply@kyber-agil\.firebaseapp\.com/.test(painel) && /quarentena e o lixo eletrônico/.test(painel) && /Força Ágil/.test(painel), 'painel: remetente, quarentena e Força Ágil', painel);
  afirma(!(await visivel(page, '#reenviarVerificacao')) && /volte para o login e entre com seu e-mail e senha/.test(painel), 'desconectada: sem botão de reenviar; o painel explica como reenviar', painel);
  afirma(ped.length === 1 && ped[0].email === NOVA && ped[0].languageCode === 'pt-BR' && ped[0].settings && ped[0].settings.url === OFICIAL,
    'pedido: idioma pt-BR e endereço de volta ao site oficial (endereço local não é domínio autorizado)', JSON.stringify(ped));
  afirma(await page.evaluate(() => !window.__CFG.__logado), 'depois do cadastro a pessoa fica desconectada (segurança preservada)');
  afirma(!(await visivel(page, '#verificacaoErr')), 'nenhuma caixa de erro à vista');
  afirma(await larguraOk(page), 'painel sem rolagem lateral');
  afirma(!consoleTxt.some((t) => /previ\.com\.br/i.test(t)), 'console sem e-mail');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();

  for (const [codigo, rotuloFalha] of [['auth/network-request-failed', 'rede'], ['auth/internal-error', 'código desconhecido']]) {
    console.log('Cadastro — envio falha (' + rotuloFalha + ')');
    ({ ctx, page, erros, consoleTxt } = await abrir(browser, viewport, { user: null, cadastroReal: true, verificacaoFalha: codigo }));
    await cadastrar(page);
    await esperarPainel(page);
    painel = await painelVisivelTexto(page);
    afirma(!/Enviamos/.test(painel) && /Sua conta foi criada para:/.test(painel), 'nunca diz "Enviamos"; diz que a conta foi criada', painel);
    afirma(await visivel(page, '#verificacaoErr') && (await texto(page, '#verificacaoErr')).indexOf('Não conseguimos enviar o e-mail de confirmação agora (código: ' + codigo + ')') === 0, 'falha à vista, com o código', await texto(page, '#verificacaoErr'));
    afirma(/volte para o login e entre com seu e-mail e senha/.test(painel) && !(await visivel(page, '#reenviarVerificacao')), 'orienta como reenviar (sem botão que falharia)', painel);
    afirma(consoleTxt.some((t) => t.indexOf('e-mail de verificação não enviado: ' + codigo) !== -1) && !consoleTxt.some((t) => /previ\.com\.br/i.test(t)), 'console: só o código, nunca o e-mail');
    afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
    await ctx.close();
  }

  console.log('Cadastro — Firebase recusa o endereço de volta');
  ({ ctx, page, erros } = await abrir(browser, viewport, { user: null, cadastroReal: true, verificacaoFalha: { primeira: 'auth/unauthorized-continue-uri' } }));
  await cadastrar(page);
  await esperarPainel(page);
  ped = await pedidos(page); painel = await painelVisivelTexto(page);
  afirma(ped.length === 2 && ped[0].settings && !ped[1].settings && ped[1].languageCode === 'pt-BR', 'reenvia sem o endereço de volta, ainda em pt-BR', JSON.stringify(ped));
  afirma(/Enviamos um link de confirmação/.test(painel) && !(await visivel(page, '#verificacaoErr')), 'painel: "Enviamos" (o e-mail saiu)', painel);
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();

  console.log('Cadastro — envio sem resposta');
  ({ ctx, page, erros } = await abrir(browser, viewport, { user: null, cadastroReal: true, verificacaoFalha: 'sem-resposta' }));
  await page.clock.install(); /* o prazo de 20 s corre no relógio falso */
  await cadastrar(page);
  await esperarCondicao(page, () => window.__CFG.__verificacoes && window.__CFG.__verificacoes.length === 1, undefined, { limite: 8000 });
  await page.clock.fastForward(21000);
  await esperarPainel(page);
  painel = await painelVisivelTexto(page);
  afirma(!/Enviamos/.test(painel) && /código: sem-resposta/.test(await texto(page, '#verificacaoErr')), 'sem resposta: falha à vista, nunca "Enviamos"', painel);
  afirma(await page.evaluate(() => { const b = document.querySelector('#registerForm [type=submit]'); return !b.disabled && !/Aguarde/.test(b.textContent); }), 'botão do cadastro liberado (nunca "Aguarde…" para sempre)');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();

  console.log('Cadastro com falha → volta ao login → entra com a conta não confirmada → reenvia');
  ({ ctx, page, erros, consoleTxt } = await abrir(browser, viewport, { user: null, cadastroReal: true, senhas: {}, verificacaoFalha: 'auth/network-request-failed' }));
  await cadastrar(page);
  await esperarPainel(page);
  afirma(/Sua conta foi criada para:/.test(await painelVisivelTexto(page)) && await page.evaluate(() => !window.__CFG.__logado), '1-2. conta criada, envio falhou, pessoa desconectada');
  await page.evaluate(() => { window.__CFG.verificacaoFalha = null; });
  await page.click('#verificacaoVoltar');
  await page.waitForSelector('#auth-login:not([hidden])');
  await page.fill('#loginPassword', '12345678');
  await page.evaluate((e) => { document.getElementById('loginEmail').value = e; document.getElementById('loginForm').requestSubmit(); }, NOVA);
  await esperarCondicao(page, () => !document.getElementById('auth-verificacao').hidden && !document.getElementById('authModal').hidden && /ainda não foi confirmado/.test(document.getElementById('verificacaoSituacao').textContent), undefined, { limite: 10000 });
  painel = await painelVisivelTexto(page);
  afirma(/Seu endereço de e-mail ainda não foi confirmado:/.test(painel) && /Para concluir o cadastro, utilize o link de verificação recebido por e-mail ou clique em “Reenviar e-mail”\./.test(painel),
    '3-4. de volta pelo login: mensagem neutra', painel);
  afirma(!/Enviamos|foi enviado|E-mail reenviado/.test(painel), '4. nunca afirma que o link foi enviado', painel);
  afirma(await visivel(page, '#reenviarVerificacao') && !(await visivel(page, '#verificacaoComoReenviar')), '5. conectada: botão de reenviar à vista');
  afirma(await page.evaluate(() => !window.faAuth.getSession() && document.getElementById('authModal').classList.contains('modal-overlay--forced')),
    '9. sem sessão no site: o painel é obrigatório (acesso continua barrado até confirmar)');
  await page.click('#reenviarVerificacao');
  await esperarCondicao(page, () => !document.getElementById('verificacaoOk').hidden || !document.getElementById('verificacaoErr').hidden, undefined, { limite: 8000 });
  ped = await pedidos(page);
  afirma(ped.length === 2 && ped[1].email === NOVA && ped[1].languageCode === 'pt-BR' && ped[1].settings && ped[1].settings.url === OFICIAL, '6-7. reenvio pedido em pt-BR, com endereço de volta', JSON.stringify(ped));
  afirma(/E-mail reenviado por noreply@kyber-agil\.firebaseapp\.com/.test(await texto(page, '#verificacaoOk')) && !(await visivel(page, '#verificacaoErr')), '8. sucesso do reenvio informado');
  await page.evaluate(() => { window.__CFG.verificacaoFalha = 'auth/network-request-failed'; });
  await page.click('#reenviarVerificacao');
  await esperarCondicao(page, () => !document.getElementById('verificacaoErr').hidden, undefined, { limite: 8000 });
  afirma(/Sem conexão com o servidor/.test(await texto(page, '#verificacaoErr')) && !(await visivel(page, '#verificacaoOk')), '8. falha do reenvio informada com a causa', await texto(page, '#verificacaoErr'));
  afirma(await page.evaluate(() => !window.faAuth.getSession()), '9. depois do reenvio, continua sem sessão no site');
  afirma(await larguraOk(page), 'sem rolagem lateral');
  afirma(!consoleTxt.some((t) => /previ\.com\.br/i.test(t)), 'console sem e-mail');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();

  console.log('Login com conta não confirmada — reenvio');
  ({ ctx, page, erros, consoleTxt } = await abrir(browser, viewport, { user: { email: PEND, emailVerified: false, uid: 'u-pend' } }));
  await esperarPainel(page, 15000);
  painel = await painelVisivelTexto(page);
  afirma(/Seu endereço de e-mail ainda não foi confirmado:/.test(painel) && painel.indexOf(PEND) !== -1 && !/Enviamos|foi enviado/.test(painel), 'painel: mensagem neutra ("ainda não foi confirmado") e o e-mail, sem afirmar envio', painel);
  afirma(await visivel(page, '#reenviarVerificacao') && !(await visivel(page, '#verificacaoComoReenviar')), 'conectada: botão de reenviar à vista (sem a orientação de entrar de novo)');
  afirma(await larguraOk(page), 'painel sem rolagem lateral');
  await page.click('#reenviarVerificacao');
  await esperarCondicao(page, () => !document.getElementById('verificacaoOk').hidden || !document.getElementById('verificacaoErr').hidden, undefined, { limite: 8000 });
  ped = await pedidos(page);
  afirma(ped.length === 1 && ped[0].email === PEND && ped[0].languageCode === 'pt-BR' && ped[0].settings && ped[0].settings.url === OFICIAL, 'reenvio: pt-BR e endereço de volta', JSON.stringify(ped));
  const okTxt = await texto(page, '#verificacaoOk');
  afirma(/E-mail reenviado por noreply@kyber-agil\.firebaseapp\.com/.test(okTxt) && /quarentena/.test(okTxt), 'reenvio: mensagem com o remetente e a quarentena', okTxt);
  await page.evaluate(() => { window.__CFG.verificacaoFalha = 'auth/too-many-requests'; });
  await page.click('#reenviarVerificacao');
  await esperarCondicao(page, () => !document.getElementById('verificacaoErr').hidden, undefined, { limite: 8000 });
  afirma(/Muitas tentativas em pouco tempo/.test(await texto(page, '#verificacaoErr')) && !(await visivel(page, '#verificacaoOk')), 'reenvio com falha: causa explicada', await texto(page, '#verificacaoErr'));
  await page.evaluate(() => { window.__CFG.verificacaoFalha = null; return firebase.auth().signOut(); });
  const antes = (await pedidos(page)).length;
  if (await visivel(page, '#reenviarVerificacao')) {
    await page.click('#reenviarVerificacao');
    await esperarCondicao(page, () => /volte para o login/.test(document.getElementById('verificacaoErr').textContent), undefined, { limite: 8000 });
    afirma(/Para reenviar, volte para o login e entre com seu e-mail e senha/.test(await texto(page, '#verificacaoErr')) && (await pedidos(page)).length === antes,
      'sessão desconectada: orientação clara, nenhum pedido ao Firebase', await texto(page, '#verificacaoErr'));
  } else {
    afirma((await pedidos(page)).length === antes, 'sessão desconectada: a tela saiu do painel, nenhum pedido ao Firebase');
  }
  afirma(!consoleTxt.some((t) => /previ\.com\.br/i.test(t)), 'console sem e-mail');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
}

async function enderecosDeVolta(browser) {
  console.log('\n=== Endereço de volta por domínio ===');
  const casos = [['https://kyber-agil.web.app', 'https://kyber-agil.web.app/'], ['https://kyber-agil.firebaseapp.com', 'https://kyber-agil.firebaseapp.com/'],
    ['https://kyber-agil--v2-preview-abc123.web.app', OFICIAL], ['https://outro-site.example.com', OFICIAL]];
  for (const [origem, esperado] of casos) {
    const { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, { user: { email: PEND, emailVerified: false, uid: 'u-pend' } }, origem);
    await esperarPainel(page, 15000);
    await page.click('#reenviarVerificacao');
    await esperarCondicao(page, () => !document.getElementById('verificacaoOk').hidden || !document.getElementById('verificacaoErr').hidden, undefined, { limite: 8000 });
    const ped = await pedidos(page);
    afirma(ped.length === 1 && ped[0].settings && ped[0].settings.url === esperado, origem + ' → ' + esperado, JSON.stringify(ped));
    afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
    await ctx.close();
  }
}

(async () => {
  const browser = await chromium.launch();
  try {
    await rodada(browser, { width: 1280, height: 900 }, 'Desktop 1280');
    await rodada(browser, { width: 375, height: 812 }, 'Celular 375');
    await enderecosDeVolta(browser);
  } catch (e) { console.log('ERRO', e && e.stack || e); falhas++; }
  await browser.close();
  console.log('\n' + (falhas ? falhas + ' falha(s)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})();
