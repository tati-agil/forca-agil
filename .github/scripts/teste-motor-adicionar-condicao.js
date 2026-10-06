/* Editor do motor arquitetural — ACRESCENTAR condição a uma regra existente (só a capacidade
 * do editor; nenhuma regra é publicada aqui).
 *   - "+ Adicionar condição" no grupo principal "SE TODAS" de cada regra comum (nunca no fallback);
 *   - pergunta só de P1–P16, nunca uma que a regra já usa (inclusive dentro de QUALQUER/NENHUMA);
 *     resposta SIM/NÃO sem valor pré-marcado;
 *   - a condição acrescentada fica marcada "NOVA — ainda não publicada" e é a ÚNICA removível;
 *     condição que veio da versão-base nunca tem "Remover" (limite deliberado desta versão);
 *   - "Desfazer alterações desta regra" volta a regra ao que era na versão-base;
 *   - NOVA é calculado contra a versaoBase DO RASCUNHO, nunca contra a versão publicada agora;
 *   - regra inalcançável bloqueia a simulação (e a publicação, na validação do motor);
 *   - salvar rascunho grava só as condições acrescentadas, no formato das existentes; a versão
 *     publicada, as avaliações e a auditoria não mudam; nada é publicado sozinho.
 * Desktop e celular (375 px). Hermético: sem rede, sem segredo. */
const { chromium } = require('playwright');
const { esperarSessaoAssentada } = require('./esperas');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const EMAIL = 'adm@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

/* ---------- motor, fora do navegador: as funções novas ---------- */
console.log('== Motor: regra inalcançável, perguntas da regra, diff ==');
{
  const c = { console, JSON, Object, Array, String, Math, Number, Date, RegExp, Error, Promise, setTimeout, clearTimeout };
  c.window = c; c.document = { addEventListener() {} }; c.firebase = { database: () => ({ ref: () => ({ on() {}, once() {} }) }) };
  vm.createContext(c); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'forca-agil', 'motor-arquitetura.js'), 'utf8'), c);
  const M = c.window.faMotorArquitetura;
  const fabrica = () => M.migrarFallbackLegado(JSON.parse(JSON.stringify(M.PADRAO_REGRAS.regras)));
  afirma(M.regrasInalcancaveis(fabrica()).length === 0 && M.validarRegras({ regras: fabrica() }).length === 0, 'regras de fábrica: todas alcançáveis e válidas');
  const doc = fabrica(); doc.find((r) => r.codigo === 'DOCUMENTO_INFORMACAO').condicoes.all.push({ campo: 'P9', valor: 'SIM' });
  afirma(JSON.stringify(M.regrasInalcancaveis(doc)) === '["DOCUMENTO_INFORMACAO"]', 'DOCUMENTO_INFORMACAO + "P9 = SIM" fica inalcançável (CANAL já pega todo P9 = SIM)');
  afirma(M.validarRegras({ regras: doc }).some((e) => /DOCUMENTO_INFORMACAO nunca seria aplicada/.test(e)), 'e a validação bloqueia, dizendo qual regra');
  const comp = fabrica().find((r) => r.codigo === 'COMPONENTE');
  const usadas = M.perguntasDaRegra(comp);
  afirma(['P13', 'P15', 'P2', 'P5', 'P16', 'P12', 'P14'].every((p) => usadas.includes(p)) && usadas.length === 7, 'perguntasDaRegra inclui as que estão dentro de QUALQUER (COMPONENTE: P13/P15)', JSON.stringify(usadas));
  const uva = fabrica(); uva.find((r) => r.codigo === 'UNIDADE_VALOR_ASSOCIADA').condicoes.all.push({ campo: 'P13', valor: 'NAO' }, { campo: 'P15', valor: 'NAO' });
  afirma(M.validarRegras({ regras: uva }).length === 0, 'UVA + P13 = NÃO + P15 = NÃO é uma configuração válida (alcançável)');
  const d = M.diffRegras(fabrica(), uva);
  afirma(d.length === 1 && d[0].codigo === 'UNIDADE_VALOR_ASSOCIADA', 'o diff entre versões aponta exatamente a regra com condições acrescentadas');
  const volta = JSON.parse(JSON.stringify(uva)); const r = volta.find((x) => x.codigo === 'UNIDADE_VALOR_ASSOCIADA');
  r.condicoes.all = r.condicoes.all.filter((x) => x.campo !== 'P13' && x.campo !== 'P15');
  afirma(M.diffRegras(fabrica(), volta).length === 0, 'acrescentar e depois remover não gera diferença (nenhuma versão nova)');
}

