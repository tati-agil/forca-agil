/* TAXONOMIA — a ficha simplificada do conceito, nos DOIS domínios, desktop e 375 px. CONTEÚDO 100% FICTÍCIO
 * (semente-taxonomia-ficha.js: a mesma estrutura de "Linhas de Estratégia de Clientes"). Firebase falso em persistência
 * real; hermético (sem rede, sem segredo). Prova:
 *   A. Cabeçalho único: nome, código, camada, hierarquia, situação e a proteção em linguagem simples; nenhuma outra
 *      "Identificação" no fim (só a administração discreta: inativar, camada).
 *   B. "Como reconhecer este conceito?": pergunta, critérios e observações, editados ALI ("Editar informações", que
 *      também muda o nome) — grava e audita.
 *   C. Histórico único, recolhido: o que mudou (anterior → novo, campo em português), quem, quando; a versão 1 migrada é
 *      o "Registro inicial" (não conta como alteração); os registros do modelo antigo ficam em "Detalhes técnicos
 *      anteriores à simplificação"; a definição vigente não aparece repetida na ficha.
 *   D. Relações entre conceitos: zero ("Nenhuma relação cadastrada."), uma e várias, em frase com os nomes (sem códigos,
 *      sem grupos vazios), dizendo que são vínculos entre conceitos e não entre áreas reais; UMA ação, "Gerenciar
 *      relações" (nova, substituir com o efeito explicado antes, encerrar, concluir); cancelar não grava; concorrência
 *      (outra pessoa encerrou a relação / registrou a mesma) → nada gravado; clique repetido → uma gravação. O domínio
 *      arquitetural não tem relações nem perfil.
 *   E. Somente leitura: consulta completa, nenhuma ação de edição.
 *   F. Integração completa: "10 de 10 conceitos conectados" / "11 de 11 classificações conectadas", discreto, com a
 *      lista recolhida e códigos e datas nos detalhes administrativos.
 *   G. Sem rolagem horizontal; nenhum erro de JS. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');
const S = require('./semente-taxonomia-ficha');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const EMAIL = S.EMAIL;
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };
const EC = 'ESTRATEGIA_CLIENTES', PHT = 'PLATAFORMA_HABILITADORA_TECNOLOGIA';
const REL = 'taxonomia/organizacional/relacoes/';

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }
function banco() {
  const adm = {}; adm[chave(EMAIL)] = { email: EMAIL, name: 'ADMIN' };
  const users = {}; users[chave(EMAIL)] = { name: 'ADMIN', email: EMAIL, area: 'INFOR' };
  return Object.assign({ 'fa-users': users, 'fa-admins': adm, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {} }, S.semente());
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
async function abreConceito(page, cod) {
  if (!(await page.locator('.tax-item[data-codigo="' + cod + '"]').isVisible())) await page.locator('.tax-detalhe [data-tax="voltar-lista"]').first().click();
  await page.click('.tax-item[data-codigo="' + cod + '"]');
  await esperarCondicao(page, (c) => { const t = document.querySelector('#taxCodigo'); return !!t && t.innerText.indexOf(c) !== -1 && !document.querySelector('.tax-detalhe .loading-msg'); }, cod, { descricao: 'ficha de ' + cod });
}
async function dominio(page, d) {
  if (await page.locator('.tax-detalhe [data-tax="voltar-lista"]').first().isVisible()) await page.locator('.tax-detalhe [data-tax="voltar-lista"]').first().click();
  await page.click('.tax-dominio[data-dominio="' + d + '"]');
  await page.waitForSelector(d === 'arquitetural' ? '.tax-item[data-codigo="componente"]' : '.tax-item[data-codigo="' + EC + '"]', { timeout: 6000 });
}

(async () => {
  const browser = await chromium.launch();
  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros } = await abrir(browser, viewport);

    console.log('\n== F. Integração completa (organizacional) ==');
    await esperarCondicao(page, () => !!document.querySelector('#taxIntegracaoResumoPos[data-estado="ok"]'), null, { descricao: 'integração conferida' });
    afirma(/^✓ 10 de 10 conceitos conectados$/.test((await texto(page, '#taxIntegracaoResumoPos')).trim()) && await page.locator('#taxConceitosBasePos [role="alert"]').count() === 0, '"10 de 10 conceitos conectados", discreto, sem alerta');
    afirma(/utiliza os nomes e as definições oficiais destes conceitos\. Enquanto estiverem vinculados, não podem ser inativados/.test(await texto(page, '#taxIntegracaoAjudaPos')), 'a explicação simples do porquê');
    afirma(!(await page.evaluate(() => document.getElementById('taxIntegracaoListaPos').open)) && /Ver conceitos conectados/.test(await texto(page, '#taxIntegracaoListaPos > summary')), '"Ver conceitos conectados" recolhido');
    afirma(!/ESTRATEGIA_CLIENTES|ligado ao Posicionamento|\d{2}\/\d{2}\/\d{4}/.test(await texto(page, '#taxConceitosBasePos')), 'sem códigos, datas nem selos repetidos à vista');
    await page.click('#taxIntegracaoListaPos > summary');
    await page.click('#taxIntegracaoAdmPos > summary');
    afirma(/ESTRATEGIA_CLIENTES\s*vínculo registrado em \d{2}\/\d{2}\/\d{4}/.test(await texto(page, '#taxIntegracaoAdmPos')), 'códigos e datas só nos detalhes administrativos');
    afirma(await larguraOk(page), 'integração aberta: sem rolagem horizontal');

    console.log('\n== A. Cabeçalho ==');
    await abreConceito(page, EC);
    afirma((await texto(page, '.tax-detalhe .tax-titulo')).trim() === 'Linhas de Estratégia de Clientes', 'o nome em destaque');
    const cab = await texto(page, '#taxSecIdent');
    afirma(/Código:\s*ESTRATEGIA_CLIENTES/.test(cab) && /Camada:\s*Especialização/.test(cab) && /Situação:\s*ativo/.test(cab) && /Hierarquia:\s*Linhas \(fictício\) › Linhas de Estratégia de Clientes/.test(cab), 'código, camada, situação e hierarquia, compactos', cab.replace(/\s+/g, ' '));
    afirma(/Protegido: é um tipo de estrutura do Posicionamento Organizacional, por isso não pode ser inativado nem mudar de camada/.test(cab), 'a proteção em linguagem simples');
    afirma(await page.locator('.tax-detalhe h4').evaluateAll((hs) => hs.filter((h) => /^Identificação/.test(h.textContent.trim())).length) === 0, 'nenhuma outra seção "Identificação" na ficha');
    afirma(/Administração do conceito/i.test(await texto(page, '#taxSecIdentAcoes')) && await page.locator('#taxSecIdentAcoes [data-tax="editar-conceito"]').count() === 0, 'no fim, só a administração discreta (inativar, camada)');
    const ordem = await page.evaluate(() => ['taxSecIdent', 'taxSecDefinicao', 'taxSecPergunta', 'taxSecAtributos', 'taxSecRelacoes', 'taxSecIdentAcoes', 'taxSecHistorico'].map((id) => { const e = document.getElementById(id); return e ? e.getBoundingClientRect().top : null; }));
    afirma(ordem.every((y, i) => y !== null && (i === 0 || y > ordem[i - 1])), 'ordem: cabeçalho, definição, como reconhecer, perfil, relações, administração, histórico', JSON.stringify(ordem));

    console.log('\n== C. Histórico único ==');
    afirma(/^Histórico — 6 alterações$/.test((await texto(page, '#taxHistoricoConceito > summary')).trim()) && !(await page.evaluate(() => document.getElementById('taxHistoricoConceito').open)), '"Histórico — 6 alterações", recolhido (registro inicial e modelo antigo não contam)');
    await page.click('#taxHistoricoConceito > summary');
    const hist = await texto(page, '#taxSecHistorico');
    afirma(/Nome: Estratégia de Clientes → Linhas de Estratégia de Clientes/.test(hist) && /Critérios:/.test(hist) && /Pergunta discriminadora:/.test(hist) && !/criterios:|perguntaDiscriminadora:|observacoes:/.test(hist), 'o que mudou, anterior → novo, com o campo em português', hist.slice(0, 400));
    afirma(/Registro inicial da definição \(versão 1\)/.test(hist) && /Não é uma alteração/.test(hist) && !(await page.evaluate(() => document.querySelector('#taxHistInicial details').open)), 'a versão 1 migrada é o registro inicial; o texto fica em "Ver texto"');
    afirma(!(await page.evaluate(() => document.getElementById('taxHistLegado').open)) && /Detalhes técnicos anteriores à simplificação \(3\)/.test(await texto(page, '#taxHistLegado > summary')) && !/nova fonte|Definição vigente \(modelo antigo\)/.test(await page.locator('#taxHistoricoConceito > .tax-hist-lista').innerText()), 'criação de fonte e troca de vigência ficam em "Detalhes técnicos…" (3), recolhido, fora da lista principal');
    const vezes = (await texto(page, '.tax-detalhe')).split(S.DEF_EC).length - 1;
    afirma(vezes === 1, 'a definição vigente aparece uma vez só na ficha (com o histórico aberto)', String(vezes));
    await page.click('#taxHistLegado > summary');
    afirma(/Texto que passou a valer:/.test(await texto(page, '#taxHistLegado')), 'os detalhes técnicos continuam completos, sob demanda');

    console.log('\n== B. Como reconhecer: consulta e edição no lugar ==');
    const rec = await texto(page, '#taxSecPergunta');
    afirma(/^Como reconhecer este conceito\?/.test(rec.trim()) && /Pergunta fictícia/.test(rec) && /Critério fictício 3/.test(rec) && /Observação fictícia/.test(rec), 'pergunta, critérios e observações juntos');
    await page.click('#taxEditarInfoBtn');
    await page.waitForSelector('#taxSecPergunta #taxFormConceito', { timeout: 4000 });
    afirma(await page.locator('#taxSecPergunta #taxF_nome').count() === 1 && await page.locator('#taxSecPergunta #taxF_perguntaDiscriminadora').count() === 1 && await page.locator('#taxSecPergunta #taxF_criterios').count() === 1, 'o formulário abre na própria seção (nome, pergunta, critérios…)');
    await page.fill('#taxF_criterios', 'Critério fictício 1: compreende públicos.\nCritério fictício 2: organiza segmentos.\nCritério fictício 3: orienta decisões.\nCritério fictício 4: novo.');
    await page.click('#taxSecPergunta [data-tax="salvar-edicao"]');
    await esperarCondicao(page, () => /Critério fictício 4/.test((document.getElementById('taxSecPergunta') || {}).innerText || '') && !document.getElementById('taxFormConceito'), null, { descricao: 'critérios salvos' });
    let d = await db(page);
    afirma(Object.keys(d.taxonomia.organizacional.conceitos[EC].criterios).length === 4 && Object.values(d.taxonomia.organizacional.auditoria[EC]).some((e) => e.campo === 'criterios' && e.dataHora > '2026-10-10'), 'gravado e auditado');
    afirma(d.taxonomia.organizacional.conceitos[EC].definicao.texto === S.DEF_EC, 'a definição não é tocada por "Editar informações"');

    console.log('\n== D. Relações entre conceitos ==');
    afirma(/Relações entre conceitos \(0\)/.test(await texto(page, '#taxSecRelacoes h4')) && /Nenhuma relação cadastrada\./.test(await texto(page, '#taxSecRelacoes')) && await page.locator('#taxRelSaida, #taxRelEntrada, #taxRelLista').count() === 0, 'zero: "Nenhuma relação cadastrada.", sem grupos vazios');
    await abreConceito(page, 'AREA_ESPECIALIZADA');
    afirma(/Relações entre conceitos \(1\)/.test(await texto(page, '#taxSecRelacoes h4')) && (await texto(page, '#taxRelLista .tax-rel-frase')).trim() === 'Linhas de Plataforma Habilitadora de Tecnologia atende Área Especializada', 'uma: "Linhas de Plataforma Habilitadora de Tecnologia atende Área Especializada"');
    afirma(/não são relações operacionais entre áreas concretas da PREVI/.test(await texto(page, '#taxRelNatureza')) && !/PLATAFORMA_HABILITADORA_TECNOLOGIA|AREA_ESPECIALIZADA/.test(await texto(page, '#taxSecRelacoes')), 'vínculo entre conceitos (não entre áreas reais), sem códigos técnicos');
    afirma(await page.locator('#taxSecRelacoes button').count() === 1 && await page.locator('#taxGerenciarRelacoesBtn').isVisible(), 'na consulta, UMA ação: "Gerenciar relações"');
    await abreConceito(page, 'LINHA');
    const fr = await page.locator('#taxRelLista .tax-rel-frase').allInnerTexts();
    afirma(fr.length === 2 && fr.includes('Linhas de Plataforma (fictício) atende Linhas (fictício)') && fr.includes('Squad (fictício) compõe Linhas (fictício)') && /Nota fictícia da relação/.test(await texto(page, '#taxRelLista')), 'várias: cada uma em frase, com a nota', fr.join(' | '));
    await abreConceito(page, PHT);
    afirma(await page.locator('#taxRelLista .tax-rel-item').count() === 2, 'a Plataforma Habilitadora de Tecnologia tem as suas 2 relações');
    await page.click('#taxGerenciarRelacoesBtn');
    afirma(await page.locator('#taxRelLista [data-tax="alterar-relacao"]').count() === 2 && await page.locator('#taxRelLista [data-tax="encerrar-relacao"]').count() === 2 && await page.locator('#taxNovaRelacaoBtn').isVisible() && await page.locator('#taxFecharRelacoesBtn').isVisible(), '"Gerenciar relações": Substituir e Encerrar em cada uma, Nova relação, Concluir');
    afirma(await larguraOk(page), 'gerenciar relações: sem rolagem horizontal');
    const kCoe = PHT + '__atende__COE';
    await page.click('#taxRelLista [data-relacao="' + kCoe + '"] [data-tax="alterar-relacao"]');
    afirma(/a relação atual é encerrada, com o motivo, e a nova é criada — numa gravação só/.test(await texto(page, '#taxSubstituirEfeito')), 'Substituir: o efeito explicado antes da confirmação');
    let e0 = await escritas(page);
    await page.click('[data-tax="cancelar-relacao"]');
    afirma(await page.locator('#taxFormRelacao').count() === 0 && await escritas(page) === e0, 'cancelar não grava nada');
    /* concorrência: outra pessoa encerra a relação enquanto o formulário de substituir está aberto */
    await page.click('#taxRelLista [data-relacao="' + kCoe + '"] [data-tax="alterar-relacao"]');
    await page.selectOption('#taxR_tipo', 'aloca-em');
    await page.fill('#taxR_motivo', 'Motivo fictício');
    await page.evaluate((k) => { window.__CFG.__dbReal.taxonomia.organizacional.relacoes[k].encerrada = { motivo: 'outra pessoa (fictício)', em: '2026-10-16T10:00:00.000Z', por: 'outra@previ.com.br', auditoriaId: '-X' }; }, kCoe);
    e0 = await escritas(page);
    await page.click('[data-tax="salvar-relacao"]');
    await esperarCondicao(page, () => /encerrada por outra pessoa/.test((document.getElementById('taxFormRelacao') || {}).innerText || ''), null, { descricao: 'aviso de concorrência (substituir)' });
    d = await db(page);
    afirma(await escritas(page) === e0 && !d.taxonomia.organizacional.relacoes[PHT + '__aloca-em__COE'], 'outra pessoa encerrou a relação: nada gravado, aviso claro');
    await page.click('[data-tax="cancelar-relacao"]');
    /* nova relação: clique repetido grava uma vez; outra pessoa registrando a mesma → nada gravado */
    await page.click('#taxNovaRelacaoBtn');
    await page.selectOption('#taxR_tipo', 'atende');
    await page.selectOption('#taxR_outro', 'NEGOCIOS');
    await page.evaluate(() => { const b = document.querySelector('[data-tax="salvar-relacao"]'); b.click(); b.click(); });
    await esperarCondicao(page, () => !!window.__CFG.__dbReal.taxonomia.organizacional.relacoes['PLATAFORMA_HABILITADORA_TECNOLOGIA__atende__NEGOCIOS'] && !document.getElementById('taxFormRelacao'), null, { descricao: 'relação criada' });
    d = await db(page);
    afirma(Object.values(d.taxonomia.organizacional.auditoria[PHT] || {}).filter((e) => e.tipo === 'relacao_criada').length === 1, 'clique repetido: uma relação e um evento de auditoria');
    await esperarCondicao(page, () => !!document.getElementById('taxNovaRelacaoBtn'), null, { descricao: 'gerenciar relações ainda aberto' });
    await page.click('#taxNovaRelacaoBtn');
    await page.selectOption('#taxR_tipo', 'atende');
    await page.selectOption('#taxR_outro', 'PLATAFORMA_CANAIS');
    await page.evaluate((r) => { window.__CFG.__dbReal.taxonomia.organizacional.relacoes[r] = { de: 'PLATAFORMA_HABILITADORA_TECNOLOGIA', tipo: 'atende', para: 'PLATAFORMA_CANAIS', criadaEm: '2026-10-16T10:00:00.000Z', criadaPor: 'outra@previ.com.br', auditoriaId: '-Y' }; }, PHT + '__atende__PLATAFORMA_CANAIS');
    e0 = await escritas(page);
    await page.click('[data-tax="salvar-relacao"]');
    await esperarCondicao(page, () => /Outra pessoa já registrou esta relação/.test((document.getElementById('taxFormRelacao') || {}).innerText || ''), null, { descricao: 'aviso de concorrência (nova)' });
    afirma(await escritas(page) === e0, 'outra pessoa registrou a mesma relação: nada gravado');
    await page.click('[data-tax="cancelar-relacao"]');
    await page.click('#taxFecharRelacoesBtn');
    afirma(await page.locator('#taxSecRelacoes [data-tax="alterar-relacao"], #taxNovaRelacaoBtn').count() === 0 && await page.locator('#taxGerenciarRelacoesBtn').isVisible(), '"Concluir" volta à consulta');

    console.log('\n== Arquitetural: mesma ficha, sem perfil nem relações ==');
    await dominio(page, 'arquitetural');
    await esperarCondicao(page, () => !!document.querySelector('#taxIntegracaoResumo[data-estado="ok"]'), null, { descricao: 'integração da Avaliação conferida' });
    afirma(/^✓ 11 de 11 classificações conectadas$/.test((await texto(page, '#taxIntegracaoResumo')).trim()) && /A Avaliação utiliza os nomes e as definições oficiais destes conceitos\. Enquanto estiverem vinculados, não podem ser inativados\./.test(await texto(page, '#taxIntegracaoAjuda')), 'Integração com a Avaliação: "11 de 11 classificações conectadas" e a explicação pedida');
    await abreConceito(page, 'componente');
    afirma(/Protegido: é uma classificação da Avaliação de Produto\/Serviço/.test(await texto(page, '#taxSecIdent')) && await page.locator('#taxSecAtributos, #taxSecRelacoes').count() === 0, 'cabeçalho com a proteção; sem perfil nem relações (o domínio não tem)');
    afirma(/Como reconhecer este conceito\?/.test(await texto(page, '#taxSecPergunta')) && /Critério arquitetural fictício/.test(await texto(page, '#taxSecPergunta')) && await page.locator('#taxEditarInfoBtn').isVisible(), '"Como reconhecer" com os critérios e "Editar informações"');
    afirma(/^Histórico — 1 alteração$/.test((await texto(page, '#taxHistoricoConceito > summary')).trim()) && /Detalhes técnicos anteriores à simplificação \(2\)/.test(await page.locator('#taxHistLegado > summary').textContent()), 'histórico: 1 alteração + 2 registros técnicos antigos à parte');
    afirma(await larguraOk(page), 'sem rolagem horizontal');

    console.log('\n== E. Somente leitura ==');
    await dominio(page, 'organizacional');
    await abreConceito(page, PHT);
    await page.evaluate(() => window.faTaxonomia.abrir({ somenteLeitura: true }));
    await esperarCondicao(page, () => !!document.getElementById('taxRelLista') && !document.getElementById('taxGerenciarRelacoesBtn'), null, { descricao: 'ficha em modo leitura' });
    afirma(await page.locator('#taxRelLista .tax-rel-item').count() >= 2 && await page.locator('#taxGerenciarRelacoesBtn, #taxEditarInfoBtn, #taxGerenciarPerfilBtn, #taxSecIdentAcoes, #taxAtualizarDefinicaoBtn').count() === 0, 'consulta completa, nenhuma ação de edição');
    afirma(await larguraOk(page), 'sem rolagem horizontal');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }
  await browser.close();
  console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
