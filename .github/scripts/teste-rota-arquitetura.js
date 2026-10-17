/* A FLORESTA — rota #arquitetura (PR de contratos de navegação da unificação; Núcleo de Arquitetura Organizacional).
 * Prova, no desktop e a 375 px, com o Firebase falso (nada é gravado):
 *   - o endereço oficial é #arquitetura, com todos os subendereços da área (?po=, ?sq=, ?an=, ?mf=, ?tr=, ?av=, ?avp=…);
 *   - links antigos continuam valendo: "#avaliacoes…" (com os parâmetros) vira "#arquitetura…" na carga e na navegação,
 *     sem criar entrada nova no histórico; "#admin?avp=<chave>" abre a ficha em #arquitetura; uma entrada ANTIGA do
 *     histórico (Voltar) também cai em #arquitetura;
 *   - F5, Voltar e Avançar preservam o destino; o retorno à origem (ADMIN › Abrir Mapa → Voltar) continua certo;
 *   - nome visível A FLORESTA: menu "A Floresta" (href #arquitetura, identificador técnico) para os três perfis da
 *     Avaliação, escondido para quem não tem perfil; título da página "A Floresta". */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const SJ = require('./semente-jornada');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
let falhas = 0;
function afirma(c, msg, det) { console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + JSON.stringify(det) : '')); if (!c) falhas++; }

