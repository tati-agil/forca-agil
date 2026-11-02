/* ADMIN › Certificados: a tela pertence SEMPRE à seleção atual — nunca mistura dados de turmas ou eventos diferentes.
 *
 * POR QUE ESTE TESTE EXISTE
 * Cada turma escolhida pede quatro leituras (evento, configuração, presenças, inscritos). Até 02/11/2026, escolher a turma
 * B antes de a turma A responder deixava o seletor em B e a tela com a lista, a data de conclusão e o "Baixar todos"
 * habilitado da A; com uma ordem de chegada desfavorável, participantes de uma turma com a conclusão da outra.
 *
 * Firebase falso, dados sintéticos, 1280 e 375 px. O QUE ELE EXIGE:
 *   1. turma A lenta e logo a turma B: durante o carregamento nada de lista, prévia ou "Baixar todos"; no fim, tudo é da B;
 *   2. outras ordens de chegada (B lenta; A com só a configuração atrasada, chegando no meio das leituras da B): no fim,
 *      tudo é da última escolhida — participantes, data de conclusão e "Baixar todos" (B aberta = indisponível);
 *   3. trocar de EVENTO enquanto uma turma carrega: nada da turma antiga aparece depois;
 *   4. leitura que falha: nenhuma lista, nenhum download, aviso; nada da seleção anterior reaproveitado;
 *   5. prévia atrasada (o desenho demora) e troca de turma no meio: a prévia antiga nunca aparece;
 *   6. prévia e download recebem EXATAMENTE os mesmos dados (a mesma composição, buildData);
 *   7. troca de conta com a prévia aberta (com a autorização lenta): a gerente nunca vê o painel, a lista ou a prévia;
 *   8. nada é gravado; sem erro de JS; sem rolagem lateral.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const ADM = 'admin.cs@previ.com.br', GER = 'gerente.cs@previ.com.br';
const PA = ['alfa.um@previ.com.br', 'alfa.dois@previ.com.br'], PB = ['beta.um@previ.com.br'], PC = ['gama.um@previ.com.br'];
const NOME = (e) => e.split('@')[0].replace('.', ' ').toUpperCase() + ' CS';
function dia(o) { const d = new Date(); d.setDate(d.getDate() + o); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
const insc = (lista) => Object.fromEntries(lista.map((e) => [chave(e), { name: NOME(e), email: e, area: 'TI', status: 'inscrito', confirmedByAdmin: ADM, removed: false, date: '2026-09-01T10:00:00.000Z' }]));
const pres = (d, lista) => ({ [d]: Object.fromEntries(lista.map((e) => [chave(e), { em: 'x' }])) });

function banco() {
  const users = {}; [ADM, GER].concat(PA, PB, PC).forEach((e) => { users[chave(e)] = { name: NOME(e), email: e, area: 'TI', emailConfirmado: true }; });
  return {
    'fa-users': users, 'fa-admins': { [chave(ADM)]: { email: ADM, name: NOME(ADM) } }, 'fa-gerentes': { [chave(GER)]: { email: GER, name: NOME(GER) } },
    'fa-diretores': {}, 'fa-outros-publicos': {}, 'fa-facilitadores': {}, 'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: { ev1: { nome: 'EVENTO UM CS', order: 1, publicado: true, cargaHoraria: 8 }, ev2: { nome: 'EVENTO DOIS CS', order: 2, publicado: true, cargaHoraria: 4 } },
    turmas: {
      tA: { label: 'TURMA A CS', eventoKey: 'ev1', order: 1, dias: [dia(-10)] },
      tB: { label: 'TURMA B CS', eventoKey: 'ev1', order: 2, dias: [dia(20)] },
      tC: { label: 'TURMA C CS', eventoKey: 'ev2', order: 1, dias: [dia(-5)] },
    },
    'turmas-interesse': { tA: insc(PA), tB: insc(PB), tC: insc(PC) },
    'turmas-config': { tA: { encerrada: true, finalizada: true, dataConclusao: '2026-10-05' }, tC: { encerrada: true, finalizada: true, dataConclusao: '2026-10-20' } },
    'turmas-checkin': { tA: pres(dia(-10), PA), tC: pres(dia(-5), PC) },
    'turmas-interesse-log': {}, 'turmas-sorteio': {}, 'turmas-equipe': {}, 'turmas-publico': {}, 'eventos-publico': {}, avaliacoes: {}, pedidos: {}, holocron: {},
  };
}
async function abrir(browser, vp, mob, rede, email) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: !!mob, hasTouch: !!mob });
  const page = await ctx.newPage(); const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify(Object.assign({ db: banco(), user: { email: email || ADM, emailVerified: true, uid: 'u-' + chave(email || ADM) }, delayDefault: 20 }, rede || {})) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await esperarCondicao(page, () => !!document.querySelector('#adminContent:not([hidden]) .admin-tab-btn[data-panel="adminPanelCert"]'), null, { limite: 15000, descricao: 'painel do ADMIN' });
  await page.click('.admin-tab-btn[data-panel="adminPanelCert"]');
  await esperarCondicao(page, () => document.querySelectorAll('#certEventoSelect option').length > 2, null, { descricao: 'eventos no seletor' });
  /* espiões: o que a prévia desenha e o que o download receberia (sem baixar arquivo) */
  await page.evaluate(() => {
    const c = window.faCertif; window.__desenhos = []; window.__downloads = []; window.__atrasoDraw = 0;
    window.__escritasBase = (window.__ESCRITAS || []).length;  /* a carga do ADMIN tem gravações próprias; contam só as de depois */
    const draw = c.draw;
    c.draw = function (canvas, data, scale) { window.__desenhos.push(JSON.parse(JSON.stringify(data))); const a = window.__atrasoDraw; return a ? new Promise((r) => setTimeout(r, a)).then(() => draw(canvas, data, scale)) : draw(canvas, data, scale); };
    c.download = function (data) { window.__downloads.push({ tipo: 'png', data: JSON.parse(JSON.stringify(data)) }); };
    c.downloadPDF = function (data) { window.__downloads.push({ tipo: 'pdf', data: JSON.parse(JSON.stringify(data)) }); };
  });
  return { ctx, page, erros };
}
function tela(page) {
  return page.evaluate(() => {
    const txt = (el) => ((el && el.textContent) || '').replace(/\s+/g, ' ').trim();
    const wrap = document.getElementById('certParticipantesWrap'), cv = document.getElementById('certPreviewCanvas');
    return {
      turma: document.getElementById('certTurmaSelect').value, evento: document.getElementById('certEventoSelect').value,
      listaVisivel: !!wrap && wrap.style.display !== 'none',
      titulo: txt(document.getElementById('certListTitle')), nomes: Array.from(document.querySelectorAll('#certParticipantesList .cert-p-name')).map(txt),
      info: txt(document.getElementById('certInfoDisplay')),
      lote: !document.getElementById('certBaixarTodos').disabled || !document.getElementById('certBaixarTodosPDF').disabled,
      previa: !!cv && cv.width > 0 && cv.height > 0,
      escritas: (window.__ESCRITAS || []).length - (window.__escritasBase || 0),
      largura: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
}
const so = (t, nomes) => t.nomes.length === nomes.length && nomes.every((n) => t.nomes.includes(n));
const nomesDe = (l) => l.map(NOME);

(async () => {
  const browser = await chromium.launch();
  let falhas = 0;
  const anota = (r, ok, d) => { if (ok) console.log('  ok    ' + r); else { falhas++; console.error('  FALHA ' + r + (d ? ' → ' + d : '')); } };
  const lentoA = { 'turmas-config/tA': 2500, 'turmas-checkin/tA': 2500, 'turmas-interesse/tA': 2500 };

  for (const [vp, mob, F] of [[{ width: 1280, height: 900 }, false, '1280'], [{ width: 375, height: 812 }, true, '375']]) {
    console.log('\n== ' + F + ' px ==');
    /* 1. A lenta → B */
    {
      const { ctx, page, erros } = await abrir(browser, vp, mob, { delays: lentoA });
      await page.selectOption('#certEventoSelect', 'ev1'); await page.selectOption('#certTurmaSelect', 'tA'); await page.waitForTimeout(150);
      await page.selectOption('#certTurmaSelect', 'tB');
      const durante = await tela(page);
      await page.waitForTimeout(3500);
      const fim = await tela(page);
      anota('1 @' + F + ': A lenta → B: durante o carregamento, nada da A (lista, prévia, "Baixar todos")', !durante.nomes.some((n) => /ALFA/.test(n)) && !durante.lote && !durante.previa, JSON.stringify(durante));
      anota('1 @' + F + ': quando a A responde, a tela continua toda da B (participantes, título, sem conclusão, lote indisponível)',
        fim.turma === 'tB' && so(fim, nomesDe(PB)) && /TURMA B CS/.test(fim.titulo) && !/Concluída/.test(fim.info) && !fim.lote, JSON.stringify(fim));
      anota('1 @' + F + ': sem gravação, sem erro de JS, sem rolagem lateral', !fim.escritas && !erros.length && !fim.largura, JSON.stringify({ erros, l: fim.largura }));
      await ctx.close();
    }
    /* 2a. B lenta: A rápida escolhida antes; B escolhida depois e lenta */
    {
      const { ctx, page } = await abrir(browser, vp, mob, { delays: { 'turmas-config/tB': 2000, 'turmas-interesse/tB': 2000 } });
      await page.selectOption('#certEventoSelect', 'ev1'); await page.selectOption('#certTurmaSelect', 'tA');
      await esperarCondicao(page, () => document.querySelectorAll('#certParticipantesList .cert-p-name').length === 2, null, { descricao: 'lista da A' });
      await page.selectOption('#certTurmaSelect', 'tB');
      const durante = await tela(page);
      await esperarCondicao(page, () => document.querySelectorAll('#certParticipantesList .cert-p-name').length === 1, null, { limite: 10000, descricao: 'lista da B' });
      const fim = await tela(page);
      anota('2 @' + F + ': A carregada → B lenta: a lista e o lote da A somem na hora; a B chega sozinha',
        !durante.nomes.length && !durante.lote && fim.turma === 'tB' && so(fim, nomesDe(PB)) && !fim.lote && !/Concluída/.test(fim.info), JSON.stringify({ durante, fim }));
      await ctx.close();
    }
    /* 2b. mistura: a configuração da A (encerrada, com conclusão) chega no meio das leituras da B */
    {
      const { ctx, page } = await abrir(browser, vp, mob, { delays: { 'turmas-config/tA': 1200, 'turmas-interesse/tB': 2200 } });
      await page.selectOption('#certEventoSelect', 'ev1'); await page.selectOption('#certTurmaSelect', 'tA'); await page.waitForTimeout(100);
      await page.selectOption('#certTurmaSelect', 'tB');
      await page.waitForTimeout(3200);
      const fim = await tela(page);
      anota('2 @' + F + ': configuração da A chegando no meio da B: a B não herda "encerrada" nem a data da A (lote indisponível)',
        fim.turma === 'tB' && so(fim, nomesDe(PB)) && !fim.lote && !/Concluída/.test(fim.info), JSON.stringify(fim));
      await ctx.close();
    }
    /* 3. troca de evento enquanto a turma carrega */
    {
      const { ctx, page } = await abrir(browser, vp, mob, { delays: lentoA });
      await page.selectOption('#certEventoSelect', 'ev1'); await page.selectOption('#certTurmaSelect', 'tA'); await page.waitForTimeout(150);
      await page.selectOption('#certEventoSelect', 'ev2');
      await page.waitForTimeout(3200);
      const fim = await tela(page);
      anota('3 @' + F + ': troca de evento com a turma A carregando: nada da A aparece depois (sem lista, sem lote)', !fim.listaVisivel && !fim.nomes.length && !fim.lote && fim.evento === 'ev2', JSON.stringify(fim));
      await page.selectOption('#certTurmaSelect', 'tC');
      await esperarCondicao(page, () => document.querySelectorAll('#certParticipantesList .cert-p-name').length === 1, null, { descricao: 'lista da C' });
      const c = await tela(page);
      anota('3 @' + F + ': a turma C do novo evento carrega inteira (lista, conclusão, lote disponível)', so(c, nomesDe(PC)) && /20 de outubro de 2026/.test(c.info) && c.lote, JSON.stringify(c));
      await ctx.close();
    }
    /* 4. leitura que falha, depois de uma seleção boa */
    {
      const { ctx, page } = await abrir(browser, vp, mob, { fail: ['turmas-checkin/tA'] });
      await page.selectOption('#certEventoSelect', 'ev2'); await page.selectOption('#certTurmaSelect', 'tC');
      await esperarCondicao(page, () => document.querySelectorAll('#certParticipantesList .cert-p-name').length === 1, null, { descricao: 'lista da C' });
      await page.selectOption('#certEventoSelect', 'ev1'); await page.selectOption('#certTurmaSelect', 'tA');
      await page.waitForTimeout(1500);
      const fim = await tela(page);
      anota('4 @' + F + ': leitura que falha: sem lista, sem download, aviso de falha; nada da turma C reaproveitado',
        !fim.nomes.length && !fim.lote && !fim.previa && /Não foi possível carregar/.test(fim.info) && !/20 de outubro/.test(fim.info), JSON.stringify(fim));
      await ctx.close();
    }
    /* 5 e 6. prévia atrasada + troca; prévia = download */
    {
      const { ctx, page, erros } = await abrir(browser, vp, mob);
      await page.selectOption('#certEventoSelect', 'ev1'); await page.selectOption('#certTurmaSelect', 'tA');
      await esperarCondicao(page, () => document.querySelectorAll('#certParticipantesList .cert-p-name').length === 2, null, { descricao: 'lista da A' });
      await page.evaluate(() => { window.__atrasoDraw = 1500; });
      await page.locator('.cert-participant-row').first().locator('.cert-btn-prev').click();
      await page.selectOption('#certTurmaSelect', 'tB');
      await page.waitForTimeout(2500);
      const t5 = await tela(page);
      anota('5 @' + F + ': prévia atrasada da A e troca para B: a prévia da A nunca aparece', !t5.previa, JSON.stringify(t5));
      await page.evaluate(() => { window.__atrasoDraw = 0; window.__desenhos = []; window.__downloads = []; });
      await page.selectOption('#certTurmaSelect', 'tA');
      await esperarCondicao(page, () => document.querySelectorAll('#certParticipantesList .cert-p-name').length === 2, null, { descricao: 'lista da A de novo' });
      const linha = page.locator('.cert-participant-row').first();
      await linha.locator('.cert-btn-prev').click();
      await esperarCondicao(page, () => { const c = document.getElementById('certPreviewCanvas'); return c.width > 0; }, null, { descricao: 'prévia desenhada' });
      await linha.locator('.cert-btn-dl').first().click();
      await linha.locator('.cert-btn-dl').nth(1).click();
      const r = await page.evaluate(() => ({ d: window.__desenhos, w: window.__downloads }));
      anota('6 @' + F + ': prévia e downloads (PNG e PDF) recebem exatamente os mesmos dados, todos da turma A',
        r.d.length === 1 && r.w.length === 2 && r.w.every((x) => JSON.stringify(x.data) === JSON.stringify(r.d[0])) && r.d[0].identificacaoTurma === 'TURMA A CS' && /5 de outubro de 2026/.test(r.d[0].dataEmissao),
        JSON.stringify(r));
      const t6 = await tela(page);
      anota('5/6 @' + F + ': sem gravação, sem erro de JS', !t6.escritas && !erros.length, JSON.stringify(erros));
      await ctx.close();
    }
    /* 7. troca de conta com a prévia aberta e a autorização da gerente lenta */
    {
      const { ctx, page, erros } = await abrir(browser, vp, mob, { delays: { ['fa-admins/' + chave(GER)]: 4000 } });
      await page.selectOption('#certEventoSelect', 'ev1'); await page.selectOption('#certTurmaSelect', 'tA');
      await esperarCondicao(page, () => document.querySelectorAll('#certParticipantesList .cert-p-name').length === 2, null, { descricao: 'lista da A' });
      await page.locator('.cert-participant-row').first().locator('.cert-btn-prev').click();
      await page.evaluate(() => window.faAuth.logout());
      await esperarCondicao(page, () => !window.faAuth.getSession(), null, { descricao: 'saiu' });
      await page.evaluate((e) => firebase.auth().signInWithEmailAndPassword(e, 'x'), GER);
      await page.evaluate(() => { location.hash = '#admin'; });
      let viu = false;
      for (let i = 0; i < 12; i++) {
        await page.waitForTimeout(450);
        viu = viu || await page.evaluate(() => { const vis = (el) => !!el && el.offsetParent !== null; return vis(document.getElementById('adminContent')) || vis(document.getElementById('certParticipantesList')) || vis(document.getElementById('certPreviewCanvas')); });
      }
      const hash = await page.evaluate(() => location.hash);
      anota('7 @' + F + ': gerente na mesma aba (autorização lenta): nunca vê o painel, a lista ou a prévia, e sai de #admin', !viu && hash === '#home', JSON.stringify({ viu, hash }));
      anota('7 @' + F + ': sem erro de JS', !erros.length, JSON.stringify(erros));
      await ctx.close();
    }
  }
  await browser.close();
  if (falhas) { console.error('\n' + falhas + ' falha(s).'); process.exit(1); }
  console.log('\nTudo certo.');
})().catch((e) => { console.error(e); process.exit(1); });
