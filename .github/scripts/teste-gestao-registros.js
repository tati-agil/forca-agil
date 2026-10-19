/* GERENCIAR REGISTROS sem entrar na avaliação (19/10/2026) — Firebase falso em persistência real; desktop e 375 px.
 *   1. Todas as responsabilidades: ação principal (Avaliar/Continuar/Ver resultado) separada do menu ⋯ (Editar, Encerrar,
 *      Excluir cadastro); excluir um cadastro de teste SEM avaliação pelo menu, com motivo, sem abrir Avaliar; bloqueio por
 *      vínculo ativo explicado; linha de análise ainda não registrada só leva à análise de origem.
 *   2. Lista O1–O9: Porta 2 com o mesmo menu; Porta 1 com o caminho para a Avaliação de Produto/Serviço de origem.
 *   3. Adequação à Squad: ⋯ › Excluir com justificativa (sem ela, não grava); sai da lista; Lixeira com Restaurar;
 *      auditoria da exclusão e da restauração; respostas e resultado intactos.
 *   Sem rolagem lateral; sem erro de JS. */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const SJ = require('./semente-jornada');
const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
let falhas = 0;
function afirma(c, msg, det) { console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + (typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 300) : '')); if (!c) falhas++; }
const objeto = (nome) => ({ nome, descricao: 'Descrição', finalidade: 'Finalidade', situacao: 'ativo', revisao: 1, criadoPor: { uid: 'u', email: SJ.ARQ }, criadoEm: 1, atualizadoPor: { uid: 'u', email: SJ.ARQ }, atualizadoEm: 1, auditoriaId: 'a' });
const squad = (itemId, nome) => ({ itemId, itemNome: nome, questionarioCodigo: 'ADEQUACAO_SQUAD', questionnaireContentVersion: 1, status: 'concluido', criadoEm: '2026-10-19T10:00:00.000Z', atualizadoEm: '2026-10-19T10:00:00.000Z',
  criadoPor: { name: 'P', email: SJ.ARQ }, respostas: { S1: { valor: 'sim' } }, resultadoAutomatico: null, excluido: false, excluidoEm: null, excluidoPor: null, justificativaExclusao: null });