async function abrir(browser, vp, hash, o) {
  o = o || {};
  const db = SJ.semente();
  const email = o.email || SJ.ARQ;
  db['fa-admins'] = o.admin === false ? {} : { [SJ.chave(SJ.ARQ)]: { email: SJ.ARQ, name: 'ADMIN' } };
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify({ db, user: { email, emailVerified: true, uid: 'u1' }, delayDefault: 5, persistenciaReal: true }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros, db };
}
const hash = (page) => page.evaluate(() => location.hash);
const ver = (page, sel, descricao) => esperarCondicao(page, (s) => { const e = document.querySelector(s); return !!e && e.getBoundingClientRect().width > 0; }, sel, { limite: 15000, descricao });

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [nome, vp] of [['desktop', { width: 1280, height: 900 }], ['375 px', { width: 375, height: 812 }]]) {
      console.log('\n######## ' + nome + ' ########');

      console.log('\n== Endereço oficial e título ==');
      let r = await abrir(browser, vp, '#arquitetura');
      await ver(r.page, '#avpInicioCartaoNatureza', 'o Início da Floresta');
      afirma(await hash(r.page) === '#arquitetura', '#arquitetura abre o Início da área', await hash(r.page));
      const hero = await r.page.evaluate(() => ({ e: document.querySelector('#page-avaliacoes .page-hero .eyebrow').textContent.trim(), h: document.querySelector('#page-avaliacoes .page-hero h1').textContent.trim() }));
      afirma(hero.e === 'Força Ágil' && hero.h === 'A Floresta', 'título da página: "A Floresta" (o nome técnico #arquitetura não aparece)', hero);
      const menu = await r.page.evaluate(() => { const a = document.querySelector('a.nav-link-avaliacoes'); return { txt: a.textContent.trim(), href: a.getAttribute('href'), oculto: a.hidden }; });
      afirma(menu.txt === 'A Floresta' && menu.href === '#arquitetura' && !menu.oculto, 'menu: "A Floresta" → #arquitetura (admin geral)', menu);
      /* Voltar/Avançar dentro da área */
      await r.page.click('#avpInicioNatureza');
      await ver(r.page, '#avpfNome', 'a nova avaliação');
      afirma(await hash(r.page) === '#arquitetura?nova=1', 'Começar → #arquitetura?nova=1', await hash(r.page));
      await r.page.goBack(); await ver(r.page, '#avpInicioCartaoNatureza', 'o Início de novo');
      afirma(await hash(r.page) === '#arquitetura', 'Voltar do navegador: Início da Arquitetura', await hash(r.page));
      await r.page.goForward(); await ver(r.page, '#avpfNome', 'a nova avaliação de novo');
      afirma(await hash(r.page) === '#arquitetura?nova=1', 'Avançar do navegador: de volta à nova avaliação', await hash(r.page));
      afirma(r.erros.length === 0, 'nenhum erro de página', r.erros);
      await r.ctx.close();

      console.log('\n== Links antigos (#avaliacoes) ==');
      r = await abrir(browser, vp, '#avaliacoes?po=lista');
      await ver(r.page, '#poNovoBtn', 'a lista O1–O9 pelo link antigo');
      afirma(await hash(r.page) === '#arquitetura?po=lista', 'carga com "#avaliacoes?po=lista" → "#arquitetura?po=lista", na tela certa', await hash(r.page));
      await r.page.reload({ waitUntil: 'domcontentloaded' }); await esperarSessaoAssentada(r.page);
      await ver(r.page, '#poNovoBtn', 'a lista O1–O9 depois do F5');
      afirma(await hash(r.page) === '#arquitetura?po=lista', 'F5: continua em #arquitetura?po=lista');
      /* navegação para um endereço antigo de dentro do site: uma entrada só no histórico */
      await r.page.evaluate(() => { location.hash = '#home'; });
      await esperarCondicao(r.page, () => location.hash === '#home', null, { descricao: '#home' });
      const n0 = await r.page.evaluate(() => history.length);
      await r.page.evaluate(() => { location.hash = '#avaliacoes?mf=catalogo'; });
      await ver(r.page, '#mfBusca', 'os Trabalhos pelo endereço antigo');
      const n1 = await r.page.evaluate(() => history.length);
      afirma(await hash(r.page) === '#arquitetura?tr=1' && n1 === n0 + 1, 'navegar para "#avaliacoes?mf=catalogo" → "#arquitetura?tr=1" (a antiga Jornada, hoje nos Trabalhos), com UMA entrada no histórico', { hash: await hash(r.page), n0, n1 });
      await r.page.goBack(); await esperarCondicao(r.page, () => location.hash === '#home', null, { descricao: 'Voltar para #home' });
      afirma(true, 'Voltar: volta para #home (nenhuma entrada fantasma)');
      /* entrada ANTIGA no histórico: o Voltar a reescreve */
      await r.page.evaluate(() => { history.pushState(null, '', '#avaliacoes?tr=1'); history.pushState(null, '', '#home'); });
      await r.page.goBack();
      await ver(r.page, '#avpTrabIrProdutos', 'Trabalhos pela entrada antiga do histórico');
      afirma(await hash(r.page) === '#arquitetura?tr=1', 'Voltar para uma entrada antiga "#avaliacoes?tr=1" → "#arquitetura?tr=1", na tela de Trabalhos', await hash(r.page));
      afirma(r.erros.length === 0, 'nenhum erro de página', r.erros);
      await r.ctx.close();

      /* link antigo de uma ficha de dentro do ADMIN */
      const chave = Object.keys(SJ.semente()['avaliacoes-produto'] || {})[0];
      r = await abrir(browser, vp, '#admin?avp=' + chave);
      await ver(r.page, '#avpResumoFicha', 'a ficha pelo link antigo do ADMIN');
      afirma(await hash(r.page) === '#arquitetura?avp=' + chave, '"#admin?avp=<chave>" → "#arquitetura?avp=<chave>", com a ficha aberta', await hash(r.page));
      await r.ctx.close();

      console.log('\n== Retorno à origem (ADMIN › Abrir Mapa → Voltar) ==');
      r = await abrir(browser, vp, '#arquitetura?arq=inicio');
      await ver(r.page, '#avpAdminAbrirMapa', 'o Início de Avaliações e Mapa');
      await r.page.click('#avpAdminAbrirMapa');
      await ver(r.page, '.mfm-painel', 'o Mapa');
      afirma(await hash(r.page) === '#arquitetura?mf=mapa', 'ADMIN › Abrir Mapa → #arquitetura?mf=mapa', await hash(r.page));
      const volta = r.page.locator('button:has-text("Voltar para a Gestão da Floresta")').first();
      afirma(await volta.count() === 1, 'o Mapa oferece "← Voltar para a Gestão da Floresta"');
      await volta.click();
      await esperarCondicao(r.page, () => /^#arquitetura\?arq=inicio/.test(location.hash), null, { limite: 15000, descricao: 'de volta ao ADMIN' });
      afirma(/^#arquitetura\?arq=inicio/.test(await hash(r.page)), 'Voltar: de volta ao ADMIN › Avaliações e Mapa', await hash(r.page));
      afirma(r.erros.length === 0, 'nenhum erro de página', r.erros);
      await r.ctx.close();

      console.log('\n== Menu por perfil ==');
      for (const [rotulo, email, admin, esperado] of [['Avaliação', SJ.AVAL, false, true], ['Avaliação + Configuração', SJ.ARQ, false, true], ['sem perfil da Avaliação', 'pessoa.sem.perfil@previ.com.br', false, false]]) {
        r = await abrir(browser, vp, '#home', { email, admin });
        await r.page.waitForTimeout(800);
        const m = await r.page.evaluate(() => { const a = document.querySelector('a.nav-link-avaliacoes'); return { visivel: !a.hidden, txt: a.textContent.trim() }; });
        afirma(m.visivel === esperado && m.txt === 'A Floresta', rotulo + ': menu "A Floresta" ' + (esperado ? 'visível' : 'escondido'), m);
        if (!esperado) {
          await r.page.evaluate(() => { location.hash = '#arquitetura'; });
          await esperarCondicao(r.page, () => location.hash === '#home', null, { limite: 15000, descricao: 'sem perfil volta ao Início do site' });
          afirma(await hash(r.page) === '#home', rotulo + ': #arquitetura por link direto não abre (volta ao Início do site)');
        }
        await r.ctx.close();
      }
    }
  } catch (e) { console.error(e); falhas++; }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
