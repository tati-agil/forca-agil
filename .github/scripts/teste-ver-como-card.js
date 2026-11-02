/* Turmas › "Ver esta tela como": o CARD (mensagem e botão) e a LISTA DE ESPERA mostram a situação da PESSOA escolhida,
 * igual ao que ela vê no próprio login — e nada é gravado enquanto a pré-visualização está ativa.
 *
 * POR QUE ESTE TESTE EXISTE
 * Até 02/11/2026 o "Ver como" trocava a pessoa só na vitrine (o que aparece); o card e a fila continuavam avaliando a
 * ADMINISTRADORA logada. Casos reais: uma gerente com inscrição num evento impeditivo aparecia com "Esta turma é só para
 * gerentes" (era o cargo da administradora); uma gerente sem registro, idem; um técnico inscrito no Episódio I via
 * "Tenho interesse" no Episódio III (era a situação da administradora). No login real das três pessoas a tela já estava
 * certa — o defeito era só do "Ver como". O teste anterior (teste-visibilidade-evento.js) conferia só a vitrine.
 *
 * Roda com o Firebase falso, sem rede nem segredo, com dados sintéticos que reproduzem os episódios (exclusão recíproca,
 * uma turma por pessoa, Gerentes/Técnicos). O QUE ELE EXIGE:
 *   1. TESTE DE EQUIVALÊNCIA: para cada pessoa, a página Turmas no "Ver como" dela (admin logada) é IGUAL à do login
 *      real dela — o mesmo código rodando com a mesma pessoa: eventos na ordem, agrupamento e situação (abertos,
 *      encerrados, realizados), turmas na ordem, botão de cada card (texto, estado, classe), mensagem, aviso do evento,
 *      lista de espera e o TEXTO INTEIRO visível da página. As únicas diferenças admitidas são as da pré-visualização
 *      (a barra do ADMIN, fora da página, e os botões inativos). Gerente com participação anterior, gerente sem, técnico
 *      inscrito em episódio impeditivo, técnico sem impedimento, diretor, pessoa de Outros públicos, exceção do ADMIN,
 *      interesse existente, inscrição confirmada, pessoa de lista — em 1280 e 375 px. Se uma mudança futura fizer os dois
 *      modos divergirem, este teste falha;
 *   2. no "Ver como" todos os botões de participação ficam inativos (aria-disabled, aparência de inativo) e nenhum
 *      caminho grava: clique, teclado e click() programático em "Tenho interesse", "Remover interesse" e lista de espera;
 *   3. leitura do perfil ou dos vínculos que falha: o "Ver como" mostra o mesmo que o login real (nada concluído por falta
 *      de dado);
 *      perfil lento: enquanto não chega, nenhuma turma do evento de Gerentes oferece "Tenho interesse", e depois fica
 *      igual ao login real;
 *   4. "— eu mesma —" volta tudo: o mesmo card do login real da administradora, botões ativos, e o clique grava em nome
 *      DELA (a sessão real);
 *   5. nenhum erro de JS, sem rolagem lateral; abrir a página não grava nada.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarCondicaoAte } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ADM = 'admin.vc@previ.com.br';            /* administradora: técnica, sem registro */
const LAURA = 'gerente.anterior.vc@previ.com.br'; /* caso A: gerente com inscrição confirmada no Ep I (realizada) */
const GERB = 'gerente.nova.vc@previ.com.br';     /* caso B: gerente que nunca participou (só um interesse removido — o seletor do Ver como lista quem tem registro) */
const THIEGO = 'tecnico.ep1.vc@previ.com.br';    /* caso C: técnico inscrito (confirmado) no Ep I, inscrições encerradas */
const TECB = 'tecnico.novo.vc@previ.com.br';     /* técnico sem inscrição (só um interesse removido) */
const EXC = 'excecao.vc@previ.com.br';           /* técnico incluído pelo ADMIN no Ep IV como exceção (inscrito) */
const INTER = 'interesse.vc@previ.com.br';       /* gerente com interesse no Ep IV */
const LISTADA = 'listada.vc@previ.com.br';       /* técnica na lista de convidados de uma turma e de um evento */
const OCUPA = 'ocupa.vc@previ.com.br';           /* ocupa a única vaga da turma lotada */
const DIR = 'diretor.vc@previ.com.br';           /* diretor (aba Diretores), interesse no evento de Diretores */
const EST = 'estagiaria.vc@previ.com.br';        /* Outros públicos: estagiária, interesse no evento de Estagiários */
const PESSOAS = [[ADM, 'ADMIN VC'], [LAURA, 'LAURA VC'], [GERB, 'GERENTE NOVA VC'], [THIEGO, 'THIEGO VC'], [TECB, 'TECNICO NOVO VC'],
  [EXC, 'EXCECAO VC'], [INTER, 'INTERESSE VC'], [LISTADA, 'LISTADA VC'], [OCUPA, 'OCUPA VC'], [DIR, 'DIRETOR VC'], [EST, 'ESTAGIARIA VC']];

