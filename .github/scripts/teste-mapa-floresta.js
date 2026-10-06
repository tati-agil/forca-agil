/* Mapa da Floresta configurável — ADMIN › Arquitetura › Documentação e mapas (desktop e 375 px).
 *
 * A definição do Mapa da Floresta é DADO, não código: chave estável MAPA_FLORESTA, estado vigente
 * em arquitetura-definicoes/MAPA_FLORESTA, histórico em arquitetura-definicoes-auditoria (só
 * acréscimo). Prova, rodando a página:
 *   1. sem o nó no banco (deploy novo): o card mostra o valor inicial de fábrica, dito como tal;
 *   2. com configuração gravada: o card mostra o texto DO BANCO (outro texto, sem mudar código);
 *   3. alterar pela tela grava o estado vigente + uma linha de auditoria na MESMA gravação, com
 *      anterior → novo, e o histórico começa recolhido ("Histórico — N alterações");
 *   4. a primeira gravação a partir do valor de fábrica cria o registro (tipo "criada");
 *   5. leitura pendente: nunca mostra o valor de fábrica como se fosse a configuração;
 *   6. leitura que falha: não mostra conteúdo vazio nem o valor de fábrica, não oferece edição
 *      (não dá para sobrescrever às cegas) e nada muda no banco;
 *   7. gravação recusada pelo banco: erro visível, formulário mantém o texto, banco intacto.
 * As regras (não apagar MAPA_FLORESTA, auditoria só acréscimo, quem lê/grava) são provadas no
 * emulador em teste-rules-perfis-avaliacao.js. Hermético. */
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
const FABRICA = 'É uma representação visual organizada pela lógica de geração de valor. Mostra como a PREVI se organiza em Linhas, ' +
  'Centros de Excelência (CoE) e Áreas Especializadas e como essas estruturas contribuem para a entrega de produtos e serviços aos clientes.';
const GRAVADA = { titulo: 'Mapa da Floresta (2027)', definicao: 'Definição gravada no banco — outra redação, sem mudar código.', nota: 'Nota gravada no banco.',
  link: 'https://exemplo.sharepoint.com/mapa-2027.pdf', criadoEm: '2026-10-01T10:00:00.000Z', criadoPor: { name: 'Tati', email: 'tatianefdirene@previ.com.br' },
  atualizadoEm: '2026-10-02T10:00:00.000Z', atualizadoPor: { name: 'Tati', email: 'tatianefdirene@previ.com.br' } };

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

