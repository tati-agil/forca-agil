/* Orientações O1–O9 da homologação "Gerir o processo contábil" — hermético, Firebase falso em persistência real, dados
 * sintéticos. Prova:
 *   A. (módulo) as duas PROPOSTAS editoriais existem e são do questionário O1–O9: a das ajudas mexe só em ajudas
 *      (textoAjuda.* e ajudaExtra) de O1, O5, O7, O8 e O9 — nunca na pergunta, nas interpretações (SIM/NÃO), no título nem
 *      na Ajuda da O9 aprovada em 15/10; a da redação da O9 mexe só no texto da O9. Todo "de" é o texto de fábrica (o que
 *      está em vigor sem edição manual) e os campos criados não existem hoje. O conteúdo de fábrica não foi reescrito.
 *   B. (tela) nada é publicado sozinho: o questionário continua na versão em vigor até alguém clicar em "Aplicar" no
 *      ADMIN; os cartões mostram atual × proposto; aplicar cria UMA versão por proposta, com só os campos previstos.
 *   A2. a terceira PROPOSTA (didática) mexe só em ajudas (textoAjuda.* e ajudaExtra) de O2, O3, O4, O5 e O6, vem depois das
 *      outras, parte do texto de fábrica e explica, na O5, cliente interno e "serviço" × Produto/Serviço dedicado; nada cita a
 *      área homologada. Aplicada pelo ADMIN DEPOIS da anterior, cria UMA versão só com os campos previstos.
 *   C. (tela) a pergunta mostra a Ajuda no padrão "O que esta pergunta quer descobrir? / Quando SIM é defensável? / Quando NÃO
 *      é defensável? / Atenção — o que não determina a resposta, sozinho", recolhida, "O que observar?" e "Exemplos de SIM e de
 *      NÃO" (ilustrativos, não são regra) para O1–O9; avaliação
 *      começada antes da aplicação continua com a redação dela; depois, com a nova (O5, O7, O8, O9) — e o apoio O7 × O9
 *      cita a pergunta da versão da avaliação e diz que autosserviço é forma, não condição.
 *   D. "Ainda não sei": o aviso explica que deixar sem resposta não é NÃO e que dá para salvar e voltar; só SIM e NÃO
 *      (nenhuma terceira resposta); salvar o rascunho com perguntas sem resposta funciona e não conclui.
 *   Desktop e 375 px, sem rolagem lateral. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { abrirRecolhidas } = require('./abrir-recolhidas');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const { semente, chave } = require('./semente-jornada');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const ADM = 'admin.geral@previ.com.br';
const QCOD = 'POSICIONAMENTO_ORGANIZACIONAL';
const AJ = 'ajudas-o1-o9-homologacao', RO9 = 'redacao-pergunta-o9', DID = 'ajudas-o1-o9-didatica';
let falhas = 0, total = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); if (!c) falhas++; }

function carregarQuestionarios() {
  const ctx = { console: { log() {}, warn() {}, error() {} } };
  ctx.window = ctx;
  const ref = function r(p) { return { on() {}, once() {}, off() {}, child: (c) => r(p + '/' + c) }; };
  ctx.firebase = { database: () => ({ ref }) };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'questionarios-config.js'), 'utf8'), ctx);
  return ctx.window.faQuestionarios;
}
const lerCampo = (p, campo) => campo.split('.').reduce((v, k) => (v == null ? undefined : v[k]), p);
const objeto = (nome) => ({ nome, descricao: nome, finalidade: nome, contexto: 'Cadastro simplificado: o nome e a finalidade repetem a descrição informada pela pessoa; nada foi inferido.', situacao: 'ativo', revisao: 1,
  criadoPor: { uid: 'u', email: ADM }, criadoEm: 1791713600000, atualizadoPor: { uid: 'u', email: ADM }, atualizadoEm: 1791713600000, auditoriaId: 'a' });
async function abrir(browser, viewport, hash) {
  const db = semente();
  db['fa-admins'] = { [chave(ADM)]: true };
  db['fa-users'][chave(ADM)] = { name: 'Admin', email: ADM, area: 'INFOR' };
  Object.assign(db['objetos-organizacionais'], { oAntes: objeto('Sintética — começada antes'), oDepois: objeto('Sintética — começada depois') });
  const cfg = { db, user: { email: ADM, emailVerified: true, uid: 'u-' + chave(ADM) }, uidDoUsuario: true, prefixoChave: 'q' + (++abrir.n) + 'x', delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await ctx.addInitScript(abrirRecolhidas(['details.avp-config-sub']));
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
abrir.n = 0;
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent : ''; }, sel);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const ir = (page, hash) => page.evaluate((h) => { location.hash = h; }, hash);
async function iniciar(page, item) {
  await ir(page, '#avaliacoes?po=atuacoes&item=' + item);
  await page.waitForSelector('#poHipoteseIniciar');
  await page.click('#poHipoteseIniciar input[value="NAO_SEI"]'); await page.click('#poIniciarAtuacaoBtn'); await page.waitForSelector('#poChecklist');
}
async function ateN3(page) {
  for (const [qq, v] of [['O1', 'SIM'], ['O2', 'NAO'], ['O3', 'NAO'], ['O4', 'NAO'], ['O5', 'NAO']]) {
    await page.click('.po-resp[data-q="' + qq + '"][data-v="' + v + '"]');
    await esperarCondicao(page, (a) => !!document.querySelector('.po-resp.ativa[data-q="' + a[0] + '"][data-v="' + a[1] + '"]'), [qq, v], { descricao: 'resposta ' + qq });
  }
  await page.waitForSelector('.po-pergunta[data-q="O9"]');
}
async function aplicar(page, id) {
  await page.click('.avp-correcao-aplicar-btn[data-correcao="' + id + '"]');
  await page.waitForSelector('.avp-modal-confirm-btn'); await page.click('.avp-modal-confirm-btn');
  await page.waitForSelector('.avp-modal-ok-btn'); await page.click('.avp-modal-ok-btn');
}
function diferencas(Q, de, para) {
  const dif = [];
  para.forEach((p) => { const f = de.find((x) => x.codigoEstavel === p.codigoEstavel); Object.keys(Object.assign({}, f, p)).forEach((k) => {
    if (k === 'tipo') return;
    if (k === 'textoAjuda') { Object.keys(Object.assign({}, f.textoAjuda, p.textoAjuda)).forEach((s) => { if (JSON.stringify((f.textoAjuda || {})[s]) !== JSON.stringify((p.textoAjuda || {})[s])) dif.push(p.codigoEstavel + '.textoAjuda.' + s); }); return; }
    if (JSON.stringify(f[k]) !== JSON.stringify(p[k])) dif.push(p.codigoEstavel + '.' + k);
  }); });
  return dif.sort();
}

async function tela(browser, viewport, rotulo) {
  console.log('\n== B/C/D. ' + rotulo + ' ==');
  const { ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?po=atuacoes');
  /* avaliação começada ANTES da aplicação: redação em vigor (fábrica), com a interface nova */
  await iniciar(page, 'oAntes');
  afirma(/Ainda não sabe responder\?/.test(await texto(page, '#poSemEvidencia')) && /não conta como NÃO/.test(await texto(page, '#poSemEvidencia')) && /SALVAR RASCUNHO/.test(await texto(page, '#poSemEvidencia')), 'D. o aviso: sem resposta não é NÃO; salvar o rascunho e voltar');
  afirma(await page.locator('.po-pergunta[data-q="O1"] .po-resp').count() === 2, 'D. só SIM e NÃO (nenhuma terceira resposta)');
  const ajO1 = await texto(page, '.po-pergunta[data-q="O1"] .avp-ajuda-det');
  afirma(/O que esta pergunta quer descobrir\?/.test(ajO1) && /Quando SIM é defensável\?/.test(ajO1) && /Quando NÃO é defensável\?/.test(ajO1) && !(await page.evaluate(() => document.querySelector('.po-pergunta[data-q="O1"] .avp-ajuda-det').open)), 'C. Ajuda no padrão novo, recolhida');
  afirma(/Identifica se a responsabilidade tem característica de Linha/.test(ajO1), 'B. antes de aplicar: a Ajuda continua a redação em vigor (nada publicado sozinho)');
  afirma(/O que observar\?/.test(await texto(page, '#poInvestigar_O1 > summary')) && /Responder SIM não cria uma Linha/.test(await texto(page, '#poInvestigar_O1')) && /Não marque NÃO só por insegurança/.test(await texto(page, '#poInvestigar_O1')), 'C. "O que observar?" (O1), com o lembrete de não marcar NÃO por insegurança');
  /* D. salvar com perguntas sem resposta */
  await page.click('.po-resp[data-q="O1"][data-v="SIM"]');
  await esperarCondicao(page, () => !!document.querySelector('.po-resp.ativa[data-q="O1"]'), null, { descricao: 'O1 marcada' });
  await page.click('#poSalvarBtn');
  await esperarCondicao(page, () => !!document.getElementById('poFlash'), null, { descricao: 'rascunho salvo' });
  let db = await banco(page);
  const kAntes = db['posicionamento-rascunho-por-item'].oAntes, rAntes = db['avaliacoes-posicionamento'][kAntes];
  afirma(rAntes.status === 'rascunho' && rAntes.respostas.O1 && !rAntes.respostas.O2 && await page.locator('#poConcluirBtn[disabled]').count() === 1, 'D. o rascunho é salvo com perguntas sem resposta e não conclui');
  const versaoAntes = rAntes.questionnaireContentVersion;

  /* B. ADMIN: as propostas aparecem, nada aplicado */
  await ir(page, '#admin');
  await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
  await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
  await page.waitForSelector('#avpConfigQuestionariosBtn'); await page.click('#avpConfigQuestionariosBtn');
  await page.waitForSelector('#avpCorrecao-' + AJ);
  const cAj = await texto(page, '#avpCorrecao-' + AJ), cRo = await texto(page, '#avpCorrecao-' + RO9);
  afirma(/Correção editorial disponível/.test(cAj) && /Proposta para aprovação/.test(cAj) && /19 ajustes/.test(cAj) && !/divergente/.test(cAj), 'B. cartão das ajudas: proposta, 19 ajustes pendentes, nada divergente', cAj.slice(0, 200));
  afirma(/Antes:/.test(cAj) && /Depois:/.test(cAj) && /Novo:/.test(cAj), 'B. o cartão mostra atual × proposto');
  afirma(/Redação da pergunta O9/.test(cRo) && /respondida de novo/.test(cRo), 'B. a redação da O9 é uma proposta separada, avisando o efeito na reavaliação');
  db = await banco(page);
  const vAntes = (db['questionarios-config'] && db['questionarios-config'][QCOD] && db['questionarios-config'][QCOD].versaoPublicada) || 1;
  afirma(vAntes === 1, 'B. nada publicado sozinho: o O1–O9 continua na versão em vigor', vAntes);
  afirma(await larguraOk(page), 'B. cartões sem rolagem lateral');
  /* como em produção: a Ajuda da O9 aprovada em 15/10 já está em vigor (versão 2) */
  await aplicar(page, 'orientacao-o7-o9');
  /* aplicar = aprovação, uma por vez */
  const Q = carregarQuestionarios();
  db = await banco(page);
  const v2 = db['questionarios-config'][QCOD].versoes[2].perguntas;
  afirma(/Correção editorial disponível/.test(await texto(page, '#avpCorrecao-' + AJ)), 'B. com a versão 2 (O7 × O9) em vigor, a proposta das ajudas continua pendente, sem divergência');
  await aplicar(page, AJ);
  db = await banco(page);
  let q = db['questionarios-config'][QCOD];
  afirma(q.versaoPublicada === 3 && JSON.stringify(diferencas(Q, v2, q.versoes[3].perguntas)) === JSON.stringify(['O1.ajudaExtra', 'O1.textoAjuda.quandoNao', 'O1.textoAjuda.quandoSim', 'O1.textoAjuda.significado', 'O5.ajudaExtra', 'O5.textoAjuda.quandoNao', 'O5.textoAjuda.quandoSim', 'O5.textoAjuda.significado', 'O7.ajudaExtra', 'O7.textoAjuda.quandoNao', 'O7.textoAjuda.quandoSim', 'O7.textoAjuda.significado', 'O8.ajudaExtra', 'O8.textoAjuda.quandoNao', 'O8.textoAjuda.quandoSim', 'O8.textoAjuda.significado', 'O9.textoAjuda.quandoNao', 'O9.textoAjuda.quandoSim', 'O9.textoAjuda.significado']), 'B. aplicar as ajudas cria a versão 3 só com as ajudas previstas', diferencas(Q, v2, q.versoes[3].perguntas));
  await aplicar(page, RO9);
  db = await banco(page);
  q = db['questionarios-config'][QCOD];
  afirma(q.versaoPublicada === 4 && JSON.stringify(diferencas(Q, q.versoes[3].perguntas, q.versoes[4].perguntas)) === JSON.stringify(['O9.texto']), 'B. aplicar a redação da O9 cria a versão 4 só com o texto da O9', diferencas(Q, q.versoes[3].perguntas, q.versoes[4].perguntas));

  /* A2 na tela: a proposta didática, aplicada DEPOIS da anterior (cujos textos contam como anteriores conhecidos) */
  const cDid = await texto(page, '#avpCorrecao-' + DID);
  afirma(/Correção editorial disponível/.test(cDid) && /15 ajustes/.test(cDid) && !/divergente/.test(cDid), 'A2. cartão da proposta didática: 15 ajustes pendentes, nada divergente, com a anterior já aplicada', cDid.slice(0, 200));
  const versoesAntesDid = JSON.stringify([1, 2, 3, 4].map((n) => q.versoes[n]));
  await aplicar(page, DID);
  db = await banco(page);
  q = db['questionarios-config'][QCOD];
  /* sobreposição: aplicadas em sequência, cada proposta deixa os seus textos e nenhuma versão anterior muda */
  {
    const props = Q.listarCorrecoesEditoriais(QCOD), v5 = q.versoes[5].perguntas;
    const em = (lista, aj) => lerCampo(lista.find((x) => x.codigoEstavel === aj.pergunta), aj.campo);
    const pAj = props.find((x) => x.id === AJ), pRo = props.find((x) => x.id === RO9), pDid = props.find((x) => x.id === DID);
    afirma(JSON.stringify([1, 2, 3, 4].map((n) => q.versoes[n])) === versoesAntesDid, 'Sobreposição: as versões 1 a 4 (histórico) continuam idênticas depois da versão 5');
    afirma(pAj.ajustes.filter((x) => x.pergunta !== 'O5').every((x) => em(v5, x) === x.para), 'Sobreposição: na versão 5, as ajudas de O1, O7, O8 e O9 continuam as da homologação');
    afirma(pRo.ajustes.every((x) => em(v5, x) === x.para), 'Sobreposição: na versão 5, a pergunta O9 continua a redação aprovada');
    afirma(pDid.ajustes.every((x) => em(v5, x) === x.para) && pAj.ajustes.filter((x) => x.pergunta === 'O5').every((x) => em(q.versoes[3].perguntas, x) === x.para), 'Sobreposição: O5 da versão 5 = didática; a versão 3 guarda a O5 da homologação');
  }
  afirma(q.versaoPublicada === 5 && JSON.stringify(diferencas(Q, q.versoes[4].perguntas, q.versoes[5].perguntas)) === JSON.stringify(['O2.textoAjuda.quandoNao', 'O2.textoAjuda.quandoSim', 'O2.textoAjuda.significado', 'O3.textoAjuda.quandoNao', 'O3.textoAjuda.quandoSim', 'O3.textoAjuda.significado', 'O4.textoAjuda.quandoNao', 'O4.textoAjuda.quandoSim', 'O5.ajudaExtra', 'O5.textoAjuda.quandoNao', 'O5.textoAjuda.quandoSim', 'O5.textoAjuda.significado', 'O6.textoAjuda.quandoNao', 'O6.textoAjuda.quandoSim', 'O6.textoAjuda.significado']), 'A2. aplicar a proposta didática cria a versão 5 só com as ajudas de O2–O6', diferencas(Q, q.versoes[4].perguntas, q.versoes[5].perguntas));
  afirma(q.versoes[5].perguntas.every((x) => { const a = q.versoes[4].perguntas.find((y) => y.codigoEstavel === x.codigoEstavel); return a.texto === x.texto && a.justSim === x.justSim && a.justNao === x.justNao; }), 'A2. nenhuma pergunta nem interpretação (SIM/NÃO) mudou');

  /* C. avaliação começada depois: redação nova */
  await iniciar(page, 'oDepois');
  await ateN3(page);
  const aj = async (qq) => texto(page, '.po-pergunta[data-q="' + qq + '"] .avp-ajuda-det');
  afirma(/Responder SIM não cria uma nova Linha/.test(await aj('O1')) && /Atenção — o que não determina a resposta/.test(await aj('O1')), 'C. O1: SIM não cria Linha; o que não determina');
  afirma(/participa de um Produto\/Serviço com uma atividade própria/.test(await aj('O5')) && /Atender clientes internos não significa, por si só, possuir um Produto\/Serviço dedicado/.test(await aj('O5')) && /Chamar uma atividade de "serviço" também não basta/.test(await aj('O5')) && /disponibilizar uma capacidade é oferecer algo que outros usam/.test(await aj('O5')) && /Exemplo ilustrativo: definir roteiros contábeis/.test(await aj('O5')), 'C. O5: dedicado × compartilhado; cliente interno e "serviço" não bastam; entregar × disponibilizar capacidade');
  afirma(/resposta técnica especializada/.test(await aj('O2')) && /Quando SIM é defensável\?/.test(await aj('O2')) && /desenvolve, mantém e dissemina/.test(await aj('O3')) && /Quando NÃO é defensável\?/.test(await aj('O3')), 'C. O2 e O3: Ajuda completa no padrão (antes, só uma frase)');
  for (const qq of ['O1', 'O2', 'O3', 'O4', 'O5']) {
    const ex = await page.evaluate((x) => { const d = document.getElementById('poExemplos_' + x); return d ? { aberto: d.open, t: d.textContent } : null; }, qq);
    afirma(!!ex && !ex.aberto && /Exemplo de SIM:/.test(ex.t) && /Exemplo de NÃO:/.test(ex.t) && /não são regra/.test(ex.t), 'C. ' + qq + ': exemplos de SIM e de NÃO, recolhidos, ilustrativos (não são regra)');
  }
  afirma(/Capacidade de negócio compartilhada:/.test(await aj('O7')) && /Não decidem sozinhos, porque O7 e O9 podem ter essas características/.test(await aj('O7')), 'C. O7: o que é capacidade/serviço compartilhado e o que não distingue O7 de O9');
  afirma(/usa tecnologia ou define regras para parametrizar um sistema/.test(await aj('O8')), 'C. O8: usar ou parametrizar × disponibilizar a capacidade tecnológica');
  afirma(/não uma condição para responder SIM/.test(await aj('O9')) && /tendem a O9 — Plataforma de Gestão Corporativa/.test(await aj('O9')), 'C. O9: autosserviço é forma preferencial; a Ajuda aprovada em 15/10 continua');
  afirma(/destinados predominantemente à administração e ao controle da própria organização/.test(await texto(page, '.po-pergunta[data-q="O9"] .avp-question-text')), 'C. O9: a pergunta na redação nova');
  for (const qq of ['O6', 'O7', 'O8', 'O9']) afirma(/O que observar\?/.test(await texto(page, '#poInvestigar_' + qq + ' > summary')) && await page.locator('#poExemplos_' + qq).count() === 1, 'C. ' + qq + ': "O que observar?" e os exemplos');
  afirma(/com ou sem autosserviço/.test(await page.evaluate(() => (document.getElementById('poExemplos_O9') || {}).textContent || '')), 'C. O9: o exemplo de SIM não exige autosserviço');
  const apoio = await page.evaluate(() => { const d = document.getElementById('poTiposEstrutura'); if (d) d.open = true; const a = document.getElementById('poApoioO7O9'); if (a) a.open = true; return { o9: (document.getElementById('poApoioTextoO9') || {}).textContent || '', auto: (document.getElementById('poApoioAutosservico') || {}).textContent || '' }; });
  afirma(/sem que isso seja condição/.test(apoio.o9) && /a ausência de autosserviço, sozinha, não leva a O9 = NÃO/.test(apoio.auto), 'C. apoio O7 × O9: cita a pergunta da versão da avaliação e diz que autosserviço é forma, não condição');
  await page.evaluate(() => document.querySelectorAll('.avp-ajuda-det, .po-investigar').forEach((d) => { d.open = true; }));
  afirma(await larguraOk(page), 'C. ajudas abertas: sem rolagem lateral');
  /* a avaliação começada antes continua com a redação dela */
  await ir(page, '#avaliacoes?po=' + kAntes);
  await page.waitForSelector('#poChecklist');
  afirma(/Identifica se a responsabilidade tem característica de Linha/.test(await texto(page, '.po-pergunta[data-q="O1"] .avp-ajuda-det')) && versaoAntes === 1, 'C. avaliação começada antes (versão 1): continua com a redação dela');
  afirma(!erros.length, 'sem erro de página', erros);
  await ctx.close();
}

