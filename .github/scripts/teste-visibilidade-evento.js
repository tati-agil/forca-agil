/* Turmas: VISIBILIDADE do evento separada da ELEGIBILIDADE para participar.
 *
 * POR QUE ESTE TESTE EXISTE
 * O admin escolhe, em "Editar evento", se o evento aparece só para o público elegível (padrão, e o valor de quem não
 * tem o campo) ou para todos ("Mostrar para todos", eventos/<e>/visibilidade = 'todos'). Visibilidade NUNCA concede
 * participação: quem não é elegível vê o motivo no lugar do botão, e o banco continua recusando (provado no emulador
 * por teste-rules-inscricoes.js, bloco V). O risco aqui é duplo: mostrar o que a pessoa não pode ver (turma de lista,
 * evento de diretores no padrão) ou esconder o que ela tem direito de ver (o próprio vínculo, o evento do seu cargo).
 *
 * Roda com o Firebase falso, sem rede nem segredo. O QUE ELE EXIGE:
 *   1. cada pessoa — gerente, técnica, diretor (não gerente), técnica numa lista, técnica com registro ativo numa
 *      turma de Gerentes, admin — vê exatamente as turmas esperadas, cada uma uma vez só (1280 px; gerente e técnica
 *      também em 1440 e 375 px);
 *   2. no padrão, evento de Gerentes/Técnicos/diretores/lista e turma de cargo ou de lista somem de quem está fora;
 *      quem tem registro ativo continua vendo a sua turma;
 *   3. com "Mostrar para todos": o evento aparece para quem está fora, com o público permitido no título; nenhum
 *      botão de interesse nem de lista de espera disponível para quem não é elegível (o motivo no lugar); turma com
 *      lista própria continua escondida; o elegível continua com o botão;
 *   4. admin vê tudo; "Ver como" a técnica mostra o que ela vê;
 *   5. a separação "Eventos já realizados" (PR #451) continua valendo;
 *   6. nenhuma escrita no banco, nenhum erro de JS, sem rolagem lateral; o controle "Ocultar informações" do evento
 *      visível a todos funciona pelo teclado.
 *   7. ADMIN › Eventos: evento antigo sem o campo e evento novo abrem em "Somente para o público elegível", o gravado
 *      com "todos" abre em "Mostrar para todos"; salvar um evento antigo sem mexer na opção NÃO grava o campo; escolher
 *      "Mostrar para todos" grava só eventos/<evento>, com o campo e "Quem participa" intacto;
 *   8. a vitrine não grava nada, em caminho nenhum: visibilidade nunca toca cadastros, inscrições, fila, acessos ou
 *      históricos.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const GER = 'gerente.vis@previ.com.br', TEC = 'tecnica.vis@previ.com.br', DIR = 'diretor.vis@previ.com.br';
const LISTADA = 'listada.vis@previ.com.br', VINCULO = 'vinculo.vis@previ.com.br', ADM = 'admin.vis@previ.com.br';

function dia(o) { const d = new Date(); d.setDate(d.getDate() + o); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
const info = (n) => ({ missaoTitulo: 'Missão ' + n, missaoTexto: 'Texto do evento ' + n + '.', topicos: 'Tópicos ' + n + '.', itinerario: ['Dia 1'] });
const ev = (nome, order, extra) => Object.assign({ nome, order, publicado: true, esperaAtiva: false }, info(nome), extra || {});
const tu = (label, eventoKey, order, extra) => Object.assign({ label, eventoKey, order, dias: [dia(20 + order)] }, extra || {});
const pessoa = (e, n) => ({ email: e, name: n });

function banco() {
  const users = {};
  [[GER, 'GERENTE'], [TEC, 'TECNICA'], [DIR, 'DIRETOR'], [LISTADA, 'LISTADA'], [VINCULO, 'VINCULO'], [ADM, 'ADMIN']]
    .forEach(([e, n]) => { users[chave(e)] = { name: n, email: e, area: 'TI', emailConfirmado: true }; });
  /* emailConfirmado: como quem já entrou uma vez — senão o LOGIN (auth.js, fora desta mudança) anota a confirmação na
     primeira entrada, e a prova de que a VITRINE não grava nada ficaria misturada com ele */
  const lista = { [chave(LISTADA)]: pessoa(LISTADA, 'LISTADA') };
  const ativo = (e, n) => ({ name: n, email: e, area: 'TI', status: 'interessado', removed: false, date: '2026-10-01T10:00:00.000Z' });
  return {
    'fa-users': users, 'fa-admins': { [chave(ADM)]: pessoa(ADM, 'ADMIN') }, 'fa-diretores': { [chave(DIR)]: pessoa(DIR, 'DIRETOR') },
    'fa-gerentes': { [chave(GER)]: pessoa(GER, 'GERENTE') }, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {
      evGeral: ev('GERAL', 1),
      evGer: ev('SO GERENTES', 2, { publicoDesc: 'Gerentes' }),
      evTec: ev('SO TECNICOS', 3, { publicoDesc: 'Técnicos' }),
      evDir: ev('SO DIRETORES', 4, { restritoADiretores: true }),
      evLista: ev('LISTA DO EVENTO', 5, { publicoRestrito: true }),
      evGerTodos: ev('GERENTES VISIVEL A TODOS', 6, { publicoDesc: 'Gerentes', visibilidade: 'todos', esperaAtiva: true }),
      evDirTodos: ev('DIRETORES VISIVEL A TODOS', 7, { restritoADiretores: true, visibilidade: 'todos' }),
      evListaTodos: ev('LISTA VISIVEL A TODOS', 8, { publicoRestrito: true, visibilidade: 'todos' }),
      evPassadoGer: ev('GERENTES JA REALIZADO', 9, { publicoDesc: 'Gerentes' }),
    },
    turmas: {
      tGeral1: tu('GERAL T1', 'evGeral', 1),
      tGeralLista: tu('GERAL LISTA', 'evGeral', 2, { publicoRestrito: true }),
      tGeralGer: tu('GERAL SO GERENTES', 'evGeral', 3, { publicoCargo: 'gerentes' }),
      tGer1: tu('GER T1', 'evGer', 1), tTec1: tu('TEC T1', 'evTec', 1), tDir1: tu('DIR T1', 'evDir', 1), tLista1: tu('LISTA T1', 'evLista', 1),
      tGerTodos1: tu('GER TODOS T1', 'evGerTodos', 1), tDirTodos1: tu('DIR TODOS T1', 'evDirTodos', 1),
      tListaTodos1: tu('LISTA TODOS T1', 'evListaTodos', 1),
      tListaTodosRestrita: tu('LISTA TODOS TURMA RESTRITA', 'evListaTodos', 2, { publicoRestrito: true }),
      tPassadoGer1: { label: 'PASSADO GER T1', eventoKey: 'evPassadoGer', order: 1, dias: [dia(-30)] },
    },
    'turmas-interesse': {
      tGeral1: { [chave(TEC)]: ativo(TEC, 'TECNICA') },
      tGer1: { [chave(VINCULO)]: ativo(VINCULO, 'VINCULO') },
    },
    'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-sorteio': {}, 'turmas-equipe': {},
    'turmas-publico': { tGeralLista: lista, tListaTodosRestrita: lista },
    'eventos-publico': { evLista: lista, evListaTodos: lista },
    avaliacoes: {}, pedidos: {}, holocron: {},
  };
}

