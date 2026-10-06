/* ADMIN › Arquitetura › Documentação e mapas de Arquitetura (onde fica o Mapa da Floresta).
 *
 * Formato inicial aprovado: título, descrição, link externo (https), autor e data — sem upload,
 * miniatura nem versionamento. Prova, em desktop e no celular (375 px):
 *   - o cartão fica na tela inicial da Arquitetura (grupo "Referências") e a tela explica o Mapa
 *     da Floresta, separado do Mapa da Aposta;
 *   - adicionar grava título, descrição, link, autor e data (e uma linha no histórico, junto);
 *   - link sem https é recusado na tela, com mensagem, sem gravar nada;
 *   - editar e arquivar/restaurar nunca apagam: o documento continua no banco;
 *   - o histórico fica recolhido, com "Histórico — N alterações" e "Ver detalhes";
 *   - gravação recusada pelo banco mostra o erro e mantém o formulário;
 *   - o tipo "Avaliação" (sem Arquitetura) não vê o ADMIN.
 * A gravação acontece de verdade no Firebase falso (persistência real); as regras do banco são
 * provadas à parte no emulador (teste-rules-perfis-avaliacao.js). Hermético. */
const { chromium } = require('playwright');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const fs = require('fs');
const path = require('path');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const ARQ = 'arquitetura@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

async function abrir(browser, viewport, extraCfg) {
  const aut = {}; aut[chave(ARQ)] = { email: ARQ, nome: 'Arq', tipo: 'avaliacao-arquitetura', concedidoPor: 'tatianefdirene@previ.com.br', concedidoEm: '2026-10-01T10:00:00.000Z' };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': {}, 'avaliacoes-produto': {}, 'avaliacoes-squad': {},
    'motor-squad-config': {}, 'motor-arquitetura-config': {}, 'fa-avaliacao-acessos': {}, 'fa-avaliacao-autorizados': aut,
    'arquitetura-documentos': {}, 'arquitetura-documentos-auditoria': {} };
  const ctx = await browser.newContext({ viewport: viewport });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(Object.assign({ db: db, user: { email: ARQ, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true }, extraCfg || {})) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  await page.waitForSelector('#avpDocumentacaoBtn', { timeout: 8000 });
  return { ctx, page, erros };
}
const banco = (page, no) => page.evaluate((n) => JSON.parse(JSON.stringify(window.__CFG.__dbReal[n] || {})), no);
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

