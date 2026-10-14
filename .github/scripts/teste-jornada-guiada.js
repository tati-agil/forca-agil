/* PR 4 — JORNADA GUIADA DO MAPA DA FLORESTA (a "Jornada por objeto": o Catálogo com a trilha de etapas e o próximo
 * passo de cada objeto). Desktop e celular 375 px. Firebase falso em persistência real; hermético. Nada é gravado.
 * Os 8 casos de referência (sem presumir posicionamento: tudo vem da semente, como estaria gravado):
 *   1. Capec — Porta 1, Linha de Negócios pela recomendação firme (decisão opcional), vínculo válido → completa
 *      (Adequação à Squad aparece só como opcional, ramo Linha).
 *   2. Assessoria Previdenciária — Porta 1, decisão registrada, vínculo válido → completa.
 *   3. Jurídico — P1–P16 "A validar" REPRESENTADO pela atuação da Porta 2 (Área Especializada, vínculo válido): o "A
 *      validar" é mostrado como análise de Produto/Serviço, nunca como pendência; sem Squad (Área Especializada).
 *   4. Agilidade — Porta 2 sem P1–P16, CoE, vínculo válido → completa, sem etapa de P1–P16 nem de Squad.
 *   5. Item P1–P16 sem Posicionamento → Posicionamento DISPONÍVEL (opcional), nunca próxima ação obrigatória (não há
 *      critério aprovado que o exija de todo item); "Iniciar o Posicionamento" continua ao alcance.
 *   6. Resultado A validar sem decisão → "em análise", ação "Analisar no Posicionamento" (nunca "obrigação de decidir").
 *   7. Firme, sem estrutura do tipo → "Cadastrar estrutura deste tipo" abre o cadastro com o tipo já escolhido (a
 *      pessoa confere; nada é criado), com volta para a jornada (endereço estável, F5).
 *   8. Estrutura existe, vínculo pendente → "Vincular a estrutura responsável" abre a ficha no bloco do vínculo; a
 *      ficha mostra a trilha e volta para a jornada, no mesmo objeto, também depois de F5.
 *   + Atuação encerrada: sem ação. Resumo e "Só os que têm próxima ação". Mapa: abre nas estruturas cadastradas; a
 *     demonstração só por escolha; "Voltar para a jornada do objeto". Perfil de consulta: sem ações de gravar. Rede
 *     lenta: "Carregando…", nunca "Jornada completa" antes de os vínculos chegarem. 375 px sem rolagem lateral. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const { semente, ARQ, AVAL, chave, M } = require('./semente-jornada');
let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

async function abrir(browser, viewport, hash, opts) {
  opts = opts || {};
  const email = opts.email || ARQ;
  const cfg = { db: semente(), user: { email, emailVerified: true, uid: 'u-' + chave(email) }, delayDefault: 10, persistenciaReal: true, delays: opts.delays || {} };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
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
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
const hash = (page) => page.evaluate(() => location.hash);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const card = (id) => '#mfCatalogo .mf-item--detalhe[data-item="' + id + '"]';
const linha = (id) => '#mfItens .mf-linha[data-item="' + id + '"]';
const etapas = (page, id) => page.$$eval(card(id) + ' .mf-trilha .mf-etapa', (ls) => ls.map((l) => l.dataset.etapa + ':' + l.dataset.estado).join(' '));
const acao = (page, id) => page.evaluate((s) => { const a = document.querySelector(s + ' .mf-acao'); return a ? { t: a.textContent.trim(), h: a.getAttribute('href') } : null; }, card(id));
const pronta = (page) => esperarCondicao(page, () => { const r = document.getElementById('mfResumo'); return !!r && /Jornada completa/.test(r.textContent); }, undefined, { limite: 15000 });
/* ajuste de usabilidade: o detalhe de um objeto abre ao clicar nele (endereço próprio); a lista é simples */
async function abre(page, id) {
  await page.evaluate((i) => { location.hash = '#avaliacoes?mf=catalogo&item=' + encodeURIComponent(i); }, id);
  await page.waitForSelector(card(id), { timeout: 10000 });
}
const situacaoLinha = (page, id) => texto(page, linha(id) + ' .mf-linha-situacao');