function dia(o) { const d = new Date(); d.setDate(d.getDate() + o); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
const ev = (nome, order, extra) => Object.assign({ nome, order, publicado: true, esperaAtiva: false, missaoTitulo: 'Missão ' + nome, missaoTexto: 'Texto.', topicos: 'T.', itinerario: ['Dia 1'] }, extra || {});
const tu = (label, eventoKey, order, d, extra) => Object.assign({ label, eventoKey, order, dias: [dia(d)] }, extra || {});
const nomeDe = (e) => PESSOAS.find((p) => p[0] === e)[1];
const reg = (e, extra) => Object.assign({ name: nomeDe(e), email: e, area: 'TI', status: 'interessado', removed: false, date: '2026-10-01T10:00:00.000Z' }, extra || {});
const insc = (e, extra) => reg(e, Object.assign({ status: 'inscrito', confirmedByAdmin: ADM, date: '2026-09-01T10:00:00.000Z' }, extra || {}));
const pessoa = (e) => ({ email: e, name: nomeDe(e) });

function banco() {
  const users = {}; PESSOAS.forEach(([e, n]) => { users[chave(e)] = { name: n, email: e, area: 'TI', emailConfirmado: true }; });
  const mutua = (k) => Object.fromEntries(['ep1', 'ep3', 'ep4'].filter((x) => x !== k).map((x) => [x, true]));
  const lista = { [chave(LISTADA)]: pessoa(LISTADA) };
  return {
    'fa-users': users, 'fa-admins': { [chave(ADM)]: pessoa(ADM) }, 'fa-diretores': { [chave(DIR)]: pessoa(DIR) }, 'fa-facilitadores': {},
    'fa-gerentes': { [chave(LAURA)]: pessoa(LAURA), [chave(GERB)]: pessoa(GERB), [chave(INTER)]: pessoa(INTER) },
    'fa-outros-publicos': { [chave(EST)]: Object.assign(pessoa(EST), { categorias: { estagiario: true }, addedAt: '2026-11-01T10:00:00.000Z', addedBy: ADM }) }, 'publicos-config': { ativo: true, em: '2026-11-02T12:45:42.000Z', por: 'super@previ.com.br', porNome: 'SUPER' },
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {
      ep1: ev('EPISODIO UM', 1, { bloqueiaParticipantesDe: mutua('ep1'), umaTurmaPorPessoa: true, vagasPorTurma: 20 }),
      ep3: ev('EPISODIO TRES', 3, { publicoDesc: 'Técnicos', bloqueiaParticipantesDe: mutua('ep3'), umaTurmaPorPessoa: true, vagasPorTurma: 20 }),
      ep4: ev('EPISODIO QUATRO', 4, { publicoDesc: 'Gerentes', bloqueiaParticipantesDe: mutua('ep4'), umaTurmaPorPessoa: true, vagasPorTurma: 21, esperaAtiva: true }),
      evGeral: ev('GERAL', 5),
      evTodos: ev('GERENTES VISIVEL A TODOS', 6, { publicoDesc: 'Gerentes', visibilidade: 'todos', esperaAtiva: true }),
      evListaTodos: ev('LISTA VISIVEL A TODOS', 7, { publicoRestrito: true, visibilidade: 'todos' }),
      evDir: ev('SO DIRETORES', 8, { publicoDesc: 'Diretores' }),
      evEst: ev('SO ESTAGIARIOS', 9, { publicoDesc: 'Estagiários', visibilidade: 'todos' }),
    },
    turmas: {
      t1Real: tu('EP1 REALIZADA', 'ep1', 1, -30), t1Enc: tu('EP1 ENCERRADA', 'ep1', 2, 25), t1Ab: tu('EP1 ABERTA', 'ep1', 3, 26),
      t3a: tu('EP3 T1', 'ep3', 1, 20), t3Lot: tu('EP3 LOTADA', 'ep3', 2, 21, { vagas: 1 }),
      t4a: tu('EP4 T1', 'ep4', 1, 22), t4b: tu('EP4 T2', 'ep4', 2, 23),
      tG1: tu('GERAL T1', 'evGeral', 1, 24), tGLista: tu('GERAL LISTA', 'evGeral', 2, 24, { publicoRestrito: true }),
      tTodos: tu('TODOS T1', 'evTodos', 1, 27), tLT: tu('LISTA TODOS T1', 'evListaTodos', 1, 28),
      tAnd: { label: 'GERAL EM ANDAMENTO', eventoKey: 'evGeral', order: 3, dias: [dia(-1), dia(2)] },
      tDir: tu('DIR T1', 'evDir', 1, 29), tEst: tu('EST T1', 'evEst', 1, 30),
    },
    'turmas-interesse': {
      t1Real: { [chave(LAURA)]: insc(LAURA) },
      t1Enc: { [chave(THIEGO)]: insc(THIEGO) },
      t3Lot: { [chave(OCUPA)]: reg(OCUPA) },
      tG1: { [chave(GERB)]: reg(GERB, { removed: true, status: 'removido' }), [chave(TECB)]: reg(TECB, { removed: true, status: 'removido' }) },
      tGLista: { [chave(LISTADA)]: reg(LISTADA) },
      tDir: { [chave(DIR)]: reg(DIR) }, tEst: { [chave(EST)]: reg(EST) },
      t4a: {
        [chave(EXC)]: insc(EXC, { excecaoAdmin: { regras: { cargo: true }, motivo: 'convidado pela diretoria', por: ADM, porNome: 'ADMIN VC', em: '2026-10-20T10:00:00.000Z', turma: 't4a' } }),
        [chave(INTER)]: reg(INTER),
      },
    },
    'turmas-interesse-log': {}, 'turmas-config': { t1Enc: { finalizada: true }, t1Real: { encerrada: true } },
    'turmas-checkin': {}, 'turmas-sorteio': {}, 'turmas-equipe': {},
    'turmas-publico': { tGLista: lista }, 'eventos-publico': { evListaTodos: lista },
    avaliacoes: {}, pedidos: {}, holocron: {},
  };
}

async function abrir(browser, email, viewport, mobile, rede) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: !!mobile, hasTouch: !!mobile });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify(Object.assign({ db: banco(), user: { email, emailVerified: true, uid: 'u-' + chave(email) }, delayDefault: 20 }, rede || {})) + ';');
  await page.addInitScript(() => {
    window.__redesenhos = 0;
    document.addEventListener('DOMContentLoaded', () => {
      const h = document.querySelector('.turmas-eventos');
      if (h) new MutationObserver(() => { window.__redesenhos++; }).observe(h, { childList: true });
    });
  });
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#turmas', { waitUntil: 'domcontentloaded' });
  await assentar(page);
  return { ctx, page, erros };
}

