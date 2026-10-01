/* Modal "Atualizar avaliações para a versão atual do motor" — três situações
 * distintas, cada uma com a sua ação: já no motor atual / versão anterior
 * COMPROVADAMENTE equivalente (RECONCILIAR) / versão anterior com mudança
 * lógica real (REPROCESSAR). T1-T6 do pedido "AJUSTAR MODAL DE MOTOR
 * DESATUALIZADO — DISTINGUIR REPROCESSAMENTO DE RECONCILIAÇÃO", mais:
 *   - situação mista (5 atuais + 8 equivalentes + 7 realmente desatualizadas):
 *     dois botões separados, cada um agindo só no seu grupo;
 *   - "verificando": enquanto a configuração do motor não chega do servidor,
 *     nada é rotulado "desatualizado" nem oferecido (rede lenta é condição
 *     normal de celular — "ainda não sei" não é "precisa reprocessar");
 *   - o motivo de cada "desatualizada" aparece no modal;
 *   - equivalência só por PROVA entre as versões, nunca porque uma avaliação
 *     produziu o mesmo resultado;
 *   - celular (375 px).
 * Banco falso em persistenciaReal (grava/lê como o Firebase de verdade).
 * Hermético: sem rede, sem segredo. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const MOTOR_VERSION = /var MOTOR_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(RAIZ, 'avaliacao-produto.js'), 'utf8'))[1];
const EMAIL = 'teste@previ.com.br';
const KEY = EMAIL.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

const mctx = { window: {}, console: console, JSON: JSON, Object: Object, Array: Array, String: String, Math: Math, Number: Number };
vm.createContext(mctx);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'motor-arquitetura.js'), 'utf8'), mctx);
const MOTOR = mctx.window.faMotorArquitetura;
const copia = (v) => JSON.parse(JSON.stringify(v));
/* v1 = fábrica (nunca gravada); LEGADO = como a fábrica antiga ficou no banco */
const LEGADO = copia(MOTOR.PADRAO_REGRAS.regras).map((r) => { if (r.codigo === 'FALLBACK_A_VALIDAR') { delete r.tipo; r.condicoes = { all: [] }; } return r; });
/* mudança LÓGICA real: CANAL passa a exigir P9 = NÃO (nunca dispara) */
const V_LOGICA = copia(LEGADO); V_LOGICA.find((r) => r.codigo === 'CANAL').condicoes = { all: [{ campo: 'P9', valor: 'NAO' }, { campo: 'P10', valor: 'SIM' }] };
/* MESMA lógica de V_LOGICA, só serialização diferente (fallback explícito, chaves em outra ordem) */
const V_EQUIV = MOTOR.migrarFallbackLegado(V_LOGICA).map((r) => { const o = {}; Object.keys(r).reverse().forEach((k) => { o[k] = r[k]; }); return o; });

function item(nome, i, extra) {
  const respostas = {};
  ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia'].forEach((id) => { respostas[id] = { valor: 'sim', observacao: 'obs ' + id, justificativaAuto: 'interpretação ' + id, codigoPergunta: 'P', textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 }; });
  ['jornada', 'medicao', 'gestao', 'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'].forEach((id) => { respostas[id] = { valor: 'nao', observacao: '', justificativaAuto: 'interpretação ' + id, codigoPergunta: 'P', textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 }; });
  const n = String(i).padStart(2, '0');
  return Object.assign({
    nome: nome, descricao: 'desc ' + i, publico: '', necessidade: '', observacoesGerais: '',
    status: 'concluido', respostas: respostas, resultadoAutomatico: 'produto', decisaoFinal: 'produto', decisaoManual: false,
    camadaSugerida: { id: 'produto-principal', label: 'Produto/Serviço principal', motivos: ['m1'], conflito: null, incoerencia: false, especializacao: null, papelEstrutural: null, relacao: null },
    justificativaAutomatica: 'justificativa gerada ' + i, criteriosEssenciaisFalhos: ['x'], exclusoesConflitantes: null, criteriosAtendidos: 5,
    motorVersion: MOTOR_VERSION, motorVersionArquitetura: 1, questionnaireContentVersion: 1,
    criadoEm: '2026-09-01T10:00:' + n + '.000Z', atualizadoEm: '2026-09-30T10:00:' + n + '.000Z',
    reprocessedAt: '2026-09-30T11:00:' + n + '.000Z', reprocessedFromVersion: '2026.09.29-1',
    historicoMotor: [{ motorVersion: '2026.09.29-1', resultadoAutomatico: 'produto', justificativaAutomatica: 'antiga ' + i }],
    responsavel: { name: 'Teste', email: EMAIL }, versao: 1, versaoAnteriorKey: null, excluido: false
  }, extra || {});
}
/* n avaliações 'prefixo1..n' na versão `versao` das regras */
function lote(prefixo, n, versao, extra, inicio) {
  const o = {};
  for (let i = 1; i <= n; i++) o[prefixo + i] = item('Avaliação ' + prefixo + i, (inicio || 0) + i, Object.assign({ motorVersionArquitetura: versao }, extra || {}));
  return o;
}

