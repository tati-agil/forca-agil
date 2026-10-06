/* NAVEGAÇÃO DA AVALIAÇÃO — a URL é a fonte de verdade do que está na tela, e o histórico do navegador
 * guarda o contexto de origem para o "Voltar". Provado em desktop e celular 375 px:
 *   URLs: #avaliacoes (lista) · ?avp=<chave> (avaliação, vigente ou anterior) · ?nova=1 ·
 *         ?editar=<chave> (rascunho) · ?reavaliar=<chave> (reavaliação da versão de origem)
 *   - tela e URL nunca divergem (inclusive depois de Voltar/Avançar do navegador);
 *   - nenhum laço: avaliação → "← Voltar" → lista → Voltar do navegador NÃO reabre a avaliação;
 *   - Voltar sem alteração sai direto; com alteração pergunta ("Descartar alterações" / "Continuar editando"),
 *     também no Voltar do navegador; F5 só avisa (beforeunload) se houver alteração não salva;
 *   - descartar uma reavaliação volta à avaliação de origem; concluir SUBSTITUI a entrada do histórico
 *     (o Voltar do navegador não reabre o checklist encerrado);
 *   - F5 em cada estado restaura o estado da URL ou cai num estado válido; URLs inválidas caem de forma controlada;
 *   - o texto do Voltar diz o destino ("← Voltar para avaliações" / "← Voltar para a avaliação (vN)").
 * Hermético: sem rede, sem segredo. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarCondicaoAte } = require('./esperas');
const vm = require('vm');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const SRC_AVP = fs.readFileSync(path.join(RAIZ, 'avaliacao-produto.js'), 'utf8');
const MOTOR_VERSION = /var MOTOR_VERSION = '([^']+)'/.exec(SRC_AVP)[1];
const EMAIL = 'teste@previ.com.br';
const KEY = EMAIL.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

const ORDEM = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao',
  'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
const CODIGO = {}; ORDEM.forEach((id, i) => { CODIGO[id] = 'P' + (i + 1); });
const respostasDe = (m) => { const r = {}; ORDEM.forEach((id, i) => { r[id] = { valor: (m >> i) & 1 ? 'sim' : 'nao' }; }); return r; };

/* Usa o código REAL para achar, entre as 65.536 combinações, respostas que dão cada camada */
function carregarCodigo() {
  const ctx = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, setTimeout, clearTimeout, setInterval, clearInterval, parseFloat, parseInt, isNaN };
  ctx.window = ctx; ctx.window.window = ctx;
  const el = () => ({ addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, style: {}, classList: { add() {}, remove() {}, contains() { return false; } } });
  ctx.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {}, body: el(), documentElement: el() };
  ctx.firebase = { database: () => ({ ref: () => ({ on() {}, once() {}, update() {}, child() { return this; }, push() { return { key: 'k' }; } }) }) };
  ctx.navigator = {}; ctx.location = { hash: '' }; ctx.localStorage = { getItem() { return null; }, setItem() {} };
  vm.createContext(ctx);
  for (const f of ['questionarios-config.js', 'motor-arquitetura.js']) vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), ctx, { filename: f });
  const fim = SRC_AVP.lastIndexOf('})();');
  const src = SRC_AVP.slice(0, fim) + '\nwindow.__avpTeste = { computeResultado: computeResultado, gerarJustificativaAutomatica: gerarJustificativaAutomatica };\n' + SRC_AVP.slice(fim);
  vm.runInContext(src, ctx, { filename: 'avaliacao-produto.js' });
  return ctx.__avpTeste;
}
const av = carregarCodigo();
/* Primeira combinação de respostas que dá a camada pedida (e, se pedido, que satisfaz `serve`). */
function acharCamada(id, serve) {
  for (let m = 0; m < 65536; m++) {
    const c = av.computeResultado({ respostas: respostasDe(m) });
    if (c.camadaSugerida.id === id && (!serve || serve(c))) return { m, c };
  }
  throw new Error('nenhuma combinação dá ' + id);
}

