/* Diagnóstico do versionamento do questionário P1–P16 — o que acontece com as
 * avaliações antigas se a versão nova (os 29 textos aprovados) for publicada.
 *
 * SÓ DIAGNÓSTICO. Não é teste da suíte de propósito: ele registra o
 * comportamento ATUAL, inclusive os riscos, e não deve travá-lo. Nada é
 * gravado fora do banco falso do navegador.
 *
 * Monta, no banco falso (persistenciaReal), o questionário com duas versões:
 *   v1 = texto de fábrica (questionarios-config.js);
 *   v2 = v1 + os 29 ajustes de proposta-textos-motores.js.
 * e duas avaliações: uma concluída na v1, com snapshot por resposta, e uma
 * legada (sem questionnaireContentVersion e sem snapshot). Depois:
 *   1. abre a ficha das duas e lê o texto de P15 mostrado;
 *   2. reavalia a da v1 e lê a tela do checklist (texto de P15, resposta herdada, aviso);
 *   3. conclui a reavaliação sem tocar em nada e lê o que foi gravado;
 *   4. roda a função REAL recalcularInterpretacoesRespostas (a do "Reprocessar"),
 *      extraída de avaliacao-produto.js, sobre a v2 e sobre a legada.
 *
 * Uso: com a raiz servida em 127.0.0.1:8811,
 *   node .github/scripts/diagnostico-versionamento-questionario.js */
const { chromium } = require('playwright');
const { esperarSessaoAssentada } = require('./esperas');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const SRC_AVP = fs.readFileSync(path.join(RAIZ, 'avaliacao-produto.js'), 'utf8');
const MOTOR_VERSION = /var MOTOR_VERSION = '([^']+)'/.exec(SRC_AVP)[1];
const PROPOSTA = require('./proposta-textos-motores.js');
const EMAIL = 'teste@previ.com.br';
const KEY = EMAIL.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const copia = (x) => JSON.parse(JSON.stringify(x));

const ORDEM = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao',
  'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
const CODIGO = {}; ORDEM.forEach((id, i) => { CODIGO[id] = 'P' + (i + 1); });

/* ---- questionário v1 (fábrica) e v2 (fábrica + 29 ajustes) */
function carregarQuestionarios(config) {
  const ctx = { console: { log() {}, warn() {}, error() {} } };
  ctx.window = ctx;
  const ref = function r(p) { return { on(ev, cb) { if (config) { const partes = p.split('/'); let v = { 'questionarios-config': config }; partes.forEach((k) => { v = v == null ? v : v[k]; }); cb({ val: () => copia(v == null ? null : v) }); } }, once() {}, off() {}, child: (c) => r(p + '/' + c) }; };
  ctx.firebase = { database: () => ({ ref }) };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'questionarios-config.js'), 'utf8'), ctx);
  return ctx.window.faQuestionarios;
}
const Q0 = carregarQuestionarios(null);
const V1 = copia(Q0.PADRAO.CLASSIFICACAO_ARQUITETURAL.perguntas);
const V2 = copia(V1);
PROPOSTA.filter((c) => c.codigo === 'CLASSIFICACAO_ARQUITETURAL').forEach((c) => c.ajustes.forEach((aj) => {
  const p = V2.find((x) => x.codigoEstavel === aj.pergunta);
  const ks = aj.campo.split('.'); const ult = ks.pop();
  const alvo = ks.reduce((o, k) => (o[k] = o[k] || {}), p);
  if (aj.para === '') delete alvo[ult]; else alvo[ult] = aj.para;
}));
const CONFIG_Q = { CLASSIFICACAO_ARQUITETURAL: { versaoPublicada: 2, versoes: {
  1: { perguntas: V1, publicadoEm: '2026-09-01T00:00:00.000Z', publicadoPor: 'fabrica' },
  2: { perguntas: V2, publicadoEm: '2026-10-08T00:00:00.000Z', publicadoPor: 'teste' } } } };
const P15_V1 = V1.find((p) => p.codigoEstavel === 'P15').texto;
const P15_V2 = V2.find((p) => p.codigoEstavel === 'P15').texto;