/* I1: "o que falta" da etapa que trava a jornada (o que, por quê, onde, quem pode) */
const falta = (page, id) => page.evaluate((i) => { const d = document.getElementById('mfFalta-' + i); return d ? { etapa: d.getAttribute('data-etapa'), t: d.textContent } : null; }, id);
async function rodada(browser, viewport, rotulo) {
  console.log('\n=== ' + rotulo + ' ===');
  let { ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?mf=catalogo');
  await page.waitForSelector(linha('pCapec'), { timeout: 15000 });
  await pronta(page);

  console.log('Lista simples');
  afirma(await page.locator('#mfItens .mf-trilha').count() === 0 && await page.locator('#mfItens .mf-linha').count() === 10 && await page.locator('#mfBusca').isVisible(),
    'a lista mostra só nome, tipo e situação (nenhum detalhe aberto), com a busca à vista');
  afirma(/Jornada completa/.test(await situacaoLinha(page, 'pCapec')) && /Representado pela atuação “Assessoramento jurídico”/.test(await situacaoLinha(page, 'pJur')) &&
    /Em análise \(A validar\)/.test(await situacaoLinha(page, 'pVal')) && /Posicionamento disponível \(opcional\)/.test(await situacaoLinha(page, 'pSem')) &&
    /Encerrada/.test(await situacaoLinha(page, 'oEnc')) && /Atuação organizacional/.test(await texto(page, linha('oAgi') + ' .mf-linha-tipo')) && /Produto\/Serviço/.test(await texto(page, linha('pJur') + ' .mf-linha-tipo')),
    'situação em linguagem clara; P1–P16 do Jurídico × atuação diferenciados, sem pendência inventada');
  afirma(!(await page.locator('#mfFiltrosAvancados').evaluate((d) => d.open)), 'filtros e contadores recolhidos por padrão');
  await page.click('#mfFiltrosAvancados > summary');
  afirma(/Jornada completa: 4 · Com próxima ação: 2 · Em análise \(A validar\): 1 · Posicionamento disponível: 1 · Encerradas: 1/.test((await texto(page, '#mfResumo')).replace(/\s+/g, ' ')),
    'resumo (recolhido): 4 completas, 2 com próxima ação, 1 em análise, 1 com Posicionamento disponível, 1 encerrada', await texto(page, '#mfResumo'));
  await page.click('#mfSoAcao');
  const soAcao = await page.$$eval('#mfItens .mf-item', (ls) => ls.map((l) => l.dataset.item).sort().join(','));
  afirma(soAcao === 'pPlat,pVal,pVinc', '"Só os que têm próxima ação": os 2 com próxima ação e o que está em análise (o disponível não entra)', soAcao);
  await page.click('#mfSoAcao');
  afirma(await larguraOk(page), 'lista sem rolagem lateral');
  const baixos = await page.$$eval('#mfItens .mf-linha-abrir, #mfSoAcao, #mfBusca', (els) => els.filter((e) => e.getBoundingClientRect().height < 44).length);
  afirma(baixos === 0, 'linhas e controles com área de toque ≥ 44 px');

  console.log('Detalhe de cada caso (abre ao clicar)');
  await page.fill('#mfBusca', 'Capec');
  await page.click(linha('pCapec') + ' .mf-linha-abrir');
  await page.waitForSelector(card('pCapec'));
  afirma((await hash(page)) === '#avaliacoes?mf=catalogo&item=pCapec' && await page.locator('#mfItens .mf-item').count() === 1, 'clicar abre só a jornada do objeto (endereço próprio)');
  afirma((await etapas(page, 'pCapec')) === 'p1p16:ok posicionamento:ok decisao:opcional estrutura:ok vinculo:ok squad:opcional' && /Jornada completa/.test(await texto(page, card('pCapec'))),
    '1. Capec: completa; decisão opcional (recomendação firme); Squad só opcional', await etapas(page, 'pCapec'));
  afirma(await page.locator('#mfFalta-pCapec').count() === 0, 'I1: jornada completa não mostra "o que falta"');
  const mapaCapec = await acao(page, 'pCapec');
  afirma(mapaCapec && mapaCapec.h === '#avaliacoes?mf=mapa&e=neg-1&item=pCapec', '1. Capec: "Localizar estrutura responsável no Mapa" leva à estrutura responsável', JSON.stringify(mapaCapec));
  await page.click('#mfVoltarLista');
  await page.waitForSelector(linha('pCapec'));
  afirma((await page.inputValue('#mfBusca')) === 'Capec' && await page.locator('#mfItens .mf-linha').count() === 1 && (await hash(page)) === '#avaliacoes?mf=catalogo', '"← Voltar para a lista": a busca é preservada');
  await page.fill('#mfBusca', '');
  await abre(page, 'pAssess');
  afirma((await etapas(page, 'pAssess')).indexOf('decisao:ok') !== -1 && /Jornada completa/.test(await texto(page, card('pAssess'))), '2. Assessoria Previdenciária: decisão registrada, completa');
  await abre(page, 'pJur');
  const tJur = await texto(page, card('pJur'));
  afirma(/Representado pela atuação “Assessoramento jurídico”/.test(tJur) && /A validar — análise de Produto\/Serviço; não é pendência/.test(tJur) && !(await page.$(card('pJur') + ' .mf-trilha')) &&
    (await acao(page, 'pJur')).h === '#avaliacoes?mf=catalogo&item=oJur', '3. Jurídico P1–P16: representado pela atuação; "A validar" explicado, sem pendência; leva à atuação');
  await abre(page, 'oJur');
  afirma((await etapas(page, 'oJur')) === 'atuacao:ok posicionamento:ok decisao:ok estrutura:ok vinculo:ok', '3. Jurídico (atuação): completa, sem etapa de Squad (Área Especializada)', await etapas(page, 'oJur'));
  await abre(page, 'oAgi');
  afirma((await etapas(page, 'oAgi')) === 'atuacao:ok posicionamento:ok decisao:opcional estrutura:ok vinculo:ok' && /Jornada completa/.test(await texto(page, card('oAgi'))),
    '4. Agilidade: Porta 2 sem P1–P16, CoE, completa, sem Squad', await etapas(page, 'oAgi'));
  await abre(page, 'pSem');
  const aSem = await acao(page, 'pSem');
  afirma((await etapas(page, 'pSem')).indexOf('posicionamento:disponivel') !== -1 && aSem && /Iniciar o Posicionamento/.test(aSem.t) && aSem.h === '#avaliacoes?po=escolher&item=pSem' &&
    /Disponível \(opcional\)/.test(await texto(page, card('pSem'))) && !/Próximo passo/.test(await texto(page, card('pSem'))),
    '5. item P1–P16 sem Posicionamento: disponível (opcional), não "próximo passo"; "Iniciar" ao alcance', JSON.stringify(aSem));
  afirma(await falta(page, 'pSem') === null, 'I1: o Posicionamento disponível (opcional) não aparece como "o que falta"');
  await abre(page, 'pVal');
  const aVal = await acao(page, 'pVal');
  afirma((await etapas(page, 'pVal')).indexOf('decisao:analise') !== -1 && aVal && /Analisar no Posicionamento/.test(aVal.t) && !/Registrar/.test(await texto(page, card('pVal'))) &&
    /reavalie|decisão fundamentada/.test(await texto(page, card('pVal'))), '6. A validar: em análise, "Analisar no Posicionamento" — nunca obrigação de decidir');
  const fVal = await falta(page, 'pVal');
  afirma(fVal && fVal.etapa === 'decisao' && /decisão final fundamentada ou uma reavaliação/.test(fVal.t) && /Ficha do Posicionamento/.test(fVal.t), 'I1: A validar — o que falta e onde (ficha do Posicionamento)', fVal && fVal.t);
  await abre(page, 'pPlat');
  const aPlat = await acao(page, 'pPlat');
  afirma((await etapas(page, 'pPlat')).indexOf('estrutura:atual') !== -1 && aPlat && aPlat.h === '#admin?arq=estruturas&nova=PLATAFORMA_CANAIS&objeto=pPlat', '7. firme sem estrutura do tipo: "Cadastrar estrutura deste tipo"', JSON.stringify(aPlat));
  const fPlat = await falta(page, 'pPlat');
  afirma(fPlat && fPlat.etapa === 'estrutura' && /estrutura concreta ativa do tipo/.test(fPlat.t) && /não cria a estrutura/.test(fPlat.t) && /ADMIN › Avaliação e Mapa › Estruturas Organizacionais/.test(fPlat.t) &&
    /Quem pode.*Avaliação \+ Configuração ou admin geral/.test(fPlat.t), 'I1: sem estrutura do tipo — o que falta, por quê, onde (ADMIN › Estruturas) e quem pode', fPlat && fPlat.t);
  await abre(page, 'oEnc');
  afirma(await falta(page, 'oEnc') === null, 'I1: atuação encerrada não mostra "o que falta"');
  afirma(/Atuação encerrada/.test(await texto(page, card('oEnc'))) && !(await page.$(card('oEnc') + ' .mf-acao')), 'atuação encerrada: sem ação');
  await abre(page, 'pVinc');
  const aVinc = await acao(page, 'pVinc');
  afirma(/estrutura disponível \(não quer dizer vinculada\)/.test(await texto(page, card('pVinc'))) && aVinc && /Vincular a estrutura responsável/.test(aVinc.t) && aVinc.h === '#avaliacoes?po=gPV&bloco=responsavel',
    '8. estrutura existe, vínculo pendente: "Vincular" (estrutura disponível ≠ vinculada)', JSON.stringify(aVinc));
  const fVinc = await falta(page, 'pVinc');
  afirma(fVinc && fVinc.etapa === 'vinculo' && /Registrar a estrutura responsável/.test(fVinc.t) && /Posicionamento sozinho não cria o vínculo/.test(fVinc.t) && /Estrutura responsável/.test(fVinc.t),
    'I1: estrutura existe, vínculo pendente — o que falta e onde (ficha do Posicionamento › Estrutura responsável)', fVinc && fVinc.t);
  afirma(await larguraOk(page), 'detalhe sem rolagem lateral');

  console.log('Ida e volta pelo endereço');
  await page.click(card('pVinc') + ' .mf-acao');
  await page.waitForSelector('#poJornada', { timeout: 10000 });
  await esperarCondicao(page, () => location.hash === '#avaliacoes?po=gPV', undefined, { limite: 5000 });
  afirma(!!(await page.$('#poBlocoResponsavel')) && /Decisão final/.test(await texto(page, '#poJornada')), 'ficha aberta (endereço da ficha) com a trilha e o bloco da estrutura responsável');
  await page.click('#poVoltarJornada');
  await page.waitForSelector(card('pVinc'), { timeout: 10000 });
  afirma((await hash(page)) === '#avaliacoes?mf=catalogo&item=pVinc', 'volta à jornada do mesmo objeto, endereço estável');
  await page.reload({ waitUntil: 'domcontentloaded' }); await esperarSessaoAssentada(page);
  await page.waitForSelector(card('pVinc'), { timeout: 15000 });
  afirma(true, 'F5: a jornada do mesmo objeto');
  await page.evaluate(() => { location.hash = '#avaliacoes?mf=mapa&e=neg-1&item=pCapec'; });
  await page.waitForSelector('#mfmDetalheVoltarJornada', { timeout: 15000 });
  afirma(/estruturas cadastradas/.test(await texto(page, '.mfm-subtitulo')), 'Mapa vindo da jornada: estruturas cadastradas (não a demonstração)');
  await page.click('#mfmDetalheVoltarJornada');
  await page.waitForSelector(card('pCapec'), { timeout: 10000 });
  afirma(true, 'do Mapa, volta para a jornada do objeto');
  await page.click('#mfVoltarLista');
  await page.waitForSelector('#mfIrMapa');
  afirma(/^Ver Mapa completo$/i.test((await texto(page, '#mfIrMapa')).trim()), 'o acesso geral se chama "Ver Mapa completo"');
  await page.click('#mfIrMapa');
  await page.waitForSelector('.mfm-subtitulo');
  afirma(/estruturas cadastradas/.test(await texto(page, '.mfm-subtitulo')), '"Ver Mapa completo" (na lista): estruturas cadastradas');
  await page.click('.mfm-fonte[data-fonte="demo"]');
  await esperarCondicao(page, () => /demonstração/.test((document.querySelector('.mfm-subtitulo') || {}).textContent || ''), undefined, { limite: 5000 });
  afirma(/fonte=demo/.test(await hash(page)), 'a demonstração é escolha explícita (e fica no endereço)');

  console.log('Cadastrar estrutura com o tipo já escolhido');
  await page.evaluate(() => { location.hash = '#admin?arq=estruturas&nova=PLATAFORMA_CANAIS&objeto=pPlat'; });
  await page.waitForSelector('#estForm', { timeout: 15000 });
  await esperarCondicao(page, () => { const r = document.querySelector('#estTipos input[value="PLATAFORMA_CANAIS"]'); return !!r && r.checked; }, undefined, { limite: 15000 });
  const qtd = await page.evaluate(() => Object.keys((window.__CFG.__dbReal['estruturas-concretas'] || {}).registros || {}).length);
  afirma(qtd === 3 && !!(await page.$('#estVoltarJornada')), 'formulário com o tipo marcado, nada criado, com "Voltar para a jornada do objeto"');
  await page.reload({ waitUntil: 'domcontentloaded' }); await esperarSessaoAssentada(page);
  await esperarCondicao(page, () => { const r = document.querySelector('#estTipos input[value="PLATAFORMA_CANAIS"]'); return !!r && r.checked && !!document.getElementById('estVoltarJornada'); }, undefined, { limite: 15000 });
  afirma(true, 'F5: o mesmo formulário, com o tipo e a volta');
  afirma(erros.length === 0, 'nenhum erro de página', erros.join(' | '));
  await ctx.close();

  console.log('Perfil de consulta e rede lenta');
  ({ ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?mf=catalogo', { email: AVAL }));
  await page.waitForSelector(linha('pSem'), { timeout: 15000 });
  await pronta(page);
  await abre(page, 'pSem');
  const consultaSem = !(await page.$(card('pSem') + ' .mf-acao')) && /somente consulta/.test(await texto(page, card('pSem')));
  await abre(page, 'pCapec');
  afirma(consultaSem && !!(await page.$(card('pCapec') + ' .mf-acao')), 'consulta: sem ações de gravar (só "Localizar estrutura responsável no Mapa"), com o próximo passo explicado');
  await abre(page, 'pPlat');
  const fConsulta = await falta(page, 'pPlat');
  afirma(fConsulta && /Quem pode.*Avaliação \+ Configuração ou admin geral/.test(fConsulta.t) && !(await page.$(card('pPlat') + ' .mf-acao')),
    'I1: perfil de consulta vê o que falta e quem pode, sem botão de gravar', fConsulta && fConsulta.t);
  await ctx.close();
  ({ ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?mf=catalogo', { delays: { 'estruturas-vinculos': 4000 } }));
  await page.waitForSelector(linha('pCapec'), { timeout: 15000 });
  const cedo = await situacaoLinha(page, 'pCapec');
  afirma(/Carregando/.test(cedo) && !/Jornada completa/.test(cedo), 'rede lenta: "Carregando…", nunca "Jornada completa" antes de os vínculos chegarem', cedo);
  await pronta(page);
  afirma(/Jornada completa/.test(await situacaoLinha(page, 'pCapec')), 'quando os vínculos chegam, a jornada se completa');
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await rodada(browser, { width: 1280, height: 900 }, 'computador');
    await rodada(browser, { width: 375, height: 800 }, 'celular 375 px');
  } catch (e) { falhas++; console.error('ERRO', e && e.stack || e); }
  await browser.close();
  console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})();
