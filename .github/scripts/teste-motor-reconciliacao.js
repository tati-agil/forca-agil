/* RECONCILIAR COM VERSÃO EQUIVALENTE x REPROCESSAR (motor arquitetural)
 * — T8, T9, T10 do pedido "CORRIGIR FALLBACK DO MOTOR ARQUITETURAL", mais
 * o editor de regras voltando a funcionar sobre uma versão já gravada.
 *
 * POR QUE ESTE TESTE EXISTE
 * Caso real: 9 avaliações concluídas; 8 carimbadas na versão 1 das regras,
 * 1 na versão 2; a versão 2 nasceu de uma publicação SEM mudança lógica
 * (antes da PR #242) e ficou gravada no banco com o fallback legado sem
 * `condicoes` (o Firebase real descarta {all:[]}). A tela mostrava as 8
 * como "Motor desatualizado" e oferecia REPROCESSAR — fingindo um recálculo
 * que não existe. Agora:
 *   - as 8 aparecem como "Versão anterior equivalente" (situação B), com a
 *     prova exaustiva v1 × v2 (65.536 combinações, retorno completo);
 *   - a ação é RECONCILIAR (só o carimbo de versão muda, com histórico e
 *     auditoria), nunca reprocessar;
 *   - havendo QUALQUER diferença lógica, a reconciliação é bloqueada e a
 *     avaliação continua "Motor desatualizado" (situação C).
 *
 * O banco falso roda em persistenciaReal (persistencia-firebase-real.js):
 * grava e lê como o Firebase de verdade — sem isso o defeito do fallback
 * nunca aparecia em teste. Hermético: sem rede, sem segredo. Desktop e
 * celular (375 px). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const SRC_AVP = fs.readFileSync(path.join(__dirname, '..', '..', 'forca-agil', 'avaliacao-produto.js'), 'utf8');
const MOTOR_VERSION = /var MOTOR_VERSION = '([^']+)'/.exec(SRC_AVP)[1];
const EMAIL = 'teste@previ.com.br';
const KEY = EMAIL.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

/* Regras de fábrica ANTERIORES a esta correção (fallback {all:[]}), como
   estavam em memória quando a versão 2 foi publicada. */
const mctx = { window: {}, console: console, JSON: JSON, Object: Object, Array: Array, String: String, Math: Math, Number: Number };
vm.createContext(mctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'forca-agil', 'motor-arquitetura.js'), 'utf8'), mctx);
const LEGADO = JSON.parse(JSON.stringify(mctx.window.faMotorArquitetura.PADRAO_REGRAS.regras)).map((r) => {
  if (r.codigo === 'FALLBACK_A_VALIDAR') { delete r.tipo; r.condicoes = { all: [] }; }
  return r;
});
/* Versão 3 com mudança lógica REAL: CANAL passa a exigir P9=NAO. */
const V3_COM_MUDANCA = JSON.parse(JSON.stringify(LEGADO));
V3_COM_MUDANCA.find((r) => r.codigo === 'CANAL').condicoes = { all: [{ campo: 'P9', valor: 'NAO' }, { campo: 'P10', valor: 'SIM' }] };
V3_COM_MUDANCA.find((r) => r.codigo === 'FALLBACK_A_VALIDAR').tipo = 'FALLBACK';
delete V3_COM_MUDANCA.find((r) => r.codigo === 'FALLBACK_A_VALIDAR').condicoes;

