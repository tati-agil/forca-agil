/* TAXONOMIA — texto-fonte IMUTÁVEL e "Nova versão da definição" (Admin → Taxonomia), desktop e celular (375 px).
 * CONTEÚDO 100% FICTÍCIO. Firebase falso em persistência real; hermético (sem rede, sem segredo).
 *
 * O que se prova:
 *   1. O detalhe do conceito mostra o código ("Código: SQ").
 *   2. A definição vigente não tem "Editar": o botão (em "Ver detalhes") é "Nova versão da definição".
 *   3. "Nova versão da definição" abre o MESMO formulário de "+ Adicionar texto-fonte", PRÉ-PREENCHIDO com o texto,
 *      o contexto, o tipo de redação e o rótulo da vigente; o formulário fica à vista e cabe na tela.
 *   4. Salvar cria uma fonte NOVA "em validação", com criadoEm/criadoPor próprios; a fonte anterior fica
 *      intacta (texto, criadoPor, criadoEm, situação) e a definição vigente NÃO muda; auditado como nova versão.
 *   5. A tela guia o próximo passo (aviso na nova fonte) e "Usar como vigente" (o fluxo de sempre) troca a
 *      definição: a nova vira vigente, a anterior vira histórica com o MESMO texto; uma só vigente.
 *   6. Cancelar a nova versão não grava nada. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
const EMAIL = 'adm@previ.com.br';
const chave = (e) => e.toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
const DESKTOP = { width: 1280, height: 900 };
const CELULAR = { width: 375, height: 800 };

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

const F1 = { texto: 'Texto fictício vigente, primeira redação.', contexto: 'BB', situacao: 'vigente', tipoRedacao: 'Significado v1', rotulo: 'Redação BB', criadoEm: '2026-10-01T09:00:00.000Z', criadoPor: 'outra.admin@previ.com.br' };
const semente = () => {
  const adm = {}; adm[chave(EMAIL)] = { email: EMAIL, name: 'ADMIN' };
  const users = {}; users[chave(EMAIL)] = { name: 'ADMIN', email: EMAIL, area: 'INFOR' };
  return {
    'fa-users': users, 'fa-admins': adm, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {},
    taxonomia: {
      meta: { cargaInicial: { feitaEm: '2026-10-01T09:00:00.000Z', feitaPor: EMAIL, resumo: {} } },
      organizacional: {
        conceitos: { SQ: { nome: 'Conceito Fictício Sq', camada: 'A', ordem: 1, ativo: true, situacaoDefinicao: 'registrada', definicaoVigenteFonteId: 'f1' } },
        fontes: { SQ: { f1: Object.assign({}, F1), f2: { texto: 'Texto fictício histórico.', contexto: 'PREVI', situacao: 'histórica/contextual', tipoRedacao: 'Conceito', criadoEm: '2026-10-01T09:00:01.000Z', criadoPor: EMAIL } } },
        auditoria: {}
      },
      arquitetural: {}
    }
  };
};

async function abrir(browser, viewport) {
  const cfg = { db: semente(), user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true };
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
  await page.waitForSelector('.tax-item[data-codigo="SQ"]', { timeout: 8000 });
  await page.click('.tax-item[data-codigo="SQ"]');
  await esperarCondicao(page, () => !!document.querySelector('article[data-fonte="f1"]') && !document.querySelector('#taxSecFontes .loading-msg') && !document.querySelector('#taxSecHistorico .loading-msg'), null, { limite: 6000, descricao: 'detalhe do SQ carregado' });
  return { ctx, page, erros };
}
const org = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal.taxonomia.organizacional)));
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const escritas = (page) => page.evaluate(() => (window.__ESCRITAS || []).length);

(async () => {
  const browser = await chromium.launch();
  for (const [nomeTela, viewport] of [['desktop', DESKTOP], ['celular 375px', CELULAR]]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros } = await abrir(browser, viewport);

    console.log('\n== 1. Código do conceito e botão da vigente ==');
    afirma((await page.locator('#taxCodigo').innerText()).trim() === 'Código: SQ' && await page.locator('#taxCodigo').isVisible(), 'o detalhe mostra "Código: SQ"');
    await page.click('article[data-fonte="f1"] [data-tax="ver"]');
    await page.waitForSelector('article[data-fonte="f1"] [data-tax="nova-versao"]', { timeout: 4000 });
    afirma(await page.locator('article[data-fonte="f1"] [data-tax="editar-fonte"]').count() === 0, 'a definição vigente NÃO tem "Editar"');
    afirma((await page.locator('article[data-fonte="f1"] [data-tax="nova-versao"]').textContent()).trim() === 'Nova versão da definição', 'no lugar dele: "Nova versão da definição"');
    afirma(await page.evaluate(() => { const r = document.querySelector('article[data-fonte="f1"] [data-tax="nova-versao"]').getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= window.innerWidth + 1; }), 'o botão cabe na largura da tela');

    console.log('\n== 2. Cancelar a nova versão não grava nada ==');
    let e0 = await escritas(page);
    await page.click('article[data-fonte="f1"] [data-tax="nova-versao"]');
    await page.waitForSelector('#taxFormFonte[data-nova-versao="f1"]', { timeout: 4000 });
    await page.click('[data-tax="cancelar-edicao"]');
    afirma(await escritas(page) === e0 && Object.keys((await org(page)).fontes.SQ).length === 2, 'cancelar: nenhuma escrita, nenhuma fonte nova');

    console.log('\n== 3. Formulário pré-preenchido com a vigente ==');
    await page.click('article[data-fonte="f1"] [data-tax="ver"]');
    await page.waitForSelector('article[data-fonte="f1"] [data-tax="nova-versao"]', { timeout: 4000 });
    await page.click('article[data-fonte="f1"] [data-tax="nova-versao"]');
    await page.waitForSelector('#taxFormFonte[data-nova-versao="f1"]', { timeout: 4000 });
    afirma(await page.inputValue('#taxF_texto') === F1.texto && await page.inputValue('#taxF_contexto') === F1.contexto && await page.inputValue('#taxF_tipoRedacao') === F1.tipoRedacao && await page.inputValue('#taxF_rotulo') === F1.rotulo,
      'texto, contexto, tipo de redação e rótulo vêm da definição vigente');
    afirma(await page.inputValue('#taxF_situacao') === 'em validação', 'a nova versão entra "em validação" (como toda fonte nova)');
    afirma(/Nova versão da definição/.test(await page.locator('#taxNovaVersaoTitulo').innerText()) && /o texto atual não muda/.test(await page.locator('#taxNovaVersaoAjuda').innerText()), 'o formulário diz que é uma nova versão e que o texto atual não muda');
    afirma(await page.locator('#taxFontesDisponiveis #taxFormFonte').count() === 1 && await page.locator('[data-tax="nova-fonte"]').count() === 0, 'é o mesmo formulário de "+ Adicionar texto-fonte" (no bloco de fontes disponíveis)');
    afirma(await page.evaluate(() => { const r = document.querySelector('#taxFormFonte').getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0 && r.left >= 0 && r.right <= window.innerWidth + 1; }), 'o formulário fica à vista e cabe na largura da tela');
    afirma(await larguraOk(page), 'sem rolagem horizontal');

    console.log('\n== 4. Salvar cria uma fonte NOVA; a anterior fica intacta ==');
    const NOVO = 'Texto fictício vigente, segunda redação (revisada).';
    await page.fill('#taxF_texto', NOVO);
    await page.fill('#taxF_rotulo', 'Redação BB v2');
    e0 = await escritas(page);
    await page.click('[data-tax="salvar-edicao"]');
    await esperarCondicao(page, () => Object.keys(window.__CFG.__dbReal.taxonomia.organizacional.fontes.SQ).length === 3, null, { limite: 6000, descricao: 'fonte nova gravada' });
    let o = await org(page);
    const idNova = Object.keys(o.fontes.SQ).find((k) => k !== 'f1' && k !== 'f2');
    const nova = o.fontes.SQ[idNova];
    afirma(!!nova && nova.texto === NOVO && nova.situacao === 'em validação' && nova.contexto === F1.contexto && nova.tipoRedacao === F1.tipoRedacao && nova.rotulo === 'Redação BB v2', 'fonte nova "em validação" com o texto revisado (contexto e tipo herdados)');
    afirma(nova && nova.criadoPor === EMAIL && !!nova.criadoEm && nova.criadoEm !== F1.criadoEm, 'a fonte nova tem criadoEm/criadoPor PRÓPRIOS (quem fez a nova versão, agora)');
    afirma(JSON.stringify(o.fontes.SQ.f1) === JSON.stringify(F1), 'a fonte anterior ficou INTACTA: mesmo texto, criadoPor, criadoEm e situação (vigente)', JSON.stringify(o.fontes.SQ.f1));
    afirma(o.conceitos.SQ.definicaoVigenteFonteId === 'f1', 'a definição vigente NÃO mudou ao salvar');
    const audNova = Object.values(o.auditoria.SQ || {}).filter((a) => a.tipo === 'alteracao_fonte');
    afirma(audNova.length === 1 && audNova[0].fonteId === idNova && audNova[0].fonteBaseId === 'f1' && audNova[0].campo === 'nova versão da definição' && audNova[0].usuario.email === EMAIL, 'auditada como "nova versão da definição", com a fonte de origem (f1)');
    afirma((await page.evaluate((n) => window.__ESCRITAS.slice(n).map((w) => w.path), e0)).every((p) => !/fontes\/SQ\/f1/.test(p)), 'nenhuma escrita tocou a fonte anterior (f1)');

    console.log('\n== 5. A tela guia o próximo passo: "Usar como vigente" ==');
    await page.waitForSelector('#taxFlash:not(.tax-flash--erro)', { timeout: 6000 });
    afirma(/A definição vigente NÃO mudou/.test(await page.locator('#taxFlash').innerText()) && /Usar como vigente/.test(await page.locator('#taxFlash').innerText()), 'mensagem: nova versão salva "em validação", a vigente não mudou, use "Usar como vigente"');
    await page.waitForSelector('article[data-fonte="' + idNova + '"] #taxNovaVersaoCriada', { timeout: 6000 });
    afirma(await page.locator('article[data-fonte="' + idNova + '"] [data-tax="tornar-vigente"]').count() === 1, 'o cartão da nova versão fica marcado, com o botão "Usar como vigente"');
    afirma(await page.locator('#taxVigenteBloco article[data-fonte="f1"]').count() === 1 && /primeira redação/.test(await page.locator('#taxSecDefinicao').innerText()), 'a definição exibida continua a anterior');
    await page.click('article[data-fonte="' + idNova + '"] [data-tax="tornar-vigente"]');
    await page.waitForSelector('[data-tax="confirmar-vigente"]', { timeout: 4000 });
    afirma(new RegExp('segunda redação').test(await page.locator('.tax-confirma-texto').innerText()) && /passa a "histórico\/contextual"/.test(await page.locator('.tax-confirma').innerText()), 'a confirmação de sempre: texto integral da nova versão e aviso de que a anterior vira histórica');
    await page.click('[data-tax="confirmar-vigente"]');
    await esperarCondicao(page, (id) => window.__CFG.__dbReal.taxonomia.organizacional.conceitos.SQ.definicaoVigenteFonteId === id, idNova, { limite: 6000, descricao: 'nova versão vigente' });
    o = await org(page);
    afirma(o.fontes.SQ[idNova].situacao === 'vigente' && o.fontes.SQ[idNova].texto === NOVO, 'a nova versão é a definição vigente');
    afirma(o.fontes.SQ.f1.situacao === 'histórica/contextual' && o.fontes.SQ.f1.texto === F1.texto && o.fontes.SQ.f1.criadoPor === F1.criadoPor && o.fontes.SQ.f1.criadoEm === F1.criadoEm, 'a anterior virou histórica com o MESMO texto, criadoPor e criadoEm');
    afirma(Object.values(o.fontes.SQ).filter((f) => f.situacao === 'vigente').length === 1, 'continua UMA só vigente');
    const audV = Object.values(o.auditoria.SQ || {}).filter((a) => a.tipo === 'definicao_vigente');
    afirma(audV.length === 1 && audV[0].fonteAnteriorId === 'f1' && audV[0].fonteNovaId === idNova, 'a troca foi auditada (anterior f1 → nova versão)');
    await esperarCondicao(page, () => /segunda redação/.test((document.querySelector('#taxSecDefinicao') || {}).innerText || ''), null, { limite: 6000, descricao: 'definição atualizada na tela' });
    afirma(await page.locator('#taxNovaVersaoCriada').count() === 0, 'depois de adotada, o aviso de "nova versão criada" some');
    afirma(await larguraOk(page), 'sem rolagem horizontal');
    afirma(erros.length === 0, 'sem erros de JavaScript (' + erros.length + ')');
    await ctx.close();
  }
  await browser.close();
  console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
