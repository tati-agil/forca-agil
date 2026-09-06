/* Roda a suíte "▶ Automáticos" da aba Testes do painel Admin (forca-agil/testes.js)
   dentro de um Chromium headless, logado como uma conta admin de teste.
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

if (!EMAIL || !PASSWORD) {
  console.error('Defina FA_TEST_ADMIN_EMAIL e FA_TEST_ADMIN_PASSWORD no ambiente (segredos do repositório no CI).');
  process.exit(2);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));

  try {
    console.log('Abrindo', BASE_URL);
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    await page.waitForSelector('#loginEmail', { timeout: 15000 });
    await page.fill('#loginEmail', EMAIL);
    await page.fill('#loginPassword', PASSWORD);
    await page.click('#loginForm button[type="submit"]');

    /* Espera a sessão resolver (erro de login OU modal #authModal
       fechar, que é o que revelarSite() faz) antes de checar se a conta
       tem acesso de admin — assim, se o problema for permissão (conta
       existe mas não está em Administradores) em vez de credencial
       errada, o log deixa claro qual dos dois é, em vez de só estourar
       timeout genérico. */
    await Promise.race([
      page.waitForSelector('#loginErr:not([hidden])', { timeout: 20000 }).catch(() => {}),
      page.waitForSelector('#authModal[hidden]', { timeout: 20000 }).catch(() => {}),
    ]);

    const loginErrVisible = await page.locator('#loginErr').isVisible().catch(() => false);
    if (loginErrVisible) {
      const loginErrText = (await page.textContent('#loginErr')).trim();
      throw new Error('Login recusado pelo Firebase Auth: ' + loginErrText);
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
    const failures = await page.$$eval('#testesResultados .testes-row.fail', (rows) =>
      rows.map((r) => ({
        label: (r.querySelector('.testes-label') || {}).textContent || '',
        err: (r.querySelector('.testes-err') || {}).textContent || '',
      }))
    );

    console.log('\n=== RESULTADO ===');
    console.log(summaryText);
    if (failures.length) {
      console.log('\nFalhas:');
      failures.forEach((f) => console.log(' - ' + f.label + (f.err ? ' :: ' + f.err : '')));
    }

    await browser.close();
    process.exit(failures.length ? 1 : 0);
  } catch (e) {
    console.error('Erro executando os testes:', e.message);
    try { await page.screenshot({ path: 'testes-automaticos-erro.png' }); } catch (_) {}
    await browser.close();
    process.exit(2);
  }
})();
