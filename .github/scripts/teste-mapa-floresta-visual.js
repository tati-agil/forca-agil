/* Mapa da Floresta — versão VISUAL DEMONSTRATIVA, no desenho aprovado (mapa-floresta.js, modo "mapa"; dados de
 * mapa-floresta-demo.js). Desktop e celular 375 px; Firebase falso; hermético. Mínimo, por decisão da responsável:
 *   1. #arquitetura?mf=mapa: faixa "Dados demonstrativos"; blocos de cima para baixo (Estratégia de Clientes, Canais,
 *      Negócios com subagrupadores, Plataformas Habilitadoras com os 3 sub-blocos oficiais, Áreas Especializadas por
 *      último) e a coluna de CoEs à direita no desktop (no celular, CoEs antes das Áreas Especializadas); cores
 *      aprovadas; os 8 códigos firmes cobertos uma vez; cada caixa é uma estrutura concreta.
 *   2. Clicar numa caixa abre o detalhe (&e=<id>) sem esconder o Mapa no desktop: natureza, especialização,
 *      subagrupador, Squads e os produtos/serviços dela — que NÃO são caixas do Mapa; Esc fecha e devolve o foco.
 *   3. "← Voltar ao Mapa", Voltar do navegador e F5 no detalhe; atalhos Mapa ↔ Catálogo.
 *   4. Nada gravado (banco inteiro igual), sem rolagem horizontal, sem erro de JS. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarCondicaoAte, esperarSessaoAssentada } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const ARQ = 'arquitetura@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 }, CELULAR = { width: 375, height: 800 };
const LINHA6 = ['ESTRATEGIA_CLIENTES', 'NEGOCIOS', 'PLATAFORMA_CANAIS', 'PLATAFORMA_HABILITADORA_NEGOCIOS', 'PLATAFORMA_HABILITADORA_TECNOLOGIA', 'PLATAFORMA_CORPORATIVA'];

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

function semente() {
  const aut = {}; aut[chave(ARQ)] = { email: ARQ, tipo: 'avaliacao-arquitetura' };
  const users = {}; users[chave(ARQ)] = { name: 'Pessoa', email: ARQ, area: 'INFOR' };
  const conceitos = {}, fontes = {};
  ['LINHA', 'PLATAFORMA', 'AREA_ESPECIALIZADA', 'COE'].concat(LINHA6).forEach((c, i) => {
    /* M2: Área Especializada sem definição vigente → o detalhe diz "indisponível" */
    conceitos[c] = { nome: 'Tx ' + c, ordem: i + 1, ativo: true, camada: 'A', ...(c === 'AREA_ESPECIALIZADA' ? {} : { definicao: { texto: 'Definição de ' + c, versao: 1, publicadaEm: '2026-10-01T09:00:00.000Z', publicadaPor: 'semente@teste' } }) };
  });
  return { 'fa-users': users, 'fa-admins': {}, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {},
    'fa-avaliacao-autorizados': aut, 'avaliacoes-produto': {}, 'avaliacoes-posicionamento': {}, 'posicionamento-vigente-por-item': {}, 'posicionamento-decisoes': {},
    taxonomia: { organizacional: { conceitos, fontes } } };
}
async function abrir(browser, viewport, hash) {
  const cfg = { db: semente(), user: { email: ARQ, emailVerified: true, uid: 'u-' + chave(ARQ) }, uidDoUsuario: true, prefixoChave: 'k1x', delayDefault: 10, persistenciaReal: true, delays: {}, fail: [] };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
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
const banco = (page) => page.evaluate(() => JSON.stringify(window.__CFG.__dbReal));

async function rodada(browser, viewport, rotulo) {
  console.log('\n[' + rotulo + ']');
  const celular = viewport === CELULAR;
  const { ctx, page, erros } = await abrir(browser, viewport, '#arquitetura?mf=mapa');
  await page.waitForSelector('#mfmMapa');
  await esperarCondicao(page, () => /Tx PLATAFORMA_CORPORATIVA/.test((document.querySelector('.mfm-sub[data-codigo="PLATAFORMA_CORPORATIVA"] h4') || {}).textContent || ''), null, { limite: 10000, descricao: 'nomes da Taxonomia' });
  const antes = await banco(page);
  afirma(/Dados demonstrativos/.test(await page.locator('#mfmFaixa').innerText()) && /Nada é gravado/.test(await page.locator('#mfmFaixa').innerText()), 'faixa "Dados demonstrativos … Nada é gravado"');
  afirma(/Mapa da Floresta/.test(await page.locator('#page-avaliacoes .page-hero h1').innerText()), 'título da página: Mapa da Floresta');
  /* posições: desktop = 5 blocos empilhados na coluna principal + CoEs à direita; celular = uma coluna, CoEs antes das AE */
  const blocos = await page.$$eval('#mfmMapa .mfm-bloco', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { id: e.getAttribute('data-bloco'), x: r.left, y: r.top, w: r.width, cor: (getComputedStyle(e.classList.contains('mfm-bloco--coe') ? e.querySelector('.mfm-bloco-topo') : e).backgroundImage.match(/rgba?\([^)]*\)/) || [''])[0] /* a cor exata no início do gradiente (nos CoEs, no cabeçalho dourado da coluna clara) */ }; }));
  const por = Object.fromEntries(blocos.map((b) => [b.id, b]));
  const pilha = ['estrategia', 'canais', 'negocios', 'plataformas', 'ae'];
  const empilhados = pilha.every((id, i) => i === 0 || por[id].y > por[pilha[i - 1]].y);
  if (celular) afirma(empilhados && por.coe.y > por.plataformas.y && por.coe.y < por.ae.y && blocos.every((b) => Math.abs(b.x - por.estrategia.x) < 2),
    'celular: uma coluna, na ordem Estratégia, Canais, Negócios, Plataformas, CoEs e Áreas Especializadas por último', JSON.stringify(blocos.map((b) => b.id)));
  else afirma(empilhados && pilha.every((id) => Math.abs(por[id].x - por.estrategia.x) < 2) && por.coe.x > por.estrategia.x + por.estrategia.w - 2 && Math.abs(por.coe.y - por.estrategia.y) < 2,
    'desktop: Estratégia, Canais, Negócios, Plataformas e Áreas Especializadas de cima para baixo; CoEs numa coluna à direita', JSON.stringify(blocos));
  const CORES = { estrategia: 'rgb(22, 78, 170)', canais: 'rgb(48, 124, 237)', negocios: 'rgb(116, 53, 187)', plataformas: 'rgb(6, 175, 167)', coe: 'rgb(217, 154, 18)', ae: 'rgb(242, 81, 96)' };
  afirma(Object.keys(CORES).every((id) => por[id] && por[id].cor === CORES[id]), 'cores aprovadas em cada bloco', JSON.stringify(blocos.map((b) => b.id + ' ' + b.cor)));
  /* subagrupadores de Negócios e sub-blocos oficiais de Plataformas */
  const subs = await page.$$eval('.mfm-bloco--negocios .mfm-sub', (els) => els.map((e) => e.querySelector('h4').textContent + ':' + e.querySelectorAll('.mfm-caixa').length));
  afirma(JSON.stringify(subs) === '["Previdência:3","Proteção:1","Crédito:2"]', 'Linhas de Negócios com subagrupadores (Previdência, Proteção, Crédito) e as Linhas associadas', JSON.stringify(subs));
  const plat = await page.$$eval('.mfm-bloco--plataformas .mfm-sub', (els) => els.map((e) => e.getAttribute('data-codigo')));
  afirma(JSON.stringify(plat) === '["PLATAFORMA_HABILITADORA_NEGOCIOS","PLATAFORMA_HABILITADORA_TECNOLOGIA","PLATAFORMA_CORPORATIVA"]', 'Plataformas Habilitadoras com os 3 sub-blocos dos códigos oficiais');
  /* caixas = estruturas concretas; os 8 códigos firmes cobertos; produtos fora do Mapa */
  const tipos = await page.$$eval('.mfm-caixa', (els) => els.map((e) => window.faMapaFlorestaDemo.estado.estruturas[e.getAttribute('data-estrutura')].tipo));
  const firmes = await page.evaluate(() => window.faMotorPosicionamentoNucleo.CODIGOS_FIRMES.slice().sort());
  afirma(tipos.length === 26 && JSON.stringify(Array.from(new Set(tipos)).sort()) === JSON.stringify(firmes) && await page.locator('#mfmMapa .mfm-objeto').count() === 0,
    'cada caixa é uma estrutura concreta (26), os 8 códigos firmes cobertos; nenhum produto/serviço como caixa');
  afirma(await page.locator('.mfm-bloco--coe .mfm-caixa').count() === 3 && await page.locator('.mfm-bloco--ae .mfm-caixa').count() === 3, 'cada CoE e cada Área Especializada na sua própria caixa');
  /* detalhe */
  await page.click('.mfm-caixa[data-estrutura="demo-neg-1"]');
  await page.waitForSelector('#mfmDetalhe');
  afirma(/[?&]mf=mapa&e=demo-neg-1/.test(await page.evaluate(() => location.hash)), 'clicar na caixa abre o detalhe com endereço próprio');
  const det = await page.locator('#mfmDetalhe').innerText();
  afirma(/Negócios — Exemplo 1/.test(det) && /Exemplo fictício/.test(det) && /Natureza\s*Linha/.test(det) && /Tx NEGOCIOS/.test(det) && /Previdência/.test(det) && /Organização por Squads\s*Admitida para este tipo de estrutura/.test(det) && /Squads vinculados\s*Nenhum nos exemplos fictícios/.test(det),
    'detalhe: nome, "Exemplo fictício", natureza, especialização (Taxonomia), subagrupador e Squads', det.slice(0, 300));
  const defPronta = () => esperarCondicaoAte(page, () => { const d = document.querySelector('#mfmDetalhe [data-fa-def-estado]'); return !!d && d.getAttribute('data-fa-def-estado') !== 'carregando'; }, undefined, { limite: 8000 });
  await defPronta();
  const detDef = await page.locator('#mfmDetalhe').innerText();
  afirma(/Definição oficial\s*Definição de NEGOCIOS/.test(detDef), 'detalhe: definição oficial vigente do tipo, da Taxonomia (M2)', detDef.slice(0, 300));
  afirma(JSON.stringify(await page.$$eval('#mfmObjetos .mfm-objeto', (els) => els.map((e) => e.getAttribute('data-objeto')))) === '["demo-obj-4","demo-obj-5"]', 'detalhe lista os produtos/serviços sob a estrutura');
  afirma(await page.evaluate(() => (document.activeElement || {}).id) === 'mfmDetalheTitulo', 'o foco vai para o título do detalhe (teclado e leitor de tela)');
  const larg = await page.evaluate(() => document.getElementById('mfmDetalhe').getBoundingClientRect().width);
  if (celular) afirma(Math.abs(larg - 375) < 2, 'celular: o detalhe ocupa a tela inteira', String(larg));
  else afirma(larg <= 441 && await page.locator('.mfm-caixa[data-estrutura="demo-ec-1"]').isVisible(), 'desktop: o detalhe abre ao lado, sem esconder o Mapa', String(larg));
  if (!celular) {
    await page.click('.mfm-caixa[data-estrutura="demo-ae-2"]');
    await page.waitForSelector('#mfmSemObjetos');
    const d2 = await page.locator('#mfmDetalhe').innerText();
    afirma(/Nenhum produto ou serviço de exemplo/.test(d2) && /Área Especializada/.test(d2) && /Áreas Especializadas e Centros de Excelência não formam Squads/.test(d2), 'Área Especializada sem produtos: diz que não há; não forma Squads');
    await defPronta();
    const d2Def = await page.locator('#mfmDetalhe').innerText();
    afirma(/Definição oficial\s*Definição vigente indisponível/.test(d2Def) && !/Definição de AREA_ESPECIALIZADA/.test(d2Def), 'tipo sem definição vigente: "indisponível", sem texto substituto (M2)');
  }
  await page.keyboard.press('Escape');
  await esperarCondicao(page, () => !document.getElementById('mfmDetalhe'), null, { limite: 5000, descricao: 'Esc fecha o detalhe' });
  afirma(/^mfmNo-/.test(await page.evaluate(() => (document.activeElement || {}).id || '')), 'Esc fecha o detalhe e o foco volta à caixa');
  await page.click('.mfm-caixa[data-estrutura="demo-can-1"]');
  await page.waitForSelector('#mfmDetalhe');
  await page.click('#mfmFechar');
  await esperarCondicao(page, () => !document.getElementById('mfmDetalhe'), null, { limite: 5000, descricao: 'detalhe fechado' });
  afirma(await page.evaluate(() => location.hash) === '#arquitetura?mf=mapa' && await page.locator('#mfmMapa').isVisible(), '"← Voltar ao Mapa" volta à visão geral');
  /* Voltar do navegador e F5 */
  await page.click('.mfm-caixa[data-estrutura="demo-coe-1"]');
  await page.waitForSelector('#mfmDetalhe');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mfmDetalhe');
  afirma(/CoE — Exemplo 1/.test(await page.locator('#mfmDetalhe').innerText()), 'F5 no detalhe reabre a mesma estrutura');
  await page.goBack();
  await esperarCondicao(page, () => !document.getElementById('mfmDetalhe') && !!document.getElementById('mfmMapa'), null, { limite: 8000, descricao: 'Voltar do navegador' });
  afirma(await page.locator('#mfmMapa').isVisible(), 'Voltar do navegador sai do detalhe para o mapa');
  /* atalhos Mapa ↔ Catálogo */
  await page.click('#mfmIrCatalogo');
  await page.waitForSelector('#mfCatalogo');
  afirma(await page.evaluate(() => location.hash) === '#arquitetura?mf=catalogo', 'atalho para o Catálogo');
  await page.click('#mfIrMapa');
  await page.waitForSelector('#mfmMapa');
  afirma(await page.evaluate(() => location.hash) === '#arquitetura?mf=mapa', 'atalho do Catálogo para o Mapa');
  /* quantidade variável: configuração populosa (0, 1, 3 e 10+ por grupo, nomes longos, subagrupador vazio e um a mais) */
  await page.click('.mfm-cenario[data-cenario="populoso"]');
  await esperarCondicao(page, () => /[?&]cenario=populoso/.test(location.hash) && document.querySelectorAll('.mfm-caixa').length > 40, null, { limite: 8000, descricao: 'configuração populosa' });
  const pop = await page.evaluate(() => {
    const D = window.faMapaFlorestaDemo.cenario('populoso'), esperado = Object.keys(D.estado.estruturas);
    const caixas = Array.from(document.querySelectorAll('.mfm-caixa')), vistas = caixas.map((e) => e.getAttribute('data-estrutura'));
    const ordem = Array.from(document.querySelectorAll('.mfm-caixas')).every((ul) => { const p = Array.from(ul.querySelectorAll('.mfm-caixa')).map((e) => esperado.indexOf(e.getAttribute('data-estrutura'))); return p.every((x, i) => i === 0 || x > p[i - 1]); });
    const cortadas = caixas.filter((e) => { const n = e.querySelector('.mfm-caixa-nome'), r = e.getBoundingClientRect(); return e.scrollWidth > e.clientWidth + 1 || n.scrollWidth > n.clientWidth + 1 || r.right > innerWidth + 1; }).length;
    const sobrepostas = caixas.some((a, i) => caixas.slice(i + 1).some((b) => { const x = a.getBoundingClientRect(), y = b.getBoundingClientRect(); return x.left < y.right - 1 && y.left < x.right - 1 && x.top < y.bottom - 1 && y.top < x.bottom - 1; }));
    return { todas: esperado.length === vistas.length && esperado.every((id) => vistas.indexOf(id) !== -1), ordem, cortadas, sobrepostas,
      vazios: Array.from(document.querySelectorAll('.mfm-sub .mfm-vazio')).map((v) => v.closest('.mfm-sub').getAttribute('data-subagrupador') || v.closest('.mfm-sub').getAttribute('data-codigo')),
      subs: Array.from(document.querySelectorAll('.mfm-bloco--negocios .mfm-sub')).length, semRolagem: document.documentElement.scrollWidth <= innerWidth + 1 };
  });
  afirma(pop.todas && pop.ordem, 'configuração populosa: todas as estruturas aparecem, na ordem cadastrada');
  afirma(pop.cortadas === 0 && !pop.sobrepostas && pop.semRolagem, 'configuração populosa: nenhum nome cortado, nenhuma caixa sobreposta, sem rolagem horizontal', JSON.stringify(pop));
  afirma(JSON.stringify(pop.vazios) === '["demo-sub-prot","PLATAFORMA_CORPORATIVA"]' && pop.subs === 4, 'grupos vazios dizem que estão vazios; um subagrupador a mais aparece sem mudar a tela', JSON.stringify(pop));
  await page.click('.mfm-cenario[data-cenario="habitual"]');
  await esperarCondicao(page, () => location.hash === '#arquitetura?mf=mapa' && document.querySelectorAll('.mfm-caixa').length === 26, null, { limite: 8000, descricao: 'volta à configuração habitual' });
  afirma(await banco(page) === antes, 'nada gravado: o banco inteiro é o mesmo');
  afirma(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'sem rolagem horizontal');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try { await rodada(browser, DESKTOP, 'desktop'); await rodada(browser, CELULAR, 'celular 375'); }
  catch (e) { console.log('ERRO', e && e.stack || e); falhas++; }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
