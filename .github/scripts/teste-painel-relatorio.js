/* Painel do Programa › Relatório de pessoas (#painel?v=relatorio) — a tela de verdade, com o Firebase falso.
 *
 * POR QUE ESTE TESTE EXISTE
 * O relatório escolhe eventos do programa e situações e lista as pessoas com nome e e-mail. Duas coisas não podem falhar:
 * a situação tem de ser a do painel, só que olhando SÓ os eventos marcados (decisão da dona, nov/2026), e os nomes são só
 * do admin geral. Desktop e celular (375 px). Exige:
 *   S. núcleo: com todos os eventos marcados, a situação de cada pessoa é exatamente a do painel; com um evento só, cada
 *      pessoa tem a situação esperada naquele evento (quem realizou o outro evento não conta como realizado neste);
 *   T. tela: contagens por situação = núcleo; desmarcar um evento refaz as contagens; escolher situações filtra a lista;
 *      nenhum evento ou nenhuma situação diz o que falta; a escolha sobrevive a "Atualizar dados";
 *   X. Excel: abas Relatório e Filtros, com as mesmas pessoas da tela;
 *   A. acesso: o convidado não vê o link nem os nomes;
 *   L. nenhuma rolagem lateral, padrão visual e nenhum erro de JavaScript.
 */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { verificarTela } = require('./padrao-visual-verificacoes');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const ADM = 'adm@previ.com.br', CONV = 'convidado@previ.com.br';

const ctxN = { window: {}, console }; vm.createContext(ctxN);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'publicos-nucleo.js'), 'utf8'), ctxN);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'turmas-util.js'), 'utf8'), ctxN);
const NUC = require(path.join(RAIZ, 'programa-cobertura-nucleo.js'));

function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function util(desloc) { const d = new Date(); d.setDate(d.getDate() + desloc); while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1); return iso(d); }
const HOJE = iso(new Date());

/* Dois eventos do programa (evT e evG) e um fora dele (evX):
   P0..P3 realizaram evT (turma ta); P0 também tem interesse e P1 inscrição em evG (g1); P4 inscrita e P5 interessada em
   evT (tf); P6 realizou evG (g0); P7 cadastrada sem nada; P8 sem cadastro; P9 só tem interesse no evento fora do programa. */
