/* TAXONOMIA — Integridade e configurações: domínio dos comandos de vínculo, indicador do topo, releitura depois de
 * salvar e contraste do tema escuro. Firebase falso em persistência real; hermético; conteúdo 100% fictício
 * (semente-taxonomia-ficha.js). Desktop e 375 px.
 *
 *   A. Comandos de vínculo atuam SÓ no domínio do bloco acionado (Integridade mostra os dois juntos):
 *      A1. a partir do Catálogo ORGANIZACIONAL, prévia/cancelar/confirmar no bloco da AVALIAÇÃO → grava só
 *          avaliacao-classificacoes (+ auditoria ligacao_registrada) e nada do Posicionamento;
 *      A2. a partir do Catálogo ARQUITETURAL, o mesmo no bloco do POSICIONAMENTO → grava só
 *          posicionamento-classificacoes (+ auditoria) e nada da Avaliação.
 *   B. O atalho do topo usa a MESMA avaliação dos blocos e nunca fica verde durante leitura, erro de leitura, conceito
 *      ausente ou inativo, ou vínculo sem código no motor; o estado do atalho é sempre o "pior" dos dois blocos.
 *   C. Depois de salvar, a releitura do domínio mantém a Administração no lugar ("Carregando o conceito…"), nunca o
 *      Catálogo com o título "Administração".
 *   D. Tema escuro: texto e links com contraste WCAG AA (≥ 4,5:1) e borda dos controles ≥ 3:1 nas superfícies reais;
 *      foco de teclado visível. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');
const T = require('./taxonomia-tela');
const S = require('./semente-taxonomia-ficha');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const K = 'adm_previ_com_br';
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };
let falhas = 0;
function afirma(c, msg, det) { console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); if (!c) falhas++; }

function banco(ajuste) {
  const db = Object.assign({ 'fa-users': { [K]: { name: 'ADMIN', email: S.EMAIL, area: 'INFOR' } }, 'fa-admins': { [K]: { email: S.EMAIL, name: 'ADMIN' } }, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {} }, S.semente({ integracao: 'completa' }));
  if (ajuste) ajuste(db);
  return db;
}
async function abrir(browser, viewport, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(o.ajuste), user: { email: S.EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true, delays: o.delays, fail: o.fail }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelTaxonomia"]', { state: 'visible', timeout: 12000 });
  await page.click('.admin-tab-btn[data-panel="adminPanelTaxonomia"]');
  await page.waitForSelector('.tax-item', { timeout: 10000 });
  return { ctx, page, erros };
}
const db = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const escritasEm = (page, prefixo) => page.evaluate((p) => (window.__ESCRITAS || []).filter((e) => String(e.path || '').indexOf(p) === 0).length, prefixo);
const atalho = (page) => page.evaluate(() => { const b = document.getElementById('taxIntegridadeLink'); return b ? b.getAttribute('data-estado') : null; });
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const estadoBloco = (page, id) => page.evaluate((i) => { const e = document.getElementById(i); return e ? e.getAttribute('data-estado') : null; }, id);

async function cenarioA(browser, viewport, nome) {
  console.log('\n== A1. ' + nome + ': Catálogo Organizacional → vínculos da Avaliação ==');
  {
    const { ctx, page, erros } = await abrir(browser, viewport, { ajuste: (d) => { delete d['avaliacao-classificacoes'].canal; } });
    afirma(await page.locator('.tax-dominio--ativo[data-dominio="organizacional"]').count() === 1, 'começa no Catálogo Organizacional');
    await T.irIntegridade(page);
    await esperarCondicao(page, () => !!document.getElementById('taxRegistrarLigacoesBtn'), null, { descricao: 'botão de registrar vínculos da Avaliação' });
    afirma(await page.locator('#taxRegistrarLigacoesBtn').getAttribute('data-dominio') === 'arquitetural' && await page.locator('#taxRegistrarLigacoesBtnPos').count() === 0, 'o botão do bloco da Avaliação carrega o domínio arquitetural (o do Posicionamento não aparece: nada a registrar)');
    const antesPos = JSON.stringify((await db(page))['posicionamento-classificacoes']);
    await T.esperarTelaEstavel(page, 'abrir a prévia da Avaliação');
    await page.click('#taxRegistrarLigacoesBtn');
    await esperarCondicao(page, () => !!document.getElementById('taxPreviaLigacoes'), null, { descricao: 'prévia da Avaliação' });
    afirma(await page.locator('#taxPreviaLigacoesPos').count() === 0, 'a prévia abre no bloco da Avaliação, não no do Posicionamento');
    afirma(await page.locator('#taxPreviaLigacoes [data-previa="canal"][data-situacao="ligar"]').count() === 1, 'a prévia mostra o vínculo que falta (canal → será vinculado)');
    await page.click('#taxPreviaLigacoes [data-tax="cancelar-ligacoes"]');
    await esperarCondicao(page, () => !document.getElementById('taxPreviaLigacoes'), null, { descricao: 'prévia da Avaliação fechada' });
    afirma(await escritasEm(page, 'avaliacao-classificacoes') === 0, 'cancelar fecha a prévia da Avaliação sem gravar');
    await page.click('#taxRegistrarLigacoesBtn');
    await page.waitForSelector('#taxConfirmarLigacoes');
    afirma(await page.locator('#taxConfirmarLigacoes').getAttribute('data-dominio') === 'arquitetural', 'confirmar carrega o domínio arquitetural');
    await page.click('#taxConfirmarLigacoes');
    await esperarCondicao(page, () => !!(window.__CFG.__dbReal['avaliacao-classificacoes'] || {}).canal, null, { descricao: 'vínculo da Avaliação gravado' });
    const d = await db(page), L = d['avaliacao-classificacoes'].canal, aud = (d['avaliacao-classificacoes-auditoria'] || {}).canal || {};
    afirma(L.registradoPor === S.EMAIL && aud[L.auditoriaId] && aud[L.auditoriaId].tipo === 'ligacao_registrada', 'gravado em avaliacao-classificacoes com a sua auditoria ligacao_registrada');
    afirma(JSON.stringify(d['posicionamento-classificacoes']) === antesPos && await escritasEm(page, 'posicionamento-classificacoes') === 0, 'nada do Posicionamento foi tocado');
    await esperarCondicao(page, () => (document.getElementById('taxConceitosBase') || {}).getAttribute && document.getElementById('taxConceitosBase').getAttribute('data-estado') === 'ok', null, { descricao: 'bloco da Avaliação completo' });
    afirma(await larguraOk(page), 'sem rolagem horizontal');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }
  console.log('\n== A2. ' + nome + ': Catálogo Arquitetural → vínculos do Posicionamento ==');
  {
    const { ctx, page, erros } = await abrir(browser, viewport, { ajuste: (d) => { delete d['posicionamento-classificacoes'].COE; } });
    await T.dominio(page, 'arquitetural');
    await T.irIntegridade(page);
    await esperarCondicao(page, () => !!document.getElementById('taxRegistrarLigacoesBtnPos'), null, { descricao: 'botão de registrar vínculos do Posicionamento' });
    afirma(await page.locator('#taxRegistrarLigacoesBtnPos').getAttribute('data-dominio') === 'organizacional', 'o botão do bloco do Posicionamento carrega o domínio organizacional');
    const antesArq = JSON.stringify((await db(page))['avaliacao-classificacoes']);
    await T.esperarTelaEstavel(page, 'abrir a prévia do Posicionamento');
    await page.click('#taxRegistrarLigacoesBtnPos');
    await esperarCondicao(page, () => !!document.getElementById('taxPreviaLigacoesPos'), null, { descricao: 'prévia do Posicionamento' });
    afirma(await page.locator('#taxPreviaLigacoes').count() === 0 && await page.locator('#taxPreviaLigacoesPos [data-previa="COE"][data-situacao="ligar"]').count() === 1, 'a prévia abre no bloco do Posicionamento (COE → será vinculado), não no da Avaliação');
    await page.click('#taxPreviaLigacoesPos [data-tax="cancelar-ligacoes"]');
    await esperarCondicao(page, () => !document.getElementById('taxPreviaLigacoesPos'), null, { descricao: 'prévia do Posicionamento fechada' });
    afirma(await escritasEm(page, 'posicionamento-classificacoes') === 0, 'cancelar fecha a prévia do Posicionamento sem gravar');
    await page.click('#taxRegistrarLigacoesBtnPos');
    await page.waitForSelector('#taxConfirmarLigacoesPos');
    await page.click('#taxConfirmarLigacoesPos');
    await esperarCondicao(page, () => !!(window.__CFG.__dbReal['posicionamento-classificacoes'] || {}).COE, null, { descricao: 'vínculo do Posicionamento gravado' });
    const d = await db(page), L = d['posicionamento-classificacoes'].COE, aud = (d['posicionamento-classificacoes-auditoria'] || {}).COE || {};
    afirma(JSON.stringify(Object.keys(L).sort()) === JSON.stringify(['auditoriaId', 'registradoEm', 'registradoPor']) && aud[L.auditoriaId] && aud[L.auditoriaId].tipo === 'ligacao_registrada', 'gravado em posicionamento-classificacoes (só governança) com a sua auditoria');
    afirma(JSON.stringify(d['avaliacao-classificacoes']) === antesArq && await escritasEm(page, 'avaliacao-classificacoes') === 0, 'nada da Avaliação foi tocado');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }
}

async function cenarioB(browser) {
  console.log('\n== B. Indicador do topo = a mesma avaliação dos dois blocos ==');
  const casos = [
    { nome: 'tudo completo', esperado: 'ok' },
    { nome: 'vínculos da Avaliação ainda lendo', esperado: 'conferindo', o: { delays: { 'avaliacao-classificacoes': 100000000 } } },
    { nome: 'conceitos do outro domínio (Arquitetural) ainda lendo', esperado: 'conferindo', o: { delays: { 'taxonomia/arquitetural/conceitos': 100000000 } } },
    { nome: 'leitura dos vínculos do Posicionamento recusada', esperado: 'erro', o: { fail: ['posicionamento-classificacoes'] } },
    { nome: 'leitura dos conceitos Arquiteturais recusada', esperado: 'erro', o: { fail: ['taxonomia/arquitetural/conceitos'] } },
    { nome: 'vínculo da Avaliação para conceito que não existe (11 vínculos)', esperado: 'problema', o: { ajuste: (d) => { delete d.taxonomia.arquitetural.conceitos.canal; } } },
    { nome: 'vínculo do Posicionamento para conceito INATIVO (10 vínculos)', esperado: 'problema', o: { ajuste: (d) => { d.taxonomia.organizacional.conceitos.COE.ativo = false; } } },
    { nome: 'vínculo sem código correspondente no motor', esperado: 'problema', o: { ajuste: (d) => { d['avaliacao-classificacoes']['codigo-ficticio-orfao'] = { registradoEm: '2026-10-06T12:00:00.000Z', registradoPor: S.EMAIL, auditoriaId: '-Lorfao' }; } } }
  ];
  for (const c of casos) {
    const { ctx, page, erros } = await abrir(browser, DESKTOP, c.o);
    const fixo = c.esperado === 'conferindo';
    if (fixo) await page.waitForSelector('#taxIntegridadeLink', { timeout: 8000 });
    else await esperarCondicao(page, (e) => { const b = document.getElementById('taxIntegridadeLink'); return !!b && b.getAttribute('data-estado') === e; }, c.esperado, { descricao: c.nome + ': atalho "' + c.esperado + '"' });
    const e = await atalho(page);
    const verde = await page.locator('#taxIntegridadeLink .tax-ponto--ok').count();
    afirma(e === c.esperado && (c.esperado === 'ok' ? verde === 1 : verde === 0), c.nome + ': atalho "' + c.esperado + '"' + (c.esperado === 'ok' ? ' (verde)' : ' — nunca verde'), e);
    if (c.esperado === 'problema') afirma(/requer atenção/.test(await page.locator('#taxIntegridadeLink').innerText()), c.nome + ': diz "requer atenção"');
    if (c.esperado === 'erro') afirma(/não foi possível conferir/.test(await page.locator('#taxIntegridadeLink').innerText()), c.nome + ': diz "não foi possível conferir"');
    /* alinhado com os blocos: o atalho é o pior estado dos dois */
    await T.irIntegridade(page);
    const blocos = [await estadoBloco(page, 'taxConceitosBase'), await estadoBloco(page, 'taxConceitosBasePos')];
    const pior = blocos.indexOf('problema') !== -1 ? 'problema' : blocos.indexOf('erro') !== -1 ? 'erro' : blocos.indexOf('conferindo') !== -1 ? 'conferindo' : 'ok';
    afirma(pior === e, c.nome + ': o atalho é o pior estado dos dois blocos (' + blocos.join(' / ') + ')', pior + ' ≠ ' + e);
    afirma(erros.length === 0, c.nome + ': nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }
}