/* `cad` = { especializacaoCadastrada, papelEstruturalCadastrado } — o cálculo usa o PRÓPRIO motor, como o app. */
function itemDe(nome, camadaId, extra, cad, serve) {
  const { m } = acharCamada(camadaId, serve);
  const respostas = respostasDe(m);
  const c = av.computeResultado(Object.assign({ respostas: respostas }, cad || {}));
  ORDEM.forEach((id) => { Object.assign(respostas[id], { justificativaAuto: 'interpretação', observacao: '', codigoPergunta: CODIGO[id], textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 }); });
  return Object.assign({
    nome: nome, descricao: '', publico: '', necessidade: '', observacoesGerais: '',
    status: 'concluido', respostas: respostas,
    resultadoAutomatico: c.resultadoAutomatico, decisaoFinal: c.resultadoAutomatico, decisaoManual: false, decisaoConfirmada: false,
    camadaSugerida: JSON.parse(JSON.stringify(c.camadaSugerida)),
    justificativaAutomatica: 'justificativa gerada', criteriosEssenciaisFalhos: [], exclusoesConflitantes: null, criteriosAtendidos: 5,
    motorVersion: MOTOR_VERSION, motorVersionArquitetura: 1, questionnaireContentVersion: 1,
    criadoEm: '2026-09-29T10:00:00.000Z', atualizadoEm: '2026-09-29T10:00:00.000Z',
    responsavel: { name: 'Teste', email: EMAIL }, versao: 1, versaoAnteriorKey: null, excluido: false, itemId: nome
  }, cad || {}, extra || {});
}
const CAD = { especializacaoCadastrada: 'Instituto previdenciário', papelEstruturalCadastrado: 'essencial' };
const ESP = 'Instituto previdenciário';
const ESP_DERIVADA = 'Opção/configuração de personalização';
const SV = 'sem-vinculo';
const CAMPOS_ID = { descricao: 'Descrição longa do item de teste.', publico: 'Público de teste', necessidade: 'Necessidade de teste', observacoesGerais: 'Observação de teste' };
const AVALIACOES = () => ({
  /* Componente com cadastro VIGENTE (legado, sem marcador) */
  cadx: itemDe('Item Cadastrado', 'componente', CAMPOS_ID, CAD),
  /* Componente só com especialização DERIVADA */
  der: itemDe('Item Derivado', 'componente', CAMPOS_ID, null, (c) => c.camadaSugerida.especializacao === ESP_DERIVADA),
  /* estados do #273 */
  rev: itemDe('Item Revisao', 'componente', null, Object.assign({}, CAD, { especializacaoCamadaConfirmada: SV, papelEstruturalCamadaConfirmada: SV })),
  cana: itemDe('Item Canal Antigo', 'canal', null, CAD),
  uva: itemDe('Item UVA', 'unidade-valor-associada', null, CAD),
  /* decisão MANUAL */
  man: itemDe('Item Manual', 'componente', null, null, null),
  /* par v1 → v2 */
  v1: itemDe('Item Par', 'componente', { itemId: 'par' }),
  v2: itemDe('Item Par', 'componente', { itemId: 'par', versao: 2, versaoAnteriorKey: 'v1', criadoEm: '2026-09-30T09:00:00.000Z', atualizadoEm: '2026-09-30T09:00:00.000Z' }),
});
(function () {
  const a = AVALIACOES();
  Object.assign(a.man, { decisaoManual: true, decisaoFinal: 'produto', decisaoConfirmada: true, justificativaDecisao: 'Decidido por pessoa.', alteradoPor: { name: 'Fulana', email: 'f@previ.com.br' }, alteradoEm: '2026-09-30T10:00:00.000Z' });
  if (a.der.camadaSugerida.especializacao !== ESP_DERIVADA) throw new Error('fixture "der" inválida');
  if (a.man.resultadoAutomatico === 'produto') throw new Error('fixture "man" inválida');
})();
const AV = () => { const a = AVALIACOES(); Object.assign(a.man, { decisaoManual: true, decisaoFinal: 'produto', decisaoConfirmada: true, justificativaDecisao: 'Decidido por pessoa.', alteradoPor: { name: 'Fulana', email: 'f@previ.com.br' }, alteradoEm: '2026-09-30T10:00:00.000Z' }); return a; };

