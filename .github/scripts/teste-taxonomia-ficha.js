/* TAXONOMIA — o redesenho em três espaços (Catálogo, Administração, Integridade e configurações), nos DOIS domínios,
 * desktop e 375 px. CONTEÚDO 100% FICTÍCIO (semente-taxonomia-ficha.js: a mesma estrutura do banco real). Firebase falso
 * em persistência real; hermético (sem rede, sem segredo). Prova:
 *   A. CATÁLOGO: abre em consulta; busca por nome e por código (o campo não perde o foco); a ficha mostra SOMENTE nome
 *      e localização, "O que é?" (a definição oficial, uma vez), hierarquia clicável, "Comparar" e — para quem pode —
 *      "Administrar conceito". Nada de pergunta, critérios, observações, perfil, relações, histórico, códigos, proteção,
 *      integração ou botões de edição. Conceito sem definição: "Não há definição oficial disponível".
 *   B. COMPARAR: duas definições oficiais do mesmo domínio, com a hierarquia; definição ausente → a frase de limitação;
 *      no celular, um após o outro; nada é gravado.
 *   C. ADMINISTRAÇÃO: "Administrar — <nome>", quatro áreas no organizacional (duas no arquitetural), "Voltar ao catálogo"
 *      mantém o conceito; Conteúdo edita informações (grava e audita); Relações registradas entre conceitos (frase sem
 *      códigos, aviso de que não é regra universal nem relação entre áreas reais, Substituir com o efeito explicado,
 *      cancelar não grava, concorrência, clique repetido); Histórico recolhido com registro inicial e detalhes técnicos;
 *      governança secundária e protegida.
 *   D. INTEGRIDADE: só por "Integridade e configurações"; 11 de 11 e 10 de 10 discretos, listas recolhidas, exportação e
 *      histórico global (com volta à Integridade).
 *   E. Somente leitura: consulta completa, sem administração nem integridade. Sem rolagem lateral; sem erro de JS. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');
const S = require('./semente-taxonomia-ficha');
const T = require('./taxonomia-tela');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const EMAIL = S.EMAIL;
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };
const EC = 'ESTRATEGIA_CLIENTES', PHT = 'PLATAFORMA_HABILITADORA_TECNOLOGIA';

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }
function banco() {
  const adm = {}; adm[chave(EMAIL)] = { email: EMAIL, name: 'ADMIN' };
  const users = {}; users[chave(EMAIL)] = { name: 'ADMIN', email: EMAIL, area: 'INFOR' };
  const db = Object.assign({ 'fa-users': users, 'fa-admins': adm, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {} }, S.semente());
  delete db.taxonomia.organizacional.conceitos.DISCIPLINA.definicao; /* um conceito sem definição oficial */
  delete db.taxonomia.organizacional.definicoes.DISCIPLINA;
  return db;
}
async function abrir(browser, viewport) {
  const cfg = { db: banco(), user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify(cfg) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html#admin', { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  await page.waitForSelector('.admin-tab-btn[data-panel="adminPanelTaxonomia"]', { state: 'visible', timeout: 12000 });
  await page.click('.admin-tab-btn[data-panel="adminPanelTaxonomia"]');
  await page.waitForSelector('.tax-item[data-codigo="' + EC + '"]', { timeout: 8000 });
  return { ctx, page, erros };
}
const texto = (page, sel) => page.locator(sel).innerText();
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const escritas = (page) => page.evaluate(() => (window.__ESCRITAS || []).length);
const db = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const visiveis = (page, sel) => page.locator(sel).evaluateAll((els) => els.filter((e) => e.offsetParent !== null).map((e) => e.getAttribute('data-codigo')));

(async () => {
  const browser = await chromium.launch();
  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    const movel = viewport.width <= 720;
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros } = await abrir(browser, viewport);

    console.log('\n== A. Catálogo: abre em consulta ==');
    afirma(/Catálogo de conceitos/.test(await texto(page, '#taxLocal')) && await page.locator('.tax-dominio[aria-selected="true"]').count() === 1, 'abre no Catálogo, com o seletor de domínio');
    afirma(await page.locator('#taxConceitosBase, #taxConceitosBasePos, #taxExportar, #taxImportador, #taxAcoesGerais, #taxProtecaoIncompleta').count() === 0, 'nenhum painel de integração, exportação ou carga no Catálogo');
    afirma(await page.locator('#taxIntegridadeLink .tax-ponto--ok').count() === 1, 'só um link discreto "Integridade e configurações" (indicador de situação)');

    console.log('\n== A. Busca por nome e por código ==');
    if (movel) afirma(await page.locator('#taxBusca').isVisible(), '375 px: a busca aparece com a lista, em largura total');
    await page.click('#taxBusca');
    await page.keyboard.type('clientes');
    afirma(await page.evaluate(() => document.activeElement && document.activeElement.id === 'taxBusca'), 'o campo não perde o foco enquanto se digita');
    afirma(JSON.stringify(await visiveis(page, '.tax-item')) === JSON.stringify([EC]) && /1 conceito encontrado/.test(await texto(page, '#taxBuscaResultado')), 'busca por nome: só "Linhas de Estratégia de Clientes"');
    afirma(/em Linhas \(fictício\)/.test(await texto(page, '.tax-item[data-codigo="' + EC + '"]')), 'o resultado diz onde o conceito fica');
    await page.fill('#taxBusca', 'plataforma_canais');
    afirma(JSON.stringify(await visiveis(page, '.tax-item')) === JSON.stringify(['PLATAFORMA_CANAIS']), 'busca por código (sem distinguir maiúsculas)');
    await page.fill('#taxBusca', 'zzz');
    afirma(/Nenhum conceito com esse nome ou código/.test(await texto(page, '#taxBuscaResultado')), 'sem resultado: aviso claro');
    await page.fill('#taxBusca', '');
    afirma((await page.locator('.tax-item').count()) === 13 && await page.locator('.tax-lista-grupo').count() === 2, 'busca vazia: a lista hierárquica volta (13 conceitos, grupos)');

    console.log('\n== A. Ficha de consulta: só o essencial ==');
    await T.abrirConceito(page, 'LINHA');
    if (movel) afirma(await page.locator('.tax-lista').isHidden() && await page.locator('.tax-voltar').isVisible() && /Voltar aos conceitos/.test(await texto(page, '.tax-voltar')), '375 px: a ficha abre em visualização própria, com "Voltar aos conceitos"');
    else afirma(await page.locator('.tax-lista').isVisible() && await page.locator('.tax-ficha').isVisible(), 'desktop: lista à esquerda, ficha à direita');
    afirma(/Organizacional\s*›\s*Linhas \(fictício\)/.test(await texto(page, '#taxTrilha')) && (await texto(page, '.tax-ficha .tax-titulo')).trim() === 'Linhas (fictício)', 'nome em destaque e a localização');
    afirma((await texto(page, '#taxDefinicaoTexto')).trim() === 'Definição fictícia de Linhas (fictício).' && /^O que é\?/.test((await texto(page, '#taxSecDefinicao h4')).trim()), '"O que é?" com a definição oficial');
    const secoes = await page.locator('.tax-ficha > section.tax-sec').evaluateAll((els) => els.map((e) => e.id));
    afirma(JSON.stringify(secoes) === JSON.stringify(['taxSecDefinicao', 'taxSecHierarquia', 'taxSecComparar']), 'a ficha tem SOMENTE: definição, hierarquia e comparar', secoes.join(','));
    const ficha = await texto(page, '.tax-ficha');
    afirma(!/LINHA\b|Código|Camada|Situação|ligado ao|Protegido|Pergunta|Critério|Observação|Perfil|atributo|Relaç|Histórico|conectad|Papel|Origem|Sem registro/i.test(ficha), 'nada de códigos, proteção, pergunta, critérios, observações, perfil, relações, histórico ou integração', ficha.slice(0, 300));
    afirma(await page.locator('.tax-ficha [data-tax="editar-conceito"], .tax-ficha [data-tax="inativar"], .tax-ficha [data-tax="alterar-camada"], .tax-ficha [data-tax="atualizar-definicao"], .tax-ficha [data-tax="gerenciar-perfil"]').count() === 0, 'nenhum botão de edição na consulta');
    afirma(await page.locator('#taxAdministrarBtn').isVisible() && !(await page.locator('#taxAdministrarBtn').evaluate((b) => b.classList.contains('btn--primary'))), '"Administrar conceito": ação secundária, para quem pode');
    afirma(/Especializações/.test(await texto(page, '#taxHierFilhos')) && await page.locator('#taxHierFilhos [data-tax="selecionar"]').count() === 3, 'hierarquia: as 3 especializações, clicáveis');
    await page.click('#taxHierFilhos [data-codigo="' + EC + '"]');
    await esperarCondicao(page, (c) => (document.querySelector('.tax-item--ativo') || {}).getAttribute && document.querySelector('.tax-item--ativo').getAttribute('data-codigo') === c, EC, { descricao: 'navegou pela hierarquia' });
    afirma(/Faz parte de\s*Linhas \(fictício\)/.test(await texto(page, '#taxHierPai')), 'navegar pela hierarquia: a filha mostra "Faz parte de"');
    await page.click('#taxHierPai [data-tax="selecionar"]');
    await esperarCondicao(page, () => (document.querySelector('.tax-ficha .tax-titulo') || {}).textContent === 'Linhas (fictício)', null, { descricao: 'voltou ao pai' });
    afirma(true, 'e "Faz parte de" volta ao pai');
    await T.abrirConceito(page, 'DISCIPLINA');
    afirma(/Não há definição oficial disponível para este conceito/.test(await texto(page, '#taxSemDefinicao')), 'sem definição: "Não há definição oficial disponível" (nada inventado)');

    console.log('\n== B. Comparar ==');
    await T.abrirConceito(page, EC);
    const e0 = await escritas(page);
    await page.click('#taxCompararBtn');
    afirma(await page.locator('#taxCompararSel option[value="' + EC + '"]').count() === 0 && await page.locator('#taxCompararSel option[value="produto-principal"]').count() === 0, 'escolhe entre os outros conceitos do MESMO domínio');
    await page.selectOption('#taxCompararSel', 'NEGOCIOS');
    const cols = await page.locator('#taxCompararGrade .tax-comparar-col').evaluateAll((els) => els.map((e) => ({ t: e.getBoundingClientRect().top, b: e.getBoundingClientRect().bottom, txt: e.innerText })));
    afirma(cols.length === 2 && /Linhas de Estratégia de Clientes/.test(cols[0].txt) && cols[0].txt.indexOf(S.DEF_EC) !== -1 && /Linhas de Negócios/.test(cols[1].txt) && /Faz parte de Linhas \(fictício\)/.test(cols[1].txt), 'as duas definições oficiais completas, com a hierarquia');
    afirma(await page.locator('#taxCompararInsuficiente').count() === 0 && !/pertence|é uma|portanto/i.test(await texto(page, '#taxSecComparar')), 'sem diferença inventada nem conclusão automática');
    if (movel) afirma(cols[1].t >= cols[0].b - 1, '375 px: um conceito após o outro, não em colunas estreitas');
    else afirma(Math.abs(cols[1].t - cols[0].t) < 2, 'desktop: lado a lado');
    await page.selectOption('#taxCompararSel', 'DISCIPLINA');
    afirma(/As definições disponíveis não são suficientes para estabelecer uma distinção clara\. Essa diferenciação depende de revisão arquitetural\./.test(await texto(page, '#taxCompararInsuficiente')), 'definição ausente: a frase de limitação, literal');
    afirma(await escritas(page) === e0, 'comparar não grava nada');
    afirma(await larguraOk(page), 'comparação: sem rolagem lateral');
    await page.click('#taxCompararFechar');
    afirma(await page.locator('#taxCompararGrade').count() === 0 && await page.locator('#taxCompararBtn').isVisible(), '"Fechar comparação" volta à ficha');

    console.log('\n== C. Administração ==');
    await T.administrar(page);
    afirma((await texto(page, '#taxAdminTitulo')).trim() === 'Administrar — Linhas de Estratégia de Clientes' && /Administração/.test(await texto(page, '#taxLocal')), 'título "Administrar — <nome>" e localização');
    afirma(JSON.stringify(await page.locator('.tax-admin-aba').allTextContents()) === JSON.stringify(['Conteúdo', 'Perfil', 'Relações', 'Histórico e governança']), 'quatro áreas no organizacional');
    afirma(await page.locator('#taxSecIdent').count() === 1 && /ESTRATEGIA_CLIENTES/.test(await texto(page, '#taxCodigo')) && await page.locator('#taxAtualizarDefinicaoBtn').isVisible() && await page.locator('#taxEditarInfoBtn').isVisible(), 'Conteúdo: identificação (com o código), definição com "Atualizar definição" e "Editar informações", separados');
    afirma(/Pergunta fictícia/.test(await texto(page, '#taxSecPergunta')) && /Critério fictício 3/.test(await texto(page, '#taxSecPergunta')), 'pergunta, critérios e observações continuam disponíveis aqui');
    await page.click('#taxEditarInfoBtn');
    await page.fill('#taxF_criterios', 'Critério fictício 1: compreende públicos.\nCritério fictício novo.');
    await page.click('#taxSecPergunta [data-tax="salvar-edicao"]');
    await esperarCondicao(page, () => /Critério fictício novo/.test((document.getElementById('taxSecPergunta') || {}).innerText || '') && !document.getElementById('taxFormConceito'), null, { descricao: 'informações salvas' });
    let d = await db(page);
    afirma(Object.keys(d.taxonomia.organizacional.conceitos[EC].criterios).length === 2 && Object.values(d.taxonomia.organizacional.auditoria[EC]).some((e) => e.campo === 'criterios' && e.dataHora > '2026-10-10') && d.taxonomia.organizacional.conceitos[EC].definicao.texto === S.DEF_EC, 'Editar informações grava e audita, sem tocar na definição');
    await T.abaAdmin(page, 'historico');
    afirma(/^Histórico — 7 alterações$/.test((await texto(page, '#taxHistoricoConceito > summary')).trim()) && !(await page.locator('#taxHistoricoConceito').evaluate((x) => x.open)), 'Histórico: recolhido, com a contagem real');
    await page.click('#taxHistoricoConceito > summary');
    afirma(/Registro inicial da definição \(versão 1\)/.test(await texto(page, '#taxSecHistorico')) && /Detalhes técnicos anteriores à simplificação \(3\)/.test(await texto(page, '#taxHistLegado > summary')), 'registro inicial ≠ alteração; detalhes técnicos sob demanda');
    afirma(/Situação do conceito/.test(await texto(page, '#taxSecIdentAcoes')) && await page.locator('#taxSecIdentAcoes .btn--primary').count() === 0, 'governança secundária (nenhuma ação principal)');
    await page.click('#taxInativarBtn');
    await page.waitForSelector('#taxInativarBloqueado', { timeout: 4000 });
    afirma(/não pode ser inativado/.test(await texto(page, '#taxInativarBloqueado')) && await page.locator('[data-tax="confirmar-inativar"]').count() === 0, 'conceito vinculado: inativar só explica (protegido)');
    await page.click('[data-tax="cancelar-inativar"]');
    await T.voltarCatalogo(page);
    afirma(await page.locator('.tax-item--ativo[data-codigo="' + EC + '"]').count() === 1 && /Catálogo de conceitos/.test(await texto(page, '#taxLocal')), '"Voltar ao catálogo" mantém o conceito selecionado');

    console.log('\n== C. Relações registradas entre conceitos ==');
    await T.abrirAdmin(page, PHT, 'relacoes');
    afirma(/Relações registradas entre conceitos \(2\)/.test(await texto(page, '#taxSecRelacoes h4')), 'título "Relações registradas entre conceitos (2)"');
    const frases = (await page.locator('#taxRelLista .tax-rel-frase').allInnerTexts()).map((x) => x.replace(/\s+/g, ' ').trim());
    afirma(frases.includes('Linhas de Plataforma Habilitadora de Tecnologia — atende — Área Especializada'), 'origem — tipo — destino, em frase', frases.join(' | '));
    afirma(/Não comprovam relações entre áreas concretas da PREVI e não são, por si, regras arquiteturais universais/.test(await texto(page, '#taxRelNatureza')) && !/PLATAFORMA_HABILITADORA|AREA_ESPECIALIZADA|regra do modelo|a confirmar|validada|aprovada/i.test(await texto(page, '#taxRelLista')), 'sem códigos e sem estados inventados (regra/a confirmar/validada)');
    const kCoe = PHT + '__atende__COE';
    await page.click('#taxRelLista [data-relacao="' + kCoe + '"] [data-tax="alterar-relacao"]');
    afirma(/Substituir relação/.test(await texto(page, '#taxFormRelacao .tax-form-titulo')) && /a relação atual é encerrada, com o motivo, e a nova é criada/.test(await texto(page, '#taxSubstituirEfeito')), 'Substituir: o efeito explicado antes de confirmar');
    let e1 = await escritas(page);
    await page.click('[data-tax="cancelar-relacao"]');
    afirma(await page.locator('#taxFormRelacao').count() === 0 && await escritas(page) === e1, 'cancelar não grava');
    await page.click('#taxRelLista [data-relacao="' + kCoe + '"] [data-tax="alterar-relacao"]');
    await page.selectOption('#taxR_tipo', 'aloca-em');
    await page.fill('#taxR_motivo', 'Motivo fictício');
    await page.evaluate((k) => { window.__CFG.__dbReal.taxonomia.organizacional.relacoes[k].encerrada = { motivo: 'outra pessoa (fictício)', em: '2026-10-16T10:00:00.000Z', por: 'outra@previ.com.br', auditoriaId: '-X' }; }, kCoe);
    e1 = await escritas(page);
    await page.click('[data-tax="salvar-relacao"]');
    await esperarCondicao(page, () => /encerrada por outra pessoa/.test((document.getElementById('taxFormRelacao') || {}).innerText || ''), null, { descricao: 'concorrência ao substituir' });
    afirma(await escritas(page) === e1, 'concorrência: outra pessoa encerrou a relação → nada gravado');
    await page.click('[data-tax="cancelar-relacao"]');
    await page.click('#taxNovaRelacaoBtn');
    await page.selectOption('#taxR_tipo', 'atende');
    await page.selectOption('#taxR_outro', 'NEGOCIOS');
    await page.evaluate(() => { const b = document.querySelector('[data-tax="salvar-relacao"]'); b.click(); b.click(); });
    await esperarCondicao(page, () => !!window.__CFG.__dbReal.taxonomia.organizacional.relacoes.PLATAFORMA_HABILITADORA_TECNOLOGIA__atende__NEGOCIOS && !document.getElementById('taxFormRelacao'), null, { descricao: 'relação criada' });
    d = await db(page);
    afirma(Object.values(d.taxonomia.organizacional.auditoria[PHT] || {}).filter((e) => e.tipo === 'relacao_criada').length === 1, 'nova relação: clique repetido grava uma vez');
    afirma(await larguraOk(page), 'relações: sem rolagem lateral');

    console.log('\n== C/A. Domínio arquitetural ==');
    await T.dominio(page, 'arquitetural');
    await T.abrirConceito(page, 'produto-principal');
    afirma(/Arquitetural/.test(await texto(page, '#taxTrilha')) && await page.locator('#taxSecHierarquia').count() === 0 && (await texto(page, '#taxDefinicaoTexto')).trim() === 'Definição fictícia da classificação produto-principal.', 'arquitetural: nome, definição, sem hierarquia (não há)');
    await T.administrar(page);
    afirma(JSON.stringify(await page.locator('.tax-admin-aba').allTextContents()) === JSON.stringify(['Conteúdo', 'Histórico e governança']), 'arquitetural: só Conteúdo e Histórico (o domínio não tem perfil nem relações)');
    afirma(/Protegido: é uma classificação da Avaliação/.test(await texto(page, '#taxSecIdent')), 'a proteção aparece na Administração');

    console.log('\n== D. Integridade e configurações ==');
    await T.irIntegridade(page);
    afirma(/Integridade e configurações/.test(await texto(page, '#taxLocal')) && /^✓ 11 de 11 classificações conectadas$/.test((await texto(page, '#taxIntegracaoResumo')).trim()) && /^✓ 10 de 10 conceitos conectados$/.test((await texto(page, '#taxIntegracaoResumoPos')).trim()), 'Avaliação 11 de 11 e Posicionamento 10 de 10, discretos');
    afirma(!(await page.locator('#taxIntegracaoLista').evaluate((x) => x.open)) && !(await page.locator('#taxIntegracaoListaPos').evaluate((x) => x.open)), 'as listas ficam recolhidas');
    afirma(await page.locator('#taxAcoesGerais #taxExportarExcel').isVisible() && await page.locator('#taxAcoesGerais #taxExportarJson').isVisible() && /Dados e manutenção/.test(await texto(page, '#taxAcoesGerais')), 'Dados e manutenção: exportações');
    await page.click('#taxHistoricoGlobalBtn');
    await page.waitForSelector('#taxHistoricoGlobal', { timeout: 6000 });
    await page.locator('#taxHistoricoGlobal [data-tax="voltar-dominio"]').first().click();
    await page.waitForSelector('#taxIntegracaoResumo', { timeout: 6000 });
    afirma(true, 'histórico global abre e "Voltar à Integridade" retorna');
    afirma(await larguraOk(page), 'integridade: sem rolagem lateral');
    await T.voltarCatalogo(page);
    afirma(await page.locator('#taxConceitosBase').count() === 0, 'de volta ao Catálogo, sem os painéis de integração');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();

    console.log('\n== E. Somente leitura ==');
    const r = await abrir(browser, viewport);
    await T.abrirConceito(r.page, EC);
    await r.page.evaluate(() => window.faTaxonomia.abrir({ somenteLeitura: true }));
    await esperarCondicao(r.page, () => !!document.getElementById('taxDefinicaoTexto') && !document.getElementById('taxAdministrarBtn'), null, { descricao: 'ficha em modo leitura' });
    afirma(await r.page.locator('#taxAdministrarBtn, #taxIntegridadeLink').count() === 0 && await r.page.locator('#taxCompararBtn').isVisible(), 'consulta e comparação continuam; sem administração nem integridade');
    afirma(await larguraOk(r.page), 'sem rolagem lateral');
    await r.ctx.close();
  }
  await browser.close();
  console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
