/* NATUREZA COMPLEMENTAR — catálogo resiliente e salvamento sem resposta obsoleta.
 *
 * O que prova (banco falso em persistenciaReal, sem rede, sem segredo; desktop e 375 px):
 *   1. AUTORIZAÇÃO/RELIGAR: o catálogo (naturezas-complementares-config) não é lido por quem não
 *      tem acesso (nenhuma leitura antes do acesso resolvido); entrar com uma conta autorizada liga
 *      a leitura SEM F5; sair desliga; trocar de conta religa — e a resposta atrasada da conta
 *      anterior, que chega depois da troca, é DESCARTADA (não mostra o catálogo de outra sessão).
 *   2. DEMORA: leitura que nunca responde → depois de TEMPO_DEMORA_MS aparece o aviso com
 *      "Tentar novamente" (na avaliação e no catálogo do Admin); tentar de novo carrega.
 *   3. NENHUM OUVINTE ACUMULA: a cada religar/tentar de novo o anterior é desligado — no máximo
 *      UM ouvinte do catálogo ativo (contagem on/off no próprio banco falso).
 *   4. A/B: salvamento A demora a confirmar → a pessoa troca → B confirma → a confirmação de A
 *      chega depois: estado final = B (banco e tela), auditoria com exatamente 2 linhas
 *      (nada → A, A → B), sem duplicata e sem a tela voltar para A.
 *   5. Mesmo valor ainda pendente não é reenviado (evita auditoria duplicada).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const SRC_AVP = fs.readFileSync(path.join(RAIZ, 'avaliacao-produto.js'), 'utf8');
const MOTOR_VERSION = /var MOTOR_VERSION = '([^']+)'/.exec(SRC_AVP)[1];
/* Contador de ouvintes/entregas do catálogo e de confirmações de gravação, embutido no banco
   falso (só observa: repassa tudo ao original). */
const SONDA_BANCO = `
;(function () {
  var C = window.__cat = { on: 0, off: 0, entregas: 0, acks: [] };
  var orig = window.firebase.database;
  window.firebase.database = function () {
    var d = orig.apply(this, arguments), ref0 = d.ref;
    d.ref = function (p) {
      var r = ref0.call(d, p);
      if (String(p || '').indexOf('naturezas-complementares-config') === 0) {
        var on = r.on, off = r.off;
        r.on = function (ev, ok, err) { C.on++; return on.call(r, ev, function (s) { C.entregas++; return ok(s); }, err); };
        r.off = function () { C.off++; return off.apply(r, arguments); };
      }
      var upd = r.update;
      r.update = function (u, cb) {
        return upd.call(r, u, function (e) { C.acks.push({ chaves: Object.keys(u || {}), erro: !!e, t: Date.now() }); if (cb) cb(e); });
      };
      return r;
    };
    return d;
  };
  window.firebase.database.ServerValue = orig.ServerValue;
})();`;
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8') + '\n' + SONDA_BANCO;

const ADMIN_A = 'teste@previ.com.br';
const ADMIN_B = 'outra.admin@previ.com.br';
const SEM_ACESSO = 'sem.acesso@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

const ORDEM = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao',
  'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
function itemBase(nome) {
  const respostas = {};
  ORDEM.forEach((id, i) => { respostas[id] = { valor: id === 'necessidade' ? 'sim' : 'nao', justificativa: '', codigoPergunta: 'P' + (i + 1), questionnaireContentVersion: 1 }; });
  return {
    itemId: 'item', nome: nome, descricao: '', respostas: respostas, status: 'concluido',
    resultadoAutomatico: 'nao-produto', decisaoFinal: 'nao-produto', decisaoManual: false,
    camadaSugerida: { id: 'canal', label: 'Canal', motivos: ['m'] },
    criteriosEssenciaisFalhos: ['resultado'], exclusoesConflitantes: null, criteriosAtendidos: 1,
    motorVersion: MOTOR_VERSION, motorVersionArquitetura: 1, questionnaireContentVersion: 1,
    criadoEm: '2026-09-29T10:00:00.000Z', atualizadoEm: '2026-09-29T10:00:00.000Z',
    responsavel: { name: 'Teste', email: ADMIN_A }, versao: 1, versaoAnteriorKey: null, excluido: false
  };
}

