/* A FLORESTA — página inicial e Trabalhos (com a antiga Jornada de Avaliação e Posicionamento integrada).
 * Firebase falso em persistência real; hermético; dados fictícios só no banco da página; nada é gravado. Prova, no
 * desktop e a 375 px:
 *   A. Início na ordem Continuar → Começar → Mapa; Começar com quatro entradas independentes (Produto/Serviço,
 *      responsabilidade, área e Adequação à Squad); sem o atalho separado da Jornada; Squad abre a tela de sempre e o
 *      Voltar do navegador volta ao Início.
 *   B. Trabalhos (#arquitetura?tr=1) numa tela só: "Continuar de onde parou", os registros (cada item uma vez, com a
 *      situação; busca funcionando) e as listas completas recolhidas; "← Voltar para A Floresta" volta ao Início.
 *   C. Registro de um item (&item=): o que representa, o que já foi realizado, detalhes e registros relacionados; um só
 *      "Voltar" (para os Trabalhos quando veio da lista); abrir a ficha de Produto/Serviço a partir dele e voltar para
 *      o MESMO registro; F5 no registro.
 *   D. Da ficha de Produto/Serviço, "Ver o registro deste item": no registro, o "Voltar" do topo volta para a ficha e
 *      "Ver todos os trabalhos" leva à lista.
 *   E. Links antigos: "#avaliacoes?mf=catalogo&item=…" e "#arquitetura?mf=catalogo" abrem nos Trabalhos, sem entrada
 *      nova no histórico.
 *   F. Listas completas: abrir a de Produto/Serviço e voltar aos Trabalhos pelo Voltar do navegador.
 *   G. Perfil Avaliação: as quatro entradas de Começar continuam (responsabilidade como texto de perfil).
 *   Sempre: nenhum erro de página e nenhuma rolagem lateral. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const SJ = require('./semente-jornada');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
let falhas = 0;
function afirma(c, msg, det) { console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + JSON.stringify(det) : '')); if (!c) falhas++; }

async function abrir(browser, vp, hash, o) {
  o = o || {};
  const db = SJ.semente();
  db['fa-admins'] = o.admin === false ? {} : { [SJ.chave(SJ.ARQ)]: { email: SJ.ARQ, name: 'ADMIN' } };
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify({ db, user: { email: o.email || SJ.ARQ, emailVerified: true, uid: 'u1' }, delayDefault: 5, persistenciaReal: true }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const hash = (page) => page.evaluate(() => location.hash);
const ver = (page, sel, descricao) => esperarCondicao(page, (s) => { const e = document.querySelector(s); return !!e && e.getBoundingClientRect().width > 0; }, sel, { limite: 15000, descricao });
const naHash = (page, h, descricao) => esperarCondicao(page, (x) => location.hash === x, h, { limite: 15000, descricao: descricao || h });
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; }, sel);
const visivel = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && e.getBoundingClientRect().width > 0 && (!e.checkVisibility || e.checkVisibility()); }, sel);
const semRolagemLateral = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [nome, vp] of [['desktop', { width: 1280, height: 900 }], ['375 px', { width: 375, height: 812 }]]) {
      console.log('\n######## ' + nome + ' ########');

      console.log('\n== A. Início ==');
      let r = await abrir(browser, vp, '#arquitetura');
      await ver(r.page, '#avpInicioCartaoSquad', 'o Início');
      const ordem = await r.page.evaluate(() => ['avpInicioContinuar', 'avpInicioComecar', 'avpInicioMapaSec'].map((id) => { const e = document.getElementById(id); return e ? e.getBoundingClientRect().top + window.scrollY : null; }));
      afirma(ordem.every((v) => v !== null) && ordem[0] < ordem[1] && ordem[1] < ordem[2], 'ordem: Continuar → Começar → Mapa da Floresta', ordem);
      const comecar = await r.page.evaluate(() => ['avpInicioCartaoNatureza', 'avpInicioOpcaoA', 'avpInicioOpcaoB', 'avpInicioCartaoSquad'].map((id) => !!document.querySelector('#avpInicioComecar #' + id)));
      afirma(comecar.every(Boolean), 'Começar: Produto/Serviço, responsabilidade, área e Adequação à Squad', comecar);
      afirma(!(await r.page.$('#avpInicioJornada')), 'sem atalho separado para a Jornada (ela está nos Trabalhos)');
      afirma(await r.page.getAttribute('#avpInicioSquad', 'href') === '#arquitetura?sq=lista', 'a entrada da Squad abre a tela de sempre (#arquitetura?sq=lista)');
      afirma(await semRolagemLateral(r.page), 'Início sem rolagem lateral');
      await r.page.click('#avpInicioSquad');
      await ver(r.page, '#sqNovaBtn', 'a Adequação à Squad');
      afirma(await hash(r.page) === '#arquitetura?sq=lista', 'Squad aberta com "+ Nova avaliação de squad"');
      await r.page.goBack(); await ver(r.page, '#avpInicioCartaoSquad', 'o Início de novo');
      afirma(await hash(r.page) === '#arquitetura', 'Voltar do navegador: de volta ao Início');

      console.log('\n== B. Trabalhos ==');
      await r.page.click('#avpInicioTrabalhos');
      await ver(r.page, '#mfItens', 'os registros');
      afirma(await hash(r.page) === '#arquitetura?tr=1', '"Ver e continuar trabalhos" → #arquitetura?tr=1', await hash(r.page));
      afirma(await texto(r.page, '#page-avaliacoes .page-hero h1') === 'Trabalhos', 'título da página: "Trabalhos"', await texto(r.page, '#page-avaliacoes .page-hero h1'));
      await ver(r.page, '#avpTrabContinuar', '"Continuar de onde parou"');
      const pos = await r.page.evaluate(() => ['mfTrabContinuarVaga', 'mfCatalogo', 'mfTrabListas'].map((id) => document.getElementById(id).getBoundingClientRect().top));
      afirma(pos[0] < pos[1] && pos[1] < pos[2], 'uma tela: Continuar de onde parou → Registros → Listas completas', pos);
      afirma(await r.page.evaluate(() => !document.getElementById('mfTrabListas').open) && !(await visivel(r.page, '#avpTrabIrProdutos')), 'listas completas recolhidas por padrão');
      const ids = await r.page.$$eval('#mfItens .mf-linha', (ls) => ls.map((l) => l.getAttribute('data-item')));
      afirma(ids.length > 0 && new Set(ids).size === ids.length, 'cada registro aparece uma vez (' + ids.length + ')', ids);
      afirma(/registro/.test(await texto(r.page, '#mfContador')), 'contador em "registros"', await texto(r.page, '#mfContador'));
      await r.page.fill('#mfBusca', 'Capec');
      await esperarCondicao(r.page, () => document.querySelectorAll('#mfItens .mf-linha').length === 1, null, { limite: 15000, descricao: 'busca filtrando' });
      afirma(await r.page.evaluate(() => document.activeElement && document.activeElement.id === 'mfBusca'), 'busca filtra e mantém o foco no campo');
      await r.page.fill('#mfBusca', '');
      afirma(await texto(r.page, '#mfVoltar') === '← Voltar para A Floresta', 'Voltar dos Trabalhos: "← Voltar para A Floresta"', await texto(r.page, '#mfVoltar'));
      afirma(await semRolagemLateral(r.page), 'Trabalhos sem rolagem lateral');

      console.log('\n== C. Registro de um item ==');
      await r.page.click('#mfItens .mf-linha[data-item="pCapec"] .mf-linha-abrir');
      await ver(r.page, '#mfRepresenta-pCapec', 'o registro de Capec');
      afirma(await hash(r.page) === '#arquitetura?tr=1&item=pCapec', 'registro: #arquitetura?tr=1&item=pCapec', await hash(r.page));
      const subt = await r.page.$$eval('.mf-item--detalhe .mf-subtitulo', (hs) => hs.map((x) => x.textContent.trim()));
      afirma(['O que já foi realizado', 'Detalhes', 'Registros relacionados'].every((t) => subt.indexOf(t) !== -1), 'partes do registro: o que já foi realizado, detalhes, registros relacionados', subt);
      afirma(/Produto\/Serviço \(P1–P16\)/.test(await texto(r.page, '#mfRepresenta-pCapec')), 'diz o que o registro representa', await texto(r.page, '#mfRepresenta-pCapec'));
      afirma(!(await r.page.$('#mfVoltar')) && await texto(r.page, '#mfVoltarLista') === '← Voltar para os Trabalhos', 'um só Voltar: "← Voltar para os Trabalhos"', await texto(r.page, '#mfVoltarLista'));
      afirma(await semRolagemLateral(r.page), 'registro sem rolagem lateral');
      /* do registro para a ficha de Produto/Serviço, e de volta ao MESMO registro */
      await r.page.click('.mf-item--detalhe .mf-abrir-avp');
      await ver(r.page, '#avpVoltarListaResultado', 'a ficha de Produto/Serviço');
      afirma(/^#arquitetura\?avp=/.test(await hash(r.page)), 'registro → ficha de Produto/Serviço', await hash(r.page));
      afirma(/Voltar para o registro/.test(await texto(r.page, '#avpVoltarListaResultado')), 'a ficha oferece "← Voltar para o registro"', await texto(r.page, '#avpVoltarListaResultado'));
      await r.page.click('#avpVoltarListaResultado');
      await naHash(r.page, '#arquitetura?tr=1&item=pCapec', 'de volta ao registro');
      await ver(r.page, '#mfRepresenta-pCapec', 'o mesmo registro');
      afirma(true, 'Voltar da ficha: o mesmo registro (não o Início)');
      await r.page.click('#mfVoltarLista');
      await naHash(r.page, '#arquitetura?tr=1', 'de volta à lista');
      await ver(r.page, '#mfItens', 'a lista de registros');
      afirma(true, '"← Voltar para os Trabalhos": a lista');
      await r.page.click('#mfVoltar');
      await naHash(r.page, '#arquitetura', 'de volta ao Início');
      await ver(r.page, '#avpInicioCartaoSquad', 'o Início');
      afirma(true, '"← Voltar para A Floresta": o Início (sem ciclo)');
      afirma(r.erros.length === 0, 'nenhum erro de página', r.erros);
      await r.ctx.close();

      /* F5 e link direto num registro */
      r = await abrir(browser, vp, '#arquitetura?tr=1&item=pVal');
      await ver(r.page, '#mfRepresenta-pVal', 'o registro pelo link direto');
      await r.page.reload({ waitUntil: 'domcontentloaded' }); await esperarSessaoAssentada(r.page);
      await ver(r.page, '#mfRepresenta-pVal', 'o registro depois do F5');
      afirma(await hash(r.page) === '#arquitetura?tr=1&item=pVal' && await texto(r.page, '#mfVoltarLista') === '← Voltar para os Trabalhos', 'F5 no registro: continua nele, com "← Voltar para os Trabalhos"');
      await r.page.click('#mfVoltarLista');
      await ver(r.page, '#mfItens', 'a lista');
      afirma(await hash(r.page) === '#arquitetura?tr=1', 'link direto: Voltar leva à lista dos Trabalhos');
      await r.ctx.close();

      console.log('\n== D. Da ficha para o registro ==');
      r = await abrir(browser, vp, '#arquitetura?avp=pCapec');
      await ver(r.page, '#avpVerJornadaBtn', 'a ficha de Capec');
      afirma(await texto(r.page, '#avpVerJornadaBtn') === 'Ver o registro deste item', 'a ficha oferece "Ver o registro deste item"', await texto(r.page, '#avpVerJornadaBtn'));
      await r.page.click('#avpVerJornadaBtn');
      await ver(r.page, '#mfRepresenta-pCapec', 'o registro');
      afirma(/Voltar para a avaliação de Produto\/Serviço/.test(await texto(r.page, '#mfVoltar')) && await texto(r.page, '#mfVoltarLista') === 'Ver todos os trabalhos',
        'no registro: Voltar do topo para a ficha e "Ver todos os trabalhos"', { topo: await texto(r.page, '#mfVoltar'), lista: await texto(r.page, '#mfVoltarLista') });
      await r.page.click('#mfVoltar');
      await ver(r.page, '#avpVerJornadaBtn', 'a ficha de novo');
      afirma(/^#arquitetura\?avp=pCapec/.test(await hash(r.page)), 'Voltar: de volta à ficha de onde veio', await hash(r.page));
      afirma(r.erros.length === 0, 'nenhum erro de página', r.erros);
      await r.ctx.close();

      console.log('\n== E. Links antigos da Jornada ==');
      r = await abrir(browser, vp, '#avaliacoes?mf=catalogo&item=pVal');
      await ver(r.page, '#mfRepresenta-pVal', 'o registro pelo link antigo');
      afirma(await hash(r.page) === '#arquitetura?tr=1&item=pVal', '"#avaliacoes?mf=catalogo&item=pVal" → "#arquitetura?tr=1&item=pVal"', await hash(r.page));
      await r.page.evaluate(() => { location.hash = '#home'; });
      await naHash(r.page, '#home');
      const n0 = await r.page.evaluate(() => history.length);
      await r.page.evaluate(() => { location.hash = '#arquitetura?mf=catalogo'; });
      await ver(r.page, '#mfItens', 'os Trabalhos pelo endereço antigo');
      const n1 = await r.page.evaluate(() => history.length);
      afirma(await hash(r.page) === '#arquitetura?tr=1' && n1 === n0 + 1, '"#arquitetura?mf=catalogo" → "#arquitetura?tr=1", com UMA entrada no histórico', { hash: await hash(r.page), n0, n1 });

      console.log('\n== F. Listas completas ==');
      await r.page.click('#mfTrabListas > summary');
      await ver(r.page, '#avpTrabIrProdutos', 'as listas completas');
      afirma(await visivel(r.page, '#avpTrabIrSquad') && await visivel(r.page, '#avpTrabIrAreas'), 'listas de Produto/Serviço, responsabilidades, áreas e Squad');
      await r.page.click('#avpTrabIrProdutos');
      await naHash(r.page, '#arquitetura?av=lista', 'a lista de Produto/Serviço');
      await r.page.goBack();
      await ver(r.page, '#mfItens', 'os Trabalhos de novo');
      afirma(await hash(r.page) === '#arquitetura?tr=1', 'Voltar do navegador: de volta aos Trabalhos');
      afirma(r.erros.length === 0, 'nenhum erro de página', r.erros);
      await r.ctx.close();

      console.log('\n== G. Perfil Avaliação ==');
      r = await abrir(browser, vp, '#arquitetura', { email: SJ.AVAL, admin: false });
      await ver(r.page, '#avpInicioCartaoSquad', 'o Início (perfil Avaliação)');
      afirma(await visivel(r.page, '#avpInicioNatureza') && await visivel(r.page, '#avpInicioSquad') && await visivel(r.page, '#avpInicioAtuacaoPerfil'),
        'perfil Avaliação: Produto/Serviço e Squad como ação; responsabilidade como texto de perfil (permissões de sempre)');
      afirma(r.erros.length === 0, 'nenhum erro de página', r.erros);
      await r.ctx.close();
    }
  } catch (e) { console.error(e); falhas++; }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
