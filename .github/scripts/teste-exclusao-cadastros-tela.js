/* EXCLUSÃO de cadastros na tela (contrato em dois níveis) — responsabilidades da Porta 2 e Análises Organizacionais.
 * Firebase falso em persistência real; hermético; dados 100% sintéticos (nada vai para produção). As regras do banco são
 * provadas no emulador por teste-rules-exclusao-cadastros.js; aqui, a interface:
 *   1. Responsabilidade sem Posicionamento: "Encerrar" e "Excluir cadastro" lado a lado, com a diferença explicada;
 *      Excluir pede motivo, mostra que não há dependências e grava: o cadastro sai, ficam o registro mínimo e o evento.
 *   2. Já avaliada (Posicionamento concluído), perfil Avaliação + Configuração: explica que é exclusão excepcional do
 *      administrador geral e não grava nada.
 *   3. Admin geral: confirmação excepcional com as dependências (Posicionamento e decisão) e a marca explícita; depois a
 *      ficha do Posicionamento mostra "Cadastro excluído" com o motivo, e a lista mostra o selo — a avaliação continua.
 *   4. Bloqueios: estrutura responsável ativa e rascunho aberto explicam o que fazer e não gravam.
 *   5. Análise vazia: Excluir a análise (comum) com motivo; some da lista; registro mínimo gravado.
 *   6. Responsabilidade só de texto: "Mais › Excluir" sai da análise; citada numa proposta: bloqueio explicado; com
 *      cadastro: "Excluir o cadastro…" leva à ficha dele.
 *   7. Análise com conteúdo, perfil Avaliação + Configuração: só o administrador geral; perfil Avaliação: nenhum botão.
 *   8. 375 px: confirmação e formulários sem rolagem lateral. */
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
let falhas = 0, total = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); if (!c) falhas++; }

const objeto = (nome) => ({ nome, descricao: nome, finalidade: nome, contexto: 'Cadastro simplificado: o nome e a finalidade repetem a descrição informada pela pessoa; nada foi inferido.', situacao: 'ativo', revisao: 1,
  criadoPor: { uid: 'u', email: ARQ }, criadoEm: 1791713600000, atualizadoPor: { uid: 'u', email: ARQ }, atualizadoEm: 1791713600000, auditoriaId: 'a' });
