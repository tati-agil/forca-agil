/* TAXONOMIA — camada "Organização do trabalho" (PR A do Posicionamento Organizacional), na tela. Desktop e 375 px.
 * CONTEÚDO 100% FICTÍCIO. Firebase falso em persistência real; hermético (sem rede, sem segredo).
 * As REGRAS do banco são provadas no emulador (teste-rules-taxonomia-governanca.js, seção E); aqui, o que a
 * pessoa vê e o que a tela grava:
 *   1. Antes da troca não existe o grupo "Organização do trabalho".
 *   2. "Alterar camada": prévia (de → para e o que NÃO muda), motivo obrigatório, grava camada + camadaAlteracao +
 *      linha de histórico alteracao_camada; código, nome e relação "Squad compõe Linha" intactos.
 *   3. A lista fica em três grupos: estruturas · Organização do trabalho · Conceito auxiliar.
 *   4. Especialização e Conceito auxiliar não têm o botão; conceito com filhos ativos só recebe a explicação.
 *   5. O caminho de volta é o mesmo botão. Sem rolagem horizontal; nenhum erro de JS. */
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
const QUANDO = '2026-10-01T09:00:00.000Z';
const SHOTS = process.env.FA_SHOTS_DIR || null;

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

const arq = (nome, ativo) => ({ nome, ordem: 1, ativo, situacaoDefinicao: 'ainda não registrada' });
const org = (nome, extra) => Object.assign({ nome, ordem: 1, ativo: true, situacaoDefinicao: 'em revisão', camada: 'B' }, extra || {});
const semente = () => {
  const adm = {}; adm[chave(EMAIL)] = { email: EMAIL, name: 'ADMIN' };
  const users = {}; users[chave(EMAIL)] = { name: 'ADMIN', email: EMAIL, area: 'INFOR' };
  return {
    'fa-users': users, 'fa-admins': adm, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {},
    taxonomia: {
      meta: { cargaInicial: { feitaEm: QUANDO, feitaPor: EMAIL, resumo: {} } },
      arquitetural: {
        conceitos: {
          'produto-principal': arq('Produto Fictício', true), canal: arq('Canal Fictício', true), componente: arq('Componente Fictício', true),
          'regra-condicao': arq('Regra Fictícia', true), 'documento-informacao': arq('Documento Fictício', false)
        }
      },
      organizacional: {
        conceitos: {
          LINHA: org('Linha Fictícia', { camada: 'A', ordem: 1 }), NEG: org('Negócios Fictícios', { pai: 'LINHA', ordem: 2 }),
          AREA: org('Área Fictícia', { camada: 'A', ordem: 3 }), SQUAD: org('Squad Fictícia', { camada: 'A', ordem: 4 }),
          CAPITULO: org('Capítulo Fictício', { camada: 'A', ordem: 5 }), DISC: org('Disciplina Fictícia', { camada: 'auxiliar', ordem: 6 })
        },
        relacoes: { SQUAD__compoe__LINHA: { de: 'SQUAD', tipo: 'compoe', para: 'LINHA' } },
        auditoria: {}
      }
    }
  };
};

async function abrir(browser, viewport, opts) {
  opts = opts || {};
  const cfg = { db: semente(), user: { email: EMAIL, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true, delays: opts.delays || {}, fail: opts.fail || [] };
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
  await page.waitForSelector('.tax-item[data-codigo="SQUAD"]', { timeout: 8000 });
  return { ctx, page, erros };
}
const banco = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__CFG.__dbReal)));
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const escritas = (page) => page.evaluate(() => (window.__ESCRITAS || []).length);
const texto = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
async function foto(page, nome, sel) { if (!SHOTS) return; try { await page.locator(sel).first().screenshot({ path: path.join(SHOTS, nome + '.png') }); } catch (e) { console.log('(foto ' + nome + ' não tirada: ' + e.message + ')'); } }
async function dominio(page, dom) {
  await page.click('[data-tax="dominio"][data-dominio="' + dom + '"]');
  await esperarCondicao(page, (d) => !!document.querySelector('.tax-dominio--ativo[data-dominio="' + d + '"]') && !!document.querySelector('.tax-item'), dom, { descricao: 'domínio ' + dom + ' carregado' });
}
async function abreConceito(page, cod) {
  /* depois de salvar, a tela RECARREGA o domínio ("Carregando…" por um instante): decidir só com a lista já
     montada — senão, no celular, olhava no meio da recarga, não voltava à lista e o item ficava escondido */
  await esperarCondicao(page, (c) => !!document.querySelector('.tax-item[data-codigo="' + c + '"]') && !document.querySelector('.tax-lista .loading-msg, #taxCarregando'), cod, { descricao: 'lista do domínio montada' });
  /* no celular a lista some quando o detalhe está aberto: volta para a lista antes */
  if (await page.locator('.tax-detalhe [data-tax="voltar-lista"]').first().isVisible() && !(await page.locator('.tax-item[data-codigo="' + cod + '"]').isVisible())) await page.locator('.tax-detalhe [data-tax="voltar-lista"]').first().click();
  await page.click('.tax-item[data-codigo="' + cod + '"]');
  await esperarCondicao(page, (c) => { const t = document.querySelector('#taxCodigo'); return !!t && t.innerText.indexOf(c) !== -1 && !document.querySelector('.tax-detalhe .loading-msg'); }, cod, { descricao: 'detalhe de ' + cod + ' carregado' });
}


