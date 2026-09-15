/* Turmas e Minha Área: cada turma vira um acordeão em vez de tudo aberto
 * ao mesmo tempo.
 *
 * POR QUE ESTE TESTE EXISTE
 * "As informações das turmas aparecem de forma que, se a pessoa tiver
 * acesso a mais de uma turma, não fica claro onde começa a informação de
 * uma e onde começa a de outra." — em Minha Área, os cards de turma tinham
 * borda quase invisível no tema escuro (--line, opacidade .16) e tudo vinha
 * aberto, então duas turmas seguidas pareciam uma única lida corrida. Na
 * aba Turmas, o bloco "A Missão"/"Como funciona"/"Plano de voo" de um
 * evento é tão comprido que, com dois ou mais eventos na vitrine, a virada
 * de um evento pro outro só aparecia depois de rolar um bloco inteiro.
 *
 * A solução (pedida como "expansível", igual accordion) usa <details>/
 * <summary> nativo — mesmo idioma já usado em .manual-card (Manual) — em
 * vez de JS de toggle: o cabeçalho é sempre visível e É a fronteira entre
 * um item e outro; o resto abre/fecha ao clicar.
 *
 * Roda com o Firebase falso, nos dois formatos de tela.
 *
 * O QUE ELE EXIGE, em desktop e celular:
 *   1. Turmas, evento único: o bloco "Sobre o evento" nasce aberto —
 *      comportamento de sempre pro caso mais comum, nada muda pra quem só
 *      vê um evento;
 *   2. Turmas, dois eventos: os dois blocos nascem FECHADOS (o resumo
 *      recolhido já marca a virada de evento) e um clique no de um evento
 *      abre só aquele, sem fechar nem abrir o outro;
 *   3. Minha Área, duas turmas: a primeira nasce aberta (a mais relevante,
 *      sempre a do topo), a segunda nasce fechada, e um clique no
 *      cabeçalho da segunda abre só ela, sem fechar a primeira;
 *   4. nenhum erro de JavaScript não tratado, em nenhum dos casos.
 */

const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ALUNA = 'aluna@previ.com.br';
const AK = chave(ALUNA);

function iso(offsetDias) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  return d.toISOString().slice(0, 10);
}

function bancoTurmasUmEvento() {
  const users = {}; users[AK] = { name: 'ALUNA TESTE', email: ALUNA, area: 'INFOR' };
  return {
    'fa-users': users, 'fa-admins': {}, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {
      ev1: { nome: 'JORNADA DE IMERSÃO', order: 1, publicado: true, cargaHoraria: '16', esperaAtiva: false,
        missaoTitulo: 'Jornada', missaoTexto: 'Texto da missão.', topicos: 'Tópicos.', itinerario: ['Dia 1'] },
    },
    turmas: { tA: { label: 'TURMA A', eventoKey: 'ev1', order: 1, dias: ['2026-11-10'] } },
    'turmas-interesse': {}, 'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {},
    avaliacoes: {}, pedidos: {}, holocron: {},
  };
}

function bancoTurmasDoisEventos() {
  const users = {}; users[AK] = { name: 'ALUNA TESTE', email: ALUNA, area: 'INFOR' };
  return {
    'fa-users': users, 'fa-admins': {}, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {
      ev1: { nome: 'JORNADA DE IMERSÃO', order: 1, publicado: true, cargaHoraria: '16', esperaAtiva: false,
        missaoTitulo: 'Jornada', missaoTexto: 'Texto da missão 1.', topicos: 'Tópicos 1.', itinerario: ['Dia 1'] },
      ev2: { nome: 'OFICINA DE AGILIDADE', order: 2, publicado: true, cargaHoraria: '8', esperaAtiva: false,
        missaoTitulo: 'Oficina', missaoTexto: 'Texto da missão 2.', topicos: 'Tópicos 2.', itinerario: ['Dia 1'] },
    },
    turmas: {
      tA: { label: 'TURMA A', eventoKey: 'ev1', order: 1, dias: ['2026-11-10'] },
      tC: { label: 'TURMA C', eventoKey: 'ev2', order: 1, dias: ['2026-11-20'] },
    },
    'turmas-interesse': {}, 'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {},
    avaliacoes: {}, pedidos: {}, holocron: {},
  };
}

