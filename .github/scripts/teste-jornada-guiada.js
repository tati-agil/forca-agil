/* PR 4 — JORNADA GUIADA DO MAPA DA FLORESTA (a "Jornada por objeto": o Catálogo com a trilha de etapas e o próximo
 * passo de cada objeto). Desktop e celular 375 px. Firebase falso em persistência real; hermético. Nada é gravado.
 * Os 8 casos de referência (sem presumir posicionamento: tudo vem da semente, como estaria gravado):
 *   1. Capec — Porta 1, Linha de Negócios pela recomendação firme (decisão opcional), vínculo válido → completa
 *      (Adequação à Squad aparece só como opcional, ramo Linha).
 *   2. Assessoria Previdenciária — Porta 1, decisão registrada, vínculo válido → completa.
 *   3. Jurídico — P1–P16 "A validar" REPRESENTADO pela atuação da Porta 2 (Área Especializada, vínculo válido): o "A
 *      validar" é mostrado como análise de Produto/Serviço, nunca como pendência; sem Squad (Área Especializada).
 *   4. Agilidade — Porta 2 sem P1–P16, CoE, vínculo válido → completa, sem etapa de P1–P16 nem de Squad.
 *   5. Objeto sem Posicionamento → "Iniciar o Posicionamento".
 *   6. Resultado A validar sem decisão → "em análise", ação "Analisar no Posicionamento" (nunca "obrigação de decidir").
 *   7. Firme, sem estrutura do tipo → "Cadastrar estrutura deste tipo" abre o cadastro com o tipo já escolhido (a
 *      pessoa confere; nada é criado), com volta para a jornada (endereço estável, F5).
 *   8. Estrutura existe, vínculo pendente → "Vincular a estrutura responsável" abre a ficha no bloco do vínculo; a
 *      ficha mostra a trilha e volta para a jornada, no mesmo objeto, também depois de F5.
 *   + Atuação encerrada: sem ação. Resumo e "Só os que têm próxima ação". Mapa: abre nas estruturas cadastradas; a
 *     demonstração só por escolha; "Voltar para a jornada do objeto". Perfil de consulta: sem ações de gravar. Rede
 *     lenta: "Carregando…", nunca "Jornada completa" antes de os vínculos chegarem. 375 px sem rolagem lateral. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const M = require(path.join(__dirname, '..', '..', 'forca-agil', 'motor-posicionamento.js'));
const MOTOR_PRODUTO = require('./montar-regras-posicionamento.js').MOTOR_PRODUTO;
const ARQ = 'arquitetura@previ.com.br', AVAL = 'avaliacao@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const QUANDO = '2026-10-01T09:00:00.000Z';
let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

const ORDEM_P = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao', 'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
function produto(id, nome, resultado) {
  const r = {}; ORDEM_P.forEach((q, i) => { r[q] = { valor: 'sim', justificativaAuto: 'i', codigoPergunta: 'P' + (i + 1), textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 }; });
  return { itemId: id, nome, descricao: '', publico: '', necessidade: '', observacoesGerais: '', status: 'concluido', resultadoAutomatico: resultado || 'produto', decisaoFinal: resultado || 'produto',
    camadaSugerida: { id: 'produto-principal', label: 'Produto/Serviço principal' }, respostas: r, justificativaAutomatica: 'j', criteriosEssenciaisFalhos: [], criteriosAtendidos: 5,
    motorVersion: MOTOR_PRODUTO, motorVersionArquitetura: 1, questionnaireContentVersion: 1, excluido: false, criadoEm: QUANDO, atualizadoEm: QUANDO, versao: 1, responsavel: { name: 'F', email: 'f@previ.com.br' } };
}
const outra = { name: 'Outra', email: 'o@previ.com.br' };
function concluida(itemId, itemNome, respostas, extra) {
  const res = M.avaliar(respostas, {}), ra = {};
  Object.keys(res).forEach((k) => { const v = res[k]; if (v !== null && !(Array.isArray(v) && !v.length)) ra[k] = v; });
  const reg = { itemId, itemNome, questionarioCodigo: 'POSICIONAMENTO_ORGANIZACIONAL', questionnaireContentVersion: 1, versao: 1, status: 'concluido', revisao: 2, respostas: {}, resultadoAutomatico: ra,
    criadoPor: outra, criadoEm: QUANDO, atualizadoPor: outra, atualizadoEm: QUANDO, concluidoPor: outra, concluidoEm: QUANDO, auditoriaCriacaoId: 'ac' + itemId, auditoriaConclusaoId: 'az' + itemId };
  Object.keys(respostas).forEach((q) => { reg.respostas[q] = { resposta: respostas[q], codigoPergunta: q, questionnaireContentVersion: 1, dataResposta: QUANDO }; });
  return Object.assign(reg, extra || {});
}
const P2 = { origem: 'objeto-organizacional', hipoteseInicial: 'NAO_SEI' };
const objeto = (nome, extra) => Object.assign({ nome, descricao: 'Descrição', finalidade: 'Finalidade', situacao: 'ativo', revisao: 1, criadoPor: { uid: 'u', email: ARQ }, criadoEm: 1, atualizadoPor: { uid: 'u', email: ARQ }, atualizadoEm: 1, auditoriaId: 'a' }, extra || {});
const estrutura = (id, tipo, nome) => ({ id, tipo, nome, situacao: 'ativa', revisao: 1, criadaEm: 1791713600000, criadaPor: { id: 'semente', email: 'semente@teste' }, ultimaOperacao: 'op-' + id });
const vinculo = (id, objetoId, estruturaId, avaliacaoId, codigo, origem) => ({ id, objetoId, estruturaId, papel: 'responsavel-principal', base: { avaliacaoId, codigo, origem }, situacao: 'ativa', revisao: 1,
  criadoEm: 1791713600000, criadoPor: { id: 'semente', email: 'semente@teste' }, ultimaOperacao: 'op-' + id, ultimoEvento: 'op-' + id + ':1' });
const NEG = { O1: 'SIM', O2: 'NAO', O3: 'NAO', O4: 'NAO', O5: 'SIM' }, AE = { O1: 'NAO', O2: 'SIM', O3: 'NAO' }, COE = { O1: 'NAO', O2: 'NAO', O3: 'SIM' };
const CANAIS = { O1: 'SIM', O2: 'NAO', O3: 'NAO', O4: 'NAO', O5: 'NAO', O6: 'SIM', O7: 'NAO', O8: 'NAO', O9: 'NAO' }, CONFLITO = { O1: 'NAO', O2: 'SIM', O3: 'SIM' };
function semente() {
  const aut = {}; aut[chave(ARQ)] = { email: ARQ, tipo: 'avaliacao-arquitetura' }; aut[chave(AVAL)] = { email: AVAL, tipo: 'avaliacao' };
  const users = {}; [ARQ, AVAL].forEach((e) => { users[chave(e)] = { name: 'Pessoa', email: e, area: 'INFOR' }; });
  const conceitos = {}, fontes = {}, ligacoes = {};
  M.CODIGOS_FIRMES.concat(['LINHA', 'PLATAFORMA']).forEach((c, i) => {
    conceitos[c] = { nome: 'Tx ' + c, ordem: i + 1, ativo: true, situacaoDefinicao: 'registrada', camada: 'A', definicaoVigenteFonteId: 'f1' };
    fontes[c] = { f1: { texto: 'Definição de ' + c, contexto: 'PREVI', situacao: 'vigente', tipoRedacao: 'Conceito' } };
  });
  M.CODIGOS_FIRMES.forEach((c) => { ligacoes[c] = { registradoEm: QUANDO, registradoPor: ARQ, auditoriaId: 'l' }; });
  const CA = M.avaliar(CONFLITO, { N1: 'mesma' }), raC = {};
  Object.keys(CA).forEach((k) => { const v = CA[k]; if (v !== null && !(Array.isArray(v) && !v.length)) raC[k] = v; });
  return {
    'fa-users': users, 'fa-admins': {}, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {},
    'fa-avaliacao-autorizados': aut, 'avaliacoes-squad': {}, 'motor-squad-config': {},
    'estruturas-concretas-config': { gravacaoHabilitada: true },
    'avaliacoes-produto': { pCapec: produto('pCapec', 'Capec'), pAssess: produto('pAssess', 'Assessoria Previdenciária'), pJur: produto('pJur', 'Jurídico (P1–P16)', 'a-validar'),
      pSem: produto('pSem', 'Objeto sem Posicionamento'), pVal: produto('pVal', 'Objeto A validar'), pPlat: produto('pPlat', 'Gestão de canais'), pVinc: produto('pVinc', 'Produto a vincular') },
    'objetos-organizacionais': { oJur: objeto('Assessoramento jurídico', { referenciaItemId: 'pJur' }), oAgi: objeto('Disseminação de agilidade'),
      oEnc: objeto('Atuação encerrada', { situacao: 'encerrado', revisao: 2, encerramento: { motivo: 'Incorporada', em: 2, por: { uid: 'u', email: ARQ } } }) },
    'avaliacoes-posicionamento': {
      gC: concluida('pCapec', 'Capec', NEG, { avaliacaoArquiteturalId: 'pCapec' }), gS: concluida('pAssess', 'Assessoria Previdenciária', NEG, { avaliacaoArquiteturalId: 'pAssess' }),
      gJ: concluida('oJur', 'Assessoramento jurídico', AE, P2), gA: concluida('oAgi', 'Disseminação de agilidade', COE, P2),
      gV: Object.assign(concluida('pVal', 'Objeto A validar', CONFLITO, { avaliacaoArquiteturalId: 'pVal' }), { resultadoAutomatico: raC, diagnosticos: { N1: { resposta: 'mesma', papeis: ['AREA_ESPECIALIZADA', 'COE'], questionnaireContentVersion: 1, dataResposta: QUANDO } } }),
      gP: concluida('pPlat', 'Gestão de canais', CANAIS, { avaliacaoArquiteturalId: 'pPlat' }), gPV: concluida('pVinc', 'Produto a vincular', NEG, { avaliacaoArquiteturalId: 'pVinc' })
    },
    'posicionamento-vigente-por-item': { pCapec: 'gC', pAssess: 'gS', oJur: 'gJ', oAgi: 'gA', pVal: 'gV', pPlat: 'gP', pVinc: 'gPV' },
    'posicionamento-rascunho-por-item': {},
    'posicionamento-decisoes': {
      gS: { itemId: 'pAssess', versaoAvaliacao: 1, versaoMotor: 1, codigoAutomatico: 'NEGOCIOS', codigoFinal: 'NEGOCIOS', tipoDecisao: 'CONFIRMACAO', nomeNaDecisao: { nome: 'Tx NEGOCIOS', contingencia: false }, liberaSquad: true, decididoPor: outra, decididoEm: QUANDO, auditoriaId: 'd1' },
      gJ: { itemId: 'oJur', versaoAvaliacao: 1, versaoMotor: 1, codigoAutomatico: 'AREA_ESPECIALIZADA', codigoFinal: 'AREA_ESPECIALIZADA', tipoDecisao: 'CONFIRMACAO', nomeNaDecisao: { nome: 'Tx AREA_ESPECIALIZADA', contingencia: false }, liberaSquad: false, decididoPor: outra, decididoEm: QUANDO, auditoriaId: 'd2' }
    },
    'posicionamento-auditoria': {}, 'posicionamento-classificacoes': ligacoes,
    'estruturas-concretas': { registros: { 'neg-1': estrutura('neg-1', 'NEGOCIOS', 'Linha de Previdência'), jur: estrutura('jur', 'AREA_ESPECIALIZADA', 'Jurídico'), 'coe-ag': estrutura('coe-ag', 'COE', 'CoE de Agilidade') } },
    'estruturas-vinculos': {
      registros: { v1: vinculo('v1', 'pCapec', 'neg-1', 'gC', 'NEGOCIOS', 'recomendacao'), v2: vinculo('v2', 'pAssess', 'neg-1', 'gS', 'NEGOCIOS', 'decisao'),
        v3: vinculo('v3', 'oJur', 'jur', 'gJ', 'AREA_ESPECIALIZADA', 'decisao'), v4: vinculo('v4', 'oAgi', 'coe-ag', 'gA', 'COE', 'recomendacao') },
      'ativo-por-objeto': { pCapec: 'v1', pAssess: 'v2', oJur: 'v3', oAgi: 'v4' }
    },
    taxonomia: { organizacional: { conceitos, fontes } }
  };
}
async function abrir(browser, viewport, hash, opts) {
  opts = opts || {};
  const email = opts.email || ARQ;
  const cfg = { db: semente(), user: { email, emailVerified: true, uid: 'u-' + chave(email) }, delayDefault: 10, persistenciaReal: true, delays: opts.delays || {} };
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
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
const hash = (page) => page.evaluate(() => location.hash);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const card = (id) => '#mfCatalogo .mf-item[data-item="' + id + '"]';
const etapas = (page, id) => page.$$eval(card(id) + ' .mf-trilha .mf-etapa', (ls) => ls.map((l) => l.dataset.etapa + ':' + l.dataset.estado).join(' '));
const acao = (page, id) => page.evaluate((s) => { const a = document.querySelector(s + ' .mf-acao'); return a ? { t: a.textContent.trim(), h: a.getAttribute('href') } : null; }, card(id));
const pronta = (page) => esperarCondicao(page, () => { const r = document.getElementById('mfResumo'); return !!r && /Jornada completa/.test(r.textContent); }, undefined, { limite: 15000 });

async function rodada(browser, viewport, rotulo) {
  console.log('\n=== ' + rotulo + ' ===');
  let { ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?mf=catalogo');
  await page.waitForSelector(card('pCapec'), { timeout: 15000 });
  await pronta(page);

  console.log('Resumo e os 8 casos');
  afirma(/Jornada completa: 4 · Com próxima ação: 3 · Em análise \(A validar\): 1 · Encerradas: 1/.test((await texto(page, '#mfResumo')).replace(/\s+/g, ' ')), 'resumo: 4 completas, 3 com próxima ação, 1 em análise, 1 encerrada', await texto(page, '#mfResumo'));
  afirma((await etapas(page, 'pCapec')) === 'p1p16:ok posicionamento:ok decisao:opcional estrutura:ok vinculo:ok squad:opcional' && /Jornada completa/.test(await texto(page, card('pCapec'))),
    '1. Capec: completa; decisão opcional (recomendação firme); Squad só opcional', await etapas(page, 'pCapec'));
  const mapaCapec = await acao(page, 'pCapec');
  afirma(mapaCapec && mapaCapec.h === '#avaliacoes?mf=mapa&e=neg-1&item=pCapec', '1. Capec: "Ver no Mapa" leva à estrutura responsável', JSON.stringify(mapaCapec));
  afirma((await etapas(page, 'pAssess')).indexOf('decisao:ok') !== -1 && /Jornada completa/.test(await texto(page, card('pAssess'))), '2. Assessoria Previdenciária: decisão registrada, completa');
  const tJur = await texto(page, card('pJur'));
  afirma(/Representado pela atuação “Assessoramento jurídico”/.test(tJur) && /A validar — análise de Produto\/Serviço; não é pendência/.test(tJur) && !(await page.$(card('pJur') + ' .mf-trilha')) &&
    (await acao(page, 'pJur')).h === '#avaliacoes?mf=catalogo&item=oJur', '3. Jurídico P1–P16: representado pela atuação; "A validar" explicado, sem pendência; leva à atuação');
  afirma((await etapas(page, 'oJur')) === 'atuacao:ok posicionamento:ok decisao:ok estrutura:ok vinculo:ok', '3. Jurídico (atuação): completa, sem etapa de Squad (Área Especializada)', await etapas(page, 'oJur'));
  afirma((await etapas(page, 'oAgi')) === 'atuacao:ok posicionamento:ok decisao:opcional estrutura:ok vinculo:ok' && /Jornada completa/.test(await texto(page, card('oAgi'))),
    '4. Agilidade: Porta 2 sem P1–P16, CoE, completa, sem Squad', await etapas(page, 'oAgi'));
  const aSem = await acao(page, 'pSem');
  afirma(aSem && /Iniciar o Posicionamento/.test(aSem.t) && aSem.h === '#avaliacoes?po=escolher&item=pSem', '5. sem Posicionamento: "Iniciar o Posicionamento"', JSON.stringify(aSem));
  const aVal = await acao(page, 'pVal');
  afirma((await etapas(page, 'pVal')).indexOf('decisao:analise') !== -1 && aVal && /Analisar no Posicionamento/.test(aVal.t) && !/Registrar/.test(await texto(page, card('pVal'))) &&
    /reavalie|decisão fundamentada/.test(await texto(page, card('pVal'))), '6. A validar: em análise, "Analisar no Posicionamento" — nunca obrigação de decidir');
  const aPlat = await acao(page, 'pPlat');
  afirma((await etapas(page, 'pPlat')).indexOf('estrutura:atual') !== -1 && aPlat && aPlat.h === '#admin?arq=estruturas&nova=PLATAFORMA_CANAIS&objeto=pPlat', '7. firme sem estrutura do tipo: "Cadastrar estrutura deste tipo"', JSON.stringify(aPlat));
  const aVinc = await acao(page, 'pVinc');
  afirma(/estrutura disponível \(não quer dizer vinculada\)/.test(await texto(page, card('pVinc'))) && aVinc && /Vincular a estrutura responsável/.test(aVinc.t) && aVinc.h === '#avaliacoes?po=gPV&bloco=responsavel',
    '8. estrutura existe, vínculo pendente: "Vincular" (estrutura disponível ≠ vinculada)', JSON.stringify(aVinc));
  afirma(/Atuação encerrada/.test(await texto(page, card('oEnc'))) && !(await page.$(card('oEnc') + ' .mf-acao')), 'atuação encerrada: sem ação');
  await page.click('#mfSoAcao');
  const soAcao = await page.$$eval('#mfItens .mf-item', (ls) => ls.map((l) => l.dataset.item).sort().join(','));
  afirma(soAcao === 'pPlat,pSem,pVal,pVinc', '"Só os que têm próxima ação": os 3 com próxima ação e o que está em análise', soAcao);
  afirma(await larguraOk(page), 'jornada sem rolagem lateral');
  const baixos = await page.$$eval('#mfItens .mf-acao, #mfSoAcao', (els) => els.filter((e) => e.getBoundingClientRect().height < 44).length);
  afirma(baixos === 0, 'ações com área de toque ≥ 44 px');

  console.log('Ida e volta pelo endereço');
  await page.click(card('pVinc') + ' .mf-acao');
  await page.waitForSelector('#poJornada', { timeout: 10000 });
  await esperarCondicao(page, () => location.hash === '#avaliacoes?po=gPV', undefined, { limite: 5000 });
  afirma(!!(await page.$('#poBlocoResponsavel')) && /Decisão final/.test(await texto(page, '#poJornada')), 'ficha aberta (endereço da ficha) com a trilha e o bloco da estrutura responsável');
  await page.click('#poVoltarJornada');
  await page.waitForSelector(card('pVinc') + '.mf-item--foco', { timeout: 10000 });
  afirma((await hash(page)) === '#avaliacoes?mf=catalogo&item=pVinc', 'volta à jornada no mesmo objeto (destacado), endereço estável');
  await page.reload({ waitUntil: 'domcontentloaded' }); await esperarSessaoAssentada(page);
  await page.waitForSelector(card('pVinc') + '.mf-item--foco', { timeout: 15000 });
  afirma(true, 'F5: o mesmo objeto continua em foco');
  await page.evaluate(() => { location.hash = '#avaliacoes?mf=mapa&e=neg-1&item=pCapec'; });
  await page.waitForSelector('#mfmVoltarJornada', { timeout: 15000 });
  afirma(/estruturas cadastradas/.test(await texto(page, '.mfm-subtitulo')), 'Mapa vindo da jornada: estruturas cadastradas (não a demonstração)');
  await page.click('#mfmDetalheVoltarJornada');
  await page.waitForSelector(card('pCapec') + '.mf-item--foco', { timeout: 10000 });
  afirma(true, 'do Mapa, volta para a jornada do objeto');
  await page.click('#mfIrMapa');
  await page.waitForSelector('.mfm-subtitulo');
  afirma(/estruturas cadastradas/.test(await texto(page, '.mfm-subtitulo')), '"Ver o Mapa da Floresta": estruturas cadastradas');
  await page.click('.mfm-fonte[data-fonte="demo"]');
  await esperarCondicao(page, () => /demonstração/.test((document.querySelector('.mfm-subtitulo') || {}).textContent || ''), undefined, { limite: 5000 });
  afirma(/fonte=demo/.test(await hash(page)), 'a demonstração é escolha explícita (e fica no endereço)');

  console.log('Cadastrar estrutura com o tipo já escolhido');
  await page.evaluate(() => { location.hash = '#admin?arq=estruturas&nova=PLATAFORMA_CANAIS&objeto=pPlat'; });
  await page.waitForSelector('#estForm', { timeout: 15000 });
  await esperarCondicao(page, () => { const r = document.querySelector('#estTipos input[value="PLATAFORMA_CANAIS"]'); return !!r && r.checked; }, undefined, { limite: 15000 });
  const qtd = await page.evaluate(() => Object.keys((window.__CFG.__dbReal['estruturas-concretas'] || {}).registros || {}).length);
  afirma(qtd === 3 && !!(await page.$('#estVoltarJornada')), 'formulário com o tipo marcado, nada criado, com "Voltar para a jornada do objeto"');
  await page.reload({ waitUntil: 'domcontentloaded' }); await esperarSessaoAssentada(page);
  await esperarCondicao(page, () => { const r = document.querySelector('#estTipos input[value="PLATAFORMA_CANAIS"]'); return !!r && r.checked && !!document.getElementById('estVoltarJornada'); }, undefined, { limite: 15000 });
  afirma(true, 'F5: o mesmo formulário, com o tipo e a volta');
  afirma(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();

  console.log('Perfil de consulta e rede lenta');
  ({ ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?mf=catalogo', { email: AVAL }));
  await page.waitForSelector(card('pSem'), { timeout: 15000 });
  await pronta(page);
  afirma(!(await page.$(card('pSem') + ' .mf-acao')) && /somente consulta/.test(await texto(page, card('pSem'))) && !!(await page.$(card('pCapec') + ' .mf-acao')),
    'consulta: sem ações de gravar (só "Ver no Mapa"), com o próximo passo explicado');
  await ctx.close();
  ({ ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?mf=catalogo', { delays: { 'estruturas-vinculos': 4000 } }));
  await page.waitForSelector(card('pCapec'), { timeout: 15000 });
  const cedo = await texto(page, '#mfCatalogo');
  afirma(/Carregando/.test(cedo) && !/Jornada completa/.test(cedo), 'rede lenta: "Carregando…", nunca "Jornada completa" antes de os vínculos chegarem');
  await pronta(page);
  afirma(/Jornada completa/.test(await texto(page, card('pCapec'))), 'quando os vínculos chegam, a jornada se completa');
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