function banco() {
  const A1 = util(-40), A2 = util(-39), F1 = util(12), F2 = util(13);
  const pessoas = {}, users = {}, interesse = { ta: {}, tf: {}, g0: {}, g1: {}, x1: {} }, checkin = { ta: { [A1]: {}, [A2]: {} }, g0: { [A1]: {} } };
  const conf = (e) => ({ status: 'inscrito', confirmedByAdmin: ADM, email: e }), inter = (e) => ({ status: 'interessado', email: e });
  for (let i = 0; i < 10; i++) {
    const e = 'p' + i + '@previ.com.br', k = chave(e);
    pessoas[k] = { email: e, nome: 'Pessoa ' + i, gerencia: 'G' + (i % 2), diretoria: i < 5 ? 'DIRA' : 'DIRB' };
    if (i !== 8) users[k] = { email: e, name: 'Pessoa ' + i };
    if (i <= 3) { interesse.ta[k] = conf(e); checkin.ta[A1][k] = true; checkin.ta[A2][k] = true; }
    if (i === 0) interesse.g1[k] = inter(e);
    if (i === 1) interesse.g1[k] = conf(e);
    if (i === 4) interesse.tf[k] = conf(e);
    if (i === 5) interesse.tf[k] = inter(e);
    if (i === 6) { interesse.g0[k] = conf(e); checkin.g0[A1][k] = true; }
    if (i === 9) interesse.x1[k] = inter(e);
  }
  users[chave(ADM)] = { email: ADM, name: 'ADM' }; users[chave(CONV)] = { email: CONV, name: 'CONV' };
  return {
    'fa-users': users, 'fa-admins': { [chave(ADM)]: { email: ADM, name: 'ADM' } }, 'fa-diretores': {}, 'fa-facilitadores': {}, 'fa-gerentes': {}, 'fa-espera': {}, 'fa-progress': {}, 'fa-progress-historico': {}, 'fa-reset-signal': {},
    'fa-painel-convidados': { [chave(CONV)]: { email: CONV, name: 'CONVIDADO', addedAt: '2026-11-01T00:00:00.000Z', addedBy: ADM } },
    'publicos-config': { ativo: true },
    eventos: { evT: { nome: 'Oficina Técnicos', vagasPorTurma: 10, percentualMinimo: 75, order: 1 }, evG: { nome: 'Oficina Gestores', vagasPorTurma: 10, percentualMinimo: 75, order: 2 }, evX: { nome: 'Evento fora do programa', order: 3 } },
    turmas: {
      ta: { label: 'Turma A', eventoKey: 'evT', dias: [A1, A2], horarioInicio: '09:00', horarioFim: '13:00' }, tf: { label: 'Turma F', eventoKey: 'evT', dias: [F1, F2], horarioInicio: '09:00', horarioFim: '13:00' },
      g0: { label: 'Turma G0', eventoKey: 'evG', dias: [A1], horarioInicio: '14:00', horarioFim: '17:00' }, g1: { label: 'Turma G1', eventoKey: 'evG', dias: [F1], horarioInicio: '14:00', horarioFim: '17:00' },
      x1: { label: 'Turma X', eventoKey: 'evX', dias: [F2], horarioInicio: '14:00', horarioFim: '17:00' } },
    'turmas-config': { ta: { encerrada: true, dataConclusao: A2 }, g0: { encerrada: true, dataConclusao: A1 } }, 'turmas-interesse': interesse, 'turmas-interesse-log': {}, 'turmas-checkin': checkin,
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {}, avaliacoes: {}, pedidos: {}, holocron: {},
    'programa-config': { prazo: util(40), eventos: { evT: true, evG: true }, antecedenciaDiasUteis: 3, limiteParalelo: { tecnicos: 2, gestores: 1 }, ocupacaoEsperada: 70 },
    'programa-calendario': {}, 'programa-config-auditoria': {},
    'programa-publico-alvo': { vigente: 1, versoes: { 1: { importadaEm: 1, importadaPor: ADM, total: 10, origem: 'teste', pessoas } } }
  };
}
function calcular(db) {
  const v = db['programa-publico-alvo'], ver = v.versoes[v.vigente];
  return NUC.calcular({ hoje: HOJE, eventos: db.eventos, turmas: db.turmas, config: db['turmas-config'], interesse: db['turmas-interesse'], checkin: db['turmas-checkin'], users: db['fa-users'],
    gerentes: db['fa-gerentes'], diretores: db['fa-diretores'], eventosPublico: {}, turmasPublico: {}, publicosAtivo: true, programa: db['programa-config'], calendario: {},
    base: { versao: 1, pessoas: ver.pessoas } }, ctxN.window.faTurmasUtil, ctxN.window.faPublicosNucleo);
}
const SITS = ['realizou', 'inscrita', 'interessada', 'sem-engajamento', 'sem-cadastro'];
function contagens(r, evs) { const c = {}; SITS.forEach((s) => { c[s] = 0; }); r.lista.forEach((p) => { c[NUC.situacaoNosEventos(p, evs).situacao]++; }); return c; }

let oks = 0, falhas = 0;
const ok = (n, c, d) => { if (c) { oks++; console.log('  ok    ' + n); } else { falhas++; console.error('  FALHA ' + n + (d !== undefined ? ' — ' + JSON.stringify(d) : '')); } };
const foto = async (page, nome) => { if (process.env.FA_FOTOS) await page.screenshot({ path: path.join(process.env.FA_FOTOS, nome + '.png'), fullPage: true }); };
const semRolagem = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/* S: núcleo, sem navegador */
function nucleo() {
  console.log('\n== Núcleo ==');
  const r = calcular(banco()), sit = (evs) => Object.fromEntries(r.lista.map((p) => [p.nome, NUC.situacaoNosEventos(p, evs).situacao]));
  ok('S1 todos os eventos marcados: a situação de cada pessoa é exatamente a do painel', r.lista.every((p) => NUC.situacaoNosEventos(p, ['evT', 'evG']).situacao === p.situacao), r.lista.map((p) => [p.nome, p.situacao]));
  ok('S2 eventos do programa no resultado, na ordem do site, sem o evento de fora', JSON.stringify(r.eventosPrograma.map((e) => [e.key, e.nome, e.turmas])) === JSON.stringify([['evT', 'Oficina Técnicos', 2], ['evG', 'Oficina Gestores', 2]]));
  const g = sit(['evG']);
  ok('S3 só a Oficina Gestores: quem realizou a de Técnicos aparece pela situação que tem na de Gestores',
    g['Pessoa 0'] === 'interessada' && g['Pessoa 1'] === 'inscrita' && g['Pessoa 2'] === 'sem-engajamento' && g['Pessoa 6'] === 'realizou' && g['Pessoa 4'] === 'sem-engajamento' && g['Pessoa 8'] === 'sem-cadastro', g);
  const t = sit(['evT']);
  ok('S4 só a Oficina Técnicos: realizou, inscrita e interessada dela; o evento de fora do programa não conta',
    t['Pessoa 0'] === 'realizou' && t['Pessoa 4'] === 'inscrita' && t['Pessoa 5'] === 'interessada' && t['Pessoa 6'] === 'sem-engajamento' && t['Pessoa 9'] === 'sem-engajamento', t);
  const p0 = r.lista.find((p) => p.nome === 'Pessoa 0');
  ok('S5 as turmas devolvidas são só as da situação nos eventos escolhidos', JSON.stringify(NUC.situacaoNosEventos(p0, ['evG']).turmas) === '["Turma G1"]' && JSON.stringify(NUC.situacaoNosEventos(p0, ['evT', 'evG']).turmas) === '["Turma A"]');
  ok('S6 nenhum evento escolhido: só cadastro decide (sem engajamento ou sem cadastro)', NUC.situacaoNosEventos(p0, []).situacao === 'sem-engajamento');
}

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
const lerTela = (page) => page.evaluate(() => {
  const c = {}; document.querySelectorAll('[data-pnl-rel-sit]').forEach((b) => { const m = /\((\d+)\)/.exec(b.textContent); c[b.getAttribute('data-pnl-rel-sit')] = m ? +m[1] : null; });
  return { cont: c, nomes: [...document.querySelectorAll('[data-pnl="rel-lista"] li')].map((l) => l.firstChild.textContent).sort(),
    contagem: ((document.querySelector('[data-pnl="rel-contagem"]') || {}).textContent || '').trim(),
    marcados: [...document.querySelectorAll('[data-pnl-rel-ev]')].filter((x) => x.checked).map((x) => x.getAttribute('data-pnl-rel-ev')) };
});

