/* JORNADA INTEGRADA: MAPA DA FLORESTA COMO DESTINO, PARTES CONECTADAS E RETORNOS CONFERIDOS. Firebase falso em persistência
 * real; hermético; conteúdo fictício (semente-taxonomia-ficha.js). Desktop e 375 px.
 *   A2. "Como cada parte contribui para o Mapa": as sete partes, em lista (não sequência), cada uma levando à funcionalidade
 *      existente conforme o perfil. Cenário 1: Abrir Mapa → "← Voltar para Avaliações e Mapa" → a mesma área do ADMIN.
 *      Cenário 2/7: a definição oficial na própria seção do Mapa (sem segundo "Abrir"); o valor
 *      inicial continua avisado como "ainda não salvo" e nada é gravado. Do Mapa, "Definição e documentação do Mapa" só para
 *      quem entra na área (cenário 6).
 *   C2. Voltar da Taxonomia com edição aberta pede confirmação; o retorno é conferido — se o histórico não levar à origem,
 *      vai direto ao endereço guardado.
 *
 *   A. ADMIN › Avaliações e Mapa: o destaque "Mapa da Floresta" vem ANTES dos grupos de configuração, com a descrição
 *      combinada, a origem/situação dos dados (demonstrativo sem cadastro; registros com cadastro; nunca exemplo fictício
 *      como relação real), "Abrir Mapa da Floresta" (#avaliacoes?mf=mapa, o Mapa existente), "Consultar definição do Mapa"
 *      (#admin?arq=documentacao, o cartão MAPA_FLORESTA existente) e "Consultar jornada até o Mapa" (#avaliacoes?mf=catalogo);
 *      a explicação diz que não há sequência obrigatória e que a Adequação à Squad é opcional.
 *   B. Área Avaliação (perfil "avaliacao", sem ADMIN): o Mapa e a jornada estão no Início, identificáveis, e abrem.
 *   C. Taxonomia aberta por "Abrir a aba Taxonomia": "← Voltar para Avaliações e Mapa" no Catálogo, na Administração e nas
 *      Verificações; voltar devolve à área de origem; Avançar e F5 mantêm a origem; o que estava sendo editado continua
 *      lá; entrar pela própria aba (ou trocar de aba à mão) não inventa origem.
 *   D. Perfil restrito (Avaliação + Configuração): vê o destaque do Mapa, não vê o atalho para a Taxonomia. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');
const T = require('./taxonomia-tela');
const S = require('./semente-taxonomia-ficha');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };
const DESCRICAO_ADMIN = 'O Mapa da Floresta reúne a visão das estruturas organizacionais e de suas responsabilidades.';
const DESCRICAO = 'Visualize as estruturas organizacionais e os produtos, serviços e responsabilidades associados a elas, conforme os registros disponíveis.';
let falhas = 0;
function afirma(c, msg, det) { console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); if (!c) falhas++; }

function banco(o) {
  o = o || {};
  const email = o.email || S.EMAIL, k = chave(email);
  const db = Object.assign({
    'fa-users': { [k]: { name: 'PESSOA', email, area: 'INFOR' } }, 'fa-admins': o.admin === false ? {} : { [chave(S.EMAIL)]: { email: S.EMAIL, name: 'ADMIN' } },
    'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {},
    'avaliacoes-produto': {}, 'avaliacoes-squad': {}, 'avaliacoes-posicionamento': {}, 'posicionamento-vigente-por-item': {}, 'posicionamento-decisoes': {},
    'fa-avaliacao-autorizados': o.tipo ? { [k]: { email, tipo: o.tipo } } : {}
  }, S.semente({}));
  if (o.cadastro) db['estruturas-concretas-config'] = { gravacaoHabilitada: true };
  return { db, email };
}
async function abrir(browser, viewport, o) {
  o = o || {};
  const { db, email } = banco(o);
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify({ db, user: { email, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#' + (o.hash || 'admin'), { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const abaAtiva = (page) => page.evaluate(() => (document.querySelector('.admin-tab-btn.active') || {}).dataset ? document.querySelector('.admin-tab-btn.active').dataset.panel : null);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
async function irAvaliacoesEMapa(page) {
  await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelArquitetura"]', { state: 'visible', timeout: 15000 });
  await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
  await page.waitForSelector('#avpAdminMapa', { timeout: 10000 });
}
async function situacao(page, id) {
  await esperarCondicao(page, (i) => { const e = document.getElementById(i); return !!e && e.getAttribute('data-situacao') !== 'conferindo'; }, id, { descricao: 'situação dos dados do Mapa conferida' });
  return page.getAttribute('#' + id, 'data-situacao');
}

async function cenarioA(browser, vp, nome) {
  console.log('\n== A. ' + nome + ': ADMIN › Avaliações e Mapa — o Mapa como destino ==');
  const { ctx, page, erros } = await abrir(browser, vp);
  await irAvaliacoesEMapa(page);
  const ordem = await page.evaluate(() => { const secs = [...document.querySelectorAll('#adminAvaliacaoProduto details[data-secao-admin].avp-admin-secao')]; return secs.length > 1 && secs[0].id === 'avpAdminMapa'; });
  afirma(!!ordem, 'a seção "Mapa da Floresta" é a primeira, antes das seções de configuração');
  afirma((await page.innerText('#avpAdminMapaTitulo')).trim() === 'Mapa da Floresta' && (await page.innerText('#avpAdminMapa > summary .avp-admin-secao-desc')).trim() === DESCRICAO_ADMIN, 'título "Mapa da Floresta" e a descrição curta, visível mesmo recolhida');
  afirma(await situacao(page, 'avpAdminMapaSituacao') === 'demonstrativo' && /modo demonstrativo, com exemplos fictícios que não representam relações reais/.test(await page.innerText('#avpAdminMapaSituacao')), 'sem cadastro de estruturas: diz que o Mapa é demonstrativo e que os exemplos não são relações reais');
  afirma(await page.getAttribute('#avpAdminAbrirMapa', 'href') === '#avaliacoes?mf=mapa' && (await page.innerText('#avpAdminAbrirMapa')).trim().toLowerCase() === 'abrir mapa da floresta' && await page.locator('#avpAdminMapa .btn--primary').count() === 1, 'ação principal "Abrir Mapa da Floresta" → #avaliacoes?mf=mapa (a única ação amarela da seção)');
  afirma(await page.getAttribute('#avpAdminJornadaMapa', 'href') === '#avaliacoes?mf=catalogo' && (await page.innerText('#avpAdminJornadaMapa')).trim().toLowerCase() === 'consultar jornada até o mapa', '"Consultar jornada até o Mapa" → #avaliacoes?mf=catalogo (link secundário)');
  afirma(await page.locator('#avpAdminDocsMapa').count() === 0, 'sem documentos de referência: nenhum link "Documentação relacionada"');
  afirma(await page.locator('#avpParteMapa').count() === 0 && await page.locator('#adminAvaliacaoProduto a[href="#avaliacoes?mf=mapa"]').count() === 1, 'nenhum segundo "Abrir o Mapa" na mesma tela');
  afirma(await page.locator('#avpAdminPartes, .avp-parte, [id^="avpParte"]').count() === 0, 'sem a lista "Como cada parte contribui para o Mapa" (a explicação é da Jornada até o Mapa)');
  afirma(await page.locator('#avpAdminMapa ~ .avp-admin-grupo').count() >= 3 && await page.locator('#avpQuestP1P16Btn, #avpConfigMotoresBtn, #avpConfigNaturezasBtn, #avpDocumentacaoBtn, #avpUsuariosBtn').count() === 5 && await page.locator('#avpGrupoReferencias').count() === 0, 'as seções de configuração continuam depois do Mapa, com todos os acessos');
  /* cenário 1: Abrir Mapa → Voltar para Avaliações e Mapa */
  const hashAdmin = await page.evaluate(() => location.hash);
  await page.click('#avpAdminAbrirMapa');
  await esperarCondicao(page, () => /^#avaliacoes\?mf=mapa/.test(location.hash) && !!document.getElementById('mfVoltar'), null, { limite: 12000, descricao: 'Mapa aberto pelo ADMIN' });
  afirma((await page.innerText('#mfVoltar')).trim() === '← Voltar para Avaliações e Mapa', 'no Mapa aberto pelo ADMIN: "← Voltar para Avaliações e Mapa"');
  afirma(await page.locator('#mfmDefinicao').count() === 1 && await page.getAttribute('#mfmDefinicao', 'href') === '#admin?arq=inicio', 'do Mapa: "Definição oficial do Mapa" leva à seção do Mapa no ADMIN (a mesma definição)');
  await page.click('#mfVoltar');
  await esperarCondicao(page, (h) => location.hash === h && (document.querySelector('.admin-tab-btn.active') || {}).dataset.panel === 'adminPanelArquitetura' && !!document.getElementById('avpAdminMapa'), hashAdmin, { descricao: 'de volta a Avaliações e Mapa' });
  afirma(true, 'Voltar devolve a ADMIN › Avaliações e Mapa (' + hashAdmin + ')');
  afirma(await larguraOk(page), 'sem rolagem horizontal');
  /* definição oficial existente — na própria seção do Mapa, com edição e histórico */
  await esperarCondicao(page, () => !!document.querySelector('#avpAdminMapa #avpDocsMapaFlorestaTitulo'), null, { descricao: 'definição do Mapa na seção' });
  const escritasAntes = await page.evaluate(() => (window.__ESCRITAS || []).length);
  afirma(await page.locator('#avpMapaFabrica').count() === 1 && /Valor inicial — ainda não salvo no banco/.test(await page.innerText('#avpMapaFabrica')), 'sem definição gravada: o valor inicial continua avisado como "ainda não salvo no banco"');
  afirma(await page.locator('#avpAdminMapa #avpMapaEditarBtn').count() === 1 && await page.locator('#avpAdminMapa #avpMapaHistorico').count() === 1 && await page.locator('#avpMapaAbrirMapa').count() === 0,
    'na mesma seção: "Editar definição" e o histórico; sem um segundo "Abrir Mapa"');
  afirma(await page.evaluate(() => (window.__ESCRITAS || []).length) === escritasAntes && !(await page.evaluate(() => window.__CFG.__dbReal['arquitetura-definicoes'])), 'consultar não grava nada (a definição continua não registrada)');
  /* o Mapa existente */
  await page.click('#avpAdminAbrirMapa');
  await esperarCondicao(page, () => /^#avaliacoes\?mf=mapa/.test(location.hash) && !!document.getElementById('mfmMapa'), null, { limite: 12000, descricao: 'Mapa da Floresta aberto' });
  afirma(true, '"Abrir Mapa da Floresta" abre o Mapa existente (#avaliacoes?mf=mapa)');
  await page.goBack();
  await page.waitForSelector('#avpAdminMapa', { timeout: 8000 });
  await page.click('#avpAdminJornadaMapa');
  await esperarCondicao(page, () => /^#avaliacoes\?mf=catalogo/.test(location.hash) && !!document.getElementById('mfCatalogo'), null, { limite: 12000, descricao: 'jornada até o Mapa' });
  afirma(true, '"Consultar jornada até o Mapa" abre a jornada preparatória');
  afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
  await ctx.close();
  /* com o cadastro de estruturas: a origem são os registros */
  const c = await abrir(browser, vp, { cadastro: true });
  await irAvaliacoesEMapa(c.page);
  afirma(await situacao(c.page, 'avpAdminMapaSituacao') === 'cadastro' && /estruturas cadastradas no ADMIN e vínculos registrados nas fichas do Posicionamento/.test(await c.page.innerText('#avpAdminMapaSituacao')) && !/demonstrativo/.test(await c.page.innerText('#avpAdminMapaSituacao')), 'com cadastro: a origem são as estruturas cadastradas e os vínculos registrados');
  await c.ctx.close();
}

async function cenarioB(browser, vp, nome) {
  /* cenário 6: quem tem só a Avaliação consulta o Mapa, sem o acesso à área administrativa */
  console.log('\n== B. ' + nome + ': área Avaliação (sem ADMIN) — o Mapa no Início ==');
  const { ctx, page, erros } = await abrir(browser, vp, { email: 'avaliadora@previ.com.br', admin: false, tipo: 'avaliacao', hash: 'avaliacoes' });
  await page.waitForSelector('#avpInicioMapaSec', { timeout: 15000 });
  afirma((await page.innerText('#avpInicioMapaTitulo')).trim() === 'Mapa da Floresta' && (await page.innerText('#avpInicioMapaSec .avp-mapa-desc')).trim() === DESCRICAO, 'o Início mostra o bloco "Mapa da Floresta", com a descrição');
  afirma(await page.getAttribute('#avpInicioMapa', 'href') === '#avaliacoes?mf=mapa' && await page.getAttribute('#avpInicioJornada', 'href') === '#avaliacoes?mf=catalogo' && (await page.innerText('#avpInicioJornada')).trim() === 'Consultar jornada até o Mapa', '"Abrir Mapa da Floresta" e "Consultar jornada até o Mapa"');
  afirma(await page.evaluate(() => { const r = document.getElementById('avpInicioMapaSec').getBoundingClientRect(); return r.top < window.innerHeight * 2.2; }), 'o bloco está no começo do Início (sem rolar muito)');
  await page.click('#avpInicioMapa');
  await esperarCondicao(page, () => /^#avaliacoes\?mf=mapa/.test(location.hash) && !!document.getElementById('mfmMapa'), null, { limite: 12000, descricao: 'Mapa aberto pelo Início' });
  afirma(true, 'quem tem só a Avaliação abre o Mapa pelo Início');
  afirma(await page.locator('#mfmDefinicao').count() === 0 && (await page.innerText('#mfVoltar')).trim() === '← Voltar para Avaliações', 'sem acesso à área administrativa: o Mapa não oferece a documentação do ADMIN; o Voltar é o da Avaliação');
  afirma(await larguraOk(page), 'sem rolagem horizontal');
  afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
  await ctx.close();
}

async function cenarioC(browser, vp, nome) {
  console.log('\n== C. ' + nome + ': Taxonomia com retorno para Avaliações e Mapa ==');
  const { ctx, page, erros } = await abrir(browser, vp);
  await irAvaliacoesEMapa(page);
  const hashOrigem = await page.evaluate(() => location.hash);
  await page.click('#admArqIrTaxonomia');
  await page.waitForSelector('#taxVoltarOrigem', { timeout: 10000 });
  afirma(await abaAtiva(page) === 'adminPanelTaxonomia' && (await page.innerText('#taxVoltarOrigem')).trim() === '← Voltar para Avaliações e Mapa', 'Catálogo: "← Voltar para Avaliações e Mapa"');
  await T.abrirAdmin(page, 'ESTRATEGIA_CLIENTES');
  afirma(await page.locator('#taxVoltarOrigem').isVisible(), 'Administração: o retorno continua à vista');
  await T.irIntegridade(page);
  afirma(await page.locator('#taxVoltarOrigem').isVisible() && /Verificações do sistema/.test(await page.innerText('#taxLocal')), 'Verificações do sistema: o retorno continua à vista');
  /* edição em andamento: voltar não descarta */
  await T.voltarCatalogo(page);
  await T.abrirAdmin(page, 'ESTRATEGIA_CLIENTES');
  await page.click('#taxEditarInfoBtn');
  await page.fill('#taxF_observacoes', 'Rascunho fictício não salvo.');
  await page.click('#taxVoltarOrigem');
  await page.waitForSelector('#taxConfirmaVolta', { timeout: 4000 });
  afirma(/edição não salva/.test(await page.innerText('#taxConfirmaVolta')) && await abaAtiva(page) === 'adminPanelTaxonomia', 'com edição aberta, voltar pede confirmação (e não sai)');
  await page.click('#taxConfirmaVoltaNao');
  afirma(await page.locator('#taxConfirmaVolta').count() === 0 && await page.inputValue('#taxF_observacoes') === 'Rascunho fictício não salvo.', '"Continuar editando": fica na Taxonomia, com o texto');
  await page.click('#taxVoltarOrigem');
  await page.click('#taxConfirmaVoltaSim');
  await esperarCondicao(page, (h) => location.hash === h && (document.querySelector('.admin-tab-btn.active') || {}).dataset.panel === 'adminPanelArquitetura', hashOrigem, { descricao: 'de volta a Avaliações e Mapa' });
  afirma(await page.locator('#avpAdminMapa').isVisible(), 'voltar devolve à área de origem (Avaliações e Mapa, ' + hashOrigem + '), não ao Catálogo');
  await page.goForward();
  await esperarCondicao(page, () => (document.querySelector('.admin-tab-btn.active') || {}).dataset.panel === 'adminPanelTaxonomia' && !!document.getElementById('taxVoltarOrigem'), null, { descricao: 'Avançar: de novo na Taxonomia' });
  afirma(await page.locator('#taxF_observacoes').count() === 1 && await page.inputValue('#taxF_observacoes') === 'Rascunho fictício não salvo.', 'Avançar: a Taxonomia volta como estava, com o texto não salvo no formulário');
  /* F5 na entrada da Taxonomia: a origem continua */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  await esperarCondicao(page, () => (document.querySelector('.admin-tab-btn.active') || {}).dataset.panel === 'adminPanelTaxonomia' && !!document.getElementById('taxVoltarOrigem'), null, { limite: 15000, descricao: 'F5: Taxonomia com retorno' });
  afirma(true, 'F5: a Taxonomia reabre com "← Voltar para Avaliações e Mapa"');
  await page.click('#taxVoltarOrigem');
  await esperarCondicao(page, () => (document.querySelector('.admin-tab-btn.active') || {}).dataset.panel === 'adminPanelArquitetura' && !!document.getElementById('avpAdminMapa'), null, { descricao: 'depois do F5, voltar a Avaliações e Mapa' });
  afirma(true, 'depois do F5, o retorno ainda leva a Avaliações e Mapa');
  /* trocar de aba à mão apaga a origem da entrada */
  await page.goForward();
  await page.waitForSelector('#taxVoltarOrigem', { timeout: 8000 });
  await page.click('.admin-tab-btn[data-panel="adminPanelPedidos"]');
  await page.click('.admin-tab-btn[data-panel="adminPanelTaxonomia"]');
  await page.waitForSelector('.tax-topo', { timeout: 8000 });
  afirma(await page.locator('#taxVoltarOrigem').count() === 0, 'trocar de aba à mão e voltar pela aba Taxonomia: sem origem inventada');
  afirma(await larguraOk(page), 'sem rolagem horizontal');
  afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
  await ctx.close();
  /* retorno conferido: o histórico não leva à origem (entrada anterior é outra) → vai direto ao endereço guardado */
  const f = await abrir(browser, vp, { hash: 'avaliacoes' });
  await f.page.waitForSelector('#avpInicio', { timeout: 15000 });
  await f.page.evaluate(() => { location.hash = '#admin'; });
  await f.page.waitForSelector('.admin-tab-btn[data-panel="adminPanelTaxonomia"]', { state: 'visible', timeout: 15000 });
  await f.page.evaluate(() => { history.replaceState({ faAbaAtual: 'adminPanelTaxonomia', faTaxOrigem: { aba: 'adminPanelArquitetura', rotulo: 'Avaliações e Mapa', hash: '#admin?arq=inicio' } }, '', '#admin'); window.faAdminAbrirAba('adminPanelTaxonomia'); });
  await f.page.waitForSelector('#taxVoltarOrigem', { timeout: 8000 });
  await f.page.click('#taxVoltarOrigem');
  await esperarCondicao(f.page, () => location.hash === '#admin?arq=inicio' && (document.querySelector('.admin-tab-btn.active') || {}).dataset.panel === 'adminPanelArquitetura', null, { descricao: 'retorno conferido' });
  afirma(true, 'histórico diferente do esperado (entrada anterior era a Avaliação): o retorno vai direto a Avaliações e Mapa, nunca para outro lugar');
  await f.ctx.close();
  /* entrada direta pela aba Taxonomia */
  const d = await abrir(browser, vp);
  await d.page.waitForSelector('.admin-tab-btn[data-panel="adminPanelTaxonomia"]', { state: 'visible', timeout: 15000 });
  await d.page.click('.admin-tab-btn[data-panel="adminPanelTaxonomia"]');
  await d.page.waitForSelector('.tax-item', { timeout: 10000 });
  afirma(await d.page.locator('#taxVoltarOrigem').count() === 0, 'entrada direta pela aba Taxonomia: nenhuma origem, navegação normal entre abas');
  await d.ctx.close();
}

async function cenarioD(browser, vp, nome) {
  console.log('\n== D. ' + nome + ': perfil restrito (Avaliação + Configuração) ==');
  const { ctx, page, erros } = await abrir(browser, vp, { email: 'arquiteta@previ.com.br', admin: false, tipo: 'avaliacao-arquitetura' });
  await page.waitForSelector('#avpAdminMapa', { timeout: 15000 });
  afirma(await page.locator('#avpAdminMapa').isVisible() && await page.locator('#admArqIrTaxonomia').isHidden(), 'vê o destaque do Mapa; o atalho para a Taxonomia (aba de admin geral) não aparece');
  afirma(await page.locator('.admin-tab-btn[data-panel="adminPanelTaxonomia"]').isHidden(), 'a aba Taxonomia continua fora do alcance (permissões preservadas)');
  afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  for (const [nome, vp] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nome + ' ########');
    await cenarioA(browser, vp, nome);
    await cenarioB(browser, vp, nome);
    await cenarioC(browser, vp, nome);
    await cenarioD(browser, vp, nome);
  }
  await browser.close();
  console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
