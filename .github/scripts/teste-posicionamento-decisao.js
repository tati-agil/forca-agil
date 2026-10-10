/* POSICIONAMENTO ORGANIZACIONAL — DECISÃO HUMANA, REAVALIAÇÃO E HISTÓRICO DE VERSÕES: a tela (PR F).
 * Desktop e celular 375 px. Firebase falso em persistência real; hermético. A trava de verdade (regras) é provada
 * no emulador em teste-rules-posicionamento-decisao.js; o núcleo (herança, tipos) em
 * teste-posicionamento-reavaliacao-nucleo.js; aqui, o que a pessoa vê e o que a tela grava.
 *
 *   1. Lista: por padrão só vigentes e em andamento; históricas e descartadas atrás do filtro; colunas Versão,
 *      Situação, Recomendação automática e Decisão final; cartões em 375 px, sem rolagem horizontal.
 *   2. Ficha em três blocos: Recomendação automática / Decisão final / Histórico de versões (recolhido).
 *   3. Decidir: só os 8 firmes no seletor (sem Linha, Plataforma, A validar); CONFIRMACAO sem justificativa;
 *      RESOLUCAO_A_VALIDAR exige justificativa (a tela diz e não grava); grava decisão + auditoria; o resultado
 *      automático não muda; F5 mantém; decidida não mostra mais o formulário.
 *   4. Reavaliar: motivo obrigatório; cria vN+1 em rascunho com as respostas pré-preenchidas, apontando para a Avaliação
 *      de Produto/Serviço que vale para o item (D6: a ponta da cadeia, v2 — nunca a v1; com a ponta excluída, o gate do
 *      H0 bloqueia: ver teste-posicionamento-gate.js); a anterior continua
 *      vigente (aviso nos dois lados); concluir troca o vigente; a anterior vira histórica com a decisão dela;
 *      a nova começa "Sem decisão registrada" e pode ser decidida.
 *   5. D4: com reavaliação em andamento, a vigente não oferece decisão (mensagem exata); descartar a reavaliação
 *      devolve o formulário e não muda o vigente.
 *   6. Perfil "Avaliação": só consulta — sem formulário de decisão e sem Reavaliar.
 *   7. Rede lenta: decisões ainda não lidas → "Carregando…", nunca "Sem decisão registrada"; leitura recusada →
 *      "Não foi possível ler", nunca "Sem decisão registrada".
 *   8. Nenhum erro de JS. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarSessaoAssentada, esperarAusencia } = require('./esperas');

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
const D4 = 'Há uma reavaliação em andamento. Conclua ou descarte essa reavaliação antes de registrar uma decisão para esta versão.';

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

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
const outra = { name: 'Outra', email: 'o@previ.com.br' };
/* avaliação concluída com o resultado EXATO do motor */
function concluida(itemId, itemNome, versao, respostas, diagnosticos, extra) {
  const res = M.avaliar(respostas, diagnosticos || {}), ra = {};
  Object.keys(res).forEach((k) => { const v = res[k]; if (v !== null && !(Array.isArray(v) && !v.length)) ra[k] = v; });
  const reg = { itemId, itemNome, avaliacaoArquiteturalId: itemId, questionarioCodigo: 'POSICIONAMENTO_ORGANIZACIONAL', questionnaireContentVersion: 1, versao, status: 'concluido', revisao: 2,
    respostas: {}, resultadoAutomatico: ra, criadoPor: outra, criadoEm: QUANDO, atualizadoPor: outra, atualizadoEm: QUANDO, concluidoPor: outra, concluidoEm: QUANDO,
    auditoriaCriacaoId: 'ac' + itemId + versao, auditoriaConclusaoId: 'az' + itemId + versao };
  Object.keys(respostas).forEach((q) => { reg.respostas[q] = { resposta: respostas[q], codigoPergunta: q, questionnaireContentVersion: 1, dataResposta: QUANDO }; });
  return Object.assign(reg, extra || {});
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
    'avaliacoes-produto': { p1: produto('p1', 'Item Alfa'), p2: produto('p2', 'Item Beta'), p3: produto('p3', 'Item Gama'), p4: produto('p4', 'Item Delta'),
      /* D6: o item p3 tem Produto/Serviço v1 (p3) e v2 (p3v2, a ponta): a reavaliação usa a v2. (Ponta excluída:
         o gate do H0 bloqueia, sem voltar para uma versão anterior — teste-posicionamento-gate.js.) */
      p3v2: produto('p3', 'Item Gama', { versao: 2, versaoAnteriorKey: 'p3' }) },
    'avaliacoes-posicionamento': {
      /* PR E: concluída, sem anterior e sem decisão */
      g1: concluida('p3', 'Item Gama', 1, { O1: 'NAO', O2: 'NAO', O3: 'SIM' }),
      /* cadeia: h1 (v1, histórica, decidida) → h2 (v2, vigente, sem decisão) */
      h1: concluida('p1', 'Item Alfa', 1, AE),
      h2: concluida('p1', 'Item Alfa', 2, AE, null, { avaliacaoAnteriorId: 'h1', motivoReavaliacao: 'Revisão anual' }),
      /* A validar (conflito no N1) */
      a1: concluida('p2', 'Item Beta', 1, { O1: 'NAO', O2: 'SIM', O3: 'SIM' }, { N1: 'mesma' }),
      x1: { itemId: 'p4', itemNome: 'Item Delta', avaliacaoArquiteturalId: 'p4', questionarioCodigo: 'POSICIONAMENTO_ORGANIZACIONAL', questionnaireContentVersion: 1, versao: 1, status: 'descartado', revisao: 2,
        motivoDescarte: 'Engano', descartadoPor: outra, descartadoEm: QUANDO, criadoPor: outra, criadoEm: QUANDO, atualizadoPor: outra, atualizadoEm: QUANDO, auditoriaCriacaoId: 'ax1', auditoriaDescarteId: 'ax2' }
    },
    'posicionamento-vigente-por-item': { p3: 'g1', p1: 'h2', p2: 'a1' },
    'posicionamento-rascunho-por-item': {},
    'posicionamento-decisoes': {
      h1: { itemId: 'p1', versaoAvaliacao: 1, versaoMotor: 1, codigoAutomatico: 'AREA_ESPECIALIZADA', codigoFinal: 'AREA_ESPECIALIZADA', tipoDecisao: 'CONFIRMACAO',
        nomeNaDecisao: { nome: 'Área (nome antigo)', contingencia: false }, liberaSquad: false, decididoPor: outra, decididoEm: QUANDO, auditoriaId: 'adh1' }
    },
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
  /* F5 de verdade com o que a tela gravou (ver teste-avaliacao-posicionamento.js) */
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';' +
    'try { var g = sessionStorage.getItem("__poBanco"); if (g) { window.__CFG.db = JSON.parse(g); sessionStorage.removeItem("__poBanco"); }' +
    ' var c = Number(sessionStorage.getItem("__poCargas") || 0) + 1; sessionStorage.setItem("__poCargas", String(c)); window.__CFG.pushSeqInicial = c * 1000; } catch (e) {}');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + (opts.hash || '#avaliacoes?po=lista'), { waitUntil: 'domcontentloaded' });
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
const existe = (page, sel) => page.evaluate((s) => !!document.querySelector(s), sel);
const ir = (page, h) => page.evaluate((x) => { location.hash = x; }, h);
async function tela(page, id) {
  try { await page.waitForSelector('#avaliacoesPosicionamento #' + id, { timeout: 10000 }); }
  catch (e) {
    console.log('[DIAGNÓSTICO] esperando #' + id + ': ' + await page.evaluate(() => {
      const w = document.getElementById('avaliacoesPosicionamento');
      return JSON.stringify({ hash: location.hash, oculto: w.hidden, texto: w.innerText.slice(0, 300) });
    }).catch(() => '(página indisponível)'));
    throw e;
  }
}
const linhas = (page) => page.evaluate(() => Array.from(document.querySelectorAll('#poLista .po-linha')).map((tr) => ({
  key: tr.dataset.key, sit: tr.dataset.situacao, versao: tr.querySelector('[data-label="Versão"]').innerText, decisao: tr.querySelector('[data-label="Decisão final"]').innerText
})));
async function confirmarModal(page) { await page.waitForSelector('.po-modal .po-modal-sim'); await page.click('.po-modal .po-modal-sim'); }

