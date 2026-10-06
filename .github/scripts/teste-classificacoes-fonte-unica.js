/* CLASSIFICAÇÕES DA AVALIAÇÃO — a Taxonomia Arquitetural é a fonte ÚNICA do NOME e da DEFINIÇÃO.
 *
 * O que prova (banco falso em persistenciaReal, sem rede, sem segredo; desktop e 375 px; tudo pelo
 * CÓDIGO da classificação — nunca se acha uma classificação pelo nome):
 *   1. RENOMEADA: com produto-principal chamado "Produto ou Serviço (novo)" na Taxonomia, a lista, o
 *      filtro, a ficha/resultado, o histórico de versões, o PDF e o Excel mostram o nome NOVO; a
 *      avaliação antiga (gravada como "Produto/Serviço principal") mostra o nome atual e, ao lado,
 *      "na conclusão: Produto/Serviço principal"; nada antigo é reescrito.
 *   2. DEFINIÇÃO = a fonte APONTADA por definicaoVigenteFonteId: com a fonte B também marcada
 *      'vigente' (e gravada ANTES da A), a tela mostra a A; trocar o ponteiro ao vivo passa para a B.
 *   3. AO VIVO: renomear o conceito muda a tela sem recarregar (lista, ficha, Squad).
 *   4. CONCLUIR AGORA grava o código + o nome resolvido; a frase explicativa usa o nome da Taxonomia.
 *   5. SQUAD: o contexto arquitetural mostra o nome atual e troca no lugar.
 *   6. TAXONOMIA LENTA (responde depois do limite), QUE NUNCA RESPONDE e RECUSADA: rótulo de contingência
 *      + aviso discreto; concluir continua funcionando, com resultado, camadaSugerida.id, decisão,
 *      respostas e versões IGUAIS às de uma conclusão com a Taxonomia disponível (comparação dos
 *      registros gravados no banco).
 *   7. MOTOR: "Editar textos" do motor arquitetural não existe mais; o histórico antigo continua legível.
 *   8. TAXONOMIA: "Conceitos-base da Avaliação" lista os 11 códigos do motor, acusa o que não tem
 *      conceito e abre o conceito ao clicar.
 *
 * Provas inversas (fora da suíte; cada uma tem de FAZER O TESTE FALHAR):
 *   FA_PROVA_INVERSA=fabrica            resolvedor sempre devolve o rótulo de fábrica
 *   FA_PROVA_INVERSA=qualquer-vigente   definição = primeira fonte com situacao 'vigente'
 *   FA_PROVA_INVERSA=contingencia-muda  em contingência, o cálculo grava outra camada */
const { chromium } = require('playwright');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { arquivoTemporario } = require('./arquivo-temporario');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const SHOTS = process.env.FA_SHOTS_DIR || null;
const INVERSA = process.env.FA_PROVA_INVERSA || '';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const SRC_CLS = fs.readFileSync(path.join(RAIZ, 'classificacoes.js'), 'utf8');
const SRC_AVP = fs.readFileSync(path.join(RAIZ, 'avaliacao-produto.js'), 'utf8');
const MOTOR_VERSION = /var MOTOR_VERSION = '([^']+)'/.exec(SRC_AVP)[1];
const XLSX = require(path.join(RAIZ, 'xlsx.mini.min.js'));
const EMAIL = 'teste@previ.com.br';
const KEY = EMAIL.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

const ORDEM = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao',
  'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
const respostasDe = (m) => { const r = {}; ORDEM.forEach((id, i) => { r[id] = { valor: (m >> i) & 1 ? 'sim' : 'nao' }; }); return r; };

/* O motor REAL (regras de fábrica, as mesmas do navegador sem motor-arquitetura-config) acha respostas que dão
   Produto/Serviço principal — pelo CÓDIGO. Sem classificacoes.js: o cálculo não depende da Taxonomia. */
function carregarCodigo() {
  const ctx = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, setTimeout, clearTimeout, setInterval, clearInterval, parseFloat, parseInt, isNaN };
  ctx.window = ctx; ctx.window.window = ctx;
  const el = () => ({ addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, style: {}, classList: { add() {}, remove() {}, contains() { return false; } } });
  ctx.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: el(), documentElement: el() };
  ctx.firebase = { database: () => ({ ref: () => ({ on() {}, once() {}, update() {}, child() { return this; }, push() { return { key: 'k' }; } }) }) };
  ctx.navigator = {}; ctx.location = { hash: '' }; ctx.localStorage = { getItem() { return null; }, setItem() {} };
  vm.createContext(ctx);
  for (const f of ['questionarios-config.js', 'motor-arquitetura.js']) vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), ctx, { filename: f });
  const fim = SRC_AVP.lastIndexOf('})();');
  vm.runInContext(SRC_AVP.slice(0, fim) + '\nwindow.__avpTeste = { computeResultado: computeResultado };\n' + SRC_AVP.slice(fim), ctx, { filename: 'avaliacao-produto.js' });
  return ctx.__avpTeste;
}
const av = carregarCodigo();
let MASCARA_PP = -1;
for (let m = 0; m < 65536 && MASCARA_PP < 0; m++) {
  const c = av.computeResultado({ respostas: respostasDe(m) }).camadaSugerida;
  if (c.id === 'produto-principal' && !c.incoerencia) MASCARA_PP = m;
}

