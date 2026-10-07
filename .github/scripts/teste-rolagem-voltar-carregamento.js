/* ADMIN › Arquitetura: depois de um F5 em rede lenta, o fim do carregamento não rola a tela por
 * cima da posição escolhida pelo site nem da posição para onde a pessoa já rolou.
 * Desktop e celular (375 px). Hermético: Firebase falso, sem rede, sem segredo.
 *
 * POR QUE ESTE TESTE EXISTE
 * O CI (teste-admin-navegacao, "tela inicial rolada (50 px)") achou a tela da Arquitetura sendo
 * rolada sozinha. Causa: a restauração automática de rolagem do navegador é guardada POR ENTRADA do
 * histórico (history.scrollRestoration), e vale o modo da entrada para onde se VOLTA. O site punha
 * 'manual' só na entrada de onde SAÍA, por um instante; a entrada de chegada (#admin?arq=inicio)
 * ficava 'auto'. Com a página recarregada ainda carregando, o navegador adia essa restauração até
 * o fim do carregamento — e então rolava (suave) até a posição antiga, por cima de tudo.
 *
 * 2ª causa (achada por este teste): ao voltar, o hashchange chega numa tarefa depois do popstate;
 * a tela devolvia a posição no popstate e o router.js, no hashchange, subia ao topo por cima. Andar
 * entre áreas ?arq= agora é como trocar de subtela em #avaliacoes: quem posiciona é a tela.
 *
 * O carregamento é segurado de propósito (as imagens .png da página só são entregues quando o
 * teste libera), e o teste confere que a página ainda NÃO terminou de carregar antes de voltar —
 * senão ele não estaria provando nada.
 *
 *   1. F5 → "← Voltar" → carregamento termina → a rolagem não muda.
 *   2. F5 → "← Voltar" → a pessoa rola → carregamento termina → fica onde a pessoa rolou.
 *   3. Sem F5, com a CPU lenta (força o hashchange a chegar depois do popstate): o "← Voltar" e o
 *      Voltar/Avançar do navegador ficam na posição que a tela da Arquitetura define — a subida
 *      genérica do router ao topo, que chegava por último, não a desfaz (2ª causa, router.js).
 *   4. F5 → Voltar/Avançar do navegador → carregamento termina → a rolagem não muda, e as telas
 *      certas aparecem.
 *   5. Fora das áreas da Arquitetura a restauração do navegador continua ligada ('auto'). */
const { chromium } = require('playwright');
const { esperarSessaoAssentada } = require('./esperas');
const fs = require('fs');
const path = require('path');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const EMAIL = 'adm@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

function banco() {
  const admins = {}; admins[chave(EMAIL)] = { email: EMAIL };
  return { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-espera': {},
    'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {}, eventos: {}, 'turmas-publico': {}, 'eventos-publico': {},
    'avaliacoes-produto': {}, 'avaliacoes-squad': {}, 'motor-squad-config': {}, 'motor-squad-auditoria': {},
    'motor-arquitetura-config': {}, 'motor-arquitetura-auditoria': {}, 'fa-avaliacao-acessos': {} };
}

const y = (page) => page.evaluate(() => Math.round(window.pageYOffset));
const hash = (page) => page.evaluate(() => location.hash);
/* n quadros de animação: a restauração adiada começa no quadro seguinte ao fim do carregamento e,
   com a rolagem suave do site, dura ~15 quadros (medido); 40 cobre com folga, sem relógio. */
const quadros = (page, n) => page.evaluate((n) => new Promise((r) => { let i = 0; (function f() { if (++i >= n) r(); else requestAnimationFrame(f); })(); }), n);

async function abrir(browser, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(), user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  /* Carregamento segurado: enquanto `segurado` não for liberado, as imagens .png não chegam e o
     documento não termina de carregar (readyState fica em "interactive"). */
  const carga = { segurar: false, liberar: null, segurado: null };
  carga.prender = () => { carga.segurar = true; carga.segurado = new Promise((ok) => { carga.liberar = ok; }); };
  carga.soltar = () => { carga.segurar = false; if (carga.liberar) carga.liberar(); };
  await page.route('**/*.png', async (r) => { if (carga.segurar) await carga.segurado; r.continue(); });
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'load' });
  await esperarSessaoAssentada(page);
  await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
  await page.waitForSelector('#avpConfigQuestionariosBtn', { state: 'visible' });
  return { ctx, page, erros, carga };
}