async function rodada(browser, rotulo, ctxOpts) {
  console.log('\n== ' + rotulo + ' ==');
  const db = banco(), r = calcular(db), pref = rotulo.slice(0, 3);
  let x = await abrir(browser, ctxOpts, { db, user: user(ADM) }, '#painel');
  await x.page.waitForSelector('[data-pnl="bloco-cobertura"]', { timeout: 15000 });
  ok('A1 admin vê o link "Relatório de pessoas" nas consultas', await x.page.$$eval('.pnl-consultas a', (l) => l.some((a) => /Relatório de pessoas/.test(a.textContent) && /v=relatorio/.test(a.getAttribute('href')))));
  await x.page.click('.pnl-consultas a[href*="v=relatorio"]');
  await x.page.waitForSelector('[data-pnl="relatorio"]', { timeout: 8000 });
  let t = await lerTela(x.page), esp = contagens(r, ['evT', 'evG']);
  ok('T1 abre com todos os eventos marcados e todas as situações; contagens = núcleo', JSON.stringify(t.marcados) === '["evT","evG"]' && SITS.every((s) => t.cont[s] === esp[s]) && t.cont.todas === r.lista.length, [t.cont, esp]);
  ok('T2 lista com todas as pessoas do público', t.nomes.length === r.lista.length && /10 pessoas/.test(t.contagem), t.contagem);
  await foto(x.page, pref + '-relatorio-todos');
  /* desmarcar a Oficina Técnicos */
  await x.page.click('[data-pnl-rel-ev="evT"]'); await x.page.waitForTimeout(100);
  t = await lerTela(x.page); esp = contagens(r, ['evG']);
  ok('T3 desmarcar um evento refaz as contagens (só a Oficina Gestores)', JSON.stringify(t.marcados) === '["evG"]' && SITS.every((s) => t.cont[s] === esp[s]) && esp.realizou === 1, [t.cont, esp]);
  ok('T4 o foco continua na caixa do evento depois de desmarcar', await x.page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-pnl-rel-ev') === 'evT'));
  /* escolher situações: só Interessada, depois + Inscrita */
  await x.page.click('[data-pnl-rel-sit="interessada"]'); await x.page.waitForTimeout(100);
  t = await lerTela(x.page);
  ok('T5 com "Todas" ligado, tocar numa situação mostra só ela', JSON.stringify(t.nomes) === '["Pessoa 0"]' && await x.page.getAttribute('[data-pnl-rel-sit="interessada"]', 'aria-pressed') === 'true' && await x.page.getAttribute('[data-pnl-rel-sit="todas"]', 'aria-pressed') === 'false', t.nomes);
  await x.page.click('[data-pnl-rel-sit="inscrita"]'); await x.page.waitForTimeout(100);
  t = await lerTela(x.page);
  ok('T6 tocar em outra situação soma à escolha', JSON.stringify(t.nomes) === '["Pessoa 0","Pessoa 1"]', t.nomes);
  const linha = await x.page.$eval('[data-pnl="rel-lista"] li[data-sit="inscrita"]', (l) => l.textContent);
  ok('T7 cada pessoa mostra a situação, a gerência e a turma nos eventos escolhidos', /Inscrita/.test(linha) && /G1/.test(linha) && /Turma G1/.test(linha), linha);
  await foto(x.page, pref + '-relatorio-filtrado');
  /* X: o Excel sai da mesma lista */
  const pl = await x.page.evaluate(() => window.faPainelPrograma._relatorio());
  ok('X1 Excel: abas Relatório e Filtros, com as mesmas pessoas da tela e os filtros usados', pl && pl.map((a) => a.nome).join() === 'Relatório,Filtros' && JSON.stringify(pl[0].linhas.map((l) => l[0]).sort()) === JSON.stringify(t.nomes) &&
    pl[1].linhas[0][1] === 'Oficina Gestores' && pl[1].linhas[1][1] === 'Inscrita; Interessada', pl && pl[1].linhas);
  const [dl] = await Promise.all([x.page.waitForEvent('download', { timeout: 15000 }), x.page.click('[data-pnl="rel-exportar"]')]);
  ok('X2 o botão baixa o arquivo do relatório', /^painel-relatorio-pessoas-\d{4}-\d{2}-\d{2}\.xlsx$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  /* a escolha sobrevive a "Atualizar dados" */
  await x.page.click('[data-pnl="atualizar"]');
  await x.page.waitForFunction(() => { const b = document.querySelector('[data-pnl="atualizar"]'); return b && b.textContent.trim() === 'Atualizar dados'; }, null, { timeout: 8000 });
  t = await lerTela(x.page);
  ok('T8 eventos e situações escolhidos continuam depois de "Atualizar dados"', JSON.stringify(t.marcados) === '["evG"]' && JSON.stringify(t.nomes) === '["Pessoa 0","Pessoa 1"]');
  /* nenhum evento / nenhuma situação */
  await x.page.click('[data-pnl-rel-todos="nao"]'); await x.page.waitForTimeout(100);
  ok('T9 "Desmarcar todos": diz para marcar pelo menos um evento, sem lista', /Marque pelo menos um evento/.test((await lerTela(x.page)).contagem) && !(await x.page.$('[data-pnl="rel-lista"]')));
  await x.page.click('[data-pnl-rel-todos="sim"]'); await x.page.waitForTimeout(100);
  await x.page.click('[data-pnl-rel-sit="inscrita"]'); await x.page.click('[data-pnl-rel-sit="interessada"]'); await x.page.waitForTimeout(100);
  ok('T10 sem nenhuma situação escolhida: diz para escolher uma', /Escolha pelo menos uma situação/.test((await lerTela(x.page)).contagem));
  await x.page.click('[data-pnl-rel-sit="todas"]'); await x.page.waitForTimeout(100);
  ok('T11 "Todas" volta a mostrar todo o público', (await lerTela(x.page)).nomes.length === r.lista.length);
  ok('L1 sem rolagem lateral', await semRolagem(x.page));
  const pv = await verificarTela(x.page, { escopo: '#page-painel', largura: ctxOpts.viewport.width, focos: 0 });
  ok('L2 padrão visual (cor de link, contraste, um amarelo por cartão, rolagem)', !pv.length, pv.slice(0, 3));
  ok('L3 nenhum erro de JavaScript', !x.erros.length, x.erros);
  await x.ctx.close();
  /* A: convidado */
  x = await abrir(browser, ctxOpts, { db: banco(), user: user(CONV) }, '#painel');
  await x.page.waitForSelector('[data-pnl="bloco-cobertura"]', { timeout: 15000 });
  ok('A2 convidado não vê o link do relatório', !(await x.page.$('.pnl-consultas a[href*="v=relatorio"]')));
  await x.page.evaluate(() => { location.hash = '#painel?v=relatorio'; }); await x.page.waitForTimeout(300);
  const txt = await x.page.$eval('#painelConteudo', (el) => el.innerText);
  ok('A3 convidado no endereço do relatório: nenhum nome, só o aviso', /só da administração geral/.test(txt) && !/Pessoa \d/.test(txt));
  ok('A4 nenhum erro de JavaScript (convidado)', !x.erros.length, x.erros);
  await x.ctx.close();
}

(async () => {
  nucleo();
  const browser = await chromium.launch();
  await rodada(browser, 'Desktop', { viewport: { width: 1366, height: 900 } });
  await rodada(browser, 'Celular (375 px)', Object.assign({}, devices['iPhone 12'], { viewport: { width: 375, height: 800 } }));
  await browser.close();
  console.log('\n' + oks + ' ok, ' + falhas + ' falha(s)');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