function porCaminho(db, p, v) { const ks = p.split('/'); let o = db; ks.slice(0, -1).forEach((k) => { o = o[k] = o[k] || {}; }); o[ks[ks.length - 1]] = v; }
function sementeExclusao() {
  const db = semente();
  db['fa-admins'] = Object.assign({}, db['fa-admins'] || {}, { [chave(ADM)]: true });
  db['fa-users'][chave(ADM)] = { name: 'Admin', email: ADM, area: 'INFOR' };
  Object.assign(db['objetos-organizacionais'], { oLivre: objeto('Sintética — cadastrada por engano'), oRasc: objeto('Sintética — com rascunho aberto'), oAn: objeto('Sintética — cadastro vindo da análise') });
  db['posicionamento-rascunho-por-item'].oRasc = 'gRasc';
  /* oAgi: Posicionamento concluído, sem estrutura responsável ativa (exclusão excepcional); oJur continua com vínculo ativo */
  delete db['estruturas-vinculos']['ativo-por-objeto'].oAgi;
  db['estruturas-vinculos'].registros.v4.situacao = 'encerrada';
  db['analises-organizacionais-config'] = { habilitacao: 'LIBERADO_PARA_PERFIS_AUTORIZADOS' };
  /* análises montadas pelo próprio núcleo + adaptador */
  let n = 0;
  const op = (fn) => {
    const est = F.estadoDoBanco({ analises: db['analises-organizacionais'], propostas: db['analises-propostas'], aprovacoes: db['analises-aprovacoes'] });
    const r = fn(est, { operacaoId: 'op' + (++n), novoId: 'n' + n, usuario: { id: chave(ARQ), email: ARQ }, agora: 1791713600000 + n });
    if (!r.ok) throw new Error(JSON.stringify(r.erros));
    const w = F.payloadOperacao(r, { audId: 'ev' + n, usuario: { uid: chave(ARQ), email: ARQ }, agora: 1791713600000 + n });
    Object.keys(w).forEach((k) => porCaminho(db, k, w[k]));
  };
  op((e, c) => N.criarAnalise(e, { nome: 'Área sintética vazia', tipoEscopo: 'estrutura' }, Object.assign(c, { novoId: 'anVazia' })));
  op((e, c) => N.criarAnalise(e, { nome: 'Área sintética com conteúdo', tipoEscopo: 'estrutura' }, Object.assign(c, { novoId: 'anCheia' })));
  op((e, c) => N.definirRecorte(e, 'anCheia', { descricao: 'Sintética A — registrada por engano', separacao: { valor: 'nao' } }, Object.assign(c, { novoId: 'rA' })));
  op((e, c) => N.definirRecorte(e, 'anCheia', { descricao: 'Sintética B — citada na proposta', separacao: { valor: 'nao' } }, Object.assign(c, { novoId: 'rB' })));
  op((e, c) => N.definirRecorte(e, 'anCheia', { descricao: 'Sintética — cadastro vindo da análise', separacao: { valor: 'nao' } }, Object.assign(c, { novoId: 'rC' })));
  op((e, c) => N.associarAtuacao(e, 'anCheia', 'rC', 'oAn', c));
  db['analises-por-objeto'] = { oAn: { analiseId: 'anCheia', recorteId: 'rC' } };
  op((e, c) => N.registrarProposta(e, 'anCheia', { alternativa: 'manter-consciente', recortes: ['rB'], justificativa: 'Sintética' }, c));
  return db;
}
async function abrir(browser, viewport, hash, email, db) {
  const cfg = { db: db || sementeExclusao(), user: { email, emailVerified: true, uid: 'u-' + chave(email) }, uidDoUsuario: true, prefixoChave: 'k' + (++abrir.n) + 'x', delayDefault: 10, persistenciaReal: true };
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
const esperar = (page, fn, arg) => esperarCondicao(page, fn, arg, { limite: 15000 });
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent : ''; }, sel);
const existe = (page, sel) => page.evaluate((s) => !!document.querySelector(s), sel);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const ir = (page, hash) => page.evaluate((h) => { location.hash = h; }, hash);
const abrirMais = (page, k) => page.evaluate((x) => { const d = document.getElementById('anMais_' + x); if (d) d.open = true; }, k);

