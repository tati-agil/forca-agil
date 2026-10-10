/* H1-Final — a tela com a versão 2 do motor de Posicionamento ainda INATIVA. Desktop e celular 375 px; Firebase
 * falso em persistência real; hermético. A lógica pura (trilha motores/<v>, núcleo da tela) é provada em
 * teste-conteudo-motor-posicionamento.js; aqui, o que a pessoa vê e o que a tela grava:
 *   1. ADMIN › Arquitetura › Questionários: o cartão "Redação para o motor de Posicionamento v2 (inativo)" — sem
 *      rascunho → importar a carga inicial (arquivo carregado só agora) grava SÓ motores/2/rascunho com
 *      motorCompativel = 2, mostra "compatível" e a redação só leitura; descartar (com confirmação) remove só ele;
 *      a redação em uso (versaoPublicada do questionário) não muda.
 *   2. Um registro v2 (só possível com dado preparado: nada no site cria um) SEM a redação v2 publicada: a tela
 *      trava com "Redação desta versão do motor (v2) indisponível" — nenhuma pergunta, nenhum texto v1 no lugar.
 *   3. Com a redação v2 publicada na trilha: 3 SIM no Nível 1 pedem D1; "mesma" abre D2 com as opções dos papéis
 *      com SIM + "Não é possível determinar"; escolher libera Concluir; trocar D1 para "distintas" avisa que a
 *      predominância sai e, confirmando, ela sai.
 *   4. Um registro v1 continua sem D2 (3 SIM = recorte, sem diagnóstico). Sem rolagem horizontal; sem erro de JS. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const MOTOR_PRODUTO = require('./montar-regras-posicionamento.js').MOTOR_PRODUTO;
const PADRAO_REGRAS = (() => {
  const c = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error };
  c.window = c; c.firebase = { database: () => ({ ref: () => ({ on() {}, once() { return Promise.resolve({ val: () => null }); } }) }) };
  vm.createContext(c); vm.runInContext(fs.readFileSync(path.join(RAIZ, 'motor-arquitetura.js'), 'utf8'), c);
  return JSON.parse(JSON.stringify(c.faMotorArquitetura.PADRAO_REGRAS.regras));
})();
/* a redação v2 publicada, como o H2 a publicará: a carga normalizada pela própria trilha */
const REDACAO_V2 = (() => {
  const c = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Set };
  c.window = c; c.firebase = { database: () => ({ ref: () => ({ on() {}, once() { return Promise.resolve({ val: () => null }); } }) }) };
  vm.createContext(c);
  ['motor-posicionamento-nucleo.js', 'questionarios-config.js', 'conteudo-inicial-posicionamento-v2.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), c));
  return JSON.parse(JSON.stringify(c.faQuestionarios.normalizarConteudoMotor('POSICIONAMENTO_ORGANIZACIONAL', c.faConteudoInicialPosicionamento[2].perguntas, 2).perguntas));
})();
const ARQ = 'arquitetura@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };
const QUANDO = '2026-10-01T09:00:00.000Z';
const QCOD = 'POSICIONAMENTO_ORGANIZACIONAL';

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

const ORDEM_P = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao',
  'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