function item(nome, versaoRegras, i) {
  const respostas = {};
  ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia'].forEach((id) => {
    respostas[id] = { valor: 'sim', observacao: 'obs ' + id, justificativaAuto: 'interpretação ' + id, codigoPergunta: 'P', textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 };
  });
  ['jornada', 'medicao', 'gestao', 'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'].forEach((id) => {
    respostas[id] = { valor: 'nao', observacao: '', justificativaAuto: 'interpretação ' + id, codigoPergunta: 'P', textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 };
  });
  return {
    nome: nome, descricao: 'desc ' + i, publico: '', necessidade: '', observacoesGerais: '',
    status: 'concluido', respostas: respostas,
    resultadoAutomatico: 'produto', decisaoFinal: 'produto', decisaoManual: false,
    camadaSugerida: { id: 'produto-principal', label: 'Produto/Serviço principal', motivos: ['m1'], conflito: null, incoerencia: false, especializacao: null, papelEstrutural: null, relacao: null },
    justificativaAutomatica: 'justificativa gerada ' + i, criteriosEssenciaisFalhos: [], exclusoesConflitantes: null, criteriosAtendidos: 5,
    motorVersion: MOTOR_VERSION, motorVersionArquitetura: versaoRegras, questionnaireContentVersion: 1,
    criadoEm: '2026-09-01T10:00:0' + i + '.000Z', atualizadoEm: '2026-09-30T10:00:0' + i + '.000Z',
    reprocessedAt: '2026-09-30T10:00:0' + i + '.000Z', reprocessedFromVersion: '2026.09.29-1',
    historicoMotor: [{ motorVersion: '2026.09.29-1', resultadoAutomatico: 'produto', justificativaAutomatica: 'antiga ' + i }],
    responsavel: { name: 'Teste', email: EMAIL }, versao: 1, versaoAnteriorKey: null, excluido: false
  };
}
/* Produção reconstruída: v2 publicada (sem mudança lógica) com o fallback
   legado; 8 avaliações em v1, 1 em v2. */
function cenarioProducao(extraConfig) {
  const avaliacoes = {};
  for (let i = 1; i <= 8; i++) avaliacoes['k' + i] = item('Item ' + i, 1, i);
  avaliacoes['k9'] = item('Item 9', 2, 9);
  const config = Object.assign({
    versaoPublicada: 2,
    versoes: { 2: { regras: LEGADO, publicadoEm: '2026-09-30T11:00:00.000Z', publicadoPor: { name: 'Alguém', email: 'x@previ.com.br' } } }
  }, extraConfig || {});
  return { avaliacoes: avaliacoes, config: config };
}

