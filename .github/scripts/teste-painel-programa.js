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
    pessoas[k] = { email: e, nome: 'P' + i, gerencia: 'G' + (i % 3), diretoria: i < 12 ? 'DIRA' : 'DIRB', ...(i % 6 === 5 ? { nivel: 'gestor' } : {}) };
    if (i < 20) users[k] = { email: e, name: 'P' + i };
    if (opts.grande && i === 0) for (let j = 0; j < 1400; j++) { const eg = 'g' + j + '@previ.com.br'; pessoas[chave(eg)] = { email: eg, nome: 'G' + j, gerencia: 'GX' + (j % 7), diretoria: j < 1100 ? 'DIRETORIA COM UM NOME MUITO LONGO PARA CONFERIR A QUEBRA' : 'DIRC' }; }
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
    'programa-config': opts.semConfig ? null : { prazo: util(40), eventos: { evT: true }, antecedenciaDiasUteis: 3, limiteParalelo: { tecnicos: 2, gestores: 1 }, ocupacaoEsperada: 70 },
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
const fotoBloco = async (page, nome) => { if (process.env.FA_FOTOS) { const el = await page.$('[data-pnl="bloco-gaps"]'); if (el) await el.screenshot({ path: path.join(process.env.FA_FOTOS, nome + '.png') }); } };
const semRolagem = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/* GP: bloco 3 · Gaps por diretoria (v3). Para cada público e cada modo, o que a tela mostra é conferido com o recorte do
   núcleo (porPublico[pub]): ordem, GAP, %, total, escala (limite redondo ≥ maior GAP), comprimento das barras, divisor da
   cobertura do recorte, links para as gerências e o caso sem ninguém no recorte. */
