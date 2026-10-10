/* H2-a / H3-a — a tela da governança do motor de Posicionamento. Desktop e celular 375 px; Firebase falso em
 * persistência real; hermético. A lógica pura está em teste-governanca-posicionamento.js; aqui:
 *   1. ADMIN › Motores: o cartão do Motor de Posicionamento mostra v1 em vigor e v2 inativa; a prontidão marca o que
 *      falta (redação publicada, aprovação, fronteira confiável) e diz que prontidão não é autorização; não há
 *      ação de ativar; "Simular" mostra os estados e 0 violações de Linha × Squad; "Calcular impacto" separa iguais,
 *      alterados, incomparáveis (com motivo) e violações, contra o RASCUNHO (identificado), e não grava nada.
 *   2. ADMIN › Questionários: editar o rascunho da redação v2 muda só o texto (códigos travados), salva com o vínculo
 *      do sistema e não cria versão publicada; a publicação aparece bloqueada com o motivo; outra pessoa salvando
 *      antes → recusa sem sobrescrever.
 *   3. Avaliação: a ficha, a lista e o histórico mostram "motor v1 · redação v1"; não há "Atualizar com motor atual". */
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
const REDACAO_V2_SEED = (() => {
  const c = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Set };
  c.window = c; c.firebase = { database: () => ({ ref: () => ({ on() {}, once() { return Promise.resolve({ val: () => null }); } }) }) };
  vm.createContext(c);
  ['motor-posicionamento-nucleo.js', 'questionarios-config.js', 'conteudo-inicial-posicionamento-v2.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), c));
  const seed = c.faQuestionarios.normalizarConteudoMotor('POSICIONAMENTO_ORGANIZACIONAL', c.faConteudoInicialPosicionamento[2].perguntas, 2).perguntas;
  /* rascunho "v2 com a redação da v1" (O1–O9 e D1 iguais aos da v1; D2 da carga): o caso em que há herança */
  const igual = seed.map((p) => /^DIAG_PREDOMINANCIA/.test(p.codigoEstavel) ? p : Object.assign(JSON.parse(JSON.stringify(c.faQuestionarios.conteudoPergunta('POSICIONAMENTO_ORGANIZACIONAL', p.codigoEstavel, 1))), { codigoEstavel: p.codigoEstavel, tipo: p.tipo }));
  return JSON.parse(JSON.stringify(c.faQuestionarios.normalizarConteudoMotor('POSICIONAMENTO_ORGANIZACIONAL', igual, 2).perguntas));
})();
const TEXTO_V1 = (cod) => REDACAO_V2_SEED.find((p) => p.codigoEstavel === cod).texto;
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
function concluidaReg(itemId, itemNome, respostas, diag) {
  const r = rascunho(itemId, itemNome, respostas);
  Object.keys(r.respostas).forEach((q) => { r.respostas[q].textoPerguntaNaEpoca = TEXTO_V1(q); });
  const M = require(path.join(RAIZ, 'motor-posicionamento.js'));
  const s = {}; Object.keys(respostas).forEach((q) => { s[q] = respostas[q]; });
  if (diag) r.diagnosticos = { N1: { resposta: diag, papeis: ['AREA_ESPECIALIZADA', 'COE'], textoPerguntaNaEpoca: TEXTO_V1('DIAG_CONFLITO_RECORTE'), questionnaireContentVersion: 1 } };
  const res = M.avaliar(s, diag ? { N1: diag } : {}), ra = {};
  Object.keys(res).forEach((k) => { const v = res[k]; if (v !== null && !(Array.isArray(v) && !v.length)) ra[k] = v; });
  return Object.assign(r, { status: 'concluido', revisao: 2, resultadoAutomatico: ra, concluidoPor: outra, concluidoEm: QUANDO, auditoriaConclusaoId: 'az' + itemId });
}
function semente(comRascunho) {
  const aut = {}; aut[chave(ARQ)] = { email: ARQ, tipo: 'avaliacao-arquitetura' };
  const users = {}; users[chave(ARQ)] = { name: 'Pessoa', email: ARQ, area: 'INFOR' };
  const conceitos = {}, fontes = {};
  ['AREA_ESPECIALIZADA', 'COE', 'ESTRATEGIA_CLIENTES', 'NEGOCIOS', 'PLATAFORMA_CANAIS', 'PLATAFORMA_HABILITADORA_NEGOCIOS', 'PLATAFORMA_HABILITADORA_TECNOLOGIA', 'PLATAFORMA_CORPORATIVA', 'LINHA', 'PLATAFORMA'].forEach((c, i) => {
    conceitos[c] = { nome: 'Tx ' + c, ordem: i + 1, ativo: true, situacaoDefinicao: 'registrada', camada: 'A', definicaoVigenteFonteId: 'f1' };
    fontes[c] = { f1: { texto: 'Definição de ' + c, contexto: 'PREVI', situacao: 'vigente', tipoRedacao: 'Conceito' } };
  });
  const qc = {};
  if (comRascunho) qc[QCOD] = { motores: { 2: { rascunho: { perguntas: REDACAO_V2_SEED, motorCompativel: 2, origem: 'carga-inicial', atualizadoEm: QUANDO, atualizadoPor: outra } } } };
  return {
    'fa-users': users, 'fa-admins': {}, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {},
    'fa-avaliacao-autorizados': aut, 'avaliacoes-squad': {}, 'motor-squad-config': {}, 'questionarios-config': qc,
    'motor-arquitetura-config': { versaoPublicada: 2, versoes: { 2: { regras: PADRAO_REGRAS, publicadoEm: QUANDO, publicadoPor: outra } } },
    'avaliacoes-produto': { pA: produto('pA', 'Item AE'), pB: produto('pB', 'Item Conflito'), pC: produto('pC', 'Item Rascunho') },
    'avaliacoes-posicionamento': { gA: concluidaReg('pA', 'Item AE', { O1: 'NAO', O2: 'SIM', O3: 'NAO' }), gB: concluidaReg('pB', 'Item Conflito', { O1: 'NAO', O2: 'SIM', O3: 'SIM' }, 'mesma'),
      rC: rascunho('pC', 'Item Rascunho', { O1: 'NAO' }) },
    'posicionamento-rascunho-por-item': { pC: 'rC' }, 'posicionamento-vigente-por-item': { pA: 'gA', pB: 'gB' },
    'posicionamento-decisoes': { gA: { itemId: 'pA', codigoFinal: 'AREA_ESPECIALIZADA', tipoDecisao: 'CONFIRMACAO', liberaSquad: false, decididoPor: outra, decididoEm: QUANDO } },
    'posicionamento-auditoria': {},
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


async function motores(browser, viewport, rotulo) {
  console.log('\n[' + rotulo + '] 1. ADMIN › Motores — Motor de Posicionamento');
  const { ctx, page, erros } = await abrir(browser, viewport, '#admin?arq=motores', true);
  await page.waitForSelector('#avpMotorPosicionamento');
  const antes = await banco(page);
  const card = page.locator('#avpMotorPosicionamento');
  afirma(/Em vigor/.test(await card.locator('tr[data-versao="1"]').innerText()) && /Inativa/.test(await card.locator('tr[data-versao="2"]').innerText()), 'v1 em vigor, v2 inativa');
  const ok = async (item) => card.locator('li[data-item="' + item + '"]').getAttribute('data-ok');
  afirma(await ok('DEFINICAO_VALIDA') === 'true' && await ok('REDACAO_PUBLICADA_COMPATIVEL') === 'false' && await ok('APROVACAO') === 'false' && await ok('FRONTEIRA') === 'false',
    'prontidão: definição válida; sem redação publicada, sem aprovação, sem fronteira confiável');
  afirma(/não é autorização/.test(await page.locator('#avpPosNaoAutoriza').innerText()), 'diz que prontidão não é autorização');
  afirma(await card.locator('button').evaluateAll((bs) => bs.every((b) => !/ativar|entrar em vigor|publicar/i.test(b.textContent))), 'nenhuma ação de ativar ou publicar');
  await page.click('#avpPosSimularBtn');
  await page.waitForSelector('#avpPosSimulacao');
  afirma(/664 estados/.test(await page.locator('#avpPosSimulacao').innerText()) && /0 violações de Linha × Squad/.test(await page.locator('#avpPosSimulacao').innerText()), 'simulação: 664 estados, 0 violações de Linha × Squad');
  afirma(await ok('SIMULACAO_EXECUTADA') === 'true', 'prontidão marca a simulação executada');
  await page.click('#avpPosImpactoBtn');
  await page.waitForSelector('#avpPosImpacto');
  const imp = await page.locator('#avpPosImpacto').innerText();
  const balde = async (b) => (await card.locator('li[data-balde="' + b + '"] strong').innerText()).trim();
  afirma(/RASCUNHO \(não publicado\)/.test(imp), 'impacto identifica que a redação de destino é o RASCUNHO');
  afirma(await balde('iguais') === '1' && await balde('alterados') === '0' && await balde('incomparaveis') === '1' && await balde('violacoes') === '0', 'impacto: 1 igual (AE), 1 incomparável (conflito pede D2), 0 alterados, 0 violações',
    [await balde('iguais'), await balde('alterados'), await balde('incomparaveis'), await balde('violacoes')].join('/'));
  afirma(/não contados como iguais/.test(imp) && /exige novas respostas/.test(await page.locator('#avpPosIncomparaveisMotivos').innerText()), 'incomparáveis com motivo, separados dos iguais');
  afirma(JSON.stringify(await banco(page)) === JSON.stringify(antes), 'simular e calcular impacto não gravam nada');
  afirma(await larguraOk(page), 'sem rolagem horizontal');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
}
async function redacao(browser, viewport, rotulo) {
  console.log('[' + rotulo + '] 2. ADMIN › Questionários — editar o rascunho da redação v2');
  const { ctx, page, erros } = await abrir(browser, viewport, '#admin?arq=questionarios', true);
  await page.waitForSelector('#avpConteudoMotorEditarBtn');
  afirma(/Publicação bloqueada nesta fase/.test(await page.locator('#avpConteudoMotorPublicacaoBloqueada').innerText()) && /não garantem/.test(await page.locator('#avpConteudoMotorPublicacaoBloqueada').innerText()), 'publicação bloqueada, com o motivo (regras atuais)');
  afirma(/— 0/.test(await page.locator('#avpConteudoMotorPublicadas summary').innerText()), 'histórico de versões publicadas: 0');
  afirma(await page.locator('#avpConteudoMotor2 button').evaluateAll((bs) => bs.every((b) => !/publicar/i.test(b.textContent))), 'nenhum botão de publicar');
  await page.click('#avpConteudoMotorEditarBtn');
  await page.waitForSelector('#avpConteudoMotorEdicao');
  afirma(await page.locator('#avpConteudoMotorEdicao [data-codigo-pergunta="DIAG_PREDOMINANCIA_N1"] .avp-cm-opcao').count() === 4, 'D2: só os rótulos das opções são editáveis (4 em N1)');
  afirma(await page.locator('#avpConteudoMotorEdicao input[data-campo="codigoEstavel"], #avpConteudoMotorEdicao [data-campo="tipo"]').count() === 0, 'código e tipo não têm campo');
  await page.fill('#avpConteudoMotorEdicao [data-codigo-pergunta="O1"] textarea[data-campo="texto"]', 'Texto novo de O1 para a v2?');
  await page.fill('#avpConteudoMotorEdicao [data-codigo-pergunta="DIAG_PREDOMINANCIA_N1"] .avp-cm-opcao >> nth=0', 'Rótulo novo');
  await page.click('#avpConteudoMotorSalvarBtn');
  await page.waitForSelector('#avpConteudoMotorFlash');
  const r = (await banco(page))['questionarios-config'][QCOD].motores[2];
  const o1 = r.rascunho.perguntas.find((p) => p.codigoEstavel === 'O1'), d2 = r.rascunho.perguntas.find((p) => p.codigoEstavel === 'DIAG_PREDOMINANCIA_N1');
  afirma(o1.texto === 'Texto novo de O1 para a v2?' && d2.opcoes[0].codigo === 'RESULTADO_INTEGRADO' && d2.opcoes[0].rotulo === 'Rótulo novo' && r.rascunho.perguntas.length === 13, 'salvou o texto; códigos e opções intactos');
  afirma(r.rascunho.motorCompativel === 2 && r.rascunho.origem === 'carga-inicial-editada' && !r.versoes && !r.versaoPublicada, 'vínculo do sistema mantido; nenhuma versão publicada criada');
  /* outra pessoa salva antes */
  await page.click('#avpConteudoMotorEditarBtn');
  await page.waitForSelector('#avpConteudoMotorEdicao');
  await page.evaluate((q) => firebase.database().ref('questionarios-config/' + q + '/motores/2/rascunho/atualizadoEm').set('2099-01-01T00:00:00.000Z'), QCOD);
  await page.fill('#avpConteudoMotorEdicao [data-codigo-pergunta="O2"] textarea[data-campo="texto"]', 'Minha edição');
  await page.click('#avpConteudoMotorSalvarBtn');
  await page.waitForSelector('#avpConteudoMotorErroEdicao');
  afirma(/Outra pessoa salvou/.test(await page.locator('#avpConteudoMotorErroEdicao').innerText()) &&
    (await banco(page))['questionarios-config'][QCOD].motores[2].rascunho.perguntas.find((p) => p.codigoEstavel === 'O2').texto !== 'Minha edição', 'rascunho mudou por outra pessoa → recusa, sem sobrescrever');
  afirma(await larguraOk(page), 'sem rolagem horizontal');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
}
async function versoes(browser, viewport, rotulo) {
  console.log('[' + rotulo + '] 3. Avaliação — identificação das versões');
  let { ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?po=lista', true);
  await page.waitForSelector('.po-linha');
  afirma(await page.locator('.po-linha .po-versoes-usadas').evaluateAll((t) => t.length >= 2 && t.every((x) => x.textContent.trim() === 'motor v1 · redação v1')), 'lista: coluna "Motor e redação" = motor v1 · redação v1');
  await ctx.close();
  ({ ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?po=gA', true));
  await page.waitForSelector('#poResultado');
  afirma((await page.locator('#poResultado #poVersoesUsadas').innerText()).trim() === 'motor v1 · redação v1', 'ficha: motor v1 · redação v1');
  afirma(await page.locator('#poAtualizarMotorBtn').count() === 0, 'sem "Atualizar com motor atual" (v1 em vigor: dormente)');
  afirma(await page.locator('#poReavaliarBtn').count() === 1, 'Reavaliar continua lá');
  afirma(await larguraOk(page), 'sem rolagem horizontal');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch();
  try {
    for (const [vp, r] of [[DESKTOP, 'desktop'], [CELULAR, 'celular 375']]) { await motores(browser, vp, r); await redacao(browser, vp, r); await versoes(browser, vp, r); }
  } catch (e) { console.log('ERRO', e && e.stack || e); falhas++; }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
