/* Porta 2 · ANÁLISE ORGANIZACIONAL — usabilidade: Responsabilidade Organizacional, lista única, lote e composição.
 * Firebase falso em persistência real; hermético; o banco é o da página (nada vai para produção). Os cenários são de
 * homologação ("Gerência de Contabilidade e Controladoria — GECON" com as dez atribuições fornecidas; "TESTE — Núcleo de
 * Governança de TI"); nenhuma classificação, núcleo ou vínculo é presumido. Prova, pela interface:
 *   E. Entrada: dois caminhos (A direto, B assistido) que convergem para o O1–O9; telas da Porta 2 com "Responsabilidade
 *      organizacional"; Início com Porta 1/Porta 2; DESLIGADO e SOMENTE_ADMIN_GERAL = Porta 2 de antes.
 *   A. Caminho A: "Gerir o planejamento e execução orçamentária." colada, "Não" → registrada (nome, descrição e finalidade
 *      com o mesmo texto, declarado no contexto) e pronta para o O1–O9; "Sim" → vai para uma análise, com o texto intacto.
 *   F. F2b opcional: estrutura só com "Está cadastrada"; trocar limpa; teclado; recusa no núcleo.
 *   G. GECON: colar as dez atribuições (numeração tirada só a pedido), prévia, duplicidade com confirmação, correção na
 *      prévia, gravação única; lista única com situação e ação por responsabilidade; responder "precisa separar?" na
 *      lista (Não / Sim / Não sei); separar em partes; núcleos informados à mão (um, vários; o mesmo em várias; nenhum
 *      inferido); Avaliar → Porta 2 → voltar à lista; Continuar e Ver resultado conforme o estado real; composição
 *      agrupada por núcleo, sem duplicar avaliação, separando situação atual, resultado, proposta e decisão; nada no Mapa.
 *   D. Detalhamento opcional por entregas; "Não consigo identificar entregas".
 *   L. Registros anteriores (com entregas) continuam avaliáveis; F2b incoerente corrigida só na próxima gravação.
 *   K. Consulta só lê; 375 px sem rolagem lateral nem corte. */
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
  await ir(page, '#avaliacoes?an=nova'); await page.waitForSelector('#anFormNova');
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
async function abrirDetalhar(page) {
  if (!(await page.evaluate(() => { const d = document.getElementById('anDetalhar'); return !!(d && d.open); }))) await page.click('#anDetalhar > summary');
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
  console.log('\n== E. Entrada: dois caminhos, Porta 1/Porta 2 ==');
  let { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#avaliacoes?po=atuacoes', { hab: LIB });
  await page.waitForSelector('#anEntradaAtuacoes');
  const t = await texto(page, '#anEntradaAtuacoes');
  afirma(/Caminho A · Direto/.test(t) && /Já sei qual responsabilidade quero avaliar/.test(t) && /Nova responsabilidade organizacional/.test(await texto(page, '#anCaminhoDireto #poNovaAtuacaoBtn')), 'Caminho A — Direto');
  afirma(/Caminho B · Assistido/.test(t) && await existe(page, '#anCaminhoAssistido #anEntradaNova') && /terminam na mesma avaliação O1–O9/.test(t), 'Caminho B — Assistido; os dois terminam no mesmo O1–O9');
  afirma(/Porta 1 \(Produto\/Serviço, P1–P16\) é opcional/.test(t) && /Squad vem depois/.test(t) && /não é uma entrada de avaliação/.test(t), 'Porta 1 opcional; Squad depois; Mapa não é entrada');
  const lista = (await texto(page, '#poAtuacoes h3')) + ' ' + (await texto(page, '#poAtuacoes .avp-intro'));
  afirma(/^Responsabilidades organizacionais/.test(lista.trim()) && !/[Aa]tuaç/.test(lista), 'listagem da Porta 2 em "Responsabilidades organizacionais"');
  await ir(page, '#avaliacoes'); await page.waitForSelector('#avpInicioCaminhoB');
  afirma(/^Porta 1$/.test((await texto(page, '#avpInicioCartaoNatureza .avp-inicio-caminho')).trim()) && /^Porta 2/.test((await texto(page, '#avpInicioCartaoAtuacao .avp-inicio-caminho')).trim()) && (await page.getAttribute('#avpInicioAnalise', 'href')) === '#avaliacoes?an=nova', 'Início: Porta 1 e Porta 2, com o atalho do Caminho B');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
  for (const [hab, rot] of [[null, 'DESLIGADO'], ['SOMENTE_ADMIN_GERAL', 'SOMENTE_ADMIN_GERAL (Avaliação + Configuração)']]) {
    ({ ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#avaliacoes?po=atuacoes', { hab }));
    await page.waitForSelector('#poNovaAtuacaoBtn', { timeout: 20000 }); await page.waitForTimeout(600);
    afirma(!(await existe(page, '#anEntradaAtuacoes')) && await existe(page, '.avp-actions-bar #poNovaAtuacaoBtn'), rot + ': Porta 2 como antes');
    await page.click('#poNovaAtuacaoBtn'); await page.waitForSelector('#poFormAtuacao');
    afirma(await existe(page, '#poAtuacao_finalidade') && !(await existe(page, 'input[name="poSeparar"]')), rot + ': o cadastro direto continua o de antes (sem a Análise Organizacional)');
    await ctx.close();
  }
}

async function caminhoA(browser) {
  console.log('\n== A. Caminho A: colar a atribuição, "Não precisa separar", O1–O9 ==');
  const { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#avaliacoes?po=atuacoes', { hab: LIB });
  await page.waitForSelector('#poNovaAtuacaoBtn', { timeout: 20000 });
  await page.waitForSelector('#anEntradaAtuacoes');
  await page.click('#poNovaAtuacaoBtn'); await page.waitForSelector('input[name="poSeparar"]');
  const campos = await page.$$eval('#poFormAtuacao input:not([type=radio]), #poFormAtuacao textarea, #poFormAtuacao select', (l) => l.filter((x) => x.offsetParent && !x.closest('details:not([open])')).map((x) => x.id));
  afirma(campos.join() === 'poAtuacao_descricao', 'um campo visível só: a descrição (o resto fica em "Mais informações", opcional)', campos);
  afirma(/Você pode copiar diretamente uma atribuição da área\. Não precisa reformular o texto\./.test(await texto(page, '#poDescAjuda')) && /Essa descrição reúne trabalhos diferentes que precisam ser avaliados separadamente\?/.test(await texto(page, '#poSepararGrupo legend')), 'ajuda e pergunta do cadastro simples');
  await page.fill('#poAtuacao_descricao', 'Gerir o planejamento e execução orçamentária.');
  await page.click('#poSalvarAtuacaoBtn');
  await page.waitForSelector('#poAtuacaoErros');
  afirma(/Responda se a descrição reúne trabalhos diferentes/.test(await texto(page, '#poAtuacaoErros')) && (await prop(page, '#poAtuacao_descricao', 'value')) === 'Gerir o planejamento e execução orçamentária.', 'sem a resposta: explica, e o texto colado continua lá');
  await page.check('input[name="poSeparar"][value="nao"]');
  afirma(/Registrar e seguir para o O1–O9/.test(await texto(page, '#poSalvarAtuacaoBtn')), '"Não": o botão diz que segue para o O1–O9');
  const antes = Object.keys((await banco(page))['objetos-organizacionais'] || {});
  await page.click('#poSalvarAtuacaoBtn');
  await esperar(page, (n) => Object.keys(window.__CFG.__dbReal['objetos-organizacionais'] || {}).length > n, antes.length);
  const objs = (await banco(page))['objetos-organizacionais'], novo = Object.keys(objs).find((k) => antes.indexOf(k) === -1), o = objs[novo];
  afirma(o.nome === 'Gerir o planejamento e execução orçamentária.' && o.descricao === o.nome && o.finalidade === o.nome, 'o texto colado, sem reescrita, preenche nome, descrição e finalidade do cadastro');
  afirma(/o nome e a finalidade repetem a descrição informada pela pessoa; nada foi inferido/.test(o.contexto), 'o próprio registro diz que esses campos repetem a descrição (nada inferido)', o.contexto);
  await esperar(page, () => /Registre a hipótese inicial e inicie o O1–O9/.test(document.getElementById('avaliacoesPosicionamento').textContent));
  afirma(true, 'segue direto para iniciar o O1–O9 (hipótese inicial e questionário de sempre)');
  /* "Sim" → a responsabilidade vai para uma Análise Organizacional, com o texto intacto */
  await ir(page, '#avaliacoes?po=atuacoes'); await page.waitForSelector('#poNovaAtuacaoBtn');
  await page.click('#poNovaAtuacaoBtn'); await page.waitForSelector('input[name="poSeparar"]');
  await page.fill('#poAtuacao_descricao', 'Gerir o orçamento e atender os fornecedores.');
  await page.check('input[name="poSeparar"][value="sim"]');
  afirma(/Registrar numa Análise Organizacional/.test(await texto(page, '#poSalvarAtuacaoBtn')), '"Sim": o botão diz que vai para uma análise');
  await page.click('#poSalvarAtuacaoBtn');
  await esperar(page, () => /an=(?!nova|lista)/.test(location.hash) && !!document.querySelector('.an-linha[data-resp]'), null, 20000);
  const idA = await page.evaluate(() => decodeURIComponent(/an=([^&]*)/.exec(location.hash)[1]));
  const an = await analiseDoBanco(page, idA), rs = Object.values(an.recortes);
  afirma(rs.length === 1 && rs[0].descricao === 'Gerir o orçamento e atender os fornecedores.' && rs[0].separacao.valor === 'sim' && /Precisa separar/.test(await texto(page, '#avaliacoesAnalise')), 'a análise nasce com a responsabilidade e a resposta, pronta para separar');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
}

async function governanca(browser) {
  console.log('\n== F. F2b opcional ==');
  const { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#avaliacoes?an=lista', { hab: LIB });
  await page.waitForSelector('#anNovaBtn', { timeout: 20000 });
  await ir(page, '#avaliacoes?an=nova'); await page.waitForSelector('#anFormNova');
  afirma(await prop(page, 'input[name="anTemAtuacao"][value="nao"]', 'checked') && /Você quer aprofundar uma responsabilidade organizacional já registrada na Porta 2\?/.test(await texto(page, '#anAprofunda legend')) && await prop(page, '#anFormNova input[value="estrutura"]', 'checked'), 'nova análise: responsabilidade prévia opcional ("Não"); escopo já marcado');
  const id = await abrirAnalise(page, 'TESTE — Núcleo de Governança de TI', null);
  await page.waitForSelector('#anFormResponder[data-q="F2b"]');
  afirma(/Pergunta opcional/.test(await texto(page, '#anPergunta')) && /Essa estrutura já está cadastrada no ADMIN/.test(await texto(page, '#anPerguntaTitulo')) && await prop(page, '#anEstruturaCadastrada', 'disabled'), 'F2b: opcional, com o campo dependente desabilitado');
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
  console.log('\n== G. GECON: dez atribuições coladas, lista única, núcleos, composição ==');
  const { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#avaliacoes?an=lista', { hab: LIB });
  await page.waitForSelector('#anNovaBtn', { timeout: 20000 });
  const id = await abrirAnalise(page, 'Gerência de Contabilidade e Controladoria — GECON', 'estrutura');
  await page.waitForSelector('#anFormResponsabilidade');
  afirma(/Informe as responsabilidades da área/.test(await texto(page, '#anProximaAcao')) && /Nenhuma responsabilidade informada ainda/.test(await texto(page, '#anRespVazio')), 'vazia: a próxima ação pede as responsabilidades');
  await page.click('#anAbrirLote'); await page.waitForSelector('#anLoteTexto');
  afirma(/uma responsabilidade por linha/.test(await texto(page, '#anLoteAjuda')) && /Ponto e vírgula não separa itens/.test(await texto(page, '#anLoteAjuda')), 'lote: instrução (uma por linha; nada reescrito)');
  const colado = GECON.map((t, i) => (i + 1) + '. ' + t).join('\n') + '\n\n8. Gerir o processo contábil.\n';
  await page.fill('#anLoteTexto', colado);
  await page.click('#anLotePrevia'); await page.waitForSelector('#anLoteLista');
  let itens = await page.$$eval('#anLoteLista textarea', (l) => l.map((x) => x.value));
  afirma(itens.length === 11 && itens[0] === '1. Gerir a contabilidade gerencial.', 'prévia: linhas vazias ignoradas; sem pedir, a numeração fica como colada', itens[0]);
  await page.click('#anLoteVoltar'); await page.waitForSelector('#anLoteTexto');
  afirma((await prop(page, '#anLoteTexto', 'value')) === colado, 'voltar ao texto não perde o que foi colado');
  await page.check('#anLoteNumeracao'); await page.click('#anLotePrevia'); await page.waitForSelector('#anLoteLista');
  itens = await page.$$eval('#anLoteLista textarea', (l) => l.map((x) => x.value));
  afirma(itens.slice(0, 10).every((t, i) => t === GECON[i]), 'a pedido, só a numeração sai: os dez textos literais, na ordem', itens);
  afirma(await existe(page, '#anLoteDup_10') && !(await prop(page, '#anLoteInc_10', 'checked')) && /Repetida nesta lista/.test(await texto(page, '#anLoteDup_10')), 'duplicidade evidente marcada e desmarcada, pedindo confirmação (nada excluído em silêncio)');
  await page.fill('#anLoteItem_3', GECON[3] + ' ');
  await page.click('#anLoteRegistrar');
  await esperar(page, () => document.querySelectorAll('.an-linha[data-resp]').length === 10 && !!document.getElementById('anLoteFeedback'));
  let a = await analiseDoBanco(page, id);
  const ks = Object.keys(a.recortes).sort((x, y) => a.recortes[x].ordem - a.recortes[y].ordem);
  afirma(ks.length === 10 && ks.every((k, i) => a.recortes[k].descricao === GECON[i]), 'as dez gravadas de uma vez, texto e ordem preservados (a duplicada não entrou)');
  afirma(ks.every((k) => !a.recortes[k].separacao && !a.recortes[k].fatos && !a.recortes[k].objetoId), 'nenhuma resposta, núcleo ou avaliação presumidos');
  const ordemTela = await page.$$eval('.an-linha[data-resp] .an-cel--resp strong', (l) => l.map((x) => x.textContent));
  afirma(ordemTela.join('|') === GECON.join('|'), 'lista única com as dez, na ordem informada');
  afirma(/10 responsabilidades — 10 pendentes de delimitação\./.test(await texto(page, '#anResumo')), 'resumo calculado dos estados reais', await texto(page, '#anResumo'));
  const k = (i) => ks[i];
  afirma((await situacaoDe(page, k(0))) === 'Pendente de delimitação' && await existe(page, '#anSepNao_' + k(0)) && await existe(page, '#anRevisar_' + k(0)), 'pendente: responder ali mesmo ou Revisar');
  /* responder na lista */
  for (const i of [0, 1, 7, 8]) await clicarEsperar(page, '#anSepNao_' + k(i), (kk) => !!document.getElementById('anCriarAtuacao_' + kk), k(i));
  await clicarEsperar(page, '#anSepNaoSei_' + k(2), (kk) => /não sei/.test((document.querySelector('.an-linha[data-resp="' + kk + '"]') || {}).textContent || ''), k(2));
  await clicarEsperar(page, '#anSepSim_' + k(6), (kk) => !!document.getElementById('anSeparar_' + kk), k(6));
  afirma((await situacaoDe(page, k(0))) === 'Pronta para avaliar' && /Avaliar/.test(await texto(page, '#anCriarAtuacao_' + k(0))), '"Não precisa separar": pronta, com "Avaliar"');
  afirma((await situacaoDe(page, k(2))) === 'Pendente de delimitação' && (await situacaoDe(page, k(6))) === 'Pendente de delimitação' && /Precisa separar/.test(await texto(page, '.an-linha[data-resp="' + k(6) + '"]')), '"Não sei" e "Sim" continuam pendentes de delimitação (não se confundem com "A validar")');
  afirma(/10 responsabilidades — 4 prontas para avaliar e 6 pendentes de delimitação\./.test(await texto(page, '#anResumo')), 'resumo atualizado', await texto(page, '#anResumo'));
  /* separar a 7 (só para provar o recurso; o texto original fica guardado) */
  await page.click('#anSeparar_' + k(6)); await page.waitForSelector('#anFormSeparar');
  await page.fill('#anParteDesc0', 'Registrar as operações de investimentos mobiliários da carteira própria e de fundos de investimento.');
  await page.fill('#anParteDesc1', 'Controlar as operações de investimentos mobiliários da carteira própria e de fundos de investimento.');
  await page.check('#anFormSeparar input[name="anParteSep0"][value="nao"]'); await page.check('#anFormSeparar input[name="anParteSep1"][value="nao-sei"]');
  await page.click('#anConfirmarSeparar');
  await esperar(page, () => !!document.querySelector('[data-desdobrada]'));
  a = await analiseDoBanco(page, id);
  afirma(a.recortes[k(6)].situacao === 'desdobrado' && a.recortes[k(6)].descricao === GECON[6] && /Separada em/.test(await texto(page, '[data-desdobrada="' + k(6) + '"]')), 'separar: a descrição original fica guardada e não é avaliada como um todo');
  /* núcleos: só o que se sabe */
  await page.click('#anNucleos_' + k(7)); await page.waitForSelector('#anFormNucleos');
  afirma(/nada é associado pelo nome/.test(await texto(page, '#anFormNucleos')), 'núcleos: opcional, sem associação pelo nome');
  await page.fill('#anNucOutros', 'CONTA — Núcleo de Contabilidade'); await page.click('#anGravarNucleos');
  await esperar(page, (kk) => /CONTA/.test((document.getElementById('anNucleosTexto_' + kk) || {}).textContent || ''), k(7));
  await page.click('#anNucleos_' + k(8)); await page.waitForSelector('#anFormNucleos');
  await page.fill('#anNucOutros', 'NUTRI — Núcleo Tributário\nCONTA — Núcleo de Contabilidade'); await page.click('#anGravarNucleos');
  await esperar(page, (kk) => /NUTRI/.test((document.getElementById('anNucleosTexto_' + kk) || {}).textContent || ''), k(8));
  a = await analiseDoBanco(page, id);
  afirma(a.recortes[k(8)].fatos.execucao.length === 2 && a.recortes[k(7)].fatos.execucao.length === 1 && [0, 1, 2, 3, 4, 5, 9].every((i) => !a.recortes[k(i)].fatos), 'vários núcleos numa responsabilidade; o mesmo núcleo em várias; as outras sem núcleo (nada inferido)');
  afirma(/Não informado/.test(await texto(page, '#anNucleosTexto_' + k(4))), 'sem núcleo: "Não informado"');
  /* o exemplo de homologação: quem executa hoje × tipo recomendado × vínculo formal × proposta e aprovação */
  const cab = await texto(page, '.an-tab-cab');
  afirma(/Núcleo\(s\) que executam hoje \(declarado\)/.test(cab) && /Tipo arquitetural recomendado \(O1–O9\)/.test(cab) && /não é uma nova estrutura/.test(await texto(page, '#anLegendaLista')) && /não é vínculo nem responsabilidade formal/.test(await texto(page, '#anLegendaLista')), 'lista: quem executa hoje (declarado) e tipo recomendado em colunas distintas, com a legenda');
  afirma((await texto(page, '#anTipo_' + k(7))).trim() === 'A determinar pelo O1–O9', '"Gerir o processo contábil": tipo recomendado a determinar pelo O1–O9');
  const q4 = await texto(page, '#anComposicaoAtual li[data-comp-resp="' + k(7) + '"]');
  afirma(/Núcleo\(s\) que executam hoje \(declarado\)CONTA — Núcleo de Contabilidade/.test(q4) && /Tipo arquitetural recomendadoA determinar pelo O1–O9/.test(q4) && /Estrutura com vínculo formal registradoNenhum registrado/.test(q4) && /Proposta de composição e aprovaçãoNenhuma proposta registrada/.test(q4), 'composição: CONTA executa hoje (declarado), tipo a determinar, nenhum vínculo formal, nenhuma proposta', q4);
  afirma(!/nova estrutura(?! nem)/i.test((await texto(page, '#avaliacoesAnalise')).replace(/não é uma nova estrutura/g, '')), 'o resultado do O1–O9 nunca é chamado de "nova estrutura"');
  const db0 = await banco(page);
  afirma(Object.keys(db0['estruturas-concretas'].registros).length === Object.keys(sementeAnalise()['estruturas-concretas'].registros).length && Object.keys((db0['estruturas-vinculos'] || {}).registros || {}).length === Object.keys((sementeAnalise()['estruturas-vinculos'] || {}).registros || {}).length, 'nenhuma estrutura nem vínculo criados');
  /* composição: uma estrutura com várias responsabilidades; uma responsabilidade em vários núcleos */
  const comp = await texto(page, '#anComposicaoAtual');
  afirma(/CONTA — Núcleo de Contabilidade.*2 responsabilidades/.test(comp) && /NUTRI — Núcleo Tributário.*1 responsabilidade/.test(comp) && /compartilhada com/.test(comp) && /Sem núcleo informado/.test(comp) && /não cadastrado no ADMIN — informação descritiva/.test(comp), 'composição: CONTA com duas responsabilidades, uma compartilhada com NUTRI, e as sem núcleo', comp.slice(0, 300));
  afirma((await page.$$('#anComposicaoAtual li[data-comp-resp="' + k(8) + '"]')).length === 2 && /núcleo\(s\) que executam hoje/.test(await texto(page, '#anComposicaoSecao')) && /tipo arquitetural recomendado/.test(await texto(page, '#anComposicaoSecao')) && /estrutura com vínculo formal registrado/.test(await texto(page, '#anComposicaoSecao')) && /proposta de composição e aprovação/.test(await texto(page, '#anComposicaoSecao')), 'a compartilhada aparece em cada núcleo (a mesma avaliação, sem duplicar); quatro conceitos separados');
  /* avaliar uma, voltar à lista, ver os estados reais */
  await page.click('#anCriarAtuacao_' + k(7));
  await esperar(page, () => /po=atuacoes&item=/.test(location.hash));
  const obj = await page.evaluate(() => decodeURIComponent(/item=([^&]*)/.exec(location.hash)[1]));
  const db1 = await banco(page);
  afirma(db1['objetos-organizacionais'][obj].nome === 'Gerir o processo contábil.' && db1['analises-por-objeto'][obj].recorteId === k(7) && /nada foi inferido/.test(db1['objetos-organizacionais'][obj].contexto), 'Avaliar: registra na Porta 2 com o texto literal e a origem, numa gravação');
  await page.waitForSelector('#anVoltarAnalise', { timeout: 20000 });
  await page.click('#anVoltarAnalise');
  await page.waitForSelector('#anResponsabilidades');
  afirma((await situacaoDe(page, k(7))) === 'Pronta para avaliar' && (await page.getAttribute('#anAbrirPos_' + k(7), 'href')) === '#avaliacoes?po=atuacoes&item=' + encodeURIComponent(obj), 'de volta à lista: registrada, O1–O9 ainda não iniciado ("Avaliar")');
  /* estados reais do Posicionamento (o O1–O9 em si é provado nos testes do Posicionamento): rascunho → Continuar; concluída → Ver resultado */
  await gravarDb(page, { ['avaliacoes-posicionamento/pos-r-' + obj]: { itemId: obj, itemNome: 'x', status: 'rascunho', origem: 'objeto-organizacional', versao: 1, revisao: 1 }, ['posicionamento-rascunho-por-item/' + obj]: 'pos-r-' + obj });
  await esperar(page, (kk) => /Em avaliação/.test((document.getElementById('anSituacao_' + kk) || {}).textContent || ''), k(7));
  afirma(/Continuar/.test(await texto(page, '#anAbrirPos_' + k(7))) && (await page.getAttribute('#anAbrirPos_' + k(7), 'href')) === '#avaliacoes?po=pos-r-' + obj, 'O1–O9 iniciado: "Em avaliação", com "Continuar" no rascunho');
  await gravarDb(page, { ['avaliacoes-posicionamento/pos-' + obj]: { itemId: obj, itemNome: 'x', status: 'concluido', origem: 'objeto-organizacional', versao: 1, revisao: 2, hipoteseInicial: 'NAO_SEI', resultadoAutomatico: { codigoResultado: 'AREA_ESPECIALIZADA', motivo: 'PAPEL_UNICO', regra: 'R', papeisDetectados: ['AREA_ESPECIALIZADA'] }, concluidoEm: '2026-10-14T12:00:00.000Z' },
    ['posicionamento-vigente-por-item/' + obj]: 'pos-' + obj, ['posicionamento-rascunho-por-item/' + obj]: null });
  await esperar(page, (kk) => /Avaliada/.test((document.getElementById('anSituacao_' + kk) || {}).textContent || ''), k(7));
  afirma(/Ver resultado/.test(await texto(page, '#anAbrirPos_' + k(7))) && /\(recomendação\)$/.test((await texto(page, '#anTipo_' + k(7))).trim()) && (await situacaoDe(page, k(0))) === 'Pronta para avaliar', 'concluída: "Avaliada" com "Ver resultado"; as outras seguem como estavam');
  afirma(/^11 responsabilidades — 1 avaliada, 4 prontas para avaliar e 6 pendentes de delimitação.$/.test((await texto(page, '#anResumo')).trim()), 'resumo dos estados reais (as duas partes entram; a original separada não conta)', await texto(page, '#anResumo'));
  afirma(/Tipo arquitetural recomendado.*\(recomendação\)/.test(await texto(page, '#anComposicaoAtual li[data-comp-resp="' + k(7) + '"]')) && /executam hoje \(declarado\)Não informado/.test(await texto(page, '#anComposicaoAtual li[data-comp-resp="' + k(7) + '"]')) === false, 'composição: o tipo recomendado aparece na responsabilidade, separado de quem executa hoje');
  /* vínculo formal registrado (ficha do Posicionamento) ≠ aprovação do desenho; execução declarada ≠ responsabilidade formal */
  await gravarDb(page, { ['estruturas-vinculos/registros/vin-' + obj]: { id: 'vin-' + obj, objetoId: obj, estruturaId: 'nucleo-gov', papel: 'responsavel-principal', base: { avaliacaoId: 'pos-' + obj, codigo: 'AREA_ESPECIALIZADA', origem: 'recomendacao' }, situacao: 'ativa', revisao: 1, criadoEm: 1791713600000, criadoPor: { id: 'semente' } },
    ['estruturas-vinculos/ativo-por-objeto/' + obj]: 'vin-' + obj });
  await esperar(page, (kk) => /Estrutura com vínculo formal registradoNúcleo de Governança de TI/.test((document.querySelector('#anComposicaoAtual li[data-comp-resp="' + kk + '"]') || {}).textContent || ''), k(7));
  const comV = await texto(page, '#anComposicaoAtual li[data-comp-resp="' + k(7) + '"]');
  afirma(/Proposta de composição e aprovaçãoNenhuma proposta registrada/.test(comV) && !/aprovação registrada:/.test(comV), 'vínculo formal aparece só como vínculo: nenhuma aprovação é deduzida dele', comV);
  afirma(/Estrutura com vínculo formal registradoNenhum registrado/.test(await texto(page, '#anComposicaoAtual li[data-comp-resp="' + k(8) + '"]')), 'execução declarada (NUTRI, CONTA) não vira vínculo nem responsabilidade formal');
  /* F5: retomada */
  await recarregar(page, ctx);
  await page.waitForSelector('#anResponsabilidades', { timeout: 20000 });
  afirma((await page.$$('.an-linha[data-resp]')).length === 11 && (await situacaoDe(page, k(7))) === 'Avaliada', 'F5: a mesma lista e os mesmos estados');
  await page.click('#anHistorico > summary');
  await esperar(page, () => { const h = document.getElementById('anHistorico').textContent; return /registradas de uma vez/.test(h) && /Núcleos atuais informados/.test(h) && /separada em partes/.test(h); });
  afirma(true, 'histórico: lote, núcleos, separação');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
}

async function detalhamento(browser) {
  console.log('\n== D. Detalhamento opcional ==');
  const { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#avaliacoes?an=lista', { hab: LIB });
  await page.waitForSelector('#anNovaBtn', { timeout: 20000 });
  const id = await abrirAnalise(page, 'TESTE — Conjunto', 'conjunto');
  afirma(!(await registrarResp(page, 'Gerir a contabilidade gerencial.', 'nao-sei')), 'uma responsabilidade "Não sei"');
  const k0 = await linhaDe(page, 'Gerir a contabilidade gerencial.');
  afirma(!(await prop(page, '#anDetalhar', 'open')), 'o detalhamento começa fechado (opcional)');
  await adicionarEntrega(page, 'Relatórios gerenciais mensais');
  const ke = await page.evaluate(() => document.querySelector('.an-entrega[data-entrega]').getAttribute('data-entrega'));
  await page.click('#anExcluirEntrega_' + ke); await page.click('#anConfirmarExcluirEntrega');
  await esperar(page, () => !document.querySelector('.an-entrega[data-entrega]'));
  afirma((await analiseDoBanco(page, id)).recortes[k0].separacao.valor === 'nao-sei', 'detalhar não converte "Não sei" em "Não"');
  const c2 = await abrir(browser, { width: 1280, height: 900 }, '#avaliacoes?an=lista', { hab: LIB });
  await c2.page.waitForSelector('#anNovaBtn', { timeout: 20000 });
  await abrirAnalise(c2.page, 'TESTE — Sem entregas', 'conjunto');
  await abrirDetalhar(c2.page);
  await c2.page.click('#anSemEntregas'); await c2.page.waitForSelector('#anSemEntregasRegistrado');
  afirma(/Nenhuma entrega identificada/.test(await texto(c2.page, '#anLacunas')) && await existe(c2.page, '#anFormResponsabilidade'), '"Não consigo identificar entregas" continua — e não impede registrar responsabilidades');
  afirma(!erros.length && !c2.erros.length, 'nenhum erro de página', erros.concat(c2.erros).join(' | '));
  await ctx.close(); await c2.ctx.close();
}

async function legado(browser) {
  console.log('\n== L. Registros anteriores ==');
  const { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#avaliacoes?an=an-legado', { db: comLegado(sementeAnalise(LIB)) });
  await page.waitForSelector('#anObjetoF2b', { timeout: 20000 });
  afirma(/É informal/.test(await texto(page, '#anObjetoF2b')) && !/Núcleo de Governança/.test(await texto(page, '#avaliacoesAnalise')), 'F2b incoerente: a estrutura não aparece');
  afirma((await situacaoDe(page, 'rl1')) === 'Pronta para avaliar' && await existe(page, '#anCriarAtuacao_rl1') && await prop(page, '#anDetalhar', 'open'), 'responsabilidade delimitada pelas entregas: na lista, pronta para avaliar; o detalhamento abre com as entregas');
  let a = (await banco(page))['analises-organizacionais']['an-legado'];
  afirma(a.estruturaReferidaId === 'nucleo-gov', 'abrir não grava nada');
  afirma(!(await registrarResp(page, 'Gerir o processo contábil.', 'nao')), 'uma responsabilidade nova convive com a anterior');
  a = (await banco(page))['analises-organizacionais']['an-legado'];
  afirma(!a.estruturaReferidaId && !('estruturaId' in a.respostas.F2b) && !a.recortes.rl1.separacao, 'a próxima gravação corrige só a F2b incoerente; a anterior fica como era');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
}

async function perfis(browser) {
  console.log('\n== K. Consulta e 375 px ==');
  let { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#avaliacoes?an=an-legado', { db: comLegado(sementeAnalise(LIB)), email: AVAL });
  await page.waitForSelector('#anResponsabilidades', { timeout: 20000 });
  afirma(!(await existe(page, '#anFormResponsabilidade')) && !(await existe(page, '[id^="anRevisar_"]')) && !(await existe(page, '[id^="anNucleos_"]')) && /consultando/.test(await texto(page, '#anProximaAcao')), 'consulta: vê a lista, sem formulários');
  await ctx.close();
  ({ ctx, page, erros } = await abrir(browser, { width: 375, height: 812 }, '#avaliacoes?po=atuacoes', { hab: LIB }));
  await page.waitForSelector('#anEntradaAtuacoes');
  afirma(await larguraOk(page) && !(await estouro(page)).length, '375: entrada sem rolagem lateral nem corte');
  await page.click('#poNovaAtuacaoBtn'); await page.waitForSelector('input[name="poSeparar"]');
  afirma(await larguraOk(page) && !(await estouro(page)).length, '375: cadastro simples do Caminho A sem corte');
  await abrirAnalise(page, 'Gerência de Contabilidade e Controladoria — GECON', 'estrutura');
  await page.click('#anAbrirLote'); await page.fill('#anLoteTexto', GECON.join('\n')); await page.click('#anLotePrevia'); await page.waitForSelector('#anLoteLista');
  afirma(await larguraOk(page) && !(await estouro(page)).length, '375: prévia do lote sem corte');
  await page.click('#anLoteRegistrar');
  await esperar(page, () => document.querySelectorAll('.an-linha[data-resp]').length === 10);
  const k0 = await linhaDe(page, GECON[0]);
  await page.click('#anNucleos_' + k0); await page.waitForSelector('#anFormNucleos');
  const corte = await estouro(page);
  afirma(await larguraOk(page) && !corte.length, '375: lista das dez (cartões empilhados) e o formulário de núcleos sem corte', corte);
  const alturas = await page.$$eval('#avaliacoesAnalise .btn:not(.an-link), #avaliacoesAnalise .an-opcao', (ls) => ls.filter((l) => l.offsetParent).map((l) => l.getBoundingClientRect().height));
  afirma(alturas.every((h) => h >= 40), '375: alvos de toque com pelo menos 40 px', Math.min.apply(null, alturas));
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
    await detalhamento(browser);
    await legado(browser);
    await perfis(browser);
  } catch (e) { console.log('ERRO', e && e.stack || e); falhas++; }
  await browser.close();
  console.log('\n' + total + ' verificações — ' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})();
