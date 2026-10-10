/* AVALIAÇÃO DE POSICIONAMENTO ORGANIZACIONAL O1–O9 — a tela (PR E). Desktop e celular 375 px.
 * Firebase falso em persistência real; hermético. A trava de verdade (regras) é provada no emulador em
 * teste-rules-posicionamento.js; aqui, o que a pessoa vê e o que a tela grava.
 *
 *   1. Endereços: #avaliacoes?po=lista → ?po=escolher → ?po=escolher&item=<id> → ?po=<avaliação> (checklist e
 *      resultado); F5 em cada um restaura a mesma tela; Voltar/Avançar andam entre eles; cabeçalho próprio.
 *   2. Escolher item: só itens com Avaliação de Produto/Serviço concluída e não excluída; item com Posicionamento
 *      concluído → "Abrir" (nunca outro); item com rascunho → "Continuar" (nunca outro).
 *   3. Caminho: só as perguntas do caminho alcançado (N1; N2 só com Linha; N3 só no ramo Plataforma) e o
 *      diagnóstico só com exatamente 2 SIM no nível completo; nada de "não se aplica".
 *   4. Mudança de ramo: aviso com o que será descartado (respostas, observações, diagnóstico); Cancelar mantém
 *      tudo; Continuar limpa memória e próxima gravação; nada vira NAO.
 *   5. Completude: Concluir diz o que falta; não conclui incompleto nem com diagnóstico pendente.
 *   6. Conclusão: grava o resultado do motor, o nome na conclusão (snapshot), cria o vigente, libera a reserva,
 *      audita; tela "Posicionamento organizacional recomendado", nome atual × nome registrado, liberaSquad só
 *      como "a Adequação à Squad (S1–S8) pode ser realizada".
 *   7. Descarte: exige motivo; registro fica, descartado; reserva liberada; item volta a poder ser iniciado.
 *   8. Concorrência: rascunho alterado por outra pessoa → aviso e recarga, nunca sobrescreve.
 *   9. Perfil "Avaliação": só consulta (sem iniciar, salvar, concluir, descartar).
 *  10. Rede lenta: link direto mostra "Carregando…", nunca "não encontrada"; Taxonomia recusada → contingência.
 *  11. Sem rolagem horizontal; nenhum erro de JS. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const M = require(path.join(__dirname, '..', '..', 'forca-agil', 'motor-posicionamento.js'));
/* H0: a Avaliação de Produto/Serviço de base precisa estar com Motor atual (o gate P1–P16 → O1–O9) */
const MOTOR_PRODUTO = require('./montar-regras-posicionamento.js').MOTOR_PRODUTO;
const ARQ = 'arquitetura@previ.com.br';
const AVAL = 'avaliacao@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };
const QUANDO = '2026-10-01T09:00:00.000Z';

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const ORDEM_P = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao',
  'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
