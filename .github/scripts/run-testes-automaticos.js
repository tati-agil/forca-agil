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
  /* waitForSelector espera "visible" por padrão — um seletor [hidden] nunca
     bate com isso (elemento hidden nunca é "visible"), então esperar por
     "#authModal[hidden]" ficava preso até o timeout mesmo com o modal já
     fechado. waitForFunction lê a propriedade JS direto, sem essa armadilha. */
  await Promise.race([
    page.waitForSelector('#loginErr:not([hidden])', { timeout: 20000 }).catch(() => {}),
    page.waitForFunction(() => {
      var m = document.getElementById('authModal');
      return !!m && m.hidden === true;
    }, { timeout: 20000 }).catch(() => {}),
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

    /* O modal já fechou, mas isAdmin() confirma a conta com uma leitura
       assíncrona em fa-admins/ — .isVisible() sozinho é um snapshot único
       e pode rodar antes dessa leitura terminar. waitForFunction espera
       de verdade, com um timeout generoso. */
    const navAdminOk = await page.waitForFunction(() => {
      var el = document.getElementById('navAdmin');
      return !!el && el.hidden === false;
    }, { timeout: 10000 }).then(() => true).catch(() => false);
    if (!navAdminOk) {
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
    await p.fill('#regName', 'Teste Automático CI');
    await fillEmailRobust(p, '#regEmail', EMAIL);
    await p.fill('#regPassword', '12345678');
    await p.fill('#regPasswordConfirm', '12345678');
    /* #regArea é preenchido por um <select> visual próprio (custom-select)
       que grava o valor real num <input type="hidden">; setar o hidden
       direto evita depender da interação com esse widget aqui. */
    await p.evaluate(() => { document.getElementById('regArea').value = 'INFOR'; });
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
    /* Em viewport mobile o link só fica VISUALMENTE visível com o menu
       aberto (.nav-links fica display:none até o hamburguer abrir) — por
       isso checa primeiro só a propriedade "hidden" via JS, sem depender
       da checagem de visibilidade do Playwright, e só depois de abrir o
       menu confirma que ele aparece na tela de verdade. */
    await p.waitForFunction(() => {
      var el = document.getElementById('navAdmin');
      return !!el && el.hidden === false;
    }, { timeout: 15000 });
    await p.click('.nav-toggle');
    await p.waitForSelector('.nav-links.open', { timeout: 5000 });
    const visivelComMenuAberto = await p.locator('#navAdmin').isVisible();
    if (!visivelComMenuAberto) throw new Error('menu mobile aberto, mas #navAdmin não aparece na tela');
    await p.click('#navLogout');
    /* waitForSelector espera "visible" por padrão, e um elemento [hidden]
       nunca é "visible" — checar a propriedade via JS evita essa armadilha. */
    await p.waitForFunction(() => {
      var el = document.getElementById('navAdmin');
      return !!el && el.hidden === true;
    }, { timeout: 10000 });
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

  await runIsolated('Início: os 3 botões da abertura ficam lado a lado, não empilhados', async (p) => {
    await p.goto(BASE_URL, { waitUntil: 'networkidle' });
    const r = await submitLogin(p, EMAIL, PASSWORD);
    if (!r.ok) throw new Error('login falhou: ' + r.errorText);
    await p.goto(BASE_URL + '#home', { waitUntil: 'networkidle' });
    /* "⏸ Pausar" e "≡ Ler texto" são criados por app.js; só "↻ Repetir
       abertura" vem no HTML. Espera os três existirem antes de medir. */
    await p.waitForFunction(() => document.querySelectorAll('.crawl-btns .btn').length >= 3, { timeout: 15000 });
    const linhas = await p.evaluate(() => {
      var btns = Array.prototype.slice.call(document.querySelectorAll('.crawl-btns .btn'));
      var tops = btns.map(function (b) { return Math.round(b.getBoundingClientRect().top); });
      return { total: btns.length, distintos: tops.filter(function (t, i) { return tops.indexOf(t) === i; }).length };
    });
    if (linhas.total < 3) throw new Error('esperava 3 botões, achei ' + linhas.total);
    if (linhas.distintos !== 1) throw new Error('botões em ' + linhas.distintos + ' linhas diferentes — deveriam estar lado a lado');
  });

  await runIsolated('Início: "Role para começar" fica centralizado na largura do hero', async (p) => {
    await p.goto(BASE_URL, { waitUntil: 'networkidle' });
    const r = await submitLogin(p, EMAIL, PASSWORD);
    if (!r.ok) throw new Error('login falhou: ' + r.errorText);
    await p.goto(BASE_URL + '#home', { waitUntil: 'networkidle' });
    await p.waitForSelector('.scroll-cue', { timeout: 15000 });
    const desalinho = await p.evaluate(() => {
      var cue = document.querySelector('.scroll-cue');
      var hero = cue.closest('header') || document.body;
      var c = cue.getBoundingClientRect(), h = hero.getBoundingClientRect();
      return Math.abs((c.left + c.width / 2) - (h.left + h.width / 2));
    });
    /* Tolerância de 2px pra arredondamento de layout. */
    if (desalinho > 2) throw new Error('desalinhado do centro do hero em ' + Math.round(desalinho) + 'px');
  });

  await runIsolated('Início: "Conhecer a iniciativa" rola a página até a seção', async (p) => {
    await p.goto(BASE_URL, { waitUntil: 'networkidle' });
    const r = await submitLogin(p, EMAIL, PASSWORD);
    if (!r.ok) throw new Error('login falhou: ' + r.errorText);
    await p.goto(BASE_URL + '#home', { waitUntil: 'networkidle' });
    await p.waitForSelector('#heroKnow', { timeout: 15000 });
    const antes = await p.evaluate(() => window.scrollY);
    await p.click('#heroKnow');
    await p.waitForFunction((y) => window.scrollY > y + 100, antes, { timeout: 10000 });
  });

  await runIsolated('Início: menu mobile (375px) sem sobreposição entre hamburguer e logo', async (p) => {
    await p.setViewportSize({ width: 375, height: 800 });
    await p.goto(BASE_URL, { waitUntil: 'networkidle' });
    const r = await submitLogin(p, EMAIL, PASSWORD);
    if (!r.ok) throw new Error('login falhou: ' + r.errorText);
    await p.goto(BASE_URL + '#home', { waitUntil: 'networkidle' });
    await p.waitForSelector('.nav-toggle', { timeout: 15000 });
    const sobrepoe = await p.evaluate(() => {
      var t = document.querySelector('.nav-toggle');
      var marca = document.querySelector('.brand');
      if (!t || !marca) return 'faltando .nav-toggle ou .brand';
      var a = t.getBoundingClientRect(), b = marca.getBoundingClientRect();
      if (a.width === 0 || a.height === 0) return 'hamburguer sem tamanho (invisível)';
      var cruza = !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
      if (cruza) return 'hamburguer sobrepõe o logo';
      if (a.right > window.innerWidth + 1) return 'hamburguer cortado na borda da tela';
      return null;
    });
    if (sobrepoe) throw new Error(sobrepoe);
    /* E o menu abre com todos os links alcançáveis. */
    await p.click('.nav-toggle');
    await p.waitForSelector('.nav-links.open', { timeout: 5000 });
  });

  await runIsolated('Menu: clicar no nome/avatar leva para o Treinamento Jedi', async (p) => {
    await p.goto(BASE_URL, { waitUntil: 'networkidle' });
    const r = await submitLogin(p, EMAIL, PASSWORD);
    if (!r.ok) throw new Error('login falhou: ' + r.errorText);
    await p.waitForFunction(() => {
      var el = document.getElementById('navProfile');
      return !!el && el.hidden === false;
    }, { timeout: 15000 });
    await p.goto(BASE_URL + '#home', { waitUntil: 'networkidle' });
    /* Clica no nome, não no "Sair" que mora dentro do mesmo bloco. */
    await p.click('#navProfile .nav-profile-name');
    await p.waitForFunction(() => location.hash === '#treinamento', { timeout: 10000 });
  });

  await runIsolated('Menu: "Sair" encerra a sessão e volta para o Início', async (p) => {
    await p.goto(BASE_URL, { waitUntil: 'networkidle' });
    const r = await submitLogin(p, EMAIL, PASSWORD);
    if (!r.ok) throw new Error('login falhou: ' + r.errorText);
    await p.goto(BASE_URL + '#turmas', { waitUntil: 'networkidle' });
    await p.waitForFunction(() => location.hash === '#turmas', { timeout: 10000 });
    await p.click('#navLogout');
    await p.waitForFunction(() => location.hash === '#home', { timeout: 10000 });
    /* Sessão encerrada de verdade: o site volta a exigir login. */
    await p.waitForFunction(() => document.body.classList.contains('aguardando-auth'), { timeout: 10000 });
  });

  await runIsolated('Admin: abrir #admin direto (F5 / link salvo) carrega os dados das abas', async (p) => {
    await p.goto(BASE_URL, { waitUntil: 'networkidle' });
    const r = await submitLogin(p, EMAIL, PASSWORD);
    if (!r.ok) throw new Error('login falhou: ' + r.errorText);
    /* Entra direto pela URL, sem passar pelo menu — é o caminho que já
       quebrou antes, quando o painel não esperava o fa-auth-ready. */
    await p.goto(BASE_URL + '#admin', { waitUntil: 'networkidle' });
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForFunction(() => location.hash === '#admin', { timeout: 15000 });
    await p.waitForFunction(() => {
      var painel = document.getElementById('page-admin');
      if (!painel || painel.hidden) return false;
      var cadastrados = document.getElementById('adminCadastrados');
      var eventos = document.getElementById('adminInterests');
      var texto = ((cadastrados && cadastrados.textContent) || '') + ((eventos && eventos.textContent) || '');
      /* Some o "Carregando…" e sobra conteúdo de verdade. */
      return texto.length > 0 && texto.indexOf('Carregando') === -1;
    }, { timeout: 25000 });
  });

  await runIsolated('Ajuda: os 5 tipos de pedido aparecem e o "Enviar" só habilita depois de escolher um', async (p) => {
    await p.goto(BASE_URL, { waitUntil: 'networkidle' });
    const r = await submitLogin(p, EMAIL, PASSWORD);
    if (!r.ok) throw new Error('login falhou: ' + r.errorText);
    await p.goto(BASE_URL + '#ajuda', { waitUntil: 'networkidle' });
    await p.waitForSelector('.ped-tipo-btn', { timeout: 15000 });
    const tipos = await p.$$eval('.ped-tipo-btn', (bs) => bs.map((b) => b.dataset.tipo));
    const esperados = ['tema', 'curso', 'material', 'duvida', 'outros'];
    if (tipos.length !== 5 || !esperados.every((t) => tipos.indexOf(t) !== -1)) {
      throw new Error('tipos inesperados: ' + JSON.stringify(tipos));
    }
    const antes = await p.evaluate(() => document.getElementById('pedEnviar').disabled);
    if (antes !== true) throw new Error('"Enviar pedido" já começa habilitado, sem tipo escolhido');
    await p.click('.ped-tipo-btn[data-tipo="curso"]');
    await p.waitForFunction(() => document.getElementById('pedEnviar').disabled === false, { timeout: 5000 });
    /* Nada é enviado: o teste para aqui, sem clicar em "Enviar pedido". */
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
