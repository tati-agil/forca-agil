/* Interpretações de P5/P15 sem inferência cruzada + decisão manual do item
 * (T1-T8 do pedido "AJUSTAR INTERPRETAÇÕES P5/P15 + REGISTRAR PROGRAMA
 * TRANSVERSAL COMO NATUREZA COMPLEMENTAR"). A natureza complementar em si —
 * hoje independente da decisão, com catálogo configurável, auditoria, PDF,
 * coluna na lista e Excel — é coberta por teste-natureza-complementar.js.
 *
 * POR QUE ESTE TESTE EXISTE
 * Item real: "Programa Mais Previ…" respondido P5 = NÃO, P15 = NÃO (com a
 * justificativa de que o programa não está subordinado a outro
 * Produto/Serviço). O motor acertou (A VALIDAR), mas a tela exibia, em P15,
 * "Embora dependa estruturalmente de outro Produto/Serviço…" — um texto
 * hardcoded que concluía de P5 uma dependência que a pessoa negou em P15 —
 * e a interpretação padrão de P5 = NÃO afirmava "depende estruturalmente de
 * outro Produto/Serviço", que P5 = NÃO não diz. Corrigido por: (1) remover
 * o texto que cruzava P5 com P15; (2) corrigir P5/P15 pelo mecanismo
 * parametrizado (versão NOVA do questionário, nunca motorVersion); (3)
 * registrar "Programa transversal" como informação manual, fora do motor
 * (ver teste-natureza-complementar.js).
 *
 * Banco falso em persistenciaReal (grava/lê como o Firebase de verdade).
 * Hermético: sem rede, sem segredo. Desktop e celular (375 px). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const SRC_AVP = fs.readFileSync(path.join(RAIZ, 'avaliacao-produto.js'), 'utf8');
const SRC_MOTOR = fs.readFileSync(path.join(RAIZ, 'motor-arquitetura.js'), 'utf8');
const MOTOR_VERSION = /var MOTOR_VERSION = '([^']+)'/.exec(SRC_AVP)[1];
const XLSX = require(path.join(RAIZ, 'xlsx.mini.min.js'));
const EMAIL = 'teste@previ.com.br';
const KEY = EMAIL.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

/* P1..P16 na ordem do checklist */
const ORDEM = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao',
  'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
const CODIGO = {}; ORDEM.forEach((id, i) => { CODIGO[id] = 'P' + (i + 1); });
/* Respostas do item real (Mais Previ): P1-P3 SIM, P4-P6 NÃO, P7-P8 SIM, P9-P16 NÃO */
const MAIS_PREVI = { necessidade: 'sim', resultado: 'sim', solucao: 'sim', fronteira: 'nao', autonomia: 'nao', jornada: 'nao', medicao: 'sim', gestao: 'sim' };
const valorMaisPrevi = (id) => MAIS_PREVI[id] || 'nao';

/* Textos ANTERIORES (fábrica) e NOVOS — os mesmos de CORRECOES_EDITORIAIS */
const P5_NAO_ANTIGO = 'NÃO — O item depende estruturalmente de outro Produto/Serviço para existir ou fazer sentido.';
const P5_NAO_NOVO = 'NÃO — O item não demonstra autonomia estrutural suficiente para ser tratado como uma solução principal independente.';
const P5_SIM = 'SIM — O item tem autonomia estrutural: existiria como solução própria mesmo sem outro Produto/Serviço.';
const P15_SIM_ANTIGO = 'SIM — O item apresenta características de componente ou elemento pertencente a outra solução.';
const P15_SIM_NOVO = 'SIM — O item existe de forma estruturalmente associada a outra solução e contribui para que essa solução entregue seu resultado.';
const P15_NAO_ANTIGO = 'NÃO — O item demonstra maior independência em relação a outras soluções.';
const P15_NAO_NOVO = 'NÃO — O item não existe principalmente como suporte estrutural para que outro Produto/Serviço entregue seu resultado.';

