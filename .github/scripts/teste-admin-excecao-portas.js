/* ADMIN — as quatro portas que põem alguém numa turma (＋ Participante, Confirmar, Mover da fila, "Adicionar à turma" em
 * lote) decidem igual, e a EXCEÇÃO autorizada pelo admin.
 *
 * POR QUE ESTE TESTE EXISTE
 * Público-alvo não é o conjunto de participantes: um evento de Gerentes recebe, legitimamente, um assessor convidado ou um
 * técnico no lugar de um gerente; um evento só de diretores, quem substitui um diretor. Antes, o painel ou recusava sem
 * saída (＋ Participante, Confirmar, Mover) ou deixava passar calado (o lote não conferia participação nem "uma turma").
 * Agora: a mesma avaliação nas quatro portas; quem as regras barram só entra COMO EXCEÇÃO, com motivo obrigatório, e o
 * registro daquela turma leva excecaoAdmin { regras, motivo, por, porNome, em, turma }. A exceção não muda cadastro,
 * público nem acesso de ninguém.
 *
 * Firebase falso, dados 100% sintéticos. O QUE ELE EXIGE (1280 e 375 px):
 *   1. gerente entra normalmente num evento de Gerentes — sem pedido de exceção, sem excecaoAdmin;
 *   2. assessor (fora de Gerentes) incluído por ＋ Participante: o painel diz a regra e pede o motivo; sem motivo (ou curto
 *      demais), nada é gravado; com motivo, grava a exceção { cargo };
 *   3. técnico substituindo gerente — Confirmar de um interesse antigo: exceção { cargo } gravada junto com a confirmação;
 *   4. substituto de diretor — Mover da fila para turma de evento só de diretores: exceção { diretores };
 *   5. lote: as mesmas regras da porta individual (cargo e participação anterior); um motivo para o grupo, cada registro
 *      com as próprias regras dispensadas; quem passa entra sem exceção;
 *   6. painel: selo "Exceção autorizada" (com motivo), sem "Fora do público atual" para o que ela cobre; selo "Fora das
 *      regras do evento" num interesse antigo que contraria a participação anterior; participantes históricos (turma
 *      realizada, fora do público, sem exceção) sem selo e intocados;
 *   7. nada fora de turmas-interesse, turmas-interesse-log e fa-espera é gravado; o Auth não recebe nada além do login
 *      (nenhuma senha, conta, e-mail de login, cadastro, admin, gerente ou diretor muda);
 *   8. 375 px: o pedido de exceção cabe na tela; no Público restrito, nome e "Remover" na mesma célula, e a confirmação da
 *      remoção diz nome e e-mail; sem erro de JS, sem rolagem lateral.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
function dia(o) { const d = new Date(); d.setDate(d.getDate() + o); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

const ADM = 'tatianefdirene@previ.com.br';
const P = {
  ger: 'gerente.ex@previ.com.br', ass: 'assessor.ex@previ.com.br', tec: 'tecnica.substituta.ex@previ.com.br', sub: 'substituto.diretor.ex@previ.com.br',
  ger2: 'gerente.dois.ex@previ.com.br', ass2: 'assessora.dois.ex@previ.com.br', part: 'ja.participou.ex@previ.com.br', leg: 'legado.ex@previ.com.br',
  h1: 'historico.um.ex@previ.com.br', h2: 'historico.dois.ex@previ.com.br',
};
const nome = (e) => e.split('@')[0].toUpperCase().replace(/\./g, ' ');
const reg = (e, extra) => Object.assign({ name: nome(e), email: e, area: 'TI', date: '2026-10-01T10:00:00.000Z', removed: false, status: 'interessado' }, extra || {});
const insc = (e) => reg(e, { status: 'inscrito', confirmedByAdmin: ADM, confirmedByAdminName: 'ADMIN', confirmedDate: '2026-09-02T10:00:00.000Z', addedByAdmin: true });
const ev = (n, order, extra) => Object.assign({ nome: n, order, publicado: true, esperaAtiva: false }, extra || {});
const tu = (label, eventoKey, order, dias, extra) => Object.assign({ label, eventoKey, order, dias, horarioInicio: '09:00', horarioFim: '12:00' }, extra || {});

function banco() {
  const users = {}; Object.values(P).concat([ADM]).forEach((e) => { users[chave(e)] = { name: nome(e), email: e, area: 'TI', emailConfirmado: true }; });
  return {
    'fa-users': users, 'fa-admins': {},
    'fa-gerentes': { [chave(P.ger)]: { email: P.ger, name: nome(P.ger) }, [chave(P.ger2)]: { email: P.ger2, name: nome(P.ger2) }, [chave(P.part)]: { email: P.part, name: nome(P.part) } },
    'fa-diretores': {}, 'fa-outros-publicos': {}, 'fa-facilitadores': {}, 'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {},
    'fa-espera': { [chave(P.sub)]: { 'lista:evD': { name: nome(P.sub), email: P.sub, area: 'TI', date: '2026-10-05T10:00:00.000Z', removed: false, eventoKey: 'evD' } } },
    eventos: {
      evG: ev('EVENTO DE GERENTES SINT', 1, { publicoDesc: 'Gerentes', bloqueiaParticipantesDe: { evAnt: true } }),
      evD: ev('EVENTO SO DIRETORES SINT', 2, { restritoADiretores: true, esperaAtiva: true }),
      evAnt: ev('EVENTO ANTERIOR SINT', 3),
      evHist: ev('EVENTO HISTORICO SINT', 4, { publicoDesc: 'Gerentes' }),
    },
    turmas: {
      tG: tu('G TURMA', 'evG', 1, [dia(20)]), tG2: tu('G TURMA LISTA', 'evG', 2, [dia(22)], { publicoRestrito: true }),
      tD: tu('D TURMA', 'evD', 1, [dia(25)]), tAnt: tu('ANTERIOR', 'evAnt', 1, [dia(-30)]), tHist: tu('HISTORICA', 'evHist', 1, [dia(-60)]),
    },
    'turmas-config': { tHist: { encerrada: true, dataConclusao: dia(-59) } },
    'turmas-interesse': {
      tG: { [chave(P.tec)]: reg(P.tec), [chave(P.leg)]: reg(P.leg) },
      tAnt: { [chave(P.part)]: insc(P.part), [chave(P.leg)]: insc(P.leg) },
      tHist: { [chave(P.h1)]: insc(P.h1), [chave(P.h2)]: insc(P.h2) },
    },
    'turmas-publico': { tG2: { [chave(P.ger2)]: { email: P.ger2, name: nome(P.ger2) }, [chave(P.ass2)]: { email: P.ass2, name: nome(P.ass2) }, [chave(P.part)]: { email: P.part, name: nome(P.part) } } },
    'eventos-publico': {}, 'turmas-interesse-log': {}, 'turmas-checkin': {}, 'turmas-sorteio': {}, 'turmas-equipe': {}, avaliacoes: {}, pedidos: {}, holocron: {},
  };
}
const antes = banco();

async function abrir(browser, vp, mob) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: !!mob, hasTouch: !!mob });
  const page = await ctx.newPage(); const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(), user: { email: ADM, emailVerified: true, uid: 'adm' }, delayDefault: 20 }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await esperarCondicao(page, () => Array.from(document.querySelectorAll('.admin-tab-btn')).some((x) => /Eventos/i.test(x.textContent)), null, { limite: 15000, descricao: 'aba Eventos' });
  await page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Eventos/i.test(x.textContent)).click());
  await esperarCondicao(page, () => !!document.querySelector('#turma-card-tG') && !!document.querySelector('#turma-card-tHist'), null, { limite: 15000, descricao: 'os cards das turmas' });
  return { ctx, page, erros };
}
const lerNo = (page, no) => page.evaluate((n) => firebase.database().ref(n).once('value').then((s) => s.val()), no);
const escritas = (page) => page.evaluate(() => (window.__ESCRITAS || []).map((e) => e.path).filter((p) => !/^roteiro-tipos-atividade$|^treinamentos\/[^/]+$/.test(p)));
async function menuTurma(page, tk, re) {
  await page.evaluate((k) => { const c = document.getElementById('turma-card-' + k); const ev = c.closest('[data-ev-key]'); const ic = ev && ev.querySelector('.ev-toggle-icon');
    if (c.offsetParent === null && ic) ic.click(); }, tk);
  await page.waitForSelector('#turma-card-' + tk + ' .taa-more-btn', { timeout: 10000 });
  await page.click('#turma-card-' + tk + ' .taa-more-btn');
  await page.evaluate(([k, src]) => { Array.from(document.querySelectorAll('#turma-card-' + k + ' .taa-dropdown button')).find((b) => new RegExp(src).test(b.textContent)).click(); }, [tk, re.source]);
}
async function participante(page, tk, busca) {
  await menuTurma(page, tk, /Participante/);
  await page.waitForSelector('#addPartSearch', { timeout: 10000 });
  await page.fill('#addPartSearch', busca);
  await page.waitForSelector('#addPartResults li', { timeout: 10000 });
  await page.click('#addPartResults li');
  await page.selectOption('#addPartStatus', 'interessado');
  await page.click('.modal-box .admin-modal-add-btn');
}
const modalExc = (page) => esperarCondicao(page, () => !!document.querySelector('[data-pedido-excecao]'), null, { limite: 10000, descricao: 'o pedido de exceção' });
async function excecao(page, motivo) {
  await modalExc(page);
  await page.fill('[data-pedido-excecao] .admin-excecao-motivo', motivo);
  await page.click('[data-pedido-excecao] .admin-excecao-confirm-btn');
}
/* confirma, em ordem, os modais de confirmação comuns que aparecerem até a gravação esperada */
async function confirmarAte(page, caminho) {
  for (let i = 0; i < 6; i++) {
    if (await page.evaluate((c) => (window.__ESCRITAS || []).some((e) => e.path === c || e.path.indexOf(c + '/') === 0), caminho)) return;
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.modal-overlay .modal-box')).reverse().find((x) => x.querySelector('.admin-modal-confirm-btn') && x.offsetParent !== null);
      if (b) b.querySelector('.admin-modal-confirm-btn').click(); });
    await page.waitForTimeout(500);
  }
}