function banco() {
  const db = SJ.semente();
  db['objetos-organizacionais'].oTeste = objeto('teste');
  db['avaliacoes-squad'] = { sA: squad('pCapec', 'Capec'), sB: squad('pAssess', 'Assessoria Previdenciária') };
  return db;
}
async function abrir(browser, vp, hash) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage(); page.setDefaultTimeout(15000);
  const erros = []; page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify({ db: banco(), user: { email: SJ.ARQ, emailVerified: true, uid: 'u-' + SJ.chave(SJ.ARQ) }, delayDefault: 10, persistenciaReal: true }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const texto = (p, s) => p.evaluate((x) => { const e = document.querySelector(x); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; }, s);
const existe = (p, s) => p.evaluate((x) => !!document.querySelector(x), s);
const larguraOk = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const ler = (p, c) => p.evaluate((x) => window.firebase.database().ref(x).once('value').then((s) => s.val()), c);
const ate = (p, fn, arg, d) => esperarCondicao(p, fn, arg, { limite: 15000, descricao: d });
const linhaTodas = (p, nome) => p.locator('#poTodasLista .po-todas-item', { has: p.locator('strong', { hasText: new RegExp('^' + nome + '$') }) });

async function rodada(browser, vp, tag) {
  console.log('\n######## ' + tag + ' ########');
  console.log('1. Todas as responsabilidades');
  let r = await abrir(browser, vp, '#arquitetura?po=todas'), p = r.page;
  await p.waitForSelector('#poTodasLista');
  const lt = linhaTodas(p, 'teste');
  afirma(/Avaliar/.test(await lt.locator('a.btn').first().textContent()) && await lt.locator('details.po-menu').count() === 1, 'a ação principal (Avaliar) e o menu ⋯ ficam separados');
  await lt.locator('details.po-menu summary').click();
  const itens = await lt.locator('[data-po-gerir]').evaluateAll((bs) => bs.map((b) => b.getAttribute('data-po-gerir')).join());
  afirma(itens === 'editar,encerrar,excluir', 'menu ⋯: Editar cadastro, Encerrar responsabilidade, Excluir cadastro', itens);
  await lt.locator('[data-po-gerir="excluir"]').click();
  await p.waitForSelector('.po-modal #poMotivoExcluirAtuacao');
  afirma(/Excluir este cadastro/.test(await texto(p, '.po-modal')) && /Não há avaliações nem vínculos/.test(await texto(p, '.po-modal')), 'exclusão comum (sem avaliação), explicando que não há dependências — sem abrir Avaliar');
  afirma(/po=todas/.test(await p.evaluate(() => location.hash)), 'continua na lista (não entrou na avaliação)');
  await p.click('.po-modal .po-modal-sim');
  afirma(/motivo/.test(await texto(p, '.po-modal .po-modal-erro')), 'sem motivo, não exclui');
  await p.fill('#poMotivoExcluirAtuacao', 'Cadastro de teste criado por engano');
  await p.click('.po-modal .po-modal-sim');
  await ate(p, () => /Cadastro excluído/.test((document.getElementById('poFlash') || {}).textContent || ''), undefined, 'cadastro excluído');
  afirma(!(await ler(p, 'objetos-organizacionais/oTeste')) && ((await ler(p, 'objetos-organizacionais-excluidos/oTeste')) || {}).motivo === 'Cadastro de teste criado por engano', 'o cadastro sai; fica o registro mínimo com o motivo');
  afirma(await linhaTodas(p, 'teste').count() === 0, 'a lista se atualiza: "teste" sai das Responsabilidades');
  const la = linhaTodas(p, 'Disseminação de agilidade');
  await la.locator('details.po-menu summary').click(); await la.locator('[data-po-gerir="excluir"]').click();
  await ate(p, () => !!document.querySelector('.po-modal'), undefined, 'aviso de bloqueio');
  afirma(/não pode ser excluída agora/.test(await texto(p, '.po-modal')) && /estrutura responsável ativa/.test(await texto(p, '.po-modal')), 'bloqueio por vínculo com responsável principal, explicado com a ação necessária');
  await p.click('.po-modal .po-modal-sim');
  afirma(await larguraOk(p), 'sem rolagem lateral');
  await r.ctx.close();

  console.log('2. Lista O1–O9');
  r = await abrir(browser, vp, '#arquitetura?po=lista'); p = r.page;
  await p.waitForSelector('#poLista .po-linha[data-key="gA"]');
  await p.click('#poLista .po-linha[data-key="gA"] details.po-menu summary');
  afirma(await p.$$eval('#poLista .po-linha[data-key="gA"] [data-po-gerir]', (bs) => bs.map((b) => b.getAttribute('data-po-gerir')).join()) === 'editar,encerrar,excluir', 'Porta 2: o mesmo menu do cadastro, direto da lista');
  await p.click('#poLista .po-linha[data-key="gC"] details.po-menu summary');
  const ln = await p.$eval('#poLista .po-linha[data-key="gC"] .po-menu-itens a', (a) => ({ t: a.textContent, h: a.getAttribute('href') }));
  afirma(/Avaliação de Produto\/Serviço de origem/.test(ln.t) && ln.h === '#arquitetura?avp=pCapec' && /retira o item inteiro/.test(await texto(p, '#poLista .po-linha[data-key="gC"] .po-menu-itens')), 'Porta 1: leva à Avaliação de Produto/Serviço de origem e avisa que a Lixeira tira o item inteiro', ln);
  afirma(!(await existe(p, '#poLista .po-linha[data-key="gC"] [data-po-gerir="excluir"]')), 'Porta 1: nenhuma exclusão isolada da avaliação O1–O9');
  afirma(await larguraOk(p), 'sem rolagem lateral');
  await r.ctx.close();

  console.log('3. Adequação à Squad');
  r = await abrir(browser, vp, '#arquitetura?sq=lista'); p = r.page;
  await p.waitForSelector('.sq-act-abrir[data-key="sA"]');
  afirma(await p.locator('tr:has(.sq-act-abrir[data-key="sA"]) details.sq-menu').count() === 1, 'Visualizar e o menu ⋯ separados');
  await p.click('tr:has(.sq-act-abrir[data-key="sA"]) details.sq-menu summary');
  await p.click('.sq-act-excluir[data-key="sA"]');
  await p.waitForSelector('#sqGestao');
  await p.click('#sqConfirmarGestao');
  afirma(/justificativa/.test(await texto(p, '#sqGestaoErro')) && !(await ler(p, 'avaliacoes-squad/sA')).excluido, 'sem justificativa, não exclui');
  await p.fill('#sqJustGestao', 'Avaliação de teste criada por engano');
  await p.click('#sqConfirmarGestao');
  await ate(p, () => /Lixeira/.test((document.getElementById('sqFlashLista') || {}).textContent || ''), undefined, 'excluída');
  const sA = await ler(p, 'avaliacoes-squad/sA'), aud = Object.values((await ler(p, 'avaliacoes-squad-auditoria/sA')) || {});
  afirma(sA.excluido === true && sA.justificativaExclusao === 'Avaliação de teste criada por engano' && sA.excluidoPor.email === SJ.ARQ && sA.respostas.S1.valor === 'sim' && aud.length === 1 && aud[0].tipo === 'exclusao', 'exclusão lógica com justificativa, autoria e auditoria; respostas intactas');
  afirma(!(await existe(p, '.sq-act-abrir[data-key="sA"]')) && /Lixeira \(1\)/.test(await texto(p, '#sqLixeiraBtn')), 'sai da lista operacional; "Lixeira (1)"');
  await p.click('#sqLixeiraBtn');
  await p.waitForSelector('#sqLixeiraTabela');
  afirma(/criada por engano/.test(await texto(p, '#sqLixeiraTabela')), 'a Lixeira mostra quem, quando e a justificativa');
  await p.click('tr[data-key="sA"] details.sq-menu summary'); await p.click('.sq-act-restaurar[data-key="sA"]');
  await p.fill('#sqJustGestao', 'Era válida');
  await p.click('#sqConfirmarGestao');
  await ate(p, () => /restaurada/.test((document.getElementById('sqFlashLista') || {}).textContent || ''), undefined, 'restaurada');
  const sA2 = await ler(p, 'avaliacoes-squad/sA'), aud2 = Object.values((await ler(p, 'avaliacoes-squad-auditoria/sA')) || {});
  afirma(sA2.excluido === false && aud2.length === 2 && aud2.some((x) => x.tipo === 'restauracao' && x.justificativa === 'Era válida'), 'restaurada; a auditoria guarda a exclusão e a restauração');
  afirma(r.erros.length === 0 && await larguraOk(p), 'sem erro de JS e sem rolagem lateral');
  await r.ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try { for (const [vp, tag] of [[{ width: 1280, height: 900 }, 'desktop'], [{ width: 375, height: 800 }, 'celular 375px']]) await rodada(browser, vp, tag); }
  finally { await browser.close(); }
  console.log('\n' + (falhas ? 'FALHAS: ' + falhas : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
