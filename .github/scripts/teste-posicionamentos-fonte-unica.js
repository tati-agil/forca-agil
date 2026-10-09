/* POSICIONAMENTOS — a Taxonomia Organizacional é a fonte ÚNICA do NOME e da DEFINIÇÃO (PR D).
 *
 * window.faPosicionamentos (forca-agil/posicionamentos.js), no mesmo rigor de teste-classificacoes-fonte-unica.js.
 * Ainda não há tela que responda O1–O9 (PR E): o módulo é exercido direto, na página real (index.html com o
 * Firebase falso em persistenciaReal), por uma pessoa com o perfil "Avaliação" (não admin).
 *
 * Parte 1 (sem navegador, vm):
 *   - catálogo = exatamente os 10 códigos de CODIGOS_INTERMEDIARIOS + CODIGOS_FIRMES do motor (sem A_VALIDAR,
 *     sem SQUAD/CAPITULO/DISCIPLINA); o rótulo de fábrica cobre os mesmos 10 e é só contingência;
 *   - carregar o módulo não lê nada (o Firebase só é tocado depois de iniciar());
 *   - o módulo não tem nenhuma chamada de gravação; o motor não lê a Taxonomia.
 * Parte 2 (navegador, desktop e celular 375 px):
 *   - nome vindo da Taxonomia; definição SÓ da fonte apontada (outra fonte marcada "vigente" e gravada antes
 *     não é escolhida); conceito ausente → rótulo de fábrica + aviso, sem definição inventada; inativo → nome
 *     continua (ativo é só informação);
 *   - só lê nome/ativo/ponteiro dos 10 códigos e o texto da fonte apontada — nenhum outro caminho;
 *   - renomear ao vivo muda nome e DOM; trocar o ponteiro desliga a escuta da fonte antiga e liga a da nova;
 *   - Taxonomia lenta (passa do limite), que nunca responde, ou recusada → só rótulo de contingência;
 *   - perder o acesso invalida as respostas atrasadas da sessão anterior; voltar religa;
 *   - o módulo não grava nada no Firebase; sem rolagem horizontal; sem erro de JS. */
const { chromium } = require('playwright');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const SRC_POS = fs.readFileSync(path.join(RAIZ, 'posicionamentos.js'), 'utf8');
const SRC_MOTOR = fs.readFileSync(path.join(RAIZ, 'motor-posicionamento.js'), 'utf8');
const MOTOR = require(path.join(RAIZ, 'motor-posicionamento.js'));
const EMAIL = 'avaliadora@previ.com.br';
const KEY = EMAIL.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };
const ORG = 'taxonomia/organizacional';

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const DEZ = MOTOR.CODIGOS_INTERMEDIARIOS.concat(MOTOR.CODIGOS_FIRMES);
const AUSENTE = 'PLATAFORMA_CANAIS';
const INATIVO = 'COE';
const DEF_A = 'Definição A da Linha: fonte APONTADA pelo ponteiro.';
const DEF_B = 'Definição B da Linha: também marcada vigente, mas NÃO apontada.';
const DEF_NOVA = 'Definição nova da Linha, depois da troca do ponteiro.';

