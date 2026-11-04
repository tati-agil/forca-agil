/* ADMIN › Cadastrados, menu ⋯: "Turmas e lista de espera" — onde a pessoa está agora. Só consulta. Firebase falso, desktop e 375 px.
 *
 * O QUE ELE EXIGE:
 *   1. lista as turmas ativas com evento, turma, datas e situação (Inscrita, Interessada, Inscrita sem confirmação; "turma
 *      realizada" quando for o caso), inclusive de eventos diferentes com o mesmo nome de turma;
 *   2. lista as filas de espera ativas, por evento, com a data de entrada;
 *   3. registro removido (de turma ou de fila) não aparece;
 *   4. quem não tem nada: "Não está em nenhuma turma nem na lista de espera";
 *   5. leitura que falha nunca vira "não está em nenhuma": avisa, e o que foi lido continua na tela; as ações continuam;
 *   6. nada é gravado ao abrir e fechar a caixa;
 *   7. 375 px: a caixa cabe na tela, sem rolagem lateral; nenhum erro de JavaScript. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ADM = 'adm@previ.com.br', COM = 'com.turmas@previ.com.br', NADA = 'sem.nada@previ.com.br', SOFILA = 'so.fila@previ.com.br';
const NOMES = { [ADM]: 'ADMIN', [COM]: 'COM TURMAS', [NADA]: 'SEM NADA', [SOFILA]: 'SO FILA' };
const reg = (e, x) => Object.assign({ name: NOMES[e], email: e, area: 'GECAT', status: 'interessado', removed: false, date: '2026-09-01T10:00:00.000Z' }, x || {});
const insc = { status: 'inscrito', confirmedByAdmin: ADM };

function banco() {
  const users = {};
  Object.keys(NOMES).forEach((e) => { users[chave(e)] = { name: NOMES[e], email: e, area: 'GECAT', createdAt: '2026-08-01T10:00:00.000Z' }; });
  const fila = (e, ev, data, x) => Object.assign({ name: NOMES[e], email: e, area: 'GECAT', date: data, removed: false, eventoKey: ev }, x || {});
  return {
    'fa-users': users, 'fa-admins': { [chave(ADM)]: { email: ADM, name: 'ADMIN' } }, 'fa-diretores': {}, 'fa-facilitadores': {}, 'fa-gerentes': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-contas-teste': {},
    'fa-espera': {
      [chave(COM)]: { 'lista:evA': fila(COM, 'evA', '2026-08-05T15:00:00.000Z'), 'lista:evB': fila(COM, 'evB', '2026-08-07T15:00:00.000Z', { removed: true }) },
      [chave(SOFILA)]: { 'lista:evB': fila(SOFILA, 'evB', '2026-08-09T15:00:00.000Z') }
    },
    eventos: {
      evA: { nome: 'EPISÓDIO A', order: 1, publicado: true, esperaAtiva: true },
      evB: { nome: 'EPISÓDIO B', order: 2, publicado: true, esperaAtiva: true }
    },
    turmas: {
      tA1: { label: 'Turma 1', eventoKey: 'evA', order: 1, dias: ['2027-11-10', '2027-11-12'] },
      tB1: { label: 'Turma 1', eventoKey: 'evB', order: 2, dias: ['2027-12-01'] },
      tB2: { label: 'Turma 2', eventoKey: 'evB', order: 3, dias: ['2027-12-08'] },
      tB3: { label: 'Turma 3', eventoKey: 'evB', order: 4, dias: ['2027-12-15'] },
      tVelha: { label: 'Turma Antiga', eventoKey: 'evA', order: 5, dias: ['2026-01-10'] }
    },
    'turmas-interesse': {
      tA1: { [chave(COM)]: reg(COM, insc) },
      tB1: { [chave(COM)]: reg(COM) },
      tB2: { [chave(COM)]: reg(COM, { removed: true, removedDate: '2026-09-10T10:00:00.000Z' }) },
      tB3: { [chave(COM)]: reg(COM, { status: 'inscrito' }) },
      tVelha: { [chave(COM)]: reg(COM, insc) }
    },
    'turmas-interesse-log': {}, 'turmas-config': { tVelha: { encerrada: true } }, 'turmas-checkin': {},
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {},
    avaliacoes: {}, pedidos: {}, holocron: {}
  };
}

async function abrir(browser, opt) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, opt || {}));
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(), user: { email: ADM, emailVerified: true, uid: 'u-adm' }, delayDefault: 15 }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  await esperarCondicao(page, () => Array.from(document.querySelectorAll('.admin-tab-btn')).some((x) => x.textContent.trim() === 'Cadastrados'), null, { limite: 15000, descricao: 'a aba Cadastrados' });
  await page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => x.textContent.trim() === 'Cadastrados').click());
  await esperarCondicao(page, () => !!document.querySelector('.cad-mais-btn'), null, { limite: 15000, descricao: 'a lista de cadastrados' });
  return { ctx, page, erros };
}
/* abre o ⋯ da pessoa e espera a consulta terminar; devolve as linhas e as mensagens */
async function vinculos(page, email) {
  await page.evaluate((k) => document.querySelector('.cad-mais-btn[data-key="' + k + '"]').click(), chave(email));
  await esperarCondicao(page, () => { const c = document.querySelector('.cad-acoes-modal .cad-vinculos-corpo'); return !!c && !/Carregando/.test(c.textContent); }, null, { limite: 12000, descricao: 'a consulta de ' + email });
  return page.evaluate(() => {
    const c = document.querySelector('.cad-acoes-modal .cad-vinculos-corpo');
    return { linhas: Array.from(c.querySelectorAll('li')).map((l) => l.textContent), msg: Array.from(c.querySelectorAll('.cad-vinculos-msg')).map((m) => m.textContent), acoes: document.querySelectorAll('.cad-acoes-modal .cad-acao-btn').length };
  });
}
const fechar = (page) => page.evaluate(() => document.querySelector('.cad-acoes-modal .admin-modal-cancel-btn').click());