async function fluxoDecisao(browser, nomeTela, viewport) {
  console.log('\n######## ' + nomeTela + ' — lista, decisão, reavaliação e D4 ########');
  const { ctx, page, erros } = await abrir(browser, viewport);
  const celular = viewport.width < 641;

  console.log('\n== 1. Lista ==');
  await tela(page, 'poLista');
  await esperarCondicao(page, () => document.querySelectorAll('#poLista .po-linha').length >= 3, null, { descricao: 'as linhas da lista chegarem' });
  let ls = await linhas(page);
  afirma(JSON.stringify(ls.map((l) => l.key).sort()) === '["a1","g1","h2"]', 'padrão: só as vigentes (sem histórica nem descartada)', JSON.stringify(ls));
  afirma(ls.find((l) => l.key === 'h2').versao === 'v2' && ls.find((l) => l.key === 'g1').versao === 'v1', 'coluna Versão (v1, v2)');
  afirma(/Sem decisão registrada/.test(ls.find((l) => l.key === 'g1').decisao), 'coluna Decisão final: "Sem decisão registrada" (registro do PR E)');
  afirma(/2/.test(await texto(page, '.po-filtro-historico')), 'filtro "Mostrar versões históricas e descartadas (2)"');
  await page.check('#poMostrarHistorico');
  await esperarCondicao(page, () => document.querySelectorAll('#poLista .po-linha').length === 5, null, { descricao: 'o filtro mostrar as 5' });
  ls = await linhas(page);
  afirma(ls.find((l) => l.key === 'h1').sit === 'historica' && /Tx AREA_ESPECIALIZADA/.test(ls.find((l) => l.key === 'h1').decisao), 'histórica aparece com a decisão dela');
  afirma(ls.find((l) => l.key === 'x1').sit === 'descartado', 'descartada aparece no filtro');
  if (celular) {
    afirma(await page.evaluate(() => getComputedStyle(document.querySelector('#poLista .po-linha')).display === 'block'), '375 px: cada linha é um cartão');
  }
  afirma(await larguraOk(page), 'lista sem rolagem horizontal');

  console.log('\n== 2–3. Ficha em três blocos e CONFIRMACAO ==');
  await ir(page, '#avaliacoes?po=g1');
  await tela(page, 'poDecisaoForm');
  afirma(await existe(page, '#poBlocoRecomendacao') && await existe(page, '#poBlocoDecisao') && await existe(page, '#poBlocoHistorico'), 'três blocos: Recomendação automática, Decisão final, Histórico de versões');
  afirma(/^Pela recomendação automática, este resultado não libera/.test((await texto(page, '#poLiberaSquad')).trim()), 'bloco automático: "Pela recomendação automática…" (S1–S8)');
  afirma(!(await existe(page, '#poOrientacaoAValidar')), 'resultado firme: sem a orientação do "A validar"');
  afirma(/Sem decisão registrada/.test(await texto(page, '#poBlocoDecisao')), '"Sem decisão registrada"');
  afirma(await page.evaluate(() => !document.querySelector('#poHistoricoVersoes').open), 'histórico de versões começa recolhido');
  const opcoes = await page.evaluate(() => Array.from(document.querySelectorAll('#poCodigoFinal option')).map((o) => o.value).filter(Boolean));
  afirma(JSON.stringify(opcoes.slice().sort()) === JSON.stringify(M.CODIGOS_FIRMES.slice().sort()), 'o seletor só tem os 8 firmes (sem LINHA, PLATAFORMA, A_VALIDAR)', JSON.stringify(opcoes));
  afirma((await page.inputValue('#poCodigoFinal')) === 'COE' && /Confirmação/.test(await texto(page, '#poTipoPrevisto')), 'pré-seleciona a recomendação automática: Confirmação, justificativa opcional');
  await esperarCondicao(page, () => Array.from(document.querySelectorAll('#poCodigoFinal option')).filter((o) => o.value).every((o) => /^Tx /.test(o.textContent)), null,
    { descricao: 'as opções do seletor com o nome atual da Taxonomia' });
  afirma(/recomendação automática/.test(await page.evaluate(() => document.querySelector('#poCodigoFinal option[value="COE"]').textContent)), 'opções com o nome da Taxonomia; a da recomendação automática marcada');
  await page.click('#poDecidirBtn');
  await page.waitForSelector('.po-modal #poModalLiberaSquad');
  afirma(/não será liberada/.test(await texto(page, '#poModalLiberaSquad')), 'modal: mostra que a decisão final (CoE) não libera a Adequação à Squad');
  await confirmarModal(page);
  await tela(page, 'poDecisaoFinal');
  afirma(/^Pela decisão final, a Adequação à Squad \(S1–S8\) não é liberada/.test((await texto(page, '#poLiberaSquadDecisao')).trim()), 'bloco da decisão: "Pela decisão final…"');
  let db = await banco(page);
  const dg = db['posicionamento-decisoes'] && db['posicionamento-decisoes'].g1;
  afirma(dg && dg.tipoDecisao === 'CONFIRMACAO' && dg.codigoFinal === 'COE' && dg.liberaSquad === false && dg.nomeNaDecisao.nome === 'Tx COE' && !dg.justificativa && dg.decididoPor.email === ARQ,
    'gravou CONFIRMACAO de COE, sem justificativa, com nome na decisão', JSON.stringify(dg));
  afirma(Object.values(db['posicionamento-auditoria'].g1 || {}).some((a) => a.tipo === 'decisao' && a.codigoFinal === 'COE'), 'auditoria "decisao"');
  afirma(db['avaliacoes-posicionamento'].g1.resultadoAutomatico.codigoResultado === 'COE' && !db['avaliacoes-posicionamento'].g1.decisaoFinal, 'o resultado automático ficou como estava');
  afirma(!(await existe(page, '#poDecisaoForm')), 'decidida: o formulário some (a decisão não muda)');
  await f5(page);
  await tela(page, 'poDecisaoFinal');
  afirma(/Confirmação/.test(await texto(page, '#poTipoDecisao')), 'F5: a decisão continua na ficha');
  /* o nome vem da Taxonomia, que pode chegar depois da ficha (até lá, rótulo de contingência) */
  await esperarCondicao(page, () => /Tx COE/.test(document.querySelector('#poDecisaoFinal').innerText), null, { descricao: 'o nome atual da Taxonomia entrar na decisão depois do F5' });
  afirma(true, '…com o nome atual da Taxonomia quando ela chega');

  console.log('\n== 3. RESOLUCAO_A_VALIDAR exige justificativa ==');
  await ir(page, '#avaliacoes?po=a1');
  await tela(page, 'poDecisaoForm');
  afirma((await page.inputValue('#poCodigoFinal')) === '', 'A validar: nada pré-selecionado');
  afirma((await texto(page, '#poOrientacaoAValidar')).trim() === 'Se houver elementos suficientes, escolha um posicionamento firme e justifique. Se ainda não houver base para decidir, use Reavaliar.',
    'A validar: orientação explícita (decidir com justificativa ou Reavaliar)');
  await page.selectOption('#poCodigoFinal', 'PLATAFORMA_CANAIS');
  afirma(/Resolução/.test(await texto(page, '#poTipoPrevisto')) && /obrigatória/.test(await texto(page, '#poTipoPrevisto')) && /\*/.test(await texto(page, '#poJustificativaRotulo')), 'tipo previsto: Resolução do "A validar", justificativa obrigatória');
  await page.click('#poDecidirBtn');
  await page.waitForSelector('#poDecisaoErro:not([hidden])');
  afirma(/justificativa/i.test(await texto(page, '#poDecisaoErro')) && !(await existe(page, '.po-modal')), 'sem justificativa: a tela diz e não pede confirmação');
  await page.fill('#poJustificativaInput', '   ');
  await page.click('#poDecidirBtn');
  afirma(!(await existe(page, '.po-modal')), 'só espaço também não serve');
  await page.fill('#poJustificativaInput', 'Resolvido com a área em reunião');
  await page.click('#poDecidirBtn');
  await page.waitForSelector('.po-modal #poModalLiberaSquad');
  afirma(/poderá ser realizada/.test(await texto(page, '#poModalLiberaSquad')), 'modal: mostra que a decisão final (Plataforma de Canais) libera a Adequação à Squad');
  await confirmarModal(page);
  await tela(page, 'poDecisaoFinal');
  db = await banco(page);
  const da = db['posicionamento-decisoes'].a1;
  afirma(da.tipoDecisao === 'RESOLUCAO_A_VALIDAR' && da.codigoAutomatico === 'A_VALIDAR' && da.tipoAValidarAutomatico === 'CONFLITO' && da.liberaSquad === true && da.justificativa === 'Resolvido com a área em reunião',
    'gravou RESOLUCAO_A_VALIDAR, liberaSquad do motor (true), justificativa', JSON.stringify(da));
  afirma(/pode ser realizada/.test(await texto(page, '#poLiberaSquadDecisao')), 'bloco da decisão: "a Adequação à Squad (S1–S8) pode ser realizada"');
  afirma(await larguraOk(page), 'ficha sem rolagem horizontal');

  console.log('\n== 4. Reavaliar (vigente decidida) ==');
  await ir(page, '#avaliacoes?po=g1');
  await tela(page, 'poReavaliarBtn');
  await page.click('#poReavaliarBtn');
  await confirmarModal(page);
  await page.waitForSelector('.po-modal .po-modal-erro:not([hidden])');
  afirma(/motivo/i.test(await texto(page, '.po-modal .po-modal-erro')), 'sem motivo: o modal pede o motivo');
  await page.fill('#poMotivoReavaliacaoInput', 'Mudou a estrutura de atendimento');
  await page.click('.po-modal .po-modal-sim');
  await tela(page, 'poReavaliacaoInfo');
  const nova = (await hash(page)).split('po=')[1];
  db = await banco(page);
  const rn = db['avaliacoes-posicionamento'][nova];
  afirma(rn && rn.avaliacaoArquiteturalId === 'p3v2', 'D6: a reavaliação aponta para a Avaliação de Produto/Serviço v2 do item (a ponta, nunca a v1 da anterior)', rn && rn.avaliacaoArquiteturalId);
  afirma(rn && rn.versao === 2 && rn.avaliacaoAnteriorId === 'g1' && rn.motivoReavaliacao === 'Mudou a estrutura de atendimento' && rn.status === 'rascunho', 'rascunho v2, anterior g1, motivo', JSON.stringify(rn && { v: rn.versao, a: rn.avaliacaoAnteriorId }));
  afirma(db['posicionamento-vigente-por-item'].p3 === 'g1' && db['posicionamento-rascunho-por-item'].p3 === nova, 'a v1 continua vigente; a reserva aponta para a v2');
  afirma((await page.locator('#poChecklist .po-resp.ativa').count()) === 3, 'respostas da v1 pré-preenchidas (O1–O3)');
  afirma(/continua vigente/.test(await texto(page, '#poReavaliacaoInfo')) && /Mudou a estrutura/.test(await texto(page, '#poReavaliacaoInfo')), 'aviso da reavaliação: a anterior continua vigente, com o motivo');
  await ir(page, '#avaliacoes?po=g1');
  await tela(page, 'poReavaliacaoAndamento');
  afirma(await existe(page, '#poDecisaoFinal') && !(await existe(page, '#poReavaliarBtn')), 'na v1: aviso de reavaliação em andamento, decisão dela continua, sem outro Reavaliar');
  await page.click('#poReavaliacaoAndamento .po-abrir');
  await tela(page, 'poConcluirBtn');
  await page.click('#poConcluirBtn');
  await tela(page, 'poResultado');
  await esperarCondicao(page, () => window.__CFG.__dbReal['posicionamento-vigente-por-item'].p3 !== 'g1', null, { descricao: 'o vigente trocar' });
  db = await banco(page);
  afirma(db['posicionamento-vigente-por-item'].p3 === nova && !(db['posicionamento-rascunho-por-item'] || {}).p3, 'concluir: o vigente passa a ser a v2 e a reserva sai');
  afirma(Object.values(db['posicionamento-auditoria'][nova] || {}).some((a) => a.tipo === 'conclusao' && a.vigenteAnterior === 'g1'), 'auditoria "conclusao" com vigenteAnterior = g1');
  afirma(db['posicionamento-decisoes'].g1.codigoFinal === 'COE', 'a decisão da v1 ficou intacta');
  afirma(await existe(page, '#poSemDecisao') && await existe(page, '#poDecisaoForm'), 'a v2 começa "Sem decisão registrada" e pode ser decidida');
  afirma(/2 versões/.test(await texto(page, '#poHistoricoVersoes summary')), 'histórico de versões: 2 versões');
  await ir(page, '#avaliacoes?po=g1');
  await tela(page, 'poHistorica');
  afirma(await existe(page, '#poDecisaoFinal') && !(await existe(page, '#poDecisaoForm')) && !(await existe(page, '#poReavaliarBtn')), 'v1 histórica: mostra a decisão dela, sem decidir nem reavaliar');

  console.log('\n== 5. D4 — reavaliação em andamento bloqueia a decisão ==');
  await ir(page, '#avaliacoes?po=h2');
  await tela(page, 'poDecisaoForm');
  afirma(/Revisão anual/.test(await texto(page, '#poMotivoReavaliacao')), 'h2 mostra o motivo da reavaliação que a criou');
  await page.click('#poReavaliarBtn');
  await page.waitForSelector('#poMotivoReavaliacaoInput');
  await page.fill('#poMotivoReavaliacaoInput', 'Terceira versão');
  await page.click('.po-modal .po-modal-sim');
  await tela(page, 'poReavaliacaoInfo');
  const r3 = (await hash(page)).split('po=')[1];
  await ir(page, '#avaliacoes?po=h2');
  await tela(page, 'poDecisaoBloqueada');
  afirma((await texto(page, '#poDecisaoBloqueada')).trim() === D4 && !(await existe(page, '#poDecisaoForm')), 'mensagem exata do D4 e nenhum formulário');
  await ir(page, '#avaliacoes?po=' + r3);
  await tela(page, 'poDescartarBtn');
  await page.click('#poDescartarBtn');
  await page.waitForSelector('#poMotivoDescarte');
  await page.fill('#poMotivoDescarte', 'Não era necessário');
  await page.click('.po-modal .po-modal-sim');
  await tela(page, 'poDescartado');
  await ir(page, '#avaliacoes?po=h2');
  await tela(page, 'poDecisaoForm');
  db = await banco(page);
  afirma(db['posicionamento-vigente-por-item'].p1 === 'h2' && db['avaliacoes-posicionamento'][r3].status === 'descartado', 'descartar a reavaliação: h2 continua vigente e o formulário volta');
  afirma(await larguraOk(page), 'sem rolagem horizontal');
  await ctx.close();
  afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')', erros.join(' | '));
}