/* Na tela inicial da Arquitetura: rola até `alvo`, entra em Configuração dos Motores. */
async function entrarEmMotores(page, alvo) {
  await page.evaluate((a) => window.scrollTo({ top: a, left: 0, behavior: 'instant' }), alvo);
  await page.waitForFunction((a) => Math.abs(window.pageYOffset - a) <= 1, alvo);
  await page.evaluate(() => document.getElementById('avpConfigMotoresBtn').click()); /* sem o rolar-até do Playwright */
  await page.waitForSelector('#avpMotorArqEditarBtn', { state: 'visible' });
}
/* F5 em Configuração dos Motores com o carregamento segurado; devolve se ele ainda está em curso. */
async function f5Lento(page, carga) {
  carga.prender();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  await page.waitForSelector('#avpMotorArqEditarBtn', { state: 'visible', timeout: 10000 });
  return page.evaluate(() => document.readyState !== 'complete');
}
/* Libera o carregamento, espera o fim e os quadros em que a restauração adiada rodaria. */
async function terminarCarregamento(page, carga) {
  await page.evaluate(() => { window.__rolagens = []; window.addEventListener('scroll', function () { window.__rolagens.push(Math.round(window.pageYOffset)); }); });
  carga.soltar();
  await page.waitForFunction(() => document.readyState === 'complete', null, { timeout: 10000 });
  await quadros(page, 40);
  return page.evaluate(() => window.__rolagens.join(','));
}
/* Espera o "← Voltar" (recuo do histórico) terminar de posicionar a tela inicial. */
async function aposVoltar(page) {
  await page.waitForFunction(() => location.hash === '#admin?arq=inicio', null, { timeout: 5000 });
  await page.waitForSelector('#avpConfigQuestionariosBtn', { state: 'visible' });
  await quadros(page, 3);
}