async function abrirApp(browser, cenario, viewport) {
  const admins = {}; admins[KEY] = { email: EMAIL };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {},
    'turmas-checkin': {}, 'turmas-espera': {}, 'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {},
    eventos: {}, 'turmas-publico': {}, 'eventos-publico': {}, 'avaliacoes-produto': cenario.avaliacoes, 'avaliacoes-squad': {},
    'motor-squad-config': {}, 'motor-squad-auditoria': {}, 'motor-arquitetura-config': cenario.config, 'motor-arquitetura-auditoria': {} };
  const cfg = { db: db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport: viewport || { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.body.classList.contains('aguardando-auth'), { timeout: 16000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
  await page.waitForFunction(() => document.querySelectorAll('.avp-tag-motor').length > 0, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
  return { ctx, page, erros };
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const contar = (page, sel) => page.locator(sel).count();
function semCampos(obj, campos) { const c = JSON.parse(JSON.stringify(obj)); campos.forEach((k) => delete c[k]); return c; }

(async () => {
  const browser = await chromium.launch();

  console.log('== 1. Produção reconstruída: 8 em v1 (equivalente) + 1 em v2 (atual) — nada é "desatualizado" ==');
  {
    const { ctx, page, erros } = await abrirApp(browser, cenarioProducao());
    const antes = await banco(page);
    afirma(!('condicoes' in antes['motor-arquitetura-config'].versoes[2].regras.find((r) => r.codigo === 'FALLBACK_A_VALIDAR')),
      'pré-condição: a versão 2 está no banco SEM condicoes no fallback (como em produção)');
    afirma(await contar(page, '.avp-tag-motor--equivalente') === 8, '8 badges "Versão anterior equivalente": ' + await contar(page, '.avp-tag-motor--equivalente'));
    afirma(await contar(page, '.avp-tag-motor--atual') === 1, '1 badge "Motor atual"');
    afirma(await contar(page, '.avp-tag-motor--desatualizado') === 0, '0 badges "Motor desatualizado" (B e C não se misturam)');
    const barra = await page.locator('#avpReconciliarBar').innerText().catch(() => '');
    afirma(/Existem 8 avaliações em uma versão anterior semanticamente equivalente/.test(barra), 'barra: "Existem 8 avaliações em uma versão anterior semanticamente equivalente…"');
    afirma(/RECONCILIAR 8 AVALIAÇÕES/.test(barra), 'botão "RECONCILIAR 8 AVALIAÇÕES"');
    const repBtn = page.locator('#avpReprocessarTudoBtn');
    afirma(await repBtn.isDisabled() && /Nenhuma avaliação precisa ser reprocessada/i.test(await repBtn.textContent()), 'REPROCESSAR TUDO desabilitado: nenhuma precisa ser reprocessada');

    await page.selectOption('#avpFiltroMotor', 'equivalente');
    await page.waitForTimeout(200);
    afirma(await contar(page, '.avp-act-ver') === 8, 'filtro "Versão anterior equivalente" mostra as 8');
    await page.selectOption('#avpFiltroMotor', 'desatualizado');
    await page.waitForTimeout(200);
    afirma(await contar(page, '.avp-act-ver') === 0, 'filtro "Motor desatualizado" mostra 0');
    await page.selectOption('#avpFiltroMotor', 'todos');
    await page.waitForTimeout(200);

    console.log('\n== 2. Tela individual (situação B): oferece RECONCILIAR, nunca REPROCESSAR ==');
    await page.click('.avp-act-ver[data-key="k3"]');
    await page.waitForSelector('#avpAvisoEquivalente', { timeout: 5000 }).catch(() => {});
    const aviso = await page.locator('#avpAvisoEquivalente').innerText().catch(() => '');
    afirma(/65\.536/.test(aviso) && /0 diferenças/.test(aviso), 'aviso mostra a prova (65.536 combinações, 0 diferenças)');
    afirma(await contar(page, '#avpReconciliarBtn') === 1, 'botão RECONCILIAR COM VERSÃO EQUIVALENTE presente');
    afirma(await contar(page, '#avpReprocessarBtn') === 0, 'botão REPROCESSAR ausente');
    await page.click('#avpReconciliarBtn');
    await page.waitForTimeout(150);
    await page.click('.avp-modal-confirm-btn');
    await page.waitForFunction(() => /reconciliada/.test((document.querySelector('#avpFlashResultado') || {}).textContent || ''), { timeout: 8000 }).catch(() => {});
    let depois = await banco(page);
    const k3 = depois['avaliacoes-produto'].k3;
    afirma(k3.motorVersionArquitetura === 2, 'individual: k3 passou para a versão 2');
    afirma(JSON.stringify(semCampos(k3, ['motorVersionArquitetura', 'reconciliacoesVersao'])) ===
      JSON.stringify(semCampos(antes['avaliacoes-produto'].k3, ['motorVersionArquitetura', 'reconciliacoesVersao'])),
      'individual: NENHUM outro campo de k3 mudou (respostas, justificativas, classificação, atualizadoEm, historicoMotor…)');
    afirma(await contar(page, '#avpAvisoEquivalente') === 0, 'individual: aviso de versão equivalente some depois de reconciliar');
    await page.goto(BASE + '/index.html#admin');
    await page.waitForTimeout(600);
    await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]').catch(() => {});
    await page.waitForTimeout(400);

    console.log('\n== 3. Lote: prova no modal, confirmação explícita, gravação concorrente é respeitada ==');
    afirma(/RECONCILIAR 7 AVALIAÇÕES/.test(await page.locator('#avpReconciliarBar').innerText().catch(() => '')), 'restam 7 para reconciliar');
    await page.click('#avpReconciliarTudoBtn');
    await page.waitForSelector('#avpReconciliarProvas', { timeout: 3000 }).catch(() => {});
    const prova = await page.locator('#avpReconciliarProvas').innerText().catch(() => '');
    afirma(/7 avaliações na versão 1/.test(prova) && /Versão 1 × versão 2/.test(prova) && /65\.536/.test(prova) && /0 diferenças/.test(prova),
      'modal mostra: 7 na versão 1, Versão 1 × versão 2, 65.536 combinações, 0 diferenças');
    afirma(/semanticamente equivalentes/.test(prova), 'modal declara as versões semanticamente equivalentes');
    afirma(JSON.stringify((await banco(page))['avaliacoes-produto']) === JSON.stringify(depois['avaliacoes-produto']), 'abrir o modal não grava nada (só depois de confirmar)');
    /* Outra pessoa reprocessa k1 enquanto o modal está aberto. */
    await page.evaluate(() => new Promise((ok) => firebase.database().ref('avaliacoes-produto/k1').update({ motorVersionArquitetura: 2, reprocessedAt: '2026-10-01T00:00:00.000Z' }, ok)));
    await page.click('#avpReconciliarConfirmar');
    await page.waitForSelector('#avpReconciliacaoResumo', { timeout: 10000 }).catch(() => {});
    const resumo = await page.locator('#avpReconciliacaoResumo').innerText().catch(() => '');
    afirma(/6 avaliações reconciliadas com a versão 2/.test(resumo), 'resumo: 6 reconciliadas');
    afirma(/1 ignorada/.test(resumo), 'resumo: 1 ignorada (k1 mudou entre a confirmação e a gravação)');
    afirma(/Registro na auditoria do motor gravado/.test(resumo), 'resumo: auditoria gravada');
    depois = await banco(page);
    const av = depois['avaliacoes-produto'];

    console.log('\n== T8 — reconciliação altera SÓ motorVersionArquitetura (+ o próprio histórico) ==');
    ['k2', 'k4', 'k5', 'k6', 'k7', 'k8'].forEach((k) => {
      afirma(av[k].motorVersionArquitetura === 2, k + ': motorVersionArquitetura 1 → 2');
      afirma(JSON.stringify(semCampos(av[k], ['motorVersionArquitetura', 'reconciliacoesVersao'])) ===
        JSON.stringify(semCampos(antes['avaliacoes-produto'][k], ['motorVersionArquitetura', 'reconciliacoesVersao'])),
        k + ': respostas, justificativas, classificação, decisão, datas e historicoMotor idênticos');
      const h = av[k].reconciliacoesVersao || [];
      afirma(h.length === 1 && h[0].versaoAnterior === 1 && h[0].versaoAtual === 2 && h[0].equivalenciaComprovada === true &&
        h[0].diferencasSemanticas === 0 && h[0].combinacoesAnalisadas === 65536, k + ': histórico preserva a versão anterior e a prova');
    });
    afirma(!av.k1.reconciliacoesVersao && av.k1.reprocessedAt === '2026-10-01T00:00:00.000Z', 'k1 (mudada por outra pessoa) não foi sobrescrita');
    afirma(!av.k9.reconciliacoesVersao, 'k9 (já na versão atual) não foi tocada');

    console.log('\n== T9 — auditoria reconciliacao_versao_equivalente ==');
    const aud = Object.values(depois['motor-arquitetura-auditoria'] || {}).filter((a) => a.tipo === 'reconciliacao_versao_equivalente');
    afirma(aud.length === 2, '2 entradas (uma por operação: individual + lote): ' + aud.length);
    const lote = aud.find((a) => a.quantidade === 6);
    afirma(!!lote && lote.versaoAnterior === 1 && lote.versaoAtual === 2 && lote.equivalenciaComprovada === true &&
      lote.diferencasSemanticas === 0 && lote.combinacoesAnalisadas === 65536 && !!lote.dataHora && lote.usuario && lote.usuario.email === EMAIL,
      'entrada do lote: versaoAnterior 1, versaoAtual 2, equivalenciaComprovada, 0 diferenças, 65536, data, usuário');
    afirma(lote && Object.keys(lote.avaliacoes).sort().join() === 'k2,k4,k5,k6,k7,k8', 'entrada lista exatamente as avaliações reconciliadas');
    afirma(depois['motor-arquitetura-config'].versaoPublicada === 2 && !depois['motor-arquitetura-config'].versoes[3], 'nenhuma versão nova do motor foi criada');
    await page.click('#avpReconciliacaoFechar');
    await page.waitForTimeout(200);
    afirma(await contar(page, '.avp-tag-motor--atual') === 9 && await contar(page, '#avpReconciliarBar') === 0, 'lista: as 9 em "Motor atual", barra de reconciliação some');

    await page.click('#avpConfigMotoresBtn');
    await page.waitForTimeout(200);
    await page.click('#avpMotorArqAuditoriaBtn');
    await page.waitForTimeout(400);
    afirma(/Reconciliação com versão equivalente/.test(await page.locator('#adminPanelArquitetura').innerText().catch(() => '')), 'tela de auditoria do motor mostra "Reconciliação com versão equivalente"');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  console.log('\n== 4. Editor volta a funcionar sobre a versão gravada (fallback legado no banco) ==');
  {
    const { ctx, page, erros } = await abrirApp(browser, cenarioProducao());
    await page.click('#avpConfigMotoresBtn');
    await page.waitForTimeout(200);
    await page.click('#avpMotorArqEditarBtn');
    await page.waitForTimeout(300);
    afirma(/regra de fallback/.test(await page.locator('.sq-regra-card').last().innerText().catch(() => '')), 'editor abre e mostra o fallback (antes: quebrava em regra.condicoes undefined)');
    await page.click('#avpMotorArqSimularBtn');
    await page.waitForTimeout(400);
    afirma(await contar(page, '#avpMotorArqConfirmarPublicarBtn') === 1, 'SIMULAR passa na validação (antes: "falta um fallback")');
    await page.click('#avpMotorArqConfirmarPublicarBtn');
    await page.waitForTimeout(600);
    let cfgDb = (await banco(page))['motor-arquitetura-config'];
    afirma(cfgDb.versaoPublicada === 2 && !cfgDb.versoes[3], 'publicar sem mudança (legado × explícito) NÃO cria versão nova');
    /* Salvar rascunho → reabrir (vem do banco, já normalizado) → mudança real → publicar. */
    await page.click('#avpMotorArqEditarBtn');
    await page.waitForTimeout(300);
    await page.click('#avpMotorArqSalvarRascunhoBtn');
    await page.waitForTimeout(500);
    await page.click('#avpMotorArqEditarBtn');
    await page.waitForTimeout(300);
    await page.selectOption('.sq-cond-select[data-leaf-id="0"]', 'NAO');
    await page.click('#avpMotorArqSimularBtn');
    await page.waitForTimeout(400);
    await page.click('#avpMotorArqConfirmarPublicarBtn');
    await page.waitForTimeout(600);
    cfgDb = (await banco(page))['motor-arquitetura-config'];
    const fb3 = cfgDb.versoes[3] && cfgDb.versoes[3].regras.find((r) => r.codigo === 'FALLBACK_A_VALIDAR');
    afirma(cfgDb.versaoPublicada === 3, 'mudança real (depois de salvar/reabrir rascunho) cria a versão 3');
    afirma(fb3 && fb3.tipo === 'FALLBACK' && !('condicoes' in fb3), 'versão 3 grava o fallback na forma explícita (tipo FALLBACK)');
    afirma(await page.evaluate(() => window.faMotorArquitetura.validarRegras({ regras: window.faMotorArquitetura.regrasDaVersao(3).regras }).length === 0),
      'versão 3, lida de volta do banco, valida sem erros');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  console.log('\n== T10 — mudança lógica real: reconciliação bloqueada, só reprocessar ==');
  {
    const cen = cenarioProducao({ versaoPublicada: 3 });
    cen.config.versoes[3] = { regras: V3_COM_MUDANCA, publicadoEm: '2026-10-01T00:00:00.000Z' };
    const { ctx, page, erros } = await abrirApp(browser, cen);
    afirma(await contar(page, '.avp-tag-motor--desatualizado') === 9, 'v1 e v2 × v3 (com mudança): as 9 "Motor desatualizado"');
    afirma(await contar(page, '.avp-tag-motor--equivalente') === 0 && await contar(page, '#avpReconciliarBar') === 0, 'nenhuma "equivalente", nenhuma barra de reconciliação');
    afirma(!(await page.locator('#avpReprocessarTudoBtn').isDisabled()), 'REPROCESSAR TUDO habilitado');
    await page.click('.avp-act-ver[data-key="k2"]');
    await page.waitForTimeout(500);
    afirma(await contar(page, '#avpReprocessarBtn') === 1 && await contar(page, '#avpReconciliarBtn') === 0, 'tela individual: REPROCESSAR, nunca RECONCILIAR');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }
  {
    /* Mudança lógica publicada DEPOIS de abrir o modal: a prova é refeita na
       gravação e bloqueia tudo. */
    const { ctx, page, erros } = await abrirApp(browser, cenarioProducao());
    const antes = await banco(page);
    await page.click('#avpReconciliarTudoBtn');
    await page.waitForSelector('#avpReconciliarConfirmar', { timeout: 3000 }).catch(() => {});
    const regrasV3 = JSON.parse(JSON.stringify(V3_COM_MUDANCA));
    const pub = await page.evaluate((regras) => new Promise((ok) => window.faMotorArquitetura.publicarRegras(regras, { name: 'Outra', email: 'o@previ.com.br' },
      (err, info) => setTimeout(() => ok({ err: err, v: window.faMotorArquitetura.versaoAtual() }), 300))), regrasV3);
    afirma(pub.v === 3 && !pub.err, 'outra pessoa publica v3 com mudança lógica enquanto o modal está aberto');
    await page.waitForTimeout(200);
    await page.click('#avpReconciliarConfirmar');
    await page.waitForSelector('#avpReconciliacaoResumo', { timeout: 10000 }).catch(() => {});
    const resumo = await page.locator('#avpReconciliacaoCard').innerText().catch(() => '');
    afirma(/0 avaliações reconciliadas/.test(resumo) && /8 ignoradas/.test(resumo) && /use Reprocessar/.test(resumo), 'resumo: 0 reconciliadas, 8 ignoradas — "use Reprocessar"');
    const depois = await banco(page);
    afirma(JSON.stringify(depois['avaliacoes-produto']) === JSON.stringify(antes['avaliacoes-produto']), 'nenhuma avaliação foi alterada');
    afirma(!Object.values(depois['motor-arquitetura-auditoria'] || {}).some((a) => a.tipo === 'reconciliacao_versao_equivalente'), 'nenhuma auditoria de reconciliação gravada');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  console.log('\n== 5. Celular (375 px): barra, modal e reconciliação em lote ==');
  {
    const { ctx, page, erros } = await abrirApp(browser, cenarioProducao(), { width: 375, height: 740 });
    const larguraOk = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    afirma(await page.locator('#avpReconciliarTudoBtn').isVisible(), 'botão RECONCILIAR visível no celular');
    afirma(await larguraOk(), 'lista sem rolagem horizontal a 375 px');
    await page.click('#avpReconciliarTudoBtn');
    await page.waitForSelector('#avpReconciliarConfirmar', { timeout: 3000 }).catch(() => {});
    const caixa = await page.locator('.avp-lote-modal-box').boundingBox();
    afirma(caixa && caixa.x >= 0 && caixa.x + caixa.width <= 375, 'modal cabe na largura do celular');
    afirma(await page.locator('#avpReconciliarConfirmar').isVisible(), 'botão de confirmar alcançável no modal');
    await page.click('#avpReconciliarConfirmar');
    await page.waitForSelector('#avpReconciliacaoResumo', { timeout: 10000 }).catch(() => {});
    afirma(/8 avaliações reconciliadas/.test(await page.locator('#avpReconciliacaoResumo').innerText().catch(() => '')), 'celular: 8 reconciliadas');
    afirma(await larguraOk(), 'resumo sem rolagem horizontal a 375 px');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  await browser.close();
  console.log(falhas === 0
    ? '\n============================\nOK — versões equivalentes são reconciliadas sem reprocessar nem alterar a classificação; mudança lógica real continua exigindo reprocessamento.'
    : '\n============================\n' + falhas + ' FALHA(S)');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
