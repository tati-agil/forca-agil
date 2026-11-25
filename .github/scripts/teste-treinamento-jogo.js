/* Treinamento do tipo JOGO — "A Última Transmissão".
 *
 * Roda com o Firebase falso, em desktop e celular (375 px). Exige:
 *   1. quem está com inscrição confirmada numa turma do evento ligado ao jogo vê o jogo; quem é de outro
 *      evento, não; quem só tem interesse, não; o admin vê sempre;
 *   2. o cartão do jogo não promete autodiagnóstico e abre em tela cheia; fecha pelo Voltar, por Esc e
 *      ao trocar de rota;
 *   3. o jogo vai do começo ao fim (resposta errada, certa, última missão e final), sem rolagem lateral;
 *   4. voltar ao autodiagnóstico pelo seletor funciona como antes;
 *   5. a página do jogo aberta direto volta ao site;
 *   6. o admin consegue CRIAR o treinamento do jogo no painel, com o evento escolhido;
 *   7. a CSP publicada permite o que o jogo usa; nenhum erro de JavaScript.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const CSP = JSON.parse(fs.readFileSync(path.join(__dirname, '../../firebase.json'), 'utf8')).hosting.headers
  .reduce((m, h) => { const c = h.headers.find((x) => x.key === 'Content-Security-Policy'); if (c) m[h.source] = c.value; return m; }, {});
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const ADM = 'adm@previ.com.br', DOIS = 'dois@previ.com.br', UM = 'um@previ.com.br', INT = 'int@previ.com.br';

function banco(semJogo) {
  const users = {}, i = (e, s) => ({ name: e, email: e, status: s, confirmedByAdmin: s === 'inscrito' ? ADM : null });
  [ADM, DOIS, UM, INT].forEach((e) => { users[chave(e)] = { name: e.split('@')[0].toUpperCase(), email: e, area: 'INFOR' }; });
  const treinamentos = { tjedi: { nome: 'Treinamento Jedi', conteudoKey: 'jedi', eventos: { ev1: true, ev2: true }, order: 1 } };
  if (!semJogo) treinamentos.tjogo = { nome: 'A Última Transmissão', conteudoKey: 'ultima-transmissao', eventos: { ev2: true }, order: 2 };
  return {
    'fa-users': users, 'fa-admins': { [chave(ADM)]: { email: ADM, name: 'ADM' } }, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-progress': {}, 'fa-progress-historico': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: { ev1: { nome: 'EVENTO UM', order: 1, publicado: true }, ev2: { nome: 'EVENTO DOIS', order: 2, publicado: true } },
    turmas: { t1: { label: 'TURMA 1', eventoKey: 'ev1', dias: ['2026-12-01'] }, t2: { label: 'TURMA 1', eventoKey: 'ev2', dias: ['2026-12-02'] } },
    'turmas-interesse': {
      t1: { [chave(UM)]: i(UM, 'inscrito'), [chave(INT)]: i(INT, 'inscrito') },
      t2: { [chave(DOIS)]: i(DOIS, 'inscrito'), [chave(INT)]: i(INT, 'interessado') },
    },
    treinamentos, 'treinamentos-conteudo': {},
    avaliacoes: {}, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, apostas: {}, holocron: {}, pedidos: {},
  };
}

async function abrir(browser, opts, email, hash, semJogo) {
  const ctx = await browser.newContext(opts), page = await ctx.newPage(), erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  page.on('console', (m) => { if (/Content Security Policy/i.test(m.text()) && /jogo|frame/i.test(m.text())) erros.push(m.text()); });
  await page.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(semJogo), user: { email, emailVerified: true, uid: 'u1' }, delayDefault: 20 }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  /* a página do jogo com a CSP publicada (o servidor local não manda nenhuma) */
  await page.route('**/jogo-ultima-transmissao.html', async (r) => {
    const resp = await r.fetch();
    await r.fulfill({ response: resp, headers: Object.assign({}, resp.headers(), { 'content-security-policy': CSP['/forca-agil/*.html'] }) });
  });
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  return { ctx, page, erros };
}
const opcoes = async (page) => {
  await page.waitForTimeout(1200);
  return page.evaluate(() => Array.from(document.querySelectorAll('.treino-seletor-select option')).map((o) => o.textContent));
};

