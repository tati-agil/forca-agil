/* O Smoke (smoke-site-real.js) continua batendo com o site — e falha de forma útil.
 * Desktop. Hermético: Firebase falso, sem rede, sem segredo.
 *
 * POR QUE ESTE TESTE EXISTE
 * O Smoke roda contra o Firebase real e NÃO bloqueia o merge (depende de rede e segredo). Se uma
 * tela mudar um seletor que o Smoke espera, ele passa a reprovar sozinho no CI, e como não
 * bloqueia, isso pode ficar vermelho sem ninguém olhar. Este teste roda as MESMAS checagens do
 * Smoke (smokeComoAdmin, importada do próprio arquivo) contra o Firebase falso, em toda PR:
 *
 *   1. Com o banco respondendo, todas as checagens do Smoke passam (seletores e esperas certos).
 *   2. Com a leitura de uma área travada (o Repositório nunca recebe os conteúdos), o Smoke
 *      REPROVA aquela checagem dizendo o que não chegou, e as outras continuam rodando — não fica
 *      preso nem passa calado. (Site fora do ar ou login recusado são tratados antes, no próprio
 *      smoke-site-real.js, que sai com código 2 e a mensagem do motivo.)
 *   3. O Smoke não depende da antiga aba ADMIN › Testes: ela não existe e ele passa mesmo assim. */
const { chromium } = require('playwright');
const { esperarSessaoAssentada } = require('./esperas');
const { smokeComoAdmin } = require('./smoke-site-real');
const { banco, ADM, FALSO } = require('./teste-checagens-interface');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

async function abrir(browser, cfgExtra) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(Object.assign({ db: banco(), user: { email: ADM, emailVerified: true, uid: 'u-adm' }, delayDefault: 10, persistenciaReal: true }, cfgExtra || {})) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#home', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page, { semAvaliacao: true });
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch();

  console.log('\n== 1. Banco respondendo: as checagens do Smoke passam ==');
  {
    const { ctx, page } = await abrir(browser);
    const semAbaTestes = await page.evaluate(() => !document.querySelector('.admin-tab-btn[data-panel="adminPanelTestes"]') && !document.getElementById('adminPanelTestes'));
    const falhasSmoke = await smokeComoAdmin(page);
    afirma(falhasSmoke.length === 0, 'todas as checagens do Smoke passam', falhasSmoke.map((f) => f.label + ' :: ' + f.err).join(' | '));
    console.log('\n== 3. Sem a aba ADMIN › Testes ==');
    afirma(semAbaTestes, 'a aba ADMIN › Testes não existe no site — e o Smoke passou mesmo assim');
    await ctx.close();
  }

  console.log('\n== 2. Repositório nunca recebe os conteúdos: o Smoke reprova dizendo o quê ==');
  {
    const { ctx, page } = await abrir(browser, { delays: { holocron: 600000, 'fa-seeds-hidden': 600000, 'fa-holocron-hidden': 600000 } });
    const falhasSmoke = await smokeComoAdmin(page);
    const repo = falhasSmoke.find((f) => /Repositório/.test(f.label));
    afirma(!!repo && /"Carregando conteúdos…" sumir não aconteceu em 20 s/.test(repo.err), 'a checagem do Repositório reprova com o motivo ("Carregando conteúdos…" não sumiu em 20 s)', repo ? repo.err : 'não reprovou');
    afirma(falhasSmoke.length === 1, 'só ela reprova: uma área travada não esconde o resultado das outras', falhasSmoke.map((f) => f.label).join(' | '));
    await ctx.close();
  }

  await browser.close();
  console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nOK — as checagens do Smoke batem com o site, não dependem da aba Testes e reprovam dizendo o que faltou.');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