(async () => {
  const browser = await chromium.launch();
  let falhas = 0, oks = 0;
  const anota = (r, ok, d) => { if (ok) { oks++; console.log('  ok    ' + r); } else { falhas++; console.error('  FALHA ' + r + (d ? ' — ' + d : '')); } };
  try {
    console.log('\n== 1280 px ==');
    const { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, false);
    /* 1. gerente: entra sem exceção */
    await participante(page, 'tG', 'GERENTE EX');
    await esperarCondicao(page, (k) => (window.__ESCRITAS || []).some((e) => e.path === 'turmas-interesse/tG/' + k), chave(P.ger), { limite: 10000, descricao: 'a gravação do gerente' });
    const g = await lerNo(page, 'turmas-interesse/tG/' + chave(P.ger));
    anota('1. gerente entra num evento de Gerentes sem pedido de exceção e sem excecaoAdmin', !!g && !g.excecaoAdmin && !(await page.$('[data-pedido-excecao]')), JSON.stringify(g));

    /* 2. assessor: pede a exceção; sem motivo nada é gravado; com motivo, exceção { cargo } */
    await participante(page, 'tG', 'ASSESSOR EX');
    await modalExc(page);
    const txt2 = await page.evaluate(() => document.querySelector('[data-pedido-excecao]').textContent);
    await page.click('[data-pedido-excecao] .admin-excecao-confirm-btn');
    await page.fill('[data-pedido-excecao] .admin-excecao-motivo', 'abc');
    await page.click('[data-pedido-excecao] .admin-excecao-confirm-btn');
    const erroMotivo = await page.evaluate(() => (document.querySelector('[data-pedido-excecao] .admin-motivo-erro') || {}).textContent || '');
    anota('2. o pedido diz a regra (lista de Gerentes) e recusa sem motivo ou com motivo curto, sem gravar',
      /lista de Gerentes/.test(txt2) && /pelo menos 5/.test(erroMotivo) && !(await escritas(page)).some((p) => p.indexOf('turmas-interesse/tG/' + chave(P.ass)) === 0), txt2.slice(0, 160));
    await page.fill('[data-pedido-excecao] .admin-excecao-motivo', 'Assessor convidado pela diretoria');
    await page.click('[data-pedido-excecao] .admin-excecao-confirm-btn');
    await esperarCondicao(page, (k) => (window.__ESCRITAS || []).some((e) => e.path === 'turmas-interesse/tG/' + k), chave(P.ass), { limite: 10000, descricao: 'a gravação do assessor' });
    const a = await lerNo(page, 'turmas-interesse/tG/' + chave(P.ass));
    const exA = a && a.excecaoAdmin;
    anota('2. com motivo: o registro leva excecaoAdmin { regras: cargo, motivo, por, porNome, em, turma }',
      !!exA && JSON.stringify(exA.regras) === JSON.stringify({ cargo: true }) && exA.motivo === 'Assessor convidado pela diretoria' && exA.por === ADM && exA.turma === 'tG' && !!exA.em && !!exA.porNome, JSON.stringify(a));

    /* 3. técnico substituindo gerente — Confirmar */
    await esperarCondicao(page, (k) => !!document.querySelector('#turma-card-tG .cf-confirm-btn[data-ekey="' + k + '"]'), chave(P.tec), { limite: 15000, descricao: 'o Confirmar da técnica' });
    await page.evaluate((k) => document.querySelector('#turma-card-tG .cf-confirm-btn[data-ekey="' + k + '"]').click(), chave(P.tec));
    await excecao(page, 'Substitui o gerente que não pôde participar');
    await confirmarAte(page, 'turmas-interesse/tG/' + chave(P.tec) + '/status');
    await esperarCondicao(page, (k) => (window.__ESCRITAS || []).some((e) => e.path === 'turmas-interesse/tG/' + k + '/excecaoAdmin'), chave(P.tec), { limite: 10000, descricao: 'a exceção da técnica' });
    const t = await lerNo(page, 'turmas-interesse/tG/' + chave(P.tec));
    anota('3. técnico substituindo gerente: Confirmar grava a inscrição com a exceção { cargo }',
      t.status === 'inscrito' && !!t.confirmedByAdmin && JSON.stringify((t.excecaoAdmin || {}).regras) === JSON.stringify({ cargo: true }) && /Substitui o gerente/.test(t.excecaoAdmin.motivo), JSON.stringify(t));

    /* 4. substituto de diretor — Mover da fila */
    await esperarCondicao(page, (e) => Array.from(document.querySelectorAll('tr')).some((tr) => tr.textContent.indexOf(e) !== -1 && /Mover para turma/.test(tr.textContent)), nome(P.sub), { limite: 15000, descricao: 'a linha da fila' });
    await page.evaluate((e) => { const tr = Array.from(document.querySelectorAll('tr')).find((x) => x.textContent.indexOf(e) !== -1 && /Mover para turma/.test(x.textContent));
      const sel = tr.querySelector('select'); sel.value = 'tD'; sel.dispatchEvent(new Event('change'));
      Array.from(tr.querySelectorAll('button')).find((b) => /Mover para turma/.test(b.textContent)).click(); }, nome(P.sub));
    await confirmarAte(page, '__nada__');
    await excecao(page, 'Substitui o diretor na turma');
    await confirmarAte(page, 'turmas-interesse/tD/' + chave(P.sub));
    await esperarCondicao(page, (k) => (window.__ESCRITAS || []).some((e) => e.path === 'turmas-interesse/tD/' + k), chave(P.sub), { limite: 10000, descricao: 'a gravação do substituto' });
    const sd = await lerNo(page, 'turmas-interesse/tD/' + chave(P.sub));
    anota('4. substituto de diretor: Mover da fila grava com a exceção { diretores }',
      sd && sd.status === 'inscrito' && JSON.stringify((sd.excecaoAdmin || {}).regras) === JSON.stringify({ diretores: true }), JSON.stringify(sd));

    /* 5. lote pelo Público restrito da turma */
    await page.evaluate(() => { const b = document.querySelector('#turma-card-tG2 .js-pub-badge'); const ev = b.closest('[data-ev-key]'); if (b.offsetParent === null) ev.querySelector('.ev-toggle-icon').click(); });
    await page.click('#turma-card-tG2 .js-pub-badge');
    await esperarCondicao(page, () => Array.from(document.querySelectorAll('.modal-box button')).some((x) => /Adicionar à turma/i.test(x.textContent)), null, { limite: 10000, descricao: 'o botão do lote' });
    await page.evaluate(() => Array.from(document.querySelectorAll('.modal-box button')).find((x) => /Adicionar à turma/i.test(x.textContent)).click());
    await modalExc(page);
    const txt5 = await page.evaluate(() => document.querySelector('[data-pedido-excecao]').textContent);
    anota('5. lote: o painel mostra quem as regras barram — o assessor (cargo) e quem participou do evento anterior (participação)',
      /ASSESSORA DOIS EX/.test(txt5) && /JA PARTICIPOU EX/.test(txt5) && /cargo/.test(txt5) && /participação/.test(txt5) && !/GERENTE DOIS EX/.test(txt5), txt5.slice(0, 260));
    await excecao(page, 'Convidados da diretoria para esta turma');
    await confirmarAte(page, 'turmas-interesse/tG2/' + chave(P.ger2));
    await esperarCondicao(page, (ks) => ks.every((k) => (window.__ESCRITAS || []).some((e) => e.path === 'turmas-interesse/tG2/' + k)), [chave(P.ger2), chave(P.ass2), chave(P.part)], { limite: 10000, descricao: 'as gravações do lote' });
    const l1 = await lerNo(page, 'turmas-interesse/tG2/' + chave(P.ger2)), l2 = await lerNo(page, 'turmas-interesse/tG2/' + chave(P.ass2)), l3 = await lerNo(page, 'turmas-interesse/tG2/' + chave(P.part));
    anota('5. lote: quem passa entra sem exceção; cada exceção com as próprias regras e o mesmo motivo',
      !l1.excecaoAdmin && JSON.stringify(l2.excecaoAdmin.regras) === JSON.stringify({ cargo: true }) && JSON.stringify(l3.excecaoAdmin.regras) === JSON.stringify({ participacao: true }) &&
      l2.excecaoAdmin.motivo === 'Convidados da diretoria para esta turma' && l3.status === 'inscrito', JSON.stringify({ l1, l2, l3 }));
    await page.keyboard.press('Escape').catch(() => {});

    /* 6. selos no painel (depois da recarga da aba) */
    await page.evaluate(() => { document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()); Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Eventos/i.test(x.textContent)).click(); });
    await esperarCondicao(page, (k) => !!document.querySelector('#turma-card-tG [data-excecao-admin]'), null, { limite: 15000, descricao: 'o selo de exceção' });
    const selos = await page.evaluate(([ass, leg]) => {
      const linha = (txt) => Array.from(document.querySelectorAll('#turma-card-tG tr')).find((tr) => tr.textContent.indexOf(txt) !== -1);
      const la = linha(ass), ll = linha(leg), hist = document.getElementById('turma-card-tHist');
      return { ass: la ? { exc: !!la.querySelector('[data-excecao-admin]'), fora: !!la.querySelector('[data-fora-publico]'), txt: la.textContent } : null,
        leg: ll ? { regras: !!ll.querySelector('[data-fora-regras]'), txt: ll.textContent } : null,
        hist: hist ? { selos: hist.querySelectorAll('[data-fora-publico], [data-fora-regras], [data-excecao-admin]').length } : null };
    }, [nome(P.ass), nome(P.leg)]);
    anota('6. assessor: selo "Exceção autorizada" com o motivo, sem "Fora do público atual"', selos.ass && selos.ass.exc && !selos.ass.fora && /Assessor convidado/.test(selos.ass.txt), JSON.stringify(selos.ass));
    anota('6. interesse antigo que contraria a participação anterior: selo "Fora das regras do evento"', selos.leg && selos.leg.regras && /EVENTO ANTERIOR SINT/.test(selos.leg.txt), JSON.stringify(selos.leg));
    anota('6. participantes históricos (turma realizada, fora do público, sem exceção): sem selo', selos.hist && selos.hist.selos === 0, JSON.stringify(selos.hist));
    anota('6. participantes históricos intocados', JSON.stringify(await lerNo(page, 'turmas-interesse/tHist')) === JSON.stringify(antes['turmas-interesse'].tHist));

    /* 7. nada fora da participação; o Auth não recebe nada além do login */
    const fora = (await escritas(page)).filter((p) => !/^(turmas-interesse|turmas-interesse-log|fa-espera)\//.test(p));
    const auth = await page.evaluate(() => (window.__CFG.__eventosAuth || []).filter((e) => !/^entrar:/.test(e)));
    anota('7. só turmas-interesse, turmas-interesse-log e fa-espera foram gravados', !fora.length, JSON.stringify(fora));
    anota('7. o Auth não recebeu nenhuma operação além do login (senha, conta e e-mail de login intocados)', !auth.length, JSON.stringify(auth));
    for (const no of ['fa-users', 'fa-admins', 'fa-gerentes', 'fa-diretores', 'fa-outros-publicos']) anota('7. ' + no + ' igual', JSON.stringify(await lerNo(page, no)) === JSON.stringify(antes[no]));
    anota('8. sem erro de JS (1280)', !erros.length, JSON.stringify(erros));
    await ctx.close();

    console.log('\n== 375 px ==');
    const m = await abrir(browser, { width: 375, height: 812 }, true);
    await participante(m.page, 'tG', 'ASSESSOR EX');
    await modalExc(m.page);
    const caberExc = await m.page.evaluate(() => { const b = document.querySelector('[data-pedido-excecao]').getBoundingClientRect(); return b.left >= 0 && b.right <= window.innerWidth + 1; });
    await m.page.click('[data-pedido-excecao] .admin-modal-cancel-btn');
    anota('8. 375: o pedido de exceção cabe na tela; cancelar não grava', caberExc && !(await escritas(m.page)).some((p) => p.indexOf('turmas-interesse/tG/' + chave(P.ass)) === 0));
    await m.page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()));
    await m.page.evaluate(() => { const b = document.querySelector('#turma-card-tG2 .js-pub-badge'); const ev = b.closest('[data-ev-key]'); if (b.offsetParent === null) ev.querySelector('.ev-toggle-icon').click(); });
    await m.page.click('#turma-card-tG2 .js-pub-badge');
    await esperarCondicao(m.page, () => !!document.querySelector('.modal-box .pub-del-btn'), null, { limite: 10000, descricao: 'a tabela do Público restrito' });
    const pub = await m.page.evaluate(() => {
      const btn = document.querySelector('.modal-box .pub-del-btn'), cel = btn.closest('td'), nomeEl = cel.querySelector('strong');
      const rb = btn.getBoundingClientRect(), rn = nomeEl.getBoundingClientRect();
      return { mesmaCelula: cel.contains(nomeEl), juntos: rb.right <= window.innerWidth + 1 && rn.left >= 0, email: !!cel.querySelector('.pub-pessoa-email') };
    });
    await m.page.evaluate(() => document.querySelector('.modal-box .pub-del-btn').click());
    await esperarCondicao(m.page, () => Array.from(document.querySelectorAll('.modal-box')).some((b) => /Remover .*\(.*@previ\.com\.br\) do público restrito/.test(b.textContent)), null, { limite: 10000, descricao: 'a confirmação com nome e e-mail' });
    anota('8. 375: no Público restrito, nome, e-mail e "Remover" na mesma célula, visíveis juntos; a confirmação diz nome e e-mail', pub.mesmaCelula && pub.juntos && pub.email, JSON.stringify(pub));
    await m.page.evaluate(() => { const b = Array.from(document.querySelectorAll('.modal-box')).find((x) => /do público restrito/.test(x.textContent) && x.querySelector('.admin-modal-cancel-btn')); b.querySelector('.admin-modal-cancel-btn').click(); });
    const larg = await m.page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    anota('8. 375: nada removido, sem rolagem lateral, sem erro de JS', !(await escritas(m.page)).length && !larg && !m.erros.length, JSON.stringify({ larg, erros: m.erros }));
    await m.ctx.close();
  } catch (e) { falhas++; console.error('  FALHA inesperada: ' + e.message); }
  await browser.close();
  console.log('\n' + oks + ' ok, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
})();
