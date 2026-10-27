/* CONTAS EXISTENTES — o login de quem já usa o Força Ágil continua igual. Desktop e 375 px.
 * Hermético: Firebase falso COM conferência de senha (CFG.senhas), sem rede, sem segredo — nenhum e-mail é enviado.
 * Guarda o requisito bloqueante da PR #437: nenhuma conta antiga perde acesso, troca de senha, refaz cadastro ou
 * volta a confirmar e-mail por causa de mudanças nos fluxos de e-mail de autenticação.
 * O que se prova (pelo login de verdade da tela, não por uma cópia da regra):
 *   1-4. Senhas de qualquer formato que o Firebase aceite — numérica de 8, alfanumérica, com símbolos (como as criadas
 *        pela página de redefinição do Firebase) e de 6 caracteres (abaixo do mínimo do cadastro) — entram: o site não
 *        acrescenta nenhuma validação de formato ou tamanho no login. Controle: senha errada continua recusada (o falso
 *        confere a senha; o teste não passa por aceitar qualquer coisa).
 *   5. Sessão válida carregada: continua conectada, nenhuma desconexão.
 *   6. Conta já verificada (com ou sem a marca emailVerificationRequired) e conta antiga sem a marca: entram sem pedir
 *      confirmação; conta liberada pela administração (adminApproved) também.
 *   7. Conta nova ainda não confirmada: continua barrada no painel "Confirme seu e-mail", sem sessão.
 *   8. Admin continua admin (menu ADMIN à vista); o cadastro (fa-users) e os nós de acesso ficam idênticos.
 *   9. Nenhum e-mail sai (nem verificação nem redefinição) ao entrar.
 *  10. Entrar não apaga nada: nenhuma gravação nula, e nada gravado em fa-users, fa-admins ou turmas-interesse. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

/* contas fictícias */
const C = {
  numerica:   { email: 'antiga.numerica@previ.com.br',   senha: '12345678' },
  alfa:       { email: 'antiga.alfa@previ.com.br',       senha: 'Senha2024abc' },
  redefinida: { email: 'antiga.redefinida@previ.com.br', senha: 'p@ss-Nova!x' },
  curta:      { email: 'antiga.curta@previ.com.br',      senha: '123456' },
  marcada:    { email: 'verificada.marcada@previ.com.br', senha: '87654321' },
  aprovada:   { email: 'aprovada.admin@previ.com.br',    senha: '12345678' },
  admin:      { email: 'adm.antiga@previ.com.br',        senha: 'Adm#2023' },
  pendente:   { email: 'nova.pendente@previ.com.br',     senha: '11223344' }
};
function banco() {
  const users = {};
  const add = (c, extra) => { users[chave(c.email)] = Object.assign({ name: c.email.split('@')[0].toUpperCase(), email: c.email, area: 'GEPES', createdAt: '2026-05-01T09:00:00.000Z' }, extra || {}); };
  add(C.numerica); add(C.alfa); add(C.redefinida); add(C.curta); add(C.admin);
  add(C.marcada, { emailVerificationRequired: true });
  add(C.aprovada, { adminApproved: true, createdByAdmin: C.admin.email });
  add(C.pendente, { emailVerificationRequired: true });
  const admins = {}; admins[chave(C.admin.email)] = { email: C.admin.email, name: 'ADM ANTIGA' };
  const interesse = { t1: {} }; interesse.t1[chave(C.numerica.email)] = { status: 'inscrito', confirmedByAdmin: C.admin.email, email: C.numerica.email };
  return { 'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: { t1: { nome: 'Turma 1' } }, 'turmas-interesse': interesse, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {} };
}
function senhas() { const s = {}; Object.values(C).forEach((c) => { s[c.email] = c.senha; }); return s; }

async function abrir(browser, viewport, cfgExtra) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const erros = [], consoleTxt = [];
  page.on('pageerror', (e) => erros.push(String(e) + (process.env.PILHA ? ' @ ' + e.stack : '')));
  page.on('console', (m) => consoleTxt.push(m.text()));
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(Object.assign({ db: banco(), senhas: senhas(), delayDefault: 10 }, cfgExtra || {})) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#home', { waitUntil: 'domcontentloaded' });
  return { ctx, page, erros, consoleTxt };
}
const visivel = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.offsetParent !== null; }, sel);
const estado = (page, conta) => page.evaluate((k) => {
  const C = window.__CFG;
  return {
    sessao: !!(window.faAuth && window.faAuth.getSession && window.faAuth.getSession()),
    painel: !document.getElementById('auth-verificacao').hidden && !document.getElementById('authModal').hidden,
    verificacoes: (C.__verificacoes || []).length, resets: (C.__resets || []).length, desconexoes: C.__desconexoes || 0,
    perfil: JSON.stringify((C.db['fa-users'] || {})[k] || null),
    escritas: (window.__ESCRITAS || []).map((e) => (typeof e === 'string' ? e : JSON.stringify(e)))
  };
}, chave(conta.email));

