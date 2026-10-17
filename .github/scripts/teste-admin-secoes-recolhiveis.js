/* ADMIN › Avaliações e Mapa — SEÇÕES RECOLHÍVEIS e o MAPA ÚNICO, no computador e a 375 px (o falso Firebase NÃO abre as
 * seções aqui: __CFG.secoesAdminRecolhidas = true).
 *   - um único Mapa da Floresta: primeira seção, aberta ao chegar, com Abrir, definição oficial, edição e histórico;
 *   - as demais começam recolhidas; o título e a descrição curta ficam visíveis; os cartões só aparecem abertas;
 *   - teclado: Enter no título abre e fecha (details/summary nativos);
 *   - contexto: voltar de uma funcionalidade (Voltar da tela, Voltar do navegador, link direto + Voltar) reencontra a
 *     seção de origem aberta;
 *   - permissões: o perfil Avaliação + Configuração não vê Acessos e não há seção vazia.
 * Firebase falso em persistência real; hermético; conteúdo fictício; nada é gravado pelas consultas. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');
const SJ = require('./semente-jornada');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
let falhas = 0;
function afirma(c, msg, det) { console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + JSON.stringify(det) : '')); if (!c) falhas++; }
const SECOES = ['avpAdminMapa', 'avpGrupoConfiguracao', 'avpGrupoEstruturas', 'avpGrupoDocumentacao', 'avpAdminAcessos'];

async function abrir(browser, vp, hash, o) {
  const db = SJ.semente();
  db['fa-admins'] = o && o.restrito ? {} : { [SJ.chave(SJ.ARQ)]: { email: SJ.ARQ, name: 'ADMIN' } };
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify({ db, user: { email: SJ.ARQ, emailVerified: true, uid: 'u1' }, delayDefault: 5, persistenciaReal: true, secoesAdminRecolhidas: true }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const abertas = (page) => page.evaluate((ids) => ids.map((id) => { const d = document.getElementById(id); return d ? (d.open ? 'aberta' : 'recolhida') : 'ausente'; }), SECOES);
const visivel = (page, sel) => page.locator(sel).first().isVisible();
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const ate = (page, fn, arg, descricao) => esperarCondicao(page, fn, arg, { limite: 15000, descricao });

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [nome, vp] of [['computador', { width: 1280, height: 900 }], ['375 px', { width: 375, height: 812 }]]) {
      console.log('\n== ' + nome + ': estado inicial e Mapa único ==');
      let r = await abrir(browser, vp, '#arquitetura?arq=inicio');
      let page = r.page;
      await page.waitForSelector('#avpAdminMapa #avpDocsMapaFloresta .avp-docs-definicao-texto', { timeout: 20000 });
      await page.waitForSelector('#avpAdminAcessos', { timeout: 15000 });
      afirma(JSON.stringify(await abertas(page)) === JSON.stringify(['aberta', 'recolhida', 'recolhida', 'recolhida', 'recolhida']), 'só o Mapa começa aberto', await abertas(page));
      afirma(await page.evaluate(() => { const s = [...document.querySelectorAll('#adminAvaliacaoProduto details.avp-admin-secao > summary')]; return s.length === 5 && s.every((x) => x.offsetHeight > 0 && x.querySelector('.avp-admin-secao-titulo') && x.querySelector('.avp-admin-secao-desc')); }),
        'recolhidas: o título e a descrição curta continuam visíveis');
      afirma(!(await visivel(page, '#avpQuestP1P16Btn')) && !(await visivel(page, '#avpUsuariosBtn')), 'recolhidas: os cartões não ocupam a página');
      afirma(await page.locator('#adminAvaliacaoProduto #avpDocsMapaFloresta').count() === 1 && await page.locator('#avpAdminMapa #avpMapaEditarBtn').count() === 1 && await page.locator('#avpAdminMapa #avpMapaHistorico').count() === 1 &&
        await page.locator('#adminAvaliacaoProduto a[href="#arquitetura?mf=mapa"]').count() === 1 && await page.locator('#avpAdminPartes, #avpAdminDocsMapa').count() === 0,
      'um único Mapa: Abrir, definição oficial, "Editar definição", histórico e a Jornada na mesma seção; sem lista de partes nem link de documentação repetidos');
      afirma(await larguraOk(page), 'sem rolagem horizontal');

      console.log('\n== ' + nome + ': teclado ==');
      await page.focus('#avpGrupoConfiguracao > summary');
      await page.keyboard.press('Enter');
      afirma(await page.evaluate(() => document.getElementById('avpGrupoConfiguracao').open) && await visivel(page, '#avpConfigMotoresBtn'), 'Enter no título abre a seção (e os cartões aparecem)');
      await page.keyboard.press('Enter');
      afirma(!(await page.evaluate(() => document.getElementById('avpGrupoConfiguracao').open)), 'Enter de novo recolhe');
      await page.keyboard.press('Enter');

      console.log('\n== ' + nome + ': voltar de uma funcionalidade reencontra a seção aberta ==');
      await page.click('#avpConfigMotoresBtn');
      await page.waitForSelector('#avpMotoresVoltarLista', { timeout: 15000 });
      await page.click('#avpMotoresVoltarLista');
      await page.waitForSelector('#avpGrupoConfiguracao', { timeout: 15000 });
      afirma(await page.evaluate(() => document.getElementById('avpGrupoConfiguracao').open) && !(await page.evaluate(() => document.getElementById('avpGrupoEstruturas').open)), '"← Voltar" dos motores: Configuração das Avaliações aberta; as outras continuam como estavam');
      /* Voltar do navegador */
      await page.click('#avpAdminAcessos > summary');
      await page.click('#avpUsuariosBtn');
      await page.waitForSelector('#avpUsuariosVoltar', { timeout: 15000 });
      await page.goBack();
      await ate(page, () => !!document.getElementById('avpAdminAcessos') && location.hash === '#arquitetura?arq=inicio', null, 'início depois do Voltar do navegador');
      afirma(await page.evaluate(() => document.getElementById('avpAdminAcessos').open) && await visivel(page, '#avpUsuariosBtn'), 'Voltar do navegador: Acessos aberta, com o item de origem à vista');
      afirma(r.erros.length === 0, 'nenhum erro de JS', r.erros);
      await r.ctx.close();

      console.log('\n== ' + nome + ': link direto numa área e volta ==');
      r = await abrir(browser, vp, '#arquitetura?arq=documentacao'); page = r.page;
      await page.waitForSelector('#avpDocsVoltar', { timeout: 20000 });
      await page.click('#avpDocsVoltar');
      await page.waitForSelector('#avpGrupoDocumentacao', { timeout: 15000 });
      afirma(await page.evaluate(() => document.getElementById('avpGrupoDocumentacao').open) && await visivel(page, '#avpDocumentacaoBtn'), 'link direto em Documentos de referência + Voltar: Documentação aberta');
      afirma(await page.evaluate(() => document.getElementById('avpAdminMapa').open), 'o Mapa continua aberto');
      await r.ctx.close();

      console.log('\n== ' + nome + ': permissões e nenhuma seção vazia ==');
      r = await abrir(browser, vp, '#arquitetura?arq=inicio', { restrito: true }); page = r.page;
      await page.waitForSelector('#avpAdminMapa', { timeout: 20000 });
      afirma(await page.locator('#avpAdminAcessos, #avpUsuariosBtn').count() === 0, 'Avaliação + Configuração: sem a seção Acessos (só admin geral, como antes)');
      afirma(await page.evaluate(() => [...document.querySelectorAll('#adminAvaliacaoProduto details.avp-admin-secao .avp-admin-secao-corpo')].every((c) => c.querySelector('.avp-admin-card, a, button'))), 'toda seção mostrada tem ao menos uma funcionalidade');
      afirma(await page.locator('#avpAdminMapa #avpMapaEditarBtn').count() === 1, 'a definição continua editável pelo perfil que já podia editá-la');
      await r.ctx.close();
    }
  } finally { await browser.close(); }
  console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
