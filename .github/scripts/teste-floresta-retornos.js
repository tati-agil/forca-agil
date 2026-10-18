/* A FLORESTA — RETORNOS E ENTRADAS DO O1–O9. Firebase falso em persistência real; hermético; nada é gravado.
 * Desktop e 375 px. Prova:
 *   A. Cada entrada do Início (consultas, Trabalhos, Mapa, Gestão, formulários, Squad, análises) → o "← Voltar" tem o nome
 *      "A Floresta" e leva de volta ao Início, que aparece de verdade; o mesmo depois de F5 e por link direto.
 *   B. Análise Organizacional: a lista volta para a origem real (antes ia sempre para "Responsabilidades Organizacionais").
 *   C. As três entradas do O1–O9 com os mesmos nomes em todo lugar e o mesmo peso (nenhuma amarela entre alternativas):
 *      "Avaliar um item vinculado a Produto/Serviço" (escolher um item com P1–P16), "Avaliar uma responsabilidade" (o
 *      formulário da responsabilidade — o mesmo do Início) e "Analisar uma área"; o aviso de que usam o mesmo motor.
 *   D. "+ Analisar uma área" na lista de análises com o tamanho do texto (não a largura toda). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const SJ = require('./semente-jornada');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
let falhas = 0;
function afirma(c, msg, det) { console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + JSON.stringify(det) : '')); if (!c) falhas++; }

async function abrir(browser, vp, hash) {
  const db = SJ.semente();
  db['fa-admins'] = { [SJ.chave(SJ.ARQ)]: { email: SJ.ARQ, name: 'ADMIN' } };
  db['analises-organizacionais-config'] = { habilitacao: 'LIBERADO_PARA_PERFIS_AUTORIZADOS' };
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify({ db, user: { email: SJ.ARQ, emailVerified: true, uid: 'u1' }, delayDefault: 5, persistenciaReal: true }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const ver = (page, sel, d) => esperarCondicao(page, (s) => { const e = document.querySelector(s); return !!e && e.getBoundingClientRect().width > 0; }, sel, { limite: 15000, descricao: d || sel });
const noInicio = (page) => esperarCondicao(page, () => { const e = document.getElementById('avpInicio'); return location.hash === '#arquitetura' && !!e && e.offsetParent !== null; }, null, { limite: 15000, descricao: 'o Início da Floresta à vista' });
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; }, sel);
const ehPrimario = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && e.classList.contains('btn--primary'); }, sel);

/* [entrada no Início, endereço esperado, seletor do "← Voltar" da tela] */
const ENTRADAS = [
  ['avpInicioListaProdutos', '#arquitetura?av=lista', '#avpVoltarInicio'],
  ['avpInicioListaPosicionamentos', '#arquitetura?po=lista', '#poVoltar'],
  ['avpInicioListaSquad', '#arquitetura?sq=lista', '#sqVoltarArquitetura'],
  ['avpInicioListaAreas', '#arquitetura?an=lista', '#anVoltarAtuacoes'],
  ['avpInicioTrabalhos', '#arquitetura?tr=1', '#mfVoltar'],
  ['avpInicioMapa', '#arquitetura?mf=mapa', '#mfVoltar'],
  ['avpInicioGestaoAbrir', '#arquitetura?arq=inicio', '#avpGestaoVoltar'],
  ['avpInicioNatureza', '#arquitetura?nova=1', '#avpVoltarFormInicial'],
  ['avpInicioAtuacao', '#arquitetura?po=nova-atuacao', '#poVoltar'],
  ['avpInicioItem', '#arquitetura?po=escolher', '#poVoltar']
];

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [nome, vp] of [['desktop', { width: 1280, height: 900 }], ['375 px', { width: 375, height: 812 }]]) {
      console.log('\n######## ' + nome + ' ########');

      console.log('\n== A. Entradas do Início e o "← Voltar" ==');
      let r = await abrir(browser, vp, '#arquitetura');
      await noInicio(r.page);
      for (const [entrada, destino, volta] of ENTRADAS) {
        await r.page.click('#' + entrada);
        await esperarCondicao(r.page, (h) => location.hash === h, destino, { limite: 15000, descricao: destino });
        await ver(r.page, volta, 'o Voltar de ' + destino);
        const t = await texto(r.page, volta);
        afirma(t === '← Voltar para A Floresta', destino + ': "' + t + '"');
        await r.page.click(volta);
        await noInicio(r.page);
        afirma(true, destino + ' → Voltar → o Início à vista');
      }
      afirma(r.erros.length === 0, 'nenhum erro de página', r.erros);
      await r.ctx.close();

      console.log('\n== A2. Link direto e F5 ==');
      for (const [destino, volta] of [['#arquitetura?av=lista', '#avpVoltarInicio'], ['#arquitetura?an=lista', '#anVoltarAtuacoes'], ['#arquitetura?po=lista', '#poVoltar']]) {
        r = await abrir(browser, vp, destino);
        await ver(r.page, volta);
        await r.page.reload({ waitUntil: 'domcontentloaded' }); await esperarSessaoAssentada(r.page);
        await ver(r.page, volta, 'o Voltar depois do F5');
        afirma(await texto(r.page, volta) === '← Voltar para A Floresta', destino + ' (link direto + F5): "← Voltar para A Floresta"', await texto(r.page, volta));
        await r.page.click(volta);
        await noInicio(r.page);
        afirma(true, destino + ' (link direto + F5) → Voltar → o Início');
        await r.ctx.close();
      }

      console.log('\n== B. Análise Organizacional volta para a origem real ==');
      r = await abrir(browser, vp, '#arquitetura?tr=1');
      await ver(r.page, '#avpTrabIrAreas');
      await r.page.click('#avpTrabIrAreas');
      await ver(r.page, '#anVoltarAtuacoes');
      afirma(await texto(r.page, '#anVoltarAtuacoes') === '← Voltar para os Trabalhos', 'aberta pelos Trabalhos: "← Voltar para os Trabalhos"', await texto(r.page, '#anVoltarAtuacoes'));
      await r.page.click('#anVoltarAtuacoes');
      await esperarCondicao(r.page, () => location.hash === '#arquitetura?tr=1' && !!document.getElementById('avpTrabIrAreas'), null, { limite: 15000, descricao: 'de volta aos Trabalhos' });
      afirma(true, 'Voltar: os Trabalhos (antes: "Responsabilidades Organizacionais")');
      await r.ctx.close();

      console.log('\n== C. As três entradas do O1–O9: mesmos nomes, mesmo peso ==');
      r = await abrir(browser, vp, '#arquitetura');
      await noInicio(r.page);
      const porta2 = await r.page.evaluate(() => [...document.querySelectorAll('#avpInicioCartaoAtuacao .avp-inicio-opcao h4')].map((h) => h.textContent.trim()));
      afirma(JSON.stringify(porta2) === JSON.stringify(['Avaliar um item vinculado a Produto/Serviço', 'Avaliar uma responsabilidade', 'Analisar uma área']), 'Início, Porta 2: as três entradas com os nomes padronizados', porta2);
      afirma(/mesmo motor O1–O9/.test(await texto(r.page, '#avpInicioPorta2Nota')), 'Início: avisa que as entradas usam o mesmo motor O1–O9');
      afirma(!(await ehPrimario(r.page, '#avpInicioItem')) && !(await ehPrimario(r.page, '#avpInicioAtuacao')) && !(await ehPrimario(r.page, '#avpInicioAnalise')), 'Início: as três com o mesmo peso (nenhuma amarela)');
      await r.ctx.close();
      r = await abrir(browser, vp, '#arquitetura?po=lista');
      await ver(r.page, '#poNovoBtn');
      afirma(await texto(r.page, '#poNovoBtn') === 'Avaliar um item vinculado a Produto/Serviço' && await texto(r.page, '#poAtuacoesBtn') === 'Avaliar uma responsabilidade', 'lista O1–O9: os mesmos nomes');
      afirma(!(await ehPrimario(r.page, '#poNovoBtn')) && !(await ehPrimario(r.page, '#poAtuacoesBtn')), 'lista O1–O9: alternativas com o mesmo peso (nenhuma amarela)');
      afirma(/mesmo motor O1–O9/.test(await texto(r.page, '#poEntradasNota')), 'lista O1–O9: explica a diferença (origem e vínculo opcional com P1–P16)');
      await r.page.click('#poAtuacoesBtn');
      await esperarCondicao(r.page, () => location.hash === '#arquitetura?po=nova-atuacao' && !!document.getElementById('poFormAtuacao'), null, { limite: 15000, descricao: 'o formulário da responsabilidade' });
      afirma(true, '"Avaliar uma responsabilidade" abre o formulário da responsabilidade (o mesmo do Início)');
      await r.page.goBack(); await ver(r.page, '#poNovoBtn', 'a lista O1–O9 de novo');
      await r.page.click('#poNovoBtn');
      await esperarCondicao(r.page, () => /po=escolher/.test(location.hash), null, { limite: 15000, descricao: 'a escolha do item' });
      afirma(true, '"Avaliar um item vinculado a Produto/Serviço" abre a escolha do item com P1–P16');
      await r.ctx.close();
      r = await abrir(browser, vp, '#arquitetura?po=atuacoes');
      await ver(r.page, '#poNovaAtuacaoBtn');
      afirma(await texto(r.page, '#poNovaAtuacaoBtn') === 'Avaliar uma responsabilidade' && await texto(r.page, '#anEntradaNova') === 'Analisar uma área', 'responsabilidades: "Avaliar uma responsabilidade" e "Analisar uma área"');
      afirma(!(await ehPrimario(r.page, '#poNovaAtuacaoBtn')) && !(await ehPrimario(r.page, '#anEntradaNova')), 'responsabilidades: as duas com o mesmo peso (antes, duas amarelas)');
      await r.ctx.close();

      console.log('\n== D. "+ Analisar uma área" com o tamanho do texto ==');
      r = await abrir(browser, vp, '#arquitetura?an=lista');
      await ver(r.page, '#anNovaBtn');
      const w = await r.page.evaluate(() => { const b = document.getElementById('anNovaBtn'); return { w: b.getBoundingClientRect().width, cw: b.closest('#avaliacoesAnalise').getBoundingClientRect().width, t: b.textContent.trim() }; });
      afirma(w.t === '+ Analisar uma área' && (vp.width < 600 || w.w < 0.5 * w.cw), 'lista de análises: "+ Analisar uma área" proporcional ao texto (' + Math.round(w.w) + ' de ' + Math.round(w.cw) + ' px)', w);
      await r.ctx.close();
    }
  } catch (e) { console.error(e); falhas++; }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
