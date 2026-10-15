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
 * + COMO O SISTEMA FUNCIONA (um bloco): legenda curta das duas áreas — Avaliações (onde o trabalho acontece: avaliar,
 *   posicionar, Squad quando se aplica, vínculo à estrutura) × ADMIN (o que o sustenta; não é etapa da Jornada) — e cada
 *   atividade com "O ADMIN fornece:" em frase simples — relações verificadas no código; links de Avaliações (faixa
 *   sólida) e do ADMIN (etiqueta tracejada) diferentes pela forma; ligações tracejadas = possibilidades,
 *   nunca etapas; a Squad é ramo lateral recuado do Posicionamento, só quando o resultado é Linha; o Mapa = estruturas
 *   cadastradas no ADMIN e vínculos registrados na ficha do Posicionamento; os 4 links levam às consultas de sempre.
 *   Nomes das áreas do ADMIN como atalhos SÓ para quem entra (admin geral: Taxonomia e as áreas de Avaliação e Mapa;
 *   Avaliação + Configuração: Questionários, Motores, Motor de Squad, Estruturas; consulta: nenhum — o nome sem link);
 *   "← Voltar ao Início de Avaliações" no ADMIN só quando se entra pelos atalhos (F5, Voltar/Avançar; entrada direta não),
 *   logo acima do título da área (depois das abas), separado do retorno interno. Questionários: o atalho de cada atividade
 *   localiza o cartão do questionário dela (&q=p1p16|o1o9|s1s8) sem abrir edição; Taxonomia: abre no domínio da atividade
 *   (arquitetural para P1–P16, organizacional para O1–O9).
 * + Botões do Mapa: "Ver Mapa completo" (geral) e "Localizar estrutura responsável no Mapa" (contextual, com o nome da
 *   estrutura só no rótulo acessível).
 * + I1: os dois caminhos com nome e exemplos (Porta 1 — Produto/Serviço; Porta 2 — atuação, sem P1–P16).
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
  afirma(/O que você deseja fazer\?/.test(await texto(page, '#avpInicio')) && await visivel(page, '#avpInicioContinuar') && await visivel(page, '#avpInicioComecar') && await visivel(page, '#avpInicioConsultar'),
    'continuar um trabalho, começar um trabalho e (recolhido) entender como as avaliações se conectam');
  afirma(await page.locator('#avpInicio .btn--primary').count() === 0 && (await texto(page, '#avpInicioTrabalhos')).trim() === 'Ver e continuar trabalhos' && (await page.getAttribute('#avpInicioTrabalhos', 'href')) === '#avaliacoes?tr=1' &&
    /Consultar a Jornada do Mapa/.test(await texto(page, '#avpInicioJornada')),
    'continuar leva aos Trabalhos de avaliação; a Jornada do Mapa é consulta, com nome próprio; nenhum botão domina o Início');
  afirma(/Avaliar um Produto\/Serviço/.test(await texto(page, '#avpInicioCartaoNatureza')) && /Descubra se um item constitui um Produto\/Serviço\./.test(await texto(page, '#avpInicioCartaoNatureza')) &&
    (await texto(page, '#avpInicioNatureza')).trim() === 'Iniciar avaliação' &&
    /Avaliar uma responsabilidade/.test(await texto(page, '#avpInicioOpcaoA')) && /Já sabe qual responsabilidade deseja avaliar\?/.test(await texto(page, '#avpInicioOpcaoA')) &&
    /Analisar uma área/.test(await texto(page, '#avpInicioOpcaoB')) && /Cadastre e avalie as responsabilidades de uma gerência, núcleo ou outra área\./.test(await texto(page, '#avpInicioOpcaoB')) &&
    (await texto(page, '#avpInicioAtuacao')).trim() === 'Avaliar responsabilidade',
    'começar: três atividades em linguagem simples (Produto/Serviço, uma responsabilidade, uma área)');
  afirma(await visivel(page, '#avpInicioAtuacao'), 'Avaliação + Configuração: "Avaliar responsabilidade"');
  console.log('Portas (sem terceira porta)');
  afirma(/Porta 1 · P1–P16/i.test(await texto(page, '#avpInicioCartaoNatureza .avp-inicio-caminho')) && /Porta 2 · Posicionamento das responsabilidades · O1–O9/i.test(await texto(page, '#avpInicioCartaoAtuacao > .avp-inicio-caminho')),
    'Porta 1 e Porta 2 (as duas atividades de responsabilidade sob a mesma Porta 2 e o mesmo O1–O9)');
  afirma(/independentes: nenhuma é etapa da outra/.test(await texto(page, '#avpInicioNota')), 'as duas portas não são etapas de um mesmo fluxo');
  afirma(!(await page.evaluate(() => document.getElementById('avpInicioConsultar').open)) && /Entenda como as avaliações se conectam/.test(await texto(page, '#avpComoTitulo')), '"Entenda como as avaliações se conectam" começa recolhido');
  await page.evaluate(() => { document.getElementById('avpInicioConsultar').open = true; });
  console.log('Como o sistema funciona (duas perspectivas; motores e governança na segunda camada)');
  afirma(!(await page.evaluate(() => document.getElementById('avpComoDetalhes').open)), 'segunda camada (questionários, motores, Taxonomia, governança) começa recolhida');
  const como = await page.evaluate(() => {
    const t = (id) => (document.getElementById(id) || {}).textContent || '';
    const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right }; };
    return { itens: Array.prototype.map.call(document.querySelectorAll('#avpComoFunciona > li'), (li) => li.id).join(','),
      sub: t('avpComoSub'), nat: t('avpComoNatureza'), pos: t('avpComoPosicionamento'), sq: t('avpComoSquad'), mapa: t('avpComoMapa'),
      conectores: document.querySelectorAll('#avpInicioConsultar .avp-como-conector').length,
      ramoSquad: document.getElementById('avpComoSquad').classList.contains('avp-como-linha--ramo'),
      links: ['avpInicioRegNatureza', 'avpInicioRegPosicionamento', 'avpInicioRegSquad', 'avpInicioRegMapa'].map((i) => document.getElementById(i).getAttribute('href')).join(' '),
      alturas: ['avpInicioRegNatureza', 'avpInicioRegPosicionamento', 'avpInicioRegSquad', 'avpInicioRegMapa'].map((i) => document.getElementById(i).getBoundingClientRect().height),
      admNaPrimeira: document.querySelectorAll('#avpComoAreas .avp-como-fonte').length,
      aval: r('#avpComoAreaAval'), adm: r('#avpComoAreaAdm'), squad: r('#avpComoSquad'), pos2: r('#avpComoPosicionamento'), mapa2: r('#avpComoMapa') };
  });
  afirma(como.itens === 'avpComoNatureza,avpComoPosicionamento,avpComoSquad,avpComoMapa' && como.conectores === 0,
    'quem faz o trabalho: P1–P16, O1–O9, S1–S8 (opcional) e Mapa/vínculo (opcional), sem conectores nem linhas decorativas', como.itens);
  afirma(/nenhuma é etapa obrigatória/.test(como.sub) && /direto ao O1–O9/.test(como.sub), 'nenhuma atividade é etapa obrigatória; responsabilidade vai direto ao O1–O9', como.sub);
  const areaAval = await texto(page, '#avpComoAreaAval'), areaAdm = await texto(page, '#avpComoAreaAdm');
  afirma(/^Avaliações\s*Quem faz o trabalho/.test(areaAval.trim()) && /onde o trabalho acontece: avaliar, posicionar, analisar a Adequação à Squad quando se aplica e registrar o vínculo à estrutura responsável/i.test(areaAval),
    'perspectiva 1 — Avaliações: quem faz o trabalho', areaAval.slice(0, 160));
  afirma(/^ADMIN\s*Quem mantém as configurações/.test(areaAdm.trim()) && /questionários, os motores, os conceitos oficiais e o cadastro de estruturas/.test(areaAdm) && /Não é etapa da Jornada/.test(areaAdm),
    'perspectiva 2 — ADMIN: quem mantém as configurações; não é etapa', areaAdm);
  afirma(como.admNaPrimeira === 0, 'primeira camada simples: nenhum atalho de configuração misturado às atividades');
  afirma(/Opcional/.test(como.sq) && /Só quando o tipo indicado é .*linha.*: avalia se o trabalho pode se organizar em Squads · S1–S8/i.test(como.sq) && /Não cadastra Squad/.test(como.sq), 'Squad: opcional, só para Linha, não cadastra Squad', como.sq);
  afirma(/Opcional/.test(como.mapa) && /ficha do Posicionamento/.test(como.mapa) && /Uma Linha pode não ter Squads/.test(como.mapa), 'Mapa e vínculo: opcional, vínculo na ficha do Posicionamento', como.mapa);
  afirma(/Verifica se o item é um Produto\/Serviço · P1–P16/.test(como.nat) && /· O1–O9/.test(como.pos), 'função antes da sigla (P1–P16, O1–O9)');
  afirma(/Estrutura Organizacional Atual/.test(await texto(page, '#avpComoDuasEstruturas')) && /Estruturas Organizacionais do Mapa/.test(await texto(page, '#avpComoDuasEstruturas')), 'mantém a distinção Estrutura Atual × Estruturas do Mapa');
  if (viewport.width >= 1000) afirma(como.adm.l > como.aval.r - 1 && Math.abs(como.adm.t - como.aval.t) < 4, 'desktop: as duas perspectivas lado a lado');
  else afirma(como.adm.t >= como.aval.b - 1, '375 px: as perspectivas uma embaixo da outra');
  afirma(como.squad.l > como.pos2.l && como.mapa2.t >= como.squad.b, 'Squad recuada sob o Posicionamento (opcional); o Mapa vem depois');
  afirma(como.links === '#avaliacoes?av=lista #avaliacoes?po=lista #avaliacoes?sq=lista #avaliacoes?mf=mapa', 'os quatro elementos levam às consultas de sempre', como.links);
  afirma(como.alturas.every((a) => a >= 44), 'áreas de toque das quatro atividades ≥ 44 px', como.alturas.join(','));
  await page.evaluate(() => { document.getElementById('avpComoDetalhes').open = true; });
  const det = await page.evaluate(() => {
    const t = (id) => (document.getElementById(id) || {}).textContent || '';
    return { nat: t('avpComoFornNatureza'), pos: t('avpComoFornPosicionamento'), sq: t('avpComoFornSquad'), mapa: t('avpComoFornMapa'), gov: t('avpComoGovernanca'),
      marcas: Array.prototype.every.call(document.querySelectorAll('.avp-como-fonte'), (x) => /^[◆●]$/.test((x.querySelector('.avp-como-marca') || {}).textContent || '')) };
  });
  afirma(/as perguntas em .*Questionários.*, as regras em .*Motores.* e os nomes das classificações na .*Taxonomia/.test(det.nat), 'segunda camada: P1–P16 usa Questionários, Motores e Taxonomia', det.nat);
  afirma(/as perguntas em .*Questionários.* e os tipos de estrutura na .*Taxonomia.*; a regra é fixa no sistema\. Indica o tipo, mas não cria a estrutura/.test(det.pos), 'segunda camada: O1–O9 — Questionários e Taxonomia; regra fixa; não cria estrutura', det.pos);
  afirma(/Questionários.* e as regras no .*Motor de Squad/.test(det.sq) && /o cadastro das estruturas em .*Estruturas/.test(det.mapa) && /registrada em Avaliações, na ficha do Posicionamento — não no ADMIN/.test(det.mapa), 'segunda camada: Squad (Motor de Squad) e Mapa (Estruturas; vínculo em Avaliações)');
  afirma(/versão e histórico/.test(det.gov) && /reavaliação/.test(det.gov), 'segunda camada: governança (versão, histórico, reavaliação)', det.gov);
  afirma(det.marcas, 'a área se lê pela forma (◆/●) e pelo texto, não só pela cor');
  await esperar(page, () => !!document.getElementById('avpComoIrEstruturas'), undefined, 8000).catch(() => {});
  const fontesArq = await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('#avpInicioConsultar .avp-como-fonte'), (x) => x.tagName.toLowerCase() + ':' + x.textContent.replace(/[◆●]/g, '').trim() + (x.getAttribute('href') ? '=' + x.getAttribute('href') : '')).join(' | '));
  afirma(fontesArq === 'a:Questionários=#admin?arq=questionarios&q=p1p16 | a:Motores=#admin?arq=motores | strong:Taxonomia | a:Questionários=#admin?arq=questionarios&q=o1o9 | strong:Taxonomia | a:Questionários=#admin?arq=questionarios&q=s1s8 | a:Motor de Squad=#admin?arq=motor-squad | a:Estruturas=#admin?arq=estruturas',
    'Avaliação + Configuração: atalhos a Questionários, Motores, Motor de Squad e Estruturas; Taxonomia sem link (só admin geral)', fontesArq);
  afirma(await page.locator('#avpInicio button').count() === 0, 'nenhum botão novo no Início');
  await page.focus('#avpInicioRegNatureza');
  const ordem = [];
  for (let i = 0; i < 6; i++) { ordem.push(await page.evaluate(() => document.activeElement.id)); await page.keyboard.press('Tab'); }
  afirma(ordem.slice(0, 4).join(',') === 'avpInicioRegNatureza,avpInicioRegPosicionamento,avpInicioRegSquad,avpInicioRegMapa', 'teclado: Tab percorre as quatro atividades em ordem', ordem.join(','));
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
  afirma(verMapa === '#avaliacoes?mf=mapa&e=coe-ag&item=oAgi', '"Localizar estrutura responsável no Mapa" leva à estrutura vinculada, guardando o objeto', verMapa);
  afirma((await texto(page, card('oAgi') + ' .mf-acao')).trim() === 'Localizar estrutura responsável no Mapa' && await page.getAttribute(card('oAgi') + ' .mf-acao', 'aria-label') === 'Localizar CoE de Agilidade no Mapa',
    'texto visível sem o nome; o nome da estrutura só no rótulo acessível', await page.getAttribute(card('oAgi') + ' .mf-acao', 'aria-label'));
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
  afirma(/Representado pela responsabilidade “Assessoramento jurídico”/.test(await texto(page, linha('pJur'))) && /Jornada completa/.test(await texto(page, linha('oJur'))),
    'P1–P16 "representado pela responsabilidade"; a atuação com a jornada completa — sem pendência inventada');
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

  console.log('Caso 4 — responsabilidade organizacional sem P1–P16 (Caminho A)');
  await page.click('#avpInicioAtuacao');
  await page.waitForSelector('#poFormAtuacao', { timeout: 10000 });
  afirma(await hash(page) === '#avaliacoes?po=nova-atuacao' && /Qual responsabilidade deseja avaliar\?/.test(await texto(page, '#poFormAtuacao')), 'Caminho A abre direto o cadastro da responsabilidade (Porta 2)', await hash(page));
  await page.goBack();
  await noInicio(page);
  afirma(true, 'Voltar do navegador: Início');

  console.log('Caso 7 — avaliação antiga, exportar, Lixeira');
  await page.evaluate(() => { const d = document.getElementById('avpInicioConsultar'); if (d) d.open = true; }); await page.click('#avpInicioRegNatureza');
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
  await page.evaluate(() => { const d = document.getElementById('avpInicioConsultar'); if (d) d.open = true; }); await page.click('#avpInicioRegPosicionamento');
  await page.waitForSelector('#poLista', { timeout: 10000 });
  await esperar(page, () => !!document.getElementById('poExportarBtn'), undefined, 15000);
  afirma(await hash(page) === '#avaliacoes?po=lista', 'Posicionamentos: a lista com Exportar');
  await page.click('#poVoltar');
  await noInicio(page);
  await page.evaluate(() => { const d = document.getElementById('avpInicioConsultar'); if (d) d.open = true; }); await page.click('#avpInicioRegSquad');
  await page.waitForSelector('#sqExportarBtn', { timeout: 15000 });
  afirma(await hash(page) === '#avaliacoes?sq=lista' && await visivel(page, '#sqNovaBtn'), 'Adequação à Squad: a lista com Exportar e "+ Nova avaliação de squad" (comportamento atual)');
  await page.goBack();
  await noInicio(page);

  console.log('Caso 8 — Mapa');
  await page.evaluate(() => { const d = document.getElementById('avpInicioConsultar'); if (d) d.open = true; }); await page.click('#avpInicioRegMapa');
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

  console.log('ADMIN pelos atalhos do Início: ida e volta');
  ({ ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes'));
  await noInicio(page);
  const barra = () => page.evaluate(() => { const b = document.getElementById('adminVoltaInicio'); return !!b && !b.hidden && b.offsetParent !== null; });
  /* o atalho só aparece quando o cadastro está habilitado (o marcador chega depois e o Início se redesenha): espera estabilizar */
  await esperar(page, () => !!document.getElementById('avpComoIrEstruturas'), undefined, 15000);
  await page.waitForTimeout(300);
  await page.evaluate(() => { ['avpInicioConsultar', 'avpComoDetalhes'].forEach((i) => { const d = document.getElementById(i); if (d) d.open = true; }); }); await page.click('#avpComoIrEstruturas');
  await esperar(page, () => location.hash.indexOf('#admin?arq=estruturas') === 0 && !!document.getElementById('adminVoltaInicio') && !document.getElementById('adminVoltaInicio').hidden && document.getElementById('adminVoltaInicio').offsetParent !== null, undefined, 15000); /* visível: a página do ADMIN já apareceu */
  afirma(await barra() && /Voltar ao Início de Avaliações/.test(await texto(page, '#adminVoltaInicio')), 'atalho Estruturas: abre ADMIN › Estruturas com "← Voltar ao Início de Avaliações"');
  const posVolta = await page.evaluate(() => {
    const v = document.getElementById('adminVoltaInicio'), abas = document.querySelector('#page-admin .admin-tabs-bar'), titulo = document.querySelector('#adminPanelArquitetura h3');
    const depoisDasAbas = !!abas && !!(abas.compareDocumentPosition(v) & Node.DOCUMENT_POSITION_FOLLOWING);
    const antesDoTitulo = !!titulo && !!(v.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING);
    const interno = document.querySelector('.est-painel .avp-voltar-link');
    return { depoisDasAbas, antesDoTitulo, distancia: titulo ? Math.round(titulo.getBoundingClientRect().top - v.getBoundingClientRect().bottom) : null, separado: !!interno && interno !== v && !v.contains(interno) };
  });
  afirma(posVolta.depoisDasAbas && posVolta.antesDoTitulo && posVolta.distancia !== null && posVolta.distancia < 40 && posVolta.separado,
    'o retorno ao Início fica logo acima do título da área (depois das abas), separado do retorno interno "Avaliação e Mapa"', JSON.stringify(posVolta));
  await page.reload({ waitUntil: 'domcontentloaded' }); await esperarSessaoAssentada(page);
  await esperar(page, () => !!document.getElementById('adminVoltaInicio') && !document.getElementById('adminVoltaInicio').hidden && document.getElementById('adminVoltaInicio').offsetParent !== null, undefined, 15000); /* visível: a página do ADMIN já apareceu */
  afirma(await barra() && /^#admin\?arq=estruturas/.test(await hash(page)), 'F5 no ADMIN: continua com o retorno ao Início');
  await page.goBack();
  await noInicio(page);
  afirma(true, 'Voltar do navegador: Início');
  await page.goForward();
  await esperar(page, () => /^#admin/.test(location.hash) && !!document.getElementById('adminVoltaInicio') && !document.getElementById('adminVoltaInicio').hidden && document.getElementById('adminVoltaInicio').offsetParent !== null, undefined, 15000); /* visível: a página do ADMIN já apareceu */
  afirma(await barra(), 'Avançar: de volta ao ADMIN, com o retorno');
  afirma(await larguraOk(page), 'ADMIN com a barra de retorno sem rolagem lateral');
  await page.click('#adminVoltaInicioLink');
  await noInicio(page);
  afirma(true, '"← Voltar ao Início de Avaliações" leva ao Início');
  await page.evaluate(() => { ['avpInicioConsultar', 'avpComoDetalhes'].forEach((i) => { const d = document.getElementById(i); if (d) d.open = true; }); }); await page.click('#avpComoIrQuestionarios');
  await esperar(page, () => location.hash.indexOf('#admin?arq=questionarios') === 0 && !!document.getElementById('adminVoltaInicio') && !document.getElementById('adminVoltaInicio').hidden && document.getElementById('adminVoltaInicio').offsetParent !== null, undefined, 15000); /* visível: a página do ADMIN já apareceu */
  afirma(await barra(), 'atalho Questionários: abre ADMIN › Questionários com o retorno ao Início');
  await esperar(page, () => !!document.querySelector('#avpCfgCard-CLASSIFICACAO_ARQUITETURAL.avp-config-item-card--foco'), undefined, 15000);
  afirma(await hash(page) === '#admin?arq=questionarios&q=p1p16' && await page.locator('.avp-config-item-card--foco').count() === 1 &&
    await page.locator('#avpCfgVoltarListaBtn').count() === 0,
    'atalho Questionários da atividade P1–P16: localiza e destaca o cartão P1–P16, sem abrir a edição', await hash(page));
  await page.click('#adminVoltaInicioLink');
  await noInicio(page);
  await page.evaluate(() => { location.hash = '#admin?arq=questionarios'; });
  await esperar(page, () => location.hash === '#admin?arq=questionarios' && !document.getElementById('page-admin').hidden, undefined, 15000);
  afirma(!(await barra()), 'entrada direta no ADMIN (sem o atalho): nenhuma barra nova');
  afirma(!erros.length, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();

  console.log('Perfis');
  ({ ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes', { email: AVAL }));
  await noInicio(page);
  afirma(await page.locator('#avpInicioConsultar a.avp-como-fonte').count() === 0 && await page.locator('#avpInicioConsultar strong.avp-como-fonte').count() === 8,
    'perfil Avaliação (consulta): as áreas e quem as mantém, sem nenhum atalho para tela bloqueada');
  afirma(!(await visivel(page, '#avpInicioAtuacao')) && /perfil Avaliação \+ Configuração/.test(await texto(page, '#avpInicioAtuacaoPerfil')) && await visivel(page, '#avpInicioNatureza'),
    'perfil Avaliação: começa avaliação de natureza; a atuação explica quem inicia (sem botão)');
  await page.click('#avpInicioJornada');
  await naJornada(page);
  afirma(true, 'perfil Avaliação: abre a Jornada');
  await ctx.close();
  ({ ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes', { email: ADM }));
  await noInicio(page);
  afirma(await visivel(page, '#avpInicioAtuacao') && await visivel(page, '#avpInicioNatureza'), 'admin geral: as duas portas');
  await esperar(page, () => !!document.getElementById('avpComoIrEstruturas'), undefined, 8000).catch(() => {});
  afirma(await page.locator('#avpComoIrTaxonomia').count() === 1 && await page.locator('#avpComoIrEstruturas').count() === 1 && await page.locator('#avpInicioConsultar a.avp-como-fonte').count() === 8,
    'admin geral: atalhos à Taxonomia e às áreas de Avaliação e Mapa');
  await page.evaluate(() => { ['avpInicioConsultar', 'avpComoDetalhes'].forEach((i) => { const d = document.getElementById(i); if (d) d.open = true; }); }); await page.click('#avpComoIrTaxonomia');
  const taxAtiva = () => page.evaluate(() => { const b = document.querySelector('.admin-tab-btn[data-panel="adminPanelTaxonomia"]'); const v = document.getElementById('adminVoltaInicio'); return !!b && b.classList.contains('active') && !!v && !v.hidden; });
  await esperar(page, () => { const b = document.querySelector('.admin-tab-btn[data-panel="adminPanelTaxonomia"]'); return !!b && b.classList.contains('active'); }, undefined, 15000);
  afirma(await taxAtiva() && await hash(page) === '#admin', 'atalho Taxonomia: abre a aba Taxonomia do ADMIN, com o retorno ao Início');
  const dominioAtivo = () => page.evaluate(() => { const b = document.querySelector('#adminPanelTaxonomia .tax-dominio--ativo'); return b ? b.getAttribute('data-dominio') : null; });
  await esperar(page, () => !!document.querySelector('#adminPanelTaxonomia .tax-dominio--ativo'), undefined, 15000);
  afirma(await dominioAtivo() === 'arquitetural', 'Taxonomia vinda da atividade P1–P16: abre no domínio arquitetural', await dominioAtivo());
  await page.reload({ waitUntil: 'domcontentloaded' }); await esperarSessaoAssentada(page);
  await esperar(page, () => { const b = document.querySelector('.admin-tab-btn[data-panel="adminPanelTaxonomia"]'); return !!b && b.classList.contains('active'); }, undefined, 15000);
  afirma(await taxAtiva(), 'F5: a aba Taxonomia reabre, com o retorno');
  await esperar(page, () => !!document.querySelector('#adminPanelTaxonomia .tax-dominio--ativo'), undefined, 15000);
  afirma(await dominioAtivo() === 'arquitetural', 'F5: continua no domínio arquitetural', await dominioAtivo());
  await page.goBack();
  await noInicio(page);
  afirma(true, 'Voltar do navegador: Início');
  await esperar(page, () => !!document.getElementById('avpComoIrTaxonomia2'), undefined, 8000);
  await page.evaluate(() => { ['avpInicioConsultar', 'avpComoDetalhes'].forEach((i) => { const d = document.getElementById(i); if (d) d.open = true; }); }); await page.click('#avpComoIrTaxonomia2');
  await esperar(page, () => { const b = document.querySelector('#adminPanelTaxonomia .tax-dominio--ativo'); return !!b && b.getAttribute('data-dominio') === 'organizacional'; }, undefined, 15000);
  afirma(await taxAtiva(), 'Taxonomia vinda da atividade O1–O9: abre no domínio organizacional, com o retorno');
  await page.click('#adminPanelTaxonomia .tax-dominio[data-dominio="arquitetural"]');
  await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
  await page.click('.admin-tab-btn[data-panel="adminPanelTaxonomia"]');
  await page.waitForTimeout(300);
  afirma(await dominioAtivo() === 'arquitetural', 'a troca de domínio feita pela pessoa não é desfeita ao reabrir a aba', await dominioAtivo());
  await page.click('#adminVoltaInicioLink');
  await noInicio(page);
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
