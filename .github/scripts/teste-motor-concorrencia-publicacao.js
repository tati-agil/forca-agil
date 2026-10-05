/* Controle de concorrência na publicação de regras dos motores — edição
 * concorrente nunca pode sobrescrever silenciosamente uma versão publicada
 * por outra pessoa.
 *
 * CENÁRIO (o mesmo descrito no pedido): usuária A abre a tela de edição do
 * motor com a versão 3 publicada (seu rascunho grava versaoBase:3); usuária
 * B abre a MESMA tela, também vendo a versão 3 (versaoBase:3 no rascunho
 * dela também). A publica primeiro — o motor vira versão 4. Quando B tenta
 * publicar o rascunho DELA (ainda baseado na 3), a publicação precisa ser
 * BLOQUEADA: a versão continua 4, nenhuma das regras de A é perdida, e
 * nenhuma versão 5 nasce da tentativa de B. Isso vale tanto para uma
 * mudança real de B (conflito de verdade) quanto para um rascunho de B que,
 * na prática, ficou idêntico ao que já está publicado agora (não deveria
 * travar por concorrência nesse caso — é um no-op inofensivo).
 *
 * publicarRegras usa uma transaction() do Firebase sobre o node de
 * configuração (nunca "ler versão / esperar / gravar depois") — ver
 * comentário em motor-arquitetura.js/motor-squad.js. firebase-falso.js já
 * implementa transaction() com semântica equivalente à do SDK real
 * (compare-and-swap sobre o valor atual no momento do commit).
 *
 * Roda com o Firebase SUBSTITUÍDO pelo falso: hermético, sem segredo, sem
 * rede. Chama window.faMotorArquitetura/window.faMotorSquad diretamente.
 */
const { chromium } = require('playwright');
const { esperarSessaoAssentada } = require('./esperas');
const fs = require('fs');
const path = require('path');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const EMAIL = 'teste@previ.com.br';
const KEY = EMAIL.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

async function abrirApp(browser) {
  const admins = {}; admins[KEY] = { email: EMAIL };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {},
    'turmas-checkin': {}, 'turmas-espera': {}, 'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {},
    eventos: {}, 'turmas-publico': {}, 'eventos-publico': {}, 'avaliacoes-produto': {}, 'avaliacoes-squad': {},
    'motor-squad-config': {}, 'motor-squad-auditoria': {}, 'motor-arquitetura-config': {}, 'motor-arquitetura-auditoria': {} };
  const cfg = { db: db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10 };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page); /* login decidido e acessos resolvidos (antes: opções no lugar do argumento, engolida + 800 ms fixos) */
  await page.evaluate(() => { window.faMotorArquitetura.onMudanca(function () {}); window.faMotorSquad.onMudanca(function () {}); });
  await page.waitForTimeout(300);
  return { ctx, page, erros };
}

function publicar(page, motorRef, regras, usuario, versaoBase) {
  return page.evaluate(([mr, rs, u, vb]) => new Promise((resolve) => {
    window[mr].publicarRegras(rs, u, function (err, info) {
      setTimeout(() => resolve({ err: err, info: info, versao: window[mr].versaoAtual() }), 200);
    }, vb);
  }), [motorRef, regras, usuario, versaoBase]);
}
function auditoria(page, motorRef) {
  return page.evaluate((mr) => new Promise((resolve) => { window[mr].auditoria(resolve); }), motorRef);
}

