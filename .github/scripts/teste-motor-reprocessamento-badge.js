/* Badge "Motor desatualizado" x REPROCESSAR COM MOTOR ATUAL (motor
 * arquitetural e motor de squad).
 *
 * POR QUE ESTE TESTE EXISTE
 * Relato real: 9 avaliações arquiteturais foram marcadas "Motor
 * desatualizado" logo após a migração para o motor parametrizado
 * (motor-arquitetura.js) — esperado, já que motorVersionArquitetura nunca
 * tinha existido antes. "REPROCESSAR TUDO COM MOTOR ATUAL" foi executado
 * sobre as 9, mas a listagem continuou mostrando o badge "Motor
 * desatualizado" nelas.
 *
 * Investigação: reprocessar uma avaliação sozinho, isoladamente, sempre
 * funcionou (motorVersionArquitetura passa a bater com
 * window.faMotorArquitetura.versaoAtual()). A causa real encontrada foi
 * outra, e mais sutil: publicarRegras() (em motor-arquitetura.js E em
 * motor-squad.js) criava uma versão NOVA mesmo quando as regras publicadas
 * eram BYTE A BYTE IDÊNTICAS às já vigentes — bastava alguém abrir "Editar
 * regras" só para olhar e clicar em "PUBLICAR NOVA VERSÃO" sem mudar nada
 * (ex.: explorando a tela nova logo após o deploy) para que TODAS as
 * avaliações recém-reprocessadas voltassem a ficar desatualizadas de novo,
 * mesmo sem nenhuma regra ter mudado de fato.
 *
 * Este teste prova as duas pontas, com o Firebase SUBSTITUÍDO pelo falso
 * (.github/scripts/firebase-falso.js) — hermético, sem segredo, sem rede:
 *   1. reprocessar uma avaliação concluída ANTES desta migração (sem
 *      motorVersionArquitetura) faz o badge "Motor desatualizado" sumir da
 *      listagem, em lote (REPROCESSAR TUDO) e não só individualmente;
 *   2. publicar as MESMAS regras (nenhuma mudança) NÃO cria uma versão
 *      nova — nem no motor arquitetural, nem no motor de squad — logo não
 *      pode re-marcar como desatualizado o que acabou de ser reprocessado;
 *   3. o histórico da interpretação anterior (historicoMotor) continua
 *      preservado depois do reprocessamento.
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

/* Avaliação concluída ANTES desta migração: motorVersion de uma versão
 * antiga do motor e SEM motorVersionArquitetura (campo que não existia
 * ainda). Respostas P1-P5 SIM, resto NÃO -> produto-principal. */
function itemPreMigracao(nome) {
  var respostas = {};
  ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia'].forEach(function (id) {
    respostas[id] = { valor: 'sim', observacao: '', justificativaAuto: 'auto', codigoPergunta: 'P', textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 };
  });
  ['jornada', 'medicao', 'gestao', 'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'].forEach(function (id) {
    respostas[id] = { valor: 'nao', observacao: '', justificativaAuto: 'auto', codigoPergunta: 'P', textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 };
  });
  return {
    nome: nome, descricao: '', publico: '', necessidade: '', observacoesGerais: '',
    status: 'concluido', respostas: respostas,
    resultadoAutomatico: 'produto', decisaoFinal: 'produto', decisaoManual: false,
    camadaSugerida: { id: 'produto-principal', label: 'Produto/Serviço principal', motivos: [], conflito: null, incoerencia: false, especializacao: null, papelEstrutural: null, relacao: null },
    justificativaAutomatica: 'texto antigo', criteriosEssenciaisFalhos: [], exclusoesConflitantes: null, criteriosAtendidos: 5,
    motorVersion: '2026.08.01-1', questionnaireContentVersion: 1,
    criadoEm: '2026-08-01T10:00:00.000Z', atualizadoEm: '2026-08-01T10:00:00.000Z',
    responsavel: { name: 'Teste', email: EMAIL }, versao: 1, versaoAnteriorKey: null,
    excluido: false, excluidoEm: null, excluidoPor: null, justificativaExclusao: null, historicoMotor: null
  };
}

async function abrirApp(browser) {
  const admins = {}; admins[KEY] = { email: EMAIL };
  const avaliacoesProduto = {};
  for (var i = 1; i <= 9; i++) avaliacoesProduto['fakeitem' + i] = itemPreMigracao('Item Pré-Migração ' + i);
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {},
    'turmas-checkin': {}, 'turmas-espera': {}, 'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {},
    eventos: {}, 'turmas-publico': {}, 'eventos-publico': {}, 'avaliacoes-produto': avaliacoesProduto, 'avaliacoes-squad': {},
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
  await page.goto(BASE + '/index.html#avaliacoes', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page); /* login decidido e acessos resolvidos (antes: opções no lugar do argumento, engolida + 800 ms + 400 ms fixos) */
  return { ctx, page, erros };
}