/* ---------- avaliações fictícias concluídas (para a simulação) ---------- */
const IDS = ['necessidade', 'resultado', 'solucao', 'fronteira', 'autonomia', 'jornada', 'medicao', 'gestao', 'canal', 'artefato', 'capacidade', 'processo', 'modalidade', 'regra', 'componente', 'funcionalidade'];
function item(nome, sims, camada) {
  const respostas = {};
  IDS.forEach((id, i) => { respostas[id] = { valor: sims.includes('P' + (i + 1)) ? 'sim' : 'nao', observacao: '', justificativaAuto: 'auto', codigoPergunta: 'P' + (i + 1), textoPerguntaNaEpoca: 't', tituloNaEpoca: 't', questionnaireContentVersion: 1 }; });
  return { nome, descricao: '', publico: '', necessidade: '', observacoesGerais: '', status: 'concluido', respostas,
    resultadoAutomatico: camada === 'produto-principal' ? 'produto' : 'nao-produto', decisaoFinal: null, decisaoManual: false,
    camadaSugerida: { id: camada, label: camada, motivos: [], conflito: null, incoerencia: false, especializacao: null, papelEstrutural: null, relacao: null },
    justificativaAutomatica: 'texto', criteriosEssenciaisFalhos: [], exclusoesConflitantes: null, criteriosAtendidos: 5,
    motorVersionArquitetura: 1, questionnaireContentVersion: 1, criadoEm: '2026-10-01T10:00:00.000Z', atualizadoEm: '2026-10-01T10:00:00.000Z',
    responsavel: { name: 'Teste', email: EMAIL }, versao: 1, versaoAnteriorKey: null, excluido: false, excluidoEm: null, excluidoPor: null, justificativaExclusao: null, historicoMotor: null };
}
const AVALIACOES = {
  av1: item('Forma de recebimento (fictício)', ['P1', 'P2', 'P3', 'P4', 'P13'], 'unidade-valor-associada'),
  av2: item('Portabilidade de saída (fictício)', ['P1', 'P2', 'P3', 'P4', 'P6', 'P7', 'P8'], 'unidade-valor-associada'),
  av3: item('Produto fictício', ['P1', 'P2', 'P3', 'P4', 'P5'], 'produto-principal')
};

