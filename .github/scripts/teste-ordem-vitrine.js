/* Página Turmas: ordem dos eventos e das turmas por quão exclusivo é PARA
 * QUEM está vendo.
 *
 * POR QUE ESTE TESTE EXISTE
 * Não existia critério nenhum pra ordem de exibição quando a pessoa é
 * destinatária de mais de uma oferta ao mesmo tempo — tudo saía só na
 * ordem manual do admin (o campo "order"). Pedido: uma diretora deve ver
 * primeiro o que é feito especificamente para diretores, depois o que é
 * restrito a uma lista da qual ela faz parte, e só por último o que é
 * aberto a todo mundo — a oferta mais dirigida a ELA vem primeiro. Mesma
 * lógica vale, um nível abaixo, para as turmas dentro de um mesmo evento.
 *
 * O banco tem "order" DELIBERADAMENTE ao contrário da exclusividade (o
 * evento aberto tem o menor "order"), pra provar que quem decide agora é
 * a prioridade, não o campo manual — se o teste passasse com "order" no
 * lugar certo, não provaria nada.
 *
 * Roda com o Firebase falso, nos dois formatos de tela.
 *
 * O QUE ELE EXIGE, em desktop e celular:
 *   1. uma diretora vê, nesta ordem: só-diretores, lista-restrita (da qual
 *      ela também faz parte), aberto;
 *   2. quem está na lista restrita mas NÃO é diretora vê, nesta ordem:
 *      lista-restrita, aberto — e o evento só-diretores nem aparece;
 *   3. quem não é diretora nem está em lista nenhuma só vê o aberto;
 *   4. dentro de um mesmo evento, a turma restrita (da qual a pessoa faz
 *      parte) aparece antes da turma aberta;
 *   5. nenhum erro de JavaScript não tratado, em nenhum dos casos.
 */

const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const DIRETORA = 'diretora@previ.com.br';
const LISTADA  = 'listada@previ.com.br';
const COMUM    = 'comum@previ.com.br';
const DK = chave(DIRETORA), LK = chave(LISTADA), CK = chave(COMUM);

function bancoEventos() {
  const users = {};
  users[DK] = { name: 'DIRETORA TESTE', email: DIRETORA, area: 'INFOR' };
  users[LK] = { name: 'LISTADA TESTE', email: LISTADA, area: 'INFOR' };
  users[CK] = { name: 'COMUM TESTE', email: COMUM, area: 'INFOR' };
  return {
    'fa-users': users, 'fa-admins': {}, 'fa-facilitadores': {},
    'fa-diretores': { [DK]: { email: DIRETORA, name: 'DIRETORA TESTE' } },
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {
      evAberto:    { nome: 'EVENTO ABERTO',        order: 1, publicado: true, cargaHoraria: '8', esperaAtiva: false },
      evLista:     { nome: 'EVENTO LISTA RESTRITA', order: 2, publicado: true, cargaHoraria: '8', esperaAtiva: false, publicoRestrito: true },
      evDiretores: { nome: 'EVENTO SÓ DIRETORES',   order: 3, publicado: true, cargaHoraria: '8', esperaAtiva: false, restritoADiretores: true },
    },
    turmas: {
      tAberto:    { label: 'TURMA ABERTA',    eventoKey: 'evAberto',    order: 1, dias: ['2026-11-10'] },
      tLista:     { label: 'TURMA LISTA',     eventoKey: 'evLista',     order: 1, dias: ['2026-11-11'] },
      tDiretores: { label: 'TURMA DIRETORES', eventoKey: 'evDiretores', order: 1, dias: ['2026-11-12'] },
    },
    'turmas-interesse': {}, 'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': {},
    'eventos-publico': {
      evLista: {
        [DK]: { email: DIRETORA, name: 'DIRETORA TESTE' },
        [LK]: { email: LISTADA, name: 'LISTADA TESTE' },
      },
    },
    'turmas-equipe': {}, 'turmas-sorteio': {},
    avaliacoes: {}, pedidos: {}, holocron: {},
  };
}

