/* PADRÃO VISUAL OFICIAL — verificação OBRIGATÓRIA das telas de A FLORESTA (docs/padrao-visual.md, §3-A, §5 e §6).
 * Firebase falso em persistência real; hermético; nada é gravado. Desktop (1280) e celular (375 px).
 *
 *   1. Controles: cada regra de padrao-visual-verificacoes.js REPROVA uma regressão injetada de propósito na página
 *      (link na cor do navegador, contraste baixo, "← Voltar" com estilo de ação, dois amarelos no mesmo cartão, botão
 *      esticado, rolagem lateral) — prova que o teste não é vazio e que um defeito desses falha antes do merge.
 *   2. As telas de A FLORESTA (Início, Trabalhos, registro, listas e fichas de P1–P16, O1–O9 e S1–S8, responsabilidades,
 *      Análise Organizacional, Gestão e Mapa): nenhuma violação.
 * Tela nova de A FLORESTA: acrescentar à lista TELAS. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const { verificarTela } = require('./padrao-visual-verificacoes');
const SJ = require('./semente-jornada');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
let falhas = 0;
function afirma(c, msg, det) { console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); if (!c) falhas++; }

/* [endereço, seletor que mostra a tela pronta] */
const TELAS = [
  ['#arquitetura', '#avpInicioCartaoSquad'],
  ['#arquitetura?tr=1', '#mfItens'],
  ['#arquitetura?tr=1&item=pCapec', '#mfRepresenta-pCapec'],
  ['#arquitetura?av=lista', '#avaliacoesPainel .avp-table tbody tr'],
  ['#arquitetura?avp=pCapec', '#avpGerarPdfBtn'],
  ['#arquitetura?po=lista', '#poLista'],
  ['#arquitetura?po=gC', '#poGerarPdfBtn'],
  ['#arquitetura?po=atuacoes', '#poRegistradasTitulo'],
  ['#arquitetura?po=escolher', '#poBusca'],
  ['#arquitetura?sq=lista', '#sqExportarBtn'],
  ['#arquitetura?an=lista', '#anNovaBtn'],
  ['#arquitetura?arq=inicio', '#avpGrupoConfiguracao'],
  ['#arquitetura?mf=mapa', '.mfm-painel']
];

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
const pronta = (page, sel) => esperarCondicao(page, (s) => { const e = document.querySelector(s); return !!e && e.getBoundingClientRect().width > 0; }, sel, { limite: 15000, descricao: 'a tela pronta (' + sel + ')' });

(async () => {
  const browser = await chromium.launch();
  try {
    console.log('\n== 1. Controles: cada regra reprova a regressão injetada ==');
    {
      const { ctx, page } = await abrir(browser, { width: 1280, height: 900 }, '#arquitetura');
      await pronta(page, '#avpInicioCartaoSquad');
      const limpo = await verificarTela(page, { largura: 1280, focos: 0 });
      afirma(limpo.length === 0, 'antes da injeção: Início conforme', limpo);
      await page.evaluate(() => {
        const c = document.getElementById('avpInicioContinuar');
        c.insertAdjacentHTML('beforeend',
          '<p id="rgLink"><a href="#arquitetura?av=lista" style="color: revert">link sem cor do site</a></p>' + /* volta à cor do navegador (lilás/roxo) */
          '<p id="rgContraste" style="color: #2a3350">texto escuro demais no fundo escuro</p>' +
          '<button type="button" class="btn" id="rgVoltar">← Voltar para algum lugar</button>' +
          '<button type="button" class="btn btn--primary" id="rgAmarelo1">Ação A</button><button type="button" class="btn btn--primary" id="rgAmarelo2">Ação B</button>' +
          '<div style="width: 900px"><button type="button" class="btn" id="rgLargo" style="width: 100%">Botão esticado</button></div>');
      });
      const ps = await verificarTela(page, { largura: 1280, focos: 0 });
      const tem = (regra, id) => ps.some((p) => p.regra === regra && p.detalhe.indexOf(id) !== -1);
      afirma(tem('link-cor-do-navegador', 'link sem cor do site'), 'link na cor do navegador (o "roxo depois de visitado") → reprovado');
      afirma(tem('contraste', 'rgContraste'), 'texto com contraste baixo no fundo escuro → reprovado');
      afirma(tem('voltar-sem-navegacao', 'rgVoltar'), '"← Voltar" com estilo de ação (azul) → reprovado');
      afirma(tem('amarelos-concorrentes', 'rgAmarelo1'), 'dois amarelos no mesmo cartão → reprovado');
      afirma(tem('botao-esticado', 'rgLargo'), 'botão esticado na largura do contêiner → reprovado');
      await ctx.close();
      const c375 = await abrir(browser, { width: 375, height: 812 }, '#arquitetura');
      await pronta(c375.page, '#avpInicioCartaoSquad');
      await c375.page.evaluate(() => { const d = document.createElement('div'); d.id = 'rgLateral'; d.style.cssText = 'position: absolute; left: 0; top: 200px; width: 600px; height: 4px'; document.body.appendChild(d); });
      const p375 = await verificarTela(c375.page, { largura: 375, focos: 0 });
      afirma(p375.some((p) => p.regra === 'rolagem-lateral'), 'conteúdo mais largo que 375 px (rolagem lateral) → reprovado');
      await c375.ctx.close();
      /* foco: um botão com o contorno apagado */
      const cf = await abrir(browser, { width: 1280, height: 900 }, '#arquitetura');
      await pronta(cf.page, '#avpInicioCartaoSquad');
      await cf.page.addStyleTag({ content: '#page-avaliacoes #avpInicioTrabalhos:focus-visible { outline: none !important; box-shadow: none !important; }' });
      await cf.page.evaluate(() => { const r = document.getElementById('avpInicio'); const t = document.createElement('span'); t.tabIndex = -1; r.prepend(t); t.focus(); t.remove(); });
      const pf = await verificarTela(cf.page, { largura: 1280, focos: 3 });
      afirma(pf.some((p) => p.regra === 'foco-invisivel' && /avpInicioTrabalhos/.test(p.detalhe)), 'controle sem foco visível no Tab → reprovado', pf);
      await cf.ctx.close();
    }

    for (const [nome, vp] of [['desktop', { width: 1280, height: 900 }], ['375 px', { width: 375, height: 812 }]]) {
      console.log('\n== 2. Telas de A FLORESTA — ' + nome + ' ==');
      for (const [hash, sel] of TELAS) {
        const { ctx, page, erros } = await abrir(browser, vp, hash);
        await pronta(page, sel);
        await page.waitForTimeout(400);
        const ps = await verificarTela(page, { largura: vp.width });
        afirma(ps.length === 0 && erros.length === 0, hash + ': conforme o Padrão Visual', ps.concat(erros.map((e) => ({ regra: 'erro-js', detalhe: e }))));
        await ctx.close();
      }
    }
  } catch (e) { console.error(e); falhas++; }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