async function abrir(browser, viewport, configMotor, bancoCompleto) {
  const admins = {}; admins[chave(EMAIL)] = { email: EMAIL };
  /* bancoCompleto: o estado INTEIRO lido de outra página (prova de recarga) — usado tal como
     foi persistido, sem montar nada à mão. */
  const db = bancoCompleto ? JSON.parse(JSON.stringify(bancoCompleto)) : { turmas: {}, 'turmas-interesse': {}, 'fa-users': {}, 'fa-admins': admins, 'turmas-config': {}, 'turmas-checkin': {}, 'turmas-espera': {},
    'turmas-equipe': {}, 'fa-facilitadores': {}, 'fa-diretores': {}, eventos: {}, 'turmas-publico': {}, 'eventos-publico': {},
    'avaliacoes-produto': JSON.parse(JSON.stringify(AVALIACOES)), 'avaliacoes-squad': {}, 'motor-squad-config': {}, 'motor-squad-auditoria': {},
    'motor-arquitetura-config': configMotor || {}, 'motor-arquitetura-auditoria': {}, 'fa-avaliacao-acessos': {} };
  const cfg = { db, user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport });
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
  await page.waitForSelector('#avpConfigMotoresBtn', { timeout: 8000 });
  await page.click('#avpConfigMotoresBtn');
  await page.waitForSelector('#avpMotorArqEditarBtn');
  return { ctx, page, erros };
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal || window.__CFG.db)));
/* JSON com chaves ordenadas: o banco (persistência real) não garante a ordem das chaves. */
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, kk) => { o[kk] = x[kk]; return o; }, {}) : x));
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const card = (page, codigo) => page.locator('.sq-regra-card').filter({ has: page.locator('.sq-regra-codigo', { hasText: '— ' + codigo + ' →' }) });
async function acrescentar(page, codigo, campo, valor) {
  await card(page, codigo).locator('.sq-cond-add-btn').click();
  await page.selectOption('.sq-cond-add-pergunta', campo);
  await page.selectOption('.sq-cond-add-valor', valor);
  await page.click('.sq-cond-add-confirmar');
}
const novasDe = (page, codigo) => card(page, codigo).locator('.sq-cond-folha--nova').evaluateAll((els) => els.map((e) => e.getAttribute('data-nova')));