function itemMaisPrevi() {
  const respostas = {};
  ORDEM.forEach((id) => {
    const v = valorMaisPrevi(id);
    let auto = v === 'sim' ? 'SIM — padrão.' : 'NÃO — padrão.';
    if (id === 'autonomia') auto = P5_NAO_ANTIGO;      /* snapshot gravado na época */
    if (id === 'componente') auto = P15_NAO_ANTIGO;
    respostas[id] = { valor: v, justificativaAuto: auto, observacao: id === 'componente' ? 'Não está estruturalmente subordinado a outro Produto/Serviço.' : '',
      codigoPergunta: CODIGO[id], textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 };
  });
  return {
    nome: 'Programa Mais Previ de Educação Financeira e Previdenciária', descricao: '', publico: '', necessidade: '', observacoesGerais: '',
    status: 'concluido', respostas: respostas,
    resultadoAutomatico: 'a-validar', decisaoFinal: 'a-validar', decisaoManual: false, decisaoConfirmada: false,
    camadaSugerida: { id: 'a-validar', label: 'A validar', motivos: [], conflito: null, incoerencia: false, especializacao: null, papelEstrutural: null, relacao: null },
    justificativaAutomatica: 'As respostas não reúnem evidência suficiente para indicar com segurança nenhuma das categorias arquiteturais previstas.',
    criteriosEssenciaisFalhos: ['fronteira', 'autonomia'], exclusoesConflitantes: null, criteriosAtendidos: 5,
    motorVersion: MOTOR_VERSION, motorVersionArquitetura: 1, questionnaireContentVersion: 1,
    criadoEm: '2026-09-29T10:00:00.000Z', atualizadoEm: '2026-09-29T10:00:00.000Z',
    responsavel: { name: 'Teste', email: EMAIL }, itemId: 'maisprevi', versao: 1, versaoAnteriorKey: null, excluido: false
  };
}

