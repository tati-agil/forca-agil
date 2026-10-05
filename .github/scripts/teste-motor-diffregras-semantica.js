/* Semântica de diffRegras/publicarRegras: o que conta como mudança LÓGICA
 * do motor (versiona) e o que não conta (nunca versiona).
 *
 * POR QUE ESTE TESTE EXISTE
 * Complementa o fix de "publicar sem mudança nenhuma vira no-op"
 * (teste-motor-reprocessamento-badge.js) fechando duas lacunas que
 * ficariam mal cobertas só por aquele teste:
 *   1. diffRegras só percorria as regras NOVAS — uma regra REMOVIDA por
 *      inteiro (existia na versão publicada, sumiu no rascunho) nunca
 *      aparecia como alteração, então "remover uma regra" seria tratado
 *      como no-op por engano (justamente o tipo de mudança que MAIS
 *      precisa versionar, porque pode alterar qual regra decide um caso).
 *   2. trocar só a PRECEDÊNCIA (ordem) entre duas regras, com as mesmas
 *      condições de antes, muda o resultado de qualquer caso em que as
 *      duas poderiam bater ao mesmo tempo — isso É mudança lógica, mesmo
 *      sem nenhuma condição ter mudado.
 * E prova o inverso: uma alteração PURAMENTE textual (rótulo/interpretação
 * de um veredito, publicada por salvarTextos) nunca passa perto de
 * diffRegras/publicarRegras — são funções inteiramente separadas — então
 * nunca pode versionar o motor nem re-marcar avaliação nenhuma.
 *
 * Roda com o Firebase SUBSTITUÍDO pelo falso (firebase-falso.js): hermético,
 * sem segredo, sem rede. Chama as APIs de window.faMotorArquitetura/
 * window.faMotorSquad diretamente (os mesmos caminhos que os botões da UI
 * chamam) para testar a semântica de perto, sem depender de seletores de
 * tela que já são cobertos por outros testes deste repositório.
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

function publicar(motorRef, regras) {
  return new Promise((resolve) => {
    window[motorRef].publicarRegras(regras, { name: 'Admin' }, function (err, info) {
      setTimeout(() => resolve({ err: err, info: info, versao: window[motorRef].versaoAtual() }), 200);
    });
  });
}

(async () => {
  const browser = await chromium.launch();
  const { ctx, page, erros } = await abrirApp(browser);

  console.log('== MOTOR ARQUITETURAL ==');

  console.log('\n-- 1. Trocar só a PRECEDÊNCIA (ordem) entre duas regras, condições intactas -> versiona --');
  const r1 = await page.evaluate(() => {
    var v1 = window.faMotorArquitetura.versaoAtual();
    var regras = JSON.parse(JSON.stringify(window.faMotorArquitetura.regrasDaVersao(v1).regras));
    var a = regras.filter((r) => r.codigo === 'CANAL')[0];
    var b = regras.filter((r) => r.codigo === 'DOCUMENTO_INFORMACAO')[0];
    var tmp = a.ordem; a.ordem = b.ordem; b.ordem = tmp;
    return { v1: v1, regras: regras };
  });
  const pub1 = await page.evaluate((regras) => new Promise((resolve) => {
    window.faMotorArquitetura.publicarRegras(regras, { name: 'Admin' }, function (err, info) {
      setTimeout(() => resolve({ err: err, info: info, versao: window.faMotorArquitetura.versaoAtual() }), 200);
    });
  }), r1.regras);
  afirma(!pub1.err, 'publicação da troca de precedência não gerou erro de validação');
  afirma(pub1.versao === r1.v1 + 1, 'versão avançou (' + r1.v1 + ' -> ' + pub1.versao + ') só por trocar a ordem entre CANAL e DOCUMENTO_INFORMACAO');
  afirma(pub1.info && pub1.info.alteradas && pub1.info.alteradas.length === 2, 'diffRegras aponta as DUAS regras afetadas pela troca (' + (pub1.info && pub1.info.alteradas.length) + ')');
  afirma(!(pub1.info && pub1.info.semMudanca), 'NÃO foi tratado como no-op');

  console.log('\n-- 2. Remover uma regra por inteiro (sem tocar nas outras) -> versiona --');
  const r2 = await page.evaluate(() => {
    var v = window.faMotorArquitetura.versaoAtual();
    var regras = JSON.parse(JSON.stringify(window.faMotorArquitetura.regrasDaVersao(v).regras));
    return regras.filter((r) => r.codigo !== 'REGRA_CONDICAO'); // remove uma regra inteira, preserva o fallback
  });
  const pub2 = await page.evaluate((regras) => new Promise((resolve) => {
    var v = window.faMotorArquitetura.versaoAtual();
    window.faMotorArquitetura.publicarRegras(regras, { name: 'Admin' }, function (err, info) {
      setTimeout(() => resolve({ v: v, err: err, info: info, versao: window.faMotorArquitetura.versaoAtual() }), 200);
    });
  }), r2);
  afirma(!pub2.err, 'publicação com uma regra removida não gerou erro de validação (fallback ainda cobre tudo)');
  afirma(pub2.versao === pub2.v + 1, 'versão avançou (' + pub2.v + ' -> ' + pub2.versao + ') por REMOVER uma regra inteira, mesmo sem sobrar nenhuma condição "modificada" no lado novo');
  afirma(pub2.info && pub2.info.alteradas && pub2.info.alteradas.length === 1 && pub2.info.alteradas[0].codigo === 'REGRA_CONDICAO' && pub2.info.alteradas[0].novo === null,
    'diffRegras aponta a regra removida com novo:null: ' + JSON.stringify(pub2.info && pub2.info.alteradas));

  console.log('\n-- 3. Alteração PURAMENTE textual (rótulo de uma camada) -> NÃO versiona --');
  const versaoAntesTexto = await page.evaluate(() => window.faMotorArquitetura.versaoAtual());
  const resultTexto = await page.evaluate(() => new Promise((resolve) => {
    var textos = JSON.parse(JSON.stringify(window.faMotorArquitetura.textosAtuais()));
    textos['canal'] = { rotulo: 'Canal (redação revisada)' };
    window.faMotorArquitetura.salvarTextos(textos, { name: 'Admin' }, function (err, info) {
      setTimeout(() => resolve({ err: err, info: info, versao: window.faMotorArquitetura.versaoAtual() }), 200);
    });
  }));
  afirma(!resultTexto.err, 'salvarTextos não gerou erro');
  afirma(resultTexto.versao === versaoAntesTexto, 'versão do motor NÃO mudou só por causa de um texto: ' + versaoAntesTexto + ' -> ' + resultTexto.versao);
  afirma(resultTexto.info && resultTexto.info.alterados && resultTexto.info.alterados.length === 1, 'salvarTextos registrou a alteração textual separadamente de diffRegras');

  console.log('\n-- 4. Publicar as MESMAS regras de novo (no-op) -> NÃO versiona, mas fica registrado na auditoria --');
  const noop = await page.evaluate(() => new Promise((resolve) => {
    var v = window.faMotorArquitetura.versaoAtual();
    var regrasIdenticas = JSON.parse(JSON.stringify(window.faMotorArquitetura.regrasDaVersao(v).regras));
    window.faMotorArquitetura.publicarRegras(regrasIdenticas, { name: 'Admin' }, function (err, info) {
      setTimeout(() => {
        window.faMotorArquitetura.auditoria(function (lista) { resolve({ v: v, err: err, info: info, versao: window.faMotorArquitetura.versaoAtual(), lista: lista }); });
      }, 200);
    });
  }));
  afirma(noop.versao === noop.v, 'versão NÃO avançou com publish sem mudança: ' + noop.v + ' -> ' + noop.versao);
  afirma(!!(noop.info && noop.info.semMudanca), 'callback sinaliza semMudanca:true');
  const entradaSemMudanca = noop.lista.filter((a) => a.tipo === 'sem_alteracao')[0];
  afirma(!!entradaSemMudanca, 'auditoria tem UMA entrada tipo "sem_alteracao"');
  afirma(!!entradaSemMudanca && entradaSemMudanca.versaoAnterior === entradaSemMudanca.novaVersao, 'entrada de no-op NÃO registra versaoAnterior -> versaoAnterior+1 (mesma versão dos dois lados)');
  const entradasRegraFalsas = noop.lista.filter((a) => a.tipo === 'regra' && a.versaoAnterior === noop.v && a.novaVersao === noop.v + 1);
  afirma(entradasRegraFalsas.length === 0, 'auditoria NÃO tem nenhuma entrada tipo "regra" fingindo versão ' + noop.v + ' -> ' + (noop.v + 1));

  console.log('\n-- 5. Mudança de CONDIÇÃO de verdade -> versiona e torna avaliação elegível para reprocessamento --');
  const keyItem = await page.evaluate((v) => {
    var respostas = {};
    ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia'].forEach((id) => { respostas[id] = { valor: 'sim' }; });
    ['jornada', 'medicao', 'gestao', 'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'].forEach((id) => { respostas[id] = { valor: 'nao' }; });
    var item = {
      nome: 'Item Teste Condição', status: 'concluido', respostas: respostas,
      camadaSugerida: { id: 'produto-principal', label: 'Produto/Serviço principal' },
      motorVersion: '2026.09.29-2', motorVersionArquitetura: v, questionnaireContentVersion: 1,
      criadoEm: '2026-09-01T00:00:00.000Z', atualizadoEm: '2026-09-01T00:00:00.000Z',
      responsavel: { name: 'Teste' }, versao: 1, versaoAnteriorKey: null, excluido: false, historicoMotor: null
    };
    window.__CFG.db['avaliacoes-produto']['itemcond1'] = item;
    return 'itemcond1';
  }, noop.versao);
  const mudancaCondicao = await page.evaluate(() => new Promise((resolve) => {
    var v = window.faMotorArquitetura.versaoAtual();
    var regras = JSON.parse(JSON.stringify(window.faMotorArquitetura.regrasDaVersao(v).regras));
    var principal = regras.filter((r) => r.codigo === 'PRODUTO_SERVICO_PRINCIPAL')[0];
    var leafP5 = principal.condicoes.all.filter((c) => c.campo === 'P5')[0];
    leafP5.valor = 'NAO';
    window.faMotorArquitetura.publicarRegras(regras, { name: 'Admin' }, function (err, info) {
      setTimeout(() => resolve({ v: v, err: err, info: info, versao: window.faMotorArquitetura.versaoAtual() }), 200);
    });
  }));
  afirma(!mudancaCondicao.err, 'publicação da mudança de condição não gerou erro');
  afirma(mudancaCondicao.versao === mudancaCondicao.v + 1, 'versão avançou por mudar uma condição de verdade: ' + mudancaCondicao.v + ' -> ' + mudancaCondicao.versao);
  const itemDepoisMudanca = await page.evaluate((k) => window.__CFG.db['avaliacoes-produto'][k], keyItem);
  afirma(itemDepoisMudanca.motorVersionArquitetura !== mudancaCondicao.versao,
    'a avaliação (gravada com a versão ANTERIOR) fica elegível para reprocessamento: motorVersionArquitetura=' + itemDepoisMudanca.motorVersionArquitetura + ' vs versaoAtual=' + mudancaCondicao.versao);

  console.log('\n== MOTOR DE SQUAD ==');

  console.log('\n-- 6. Trocar só a PRECEDÊNCIA (ordem) entre duas regras do mesmo eixo -> versiona --');
  const squad1 = await page.evaluate(() => new Promise((resolve) => {
    var v1 = window.faMotorSquad.versaoAtual();
    var regras = JSON.parse(JSON.stringify(window.faMotorSquad.regrasDaVersao(v1)));
    var b2 = regras.eixoB.filter((r) => r.codigo === 'B2')[0];
    var b3 = regras.eixoB.filter((r) => r.codigo === 'B3')[0];
    var tmp = b2.ordem; b2.ordem = b3.ordem; b3.ordem = tmp;
    window.faMotorSquad.publicarRegras(regras, { name: 'Admin' }, function (err, info) {
      setTimeout(() => resolve({ v1: v1, err: err, info: info, versao: window.faMotorSquad.versaoAtual() }), 200);
    });
  }));
  afirma(!squad1.err, 'publicação da troca de precedência (squad) não gerou erro');
  afirma(squad1.versao === squad1.v1 + 1, 'motorSquadVersion avançou (' + squad1.v1 + ' -> ' + squad1.versao + ') só por trocar a ordem entre B2 e B3');
  afirma(squad1.info && squad1.info.alteradas && squad1.info.alteradas.length === 2, 'diffRegras (squad) aponta as duas regras afetadas: ' + (squad1.info && squad1.info.alteradas.length));

  console.log('\n-- 7. Alteração PURAMENTE textual (interpretação de um veredito) -> NÃO versiona --');
  const versaoAntesTextoSquad = await page.evaluate(() => window.faMotorSquad.versaoAtual());
  const resultTextoSquad = await page.evaluate(() => new Promise((resolve) => {
    var textos = JSON.parse(JSON.stringify(window.faMotorSquad.textosAtuais()));
    textos['PRESENTES'] = Object.assign({}, textos['PRESENTES'], { interpretacao: 'Interpretação revisada.' });
    window.faMotorSquad.salvarTextos(textos, { name: 'Admin' }, function (err, info) {
      setTimeout(() => resolve({ err: err, info: info, versao: window.faMotorSquad.versaoAtual() }), 200);
    });
  }));
  afirma(!resultTextoSquad.err, 'salvarTextos (squad) não gerou erro');
  afirma(resultTextoSquad.versao === versaoAntesTextoSquad, 'motorSquadVersion NÃO mudou só por causa de um texto: ' + versaoAntesTextoSquad + ' -> ' + resultTextoSquad.versao);

  console.log('\n-- 8. Publicar as MESMAS regras de novo (no-op) -> NÃO versiona, fica na auditoria como sem_alteracao --');
  const noopSquad = await page.evaluate(() => new Promise((resolve) => {
    var v = window.faMotorSquad.versaoAtual();
    var regrasIdenticas = JSON.parse(JSON.stringify(window.faMotorSquad.regrasDaVersao(v)));
    window.faMotorSquad.publicarRegras(regrasIdenticas, { name: 'Admin' }, function (err, info) {
      setTimeout(() => {
        window.faMotorSquad.auditoria(function (lista) { resolve({ v: v, err: err, info: info, versao: window.faMotorSquad.versaoAtual(), lista: lista }); });
      }, 200);
    });
  }));
  afirma(noopSquad.versao === noopSquad.v, 'motorSquadVersion NÃO avançou com publish sem mudança: ' + noopSquad.v + ' -> ' + noopSquad.versao);
  afirma(!!(noopSquad.info && noopSquad.info.semMudanca), 'callback (squad) sinaliza semMudanca:true');
  afirma(noopSquad.lista.filter((a) => a.tipo === 'sem_alteracao').length === 1, 'auditoria (squad) tem UMA entrada tipo "sem_alteracao"');

  afirma(erros.length === 0, 'nenhum erro de JS durante todo o fluxo (encontrados: ' + erros.length + ')');
  await ctx.close();
  await browser.close();

  console.log(falhas === 0
    ? '\n============================\nOK — os motores só versionam por mudança lógica de verdade (precedência, condição, inclusão/exclusão de regra); texto e no-op nunca versionam.'
    : '\n============================\n' + falhas + ' FALHA(S)');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