function respostasProduto() {
  const r = {};
  ORDEM_P.forEach((q, i) => { r[q] = { valor: 'sim', justificativaAuto: 'interpretação', codigoPergunta: 'P' + (i + 1), textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 }; });
  return r;
}
function produto(id, nome, extra) {
  return Object.assign({ itemId: id, nome, descricao: '', publico: '', necessidade: '', observacoesGerais: '', status: 'concluido', resultadoAutomatico: 'produto', decisaoFinal: 'produto', camadaSugerida: { id: 'produto-principal', label: 'Produto/Serviço principal' },
    respostas: respostasProduto(), justificativaAutomatica: 'justificativa', criteriosEssenciaisFalhos: [], criteriosAtendidos: 5, motorVersion: MOTOR_PRODUTO, motorVersionArquitetura: 1, questionnaireContentVersion: 1,
    excluido: false, criadoEm: QUANDO, atualizadoEm: QUANDO, versao: 1, responsavel: { name: 'Fulana', email: 'f@previ.com.br' } }, extra || {});
}
function semente(email) {
  const aut = {}; aut[chave(ARQ)] = { email: ARQ, tipo: 'avaliacao-arquitetura' }; aut[chave(AVAL)] = { email: AVAL, tipo: 'avaliacao' };
  const users = {}; users[chave(email)] = { name: 'Pessoa', email, area: 'INFOR' };
  const conceitos = {}, fontes = {};
  ['LINHA', 'PLATAFORMA', 'PLATAFORMA_CANAIS', 'PLATAFORMA_HABILITADORA_NEGOCIOS', 'COE', 'AREA_ESPECIALIZADA'].forEach((c, i) => {
    conceitos[c] = { nome: 'Tx ' + c, ordem: i + 1, ativo: true, situacaoDefinicao: 'registrada', camada: 'A', definicaoVigenteFonteId: 'f1' };
    fontes[c] = { f1: { texto: 'Definição de ' + c, contexto: 'PREVI', situacao: 'vigente', tipoRedacao: 'Conceito' } };
  });
  return {
    'fa-users': users, 'fa-admins': {}, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {},
    'fa-avaliacao-autorizados': aut, 'avaliacoes-squad': {}, 'motor-squad-config': {},
    'avaliacoes-produto': {
      p1: produto('p1', 'Item Alfa'), p2: produto('p2', 'Item Beta'), p3: produto('p3', 'Item Gama'), p4: produto('p4', 'Item Delta'),
      px: produto('px', 'Item Excluído', { excluido: true }), pr: produto('pr', 'Item Em Rascunho', { status: 'rascunho' })
    },
    'avaliacoes-posicionamento': {
      g1: { itemId: 'p3', itemNome: 'Item Gama', avaliacaoArquiteturalId: 'p3', questionarioCodigo: 'POSICIONAMENTO_ORGANIZACIONAL', questionnaireContentVersion: 1, versao: 1, status: 'concluido', revisao: 2,
        respostas: { O1: { resposta: 'NAO', codigoPergunta: 'O1', questionnaireContentVersion: 1, dataResposta: QUANDO }, O2: { resposta: 'NAO', codigoPergunta: 'O2', questionnaireContentVersion: 1, dataResposta: QUANDO }, O3: { resposta: 'SIM', codigoPergunta: 'O3', questionnaireContentVersion: 1, dataResposta: QUANDO } },
        resultadoAutomatico: { codigoResultado: 'COE', motivo: 'PAPEL_UNICO', papeisDetectados: ['COE'], regra: 'N1_COE', versaoMotor: 1, liberaSquad: false, niveisAlcancados: ['N1'] },
        nomesNaConclusao: { COE: { nome: 'Centro de Excelência (nome antigo)', contingencia: false } },
        criadoPor: { name: 'Outra', email: 'o@previ.com.br' }, criadoEm: QUANDO, atualizadoPor: { name: 'Outra', email: 'o@previ.com.br' }, atualizadoEm: QUANDO, concluidoPor: { name: 'Outra', email: 'o@previ.com.br' }, concluidoEm: QUANDO,
        auditoriaCriacaoId: 'a1', auditoriaConclusaoId: 'a2' },
      d1: { itemId: 'p4', itemNome: 'Item Delta', avaliacaoArquiteturalId: 'p4', questionarioCodigo: 'POSICIONAMENTO_ORGANIZACIONAL', questionnaireContentVersion: 1, versao: 1, status: 'rascunho', revisao: 1,
        criadoPor: { name: 'Outra', email: 'o@previ.com.br' }, criadoEm: QUANDO, atualizadoPor: { name: 'Outra', email: 'o@previ.com.br' }, atualizadoEm: QUANDO, auditoriaCriacaoId: 'a3' }
    },
    'posicionamento-vigente-por-item': { p3: 'g1' },
    'posicionamento-rascunho-por-item': { p4: 'd1' },
    'posicionamento-auditoria': {},
    taxonomia: { organizacional: { conceitos, fontes } }
  };
}
async function abrir(browser, viewport, opts) {
  opts = opts || {};
  const email = opts.email || ARQ;
  const cfg = { db: semente(email), user: { email, emailVerified: true, uid: 'u-' + chave(email) }, delayDefault: 10, persistenciaReal: true, delays: opts.delays || {}, fail: opts.fail || [] };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  /* F5 de verdade com o que a tela gravou: o banco falso nasce de novo a cada carga, então f5() guarda o banco
     atual na sessão da aba e a carga seguinte parte dele (como o banco real, que não volta ao estado inicial). */
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';' +
    'try { var g = sessionStorage.getItem("__poBanco"); if (g) { window.__CFG.db = JSON.parse(g); sessionStorage.removeItem("__poBanco"); }' +
    ' var c = Number(sessionStorage.getItem("__poCargas") || 0) + 1; sessionStorage.setItem("__poCargas", String(c)); window.__CFG.pushSeqInicial = c * 1000; } catch (e) {}');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  if (opts.atrasarModulo) await page.route('**/avaliacao-posicionamento.js*', async (r) => { await new Promise((ok) => setTimeout(ok, opts.atrasarModulo)); r.continue(); });
  await page.goto(BASE + '/index.html' + (opts.hash || '#avaliacoes'), { waitUntil: 'domcontentloaded' });
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
const hash = (page) => page.evaluate(() => location.hash);
const visivel = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length); }, sel);
const perguntasVisiveis = (page) => page.evaluate(() => Array.from(document.querySelectorAll('#avaliacoesPosicionamento .po-pergunta')).map((e) => e.dataset.q));
const diagVisiveis = (page) => page.evaluate(() => Array.from(document.querySelectorAll('#avaliacoesPosicionamento .po-diag')).map((e) => e.dataset.nivel));
async function responder(page, q, v) {
  await page.click('#avaliacoesPosicionamento .po-resp[data-q="' + q + '"][data-v="' + v + '"]');
}
async function tela(page, id) {
  try { await page.waitForSelector('#avaliacoesPosicionamento #' + id, { timeout: 10000 }); }
  catch (e) {
    /* diagnóstico: onde a tela parou */
    console.log('[DIAGNÓSTICO] esperando #' + id + ': ' + await page.evaluate(() => {
      const w = document.getElementById('avaliacoesPosicionamento');
      return JSON.stringify({ hash: location.hash, estado: history.state, oculto: w.hidden, texto: w.innerText.slice(0, 200), painel: document.getElementById('avaliacoesPainel').hidden });
    }).catch(() => '(página indisponível)'));
    throw e;
  }
}
const modalTexto = (page) => page.evaluate(() => { const m = document.querySelector('.po-modal'); return m ? m.innerText : ''; });

