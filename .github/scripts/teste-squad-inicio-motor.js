/* Adequação à Squad — início e motor legíveis (PR 6 do prompt consolidado):
 *   - o início pergunta "Avaliar item já cadastrado" × "Avaliar novo item";
 *     um nome que já existe (sem acento/caixa) não vira ficha duplicada;
 *   - o motor de squad mostra "Sn — título real" em cada condição, a combinação
 *     Eixo A + Eixo B em leitura, e explica precedência/simulação/publicação;
 *   - a lógica NÃO muda: abrir, ler e simular deixa as regras idênticas.
 * Desktop e celular (375 px). Hermético: sem rede, sem segredo. */
const { chromium } = require('playwright');
const { esperarSessaoAssentada } = require('./esperas');
const fs = require('fs');
const path = require('path');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const EMAIL = 'adm@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

async function abrir(browser, viewport) {
  const admins = {}; admins[chave(EMAIL)] = { email: EMAIL };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-espera': {},
    'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {}, eventos: {}, 'turmas-publico': {}, 'eventos-publico': {},
    'avaliacoes-produto': { k1: { nome: 'Orientação e Educação Previdenciária', status: 'concluido', itemId: 'k1', versao: 1, excluido: false, camadaSugerida: { id: 'produto-principal', label: 'Produto/Serviço principal' }, criadoEm: '2026-03-01T10:00:00.000Z', atualizadoEm: '2026-03-01T10:00:00.000Z' }, k2: { nome: 'Canal Digital', status: 'concluido', itemId: 'k2', versao: 1, excluido: false, camadaSugerida: { id: 'canal', label: 'Canal' }, criadoEm: '2026-03-02T10:00:00.000Z', atualizadoEm: '2026-03-02T10:00:00.000Z' } }, 'avaliacoes-squad': {}, 'motor-squad-config': {}, 'motor-squad-auditoria': {},
    'motor-arquitetura-config': {}, 'motor-arquitetura-auditoria': {}, 'fa-avaliacao-acessos': {} };
  const cfg = { db: db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport: viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  /* A avaliação de Squad fica na área AVALIAÇÃO (o motor, no ADMIN › Arquitetura — ver abrirMotor). */
  await page.goto(BASE + '/index.html#avaliacoes', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page); /* login decidido e acessos resolvidos (antes: opções no lugar do argumento, engolida) */
  await page.waitForSelector('#avpSquadBtn', { timeout: 8000 });
  return { ctx, page, erros };
}
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const regrasHoje = (page) => page.evaluate(() => JSON.stringify({ v: window.faMotorSquad.versaoAtual(), r: window.faMotorSquad.regrasDaVersao() }));

