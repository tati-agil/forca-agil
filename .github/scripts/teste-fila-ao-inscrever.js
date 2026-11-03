/* Lista de espera ao pôr alguém numa turma (ADMIN › Eventos): o ＋ Participante (Interessada ou Inscrita) e o Confirmar
 * avisam em qual lista de espera a pessoa está e oferecem tirá-la de lá na mesma gravação — marcada a fila do MESMO evento
 * da turma, desmarcada a de outro evento. E a linha da lista de espera tem um botão só ("Tirar da lista"), dentro da
 * célula da tabela. Firebase falso, desktop e 375 px. (O lote pelo Público restrito é provado em teste-admin-excecao-portas.)
 *
 * O QUE ELE EXIGE:
 *   1. ＋ Participante como Interessada de quem espera por dois eventos: a caixa lista as duas filas, a do evento da turma
 *      marcada e a do outro desmarcada ("outro evento"); confirmar grava a entrada e tira SÓ a fila marcada, com
 *      movedToTurma, movedToStatus e quem fez — a do outro evento continua;
 *   2. Confirmar a inscrição de quem espera pelo mesmo evento: a pergunta traz a fila marcada e a saída vai junto (Inscrita);
 *   3. Confirmar desmarcando a fila: inscreve e a fila não é tocada;
 *   4. ＋ Participante de quem não está em fila nenhuma: grava direto, sem caixa a mais (como antes);
 *   5. leitura da fila que falha: a caixa avisa, a entrada grava e a fila não é tocada;
 *   6. linha da lista de espera: um botão só, "Tirar da lista", sem seletor de turma, dentro da célula (que continua célula
 *      de tabela) — o motivo "Vai para uma turma" marca o destino "Outra turma";
 *   7. 375 px: a caixa com as filas cabe na tela e grava igual; nenhum erro de JavaScript. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ADM = 'adm@previ.com.br';
const P = { dupla: 'dupla.fila@previ.com.br', conf: 'conf.fila@previ.com.br', mant: 'mantem.fila@previ.com.br', sem: 'sem.fila@previ.com.br', falha: 'falha.fila@previ.com.br' };
const NOMES = { dupla: 'DUPLA FILA', conf: 'CONF FILA', mant: 'MANTEM FILA', sem: 'SEM FILA', falha: 'FALHA FILA' };
const fila = (k, ev, data) => ({ name: NOMES[k], email: P[k], area: 'GECAT', date: data, removed: false, eventoKey: ev });
const int = (k) => ({ name: NOMES[k], email: P[k], area: 'GECAT', status: 'interessado', date: '2026-09-01T10:00:00.000Z', removed: false });

function banco() {
  const users = { [chave(ADM)]: { name: 'ADMIN', email: ADM, area: 'INFOR' } };
  Object.keys(P).forEach((k) => { users[chave(P[k])] = { name: NOMES[k], email: P[k], area: 'GECAT' }; });
  return {
    'fa-users': users, 'fa-admins': { [chave(ADM)]: { email: ADM, name: 'ADMIN' } }, 'fa-diretores': {}, 'fa-facilitadores': {}, 'fa-gerentes': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {},
    'fa-espera': {
      [chave(P.dupla)]: { 'lista:evA': fila('dupla', 'evA', '2026-08-05T09:00:00.000Z'), 'lista:evB': fila('dupla', 'evB', '2026-08-07T09:00:00.000Z') },
      [chave(P.conf)]: { 'lista:evA': fila('conf', 'evA', '2026-08-06T09:00:00.000Z') },
      [chave(P.mant)]: { 'lista:evA': fila('mant', 'evA', '2026-08-08T09:00:00.000Z') },
      [chave(P.falha)]: { 'lista:evA': fila('falha', 'evA', '2026-08-09T09:00:00.000Z') }
    },
    eventos: {
      evA: { nome: 'EPISÓDIO A – O COMEÇO', order: 1, publicado: true, cargaHoraria: '12', esperaAtiva: true },
      evB: { nome: 'EPISÓDIO B – A SEQUÊNCIA', order: 2, publicado: true, cargaHoraria: '8', esperaAtiva: true }
    },
    turmas: {
      tA1: { label: 'Turma 1', eventoKey: 'evA', order: 1, dias: ['2027-11-10'] },
      tA2: { label: 'Turma 2', eventoKey: 'evA', order: 2, dias: ['2027-11-24'] },
      tB1: { label: 'Turma 1', eventoKey: 'evB', order: 3, dias: ['2027-12-01'] }
    },
    'turmas-interesse': { tA2: { [chave(P.conf)]: int('conf') }, tA1: { [chave(P.mant)]: int('mant') } },
    'turmas-interesse-log': {}, 'turmas-config': {},
    'turmas-checkin': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {},
    avaliacoes: {}, pedidos: {}, holocron: {}
  };
}

const lerNo = (page, no) => page.evaluate((n) => firebase.database().ref(n).once('value').then((s) => s.val()), no);
const gravou = (page, prefixo) => page.evaluate((p) => (window.__ESCRITAS || []).some((e) => e.path.indexOf(p) === 0), prefixo);

async function prepararPagina(ctx) {
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(), user: { email: ADM, emailVerified: true, uid: 'u-adm' }, delayDefault: 15 }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  await esperarCondicao(page, () => Array.from(document.querySelectorAll('.admin-tab-btn')).some((x) => /Eventos/i.test(x.textContent)), null, { limite: 15000, descricao: 'aba Eventos' });
  await page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Eventos/i.test(x.textContent)).click());
  await esperarCondicao(page, () => !!document.querySelector('#turma-card-tA1') && !!document.querySelector('.ev-espera-section'), null, { limite: 15000, descricao: 'os cards e a lista de espera' });
  return { page, erros };
}

/* ＋ Participante pelo menu ⋯ da turma (o card mora no corpo recolhido do evento) */
async function participante(page, tk, busca, status) {
  await page.evaluate((k) => { const c = document.getElementById('turma-card-' + k); const ev = c.closest('[data-ev-key]'); const ic = ev && ev.querySelector('.ev-toggle-icon');
    if (c.offsetParent === null && ic) ic.click(); }, tk);
  await page.waitForSelector('#turma-card-' + tk + ' .taa-more-btn', { timeout: 10000 });
  await page.click('#turma-card-' + tk + ' .taa-more-btn');
  await page.evaluate((k) => { Array.from(document.querySelectorAll('#turma-card-' + k + ' .taa-dropdown button')).find((b) => /Participante/.test(b.textContent)).click(); }, tk);
  await page.waitForSelector('#addPartSearch', { timeout: 10000 });
  await page.fill('#addPartSearch', busca);
  await page.waitForSelector('#addPartResults li', { timeout: 10000 });
  await page.click('#addPartResults li');
  await page.selectOption('#addPartStatus', status);
  await page.click('.modal-box .admin-modal-add-btn');
}
async function confirmar(page, tk, email) {
  await esperarCondicao(page, (a) => !!document.querySelector('#turma-card-' + a.t + ' .cf-confirm-btn[data-ekey="' + a.k + '"]'), { t: tk, k: chave(email) }, { limite: 15000, descricao: 'o Confirmar de ' + email });
  await page.evaluate((a) => document.querySelector('#turma-card-' + a.t + ' .cf-confirm-btn[data-ekey="' + a.k + '"]').click(), { t: tk, k: chave(email) });
}
/* a caixa de confirmação com as filas: o que ela mostra */
async function caixaDasFilas(page) {
  await esperarCondicao(page, () => !!document.querySelector('.modal-box .fila-pessoa'), null, { limite: 10000, descricao: 'a caixa com as filas' });
  return page.evaluate(() => {
    const box = document.querySelector('.modal-box .fila-pessoa').closest('.modal-box');
    return { txt: box.textContent, filas: Array.from(box.querySelectorAll('.fila-sair')).map((c) => ({ txt: c.closest('label').textContent, marcada: c.checked })) };
  });
}
const confirmarCaixa = (page) => page.evaluate(() => document.querySelector('.modal-box .fila-pessoa').closest('.modal-box').querySelector('.admin-modal-confirm-btn').click());
const semCaixas = (page) => esperarCondicao(page, () => !document.querySelector('.modal-overlay:not([hidden])'), null, { limite: 10000, descricao: 'a tela sem caixas' });

