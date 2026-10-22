/* CAMINHO 1 — o objeto arquitetural de ponta a ponta: Objeto → Perguntas P1–P16 → Classificação → Natureza (quando a
 * classificação agrupa naturezas) → Próximo passo (concluir por aqui ou continuar a jornada organizacional).
 * Firebase falso em persistência real; hermético; dados 100% sintéticos (nada vai para produção). As respostas de cada
 * caso são calculadas pelo PRÓPRIO motor (carregado aqui em Node), nunca escritas à mão — o teste vale para a regra em uso.
 * Prova, pela interface, em computador e 375 px:
 *   A. Nova avaliação: etapas visíveis; progresso real; prévia do resultado (incompleta → classificação técnica);
 *      conclusão; na própria ficha, a natureza é identificada (Funcionalidade × Operação) com as definições oficiais e a
 *      justificativa; o mesmo estado aparece nas etapas da ficha, na trilha dos Trabalhos e na linha da lista.
 *   B. Próximo passo: "Continuar a jornada organizacional" pergunta se há responsabilidade própria; Sim → O1–O9 da Porta 1
 *      e volta para a ficha com a escolha guardada; Não → explica que não precisa (item sem responsabilidade própria);
 *      "Concluir por aqui" → registro nos Trabalhos com a avaliação concluída e o Posicionamento opcional.
 *   C. Classificações diretas (Produto/Serviço, Canal, Componente, Capacidade): a natureza aparece sem nova identificação.
 *   D. Classificações técnicas: Processo × Etapa, Informação × Documento, Modalidade × Subproduto × Opção, Regra (Opção →
 *      pendência "reavaliação P1–P16 necessária"); evidência insuficiente → pendência; nada é forçado.
 *   E. Respostas contraditórias: SIM em dois testes → aviso + prévia "A validar" + natureza pendente com o próximo passo;
 *      P5 × P13 marcadas como incoerentes (não só P5 × P16).
 *   F. Versões: identificação feita em outra versão da avaliação → "a confirmar" (ficha e Trabalhos), reconfirmação.
 *   G. Registro da natureza: liberado (grava), suspenso (marcador false: explica e não grava; P1–P16 intacta), recusado pelo
 *      banco (mensagem, nada gravado), perfil de consulta (não oferece registrar).
 *   H. Proposta editorial "caminho1-ajudas-p1-p16": todos os ajustes pendentes sobre a redação vigente; aplicada pela
 *      administração geral, vira versão nova; avaliação nova vê as ajudas novas; a antiga mantém a sua versão; o motor
 *      classifica igual antes e depois (mesmas respostas → mesma classificação).
 *   I. PDF e Excel com a natureza; F5 na ficha; teclado; sem rolagem lateral; Porta 2 e Squad intocadas. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SJ = require('./semente-jornada');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const { arquivoTemporario } = require('./arquivo-temporario');
const RG = require('./responder-guiada');
const XLSX = require(path.join(__dirname, '..', '..', 'forca-agil', 'xlsx.mini.min.js'));

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const ADM = 'admin.geral@previ.com.br';
let falhas = 0, total = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); if (!c) falhas++; }

/* ---------- o motor real, em Node: respostas que levam a cada classificação ---------- */
const ORDEM = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao',
  'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
const IDX = { P5: 4, P9: 8, P12: 11, P13: 12, P16: 15 };
const respostasDe = (m) => { const r = {}; ORDEM.forEach((id, i) => { r[id] = { valor: (m >> i) & 1 ? 'sim' : 'nao' }; }); return r; };
/* o motor como está em produção: a regra v7 (incoerência ampliada, conflito e recorte), montada pelo PRÓPRIO código a
   partir da v6 esperada — a mesma configuração vai para o banco falso da página */
function carregarMotor(config) {
  const SRC_AVP = fs.readFileSync(path.join(RAIZ, 'avaliacao-produto.js'), 'utf8');
  const ctx = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, setTimeout, clearTimeout, setInterval, clearInterval, parseFloat, parseInt, isNaN };
  ctx.window = ctx; ctx.window.window = ctx;
  const el = () => ({ addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, style: {}, classList: { add() {}, remove() {}, contains() { return false; } } });
  ctx.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: el(), documentElement: el() };
  const ref = (p) => ({ on(ev, cb) { if (p === 'motor-arquitetura-config' && config) cb({ val: () => JSON.parse(JSON.stringify(config)) }); }, once() {}, off() {}, update() {}, child(c) { return ref(p + '/' + c); }, push() { return { key: 'k' }; } });
  ctx.firebase = { database: () => ({ ref }) };
  ctx.navigator = {}; ctx.location = { hash: '' }; ctx.localStorage = { getItem() { return null; }, setItem() {} };
  vm.createContext(ctx);
  for (const f of ['questionarios-config.js', 'motor-arquitetura.js']) vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), ctx, { filename: f });
  const fim = SRC_AVP.lastIndexOf('})();');
  vm.runInContext(SRC_AVP.slice(0, fim) + '\nwindow.__avpTeste = { computeResultado: computeResultado };\n' + SRC_AVP.slice(fim), ctx, { filename: 'avaliacao-produto.js' });
  if (config) ctx.window.faMotorArquitetura.onMudanca(function () {});
  return { M: ctx.window.faMotorArquitetura, av: ctx.__avpTeste };
}
const M0 = carregarMotor().M;
const V6 = M0.regrasVersao6Esperadas();
const CONFIG_MOTOR = { versaoPublicada: 7, versoes: { 6: { regras: V6 }, 7: { regras: M0.construirPropostaV7(JSON.parse(JSON.stringify(V6))) } } };
const MOTOR = carregarMotor(CONFIG_MOTOR).av;
const camadaDe = (m) => MOTOR.computeResultado({ respostas: respostasDe(m) }).camadaSugerida;
const MASC = {};
for (let m = 0; m < 65536; m++) {
  const c = camadaDe(m);
  if (c.incoerencia || c.id === 'a-validar') continue;
  if (MASC[c.id] === undefined) MASC[c.id] = m;
}
const comSim = (m, ...cods) => cods.reduce((x, c) => x | (1 << IDX[c]), m);
const M_FUNC = MASC['funcionalidade-operacao'], M_CANAL = MASC.canal, M_PP = MASC['produto-principal'];
let M_CONFLITO, M_INCOER;
for (let m = 0; m < 65536 && (M_CONFLITO === undefined || M_INCOER === undefined); m++) {
  const c = camadaDe(m), sims = [8, 9, 10, 11, 12, 13, 14, 15].filter((b) => (m >> b) & 1);
  if (M_CONFLITO === undefined && c.id === 'a-validar' && (c.tipoAValidar === 'conflito' || c.tipoAValidar === 'recorte') && sims.length === 2 && !((m >> IDX.P5) & 1)) M_CONFLITO = m;
  if (M_INCOER === undefined && c.tipoAValidar === 'incoerencia' && (m >> IDX.P5) & 1 && (m >> IDX.P13) & 1 && sims.length === 1) M_INCOER = m; /* autonomia × modalidade */
}

