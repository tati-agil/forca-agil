/* Turmas: eventos em três partes — inscrições abertas, próximas turmas com
 * inscrições encerradas, eventos já realizados. SÓ EXIBIÇÃO.
 *
 * POR QUE ESTE TESTE EXISTE
 * A PR #451 separava só "atuais" e "realizados": um evento cujas turmas
 * futuras já tinham as inscrições encerradas ficava misturado aos que ainda
 * aceitam interesse. Agora ele vai para uma parte própria, entre os dois. O
 * risco vigiado é confundir "inscrições encerradas" com "evento realizado",
 * fazer a parte depender de quem vê (poder participar não muda o estado do
 * evento) e, pior, sumir com o vínculo de alguém por causa da reordenação.
 *
 * Critério (app.js, turmaAbertaAInteresse / turmaRealizada — os do card):
 *   1. aberto: alguma turma ainda não começou e sem "Encerrar interesse"
 *      (finalizada), ou a fila de espera ligada;
 *   2. encerrado: nenhuma aberta, mas alguma por acontecer ou em andamento;
 *   3. realizado: todas realizadas.
 *
 * O QUE ELE EXIGE, em 1280 e 375 px, para quatro pessoas (sem vínculo,
 * inscrita e interessada numa turma de inscrições encerradas, impedida por
 * participação anterior):
 *   - os casos 1–7 da especificação, cada um na sua parte, cada parte na
 *     ordem manual e com o seu título; a MESMA ordem para as quatro pessoas;
 *   - a inscrita vê "inscrição confirmada" e a interessada "interesse
 *     registrado" no card de inscrições encerradas; quem não tem vínculo,
 *     só o encerramento, sem botão;
 *   - a impedida vê o evento aberto no lugar dele, com o motivo no card;
 *   - fila de espera ligada: com turma por vir (encerrada) o evento fica entre
 *     os abertos; com todas as turmas realizadas, entre os realizados;
 *   - turma lotada continua aberta (o card diz que está lotada, sem botão
 *     disponível e sem anunciar vaga);
 *   - evento fora do público (padrão) fora da tela; o mesmo público com
 *     "Mostrar para todos" aparece entre os abertos, com o aviso de público;
 *   - mudando datas e encerramentos, os eventos trocam de parte;
 *   - todas as turmas visíveis uma vez só; nenhuma escrita; nenhum erro de
 *     JS; sem rolagem horizontal.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
function dia(o) { const d = new Date(); d.setDate(d.getDate() + o); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

const P = { livre: 'livre.tg@previ.com.br', inscrita: 'inscrita.tg@previ.com.br', interessada: 'interessada.tg@previ.com.br', impedida: 'impedida.tg@previ.com.br' };
const nome = (e) => e.split('@')[0].toUpperCase().replace(/\./g, ' ');
const reg = (e, extra) => Object.assign({ name: nome(e), email: e, area: 'TI', status: 'interessado', removed: false, date: '2026-09-01T10:00:00.000Z' }, extra || {});
const insc = (e) => reg(e, { status: 'inscrito', confirmedByAdmin: 'adm.tg@previ.com.br' });
const ev = (n, order, extra) => Object.assign({ nome: n, order, publicado: true, esperaAtiva: false, missaoTexto: 'Sobre ' + n + '.' }, extra || {});
const tu = (label, eventoKey, order, dias) => ({ label, eventoKey, order, dias, horarioInicio: '09:00', horarioFim: '12:00' });

/* alterado: o mesmo banco depois de o admin mexer — caso 14 */
function banco(alterado) {
  const users = {}; Object.values(P).forEach((e) => { users[chave(e)] = { name: nome(e), email: e, area: 'TI', emailConfirmado: true }; });
  const cfg = { tE11: { finalizada: true }, tE3: { finalizada: true }, tE5b: { finalizada: true }, tE6a: { finalizada: true }, tE6c: { finalizada: true } };
  if (alterado) { cfg.tE2 = { finalizada: true }; delete cfg.tE3; }
  return {
    'fa-users': users, 'fa-admins': {}, 'fa-diretores': {}, 'fa-gerentes': {}, 'fa-facilitadores': {}, 'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {
      e1: ev('E1 TODAS REALIZADAS', 1),
      e2: ev('E2 FUTURA ABERTA', 2),
      e3: ev('E3 FUTURA ENCERRADA', 3),
      e4: ev('E4 REALIZADA E FUTURA ABERTA', 11), /* order fora da sequência: prova a ordem manual (caso 13) */
      e5: ev('E5 REALIZADA E FUTURA ENCERRADA', 5),
      e6: ev('E6 VARIAS FUTURAS UMA ABERTA', 6),
      e7: ev('E7 EM ANDAMENTO', 7),
      e8: ev('E8 COM BLOQUEIO', 8, { bloqueiaParticipantesDe: { e1: true } }),
      e9: ev('E9 SO GERENTES PADRAO', 9, { publicoDesc: 'Gerentes' }),
      e10: ev('E10 SO GERENTES PARA TODOS', 10, { publicoDesc: 'Gerentes', visibilidade: 'todos' }),
      e11: ev('E11 FILA E FUTURA ENCERRADA', 12, { esperaAtiva: true }),
      e12: ev('E12 FILA E TODAS REALIZADAS', 13, { esperaAtiva: true }),
      e13: ev('E13 FUTURA LOTADA', 14, { vagasPorTurma: 1 }),
    },
    turmas: {
      tE1a: tu('E1 T1', 'e1', 1, [dia(-40)]), tE1b: tu('E1 T2', 'e1', 2, [dia(-20), dia(-19)]),
      tE2: tu('E2 T1', 'e2', 1, [dia(20)]),
      tE3: tu('E3 T1', 'e3', 1, [dia(15), dia(16)]),
      tE4a: tu('E4 T1', 'e4', 1, [dia(-30)]), tE4b: tu('E4 T2', 'e4', 2, [dia(25)]),
      tE5a: tu('E5 T1', 'e5', 1, [dia(-30)]), tE5b: tu('E5 T2', 'e5', 2, alterado ? [dia(-5)] : [dia(25)]),
      tE6a: tu('E6 T1', 'e6', 1, [dia(10)]), tE6b: tu('E6 T2', 'e6', 2, [dia(11)]), tE6c: tu('E6 T3', 'e6', 3, [dia(12)]),
      tE7: tu('E7 T1', 'e7', 1, [dia(-1), dia(1)]),
      tE8: tu('E8 T1', 'e8', 1, [dia(30)]),
      tE9: tu('E9 T1', 'e9', 1, [dia(30)]),
      tE10: tu('E10 T1', 'e10', 1, [dia(30)]),
      tE11: tu('E11 T1', 'e11', 1, [dia(18)]),
      tE12: tu('E12 T1', 'e12', 1, [dia(-15)]),
      tE13: tu('E13 T1', 'e13', 1, [dia(19)]),
    },
    'turmas-config': cfg,
    'turmas-interesse': {
      tE1a: { [chave(P.impedida)]: insc(P.impedida) },
      tE3: { [chave(P.inscrita)]: insc(P.inscrita), [chave(P.interessada)]: reg(P.interessada) },
      tE13: { ocupa_x: reg('ocupa@outro.previ.com.br') },
    },
    'turmas-interesse-log': {}, 'turmas-checkin': {}, 'turmas-sorteio': {}, 'turmas-equipe': {},
    'turmas-publico': {}, 'eventos-publico': {}, avaliacoes: {}, pedidos: {}, holocron: {},
  };
}