async function abrirApp(browser, extra, viewport) {
  extra = extra || {};
  const admins = {}; admins[KEY] = { email: EMAIL };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {},
    'turmas-checkin': {}, 'turmas-espera': {}, 'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {},
    eventos: {}, 'turmas-publico': {}, 'eventos-publico': {}, 'avaliacoes-produto': { maisprevi: itemMaisPrevi() }, 'avaliacoes-squad': {},
    'motor-squad-config': {}, 'motor-squad-auditoria': {}, 'motor-arquitetura-auditoria': {} };
  Object.assign(db, extra.db || {});
  const cfg = { db: db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true, delays: extra.delays };
  const ctx = await browser.newContext({ viewport: viewport || { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  /* captura o HTML do PDF no instante em que é montado (o PDF em si é imagem) */
  await ctx.addInitScript(`
    window.__pdfs = [];
    new MutationObserver(function (ms) {
      ms.forEach(function (m) { m.addedNodes.forEach(function (n) {
        if (n.nodeType !== 1 || n.parentNode !== document.body) return; /* só blocos reais do PDF, não as medições */
        var doc = n.classList && n.classList.contains('pdf-doc') ? n : (n.querySelector && n.querySelector('.pdf-doc'));
        if (!doc) return;
        var decisao = doc.querySelector('.pdf-decisao-bloco');
        window.__pdfs.push({ tudo: doc.innerText, decisao: decisao ? decisao.innerText : '' });
      }); });
    }).observe(document, { childList: true, subtree: true });`);
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#avaliacoes', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.body.classList.contains('aguardando-auth'), { timeout: 16000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.waitForTimeout(500);
  return { ctx, page, erros };
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const contar = (page, sel) => page.locator(sel).count();
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function novaAvaliacao(page, nome, valorDe) {
  await page.click('#avpNovoBtn');
  await page.fill('#avpfNome', nome);
  await page.click('#avpIniciarBtn');
  await page.waitForTimeout(150);
  for (const id of ORDEM) await page.locator('#avpQuestion-' + id + ' .avp-choice-btn--' + valorDe(id)).click();
  await page.click('#avpConcluirBtn');
  await page.waitForSelector('.avp-reasoning-list', { timeout: 8000 });
  await page.waitForTimeout(200);
}
/* "Interpretação do sistema" da pergunta (número global 1-16) na tela de resultado */
async function interpretacao(page, codigo) {
  const n = codigo.slice(1);
  return page.locator('.avp-reasoning-item', { has: page.locator('.avp-reasoning-q', { hasText: new RegExp('^' + n + '\\.') }) }).locator('.avp-reasoning-auto').innerText();
}
async function abrirConfig(page) {
  await irAoAdmin(page);
  await page.click('#avpConfigQuestionariosBtn');
  await page.waitForSelector('#avpCorrecao-interpretacoes-p5-p15', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(150);
}
/* "independente" contém "depende": só palavras inteiras de dependência */
const DEPENDENCIA = /\b(depende|dependa|dependem|dependência|dependente|dependendo)\b/i;
const semPrefixo = (t) => t.replace(/^(SIM|NÃO)\s*—\s*/, '');

/* A configuração (questionários, motores, naturezas) agora fica no ADMIN, fora da
   área Avaliação. Estes dois passos levam até lá e de volta. */
async function irAoAdmin(page) {
  await page.evaluate(() => { location.hash = '#admin'; });
  await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelArquitetura"]', { timeout: 8000 });
  await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
  /* o Admin lembra a subtela em que ficou: se não caiu no início, volta até ele */
  await page.waitForSelector('#avpConfigQuestionariosBtn, #avpConfigVoltar, #avpNaturezasVoltar, #avpMotoresVoltarLista, #avpUsuariosVoltar', { timeout: 8000 });
  if (!(await page.locator('#avpConfigQuestionariosBtn').count())) {
    await page.locator('#avpConfigVoltar, #avpNaturezasVoltar, #avpMotoresVoltarLista, #avpUsuariosVoltar').first().click();
  }
  await page.waitForSelector('#avpConfigQuestionariosBtn', { timeout: 8000 });
}
async function voltarParaAvaliacoes(page) {
  await page.evaluate(() => { location.hash = '#avaliacoes'; });
  await page.waitForSelector('#avpNovoBtn', { timeout: 8000 });
  await page.waitForTimeout(200);
}

(async () => {
  const browser = await chromium.launch();

  console.log('== 0. Pré-condição: o motor responde A VALIDAR para as respostas do Mais Previ (o motor não é o problema) ==');
  let keyNovaA = null;
  {
    const { ctx, page, erros } = await abrirApp(browser);
    const camada = await page.evaluate((resp) => {
      const ctxP = {}; Object.keys(resp).forEach((c) => { ctxP[c] = resp[c]; });
      return window.faMotorArquitetura.identificarCamada(ctxP, window.faMotorArquitetura.regrasDaVersao(window.faMotorArquitetura.versaoAtual())).camada;
    }, (() => { const o = {}; ORDEM.forEach((id) => { o[CODIGO[id]] = valorMaisPrevi(id) === 'sim' ? 'SIM' : 'NAO'; }); return o; })());
    afirma(camada === 'a-validar', 'identificarCamada(P1-P3 SIM, P4-P6 NÃO, P7-P8 SIM, P9-P16 NÃO) = ' + camada);
    const motorAntes = await page.evaluate(() => JSON.stringify(window.__CFG.__dbReal['motor-arquitetura-config'] || null));

    console.log('\n== T2/T5 — o texto contraditório some da tela; o snapshot histórico continua como foi gravado ==');
    await page.click('.avp-act-ver[data-key="maisprevi"]');
    await page.waitForSelector('.avp-reasoning-list', { timeout: 5000 });
    const p15Antes = await interpretacao(page, 'P15');
    const p5Antes = await interpretacao(page, 'P5');
    afirma(!/Embora dependa/i.test(p15Antes), 'T2: P15 = NÃO não exibe mais "Embora dependa estruturalmente…": "' + p15Antes.replace(/\s+/g, ' ').slice(0, 110) + '"');
    afirma(p15Antes.includes(semPrefixo(P15_NAO_ANTIGO)), 'T5: P15 do item antigo continua mostrando o texto registrado na época');
    afirma(p5Antes.includes(semPrefixo(P5_NAO_ANTIGO)), 'T5: P5 do item antigo continua mostrando o texto registrado na época (histórico intacto)');
    const itemAntes = (await banco(page))['avaliacoes-produto'].maisprevi;

    console.log('\n== Correção editorial: card na tela de Configuração dos Questionários ==');
    await page.click('#avpVoltarListaResultado').catch(() => {});
    await page.waitForTimeout(200);
    await abrirConfig(page);
    const card = await page.locator('#avpCorrecao-interpretacoes-p5-p15').innerText().catch(() => '');
    afirma(/Correção editorial disponível/.test(card) && /P5/.test(card) && /P15/.test(card), 'card "Correção editorial disponível" lista P5 e P15');
    afirma((card.match(/\(pendente\)/g) || []).length === 3, 'os 3 ajustes (P5 NÃO, P15 SIM, P15 NÃO) aparecem pendentes');
    afirma(/versão 2/.test(card) && /Não altera o motor/.test(card), 'o card avisa que cria a versão 2 e não altera o motor');
    afirma(await contar(page, '#avpCorrecao-interpretacoes-p5-p15 .avp-correcao-aplicar-btn:not([disabled])') === 1, 'botão APLICAR CORREÇÃO habilitado');
    afirma(JSON.stringify((await banco(page))['questionarios-config'] || null) === 'null', 'nada gravado antes de aplicar');

    await page.click('.avp-correcao-aplicar-btn');
    await page.waitForTimeout(150);
    await page.click('.avp-modal-confirm-btn');
    await page.waitForFunction(() => /Correção aplicada/.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
    await page.click('.avp-modal-ok-btn').catch(() => {});
    await page.waitForTimeout(300);
    const dep = await banco(page);
    const cfgQ = dep['questionarios-config'].CLASSIFICACAO_ARQUITETURAL;

    console.log('\n== T4 — só a versão de CONTEÚDO avança; motorVersion e motorVersionArquitetura não mudam ==');
    afirma(cfgQ.versaoPublicada === 2, 'questionnaireContentVersion vigente: 1 → ' + cfgQ.versaoPublicada);
    afirma(JSON.stringify(dep['motor-arquitetura-config'] || null) === motorAntes, 'motor-arquitetura-config intocado (nenhuma versão de regras criada)');
    const itemDep = dep['avaliacoes-produto'].maisprevi;
    afirma(JSON.stringify(itemDep) === JSON.stringify(itemAntes), 'o item antigo (Mais Previ) ficou byte a byte igual no banco — nada reprocessado, nada reescrito');
    afirma(itemDep.motorVersion === MOTOR_VERSION && itemDep.motorVersionArquitetura === 1, 'motorVersion (' + itemDep.motorVersion + ') e motorVersionArquitetura (1) do item inalterados');
    afirma(await contar(page, '.avp-tag-motor--desatualizado') === 0 && await contar(page, '#avpReconciliarBar') === 0, 'lista sem "Motor desatualizado" nem "reconciliar" por causa de uma mudança editorial');

    console.log('\n== A versão nova muda SÓ os 3 textos combinados (nada mais no questionário) ==');
    const v2 = cfgQ.versoes['2'].perguntas;
    const fabrica = await page.evaluate(() => JSON.parse(JSON.stringify(window.faQuestionarios.PADRAO.CLASSIFICACAO_ARQUITETURAL.perguntas)));
    const difs = [];
    fabrica.forEach((pf) => {
      const pn = v2.find((x) => x.codigoEstavel === pf.codigoEstavel);
      ['titulo', 'texto', 'textoAjuda', 'exemplo', 'exemplos', 'ajudaExtra', 'justSim', 'justNao'].forEach((c) => {
        if (JSON.stringify(pf[c] === undefined ? null : pf[c]) !== JSON.stringify(pn[c] === undefined ? null : pn[c])) difs.push(pf.codigoEstavel + '.' + c);
      });
    });
    afirma(difs.sort().join() === 'P15.justNao,P15.justSim,P5.justNao', 'diferenças v1 → v2: ' + difs.join(', '));
    afirma(v2.find((x) => x.codigoEstavel === 'P5').justNao === P5_NAO_NOVO, 'T1: P5 NÃO = "…não demonstra autonomia estrutural suficiente para ser tratado como uma solução principal independente."');
    afirma(!DEPENDENCIA.test(v2.find((x) => x.codigoEstavel === 'P5').justNao), 'T1: P5 NÃO não afirma dependência de outro Produto/Serviço');
    afirma(v2.find((x) => x.codigoEstavel === 'P5').justSim === P5_SIM, 'P5 SIM preservado (já estava correto)');
    afirma(v2.find((x) => x.codigoEstavel === 'P15').justNao === P15_NAO_NOVO, 'T2: P15 NÃO = "…não existe principalmente como suporte estrutural…"');
    afirma(v2.find((x) => x.codigoEstavel === 'P15').justSim === P15_SIM_NOVO, 'T3: P15 SIM = "…estruturalmente associada a outra solução e contribui para que essa solução entregue seu resultado."');
    const aud = Object.values(dep['questionarios-auditoria'].CLASSIFICACAO_ARQUITETURAL);
    afirma(aud.length === 3 && aud.every((a) => a.versaoAnterior === 1 && a.novaVersao === 2 && a.usuario && a.usuario.email === EMAIL && a.dataHora),
      'auditoria: 3 entradas (P5.justNao, P15.justSim, P15.justNao), v1 → v2, com usuário e data');
    const cardDepois = await page.locator('#avpCorrecao-interpretacoes-p5-p15').innerText();
    afirma(/Correção editorial aplicada/.test(cardDepois) && await contar(page, '.avp-correcao-aplicar-btn') === 0, 'card passa a "✓ Correção editorial aplicada", sem botão');
    const idem = await page.evaluate(() => new Promise((ok) => window.faQuestionarios.aplicarCorrecaoEditorial('interpretacoes-p5-p15', null, (err) => ok(err))));
    afirma(idem === 'nada-a-aplicar', 'aplicar de novo não faz nada (idempotente): ' + idem);
    afirma((await banco(page))['questionarios-config'].CLASSIFICACAO_ARQUITETURAL.versaoPublicada === 2, 'e não cria versão 3');

    console.log('\n== T6 (+T1/T2) — avaliação NOVA (P5 NÃO, P15 NÃO) usa a redação nova e continua A VALIDAR ==');
    await voltarParaAvaliacoes(page);
    await page.waitForTimeout(200);
    await novaAvaliacao(page, 'Novo — P5 NÃO / P15 NÃO', valorMaisPrevi);
    const p5Novo = await interpretacao(page, 'P5');
    const p15Novo = await interpretacao(page, 'P15');
    afirma(p5Novo.includes(semPrefixo(P5_NAO_NOVO)), 'T6/T1: P5 = NÃO: "' + p5Novo.replace(/\s+/g, ' ').slice(25, 130) + '…"');
    afirma(p15Novo.includes(semPrefixo(P15_NAO_NOVO)), 'T6/T2: P15 = NÃO: "' + p15Novo.replace(/\s+/g, ' ').slice(25, 130) + '…"');
    afirma(!DEPENDENCIA.test(p5Novo) && !DEPENDENCIA.test(p15Novo), 'nenhuma das duas afirma dependência estrutural');
    keyNovaA = decodeURIComponent((await page.evaluate(() => location.hash)).split('avp=')[1]);
    const novaA = (await banco(page))['avaliacoes-produto'][keyNovaA];
    afirma(novaA.questionnaireContentVersion === 2, 'avaliação nova grava questionnaireContentVersion = 2');
    afirma(novaA.camadaSugerida.id === 'a-validar' && novaA.resultadoAutomatico === 'a-validar', 'mesma classificação automática do Mais Previ: a-validar');
    afirma(novaA.motorVersion === MOTOR_VERSION && novaA.motorVersionArquitetura === 1, 'motorVersion/motorVersionArquitetura gravados = os vigentes (inalterados pela mudança editorial)');
    await page.click('#avpVoltarListaResultado');
    await page.waitForTimeout(200);

    console.log('\n== T3 — P15 = SIM: interpretação coerente com associação/dependência ==');
    await novaAvaliacao(page, 'Novo — P15 SIM', (id) => (id === 'componente' || id === 'necessidade' ? 'sim' : 'nao'));
    const p15Sim = await interpretacao(page, 'P15');
    afirma(/estruturalmente associada a outra solução/.test(p15Sim) && /contribui para que essa solução entregue seu resultado/.test(p15Sim), 'T3: "' + p15Sim.replace(/\s+/g, ' ').slice(25, 160) + '…"');
    await page.click('#avpVoltarListaResultado');
    await page.waitForTimeout(200);

    console.log('\n== T5 (de novo) — depois de tudo, o Mais Previ continua com a redação da época ==');
    await page.click('.avp-act-ver[data-key="maisprevi"]');
    await page.waitForSelector('.avp-reasoning-list', { timeout: 5000 });
    afirma((await interpretacao(page, 'P5')).includes(semPrefixo(P5_NAO_ANTIGO)), 'P5 do item histórico: redação da época');
    afirma(!/Embora dependa/i.test(await interpretacao(page, 'P15')), 'P15 do item histórico: sem o texto contraditório');

    console.log('\n== T7 — decisão manual "não Produto/Serviço Principal" com justificativa ==');
    const JUST = 'O Programa Mais Previ possui identidade, propósito, resultados e governança próprios, mas funciona como um programa transversal que reúne diferentes iniciativas.';
    await page.check('input[name="avpDecisao"][value="nao-produto"]');
    await page.fill('#avpJustificativaDecisao', JUST);
    await page.click('#avpSalvarDecisaoBtn');
    await page.waitForFunction(() => /Decisão salva/.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(200);
    const salvo = (await banco(page))['avaliacoes-produto'].maisprevi;
    afirma(salvo.decisaoManual === true && salvo.decisaoFinal === 'nao-produto' && salvo.justificativaDecisao === JUST, 'decisão manual gravada (não Produto/Serviço Principal + justificativa)');

    console.log('\n== T8 — a decisão não altera o resultado automático nem o motor ==');
    const semDecisao = (it) => { const c = JSON.parse(JSON.stringify(it)); ['decisaoFinal', 'decisaoManual', 'decisaoConfirmada', 'justificativaDecisao', 'alteradoPor', 'alteradoEm', 'naturezaComplementar', 'atualizadoEm'].forEach((k) => delete c[k]); return JSON.stringify(c); };
    afirma(semDecisao(salvo) === semDecisao(itemAntes), 'tudo fora da decisão (respostas, snapshots, resultado automático, camada, motorVersion…) idêntico ao de antes');
    afirma(salvo.resultadoAutomatico === 'a-validar' && salvo.camadaSugerida.id === 'a-validar', 'recomendação automática continua "A validar"; camada continua A validar (nunca "Programa transversal")');
    afirma(!/natureza/i.test(SRC_MOTOR), 'motor-arquitetura.js não menciona natureza');
    const trechoMotor = (nome) => { const i = SRC_AVP.indexOf('function ' + nome + '('); return SRC_AVP.slice(i, SRC_AVP.indexOf('\n  }\n', i)); };
    afirma(!/natureza/i.test(trechoMotor('identificarCamada')) && !/natureza/i.test(trechoMotor('computeResultado')) && !/natureza/i.test(trechoMotor('construirAtualizacaoReprocessamento') || ''),
      'identificarCamada/computeResultado/reprocessamento não leem a natureza');
    afirma(!CAMADA_TEM_NATUREZA(await page.evaluate(() => window.faMotorArquitetura.CAMADAS_VALIDAS)), 'a natureza não é uma camada válida do motor');

    console.log('\n== Tela: recomendação automática e decisão SEPARADAS ==');
    const resumo = await page.locator('#avpDecisaoResumo').innerText();
    afirma(/Recomendação automática\s+A validar/.test(resumo), 'Recomendação automática: A validar');
    afirma(/Decisão arquitetural\s+Não é Produto\/Serviço Principal/.test(resumo), 'Decisão arquitetural: Não é Produto/Serviço Principal');
    afirma(/Camada identificada:\s*A validar/.test(await page.locator('.avp-alt-card').innerText()), 'a camada identificada continua "A validar"');

    console.log('\n== Voltar para "Aceitar recomendação" desfaz a decisão manual ==');
    await page.check('input[name="avpDecisao"][value="auto"]');
    await page.click('#avpSalvarDecisaoBtn');
    await page.waitForFunction(() => /Decisão salva/.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(200);
    const aceito = (await banco(page))['avaliacoes-produto'].maisprevi;
    afirma(aceito.decisaoManual === false && aceito.decisaoFinal === 'a-validar', 'decisão automática aceita: decisão final = A validar');

    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  console.log('\n== Correção editorial respeita edição própria (texto divergente) ==');
  {
    const perguntasFabrica = null;
    const { ctx, page, erros } = await abrirApp(browser);
    /* publica uma versão 2 com P5 NÃO editada por "alguém", via mecanismo normal */
    await page.evaluate(() => new Promise((ok) => {
      const pg = JSON.parse(JSON.stringify(window.faQuestionarios.perguntasDaVersao('CLASSIFICACAO_ARQUITETURAL')));
      pg.find((p) => p.codigoEstavel === 'P5').justNao = 'NÃO — Redação própria da administradora.';
      window.faQuestionarios.publicarPerguntas('CLASSIFICACAO_ARQUITETURAL', pg, { name: 'Adm', email: 'adm@previ.com.br' }, ok);
    }));
    await page.waitForTimeout(300);
    await abrirConfig(page);
    const card = await page.locator('#avpCorrecao-interpretacoes-p5-p15').innerText();
    afirma(/mantido/.test(card) && (card.match(/\(pendente\)/g) || []).length === 2, 'P5 aparece "mantido" (editado por alguém); P15 (2 ajustes) pendentes');
    await page.click('.avp-correcao-aplicar-btn');
    await page.waitForTimeout(150);
    await page.click('.avp-modal-confirm-btn');
    await page.waitForFunction(() => /Correção aplicada/.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
    const msg = await page.locator('body > .modal-overlay').last().locator('.modal-box').innerText().catch(() => '');
    afirma(/versão 3/.test(msg) && /P15\.justSim/.test(msg) && /Mantidos.*P5\.justNao/.test(msg), 'aviso: versão 3 publicada; P5.justNao mantido');
    await page.click('.avp-modal-ok-btn').catch(() => {});
    const c = (await banco(page))['questionarios-config'].CLASSIFICACAO_ARQUITETURAL;
    const v3 = c.versoes['3'].perguntas;
    afirma(c.versaoPublicada === 3 && v3.find((p) => p.codigoEstavel === 'P5').justNao === 'NÃO — Redação própria da administradora.', 'a edição própria de P5 foi respeitada');
    afirma(v3.find((p) => p.codigoEstavel === 'P15').justNao === P15_NAO_NOVO && v3.find((p) => p.codigoEstavel === 'P15').justSim === P15_SIM_NOVO, 'P15 corrigido');
    afirma(erros.length === 0, 'nenhum erro de JS');
    await ctx.close();
  }

  console.log('\n== Rascunho em andamento bloqueia a aplicação (publicar limparia o rascunho) ==');
  {
    const { ctx, page, erros } = await abrirApp(browser, {
      db: { 'questionarios-config': { CLASSIFICACAO_ARQUITETURAL: { versaoPublicada: 1, rascunho: { perguntas: [{ codigoEstavel: 'P1', titulo: 'rascunho de alguém' }], atualizadoEm: '2026-09-30T10:00:00.000Z' } } } }
    });
    await abrirConfig(page);
    afirma(await contar(page, '#avpCorrecao-interpretacoes-p5-p15 .avp-correcao-aplicar-btn[disabled]') === 1, 'botão desabilitado');
    afirma(/rascunho de edição em andamento/.test(await page.locator('#avpCorrecao-interpretacoes-p5-p15').innerText()), 'mensagem explica o bloqueio');
    const r = await page.evaluate(() => new Promise((ok) => window.faQuestionarios.aplicarCorrecaoEditorial('interpretacoes-p5-p15', null, (err) => ok(err))));
    afirma(r === 'rascunho-em-andamento', 'API também recusa: ' + r);
    afirma((await banco(page))['questionarios-config'].CLASSIFICACAO_ARQUITETURAL.versaoPublicada === 1, 'nada foi publicado; rascunho preservado');
    afirma(erros.length === 0, 'nenhum erro de JS');
    await ctx.close();
  }

  console.log('\n== Rede lenta: configuração do questionário ainda não chegou → nada é publicado ==');
  {
    /* 999000 = "nunca responde" (ver firebase-falso.js) */
    const { ctx, page, erros } = await abrirApp(browser, {
      db: { 'questionarios-config': { CLASSIFICACAO_ARQUITETURAL: { versaoPublicada: 2, versoes: { 2: { perguntas: [{ codigoEstavel: 'P1', titulo: 'v2 real' }] } } } } },
      delays: { 'questionarios-config': 999000 }
    });
    const r = await page.evaluate(() => new Promise((ok) => {
      const pg = JSON.parse(JSON.stringify(window.faQuestionarios.perguntasDaVersao('CLASSIFICACAO_ARQUITETURAL')));
      let r1, r2;
      window.faQuestionarios.aplicarCorrecaoEditorial('interpretacoes-p5-p15', null, (err) => { r1 = err; });
      window.faQuestionarios.publicarPerguntas('CLASSIFICACAO_ARQUITETURAL', pg, null, (err) => { r2 = err; });
      setTimeout(() => ok([r1, r2, window.faQuestionarios.configCarregada('CLASSIFICACAO_ARQUITETURAL')]), 100);
    }));
    afirma(r[0] === 'config-nao-carregada' && r[1] === 'config-nao-carregada' && r[2] === false, 'aplicar e publicar recusados sem a config do servidor: ' + JSON.stringify(r));
    const cq = (await banco(page))['questionarios-config'].CLASSIFICACAO_ARQUITETURAL;
    afirma(cq.versaoPublicada === 2 && cq.versoes['2'].perguntas[0].titulo === 'v2 real' && !cq.versoes['1'], 'a versão 2 existente NÃO foi sobrescrita por uma "nova versão 2"');
    afirma(erros.length === 0, 'nenhum erro de JS');
    await ctx.close();
  }

  console.log('\n== Celular (375 px): card de correção e decisão ==');
  {
    const { ctx, page, erros } = await abrirApp(browser, {}, { width: 375, height: 740 });
    await abrirConfig(page);
    afirma(await page.locator('.avp-correcao-aplicar-btn').isVisible(), 'botão APLICAR CORREÇÃO visível');
    afirma(await larguraOk(page), 'configuração sem rolagem horizontal a 375 px');
    await page.click('.avp-correcao-aplicar-btn');
    await page.waitForTimeout(150);
    const caixa = await page.locator('body > .modal-overlay').last().locator('.modal-box').boundingBox();
    afirma(caixa && caixa.x >= 0 && caixa.x + caixa.width <= 375, 'confirmação cabe na tela do celular');
    await page.click('.avp-modal-cancel-btn');
    await voltarParaAvaliacoes(page);
    await page.waitForTimeout(200);
    await page.click('.avp-act-ver[data-key="maisprevi"]');
    await page.waitForSelector('#avpSalvarDecisaoBtn');
    await page.check('input[name="avpDecisao"][value="nao-produto"]');
    await page.fill('#avpJustificativaDecisao', 'programa transversal');
    afirma(await larguraOk(page), 'tela de decisão sem rolagem horizontal a 375 px');
    await page.click('#avpSalvarDecisaoBtn');
    await page.waitForFunction(() => /Decisão salva/.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
    afirma(await page.locator('#avpDecisaoResumo').isVisible() && await larguraOk(page), 'resumo recomendação/decisão visível e sem rolagem horizontal');
    afirma(erros.length === 0, 'nenhum erro de JS');
    await ctx.close();
  }

  await browser.close();
  console.log(falhas === 0
    ? '\n============================\nOK — interpretações refletem só a resposta dada; a decisão manual não toca o motor.'
    : '\n============================\n' + falhas + ' FALHA(S)');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

function CAMADA_TEM_NATUREZA(camadas) { return camadas.some((c) => /natureza|programa/i.test(c)); }