/* ---------- semente ---------- */
const T = '2026-10-18T09:00:00.000Z';
const conceito = (nome, camada) => ({ nome, ordem: 100, ativo: true, naturezaDe: camada, definicao: { texto: 'Definição aprovada de ' + nome + ' (teste).', versao: 1, publicadaEm: T, publicadaPor: 'adm@previ.com.br' } });
function banco(o) {
  o = o || {};
  const db = SJ.semente();
  const base = db['avaliacoes-produto'].pCapec;
  const item = (id, nome, camada, extra) => Object.assign(JSON.parse(JSON.stringify(base)), { itemId: id, nome, decisaoFinal: 'nao-produto', resultadoAutomatico: 'nao-produto', camadaSugerida: { id: camada, label: camada }, motorVersionArquitetura: 7 }, extra || {}); /* concluídas com a regra publicada (Motor atual) */
  Object.assign(db['avaliacoes-produto'], {
    cComp: item('cComp', 'Motor de cálculo (teste)', 'componente'), cCap: item('cCap', 'Gestão atuarial (teste)', 'capacidade-organizacional'),
    pProc: item('pProc', 'Concessão (teste)', 'processo-etapa'), dInf: item('dInf', 'Informe de rendimentos (teste)', 'documento-informacao'),
    mMod: item('mMod', 'Perfil de investimento (teste)', 'modalidade-subproduto'), rReg: item('rReg', 'Escolha tributária (teste)', 'regra-condicao'),
    fRea1: item('fRea', 'Consulta de saldo (teste)', 'funcionalidade-operacao', { versao: 1 }),
    fRea2: item('fRea', 'Consulta de saldo (teste)', 'funcionalidade-operacao', { versao: 2, versaoAnteriorKey: 'fRea1' })
  });
  Object.assign(db['avaliacoes-produto-ponta'], { cComp: 'cComp', cCap: 'cCap', pProc: 'pProc', dInf: 'dInf', mMod: 'mMod', rReg: 'rReg', fRea: 'fRea2' });
  db['objetos-natureza'] = { fRea: { natureza: 'funcionalidade', camada: 'funcionalidade-operacao', avaliacaoId: 'fRea1', revisao: 1, registradaEm: 1, registradaPor: { id: 'u', email: SJ.ARQ }, auditoriaId: 'aF1',
    fundamento: { versao: 1, pergunta: 'P', alternativa: 'funcionalidade', rotulo: 'Recurso oferecido', justificativa: 'Identificada na v1 (teste)', definicoes: { funcionalidade: { texto: 'Def', versao: 1 } } } } };
  db.taxonomia.arquitetural = { conceitos: { funcionalidade: conceito('Funcionalidade', 'funcionalidade-operacao'), operacao: conceito('Operação', 'funcionalidade-operacao'),
    processo: conceito('Processo', 'processo-etapa'), etapa: conceito('Etapa', 'processo-etapa'), informacao: conceito('Informação', 'documento-informacao'), documento: conceito('Documento', 'documento-informacao'),
    regra: conceito('Regra', 'regra-condicao'), opcao: conceito('Opção', 'modalidade-subproduto'), modalidade: conceito('Modalidade', 'modalidade-subproduto'), subproduto: conceito('Subproduto', 'modalidade-subproduto') } };
  db['relacoes-objetos-config'] = { gravacaoHabilitada: o.marcador === undefined ? true : o.marcador };
  db['motor-arquitetura-config'] = JSON.parse(JSON.stringify(CONFIG_MOTOR)); /* a regra publicada (v7) */
  if (o.adminGeral) db['fa-admins'] = Object.assign({}, db['fa-admins'] || {}, { [SJ.chave(ADM)]: true });
  return db;
}
abrir.n = 0;
async function abrir(browser, vp, hash, o) {
  o = o || {};
  const email = o.email || SJ.ARQ;
  const ctx = await browser.newContext({ viewport: vp, acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e), (e.stack || '').split(String.fromCharCode(10)).slice(0, 4).join(' | ')); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(o), user: { email, emailVerified: true, uid: 'u-' + SJ.chave(email) }, uidDoUsuario: true, prefixoChave: 'c' + (++abrir.n) + 'x', delayDefault: 10, persistenciaReal: true }) + ';');
  await ctx.addInitScript(`window.__pdfs = []; new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) {
    if (n.nodeType !== 1 || n.parentNode !== document.body) return; var d = n.classList && n.classList.contains('pdf-doc') ? n : (n.querySelector && n.querySelector('.pdf-doc')); if (d) window.__pdfs.push(d.innerText); }); }); }).observe(document, { childList: true, subtree: true });`);
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const ate = (page, fn, arg, desc, limite) => esperarCondicao(page, fn, arg === undefined ? null : arg, { limite: limite || 20000, descricao: desc });
const banco0 = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; }, sel);
const existe = (page, sel) => page.evaluate((s) => !!document.querySelector(s), sel);
/* capturas opcionais (FA_PRINTS=<pasta>): telas do caminho em computador e celular */
const foto = async (page, nome, sel) => { if (!process.env.FA_PRINTS) return; fs.mkdirSync(process.env.FA_PRINTS, { recursive: true });
  const arq = path.join(process.env.FA_PRINTS, nome + '-' + page.viewportSize().width + '.png');
  if (sel) { const el = page.locator(sel).first(); await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: arq }); } else await page.screenshot({ path: arq }); };
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const etapaNatureza = (page) => texto(page, '#avpEtapas [data-etapa="natureza"] .avp-etapa-det');
const estadoEtapa = (page, id) => page.evaluate((i) => { const li = document.querySelector('#avpEtapas [data-etapa="' + i + '"]'); return li ? li.getAttribute('data-estado') : null; }, id);
const etapasSao = (page, nat, prox, desc) => ate(page, (x) => { const g = (i) => { const li = document.querySelector('#avpEtapas [data-etapa="' + i + '"]'); return li && li.getAttribute('data-estado'); }; return g('natureza') === x[0] && g('proximo') === x[1]; }, [nat, prox], desc);
/* etapa Natureza + natureza no resumo + pendências no resumo, ao mesmo tempo (a mesma conta) */
const tresIguais = (page, x, desc) => ate(page, (e) => {
  const li = document.querySelector('#avpEtapas [data-etapa="natureza"]'), det = li && li.querySelector('.avp-etapa-det');
  const rn = document.querySelector('#avpResumoAntesDeEscolher [data-resumo="natureza"]'), rp = document.querySelector('#avpResumoAntesDeEscolher [data-resumo="pendencias"]');
  return !!(li && det && rn && rp) && li.getAttribute('data-estado') === e.estado && det.textContent.indexOf(e.nat) !== -1 && rn.textContent.indexOf(e.nat) !== -1 && new RegExp(e.pend).test(rp.textContent);
}, x, desc);
/* ordem da ficha: o próximo passo vem depois do resultado, da natureza, das complementações, da decisão e do histórico */
const ordemOk = (page) => page.evaluate(() => { const ids = ['avpSecaoSistema', 'avpSecaoNatureza', 'avpSecaoCuradoria', 'avpSecaoDecisao', 'avpSecaoHistorico', 'avpSecaoProximo'].map((i) => document.getElementById(i));
  if (ids.some((e) => !e)) return false; for (let i = 1; i < ids.length; i++) if (!(ids[i - 1].compareDocumentPosition(ids[i]) & Node.DOCUMENT_POSITION_FOLLOWING)) return false; return true; });
