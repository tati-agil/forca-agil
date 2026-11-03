/* Movimentação de pessoas no painel (ADMIN › Eventos): remover da turma ou da lista de espera COM DESTINO — nenhum lugar,
 * a lista de espera (quando o evento aceita) ou outra turma, como Interessada ou Inscrita — e o que se lê sem abrir nada:
 * o período no cabeçalho fechado do evento, as datas dos encontros (com mês e ano) no cabeçalho fechado da turma e a lista
 * de presença com evento, turma e datas. Firebase falso, desktop e 375 px.
 *
 * O QUE ELE EXIGE:
 *   1. cabeçalho fechado do evento com o período (primeiro a último encontro) e da turma com as datas por extenso;
 *   2. lista de presença: nome completo do evento, nome da turma, todas as datas (dd/mm/aaaa) e as informações de antes;
 *   3. a escolha do destino é agrupada por evento (há "Turma 1" em dois eventos) e cada opção traz datas, situação e vagas;
 *      turma realizada não aparece; o resumo escreve o destino por inteiro;
 *   4. inscrita → outra turma de OUTRO evento como Interessada: avisa que perde o acesso; UMA gravação com a saída da origem
 *      (removedParaTurma, situação, quem), a entrada no destino com a data ORIGINAL do interesse e a da movimentação à parte
 *      (movimentadaEm, movimentadaDe) e uma linha no histórico de cada lado; "uma turma por pessoa" não barra pela turma de
 *      onde ela sai;
 *   5. → Inscrita com inscrição em outra turma: avisa e tira a outra (exclusividade do Confirmar);
 *   6. destino de público restrito: pede exceção; cancelar = nada gravado e a pessoa continua na origem;
 *   7. pessoa que já está no destino: recusa, nada gravado (sem duplicar);
 *   8. falha da gravação: mensagem, nada aplicado, a pessoa continua onde estava;
 *   9. evento sem lista de espera: a opção aparece desligada, com o motivo;
 *  10. saída da fila → turma lotada de outro evento: pede o motivo da lotação, grava acimaDasVagas, a data da FILA vai para
 *      o destino e a fila registra movedToTurma/movedToStatus;
 *  11. saída da fila sem destino continua como era (motivo, quem);
 *  12. "↓ Histórico": transferências (saída e entrada, com motivo e destino), as saídas da fila — sem linha duplicada;
 *  13. 375 px: os cabeçalhos com período/datas e a caixa do destino cabem na tela (sem rolagem lateral);
 *  14. nenhum erro de JavaScript. */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ADM = 'adm@previ.com.br';
const P = {
  insc: 'inscrita.um@previ.com.br', int: 'interessada.dois@previ.com.br', bloq: 'barrada.tres@previ.com.br',
  dup: 'duplicada.quatro@previ.com.br', fila: 'na.fila@previ.com.br', fila2: 'desistiu.fila@previ.com.br',
  falha: 'falha.cinco@previ.com.br', occ: 'ocupa.vaga@previ.com.br'
};
const NOMES = { insc: 'INSCRITA UM', int: 'INTERESSADA DOIS', bloq: 'BARRADA TRES', dup: 'DUPLICADA QUATRO', fila: 'NA FILA', fila2: 'DESISTIU FILA', falha: 'FALHA CINCO', occ: 'OCUPA VAGA' };
const reg = (k, extra) => Object.assign({ name: NOMES[k], email: P[k], area: 'GECAT', removed: false }, extra);
const conf = { status: 'inscrito', confirmedByAdmin: ADM };

