/* I2 — integração Posicionamento Organizacional × Adequação à Squad, na tela. Desktop e celular 375 px; Firebase
 * falso em persistência real; hermético. As regras do banco (que também barram a criação com a exigência ligada) são
 * provadas no emulador por teste-rules-squad-liberacao.js; a liberação lida do que está GRAVADO, pela tabela fixa do
 * motor, por teste-invariante-linha-squad.js. Aqui, o que a pessoa vê e o que a tela grava:
 *   1. Exigência DESLIGADA (padrão): a Squad mostra o Posicionamento vigente como aviso — liberado (recomendação
 *      automática), Área Especializada (não formada por Squads), item novo (sem Posicionamento) — e não bloqueia; a
 *      avaliação S grava, na criação, a origem da liberação (situação, avaliação de Posicionamento, código, origem).
 *   2. Exigência LIGADA: item não liberado não inicia (aviso de bloqueio, Salvar e Concluir travados, nada gravado),
 *      inclusive a recomendação Linha com decisão final CoE (vale a decisão) e o item novo; A_VALIDAR com decisão
 *      liberadora inicia ("decisão final"); um rascunho criado antes continua sendo salvo, só com o aviso.
 *   3. Rede lenta e leitura recusada: "Verificando…" (nada liberado nem bloqueado por suposição) e "Não foi possível
 *      verificar"; com a exigência desligada a leitura recusada não impede a avaliação e fica registrada como
 *      "nao-verificado".
 *   4. Atalho na ficha do Posicionamento: "Avaliar Adequação à Squad" só no item liberado; abre a Squad do item e,
 *      havendo rascunho S, abre esse rascunho (não duplica).
 *   5. ADMIN › Motor de Squad: o interruptor — admin geral liga com motivo (gravação + auditoria); Avaliação +
 *      Configuração só consulta. Sem rolagem horizontal; sem erro de JS. */
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
  if (o.exigir !== undefined) db['posicionamento-config'] = { exigirParaSquad: o.exigir, alteradoEm: 1760000000000, alteradoPor: { uid: 'u-adm', email: ADM }, motivo: 'Decisão da área', auditoriaId: 'cfg1' };
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
  await page.waitForSelector('#avpInicioRegSquad', { state: 'attached' });
  await page.evaluate(() => { const d = document.getElementById('avpInicioConsultar'); if (d) d.open = true; }); await page.click('#avpInicioRegSquad');
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
  console.log('\n[' + rotulo + '] 1. exigência desligada: aviso, sem bloqueio; a origem fica gravada na criação');
  let { ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes', semente());
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
  afirma(/Área Especializada e CoE não são formadas por Squads/.test(await texto(page, '#sqPosicionamento')) && await page.locator('#sqPosicBloqueio').count() === 0, 'Área Especializada: aviso "não são formadas por Squads", sem bloqueio (exigência desligada)');
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

async function ligada(browser, viewport, rotulo) {
  console.log('[' + rotulo + '] 2. exigência ligada: só item liberado inicia; rascunho anterior continua');
  const rasc = { sAntigo: { itemId: 'pAE', itemNome: 'Item Área', avaliacaoArquiteturalId: 'pAE', questionarioCodigo: 'ADEQUACAO_SQUAD', questionnaireContentVersion: 1, status: 'rascunho',
    criadoEm: QUANDO, atualizadoEm: QUANDO, criadoPor: outra, atualizadoPor: outra, respostas: { S2: { codigoPergunta: 'S2', resposta: 'nao', questionnaireContentVersion: 1, dataResposta: QUANDO } }, excluido: false } };
  let { ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes', semente({ exigir: true, squad: rasc }));
  const antes = await banco(page);
  await page.waitForSelector('#avpInicioRegSquad', { state: 'attached' });
  await page.evaluate(() => { const d = document.getElementById('avpInicioConsultar'); if (d) d.open = true; }); await page.click('#avpInicioRegSquad');
  await page.waitForSelector('#avaliacoesSquad #sqNovaBtn');
  await page.click('#sqNovaBtn');
  await page.click('#sqfEscolhaExistente');
  await page.fill('#sqfBusca', 'Item Divergente');
  await page.locator('.sq-busca-item').first().click();
  await page.waitForSelector('#sqPosicBloqueio');
  const avDiv = await texto(page, '#sqPosicionamento');
  afirma(/Tx COE/.test(avDiv) && /decisão final/.test(avDiv) && /exigência de Posicionamento está ligada/.test(await texto(page, '#sqPosicBloqueio')),
    'recomendação Negócios com decisão final CoE: vale a decisão — bloqueado, com o motivo', avDiv);
  afirma(await page.locator('#sqSalvarRascunhoBtn').isDisabled() && await page.locator('#sqConcluirBtn').isDisabled(), 'Salvar e Concluir travados');
  await page.click('.sq-choice-group[data-codigo="S1"] .sq-choice-btn[data-valor="sim"]');
  await page.locator('#sqSalvarRascunhoBtn').click({ force: true });
  afirma(JSON.stringify((await banco(page))['avaliacoes-squad']) === JSON.stringify(antes['avaliacoes-squad']), 'nada gravado');
  await page.click('#sqCancelarChecklistBtn');
  const conf = page.locator('.sq-modal-confirm-btn'); if (await conf.count()) await conf.click();
  await page.waitForSelector('#sqNovaBtn');
  await page.click('#sqNovaBtn');
  await page.click('#sqfEscolhaNovo');
  await page.waitForSelector('#sqfNovoItemBloqueado');
  afirma(/P1–P16/.test(await texto(page, '#sqfNovoItemBloqueado')) && await page.locator('#sqfNovoItemNome').count() === 0, 'item novo: bloqueado (precisa de P1–P16 e O1–O9 antes), sem o campo de nome');
  await page.click('#sqfEscolhaExistente');
  await page.fill('#sqfBusca', 'Item A validar');
  await page.locator('.sq-busca-item').first().click();
  await esperarAviso(page, /liberada/);
  afirma(/decisão final/.test(await texto(page, '#sqPosicionamento')) && /Tx PLATAFORMA_CANAIS/.test(await texto(page, '#sqPosicionamento')) && await page.locator('#sqPosicBloqueio').count() === 0,
    'A_VALIDAR com decisão final liberadora (Plataforma de Canais): liberado');
  await salvarRascunho(page);
  const [[, sAV]] = squadsDe(await banco(page), 'pAV');
  afirma(sAV.origemLiberacao.situacao === 'liberado' && sAV.origemLiberacao.origem === 'decisao' && sAV.origemLiberacao.codigo === 'PLATAFORMA_CANAIS', 'origem: decisão final, Plataforma de Canais');
  /* o rascunho criado ANTES da exigência (item não liberado) continua */
  await page.locator('.sq-act-abrir[data-key="sAntigo"]').click();
  await page.waitForSelector('#sqPosicionamento');
  await esperarAviso(page, /não está liberada/);
  afirma(await page.locator('#sqPosicBloqueio').count() === 0 && !(await page.locator('#sqSalvarRascunhoBtn').isDisabled()), 'rascunho anterior de item não liberado: só o aviso, sem bloqueio');
  await salvarRascunho(page);
  const sA = (await banco(page))['avaliacoes-squad'].sAntigo;
  afirma(sA.respostas.S1 && !sA.origemLiberacao, 'o rascunho anterior é salvo e não ganha origem depois');
  afirma(await larguraOk(page), 'sem rolagem horizontal');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
}

async function rede(browser, viewport, rotulo) {
  console.log('[' + rotulo + '] 3. rede lenta e leitura recusada');
  let { ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes', semente({ exigir: true }), ARQ, { delays: { 'posicionamento-decisoes': 3500 } });
  await escolherItem(page, 'Item Linha');
  afirma(/Verificando o Posicionamento/.test(await texto(page, '#sqPosicionamento')) && await page.locator('#sqSalvarRascunhoBtn').isDisabled(), 'leitura lenta: "Verificando…", Salvar travado (nem liberado nem bloqueado por suposição)');
  await esperarAviso(page, /liberada/);
  afirma(!(await page.locator('#sqSalvarRascunhoBtn').isDisabled()), 'chegou: liberado, Salvar destravado');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
  ({ ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes', semente({ exigir: true }), ARQ, { fail: ['posicionamento-decisoes'] }));
  await escolherItem(page, 'Item Linha');
  await esperarAviso(page, /Não foi possível verificar/);
  afirma(await page.locator('#sqSalvarRascunhoBtn').isDisabled() && /Não foi possível verificar/.test(await texto(page, '#sqPosicBloqueio')), 'leitura recusada com a exigência ligada: "Não foi possível verificar", bloqueado');
  await ctx.close();
  ({ ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes', semente(), ARQ, { fail: ['posicionamento-decisoes'] }));
  await escolherItem(page, 'Item Linha');
  await esperarAviso(page, /Não foi possível verificar/);
  await salvarRascunho(page);
  const [[, s]] = squadsDe(await banco(page), 'pL');
  afirma(s.origemLiberacao.situacao === 'nao-verificado' && s.origemLiberacao.liberaSquad === false, 'leitura recusada com a exigência desligada: avalia e registra "nao-verificado" (nunca "liberado")');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
}

async function atalho(browser, viewport, rotulo) {
  console.log('[' + rotulo + '] 4. atalho na ficha do Posicionamento');
  let { ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?po=gAE', semente());
  await page.waitForSelector('#poResultado');
  await page.waitForSelector('#poGerarPdfBtn');
  afirma(await page.locator('#poAvaliarSquadBtn').count() === 0, 'Área Especializada: sem "Avaliar Adequação à Squad"');
  await ctx.close();
  ({ ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?po=gL', semente({ exigir: true })));
  await page.waitForSelector('#poAvaliarSquadBtn');
  await page.click('#poAvaliarSquadBtn');
  await page.waitForSelector('#avaliacoesSquad #sqPosicionamento');
  afirma(await page.locator('#avaliacoesPosicionamento').isHidden() && /Item Linha/.test(await texto(page, '#avaliacoesSquad h3')), 'abre a Adequação à Squad do item, sem perguntar o nome');
  await esperarAviso(page, /liberada/);
  await salvarRascunho(page);
  let db = await banco(page);
  afirma(squadsDe(db, 'pL').length === 1, 'cria a avaliação S do item');
  await page.goto(BASE + '/index.html#avaliacoes?po=gL', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#poAvaliarSquadBtn');
  await page.click('#poAvaliarSquadBtn');
  await esperarCondicao(page, () => /[?&]sq=(?!lista)/.test(location.hash), 'abriu o rascunho existente', { limite: 10000 });
  db = await banco(page);
  afirma(squadsDe(db, 'pL').length === 1 && (await page.evaluate(() => location.hash)).indexOf(squadsDe(db, 'pL')[0][0]) !== -1, 'com rascunho S do item, o atalho abre esse rascunho (não duplica)');
  afirma(await larguraOk(page), 'sem rolagem horizontal');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
}

async function interruptor(browser, viewport, rotulo) {
  console.log('[' + rotulo + '] 5. ADMIN › Motor de Squad: o interruptor');
  let { ctx, page, erros } = await abrir(browser, viewport, '#admin?arq=motor-squad', semente(), ADM);
  await page.waitForSelector('#sqExigirEstado[data-exigir]');
  afirma(/Desligada/.test(await texto(page, '#sqExigirEstado')), 'sem registro: "Desligada"');
  await page.click('#sqExigirBtn');
  await page.waitForSelector('#sqExigirFlash');
  afirma(/Informe o motivo/.test(await texto(page, '#sqExigirFlash')), 'motivo obrigatório');
  await page.fill('#sqExigirMotivo', 'Posicionamento já em uso pela área');
  await page.click('#sqExigirBtn');
  await page.click('.sq-modal-confirm-btn');
  await esperarCondicao(page, () => /ligada\./.test((document.getElementById('sqExigirFlash') || {}).textContent || ''), 'ligada', { limite: 10000 });
  const db = await banco(page), cfg = db['posicionamento-config'], aud = db['posicionamento-config-auditoria'] && db['posicionamento-config-auditoria'][cfg && cfg.auditoriaId];
  afirma(cfg && cfg.exigirParaSquad === true && cfg.motivo === 'Posicionamento já em uso pela área' && cfg.alteradoPor.email === ADM && cfg.alteradoPor.uid === 'u-' + chave(ADM) &&
    aud && aud.exigirParaSquad === true && aud.anterior === false && aud.usuario.email === ADM, 'grava o interruptor e a auditoria (estado anterior, motivo, quem) juntos', JSON.stringify({ cfg, aud }));
  await esperarCondicao(page, () => /Ligada/.test((document.getElementById('sqExigirEstado') || {}).textContent || ''), 'mostra ligada', { limite: 10000 });
  afirma(/Desligar a exigência/i.test(await texto(page, '#sqExigirBtn')) && /Posicionamento já em uso/.test(await texto(page, '#sqExigirUltima')), 'mostra "Ligada", a última alteração e o botão para desligar',
    (await texto(page, '#sqExigirBtn')) + ' | ' + (await page.locator('#sqExigirUltima').count() ? await texto(page, '#sqExigirUltima') : 'sem #sqExigirUltima'));
  afirma(await larguraOk(page), 'sem rolagem horizontal');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
  ({ ctx, page, erros } = await abrir(browser, viewport, '#admin?arq=motor-squad', semente({ exigir: true }), ARQ));
  await page.waitForSelector('#sqExigirEstado[data-exigir]');
  afirma(/Ligada/.test(await texto(page, '#sqExigirEstado')) && await page.locator('#sqExigirSoAdmin').count() === 1 && await page.locator('#sqExigirBtn, #sqExigirMotivo').count() === 0,
    'Avaliação + Configuração vê o estado, sem campo nem botão ("Só admin geral altera")');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [vp, r] of [[DESKTOP, 'desktop'], [CELULAR, 'celular 375']]) {
      await desligada(browser, vp, r); await ligada(browser, vp, r); await rede(browser, vp, r); await atalho(browser, vp, r); await interruptor(browser, vp, r);
    }
  } catch (e) { console.log('ERRO', e && e.stack || e); falhas++; }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