function bancoMinhaAreaDuasTurmas() {
  const users = {}; users[AK] = { name: 'ALUNA TESTE', email: ALUNA, area: 'INFOR' };
  return {
    'fa-users': users, 'fa-admins': {}, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {
      ev1: { nome: 'JORNADA DE IMERSÃO', order: 1, publicado: true, cargaHoraria: '16', percentualMinimo: 75 },
      ev2: { nome: 'OFICINA DE AGILIDADE', order: 2, publicado: true, cargaHoraria: '8', percentualMinimo: 75 },
    },
    turmas: {
      tA: { label: 'TURMA A — SETEMBRO DE 2026', eventoKey: 'ev1', dias: [iso(-5), iso(-2), iso(2), iso(5)] },
      tB: { label: 'TURMA B — OUTUBRO DE 2026', eventoKey: 'ev2', dias: [iso(-3), iso(-1), iso(3), iso(6)] },
    },
    'turmas-interesse': {
      tA: { [AK]: { status: 'inscrito', confirmedByAdmin: ALUNA, name: 'ALUNA TESTE', email: ALUNA, date: iso(-8) } },
      tB: { [AK]: { status: 'inscrito', confirmedByAdmin: ALUNA, name: 'ALUNA TESTE', email: ALUNA, date: iso(-6) } },
    },
    'turmas-interesse-log': {}, 'turmas-config': {},
    'turmas-checkin': { tA: { [iso(-5)]: { [AK]: true }, [iso(-2)]: { [AK]: true } }, tB: { [iso(-3)]: { [AK]: true } } },
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {},
    avaliacoes: {}, pedidos: {}, holocron: {},
  };
}

async function abrirPagina(browser, formato, db, hash, seletorPronto) {
  const ctx = await browser.newContext(formato.opts);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({
    db: db, user: { email: ALUNA, emailVerified: true, uid: 'u1' }, delayDefault: 20,
  }) + ';');
  await page.route('**/firebasejs/**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#' + hash, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(seletorPronto, { timeout: 15000 });
  await page.waitForTimeout(800);
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
      // 1. Turmas, evento único: abre sozinho.
      {
        const { ctx, erros, page } = await abrirPagina(
          browser, formato, bancoTurmasUmEvento(), 'turmas', '.turmas-evento-titulo');
        const abertos = await page.locator('.turmas-missao').evaluateAll((els) => els.map((e) => e.hasAttribute('open')));
        await ctx.close();
        if (erros.length) throw new Error('[turmas, 1 evento] erro de JS não tratado: ' + erros[0]);
        if (JSON.stringify(abertos) !== JSON.stringify([true])) {
          throw new Error(`[turmas, 1 evento] esperava [true] (nasce aberto), veio ${JSON.stringify(abertos)}`);
        }
        console.log('  ok    turmas (1 evento): bloco "Sobre o evento" nasce aberto');
      }

      // 2. Turmas, dois eventos: os dois nascem fechados; clicar no 2º abre só ele.
      {
        const { ctx, erros, page } = await abrirPagina(
          browser, formato, bancoTurmasDoisEventos(), 'turmas', '.turmas-evento-titulo');
        const antes = await page.locator('.turmas-missao').evaluateAll((els) => els.map((e) => e.hasAttribute('open')));
        if (JSON.stringify(antes) !== JSON.stringify([false, false])) {
          await ctx.close();
          throw new Error(`[turmas, 2 eventos] esperava os dois fechados, veio ${JSON.stringify(antes)}`);
        }
        await page.locator('.turmas-missao').nth(1).locator('.turmas-missao-summary').click();
        await page.waitForTimeout(300);
        const depois = await page.locator('.turmas-missao').evaluateAll((els) => els.map((e) => e.hasAttribute('open')));
        await ctx.close();
        if (erros.length) throw new Error('[turmas, 2 eventos] erro de JS não tratado: ' + erros[0]);
        if (JSON.stringify(depois) !== JSON.stringify([false, true])) {
          throw new Error(`[turmas, 2 eventos] esperava só o 2º aberto após o clique, veio ${JSON.stringify(depois)}`);
        }
        console.log('  ok    turmas (2 eventos): os dois nascem fechados; clicar no 2º abre só ele');
      }

      // 3. Minha Área, duas turmas: a 1ª nasce aberta, a 2ª fechada; clicar na 2ª abre só ela.
      {
        const { ctx, erros, page } = await abrirPagina(
          browser, formato, bancoMinhaAreaDuasTurmas(), 'minha-area', '#minhaAreaContent .aluno-sec-title');
        const antes = await page.locator('.aluno-card--expansivel').evaluateAll((els) => els.map((e) => e.hasAttribute('open')));
        if (JSON.stringify(antes) !== JSON.stringify([true, false])) {
          await ctx.close();
          throw new Error(`[minha área] esperava [true, false] (1ª aberta, 2ª fechada), veio ${JSON.stringify(antes)}`);
        }
        await page.locator('.aluno-card--expansivel').nth(1).locator('.aluno-card-toggle').click();
        await page.waitForTimeout(300);
        const depois = await page.locator('.aluno-card--expansivel').evaluateAll((els) => els.map((e) => e.hasAttribute('open')));
        await ctx.close();
        if (erros.length) throw new Error('[minha área] erro de JS não tratado: ' + erros[0]);
        if (JSON.stringify(depois) !== JSON.stringify([true, true])) {
          throw new Error(`[minha área] esperava as duas abertas após o clique na 2ª, veio ${JSON.stringify(depois)}`);
        }
        console.log('  ok    minha área (2 turmas): 1ª nasce aberta, 2ª fechada; clicar na 2ª abre sem fechar a 1ª');
      }
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