/* entra pela tela de login, como a pessoa */
async function entrar(page, conta) {
  await page.waitForFunction(() => !!window.faOpenAuthModal && !!window.faAuth, null, { timeout: 15000 });
  await esperarCondicao(page, () => !document.getElementById('authModal').hidden, undefined, { limite: 10000 });
  await page.evaluate(() => { const t = document.querySelector('.auth-tab[data-tab="login"]'); if (t) t.click(); });
  await page.fill('#loginPassword', conta.senha);
  await page.evaluate((e) => { document.getElementById('loginEmail').value = e; document.getElementById('loginForm').requestSubmit(); }, conta.email);
}
/* sessão de pé E acessos resolvidos (sair antes disso cai num defeito antigo do main, fora do escopo e registrado em docs/backlog-testes.md; este teste
   prova o acesso das contas antigas, não a saída rápida, e continua reprovando QUALQUER erro de página) */
const esperarSessao = async (page) => {
  await esperarCondicao(page, () => !!(window.faAuth.getSession && window.faAuth.getSession()) && document.getElementById('authModal').hidden, undefined, { limite: 10000 });
  await esperarSessaoAssentada(page);
};

async function rodada(browser, viewport, rotulo) {
  console.log('\n=== ' + rotulo + ' ===');
  const perfisAntes = banco()['fa-users'];

  for (const [nome, conta, desc] of [
    ['numerica', C.numerica, 'senha numérica de 8'], ['alfa', C.alfa, 'senha alfanumérica'], ['redefinida', C.redefinida, 'senha com símbolos (formato da página de redefinição)'],
    ['curta', C.curta, 'senha de 6 caracteres (abaixo do mínimo do cadastro)'], ['marcada', C.marcada, 'conta verificada com a marca emailVerificationRequired'],
    ['aprovada', C.aprovada, 'conta liberada pela administração (adminApproved)']]) {
    console.log('Conta existente — ' + desc);
    const { ctx, page, erros } = await abrir(browser, viewport, { user: null });
    await entrar(page, conta);
    await esperarSessao(page);
    const st = await estado(page, conta);
    afirma(st.sessao && !st.painel, 'entra, sem pedir confirmação de e-mail');
    afirma(st.verificacoes === 0 && st.resets === 0, 'nenhum e-mail enviado ao entrar', JSON.stringify(st));
    afirma(st.perfil === JSON.stringify(perfisAntes[chave(conta.email)]), 'cadastro (fa-users) idêntico', st.perfil);
    afirma(!st.escritas.some((e) => /fa-users|fa-admins|turmas-interesse|null/.test(e)), 'nada apagado nem gravado em cadastro, acesso ou inscrições', st.escritas.join(' ; '));
    if (nome === 'numerica') {
      await page.evaluate(() => window.faAuth.logout());
      await esperarCondicao(page, () => !window.faAuth.getSession(), undefined, { limite: 8000 });
      await entrar(page, { email: conta.email, senha: 'senha-errada-99' });
      await esperarCondicao(page, () => !document.getElementById('loginErr').hidden, undefined, { limite: 8000 });
      afirma(/E-mail ou senha inválidos/.test(await page.textContent('#loginErr')) && !(await page.evaluate(() => !!window.faAuth.getSession())),
        'controle: senha errada continua recusada (o teste confere a senha de verdade)');
    }
    afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
    await ctx.close();
  }

  console.log('Conta existente — admin');
  {
    const { ctx, page, erros } = await abrir(browser, viewport, { user: null });
    await entrar(page, C.admin);
    await esperarSessao(page);
    await esperarCondicao(page, () => { const a = document.getElementById('navAdmin'); return a && !a.hidden; }, undefined, { limite: 10000 });
    const st = await estado(page, C.admin);
    afirma(await page.evaluate((e) => window.faAuth.isAdmin(e), C.admin.email), 'continua admin (menu ADMIN à vista)');
    afirma(st.verificacoes === 0 && st.resets === 0 && st.perfil === JSON.stringify(perfisAntes[chave(C.admin.email)]), 'sem e-mail, cadastro idêntico', JSON.stringify(st));
    afirma(await page.evaluate(() => JSON.stringify(window.__CFG.db['fa-admins'])) === JSON.stringify(banco()['fa-admins']), 'nó de admins idêntico');
    afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
    await ctx.close();
  }

  console.log('Sessão válida já carregada (conta antiga sem a marca, inscrita numa turma)');
  {
    const { ctx, page, erros } = await abrir(browser, viewport, { user: { email: C.numerica.email, emailVerified: true, uid: 'u1' } });
    await esperarSessao(page);
    await page.waitForTimeout(2500);
    const st = await estado(page, C.numerica);
    afirma(st.sessao && !st.painel && st.desconexoes === 0, 'continua conectada, nenhuma desconexão', JSON.stringify(st));
    afirma(await page.evaluate(() => window.faAuth.getAccessLevel()) === 'enrolled', 'nível de acesso preservado (inscrita)');
    afirma(st.verificacoes === 0 && st.resets === 0, 'nenhum e-mail enviado');
    afirma(await page.evaluate(() => JSON.stringify(window.__CFG.db['turmas-interesse'])) === JSON.stringify(banco()['turmas-interesse']), 'inscrição idêntica');
    afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
    await ctx.close();
  }

  console.log('Conta antiga NÃO verificada e sem a marca (anterior à exigência de confirmação)');
  {
    const { ctx, page, erros } = await abrir(browser, viewport, { user: null, naoVerificadas: [C.alfa.email] });
    await entrar(page, C.alfa);
    await esperarSessao(page);
    const st = await estado(page, C.alfa);
    afirma(st.sessao && !st.painel && st.verificacoes === 0, 'entra normalmente, sem pedir confirmação nem enviar e-mail', JSON.stringify(st));
    afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
    await ctx.close();
  }

  console.log('Conta nova ainda não confirmada (com a marca)');
  {
    const { ctx, page, erros } = await abrir(browser, viewport, { user: null, naoVerificadas: [C.pendente.email] });
    await entrar(page, C.pendente);
    await esperarCondicao(page, () => !document.getElementById('auth-verificacao').hidden && !document.getElementById('authModal').hidden, undefined, { limite: 10000 });
    await page.waitForTimeout(500);
    const st = await estado(page, C.pendente);
    afirma(st.painel && !st.sessao, 'continua barrada no painel "Confirme seu e-mail", sem sessão');
    afirma(st.verificacoes === 0, 'entrar não dispara e-mail sozinho (só o botão de reenviar)');
    afirma(await visivel(page, '#reenviarVerificacao'), 'botão de reenviar à vista (está conectada)');
    afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
    await ctx.close();
  }
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
