/* Catálogo preparatório do Mapa da Floresta (mapa-floresta.js) — 1º incremento, SÓ CONSULTA. Desktop e celular
 * 375 px; Firebase falso em persistência real; hermético. O que a pessoa vê e o que a tela (não) grava:
 *   1. Abrir pela lista de Avaliações: endereço #avaliacoes?mf=catalogo, título próprio ("Catálogo preparatório" —
 *      não o Mapa visual); as três categorias (Linha com os 6 códigos firmes do ramo Linha, Área Especializada, CoE)
 *      com os nomes da Taxonomia e o invariante Linha × Squad (Linha pode ter Squads; Área e CoE não).
 *   2. Estruturas e associações: aviso de informação INDISPONÍVEL nesta versão; nunca "nenhuma estrutura cadastrada",
 *      nunca vínculo válido/ausente/a revisar — cada objeto diz "Informação indisponível nesta versão".
 *   3. Catálogo: um objeto por item (sem duplicar por reavaliação), sem os da Lixeira; as quatro situações (sem
 *      Avaliação de Produto/Serviço válida ou atual, sem Posicionamento concluído, A VALIDAR sem decisão firme,
 *      posicionamento efetivo firme com código e origem); a decisão final prevalece sobre a recomendação (inclusive
 *      sobre A_VALIDAR); A VALIDAR "não é exclusão"; alerta quando a base de P1–P16 mudou.
 *   4. Filtros (situação, posicionamento — categoria e código —, busca, limpar, "Ver no catálogo" da categoria).
 *   5. Navegação: "Abrir Posicionamento" leva à ficha; Voltar do navegador volta ao catálogo; F5 mantém o catálogo;
 *      "← Voltar para Avaliações" volta à lista com o título original.
 *   6. Nada gravado: o banco inteiro é o mesmo antes e depois de tudo.
 *   7. Perfis: "Avaliação" consulta; quem não tem acesso à Avaliação não vê o catálogo.
 *   8. Rede: leitura lenta mostra "Carregando…" (nunca catálogo vazio); leitura recusada mostra o erro e "Tentar de
 *      novo", que recupera quando a leitura volta; leitura que não chega avisa que está demorando (desktop).
 * Sem rolagem horizontal; sem erro de JS. FA_CAPTURAS=<pasta> grava capturas de tela (desktop e 375 px). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const CAPTURAS = process.env.FA_CAPTURAS || '';
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
const ARQ = 'arquitetura@previ.com.br', AVA = 'avaliadora@previ.com.br', SEM = 'semacesso@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };
const QUANDO = '2026-10-01T09:00:00.000Z';
const QCOD = 'POSICIONAMENTO_ORGANIZACIONAL';
const LINHA6 = ['ESTRATEGIA_CLIENTES', 'NEGOCIOS', 'PLATAFORMA_CANAIS', 'PLATAFORMA_HABILITADORA_NEGOCIOS', 'PLATAFORMA_HABILITADORA_TECNOLOGIA', 'PLATAFORMA_CORPORATIVA'];

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

const ORDEM_P = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao',
  'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
function produto(itemId, nome, extra) {
  const r = {};
  ORDEM_P.forEach((q, i) => { r[q] = { valor: 'sim', justificativaAuto: 'interpretação', codigoPergunta: 'P' + (i + 1), textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 }; });
  return Object.assign({ itemId, nome, descricao: '', publico: '', necessidade: '', observacoesGerais: '', status: 'concluido', resultadoAutomatico: 'produto', decisaoFinal: 'produto', camadaSugerida: { id: 'produto-principal', label: 'Produto/Serviço principal' },
    respostas: r, justificativaAutomatica: 'justificativa', criteriosEssenciaisFalhos: [], criteriosAtendidos: 5, motorVersion: MOTOR_PRODUTO, motorVersionArquitetura: 2, questionnaireContentVersion: 1,
    excluido: false, criadoEm: QUANDO, atualizadoEm: QUANDO, versao: 1, responsavel: { name: 'Fulana', email: 'f@previ.com.br' } }, extra || {});
}
const outra = { name: 'Outra', email: 'o@previ.com.br' };
/* avaliação de Posicionamento CONCLUÍDA com o resultado exato do motor v1 */
function concluida(itemId, itemNome, respostas, diag, base) {
  const reg = { itemId, itemNome, avaliacaoArquiteturalId: base || itemId, questionarioCodigo: QCOD, questionnaireContentVersion: 1, versao: 1, status: 'concluido', revisao: 2,
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
/* O que cada objeto do catálogo deve mostrar (itemId → situação, código efetivo, origem, alerta) */
const ESPERADO = {
  pL: { sit: 'firme', cod: 'NEGOCIOS', origem: 'recomendacao' },
  pAE: { sit: 'firme', cod: 'AREA_ESPECIALIZADA', origem: 'recomendacao' },
  pAV: { sit: 'a-validar' },
  pAVd: { sit: 'firme', cod: 'PLATAFORMA_CANAIS', origem: 'decisao' },
  pDiv: { sit: 'firme', cod: 'COE', origem: 'decisao' },
  pSem: { sit: 'sem-posicionamento' },
  pRasc: { sit: 'sem-base' },
  pDes: { sit: 'sem-base' },
  pV: { sit: 'sem-posicionamento' },
  pReav: { sit: 'firme', cod: 'NEGOCIOS', origem: 'recomendacao', alerta: 'reavaliacao-em-andamento' }
};
function semente() {
  const aut = {}; aut[chave(ARQ)] = { email: ARQ, tipo: 'avaliacao-arquitetura' }; aut[chave(AVA)] = { email: AVA, tipo: 'avaliacao' };
  const users = {}; [ARQ, AVA, SEM].forEach((e) => { users[chave(e)] = { name: 'Pessoa', email: e, area: 'INFOR' }; });
  const conceitos = {}, fontes = {};
  ['AREA_ESPECIALIZADA', 'COE', 'ESTRATEGIA_CLIENTES', 'NEGOCIOS', 'PLATAFORMA_CANAIS', 'PLATAFORMA_HABILITADORA_NEGOCIOS', 'PLATAFORMA_HABILITADORA_TECNOLOGIA', 'PLATAFORMA_CORPORATIVA', 'LINHA', 'PLATAFORMA'].forEach((c, i) => {
    conceitos[c] = { nome: 'Tx ' + c, ordem: i + 1, ativo: true, situacaoDefinicao: 'registrada', camada: 'A', definicaoVigenteFonteId: 'f1' };
    fontes[c] = { f1: { texto: 'Definição de ' + c, contexto: 'PREVI', situacao: 'vigente', tipoRedacao: 'Conceito' } };
  });
  return {
    'fa-users': users, 'fa-admins': {}, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {},
    'fa-avaliacao-autorizados': aut, 'avaliacoes-squad': {}, 'motor-squad-config': {}, 'questionarios-config': {},
    'motor-arquitetura-config': { versaoPublicada: 2, versoes: { 2: { regras: PADRAO_REGRAS, publicadoEm: QUANDO, publicadoPor: outra } } },
    'avaliacoes-produto': {
      pL: produto('pL', 'Item Linha'), pAE: produto('pAE', 'Item Área'), pAV: produto('pAV', 'Item A validar'), pAVd: produto('pAVd', 'Item A validar decidido'),
      pDiv: produto('pDiv', 'Item Divergente'), pSem: produto('pSem', 'Item Sem Posicionamento'),
      pRasc: produto('pRasc', 'Item Rascunho P1', { status: 'rascunho' }),
      pDes: produto('pDes', 'Item Motor Antigo', { motorVersion: 'motor-antigo' }),
      pExc: produto('pExc', 'Item Na Lixeira', { excluido: true }),
      pV: produto('pV', 'Item Versao Antiga'), pV2: produto('pV', 'Item Versao Nova', { versao: 2, versaoAnteriorKey: 'pV' }),
      pReav: produto('pReav', 'Item Em Reavaliacao'), pReav2: produto('pReav', 'Item Em Reavaliacao', { versao: 2, versaoAnteriorKey: 'pReav', status: 'rascunho' })
    },
    'avaliacoes-posicionamento': { gL: concluida('pL', 'Item Linha', NEG), gAE: concluida('pAE', 'Item Área', AE), gAV: concluida('pAV', 'Item A validar', CONF, 'mesma'),
      gAVd: concluida('pAVd', 'Item A validar decidido', CONF, 'mesma'), gDiv: concluida('pDiv', 'Item Divergente', NEG), gReav: concluida('pReav', 'Item Em Reavaliacao', NEG) },
    'posicionamento-rascunho-por-item': {}, 'posicionamento-vigente-por-item': { pL: 'gL', pAE: 'gAE', pAV: 'gAV', pAVd: 'gAVd', pDiv: 'gDiv', pReav: 'gReav' },
    'posicionamento-decisoes': { gAVd: decisao('pAVd', 'A_VALIDAR', 'PLATAFORMA_CANAIS', 'RESOLUCAO_A_VALIDAR'), gDiv: decisao('pDiv', 'NEGOCIOS', 'COE', 'DIVERGENCIA') },
    'posicionamento-auditoria': {},
    taxonomia: { organizacional: { conceitos, fontes } }
  };
}
let seq = 0;
async function abrir(browser, viewport, hash, email, extraCfg) {
  email = email || ARQ;
  const cfg = Object.assign({ db: semente(), user: { email, emailVerified: true, uid: 'u-' + chave(email) }, uidDoUsuario: true, prefixoChave: 'k' + (++seq) + 'x', delayDefault: 10, persistenciaReal: true, delays: {}, fail: [] }, extraCfg || {});
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
const banco = (page) => page.evaluate(() => JSON.stringify(window.__CFG.__dbReal));
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const texto = (page, sel) => page.locator(sel).innerText();
const itensVisiveis = (page) => page.$$eval('#mfItens .mf-item', (els) => els.map((e) => e.getAttribute('data-item')).sort());
/* lista simples (ajuste de usabilidade): filtros e contadores ficam recolhidos em "Filtros e contadores"; os detalhes de um
   objeto abrem ao clicar nele (#avaliacoes?mf=catalogo&item=<id>) */
async function abrirAvancados(page) {
  const d = page.locator('#mfFiltrosAvancados');
  if ((await d.count()) && !(await d.evaluate((x) => x.open))) await page.click('#mfFiltrosAvancados > summary');
}
async function detalhe(page, id) {
  await page.evaluate((i) => { location.hash = '#avaliacoes?mf=catalogo&item=' + encodeURIComponent(i); }, id);
  await page.waitForSelector('#mfItens .mf-item--detalhe[data-item="' + id + '"]');
  return page.locator('#mfItens .mf-item--detalhe[data-item="' + id + '"]');
}
async function voltarLista(page) { await page.click('#mfVoltarLista'); await page.waitForSelector('#mfItens .mf-linha'); }
async function abrirFiltroPosic(page) {
  await abrirAvancados(page);
  if (!(await page.locator('#mfFiltroPosicionamentoBloco').evaluate((d) => d.open))) await page.click('#mfFiltroPosicionamentoBloco > summary');
}
async function posic(page, valor) {
  await abrirFiltroPosic(page);
  await page.click('label[for="mfPosic-' + (valor || 'TODOS') + '"]');
}
async function capturar(page, nome) {
  if (!CAPTURAS) return;
  fs.mkdirSync(CAPTURAS, { recursive: true });
  await page.screenshot({ path: path.join(CAPTURAS, nome + '.png'), fullPage: true });
  /* trechos legíveis (a página inteira em 375 px fica longa demais para conferir) */
  for (const [sel, sufixo] of [['#mfCategorias', 'categorias'], ['#mfFiltros', 'filtros'], ['#mfItens .mf-item[data-item="pDiv"]', 'item-decisao'], ['#mfItens .mf-item[data-item="pDes"]', 'item-sem-base']]) {
    if (await page.locator(sel).count()) await page.locator(sel).first().screenshot({ path: path.join(CAPTURAS, nome + '-' + sufixo + '.png') });
  }
}

async function principal(browser, viewport, rotulo) {
  console.log('\n[' + rotulo + '] 1–6. categorias, catálogo, filtros, navegação e nada gravado');
  const { ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes');
  await page.waitForSelector('#avpMapaFlorestaBtn');
  const antes = await banco(page);
  await page.click('#avpMapaFlorestaBtn');
  await page.waitForSelector('#mfItens');
  afirma(await page.evaluate(() => location.hash) === '#avaliacoes?mf=catalogo', 'endereço próprio #avaliacoes?mf=catalogo');
  afirma(/Jornada de Avaliação e Posicionamento/.test(await texto(page, '#page-avaliacoes .page-hero h1')), 'título "Jornada de Avaliação e Posicionamento" (não o Mapa visual)');
  afirma(await page.locator('#avaliacoesPainel').isHidden(), 'a lista de Avaliações fica por baixo, escondida');
  afirma((await page.evaluate(() => (document.body.innerText.match(/Jornada de Avaliação e Posicionamento/g) || []).length)) === 1, 'o título aparece uma vez só (sem repetir no cartão)');

  /* 0. lista simples: busca em destaque; categorias, filtros, contadores e explicações recolhidos; nenhum detalhe aberto */
  const celular = viewport === CELULAR;
  afirma(!(await page.locator('#mfCategoriasBloco').evaluate((d) => d.open)) && !(await page.locator('#mfFiltrosAvancados').evaluate((d) => d.open)) &&
    !(await page.locator('#mfSobre').evaluate((d) => d.open)), 'categorias, "Filtros e contadores" e "Sobre esta tela" começam recolhidos');
  afirma(await page.locator('#mfBusca').isVisible() && await page.locator('#mfItens .mf-trilha, #mfItens .mf-detalhes').count() === 0 && await page.locator('#mfItens .mf-linha .mf-linha-abrir').count() === 10,
    'a busca à vista e a lista simples (nome, tipo, situação e "abrir"), sem os detalhes de nenhum objeto');
  const resumo = await texto(page, '#mfCategoriasResumo');
  afirma(/6 tipos firmes/.test(resumo) && !/estrutura/i.test(resumo) && !/d+s+(Linhas|estruturas|CoEs|Áreas)/i.test(resumo), 'resumo: Linha (6 tipos firmes) · Área Especializada · CoE — sem contagem de estruturas', resumo);
  await page.click('#mfCategoriasBloco > summary');
  afirma(await page.locator('#mfCategoriasBloco').evaluate((d) => d.open) && await page.locator('#mfCategorias').isVisible(), 'tocar no resumo expande as categorias');

  /* 1. categorias (os nomes chegam da Taxonomia depois do catálogo: a tela troca no lugar) */
  await esperarCondicao(page, () => /Tx LINHA/.test((document.querySelector('.mf-categoria[data-categoria="LINHA"] .mf-categoria-nome') || {}).textContent || ''), null, { limite: 10000, descricao: 'nome da Taxonomia na categoria Linha' });
  const cats =await page.$$eval('#mfCategorias > .mf-categoria', (els) => els.map((e) => ({ id: e.getAttribute('data-categoria'), squad: e.querySelector('.mf-squad').getAttribute('data-forma-squads'),
    nome: e.querySelector('.mf-categoria-nome').textContent, esp: Array.from(e.querySelectorAll('.mf-especializacoes > li')).map((l) => l.getAttribute('data-codigo')) })));
  afirma(cats.length === 3 && cats.map((c) => c.id).join(',') === 'LINHA,AREA_ESPECIALIZADA,COE', 'três categorias: Linha, Área Especializada, CoE', JSON.stringify(cats.map((c) => c.id)));
  const linha = cats.find((c) => c.id === 'LINHA') || {};
  afirma(JSON.stringify((linha.esp || []).slice().sort()) === JSON.stringify(LINHA6.slice().sort()), 'Linha com os seis códigos firmes do ramo Linha', JSON.stringify(linha.esp));
  afirma(linha.squad === 'sim' && cats.filter((c) => c.id !== 'LINHA').every((c) => c.squad === 'nao'), 'invariante: Linha pode ter Squads; Área Especializada e CoE não');
  afirma(/Tx LINHA/.test(linha.nome) && /Tx COE/.test((cats.find((c) => c.id === 'COE') || {}).nome), 'nomes vindos da Taxonomia Organizacional');

  /* 2. estruturas: indisponível, nunca "nenhuma" (a explicação fica em "Sobre esta tela") */
  await page.click('#mfSobre > summary');
  const corpo = await texto(page, '#avaliacoesMapa');
  afirma(/informação indisponível nesta versão/i.test(await texto(page, '#mfAvisoEstruturas')) && /incremento posterior/.test(await texto(page, '#mfAvisoEstruturas')), 'aviso: Estruturas Concretas indisponíveis nesta versão, em incremento posterior');
  afirma(!/nenhuma estrutura/i.test(corpo) && !/sem responsável|responsável ausente|vínculo válido|a revisar/i.test(corpo), 'nunca "nenhuma estrutura", "sem responsável", vínculo válido ou a revisar');
  afirma((corpo.match(/indisponível nesta versão/gi) || []).length === 1 && !/Estrutura responsável/.test(await texto(page, '#mfItens')),
    'um aviso geral, uma vez só; os cartões não repetem "Estrutura responsável — indisponível"');

  /* 3. catálogo */
  const vistos = await itensVisiveis(page);
  afirma(JSON.stringify(vistos) === JSON.stringify(Object.keys(ESPERADO).sort()), 'um objeto por item, sem duplicar versões e sem os da Lixeira', JSON.stringify(vistos));
  for (const id of Object.keys(ESPERADO)) {
    const e = ESPERADO[id];
    const sit = await page.locator('#mfItens .mf-item[data-item="' + id + '"]').getAttribute('data-situacao');
    const li = await detalhe(page, id);
    let ok = sit === e.sit && (await li.getAttribute('data-situacao')) === e.sit;
    if (e.cod) { const dd = li.locator('.mf-efetivo'); ok = ok && await dd.getAttribute('data-codigo') === e.cod && await dd.getAttribute('data-origem') === e.origem; }
    if (e.alerta) ok = ok && await li.locator('.mf-alerta').getAttribute('data-alerta') === e.alerta;
    afirma(ok, id + ': ' + e.sit + (e.cod ? ' ' + e.cod + ' (' + e.origem + ')' : '') + (e.alerta ? ', alerta ' + e.alerta : '') + ' (lista e detalhe)', sit);
    await voltarLista(page);
  }
  await detalhe(page, 'pV');
  afirma(/Item Versao Nova/.test(await texto(page, '#mfItens .mf-item[data-item="pV"]')), 'item reavaliado aparece com o nome da versão que vale');
  await detalhe(page, 'pDiv');
  afirma(/decisão final/.test(await texto(page, '#mfItens .mf-item[data-item="pDiv"] .mf-efetivo')) && /Tx COE/.test(await texto(page, '#mfItens .mf-item[data-item="pDiv"] .mf-efetivo')) &&
    /Tx NEGOCIOS/.test(await texto(page, '#mfItens .mf-item[data-item="pDiv"]')), 'decisão final (CoE) prevalece sobre a recomendação (Negócios), que continua visível');
  await detalhe(page, 'pAV');
  afirma(/não é exclusão/.test(await texto(page, '#mfItens .mf-item[data-item="pAV"]')), 'A VALIDAR sem decisão: "não é exclusão"');
  await detalhe(page, 'pDes');
  const desOk = await page.locator('#mfItens .mf-item[data-item="pDes"] [data-motivo="desatualizado"]').count() === 1 && /desatualizado/.test(await texto(page, '#mfItens .mf-item[data-item="pDes"]'));
  await detalhe(page, 'pRasc');
  afirma(desOk &&
    await page.locator('#mfItens .mf-item[data-item="pRasc"] [data-motivo="nao-concluida"]').count() === 1 && /não foi concluída/.test(await texto(page, '#mfItens .mf-item[data-item="pRasc"]')), 'sem base: o motivo por extenso (motor desatualizado; P1–P16 não concluída)');
  await voltarLista(page);
  await capturar(page, 'catalogo-' + (viewport === DESKTOP ? 'desktop' : '375'));

  /* 4. filtros (em "Filtros e contadores") */
  await abrirAvancados(page);
  await page.selectOption('#mfFiltroSituacao', 'sem-base');
  afirma(JSON.stringify(await itensVisiveis(page)) === JSON.stringify(['pDes', 'pRasc']), 'filtro situação: sem Avaliação de Produto/Serviço válida ou atual');
  afirma(/2 de 10/.test(await texto(page, '#mfContador')), 'contador "2 de 10"', await texto(page, '#mfContador'));
  await page.selectOption('#mfFiltroSituacao', '');
  /* filtro "Posicionamento efetivo": opções que quebram linha, recolhidas no celular, abertas no desktop */
  afirma(await page.locator('#mfFiltroPosicionamentoBloco').evaluate((d) => d.open) === !celular, celular ? 'celular: filtro de posicionamento começa recolhido' : 'desktop: filtro de posicionamento começa aberto');
  afirma(await page.locator('#mfFiltroPosicionamentoAtual').innerText() === 'Todos', 'o resumo do filtro diz o que está escolhido ("Todos")');
  if (celular) {
    await page.click('#mfFiltroPosicionamentoBloco > summary');
    afirma(await page.locator('#mfFiltroPosicionamento').isVisible(), 'tocar no resumo expande as opções');
    await page.click('#mfFiltroPosicionamentoBloco > summary');
    afirma(!(await page.locator('#mfFiltroPosicionamento').isVisible()), 'tocar de novo recolhe as opções');
  }
  const valores = await page.$$eval('input[name="mfPosic"]', (rs) => rs.map((r) => r.value));
  afirma(JSON.stringify(valores) === JSON.stringify(['', 'LINHA'].concat(LINHA6).concat(['AREA_ESPECIALIZADA', 'COE'])), 'opções valem pelos CÓDIGOS estáveis (Todos, Linha, os 6 do ramo Linha, Área Especializada, CoE)', JSON.stringify(valores));
  await posic(page, 'LINHA');
  afirma(JSON.stringify(await itensVisiveis(page)) === JSON.stringify(['pAVd', 'pL', 'pReav']), 'filtro posicionamento: Linha (todas as especializações)', JSON.stringify(await itensVisiveis(page)));
  const marcadas = await page.$$eval('input[name="mfPosic"]:checked', (rs) => rs.map((r) => r.value));
  afirma(JSON.stringify(marcadas) === '["LINHA"]' && await page.locator('label.mf-opcao--ativa').count() === 1 && await page.locator('label[for="mfPosic-LINHA"].mf-opcao--ativa').count() === 1 &&
    /todas/.test(await page.locator('#mfFiltroPosicionamentoAtual').innerText()), 'a opção escolhida fica marcada (uma só), destacada e citada no resumo');
  await posic(page, 'COE');
  afirma(JSON.stringify(await itensVisiveis(page)) === JSON.stringify(['pDiv']), 'filtro posicionamento: CoE (pela decisão final)');
  /* teclado: setas trocam a opção, o filtro acompanha e o foco continua no grupo */
  await page.focus('#mfPosic-TODOS');
  await page.keyboard.press('ArrowDown');
  await esperarCondicao(page, () => (document.activeElement || {}).id === 'mfPosic-LINHA' && document.getElementById('mfPosic-LINHA').checked, null, { limite: 5000, descricao: 'seta para baixo leva à Linha' });
  afirma(JSON.stringify(await itensVisiveis(page)) === JSON.stringify(['pAVd', 'pL', 'pReav']), 'teclado: seta para baixo escolhe a opção seguinte e filtra; o foco continua nela');
  await page.keyboard.press('ArrowDown');
  await esperarCondicao(page, () => (document.activeElement || {}).id === 'mfPosic-ESTRATEGIA_CLIENTES', null, { limite: 5000, descricao: 'seta leva à primeira especialização' });
  afirma(await page.locator('#mfNenhumFiltro').count() === 1 && await page.locator('#mfPosic-ESTRATEGIA_CLIENTES').isChecked(), 'teclado: especialização sem objetos mostra "Nenhum objeto com esses filtros" e o foco não se perde');
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
  await esperarCondicao(page, () => (document.activeElement || {}).id === 'mfPosic-TODOS' && document.getElementById('mfPosic-TODOS').checked, null, { limite: 5000, descricao: 'setas para cima voltam a Todos' });
  afirma((await itensVisiveis(page)).length === 10, 'teclado: voltar a "Todos" mostra todos os objetos');
  await page.fill('#mfBusca', 'divergente');
  afirma(JSON.stringify(await itensVisiveis(page)) === JSON.stringify(['pDiv']), 'busca pelo nome');
  await page.click('#mfLimparFiltros');
  afirma((await itensVisiveis(page)).length === 10 && await page.locator('#mfLimparFiltros').count() === 0, 'limpar filtros');
  if (!(await page.locator('#mfCategoriasBloco').evaluate((d) => d.open))) await page.click('#mfCategoriasBloco > summary');
  await page.click('.mf-filtrar-categoria[data-categoria="AREA_ESPECIALIZADA"]');
  afirma(JSON.stringify(await itensVisiveis(page)) === JSON.stringify(['pAE']), '"Ver no catálogo" da categoria filtra por ela');
  await page.click('#mfLimparFiltros');

  /* 5. navegação: abrir o objeto, voltar à lista com a busca preservada; do objeto, "Abrir Posicionamento" */
  await page.fill('#mfBusca', 'divergente');
  await page.click('#mfItens .mf-item[data-item="pDiv"] .mf-linha-abrir');
  await page.waitForSelector('#mfItens .mf-item--detalhe[data-item="pDiv"]');
  afirma((await page.evaluate(() => location.hash)) === '#avaliacoes?mf=catalogo&item=pDiv' && await page.locator('#mfItens .mf-item').count() === 1, 'clicar no objeto abre só a jornada dele (endereço próprio)');
  await voltarLista(page);
  afirma((await page.inputValue('#mfBusca')) === 'divergente' && JSON.stringify(await itensVisiveis(page)) === '["pDiv"]', '"← Voltar para a lista" preserva a busca');
  await page.click('#mfLimparFiltros');
  await detalhe(page, 'pDiv');
  await page.click('#mfItens .mf-item[data-item="pDiv"] .mf-abrir-po');
  await page.waitForSelector('#poResultado');
  afirma(await page.locator('#avaliacoesMapa').isHidden() && /[?&]po=gDiv/.test(await page.evaluate(() => location.hash)), '"Abrir Posicionamento" abre a ficha da avaliação vigente');
  await page.goBack();
  await page.waitForSelector('#mfItens');
  afirma(await page.locator('#avaliacoesPosicionamento').isHidden() && /Jornada de Avaliação e Posicionamento/.test(await texto(page, '#page-avaliacoes .page-hero h1')), 'Voltar do navegador volta ao catálogo');
  await page.goBack(); await page.waitForSelector('#mfItens .mf-linha');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#mfItens');
  afirma((await itensVisiveis(page)).length === 10, 'F5 em #avaliacoes?mf=catalogo reabre o catálogo');
  await page.click('#mfVoltar');
  await page.waitForSelector('#avpMapaFlorestaBtn');
  afirma(await page.locator('#avaliacoesMapa').isHidden() && (await texto(page, '#page-avaliacoes .page-hero h1')).trim() === 'Avaliações', '"← Voltar para Avaliações": lista e título originais');

  /* 6. nada gravado (e, antes, nada cortado dentro dos cartões — rolagem horizontal da página não pega isso) */
  await page.click('#avpMapaFlorestaBtn');
  await page.waitForSelector('#mfItens');
  await abrirFiltroPosic(page);
  const pequenos = await page.$$eval('#avaliacoesMapa button, #avaliacoesMapa a, #avaliacoesMapa select, #avaliacoesMapa input:not([type="radio"]), #avaliacoesMapa summary, #avaliacoesMapa label.mf-opcao',
    (els) => els.filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height < 44; }).map((e) => (e.id || e.className) + ':' + Math.round(e.getBoundingClientRect().height)));
  afirma(!pequenos.length, 'áreas de toque do Catálogo com pelo menos 44 px de altura', pequenos.join(', '));
  const cortados = await page.$$eval('#avaliacoesMapa .mf-categoria, #avaliacoesMapa .mf-item, #avaliacoesMapa .mf-filtros, #avaliacoesMapa .mf-opcao, #avaliacoesMapa .mf-filtro-posic-resumo', (els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > window.innerWidth + 1).map((e) => e.className + ':' + (e.getAttribute('data-categoria') || e.getAttribute('data-item') || '')));
  afirma(!cortados.length, 'nenhum cartão ou filtro transborda a largura da tela', cortados.join(', '));
  await page.click('#mfVoltar');
  await page.waitForSelector('#avpMapaFlorestaBtn');
  afirma(await banco(page) === antes, 'nenhuma gravação: o banco inteiro é o mesmo antes e depois');
  afirma(await larguraOk(page), 'sem rolagem horizontal');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
}

const FABRICA = { LINHA: 'Linha', ESTRATEGIA_CLIENTES: 'Linha de Estratégia de Clientes', NEGOCIOS: 'Linha de Negócios', PLATAFORMA: 'Linha de Plataforma',
  PLATAFORMA_CANAIS: 'Plataforma de Canais', PLATAFORMA_HABILITADORA_NEGOCIOS: 'Plataforma Habilitadora de Negócios', PLATAFORMA_HABILITADORA_TECNOLOGIA: 'Plataforma Habilitadora de Tecnologia',
  PLATAFORMA_CORPORATIVA: 'Plataforma de Gestão Corporativa', AREA_ESPECIALIZADA: 'Área Especializada', COE: 'Centro de Excelência (CoE)' };
/* sintéticos mais longos que qualquer nome real: um com espaços e um SEM nenhum ponto de quebra */
const LONGOS = Object.assign({}, FABRICA, {
  PLATAFORMA_HABILITADORA_TECNOLOGIA: 'Plataforma Habilitadora de Tecnologia, Dados, Integrações e Serviços Compartilhados de Infraestrutura Corporativa',
  PLATAFORMA_HABILITADORA_NEGOCIOS: 'PLATAFORMA_HABILITADORA_NEGOCIOS_NOME_SINTETICO_SEM_NENHUM_ESPACO_PARA_QUEBRAR',
  COE: 'Centro de Excelência em Arquitetura, Dados e Experiência do Associado (CoE)' });
async function legibilidade(browser, viewport, rotulo, nomes, tituloNomes) {
  console.log('[' + rotulo + '] 4b. filtros legíveis, sem corte (' + tituloNomes + ')');
  const db = semente();
  Object.keys(nomes).forEach((k) => { db.taxonomia.organizacional.conceitos[k].nome = nomes[k]; });
  const { ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?mf=catalogo', ARQ, { db });
  await page.waitForSelector('#mfItens');
  /* espera os nomes OFICIAIS chegarem (o rótulo de contingência também é um nome longo): o estado do módulo tem de ser 'ok' */
  await esperarCondicao(page, () => !!(window.faPosicionamentos && window.faPosicionamentos.estado() === 'ok'), null, { limite: 10000, descricao: 'nomes da Taxonomia carregados' });
  await abrirFiltroPosic(page);
  const r = await page.evaluate((esperados) => {
    const out = { opcoes: 0, cortadas: [], nomesErrados: [], situacao: [] };
    document.querySelectorAll('#mfFiltroPosicionamento label.mf-opcao').forEach((l) => {
      out.opcoes++;
      const nome = l.querySelector('.mf-opcao-nome'), b = l.getBoundingClientRect();
      if (l.scrollWidth > l.clientWidth + 1 || nome.scrollWidth > nome.clientWidth + 1 || b.right > innerWidth + 1 || b.left < -1) out.cortadas.push(nome.textContent + ' (' + Math.round(b.width) + 'px)');
      const valor = l.querySelector('input').value;
      if (esperados[valor] && nome.textContent !== esperados[valor]) out.nomesErrados.push(valor + ': "' + nome.textContent + '"');
    });
    /* a lista de situação continua sendo uma lista suspensa: o texto de cada opção tem de caber nela */
    const s = document.getElementById('mfFiltroSituacao'), cs = getComputedStyle(s), cx = document.createElement('canvas').getContext('2d');
    cx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    const util = s.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 20;
    Array.from(s.options).forEach((o) => { const w = cx.measureText(o.textContent).width; if (w > util) out.situacao.push('"' + o.textContent + '" ' + Math.round(w) + '>' + Math.round(util)); });
    out.semRolagem = document.documentElement.scrollWidth <= innerWidth + 1;
    return out;
  }, Object.fromEntries(LINHA6.concat(['AREA_ESPECIALIZADA', 'COE']).map((k) => [k, nomes[k]])));
  afirma(r.opcoes === 10, 'as 10 opções estão na tela para a medição', String(r.opcoes));
  afirma(!r.nomesErrados.length, 'cada opção mostra o nome oficial inteiro da Taxonomia, sem abreviação', r.nomesErrados.join(' | '));
  afirma(!r.cortadas.length, 'nenhuma opção de posicionamento é cortada nem sai da tela (o texto quebra linha)', r.cortadas.join(' | '));
  afirma(!r.situacao.length, 'as opções do filtro de situação cabem na lista', r.situacao.join(' | '));
  afirma(r.semRolagem, 'sem rolagem horizontal');
  await page.click('label[for="mfPosic-PLATAFORMA_HABILITADORA_TECNOLOGIA"]');
  const resumo = await page.evaluate(() => { const e = document.getElementById('mfFiltroPosicionamentoAtual'), b = e.getBoundingClientRect(); return { texto: e.textContent, cabe: e.scrollWidth <= e.clientWidth + 1 && b.right <= innerWidth + 1 }; });
  afirma(resumo.texto === nomes.PLATAFORMA_HABILITADORA_TECNOLOGIA && resumo.cabe, 'o resumo mostra o nome inteiro da opção escolhida, sem corte', JSON.stringify(resumo));
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
}

async function perfis(browser, viewport, rotulo) {
  console.log('[' + rotulo + '] 7. perfis');
  let { ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?mf=catalogo', AVA);
  await page.waitForSelector('#mfItens');
  afirma((await itensVisiveis(page)).length === 10 && await page.locator('#avaliacoesMapa button:not(.avp-voltar-link):not(.mf-filtrar-categoria):not(#mfLimparFiltros):not(#mfIrMapa):not(#mfSoAcao)').count() === 0,
    'perfil "Avaliação": consulta o catálogo, sem nenhuma ação de gravação');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
  ({ ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?mf=catalogo', SEM));
  await esperarCondicao(page, () => !/^#avaliacoes/.test(location.hash) || !!document.getElementById('mfSemAcesso') || (document.getElementById('page-avaliacoes') || {}).hidden, null, { limite: 10000, descricao: 'sem acesso decidido' });
  afirma(await page.locator('#mfItens').count() === 0 && !/Item Linha/.test(await page.evaluate(() => document.body.innerText)), 'sem acesso à Avaliação: o catálogo não aparece e nenhum item vaza');
  await ctx.close();
}

async function rede(browser, viewport, rotulo) {
  console.log('[' + rotulo + '] 8. rede lenta, leitura recusada e "Tentar de novo"');
  let { ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?mf=catalogo', ARQ, { delays: { 'posicionamento-decisoes': 3000 } });
  await page.waitForSelector('#mfCarregando');
  afirma(await page.locator('#mfItens, #mfVazio').count() === 0, 'leitura lenta: "Carregando…", nunca catálogo vazio');
  await page.waitForSelector('#mfItens', { timeout: 10000 });
  afirma((await itensVisiveis(page)).length === 10, 'quando a leitura chega, o catálogo aparece');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
  ({ ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?mf=catalogo', ARQ, { fail: ['posicionamento-decisoes'] }));
  await page.waitForSelector('#mfErro');
  afirma(await page.locator('#mfItens, #mfVazio').count() === 0 && /Não foi possível ler/.test(await texto(page, '#mfErro')), 'leitura recusada: erro com "Tentar de novo", nenhum catálogo parcial');
  await capturar(page, 'erro-' + (viewport === DESKTOP ? 'desktop' : '375'));
  await page.evaluate(() => { window.__CFG.fail = []; });
  await page.click('#mfTentarDeNovo');
  await page.waitForSelector('#mfItens');
  afirma((await itensVisiveis(page)).length === 10, '"Tentar de novo" recupera quando a leitura volta');
  afirma(await larguraOk(page), 'sem rolagem horizontal');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
}

async function demora(browser) {
  console.log('[desktop] 8b. leitura que não chega: aviso de demora');
  const { ctx, page, erros } = await abrir(browser, DESKTOP, '#avaliacoes?mf=catalogo', ARQ, { delays: { 'posicionamento-decisoes': 60000 } });
  await page.waitForSelector('#mfDemora', { timeout: 16000 });
  afirma(/demorando/.test(await texto(page, '#mfDemora')) && await page.locator('#mfItens').count() === 0, 'depois de 12 s: "demorando mais que o normal", com "Tentar de novo", sem catálogo');
  afirma(!erros.length, 'nenhum erro de JS', erros.join(' | '));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [vp, r] of [[DESKTOP, 'desktop'], [CELULAR, 'celular 375']]) {
      await principal(browser, vp, r); await perfis(browser, vp, r); await rede(browser, vp, r);
    }
    for (const [vp, r] of [[DESKTOP, 'desktop'], [CELULAR, 'celular 375']]) {
      await legibilidade(browser, vp, r, FABRICA, 'nomes oficiais atuais');
      await legibilidade(browser, vp, r, LONGOS, 'nomes sintéticos mais longos');
    }
    await demora(browser);
  } catch (e) { console.log('ERRO', e && e.stack || e); falhas++; }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
