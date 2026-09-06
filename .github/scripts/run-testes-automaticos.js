/* Roda a suíte "▶ Automáticos" da aba Testes do painel Admin (forca-agil/testes.js)
   dentro de um Chromium headless, logado como uma conta admin de teste, e
   complementa com checagens extras que cobrem regras que estavam na lista
   de "validação manual" de testes.js mas não escrevem dado real no
   Firebase — por isso dá pra automatizar aqui sem sujar o banco.
   Usado pelo workflow .github/workflows/testes-automaticos.yml — o site
   precisa estar servido em FA_BASE_URL (ex: http://127.0.0.1:8811) e o
   Realtime Database/Auth reais do projeto kyber-agil precisam estar
   acessíveis (não há emulador neste repo). */

let playwright;
try {
  playwright = require('playwright');
} catch (e) {
  /* fallback para sandboxes com Playwright instalado só globalmente */
  playwright = require('/opt/node22/lib/node_modules/playwright');
}
const { chromium } = playwright;

const BASE_URL = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const EMAIL = process.env.FA_TEST_ADMIN_EMAIL;
const PASSWORD = process.env.FA_TEST_ADMIN_PASSWORD;
/* Opcionais: conta comum (nem admin, nem diretor) para a checagem de
   acesso negado ao #admin. Sem elas, essa checagem é pulada. */
const MEMBER_EMAIL = process.env.FA_TEST_MEMBER_EMAIL;
const MEMBER_PASSWORD = process.env.FA_TEST_MEMBER_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Defina FA_TEST_ADMIN_EMAIL e FA_TEST_ADMIN_PASSWORD no ambiente (segredos do repositório no CI).');
  process.exit(2);
}

/* input[type=email] não suporta seleção de texto — o autofill @previ.com.br
   do site (autoPreviDominio, auth.js) mexe no value durante o próprio
   evento de foco disparado pelo fill() do Playwright, e o valor final pode
   ficar errado. Confirma e corrige direto via evaluate se precisar. */
async function fillEmailRobust(page, selector, value) {
  await page.fill(selector, value);
  const current = await page.inputValue(selector);
  if (current.trim().toLowerCase() !== value.trim().toLowerCase()) {
    await page.evaluate(
      ({ sel, val }) => { document.querySelector(sel).value = val; },
      { sel: selector, val: value }
    );
  }
}

/* Preenche e submete o formulário de login já visível na página. Espera a
   sessão resolver (erro OU modal fechar) e devolve o resultado — não usa
   exceção pra "login falhou", porque alguns testes daqui querem exatamente
   isso (senha errada). */
async function submitLogin(page, email, password) {
  await page.waitForSelector('#loginEmail', { timeout: 15000 });
  await fillEmailRobust(page, '#loginEmail', email);
  await page.fill('#loginPassword', password);
  await page.click('#loginForm button[type="submit"]');
  await Promise.race([
    page.waitForSelector('#loginErr:not([hidden])', { timeout: 20000 }).catch(() => {}),
    page.waitForSelector('#authModal[hidden]', { timeout: 20000 }).catch(() => {}),
  ]);
  const loginErrVisible = await page.locator('#loginErr').isVisible().catch(() => false);
  if (loginErrVisible) {
    return { ok: false, errorText: (await page.textContent('#loginErr')).trim() };
  }
  return { ok: true, errorText: null };
}