const fichaPronta = (page) => ate(page, () => !!document.querySelector('#avpSecaoNatureza #roNatureza'), undefined, 'natureza na ficha');
/* avaliação guiada (v22): responde as perguntas guiadas que levam a esta combinação de P1–P16, até a revisão */
async function responder(page, mascara) { await RG.responderGuiada(page, mascara); }
async function novaAvaliacao(page, nome, mascara, antesDeConcluir) {
  await page.waitForSelector('#avpNovoBtn');
  await page.click('#avpNovoBtn');
  await page.fill('#avpfNome', nome);
  await page.click('#avpIniciarBtn');
  await page.waitForSelector('#avpEtapas');
  await responder(page, mascara);
  if (antesDeConcluir) await antesDeConcluir();
  await RG.concluirGuiada(page);
  await page.waitForSelector('#avpSecaoSistema', { timeout: 30000 });
  await ate(page, (n) => Object.values((window.__CFG.__dbReal || {})['avaliacoes-produto'] || {}).some((x) => x.nome === n && x.status === 'concluido'), nome, 'avaliação "' + nome + '" concluída');
  const db = await banco0(page);
  return Object.keys(db['avaliacoes-produto']).map((k) => Object.assign({ _key: k }, db['avaliacoes-produto'][k])).find((x) => x.nome === nome);
}
async function identificar(page, alt, just, diag) {
  await page.check('input[name="roIdentAlt"][value="' + alt + '"]');
  if (diag !== undefined) { await page.waitForSelector('#roIdentDiag'); await page.fill('#roIdentDiag', diag); }
  await page.fill('#roIdentJust', just);
  await page.click('#roIdentSalvar');
}
const alternativas = (page) => page.$$eval('#avpSecaoNatureza input[name="roIdentAlt"]', (is) => is.map((i) => i.value).join());
const intocadas = (db) => JSON.stringify([db['objetos-organizacionais'], db['avaliacoes-squad'], db['avaliacoes-posicionamento']]);

