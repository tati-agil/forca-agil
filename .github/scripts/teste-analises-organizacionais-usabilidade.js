/* Porta 2 · ANÁLISE ORGANIZACIONAL — usabilidade (correção consolidada). Firebase falso em persistência real; hermético;
 * o banco é o da página (nada vai para produção). O cenário "TESTE — Núcleo de Governança de TI" é HIPOTÉTICO. Prova,
 * pela interface:
 *   E. Entrada: a Porta 2 mostra dois caminhos (A direto, com a "+ Nova atuação" de sempre; B assistido) que convergem
 *      para o O1–O9, com Porta 1 opcional, Squad depois e Mapa fora da entrada; o Início fala de Porta 1/Porta 2 e
 *      oferece o Caminho B só com o marcador liberado.
 *   N. Nova análise: "Você quer aprofundar uma atuação organizacional já registrada na Porta 2?" — Não por padrão,
 *      a atuação só com Sim (campo desabilitado e limpo com Não); sem dependência de atuação prévia.
 *   F. F2b: pergunta e ajuda novas (cadastro de Estruturas do ADMIN ≠ Atuações); "Qual estrutura cadastrada?" só
 *      habilitada e obrigatória com "Está cadastrada"; trocar a resposta desabilita e limpa; o núcleo recusa a
 *      combinação incoerente; alterar a resposta depois (com histórico); teclado; F5 e retomada.
 *   P. Jornada progressiva: 4 passos com estado real, próxima ação com atalho, passos futuros "ainda não disponível"
 *      com motivo e condição; conceitos com exemplos hipotéticos.
 *   G. Entregas: instrução, exemplos, retorno com o total, foco para a próxima; editar e excluir (histórico, nada é
 *      apagado); nenhuma responsabilidade presumida.
 *   L. Legado incoerente (F2b ≠ cadastrada com estrutura gravada): a tela não mostra a estrutura, abrir não grava nada,
 *      a próxima gravação da própria análise corrige.
 *   S. "Não consigo identificar entregas" continua funcionando.
 *   K. Perfis e marcador: consulta só lê; DESLIGADO e SOMENTE_ADMIN_GERAL (para quem não é admin geral) = Porta 2 de antes.
 *   R. 375 px sem rolagem lateral. */
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
let falhas = 0, total = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); if (!c) falhas++; }