async function abrir(browser, o) {
  o = o || {};
  const admins = {}; admins[KEY] = { email: EMAIL };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {},
    'turmas-checkin': {}, 'turmas-espera': {}, 'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {},
    eventos: {}, 'turmas-publico': {}, 'eventos-publico': {}, 'avaliacoes-produto': o.avaliacoes || AVALIACOES(), 'avaliacoes-squad': {},
    'motor-squad-config': {}, 'motor-squad-auditoria': {}, 'motor-arquitetura-auditoria': {} };
  const cfg = { db: db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true, fail: o.fail, delays: o.delays };
  const ctx = await browser.newContext({ viewport: o.viewport || DESKTOP, acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await ctx.addInitScript(`
    window.__pdfs = [];
    new MutationObserver(function (ms) {
      ms.forEach(function (m) { m.addedNodes.forEach(function (n) {
        if (n.nodeType !== 1 || n.parentNode !== document.body) return;
        var doc = n.classList && n.classList.contains('pdf-doc') ? n : (n.querySelector && n.querySelector('.pdf-doc'));
        if (!doc) return;
        window.__pdfs.push({ tudo: doc.innerText });
      }); });
    }).observe(document, { childList: true, subtree: true });`);
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#avaliacoes', { waitUntil: 'domcontentloaded' });
  /* Pronta = login decidido, admin e acesso à Avaliação resolvidos e a lista desenhada. Antes: espera do
     login com as opções no lugar do argumento (limite real 30 s), engolida, + 800 ms fixos; medido, a
     condição já valia nas 40 aberturas quando os 800 ms começavam. */
  await esperarCondicao(page, () => !document.body.classList.contains('aguardando-auth') && !!document.getElementById('avpNovoBtn') &&
    !!(window.faAuth && faAuth.isAdminReady() && faAuth.isAvaliacaoReady()), null, { limite: 16000, descricao: 'login decidido e lista da Avaliação desenhada' });
  return { ctx, page, erros };
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const AVN = () => { const a = AV(); a.rasc = Object.assign(itemDe('Item Rascunho', 'canal'), { status: 'rascunho', resultadoAutomatico: null, decisaoFinal: null, camadaSugerida: null, justificativaAutomatica: null, criteriosAtendidos: null }); return a; };
const tela = (page) => page.evaluate(() => {
  const q = (s) => !!document.querySelector(s);
  if (q('.avp-historico-box')) return 'modal-histórico';
  if (q('#avpCabecalhoFicha')) return q('#avpAvisoVersaoAnterior') ? 'avaliação-anterior' : 'avaliação';
  if (q('#avpConcluirBtn')) return 'checklist';
  if (q('#avpIniciarBtn')) return 'form-inicial';
  if (q('#avpNovoBtn')) return 'lista';
  if (q('#avpVoltarNaoEncontrada')) return 'não-encontrada';
  if (q('#avpRecarregarTravado')) return 'travado';
  return '?';
});
/* só os modais DESTA tela (o site tem outros .modal-box escondidos, como o de login) */
const MODAL = '.modal-overlay:has(.avp-modal-confirm-btn) .modal-box';
const hashDe = (page) => page.evaluate(() => location.hash);
/* o que a URL promete (independente do que o código decidiu mostrar) */
const promessa = (h) => {
  const m = /^#avaliacoes(?:\?(.*))?$/.exec(h || '');
  if (!m) return 'fora';
  const p = new URLSearchParams(m[1] || '');
  if (p.get('avp')) return 'avaliação';
  if (p.get('reavaliar') || p.get('editar')) return 'checklist';
  if (p.get('nova')) return 'form-inicial|checklist';
  return 'lista';
};
/* A mesma regra de coerência, avaliada dentro da página (para esperar por ela). */
function coerenteNaPagina() {
  const q = (s) => !!document.querySelector(s);
  const t = q('.avp-historico-box') ? 'modal-histórico' : q('#avpCabecalhoFicha') ? (q('#avpAvisoVersaoAnterior') ? 'avaliação-anterior' : 'avaliação') :
    q('#avpConcluirBtn') ? 'checklist' : q('#avpIniciarBtn') ? 'form-inicial' : q('#avpNovoBtn') ? 'lista' : q('#avpVoltarNaoEncontrada') ? 'não-encontrada' : q('#avpRecarregarTravado') ? 'travado' : '?';
  const m = /^#avaliacoes(?:\?(.*))?$/.exec(location.hash || '');
  if (!m) return true;
  const ps = new URLSearchParams(m[1] || '');
  const p = ps.get('avp') ? 'avaliação' : (ps.get('reavaliar') || ps.get('editar')) ? 'checklist' : ps.get('nova') ? 'form-inicial|checklist' : 'lista';
  return (t === 'não-encontrada' && /avaliação|checklist/.test(p)) || p.split('|').some((x) => t === x || (x === 'avaliação' && t === 'avaliação-anterior') || (x === 'lista' && t === 'modal-histórico'));
}
/* Tela compatível com a URL. Antes: 350 ms fixos antes de conferir (72 vezes por execução); medido, a
   URL e a tela já estavam no estado final em todas. Agora espera a coerência (até 4 s) e confere; se
   não chegar, a asserção abaixo falha com URL e tela. */
async function coerente(page, rotulo) {
  await esperarCondicaoAte(page, coerenteNaPagina, null, { limite: 4000 });
  const h = await hashDe(page), t = await tela(page), p = promessa(h);
  const ok = p === 'fora' || (t === 'não-encontrada' && /avaliação|checklist/.test(p)) || p.split('|').some((x) => t === x || (x === 'avaliação' && t === 'avaliação-anterior') || (x === 'lista' && t === 'modal-histórico'));
  afirma(ok, rotulo + ' — URL ' + h + ' × tela "' + t + '"');
  return { h, t };
}
const comprimento = (page) => page.evaluate(() => history.length);
function telaNaPagina(alvo) {
  const q = (s) => !!document.querySelector(s);
  const atual = q('#avpCabecalhoFicha') ? (q('#avpAvisoVersaoAnterior') ? 'avaliação-anterior' : 'avaliação') : q('#avpConcluirBtn') ? 'checklist' : q('#avpIniciarBtn') ? 'form-inicial' : q('#avpNovoBtn') ? 'lista' : q('#avpVoltarNaoEncontrada') ? 'não-encontrada' : '?';
  return alvo.split('|').indexOf(atual) !== -1;
}
/* Estrita: se a tela esperada não aparece, o passo FALHA dizendo qual era (antes devolvia false e quase
   nenhum chamador olhava — o atraso de 4 s passava calado e a culpa caía na asserção seguinte). */
const esperaTela = (page, t, ms) => esperarCondicao(page, telaNaPagina, t, { limite: ms || 4000, descricao: 'a tela "' + t + '"' });
/* O modal de descarte desta tela: aparecer e sumir são condições, não tempos. */
const modalAbre = (page) => esperarCondicao(page, (sel) => !!document.querySelector(sel), MODAL, { limite: 4000, descricao: 'a pergunta de descarte abrir' });
const modalFecha = (page) => esperarCondicao(page, (sel) => !document.querySelector(sel), MODAL, { limite: 4000, descricao: 'a pergunta de descarte fechar' });
/* Ausência por desenho, com janela EXPLÍCITA: depois do Voltar do navegador, nada pode reabrir o estado
   proibido durante 700 ms (a mesma janela de antes, agora nomeada e com a condição dita). A navegação em
   si já terminou quando o goBack resolve (medido: o estado final já está lá logo depois dele). */
async function nadaReabreEm700ms(page, proibido, motivo) {
  const reabriu = await esperarCondicaoAte(page, (re) => new RegExp(re).test(location.hash), proibido.source, { limite: 700 });
  afirma(!reabriu, motivo + ' — URL ' + await hashDe(page));
}
const textoDe = (page, sel) => page.locator(sel).first().innerText().catch(() => '');
async function passo(nome, fn) { try { await fn(); } catch (e) { afirma(false, nome + ' — exceção: ' + String(e.message || e).split('\n')[0]); } }
/* Erros de JS de TODAS as páginas abertas (antes só os do passo N1 eram conferidos no fim; os de
   N2–N13 só iam para o log). */
const errosDeTodasAsPaginas = [];
/* abre a página já com uma entrada anterior (#home) para detectar laços ao apertar Voltar do navegador.
   telaEsperada: a tela em que a URL deve cair. Sem ela, deduz pelo formato do hash — o que NÃO serve
   para as URLs que o produto corrige de propósito (?editar= de uma avaliação concluída abre a
   avaliação etc., passo N13): antes a espera estourava calada 8 s nesses casos. Agora, se a tela
   esperada não aparece, o passo falha. */
async function novaPagina(browser, viewport, hash, telaEsperada) {
  const r = await abrir(browser, { viewport, avaliacoes: AVN() });
  errosDeTodasAsPaginas.push(r.erros);
  await r.page.goto(BASE + '/index.html#home', { waitUntil: 'domcontentloaded' });
  /* a entrada #home precisa existir no histórico antes de ir à Avaliação (antes: 500 ms fixos) */
  await esperarCondicao(r.page, () => !!(window.faRouter && faRouter.current() === 'home') && location.hash === '#home', null, { descricao: 'a página #home aberta' });
  await r.page.goto(BASE + '/index.html' + (hash || '#avaliacoes'), { waitUntil: 'domcontentloaded' });
  const alvo = telaEsperada || (hash && /avp=/.test(hash) ? 'avaliação|avaliação-anterior|não-encontrada' : 'lista|checklist|form-inicial');
  if (!(await esperarCondicaoAte(r.page, telaNaPagina, alvo, { limite: 8000 }))) throw new Error('a URL ' + (hash || '#avaliacoes') + ' não caiu na tela esperada (' + alvo + ') em 8 s — está em "' + (await tela(r.page)) + '"');
  /* antes: mais 600 ms fixos; medido, tela e URL não mudavam neles em nenhuma das 40 aberturas */
  return r;
}
const abrirDaLista = async (page, key) => { await page.click('.avp-act-ver[data-key="' + key + '"]'); await esperaTela(page, 'avaliação|avaliação-anterior'); };

(async () => {
  const browser = await chromium.launch();
  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const erros = [];

    await passo('N1', async () => {
      console.log('\n== 1. Lista → avaliação → "← Voltar": sem laço no histórico ==');
      const r = await novaPagina(browser, viewport); const page = r.page; page.on('pageerror', (e) => erros.push(String(e)));
      await abrirDaLista(page, 'cadx');
      let c = await coerente(page, 'avaliação aberta'); afirma(c.h === '#avaliacoes?avp=cadx', 'a URL representa a avaliação');
      const len = await comprimento(page);
      afirma(/^← Voltar para avaliações$/i.test((await textoDe(page, '#avpVoltarListaResultado')).trim()) && /^← Voltar para avaliações$/i.test((await textoDe(page, '#avpVoltarListaRodape')).trim()), 'o texto do Voltar (topo e rodapé) diz o destino: avaliações');
      await page.click('#avpVoltarListaResultado'); await esperaTela(page, 'lista');
      c = await coerente(page, 'depois do "← Voltar"'); afirma(c.t === 'lista' && c.h === '#avaliacoes', 'voltou à lista');
      afirma(await comprimento(page) <= len, 'o "← Voltar" não empilhou uma entrada nova no histórico (' + await comprimento(page) + ' ≤ ' + len + ')');
      await page.goBack();
      afirma(!/avp=/.test(await hashDe(page)) && (await tela(page)) !== 'avaliação', 'Voltar do navegador na lista NÃO reabre a avaliação (sem laço) — URL ' + await hashDe(page));
      await nadaReabreEm700ms(page, /avp=/, 'e nada reabre a avaliação depois');
      /* o do rodapé faz exatamente o mesmo */
      await page.goForward(); await esperaTela(page, 'lista|avaliação'); await esperarCondicao(page, coerenteNaPagina, null, { descricao: 'tela compatível com a URL depois do Avançar' });
      if ((await tela(page)) !== 'avaliação') await abrirDaLista(page, 'cadx');
      const len2 = await comprimento(page);
      await page.click('#avpVoltarListaRodape'); await esperaTela(page, 'lista');
      afirma((await tela(page)) === 'lista' && await comprimento(page) <= len2, 'o "← Voltar" do rodapé faz o mesmo (lista, sem empilhar)');
      await r.ctx.close();
    });

    await passo('N2', async () => {
      console.log('\n== 2. Lista → avaliação → Voltar/Avançar do navegador ==');
      const r = await novaPagina(browser, viewport); const page = r.page;
      await abrirDaLista(page, 'cadx');
      await page.goBack(); await esperaTela(page, 'lista'); let c = await coerente(page, 'Voltar do navegador'); afirma(c.t === 'lista', 'volta à lista');
      await page.goForward(); await esperaTela(page, 'avaliação'); c = await coerente(page, 'Avançar'); afirma(c.t === 'avaliação' && c.h === '#avaliacoes?avp=cadx', 'avança à avaliação');
      await r.ctx.close();
    });

    await passo('N3', async () => {
      console.log('\n== 3. Avaliação → Reavaliar: a URL representa a reavaliação ==');
      const r = await novaPagina(browser, viewport); const page = r.page;
      await abrirDaLista(page, 'cadx');
      await page.click('#avpReavaliarBtn'); await esperaTela(page, 'checklist');
      let c = await coerente(page, 'depois de Reavaliar'); afirma(c.h === '#avaliacoes?reavaliar=cadx', 'a URL é a da reavaliação de cadx (não a da lista nem a da avaliação)');
      afirma(/^← Voltar para a avaliação \(v1\)$/i.test((await textoDe(page, '#avpVoltarLista')).trim()), 'o Voltar diz o destino: "← Voltar para a avaliação (v1)"');
      await page.goBack(); await esperaTela(page, 'avaliação'); c = await coerente(page, 'Voltar do navegador na reavaliação'); afirma(c.t === 'avaliação' && c.h === '#avaliacoes?avp=cadx', 'o Voltar do navegador leva à avaliação de origem, com URL e tela iguais');
      await page.goForward(); await esperaTela(page, 'checklist'); c = await coerente(page, 'Avançar'); afirma(c.t === 'checklist' && c.h === '#avaliacoes?reavaliar=cadx', 'Avançar reconstrói a reavaliação');
      afirma(await larguraOk(page), 'sem rolagem horizontal');
      await r.ctx.close();
    });

    await passo('N4', async () => {
      console.log('\n== 4. Reavaliar → Voltar SEM alteração: sai direto ==');
      const r = await novaPagina(browser, viewport); const page = r.page;
      await abrirDaLista(page, 'cadx');
      await page.click('#avpReavaliarBtn'); await esperaTela(page, 'checklist');
      const len = await comprimento(page);
      /* a prova de "não perguntou" é ter SAÍDO: com pergunta, a tela ficaria no checklist (antes: 400 ms fixos) */
      await page.click('#avpVoltarLista'); await esperaTela(page, 'avaliação');
      afirma(await page.locator(MODAL).count() === 0, 'nenhuma pergunta de descarte (nada foi alterado)');
      const c = await coerente(page, 'depois de voltar'); afirma(c.t === 'avaliação' && c.h === '#avaliacoes?avp=cadx', 'voltou direto à avaliação v1');
      afirma(await comprimento(page) <= len, 'sem empilhar histórico');
      await r.ctx.close();
    });

    await passo('N5', async () => {
      console.log('\n== 5. Reavaliar → alterar → Voltar: protege; descartar volta à avaliação de origem ==');
      const r = await novaPagina(browser, viewport); const page = r.page;
      await abrirDaLista(page, 'cadx');
      await page.click('#avpReavaliarBtn'); await esperaTela(page, 'checklist');
      await page.fill('#avpcNome', 'Nome alterado');
      await page.click('#avpVoltarLista'); await modalAbre(page);
      const modal = await page.locator(MODAL).first().innerText();
      afirma(/Descartar alterações/i.test(modal) && /Continuar editando/i.test(modal), 'a pergunta oferece "Descartar alterações" e "Continuar editando"');
      afirma(await page.evaluate(() => { const box = document.querySelector('.modal-overlay .avp-modal-confirm-btn').closest('.modal-box').getBoundingClientRect(); return Array.from(document.querySelectorAll('.avp-modal-confirm-btn, .avp-modal-cancel-btn')).every((b) => { const r = b.getBoundingClientRect(); return r.left >= box.left - 1 && r.right <= box.right + 1; }); }), 'os dois botões cabem dentro da caixa (' + viewport.width + 'px)');
      await page.locator(MODAL + ' button', { hasText: 'Continuar editando' }).click(); await modalFecha(page);
      let c = await coerente(page, 'depois de "Continuar editando"'); afirma(c.t === 'checklist' && c.h === '#avaliacoes?reavaliar=cadx' && await page.locator('#avpcNome').inputValue() === 'Nome alterado', 'continua na reavaliação, com a edição preservada');
      await page.click('#avpCancelarChecklistBtn'); await modalAbre(page);
      await page.locator(MODAL + ' button', { hasText: 'Descartar alterações' }).click();
      await esperaTela(page, 'avaliação'); c = await coerente(page, 'depois de descartar'); afirma(c.t === 'avaliação' && c.h === '#avaliacoes?avp=cadx', 'descartar retorna à avaliação de origem (URL junto)');
      const b = await banco(page); afirma(Object.keys(b['avaliacoes-produto']).length === Object.keys(AVN()).length, 'nada foi gravado');
      await r.ctx.close();
    });

    await passo('N6', async () => {
      console.log('\n== 6. Reavaliar → alterar → Voltar do NAVEGADOR: interrompe e pergunta ==');
      const r = await novaPagina(browser, viewport); const page = r.page;
      await abrirDaLista(page, 'cadx');
      await page.click('#avpReavaliarBtn'); await esperaTela(page, 'checklist');
      await page.fill('#avpcNome', 'Outro nome');
      await page.goBack(); await modalAbre(page);
      afirma(await page.locator(MODAL).count() === 1 && /Descartar alterações/i.test(await page.locator(MODAL).first().innerText()), 'o Voltar do navegador abre a pergunta');
      let c = await coerente(page, 'enquanto a pergunta está aberta'); afirma(c.t === 'checklist' && c.h === '#avaliacoes?reavaliar=cadx', 'a URL foi mantida na reavaliação (a saída foi interrompida)');
      await page.locator(MODAL + ' button', { hasText: 'Continuar editando' }).click(); await modalFecha(page);
      afirma(await page.locator('#avpcNome').inputValue() === 'Outro nome', 'continuar editando preserva o que foi digitado');
      await page.goBack(); await modalAbre(page);
      await page.locator(MODAL + ' button', { hasText: 'Descartar alterações' }).click();
      await esperaTela(page, 'avaliação'); c = await coerente(page, 'depois de descartar pelo navegador'); afirma(c.t === 'avaliação' && c.h === '#avaliacoes?avp=cadx', 'descartar completa a volta: avaliação de origem');
      await r.ctx.close();
    });

    await passo('N7', async () => {
      console.log('\n== 7. Concluir a reavaliação SUBSTITUI a entrada: o Voltar não reabre o checklist ==');
      const r = await novaPagina(browser, viewport); const page = r.page;
      await abrirDaLista(page, 'cadx');
      await page.click('#avpReavaliarBtn'); await esperaTela(page, 'checklist');
      const len = await comprimento(page);
      await page.click('#avpConcluirBtn'); await esperaTela(page, 'avaliação');
      let c = await coerente(page, 'depois de concluir'); afirma(/^#avaliacoes\?avp=/.test(c.h) && c.h !== '#avaliacoes?avp=cadx', 'a URL é a da nova versão');
      afirma(await comprimento(page) <= len, 'concluir não empilhou entrada (substituiu a do checklist)');
      const rotulo = (await textoDe(page, '#avpVoltarListaResultado')).trim();
      await page.goBack();
      c = await coerente(page, 'Voltar do navegador depois de concluir');
      afirma(c.t !== 'checklist' && !/reavaliar=/.test(c.h), 'o Voltar do navegador NÃO reabre a reavaliação concluída (tela "' + c.t + '")');
      await nadaReabreEm700ms(page, /reavaliar=/, 'e nada reabre a reavaliação depois');
      await r.ctx.close();
    });

    await passo('N8', async () => {
      console.log('\n== 8. Avaliação → versão anterior → Voltar (contexto de origem) ==');
      const r = await novaPagina(browser, viewport); const page = r.page;
      await abrirDaLista(page, 'v2');
      await page.click('.avp-hist-abrir[data-key="v1"]'); await esperaTela(page, 'avaliação-anterior');
      let c = await coerente(page, 'versão anterior'); afirma(c.h === '#avaliacoes?avp=v1', 'a URL identifica a versão anterior');
      afirma(/^← Voltar para a avaliação \(v2\)$/i.test((await textoDe(page, '#avpVoltarListaResultado')).trim()) && /^← Voltar para a avaliação \(v2\)$/i.test((await textoDe(page, '#avpVoltarListaRodape')).trim()), 'o Voltar (topo e rodapé) diz "← Voltar para a avaliação (v2)"');
      const len = await comprimento(page);
      await page.click('#avpVoltarListaRodape'); await esperaTela(page, 'avaliação');
      c = await coerente(page, 'Voltar da versão anterior'); afirma(c.h === '#avaliacoes?avp=v2' && c.t === 'avaliação', 'volta à avaliação de onde foi aberta (v2)');
      afirma(await comprimento(page) <= len, 'sem empilhar histórico');
      /* abrir a vigente a partir da anterior não cresce a pilha */
      await page.click('.avp-hist-abrir[data-key="v1"]'); await esperaTela(page, 'avaliação-anterior');
      const len2 = await comprimento(page);
      await page.click('#avpAbrirVigente'); await esperaTela(page, 'avaliação');
      c = await coerente(page, 'Abrir a versão vigente'); afirma(c.h === '#avaliacoes?avp=v2' && await comprimento(page) <= len2, 'abrir a vigente volta à v2 sem criar laço');
      /* F5 na anterior mantém a anterior */
      await page.click('.avp-hist-abrir[data-key="v1"]'); await esperaTela(page, 'avaliação-anterior');
      await page.reload(); await esperaTela(page, 'avaliação-anterior', 8000); c = await coerente(page, 'F5 na versão anterior'); afirma(c.t === 'avaliação-anterior' && c.h === '#avaliacoes?avp=v1', 'F5 restaura a versão anterior');
      await r.ctx.close();
    });

    await passo('N8b', async () => {
      console.log('\n== 8b. Versão anterior aberta direto (sem contexto): destino seguro ==');
      const r = await novaPagina(browser, viewport, '#avaliacoes?avp=v1'); const page = r.page;
      afirma(/^← Voltar para avaliações$/i.test((await textoDe(page, '#avpVoltarListaResultado')).trim()), 'sem origem conhecida o texto diz "← Voltar para avaliações"');
      await page.click('#avpVoltarListaResultado'); await esperaTela(page, 'lista');
      const c = await coerente(page, 'Voltar sem contexto'); afirma(c.h === '#avaliacoes' && c.t === 'lista', 'vai à lista');
      await page.goBack();
      afirma((await tela(page)) !== 'avaliação-anterior', 'e o Voltar do navegador não reabre a versão anterior');
      await nadaReabreEm700ms(page, /avp=v1/, 'e nada reabre a versão anterior depois');
      await r.ctx.close();
    });

    await passo('N9', async () => {
      console.log('\n== 9. Lista → ⋯ → Ver histórico → Visualizar → Voltar ==');
      const r = await novaPagina(browser, viewport); const page = r.page;
      await page.click('.avp-act-mais[data-key="v2"]'); await page.click('.avp-menu-item[data-acao="historico"]');
      await page.click('.avp-historico-ver[data-key="v1"]'); await esperaTela(page, 'avaliação-anterior');
      let c = await coerente(page, 'versão aberta pelo histórico');
      afirma(/^← Voltar para avaliações$/i.test((await textoDe(page, '#avpVoltarListaResultado')).trim()), 'a origem é a lista: "← Voltar para avaliações"');
      await page.click('#avpVoltarListaResultado'); await esperaTela(page, 'lista'); c = await coerente(page, 'Voltar'); afirma(c.t === 'lista' && c.h === '#avaliacoes', 'volta à lista');
      await r.ctx.close();
    });

    await passo('N10', async () => {
      console.log('\n== 10. Nova avaliação ==');
      const r = await novaPagina(browser, viewport); const page = r.page;
      await page.click('#avpNovoBtn'); await esperaTela(page, 'form-inicial');
      let c = await coerente(page, 'Nova avaliação'); afirma(c.h === '#avaliacoes?nova=1', 'a URL é ?nova=1');
      await page.click('#avpVoltarFormInicial'); await esperaTela(page, 'lista');
      afirma(await page.locator(MODAL).count() === 0, 'sem digitar nada, voltar sai direto');
      c = await coerente(page, 'depois de voltar'); afirma(c.h === '#avaliacoes', 'URL da lista');
      await page.click('#avpNovoBtn'); await esperaTela(page, 'form-inicial');
      await page.fill('#avpfNome', 'Item novo');
      await page.click('#avpCancelarInicialBtn'); await modalAbre(page);
      afirma(/Descartar alterações/i.test(await textoDe(page, MODAL)), 'com algo digitado, CANCELAR pergunta');
      await page.locator(MODAL + ' button', { hasText: 'Continuar editando' }).click(); await modalFecha(page);
      await page.goBack(); await modalAbre(page);
      afirma(await page.locator(MODAL).count() === 1 && (await hashDe(page)) === '#avaliacoes?nova=1', 'Voltar do navegador com algo digitado também pergunta (URL mantida)');
      await page.locator(MODAL + ' button', { hasText: 'Descartar alterações' }).click();
      await esperaTela(page, 'lista'); c = await coerente(page, 'depois de descartar'); afirma(c.t === 'lista' && c.h === '#avaliacoes', 'descartar volta à lista');
      await r.ctx.close();
    });

    await passo('N11', async () => {
      console.log('\n== 11. Continuar rascunho / salvar rascunho ==');
      const r = await novaPagina(browser, viewport); const page = r.page;
      await page.click('.avp-act-editar[data-key="rasc"]'); await esperaTela(page, 'checklist');
      let c = await coerente(page, 'Continuar rascunho'); afirma(c.h === '#avaliacoes?editar=rasc', 'a URL é ?editar=rasc');
      await page.click('#avpVoltarLista'); await esperaTela(page, 'lista');
      afirma(await page.locator(MODAL).count() === 0, 'sem alteração, sai direto');
      await page.click('.avp-act-editar[data-key="rasc"]'); await esperaTela(page, 'checklist');
      await page.fill('#avpcNome', 'Rascunho renomeado');
      await page.click('#avpSalvarRascunhoBtn'); await esperaTela(page, 'lista');
      c = await coerente(page, 'depois de salvar o rascunho'); afirma(c.t === 'lista' && c.h === '#avaliacoes', 'salvar volta à lista');
      await page.goBack();
      afirma((await tela(page)) !== 'checklist' && !/editar=|nova=/.test(await hashDe(page)), 'o Voltar do navegador não reabre o checklist salvo');
      await nadaReabreEm700ms(page, /editar=|nova=/, 'e nada reabre o checklist salvo depois');
      await r.ctx.close();
    });

    await passo('N12', async () => {
      console.log('\n== 12. F5 em cada estado ==');
      let r = await novaPagina(browser, viewport); let page = r.page;
      await page.reload(); await esperaTela(page, 'lista', 8000); let c = await coerente(page, 'F5 na lista'); afirma(c.t === 'lista', 'F5 na lista');
      await abrirDaLista(page, 'cadx');
      await page.reload(); await esperaTela(page, 'avaliação', 8000); c = await coerente(page, 'F5 na avaliação'); afirma(c.t === 'avaliação' && c.h === '#avaliacoes?avp=cadx', 'F5 na avaliação vigente');
      await r.ctx.close();

      r = await novaPagina(browser, viewport, '#avaliacoes?nova=1'); page = r.page;
      c = await coerente(page, 'abrir ?nova=1 direto'); afirma(c.t === 'form-inicial' && await page.locator('#avpfNome').inputValue() === '', '?nova=1 abre o formulário inicial vazio');
      await page.fill('#avpfNome', 'digitado');
      const dialogos = []; page.on('dialog', (d) => { dialogos.push(d.type()); d.dismiss().catch(() => {}); });
      /* o reload NÃO termina — o beforeunload é recusado de propósito (dismiss); a prova é o diálogo.
         Antes: reload com limite de 4 s que sempre estourava, engolido. */
      const dialogo1 = page.waitForEvent('dialog', { timeout: 8000 });
      page.reload().catch(() => { /* navegação cancelada pelo próprio teste ao recusar o diálogo */ });
      await dialogo1;
      afirma(dialogos.indexOf('beforeunload') !== -1, 'com algo digitado, o F5 avisa (beforeunload)');
      await r.ctx.close();

      r = await novaPagina(browser, viewport, '#avaliacoes?nova=1'); page = r.page;
      const d2 = []; page.on('dialog', (d) => { d2.push(d.type()); d.accept().catch(() => {}); });
      await page.click('body'); await page.reload(); await esperaTela(page, 'form-inicial', 8000);
      afirma(d2.length === 0, 'sem alteração, o F5 NÃO avisa');
      await r.ctx.close();

      r = await novaPagina(browser, viewport, '#avaliacoes?editar=rasc'); page = r.page;
      c = await coerente(page, 'abrir ?editar=rasc direto'); afirma(c.t === 'checklist' && await page.locator('#avpcNome').inputValue() === 'Item Rascunho', '?editar=<chave> restaura o rascunho salvo');
      await page.fill('#avpcNome', 'mudou sem salvar');
      page.on('dialog', (d) => d.accept().catch(() => {}));
      await page.reload(); await esperaTela(page, 'checklist', 8000);
      afirma(await page.locator('#avpcNome').inputValue() === 'Item Rascunho', 'o F5 recomeça do rascunho salvo (sem a edição não salva)');
      await r.ctx.close();

      r = await novaPagina(browser, viewport, '#avaliacoes?reavaliar=cadx'); page = r.page;
      c = await coerente(page, 'abrir ?reavaliar=cadx direto'); afirma(c.t === 'checklist' && /Reavaliação — v2/.test(await textoDe(page, '.avp-checklist h3')), '?reavaliar=<chave> reconstrói a reavaliação a partir da versão salva');
      afirma(/^← Voltar para a avaliação \(v1\)$/i.test((await textoDe(page, '#avpVoltarLista')).trim()), 'o Voltar diz o destino seguro: "← Voltar para a avaliação (v1)"');
      await page.fill('#avpcNome', 'alterado na reavaliação');
      const d3 = []; page.on('dialog', (d) => { d3.push(d.type()); d.dismiss().catch(() => {}); });
      const dialogo3 = page.waitForEvent('dialog', { timeout: 8000 });
      page.reload().catch(() => { /* navegação cancelada pelo próprio teste ao recusar o diálogo */ });
      await dialogo3;
      afirma(d3.indexOf('beforeunload') !== -1, 'reavaliação com alteração: o F5 avisa (beforeunload)');
      await page.fill('#avpcNome', 'Item Cadastrado'); /* volta ao valor original: não há mais alteração */
      await page.click('#avpVoltarLista'); await esperaTela(page, 'avaliação'); c = await coerente(page, 'Voltar sem contexto'); afirma(c.h === '#avaliacoes?avp=cadx', 'sem contexto, volta à avaliação de origem (destino determinístico)');
      afirma(await page.locator(MODAL).count() === 0, 'e desfazer a alteração à mão também conta como "sem alteração"');
      await r.ctx.close();
    });

    await passo('N13', async () => {
      console.log('\n== 13. URLs inválidas caem de forma controlada ==');
      let r = await novaPagina(browser, viewport, '#avaliacoes?editar=cadx', 'avaliação'); let page = r.page;
      let c = await coerente(page, '?editar= de avaliação concluída'); afirma(c.t === 'avaliação' && c.h === '#avaliacoes?avp=cadx', 'avaliação concluída não é rascunho: abre a avaliação');
      await r.ctx.close();
      r = await novaPagina(browser, viewport, '#avaliacoes?reavaliar=v1', 'avaliação-anterior'); page = r.page;
      c = await coerente(page, '?reavaliar= de versão que não é a vigente'); afirma(c.t === 'avaliação-anterior' && c.h === '#avaliacoes?avp=v1', 'versão que não é a vigente não se reavalia: abre a versão');
      await r.ctx.close();
      r = await novaPagina(browser, viewport, '#avaliacoes?reavaliar=naoexiste', 'não-encontrada'); page = r.page;
      c = await coerente(page, '?reavaliar= inexistente'); afirma(c.t === 'não-encontrada', 'chave inexistente: "não encontrada"');
      afirma(/^← Voltar para avaliações$/i.test((await textoDe(page, '#avpVoltarNaoEncontrada')).trim()), 'com saída clara "← Voltar para avaliações"');
      await page.click('#avpVoltarNaoEncontrada'); await esperaTela(page, 'lista'); c = await coerente(page, 'saída'); afirma(c.t === 'lista' && c.h === '#avaliacoes', 'vai à lista');
      await r.ctx.close();
    });

    afirma(erros.length === 0, 'nenhum erro de JS no passo N1 (' + erros.length + ')');
    const errosDoFormato = errosDeTodasAsPaginas.splice(0).reduce((a, l) => a.concat(l), []);
    afirma(errosDoFormato.length === 0, 'nenhum erro de JS em nenhuma página aberta neste formato (' + errosDoFormato.length + (errosDoFormato.length ? ': ' + errosDoFormato.slice(0, 3).join(' | ') : '') + ')');
  }

  await browser.close();
  console.log('\n============================');
  console.log(falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