const TODAS = Object.keys(banco().turmas).sort();
const ESPERADO = {
  [GER]: ['tGeral1', 'tGeralGer', 'tGer1', 'tGerTodos1', 'tDirTodos1', 'tListaTodos1', 'tPassadoGer1'],
  [TEC]: ['tGeral1', 'tTec1', 'tGerTodos1', 'tDirTodos1', 'tListaTodos1'],
  [DIR]: ['tGeral1', 'tTec1', 'tDir1', 'tGerTodos1', 'tDirTodos1', 'tListaTodos1'],
  [LISTADA]: ['tGeral1', 'tGeralLista', 'tTec1', 'tLista1', 'tGerTodos1', 'tDirTodos1', 'tListaTodos1', 'tListaTodosRestrita'],
  [VINCULO]: ['tGeral1', 'tTec1', 'tGer1', 'tGerTodos1', 'tDirTodos1', 'tListaTodos1'],
  [ADM]: TODAS,
};
/* evento visível a todos em que a pessoa está fora do público: motivo esperado no título */
const AVISO = {
  [GER]: { evDirTodos: 'diretores', evListaTodos: 'lista' },
  [TEC]: { evGerTodos: 'cargo', evDirTodos: 'diretores', evListaTodos: 'lista' },
  [DIR]: { evGerTodos: 'cargo', evListaTodos: 'lista' },
  [LISTADA]: { evGerTodos: 'cargo', evDirTodos: 'diretores' },
  [VINCULO]: { evGerTodos: 'cargo', evDirTodos: 'diretores', evListaTodos: 'lista' },
  [ADM]: {},
};
/* turmas visíveis a todos em que a pessoa NÃO pode participar (botão nunca disponível) — e onde pode */
const TURMA_DO_EVENTO = { evGerTodos: 'tGerTodos1', evDirTodos: 'tDirTodos1', evListaTodos: 'tListaTodos1' };

