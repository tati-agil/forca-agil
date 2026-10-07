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
 *   2. O Smoke não depende da antiga aba ADMIN › Testes: ela não existe e ele passa mesmo assim.
 *
 * E os quatro estados finais do Repositório (verificarRepositorio, a mesma função do Smoke). A
 * finalidade da checagem é provar que o Repositório real CARREGOU; o aviso de erro do hotfix #305
 * é a tela reagindo bem a um problema, não sucesso — e nunca vira sucesso aqui:
 *   R1. Conteúdo carregado (cartões)                                 → passa.
 *   R2. Aviso de erro com "Tentar novamente" → reprova com a mensagem
 *       "Repositório mostrou estado de erro após a tentativa de carregamento":
 *       a) leitura recusada;
 *       b) leitura que nunca responde — o aviso aparece em ~15 s, antes do limite de 20 s do
 *          Smoke, e reprova como erro (não como tempo esgotado). Aqui roda o Smoke inteiro: SÓ o
 *          Repositório reprova e as outras checagens continuam (uma área com problema não
 *          esconde o resultado das outras).
 *   R3. "Carregando conteúdos…" até o limite → reprova por tempo esgotado. Com sessão, o repo.js
 *       do hotfix não fica mais nesse estado (R2b); ele continua acontecendo SEM sessão (o
 *       repo.js só abre as leituras com login), que é o caso usado aqui — e é exatamente o que o
 *       Smoke veria se a sessão do admin de teste se perdesse.
 *   R4. Estado vazio legítimo (nada publicado: todos os conteúdos de curadoria ocultos e nenhum
 *       enviado) → passa, porque é distinguível do erro: #repoEmpty visível, sem #repoErroCarregar
 *       e sem "Carregando…".
 * (Site fora do ar ou login recusado são tratados antes, no próprio smoke-site-real.js, que sai
 * com código 2 e a mensagem do motivo.) */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { esperarSessaoAssentada } = require('./esperas');
const { smokeComoAdmin, verificarRepositorio, MSG_ERRO_REPOSITORIO } = require('./smoke-site-real');
const { banco, ADM, FALSO } = require('./teste-checagens-interface');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

const LEITURAS = ['holocron', 'fa-seeds-hidden', 'fa-holocron-hidden'];
const ADMIN_LOGADO = { email: ADM, emailVerified: true, uid: 'u-adm' };
/* Chaves dos conteúdos de curadoria, lidas do próprio repo.js (mesma regra de seedKey), para o
   estado vazio legítimo: todos ocultos em fa-seeds-hidden. */
const CHAVES_SEEDS = (() => {
  const js = fs.readFileSync(path.join(__dirname, '..', '..', 'forca-agil', 'repo.js'), 'utf8');
  const bloco = js.slice(js.indexOf('const SEEDS = ['), js.indexOf('window.faRepoSeedCount'));
  return [...bloco.matchAll(/url:\s*'([^']+)'/g)].map((m) => m[1].toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 80));
})();

async function abrir(browser, cfgExtra, semSessao) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(Object.assign({ db: banco(), user: { email: ADM, emailVerified: true, uid: 'u-adm' }, delayDefault: 10, persistenciaReal: true }, cfgExtra || {})) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#home', { waitUntil: 'domcontentloaded' });
  if (!semSessao) await esperarSessaoAssentada(page, { semAvaliacao: true });
  return { ctx, page };
}

/* Abre #repositorio e roda a checagem do Smoke; devolve { ok, detalhe, s } sem lançar. */
async function repositorio(page, limite) {
  await page.evaluate(() => { location.hash = '#repositorio'; });
  const t0 = Date.now();
  try { return { ok: true, detalhe: await verificarRepositorio(page, limite), s: (Date.now() - t0) / 1000 }; }
  catch (e) { return { ok: false, detalhe: e.message, s: (Date.now() - t0) / 1000 }; }
}