function banco() {
  const users = { [chave(ADM)]: { name: 'ADMIN', email: ADM, area: 'INFOR' } };
  Object.keys(P).forEach((k) => { users[chave(P[k])] = { name: NOMES[k], email: P[k], area: 'GECAT' }; });
  return {
    'fa-users': users, 'fa-admins': { [chave(ADM)]: { email: ADM, name: 'ADMIN' } }, 'fa-diretores': {}, 'fa-facilitadores': {}, 'fa-gerentes': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {},
    'fa-espera': {
      [chave(P.fila)]: { 'lista:evA': reg('fila', { date: '2026-08-05T09:00:00.000Z', eventoKey: 'evA' }) },
      [chave(P.fila2)]: { 'lista:evA': reg('fila2', { date: '2026-08-06T09:00:00.000Z', eventoKey: 'evA' }) }
    },
    eventos: {
      evA: { nome: 'EPISÓDIO A – O COMEÇO', order: 1, publicado: true, cargaHoraria: '12', esperaAtiva: true, umaTurmaPorPessoa: true, umaTurmaComEventos: { evB: true } },
      evB: { nome: 'EPISÓDIO B – A SEQUÊNCIA', order: 2, publicado: true, cargaHoraria: '8', umaTurmaPorPessoa: true, umaTurmaComEventos: { evA: true } },
      evC: { nome: 'EPISÓDIO C – SEM FILA', order: 3, publicado: true, cargaHoraria: '4', esperaAtiva: false }
    },
    turmas: {
      tA1: { label: 'Turma 1', eventoKey: 'evA', order: 1, dias: ['2027-11-12', '2027-11-10'], horarioInicio: '09:00', horarioFim: '12:00', sala: 'Sala Jedi' },
      tA2: { label: 'Turma 2', eventoKey: 'evA', order: 2, dias: ['2027-11-24'] },
      tAx: { label: 'Turma Realizada', eventoKey: 'evA', order: 3, dias: ['2026-01-10'] },
      tB1: { label: 'Turma 1', eventoKey: 'evB', order: 4, dias: ['2027-12-01', '2027-12-03'] },
      tB2: { label: 'Turma 2', eventoKey: 'evB', order: 5, dias: ['2027-12-08'], vagas: 1 },
      tB3: { label: 'Turma 3', eventoKey: 'evB', order: 6, dias: ['2027-12-15'], publicoRestrito: true },
      tC1: { label: 'Turma 1', eventoKey: 'evC', order: 7, dias: ['2028-01-05'] },
      tC2: { label: 'Turma 2', eventoKey: 'evC', order: 8, dias: ['2028-01-12'] }
    },
    'turmas-interesse': {
      tA1: { [chave(P.insc)]: reg('insc', Object.assign({ date: '2026-09-01T10:00:00.000Z' }, conf)) },
      tA2: { [chave(P.int)]: reg('int', { status: 'interessado', date: '2026-09-02T10:00:00.000Z' }),
             [chave(P.falha)]: reg('falha', Object.assign({ date: '2026-09-03T10:00:00.000Z' }, conf)) },
      tB1: { [chave(P.dup)]: reg('dup', { status: 'interessado', date: '2026-09-04T10:00:00.000Z' }) },
      tB2: { [chave(P.occ)]: reg('occ', { status: 'interessado', date: '2026-09-05T10:00:00.000Z' }) },
      tC1: { [chave(P.int)]: reg('int', Object.assign({ date: '2026-09-06T10:00:00.000Z' }, conf)),
             [chave(P.bloq)]: reg('bloq', { status: 'interessado', date: '2026-09-07T10:00:00.000Z' }),
             [chave(P.dup)]: reg('dup', { status: 'interessado', date: '2026-09-08T10:00:00.000Z' }) }
    },
    'turmas-interesse-log': {},
    'turmas-config': { tAx: { encerrada: true, finalizada: true } },
    'turmas-checkin': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {},
    avaliacoes: {}, pedidos: {}, holocron: {}
  };
}

const lerNo = (page, no) => page.evaluate((n) => firebase.database().ref(n).once('value').then((s) => s.val()), no);
const escritas = (page, prefixo) => page.evaluate((p) => (window.__ESCRITAS || []).filter((e) => e.path.indexOf(p) === 0).length, prefixo);

async function prepararPagina(ctx, extra) {
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify(Object.assign({ db: banco(), user: { email: ADM, emailVerified: true, uid: 'u-adm' }, delayDefault: 15 }, extra || {})) + ';');
  /* a lista de presença abre numa janela nova: guarda o HTML escrito nela */
  await page.addInitScript(() => {
    window.open = function () {
      const doc = { _html: '', open() {}, write(h) { this._html += h; }, close() { window.__LISTA_PRESENCA = this._html; }, getElementById() { return null; } };
      return { document: doc, print() {} };
    };
  });
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  await esperarCondicao(page, () => Array.from(document.querySelectorAll('.admin-tab-btn')).some((x) => /Eventos/i.test(x.textContent)), null, { limite: 15000, descricao: 'aba Eventos' });
  await page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Eventos/i.test(x.textContent)).click());
  await esperarCondicao(page, () => !!document.querySelector('#turma-card-tA1') && !!document.querySelector('#turma-card-tC2'), null, { limite: 15000, descricao: 'os cards das turmas' });
  return { page, erros };
}

