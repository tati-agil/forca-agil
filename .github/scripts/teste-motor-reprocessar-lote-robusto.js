/* "REPROCESSAR TUDO COM MOTOR ATUAL" nunca pode travar em "0 de N concluídas".
 *
 * POR QUE ESTE TESTE EXISTE
 * Relato real (produção, 30/09): clicar "REPROCESSAR TUDO COM MOTOR ATUAL (7)"
 * deixava a tela parada em "Reprocessando avaliações… 0 de 7 concluídas" para
 * sempre; recarregando a página, estava tudo como antes — nada gravado.
 * Causa: avaliações antigas (anteriores à parametrização dos questionários)
 * não têm questionnaireContentVersion; o reprocessamento montava
 * respostas[id].questionnaireContentVersion = undefined, e o SDK do Firebase
 * RECUSA qualquer undefined de forma SÍNCRONA ("First argument contains
 * undefined…") — uma exceção lançada dentro do worker do lote, que ninguém
 * capturava: o worker morria, o contador nunca andava, nada era gravado.
 * O firebase-falso aceitava undefined, então nenhum teste pegava; em
 * persistenciaReal ele agora recusa como o SDK.
 *
 * Prova: (1) avaliações legadas reprocessam de verdade em lote e
 * individualmente, sem nenhum undefined no que é gravado; (2) mesmo que UMA
 * avaliação falhe de um jeito inesperado (exceção síncrona ao gravar), o lote
 * continua com as outras, termina e mostra o erro dela — nunca congela;
 * (3) uma gravação que nunca responde (rede) não congela o lote: ela é
 * reportada como "sem confirmação" e o resto termina. Desktop e 375 px. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const EMAIL = 'teste@previ.com.br';
const KEY = EMAIL.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

/* Avaliação LEGADA, como existe em produção: concluída antes da
   parametrização dos questionários (sem questionnaireContentVersion nem
   snapshot por resposta) e antes do motor declarativo (motorVersion antigo,
   sem motorVersionArquitetura). */
function itemLegado(nome, i) {
  const respostas = {};
  ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia'].forEach((id) => { respostas[id] = { valor: 'sim', justificativaAuto: 'SIM — antiga ' + id, observacao: 'obs ' + id }; });
  ['jornada', 'medicao', 'gestao', 'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'].forEach((id) => { respostas[id] = { valor: 'nao', justificativaAuto: 'NÃO — antiga ' + id, observacao: '' }; });
  return {
    nome: nome, descricao: '', publico: '', necessidade: '', observacoesGerais: '',
    status: 'concluido', respostas: respostas,
    resultadoAutomatico: 'produto', decisaoFinal: 'produto', decisaoManual: false,
    camadaSugerida: { id: 'produto-principal', label: 'Produto/Serviço principal', motivos: ['m'] },
    justificativaAutomatica: 'texto antigo ' + i, criteriosAtendidos: 5,
    motorVersion: '2026.08.01-1',
    criadoEm: '2026-08-01T10:00:0' + i + '.000Z', atualizadoEm: '2026-08-01T10:00:0' + i + '.000Z',
    responsavel: { name: 'Teste', email: EMAIL }, versao: 1, excluido: false
  };
}
function base(n) { const o = {}; for (let i = 1; i <= n; i++) o['leg' + i] = itemLegado('Legada ' + i, i); return o; }

