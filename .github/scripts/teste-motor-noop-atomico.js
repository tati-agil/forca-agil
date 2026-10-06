/* Caminho de NO-OP da publicação atomicamente seguro (complementa a PR #243).
 *
 * POR QUE ESTE TESTE EXISTE
 * A PR #243 fechou a corrida do caminho de PUBLICAÇÃO REAL com uma
 * transaction() do Firebase, mas deixou o caminho de NO-OP (publicar um
 * rascunho que parece idêntico ao que já está publicado) de fora dela: a
 * decisão "é no-op" comparava contra a versão do CACHE LOCAL e, se vazia,
 * fazia um update() incondicional limpando o rascunho — sem passar pela
 * transaction. Isso abre uma janela de corrida: entre "eu comparei e
 * concluí que era no-op" e "eu limpei o rascunho", outra pessoa pode
 * publicar uma mudança real, e o rascunho seria descartado mesmo tendo
 * deixado de ser, de fato, equivalente ao que passou a estar publicado.
 *
 * Este teste prova que agora TUDO — comparação semântica E decisão de
 * limpar o rascunho — acontece dentro da MESMA transaction, contra o valor
 * do servidor no momento do commit, nunca contra uma leitura anterior:
 *   Caso 1 — ninguém publica nada durante a operação de B -> no-op normal.
 *   Caso 2 — A publica uma mudança REAL e DIFERENTE do rascunho de B
 *     enquanto B tenta publicar -> B é bloqueado (conflito), a versão de A
 *     nunca é perdida, e nenhuma versão extra nasce da tentativa de B.
 *   Caso 2b — mesma corrida do Caso 2, mas as duas publicações são
 *     disparadas no MESMO instante (antes de qualquer uma assentar), para
 *     que o cache local de B, no momento da chamada, ainda não tenha visto
 *     a publicação de A — reproduz fielmente "B achava que era um no-op" e
 *     confirma que a auditoria rotula o conflito como origem
 *     'tentativa_noop'.
 *   Caso 3 — A publica uma mudança real (versiona de verdade); o rascunho
 *     de B, desenhado à parte, coincide exatamente com o resultado ->
 *     continua sendo tratado como no-op (a corrida não pode transformar um
 *     no-op legítimo em conflito desnecessário).
 *
 * Roda com o Firebase SUBSTITUÍDO pelo falso (firebase-falso.js): hermético,
 * sem segredo, sem rede. Chama window.faMotorArquitetura/window.faMotorSquad
 * diretamente — os mesmos caminhos que os botões da UI chamam.
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

/* Alterna SIM<->NAO da folha indicada — nunca fixa um valor específico, já
   que o estado vigente vai avançando de caso em caso (cada cenário parte do
   que já está publicado, não de PADRAO_REGRAS): isso garante que a mutação
   é SEMPRE uma mudança real relativa ao que estiver vigente no momento,
   qualquer que seja. */
function toggleLeaf(regras, codigoRegra, filtroCondicao) {
  var regra = regras.filter(function (r) { return r.codigo === codigoRegra; })[0];
  var leaf = filtroCondicao(regra.condicoes);
  leaf.valor = leaf.valor === 'SIM' ? 'NAO' : 'SIM';
}

function publicar(page, motorRef, regras, usuario, versaoBase) {
  return page.evaluate(([mr, rs, u, vb]) => new Promise((resolve) => {
    window[mr].publicarRegras(rs, u, function (err, info) {
      setTimeout(() => resolve({ err: err, info: info, versao: window[mr].versaoAtual() }), 200);
    }, vb);
  }), [motorRef, regras, usuario, versaoBase]);
}
function publicarConcorrente(page, motorRef, regrasA, usuarioA, baseA, regrasB, usuarioB, baseB) {
  return page.evaluate(([mr, rA, uA, bA, rB, uB, bB]) => new Promise((resolve) => {
    var out = {}; var restam = 2;
    function terminou() { restam--; if (restam === 0) setTimeout(() => resolve(out), 200); }
    // As duas chamadas são feitas no MESMO tick síncrono, antes de qualquer
    // transaction assentar — é isto que faz o cache local de B, no instante
    // em que sua função roda, ainda refletir o estado ANTES da publicação
    // de A (a corrida de verdade), mesmo a transaction em si sempre lendo o
    // valor mais recente do servidor no momento do commit.
    window[mr].publicarRegras(rA, uA, function (err, info) { out.a = { err: err, info: info }; terminou(); }, bA);
    window[mr].publicarRegras(rB, uB, function (err, info) { out.b = { err: err, info: info }; terminou(); }, bB);
  }), [motorRef, regrasA, usuarioA, baseA, regrasB, usuarioB, baseB]);
}
function auditoria(page, motorRef) {
  return page.evaluate((mr) => new Promise((resolve) => { window[mr].auditoria(resolve); }), motorRef);
}