/* sessão aberta, grade parada (sem redesenho novo em 1,5 s) e nenhum botão em "Verificando…" */
async function assentar(page) {
  await esperarCondicao(page, () => !!(window.faAuth && window.faAuth.getSession()) && !!document.querySelector('.turmas-eventos .turma-card-new'),
    null, { limite: 15000, descricao: 'sessão aberta e grade desenhada' });
  for (let i = 0; i < 10; i++) {
    const n = await page.evaluate(() => window.__redesenhos);
    if (!(await esperarCondicaoAte(page, (m) => window.__redesenhos > m, n, { limite: 1500 }))) break;
  }
  await esperarCondicao(page, () => !Array.from(document.querySelectorAll('.btn--interest, .btn--espera')).some((b) => b.offsetParent !== null && /Verificando/.test(b.textContent)),
    null, { limite: 15000, descricao: 'nenhum botão em "Verificando…"' });
}

/* o que a pessoa VÊ, NA ORDEM: cada evento (situação, avisos, lista de espera) com as suas turmas (botão — texto, estado,
   classe —, mensagem), mais o texto inteiro visível da página. Os mapas por chave (turmas/avisos/fila) são para as
   asserções sobre os casos. */
function cards(page) {
  return page.evaluate(() => {
    const txt = (el) => ((el && el.textContent) || '').replace(/\s+/g, ' ').trim();
    const botao = (b) => (b && b.offsetParent !== null ? txt(b) : null);
    const estadoBtn = (b) => (b && b.offsetParent !== null ? { estado: b.dataset.state || '', classe: b.className.split(/\s+/).sort().join(' ') } : null);
    const host = document.querySelector('.turmas-eventos');
    const grupos = Array.from(host.querySelectorAll('.turmas-evento-grupo'));
    const turmaDe = (c) => ({ key: c.getAttribute('data-turma-key'), botao: botao(c.querySelector('.btn--interest')), btn: estadoBtn(c.querySelector('.btn--interest')), msg: txt(c.querySelector('.turma-intent-msg')) });
    return {
      paginas: grupos.map((g) => ({
        ev: g.getAttribute('data-evento-key'), periodo: g.getAttribute('data-evento-periodo'),
        avisos: Array.from(g.querySelectorAll('.turmas-evento-publico')).map(txt),
        turmas: Array.from(g.querySelectorAll('.turma-card-new[data-turma-key]')).map(turmaDe),
        fila: g.querySelector('.turma-card-espera') ? { botao: botao(g.querySelector('.btn--espera')), btn: estadoBtn(g.querySelector('.btn--espera')), msg: txt(g.querySelector('.turma-card-espera .turma-intent-msg')) } : null,
      })),
      divisores: Array.from(host.querySelectorAll('.turmas-periodo-divisor')).map(txt),
      texto: (host.innerText || '').replace(/\s+/g, ' ').trim(),
      turmas: Object.fromEntries(Array.from(document.querySelectorAll('.turmas-eventos .turma-card-new[data-turma-key]')).map((c) => [c.getAttribute('data-turma-key'),
        { botao: botao(c.querySelector('.btn--interest')), msg: txt(c.querySelector('.turma-intent-msg')) }])),
      avisos: Object.fromEntries(grupos.map((g) => [g.getAttribute('data-evento-key'), Array.from(g.querySelectorAll('.turmas-evento-publico')).map(txt)])),
      fila: Object.fromEntries(grupos.filter((g) => g.querySelector('.turma-card-espera')).map((g) => [g.getAttribute('data-evento-key'),
        { botao: botao(g.querySelector('.btn--espera')), msg: txt(g.querySelector('.turma-card-espera .turma-intent-msg')) }])),
      notaCargo: (document.querySelector('[data-cargo-pendente]') || { getAttribute: () => '' }).getAttribute('data-cargo-pendente'),
    };
  });
}
const extras = (page) => page.evaluate(() => ({
  escritas: (window.__ESCRITAS || []).map((e) => e.path),
  largura: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  ativos: Array.from(document.querySelectorAll('.btn--interest, .btn--espera')).filter((b) => b.offsetParent !== null && b.getAttribute('aria-disabled') !== 'true').length,
  inativos: Array.from(document.querySelectorAll('.btn--interest, .btn--espera')).filter((b) => b.offsetParent !== null && b.getAttribute('aria-disabled') === 'true' && getComputedStyle(b).cursor === 'not-allowed').length,
  previa: !!document.querySelector('.turmas-eventos.turmas-previa'),
}));

