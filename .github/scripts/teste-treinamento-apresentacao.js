/* Treinamento do tipo APRESENTAÇÃO — "Guardiões da Força: Missão Porto Lume" (Episódio IV), só para admin.
 *
 * Roda com o Firebase falso, em desktop e celular (375 px). Exige:
 *   1. o admin vê a apresentação; quem está inscrita numa turma do evento marcado NÃO vê (é de quem conduz a turma);
 *   2. o cartão diz "Apresentação" e abre em tela cheia, na moldura, com a CSP publicada, sem erro;
 *   3. avançar funciona; o Esc (que dentro dela para a fala) não fecha; o "← Voltar" fecha;
 *   4. todo áudio e toda fonte que a apresentação cita existem;
 *   5. aberta direto pelo endereço, volta ao site.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const RAIZ = path.join(__dirname, '../..');
const PASTA = path.join(RAIZ, 'forca-agil/apresentacao-porto-lume');
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const CSP = JSON.parse(fs.readFileSync(path.join(RAIZ, 'firebase.json'), 'utf8')).hosting.headers
  .reduce((m, h) => { const c = h.headers.find((x) => x.key === 'Content-Security-Policy'); if (c) m[h.source] = c.value; return m; }, {});
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const ADM = 'adm@previ.com.br', GER = 'gerente@previ.com.br';

function banco() {
  const users = {};
  [ADM, GER].forEach((e) => { users[chave(e)] = { name: e.split('@')[0].toUpperCase(), email: e, area: 'INFOR' }; });
  return {
    'fa-users': users, 'fa-admins': { [chave(ADM)]: { email: ADM, name: 'ADM' } }, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-progress': {}, 'fa-progress-historico': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: { ev4: { nome: 'EPISÓDIO IV', order: 1, publicado: true } },
    turmas: { t4: { label: 'TURMA 2 - GERENTES', eventoKey: 'ev4', dias: ['2026-12-02'] } },
    'turmas-interesse': { t4: { [chave(GER)]: { name: 'GERENTE', email: GER, status: 'inscrito', confirmedByAdmin: ADM } } },
    treinamentos: {
      tjedi: { nome: 'Treinamento Jedi', conteudoKey: 'jedi', eventos: { ev4: true }, order: 1 },
      tporto: { nome: 'Missão Porto Lume', conteudoKey: 'porto-lume', eventos: { ev4: true }, order: 2 },
    },
    'treinamentos-conteudo': {},
    avaliacoes: {}, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, apostas: {}, holocron: {}, pedidos: {},
  };
}

async function abrir(browser, opts, email) {
  const ctx = await browser.newContext(opts), page = await ctx.newPage(), erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) erros.push(m.text()); });
  page.on('response', (r) => { if (/apresentacao-porto-lume/.test(r.url()) && r.status() >= 400) erros.push(r.status() + ' ' + r.url()); });
  await page.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(), user: { email, emailVerified: true, uid: 'u1' }, delayDefault: 20 }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  /* a apresentação com a CSP publicada (o servidor local não manda nenhuma) */
  await page.route('**/apresentacao-porto-lume/index.html', async (r) => {
    const resp = await r.fetch();
    await r.fulfill({ response: resp, headers: Object.assign({}, resp.headers(), { 'content-security-policy': CSP['/forca-agil/apresentacao-porto-lume/index.html'] }) });
  });
  await page.goto(BASE + '/index.html#treinamento', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.getElementById('treinamento').hidden || !document.getElementById('treinamento-sem-acesso').hidden, null, { timeout: 15000 });
  await page.waitForTimeout(800);
  return { ctx, page, erros };
}
const opcoes = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.treino-seletor-select option')).map((o) => o.value));