(async () => {
  const browser = await chromium.launch();
  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros } = await abrir(browser, viewport);
    await page.waitForTimeout(600);
    const inicio = await banco(page);
    await page.click('#avpMotorArqEditarBtn');
    await page.waitForSelector('.sq-cond-select');

    console.log('\n== Onde dá para acrescentar ==');
    const qtdRegras = await page.locator('.sq-regra-card').count();
    afirma(await page.locator('.sq-cond-add-btn').count() === qtdRegras - 1, '"+ Adicionar condição" em toda regra comum (' + (qtdRegras - 1) + ')');
    afirma(await card(page, 'FALLBACK_A_VALIDAR').locator('.sq-cond-add-btn').count() === 0, 'a regra de fallback NÃO aceita condição');
    afirma(await page.locator('.sq-cond-remover').count() === 0 && await page.locator('.sq-cond-folha--nova').count() === 0, 'ao abrir: nenhuma condição NOVA e nenhum "Remover"');
    const explica = page.locator('.avp-motor-explica'); await explica.locator('summary').click();
    afirma(/Limite desta versão do editor/.test(await explica.innerText()) && /esta tela não a remove/.test(await explica.innerText()), 'a tela registra o limite deliberado: condição publicada não é removida por aqui');

    console.log('\n== Escolher pergunta e resposta ==');
    await card(page, 'UNIDADE_VALOR_ASSOCIADA').locator('.sq-cond-add-btn').click();
    const opcoes = await page.locator('.sq-cond-add-pergunta option').evaluateAll((os) => os.filter((o) => o.value).map((o) => ({ v: o.value, d: o.disabled, t: o.textContent })));
    afirma(opcoes.length === 16 && opcoes.every((o) => /^P(1[0-6]|[1-9])$/.test(o.v)), 'a lista oferece só P1–P16 (16 opções), nunca pergunta nova');
    const desab = opcoes.filter((o) => o.d).map((o) => o.v).sort().join(',');
    afirma(desab === 'P1,P16,P2,P4,P5', 'perguntas que a regra já usa ficam bloqueadas (P1, P2, P4, P5, P16)', desab);
    afirma(opcoes.filter((o) => o.d).every((o) => /já usada nesta regra/.test(o.t)), 'e dizem "já usada nesta regra"');
    afirma(/Modalidade/.test(opcoes.find((o) => o.v === 'P13').t), 'cada opção mostra o título real da pergunta (P13 — Modalidade/opção)');
    afirma(await page.locator('.sq-cond-add-valor').inputValue() === '', 'a resposta começa SEM valor marcado (escolha consciente)');
    afirma(await page.locator('.sq-cond-add-confirmar').isDisabled(), '"Adicionar" fica desativado até escolher pergunta e resposta');
    await page.selectOption('.sq-cond-add-pergunta', 'P13');
    afirma(await page.locator('.sq-cond-add-confirmar').isDisabled(), 'só a pergunta ainda não basta');
    afirma(await larguraOk(page), 'formulário aberto: sem rolagem horizontal');
    await page.click('.sq-cond-add-cancelar');
    afirma(await page.locator('.sq-cond-add').count() === 0 && (await novasDe(page, 'UNIDADE_VALOR_ASSOCIADA')).length === 0, '"Cancelar" fecha sem acrescentar nada');

    console.log('\n== Acrescentar P13 = NÃO e P15 = NÃO à Unidade de valor ==');
    await acrescentar(page, 'UNIDADE_VALOR_ASSOCIADA', 'P13', 'NAO');
    await acrescentar(page, 'UNIDADE_VALOR_ASSOCIADA', 'P15', 'NAO');
    afirma(JSON.stringify(await novasDe(page, 'UNIDADE_VALOR_ASSOCIADA')) === '["P13","P15"]', 'as duas aparecem como NOVA, no fim do grupo SE TODAS');
    afirma(/2 condições acrescentadas neste rascunho/.test(await card(page, 'UNIDADE_VALOR_ASSOCIADA').locator('.sq-regra-novas').innerText()), 'a regra diz "2 condições acrescentadas neste rascunho"');
    afirma(await page.locator('.sq-cond-remover').count() === 2 && await card(page, 'UNIDADE_VALOR_ASSOCIADA').locator('.sq-cond-folha--legivel:not(.sq-cond-folha--nova) .sq-cond-remover').count() === 0, 'só as NOVAS têm "Remover"; as originais nunca');
    afirma(/NOVA — ainda não publicada/.test(await card(page, 'UNIDADE_VALOR_ASSOCIADA').locator('.sq-cond-folha--nova').first().innerText()), 'selo "NOVA — ainda não publicada"');
    await card(page, 'UNIDADE_VALOR_ASSOCIADA').locator('.sq-cond-add-btn').click();
    const desab2 = await page.locator('.sq-cond-add-pergunta option').evaluateAll((os) => os.filter((o) => o.disabled).map((o) => o.value).sort().join(','));
    afirma(desab2 === 'P1,P13,P15,P16,P2,P4,P5', 'depois de acrescentar, P13 e P15 também não podem ser escolhidas de novo (sem duplicata)', desab2);
    await page.click('.sq-cond-add-cancelar');
    await card(page, 'COMPONENTE').locator('.sq-cond-add-btn').click();
    const desabComp = await page.locator('.sq-cond-add-pergunta option').evaluateAll((os) => os.filter((o) => o.disabled).map((o) => o.value));
    afirma(desabComp.includes('P13') && desabComp.includes('P15'), 'em COMPONENTE, P13/P15 (que estão dentro de "QUALQUER") também ficam bloqueadas');
    await page.click('.sq-cond-add-cancelar');
    afirma(await larguraOk(page), 'com condições NOVAS: sem rolagem horizontal');

    console.log('\n== Remover e desfazer ==');
    await card(page, 'UNIDADE_VALOR_ASSOCIADA').locator('.sq-cond-folha--nova[data-nova="P15"] .sq-cond-remover').click();
    afirma(JSON.stringify(await novasDe(page, 'UNIDADE_VALOR_ASSOCIADA')) === '["P13"]', '"Remover" tira só a condição NOVA escolhida');
    await card(page, 'UNIDADE_VALOR_ASSOCIADA').locator('.sq-regra-desfazer').click();
    await page.waitForSelector('.avp-modal-confirm-btn');
    await page.click('.avp-modal-confirm-btn');
    afirma((await novasDe(page, 'UNIDADE_VALOR_ASSOCIADA')).length === 0 && await card(page, 'UNIDADE_VALOR_ASSOCIADA').locator('.sq-regra-desfazer').count() === 0, '"Desfazer alterações desta regra" volta a regra ao que era na versão-base');
    await acrescentar(page, 'UNIDADE_VALOR_ASSOCIADA', 'P13', 'NAO');
    await acrescentar(page, 'UNIDADE_VALOR_ASSOCIADA', 'P15', 'NAO');

    console.log('\n== Regra inalcançável bloqueia a simulação ==');
    await acrescentar(page, 'DOCUMENTO_INFORMACAO', 'P9', 'SIM');
    await page.click('#avpMotorArqSimularBtn');
    await page.waitForTimeout(300);
    afirma(await page.locator('#avpMotorArqConfirmarPublicarBtn').count() === 0 && /DOCUMENTO_INFORMACAO nunca seria aplicada/.test(await page.locator('.avp-config-motores').innerText()), 'DOCUMENTO_INFORMACAO + P9 = SIM: a simulação é bloqueada com a explicação');
    await card(page, 'DOCUMENTO_INFORMACAO').locator('.sq-cond-folha--nova[data-nova="P9"] .sq-cond-remover').click();

    console.log('\n== Simular impacto (sem publicar) ==');
    await page.click('#avpMotorArqSimularBtn');
    await page.waitForSelector('#avpMotorArqConfirmarPublicarBtn', { timeout: 8000 });
    const sim = await page.locator('.avp-config-motores').innerText();
    afirma(/3 avaliações analisadas/.test(sim) && /2 manteriam/.test(sim) && /1 mudariam/.test(sim), 'simulação: 3 analisadas, 2 mantêm, 1 mudaria', sim.slice(0, 300));
    const linha = await page.locator('.avp-config-motores table.admin-table tbody tr').first().innerText().catch(() => '');
    afirma(/Forma de recebimento/.test(linha) && /Unidade de valor associada/.test(linha) && /Modalidade\/Subproduto/.test(linha), 'a que mudaria é a modalidade: Unidade de valor → Modalidade/Subproduto', linha);
    afirma(await larguraOk(page), 'simulação: sem rolagem horizontal');
    await page.click('#avpMotorArqVoltarEdicaoBtn');
    await page.waitForSelector('.sq-cond-select');
    afirma(JSON.stringify(await novasDe(page, 'UNIDADE_VALOR_ASSOCIADA')) === '["P13","P15"]', 'voltando da simulação, as condições NOVAS continuam lá');

    console.log('\n== Salvar rascunho ==');
    await page.click('#avpMotorArqSalvarRascunhoBtn');
    await page.waitForSelector('#avpMotorArqEditarBtn');
    await page.waitForTimeout(300);
    const depois = await banco(page);
    const cfg = depois['motor-arquitetura-config'] || {};
    const fabrica = await page.evaluate(() => JSON.parse(JSON.stringify(window.faMotorArquitetura.migrarFallbackLegado(window.faMotorArquitetura.PADRAO_REGRAS.regras))));
    const ras = (cfg.rascunho && cfg.rascunho.regras) || [];
    const uvaR = ras.find((r) => r.codigo === 'UNIDADE_VALOR_ASSOCIADA');
    const uvaF = fabrica.find((r) => r.codigo === 'UNIDADE_VALOR_ASSOCIADA');
    afirma(!!uvaR && canon(uvaR.condicoes.all) === canon(uvaF.condicoes.all.concat([{ campo: 'P13', valor: 'NAO' }, { campo: 'P15', valor: 'NAO' }])), 'o rascunho grava a UVA com exatamente P13 = NÃO e P15 = NÃO a mais, no formato das existentes');
    /* Comparação SEMÂNTICA (a mesma do versionamento, diffRegras): o banco não grava null e reordena chaves. */
    const alteradas = await page.evaluate((r) => window.faMotorArquitetura.diffRegras(window.faMotorArquitetura.PADRAO_REGRAS.regras, r).map((x) => x.codigo), ras);
    afirma(ras.length === fabrica.length && JSON.stringify(alteradas) === '["UNIDADE_VALOR_ASSOCIADA"]', 'todas as outras regras do rascunho continuam idênticas (só a UVA difere da versão-base)', JSON.stringify(alteradas));
    afirma(cfg.rascunho && cfg.rascunho.versaoBase === 1, 'o rascunho guarda a versão-base 1');
    afirma(canon(cfg.versoes || null) === canon((inicio['motor-arquitetura-config'] || {}).versoes || null) && (cfg.versaoPublicada || null) === ((inicio['motor-arquitetura-config'] || {}).versaoPublicada || null), 'versão publicada idêntica antes e depois (nada publicado)');
    afirma(canon(depois['avaliacoes-produto']) === canon(inicio['avaliacoes-produto']), 'nenhuma avaliação foi alterada');
    afirma(canon(depois['motor-arquitetura-auditoria'] || {}) === canon(inicio['motor-arquitetura-auditoria'] || {}), 'nenhum evento de auditoria de publicação (nada publicado)');
    afirma(await page.evaluate(() => window.faMotorArquitetura.versaoAtual()) === 1, 'o motor continua na versão 1');

    console.log('\n== Reabrir o rascunho ==');
    await page.click('#avpMotorArqEditarBtn');
    await page.waitForSelector('.sq-cond-select');
    afirma(JSON.stringify(await novasDe(page, 'UNIDADE_VALOR_ASSOCIADA')) === '["P13","P15"]', 'ao reabrir, as condições do rascunho voltam marcadas como NOVA (comparadas com a versão-base)');
    await page.click('#avpMotorArqCancelarBtn');
    await ctx.close();
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');

    console.log('\n== Recarregar: página nova, a partir só do que ficou gravado no banco ==');
    {
      /* O banco falso não sobrevive a um reload. O equivalente: a 1ª página fez Adicionar →
         Salvar rascunho pela interface (acima); "depois" é o banco INTEIRO efetivamente gravado
         por ela (já com a forma do Firebase real: sem null, listas como o RTDB devolve). A 2ª
         página nasce do zero com exatamente esse estado — nenhuma condição é injetada à mão.
         A versão-base do rascunho é a 1 (nunca houve publicação): as regras de fábrica, que a
         2ª página carrega do próprio código, como em produção. */
      const persistido = JSON.parse(JSON.stringify(depois));
      const r1 = ((persistido['motor-arquitetura-config'] || {}).rascunho || {});
      afirma(r1.versaoBase === 1 && !(persistido['motor-arquitetura-config'] || {}).versaoPublicada, 'o estado persistido tem o rascunho sobre a versão-base 1 e nenhuma versão publicada nova');
      const { ctx: c1, page: p1, erros: e1 } = await abrir(browser, viewport, null, persistido);
      await p1.waitForTimeout(500);
      afirma(/há um rascunho não publicado/.test(await p1.locator('.avp-config-motores').innerText()), 'depois de recarregar, o painel diz "há um rascunho não publicado"');
      afirma(await p1.evaluate(() => window.faMotorArquitetura.versaoAtual() === 1 && Array.isArray(window.faMotorArquitetura.regrasDaVersaoBase(1))), 'a versão publicada correspondente à versão-base (1) está carregada');
      await p1.click('#avpMotorArqEditarBtn');
      await p1.waitForSelector('.sq-cond-select');
      afirma(JSON.stringify(await novasDe(p1, 'UNIDADE_VALOR_ASSOCIADA')) === '["P13","P15"]', 'depois de recarregar, P13 e P15 reaparecem com o selo NOVA na UVA');
      const todasNovas = await p1.locator('.sq-cond-folha--nova').evaluateAll((els) => els.map((e) => e.getAttribute('data-nova')));
      afirma(JSON.stringify(todasNovas) === '["P13","P15"]' && await p1.locator('.sq-cond-remover').count() === 2, 'nenhuma condição publicada aparece como NOVA (só as 2 acrescentadas, em toda a tela) e só elas têm "Remover"', JSON.stringify(todasNovas));
      await p1.click('#avpMotorArqCancelarBtn');
      const depoisDaRecarga = await banco(p1);
      afirma(canon(depoisDaRecarga['avaliacoes-produto']) === canon(inicio['avaliacoes-produto']), 'depois de recarregar e abrir o editor, nenhuma avaliação mudou');
      await c1.close();
      afirma(e1.length === 0, 'nenhum erro de JS (' + e1.length + ')');
    }

    console.log('\n== Rascunho antigo: versão-base ≠ versão publicada ==');
    {
      const fab = JSON.parse(JSON.stringify(fabrica));
      const v2 = JSON.parse(JSON.stringify(fab)); v2.find((r) => r.codigo === 'UNIDADE_VALOR_ASSOCIADA').condicoes.all.push({ campo: 'P13', valor: 'NAO' });
      const rasc = JSON.parse(JSON.stringify(v2));
      const cfgM = { versaoPublicada: 2, versoes: { 2: { regras: v2, publicadoEm: '2026-10-04T10:00:00.000Z', publicadoPor: { email: 'outra@previ.com.br' } } },
        rascunho: { regras: rasc, versaoBase: 1, atualizadoEm: '2026-10-03T10:00:00.000Z', atualizadoPor: { email: EMAIL } } };
      const { ctx: c2, page: p2, erros: e2 } = await abrir(browser, viewport, cfgM);
      await p2.waitForTimeout(500);
      await p2.click('#avpMotorArqEditarBtn');
      await p2.waitForSelector('.sq-cond-select');
      afirma(await p2.locator('#avpMotorArqBaseAntiga').count() === 1 && /iniciado sobre a versão 1/.test(await p2.locator('#avpMotorArqBaseAntiga').innerText()), 'aviso: o rascunho foi iniciado sobre a versão 1 e a publicada agora é a 2');
      afirma(JSON.stringify(await novasDe(p2, 'UNIDADE_VALOR_ASSOCIADA')) === '["P13"]', 'NOVA é comparada com a versão-base 1 do rascunho (não com a 2, que já tem P13)');
      await p2.click('#avpMotorArqCancelarBtn');
      await c2.close();
      afirma(e2.length === 0, 'nenhum erro de JS (' + e2.length + ')');
    }
    console.log('\n== Versão-base indisponível: nada é removível ==');
    {
      const fab = JSON.parse(JSON.stringify(fabrica));
      const rasc = JSON.parse(JSON.stringify(fab)); rasc.find((r) => r.codigo === 'UNIDADE_VALOR_ASSOCIADA').condicoes.all.push({ campo: 'P13', valor: 'NAO' });
      const cfgM = { rascunho: { regras: rasc, versaoBase: 7, atualizadoEm: '2026-10-03T10:00:00.000Z', atualizadoPor: { email: EMAIL } } };
      const { ctx: c3, page: p3, erros: e3 } = await abrir(browser, viewport, cfgM);
      await p3.waitForTimeout(500);
      await p3.click('#avpMotorArqEditarBtn');
      await p3.waitForSelector('.sq-cond-select');
      afirma(await p3.locator('#avpMotorArqSemBase').count() === 1 && await p3.locator('.sq-cond-remover').count() === 0 && await p3.locator('.sq-cond-folha--nova').count() === 0, 'sem a versão-base: aviso claro, nenhuma condição marcada NOVA, nenhum "Remover"');
      await p3.click('#avpMotorArqCancelarBtn');
      await c3.close();
      afirma(e3.length === 0, 'nenhum erro de JS (' + e3.length + ')');
    }
  }
  await browser.close();
  console.log('\n============================\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
