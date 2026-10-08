/* Preservação histórica do questionário P1–P16: texto novo não reescreve o passado.
 *
 * POR QUE ESTE TESTE EXISTE
 * Antes de publicar uma versão nova do questionário (os 29 textos aprovados),
 * o diagnóstico (diagnostico-versionamento-questionario.js) comprovou 5 riscos:
 *   1. avaliação LEGADA (sem versão nem cópia da pergunta) mostrava o texto
 *      VIGENTE ao lado da resposta antiga — ficha, PDF e Excel;
 *   2. a reavaliação mostrava a pergunta nova com a resposta herdada já marcada;
 *   3. e concluía assim, sem confirmação;
 *   4. "Reprocessar" reescrevia a cópia da resposta herdada com o texto e a
 *      versão novos;
 *   5. "Reprocessar" criava, numa legada, uma cópia com texto nunca visto.
 * Este teste prova que os cinco estão fechados, sem mudar perguntas, respostas,
 * regras ou resultados.
 *
 * O QUESTIONÁRIO DO TESTE é sintético (não são os 29 textos): v1 = texto de
 * fábrica; v2 = v1 com o TEXTO de P15 trocado e só a AJUDA de P8 trocada.
 * Hermético: banco falso em persistenciaReal, sem rede, sem segredo.
 * Desktop e celular (375 px). */
const { chromium } = require('playwright');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const SRC_AVP = fs.readFileSync(path.join(RAIZ, 'avaliacao-produto.js'), 'utf8');
const MOTOR_VERSION = /var MOTOR_VERSION = '([^']+)'/.exec(SRC_AVP)[1];
const XLSX = require(path.join(RAIZ, 'xlsx.mini.min.js'));
const EVIDENCIA = require('./dados/textos-pre-parametrizacao.json');
const EMAIL = 'teste@previ.com.br';
const KEY = EMAIL.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const copia = (x) => JSON.parse(JSON.stringify(x));

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (cond || detalhe === undefined ? '' : ' — ' + detalhe)); if (!cond) falhas++; }

const ORDEM = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao',
  'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
const CODIGO = {}; ORDEM.forEach((id, i) => { CODIGO[id] = 'P' + (i + 1); });

/* ---- questionário: módulo real, com config injetada */
function carregarQuestionarios(config) {
  const ctx = { console: { log() {}, warn() {}, error() {} } };
  ctx.window = ctx;
  const ref = function r(p) { return { on(ev, cb) { if (config) { let v = { 'questionarios-config': config }; p.split('/').forEach((k) => { v = v == null ? v : v[k]; }); cb({ val: () => copia(v == null ? null : v) }); } }, once() {}, off() {}, child: (c) => r(p + '/' + c) }; };
  ctx.firebase = { database: () => ({ ref }) };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'questionarios-config.js'), 'utf8'), ctx);
  return ctx.window.faQuestionarios;
}
const V1 = copia(carregarQuestionarios(null).PADRAO.CLASSIFICACAO_ARQUITETURAL.perguntas);
const V2 = copia(V1);
const P15_V1 = V1.find((p) => p.codigoEstavel === 'P15').texto;
const P15_V2 = 'TEXTO NOVO DE TESTE: o item é principalmente um elemento estrutural de outro produto?';
const P8_AJUDA_V2 = 'AJUDA NOVA DE TESTE para P8 (a pergunta não muda).';
V2.find((p) => p.codigoEstavel === 'P15').texto = P15_V2;
V2.find((p) => p.codigoEstavel === 'P8').textoAjuda.significado = P8_AJUDA_V2;
const CONFIG_Q = { CLASSIFICACAO_ARQUITETURAL: { versaoPublicada: 2, versoes: {
  2: { perguntas: V2, publicadoEm: '2026-10-08T00:00:00.000Z', publicadoPor: 'teste' } } } }; /* a v1 é o texto de fábrica, como no site */