(async () => {
  const browser = await chromium.launch();
  for (const [nomeTela, viewport] of [['desktop', { width: 1280, height: 900 }], ['celular 375px', { width: 375, height: 800 }]]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros, carga } = await abrir(browser, viewport);
    const maximo = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    const SAIDA = Math.min(300, Math.max(0, maximo - 20));
    afirma(SAIDA >= 100, 'a tela inicial tem rolagem suficiente para o teste (' + SAIDA + ' px)');

    console.log('\n== 3. Sem F5, máquina lenta (CPU 8×): quem posiciona é a tela, não o router ==');
    /* Com a CPU lenta, o hashchange (tarefa separada) chega DEPOIS de a tela ter devolvido a posição
       no popstate — a ordem que, antes, deixava a subida genérica do router ao topo por último. */
    const cdp = await ctx.newCDPSession(page);
    const lento = async (fn) => { await cdp.send('Emulation.setCPUThrottlingRate', { rate: 8 }); try { return await fn(); } finally { await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); } };
    await page.evaluate(() => { window.__ordem = []; ['popstate', 'hashchange'].forEach((n) => window.addEventListener(n, () => window.__ordem.push(n + '@' + Math.round(window.pageYOffset)))); });
    await entrarEmMotores(page, SAIDA);
    await lento(async () => { await page.click('#avpMotoresVoltarLista'); await aposVoltar(page); await quadros(page, 40); });
    const ordem3 = await page.evaluate(() => window.__ordem.join(' → '));
    afirma(/^popstate@\d+ → hashchange@\d+$/.test(ordem3) && Number(ordem3.split('hashchange@')[1]) === SAIDA, '"← Voltar" do site: popstate → a tela devolve ' + SAIDA + ' px → hashchange chega depois', ordem3);
    afirma(Math.abs(await y(page) - SAIDA) <= 2, 'e o hashchange tardio não leva a tela para 0 (fica em ' + SAIDA + ' px)', await y(page) + ' px');
    await entrarEmMotores(page, SAIDA);
    await lento(async () => { await page.goBack({ waitUntil: 'commit' }); await aposVoltar(page); await quadros(page, 40); });
    afirma(Math.abs(await y(page) - SAIDA) <= 2, 'Voltar do navegador: a tela devolve a posição de saída (' + SAIDA + ' px)', await y(page) + ' px');
    await lento(async () => {
      await page.goForward({ waitUntil: 'commit' });
      await page.waitForFunction(() => location.hash === '#admin?arq=motores', null, { timeout: 5000 });
      await page.waitForSelector('#avpMotorArqEditarBtn', { state: 'visible' });
      await quadros(page, 40);
    });
    const voltarAVista = await page.evaluate(() => { const b = document.getElementById('avpMotoresVoltarLista').getBoundingClientRect(); return b.top >= 0 && b.bottom <= window.innerHeight; });
    afirma(voltarAVista, 'Avançar do navegador: Configuração dos Motores com o "← Voltar" do topo à vista (' + await y(page) + ' px)');
    await page.click('#avpMotoresVoltarLista');
    await aposVoltar(page);
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));

    console.log('\n== 1. F5 → "← Voltar" → carregamento termina: a rolagem não muda ==');
    await entrarEmMotores(page, SAIDA);
    afirma(await f5Lento(page, carga), 'depois do F5 a página ainda está carregando (o teste vale)');
    await page.click('#avpMotoresVoltarLista');
    await aposVoltar(page);
    const y1 = await y(page);
    afirma(await page.evaluate(() => document.readyState !== 'complete'), 'o Voltar aconteceu antes do fim do carregamento');
    const rol1 = await terminarCarregamento(page, carga);
    afirma(Math.abs(await y(page) - y1) <= 2, 'fim do carregamento não rola a tela (posição do site: ' + y1 + ' px)', 'foi para ' + await y(page) + ' px; rolagens: ' + rol1);

    console.log('\n== 2. F5 → "← Voltar" → a pessoa rola → carregamento termina: fica onde ela rolou ==');
    await entrarEmMotores(page, SAIDA);
    afirma(await f5Lento(page, carga), 'depois do F5 a página ainda está carregando (o teste vale)');
    await page.click('#avpMotoresVoltarLista');
    await aposVoltar(page);
    await page.mouse.move(Math.round(viewport.width / 2), Math.round(viewport.height / 2));
    await page.mouse.wheel(0, 180);
    await page.waitForFunction(() => window.pageYOffset >= 120, null, { timeout: 3000 });
    await quadros(page, 10); /* a roda termina de assentar */
    const yPessoa = await y(page);
    afirma(await page.evaluate(() => document.readyState !== 'complete'), 'a pessoa rolou antes do fim do carregamento (' + yPessoa + ' px)');
    const rol2 = await terminarCarregamento(page, carga);
    afirma(Math.abs(await y(page) - yPessoa) <= 2, 'fim do carregamento mantém a posição da pessoa (' + yPessoa + ' px)', 'foi para ' + await y(page) + ' px; rolagens: ' + rol2);

    console.log('\n== 4. F5 → Voltar e Avançar do navegador ==');
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
    await entrarEmMotores(page, SAIDA);
    afirma(await f5Lento(page, carga), 'depois do F5 a página ainda está carregando (o teste vale)');
    await page.goBack({ waitUntil: 'commit' });
    await aposVoltar(page);
    const y4 = await y(page);
    const rol4 = await terminarCarregamento(page, carga);
    afirma(Math.abs(await y(page) - y4) <= 2, 'Voltar do navegador: fim do carregamento não rola a tela (' + y4 + ' px)', 'foi para ' + await y(page) + ' px; rolagens: ' + rol4);
    afirma(await hash(page) === '#admin?arq=inicio' && await page.locator('#avpConfigQuestionariosBtn').isVisible(), 'Voltar do navegador: tela inicial da Arquitetura, no endereço certo');
    await page.goForward({ waitUntil: 'commit' });
    await page.waitForFunction(() => location.hash === '#admin?arq=motores', null, { timeout: 5000 });
    await page.waitForSelector('#avpMotorArqEditarBtn', { state: 'visible' });
    await quadros(page, 3);
    const y4b = await y(page);
    await quadros(page, 40);
    afirma(Math.abs(await y(page) - y4b) <= 2, 'Avançar do navegador: Configuração dos Motores, e a rolagem fica estável (' + y4b + ' px)', await y(page) + ' px');

    console.log('\n== 5. Fora da Arquitetura a restauração do navegador continua ligada ==');
    afirma(await page.evaluate(() => history.scrollRestoration) === 'manual', 'numa área da Arquitetura: manual');
    await page.evaluate(() => { location.hash = '#home'; });
    await page.waitForFunction(() => !document.getElementById('page-home').hidden);
    afirma(await page.evaluate(() => history.scrollRestoration) === 'auto', 'saindo para o Início: auto (não vaza para as outras telas)');

    afirma(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'sem rolagem horizontal');
    afirma(erros.length === 0, 'nenhum erro de JavaScript', erros.join(' | '));
    await ctx.close();
  }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nOK — o fim de um carregamento lento não rola a Arquitetura por cima do site nem da pessoa (desktop e 375 px).');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
