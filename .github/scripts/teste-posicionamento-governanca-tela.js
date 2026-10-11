/* H2-a / H3-a — a tela da governança do motor de Posicionamento. Desktop e celular 375 px; Firebase falso em
 * persistência real; hermético. A lógica pura está em teste-governanca-posicionamento.js; aqui:
 *   1. ADMIN › Motores: o cartão do Motor de Posicionamento mostra v1 em vigor e v2 inativa; a prontidão marca o que
 *      falta (redação publicada, aprovação, fronteira confiável) e diz que prontidão não é autorização; não há
 *      ação de ativar; "Simular" mostra os estados e 0 violações de Linha × Squad; "Calcular impacto" separa iguais,
 *      alterados, incomparáveis (com motivo) e violações, contra o RASCUNHO (identificado), e não grava nada.
 *   2. ADMIN › Questionários: editar o rascunho da redação v2 muda só o texto (códigos travados), salva com o vínculo
 *      do sistema e não cria versão publicada; a publicação aparece bloqueada com o motivo; outra pessoa salvando
 *      antes → recusa sem sobrescrever.
 *   3. Avaliação: a ficha, a lista e o histórico mostram "motor v1 · redação v1"; não há "Atualizar com motor atual".
 *   4. B3 — governança persistida, com três pessoas (UIDs distintos) e o mesmo banco passando de uma para outra:
 *      propor (só com redação PUBLICADA, simulação e impacto), quem propôs não aprova, aprovar exige conferir o
 *      impacto agora e reconhecê-lo, a 2ª aprovação sem admin geral não é oferecida, a 2ª de admin geral aprova e
 *      libera o índice; "Autorizada — depende da fronteira confiável (B4)"; nada entra em vigor e nenhuma avaliação
 *      muda; impacto novo → a aprovada aparece desatualizada e uma nova proposta pode ser feita; retirar com motivo;
 *      gravação recusada avisa e não grava. */
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
const ADM = 'tatianefdirene@previ.com.br';
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
  const users = {}; users[chave(ARQ)] = { name: 'Pessoa', email: ARQ, area: 'INFOR' }; users[chave(ADM)] = { name: 'Admin', email: ADM, area: 'INFOR' };
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
let seqPagina = 0;
async function abrir(browser, viewport, hash, comRedacaoV2, email, dbInicial, extraCfg) {
  email = email || ARQ;
  const cfg = Object.assign({ db: dbInicial || semente(comRedacaoV2), user: { email, emailVerified: true, uid: 'u-' + chave(email) }, uidDoUsuario: true, prefixoChave: 'k' + (++seqPagina) + 'x', delayDefault: 10, persistenciaReal: true, delays: {}, fail: [] }, extraCfg || {});
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
  afirma(/não contados como iguais nem como alterados/.test(imp) && /Incomparável não significa resultado diferente/.test(await page.locator('#avpPosIncomparavelExplica').innerText()),
    'a tela explica que incomparável não significa resultado diferente');
  afirma(JSON.stringify(await banco(page)) === JSON.stringify(antes), 'simular e calcular impacto não gravam nada');
  afirma(await larguraOk(page), 'sem rolagem horizontal');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
}
async function redacao(browser, viewport, rotulo) {
  console.log('[' + rotulo + '] 2. ADMIN › Questionários — editar o rascunho da redação v2');
  const { ctx, page, erros } = await abrir(browser, viewport, '#admin?arq=questionarios', true);
  await page.waitForSelector('#avpConteudoMotorEditarBtn');
  afirma(/— 0/.test(await page.locator('#avpConteudoMotorPublicadas summary').innerText()), 'histórico de versões publicadas: 0');
  afirma(/Publicar como versão 1/i.test(await page.locator('#avpConteudoMotorPublicarBtn').innerText()), 'B2: rascunho compatível → "Publicar como versão 1"');
  afirma(await page.locator('#avpConteudoMotorSuspensaoBtn').count() === 0, 'Avaliação + Arquitetura não vê "Suspender" (só admin geral grava)');
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
async function publicar(browser, viewport, rotulo) {
  console.log('[' + rotulo + '] 2b. B2 — publicar a redação v2 (não ativa nada)');
  const { ctx, page, erros } = await abrir(browser, viewport, '#admin?arq=questionarios', true);
  await page.waitForSelector('#avpConteudoMotorPublicarBtn');
  const antes = await banco(page);
  await page.click('#avpConteudoMotorPublicarBtn');
  await page.waitForSelector('.avp-modal-confirm-btn');
  const aviso = await page.locator('.modal-box', { hasText: 'Publicar o rascunho' }).innerText();
  afirma(/não poderá ser alterada nem apagada/.test(aviso) && /não põe o motor em vigor/.test(aviso) && /validada pela fronteira confiável/.test(aviso), 'confirmação avisa: imutável, não ativa, ainda precisa de validação');
  await page.click('.avp-modal-confirm-btn');
  await page.waitForSelector('#avpConteudoMotorFlash');
  afirma(/Versão 1 da redação v2 publicada/.test(await page.locator('#avpConteudoMotorFlash').innerText()) && /continua inativo/.test(await page.locator('#avpConteudoMotorFlash').innerText()), 'publicou a versão 1 e diz que o motor v2 continua inativo');
  const db = await banco(page), m = db['questionarios-config'][QCOD].motores[2], v1 = m.versoes && m.versoes[1];
  const auds = db['questionarios-motor-auditoria'] && db['questionarios-motor-auditoria'][QCOD] && db['questionarios-motor-auditoria'][QCOD][2];
  afirma(m.versaoPublicada === 1 && !!v1 && !m.rascunho && v1.motorCompativel === 2 && v1.publicadoPor.email === ARQ && /^[0-9a-f]{16}$/.test(v1.digestRedacao), 'versão 1 gravada (vínculo, autoria, digest), ponteiro 1, rascunho removido');
  afirma(!!auds && auds[v1.auditoriaId] && auds[v1.auditoriaId].tipo === 'publicacao' && auds[v1.auditoriaId].versao === 1, 'auditoria da publicação na mesma gravação');
  afirma(!('validadaParaAtivacao' in v1) && !('validacao' in v1), 'a publicação não marca a redação como validada');
  afirma(JSON.stringify(db['avaliacoes-posicionamento']) === JSON.stringify(antes['avaliacoes-posicionamento']) && JSON.stringify(db['questionarios-config'][QCOD].versaoPublicada) === JSON.stringify(antes['questionarios-config'][QCOD].versaoPublicada),
    'nenhuma avaliação mudou; a redação v1 em uso não mudou');
  await page.click('#avpConteudoMotorPublicadas summary');
  afirma(/Versão 1/.test(await page.locator('#avpConteudoMotorPublicadas').innerText()) && /Validada para ativação: não/.test(await page.locator('#avpConteudoMotorPublicadas').innerText()), 'histórico: versão 1, "Validada para ativação: não"');
  afirma(await page.locator('#avpConteudoMotorPublicarBtn').count() === 0, 'sem rascunho, não há o que publicar');
  await page.evaluate(() => { window.__detAntigo = document.getElementById('avpConteudoMotorPublicadas'); location.hash = '#admin?arq=motores'; });
  await page.waitForSelector('#avpMotorPosicionamento');
  /* "toggle" é uma tarefa à parte: na máquina lenta chega depois que a tela já trocou (CI, 375 px) */
  await page.evaluate(() => { window.__detAntigo.dispatchEvent(new Event('toggle')); });
  const card = page.locator('#avpMotorPosicionamento');
  afirma(/Inativa/.test(await card.locator('tr[data-versao="2"]').innerText()) && /Em vigor/.test(await card.locator('tr[data-versao="1"]').innerText()), 'depois de publicar: v1 continua em vigor, v2 inativa');
  afirma(await card.locator('li[data-item="REDACAO_PUBLICADA_COMPATIVEL"]').getAttribute('data-ok') === 'true' && await card.locator('li[data-item="REDACAO_VALIDADA_FRONTEIRA"]').getAttribute('data-ok') === 'false',
    'prontidão: redação publicada ✓, mas validada pela fronteira confiável ✗');
  afirma(await page.evaluate(() => window.faMotorPosicionamentoNucleo.versaoEmVigor()) === 1, 'versão em vigor do motor: 1');
  afirma(await larguraOk(page), 'sem rolagem horizontal');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
}
async function suspensao(browser, viewport, rotulo) {
  console.log('[' + rotulo + '] 2c. B2 — admin geral suspende e retoma novas publicações');
  const { ctx, page, erros } = await abrir(browser, viewport, '#admin?arq=questionarios', true, ADM);
  await page.waitForSelector('#avpConteudoMotorSuspensaoBtn');
  page.once('dialog', (d) => d.accept('Revisar a redação antes de publicar'));
  await page.click('#avpConteudoMotorSuspensaoBtn');
  await page.waitForSelector('#avpConteudoMotorSuspensa');
  const db = await banco(page), sp = db['questionarios-config'][QCOD].motores[2].publicacaoSuspensa;
  afirma(sp && sp.ativa === true && sp.motivo === 'Revisar a redação antes de publicar' && sp.por.email === ADM, 'suspensão gravada com motivo e autoria');
  afirma(/Novas publicações suspensas/.test(await page.locator('#avpConteudoMotorSuspensa').innerText()) && /continuam protegidas/.test(await page.locator('#avpConteudoMotorSuspensa').innerText()), 'a tela mostra a suspensão e que o histórico continua protegido');
  afirma(await page.locator('#avpConteudoMotorPublicarBtn').count() === 0, 'suspensa: sem botão de publicar');
  page.once('dialog', (d) => d.accept('Revisão concluída'));
  await page.click('#avpConteudoMotorSuspensaoBtn');
  await page.waitForSelector('#avpConteudoMotorPublicarBtn');
  const db2 = await banco(page);
  afirma(db2['questionarios-config'][QCOD].motores[2].publicacaoSuspensa.ativa === false, 'retomada gravada (a suspensão não é apagada)');
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
/* ---------- 4. B3: governança persistida ---------- */
let dbAprovado = null, pidAprovado = null;
const clone = (v) => JSON.parse(JSON.stringify(v));
const ARQ2 = 'arq2@previ.com.br', ARQ3 = 'arq3@previ.com.br';
const G = require(path.join(RAIZ, 'governanca-posicionamento.js'));
function sementeB3() {
  const db = semente(false);
  [ARQ2, ARQ3].forEach((e) => { db['fa-avaliacao-autorizados'][chave(e)] = { email: e, tipo: 'avaliacao-arquitetura' }; db['fa-users'][chave(e)] = { name: e, email: e, area: 'INFOR' }; });
  db['questionarios-config'][QCOD] = { motores: { 2: { versaoPublicada: 1, versoes: { 1: { perguntas: REDACAO_V2_SEED, motorCompativel: 2, publicadoEm: 1, publicadoPor: { uid: 'u-x', email: outra.email }, auditoriaId: 'q1', digestRedacao: G.digestRedacao(REDACAO_V2_SEED) } } } } };
  return db;
}
async function calcularImpacto(page) {
  await page.click('#avpPosSimularBtn');
  await page.waitForSelector('#avpPosSimulacao');
  await page.click('#avpPosImpactoBtn');
  await page.waitForSelector('#avpPosImpacto');
}
async function abrirMotores(browser, viewport, email, db, extra) {
  const r = await abrir(browser, viewport, '#admin?arq=motores', false, email, db, extra);
  await r.page.waitForSelector('#avpPosGovernanca #avpPosVigenciaRegistrada');
  return r;
}
const textoDe = (page, sel) => page.locator(sel).innerText();
async function governanca(browser, viewport, rotulo) {
  console.log('[' + rotulo + '] 4. B3 — proposta, aprovação dupla e retirada');
  /* 4a. propor (Avaliação + Arquitetura) */
  let { ctx, page, erros } = await abrirMotores(browser, viewport, ARQ, sementeB3());
  const antes = await banco(page);
  afirma(/v1/.test(await textoDe(page, '#avpPosVigenciaRegistrada')) && /nenhum registro/.test(await textoDe(page, '#avpPosVigenciaRegistrada')), 'versão em vigor registrada no banco: nenhum registro = v1');
  afirma(/simulação executada/.test(await textoDe(page, '#avpPosNaoPropoe')) && /impacto calculado/.test(await textoDe(page, '#avpPosNaoPropoe')) && await page.locator('#avpPosProporBtn').count() === 0,
    'sem simulação e impacto não há como propor (a tela diz o que falta)');
  await calcularImpacto(page);
  await page.waitForSelector('#avpPosProporBtn');
  afirma(/redação publicada v1/.test(await textoDe(page, '#avpPosProporForm')) && /ao menos uma de admin geral/.test(await textoDe(page, '#avpPosProporForm')) && /não põe nada em vigor/.test(await textoDe(page, '#avpPosProporForm')),
    'formulário de proposta: vínculo com a redação publicada, regra da aprovação dupla, nada entra em vigor');
  await page.click('#avpPosProporBtn');
  await page.waitForSelector('#avpPosGovFlash');
  afirma(/Informe a justificativa/.test(await textoDe(page, '#avpPosGovFlash')), 'justificativa obrigatória');
  await page.fill('#avpPosJustificativa', 'Redação v2 revisada pela área');
  await page.click('#avpPosProporBtn');
  await page.waitForSelector('#avpPosPropostaAberta');
  let db = await banco(page);
  const props = db['posicionamento-motor-propostas'] || {}, pid = Object.keys(props)[0], P = props[pid];
  afirma(Object.keys(props).length === 1 && P.situacao === 'aberta' && P.versaoMotor === 2 && P.propostoPor.uid === 'u-' + chave(ARQ) && P.propostoPor.email === ARQ && P.justificativa === 'Redação v2 revisada pela área',
    'proposta gravada: aberta, motor v2, autoria pelo UID e e-mail da sessão');
  afirma(P.alvo.versaoRedacao === 1 && P.alvo.digestRedacao === G.digestRedacao(REDACAO_V2_SEED) && P.alvo.impacto.violacoes === 0 && P.alvo.impacto.iguais + P.alvo.impacto.alterados + P.alvo.impacto.incomparaveis === P.alvo.impacto.total,
    'alvo = redação publicada v1 (digest), impacto coerente e sem violação');
  afirma(db['posicionamento-motor-proposta-aberta'][2] === pid && db['posicionamento-motor-governanca-auditoria'][P.auditoriaId].tipo === 'proposta', 'índice de proposta aberta e auditoria na mesma gravação');
  afirma(/Quem propôs não aprova/.test(await textoDe(page, '#avpPosNaoAprova')) && await page.locator('#avpPosAprovarBtn').count() === 0 && await page.locator('#avpPosRetirarBtn').count() === 1,
    'quem propôs não vê "Aprovar" (vê "Retirar")');
  afirma(!/\bativar\b/i.test(await textoDe(page, '#avpMotorPosicionamento')) || await page.locator('#avpMotorPosicionamento button', { hasText: /ativar/i }).count() === 0, 'nenhuma ação de ativar');
  afirma(await larguraOk(page), 'sem rolagem horizontal');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
  /* 4b. 1ª aprovação (outra pessoa, Avaliação + Arquitetura) */
  ({ ctx, page, erros } = await abrirMotores(browser, viewport, ARQ2, db));
  await page.waitForSelector('#avpPosPropostaAberta');
  afirma(/Calcule o impacto/.test(await textoDe(page, '#avpPosNaoAprova')) && await page.locator('#avpPosAprovarBtn').count() === 0, 'sem conferir o impacto agora não há como aprovar');
  await calcularImpacto(page);
  await page.waitForSelector('#avpPosAprovarBtn');
  await page.click('#avpPosAprovarBtn');
  await page.waitForSelector('#avpPosGovFlash');
  afirma(/Marque o reconhecimento/.test(await textoDe(page, '#avpPosGovFlash')), 'aprovar exige marcar o reconhecimento do impacto');
  afirma(/resultado\(s\) mudariam/.test(await textoDe(page, '.avp-pos-reconheco')) && /não podem ser comparados/.test(await textoDe(page, '.avp-pos-reconheco')), 'o reconhecimento diz os números de alterados e incomparáveis');
  await page.check('#avpPosReconheco');
  await page.click('#avpPosAprovarBtn');
  await esperarCondicao(page, () => /Primeira aprovação registrada/.test((document.getElementById('avpPosGovFlash') || {}).textContent || ''), undefined, { limite: 8000 });
  db = await banco(page);
  let A1 = db['posicionamento-motor-propostas'][pid].aprovacoes.a1;
  afirma(A1.uid === 'u-' + chave(ARQ2) && A1.adminGeral === false && db['posicionamento-motor-propostas'][pid].situacao === 'aberta' && db['posicionamento-motor-proposta-aberta'][2] === pid,
    '1ª aprovação gravada (UID, não admin geral); continua aberta');
  afirma(/Você já aprovou/.test(await textoDe(page, '#avpPosNaoAprova')), 'a mesma pessoa não aprova duas vezes');
  afirma(await larguraOk(page), 'sem rolagem horizontal');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
  /* 4c. terceira pessoa sem admin geral: a 2ª aprovação não é oferecida */
  ({ ctx, page, erros } = await abrirMotores(browser, viewport, ARQ3, db));
  await calcularImpacto(page);
  await page.waitForSelector('#avpPosNaoAprova');
  afirma(/precisa ser de um admin geral/.test(await textoDe(page, '#avpPosNaoAprova')) && await page.locator('#avpPosAprovarBtn').count() === 0 && await page.locator('#avpPosRetirarBtn').count() === 0,
    'nenhum dos dois admin geral: a 2ª aprovação não é oferecida (nem retirar, a quem não propôs)');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
  /* 4d. 2ª aprovação: admin geral */
  ({ ctx, page, erros } = await abrirMotores(browser, viewport, ADM, db));
  await calcularImpacto(page);
  await page.waitForSelector('#avpPosAprovarBtn');
  await page.check('#avpPosReconheco');
  await page.click('#avpPosAprovarBtn');
  await esperarCondicao(page, () => /Segunda aprovação registrada/.test((document.getElementById('avpPosGovFlash') || {}).textContent || ''), undefined, { limite: 8000 });
  db = await banco(page);
  const Pd = db['posicionamento-motor-propostas'][pid];
  afirma(Pd.situacao === 'aprovada' && Pd.aprovacoes.a2.uid === 'u-' + chave(ADM) && Pd.aprovacoes.a2.adminGeral === true && !(db['posicionamento-motor-proposta-aberta'] || {})[2],
    '2ª aprovação (admin geral): aprovada e índice liberado');
  afirma(!db['posicionamento-motor-vigencia'] && JSON.stringify(db['avaliacoes-posicionamento']) === JSON.stringify(antes['avaliacoes-posicionamento']) && JSON.stringify(db['posicionamento-decisoes']) === JSON.stringify(antes['posicionamento-decisoes']),
    'nada entrou em vigor e nenhuma avaliação ou decisão mudou');
  await page.click('#avpPosPropostasHistorico summary');
  afirma(/Autorizada — a entrada em vigor depende da fronteira confiável \(B4\)/.test(await textoDe(page, '#avpPosPropostasHistorico')) && /continua em vigor/.test(await textoDe(page, '#avpPosPropostasHistorico')),
    'a aprovada diz "Autorizada — depende da fronteira confiável (B4)" e que nada mudou');
  afirma(await page.locator('li[data-item="APROVACAO"]').getAttribute('data-ok') === 'true' && await page.locator('li[data-item="FRONTEIRA"]').getAttribute('data-ok') === 'false', 'prontidão: aprovação dupla ✓, fronteira confiável ✗');
  afirma(await page.evaluate(() => window.faMotorPosicionamentoNucleo.versaoEmVigor()) === 1 && /Inativa/.test(await textoDe(page, '#avpMotorPosicionamento tr[data-versao="2"]')), 'v1 continua em vigor e v2 inativa');
  afirma(await page.locator('#avpPosProporBtn').count() === 1, 'com o índice livre, uma nova proposta pode ser feita');
  dbAprovado = clone(db); pidAprovado = pid;
  afirma(await larguraOk(page), 'sem rolagem horizontal');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
  /* 4e. impacto novo → a aprovada fica desatualizada; nova proposta e retirada */
  db['avaliacoes-produto'].pD = produto('pD', 'Item Novo');
  db['avaliacoes-posicionamento'].gD = concluidaReg('pD', 'Item Novo', { O1: 'SIM', O2: 'NAO', O3: 'NAO' });
  db['posicionamento-vigente-por-item'].pD = 'gD';
  ({ ctx, page, erros } = await abrirMotores(browser, viewport, ARQ, db));
  await calcularImpacto(page);
  await page.waitForSelector('#avpPosProporBtn');
  await page.click('#avpPosPropostasHistorico summary');
  afirma(await page.locator('.avp-pos-proposta[data-proposta="' + pid + '"]').getAttribute('data-desatualizada') === 'true' && /desatualizada/.test(await textoDe(page, '.avp-pos-proposta[data-proposta="' + pid + '"]')),
    'impacto mudou: a proposta aprovada aparece desatualizada (nada gravado)');
  afirma(await page.locator('li[data-item="APROVACAO"]').getAttribute('data-ok') === 'false', 'prontidão: a aprovação desatualizada não conta');
  await page.fill('#avpPosJustificativa', 'Nova proposta com o impacto atual');
  await page.click('#avpPosProporBtn');
  await page.waitForSelector('#avpPosRetirarBtn');
  page.once('dialog', (d) => d.accept('Revisar a redação antes'));
  await page.click('#avpPosRetirarBtn');
  await esperarCondicao(page, () => /Proposta retirada/.test((document.getElementById('avpPosGovFlash') || {}).textContent || ''), undefined, { limite: 8000 });
  db = await banco(page);
  const pids = Object.keys(db['posicionamento-motor-propostas']), pr2 = pids.find((x) => x !== pid), P2 = db['posicionamento-motor-propostas'][pr2];
  afirma(pids.length === 2 && P2.situacao === 'retirada' && P2.retirada.motivo === 'Revisar a redação antes' && P2.retirada.por.uid === 'u-' + chave(ARQ) && !(db['posicionamento-motor-proposta-aberta'] || {})[2] &&
    db['posicionamento-motor-governanca-auditoria'][P2.retirada.auditoriaId].tipo === 'retirada', 'retirada com motivo, autoria, auditoria e índice liberado', JSON.stringify({ n: pids.length, P2, idx: db['posicionamento-motor-proposta-aberta'] }));
  await esperarCondicao(page, () => /2 propostas/i.test((document.querySelector('#avpPosPropostasHistorico summary') || {}).textContent || ''), undefined, { limite: 8000 }).catch(() => {});
  afirma(/Histórico — 2 propostas/i.test(await textoDe(page, '#avpPosPropostasHistorico summary')), 'histórico: 2 propostas (nada apagado)', await textoDe(page, '#avpPosPropostasHistorico summary'));
  afirma(await larguraOk(page), 'sem rolagem horizontal');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
  /* 4f. gravação recusada pelo banco */
  ({ ctx, page, erros } = await abrirMotores(browser, viewport, ARQ, sementeB3(), { fail: ['posicionamento-motor-governanca-auditoria'] }));
  await calcularImpacto(page);
  await page.waitForSelector('#avpPosProporBtn');
  await page.fill('#avpPosJustificativa', 'x');
  await page.click('#avpPosProporBtn');
  await esperarCondicao(page, () => /recusou/.test((document.getElementById('avpPosGovFlash') || {}).textContent || ''), undefined, { limite: 8000 });
  db = await banco(page);
  afirma(!db['posicionamento-motor-propostas'] && !db['posicionamento-motor-governanca-auditoria'] && await page.locator('#avpPosProporBtn').count() === 1, 'gravação recusada: avisa, nada gravado, pode tentar de novo');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
}
/* ---------- 5. B4: fronteira confiável (as funções são falsas: CFG.funcoes) ---------- */
async function fronteiraTela(browser, viewport, rotulo) {
  console.log('[' + rotulo + '] 5. B4 — validar redação e conferir entrada em vigor no servidor');
  let { ctx, page, erros } = await abrirMotores(browser, viewport, ADM, clone(dbAprovado));
  const antes = await banco(page);
  await page.waitForSelector('#avpPosValidarRedacaoBtn');
  afirma(await page.locator('li[data-item="REDACAO_VALIDADA_FRONTEIRA"]').getAttribute('data-ok') === 'false', 'prontidão: redação ainda não validada pela fronteira');
  await page.click('#avpPosValidarRedacaoBtn');
  await esperarCondicao(page, () => /indisponível/.test((document.getElementById('avpPosFronteiraFlash') || {}).textContent || ''), undefined, { limite: 8000 });
  afirma(/Nada foi validado/.test(await textoDe(page, '#avpPosFronteiraFlash')) && await page.locator('#avpPosRedacaoValidada').count() === 0, 'funções não implantadas: "Fronteira confiável indisponível", nada validado');
  await page.evaluate(() => { window.__CFG.funcoes = { validarRedacaoPublicada: { resultado: { valida: false, motivos: ['REDACAO_ADULTERADA'] } } }; });
  await page.click('#avpPosValidarRedacaoBtn');
  await esperarCondicao(page, () => /recusou a redação/.test((document.getElementById('avpPosFronteiraFlash') || {}).textContent || ''), undefined, { limite: 8000 });
  afirma(/não confere com o seu identificador/.test(await textoDe(page, '#avpPosFronteiraFlash')), 'redação recusada pelo servidor: o motivo por extenso');
  await page.evaluate(() => { window.__CFG.funcoes = { validarRedacaoPublicada: { resultado: { valida: true, motivos: [] } } }; });
  await page.click('#avpPosValidarRedacaoBtn');
  await esperarCondicao(page, () => /Redação validada/.test((document.getElementById('avpPosFronteiraFlash') || {}).textContent || ''), undefined, { limite: 8000 });
  const ch = await page.evaluate(() => window.__CFG.__chamadas);
  afirma(ch.length === 3 && ch.every((c) => c.nome === 'validarRedacaoPublicada' && c.dados.versaoMotor === 2 && c.dados.versaoRedacao === 1), 'a tela pede ao servidor validar a redação publicada v1 do motor v2 (só identifica a versão)');
  afirma(!(await banco(page))['posicionamento-motor-redacao-validada'], 'a tela não grava a validação: quem grava é o servidor');
  /* o que o servidor gravaria (Admin SDK) — a tela só lê */
  await page.evaluate((dig) => window.firebase.database().ref('posicionamento-motor-redacao-validada/2/1').set({ digestRedacao: dig, validadoEm: 1760000000000, solicitadoPor: { uid: 'u', email: 'tatianefdirene@previ.com.br' }, auditoriaId: 'a' }),
    G.digestRedacao(REDACAO_V2_SEED));
  await page.waitForSelector('#avpPosRedacaoValidada');
  afirma(await page.locator('li[data-item="REDACAO_VALIDADA_FRONTEIRA"]').getAttribute('data-ok') === 'true' && await page.locator('#avpPosValidarRedacaoBtn').count() === 0,
    'validação registrada pelo servidor: prontidão ✓ e o botão some');
  /* conferir (só admin geral, na proposta aprovada) */
  await page.click('#avpPosPropostasHistorico summary');
  const conf = page.locator('.avp-pos-conferir-btn[data-proposta="' + pidAprovado + '"]');
  afirma(await conf.count() === 1, 'admin geral vê "Conferir entrada em vigor no servidor" na proposta aprovada');
  await page.evaluate(() => { window.__CFG.funcoes = { conferirEntradaEmVigor: { resultado: { apta: false, motivos: ['IMPACTO_DESATUALIZADO', 'PRONTIDAO_SIMULACAO_EXECUTADA'], ativacaoHabilitada: false } } }; });
  await conf.click();
  await page.waitForSelector('.avp-pos-conferencia[data-apta="false"]');
  const naoApta = await textoDe(page, '.avp-pos-conferencia');
  afirma(/não apta/.test(naoApta) && /o impacto nas avaliações mudou depois da aprovação/.test(naoApta) && /prontidão: simulação contra a versão em vigor executada/i.test(naoApta), 'não apta: os motivos por extenso');
  await page.evaluate(() => { window.__CFG.funcoes = { conferirEntradaEmVigor: { resultado: { apta: true, motivos: [], ativacaoHabilitada: false } } }; });
  await page.locator('.avp-pos-conferir-btn[data-proposta="' + pidAprovado + '"]').click();
  await page.waitForSelector('.avp-pos-conferencia[data-apta="true"]');
  afirma(/apta para entrar em vigor/.test(await textoDe(page, '.avp-pos-conferencia')) && /A ativação está desabilitada nesta fase \(H3-b\): nada mudou/.test(await textoDe(page, '.avp-pos-conferencia')),
    'apta: diz que a ativação está desabilitada nesta fase e que nada mudou');
  const ch2 = (await page.evaluate(() => window.__CFG.__chamadas)).filter((c) => c.nome === 'conferirEntradaEmVigor');
  afirma(ch2.length === 2 && ch2.every((c) => c.dados.propostaId === pidAprovado && Object.keys(c.dados).length === 1), 'a conferência envia só a proposta (o servidor recalcula o resto)');
  await page.evaluate(() => { window.__CFG.funcoes = { conferirEntradaEmVigor: { erro: 'permission-denied' } }; });
  await page.locator('.avp-pos-conferir-btn[data-proposta="' + pidAprovado + '"]').click();
  await esperarCondicao(page, () => /Sem permissão/.test((document.getElementById('avpPosFronteiraFlash') || {}).textContent || ''), undefined, { limite: 8000 });
  afirma(true, 'recusa do servidor: "Sem permissão…"');
  const depois = await banco(page);
  delete depois['posicionamento-motor-redacao-validada'];
  afirma(JSON.stringify(depois) === JSON.stringify(antes), 'nada no banco mudou pela tela (avaliações, propostas, vigência)');
  afirma(await page.locator('#avpMotorPosicionamento button', { hasText: /ativar/i }).count() === 0 && await page.evaluate(() => window.faMotorPosicionamentoNucleo.versaoEmVigor()) === 1, 'nenhum botão de ativar; v1 em vigor');
  afirma(await larguraOk(page), 'sem rolagem horizontal');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
  /* Avaliação + Arquitetura: valida, mas não confere (só admin geral) */
  ({ ctx, page, erros } = await abrirMotores(browser, viewport, ARQ, clone(dbAprovado)));
  await page.waitForSelector('#avpPosValidarRedacaoBtn');
  await page.click('#avpPosPropostasHistorico summary');
  afirma(await page.locator('.avp-pos-conferir-btn').count() === 0, 'Avaliação + Arquitetura vê "Validar", mas não "Conferir" (só admin geral)');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
  /* Questionários: o histórico diz que a versão publicada foi validada */
  const dbV = clone(dbAprovado);
  dbV['posicionamento-motor-redacao-validada'] = { 2: { 1: { digestRedacao: G.digestRedacao(REDACAO_V2_SEED), validadoEm: 1760000000000, solicitadoPor: { uid: 'u', email: ADM }, auditoriaId: 'a' } } };
  ({ ctx, page, erros } = await abrir(browser, viewport, '#admin?arq=questionarios', false, ADM, dbV));
  await page.waitForSelector('#avpConteudoMotorPublicadas');
  await page.click('#avpConteudoMotorPublicadas summary');
  await esperarCondicao(page, () => /Validada para ativação: sim/.test((document.getElementById('avpConteudoMotorPublicadas') || {}).textContent || ''), undefined, { limite: 8000 }).catch(() => {});
  afirma(/Validada para ativação: sim — pela fronteira confiável/.test(await textoDe(page, '#avpConteudoMotorPublicadas')), 'Questionários: "Validada para ativação: sim — pela fronteira confiável"');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch();
  try {
    for (const [vp, r] of [[DESKTOP, 'desktop'], [CELULAR, 'celular 375']]) { await motores(browser, vp, r); await redacao(browser, vp, r); await publicar(browser, vp, r); await suspensao(browser, vp, r); await versoes(browser, vp, r); await governanca(browser, vp, r); await fronteiraTela(browser, vp, r); }
  } catch (e) { console.log('ERRO', e && e.stack || e); falhas++; }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