const ESPERADO = {
  atual: ['e2', 'e6', 'e8', 'e10', 'e4', 'e11', 'e13'],
  encerrado: ['e3', 'e5', 'e7'],
  realizado: ['e1', 'e12'],
};
/* depois da mudança: E2 encerra o interesse (vai para o meio), E3 reabre (sobe), a futura de E5 passa (desce) */
const ESPERADO_ALTERADO = {
  atual: ['e3', 'e6', 'e8', 'e10', 'e4', 'e11', 'e13'],
  encerrado: ['e2', 'e7'],
  realizado: ['e1', 'e5', 'e12'],
};
const SEQ = ESPERADO.atual.map(() => 'atual').concat(['|'], ESPERADO.encerrado.map(() => 'encerrado'), ['|'], ESPERADO.realizado.map(() => 'realizado')).join(',');
const DIVISORES = ['Próximas turmas — inscrições encerradas', 'Eventos já realizados'];

async function abrir(browser, email, vp, mob, alterado) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: !!mob, hasTouch: !!mob });
  const page = await ctx.newPage(); const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(alterado), user: { email, emailVerified: true, uid: 'u-' + chave(email) }, delayDefault: 20 }) + ';');
  /* a grade é pintada antes de o login assentar e de novo depois: só vale a leitura depois de alguma conferência da pessoa */
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      new MutationObserver((ms) => { if (ms.some((m) => m.target.hasAttribute && m.target.hasAttribute('data-verificando'))) window.__conferiu = true; })
        .observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['data-verificando'] });
    });
  });
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#turmas', { waitUntil: 'domcontentloaded' });
  await esperarCondicao(page, () => !!document.querySelector('.turma-card-new[data-turma-key="tE8"]'), null, { limite: 15000, descricao: 'a grade de turmas' });
  await esperarCondicao(page, () => window.__conferiu && !document.querySelector('.btn--interest[data-verificando]'), null, { limite: 15000, descricao: 'as conferências da pessoa respondidas' });
  return { ctx, page, erros };
}

