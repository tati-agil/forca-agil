/* ADMIN › Eventos › Editar evento: as listas "Não aceitar interesse de quem já participou de" e "Contando também as
 * turmas de".
 *
 * POR QUE ESTE TESTE EXISTE
 * As duas listas já vinham dos eventos do banco e já gravavam a CHAVE do evento ({ <chave>: true }). O que faltava:
 * uma referência a evento que não existe mais não era desenhada e SUMIA ao salvar qualquer outra coisa; nada dizia se
 * o evento estava despublicado ou já realizado; e não havia busca. O risco vigiado é perder seleção — por referência
 * antiga, por busca (item escondido) ou por "Marcar/Desmarcar todos" mexendo no que não está à vista.
 *
 * Firebase falso, dados 100% sintéticos. O QUE ELE EXIGE, em 1280 e 375 px:
 *   1. ordem do painel para os publicados, não publicados no fim (selecionáveis), o próprio evento fora, a referência
 *      antiga no fim — com as etiquetas "Não publicado", "Já realizado" e "Evento inexistente";
 *   2. as seleções gravadas aparecem marcadas, inclusive a do não publicado e a do inexistente;
 *   3. busca (mais de 8 eventos) independente em cada lista; esconder não desmarca;
 *   4. "Marcar todos" / "Desmarcar todos" só nos itens visíveis;
 *   5. salvar com a busca ativa grava o que estava escondido; salvar outro campo não apaga nenhuma referência (nem a
 *      antiga); desmarcar a referência antiga é o único jeito de ela sair;
 *   6. evento novo aparece sozinho; evento renomeado continua marcado (pela chave), com o nome novo;
 *   7. toda gravação é em eventos/<o evento editado>; sem rolagem lateral, sem erro de JS.
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

const ev = (nome, order, extra) => Object.assign({ nome, order, publicado: true, esperaAtiva: false }, extra || {});
function banco(variante) {
  const eventos = {
    evA: ev('EVENTO ALFA', 1), evOff: ev('EVENTO OCULTO', 2, { publicado: false }), evB: ev('EVENTO BETA', 3), evC: ev('EVENTO GAMA', 4),
    evD: ev('EVENTO DELTA', 5), evE: ev('EVENTO EPSILON', 6), evF: ev('EVENTO ZETA', 7), evReal: ev('EVENTO JA REALIZADO', 8), evG: ev('EVENTO ETA', 9),
    evAlvo: ev('EVENTO ALVO', 10, { bloqueiaParticipantesDe: { evB: true, evOff: true, evSumiu: true }, umaTurmaPorPessoa: true, umaTurmaComEventos: { evC: true, evSumiu2: true } }),
  };
  if (variante === 'mudou') { eventos.evB.nome = 'EVENTO BETA RENOMEADO'; eventos.evNovo = ev('EVENTO NOVO', 11); }
  const users = { [chave(ADM)]: { name: 'ADMIN', email: ADM, area: 'TI', emailConfirmado: true } };
  return {
    'fa-users': users, 'fa-admins': {}, 'fa-gerentes': {}, 'fa-diretores': {}, 'fa-facilitadores': {}, 'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos,
    turmas: {
      tA: { label: 'ALFA T1', eventoKey: 'evA', order: 1, dias: [dia(20)] },
      tReal1: { label: 'REAL T1', eventoKey: 'evReal', order: 1, dias: [dia(-30)] }, tReal2: { label: 'REAL T2', eventoKey: 'evReal', order: 2, dias: [dia(5)] },
      tAlvo: { label: 'ALVO T1', eventoKey: 'evAlvo', order: 1, dias: [dia(25)] },
    },
    /* a segunda turma do evento realizado foi encerrada pelo admin: todas realizadas */
    'turmas-config': { tReal2: { encerrada: true, dataConclusao: dia(-1) } },
    'turmas-interesse': {}, 'turmas-interesse-log': {}, 'turmas-checkin': {}, 'turmas-sorteio': {}, 'turmas-equipe': {}, 'turmas-publico': {}, 'eventos-publico': {},
    avaliacoes: {}, pedidos: {}, holocron: {},
  };
}

