/* GATE P1–P16 → O1–O9 (H0) — a tela. Desktop e celular 375 px. Firebase falso em persistência real; hermético.
 * A trava do banco (base com Motor atual, também na reavaliação) é provada no emulador: seção C2 de
 * teste-rules-posicionamento.js e seção N de teste-rules-posicionamento-decisao.js; o núcleo puro, em
 * teste-gate-posicionamento-nucleo.js. Aqui, o que a pessoa vê e o que a tela deixa (ou não) gravar:
 *   1. Escolher item: item com Motor atual → "Escolher"; desatualizado, equivalente e reavaliação de P1–P16 em
 *      andamento → o motivo curto + "Ver motivo"; ponta na Lixeira não aparece; já com Posicionamento → "Abrir".
 *   2. O motivo por extenso (?po=escolher&item=…), sem botão de iniciar: desatualizado (texto exato), equivalente
 *      (reconciliar), reavaliação em andamento, ponta excluída por link direto (sem voltar para a v1); F5 mantém.
 *   3. Configuração do motor lenta: "Verificando a versão do motor…" e nenhum botão; quando chega, "Iniciar".
 *   4. A base muda com a tela aberta (P1–P16 fica desatualizada): o botão some, nada é gravado.
 *   5. Motor atual: inicia, e a avaliação aponta para a ponta da cadeia.
 *   6. Reavaliar passa pelo MESMO gate: base desatualizada → aviso e botão travado; base atual → liberado.
 *   7. Perfil "Avaliação": continua sem iniciar nem reavaliar.
 *   8. Sem rolagem horizontal; nenhum erro de JS.
 *   9. Rascunho já aberto: a base fica desatualizada (mesmo com edição em curso: o clique confere), vai para a
 *      Lixeira ou é superada por uma reavaliação de P1–P16 → Concluir travado com o motivo, o rascunho intacto e
 *      ainda salvável; base nova e válida não substitui a do rascunho em silêncio; voltando a ficar atual, conclui.
 * FA_PRINTS_DIR (opcional): salva os prints dos estados. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const PRINTS = process.env.FA_PRINTS_DIR || null;
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const M = require(path.join(RAIZ, 'motor-posicionamento.js'));
const MOTOR_PRODUTO = require('./montar-regras-posicionamento.js').MOTOR_PRODUTO;
/* as regras de fábrica do motor de Produto/Serviço: a versão publicada 2 é IGUAL a elas, então a 1 é equivalente */
const PADRAO_REGRAS = (() => {
  const c = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error };
  c.window = c; c.firebase = { database: () => ({ ref: () => ({ on() {}, once() { return Promise.resolve({ val: () => null }); } }) }) };
  vm.createContext(c); vm.runInContext(fs.readFileSync(path.join(RAIZ, 'motor-arquitetura.js'), 'utf8'), c);
  return JSON.parse(JSON.stringify(c.faMotorArquitetura.PADRAO_REGRAS.regras));
})();
const ARQ = 'arquitetura@previ.com.br';
const AVAL = 'avaliacao@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };
const QUANDO = '2026-10-01T09:00:00.000Z';
const VELHO = '2000.01.01-1';

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

const ORDEM_P = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao',
  'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