async function rodada(browser, vp, rotulo) {
  console.log('\n######## ' + rotulo + ' ########');
  let ctx, page, erros;

  /* ---------- A + B: nova avaliação (Funcionalidade/Operação) até a natureza e o próximo passo ---------- */
  console.log('A/B. Nova avaliação de ponta a ponta');
  ({ ctx, page, erros } = await abrir(browser, vp, '#arquitetura?av=lista'));
  const antes = intocadas(await banco0(page));
  await page.waitForSelector('#avpNovoBtn');
  await page.click('#avpNovoBtn');
  await page.fill('#avpfNome', 'Simulação de renda (Caminho 1)');
  await page.click('#avpIniciarBtn');
  await page.waitForSelector('#avpEtapas');
  afirma(/Perguntas guiadas/.test(await texto(page, '#avpEtapas')) && /Natureza/.test(await texto(page, '#avpEtapas')) && /Próximo passo/.test(await texto(page, '#avpEtapas')), 'A. as etapas do caminho aparecem desde o início (Objeto → Perguntas → Classificação → Natureza → Próximo passo)');
  afirma(/0 de \d+ respondidas/.test(await texto(page, '#avpEtapas')) && await existe(page, '#avpGuiadaCartao') && !(await existe(page, '#avpPrevia')), 'A. progresso real (0 respondidas) e uma pergunta por vez; a prévia só na revisão');
  await responder(page, M_FUNC);
  await ate(page, () => !!document.querySelector('#avpPrevia[data-camada="funcionalidade-operacao"]'), undefined, 'prévia');
  afirma(/(\d+) de \1 respondidas/.test(await texto(page, '#avpEtapas')) && /Funcionalidade/.test(await texto(page, '#avpPreviaTecnica')) && /Operação/.test(await texto(page, '#avpPreviaTecnica')), 'A. prévia: classificação técnica e as naturezas que serão diferenciadas na ficha', await texto(page, '#avpPrevia'));
  afirma(/nada foi gravado/.test(await texto(page, '#avpPrevia')) && !Object.values((await banco0(page))['avaliacoes-produto']).some((x) => x.nome === 'Simulação de renda (Caminho 1)'), 'A. a prévia não grava nada');
  afirma(await larguraOk(page), 'A. questionário sem rolagem lateral');
  await foto(page, '1-previa-tecnica', '#avpPrevia');
  await RG.concluirGuiada(page);
  await page.waitForSelector('#avpSecaoSistema', { timeout: 30000 });
  await fichaPronta(page);
  const novo = Object.entries((await banco0(page))['avaliacoes-produto']).map(([k, v]) => Object.assign({ _key: k }, v)).find((x) => x.nome === 'Simulação de renda (Caminho 1)');
  const itemNovo = novo.itemId || novo._key;
  afirma(novo.status === 'concluido' && novo.camadaSugerida.id === 'funcionalidade-operacao', 'A. avaliação concluída e salva com a classificação do motor');
  afirma(await existe(page, '#avpSecaoNatureza #roFormNatureza') && (await alternativas(page)) === 'funcionalidade,operacao,recorte,evidencia-insuficiente', 'A. a identificação da natureza continua na própria ficha (sem ir a outra tela)', await alternativas(page));
  afirma(/Definição aprovada de Funcionalidade/.test(await texto(page, '#avpSecaoNatureza #roIdentDefinicoes')) && /Definição aprovada de Operação/.test(await texto(page, '#avpSecaoNatureza #roIdentDefinicoes')), 'A. com as definições oficiais da Taxonomia');
  afirma(/A identificar/.test(await etapaNatureza(page)), 'A. a etapa "Natureza" diz que falta identificar', await etapaNatureza(page));
  await etapasSao(page, 'atual', 'disponivel', 'etapas antes de identificar');
  await tresIguais(page, { estado: 'atual', nat: 'A identificar', pend: 'natureza do objeto está em aberto' }, 'antes do registro');
  afirma(true, 'A. antes do registro: etapa "A identificar", resumo com a mesma natureza e a pendência da natureza');
  afirma(true, 'A. etapas reais: Natureza ATUAL (a identificar) e Próximo passo disponível, avisando que a natureza fica em aberto');
  afirma(/disponível — a natureza continua em aberto/.test(await texto(page, '#avpEtapas [data-etapa="proximo"]')), 'A. o próximo passo diz que dá para seguir, mas a natureza fica em aberto');
  afirma(await ordemOk(page), 'A. ordem da ficha: resultado → natureza → complementações → decisão → fundamentação → Próximo passo');
  afirma(!(await existe(page, '#avpVerJornadaBtn')) && (await page.$$('a[href="#arquitetura?tr=1&item=' + encodeURIComponent(itemNovo) + '"]')).length === 1, 'A. sem botão repetido: o caminho para o registro é só "Concluir por aqui"');
  afirma(/Pendências:.*natureza do objeto está em aberto/.test(await texto(page, '#avpResumoAntesDeEscolher')), 'A. o resumo antes de escolher mostra a pendência da natureza', await texto(page, '#avpResumoAntesDeEscolher'));
  await foto(page, '2b-etapas-a-identificar', '#avpEtapas');
  await foto(page, '2-etapas-e-identificacao', '#avpSecaoNatureza');
  afirma(await existe(page, '#avpSecaoProximo #avpOpcaoConcluir') && await existe(page, '#avpSecaoProximo #avpOpcaoContinuar') && !(await existe(page, '#avpPosicionarBtn')), 'B. próximo passo: concluir por aqui × continuar (o O1–O9 não é oferecido de cara)');
  await identificar(page, 'operacao', 'É a ação executada dentro do plano, acionada pela funcionalidade de simulação (teste)');
  await ate(page, () => /identificada:\s*Operação/.test((document.querySelector('#avpSecaoNatureza #roNatureza') || {}).textContent || ''), undefined, 'natureza identificada');
  await ate(page, () => /Identificada: Operação/.test((document.querySelector('#avpEtapas [data-etapa="natureza"] .avp-etapa-det') || {}).textContent || ''), undefined, 'etapa atualizada');
  await etapasSao(page, 'ok', 'atual', 'etapas depois de identificar');
  await tresIguais(page, { estado: 'ok', nat: 'Identificada: Operação', pend: 'Pendências:\\s*nenhuma' }, 'depois do registro');
  afirma(true, 'A. depois do registro, sem F5: etapa concluída, resumo "Identificada: Operação" e a pendência da natureza sumiu (Pendências: nenhuma)');
  afirma(true, 'A. sem recarregar: depois de registrar, Natureza CONCLUÍDA e Próximo passo vira a etapa atual');
  afirma(/Natureza:\s*Identificada: Operação/.test(await texto(page, '#avpResumoAntesDeEscolher')), 'A. o resumo antes de escolher também se atualiza', await texto(page, '#avpResumoAntesDeEscolher'));
  await foto(page, '4a-resumo-e-escolha', '#avpSecaoProximo');
  const nat = (await banco0(page))['objetos-natureza'][itemNovo];
  afirma(nat && nat.natureza === 'operacao' && nat.avaliacaoId === novo._key && nat.fundamento && /ação executada/.test(nat.fundamento.justificativa) && nat.fundamento.definicoes && nat.fundamento.definicoes.operacao,
    'A. natureza gravada com o fundamento (justificativa e definições da época), ligada a esta versão da avaliação', nat);
  await foto(page, '3-natureza-identificada', '#avpEtapas');
  await foto(page, '3b-secao-natureza', '#avpSecaoNatureza');
  afirma(/Sua justificativa/.test(await texto(page, '#avpQuestionarioCard')) && /Interpretação do sistema/.test(await texto(page, '#avpQuestionarioCard')), 'A. a fundamentação separa a justificativa da pessoa da interpretação do sistema');
  /* B. continuar: Não → não precisa; Sim → O1–O9 e volta */
  await page.check('#avpJornada_nao');
  await page.waitForSelector('#avpJornadaNaoTxt');
  afirma(/não é preciso fazer o O1–O9/.test(await texto(page, '#avpJornadaNaoTxt')) && !(await existe(page, '#avpPosicionarBtn')), 'B. sem responsabilidade organizacional própria: explica que o O1–O9 não é necessário (item 17)');
  afirma(/não é gravada e pode ser trocada/.test(await texto(page, '#avpJornadaNota')), 'B. a interface diz que a resposta só orienta a navegação (não é registrada)');
  await page.focus('#avpJornada_sim');
  await page.keyboard.press('Space');
  await page.waitForSelector('#avpPosicionarBtn');
  afirma(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'avpJornada_sim', 'B. teclado: a escolha por Espaço mantém o foco na opção');
  await page.click('#avpPosicionarBtn');
  await ate(page, (i) => location.hash === '#arquitetura?po=escolher&item=' + encodeURIComponent(i), itemNovo, 'O1–O9 da Porta 1');
  afirma(true, 'B. "Sim" leva ao Posicionamento O1–O9 deste item (Porta 1)');
  await page.goBack();
  await ate(page, () => !!document.getElementById('avpSecaoProximo'), undefined, 'volta à ficha');
  afirma(await page.evaluate(() => (document.getElementById('avpJornada_sim') || {}).checked === true) && await existe(page, '#avpPosicionarBtn'), 'B. de volta à ficha, a escolha continua (sem perder o contexto)');
  await foto(page, '4-proximo-passo-continuar', '#avpSecaoProximo');
  afirma(await larguraOk(page), 'A/B. ficha sem rolagem lateral');
  /* B. concluir por aqui → Trabalhos */
  await page.click('#avpConcluirPorAqui');
  await ate(page, (i) => location.hash === '#arquitetura?tr=1&item=' + encodeURIComponent(i), itemNovo, 'registro nos Trabalhos');
  await ate(page, () => /Identificada: Operação/.test((document.querySelector('.mf-natureza-etapa [data-ro-etapa]') || {}).textContent || ''), undefined, 'natureza na trilha');
  afirma(/Concluída/.test(await texto(page, '.mf-trilha [data-etapa="p1p16"]')) && /Disponível, se este item tiver uma responsabilidade organizacional própria/.test(await texto(page, '.mf-trilha [data-etapa="posicionamento"]')),
    'B. "Concluir por aqui": o registro mostra a avaliação concluída e o Posicionamento só como opção (item 15/18)');
  afirma(/Identificada: Operação/.test(await texto(page, '.mf-natureza-etapa')), 'B. a trilha dos Trabalhos mostra o MESMO estado da natureza que a ficha');
  /* retomar a partir dos Trabalhos: a ficha volta inteira e a pessoa pode escolher outro caminho */
  await page.click('.mf-abrir-avp');
  await ate(page, () => !!document.getElementById('avpSecaoProximo') && !!document.querySelector('#avpSecaoNatureza #roNatureza'), undefined, 'retomada pela ficha');
  await etapasSao(page, 'ok', 'atual', 'etapas na retomada');
  afirma(/identificada:\s*Operação/.test(await texto(page, '#avpSecaoNatureza #roNatureza')), 'B. retomada pelos Trabalhos: a ficha volta com a natureza e as etapas reais');
  await page.check('#avpJornada_naosei');
  await page.waitForSelector('#avpJornadaNaoSeiTxt');
  afirma(!(await existe(page, '#avpPosicionarBtn')), 'B. dá para trocar de caminho ao retomar (Ainda não sei: orientação, sem O1–O9 de cara)');
  await page.click('#avpConcluirPorAqui');
  await ate(page, (i) => location.hash === '#arquitetura?tr=1&item=' + encodeURIComponent(i), itemNovo, 'de novo no registro');
  await foto(page, '5-trabalhos-trilha', '.mf-jornada');
  await page.evaluate(() => { location.hash = '#arquitetura?tr=1'; });
  await ate(page, (i) => !!document.querySelector('.mf-linha[data-item="' + i + '"] .mf-linha-natureza .ro-etapa'), itemNovo, 'linha da lista');
  afirma(/Identificada: Operação/.test(await texto(page, '.mf-linha[data-item="' + itemNovo + '"] .mf-linha-natureza')), 'B. a linha da lista dos Trabalhos também (uma fonte só)');
  afirma(await larguraOk(page), 'Trabalhos sem rolagem lateral');
  /* I. exportações */
  await page.evaluate(() => { location.hash = '#arquitetura?av=lista'; });
  await page.waitForSelector('#avpExportarBtn');
  await page.click('#avpExportarBtn');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#avpExportarExcelTodas')]);
  const arq = arquivoTemporario('caminho1-', '.xlsx'); await dl.saveAs(arq);
  const linhas = XLSX.utils.sheet_to_json(XLSX.read(fs.readFileSync(arq), { type: 'buffer' }).Sheets.Resumo, { header: 1, defval: '' }); fs.unlinkSync(arq);
  const cab = linhas[0] || [], lin = linhas.find((l) => l.indexOf('Simulação de renda (Caminho 1)') !== -1) || [];
  const iNat = cab.indexOf('Natureza arquitetural'), iSit = cab.indexOf('Situação da identificação da natureza'), iFund = cab.indexOf('Fundamento da identificação');
  afirma(iNat > -1 && lin[iNat] === 'Operação' && lin[iSit] === 'Identificada' && /ação executada/.test(lin[iFund]), 'I. Excel: natureza, situação e fundamento', [lin[iNat], lin[iSit]]);
  await page.click('.avp-act-ver[data-key="' + novo._key + '"]');
  await page.waitForSelector('#avpGerarPdfBtn');
  await page.evaluate(() => { window.__pdfs = []; });
  await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#avpGerarPdfBtn')]);
  const pdf = (await page.evaluate(() => (window.__pdfs || []).join('\n'))).replace(/\s+/g, ' ');
  afirma(/Natureza arquitetural/.test(pdf) && /Operação/.test(pdf), 'I. PDF com a natureza identificada');
  afirma(intocadas(await banco0(page)) === antes, 'I. nada mudou na Porta 2, no Posicionamento nem na Squad (item 24)');
  afirma(!erros.length, 'A/B. sem erro de página', erros);
  await ctx.close();

  /* ---------- C + E: diretas e contradições, pela tela ---------- */
  console.log('C/E. Classificações diretas e respostas contraditórias');
  ({ ctx, page, erros } = await abrir(browser, vp, '#arquitetura?av=lista'));
  await novaAvaliacao(page, 'Aplicativo (Caminho 1)', M_CANAL);
  await fichaPronta(page);
  afirma(await existe(page, '#avpSecaoNatureza #roNatureza[data-natureza="canal"]') && !(await existe(page, '#avpSecaoNatureza #roFormNatureza')), 'C. Canal: a natureza aparece direto, sem outra identificação');
  await ate(page, () => /Canal/.test((document.querySelector('#avpEtapas [data-etapa="natureza"] .avp-etapa-det') || {}).textContent || ''), undefined, 'etapa Canal');
  afirma(true, 'C. a etapa "Natureza" mostra Canal');
  await etapasSao(page, 'ok', 'atual', 'Canal direta');
  afirma(/própria classificação/.test(await etapaNatureza(page)), 'C. natureza direta: etapa concluída ("a própria classificação") e próximo passo atual');
  await page.click('#avpVoltarListaResultado');
  await novaAvaliacao(page, 'Plano de previdência (Caminho 1)', M_PP);
  await fichaPronta(page);
  afirma(await existe(page, '#avpSecaoNatureza #roNatureza[data-natureza="produto"]'), 'C. Produto/Serviço: a natureza é a própria classificação');
  await page.click('#avpVoltarListaResultado');
  /* E. dois testes SIM */
  await novaAvaliacao(page, 'Objeto misturado (Caminho 1)', M_CONFLITO, async () => {
    afirma(await existe(page, '#avpGuiadaPontos') && /Mais de uma natureza/.test(await texto(page, '#avpGuiadaPontos')), 'E. duas naturezas: aviso na revisão, antes de concluir');
    afirma(await existe(page, '#avpPrevia[data-camada="a-validar"]') && await existe(page, '#avpPreviaAValidar'), 'E. a prévia mostra "A validar" e o que fazer, antes de concluir');
    await foto(page, '6-aviso-dois-testes', '#avpGuiadaPontos');
  });
  await fichaPronta(page);
  afirma(/A validar/.test(await texto(page, '#avpSecaoNatureza #roNatureza')) && /Próximo passo/.test(await texto(page, '#avpSecaoNatureza #roNatureza')), 'E. natureza pendente com o próximo passo (nada classificado à força)');
  await ate(page, () => /A validar/.test((document.querySelector('#avpEtapas [data-etapa="natureza"] .avp-etapa-det') || {}).textContent || ''), undefined, 'etapa pendente');
  afirma(true, 'E. a etapa "Natureza" fica pendente');
  await etapasSao(page, 'pendente', 'disponivel', 'A validar');
  const pendAV = await texto(page, '#avpResumoAntesDeEscolher [data-resumo="pendencias"]');
  afirma(/"A validar" e ainda não há decisão final/.test(pendAV) && /natureza do objeto está em aberto/.test(pendAV), 'E. "A validar": o resumo lista as duas pendências reais (classificação sem decisão e natureza em aberto)', pendAV);
  afirma(/A validar/.test(await texto(page, '#avpResumoAntesDeEscolher')), 'E. "A validar": etapa com pendência e o resumo diz o que falta (reavaliar ou decidir)');
  await foto(page, '6b-etapas-a-validar', '#avpEtapas');
  await page.click('#avpVoltarListaResultado');
  /* E. P5 × P13 */
  await page.click('#avpNovoBtn'); await page.fill('#avpfNome', 'Incoerente (Caminho 1)'); await page.click('#avpIniciarBtn'); await page.waitForSelector('#avpEtapas');
  await responder(page, M_INCOER);
  await ate(page, () => !!document.querySelector('#avpPrevia[data-camada="a-validar"]'), undefined, 'prévia A validar');
  afirma(/Autonomia \(P5\) = SIM/.test(await texto(page, '#avpGuiadaPontos')) && /P13–P16/.test(await texto(page, '#avpGuiadaPontos')), 'E. P5 × P13 apontadas como contraditórias na revisão (incoerência)');
  afirma(await existe(page, '#avpPrevia[data-camada="a-validar"]'), 'E. a prévia avisa que o resultado ficaria "A validar"');
  afirma(!erros.length, 'C/E. sem erro de página', erros);
  await ctx.close();

  /* ---------- D + F + C: fichas semeadas ---------- */
  console.log('D/F. Classificações técnicas, diretas e versões');
  ({ ctx, page, erros } = await abrir(browser, vp, '#arquitetura?avp=pProc'));
  await fichaPronta(page);
  afirma((await alternativas(page)) === 'processo,etapa,recorte,evidencia-insuficiente', 'D. Processo × Etapa', await alternativas(page));
  await identificar(page, 'evidencia-insuficiente', 'Ainda não se sabe se é o processo inteiro (teste)', 'Falta saber onde o objeto começa e termina (teste)');
  await ate(page, () => !!document.querySelector('#avpSecaoNatureza #roNatureza[data-pendencia="evidencia-insuficiente"]'), undefined, 'pendência');
  afirma(/Evidência insuficiente/.test(await texto(page, '#avpSecaoNatureza #roNatureza')) && !(await banco0(page))['objetos-natureza'].pProc.natureza, 'D. evidência insuficiente: pendência registrada, sem natureza');
  await ate(page, () => /Pendente: evidência insuficiente/.test((document.querySelector('#avpEtapas [data-etapa="natureza"] .avp-etapa-det') || {}).textContent || ''), undefined, 'etapa pendente');
  afirma(true, 'D. a etapa mostra a pendência (não chama de concluída)');
  await etapasSao(page, 'pendente', 'disponivel', 'pendência');
  afirma(true, 'D. pendência registrada: etapa "pendente", sem dizer que a natureza está concluída');
  await foto(page, '8-etapas-pendente', '#avpEtapas');
  await page.check('#avpJornada_nao');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  await ate(page, () => !!document.getElementById('avpSecaoProximo'), undefined, 'F5 com resposta momentânea');
  afirma(await page.evaluate(() => !document.querySelector('input[name="avpJornadaResp"]:checked')) && /não é gravada/.test(await texto(page, '#avpJornadaNota')), 'B. F5: a resposta momentânea some (nunca pareceu registrada) e a pessoa escolhe de novo');
  for (const [k, esperado] of [['dInf', 'informacao,documento,recorte,evidencia-insuficiente'], ['mMod', 'modalidade,subproduto,opcao,recorte,evidencia-insuficiente'], ['rReg', 'regra,opcao-reavaliar,recorte,evidencia-insuficiente']]) {
    await page.evaluate((x) => { location.hash = '#arquitetura?avp=' + x; }, k);
    await ate(page, (x) => location.hash.indexOf(x) > 0 && !!document.querySelector('#avpSecaoNatureza #roFormNatureza'), k, 'ficha ' + k);
    afirma((await alternativas(page)) === esperado, 'D. ' + k + ': alternativas da diferenciação', await alternativas(page));
  }
  await identificar(page, 'opcao-reavaliar', 'O participante escolhe entre regimes que a regra permite (teste)', 'O objeto é uma alternativa escolhida, não uma condição imposta (teste)');
  await ate(page, () => !!document.querySelector('#avpSecaoNatureza #roNatureza[data-pendencia="reavaliacao-necessaria"]'), undefined, 'reavaliação');
  afirma(/reavaliar o P1–P16/.test(await texto(page, '#avpSecaoNatureza #roNatureza')) && (await banco0(page))['avaliacoes-produto'].rReg.camadaSugerida.id === 'regra-condicao', 'D. Regra × Opção: Opção vira pendência de reavaliação; a classificação não é trocada');
  for (const [k, nt] of [['cComp', 'componente'], ['cCap', 'capacidade']]) {
    await page.evaluate((x) => { location.hash = '#arquitetura?avp=' + x; }, k);
    await ate(page, (n) => !!document.querySelector('#avpSecaoNatureza #roNatureza[data-natureza="' + n + '"]'), nt, 'direta ' + nt);
    afirma(!(await existe(page, '#avpSecaoNatureza #roFormNatureza')), 'C. ' + nt + ': natureza direta, sem identificação extra');
  }
  await page.evaluate(() => { location.hash = '#arquitetura?avp=fRea2'; });
  await ate(page, () => !!document.querySelector('#avpSecaoNatureza #roNatureza[data-motivo="NATUREZA_A_CONFIRMAR"]'), undefined, 'a confirmar');
  await ate(page, () => /A confirmar/.test((document.querySelector('#avpEtapas [data-etapa="natureza"] .avp-etapa-det') || {}).textContent || ''), undefined, 'etapa a confirmar');
  afirma(/fRea1/.test(await texto(page, '#roIdentAnterior')), 'F. reavaliação: a identificação da versão anterior fica "a confirmar", com o histórico à vista');
  await etapasSao(page, 'atual', 'disponivel', 'a confirmar');
  afirma(true, 'F. "a confirmar": a etapa Natureza fica atual (há algo a fazer)');
  /* F5 na ficha (o banco falso volta à semente a cada recarga: a ficha semeada é a prova do endereço) */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  await ate(page, () => !!document.querySelector('#avpSecaoNatureza #roNatureza[data-motivo="NATUREZA_A_CONFIRMAR"]') && !!document.getElementById('avpSecaoProximo'), undefined, 'F5');
  afirma(true, 'I. F5 na ficha: volta à mesma ficha, com a natureza e o próximo passo');
  await identificar(page, 'funcionalidade', 'Reconfirmada para a versão vigente (teste)');
  await ate(page, () => /Identificada: Funcionalidade/.test((document.querySelector('#avpEtapas [data-etapa="natureza"] .avp-etapa-det') || {}).textContent || ''), undefined, 'reconfirmada');
  afirma((await banco0(page))['objetos-natureza'].fRea.avaliacaoId === 'fRea2', 'F. reconfirmação explícita para a versão vigente');
  await etapasSao(page, 'ok', 'atual', 'reconfirmada');
  afirma(true, 'F. reconfirmada: etapa concluída, sem recarregar');
  await page.evaluate(() => { location.hash = '#arquitetura?avp=fRea1'; });
  await ate(page, () => !!document.getElementById('avpNaturezaVersaoAnterior'), undefined, 'versão anterior');
  afirma(!(await existe(page, '#avpSecaoProximo')) && await estadoEtapa(page, 'natureza') === 'futuro', 'F. versão anterior: só consulta (natureza e próximo passo ficam na vigente)');
  afirma(!erros.length, 'D/F. sem erro de página', erros);
  await ctx.close();

  /* ---------- G: registro suspenso, recusado, perfil de consulta ---------- */
  console.log('G. Registro da natureza: suspenso, recusado e sem perfil');
  ({ ctx, page, erros } = await abrir(browser, vp, '#arquitetura?avp=pProc', { marcador: false }));
  await fichaPronta(page);
  afirma(await existe(page, '#roIdentSuspensa') && !(await existe(page, '#roIdentSalvar')) && /suspenso/.test(await texto(page, '#roIdentSuspensa')), 'G. registro suspenso: a ficha explica e não oferece gravar');
  await foto(page, '7-registro-suspenso', '#roIdentSuspensa');
  await foto(page, '7b-etapas-suspenso', '#avpEtapas');
  await ate(page, () => /suspenso/.test((document.querySelector('#avpEtapas [data-etapa="natureza"] .avp-etapa-det') || {}).textContent || ''), undefined, 'etapa suspensa');
  afirma(await estadoEtapa(page, 'natureza') === 'pendente' && await estadoEtapa(page, 'proximo') === 'disponivel', 'G. registro suspenso: etapa com pendência ("registro suspenso"), sem fingir identificação; dá para concluir por aqui');
  afirma(/Processo/.test(await texto(page, '#avpSecaoNatureza #roIdentDefinicoes')) && /Concluir por aqui/.test(await texto(page, '#avpSecaoProximo')), 'G. a orientação e o resultado P1–P16 continuam disponíveis; dá para concluir por aqui');
  await ctx.close();
  ({ ctx, page, erros } = await abrir(browser, vp, '#arquitetura?avp=pProc'));
  await fichaPronta(page);
  await page.evaluate(() => { window.__CFG.fail = ['objetos-natureza']; }); /* o banco passa a recusar a gravação */
  await identificar(page, 'processo', 'Encadeamento completo (teste)');
  await ate(page, () => !!document.querySelector('#avpSecaoNatureza #roErros'), undefined, 'recusa');
  afirma(/recus|não foi possível|tente/i.test(await texto(page, '#avpSecaoNatureza #roErros')) && !(await banco0(page))['objetos-natureza'].pProc, 'G. gravação recusada: mensagem junto do formulário, nada gravado', await texto(page, '#avpSecaoNatureza #roErros'));
  await ctx.close();
  ({ ctx, page, erros } = await abrir(browser, vp, '#arquitetura?avp=pProc', { email: SJ.AVAL }));
  await fichaPronta(page);
  afirma(!(await existe(page, '#roIdentSalvar')) && /Quem identifica/.test(await texto(page, '#avpSecaoNatureza')), 'G. perfil de consulta: vê a orientação, não registra');
  await page.check('#avpJornada_sim');
  await page.waitForSelector('#avpJornadaSemPerfil');
  afirma(!(await existe(page, '#avpPosicionarBtn')), 'G. perfil de consulta: "continuar" explica quem registra o O1–O9');
  afirma(!erros.length, 'G. sem erro de página', erros);
  await ctx.close();
}