(async () => {
  console.log('== A. Módulo ==');
  const Q = carregarQuestionarios();
  const lista = Q.listarCorrecoesEditoriais(QCOD);
  const aj = lista.find((x) => x.id === AJ), ro = lista.find((x) => x.id === RO9);
  const fab = (cod) => Q.PADRAO[QCOD].perguntas.find((p) => p.codigoEstavel === cod);
  afirma(!!aj && !!ro && aj.codigo === QCOD && ro.codigo === QCOD, 'A. as duas propostas existem, no questionário O1–O9');
  afirma(aj.ajustes.every((x) => ['O1', 'O5', 'O7', 'O8', 'O9'].includes(x.pergunta) && /^(textoAjuda\.(significado|quandoSim|quandoNao)|ajudaExtra)$/.test(x.campo)), 'A. ajudas: só textoAjuda.* e ajudaExtra de O1, O5, O7, O8 e O9');
  afirma(!aj.ajustes.some((x) => x.pergunta === 'O9' && x.campo === 'ajudaExtra'), 'A. a Ajuda da O9 aprovada em 15/10 não é tocada');
  afirma(aj.ajustes.every((x) => (x.de === null ? lerCampo(fab(x.pergunta), x.campo) == null : lerCampo(fab(x.pergunta), x.campo) === x.de)), 'A. todo "de" é o texto de fábrica; os campos criados não existem hoje');
  afirma(ro.ajustes.length === 1 && ro.ajustes[0].pergunta === 'O9' && ro.ajustes[0].campo === 'texto' && ro.ajustes[0].de === fab('O9').texto, 'A. redação: só o texto da O9, a partir do texto de fábrica');
  afirma(/preferencialmente por soluções digitais e autosserviço padronizados/.test(fab('O9').texto) && /Identifica se a responsabilidade tem característica de Linha/.test(fab('O1').textoAjuda.significado), 'A. o conteúdo de fábrica (versão 1) não foi reescrito');
  afirma(aj.ajustes.every((x) => !/GECON|PREVI/.test(x.para || '')), 'A. nenhum texto cita a área homologada nem induz o resultado');
  const did = lista.find((x) => x.id === DID);
  afirma(!!did && did.codigo === QCOD && lista.indexOf(did) > lista.indexOf(aj) && lista.indexOf(did) > lista.indexOf(ro), 'A2. a proposta didática existe e vem depois das outras');
  afirma(did.ajustes.every((x) => ['O2', 'O3', 'O4', 'O5', 'O6'].includes(x.pergunta) && /^(textoAjuda\.(significado|quandoSim|quandoNao)|ajudaExtra)$/.test(x.campo)), 'A2. só textoAjuda.* e ajudaExtra de O2, O3, O4, O5 e O6');
  afirma(did.ajustes.every((x) => (x.de === null ? lerCampo(fab(x.pergunta), x.campo) == null : lerCampo(fab(x.pergunta), x.campo) === x.de)), 'A2. todo "de" é o texto de fábrica; os campos criados não existem de fábrica');
  afirma(did.ajustes.every((x) => !/GECON|PREVI|autosservi/i.test(x.para || '')), 'A2. nenhum texto cita a área homologada nem fala de autosserviço');
  const naoO5 = did.ajustes.find((x) => x.pergunta === 'O5' && x.campo === 'textoAjuda.quandoNao').para;
  afirma(/definir regras ou parametrizações/.test(naoO5) && /Exemplo ilustrativo: definir roteiros contábeis e parametrizações para um produto novo/.test(naoO5) && /não significa, por si só, ser responsável pelo resultado próprio/.test(naoO5), 'A2. O5 (quando NÃO): a explicação geral e o exemplo dos roteiros contábeis da homologação, marcado como ilustrativo');
  const extraO5 = did.ajustes.find((x) => x.pergunta === 'O5' && x.campo === 'ajudaExtra').para;
  afirma(/Atender clientes internos não significa, por si só, possuir um Produto\/Serviço dedicado/.test(extraO5) && /Chamar uma atividade de "serviço" também não basta/.test(extraO5), 'A2. O5: cliente interno e o nome "serviço", sozinhos, não bastam');
  const browser = await chromium.launch();
  try {
    await tela(browser, { width: 1280, height: 900 }, 'Computador (1280 px)');
    await tela(browser, { width: 375, height: 800 }, 'Celular (375 px)');
  } finally { await browser.close(); }
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
