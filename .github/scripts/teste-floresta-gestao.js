/* A FLORESTA — GESTÃO DA FLORESTA: as áreas que eram de ADMIN › Avaliações e Mapa e ADMIN › Taxonomia, agora dentro de
 * A Floresta (#arquitetura?arq=<área>), com os mesmos módulos e as mesmas permissões. Firebase falso em persistência real;
 * hermético; nada é gravado. Prova, no desktop e a 375 px:
 *   A. Admin geral: Início da Floresta mostra "Gestão da Floresta" (o que cada parte sustenta) com Taxonomia; abrir a
 *      Gestão a partir dele, F5, uma área (Motores) e Voltar do navegador para o Início da Gestão; "← Voltar para o Início
 *      da Floresta"; Referências com uma Documentação só e a Taxonomia; Taxonomia aberta pela Gestão volta para ela.
 *   B. Links antigos: #admin?arq=motores e #admin?arq=estruturas… abrem a mesma área em #arquitetura?arq=…, sem entrada
 *      nova no histórico; o ADMIN não tem mais as abas e aponta para a Gestão.
 *   C. "Avaliação + Configuração": vê a Gestão (sem Taxonomia, sem Usuários autorizados), não vê o menu ADMIN, e #admin
 *      leva para a Gestão; #arquitetura?arq=taxonomia mostra "sem acesso" (nada da Taxonomia).
 *   D. "Avaliação": não vê o bloco da Gestão no Início; #arquitetura?arq=inicio mostra "sem acesso".
 *   Sempre: nenhum erro de página e nenhuma rolagem lateral. */
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
  db['fa-admins'] = o.admin ? { [SJ.chave(o.email)]: { email: o.email, name: 'ADMIN' } } : {};
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify({ db, user: { email: o.email, emailVerified: true, uid: 'u1' }, delayDefault: 5, persistenciaReal: true }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const hash = (page) => page.evaluate(() => location.hash);
const visivel = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && e.getBoundingClientRect().width > 0 && (!e.checkVisibility || e.checkVisibility()); }, sel);
const ver = (page, sel, descricao) => esperarCondicao(page, (s) => { const e = document.querySelector(s); return !!e && e.getBoundingClientRect().width > 0 && (!e.checkVisibility || e.checkVisibility()); }, sel, { limite: 15000, descricao });
const naHash = (page, h, d) => esperarCondicao(page, (x) => location.hash === x, h, { limite: 15000, descricao: d || h });
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; }, sel);
const h1 = (page) => texto(page, '#page-avaliacoes .page-hero h1');
const semRolagemLateral = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [nome, vp] of [['desktop', { width: 1280, height: 900 }], ['375 px', { width: 375, height: 812 }]]) {
      console.log('\n######## ' + nome + ' ########');

      console.log('\n== A. Admin geral ==');
      let r = await abrir(browser, vp, '#arquitetura', { email: SJ.ARQ, admin: true });
      await ver(r.page, '#avpInicioGestao', 'o bloco Gestão da Floresta no Início');
      const gi = await texto(r.page, '#avpInicioGestao');
      afirma(/Questionários e motores/.test(gi) && /Estruturas/.test(gi) && /Taxonomia/.test(gi) && /nenhuma é etapa/.test(gi), 'Início: "Gestão da Floresta" diz o que cada parte sustenta, sem etapas (com Taxonomia, admin geral)', gi);
      afirma(await visivel(r.page, '#avpInicioTaxonomia'), 'Início: "Abrir a Taxonomia" (admin geral)');
      await r.page.click('#avpInicioGestaoAbrir');
      await ver(r.page, '#avpGrupoConfiguracao', 'o início da Gestão');
      afirma(await hash(r.page) === '#arquitetura?arq=inicio' && await h1(r.page) === 'Gestão da Floresta', 'Gestão em #arquitetura?arq=inicio, título "Gestão da Floresta"', { h: await hash(r.page), t: await h1(r.page) });
      afirma(await texto(r.page, '#avpGestaoVoltar') === '← Voltar para o Início da Floresta', 'início da Gestão: "← Voltar para o Início da Floresta"', await texto(r.page, '#avpGestaoVoltar'));
      afirma(await visivel(r.page, '#avpDocumentacaoBtn') && await visivel(r.page, '#avpTaxonomiaBtn') && await r.page.locator('#avaliacoesGestao :text-is("Documentos de referência")').count() === 0,
        'Referências: uma Documentação só e a Taxonomia (sem "Documentos de referência" repetido)');
      afirma(await visivel(r.page, '#avpUsuariosBtn'), 'Acessos: Usuários autorizados (admin geral)');
      afirma(await semRolagemLateral(r.page), 'Gestão sem rolagem lateral');
      /* uma área e o Voltar do navegador */
      await r.page.click('#avpConfigMotoresBtn');
      await naHash(r.page, '#arquitetura?arq=motores', 'Motores');
      afirma(true, 'Motores em #arquitetura?arq=motores');
      await r.page.reload({ waitUntil: 'domcontentloaded' }); await esperarSessaoAssentada(r.page);
      await esperarCondicao(r.page, () => location.hash === '#arquitetura?arq=motores' && /Gestão da Floresta/.test(document.querySelector('#page-avaliacoes .page-hero h1').textContent) && !!document.querySelector('#adminAvaliacaoProduto .avp-voltar-link'), null, { limite: 15000, descricao: 'F5 em Motores' });
      afirma(true, 'F5: continua em Motores, na Gestão');
      await r.page.goBack(); await ver(r.page, '#avpGrupoConfiguracao', 'o início da Gestão de novo');
      afirma(await hash(r.page) === '#arquitetura?arq=inicio', 'Voltar do navegador: início da Gestão', await hash(r.page));
      /* Taxonomia aberta pela Gestão: volta para a Gestão */
      await r.page.click('#avpTaxonomiaBtn');
      await esperarCondicao(r.page, () => /arq=taxonomia/.test(location.hash) && !!document.querySelector('#adminPanelTaxonomia:not([hidden]) .tax-ui'), null, { limite: 15000, descricao: 'a Taxonomia' });
      afirma(await h1(r.page) === 'Taxonomia' && !(await visivel(r.page, '#adminPanelArquitetura')), 'Taxonomia na Gestão, título "Taxonomia"');
      afirma(!(await visivel(r.page, '#flTaxVoltar')), 'com origem, a Taxonomia mostra o retorno dela (o genérico fica escondido)');
      await r.page.goBack(); await ver(r.page, '#avpGrupoConfiguracao', 'a Gestão de novo');
      afirma(await hash(r.page) === '#arquitetura?arq=inicio', 'Voltar: da Taxonomia para a Gestão');
      await r.page.click('#avpGestaoVoltar');
      await ver(r.page, '#avpInicioGestao', 'o Início da Floresta');
      afirma(await hash(r.page) === '#arquitetura' && await h1(r.page) === 'A Floresta', '"← Voltar para o Início da Floresta": o Início, com o título de volta');
      afirma(r.erros.length === 0, 'nenhum erro de página', r.erros);
      await r.ctx.close();

      console.log('\n== B. Links antigos e ADMIN ==');
      r = await abrir(browser, vp, '#admin?arq=motores', { email: SJ.ARQ, admin: true });
      await esperarCondicao(r.page, () => location.hash === '#arquitetura?arq=motores' && !!document.querySelector('#adminAvaliacaoProduto .avp-voltar-link'), null, { limite: 15000, descricao: 'Motores pelo link antigo' });
      afirma(true, '"#admin?arq=motores" → "#arquitetura?arq=motores", na mesma área');
      await r.page.evaluate(() => { location.hash = '#home'; }); await naHash(r.page, '#home');
      const n0 = await r.page.evaluate(() => history.length);
      await r.page.evaluate(() => { location.hash = '#admin?arq=documentacao'; });
      await naHash(r.page, '#arquitetura?arq=documentacao', 'Documentação pelo link antigo');
      await esperarCondicao(r.page, () => !!document.querySelector('#adminAvaliacaoProduto .avp-docs'), null, { limite: 15000, descricao: 'a tela da Documentação' });
      afirma(await r.page.evaluate(() => history.length) === n0 + 1 && await texto(r.page, '#adminAvaliacaoProduto .avp-docs h3') === 'Documentação', 'navegar para "#admin?arq=documentacao": a Documentação, com UMA entrada no histórico');
      await r.page.evaluate(() => { location.hash = '#admin'; });
      await esperarCondicao(r.page, () => location.hash === '#admin' && !document.getElementById('page-admin').hidden, null, { limite: 15000, descricao: 'o ADMIN' });
      const abas = await r.page.$$eval('.admin-tab-btn', (bs) => bs.map((b) => b.dataset.panel));
      afirma(abas.indexOf('adminPanelArquitetura') === -1 && abas.indexOf('adminPanelTaxonomia') === -1 && abas.length > 0, 'ADMIN: sem as abas "Avaliações e Mapa" e "Taxonomia" (as demais continuam)', abas);
      afirma(await r.page.getAttribute('#adminNotaFloresta a', 'href') === '#arquitetura?arq=inicio', 'ADMIN aponta para A FLORESTA › Gestão da Floresta');
      afirma(r.erros.length === 0, 'nenhum erro de página', r.erros);
      await r.ctx.close();

      console.log('\n== C. Avaliação + Configuração ==');
      r = await abrir(browser, vp, '#arquitetura', { email: SJ.ARQ, admin: false });
      await ver(r.page, '#avpInicioGestao', 'o bloco Gestão no Início');
      afirma(!/Taxonomia/.test(await texto(r.page, '#avpInicioGestao')) && !(await r.page.$('#avpInicioTaxonomia')), 'Início: Gestão sem Taxonomia');
      afirma(await r.page.evaluate(() => document.getElementById('navAdmin').hidden), 'sem o menu ADMIN');
      await r.page.click('#avpInicioGestaoAbrir');
      await ver(r.page, '#avpGrupoConfiguracao', 'a Gestão');
      afirma(!(await r.page.$('#avpTaxonomiaBtn')) && !(await r.page.$('#avpUsuariosBtn')) && await visivel(r.page, '#avpDocumentacaoBtn'), 'Gestão: Documentação sim; Taxonomia e Usuários autorizados não');
      await r.page.evaluate(() => { location.hash = '#admin'; });
      await naHash(r.page, '#arquitetura?arq=inicio', '#admin leva para a Gestão');
      afirma(true, '#admin → #arquitetura?arq=inicio (a área do perfil)');
      await r.page.evaluate(() => { location.hash = '#arquitetura?arq=taxonomia'; });
      await ver(r.page, '#flGestaoSemAcesso', 'sem acesso à Taxonomia');
      afirma(!(await visivel(r.page, '#adminPanelTaxonomia')) && !(await visivel(r.page, '#adminPanelArquitetura')), 'Taxonomia por link direto: "sem acesso", nada da Taxonomia na tela');
      afirma(r.erros.length === 0, 'nenhum erro de página', r.erros);
      await r.ctx.close();

      console.log('\n== D. Avaliação ==');
      r = await abrir(browser, vp, '#arquitetura', { email: SJ.AVAL, admin: false });
      await ver(r.page, '#avpInicioCartaoSquad', 'o Início');
      await r.page.waitForTimeout(500);
      afirma(!(await r.page.$('#avpInicioGestao')), 'Início: sem o bloco da Gestão');
      await r.page.evaluate(() => { location.hash = '#arquitetura?arq=inicio'; });
      await ver(r.page, '#flGestaoSemAcesso', 'sem acesso à Gestão');
      afirma(!(await visivel(r.page, '#adminPanelArquitetura')) && /Avaliação \+ Configuração/.test(await texto(r.page, '#flGestaoSemAcesso')), 'Gestão por link direto: "sem acesso", com o motivo');
      await r.page.click('#flGestaoSemAcesso a');
      await ver(r.page, '#avpInicioCartaoSquad', 'de volta ao Início');
      afirma(await hash(r.page) === '#arquitetura' && await h1(r.page) === 'A Floresta', '"← Voltar para A Floresta"');
      afirma(r.erros.length === 0, 'nenhum erro de página', r.erros);
      await r.ctx.close();
    }
  } catch (e) { console.error(e); falhas++; }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