(async () => {
  const browser = await chromium.launch();
  const extraResults = [];
  let suiteFailures = [];
  let mainError = null;

  const page = await browser.newPage();
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));

  try {
    console.log('Abrindo', BASE_URL);
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    const loginResult = await submitLogin(page, EMAIL, PASSWORD);
    if (!loginResult.ok) {
      throw new Error('Login recusado pelo Firebase Auth: ' + loginResult.errorText);
    }

    const navAdminVisible = await page.locator('#navAdmin').isVisible().catch(() => false);
    if (!navAdminVisible) {
      throw new Error(
        'Login parece ter funcionado (sem erro em #loginErr, modal fechou), mas o link #navAdmin continua oculto — ' +
        'a conta ' + EMAIL + ' provavelmente não está cadastrada na aba Administradores do painel (isAdmin() retornou false).'
      );
    }

    console.log('Login OK, indo para #admin');
    await page.click('#navAdmin');

    await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelTestes"]', { timeout: 15000 });
    await page.click('.admin-tab-btn[data-panel="adminPanelTestes"]');

    await page.waitForSelector('.testes-run-btn[data-suite="todos"]', { timeout: 15000 });
    await page.click('.testes-run-btn[data-suite="todos"]');

    await page.waitForSelector(
      '#testesResultados .testes-summary.ok, #testesResultados .testes-summary.fail',
      { timeout: 30000 }
    );

    const summaryText = (await page.textContent('#testesResultados .testes-summary')).trim();
    suiteFailures = await page.$$eval('#testesResultados .testes-row.fail', (rows) =>
      rows.map((r) => ({
        label: (r.querySelector('.testes-label') || {}).textContent || '',
        err: (r.querySelector('.testes-err') || {}).textContent || '',
      }))
    );

    console.log('\n=== RESULTADO (suíte "▶ Automáticos" do painel) ===');
    console.log(summaryText);
    if (suiteFailures.length) {
      console.log('\nFalhas:');
      suiteFailures.forEach((f) => console.log(' - ' + f.label + (f.err ? ' :: ' + f.err : '')));
    }

    /* Checagem extra que reaproveita a MESMA sessão admin já aberta —
       mais barato que abrir outro contexto só pra isso. Cobre a regra
       manual "Admin — visibilidade das 14 abas no mobile". */
    await page.setViewportSize({ width: 375, height: 800 });
    await page.waitForTimeout(300);
    const mobileTabsCheck = await page.evaluate(() => {
      var btns = Array.from(document.querySelectorAll('.admin-tab-btn'));
      var visiveis = btns.filter(function (b) { return b.offsetParent !== null; });
      var cortadas = visiveis.filter(function (b) { return b.getBoundingClientRect().right > window.innerWidth + 1; });
      return { total: visiveis.length, cortadas: cortadas.length };
    });
    extraResults.push({
      name: 'Admin — todas as 14 abas continuam visíveis e sem corte em viewport mobile (375px)',
      passed: mobileTabsCheck.total === 14 && mobileTabsCheck.cortadas === 0,
      detail: mobileTabsCheck.total + '/14 visíveis, ' + mobileTabsCheck.cortadas + ' cortada(s)',
    });
  } catch (e) {
    mainError = e;
    console.error('Erro executando a suíte principal:', e.message);
    try { await page.screenshot({ path: 'testes-automaticos-erro.png' }); } catch (_) {}
  }

  /* Checagens que exigem estar deslogado ou usar outra conta — cada uma
     no seu próprio contexto (cookies/sessão isolados), sem mexer na
     sessão admin usada acima. Nenhuma delas grava dado real: login com
     senha errada e cadastro com e-mail duplicado são recusados pelo
     próprio Firebase antes de gravar qualquer coisa. */

  async function runIsolated(name, fn) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    try {
      const detail = await fn(p);
      extraResults.push({ name, passed: true, detail: detail || '' });
    } catch (e) {
      extraResults.push({ name, passed: false, detail: e.message });
    } finally {
      await ctx.close();
    }
  }

  await runIsolated('Visitante sem login: site fica oculto e só o modal de entrar aparece', async (p) => {
    await p.goto(BASE_URL, { waitUntil: 'networkidle' });
    await p.waitForSelector('#authModal', { timeout: 15000 });
    const aguardandoAuth = await p.evaluate(() => document.body.classList.contains('aguardando-auth'));
    const modalVisible = await p.locator('#authModal').isVisible();
    const semBotaoFechar = await p.evaluate(() => {
      var btn = document.getElementById('authClose');
      return !btn || getComputedStyle(btn).display === 'none';
    });
    if (!aguardandoAuth) throw new Error('body sem a classe "aguardando-auth"');
    if (!modalVisible) throw new Error('modal de login não está visível');
    if (!semBotaoFechar) throw new Error('botão de fechar o modal está visível (não deveria)');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(200);
    const modalAindaVisivel = await p.locator('#authModal').isVisible();
    if (!modalAindaVisivel) throw new Error('Esc fechou o modal forçado — visitante ficaria numa tela preta sem login');
  });

  await runIsolated('Login com senha errada mostra "E-mail ou senha inválidos."', async (p) => {
    await p.goto(BASE_URL, { waitUntil: 'networkidle' });
    const r = await submitLogin(p, EMAIL, 'senha-errada-de-proposito-999');
    if (r.ok) throw new Error('login não deveria ter funcionado com senha errada');
    if (r.errorText !== 'E-mail ou senha inválidos.') throw new Error('mensagem inesperada: "' + r.errorText + '"');
  });

  await runIsolated('Cadastro com e-mail já existente mostra erro (sem criar conta duplicada)', async (p) => {
    await p.goto(BASE_URL, { waitUntil: 'networkidle' });
    await p.waitForSelector('.auth-tab[data-tab="register"]', { timeout: 15000 });
    await p.click('.auth-tab[data-tab="register"]');
    await p.waitForSelector('#regEmail', { timeout: 10000 });
    await fillEmailRobust(p, '#regEmail', EMAIL);
    await p.fill('#regPassword', '12345678');
    await p.fill('#regPasswordConfirm', '12345678');
    await p.check('#regTerms');
    await p.click('#registerForm button[type="submit"]');
    await p.waitForSelector('#registerErr:not([hidden])', { timeout: 20000 });
    const errText = (await p.textContent('#registerErr')).trim();
    if (errText !== 'E-mail já cadastrado. Faça login.') throw new Error('mensagem inesperada: "' + errText + '"');
  });

  await runIsolated('Link "Admin" no menu some imediatamente após logout, inclusive no mobile com menu aberto', async (p) => {
    await p.setViewportSize({ width: 375, height: 800 });
    await p.goto(BASE_URL, { waitUntil: 'networkidle' });
    const r = await submitLogin(p, EMAIL, PASSWORD);
    if (!r.ok) throw new Error('login falhou: ' + r.errorText);
    await p.waitForSelector('#navAdmin:not([hidden])', { timeout: 15000 });
    await p.click('.nav-toggle');
    await p.waitForSelector('.nav-links.open', { timeout: 5000 });
    await p.click('#navLogout');
    await p.waitForSelector('#navAdmin[hidden]', { timeout: 10000 });
    /* O atributo hidden é gerenciado por auth.js — CSS de layout não pode
       sobrescrevê-lo com display:block e deixar o link visível de novo. */
    const displayReal = await p.evaluate(() => getComputedStyle(document.getElementById('navAdmin')).display);
    if (displayReal !== 'none') throw new Error('CSS sobrescreveu o hidden — display computado é "' + displayReal + '"');
  });

  await runIsolated('Check-in sem parâmetro de turma, ou com chave inexistente, mostra "QR Code inválido ou turma não encontrada."', async (p) => {
    await p.goto(BASE_URL, { waitUntil: 'networkidle' });
    const r = await submitLogin(p, EMAIL, PASSWORD);
    if (!r.ok) throw new Error('login falhou: ' + r.errorText);

    await p.goto(BASE_URL + '#checkin', { waitUntil: 'networkidle' });
    let bodyText = await p.textContent('body');
    if (!bodyText.includes('QR Code inválido ou turma não encontrada')) {
      throw new Error('sem parâmetro: mensagem de erro não encontrada na página');
    }

    /* router.js só chama onPageInit de novo quando a PÁGINA muda (current
       !== page) — trocar só a query string com #checkin ainda ativo não
       re-executa initCheckin(). Precisa sair pra #home e voltar. */
    await p.goto(BASE_URL + '#home', { waitUntil: 'networkidle' });
    await p.goto(BASE_URL + '#checkin?turma=chave-inexistente-teste-ci', { waitUntil: 'networkidle' });
    await p.waitForTimeout(500); // leitura assíncrona no Firebase antes de renderizar o erro
    bodyText = await p.textContent('body');
    if (!bodyText.includes('QR Code inválido ou turma não encontrada')) {
      throw new Error('chave inexistente: mensagem de erro não encontrada na página');
    }
  });

  if (MEMBER_EMAIL && MEMBER_PASSWORD) {
    await runIsolated('Acesso direto a #admin com conta comum redireciona pra #home', async (p) => {
      await p.goto(BASE_URL, { waitUntil: 'networkidle' });
      const r = await submitLogin(p, MEMBER_EMAIL, MEMBER_PASSWORD);
      if (!r.ok) throw new Error('login falhou: ' + r.errorText);
      await p.goto(BASE_URL + '#admin', { waitUntil: 'networkidle' });
      await p.waitForFunction(() => location.hash === '#home', { timeout: 10000 });
    });
  } else {
    console.log('\n(pulando "acesso direto a #admin com conta comum" — defina FA_TEST_MEMBER_EMAIL/FA_TEST_MEMBER_PASSWORD pra ativar)');
  }

  await browser.close();

  console.log('\n=== CHECAGENS EXTRAS (fora do botão "Automáticos") ===');
  let extraFail = 0;
  extraResults.forEach((r) => {
    console.log((r.passed ? '✅ ' : '❌ ') + r.name + (r.detail ? ' :: ' + r.detail : ''));
    if (!r.passed) extraFail++;
  });

  if (mainError) process.exit(2);
  process.exit((suiteFailures.length > 0 || extraFail > 0) ? 1 : 0);
})();