function parte1() {
  console.log('\n== Catálogo: os 10 códigos do motor ==');
  let chamadasDb = 0;
  const ctx = { console, setTimeout, clearTimeout, JSON, Object, Array, String };
  ctx.window = ctx;
  ctx.firebase = { database() { chamadasDb++; throw new Error('não deveria ler ao carregar'); }, auth() { return { currentUser: null }; } };
  ctx.addEventListener = () => {};
  vm.createContext(ctx);
  vm.runInContext(SRC_MOTOR, ctx, { filename: 'motor-posicionamento.js' });
  vm.runInContext(SRC_POS, ctx, { filename: 'posicionamentos.js' });
  const P = ctx.faPosicionamentos;
  const cods = Array.from(P.codigos());
  afirma(cods.length === 10, 'exatamente 10 códigos (' + cods.join(', ') + ')');
  afirma(igual(cods.slice().sort(), DEZ.slice().sort()), 'o conjunto é CODIGOS_INTERMEDIARIOS + CODIGOS_FIRMES do motor, sem sobra nem falta');
  afirma(igual(cods, ['LINHA', 'ESTRATEGIA_CLIENTES', 'NEGOCIOS', 'PLATAFORMA', 'PLATAFORMA_CANAIS', 'PLATAFORMA_HABILITADORA_NEGOCIOS',
    'PLATAFORMA_HABILITADORA_TECNOLOGIA', 'PLATAFORMA_CORPORATIVA', 'AREA_ESPECIALIZADA', 'COE']), 'na ordem de exibição (Linha e desdobramentos, depois Área e CoE)');
  afirma(!cods.includes(MOTOR.A_VALIDAR) && !cods.includes('A_VALIDAR'), 'A_VALIDAR não entra (não é conceito da Taxonomia)');
  afirma(['SQUAD', 'CAPITULO', 'DISCIPLINA'].every((c) => !cods.includes(c)), 'SQUAD, CAPITULO e DISCIPLINA não entram');
  afirma(igual(Object.keys(P.ROTULO_FABRICA).sort(), DEZ.slice().sort()) && Object.isFrozen(P.ROTULO_FABRICA), 'rótulo de fábrica para os mesmos 10 códigos, congelado');
  afirma(P.nome('LINHA') === 'Linha' && P.nome('COE') === 'Centro de Excelência (CoE)' && P.nome('PLATAFORMA_CORPORATIVA') === 'Plataforma de Gestão Corporativa',
    'antes de qualquer leitura: rótulo de fábrica (Linha, Centro de Excelência (CoE), Plataforma de Gestão Corporativa)');
  afirma(cods.every((c) => P.definicao(c) === null), 'antes de qualquer leitura: nenhuma definição (não há definição de fábrica)');
  afirma(P.nome('SQUAD') === 'SQUAD' && P.definicaoHtml('SQUAD') === '' && P.spanNome('A_VALIDAR') === 'A_VALIDAR', 'código fora do catálogo: só o próprio código, nada da Taxonomia');
  afirma(chamadasDb === 0, 'carregar o módulo não lê nada do Firebase (só depois de iniciar())');
  const API = ['codigos', 'nome', 'definicao', 'estadoDefinicao', 'ativo', 'estado', 'usandoContingencia', 'onMudanca', 'iniciar', 'recarregar',
    'precisaAviso', 'avisoHtml', 'spanNome', 'definicaoHtml', 'atualizarDom'];
  afirma(API.every((f) => typeof P[f] === 'function') && typeof P.TEXTO_AVISO === 'string' && P.TEMPO_DEMORA_MS > 0, 'API completa (' + API.length + ' funções + TEXTO_AVISO e TEMPO_DEMORA_MS)');
  afirma(/^Rótulo de contingência: o nome deste posicionamento não pôde ser lido da Taxonomia Organizacional agora; está sendo mostrado o nome de fábrica\.$/.test(P.TEXTO_AVISO), 'texto do aviso de contingência');
  const semComentarios = SRC_POS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const semListas = semComentarios.replace(/\b(ouvintesFirebase|lista|callbacks)\.push\(/g, '');
  afirma(!/\.(set|update|push|remove|transaction|setWithPriority)\s*\(/.test(semListas), 'posicionamentos.js não tem nenhuma chamada de gravação (só push em listas internas)');
  afirma(!/situacao/.test(semComentarios), 'posicionamentos.js nunca procura fonte por "situacao"');
  const motorSem = SRC_MOTOR.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  afirma(!/taxonomia|firebase|faPosicionamentos/i.test(motorSem), 'o motor de Posicionamento não lê a Taxonomia nem o Firebase');
}

function taxonomia() {
  const conceitos = {}, fontes = {};
  DEZ.concat(['SQUAD', 'CAPITULO', 'DISCIPLINA']).forEach((c, i) => {
    if (c === AUSENTE) return;
    conceitos[c] = { nome: 'Tx ' + c, ordem: i + 1, ativo: c !== INATIVO, situacaoDefinicao: 'registrada', camada: 'A', definicaoVigenteFonteId: 'fA', observacoes: 'obs' };
    /* fB gravada ANTES de fA e também 'vigente': quem escolhesse "a fonte vigente" pegaria a B */
    fontes[c] = {
      fB: { texto: c === 'LINHA' ? DEF_B : 'B de ' + c, contexto: 'PREVI', situacao: 'vigente', tipoRedacao: 'Conceito' },
      fA: { texto: c === 'LINHA' ? DEF_A : 'Definição de ' + c, contexto: 'PREVI', situacao: 'vigente', tipoRedacao: 'Conceito' }
    };
  });
  conceitos.LINHA.nome = 'Linha (Taxonomia)';
  return { organizacional: { conceitos, fontes } };
}

async function abrir(browser, viewport, opts) {
  opts = opts || {};
  const aut = {}; aut[KEY] = { email: EMAIL, nome: 'Avaliadora', tipo: 'avaliacao' };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': {}, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-espera': {},
    'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {}, eventos: {}, 'turmas-publico': {}, 'eventos-publico': {},
    'fa-avaliacao-autorizados': aut, 'avaliacoes-produto': {}, 'avaliacoes-squad': {}, taxonomia: taxonomia() };
  const cfg = { db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true, delays: opts.delays || {}, fail: opts.fail || [] };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(12000);
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#home', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  await esperarCondicao(page, () => window.faAuth && window.faAuth.isAvaliacaoReady && window.faAuth.isAvaliacaoReady() && window.faAuth.podeAvaliacao(), null,
    { descricao: 'perfil "Avaliação" resolvido' });
  /* espiões: toda escuta ligada/desligada e toda gravação feita fora do próprio teste */
  await page.evaluate(() => {
    const proto = Object.getPrototypeOf(firebase.database().ref('x'));
    window.__ons = []; window.__offs = []; window.__gravacoesDoSite = [];
    const on = proto.on, off = proto.off;
    proto.on = function (evt, cb, err) { window.__ons.push(this.path); return on.call(this, evt, cb, err); };
    proto.off = function (evt, cb) { window.__offs.push(this.path); return off.call(this, evt, cb); };
    ['set', 'update', 'push', 'remove', 'transaction'].forEach((m) => {
      const orig = proto[m];
      if (typeof orig !== 'function') return;
      proto[m] = function () { if (!window.__testeGravando) window.__gravacoesDoSite.push(m + ' ' + this.path); return orig.apply(this, arguments); };
    });
    window.__gravarTeste = (fn) => { window.__testeGravando = true; try { return fn(); } finally { window.__testeGravando = false; } };
  });
  return { ctx, page, erros };
}
const P = (page, fn, arg) => page.evaluate(fn, arg);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function parte2(browser, nomeTela, viewport) {
  console.log('\n######## ' + nomeTela + ' ########');
  const { ctx, page, erros } = await abrir(browser, viewport);

  console.log('\n== Nome e definição vindos da Taxonomia Organizacional ==');
  afirma(await P(page, () => window.__ons.filter((p) => /taxonomia/.test(p)).length === 0), 'a página carregou sem o módulo ler a Taxonomia (ninguém chamou iniciar() ainda)');
  await P(page, () => { window.__notificacoes = 0; window.faPosicionamentos.onMudanca(() => { window.__notificacoes++; }); });
  await esperarCondicao(page, () => window.faPosicionamentos.nome('LINHA') === 'Linha (Taxonomia)' && !!window.faPosicionamentos.definicao('LINHA'), null, { descricao: 'nome e definição da LINHA' });
  const est = await P(page, (aus) => { const F = window.faPosicionamentos; return { nome: F.nome('LINHA'), def: F.definicao('LINHA'), est: F.estadoDefinicao('LINHA'),
    nomes: F.codigos().map((c) => F.nome(c)), estado: F.estado(), coeNome: F.nome('COE'), coeAtivo: F.ativo('COE'), linhaAtivo: F.ativo('LINHA'),
    ausNome: F.nome(aus), ausCont: F.usandoContingencia(aus), ausDef: F.definicao(aus), ausEst: F.estadoDefinicao(aus), aviso: F.precisaAviso([aus]), avisoLinha: F.precisaAviso(['LINHA']),
    notif: window.__notificacoes }; }, AUSENTE);
  afirma(est.nome === 'Linha (Taxonomia)', 'nome = o da Taxonomia ("' + est.nome + '"), não o de fábrica');
  afirma(est.def === DEF_A && est.est === 'ok', 'definição = texto da fonte APONTADA (fA)', est.def);
  afirma(est.def !== DEF_B, 'a fonte B, também marcada "vigente" e gravada antes, NÃO é escolhida');
  afirma(est.coeNome === 'Tx COE' && est.coeAtivo === false && est.linhaAtivo === true, 'conceito inativo (COE): o nome atual continua; ativo === false é só informação');
  afirma(est.ausNome === 'Plataforma de Canais' && est.ausCont && est.ausDef === null && est.ausEst === 'indisponivel', 'conceito AUSENTE (PLATAFORMA_CANAIS): rótulo de fábrica, sem definição inventada');
  afirma(est.aviso && !est.avisoLinha && est.estado === 'contingencia', 'aviso de contingência só para o ausente; estado geral "contingencia"');
  await esperarCondicao(page, () => window.__notificacoes >= 1, null, { descricao: 'onMudanca chamado' });
  afirma(true, 'onMudanca avisou quando as leituras chegaram');

  console.log('\n== Só os caminhos mínimos ==');
  const lidos = await P(page, () => window.__ons.filter((p) => /taxonomia/.test(p)));
  const permitido = (p) => {
    const m = /^taxonomia\/organizacional\/conceitos\/([A-Z_]+)\/(nome|ativo|definicaoVigenteFonteId)$/.exec(p) || /^taxonomia\/organizacional\/fontes\/([A-Z_]+)\/fA\/texto$/.exec(p);
    return !!m && DEZ.includes(m[1]);
  };
  afirma(lidos.length > 0 && lidos.every(permitido), 'toda escuta é nome/ativo/ponteiro de um dos 10 códigos ou o texto da fonte apontada (' + lidos.length + ' escutas)', lidos.filter((p) => !permitido(p)).join(' | '));
  afirma(DEZ.every((c) => ['nome', 'ativo', 'definicaoVigenteFonteId'].every((k) => lidos.includes(ORG + '/conceitos/' + c + '/' + k))), 'os três campos dos 10 códigos são escutados');
  afirma(!lidos.some((p) => /SQUAD|CAPITULO|DISCIPLINA|A_VALIDAR|\/fB\/|\/situacao|\/camada|\/pai|\/criterios|\/auditoria|\/relacoes|\/atributos|\/perfis/.test(p)) &&
    !lidos.includes(ORG + '/conceitos') && !lidos.includes(ORG + '/fontes') && !lidos.includes(ORG), 'nunca SQUAD/CAPITULO/DISCIPLINA, outra fonte, campo extra ou coleção inteira');

  console.log('\n== Na tela: nome, definição e aviso que se atualizam sozinhos ==');
  await P(page, (aus) => {
    const F = window.faPosicionamentos;
    const div = document.createElement('div');
    div.id = 'posTeste';
    div.innerHTML = '<p>' + F.spanNome('LINHA', null, 'posNomeLinha') + '</p>' + F.definicaoHtml('LINHA', 'posDefLinha', { comEstado: true }) +
      '<p>' + F.spanNome(aus, null, 'posNomeAus') + '</p>' + F.definicaoHtml(aus, 'posDefAus', { comEstado: true }) + F.avisoHtml([aus], 'posAvisoAus') + F.avisoHtml(['LINHA'], 'posAvisoLinha');
    document.querySelector('main, body').appendChild(div);
  }, AUSENTE);
  const dom = await P(page, () => ({ n: document.getElementById('posNomeLinha').textContent, d: document.getElementById('posDefLinha').textContent,
    na: document.getElementById('posNomeAus').textContent, da: document.getElementById('posDefAus').textContent,
    av: !document.getElementById('posAvisoAus').hidden && document.getElementById('posAvisoAus').textContent, avL: document.getElementById('posAvisoLinha').hidden }));
  afirma(dom.n === 'Linha (Taxonomia)' && dom.d === DEF_A, 'DOM: nome e definição da LINHA vindos da Taxonomia');
  afirma(dom.na === 'Plataforma de Canais' && dom.da === 'Definição vigente indisponível no momento.' && /^Rótulo de contingência/.test(dom.av) && dom.avL,
    'DOM: ausente com rótulo de fábrica, "indisponível" (sem texto de fábrica) e o aviso; LINHA sem aviso');
  afirma(await larguraOk(page), 'sem rolagem horizontal');

  console.log('\n== Ao vivo: renomear e trocar o ponteiro ==');
  await P(page, () => window.__gravarTeste(() => firebase.database().ref('taxonomia/organizacional/conceitos/LINHA/nome').set('Linha renomeada ao vivo')));
  await esperarCondicao(page, () => document.getElementById('posNomeLinha').textContent === 'Linha renomeada ao vivo' && window.faPosicionamentos.nome('LINHA') === 'Linha renomeada ao vivo',
    null, { descricao: 'nome novo ao vivo' });
  afirma(true, 'renomear na Taxonomia muda o nome e o DOM sem recarregar');
  await P(page, (def) => window.__gravarTeste(() => firebase.database().ref().update({
    'taxonomia/organizacional/fontes/LINHA/f2': { texto: def, contexto: 'PREVI', situacao: 'vigente', tipoRedacao: 'Conceito' },
    'taxonomia/organizacional/fontes/LINHA/fA/situacao': 'histórica/contextual',
    'taxonomia/organizacional/conceitos/LINHA/definicaoVigenteFonteId': 'f2' })), DEF_NOVA);
  await esperarCondicao(page, (def) => window.faPosicionamentos.definicao('LINHA') === def && document.getElementById('posDefLinha').textContent === def, DEF_NOVA, { descricao: 'definição nova' });
  const troca = await P(page, () => ({ off: window.__offs.includes('taxonomia/organizacional/fontes/LINHA/fA/texto'), on: window.__ons.includes('taxonomia/organizacional/fontes/LINHA/f2/texto') }));
  afirma(troca.off && troca.on, 'trocar o ponteiro: desliga a escuta da fonte antiga (fA) e liga a da nova (f2)');
  await P(page, () => window.__gravarTeste(() => firebase.database().ref('taxonomia/organizacional/fontes/LINHA/fA/texto').set('Texto mexido na fonte ANTIGA')));
  await page.waitForTimeout(300);
  afirma(await P(page, (def) => window.faPosicionamentos.definicao('LINHA') === def, DEF_NOVA), 'mexer na fonte antiga não muda nada: ela não é mais ouvida');
  const ENTRADAS = [[{ O1: 'SIM', O2: 'NAO', O3: 'NAO', O4: 'NAO', O5: 'SIM' }, {}], [{ O1: 'SIM', O2: 'NAO', O3: 'NAO', O4: 'NAO', O5: 'NAO', O6: 'SIM', O7: 'SIM', O8: 'NAO', O9: 'NAO' }, {}],
    [{ O1: 'NAO', O2: 'NAO', O3: 'SIM' }, {}]];
  const naPagina = await P(page, (e) => e.map((x) => window.faMotorPosicionamento.avaliar(x[0], x[1])), ENTRADAS);
  afirma(igual(naPagina, ENTRADAS.map((x) => MOTOR.avaliar(x[0], x[1]))), 'com a Taxonomia renomeada, o motor devolve exatamente o mesmo (código, nível, liberaSquad, versão) que fora da página');

  console.log('\n== Sessão: perder o acesso invalida as respostas antigas ==');
  await P(page, () => { window.__acessoOriginal = window.faAuth.podeAvaliacao; window.faAuth.podeAvaliacao = () => false; window.dispatchEvent(new Event('fa-auth-change')); });
  await esperarCondicao(page, () => window.faPosicionamentos.nome('LINHA') === 'Linha' && window.faPosicionamentos.definicao('LINHA') === null, null, { descricao: 'sem acesso: volta ao rótulo de fábrica' });
  afirma(true, 'sem acesso: tudo desligado, nome volta ao de fábrica e a definição some');
  await P(page, () => window.__gravarTeste(() => firebase.database().ref('taxonomia/organizacional/conceitos/LINHA/nome').set('Renomeada sem acesso')));
  await page.waitForTimeout(300);
  afirma(await P(page, () => window.faPosicionamentos.nome('LINHA') === 'Linha'), 'sem acesso: uma mudança na Taxonomia não chega mais (escutas desligadas)');
  await P(page, () => { window.faAuth.podeAvaliacao = window.__acessoOriginal; window.dispatchEvent(new Event('fa-auth-change')); });
  await esperarCondicao(page, () => window.faPosicionamentos.nome('LINHA') === 'Renomeada sem acesso', null, { descricao: 'acesso de volta: religa e lê o atual' });
  afirma(true, 'acesso de volta: religa e lê o nome atual');

  const grav = await P(page, () => window.__gravacoesDoSite.filter((g) => /taxonomia|posicionamento/.test(g)));
  afirma(grav.length === 0, 'o módulo não gravou nada no Firebase', grav.join(' | '));
  afirma(await larguraOk(page), 'sem rolagem horizontal ao final');
  await ctx.close();
  afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
}