async function abrirApp(browser, opts) {
  const admins = {}; admins[chave(ADMIN_A)] = { email: ADMIN_A }; admins[chave(ADMIN_B)] = { email: ADMIN_B };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {},
    'turmas-checkin': {}, 'turmas-espera': {}, 'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {},
    eventos: {}, 'turmas-publico': {}, 'eventos-publico': {}, 'avaliacoes-produto': { item: itemBase('Item da prova') },
    'avaliacoes-squad': {}, 'motor-squad-config': {}, 'motor-squad-auditoria': {}, 'motor-arquitetura-auditoria': {} };
  const cfg = { db: db, user: { email: opts.email, emailVerified: true, uid: 'u-' + chave(opts.email) }, delayDefault: 10,
    persistenciaReal: true, delays: opts.delays || {}, authDelay: opts.authDelay || 0 };
  const ctx = await browser.newContext({ viewport: opts.viewport });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#' + (opts.rota || 'avaliacoes'), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.faAuth && window.faNaturezas && window.__cat, null, { timeout: 16000 });
  return { ctx, page, erros };
}
const cat = (page) => page.evaluate(() => ({ estado: window.faNaturezas.estado(), demorando: window.faNaturezas.demorando(),
  on: window.__cat.on, off: window.__cat.off, entregas: window.__cat.entregas, ativos: window.__cat.on - window.__cat.off }));
const acessoResolvido = (page) => page.waitForFunction(() => window.faAuth.isAvaliacaoReady && window.faAuth.isAvaliacaoReady(), null, { timeout: 16000 });
const entrar = (page, email) => page.evaluate((e) => window.firebase.auth().signInWithEmailAndPassword(e, 'x'), email);
const sair = (page) => page.evaluate(() => window.firebase.auth().signOut());
const definirAtraso = (page, ms) => page.evaluate((v) => { window.__CFG.delays = Object.assign({}, window.__CFG.delays, { 'naturezas-complementares-config': v }); }, ms);
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function abrirResultado(page) {
  await page.waitForSelector('.avp-act-ver[data-key="item"]', { timeout: 10000 });
  await page.click('.avp-act-ver[data-key="item"]');
  await page.waitForSelector('#avpNaturezaBloco', { timeout: 8000 });
}

