/* Painel do Programa (#painel) e ADMIN › Painel do Programa — a tela de verdade, com o Firebase falso.
 *
 * POR QUE ESTE TESTE EXISTE
 * O painel é para decisão executiva: o número na tela tem de ser o do cálculo (programa-cobertura-nucleo.js), o acesso
 * tem de ser só do admin geral e dos convidados, e "ainda não sei" nunca pode virar "sem acesso" (os dois desastres da
 * oficina de 08–09/09 foram disso). Desktop e celular (375 px). Exige:
 *   A. acesso: admin e convidado veem o menu e a página; pessoa comum não vê o menu e é tirada de #painel; convidado não
 *      vê o ADMIN; leitura lenta do convidado não expulsa; leitura que falha mostra o aviso, sem expulsar;
 *   N. os números dos quatro blocos são os do núcleo calculado no Node com os mesmos dados;
 *   U. "Atualizar dados": mostra "Atualizando…", relê o banco (mudança aparece), atualiza o horário; leitura que falha
 *      mantém os números anteriores e mostra o erro;
 *   C. consultas em páginas próprias (diretorias, mobilização, ausências, capacidade, evolução), com "← Voltar ao painel";
 *   P. configuração incompleta: o painel diz o que falta, sem número inventado;
 *   D. ADMIN: incluir convidado grava o registro; configuração inválida não grava e diz por quê; válida grava e acrescenta
 *      a auditoria; planilha → prévia (com os pontos sinalizados) → só grava ao confirmar, como versão nova e vigente;
 *   L. nenhuma rolagem lateral nem erro de JavaScript.
 */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { verificarTela } = require('./padrao-visual-verificacoes');
const XLSX = require(path.join(__dirname, '..', '..', 'forca-agil', 'xlsx.mini.min.js'));

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const ADM = 'adm@previ.com.br', CONV = 'convidado@previ.com.br', COMUM = 'comum@previ.com.br';

/* núcleo e funções de entrada reais, no Node, para o número esperado */
const ctxN = { window: {}, console }; vm.createContext(ctxN);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'publicos-nucleo.js'), 'utf8'), ctxN);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'turmas-util.js'), 'utf8'), ctxN);
const NUC = require(path.join(RAIZ, 'programa-cobertura-nucleo.js'));

function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function util(desloc) { const d = new Date(); d.setDate(d.getDate() + desloc); while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1); return iso(d); }
const HOJE = iso(new Date());