/* ---------- H: proposta editorial — versão nova, avaliação antiga preservada, motor igual ---------- */
async function editorial(browser) {
  console.log('\n######## H. Proposta editorial caminho1-ajudas-p1-p16 ########');
  const { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#arquitetura?av=lista', { email: ADM, adminGeral: true });
  await page.waitForSelector('#avpNovoBtn');
  await ate(page, () => { const s = window.faQuestionarios && window.faQuestionarios.situacaoCorrecaoEditorial('caminho1-ajudas-p1-p16'); return !!(s && s.carregada); }, undefined, 'situação da proposta');
  const sit = await page.evaluate(() => window.faQuestionarios.situacaoCorrecaoEditorial('caminho1-ajudas-p1-p16'));
  afirma(sit.ajustes.length > 20 && sit.pendentes === sit.ajustes.length && !sit.divergentes, 'H. todos os ajustes estão pendentes sobre a redação vigente (cada "de" é o texto em vigor)', [sit.pendentes, sit.ajustes.length, sit.divergentes]);
  afirma(sit.ajustes.every((a) => !/^just/.test(a.campo) && a.campo !== 'texto'), 'H. nenhuma pergunta e nenhuma interpretação automática (SIM/NÃO) mudam: só ajuda, exemplos e exemplo');
  const motorAntes = JSON.stringify((await banco0(page))['motor-arquitetura-config']);
  const velha = await novaAvaliacao(page, 'Antes da proposta (Caminho 1)', M_FUNC);
  const versaoAntes = velha.questionnaireContentVersion;
  const res = await page.evaluate(() => new Promise((ok) => window.faQuestionarios.aplicarCorrecaoEditorial('caminho1-ajudas-p1-p16', { email: 'admin.geral@previ.com.br', name: 'Admin' }, (e, r) => ok({ e, r }))));
  afirma(!res.e && res.r && res.r.novaVersao > (versaoAntes || 1), 'H. aplicada pela administração geral: versão nova do questionário', res);
  await page.click('#avpVoltarListaResultado');
  const nova = await novaAvaliacao(page, 'Depois da proposta (Caminho 1)', M_FUNC);
  afirma(nova.questionnaireContentVersion === res.r.novaVersao && nova.camadaSugerida.id === velha.camadaSugerida.id, 'H. avaliação nova usa a versão nova e o motor classifica igual (mesmas respostas, mesma classificação)');
  const db = await banco0(page);
  afirma(db['avaliacoes-produto'][velha._key].questionnaireContentVersion === versaoAntes, 'H. a avaliação anterior mantém a versão e os textos dela');
  afirma(JSON.stringify(db['motor-arquitetura-config']) === motorAntes && /"versaoPublicada":7/.test(motorAntes), 'H. regras do motor intocadas (a mesma configuração publicada, v7, antes e depois)');
  await page.click('#avpVoltarListaResultado');
  await page.waitForSelector('#avpNovoBtn');
  /* a avaliação nova é guiada (v22): a redação oficial de P1–P16 já não é a tela de resposta — a versão publicada é
     conferida no cadastro do questionário (a mesma fonte da ficha, do PDF e do questionário dos rascunhos antigos) */
  const conteudoNovo = (cod) => page.evaluate((x) => { const c = window.faQuestionarios.conteudoPergunta('CLASSIFICACAO_ARQUITETURAL', x[0], x[1]);
    return [c.textoAjuda ? [c.textoAjuda.significado, c.textoAjuda.quandoSim, c.textoAjuda.quandoNao].join(' ') : '', c.exemplo || '', (c.exemplos || []).join('; ')].join(' | '); }, [cod, res.r.novaVersao]);
  const ajudaP16 = await conteudoNovo('P16');
  afirma(/exclusivos|somente na que melhor descreve/.test(ajudaP16), 'H. a ajuda nova da P16 está publicada na versão nova');
  afirma(/condições de um regime tributário/.test(await conteudoNovo('P14')), 'H. P14: "condições de um regime tributário" (Regra), não o regime como escolha');
  const ajudaP14 = await conteudoNovo('P14');
  afirma(/escolha entre os regimes/.test(ajudaP14) && /Opção \(pergunta 13\)/.test(ajudaP14) && /Funcionalidade \(pergunta 16\)/.test(ajudaP14), 'H. P14 separa as condições do regime (Regra), a escolha entre regimes (Opção) e a tela da escolha (Funcionalidade)');
  const ajudaP12 = await conteudoNovo('P12');
  afirma(/Todo processo produz algum resultado/.test(ajudaP12) && /investiga outra coisa/.test(ajudaP12) && /A validar/.test(ajudaP12) && !/pergunta 2[^.]*é NÃO/.test(ajudaP12),
    'H. P12 distingue o resultado de um processo do resultado próprio de uma solução e diz o que acontece com SIM nas duas — sem prescrever "P2 é NÃO"');
  afirma(!erros.length, 'H. sem erro de página', erros);
  await ctx.close();
}

(async () => {
  afirma([M_FUNC, M_CANAL, M_PP, M_CONFLITO, M_INCOER].every((m) => m !== undefined), 'o motor real (regra v7) dá as respostas de cada caso (Funcionalidade, Canal, Produto/Serviço, dois testes SIM, P5 × P13)', [M_FUNC, M_CANAL, M_PP, M_CONFLITO, M_INCOER]);
  /* a orientação da P12 descreve a regra publicada como ela é (sem prescrever resposta): conferido nas 65.536 combinações */
  { const B = (c) => ORDEM.indexOf(c); const dist = (p2) => { const d = {}; for (let m = 0; m < 65536; m++) { if (((m >> 1) & 1) !== p2 || !((m >> 11) & 1)) continue; const c = camadaDe(m); d[c.id] = (d[c.id] || 0) + 1; } return d; };
    const sim = dist(1), nao = dist(0); let uva = 0; for (let m = 0; m < 65536; m++) if (((m >> 11) & 1) && camadaDe(m).id === 'unidade-valor-associada') uva++;
    afirma(B('resultado') === 1 && B('processo') === 11 && Object.keys(sim).join() === 'a-validar' && sim['a-validar'] === 16384, 'regra v7: P2 = SIM e P12 = SIM dá sempre "A validar" (16.384 combinações)', sim);
    afirma(nao['processo-etapa'] === 64, 'regra v7: com P2 = NÃO e P12 = SIM, Processo/Etapa é possível (64 combinações)', nao);
    afirma(uva === 0, 'regra v7: Unidade de valor nunca é alcançada com P12 = SIM (a precedência dela não interfere em P2 × P12)', uva); }
  const browser = await chromium.launch();
  await rodada(browser, { width: 1280, height: 900 }, 'COMPUTADOR (1280 px)');
  await rodada(browser, { width: 375, height: 740 }, 'CELULAR (375 px)');
  await editorial(browser);
  await browser.close();
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
