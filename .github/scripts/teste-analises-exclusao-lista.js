/* ANÁLISES ORGANIZACIONAIS — excluir pela LISTA (menu ⋯) e pelo botão de dentro da análise, com o foco certo.
 * Firebase falso em persistência real; hermético; dados 100% sintéticos (nada vai para produção). As regras do banco
 * continuam provadas por teste-rules-exclusao-cadastros.js; aqui, a interface (computador e 375 px):
 *   1. Lista: cada cartão tem o menu ⋯ separado da ação principal; "Excluir análise" abre a MESMA confirmação de dentro
 *      da análise, na própria lista (sem entrar nem preencher nada), com nome, data e código; foco no motivo.
 *   2. Dentro da análise: "Excluir a análise" rola até a confirmação e foca o MOTIVO — nunca o campo "Quais
 *      responsabilidades a área tem?" (o defeito: o seletor genérico pegava o primeiro campo da página).
 *   3. Duas análises com o mesmo nome: só a escolhida sai.
 *   4. Sem motivo: o erro aparece junto do campo, que recebe o foco.
 *   5. Com conteúdo: Avaliação + Configuração vê só a explicação (foco nela); a administração geral confirma a exclusão
 *      excepcional (marca explícita obrigatória).
 *   6. Com aprovação registrada: bloqueio explicado (foco na mensagem), nada gravado.
 *   7. Cancelar não grava nada e devolve o foco ao botão de origem.
 *   8. Teclado (menu e botão por Enter), rolagem, Voltar do navegador.
 *   9. A responsabilidade com cadastro próprio na Porta 2 continua existindo (nada em cascata).
 *  10. Perfil Avaliação (consulta): nenhum menu ⋯; a ação principal dos cartões continua igual. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const { semente, ARQ, AVAL, chave } = require('./semente-jornada');
const N = require(path.join(__dirname, '..', '..', 'forca-agil', 'analises-organizacionais-nucleo.js'));
const F = require(path.join(__dirname, '..', '..', 'forca-agil', 'analises-organizacionais-firebase.js'));

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const ADM = 'admin.geral@previ.com.br';
const NOME_DUP = 'TESTE — Núcleo de Governança de TI';
let falhas = 0, total = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); if (!c) falhas++; }

const objeto = (nome) => ({ nome, descricao: nome, finalidade: nome, contexto: 'Cadastro simplificado (teste sintético).', situacao: 'ativo', revisao: 1,
  criadoPor: { uid: 'u', email: ARQ }, criadoEm: 1791713600000, atualizadoPor: { uid: 'u', email: ARQ }, atualizadoEm: 1791713600000, auditoriaId: 'a' });
function porCaminho(db, p, v) { const ks = p.split('/'); let o = db; ks.slice(0, -1).forEach((k) => { o = o[k] = o[k] || {}; }); o[ks[ks.length - 1]] = v; }
function sementeLista() {
  const db = semente();
  db['fa-admins'] = Object.assign({}, db['fa-admins'] || {}, { [chave(ADM)]: true });
  db['fa-users'][chave(ADM)] = { name: 'Admin', email: ADM, area: 'INFOR' };
  db['objetos-organizacionais'].oCad = objeto('Sintética — cadastro vindo da análise');
  let n = 0;
  const op = (fn, quem) => {
    const est = F.estadoDoBanco({ analises: db['analises-organizacionais'], propostas: db['analises-propostas'], aprovacoes: db['analises-aprovacoes'] });
    const u = quem || ARQ;
    const r = fn(est, { operacaoId: 'op' + (++n), novoId: 'n' + n, usuario: { id: chave(u), email: u }, agora: 1791713600000 + n * 86400000 });
    if (!r.ok) throw new Error(JSON.stringify(r.erros));
    const w = F.payloadOperacao(r, { audId: 'ev' + n, usuario: { uid: chave(u), email: u }, agora: 1791713600000 + n * 86400000 });
    Object.keys(w).forEach((k) => porCaminho(db, k, w[k]));
  };
  /* duas análises vazias com o MESMO nome (como em produção), uma vazia para o botão de dentro, uma com conteúdo e uma aprovada */
  op((e, c) => N.criarAnalise(e, { nome: NOME_DUP, tipoEscopo: 'estrutura' }, Object.assign(c, { novoId: 'anDupAntiga' })));
  op((e, c) => N.criarAnalise(e, { nome: NOME_DUP, tipoEscopo: 'estrutura' }, Object.assign(c, { novoId: 'anDupNova' })));
  op((e, c) => N.criarAnalise(e, { nome: 'Área sintética vazia', tipoEscopo: 'estrutura' }, Object.assign(c, { novoId: 'anVazia' })));
  op((e, c) => N.criarAnalise(e, { nome: 'Área sintética com conteúdo', tipoEscopo: 'estrutura' }, Object.assign(c, { novoId: 'anCheia' })));
  op((e, c) => N.definirRecorte(e, 'anCheia', { descricao: 'Sintética — só dentro da análise', separacao: { valor: 'nao' } }, Object.assign(c, { novoId: 'rA' })));
  op((e, c) => N.definirRecorte(e, 'anCheia', { descricao: 'Sintética — cadastro vindo da análise', separacao: { valor: 'nao' } }, Object.assign(c, { novoId: 'rC' })));
  op((e, c) => N.associarAtuacao(e, 'anCheia', 'rC', 'oCad', c));
  db['analises-por-objeto'] = { oCad: { analiseId: 'anCheia', recorteId: 'rC' } };
  op((e, c) => N.criarAnalise(e, { nome: 'Área sintética aprovada', tipoEscopo: 'estrutura' }, Object.assign(c, { novoId: 'anAprov' })));
  op((e, c) => N.definirRecorte(e, 'anAprov', { descricao: 'Sintética — da área aprovada', separacao: { valor: 'nao' } }, Object.assign(c, { novoId: 'rP' })));
  op((e, c) => N.registrarProposta(e, 'anAprov', { alternativa: 'manter-consciente', recortes: ['rP'], justificativa: 'Sintética' }, c));
  op((e, c) => N.registrarAprovacao(e, 'anAprov', 1, { autoridade: 'Diretoria (teste)', referencia: 'Ata sintética 1', dataDoAto: 1791713600000, objetoAprovado: 'Composição sintética' }, c), ADM);
  return db;
}
async function abrir(browser, viewport, hash, email) {
  const cfg = { db: sementeLista(), user: { email, emailVerified: true, uid: 'u-' + chave(email) }, uidDoUsuario: true, prefixoChave: 'k' + (++abrir.n) + 'x', delayDefault: 10, persistenciaReal: true };
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
const focado = (page) => page.evaluate(() => (document.activeElement && document.activeElement.id) || '');
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const naTela = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; }, sel);
const ir = async (page, hash) => { await page.evaluate((h) => { location.hash = h; }, hash); };
const analises = async (page) => JSON.stringify((await banco(page))['analises-organizacionais']);
const abrirMenu = async (page, id) => { await page.click('#anItemMenuBtn_' + id); await page.waitForSelector('#anItemExcluir_' + id, { state: 'visible' }); await page.click('#anItemExcluir_' + id); await page.waitForSelector('#anItemLi_' + id + ' #anFormExcluir'); };

