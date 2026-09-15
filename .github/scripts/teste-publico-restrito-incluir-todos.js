/* Painel Admin — Eventos: incluir de uma vez todo mundo que já está na
 * turma/evento sem estar na lista de público restrito.
 *
 * POR QUE ESTE TESTE EXISTE
 * Quando uma turma (ou o evento dela) vira "público restrito" com gente já
 * inscrita, essa gente continua valendo, mas fica de fora da lista — o
 * painel já avisava disso ("6 pessoas estão nesta turma sem estar no
 * público restrito..."), mas regularizar exigia abrir o modal "👥 Público
 * restrito" e buscar+clicar em cada pessoa, nome por nome, DUAS vezes (uma
 * pro público restrito da turma, outra pro do evento) — trabalho repetitivo
 * pra algo que a tela já lista sozinha. Agora o próprio aviso ganha um
 * botão "Incluir as N na lista" que grava todo mundo de uma vez.
 *
 * Roda com o Firebase falso, que registra cada escrita em window.__ESCRITAS
 * e mantém o mesmo objeto de banco em window.__CFG.db — dá pra ler o estado
 * final direto, sem depender só do que a tela mostra depois do redesenho.
 *
 * O QUE ELE EXIGE:
 *   1. turma E evento restritos, com gente inscrita fora das duas listas:
 *      aparecem DOIS avisos (um por lista), cada um com seu próprio botão
 *      "Incluir as N na lista";
 *   2. clicar no botão da turma grava as pessoas em turmas-publico/<key>,
 *      com nome em maiúsculas, e-mail em minúsculas, área e quem incluiu —
 *      e o aviso da turma some da tela (a lista já reconhece todo mundo);
 *   3. o aviso do evento continua até seu próprio botão ser clicado; clicar
 *      nele grava em eventos-publico/<key> e o aviso some também;
 *   4. nenhum erro de JavaScript não tratado.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ADM = 'adm@previ.com.br';
const AK = chave(ADM);
const P1 = 'pessoa1@previ.com.br';
const P2 = 'pessoa2@previ.com.br';
const P1K = chave(P1), P2K = chave(P2);

function banco() {
  const users = {};
  users[AK] = { name: 'ADMIN', email: ADM, area: 'INFOR' };
  users[P1K] = { name: 'pessoa um', email: P1, area: 'GECAP' };
  users[P2K] = { name: 'pessoa dois', email: P2, area: 'GEBEN' };
  const admins = {}; admins[AK] = { email: ADM, name: 'ADMIN' };
  const interesse = { tA: {} };
  interesse.tA[P1K] = { name: 'PESSOA UM', email: P1, area: 'GECAP', status: 'inscrito', confirmedByAdmin: ADM, date: '2026-01-01T10:00:00.000Z' };
  interesse.tA[P2K] = { name: 'PESSOA DOIS', email: P2, area: 'GEBEN', status: 'inscrito', confirmedByAdmin: ADM, date: '2026-01-02T10:00:00.000Z' };
  return {
    'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    /* Evento E turma viraram restritos DEPOIS que as duas pessoas já
       estavam inscritas — nenhuma delas está em nenhuma das duas listas. */
    eventos: { ev1: { nome: 'EVENTO ÚNICO', order: 1, publicado: true, cargaHoraria: '8', esperaAtiva: false, publicoRestrito: true } },
    turmas: { tA: { label: 'TURMA A', eventoKey: 'ev1', order: 1, dias: ['2027-09-16'], publicoRestrito: true } },
    'turmas-interesse': interesse, 'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': { tA: {} }, 'eventos-publico': { ev1: {} }, 'turmas-equipe': {}, 'turmas-sorteio': {},
    avaliacoes: {}, pedidos: {}, holocron: {},
  };
}

async function abrirTurmaExpandida(page) {
  await page.waitForSelector('.admin-tab-btn', { timeout: 15000 });
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Eventos/i.test(x.textContent));
    if (b) b.click();
  });
  await page.waitForSelector('[data-ev-key="ev1"]', { timeout: 15000 });
  await page.click('[data-ev-key="ev1"] .ev-toggle-icon');
  await page.waitForSelector('#turma-card-tA .turma-admin-title', { timeout: 10000 });
  await page.click('#turma-card-tA .turma-admin-title');
  await page.waitForSelector('#turma-card-tA .turma-aviso-publico', { timeout: 10000 });
}