(async () => {
  const browser = await chromium.launch();
  let falhas = 0;
  const anota = (l, ok, d) => { if (ok) console.log('  ok    ' + l); else { falhas++; console.error('  FALHA ' + l + (d ? ' → ' + d : '')); } };
  const FORMATOS = [['desktop', { viewport: { width: 1366, height: 768 } }], ['celular', { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true }]];

  anota('a CSP do site permite a moldura da mesma origem', /default-src 'self'/.test(CSP['/index.html']) && !/frame-src|child-src/.test(CSP['/index.html']));

  for (const [nome, opts] of FORMATOS) {
    console.log('\n===== ' + nome.toUpperCase() + ' =====');
    for (const [quem, email, ve] of [['evento 2', DOIS, true], ['só evento 1', UM, false], ['interesse no evento 2', INT, false], ['admin', ADM, true]]) {
      const a = await abrir(browser, opts, email, '#treinamento');
      const o = await opcoes(a.page);
      anota(quem + (ve ? ' vê o jogo' : ' não vê o jogo'), o.includes('A Última Transmissão') === ve, o.join(' | '));
      await a.ctx.close();
    }

    const { ctx, page, erros } = await abrir(browser, opts, DOIS, '#treinamento');
    await opcoes(page);
    await page.selectOption('.treino-seletor-select', 'tjogo');
    const c = await page.evaluate(() => ['treinoCardTipo', 'treinoCardTitulo', 'treinoCardSub', 'treinoCardToggle', 'treinoCardStatus'].map((i) => document.getElementById(i).textContent));
    anota('o cartão é do jogo', c[0] === 'Jogo' && c[1] === 'A Última Transmissão' && !/afirma/.test(c[2]) && /Abrir jogo/.test(c[3]) && c[4] === '', c.join(' | '));

    await page.click('#treinoCardToggle');
    const f = page.frameLocator('.jogo-tela-moldura');
    await f.locator('#av').waitFor({ timeout: 15000 });
    anota('abre em tela cheia', await page.evaluate(() => { const r = document.querySelector('.jogo-tela').getBoundingClientRect(); return r.width >= innerWidth - 1 && r.height >= innerHeight - 1; }));
    if (process.env.FOTO) await page.screenshot({ path: process.env.FOTO + '/' + nome + '-capa.png' });
    const larg = [];
    const lado = async (t) => { const s = await f.locator('body').evaluate(() => document.documentElement.scrollWidth - innerWidth); if (s > 1) larg.push(t + ':' + s); };
    for (let k = 0; k < 3; k++) { await f.locator('#av').click(); await lado('abertura' + k); }
    await f.locator('.holo:text-is("Scrum")').click();
    anota('resposta errada vira aprendizado', /APRENDIZADOS 1/.test(await f.locator('#topo').textContent()));
    if (process.env.FOTO) await page.screenshot({ path: process.env.FOTO + '/' + nome + '-pergunta.png' });
    const fontes = await f.locator('.holo').evaluateAll((xs) => Math.min(...xs.map((x) => parseFloat(getComputedStyle(x).fontSize))));
    anota('letra das opções legível', fontes >= 14, fontes + 'px');
    for (const r of ['Matriz CSD', '5 Porquês', 'É, Não É, Faz, Não Faz', 'GUT', 'Ideação Reversa', 'Kanban', 'Prototipação', 'Responder a mudanças mais que seguir um plano', 'Liderança Ágil', 'Agilidade Organizacional']) {
      await f.locator('.holo:text-is("' + r + '")').click(); await lado(r); await f.locator('#av').click();
    }
    for (const h of ['FOFA', 'Mapa de Stakeholders', 'OKR', 'E se…?', '6 Chapéus', 'Impacto × Esforço', 'Votação', 'Scrum']) await f.locator('[data-h="' + h + '"]').click();
    await lado('missao');
    await f.locator('#av').click();
    if (process.env.FOTO) await page.screenshot({ path: process.env.FOTO + '/' + nome + '-missao.png' });
    anota('última missão completa', /Rota completa/.test(await f.locator('#res').textContent()));
    await f.locator('#av').click();
    anota('chega ao final com 18 pontos', /Sinal restaurado!/.test(await f.locator('#tela').textContent()) && /18 pontos/.test(await f.locator('#tela').textContent()));
    await lado('final');
    anota('sem rolagem lateral em nenhuma tela', !larg.length, larg.join(' '));
    await f.locator('#av').click(); await f.locator('#ini').click();
    anota('Voltar ao início recomeça', /Começar/.test(await f.locator('#tela').textContent()));

    await f.locator('#tela').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Escape');
    anota('Esc fecha', await page.locator('.jogo-tela').count() === 0);
    await page.click('#treinoCardToggle'); await page.click('.jogo-tela .avp-voltar-link');
    anota('← Voltar fecha e fica no Treinamento', await page.locator('.jogo-tela').count() === 0 && /#treinamento/.test(page.url()));
    await page.click('#treinoCardToggle');
    await page.evaluate(() => { location.hash = '#home'; }); await page.waitForTimeout(300);
    anota('trocar de rota fecha', await page.locator('.jogo-tela').count() === 0);
    await page.evaluate(() => { location.hash = '#treinamento'; }); await page.waitForTimeout(600);
    await page.selectOption('.treino-seletor-select', 'tjedi');
    await page.click('#treinoCardToggle');
    anota('o autodiagnóstico continua abrindo', await page.locator('#qList .q-item').first().isVisible() && await page.textContent('#treinoCardTipo') === 'Autodiagnóstico');

    const p2 = await ctx.newPage();
    await p2.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
    await p2.goto(BASE + '/forca-agil/jogo-ultima-transmissao.html');
    await p2.waitForURL(/index\.html/, { timeout: 10000, waitUntil: 'commit' }).catch(() => {});
    anota('aberto direto, volta ao site', /index\.html/.test(p2.url()), p2.url());
    anota('sem erro de JavaScript', !erros.length, erros.join(' | '));
    await ctx.close();

    const adm = await abrir(browser, opts, ADM, '#admin', true);
    await adm.page.waitForTimeout(1500);
    await adm.page.evaluate(() => document.querySelector('[data-panel="adminPanelTreinamentos"]').click());
    await adm.page.locator('#adminTreinamentos button:has-text("Novo treinamento")').click();
    await adm.page.fill('#treinoFormNome', 'A Última Transmissão');
    await adm.page.selectOption('#treinoFormConteudo', 'ultima-transmissao');
    await adm.page.check('.treino-ev[value="ev2"]');
    await adm.page.click('.admin-modal-save-btn');
    await adm.page.waitForTimeout(800);
    const txt = await adm.page.textContent('#adminTreinamentos');
    anota('o admin cria o jogo no painel, ligado ao evento, sem aviso de falta', /Conteúdo: A Última Transmissão/.test(txt) && !/Ainda não aparece/.test(txt), txt.slice(0, 300));
    anota('painel sem erro', !adm.erros.length, adm.erros.join(' | '));
    await adm.ctx.close();
  }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' falha(s)' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
