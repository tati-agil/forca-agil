/* PORTA 2 (PR 3) — a JORNADA das duas portas, com a hipótese inicial. Desktop e celular 375 px. Firebase falso em
 * persistência real; hermético. As regras do banco (hipótese obrigatória, objetos, ciclo de vida) são provadas no
 * emulador por teste-rules-objetos-organizacionais.js; o reconhecimento por teste-porta2-reconhecimento.js.
 *   1. Lista: as duas portas lado a lado; "+ Posicionar uma atuação organizacional" abre a lista das atuações (endereço próprio).
 *   2. Cadastro da atuação: obrigatórios explicados, referência informativa com os itens indisponíveis desabilitados e o
 *      motivo (o rascunho do "Jurídico" impede a referência — nada é descartado sozinho); grava com revisão e auditoria.
 *   3. Hipótese obrigatória: "Iniciar" travado até escolher; a hipótese nunca aparece durante as perguntas; o resultado
 *      a compara com a recomendação automática — não confirmada (com a regra do motor), confirmada, "Não sei" (sem
 *      comparação) e "não registrada" (avaliação antiga).
 *   4. Edição: revisão + 1, antes → depois na auditoria, referência fixa.
 *   5. Reavaliar na Porta 2: o modal exige hipótese nova; a nova versão mantém a origem e usa o nome atual da atuação.
 *   6. Encerrar: com rascunho aberto, a tela explica e não encerra; sem rascunho, motivo obrigatório → encerrada (final),
 *      sem "Iniciar".
 *   7. Nota provisória de Estratégia de Clientes no resultado (a recomendação não muda).
 *   8. Celular 375 px: sem rolagem lateral; opções da hipótese com área de toque adequada. Nenhum erro de página. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const M = require(path.join(__dirname, '..', '..', 'forca-agil', 'motor-posicionamento.js'));
const MOTOR_PRODUTO = require('./montar-regras-posicionamento.js').MOTOR_PRODUTO;
const ARQ = 'arquitetura@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const QUANDO = '2026-10-01T09:00:00.000Z';
const ORIGEM = 'objeto-organizacional';
let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

const ORDEM_P = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao', 'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
function produto(id, nome) {
  const r = {}; ORDEM_P.forEach((q, i) => { r[q] = { valor: 'sim', justificativaAuto: 'i', codigoPergunta: 'P' + (i + 1), textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 }; });
  return { itemId: id, nome, descricao: '', publico: '', necessidade: '', observacoesGerais: '', status: 'concluido', resultadoAutomatico: 'produto', decisaoFinal: 'produto', camadaSugerida: { id: 'produto-principal', label: 'Produto/Serviço principal' },
    respostas: r, justificativaAutomatica: 'j', criteriosEssenciaisFalhos: [], criteriosAtendidos: 5, motorVersion: MOTOR_PRODUTO, motorVersionArquitetura: 1, questionnaireContentVersion: 1,
    excluido: false, criadoEm: QUANDO, atualizadoEm: QUANDO, versao: 1, responsavel: { name: 'F', email: 'f@previ.com.br' } };
}
const outra = { name: 'Outra', email: 'o@previ.com.br' };
function registro(itemId, itemNome, respostas, extra) {
  const reg = { itemId, itemNome, questionarioCodigo: 'POSICIONAMENTO_ORGANIZACIONAL', questionnaireContentVersion: 1, versao: 1, status: 'rascunho', revisao: 2, respostas: {},
    criadoPor: outra, criadoEm: QUANDO, atualizadoPor: outra, atualizadoEm: QUANDO, auditoriaCriacaoId: 'ac' + itemId };
  Object.keys(respostas).forEach((q) => { reg.respostas[q] = { resposta: respostas[q], codigoPergunta: q, questionnaireContentVersion: 1, dataResposta: QUANDO }; });
  return Object.assign(reg, extra || {});
}
function concluida(itemId, itemNome, respostas, extra) {
  const res = M.avaliar(respostas, {}), ra = {};
  Object.keys(res).forEach((k) => { const v = res[k]; if (v !== null && !(Array.isArray(v) && !v.length)) ra[k] = v; });
  return registro(itemId, itemNome, respostas, Object.assign({ status: 'concluido', resultadoAutomatico: ra, concluidoPor: outra, concluidoEm: QUANDO, auditoriaConclusaoId: 'az' + itemId }, extra || {}));
}
const objeto = (nome, extra) => Object.assign({ nome, descricao: 'Descrição de ' + nome, finalidade: 'Finalidade de ' + nome, situacao: 'ativo', revisao: 1,
  criadoPor: { uid: 'u', email: ARQ }, criadoEm: 1791713600000, atualizadoPor: { uid: 'u', email: ARQ }, atualizadoEm: 1791713600000, auditoriaId: 'a1' }, extra || {});
function semente() {
  const aut = {}; aut[chave(ARQ)] = { email: ARQ, tipo: 'avaliacao-arquitetura' };
  const users = {}; users[chave(ARQ)] = { name: 'Arquiteta', email: ARQ, area: 'INFOR' };
  const conceitos = {}, fontes = {};
  M.CODIGOS_FIRMES.concat(['LINHA', 'PLATAFORMA']).forEach((c, i) => {
    conceitos[c] = { nome: 'Tx ' + c, ordem: i + 1, ativo: true, camada: 'A', definicao: { texto: 'Definição de ' + c, versao: 1, publicadaEm: '2026-10-01T09:00:00.000Z', publicadaPor: 'semente@teste' } };
  });
  const EC = { O1: 'SIM', O2: 'NAO', O3: 'NAO', O4: 'SIM', O5: 'NAO' };
  return {
    'fa-users': users, 'fa-admins': {}, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {},
    'fa-avaliacao-autorizados': aut, 'avaliacoes-squad': {}, 'motor-squad-config': {},
    'avaliacoes-produto': { pCapec: produto('pCapec', 'Capec'), pJur: produto('pJur', 'Jurídico (P1–P16)'), pLivre: produto('pLivre', 'Item livre'), pEC: produto('pEC', 'Relacionamento') },
    'objetos-organizacionais': { oFim: objeto('Atuação a encerrar'), oComRasc: objeto('Atuação com rascunho') },
    'avaliacoes-posicionamento': {
      gJur: registro('pJur', 'Jurídico (P1–P16)', {}, { avaliacaoArquiteturalId: 'pJur', revisao: 1 }),
      gEC: concluida('pEC', 'Relacionamento', EC, { avaliacaoArquiteturalId: 'pEC' }),
      gR: registro('oComRasc', 'Atuação com rascunho', {}, { origem: ORIGEM, hipoteseInicial: 'COE', revisao: 1 })
    },
    'posicionamento-vigente-por-item': { pEC: 'gEC' },
    'posicionamento-rascunho-por-item': { pJur: 'gJur', oComRasc: 'gR' },
    'posicionamento-decisoes': {}, 'posicionamento-auditoria': {},
    taxonomia: { organizacional: { conceitos, fontes } }
  };
}
async function abrir(browser, viewport, hash) {
  const cfg = { db: semente(), user: { email: ARQ, emailVerified: true, uid: 'u-' + chave(ARQ) }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  page.on('dialog', (d) => d.accept());
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
const hash = (page) => page.evaluate(() => location.hash);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const desabilitado = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && e.disabled; }, sel);
const responder = async (page, q, v) => { await page.click('#avaliacoesPosicionamento .po-resp[data-q="' + q + '"][data-v="' + v + '"]'); };
const objetoPorNome = (db, nome) => Object.entries(db['objetos-organizacionais'] || {}).find(([, o]) => o.nome === nome);

async function rodada(browser, viewport, rotulo) {
  console.log('\n=== ' + rotulo + ' ===');
  const { ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?po=lista');

  console.log('1. As duas portas');
  await page.waitForSelector('#poAtuacoesBtn');
  afirma(!!(await page.$('#poNovoBtn')) && /não precisa de P1–P16/.test(await texto(page, '#poDuasPortas')), 'lista: Porta 1 e Porta 2 lado a lado, com a diferença explicada');
  await page.click('#poAtuacoesBtn');
  await page.waitForSelector('#poAtuacoes #poNovaAtuacaoBtn');
  afirma((await hash(page)) === '#avaliacoes?po=atuacoes' && /Atuação a encerrar/.test(await texto(page, '#poListaAtuacoes')), 'lista das atuações em #avaliacoes?po=atuacoes');

  console.log('2. Cadastro da atuação');
  await page.click('#poNovaAtuacaoBtn');
  await page.waitForSelector('#poFormAtuacao');
  afirma((await hash(page)) === '#avaliacoes?po=nova-atuacao', 'cadastro em #avaliacoes?po=nova-atuacao');
  /* Caminho A: um campo (a responsabilidade); a referência informativa fica recolhida, opcional */
  await page.click('#poSalvarAtuacaoBtn');
  await page.waitForSelector('#poAtuacaoErros');
  afirma(/obrigatório/.test(await texto(page, '#poAtuacaoErros')) && !objetoPorNome(await banco(page), 'Desenvolvimento de competências em agilidade'),
    'sem a responsabilidade: explica o que falta e não grava');
  await page.click('#poMaisInfo > summary');
  const opJur = await page.$eval('#poAtuacaoRef option[value="pJur"]', (o) => ({ dis: o.disabled, t: o.textContent }));
  const opLivre = await page.$eval('#poAtuacaoRef option[value="pLivre"]', (o) => o.disabled);
  afirma(opJur.dis && /rascunho de Posicionamento em andamento/.test(opJur.t) && !opLivre, 'referência: o "Jurídico" (rascunho aberto) aparece desabilitado com o motivo; item livre disponível');
  await page.fill('#poAtuacao_descricao', 'Desenvolvimento de competências em agilidade');
  await page.selectOption('#poAtuacaoRef', 'pLivre');
  await page.click('#poSalvarAtuacaoBtn');
  await page.waitForSelector('#poAtuacaoSelecionada', { timeout: 10000 });
  let db = await banco(page);
  const [idAg, ag] = objetoPorNome(db, 'Desenvolvimento de competências em agilidade') || [];
  afirma(!!ag && ag.situacao === 'ativo' && ag.revisao === 1 && ag.referenciaItemId === 'pLivre' && db['objetos-organizacionais-por-referencia'] && db['objetos-organizacionais-por-referencia'].pLivre === idAg &&
    Object.values((db['objetos-organizacionais-auditoria'] || {})[idAg] || {}).some((x) => x.tipo === 'criacao'), 'grava a atuação (ativa, revisão 1, referência e índice, auditoria de criação)');
  afirma((await hash(page)) === '#avaliacoes?po=atuacoes&item=' + idAg && /Responsabilidade registrada/.test(await texto(page, '#poFlash')) && /indique sua hipótese inicial para começar a avaliação O1–O9/.test(await texto(page, '#poProximoPasso')), 'depois de salvar: a atuação aberta, pedindo a hipótese', (await hash(page)) + ' | ' + (await texto(page, '#poFlash')));

  console.log('3. Hipótese obrigatória, oculta nas perguntas, comparada no resultado');
  afirma(await desabilitado(page, '#poIniciarAtuacaoBtn') && /Escolha a hipótese inicial/.test(await texto(page, '#poHipoteseFalta')), '"Iniciar" travado até escolher a hipótese');
  const alturas = await page.$$eval('#poHipoteseIniciar .po-hipotese-opcao', (ls) => ls.map((l) => l.getBoundingClientRect().height));
  afirma(alturas.length === 9 && alturas.every((h) => h >= 40), 'as 9 opções (8 posicionamentos + Não sei) com área de toque adequada', JSON.stringify(alturas));
  await page.click('#poHipoteseIniciar input[value="COE"]');
  await page.click('#poIniciarAtuacaoBtn');
  await page.waitForSelector('#poChecklist', { timeout: 10000 });
  const chk = await texto(page, '#avaliacoesPosicionamento');
  afirma(!/Hipótese inicial/.test(chk) && !(await page.$('.po-hipotese')), 'durante as perguntas, a hipótese não aparece');
  await responder(page, 'O1', 'NAO'); await responder(page, 'O2', 'SIM'); await responder(page, 'O3', 'NAO');
  await esperarCondicao(page, () => !document.getElementById('poConcluirBtn').disabled, undefined, { limite: 10000 });
  await page.click('#poConcluirBtn');
  await page.waitForSelector('#poBlocoHipotese', { timeout: 10000 });
  afirma((await page.getAttribute('#poHipotese', 'data-comparacao')) === 'nao-confirmada' && /Tx AREA_ESPECIALIZADA/.test(await texto(page, '#poHipoteseComparacao')) && /regra do motor/.test(await texto(page, '#poHipoteseComparacao')),
    'hipótese CoE × recomendação Área Especializada: "não confirmada", com a regra do motor');
  db = await banco(page);
  const regAg = Object.values(db['avaliacoes-posicionamento']).find((r) => r.itemId === idAg);
  afirma(regAg.origem === ORIGEM && regAg.hipoteseInicial === 'COE' && regAg.resultadoAutomatico.codigoResultado === 'AREA_ESPECIALIZADA', 'gravado: origem Porta 2, hipótese CoE, resultado do motor (a hipótese não mudou nada)');
  /* Porta 1 com hipótese que se confirma */
  await page.evaluate(() => { location.hash = '#avaliacoes?po=escolher&item=pCapec'; });
  await page.waitForSelector('#poHipoteseIniciar');
  afirma(await desabilitado(page, '#poIniciarBtn'), 'Porta 1: "Iniciar" também travado até escolher a hipótese');
  await page.click('#poHipoteseIniciar input[value="NEGOCIOS"]');
  await page.click('#poIniciarBtn');
  await page.waitForSelector('#poChecklist');
  for (const [q, v] of [['O1', 'SIM'], ['O2', 'NAO'], ['O3', 'NAO'], ['O4', 'NAO'], ['O5', 'SIM']]) await responder(page, q, v);
  await esperarCondicao(page, () => !document.getElementById('poConcluirBtn').disabled, undefined, { limite: 10000 });
  await page.click('#poConcluirBtn');
  await page.waitForSelector('#poBlocoHipotese', { timeout: 10000 });
  afirma((await page.getAttribute('#poHipotese', 'data-comparacao')) === 'confirmada', 'Porta 1: hipótese Negócios × recomendação Negócios = "confirmada"');
  await page.evaluate(() => { location.hash = '#avaliacoes?po=gEC'; });
  await page.waitForSelector('#poBlocoHipotese');
  afirma((await page.getAttribute('#poHipotese', 'data-comparacao')) === 'nao-registrada', 'avaliação antiga, sem hipótese: "não registrada" (nada inventado)');

  console.log('7. Nota provisória de Estratégia de Clientes');
  afirma(/comparação com Plataforma/.test(await texto(page, '#poNotaEstrategiaClientes')) && /Tx ESTRATEGIA_CLIENTES/.test(await texto(page, '#poRecomendado')), 'resultado Estratégia de Clientes: a nota aparece e a recomendação não muda');

  console.log('4. Edição da atuação');
  await page.evaluate((id) => { location.hash = '#avaliacoes?po=atuacoes&item=' + id; }, idAg);
  await page.waitForSelector('#poEditarAtuacaoBtn');
  await page.click('#poEditarAtuacaoBtn');
  await page.waitForSelector('#poFormAtuacao');
  afirma(/fixada no cadastro/.test(await texto(page, '#poAtuacaoRefFixa')) && !(await page.$('#poAtuacaoRef')), 'na edição, a referência é fixa');
  /* registrada com uma descrição só: a edição tem um campo (sem nome, finalidade e contexto repetidos) */
  const camposEd = await page.$$eval('#poFormAtuacao input, #poFormAtuacao textarea', (l) => l.filter((x) => x.offsetParent).map((x) => x.id));
  afirma(camposEd.join() === 'poAtuacao_descricao' && /Editar responsabilidade/.test(await texto(page, '#poFormAtuacao h3')) && /Salvar alterações/i.test(await texto(page, '#poSalvarAtuacaoBtn')), 'edição simples: um campo, "Salvar alterações"', camposEd.join() + ' | ' + (await texto(page, '#poFormAtuacao h3')) + ' | ' + (await texto(page, '#poSalvarAtuacaoBtn')));
  const ctxAntes = (await banco(page))['objetos-organizacionais'][idAg].contexto;
  await page.fill('#poAtuacao_descricao', 'Desenvolvimento de competências em agilidade organizacional');
  await page.click('#poSalvarAtuacaoBtn');
  await page.waitForSelector('#poAtuacaoSelecionada');
  db = await banco(page);
  const alt = Object.values(db['objetos-organizacionais-auditoria'][idAg]).find((x) => x.tipo === 'alteracao'), oe = db['objetos-organizacionais'][idAg];
  afirma(oe.revisao === 2 && oe.nome === 'Desenvolvimento de competências em agilidade organizacional' && oe.descricao === oe.nome && oe.finalidade === oe.nome && oe.contexto === ctxAntes && alt && alt.antes.descricao !== alt.depois.descricao,
    'edição: revisão 2, a descrição nova nos campos exigidos, contexto intacto, auditoria com antes → depois');
  afirma(!/Cadastro simplificado/.test(await texto(page, '#poAtuacaoSelecionada')), 'a nota técnica do cadastro não aparece como contexto (continua gravada)');

  console.log('5. Reavaliar na Porta 2');
  await page.click('.po-item-abrir');
  await page.waitForSelector('#poReavaliarBtn');
  await page.click('#poReavaliarBtn');
  await page.waitForSelector('#poMotivoReavaliacaoInput');
  await page.fill('#poMotivoReavaliacaoInput', 'Revisar a natureza predominante');
  await page.click('.po-modal .po-modal-sim');
  await esperarCondicao(page, () => /hipótese inicial da nova versão/.test((document.querySelector('.po-modal') || {}).textContent || ''), undefined, { limite: 5000 });
  afirma(true, 'sem hipótese, o modal não reavalia e explica');
  await page.click('#poHipoteseReavaliacao input[value="NAO_SEI"]');
  await page.click('.po-modal .po-modal-sim');
  await page.waitForSelector('#poChecklist #poReavaliacaoInfo', { timeout: 10000 });
  db = await banco(page);
  const v2 = Object.values(db['avaliacoes-posicionamento']).find((r) => r.itemId === idAg && r.versao === 2);
  afirma(!!v2 && v2.origem === ORIGEM && v2.hipoteseInicial === 'NAO_SEI' && v2.itemNome === 'Desenvolvimento de competências em agilidade organizacional' && !('avaliacaoArquiteturalId' in v2),
    'reavaliação: v2 da Porta 2, hipótese nova, nome atual, sem base P1–P16');

  console.log('6. Encerrar a atuação');
  await page.evaluate(() => { location.hash = '#avaliacoes?po=atuacoes&item=oComRasc'; });
  await page.waitForSelector('#poEncerrarAtuacaoBtn');
  await page.click('#poEncerrarAtuacaoBtn');
  await page.waitForSelector('.po-modal');
  afirma(/rascunho de Posicionamento em andamento/.test(await texto(page, '.po-modal')) && (await banco(page))['objetos-organizacionais'].oComRasc.situacao === 'ativo', 'com rascunho aberto: explica e não encerra');
  await page.click('.po-modal .po-modal-sim');
  await page.evaluate(() => { location.hash = '#avaliacoes?po=atuacoes&item=oFim'; });
  await page.waitForSelector('#poEncerrarAtuacaoBtn');
  await page.click('#poEncerrarAtuacaoBtn');
  await page.waitForSelector('#poMotivoEncerrarAtuacao');
  await page.click('.po-modal .po-modal-sim');
  await esperarCondicao(page, () => /motivo do encerramento/.test((document.querySelector('.po-modal') || {}).textContent || ''), undefined, { limite: 5000 });
  await page.fill('#poMotivoEncerrarAtuacao', 'Incorporada a outra atuação');
  await page.click('.po-modal .po-modal-sim');
  await esperarCondicao(page, () => { const s = document.getElementById('poObjetoSituacao'); return !!s && s.dataset.situacao === 'encerrado'; }, undefined, { limite: 10000 });
  db = await banco(page);
  afirma(db['objetos-organizacionais'].oFim.situacao === 'encerrado' && db['objetos-organizacionais'].oFim.encerramento.motivo === 'Incorporada a outra atuação' && !(await page.$('#poIniciarAtuacaoBtn')) && !(await page.$('#poEncerrarAtuacaoBtn')),
    'encerrada com o motivo; sem "Iniciar" nem "Encerrar" depois');

  console.log('8. Celular e erros');
  for (const h of ['#avaliacoes?po=atuacoes', '#avaliacoes?po=nova-atuacao', '#avaliacoes?po=atuacoes&item=' + idAg]) {
    await page.evaluate((x) => { location.hash = x; }, h);
    await page.waitForSelector(h.indexOf('nova') !== -1 ? '#poFormAtuacao' : '#poAtuacoes');
    afirma(await larguraOk(page), rotulo + ': ' + h + ' sem rolagem lateral');
  }
  afirma(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
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
