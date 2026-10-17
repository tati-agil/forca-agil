/* Porta 2 · ANÁLISE ORGANIZACIONAL — usabilidade: registro direto, lote, lista única, Estrutura Atual e composição.
 * Firebase falso em persistência real; hermético; o banco é o da página (nada vai para produção). Os cenários são de
 * homologação ("Gerência de Contabilidade e Controladoria — GECON" com as dez atribuições fornecidas; "TESTE — Núcleo de
 * Governança de TI"); nenhuma classificação, núcleo ou vínculo é presumido. Prova, pela interface:
 *   E. Entrada: Início com Porta 1/Porta 2 e os caminhos A/B; Responsabilidades Organizacionais com as duas ações.
 *   A. Caminho A: um campo, "Registrar e avaliar" → registra e abre o O1–O9 (sem análise).
 *   F. F2b opcional: estrutura só com "Está cadastrada"; trocar limpa; teclado; recusa no núcleo.
 *   G. GECON escolhida na Estrutura Organizacional Atual: dez atribuições coladas (prévia, duplicidade, edição),
 *      registro direto (prontas, sem pergunta sobre separar), doze; editar o texto; quem executa hoje pela Estrutura
 *      Atual (CONTA; CONTA + NUTRI); texto antigo só com confirmação; composição por unidade; Avaliar → O1–O9 →
 *      "Voltar às responsabilidades da GECON"; lista de análises com contagens, próxima ação e homônimas; F5.
 *   L. Registros anteriores: pendentes continuam pendentes (nenhum "não" presumido), resposta explícita, separar.
 *   K. Consulta só lê; 375 px sem rolagem lateral, sem corte, sem ficar atrás do menu. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const { semente, ARQ, AVAL, chave } = require('./semente-jornada');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const ADM = 'admin.geral@previ.com.br';
const CFG = 'analises-organizacionais-config';
const LIB = 'LIBERADO_PARA_PERFIS_AUTORIZADOS';
const GECON = ['Gerir a contabilidade gerencial.', 'Gerir o planejamento e execução orçamentária.', 'Gerir a modelagem, mensuração, análise e avaliação de desempenho e resultados econômicos.',
  'Elaborar a projeção anual de resultados.', 'Gerir a movimentação financeira das contas bancárias.', 'Coordenar as informações para o fluxo de caixa de curto prazo.',
  'Registrar e controlar as operações de investimentos mobiliários da carteira própria e de fundos de investimento.', 'Gerir o processo contábil.',
  'Gerir o cumprimento de obrigações legais no âmbito contábil e tributário.', 'Gerir bens do ativo imobilizado e do ativo intangível.'];
let falhas = 0, total = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); if (!c) falhas++; }

function sementeAnalise(hab) {
  const db = semente();
  db['fa-admins'] = Object.assign({}, db['fa-admins'] || {}, { [chave(ADM)]: true });
  db['fa-users'][chave(ADM)] = { name: 'Admin', email: ADM, area: 'INFOR' };
  const reg = db['estruturas-concretas'].registros;
  const e = (id, tipo, nome) => ({ id, tipo, nome, situacao: 'ativa', revisao: 1, criadaEm: 1791713600000, criadaPor: { id: 'semente', email: 'semente@teste' }, ultimaOperacao: 'op-' + id });
  reg['nucleo-gov'] = e('nucleo-gov', 'AREA_ESPECIALIZADA', 'Núcleo de Governança de TI');
  const ua = (id, sigla, nome, nivel, sup) => Object.assign({ id, sigla, nome, nivel, situacao: 'ativa', revisao: 1, criadaEm: 1791713600000, criadaPor: { uid: 'semente', email: 'semente@teste' }, atualizadaEm: 1791713600000, atualizadaPor: { uid: 'semente', email: 'semente@teste' }, auditoriaId: 'aud-' + id }, sup ? { superiorId: sup } : {});
  db['estrutura-atual-unidades'] = { 'ua-dir': ua('ua-dir', 'DIFIN', 'Diretoria de Finanças (teste)', 'diretoria'), 'ua-gecon': ua('ua-gecon', 'GECON', 'Gerência de Contabilidade e Controladoria', 'gerencia', 'ua-dir'),
    'ua-nutes': ua('ua-nutes', 'NUTES', 'Núcleo de Tesouraria', 'nucleo', 'ua-gecon'), 'ua-conta': ua('ua-conta', 'CONTA', 'Núcleo de Contabilidade', 'nucleo', 'ua-gecon'), 'ua-nutri': ua('ua-nutri', 'NUTRI', 'Núcleo Tributário', 'nucleo', 'ua-gecon'), 'ua-nucot': ua('ua-nucot', 'NUCOT', 'Núcleo de Controle', 'nucleo', 'ua-gecon'),
    'ua-outra': ua('ua-outra', 'GEOUT', 'Outra gerência (teste)', 'gerencia', 'ua-dir') };
  if (hab) db[CFG] = { habilitacao: hab };
  return db;
}
function comLegado(db) {
  const por = { id: 'u-x', email: ARQ }, T = 1791713600000;
  const resp = (v) => ({ valor: v, em: T, por });
  db['analises-organizacionais'] = Object.assign(db['analises-organizacionais'] || {}, { 'an-legado': { id: 'an-legado', nome: 'TESTE — Legado', tipoEscopo: 'estrutura', situacao: 'aberta', revisao: 3, criadaEm: T, criadaPor: { id: 'u-x', email: ARQ },
    atualizadoEm: T, atualizadoPor: { uid: 'u-x', email: ARQ }, auditoriaId: 'aud-l', estruturaReferidaId: 'nucleo-gov',
    respostas: { F2b: { valor: 'informal', estruturaId: 'nucleo-gov', em: T, por } },
    entregas: { el1: { id: 'el1', descricao: 'Pareceres de arquitetura', exemplo: null, situacao: 'ativa', criadaEm: T, respostas: { F4: resp('julgamento-tecnico'), F5: resp('diversas-linhas'), F6: Object.assign(resp('esta-estrutura'), { certeza: 'conhecido' }), F8: resp('sem-evidencia') } } },
    recortes: { rl1: { id: 'rl1', nome: 'Emitir pareceres de arquitetura', resultado: 'Soluções avaliadas', justificativa: 'Resultado próprio', entregas: { 0: 'el1' }, situacao: 'ativo', versao: 1, criadoEm: T, criadoPor: { id: 'u-x' } } } } });
  return db;
}
async function abrir(browser, viewport, hash, opts) {
  opts = opts || {};
  const email = opts.email || ARQ;
  const cfg = { db: opts.db || sementeAnalise(opts.hab), user: { email, emailVerified: true, uid: 'u-' + chave(email) }, uidDoUsuario: true, prefixoChave: 'u' + (++abrir.n) + 'x', delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
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
const esperar = (page, fn, arg, limite) => esperarCondicao(page, fn, arg, { limite: limite || 15000 });
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent : ''; }, sel);
const existe = (page, sel) => page.evaluate((s) => !!document.querySelector(s), sel);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const estouro = (page) => page.evaluate(() => Array.from(document.querySelectorAll('#avaliacoesAnalise *, #anEntradaAtuacoes *, #poFormAtuacao *')).filter((e) => e.offsetParent && e.getBoundingClientRect().right > window.innerWidth + 1).map((e) => e.tagName + '.' + e.className + '#' + e.id).slice(0, 5));
const ir = async (page, hash) => { await page.evaluate((h) => { location.hash = h; }, hash); };
const prop = (page, sel, p) => page.evaluate(([s, k]) => { const e = document.querySelector(s); return e ? e[k] : undefined; }, [sel, p]);
const focado = (page) => page.evaluate(() => (document.activeElement || {}).id || '');
const gravarDb = (page, w) => page.evaluate((x) => new Promise((ok, falha) => window.firebase.database().ref().update(x, (e) => (e ? falha(String(e)) : ok()))), w);
async function recarregar(page, ctx) {
  const db = await banco(page);
  await ctx.addInitScript('window.__CFG.db = ' + JSON.stringify(db) + '; delete window.__CFG.__dbReal;');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
}
async function responderF2b(page, valor, estrutura) {
  await page.check('#anFormResponder input[name="anResposta"][value="' + valor + '"]');
  if (estrutura) await page.selectOption('#anEstruturaCadastrada', estrutura);
  await page.click('#anResponderBtn');
  const rot = { cadastrada: 'Está cadastrada', 'nao-cadastrada': 'Existe, mas não está cadastrada', informal: 'É informal' }[valor];
  await esperar(page, (r) => { const o = document.getElementById('anObjetoF2b'); return !document.querySelector('#anFormResponder[data-q="F2b"]') && !!o && o.textContent.indexOf(r) === 0; }, rot);
}
async function abrirAnalise(page, nome, escopo, descricao) {
  await ir(page, '#arquitetura?an=nova'); await page.waitForSelector('#anFormNova');
  if (escopo || descricao) await page.evaluate(() => { document.getElementById('anNovaAvancado').open = true; });
  if (escopo) await page.check('#anFormNova input[value="' + escopo + '"]');
  await page.fill('#anNome', nome);
  if (descricao) await page.fill('#anDescricao', descricao);
  await page.click('#anCriarBtn');
  await esperar(page, () => /an=(?!nova|lista)/.test(location.hash) && !!document.getElementById('anTitulo'));
  return page.evaluate(() => decodeURIComponent(/an=([^&]*)/.exec(location.hash)[1]));
}
async function registrarResp(page, desc, sep) {
  await page.fill('#anRespDesc', desc);
  if (sep) await page.check('#anFormResponsabilidade input[name="anRespSep"][value="' + sep + '"]');
  await page.click('#anRegistrarRespBtn');
  await esperar(page, (d) => !!document.getElementById('anErro') || (!!document.getElementById('anRespFeedback') && document.getElementById('anRespFeedback').textContent.indexOf(d) !== -1), desc);
  return texto(page, '#anErro');
}
const linhaDe = (page, desc) => page.evaluate((d) => { const l = Array.from(document.querySelectorAll('.an-linha[data-resp]')).find((x) => x.querySelector('.an-cel--resp strong').textContent === d); return l ? l.getAttribute('data-resp') : null; }, desc);
const situacaoDe = async (page, k) => (await texto(page, '#anSituacao_' + k)).trim();
async function clicarEsperar(page, sel, fn, arg) { await page.click(sel); await esperar(page, fn, arg); }
/* "Definir delimitação" abre a pergunta só daquela linha; a resposta é um clique */
async function responderSep(page, k, v, fn) { await page.click('#anDelimitar_' + k); await page.waitForSelector('#anPainelDelim_' + k); await clicarEsperar(page, '#anSep' + { nao: 'Nao_', sim: 'Sim_', 'nao-sei': 'NaoSei_' }[v] + k, fn, k); }
async function abrirDetalhar(page) {
  /* o detalhamento por entregas é ajuda: abre por "Preciso de ajuda para separar" (ou já está aberto, com entregas) */
  if (!(await page.evaluate(() => !!document.getElementById('anDetalhar')))) await page.click('#anAjudaSeparar');
  await page.waitForSelector('#anDetalhar');
  if (!(await page.evaluate(() => document.getElementById('anDetalhar').open))) await page.click('#anDetalhar > summary');
  await page.waitForSelector('#anEntregaDesc', { state: 'visible' });
}
async function adicionarEntrega(page, desc) {
  await abrirDetalhar(page);
  const n = await page.evaluate(() => document.querySelectorAll('.an-entrega[data-entrega]').length);
  await page.fill('#anEntregaDesc', desc);
  await page.click('#anAddEntregaBtn');
  await esperar(page, (k) => document.querySelectorAll('.an-entrega[data-entrega]').length > k && !!document.getElementById('anEntregaFeedback'), n);
}
const analiseDoBanco = async (page, id) => (await banco(page))['analises-organizacionais'][id];