async function abrirApp(browser, avaliacoes, viewport, extra) {
  const admins = {}; admins[KEY] = { email: EMAIL };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {},
    'turmas-checkin': {}, 'turmas-espera': {}, 'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {},
    eventos: {}, 'turmas-publico': {}, 'eventos-publico': {}, 'avaliacoes-produto': avaliacoes, 'avaliacoes-squad': {},
    'motor-squad-config': {}, 'motor-squad-auditoria': {}, 'motor-arquitetura-config': {}, 'motor-arquitetura-auditoria': {} };
  const cfg = Object.assign({ db: db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true }, extra || {});
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
  await page.waitForFunction(() => document.querySelectorAll('.avp-tag-motor--desatualizado').length > 0, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
  return { ctx, page, erros };
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
async function reprocessarTudo(page) {
  await page.click('#avpReprocessarTudoBtn');
  await page.waitForSelector('#avpLoteConfirmar', { timeout: 3000 });
  await page.click('#avpLoteConfirmar');
}
const esperarResumo = (page, ms) => page.waitForSelector('#avpLoteResumoFinal', { timeout: ms || 15000 }).then(() => true).catch(() => false);
const progresso = (page) => page.locator('#avpLoteProgressoTexto').innerText().catch(() => '');
function temUndefinedOuNull(v) { return JSON.stringify(v).indexOf('undefined') !== -1; }

(async () => {
  const browser = await chromium.launch();

  console.log('== 1. O relato: 7 avaliações LEGADAS (sem versão de questionário) — REPROCESSAR TUDO termina ==');
  {
    const { ctx, page, erros } = await abrirApp(browser, base(7));
    afirma(await page.locator('.avp-tag-motor--desatualizado').count() === 7, 'pré-condição: 7 "Motor desatualizado"');
    afirma(/REPROCESSAR TUDO COM MOTOR ATUAL \(7\)/.test(await page.locator('#avpReprocessarTudoBtn').innerText()), 'botão "REPROCESSAR TUDO COM MOTOR ATUAL (7)"');
    await reprocessarTudo(page);
    const terminou = await esperarResumo(page);
    afirma(terminou, 'o lote TERMINA (antes: parado em "0 de 7 concluídas" para sempre)' + (terminou ? '' : ' — ficou em: ' + await progresso(page)));
    const resumo = await page.locator('#avpLoteResumoFinal').innerText().catch(() => '');
    afirma(/7 avaliações atualizadas/.test(resumo) && !/erro/.test(resumo), 'resumo: 7 atualizadas, nenhum erro: ' + resumo.replace(/\s+/g, ' '));
    const av = (await banco(page))['avaliacoes-produto'];
    afirma(Object.keys(av).every((k) => av[k].motorVersion !== '2026.08.01-1' && typeof av[k].motorVersionArquitetura === 'number'), 'as 7 foram gravadas no banco com o motor atual');
    afirma(Object.keys(av).every((k) => av[k].historicoMotor && av[k].historicoMotor.length === 1 && av[k].historicoMotor[0].justificativaAutomatica === 'texto antigo ' + k.slice(3)),
      'o resultado anterior de cada uma ficou no histórico');
    afirma(Object.keys(av).every((k) => av[k].respostas.autonomia.observacao === 'obs autonomia' && av[k].respostas.autonomia.valor === 'sim'), 'respostas e observações intactas');
    await page.click('#avpLoteFechar');
    await page.waitForTimeout(200);
    afirma(await page.locator('.avp-tag-motor--atual').count() === 7, 'lista: as 7 em "Motor atual" (o que está no banco — recarregar a página no site de verdade mostra o mesmo)');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  console.log('\n== 2. Botão individual numa avaliação legada ==');
  {
    const { ctx, page, erros } = await abrirApp(browser, base(1));
    await page.click('.avp-act-ver[data-key="leg1"]');
    await page.waitForSelector('#avpReprocessarBtn', { timeout: 5000 });
    await page.click('#avpReprocessarBtn');
    await page.click('.avp-modal-confirm-btn');
    const ok = await page.waitForFunction(() => /reprocessada/.test((document.querySelector('#avpFlashResultado') || {}).textContent || ''), { timeout: 8000 }).then(() => true).catch(() => false);
    afirma(ok, 'reprocessar individual conclui e mostra a confirmação');
    const it = (await banco(page))['avaliacoes-produto'].leg1;
    afirma(it.motorVersion !== '2026.08.01-1', 'gravado no banco');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  console.log('\n== 3. Uma avaliação que falha de forma inesperada não congela as outras ==');
  {
    const { ctx, page, erros } = await abrirApp(browser, base(4));
    /* Simula uma exceção SÍNCRONA ao gravar só uma delas (como o SDK faz). */
    await page.evaluate(() => {
      const refOriginal = firebase.database().ref.bind(firebase.database());
      const proto = Object.getPrototypeOf(firebase.database().ref('x'));
      const updateOriginal = proto.update;
      proto.update = function (v, cb) {
        if (/avaliacoes-produto\/leg2$/.test(this.path)) throw new Error('Reference.update failed: erro simulado');
        return updateOriginal.call(this, v, cb);
      };
    });
    await reprocessarTudo(page);
    const terminou = await esperarResumo(page);
    afirma(terminou, 'o lote termina mesmo com uma exceção no meio' + (terminou ? '' : ' — ficou em: ' + await progresso(page)));
    const resumo = await page.locator('#avpLoteProgressoCard').innerText().catch(() => '');
    afirma(/3 avaliações atualizadas/.test(resumo), '3 atualizadas');
    afirma(/1 apresentou erro/.test(resumo) && /Legada 2/.test(resumo), 'a que falhou aparece na lista de erros com o nome: ' + resumo.replace(/\s+/g, ' ').slice(0, 220));
    const av = (await banco(page))['avaliacoes-produto'];
    afirma(av.leg2.motorVersion === '2026.08.01-1' && av.leg1.motorVersion !== '2026.08.01-1', 'no banco: a que falhou ficou como estava; as outras foram gravadas');
    afirma(erros.length === 0, 'nenhum erro de JS não tratado (' + erros.length + ')');
    await ctx.close();
  }

  console.log('\n== 4. Rede: uma gravação que nunca responde não congela o lote ==');
  {
    /* 999000 = "nunca responde" (ver firebase-falso.js) — só a leg3 */
    const { ctx, page, erros } = await abrirApp(browser, base(4), null, { delays: { 'avaliacoes-produto/leg3': 999000 } });
    await reprocessarTudo(page);
    const terminou = await esperarResumo(page, 40000);
    afirma(terminou, 'o lote termina em tempo finito' + (terminou ? '' : ' — ficou em: ' + await progresso(page)));
    const resumo = await page.locator('#avpLoteProgressoCard').innerText().catch(() => '');
    afirma(/3 avaliações atualizadas/.test(resumo), '3 atualizadas');
    afirma(/Legada 3/.test(resumo) && /sem confirmação/i.test(resumo), 'a que não respondeu aparece como "sem confirmação do servidor": ' + resumo.replace(/\s+/g, ' ').slice(0, 260));
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  console.log('\n== 5. Celular (375 px): o lote termina e o resumo cabe na tela ==');
  {
    const { ctx, page, erros } = await abrirApp(browser, base(7), { width: 375, height: 740 });
    await reprocessarTudo(page);
    afirma(await esperarResumo(page), 'o lote termina no celular');
    afirma(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'sem rolagem horizontal');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  await browser.close();
  console.log(falhas === 0
    ? '\n============================\nOK — reprocessar em lote termina sempre: avaliações legadas gravam, uma falha não para as outras, e uma gravação sem resposta não congela a tela.'
    : '\n============================\n' + falhas + ' FALHA(S)');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
