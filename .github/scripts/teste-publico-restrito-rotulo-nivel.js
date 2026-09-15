/* Público restrito: o selo/botão precisa dizer se é do EVENTO ou da TURMA.
 *
 * POR QUE ESTE TESTE EXISTE
 * "Por que aparece duas linhas de restrito numa turma de um evento e uma
 * indicação de restrito para outras?" — não era bug: uma turma restrita
 * mostra 1 selo (o dela); um evento restrito mostra 2 elementos (selo +
 * botão) no cabeçalho dele, que aparecem imediatamente acima de suas
 * turmas. Mas os dois níveis usavam o MESMO texto ("PÚBLICO RESTRITO"),
 * sem dizer a qual dos dois cada um se referia — dava pra ver até três
 * menções empilhadas (selo do evento + botão do evento + selo da turma)
 * sem nada as diferenciando.
 *
 * Roda com o Firebase falso, no desktop (é conferência de texto/rótulo, não
 * de layout — o teste de horário e o de "incluir todos" já cobrem a mesma
 * área em 375px).
 *
 * O QUE ELE EXIGE, com um evento restrito E sua turma também restrita:
 *   1. o selo do EVENTO diz "PÚBLICO RESTRITO DO EVENTO";
 *   2. o botão do EVENTO diz "Público restrito do evento";
 *   3. o selo da TURMA diz "PÚBLICO RESTRITO DESTA TURMA" — nunca o mesmo
 *      texto do selo do evento;
 *   4. o botão da turma, dentro do menu ⋯, diz "Público restrito desta
 *      turma";
 *   5. o modal que abre em cada um nomeia o nível certo no título:
 *      "Público restrito do evento — [nome]" / "...da turma — [nome]";
 *   6. nenhum erro de JavaScript não tratado.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const ADM = 'adm@previ.com.br';
const AK = chave(ADM);

function banco() {
  const users = {}; users[AK] = { name: 'ADMIN', email: ADM, area: 'INFOR' };
  const admins = {}; admins[AK] = { email: ADM, name: 'ADMIN' };
  return {
    'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: { ev1: { nome: 'EVENTO ÚNICO', order: 1, publicado: true, cargaHoraria: '8', esperaAtiva: false, publicoRestrito: true } },
    turmas: { tA: { label: 'TURMA A', eventoKey: 'ev1', order: 1, dias: ['2027-09-16'], publicoRestrito: true } },
    'turmas-interesse': {}, 'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': { tA: {} }, 'eventos-publico': { ev1: {} }, 'turmas-equipe': {}, 'turmas-sorteio': {},
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
    await page.waitForSelector('[data-ev-key="ev1"]', { timeout: 15000 });

    // Selo e botão do EVENTO ficam no próprio cabeçalho do evento, sempre visíveis.
    const evTextos = await page.$$eval('[data-ev-key="ev1"] > div:first-child span, [data-ev-key="ev1"] > div:first-child button',
      (els) => els.map((e) => e.textContent.trim()).filter((t) => /público restrito/i.test(t)));
    anota('selo do evento diz "público restrito do evento" (CSS deixa maiúsculo na tela)',
      evTextos.some((t) => /^👥\s*público restrito do evento · 0$/i.test(t)), JSON.stringify(evTextos));
    anota('botão do evento diz "Público restrito do evento"',
      evTextos.some((t) => /^👥\s*Público restrito do evento$/i.test(t)), JSON.stringify(evTextos));

    // Expande o evento e a turma pra ver o selo dela e abrir o menu ⋯.
    await page.click('[data-ev-key="ev1"] .ev-toggle-icon');
    await page.waitForSelector('#turma-card-tA .turma-admin-title', { timeout: 10000 });
    await page.click('#turma-card-tA .turma-admin-title');

    const selosTurma = await page.$$eval('#turma-card-tA .turma-status-badge',
      (els) => els.map((e) => e.textContent.trim()));
    anota('selo da turma diz "PÚBLICO RESTRITO DESTA TURMA", nunca "DO EVENTO"',
      selosTurma.some((t) => /PÚBLICO RESTRITO DESTA TURMA/.test(t)) && !selosTurma.some((t) => /DO EVENTO/.test(t)),
      JSON.stringify(selosTurma));

    await page.click('#turma-card-tA .taa-more-btn');
    const botaoTurma = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('#turma-card-tA .taa-dropdown button'))
        .find((b) => /público restrito/i.test(b.textContent));
      return btn ? btn.textContent.trim() : null;
    });
    anota('botão da turma (menu ⋯) diz "Público restrito desta turma"',
      botaoTurma === '👥 Público restrito desta turma', `veio "${botaoTurma}"`);

    // Abre o modal da turma e confirma o título — conta quantos .modal-box
    // já existem (o de login mora escondido na página desde o começo) e
    // espera aparecer mais um, pra não pegar o h3 errado.
    const antesTurma = await page.$$eval('.modal-box', (els) => els.length);
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('#turma-card-tA .taa-dropdown button'))
        .find((b) => /público restrito/i.test(b.textContent));
      btn.click();
    });
    // .modal-box:last-of-type é por PAI, não por ordem no documento — cada
    // modal tem seu próprio overlay como pai, então a pseudo-classe não
    // serve aqui; pega o último elemento do array em vez disso.
    await page.waitForFunction((n) => document.querySelectorAll('.modal-box').length > n, antesTurma, { timeout: 10000 });
    const tituloTurma = await page.evaluate(() => {
      const boxes = document.querySelectorAll('.modal-box');
      return boxes[boxes.length - 1].querySelector('h3').textContent.trim();
    });
    anota('modal da turma tem título "...da turma — TURMA A"',
      /da turma.*TURMA A/.test(tituloTurma), `veio "${tituloTurma}"`);
    await page.evaluate(() => {
      const boxes = document.querySelectorAll('.modal-box');
      boxes[boxes.length - 1].querySelector('.admin-modal-cancel-btn').click();
    });

    // Abre o modal do evento e confirma o título.
    const antesEvento = await page.$$eval('.modal-box', (els) => els.length);
    await page.click('[data-ev-key="ev1"] button:has-text("Público restrito do evento")');
    await page.waitForFunction((n) => document.querySelectorAll('.modal-box').length > n, antesEvento, { timeout: 10000 });
    const tituloEvento = await page.evaluate(() => {
      const boxes = document.querySelectorAll('.modal-box');
      return boxes[boxes.length - 1].querySelector('h3').textContent.trim();
    });
    anota('modal do evento tem título "...do evento — EVENTO ÚNICO"',
      /do evento.*EVENTO ÚNICO/.test(tituloEvento), `veio "${tituloEvento}"`);

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