const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');
const escalaEsperada = (m) => { if (!(m > 0)) return 0; for (let p = 1; ; p *= 10) for (const c of (p > 1 ? [2, 4, 5, 6, 8, 10] : [2, 4, 6, 8, 10])) if (c * p >= m) return c * p; };
const lerGaps = (page) => page.evaluate(() => {
  const b = document.querySelector('[data-pnl="bloco-gaps"]'), lis = [...b.querySelectorAll('[data-pnl-dir]')], lista = b.querySelector('[data-pnl="gaps-linhas"]');
  const razao = (el, base) => (el && base ? el.getBoundingClientRect().width / base : null);
  return {
    modo: b.getAttribute('data-modo'), vazio: !!b.querySelector('[data-pnl="gaps-vazio"]'), total: ((b.querySelector('[data-pnl="gaps-total"]') || {}).textContent || '').trim(),
    escala: lista && lista.hasAttribute('data-escala') ? +lista.getAttribute('data-escala') : null, ref: (b.querySelector('[data-pnl="gaps-ref"]') || {}).textContent || null,
    cardOk: b.scrollWidth <= b.clientWidth + 1,
    linhas: lis.map((e) => {
      const g = e.querySelector('.pnl-gaps-gbar'), c = e.querySelector('.pnl-gaps-cbar'), a = e.querySelector('a.pnl-gp-link'), num = g && g.querySelector('b');
      const trilho = g ? parseFloat(getComputedStyle(g, '::before').width) : 0, cw = c ? c.getBoundingClientRect().width : 0;
      return { nome: e.getAttribute('data-pnl-dir'), gap: +e.getAttribute('data-gap'), vazia: e.classList.contains('pnl-gaps-lin--vazia'), href: a ? a.getAttribute('href') : null,
        rg: g ? razao(g.querySelector('i'), trilho) : null, numDentro: !num || num.getBoundingClientRect().right <= g.getBoundingClientRect().right + 1,
        rr: c ? razao(c.querySelector('.pnl-gaps-real'), cw) : null, rp: c ? (c.querySelector('.pnl-gaps-pot') ? razao(c.querySelector('.pnl-gaps-pot'), cw) : 0) : null,
        pct: ((e.querySelector('.pnl-gaps-pct') || {}).textContent || ''), proj: ((e.querySelector('.pnl-gaps-col-proj') || {}).textContent || ''),
        antesRef: !!(e.previousElementSibling && e.previousElementSibling.matches('[data-pnl="gaps-ref"]')) };
    })
  };
});
async function verificarGaps(x, rotulo) {
  const rp = await x.page.evaluate(() => window.faPainelPrograma._estado().r);
  const vals = [0, 1, 2, 3, 9, 12, 33, 47, 171, 999, 1001];
  const esc = await x.page.evaluate((v) => v.map((m) => window.faPainelPrograma._escalaGap(m)), vals);
  ok('GP0 escala de pessoas: limite redondo ≥ maior GAP, com metade inteira (0→0, 1→2, 47→50, 171→200, 1001→2000)', JSON.stringify(esc) === JSON.stringify([0, 2, 2, 4, 10, 20, 40, 50, 200, 1000, 2000]), esc);
  const perto = (a, b) => a !== null && Math.abs(a - b) <= 0.02;
  for (const pub of ['todos', 'tecnicos', 'gestores', 'diretores', 'assessores']) {
    await x.page.click('[data-pnl="bloco-gaps"] [data-pnl-pub="' + pub + '"]');
    await x.page.click('[data-pnl-modo="gap"]');
    const R = rp.porPublico[pub], T = R.total, g = await lerGaps(x.page);
    if (!T.total) {
      ok('GP1 ' + pub + ': ninguém no recorte → o bloco diz isso, sem barras nem números', g.vazio && !g.linhas.length && !g.total, g);
      await x.page.click('[data-pnl-modo="cob"]'); const c0 = await lerGaps(x.page);
      ok('GP2 ' + pub + ': ninguém no recorte, também no modo Cobertura', c0.vazio && !c0.linhas.length && c0.ref === null, c0);
      continue;
    }
    const ordG = R.diretorias.map((d, i) => ({ d, i })).sort((a, b) => (!a.d.total) - (!b.d.total) || b.d.gap - a.d.gap || a.i - b.i).map((o) => o.d);
    const max = escalaEsperada(Math.max(0, ...R.diretorias.map((d) => d.gap)));
    ok('GP1 ' + pub + ' · Pessoas a alcançar: maior GAP primeiro, todas as diretorias, GAP e total do recorte, escala ' + max + ', barras na escala, número na ponta sem vazar',
      g.modo === 'gap' && JSON.stringify(g.linhas.map((l) => [l.nome, l.gap])) === JSON.stringify(ordG.map((d) => [d.nome, d.gap])) &&
      g.total.startsWith(String(T.gap)) && g.total.includes('de ' + T.total) && g.total.includes((T.projetados - T.realizou) + ' com participação potencial') && g.escala === max &&
      g.linhas.every((l, i) => l.vazia === !ordG[i].total && (l.vazia || (perto(l.rg, max ? ordG[i].gap / max : 0) && l.numDentro))) &&
      g.linhas.every((l, i) => l.href === '#painel?v=diretorias&d=' + encodeURIComponent(ordG[i].nome) + '&de=bloco-gaps') && g.cardOk, { g, max, T: { gap: T.gap, total: T.total } });
    await x.page.click('[data-pnl-modo="cob"]');
    const c = await lerGaps(x.page), ordC = R.diretorias;
    let pos = -1; ordC.forEach((d, i) => { if (pos < 0 && i > 0 && d.total && d.cobertura >= T.cobertura && ordC[i - 1].cobertura < T.cobertura) pos = i; });
    ok('GP2 ' + pub + ' · Cobertura (%): menor cobertura primeiro (a ordem do núcleo), realizado e projetada de cada diretoria, barras de 0 a 100%, total do recorte',
      c.modo === 'cob' && (await x.page.getAttribute('[data-pnl-modo="cob"]', 'aria-pressed')) === 'true' && JSON.stringify(c.linhas.map((l) => l.nome)) === JSON.stringify(ordC.map((d) => d.nome)) &&
      c.linhas.every((l, i) => { const d = ordC[i]; return !d.total ? l.vazia : l.pct.startsWith(f1(d.cobertura) + '%') && l.proj === f1(d.coberturaProjetada) + '%' && perto(l.rr, d.cobertura / 100) && perto(l.rp, (d.coberturaProjetada - d.cobertura) / 100); }) &&
      c.total.startsWith(f1(T.cobertura) + '%') && c.total.includes('projetada ' + f1(T.coberturaProjetada) + '%') && c.cardOk, { c, T: { cob: T.cobertura, proj: T.coberturaProjetada } });
    ok('GP3 ' + pub + ' · divisor na cobertura do recorte (' + f1(T.cobertura) + '%): entre quem está abaixo e quem está no nível ou acima',
      pos < 0 ? c.ref === null : (c.ref || '').includes(f1(T.cobertura) + '%') && c.linhas.findIndex((l) => l.antesRef) === pos, { pos, ref: c.ref });
  }
  await x.page.click('[data-pnl="bloco-gaps"] [data-pnl-pub="todos"]'); await x.page.click('[data-pnl-modo="gap"]');
  await x.page.click('[data-pnl-modo="cob"]'); await x.page.click('[data-pnl="atualizar"]'); await x.page.waitForTimeout(600);
  ok('GP4 o modo escolhido sobrevive a "Atualizar dados"', (await x.page.getAttribute('[data-pnl="bloco-gaps"]', 'data-modo')) === 'cob');
  await fotoBloco(x.page, rotulo.slice(0, 3) + '-gaps-cobertura');
  await x.page.click('[data-pnl-modo="gap"]');
  await fotoBloco(x.page, rotulo.slice(0, 3) + '-gaps-pessoas');
}
/* GP5: números grandes e nome longo de diretoria, no tamanho real (cartão da coluna no computador; tela de 375 px) */
async function gapsGrandes(browser, rotulo, ctxOpts) {
  const db = banco({ grande: true });
  const x = await abrir(browser, ctxOpts, { db, user: user(ADM) }, '#painel');
  await esperarPainel(x);
  for (const modo of ['gap', 'cob']) {
    await x.page.click('[data-pnl-modo="' + modo + '"]');
    const g = await lerGaps(x.page);
    ok('GP5 ' + rotulo + ' · ' + modo + ': com GAP de ' + Math.max(...g.linhas.map((l) => l.gap)) + ' e nome longo, nada vaza do cartão nem da página; escala ' + (g.escala === null ? '—' : g.escala),
      g.cardOk && await semRolagem(x.page) && g.linhas.every((l) => l.numDentro) && (modo === 'cob' || g.escala === escalaEsperada(Math.max(...g.linhas.map((l) => l.gap)))), g);
    await fotoBloco(x.page, rotulo.slice(0, 3) + '-gaps-grande-' + modo);
  }
  ok('GP6 ' + rotulo + ' · nenhum erro de JavaScript no cenário grande', !x.erros.length, x.erros);
  await x.ctx.close();
}

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
  { const rp = await x.page.evaluate(() => window.faPainelPrograma._estado().r); ok('N7 bloco 3 abre no modo Pessoas a alcançar; o total do resumo é o GAP do núcleo e os GAPs das diretorias somam ele', (await x.page.getAttribute('[data-pnl="bloco-gaps"]', 'data-modo')) === 'gap' && (await x.page.getAttribute('[data-pnl-modo="gap"]', 'aria-pressed')) === 'true' && (await texto(x.page, '[data-pnl="gaps-total"]')).startsWith(String(rp.gapProjetado)) && (await x.page.$$eval('[data-pnl="bloco-gaps"] [data-pnl-dir]', (l) => l.reduce((a, e) => a + +e.getAttribute('data-gap'), 0))) === rp.gapProjetado); }
  await verificarGaps(x, rotulo);
  { const rp = await x.page.evaluate(() => window.faPainelPrograma._estado().r); const tom = rp.realizou + rp.maxPlanejado >= rp.meta ? 'ok' : rp.fatores.calendario ? 'decisao' : 'acao'; ok('N12 veredito da Viabilidade no tom do núcleo, sem "inviável"', (await x.page.getAttribute('[data-pnl="veredito"]', 'data-tom')) === tom && !/inviável/i.test(await texto(x.page, '[data-pnl="veredito"]')), [tom, await texto(x.page, '[data-pnl="veredito"]')]); }
  ok('N8 gaps por diretoria: todas as diretorias do núcleo aparecem, nenhuma suprimida', (await x.page.$$('[data-pnl="bloco-gaps"] [data-pnl-dir]')).length === r.diretorias.length && r.diretorias.length > 0, [(await x.page.$$('[data-pnl="bloco-gaps"] [data-pnl-dir]')).length, r.diretorias.length]);
  { const rp = await x.page.evaluate(() => window.faPainelPrograma._estado().r); const tx = await texto(x.page, '[data-pnl="realista"]'); ok('N9 cenário realista na Viabilidade (ocupação 70%) com o % e o que faltaria do núcleo', !!rp.realista && tx.includes('ocupação esperada de 70%') && tx.includes(String(rp.realista.pctEsperado).replace('.', ',')) && tx.includes('faltariam ' + rp.realista.falta), tx); }
  ok('N10 Viabilidade diz a premissa do cenário máximo (todas as turmas planejadas lotam)', /todas as turmas planejadas lotam/.test(await texto(x.page, '[data-pnl="premissa-maximo"]')));
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
    if (v === 'capacidade') { const vis = (sel) => x.page.$$eval(sel, (l) => l.filter((e) => e.getBoundingClientRect().height > 0).length); const com = await vis('.pnl-cal .pnl-t--nt, .pnl-cal .pnl-t--ng'); const reais = await vis('.pnl-cal .pnl-t--t, .pnl-cal .pnl-t--g'); await x.page.click('[data-pnl-sim="sem"]'); const sem = await vis('.pnl-cal .pnl-t--nt, .pnl-cal .pnl-t--ng'); const reais2 = await vis('.pnl-cal .pnl-t--t, .pnl-cal .pnl-t--g'); const legSem = await vis('.pnl-leg-sim'); const pres = await x.page.getAttribute('[data-pnl-sim="sem"]', 'aria-pressed'); await x.page.click('[data-pnl-sim="com"]'); const volta = await vis('.pnl-cal .pnl-t--nt, .pnl-cal .pnl-t--ng'); ok('C capacidade: calendário Com/Sem simulação — "Sem" esconde só as turmas simuladas (e a legenda delas); "Com" volta', com > 0 && sem === 0 && reais2 === reais && reais > 0 && legSem === 0 && pres === 'true' && volta === com, { com, sem, reais, reais2, legSem, pres, volta }); }
    if (v === 'capacidade') { const ev = await x.page.$$eval('#painelConteudo [data-pnl="turma-evento"]', (l) => l.map((e) => e.textContent)); const th = await x.page.$$eval('#painelConteudo .pnl-tabela', (t) => [...t[t.length - 1].querySelectorAll('thead th')].slice(0, 2).map((e) => e.textContent)); ok('C capacidade: Turmas do programa com Evento e Turma em colunas separadas', th[0] === 'Evento' && th[1] === 'Turma' && ev.length === r.turmas.length && ev.every((e) => e === 'Oficina Técnicos'), { th, ev }); }
    if (v === 'capacidade') { const pub = await x.page.$$eval('[data-pnl="turmas-programa"] tbody tr', (l) => l.map((e) => e.children[3].textContent)); ok('C capacidade: coluna Público mostra o parâmetro Público-alvo do evento (nada fixo)', pub.length === r.turmas.length && pub.every((p) => p === 'Técnicos'), pub); }
    if (v === 'capacidade') { await x.page.selectOption('#pnlFSit', 'cancelada'); const vis = await x.page.$$eval('[data-pnl="turmas-programa"] tbody tr', (l) => l.filter((e) => !e.hidden).map((e) => e.children[1].textContent)); const cont = await texto(x.page, '[data-pnl="turmas-contagem"]'); await x.page.selectOption('#pnlFSit', ''); const todas = await x.page.$$eval('[data-pnl="turmas-programa"] tbody tr', (l) => l.filter((e) => !e.hidden).length); const alt = await x.page.evaluate(() => { const w = document.querySelector('[data-pnl="turmas-programa"] .table-scroll-wrap'); return { max: parseFloat(getComputedStyle(w).maxHeight), vh: innerHeight }; }); ok('C capacidade: filtros de Turmas do programa (situação cancelada = só a Turma C, contagem; Todos volta tudo) e o quadro cabe abaixo do menu', vis.length === 1 && vis[0] === 'Turma C' && cont === '1 de ' + r.turmas.length + ' turmas' && todas === r.turmas.length && alt.max <= Math.max(260, alt.vh - 220), { vis, cont, todas, alt }); }
    if (v === 'mobilizacao') { const pl = await x.page.evaluate(() => window.faPainelPrograma._planilha()); const rp = await x.page.evaluate(() => window.faPainelPrograma._estado().r); const n = (nome) => (pl.find((a) => a.nome === nome) || { linhas: [] }).linhas.length; ok('X1 admin vê "Exportar Excel com os nomes"; abas = números do painel (Todas, cada situação, faltaram)', await x.page.isVisible('[data-pnl="exportar"]') && n('Todas') === rp.N && n('Sem cadastro') === rp.porSit['sem-cadastro'] && n('Cadastradas sem engajamento') === rp.porSit['sem-engajamento'] && n('Interessadas sem inscrição') === rp.porSit.interessada && n('Inscritas, ainda não realizaram') === rp.porSit.inscrita && n('Realizaram') === rp.realizou && n('Faltaram e seguem pendentes') === rp.ausencias.pendentes && pl.every((a) => a.cab[0] === 'Nome' && a.cab[1] === 'E-mail'), pl.map((a) => [a.nome, a.linhas.length])); const [dl] = await Promise.all([x.page.waitForEvent('download', { timeout: 15000 }), x.page.click('[data-pnl="exportar"]')]); ok('X2 o clique baixa o arquivo .xlsx e avisa com o horário dos dados', /^painel-programa-pessoas-\d{4}-\d{2}-\d{2}\.xlsx$/.test(dl.suggestedFilename()) && /Arquivo gerado/.test(await texto(x.page, '[data-pnl="exportar-msg"]')), dl.suggestedFilename()); }
    if (v === 'mobilizacao') {
      /* M: cada número da Mobilização abre as pessoas dele (admin geral), uma situação por vez, sem sair da página */
      const rp = await x.page.evaluate(() => window.faPainelPrograma._estado().r);
      const espera = { 'sem-cadastro': rp.porSit['sem-cadastro'], 'sem-engajamento': rp.porSit['sem-engajamento'], interessada: rp.porSit.interessada, inscrita: rp.porSit.inscrita, faltou: rp.ausencias.pendentes };
      const botoes = await x.page.$$eval('[data-pnl-ver]', (l) => l.map((b) => [b.getAttribute('data-pnl-ver'), b.textContent]));
      ok('MB1 cada cartão com número maior que zero tem "Ver as N pessoas" com o número do cartão', botoes.length > 0 && botoes.length === Object.values(espera).filter(Boolean).length && botoes.every(([c, t]) => espera[c] && (espera[c] === 1 ? /^Ver a pessoa/.test(t) : t.startsWith('Ver as ' + espera[c] + ' pessoas'))), { botoes, espera });
      ok('MB1b o cartão das inscritas diz que ainda falta realizar ("Inscritas, ainda não realizaram")', (await texto(x.page, '#painelConteudo .pnl-blocos')).includes('Inscritas, ainda não realizaram'));
      /* MB7: os 5 cartões em 3 + 2 na tela larga (nenhum sozinho numa linha); no celular, um por linha */
      const linhasCartoes = await x.page.$$eval('[data-pnl="mob-cartoes"] > .pnl-bloco', (l) => { const t = {}; l.forEach((b) => { const y = Math.round(b.getBoundingClientRect().top); t[y] = (t[y] || 0) + 1; }); return Object.keys(t).sort((a, b) => a - b).map((k) => t[k]); });
      const largo = await x.page.evaluate(() => innerWidth >= 760);
      ok('MB7 cartões da Mobilização: ' + (largo ? '3 + 2 na tela larga' : 'um por linha no celular'), JSON.stringify(linhasCartoes) === (largo ? '[3,2]' : '[1,1,1,1,1]'), linhasCartoes);
      for (const [c] of botoes) {
        await x.page.click('[data-pnl-ver="' + c + '"]'); await x.page.waitForTimeout(150);
        const lis = await x.page.$$eval('[data-pnl="mob-lista"] li', (l) => l.length);
        const abertos = await x.page.$$eval('[data-pnl-ver][aria-expanded="true"]', (l) => l.map((b) => b.getAttribute('data-pnl-ver')));
        ok('MB2 "' + c + '" abre a lista com as ' + espera[c] + ' pessoas, só ele aberto', lis === espera[c] && abertos.length === 1 && abertos[0] === c && await x.page.isVisible('[data-pnl="mob-lista"]'), { lis, abertos });
        /* MB5: agrupada por diretoria (grupos em ordem), nomes em ordem alfabética dentro de cada uma; o filtro Diretoria
           mostra só o grupo escolhido, com a contagem da opção, e "Todas" volta tudo */
        const grupos = await x.page.$$eval('[data-pnl="mob-lista"] [data-pnl-mob-grupo]', (l) => l.map((g) => ({ d: g.getAttribute('data-pnl-mob-grupo'), nomes: [...g.querySelectorAll('li > span:first-child')].map((s) => s.textContent) })));
        const emOrdem = (a) => a.every((v, i) => !i || a[i - 1].localeCompare(v, 'pt-BR') <= 0);
        ok('MB5 "' + c + '": um grupo por diretoria, em ordem, e nomes em ordem alfabética em cada grupo', grupos.length > 0 && emOrdem(grupos.map((g) => g.d).filter((d) => d !== '-')) && grupos.every((g) => emOrdem(g.nomes)) && grupos.reduce((a, g) => a + g.nomes.length, 0) === espera[c], grupos);
        const opcoes = await x.page.$$eval('#pnlMobDir option', (l) => l.map((o) => [o.value, o.textContent]));
        if (grupos.length > 1) {
          let filtroOk = opcoes.length === grupos.length + 1 && opcoes[0][1] === 'Todas (' + espera[c] + ')';
          for (const [v, t] of opcoes.slice(1)) {
            await x.page.selectOption('#pnlMobDir', v);
            const vis = await x.page.$$eval('[data-pnl="mob-lista"] [data-pnl-mob-grupo]', (l) => l.filter((g) => !g.hidden).map((g) => [g.getAttribute('data-pnl-mob-grupo'), g.querySelectorAll('li').length]));
            filtroOk = filtroOk && vis.length === 1 && vis[0][0] === v && t.endsWith('(' + vis[0][1] + ')');
          }
          await x.page.selectOption('#pnlMobDir', '');
          filtroOk = filtroOk && (await x.page.$$eval('[data-pnl="mob-lista"] [data-pnl-mob-grupo]', (l) => l.every((g) => !g.hidden)));
          ok('MB6 "' + c + '": filtro Diretoria mostra só a escolhida, com a contagem da opção; "Todas" volta tudo', filtroOk, opcoes);
        } else ok('MB6 "' + c + '": uma diretoria só → sem filtro (nada a escolher)', !opcoes.length, opcoes);
        if (c === 'inscrita') await foto(x.page, rotulo.slice(0, 3) + '-mobilizacao-lista');
      }
      if (botoes.length) {
        const ultimo = botoes[botoes.length - 1][0];
        await x.page.click('[data-pnl-ver="' + ultimo + '"]'); await x.page.waitForTimeout(150);
        ok('MB3 tocar de novo no aberto fecha a lista', !(await x.page.isVisible('[data-pnl="mob-lista"]')) && (await x.page.$$('[data-pnl-ver][aria-expanded="true"]')).length === 0);
        const cor = await x.page.$eval('[data-pnl-ver]', (b) => getComputedStyle(b).color);
        ok('MB4 "Ver as pessoas" é link textual ciano claro (padrão visual), não a cor do navegador', cor === 'rgb(122, 240, 232)', cor);
      }
    }
    if (v === 'capacidade') { const fixo =await x.page.evaluate(() => { const w = [...document.querySelectorAll('#painelConteudo .table-scroll-wrap')].filter((e) => e.querySelector('.pnl-tabela tbody')).sort((p, q) => q.querySelectorAll('tbody tr').length - p.querySelectorAll('tbody tr').length)[0]; const th = w.querySelector('thead th'); const alt = w.style.maxHeight; w.style.maxHeight = '140px'; w.scrollTop = w.scrollHeight; const rolou = w.scrollTop > 0, d = Math.abs(th.getBoundingClientRect().top - w.getBoundingClientRect().top); w.scrollTop = 0; w.style.maxHeight = alt; return { rolou, d, fundo: getComputedStyle(th).backgroundColor }; }); ok('C capacidade: ao rolar a tabela de turmas, os títulos das colunas continuam à vista, com fundo opaco', fixo.rolou && fixo.d < 2 && !/rgba(.*, 0)|transparent/.test(fixo.fundo), fixo); }
    await foto(x.page, rotulo.slice(0, 3) + '-' + v);
    if (v === 'capacidade') { const tf = r.turmas.find((t) => t.key === 'tf'); const qts = await x.page.$$eval('#painelConteudo .pnl-cal .pnl-t--t', (l) => l.filter((e) => /Turma F/.test(e.textContent) && e.querySelector('[data-pnl="cal-ocupacao"]')).map((e) => e.querySelector('[data-pnl="cal-ocupacao"]').textContent)); const encs = await x.page.$$eval('#painelConteudo .pnl-cal .pnl-t--t', (l) => l.filter((e) => /Turma F/.test(e.textContent)).map((e) => e.textContent)); ok('C capacidade: turma de 2 encontros — número só no 1º (= núcleo), o 2º diz "2º de 2" sem número; nome inteiro, sem corte', qts.length === 1 && qts[0] === tf.ocupacao + '/' + tf.vagas && encs.length === 2 && /1º de 2/.test(encs[0]) && /2º de 2/.test(encs[1]) && !encs[1].includes(tf.ocupacao + '/'), [qts, encs]); }
    if (v === 'capacidade') { const canc = await x.page.$$eval('#painelConteudo .pnl-cal .pnl-t--cancel', (l) => l.map((e) => [e.textContent, getComputedStyle(e).textDecorationLine])); ok('C capacidade: turma cancelada aparece no calendário riscada e com legenda própria', canc.length === 1 && canc[0][0] === 'Cancelada · Turma C' && /line-through/.test(canc[0][1]) && !!(await x.page.$('[data-pnl="leg-cancelada"]')) && !(await x.page.$$eval('#painelConteudo .pnl-cal .pnl-t--t', (l) => l.some((e) => /Turma C/.test(e.textContent)))), canc); }
    if (v === 'diretorias') {
      const rp = await x.page.evaluate(() => window.faPainelPrograma._estado().r);
      const t = await x.page.evaluate(() => { const w = document.querySelector('[data-pnl="diretorias"] .table-scroll-wrap'), th = [...w.querySelectorAll('thead th')].map((e) => e.textContent), tot = [...w.querySelectorAll('tbody tr')].pop(); return { cabe: w.scrollWidth <= w.clientWidth + 1, th, ii: +tot.children[th.indexOf('Inscrita ou interessada')].textContent, preso: getComputedStyle(w.querySelector('tbody tr > td')).position }; });
      ok('C diretorias: inscrita e interessada numa coluna só (= soma do núcleo), "Cobertura (realizado)"; no computador a tabela cabe no cartão, no celular a coluna Diretoria fica presa ao rolar', t.th.length === 9 && t.th.includes('Cobertura (realizado)') && t.ii === rp.porSit.inscrita + rp.porSit.interessada && t.preso === 'sticky' && (ctxOpts.viewport.width < 1000 || t.cabe), t);
    }
    if (v === 'diretorias') { const pc = (v, n) => (Math.round(v / n * 1000) / 10).toFixed(1).replace('.', ',') + '%'; const rp = await x.page.evaluate(() => window.faPainelPrograma._estado().r); ok('C diretorias: total projetado (inscritos e interessados) e gap = núcleo', (await texto(x.page, '[data-pnl="proj-total"]')) === pc(rp.realizou + rp.comVaga, rp.N) && (await texto(x.page, '[data-pnl="gap-total"]')) === String(rp.N - rp.realizou - rp.comVaga), [await texto(x.page, '[data-pnl="proj-total"]'), await texto(x.page, '[data-pnl="gap-total"]')]); const fechadas = await x.page.$$eval('tr.pnl-ger', (l) => l.every((e) => e.hidden)); await x.page.click('[data-pnl-abrir="0"]'); const ger = await x.page.$$eval('tr.pnl-ger[data-pnl-ger="0"]', (l) => l.map((e) => ({ vis: !e.hidden && e.getBoundingClientRect().height > 0, cols: e.children.length, total: +e.children[1].textContent }))); const cab = await x.page.$$eval('#painelConteudo .pnl-tabela thead th', (l) => l.length); ok('C diretorias: gerências começam fechadas; ao tocar na diretoria abrem como linhas com as mesmas colunas, somando o público dela', fechadas && ger.length === rp.diretorias[0].gerenciasTodas.length && ger.every((g) => g.vis && g.cols === cab) && ger.reduce((a, g) => a + g.total, 0) === rp.diretorias[0].total && (await x.page.getAttribute('[data-pnl-abrir="0"]', 'aria-expanded')) === 'true', { fechadas, ger, cab }); await x.page.click('[data-pnl-abrir="0"]'); ok('C diretorias: tocar de novo fecha', await x.page.$$eval('tr.pnl-ger[data-pnl-ger="0"]', (l) => l.every((e) => e.hidden)));
      /* nomes (admin geral): a gerência abre as pessoas dela; fechar a diretoria fecha os nomes */
      await x.page.click('[data-pnl-abrir="0"]'); await x.page.click('[data-pnl-nomes="0-0"]');
      const nomes = await x.page.$$eval('tr[data-pnl-nomes-de="0-0"]:not([hidden]) .pnl-nomes-lista li', (l) => l.map((e) => e.getAttribute('data-sit'))); await foto(x.page, rotulo.slice(0, 3) + '-diretorias-nomes');
      ok('L3 nomes abertos: sem rolagem lateral da página', await semRolagem(x.page));
      ok('C diretorias: admin toca na gerência e vê as pessoas dela (quantas = coluna Público, situações = núcleo)', nomes.length === rp.diretorias[0].gerenciasTodas[0].total && nomes.filter((x) => x === 'realizou').length === rp.diretorias[0].gerenciasTodas[0].realizou, { nomes, g: rp.diretorias[0].gerenciasTodas[0] });
      await x.page.click('[data-pnl-abrir="0"]');
      ok('C diretorias: fechar a diretoria esconde também os nomes', await x.page.$$eval('tr[data-pnl-nomes-dir="0"]', (l) => l.every((e) => e.hidden)));
      /* filtro de público */
      await x.page.click('[data-pnl-pub="gestores"]');
      const gp = rp.porPublico.gestores, pl = await x.page.evaluate(() => window.faPainelPrograma._planilha('gestores'));
      ok('C diretorias: filtro Gestores — total, gap e linhas = recorte do núcleo, todas as diretorias; Excel só com gestores', gp.total.total === 4 && (await texto(x.page, '[data-pnl="gap-total"]')) === String(gp.total.gap) && (await x.page.$$('tr.pnl-dir')).length === rp.diretorias.length && (await x.page.getAttribute('[data-pnl-pub="gestores"]', 'aria-pressed')) === 'true' && (await x.page.getAttribute('[data-pnl="exportar"]', 'data-pub')) === 'gestores' && pl[0].linhas.length === 4 && pl[0].linhas.every((l) => l[4] === 'Gestor'), { gp: gp.total, pl: pl[0].linhas.length });
      await x.page.click('[data-pnl-pub="diretores"]');
      ok('C diretorias: público sem ninguém (diretores) mostra as diretorias com 0 e "—", sem quebrar', (await x.page.$$('tr.pnl-dir')).length === rp.diretorias.length && (await texto(x.page, '[data-pnl="proj-total"]')) === '—' && !(await x.page.$('[data-pnl-abrir]')));
      await x.page.click('[data-pnl-pub="todos"]'); }
    pv = await verificarTela(x.page, { escopo: '#page-painel', largura: ctxOpts.viewport.width, focos: 0 });
    ok('V ' + v + ': padrão visual', !pv.length, pv.slice(0, 3));
    ok('C ' + v + ': página própria com "← Voltar ao painel" e sem rolagem lateral', !!h1 && h1 !== 'Programa Força Ágil' && !!(await x.page.$('#painelConteudo a.avp-voltar-link[href="#painel"]')) && await semRolagem(x.page), h1);
    if (v === 'evolucao') { const pc = (v, n) => (Math.round(v / n * 1000) / 10).toFixed(1).replace('.', ',') + '%'; const rp = await x.page.evaluate(() => window.faPainelPrograma._estado().r); const leg = await x.page.$$eval('[data-pnl="evo-legenda"] [data-pnl="evo-leg"]', (l) => l.map((e) => e.textContent.trim())); ok('C evolução: nenhum rótulo dentro do gráfico; legenda abaixo com os cinco itens e os valores do núcleo', !(await x.page.$('.pnl-evo text')) || !(await x.page.$$eval('.pnl-evo text', (l) => l.some((e) => /Com |Planejadas/.test(e.textContent)))), leg) ; ok('C evolução: legenda = núcleo (projeção com inscritos e interessados)', leg.length === 5 && leg[0] === 'Realizado ' + pc(rp.realizou, rp.N) && leg[1] === 'Com inscritos e interessados ' + pc(rp.realizou + rp.comVaga, rp.N) && leg[2] === 'Planejadas ' + pc(rp.realizou + rp.maxPlanejado, rp.N) && leg[3] === 'Com as que cabem ' + pc(rp.realizou + rp.maxExpansao, rp.N) && /^100% do público/.test(leg[4]), leg); const caixas = await x.page.$$eval('[data-pnl="evo-leg"]', (els) => els.map((e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; })); ok('C evolução: itens da legenda sem sobreposição', !caixas.some((p, i) => caixas.some((q, j) => j > i && p[0] < q[2] && q[0] < p[2] && p[1] < q[3] && q[1] < p[3])), caixas); }
  }
  await x.page.click('#painelConteudo a.avp-voltar-link[href="#painel"]'); await x.page.waitForTimeout(250);
  ok('C voltar leva à visão executiva', !!(await x.page.$('[data-pnl="bloco-cobertura"]')));
  /* G: o que parece clicável leva a algum lugar — o nome da diretoria nos Gaps e os cartões de Decisões necessárias */
  {
    const rp = await x.page.evaluate(() => window.faPainelPrograma._estado().r);
    const naTela = (sel) => x.page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const b = e.getBoundingClientRect(); return b.bottom > 0 && b.top < innerHeight; }, sel);
    const links = await x.page.$$eval('[data-pnl="bloco-gaps"] [data-pnl-dir] a.pnl-gp-link', (l) => l.map((a) => a.getAttribute('href')));
    ok('G1 nos Gaps, o nome de cada diretoria é link para as gerências dela (o total não)', links.length === rp.diretorias.length && links.every((h) => /^#painel\?v=diretorias&d=[^&]+&de=bloco-gaps$/.test(h)) && !(await x.page.$('[data-pnl="gaps-total"] a')) && /Toque na sigla para ver as gerências/.test(await texto(x.page, '[data-pnl="gaps-exemplo"]')), links);
    const ultimo = await x.page.$$eval('[data-pnl="bloco-gaps"] [data-pnl-dir] a.pnl-gp-link', (l) => l[l.length - 1].textContent);
    const linksGap = await x.page.$$('[data-pnl="bloco-gaps"] [data-pnl-dir] a.pnl-gp-link');
    await linksGap[linksGap.length - 1].click();
    await x.page.waitForTimeout(400);
    const ab = await x.page.evaluate((n) => { const tr = [...document.querySelectorAll('tr[data-pnl-dir-nome]')].find((t) => t.getAttribute('data-pnl-dir-nome') === n); if (!tr) return { tr: false }; const b = tr.querySelector('[data-pnl-abrir]'), i = b && b.getAttribute('data-pnl-abrir'), r = tr.getBoundingClientRect(); return { exp: b && b.getAttribute('aria-expanded'), ger: [...document.querySelectorAll('tr.pnl-ger[data-pnl-ger="' + i + '"]')].length > 0 && [...document.querySelectorAll('tr.pnl-ger[data-pnl-ger="' + i + '"]')].every((g) => !g.hidden), visivel: r.top >= 0 && r.bottom <= innerHeight, h1: document.querySelector('#painelConteudo h1').textContent, outras: document.querySelectorAll('[data-pnl-abrir][aria-expanded="true"]').length }; }, ultimo);
    ok('G2 tocar na diretoria abre Diretorias e áreas com ela aberta (gerências à vista, só ela) e rola até ela', ab.h1 === 'Diretorias e áreas' && ab.exp === 'true' && ab.ger && ab.visivel && ab.outras === 1, Object.assign({ ultimo }, ab));
    await foto(x.page, rotulo.slice(0, 3) + '-gaps-diretoria-aberta');
    const volta = await x.page.getAttribute('#painelConteudo a.avp-voltar-link', 'href');
    await x.page.click('#painelConteudo a.avp-voltar-link'); await x.page.waitForTimeout(400);
    ok('G3 "← Voltar ao painel" devolve ao cartão de Gaps, não ao topo', volta === '#painel?foco=bloco-gaps' && await naTela('[data-pnl="bloco-gaps"]') && !!(await x.page.$('[data-pnl="bloco-cobertura"]')), volta);
    const dec = await x.page.$$eval('[data-pnl-decisao]', (l) => l.map((li) => { const a = li.querySelector('a.pnl-decisao-link'); return { t: li.getAttribute('data-pnl-decisao'), href: a ? a.getAttribute('href') : null, ir: (li.querySelector('.pnl-decisao-ir') || {}).textContent || '', tagCor: getComputedStyle(li.querySelector('.pnl-tag')).color }; }));
    ok('G4 cada decisão é um cartão-link para a consulta dela, com a etiqueta "Ver … →"; a categoria fica neutra (não ciano)', dec.length > 0 && dec.every((d) => d.href && /^#painel\?v=(capacidade|mobilizacao|ausencias)(&foco=[a-z-]+)?&de=bloco-decisoes$/.test(d.href) && /^Ver .+ →$/.test(d.ir) && d.tagCor !== 'rgb(122, 240, 232)'), dec);
    for (let i = 0; i < dec.length; i++) {
      const v = /v=([a-z]+)/.exec(dec[i].href)[1], foco = (/foco=([a-z-]+)/.exec(dec[i].href) || [])[1];
      await x.page.evaluate((i) => document.querySelectorAll('[data-pnl-decisao] a.pnl-decisao-link')[i].scrollIntoView({ block: 'center' }), i);
      await x.page.click('[data-pnl-decisao]:nth-child(' + (i + 1) + ') a.pnl-decisao-link'); await x.page.waitForTimeout(400);
      const h1 = await texto(x.page, '#painelConteudo h1');
      ok('G5 decisão "' + dec[i].t + '" leva a ' + v + (foco ? ' e mostra o bloco ' + foco : ''), h1 === ({ capacidade: 'Capacidade e calendário', mobilizacao: 'Mobilização', ausencias: 'Ausências e registros de presença' })[v] && (!foco || await naTela('[data-pnl="' + foco + '"]')), { h1, foco });
      await x.page.click('#painelConteudo a.avp-voltar-link'); await x.page.waitForTimeout(400);
      ok('G6 voltar da decisão "' + dec[i].t + '" devolve às Decisões', await naTela('[data-pnl="bloco-decisoes"]'));
    }
    const pvG = await verificarTela(x.page, { escopo: '#page-painel', largura: ctxOpts.viewport.width, focos: 0 });
    ok('G7 padrão visual da visão executiva com os links novos', !pvG.length, pvG.slice(0, 3));
  }
  ok('L2 nenhum erro de JavaScript (admin)', !x.erros.length, x.erros);
  await x.ctx.close();

  /* A: convidado */
  db = banco();
  x = await abrir(browser, ctxOpts, { db, user: user(CONV) }, '#painel');
  await esperarPainel(x);
  ok('A3 convidado vê o painel com os mesmos números', (await texto(x.page, '[data-pnl="realizou"]')) === String(esperado(db).realizou));
  ok('A4 convidado não vê o ADMIN', await x.page.evaluate(() => document.getElementById('navAdmin').hidden));
  await x.page.evaluate(() => { location.hash = '#painel?v=mobilizacao'; }); await x.page.waitForTimeout(250);
  await x.page.evaluate(() => { location.hash = '#painel?v=diretorias'; }); await x.page.waitForTimeout(250);
  ok('A4c convidado em Diretorias: só números (sem nomes nem botão de nomes; gerências pequenas agrupadas)', !(await x.page.$('[data-pnl-nomes], .pnl-nomes-lista')) && (await x.page.$$('tr.pnl-ger')).length > 0);
  await x.page.evaluate(() => { location.hash = '#painel?v=mobilizacao'; }); await x.page.waitForTimeout(250);
  ok('A4b convidado não vê o botão de exportar com nomes nem "Ver as pessoas" na Mobilização', !(await x.page.$('[data-pnl="exportar"]')) && !(await x.page.$('[data-pnl-ver], [data-pnl="mob-lista"]')) &&!!(await x.page.$('[data-pnl="bloco-gaps"], #painelConteudo h1')));
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
  /* sugestões das pessoas cadastradas ao digitar (nome ou e-mail); escolher preenche os dois campos, sem gravar */
  await x.page.fill('#pnlaConvNome', 'p1');
  { const sug = await x.page.$$eval('#pnlaConvSug:not([hidden]) [data-sug]', (l) => l.map((e) => e.getAttribute('data-sug')));
    await x.page.click('#pnlaConvSug [data-sug="p12_previ_com_br"]');
    const nome = await x.page.inputValue('#pnlaConvNome'), email = await x.page.inputValue('#pnlaConvEmail'), fechou = await x.page.$eval('#pnlaConvSug', (u) => u.hidden);
    await x.page.fill('#pnlaConvEmail', 'p13'); const porEmail = await x.page.$$eval('#pnlaConvSug:not([hidden]) [data-sug]', (l) => l.map((e) => e.getAttribute('data-sug'))); await x.page.press('#pnlaConvEmail', 'Escape');
    ok('D0 convidado: ao digitar, sugere quem tem conta no site (pelo nome ou e-mail); escolher preenche nome e e-mail e não grava nada', sug.includes('p1_previ_com_br') && sug.includes('p12_previ_com_br') && sug.length <= 8 && nome === 'P12' && email === 'p12@previ.com.br' && fechou && JSON.stringify(porEmail) === '["p13_previ_com_br"]' && await x.page.$eval('#pnlaConvSug', (u) => u.hidden) &&await x.page.evaluate(() => !(window.__CFG.db['fa-painel-convidados'] || {})['p12_previ_com_br']), { sug, nome, email, fechou, porEmail }); }
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
  await x.page.fill('#pnlaCompTotal', '592'); await x.page.fill('#pnlaCompInativa', '6'); await x.page.fill('#pnlaCompCargo', '72'); await x.page.fill('#pnlaMargem', '4'); await x.page.fill('#pnlaOcupacao', '70'); await x.page.fill('#pnlaFacDisp', '2'); await x.page.fill('#pnlaFacTec', '1'); await x.page.fill('#pnlaFacGes', '2'); await x.page.fill('#pnlaFacAberta', '2');
  ok('D3b sem base importada, a conta pede a base (não inventa número)', /Importe a base oficial/.test(await texto(x.page, '#pnlaCompConta')));
  await x.page.click('#pnlaSalvarCfg'); await x.page.waitForTimeout(500);
  ok('D3c total, situação não ativa, cargo não compatível e margem gravados', await x.page.evaluate(() => { const c = window.__CFG.db['programa-config']; return c.margem === 4 && c.ocupacaoEsperada === 70 && c.facilitacao && c.facilitacao.disponiveis === 2 && c.facilitacao.gestores === 2 && c.facilitacao.aberta === 2 && c.composicao && c.composicao.total === 592 && c.composicao.situacaoInativa === 6 && c.composicao.cargoIncompativel === 72; }));
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
  /* D10: baixar a base vigente — é o que o painel usa, no formato do importador; baixar e importar de novo não muda ninguém */
  await x.page.waitForSelector('#pnlaBaixarBase', { timeout: 8000 });
  ok('D10 a base vigente diz de qual arquivo veio', /arquivo base-painel-teste\.xlsx \(26 linhas\)/.test(await texto(x.page, '[data-pnla="base-vigente"]')), await texto(x.page, '[data-pnla="base-vigente"]'));
  {
    const [dl] = await Promise.all([x.page.waitForEvent('download', { timeout: 15000 }), x.page.click('#pnlaBaixarBase')]);
    const baixado = path.join(require('os').tmpdir(), 'base-painel-baixada.xlsx'); await dl.saveAs(baixado);
    const wbB = XLSX.read(fs.readFileSync(baixado), { type: 'buffer' }), aba = wbB.SheetNames[0], m = XLSX.utils.sheet_to_json(wbB.Sheets[aba], { header: 1, defval: '' });
    const p0 = m.find((l) => l[1] === 'p0@previ.com.br'), p5 = m.find((l) => l[1] === 'p5@previ.com.br');
    ok('D11 o arquivo baixado tem a 1ª aba no formato do importador, com as 25 pessoas da versão vigente e o nível de cada uma', /^base-oficial-versao-1-\d{4}-\d{2}-\d{2}\.xlsx$/.test(dl.suggestedFilename()) && aba === 'publico alvo' && JSON.stringify(m[0]) === JSON.stringify(['ANNOME', 'ANEMAIL', 'GERENCIA', 'DIRETORIA', 'nivel']) && m.length === 26 && p0 && p0[4] === 'diretor' && p5 && p5[4] === 'tecnico' && wbB.SheetNames[1] === 'Sobre esta base' && /Arquivo gerado: versão 1, 25 pessoas/.test(await texto(x.page, '#pnlaBaixarMsg')), { nome: dl.suggestedFilename(), aba, n: m.length, cab: m[0] });
    const antes = await x.page.evaluate(() => (window.__ESCRITAS || []).length);
    await x.page.setInputFiles('#pnlaArquivo', baixado);
    await x.page.waitForSelector('[data-pnla="previa"]', { timeout: 10000 });
    const pvB = await texto(x.page, '[data-pnla="previa"]');
    ok('D12 importar o arquivo baixado: prévia com as mesmas 25 pessoas, ninguém entra, sai ou muda, e nada gravado sem confirmar', /Pessoas válidas\s*25/.test(pvB) && /0 entram, 0 saem, 0 mudam/.test(pvB) && await x.page.evaluate((a) => (window.__ESCRITAS || []).length === a, antes), pvB.slice(0, 400));
    await x.page.click('#pnlaDescartar');
  }
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
  await gapsGrandes(browser, 'Desktop', { viewport: { width: 1366, height: 900 } });
  await gapsGrandes(browser, 'Celular (375 px)', Object.assign({}, devices['iPhone 12'], { viewport: { width: 375, height: 800 } }));
  await admin(browser, { viewport: { width: 1366, height: 900 } });
  await admin(browser, Object.assign({}, devices['iPhone 12'], { viewport: { width: 375, height: 800 } }));
  await browser.close();
  console.log('\n' + oks + ' ok, ' + falhas + ' falha(s)');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
