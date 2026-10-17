/* TAXONOMIA ABRE POR QUALQUER CAMINHO — desktop e 375 px. Hermético (Firebase falso), nada é gravado.
 * O defeito: só o CLIQUE na aba carregava a Taxonomia; os atalhos (hoje o "Abrir a aba Taxonomia" de Avaliações e Mapa), o link do Manual e o F5
 * (faAdminAbrirAba) ficavam em "Carregando a Taxonomia…" para sempre. Agora o ativador de abas do ADMIN é o caminho
 * único. Prova-se o CONTEÚDO carregado (não só a aba selecionada) em:
 *   1. atalho "Abrir a aba Taxonomia" (admin geral), F5 no destino, Voltar/Avançar;
 *   2. clique direto na aba — UMA leitura dos conceitos (sem inicialização duplicada) e nenhuma releitura ao voltar à aba;
 *   3. link do Manual;
 *   4. leitura lenta: "Carregando…" e depois o conteúdo;
 *   5. falha: aviso com "Tentar novamente", e a nova tentativa carrega. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const { semente, chave } = require('./semente-jornada');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const ADM = 'admin.geral@previ.com.br';
let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

async function abrir(browser, viewport, hash, opts) {
  opts = opts || {};
  const db = semente();
  db['fa-admins'] = { [chave(ADM)]: true };
  db['fa-users'][chave(ADM)] = { name: 'Admin', email: ADM, area: 'INFOR' };
  const cfg = { db, user: { email: ADM, emailVerified: true, uid: 'u-adm' }, delayDefault: 10, persistenciaReal: true, delays: opts.delays || {}, fail: opts.fail || [] };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const carregada = () => { const p = document.getElementById('adminPanelTaxonomia'); return !!p && p.classList.contains('active') && !/Carregando a Taxonomia|Verificando o acesso/.test(p.textContent) && /Que tipo de estrutura organizacional é esta?|O que é o item?/.test(p.textContent); };
const esperarCarregada = (page, limite) => esperarCondicao(page, carregada, undefined, { limite: limite || 15000 });
const naArquitetura = (page) => esperarCondicao(page, () => !!document.getElementById('avpAdminMapa') && /^#admin\?arq=inicio/.test(location.hash), undefined, { limite: 15000 });
const atalhoTaxonomia = async (page) => { await page.waitForSelector('#admArqIrTaxonomia:not([hidden])', { timeout: 15000 }); await page.click('#admArqIrTaxonomia'); };
const noInicio = (page) => esperarCondicao(page, () => { const e = document.getElementById('avpInicio'); return !!e && e.offsetParent !== null && location.hash === '#arquitetura'; }, undefined, { limite: 15000 });
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
/* conta as leituras da Taxonomia (once/on por caminho), instalado com a página pronta, para provar que não há inicialização duplicada */
const instalarContador = (page) => page.evaluate(() => {
  window.__leiturasTax = {};
  const proto = Object.getPrototypeOf(window.firebase.database().ref('x'));
  if (proto.__contando) return;
  proto.__contando = true;
  ['once', 'on'].forEach((m) => { const o = proto[m]; proto[m] = function () { const c = String(this.path || ''); if (/^taxonomia/.test(c)) window.__leiturasTax[c] = (window.__leiturasTax[c] || 0) + 1; return o.apply(this, arguments); }; });
});
const leiturasConceitos = (page) => page.evaluate(() => Object.keys(window.__leiturasTax).filter((k) => /conceitos/.test(k)).reduce((n, k) => n + window.__leiturasTax[k], 0));

