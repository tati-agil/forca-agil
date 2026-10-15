/* Refinamento integrado — apoio real à decisão e clareza da jornada. Firebase falso em persistência real; hermético;
 * dados 100% sintéticos. Desktop e 375 px. Prova, pela interface:
 *   P1. Apoio O7 × O9 antes de responder: recolhido, com a diferença, as perguntas de orientação, exemplos hipotéticos
 *       (O7 × O9), quando as duas se aplicam e o que esclarecer, confrontado com a Ajuda oficial da O9 e declarado como
 *       orientação (não critério oficial). "Ainda não tenho informações suficientes" salva o rascunho como está: nenhuma
 *       resposta nova, nenhuma terceira resposta, nenhum estado novo gravado.
 *   S3. Hipótese que coincide: "A recomendação coincide com sua hipótese inicial" (não "Hipótese confirmada").
 *   P4. Trabalhos de avaliação: a análise de área com responsabilidades por avaliar aparece em "Continuar de onde
 *       parou" mesmo sem rascunho, com as contagens e "Continuar análise"; nada de "Nenhuma avaliação em andamento".
 *   7.  Próxima ação estável: uma responsabilidade já cadastrada e ainda não iniciada vem antes da seguinte (a sugestão
 *       não salta). Gravação lenta: a linha mostra "Gravando…", o clique repetido não grava de novo, sem resposta no
 *       prazo a linha fica "Aguardando confirmação do servidor" com a mensagem clara, e a confirmação tardia avisa; um
 *       só cadastro é criado.
 *   8.  Legenda "Avaliada = O1–O9 concluído"; a Composição diz para que serve (sem proposta automática); nomes longos
 *       sem rolagem lateral. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const { semente, ARQ, chave } = require('./semente-jornada');
const N = require(path.join(__dirname, '..', '..', 'forca-agil', 'analises-organizacionais-nucleo.js'));
const F = require(path.join(__dirname, '..', '..', 'forca-agil', 'analises-organizacionais-firebase.js'));

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
let falhas = 0, total = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); if (!c) falhas++; }
const LONGO = 'Área sintética com um nome propositalmente muito longo para conferir a quebra de linha no celular — Gerência de Testes e Conferências Sintéticas';
const objeto = (nome) => ({ nome, descricao: nome, finalidade: nome, contexto: 'Cadastro simplificado: o nome e a finalidade repetem a descrição informada pela pessoa; nada foi inferido.', situacao: 'ativo', revisao: 1,
  criadoPor: { uid: 'u', email: ARQ }, criadoEm: 1791713600000, atualizadoPor: { uid: 'u', email: ARQ }, atualizadoEm: 1791713600000, auditoriaId: 'a' });
function porCaminho(db, p, v) { const ks = p.split('/'); let o = db; ks.slice(0, -1).forEach((k) => { o = o[k] = o[k] || {}; }); o[ks[ks.length - 1]] = v; }
function sementeRef() {
  const db = semente();
  db['analises-organizacionais-config'] = { habilitacao: 'LIBERADO_PARA_PERFIS_AUTORIZADOS' };
  db['posicionamento-rascunho-por-item'] = {};
  /* a hipótese do Posicionamento concluído da Agilidade coincide com a recomendação (COE) */
  db['avaliacoes-posicionamento'].gA.hipoteseInicial = 'COE';
  let n = 0;
  const op = (fn) => {
    const est = F.estadoDoBanco({ analises: db['analises-organizacionais'], propostas: db['analises-propostas'], aprovacoes: db['analises-aprovacoes'] });
    const r = fn(est, { operacaoId: 'op' + (++n), novoId: 'n' + n, usuario: { id: chave(ARQ), email: ARQ }, agora: 1791713600000 + n });
    if (!r.ok) throw new Error(JSON.stringify(r.erros));
    const w = F.payloadOperacao(r, { audId: 'ev' + n, usuario: { uid: chave(ARQ), email: ARQ }, agora: 1791713600000 + n });
    Object.keys(w).forEach((k) => porCaminho(db, k, w[k]));
  };
  op((e, c) => N.criarAnalise(e, { nome: LONGO, tipoEscopo: 'estrutura' }, Object.assign(c, { novoId: 'anArea' })));
  op((e, c) => N.definirRecorte(e, 'anArea', { descricao: 'Sintética A — já cadastrada, ainda sem O1–O9', separacao: { valor: 'nao' } }, Object.assign(c, { novoId: 'rA' })));
  op((e, c) => N.definirRecorte(e, 'anArea', { descricao: 'Sintética B — pronta para avaliar', separacao: { valor: 'nao' } }, Object.assign(c, { novoId: 'rB' })));
  op((e, c) => N.definirRecorte(e, 'anArea', { descricao: 'Sintética C — pronta para avaliar', separacao: { valor: 'nao' } }, Object.assign(c, { novoId: 'rC' })));
  db['objetos-organizacionais'].oA = objeto('Sintética A — já cadastrada, ainda sem O1–O9');
  op((e, c) => N.associarAtuacao(e, 'anArea', 'rA', 'oA', c));
  db['analises-por-objeto'] = { oA: { analiseId: 'anArea', recorteId: 'rA' } };
  return db;
}
async function abrir(browser, viewport, hash, extra) {
  const cfg = Object.assign({ db: sementeRef(), user: { email: ARQ, emailVerified: true, uid: 'u-' + chave(ARQ) }, uidDoUsuario: true, prefixoChave: 'k' + (++abrir.n) + 'x', delayDefault: 10, persistenciaReal: true }, extra || {});
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
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
abrir.n = 0;
const esperar = (page, fn, arg, limite) => esperarCondicao(page, fn, arg, { limite: limite || 20000 });
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent : ''; }, sel);
const existe = (page, sel) => page.evaluate((s) => !!document.querySelector(s), sel);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const foto = async (page, nome) => { if (!process.env.FA_PRINTS) return; await page.screenshot({ path: path.join(process.env.FA_PRINTS, nome + '-' + page.viewportSize().width + '.png'), fullPage: true }); };
const ir = (page, hash) => page.evaluate((h) => { location.hash = h; }, hash);

