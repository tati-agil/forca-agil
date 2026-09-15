/* Bloco "Como funciona" (página Turmas): o chip de público não pode dizer
 * "aberta a todos" quando o evento é de público restrito.
 *
 * POR QUE ESTE TESTE EXISTE
 * "Como é uma turma restrita, não posso usar o termo 'todos executivos',
 * porque além de ser para executivos não é para todos, só para os que
 * tiverem na lista." O chip "Quem participa" do bloco "Como funciona" é
 * montado a partir só da categoria escolhida (Diretores/Executivos/
 * Cedidos/Quadro próprio) — PUBLICO_TXT sempre dizia "aberta a todos os
 * [categoria] da Previ", nunca considerando se o evento também tem público
 * restrito (uma lista de e-mails por cima da categoria). Um evento
 * "Executivos" + público restrito mostrava um texto falso duas vezes: nem
 * é aberta, nem é a todos.
 *
 * Roda com o Firebase falso, no desktop (é conferência de texto, a mesma
 * área já é coberta em 375px pelos testes de acordeão da página Turmas).
 *
 * O QUE ELE EXIGE:
 *   1. evento SEM público restrito, categoria "Executivos": chip diz
 *      "aberta a todos os Executivos da Previ" (comportamento de sempre);
 *   2. o MESMO evento COM público restrito ligado: chip passa a dizer
 *      "restrita a uma lista de Executivos da Previ", nunca "aberta a
 *      todos";
 *   3. nenhum erro de JavaScript não tratado.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ADM = 'adm@previ.com.br';
const AK = chave(ADM);

function banco(publicoRestrito) {
  const users = {}; users[AK] = { name: 'ADMIN', email: ADM, area: 'INFOR' };
  const admins = {}; admins[AK] = { email: ADM, name: 'ADMIN' };
  return {
    'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {
      ev1: {
        nome: 'EVENTO ÚNICO', order: 1, publicado: true, cargaHoraria: '3.5', esperaAtiva: false,
        publicoRestrito: publicoRestrito,
        topicos: 'Tópicos abordados neste evento.',
        itinerario: [],
        publicoDesc: 'Executivos', publicoLabel: 'Obrigatória',
      },
    },
    turmas: { tA: { label: 'TURMA A', eventoKey: 'ev1', order: 1, dias: ['2027-09-16'] } },
    'turmas-interesse': {}, 'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {},
    avaliacoes: {}, pedidos: {}, holocron: {},
  };
}

async function lerChipPublico(browser, publicoRestrito) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({
    db: banco(publicoRestrito), user: { email: ADM, emailVerified: true, uid: 'u1' }, delayDefault: 20,
  }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#turmas', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.turmas-evento-titulo', { timeout: 15000 });
  // Evento único: o bloco "Sobre o evento" já nasce aberto.
  await page.waitForSelector('.ofinfo-item', { timeout: 10000 });
  const texto = await page.$$eval('.ofinfo-item', (els) => {
    const item = els.find((e) => /obrigatória/i.test(e.querySelector('.ofinfo-num').textContent));
    return item ? item.querySelector('.ofinfo-label').textContent.trim() : null;
  });
  await ctx.close();
  return { texto, erros };
}

(async () => {
  const browser = await chromium.launch();
  let falhas = 0;
  const anota = (linha, ok, detalhe) => {
    if (ok) { console.log('  ok    ' + linha); }
    else { falhas++; console.error('  FALHA ' + linha + (detalhe ? ' → ' + detalhe : '')); }
  };

  try {
    const aberto = await lerChipPublico(browser, false);
    anota('evento sem público restrito: chip diz "aberta a todos os Executivos da Previ"',
      /aberta a todos os\s*Executivos da Previ/i.test(aberto.texto), `veio "${aberto.texto}"`);
    if (aberto.erros.length) anota('sem erro de JS (evento aberto)', false, aberto.erros[0]);

    const restrito = await lerChipPublico(browser, true);
    anota('MESMO evento com público restrito: chip diz "restrita a uma lista de Executivos da Previ"',
      /restrita a uma lista de\s*Executivos da Previ/i.test(restrito.texto), `veio "${restrito.texto}"`);
    anota('nunca mais diz "aberta a todos" quando é restrito',
      !/aberta a todos/i.test(restrito.texto), `veio "${restrito.texto}"`);
    if (restrito.erros.length) anota('sem erro de JS (evento restrito)', false, restrito.erros[0]);
  } catch (e) {
    falhas++;
    console.error('  FALHA inesperada: ' + e.message);
  } finally {
    await browser.close();
  }

  if (falhas) { console.error(`\n${falhas} falha(s).`); process.exit(1); }
  console.log('\nTudo certo.');
})();