async function rodada(browser, viewport, rotulo) {
  console.log('\n######## ' + rotulo + ' ########');
  let ctx, page, erros, db;

  /* ---------- 1, 3, 4, 7, 8: pela lista (Avaliação + Configuração) ---------- */
  ({ ctx, page, erros } = await abrir(browser, viewport, '#arquitetura?an=lista', ARQ));
  await page.waitForSelector('#anLista');
  afirma(await existe(page, '#anItemMenuBtn_anDupNova') && await existe(page, '#anItemAcao_anDupNova'), '1. cartão com o menu ⋯ e a ação principal ("Adicionar responsabilidades") separados');
  afirma(await page.evaluate(() => !document.querySelector('a.an-item details, a.an-item button')), '1. o menu fica fora do link do cartão (nada clicável dentro de outro clicável)');
  afirma(/Adicionar responsabilidades/.test(await texto(page, '#anItemAcao_anDupNova')), '10. a ação principal do cartão continua a mesma');
  /* 8. teclado: o menu abre por Enter e "Excluir análise" também */
  await page.focus('#anItemMenuBtn_anDupNova');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#anItemExcluir_anDupNova', { state: 'visible' });
  await page.focus('#anItemExcluir_anDupNova');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#anItemLi_anDupNova #anFormExcluir[data-nivel="comum"]');
  afirma(await page.evaluate(() => location.hash) === '#arquitetura?an=lista', '1. a confirmação abre na própria lista (sem entrar na análise)');
  afirma(await focado(page) === 'anMotivoExcluir', '1/8. foco no "Motivo da exclusão" (pelo teclado)', await focado(page));
  afirma(await naTela(page, '#anFormExcluir'), '8. a confirmação está visível (rolagem até ela)');
  const ident = await texto(page, '#anExcluirIdent');
  afirma(ident.indexOf(NOME_DUP) !== -1 && /aberta em/.test(ident) && /código upNova/.test(ident), '3. a confirmação mostra nome, data e código da análise escolhida', ident);
  afirma(!(await existe(page, '#anItemLi_anDupAntiga #anFormExcluir')), '3. só o cartão escolhido abriu a confirmação');
  /* 4. sem motivo */
  const antes = await analises(page);
  await page.click('#anConfirmarExcluir');
  await page.waitForSelector('#anExcluirErro');
  afirma(/motivo/.test(await texto(page, '#anExcluirErro')) && await page.evaluate(() => document.getElementById('anMotivoExcluir').getAttribute('aria-invalid') === 'true') && await focado(page) === 'anMotivoExcluir',
    '4. sem motivo: erro junto do campo, campo marcado e com o foco');
  afirma(await analises(page) === antes, '4. nada gravado sem motivo');
  /* 7. cancelar */
  await page.click('#anFormExcluir [data-an="cancelar"]');
  await esperar(page, () => !document.getElementById('anFormExcluir'));
  afirma(await analises(page) === antes && await focado(page) === 'anItemMenuBtn_anDupNova', '7. Cancelar: nada gravado; o foco volta ao menu ⋯ do cartão', await focado(page));
  /* 1 + 3: excluir só a escolhida (mesmo nome) */
  await abrirMenu(page, 'anDupNova');
  await page.fill('#anMotivoExcluir', 'Criada por engano (teste sintético)');
  await page.click('#anConfirmarExcluir');
  await esperar(page, () => /excluída/.test((document.getElementById('anFlashLista') || {}).textContent || ''));
  db = await banco(page);
  afirma(!db['analises-organizacionais'].anDupNova && db['analises-organizacionais-excluidas'].anDupNova && db['analises-organizacionais-excluidas'].anDupNova.nivel === 'comum' && db['analises-organizacionais-excluidas'].anDupNova.motivo === 'Criada por engano (teste sintético)',
    '1. análise vazia excluída pela lista (comum), com o motivo e o registro mínimo');
  afirma(!!db['analises-organizacionais'].anDupAntiga && await existe(page, '#anItemLi_anDupAntiga') && !(await existe(page, '#anItemLi_anDupNova')), '3. a outra análise com o mesmo nome continua (na lista e no banco)');
  afirma(/upNova/.test(await texto(page, '#anFlashLista')) && await focado(page) === 'anFlashLista', '1. confirmação de sucesso com o código, na lista atualizada (foco nela)');
  afirma(Object.values(db['analises-organizacionais-auditoria'].anDupNova || {}).some((e) => e.tipo === 'analise.excluida'), '1. evento de auditoria "analise.excluida"');
  /* 5. com conteúdo, perfil Avaliação + Configuração: só a explicação */
  await abrirMenu(page, 'anCheia');
  afirma(await existe(page, '#anExcluirSoAdmin') && !(await existe(page, '#anConfirmarExcluir')) && await focado(page) === 'anExcluirSoAdmin', '5. com conteúdo, Avaliação + Configuração: só a explicação (foco nela), sem botão de excluir', await focado(page));
  await page.click('#anFormExcluir [data-an="cancelar"]');
  /* 6. aprovada: bloqueio */
  await abrirMenu(page, 'anAprov');
  afirma(await existe(page, '#anExcluirBloqueio') && !(await existe(page, '#anConfirmarExcluir')) && await focado(page) === 'anExcluirBloqueio', '6. com aprovação registrada: bloqueio explicado (foco na mensagem), sem botão de excluir', await focado(page));
  afirma(/aprova/i.test(await texto(page, '#anExcluirBloqueio')), '6. a mensagem cita a aprovação', await texto(page, '#anExcluirBloqueio'));
  afirma(await larguraOk(page), 'lista e confirmação sem rolagem lateral');
  await page.click('#anFormExcluir [data-an="cancelar"]');
  db = await banco(page);
  afirma(!!db['analises-organizacionais'].anAprov && !!db['analises-organizacionais'].anCheia, '6/7. nada gravado nas análises aprovada e com conteúdo');

  /* ---------- 2, 7, 8: pelo botão de dentro da análise ---------- */
  await page.click('#anItemLi_anVazia a.an-item');
  await page.waitForSelector('#anExcluirBtn');
  afirma(await existe(page, '#anRegistrar[open]') || await existe(page, '#anRegistrar'), '2. (análise vazia: o bloco "Quais responsabilidades a área tem?" está na tela)');
  await page.click('#anExcluirBtn');
  await page.waitForSelector('#anFormExcluir[data-nivel="comum"]');
  afirma(await focado(page) === 'anMotivoExcluir', '2. "Excluir a análise" foca o MOTIVO (não "Quais responsabilidades a área tem?")', await focado(page));
  afirma(await naTela(page, '#anMotivoExcluir'), '2. a confirmação aparece na tela (rolagem até ela)');
  afirma(/código nVazia/.test(await texto(page, '#anExcluirIdent')), '2. a mesma confirmação, com nome, data e código');
  await page.click('#anFormExcluir [data-an="cancelar"]');
  await esperar(page, () => !document.getElementById('anFormExcluir'));
  afirma(await focado(page) === 'anExcluirBtn', '7. Cancelar devolve o foco ao botão "Excluir a análise"', await focado(page));
  await page.focus('#anExcluirBtn');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#anFormExcluir');
  afirma(await focado(page) === 'anMotivoExcluir', '8. pelo teclado (Enter no botão), o foco também vai para o motivo');
  await page.fill('#anMotivoExcluir', 'Aberta por engano (teste sintético)');
  await page.click('#anConfirmarExcluir');
  await esperar(page, () => location.hash === '#arquitetura?an=lista' && /excluída/.test((document.getElementById('anFlashLista') || {}).textContent || ''));
  db = await banco(page);
  afirma(!db['analises-organizacionais'].anVazia && db['analises-organizacionais-excluidas'].anVazia, '2. excluída pelo botão de dentro; volta à lista com a confirmação');
  /* 8. ida e volta: abrir uma análise e voltar pelo navegador */
  await page.click('#anItemLi_anDupAntiga a.an-item');
  await page.waitForSelector('#anExcluirBtn');
  /* o foco genérico corrigido vale para as outras ações: Descartar foca o motivo do descarte, Cancelar volta ao botão */
  await page.click('#anDescartarBtn');
  await page.waitForSelector('#anFormDescartar');
  afirma(await focado(page) === 'anMotivoDescarte', '8. "Descartar a análise" foca o motivo do descarte (o formulário que abriu)', await focado(page));
  await page.click('#anFormDescartar [data-an="cancelar"]');
  await esperar(page, () => !document.getElementById('anFormDescartar'));
  afirma(await focado(page) === 'anDescartarBtn', '7. Cancelar o descarte volta ao botão; nada gravado', await focado(page));
  await page.goBack();
  await page.waitForSelector('#anLista');
  afirma(!(await existe(page, '#anFlashLista')) && await existe(page, '#anItemLi_anDupAntiga'), '8. Voltar do navegador: a lista, sem aviso antigo');
  afirma(!erros.length, 'sem erro de página (Avaliação + Configuração)', erros);
  await ctx.close();

  /* ---------- 5, 9: administração geral, exclusão excepcional ---------- */
  ({ ctx, page, erros } = await abrir(browser, viewport, '#arquitetura?an=lista', ADM));
  await page.waitForSelector('#anLista');
  await abrirMenu(page, 'anCheia');
  afirma(await existe(page, '#anFormExcluir[data-nivel="excepcional"]') && /cadastro próprio e continua existindo/.test(await texto(page, '#anExcluirDeps')) && await focado(page) === 'anMotivoExcluir',
    '5. admin geral: exclusão excepcional com as consequências e foco no motivo', await focado(page));
  await page.fill('#anMotivoExcluir', 'Duplicada (teste sintético)');
  await page.click('#anConfirmarExcluir');
  await page.waitForSelector('#anExcluirErro');
  afirma(/confirmação/.test(await texto(page, '#anExcluirErro')) && await focado(page) === 'anExcluirConfirmo', '5. sem a marca explícita, não grava (erro junto da marca, foco nela)');
  afirma(!!(await banco(page))['analises-organizacionais'].anCheia, '5. nada gravado sem a marca');
  await page.check('#anExcluirConfirmo');
  await page.click('#anConfirmarExcluir');
  await esperar(page, () => /excluída/.test((document.getElementById('anFlashLista') || {}).textContent || ''));
  db = await banco(page);
  afirma(!db['analises-organizacionais'].anCheia && db['analises-organizacionais-excluidas'].anCheia.nivel === 'excepcional', '5. excepcional gravada pela lista');
  afirma(!!db['objetos-organizacionais'].oCad && db['objetos-organizacionais'].oCad.situacao === 'ativo', '9. a responsabilidade com cadastro próprio na Porta 2 continua existindo (nada em cascata)');
  await abrirMenu(page, 'anAprov');
  afirma(await existe(page, '#anExcluirBloqueio') && !(await existe(page, '#anConfirmarExcluir')), '6. aprovada: bloqueada também para a administração geral');
  afirma(await larguraOk(page), 'confirmação excepcional sem rolagem lateral');
  afirma(!erros.length, 'sem erro de página (admin geral)', erros);
  await ctx.close();

  /* ---------- 10: perfil Avaliação (consulta) ---------- */
  ({ ctx, page, erros } = await abrir(browser, viewport, '#arquitetura?an=lista', AVAL));
  await page.waitForSelector('#anLista');
  afirma(!(await existe(page, '.an-menu')) && await existe(page, '#anItemAcao_anDupAntiga'), '10. perfil Avaliação: nenhum menu ⋯; o cartão continua abrindo a análise');
  afirma(!erros.length, 'sem erro de página (Avaliação)', erros);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  await rodada(browser, { width: 1280, height: 900 }, 'COMPUTADOR (1280 px)');
  await rodada(browser, { width: 375, height: 740 }, 'CELULAR (375 px)');
  await browser.close();
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