async function jornada(browser, viewport, rotulo) {
  console.log('\n== ' + rotulo + ' ==');
  let { ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?tr=1');
  /* P4 */
  await page.waitForSelector('#avpTrabArea_anArea');
  const linhaArea = await texto(page, '.avp-trab-area[data-analise="anArea"]');
  afirma(/Análise de área · 3 cadastradas · 3 prontas para avaliar/.test(linhaArea) && /Continuar análise/.test(linhaArea), 'P4. a análise de área com responsabilidades por avaliar aparece em "Continuar de onde parou", sem rascunho', linhaArea);
  afirma(!(await existe(page, '#avpTrabSemPendentes')) && !/Nenhuma avaliação em andamento/.test(await texto(page, '#avpTrabContinuar')), 'P4. nada de "Nenhuma avaliação em andamento" enganoso');
  afirma(await larguraOk(page), 'P4. nome longo sem rolagem lateral');
  await foto(page, 'trabalhos');
  await page.click('#avpTrabArea_anArea');
  await page.waitForSelector('#anProximaAcao');
  /* 7. próxima ação estável e 8. legenda/composição */
  afirma(/Inicie o O1–O9 de "Sintética A/.test(await texto(page, '#anProximaAcao')), '7. a sugestão é a primeira da lista (já cadastrada, sem O1–O9), não salta para a seguinte', await texto(page, '#anProximaAcao'));
  afirma(/Avaliada.*O1–O9 da responsabilidade foi concluído/.test(await texto(page, '#anLegendaAvaliada')), '8. legenda: "Avaliada" = O1–O9 concluído');
  afirma(/Para que serve/.test(await texto(page, '#anComposicaoProposito')) && /não faz proposta automática, não atribui um tipo à área inteira e não distribui responsabilidades entre núcleos/.test(await texto(page, '#anComposicaoProposito')), '8. a Composição diz para que serve e o que não faz');
  afirma(await larguraOk(page), '8. análise com nome longo sem rolagem lateral');
  afirma(!erros.length, 'sem erro de página', erros);
  await ctx.close();

  /* 7. gravação lenta: o cadastro da B leva 20 s para ser confirmado (o prazo da tela é 15 s) */
  ({ ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?an=anArea', { atrasoConfirmacao: { 'analises-por-objeto': 20000 } }));
  await page.waitForSelector('#anCriarAtuacao_rB');
  await page.click('#anCriarAtuacao_rB');
  await page.waitForSelector('#anPendente_rB');
  afirma(/Gravando…/.test(await texto(page, '#anPendente_rB')) && !(await existe(page, '#anCriarAtuacao_rB')), '7. a linha mostra "Gravando…" e o botão some (sem clique repetido)');
  await page.evaluate(() => { const b = document.getElementById('anCriarAtuacao_rB'); if (b) b.click(); });
  await esperar(page, () => /Aguardando confirmação do servidor/.test((document.getElementById('anPendente_rB') || {}).textContent || ''), undefined, 25000);
  const erro = await texto(page, '#anErro');
  afirma(/ainda não confirmou a gravação/.test(erro) && /Não repita o clique/.test(erro), '7. sem resposta no prazo: mensagem clara, sem pedir para repetir', erro);
  await esperar(page, () => /O servidor confirmou a gravação/.test((document.getElementById('anFlash') || {}).textContent || ''), undefined, 15000);
  afirma(!(await existe(page, '#anPendente_rB')), '7. confirmação tardia: o marcador sai e a tela avisa');
  await foto(page, 'confirmacao-tardia');
  const db = await banco(page);
  const doB = Object.keys(db['analises-por-objeto'] || {}).filter((o) => db['analises-por-objeto'][o].recorteId === 'rB');
  afirma(doB.length === 1 && db['analises-organizacionais'].anArea.recortes.rB.objetoId === doB[0], '7. um só cadastro criado para a responsabilidade', doB);
  afirma(!erros.length, 'sem erro de página (gravação lenta)', erros);

  /* P1: apoio O7 × O9 no rascunho de A */
  await ir(page, '#avaliacoes?po=atuacoes&item=oA');
  await page.waitForSelector('#poHipoteseIniciar');
  await page.click('#poHipoteseIniciar input[value="NAO_SEI"]'); await page.click('#poIniciarAtuacaoBtn'); await page.waitForSelector('#poChecklist');
  for (const [q, v] of [['O1', 'SIM'], ['O2', 'NAO'], ['O3', 'NAO'], ['O4', 'NAO'], ['O5', 'NAO']]) { await page.click('.po-resp[data-q="' + q + '"][data-v="' + v + '"]'); await page.waitForTimeout(80); }
  await page.waitForSelector('#poApoioO7O9', { state: 'attached' });
  afirma(!(await page.evaluate(() => document.getElementById('poApoioO7O9').open)), 'P1. o apoio começa recolhido (não é questionário obrigatório)');
  await page.click('#poAbrirApoioO7O9');
  await esperar(page, () => { const d = document.getElementById('poApoioO7O9'); return !!d && d.open && document.getElementById('poTiposEstrutura').open; });
  const ap = await texto(page, '#poApoioO7O9');
  afirma(/Orientações para investigar, não novos critérios oficiais/.test(ap) && /hipotéticos e não classificam nenhuma área da PREVI/.test(ap), 'P1. declarado como orientação, com exemplos hipotéticos');
  afirma(/observar onde termina a cadeia de valor e de quem são as regras/.test(await texto(page, '#poApoioAjudaOficial')), 'P1. confrontado com a Ajuda oficial da O9');
  afirma(await page.evaluate(() => document.querySelectorAll('#poApoioPerguntas li').length) === 6 && /indispensável/.test(await texto(page, '#poApoioIndispensavel')), 'P1. seis pontos a verificar e "ser indispensável não basta"');
  const ex = await texto(page, '#poApoioExemplos');
  afirma(['Contabilidade gerencial', 'Contabilização de eventos operacionais', 'Gestão do processo contábil', 'Gestão orçamentária', 'Obrigações contábeis e tributárias', 'Jurídico', 'Gestão de Pessoas', 'Serviços de negócio compartilhados'].every((x) => ex.indexOf(x) !== -1), 'P1. exemplos contrastantes (evidência para O7 × para O9)');
  afirma(/Quando as duas parecem se aplicar/.test(ap) && /esclareça/.test(ap), 'P1. quando as duas se aplicam e o que esclarecer');
  afirma(await larguraOk(page), 'P1. apoio sem rolagem lateral');
  await foto(page, 'apoio-o7-o9');
  const respAntes = await page.evaluate(() => Array.from(document.querySelectorAll('.po-resp')).map((b) => b.getAttribute('data-v')).filter((v, i, a) => a.indexOf(v) === i).sort().join(','));
  afirma(respAntes === 'NAO,SIM', 'P1. nenhuma terceira resposta nas perguntas (só SIM e NÃO)', respAntes);
  await page.click('#poApoioSemInfo');
  await page.waitForSelector('#poApoioSemInfoNota');
  await esperar(page, () => /Rascunho salvo/.test((document.getElementById('poFlash') || {}).textContent || ''));
  const db2 = await banco(page), kA = db2['posicionamento-rascunho-por-item'].oA, reg = db2['avaliacoes-posicionamento'][kA];
  const qs = Object.keys(reg.respostas || {}).sort().join(',');
  afirma(reg.status === 'rascunho' && qs === 'O1,O2,O3,O4,O5' && !Object.keys(reg).some((c) => /apoio|semInfo|insuficiente/i.test(c)), '"Ainda não tenho informações suficientes": salva o rascunho como está, sem resposta nova nem estado novo', qs);
  afirma(/Não marque NÃO só por insegurança/.test(await texto(page, '#poApoioSemInfoNota')), 'P1. orienta a buscar as informações, sem responder pela pessoa');
  afirma(!erros.length, 'sem erro de página (apoio)', erros);

  /* S3: hipótese que coincide */
  await ir(page, '#avaliacoes?po=gA');
  await page.waitForSelector('#poHipoteseComparacao');
  const hc = await texto(page, '#poHipoteseComparacao');
  afirma(/A recomendação coincide com sua hipótese inicial/.test(hc) && !/Hipótese confirmada/.test(hc), 'S3. "A recomendação coincide com sua hipótese inicial"', hc);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await jornada(browser, { width: 1280, height: 900 }, 'Computador (1280 px)');
    await jornada(browser, { width: 375, height: 800 }, 'Celular (375 px)');
  } finally { await browser.close(); }
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