/* Taxonomia semeada com os 11 códigos do motor — menos documento-informacao (código sem conceito). */
const CODIGOS = ['produto-principal', 'unidade-valor-associada', 'modalidade-subproduto', 'funcionalidade-operacao', 'componente',
  'regra-condicao', 'processo-etapa', 'capacidade-organizacional', 'canal', 'documento-informacao', 'a-validar'];
const SEM_CONCEITO = 'documento-informacao';
const NOVO_PP = 'Produto ou Serviço (novo)';
const NOVO_CANAL = 'Canal de relacionamento (Taxonomia)';
const ANTIGO_PP = 'Produto/Serviço principal';
const DEF_A = 'Definição A: solução com identidade, fronteira e resultado próprios (fonte apontada).';
const DEF_B = 'Definição B: outra fonte também marcada vigente, mas NÃO apontada.';
function taxonomiaSemeada() {
  const conceitos = {}, fontes = {};
  CODIGOS.forEach((c, i) => {
    if (c === SEM_CONCEITO) return;
    const nome = c === 'produto-principal' ? NOVO_PP : c === 'canal' ? NOVO_CANAL : 'Tx ' + c;
    conceitos[c] = { nome, ordem: i + 1, ativo: true, situacaoDefinicao: 'registrada', definicaoVigenteFonteId: 'fA', observacoes: 'obs', criterios: { k1: { texto: 'crit', ordem: 1 } } };
    /* fB gravada ANTES de fA e também 'vigente': quem escolhesse "a fonte vigente" pegaria a B */
    fontes[c] = {
      fB: { texto: c === 'produto-principal' ? DEF_B : 'B de ' + c, contexto: 'PREVI', situacao: 'vigente', tipoRedacao: 'Conceito' },
      fA: { texto: c === 'produto-principal' ? DEF_A : 'Definição de ' + c, contexto: 'PREVI', situacao: 'vigente', tipoRedacao: 'Conceito' }
    };
  });
  return { arquitetural: { conceitos, fontes }, meta: { cargaInicial: { em: '2026-10-01T10:00:00.000Z', por: EMAIL } } };
}

function itemConcluido(nome, camada, extra) {
  const respostas = {};
  ORDEM.forEach((id, i) => { respostas[id] = { valor: (MASCARA_PP >> i) & 1 ? 'sim' : 'nao', observacao: '', justificativaAuto: 'auto', codigoPergunta: 'P' + (i + 1), questionnaireContentVersion: 1 }; });
  return Object.assign({
    itemId: 'velha', nome, descricao: '', respostas, status: 'concluido',
    resultadoAutomatico: camada.id === 'produto-principal' ? 'produto' : 'nao-produto', decisaoFinal: camada.id === 'produto-principal' ? 'produto' : 'nao-produto', decisaoManual: false,
    camadaSugerida: Object.assign({ motivos: ['m'] }, camada), justificativaAutomatica: 'O item foi classificado como ' + camada.label + ' porque (texto gravado na época).',
    criteriosEssenciaisFalhos: [], exclusoesConflitantes: null, criteriosAtendidos: 5,
    motorVersion: MOTOR_VERSION, motorVersionArquitetura: 1, questionnaireContentVersion: 1,
    criadoEm: '2026-09-20T10:00:00.000Z', atualizadoEm: '2026-09-20T10:00:00.000Z',
    responsavel: { name: 'Teste', email: EMAIL }, versao: 1, versaoAnteriorKey: null, excluido: false
  }, extra || {});
}

