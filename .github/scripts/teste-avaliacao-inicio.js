/* INÍCIO DA AVALIAÇÃO — a área #avaliacoes organizada pelo trabalho da pessoa, não pelas funcionalidades.
 * Desktop e celular 375 px. Firebase falso em persistência real; hermético; nada é gravado.
 * O menu Avaliação abre o Início (sem ler o banco: aparece mesmo com a rede parada); três blocos — continuar ou
 * consultar (a Jornada, ação principal), começar um trabalho novo (natureza P1–P16 ou atuação organizacional) e
 * consultar os registros completos (P1–P16 em #avaliacoes?av=lista, Posicionamentos, Adequação à Squad, Mapa).
 * Os 8 casos da homologação (semente comum da Jornada, semente-jornada.js):
 *   1. Agilidade (CoE, vínculo válido): Início → Jornada → busca → detalhe → Mapa → volta ao MESMO objeto.
 *   2. Jurídico: o item P1–P16 "Representado pela atuação"; a atuação completa; sem Squad (Área Especializada).
 *   3. Nova avaliação de natureza: Início → formulário P1–P16; "← Voltar" volta ao Início.
 *   4. Atuação sem P1–P16: Início → lista das atuações (Porta 2) com "+ Nova atuação"; Voltar → Início.
 *   5. Produto/Serviço sem Posicionamento: "disponível (opcional)", "Iniciar o Posicionamento" ao alcance.
 *   6. Squad: "Acessar Adequação à Squad" só no ramo Linha (Capec); abre a Squad do item; Voltar → o mesmo objeto.
 *   7. Avaliação antiga, exportar, Lixeira: a lista P1–P16 em ?av=lista com busca, Exportar e Lixeira (F5 mantém);
 *      Posicionamentos e Squad com as listas e exportações de sempre.
 *   8. Mapa: pelo Início e pela Jornada.
 * + Três perfis (avaliacao-arquitetura, avaliacao, admin geral): só quem grava vê "Começar o posicionamento de uma
 *   atuação"; F5 e Voltar/Avançar; links diretos antigos (?avp=, ?po=…) intactos; 375 px sem rolagem lateral. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const { semente, ARQ, AVAL, chave } = require('./semente-jornada');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const ADM = 'admin.geral@previ.com.br';
let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

async function abrir(browser, viewport, hash, opts) {
  opts = opts || {};
  const email = opts.email || ARQ;
  const db = semente();
  db['fa-admins'] = { [chave(ADM)]: true };
  db['fa-users'][chave(ADM)] = { name: 'Admin', email: ADM, area: 'INFOR' };
  const cfg = { db, user: { email, emailVerified: true, uid: 'u-' + chave(email) }, delayDefault: 10, persistenciaReal: true, delays: opts.delays || {} };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  page.on('dialog', (d) => d.accept());
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent : ''; }, sel);
const hash = (page) => page.evaluate(() => location.hash);
const visivel = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const esperar = (page, fn, arg, limite) => esperarCondicao(page, fn, arg, { limite: limite || 10000 });
const noInicio = (page) => esperar(page, () => { const e = document.getElementById('avpInicio'); return !!e && e.offsetParent !== null && location.hash === '#avaliacoes'; });
const linha = (id) => '#mfItens .mf-linha[data-item="' + id + '"]';
const card = (id) => '#mfCatalogo .mf-item--detalhe[data-item="' + id + '"]';
const naJornada = (page) => esperar(page, () => { const r = document.getElementById('mfResumo'); return !!r && /Jornada completa/.test(r.textContent); }, undefined, 15000);
async function abreItem(page, id) {
  await page.click(linha(id) + ' .mf-linha-abrir');
  await page.waitForSelector(card(id), { timeout: 10000 });
}

async function rodada(browser, viewport, rotulo) {
  console.log('\n=== ' + rotulo + ' ===');
  /* rede parada para as avaliações: o Início não depende delas */
  let { ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes', { delays: { 'avaliacoes-produto': 60000, 'avaliacoes-posicionamento': 60000 } });
  await noInicio(page);
  console.log('Início');
  afirma(!/Carregando/.test(await texto(page, '#avpInicio')), 'o Início aparece inteiro sem esperar o banco (avaliações ainda não chegaram)');
  afirma(/O que você precisa fazer\?/.test(await texto(page, '#avpInicio')) && await visivel(page, '#avpInicioContinuar') && await visivel(page, '#avpInicioComecar') && await visivel(page, '#avpInicioConsultar'),
    'três blocos: continuar ou consultar, começar um trabalho novo, consultar registros completos');
  afirma(await page.locator('#avpInicio .btn--primary').count() === 1 && /Jornada de Avaliação e Posicionamento/.test(await texto(page, '#avpInicio .btn--primary')),
    'uma única ação principal: abrir a Jornada');
  afirma(/natureza de um item/.test(await texto(page, '#avpInicioCartaoNatureza')) && /Produto\/Serviço ou se tem outra natureza/.test(await texto(page, '#avpInicioCartaoNatureza')) &&
    /Posicionar uma atuação organizacional/.test(await texto(page, '#avpInicioCartaoAtuacao')) && /hipótese inicial é obrigatória e não entra no cálculo/.test(await texto(page, '#avpInicioCartaoAtuacao')),
    'as duas portas explicadas em linguagem simples antes das siglas');
  afirma(await visivel(page, '#avpInicioAtuacao'), 'Avaliação + Configuração: "Começar o posicionamento de uma atuação"');
  afirma(/ramo Linha/.test(await texto(page, '#avpInicioRegSquad')) && /não a natureza do item nem o tipo de estrutura/.test(await texto(page, '#avpInicioRegSquad')),
    'Adequação à Squad: o que avalia e quando se aplica');
  afirma(/Lixeira/.test(await texto(page, '#avpInicioRegNatureza')) && /Excel/.test(await texto(page, '#avpInicioRegNatureza')), 'avaliações de natureza: versões, exportação e Lixeira');
  afirma(await page.locator('#avpSquadBtn, #avpPosicionamentoBtn, #avpMapaFlorestaBtn').count() === 0, 'sem a antiga barra de atalhos soltos');
  afirma(await larguraOk(page), 'Início sem rolagem lateral');
  for (const id of ['avpInicioJornada', 'avpInicioNatureza', 'avpInicioAtuacao']) {
    const alt = await page.evaluate((i) => document.getElementById(i).getBoundingClientRect().height, id);
    afirma(alt >= 44, 'área de toque de ' + id + ' ≥ 44 px', String(alt));
  }
  await ctx.close();

  ({ ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes'));
  await noInicio(page);

  console.log('Caso 1 — Agilidade (CoE, vínculo válido)');
  await page.click('#avpInicioJornada');
  await naJornada(page);
  afirma(await hash(page) === '#avaliacoes?mf=catalogo', 'Início → Jornada', await hash(page));
  await page.fill('#mfBusca', 'agilidade');
  await esperar(page, () => document.querySelectorAll('#mfItens .mf-linha').length === 1);
  afirma(/Jornada completa/.test(await texto(page, linha('oAgi'))), 'busca: a Agilidade, "Jornada completa"');
  await abreItem(page, 'oAgi');
  afirma(await page.locator(card('oAgi') + ' .mf-abrir-squad').count() === 0, 'CoE: sem "Acessar Adequação à Squad"');
  const verMapa = await page.getAttribute(card('oAgi') + ' .mf-acao', 'href');
  afirma(verMapa === '#avaliacoes?mf=mapa&e=coe-ag&item=oAgi', '"Ver no Mapa" leva à estrutura vinculada, guardando o objeto', verMapa);
  await page.click(card('oAgi') + ' .mf-acao');
  await page.waitForSelector('#mfmDetalheVoltarJornada', { timeout: 10000 });
  await page.click('#mfmDetalheVoltarJornada');
  await page.waitForSelector(card('oAgi'), { timeout: 10000 });
  afirma(await hash(page) === '#avaliacoes?mf=catalogo&item=oAgi', 'do Mapa, o retorno contextual volta ao MESMO objeto (não ao Início)', await hash(page));
  await page.reload({ waitUntil: 'domcontentloaded' }); await esperarSessaoAssentada(page);
  await page.waitForSelector(card('oAgi'), { timeout: 15000 });
  afirma(true, 'F5 no detalhe: o mesmo objeto');
  await page.click('#mfVoltarLista');
  await page.waitForSelector(linha('pJur'), { timeout: 10000 });

  console.log('Caso 2 — Jurídico');
  afirma(/Representado pela atuação “Assessoramento jurídico”/.test(await texto(page, linha('pJur'))) && /Jornada completa/.test(await texto(page, linha('oJur'))),
    'P1–P16 "representado pela atuação"; a atuação com a jornada completa — sem pendência inventada');
  await abreItem(page, 'oJur');
  afirma(await page.locator(card('oJur') + ' .mf-abrir-squad').count() === 0, 'Área Especializada: sem Squad');
  await page.click('#mfVoltarLista');
  await page.waitForSelector(linha('pSem'), { timeout: 10000 });

  console.log('Caso 5 — Produto/Serviço sem Posicionamento');
  afirma(/Posicionamento disponível \(opcional\)/.test(await texto(page, linha('pSem'))), 'na lista: "Posicionamento disponível (opcional)"');
  await abreItem(page, 'pSem');
  const ini = await page.getAttribute(card('pSem') + ' .mf-acao', 'href');
  afirma(ini === '#avaliacoes?po=escolher&item=pSem' && !/Próximo passo/.test(await texto(page, card('pSem'))), 'detalhe: "Iniciar o Posicionamento" disponível, não obrigatório', ini);
  await page.click('#mfVoltarLista');
  await page.waitForSelector(linha('pCapec'), { timeout: 10000 });

  console.log('Caso 6 — Adequação à Squad (ramo Linha)');
  await abreItem(page, 'pCapec');
  afirma(/Acessar Adequação à Squad/.test(await texto(page, card('pCapec') + ' .mf-abrir-squad')), 'Capec (Linha de Negócios): "Acessar Adequação à Squad"');
  await page.click(card('pCapec') + ' .mf-abrir-squad');
  await esperar(page, () => { const s = document.getElementById('avaliacoesSquad'); return !!s && !s.hidden && /[?&]sq=/.test(location.hash); });
  await esperar(page, () => /Capec/.test(document.getElementById('avaliacoesSquad').textContent), undefined, 15000).catch(() => {}); /* a Squad pode mostrar "Carregando…" antes (rede lenta) */
  afirma(await page.locator('#avaliacoesMapa').isHidden() && /Capec/.test(await texto(page, '#avaliacoesSquad')), 'abre a Adequação à Squad do item, no lugar da Jornada');
  await page.goBack();
  await page.waitForSelector(card('pCapec'), { timeout: 10000 });
  afirma(await hash(page) === '#avaliacoes?mf=catalogo&item=pCapec' && await page.locator('#avaliacoesSquad').isHidden(), 'Voltar: o mesmo objeto na Jornada', await hash(page));
  afirma(await larguraOk(page), 'detalhe sem rolagem lateral');
  await page.click('#mfVoltarLista');
  await page.waitForSelector('#mfVoltar', { timeout: 10000 });
  await page.click('#mfVoltar');
  await noInicio(page);
  afirma(true, 'da lista da Jornada, "← Voltar para Avaliações" leva ao Início');

  console.log('Caso 3 — nova avaliação de natureza');
  await page.click('#avpInicioNatureza');
  await page.waitForSelector('#avpCancelarInicialBtn', { timeout: 10000 });
  afirma(await hash(page) === '#avaliacoes?nova=1' && /Início da Avaliação/.test(await texto(page, '#avpVoltarFormInicial')), 'formulário P1–P16; o "← Voltar" diz para onde vai', await texto(page, '#avpVoltarFormInicial'));
  await page.click('#avpVoltarFormInicial');
  await noInicio(page);
  afirma(true, '"← Voltar para o Início da Avaliação"');

  console.log('Caso 4 — atuação organizacional sem P1–P16');
  await page.click('#avpInicioAtuacao');
  await page.waitForSelector('#poNovaAtuacaoBtn', { timeout: 10000 });
  afirma(await hash(page) === '#avaliacoes?po=atuacoes' && /Porta 2/.test(await texto(page, '#avaliacoesPosicionamento')), 'lista das atuações (Porta 2) com "+ Nova atuação organizacional"', await hash(page));
  await page.goBack();
  await noInicio(page);
  afirma(true, 'Voltar do navegador: Início');

  console.log('Caso 7 — avaliação antiga, exportar, Lixeira');
  await page.click('#avpInicioRegNatureza');
  await page.waitForSelector('#avpListaTitulo', { timeout: 10000 });
  await esperar(page, () => document.querySelectorAll('#avaliacoesPainel .avp-table tbody tr').length > 0, undefined, 15000);
  afirma(await hash(page) === '#avaliacoes?av=lista' && await visivel(page, '#avpBusca') && await visivel(page, '#avpExportarBtn') && await visivel(page, '#avpLixeiraBtn') && await visivel(page, '#avpNovoBtn'),
    'lista P1–P16 em ?av=lista: busca, Exportar, Lixeira e "+ Avaliar novo item"', await hash(page));
  await page.click('#avpExportarBtn');
  afirma(await visivel(page, '#avpExportarExcelFiltrados') && await visivel(page, '#avpExportarExcelTodas'), 'Exportar: as opções de sempre');
  await page.click('#avpExportarBtn');
  await page.click('#avpLixeiraBtn');
  afirma(/excluídas/.test(await texto(page, '#avaliacoesPainel')), 'Lixeira abre na lista');
  await page.click('#avpLixeiraBtn');
  await page.reload({ waitUntil: 'domcontentloaded' }); await esperarSessaoAssentada(page);
  await page.waitForSelector('#avpListaTitulo', { timeout: 15000 });
  afirma(await hash(page) === '#avaliacoes?av=lista', 'F5 na lista: continua na lista');
  await page.click('#avpVoltarInicio');
  await noInicio(page);
  afirma(true, '"← Início da Avaliação" da lista');
  await page.click('#avpInicioRegPosicionamento');
  await page.waitForSelector('#poLista', { timeout: 10000 });
  await esperar(page, () => !!document.getElementById('poExportarBtn'), undefined, 15000);
  afirma(await hash(page) === '#avaliacoes?po=lista', 'Posicionamentos: a lista com Exportar');
  await page.click('#poVoltar');
  await noInicio(page);
  await page.click('#avpInicioRegSquad');
  await page.waitForSelector('#sqExportarBtn', { timeout: 15000 });
  afirma(await hash(page) === '#avaliacoes?sq=lista' && await visivel(page, '#sqNovaBtn'), 'Adequação à Squad: a lista com Exportar e "+ Nova avaliação de squad" (comportamento atual)');
  await page.goBack();
  await noInicio(page);

  console.log('Caso 8 — Mapa');
  await page.click('#avpInicioRegMapa');
  await esperar(page, () => /[?&]mf=mapa/.test(location.hash) && !document.getElementById('avaliacoesMapa').hidden);
  afirma(!/fonte=demo/.test(await hash(page)), 'Mapa pelo Início: as estruturas cadastradas (a demonstração não é o padrão)', await hash(page));
  await page.goBack();
  await noInicio(page);
  await page.goForward();
  await esperar(page, () => /[?&]mf=mapa/.test(location.hash) && !document.getElementById('avaliacoesMapa').hidden);
  afirma(true, 'Avançar volta ao Mapa');

  console.log('Menu, F5 e links diretos');
  await page.evaluate(() => { location.hash = '#ajuda'; });
  await esperar(page, () => location.hash === '#ajuda');
  await page.evaluate(() => { const a = document.querySelector('[data-nav-page="avaliacoes"]'); a.click(); });
  await noInicio(page);
  afirma(true, 'menu Avaliação → Início');
  await page.reload({ waitUntil: 'domcontentloaded' }); await esperarSessaoAssentada(page);
  await noInicio(page);
  afirma(true, 'F5 no Início');
  await page.evaluate(() => { location.hash = '#avaliacoes?avp=pCapec'; });
  await esperar(page, () => /Capec/.test((document.getElementById('avaliacoesPainel') || {}).innerText || ''), undefined, 15000);
  afirma(/Voltar/.test(await texto(page, '#avpVoltarListaResultado')), 'link direto antigo ?avp= abre a ficha P1–P16');
  await page.click('#avpVoltarListaResultado');
  await page.waitForSelector('#avpListaTitulo', { timeout: 10000 });
  afirma(await hash(page) === '#avaliacoes?av=lista', 'da ficha, "← Voltar para avaliações" leva à lista P1–P16 (de onde as fichas são abertas)', await hash(page));
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();

  console.log('Perfis');
  ({ ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes', { email: AVAL }));
  await noInicio(page);
  afirma(!(await visivel(page, '#avpInicioAtuacao')) && /perfil Avaliação \+ Configuração/.test(await texto(page, '#avpInicioAtuacaoPerfil')) && await visivel(page, '#avpInicioNatureza'),
    'perfil Avaliação: começa avaliação de natureza; a atuação explica quem inicia (sem botão)');
  await page.click('#avpInicioJornada');
  await naJornada(page);
  afirma(true, 'perfil Avaliação: abre a Jornada');
  await ctx.close();
  ({ ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes', { email: ADM }));
  await noInicio(page);
  afirma(await visivel(page, '#avpInicioAtuacao') && await visivel(page, '#avpInicioNatureza'), 'admin geral: as duas portas');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await rodada(browser, { width: 1280, height: 900 }, 'Desktop 1280');
    await rodada(browser, { width: 375, height: 812 }, 'Celular 375');
  } catch (e) { console.log('ERRO', e && e.stack || e); falhas++; }
  await browser.close();
  console.log('\n' + (falhas ? falhas + ' falha(s)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})();