/* ---- avaliações: P1 e P15 SIM, o resto NÃO */
const VALOR = (id) => (id === 'componente' || id === 'necessidade' ? 'sim' : 'nao');
function item(nome, itemId, comVersao) {
  const respostas = {};
  ORDEM.forEach((id) => {
    const v = VALOR(id), def = V1.find((p) => p.codigoEstavel === CODIGO[id]);
    respostas[id] = comVersao
      ? { valor: v, justificativaAuto: v === 'sim' ? def.justSim : def.justNao, observacao: id === 'componente' ? 'obs da época' : '', codigoPergunta: CODIGO[id],
          textoPerguntaNaEpoca: def.texto, tituloNaEpoca: def.titulo || null, questionnaireContentVersion: 1 }
      : { valor: v, justificativaAuto: 'interpretação registrada na época', observacao: '' };
  });
  const it = {
    nome, descricao: '', publico: '', necessidade: '', observacoesGerais: '', status: 'concluido', respostas,
    resultadoAutomatico: 'nao-produto', decisaoFinal: 'a-validar', decisaoManual: false, decisaoConfirmada: false,
    camadaSugerida: { id: 'a-validar', label: 'A validar', motivos: [], conflito: null, incoerencia: false, especializacao: null, papelEstrutural: null, relacao: null },
    justificativaAutomatica: 'registrada na época', criteriosEssenciaisFalhos: [], exclusoesConflitantes: null, criteriosAtendidos: 1,
    motorVersion: MOTOR_VERSION, motorVersionArquitetura: 1,
    criadoEm: '2026-09-20T10:00:00.000Z', atualizadoEm: '2026-09-20T10:00:00.000Z',
    responsavel: { name: 'Teste', email: EMAIL }, itemId, versao: 1, versaoAnteriorKey: null, excluido: false
  };
  if (comVersao) it.questionnaireContentVersion = 1;
  return it;
}
const ITEM_V1 = item('Motor de cálculo do benefício', 'itemv1', true);
const ITEM_LEGADO = item('Item legado sem versão', 'legado', false);

/* ---- função real do "Reprocessar" */
function extrairFuncao(src, nome) {
  const ini = src.indexOf('function ' + nome + '(');
  let i = src.indexOf('{', ini), nivel = 0;
  for (; i < src.length; i++) { if (src[i] === '{') nivel++; else if (src[i] === '}' && --nivel === 0) break; }
  return src.slice(ini, i + 1);
}
function reprocessar(respostas, versao) {
  const Q = carregarQuestionarios(CONFIG_Q);
  Q.onMudanca('CLASSIFICACAO_ARQUITETURAL', function () {});
  const ctx = { Q, ID: CODIGO, resultado: null, entrada: copia(respostas), versao };
  vm.createContext(ctx);
  vm.runInContext('function definicaoPorId(id) { return ID[id] ? { id: id, codigoEstavel: ID[id] } : null; }\n' +
    'function conteudoDe(def, v) { return Q.conteudoPergunta("CLASSIFICACAO_ARQUITETURAL", def.codigoEstavel, v); }\n' +
    extrairFuncao(SRC_AVP, 'recalcularInterpretacoesRespostas') + '\nresultado = recalcularInterpretacoesRespostas(entrada, versao);', ctx);
  return ctx.resultado;
}