function banco(opts) {
  opts = opts || {};
  const A1 = util(-60), A2 = util(-59), F1 = util(14), F2 = util(15);
  const pessoas = {}, users = {}, interesse = { ta: {}, tf: {} }, checkin = { ta: { [A1]: {}, [A2]: {} } };
  for (let i = 0; i < 24; i++) {
    const e = 'p' + i + '@previ.com.br', k = chave(e);
    pessoas[k] = { email: e, nome: 'P' + i, gerencia: 'G' + (i % 3), diretoria: i < 12 ? 'DIRA' : 'DIRB' };
    if (i < 20) users[k] = { email: e, name: 'P' + i };
    if (i < 8) { interesse.ta[k] = { status: 'inscrito', confirmedByAdmin: ADM, email: e }; checkin.ta[A1][k] = true; checkin.ta[A2][k] = true; }
    else if (i < 10) { interesse.ta[k] = { status: 'inscrito', confirmedByAdmin: ADM, email: e }; checkin.ta[A1]['outro'] = true; }
    else if (i < 15) interesse.tf[k] = { status: 'inscrito', confirmedByAdmin: ADM, email: e };
    else if (i < 17) interesse.tf[k] = { status: 'interessado', email: e };
  }
  const admins = { [chave(ADM)]: { email: ADM, name: 'ADM' } };
  users[chave(ADM)] = { email: ADM, name: 'ADM' }; users[chave(CONV)] = { email: CONV, name: 'CONV' }; users[chave(COMUM)] = { email: COMUM, name: 'COMUM' };
  const db = {
    'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {}, 'fa-gerentes': {}, 'fa-espera': {}, 'fa-progress': {}, 'fa-progress-historico': {}, 'fa-reset-signal': {},
    'fa-painel-convidados': { [chave(CONV)]: { email: CONV, name: 'CONVIDADO', addedAt: '2026-11-01T00:00:00.000Z', addedBy: ADM } },
    'publicos-config': { ativo: true },
    eventos: { evT: { nome: 'Oficina Técnicos', publicoDesc: 'Técnicos', vagasPorTurma: 10, percentualMinimo: 75, order: 1 }, evX: { nome: 'Outro evento', order: 2 } },
    turmas: { ta: { label: 'Turma A', eventoKey: 'evT', dias: [A1, A2], horarioInicio: '09:00', horarioFim: '13:00' }, tf: { label: 'Turma F', eventoKey: 'evT', dias: [F1, F2], horarioInicio: '09:00', horarioFim: '13:00' }, tc: { label: 'Turma C', eventoKey: 'evT', dias: [F1], horarioInicio: '14:00', horarioFim: '17:00' } },
    'turmas-config': { ta: { encerrada: true, dataConclusao: A2 }, tc: { cancelamento: { motivo: 'outro', em: '2026-11-01T00:00:00.000Z', por: ADM } } }, 'turmas-interesse': interesse, 'turmas-interesse-log': {}, 'turmas-checkin': checkin,
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {}, avaliacoes: {}, pedidos: {}, holocron: {},
    'programa-config': opts.semConfig ? null : { prazo: util(40), eventos: { evT: true }, antecedenciaDiasUteis: 3, limiteParalelo: { tecnicos: 2, gestores: 1 } },
    'programa-calendario': {}, 'programa-config-auditoria': {},
    'programa-publico-alvo': opts.semBase ? null : { vigente: 1, versoes: { 1: { importadaEm: 1, importadaPor: ADM, total: 24, origem: 'teste', pessoas } } }
  };
  return db;
}
function esperado(db) {
  const v = db['programa-publico-alvo'], ver = v && v.versoes[v.vigente];
  return NUC.calcular({ hoje: HOJE, eventos: db.eventos, turmas: db.turmas, config: db['turmas-config'], interesse: db['turmas-interesse'], checkin: db['turmas-checkin'], users: db['fa-users'],
    gerentes: db['fa-gerentes'], diretores: db['fa-diretores'], eventosPublico: {}, turmasPublico: {}, publicosAtivo: true, programa: db['programa-config'] || {}, calendario: db['programa-calendario'] || {},
    base: ver ? { versao: 1, pessoas: ver.pessoas } : null }, ctxN.window.faTurmasUtil, ctxN.window.faPublicosNucleo);
}

let oks = 0, falhas = 0;
const ok = (n, c, d) => { if (c) { oks++; console.log('  ok    ' + n); } else { falhas++; console.error('  FALHA ' + n + (d !== undefined ? ' — ' + JSON.stringify(d) : '')); } };