(async () => {
  const browser = await chromium.launch();

  console.log('\n== 1/2. Banco respondendo: as checagens do Smoke passam, sem a aba ADMIN › Testes ==');
  {
    const { ctx, page } = await abrir(browser);
    const semAbaTestes = await page.evaluate(() => !document.querySelector('.admin-tab-btn[data-panel="adminPanelTestes"]') && !document.getElementById('adminPanelTestes'));
    const falhasSmoke = await smokeComoAdmin(page);
    afirma(falhasSmoke.length === 0, 'todas as checagens do Smoke passam', falhasSmoke.map((f) => f.label + ' :: ' + f.err).join(' | '));
    afirma(semAbaTestes, 'a aba ADMIN › Testes não existe no site — e o Smoke passou mesmo assim');
    console.log('\n== R1. Conteúdo carregado ==');
    const r = await repositorio(page);
    afirma(r.ok && /^\d+ cartões$/.test(r.detalhe), 'Repositório com cartões → a checagem passa', r.detalhe);
    await ctx.close();
  }

  console.log('\n== R2a. Leitura recusada: aviso de erro → reprova dizendo que foi erro ==');
  {
    const { ctx, page } = await abrir(browser, { fail: LEITURAS });
    const r = await repositorio(page);
    afirma(!r.ok && r.detalhe.indexOf(MSG_ERRO_REPOSITORIO) === 0 && /Não foi possível carregar os conteúdos agora/.test(r.detalhe),
      'reprova com "' + MSG_ERRO_REPOSITORIO + '" e o texto que a tela mostrou', r.detalhe);
    afirma(!r.ok && !/não terminou de carregar em/.test(r.detalhe), 'o motivo é o erro, não tempo esgotado', r.detalhe);
    await ctx.close();
  }

  console.log('\n== R2b. Leitura que nunca responde: o Smoke inteiro roda e SÓ o Repositório reprova, como erro ==');
  {
    const delays = {}; LEITURAS.forEach((l) => { delays[l] = 600000; });
    const { ctx, page } = await abrir(browser, { delays });
    const falhasSmoke = await smokeComoAdmin(page);
    const repo = falhasSmoke.find((f) => /Repositório/.test(f.label));
    /* Reprovar como erro (e não como tempo esgotado) prova que o aviso do repo.js (~15 s) chegou
       antes do limite de 20 s do Smoke. */
    afirma(!!repo && repo.err.indexOf(MSG_ERRO_REPOSITORIO) === 0, 'reprova com "' + MSG_ERRO_REPOSITORIO + '" (o aviso chegou antes do limite do Smoke)', repo ? repo.err : 'não reprovou');
    afirma(falhasSmoke.length === 1, 'só ela reprova: uma área com problema não esconde o resultado das outras', falhasSmoke.map((f) => f.label).join(' | '));
    await ctx.close();
  }

  console.log('\n== R3. "Carregando conteúdos…" até o limite: reprova por tempo esgotado ==');
  {
    const { ctx, page } = await abrir(browser, { user: null, exigeLogin: LEITURAS }, true);
    const r = await repositorio(page);
    const tela = await page.evaluate(() => ({ carregando: /Carregando conteúdos…/.test(document.getElementById('repoGrid').textContent),
      visivel: !document.getElementById('page-repositorio').hidden, erro: !!document.getElementById('repoErroCarregar') }));
    afirma(tela.visivel && tela.carregando && !tela.erro, 'a tela ficou de fato em "Carregando conteúdos…" (sem sessão), sem aviso de erro', JSON.stringify(tela));
    afirma(!r.ok && /^o Repositório não terminou de carregar em 20 s/.test(r.detalhe), 'reprova por tempo esgotado, no limite real do Smoke (20 s)', r.detalhe);
    afirma(!r.ok && r.detalhe.indexOf(MSG_ERRO_REPOSITORIO) < 0, 'e não confunde espera com erro', r.detalhe);
    await ctx.close();
  }

  console.log('\n== R4. Estado vazio legítimo (nada publicado): passa, distinguível do erro ==');
  {
    const db = banco();
    db.holocron = {};
    db['fa-seeds-hidden'] = {}; CHAVES_SEEDS.forEach((k) => { db['fa-seeds-hidden'][k] = true; });
    const { ctx, page } = await abrir(browser, { db });
    const r = await repositorio(page);
    const tela = await page.evaluate(() => ({ cartoes: document.querySelectorAll('#repoGrid .repo-card').length,
      vazio: !document.getElementById('repoEmpty').hidden, erro: !!document.getElementById('repoErroCarregar') }));
    afirma(CHAVES_SEEDS.length > 0 && tela.cartoes === 0 && tela.vazio && !tela.erro, 'a tela mostra o vazio legítimo (' + CHAVES_SEEDS.length + ' conteúdos de curadoria ocultos, nenhum enviado), sem aviso de erro', JSON.stringify(tela));
    afirma(r.ok && /estado vazio legítimo/.test(r.detalhe), 'a checagem passa e diz que estava vazio (não erro)', r.detalhe);
    await ctx.close();
  }

  await browser.close();
  console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nOK — as checagens do Smoke batem com o site e não dependem da aba Testes; o Repositório só passa carregado (ou vazio legítimo), e erro e espera infinita reprovam, cada um com o seu motivo.');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