async function entrada(browser) {
  console.log('\n== E. Entrada: Início, Responsabilidades Organizacionais ==');
  let { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#arquitetura?po=atuacoes', { hab: LIB });
  await page.waitForSelector('#anEntradaAtuacoes');
  afirma((await texto(page, '#poAtuacoes h3')).trim() === 'Responsabilidades Organizacionais' && (await texto(page, '#poAtuacoes .avp-intro')).trim() === 'Avalie e acompanhe o posicionamento arquitetural das responsabilidades pelo O1–O9.', 'título e subtítulo da tela de Responsabilidades Organizacionais');
  afirma((await texto(page, '#poNovaAtuacaoBtn')).trim() === 'Nova responsabilidade' && (await texto(page, '#anEntradaNova')).trim() === 'Analisar uma área' && (await page.getAttribute('#anEntradaNova', 'href')) === '#arquitetura?an=nova', 'ações "Nova responsabilidade" e "Analisar uma área"');
  afirma(!(await existe(page, '.an-caminho')) && (await texto(page, '#poRegistradasTitulo')).trim() === 'Responsabilidades registradas' && (await page.$$('#avaliacoesPosicionamento .avp-voltar-link, #avaliacoesPosicionamento #poVoltarLista')).length === 1, 'sem cartões repetidos; "Responsabilidades registradas"; um só "Voltar"');
  await ir(page, '#arquitetura'); await page.waitForSelector('#avpInicioCaminhoB');
  const p1 = await texto(page, '#avpInicioCartaoNatureza'), p2 = await texto(page, '#avpInicioCartaoAtuacao');
  afirma(/Avaliar um Produto\/Serviço/.test(p1) && /Descubra se um item constitui um Produto\/Serviço\./.test(p1) && (await texto(page, '#avpInicioNatureza')).trim() === 'Iniciar avaliação', 'Início: Porta 1 com o texto aprovado');
  afirma(/Porta 2 · Posicionamento das responsabilidades · O1–O9/i.test(p2) &&
    /Avaliar uma responsabilidade/.test(p2) && /Já sabe qual responsabilidade deseja avaliar\?/.test(p2) && /Analisar uma área/.test(p2) && /Cadastre e avalie as responsabilidades de uma gerência, núcleo ou outra área\./.test(p2), 'Início: Porta 2 com as duas atividades (uma responsabilidade, uma área)');
  const [ca, cb] = await page.evaluate(() => ['avpInicioAtuacao', 'avpInicioAnalise'].map((i) => { const e = document.getElementById(i); const r = e.getBoundingClientRect(); return { cls: e.className, txt: e.textContent.trim(), h: r.height }; }));
  afirma(ca.cls === cb.cls && ca.txt === 'Avaliar responsabilidade' && cb.txt === 'Analisar área' && Math.abs(ca.h - cb.h) < 2, 'Início: os dois caminhos com botões de mesmo peso', [ca, cb]);
  await page.click('#avpInicioAnalise'); await page.waitForSelector('#anFormNova');
  afirma(await page.evaluate(() => location.hash) === '#arquitetura?an=nova', 'Caminho B abre "Analisar uma área"');
  await page.goBack(); await page.waitForSelector('#avpInicioCartaoAtuacao');
  await page.click('#avpInicioAtuacao'); await page.waitForSelector('#poFormAtuacao');
  afirma(await page.evaluate(() => location.hash) === '#arquitetura?po=nova-atuacao', 'Caminho A abre o registro da responsabilidade');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
  /* sem controle de disponibilidade: sem marcador ou com o estado antigo de homologação gravado, Avaliação + Configuração
     tem os dois caminhos — o Início mostra o Caminho B e a lista de responsabilidades, "Analisar uma área" */
  for (const [hab, rot] of [[null, 'sem marcador'], ['DESLIGADO', 'estado antigo DESLIGADO'], ['SOMENTE_ADMIN_GERAL', 'estado antigo SOMENTE_ADMIN_GERAL']]) {
    ({ ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#arquitetura?po=atuacoes', { hab }));
    await page.waitForSelector('#poNovaAtuacaoBtn', { timeout: 20000 });
    await page.waitForSelector('#anEntradaAtuacoes', { timeout: 20000 });
    afirma(await existe(page, '#anEntradaNova') && await existe(page, '#poNovaAtuacaoBtn'), rot + ': "Analisar uma área" e "Nova responsabilidade" (o perfil decide, não um marcador)');
    await ir(page, '#arquitetura'); await page.waitForSelector('#avpInicioCartaoAtuacao');
    await esperar(page, () => !!document.getElementById('avpInicioAnalise'));
    afirma(!(await existe(page, '#avpInicioCaminhoBEstado')) && (await texto(page, '#avpInicioAnalise')).trim() === 'Analisar área' && await existe(page, '#avpInicioAtuacao'), rot + ': Início com o Caminho B ("Analisar área") e o Caminho A');
    afirma(!erros.length, rot + ': nenhum erro de página', erros.join(' | '));
    await ctx.close();
  }
}

async function caminhoA(browser) {
  console.log('\n== A. Caminho A: um campo, "Registrar e avaliar" ==');
  const { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#arquitetura?po=atuacoes', { hab: LIB });
  await page.waitForSelector('#poNovaAtuacaoBtn', { timeout: 20000 });
  await page.click('#poNovaAtuacaoBtn'); await page.waitForSelector('#poFormAtuacao');
  const campos = await page.$$eval('#poFormAtuacao input, #poFormAtuacao textarea, #poFormAtuacao select', (l) => l.filter((x) => x.offsetParent && !x.closest('details:not([open])')).map((x) => x.id));
  afirma(campos.join() === 'poAtuacao_descricao' && (await texto(page, '#poFormAtuacao h3')).trim() === 'Qual responsabilidade deseja avaliar?', 'um campo só: "Qual responsabilidade deseja avaliar?"', campos);
  afirma(!/separad|entrega|finalidade|núcleo/i.test(await texto(page, '#poFormAtuacao')) && (await texto(page, '#poSalvarAtuacaoBtn')).trim() === 'Registrar e avaliar', 'sem pergunta sobre separar, entregas, finalidade, tipo ou núcleo; ação "Registrar e avaliar"');
  await page.click('#poSalvarAtuacaoBtn'); await page.waitForSelector('#poAtuacaoErros');
  afirma(/obrigatório/.test(await texto(page, '#poAtuacaoErros')), 'vazio: explica o que falta');
  await page.fill('#poAtuacao_descricao', 'Gerir o planejamento e execução orçamentária.');
  const antes = Object.keys((await banco(page))['objetos-organizacionais'] || {});
  await page.click('#poSalvarAtuacaoBtn');
  await esperar(page, (n) => Object.keys(window.__CFG.__dbReal['objetos-organizacionais'] || {}).length > n, antes.length);
  const objs = (await banco(page))['objetos-organizacionais'], novo = Object.keys(objs).find((k) => antes.indexOf(k) === -1), o = objs[novo];
  afirma(o.nome === 'Gerir o planejamento e execução orçamentária.' && o.descricao === o.nome && o.finalidade === o.nome && /nada foi inferido/.test(o.contexto), 'o texto, sem reescrita, preenche o cadastro (o registro diz que nada foi inferido)', o.contexto);
  await page.waitForSelector('#poIniciarAtuacaoBtn', { timeout: 20000 });
  afirma(/Iniciar a avaliação O1–O9/.test(await texto(page, '#poIniciarAtuacaoBtn')) && /indique sua hipótese inicial/.test(await texto(page, '#poProximoPasso')) && /hipótese inicial/.test(await texto(page, '#avaliacoesPosicionamento')), 'abre o O1–O9 da responsabilidade (hipótese inicial e "Iniciar o Posicionamento")');
  afirma(!Object.keys((await banco(page))['analises-organizacionais'] || {}).length, 'nenhuma análise criada: Caminho A não passa pela Análise Organizacional');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
}

async function governanca(browser) {
  console.log('\n== F. F2b opcional ==');
  const { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#arquitetura?an=lista', { hab: LIB });
  await page.waitForSelector('#anNovaBtn', { timeout: 20000 });
  await ir(page, '#arquitetura?an=nova'); await page.waitForSelector('#anFormNova');
  afirma(await prop(page, 'input[name="anTemAtuacao"][value="nao"]', 'checked') && /Você quer aprofundar uma responsabilidade organizacional já registrada na Porta 2\?/.test(await texto(page, '#anAprofunda legend')) && await prop(page, '#anFormNova input[value="estrutura"]', 'checked'), 'nova análise: responsabilidade prévia opcional ("Não"); escopo já marcado');
  const id = await abrirAnalise(page, 'TESTE — Núcleo de Governança de TI', null);
  await page.waitForSelector('#anFormResponder[data-q="F2b"]', { state: 'attached' });
  afirma(!(await prop(page, '#anObjeto', 'open')), 'a pergunta do cadastro na Gestão fica fora da jornada principal (em "Mais sobre a área", recolhido)');
  await page.click('#anObjeto > summary'); await page.waitForSelector('#anFormResponder[data-q="F2b"]');
  afirma(/Pergunta opcional/.test(await texto(page, '#anPergunta')) && /Essa estrutura já está cadastrada na Gestão da Floresta/.test(await texto(page, '#anPerguntaTitulo')) && await prop(page, '#anEstruturaCadastrada', 'disabled'), 'F2b: opcional, com o campo dependente desabilitado');
  await page.focus('#anFormResponder input[name="anResposta"][value="cadastrada"]');
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab');
  afirma(!(await prop(page, '#anEstruturaCadastrada', 'disabled')) && (await focado(page)) === 'anEstruturaCadastrada', 'F2b: "Está cadastrada" pelo teclado habilita; Tab chega ao campo');
  await page.selectOption('#anEstruturaCadastrada', 'nucleo-gov');
  await page.check('#anFormResponder input[name="anResposta"][value="nao-cadastrada"]');
  afirma(await prop(page, '#anEstruturaCadastrada', 'disabled') && (await prop(page, '#anEstruturaCadastrada', 'value')) === '', 'F2b: trocar desabilita e limpa');
  await responderF2b(page, 'nao-cadastrada');
  const a = await analiseDoBanco(page, id);
  afirma(a.respostas.F2b.valor === 'nao-cadastrada' && !('estruturaId' in a.respostas.F2b) && !a.estruturaReferidaId, 'F2b: gravada sem estrutura');
  const recusa = await page.evaluate((i) => { const N = window.faAnalisesOrganizacionaisNucleo, F = window.faAnalisesFirebase; const est = F.estadoDoBanco({ analises: window.__CFG.__dbReal['analises-organizacionais'], propostas: {}, aprovacoes: {} });
    const r = N.responder(est, i, { pergunta: 'F2b', valor: { valor: 'informal', estruturaId: 'nucleo-gov' } }, { operacaoId: 'x', usuario: { id: 'u' }, agora: Date.now() }); return r.ok ? 'aceitou' : r.erros[0].codigo; }, id);
  afirma(recusa === 'ESTRUTURA_INCOMPATIVEL_COM_RESPOSTA', 'F2b: a validação está no núcleo');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
}

async function gecon(browser) {
  console.log('\n== G. GECON: área da Estrutura Atual, dez e depois doze responsabilidades, núcleos, O1–O9 e volta ==');
  const { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#arquitetura?an=lista', { hab: LIB });
  await page.waitForSelector('#anNovaBtn', { timeout: 20000 });
  afirma((await texto(page, '#avaliacoesAnalise h2')).trim() === 'Análises Organizacionais' && /Acompanhe as responsabilidades de cada área\./.test(await texto(page, '#avaliacoesAnalise')) && (await texto(page, '#anNovaBtn')).trim() === 'Nova análise', 'lista: "Análises Organizacionais", com "Nova análise"');
  await ir(page, '#arquitetura?an=nova'); await page.waitForSelector('#anUnidadeAtual', { timeout: 20000 });
  const visiveis = await page.$$eval('#anFormNova input, #anFormNova textarea, #anFormNova select', (l) => l.filter((x) => x.offsetParent && !x.closest('details:not([open])')).map((x) => x.id));
  afirma(visiveis.join() === 'anUnidadeAtual,anNome' && /Continuar para as responsabilidades/.test(await texto(page, '#anCriarBtn')) && !(await prop(page, '#anNovaAvancado', 'open')), 'Passo 1: escolher a área na Estrutura Atual (ou digitar o nome); opções avançadas recolhidas', visiveis);
  await page.selectOption('#anUnidadeAtual', 'ua-gecon');
  afirma((await prop(page, '#anNome', 'value')) === 'GECON — Gerência de Contabilidade e Controladoria', 'escolher a unidade preenche o nome');
  await page.click('#anCriarBtn');
  await esperar(page, () => /an=(?!nova|lista)/.test(location.hash) && !!document.getElementById('anTitulo'));
  const id = await page.evaluate(() => decodeURIComponent(/an=([^&]*)/.exec(location.hash)[1]));
  afirma((await analiseDoBanco(page, id)).unidadeAtualId === 'ua-gecon' && /GECON — Gerência de Contabilidade e Controladoria/.test(await texto(page, '#anUnidadeAtualInfo')), 'a análise guarda a unidade escolhida (referência descritiva)');
  /* Passo 2: colar, conferir a prévia, registrar — sem pergunta sobre separar */
  await page.waitForSelector('#anLoteTexto');
  afirma(/Adicionar responsabilidades/.test(await texto(page, '#anIrProxima')) && (await texto(page, '#anLoteTitulo')).trim() === 'Cole suas responsabilidades, uma por linha.' && await existe(page, '#anAbrirUma'), 'Passo 2: o lote é a ação principal ("Cole suas responsabilidades, uma por linha."); "Adicionar uma por vez" continua');
  afirma(!/precisa(m)? (ser )?separ|Definir delimitação|Pendente de delimitação/i.test(await texto(page, '#avaliacoesAnalise')), 'nenhuma pergunta sobre separar, nem "Definir delimitação" ou "Pendente de delimitação"');
  const colado = GECON.map((t, i) => (i + 1) + '. ' + t).join('\n') + '\n\n8. Gerir o processo contábil.\n';
  await page.fill('#anLoteTexto', colado);
  await page.check('#anLoteNumeracao'); await page.click('#anLotePrevia'); await page.waitForSelector('#anLoteLista');
  let itens = await page.$$eval('#anLoteLista [id^="anLoteTxt_"]', (l) => l.map((x) => x.textContent));
  afirma(itens.length === 11 && itens.slice(0, 10).every((t, i) => t === GECON[i]), 'prévia: a pedido, só a numeração sai; textos literais, na ordem', itens);
  afirma(await existe(page, '#anLoteDup_10') && !(await prop(page, '#anLoteInc_10', 'checked')) && (await texto(page, '#anLoteRegistrar')).trim() === 'Registrar 10 responsabilidades', 'duplicada desmarcada pedindo confirmação; botão com a contagem');
  await page.click('#anLoteEditar_3'); await page.waitForSelector('#anLoteItem_3');
  await page.fill('#anLoteItem_3', GECON[3]); await page.click('#anLoteEditar_3'); await page.waitForSelector('#anLoteTxt_3');
  await page.uncheck('#anLoteInc_0'); afirma((await texto(page, '#anLoteRegistrar')).trim() === 'Registrar 9 responsabilidades', 'editar e desmarcar na prévia; a contagem acompanha');
  await page.check('#anLoteInc_0');
  await page.click('#anLoteRegistrar');
  await esperar(page, () => document.querySelectorAll('.an-linha[data-resp]').length === 10 && !!document.getElementById('anLoteFeedback'));
  let a = await analiseDoBanco(page, id);
  const ks = Object.keys(a.recortes).sort((x, y) => a.recortes[x].ordem - a.recortes[y].ordem), k = (i) => ks[i];
  afirma(ks.length === 10 && ks.every((kk, i) => a.recortes[kk].descricao === GECON[i] && a.recortes[kk].contrato === 'registro-direto' && !a.recortes[kk].separacao), 'as dez gravadas de uma vez, como registro direto (sem resposta "não" inventada)');
  /* Passo 3: lista única, todas prontas, ação direta */
  afirma(ks.every((kk) => true) && (await page.$$eval('.an-linha[data-resp]', (l) => l.every((x) => x.getAttribute('data-situacao') === 'pronta'))), 'Passo 3: as dez "Pronta para avaliar"');
  afirma(/10 responsabilidades — 10 prontas para avaliar\./.test(await texto(page, '#anResumo')) && /prontas para avaliar/.test(await texto(page, '#anLoteFeedback')), 'resumo e confirmação dizem que estão prontas');
  const cab = await texto(page, '.an-tab-cab');
  afirma(/Responsabilidade/.test(cab) && /Quem executa hoje/.test(cab) && /Tipo recomendado/.test(cab) && /Situação/.test(cab) && /Ação/.test(cab), 'colunas: Responsabilidade, Quem executa hoje, Tipo recomendado, Situação, Ação');
  afirma((await texto(page, '#anCriarAtuacao_' + k(0))).trim() === 'Avaliar' && await existe(page, '#anMais_' + k(0)) && !(await prop(page, '#anMais_' + k(0), 'open')), 'ação "Avaliar" na linha; o resto em "Mais" (recolhido)');
  afirma((await texto(page, '#anIrProxima')).trim() === 'Avaliar próxima', 'próximo passo: "Avaliar próxima"');
  /* 12: mais duas — uma por vez e outra pelo lote */
  await page.evaluate(() => { document.getElementById('anRegistrar').open = true; }); await page.click('#anAbrirUma'); await page.waitForSelector('#anRespDesc');
  await page.fill('#anRespDesc', 'Gerir a conformidade fiscal das operações.'); await page.click('#anRegistrarRespBtn');
  await esperar(page, () => document.querySelectorAll('.an-linha[data-resp]').length === 11 && !!document.getElementById('anRespFeedback'));
  await page.click('#anAbrirLote'); await page.fill('#anLoteTexto', 'Elaborar as demonstrações contábeis.'); await page.click('#anLotePrevia'); await page.waitForSelector('#anLoteLista'); await page.click('#anLoteRegistrar');
  await esperar(page, () => document.querySelectorAll('.an-linha[data-resp]').length === 12);
  afirma(/12 responsabilidades — 12 prontas para avaliar\./.test(await texto(page, '#anResumo')), 'doze responsabilidades, todas prontas (uma por vez ou pelo lote, o mesmo contrato)');
  /* editar o texto antes de avaliar: com versão e histórico */
  await page.click('#anMais_' + k(3) + ' > summary'); await page.click('#anRevisar_' + k(3)); await page.waitForSelector('#anFormRevisar');
  afirma(!(await existe(page, 'input[name="anRevSep"]')) && /Editar o texto/.test(await texto(page, '#anFormRevisar h4')), 'editar o texto: só a descrição (sem pergunta sobre separar)');
  await page.fill('#anRevDesc', GECON[3] + ' (anual)'); await page.click('#anGravarRevisao');
  await esperar(page, (kk) => /\(anual\)/.test((document.querySelector('.an-linha[data-resp="' + kk + '"]') || {}).textContent || ''), k(3));
  a = await analiseDoBanco(page, id);
  afirma(a.recortes[k(3)].versao === 2 && a.recortes[k(3)].contrato === 'registro-direto', 'edição gravada com versão 2, o contrato continua');
  /* quem executa hoje: unidades da Estrutura Atual (da GECON primeiro) */
  await page.click('#anMais_' + k(7) + ' > summary'); await page.click('#anNucleos_' + k(7)); await page.waitForSelector('#anFormNucleos');
  const opUA = await page.$$eval('#anNucUAGrupo input[name="anNucUA"]', (l) => l.map((x) => x.value));
  afirma(opUA.join() === 'ua-conta,ua-nucot,ua-nutes,ua-nutri' && await existe(page, '#anNucUAOutras'), 'quem executa hoje: os núcleos da GECON primeiro; as outras unidades recolhidas', opUA);
  await page.check('#anNucUAGrupo input[value="ua-conta"]'); await page.click('#anGravarNucleos');
  await esperar(page, (kk) => /CONTA/.test((document.getElementById('anNucleosTexto_' + kk) || {}).textContent || ''), k(7));
  await page.click('#anMais_' + k(8) + ' > summary'); await page.click('#anNucleos_' + k(8)); await page.waitForSelector('#anFormNucleos');
  await page.check('#anNucUAGrupo input[value="ua-conta"]'); await page.check('#anNucUAGrupo input[value="ua-nutri"]'); await page.click('#anGravarNucleos');
  await esperar(page, (kk) => /NUTRI/.test((document.getElementById('anNucleosTexto_' + kk) || {}).textContent || ''), k(8));
  a = await analiseDoBanco(page, id);
  afirma(a.recortes[k(7)].fatos.execucao.map((f) => f.unidadeAtualId).join() === 'ua-conta' && a.recortes[k(8)].fatos.execucao.map((f) => f.unidadeAtualId).sort().join() === 'ua-conta,ua-nutri', 'CONTA em "Gerir o processo contábil"; CONTA e NUTRI nas obrigações legais');
  afirma([0, 1, 2, 4, 5, 6, 9].every((i) => !a.recortes[k(i)].fatos) && /Não informado/.test(await texto(page, '#anNucleosTexto_' + k(4))), 'as outras sem núcleo ("Não informado"; nada inferido)');
  /* texto livre antigo: só passa a apontar a unidade com confirmação */
  await page.click('#anMais_' + k(0) + ' > summary'); await page.click('#anNucleos_' + k(0)); await page.waitForSelector('#anFormNucleos');
  await page.fill('#anNucOutros', 'CONTA — Núcleo de Contabilidade'); await page.click('#anGravarNucleos');
  await esperar(page, (kk) => /CONTA/.test((document.getElementById('anNucleosTexto_' + kk) || {}).textContent || ''), k(0));
  afirma((await analiseDoBanco(page, id)).recortes[k(0)].fatos.execucao[0].texto === 'CONTA — Núcleo de Contabilidade', 'texto livre fica como texto (nada associado pelo nome)');
  await page.click('#anMais_' + k(0) + ' > summary'); await page.click('#anNucleos_' + k(0)); await page.waitForSelector('#anNucRelGrupo');
  afirma(!(await prop(page, '#anNucRelGrupo input[name="anNucRel"]', 'checked')) && /é a unidade/.test(await texto(page, '#anNucRelGrupo')), 'sugestão de relacionar o texto à unidade CONTA, desmarcada (só com confirmação)');
  await page.check('#anNucRelGrupo input[name="anNucRel"]'); await page.click('#anGravarNucleos');
  await esperar(page, (i) => { const x = window.__CFG.__dbReal['analises-organizacionais'][i[0]].recortes[i[1]].fatos; return x && x.execucao.length === 1 && x.execucao[0].unidadeAtualId === 'ua-conta'; }, [id, k(0)]);
  afirma(true, 'confirmado: o texto passa a apontar a unidade CONTA (o anterior fica no histórico)');
  /* composição por unidade */
  await page.click('#anComposicaoSecao > summary');
  const comp = await texto(page, '#anComposicaoAtual');
  afirma(/CONTA — Núcleo de Contabilidade.*Estrutura Organizacional Atual · 3 responsabilidades/.test(comp) && /NUTRI — Núcleo Tributário.*1 responsabilidade/.test(comp) && /compartilhada com/.test(comp) && /Sem núcleo informado/.test(comp), 'composição agrupada por unidade da Estrutura Atual (CONTA com três, uma compartilhada com NUTRI)', comp.slice(0, 300));
  const q4 = await texto(page, '#anComposicaoAtual li[data-comp-resp="' + k(7) + '"]');
  afirma(/Tipo arquitetural recomendadoA determinar pelo O1–O9/.test(q4) && /Estrutura com vínculo formal registradoNenhum registrado/.test(q4) && /Proposta de composição e aprovaçãoNenhuma proposta registrada/.test(q4), 'as cinco distinções continuam: execução, tipo O1–O9, vínculo formal, proposta e aprovação');
  const db0 = await banco(page);
  afirma(Object.keys(db0['estruturas-concretas'].registros).length === Object.keys(sementeAnalise()['estruturas-concretas'].registros).length && JSON.stringify(db0['estrutura-atual-unidades']) === JSON.stringify(sementeAnalise()['estrutura-atual-unidades']), 'nada mudou nas Estruturas do Mapa nem na Estrutura Atual');
  /* avaliar direto pelo O1–O9 e voltar à lista */
  await page.click('#anCriarAtuacao_' + k(7));
  await esperar(page, () => /po=atuacoes&item=/.test(location.hash));
  const obj = await page.evaluate(() => decodeURIComponent(/item=([^&]*)/.exec(location.hash)[1]));
  const db1 = await banco(page);
  afirma(db1['objetos-organizacionais'][obj].nome === 'Gerir o processo contábil.' && db1['analises-por-objeto'][obj].recorteId === k(7), '"Avaliar": registra na Porta 2 com o texto literal e a origem e abre o O1–O9');
  await page.waitForSelector('#anVoltarAnalise', { timeout: 20000 });
  await page.click('#anVoltarAnalise'); await page.waitForSelector('#anResponsabilidades');
  await gravarDb(page, { ['avaliacoes-posicionamento/pos-r-' + obj]: { itemId: obj, itemNome: 'x', status: 'rascunho', origem: 'objeto-organizacional', versao: 1, revisao: 1 }, ['posicionamento-rascunho-por-item/' + obj]: 'pos-r-' + obj });
  await esperar(page, (kk) => /Em avaliação/.test((document.getElementById('anSituacao_' + kk) || {}).textContent || ''), k(7));
  afirma((await texto(page, '#anIrProxima')).trim() === 'Continuar avaliação' && (await page.getAttribute('#anIrProxima', 'href')) === '#arquitetura?po=pos-r-' + obj && /Continuar/.test(await texto(page, '#anAbrirPos_' + k(7))), 'em andamento: "Continuar avaliação" no próximo passo e "Continuar" na linha');
  await gravarDb(page, { ['avaliacoes-posicionamento/pos-' + obj]: { itemId: obj, itemNome: 'Gerir o processo contábil.', status: 'concluido', origem: 'objeto-organizacional', versao: 1, revisao: 2, hipoteseInicial: 'NAO_SEI', resultadoAutomatico: { codigoResultado: 'AREA_ESPECIALIZADA', motivo: 'PAPEL_UNICO', regra: 'R', papeisDetectados: ['AREA_ESPECIALIZADA'] }, concluidoEm: '2026-10-14T12:00:00.000Z' },
    ['posicionamento-vigente-por-item/' + obj]: 'pos-' + obj, ['posicionamento-rascunho-por-item/' + obj]: null });
  await esperar(page, (kk) => /Avaliada/.test((document.getElementById('anSituacao_' + kk) || {}).textContent || ''), k(7));
  afirma(/Ver resultado/.test(await texto(page, '#anAbrirPos_' + k(7))) && /\(recomendação\)$/.test((await texto(page, '#anTipo_' + k(7))).trim()) && (await texto(page, '#anIrProxima')).trim() === 'Avaliar próxima', 'concluída: "Avaliada", "Ver resultado"; o próximo passo volta a "Avaliar próxima"');
  afirma(/^12 responsabilidades — 1 avaliada e 11 prontas para avaliar\.$/.test((await texto(page, '#anResumo')).trim()), 'resumo dos estados reais', await texto(page, '#anResumo'));
  /* resultado do O1–O9: "Voltar às responsabilidades da GECON" */
  await ir(page, '#arquitetura?po=pos-' + obj);
  await page.waitForSelector('#anVoltarResponsabilidades', { timeout: 20000 });
  afirma((await texto(page, '#anVoltarResponsabilidades')).trim() === 'Voltar às responsabilidades da GECON', 'no resultado do O1–O9: "Voltar às responsabilidades da GECON"');
  await page.click('#anVoltarResponsabilidades'); await page.waitForSelector('#anResponsabilidades');
  afirma(await page.evaluate((i) => location.hash === '#arquitetura?an=' + encodeURIComponent(i), id), 'volta à lista da GECON para avaliar a próxima');
  /* lista de análises: contagens, próxima ação e homônimas */
  await gravarDb(page, { ['analises-organizacionais/an-homonima']: Object.assign({}, a, { id: 'an-homonima', recortes: {}, revisao: 1, criadaEm: 1791713600000, auditoriaId: 'aud-h' }) });
  await ir(page, '#arquitetura?an=lista'); await page.waitForSelector('#anItemContagem_' + id); await page.waitForSelector('#anItemAcao_an-homonima');
  afirma(/12 responsabilidades — 11 prontas · 1 avaliada/.test(await texto(page, '#anItemContagem_' + id)) && (await texto(page, '#anItemAcao_' + id)).trim() === 'Continuar análise' && (await texto(page, '#anItemAcao_an-homonima')).trim() === 'Adicionar responsabilidades', 'lista de análises: contagens reais e a próxima ação de cada uma', [await texto(page, '#anItemContagem_' + id), await texto(page, '#anItemAcao_' + id), await texto(page, '#anLista')]);
  afirma(/Aberta em/.test(await texto(page, '#anItemContexto_' + id)) && /código/.test(await texto(page, '#anItemContexto_an-homonima')), 'nomes repetidos: data, situação e código distinguem as análises');
  /* F5: retomada */
  await ir(page, '#arquitetura?an=' + encodeURIComponent(id)); await page.waitForSelector('#anResponsabilidades');
  await recarregar(page, ctx);
  await page.waitForSelector('#anResponsabilidades', { timeout: 20000 });
  afirma((await page.$$('.an-linha[data-resp]')).length === 12 && (await situacaoDe(page, k(7))) === 'Avaliada', 'F5: a mesma lista e os mesmos estados');
  await page.click('#anHistorico > summary');
  await esperar(page, () => { const h = document.getElementById('anHistorico').textContent; return /registradas de uma vez/.test(h) && /Núcleos atuais informados/.test(h); });
  afirma(true, 'histórico: lote e núcleos');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
}

async function legado(browser) {
  console.log('\n== L. Registros anteriores: regras preservadas, nenhuma conversão silenciosa ==');
  const db = comLegado(sementeAnalise(LIB)), T = 1791713600000, por = { id: 'u-x', email: ARQ };
  const r = (id, sep, ordem) => ({ id, descricao: 'Anterior ' + id, nome: 'Anterior ' + id, resultado: null, justificativa: null, entregas: {}, capacidades: {}, objetoId: null, fatos: null, separacao: sep ? { valor: sep, em: T, por } : null, situacao: 'ativo', versao: 1, ordem, criadoEm: T, criadoPor: por });
  Object.assign(db['analises-organizacionais']['an-legado'].recortes, { rq1: r('rq1', null, 1), rq2: r('rq2', 'nao-sei', 2), rq3: r('rq3', 'sim', 3) });
  const { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#arquitetura?an=an-legado', { db });
  await page.waitForSelector('#anObjetoF2b', { timeout: 20000, state: 'attached' });
  afirma(/É informal/.test(await texto(page, '#anObjetoF2b')) && !/Núcleo de Governança/.test(await texto(page, '#avaliacoesAnalise')), 'F2b incoerente: a estrutura não aparece');
  afirma((await situacaoDe(page, 'rl1')) === 'Pronta para avaliar' && await existe(page, '#anCriarAtuacao_rl1') && await prop(page, '#anDetalhar', 'open'), 'delimitada pelas entregas (anterior): pronta; o detalhamento abre com as entregas');
  afirma((await situacaoDe(page, 'rq1')) === 'Pendente de delimitação' && (await situacaoDe(page, 'rq2')) === 'Pendente de delimitação' && /Registro anterior/.test(await texto(page, '.an-linha[data-resp="rq1"]')), 'anteriores sem resposta ou com "Não sei": continuam pendentes, marcados como registro anterior (nenhum "não" presumido)');
  afirma(await existe(page, '#anDelimitar_rq2') && await existe(page, '#anSeparar_rq3'), 'anteriores mantêm "Definir delimitação" e "Separar"');
  let a = (await banco(page))['analises-organizacionais']['an-legado'];
  afirma(a.estruturaReferidaId === 'nucleo-gov' && !a.recortes.rq1.contrato, 'abrir não grava nada nem converte');
  await page.click('#anDelimitar_rq2'); await page.waitForSelector('#anSepNao_rq2'); await page.click('#anSepNao_rq2');
  await esperar(page, () => !!document.getElementById('anCriarAtuacao_rq2'));
  a = (await banco(page))['analises-organizacionais']['an-legado'];
  afirma(a.recortes.rq2.separacao.valor === 'nao' && !a.recortes.rq2.contrato && !a.recortes.rq1.separacao, 'só a resposta explícita da pessoa muda um anterior; os outros ficam como estavam');
  await page.click('#anSeparar_rq3'); await page.waitForSelector('#anFormSeparar');
  afirma(!(await existe(page, '#anFormSeparar input[type="radio"]')), 'separar um anterior: as partes não pedem resposta (entram prontas)');
  await page.fill('#anParteDesc0', 'Parte um'); await page.fill('#anParteDesc1', 'Parte dois'); await page.click('#anConfirmarSeparar');
  await esperar(page, () => !!document.querySelector('[data-desdobrada="rq3"]'));
  a = (await banco(page))['analises-organizacionais']['an-legado'];
  const partes = Object.values(a.recortes).filter((x) => x.origemRecorteId === 'rq3');
  afirma(partes.length === 2 && partes.every((x) => x.contrato === 'registro-direto'), 'as partes entram como registro direto; a original fica guardada');
  await page.evaluate(() => { document.getElementById('anRegistrar').open = true; }); await page.click('#anAbrirUma'); await page.waitForSelector('#anRespDesc');
  await page.fill('#anRespDesc', 'Gerir o processo contábil.'); await page.click('#anRegistrarRespBtn');
  await esperar(page, () => !!document.getElementById('anRespFeedback'));
  a = (await banco(page))['analises-organizacionais']['an-legado'];
  afirma(!a.estruturaReferidaId && !('estruturaId' in a.respostas.F2b) && !a.recortes.rl1.separacao, 'a próxima gravação corrige só a F2b incoerente; os anteriores ficam como eram');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
}

async function perfis(browser) {
  console.log('\n== K. Consulta e 375 px ==');
  let { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#arquitetura?an=an-legado', { db: comLegado(sementeAnalise(LIB)), email: AVAL });
  await page.waitForSelector('#anResponsabilidades', { timeout: 20000 });
  afirma(!(await existe(page, '#anFormResponsabilidade')) && !(await existe(page, '#anFormLote')) && !(await existe(page, '[id^="anMais_"]')) && /consultando/.test(await texto(page, '#anProximaAcao')), 'consulta: vê a lista, sem formulários nem "Mais"');
  await ctx.close();
  ({ ctx, page, erros } = await abrir(browser, { width: 375, height: 812 }, '#arquitetura?po=atuacoes', { hab: LIB }));
  await page.waitForSelector('#anEntradaAtuacoes');
  afirma(await larguraOk(page) && !(await estouro(page)).length, '375: Responsabilidades Organizacionais sem rolagem lateral nem corte');
  await page.click('#poNovaAtuacaoBtn'); await page.waitForSelector('#poFormAtuacao');
  afirma(await larguraOk(page) && !(await estouro(page)).length, '375: Caminho A sem corte');
  await ir(page, '#arquitetura?an=nova'); await page.waitForSelector('#anUnidadeAtual', { timeout: 20000 });
  afirma(await larguraOk(page) && !(await estouro(page)).length, '375: "Analisar uma área" (com a Estrutura Atual) sem corte');
  await page.selectOption('#anUnidadeAtual', 'ua-gecon'); await page.click('#anCriarBtn');
  await esperar(page, () => /an=(?!nova|lista)/.test(location.hash) && !!document.getElementById('anLoteTexto'));
  await page.fill('#anLoteTexto', GECON.join('\n')); await page.click('#anLotePrevia'); await page.waitForSelector('#anLoteLista');
  afirma(await larguraOk(page) && !(await estouro(page)).length, '375: prévia do lote sem corte');
  await page.click('#anLoteRegistrar');
  await esperar(page, () => document.querySelectorAll('.an-linha[data-resp]').length === 10);
  const k0 = await linhaDe(page, GECON[0]);
  await page.click('#anMais_' + k0 + ' > summary'); await page.click('#anNucleos_' + k0); await page.waitForSelector('#anFormNucleos');
  const corte = await estouro(page);
  afirma(await larguraOk(page) && !corte.length, '375: lista das dez (cartões empilhados) e o formulário de quem executa sem corte', corte);
  await page.check('#anNucUAGrupo input[value="ua-conta"]'); await page.check('#anNucUAGrupo input[value="ua-nutri"]'); await page.click('#anGravarNucleos');
  await esperar(page, (kk) => /NUTRI/.test((document.getElementById('anNucleosTexto_' + kk) || {}).textContent || ''), k0);
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.getElementById('anResponsabilidades').scrollIntoView({ block: 'start' }); }); await page.waitForTimeout(400);
  const nav = await page.evaluate(() => { const n = document.querySelector('.site-nav, nav'); const l = document.getElementById('anResponsabilidades'); return n ? { nav: n.getBoundingClientRect().bottom, lista: l.getBoundingClientRect().top } : null; });
  afirma(!nav || nav.lista >= nav.nav - 1, '375: a lista não fica atrás do menu fixo', nav);
  await page.evaluate(() => { const d = document.getElementById('anComposicaoSecao'); d.open = true; d.querySelectorAll('.an-quatro-det').forEach((x) => { x.open = true; }); });
  await page.waitForTimeout(300);
  const corteC = await estouro(page);
  afirma(await larguraOk(page) && !corteC.length, '375: composição aberta, com detalhes e responsabilidade compartilhada, sem corte', corteC);
  const alturas = await page.$$eval('#avaliacoesAnalise .btn:not(.an-link), #avaliacoesAnalise .an-opcao', (ls) => ls.filter((l) => l.offsetParent).map((l) => l.getBoundingClientRect().height));
  afirma(alturas.every((h) => h >= 40), '375: alvos de toque com pelo menos 40 px', Math.min.apply(null, alturas));
  await ir(page, '#arquitetura?an=lista'); await page.waitForSelector('#anLista');
  afirma(await larguraOk(page) && !(await estouro(page)).length, '375: lista de análises (contagens e próxima ação) sem corte');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await entrada(browser);
    await caminhoA(browser);
    await governanca(browser);
    await gecon(browser);
    await legado(browser);
    await perfis(browser);
  } catch (e) { console.log('ERRO', e && e.stack || e); falhas++; }
  await browser.close();
  console.log('\n' + total + ' verificações — ' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})();
