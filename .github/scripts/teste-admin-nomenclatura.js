/* ADMIN e GESTÃO DA FLORESTA: nomenclatura — hermético (Firebase falso), nada é gravado. As abas "Avaliações e Mapa" e
 *   "Taxonomia" saíram do ADMIN: são a Gestão da Floresta, dentro de A FLORESTA (#arquitetura?arq=…).
 *   1. Descrição geral do Painel Admin: "Área de administração do FORÇA ÁGIL…" (sem citar perfis nem áreas).
 *   2. Admin geral: abas "Avaliações e Mapa" e "Taxonomia", lado a lado; título "Administração das Avaliações e do Mapa
 *      da Floresta" com a descrição da área e a relação com a Taxonomia (usar × manter); o atalho "Abrir a aba
 *      Taxonomia" abre a aba, que diz "Administração dos conceitos, definições e relações…".
 *   3. Avaliação + Configuração: continua só com a área Avaliações e Mapa (sem barra de abas, sem a Taxonomia) e NÃO vê
 *      o atalho para a Taxonomia (nenhum link para área inacessível); a relação continua explicada em texto.
 *   4. F5 numa subtela (#arquitetura?arq=motores) e Voltar/Avançar continuam como antes.
 *   Desktop e 375 px, sem rolagem lateral. */
const { chromium } = require('playwright');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const fs = require('fs');
const path = require('path');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const ADM = 'adm@previ.com.br', ARQ = 'arquitetura@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
let falhas = 0, total = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + JSON.stringify(det) : '')); if (!c) falhas++; }

async function abrir(browser, viewport, email, hash) {
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': { [chave(ADM)]: { email: ADM } }, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-espera': {},
    'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {}, eventos: {}, 'turmas-publico': {}, 'eventos-publico': {},
    'avaliacoes-produto': {}, 'avaliacoes-squad': {}, 'motor-squad-config': {}, 'motor-squad-auditoria': {}, 'motor-arquitetura-config': {}, 'motor-arquitetura-auditoria': {},
    'fa-avaliacao-autorizados': { [chave(ARQ)]: { email: ARQ, tipo: 'avaliacao-arquitetura' } } };
  const cfg = { db, user: { email, emailVerified: true, uid: 'u-' + chave(email) }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + (hash || '#admin'), { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent.trim() : ''; }, sel);
const visivel = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const esperar = (page, fn) => esperarCondicao(page, fn, undefined, { limite: 15000 });

async function rodada(browser, viewport, rotulo) {
  console.log('\n== ' + rotulo + ' ==');
  /* admin geral */
  let { ctx, page, erros } = await abrir(browser, viewport, ADM);
  afirma(await texto(page, '.admin-hero p') === 'Área de administração do FORÇA ÁGIL. As abas disponíveis e as ações permitidas dependem do perfil de acesso.', '1. descrição geral do Painel Admin');
  const abas = await page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-btn')).map((b) => b.textContent.trim()));
  afirma(abas.length > 0 && abas.indexOf('Avaliações e Mapa') === -1 && abas.indexOf('Taxonomia') === -1, '2. ADMIN sem as abas "Avaliações e Mapa" e "Taxonomia" (elas são a Gestão da Floresta)', abas);
  afirma(/A FLORESTA › Gestão da Floresta/.test(await texto(page, '#adminNotaFloresta')), '2. o ADMIN diz onde elas ficam agora');
  await page.click('#adminNotaFloresta a');
  await page.waitForSelector('#avpQuestP1P16Btn');
  afirma(await texto(page, '#page-avaliacoes .page-hero h1') === 'Gestão da Floresta' && /questionários, motores, estruturas/.test(await texto(page, '#page-avaliacoes .page-hero p')), '2. título e descrição da área: Gestão da Floresta');
  afirma(await texto(page, '#avpGrupoDocumentacaoTitulo') === 'Referências' && await visivel(page, '#avpTaxonomiaBtn'), '2. Referências: Documentação e Taxonomia (admin geral)');
  afirma(await larguraOk(page), '2. área sem rolagem lateral');
  await page.evaluate(() => { document.getElementById('avpGrupoDocumentacao').open = true; }); /* a seção Referências abre recolhida */
  await page.click('#avpTaxonomiaBtn');
  await esperar(page, () => !document.getElementById('adminPanelTaxonomia').hidden && !!document.getElementById('taxTituloArea'));
  afirma(await texto(page, '#taxTituloArea') === 'Taxonomia' && await texto(page, '#taxLocal') === 'Catálogo de conceitos', '2. o cartão abre a Taxonomia, no Catálogo (cabeçalho compacto)');
  afirma(await larguraOk(page), '2. Taxonomia sem rolagem lateral');
  afirma(!erros.length, 'sem erro de página (admin geral)', erros);
  await ctx.close();

  /* Avaliação + Configuração: a mesma área, agora dentro de A FLORESTA */
  ({ ctx, page, erros } = await abrir(browser, viewport, ARQ));
  await page.waitForSelector('#avpQuestP1P16Btn');
  const restr = await page.evaluate(() => ({ hash: location.hash, navAdmin: document.getElementById('navAdmin').hidden, tax: document.getElementById('adminPanelTaxonomia').hidden,
    cartaoTax: !!document.getElementById('avpTaxonomiaBtn'), usuarios: !!document.getElementById('avpUsuariosBtn') }));
  afirma(restr.hash === '#arquitetura?arq=inicio' && restr.navAdmin === true && restr.tax === true, '3. Avaliação + Configuração: #admin leva à Gestão da Floresta; sem o menu ADMIN', restr);
  afirma(!restr.cartaoTax && !restr.usuarios, '3. sem a Taxonomia e sem Usuários autorizados (áreas do admin geral)', restr);
  afirma(await texto(page, '#page-avaliacoes .page-hero h1') === 'Gestão da Floresta', '3. o mesmo título');
  /* 4. F5 numa subtela e Voltar */
  await page.click('#avpConfigMotoresBtn');
  await esperar(page, () => location.hash === '#arquitetura?arq=motores');
  await page.reload({ waitUntil: 'domcontentloaded' }); await esperarSessaoAssentada(page);
  await esperar(page, () => location.hash === '#arquitetura?arq=motores' && !document.getElementById('adminPanelArquitetura').hidden);
  afirma(true, '4. F5 em #arquitetura?arq=motores: continua na subtela');
  await page.goBack(); await esperar(page, () => location.hash !== '#arquitetura?arq=motores');
  afirma(true, '4. Voltar sai da subtela');
  await page.goForward(); await esperar(page, () => location.hash === '#arquitetura?arq=motores');
  afirma(true, '4. Avançar volta à subtela');
  afirma(await larguraOk(page), '3/4. sem rolagem lateral');
  afirma(!erros.length, 'sem erro de página (Avaliação + Configuração)', erros);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await rodada(browser, { width: 1280, height: 900 }, 'Computador (1280 px)');
    await rodada(browser, { width: 375, height: 800 }, 'Celular (375 px)');
  } finally { await browser.close(); }
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
