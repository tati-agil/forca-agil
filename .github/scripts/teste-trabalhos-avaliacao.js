/* TRABALHOS DE AVALIAÇÃO e TODAS AS RESPONSABILIDADES — encontrar um trabalho anterior sem lembrar o módulo, com
 * números reais. Firebase falso em persistência real; hermético; dados fictícios só no banco da página. Prova:
 *   A. Usuário novo: no Início, "Ver e continuar trabalhos" leva aos Trabalhos de avaliação (#avaliacoes?tr=1) — a
 *      Jornada do Mapa é consulta, com nome próprio; os números vêm dos registros (Produto/Serviço, responsabilidades,
 *      áreas) e "Continuar de onde parou" lista os rascunhos (P1–P16 e O1–O9) com link direto.
 *   B. Todas as responsabilidades (#avaliacoes?po=todas): as do Caminho A e as das análises de área numa lista só; a
 *      responsabilidade da área já registrada na Porta 2 aparece UMA vez, com a área de origem e quem executa; a ainda
 *      sem O1–O9 também aparece, com "Abrir análise da área"; busca e filtros por área e situação.
 *   D. Resultado A validar: "Avaliação concluída"; a decisão final registrada por uma pessoa aparece separada da
 *      recomendação automática, que continua "A validar".
 *   H. 375 px: sem rolagem lateral nos Trabalhos e na lista consolidada. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const { semente, ARQ, chave } = require('./semente-jornada');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
let falhas = 0, total = 0;
function afirma(c, msg, det) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); if (!c) falhas++; }
const T = 1791713600000, POR = { id: 'u-x', email: ARQ };
function banco0() {
  const db = semente();
  db['analises-organizacionais-config'] = { habilitacao: 'LIBERADO_PARA_PERFIS_AUTORIZADOS' };
  /* uma análise de área (fictícia): uma responsabilidade já registrada na Porta 2 (oAgi) e outra ainda sem O1–O9 */
  db['analises-organizacionais'] = { 'an-gecon': { id: 'an-gecon', nome: 'GECON — Gerência de Contabilidade (teste)', tipoEscopo: 'estrutura', situacao: 'aberta', revisao: 3, criadaEm: T, criadaPor: POR,
    atualizadoEm: T, atualizadoPor: { uid: 'u-x', email: ARQ }, auditoriaId: 'a1',
    recortes: {
      r1: { id: 'r1', descricao: 'Disseminação de agilidade', nome: 'Disseminação de agilidade', contrato: 'registro-direto', situacao: 'ativo', versao: 1, ordem: 0, objetoId: 'oAgi', criadoEm: T, criadoPor: POR,
        fatos: { execucao: { 0: { texto: 'CONTA — Núcleo de Contabilidade', carater: 'declarado', fonte: 'teste', informadoEm: T, informadoPor: POR } } } },
      r2: { id: 'r2', descricao: 'Gerir o processo contábil.', nome: 'Gerir o processo contábil.', contrato: 'registro-direto', situacao: 'ativo', versao: 1, ordem: 1, criadoEm: T, criadoPor: POR }
    } } };
  db['analises-por-objeto'] = { oAgi: { analiseId: 'an-gecon', recorteId: 'r1' } };
  /* um rascunho do O1–O9 de uma responsabilidade nova */
  db['objetos-organizacionais'].oRas = { nome: 'Gerir a conformidade fiscal', descricao: 'Gerir a conformidade fiscal', finalidade: 'Gerir a conformidade fiscal', situacao: 'ativo', revisao: 1, criadoPor: { uid: 'u', email: ARQ }, criadoEm: 1, atualizadoPor: { uid: 'u', email: ARQ }, atualizadoEm: 1, auditoriaId: 'x' };
  db['avaliacoes-posicionamento'].gRas = { itemId: 'oRas', itemNome: 'Gerir a conformidade fiscal', status: 'rascunho', origem: 'objeto-organizacional', versao: 1, revisao: 1, hipoteseInicial: 'NAO_SEI' };
  db['posicionamento-rascunho-por-item'] = { oRas: 'gRas' };
  return db;
}
async function abrir(browser, viewport, hash) {
  const cfg = { db: banco0(), user: { email: ARQ, emailVerified: true, uid: 'u-' + chave(ARQ) }, uidDoUsuario: true, prefixoChave: 't' + (++abrir.n) + 'x', delayDefault: 10, persistenciaReal: true };
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
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent : ''; }, sel);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [vp, rot] of [[{ width: 1280, height: 900 }, 'desktop'], [{ width: 375, height: 812 }, '375 px']]) {
      console.log('\n== ' + rot + ' ==');
      const { ctx, page, erros } = await abrir(browser, vp, '#avaliacoes');
      console.log('A. Usuário novo: continuar um trabalho');
      await page.waitForSelector('#avpInicioTrabalhos');
      afirma(/Ver e continuar trabalhos/.test(await texto(page, '#avpInicioTrabalhos')) && /Consultar jornada até o Mapa/.test(await texto(page, '#avpInicioJornada')) &&
        await page.evaluate(() => ['avpInicioNatureza', 'avpInicioAtuacao', 'avpInicioAnalise', 'avpInicioTrabalhos', 'avpInicioJornada'].every((i) => !!document.getElementById(i))),
        'no Início: começar (Produto/Serviço, responsabilidade, área), continuar e a Jornada como consulta — tudo à vista');
      await page.click('#avpInicioTrabalhos');
      await esperar(page, () => location.hash === '#avaliacoes?tr=1' && !!document.getElementById('avpTrabalhos'));
      await esperar(page, () => document.getElementById('avpTrabRespProntas') && document.getElementById('avpTrabRespProntas').textContent !== '…' && document.getElementById('avpTrabAreasQtd') && document.getElementById('avpTrabAreasQtd').textContent !== '…');
      const n = await page.evaluate(() => Object.fromEntries(['avpTrabProdAndamento', 'avpTrabProdConcluidas', 'avpTrabRespProntas', 'avpTrabRespAndamento', 'avpTrabRespAvaliadas', 'avpTrabAreasQtd', 'avpTrabAreasProntas'].map((i) => [i, document.getElementById(i).textContent])));
      afirma(n.avpTrabRespAndamento === '1' && n.avpTrabRespAvaliadas === '2' && n.avpTrabRespProntas === '1' && n.avpTrabAreasQtd === '1' && n.avpTrabAreasProntas === '1', 'números reais: 1 em avaliação, 2 avaliadas, 1 pronta (a da área sem O1–O9), 1 área', n);
      afirma(/Gerir a conformidade fiscal/.test(await texto(page, '#avpTrabPendentes')) && (await page.getAttribute('#avpTrabPendentes a[href="#avaliacoes?po=gRas"]', 'href')) === '#avaliacoes?po=gRas', '"Continuar de onde parou": o rascunho do O1–O9, com link direto');
      afirma(await larguraOk(page), rot + ': Trabalhos sem rolagem lateral');
      console.log('B. Todas as responsabilidades');
      await page.click('#avpTrabIrResponsabilidades');
      await esperar(page, () => location.hash === '#avaliacoes?po=todas' && document.querySelectorAll('#poTodasLista .po-todas-item').length > 0);
      const itens = await page.$$eval('#poTodasLista .po-todas-item', (l) => l.map((x) => ({ t: x.querySelector('strong').textContent, s: x.getAttribute('data-situacao'), a: x.getAttribute('data-area'), txt: x.textContent })));
      const agi = itens.filter((x) => x.t === 'Disseminação de agilidade');
      afirma(agi.length === 1 && agi[0].a === 'an-gecon' && /Área: GECON/.test(agi[0].txt) && /Quem executa hoje: CONTA/.test(agi[0].txt) && /Ver resultado/.test(agi[0].txt), 'a da área já registrada na Porta 2 aparece uma vez, com área, quem executa e "Ver resultado"', agi);
      const contabil = itens.find((x) => x.t === 'Gerir o processo contábil.');
      afirma(!!contabil && contabil.s === 'pronta' && /Abrir análise da área/.test(contabil.txt), 'a da área ainda sem O1–O9 também aparece ("Pronta para avaliar", "Abrir análise da área")');
      const jur = itens.find((x) => x.t === 'Assessoramento jurídico'), ras = itens.find((x) => x.t === 'Gerir a conformidade fiscal');
      afirma(!!jur && jur.a === '-' && /Registrada individualmente/.test(jur.txt) && /Decisão final/.test(jur.txt) && !!ras && ras.s === 'andamento' && /Continuar/.test(ras.txt), 'as do Caminho A: decisão final quando houver; rascunho com "Continuar"');
      await page.fill('#poTodasBusca', 'contábil');
      afirma((await page.$$eval('#poTodasLista .po-todas-item:not([hidden])', (l) => l.length)) === 1, 'busca pela descrição');
      await page.fill('#poTodasBusca', '');
      await page.selectOption('#poTodasArea', 'an-gecon');
      afirma((await page.$$eval('#poTodasLista .po-todas-item:not([hidden])', (l) => l.map((x) => x.querySelector('strong').textContent).sort().join('|'))) === 'Disseminação de agilidade|Gerir o processo contábil.', 'filtro por área');
      await page.selectOption('#poTodasArea', ''); await page.selectOption('#poTodasSituacao', 'andamento');
      afirma((await page.$$eval('#poTodasLista .po-todas-item:not([hidden])', (l) => l.length)) === 1, 'filtro por situação');
      afirma(await larguraOk(page), rot + ': lista consolidada sem rolagem lateral');
      console.log('D. Resultado A validar: concluída; decisão separada da recomendação');
      await page.evaluate(() => { location.hash = '#avaliacoes?po=gV'; });
      await page.waitForSelector('#poSituacaoAvaliacao');
      afirma(/Avaliação concluída/.test(await texto(page, '#poSituacaoAvaliacao')) && /A validar/.test(await texto(page, '#poSituacaoAvaliacao')) && /registrar a decisão final/.test(await texto(page, '#poSituacaoAvaliacao')), 'A validar: "Avaliação concluída", e o próximo passo é a decisão final');
      if (rot === 'desktop') {
        await page.selectOption('#poCodigoFinal', 'AREA_ESPECIALIZADA');
        await page.fill('#poJustificativaInput', 'Decisão de teste: a responsabilidade é de assessoramento especializado.');
        await page.click('#poDecidirBtn');
        const modal = await page.$('.po-modal .po-modal-sim'); if (modal) await modal.click();
        await page.waitForSelector('#poDecisaoFinal');
        afirma(/A validar/.test(await texto(page, '#poRecomendado')) && /AREA_ESPECIALIZADA|Área Especializada/.test(await texto(page, '#poDecisaoFinal')) && /Há decisão final registrada/.test(await texto(page, '#poSituacaoAvaliacao')),
          'depois da decisão: a recomendação automática continua "A validar"; a decisão final aparece separada');
      }
      afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
      await ctx.close();
    }
  } catch (e) { console.log('ERRO', e && e.stack || e); falhas++; }
  await browser.close();
  console.log('\n' + total + ' verificações — ' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})();