(async () => {
  const browser = await chromium.launch();
  let falhas = 0, oks = 0;
  const anota = (r, ok, d) => { if (ok) { oks++; console.log('  ok    ' + r); } else { falhas++; console.error('  FALHA ' + r + (d ? ' — ' + d : '')); } };
  try {
    const A = await abrir(browser);
    const page = A.page;
    const antes = await page.evaluate(() => (window.__ESCRITAS || []).length);
    const v = await vinculos(page, COM);
    const tem = (re) => v.linhas.some((l) => re.test(l));
    anota('1. inscrita: evento, turma, datas e situação', tem(/EPISÓDIO A › Turma 1.*10 e 12 de novembro de 2027.*Inscrita$/), JSON.stringify(v.linhas));
    anota('1. interessada, com a mesma "Turma 1" em outro evento', tem(/EPISÓDIO B › Turma 1.*dezembro de 2027.*Interessada$/), JSON.stringify(v.linhas));
    anota('1. inscrita sem confirmação é dita como tal', tem(/EPISÓDIO B › Turma 3.*Inscrita sem confirmação$/), JSON.stringify(v.linhas));
    anota('1. turma realizada é sinalizada', tem(/Turma Antiga.*Inscrita · turma realizada$/), JSON.stringify(v.linhas));
    anota('2. lista de espera ativa, com a data', tem(/Lista de espera — EPISÓDIO A.*na fila desde 05\/08\/2026.*Na fila$/), JSON.stringify(v.linhas));
    anota('3. removido não aparece (turma nem fila)', !tem(/Turma 2/) && !tem(/Lista de espera — EPISÓDIO B/) && v.linhas.length === 5, JSON.stringify(v.linhas));
    anota('5. as ações continuam na caixa', v.acoes >= 3, String(v.acoes));
    await fechar(page);

    const so = await vinculos(page, SOFILA);
    anota('2. quem só está na fila: só a fila', so.linhas.length === 1 && /Lista de espera — EPISÓDIO B/.test(so.linhas[0]), JSON.stringify(so));
    await fechar(page);

    const n = await vinculos(page, NADA);
    anota('4. sem nada: a frase certa', !n.linhas.length && /Não está em nenhuma turma nem na lista de espera/.test(n.msg.join()), JSON.stringify(n));
    await fechar(page);

    anota('6. abrir e fechar a caixa não grava nada', (await page.evaluate(() => (window.__ESCRITAS || []).length)) === antes);

    /* 5. falhas de leitura */
    await page.evaluate((k) => { window.__CFG.fail = ['turmas-interesse/tB1/' + k]; }, chave(COM));
    const parcial = await vinculos(page, COM);
    anota('5. uma turma que falha: avisa que pode estar incompleta e mostra o resto', /incompleta/.test(parcial.msg.join()) && parcial.linhas.some((l) => /EPISÓDIO A › Turma 1/.test(l)), JSON.stringify(parcial));
    await fechar(page);
    await page.evaluate((k) => { window.__CFG.fail = ['fa-espera/' + k]; }, chave(NADA));
    const semFila = await vinculos(page, NADA);
    anota('5. fila que falha nunca vira "não está em nenhuma"', /lista de espera agora/.test(semFila.msg.join()) && !/nenhuma turma/.test(semFila.msg.join()), JSON.stringify(semFila));
    await fechar(page);
    await page.evaluate(() => { window.__CFG.fail = ['turmas']; });
    const semTurmas = await vinculos(page, NADA);
    anota('5. turmas que falham nunca viram "não está em nenhuma"; as ações continuam', /ler as turmas agora/.test(semTurmas.msg.join()) && !/nenhuma turma/.test(semTurmas.msg.join()) && semTurmas.acoes >= 3, JSON.stringify(semTurmas));
    await fechar(page);
    anota('7. desktop: nenhum erro de JavaScript', !A.erros.length, A.erros.join(' | '));
    await A.ctx.close();

    const C = await abrir(browser, { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const vc = await vinculos(C.page, COM);
    const med = await C.page.evaluate(() => { const b = document.querySelector('.cad-acoes-modal'), r = b.getBoundingClientRect();
      return { esq: r.left, dir: r.right, larg: window.innerWidth, dentro: b.scrollWidth <= b.clientWidth + 1, pagina: document.documentElement.scrollWidth <= window.innerWidth + 1 }; });
    anota('7. 375 px: a caixa cabe, sem rolagem lateral, com as mesmas linhas', vc.linhas.length === 5 && med.esq >= 0 && med.dir <= med.larg && med.dentro && med.pagina, JSON.stringify(med));
    anota('7. 375 px: nenhum erro de JavaScript', !C.erros.length, C.erros.join(' | '));
    if (process.env.FA_SHOT) await C.page.screenshot({ path: process.env.FA_SHOT });
    await C.ctx.close();
  } catch (e) {
    falhas++;
    console.error('  FALHA inesperada: ' + e.message);
  } finally {
    await browser.close();
  }
  console.log('\n' + oks + ' ok, ' + falhas + ' falha(s)');
  process.exit(falhas ? 1 : 0);
})();