async function contingencias(browser) {
  console.log('\n######## contingência (desktop e celular) ########');
  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n-- ' + nomeTela + ': Taxonomia LENTA (responde depois do limite) --');
    let r = await abrir(browser, viewport, { delays: { 'taxonomia/organizacional': 9000 } });
    await P(r.page, () => window.faPosicionamentos.iniciar());
    await r.page.waitForTimeout(1500);
    afirma(await P(r.page, () => window.faPosicionamentos.estado() === 'carregando' && !window.faPosicionamentos.precisaAviso() && window.faPosicionamentos.estadoDefinicao('LINHA') === 'carregando'),
      'dentro do prazo: "carregando", sem aviso (nunca um pisca-pisca) e definição "carregando"');
    await esperarCondicao(r.page, () => window.faPosicionamentos.estado() === 'contingencia', null, { limite: 9000, descricao: 'passou do limite' });
    const lenta = await P(r.page, () => { const F = window.faPosicionamentos; return { cods: F.codigos(), nomes: F.codigos().map((c) => F.nome(c)), avisos: F.precisaAviso(), defs: F.codigos().map((c) => F.definicao(c)), est: F.estadoDefinicao('LINHA') }; });
    afirma(lenta.cods.length === 10 && igual(lenta.nomes, lenta.cods.map((c) => FABRICA[c])) && lenta.avisos && lenta.defs.every((d) => d === null) && lenta.est === 'indisponivel',
      'passado o limite: os 10 com rótulo de fábrica, aviso, nenhuma definição inventada', JSON.stringify(lenta));
    await esperarCondicao(r.page, () => window.faPosicionamentos.nome('LINHA') === 'Linha (Taxonomia)', null, { limite: 12000, descricao: 'a resposta atrasada chega' });
    await esperarCondicao(r.page, () => window.faPosicionamentos.definicao('LINHA') !== null && !window.faPosicionamentos.precisaAviso(['LINHA']), null, { limite: 12000, descricao: 'a definição atrasada chega' });
    afirma(true, 'quando a Taxonomia finalmente responde, nome e definição entram no lugar e o aviso some');
    await r.ctx.close();
    afirma(r.erros.length === 0, 'lenta: nenhum erro de JS');

    console.log('\n-- ' + nomeTela + ': Taxonomia que NUNCA responde --');
    r = await abrir(browser, viewport, { delays: { 'taxonomia/organizacional': 600000 } });
    await P(r.page, () => window.faPosicionamentos.iniciar());
    await esperarCondicao(r.page, () => window.faPosicionamentos.estado() === 'contingencia', null, { limite: 9000, descricao: 'contingência sem resposta' });
    afirma(await P(r.page, () => window.faPosicionamentos.nome('NEGOCIOS') === 'Linha de Negócios' && window.faPosicionamentos.precisaAviso(['NEGOCIOS']) && window.faPosicionamentos.definicao('NEGOCIOS') === null),
      'nunca responde: rótulo de fábrica + aviso, sem definição; nada trava');
    await r.ctx.close();

    console.log('\n-- ' + nomeTela + ': leitura RECUSADA --');
    r = await abrir(browser, viewport, { fail: ['taxonomia/organizacional'] });
    await P(r.page, () => window.faPosicionamentos.iniciar());
    await esperarCondicao(r.page, () => window.faPosicionamentos.estado() === 'contingencia', null, { limite: 3000, descricao: 'contingência por recusa (antes do limite)' });
    afirma(await P(r.page, () => window.faPosicionamentos.nome('AREA_ESPECIALIZADA') === 'Área Especializada' && window.faPosicionamentos.precisaAviso() &&
      window.faPosicionamentos.codigos().every((c) => window.faPosicionamentos.definicao(c) === null && window.faPosicionamentos.estadoDefinicao(c) === 'indisponivel')),
      'recusada: rótulo de fábrica + aviso já, sem esperar o limite; definições "indisponível"');
    await r.ctx.close();
    afirma(r.erros.length === 0, 'recusada: nenhum erro de JS');

    console.log('\n-- ' + nomeTela + ': resposta atrasada da sessão anterior é descartada --');
    r = await abrir(browser, viewport, { delays: { 'taxonomia/organizacional/conceitos/LINHA/nome': 1500 } });
    await P(r.page, () => window.faPosicionamentos.iniciar());
    await r.page.waitForTimeout(200);
    await P(r.page, () => { window.faAuth.podeAvaliacao = () => false; window.dispatchEvent(new Event('fa-auth-change')); });
    await r.page.waitForTimeout(2200);
    afirma(await P(r.page, () => window.faPosicionamentos.nome('LINHA') === 'Linha'), 'a resposta que chegou DEPOIS de perder o acesso não é aplicada (geração anterior)');
    await r.ctx.close();
  }
}
const FABRICA = { LINHA: 'Linha', ESTRATEGIA_CLIENTES: 'Linha de Estratégia de Clientes', NEGOCIOS: 'Linha de Negócios', PLATAFORMA: 'Linha de Plataforma',
  PLATAFORMA_CANAIS: 'Plataforma de Canais', PLATAFORMA_HABILITADORA_NEGOCIOS: 'Plataforma Habilitadora de Negócios', PLATAFORMA_HABILITADORA_TECNOLOGIA: 'Plataforma Habilitadora de Tecnologia',
  PLATAFORMA_CORPORATIVA: 'Plataforma de Gestão Corporativa', AREA_ESPECIALIZADA: 'Área Especializada', COE: 'Centro de Excelência (CoE)' };

(async () => {
  parte1();
  const browser = await chromium.launch();
  for (const [nome, vp] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) await parte2(browser, nome, vp);
  await contingencias(browser);
  await browser.close();
  console.log('\n============================\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