async function abrir(browser, ctxOpts, cfg, hash) {
  const ctx = await browser.newContext(ctxOpts), page = await ctx.newPage(), erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify(Object.assign({ delayDefault: 15 }, cfg)) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  return { ctx, page, erros };
}
const user = (e) => ({ email: e, emailVerified: true, uid: 'u' + chave(e) });
const texto = (page, sel) => page.$eval(sel, (el) => el.textContent.trim()).catch(() => null);
async function esperarPainel(x) {
  try { await x.page.waitForSelector('[data-pnl="bloco-cobertura"]', { timeout: 15000 }); }
  catch (e) {
    console.error('  DIAGNÓSTICO url=' + x.page.url() + ' erros=' + JSON.stringify(x.erros));
    console.error('  DIAGNÓSTICO texto=' + JSON.stringify((await x.page.$eval('#painelConteudo', (el) => el.innerText).catch(() => '(sem #painelConteudo)')).slice(0, 400)));
    console.error('  DIAGNÓSTICO estado=' + await x.page.evaluate(() => JSON.stringify({ sessao: !!(window.faAuth && window.faAuth.getSession()), pronto: window.faAuth && window.faAuth.isPainelReady && window.faAuth.isPainelReady(), pode: window.faAuth && window.faAuth.podePainel && window.faAuth.podePainel(), visivel: !document.getElementById('page-painel').hidden, st: window.faPainelPrograma ? { c: window.faPainelPrograma._estado().carregando, e: window.faPainelPrograma._estado().erro, r: !!window.faPainelPrograma._estado().r } : 'sem modulo' })));
    throw e;
  }
}
/* FA_FOTOS=<pasta>: guarda capturas para conferência visual (não muda nenhuma verificação) */
const foto = async (page, nome) => { if (process.env.FA_FOTOS) await page.screenshot({ path: path.join(process.env.FA_FOTOS, nome + '.png'), fullPage: true }); };
const semRolagem = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function rodada(browser, rotulo, ctxOpts) {
  console.log('\n== ' + rotulo + ' ==');
  /* A + N: admin */
  let db = banco(), r = esperado(db);
  let x = await abrir(browser, ctxOpts, { db, user: user(ADM) }, '#painel');
  await esperarPainel(x);
  ok('A1 admin abre o painel', await x.page.isVisible('#page-painel'));
  ok('A2 menu Painel visível para admin', await x.page.evaluate(() => !document.querySelector('.nav-link-painel').hidden));
  ok('N1 realizados = núcleo', (await texto(x.page, '[data-pnl="realizou"]')) === String(r.realizou), [await texto(x.page, '[data-pnl="realizou"]'), r.realizou]);
  ok('N2 público = núcleo (base vigente)', (await texto(x.page, '[data-pnl="publico"]')) === String(r.N));
  ok('N3 pendentes = núcleo', (await texto(x.page, '[data-pnl="pendentes"]')) === String(r.pendentes));
  ok('N4 os quatro blocos', (await x.page.$$('[data-pnl^="bloco-"]')).length === 4);
  ok('N5 decisões = as do núcleo (no máximo três, na mesma ordem)', JSON.stringify(await x.page.$$eval('[data-pnl-decisao]', (l) => l.map((e) => e.getAttribute('data-pnl-decisao')))) === JSON.stringify(r.decisoes.map((d) => d.tipo)));
  ok('N7 principais gaps: legenda das três cores e exemplo de leitura com a primeira diretoria do núcleo', (await x.page.$$('[data-pnl="gaps-legenda"] i')).length === 3 && (await texto(x.page, '[data-pnl="gaps-exemplo"]')).startsWith('Como ler: ' + r.diretorias[0].nome + ' tem') && (await texto(x.page, '[data-pnl="gaps-exemplo"]')).includes('faltariam ' + r.diretorias[0].gap), await texto(x.page, '[data-pnl="gaps-exemplo"]'));
  ok('N8 gaps por diretoria: todas as diretorias do núcleo aparecem, nenhuma suprimida', (await x.page.$$('[data-pnl="bloco-gaps"] [data-pnl-dir]')).length === r.diretorias.length && r.diretorias.length > 0, [(await x.page.$$('[data-pnl="bloco-gaps"] [data-pnl-dir]')).length, r.diretorias.length]);
  ok('N6 horário da leitura exibido', /Dados lidos em \d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}/.test(await texto(x.page, '[data-pnl="lido"]')));
  ok('L1 sem rolagem lateral (visão executiva)', await semRolagem(x.page));
  await foto(x.page, rotulo.slice(0, 3) + '-executiva');
  let pv = await verificarTela(x.page, { escopo: '#page-painel', largura: ctxOpts.viewport.width });
  ok('V1 padrão visual (cor de link, contraste, voltar, um amarelo por cartão, foco, rolagem) na visão executiva', !pv.length, pv.slice(0, 3));
  /* U: atualizar com mudança no banco e leitura lenta */
  await x.page.evaluate((k) => { const c = window.__CFG; c.delays = { 'turmas-checkin': 700 }; const t = c.db['turmas-checkin']; Object.keys(t.ta).forEach((d) => { t.ta[d][k] = true; }); c.db['turmas-interesse'].ta[k] = { status: 'inscrito', confirmedByAdmin: 'adm@previ.com.br' }; }, chave('p20@previ.com.br'));
  await x.page.click('[data-pnl="atualizar"]');
  await x.page.waitForTimeout(150);
  ok('U1 "Atualizando…" durante a leitura, botão desabilitado', (await texto(x.page, '[data-pnl="atualizar"]')) === 'Atualizando…' && await x.page.$eval('[data-pnl="atualizar"]', (b) => b.disabled));
  await x.page.waitForFunction(() => { const b = document.querySelector('[data-pnl="atualizar"]'); return b && b.textContent.trim() === 'Atualizar dados'; }, null, { timeout: 8000 });
  ok('U2 a mudança no banco aparece depois de atualizar', (await texto(x.page, '[data-pnl="realizou"]')) === String(r.realizou + 1));
  await x.page.evaluate(() => { window.__CFG.fail = ['turmas-interesse']; window.__CFG.delays = {}; });
  await x.page.click('[data-pnl="atualizar"]');
  await x.page.waitForSelector('[data-pnl="erro"]', { timeout: 8000 });
  ok('U3 leitura que falha: erro visível, números anteriores mantidos com o horário deles', (await texto(x.page, '[data-pnl="realizou"]')) === String(r.realizou + 1) && /números exibidos são de/.test(await texto(x.page, '[data-pnl="erro"]')));
  await x.page.evaluate(() => { window.__CFG.fail = []; });
  /* C: consultas */
  for (const v of ['diretorias', 'mobilizacao', 'ausencias', 'capacidade', 'evolucao']) {
    await x.page.evaluate((v) => { location.hash = '#painel?v=' + v; }, v);
    await x.page.waitForTimeout(250);
    const h1 = await texto(x.page, '#painelConteudo h1');
    if (v === 'mobilizacao') { const pl = await x.page.evaluate(() => window.faPainelPrograma._planilha()); const rp = await x.page.evaluate(() => window.faPainelPrograma._estado().r); const n = (nome) => (pl.find((a) => a.nome === nome) || { linhas: [] }).linhas.length; ok('X1 admin vê "Exportar Excel com os nomes"; abas = números do painel (Todas, cada situação, faltaram)', await x.page.isVisible('[data-pnl="exportar"]') && n('Todas') === rp.N && n('Sem cadastro') === rp.porSit['sem-cadastro'] && n('Cadastradas sem engajamento') === rp.porSit['sem-engajamento'] && n('Interessadas sem inscrição') === rp.porSit.interessada && n('Inscritas sem realização') === rp.porSit.inscrita && n('Realizaram') === rp.realizou && n('Faltaram e seguem pendentes') === rp.ausencias.pendentes && pl.every((a) => a.cab[0] === 'Nome' && a.cab[1] === 'E-mail'), pl.map((a) => [a.nome, a.linhas.length])); const [dl] = await Promise.all([x.page.waitForEvent('download', { timeout: 15000 }), x.page.click('[data-pnl="exportar"]')]); ok('X2 o clique baixa o arquivo .xlsx e avisa com o horário dos dados', /^painel-programa-pessoas-\d{4}-\d{2}-\d{2}\.xlsx$/.test(dl.suggestedFilename()) && /Arquivo gerado/.test(await texto(x.page, '[data-pnl="exportar-msg"]')), dl.suggestedFilename()); }
    if (v === 'capacidade') { const fixo = await x.page.evaluate(() => { const w = [...document.querySelectorAll('#painelConteudo .table-scroll-wrap')].filter((e) => e.querySelector('.pnl-tabela tbody')).sort((p, q) => q.querySelectorAll('tbody tr').length - p.querySelectorAll('tbody tr').length)[0]; const th = w.querySelector('thead th'); const alt = w.style.maxHeight; w.style.maxHeight = '140px'; w.scrollTop = w.scrollHeight; const rolou = w.scrollTop > 0, d = Math.abs(th.getBoundingClientRect().top - w.getBoundingClientRect().top); w.scrollTop = 0; w.style.maxHeight = alt; return { rolou, d, fundo: getComputedStyle(th).backgroundColor }; }); ok('C capacidade: ao rolar a tabela de turmas, os títulos das colunas continuam à vista, com fundo opaco', fixo.rolou && fixo.d < 2 && !/rgba(.*, 0)|transparent/.test(fixo.fundo), fixo); }
    await foto(x.page, rotulo.slice(0, 3) + '-' + v);
    if (v === 'capacidade') { const tf = r.turmas.find((t) => t.key === 'tf'); const qts = await x.page.$$eval('#painelConteudo .pnl-cal .pnl-t--t', (l) => l.filter((e) => /Turma F/.test(e.textContent) && e.querySelector('[data-pnl="cal-ocupacao"]')).map((e) => e.querySelector('[data-pnl="cal-ocupacao"]').textContent)); const encs = await x.page.$$eval('#painelConteudo .pnl-cal .pnl-t--t', (l) => l.filter((e) => /Turma F/.test(e.textContent)).map((e) => e.textContent)); ok('C capacidade: turma de 2 encontros — número só no 1º (= núcleo), o 2º diz "2º de 2" sem número; nome inteiro, sem corte', qts.length === 1 && qts[0] === tf.ocupacao + '/' + tf.vagas && encs.length === 2 && /1º de 2/.test(encs[0]) && /2º de 2/.test(encs[1]) && !encs[1].includes(tf.ocupacao + '/'), [qts, encs]); }
    if (v === 'capacidade') { const canc = await x.page.$$eval('#painelConteudo .pnl-cal .pnl-t--cancel', (l) => l.map((e) => [e.textContent, getComputedStyle(e).textDecorationLine])); ok('C capacidade: turma cancelada aparece no calendário riscada e com legenda própria', canc.length === 1 && canc[0][0] === 'Cancelada · Turma C' && /line-through/.test(canc[0][1]) && !!(await x.page.$('[data-pnl="leg-cancelada"]')) && !(await x.page.$$eval('#painelConteudo .pnl-cal .pnl-t--t', (l) => l.some((e) => /Turma C/.test(e.textContent)))), canc); }
    if (v === 'diretorias') { const pc = (v, n) => (Math.round(v / n * 1000) / 10).toFixed(1).replace('.', ',') + '%'; const rp = await x.page.evaluate(() => window.faPainelPrograma._estado().r); ok('C diretorias: total projetado (inscritos e interessados) e gap = núcleo', (await texto(x.page, '[data-pnl="proj-total"]')) === pc(rp.realizou + rp.comVaga, rp.N) && (await texto(x.page, '[data-pnl="gap-total"]')) === String(rp.N - rp.realizou - rp.comVaga), [await texto(x.page, '[data-pnl="proj-total"]'), await texto(x.page, '[data-pnl="gap-total"]')]); const fechadas = await x.page.$$eval('tr.pnl-ger', (l) => l.every((e) => e.hidden)); await x.page.click('[data-pnl-abrir="0"]'); const ger = await x.page.$$eval('tr.pnl-ger[data-pnl-ger="0"]', (l) => l.map((e) => ({ vis: !e.hidden && e.getBoundingClientRect().height > 0, cols: e.children.length, total: +e.children[1].textContent }))); const cab = await x.page.$$eval('#painelConteudo .pnl-tabela thead th', (l) => l.length); ok('C diretorias: gerências começam fechadas; ao tocar na diretoria abrem como linhas com as mesmas colunas, somando o público dela', fechadas && ger.length === rp.diretorias[0].gerencias.length && ger.every((g) => g.vis && g.cols === cab) && ger.reduce((a, g) => a + g.total, 0) === rp.diretorias[0].total && (await x.page.getAttribute('[data-pnl-abrir="0"]', 'aria-expanded')) === 'true', { fechadas, ger, cab }); await x.page.click('[data-pnl-abrir="0"]'); ok('C diretorias: tocar de novo fecha', await x.page.$$eval('tr.pnl-ger[data-pnl-ger="0"]', (l) => l.every((e) => e.hidden))); }
    pv = await verificarTela(x.page, { escopo: '#page-painel', largura: ctxOpts.viewport.width, focos: 0 });
    ok('V ' + v + ': padrão visual', !pv.length, pv.slice(0, 3));
    ok('C ' + v + ': página própria com "← Voltar ao painel" e sem rolagem lateral', !!h1 && h1 !== 'Programa Força Ágil' && !!(await x.page.$('#painelConteudo a.avp-voltar-link[href="#painel"]')) && await semRolagem(x.page), h1);
    if (v === 'evolucao') { const pc = (v, n) => (Math.round(v / n * 1000) / 10).toFixed(1).replace('.', ',') + '%'; const rp = await x.page.evaluate(() => window.faPainelPrograma._estado().r); const leg = await x.page.$$eval('[data-pnl="evo-legenda"] [data-pnl="evo-leg"]', (l) => l.map((e) => e.textContent.trim())); ok('C evolução: nenhum rótulo dentro do gráfico; legenda abaixo com os cinco itens e os valores do núcleo', !(await x.page.$('.pnl-evo text')) || !(await x.page.$$eval('.pnl-evo text', (l) => l.some((e) => /Com |Planejadas/.test(e.textContent)))), leg) ; ok('C evolução: legenda = núcleo (projeção com inscritos e interessados)', leg.length === 5 && leg[0] === 'Realizado ' + pc(rp.realizou, rp.N) && leg[1] === 'Com inscritos e interessados ' + pc(rp.realizou + rp.comVaga, rp.N) && leg[2] === 'Planejadas ' + pc(rp.realizou + rp.maxPlanejado, rp.N) && leg[3] === 'Com as que cabem ' + pc(rp.realizou + rp.maxExpansao, rp.N) && /^100% do público/.test(leg[4]), leg); const caixas = await x.page.$$eval('[data-pnl="evo-leg"]', (els) => els.map((e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; })); ok('C evolução: itens da legenda sem sobreposição', !caixas.some((p, i) => caixas.some((q, j) => j > i && p[0] < q[2] && q[0] < p[2] && p[1] < q[3] && q[1] < p[3])), caixas); }
  }
  await x.page.click('#painelConteudo a.avp-voltar-link[href="#painel"]'); await x.page.waitForTimeout(250);
  ok('C voltar leva à visão executiva', !!(await x.page.$('[data-pnl="bloco-cobertura"]')));
  ok('L2 nenhum erro de JavaScript (admin)', !x.erros.length, x.erros);
  await x.ctx.close();

  /* A: convidado */
  db = banco();
  x = await abrir(browser, ctxOpts, { db, user: user(CONV) }, '#painel');
  await esperarPainel(x);
  ok('A3 convidado vê o painel com os mesmos números', (await texto(x.page, '[data-pnl="realizou"]')) === String(esperado(db).realizou));
  ok('A4 convidado não vê o ADMIN', await x.page.evaluate(() => document.getElementById('navAdmin').hidden));
  await x.page.evaluate(() => { location.hash = '#painel?v=mobilizacao'; }); await x.page.waitForTimeout(250);
  ok('A4b convidado não vê o botão de exportar com nomes', !(await x.page.$('[data-pnl="exportar"]')) && !!(await x.page.$('[data-pnl="bloco-gaps"], #painelConteudo h1')));
  await x.page.evaluate(() => { location.hash = '#painel'; }); await x.page.waitForTimeout(250);
  ok('A5 convidado não grava nada ao abrir e atualizar', await x.page.evaluate(() => !(window.__ESCRITAS || []).some((w) => /^(programa|fa-painel)/.test(w.path))));
  await x.ctx.close();
  /* A: convidado com leitura lenta: não é expulso enquanto não se sabe */
  x = await abrir(browser, ctxOpts, { db: banco(), user: user(CONV), delays: { 'fa-painel-convidados': 1500 } }, '#painel');
  await x.page.waitForTimeout(700);
  ok('A6 leitura lenta do convidado: continua em #painel ("Verificando acesso…")', /#painel/.test(x.page.url()) && /Verificando acesso/.test(await texto(x.page, '#painelConteudo')));
  await esperarPainel(x);
  ok('A7 quando a leitura chega, o painel abre', true);
  await x.ctx.close();
  /* A: leitura do convidado que falha */
  x = await abrir(browser, ctxOpts, { db: banco(), user: user(CONV), fail: ['fa-painel-convidados'] }, '#painel');
  await x.page.waitForTimeout(1500);
  ok('A8 leitura do convidado que falha: aviso na página, sem expulsar', /#painel/.test(x.page.url()) && /Não foi possível verificar seu acesso/.test(await texto(x.page, '#painelConteudo')));
  await x.ctx.close();
  /* A: pessoa comum */
  x = await abrir(browser, ctxOpts, { db: banco(), user: user(COMUM) }, '#painel');
  await x.page.waitForTimeout(1800);
  ok('A9 pessoa comum é tirada de #painel e não vê o menu', !/#painel/.test(x.page.url()) && await x.page.evaluate(() => document.querySelector('.nav-link-painel').hidden));
  ok('A10 pessoa comum não leu nenhum dado do painel na tela', !(await x.page.$('[data-pnl="bloco-cobertura"]')));
  await x.ctx.close();
  /* P: configuração incompleta */
  x = await abrir(browser, ctxOpts, { db: banco({ semConfig: true, semBase: true }), user: user(ADM) }, '#painel');
  await x.page.waitForSelector('[data-pnl="pendencias"]', { timeout: 15000 });
  ok('P1 sem configuração nem base: diz o que falta e não mostra número', /data-limite/.test(await texto(x.page, '[data-pnl="pendencias"]')) && /base oficial/.test(await texto(x.page, '[data-pnl="pendencias"]')) && !(await x.page.$('[data-pnl="realizou"]')));
  await x.ctx.close();
  /* M: margem e composição do público */
  db = banco(); db['programa-config'].margem = 2; db['programa-config'].composicao = { total: 100, situacaoInativa: 6, cargoIncompativel: 72 };
  r = esperado(db);
  x = await abrir(browser, ctxOpts, { db, user: user(ADM) }, '#painel');
  await esperarPainel(x);
  ok('M1 meta exibida = público − margem, com o quanto falta (do núcleo)', new RegExp('Meta: ' + r.meta + ' \\(público − margem de 2\\) · faltam ' + r.faltamParaMeta).test(await texto(x.page, '[data-pnl="meta"]')), await texto(x.page, '[data-pnl="meta"]'));
  ok('M2 composição que não fecha: aviso com a soma e a diferença', /não fecha/.test(await texto(x.page, '[data-pnl="composicao"]')) && new RegExp('= ' + (6 + 72 + r.N) + ' \\(diferença de ' + Math.abs(100 - (6 + 72 + r.N))).test(await texto(x.page, '[data-pnl="composicao"]')), await texto(x.page, '[data-pnl="composicao"]'));
  await x.ctx.close();
}

async function admin(browser, ctxOpts) {
  console.log('\n== D. ADMIN › Painel do Programa ==');
  const x = await abrir(browser, ctxOpts, { db: banco({ semBase: true }), user: user(ADM) }, '#admin');
  await x.page.waitForSelector('.admin-tab-btn[data-panel="adminPanelPainelPrograma"]', { timeout: 15000 });
  await x.page.click('.admin-tab-btn[data-panel="adminPanelPainelPrograma"]');
  await x.page.waitForSelector('#pnlaConvAdd', { timeout: 10000 });
  await x.page.fill('#pnlaConvNome', 'Nova Pessoa'); await x.page.evaluate(() => { const i = document.getElementById('pnlaConvEmail'); i.value = 'nova@previ.com.br'; });  /* como colar: o campo completa "@previ.com.br" ao receber o foco */ await x.page.click('#pnlaConvAdd');
  await x.page.waitForTimeout(400);
  ok('D1 incluir convidado grava o registro com a autoria de quem incluiu', await x.page.evaluate(() => { const v = window.__CFG.db['fa-painel-convidados']['nova_previ_com_br']; return !!v && v.addedBy === 'adm@previ.com.br' && v.name === 'NOVA PESSOA'; }), { msg: await texto(x.page, '#pnlaConvMsg'), email: await x.page.inputValue('#pnlaConvEmail').catch(() => '?'), conv: await x.page.evaluate(() => Object.keys(window.__CFG.db['fa-painel-convidados'] || {})) });
  await x.page.waitForSelector('#pnlaSalvarCfg');
  await x.page.fill('#pnlaPrazo', '');
  await x.page.click('#pnlaSalvarCfg'); await x.page.waitForTimeout(200);
  ok('D2 configuração inválida não grava e diz por quê', /data-limite/.test(await texto(x.page, '#pnlaCfgMsg')) && await x.page.evaluate(() => !(window.__ESCRITAS || []).some((w) => /^programa-config$/.test(w.path))));
  await x.page.fill('#pnlaPrazo', util(30)); await x.page.fill('#pnlaFacil', 'p0@previ.com.br');
  await x.page.click('#pnlaSalvarCfg'); await x.page.waitForTimeout(500);
  ok('D3 configuração válida grava e acrescenta auditoria', await x.page.evaluate(() => { const c = window.__CFG.db['programa-config']; const a = window.__CFG.db['programa-config-auditoria'] || {}; return !!c && !!c.facilitadores && Object.keys(a).length >= 2; }));
  await x.page.waitForSelector('#pnlaCompTotal');
  await x.page.fill('#pnlaCompTotal', '592'); await x.page.fill('#pnlaCompInativa', '6'); await x.page.fill('#pnlaCompCargo', '72'); await x.page.fill('#pnlaMargem', '4');
  ok('D3b sem base importada, a conta pede a base (não inventa número)', /Importe a base oficial/.test(await texto(x.page, '#pnlaCompConta')));
  await x.page.click('#pnlaSalvarCfg'); await x.page.waitForTimeout(500);
  ok('D3c total, situação não ativa, cargo não compatível e margem gravados', await x.page.evaluate(() => { const c = window.__CFG.db['programa-config']; return c.margem === 4 && c.composicao && c.composicao.total === 592 && c.composicao.situacaoInativa === 6 && c.composicao.cargoIncompativel === 72; }));
  /* planilha com um e-mail repetido e um fora do domínio */
  const linhas = [['ANNOME', 'ANEMAIL', 'GERENCIA', 'DIRETORIA', 'nivel']];
  for (let i = 0; i < 24; i++) linhas.push(['P' + i, 'p' + i + '@previ.com.br', 'G' + (i % 3), i < 12 ? 'DIRA' : 'DIRB', i === 0 ? 'diretor' : i === 1 ? 'assessor' : 'tecnico']);
  linhas.push(['Repetida', 'p1@previ.com.br', 'G1', 'DIRA', 'tecnico']); linhas.push(['Provisorio', 'prov@adcmflex.com.br', 'INFOR', 'DISEG', 'tecnico']);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), 'base');
  const arq = path.join(require('os').tmpdir(), 'base-painel-teste.xlsx'); fs.writeFileSync(arq, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  await x.page.setInputFiles('#pnlaArquivo', arq);
  await x.page.waitForSelector('[data-pnla="previa"]', { timeout: 10000 });
  const pv = await texto(x.page, '[data-pnla="previa"]');
  await foto(x.page, 'admin-' + (ctxOpts.viewport.width) + '-previa');
  const pv2 = await texto(x.page, '[data-pnla="previa"]');
  ok('D4b prévia separa técnicos, gestores, diretores e assessores pela coluna nível', /Técnicoss*23/.test(pv2) && /Diretoress*1/.test(pv2) && /Assessoress*1/.test(pv2) && /coluna nível da planilha/.test(pv2), pv2.slice(0, 400));
  ok('D4 prévia mostra os totais e sinaliza repetido e fora do domínio, sem gravar', /Pessoas válidas\s*25/.test(pv) && /E-mail repetido/.test(pv) && /fora de @previ/.test(pv) && await x.page.evaluate(() => !window.__CFG.db['programa-publico-alvo']), pv.slice(0, 300));
  await x.page.click('#pnlaImportar'); await x.page.waitForTimeout(200);
  ok('D5 com pontos sinalizados, pede a confirmação de que conferiu', /Marque/.test(await texto(x.page, '#pnlaImpMsg')) && await x.page.evaluate(() => !window.__CFG.db['programa-publico-alvo']));
  await x.page.check('#pnlaConferi'); await x.page.click('#pnlaImportar'); await x.page.waitForTimeout(600);
  ok('D6 confirmada: versão 1 gravada e vigente, com 25 pessoas', await x.page.evaluate(() => { const b = window.__CFG.db['programa-publico-alvo']; return !!b && b.vigente === 1 && Object.keys(b.versoes['1'].pessoas).length === 25 && b.versoes['1'].total === 25 && b.versoes['1'].pessoas['p0_previ_com_br'].nivel === 'diretor' && b.versoes['1'].pessoas['p1_previ_com_br'].nivel === 'assessor'; }));
  ok('D7 ADMIN sem rolagem lateral', await semRolagem(x.page));
  const pva = await verificarTela(x.page, { escopo: '#adminPainelPrograma', largura: ctxOpts.viewport.width, focos: 0 });
  ok('D9 padrão visual na aba do ADMIN', !pva.length, pva.slice(0, 3));
  ok('D8 nenhum erro de JavaScript (ADMIN)', !x.erros.length, x.erros);
  await x.ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  await rodada(browser, 'Desktop', { viewport: { width: 1366, height: 900 } });
  await rodada(browser, 'Celular (375 px)', Object.assign({}, devices['iPhone 12'], { viewport: { width: 375, height: 800 } }));
  await admin(browser, { viewport: { width: 1366, height: 900 } });
  await admin(browser, Object.assign({}, devices['iPhone 12'], { viewport: { width: 375, height: 800 } }));
  await browser.close();
  console.log('\n' + oks + ' ok, ' + falhas + ' falha(s)');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