async function cenarioC(browser, viewport, nome) {
  console.log('\n== C. ' + nome + ': releitura depois de salvar mantém a Administração ==');
  const { ctx, page, erros } = await abrir(browser, viewport);
  await T.abrirAdmin(page, 'ESTRATEGIA_CLIENTES');
  await page.click('#taxEditarInfoBtn');
  await page.fill('#taxF_observacoes', 'Observação fictícia revisada no teste.');
  /* a próxima leitura do domínio fica lenta: a releitura depois de salvar precisa ser vista esperando no lugar */
  await page.evaluate(() => { window.__CFG.delays = { 'taxonomia/organizacional/conceitos': 1500 }; });
  await page.evaluate(() => {
    window.__vistoNaRecarga = { catalogo: false, espera: false };
    const raiz = document.getElementById('adminTaxonomia');
    window.__obsRecarga = new MutationObserver(() => {
      if (raiz.querySelector('.tax-dominios, .tax-ficha')) window.__vistoNaRecarga.catalogo = true;
      const a = raiz.querySelector('#taxAdmin .loading-msg');
      if (a && /Carregando o conceito/.test(a.textContent)) window.__vistoNaRecarga.espera = true;
    });
    window.__obsRecarga.observe(raiz, { childList: true, subtree: true });
  });
  await page.click('[data-tax="salvar-edicao"]');
  await esperarCondicao(page, () => (window.__CFG.__dbReal.taxonomia.organizacional.conceitos.ESTRATEGIA_CLIENTES.observacoes || '').indexOf('revisada no teste') !== -1, null, { descricao: 'edição gravada' });
  await esperarCondicao(page, () => !!document.getElementById('taxAdminTitulo') && !document.querySelector('#taxAdmin .loading-msg') && window.faTaxonomia._interno.st.d.organizacional.estado === 'ok', null, { limite: 10000, descricao: 'administração de volta depois da releitura' });
  const visto = await page.evaluate(() => { window.__obsRecarga.disconnect(); return window.__vistoNaRecarga; });
  afirma(visto.espera, 'durante a releitura: "Carregando o conceito…" dentro da Administração');
  afirma(!visto.catalogo, 'em nenhum momento a tela caiu no Catálogo');
  afirma(/Administrar — Linhas de Estratégia de Clientes/.test(await page.locator('#taxAdminTitulo').innerText()) && /revisada no teste/.test(await page.locator('#taxSecPergunta').innerText()), 'a Administração volta com o conteúdo salvo');
  await page.evaluate(() => { window.__CFG.delays = {}; });
  await T.voltarCatalogo(page);
  afirma(await page.locator('.tax-dominios').count() === 1, '"Voltar ao catálogo" responde com um clique só, depois da releitura');
  afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
  await ctx.close();
}