const ler = (page) => page.evaluate(() => {
  const host = document.querySelector('.turmas-eventos');
  const partes = { atual: [], encerrado: [], realizado: [] }; const divisores = []; const seq = []; const turmas = [];
  Array.from(host.children).forEach((el) => {
    if (el.classList.contains('turmas-periodo-divisor')) { divisores.push(el.textContent.trim()); seq.push('|'); return; }
    if (!el.classList.contains('turmas-evento-grupo')) return;
    const k = el.getAttribute('data-evento-key'); if (!k) return;
    const p = el.getAttribute('data-evento-periodo'); (partes[p] = partes[p] || []).push(k); seq.push(p);
    el.querySelectorAll('.turmas-grid > .turma-card-new[data-turma-key]').forEach((c) => turmas.push(c.getAttribute('data-turma-key')));
  });
  const card = (tk) => { const c = document.querySelector('.turma-card-new[data-turma-key="' + tk + '"]'); if (!c) return null;
    const b = c.querySelector('.btn--interest'); const v = c.querySelector('[data-vinculo]');
    return { botao: !b ? 'sem' : b.offsetParent === null ? 'oculto' : b.disabled ? 'desabilitado' : 'ativo',
      status: ((c.querySelector('.turma-status-msg') || {}).textContent || '').trim(),
      msg: ((c.querySelector('.turma-intent-msg') || {}).textContent || '').trim(),
      vinculo: v ? { tipo: v.getAttribute('data-vinculo'), texto: v.textContent.trim() } : null }; };
  const g10 = document.querySelector('.turmas-evento-grupo[data-evento-key="e10"]');
  const fila = (k) => { const x = document.querySelector('.turmas-evento-grupo[data-evento-key="' + k + '"] .turma-card-espera'); return !!x; };
  return { partes, divisores, seq: seq.join(','), turmas, tE3: card('tE3'), tE8: card('tE8'), tE2: card('tE2'), tE11: card('tE11'), tE13: card('tE13'),
    filaE11: fila('e11'), filaE12: fila('e12'),
    e10Publico: !!(g10 && g10.querySelector('[data-fora-do-publico]')),
    largura: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    escritas: (window.__ESCRITAS || []).map((e) => e.path) };
});

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const browser = await chromium.launch();
  let falhas = 0, oks = 0;
  const anota = (nomeCaso, ok, det) => { if (ok) { oks++; console.log('  ok    ' + nomeCaso); } else { falhas++; console.error('  FALHA ' + nomeCaso + (det ? ' — ' + det : '')); } };
  const FORMATOS = [{ nome: '1280', vp: { width: 1280, height: 800 } }, { nome: '375', vp: { width: 375, height: 812 }, mob: true }];
  const visiveis = (esp) => Object.values(esp).flat();
  const TURMAS_ESPERADAS = (alterado) => Object.entries(banco(alterado).turmas).filter(([, t]) => t.eventoKey !== 'e9').map(([k]) => k).sort();

  for (const f of FORMATOS) {
    console.log('\n== ' + f.nome + ' px ==');
    const seqs = {};
    for (const [quem, email] of Object.entries(P)) {
      const { ctx, page, erros } = await abrir(browser, email, f.vp, f.mob, false);
      try {
        if (quem === 'inscrita' || quem === 'interessada') {
          await esperarCondicao(page, () => !!document.querySelector('.turma-card-new[data-turma-key="tE3"] [data-vinculo]'), null, { limite: 15000, descricao: 'o vínculo no card encerrado' });
        }
        const e = await ler(page);
        const q = quem + ' ' + f.nome;
        seqs[quem] = e.seq;
        anota(q + ': casos 1–7 e 13 — cada evento na sua parte, cada parte na ordem manual', igual(e.partes, ESPERADO), JSON.stringify(e.partes));
        anota(q + ': os dois títulos, nesta ordem, entre as partes', igual(e.divisores, DIVISORES) && e.seq === SEQ, JSON.stringify({ d: e.divisores, s: e.seq }));
        anota(q + ': caso 12 — fora do público (padrão) não aparece; "Mostrar para todos" entre os abertos com o aviso de público',
          visiveis(e.partes).indexOf('e9') === -1 && e.partes.atual.indexOf('e10') !== -1 && e.e10Publico);
        anota(q + ': todas as turmas visíveis, uma vez só', igual(e.turmas.slice().sort(), TURMAS_ESPERADAS(false)), JSON.stringify(e.turmas));
        if (quem === 'livre') {
          anota(q + ': caso 10 — sem vínculo, o card encerrado diz que as inscrições foram encerradas, sem botão e sem vínculo',
            e.tE3 && e.tE3.botao === 'sem' && /Inscrições encerradas/.test(e.tE3.status) && /foram encerradas/.test(e.tE3.status) && !e.tE3.vinculo, JSON.stringify(e.tE3));
          anota(q + ': caso 2 — a turma aberta continua com "Tenho interesse"', e.tE2 && e.tE2.botao === 'ativo', JSON.stringify(e.tE2));
          anota(q + ': fila ligada com turma por vir (encerrada) — evento entre os abertos, com o card da fila e a turma dizendo que as inscrições foram encerradas',
            e.partes.atual.indexOf('e11') !== -1 && e.filaE11 && e.tE11 && e.tE11.botao === 'sem' && /foram encerradas/.test(e.tE11.status), JSON.stringify({ c: e.tE11, f: e.filaE11 }));
          anota(q + ': fila ligada com todas as turmas realizadas — evento entre os realizados (o card da fila continua no evento, como hoje)',
            e.partes.realizado.indexOf('e12') !== -1 && e.filaE12, JSON.stringify({ p: e.partes.realizado, f: e.filaE12 }));
          anota(q + ': turma lotada continua aberta — evento entre os abertos; o card diz que está lotada, sem botão disponível e sem anunciar vaga',
            e.partes.atual.indexOf('e13') !== -1 && e.tE13 && e.tE13.botao !== 'ativo' && /lotada/i.test(e.tE13.msg) && !/vagas? (dispon|abert)/i.test(e.tE13.msg + e.tE13.status), JSON.stringify(e.tE13));
        }
        if (quem === 'inscrita') {
          anota(q + ': caso 8 — inscrita na turma encerrada vê a inscrição confirmada, e o evento continua em "inscrições encerradas"',
            e.tE3 && e.tE3.vinculo && e.tE3.vinculo.tipo === 'inscrita' && /inscrição nesta turma está confirmada/.test(e.tE3.vinculo.texto) &&
            /foram encerradas/.test(e.tE3.status) && e.partes.encerrado.indexOf('e3') !== -1, JSON.stringify(e.tE3));
        }
        if (quem === 'interessada') {
          anota(q + ': caso 9 — com interesse na turma encerrada, vê o interesse registrado (sem virar inscrição)',
            e.tE3 && e.tE3.vinculo && e.tE3.vinculo.tipo === 'interesse' && /interesse nesta turma continua registrado/.test(e.tE3.vinculo.texto) &&
            !/confirmada/.test(e.tE3.vinculo.texto), JSON.stringify(e.tE3));
        }
        if (quem === 'impedida') {
          anota(q + ': caso 11 — impedida por participação anterior: o evento continua entre os abertos, com o motivo e sem botão ativo',
            e.partes.atual.indexOf('e8') !== -1 && e.tE8 && e.tE8.botao !== 'ativo' && /E1 TODAS REALIZADAS/.test(e.tE8.msg), JSON.stringify(e.tE8));
        }
        anota(q + ': caso 15 — nenhuma escrita, nenhum erro de JS; caso 16 — sem rolagem horizontal',
          !e.escritas.length && !erros.length && !e.largura, JSON.stringify({ escritas: e.escritas, erros, largura: e.largura }));
      } finally { await ctx.close(); }
    }
    anota(f.nome + ': a ordem e as partes não dependem de quem vê (as quatro pessoas, a mesma sequência)', new Set(Object.values(seqs)).size === 1, JSON.stringify(seqs));

    /* caso 14: mudam datas e encerramentos → mudam as partes */
    const { ctx, page, erros } = await abrir(browser, P.livre, f.vp, f.mob, true);
    try {
      const e = await ler(page);
      anota('livre ' + f.nome + ': caso 14 — mudando datas e encerramentos, os eventos trocam de parte (E2 desce ao meio, E3 sobe, E5 vai para os realizados)',
        igual(e.partes, ESPERADO_ALTERADO), JSON.stringify(e.partes));
      anota('livre ' + f.nome + ': depois da mudança, todas as turmas visíveis, nenhuma escrita, nenhum erro',
        igual(e.turmas.slice().sort(), TURMAS_ESPERADAS(true)) && !e.escritas.length && !erros.length && !e.largura, JSON.stringify({ t: e.turmas, w: e.escritas, erros }));
    } finally { await ctx.close(); }
  }
  await browser.close();
  console.log('\n' + oks + ' ok, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