console.log('\n-- 15. reconstrução das legadas só onde há prova --');
{
  const listaCodigo = (nome) => Object.keys(vm.runInNewContext('(' + new RegExp('var ' + nome + ' = (\\{[^}]*\\})').exec(SRC_AVP)[1] + ')'));
  const provadosTexto = ORDEM.filter((id) => { const v1 = V1.find((p) => p.codigoEstavel === CODIGO[id]); const em = EVIDENCIA.commits.filter((c) => c.perguntas[id]); return em.length && em.every((c) => c.perguntas[id].texto === v1.texto); }).map((id) => CODIGO[id]);
  const provadosTitulo = ORDEM.filter((id) => { const v1 = V1.find((p) => p.codigoEstavel === CODIGO[id]); const em = EVIDENCIA.commits.filter((c) => c.perguntas[id]); return em.length && em.every((c) => (c.perguntas[id].titulo || null) === (v1.titulo || null)); }).map((id) => CODIGO[id]);
  afirma(EVIDENCIA.commits.length === 24 && EVIDENCIA.parametrizacao.commit === 'c3a9de3', 'a evidência cobre as 24 versões do código anteriores à parametrização (c3a9de3)', EVIDENCIA.commits.length);
  afirma(JSON.stringify(listaCodigo('LEGADO_TEXTO_COMPROVADO').sort()) === JSON.stringify(provadosTexto.sort()), 'a lista de textos legados reconstruíveis no código é exatamente a provada pela evidência', listaCodigo('LEGADO_TEXTO_COMPROVADO').join(',') + ' × ' + provadosTexto.join(','));
  afirma(JSON.stringify(listaCodigo('LEGADO_TITULO_COMPROVADO').sort()) === JSON.stringify(provadosTitulo.sort()), 'a lista de títulos legados reconstruíveis é exatamente a provada (P9–P16 não tinham título)', listaCodigo('LEGADO_TITULO_COMPROVADO').join(',') + ' × ' + provadosTitulo.join(','));
}

console.log('\n-- 12, 13, 14. Reprocessar não reescreve o que a pessoa respondeu --');
{
  /* v2 de uma reavaliação: P15 herdada (v1) e P1 clicada de novo (v2) */
  const herdadas = copia(ITEM_V1.respostas);
  herdadas.necessidade = Object.assign({}, herdadas.necessidade, { textoPerguntaNaEpoca: V2[0].texto, questionnaireContentVersion: 2 });
  const rep = reprocessar(herdadas, 2);
  afirma(rep.componente.textoPerguntaNaEpoca === P15_V1, '12. a resposta herdada continua com o texto da pergunta que a pessoa viu (v1)', rep.componente.textoPerguntaNaEpoca);
  afirma(rep.componente.questionnaireContentVersion === 1, '13. e com a versão da resposta (1), não a da avaliação (2)', rep.componente.questionnaireContentVersion);
  afirma(rep.componente.justificativaAuto === ITEM_V1.respostas.componente.justificativaAuto && rep.componente.observacao === 'obs da época' && rep.componente.valor === 'sim',
    'valor, observação e interpretação da resposta herdada não mudam');
  afirma(rep.necessidade.questionnaireContentVersion === 2, 'a resposta dada na v2 continua na v2');
  const repLeg = reprocessar(ITEM_LEGADO.respostas, undefined);
  afirma(ORDEM.every((id) => repLeg[id].textoPerguntaNaEpoca === null && repLeg[id].questionnaireContentVersion === null),
    '14. reprocessar a legada não cria cópia de pergunta nem versão (nada que a pessoa não tenha visto)');
  afirma(ORDEM.every((id) => repLeg[id].justificativaAuto === 'interpretação registrada na época' && repLeg[id].valor === VALOR(id)),
    'a legada mantém as respostas e a interpretação registradas na época');
  afirma(ORDEM.every((id) => !Object.values(repLeg[id]).some((v) => v === undefined)), 'nenhum campo undefined (o Firebase recusaria)');
}