async function cenarioD(browser, viewport, nome) {
  console.log('\n== D. ' + nome + ': tema escuro — contraste e foco ==');
  const { ctx, page } = await abrir(browser, viewport, { ajuste: (d) => { delete d['avaliacao-classificacoes'].canal; } });
  const medir = () => page.evaluate(() => {
    const rgb = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const lum = (c) => [c.r, c.g, c.b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const razao = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const sobre = (c, f) => ({ r: c.r * c.a + f.r * (1 - c.a), g: c.g * c.a + f.g * (1 - c.a), b: c.b * c.a + f.b * (1 - c.a), a: 1 });
    function fundo(el) { const pilha = []; for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { pilha.push(c); if (c.a >= 1) break; } } let f = { r: 0, g: 0, b: 0, a: 1 }; for (let i = pilha.length - 1; i >= 0; i--) f = sobre(pilha[i], f); return f; }
    const raiz = document.querySelector('.tax-ui');
    const textos = [...raiz.querySelectorAll('h3, h4, p, li, td, th, button, label, summary, span, a, .tax-item-nome, input')].filter((e) => e.offsetParent && e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    const ruins = [];
    textos.forEach((e) => { const cs = getComputedStyle(e); const c = rgb(cs.color); if (!c) return; const r = razao(sobre(c, fundo(e)), fundo(e)); if (r < 4.5) ruins.push(e.tagName + '.' + e.className + ' «' + e.textContent.trim().slice(0, 30) + '» ' + r.toFixed(2)); });
    const ctrl = [...raiz.querySelectorAll('input, select, .btn:not(.btn--primary)')].filter((e) => e.offsetParent).map((e) => { const b = rgb(getComputedStyle(e).borderTopColor); const f = fundo(e.parentElement); return b ? razao(sobre(b, f), f) : 0; });
    const fundoRaiz = getComputedStyle(raiz).backgroundColor;
    const claros = [...raiz.querySelectorAll('*')].filter((e) => { const c = rgb(getComputedStyle(e).backgroundColor); return c && c.a > 0.5 && lum(c) > 0.5 && !e.classList.contains('btn--primary'); }).map((e) => e.className);
    return { n: textos.length, ruins, menorControle: Math.min.apply(null, ctrl.concat([99])), fundoRaiz, claros };
  });
  const verificar = async (onde) => {
    const m = await medir();
    afirma(m.fundoRaiz === 'rgb(12, 21, 38)', onde + ': fundo da Taxonomia #0C1526 (escuro corporativo)', m.fundoRaiz);
    afirma(m.claros.length === 0, onde + ': nenhuma superfície clara (só o amarelo da ação primária)', m.claros.slice(0, 5));
    afirma(m.n > 5 && m.ruins.length === 0, onde + ': ' + m.n + ' textos com contraste ≥ 4,5:1', m.ruins.slice(0, 6));
    afirma(m.menorControle >= 3, onde + ': borda dos controles ≥ 3:1 (' + m.menorControle.toFixed(2) + ')');
  };
  await T.abrirConceito(page, 'ESTRATEGIA_CLIENTES');
  await verificar('Catálogo');
  await page.click('#taxCompararBtn'); await page.selectOption('#taxCompararSel', 'NEGOCIOS');
  await verificar('Comparação');
  await page.click('#taxCompararFechar');
  await T.administrar(page, 'perfil');
  await verificar('Administração › Perfil');
  await page.click('#taxGerenciarPerfilBtn'); await page.waitForSelector('#taxFormPerfilLote');
  await verificar('Gerenciar perfil (formulário)');
  await page.click('#taxCancelarPerfilBtn');
  await T.abaAdmin(page, 'relacoes');
  await verificar('Administração › Relações');
  await T.irIntegridade(page);
  await esperarCondicao(page, () => !!document.getElementById('taxRegistrarLigacoesBtn'), null, { descricao: 'Integridade com falha' });
  await verificar('Integridade (com falha)');
  /* foco de teclado visível: contorno ciano de 3 px */
  await page.focus('#taxVoltarCatalogo'); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
  const foco = await page.evaluate(() => { const e = document.activeElement, cs = getComputedStyle(e); return { id: e.id, estilo: cs.outlineStyle, largura: parseFloat(cs.outlineWidth), cor: cs.outlineColor }; });
  afirma(foco.estilo !== 'none' && foco.largura >= 2 && foco.cor === 'rgb(117, 204, 234)', 'foco de teclado visível (contorno ciano ≥ 2 px)', foco);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  for (const [nome, vp] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nome + ' ########');
    await cenarioA(browser, vp, nome);
    await cenarioC(browser, vp, nome);
    await cenarioD(browser, vp, nome);
  }
  await cenarioB(browser);
  await browser.close();
  console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