async function perfilAvaliacao(browser, nomeTela, viewport) {
  console.log('\n######## ' + nomeTela + ' — perfil "Avaliação" só consulta ########');
  const { ctx, page, erros } = await abrir(browser, viewport, { email: AVAL, hash: '#avaliacoes?po=h2' });
  await tela(page, 'poSemDecisao');
  afirma(!(await existe(page, '#poDecisaoForm')) && !(await existe(page, '#poReavaliarBtn')), 'sem formulário de decisão e sem Reavaliar');
  await ir(page, '#avaliacoes?po=h1');
  await tela(page, 'poDecisaoFinal');
  afirma(/Tx AREA_ESPECIALIZADA/.test(await texto(page, '#poDecisaoFinal')) && /Área \(nome antigo\)/.test(await texto(page, '#poNomeDecisao')), 'lê a decisão: nome atual e nome registrado na decisão');
  await ctx.close();
  afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
}

async function redeLenta(browser, nomeTela, viewport) {
  console.log('\n######## ' + nomeTela + ' — decisões lentas e recusadas ########');
  let { ctx, page, erros } = await abrir(browser, viewport, { hash: '#avaliacoes?po=h1', delays: { 'posicionamento-decisoes': 3000 } });
  await tela(page, 'poDecisaoCarregando');
  afirma(!(await existe(page, '#poSemDecisao')), 'decisões ainda não lidas: "Carregando…", nunca "Sem decisão registrada"');
  await tela(page, 'poDecisaoFinal');
  afirma(true, 'a leitura chegou: a decisão aparece');
  await ctx.close();
  afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
  ({ ctx, page, erros } = await abrir(browser, viewport, { hash: '#avaliacoes?po=lista', delays: { 'posicionamento-decisoes': 3000 } }));
  await esperarCondicao(page, () => document.querySelectorAll('#poLista .po-linha').length >= 3, null, { descricao: 'as linhas chegarem antes das decisões' });
  afirma((await linhas(page)).every((l) => /Carregando/.test(l.decisao)), 'lista: coluna Decisão final "Carregando…" enquanto as decisões não chegam');
  await ctx.close();
  ({ ctx, page, erros } = await abrir(browser, viewport, { hash: '#avaliacoes?po=g1', fail: ['posicionamento-decisoes'] }));
  await tela(page, 'poDecisaoErroLeitura');
  afirma(!(await existe(page, '#poSemDecisao')) && !(await existe(page, '#poDecisaoForm')), 'leitura recusada: "Não foi possível ler", sem "Sem decisão registrada" e sem formulário');
  afirma(await esperarAusencia(page, '#poSemDecisao', { janela: 1000, motivo: 'a leitura falha em ~10 ms no falso; 1 s sem "Sem decisão" prova que a falha não vira ausência' }), '…e continua assim');
  await ctx.close();
  afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
}

(async () => {
  const browser = await chromium.launch();
  for (const [nome, vp] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    await fluxoDecisao(browser, nome, vp);
    await perfilAvaliacao(browser, nome, vp);
    await redeLenta(browser, nome, vp);
  }
  await browser.close();
  console.log('\n============================\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