(async () => {
  const browser = await chromium.launch();
  const { ctx, page, erros } = await abrirApp(browser);

  console.log('== 1. Antes de reprocessar: as 9 avaliações pré-migração aparecem "Motor desatualizado" ==');
  const badgesAntes = await page.locator('.avp-tag-motor--desatualizado').count();
  afirma(badgesAntes === 9, '9 badges "Motor desatualizado" antes de reprocessar: ' + badgesAntes);

  console.log('\n== 2. REPROCESSAR TUDO COM MOTOR ATUAL limpa o badge das 9 ==');
  await page.click('#avpReprocessarTudoBtn');
  await page.waitForTimeout(200);
  await page.click('#avpLoteConfirmar');
  await page.waitForTimeout(1500);

  const dbAposReprocessar = await page.evaluate(() => window.__CFG.db['avaliacoes-produto']);
  const versaoAtualApos1 = await page.evaluate(() => window.faMotorArquitetura.versaoAtual());
  afirma(dbAposReprocessar['fakeitem1'].motorVersionArquitetura === versaoAtualApos1,
    'motorVersionArquitetura gravado (' + dbAposReprocessar['fakeitem1'].motorVersionArquitetura + ') bate com a versão publicada atual (' + versaoAtualApos1 + ')');
  afirma(dbAposReprocessar['fakeitem1'].motorVersion !== '2026.08.01-1', 'motorVersion (legado) também foi atualizado');
  const badgesDepois = await page.locator('.avp-tag-motor--desatualizado').count();
  afirma(badgesDepois === 0, 'badges "Motor desatualizado" depois de reprocessar (esperado 0): ' + badgesDepois);

  console.log('\n== 3. Histórico da interpretação ANTERIOR foi preservado (não perdido pelo reprocessamento) ==');
  const hist = dbAposReprocessar['fakeitem1'].historicoMotor || [];
  afirma(hist.length === 1, 'historicoMotor ganhou 1 entrada: ' + hist.length);
  afirma(hist[0] && hist[0].motorVersion === '2026.08.01-1', 'histórico preserva o motorVersion ANTERIOR: ' + (hist[0] && hist[0].motorVersion));
  afirma(hist[0] && hist[0].camadaSugerida && hist[0].camadaSugerida.id === 'produto-principal', 'histórico preserva a classificação ANTERIOR');

  console.log('\n== 4. Causa raiz do relato: publicar as MESMAS regras (sem mudança nenhuma) NÃO pode re-marcar como desatualizado ==');
  const resultadoPublishArq = await page.evaluate(() => new Promise((resolve) => {
    var v1 = window.faMotorArquitetura.versaoAtual();
    var regrasIdenticas = JSON.parse(JSON.stringify(window.faMotorArquitetura.regrasDaVersao(v1).regras));
    window.faMotorArquitetura.publicarRegras(regrasIdenticas, { name: 'Admin' }, function (err, info) {
      setTimeout(() => resolve({ v1: v1, v2: window.faMotorArquitetura.versaoAtual(), info: info }), 200);
    });
  }));
  afirma(resultadoPublishArq.v1 === resultadoPublishArq.v2,
    'publicar regras arquiteturais idênticas NÃO cria versão nova (' + resultadoPublishArq.v1 + ' -> ' + resultadoPublishArq.v2 + ')');
  afirma(!!(resultadoPublishArq.info && resultadoPublishArq.info.semMudanca), 'callback sinaliza semMudanca:true');

  const dbAposPublishSemMudanca = await page.evaluate(() => window.__CFG.db['avaliacoes-produto']);
  const badgesAposPublishSemMudanca = await page.locator('.avp-tag-motor--desatualizado').count();
  afirma(badgesAposPublishSemMudanca === 0,
    'as 9 avaliações CONTINUAM "Motor atual" depois de um publish sem mudança nenhuma (esperado 0 badges): ' + badgesAposPublishSemMudanca);
  afirma(dbAposPublishSemMudanca['fakeitem1'].motorVersionArquitetura === resultadoPublishArq.v2,
    'motorVersionArquitetura da avaliação continua batendo com a versão publicada (que não mudou)');

  console.log('\n== 5. Mesma garantia no motor de squad (publish sem mudança não avança motorSquadVersion) ==');
  const resultadoPublishSquad = await page.evaluate(() => new Promise((resolve) => {
    var v1 = window.faMotorSquad.versaoAtual();
    var regrasIdenticas = JSON.parse(JSON.stringify(window.faMotorSquad.regrasDaVersao(v1)));
    window.faMotorSquad.publicarRegras(regrasIdenticas, { name: 'Admin' }, function (err, info) {
      setTimeout(() => resolve({ v1: v1, v2: window.faMotorSquad.versaoAtual(), info: info }), 200);
    });
  }));
  afirma(resultadoPublishSquad.v1 === resultadoPublishSquad.v2,
    'publicar regras de squad idênticas NÃO cria versão nova (' + resultadoPublishSquad.v1 + ' -> ' + resultadoPublishSquad.v2 + ')');
  afirma(!!(resultadoPublishSquad.info && resultadoPublishSquad.info.semMudanca), 'callback sinaliza semMudanca:true');

  afirma(erros.length === 0, 'nenhum erro de JS durante todo o fluxo (encontrados: ' + erros.length + ')');
  await ctx.close();
  await browser.close();

  console.log(falhas === 0
    ? '\n============================\nOK — reprocessar limpa o badge, histórico é preservado, e publicar sem mudança nenhuma nunca mais re-marca como desatualizado.'
    : '\n============================\n' + falhas + ' FALHA(S)');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
