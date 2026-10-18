/* NAVEGAÇÃO DE IDA E VOLTA ENTRE AS TELAS — cada tela aberta a partir de outra volta para ELA (botão da interface, Voltar
 * e Avançar do navegador e, onde faz sentido, F5), nos caminhos reais encontrados no código. Firebase falso em persistência
 * real; hermético; conteúdo fictício (semente-jornada.js). Desktop e 375 px. Nada é gravado.
 *
 *   N1. Posicionamento (ficha) → Adequação à Squad (nova) → "← Voltar para o Posicionamento" → a ficha (não a lista da Squad).
 *   N2. Posicionamento com Squad em andamento → Squad do item → Voltar → a ficha (não o Início); F5 na Squad mantém a origem.
 *   N3. Jornada (item) → "Abrir Posicionamento" → "← Voltar para a Jornada do Mapa" → o item; Voltar/Avançar do navegador.
 *   N4. Ficha de Produto/Serviço → "Posicionar" → Voltar → a ficha de Produto/Serviço.
 *   N5. Início → Trabalhos (com os registros da antiga Jornada) → "← Voltar para A Floresta" → Início, sem ciclo.
 *   N6. Trabalhos → "Ver adequações à Squad" → "← Voltar para os Trabalhos" → Trabalhos.
 *   N7. Mapa → estrutura (&e=) → objeto → "← Voltar para o Mapa da Floresta" → a mesma estrutura no Mapa.
 *   N8. Jornada: lista → item → "Voltar para a lista" volta de verdade (o Avançar devolve o item; sem ciclo).
 *   N9. Mapa → cadastro de estruturas / ficha da estrutura → "← Voltar para o Mapa da Floresta" → o Mapa.
 *   N10. Mapa → "Definição e documentação do Mapa" → "← Voltar para o Mapa da Floresta" → o Mapa.
 *   N11. Lista de Posicionamentos → ficha → "← Voltar para os Posicionamentos" → a lista (não o Início).
 *   N12. Jornada (item) → "Acessar Adequação à Squad" → "← Voltar para a Jornada do Mapa" → o item.
 *   N13. Gestão da Floresta → "Abrir Mapa da Floresta" → "← Voltar para a Gestão da Floresta" → a Gestão (Mapa aberto).
 *   Em todos: nenhum erro de JS, sem rolagem lateral, nenhuma gravação. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');
const SJ = require('./semente-jornada');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };
let falhas = 0;
function afirma(c, msg, det) { console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); if (!c) falhas++; }

function banco(o) {
  const db = SJ.semente();
  if (o && o.adminGeral) db['fa-admins'] = { [SJ.chave(SJ.ARQ)]: { email: SJ.ARQ, name: 'ADMIN' } };
  const Q = '2026-10-01T09:00:00.000Z', quem = { name: 'Pessoa', email: SJ.ARQ };
  if (o && o.squadEmAndamento) db['avaliacoes-squad'] = { sqA: { itemId: 'pAssess', itemNome: 'Assessoria Previdenciária', avaliacaoArquiteturalId: 'pAssess', questionarioCodigo: 'ADEQUACAO_SQUAD', questionnaireContentVersion: 1, status: 'rascunho',
    criadoEm: Q, atualizadoEm: Q, criadoPor: quem, atualizadoPor: quem, respostas: { S2: { codigoPergunta: 'S2', resposta: 'nao', questionnaireContentVersion: 1, dataResposta: Q } }, excluido: false } };
  return db;
}
async function abrir(browser, vp, hash, o) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(o), user: { email: SJ.ARQ, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const hashAgora = (page) => page.evaluate(() => location.hash);
/* textContent: o rótulo como escrito (o CSS de alguns botões o mostra em maiúsculas) */
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent.trim() : ''; }, sel);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const escritas = (page) => page.evaluate(() => (window.__ESCRITAS || []).length);
async function ate(page, fn, arg, descricao, limite) { await esperarCondicao(page, fn, arg, { limite: limite || 12000, descricao }); }
const fichaPo = (id) => (x) => location.hash.indexOf('#arquitetura?po=' + x) === 0 && !!document.getElementById('poVoltar') && !document.querySelector('#avaliacoesSquad:not([hidden])');
async function fim(r, nome) {
  afirma(await larguraOk(r.page), nome + ': sem rolagem lateral');
  afirma(await escritas(r.page) === 0, nome + ': nada gravado');
  afirma(r.erros.length === 0, nome + ': nenhum erro de JS (' + r.erros.length + ')');
  await r.ctx.close();
}

