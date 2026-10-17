/* PORTA 2 (PR 2) — o sistema RECONHECE as atuações organizacionais (objetos organizacionais, sem P1–P16).
 * Desktop e celular 375 px. Firebase falso em persistência real; hermético. Os registros da Porta 2 entram pela
 * semente (a tela que os cria é a PR 3). As regras do banco são provadas por teste-rules-objetos-organizacionais.js;
 * as exportações por teste-posicionamento-exportacao-nucleo.js; o vínculo com a estrutura, contra o emulador, por
 * teste-estruturas-jornada.js (seção 8f).
 *   1. Lista do Posicionamento: a atuação aparece marcada como "Atuação organizacional"; a Porta 1, sem marca.
 *   2. Ficha da Porta 2: bloco "Atuação organizacional" (nome atual, descrição, finalidade, referência informativa que
 *      não calcula nada, situação); sem aviso de base P1–P16; 
 *      decisão final como na Porta 1 ("Reavaliar" com hipótese nova desde a PR 3). A ficha da Porta 1 continua igual.
 *   3. Rascunho da Porta 2: o bloco aparece; concluir funciona com o objeto ativo (o gate P1–P16 não se aplica) e grava
 *      o resultado do motor, mantendo origem e hipótese. Objeto encerrado: a conclusão trava com o motivo e nada é gravado.
 *   4. Adequação à Squad pelo atalho da ficha: atuação com posicionamento firme do ramo Linha abre S1–S8 do item, sem
 *      base P1–P16, com a origem da liberação; Área Especializada não tem o atalho.
 *   5. Catálogo do Mapa: as atuações aparecem (situação, posicionamento efetivo, "Encerrada"), sem link para Avaliação
 *      de Produto/Serviço; o item P1–P16 referenciado mostra a referência; a Porta 1 continua igual.
 *   6. Celular 375 px sem rolagem lateral; nenhum erro de página. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const M = require(path.join(__dirname, '..', '..', 'forca-agil', 'motor-posicionamento.js'));
const MOTOR_PRODUTO = require('./montar-regras-posicionamento.js').MOTOR_PRODUTO;
const ARQ = 'arquitetura@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const QUANDO = '2026-10-01T09:00:00.000Z';
const ORIGEM = 'objeto-organizacional';
let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

const ORDEM_P = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao', 'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
function produto(id, nome) {
  const r = {}; ORDEM_P.forEach((q, i) => { r[q] = { valor: 'sim', justificativaAuto: 'i', codigoPergunta: 'P' + (i + 1), textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 }; });
  return { itemId: id, nome, descricao: '', publico: '', necessidade: '', observacoesGerais: '', status: 'concluido', resultadoAutomatico: 'produto', decisaoFinal: 'produto', camadaSugerida: { id: 'produto-principal', label: 'Produto/Serviço principal' },
    respostas: r, justificativaAutomatica: 'j', criteriosEssenciaisFalhos: [], criteriosAtendidos: 5, motorVersion: MOTOR_PRODUTO, motorVersionArquitetura: 1, questionnaireContentVersion: 1,
    excluido: false, criadoEm: QUANDO, atualizadoEm: QUANDO, versao: 1, responsavel: { name: 'F', email: 'f@previ.com.br' } };
}
const outra = { name: 'Outra', email: 'o@previ.com.br' };
function registro(itemId, itemNome, respostas, extra) {
  const reg = { itemId, itemNome, questionarioCodigo: 'POSICIONAMENTO_ORGANIZACIONAL', questionnaireContentVersion: 1, versao: 1, status: 'rascunho', revisao: 2, respostas: {},
    criadoPor: outra, criadoEm: QUANDO, atualizadoPor: outra, atualizadoEm: QUANDO, auditoriaCriacaoId: 'ac' + itemId };
  Object.keys(respostas).forEach((q) => { reg.respostas[q] = { resposta: respostas[q], codigoPergunta: q, questionnaireContentVersion: 1, dataResposta: QUANDO }; });
  return Object.assign(reg, extra || {});
}
function concluida(itemId, itemNome, respostas, extra) {
  const res = M.avaliar(respostas, {}), ra = {};
  Object.keys(res).forEach((k) => { const v = res[k]; if (v !== null && !(Array.isArray(v) && !v.length)) ra[k] = v; });
  return registro(itemId, itemNome, respostas, Object.assign({ status: 'concluido', resultadoAutomatico: ra, concluidoPor: outra, concluidoEm: QUANDO, auditoriaConclusaoId: 'az' + itemId }, extra || {}));
}
const P2 = (h) => ({ origem: ORIGEM, hipoteseInicial: h });
const objeto = (nome, extra) => Object.assign({ nome, descricao: 'Descrição de ' + nome, finalidade: 'Finalidade de ' + nome, situacao: 'ativo', revisao: 1,
  criadoPor: { uid: 'u', email: ARQ }, criadoEm: 1791713600000, atualizadoPor: { uid: 'u', email: ARQ }, atualizadoEm: 1791713600000, auditoriaId: 'a1' }, extra || {});
function semente() {
  const aut = {}; aut[chave(ARQ)] = { email: ARQ, tipo: 'avaliacao-arquitetura' };
  const users = {}; users[chave(ARQ)] = { name: 'Arquiteta', email: ARQ, area: 'INFOR' };
  const conceitos = {}, fontes = {};
  M.CODIGOS_FIRMES.concat(['LINHA', 'PLATAFORMA']).forEach((c, i) => {
    conceitos[c] = { nome: 'Tx ' + c, ordem: i + 1, ativo: true, camada: 'A', definicao: { texto: 'Definição de ' + c, versao: 1, publicadaEm: '2026-10-01T09:00:00.000Z', publicadaPor: 'semente@teste' } };
  });
  const AE = { O1: 'NAO', O2: 'SIM', O3: 'NAO' }, COE = { O1: 'NAO', O2: 'NAO', O3: 'SIM' }, NEG = { O1: 'SIM', O2: 'NAO', O3: 'NAO', O4: 'NAO', O5: 'SIM' };
  return {
    'fa-users': users, 'fa-admins': {}, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {},
    'fa-avaliacao-autorizados': aut, 'avaliacoes-squad': {}, 'motor-squad-config': {},
    'avaliacoes-produto': { pCapec: produto('pCapec', 'Capec'), pJur: produto('pJur', 'Jurídico (P1–P16)') },
    'objetos-organizacionais': {
      oJur: objeto('Assessoramento jurídico', { referenciaItemId: 'pJur', contexto: 'Preventivo, consultivo, contencioso e negocial' }),
      oAgi: objeto('Disseminação de agilidade'), oNeg: objeto('Atuação de negócio'),
      oEnc: objeto('Atuação encerrada', { situacao: 'encerrado', revisao: 2, encerramento: { motivo: 'Incorporada a outra atuação', em: 1791713700000, por: { uid: 'u', email: ARQ } } })
    },
    'avaliacoes-posicionamento': {
      gC: concluida('pCapec', 'Capec', NEG, { avaliacaoArquiteturalId: 'pCapec' }),
      gJ: concluida('oJur', 'Assessoramento jurídico', AE, P2('AREA_ESPECIALIZADA')),
      gN: concluida('oNeg', 'Atuação de negócio', NEG, P2('NEGOCIOS')),
      gA: registro('oAgi', 'Disseminação de agilidade', COE, P2('NAO_SEI')),
      gE: registro('oEnc', 'Atuação encerrada', COE, P2('COE'))
    },
    'posicionamento-vigente-por-item': { pCapec: 'gC', oJur: 'gJ', oNeg: 'gN' },
    'posicionamento-rascunho-por-item': { oAgi: 'gA', oEnc: 'gE' },
    'posicionamento-decisoes': {
      gJ: { itemId: 'oJur', versaoAvaliacao: 1, versaoMotor: 1, codigoAutomatico: 'AREA_ESPECIALIZADA', codigoFinal: 'AREA_ESPECIALIZADA', tipoDecisao: 'CONFIRMACAO',
        nomeNaDecisao: { nome: 'Tx AREA_ESPECIALIZADA', contingencia: false }, liberaSquad: false, decididoPor: outra, decididoEm: QUANDO, auditoriaId: 'adJ' } },
    'posicionamento-auditoria': {},
    taxonomia: { organizacional: { conceitos, fontes } }
  };
}
async function abrir(browser, viewport, hash) {
  const cfg = { db: semente(), user: { email: ARQ, emailVerified: true, uid: 'u-' + chave(ARQ) }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
const ir = (page, h) => page.evaluate((x) => { location.hash = x; }, h);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function rodada(browser, viewport, rotulo) {
  console.log('\n=== ' + rotulo + ' ===');
  let { ctx, page, erros } = await abrir(browser, viewport, '#arquitetura?po=lista');

  console.log('1. Lista do Posicionamento');
  await page.waitForSelector('#poLista .po-linha[data-key="gJ"]');
  afirma(/Responsabilidade organizacional/.test(await texto(page, '.po-linha[data-key="gJ"]')) && !/Responsabilidade organizacional/.test(await texto(page, '.po-linha[data-key="gC"]')), 'a responsabilidade da Porta 2 vem marcada ("Responsabilidade organizacional"); a Porta 1 não');

  console.log('2. Ficha da Porta 2');
  await ir(page, '#arquitetura?po=gJ');
  await esperarCondicao(page, () => !!document.getElementById('poObjetoNome') && !!document.getElementById('poDecisaoFinal'), undefined, { limite: 10000 });
  const fj = await texto(page, '#poObjeto');
  afirma(/Assessoramento jurídico/.test(fj) && /Finalidade de Assessoramento jurídico/.test(fj) && /Preventivo, consultivo/.test(fj), 'bloco da atuação: nome atual, finalidade e contexto');
  afirma(/Jurídico \(P1–P16\)/.test(await texto(page, '#poObjetoReferencia')) && /não participa do cálculo/.test(await texto(page, '#poObjetoReferencia')), 'referência informativa ao item P1–P16, sem entrar no cálculo');
  afirma((await texto(page, '#poObjetoSituacao')) === 'Ativa', 'situação da atuação: Ativa');
  afirma(!(await page.$('#poBaseRevisao')) && !!(await page.$('#poReavaliarBtn')) && !(await page.$('#poAvaliarSquadBtn')), 'sem aviso de base P1–P16, com "Reavaliar" (PR 3: com hipótese nova), sem atalho de Squad (Área Especializada)');
  afirma(/Tx AREA_ESPECIALIZADA/.test(await texto(page, '#poDecisaoFinal')), 'decisão final como na Porta 1');
  afirma(await larguraOk(page), 'ficha da Porta 2 sem rolagem lateral');
  await ir(page, '#arquitetura?po=gC');
  await page.waitForSelector('#poResultado #poRecomendado');
  afirma(!(await page.$('#poObjeto')) && !!(await page.$('#poReavaliarBtn')), 'ficha da Porta 1 sem o bloco da atuação e com "Reavaliar", como antes');

  console.log('3. Rascunho da Porta 2: concluir');
  await ir(page, '#arquitetura?po=gE');
  await esperarCondicao(page, () => { const g = document.getElementById('poGate'); return !!g && /encerrada/.test(g.textContent); }, undefined, { limite: 10000 });
  afirma(await page.evaluate(() => document.getElementById('poConcluirBtn').disabled) && /Incorporada a outra atuação/.test(await texto(page, '#poObjetoSituacao')), 'objeto encerrado: conclusão travada com o motivo (e a situação diz por quê)');
  await ir(page, '#arquitetura?po=gA');
  await esperarCondicao(page, () => !!document.getElementById('poObjetoNome') && !document.getElementById('poConcluirBtn').disabled, undefined, { limite: 10000 });
  afirma(/Disseminação de agilidade/.test(await texto(page, '#poObjeto')) && !(await page.$('#poGate')), 'rascunho da Porta 2: bloco da atuação e nenhum gate de P1–P16');
  await page.click('#poConcluirBtn');
  await page.waitForSelector('#poResultado #poRecomendado', { timeout: 15000 });
  const db = await banco(page), gA = db['avaliacoes-posicionamento'].gA;
  afirma(gA.status === 'concluido' && gA.resultadoAutomatico.codigoResultado === 'COE' && db['posicionamento-vigente-por-item'].oAgi === 'gA' && gA.origem === ORIGEM && gA.hipoteseInicial === 'NAO_SEI' && !('avaliacaoArquiteturalId' in gA),
    'concluída pela Porta 2: resultado do motor (CoE), vigente, origem e hipótese intactas, sem base P1–P16');
  afirma(db['avaliacoes-posicionamento'].gE.status === 'rascunho', 'o rascunho do objeto encerrado continua intacto');

  console.log('4. Adequação à Squad pelo atalho');
  await ir(page, '#arquitetura?po=gN');
  await page.waitForSelector('#poAvaliarSquadBtn', { timeout: 10000 });
  await page.click('#poAvaliarSquadBtn');
  await page.waitForSelector('#avaliacoesSquad #sqPosicionamento', { timeout: 10000 });
  afirma(/Atuação de negócio/.test(await texto(page, '#avaliacoesSquad h3')), 'abre a S1–S8 da atuação, sem perguntar o nome');
  await esperarCondicao(page, () => /liberada/.test((document.getElementById('sqPosicionamento') || {}).textContent || ''), undefined, { limite: 10000 });
  await page.click('.sq-choice-group[data-codigo="S1"] .sq-choice-btn[data-valor="sim"]');
  await page.click('#sqSalvarRascunhoBtn');
  await page.waitForSelector('#sqFlashLista', { timeout: 10000 });
  const sq = Object.values((await banco(page))['avaliacoes-squad'] || {}).filter((v) => v.itemId === 'oNeg');
  afirma(sq.length === 1 && !sq[0].avaliacaoArquiteturalId && sq[0].origemLiberacao && sq[0].origemLiberacao.situacao === 'liberado' && sq[0].origemLiberacao.avaliacaoPosicionamentoId === 'gN',
    'a avaliação S é da atuação (sem base P1–P16), com a origem da liberação apontando para o Posicionamento', JSON.stringify(sq));
  await ctx.close();

  console.log('5. Catálogo do Mapa');
  ({ ctx, page, erros: erros } = await abrir(browser, viewport, '#arquitetura?mf=catalogo'));
  await page.waitForSelector('#mfCatalogo .mf-item[data-item="oJur"]', { timeout: 15000 });
  /* lista simples: o detalhe de cada objeto abre ao clicar (#arquitetura?mf=catalogo&item=<id>) */
  const item = async (id) => { await page.evaluate((i) => { location.hash = '#arquitetura?mf=catalogo&item=' + i; }, id); await page.waitForSelector('#mfCatalogo .mf-item--detalhe[data-item="' + id + '"]'); return texto(page, '#mfCatalogo .mf-item--detalhe[data-item="' + id + '"]'); };
  afirma(/Responsabilidade organizacional/.test(await texto(page, '#mfCatalogo .mf-linha[data-item="oJur"]')), 'na lista simples, a atuação vem marcada como "Atuação organizacional"');
  const tJ = await item('oJur');
  afirma(/Responsabilidade organizacional/.test(tJ) && /Tx AREA_ESPECIALIZADA/.test(tJ) && await page.locator('.mf-item[data-item="oJur"]').getAttribute('data-situacao') === 'firme', 'a atuação aparece, firme, com o posicionamento efetivo');
  afirma(await page.locator('.mf-item[data-item="oJur"] .mf-abrir-avp').count() === 0 && await page.locator('.mf-item[data-item="oJur"] .mf-abrir-po').count() === 1, 'sem link para Avaliação de Produto/Serviço; com link para o Posicionamento');
  afirma(/Encerrada/.test(await item('oEnc')) && /em andamento/.test(await item('oEnc')), 'atuação encerrada continua listada, marcada, com o rascunho em andamento');
  afirma(/em andamento/.test(await item('oAgi')) && await page.locator('.mf-item[data-item="oAgi"]').getAttribute('data-situacao') === 'sem-posicionamento', 'atuação com rascunho: sem Posicionamento, em andamento (nada de P1–P16)');
  afirma(/Representado pela responsabilidade “Assessoramento jurídico”/.test(await item('pJur')), 'o item P1–P16 referenciado mostra a referência (PR 4: representado pela atuação)');
  afirma(!/Responsabilidade organizacional (Porta 2)/.test(await item('pCapec')) && await page.locator('.mf-item[data-item="pCapec"] .mf-abrir-avp').count() === 1, 'a Porta 1 (Capec) continua igual');
  afirma(await larguraOk(page), 'catálogo sem rolagem lateral');
  afirma(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await rodada(browser, { width: 1280, height: 900 }, 'computador');
    await rodada(browser, { width: 375, height: 800 }, 'celular 375 px');
  } catch (e) { falhas++; console.error('ERRO', e && e.stack || e); }
  await browser.close();
  console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})();
