/* Card de turma (aba Turmas): o(s) dia(s) do mês precisam ler como dia(s),
 * não como um número solto.
 *
 * POR QUE ESTE TESTE EXISTE
 * O card mostra o mês grande ("SETEMBRO") e, embaixo, só os números dos
 * dias. Com duas ou mais datas a vírgula/"e" já dá a pista de que é uma
 * lista ("11, 12 e 18"); com uma data só, o número fica sozinho ("16") e
 * não lê como dia nenhum — parece um valor perdido, sem relação com o mês
 * acima. A correção prefixa "dia"/"dias" (concordando em número) nos dois
 * casos, com a mesma regra — sem tratar o singular como excepção.
 *
 * Roda com o Firebase falso, nos dois formatos de tela.
 *
 * O QUE ELE EXIGE, em desktop e celular:
 *   1. turma de um dia só: o card mostra "dia 16", não "16" sozinho;
 *   2. turma de vários dias: o card mostra "dias 11, 12 e 18", não só
 *      "11, 12 e 18";
 *   3. turma de um dia só com interesse encerrado: a frase de "Inscrições
 *      encerradas" diz "será realizada no dia 20" (concordância no singular);
 *   4. nenhum erro de JavaScript não tratado.
 */

const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ALUNA = 'aluna@previ.com.br';
const AK = chave(ALUNA);

function banco() {
  const users = {}; users[AK] = { name: 'ALUNA TESTE', email: ALUNA, area: 'INFOR' };
  return {
    'fa-users': users, 'fa-admins': {}, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {
      ev1: { nome: 'EVENTO ÚNICO', order: 1, publicado: true, cargaHoraria: '8', esperaAtiva: false },
    },
    turmas: {
      /* datas bem no futuro: garante cair em "interesse aberto" (tSingle,
         tMulti) e em "Inscrições encerradas" (tFinalizada), nunca em
         "em andamento"/"realizada", qualquer que seja o dia em que o
         teste rodar. */
      tSingle:    { label: 'TURMA ÚNICA',      eventoKey: 'ev1', order: 1, dias: ['2027-09-16'] },
      tMulti:     { label: 'TURMA VÁRIOS DIAS', eventoKey: 'ev1', order: 2, dias: ['2027-08-11', '2027-08-12', '2027-08-18'] },
      tFinalizada: { label: 'TURMA ENCERRADA',  eventoKey: 'ev1', order: 3, dias: ['2027-09-20'] },
    },
    'turmas-interesse': {}, 'turmas-interesse-log': {},
    'turmas-config': { tFinalizada: { finalizada: true } },
    'turmas-checkin': {},
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {},
    avaliacoes: {}, pedidos: {}, holocron: {},
  };
}

async function abrirTurmas(browser, formato) {
  const ctx = await browser.newContext(formato.opts);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify({
    db: banco(), user: { email: ALUNA, emailVerified: true, uid: 'u1' }, delayDefault: 20,
  }) + ';');
  await page.route('**/firebasejs/**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#turmas', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.turmas-evento-titulo', { timeout: 15000 });
  await page.waitForTimeout(1000);
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
      const { ctx, erros, page } = await abrirTurmas(browser, formato);
      const datas = await page.locator('.tc-dates').allInnerTexts();
      const fraseEncerrada = await page.locator('.turma-lotada-msg').innerText();
      await ctx.close();
      if (erros.length) throw new Error('erro de JS não tratado: ' + erros[0]);

      if (datas[0] !== 'dia 16') {
        throw new Error(`turma de um dia só: esperava "dia 16", veio "${datas[0]}"`);
      }
      console.log(`  ok    turma de um dia só: "${datas[0]}"`);

      if (datas[1] !== 'dias 11, 12 e 18') {
        throw new Error(`turma de vários dias: esperava "dias 11, 12 e 18", veio "${datas[1]}"`);
      }
      console.log(`  ok    turma de vários dias: "${datas[1]}"`);

      if (!/será realizada no dia 20\b/.test(fraseEncerrada)) {
        throw new Error(`frase de inscrições encerradas sem "no dia 20": "${fraseEncerrada}"`);
      }
      console.log('  ok    inscrições encerradas (1 dia): "...será realizada no dia 20..."');
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