async function abrir(browser, viewport, mobile, variante) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: !!mobile, hasTouch: !!mobile });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(variante), user: { email: ADM, emailVerified: true, uid: 'adm' }, delayDefault: 20 }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await esperarCondicao(page, () => Array.from(document.querySelectorAll('.admin-tab-btn')).some((x) => /Eventos/i.test(x.textContent)), null, { limite: 15000, descricao: 'aba Eventos do ADMIN' });
  await page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Eventos/i.test(x.textContent)).click());
  return { ctx, page, erros };
}
async function abrirEdicao(page, k) {
  await esperarCondicao(page, (kk) => !!document.querySelector('[data-ev-key="' + kk + '"]'), k, { limite: 15000, descricao: 'o evento ' + k + ' no ADMIN' });
  await page.evaluate((kk) => Array.from(document.querySelectorAll('[data-ev-key="' + kk + '"] button')).find((x) => /Editar evento/.test(x.textContent)).click(), k);
  await esperarCondicao(page, () => !!document.querySelector('#eventoFormBloqueioLista .evento-bloqueio-cb'), null, { descricao: 'o formulário do evento' });
}
const lista = (page, id) => page.evaluate((i) => Array.from(document.querySelectorAll('#' + i + ' .evento-lista-item')).map((l) => ({
  key: l.querySelector('input').value, marcado: l.querySelector('input').checked, visivel: !l.hidden && l.offsetParent !== null,
  etiquetas: Array.from(l.querySelectorAll('.admin-badge')).map((b) => b.textContent.trim()), texto: l.textContent.trim() })), id);
/* depois de salvar, o painel fecha o formulário e RECARREGA a lista de eventos (loadInterests): reabrir antes disso
   pegaria a versão de antes — espera o cartão do evento ser redesenhado */
const salvar = async (page) => {
  await page.evaluate(() => { window.__ESCRITAS = []; document.querySelector('[data-ev-key="evAlvo"]').setAttribute('data-velho', '1'); });
  await page.click('.modal-box .admin-modal-save-btn');
  await esperarCondicao(page, () => (window.__ESCRITAS || []).some((x) => /^eventos\/evAlvo/.test(x.path)), null, { descricao: 'a gravação de eventos/evAlvo' });
  await esperarCondicao(page, () => !document.querySelector('#eventoFormBloqueioLista'), null, { descricao: 'o formulário fechar' });
  await esperarCondicao(page, () => { const c = document.querySelector('[data-ev-key="evAlvo"]'); return !!c && !c.hasAttribute('data-velho'); }, null, { limite: 15000, descricao: 'a lista de eventos recarregada' });
};
const lerNo = (page, no) => page.evaluate((n) => firebase.database().ref(n).once('value').then((s) => s.val()), no);
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const marcados = (o) => Object.keys(o || {}).filter((k) => o[k]).sort();