(async () => {
  const browser = await chromium.launch();
  const { ctx, page, erros } = await abrirApp(browser);

  console.log('== MOTOR ARQUITETURAL ==');

  // Prepara um cenário: alguém publica uma mudança real (toggle em CANAL) a
  // partir do que estiver vigente agora, chegando a "v_atual" (o "v4" da
  // história) — e devolve essa versão/conteúdo, mais a versão ANTERIOR (o
  // "v3", que vira a versaoBase desatualizada de B).
  async function prepararCenarioArq() {
    const vAntes = await page.evaluate(() => window.faMotorArquitetura.versaoAtual());
    const regrasVAtual = await page.evaluate(() => {
      var regras = JSON.parse(JSON.stringify(window.faMotorArquitetura.regrasDaVersao(window.faMotorArquitetura.versaoAtual()).regras));
      return regras;
    });
    toggleLeaf(regrasVAtual, 'CANAL', function (c) { return c.all[0]; });
    const pubInicial = await publicar(page, 'faMotorArquitetura', regrasVAtual, { name: 'Setup' }, vAntes);
    return { vAtual: pubInicial.versao, regrasVAtual: regrasVAtual, baseAntigaDeB: vAntes };
  }

  console.log('\n-- 1. Ninguém publica nada durante a operação de B -> no-op normal --');
  const s1 = await prepararCenarioArq();
  const rascunhoB1 = JSON.parse(JSON.stringify(s1.regrasVAtual)); // idêntico ao vigente
  const pubB1 = await publicar(page, 'faMotorArquitetura', rascunhoB1, { name: 'Usuária B' }, s1.baseAntigaDeB);
  afirma(!pubB1.err, 'publicação de B (sem concorrência) não foi tratada como conflito: err=' + pubB1.err);
  afirma(pubB1.versao === s1.vAtual, 'versão continua ' + s1.vAtual + ' (nenhuma versão nova): ' + s1.vAtual + ' -> ' + pubB1.versao);
  afirma(!!(pubB1.info && pubB1.info.semMudanca), 'callback sinaliza semMudanca:true');

  console.log('\n-- 2. A publica uma mudança REAL e DIFERENTE enquanto B tenta publicar (sequencial: cache de B já está fresco) -> conflito --');
  const s2 = await prepararCenarioArq();
  const rascunhoB2 = JSON.parse(JSON.stringify(s2.regrasVAtual)); // igual ao vigente NO MOMENTO em que B comparou
  const regrasA2 = JSON.parse(JSON.stringify(s2.regrasVAtual));
  toggleLeaf(regrasA2, 'DOCUMENTO_INFORMACAO', function (c) { return c.all[0]; }); // mudança real, DIFERENTE do rascunho de B
  const pubA2 = await publicar(page, 'faMotorArquitetura', regrasA2, { name: 'Usuária A' }, s2.vAtual);
  afirma(!pubA2.err, 'A publica a mudança real com sucesso');
  afirma(pubA2.versao === s2.vAtual + 1, 'motor avançou para ' + (s2.vAtual + 1) + ' com a publicação de A');
  // B só agora "termina" a operação que tinha começado comparando contra a
  // versão antiga (s2.vAtual) — exatamente a janela de corrida do relato.
  const pubB2 = await publicar(page, 'faMotorArquitetura', rascunhoB2, { name: 'Usuária B' }, s2.baseAntigaDeB);
  afirma(pubB2.err === 'conflito', 'B NÃO foi tratado como no-op silencioso — recebeu conflito: err=' + pubB2.err);
  afirma(pubB2.versao === s2.vAtual + 1, 'versão permanece ' + (s2.vAtual + 1) + ' (nenhuma v' + (s2.vAtual + 2) + ' criada pela tentativa de B): versão = ' + pubB2.versao);
  const regrasVigentesApos2 = await page.evaluate(() => window.faMotorArquitetura.regrasDaVersao(window.faMotorArquitetura.versaoAtual()).regras);
  afirma(JSON.stringify(regrasVigentesApos2) === JSON.stringify(regrasA2), 'as regras de A permanecem INTACTAS — o rascunho de B não foi aplicado por cima');
  const audit2 = await auditoria(page, 'faMotorArquitetura');
  const conflitos2 = audit2.filter((a) => a.tipo === 'conflito_publicacao');
  afirma(conflitos2.length === 1 && conflitos2[0].origem === 'tentativa_publicacao', 'auditoria registrou o conflito (sequencial, cache já fresco: origem "tentativa_publicacao"): ' + JSON.stringify(conflitos2));

  console.log('\n-- 2b. Mesma corrida, mas disparada CONCORRENTEMENTE (cache de B ainda não viu a publicação de A no instante da chamada) -> conflito com origem "tentativa_noop" --');
  const s2b = await prepararCenarioArq();
  const rascunhoB2b = JSON.parse(JSON.stringify(s2b.regrasVAtual));
  const regrasA2b = JSON.parse(JSON.stringify(s2b.regrasVAtual));
  toggleLeaf(regrasA2b, 'DOCUMENTO_INFORMACAO', function (c) { return c.all[0]; });
  const concorrente2b = await publicarConcorrente(page, 'faMotorArquitetura',
    regrasA2b, { name: 'Usuária A' }, s2b.vAtual,
    rascunhoB2b, { name: 'Usuária B' }, s2b.baseAntigaDeB);
  afirma(!concorrente2b.a.err, 'A (disparo concorrente) publica sem erro');
  afirma(concorrente2b.b.err === 'conflito', 'B (disparo concorrente) recebeu conflito, nunca um no-op silencioso: err=' + concorrente2b.b.err);
  const versaoApos2b = await page.evaluate(() => window.faMotorArquitetura.versaoAtual());
  afirma(versaoApos2b === s2b.vAtual + 1, 'versão avançou só UMA vez (a publicação de A), nunca duas: ' + s2b.vAtual + ' -> ' + versaoApos2b);
  const audit2b = await auditoria(page, 'faMotorArquitetura');
  const conflitosNoop2b = audit2b.filter((a) => a.tipo === 'conflito_publicacao' && a.origem === 'tentativa_noop');
  afirma(conflitosNoop2b.length === 1, 'auditoria registrou o conflito com origem "tentativa_noop" (B achava, pelo seu cache, que era um no-op): ' + JSON.stringify(audit2b.filter((a) => a.tipo === 'conflito_publicacao')));

  console.log('\n-- 3. A publica uma mudança REAL (versiona); o rascunho de B, desenhado à parte, coincide exatamente com o resultado -> no-op seguro, sem conflito --');
  const s3 = await prepararCenarioArq();
  // A e B chegam, cada um por conta própria, ao MESMO conteúdo final — A a
  // partir do vigente (mudança real, com versaoBase correta, por isso
  // versiona de verdade); B a partir de uma versão antiga (rascunho, por
  // isso base desatualizada). O que importa pro no-op é só a versão que
  // acaba ficando publicada, nunca de onde cada um partiu.
  const regrasFinal3 = JSON.parse(JSON.stringify(s3.regrasVAtual));
  toggleLeaf(regrasFinal3, 'CAPACIDADE_ORGANIZACIONAL', function (c) { return c.all.filter(function (x) { return x.campo === 'P11'; })[0]; });
  const pubA3 = await publicar(page, 'faMotorArquitetura', regrasFinal3, { name: 'Usuária A' }, s3.vAtual);
  afirma(!pubA3.err, 'A publica a mudança real sem erro');
  afirma(pubA3.versao === s3.vAtual + 1, 'a publicação de A É uma versão nova de verdade: ' + s3.vAtual + ' -> ' + pubA3.versao);
  const rascunhoB3 = JSON.parse(JSON.stringify(regrasFinal3)); // B chegou, por conta própria, ao MESMO conteúdo
  const pubB3 = await publicar(page, 'faMotorArquitetura', rascunhoB3, { name: 'Usuária B' }, s3.baseAntigaDeB);
  afirma(!pubB3.err, 'B (base desatualizada, mas conteúdo agora igual ao recém-publicado por A) NÃO recebeu conflito: err=' + pubB3.err);
  afirma(pubB3.versao === s3.vAtual + 1, 'nenhuma versão extra (v' + (s3.vAtual + 2) + ') foi criada pela tentativa de B: ' + pubB3.versao);
  afirma(!!(pubB3.info && pubB3.info.semMudanca), 'callback de B sinaliza semMudanca:true');

  console.log('\n== MOTOR DE SQUAD ==');

  async function prepararCenarioSquad() {
    const vAntes = await page.evaluate(() => window.faMotorSquad.versaoAtual());
    const regrasVAtual = await page.evaluate(() => JSON.parse(JSON.stringify(window.faMotorSquad.regrasDaVersao(window.faMotorSquad.versaoAtual()))));
    toggleLeaf(regrasVAtual.eixoA, 'A3', function (c) { return c.any[0]; });
    const pubInicial = await publicar(page, 'faMotorSquad', regrasVAtual, { name: 'Setup' }, vAntes);
    return { vAtual: pubInicial.versao, regrasVAtual: regrasVAtual, baseAntigaDeB: vAntes };
  }

  console.log('\n-- 4. Squad: ninguém publica nada durante a operação de B -> no-op normal --');
  const sq1 = await prepararCenarioSquad();
  const rascunhoSqB1 = JSON.parse(JSON.stringify(sq1.regrasVAtual));
  const pubSqB1 = await publicar(page, 'faMotorSquad', rascunhoSqB1, { name: 'Usuária B' }, sq1.baseAntigaDeB);
  afirma(!pubSqB1.err, 'publicação de B (squad, sem concorrência) não foi tratada como conflito: err=' + pubSqB1.err);
  afirma(pubSqB1.versao === sq1.vAtual, 'motorSquadVersion continua ' + sq1.vAtual + ': ' + sq1.vAtual + ' -> ' + pubSqB1.versao);
  afirma(!!(pubSqB1.info && pubSqB1.info.semMudanca), 'callback (squad) sinaliza semMudanca:true');

  console.log('\n-- 5. Squad: A publica mudança real e diferente enquanto B tenta publicar -> conflito, nenhuma versão extra, regras de A intactas --');
  const sq2 = await prepararCenarioSquad();
  const rascunhoSqB2 = JSON.parse(JSON.stringify(sq2.regrasVAtual));
  const regrasSqA2 = JSON.parse(JSON.stringify(sq2.regrasVAtual));
  toggleLeaf(regrasSqA2.eixoB, 'B1', function (c) { return c.all[0]; });
  const pubSqA2 = await publicar(page, 'faMotorSquad', regrasSqA2, { name: 'Usuária A' }, sq2.vAtual);
  afirma(!pubSqA2.err, 'A (squad) publica a mudança real com sucesso');
  afirma(pubSqA2.versao === sq2.vAtual + 1, 'motorSquadVersion avançou para ' + (sq2.vAtual + 1) + ': ' + pubSqA2.versao);
  const pubSqB2 = await publicar(page, 'faMotorSquad', rascunhoSqB2, { name: 'Usuária B' }, sq2.baseAntigaDeB);
  afirma(pubSqB2.err === 'conflito', 'B (squad) recebeu conflito, não foi tratado como no-op silencioso: err=' + pubSqB2.err);
  afirma(pubSqB2.versao === sq2.vAtual + 1, 'motorSquadVersion permanece ' + (sq2.vAtual + 1) + ' (nenhuma versão extra criada)');
  const regrasSqVigentesApos = await page.evaluate(() => window.faMotorSquad.regrasDaVersao(window.faMotorSquad.versaoAtual()));
  afirma(JSON.stringify(regrasSqVigentesApos) === JSON.stringify(regrasSqA2), 'as regras de A (squad) permanecem intactas');
  const auditSq2 = await auditoria(page, 'faMotorSquad');
  afirma(auditSq2.filter((a) => a.tipo === 'conflito_publicacao').length === 1, 'auditoria (squad) registrou UMA entrada tipo "conflito_publicacao"');

  console.log('\n-- 6. Squad: A publica mudança REAL (versiona); rascunho de B, desenhado à parte, coincide com o resultado -> no-op seguro --');
  const sq3 = await prepararCenarioSquad();
  const regrasSqFinal3 = JSON.parse(JSON.stringify(sq3.regrasVAtual));
  toggleLeaf(regrasSqFinal3.eixoB, 'B2', function (c) { return c.all[1]; });
  const pubSqA3 = await publicar(page, 'faMotorSquad', regrasSqFinal3, { name: 'Usuária A' }, sq3.vAtual);
  afirma(!pubSqA3.err, 'A (squad) publica a mudança real sem erro');
  afirma(pubSqA3.versao === sq3.vAtual + 1, 'a publicação de A (squad) É uma versão nova de verdade: ' + sq3.vAtual + ' -> ' + pubSqA3.versao);
  const rascunhoSqB3 = JSON.parse(JSON.stringify(regrasSqFinal3));
  const pubSqB3 = await publicar(page, 'faMotorSquad', rascunhoSqB3, { name: 'Usuária B' }, sq3.baseAntigaDeB);
  afirma(!pubSqB3.err, 'B (squad, base desatualizada mas conteúdo agora igual ao recém-publicado) não recebeu conflito: err=' + pubSqB3.err);
  afirma(pubSqB3.versao === sq3.vAtual + 1, 'nenhuma versão extra (squad) foi criada pela tentativa de B: ' + pubSqB3.versao);

  afirma(erros.length === 0, 'nenhum erro de JS durante todo o fluxo (encontrados: ' + erros.length + ')');
  await ctx.close();
  await browser.close();

  console.log(falhas === 0
    ? '\n============================\nOK — o caminho de no-op também é atomicamente seguro: o rascunho só é descartado quando continua semanticamente equivalente à versão publicada vigente no momento da operação.'
    : '\n============================\n' + falhas + ' FALHA(S)');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
