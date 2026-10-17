/* I2 — Posicionamento Organizacional × Adequação à Squad, na tela. Desktop e celular 375 px; Firebase falso em
 * persistência real; hermético. A Adequação à Squad (S1–S8) NÃO depende do O1–O9: o Posicionamento vigente aparece só como
 * informação e a origem dele fica registrada na criação (rastreabilidade). A antiga Exigência de Posicionamento
 * (posicionamento-config/exigirParaSquad) foi retirada por decisão da responsável (2026-10-17); as regras do banco são
 * provadas no emulador por teste-rules-squad-liberacao.js. Aqui:
 *   1. Informação contextual: liberado (recomendação automática), Área Especializada (não formada por Squads), item novo
 *      (sem Posicionamento) — sem bloqueio; a criação grava a origem da liberação (situação, avaliação, código, origem).
 *   2. Independência: com um interruptor ANTIGO gravado como ligado, nada muda — item não liberado (decisão final CoE),
 *      item novo e rascunho anterior avaliam normalmente; a origem continua registrada.
 *   3. Rede lenta e leitura recusada: "Verificando…" e "Não foi possível verificar" só informam (nada travado); recusada,
 *      a origem fica "nao-verificado" (nunca "liberado"); a leitura do interruptor antigo falhando não muda nada.
 *   4. Atalho na ficha do Posicionamento: "Avaliar Adequação à Squad" só no item liberado; não duplica.
 *   5. ADMIN › Motor de Squad: sem o controle da exigência; o histórico dele continua no banco. Sem rolagem horizontal;
 *      sem erro de JS. */
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
const M = require(path.join(RAIZ, 'motor-posicionamento.js'));
const PADRAO_REGRAS = (() => {
  const c = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error };
  c.window = c; c.firebase = { database: () => ({ ref: () => ({ on() {}, once() { return Promise.resolve({ val: () => null }); } }) }) };
  vm.createContext(c); vm.runInContext(fs.readFileSync(path.join(RAIZ, 'motor-arquitetura.js'), 'utf8'), c);
  return JSON.parse(JSON.stringify(c.faMotorArquitetura.PADRAO_REGRAS.regras));
})();
const ARQ = 'arquitetura@previ.com.br', ADM = 'tatianefdirene@previ.com.br';
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
/* avaliação de Posicionamento CONCLUÍDA com o resultado exato do motor v1 */
function concluida(itemId, itemNome, respostas, diag) {
  const reg = { itemId, itemNome, avaliacaoArquiteturalId: itemId, questionarioCodigo: QCOD, questionnaireContentVersion: 1, versao: 1, status: 'concluido', revisao: 2,
    respostas: {}, criadoPor: outra, criadoEm: QUANDO, atualizadoPor: outra, atualizadoEm: QUANDO, auditoriaCriacaoId: 'ac' + itemId, concluidoPor: outra, concluidoEm: QUANDO, auditoriaConclusaoId: 'az' + itemId };
  Object.keys(respostas).forEach((q) => { reg.respostas[q] = { resposta: respostas[q], codigoPergunta: q, questionnaireContentVersion: 1, dataResposta: QUANDO, textoPerguntaNaEpoca: 'Texto de ' + q }; });
  if (diag) reg.diagnosticos = { N1: { resposta: diag, papeis: ['AREA_ESPECIALIZADA', 'COE'], textoPerguntaNaEpoca: 'Diagnóstico', questionnaireContentVersion: 1 } };
  const res = M.avaliar(respostas, diag ? { N1: diag } : {}), ra = {};
  Object.keys(res).forEach((k) => { const v = res[k]; if (v !== null && !(Array.isArray(v) && !v.length)) ra[k] = v; });
  reg.resultadoAutomatico = ra;
  return reg;
}
const NEG = { O1: 'SIM', O2: 'NAO', O3: 'NAO', O4: 'NAO', O5: 'SIM' }, AE = { O1: 'NAO', O2: 'SIM', O3: 'NAO' }, CONF = { O1: 'NAO', O2: 'SIM', O3: 'SIM' };
function decisao(itemId, codigoAuto, codigoFinal, tipo) {
  return { itemId, versaoAvaliacao: 1, versaoMotor: 1, codigoAutomatico: codigoAuto, codigoFinal, tipoDecisao: tipo, justificativa: 'Decidido.',
    nomeNaDecisao: { nome: 'Tx ' + codigoFinal, contingencia: false }, liberaSquad: M.liberaSquadParaCodigoFirme(codigoFinal), decididoPor: outra, decididoEm: QUANDO, auditoriaId: 'ad' + itemId };
}
function semente(o) {
  o = o || {};
  const aut = {}; aut[chave(ARQ)] = { email: ARQ, tipo: 'avaliacao-arquitetura' };
  const users = {}; users[chave(ARQ)] = { name: 'Pessoa', email: ARQ, area: 'INFOR' }; users[chave(ADM)] = { name: 'Admin', email: ADM, area: 'INFOR' };
  const conceitos = {}, fontes = {};
  ['AREA_ESPECIALIZADA', 'COE', 'ESTRATEGIA_CLIENTES', 'NEGOCIOS', 'PLATAFORMA_CANAIS', 'PLATAFORMA_HABILITADORA_NEGOCIOS', 'PLATAFORMA_HABILITADORA_TECNOLOGIA', 'PLATAFORMA_CORPORATIVA', 'LINHA', 'PLATAFORMA'].forEach((c, i) => {
    conceitos[c] = { nome: 'Tx ' + c, ordem: i + 1, ativo: true, camada: 'A', definicao: { texto: 'Definição de ' + c, versao: 1, publicadaEm: '2026-10-01T09:00:00.000Z', publicadaPor: 'semente@teste' } };
  });
  const db = {
    'fa-users': users, 'fa-admins': {}, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {},
    'fa-avaliacao-autorizados': aut, 'avaliacoes-squad': o.squad || {}, 'motor-squad-config': {}, 'questionarios-config': {},
    'motor-arquitetura-config': { versaoPublicada: 2, versoes: { 2: { regras: PADRAO_REGRAS, publicadoEm: QUANDO, publicadoPor: outra } } },
    'avaliacoes-produto': { pL: produto('pL', 'Item Linha'), pAE: produto('pAE', 'Item Área'), pAV: produto('pAV', 'Item A validar'), pDiv: produto('pDiv', 'Item Divergente') },
    'avaliacoes-posicionamento': { gL: concluida('pL', 'Item Linha', NEG), gAE: concluida('pAE', 'Item Área', AE), gAV: concluida('pAV', 'Item A validar', CONF, 'mesma'), gDiv: concluida('pDiv', 'Item Divergente', NEG) },
    'posicionamento-rascunho-por-item': {}, 'posicionamento-vigente-por-item': { pL: 'gL', pAE: 'gAE', pAV: 'gAV', pDiv: 'gDiv' },
    'posicionamento-decisoes': { gAV: decisao('pAV', 'A_VALIDAR', 'PLATAFORMA_CANAIS', 'RESOLUCAO_A_VALIDAR'), gDiv: decisao('pDiv', 'NEGOCIOS', 'COE', 'DIVERGENCIA') },
    'posicionamento-auditoria': {},
    taxonomia: { organizacional: { conceitos, fontes } }
  };
  /* o interruptor ANTIGO (retirado): gravado só para provar que não muda mais nada, e que o histórico fica */
  if (o.exigir !== undefined) {
    db['posicionamento-config'] = { exigirParaSquad: o.exigir, alteradoEm: 1760000000000, alteradoPor: { uid: 'u-adm', email: ADM }, motivo: 'Decisão da área', auditoriaId: 'cfg1' };
    db['posicionamento-config-auditoria'] = { cfg1: { exigirParaSquad: o.exigir, anterior: false, motivo: 'Decisão da área', usuario: { uid: 'u-adm', email: ADM }, dataHora: 1760000000000 } };
  }
  return db;
}
let seq = 0;
async function abrir(browser, viewport, hash, db, email, extraCfg) {
  email = email || ARQ;
  const cfg = Object.assign({ db, user: { email, emailVerified: true, uid: 'u-' + chave(email) }, uidDoUsuario: true, prefixoChave: 'k' + (++seq) + 'x', delayDefault: 10, persistenciaReal: true, delays: {}, fail: [] }, extraCfg || {});
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
const texto = (page, sel) => page.locator(sel).innerText();
const squadsDe = (db, itemId) => Object.entries(db['avaliacoes-squad'] || {}).filter(([, v]) => v.itemId === itemId);

/* abre a Squad, "+ Nova", item já cadastrado, escolhe pelo nome */
async function escolherItem(page, nome) {
  await page.waitForSelector('#avpInicio');
  await page.evaluate(() => { location.hash = '#arquitetura?sq=lista'; }); /* a lista da Squad (no Início, fica em Trabalhos de avaliação) */
  await page.waitForSelector('#avaliacoesSquad #sqNovaBtn');
  await page.click('#sqNovaBtn');
  await page.click('#sqfEscolhaExistente');
  await page.fill('#sqfBusca', nome);
  await page.waitForSelector('.sq-busca-item:not(.sq-busca-item--vazio)');
  const chip = await page.locator('.sq-busca-item').first().locator('.sq-busca-item-posic').innerText();
  await page.locator('.sq-busca-item').first().click();
  await page.waitForSelector('#sqPosicionamento');
  return chip;
}
async function esperarAviso(page, re) {
  await esperarCondicao(page, (r) => new RegExp(r).test((document.getElementById('sqPosicionamento') || {}).textContent || ''), re.source, { limite: 10000 });
}
async function salvarRascunho(page) {
  await page.click('.sq-choice-group[data-codigo="S1"] .sq-choice-btn[data-valor="sim"]');
  await page.click('#sqSalvarRascunhoBtn');
  await page.waitForSelector('#sqFlashLista');
}

async function desligada(browser, viewport, rotulo) {
  console.log('\n[' + rotulo + '] 1. informação contextual, sem bloqueio; a origem fica gravada na criação');
  let { ctx, page, erros } = await abrir(browser, viewport, '#arquitetura', semente());
  const chip = await escolherItem(page, 'Item Linha');
  afirma(/Squad liberada pelo Posicionamento/.test(chip), 'a busca de item mostra a situação do Posicionamento ("Squad liberada…")', chip);
  await esperarAviso(page, /liberada/);
  const av = await texto(page, '#sqPosicionamento');
  afirma(/Tx NEGOCIOS/.test(av) && /recomendação automática/.test(av) && /está liberada/.test(av), 'aviso: Posicionamento vigente (nome da Taxonomia), recomendação automática, liberada', av);
  afirma(await page.locator('#sqPosicBloqueio').count() === 0 && !(await page.locator('#sqSalvarRascunhoBtn').isDisabled()), 'sem bloqueio');
  await salvarRascunho(page);
  let db = await banco(page), [[, sL]] = squadsDe(db, 'pL');
  afirma(sL.origemLiberacao && sL.origemLiberacao.situacao === 'liberado' && sL.origemLiberacao.liberaSquad === true && sL.origemLiberacao.avaliacaoPosicionamentoId === 'gL' &&
    sL.origemLiberacao.codigo === 'NEGOCIOS' && sL.origemLiberacao.origem === 'recomendacao' && typeof sL.origemLiberacao.registradoEm === 'string', 'criação grava a origem da liberação (gL, Negócios, recomendação)', JSON.stringify(sL.origemLiberacao));
  afirma(JSON.stringify(db['avaliacoes-posicionamento']) === JSON.stringify(semente()['avaliacoes-posicionamento']), 'nenhuma avaliação de Posicionamento mudou');
  await page.click('#sqNovaBtn');
  await page.click('#sqfEscolhaExistente');
  await page.fill('#sqfBusca', 'Item Área');
  await page.locator('.sq-busca-item').first().click();
  await esperarAviso(page, /não está liberada/);
  afirma(/Área Especializada e CoE não são formadas por Squads/.test(await texto(page, '#sqPosicionamento')) && await page.locator('#sqPosicBloqueio').count() === 0, 'Área Especializada: aviso "não são formadas por Squads", sem bloqueio');
  await salvarRascunho(page);
  db = await banco(page);
  const [[, sAE]] = squadsDe(db, 'pAE');
  afirma(sAE.origemLiberacao.situacao === 'nao-liberado' && sAE.origemLiberacao.codigo === 'AREA_ESPECIALIZADA' && sAE.origemLiberacao.liberaSquad === false, 'origem registrada: não liberado (Área Especializada)');
  await page.click('#sqNovaBtn');
  await page.click('#sqfEscolhaNovo');
  await page.fill('#sqfNovoItemNome', 'Item Inédito');
  await page.click('#sqfNovoItemConfirmar');
  await esperarAviso(page, /não tem Posicionamento/);
  await salvarRascunho(page);
  db = await banco(page);
  const sN = Object.values(db['avaliacoes-squad']).find((v) => v.itemNome === 'Item Inédito');
  afirma(sN && sN.origemLiberacao.situacao === 'sem-posicionamento' && !sN.origemLiberacao.avaliacaoPosicionamentoId, 'item novo: avaliação feita, origem "sem-posicionamento"');
  afirma(await larguraOk(page), 'sem rolagem horizontal');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
}

async function independente(browser, viewport, rotulo) {
  console.log('[' + rotulo + '] 2. independência: um interruptor antigo gravado como ligado não muda nada');
  const rasc = { sAntigo: { itemId: 'pAE', itemNome: 'Item Área', avaliacaoArquiteturalId: 'pAE', questionarioCodigo: 'ADEQUACAO_SQUAD', questionnaireContentVersion: 1, status: 'rascunho',
    criadoEm: QUANDO, atualizadoEm: QUANDO, criadoPor: outra, atualizadoPor: outra, respostas: { S2: { codigoPergunta: 'S2', resposta: 'nao', questionnaireContentVersion: 1, dataResposta: QUANDO } }, excluido: false } };
  let { ctx, page, erros } = await abrir(browser, viewport, '#arquitetura', semente({ exigir: true, squad: rasc }));
  await page.waitForSelector('#avpInicio');
  await page.evaluate(() => { location.hash = '#arquitetura?sq=lista'; });
  await page.waitForSelector('#avaliacoesSquad #sqNovaBtn');
  await page.click('#sqNovaBtn');
  await page.click('#sqfEscolhaExistente');
  await page.fill('#sqfBusca', 'Item Divergente');
  await page.locator('.sq-busca-item').first().click();
  await esperarAviso(page, /não está liberada/);
  const avDiv = await texto(page, '#sqPosicionamento');
  afirma(/Tx COE/.test(avDiv) && /decisão final/.test(avDiv) && await page.locator('#sqPosicBloqueio').count() === 0 && !(await page.locator('#sqSalvarRascunhoBtn').isDisabled()),
    'decisão final CoE (não liberado): o aviso informa, nada bloqueia (Salvar ativo)', avDiv);
  await salvarRascunho(page);
  let [[, sDiv]] = squadsDe(await banco(page), 'pDiv');
  afirma(sDiv.origemLiberacao.situacao === 'nao-liberado' && sDiv.origemLiberacao.origem === 'decisao' && sDiv.origemLiberacao.codigo === 'COE', 'avalia e registra a origem: não liberado, decisão final CoE');
  await page.click('#sqNovaBtn');
  await page.click('#sqfEscolhaNovo');
  afirma(await page.locator('#sqfNovoItemBloqueado').count() === 0 && await page.locator('#sqfNovoItemNome').count() === 1, 'item novo, sem Posicionamento: pode ser avaliado (sem bloqueio)');
  await page.fill('#sqfNovoItemNome', 'Item Sem O1–O9');
  await page.click('#sqfNovoItemConfirmar');
  await esperarAviso(page, /não tem Posicionamento/);
  await salvarRascunho(page);
  const sN = Object.values((await banco(page))['avaliacoes-squad']).find((v) => v.itemNome === 'Item Sem O1–O9');
  afirma(sN && sN.origemLiberacao.situacao === 'sem-posicionamento', 'item sem O1–O9 avaliado; origem "sem-posicionamento"');
  /* o rascunho anterior continua como sempre */
  await page.locator('.sq-act-abrir[data-key="sAntigo"]').click();
  await esperarAviso(page, /não está liberada/);
  await salvarRascunho(page);
  const db = await banco(page), sA = db['avaliacoes-squad'].sAntigo;
  afirma(sA.respostas.S1 && !sA.origemLiberacao, 'o rascunho anterior é salvo e não ganha origem depois');
  afirma(JSON.stringify(db['posicionamento-config']) === JSON.stringify(semente({ exigir: true })['posicionamento-config']) &&
    JSON.stringify(db['posicionamento-config-auditoria']) === JSON.stringify(semente({ exigir: true })['posicionamento-config-auditoria']), 'o registro antigo do interruptor e o histórico ficam intactos');
  afirma(await larguraOk(page), 'sem rolagem horizontal');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
}

async function rede(browser, viewport, rotulo) {
  console.log('[' + rotulo + '] 3. rede lenta e leitura recusada: só informação, nada travado');
  let { ctx, page, erros } = await abrir(browser, viewport, '#arquitetura', semente(), ARQ, { delays: { 'posicionamento-decisoes': 3500 } });
  await escolherItem(page, 'Item Linha');
  afirma(/Verificando o Posicionamento/.test(await texto(page, '#sqPosicionamento')) && !(await page.locator('#sqSalvarRascunhoBtn').isDisabled()), 'leitura lenta: "Verificando…" informa, e a avaliação não espera por ela');
  await esperarAviso(page, /liberada/);
  await salvarRascunho(page);
  let [[, sL]] = squadsDe(await banco(page), 'pL');
  afirma(sL.origemLiberacao.situacao === 'liberado', 'quando a leitura chega antes de salvar, a origem é a real (liberado)');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
  ({ ctx, page, erros } = await abrir(browser, viewport, '#arquitetura', semente(), ARQ, { fail: ['posicionamento-decisoes'] }));
  await escolherItem(page, 'Item Linha');
  await esperarAviso(page, /Não foi possível verificar/);
  afirma(!(await page.locator('#sqSalvarRascunhoBtn').isDisabled()) && await page.locator('#sqPosicBloqueio').count() === 0, 'leitura recusada: "Não foi possível verificar" informa, nada bloqueia');
  await salvarRascunho(page);
  const [[, s]] = squadsDe(await banco(page), 'pL');
  afirma(s.origemLiberacao.situacao === 'nao-verificado' && s.origemLiberacao.liberaSquad === false, 'registra "nao-verificado" (nunca "liberado")');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
  /* a leitura do interruptor antigo falhando (antes, travava a criação mesmo desligado) não muda nada */
  ({ ctx, page, erros } = await abrir(browser, viewport, '#arquitetura', semente({ exigir: false }), ARQ, { fail: ['posicionamento-config'] }));
  await escolherItem(page, 'Item Área');
  await esperarAviso(page, /não está liberada/);
  afirma(!(await page.locator('#sqSalvarRascunhoBtn').isDisabled()) && await page.locator('#sqPosicBloqueio').count() === 0, 'leitura do interruptor antigo recusada: nenhum bloqueio (a tela nem o lê mais)');
  await salvarRascunho(page);
  afirma(squadsDe(await banco(page), 'pAE').length === 1, 'a avaliação é salva');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
}

async function atalho(browser, viewport, rotulo) {
  console.log('[' + rotulo + '] 4. atalho na ficha do Posicionamento');
  let { ctx, page, erros } = await abrir(browser, viewport, '#arquitetura?po=gAE', semente());
  await page.waitForSelector('#poResultado');
  await page.waitForSelector('#poGerarPdfBtn');
  afirma(await page.locator('#poAvaliarSquadBtn').count() === 0, 'Área Especializada: sem "Avaliar Adequação à Squad"');
  await ctx.close();
  ({ ctx, page, erros } = await abrir(browser, viewport, '#arquitetura?po=gL', semente({ exigir: true })));
  await page.waitForSelector('#poAvaliarSquadBtn');
  await page.click('#poAvaliarSquadBtn');
  await page.waitForSelector('#avaliacoesSquad #sqPosicionamento');
  afirma(await page.locator('#avaliacoesPosicionamento').isHidden() && /Item Linha/.test(await texto(page, '#avaliacoesSquad h3')), 'abre a Adequação à Squad do item, sem perguntar o nome');
  await esperarAviso(page, /liberada/);
  await salvarRascunho(page);
  let db = await banco(page);
  afirma(squadsDe(db, 'pL').length === 1, 'cria a avaliação S do item');
  await page.goto(BASE + '/index.html#arquitetura?po=gL', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#poAvaliarSquadBtn');
  await page.click('#poAvaliarSquadBtn');
  await esperarCondicao(page, () => /[?&]sq=(?!lista)/.test(location.hash), 'abriu o rascunho existente', { limite: 10000 });
  db = await banco(page);
  afirma(squadsDe(db, 'pL').length === 1 && (await page.evaluate(() => location.hash)).indexOf(squadsDe(db, 'pL')[0][0]) !== -1, 'com rascunho S do item, o atalho abre esse rascunho (não duplica)');
  afirma(await larguraOk(page), 'sem rolagem horizontal');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
}

async function semInterruptor(browser, viewport, rotulo) {
  console.log('[' + rotulo + '] 5. ADMIN › Motor de Squad: sem o controle da exigência; histórico preservado');
  for (const email of [ADM, ARQ]) {
    const { ctx, page, erros } = await abrir(browser, viewport, '#arquitetura?arq=motor-squad', semente({ exigir: false }), email);
    await page.waitForSelector('#sqMotorSquad', { state: 'visible' });
    afirma(await page.locator('#sqExigirCard, #sqExigirEstado, #sqExigirBtn, #sqExigirMotivo').count() === 0 && !/Exigência de Posicionamento/.test(await texto(page, '#sqMotorSquad')),
      (email === ADM ? 'admin geral' : 'Avaliação + Configuração') + ': o Motor de Squad sem o controle da exigência');
    const db = await banco(page);
    afirma(JSON.stringify(db['posicionamento-config-auditoria']) === JSON.stringify(semente({ exigir: false })['posicionamento-config-auditoria']), 'o histórico do interruptor continua no banco, intacto');
    afirma(await larguraOk(page), 'sem rolagem horizontal');
    afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
    await ctx.close();
  }
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [vp, r] of [[DESKTOP, 'desktop'], [CELULAR, 'celular 375']]) {
      await desligada(browser, vp, r); await independente(browser, vp, r); await rede(browser, vp, r); await atalho(browser, vp, r); await semInterruptor(browser, vp, r);
    }
  } catch (e) { console.log('ERRO', e && e.stack || e); falhas++; }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
