/* Navegação do Admin da Avaliação de Produto/Serviço (PR 3 do prompt consolidado):
 *   - tela inicial organizada em três grupos: Regras e conceitos / Governança
 *     arquitetural / Acesso (só organização — os mesmos cartões de antes);
 *   - TODA subtela tem um "← Voltar para <tela pai>" explícito, que sobe UM nível;
 *   - sair de uma tela de edição com alteração não salva pede confirmação
 *     (e não pede quando nada foi alterado).
 * Desktop e celular (375 px). Hermético: sem rede, sem segredo. */
const { chromium } = require('playwright');
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
  await page.waitForFunction(() => !document.body.classList.contains('aguardando-auth'), { timeout: 16000 }).catch(() => {});
  await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelArquitetura"]', { timeout: 8000 });
  await page.click('.admin-tab-btn[data-panel="adminPanelArquitetura"]');
  await page.waitForSelector('#avpConfigQuestionariosBtn', { timeout: 8000 });
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

    console.log('\n== Tela inicial: três grupos ==');
    const titulos = await page.locator('#adminAvaliacaoProduto .avp-admin-grupo > h4').allTextContents();
    afirma(JSON.stringify(titulos) === JSON.stringify(['Regras e conceitos', 'Governança arquitetural', 'Acesso']), 'grupos: ' + titulos.join(' | '));
    const grupo = (n) => page.locator('#adminAvaliacaoProduto .avp-admin-grupo').nth(n);
    afirma(await grupo(0).locator('#avpConfigQuestionariosBtn, #avpConfigMotoresBtn').count() === 2, 'Regras e conceitos: Questionários e Motores');
    afirma(await grupo(1).locator('#avpConfigNaturezasBtn, #avpAdequacaoSquadListaBtn').count() === 2, 'Governança arquitetural: Naturezas complementares e Adequação à Squad');
    afirma(await grupo(2).locator('#avpUsuariosBtn').count() === 1, 'Acesso: Usuários autorizados');
    afirma(await larguraOk(page), 'sem rolagem horizontal');

    console.log('\n== Questionários ==');
    await page.click('#avpConfigQuestionariosBtn');
    await conferirVoltar(page, '#avpConfigVoltar', 'Avaliação de Produto/Serviço (Admin)', 'lista de questionários');
    await page.click('.avp-config-editar-btn >> nth=0');
    await page.waitForSelector('#avpCfgSalvarRascunhoBtn');
    await conferirVoltar(page, '#avpConfigVoltar', 'Questionários e versões', 'edição do questionário (topo)');
    await conferirVoltar(page, '#avpCfgVoltarListaBtn', 'Questionários e versões', 'edição do questionário (rodapé)');
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
    await conferirVoltar(page, '#avpConfigVoltar', 'Questionários e versões', 'histórico do questionário (topo)');
    await conferirVoltar(page, '#avpCfgAuditoriaVoltarBtn', 'Questionários e versões', 'histórico do questionário (rodapé)');
    await page.click('#avpConfigVoltar');
    await page.click('#avpConfigVoltar');
    await page.waitForSelector('#avpConfigQuestionariosBtn');
    afirma(true, 'dois cliques em "Voltar" chegam à tela inicial do Admin');

    console.log('\n== Motores ==');
    await page.click('#avpConfigMotoresBtn');
    await page.waitForSelector('#avpMotorArqEditarBtn');
    await conferirVoltar(page, '#avpMotoresVoltarLista', 'Avaliação de Produto/Serviço (Admin)', 'painel dos motores');
    for (const [btn, nome] of [['#avpMotorArqVersoesBtn', 'versões'], ['#avpMotorArqAuditoriaBtn', 'histórico']]) {
      await page.click(btn);
      const rodape = nome === 'versões' ? '#avpMotorArqVoltarVersoesBtn' : '#avpMotorArqVoltarAuditoriaBtn';
      await page.waitForSelector(rodape);
      await conferirVoltar(page, '#avpMotoresVoltarLista', 'Configuração dos Motores', nome + ' (topo)');
      await conferirVoltar(page, rodape, 'Configuração dos Motores', nome + ' (rodapé)');
      await page.click('#avpMotoresVoltarLista');
      await page.waitForSelector('#avpMotorArqEditarBtn');
    }
    /* editar regras → simular → voltar para editar → voltar */
    await page.click('#avpMotorArqEditarBtn');
    await page.waitForSelector('#avpMotorArqSimularBtn');
    await conferirVoltar(page, '#avpMotoresVoltarLista', 'Configuração dos Motores', 'editar regras (topo)');
    await conferirVoltar(page, '#avpMotorArqCancelarBtn', 'Configuração dos Motores', 'editar regras (rodapé)');
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
    /* editar textos */
    await page.click('#avpMotorArqTextosBtn');
    await page.waitForSelector('#avpMotorArqPublicarTextosBtn');
    await conferirVoltar(page, '#avpMotoresVoltarLista', 'Configuração dos Motores', 'editar textos (topo)');
    await conferirVoltar(page, '#avpMotorArqCancelarTextosBtn', 'Configuração dos Motores', 'editar textos (rodapé)');
    await page.locator('.sq-texto-rotulo').first().fill('rótulo alterado');
    await page.click('#avpMotorArqCancelarTextosBtn');
    afirma(await page.locator('.avp-modal-confirm-btn').count() === 1, 'editar textos com alteração: pede confirmação');
    await page.click('.avp-modal-confirm-btn');
    await page.waitForSelector('#avpMotorArqEditarBtn');
    await page.click('#avpMotoresVoltarLista');
    await page.waitForSelector('#avpConfigQuestionariosBtn');

    console.log('\n== Naturezas complementares ==');
    await page.click('#avpConfigNaturezasBtn');
    await page.waitForSelector('#avpNaturezasVoltar');
    await conferirVoltar(page, '#avpNaturezasVoltar', 'Avaliação de Produto/Serviço (Admin)', 'naturezas');
    await page.click('#avpNaturezaNova');
    await page.waitForSelector('#avpNaturezaNome');
    await page.fill('#avpNaturezaNome', 'Opção em edição');
    await page.click('#avpNaturezasVoltar');
    afirma(await page.locator('.avp-modal-confirm-btn').count() === 1, 'naturezas: nova opção digitada e não salva → pede confirmação');
    await page.click('.avp-modal-cancel-btn');
    afirma((await page.locator('#avpNaturezaNome').inputValue()) === 'Opção em edição', 'Cancelar mantém o que foi digitado');
    await page.click('#avpNaturezaCancelar');
    await page.click('#avpNaturezasVoltar');
    afirma(await page.locator('.avp-modal-confirm-btn').count() === 0, 'depois de cancelar a edição, sai sem perguntar');
    await page.waitForSelector('#avpConfigQuestionariosBtn');

    console.log('\n== Usuários autorizados ==');
    await page.click('#avpUsuariosBtn');
    await page.waitForSelector('#avpUsuariosVoltar');
    await conferirVoltar(page, '#avpUsuariosVoltar', 'Avaliação de Produto/Serviço (Admin)', 'usuários');
    await page.click('#avpUsuariosVoltar');
    await page.waitForSelector('#avpConfigQuestionariosBtn');

    console.log('\n== Adequação à Squad ==');
    await page.click('#avpAdequacaoSquadListaBtn');
    await page.waitForSelector('#sqVoltarArquitetura');
    await conferirVoltar(page, '#sqVoltarArquitetura', 'Avaliação de Produto/Serviço (Admin)', 'lista de squad');
    await page.click('#sqVoltarArquitetura');
    await page.waitForSelector('#avpConfigQuestionariosBtn');
    afirma(await visivel(page, '#avpConfigQuestionariosBtn'), 'volta para a tela inicial do Admin');
    await page.click('#avpAdequacaoSquadListaBtn');
    await page.click('#sqNovaBtn');
    await page.waitForSelector('#sqVoltarListaInicial');
    await conferirVoltar(page, '#sqVoltarListaInicial', 'Adequação à Squad', 'nova avaliação de squad');
    await page.click('#sqVoltarListaInicial');
    await page.waitForSelector('#sqMotorConfigBtn');
    await page.click('#sqMotorConfigBtn');
    await page.waitForSelector('#sqMotorEditarRegrasBtn');
    await conferirVoltar(page, '#sqMotorVoltarLista', 'Adequação à Squad', 'painel do motor de squad');
    for (const [btn, rodape, nome] of [['#sqMotorVersoesBtn', '#sqMotorVoltarVersoesBtn', 'versões'], ['#sqMotorAuditoriaBtn', '#sqMotorVoltarAuditoriaBtn', 'histórico']]) {
      await page.click(btn);
      await page.waitForSelector(rodape);
      await conferirVoltar(page, '#sqMotorVoltarLista', 'Configuração do Motor de Squad', 'squad ' + nome + ' (topo)');
      await conferirVoltar(page, rodape, 'Configuração do Motor de Squad', 'squad ' + nome + ' (rodapé)');
      await page.click('#sqMotorVoltarLista');
      await page.waitForSelector('#sqMotorEditarRegrasBtn');
    }
    await page.click('#sqMotorEditarRegrasBtn');
    await page.waitForSelector('#sqMotorSimularBtn');
    await conferirVoltar(page, '#sqMotorVoltarLista', 'Configuração do Motor de Squad', 'squad editar regras (topo)');
    await conferirVoltar(page, '#sqMotorCancelarEdicaoBtn', 'Configuração do Motor de Squad', 'squad editar regras (rodapé)');
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
    await conferirVoltar(page, '#sqMotorVoltarLista', 'Configuração do Motor de Squad', 'squad editar textos (topo)');
    await conferirVoltar(page, '#sqMotorCancelarTextosBtn', 'Configuração do Motor de Squad', 'squad editar textos (rodapé)');
    await page.locator('.sq-texto-rotulo').first().fill('rótulo alterado');
    await page.click('#sqMotorCancelarTextosBtn');
    afirma(await page.locator('.sq-modal-confirm-btn').count() === 1, 'squad: editar textos com alteração pede confirmação');
    await page.click('.sq-modal-confirm-btn');
    await page.waitForSelector('#sqMotorEditarRegrasBtn');
    await page.click('#sqMotorVoltarLista');
    await page.waitForSelector('#sqVoltarArquitetura');
    await page.click('#sqVoltarArquitetura');
    await page.waitForSelector('#avpConfigQuestionariosBtn', { state: 'visible' });
    afirma(await larguraOk(page), 'sem rolagem horizontal ao final');
    await ctx.close();
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
  }
  await browser.close();
  console.log('\n============================\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