async function abrir(browser, viewport, definicoes, extra) {
  const aut = {}; aut[chave(ARQ)] = { email: ARQ, nome: 'Arq', tipo: 'avaliacao-arquitetura', concedidoPor: 'tatianefdirene@previ.com.br', concedidoEm: '2026-10-01T10:00:00.000Z' };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': {}, 'avaliacoes-produto': {}, 'avaliacoes-squad': {},
    'motor-squad-config': {}, 'motor-arquitetura-config': {}, 'fa-avaliacao-acessos': {}, 'fa-avaliacao-autorizados': aut,
    'arquitetura-documentos': {}, 'arquitetura-documentos-auditoria': {}, 'arquitetura-definicoes': definicoes || {}, 'arquitetura-definicoes-auditoria': {} };
  const ctx = await browser.newContext({ viewport: viewport });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(Object.assign({ db: db, user: { email: ARQ, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true }, extra || {})) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin?arq=documentacao', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const banco = (page, no) => page.evaluate((n) => JSON.parse(JSON.stringify(window.__CFG.__dbReal[n] || {})), no);
const texto = async (page, sel) => ((await page.locator(sel).first().textContent()) || '').trim();
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

(async () => {
  const browser = await chromium.launch();
  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');
    {
      console.log('\n== 1. Sem configuração no banco: valor inicial de fábrica ==');
      const { ctx, page, erros } = await abrir(browser, viewport, {});
      await page.waitForSelector('#avpDocsMapaFloresta .avp-docs-definicao-texto', { timeout: 8000 });
      afirma(await texto(page, '#avpDocsMapaFloresta .avp-docs-definicao-texto') === FABRICA && await texto(page, '#avpDocsMapaFloresta .avp-docs-definicao-nota') === 'Não é um conceito da Taxonomia e não tem relação com o Mapa da Aposta.',
        'o card mostra a definição e a nota iniciais');
      afirma(await page.locator('#avpMapaFabrica').count() === 1, '…dito como "valor inicial — ainda não salvo no banco"');
      const h0 = page.locator('#avpMapaHistorico');
      afirma(await h0.count() === 1 && !(await h0.evaluate((d) => d.open)) && /Histórico — 0 alterações/.test(await texto(page, '#avpMapaHistorico summary')), 'histórico do card: "Histórico — 0 alterações", recolhido');

      console.log('\n== 4. Primeira gravação a partir do valor de fábrica ==');
      await page.click('#avpMapaEditarBtn');
      afirma(await page.locator('#avpMapaDefinicao').inputValue() === FABRICA, 'o formulário abre com o valor vigente (o de fábrica)');
      await page.fill('#avpMapaLink', 'https://exemplo.sharepoint.com/mapa.pdf');
      await page.click('#avpMapaSalvar');
      await page.waitForSelector('#avpMapaFlash', { timeout: 8000 });
      const reg = (await banco(page, 'arquitetura-definicoes')).MAPA_FLORESTA;
      const aud = Object.values(await banco(page, 'arquitetura-definicoes-auditoria'));
      afirma(!!reg && reg.definicao === FABRICA && reg.link === 'https://exemplo.sharepoint.com/mapa.pdf' && reg.criadoPor.email === ARQ && reg.atualizadoPor.email === ARQ && !!reg.atualizadoEm,
        'gravou o estado vigente em arquitetura-definicoes/MAPA_FLORESTA (com atualizadoEm/atualizadoPor)');
      afirma(aud.length === 1 && aud[0].tipo === 'criada' && aud[0].definicaoId === 'MAPA_FLORESTA', '…e uma linha "criada" na auditoria, na mesma gravação');
      afirma(await page.locator('#avpMapaFabrica').count() === 0, 'depois de salvar, não é mais "valor inicial"');
      afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
      await ctx.close();
    }
    {
      console.log('\n== 2 e 3. Configuração gravada: lida do banco, alterada pela tela, auditada ==');
      const { ctx, page, erros } = await abrir(browser, viewport, { MAPA_FLORESTA: GRAVADA });
      await page.waitForSelector('#avpDocsMapaFloresta .avp-docs-definicao-texto', { timeout: 8000 });
      afirma(await texto(page, '#avpDocsMapaFlorestaTitulo') === GRAVADA.titulo && await texto(page, '#avpDocsMapaFloresta .avp-docs-definicao-texto') === GRAVADA.definicao &&
        await texto(page, '#avpDocsMapaFloresta .avp-docs-definicao-nota') === GRAVADA.nota, 'o card mostra título, definição e nota DO BANCO (não a constante do código)');
      afirma(await page.locator('#avpDocsMapaFloresta a[href="' + GRAVADA.link + '"]').count() === 1 && await page.locator('#avpMapaFabrica').count() === 0, 'link gravado e sem a marca de valor inicial');
      await page.click('#avpMapaEditarBtn');
      await page.fill('#avpMapaDefinicao', 'Nova redação da definição, feita pela tela.');
      await page.click('#avpMapaSalvar');
      await page.waitForSelector('#avpMapaFlash', { timeout: 8000 });
      const reg = (await banco(page, 'arquitetura-definicoes')).MAPA_FLORESTA;
      afirma(reg.definicao === 'Nova redação da definição, feita pela tela.' && reg.criadoEm === GRAVADA.criadoEm && reg.criadoPor.email === GRAVADA.criadoPor.email && reg.atualizadoPor.email === ARQ,
        'alterar o texto pela tela muda o estado vigente (criadoEm/criadoPor preservados, atualizadoPor = quem salvou)');
      const aud = Object.values(await banco(page, 'arquitetura-definicoes-auditoria'));
      afirma(aud.length === 1 && aud[0].tipo === 'alterada' && JSON.parse(aud[0].valorAnterior).definicao === GRAVADA.definicao &&
        JSON.parse(aud[0].valorNovo).definicao === 'Nova redação da definição, feita pela tela.' && !('titulo' in JSON.parse(aud[0].valorNovo)),
        'auditoria: uma linha "alterada" com só o campo que mudou, anterior → novo');
      afirma(await texto(page, '#avpDocsMapaFloresta .avp-docs-definicao-texto') === 'Nova redação da definição, feita pela tela.', 'o card passa a mostrar a nova redação');
      const det = page.locator('#avpMapaHistorico');
      afirma(!(await det.evaluate((d) => d.open)) && /Histórico — 1 alteração/.test(await texto(page, '#avpMapaHistorico summary')), 'histórico recolhido: "Histórico — 1 alteração"');
      await page.locator('#avpMapaHistorico summary').first().click();
      await page.locator('#avpMapaHistorico .avp-historico-detalhe summary').first().click();
      afirma(/Definição alterada/.test(await page.locator('#avpMapaHistorico').innerText()) && /outra redação/.test(await page.locator('#avpMapaHistorico .avp-historico-valores').innerText()),
        '"Ver detalhes" mostra o antes e o depois');

      console.log('\n== 7. Gravação recusada pelo banco ==');
      await page.evaluate(() => { window.__CFG.fail = ['arquitetura-definicoes']; });
      await page.click('#avpMapaEditarBtn');
      await page.fill('#avpMapaDefinicao', 'Texto que não grava');
      await page.click('#avpMapaSalvar');
      await page.waitForSelector('#avpMapaErro', { timeout: 8000 });
      afirma(/Não foi possível salvar/.test(await texto(page, '#avpMapaErro')) && await page.locator('#avpMapaDefinicao').inputValue() === 'Texto que não grava', 'erro visível e o formulário mantém o texto');
      afirma((await banco(page, 'arquitetura-definicoes')).MAPA_FLORESTA.definicao === 'Nova redação da definição, feita pela tela.' && Object.keys(await banco(page, 'arquitetura-definicoes-auditoria')).length === 1,
        'nada mudou no banco (nem o estado nem a auditoria)');
      afirma(await larguraOk(page), 'sem rolagem horizontal');
      afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
      await ctx.close();
    }
    {
      console.log('\n== 5. Leitura pendente: o valor de fábrica não aparece como se fosse a configuração ==');
      const { ctx, page, erros } = await abrir(browser, viewport, { MAPA_FLORESTA: GRAVADA }, { delays: { 'arquitetura-definicoes': 2500 } });
      await page.waitForSelector('#avpDocsVoltar', { timeout: 8000 });
      afirma(await page.locator('#avpDocsMapaFloresta').count() === 0 && !(await page.locator('#adminAvaliacaoProduto').innerText()).includes(FABRICA), 'enquanto a leitura não volta: nem o card de fábrica, nem card vazio');
      await page.waitForSelector('#avpDocsMapaFloresta .avp-docs-definicao-texto', { timeout: 10000 });
      afirma(await texto(page, '#avpDocsMapaFloresta .avp-docs-definicao-texto') === GRAVADA.definicao, 'quando chega: a configuração gravada');
      afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
      await ctx.close();
    }
    {
      console.log('\n== 6. Leitura que falha não substitui o conteúdo ==');
      const { ctx, page, erros } = await abrir(browser, viewport, { MAPA_FLORESTA: GRAVADA }, { fail: ['arquitetura-definicoes'] });
      await page.waitForSelector('#avpDocsErro', { timeout: 8000 });
      const tela = await page.locator('#adminAvaliacaoProduto').innerText();
      afirma(await page.locator('#avpDocsMapaFloresta').count() === 0 && !tela.includes(FABRICA) && await page.locator('#avpMapaEditarBtn').count() === 0,
        'falha de leitura: erro visível, sem card vazio, sem o valor de fábrica e sem "Editar definição" (não dá para sobrescrever às cegas)');
      afirma(await page.locator('#avpDocsTentar').count() === 1, '…com "Tentar novamente"');
      afirma(JSON.stringify((await banco(page, 'arquitetura-definicoes')).MAPA_FLORESTA) === JSON.stringify(GRAVADA), 'o banco continua com a configuração gravada');
      afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
      await ctx.close();
    }
  }
  await browser.close();
  console.log('\n============================\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