/* ---- navegador */
async function abrir(browser, viewport, srcAvp) {
  const admins = {}; admins[KEY] = { email: EMAIL };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {},
    'turmas-checkin': {}, 'turmas-espera': {}, 'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {},
    eventos: {}, 'turmas-publico': {}, 'eventos-publico': {}, 'avaliacoes-produto': { itemv1: copia(ITEM_V1), legado: copia(ITEM_LEGADO) },
    'avaliacoes-squad': {}, 'motor-squad-config': {}, 'motor-squad-auditoria': {}, 'motor-arquitetura-auditoria': {},
    'questionarios-config': copia(CONFIG_Q) };
  const cfg = { db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await ctx.addInitScript(`
    window.__pdfs = [];
    new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) {
      if (n.nodeType !== 1 || n.parentNode !== document.body) return;
      var doc = n.classList && n.classList.contains('pdf-doc') ? n : (n.querySelector && n.querySelector('.pdf-doc'));
      if (doc) window.__pdfs.push(doc.innerText);
    }); }); }).observe(document, { childList: true, subtree: true });`);
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  if (srcAvp) await page.route('**/forca-agil/avaliacao-produto.js*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: srcAvp }));
  await page.goto(BASE + '/index.html#avaliacoes', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
function diferencas(a, b, prefixo) {
  prefixo = prefixo || '';
  if (JSON.stringify(a) === JSON.stringify(b)) return '';
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return prefixo + ': ' + JSON.stringify(a) + ' → ' + JSON.stringify(b);
  return Array.from(new Set(Object.keys(a).concat(Object.keys(b)))).map((k) => diferencas(a[k], b[k], prefixo + '.' + k)).filter(Boolean).join(' | ');
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const textoPergunta15NaFicha = (page) => page.evaluate(() => {
  const q = Array.from(document.querySelectorAll('.avp-reasoning-q')).find((e) => /^15\./.test(e.innerText.trim()));
  return q ? q.innerText : null;
});
async function abrirFicha(page, key) {
  await page.waitForSelector('.avp-act-ver[data-key="' + key + '"]');
  await page.click('.avp-act-ver[data-key="' + key + '"]');
  await page.waitForSelector('.avp-reasoning-q');
}
async function gerarPdf(page) {
  await page.evaluate(() => { window.__pdfs = []; });
  /* O efeito que importa é o texto do PDF (window.__pdfs), não o arquivo baixado. */
  await page.click('#avpGerarPdfBtn');
  await esperarCondicao(page, () => window.__pdfs.length > 0, null, { limite: 30000, descricao: 'PDF gerado' });
  return page.evaluate(() => Array.from(new Set(window.__pdfs)).join('\n'));
}
async function lerExcelRespostas(page) {
  await page.click('#avpExportarBtn');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#avpExportarExcelTodas')]);
  const arq = path.join(os.tmpdir(), 'avp-versionamento-' + Date.now() + '.xlsx');
  await dl.saveAs(arq);
  const wb = XLSX.read(fs.readFileSync(arq), { type: 'buffer' });
  fs.unlinkSync(arq);
  const nome = wb.SheetNames.find((n) => { const l = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 }); return l[0] && l[0].includes('Origem do texto da pergunta'); });
  const linhas = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1 });
  const cab = linhas[0];
  return linhas.slice(1).map((l) => { const o = {}; cab.forEach((c, i) => { o[c] = l[i]; }); return o; });
}

