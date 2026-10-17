/* Navegação do Admin da Avaliação de Produto/Serviço (PR 3 do prompt consolidado):
 *   - tela inicial organizada em grupos: Configuração das Avaliações (um grupo por avaliação — P1–P16, O1–O9, S1–S8 —, cada um com Questionário | Motor, num
 *     só lugar, dentro de Configuração das Avaliações) / Cadastros de Estruturas Organizacionais / Documentação (Documentos de referência; as Naturezas Complementares foram retiradas) / Acessos (Permissões
 *     de usuários e Disponibilidade de funcionalidades, com a Análise Organizacional) — só organização, as mesmas telas;
 *   - TODA subtela tem um "← Voltar para <tela pai>" explícito, que sobe UM nível;
 *   - sair de uma tela de edição com alteração não salva pede confirmação
 *     (e não pede quando nada foi alterado).
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
    'avaliacoes-produto': {}, 'avaliacoes-squad': {}, 'motor-squad-config': {}, 'motor-squad-auditoria': {},
    'motor-arquitetura-config': {}, 'motor-arquitetura-auditoria': {}, 'fa-avaliacao-acessos': {} };
  const cfg = { db: db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport: viewport });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page); /* login decidido e acessos resolvidos (antes: opções no lugar do argumento, engolida) */
  await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelArquitetura"]', { timeout: 8000 });
  await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
  await page.waitForSelector('#avpQuestP1P16Btn', { timeout: 8000 });
  return { ctx, page, erros };
}
const visivel = (page, sel) => page.locator(sel).first().isVisible();
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const texto = async (page, sel) => (await page.locator(sel).first().textContent()).trim();
/* clica no "← Voltar para …" visível e confere o rótulo */
async function conferirVoltar(page, sel, rotuloEsperado, descricao) {
  const t = await texto(page, sel);
  afirma(t === '← Voltar para ' + rotuloEsperado, descricao + ': "' + t + '"');
  afirma(await visivel(page, sel), descricao + ': botão visível');
}