async function fluxoPrincipal(browser, nomeTela, viewport) {
  console.log('\n######## ' + nomeTela + ' — fluxo principal ########');
  const { ctx, page, erros } = await abrir(browser, viewport);
  await page.waitForSelector('#avpPosicionamentoBtn', { timeout: 10000 });

  console.log('\n== 1. Lista e endereços ==');
  await page.click('#avpPosicionamentoBtn');
  await tela(page, 'poLista');
  afirma(await hash(page) === '#avaliacoes?po=lista', 'lista em #avaliacoes?po=lista');
  afirma((await texto(page, '#page-avaliacoes .page-hero h1')) === 'Posicionamento Organizacional', 'cabeçalho: "Posicionamento Organizacional"');
  afirma(!(await visivel(page, '#avaliacoesPainel')) && !(await visivel(page, '#avaliacoesSquad')), 'a lista de Produto/Serviço e a Squad ficam ocultas');
  /* a lista só tem linhas quando a leitura das avaliações chega (rede lenta: antes disso, "Carregando…") */
  await esperarCondicao(page, () => document.querySelectorAll('#avaliacoesPosicionamento #poLista .po-linha').length >= 2, null, { descricao: 'as avaliações de Posicionamento chegarem à lista' });
  const lista = await texto(page, '#poLista');
  afirma(/Item Gama/.test(lista) && /Item Delta/.test(lista), 'lista mostra o concluído (Gama) e o rascunho (Delta)');
  await page.click('#poNovoBtn');
  await tela(page, 'poEscolher');
  afirma(await hash(page) === '#avaliacoes?po=escolher', 'escolher em #avaliacoes?po=escolher');
  await f5(page);
  await tela(page, 'poEscolher');
  afirma(await hash(page) === '#avaliacoes?po=escolher', 'F5 em "Escolher item" restaura a mesma tela');
  /* idem: as opções só aparecem quando produtos, reservas e vigentes chegam */
  await esperarCondicao(page, () => document.querySelectorAll('#avaliacoesPosicionamento .po-item-opcao').length >= 4, null, { descricao: 'as opções de item chegarem em Escolher item' });
  const opcoes = await page.evaluate(() => Array.from(document.querySelectorAll('#avaliacoesPosicionamento .po-item-opcao')).map((e) => e.dataset.item));
  afirma(igual(opcoes.slice().sort(), ['p1', 'p2', 'p3', 'p4']), 'só itens com Produto concluído e não excluído (' + opcoes.join(', ') + ')');
  afirma(/Abrir/i.test(await texto(page, '.po-item-opcao[data-item="p3"]')) && !/Iniciar/i.test(await texto(page, '.po-item-opcao[data-item="p3"]')), 'Gama (já concluído): "Abrir", nunca outro');
  afirma(/Continuar/i.test(await texto(page, '.po-item-opcao[data-item="p4"]')), 'Delta (rascunho): "Continuar"');
  await page.click('.po-item-opcao[data-item="p1"] .po-item-escolher');
  await tela(page, 'poIniciarBtn');
  afirma(await hash(page) === '#avaliacoes?po=escolher&item=p1', 'item escolhido em ?po=escolher&item=p1');
  await f5(page);
  await tela(page, 'poIniciarBtn');
  afirma(/Item Alfa/.test(await texto(page, '#poEscolher')), 'F5 com o item escolhido restaura a mesma tela');
  afirma(await larguraOk(page), 'sem rolagem horizontal (escolher)');

  console.log('\n== 2. Iniciar: rascunho + reserva + auditoria ==');
  await page.click('#poIniciarBtn');
  await tela(page, 'poChecklist');
  const h = await hash(page);
  const id = (/[?&]po=([^&]+)/.exec(h) || [])[1];
  let db = await banco(page);
  afirma(!!id && db['avaliacoes-posicionamento'][id] && db['avaliacoes-posicionamento'][id].status === 'rascunho' && db['avaliacoes-posicionamento'][id].revisao === 1, 'avaliação criada (rascunho, revisão 1) e endereço ?po=' + id);
  afirma(db['posicionamento-rascunho-por-item'].p1 === id, 'reserva do item p1 aponta para ela');
  afirma(Object.values(db['posicionamento-auditoria'][id] || {}).some((a) => a.tipo === 'criacao'), 'auditoria "criacao"');

  console.log('\n== 3. Caminho por nível ==');
  afirma(igual(await perguntasVisiveis(page), ['O1', 'O2', 'O3']) && !(await diagVisiveis(page)).length, 'início: só O1–O3');
  afirma(!/não se aplica/i.test(await texto(page, '#poChecklist')), 'nenhum "não se aplica"');
  await responder(page, 'O1', 'SIM'); await responder(page, 'O2', 'NAO');
  afirma(igual(await perguntasVisiveis(page), ['O1', 'O2', 'O3']), 'N1 incompleto: N2 ainda não aparece');
  await responder(page, 'O3', 'NAO');
  afirma(igual(await perguntasVisiveis(page), ['O1', 'O2', 'O3', 'O4', 'O5']), 'Linha confirmada: aparece o Nível 2 (O4–O5)');
  await responder(page, 'O4', 'NAO'); await responder(page, 'O5', 'NAO');
  afirma(igual(await perguntasVisiveis(page), ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8', 'O9']), 'ramo Plataforma: aparece o Nível 3 (O6–O9)');
  afirma(/Falta responder: O6, O7, O8, O9/i.test(await texto(page, '#poConcluirBtn')) && await page.locator('#poConcluirBtn').isDisabled(), 'Concluir diz o que falta (O6–O9) e não deixa concluir');
  await responder(page, 'O6', 'SIM'); await responder(page, 'O7', 'SIM'); await responder(page, 'O8', 'NAO'); await responder(page, 'O9', 'NAO');
  afirma(igual(await diagVisiveis(page), ['N3']), 'exatamente 2 SIM no N3: aparece o diagnóstico do Nível 3');
  afirma(/Tx PLATAFORMA_CANAIS/.test(await texto(page, '.po-diag[data-nivel="N3"]')) && /Tx PLATAFORMA_HABILITADORA_NEGOCIOS/.test(await texto(page, '.po-diag[data-nivel="N3"]')), 'o diagnóstico nomeia os 2 papéis pela Taxonomia');
  afirma(/Falta responder o diagnóstico do Nível 3/i.test(await texto(page, '#poConcluirBtn')) && await page.locator('#poConcluirBtn').isDisabled(), 'diagnóstico pendente: não conclui e diz isso');
  await page.fill('#avaliacoesPosicionamento .po-obs[data-q="O6"]', 'Nota sobre canais');
  await page.click('.po-diag-resp[data-nivel="N3"][data-v="mesma"]');
  afirma(!(await page.locator('#poConcluirBtn').isDisabled()), 'completo: Concluir habilitado');
  afirma(await larguraOk(page), 'sem rolagem horizontal (checklist)');

  console.log('\n== 4. Mudança de ramo ==');
  await responder(page, 'O5', 'SIM');
  await page.waitForSelector('.po-modal');
  const m = await modalTexto(page);
  afirma(/O6, O7, O8, O9/.test(m) && /observaç/.test(m) && /diagnóstico do Nível 3/.test(m), 'aviso lista respostas O6–O9, a observação e o diagnóstico do Nível 3', m);
  await page.click('.po-modal .po-modal-nao');
  afirma(igual(await perguntasVisiveis(page), ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8', 'O9']) && (await page.locator('.po-resp[data-q="O5"][data-v="NAO"].ativa').count()) === 1 &&
    (await page.inputValue('.po-obs[data-q="O6"]')) === 'Nota sobre canais' && igual(await diagVisiveis(page), ['N3']), 'Cancelar: O5 continua NAO e nada foi descartado');
  await responder(page, 'O5', 'SIM');
  await page.waitForSelector('.po-modal');
  await page.click('.po-modal .po-modal-sim');
  afirma(igual(await perguntasVisiveis(page), ['O1', 'O2', 'O3', 'O4', 'O5']) && !(await diagVisiveis(page)).length, 'Continuar: o Nível 3 e o diagnóstico saem da tela');
  await responder(page, 'O5', 'NAO');
  afirma(igual(await perguntasVisiveis(page), ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8', 'O9']) && (await page.locator('.po-resp.ativa[data-q^="O6"], .po-resp.ativa[data-q="O7"], .po-resp.ativa[data-q="O8"], .po-resp.ativa[data-q="O9"]').count()) === 0,
    'voltando ao ramo, O6–O9 reaparecem SEM resposta (nada virou NAO)');
  afirma((await page.locator('.po-obs[data-q="O6"]').count()) === 0, 'a observação de O6 não sobreviveu escondida');

  console.log('\n== 5. Salvar rascunho e F5 ==');
  await page.click('#poSalvarBtn');
  await esperarCondicao(page, (k) => window.__CFG.__dbReal['avaliacoes-posicionamento'][k].revisao === 2, id, { descricao: 'revisão 2 gravada' });
  db = await banco(page);
  const r2 = db['avaliacoes-posicionamento'][id];
  afirma(igual(Object.keys(r2.respostas).sort(), ['O1', 'O2', 'O3', 'O4', 'O5']) && !r2.diagnosticos, 'gravado só o caminho: O1–O5, sem O6–O9, sem diagnóstico');
  afirma(r2.respostas.O1.textoPerguntaNaEpoca && /Considerando a responsabilidade/.test(r2.respostas.O1.textoPerguntaNaEpoca) && r2.respostas.O1.interpretacaoNaEpoca, 'cada resposta guarda o texto e a interpretação da época');
  await f5(page);
  await tela(page, 'poChecklist');
  afirma(igual(await perguntasVisiveis(page), ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8', 'O9']) && (await page.locator('.po-resp.ativa').count()) === 5, 'F5 no rascunho: mesmas respostas, mesmo caminho');

  console.log('\n== 6. Concluir ==');
  await responder(page, 'O6', 'SIM'); await responder(page, 'O7', 'SIM'); await responder(page, 'O8', 'NAO'); await responder(page, 'O9', 'NAO');
  await page.click('.po-diag-resp[data-nivel="N3"][data-v="distintas"]');
  await page.fill('#avaliacoesPosicionamento .po-diag-obs[data-nivel="N3"]', 'Dois serviços diferentes');
  await page.click('#poConcluirBtn');
  await tela(page, 'poResultado');
  db = await banco(page);
  const rc = db['avaliacoes-posicionamento'][id];
  const esperado = M.avaliar({ O1: 'SIM', O2: 'NAO', O3: 'NAO', O4: 'NAO', O5: 'NAO', O6: 'SIM', O7: 'SIM', O8: 'NAO', O9: 'NAO' }, { N3: 'distintas' });
  const gravado = Object.assign({ tipoAValidar: null, nivelConfirmado: null, papeisDetectados: [], perguntasForaDoCaminho: [] }, rc.resultadoAutomatico);
  afirma(rc.status === 'concluido' && igual(Object.keys(esperado).sort().map((k) => [k, gravado[k]]), Object.keys(esperado).sort().map((k) => [k, esperado[k]])), 'resultado gravado = o do motor, campo a campo', JSON.stringify(rc.resultadoAutomatico));
  afirma(db['posicionamento-vigente-por-item'].p1 === id && !(db['posicionamento-rascunho-por-item'] || {}).p1, 'vigente criado e reserva liberada');
  afirma(Object.values(db['posicionamento-auditoria'][id]).some((a) => a.tipo === 'conclusao' && a.regra === 'N3_RECORTE_DIAGNOSTICO'), 'auditoria "conclusao"');
  afirma(rc.nomesNaConclusao && rc.nomesNaConclusao.PLATAFORMA && rc.nomesNaConclusao.PLATAFORMA.nome === 'Tx PLATAFORMA' && rc.nomesNaConclusao.PLATAFORMA_CANAIS.contingencia === false, 'nome registrado na conclusão (nível e papéis), sem contingência');
  afirma(rc.diagnosticos.N3.observacao === 'Dois serviços diferentes', 'observação do diagnóstico gravada');
  const res = await texto(page, '#poResultado');
  afirma(/Posicionamento organizacional recomendado: A validar — recorte do objeto/.test(res) && !/é uma Linha|virou/i.test(res), '"Posicionamento organizacional recomendado: A validar — recorte do objeto", sem "o objeto é"');
  afirma(/A validar/.test(res) && /recorte/i.test(res), 'A validar — recorte do objeto');
  afirma(/Adequação à Squad \(S1–S8\) pode ser realizada/.test(res) && /não cria nem associa/i.test(res), 'liberaSquad: "a Adequação à Squad (S1–S8) pode ser realizada" — não cria nem associa Squad');
  afirma(/estrutura organizacional concreta/i.test(res), 'explica que a associação à estrutura concreta é etapa posterior');
  afirma(await larguraOk(page), 'sem rolagem horizontal (resultado)');

  console.log('\n== 7. Voltar / Avançar ==');
  await page.goBack(); await tela(page, 'poItemSelecionado');
  afirma(await hash(page) === '#avaliacoes?po=escolher&item=p1', 'Voltar: escolher (com o item)');
  afirma((await page.locator('#poIniciarBtn').count()) === 0 && /Abrir/i.test(await texto(page, '#poItemSelecionado')), 'o item agora tem Posicionamento concluído: só "Abrir", sem "Iniciar"');
  await page.goBack(); await tela(page, 'poEscolher');
  afirma(await hash(page) === '#avaliacoes?po=escolher' && (await page.locator('#poIniciarBtn').count()) === 0, 'Voltar: escolher');
  await page.goBack(); await tela(page, 'poLista');
  afirma(await hash(page) === '#avaliacoes?po=lista', 'Voltar: lista');
  await page.goForward(); await tela(page, 'poEscolher');
  await page.goForward(); await page.goForward(); await tela(page, 'poResultado');
  afirma(await hash(page) === '#avaliacoes?po=' + id, 'Avançar até o resultado');
  await f5(page);
  await tela(page, 'poResultado');
  afirma(/Posicionamento organizacional recomendado/.test(await texto(page, '#poResultado')), 'F5 no resultado restaura o resultado');

  console.log('\n== 8. Firme (CoE) e item já concluído ==');
  await page.evaluate(() => { location.hash = '#avaliacoes?po=escolher&item=p2'; });
  await tela(page, 'poIniciarBtn');
  await page.click('#poIniciarBtn');
  await tela(page, 'poChecklist');
  await responder(page, 'O1', 'NAO'); await responder(page, 'O2', 'NAO'); await responder(page, 'O3', 'SIM');
  await page.click('#poConcluirBtn');
  await tela(page, 'poResultado');
  const res2 = await texto(page, '#poResultado');
  afirma(/Posicionamento organizacional recomendado: Tx COE/.test(res2), 'firme: "Posicionamento organizacional recomendado: <nome da Taxonomia>"', res2.slice(0, 200));
  afirma(/não libera a Adequação à Squad/i.test(res2), 'CoE: não libera a Adequação à Squad');
  await page.evaluate(() => { location.hash = '#avaliacoes?po=escolher&item=p2'; });
  await page.waitForSelector('#avaliacoesPosicionamento #poEscolher');
  afirma((await page.locator('#poIniciarBtn').count()) === 0 && /Abrir/i.test(await texto(page, '#poEscolher')), 'item com Posicionamento concluído: sem "Iniciar", só "Abrir"');
  await page.evaluate(() => { location.hash = '#avaliacoes?po=g1'; });
  await tela(page, 'poResultado');
  const res3 = await texto(page, '#poResultado');
  afirma(/Nome atual na Taxonomia: Tx COE/.test(res3) && /Nome registrado na conclusão: Centro de Excelência \(nome antigo\)/.test(res3), 'nome atual × nome registrado na conclusão, distintos');

  console.log('\n== 9. Descarte ==');
  await page.evaluate(() => { location.hash = '#avaliacoes?po=d1'; });
  await tela(page, 'poChecklist');
  await page.click('#poDescartarBtn');
  await page.waitForSelector('.po-modal #poMotivoDescarte');
  await page.fill('#poMotivoDescarte', '   ');
  await page.click('.po-modal .po-modal-sim');
  afirma(/Informe o motivo/.test(await modalTexto(page)), 'motivo em branco: recusado, nada gravado');
  await page.fill('#poMotivoDescarte', '\t\n  \n');
  await page.click('.po-modal .po-modal-sim');
  afirma(/Informe o motivo/.test(await modalTexto(page)) && (await banco(page))['avaliacoes-posicionamento'].d1.status === 'rascunho', 'motivo só de tabulação e quebra de linha: recusado, nada gravado');
  await page.fill('#poMotivoDescarte', 'Item avaliado por engano');
  await page.click('.po-modal .po-modal-sim');
  await tela(page, 'poDescartado');
  db = await banco(page);
  afirma(db['avaliacoes-posicionamento'].d1.status === 'descartado' && db['avaliacoes-posicionamento'].d1.motivoDescarte === 'Item avaliado por engano' && !(db['posicionamento-rascunho-por-item'] || {}).p4 &&
    Object.values(db['posicionamento-auditoria'].d1 || {}).some((a) => a.tipo === 'descarte'), 'descartado: registro fica, motivo, reserva liberada, auditoria');
  await page.evaluate(() => { location.hash = '#avaliacoes?po=escolher&item=p4'; });
  await tela(page, 'poIniciarBtn');
  afirma(true, 'depois do descarte, o item pode ser iniciado de novo');

  console.log('\n== 10. Concorrência ==');
  await page.click('#poIniciarBtn');
  await tela(page, 'poChecklist');
  const id2 = (/[?&]po=([^&]+)/.exec(await hash(page)) || [])[1];
  await responder(page, 'O1', 'NAO');
  await page.evaluate((k) => {
    window.__testeGravando = true;
    const r = JSON.parse(JSON.stringify(window.__CFG.__dbReal['avaliacoes-posicionamento'][k]));
    r.revisao = r.revisao + 1; r.atualizadoPor = { name: 'Outra pessoa', email: 'outra@previ.com.br' };
    firebase.database().ref('avaliacoes-posicionamento/' + k).set(r);
  }, id2);
  await page.waitForSelector('#poConflito');
  afirma(/outra pessoa alterou/i.test(await texto(page, '#poConflito')), 'aviso: o rascunho foi alterado por outra pessoa');
  afirma(await page.locator('#poSalvarBtn').isDisabled(), 'salvar fica bloqueado até recarregar (nunca sobrescreve)');
  await page.click('#poRecarregarBtn');
  await esperarCondicao(page, () => !document.getElementById('poConflito') && !document.getElementById('poSalvarBtn').disabled, null, { descricao: 'recarregado' });
  afirma((await page.locator('.po-resp.ativa').count()) === 0, 'recarregado: mostra o que está no banco');
  afirma(await larguraOk(page), 'sem rolagem horizontal ao final');
  await ctx.close();
  afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
}

async function perfilAvaliacao(browser, nomeTela, viewport) {
  console.log('\n######## ' + nomeTela + ' — perfil "Avaliação": só consulta ########');
  const { ctx, page, erros } = await abrir(browser, viewport, { email: AVAL, hash: '#avaliacoes?po=lista' });
  await tela(page, 'poLista');
  afirma((await page.locator('#poNovoBtn').count()) === 0, 'sem "Avaliar posicionamento de um item"');
  await page.evaluate(() => { location.hash = '#avaliacoes?po=d1'; });
  await tela(page, 'poChecklist');
  afirma((await page.locator('#poSalvarBtn, #poConcluirBtn, #poDescartarBtn').count()) === 0 && (await page.locator('.po-resp:not([disabled])').count()) === 0,
    'rascunho só para leitura: sem salvar, concluir, descartar nem responder');
  await page.evaluate(() => { location.hash = '#avaliacoes?po=escolher'; });
  await tela(page, 'poSemPermissao');
  afirma(/Avaliação \+ Arquitetura/.test(await texto(page, '#poSemPermissao')), '"Escolher item": explica que é do perfil Avaliação + Arquitetura');
  await page.evaluate(() => { location.hash = '#avaliacoes?po=g1'; });
  await tela(page, 'poResultado');
  afirma(true, 'consulta o resultado');
  afirma(await larguraOk(page), 'sem rolagem horizontal');
  await ctx.close();
  afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
}

async function redeLenta(browser, nomeTela, viewport) {
  console.log('\n######## ' + nomeTela + ' — rede lenta e Taxonomia recusada ########');
  const { ctx, page, erros } = await abrir(browser, viewport, { hash: '#avaliacoes?po=g1', delays: { 'avaliacoes-posicionamento': 2500 }, fail: ['taxonomia/organizacional'] });
  await page.waitForSelector('#avaliacoesPosicionamento .loading-msg');
  afirma(!/não encontrada/i.test(await texto(page, '#avaliacoesPosicionamento')), 'link direto com leitura lenta: "Carregando…", nunca "não encontrada"');
  await tela(page, 'poResultado');
  afirma(/Nome registrado na conclusão: Centro de Excelência \(nome antigo\)/.test(await texto(page, '#poResultado')), 'chegou: resultado com o nome registrado');
  afirma(/Rótulo de contingência/.test(await texto(page, '#poResultado')), 'Taxonomia recusada: aviso de contingência');
  await page.evaluate(() => { location.hash = '#avaliacoes?po=escolher&item=p1'; });
  await tela(page, 'poIniciarBtn');
  await page.click('#poIniciarBtn');
  await tela(page, 'poChecklist');
  await responder(page, 'O1', 'NAO'); await responder(page, 'O2', 'SIM'); await responder(page, 'O3', 'NAO');
  await page.click('#poConcluirBtn');
  await tela(page, 'poResultado');
  const db = await banco(page);
  const k = db['posicionamento-vigente-por-item'].p1;
  afirma(!!k && db['avaliacoes-posicionamento'][k].nomesNaConclusao.AREA_ESPECIALIZADA.contingencia === true &&
    db['avaliacoes-posicionamento'][k].nomesNaConclusao.AREA_ESPECIALIZADA.nome === 'Área Especializada', 'Taxonomia fora: conclui assim mesmo, com o nome de fábrica marcado como contingência');
  await ctx.close();
  afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
}

async function fichaEVoltar(browser, nomeTela, viewport) {
  console.log('\n######## ' + nomeTela + ' — ficha do Produto/Serviço e volta à área Avaliação ########');
  let { ctx, page, erros } = await abrir(browser, viewport, { hash: '#avaliacoes?avp=p1' });
  await page.waitForSelector('#avpAcoesFicha');
  const h1Original = await texto(page, '#page-avaliacoes .page-hero h1');
  afirma((await page.locator('#avpPosicionarBtn').count()) === 1, 'Avaliação + Arquitetura: a ficha concluída tem "Posicionamento Organizacional"');
  await page.click('#avpPosicionarBtn');
  await tela(page, 'poItemSelecionado');
  afirma(await hash(page) === '#avaliacoes?po=escolher&item=p1' && /Item Alfa/.test(await texto(page, '#poItemSelecionado')), 'o botão leva a ?po=escolher&item=p1, com o item já escolhido');
  await page.click('#poVoltar');
  await page.waitForSelector('#avaliacoesPainel:not([hidden])');
  afirma(!(await visivel(page, '#avaliacoesPosicionamento')) && (await texto(page, '#page-avaliacoes .page-hero h1')) === h1Original, '"← Voltar para Avaliações": painel do Posicionamento fecha e o cabeçalho volta ao original');
  await page.evaluate(() => { location.hash = '#avaliacoes?po=lista'; });
  await tela(page, 'poLista');
  await page.evaluate(() => { location.hash = '#avaliacoes?sq=lista'; });
  await page.waitForSelector('#avaliacoesSquad:not([hidden])');
  afirma(!(await visivel(page, '#avaliacoesPosicionamento')) && !/Posicionamento/.test(await texto(page, '#page-avaliacoes .page-hero h1')), 'ir para a Squad fecha o Posicionamento (o cabeçalho não fica com o título dele)');
  await page.goBack(); await tela(page, 'poLista');
  afirma(!(await visivel(page, '#avaliacoesSquad')) && (await texto(page, '#page-avaliacoes .page-hero h1')) === 'Posicionamento Organizacional', 'Voltar da Squad reabre o Posicionamento, sem a Squad por cima');
  await ctx.close();
  afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
  ({ ctx, page, erros } = await abrir(browser, viewport, { email: AVAL, hash: '#avaliacoes?avp=p1' }));
  await page.waitForSelector('#avpAcoesFicha');
  afirma((await page.locator('#avpPosicionarBtn').count()) === 0, 'perfil "Avaliação": a ficha não oferece iniciar Posicionamento');
  await ctx.close();
  afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
}

async function moduloAtrasado(browser, nomeTela, viewport) {
  console.log('\n######## ' + nomeTela + ' — o arquivo do Posicionamento chega depois da página ########');
  const { ctx, page, erros } = await abrir(browser, viewport, { hash: '#avaliacoes?po=g1', atrasarModulo: 3000 });
  await tela(page, 'poResultado');
  afirma(await hash(page) === '#avaliacoes?po=g1' && !(await visivel(page, '#avaliacoesPainel')), 'link direto com avaliacao-posicionamento.js atrasado: abre o resultado mesmo assim');
  await ctx.close();
  afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
}

(async () => {
  const browser = await chromium.launch();
  for (const [nome, vp] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    await fluxoPrincipal(browser, nome, vp);
    await perfilAvaliacao(browser, nome, vp);
    await redeLenta(browser, nome, vp);
    await fichaEVoltar(browser, nome, vp);
    await moduloAtrasado(browser, nome, vp);
  }
  await browser.close();
  console.log('\n============================\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