(async () => {
  const browser = await chromium.launch();
  for (const [rotulo, viewport] of [['desktop', { width: 1280, height: 900 }], ['celular', { width: 375, height: 800 }]]) {
    console.log('\n== ' + rotulo + ' ==');
    const { ctx, page, erros } = await abrir(browser, viewport);
    const inicio = await banco(page); /* como o banco (persistência real) guardou as avaliações — sem os campos nulos */

    console.log('-- 1, 2, 3. ficha histórica --');
    await abrirFicha(page, 'itemv1');
    const fV1 = await textoPergunta15NaFicha(page);
    afirma(fV1 && fV1.includes(P15_V1) && !fV1.includes(P15_V2), '1/3. avaliação com cópia mostra a P15 que a pessoa respondeu, com a v2 publicada', fV1);
    afirma(!(await page.locator('.avp-nota-texto-historico').count()), 'sem nota de texto reconstruído (tudo veio do registro da época)');
    if (rotulo === 'desktop') {
      const pdf = await gerarPdf(page);
      afirma(pdf.includes(P15_V1) && !pdf.includes(P15_V2) && /Versão do questionário: 1/.test(pdf), '4. o PDF histórico mostra a P15 antiga e "Versão do questionário: 1"');
    }
    await page.click('#avpVoltarListaResultado');

    console.log('-- 1 (legada). ficha de avaliação sem versão nem cópia --');
    await abrirFicha(page, 'legado');
    const fLeg = await textoPergunta15NaFicha(page);
    afirma(fLeg && fLeg.includes(P15_V1) && !fLeg.includes(P15_V2), 'a legada mostra o texto da v1 (comprovado), nunca o vigente', fLeg);
    const nota = await page.locator('.avp-nota-texto-historico').innerText().catch(() => '');
    afirma(/reconstruído a partir da primeira versão disponível/.test(nota), 'e diz que o texto foi reconstruído (não finge que havia cópia)', nota);
    if (rotulo === 'desktop') {
      const pdf = await gerarPdf(page);
      afirma(pdf.includes(P15_V1) && !pdf.includes(P15_V2) && /reconstruído a partir da primeira versão/.test(pdf), 'o PDF da legada também (texto da v1 + nota)');
    }
    await page.click('#avpVoltarListaResultado');

    if (rotulo === 'desktop') {
      console.log('-- 5. Excel --');
      const linhas = await lerExcelRespostas(page);
      const l15 = (key) => linhas.find((l) => l['ID da avaliação'] === key && Number(l['Número da pergunta']) === 15);
      afirma(l15('itemv1') && l15('itemv1').Pergunta === P15_V1 && l15('itemv1')['Origem do texto da pergunta'] === 'Registrado na resposta', '5. Excel: P15 antiga, origem "Registrado na resposta"');
      afirma(l15('legado') && l15('legado').Pergunta === P15_V1 && l15('legado')['Origem do texto da pergunta'] === 'Reconstruído da primeira versão', 'Excel da legada: texto da v1, origem "Reconstruído da primeira versão"');
      const l9 = linhas.find((l) => l['ID da avaliação'] === 'legado' && Number(l['Número da pergunta']) === 9);
      afirma(l9 && l9.Pergunta === V1.find((p) => p.codigoEstavel === 'P9').texto, 'P9 legada aparece pelo texto inteiro, sem o título que só passou a existir depois');
    }

    console.log('-- 6–11. reavaliação --');
    await abrirFicha(page, 'itemv1');
    await page.click('#avpReavaliarBtn');
    await page.waitForSelector('#avpQuestion-componente');
    const q = (id) => page.evaluate((id) => { const el = document.getElementById('avpQuestion-' + id);
      return { texto: el.querySelector('.avp-question-text').innerText, ativo: !!el.querySelector('.avp-choice-btn.active'),
        pergunta: !!el.querySelector('.avp-herdada--pergunta'), ajuda: !!el.querySelector('.avp-herdada--ajuda'), tudo: el.innerText }; }, id);
    const q15 = await q('componente'), q8 = await q('gestao'), q1 = await q('necessidade');
    afirma(q15.texto === P15_V2 && !q15.ativo && q15.pergunta && /SIM/.test(q15.tudo) && q15.tudo.includes(P15_V1),
      '9/10. P15 mudou: a pergunta nova aparece sem botão marcado e a resposta antiga só como referência (com o texto antigo)', JSON.stringify(q15));
    afirma(q8.ativo && q8.ajuda && !q8.pergunta, '11. P8 (só a ajuda mudou): resposta continua marcada, com aviso discreto', JSON.stringify(q8));
    afirma(q1.ativo && !q1.ajuda && !q1.pergunta, '8. P1 (nada mudou): resposta herdada continua, sem aviso', JSON.stringify(q1));
    afirma(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'avisos cabem na tela (sem rolagem lateral)');

    await page.click('#avpConcluirBtn');
    await esperarCondicao(page, () => !!document.querySelector('#avpQuestion-componente.avp-question--pendente'), null, { limite: 5000, descricao: 'P15 marcada como pendente' });
    let dep = await banco(page);
    afirma(!Object.values(dep['avaliacoes-produto']).some((i) => i.versaoAnteriorKey === 'itemv1'), '9. não conclui sem responder de novo a P15', Object.keys(dep['avaliacoes-produto']).join(','));
    afirma(await page.locator('#avpQuestion-componente.avp-question--pendente').count() === 1, 'e aponta a P15 como pendente');

    await page.locator('#avpQuestion-componente .avp-choice-btn--sim').click();
    afirma(!(await q('componente')).pergunta, 'depois do clique o aviso some');
    await page.click('#avpConcluirBtn');
    await page.waitForFunction(() => Object.values(window.__CFG.__dbReal['avaliacoes-produto']).some((i) => i.versaoAnteriorKey === 'itemv1' && i.status === 'concluido'), null, { timeout: 15000 });
    dep = await banco(page);
    const v2 = Object.values(dep['avaliacoes-produto']).find((i) => i.versaoAnteriorKey === 'itemv1');
    afirma(v2 && v2.versao === 2 && v2.questionnaireContentVersion === 2, '6. a reavaliação cria uma avaliação nova, na versão 2 do questionário');
    afirma(v2.respostas.componente.questionnaireContentVersion === 2 && v2.respostas.componente.textoPerguntaNaEpoca === P15_V2, '10. a P15 da v2 é resposta à pergunta nova (confirmada)');
    afirma(v2.respostas.gestao.questionnaireContentVersion === 1, 'a P8 herdada sem novo clique continua registrada como resposta da v1');
    afirma(JSON.stringify(dep['avaliacoes-produto'].itemv1) === JSON.stringify(inicio['avaliacoes-produto'].itemv1), '2/7. a avaliação anterior continua byte a byte igual ao que estava no banco',
      diferencas(inicio['avaliacoes-produto'].itemv1, dep['avaliacoes-produto'].itemv1));
    afirma(JSON.stringify(dep['avaliacoes-produto'].legado) === JSON.stringify(inicio['avaliacoes-produto'].legado), 'a legada também (abrir, gerar PDF e Excel não gravam nada)',
      diferencas(inicio['avaliacoes-produto'].legado, dep['avaliacoes-produto'].legado));
    afirma(JSON.stringify(dep['questionarios-config']) === JSON.stringify(CONFIG_Q), 'o questionário não foi alterado');
    afirma(JSON.stringify(dep['avaliacoes-squad'] || {}) === '{}', '18. nada da Adequação à Squad foi tocado');
    /* 16/17: a classificação da v2 é a do motor vigente para as mesmas respostas (P1 e P15 SIM) */
    afirma(v2.camadaSugerida && v2.camadaSugerida.id === 'componente', '16/17. a classificação da v2 é a do motor atual para as mesmas respostas (Componente)', v2.camadaSugerida && v2.camadaSugerida.id);
    afirma(erros.length === 0, 'sem erro de página', erros.join(' | '));
    await ctx.close();
  }

  console.log('\n== 15. pergunta SEM prova histórica: nada é inventado ==');
  {
    const semProva = SRC_AVP.replace(/P15: true, P16: true \};\n  var LEGADO_TITULO_COMPROVADO/, 'P16: true };\n  var LEGADO_TITULO_COMPROVADO');
    afirma(semProva !== SRC_AVP, '(variante do código sem P15 na lista de textos comprovados)');
    const { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, semProva);
    await abrirFicha(page, 'legado');
    const f = await textoPergunta15NaFicha(page);
    afirma(f && /não pôde ser reconstruído com segurança/.test(f) && !f.includes(P15_V1) && !f.includes(P15_V2), 'a P15 legada sem prova não mostra nem o texto antigo nem o vigente', f);
    const nota = await page.locator('.avp-nota-texto-historico').innerText().catch(() => '');
    afirma(/não pôde ser reconstruído com segurança/.test(nota), 'e a nota diz isso', nota);
    afirma(erros.length === 0, 'sem erro de página', erros.join(' | '));
    await ctx.close();
  }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