async function rodada(browser, viewport, rotulo) {
  console.log('\n== ' + rotulo + ' ==');

  /* ---------------- 1 + 3: autorização, religar sem F5, troca de conta, nada acumula ---------------- */
  {
    const { ctx, page, erros } = await abrirApp(browser, { email: SEM_ACESSO, viewport });
    await acessoResolvido(page);
    let c = await cat(page);
    afirma(c.on === 0 && c.estado !== 'erro', 'sem acesso (aberto em #avaliacoes): nenhuma leitura do catálogo e nenhum "erro" (' + JSON.stringify(c) + ')');

    /* fluxo real, sem F5: entra com conta autorizada e abre a Avaliação pelo menu (o link do menu é
       só a rota #avaliacoes — o roteador sobe a tela e a tela pede o catálogo) */
    await entrar(page, ADMIN_A);
    await acessoResolvido(page);
    await page.waitForFunction(() => window.faAuth.podeAvaliacao(), null, { timeout: 10000 });
    await page.evaluate(() => { location.hash = '#avaliacoes'; });
    await abrirResultado(page);
    await page.waitForFunction(() => !document.querySelector('#avpNaturezaComplementar').disabled, null, { timeout: 10000 });
    c = await cat(page);
    afirma(c.estado === 'ok' && c.on === 1 && c.ativos === 1, 'entrou com conta autorizada e abriu a Avaliação: catálogo carregado SEM F5, com UMA leitura (' + JSON.stringify(c) + ')');
    afirma(!(await page.locator('#avpNaturezaComplementar').isDisabled()), 'o seletor da natureza fica utilizável');
    await page.evaluate(() => { location.hash = '#home'; });

    await sair(page);
    await page.waitForFunction(() => window.faNaturezas.estado() !== 'ok', null, { timeout: 10000 });
    c = await cat(page);
    afirma(c.ativos === 0 && c.estado === 'carregando', 'saiu: a leitura é desligada (0 ouvintes ativos) e o catálogo deixa de valer (' + JSON.stringify(c) + ')');

    /* troca de conta com a resposta da conta anterior chegando DEPOIS da troca */
    await definirAtraso(page, 1500);
    await entrar(page, ADMIN_A);
    await page.waitForFunction(() => window.__cat.on === 2, null, { timeout: 10000 });
    const entregasAntes = (await cat(page)).entregas;
    await definirAtraso(page, 4000);
    await entrar(page, ADMIN_B);
    await page.waitForFunction(() => window.__cat.on >= 3, null, { timeout: 10000 });
    await page.waitForFunction((n) => window.__cat.entregas > n, entregasAntes, { timeout: 10000 }); /* chegou a resposta de A */
    c = await cat(page);
    afirma(c.estado === 'carregando', 'troca de conta: a resposta atrasada da conta ANTERIOR chegou e foi descartada (estado ' + c.estado + ')');
    await page.waitForFunction(() => window.faNaturezas.estado() === 'ok', null, { timeout: 10000 });
    c = await cat(page);
    afirma(c.ativos === 1, 'troca de conta: catálogo da conta nova carregado, ainda com 1 ouvinte ativo (' + JSON.stringify(c) + ')');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  /* ---------------- 1: nenhuma leitura antes de o acesso estar resolvido (login lento) ---------------- */
  {
    const { ctx, page, erros } = await abrirApp(browser, { email: ADMIN_A, viewport, authDelay: 1500 });
    const cedo = await page.evaluate(() => ({ pronto: window.faAuth.isAvaliacaoReady(), on: window.__cat.on }));
    await page.evaluate(() => { window.__cedo = false; window.__vigia = setInterval(function () { if (!window.faAuth.isAvaliacaoReady() && window.__cat.on > 0) window.__cedo = true; }, 5); });
    await page.waitForFunction(() => window.faNaturezas.estado() === 'ok', null, { timeout: 12000 });
    const c = await cat(page);
    afirma(!cedo.pronto && cedo.on === 0 && !(await page.evaluate(() => window.__cedo)) && c.on === 1,
      'login lento: nenhuma leitura do catálogo enquanto o acesso não está resolvido; depois, uma só (' + JSON.stringify(c) + ')');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  /* ---------------- 2 + 3: nunca responde → aviso + Tentar novamente (avaliação) ---------------- */
  {
    const { ctx, page, erros } = await abrirApp(browser, { email: ADMIN_A, viewport, delays: { 'naturezas-complementares-config': 10000000 } });
    await acessoResolvido(page);
    await abrirResultado(page);
    afirma(await page.locator('#avpNaturezaComplementar').isDisabled(), 'catálogo ainda não chegou: seletor desabilitado');
    const t0 = Date.now();
    await page.waitForSelector('#avpNaturezaTentarNovamente', { timeout: 20000 });
    const ms = Date.now() - t0;
    const tempo = await page.evaluate(() => window.faNaturezas.TEMPO_DEMORA_MS);
    afirma(/demorando para carregar/.test(await page.locator('#avpNaturezaBloco').innerText()), 'leitura que nunca responde: aviso de demora com "Tentar novamente" (apareceu em ~' + Math.round(ms / 1000) + ' s; limite ' + tempo / 1000 + ' s)');
    afirma(await page.locator('#avpSalvarNaturezaBtn').isDisabled(), 'e continua sem permitir salvar (nunca uma lista inventada)');
    const caixa = await page.locator('#avpNaturezaTentarNovamente').boundingBox();
    afirma(caixa && caixa.x >= 0 && caixa.x + caixa.width <= viewport.width && await larguraOk(page), '"Tentar novamente" cabe na tela, sem rolagem horizontal');
    await definirAtraso(page, 50);
    await page.click('#avpNaturezaTentarNovamente');
    await page.waitForFunction(() => !document.querySelector('#avpNaturezaComplementar').disabled, null, { timeout: 8000 });
    const c = await cat(page);
    afirma(c.estado === 'ok' && c.on === 2 && c.ativos === 1, 'Tentar novamente: carregou, e a leitura antiga foi desligada (2 ligadas, 1 ativa) (' + JSON.stringify(c) + ')');
    afirma(!(await page.locator('#avpNaturezaTentarNovamente').count()), 'o aviso sai quando o catálogo chega');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  /* ---------------- 2: o mesmo aviso no catálogo do Admin ---------------- */
  {
    const { ctx, page, erros } = await abrirApp(browser, { email: ADMIN_A, viewport, rota: 'admin', delays: { 'naturezas-complementares-config': 10000000 } });
    await acessoResolvido(page);
    await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelArquitetura"]', { timeout: 10000 });
    await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
    await page.waitForSelector('#avpConfigNaturezasBtn', { timeout: 10000 });
    await page.click('#avpConfigNaturezasBtn');
    await page.waitForSelector('#avpNaturezasTentarNovamente', { timeout: 20000 });
    afirma(await page.locator('#avpNaturezaNova').count() === 0, 'catálogo do Admin sem resposta: aviso com "Tentar novamente" e nenhum botão de editar/criar');
    /* várias tentativas seguidas com a rede ainda travada (nenhuma responde)... */
    for (let i = 0; i < 3; i++) await page.evaluate(() => window.faNaturezas.recarregar());
    afirma((await cat(page)).ativos === 1, 'tentativas seguidas sem resposta: cada uma desliga a anterior (1 ouvinte ativo)');
    /* ...e a última, pelo botão, já com a rede respondendo */
    await definirAtraso(page, 50);
    await page.click('#avpNaturezasTentarNovamente');
    await page.waitForSelector('#avpNaturezaNova', { timeout: 8000 });
    const c = await cat(page);
    afirma(c.ativos === 1, 'várias tentativas seguidas não acumulam ouvintes (' + c.on + ' ligadas, ' + c.ativos + ' ativa)');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  /* ---------------- 4 + 5: A/B — confirmação antiga chegando depois ---------------- */
  {
    const { ctx, page, erros } = await abrirApp(browser, { email: ADMIN_A, viewport });
    await acessoResolvido(page);
    await abrirResultado(page);
    await page.waitForFunction(() => !document.querySelector('#avpNaturezaComplementar').disabled, null, { timeout: 8000 });
    await page.evaluate(() => { window.__CFG.atrasoConfirmacao = { 'avaliacoes-produto': 2500 }; });
    await page.selectOption('#avpNaturezaComplementar', 'PROGRAMA_TRANSVERSAL');
    await page.click('#avpSalvarNaturezaBtn');                                   /* A — confirmação atrasada */
    await page.waitForFunction(() => (window.__CFG.__dbReal['avaliacoes-produto'].item || {}).naturezaComplementarCodigo === 'PROGRAMA_TRANSVERSAL', null, { timeout: 5000 });
    afirma((await page.evaluate(() => window.__cat.acks.length)) === 0, 'A foi aplicado no banco, mas a confirmação ainda não chegou');

    /* 5: mesmo valor ainda pendente não é reenviado */
    const escritasAntes = await page.evaluate(() => (window.__ESCRITAS || []).length);
    if (!(await page.locator('#avpSalvarNaturezaBtn').isDisabled())) {
      await page.click('#avpSalvarNaturezaBtn');
      afirma(/aguarda a confirmação/.test(await page.locator('#avpNaturezaBloco').innerText()) &&
        (await page.evaluate(() => (window.__ESCRITAS || []).length)) === escritasAntes, 'reenviar o MESMO valor ainda pendente: recusado com aviso, sem nova gravação');
    } else {
      afirma(true, 'reenviar o MESMO valor ainda pendente: o botão nem fica disponível');
    }

    await page.evaluate(() => { window.__CFG.atrasoConfirmacao = {}; });
    await page.selectOption('#avpNaturezaComplementar', 'PLATAFORMA_BENEFICIOS_PARCERIAS');
    await page.click('#avpSalvarNaturezaBtn');                                   /* B — confirma na hora */
    await page.waitForFunction(() => window.__cat.acks.length >= 1, null, { timeout: 5000 });
    await page.waitForFunction(() => window.__cat.acks.length >= 2, null, { timeout: 8000 }); /* chega a confirmação de A, por último */
    const d = await banco(page);
    const it = d['avaliacoes-produto'].item;
    const aud = Object.values((d['naturezas-complementares-auditoria'] || {}).item || {}).sort((x, y) => String(x.dataHora).localeCompare(String(y.dataHora)));
    afirma(it.naturezaComplementarCodigo === 'PLATAFORMA_BENEFICIOS_PARCERIAS', 'banco: estado final = B');
    /* o Realtime Database não guarda null: "sem valor anterior" é o campo AUSENTE (persistenciaReal imita) */
    afirma(aud.length === 2 && aud[0].valorAnterior === undefined && aud[0].valorNovo.codigo === 'PROGRAMA_TRANSVERSAL' &&
      aud[1].valorAnterior && aud[1].valorAnterior.codigo === 'PROGRAMA_TRANSVERSAL' && aud[1].valorNovo.codigo === 'PLATAFORMA_BENEFICIOS_PARCERIAS',
      'auditoria: exatamente 2 linhas (nada → A, A → B), sem duplicata (' + aud.length + ')');
    afirma(await page.locator('#avpNaturezaComplementar').inputValue() === 'PLATAFORMA_BENEFICIOS_PARCERIAS', 'tela: depois da confirmação atrasada de A, o seletor continua em B');
    const texto = await page.locator('#avpNaturezaBloco').innerText();
    afirma(!/Não foi possível salvar/.test(texto) && /Plataforma\/estrutura de benefícios e parcerias/.test(texto), 'tela: sem erro e mostrando B');
    afirma(await larguraOk(page), 'sem rolagem horizontal');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }
}

(async () => {
  const browser = await chromium.launch();
  await rodada(browser, { width: 1280, height: 900 }, 'DESKTOP (1280 px)');
  await rodada(browser, { width: 375, height: 740 }, 'CELULAR (375 px)');
  await browser.close();
  if (falhas) { console.log('\n' + falhas + ' FALHA(S)'); process.exit(1); }
  console.log('\nOK — catálogo de naturezas: lê só com acesso, religa sem F5, descarta resposta de outra sessão, avisa a demora com "Tentar novamente", não acumula ouvintes; salvamento A/B termina em B sem auditoria duplicada.');
})().catch((e) => { console.error(e); process.exit(1); });