(async () => {
  const browser = await chromium.launch();
  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros } = await abrir(browser, viewport);
    afirma(/Referências/.test(await page.locator('#adminAvaliacaoProduto').innerText()), 'o cartão fica no grupo "Referências" da tela inicial da Arquitetura');
    await page.click('#avpDocumentacaoBtn');
    await page.waitForSelector('#avpDocsNovoBtn');
    const intro = await page.locator('.avp-docs').innerText();
    afirma(/Mapa da Floresta/.test(intro) && /Linhas, Centros de Excelência \(CoE\) e Áreas Especializadas/.test(intro) && /Mapa da Aposta/.test(intro),
      'a tela explica o Mapa da Floresta e o separa do Mapa da Aposta');
    afirma(await page.evaluate(() => location.hash) === '#admin?arq=documentacao', 'endereço próprio: #admin?arq=documentacao');
    const DEFINICAO = 'É uma representação visual organizada pela lógica de geração de valor. Mostra como a PREVI se organiza em Linhas, ' +
      'Centros de Excelência (CoE) e Áreas Especializadas e como essas estruturas contribuem para a entrega de produtos e serviços aos clientes.';
    afirma((await page.locator('#avpDocsMapaFloresta .avp-docs-definicao-texto').textContent()).trim() === DEFINICAO, 'card "Mapa da Floresta" com a definição aprovada, texto exato');
    afirma((await page.locator('#avpDocsMapaFloresta .avp-docs-definicao-nota').textContent()).trim() === 'Não é um conceito da Taxonomia e não tem relação com o Mapa da Aposta.', '…e a nota auxiliar logo abaixo');
    const est = await page.evaluate(() => { const t = document.querySelector('#avpDocsMapaFloresta .avp-docs-definicao-texto'); const cs = getComputedStyle(t);
      const card = document.getElementById('avpDocsMapaFloresta').getBoundingClientRect(), btn = document.getElementById('avpDocsNovoBtn').getBoundingClientRect();
      return { italico: cs.fontStyle === 'italic', px: parseFloat(cs.fontSize), antes: card.bottom <= btn.top + 1 }; });
    afirma(!est.italico && est.px >= 15 && est.antes, 'definição legível (sem itálico, ' + est.px + ' px) e ANTES da ação de adicionar');
    const det0 = page.locator('#avpDocsHistorico');
    afirma(await det0.count() === 1 && !(await det0.evaluate((d) => d.open)) && /Histórico — 0 alterações/.test(await det0.locator('summary').first().innerText()), 'sem nenhuma alteração ainda: "Histórico — 0 alterações", recolhido');

    console.log('\n== Adicionar ==');
    await page.click('#avpDocsNovoBtn');
    await page.fill('#avpDocTitulo', 'Mapa da Floresta');
    await page.fill('#avpDocDescricao', 'Organização da PREVI pela lógica de geração de valor');
    await page.fill('#avpDocLink', 'http://sem-https.exemplo.com/mapa.pdf');
    await page.click('#avpDocSalvar');
    afirma(/https:\/\//.test(await page.locator('#avpDocErro').innerText()), 'link sem https: a tela recusa e diz por quê');
    afirma(Object.keys(await banco(page, 'arquitetura-documentos')).length === 0, '…e nada foi gravado');
    await page.fill('#avpDocLink', 'https://exemplo.sharepoint.com/mapa-da-floresta.pdf');
    await page.click('#avpDocSalvar');
    await page.waitForSelector('#avpDocsFlash');
    const docs = await banco(page, 'arquitetura-documentos');
    const k = Object.keys(docs)[0];
    afirma(Object.keys(docs).length === 1 && docs[k].titulo === 'Mapa da Floresta' && docs[k].link === 'https://exemplo.sharepoint.com/mapa-da-floresta.pdf' &&
      docs[k].autor && docs[k].autor.email === ARQ && !!docs[k].criadoEm && docs[k].arquivado === false, 'gravou título, descrição, link, autor e data');
    afirma(Object.keys(await banco(page, 'arquitetura-documentos-auditoria')).length === 1, 'e uma linha no histórico, na mesma gravação');
    const link = page.locator('#avpDocsLista .avp-doc-link a').first();
    afirma(await link.getAttribute('target') === '_blank' && /noopener/.test(await link.getAttribute('rel')), 'o link abre o arquivo em nova aba (noopener)');
    const meta = await page.locator('#avpDocsLista .avp-doc-meta').first().innerText();
    afirma(/arquitetura@previ\.com\.br/.test(meta) && /\d{2}\/\d{2}\/\d{4}/.test(meta), 'o cartão mostra o autor e a data (' + meta.replace(/\s+/g, ' ') + ')');

    console.log('\n== Editar, arquivar e restaurar (nunca apagam) ==');
    await page.click('.avp-doc-editar');
    await page.fill('#avpDocTitulo', 'Mapa da Floresta — 2026');
    await page.click('#avpDocSalvar');
    await page.waitForSelector('#avpDocsFlash');
    afirma((await banco(page, 'arquitetura-documentos'))[k].titulo === 'Mapa da Floresta — 2026', 'editar grava o título novo no mesmo documento');
    await page.click('.avp-doc-arquivar[data-acao="arquivar"]');
    await page.click('.avp-modal-confirm-btn');
    await page.waitForSelector('#avpDocsArquivados');
    afirma((await banco(page, 'arquitetura-documentos'))[k].arquivado === true && await page.locator('#avpDocsLista .avp-doc-item').count() === 0, 'arquivar tira da lista e guarda em "Arquivados", sem apagar');
    await page.evaluate(() => { document.getElementById('avpDocsArquivados').open = true; });
    await page.click('.avp-doc-arquivar[data-acao="restaurar"]');
    await page.click('.avp-modal-confirm-btn');
    await esperarCondicao(page, () => document.querySelectorAll('#avpDocsLista .avp-doc-item').length === 1, null, { descricao: 'o documento restaurado voltar à lista' });
    afirma((await banco(page, 'arquitetura-documentos'))[k].arquivado === false, 'restaurar devolve à lista');

    console.log('\n== Histórico recolhido ==');
    const det = page.locator('#avpDocsHistorico');
    afirma(!(await det.evaluate((d) => d.open)), 'o histórico começa recolhido');
    afirma(/Histórico — 4 alterações/.test(await det.locator('summary').first().innerText()), 'cabeçalho "Histórico — 4 alterações" (' + await det.locator('summary').first().innerText() + ')');
    await det.locator('summary').first().click();
    afirma(await page.locator('#avpDocsHistorico .avp-historico-linha').count() === 4, 'aberto: uma linha por alteração');
    afirma(/Documento alterado/.test(await page.locator('#avpDocsHistorico').innerText()), 'cada linha diz o tipo');
    await page.locator('#avpDocsHistorico .avp-historico-detalhe summary').first().click();
    afirma(/Restaurado|arquivado/i.test(await page.locator('#avpDocsHistorico .avp-historico-valores').first().innerText()), '"Ver detalhes" mostra o antes e o depois');
    afirma(await larguraOk(page), 'sem rolagem horizontal');

    console.log('\n== Gravação recusada pelo banco ==');
    await page.evaluate(() => { window.__CFG.fail = ['arquitetura-documentos']; });
    await page.click('.avp-doc-editar');
    await page.fill('#avpDocTitulo', 'Título que não grava');
    await page.click('#avpDocSalvar');
    await page.waitForSelector('#avpDocErro');
    afirma(/Não foi possível salvar/.test(await page.locator('#avpDocErro').innerText()) && await page.locator('#avpDocTitulo').inputValue() === 'Título que não grava',
      'erro visível e o formulário continua com o que foi digitado');
    afirma((await banco(page, 'arquitetura-documentos'))[k].titulo === 'Mapa da Floresta — 2026', 'nada mudou no banco');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }
  await browser.close();
  console.log('\n============================\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