(async () => {
  const browser = await chromium.launch();
  let falhas = 0;
  const anota = (l, ok, d) => { if (ok) console.log('  ok    ' + l); else { falhas++; console.error('  FALHA ' + l + (d ? ' → ' + d : '')); } };

  /* 4: tudo o que ela cita existe (falas, efeitos e fontes) */
  const js = fs.readdirSync(path.join(PASTA, 'js')).map((f) => fs.readFileSync(path.join(PASTA, 'js', f), 'utf8')).join('\n');
  const falas = Object.keys((() => { const w = {}; new Function('window', fs.readFileSync(path.join(PASTA, 'js/falas-dados.js'), 'utf8'))(w); return (w.FALAS || {}).falas || {}; })());
  const faltam = falas.filter((id) => !fs.existsSync(path.join(PASTA, 'audio/falas', id + '.mp3')));
  anota('as ' + falas.length + ' falas têm o áudio na pasta', falas.length > 0 && !faltam.length, faltam.slice(0, 5).join(' '));
  const sfx = [...new Set((js.match(/sfx\(\s*'([a-z0-9_]+)'/g) || []).map((s) => s.replace(/.*'(.*)'/, '$1')))];
  anota('os efeitos sonoros citados existem', sfx.every((n) => fs.existsSync(path.join(PASTA, 'audio/sfx', n + '.mp3'))), sfx.join(' '));
  const html = fs.readFileSync(path.join(PASTA, 'index.html'), 'utf8');
  const fontes = (html.match(/url\('([^']+)'\)/g) || []).map((s) => s.slice(5, -2));
  anota('as fontes existem e nada vem de fora do site', fontes.length === 4 && fontes.every((f) => fs.existsSync(path.join(PASTA, f))) && !/https?:\/\//.test(html + js));
  anota('o HTML não tem script embutido (a CSP publicada não deixaria rodar)', !/<script>/.test(html) && /script-src 'self';/.test(CSP['/forca-agil/apresentacao-porto-lume/index.html'] || ''));

  const FORMATOS = [['desktop', { viewport: { width: 1366, height: 768 } }], ['celular', { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true }]];
  for (const [nome, opts] of FORMATOS) {
    console.log('\n===== ' + nome.toUpperCase() + ' =====');
    const g = await abrir(browser, opts, GER);
    const og = await opcoes(g.page);
    anota('inscrita no Episódio IV não vê a apresentação (continua vendo o resto)', !og.includes('tporto') && /Treinamento Jedi|Autodiagn/.test(await g.page.textContent('#treinoCard')), og.join(' | '));
    await g.ctx.close();

    const { ctx, page, erros } = await abrir(browser, opts, ADM);
    anota('o admin vê a apresentação', (await opcoes(page)).includes('tporto'));
    await page.selectOption('.treino-seletor-select', 'tporto');
    const c = await page.evaluate(() => ['treinoCardTipo', 'treinoCardTitulo', 'treinoCardToggle', 'treinoCardStatus'].map((i) => document.getElementById(i).textContent));
    anota('o cartão é de apresentação', c[0] === 'Apresentação' && c[1] === 'Missão Porto Lume' && /Abrir apresentação/.test(c[2]) && c[3] === '', c.join(' | '));
    await page.click('#treinoCardToggle');
    const f = page.frameLocator('.jogo-tela-moldura');
    await f.locator('canvas#c').waitFor({ timeout: 15000 });
    const fr = page.frames().find((x) => /apresentacao-porto-lume/.test(x.url()));
    await fr.waitForFunction(() => window.GK && window.GK.i() === 0, null, { timeout: 15000 });
    anota('abre em tela cheia, na primeira tela', await page.evaluate(() => { const r = document.querySelector('.jogo-tela').getBoundingClientRect(); return r.width >= innerWidth - 1 && r.height >= innerHeight - 1; }));
    if (process.env.FOTO) await page.screenshot({ path: process.env.FOTO + '/porto-' + nome + '.png' });
    await f.locator('canvas#c').click();
    await fr.waitForFunction(() => window.GK.i() === 1 || window.GK.passo() > 0 || window.GK.comandos() > 0, null, { timeout: 5000 });
    anota('avançar funciona dentro do site', (await fr.evaluate(() => window.GK.comandos())) >= 1);
    await f.locator('canvas#c').press('Escape');
    await page.waitForTimeout(300);
    anota('Esc (parar a fala) não fecha a apresentação', await page.locator('.jogo-tela').count() === 1);
    await page.click('.jogo-tela .avp-voltar-link');
    anota('"← Voltar" fecha e fica no Treinamento', await page.locator('.jogo-tela').count() === 0 && /#treinamento/.test(page.url()));
    anota('sem erro de JavaScript, de CSP nem arquivo faltando', !erros.length, erros.slice(0, 3).join(' | '));

    const p2 = await ctx.newPage();
    await p2.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
    await p2.goto(BASE + '/forca-agil/apresentacao-porto-lume/index.html');
    await p2.waitForURL(/index\.html#treinamento/, { timeout: 10000, waitUntil: 'commit' });
    anota('aberta direto, volta ao site', /\/index\.html#treinamento/.test(p2.url()), p2.url());
    await ctx.close();
  }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' falha(s)' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
