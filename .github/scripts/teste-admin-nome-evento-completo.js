/* Painel Admin, aba Eventos: o nome do evento não pode ser cortado com "…".
 *
 * POR QUE ESTE TESTE EXISTE
 * "Os nomes aparecem cortados" — o span do nome do evento, no cabeçalho do
 * acordeão (admin.js), tinha overflow:hidden;text-overflow:ellipsis;
 * white-space:nowrap. Um evento sem público restrito (poucos selos) cabia
 * inteiro numa linha e escondia o problema; um evento COM público restrito
 * ganha dois elementos a mais na mesma linha (selo "público restrito do
 * evento · N" + botão "Público restrito do evento"), disputando espaço com
 * o nome — e o nome perdia, virando "FORÇA ÁGIL - ...". O nome é a única
 * coisa ali que identifica QUAL evento é aquele card: não pode ser a parte
 * que sai cortada quando falta espaço.
 *
 * Roda com o Firebase falso, no desktop (é o painel Admin — não tem
 * variante mobile documentada para esta tela).
 *
 * O QUE ELE EXIGE, com um evento de nome longo E público restrito (o
 * cenário que reproduz o corte: nome grande brigando com dois selos a
 * mais na mesma linha):
 *   1. o elemento do nome nunca corta com "…" (sem white-space:nowrap,
 *      sem text-overflow:ellipsis) — quebra linha em vez disso;
 *   2. sem transbordo horizontal escondido (scrollWidth não passa do
 *      clientWidth): o nome inteiro cabe, só que em mais de uma linha;
 *   3. o texto completo do evento aparece nessa área da tela, não só no
 *      DOM (textContent sempre teve o nome inteiro — o bug era visual);
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

const NOME_LONGO = 'FORÇA ÁGIL · EXPERIÊNCIA EXECUTIVA DE MENTALIDADE ÁGIL + INTELIGÊNCIA ARTIFICIAL';

function banco() {
  const users = {}; users[AK] = { name: 'ADMIN', email: ADM, area: 'INFOR' };
  const admins = {}; admins[AK] = { email: ADM, name: 'ADMIN' };
  const publicoEv = {};
  for (let i = 0; i < 7; i++) publicoEv['pessoa' + i + '_previ_com_br'] = { name: 'PESSOA ' + i, email: 'pessoa' + i + '@previ.com.br' };
  return {
    'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {
      evLongo: { nome: NOME_LONGO, order: 1, publicado: true, cargaHoraria: '3.5', publicoRestrito: true },
    },
    turmas: { tA: { label: 'TURMA A', eventoKey: 'evLongo', order: 1, dias: ['2027-09-16'] } },
    'turmas-interesse': {}, 'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': {}, 'eventos-publico': { evLongo: publicoEv }, 'turmas-equipe': {}, 'turmas-sorteio': {},
    avaliacoes: {}, pedidos: {}, holocron: {},
  };
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
    await page.waitForSelector('.admin-tab-btn', { timeout: 15000 });
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('.admin-tab-btn')).find((x) => /Eventos/i.test(x.textContent));
      if (b) b.click();
    });
    await page.waitForSelector('[data-ev-key="evLongo"]', { timeout: 15000 });
    // Espera o selo de público restrito (leitura de eventos-publico) para
    // garantir que o cenário que disputa espaço com o nome já renderizou.
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-ev-key="evLongo"]');
      return el && /público restrito do evento/i.test(el.textContent);
    }, { timeout: 10000 });

    const info = await page.evaluate((nomeEsperado) => {
      const hdr = document.querySelector('[data-ev-key="evLongo"] > div:first-child');
      // Ordem fixa de montagem em admin.js: toggle-icon, nome, meta, depois
      // os selos condicionais — acha pelo texto em vez de confiar no índice.
      const spans = Array.from(hdr.querySelectorAll('span'));
      const nomeEl = spans.find((s) => s.textContent.trim() === nomeEsperado);
      const cs = getComputedStyle(nomeEl);
      return {
        texto: nomeEl.textContent.trim(),
        whiteSpace: cs.whiteSpace,
        textOverflow: cs.textOverflow,
        scrollWidth: nomeEl.scrollWidth,
        clientWidth: nomeEl.clientWidth,
      };
    }, NOME_LONGO);

    anota('o nome do evento está inteiro no texto do elemento', info.texto === NOME_LONGO, `veio "${info.texto}"`);
    anota('o elemento do nome não força uma linha só (white-space != nowrap)',
      info.whiteSpace !== 'nowrap', 'veio "' + info.whiteSpace + '"');
    anota('o elemento do nome não usa reticências (text-overflow != ellipsis)',
      info.textOverflow !== 'ellipsis', 'veio "' + info.textOverflow + '"');
    anota('sem transbordo horizontal escondido (o texto cabe, quebrando linha em vez de cortar)',
      info.scrollWidth <= info.clientWidth + 1,
      `scrollWidth=${info.scrollWidth} clientWidth=${info.clientWidth}`);

    if (erros.length) anota('nenhum erro de JavaScript', false, erros[0]);
  } catch (e) {
    falhas++;
    console.error('  FALHA inesperada: ' + e.message);
  } finally {
    await browser.close();
  }

  if (falhas) { console.error(`\n${falhas} falha(s).`); process.exit(1); }
  console.log('\nTudo certo.');
})();