async function rodada(browser, viewport, rotulo) {
  console.log('\n=== ' + rotulo + ' ===');
  console.log('1. Atalho "Abrir a aba Taxonomia" (ADMIN › Avaliações e Mapa)');
  let { ctx, page, erros } = await abrir(browser, viewport, '#admin?arq=inicio');
  await naArquitetura(page);
  await atalhoTaxonomia(page);
  await esperarCarregada(page);
  afirma(await page.evaluate(carregada), 'atalho: a Taxonomia CARREGA o conteúdo (não fica em "Carregando…"), com o retorno ao Início');
  await page.reload({ waitUntil: 'domcontentloaded' }); await esperarSessaoAssentada(page);
  await esperarCarregada(page, 20000);
  afirma(true, 'F5 no destino: a Taxonomia carrega de novo');
  await page.goBack(); await naArquitetura(page);
  afirma(true, 'Voltar: ADMIN › Avaliações e Mapa');
  await page.goForward(); await esperarCarregada(page, 20000);
  afirma(true, 'Avançar: a Taxonomia carregada');
  afirma(await larguraOk(page), 'sem rolagem lateral');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();

  console.log('2. Clique direto na aba (entrada pelo ADMIN)');
  ({ ctx, page, erros } = await abrir(browser, viewport, '#admin'));
  await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelTaxonomia"]:not([hidden])', { timeout: 15000 });
  await instalarContador(page);
  await page.click('.admin-tab-btn[data-panel="adminPanelTaxonomia"]');
  await esperarCarregada(page);
  await page.waitForTimeout(600);
  const depoisDoClique = await leiturasConceitos(page);
  /* uma leitura por domínio: o atalho "Integridade e configurações" confere os conceitos dos dois (admin) */
  const porDominio = await page.evaluate(() => [window.__leiturasTax['taxonomia/organizacional/conceitos'] || 0, window.__leiturasTax['taxonomia/arquitetural/conceitos'] || 0]);
  afirma(depoisDoClique === 2 && porDominio[0] === 1 && porDominio[1] === 1, 'clique: uma única leitura dos conceitos de cada domínio (sem inicialização duplicada)', String(depoisDoClique) + ' ' + JSON.stringify(await page.evaluate(() => window.__leiturasTax)));
  await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
  await page.click('.admin-tab-btn[data-panel="adminPanelTaxonomia"]');
  await esperarCarregada(page); await page.waitForTimeout(600);
  afirma((await leiturasConceitos(page)) === depoisDoClique, 'voltar à aba: nenhuma releitura (o conteúdo já carregado é reaproveitado)', String(await leiturasConceitos(page)));
  afirma(await page.evaluate(() => !document.getElementById('adminVoltaInicio') || document.getElementById('adminVoltaInicio').hidden), 'entrada direta: sem o retorno ao Início');

  await ctx.close();

  console.log('3. Link do Manual');
  ({ ctx, page, erros } = await abrir(browser, viewport, '#admin'));
  await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelManual"]:not([hidden])', { timeout: 15000 });
  await page.click('.admin-tab-btn[data-panel="adminPanelManual"]');
  await page.waitForSelector('.man-ir-aba[data-aba="adminPanelTaxonomia"]', { state: 'attached', timeout: 20000 });
  /* o link fica numa seção recolhida do Manual: o clique é o do próprio link (o mesmo ouvinte que a pessoa aciona) */
  await page.evaluate(() => document.querySelector('.man-ir-aba[data-aba="adminPanelTaxonomia"]').click());
  await esperarCarregada(page);
  afirma(true, 'link do Manual (página recém-aberta, Taxonomia nunca aberta antes): a Taxonomia carrega');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();

  console.log('4. Leitura lenta');
  ({ ctx, page, erros } = await abrir(browser, viewport, '#admin?arq=inicio', { delays: { taxonomia: 3000 } }));
  await naArquitetura(page);
  await atalhoTaxonomia(page);
  await esperarCondicao(page, () => { const p = document.getElementById('adminPanelTaxonomia'); return !!p && p.classList.contains('active'); }, undefined, { limite: 15000 });
  afirma(/Carregando a Taxonomia/.test(await page.evaluate(() => document.getElementById('adminPanelTaxonomia').textContent)), 'lenta: mostra "Carregando a Taxonomia…" enquanto lê');
  await esperarCarregada(page, 20000);
  afirma(true, 'lenta: depois, o conteúdo');
  await ctx.close();

  console.log('5. Falha e nova tentativa');
  /* o servidor não responde dentro do prazo de leitura (12 s): falha de conexão, com nova tentativa */
  ({ ctx, page, erros } = await abrir(browser, viewport, '#admin?arq=inicio', { delays: { taxonomia: 13000 } }));
  await naArquitetura(page);
  await atalhoTaxonomia(page);
  await esperarCondicao(page, () => !!document.getElementById('taxErro'), undefined, { limite: 30000 });
  const aviso = await page.evaluate(() => document.getElementById('taxErro').textContent);
  afirma(/Não foi possível carregar a Taxonomia/.test(aviso) && /tentar novamente/i.test(aviso), 'sem resposta: aviso compreensível com "Tentar novamente" (nunca "Carregando…" para sempre)', aviso);
  await page.evaluate(() => { window.__CFG.delays = {}; });
  await page.click('#taxErro button');
  await esperarCarregada(page, 20000);
  afirma(true, 'nova tentativa (o servidor volta a responder): carrega');
  await ctx.close();
  /* leitura recusada pelo banco: diz que não tem acesso, sem ficar carregando */
  ({ ctx, page, erros } = await abrir(browser, viewport, '#admin?arq=inicio', { fail: ['taxonomia'] }));
  await naArquitetura(page);
  await atalhoTaxonomia(page);
  await esperarCondicao(page, () => !!document.getElementById('taxSemAcesso'), undefined, { limite: 20000 });
  afirma(/não tem acesso/.test(await page.evaluate(() => document.getElementById('taxSemAcesso').textContent)), 'leitura recusada: "Você não tem acesso a esta área." (sem carregar para sempre)');
  afirma(await larguraOk(page), 'sem rolagem lateral');
  await ctx.close();
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