/* Adequação à Squad concluída do item antigo (contexto arquitetural = velha2). */
function squadConcluida() {
  const respostas = {};
  ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'].forEach((c) => { respostas[c] = { codigoPergunta: c, textoPerguntaNaEpoca: 'Pergunta ' + c, resposta: 'sim', justificativaUsuario: 'ok ' + c, questionnaireContentVersion: 1 }; });
  return { itemNome: 'Item antigo', itemId: 'velha', avaliacaoArquiteturalId: 'velha2', status: 'concluido', respostas, questionnaireContentVersion: 1, motorSquadVersion: 1,
    necessidadeCapacidadeDedicada: 'DEMONSTRADA', condicoesParaSquad: 'PRESENTES', indicacaoOrganizacional: 'FORTE_ADERENCIA_SQUAD_DEDICADA',
    evidenciasFavoraveis: ['S1'], pontosADesenvolver: [], criadoPor: { name: 'Teste', email: EMAIL },
    criadoEm: '2026-09-26T10:00:00.000Z', atualizadoEm: '2026-09-26T10:00:00.000Z', dataConclusao: '2026-09-26T11:00:00.000Z', excluido: false };
}
function servirMutado(page, arquivo, src, de, para) {
  const mutado = src.replace(de, para);
  if (mutado === src) throw new Error('prova inversa não aplicada em ' + arquivo);
  return page.route('**/forca-agil/' + arquivo, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: mutado }));
}