function botaoIncluirTodos(page, contendo) {
  return page.evaluate((texto) => {
    const avisos = Array.from(document.querySelectorAll('#turma-card-tA .turma-aviso-publico'));
    const aviso = avisos.find((a) => a.textContent.indexOf(texto) !== -1);
    if (!aviso) return null;
    const btn = aviso.querySelector('button');
    return btn ? btn.textContent : null;
  }, contendo);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({
    db: banco(), user: { email: ADM, emailVerified: true, uid: 'u1' }, delayDefault: 20,
  }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());

  let falhas = 0;
  const anota = (linha, ok, detalhe) => {
    if (ok) { console.log('  ok    ' + linha); }
    else { falhas++; console.error('  FALHA ' + linha + (detalhe ? ' → ' + detalhe : '')); }
  };

  try {
    await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
    await abrirTurmaExpandida(page);

    const avisosIniciais = await page.$$eval('#turma-card-tA .turma-aviso-publico', (els) => els.length);
    anota('dois avisos aparecem (turma e evento restritos, ambos sem as 2 pessoas)', avisosIniciais === 2, `veio ${avisosIniciais}`);

    const botaoTurma = await botaoIncluirTodos(page, 'público restrito desta turma');
    anota('botão "Incluir as 2 na lista" aparece no aviso da turma', botaoTurma === 'Incluir as 2 na lista', `veio "${botaoTurma}"`);

    // Clica no botão do aviso da TURMA.
    await page.evaluate(() => {
      const avisos = Array.from(document.querySelectorAll('#turma-card-tA .turma-aviso-publico'));
      const aviso = avisos.find((a) => a.textContent.indexOf('público restrito desta turma') !== -1);
      aviso.querySelector('button').click();
    });
    await page.waitForFunction(() => {
      const avisos = document.querySelectorAll('#turma-card-tA .turma-aviso-publico');
      return avisos.length === 1;
    }, { timeout: 10000 });

    const publicoTurma = await page.evaluate(() => window.__CFG.db['turmas-publico'].tA);
    const chavesTurma = Object.keys(publicoTurma || {}).sort();
    anota('as 2 pessoas foram gravadas em turmas-publico/tA', chavesTurma.length === 2,
      JSON.stringify(publicoTurma));
    const p1 = publicoTurma && publicoTurma[Object.keys(publicoTurma).find((k) => publicoTurma[k].email === P1)];
    anota('nome vai em maiúsculas, e-mail em minúsculas, área preservada, com quem incluiu',
      !!p1 && p1.name === 'PESSOA UM' && p1.email === P1 && p1.area === 'GECAP' && p1.addedBy === ADM,
      JSON.stringify(p1));

    const avisoRestante = await page.$eval('#turma-card-tA .turma-aviso-publico', (el) => el.textContent);
    anota('só sobrou o aviso do evento (o da turma sumiu, já regularizado)',
      avisoRestante.indexOf('público restrito do evento') !== -1,
      `aviso restante: "${avisoRestante}"`);

    // Clica no botão do aviso do EVENTO (agora o único).
    await page.click('#turma-card-tA .turma-aviso-publico button');
    await page.waitForFunction(() => {
      return document.querySelectorAll('#turma-card-tA .turma-aviso-publico').length === 0;
    }, { timeout: 10000 });

    const publicoEvento = await page.evaluate(() => window.__CFG.db['eventos-publico'].ev1);
    anota('as 2 pessoas também foram gravadas em eventos-publico/ev1',
      Object.keys(publicoEvento || {}).length === 2, JSON.stringify(publicoEvento));

    anota('nenhum erro de JavaScript não tratado', erros.length === 0, erros[0]);
  } catch (e) {
    falhas++;
    console.error('  FALHA inesperada: ' + e.message);
  } finally {
    await browser.close();
  }

  if (falhas) { console.error(`\n${falhas} falha(s).`); process.exit(1); }
  console.log('\nTudo certo.');
})();