async function jornada(browser, viewport, rotulo) {
  console.log('\n== ' + rotulo + ' ==');
  /* 1. sem Posicionamento: exclusão comum */
  let { ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?po=atuacoes&item=oLivre', ARQ);
  await page.waitForSelector('#poExcluirAtuacaoBtn');
  afirma(await existe(page, '#poEncerrarAtuacaoBtn'), '1. Encerrar e Excluir aparecem lado a lado (Excluir não substitui Encerrar)');
  afirma(/Encerrar.*mantém o cadastro.*Excluir.*por engano/.test(await texto(page, '#poEncerrarExcluirAjuda')), '1. a diferença entre Encerrar e Excluir está explicada');
  await page.click('#poExcluirAtuacaoBtn');
  await page.waitForSelector('.po-modal #poMotivoExcluirAtuacao');
  afirma(await existe(page, '.po-modal #poExcSemDeps'), '1. a confirmação mostra o registro e que não há dependências');
  afirma(await larguraOk(page), '1. confirmação sem rolagem lateral');
  await page.click('.po-modal .po-modal-sim');
  afirma(/motivo/i.test(await texto(page, '.po-modal .po-modal-erro')), '1. sem motivo, não grava (pede o motivo)');
  await page.fill('#poMotivoExcluirAtuacao', 'Cadastrada por engano (teste sintético)');
  await page.click('.po-modal .po-modal-sim');
  await esperar(page, () => /Cadastro excluído/.test((document.getElementById('poFlash') || {}).textContent || ''));
  let db = await banco(page);
  const t1 = (db['objetos-organizacionais-excluidos'] || {}).oLivre;
  afirma(!db['objetos-organizacionais'].oLivre && t1 && t1.nivel === 'comum' && t1.motivo === 'Cadastrada por engano (teste sintético)', '1. o cadastro saiu; registro mínimo comum com o motivo', t1);
  afirma(Object.values(db['objetos-organizacionais-auditoria'].oLivre || {}).some((e) => e.tipo === 'exclusao'), '1. evento "exclusao" na auditoria');
  afirma(!(await existe(page, '#poListaAtuacoes [data-objeto="oLivre"]')), '1. some da lista de responsabilidades');

  /* 2. já avaliada, Avaliação + Configuração: não é com ela */
  await ir(page, '#avaliacoes?po=atuacoes&item=oAgi');
  await page.waitForSelector('#poExcluirAtuacaoBtn');
  await page.click('#poExcluirAtuacaoBtn');
  await page.waitForSelector('.po-modal');
  afirma(/excepcional.*administrador geral/.test(await texto(page, '.po-modal')), '2. já avaliada: explica que é exclusão excepcional do administrador geral');
  await page.click('.po-modal .po-modal-sim');
  /* 4. bloqueios */
  await ir(page, '#avaliacoes?po=atuacoes&item=oJur');
  await page.waitForSelector('#poExcluirAtuacaoBtn');
  await page.click('#poExcluirAtuacaoBtn');
  await page.waitForSelector('.po-modal');
  afirma(/estrutura responsável ativa/.test(await texto(page, '.po-modal')), '4. estrutura responsável ativa: bloqueia e diz o que fazer');
  await page.click('.po-modal .po-modal-sim');
  await ir(page, '#avaliacoes?po=atuacoes&item=oRasc');
  await page.waitForSelector('#poExcluirAtuacaoBtn');
  await page.click('#poExcluirAtuacaoBtn');
  await page.waitForSelector('.po-modal');
  afirma(/rascunho de Posicionamento/.test(await texto(page, '.po-modal')), '4. rascunho aberto: bloqueia e diz o que fazer');
  await page.click('.po-modal .po-modal-sim');
  db = await banco(page);
  afirma(db['objetos-organizacionais'].oAgi && db['objetos-organizacionais'].oJur && db['objetos-organizacionais'].oRasc && !(db['objetos-organizacionais-excluidos'] || {}).oAgi, '2/4. nada foi gravado nos casos recusados');

  /* 5/6. análises */
  await ir(page, '#avaliacoes?an=anCheia');
  await page.waitForSelector('#anMais_rA');
  await abrirMais(page, 'rA');
  await page.click('#anExcluirResp_rA');
  await page.waitForSelector('#anFormExcluirResp');
  afirma(/Descartar.*mantém/.test(await texto(page, '#anFormExcluirResp')), '6. a diferença entre Excluir e Descartar está explicada');
  afirma(await larguraOk(page), '6. formulário sem rolagem lateral');
  await page.fill('#anMotivoExcluirRec', 'Registrada por engano (teste sintético)');
  await page.click('#anConfirmarExcluirResp');
  await esperar(page, () => /Responsabilidade excluída/.test((document.getElementById('anFlash') || {}).textContent || ''));
  db = await banco(page);
  afirma(!db['analises-organizacionais'].anCheia.recortes.rA, '6. a responsabilidade só de texto saiu da análise (não ficou como descartada)');
  afirma(Object.values(db['analises-organizacionais-auditoria'].anCheia).some((e) => e.tipo === 'recorte.excluido' && e.detalhe.motivo === 'Registrada por engano (teste sintético)'), '6. evento "recorte.excluido" com o motivo');
  await abrirMais(page, 'rB');
  await page.click('#anExcluirResp_rB');
  await page.waitForSelector('#anExcluirRespBloqueio');
  afirma(/proposta de composição registrada/.test(await texto(page, '#anExcluirRespBloqueio')), '6. citada numa proposta: bloqueio explicado, sem gravar');
  await page.click('#anExcluirRespBloqueio [data-an="cancelar"]');
  await abrirMais(page, 'rC');
  afirma(await page.evaluate(() => { const a = document.getElementById('anExcluirCadastro_rC'); return !!a && /po=atuacoes&item=oAn/.test(a.getAttribute('href')); }), '6. com cadastro: "Excluir o cadastro…" leva à ficha dele');
  afirma(!(await existe(page, '#anExcluirResp_rC')), '6. com cadastro: não há "Excluir" que tiraria só a ligação');
  await page.click('#anExcluirBtn');
  await page.waitForSelector('#anExcluirSoAdmin');
  afirma(/administrador geral/.test(await texto(page, '#anExcluirSoAdmin')), '7. análise com conteúdo: só o administrador geral');
  await ir(page, '#avaliacoes?an=anVazia');
  await page.waitForSelector('#anExcluirBtn');
  await page.click('#anExcluirBtn');
  await page.waitForSelector('#anFormExcluir[data-nivel="comum"]');
  await page.fill('#anMotivoExcluir', 'Aberta por engano (teste sintético)');
  await page.click('#anConfirmarExcluir');
  await esperar(page, () => location.hash === '#avaliacoes?an=lista' && !!document.getElementById('anLista'));
  db = await banco(page);
  afirma(!db['analises-organizacionais'].anVazia && (db['analises-organizacionais-excluidas'] || {}).anVazia && db['analises-organizacionais-excluidas'].anVazia.nivel === 'comum', '5. análise vazia excluída (comum), com registro mínimo');
  afirma(!(await existe(page, '#anLista [data-analise="anVazia"]')), '5. some da lista de análises');
  afirma(!erros.length, 'sem erro de página (Avaliação + Configuração)', erros);
  await ctx.close();

  /* 3. admin geral: exclusão excepcional */
  ({ ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?po=atuacoes&item=oAgi', ADM));
  await page.waitForSelector('#poExcluirAtuacaoBtn');
  await page.click('#poExcluirAtuacaoBtn');
  await page.waitForSelector('.po-modal #poExcConfirmo');
  afirma(/Posicionamento O1–O9 concluído/.test(await texto(page, '#poExcDeps')), '3. a confirmação excepcional mostra as dependências (Posicionamento)');
  afirma(await larguraOk(page), '3. confirmação excepcional sem rolagem lateral');
  await page.fill('#poMotivoExcluirAtuacao', 'Duplicada, já avaliada (teste sintético)');
  await page.click('.po-modal .po-modal-sim');
  afirma(/confirmação/.test(await texto(page, '.po-modal .po-modal-erro')), '3. sem a marca explícita, não grava');
  await page.check('#poExcConfirmo');
  await page.click('.po-modal .po-modal-sim');
  await esperar(page, () => /Cadastro excluído/.test((document.getElementById('poFlash') || {}).textContent || ''));
  db = await banco(page);
  afirma((db['objetos-organizacionais-excluidos'] || {}).oAgi && db['objetos-organizacionais-excluidos'].oAgi.nivel === 'excepcional' && db['avaliacoes-posicionamento'].gA && db['posicionamento-vigente-por-item'].oAgi === 'gA',
    '3. excepcional gravada; avaliação e índice de vigência intactos');
  await ir(page, '#avaliacoes?po=gA');
  await page.waitForSelector('#poObjetoExcluido');
  afirma(/Duplicada, já avaliada/.test(await texto(page, '#poObjetoExcluido')), '3. a ficha do Posicionamento mostra "Cadastro excluído" com o motivo');
  await ir(page, '#avaliacoes?po=lista');
  await page.waitForSelector('.po-linha[data-key="gA"]');
  afirma(await existe(page, '.po-linha[data-key="gA"] .po-badge-excluida'), '3. a lista do Posicionamento mostra o selo "Cadastro excluído"');
  afirma(!erros.length, 'sem erro de página (admin geral)', erros);
  await ctx.close();

  /* 7. perfil Avaliação: só consulta */
  ({ ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?po=atuacoes&item=oLivre', AVAL));
  await page.waitForSelector('#poAtuacaoSelecionada');
  afirma(!(await existe(page, '#poExcluirAtuacaoBtn')), '7. perfil Avaliação: nenhum botão Excluir na responsabilidade');
  await ir(page, '#avaliacoes?an=anCheia');
  await page.waitForSelector('#anTitulo');
  afirma(!(await existe(page, '#anExcluirBtn')) && !(await existe(page, '[id^="anExcluirResp_"]')), '7. perfil Avaliação: nenhum botão Excluir na análise');
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await jornada(browser, { width: 1280, height: 900 }, 'Computador (1280 px)');
    await jornada(browser, { width: 375, height: 800 }, 'Celular (375 px)');
  } finally { await browser.close(); }
  console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