(async () => {
  const browser = await chromium.launch();
  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros } = await abrir(browser, viewport);
    await page.click('#avpSquadBtn');
    await page.waitForSelector('#avaliacoesSquad #sqNovaBtn');

    console.log('\n== Início: item já cadastrado × novo item ==');
    await page.click('#sqNovaBtn');
    await page.waitForSelector('#sqfEscolhaExistente');
    afirma(await page.locator('#sqfEscolhaExistente').innerText().then((t) => /Avaliar item já cadastrado/.test(t)) &&
      await page.locator('#sqfEscolhaNovo').innerText().then((t) => /Avaliar novo item/.test(t)), 'duas opções claras: "Avaliar item já cadastrado" e "Avaliar novo item"');
    afirma(await page.locator('#sqfBusca').count() === 0 && await page.locator('#sqfNovoItemNome').count() === 0, 'antes de escolher, nenhum campo aparece');
    await page.click('#sqfEscolhaExistente');
    await page.waitForSelector('#sqfBusca');
    afirma(await page.locator('.sq-busca-item:not(.sq-busca-item--vazio)').count() === 2, 'item já cadastrado: lista os itens existentes mesmo sem digitar');
    await page.fill('#sqfBusca', 'orientacao');
    afirma(await page.locator('.sq-busca-item:not(.sq-busca-item--vazio)').count() === 1, 'a busca ignora acento e caixa ("orientacao" acha "Orientação…")');
    afirma(/Produto\/Serviço principal/.test(await page.locator('.sq-busca-item').first().innerText()), 'mostra a classificação arquitetural como contexto');
    await page.fill('#sqfBusca', 'zzz');
    afirma(/Avaliar novo item/.test(await page.locator('.sq-busca-item--vazio').innerText()), 'sem resultado, orienta a escolher "Avaliar novo item"');
    afirma(await larguraOk(page), 'sem rolagem horizontal na escolha');
    await page.fill('#sqfBusca', 'canal');
    await page.click('.sq-busca-item');
    await page.waitForSelector('.sq-choice-btn, #sqSalvarSairBtn, .avp-question', { timeout: 8000 });
    afirma(/Canal Digital/.test(await page.locator('#avaliacoesSquad').innerText()), 'selecionar o item abre o checklist já com o nome dele');
    await page.click('#sqVoltarListaChecklist');
    const confirmaSair = page.locator('.sq-modal-confirm-btn');
    if (await confirmaSair.count()) await confirmaSair.click();
    await page.waitForSelector('#sqNovaBtn');
    await page.click('#sqNovaBtn');
    await page.waitForSelector('#sqfEscolhaNovo');
    await page.click('#sqfEscolhaNovo');
    await page.waitForSelector('#sqfNovoItemNome');
    afirma(await page.locator('#sqfBusca').count() === 0, 'novo item: só o campo de nome');
    await page.fill('#sqfNovoItemNome', '  CANAL   digital ');
    await page.click('#sqfNovoItemConfirmar');
    await page.waitForSelector('#sqfNovoItemErro');
    afirma(/Já existe um item cadastrado/.test(await page.locator('#sqfNovoItemErro').innerText()) && await page.locator('.avp-question').count() === 0,
      'nome que já existe (sem acento, caixa ou espaço a mais) NÃO vira ficha duplicada');
    await page.fill('#sqfNovoItemNome', 'Item Genuinamente Novo');
    await page.click('#sqfNovoItemConfirmar');
    await page.waitForSelector('.avp-question', { timeout: 8000 });
    afirma(/Item Genuinamente Novo/.test(await page.locator('#avaliacoesSquad').innerText()), 'um item realmente novo segue para o checklist');
    await page.click('#sqVoltarListaChecklist');
    if (await page.locator('.sq-modal-confirm-btn').count()) await page.locator('.sq-modal-confirm-btn').click();
    await page.waitForSelector('#sqNovaBtn');

    console.log('\n== Motor de squad legível ==');
    await page.evaluate(() => { location.hash = '#admin'; });
    await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelArquitetura"]', { timeout: 8000 });
    await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
    await page.waitForSelector('#avpMotorSquadInicioBtn', { timeout: 8000 });
    await page.click('#avpMotorSquadInicioBtn');
    await page.waitForSelector('#sqMotorEditarRegrasBtn');
    const antes = await regrasHoje(page);
    afirma(await page.locator('.avp-motor-explica').count() === 1, 'painel traz "Como este motor decide"');
    await page.click('#sqMotorEditarRegrasBtn');
    await page.waitForSelector('.sq-cond-select');
    await page.locator('.avp-motor-explica summary').click();
    const t = await page.locator('.avp-motor-explica').innerText();
    afirma(/Eixo A/.test(t) && /Eixo B/.test(t) && /Combinação/.test(t) && /nunca S1–S8 diretamente/.test(t), 'explica Eixo A, Eixo B e a combinação (sem ler S1–S8 direto)');
    afirma(/Precedência/.test(t) && /S7 = NÃO/.test(t), 'explica a precedência, com o caso do S7');
    afirma(/Independente do motor P1–P16/.test(t), 'diz que é independente do motor P1–P16');
    afirma(/Simular impacto/.test(t) && /não grava nada/i.test(t) && /Rascunho/.test(t) && /reprocessamento/.test(t), 'explica simulação e rascunho × publicação');
    const titulos = await page.evaluate(() => { const o = {}; for (let i = 1; i <= 8; i++) { const q = window.faQuestionarios.conteudoPergunta('ADEQUACAO_SQUAD', 'S' + i); o['S' + i] = { titulo: q.titulo, texto: q.texto }; } return o; });
    const folhas = await page.locator('.sq-cond-folha--legivel:not(.sq-cond-folha--leitura)').evaluateAll((els) => els.map((e) => ({ codigo: e.querySelector('.sq-cond-pergunta strong').textContent, linha: e.querySelector('.sq-cond-pergunta').textContent, texto: (e.querySelector('.sq-cond-texto') || {}).textContent || '' })));
    afirma(folhas.length >= 8 && folhas.every((f) => titulos[f.codigo] && f.linha === f.codigo + ' — ' + titulos[f.codigo].titulo && f.texto === titulos[f.codigo].texto), 'cada condição mostra "Sn — título real" e o texto da pergunta (' + folhas.length + ')');
    const leitura = await page.locator('.sq-cond-folha--leitura').allInnerTexts();
    afirma(leitura.length >= 5 && leitura.every((x) => /Eixo [AB] — /.test(x) && /somente leitura/.test(x)), 'a combinação mostra os resultados dos eixos em leitura (' + leitura.length + ')');
    afirma(await page.locator('.sq-cond-select').count() === folhas.length, 'só as condições sobre S1–S8 têm seletor SIM/NÃO');
    afirma(await page.locator('.sq-regra-codigo').filter({ hasText: 'Forte aderência' }).count() === 1, 'a regra da combinação mostra o resultado por extenso (não o código)');
    afirma(await page.locator('h4', { hasText: 'Eixo A + Eixo B = Indicação organizacional' }).count() === 1, 'o grupo da combinação diz Eixo A + Eixo B = Indicação');
    afirma(await larguraOk(page), 'sem rolagem horizontal na edição');
    await page.click('#sqMotorSimularBtn');
    await page.waitForSelector('.avp-motor-sim-explica', { timeout: 8000 });
    afirma(/ainda são um rascunho/.test(await page.locator('.avp-motor-sim-explica').innerText()), 'a simulação diz que são regras em rascunho');
    await page.click('#sqMotorVoltarLista');
    await page.waitForSelector('#sqMotorCancelarEdicaoBtn');
    await page.click('#sqMotorCancelarEdicaoBtn');
    if (await page.locator('.sq-modal-confirm-btn').count()) await page.locator('.sq-modal-confirm-btn').click();
    await page.waitForSelector('#sqMotorEditarRegrasBtn');
    afirma(await regrasHoje(page) === antes, 'a lógica não mudou: regras publicadas idênticas depois de abrir, ler e simular');
    await ctx.close();
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
  }
  await browser.close();
  console.log('\n============================\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
