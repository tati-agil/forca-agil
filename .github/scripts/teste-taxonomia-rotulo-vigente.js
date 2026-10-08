/* TAXONOMIA — "Editar rótulo" da fonte VIGENTE (Admin → Taxonomia), desktop e celular (375 px).
 * CONTEÚDO 100% FICTÍCIO. Firebase falso em persistência real; hermético (sem rede, sem segredo).
 * As regras do banco já permitem só o rótulo de uma fonte existente (texto/contexto/tipo imutáveis, vigência
 * amarrada ao ponteiro) — provado no emulador em teste-rules-taxonomia.js. Aqui se prova a tela:
 *   1. a fonte vigente tem "Editar rótulo"; o formulário só deixa editar o rótulo e diz que o texto e a definição
 *      vigente permanecem iguais;
 *   2. cancelar não grava; salvar sem mudar não grava;
 *   3. salvar grava SÓ o rótulo: mesma fonte (mesmo id), texto/contexto/tipoRedacao/situação=vigente iguais,
 *      definicaoVigenteFonteId igual, nenhuma fonte nova; histórico "rótulo anterior → novo" (alteracao_fonte);
 *   4. fontes não vigentes continuam como antes (Ver → Editar, sem "Editar rótulo").
 *   Sem rolagem horizontal; nenhum erro de JS. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const EMAIL = 'adm@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

const F1 = { texto: 'Texto fictício vigente, primeira redação.', contexto: 'BB', situacao: 'vigente', tipoRedacao: 'Significado v1', rotulo: 'Redação BB', criadoEm: '2026-10-01T09:00:00.000Z', criadoPor: 'outra.admin@previ.com.br' };
const semente = () => {
  const adm = {}; adm[chave(EMAIL)] = { email: EMAIL, name: 'ADMIN' };
  const users = {}; users[chave(EMAIL)] = { name: 'ADMIN', email: EMAIL, area: 'INFOR' };
  return {
    'fa-users': users, 'fa-admins': adm, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {},
    taxonomia: {
      meta: { cargaInicial: { feitaEm: '2026-10-01T09:00:00.000Z', feitaPor: EMAIL, resumo: {} } },
      organizacional: {
        conceitos: { SQ: { nome: 'Conceito Fictício Sq', camada: 'A', ordem: 1, ativo: true, situacaoDefinicao: 'registrada', definicaoVigenteFonteId: 'f1' } },
        fontes: { SQ: { f1: Object.assign({}, F1), f2: { texto: 'Texto fictício histórico.', contexto: 'PREVI', situacao: 'histórica/contextual', tipoRedacao: 'Conceito', criadoEm: '2026-10-01T09:00:01.000Z', criadoPor: EMAIL } } },
        auditoria: {}
      },
      arquitetural: {}
    }
  };
};

async function abrir(browser, viewport) {
  const cfg = { db: semente(), user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelTaxonomia"]', { state: 'visible', timeout: 12000 });
  await page.click('.admin-tab-btn[data-panel="adminPanelTaxonomia"]');
  await page.waitForSelector('.tax-item[data-codigo="SQ"]', { timeout: 8000 });
  await page.click('.tax-item[data-codigo="SQ"]');
  await esperarCondicao(page, () => !!document.querySelector('article[data-fonte="f1"]') && !document.querySelector('#taxSecFontes .loading-msg') && !document.querySelector('#taxSecHistorico .loading-msg'), null, { limite: 6000, descricao: 'detalhe do SQ carregado' });
  return { ctx, page, erros };
}
const org = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal.taxonomia.organizacional)));
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const escritas = (page) => page.evaluate(() => (window.__ESCRITAS || []).length);


(async () => {
  const browser = await chromium.launch();
  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros } = await abrir(browser, viewport);
    const antes = await org(page);

    console.log('\n== 1. A fonte vigente tem "Editar rótulo" ==');
    afirma(await page.locator('#taxVigenteBloco article[data-fonte="f1"] [data-tax="editar-rotulo"]').isVisible(), 'a fonte vigente mostra "Editar rótulo", à vista no cartão');
    afirma(await page.locator('article[data-fonte="f2"] [data-tax="editar-rotulo"]').count() === 0, 'fonte não vigente NÃO tem "Editar rótulo"');
    await page.click('#taxEditarRotuloBtn');
    await page.waitForSelector('#taxFormRotulo', { timeout: 4000 });
    afirma((await page.locator('#taxRotuloAviso').innerText()).trim() === 'Somente o rótulo será alterado. O texto e a definição vigente permanecem iguais.', 'o formulário diz: só o rótulo muda');
    afirma(await page.locator('#taxFormRotulo input, #taxFormRotulo textarea, #taxFormRotulo select').count() === 1 && await page.locator('#taxR_rotulo').inputValue() === 'Redação BB', 'o único campo editável é o rótulo, já com o valor atual');
    afirma(/Texto fictício vigente, primeira redação\./.test(await page.locator('#taxFormRotulo').innerText()), 'o texto aparece só para leitura');
    afirma(await larguraOk(page), 'formulário sem rolagem horizontal');

    console.log('\n== 2. Cancelar e "nada mudou" não gravam ==');
    let e0 = await escritas(page);
    await page.fill('#taxR_rotulo', 'Rascunho que não vai ser salvo');
    await page.click('#taxFormRotulo [data-tax="cancelar-edicao"]');
    afirma(await page.locator('#taxFormRotulo').count() === 0 && await escritas(page) === e0, 'cancelar fecha sem gravar');
    await page.click('#taxEditarRotuloBtn');
    await page.waitForSelector('#taxFormRotulo', { timeout: 4000 });
    await page.click('#taxFormRotulo [data-tax="salvar-edicao"]');
    await esperarCondicao(page, () => /Nada foi alterado/.test((document.getElementById('taxFormRotulo') || {}).innerText || ''), null, { descricao: 'aviso "Nada foi alterado"' });
    afirma(await escritas(page) === e0, 'salvar sem mudar o rótulo: "Nada foi alterado", nada gravado');

    console.log('\n== 3. Salvar grava SÓ o rótulo ==');
    await page.fill('#taxR_rotulo', 'Rótulo corrigido fictício');
    await page.click('#taxFormRotulo [data-tax="salvar-edicao"]');
    await esperarCondicao(page, () => { const f = window.__CFG.__dbReal.taxonomia.organizacional.fontes.SQ.f1; return f && f.rotulo === 'Rótulo corrigido fictício'; }, null, { descricao: 'rótulo gravado' });
    const depois = await org(page);
    const f1a = antes.fontes.SQ.f1, f1d = depois.fontes.SQ.f1;
    afirma(f1d.rotulo === 'Rótulo corrigido fictício', 'o rótulo mudou');
    afirma(['texto', 'contexto', 'tipoRedacao', 'criadoEm', 'criadoPor'].every((k) => f1d[k] === f1a[k]) && f1d.situacao === 'vigente', 'texto, contexto, tipo de redação, criação e situação=vigente iguais');
    afirma(depois.conceitos.SQ.definicaoVigenteFonteId === 'f1', 'definicaoVigenteFonteId continua exatamente "f1" (mesma fonte, mesmo id)');
    afirma(Object.keys(depois.fontes.SQ).sort().join() === Object.keys(antes.fontes.SQ).sort().join(), 'nenhuma fonte nova foi criada');
    afirma(JSON.stringify(depois.fontes.SQ.f2) === JSON.stringify(antes.fontes.SQ.f2), 'a outra fonte não foi tocada');
    const ev = Object.values((depois.auditoria || {}).SQ || {}).filter((x) => x.tipo === 'alteracao_fonte');
    afirma(ev.length === 1 && ev[0].fonteId === 'f1' && ev[0].valorAnterior === 'Redação BB' && ev[0].valorNovo === 'Rótulo corrigido fictício' && ev[0].rotuloAnterior === 'Redação BB' && ev[0].rotuloNovo === 'Rótulo corrigido fictício', 'histórico: alteracao_fonte, rótulo anterior → novo, apontando a fonte f1', JSON.stringify(ev));
    await esperarCondicao(page, () => { const d = document.querySelector('#taxVigenteMeta'); return !!d && /Rótulo corrigido fictício/.test(d.innerText); }, null, { descricao: 'cartão atualizado' });
    afirma(/Rótulo corrigido fictício/.test(await page.locator('#taxVigenteMeta').innerText()), 'o cartão da vigente mostra o rótulo novo');
    afirma(/rótulo da fonte vigente/i.test(await page.evaluate(() => (document.getElementById('taxSecHistorico') || {}).textContent || '')), 'o histórico do conceito mostra a alteração do rótulo');

    console.log('\n== 4. Fontes não vigentes: comportamento de sempre ==');
    await page.click('article[data-fonte="f2"] [data-tax="ver"]');
    await page.waitForSelector('article[data-fonte="f2"] [data-tax="editar-fonte"]', { timeout: 4000 });
    afirma(await page.locator('article[data-fonte="f2"] [data-tax="editar-rotulo"]').count() === 0 && await page.locator('article[data-fonte="f2"] [data-tax="editar-fonte"]').count() === 1, 'não vigente: "Ver" → "Editar" (rótulo e situação), sem "Editar rótulo"');
    afirma(await page.locator('article[data-fonte="f1"] [data-tax="editar-fonte"]').count() === 0, 'a vigente continua sem o "Editar" geral');

    afirma(await larguraOk(page), 'sem rolagem horizontal');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nOK — "Editar rótulo" da fonte vigente: só o rótulo muda (mesmo id, mesma vigência, nenhuma fonte nova), histórico anterior → novo, cancelar não grava; desktop e 375 px.');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