function respostasProduto() {
  const r = {};
  ORDEM_P.forEach((q, i) => { r[q] = { valor: 'sim', justificativaAuto: 'interpretação', codigoPergunta: 'P' + (i + 1), textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 }; });
  return r;
}
/* Motor atual = MOTOR_VERSION de hoje + versão 2 das regras (a publicada nesta semente) */
function produto(itemId, nome, extra) {
  return Object.assign({ itemId, nome, descricao: '', publico: '', necessidade: '', observacoesGerais: '', status: 'concluido', resultadoAutomatico: 'produto', decisaoFinal: 'produto', camadaSugerida: { id: 'produto-principal', label: 'Produto/Serviço principal' },
    respostas: respostasProduto(), justificativaAutomatica: 'justificativa', criteriosEssenciaisFalhos: [], criteriosAtendidos: 5, motorVersion: MOTOR_PRODUTO, motorVersionArquitetura: 2, questionnaireContentVersion: 1,
    excluido: false, criadoEm: QUANDO, atualizadoEm: QUANDO, versao: 1, responsavel: { name: 'Fulana', email: 'f@previ.com.br' } }, extra || {});
}
const outra = { name: 'Outra', email: 'o@previ.com.br' };
function concluida(itemId, itemNome, respostas) {
  const res = M.avaliar(respostas, {}), ra = {};
  Object.keys(res).forEach((k) => { const v = res[k]; if (v !== null && !(Array.isArray(v) && !v.length)) ra[k] = v; });
  const reg = { itemId, itemNome, avaliacaoArquiteturalId: itemId, questionarioCodigo: 'POSICIONAMENTO_ORGANIZACIONAL', questionnaireContentVersion: 1, versao: 1, status: 'concluido', revisao: 2,
    respostas: {}, resultadoAutomatico: ra, criadoPor: outra, criadoEm: QUANDO, atualizadoPor: outra, atualizadoEm: QUANDO, concluidoPor: outra, concluidoEm: QUANDO,
    auditoriaCriacaoId: 'ac' + itemId, auditoriaConclusaoId: 'az' + itemId };
  Object.keys(respostas).forEach((q) => { reg.respostas[q] = { resposta: respostas[q], codigoPergunta: q, questionnaireContentVersion: 1, dataResposta: QUANDO }; });
  return reg;
}
/* rascunho completo (pronto para concluir) aberto sobre a base itemId */
function rascunhoAberto(itemId, itemNome, respostas) {
  const reg = { itemId, itemNome, avaliacaoArquiteturalId: itemId, questionarioCodigo: 'POSICIONAMENTO_ORGANIZACIONAL', questionnaireContentVersion: 1, versao: 1, status: 'rascunho', revisao: 1,
    respostas: {}, criadoPor: outra, criadoEm: QUANDO, atualizadoPor: outra, atualizadoEm: QUANDO, auditoriaCriacaoId: 'ac' + itemId };
  Object.keys(respostas).forEach((q) => { reg.respostas[q] = { resposta: respostas[q], codigoPergunta: q, questionnaireContentVersion: 1, dataResposta: QUANDO }; });
  return reg;
}
function semente(email) {
  const aut = {}; aut[chave(ARQ)] = { email: ARQ, tipo: 'avaliacao-arquitetura' }; aut[chave(AVAL)] = { email: AVAL, tipo: 'avaliacao' };
  const users = {}; users[chave(email)] = { name: 'Pessoa', email, area: 'INFOR' };
  const conceitos = {}, fontes = {};
  M.CODIGOS_FIRMES.concat(['LINHA', 'PLATAFORMA']).forEach((c, i) => {
    conceitos[c] = { nome: 'Tx ' + c, ordem: i + 1, ativo: true, situacaoDefinicao: 'registrada', camada: 'A', definicaoVigenteFonteId: 'f1' };
    fontes[c] = { f1: { texto: 'Definição de ' + c, contexto: 'PREVI', situacao: 'vigente', tipoRedacao: 'Conceito' } };
  });
  const AE = { O1: 'NAO', O2: 'SIM', O3: 'NAO' };
  return {
    'fa-users': users, 'fa-admins': {}, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {},
    'fa-avaliacao-autorizados': aut, 'avaliacoes-squad': {}, 'motor-squad-config': {},
    'motor-arquitetura-config': { versaoPublicada: 2, versoes: { 2: { regras: PADRAO_REGRAS, publicadoEm: QUANDO, publicadoPor: outra } } },
    'avaliacoes-produto': {
      pA: produto('pA', 'Item Atual'),
      pB: produto('pB', 'Item Corrida'),
      pD: produto('pD', 'Item Desatualizado', { motorVersion: VELHO }),
      pE: produto('pE', 'Item Equivalente', { motorVersionArquitetura: 1 }),
      /* v1 concluída + v2 (reavaliação de P1–P16) em rascunho */
      pR: produto('pR', 'Item Reavaliando'), pRv2: produto('pR', 'Item Reavaliando', { versao: 2, versaoAnteriorKey: 'pR', status: 'rascunho' }),
      /* v1 concluída + v2 concluída e depois excluída: a ponta está na Lixeira */
      pX: produto('pX', 'Item Lixeira'), pXv2: produto('pX', 'Item Lixeira', { versao: 2, versaoAnteriorKey: 'pX', excluido: true }),
      /* v1 + v2 concluídas: a base é a v2 */
      pC: produto('pC', 'Item Cadeia'), pCv2: produto('pC', 'Item Cadeia', { versao: 2, versaoAnteriorKey: 'pC' }),
      pV: produto('pV', 'Item Vigente'),
      pW: produto('pW', 'Item Base Velha', { motorVersion: VELHO }),
      /* rascunhos de Posicionamento já abertos sobre bases atuais: a base muda durante o teste */
      pK: produto('pK', 'Item Rascunho K'), pL: produto('pL', 'Item Rascunho L'), pM: produto('pM', 'Item Rascunho M')
    },
    'avaliacoes-posicionamento': { gV: concluida('pV', 'Item Vigente', AE), gW: concluida('pW', 'Item Base Velha', AE),
      rK: rascunhoAberto('pK', 'Item Rascunho K', AE), rL: rascunhoAberto('pL', 'Item Rascunho L', AE), rM: rascunhoAberto('pM', 'Item Rascunho M', AE) },
    'posicionamento-vigente-por-item': { pV: 'gV', pW: 'gW' },
    'posicionamento-rascunho-por-item': { pK: 'rK', pL: 'rL', pM: 'rM' }, 'posicionamento-decisoes': {}, 'posicionamento-auditoria': {},
    taxonomia: { organizacional: { conceitos, fontes } }
  };
}
async function abrir(browser, viewport, opts) {
  opts = opts || {};
  const email = opts.email || ARQ;
  const cfg = { db: semente(email), user: { email, emailVerified: true, uid: 'u-' + chave(email) }, delayDefault: 10, persistenciaReal: true, delays: opts.delays || {}, fail: [] };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';' +
    'try { var g = sessionStorage.getItem("__poBanco"); if (g) { window.__CFG.db = JSON.parse(g); sessionStorage.removeItem("__poBanco"); }' +
    ' var c = Number(sessionStorage.getItem("__poCargas") || 0) + 1; sessionStorage.setItem("__poCargas", String(c)); window.__CFG.pushSeqInicial = c * 1000; } catch (e) {}');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + (opts.hash || '#avaliacoes?po=escolher'), { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
async function f5(page) {
  await page.evaluate(() => sessionStorage.setItem('__poBanco', JSON.stringify(window.__CFG.__dbReal)));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
const existe = (page, sel) => page.evaluate((s) => !!document.querySelector(s), sel);
const ir = (page, h) => page.evaluate((x) => { location.hash = x; }, h);
const gate = (page) => page.evaluate(() => { const e = document.querySelector('#avaliacoesPosicionamento #poGate'); return e ? { sit: e.dataset.gate, txt: e.innerText } : null; });
async function esperarGate(page, sit) {
  await esperarCondicao(page, (s) => { const e = document.querySelector('#avaliacoesPosicionamento #poGate'); return !!e && e.dataset.gate === s; }, sit, { descricao: 'o aviso do gate "' + sit + '"' });
}
/* print do pedaço que importa (no celular o cabeçalho ocupa a primeira tela inteira) */
async function print(page, nome, sufixo, alvo) {
  if (!PRINTS) return;
  if (alvo === 'ficha' || alvo === 'rascunho') { /* o aviso e os botões logo abaixo dele */
    const baixo = alvo === 'ficha' ? '#avaliacoesPosicionamento .po-ficha-acoes' : '#avaliacoesPosicionamento #poDescartarBtn';
    await page.locator(baixo).scrollIntoViewIfNeeded();
    const r = await page.evaluate((sb) => { const a = document.querySelector('#avaliacoesPosicionamento #poGate').getBoundingClientRect(), b = document.querySelector(sb).getBoundingClientRect();
      const y = Math.max(0, a.top - 60); return { x: 0, y, width: window.innerWidth, height: Math.min(window.innerHeight, b.bottom + 20) - y }; }, baixo);
    await page.screenshot({ path: path.join(PRINTS, 'gate-' + nome + '-' + sufixo + '.png'), clip: r });
    return;
  }
  await page.locator(alvo || '#avaliacoesPosicionamento #poEscolher').screenshot({ path: path.join(PRINTS, 'gate-' + nome + '-' + sufixo + '.png') });
}
const posicionamentosDo = (db, item) => Object.values(db['avaliacoes-posicionamento'] || {}).filter((a) => a.itemId === item);

const TXT_DESAT = 'Motor da Avaliação de Produto/Serviço desatualizado. Atualize P1–P16 antes de iniciar o Posicionamento Organizacional.';
const TXT_VERIF = 'Verificando a versão do motor da Avaliação de Produto/Serviço…';

async function fluxo(browser, nomeTela, viewport) {
  console.log('\n######## ' + nomeTela + ' ########');
  const sufixo = viewport.width < 641 ? '375' : 'desktop';
  const { ctx, page, erros } = await abrir(browser, viewport);

  console.log('\n== 1. Escolher item: cada um com o seu gate ==');
  await page.waitForSelector('#avaliacoesPosicionamento #poEscolher');
  await esperarCondicao(page, () => {
    const d = document.querySelector('.po-item-opcao[data-item="pD"]'), a = document.querySelector('.po-item-opcao[data-item="pA"]');
    return !!d && d.dataset.gate === 'desatualizado' && !!a && a.dataset.gate === 'atual';
  }, null, { descricao: 'as opções chegarem com o motor carregado' });
  const op = await page.evaluate(() => Array.from(document.querySelectorAll('.po-item-opcao')).reduce((o, e) => { o[e.dataset.item] = { gate: e.dataset.gate, txt: e.innerText }; return o; }, {}));
  afirma(op.pA && op.pA.gate === 'atual' && /Escolher/i.test(op.pA.txt) && !/Ver motivo/i.test(op.pA.txt), 'Motor atual: "Escolher"');
  afirma(op.pD && /Motor de P1–P16 desatualizado/.test(op.pD.txt) && /Ver motivo/i.test(op.pD.txt), 'desatualizado: o motivo curto + "Ver motivo"', op.pD && op.pD.txt);
  afirma(op.pE && op.pE.gate === 'equivalente' && /P1–P16 a reconciliar/.test(op.pE.txt), 'equivalente: bloqueado ("a reconciliar")', op.pE && op.pE.txt);
  afirma(op.pR && op.pR.gate === 'reavaliacao-em-andamento' && /Reavaliação de P1–P16 em andamento/.test(op.pR.txt), 'v1 concluída + v2 em rascunho: bloqueado, não usa a v1', op.pR && op.pR.txt);
  afirma(!op.pX, 'ponta na Lixeira de Produto/Serviço: o item não aparece (nem pela v1)');
  afirma(op.pC && op.pC.gate === 'atual', 'v1 + v2 concluídas: liberado (pela v2)');
  afirma(op.pV && /Abrir/i.test(op.pV.txt) && op.pW && /Abrir/i.test(op.pW.txt), 'item já com Posicionamento: "Abrir", qualquer que seja o gate');
  afirma(await larguraOk(page), 'sem rolagem horizontal (lista de itens)');
  await print(page, 'lista', sufixo);

  console.log('\n== 2. O motivo por extenso, sem botão de iniciar ==');
  await page.click('.po-item-opcao[data-item="pD"] .po-item-escolher');
  await esperarGate(page, 'desatualizado');
  let gt = await gate(page);
  afirma(gt.txt === TXT_DESAT, 'desatualizado: texto exato', gt.txt);
  afirma(!(await existe(page, '#poIniciarBtn')), 'desatualizado: nenhum botão de iniciar');
  afirma(await larguraOk(page), 'sem rolagem horizontal (motivo)');
  await print(page, 'desatualizado', sufixo);
  await f5(page);
  await esperarGate(page, 'desatualizado');
  afirma(!(await existe(page, '#poIniciarBtn')), 'F5 em ?item=pD: o bloqueio continua (depois de verificar o motor)');
  await ir(page, '#avaliacoes?po=escolher&item=pE');
  await esperarGate(page, 'equivalente');
  gt = await gate(page);
  afirma(/logicamente equivalente/.test(gt.txt) && /Reconcilie-a em Produto\/Serviço/.test(gt.txt) && !(await existe(page, '#poIniciarBtn')), 'equivalente: explica e pede para reconciliar; sem iniciar', gt.txt);
  await print(page, 'equivalente', sufixo);
  await ir(page, '#avaliacoes?po=escolher&item=pR');
  await esperarGate(page, 'reavaliacao-em-andamento');
  gt = await gate(page);
  afirma(/versão mais nova/.test(gt.txt) && /Conclua ou resolva/.test(gt.txt) && !(await existe(page, '#poIniciarBtn')), 'reavaliação de P1–P16 em andamento: explica; sem iniciar', gt.txt);
  await print(page, 'reavaliacao-produto', sufixo);
  await ir(page, '#avaliacoes?po=escolher&item=pX');
  await esperarGate(page, 'excluida');
  afirma(/excluída/.test((await gate(page)).txt) && !(await existe(page, '#poIniciarBtn')), 'link direto para item com a ponta excluída: bloqueado, sem voltar para a v1');

  console.log('\n== 4. A base fica desatualizada com a tela aberta ==');
  await ir(page, '#avaliacoes?po=escolher&item=pB');
  await page.waitForSelector('#avaliacoesPosicionamento #poIniciarBtn');
  await page.evaluate((v) => firebase.database().ref('avaliacoes-produto/pB/motorVersion').set(v), VELHO);
  await esperarGate(page, 'desatualizado');
  afirma(!(await existe(page, '#poIniciarBtn')), 'P1–P16 ficou desatualizada: o botão de iniciar some');
  afirma(posicionamentosDo(await banco(page), 'pB').length === 0, '…e nada foi gravado para o item');

  console.log('\n== 5. Motor atual: inicia sobre a ponta da cadeia ==');
  await ir(page, '#avaliacoes?po=escolher&item=pC');
  await page.waitForSelector('#avaliacoesPosicionamento #poIniciarBtn');
  afirma(!(await gate(page)), 'Motor atual: nenhum aviso de bloqueio');
  await page.click('#poIniciarBtn');
  await page.waitForSelector('#avaliacoesPosicionamento #poChecklist');
  const criadas = posicionamentosDo(await banco(page), 'pC');
  afirma(criadas.length === 1 && criadas[0].avaliacaoArquiteturalId === 'pCv2', 'criada apontando para a v2 de Produto/Serviço (a ponta)', JSON.stringify(criadas.map((c) => c.avaliacaoArquiteturalId)));

  console.log('\n== 6. Reavaliar passa pelo mesmo gate ==');
  await ir(page, '#avaliacoes?po=gW');
  await page.waitForSelector('#avaliacoesPosicionamento #poReavaliarBtn');
  await esperarGate(page, 'desatualizado');
  gt = await gate(page);
  afirma(/Atualize P1–P16 antes de reavaliar o Posicionamento Organizacional\./.test(gt.txt), 'base desatualizada: o aviso diz "antes de reavaliar"', gt.txt);
  afirma(await page.locator('#poReavaliarBtn').isDisabled(), '…e o botão Reavaliar fica travado');
  afirma(await larguraOk(page), 'sem rolagem horizontal (ficha)');
  await print(page, 'reavaliar-bloqueado', sufixo, 'ficha');
  await ir(page, '#avaliacoes?po=gV');
  await page.waitForSelector('#avaliacoesPosicionamento #poReavaliarBtn:not([disabled])');
  afirma(!(await gate(page)), 'base com Motor atual: Reavaliar liberado, sem aviso');

  console.log('\n== 9. Rascunho já aberto: o gate vale de novo na conclusão ==');
  const set = (cam, v) => page.evaluate(([c, x]) => firebase.database().ref(c).set(x), [cam, v]);
  const statusDe = async (k) => ((await banco(page))['avaliacoes-posicionamento'][k] || {}).status;
  const concluirTravado = () => page.locator('#poConcluirBtn').isDisabled();
  /* K — base fica desatualizada ENQUANTO a pessoa edita (a tela não redesenha com edição em curso): o clique confere */
  await ir(page, '#avaliacoes?po=rK');
  await page.waitForSelector('#avaliacoesPosicionamento #poConcluirBtn:not([disabled])');
  afirma(!(await gate(page)), 'base atual: Concluir habilitado, sem aviso');
  await page.fill('#avaliacoesPosicionamento .po-obs[data-q="O2"]', 'nota em edição');
  await set('avaliacoes-produto/pK/motorVersion', VELHO);
  await page.waitForTimeout(400);
  await page.click('#poConcluirBtn');
  await page.waitForSelector('.po-modal');
  afirma(/Atualize P1–P16 antes de concluir o Posicionamento Organizacional\./.test(await texto(page, '.po-modal')), 'clique em Concluir com a base já desatualizada: aviso "antes de concluir"', await texto(page, '.po-modal'));
  await page.click('.po-modal .po-modal-sim');
  afirma((await statusDe('rK')) === 'rascunho', '…e nada foi concluído: o rascunho continua salvo');
  await esperarGate(page, 'desatualizado');
  afirma(await concluirTravado(), '…o aviso fica na tela e Concluir fica travado');
  afirma(!(await page.locator('#poSalvarBtn').isDisabled()) && !(await page.locator('#poDescartarBtn').isDisabled()), '…mas salvar e descartar continuam possíveis');
  await print(page, 'concluir-bloqueado', sufixo, 'rascunho');
  /* volta a ficar atual → conclui normalmente */
  await set('avaliacoes-produto/pK/motorVersion', MOTOR_PRODUTO);
  /* com edição em curso a tela não redesenha sozinha: salvar o rascunho redesenha com a base de agora */
  await page.click('#poSalvarBtn');
  await page.waitForSelector('#avaliacoesPosicionamento #poConcluirBtn:not([disabled])');
  afirma(((await banco(page))['avaliacoes-posicionamento'].rK.respostas.O2 || {}).observacao === 'nota em edição', 'o rascunho salvou a edição (nada se perdeu com o bloqueio)');
  afirma(!(await gate(page)), 'base atualizada de novo: o aviso some');
  await page.click('#poConcluirBtn');
  await page.waitForSelector('#avaliacoesPosicionamento #poResultado');
  afirma((await statusDe('rK')) === 'concluido', 'tudo atual: conclui normalmente');
  /* L — a avaliação P1–P16 vinculada vai para a Lixeira */
  await ir(page, '#avaliacoes?po=rL');
  await page.waitForSelector('#avaliacoesPosicionamento #poConcluirBtn:not([disabled])');
  await set('avaliacoes-produto/pL/excluido', true);
  await esperarGate(page, 'excluida');
  afirma(await concluirTravado() && (await statusDe('rL')) === 'rascunho', 'base excluída: Concluir travado, rascunho intacto');
  /* M — a ponta da cadeia muda por reavaliação de P1–P16 */
  await ir(page, '#avaliacoes?po=rM');
  await page.waitForSelector('#avaliacoesPosicionamento #poConcluirBtn:not([disabled])');
  await page.evaluate((p) => firebase.database().ref('avaliacoes-produto/pMv2').set(p), produto('pM', 'Item Rascunho M', { versao: 2, versaoAnteriorKey: 'pM', status: 'rascunho' }));
  await esperarGate(page, 'reavaliacao-em-andamento');
  afirma(await concluirTravado(), 'reavaliação de P1–P16 em andamento: Concluir travado');
  await set('avaliacoes-produto/pMv2/status', 'concluido');
  await esperarGate(page, 'base-mudou');
  gt = await gate(page);
  afirma(/não é a usada neste rascunho/.test(gt.txt) && await concluirTravado(), 'reavaliação de P1–P16 concluída (base nova, válida): bloqueia e orienta, sem trocar a base em silêncio', gt.txt);
  const rM = (await banco(page))['avaliacoes-posicionamento'].rM;
  afirma(rM.status === 'rascunho' && rM.avaliacaoArquiteturalId === 'pM', '…o rascunho continua apontando para a base dele (pM)');
  afirma(await larguraOk(page), 'sem rolagem horizontal (rascunho bloqueado)');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();

  console.log('\n== 3. Configuração do motor lenta: "Verificando…" ==');
  const lenta = await abrir(browser, viewport, { hash: '#avaliacoes?po=escolher&item=pA', delays: { 'motor-arquitetura-config': 3000 } });
  await esperarGate(lenta.page, 'verificando');
  gt = await gate(lenta.page);
  afirma(gt.txt === TXT_VERIF, 'enquanto o motor não chega: texto exato', gt.txt);
  afirma(!(await existe(lenta.page, '#poIniciarBtn')), '…e nenhum botão de iniciar ("não sei ainda" nunca é "atual")');
  await print(lenta.page, 'verificando', sufixo);
  await lenta.page.waitForSelector('#avaliacoesPosicionamento #poIniciarBtn', { timeout: 15000 });
  afirma(!(await gate(lenta.page)), 'quando o motor chega: "Iniciar avaliação", sem aviso');
  afirma(!lenta.erros.length, 'nenhum erro de JS (rede lenta)', lenta.erros.join(' | '));
  await lenta.ctx.close();

  console.log('\n== 7. Perfil "Avaliação": continua sem iniciar nem reavaliar ==');
  const av = await abrir(browser, viewport, { email: AVAL });
  await av.page.waitForSelector('#avaliacoesPosicionamento #poSemPermissao');
  afirma(true, '"Avaliação" em Escolher item: só consulta');
  await ir(av.page, '#avaliacoes?po=gV');
  await av.page.waitForSelector('#avaliacoesPosicionamento #poBlocoDecisao');
  afirma(!(await existe(av.page, '#poReavaliarBtn')) && !(await gate(av.page)), '"Avaliação" na ficha: sem Reavaliar e sem aviso de gate');
  afirma(!av.erros.length, 'nenhum erro de JS (Avaliação)', av.erros.join(' | '));
  await av.ctx.close();
}

(async () => {
  if (PRINTS) fs.mkdirSync(PRINTS, { recursive: true });
  const browser = await chromium.launch();
  try {
    await fluxo(browser, 'DESKTOP', DESKTOP);
    await fluxo(browser, 'CELULAR 375px', CELULAR);
  } catch (e) { console.error(e); falhas++; }
  await browser.close();
  console.log('\n' + (falhas ? falhas + ' falha(s).' : 'Tudo certo.'));
  process.exit(falhas ? 1 : 0);
})();