/* ordem dos itens e dos grupos na lista, como a pessoa vê */
const lista = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.tax-lista .tax-item, .tax-lista .tax-lista-grupo')).map((e) => e.classList.contains('tax-lista-grupo') ? '#' + e.textContent.trim().toLowerCase() : e.getAttribute('data-codigo')));

(async () => {
  const browser = await chromium.launch();
  for (const [nomeTela, viewport, suf] of [['desktop', DESKTOP, 'desktop'], ['celular 375px', CELULAR, '375']]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros } = await abrir(browser, viewport);
    await dominio(page, 'organizacional');

    console.log('\n== 1. Antes: Squad e Capítulo aparecem como tipo organizacional ==');
    let L = await lista(page);
    afirma(L.indexOf('#organização do trabalho') === -1 && L.indexOf('SQUAD') < L.indexOf('#conceito auxiliar'), 'sem o grupo "Organização do trabalho" enquanto nenhum conceito está nele', JSON.stringify(L));

    console.log('\n== 2. Alterar camada: prévia, motivo obrigatório, gravação ==');
    await abreConceito(page, 'SQUAD');
    afirma(await page.locator('#taxCamadaBtn').count() === 1, 'conceito da camada "Tipo organizacional" tem "Alterar camada"');
    await page.click('#taxCamadaBtn');
    await page.waitForSelector('#taxPainelCamada', { timeout: 4000 });
    const painel = await texto(page, '#taxPainelCamada');
    afirma(/Mover de "Tipo organizacional" para "Organização do trabalho"\?/.test(painel) && /código SQUAD, o nome, a definição, as fontes, as relações e o histórico continuam como estão/.test(painel), 'prévia diz de → para e o que NÃO muda', painel);
    afirma(await larguraOk(page), 'painel sem rolagem horizontal');
    await foto(page, 'camada-previa-' + suf, '#taxPainelCamada');
    let e0 = await escritas(page);
    await page.click('[data-tax="confirmar-camada"]');
    await esperarCondicao(page, () => /Informe o motivo da troca de camada/.test((document.getElementById('taxPainelCamada') || {}).innerText || ''), null, { descricao: 'pede o motivo' });
    afirma(await escritas(page) === e0, 'sem motivo: nada gravado');
    await page.fill('#taxC_motivo', 'Squad é organização do trabalho');
    await page.click('[data-tax="confirmar-camada"]');
    await esperarCondicao(page, () => { const c = window.__CFG.__dbReal.taxonomia.organizacional.conceitos.SQUAD; return c.camada === 'trabalho'; }, null, { descricao: 'camada gravada' });
    let b = await banco(page);
    const S = b.taxonomia.organizacional.conceitos.SQUAD, aud = (b.taxonomia.organizacional.auditoria || {}).SQUAD || {};
    const ev = aud[S.camadaAlteracao && S.camadaAlteracao.auditoriaId] || {};
    afirma(S.camadaAlteracao && S.camadaAlteracao.de === 'A' && S.camadaAlteracao.para === 'trabalho' && S.camadaAlteracao.motivo === 'Squad é organização do trabalho' && S.camadaAlteracao.por === EMAIL, 'gravado: camadaAlteracao (de, para, motivo, autor)');
    afirma(ev.tipo === 'alteracao_camada' && ev.valorAnterior === 'Tipo organizacional' && ev.valorNovo === 'Organização do trabalho' && ev.motivo === 'Squad é organização do trabalho', 'a troca aponta para a SUA linha de histórico (alteracao_camada)');
    afirma(S.nome === 'Squad Fictícia' && !S.pai && b.taxonomia.organizacional.relacoes.SQUAD__compoe__LINHA.de === 'SQUAD', 'código, nome e relação "compõe Linha" intactos');

    console.log('\n== 3. Depois: três grupos na lista ==');
    await esperarCondicao(page, () => !!document.querySelector('#taxIdentCamadaAlteracao'), null, { descricao: 'detalhe recarregado' });
    afirma(/Camada:\s*Organização do trabalho/.test(await texto(page, '#taxSecIdent')) && /de Tipo organizacional para Organização do trabalho .* motivo: Squad é organização do trabalho/.test(await texto(page, '#taxIdentCamadaAlteracao')), 'identificação: camada nova e a última troca com motivo');
    afirma(/Camada alterada/.test(await page.evaluate(() => (document.getElementById('taxSecHistorico') || {}).textContent || '')), 'histórico do conceito mostra "Camada alterada"');
    await abreConceito(page, 'CAPITULO');
    await page.click('#taxCamadaBtn');
    await page.fill('#taxC_motivo', 'Capítulo é organização do trabalho');
    await page.click('[data-tax="confirmar-camada"]');
    await esperarCondicao(page, () => window.__CFG.__dbReal.taxonomia.organizacional.conceitos.CAPITULO.camada === 'trabalho', null, { descricao: 'Capítulo gravado' });
    await esperarCondicao(page, () => !document.querySelector('.tax-lista .loading-msg, #taxCarregando') && !!document.querySelector('.tax-item[data-codigo="CAPITULO"]'), null, { descricao: 'lista recarregada' });
    if (await page.locator('.tax-detalhe [data-tax="voltar-lista"]').first().isVisible()) await page.locator('.tax-detalhe [data-tax="voltar-lista"]').first().click();
    L = await lista(page);
    const gT = L.indexOf('#organização do trabalho'), gA = L.indexOf('#conceito auxiliar');
    afirma(gT !== -1 && gA > gT && ['LINHA', 'NEG', 'AREA'].every((c) => L.indexOf(c) < gT) && ['SQUAD', 'CAPITULO'].every((c) => L.indexOf(c) > gT && L.indexOf(c) < gA) && L.indexOf('DISC') > gA,
      'lista: estruturas (Linha, Negócios, Área) · "Organização do trabalho" (Squad, Capítulo) · "Conceito auxiliar" (Disciplina)', JSON.stringify(L));
    await foto(page, 'camada-lista-' + suf, '.tax-lista');

    console.log('\n== 4. Quem não troca ==');
    await abreConceito(page, 'NEG');
    afirma(await page.locator('#taxCamadaBtn').count() === 0, 'Especialização (B) não tem "Alterar camada"');
    await abreConceito(page, 'DISC');
    afirma(await page.locator('#taxCamadaBtn').count() === 0, 'Conceito auxiliar não tem "Alterar camada"');
    await abreConceito(page, 'LINHA');
    e0 = await escritas(page);
    await page.click('#taxCamadaBtn');
    await page.waitForSelector('#taxCamadaBloqueada', { timeout: 4000 });
    afirma(/filhos ativos \(NEG\)/.test(await texto(page, '#taxCamadaBloqueada')) && await page.locator('#taxPainelCamada textarea, #taxPainelCamada [data-tax="confirmar-camada"]').count() === 0, 'conceito com filhos ativos: só a explicação, sem motivo nem confirmar');
    afirma(await escritas(page) === e0, 'nada gravado');

    console.log('\n== 5. Desfazer pelo mesmo caminho ==');
    await abreConceito(page, 'SQUAD');
    await page.click('#taxCamadaBtn');
    afirma(/Mover de "Organização do trabalho" para "Tipo organizacional"\?/.test(await texto(page, '#taxPainelCamada')), 'em Organização do trabalho, o caminho de volta é o mesmo botão');
    await page.click('[data-tax="cancelar-camada"]');
    afirma(await page.locator('#taxPainelCamada').count() === 0, 'cancelar fecha o painel sem gravar');

    afirma(await larguraOk(page), 'sem rolagem horizontal');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nOK — camada "Organização do trabalho": prévia, motivo obrigatório, histórico, três grupos na lista, bloqueios e caminho de volta; desktop e 375 px.');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