(async () => {
  const browser = await chromium.launch();
  let falhas = 0, oks = 0;
  const anota = (r, ok, d) => { if (ok) { oks++; console.log('  ok    ' + r); } else { falhas++; console.error('  FALHA ' + r + (d ? ' — ' + d : '')); } };
  for (const f of [{ nome: '1280', vp: { width: 1280, height: 800 } }, { nome: '375', vp: { width: 375, height: 812 }, mob: true }]) {
    console.log('\n== ' + f.nome + ' px ==');
    const { ctx, page, erros } = await abrir(browser, f.vp, f.mob);
    const escritasTodas = [];
    try {
      await abrirEdicao(page, 'evAlvo');
      let b = await lista(page, 'eventoFormBloqueioLista');
      const ordem = b.map((x) => x.key);
      anota(f.nome + ': 1. ordem do painel, não publicado no fim, referência antiga por último, o próprio evento fora',
        igual(ordem, ['evA', 'evB', 'evC', 'evD', 'evE', 'evF', 'evReal', 'evG', 'evOff', 'evSumiu']), JSON.stringify(ordem));
      const et = (k) => (b.find((x) => x.key === k) || {}).etiquetas || [];
      anota(f.nome + ': 1. etiquetas "Não publicado", "Já realizado" e "Evento inexistente"',
        igual(et('evOff'), ['Não publicado']) && igual(et('evReal'), ['Já realizado']) && /Evento inexistente/.test(et('evSumiu').join()) && !et('evA').length && !et('evB').length, JSON.stringify(b.map((x) => [x.key, x.etiquetas])));
      anota(f.nome + ': 2. seleções gravadas marcadas (inclusive não publicado e inexistente)', igual(b.filter((x) => x.marcado).map((x) => x.key).sort(), ['evB', 'evOff', 'evSumiu']));
      const g = await lista(page, 'eventoFormUmaTurmaLista');
      anota(f.nome + ': 2. "Contando também as turmas de": marcados e a referência antiga preservada', igual(g.filter((x) => x.marcado).map((x) => x.key).sort(), ['evC', 'evSumiu2']));

      /* 3–4. busca independente; marcar todos só nos visíveis */
      anota(f.nome + ': 3. busca nas duas listas (mais de 8 eventos)', (await page.$$('.evento-lista-busca')).length === 2);
      await page.fill('#eventoFormBloqueioLista .evento-lista-busca', 'gáma');
      b = await lista(page, 'eventoFormBloqueioLista');
      anota(f.nome + ': 3. busca (sem acento) mostra só o que casa; esconder não desmarca',
        igual(b.filter((x) => x.visivel).map((x) => x.key), ['evC']) && igual(b.filter((x) => x.marcado).map((x) => x.key).sort(), ['evB', 'evOff', 'evSumiu']), JSON.stringify(b.filter((x) => x.visivel)));
      anota(f.nome + ': 3. a busca de uma lista não mexe na outra', (await lista(page, 'eventoFormUmaTurmaLista')).every((x) => x.visivel));
      await page.click('#eventoFormBloqueioLista [data-evento-lista-marcar="1"]');
      b = await lista(page, 'eventoFormBloqueioLista');
      anota(f.nome + ': 4. "Marcar todos" marca só o visível', igual(b.filter((x) => x.marcado).map((x) => x.key).sort(), ['evB', 'evC', 'evOff', 'evSumiu']));

      /* 5. salvar com a busca ativa */
      await salvar(page);
      escritasTodas.push(...(await page.evaluate(() => (window.__ESCRITAS || []).map((e) => e.path))));
      let gr = await lerNo(page, 'eventos/evAlvo');
      anota(f.nome + ': 5. salvar com a busca ativa grava também o que estava escondido (e a referência antiga)', igual(marcados(gr.bloqueiaParticipantesDe), ['evB', 'evC', 'evOff', 'evSumiu']), JSON.stringify(gr.bloqueiaParticipantesDe));
      anota(f.nome + ': 5. a outra lista (com a antiga) continua igual', igual(marcados(gr.umaTurmaComEventos), ['evC', 'evSumiu2']), JSON.stringify(gr.umaTurmaComEventos));

      /* desmarcar todos com filtro: só o visível */
      await abrirEdicao(page, 'evAlvo');
      await page.fill('#eventoFormBloqueioLista .evento-lista-busca', 'beta');
      await page.click('#eventoFormBloqueioLista [data-evento-lista-marcar="0"]');
      await page.fill('#eventoFormBloqueioLista .evento-lista-busca', '');
      b = await lista(page, 'eventoFormBloqueioLista');
      anota(f.nome + ': 4. "Desmarcar todos" desmarca só o visível', igual(b.filter((x) => x.marcado).map((x) => x.key).sort(), ['evC', 'evOff', 'evSumiu']));
      await salvar(page);
      escritasTodas.push(...(await page.evaluate(() => (window.__ESCRITAS || []).map((e) => e.path))));

      /* salvar só outro campo */
      await abrirEdicao(page, 'evAlvo');
      await page.fill('#eventoFormMissaoTitulo', 'Missão mudada');
      await salvar(page);
      escritasTodas.push(...(await page.evaluate(() => (window.__ESCRITAS || []).map((e) => e.path))));
      gr = await lerNo(page, 'eventos/evAlvo');
      anota(f.nome + ': 5. salvar outro campo não apaga referência nenhuma (nem as antigas)',
        gr.missaoTitulo === 'Missão mudada' && igual(marcados(gr.bloqueiaParticipantesDe), ['evC', 'evOff', 'evSumiu']) && igual(marcados(gr.umaTurmaComEventos), ['evC', 'evSumiu2']), JSON.stringify(gr));

      /* a referência antiga só sai desmarcando */
      await abrirEdicao(page, 'evAlvo');
      await page.evaluate(() => { document.querySelector('#eventoFormBloqueioLista input[value="evSumiu"]').checked = false; });
      await salvar(page);
      escritasTodas.push(...(await page.evaluate(() => (window.__ESCRITAS || []).map((e) => e.path))));
      gr = await lerNo(page, 'eventos/evAlvo');
      anota(f.nome + ': 5. desmarcar a referência antiga é o que a tira', igual(marcados(gr.bloqueiaParticipantesDe), ['evC', 'evOff']) && igual(marcados(gr.umaTurmaComEventos), ['evC', 'evSumiu2']), JSON.stringify(gr.bloqueiaParticipantesDe));

      const fora = escritasTodas.filter((p) => !/^eventos\/evAlvo(\/|$)/.test(p) && !/^roteiro-tipos-atividade$|^treinamentos\/[^/]+$/.test(p));
      anota(f.nome + ': 7. toda gravação é em eventos/evAlvo', escritasTodas.length > 0 && !fora.length, JSON.stringify(fora));
      await abrirEdicao(page, 'evAlvo');
      const larg = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      anota(f.nome + ': 7. sem rolagem lateral, sem erro de JS', !larg && !erros.length, JSON.stringify({ larg, erros }));
    } finally { await ctx.close(); }

    /* 6. evento novo e renomeado */
    const { ctx: c2, page: p2, erros: e2 } = await abrir(browser, f.vp, f.mob, 'mudou');
    try {
      await abrirEdicao(p2, 'evAlvo');
      const b2 = await lista(p2, 'eventoFormBloqueioLista');
      const beta = b2.find((x) => x.key === 'evB') || {};
      anota(f.nome + ': 6. evento renomeado continua marcado, com o nome novo', beta.marcado && /EVENTO BETA RENOMEADO/.test(beta.texto), JSON.stringify(beta));
      const novo = b2.find((x) => x.key === 'evNovo') || {};
      anota(f.nome + ': 6. evento novo aparece sozinho (desmarcado), antes dos não publicados', !!novo.key && !novo.marcado && b2.findIndex((x) => x.key === 'evNovo') < b2.findIndex((x) => x.key === 'evOff'), JSON.stringify(b2.map((x) => x.key)));
      await p2.click('.modal-box .admin-modal-cancel-btn');
      await p2.evaluate(() => Array.from(document.querySelectorAll('button')).find((x) => /\+ Novo evento/.test(x.textContent)).click());
      await esperarCondicao(p2, () => !!document.querySelector('#eventoFormBloqueioLista .evento-bloqueio-cb'), null, { descricao: 'o formulário de evento novo' });
      const n = await lista(p2, 'eventoFormBloqueioLista');
      anota(f.nome + ': 6. no evento novo, todos os eventos aparecem e nenhum vem marcado', n.length === 11 && !n.some((x) => x.marcado), JSON.stringify(n.map((x) => x.key)));
      anota(f.nome + ': 7. sem erro de JS (evento novo e renomeado)', !e2.length, JSON.stringify(e2));
    } finally { await c2.close(); }
  }
  await browser.close();
  console.log('\n' + oks + ' ok, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
