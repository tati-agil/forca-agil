/* Ajustes de usabilidade da lista/detalhe da Avaliação de Produto/Serviço
 * (prompt complementar após a revisão das telas):
 *   1. filtros com rótulo próprio — "Resultado Produto/Serviço" ≠ "Classificação
 *      arquitetural", só com os valores que o sistema realmente grava;
 *   2. ajuda contextual da decisão manual e da especialização, fiel à regra real;
 *   3. PDFs em lote: "todas do resultado atual" e "só as selecionadas"; o PDF
 *      individual continua existindo;
 *   4. "← Voltar para avaliações" explícito nas telas de detalhe, preservando
 *      filtros e posição da lista;
 *   5. REAVALIAR à vista no detalhe: nunca sobrescreve a avaliação anterior —
 *      cria a versão seguinte do mesmo item, com quem avaliou e quando, e a
 *      anterior fica intacta e consultável no histórico.
 * Desktop e celular (375 px). Hermético: sem rede, sem segredo. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const RAIZ = path.join(__dirname, '..', '..', 'forca-agil');
const MOTOR_VERSION = /var MOTOR_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(RAIZ, 'avaliacao-produto.js'), 'utf8'))[1];
const EMAIL = 'gestora@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const ORDEM = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao', 'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };

let falhas = 0;
function afirma(cond, msg) { console.log((cond ? '  ok    ' : '  FALHA ') + msg); if (!cond) falhas++; }

function item(nome, i, extra) {
  const respostas = {};
  ORDEM.forEach((id, n) => { respostas[id] = { valor: n < 5 ? 'sim' : 'nao', observacao: '', justificativaAuto: 'interpretação ' + id, codigoPergunta: 'P', textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 }; });
  const n = String(i).padStart(2, '0');
  return Object.assign({
    nome: nome, descricao: 'desc ' + i, publico: '', necessidade: '', observacoesGerais: '',
    status: 'concluido', respostas: respostas, resultadoAutomatico: 'produto', decisaoFinal: 'produto', decisaoManual: false,
    camadaSugerida: { id: 'produto-principal', label: 'Produto/Serviço principal', motivos: ['m1'], conflito: null, incoerencia: false, especializacao: null, papelEstrutural: null, relacao: null },
    justificativaAutomatica: 'justificativa gerada ' + i, criteriosEssenciaisFalhos: ['x'], exclusoesConflitantes: null, criteriosAtendidos: 5,
    motorVersion: MOTOR_VERSION, motorVersionArquitetura: 1, questionnaireContentVersion: 1,
    criadoEm: '2026-03-15T10:00:' + n + '.000Z', atualizadoEm: '2026-03-15T10:00:' + n + '.000Z',
    responsavel: { name: 'Avaliadora Antiga', email: 'antiga@previ.com.br' }, itemId: 'k' + i, versao: 1, versaoAnteriorKey: null, excluido: false
  }, extra || {});
}
const camada = (id, label) => ({ id: id, label: label, motivos: ['m'], conflito: null, incoerencia: false, especializacao: null, papelEstrutural: null, relacao: null });
const AVALIACOES = () => ({
  k1: item('Item Produto', 1),
  k2: item('Item Componente', 2, { resultadoAutomatico: 'nao-produto', decisaoFinal: 'nao-produto', camadaSugerida: camada('componente', 'Componente') }),
  k3: item('Item Canal', 3, { resultadoAutomatico: 'nao-produto', decisaoFinal: 'nao-produto', camadaSugerida: camada('canal', 'Canal') }),
  k4: item('Item Rascunho', 4, { status: 'rascunho', resultadoAutomatico: null, decisaoFinal: null, camadaSugerida: null })
});

async function abrir(browser, viewport) {
  const acessos = {}; acessos[chave(EMAIL)] = { email: EMAIL, tipo: 'avaliacao' };
  const db = { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': {}, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-espera': {},
    'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {}, eventos: {}, 'turmas-publico': {}, 'eventos-publico': {},
    'avaliacoes-produto': AVALIACOES(), 'avaliacoes-squad': {}, 'motor-squad-config': {}, 'motor-squad-auditoria': {},
    'motor-arquitetura-config': {}, 'motor-arquitetura-auditoria': {}, 'fa-avaliacao-autorizados': acessos };
  const cfg = { db: db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport: viewport || DESKTOP, acceptDownloads: true });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#avaliacoes', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.body.classList.contains('aguardando-auth'), { timeout: 16000 }).catch(() => {});
  await page.waitForSelector('#avaliacoesPainel .avp-table tbody tr', { timeout: 8000 });
  await page.waitForFunction(() => !document.querySelector('.avp-tag-motor--verificando'), { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
  return { ctx, page, erros };
}
async function abrirFiltros(page) { if (!(await page.locator('#avpFiltrosPainel').count())) await page.click('#avpFiltrosBtn'); await page.waitForSelector('#avpFiltrosPainel'); }
const contar = (page, sel) => page.locator(sel).count();
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const linhas = (page) => contar(page, '#avaliacoesPainel .avp-table tbody tr');
const opcoes = (page, sel) => page.locator(sel + ' option').allInnerTexts();

(async () => {
  const browser = await chromium.launch();

  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros } = await abrir(browser, viewport);

    console.log('\n== 1. Filtros: Resultado Produto/Serviço ≠ Classificação arquitetural ==');
    await abrirFiltros(page);
    const rotulos = await page.locator('.avp-filtro-rotulo').allInnerTexts();
    const rotulosTxt = await page.locator('.avp-filtro-rotulo').allTextContents();
    afirma(rotulosTxt.indexOf('Resultado Produto/Serviço') !== -1 && rotulosTxt.indexOf('Classificação arquitetural') !== -1, 'cada filtro tem rótulo visível: ' + rotulosTxt.join(' | '));
    afirma(!/Todos os resultados/.test(await page.locator('#avaliacoesPainel').innerText()), '"Todos os resultados" não aparece mais');
    afirma(JSON.stringify(await opcoes(page, '#avpFiltroResultado')) === JSON.stringify(['Todos', 'É Produto/Serviço principal', 'Não é Produto/Serviço principal', 'A validar']),
      'Resultado Produto/Serviço: só os 3 resultados que o sistema grava (produto, nao-produto, a-validar) — ' + (await opcoes(page, '#avpFiltroResultado')).join(' / '));
    const cl = await opcoes(page, '#avpFiltroAlternativa');
    afirma(cl.length === 12 && cl[0] === 'Todas' && cl.indexOf('Componente') !== -1 && cl.indexOf('Canal') !== -1 && cl.indexOf('A validar') !== -1, 'Classificação arquitetural: "Todas" + as 11 camadas reais (' + cl.length + ')');
    afirma(/resultado Produto\/Serviço[\s\S]*classificação arquitetural[\s\S]*coisas diferentes/i.test(await page.locator('.avp-filtros-ajuda').innerText()), 'texto de ajuda explica a diferença');
    afirma(await linhas(page) === 4, 'sem filtro: as 4 avaliações');
    await page.selectOption('#avpFiltroResultado', 'nao-produto');
    afirma(await linhas(page) === 2, 'Resultado = Não é Produto/Serviço principal: 2 (Componente e Canal)');
    await page.selectOption('#avpFiltroAlternativa', 'Componente');
    afirma(await linhas(page) === 1, 'combinado com Classificação = Componente: 1');
    afirma(await larguraOk(page), 'sem rolagem horizontal da página');

    console.log('\n== 2. Pesquisa, contador, "Filtros (n)", Limpar filtros e estados vazios ==');
    afirma(/^1 de 4 avaliações$/.test((await page.locator("#avpContador").innerText()).trim()), 'contador com filtros aplicados: "1 de 4 avaliações"');
    afirma(/^Filtros \(2\)$/i.test((await page.locator('#avpFiltrosBtn').innerText()).trim()), 'botão "Filtros (2)" conta os filtros ativos');
    await page.click('#avpLimparFiltros');
    afirma(/^4 avaliações$/.test((await page.locator('#avpContador').innerText()).trim()) && /^Filtros$/i.test((await page.locator('#avpFiltrosBtn').innerText()).trim()), '"Limpar filtros": volta a "4 avaliações" e "Filtros"');
    afirma(await page.locator('#avpBusca').getAttribute('placeholder') === 'Pesquisar por nome ou item...', 'campo "Pesquisar por nome ou item..."');
    await page.fill('#avpBusca', 'canal');
    afirma(await linhas(page) === 1 && /^1 de 4 avaliações$/.test((await page.locator('#avpContador').innerText()).trim()), 'pesquisar "canal": 1 linha e "1 de 4 avaliações"');
    await page.fill('#avpBusca', 'ITEM COMPONENTE');
    afirma(await linhas(page) === 1, 'a pesquisa ignora maiúsculas');
    afirma(await page.evaluate(() => document.activeElement && document.activeElement.id === 'avpBusca'), 'o campo de pesquisa mantém o foco enquanto se digita');
    await page.fill('#avpBusca', 'zzz');
    afirma(await contar(page, '#avpVazioBusca') === 1 && /Nenhuma avaliação encontrada/.test(await page.locator('#avpVazioBusca').innerText()), 'sem resultado: "Nenhuma avaliação encontrada…" com botão de limpar');
    await page.click('#avpLimparFiltrosVazio');
    afirma(await linhas(page) === 4 && await page.locator('#avpBusca').inputValue() === '', 'limpar pela mensagem vazia devolve as 4 e esvazia a pesquisa');
    await page.selectOption('#avpFiltroResultado', 'nao-produto');
    await page.selectOption('#avpFiltroAlternativa', 'Componente');

    console.log('\n== Hierarquia visual: amarelo só na ação principal ==');
    const cores = await page.evaluate(() => {
      const bg = (el) => getComputedStyle(el).backgroundColor;
      return { novo: bg(document.querySelector('#avpNovoBtn')), abrir: bg(document.querySelector('.avp-act-ver')), mais: bg(document.querySelector('.avp-act-mais')),
               lixeira: bg(document.querySelector('#avpLixeiraBtn')), textoAbrir: document.querySelector('.avp-act-ver').textContent.trim() };
    });
    afirma(cores.textoAbrir === 'Abrir', 'ação da linha concluída chama-se "Abrir"');
    afirma(cores.abrir !== cores.novo && cores.mais !== cores.novo && cores.lixeira !== cores.novo, 'só "+ Avaliar novo item" tem o fundo de ação principal; Abrir, ⋯ e Lixeira são neutros');

    console.log('\n== 3. PDFs em lote (escopo claro) ==');
    await page.click('#avpExportarBtn');
    let escopo = await page.locator('.avp-exportar-escopo').innerText();
    afirma(/1 avaliação/.test(escopo) && /filtros aplicados/.test(escopo), 'o menu diz o escopo: "' + escopo.trim() + '"');
    afirma(await contar(page, '#avpExportarPdfFiltrados') === 1 && /\(1 concluída\)/i.test(await page.locator('#avpExportarPdfFiltrados').innerText()), 'PDFs — todas do resultado atual (1 concluída)');
    afirma(await contar(page, '#avpExportarPdfSelecionadas') === 0, 'sem seleção, não oferece "só as selecionadas"');
    let [dl] = await Promise.all([page.waitForEvent('download', { timeout: 40000 }).catch(() => null), page.click('#avpExportarPdfFiltrados')]);
    afirma(dl && /^Avaliacoes_Produto_Servico_Filtradas_/.test(dl.suggestedFilename()) || (dl && /^Avaliacao_Produto_Servico_/.test(dl.suggestedFilename())), 'baixou o PDF do resultado atual: ' + (dl && dl.suggestedFilename()));
    await page.waitForFunction(() => !/Gerando arquivo/.test(document.body.innerText), { timeout: 20000 }).catch(() => {});
    await page.selectOption('#avpFiltroResultado', 'todos');
    await page.selectOption('#avpFiltroAlternativa', 'todos');
    await page.click('#avpExportarBtn');
    afirma(/3 concluída/i.test(await page.locator('#avpExportarPdfFiltrados').innerText()) && /sem filtros/.test(await page.locator('.avp-exportar-escopo').innerText()), 'sem filtros: todas as concluídas (3) — o rascunho não entra');
    await page.click('#avpExportarBtn');
    await page.check('.avp-check-item[data-key="k1"]');
    await page.check('.avp-check-item[data-key="k2"]');
    await page.click('#avpExportarBtn');
    afirma(/\(2\)/.test(await page.locator('#avpExportarPdfSelecionadas').innerText()), 'com 2 marcadas: "só as selecionadas (2)"');
    [dl] = await Promise.all([page.waitForEvent('download', { timeout: 40000 }).catch(() => null), page.click('#avpExportarPdfSelecionadas')]);
    afirma(dl && /^Avaliacoes_Produto_Servico_Selecionadas_/.test(dl.suggestedFilename()), 'baixou um PDF único com as selecionadas: ' + (dl && dl.suggestedFilename()));
    await page.waitForFunction(() => !/Gerando arquivo/.test(document.body.innerText), { timeout: 20000 }).catch(() => {});

    console.log('\n== 4/5. Detalhe: voltar explícito, filtros preservados, REAVALIAR à vista ==');
    await page.selectOption('#avpFiltroResultado', 'nao-produto');
    const antesLinhas = await linhas(page);
    await page.locator('.avp-act-ver[data-key="k2"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const yAntes = await page.evaluate(() => Math.round(window.pageYOffset));
    await page.click('.avp-act-ver[data-key="k2"]');
    await page.waitForSelector('#avpVoltarListaResultado');
    afirma(/← Voltar para avaliações/i.test(await page.locator('#avpVoltarListaResultado').innerText()), 'link "← Voltar para avaliações" no topo do detalhe');
    afirma(/← Voltar para avaliações/i.test(await page.locator('#avpVoltarListaRodape').innerText()), 'e também no rodapé');
    afirma(await page.evaluate(() => window.pageYOffset) === 0, 'o detalhe abre no topo');
    afirma(await contar(page, '#avpReavaliarBtn') === 1 && /^Reavaliar$/i.test((await page.locator('#avpReavaliarBtn').innerText()).trim()), 'botão "Reavaliar" (não "Refazer") no detalhe');
    const caixaR = await page.locator('#avpReavaliarBtn').boundingBox();
    const caixaRes = await page.locator('.avp-result-card').boundingBox();
    afirma(caixaR && caixaRes && caixaR.y < caixaRes.y && await page.locator('#avpCabecalhoFicha #avpReavaliarBtn').count() === 1, 'Reavaliar é ação do item: fica no cabeçalho, acima do Resultado (à vista, sem rolar até o rodapé)');
    afirma(/versão v2/.test(await page.locator('.avp-reavaliar-texto').innerText()) && /continua guardada/.test(await page.locator('.avp-reavaliar-texto').innerText()), 'explica: abre a v2 e a atual fica guardada');
    afirma(/decisão final é registrada|só a decisão final/.test(await page.locator('#avpDecisaoAjuda').textContent()) && /duas possibilidades/.test(await page.locator('#avpDecisaoAjuda').textContent()), 'decisão manual: ajuda com as duas possibilidades e o que muda');
    afirma(!/use "Reavaliar" na lista/.test(await page.locator('body').innerText()), 'texto da decisão não manda procurar "Reavaliar" na lista');
    afirma(await larguraOk(page), 'detalhe sem rolagem horizontal');
    await page.click('#avpVoltarListaResultado');
    await page.waitForSelector('#avpFiltroResultado');
    await page.waitForTimeout(200);
    afirma(await page.locator('#avpFiltroResultado').inputValue() === 'nao-produto' && await linhas(page) === antesLinhas, 'ao voltar, o filtro continua aplicado (' + antesLinhas + ' linhas)');
    const yDepois = await page.evaluate(() => Math.round(window.pageYOffset));
    /* a altura do quadro da tabela depende da rolagem, então o limite da página pode variar alguns pixels */
    afirma(Math.abs(yDepois - yAntes) <= 40, 'ao voltar, a lista volta à posição de antes (' + yAntes + ' → ' + yDepois + ')');
    await page.selectOption('#avpFiltroResultado', 'todos');

    console.log('\n== 5. REAVALIAR cria a v2 e preserva a v1 ==');
    const antes = await banco(page);
    await page.click('.avp-act-ver[data-key="k1"]');
    await page.waitForSelector('#avpReavaliarBtn');
    await page.click('#avpReavaliarBtn');
    await page.waitForSelector('#avpConcluirBtn');
    afirma(/← Voltar para a avaliação \(v1\)/i.test(await page.locator('#avpVoltarLista').innerText()), 'checklist da reavaliação tem o Voltar com o destino: "← Voltar para a avaliação (v1)" (de onde a reavaliação começou)');
    afirma(await page.locator('#avpQuestion-solucao .avp-choice-btn--sim.active').count() === 1, 'a reavaliação parte das respostas anteriores (todas as perguntas podem ser mudadas)');
    await page.locator('#avpQuestion-solucao .avp-choice-btn--nao').click();
    await page.locator('#avpQuestion-autonomia .avp-choice-btn--nao').click();
    await page.click('#avpConcluirBtn');
    await page.waitForSelector('#avpVoltarListaResultado', { timeout: 8000 });
    await page.waitForTimeout(300);
    const dep = await banco(page);
    const av = dep['avaliacoes-produto'];
    const novas = Object.keys(av).filter((k) => !antes['avaliacoes-produto'][k]);
    afirma(novas.length === 1, 'nasceu UMA avaliação nova (chave nova): ' + novas.join(','));
    afirma(JSON.stringify(av.k1) === JSON.stringify(antes['avaliacoes-produto'].k1), 'a avaliação anterior (v1) ficou IDÊNTICA — respostas, resultado, classificação, autoria, datas');
    const v2 = av[novas[0]] || {};
    afirma(v2.versao === 2 && v2.versaoAnteriorKey === 'k1' && v2.itemId === 'k1', 'v2 aponta para a v1 (versao 2, versaoAnteriorKey k1, mesmo itemId)');
    afirma(v2.responsavel && v2.responsavel.email === EMAIL, 'registra quem reavaliou: ' + (v2.responsavel && v2.responsavel.email));
    afirma(!!v2.criadoEm && v2.criadoEm > antes['avaliacoes-produto'].k1.criadoEm, 'registra a data/hora da nova avaliação');
    afirma(v2.status === 'concluido' && v2.resultadoAutomatico && v2.resultadoAutomatico !== 'produto', 'recalculou pelo motor a partir das NOVAS respostas: ' + v2.resultadoAutomatico + ' (a v1 era "produto")');
    afirma(v2.camadaSugerida && v2.camadaSugerida.id !== 'produto-principal', 'e a classificação pode mudar: ' + (v2.camadaSugerida && v2.camadaSugerida.label) + ' (a v1 era Produto/Serviço principal)');
    /* concluir SUBSTITUI a entrada do checklist: o Voltar leva à avaliação de onde a reavaliação começou (v1, agora
       "versão anterior") e, dali, à lista */
    await page.click('#avpVoltarListaResultado');
    await page.waitForSelector('#avpAvisoVersaoAnterior', { timeout: 8000 });
    await page.click('#avpVoltarListaResultado');
    await page.waitForSelector('#avpFiltroResultado');
    afirma(await contar(page, '.avp-act-ver[data-key="k1"]') === 0 && await contar(page, '.avp-act-ver[data-key="' + novas[0] + '"]') === 1, 'a lista mostra só a mais recente (situação vigente); a v1 sai da lista, não do banco');
    await page.click('.avp-act-mais[data-key="' + novas[0] + '"]');
    await page.click('.avp-menu-item[data-acao="historico"]');
    await page.waitForSelector('.avp-historico-lista');
    const hist = await page.locator('.avp-historico-lista').innerText();
    afirma(/Avaliação 1/.test(hist) && /Reavaliação 2/.test(hist), 'o histórico lista a avaliação 1 e a reavaliação 2 (com data e quem avaliou)');
    await page.click('#avpHistoricoFechar');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  await browser.close();
  console.log('\n============================');
  console.log(falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