async function abrir(browser, viewport, opts) {
  const admins = {}; admins[KEY] = { email: EMAIL };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-espera': {},
    'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {}, eventos: {}, 'turmas-publico': {}, 'eventos-publico': {},
    'avaliacoes-produto': {
      velha: itemConcluido('Item antigo', { id: 'produto-principal', label: ANTIGO_PP }),
      velha2: itemConcluido('Item antigo', { id: 'produto-principal', label: ANTIGO_PP }, { versao: 2, versaoAnteriorKey: 'velha', criadoEm: '2026-09-25T10:00:00.000Z', atualizadoEm: '2026-09-25T10:00:00.000Z', decisaoConfirmada: true }),
      canal1: itemConcluido('Item canal', { id: 'canal', label: 'Canal' }, { itemId: 'canal1', resultadoAutomatico: 'nao-produto', decisaoFinal: 'nao-produto', atualizadoEm: '2026-09-21T10:00:00.000Z' })
    },
    'avaliacoes-squad': { sqV: squadConcluida() },
    'motor-squad-config': {}, 'motor-squad-auditoria': {},
    'motor-arquitetura-auditoria': { a1: { tipo: 'texto', campo: 'canal', valorAnterior: '{"rotulo":"Canal"}', valorNovo: '{"rotulo":"Canal (antigo editor)"}', usuario: { name: 'Teste', email: EMAIL }, dataHora: '2026-09-01T10:00:00.000Z', versaoAnterior: 1, novaVersao: 1 } },
    'fa-avaliacao-acessos': {}, taxonomia: taxonomiaSemeada()
  };
  const cfg = { db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true, delays: opts.delays || {}, fail: opts.fail || [] };
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await ctx.addInitScript(`
    window.__pdfs = [];
    new MutationObserver(function (ms) {
      ms.forEach(function (m) { m.addedNodes.forEach(function (n) {
        if (n.nodeType !== 1 || n.parentNode !== document.body) return;
        var doc = n.classList && n.classList.contains('pdf-doc') ? n : (n.querySelector && n.querySelector('.pdf-doc'));
        if (doc) window.__pdfs.push(doc.innerText);
      }); });
    }).observe(document, { childList: true, subtree: true });`);
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  if (INVERSA === 'fabrica') {
    await servirMutado(page, 'classificacoes.js', SRC_CLS, '    var n = nomeDaTaxonomia(id);\n    if (n) return n;\n', '');
  } else if (INVERSA === 'qualquer-vigente') {
    /* lê as fontes do código inteiras e usa a PRIMEIRA com situacao 'vigente', ignorando o ponteiro */
    await servirMutado(page, 'classificacoes.js', SRC_CLS,
      "      var o = ouvir(RAIZ + '/fontes/' + id + '/' + fonteId + '/texto', minha, function (v) {\n        if (lido[id].fonteId !== fonteId) return; /* o ponteiro já mudou */\n        lido[id].texto = typeof v === 'string' ? v : null;",
      "      var o = ouvir(RAIZ + '/fontes/' + id, minha, function (todas) {\n        var vig = Object.keys(todas || {}).filter(function (k) { return todas[k] && todas[k].situacao === 'vigente'; })[0];\n        var v = vig ? todas[vig].texto : null;\n        lido[id].texto = typeof v === 'string' ? v : null;");
  } else if (INVERSA === 'contingencia-muda') {
    await servirMutado(page, 'avaliacao-produto.js', SRC_AVP, '      id: ident.camada,\n      label: nomeClassificacao(ident.camada),',
      "      id: (window.faClassificacoes && window.faClassificacoes.usandoContingencia(ident.camada)) ? 'a-validar' : ident.camada,\n      label: nomeClassificacao(ident.camada),");
  }
  await page.goto(BASE + '/index.html#' + (opts.rota || 'avaliacoes'), { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const espaco = (t) => String(t || '').replace(/\s+/g, ' ').trim();
const texto = async (page, sel) => espaco(await page.locator(sel).first().innerText());
async function foto(page, nome, sel) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  if (sel) await page.locator(sel).first().screenshot({ path: path.join(SHOTS, nome + '.png') });
  else await page.screenshot({ path: path.join(SHOTS, nome + '.png'), fullPage: false });
}
async function esperarClassif(page, estado, limite) {
  await esperarCondicao(page, (e) => window.faClassificacoes && window.faClassificacoes.estado() === e, estado,
    { limite: limite || 20000, descricao: 'faClassificacoes.estado() = ' + estado });
}
/* célula "Classificação" da linha da lista cuja ação abre a avaliação <key> — pela CHAVE, nunca pelo nome */
const celulaClassif = (page, key) => page.evaluate((k) => {
  const tr = Array.from(document.querySelectorAll('#avaliacoesPainel .avp-table tbody tr')).find((t) => t.querySelector('[data-key="' + k + '"]'));
  const el = tr && tr.querySelector('.avp-col-camada .avp-camada-nome');
  return el ? el.textContent.trim() : null;
}, key);
async function abrirItem(page, key) {
  await page.click('.avp-act-ver[data-key="' + key + '"]');
  await page.waitForSelector('#avpSecaoSistema');
}
async function voltarLista(page) {
  await page.click('#avpVoltarListaResultado');
  await page.waitForSelector('#avpNovoBtn');
}
async function concluirNova(page, nome) {
  await page.click('#avpNovoBtn');
  await page.fill('#avpfNome', nome);
  await page.click('#avpIniciarBtn');
  for (let i = 0; i < ORDEM.length; i++) await page.locator('#avpQuestion-' + ORDEM[i] + ' .avp-choice-btn--' + ((MASCARA_PP >> i) & 1 ? 'sim' : 'nao')).click();
  await page.click('#avpConcluirBtn');
  await page.waitForSelector('#avpSecaoSistema', { timeout: 30000 });
  await esperarCondicao(page, (n) => Object.values((window.__CFG.__dbReal || {})['avaliacoes-produto'] || {}).some((x) => x.nome === n && x.status === 'concluido'), nome,
    { limite: 15000, descricao: 'a avaliação "' + nome + '" gravada como concluída' });
  return Object.values((await banco(page))['avaliacoes-produto']).find((x) => x.nome === nome);
}
async function lerExcel(page) {
  await page.click('#avpExportarBtn');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#avpExportarExcelTodas')]);
  const arq = arquivoTemporario('classif-fonte-unica-', '.xlsx');
  await dl.saveAs(arq);
  const wb = XLSX.read(fs.readFileSync(arq), { type: 'buffer' });
  fs.unlinkSync(arq);
  return XLSX.utils.sheet_to_json(wb.Sheets.Resumo, { header: 1, defval: '' });
}
async function gerarPdf(page) {
  await page.evaluate(() => { window.__pdfs = []; });
  await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#avpGerarPdfBtn')]);
  return espaco(await page.evaluate(() => (window.__pdfs || []).join('\n')));
}
/* O que o MOTOR decidiu e o que conta como decisão — tem de ser idêntico com ou sem a Taxonomia. */
function nucleoMotor(r) {
  const c = r.camadaSugerida || {};
  return JSON.stringify({
    status: r.status, resultadoAutomatico: r.resultadoAutomatico, decisaoFinal: r.decisaoFinal, decisaoManual: !!r.decisaoManual,
    decisaoConfirmada: !!r.decisaoConfirmada, camadaId: c.id, motivos: c.motivos, incoerencia: !!c.incoerencia, especializacao: c.especializacao || null,
    papelEstrutural: c.papelEstrutural || null, conflitoNaturezas: !!c.conflitoNaturezas, impedidaPorGestao: c.impedidaPorGestao || null,
    bloqueioNatureza: c.bloqueioNatureza || null, criteriosEssenciaisFalhos: r.criteriosEssenciaisFalhos || [], exclusoesConflitantes: r.exclusoesConflitantes || [],
    criteriosAtendidos: r.criteriosAtendidos, motorVersion: r.motorVersion, motorVersionArquitetura: r.motorVersionArquitetura,
    questionnaireContentVersion: r.questionnaireContentVersion, historicoMotor: r.historicoMotor || null,
    respostas: Object.keys(r.respostas || {}).sort().map((k) => [k, r.respostas[k].valor])
  });
}

async function rodada(browser, viewport, nomeTela, sufixo) {
  console.log('\n######## ' + nomeTela + ' ########');
  let referencia = null; /* registro concluído com a Taxonomia disponível */

  /* ---------------- 1-4: renomeada, definição pelo ponteiro, ao vivo, concluir agora ---------------- */
  {
    const { ctx, page, erros } = await abrir(browser, viewport, {});
    await page.waitForSelector('#avpNovoBtn');
    await esperarClassif(page, 'contingencia'); /* documento-informacao não tem conceito: contingência só para ele */
    await esperarCondicao(page, (n) => !!Array.from(document.querySelectorAll('#avaliacoesPainel .avp-camada-nome')).find((e) => e.textContent === n), NOVO_PP,
      { descricao: 'lista com o nome da Taxonomia' });
    afirma(await celulaClassif(page, 'velha2') === NOVO_PP, 'lista: a avaliação antiga mostra o nome ATUAL da Taxonomia (' + await celulaClassif(page, 'velha2') + ')');
    afirma(await celulaClassif(page, 'canal1') === NOVO_CANAL, 'lista: Canal com o nome da Taxonomia');
    afirma(await page.locator('#avpListaClassifContingencia').isHidden(), 'lista: sem aviso de contingência (todos os códigos da lista têm conceito)');
    await page.click('#avpFiltrosBtn');
    const opcoes = await page.locator('#avpFiltroAlternativa option').evaluateAll((os) => os.map((o) => [o.value, o.textContent]));
    afirma(opcoes.length === 12 && opcoes.some((o) => o[0] === 'produto-principal' && o[1] === NOVO_PP), 'filtro: valor = código, rótulo = nome da Taxonomia (' + JSON.stringify(opcoes.slice(0, 2)) + ')');
    await page.selectOption('#avpFiltroAlternativa', 'produto-principal');
    const filtradas = await page.locator('#avaliacoesPainel .avp-act-ver').evaluateAll((bs) => bs.map((b) => b.getAttribute('data-key')));
    afirma(filtradas.length === 1 && filtradas[0] === 'velha2', 'filtro pelo código: só a avaliação de produto-principal (' + filtradas + ')');
    await page.selectOption('#avpFiltroAlternativa', 'todos');

    await abrirItem(page, 'velha2');
    const sis = await texto(page, '#avpSecaoSistema');
    afirma(sis.indexOf('Camada identificada: ' + NOVO_PP + ' na conclusão: ' + ANTIGO_PP) !== -1, 'resultado: nome atual + "na conclusão: ' + ANTIGO_PP + '"', sis.slice(0, 300));
    afirma(sis.indexOf(DEF_A) !== -1, 'definição = a fonte APONTADA por definicaoVigenteFonteId (A)');
    afirma(sis.indexOf(DEF_B) === -1, 'a outra fonte também "vigente" (B, gravada antes) NÃO aparece');
    afirma(await page.locator('#avpClassifContingencia').isHidden(), 'resultado: sem aviso de contingência');
    afirma((await texto(page, '#avpResumoFicha')).indexOf(NOVO_PP) !== -1, 'faixa-resumo da ficha com o nome atual');
    await page.click('#avpHistoricoVersoesLista > summary');
    const hist = await texto(page, '#avpHistoricoVersoesLista');
    afirma(hist.indexOf(NOVO_PP + ' (na conclusão: ' + ANTIGO_PP + ')') !== -1, 'histórico de versões: nome atual + "(na conclusão: ' + ANTIGO_PP + ')"', hist.slice(0, 300));
    afirma(await larguraOk(page), 'resultado sem rolagem horizontal');
    await foto(page, 'resultado-renomeado-' + sufixo, '#avpSecaoSistema');
    const pdf = await gerarPdf(page);
    afirma(pdf.indexOf('Classificação arquitetural ' + NOVO_PP + ' Nome registrado na conclusão: ' + ANTIGO_PP) !== -1, 'PDF novo: nome atual e o nome registrado na conclusão');

    /* 2+3: ao vivo — renomear e apontar a definição para a B, no banco, sem recarregar */
    await page.evaluate(() => { window.__semRecarga = true; });
    await page.evaluate(() => window.firebase.database().ref('taxonomia/arquitetural/conceitos/produto-principal/nome').set('Produto renomeado ao vivo'));
    await esperarCondicao(page, () => (document.getElementById('avpCamadaNome') || {}).textContent === 'Produto renomeado ao vivo', null, { descricao: 'o nome na ficha trocar sem recarregar' });
    afirma(true, 'ao vivo: a ficha troca o nome sem recarregar');
    await page.evaluate(() => window.firebase.database().ref('taxonomia/arquitetural/conceitos/produto-principal/definicaoVigenteFonteId').set('fB'));
    await esperarCondicao(page, (b) => ((document.getElementById('avpCamadaDefinicao') || {}).textContent || '') === b, DEF_B, { descricao: 'a definição seguir o ponteiro novo (B)' });
    afirma((await texto(page, '#avpSecaoSistema')).indexOf(DEF_A) === -1, 'ponteiro trocado: a definição A sai da tela, fica a B');
    await page.evaluate(() => window.firebase.database().ref('taxonomia/arquitetural/conceitos/produto-principal/definicaoVigenteFonteId').set('fA'));
    await esperarCondicao(page, (a) => ((document.getElementById('avpCamadaDefinicao') || {}).textContent || '') === a, DEF_A, { descricao: 'a definição voltar para a A' });
    await page.evaluate((n) => window.firebase.database().ref('taxonomia/arquitetural/conceitos/produto-principal/nome').set(n), NOVO_PP);
    await esperarCondicao(page, (n) => (document.getElementById('avpCamadaNome') || {}).textContent === n, NOVO_PP, { descricao: 'voltar ao nome do teste' });
    afirma(await page.evaluate(() => window.__semRecarga === true), 'tudo isso sem recarregar a página');
    await voltarLista(page);
    await page.evaluate(() => window.firebase.database().ref('taxonomia/arquitetural/conceitos/canal/nome').set('Canal renomeado na lista'));
    await esperarCondicao(page, () => !!Array.from(document.querySelectorAll('#avaliacoesPainel .avp-camada-nome')).find((e) => e.textContent === 'Canal renomeado na lista'), null, { descricao: 'a lista trocar o nome sem recarregar' });
    afirma(await celulaClassif(page, 'canal1') === 'Canal renomeado na lista', 'ao vivo: a lista troca o nome sem recarregar');
    await page.evaluate((n) => window.firebase.database().ref('taxonomia/arquitetural/conceitos/canal/nome').set(n), NOVO_CANAL);

    /* 4: concluir agora grava código + nome resolvido; a frase usa o nome da Taxonomia */
    const nova = await concluirNova(page, 'Item novo ' + sufixo);
    referencia = nova;
    afirma(nova && nova.camadaSugerida.id === 'produto-principal' && nova.camadaSugerida.label === NOVO_PP, 'concluir agora: grava o código e o nome resolvido na conclusão (' + (nova && JSON.stringify({ id: nova.camadaSugerida.id, label: nova.camadaSugerida.label })) + ')');
    afirma(nova && nova.justificativaAutomatica.indexOf('O item foi classificado como ' + NOVO_PP + ' porque') === 0, 'frase explicativa com o nome da Taxonomia: "' + (nova && nova.justificativaAutomatica.slice(0, 70)) + '…"');
    afirma(await page.locator('#avpCamadaNaConclusao').isHidden(), 'avaliação nova: nome atual = nome na conclusão, sem a nota da época');
    const gravadas = (await banco(page))['avaliacoes-produto'];
    afirma(gravadas.velha.camadaSugerida.label === ANTIGO_PP && gravadas.velha2.camadaSugerida.label === ANTIGO_PP, 'nada foi reescrito: as avaliações antigas guardam o nome da época');
    await voltarLista(page);

    const resumo = await lerExcel(page);
    const cab = resumo[0] || [];
    const iAtual = cab.indexOf('Classificação arquitetural'), iEpoca = cab.indexOf('Rótulo registrado na conclusão');
    const linha = resumo.find((l) => l[0] === 'velha2') || [];
    afirma(iAtual !== -1 && iEpoca === iAtual + 1, 'Excel: coluna "Rótulo registrado na conclusão" logo depois da classificação atual');
    afirma(linha[iAtual] === NOVO_PP && linha[iEpoca] === ANTIGO_PP, 'Excel: avaliação antiga — atual "' + linha[iAtual] + '", na conclusão "' + linha[iEpoca] + '"');
    const linhaNova = resumo.find((l) => l[1] === 'Item novo ' + sufixo) || [];
    afirma(linhaNova[iAtual] === NOVO_PP && linhaNova[iEpoca] === NOVO_PP, 'Excel: avaliação nova — atual e registrado iguais (' + linhaNova[iAtual] + ')');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  /* ---------------- 5: Squad (contexto arquitetural), troca no lugar ---------------- */
  {
    const { ctx, page, erros } = await abrir(browser, viewport, { rota: 'avaliacoes?sq=sqV' });
    await page.waitForSelector('#sqContextoClassificacao', { timeout: 15000 });
    await esperarCondicao(page, (n) => (document.getElementById('sqContextoClassificacao') || {}).textContent === n, NOVO_PP, { descricao: 'contexto da Squad com o nome da Taxonomia' });
    afirma(true, 'Squad: o contexto arquitetural mostra o nome atual (' + NOVO_PP + ')');
    await page.evaluate(() => { window.__marcaSquad = document.querySelector('#avaliacoesSquad .avp-question, #avaliacoesSquad .sq-choice-group, #avaliacoesSquad .avp-form-card'); });
    await page.evaluate(() => window.firebase.database().ref('taxonomia/arquitetural/conceitos/produto-principal/nome').set('Produto renomeado ao vivo'));
    await esperarCondicao(page, () => (document.getElementById('sqContextoClassificacao') || {}).textContent === 'Produto renomeado ao vivo', null, { descricao: 'contexto da Squad trocar no lugar' });
    afirma(await page.evaluate(() => !!window.__marcaSquad && document.contains(window.__marcaSquad)), 'Squad: o nome trocou no lugar, sem redesenhar a tela');
    afirma(await page.locator('#sqContextoContingencia').isHidden(), 'Squad: sem aviso de contingência');
    afirma(await larguraOk(page), 'Squad sem rolagem horizontal');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  /* ---------------- 6: lenta, que nunca responde, recusada ---------------- */
  for (const [caso, opts] of [['nunca responde', { delays: { taxonomia: 100000000 } }], ['recusada', { fail: ['taxonomia'] }]]) {
    const { ctx, page, erros } = await abrir(browser, viewport, opts);
    await page.waitForSelector('#avpNovoBtn');
    await esperarClassif(page, 'contingencia');
    await esperarCondicao(page, () => { const e = document.getElementById('avpListaClassifContingencia'); return !!e && !e.hidden; }, null, { descricao: caso + ': aviso de contingência na lista' });
    afirma(/Rótulo de contingência/.test(await texto(page, '#avpListaClassifContingencia')), caso + ': lista com o aviso discreto "Rótulo de contingência"');
    afirma(await celulaClassif(page, 'velha2') === ANTIGO_PP, caso + ': lista com o rótulo de contingência (' + await celulaClassif(page, 'velha2') + ')');
    await abrirItem(page, 'velha2');
    afirma(await page.locator('#avpClassifContingencia').isVisible() && (await texto(page, '#avpSecaoSistema')).indexOf('Camada identificada: ' + ANTIGO_PP) !== -1, caso + ': resultado com o rótulo de contingência e o aviso');
    afirma(await page.locator('#avpCamadaNaConclusao').isHidden(), caso + ': sem "na conclusão" (o nome de contingência é igual ao registrado)');
    afirma(await page.locator('#avpCamadaDefinicao').isHidden(), caso + ': nenhuma definição inventada');
    if (caso === 'nunca responde') await foto(page, 'contingencia-' + sufixo, '#avpSecaoSistema');
    await voltarLista(page);
    const nova = await concluirNova(page, 'Item novo ' + sufixo + ' ' + caso);
    afirma(nova && nova.status === 'concluido' && nova.camadaSugerida.label === ANTIGO_PP, caso + ': concluir continua funcionando (grava o rótulo resolvido: "' + (nova && nova.camadaSugerida.label) + '")');
    const a = nucleoMotor(referencia || {}), b = nucleoMotor(nova || {});
    afirma(!!referencia && a === b, caso + ': resultado, camadaSugerida.id, decisão, respostas e versões IGUAIS aos da conclusão com a Taxonomia', a + '\n    ≠ ' + b);
    afirma(await larguraOk(page), caso + ': sem rolagem horizontal');
    afirma(erros.length === 0, caso + ': nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }
  {
    /* lenta: passa do limite (contingência + aviso) e depois responde — os nomes chegam sem recarregar */
    const { ctx, page, erros } = await abrir(browser, viewport, { delays: { taxonomia: 9000 } });
    await page.waitForSelector('#avpNovoBtn');
    await esperarClassif(page, 'contingencia', 12000);
    await esperarCondicao(page, () => { const e = document.getElementById('avpListaClassifContingencia'); return !!e && !e.hidden; }, null, { descricao: 'lenta: aviso de contingência enquanto não chega' });
    afirma(await celulaClassif(page, 'velha2') === ANTIGO_PP, 'lenta: enquanto não chega, rótulo de contingência + aviso');
    await esperarCondicao(page, (n) => !!Array.from(document.querySelectorAll('#avaliacoesPainel .avp-camada-nome')).find((e) => e.textContent === n), NOVO_PP, { limite: 15000, descricao: 'lenta: o nome da Taxonomia chegar' });
    afirma(await page.locator('#avpListaClassifContingencia').isHidden(), 'lenta: quando a Taxonomia responde, o nome atual aparece e o aviso some — sem recarregar');
    afirma(erros.length === 0, 'lenta: nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  /* ---------------- 7: motor sem "Editar textos"; histórico antigo legível ---------------- */
  {
    const { ctx, page, erros } = await abrir(browser, viewport, { rota: 'admin?arq=motores' });
    await page.waitForSelector('#avpMotorArqEditarBtn', { timeout: 15000 });
    afirma(await page.locator('#avpMotorArqTextosBtn').count() === 0 && !/Editar textos das classificações|PUBLICAR TEXTOS/.test(await texto(page, '#adminAvaliacaoProduto')),
      'Configuração dos Motores: "Editar textos" do motor arquitetural não existe mais');
    afirma(/vêm da Taxonomia Arquitetural/.test(await texto(page, '#avpMotorArqNomesTaxonomia')), 'o painel diz que nomes e definições vêm da Taxonomia Arquitetural');
    afirma(await page.locator('#avpMotorSquadAbrirBtn').count() === 1, 'o motor de squad continua acessível (os textos dos vereditos dele são consumidos)');
    await foto(page, 'motor-sem-editar-textos-' + sufixo, '#adminAvaliacaoProduto');
    await page.click('#avpMotorArqAuditoriaBtn');
    await page.waitForSelector('#avpMotorArqHistorico', { timeout: 8000 });
    await page.click('#avpMotorArqHistorico > summary');
    const histMotor = await texto(page, '#avpMotorArqHistorico');
    afirma(/Texto/.test(histMotor) && /canal/.test(histMotor), 'histórico do motor: a linha antiga de "Texto" continua listada (' + histMotor.slice(0, 120) + ')');
    afirma(await larguraOk(page), 'motor sem rolagem horizontal');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  /* ---------------- 8: Conceitos-base da Avaliação na Taxonomia ---------------- */
  {
    const { ctx, page, erros } = await abrir(browser, viewport, { rota: 'admin' });
    await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelTaxonomia"]', { state: 'visible', timeout: 12000 });
    await page.click('.admin-tab-btn[data-panel="adminPanelTaxonomia"]');
    await page.waitForSelector('#taxPergunta');
    await page.click('.tax-dominio[data-dominio="arquitetural"]');
    await page.waitForSelector('#taxConceitosBase', { timeout: 10000 });
    const itens = await page.locator('#taxConceitosBase .tax-base-item').evaluateAll((ls) => ls.map((l) => l.getAttribute('data-base')));
    afirma(itens.length === 11 && CODIGOS.every((c) => itens.indexOf(c) !== -1), 'bloco "Conceitos-base da Avaliação" com os 11 códigos do motor (' + itens.length + ')');
    afirma(await page.locator('#taxConceitosBase .tax-base-item--sem').count() === 1 &&
      /sem conceito — a Avaliação usa o rótulo de contingência/.test(await texto(page, '#taxConceitosBase .tax-base-item--sem[data-base="' + SEM_CONCEITO + '"]')),
      'o código sem conceito (' + SEM_CONCEITO + ') é acusado — e só ele');
    afirma((await texto(page, '#taxConceitosBase .tax-base-item[data-base="produto-principal"]')).indexOf(NOVO_PP + ' produto-principal') !== -1, 'cada código mostra o nome atual e o código');
    afirma(await larguraOk(page), 'Taxonomia sem rolagem horizontal');
    await foto(page, 'conceitos-base-' + sufixo, '#taxConceitosBase');
    await page.click('#taxConceitosBase .tax-base-abrir[data-codigo="produto-principal"]');
    await page.waitForSelector('#taxSecFontes', { timeout: 8000 });
    afirma((await texto(page, '.tax-detalhe')).indexOf(NOVO_PP) !== -1, 'clicar abre o conceito');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }
}

(async () => {
  afirma(MASCARA_PP >= 0, 'o motor real tem respostas que dão Produto/Serviço principal (máscara ' + MASCARA_PP + ')');
  const browser = await chromium.launch();
  await rodada(browser, DESKTOP, 'DESKTOP (1280 px)', 'desktop');
  await rodada(browser, CELULAR, 'CELULAR (375 px)', '375');
  await browser.close();
  if (falhas) { console.log('\n' + falhas + ' FALHA(S)'); process.exit(1); }
  console.log('\nOK — nome e definição das classificações vêm da Taxonomia Arquitetural pelo código (lista, filtro, ficha, histórico, PDF, Excel, Squad), ao vivo, com a definição da fonte apontada; contingência visível sem tocar no motor; nome da época preservado; sem "Editar textos" no motor; conceitos-base na Taxonomia.');
})().catch((e) => { console.error(e); process.exit(1); });
