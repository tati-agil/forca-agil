/* CONCLUSÃO DO MAPA DA FLORESTA (31/10/2026) — o Mapa existente, com a visão de conjunto aprovada. Hermético (Firebase
 * falso em persistência real, a mesma semente da Jornada Guiada: semente-jornada.js); 1366, 1280 e 375 px. Prova:
 *   1. a faixa de cobertura usa a régua da jornada e soma o total: 4 no Mapa · 1 recomendação sem estrutura compatível ·
 *      1 com estrutura do tipo, ainda sem vínculo · 1 A validar · 1 encerrada · 2 sem posicionamento (opcional) · de 10;
 *   2. cada caixa resume os vínculos confirmados (a soma bate com os vínculos ativos da semente);
 *   3. o detalhe mostra a definição oficial e, em cada registro vinculado, origem, classificação P1–P16, natureza e o
 *      posicionamento dizendo se é recomendação (sem decisão final) ou decisão confirmada;
 *   4. "Recomendações sem estrutura compatível": a recomendação aparece ali, nunca como vínculo; sem decisão sem
 *      estrutura, a seção de decisões não aparece;
 *   5. sem o seletor "Demonstração (fictícia)" na interface oficial (a demonstração segue pelo endereço &fonte=demo);
 *   6. ida e volta: Mapa → registro → "Voltar para o Mapa"; Mapa → Posicionamento → Voltar; Mapa → ficha da estrutura →
 *      Voltar — sempre de volta ao Mapa, na estrutura de origem;
 *   7. jornada: "Itens avaliados (P1–P16)";
 *   8. nada é gravado; sem rolagem lateral; sem erro de JavaScript. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const { verificarTela } = require('./padrao-visual-verificacoes');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const { semente, ARQ, chave } = require('./semente-jornada');
let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

async function abrir(browser, viewport, hash) {
  const cfg = { db: semente(), user: { email: ARQ, emailVerified: true, uid: 'u-' + chave(ARQ) }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(12000);
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  await page.evaluate(() => { window.__ESCRITAS = []; });
  return { ctx, page, erros };
}
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : ''; }, sel);
const hash = (page) => page.evaluate(() => location.hash);
const semLado = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const coberturaPronta = (page) => esperarCondicao(page, () => { const c = document.getElementById('mfmCobertura'); return !!c && /registros/.test(c.textContent); }, undefined, { limite: 15000 });
async function abrirEstrutura(page, id) {
  await page.click('#mfmNo-' + id);
  await page.waitForSelector('#mfmDetalhe');
  await esperarCondicao(page, () => !!document.querySelector('#mfmObjetos') || !!document.querySelector('#mfmSemObjetos'), undefined, { limite: 15000 });
}

const db0 = semente();
const vinculosAtivos = Object.values(db0['estruturas-vinculos'].registros).filter((v) => v.situacao === 'ativa').length;

(async () => {
  const browser = await chromium.launch();
  for (const [rotulo, viewport] of [['1366 px', { width: 1366, height: 900 }], ['1280 px', { width: 1280, height: 900 }], ['375 px', { width: 375, height: 812 }]]) {
    console.log('\n=== ' + rotulo + ' ===');
    const { ctx, page, erros } = await abrir(browser, viewport, '#arquitetura?mf=mapa');
    await page.waitForSelector('#mfmMapa .mfm-caixa', { timeout: 15000 });
    await coberturaPronta(page);

    /* 1. cobertura */
    const cob = await page.$$eval('#mfmCobertura .mfm-cob-item', (ls) => ls.map((l) => l.dataset.cobertura + '=' + l.textContent.replace(/\s+/g, ' ').trim()));
    const esperado = ['ok=4 no Mapa', 'recomendacao=1 recomendação sem estrutura compatível', 'neutro=1 com estrutura do tipo, ainda sem vínculo', 'neutro=1 A validar, sem decisão final',
      'neutro=1 encerrada', 'neutro=2 sem posicionamento registrado (opcional para itens avaliados)', 'total=de 10 registros'];
    afirma(JSON.stringify(cob) === JSON.stringify(esperado), '1. cobertura pela régua da jornada, somando o total (4+1+1+1+1+2 = 10)', JSON.stringify(cob));
    if (rotulo === '1366 px') {
      /* a mesma régua dos Trabalhos: "Registros completos" da jornada = "no Mapa" */
      const t = await abrir(browser, viewport, '#arquitetura?tr=1');
      await esperarCondicao(t.page, () => { const r = document.getElementById('mfResumo'); return !!r && /Registros completos/.test(r.textContent); }, undefined, { limite: 15000 });
      const completos = await t.page.evaluate(() => +((document.getElementById('mfResumo').textContent.match(/Registros completos:\s*(\d+)/) || [])[1]));
      afirma(completos === 4, '1b. "no Mapa" = "Registros completos" da jornada (' + completos + ')');
      const grupos = await t.page.$$eval('#mfItens .mf-grupo-tipo', (gs) => gs.map((g) => g.textContent.replace(/\s+/g, ' ').trim()));
      afirma(/^Itens avaliados \(P1–P16\) \(\d+\)$/.test(grupos[0] || '') && !grupos.some((g) => /^Produtos\/Serviços/.test(g)), '7. jornada: "Itens avaliados (P1–P16)" no lugar de "Produtos/Serviços"', JSON.stringify(grupos));
      await t.ctx.close();
    }

    /* 5. sem seletor de demonstração */
    afirma(await page.locator('.mfm-fonte, [data-fonte="demo"]').count() === 0 && !/Demonstração \(fictícia\)/.test(await texto(page, '#mfmMapa')) && /estruturas cadastradas/.test(await texto(page, '.mfm-subtitulo')),
      '5. a interface oficial não oferece "Demonstração (fictícia)"');

    /* 2. resumo nas caixas */
    const resumos = await page.$$eval('#mfmMapa .mfm-caixa', (cs) => cs.map((c) => ({ id: c.dataset.estrutura, n: +((c.querySelector('.mfm-caixa-resumo') || {}).dataset || {}).vinculosConfirmados, t: (c.querySelector('.mfm-caixa-resumo') || {}).textContent || '' })));
    const soma = resumos.reduce((a, r) => a + (r.n || 0), 0), neg = resumos.find((r) => r.id === 'neg-1') || {};
    afirma(soma === vinculosAtivos && neg.n === 2 && /2 vínculos confirmados/.test(neg.t), '2. caixas: vínculos confirmados por estrutura (soma ' + soma + ' = ' + vinculosAtivos + ' ativos; Linha de Previdência: 2)', JSON.stringify(resumos));

    /* 4. recomendações sem estrutura compatível */
    const sem = await texto(page, '#mfmSemEstrutura');
    afirma(/Recomendações sem estrutura compatível/.test(sem) && /Gestão de canais/.test(sem) && /recomendação: .+ · sem decisão final · não é vínculo/.test(sem) && !(await page.$('#mfmSemEstruturaDecisao')),
      '4. a recomendação sem estrutura aparece como recomendação, nunca como vínculo; sem seção de decisões (não há)', sem.slice(0, 200));

    /* 3. detalhe */
    await abrirEstrutura(page, 'neg-1');
    const def = await texto(page, '#mfmDetalhe .mfm-definicao');
    afirma(def.length > 20 && !/indisponível/i.test(def), '3. definição oficial vigente da Taxonomia no detalhe', def.slice(0, 80));
    const fatos = await page.$$eval('#mfmObjetos .mfm-objeto', (ls) => ls.map((l) => ({ id: l.dataset.objeto, t: l.innerText.replace(/\s+/g, ' ') })));
    const capec = fatos.find((f) => f.id === 'pCapec') || {}, assess = fatos.find((f) => f.id === 'pAssess') || {};
    afirma(/Origem Item avaliado \(P1–P16\)/.test(capec.t || '') && /Classificação Produto\/Serviço principal/.test(capec.t || '') && /Natureza/.test(capec.t || '') &&
      /Posicionamento recomendação: .+ · sem decisão final/.test(capec.t || '') && /Posicionamento decisão confirmada: /.test(assess.t || ''),
      '3. cada registro: origem, classificação, natureza e posicionamento (recomendação × decisão confirmada)', JSON.stringify(fatos).slice(0, 400));
    await page.goto(BASE + '/index.html#arquitetura?mf=mapa&e=jur', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#mfmDetalhe'); await esperarCondicao(page, () => !!document.querySelector('#mfmObjetos'), undefined, { limite: 15000 });
    const jur = await texto(page, '#mfmObjetos');
    afirma(/Origem Responsabilidade organizacional/.test(jur) && !/Classificação/.test(jur), '3. responsabilidade organizacional: origem própria, sem classificação P1–P16');

    /* 6. ida e volta */
    await page.goto(BASE + '/index.html#arquitetura?mf=mapa', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#mfmMapa .mfm-caixa'); await coberturaPronta(page);
    await abrirEstrutura(page, 'neg-1');
    await page.click('#mfmObjetos .mfm-objeto[data-objeto="pCapec"] .mfm-abrir-registro');
    await page.waitForSelector('#mfCatalogo .mf-item--detalhe[data-item="pCapec"]');
    const voltaReg = await texto(page, '#mfVoltarLista');
    await page.click('#mfVoltarLista');
    await page.waitForSelector('#mfmDetalhe');
    afirma(/Voltar para o Mapa da Floresta/i.test(voltaReg) && /mf=mapa/.test(await hash(page)) && /e=neg-1/.test(await hash(page)), '6a. Mapa → "Abrir registro" → "' + voltaReg + '" → de volta ao Mapa, na estrutura de origem', await hash(page));
    await esperarCondicao(page, () => !!document.querySelector('#mfmObjetos'), undefined, { limite: 15000 });
    await page.click('#mfmObjetos .mfm-objeto[data-objeto="pAssess"] .mfm-abrir-po');
    await page.waitForSelector('#poVoltar');
    const voltaPo = await texto(page, '#poVoltar');
    await page.click('#poVoltar');
    await page.waitForSelector('#mfmMapa');
    afirma(/Mapa/i.test(voltaPo) && /mf=mapa/.test(await hash(page)), '6b. Mapa → "Abrir Posicionamento" → "' + voltaPo + '" → de volta ao Mapa', await hash(page));
    if (!(await page.$('#mfmDetalhe'))) await abrirEstrutura(page, 'neg-1');
    const abrirCad = await page.$('#mfmAbrirCadastro');
    if (abrirCad) {
      await abrirCad.click();
      await page.waitForSelector('#estVoltarOrigemNav');
      const voltaCad = await texto(page, '#estVoltarOrigemNav');
      await page.click('#estVoltarOrigemNav');
      await page.waitForSelector('#mfmMapa');
      afirma(/Mapa/i.test(voltaCad) && /mf=mapa/.test(await hash(page)), '6c. Mapa → "Abrir a ficha no cadastro" → "' + voltaCad + '" → de volta ao Mapa', await hash(page));
    } else afirma(false, '6c. "Abrir a ficha no cadastro" presente para o perfil Arquitetura');

    /* 8. nada gravado, sem rolagem lateral, sem erro */
    const escritas = await page.evaluate(() => (window.__ESCRITAS || []).map((e) => e.path));
    afirma(escritas.length === 0, '8. nenhuma gravação no banco', escritas.join(', '));
    afirma(await semLado(page), '8. sem rolagem lateral');
    if (rotulo !== '375 px') {
      const pv = await verificarTela(page, { escopo: '#mfmMapa', largura: viewport.width, focos: 0 });
      afirma(!pv || !pv.length, 'Padrão Visual no Mapa', (pv || []).slice(0, 3).join(' | '));
    }
    afirma(!erros.length, 'sem erro de JavaScript', erros[0]);
    await ctx.close();
  }
  await browser.close();
  console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