async function abrirApp(browser, avaliacoes, config, viewport, delays) {
  const admins = {}; admins[KEY] = { email: EMAIL };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {},
    'turmas-checkin': {}, 'turmas-espera': {}, 'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {},
    eventos: {}, 'turmas-publico': {}, 'eventos-publico': {}, 'avaliacoes-produto': avaliacoes, 'avaliacoes-squad': {},
    'motor-squad-config': {}, 'motor-squad-auditoria': {}, 'motor-arquitetura-config': config, 'motor-arquitetura-auditoria': {} };
  const cfg = { db: db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true, delays: delays };
  const ctx = await browser.newContext({ viewport: viewport || { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#avaliacoes', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.body.classList.contains('aguardando-auth'), { timeout: 16000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.waitForFunction(() => document.querySelectorAll('.avp-tag-motor').length > 0, { timeout: 8000 }).catch(() => {});
  /* sem atraso proposital, espera a prova de equivalência assentar os selos
     (com atraso, o cenário 3 quer justamente ver "Verificando motor…") */
  if (!delays) await page.waitForFunction(() => !document.querySelector('.avp-tag-motor--verificando'), { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
  return { ctx, page, erros };
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const contar = (page, sel) => page.locator(sel).count();
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const itens = async (page) => (await banco(page))['avaliacoes-produto'];
function semCampos(obj, campos) { const c = copia(obj); campos.forEach((k) => delete c[k]); return c; }
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function abrirModal(page, botao) {
  await page.click(botao);
  await page.waitForSelector('#avpLoteResumoContagens', { timeout: 3000 });
}
async function fecharModal(page) { await page.click('#avpLoteCancelar').catch(() => {}); await page.waitForTimeout(150); }
const textoModal = (page) => page.locator('body > .modal-overlay').last().innerText();

(async () => {
  const browser = await chromium.launch();

  /* ============================================================ */
  console.log('== 1. O cenário da tela: 10 avaliações — 8 em versão anterior equivalente + 2 no motor atual ==');
  {
    const av = Object.assign(lote('eq', 8, 1), lote('at', 2, 2, null, 8));
    const cfg = { versaoPublicada: 2, versoes: { 2: { regras: LEGADO, publicadoEm: '2026-09-30T11:00:00.000Z', publicadoPor: { email: 'x@previ.com.br' } } } };
    const { ctx, page, erros } = await abrirApp(browser, av, cfg);
    const antes = await itens(page);

    console.log('\n== T1/T2 — badges: atual e versão anterior equivalente (nunca "desatualizado") ==');
    afirma(await contar(page, '.avp-tag-motor--atual') === 2, 'T1: 2 "Motor atual"');
    afirma(await contar(page, '.avp-tag-motor--equivalente') === 8, 'T2: 8 "Versão anterior equivalente"');
    afirma(await contar(page, '.avp-tag-motor--desatualizado') === 0, '0 "Motor desatualizado"');
    afirma(await contar(page, '.avp-tag-motor--verificando') === 0, 'nenhuma em "verificando" (a configuração já chegou)');
    afirma(await page.locator('#avpReprocessarTudoBtn').isDisabled(), 'REPROCESSAR TUDO desabilitado: nada a reprocessar');
    afirma(await page.locator('#avpReconciliarTudoBtn').isVisible(), 'botão de reconciliar visível');

    console.log('\n== T6 — o modal: "8 podem ser reconciliadas" e "2 já estão no motor atual" ==');
    await abrirModal(page, '#avpReconciliarTudoBtn');
    const m = await textoModal(page);
    afirma(/Atualizar avaliações para a versão atual do motor/.test(m), 'título: "Atualizar avaliações para a versão atual do motor"');
    const contagens = await page.locator('#avpLoteResumoContagens li').allInnerTexts();
    afirma(contagens[0] === '10 avaliações concluídas', 'contagem: "' + contagens[0] + '"');
    afirma(contagens.some((t) => /^2 já estão no motor atual$/.test(t)), 'contagem: "2 já estão no motor atual"');
    afirma(contagens.some((t) => /^8 podem ser reconciliadas — estão em uma versão anterior equivalente$/.test(t)), 'contagem: "8 podem ser reconciliadas — estão em uma versão anterior equivalente"');
    afirma(!/precisam ser reprocessadas|REPROCESSAR/.test(m), 'nada de "precisam ser reprocessadas" nem botão REPROCESSAR');
    afirma(/As 8 avaliações foram produzidas por uma versão anterior do motor que foi comprovada como semanticamente equivalente à versão atual\. As respostas, justificativas e classificações não precisam ser recalculadas\./.test(m),
      'texto explicativo exato');
    afirma(await contar(page, '#avpReconciliarConfirmar') === 1 && /^RECONCILIAR 8 AVALIAÇÕES$/.test((await page.locator('#avpReconciliarConfirmar').innerText()).trim()), 'botão "RECONCILIAR 8 AVALIAÇÕES"');
    afirma(await contar(page, '#avpLoteConfirmar') === 0, 'sem botão de reprocessar');
    const prova = await page.locator('#avpReconciliarProvas').innerText();
    afirma(/8 avaliações na versão 1/.test(prova) && /Versão 1 × versão 2/.test(prova) && /65\.536/.test(prova) && /0 diferenças/.test(prova), 'prova entre as versões: 65.536 combinações, 0 diferenças');
    afirma(igual(await itens(page), antes), 'abrir o modal não grava nada');

    await page.click('#avpReconciliarConfirmar');
    await page.waitForSelector('#avpReconciliacaoResumo', { timeout: 10000 }).catch(() => {});
    const dep = await banco(page);
    const av2 = dep['avaliacoes-produto'];

    console.log('\n== T4 — reconciliação: só o vínculo de versão muda; o resto fica idêntico ==');
    const ids = Object.keys(antes).filter((k) => k.startsWith('eq'));
    afirma(ids.every((k) => av2[k].motorVersionArquitetura === 2), '8 avaliações: motorVersionArquitetura 1 → 2');
    afirma(ids.every((k) => igual(semCampos(av2[k], ['motorVersionArquitetura', 'reconciliacoesVersao']), semCampos(antes[k], ['motorVersionArquitetura', 'reconciliacoesVersao']))),
      'respostas, justificativas, classificação, decisão, especialização, papel estrutural, snapshot, datas e historicoMotor idênticos');
    afirma(ids.every((k) => av2[k].reprocessedAt === antes[k].reprocessedAt && igual(av2[k].historicoMotor, antes[k].historicoMotor)), 'não virou reprocessamento: reprocessedAt e historicoMotor intactos (o motor não rodou)');
    afirma(igual(Object.keys(antes).filter((k) => k.startsWith('at')).map((k) => av2[k]), Object.keys(antes).filter((k) => k.startsWith('at')).map((k) => antes[k])), 'as 2 que já estavam no motor atual não foram tocadas');

    console.log('\n== T5 — histórico: reconciliacao_versao_equivalente (e nada de reprocessamento) ==');
    const aud = Object.values(dep['motor-arquitetura-auditoria'] || {});
    afirma(aud.length === 8 && aud.every((a) => a.tipo === 'reconciliacao_versao_equivalente'), '8 entradas, todas "reconciliacao_versao_equivalente": ' + aud.map((a) => a.tipo).filter((v, i, a) => a.indexOf(v) === i).join());
    afirma(aud.map((a) => a.avaliacaoId).sort().join() === ids.sort().join(), 'uma entrada por avaliação (avaliacaoId)');
    afirma(aud.every((a) => a.versaoAnterior === 1 && a.versaoNova === 2 && a.equivalenciaComprovada === true && a.diferencasSemanticas === 0 && !!a.dataHora && a.usuario && a.usuario.email === EMAIL),
      'cada uma: versaoAnterior 1, versaoNova 2, equivalenciaComprovada, diferencasSemanticas 0, dataHora, usuario');
    afirma(ids.every((k) => { const h = av2[k].reconciliacoesVersao || []; return h.length === 1 && h[0].versaoAnterior === 1 && h[0].versaoNova === 2 && h[0].equivalenciaComprovada === true && h[0].diferencasSemanticas === 0; }),
      'e o histórico da própria avaliação guarda a versão anterior e a prova');
    afirma(dep['motor-arquitetura-config'].versaoPublicada === 2 && !dep['motor-arquitetura-config'].versoes[3], 'nenhuma versão nova do motor');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  /* ============================================================ */
  console.log('\n== 2. Situação mista: 20 avaliações — 5 atuais, 8 equivalentes, 7 realmente desatualizadas ==');
  {
    /* v1 = fábrica; v2 = mudança LÓGICA; v3 = mesma lógica de v2, serialização diferente (vigente).
       atuais na v3; equivalentes na v2 (v2 ≡ v3); desatualizadas na v1 (v1 ≠ v3). */
    const av = Object.assign(lote('at', 5, 3), lote('eq', 8, 2, null, 5), lote('de', 7, 1, null, 13));
    const cfg = { versaoPublicada: 3, versoes: { 2: { regras: V_LOGICA, publicadoEm: '2026-09-29T10:00:00.000Z' }, 3: { regras: V_EQUIV, publicadoEm: '2026-09-30T10:00:00.000Z' } } };
    const { ctx, page, erros } = await abrirApp(browser, av, cfg);
    const antes = await itens(page);

    console.log('\n== T3 — versão antiga COM mudança lógica: "Motor desatualizado" ==');
    afirma(await contar(page, '.avp-tag-motor--atual') === 5 && await contar(page, '.avp-tag-motor--equivalente') === 8 && await contar(page, '.avp-tag-motor--desatualizado') === 7,
      'badges: 5 atual · 8 versão anterior equivalente · 7 motor desatualizado');
    afirma(await page.locator('.avp-tag-motor--desatualizado').first().getAttribute('title').then((t) => /versão 1 das regras: [\d.]+ de 65\.536 combinações/.test(t || '')),
      'o selo "Motor desatualizado" explica o porquê (tooltip): ' + await page.locator('.avp-tag-motor--desatualizado').first().getAttribute('title'));
    afirma(/REPROCESSAR TUDO COM MOTOR ATUAL \(7\)/.test(await page.locator('#avpReprocessarTudoBtn').innerText()), 'REPROCESSAR TUDO (7) — só as realmente desatualizadas');
    afirma(/RECONCILIAR 8 AVALIAÇÕES/.test(await page.locator('#avpReconciliarBar').innerText()), 'RECONCILIAR 8 — só as equivalentes');
    await page.selectOption('#avpFiltroMotor', 'desatualizado'); await page.waitForTimeout(150);
    afirma(await contar(page, '.avp-act-ver') === 7, 'filtro "Motor desatualizado": 7');
    await page.selectOption('#avpFiltroMotor', 'equivalente'); await page.waitForTimeout(150);
    afirma(await contar(page, '.avp-act-ver') === 8, 'filtro "Versão anterior equivalente": 8');
    await page.selectOption('#avpFiltroMotor', 'todos'); await page.waitForTimeout(150);

    console.log('\n== Modal misto: contagens separadas e botões separados ==');
    await abrirModal(page, '#avpReprocessarTudoBtn');
    const contagens = await page.locator('#avpLoteResumoContagens li').allInnerTexts();
    afirma(contagens[0] === '20 avaliações concluídas', '"' + contagens[0] + '"');
    afirma(contagens.some((t) => /^5 já estão no motor atual$/.test(t)), '"5 já estão no motor atual"');
    afirma(contagens.some((t) => /^8 podem ser reconciliadas/.test(t)), '"8 podem ser reconciliadas…"');
    afirma(contagens.some((t) => /^7 precisam ser reprocessadas — motor desatualizado$/.test(t)), '"7 precisam ser reprocessadas — motor desatualizado"');
    afirma(/^RECONCILIAR 8 AVALIAÇÕES$/.test((await page.locator('#avpReconciliarConfirmar').innerText()).trim()) && /^REPROCESSAR 7 AVALIAÇÕES$/.test((await page.locator('#avpLoteConfirmar').innerText()).trim()),
      'dois botões: "RECONCILIAR 8 AVALIAÇÕES" e "REPROCESSAR 7 AVALIAÇÕES"');
    afirma(await contar(page, '#avpSecaoReconciliar #avpLoteConfirmar') === 0 && await contar(page, '#avpSecaoReprocessar #avpReconciliarConfirmar') === 0, 'cada botão está na sua própria seção (as operações não se misturam)');
    const motivos = await page.locator('#avpReprocessarMotivos li').allInnerTexts();
    afirma(motivos.length === 1 && /^7 — versão 1 das regras: [\d.]+ de 65\.536 combinações de respostas dão resultado diferente da versão atual \(3\)$/.test(motivos[0]),
      'o modal diz POR QUÊ: "' + motivos[0] + '"');
    afirma(igual(await itens(page), antes), 'abrir o modal não grava nada');

    await page.click('#avpReconciliarConfirmar');
    await page.waitForSelector('#avpReconciliacaoResumo', { timeout: 10000 }).catch(() => {});
    let dep = await itens(page);
    const eq = Object.keys(antes).filter((k) => k.startsWith('eq')), de = Object.keys(antes).filter((k) => k.startsWith('de')), at = Object.keys(antes).filter((k) => k.startsWith('at'));
    afirma(eq.every((k) => dep[k].motorVersionArquitetura === 3 && Array.isArray(dep[k].reconciliacoesVersao) && dep[k].reconciliacoesVersao.length === 1), 'RECONCILIAR: as 8 equivalentes foram de 2 para 3');
    afirma(de.every((k) => igual(dep[k], antes[k])), 'RECONCILIAR: as 7 desatualizadas NÃO foram tocadas');
    afirma(at.every((k) => igual(dep[k], antes[k])), 'RECONCILIAR: as 5 atuais NÃO foram tocadas');
    await page.click('#avpReconciliacaoFechar');
    await page.waitForTimeout(200);
    const depoisRec = await itens(page);

    console.log('\n== Segundo passo: agora só REPROCESSAR (13 atuais + 7 desatualizadas) ==');
    afirma(await contar(page, '#avpReconciliarBar') === 0, 'barra de reconciliação sumiu');
    await abrirModal(page, '#avpReprocessarTudoBtn');
    const c2 = await page.locator('#avpLoteResumoContagens li').allInnerTexts();
    afirma(c2.some((t) => /^13 já estão no motor atual$/.test(t)) && c2.some((t) => /^7 precisam ser reprocessadas/.test(t)) && !c2.some((t) => /reconcili/i.test(t)), 'modal: 13 já no motor atual, 7 precisam ser reprocessadas, nada a reconciliar');
    afirma(await contar(page, '#avpReconciliarConfirmar') === 0 && await contar(page, '#avpLoteConfirmar') === 1, 'só o botão de reprocessar');
    await page.click('#avpLoteConfirmar');
    await page.waitForSelector('#avpLoteResumoFinal', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(300);
    const final = await banco(page);
    dep = final['avaliacoes-produto'];
    afirma(de.every((k) => dep[k].motorVersionArquitetura === 3 && !!dep[k].reprocessedAt && dep[k].reprocessedAt !== antes[k].reprocessedAt && dep[k].historicoMotor.length === 2),
      'REPROCESSAR: as 7 foram recalculadas (motorVersionArquitetura 3, reprocessedAt novo, resultado anterior preservado no historicoMotor)');
    afirma(at.concat(eq).every((k) => igual(dep[k], depoisRec[k])), 'REPROCESSAR: as 13 que já estavam atuais não foram tocadas');
    const aud = Object.values(final['motor-arquitetura-auditoria'] || {});
    afirma(aud.length === 8 && aud.every((a) => a.tipo === 'reconciliacao_versao_equivalente'), 'auditoria: só as 8 reconciliações (reprocessar não finge reconciliação, reconciliar não finge reprocessamento)');
    afirma(await contar(page, '.avp-tag-motor--atual') === 20, 'lista: as 20 em "Motor atual"');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  /* ============================================================ */
  console.log('\n== 3. Verificando: enquanto a configuração do motor não chega, nada é "desatualizado" nem oferecido ==');
  {
    const av = Object.assign(lote('eq', 8, 1), lote('at', 2, 2, null, 8));
    const cfg = { versaoPublicada: 2, versoes: { 2: { regras: LEGADO, publicadoEm: '2026-09-30T11:00:00.000Z' } } };
    /* a configuração do motor demora 3,5 s; as avaliações chegam logo */
    const { ctx, page, erros } = await abrirApp(browser, av, cfg, null, { 'motor-arquitetura-config': 3500 });
    const tempoAntes = Date.now();
    afirma(await page.evaluate(() => window.faMotorArquitetura.configCarregada()) === false, 'a configuração do motor ainda NÃO chegou');
    afirma(await contar(page, '.avp-tag-motor--verificando') === 10, '10 avaliações em "Verificando motor…"');
    afirma(await contar(page, '.avp-tag-motor--desatualizado') === 0 && await contar(page, '.avp-tag-motor--atual') === 0 && await contar(page, '.avp-tag-motor--equivalente') === 0,
      'nenhuma rotulada "desatualizada", "atual" ou "equivalente" por falta de dado');
    console.log('        (botão: ' + JSON.stringify(await page.locator('#avpReprocessarTudoBtn').evaluate((b) => ({ d: b.disabled, t: b.textContent })).catch((e) => String(e))) + ')');
    afirma(await page.locator('#avpReprocessarTudoBtn').isDisabled() && /Verificando a versão do motor/.test(await page.locator('#avpReprocessarTudoBtn').textContent()), 'botão de reprocessar desabilitado: "Verificando a versão do motor…"');
    afirma(await contar(page, '#avpReconciliarBar') === 0, 'nenhuma reconciliação oferecida');
    afirma(await contar(page, '.avp-lote-modal-box') === 0, 'nenhum modal de atualização aberto');
    await page.waitForFunction(() => window.faMotorArquitetura.configCarregada(), { timeout: 10000 });
    await page.waitForTimeout(400);
    afirma(await contar(page, '.avp-tag-motor--verificando') === 0 && await contar(page, '.avp-tag-motor--equivalente') === 8 && await contar(page, '.avp-tag-motor--atual') === 2,
      'quando a configuração chega: 8 "Versão anterior equivalente" + 2 "Motor atual" (nunca passou por "desatualizado")');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  /* ============================================================ */
  console.log('\n== 4. Sem prova, sem reconciliação — mesmo que o resultado pareça igual ==');
  {
    const av = Object.assign(
      lote('ok', 1, 1),                                                                /* v1 ≡ v2: pode reconciliar */
      lote('cod', 1, 2, { motorVersion: '2026.08.01-1' }, 1),                          /* lógica em código antiga */
      lote('ver7', 1, 7, null, 2),                                                     /* versão 7 inexistente */
      lote('sem', 1, 2, { motorVersionArquitetura: null }, 3),                         /* sem versão registrada */
      lote('atual', 1, 2, null, 4));
    const cfg = { versaoPublicada: 2, versoes: { 2: { regras: LEGADO, publicadoEm: '2026-09-30T11:00:00.000Z' } } };
    const { ctx, page, erros } = await abrirApp(browser, av, cfg);
    afirma(await contar(page, '.avp-tag-motor--equivalente') === 1 && await contar(page, '.avp-tag-motor--desatualizado') === 3 && await contar(page, '.avp-tag-motor--atual') === 1,
      'badges: 1 equivalente (v1 ≡ v2), 3 desatualizadas (motor em código antigo, versão 7 sem registro, sem versão), 1 atual');
    await abrirModal(page, '#avpReprocessarTudoBtn');
    const motivos = await page.locator('#avpReprocessarMotivos li').allInnerTexts();
    afirma(motivos.length === 3, '3 motivos distintos: ' + JSON.stringify(motivos));
    afirma(motivos.some((t) => /lógica do motor em código diferente \(registrada 2026\.08\.01-1, atual /.test(t)), 'motivo: lógica do motor em código diferente');
    afirma(motivos.some((t) => /versão 7 das regras: não foi possível comprovar equivalência com a atual \(2\) — a versão não está registrada/.test(t)), 'motivo: versão 7 — sem como comprovar (não assume equivalência)');
    afirma(motivos.some((t) => /sem versão das regras registrada/.test(t)), 'motivo: sem versão registrada');
    afirma(await contar(page, '#avpSecaoReconciliar') === 1 && /^RECONCILIAR 1 AVALIAÇÃO$/.test((await page.locator('#avpReconciliarConfirmar').innerText()).trim()), 'só a que tem prova é oferecida para reconciliar (1)');
    afirma(/^REPROCESSAR 3 AVALIAÇÕES$/.test((await page.locator('#avpLoteConfirmar').innerText()).trim()), 'as 3 sem prova só podem ser reprocessadas');
    await page.click('#avpLoteCancelar');
    /* a motorVersionArquitetura ainda pode ser forjada direto, sem prova: a reconciliação recusa */
    const r = await page.evaluate(() => new Promise((ok) => ok(window.faMotorArquitetura.equivalenciaEntreVersoes(7, 2))));
    afirma(r.equivalentes === false && r.motivo === 'versao-indisponivel', 'equivalenciaEntreVersoes(7, 2): não comprovada (' + r.motivo + ')');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  /* ============================================================ */
  console.log('\n== 5. Celular (375 px): modal e reconciliação ==');
  {
    const av = Object.assign(lote('eq', 8, 1), lote('de', 3, 1, null, 8));
    const cfg = { versaoPublicada: 3, versoes: { 2: { regras: V_LOGICA }, 3: { regras: V_EQUIV } } };
    /* 8 na v2 (equivalentes a v3), 3 na v1 (desatualizadas) */
    Object.keys(av).filter((k) => k.startsWith('eq')).forEach((k) => { av[k].motorVersionArquitetura = 2; });
    const { ctx, page, erros } = await abrirApp(browser, av, cfg, { width: 375, height: 740 });
    afirma(await larguraOk(page), 'lista sem rolagem horizontal a 375 px');
    await abrirModal(page, '#avpReconciliarTudoBtn');
    const caixa = await page.locator('.avp-lote-modal-box').boundingBox();
    afirma(caixa && caixa.x >= 0 && caixa.x + caixa.width <= 375, 'modal cabe na largura do celular');
    afirma(await larguraOk(page), 'sem rolagem horizontal com o modal aberto');
    await page.locator('#avpLoteConfirmar').scrollIntoViewIfNeeded();
    afirma(await page.locator('#avpLoteConfirmar').isVisible() && await page.locator('#avpReconciliarConfirmar').isVisible(), 'os dois botões são alcançáveis (rolando o modal)');
    const b1 = await page.locator('#avpReconciliarConfirmar').boundingBox();
    afirma(b1.width > 150 && b1.x >= 0 && b1.x + b1.width <= 375, 'botão com largura de toque confortável');
    await page.click('#avpReconciliarConfirmar');
    await page.waitForSelector('#avpReconciliacaoResumo', { timeout: 10000 }).catch(() => {});
    afirma(/8 avaliações reconciliadas/.test(await page.locator('#avpReconciliacaoResumo').innerText().catch(() => '')), 'celular: 8 reconciliadas');
    afirma(await larguraOk(page), 'resumo sem rolagem horizontal');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  await browser.close();
  console.log(falhas === 0
    ? '\n============================\nOK — reconciliar e reprocessar são operações distintas, cada uma só onde cabe; sem prova (ou sem a configuração carregada) nada é reconciliado nem rotulado "desatualizado".'
    : '\n============================\n' + falhas + ' FALHA(S)');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