function bancoTurmaInterna() {
  const users = {}; users[LK] = { name: 'LISTADA TESTE', email: LISTADA, area: 'INFOR' };
  return {
    'fa-users': users, 'fa-admins': {}, 'fa-facilitadores': {}, 'fa-diretores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: { ev1: { nome: 'EVENTO ÚNICO', order: 1, publicado: true, cargaHoraria: '8', esperaAtiva: false } },
    turmas: {
      /* "order" ao contrário de propósito: a aberta vem primeiro no campo
         manual, mas a restrita (da qual a pessoa faz parte) tem que vir
         primeiro na tela. */
      tAberta:   { label: 'TURMA ABERTA',   eventoKey: 'ev1', order: 1, dias: ['2026-11-10'] },
      tRestrita: { label: 'TURMA RESTRITA', eventoKey: 'ev1', order: 2, dias: ['2026-11-11'], publicoRestrito: true },
    },
    'turmas-interesse': {}, 'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': { tRestrita: { [LK]: { email: LISTADA, name: 'LISTADA TESTE' } } },
    'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {},
    avaliacoes: {}, pedidos: {}, holocron: {},
  };
}

async function abrirTurmas(browser, formato, db, email) {
  const ctx = await browser.newContext(formato.opts);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({
    db: db, user: { email: email, emailVerified: true, uid: 'u1' }, delayDefault: 20,
  }) + ';');
  await page.route('**/firebasejs/**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#turmas', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800); // dá tempo do fa-diretor-ready/fa-admin-ready resolverem e re-renderizar
  return { ctx, erros, page };
}

(async () => {
  const FORMATOS = [
    { nome: 'desktop', opts: { viewport: { width: 1280, height: 900 } } },
    { nome: 'iPhone', opts: devices['iPhone 12'] },
  ];

  let falhas = 0;
  for (const formato of FORMATOS) {
    const browser = await chromium.launch();
    console.log(`\n== ${formato.nome} ==`);
    try {
      const casos = [
        { rotulo: 'diretora', email: DIRETORA, esperado: ['EVENTO SÓ DIRETORES', 'EVENTO LISTA RESTRITA', 'EVENTO ABERTO'] },
        { rotulo: 'listada (não diretora)', email: LISTADA, esperado: ['EVENTO LISTA RESTRITA', 'EVENTO ABERTO'] },
        { rotulo: 'comum (nenhuma lista)', email: COMUM, esperado: ['EVENTO ABERTO'] },
      ];
      for (const c of casos) {
        const { ctx, erros, page } = await abrirTurmas(browser, formato, bancoEventos(), c.email);
        const titulos = await page.locator('.turmas-evento-titulo').allInnerTexts();
        await ctx.close();
        if (erros.length) throw new Error(`[${c.rotulo}] erro de JS não tratado: ${erros[0]}`);
        if (JSON.stringify(titulos) !== JSON.stringify(c.esperado)) {
          throw new Error(`[${c.rotulo}] ordem esperada ${JSON.stringify(c.esperado)}, veio ${JSON.stringify(titulos)}`);
        }
        console.log(`  ok    ${c.rotulo}: ${titulos.join(' → ') || '(nenhum evento)'}`);
      }

      const { ctx, erros, page } = await abrirTurmas(browser, formato, bancoTurmaInterna(), LISTADA);
      const labels = await page.locator('.tc-label').allInnerTexts();
      await ctx.close();
      if (erros.length) throw new Error('[turma interna] erro de JS não tratado: ' + erros[0]);
      const esperadoTurmas = ['TURMA RESTRITA', 'TURMA ABERTA'];
      if (JSON.stringify(labels) !== JSON.stringify(esperadoTurmas)) {
        throw new Error(`[turma interna] ordem esperada ${JSON.stringify(esperadoTurmas)}, veio ${JSON.stringify(labels)}`);
      }
      console.log(`  ok    turmas dentro do mesmo evento: ${labels.join(' → ')}`);
    } catch (e) {
      falhas++;
      console.error(`  FALHA [${formato.nome}]: ${e.message}`);
    } finally {
      await browser.close();
    }
  }

  if (falhas) { console.error(`\n${falhas} falha(s).`); process.exit(1); }
  console.log('\nTudo certo nos dois formatos.');
})();
