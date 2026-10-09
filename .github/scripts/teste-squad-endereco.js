/* Adequação à Squad na área AVALIAÇÃO — identidade e navegação próprias (desktop e 375 px).
 *
 * A Squad mora dentro de #avaliacoes, mas não é Produto/Serviço:
 *   - ao entrar, o cabeçalho da página diz "Adequação à Squad" (e não "Avaliações de Produto/Serviço");
 *     ao sair, o cabeçalho original volta;
 *   - a subtela tem endereço próprio: #avaliacoes?sq=lista e #avaliacoes?sq=<chave>;
 *   - F5 continua na mesma tela de Squad (lista ou a avaliação aberta);
 *   - o Voltar/Avançar do navegador anda entre avaliações → lista de squad → avaliação de squad;
 *   - "← Voltar para Avaliações" é um botão visível no topo e repetido no rodapé;
 *   - link direto com a leitura lenta mostra "Carregando…" e depois a avaliação (nunca "não encontrada"
 *     por não ter esperado);
 *   - link direto / F5 quando avaliacao-squad.js chega ~3 s DEPOIS do roteador e de avaliacao-produto.js
 *     (máquina lenta): o módulo se monta sozinho ao carregar e abre a tela do endereço; montar de novo
 *     (faInitAvaliacaoSquad) devolve a mesma instância, sem listener nem navegação duplicados.
 * Hermético (Firebase falso). */
const { chromium } = require('playwright');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const fs = require('fs');
const path = require('path');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const EM = 'avaliadora@previ.com.br';
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };
const CODIGOS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

function av(i, nome) {
  const respostas = {};
  CODIGOS.forEach((c) => { respostas[c] = { codigoPergunta: c, textoPerguntaNaEpoca: 'Pergunta ' + c, resposta: 'sim', justificativaUsuario: 'ok ' + c, questionnaireContentVersion: 1 }; });
  return { itemNome: nome, itemId: 'i' + i, status: 'concluido', respostas, questionnaireContentVersion: 1, motorSquadVersion: 1,
    necessidadeCapacidadeDedicada: 'DEMONSTRADA', condicoesParaSquad: 'PRESENTES', indicacaoOrganizacional: 'FORTE_ADERENCIA_SQUAD_DEDICADA',
    evidenciasFavoraveis: CODIGOS, pontosADesenvolver: [], criadoPor: { name: 'Avaliadora', email: EM },
    criadoEm: '2026-10-0' + i + 'T10:00:00.000Z', atualizadoEm: '2026-10-0' + i + 'T10:00:00.000Z', dataConclusao: '2026-10-0' + i + 'T11:00:00.000Z', excluido: false };
}

