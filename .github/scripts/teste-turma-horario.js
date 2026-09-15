/* Horário de início/término por turma — editável no painel, refletido no
 * card público.
 *
 * POR QUE ESTE TESTE EXISTE
 * O card de turma sempre mostrou "9h – 13h" fixo no código, igual pra
 * qualquer turma, mesmo pra quem não é das 9 às 13h. Não existia campo
 * nenhum no painel pra diferenciar — "não sei onde diferencio os horários,
 * porque não são todos de 9 as 13h". Agora cada turma tem seu próprio
 * horário, editável em "✎ Editar turma", com 09:00–13:00 como valor
 * padrão (o que sempre esteve fixo) pra turma criada antes deste campo
 * existir.
 *
 * Roda com o Firebase falso, que registra cada escrita em window.__ESCRITAS
 * — assim dá pra provar que o horário chegou no banco, não só que a tela
 * não deu erro. Só desktop: é fluxo de admin no painel, não telado público.
 *
 * O QUE ELE EXIGE:
 *   1. turma sem horário salvo abre "✎ Editar turma" já com 09:00–13:00
 *      preenchido (não em branco);
 *   2. salvar um horário diferente grava turmas/<key>/horarioInicio e
 *      .../horarioFim, e o card na página Turmas passa a mostrar o
 *      horário novo, não mais "9h – 13h";
 *   3. tentar salvar com término igual ou antes do início é recusado, com
 *      mensagem de erro, e NADA é gravado;
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

function banco() {
  const users = {}; users[AK] = { name: 'ADMIN', email: ADM, area: 'INFOR' };
  const admins = {}; admins[AK] = { email: ADM, name: 'ADMIN' };
  return {
    'fa-users': users, 'fa-admins': admins, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: { ev1: { nome: 'EVENTO ÚNICO', order: 1, publicado: true, cargaHoraria: '8', esperaAtiva: false } },
    /* Turma sem horarioInicio/horarioFim: simula uma turma criada antes
       deste campo existir. */
    turmas: { tA: { label: 'TURMA A', eventoKey: 'ev1', order: 1, dias: ['2027-09-16'] } },
    'turmas-interesse': {}, 'turmas-interesse-log': {}, 'turmas-config': {}, 'turmas-checkin': {},
    'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {}, 'turmas-sorteio': {},
    avaliacoes: {}, pedidos: {}, holocron: {},
  };
}

async function abrirEdicaoDaTurma(page) {
  await page.waitForSelector('.admin-tab-btn', { timeout: 15000 });
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.admin-tab-btn'))
      .find((x) => /Eventos/i.test(x.textContent));
    if (b) b.click();
  });
  await page.waitForSelector('[data-ev-key="ev1"]', { timeout: 15000 });
  await page.click('[data-ev-key="ev1"] .ev-toggle-icon');
  await page.waitForSelector('#turma-card-tA .taa-more-btn', { timeout: 10000 });
  await page.click('#turma-card-tA .taa-more-btn');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('#turma-card-tA .taa-dropdown button'))
      .find((b) => /Editar turma/i.test(b.textContent));
    btn.click();
  });
  await page.waitForSelector('#turmaFormLabel', { timeout: 10000 });
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
  await page.route('**/firebasejs/**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());

  let falhas = 0;
  const anota = (linha, ok, detalhe) => {
    if (ok) { console.log('  ok    ' + linha); }
    else { falhas++; console.error('  FALHA ' + linha + (detalhe ? ' → ' + detalhe : '')); }
  };

  try {
    await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
    await abrirEdicaoDaTurma(page);

    const valoresIniciais = await page.$eval('#turmaFormHoraInicio', (i) => i.value);
    const valoresFinais   = await page.$eval('#turmaFormHoraFim', (i) => i.value);
    anota('turma sem horário salvo abre com 09:00–13:00 preenchido',
      valoresIniciais === '09:00' && valoresFinais === '13:00',
      `veio "${valoresIniciais}"–"${valoresFinais}"`);

    // Tenta salvar horário inválido (término antes do início) — deve recusar.
    await page.fill('#turmaFormHoraInicio', '10:00');
    await page.fill('#turmaFormHoraFim', '09:00');
    await page.click('.modal-box .admin-modal-save-btn');
    await page.waitForTimeout(300);
    const erroTexto = await page.$eval('#turmaFormErr', (e) => e.textContent);
    const erroVisivel = await page.$eval('#turmaFormErr', (e) => getComputedStyle(e).display !== 'none');
    anota('término antes do início é recusado com mensagem de erro',
      erroVisivel && /término.*depois do início/i.test(erroTexto),
      `erro="${erroTexto}" visível=${erroVisivel}`);

    // Corrige para um horário válido e diferente do padrão, e salva.
    await page.fill('#turmaFormHoraInicio', '14:00');
    await page.fill('#turmaFormHoraFim', '18:00');
    await page.click('.modal-box .admin-modal-save-btn');
    await page.waitForSelector('#turmaFormLabel', { state: 'detached', timeout: 10000 });

    const escritas = await page.evaluate(() => window.__ESCRITAS || []);
    const gravacaoTurma = escritas.filter((e) => e.path === 'turmas/tA').pop();
    anota('horário novo é gravado em turmas/tA',
      !!gravacaoTurma && gravacaoTurma.valor.horarioInicio === '14:00' && gravacaoTurma.valor.horarioFim === '18:00',
      JSON.stringify(gravacaoTurma));
    anota('horário inválido do passo anterior NÃO foi gravado',
      !escritas.some((e) => e.path === 'turmas/tA' && e.valor.horarioInicio === '10:00'),
      'uma gravação com horarioInicio 10:00 apareceu em __ESCRITAS');

    // Confirma que o card público (mesma página, sem reload) reflete o novo horário.
    await page.evaluate(() => { location.hash = '#turmas'; });
    await page.waitForSelector('.tc-horario', { timeout: 15000 });
    const horarioCard = await page.$eval('.tc-horario', (e) => e.textContent.trim());
    anota('card público mostra o horário novo, não "9h – 13h"',
      /14h\s*[–-]\s*18h/.test(horarioCard),
      `card mostra "${horarioCard}"`);

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