(async () => {
  const browser = await chromium.launch();
  let falhas = 0, oks = 0;
  const anota = (r, ok, d) => { if (ok) { oks++; console.log('  ok    ' + r); } else { falhas++; console.error('  FALHA ' + r + (d ? ' — ' + d : '')); } };
  try {
    /* ── DESKTOP ─────────────────────────────────────────────────────────── */
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const { page, erros } = await prepararPagina(ctx);

    /* 6. a linha da fila */
    const linha = await page.evaluate((n) => {
      const tr = Array.from(document.querySelectorAll('.ev-espera-section tr')).find((x) => x.textContent.indexOf(n) !== -1);
      const td = tr.querySelector('td:last-child'), bt = Array.from(td.querySelectorAll('button')), r = td.getBoundingClientRect(), rb = bt[0] && bt[0].getBoundingClientRect();
      return { botoes: bt.map((b) => b.textContent.trim()), selects: td.querySelectorAll('select').length, display: getComputedStyle(td).display,
        dentro: !!rb && rb.left >= r.left - 1 && rb.right <= r.right + 1 };
    }, NOMES.conf);
    anota('6. linha da fila: um botão só ("Tirar da lista"), sem seletor, dentro da célula de tabela',
      linha.botoes.length === 1 && /Tirar da lista/.test(linha.botoes[0]) && linha.selects === 0 && linha.display === 'table-cell' && linha.dentro, JSON.stringify(linha));
    await page.evaluate((n) => { const tr = Array.from(document.querySelectorAll('.ev-espera-section tr')).find((x) => x.textContent.indexOf(n) !== -1);
      tr.querySelector('td:last-child button').click(); }, NOMES.conf);
    await esperarCondicao(page, () => !!document.querySelector('.modal-box .mov-destino'), null, { limite: 8000, descricao: 'a caixa "Tirar da lista"' });
    const marca = await page.evaluate(() => { const box = document.querySelector('.modal-box .mov-destino').closest('.modal-box');
      const m = box.querySelector('select.admin-motivo-select:not(.mov-turma-select)'); m.value = 'movida_turma'; m.dispatchEvent(new Event('change'));
      const r = box.querySelector('input[name="movDestino"]:checked'); const t = box.textContent; box.querySelector('.admin-modal-cancel-btn').click(); return { destino: r && r.value, pergunta: /Tirar CONF FILA da lista de espera/.test(t) }; });
    anota('6. o motivo "Vai para uma turma" marca "Outra turma"; a pergunta diz "Tirar … da lista de espera"', marca.destino === 'turma' && marca.pergunta, JSON.stringify(marca));
    await semCaixas(page);

    /* 1. ＋ Participante de quem espera por dois eventos */
    await participante(page, 'tA1', 'DUPLA', 'interessado');
    const c1 = await caixaDasFilas(page);
    const fA = c1.filas.find((f) => /EPISÓDIO A/.test(f.txt)), fB = c1.filas.find((f) => /EPISÓDIO B/.test(f.txt));
    anota('1. a caixa lista as duas filas: a do evento da turma marcada, a do outro desmarcada ("outro evento")',
      c1.filas.length === 2 && fA && fA.marcada && fB && !fB.marcada && /outro evento/.test(fB.txt) && /05\/08\/2026/.test(fA.txt) && /como Interessada em "Turma 1"/.test(c1.txt), JSON.stringify(c1));
    await confirmarCaixa(page);
    await esperarCondicao(page, (k) => (window.__ESCRITAS || []).some((e) => e.path.indexOf('turmas-interesse/tA1/' + k) === 0), chave(P.dupla), { limite: 10000, descricao: 'a entrada de DUPLA' });
    const r1 = await lerNo(page, 'turmas-interesse/tA1/' + chave(P.dupla)), a1 = await lerNo(page, 'fa-espera/' + chave(P.dupla));
    anota('1. grava a entrada e tira SÓ a fila marcada (movedToTurma, situação, quem); a do outro evento continua',
      r1 && r1.status === 'interessado' && a1['lista:evA'].removed === true && a1['lista:evA'].movedToTurma === 'tA1' && a1['lista:evA'].movedToStatus === 'interessado' &&
      a1['lista:evA'].removedByName === 'ADMIN' && a1['lista:evB'].removed === false, JSON.stringify({ r1, a1 }));
    await semCaixas(page);

    /* 2. Confirmar de quem espera pelo mesmo evento */
    await confirmar(page, 'tA2', P.conf);
    const c2 = await caixaDasFilas(page);
    anota('2. Confirmar: a pergunta traz a fila do mesmo evento, marcada', c2.filas.length === 1 && c2.filas[0].marcada && /Confirmar/.test(c2.txt), JSON.stringify(c2));
    await confirmarCaixa(page);
    await esperarCondicao(page, (k) => (window.__ESCRITAS || []).some((e) => e.path === 'fa-espera/' + k + '/lista:evA/removed'), chave(P.conf), { limite: 10000, descricao: 'a saída da fila de CONF' });
    const r2 = await lerNo(page, 'turmas-interesse/tA2/' + chave(P.conf)), a2 = await lerNo(page, 'fa-espera/' + chave(P.conf) + '/lista:evA');
    anota('2. inscreve e tira da fila na mesma gravação (como Inscrita)', r2.status === 'inscrito' && !!r2.confirmedByAdmin && a2.removed === true && a2.movedToTurma === 'tA2' && a2.movedToStatus === 'inscrito', JSON.stringify({ r2, a2 }));
    await semCaixas(page);

    /* 3. Confirmar desmarcando a fila */
    await confirmar(page, 'tA1', P.mant);
    await caixaDasFilas(page);
    await page.evaluate(() => { const c = document.querySelector('.modal-box .fila-sair'); c.checked = false; });
    await confirmarCaixa(page);
    await esperarCondicao(page, (k) => (window.__ESCRITAS || []).some((e) => e.path === 'turmas-interesse/tA1/' + k + '/confirmedByAdmin'), chave(P.mant), { limite: 10000, descricao: 'a confirmação de MANTEM' });
    const a3 = await lerNo(page, 'fa-espera/' + chave(P.mant) + '/lista:evA');
    anota('3. desmarcada: inscreve e a fila não é tocada', a3.removed === false && !(await gravou(page, 'fa-espera/' + chave(P.mant))), JSON.stringify(a3));
    await semCaixas(page);

    /* 4. quem não está em fila nenhuma: grava direto */
    await participante(page, 'tA1', 'SEM FILA', 'interessado');
    await esperarCondicao(page, (k) => (window.__ESCRITAS || []).some((e) => e.path.indexOf('turmas-interesse/tA1/' + k) === 0), chave(P.sem), { limite: 10000, descricao: 'a entrada de SEM FILA' });
    const caixaExtra = await page.evaluate(() => !!document.querySelector('.modal-box .fila-pessoa'));
    anota('4. sem fila: grava direto, sem caixa a mais', !caixaExtra && (await lerNo(page, 'turmas-interesse/tA1/' + chave(P.sem))).status === 'interessado');
    await semCaixas(page);

    /* 5. leitura da fila que falha */
    await page.evaluate((k) => { window.__CFG.fail = ['fa-espera/' + k]; }, chave(P.falha));
    await participante(page, 'tB1', 'FALHA', 'interessado');
    await esperarCondicao(page, () => Array.from(document.querySelectorAll('.modal-box')).some((b) => /Não consegui ler a lista de espera/.test(b.textContent)), null, { limite: 12000, descricao: 'o aviso da leitura' });
    await page.evaluate(() => Array.from(document.querySelectorAll('.modal-box')).filter((b) => /Não consegui ler a lista de espera/.test(b.textContent)).pop().querySelector('.admin-modal-confirm-btn').click());
    await esperarCondicao(page, (k) => (window.__ESCRITAS || []).some((e) => e.path.indexOf('turmas-interesse/tB1/' + k) === 0), chave(P.falha), { limite: 10000, descricao: 'a entrada de FALHA' });
    await page.evaluate(() => { window.__CFG.fail = []; });
    anota('5. leitura que falha: avisa, a entrada grava e a fila não é tocada',
      (await lerNo(page, 'turmas-interesse/tB1/' + chave(P.falha))).status === 'interessado' && !(await gravou(page, 'fa-espera/' + chave(P.falha))));
    anota('7. desktop: nenhum erro de JavaScript', !erros.length, erros.join(' | '));
    await ctx.close();

    /* ── 375 px ──────────────────────────────────────────────────────────── */
    const cel = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const m = await prepararPagina(cel);
    await participante(m.page, 'tA1', 'DUPLA', 'inscrito');
    await caixaDasFilas(m.page);
    const med = await m.page.evaluate(() => { const box = document.querySelector('.modal-box .fila-pessoa').closest('.modal-box'); const r = box.getBoundingClientRect();
      return { esq: r.left, dir: r.right, larg: window.innerWidth, rolaDentro: box.scrollWidth <= box.clientWidth + 1, pagina: document.documentElement.scrollWidth <= window.innerWidth + 1 }; });
    anota('7. 375 px: a caixa com as filas cabe na tela, sem rolagem lateral', med.esq >= 0 && med.dir <= med.larg && med.rolaDentro && med.pagina, JSON.stringify(med));
    await confirmarCaixa(m.page);
    await esperarCondicao(m.page, (k) => (window.__ESCRITAS || []).some((e) => e.path === 'fa-espera/' + k + '/lista:evA/removed'), chave(P.dupla), { limite: 10000, descricao: 'a saída da fila no celular' });
    const a7 = await lerNo(m.page, 'fa-espera/' + chave(P.dupla));
    anota('7. 375 px: grava igual (Inscrita, só a fila do mesmo evento)', a7['lista:evA'].movedToStatus === 'inscrito' && a7['lista:evB'].removed === false, JSON.stringify(a7));
    const linhaCel = await m.page.evaluate((n) => { const tr = Array.from(document.querySelectorAll('.ev-espera-section tr')).find((x) => x.textContent.indexOf(n) !== -1);
      return tr ? getComputedStyle(tr.querySelector('td:last-child')).display : 'sem linha'; }, NOMES.mant);
    anota('7. 375 px: a célula de ações continua célula de tabela', linhaCel === 'table-cell', linhaCel);
    anota('7. 375 px: nenhum erro de JavaScript', !m.erros.length, m.erros.join(' | '));
    await cel.close();
  } catch (e) {
    falhas++;
    console.error('  FALHA inesperada: ' + e.message);
  } finally {
    await browser.close();
  }
  console.log('\n' + oks + ' ok, ' + falhas + ' falha(s)');
  process.exit(falhas ? 1 : 0);
})();