async function abrir(browser, viewport, hash, extra) {
  extra = Object.assign({}, extra || {});
  const atrasarSquad = extra.atrasarSquad; delete extra.atrasarSquad;
  const aut = {}; aut[chave(EM)] = { email: EM, nome: EM, tipo: 'avaliacao', concedidoPor: 'tatianefdirene@previ.com.br', concedidoEm: '2026-10-01T10:00:00.000Z' };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': {}, 'avaliacoes-produto': {},
    'avaliacoes-squad': { sqA: av(1, 'Plataforma de Benefícios'), sqB: av(2, 'Canal de Atendimento') },
    'motor-squad-config': {}, 'motor-arquitetura-config': {}, 'fa-avaliacao-acessos': {}, 'fa-avaliacao-autorizados': aut };
  const ctx = await browser.newContext({ viewport: viewport });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(Object.assign({ db: db, user: { email: EM, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true }, extra || {})) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  /* o arquivo da Squad chega atrasado; o resto (roteador, avaliacao-produto.js) carrega normalmente */
  /* registra, desde o início da carga, se a página #avaliacoes chegou a abrir com Produto/Serviço montado e SEM o módulo da Squad */
  if (atrasarSquad) await ctx.addInitScript('window.__corridaSquad = false; (function olhar() { var p = document.getElementById("page-avaliacoes"); ' +
    'if (p && !p.hidden && typeof window.faInitAvaliacaoProduto === "function" && typeof window.faInitAvaliacaoSquad === "undefined") window.__corridaSquad = true; ' +
    'if (typeof window.faInitAvaliacaoSquad === "undefined") setTimeout(olhar, 50); })();');
  if (atrasarSquad) await page.route('**/forca-agil/avaliacao-squad.js*', async (r) => { await new Promise((ok) => setTimeout(ok, atrasarSquad)); r.continue(); });
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
const hash = (page) => page.evaluate(() => location.hash);
const titulo = (page) => page.evaluate(() => document.querySelector('#page-avaliacoes .page-hero h1').textContent.trim());
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const squadVisivel = (page) => page.evaluate(() => !document.getElementById('avaliacoesSquad').hidden && document.getElementById('avaliacoesPainel').hidden);
const esperarHash = (page, h, descricao) => esperarCondicao(page, (x) => location.hash === x, h, { descricao: descricao || ('o endereço virar ' + h) });

(async () => {
  const browser = await chromium.launch();
  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');
    {
      const { ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes');
      await page.waitForSelector('#avpSquadBtn', { timeout: 8000 });
      afirma(await titulo(page) === 'Avaliações de Produto/Serviço', 'na lista de avaliações o título é o de Produto/Serviço');
      await page.click('#avpSquadBtn');
      await page.waitForSelector('#avaliacoesSquad .sq-act-abrir', { timeout: 8000 });
      afirma(await hash(page) === '#avaliacoes?sq=lista', 'entrar na Squad dá endereço próprio: #avaliacoes?sq=lista (' + await hash(page) + ')');
      afirma(await titulo(page) === 'Adequação à Squad', 'o título da página passa a ser "Adequação à Squad" (' + await titulo(page) + ')');
      afirma(await page.locator('#sqVoltarArquitetura').isVisible() && await page.locator('#sqVoltarArquiteturaRodape').count() === 1, '"← Voltar para Avaliações" no topo e repetido no rodapé');
      const cx = await page.locator('#sqVoltarArquitetura').boundingBox();
      afirma(!!cx && cx.height >= 30 && cx.width >= 120, 'o Voltar do topo é um botão de verdade (' + (cx ? Math.round(cx.width) + '×' + Math.round(cx.height) : '—') + ' px), não um link miúdo');
      afirma(await larguraOk(page), 'lista de squad sem rolagem horizontal');

      console.log('\n== Abrir uma avaliação, F5, Voltar/Avançar do navegador ==');
      await page.click('#avaliacoesSquad .sq-act-abrir[data-key="sqA"]');
      await esperarHash(page, '#avaliacoes?sq=sqA');
      await page.waitForSelector('#avaliacoesSquad #sqVoltarListaResultado', { timeout: 8000 });
      afirma(true, 'abrir uma avaliação de squad muda o endereço para #avaliacoes?sq=sqA');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await esperarSessaoAssentada(page);
      await page.waitForSelector('#avaliacoesSquad #sqVoltarListaResultado', { timeout: 10000 });
      afirma(await hash(page) === '#avaliacoes?sq=sqA' && await squadVisivel(page) && /Plataforma de Benefícios/.test(await page.locator('#avaliacoesSquad').innerText()),
        'F5 na avaliação de squad reabre a MESMA avaliação');
      afirma(await titulo(page) === 'Adequação à Squad', 'e o título continua "Adequação à Squad" depois do F5');
      await page.goBack();
      await esperarHash(page, '#avaliacoes?sq=lista', 'o Voltar do navegador levar à lista de squad');
      await page.waitForSelector('#avaliacoesSquad .sq-act-abrir', { timeout: 8000 });
      afirma(await squadVisivel(page), 'Voltar do navegador: da avaliação para a lista de squad');
      await page.goBack();
      await esperarHash(page, '#avaliacoes', 'o Voltar do navegador sair da Squad');
      await esperarCondicao(page, () => document.getElementById('avaliacoesSquad').hidden, null, { descricao: 'a Squad fechar' });
      afirma(await page.locator('#avaliacoesPainel').isVisible() && await titulo(page) === 'Avaliações de Produto/Serviço', 'Voltar do navegador: da lista de squad para as avaliações, com o título original');
      await page.goForward();
      await esperarHash(page, '#avaliacoes?sq=lista', 'o Avançar voltar à lista de squad');
      await page.waitForSelector('#avaliacoesSquad .sq-act-abrir', { state: 'visible', timeout: 8000 });
      afirma(await titulo(page) === 'Adequação à Squad', 'Avançar do navegador: de volta à lista de squad');

      console.log('\n== "← Voltar" da tela ==');
      await page.click('#avaliacoesSquad .sq-act-abrir[data-key="sqB"]');
      await esperarHash(page, '#avaliacoes?sq=sqB');
      await page.waitForSelector('#avaliacoesSquad #sqVoltarListaResultado');
      await page.click('#avaliacoesSquad #sqVoltarListaResultado');
      await esperarHash(page, '#avaliacoes?sq=lista', 'o "← Voltar" da avaliação levar à lista de squad');
      afirma(true, '"← Voltar" da avaliação de squad leva à lista de squad');
      const tamanhoAntes = await page.evaluate(() => history.length);
      await page.click('#sqVoltarArquiteturaRodape');
      await esperarHash(page, '#avaliacoes', 'o "← Voltar para Avaliações" do rodapé sair da Squad');
      await esperarCondicao(page, () => document.getElementById('avaliacoesSquad').hidden, null, { descricao: 'a Squad fechar' });
      afirma(await page.locator('#avpNovoBtn').isVisible() && await titulo(page) === 'Avaliações de Produto/Serviço', '"← Voltar para Avaliações" do rodapé devolve a lista de avaliações e o título original');
      afirma(await page.evaluate(() => history.length) === tamanhoAntes, 'sem empilhar entrada nova no histórico (o Voltar da tela é o Voltar do navegador)');
      afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
      await ctx.close();
    }
    {
      console.log('\n== Link direto, leitura lenta ==');
      const { ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?sq=sqB', { delays: { 'avaliacoes-squad': 2500 } });
      await page.waitForSelector('#avaliacoesSquad:not([hidden])', { timeout: 8000 });
      afirma(!/não encontrada/i.test(await page.locator('#avaliacoesSquad').innerText()), 'enquanto a leitura não chega: nunca "não encontrada"');
      await page.waitForSelector('#avaliacoesSquad #sqVoltarListaResultado', { timeout: 10000 });
      afirma(/Canal de Atendimento/.test(await page.locator('#avaliacoesSquad').innerText()) && await hash(page) === '#avaliacoes?sq=sqB', 'quando chega: abre a avaliação pedida no endereço');
      await page.click('#avaliacoesSquad #sqVoltarListaResultado');
      await esperarHash(page, '#avaliacoes?sq=lista');
      await page.click('#sqVoltarArquitetura');
      await esperarHash(page, '#avaliacoes', 'sair da Squad sem histórico anterior');
      await esperarCondicao(page, () => document.getElementById('avaliacoesSquad').hidden && !document.getElementById('avaliacoesPainel').hidden, null, { descricao: 'a lista de avaliações voltar' });
      afirma(true, 'chegando por link direto, "← Voltar para Avaliações" ainda leva às avaliações');
      afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
      await ctx.close();
    }
    {
      console.log('\n== Endereço de avaliação que não existe ==');
      const { ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?sq=naoExiste');
      await esperarCondicao(page, () => /não encontrada/i.test(document.getElementById('avaliacoesSquad').innerText), null, { descricao: 'aviso de não encontrada' });
      afirma(await hash(page) === '#avaliacoes?sq=naoExiste', 'avaliação inexistente: aviso claro e o endereço continua o pedido');
      afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
      await ctx.close();
    }
    {
      console.log('\n== Link direto com avaliacao-squad.js chegando ~3 s depois (máquina lenta) ==');
      const { ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?sq=sqA', { atrasarSquad: 3000 });
      /* a corrida aconteceu de verdade: a página #avaliacoes já abriu (Produto/Serviço montado) sem o módulo da Squad */
      await page.waitForFunction(() => typeof window.faInitAvaliacaoSquad === 'function', null, { timeout: 12000 });
      const corrida = await page.evaluate(() => window.__corridaSquad === true);
      afirma(corrida, 'reproduz a corrida: #avaliacoes aberta e avaliacao-produto.js carregado ANTES de avaliacao-squad.js');
      await page.waitForSelector('#avaliacoesSquad #sqVoltarListaResultado', { timeout: 12000 }).catch(() => {});
      afirma(await squadVisivel(page) && /Plataforma de Benefícios/.test(await page.locator('#avaliacoesSquad').innerText()) && (await page.locator('#avaliacoesSquad #sqVoltarListaResultado').count()) === 1,
        'quando o arquivo chega, a avaliação pedida (sqA) abre sozinha e o painel de Produto/Serviço fica oculto');
      afirma(await hash(page) === '#avaliacoes?sq=sqA', 'o endereço continua #avaliacoes?sq=sqA (' + await hash(page) + ')');
      afirma(await titulo(page) === 'Adequação à Squad', 'o título é "Adequação à Squad" (' + await titulo(page) + ')');
      /* idempotência: montar de novo não cria outra instância nem duplica a navegação */
      const mesma = await page.evaluate(() => { const a = window.faAvaliacaoSquad; window.faInitAvaliacaoSquad({ modo: 'operacional' }); window.faInitAvaliacaoSquad({ modo: 'operacional' }); return !!a && window.faAvaliacaoSquad === a; });
      afirma(mesma, 'faInitAvaliacaoSquad({modo:"operacional"}) chamado de novo devolve a MESMA instância');
      const antes = await page.evaluate(() => history.length);
      await page.click('#avaliacoesSquad #sqVoltarListaResultado');
      await esperarHash(page, '#avaliacoes?sq=lista');
      await page.waitForSelector('#avaliacoesSquad .sq-act-abrir', { timeout: 8000 });
      const depois = await page.evaluate(() => history.length);
      afirma(depois - antes === 1 && (await page.locator('#avaliacoesSquad #sqVoltarArquitetura').count()) === 1, 'depois de montar de novo, "voltar à lista" anda UMA entrada só no histórico e a tela não se duplica (' + (depois - antes) + ')');
      await page.goBack();
      await esperarHash(page, '#avaliacoes?sq=sqA', 'o Voltar do navegador voltar à avaliação');
      await page.waitForSelector('#avaliacoesSquad #sqVoltarListaResultado', { timeout: 8000 });
      afirma(/Plataforma de Benefícios/.test(await page.locator('#avaliacoesSquad').innerText()), 'Voltar do navegador reabre a avaliação, uma vez só');
      afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
      await ctx.close();
    }
    {
      console.log('\n== Lista da Squad com avaliacao-squad.js chegando ~3 s depois ==');
      const { ctx, page, erros } = await abrir(browser, viewport, '#avaliacoes?sq=lista', { atrasarSquad: 3000 });
      await page.waitForSelector('#avaliacoesSquad .sq-act-abrir', { timeout: 12000 }).catch(() => {});
      afirma(await squadVisivel(page) && (await page.locator('#avaliacoesSquad .sq-act-abrir').count()) === 2 && await hash(page) === '#avaliacoes?sq=lista' && await titulo(page) === 'Adequação à Squad',
        'a lista da Squad abre sozinha, no endereço #avaliacoes?sq=lista, com o título "Adequação à Squad"');
      afirma(await larguraOk(page), 'sem rolagem horizontal');
      afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
      await ctx.close();
    }
  }
  await browser.close();
  console.log('\n============================\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
