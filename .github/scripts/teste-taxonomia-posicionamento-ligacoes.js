/* TAXONOMIA — "Conceitos-base do Posicionamento Organizacional" (PR D), na tela. Desktop e 375 px.
 * CONTEÚDO FICTÍCIO. Firebase falso em persistência real; hermético (sem rede, sem segredo). A trava de verdade
 * (regras do banco) é provada no emulador em teste-rules-taxonomia-governanca.js, seção F.
 *
 *   1. Aviso "Proteção do Posicionamento incompleta: X de 10 conceitos ligados." enquanto faltar ligação.
 *   2. No domínio organizacional: exatamente os 10 códigos do motor de Posicionamento (vindos do catálogo do
 *      motor, nunca SQUAD/CAPITULO/DISCIPLINA), com os estados ligado (e a data) / sem ligação / sem conceito /
 *      conceito inativo; o arquitetural continua com os Conceitos-base da Avaliação.
 *   3. "Registrar ligações do Posicionamento…" mostra a prévia e NADA é gravado antes de confirmar (nem ao
 *      cancelar); confirmar grava, numa gravação só, as ligações válidas + auditoria (sem nome nem definição);
 *      depois não sobra nada a registrar e rodar de novo não grava nada (idempotente).
 *   4. Conceito ligado: "Inativar" e "Alterar camada" só explicam e não gravam; conceito não ligado segue normal.
 *   5. Sem rolagem horizontal; nenhum erro de JS. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const MOTOR = require(path.join(__dirname, '..', '..', 'forca-agil', 'motor-posicionamento.js'));
const DEZ = MOTOR.CODIGOS_INTERMEDIARIOS.concat(MOTOR.CODIGOS_FIRMES);
const EMAIL = 'adm@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };
const QUANDO = '2026-10-01T09:00:00.000Z';

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

const org = (nome, extra) => Object.assign({ nome, ordem: 1, ativo: true, situacaoDefinicao: 'em revisão', camada: 'B' }, extra || {});
const AUSENTE = 'PLATAFORMA_HABILITADORA_TECNOLOGIA';
const INATIVO = 'PLATAFORMA_HABILITADORA_NEGOCIOS';
const JA_LIGADO = 'COE';
const semente = () => {
  const adm = {}; adm[chave(EMAIL)] = { email: EMAIL, name: 'ADMIN' };
  const users = {}; users[chave(EMAIL)] = { name: 'ADMIN', email: EMAIL, area: 'INFOR' };
  const conceitos = {
    LINHA: org('Linha Fictícia', { camada: 'A' }), ESTRATEGIA_CLIENTES: org('Estratégia Fictícia'), NEGOCIOS: org('Negócios Fictício'),
    PLATAFORMA: org('Plataforma Fictícia', { camada: 'A' }), PLATAFORMA_CANAIS: org('Canais Fictício', { camada: 'C' }),
    PLATAFORMA_CORPORATIVA: org('Corporativa Fictícia', { camada: 'C' }), AREA_ESPECIALIZADA: org('Área Fictícia', { camada: 'A' }), COE: org('CoE Fictício', { camada: 'A' }),
    SQUAD: org('Squad Fictícia', { camada: 'trabalho' }), CAPITULO: org('Capítulo Fictício', { camada: 'trabalho' }), DISCIPLINA: org('Disciplina Fictícia')
  };
  conceitos[INATIVO] = org('Hab. Negócios Fictício', { camada: 'C', ativo: false });
  return {
    'fa-users': users, 'fa-admins': adm, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {},
    'avaliacao-classificacoes': { canal: { registradoEm: QUANDO, registradoPor: EMAIL, auditoriaId: 'k0' } },
    'avaliacao-classificacoes-auditoria': { canal: { k0: { tipo: 'ligacao_registrada', codigo: 'canal', usuario: { email: EMAIL }, dataHora: QUANDO } } },
    'posicionamento-classificacoes': { [JA_LIGADO]: { registradoEm: QUANDO, registradoPor: EMAIL, auditoriaId: 'p0' } },
    'posicionamento-classificacoes-auditoria': { [JA_LIGADO]: { p0: { tipo: 'ligacao_registrada', codigo: JA_LIGADO, usuario: { email: EMAIL }, dataHora: QUANDO } } },
    taxonomia: {
      meta: { cargaInicial: { feitaEm: QUANDO, feitaPor: EMAIL, resumo: {} }, indiceFilhos: { criadoEm: QUANDO, criadoPor: EMAIL } },
      arquitetural: { conceitos: { canal: { nome: 'Canal Fictício', ordem: 1, ativo: true, situacaoDefinicao: 'ainda não registrada' } } },
      organizacional: { conceitos, auditoria: {} }
    }
  };
};

async function abrir(browser, viewport) {
  const cfg = { db: semente(), user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
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
  await page.waitForSelector('.tax-item[data-codigo="LINHA"]', { timeout: 8000 });
  return { ctx, page, erros };
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const escritas = (page) => page.evaluate(() => (window.__ESCRITAS || []).length);
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
async function dominio(page, dom) {
  await page.click('[data-tax="dominio"][data-dominio="' + dom + '"]');
  await esperarCondicao(page, (d) => !!document.querySelector('.tax-dominio--ativo[data-dominio="' + d + '"]') && !!document.querySelector('.tax-item'), dom, { descricao: 'domínio ' + dom + ' carregado' });
}
async function abreConceito(page, cod) {
  await esperarCondicao(page, (c) => !!document.querySelector('.tax-item[data-codigo="' + c + '"]') && !document.querySelector('.tax-lista .loading-msg, #taxCarregando'), cod, { descricao: 'lista do domínio montada' });
  if (await page.locator('.tax-detalhe [data-tax="voltar-lista"]').first().isVisible() && !(await page.locator('.tax-item[data-codigo="' + cod + '"]').isVisible())) await page.locator('.tax-detalhe [data-tax="voltar-lista"]').first().click();
  await page.click('.tax-item[data-codigo="' + cod + '"]');
  await esperarCondicao(page, (c) => { const t = document.querySelector('#taxCodigo'); return !!t && t.innerText.indexOf(c) !== -1 && !document.querySelector('.tax-detalhe .loading-msg'); }, cod, { descricao: 'detalhe de ' + cod + ' carregado' });
}
const situacaoPrevia = (page) => page.evaluate(() => Array.from(document.querySelectorAll('#taxPreviaLigacoesPos [data-previa]')).reduce((o, li) => { o[li.dataset.previa] = li.dataset.situacao; return o; }, {}));

(async () => {
  const browser = await chromium.launch();
  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros } = await abrir(browser, viewport);

    console.log('\n== 1. Aviso de proteção incompleta do Posicionamento ==');
    await esperarCondicao(page, () => !!document.getElementById('taxProtecaoIncompletaPos'), null, { descricao: 'aviso do Posicionamento' });
    afirma(/^Proteção do Posicionamento incompleta: 1 de 10 conceitos ligados\./.test(await texto(page, '#taxProtecaoIncompletaPos')), 'aviso: "Proteção do Posicionamento incompleta: 1 de 10 conceitos ligados."', await texto(page, '#taxProtecaoIncompletaPos'));
    afirma(!!(await texto(page, '#taxProtecaoIncompleta')), 'o aviso da Avaliação continua à parte');

    console.log('\n== 2. Conceitos-base do Posicionamento: os 10 códigos do motor ==');
    await dominio(page, 'organizacional');
    await esperarCondicao(page, () => /ligados$/.test((document.querySelector('#taxConceitosBasePos summary') || {}).innerText || ''), null, { descricao: 'ligações conferidas' });
    afirma(/^Conceitos-base do Posicionamento Organizacional — 10 códigos · 1 de 10 ligados$/.test((await texto(page, '#taxConceitosBasePos summary')).trim()), 'cabeçalho: "Conceitos-base do Posicionamento Organizacional — 10 códigos · 1 de 10 ligados"', await texto(page, '#taxConceitosBasePos summary'));
    const itens = await page.evaluate(() => Array.from(document.querySelectorAll('#taxConceitosBasePos [data-base]')).map((li) => li.dataset.base));
    afirma(itens.length === 10 && JSON.stringify(itens.slice().sort()) === JSON.stringify(DEZ.slice().sort()), 'exatamente os 10 códigos do motor (' + itens.join(', ') + ')');
    afirma(['SQUAD', 'CAPITULO', 'DISCIPLINA', 'A_VALIDAR'].every((c) => !itens.includes(c)), 'SQUAD, CAPITULO, DISCIPLINA e A_VALIDAR não aparecem');
    afirma(await page.locator('#taxConceitosBase').count() === 0, 'no organizacional não aparece a área da Avaliação');
    const it = (c) => texto(page, '#taxConceitosBasePos [data-base="' + c + '"]');
    afirma(/ligado ao Posicionamento/.test(await it(JA_LIGADO)) && /desde /.test(await it(JA_LIGADO)) && await page.locator('#taxConceitosBasePos [data-base="' + JA_LIGADO + '"][data-ligado="1"]').count() === 1, 'COE: "ligado ao Posicionamento" com a data');
    afirma(/sem ligação/.test(await it('LINHA')) && /Linha Fictícia/.test(await it('LINHA')), 'LINHA: nome do conceito + "sem ligação"');
    afirma(/sem conceito — o Posicionamento usa o rótulo de contingência; não pode ser ligado/.test(await it(AUSENTE)), AUSENTE + ': "sem conceito" (ausente)');
    afirma(/conceito inativo — não pode ser ligado/.test(await it(INATIVO)), INATIVO + ': "conceito inativo"');
    afirma(await larguraOk(page), 'sem rolagem horizontal');

    console.log('\n== 3. Prévia, confirmação e idempotência ==');
    const e0 = await escritas(page);
    await page.click('#taxRegistrarLigacoesBtnPos');
    await page.waitForSelector('#taxPreviaLigacoesPos', { timeout: 4000 });
    let sit = await situacaoPrevia(page);
    afirma(sit[JA_LIGADO] === 'ligado' && sit[AUSENTE] === 'sem-conceito' && sit[INATIVO] === 'inativo' && Object.keys(sit).length === 10 &&
      Object.keys(sit).filter((c) => sit[c] === 'ligar').length === 7, 'prévia: 1 já ligado, 7 serão ligados, ausente e inativo não podem ser ligados', JSON.stringify(sit));
    afirma(/Prévia — nada foi gravado ainda/.test(await texto(page, '#taxPreviaLigacoesPos')) && (await escritas(page)) === e0, 'abrir a prévia NÃO grava nada');
    await page.click('#taxPreviaLigacoesPos [data-tax="cancelar-ligacoes"]');
    await esperarCondicao(page, () => !document.getElementById('taxPreviaLigacoesPos'), null, { descricao: 'prévia fechada' });
    afirma((await escritas(page)) === e0, 'cancelar NÃO grava nada');
    await page.click('#taxRegistrarLigacoesBtnPos');
    await page.waitForSelector('#taxConfirmarLigacoesPos');
    afirma(/Registrar 7 ligações/i.test(await texto(page, '#taxConfirmarLigacoesPos')), 'botão de confirmação: "Registrar 7 ligações"');
    await page.click('#taxConfirmarLigacoesPos');
    await esperarCondicao(page, () => /8 de 10 ligados/.test((document.querySelector('#taxConceitosBasePos summary') || {}).innerText || ''), null, { descricao: '8 de 10 ligados' });
    const db = await banco(page);
    const L = db['posicionamento-classificacoes'] || {}, LA = db['posicionamento-classificacoes-auditoria'] || {};
    const novos = Object.keys(L).filter((c) => c !== JA_LIGADO);
    afirma(Object.keys(L).length === 8 && !L[AUSENTE] && !L[INATIVO] && novos.every((c) => DEZ.includes(c)), 'gravadas 7 ligações novas (+ a que já existia), nenhuma para o ausente ou o inativo');
    afirma(novos.every((c) => JSON.stringify(Object.keys(L[c]).sort()) === JSON.stringify(['auditoriaId', 'registradoEm', 'registradoPor']) && L[c].registradoPor === EMAIL),
      'cada ligação só tem registradoEm, registradoPor, auditoriaId (sem nome nem definição)');
    afirma(novos.every((c) => LA[c] && LA[c][L[c].auditoriaId] && LA[c][L[c].auditoriaId].tipo === 'ligacao_registrada' && Object.keys(LA[c]).length === 1), 'cada uma com a sua linha de auditoria "ligacao_registrada", apontada por auditoriaId');
    const multi = await page.evaluate(() => (window.__ESCRITAS || []).filter((e) => /^posicionamento-classificacoes(-auditoria)?\//.test(e.path)).length);
    afirma(multi === 14, 'uma gravação multipath com 7 ligações + 7 auditorias (' + multi + ' caminhos)');
    afirma(Object.keys(db['avaliacao-classificacoes'] || {}).length === 1, 'as ligações da Avaliação não foram tocadas');
    afirma(/8 de 10 conceitos ligados/.test(await texto(page, '#taxProtecaoIncompletaPos')), 'aviso atualizado: 8 de 10');
    afirma(await page.locator('#taxRegistrarLigacoesBtnPos').count() === 0, 'idempotente: não sobra nada a registrar (botão some)');
    const e1 = await escritas(page);
    const nada = await page.evaluate(() => { const I = window.faTaxonomia._interno; I.st.cargaLigPos = { erro: null }; I.registrarLigacoes('organizacional'); return I.st.cargaLigPos.erro; });
    afirma(/nada foi gravado/.test(nada || '') && (await escritas(page)) === e1, 'rodar de novo NÃO grava nada (nem histórico)', nada);
    await page.evaluate(() => { window.faTaxonomia._interno.st.cargaLigPos = null; });

    console.log('\n== 4. Conceito ligado: nem inativar nem trocar de camada ==');
    await abreConceito(page, 'AREA_ESPECIALIZADA');
    afirma(/ligado ao Posicionamento/.test(await texto(page, '#taxIdentLigadoPos')), 'identificação: "ligado ao Posicionamento"');
    let e2 = await escritas(page);
    await page.click('#taxInativarBtn');
    await page.waitForSelector('#taxInativarBloqueado');
    afirma(/está ligado ao posicionamento "Área Fictícia" do motor de Posicionamento Organizacional e não pode ser inativado/.test(await texto(page, '#taxInativarBloqueado')) &&
      await page.locator('#taxPainelInativar textarea').count() === 0, 'Inativar: só a explicação, sem campo de motivo');
    await page.click('[data-tax="cancelar-inativar"]');
    await page.click('#taxCamadaBtn');
    await page.waitForSelector('#taxCamadaBloqueada');
    afirma(/ligado ao motor de Posicionamento Organizacional e por isso não troca de camada/.test(await texto(page, '#taxCamadaBloqueada')) &&
      await page.locator('#taxPainelCamada textarea').count() === 0, 'Alterar camada: só a explicação, sem campo de motivo');
    await page.click('[data-tax="cancelar-camada"]');
    afirma((await escritas(page)) === e2, 'nada gravado');
    await abreConceito(page, 'SQUAD');
    await page.click('#taxCamadaBtn');
    await page.waitForSelector('#taxCamadaPrevia');
    afirma(await page.locator('#taxCamadaBloqueada').count() === 0 && await page.locator('#taxPainelCamada textarea').count() === 1, 'não ligado (SQUAD): Alterar camada segue normal (prévia + motivo)');
    await page.click('[data-tax="cancelar-camada"]');

    console.log('\n== 5. O arquitetural continua como era ==');
    await dominio(page, 'arquitetural');
    afirma(/^Conceitos-base da Avaliação — 11 códigos/.test((await texto(page, '#taxConceitosBase summary')).trim()) && await page.locator('#taxConceitosBasePos').count() === 0, 'arquitetural: Conceitos-base da Avaliação (11 códigos), sem a área do Posicionamento');
    afirma(await larguraOk(page), 'sem rolagem horizontal ao final');
    await ctx.close();
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
  }
  await browser.close();
  console.log('\n============================\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
