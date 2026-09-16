/* Repositório (Holocron): a grade nunca fica vazia calada enquanto espera
 * o Firebase — mostra "Carregando conteúdos…" até a primeira resposta.
 *
 * POR QUE ESTE TESTE EXISTE
 * "Está abrindo sem nada, mesmo parecendo que 'Todos' já é a opção padrão
 * quando abre. Aí a pessoa tem que clicar em 'Todos' para aparecer. Não é
 * estranho?" render() só desenha os cards dentro de TRÊS listeners
 * assíncronos do Firebase (fa-seeds-hidden, fa-holocron-hidden, holocron) —
 * enquanto nenhum respondeu, #repoGrid ficava genuinamente vazio, sem
 * nenhuma pista de que falta carregar algo. Em rede lenta (a rede da Previ
 * na sala da oficina, não o wi-fi do escritório testando local) essa
 * janela é grande o bastante pra alguém achar que "não tem nada aqui" ou
 * "quebrou" e clicar em "Todos" — o MESMO filtro que já estava ativo — só
 * pra "religar" a tela. Funcionava por coincidência: quem resolvia era a
 * resposta do Firebase chegando por perto, não o clique. Mesma família dos
 * dois desastres documentados no CLAUDE.md (PR #111 e #116): espera calada
 * tratada como se fosse "nada aqui" ou "site quebrado".
 *
 * Roda com o Firebase falso (.github/scripts/firebase-falso.js): sem
 * segredo, sem rede de verdade, e permite travar a leitura do holocron por
 * tempo indefinido para provar o pior caso (a resposta que nunca chega).
 *
 * O QUE ELE EXIGE:
 *   1. leitura do holocron/fa-seeds-hidden/fa-holocron-hidden TRAVADA (nunca
 *      responde): a grade mostra "Carregando conteúdos…", nunca fica
 *      vazia e nunca mostra "Nenhum conteúdo nesta categoria ainda." (essa
 *      mensagem é para filtro sem resultado, não para "ainda não sei");
 *   2. rede normal: os cards curados (SEEDS) aparecem sem precisar clicar
 *      em nada, e o aviso de carregamento não fica preso na tela;
 *   3. nenhum erro de JavaScript não tratado.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE  = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

const PESSOA = 'pessoa@previ.com.br';

function banco() {
  const users = {};
  users[chave(PESSOA)] = { name: 'PESSOA', email: PESSOA, area: 'TI' };
  return {
    'fa-users': users, 'fa-admins': {}, 'fa-diretores': {}, 'fa-facilitadores': {},
    'fa-users-log': {}, 'fa-progress': {}, 'fa-reset-signal': {}, 'fa-espera': {},
    eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-interesse-log': {},
    'turmas-config': {}, 'turmas-checkin': {}, 'turmas-publico': {}, 'eventos-publico': {},
    'turmas-equipe': {}, 'turmas-sorteio': {}, avaliacoes: {}, pedidos: {},
    holocron: {}, 'fa-seeds-hidden': {}, 'fa-holocron-hidden': {},
  };
}

async function abrir(browser, cfgExtra) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  await page.addInitScript('window.__CFG = ' + JSON.stringify(Object.assign({
    db: banco(), user: { email: PESSOA, emailVerified: true, uid: 'u1' }, delayDefault: 20,
  }, cfgExtra)) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#repositorio', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#repoGrid', { timeout: 15000 });
  return { ctx, page, erros };
}

(async () => {
  const browser = await chromium.launch();
  let falhas = 0;
  const anota = (linha, ok, detalhe) => {
    if (ok) { console.log('  ok    ' + linha); }
    else { falhas++; console.error('  FALHA ' + linha + (detalhe ? ' → ' + detalhe : '')); }
  };

  try {
    /* Cenário 1: as três leituras nunca respondem. */
    const travado = await abrir(browser, {
      delays: { holocron: 999000, 'fa-seeds-hidden': 999000, 'fa-holocron-hidden': 999000 },
    });
    await travado.page.waitForTimeout(400); // dá tempo de sobra pro pior caso aparecer
    const estadoTravado = await travado.page.evaluate(() => {
      const grid = document.getElementById('repoGrid');
      const empty = document.getElementById('repoEmpty');
      return {
        gridVazio: grid.children.length === 0,
        gridTexto: (grid.textContent || '').trim(),
        avisoVazioVisivel: empty && !empty.hidden,
      };
    });
    anota('leitura travada: a grade NUNCA fica vazia (mostra aviso de carregamento)',
      !estadoTravado.gridVazio, 'children=0, texto="' + estadoTravado.gridTexto + '"');
    anota('leitura travada: o texto é de carregamento, não de "nenhum conteúdo"',
      /carregando/i.test(estadoTravado.gridTexto), 'veio "' + estadoTravado.gridTexto + '"');
    anota('leitura travada: a mensagem "Nenhum conteúdo nesta categoria" NÃO aparece',
      !estadoTravado.avisoVazioVisivel);
    if (travado.erros.length) anota('sem erro de JavaScript (leitura travada)', false, travado.erros[0]);
    await travado.ctx.close();

    /* Cenário 2: rede normal — os cards curados aparecem sozinhos. */
    const normal = await abrir(browser, {});
    await normal.page.waitForFunction(() => {
      const grid = document.getElementById('repoGrid');
      return grid.querySelectorAll('.repo-card').length > 0;
    }, { timeout: 10000 });
    const qtdCards = await normal.page.locator('#repoGrid .repo-card').count();
    anota('rede normal: os cards curados aparecem sem precisar clicar em nada', qtdCards > 0, 'veio ' + qtdCards);
    const aindaCarregando = await normal.page.evaluate(() =>
      /carregando/i.test((document.getElementById('repoGrid').textContent || '')));
    anota('rede normal: o aviso de carregamento não fica preso depois que os dados chegam', !aindaCarregando);
    if (normal.erros.length) anota('sem erro de JavaScript (rede normal)', false, normal.erros[0]);
    await normal.ctx.close();
  } catch (e) {
    falhas++;
    console.error('  FALHA inesperada: ' + e.message);
  } finally {
    await browser.close();
  }

  if (falhas) { console.error(`\n${falhas} falha(s).`); process.exit(1); }
  console.log('\nTudo certo.');
})();