async function verComo(page, email) {
  await esperarCondicao(page, (em) => Array.from(document.querySelectorAll('.turmas-vercomo .aluno-vercomo-sel option')).some((o) => o.dataset.email === em), email, { limite: 15000, descricao: 'a pessoa no seletor "Ver como"' });
  const valor = await page.$eval('.turmas-vercomo .aluno-vercomo-sel', (el, em) => Array.from(el.options).find((o) => o.dataset.email === em).value, email);
  await page.selectOption('.turmas-vercomo .aluno-vercomo-sel', valor);
  await assentar(page);
}
async function euMesma(page) { await page.selectOption('.turmas-vercomo .aluno-vercomo-sel', ''); await assentar(page); }

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/* a comparação completa: eventos na ordem, cada evento inteiro, divisores, nota de cargo e o texto inteiro da página —
   vazio = espelho exato */
function diferencas(a, b) {
  const out = [];
  if (!igual(a.paginas.map((g) => g.ev), b.paginas.map((g) => g.ev))) out.push('eventos/ordem: ' + JSON.stringify(a.paginas.map((g) => g.ev)) + ' × ' + JSON.stringify(b.paginas.map((g) => g.ev)));
  a.paginas.forEach((g, i) => { if (!igual(g, b.paginas[i])) out.push('evento ' + g.ev + ': ver-como=' + JSON.stringify(g) + ' real=' + JSON.stringify(b.paginas[i])); });
  if (!igual(a.divisores, b.divisores)) out.push('divisores: ' + JSON.stringify(a.divisores) + ' × ' + JSON.stringify(b.divisores));
  if (a.notaCargo !== b.notaCargo) out.push('notaCargo: ' + a.notaCargo + ' × ' + b.notaCargo);
  if (!out.length && a.texto !== b.texto) out.push('texto da página difere: ver-como=' + a.texto.slice(0, 300) + ' real=' + b.texto.slice(0, 300));
  return out.join(' | ');
}