/* abre o Remover de uma pessoa numa turma (o botão mora no corpo recolhido da turma: clique pelo elemento) */
async function abrirRemover(page, turma, email) {
  await esperarCondicao(page, (a) => !!document.querySelector('.ck-remove-btn[data-turma="' + a.t + '"][data-ekey="' + a.k + '"]'), { t: turma, k: chave(email) }, { limite: 15000, descricao: 'o Remover de ' + email });
  await page.evaluate((a) => document.querySelector('.ck-remove-btn[data-turma="' + a.t + '"][data-ekey="' + a.k + '"]').click(), { t: turma, k: chave(email) });
  await esperarCondicao(page, () => !!document.querySelector('.modal-box .mov-destino'), null, { limite: 8000, descricao: 'a caixa "Para onde ela vai?"' });
}
async function abrirRemoverDaFila(page, nome) {
  await esperarCondicao(page, (n) => Array.from(document.querySelectorAll('.ev-espera-section tr')).some((tr) => tr.textContent.indexOf(n) !== -1 && /Remover da lista/.test(tr.textContent)), nome, { limite: 15000, descricao: 'a linha de ' + nome + ' na fila' });
  await page.evaluate((n) => { const tr = Array.from(document.querySelectorAll('.ev-espera-section tr')).find((x) => x.textContent.indexOf(n) !== -1 && /Remover da lista/.test(x.textContent));
    Array.from(tr.querySelectorAll('button')).find((b) => /Remover da lista/.test(b.textContent)).click(); }, nome);
  await esperarCondicao(page, () => !!document.querySelector('.modal-box .mov-destino'), null, { limite: 8000, descricao: 'a caixa "Para onde ela vai?" da fila' });
}
/* preenche a caixa: motivo, destino e (se turma) a turma e a situação */
async function preencher(page, o) {
  await page.evaluate((o) => {
    const box = document.querySelector('.modal-box .mov-destino').closest('.modal-box');
    const sel = box.querySelector('select.admin-motivo-select:not(.mov-turma-select)');
    sel.value = o.motivo; sel.dispatchEvent(new Event('change'));
    if (o.destino) { const r = box.querySelector('input[name="movDestino"][value="' + o.destino + '"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
    if (o.turma) { const s = box.querySelector('.mov-turma-select'); s.value = o.turma; s.dispatchEvent(new Event('change', { bubbles: true })); }
    if (o.status) { const r = box.querySelector('input[name="movSituacao"][value="' + o.status + '"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
  }, o);
}
const confirmarCaixa = (page) => page.evaluate(() => document.querySelector('.modal-box .mov-destino').closest('.modal-box').querySelector('.admin-modal-confirm-btn').click());
/* o último modal com botão de confirmar visível */
async function confirmarModal(page, re) {
  await esperarCondicao(page, (src) => Array.from(document.querySelectorAll('.modal-box')).some((b) => new RegExp(src).test(b.textContent) && b.querySelector('.admin-modal-confirm-btn')), re.source, { limite: 10000, descricao: 'o aviso ' + re.source });
  return page.evaluate((src) => { const b = Array.from(document.querySelectorAll('.modal-box')).filter((x) => new RegExp(src).test(x.textContent) && x.querySelector('.admin-modal-confirm-btn')).pop();
    const t = b.textContent; b.querySelector('.admin-modal-confirm-btn').click(); return t; }, re.source);
}
/* o adminAlert do painel: devolve o texto e fecha */
async function lerAlerta(page) {
  await esperarCondicao(page, () => Array.from(document.querySelectorAll('.modal-box')).some((b) => /Nada foi gravado/.test(b.textContent)), null, { limite: 10000, descricao: 'a mensagem de recusa' });
  return page.evaluate(() => { const b = Array.from(document.querySelectorAll('.modal-box')).filter((x) => /Nada foi gravado/.test(x.textContent)).pop(); const t = b.textContent;
    const ok = Array.from(b.querySelectorAll('button')).pop(); if (ok) ok.click(); return t; });
}

(async () => {
  const browser = await chromium.launch();
  let falhas = 0, oks = 0;
  const anota = (r, ok, d) => { if (ok) { oks++; console.log('  ok    ' + r); } else { falhas++; console.error('  FALHA ' + r + (d ? ' — ' + d : '')); } };
  try {
    /* ── DESKTOP ─────────────────────────────────────────────────────────── */
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
    const { page, erros } = await prepararPagina(ctx);

    /* 1. cabeçalhos fechados */
    const evHdr = await page.$eval('[data-ev-key="evA"] .ev-admin-meta', (e) => e.textContent);
    const evAberto = await page.$eval('[data-ev-key="evA"] .ev-turmas-wrap', (e) => e.offsetParent !== null).catch(() => null);
    /* o período vai do primeiro ao último encontro de TODAS as turmas do evento, inclusive a já realizada */
    anota('1. evento fechado mostra o período (do primeiro ao último encontro)', /10\/01\/2026 a 24\/11\/2027/.test(evHdr) && evAberto === false, evHdr + ' aberto=' + evAberto);
    const tHdr = await page.$eval('#turma-card-tA1 .turma-admin-encontros', (e) => e.textContent);
    anota('1. turma fechada mostra as datas dos encontros com mês e ano', /10 e 12 de novembro de 2027/.test(tHdr), tHdr);

    /* 2. lista de presença */
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#turma-card-tA1 button')).find((x) => /Lista de presença/.test(x.textContent)); b.click(); });
    await esperarCondicao(page, () => !!window.__LISTA_PRESENCA, null, { limite: 8000, descricao: 'a lista de presença' });
    const lp = await page.evaluate(() => window.__LISTA_PRESENCA.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
    anota('2. lista de presença: evento completo, turma e todas as datas dd/mm/aaaa',
      /Evento: EPISÓDIO A – O COMEÇO/.test(lp) && /Turma: Turma 1/.test(lp) && /qua 10\/11\/2027/.test(lp) && /sex 12\/11\/2027/.test(lp) && /2 encontros/.test(lp), lp.slice(0, 400));
    anota('2. lista de presença: preserva horário, sala, inscritas e assinaturas', /Horário: 9h – 12h/.test(lp) && /Sala: Sala Jedi/.test(lp) && /INSCRITA UM/.test(lp) && /Responsável pela turma/.test(lp), lp.slice(0, 600));

    /* 3 + 4. inscrita em tA1 → Turma 1 do evento B como Interessada */
    await abrirRemover(page, 'tA1', P.insc);
    const sel = await page.evaluate(() => {
      const s = document.querySelector('.modal-box .mov-turma-select');
      return { grupos: Array.from(s.querySelectorAll('optgroup')).map((g) => g.label), opts: Array.from(s.options).map((o) => o.value + '=' + o.textContent) };
    });
    const optB1 = (sel.opts.find((o) => o.indexOf('tB1=') === 0) || '');
    anota('3. destino agrupado por evento, com as duas "Turma 1" em grupos diferentes',
      sel.grupos.indexOf('EPISÓDIO A – O COMEÇO') !== -1 && sel.grupos.indexOf('EPISÓDIO B – A SEQUÊNCIA') !== -1 && sel.opts.some((o) => o.indexOf('tC1=Turma 1') === 0) && optB1.indexOf('Turma 1') !== -1, JSON.stringify(sel));
    anota('3. cada opção traz datas, situação e vagas; sem a turma de origem nem a realizada',
      /1 e 3 de dezembro de 2027 · aberta · sem limite de vagas/.test(optB1) && sel.opts.some((o) => /^tB2=.*lotada \(1\/1\)/.test(o)) &&
      !sel.opts.some((o) => o.indexOf('tA1=') === 0) && !sel.opts.some((o) => o.indexOf('tAx=') === 0), JSON.stringify(sel.opts));
    const padraoEspera = await page.evaluate(() => (document.querySelector('.modal-box input[name="movDestino"]:checked') || {}).value);
    anota('9. evento que aceita fila: a opção Lista de espera vem marcada (como a caixa de antes)', padraoEspera === 'espera', padraoEspera);
    await preencher(page, { motivo: 'outra_turma', turma: 'tB1', status: 'interessado' });
    const caixa = await page.evaluate(() => { const b = document.querySelector('.modal-box .mov-destino');
      return { dest: b.querySelector('input[name="movDestino"]:checked').value, resumo: b.querySelector('.mov-resumo').textContent, aviso: b.querySelector('.mov-aviso').hidden ? '' : b.querySelector('.mov-aviso').textContent }; });
    anota('3. "Vai fazer em outra turma" marca Outra turma; o resumo escreve o destino por inteiro',
      caixa.dest === 'turma' && /EPISÓDIO B – A SEQUÊNCIA › Turma 1 · 1 e 3 de dezembro de 2027/.test(caixa.resumo), JSON.stringify(caixa));
    anota('4. inscrita indo como Interessada: avisa que perde o acesso', /perde o acesso/.test(caixa.aviso), caixa.aviso);
    const antes = await page.evaluate(() => (window.__ESCRITAS || []).length);
    await confirmarCaixa(page);
    await esperarCondicao(page, (k) => (window.__ESCRITAS || []).some((e) => e.path === 'turmas-interesse/tB1/' + k), chave(P.insc), { limite: 10000, descricao: 'a transferência' });
    const novas = await page.evaluate((n) => (window.__ESCRITAS || []).slice(n).map((e) => e.path), antes);
    const origem = await lerNo(page, 'turmas-interesse/tA1/' + chave(P.insc));
    const destino = await lerNo(page, 'turmas-interesse/tB1/' + chave(P.insc));
    const logA = await lerNo(page, 'turmas-interesse-log/tA1/' + chave(P.insc)), logB = await lerNo(page, 'turmas-interesse-log/tB1/' + chave(P.insc));
    anota('4. uma gravação só: saída, entrada e as duas linhas do histórico juntas',
      novas.some((p) => p === 'turmas-interesse/tA1/' + chave(P.insc) + '/removed') && novas.some((p) => p === 'turmas-interesse/tB1/' + chave(P.insc)) &&
      novas.filter((p) => p.indexOf('turmas-interesse-log/') === 0).length === 2 && novas.length > 5, JSON.stringify(novas));
    anota('4. origem: removida, com destino, situação, motivo e quem',
      origem.removed === true && origem.removedParaTurma === 'tB1' && origem.removedParaStatus === 'interessado' && /EPISÓDIO B/.test(origem.removedParaTurmaLabel) &&
      origem.removedMotivo === 'outra_turma' && origem.removedByAdmin === ADM && origem.status === 'inscrito', JSON.stringify(origem));
    anota('4. destino: Interessada, data ORIGINAL do interesse, movimentação registrada à parte',
      destino.status === 'interessado' && !destino.confirmedByAdmin && destino.date === '2026-09-01T10:00:00.000Z' && !!destino.movimentadaEm &&
      destino.movimentadaDe && destino.movimentadaDe.turma === 'tA1' && destino.movimentadaDe.situacao === 'inscrita' && destino.movimentadaDe.porNome === 'ADMIN' && !destino.removed, JSON.stringify(destino));
    const lA = Object.values(logA || {})[0] || {}, lB = Object.values(logB || {})[0] || {};
    anota('4. histórico dos dois lados (de, para, situação, motivo, quem)',
      lA.action === 'transferida_saida' && lB.action === 'transferida_entrada' && lB.de.turma === 'tA1' && lB.para.turma === 'tB1' && lB.para.situacao === 'interessado' && lB.adminName === 'ADMIN' && /Vai fazer na/.test(lB.motivo), JSON.stringify([lA, lB]));
    anota('4. "uma turma por pessoa" (A+B) não barrou pela turma de onde ela saiu', !(await page.evaluate(() => !!document.querySelector('[data-pedido-excecao]'))));

    /* 5. interessada em tA2 (e inscrita em tC1) → tA1 como Inscrita: avisa e tira a inscrição em tC1 */
    await esperarCondicao(page, () => !document.querySelector('.modal-overlay:not([hidden])'), null, { limite: 8000, descricao: 'a tela sem caixas' });
    await abrirRemover(page, 'tA2', P.int);
    await preencher(page, { motivo: 'data_nao_serviu', destino: 'turma', turma: 'tA1', status: 'inscrito' });
    await confirmarCaixa(page);
    const aviso5 = await confirmarModal(page, /já é inscrita em outra turma/);
    await esperarCondicao(page, (k) => (window.__ESCRITAS || []).some((e) => e.path === 'turmas-interesse/tA1/' + k), chave(P.int), { limite: 10000, descricao: 'a transferência como Inscrita' });
    const d5 = await lerNo(page, 'turmas-interesse/tA1/' + chave(P.int)), c5 = await lerNo(page, 'turmas-interesse/tC1/' + chave(P.int)), o5 = await lerNo(page, 'turmas-interesse/tA2/' + chave(P.int));
    anota('5. → Inscrita: avisa e tira a inscrição na outra turma; destino confirmado por quem moveu',
      /Turma 1/.test(aviso5) && c5.removed === true && d5.status === 'inscrito' && d5.confirmedByAdmin === ADM && d5.date === '2026-09-02T10:00:00.000Z' && o5.removed === true && o5.removedParaStatus === 'inscrito',
      JSON.stringify({ d5, c5: c5 && c5.removed, o5: o5 && o5.removed }));

    /* 6 + 9. barrada em tC1 (evento SEM fila) → tB3 restrita: opção de fila desligada; pede exceção; cancelar não grava nada */
    await esperarCondicao(page, () => !document.querySelector('.modal-overlay:not([hidden])'), null, { limite: 8000, descricao: 'a tela sem caixas' });
    await abrirRemover(page, 'tC1', P.bloq);
    const fila9 = await page.evaluate(() => { const r = document.querySelector('.modal-box input[name="movDestino"][value="espera"]');
      return { off: !!r && r.disabled, nota: r ? r.closest('label').textContent : '', marcado: (document.querySelector('.modal-box input[name="movDestino"]:checked') || {}).value }; });
    anota('9. evento sem lista de espera: a opção aparece desligada, com o motivo, e não vem marcada', fila9.off && /desligada neste evento/.test(fila9.nota) && fila9.marcado === 'nenhum', JSON.stringify(fila9));
    const n6 = await page.evaluate(() => (window.__ESCRITAS || []).length);
    await preencher(page, { motivo: 'a_pedido', destino: 'turma', turma: 'tB3', status: 'interessado' });
    await confirmarCaixa(page);
    await esperarCondicao(page, () => !!document.querySelector('[data-pedido-excecao]'), null, { limite: 10000, descricao: 'o pedido de exceção' });
    await page.click('[data-pedido-excecao] .admin-modal-cancel-btn');
    await esperarCondicao(page, () => !document.querySelector('[data-pedido-excecao]'), null, { limite: 5000, descricao: 'o pedido fechado' });
    const o6 = await lerNo(page, 'turmas-interesse/tC1/' + chave(P.bloq));
    anota('6. destino restrito: pede exceção; cancelar = nada gravado, ela continua na origem',
      (await page.evaluate(() => (window.__ESCRITAS || []).length)) === n6 && o6.removed === false && !(await lerNo(page, 'turmas-interesse/tB3/' + chave(P.bloq))), JSON.stringify(o6));

    /* 7. já está no destino */
    await abrirRemover(page, 'tC1', P.dup);
    const n7 = await page.evaluate(() => (window.__ESCRITAS || []).length);
    await preencher(page, { motivo: 'a_pedido', destino: 'turma', turma: 'tB1', status: 'interessado' });
    await confirmarCaixa(page);
    const al7 = await lerAlerta(page);
    anota('7. já está no destino: recusa e não grava nada (sem duplicar)',
      /já está em "Turma 1"/.test(al7) && (await page.evaluate(() => (window.__ESCRITAS || []).length)) === n7 && (await lerNo(page, 'turmas-interesse/tC1/' + chave(P.dup))).removed === false, al7);

    /* 8. falha da gravação: nada aplicado */
    await page.evaluate(() => { window.__CFG.fail = ['turmas-interesse-log/tC2']; });
    await abrirRemover(page, 'tA2', P.falha);
    await preencher(page, { motivo: 'a_pedido', destino: 'turma', turma: 'tC2', status: 'inscrito' });
    await confirmarCaixa(page);
    const al8 = await lerAlerta(page);
    await page.evaluate(() => { window.__CFG.fail = []; });
    const o8 = await lerNo(page, 'turmas-interesse/tA2/' + chave(P.falha)), d8 = await lerNo(page, 'turmas-interesse/tC2/' + chave(P.falha));
    anota('8. falha da gravação: avisa e nada é aplicado — ela continua inscrita na origem',
      /continua onde estava/.test(al8) && o8.removed === false && o8.status === 'inscrito' && !d8, JSON.stringify({ al8, o8, d8 }));

    /* 10. fila do evento A → Turma 2 do evento B (lotada) como Interessada */
    await abrirRemoverDaFila(page, NOMES.fila);
    const semFila = await page.evaluate(() => !document.querySelector('.modal-box input[name="movDestino"][value="espera"]'));
    anota('10. saindo da fila, a opção "Lista de espera" não aparece', semFila);
    await preencher(page, { motivo: 'desistiu', destino: 'turma', turma: 'tB2', status: 'interessado' });
    await confirmarCaixa(page);
    await esperarCondicao(page, () => !!document.querySelector('.admin-vagas-motivo'), null, { limite: 10000, descricao: 'o motivo da lotação' });
    await page.fill('.admin-vagas-motivo', 'Combinado com a gestão do evento B');
    await page.click('.admin-vagas-confirm-btn');
    await esperarCondicao(page, (k) => (window.__ESCRITAS || []).some((e) => e.path === 'turmas-interesse/tB2/' + k), chave(P.fila), { limite: 10000, descricao: 'a saída da fila para a turma' });
    const d10 = await lerNo(page, 'turmas-interesse/tB2/' + chave(P.fila)), f10 = await lerNo(page, 'fa-espera/' + chave(P.fila) + '/lista:evA');
    anota('10. fila → turma lotada de outro evento: motivo da lotação, data da FILA no destino, origem "lista de espera"',
      d10.status === 'interessado' && d10.date === '2026-08-05T09:00:00.000Z' && d10.fromEspera === true && /gestão do evento B/.test((d10.acimaDasVagas || {}).motivo) &&
      d10.movimentadaDe.tipo === 'espera' && d10.movimentadaDe.eventoKey === 'evA', JSON.stringify(d10));
    anota('10. a fila registra a saída com o destino e a situação', f10.removed === true && f10.movedToTurma === 'tB2' && f10.movedToStatus === 'interessado' && f10.motivoSaida === 'desistiu' && f10.removedByName === 'ADMIN', JSON.stringify(f10));

    /* 11. fila sem destino, como sempre */
    await esperarCondicao(page, () => !document.querySelector('.modal-overlay:not([hidden])'), null, { limite: 8000, descricao: 'a tela sem caixas' });
    await abrirRemoverDaFila(page, NOMES.fila2);
    await preencher(page, { motivo: 'nao_responde' });
    await confirmarCaixa(page);
    await esperarCondicao(page, (k) => (window.__ESCRITAS || []).some((e) => e.path === 'fa-espera/' + k + '/lista:evA/removed'), chave(P.fila2), { limite: 10000, descricao: 'a saída da fila sem destino' });
    const f11 = await lerNo(page, 'fa-espera/' + chave(P.fila2) + '/lista:evA');
    anota('11. saída da fila sem destino: motivo e quem, sem turma', f11.removed === true && f11.motivoSaida === 'nao_responde' && !f11.movedToTurma && f11.removedByName === 'ADMIN', JSON.stringify(f11));

    /* 12. Histórico */
    await esperarCondicao(page, () => !document.querySelector('.modal-overlay:not([hidden])'), null, { limite: 8000, descricao: 'a tela sem caixas' });
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.evaluate(() => Array.from(document.querySelectorAll('button')).find((b) => /Histórico/.test(b.textContent)).click())]);
    const arq = path.join(os.tmpdir(), 'hist-mov-' + process.pid + '-' + Date.now() + '.csv');
    await dl.saveAs(arq);
    const csv = fs.readFileSync(arq, 'utf8'); fs.unlinkSync(arq);
    const linhas = csv.split(/\r?\n/);
    const de = (nome, acao) => linhas.filter((l) => l.indexOf(nome) !== -1 && l.indexOf(acao) !== -1);
    anota('12. Histórico: saída e entrada da transferência, com motivo e destino',
      de(NOMES.insc, 'Transferida para outra turma').some((l) => /EPISÓDIO B – A SEQUÊNCIA › Turma 1 · como Interessada/.test(l) && /Vai fazer na/.test(l)) &&
      de(NOMES.insc, 'Entrou por transferência').some((l) => /Veio de EPISÓDIO A – O COMEÇO › Turma 1 \(era inscrita\)/.test(l)), linhas.filter((l) => l.indexOf(NOMES.insc) !== -1).join('\n'));
    anota('12. Histórico: sem linha duplicada de "Removido da turma"/"Adicionado pelo admin" para a transferência',
      !de(NOMES.insc, 'Removido da turma').length && !de(NOMES.insc, 'Adicionado pelo admin').length, linhas.filter((l) => l.indexOf(NOMES.insc) !== -1).join('\n'));
    anota('12. Histórico: as saídas da lista de espera, com motivo, quem e destino',
      de(NOMES.fila2, 'Saiu da lista de espera').some((l) => /Não respondeu/.test(l) && /Admin — ADMIN/.test(l) && /Saiu da fila/.test(l)) &&
      de(NOMES.fila, 'Saiu da lista de espera para uma turma').some((l) => /Turma 2 · .*como Interessada/.test(l) && /Desistiu/.test(l)),
      linhas.filter((l) => /FILA/.test(l)).join('\n'));

    anota('14. desktop: nenhum erro de JavaScript', !erros.length, erros.join(' | '));
    await ctx.close();

    /* ── 375 px ──────────────────────────────────────────────────────────── */
    const cel = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const m = await prepararPagina(cel);
    const mp = m.page;
    const hdrs = await mp.evaluate(() => ({
      ev: document.querySelector('[data-ev-key="evA"] .ev-admin-meta').textContent,
      evVisivel: document.querySelector('[data-ev-key="evA"] .ev-admin-meta').getBoundingClientRect().width > 0,
      t: document.querySelector('#turma-card-tB1 .turma-admin-encontros').textContent
    }));
    anota('13. 375 px: período do evento e datas da turma nos cabeçalhos', /10\/01\/2026 a 24\/11\/2027/.test(hdrs.ev) && hdrs.evVisivel && /1 e 3 de dezembro de 2027/.test(hdrs.t), JSON.stringify(hdrs));
    await abrirRemover(mp, 'tA1', P.insc);
    await preencher(mp, { motivo: 'outra_turma', turma: 'tB1', status: 'interessado' });
    const medida = await mp.evaluate(() => { const box = document.querySelector('.modal-box .mov-destino').closest('.modal-box'); const r = box.getBoundingClientRect();
      const res = box.querySelector('.mov-resumo').getBoundingClientRect();
      return { esq: r.left, dir: r.right, larg: window.innerWidth, rolaDentro: box.scrollWidth <= box.clientWidth + 1, pagina: document.documentElement.scrollWidth <= window.innerWidth + 1, resumo: res.right <= r.right + 1 }; });
    anota('13. 375 px: a caixa do destino cabe na tela, sem rolagem lateral', medida.esq >= 0 && medida.dir <= medida.larg && medida.rolaDentro && medida.pagina && medida.resumo, JSON.stringify(medida));
    await confirmarCaixa(mp);
    await esperarCondicao(mp, (k) => (window.__ESCRITAS || []).some((e) => e.path === 'turmas-interesse/tB1/' + k), chave(P.insc), { limite: 10000, descricao: 'a transferência no celular' });
    anota('13. 375 px: a transferência grava igual', (await lerNo(mp, 'turmas-interesse/tB1/' + chave(P.insc))).date === '2026-09-01T10:00:00.000Z');
    anota('14. 375 px: nenhum erro de JavaScript', !m.erros.length, m.erros.join(' | '));
    await cel.close();
  } catch (e) {
    falhas++;
    console.error('  FALHA inesperada: ' + (e && e.stack || e));
  } finally {
    await browser.close();
  }
  console.log('\n' + oks + ' ok, ' + falhas + ' falha(s)');
  process.exit(falhas ? 1 : 0);
})();
