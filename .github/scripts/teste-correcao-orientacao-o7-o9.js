/* Correção editorial "Orientação para distinguir O7 e O9" (texto aprovado pela responsável em 2026-10-15) — hermético,
 * Firebase falso em persistência real, dados sintéticos. Prova:
 *   A. (módulo) a correção existe, é do questionário O1–O9, mexe SÓ na ajudaExtra da O9; o "de" é exatamente a ajuda de
 *      fábrica e o "para" é exatamente o texto aprovado; o conteúdo de fábrica (versão 1) continua igual.
 *   B. (tela) o admin geral aplica pelo ADMIN › Arquitetura › Questionários: nasce a versão 2 do O1–O9 com a nova ajuda
 *      da O9 e nenhum outro campo diferente da versão 1; aplicar de novo não faz nada.
 *   C. avaliação começada ANTES (versão 1) continua citando a ajuda antiga no apoio O7 × O9; avaliação começada DEPOIS
 *      (versão 2) cita a nova — no apoio e na Ajuda da própria O9. Desktop e 375 px, sem rolagem lateral. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { abrirRecolhidas } = require('./abrir-recolhidas');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const { semente, chave } = require('./semente-jornada');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const ADM = 'admin.geral@previ.com.br';
const QCOD = 'POSICIONAMENTO_ORGANIZACIONAL';
let falhas = 0, total = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); if (!c) falhas++; }
const APROVADO = 'Capacidades, serviços ou soluções de negócio compartilhados, consumidos em escala por diferentes Linhas e times para sustentar suas soluções, tendem a O7 — Plataforma Habilitadora de Negócios. Não é necessário que o objeto seja previdenciário ou financeiro, nem que a entrega chegue diretamente ao participante.\n' +
  'Serviços corporativos destinados predominantemente à administração e ao controle da própria organização, prestados ao cliente interno de forma padronizada, tendem a O9 — Plataforma de Gestão Corporativa.\n' +
  'A classificação deve considerar a finalidade da responsabilidade, a natureza da entrega e quem a consome e para quê. O nome da atividade, sua importância para as Linhas ou o simples fato de atender usuários internos não determinam isoladamente o tipo arquitetural.';

function carregarQuestionarios() {
  const ctx = { console: { log() {}, warn() {}, error() {} } };
  ctx.window = ctx;
  const ref = function r(p) { return { on() {}, once() {}, off() {}, child: (c) => r(p + '/' + c) }; };
  ctx.firebase = { database: () => ({ ref }) };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'questionarios-config.js'), 'utf8'), ctx);
  return ctx.window.faQuestionarios;
}

const objeto = (nome) => ({ nome, descricao: nome, finalidade: nome, contexto: 'Cadastro simplificado: o nome e a finalidade repetem a descrição informada pela pessoa; nada foi inferido.', situacao: 'ativo', revisao: 1,
  criadoPor: { uid: 'u', email: ADM }, criadoEm: 1791713600000, atualizadoPor: { uid: 'u', email: ADM }, atualizadoEm: 1791713600000, auditoriaId: 'a' });
async function abrir(browser, viewport, hash) {
  const db = semente();
  db['fa-admins'] = { [chave(ADM)]: true };
  db['fa-users'][chave(ADM)] = { name: 'Admin', email: ADM, area: 'INFOR' };
  Object.assign(db['objetos-organizacionais'], { oAntes: objeto('Sintética — começada antes da correção'), oDepois: objeto('Sintética — começada depois da correção') });
  const cfg = { db, user: { email: ADM, emailVerified: true, uid: 'u-' + chave(ADM) }, uidDoUsuario: true, prefixoChave: 'k' + (++abrir.n) + 'x', delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await ctx.addInitScript(abrirRecolhidas(['details.avp-config-sub']));
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
abrir.n = 0;
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent : ''; }, sel);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const ir = (page, hash) => page.evaluate((h) => { location.hash = h; }, hash);
async function iniciar(page, item) {
  await ir(page, '#arquitetura?po=atuacoes&item=' + item);
  await page.waitForSelector('#poHipoteseIniciar');
  await page.click('#poHipoteseIniciar input[value="NAO_SEI"]'); await page.click('#poIniciarAtuacaoBtn'); await page.waitForSelector('#poChecklist');
}
const citacao = (page) => page.evaluate(() => { const d = document.getElementById('poTiposEstrutura'); if (d) d.open = true; const a = document.getElementById('poApoioO7O9'); if (a) a.open = true; const c = document.querySelector('#poApoioAjudaOficial .po-apoio-citacao'); return c ? c.innerText : ''; });

async function tela(browser, viewport, rotulo) {
  console.log('\n== B/C. ' + rotulo + ' ==');
  const { ctx, page, erros } = await abrir(browser, viewport, '#arquitetura?po=atuacoes');
  await iniciar(page, 'oAntes');
  const antes = await citacao(page);
  afirma(/observar onde termina a cadeia de valor/.test(antes), 'C. antes da correção: o apoio cita a ajuda oficial vigente (a antiga)', antes.slice(0, 80));
  /* B. aplicar pelo ADMIN */
  await ir(page, '#admin');
  await page.evaluate(() => { if (!/^#arquitetura\?(?:[^#]*&)?arq=/.test(location.hash)) location.hash = '#arquitetura?arq=inicio'; }); /* Avaliações e Mapa = Gestão da Floresta */
  await page.waitForSelector('#avpQuestO1O9Btn'); await page.click('#avpQuestO1O9Btn');
  await page.waitForSelector('#avpCorrecao-orientacao-o7-o9');
  afirma(/Orientação para distinguir O7 e O9/.test(await texto(page, '#avpCorrecao-orientacao-o7-o9')), 'B. a correção aparece no cartão do questionário O1–O9');
  afirma(await larguraOk(page), 'B. cartão sem rolagem lateral');
  await page.click('.avp-correcao-aplicar-btn[data-correcao="orientacao-o7-o9"]');
  await page.waitForSelector('.avp-modal-confirm-btn'); await page.click('.avp-modal-confirm-btn');
  await page.waitForSelector('.avp-modal-ok-btn'); await page.click('.avp-modal-ok-btn');
  const db = await banco(page), q = db['questionarios-config'][QCOD];
  const v2 = q && q.versoes && q.versoes[2] && q.versoes[2].perguntas;
  const Q = carregarQuestionarios(), fab = Q.PADRAO[QCOD].perguntas;
  const dif = [];
  (v2 || []).forEach((p) => { const f = fab.find((x) => x.codigoEstavel === p.codigoEstavel); Object.keys(Object.assign({}, f, p)).forEach((k) => { if (k !== 'tipo' && JSON.stringify(f[k]) !== JSON.stringify(p[k])) dif.push(p.codigoEstavel + '.' + k); }); });
  afirma(q && q.versaoPublicada === 2 && dif.join() === 'O9.ajudaExtra' && v2.find((p) => p.codigoEstavel === 'O9').ajudaExtra === APROVADO, 'B. aplicar cria a versão 2 com a nova ajuda da O9 e nenhum outro campo diferente', dif);
  const idem = await page.evaluate(() => new Promise((ok) => window.faQuestionarios.aplicarCorrecaoEditorial('orientacao-o7-o9', null, (err) => ok(err))));
  afirma(idem === 'nada-a-aplicar', 'B. aplicar de novo não faz nada', idem);
  /* C. antes × depois */
  await iniciar(page, 'oDepois');
  const depois = await citacao(page);
  afirma(depois.indexOf('Não é necessário que o objeto seja previdenciário ou financeiro, nem que a entrega chegue diretamente ao participante.') !== -1 && /não determinam isoladamente o tipo arquitetural/.test(depois), 'C. avaliação começada depois: o apoio cita o texto aprovado', depois.slice(0, 80));
  for (const [qq, v] of [['O1', 'SIM'], ['O2', 'NAO'], ['O3', 'NAO'], ['O4', 'NAO'], ['O5', 'NAO']]) { await page.click('.po-resp[data-q="' + qq + '"][data-v="' + v + '"]'); await page.waitForTimeout(80); }
  await page.waitForSelector('.po-pergunta[data-q="O9"]');
  afirma(/tendem a O9 — Plataforma de Gestão Corporativa/.test(await texto(page, '.po-pergunta[data-q="O9"] .po-ajuda-extra')), 'C. a Ajuda da própria O9 mostra o texto aprovado');
  const kAntes = (await banco(page))['posicionamento-rascunho-por-item'].oAntes;
  await ir(page, '#arquitetura?po=' + kAntes);
  await page.waitForSelector('#poChecklist');
  afirma(/observar onde termina a cadeia de valor/.test(await citacao(page)), 'C. avaliação começada antes (versão 1): continua com a redação dela');
  afirma(await larguraOk(page), 'C. sem rolagem lateral');
  afirma(!erros.length, 'sem erro de página', erros);
  await ctx.close();
}

(async () => {
  console.log('== A. Módulo ==');
  const Q = carregarQuestionarios();
  const c = Q.listarCorrecoesEditoriais(QCOD).filter((x) => x.id === 'orientacao-o7-o9')[0];
  const fabO9 = Q.PADRAO[QCOD].perguntas.find((p) => p.codigoEstavel === 'O9');
  afirma(!!c && c.ajustes.length === 1 && c.ajustes[0].pergunta === 'O9' && c.ajustes[0].campo === 'ajudaExtra', 'A. uma correção do O1–O9, só na ajudaExtra da O9');
  afirma(c && c.ajustes[0].de === fabO9.ajudaExtra, 'A. o "de" é exatamente a ajuda de fábrica da O9');
  afirma(c && c.ajustes[0].para === APROVADO, 'A. o "para" é exatamente o texto aprovado');
  afirma(/observar onde termina a cadeia de valor/.test(fabO9.ajudaExtra), 'A. o conteúdo de fábrica (versão 1) não foi reescrito');
  const browser = await chromium.launch();
  try {
    await tela(browser, { width: 1280, height: 900 }, 'Computador (1280 px)');
    await tela(browser, { width: 375, height: 800 }, 'Celular (375 px)');
  } finally { await browser.close(); }
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
