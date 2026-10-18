/* TAXONOMIA — modelo único das naturezas arquiteturais NA TELA (unificação, 18/10/2026), desktop e 375 px.
 * Conteúdo fictício (semente-taxonomia-ficha.js: os 11 códigos do motor como conceitos, ligados à Avaliação) + uma
 * natureza individual cadastrada (Operação) + um conceito fora do modelo. Firebase falso em persistência real; hermético.
 * Prova:
 *   1. Exportação completa (Excel e JSON) com acesso direto na tela principal; o JSON baixado dali é o completo.
 *   2. Catálogo arquitetural organizado pelo modelo: as 15 naturezas previstas (as sem conceito aparecem como previstas,
 *      sem botão — "a cadastrar" ou "definição pendente (E5)"); as 6 classificações técnicas do motor num grupo próprio
 *      ("não são naturezas"); o conceito fora do modelo à parte. Nenhum conceito duplicado nem omitido.
 *   3. Ficha: natureza (direta ou dentro de qual classificação técnica) × classificação técnica (a que naturezas
 *      corresponde); Regra/Opção corresponde só a Regra e orienta a reavaliação para quem for de fato Opção.
 *   4. Verificações do sistema: conferência só de leitura (a mesma função do diagnóstico de produção).
 *   5. Nada é gravado em nenhum passo; sem rolagem lateral; sem erro de JS. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');
const S = require('./semente-taxonomia-ficha');
const T = require('./taxonomia-tela');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const EMAIL = S.EMAIL;
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }
function banco() {
  const adm = {}; adm[chave(EMAIL)] = { email: EMAIL, name: 'ADMIN' };
  const users = {}; users[chave(EMAIL)] = { name: 'ADMIN', email: EMAIL, area: 'INFOR' };
  const db = Object.assign({ 'fa-users': users, 'fa-admins': adm, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {} }, S.semente());
  const C = db.taxonomia.arquitetural.conceitos;
  C.operacao = { nome: 'Operação (fictício)', ordem: 101, ativo: true, naturezaDe: 'funcionalidade-operacao', definicao: { texto: 'Definição fictícia de Operação.', versao: 1, publicadaEm: '2026-10-18T10:00:00.000Z', publicadaPor: EMAIL } };
  C.avulso = { nome: 'Conceito avulso (fictício)', ordem: 200, ativo: true, definicao: { texto: 'Definição fictícia.', versao: 1, publicadaEm: '2026-10-18T10:00:00.000Z', publicadaPor: EMAIL } };
  return db;
}
async function abrir(browser, viewport) {
  const cfg = { db: banco(), user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  await page.evaluate(() => { location.hash = '#arquitetura?arq=taxonomia'; });
  await page.waitForSelector('.tax-dominios', { timeout: 8000 });
  await T.dominio(page, 'arquitetural');
  await page.waitForSelector('.tax-item[data-codigo="componente"]', { timeout: 8000 });
  return { ctx, page, erros };
}
const texto = (page, sel) => page.locator(sel).first().textContent();
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const escritas = (page) => page.evaluate(() => (window.__ESCRITAS || []).length);
const TECNICAS = ['funcionalidade-operacao', 'processo-etapa', 'regra-condicao', 'modalidade-subproduto', 'documento-informacao', 'a-validar'];

(async () => {
  const browser = await chromium.launch();
  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros } = await abrir(browser, viewport);
    const e0 = await escritas(page);

    console.log('\n== 1. Exportação na tela principal ==');
    afirma(await page.locator('.tax-raiz > #taxExportar #taxExportarExcel').isVisible() && await page.locator('.tax-raiz > #taxExportar #taxExportarJson').isVisible(), 'Excel e JSON com acesso direto no Catálogo');
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('#taxExportarJson')]);
    const json = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    afirma(json.taxonomia && json.taxonomia.arquitetural && json.taxonomia.organizacional && json.taxonomia.arquitetural.conceitos.operacao, 'o JSON baixado do Catálogo é a exportação completa (os dois domínios)');
    await esperarCondicao(page, () => /JSON baixado/.test((document.getElementById('taxExportarStatus') || {}).textContent || ''), null, { descricao: 'confirmação do download' });
    afirma(true, 'a tela confirma o download');

    console.log('\n== 2. Catálogo arquitetural pelo modelo ==');
    afirma(/Naturezas arquiteturais · 15 previstas/.test(await texto(page, '#taxGrupoNaturezas')), 'grupo "Naturezas arquiteturais · 15 previstas"');
    const ordem = await page.evaluate(() => {
      const nav = document.querySelector('.tax-lista'), out = [];
      nav.querySelectorAll('.tax-lista-grupo, .tax-item, .tax-previsto').forEach((e) => out.push(e.id || e.getAttribute('data-codigo') || ('prev:' + e.getAttribute('data-natureza-prevista'))));
      return out;
    });
    const iNat = ordem.indexOf('taxGrupoNaturezas'), iTec = ordem.indexOf('taxGrupoTecnicas'), iFora = ordem.indexOf('taxGrupoFora');
    const nat = ordem.slice(iNat + 1, iTec), tec = ordem.slice(iTec + 1, iFora), fora = ordem.slice(iFora + 1);
    afirma(nat.length === 15, '15 linhas de natureza (conceito ou prevista)', nat.join(','));
    afirma(JSON.stringify(nat.filter((x) => !/^prev:/.test(x)).sort()) === JSON.stringify(['canal', 'capacidade-organizacional', 'componente', 'operacao', 'produto-principal', 'unidade-valor-associada']), 'as naturezas com conceito: 5 identidades reaproveitadas + Operação');
    afirma(await page.locator('.tax-previsto').count() === 9 && await page.locator('.tax-previsto button, button.tax-previsto').count() === 0, '9 naturezas previstas sem conceito, sem botão (nada se cria daqui)');
    afirma(/definição pendente \(E5\)/.test(await texto(page, '.tax-previsto[data-natureza-prevista="modalidade"]')) && /definição pendente \(E5\)/.test(await texto(page, '.tax-previsto[data-natureza-prevista="subproduto"]')), 'Modalidade e Subproduto: distintas, "definição pendente (E5)"');
    afirma(/a cadastrar/.test(await texto(page, '.tax-previsto[data-natureza-prevista="funcionalidade"]')) && /a cadastrar/.test(await texto(page, '.tax-previsto[data-natureza-prevista="opcao"]')), 'individuais ainda sem conceito: "a cadastrar"');
    afirma(JSON.stringify(tec.filter((x) => x !== 'prev:null').sort()) === JSON.stringify(TECNICAS.slice().sort()), 'as 6 classificações técnicas do motor num grupo próprio', tec.join(','));
    afirma(/Não são naturezas/.test(await texto(page, '.tax-lista-nota')), 'o grupo técnico diz que não são naturezas');
    afirma(JSON.stringify(fora) === JSON.stringify(['avulso']), 'o conceito fora do modelo fica à parte', fora.join(','));
    const todos = ordem.filter((x) => !/^tax|^prev:/.test(x));
    afirma(todos.length === new Set(todos).size && todos.length === 13, 'cada conceito aparece uma vez só (11 do motor + Operação + avulso)', String(todos.length));

    console.log('\n== 3. Ficha: o papel no modelo ==');
    await T.abrirConceito(page, 'regra-condicao');
    afirma((await page.locator('#taxPapelModelo').getAttribute('data-papel')) === 'classificacao-tecnica' && /não é uma natureza arquitetural/.test(await texto(page, '#taxPapelModelo')), 'Regra/Opção: classificação técnica, não natureza');
    afirma(/Corresponde a: Regra\./.test(await texto(page, '#taxPapelModelo')), 'Regra/Opção corresponde só a Regra');
    afirma(/Opção/.test(await texto(page, '#taxPapelOrientacao')) && /reavalie P1–P16/.test(await texto(page, '#taxPapelOrientacao')) && /histórico/.test(await texto(page, '#taxPapelOrientacao')), 'orienta: se for de fato Opção, reavaliar P1–P16 (histórico preservado)');
    await T.abrirConceito(page, 'modalidade-subproduto');
    afirma(/Corresponde a: Opção, Modalidade \(definição pendente\), Subproduto \(definição pendente\)\./.test(await texto(page, '#taxPapelModelo')), 'Modalidade/Subproduto: Opção + Modalidade e Subproduto pendentes', await texto(page, '#taxPapelModelo'));
    await T.abrirConceito(page, 'componente');
    afirma((await page.locator('#taxPapelModelo').getAttribute('data-papel')) === 'natureza' && /própria classificação/.test(await texto(page, '#taxPapelModelo')), 'Componente: natureza, a própria classificação do motor (mesma identidade)');
    await T.abrirConceito(page, 'produto-principal');
    afirma(/Natureza arquitetural conjunta/.test(await texto(page, '#taxPapelModelo')), 'Produto/Serviço: a natureza conjunta');
    await T.abrirConceito(page, 'operacao');
    afirma(/dentro da classificação técnica “Classificação fictícia 4”/.test(await texto(page, '#taxPapelModelo')), 'Operação: natureza dentro da classificação técnica (nome vindo da Taxonomia)');
    await T.abrirConceito(page, 'avulso');
    afirma((await page.locator('#taxPapelModelo').getAttribute('data-papel')) === 'fora-do-modelo', 'conceito avulso: fora do modelo, para revisão');

    console.log('\n== 4. Verificações: conferência só de leitura ==');
    await T.irIntegridade(page);
    await esperarCondicao(page, () => !!document.getElementById('taxModeloResumo'), null, { descricao: 'conferência do modelo' });
    const resumo = await texto(page, '#taxModeloResumo');
    afirma(/15 naturezas previstas/.test(resumo) && /6 cadastrada/.test(resumo) && /7 a cadastrar/.test(resumo) && /2 definição pendente/.test(resumo) && /6 de 6 classificações técnicas/.test(resumo), 'resumo: 6 cadastradas, 7 a cadastrar, 2 pendentes, 6 técnicas preservadas', resumo);
    afirma((await page.locator('#taxModeloResumo').getAttribute('data-ok')) === '0' && await page.locator('#taxModeloDetalhes[open]').count() === 1, 'com ponto a revisar (o avulso): a conferência abre sozinha');
    afirma((await page.locator('#taxModeloNaturezas li[data-natureza="operacao"]').getAttribute('data-situacao')) === 'cadastrada' && (await page.locator('#taxModeloNaturezas li[data-natureza="modalidade"]').getAttribute('data-situacao')) === 'pendente', 'Operação cadastrada; Modalidade pendente');
    afirma(await page.locator('#taxModeloTecnicas li').count() === 6 && /ligada à Avaliação/.test(await texto(page, '#taxModeloTecnicas li[data-codigo="regra-condicao"]')), 'as 6 técnicas preservadas e ligadas à Avaliação');
    afirma(/avulso/.test(await texto(page, '#taxModeloFora')), 'o conceito fora do modelo é apontado');
    afirma(/só lê/.test(await texto(page, '#taxModeloDetalhes')), 'deixa claro que só lê');

    console.log('\n== 5. Nada gravado, largura, erros ==');
    afirma((await escritas(page)) === e0, 'nenhuma gravação em nenhum passo');
    afirma(await larguraOk(page), 'sem rolagem horizontal');
    afirma(erros.length === 0, 'sem erro de JS', erros.join(' | '));
    await ctx.close();
  }
  await browser.close();
  console.log('\n' + (falhas ? 'FALHAS: ' + falhas : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