/* ---- avaliações */
function item(nome, itemId, comVersao) {
  const respostas = {};
  ORDEM.forEach((id) => {
    const v = id === 'componente' || id === 'necessidade' ? 'sim' : 'nao';
    const def = V1.find((p) => p.codigoEstavel === CODIGO[id]);
    respostas[id] = comVersao
      ? { valor: v, justificativaAuto: v === 'sim' ? def.justSim : def.justNao, observacao: '', codigoPergunta: CODIGO[id],
          textoPerguntaNaEpoca: def.texto, tituloNaEpoca: def.titulo || null, questionnaireContentVersion: 1 }
      : { valor: v, justificativaAuto: v === 'sim' ? def.justSim : def.justNao, observacao: '' };
  });
  const it = {
    nome, descricao: '', publico: '', necessidade: '', observacoesGerais: '', status: 'concluido', respostas,
    resultadoAutomatico: 'nao-produto', decisaoFinal: 'componente', decisaoManual: false, decisaoConfirmada: false,
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

/* ---- função real do "Reprocessar", extraída do código do site */
function extrairFuncao(src, nome) {
  const ini = src.indexOf('function ' + nome + '(');
  let i = src.indexOf('{', ini), nivel = 0;
  for (; i < src.length; i++) { if (src[i] === '{') nivel++; else if (src[i] === '}' && --nivel === 0) break; }
  return src.slice(ini, i + 1);
}
function recalcular(respostas, versao) {
  const Q = carregarQuestionarios(CONFIG_Q);
  Q.onMudanca('CLASSIFICACAO_ARQUITETURAL', function () {}); /* como no site: liga a leitura das versões publicadas */
  if (Q.versaoAtual('CLASSIFICACAO_ARQUITETURAL') !== 2) throw new Error('o questionário falso não carregou a versão 2');
  const ctx = { Q, ID: CODIGO, resultado: null, entrada: copia(respostas), versao };
  vm.createContext(ctx);
  vm.runInContext('function definicaoPorId(id) { return ID[id] ? { id: id, codigoEstavel: ID[id] } : null; }\n' +
    'function conteudoDe(def, v) { return Q.conteudoPergunta("CLASSIFICACAO_ARQUITETURAL", def.codigoEstavel, v); }\n' +
    extrairFuncao(SRC_AVP, 'recalcularInterpretacoesRespostas') + '\nresultado = recalcularInterpretacoesRespostas(entrada, versao);', ctx);
  return ctx.resultado;
}

const achados = [];
function registra(ok, msg, detalhe) { achados.push({ ok, msg, detalhe }); console.log((ok ? '  ok     ' : '  RISCO  ') + msg + (detalhe ? ' — ' + detalhe : '')); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const admins = {}; admins[KEY] = { email: EMAIL };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {},
    'turmas-checkin': {}, 'turmas-espera': {}, 'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {},
    eventos: {}, 'turmas-publico': {}, 'eventos-publico': {}, 'avaliacoes-produto': { itemv1: ITEM_V1, legado: ITEM_LEGADO },
    'avaliacoes-squad': {}, 'motor-squad-config': {}, 'motor-squad-auditoria': {}, 'motor-arquitetura-auditoria': {},
    'questionarios-config': CONFIG_Q };
  const cfg = { db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[PAGEERROR]', String(e)));
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#avaliacoes', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  const banco = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
  const textoP15NaFicha = () => page.evaluate(() => {
    const q = Array.from(document.querySelectorAll('.avp-reasoning-q')).find((e) => /^15\./.test(e.innerText.trim()));
    return q ? q.innerText : null;
  });

  console.log('\n-- 1. ficha de uma avaliação concluída na versão 1 --');
  await page.waitForSelector('.avp-act-ver[data-key="itemv1"]');
  await page.click('.avp-act-ver[data-key="itemv1"]');
  await page.waitForSelector('.avp-reasoning-q');
  const fichaV1 = await textoP15NaFicha();
  registra(fichaV1 && fichaV1.includes(P15_V1) && !fichaV1.includes(P15_V2), 'a ficha mostra a P15 que a pessoa respondeu (v1), mesmo com a v2 publicada', fichaV1);
  await page.click('#avpVoltarListaResultado');

  console.log('\n-- 2. ficha de uma avaliação legada (sem versão e sem snapshot) --');
  await page.click('.avp-act-ver[data-key="legado"]');
  await page.waitForSelector('.avp-reasoning-q');
  const fichaLeg = await textoP15NaFicha();
  registra(fichaLeg && !fichaLeg.includes(P15_V2), 'a ficha da avaliação legada não mostra a P15 nova', fichaLeg);
  await page.click('#avpVoltarListaResultado');

  console.log('\n-- 3. reavaliar a avaliação da versão 1 --');
  await page.click('.avp-act-ver[data-key="itemv1"]');
  await page.waitForSelector('#avpReavaliarBtn');
  await page.click('#avpReavaliarBtn');
  await page.waitForSelector('#avpQuestion-componente');
  const tela = await page.evaluate(() => {
    const q = document.getElementById('avpQuestion-componente');
    return { texto: q.querySelector('.avp-question-text').innerText, simAtivo: !!q.querySelector('.avp-choice-btn--sim.active'),
      aviso: /versão anterior|revise e confirme/i.test(q.innerText) };
  });
  registra(!(tela.texto.includes(P15_V2) && tela.simAtivo && !tela.aviso),
    'na reavaliação, a resposta herdada não aparece como resposta à P15 nova sem aviso',
    'pergunta mostrada: "' + tela.texto + '" · SIM já marcado: ' + tela.simAtivo + ' · aviso de resposta herdada: ' + tela.aviso);

  console.log('\n-- 4. concluir a reavaliação sem tocar em nada --');
  await page.click('#avpConcluirBtn');
  await page.waitForFunction(() => Object.values(window.__CFG.__dbReal['avaliacoes-produto']).some((i) => i.versaoAnteriorKey === 'itemv1' && i.status === 'concluido'), null, { timeout: 15000 });
  const dep = await banco();
  const v2 = Object.values(dep['avaliacoes-produto']).find((i) => i.versaoAnteriorKey === 'itemv1');
  const v1 = dep['avaliacoes-produto'].itemv1;
  registra(JSON.stringify(v1.respostas) === JSON.stringify(ITEM_V1.respostas) && v1.questionnaireContentVersion === 1, 'a v1 continua intacta (respostas, snapshots e versão 1)');
  registra(v2.questionnaireContentVersion === 2, 'a v2 registra a versão 2 do questionário', 'v2.questionnaireContentVersion = ' + v2.questionnaireContentVersion);
  const r15 = v2.respostas.componente;
  registra(r15.questionnaireContentVersion === 1 && r15.textoPerguntaNaEpoca === P15_V1,
    'a resposta herdada de P15 guarda que foi dada à pergunta da v1', 'resposta: versão ' + r15.questionnaireContentVersion + ', texto "' + r15.textoPerguntaNaEpoca + '"');
  registra(!(r15.questionnaireContentVersion === 1 && v2.questionnaireContentVersion === 2 && v2.status === 'concluido'),
    'uma avaliação da v2 não é concluída com resposta de P15 dada à pergunta da v1, sem confirmação',
    'concluída com P15 = ' + r15.valor + ' respondida na v1');

  console.log('\n-- 5. "Reprocessar" (função real) sobre a v2 e sobre a legada --');
  const rep2 = recalcular(v2.respostas, v2.questionnaireContentVersion).componente;
  registra(rep2.textoPerguntaNaEpoca === P15_V1 && rep2.questionnaireContentVersion === 1,
    'reprocessar a v2 preserva o snapshot da resposta herdada (pergunta da v1)',
    'depois de reprocessar: versão ' + rep2.questionnaireContentVersion + ', texto "' + rep2.textoPerguntaNaEpoca + '"');
  const repLeg = recalcular(ITEM_LEGADO.respostas, ITEM_LEGADO.questionnaireContentVersion).componente;
  registra(!repLeg.textoPerguntaNaEpoca || repLeg.textoPerguntaNaEpoca !== P15_V2,
    'reprocessar a legada não cria um snapshot com o texto novo que a pessoa nunca viu',
    'snapshot criado: "' + repLeg.textoPerguntaNaEpoca + '", versão ' + repLeg.questionnaireContentVersion);

  await browser.close();
  const riscos = achados.filter((a) => !a.ok);
  console.log('\n' + achados.length + ' verificações · ' + riscos.length + ' risco(s) confirmado(s)');
  fs.writeFileSync(process.argv[2] || '/dev/null', JSON.stringify({ P15_V1, P15_V2, achados }, null, 2));
})().catch((e) => { console.error(e); process.exit(2); });