(async () => {
  const browser = await chromium.launch();
  let falhas = 0;
  const anota = (r, ok, d) => { if (ok) console.log('  ok    ' + r); else { falhas++; console.error('  FALHA ' + r + (d ? ' → ' + d : '')); } };
  const D = { width: 1280, height: 900 }, M = { width: 375, height: 812 };

  /* o que cada pessoa vê no PRÓPRIO login (a referência) */
  const real = {};
  async function referencia(email, vp, mob, rede, rot) {
    const { ctx, page, erros } = await abrir(browser, email, vp, mob, rede);
    const c = await cards(page), x = await extras(page);
    anota(rot + ': login real abre sem gravar nada, sem erro de JS, sem rolagem lateral', !x.escritas.length && !erros.length && !x.largura, JSON.stringify({ escritas: x.escritas, erros, largura: x.largura }));
    await ctx.close();
    return c;
  }

  console.log('\n== 1. login real de cada pessoa (referência) e as regras de hoje nos três casos ==');
  for (const [email] of PESSOAS.filter((p) => p[0] !== OCUPA)) real[email + '@1280'] = await referencia(email, D, false, null, nomeDe(email) + ' @1280');
  for (const [email] of PESSOAS.filter((p) => p[0] !== OCUPA)) real[email + '@375'] = await referencia(email, M, true, null, nomeDe(email) + ' @375');
  {
    const L = real[LAURA + '@1280'], G = real[GERB + '@1280'], T = real[THIEGO + '@1280'];
    const ep4L = ['t4a', 't4b'].map((k) => L.turmas[k]);
    anota('caso A (login real): a gerente vê o Ep IV, sem "só para gerentes", barrada pela participação no Ep I',
      ep4L.every((c) => c && c.botao === null) && !/só para gerentes/.test(JSON.stringify(L)) && /ainda não participou de EPISODIO UM/.test(JSON.stringify(L.avisos.ep4 || []) + JSON.stringify(ep4L)), JSON.stringify({ ep4L, aviso: L.avisos.ep4 }));
    anota('caso B (login real): a gerente sem registro tem "Tenho interesse" no Ep IV e a lista de espera disponível',
      ['t4a', 't4b'].every((k) => G.turmas[k] && /Tenho interesse/.test(G.turmas[k].botao)) && G.fila.ep4 && /Entrar na lista/.test(G.fila.ep4.botao), JSON.stringify({ t: G.turmas, f: G.fila.ep4 }));
    anota('caso C (login real): o técnico inscrito no Ep I não tem "Tenho interesse" no Ep III — o motivo é a participação no Ep I',
      ['t3a', 't3Lot'].every((k) => T.turmas[k] && T.turmas[k].botao === null) && /ainda não participou de EPISODIO UM/.test(JSON.stringify(T.avisos.ep3 || []) + JSON.stringify(T.turmas.t3a)) && T.turmas.t1Enc && /inscrição nesta turma está confirmada/.test(T.turmas.t1Enc.msg), JSON.stringify({ t3: [T.turmas.t3a, T.turmas.t3Lot], av: T.avisos.ep3, t1: T.turmas.t1Enc }));
    const Dr = real[DIR + '@1280'], E = real[EST + '@1280'], Tb = real[TECB + '@1280'];
    anota('diretor e estagiária (login real): cada um vê o seu evento com o próprio registro; o evento de Estagiários (visível a todos) explica o público a quem está fora',
      /Remover interesse/.test((Dr.turmas.tDir || {}).botao || '') && /Remover interesse/.test((E.turmas.tEst || {}).botao || '') && !Tb.turmas.tDir && !!Tb.turmas.tEst && Tb.turmas.tEst.botao === null,
      JSON.stringify({ dir: Dr.turmas.tDir, est: E.turmas.tEst, tecDir: Tb.turmas.tDir, tecEst: Tb.turmas.tEst }));
    anota('turma em andamento: sem botão, para todos', [GERB, TECB, ADM].every((p) => real[p + '@1280'].turmas.tAnd && real[p + '@1280'].turmas.tAnd.botao === null), JSON.stringify(real[GERB + '@1280'].turmas.tAnd));
    const A = real[ADM + '@1280'];
    anota('a administradora (técnica, sem registro) é diferente das três: "só para gerentes" no Ep IV e "Tenho interesse" no Ep III',
      /só para gerentes/.test(JSON.stringify(A.turmas.t4a) + JSON.stringify(A.avisos.ep4)) && /Tenho interesse/.test(A.turmas.t3a.botao || ''), JSON.stringify({ t4a: A.turmas.t4a, t3a: A.turmas.t3a }));
  }

  console.log('\n== 2. "Ver como" (admin logada) = login real da pessoa; pré-visualização sem ação nenhuma ==');
  async function rodada(vp, mob, nomeVp, quem) {
    const { ctx, page, erros } = await abrir(browser, ADM, vp, mob);
    const antes = (await extras(page)).escritas.length;
    for (const email of quem) {
      await verComo(page, email);
      const c = await cards(page), x = await extras(page);
      const dif = diferencas(c, real[email + '@' + nomeVp]);
      anota('Ver como ' + nomeDe(email) + ' @' + nomeVp + ': card, mensagem, aviso e lista de espera iguais ao login real dela', !dif, dif);
      anota('Ver como ' + nomeDe(email) + ' @' + nomeVp + ': pré-visualização marcada, todo botão de participação inativo', x.previa && x.ativos === 0 && x.inativos > 0, JSON.stringify(x));
    }
    /* nenhuma ação grava: clique, teclado e click() programático, em todo botão visível (interesse, remover, fila) */
    for (const email of [GERB, INTER]) {
      await verComo(page, email);
      const antesC = await cards(page);
      const n = await page.evaluate(() => Array.from(document.querySelectorAll('.btn--interest, .btn--espera')).filter((b) => b.offsetParent !== null).length);
      for (let i = 0; i < n; i++) {
        const b = page.locator('.btn--interest:visible, .btn--espera:visible').nth(i);
        await b.click({ force: true }); await b.focus(); await page.keyboard.press('Enter'); await page.keyboard.press(' ');
        await b.evaluate((el) => el.click());
      }
      await page.waitForTimeout(800);
      const x = await extras(page), depois = await cards(page);
      anota('Ver como ' + nomeDe(email) + ' @' + nomeVp + ': ' + n + ' botões clicados (mouse, Enter, espaço, click()) — nada gravado, nada mudou na tela',
        n > 0 && x.escritas.length === antes && igual(depois, antesC), JSON.stringify({ n, escritas: x.escritas.slice(antes), dif: diferencas(depois, antesC) }));
    }
    /* "— eu mesma —": tudo de volta, e a ação volta a gravar em nome da administradora */
    await euMesma(page);
    const c = await cards(page), x = await extras(page);
    const dif = diferencas(c, real[ADM + '@' + nomeVp]);
    anota('"eu mesma" @' + nomeVp + ': o card da administradora volta igual ao login real dela, botões ativos, sem marca de pré-visualização',
      !dif && !x.previa && x.ativos > 0 && x.inativos === 0, dif || JSON.stringify(x));
    if (nomeVp === '1280') {
      await page.locator('.turma-card-new[data-turma-key="tG1"] .btn--interest').click();
      await esperarCondicao(page, () => (window.__ESCRITAS || []).some((e) => e.path.indexOf('turmas-interesse/tG1/') === 0), null, { descricao: 'o interesse gravado' });
      const w = (await extras(page)).escritas.slice(antes);
      anota('"eu mesma": "Tenho interesse" volta a gravar — em nome da sessão real (a administradora), só na própria chave',
        w.length && w.every((p) => p.indexOf('/' + 'admin_vc_previ_com_br') !== -1), JSON.stringify(w));
    }
    anota('Ver como @' + nomeVp + ': sem erro de JS, sem rolagem lateral', !erros.length && !x.largura, JSON.stringify({ erros, largura: x.largura }));
    await ctx.close();
  }
  const TODOS = [LAURA, GERB, THIEGO, TECB, DIR, EST, EXC, INTER, LISTADA];
  await rodada(D, false, '1280', TODOS);
  await rodada(M, true, '375', TODOS);

  console.log('\n== 3. perfil que falha e perfil lento: "Ver como" = login real, nada concluído por falta de dado ==');
  {
    const rede = { fail: ['fa-gerentes/' + chave(LAURA)] };
    const ref = await referencia(LAURA, D, false, rede, 'LAURA VC com a leitura de Gerentes falhando');
    const { ctx, page, erros } = await abrir(browser, ADM, D, false, rede);
    await verComo(page, LAURA);
    const c = await cards(page), dif = diferencas(c, ref);
    anota('falha na leitura de Gerentes: o "Ver como" mostra o mesmo que o login real', !dif, dif);
    anota('falha na leitura de Gerentes: nenhuma turma do Ep IV oferece "Tenho interesse"', !['t4a', 't4b'].some((k) => c.turmas[k] && /Tenho interesse/.test(c.turmas[k].botao || '')), JSON.stringify(c.turmas));
    anota('falha: sem erro de JS', !erros.length, JSON.stringify(erros));
    await ctx.close();
  }
  {
    const rede = { fail: ['turmas-interesse/t1Real/' + chave(LAURA)] };
    const ref = await referencia(LAURA, D, false, rede, 'LAURA VC com a leitura do vínculo dela no Ep I falhando');
    const { ctx, page, erros } = await abrir(browser, ADM, D, false, rede);
    await verComo(page, LAURA);
    const c = await cards(page), dif = diferencas(c, ref);
    anota('falha na leitura dos vínculos: o "Ver como" mostra o mesmo que o login real', !dif, dif);
    anota('falha na leitura dos vínculos: nenhuma turma do Ep IV oferece "Tenho interesse" (falha não vira "sem participação anterior")', !['t4a', 't4b'].some((k) => c.turmas[k] && /Tenho interesse/.test(c.turmas[k].botao || '')), JSON.stringify(c.turmas));
    anota('falha nos vínculos: sem erro de JS', !erros.length, JSON.stringify(erros));
    await ctx.close();
  }
  {
    const rede = { delays: { ['fa-gerentes/' + chave(GERB)]: 3000 } };
    const { ctx, page, erros } = await abrir(browser, ADM, D, false, rede);
    await esperarCondicao(page, (em) => Array.from(document.querySelectorAll('.turmas-vercomo .aluno-vercomo-sel option')).some((o) => o.dataset.email === em), GERB, { descricao: 'a gerente no seletor' });
    const valor = await page.$eval('.turmas-vercomo .aluno-vercomo-sel', (el, em) => Array.from(el.options).find((o) => o.dataset.email === em).value, GERB);
    await page.selectOption('.turmas-vercomo .aluno-vercomo-sel', valor);
    let ofereceuCedo = false;
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(220);
      ofereceuCedo = ofereceuCedo || await page.evaluate(() => ['t4a', 't4b'].some((k) => { const b = document.querySelector('.turma-card-new[data-turma-key="' + k + '"] .btn--interest'); return b && b.offsetParent !== null && /Tenho interesse/.test(b.textContent) && b.getAttribute('aria-disabled') !== 'true'; }));
    }
    await assentar(page);
    const dif = diferencas(await cards(page), real[GERB + '@1280']);
    anota('perfil lento: enquanto Gerentes não responde, nenhum "Tenho interesse" ativo no Ep IV; depois, igual ao login real', !ofereceuCedo && !dif, dif || 'ofereceu cedo');
    anota('perfil lento: sem erro de JS', !erros.length, JSON.stringify(erros));
    await ctx.close();
  }

  await browser.close();
  if (falhas) { console.error('\n' + falhas + ' falha(s).'); process.exit(1); }
  console.log('\nTudo certo.');
})().catch((e) => { console.error(e); process.exit(1); });