async function n1(browser, vp, tag) {
  console.log('\n== N1 (' + tag + '): Posicionamento → Squad nova → Voltar → Posicionamento ==');
  const r = await abrir(browser, vp, '#arquitetura?po=gS'); const page = r.page;
  await ate(page, () => !!document.getElementById('poAvaliarSquadBtn'), null, 'ficha gS com o atalho da Squad');
  await page.click('#poAvaliarSquadBtn');
  await ate(page, () => !!document.getElementById('sqVoltarListaChecklist'), null, 'checklist da Squad');
  afirma(await texto(page, '#sqVoltarListaChecklist') === '← Voltar para o Posicionamento', 'o retorno da Squad diz para onde vai: "← Voltar para o Posicionamento"', await texto(page, '#sqVoltarListaChecklist'));
  await page.click('#sqVoltarListaChecklist');
  await page.click('.sq-modal-confirm-btn');
  await ate(page, fichaPo('gS'), 'gS', 'de volta à ficha do Posicionamento');
  afirma(true, 'volta à ficha do Posicionamento (não à lista da Squad)');
  await fim(r, 'N1');
}
async function n2(browser, vp, tag) {
  console.log('\n== N2 (' + tag + '): Posicionamento com Squad em andamento → Squad → Voltar → Posicionamento; F5 ==');
  const r = await abrir(browser, vp, '#arquitetura?po=gS', { squadEmAndamento: true }); const page = r.page;
  await ate(page, () => !!document.getElementById('poAvaliarSquadBtn'), null, 'ficha gS');
  await page.click('#poAvaliarSquadBtn');
  await ate(page, () => /[?&]sq=sqA/.test(location.hash) && !!document.getElementById('sqVoltarListaChecklist'), null, 'Squad em andamento do item');
  await page.reload({ waitUntil: 'domcontentloaded' }); await esperarSessaoAssentada(page);
  await ate(page, () => !!document.getElementById('sqVoltarListaChecklist'), null, 'F5 na Squad');
  afirma(await texto(page, '#sqVoltarListaChecklist') === '← Voltar para o Posicionamento', 'F5 na Squad: a origem continua ("← Voltar para o Posicionamento")', await texto(page, '#sqVoltarListaChecklist'));
  await page.click('#sqVoltarListaChecklist');
  await page.click('.sq-modal-confirm-btn');
  await ate(page, fichaPo('gS'), 'gS', 'de volta à ficha (não ao Início)');
  afirma(true, 'Squad em andamento: Voltar devolve à ficha do Posicionamento, não ao Início');
  await fim(r, 'N2');
}
async function n3(browser, vp, tag) {
  console.log('\n== N3 (' + tag + '): Jornada (item) → Posicionamento → Voltar → item; Voltar/Avançar ==');
  const r = await abrir(browser, vp, '#arquitetura?tr=1&item=pAssess'); const page = r.page;
  await ate(page, () => !!document.querySelector('.mf-abrir-po'), null, 'item da Jornada');
  const origem = await hashAgora(page);
  await page.click('.mf-abrir-po');
  await ate(page, fichaPo('gS'), 'gS', 'ficha aberta pela Jornada');
  afirma(await texto(page, '#poVoltar') === '← Voltar para o registro', 'Posicionamento aberto pela Jornada: "← Voltar para a Jornada do Mapa"', await texto(page, '#poVoltar'));
  await page.goBack(); await ate(page, (h) => location.hash === h && !!document.querySelector('.mf-abrir-po'), origem, 'Voltar do navegador → item');
  await page.goForward(); await ate(page, fichaPo('gS'), 'gS', 'Avançar → ficha');
  afirma(await texto(page, '#poVoltar') === '← Voltar para o registro', 'Voltar/Avançar do navegador: a origem continua');
  await page.click('#poVoltar');
  await ate(page, (h) => location.hash === h && !!document.querySelector('.mf-abrir-po'), origem, 'botão → item da Jornada');
  afirma(true, 'o botão volta ao mesmo item da Jornada');
  await fim(r, 'N3');
}
async function n4(browser, vp, tag) {
  console.log('\n== N4 (' + tag + '): ficha de Produto/Serviço → Posicionar → Voltar → ficha ==');
  const r = await abrir(browser, vp, '#arquitetura?avp=pSem'); const page = r.page;
  await ate(page, () => !!document.getElementById('avpPosicionarBtn'), null, 'ficha pSem com "Posicionar"');
  await page.click('#avpPosicionarBtn');
  await ate(page, () => /po=escolher/.test(location.hash) && !!document.getElementById('poVoltar'), null, 'Posicionamento aberto pela ficha');
  afirma(await texto(page, '#poVoltar') === '← Voltar para a avaliação de Produto/Serviço', '"← Voltar para a avaliação de Produto/Serviço"', await texto(page, '#poVoltar'));
  await page.click('#poVoltar');
  await ate(page, () => location.hash === '#arquitetura?avp=pSem' && !!document.getElementById('avpPosicionarBtn'), null, 'de volta à ficha de Produto/Serviço');
  afirma(true, 'volta à ficha de Produto/Serviço (não ao Início)');
  await fim(r, 'N4');
}
async function n5(browser, vp, tag) {
  console.log('\n== N5 (' + tag + '): Início → Trabalhos (com os registros da antiga Jornada) → Voltar → Início ==');
  const r = await abrir(browser, vp, '#arquitetura'); const page = r.page;
  await ate(page, () => !!document.getElementById('avpInicioTrabalhos'), null, 'Início');
  await page.click('#avpInicioTrabalhos');
  await ate(page, () => location.hash === '#arquitetura?tr=1' && !!document.getElementById('mfVoltar') && !!document.getElementById('mfItens'), null, 'Trabalhos');
  afirma(await texto(page, '#mfVoltar') === '← Voltar para A Floresta', 'Trabalhos aberto pelo Início: "← Voltar para A Floresta"', await texto(page, '#mfVoltar'));
  await page.click('#mfVoltar');
  await ate(page, () => location.hash === '#arquitetura' && !!document.getElementById('avpInicio'), null, 'de volta ao Início');
  await page.goForward();
  await ate(page, () => /tr=1/.test(location.hash) && !!document.getElementById('mfVoltar'), null, 'Avançar → Trabalhos');
  afirma(true, 'Trabalhos → Voltar → Início é o Voltar do histórico (o Avançar devolve Trabalhos; sem ciclo)');
  await fim(r, 'N5');
}
async function n6(browser, vp, tag) {
  console.log('\n== N6 (' + tag + '): Trabalhos → Adequação à Squad → Voltar → Trabalhos ==');
  const r = await abrir(browser, vp, '#arquitetura?tr=1'); const page = r.page;
  await ate(page, () => !!document.getElementById('avpTrabIrSquad'), null, 'Trabalhos com a Adequação à Squad');
  await page.click('#avpTrabIrSquad');
  await ate(page, () => /sq=lista/.test(location.hash) && !!document.getElementById('sqVoltarArquitetura'), null, 'lista da Squad');
  afirma(/os Trabalhos/.test(await texto(page, '#sqVoltarArquitetura')), 'Squad aberta por Trabalhos: "← Voltar para os Trabalhos"', await texto(page, '#sqVoltarArquitetura'));
  await page.click('#sqVoltarArquitetura');
  await ate(page, () => /tr=1/.test(location.hash) && !!document.getElementById('mfTrabListas'), null, 'de volta a Trabalhos');
  afirma(true, 'volta aos Trabalhos');
  await fim(r, 'N6');
}
async function n7(browser, vp, tag) {
  console.log('\n== N7 (' + tag + '): Mapa → estrutura → objeto → Voltar → a estrutura no Mapa ==');
  const r = await abrir(browser, vp, '#arquitetura?mf=mapa&e=neg-1'); const page = r.page;
  await ate(page, () => !!document.querySelector('#mfmObjetos .mfm-objeto-nome'), null, 'detalhe da estrutura com os objetos', 15000);
  const origem = await hashAgora(page);
  await page.click('#mfmObjetos .mfm-objeto-nome');
  await ate(page, () => /tr=1&item=/.test(location.hash) && !!document.getElementById('mfVoltarLista'), null, 'objeto na Jornada');
  afirma(await texto(page, '#mfVoltarLista') === '← Voltar para o Mapa da Floresta', 'objeto aberto pelo Mapa: "← Voltar para o Mapa da Floresta"', await texto(page, '#mfVoltarLista'));
  await page.click('#mfVoltarLista');
  await ate(page, (h) => location.hash === h && !!document.getElementById('mfmDetalhe'), origem, 'de volta à estrutura no Mapa');
  afirma(true, 'volta à mesma estrutura aberta no Mapa (' + origem + ')');
  await fim(r, 'N7');
}
async function n8(browser, vp, tag) {
  console.log('\n== N8 (' + tag + '): Jornada lista → item → Voltar para a lista (sem ciclo) ==');
  const r = await abrir(browser, vp, '#arquitetura?tr=1'); const page = r.page;
  await ate(page, () => !!document.querySelector('.mf-linha-abrir'), null, 'lista da Jornada');
  await page.click('.mf-linha-abrir');
  await ate(page, () => /&item=/.test(location.hash) && !!document.getElementById('mfVoltarLista'), null, 'item');
  const item = await hashAgora(page);
  await page.click('#mfVoltarLista');
  await ate(page, () => location.hash === '#arquitetura?tr=1' && !!document.querySelector('.mf-linha-abrir'), null, 'lista');
  await page.goForward();
  await ate(page, (h) => location.hash === h, item, 'Avançar → o item');
  afirma(true, '"Voltar para a lista" volta no histórico: o Avançar devolve o item (sem empilhar a lista)');
  await fim(r, 'N8');
}
async function n9(browser, vp, tag) {
  console.log('\n== N9 (' + tag + '): Mapa → cadastro / ficha da estrutura → Voltar → Mapa ==');
  const r = await abrir(browser, vp, '#arquitetura?mf=mapa&e=neg-1'); const page = r.page;
  await ate(page, () => !!document.getElementById('mfmAbrirCadastro'), null, 'detalhe com "abrir no cadastro"', 15000);
  const origem = await hashAgora(page);
  await page.click('#mfmAbrirCadastro');
  await ate(page, () => /^#arquitetura\?arq=estruturas/.test(location.hash) && !!document.getElementById('estVoltarOrigemNav'), null, 'ficha da estrutura no cadastro');
  afirma(await texto(page, '#estVoltarOrigemNav') === '← Voltar para o Mapa da Floresta', 'ficha da estrutura aberta pelo Mapa: "← Voltar para o Mapa da Floresta"', await texto(page, '#estVoltarOrigemNav'));
  await page.click('#estVoltarOrigemNav');
  await ate(page, (h) => location.hash === h && !!document.getElementById('mfmMapa'), origem, 'de volta ao Mapa');
  afirma(true, 'volta ao Mapa, na mesma estrutura');
  await fim(r, 'N9');
}
async function n10(browser, vp, tag) {
  console.log('\n== N10 (' + tag + '): Mapa → Definição do Mapa (seção do Mapa) → Voltar → Mapa ==');
  const r = await abrir(browser, vp, '#arquitetura?mf=mapa'); const page = r.page;
  await ate(page, () => !!document.getElementById('mfmDefinicao'), null, 'Mapa com o acesso à documentação', 15000);
  await page.click('#mfmDefinicao');
  await ate(page, () => /^#arquitetura\?arq=inicio/.test(location.hash) && !!document.getElementById('avpInicioVoltarOrigem') && !!document.getElementById('avpDocsMapaFloresta'), null, 'seção do Mapa (definição oficial)');
  afirma(await texto(page, '#avpInicioVoltarOrigem') === '← Voltar para o Mapa da Floresta' && await page.evaluate(() => document.getElementById('avpAdminMapa').open), 'definição aberta pelo Mapa: seção do Mapa aberta, "← Voltar para o Mapa da Floresta"', await texto(page, '#avpInicioVoltarOrigem'));
  await page.click('#avpInicioVoltarOrigem');
  await ate(page, () => /^#(?:arquitetura|avaliacoes)\?mf=mapa/.test(location.hash) && !!document.getElementById('mfmMapa'), null, 'de volta ao Mapa');
  afirma(true, 'volta ao Mapa');
  await fim(r, 'N10');
}
async function n11(browser, vp, tag) {
  console.log('\n== N11 (' + tag + '): lista de Posicionamentos → ficha → Voltar → lista ==');
  const r = await abrir(browser, vp, '#arquitetura?po=lista'); const page = r.page;
  await ate(page, () => !!document.querySelector('[data-po-abrir], .po-abrir, #poLista a, #poLista button'), null, 'lista de Posicionamentos');
  const sel = await page.evaluate(() => { const e = document.querySelector('.po-abrir, [data-po-abrir]'); return e ? (e.id ? '#' + e.id : (e.classList.contains('po-abrir') ? '.po-abrir' : '[data-po-abrir]')) : null; });
  if (!sel) { afirma(false, 'achar um item na lista de Posicionamentos'); await r.ctx.close(); return; }
  await page.click(sel);
  await ate(page, () => /po=g/.test(location.hash) && !!document.getElementById('poVoltar'), null, 'ficha aberta pela lista');
  afirma(await texto(page, '#poVoltar') === '← Voltar para os Posicionamentos', 'ficha aberta pela lista: "← Voltar para os Posicionamentos"', await texto(page, '#poVoltar'));
  await page.click('#poVoltar');
  await ate(page, () => location.hash === '#arquitetura?po=lista', null, 'de volta à lista');
  afirma(true, 'volta à lista de Posicionamentos (não ao Início)');
  await fim(r, 'N11');
}

async function n12(browser, vp, tag) {
  console.log('\n== N12 (' + tag + '): Jornada (item) → Squad → Voltar → item ==');
  const r = await abrir(browser, vp, '#arquitetura?tr=1&item=pAssess'); const page = r.page;
  await ate(page, () => !!document.querySelector('.mf-abrir-squad'), null, 'item com o acesso à Squad');
  const origem = await hashAgora(page);
  await page.click('.mf-abrir-squad');
  await ate(page, () => !!document.getElementById('sqVoltarListaChecklist'), null, 'Squad aberta pela Jornada');
  afirma(await texto(page, '#sqVoltarListaChecklist') === '← Voltar para o registro', 'Squad aberta pela Jornada: "← Voltar para a Jornada do Mapa"', await texto(page, '#sqVoltarListaChecklist'));
  await page.click('#sqVoltarListaChecklist');
  await page.click('.sq-modal-confirm-btn');
  await ate(page, (h) => location.hash === h && !!document.querySelector('.mf-abrir-squad'), origem, 'de volta ao item da Jornada');
  afirma(true, 'volta ao item da Jornada (não à lista da Squad)');
  await fim(r, 'N12');
}
async function n13(browser, vp, tag) {
  console.log('\n== N13 (' + tag + '): Gestão da Floresta → Abrir Mapa → Voltar → Gestão (seção do Mapa aberta) ==');
  const r = await abrir(browser, vp, '#arquitetura?arq=inicio'); const page = r.page;
  await ate(page, () => !!document.getElementById('avpAdminAbrirMapa'), null, 'Gestão com a seção do Mapa');
  await page.click('#avpAdminAbrirMapa');
  await ate(page, () => /mf=mapa/.test(location.hash) && !!document.querySelector('#avaliacoesMapa button.avp-voltar-link, #mfVoltar'), null, 'Mapa aberto pela Gestão');
  const volta = page.locator('#avaliacoesMapa button:has-text("Voltar para a Gestão da Floresta")').first();
  afirma(await volta.count() === 1, 'Mapa aberto pela Gestão: "← Voltar para a Gestão da Floresta"');
  await volta.click();
  await ate(page, () => location.hash === '#arquitetura?arq=inicio' && !!document.getElementById('avpAdminMapa') && !document.getElementById('avaliacoesGestao').hidden, null, 'de volta à Gestão');
  afirma(await page.evaluate(() => document.getElementById('avpAdminMapa').open), 'volta à Gestão da Floresta, com a seção do Mapa aberta');
  await fim(r, 'N13');
}

(async () => {
  const browser = await chromium.launch();
  for (const [tag, vp] of [['desktop', DESKTOP], ['375 px', CELULAR]]) {
    console.log('\n######## ' + tag + ' ########');
    for (const n of [n1, n2, n3, n4, n5, n6, n7, n8, n9, n10, n11, n12, n13]) {
      try { await n(browser, vp, tag); } catch (e) { afirma(false, n.name + ' (' + tag + '): ' + String(e.message || e).split('\n')[0]); }
    }
  }
  await browser.close();
  console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