(async () => {
  const browser = await chromium.launch();
  const { ctx, page, erros } = await abrirApp(browser);

  console.log('== MOTOR ARQUITETURAL ==');

  console.log('\n-- 1. A e B abrem a MESMA versão publicada; A publica primeiro; B tenta publicar uma mudança DIFERENTE, ainda baseada na versão antiga -> bloqueado --');
  const base1 = await page.evaluate(() => {
    var v = window.faMotorArquitetura.versaoAtual();
    return { v: v, regras: JSON.parse(JSON.stringify(window.faMotorArquitetura.regrasDaVersao(v).regras)) };
  });
  const regrasA1 = JSON.parse(JSON.stringify(base1.regras));
  regrasA1.filter((r) => r.codigo === 'CANAL')[0].condicoes.all[0].valor = 'NAO'; // mudança REAL de A
  const regrasB1 = JSON.parse(JSON.stringify(base1.regras));
  regrasB1.filter((r) => r.codigo === 'DOCUMENTO_INFORMACAO')[0].condicoes.all[0].valor = 'NAO'; // mudança REAL, DIFERENTE, de B

  const pubA1 = await publicar(page, 'faMotorArquitetura', regrasA1, { name: 'Usuária A' }, base1.v);
  afirma(!pubA1.err, 'A publica com sucesso (sua versaoBase == versão vigente)');
  afirma(pubA1.versao === base1.v + 1, 'motor avançou para ' + (base1.v + 1) + ' com a publicação de A: versão = ' + pubA1.versao);

  const pubB1 = await publicar(page, 'faMotorArquitetura', regrasB1, { name: 'Usuária B' }, base1.v);
  afirma(pubB1.err === 'conflito', 'a publicação de B foi REJEITADA com erro "conflito" (base desatualizada): err=' + pubB1.err);
  afirma(pubB1.versao === base1.v + 1, 'a versão CONTINUA ' + (base1.v + 1) + ' depois da tentativa de B (não virou ' + (base1.v + 2) + '): versão = ' + pubB1.versao);
  afirma(!!(pubB1.info && pubB1.info.versaoBase === base1.v && pubB1.info.versaoAtual === base1.v + 1), 'info do conflito traz versaoBase (' + base1.v + ') e versaoAtual (' + (base1.v + 1) + ') corretos: ' + JSON.stringify(pubB1.info));

  const regrasVigentesApos1 = await page.evaluate(() => window.faMotorArquitetura.regrasDaVersao(window.faMotorArquitetura.versaoAtual()).regras);
  afirma(JSON.stringify(regrasVigentesApos1) === JSON.stringify(regrasA1), 'NENHUMA regra de A foi perdida — a versão vigente ainda é exatamente o que A publicou');
  afirma(regrasVigentesApos1.filter((r) => r.codigo === 'DOCUMENTO_INFORMACAO')[0].condicoes.all[0].valor !== 'NAO', 'a mudança de B NUNCA foi aplicada (sobrescrita silenciosa não aconteceu)');

  const listaAud1 = await auditoria(page, 'faMotorArquitetura');
  const conflitos1 = listaAud1.filter((a) => a.tipo === 'conflito_publicacao');
  afirma(conflitos1.length === 1, 'auditoria registrou UMA entrada tipo "conflito_publicacao"');
  afirma(!!conflitos1.length && conflitos1[0].versaoBase === base1.v && conflitos1[0].versaoAtual === base1.v + 1, 'entrada de conflito traz versaoBase/versaoAtual corretos');

  console.log('\n-- 2. B estava na versão antiga, mas o rascunho dele é IDÊNTICO ao que já está publicado agora -> não bloqueia, não cria versão nova --');
  const versaoAntes2 = await page.evaluate(() => window.faMotorArquitetura.versaoAtual());
  const rascunhoIdenticoDeB = JSON.parse(JSON.stringify(regrasA1)); // exatamente o que está publicado agora
  const pubB2 = await publicar(page, 'faMotorArquitetura', rascunhoIdenticoDeB, { name: 'Usuária B' }, base1.v /* base antiga de B, nunca atualizada */);
  afirma(!pubB2.err, 'publicação de B (rascunho idêntico ao vigente, mesmo com base desatualizada) NÃO foi tratada como conflito: err=' + pubB2.err);
  afirma(pubB2.versao === versaoAntes2, 'nenhuma versão nova foi criada: ' + versaoAntes2 + ' -> ' + pubB2.versao);
  afirma(!!(pubB2.info && pubB2.info.semMudanca), 'callback sinaliza semMudanca:true (no-op, apesar da base desatualizada de B)');

  console.log('\n== MOTOR DE SQUAD ==');

  console.log('\n-- 3. Mesmo cenário de concorrência (A publica, B tenta publicar mudança diferente com base velha) -- squad --');
  const base3 = await page.evaluate(() => {
    var v = window.faMotorSquad.versaoAtual();
    return { v: v, regras: JSON.parse(JSON.stringify(window.faMotorSquad.regrasDaVersao(v))) };
  });
  const regrasA3 = JSON.parse(JSON.stringify(base3.regras));
  regrasA3.eixoA.filter((r) => r.codigo === 'A3')[0].condicoes.any[0].valor = 'SIM'; // mudança REAL de A
  const regrasB3 = JSON.parse(JSON.stringify(base3.regras));
  regrasB3.eixoB.filter((r) => r.codigo === 'B1')[0].condicoes.all[0].valor = 'SIM'; // mudança REAL, DIFERENTE, de B

  const pubA3 = await publicar(page, 'faMotorSquad', regrasA3, { name: 'Usuária A' }, base3.v);
  afirma(!pubA3.err, 'A publica com sucesso (squad)');
  afirma(pubA3.versao === base3.v + 1, 'motorSquadVersion avançou para ' + (base3.v + 1) + ': versão = ' + pubA3.versao);

  const pubB3 = await publicar(page, 'faMotorSquad', regrasB3, { name: 'Usuária B' }, base3.v);
  afirma(pubB3.err === 'conflito', 'a publicação de B (squad) foi REJEITADA com erro "conflito": err=' + pubB3.err);
  afirma(pubB3.versao === base3.v + 1, 'motorSquadVersion CONTINUA ' + (base3.v + 1) + ' depois da tentativa de B: versão = ' + pubB3.versao);

  const regrasVigentesApos3 = await page.evaluate(() => window.faMotorSquad.regrasDaVersao(window.faMotorSquad.versaoAtual()));
  afirma(JSON.stringify(regrasVigentesApos3) === JSON.stringify(regrasA3), 'NENHUMA regra de A (squad) foi perdida');

  const listaAud3 = await auditoria(page, 'faMotorSquad');
  afirma(listaAud3.filter((a) => a.tipo === 'conflito_publicacao').length === 1, 'auditoria (squad) registrou UMA entrada tipo "conflito_publicacao"');

  console.log('\n-- 4. B (squad) com rascunho idêntico ao vigente e base desatualizada -> não bloqueia, não versiona --');
  const versaoAntes4 = await page.evaluate(() => window.faMotorSquad.versaoAtual());
  const pubB4 = await publicar(page, 'faMotorSquad', JSON.parse(JSON.stringify(regrasA3)), { name: 'Usuária B' }, base3.v);
  afirma(!pubB4.err, 'publicação (squad) de B com rascunho idêntico ao vigente não foi tratada como conflito: err=' + pubB4.err);
  afirma(pubB4.versao === versaoAntes4, 'motorSquadVersion não avançou: ' + versaoAntes4 + ' -> ' + pubB4.versao);
  afirma(!!(pubB4.info && pubB4.info.semMudanca), 'callback (squad) sinaliza semMudanca:true');

  console.log('\n-- 5. Rollback (publicarVersaoAnterior) continua funcionando normalmente sob o novo mecanismo -- arquitetural --');
  const versaoAntesRollback = await page.evaluate(() => window.faMotorArquitetura.versaoAtual());
  const rollback = await page.evaluate((vAlvo) => new Promise((resolve) => {
    window.faMotorArquitetura.publicarVersaoAnterior(vAlvo, { name: 'Admin' }, function (err, info) {
      setTimeout(() => resolve({ err: err, info: info, versao: window.faMotorArquitetura.versaoAtual() }), 200);
    });
  }), base1.v);
  afirma(!rollback.err, 'rollback para a versão ' + base1.v + ' não gerou erro/conflito: err=' + rollback.err);
  afirma(rollback.versao === versaoAntesRollback + 1, 'rollback criou uma versão NOVA (' + versaoAntesRollback + ' -> ' + rollback.versao + '), sem exigir nenhuma mudança na tela');

  afirma(erros.length === 0, 'nenhum erro de JS durante todo o fluxo (encontrados: ' + erros.length + ')');
  await ctx.close();
  await browser.close();

  console.log(falhas === 0
    ? '\n============================\nOK — publicação concorrente nunca sobrescreve silenciosamente uma versão mais nova; rascunho desatualizado mas semanticamente igual ao vigente não é bloqueado por engano.'
    : '\n============================\n' + falhas + ' FALHA(S)');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