function sementeAnalise(hab) {
  const db = semente();
  db['fa-admins'] = Object.assign({}, db['fa-admins'] || {}, { [chave(ADM)]: true });
  db['fa-users'][chave(ADM)] = { name: 'Admin', email: ADM, area: 'INFOR' };
  const reg = db['estruturas-concretas'].registros;
  const e = (id, tipo, nome) => ({ id, tipo, nome, situacao: 'ativa', revisao: 1, criadaEm: 1791713600000, criadaPor: { id: 'semente', email: 'semente@teste' }, ultimaOperacao: 'op-' + id });
  reg['nucleo-gov'] = e('nucleo-gov', 'AREA_ESPECIALIZADA', 'Núcleo de Governança de TI');
  reg['nucleo-arq'] = e('nucleo-arq', 'AREA_ESPECIALIZADA', 'Núcleo de Arquitetura de TI');
  if (hab) db[CFG] = { habilitacao: hab };
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
const ir = async (page, hash) => { await page.evaluate((h) => { location.hash = h; }, hash); };
const prop = (page, sel, p) => page.evaluate(([s, k]) => { const e = document.querySelector(s); return e ? e[k] : undefined; }, [sel, p]);
const focado = (page) => page.evaluate(() => (document.activeElement || {}).id || '');
/* recarrega a página com o banco atual (o Firebase falso não persiste entre carregamentos) */
async function recarregar(page, ctx) {
  const db = await banco(page);
  await ctx.addInitScript('window.__CFG.db = ' + JSON.stringify(db) + '; delete window.__CFG.__dbReal;');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
}
async function responderF2b(page, valor, estrutura) {
  await page.check('#anFormResponder input[name="anResposta"][value="' + valor + '"]');
  if (estrutura) await page.selectOption('#anEstruturaCadastrada', estrutura);
  const antes = await texto(page, '#avaliacoesAnalise');
  await page.click('#anResponderBtn');
  await esperar(page, (a) => document.getElementById('avaliacoesAnalise').textContent !== a && !document.querySelector('#anResponderBtn[disabled]'), antes);
}
async function adicionarEntrega(page, desc, ex) {
  const n = await page.evaluate(() => document.querySelectorAll('.an-entrega').length);
  await page.fill('#anEntregaDesc', desc);
  if (ex) await page.fill('#anEntregaEx', ex);
  await page.click('#anAddEntregaBtn');
  await esperar(page, (k) => document.querySelectorAll('.an-entrega').length > k && !!document.getElementById('anEntregaFeedback'), n);
}
const analiseDoBanco = async (page, id) => (await banco(page))['analises-organizacionais'][id];
const analiseAtual = (page) => page.evaluate(() => decodeURIComponent(/an=([^&]*)/.exec(location.hash)[1]));

const ENTREGAS = [
  'Diagnósticos de aderência dos processos de TI, com recomendações de governança',
  'Planos e diretrizes de estratégia de TI',
  'Acompanhamentos contratuais e de desempenho de fornecedores de TI',
  'Políticas, normas e padrões de segurança da informação'
];

async function entrada(browser) {
  console.log('\n== E. Entrada: dois caminhos, Porta 1/Porta 2 ==');
  let { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#avaliacoes?po=atuacoes', { hab: LIB });
  await page.waitForSelector('#anEntradaAtuacoes');
  const t = await texto(page, '#anEntradaAtuacoes');
  afirma(/Caminho A · Direto/.test(t) && /Já sei qual responsabilidade quero avaliar/.test(t) && await existe(page, '#anCaminhoDireto #poNovaAtuacaoBtn'), 'T1: Caminho A — Direto, com a "+ Nova atuação" de sempre');
  afirma(/Caminho B · Assistido/.test(t) && /investigar uma estrutura, uma área ou um conjunto de atividades/.test(t) && await existe(page, '#anCaminhoAssistido #anEntradaNova'), 'T1: Caminho B — Assistido, abre a Análise Organizacional');
  afirma(/terminam na mesma avaliação O1–O9/.test(t) && /Ela não classifica nada/.test(t), 'os dois caminhos convergem para o O1–O9; a análise não é uma terceira classificação');
  afirma(/Porta 1 \(Produto\/Serviço, P1–P16\) é opcional/.test(t) && /Squad vem depois, só quando o resultado for Linha/.test(t) && /Mapa da Floresta .* não é uma entrada de avaliação/.test(t), 'Porta 1 opcional; Squad depois; Mapa não é entrada');
  await ir(page, '#avaliacoes'); await page.waitForSelector('#avpInicioCartaoAtuacao');
  await page.waitForSelector('#avpInicioCaminhoB');
  afirma(/^Porta 1$/.test((await texto(page, '#avpInicioCartaoNatureza .avp-inicio-caminho')).trim()) && /^Porta 2/.test((await texto(page, '#avpInicioCartaoAtuacao .avp-inicio-caminho')).trim()), 'Início: Porta 1 e Porta 2 (os Caminhos A e B ficam dentro da Porta 2)');
  afirma((await page.getAttribute('#avpInicioAnalise', 'href')) === '#avaliacoes?an=nova' && /Caminho B, assistido/.test(await texto(page, '#avpInicioCaminhoB')), 'Início: atalho para o Caminho B (Análise Organizacional)');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
  for (const [hab, email, rot] of [[null, ARQ, 'DESLIGADO'], ['SOMENTE_ADMIN_GERAL', ARQ, 'SOMENTE_ADMIN_GERAL (Avaliação + Configuração)']]) {
    ({ ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#avaliacoes?po=atuacoes', { hab, email }));
    await page.waitForSelector('#poNovaAtuacaoBtn', { timeout: 20000 }); await page.waitForTimeout(600);
    afirma(!(await existe(page, '#anEntradaAtuacoes')) && await existe(page, '.avp-actions-bar #poNovaAtuacaoBtn'), 'T15 ' + rot + ': Porta 2 como antes (só a "+ Nova atuação")');
    await ir(page, '#avaliacoes'); await page.waitForSelector('#avpInicioCartaoAtuacao'); await page.waitForTimeout(400);
    afirma(!(await existe(page, '#avpInicioCaminhoB')), 'T15 ' + rot + ': Início sem o atalho do Caminho B');
    await ctx.close();
  }
}

async function governanca(browser) {
  console.log('\n== N/F/P/G. Cenário hipotético "TESTE — Núcleo de Governança de TI" ==');
  const db0 = sementeAnalise(LIB);
  const temAtuacao = Object.keys(db0['objetos-organizacionais'] || {}).some((k) => db0['objetos-organizacionais'][k].situacao === 'ativo');
  let { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#avaliacoes?an=nova', { db: db0 });
  await page.waitForSelector('#anFormNova');
  /* N: atuação prévia é opcional */
  afirma(/Você quer aprofundar uma atuação organizacional já registrada na Porta 2\?/.test(await texto(page, '#anAprofunda legend')), 'T3: pergunta nova sobre a atuação prévia');
  afirma(/Não é necessário cadastrar uma atuação antes de começar\. Se você está investigando uma estrutura ou conjunto de atividades, pode iniciar diretamente por esta análise\. As responsabilidades identificadas poderão originar atuações para avaliação posterior\./.test(await texto(page, '#anAprofundaAjuda')), 'T3: texto de ajuda');
  afirma(/Atuações Organizacionais da Porta 2 \(área Avaliação\), e não às Estruturas Organizacionais cadastradas no ADMIN/.test(await texto(page, '#anAprofunda')), 'T3: diz que é o cadastro de Atuações, não o de Estruturas do ADMIN');
  afirma(await prop(page, 'input[name="anTemAtuacao"][value="nao"]', 'checked'), 'T3: "Não" por padrão — nenhuma dependência de atuação prévia');
  if (temAtuacao) {
    afirma(await prop(page, '#anObjetoAmplo', 'disabled'), 'T3: "Qual atuação?" desabilitado com "Não"');
    await page.check('input[name="anTemAtuacao"][value="sim"]');
    afirma(!(await prop(page, '#anObjetoAmplo', 'disabled')) && await prop(page, '#anObjetoAmplo', 'required') && /obrigatória/.test(await texto(page, '#anObjetoAmploDica')), 'T3: com "Sim", o campo fica habilitado e obrigatório');
    const op = await page.evaluate(() => document.querySelector('#anObjetoAmplo option:nth-child(2)').value);
    await page.selectOption('#anObjetoAmplo', op);
    await page.check('input[name="anTemAtuacao"][value="nao"]');
    afirma(await prop(page, '#anObjetoAmplo', 'disabled') && (await prop(page, '#anObjetoAmplo', 'value')) === '', 'T3: voltar para "Não" desabilita e limpa a atuação escolhida');
  } else afirma(await prop(page, 'input[name="anTemAtuacao"][value="sim"]', 'disabled'), 'T3: sem atuação registrada, "Sim" fica indisponível');
  await page.check('#anFormNova input[value="estrutura"]');
  await page.fill('#anNome', 'TESTE — Núcleo de Governança de TI');
  await page.fill('#anDescricao', 'Núcleo hipotético de TI com Governança de TI, Estratégia de TI, Gestão de Contratos de TI e políticas, normas e padrões de segurança da informação.');
  await page.click('#anCriarBtn');
  await esperar(page, () => /an=(?!nova|lista)/.test(location.hash) && !!document.getElementById('anTitulo'));
  const id = await analiseAtual(page);
  let a = await analiseDoBanco(page, id);
  afirma(a && !a.objetoAmploId && (!a.capacidades || !Object.keys(a.capacidades).length), 'análise aberta sem atuação prévia e com capacidades em branco');

  /* F: F2b */
  await page.waitForSelector('#anFormResponder[data-q="F2b"]');
  afirma(/^Essa estrutura já está cadastrada no ADMIN para representação no Mapa da Floresta\?$/.test((await texto(page, '#anPerguntaTitulo')).trim()), 'T4: pergunta F2b nova');
  afirma((await texto(page, '#anPerguntaAjuda')) === 'Consulte em ADMIN → Avaliação e Mapa → Estruturas Organizacionais. Esse cadastro registra estruturas concretas da organização e não deve ser confundido com o cadastro de Atuações Organizacionais da Porta 2. Não é necessário cadastrar uma estrutura para continuar esta análise.', 'T4: ajuda F2b nova');
  const ops = await texto(page, '#anFormResponder .an-opcoes');
  afirma(/Está cadastradaExiste no cadastro de Estruturas Organizacionais do ADMIN\./.test(ops) && /Existe, mas não está cadastradaÉ uma estrutura formal que ainda não consta naquele cadastro\./.test(ops) && /É informalÉ um agrupamento ou atuação sem formalização como estrutura organizacional\./.test(ops), 'T4: cada resposta explicada');
  afirma(await prop(page, '#anEstruturaCadastrada', 'disabled') && !(await prop(page, '#anEstruturaCadastrada', 'required')), 'T5: sem resposta, "Qual estrutura cadastrada?" fica desabilitado');
  /* teclado: espaço marca "Está cadastrada" e Tab chega ao campo, agora habilitado */
  await page.focus('#anFormResponder input[name="anResposta"][value="cadastrada"]');
  await page.keyboard.press('Space');
  afirma(!(await prop(page, '#anEstruturaCadastrada', 'disabled')) && await prop(page, '#anEstruturaCadastrada', 'required') && /obrigatória/.test(await texto(page, '#anEstruturaCadastradaDica')), 'T5: "Está cadastrada" (pelo teclado) habilita e torna obrigatório');
  await page.keyboard.press('Tab');
  afirma((await focado(page)) === 'anEstruturaCadastrada', 'T5: Tab leva ao campo dependente', await focado(page));
  await page.click('#anResponderBtn');
  await page.waitForTimeout(300);
  afirma(/^$/.test(await prop(page, '#anEstruturaCadastrada', 'value')) && (await analiseDoBanco(page, id)).respostas === undefined, 'T5: "Está cadastrada" sem estrutura não grava (o navegador pede o campo obrigatório)');
  await page.selectOption('#anEstruturaCadastrada', 'nucleo-gov');
  await page.check('#anFormResponder input[name="anResposta"][value="nao-cadastrada"]');
  afirma(await prop(page, '#anEstruturaCadastrada', 'disabled') && (await prop(page, '#anEstruturaCadastrada', 'value')) === '', 'T5: trocar para "Existe, mas não está cadastrada" desabilita e limpa a estrutura');
  await page.check('#anFormResponder input[name="anResposta"][value="informal"]');
  afirma(await prop(page, '#anEstruturaCadastrada', 'disabled') && (await prop(page, '#anEstruturaCadastrada', 'value')) === '', 'T5: "É informal" também desabilita e limpa');
  await responderF2b(page, 'nao-cadastrada');
  a = await analiseDoBanco(page, id);
  afirma(a.respostas.F2b.valor === 'nao-cadastrada' && !('estruturaId' in a.respostas.F2b) && !a.estruturaReferidaId, 'T5: gravado "nao-cadastrada" sem estrutura (registro e análise)', a.respostas.F2b);
  afirma(/Existe, mas não está cadastrada$/.test((await texto(page, '#anObjetoF2b')).replace(/Alterar$/, '').trim()), 'a resposta aparece no bloco do objeto, com "Alterar"', await texto(page, '#anObjetoF2b'));
  /* núcleo: a combinação incoerente é recusada mesmo se a tela fosse contornada */
  const recusa = await page.evaluate((i) => { const N = window.faAnalisesOrganizacionaisNucleo, F = window.faAnalisesFirebase; const est = F.estadoDoBanco({ analises: window.__CFG.__dbReal['analises-organizacionais'], propostas: {}, aprovacoes: {} });
    const r = N.responder(est, i, { pergunta: 'F2b', valor: { valor: 'informal', estruturaId: 'nucleo-gov' } }, { operacaoId: 'x', usuario: { id: 'u' }, agora: Date.now() }); return r.ok ? 'aceitou' : r.erros[0].codigo; }, id);
  afirma(recusa === 'ESTRUTURA_INCOMPATIVEL_COM_RESPOSTA', 'T6: a validação está no núcleo (não só na tela)', recusa);
  /* alterar a resposta depois */
  await page.click('#anAlterarF2b');
  await page.waitForSelector('#anFormResponder[data-alterando]');
  afirma(await prop(page, '#anFormResponder input[value="nao-cadastrada"]', 'checked') && await prop(page, '#anEstruturaCadastrada', 'disabled'), 'T7: "Alterar" reabre com a resposta atual e o campo desabilitado');
  await responderF2b(page, 'cadastrada', 'nucleo-gov');
  a = await analiseDoBanco(page, id);
  afirma(a.respostas.F2b.estruturaId === 'nucleo-gov' && a.estruturaReferidaId === 'nucleo-gov' && /Está cadastrada: Núcleo de Governança de TI/.test(await texto(page, '#anObjetoF2b')), 'T7: alterar para "Está cadastrada" com a estrutura');
  await page.click('#anAlterarF2b'); await page.waitForSelector('#anFormResponder[data-alterando]');
  afirma(!(await prop(page, '#anEstruturaCadastrada', 'disabled')) && (await prop(page, '#anEstruturaCadastrada', 'value')) === 'nucleo-gov', 'T7: reaberta com a estrutura escolhida');
  await responderF2b(page, 'nao-cadastrada');
  a = await analiseDoBanco(page, id);
  afirma(a.respostas.F2b.valor === 'nao-cadastrada' && !('estruturaId' in a.respostas.F2b) && !a.estruturaReferidaId, 'T7: voltar para "Existe, mas não está cadastrada" limpa a estrutura no registro');

  /* P: passos */
  const trilha = await page.$$eval('#anTrilha li', (ls) => ls.map((l) => l.textContent));
  afirma(trilha.length === 4 && /Descobrir as entregas · passo atual/.test(trilha[0]) && /Delimitar as responsabilidades · ainda não disponível/.test(trilha[1]) && /O1–O9 · ainda não disponível/.test(trilha[2]) && /Composição organizacional · ainda não disponível/.test(trilha[3]), 'T8: quatro passos com o estado real', trilha);
  afirma(/Ainda não disponível/.test(await texto(page, '#anPasso2Estado')) && /Por quê:/.test(await texto(page, '#anPasso2Motivo')) && /Para avançar:/.test(await texto(page, '#anPasso2Condicao')) && !(await existe(page, '#anPasso2 form')), 'T8: passo futuro sem formulário, com motivo e condição para avançar');
  afirma(/Passo atual/.test(await texto(page, '#anPasso1Estado')) && /Registre a primeira entrega/.test(await texto(page, '#anProximaAcao')), 'T8: passo atual e próxima ação destacados');
  await page.click('#anIrProxima');
  afirma((await focado(page)) === 'anEntregaDesc', 'T8: "Ir para lá" leva o foco ao campo da entrega', await focado(page));
  const conc = await texto(page, '#anConceitos');
  afirma(await prop(page, '#anConceitos', 'open') && /hipotéticos/.test(conc) && /Governança de TI/.test(conc) && /avaliar a aderência dos processos de TI às diretrizes de governança/.test(conc) && /diagnóstico de aderência com recomendações/.test(conc) && /relatório de avaliação de controles de um processo de TI/.test(conc), 'T9: conceitos com exemplos hipotéticos (campo, responsabilidade, entrega, evidência)');
  afirma(/Uma responsabilidade pode reunir várias entregas/.test(conc) && /Um documento sozinho não prova a natureza organizacional/.test(conc), 'T9: várias entregas por responsabilidade; documento sozinho não é prova');

  /* G: entregas */
  afirma((await texto(page, '#anEntregaInstrucao')) === 'Registre uma entrega por vez. Pense no resultado que o núcleo produz para alguém, e não no nome da área ou no cargo das pessoas. Você poderá adicionar várias entregas e depois analisar quais pertencem à mesma responsabilidade.', 'T10: instrução das entregas');
  afirma(/^Ex\.:/.test(await page.getAttribute('#anEntregaDesc', 'placeholder')) && /^Ex\.:/.test(await page.getAttribute('#anEntregaEx', 'placeholder')) && /opcional/.test(await texto(page, 'label[for="anEntregaEx"]')), 'T10: exemplos nos campos; exemplo concreto opcional');
  afirma(/Nenhuma entrega registrada ainda/.test(await texto(page, '#anEntregasVazio')), 'T10: estado vazio explicado');
  await adicionarEntrega(page, ENTREGAS[0], 'Relatório hipotético de avaliação de controles');
  afirma(/Entrega registrada: ".*"\. Total: 1 entrega\./.test(await texto(page, '#anEntregaFeedback')) && /siga para o Passo 2/.test(await texto(page, '#anEntregaFeedback')) && (await focado(page)) === 'anEntregaDesc', 'T10: retorno com o total e o próximo passo; foco volta para a próxima entrega', [await texto(page, '#anEntregaFeedback'), await focado(page)]);
  for (const d of ENTREGAS.slice(1)) await adicionarEntrega(page, d);
  afirma(/Total: 4 entregas/.test(await texto(page, '#anEntregaFeedback')) && /Adicionar outra entrega/.test(await texto(page, '#anFormEntregaTitulo')), 'T10: quatro entregas registradas');
  await adicionarEntrega(page, 'Operação de firewall');
  let ke = await page.evaluate(() => { const l = Array.from(document.querySelectorAll('.an-entrega')).find((x) => /Operação de firewall/.test(x.textContent)); return l.getAttribute('data-entrega'); });
  await page.click('#anExcluirEntrega_' + ke); await page.waitForSelector('#anFormDescartarEntrega');
  await page.fill('#anMotivoEntrega', 'A operação de firewall não faz parte deste núcleo');
  await page.click('#anConfirmarExcluirEntrega');
  await esperar(page, () => document.querySelectorAll('.an-entrega').length === 4);
  a = await analiseDoBanco(page, id);
  afirma(a.entregas[ke].situacao === 'descartada' && /firewall/.test(a.entregas[ke].descarte.motivo), 'T11: excluir entrega — fica no banco como descartada, com motivo (nada é apagado)');
  const k0 = await page.evaluate((d) => Array.from(document.querySelectorAll('.an-entrega')).find((x) => x.textContent.indexOf(d) !== -1).getAttribute('data-entrega'), ENTREGAS[1]);
  await page.click('#anEditarEntrega_' + k0); await page.waitForSelector('#anFormEditarEntrega');
  await page.fill('#anEditDesc', 'Planos estratégicos e diretrizes de TI');
  await page.click('#anSalvarEntrega');
  await esperar(page, () => /Planos estratégicos e diretrizes de TI/.test(document.getElementById('anEntregas').textContent));
  a = await analiseDoBanco(page, id);
  afirma(a.entregas[k0].descricao === 'Planos estratégicos e diretrizes de TI', 'T11: editar entrega');
  afirma(!a.recortes || !Object.keys(a.recortes).length, 'T12: nenhuma responsabilidade presumida (4 entregas ≠ 4 responsabilidades)');
  await page.click('#anHistorico > summary');
  await esperar(page, () => /Entrega alterada/.test(document.getElementById('anHistorico').textContent) && /Entrega excluída/.test(document.getElementById('anHistorico').textContent));
  afirma(true, 'T11: histórico registra a alteração e a exclusão');
  /* uma entrega descrita por completo libera o Passo 2 (sem obrigar a terminar as outras) */
  const resp = { F4: 'julgamento-tecnico', F5: 'diversas-linhas', F6: 'esta-estrutura', F8: 'sem-evidencia' };
  for (let i = 0; i < 6; i++) {
    const info = await page.evaluate(() => { const f = document.getElementById('anFormResponder'); return f ? { q: f.getAttribute('data-q'), e: (document.querySelector('#anPergunta .an-sobre strong') || {}).textContent } : null; });
    if (!info || info.e !== ENTREGAS[0] || !resp[info.q]) break;
    await page.check('#anFormResponder input[name="anResposta"][value="' + resp[info.q] + '"]');
    if (info.q === 'F6') await page.selectOption('#anCerteza', 'conhecido');
    const antes = await texto(page, '#anPergunta');
    await page.click('#anResponderBtn');
    await esperar(page, (x) => { const p = document.getElementById('anPergunta'); return !p || p.textContent !== x; }, antes);
  }
  afirma(!/Ainda não disponível/.test(await texto(page, '#anPasso2Estado')) && await existe(page, '#anFormRecorte') && /Ainda não disponível/.test(await texto(page, '#anPasso3Estado')), 'T8: com uma entrega descrita, o Passo 2 fica disponível; o Passo 3 ainda não');
  afirma(/pendentes? neste passo/.test(await texto(page, '#anPendencias1')), 'T8: as perguntas que faltam no Passo 1 são explicadas', await texto(page, '#anPendencias1'));
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));

  /* F5: retomada */
  await recarregar(page, ctx);
  await page.waitForSelector('#anTitulo', { timeout: 20000 });
  afirma(/TESTE — Núcleo de Governança de TI/.test(await texto(page, '#anTitulo')) && (await page.$$('.an-entrega')).length === 4 && !(await existe(page, '#anEntregaFeedback')), 'T13: F5 retoma a mesma análise, com as 4 entregas');
  afirma(/Existe, mas não está cadastrada/.test(await texto(page, '#anObjetoF2b')) && !/Núcleo de Governança/.test(await texto(page, '#anObjetoF2b')), 'T13: depois do F5, a F2b continua sem estrutura');
  await page.click('#anAlterarF2b'); await page.waitForSelector('#anFormResponder[data-alterando]');
  afirma(await prop(page, '#anEstruturaCadastrada', 'disabled') && (await prop(page, '#anEstruturaCadastrada', 'value')) === '', 'T13: retomando a alteração, o campo segue desabilitado e vazio');
  await page.click('#anCancelarAlteracao');
  await ctx.close();
  return { id, db: null };
}

async function legado(browser) {
  console.log('\n== L. Registro legado incoerente ==');
  const db = sementeAnalise(LIB);
  db['analises-organizacionais'] = { 'an-legado': { id: 'an-legado', nome: 'TESTE — Legado', tipoEscopo: 'estrutura', situacao: 'aberta', revisao: 3, criadaEm: 1791713600000, criadaPor: { id: 'u-x', email: ARQ },
    atualizadoEm: 1791713600000, atualizadoPor: { uid: 'u-x', email: ARQ }, auditoriaId: 'aud-l', estruturaReferidaId: 'nucleo-gov',
    respostas: { F2b: { valor: 'informal', estruturaId: 'nucleo-gov', em: 1791713600000, por: { id: 'u-x' } } } } };
  const { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#avaliacoes?an=an-legado', { db });
  await page.waitForSelector('#anObjetoF2b', { timeout: 20000 });
  afirma(/É informal/.test(await texto(page, '#anObjetoF2b')) && !/Núcleo de Governança/.test(await texto(page, '#avaliacoesAnalise')), 'T14: legado incoerente — a tela não mostra a estrutura');
  let a = (await banco(page))['analises-organizacionais']['an-legado'];
  afirma(a.estruturaReferidaId === 'nucleo-gov' && a.respostas.F2b.estruturaId === 'nucleo-gov', 'T14: abrir não limpa nada sozinho');
  await adicionarEntrega(page, 'Uma entrega qualquer');
  a = (await banco(page))['analises-organizacionais']['an-legado'];
  afirma(!a.estruturaReferidaId && !('estruturaId' in a.respostas.F2b) && a.respostas.F2b.valor === 'informal', 'T14: a próxima gravação da própria análise corrige (resposta mantida)');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
}

async function semEntregas(browser) {
  console.log('\n== S. "Não consigo identificar entregas" ==');
  const { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#avaliacoes?an=nova', { hab: LIB });
  await page.waitForSelector('#anFormNova');
  await page.check('#anFormNova input[value="conjunto"]'); await page.fill('#anNome', 'TESTE — Conjunto sem entregas');
  await page.click('#anCriarBtn');
  await page.waitForSelector('#anSemEntregas', { timeout: 20000 });
  await page.click('#anSemEntregas');
  await page.waitForSelector('#anSemEntregasRegistrado');
  afirma(/Concluído/.test(await texto(page, '#anPasso1Estado')) && /não consegue identificar entregas/.test(await texto(page, '#anPasso2Motivo')) && /Nenhuma entrega identificada/.test(await texto(page, '#anLacunas')), 'T16: continua funcionando — Passo 1 concluído, lacuna registrada, Passo 2 explica o motivo');
  afirma(await existe(page, '#anFormEntrega'), 'T16: ainda dá para registrar uma entrega depois');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
}

async function perfis(browser, idGov) {
  console.log('\n== K. Consulta e 375 px ==');
  let { ctx, page, erros } = await abrir(browser, { width: 1280, height: 900 }, '#avaliacoes?an=lista', { hab: LIB, email: AVAL });
  await page.waitForSelector('#anLista, #anListaVazia', { timeout: 20000 });
  afirma(!(await existe(page, '#anNovaBtn')), 'consulta: sem "Abrir uma análise"');
  await ctx.close();
  ({ ctx, page, erros } = await abrir(browser, { width: 375, height: 812 }, '#avaliacoes?po=atuacoes', { hab: LIB }));
  await page.waitForSelector('#anEntradaAtuacoes');
  const lados = await page.evaluate(() => { const a = document.getElementById('anCaminhoDireto').getBoundingClientRect(), b = document.getElementById('anCaminhoAssistido').getBoundingClientRect(); return b.top >= a.bottom - 1; });
  afirma(await larguraOk(page) && lados, '375: os dois caminhos empilhados, sem rolagem lateral');
  await ir(page, '#avaliacoes?an=nova'); await page.waitForSelector('#anFormNova');
  afirma(await larguraOk(page), '375: nova análise sem rolagem lateral');
  await page.check('#anFormNova input[value="estrutura"]'); await page.fill('#anNome', 'TESTE — 375');
  await page.click('#anCriarBtn'); await page.waitForSelector('#anFormResponder[data-q="F2b"]', { timeout: 20000 });
  afirma(await larguraOk(page), '375: F2b sem rolagem lateral');
  await responderF2b(page, 'informal');
  await adicionarEntrega(page, 'Diagnósticos de aderência com recomendações');
  afirma(await larguraOk(page) && await existe(page, '#anPasso4'), '375: passos, entregas e retorno sem rolagem lateral');
  const alturas = await page.$$eval('#avaliacoesAnalise .btn, #avaliacoesAnalise .an-opcao', (ls) => ls.filter((l) => l.offsetParent).map((l) => l.getBoundingClientRect().height));
  afirma(alturas.every((h) => h >= 40), '375: alvos de toque com pelo menos 40 px', Math.min.apply(null, alturas));
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await entrada(browser);
    const g = await governanca(browser);
    await legado(browser);
    await semEntregas(browser);
    await perfis(browser, g.id);
  } catch (e) { console.log('ERRO', e && e.stack || e); falhas++; }
  await browser.close();
  console.log('\n' + total + ' verificações — ' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})();