(async () => {
  const browser = await chromium.launch();
  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros } = await abrir(browser, viewport);

    console.log('\n== Tela inicial: Configuração das Avaliações, Cadastros de Estruturas, complementares, Acessos e Referências ==');
    const titulos = await page.locator('#adminAvaliacaoProduto .avp-admin-secao > summary .avp-admin-secao-titulo').allTextContents();
    afirma(JSON.stringify(titulos) === JSON.stringify(['Mapa da Floresta', 'Configuração das Avaliações', 'Cadastros de Estruturas Organizacionais', 'Documentação', 'Acessos']), 'seções: ' + titulos.join(' | '));
    const grupo = (n) => page.locator('#adminAvaliacaoProduto .avp-admin-secao').nth(n + 1);
    /* Configuração das Avaliações: um grupo por avaliação, cada um com Questionário | Motor (nada de lista intermediária) */
    afirma(JSON.stringify(await grupo(0).locator('.avp-admin-aval-titulo').allTextContents()) === JSON.stringify(['Produto/Serviço P1–P16', 'Posicionamento Organizacional O1–O9', 'Adequação à Gestão por Squad S1–S8']),
      'Configuração das Avaliações: três grupos, um por avaliação');
    afirma(await grupo(0).locator('#avpAvalP1P16 #avpQuestP1P16Btn, #avpAvalP1P16 #avpConfigMotoresBtn, #avpAvalO1O9 #avpQuestO1O9Btn, #avpAvalO1O9 #avpMotorPosicionamentoInicioBtn, #avpAvalS1S8 #avpQuestS1S8Btn, #avpAvalS1S8 #avpMotorSquadInicioBtn').count() === 6 &&
      JSON.stringify(await grupo(0).locator('.avp-admin-acesso strong').allTextContents()) === JSON.stringify(['Questionário', 'Motor', 'Questionário', 'Motor', 'Questionário', 'Motor']),
      'cada grupo: Questionário e Motor da própria avaliação');
    afirma(await grupo(1).locator('#avpEstruturaAtualBtn').count() === 1 && (await grupo(1).locator('#avpEstruturaAtualBtn strong').innerText()) === 'Estrutura Organizacional Atual' &&
      /unidades que existem hoje/.test(await grupo(1).locator('#avpEstruturaAtualBtn').innerText()), 'Cadastros de Estruturas Organizacionais: a Estrutura Organizacional Atual, com descrição curta');
    afirma(await page.locator('#avpConfigNaturezasBtn').count() === 0 && (await grupo(2).getAttribute('class')).includes('avp-admin-grupo--discreto') && !/Naturez/i.test(await page.locator('#adminAvaliacaoProduto').innerText()),
      'Naturezas Complementares retiradas: nenhum cartão nem menção no ADMIN; Documentação continua em grupo discreto');
    /* sem repetição: nenhum grupo com um único cartão de mesmo nome; nenhum "Onde aparece" repetindo o que o cartão diz */
    const repetidos = await page.evaluate(() => [...document.querySelectorAll('#adminAvaliacaoProduto .avp-admin-secao')].filter((g) => { const t = g.querySelector('.avp-admin-secao-titulo').textContent.trim().toLowerCase(); return [...g.querySelectorAll('.avp-admin-card strong')].some((c) => c.textContent.trim().toLowerCase() === t); }).map((g) => g.querySelector('h4').textContent));
    afirma(!repetidos.length && await page.locator('#adminAvaliacaoProduto .avp-admin-grupo-uso').count() === 0, 'sem título repetido entre grupo e cartão, sem "Onde aparece" repetido', repetidos);
    afirma(/Realizar avaliações é na área Avaliação do menu/.test(await page.locator('#avpGrupoConfiguracao > summary').innerText()) && /Taxonomia/.test(await page.locator('#adminPanelArquitetura').innerText()), 'I1: onde se avalia e onde ficam os conceitos (Taxonomia), sem parágrafo à parte');
    afirma(await grupo(3).locator('#avpUsuariosBtn').count() === 1 && await page.locator('#anHabilitacaoAdmin, #anHabilitacao').count() === 0 &&
      /quem acessa cada funcionalidade/.test(await grupo(3).innerText()) && !/Disponibilidade/.test(await grupo(3).innerText()), 'Acessos: só as permissões (Usuários autorizados), sem o antigo controle de disponibilidade da Porta 2');
    afirma(await grupo(2).locator('#avpDocumentacaoBtn').count() === 1 && (await grupo(2).locator('#avpDocumentacaoBtn strong').innerText()) === 'Documentos de referência', 'Documentação: os Documentos de referência');
    /* O1–O9: o atalho abre a MESMA área dos motores, já no cartão do Posicionamento; o Voltar dela volta ao início */
    await page.click('#avpMotorPosicionamentoInicioBtn');
    await page.waitForSelector('#avpMotorPosicionamento', { timeout: 8000 });
    afirma(await page.evaluate(() => { const r = document.getElementById('avpMotorPosicionamento').getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0; }), 'Posicionamento (O1–O9): abre a área dos motores no cartão dele, à vista');
    await page.click('#avpMotoresVoltarLista');
    await page.waitForSelector('#avpMotorPosicionamentoInicioBtn', { timeout: 8000 });
    afirma(true, 'o Voltar da área dos motores volta ao início de Avaliações e Mapa');
    afirma(await page.locator('#adminPanelArquitetura .avp-panel-titulo').innerText() === 'Administração das Avaliações e do Mapa da Floresta', 'o título da área é "Administração das Avaliações e do Mapa da Floresta"');
    afirma(await larguraOk(page), 'sem rolagem horizontal');

    console.log('\n== Questionários ==');
    await page.click('#avpQuestP1P16Btn');
    await conferirVoltar(page, '#avpConfigVoltar', 'Avaliações e Mapa', 'lista de questionários');
    await page.click('.avp-config-editar-btn >> nth=0');
    await page.waitForSelector('#avpCfgSalvarRascunhoBtn');
    await conferirVoltar(page, '#avpConfigVoltar', 'Questionário P1–P16', 'edição do questionário (topo)');
    await conferirVoltar(page, '#avpCfgVoltarListaBtn', 'Questionário P1–P16', 'edição do questionário (rodapé)');
    afirma(await larguraOk(page), 'sem rolagem horizontal na edição');
    /* sem alteração: sai sem perguntar e cai na lista de questionários (um nível) */
    await page.click('#avpConfigVoltar');
    afirma(await page.locator('.avp-modal-confirm-btn').count() === 0, 'sem alteração: nenhum aviso ao sair');
    afirma(await page.locator('.avp-config-editar-btn').count() >= 1 && await page.locator('#avpConfigVoltar').count() === 1, 'subiu UM nível: lista de questionários');
    /* com alteração: avisa; "Cancelar" fica; "Confirmar" sai */
    await page.click('.avp-config-editar-btn >> nth=0');
    await page.waitForSelector('#avpCfgSalvarRascunhoBtn');
    await page.locator('[data-campo]').first().fill('texto alterado pela revisão');
    await page.click('#avpConfigVoltar');
    afirma(await page.locator('.avp-modal-confirm-btn').count() === 1, 'com alteração não salva: pede confirmação antes de sair');
    afirma(/ainda não foram salvas/.test(await page.locator('.modal-overlay .modal-box:has(.avp-modal-confirm-btn)').innerText()), 'o aviso diz que há alterações não salvas');
    await page.click('.avp-modal-cancel-btn');
    afirma(await page.locator('#avpCfgSalvarRascunhoBtn').count() === 1, 'Cancelar: continua na edição, sem perder o que foi digitado');
    afirma((await page.locator('[data-campo]').first().inputValue()) === 'texto alterado pela revisão', 'o texto digitado continua lá');
    await page.click('#avpCfgVoltarListaBtn');
    afirma(await page.locator('.avp-modal-confirm-btn').count() === 1, 'rodapé também avisa');
    await page.click('.avp-modal-confirm-btn');
    afirma(await page.locator('.avp-config-editar-btn').count() >= 1, 'Confirmar: volta para a lista de questionários');
    await page.click('.avp-config-auditoria-btn >> nth=0');
    await page.waitForSelector('#avpCfgAuditoriaVoltarBtn');
    await conferirVoltar(page, '#avpConfigVoltar', 'Questionário P1–P16', 'histórico do questionário (topo)');
    await conferirVoltar(page, '#avpCfgAuditoriaVoltarBtn', 'Questionário P1–P16', 'histórico do questionário (rodapé)');
    await page.click('#avpConfigVoltar');
    await page.click('#avpConfigVoltar');
    await page.waitForSelector('#avpQuestP1P16Btn');
    afirma(true, 'dois cliques em "Voltar" chegam à tela inicial do Admin');

    console.log('\n== Motores ==');
    await page.click('#avpConfigMotoresBtn');
    await page.waitForSelector('#avpMotorArqEditarBtn');
    await conferirVoltar(page, '#avpMotoresVoltarLista', 'Avaliações e Mapa', 'painel dos motores');
    afirma(await page.locator('#avpMotoresVoltarRodape').count() === 0, 'um "← Voltar" só (o do topo): o painel do motor é curto, com os detalhes recolhidos');
    /* os três motores no mesmo cabeçalho; versões anteriores e histórico recolhidos na própria tela (sem subtelas) */
    afirma(await page.locator('.avp-motores-aba, [role="tablist"]').count() === 0 && (await page.locator('#avpMotorArquiteturalTitulo').innerText()).startsWith('Produto/Serviço'),
      'o cartão abre direto o motor escolhido: sem uma segunda seleção dos três motores; o título é o do motor');
    afirma(!(await page.evaluate(() => document.getElementById('avpMotorArquiteturalDecide').open)) && /O que classifica/.test(await page.locator('#avpMotorArquiteturalDecide').textContent()), '"Como este motor decide" (P1–P16) recolhido, com a explicação do próprio motor');
    afirma(await page.locator('#avpMotorArqVersoes').count() === 0, 'só a versão vigente: sem a seção "Versões anteriores"');
    await page.click('#avpMotorArqHistorico > summary');
    await page.waitForFunction(() => /Histórico de alterações — /.test((document.querySelector('#avpMotorArqHistorico > summary') || {}).textContent || ''), null, { timeout: 8000 });
    afirma(await page.evaluate(() => document.getElementById('avpMotorArqHistorico').open), 'Histórico de alterações: recolhido, lido ao abrir, continua aberto depois de carregar');
    /* para outro motor: Voltar ao início e escolher o cartão dele (uma escolha só) */
    await page.click('#avpMotoresVoltarLista');
    await page.waitForSelector('#avpMotorPosicionamentoInicioBtn', { state: 'visible' });
    afirma(await page.evaluate(() => document.getElementById('avpGrupoConfiguracao').open), '"← Voltar": Avaliações e Mapa, com o grupo dos três motores aberto');
    await page.click('#avpMotorPosicionamentoInicioBtn');
    await page.waitForSelector('#avpMotorPosicionamento');
    afirma(await page.evaluate(() => location.hash) === '#admin?arq=motores&m=o' && await page.locator('#avpMotorArquitetural').count() === 0, 'cartão O1–O9: só o Posicionamento, em #admin?arq=motores&m=o');
    await page.click('#avpMotoresVoltarLista');
    await page.waitForSelector('#avpConfigMotoresBtn', { state: 'visible' });
    await page.click('#avpConfigMotoresBtn');
    await page.waitForSelector('#avpMotorArqEditarBtn');
    /* editar regras → simular → voltar para editar → voltar */
    await page.click('#avpMotorArqEditarBtn');
    await page.waitForSelector('#avpMotorArqSimularBtn');
    await conferirVoltar(page, '#avpMotoresVoltarLista', 'Produto/Serviço (P1–P16)', 'editar regras (topo)');
    await conferirVoltar(page, '#avpMotorArqCancelarBtn', 'Produto/Serviço (P1–P16)', 'editar regras (rodapé)');
    await page.click('#avpMotoresVoltarLista');
    afirma(await page.locator('.avp-modal-confirm-btn').count() === 0 && await page.locator('#avpMotorArqEditarBtn').count() === 1, 'editar regras sem alteração: sai sem perguntar, para o painel dos motores');
    await page.click('#avpMotorArqEditarBtn');
    await page.waitForSelector('.sq-cond-select');
    /* Condição de PRODUTO_SERVICO_PRINCIPAL (folha 2): inverter a 1ª folha (P16 da INCOERENCIA)
       deixaria Produto/Serviço principal inalcançável, e o editor agora bloqueia regra inalcançável. */
    const sel = page.locator('.sq-cond-select[data-leaf-id="2"]');
    const atual = await sel.inputValue();
    await sel.selectOption(atual === 'SIM' ? 'NAO' : 'SIM');
    await page.click('#avpMotoresVoltarLista');
    afirma(await page.locator('.avp-modal-confirm-btn').count() === 1, 'editar regras com alteração: pede confirmação');
    await page.click('.avp-modal-cancel-btn');
    await page.click('#avpMotorArqSimularBtn');
    await page.waitForSelector('#avpMotorArqVoltarEdicaoBtn', { timeout: 8000 });
    await conferirVoltar(page, '#avpMotoresVoltarLista', 'Editar regras', 'simulação (topo)');
    await conferirVoltar(page, '#avpMotorArqVoltarEdicaoBtn', 'Editar regras', 'simulação (rodapé)');
    await page.click('#avpMotoresVoltarLista');
    await page.waitForSelector('#avpMotorArqSimularBtn');
    afirma(true, 'simulação → "Voltar para Editar regras" reabre o editor');
    /* a alteração feita antes continua ali e continua avisando */
    await page.click('#avpMotoresVoltarLista');
    afirma(await page.locator('.avp-modal-confirm-btn').count() === 1, 'depois da simulação a alteração continua pendente: avisa ao sair');
    await page.click('.avp-modal-confirm-btn');
    await page.waitForSelector('#avpMotorArqEditarBtn');
    /* "Editar textos" do motor arquitetural foi removido: gravava um rótulo de classificação que nada
       exibia — o nome das classificações vem só da Taxonomia Arquitetural (teste-classificacoes-fonte-unica.js) */
    afirma(await page.locator('#avpMotorArqTextosBtn').count() === 0, 'motor arquitetural: não há mais "Editar textos" (o nome vem da Taxonomia)');
    await page.click('#avpMotoresVoltarLista');
    await page.waitForSelector('#avpQuestP1P16Btn');

    console.log('\n== Naturezas complementares: cadastro retirado ==');
    /* o endereço antigo do cadastro não abre tela nenhuma: cai no Início de Avaliações e Mapa */
    await page.evaluate(() => { location.hash = '#admin?arq=naturezas'; });
    await page.waitForSelector('#avpQuestP1P16Btn');
    afirma(await page.locator('#avpNaturezasVoltar, #avpNaturezaNova').count() === 0, '#admin?arq=naturezas (link antigo): nenhuma tela de catálogo; fica no Início');

    console.log('\n== Usuários autorizados ==');
    await page.click('#avpUsuariosBtn');
    await page.waitForSelector('#avpUsuariosVoltar');
    await conferirVoltar(page, '#avpUsuariosVoltar', 'Avaliações e Mapa', 'usuários');
    await page.waitForSelector('#avpUsuariosVoltarRodape');
    await conferirVoltar(page, '#avpUsuariosVoltarRodape', 'Avaliações e Mapa', 'usuários (rodapé)');
    await page.fill('#avpUsuariosBusca', 'zz-busca-guardada');
    await page.click('#avpUsuariosVoltar');
    await page.waitForSelector('#avpQuestP1P16Btn');
    await page.click('#avpUsuariosBtn');
    await page.waitForSelector('#avpUsuariosBusca');
    afirma(await page.locator('#avpUsuariosBusca').inputValue() === 'zz-busca-guardada', 'voltar para Usuários devolve a mesma pesquisa');
    await page.click('#avpUsuariosVoltarRodape');
    await page.waitForSelector('#avpQuestP1P16Btn');

    console.log('\n== Motor de Squad (a avaliação de Squad fica na área Avaliação) ==');
    /* T1: um acesso só ao motor de squad — o cartão em Motores de classificação; Configuração dos Motores não o repete */
    await page.click('#avpConfigMotoresBtn');
    await page.waitForSelector('#avpMotorArqEditarBtn');
    afirma(await page.locator('#avpMotorSquadAbrirBtn').count() === 0, 'Configuração dos Motores não repete o acesso ao motor de squad');
    await page.click('#avpMotoresVoltarLista');
    await page.waitForSelector('#avpMotorSquadInicioBtn', { state: 'visible' });
    await page.click('#avpMotorSquadInicioBtn');
    await page.waitForSelector('#adminAvaliacaoSquad #sqMotorEditarRegrasBtn', { state: 'visible' });
    await conferirVoltar(page, '#sqMotorVoltarLista', 'Avaliações e Mapa', 'painel do motor de squad aberto pela área Avaliações e Mapa');
    /* S1–S8 no mesmo esqueleto: como decide recolhido (com o que NÃO faz), regras / textos / exigência separados, histórico sob demanda */
    afirma(!(await page.evaluate(() => document.getElementById('sqMotorSquadDecide').open)) && /Não cria Squad/.test(await page.locator('#sqMotorSquadDecide').textContent()) && /Diferente do Posicionamento Organizacional/.test(await page.locator('#sqMotorSquadDecide').textContent()),
      'S1–S8: "Como este motor decide" recolhido, com o que significa, o que produz e que não cria Squad');
    afirma(await page.locator('#sqMotorGrupoRegras #sqMotorEditarRegrasBtn, #sqMotorGrupoTextos #sqMotorEditarTextosBtn, #sqMotorGrupoTextos #sqMotorVereditosExcelBtn, #sqMotorGrupoTextos #sqMotorVereditosPdfBtn').count() === 4 && await page.locator('#sqExigirCard').count() === 0,
      'S1–S8: regras e textos dos vereditos (editar e exportar) em blocos separados; sem a antiga exigência de Posicionamento');
    afirma(await page.locator('#sqMotorVersoes').count() === 0, 'S1–S8 só com a versão vigente: sem "Versões anteriores"');
    await page.click('#sqMotorHistorico > summary');
    await page.waitForFunction(() => /Histórico de alterações — /.test((document.querySelector('#sqMotorHistorico > summary') || {}).textContent || ''), null, { timeout: 8000 });
    afirma(await page.evaluate(() => document.getElementById('sqMotorHistorico').open), 'S1–S8: histórico recolhido, lido ao abrir');
    await page.click('#sqMotorEditarRegrasBtn');
    await page.waitForSelector('#sqMotorSimularBtn');
    await conferirVoltar(page, '#sqMotorVoltarLista', 'Adequação à Gestão por Squad (S1–S8)', 'squad editar regras (topo)');
    await conferirVoltar(page, '#sqMotorCancelarEdicaoBtn', 'Adequação à Gestão por Squad (S1–S8)', 'squad editar regras (rodapé)');
    await page.click('#sqMotorVoltarLista');
    afirma(await page.locator('.sq-modal-confirm-btn').count() === 0 && await page.locator('#sqMotorEditarRegrasBtn').count() === 1, 'squad: editar regras sem alteração sai sem perguntar');
    await page.click('#sqMotorEditarRegrasBtn');
    await page.waitForSelector('.sq-cond-select');
    const selSq = page.locator('.sq-cond-select').first();
    const atualSq = await selSq.inputValue();
    await selSq.selectOption(atualSq === 'SIM' ? 'NAO' : 'SIM');
    await page.click('#sqMotorVoltarLista');
    afirma(await page.locator('.sq-modal-confirm-btn').count() === 1, 'squad: editar regras com alteração pede confirmação');
    await page.click('.sq-modal-cancelar-btn');
    await page.click('#sqMotorSimularBtn');
    await page.waitForSelector('#sqMotorVoltarEdicaoBtn', { timeout: 8000 });
    await conferirVoltar(page, '#sqMotorVoltarLista', 'Editar regras', 'squad simulação (topo)');
    await conferirVoltar(page, '#sqMotorVoltarEdicaoBtn', 'Editar regras', 'squad simulação (rodapé)');
    await page.click('#sqMotorVoltarLista');
    await page.waitForSelector('#sqMotorSimularBtn');
    await page.click('#sqMotorVoltarLista');
    afirma(await page.locator('.sq-modal-confirm-btn').count() === 1, 'squad: depois da simulação a alteração continua pendente');
    await page.click('.sq-modal-confirm-btn');
    await page.waitForSelector('#sqMotorEditarRegrasBtn');
    await page.click('#sqMotorEditarTextosBtn');
    await page.waitForSelector('#sqMotorPublicarTextosBtn');
    await conferirVoltar(page, '#sqMotorVoltarLista', 'Adequação à Gestão por Squad (S1–S8)', 'squad editar textos (topo)');
    await conferirVoltar(page, '#sqMotorCancelarTextosBtn', 'Adequação à Gestão por Squad (S1–S8)', 'squad editar textos (rodapé)');
    await page.locator('.sq-texto-rotulo').first().fill('rótulo alterado');
    await page.click('#sqMotorCancelarTextosBtn');
    afirma(await page.locator('.sq-modal-confirm-btn').count() === 1, 'squad: editar textos com alteração pede confirmação');
    await page.click('.sq-modal-confirm-btn');
    await page.waitForSelector('#sqMotorEditarRegrasBtn');
    await page.click('#sqMotorVoltarLista');
    await page.waitForSelector('#avpQuestP1P16Btn', { state: 'visible' });
    afirma(true, 'o Voltar do painel do motor devolve a tela inicial da Arquitetura');

    console.log('\n== Endereço próprio por área: F5 e Voltar/Avançar do navegador ==');
    const hash = () => page.evaluate(() => location.hash);
    afirma(await hash() === '#admin?arq=inicio', 'na tela inicial da Arquitetura o endereço é #admin?arq=inicio (' + await hash() + ')');
    await page.click('#avpConfigMotoresBtn');
    await page.waitForSelector('#avpMotorArqEditarBtn');
    afirma(await hash() === '#admin?arq=motores', 'Configuração dos Motores: #admin?arq=motores');
    await page.goBack();
    await page.waitForSelector('#avpMotorSquadInicioBtn', { state: 'visible' });
    await page.click('#avpMotorSquadInicioBtn');
    await page.waitForSelector('#adminAvaliacaoSquad #sqMotorEditarRegrasBtn', { state: 'visible' });
    afirma(await hash() === '#admin?arq=motor-squad', 'Motor de Squad: #admin?arq=motor-squad');
    await page.goBack();
    await page.waitForSelector('#avpMotorSquadInicioBtn', { state: 'visible' });
    afirma(await hash() === '#admin?arq=inicio' && await page.locator('#adminAvaliacaoSquad').isHidden(), 'Voltar do navegador: volta ao início de Avaliações e Mapa, sem sair do ADMIN');
    await page.click('#avpConfigMotoresBtn');
    await page.waitForSelector('#avpMotorArqEditarBtn', { state: 'visible' });
    await page.goBack();
    await page.waitForSelector('#avpQuestP1P16Btn', { state: 'visible' });
    afirma(await hash() === '#admin?arq=inicio', 'Voltar de novo: tela inicial da Arquitetura');
    await page.goForward();
    await page.waitForSelector('#avpMotorArqEditarBtn', { state: 'visible' });
    afirma(await hash() === '#admin?arq=motores', 'Avançar do navegador: Configuração dos Motores');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await esperarSessaoAssentada(page);
    await page.waitForSelector('#avpMotorArqEditarBtn', { state: 'visible', timeout: 10000 });
    afirma(await hash() === '#admin?arq=motores' && await page.locator('#adminPanelArquitetura').evaluate((p) => p.classList.contains('active')), 'F5: continua em Configuração dos Motores, na aba Avaliações e Mapa');
    await page.click('#avpMotoresVoltarLista');
    await page.waitForSelector('#avpQuestP1P16Btn', { state: 'visible' });
    afirma(await hash() === '#admin?arq=inicio', 'o "← Voltar" da tela também acerta o endereço');

    /* O "← Voltar" posiciona a tela inicial num requestAnimationFrame agendado no popstate
       (rolarAdmin). Antes, o teste rolava logo depois do clique: com quadros atrasados (CI
       headless) esse quadro rodava DEPOIS e levava a página de volta a 0, e o
       scrollIntoViewIfNeeded abaixo trazia o cartão de volta à tela, em 50 px (borda inferior
       do cartão − altura da janela). Era o "tela inicial rolada (50 px)" do CI: corrida do
       teste, não da aplicação. Os quadros rodam na ordem em que foram pedidos, então dois
       quadros pedidos agora só terminam depois do da aplicação. */
    const quadros = (n) => page.evaluate((n) => new Promise((r) => { let i = 0; (function f() { if (++i >= n) r(); else requestAnimationFrame(f); })(); }), n + 1);
    await quadros(2);
    afirma(await page.evaluate(() => window.pageYOffset) === 0, 'depois do F5, o "← Voltar" leva a tela inicial ao topo');

    console.log('\n== Subtela abre no topo ==');
    /* sem animação: o site usa rolagem suave, e a posição lida no meio dela seria um ponto qualquer */
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, left: 0, behavior: 'instant' }));
    await quadros(2);
    /* medido antes de qualquer ação do Playwright que reposicione a página */
    const fim = await page.evaluate(() => ({ y: Math.round(window.pageYOffset), max: document.documentElement.scrollHeight - window.innerHeight }));
    afirma(fim.y === fim.max && fim.y > 100, 'a rolagem até o fim da tela inicial não é desfeita (' + fim.y + ' de ' + fim.max + ' px)');
    /* o cartão no meio da tela: rente ao topo ele fica sob o cabeçalho fixo e o clique do Playwright rola a página antes de
       clicar (a posição "de onde a pessoa saiu" passaria a ser outra) */
    await page.evaluate(() => document.getElementById('avpDocumentacaoBtn').scrollIntoView({ block: 'center', behavior: 'instant' }));
    const yInicio = await page.evaluate(() => window.pageYOffset); /* onde a pessoa está ao tocar no cartão */
    afirma(yInicio > 100, 'tela inicial rolada (' + yInicio + ' px)');
    await page.click('#avpDocumentacaoBtn');
    await page.waitForSelector('#avpDocsVoltar');
    await page.waitForFunction(() => { const b = document.getElementById('avpDocsVoltar').getBoundingClientRect(); return b.top >= 0 && b.bottom <= window.innerHeight; }, null, { timeout: 3000 });
    afirma(true, 'abrir uma subtela no meio da página mostra o "← Voltar" do topo');
    await page.click('#avpDocsVoltarRodape');
    await page.waitForSelector('#avpQuestP1P16Btn', { state: 'visible' });
    await page.waitForFunction((y) => Math.abs(window.pageYOffset - y) <= 2, yInicio, { timeout: 3000 });
    afirma(true, 'voltar para a tela inicial devolve a posição de onde a pessoa saiu');
    afirma(await larguraOk(page), 'sem rolagem horizontal ao final');
    await ctx.close();
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
  }
  await browser.close();
  console.log('\n============================\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