async function abrir(browser, email, viewport, mobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: !!mobile, hasTouch: !!mobile });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(), user: { email, emailVerified: true, uid: 'u-' + chave(email) }, delayDefault: 20 }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#turmas', { waitUntil: 'domcontentloaded' });
  await assentar(page);
  return { ctx, page, erros };
}

/* grade desenhada e nenhum botão (interesse ou fila) ainda em "Verificando…" */
async function assentar(page) {
  await esperarCondicao(page, () => {
    if (!document.querySelector('.turmas-eventos .turma-card-new')) return false;
    const vis = (b) => b.offsetParent !== null;
    return !Array.from(document.querySelectorAll('.btn--interest, .btn--espera')).some((b) => vis(b) && /Verificando/.test(b.textContent));
  }, null, { limite: 15000, descricao: 'grade de turmas assentada (nenhum botão em "Verificando…")' });
}

function estado(page) {
  return page.evaluate(() => {
    const vis = (b) => !!b && b.offsetParent !== null && !b.disabled;
    const grupos = Array.from(document.querySelectorAll('.turmas-eventos .turmas-evento-grupo'));
    return {
      turmas: Array.from(document.querySelectorAll('.turmas-eventos .turma-card-new[data-turma-key]')).map((c) => c.getAttribute('data-turma-key')),
      eventos: grupos.map((g) => g.getAttribute('data-evento-key')),
      periodos: Object.fromEntries(grupos.map((g) => [g.getAttribute('data-evento-key'), g.getAttribute('data-evento-periodo')])),
      divisor: !!document.querySelector('.turmas-periodo-divisor'),
      avisos: Object.fromEntries(grupos.filter((g) => g.querySelector('.turmas-evento-publico')).map((g) => [g.getAttribute('data-evento-key'), g.querySelector('.turmas-evento-publico').getAttribute('data-fora-do-publico')])),
      textoAviso: Array.from(document.querySelectorAll('.turmas-evento-publico')).map((p) => p.textContent),
      botao: Object.fromEntries(Array.from(document.querySelectorAll('.turma-card-new[data-turma-key]')).map((c) => [c.getAttribute('data-turma-key'), {
        disponivel: vis(c.querySelector('.btn--interest')), msg: ((c.querySelector('.turma-intent-msg') || {}).textContent || '').trim(),
      }])),
      fila: Object.fromEntries(grupos.filter((g) => g.querySelector('.turma-card-espera')).map((g) => [g.getAttribute('data-evento-key'), {
        disponivel: vis(g.querySelector('.btn--espera')), msg: ((g.querySelector('.turma-card-espera .turma-intent-msg') || {}).textContent || '').trim(),
      }])),
      larguraExcede: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      escritas: (window.__ESCRITAS || []).map((e) => e.path),
      textoPagina: document.querySelector('.turmas-eventos').textContent,
    };
  });
}

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const browser = await chromium.launch();
  let falhas = 0;
  const anota = (r, ok, d) => { if (ok) console.log('  ok    ' + r); else { falhas++; console.error('  FALHA ' + r + (d ? ' → ' + d : '')); } };

  async function conferirPessoa(email, nomeFmt, viewport, mobile) {
    const { ctx, page, erros } = await abrir(browser, email, viewport, mobile);
    try {
      const e = await estado(page);
      const quem = email.split('.')[0] + ' @' + nomeFmt;
      anota(quem + ': vê exatamente as turmas esperadas', igual(e.turmas.slice().sort(), ESPERADO[email].slice().sort()), JSON.stringify(e.turmas.slice().sort()));
      anota(quem + ': nenhuma turma duplicada', new Set(e.turmas).size === e.turmas.length);
      anota(quem + ': público permitido dito nos eventos visíveis a todos em que está fora', igual(e.avisos, AVISO[email]), JSON.stringify(e.avisos));
      for (const evk of Object.keys(AVISO[email])) {
        const t = TURMA_DO_EVENTO[evk];
        anota(quem + ': em ' + evk + ' nenhum botão de interesse disponível, o motivo no lugar', e.botao[t] && !e.botao[t].disponivel && !!e.botao[t].msg, JSON.stringify(e.botao[t]));
      }
      for (const evk of Object.keys(TURMA_DO_EVENTO).filter((k) => !AVISO[email][k] && email !== ADM)) {
        const t = TURMA_DO_EVENTO[evk];
        anota(quem + ': em ' + evk + ' (elegível) o botão "Tenho interesse" continua disponível', e.botao[t] && e.botao[t].disponivel, JSON.stringify(e.botao[t]));
      }
      if (e.fila.evGerTodos) {
        const deveria = email === GER; /* o cargo vale para a própria pessoa — admin que não é gerente também não entra, como no card da turma */
        anota(quem + ': lista de espera do evento de Gerentes visível a todos ' + (deveria ? 'disponível' : 'barrada, com o motivo'),
          deveria ? e.fila.evGerTodos.disponivel : (!e.fila.evGerTodos.disponivel && !!e.fila.evGerTodos.msg), JSON.stringify(e.fila.evGerTodos));
      }
      anota(quem + ': nenhum e-mail de lista nem nome de participante na vitrine', !/listada\.vis|vinculo\.vis|LISTADA|VINCULO/.test(e.textoPagina) || email === LISTADA || email === VINCULO);
      if (email === GER) anota(quem + ': evento de Gerentes já realizado continua sob "Eventos já realizados" (PR #451)', e.divisor && e.periodos.evPassadoGer === 'realizado', JSON.stringify(e.periodos));
      anota(quem + ': nenhuma gravação em caminho nenhum (cadastros, inscrições, fila, acessos, históricos, eventos), sem erro de JS, sem rolagem lateral', !e.escritas.length && !erros.length && !e.larguraExcede, JSON.stringify({ escritas: e.escritas, erros, largura: e.larguraExcede }));
      return { page, ctx, e };
    } catch (x) { await ctx.close(); throw x; }
  }

  console.log('\n== cada pessoa, 1280 px ==');
  for (const email of [GER, TEC, DIR, LISTADA, VINCULO, ADM]) { const r = await conferirPessoa(email, '1280', { width: 1280, height: 900 }); await r.ctx.close(); }

  console.log('\n== gerente e técnica em 1440 e 375 px ==');
  for (const [nome, vp, mob] of [['1440', { width: 1440, height: 900 }, false], ['375', { width: 375, height: 812 }, true]]) {
    for (const email of [GER, TEC]) {
      const r = await conferirPessoa(email, nome, vp, mob);
      if (email === TEC && nome === '375') {
        /* teclado: o controle do evento visível a todos recolhe e reabre só aquele evento */
        const sum = r.page.locator('.turmas-evento-grupo[data-evento-key="evGerTodos"] .turmas-missao-summary');
        await sum.focus();
        await r.page.keyboard.press('Enter');
        await esperarCondicao(r.page, () => { const d = document.querySelector('.turmas-evento-grupo[data-evento-key="evGerTodos"] .turmas-missao'); return !d.open && d.querySelector('.turmas-missao-acao').textContent === 'Ver informações do evento'; }, null, { descricao: 'Enter recolher o evento visível a todos' });
        await r.page.keyboard.press('Enter');
        await esperarCondicao(r.page, () => { const d = document.querySelector('.turmas-evento-grupo[data-evento-key="evGerTodos"] .turmas-missao'); return d.open && d.querySelector('.turmas-missao-acao').textContent === 'Ocultar informações'; }, null, { descricao: 'Enter reabrir o evento visível a todos' });
        anota('tecnica @375: teclado recolhe e reabre as informações do evento visível a todos', true);
      }
      await r.ctx.close();
    }
  }

  console.log('\n== admin: "Ver como" a técnica ==');
  {
    const { ctx, page, erros } = await abrir(browser, ADM, { width: 1280, height: 900 });
    await esperarCondicao(page, (em) => Array.from(document.querySelectorAll('.turmas-vercomo .aluno-vercomo-sel option')).some((o) => o.dataset.email === em), TEC, { descricao: 'a técnica no seletor "Ver como"' });
    const valor = await page.$eval('.turmas-vercomo .aluno-vercomo-sel', (el, em) => Array.from(el.options).find((o) => o.dataset.email === em).value, TEC);
    await page.selectOption('.turmas-vercomo .aluno-vercomo-sel', valor);
    await esperarCondicao(page, (n) => document.querySelectorAll('.turmas-eventos .turma-card-new[data-turma-key]').length === n, ESPERADO[TEC].length, { descricao: 'a vitrine redesenhada como a técnica' });
    await assentar(page);
    const e = await estado(page);
    anota('Ver como técnica: vê exatamente o que a técnica vê', igual(e.turmas.slice().sort(), ESPERADO[TEC].slice().sort()), JSON.stringify(e.turmas));
    anota('Ver como técnica: o público permitido dito como para ela', igual(e.avisos, AVISO[TEC]), JSON.stringify(e.avisos));
    await page.selectOption('.turmas-vercomo .aluno-vercomo-sel', '');
    await esperarCondicao(page, (n) => document.querySelectorAll('.turmas-eventos .turma-card-new[data-turma-key]').length === n, TODAS.length, { descricao: 'a vitrine de volta à visão de admin' });
    const e2 = await estado(page);
    anota('Ver como "eu mesma": admin volta a ver todas as turmas', igual(e2.turmas.slice().sort(), TODAS), JSON.stringify(e2.turmas));
    anota('Ver como: sem escrita, sem erro de JS', !e2.escritas.length && !erros.length, JSON.stringify({ escritas: e2.escritas, erros }));
    await ctx.close();
  }

  console.log('\n== ADMIN › Eventos: "Visibilidade do evento" (abrir, criar, salvar) ==');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', (x) => erros.push(String(x).split('\n')[0]));
    await page.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(), user: { email: ADM, emailVerified: true, uid: 'adm' }, delayDefault: 20 }) + ';');
    await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
    await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('**fonts.gstatic.com**', (r) => r.abort());
    await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
    await esperarCondicao(page, () => Array.from(document.querySelectorAll('.admin-tab-btn')).some((x) => /Eventos/i.test(x.textContent)), null, { limite: 15000, descricao: 'aba Eventos do ADMIN' });
    await page.evaluate(() => Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Eventos/i.test(x.textContent)).click());
    const abrirEdicao = async (k) => {
      await esperarCondicao(page, (kk) => !!document.querySelector('[data-ev-key="' + kk + '"]'), k, { descricao: 'o evento ' + k + ' no ADMIN' });
      await page.evaluate((kk) => Array.from(document.querySelectorAll('[data-ev-key="' + kk + '"] button')).find((x) => /Editar evento/.test(x.textContent)).click(), k);
      await esperarCondicao(page, () => !!document.querySelector('#eventoFormVisElegivel'), null, { descricao: 'o formulário do evento' });
    };
    const marcado = () => page.evaluate(() => ({ elegivel: document.querySelector('#eventoFormVisElegivel').checked, todos: document.querySelector('#eventoFormVisTodos').checked }));
    await abrirEdicao('evGer');
    anota('evento antigo SEM o campo abre em "Somente para o público elegível"', igual(await marcado(), { elegivel: true, todos: false }));
    await page.click('.modal-box .admin-modal-cancel-btn');
    await esperarCondicao(page, () => !document.querySelector('#eventoFormVisElegivel'), null, { descricao: 'o formulário fechar' });
    await abrirEdicao('evGerTodos');
    anota('evento com "todos" gravado abre em "Mostrar para todos"', igual(await marcado(), { elegivel: false, todos: true }));
    await page.click('.modal-box .admin-modal-cancel-btn');
    await esperarCondicao(page, () => !document.querySelector('#eventoFormVisElegivel'), null, { descricao: 'o formulário fechar' });
    await page.evaluate(() => Array.from(document.querySelectorAll('button')).find((x) => /\+ Novo evento/.test(x.textContent)).click());
    await esperarCondicao(page, () => !!document.querySelector('#eventoFormVisElegivel'), null, { descricao: 'o formulário de evento novo' });
    anota('evento NOVO nasce em "Somente para o público elegível"', igual(await marcado(), { elegivel: true, todos: false }));
    await page.click('.modal-box .admin-modal-cancel-btn');
    await esperarCondicao(page, () => !document.querySelector('#eventoFormVisElegivel'), null, { descricao: 'o formulário fechar' });
    /* salvar um evento antigo SEM mexer na opção: o campo não é gravado (ausente já é "elegível") */
    await page.evaluate(() => { window.__ESCRITAS = []; });
    await abrirEdicao('evTec');
    await page.click('.modal-box .admin-modal-save-btn');
    await esperarCondicao(page, () => (window.__ESCRITAS || []).some((x) => x.path === 'eventos/evTec'), null, { descricao: 'a gravação de eventos/evTec' });
    const semMexer = await page.evaluate(() => (window.__ESCRITAS || []).filter((x) => x.path === 'eventos/evTec').pop().valor);
    anota('salvar um evento antigo sem escolher a opção NÃO grava o campo visibilidade', !('visibilidade' in semMexer), JSON.stringify(Object.keys(semMexer)));
    /* salvar: escolher "todos" no evento de Gerentes grava o campo e não mexe no público de quem participa */
    await page.evaluate(() => { window.__ESCRITAS = []; });
    await abrirEdicao('evGer');
    await page.check('#eventoFormVisTodos');
    await page.click('.modal-box .admin-modal-save-btn');
    await esperarCondicao(page, () => (window.__ESCRITAS || []).some((x) => x.path === 'eventos/evGer'), null, { descricao: 'a gravação de eventos/evGer' });
    const gravado = await page.evaluate(() => (window.__ESCRITAS || []).filter((x) => x.path === 'eventos/evGer').pop().valor);
    anota('salvar grava visibilidade = "todos" e mantém "Quem participa" = Gerentes', gravado.visibilidade === 'todos' && gravado.publicoDesc === 'Gerentes' && gravado.restritoADiretores === false && gravado.publicoRestrito === false, JSON.stringify({ v: gravado.visibilidade, p: gravado.publicoDesc }));
    const outras = await page.evaluate(() => (window.__ESCRITAS || []).map((x) => x.path).filter((p) => p !== 'eventos/evGer'));
    anota('salvar grava SÓ eventos/evGer — nenhuma gravação em cadastros, inscrições, fila, acessos, históricos ou outros eventos', !outras.length, JSON.stringify(outras));
    anota('ADMIN sem erro de JS', !erros.length, erros[0]);
    await ctx.close();
  }

  await browser.close();
  if (falhas) { console.error('\n' + falhas + ' falha(s).'); process.exit(1); }
  console.log('\nTUDO OK.');
})();