function produto(itemId, nome) {
  const r = {};
  ORDEM_P.forEach((q, i) => { r[q] = { valor: 'sim', justificativaAuto: 'interpretação', codigoPergunta: 'P' + (i + 1), textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 }; });
  return { itemId, nome, descricao: '', publico: '', necessidade: '', observacoesGerais: '', status: 'concluido', resultadoAutomatico: 'produto', decisaoFinal: 'produto', camadaSugerida: { id: 'produto-principal', label: 'Produto/Serviço principal' },
    respostas: r, justificativaAutomatica: 'justificativa', criteriosEssenciaisFalhos: [], criteriosAtendidos: 5, motorVersion: MOTOR_PRODUTO, motorVersionArquitetura: 2, questionnaireContentVersion: 1,
    excluido: false, criadoEm: QUANDO, atualizadoEm: QUANDO, versao: 1, responsavel: { name: 'Fulana', email: 'f@previ.com.br' } };
}
const outra = { name: 'Outra', email: 'o@previ.com.br' };
function rascunho(itemId, itemNome, respostas, extra) {
  const reg = Object.assign({ itemId, itemNome, avaliacaoArquiteturalId: itemId, questionarioCodigo: QCOD, questionnaireContentVersion: 1, versao: 1, status: 'rascunho', revisao: 1,
    respostas: {}, criadoPor: outra, criadoEm: QUANDO, atualizadoPor: outra, atualizadoEm: QUANDO, auditoriaCriacaoId: 'ac' + itemId }, extra || {});
  Object.keys(respostas).forEach((q) => { reg.respostas[q] = { resposta: respostas[q], codigoPergunta: q, questionnaireContentVersion: 1, dataResposta: QUANDO }; });
  return reg;
}
const TRES = { O1: 'SIM', O2: 'SIM', O3: 'SIM' };
function semente(comRedacaoV2) {
  const aut = {}; aut[chave(ARQ)] = { email: ARQ, tipo: 'avaliacao-arquitetura' };
  const users = {}; users[chave(ARQ)] = { name: 'Pessoa', email: ARQ, area: 'INFOR' };
  const conceitos = {}, fontes = {};
  ['AREA_ESPECIALIZADA', 'COE', 'ESTRATEGIA_CLIENTES', 'NEGOCIOS', 'PLATAFORMA_CANAIS', 'PLATAFORMA_HABILITADORA_NEGOCIOS', 'PLATAFORMA_HABILITADORA_TECNOLOGIA', 'PLATAFORMA_CORPORATIVA', 'LINHA', 'PLATAFORMA'].forEach((c, i) => {
    conceitos[c] = { nome: 'Tx ' + c, ordem: i + 1, ativo: true, situacaoDefinicao: 'registrada', camada: 'A', definicaoVigenteFonteId: 'f1' };
    fontes[c] = { f1: { texto: 'Definição de ' + c, contexto: 'PREVI', situacao: 'vigente', tipoRedacao: 'Conceito' } };
  });
  const qc = {};
  if (comRedacaoV2) qc[QCOD] = { motores: { 2: { versaoPublicada: 1, versoes: { 1: { perguntas: REDACAO_V2, motorCompativel: 2 } } } } };
  return {
    'fa-users': users, 'fa-admins': {}, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {},
    'fa-avaliacao-autorizados': aut, 'avaliacoes-squad': {}, 'motor-squad-config': {}, 'questionarios-config': qc,
    'motor-arquitetura-config': { versaoPublicada: 2, versoes: { 2: { regras: PADRAO_REGRAS, publicadoEm: QUANDO, publicadoPor: outra } } },
    'avaliacoes-produto': { p2: produto('p2', 'Item V2'), p1: produto('p1', 'Item V1') },
    'avaliacoes-posicionamento': { r2: rascunho('p2', 'Item V2', TRES, { versaoMotor: 2 }), r1: rascunho('p1', 'Item V1', TRES) },
    'posicionamento-rascunho-por-item': { p2: 'r2', p1: 'r1' }, 'posicionamento-vigente-por-item': {}, 'posicionamento-decisoes': {}, 'posicionamento-auditoria': {},
    taxonomia: { organizacional: { conceitos, fontes } }
  };
}
async function abrir(browser, viewport, hash, comRedacaoV2) {
  const cfg = { db: semente(comRedacaoV2), user: { email: ARQ, emailVerified: true, uid: 'u-' + chave(ARQ) }, delayDefault: 10, persistenciaReal: true, delays: {}, fail: [] };
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
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function admin(browser, viewport, rotulo) {
  console.log('\n[' + rotulo + '] 1. ADMIN › Questionários — redação v2 (inativo)');
  const { ctx, page, erros } = await abrir(browser, viewport, '#admin?arq=questionarios', false);
  await page.waitForSelector('#avpConteudoMotor2');
  const antes = await banco(page);
  const card = page.locator('#avpConteudoMotor2');
  afirma(/motor de Posicionamento v2 \(inativo\)/.test(await card.innerText()) && /versão em vigor: 1/.test(await card.innerText()), 'cartão diz que o motor v2 está inativo e a versão em vigor é a 1');
  await esperarCondicao(page, () => /sem rascunho/.test(document.querySelector('#avpConteudoMotorSituacao') ? document.querySelector('#avpConteudoMotorSituacao').textContent : ''), 'sem rascunho');
  afirma(await page.evaluate(() => !window.faConteudoInicialPosicionamento), 'a carga inicial não foi carregada até alguém pedir');
  await page.click('#avpConteudoMotorImportarBtn');
  await page.waitForSelector('#avpConteudoMotorCompat');
  const db = await banco(page), r = db['questionarios-config'] && db['questionarios-config'][QCOD] && db['questionarios-config'][QCOD].motores && db['questionarios-config'][QCOD].motores[2];
  afirma(!!(r && r.rascunho) && r.rascunho.motorCompativel === 2 && r.rascunho.origem === 'carga-inicial' && r.rascunho.perguntas.length === 13 && !r.versaoPublicada && !r.versoes,
    'importar grava só motores/2/rascunho, motorCompativel = 2 pelo sistema, nada publicado');
  const q = db['questionarios-config'][QCOD];
  afirma(Object.keys(q).join(',') === 'motores' && JSON.stringify((antes['questionarios-config'] || {})[QCOD] || null) === 'null', 'a redação em uso (versaoPublicada/versoes do questionário) não foi tocada');
  afirma(/compatível com o contrato do motor v2 \(13 itens\)/.test(await page.locator('#avpConteudoMotorCompat').innerText()), 'mostra "compatível com o contrato do motor v2 (13 itens)"');
  await page.click('#avpConteudoMotorVer summary');
  const ver = await page.locator('#avpConteudoMotorVer').innerText();
  afirma(/DIAG_PREDOMINANCIA_N3/.test(ver) && /Não é possível determinar/.test(ver) && /NAO_DETERMINAVEL/.test(ver), 'redação só leitura com códigos fixos e rótulos');
  afirma(await page.locator('#avpConteudoMotorVer textarea, #avpConteudoMotorVer input').count() === 0, 'sem campo de edição (editar é do H2)');
  afirma(await larguraOk(page), 'sem rolagem horizontal');
  await page.click('#avpConteudoMotorDescartarBtn');
  await page.click('.avp-modal-confirm-btn');
  await esperarCondicao(page, () => /sem rascunho/.test(document.querySelector('#avpConteudoMotorSituacao') ? document.querySelector('#avpConteudoMotorSituacao').textContent : ''), 'descartado');
  const db2 = await banco(page);
  const q2 = (db2['questionarios-config'] || {})[QCOD];
  afirma(!(q2 && q2.motores && q2.motores[2] && q2.motores[2].rascunho), 'descartar remove o rascunho');
  afirma(!erros.length, 'nenhum erro de JS (ADMIN)', erros.join(' | '));
  await ctx.close();
}
async function telaV2(browser, viewport, rotulo) {
  console.log('\n[' + rotulo + '] 2. registro v2 sem redação v2 publicada');
  let { ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?po=r2', false);
  await page.waitForSelector('#poRedacaoIndisponivel');
  afirma(/Redação desta versão do motor \(v2\) indisponível/.test(await page.locator('#poRedacaoIndisponivel').innerText()), 'trava: "Redação desta versão do motor (v2) indisponível"');
  afirma(await page.locator('.po-resp, .po-diag-resp, .po-pred-resp, #poConcluirBtn, #poSalvarBtn').count() === 0, 'nenhuma pergunta, resposta, Salvar ou Concluir');
  afirma(!/Resultado integrado/.test(await page.locator('#poChecklist').innerText()), 'nenhum texto v1 ou de fábrica no lugar');
  afirma(await larguraOk(page), 'sem rolagem horizontal');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();

  console.log('[' + rotulo + '] 3. registro v2 com a redação v2 publicada');
  ({ ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?po=r2', true));
  await page.waitForSelector('.po-diag[data-nivel="N1"]');
  afirma(/fluxo de valor ou capacidade em funcionamento/.test(await page.locator('.po-pergunta[data-q="O1"]').innerText()), 'O1 com a redação v2');
  afirma(await page.locator('.po-pred').count() === 0, '3 SIM: pede D1, ainda sem D2');
  await page.click('.po-diag-resp[data-nivel="N1"][data-v="mesma"]');
  await page.waitForSelector('.po-pred[data-nivel="N1"]');
  const ops = await page.locator('.po-pred-resp').evaluateAll((bs) => bs.map((b) => b.dataset.v));
  afirma(JSON.stringify(ops) === JSON.stringify(['RESULTADO_INTEGRADO', 'EXECUCAO_ESPECIALIZADA', 'CAPACIDADE_NOS_OUTROS', 'NAO_DETERMINAVEL']), 'D2 com as opções dos 3 papéis + não determinável', ops.join(','));
  afirma(/Não é possível determinar/.test(await page.locator('.po-pred').innerText()) && /predominantemente o valor/.test(await page.locator('.po-pred').innerText()), 'D2 com a redação publicada');
  const txtConcluir = await page.locator('#poConcluirBtn').innerText();
  afirma(/predominância do Nível 1/i.test(txtConcluir) && await page.locator('#poConcluirBtn').isDisabled(), 'Concluir travado: falta a predominância', txtConcluir);
  await page.click('.po-pred-resp[data-v="CAPACIDADE_NOS_OUTROS"]');
  await esperarCondicao(page, () => /^CONCLUIR$/.test(document.querySelector('#poConcluirBtn').textContent.trim()), 'concluir liberado');
  afirma(!(await page.locator('#poConcluirBtn').isDisabled()), 'com a predominância, Concluir libera');
  afirma(await larguraOk(page), 'sem rolagem horizontal (D2 aberta)');
  await page.click('.po-diag-resp[data-nivel="N1"][data-v="distintas"]');
  await page.waitForSelector('.po-modal');
  afirma(/a predominância do Nível 1/.test(await page.locator('.po-modal').innerText()), '"distintas" avisa que a predominância sai');
  await page.click('.po-modal-sim');
  await esperarCondicao(page, () => !document.querySelector('.po-pred'), 'D2 saiu');
  afirma(await page.locator('.po-pred').count() === 0, 'confirmando, a D2 sai da tela');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();

  console.log('[' + rotulo + '] 4. registro v1: nada mudou');
  ({ ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?po=r1', true));
  await page.waitForSelector('.po-pergunta[data-q="O3"]');
  afirma(await page.locator('.po-diag, .po-pred').count() === 0, 'v1: 3 SIM não pede diagnóstico nem predominância');
  afirma(!/fluxo de valor ou capacidade em funcionamento/.test(await page.locator('.po-pergunta[data-q="O1"]').innerText()), 'v1: a redação v1 de sempre (a v2 publicada não vaza)');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch();
  try {
    for (const [vp, r] of [[DESKTOP, 'desktop'], [CELULAR, 'celular 375']]) { await admin(browser, vp, r); await telaV2(browser, vp, r); }
  } catch (e) { console.log('ERRO', e && e.stack || e); falhas++; }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
