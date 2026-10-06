/* TAXONOMIA — ficha do conceito: "Atributos / perfil" recolhível (Etapa 6.1). Desktop e celular (375 px).
 * CONTEÚDO 100% FICTÍCIO. Firebase falso em persistência real; hermético (sem rede, sem segredo).
 *
 *   1. A seção começa RECOLHIDA: só o cabeçalho "Atributos / perfil — X definidos de N" com indicador (▸).
 *   2. "Definidos" = atributos com estado decidido (tudo que não é "ainda não definido" nem está sem registro).
 *   3. Clicar no cabeçalho EXPANDE (explicação de Papel/Origem, atributos, valores, "Editar") e de novo RECOLHE.
 *   4. Editar um atributo continua funcionando: grava, a seção continua aberta e a contagem acompanha.
 *   5. Trocar de conceito volta a seção ao estado recolhido.
 *   6. Perfis lentos → "carregando…"; perfis recusados → "indisponível agora" (nunca "0 definidos").
 *   7. Sem rolagem horizontal; nenhum erro de JS. Nenhum dado muda ao abrir/fechar. */
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
const SHOTS = process.env.FA_SHOTS_DIR || null;

let falhas = 0;
function afirma(cond, msg, detalhe) { console.log((cond ? '  ok    ' : '  FALHA ') + msg + (!cond && detalhe ? ' → ' + detalhe : '')); if (!cond) falhas++; }

const semente = () => {
  const adm = {}; adm[chave(EMAIL)] = { email: EMAIL, name: 'ADMIN' };
  const users = {}; users[chave(EMAIL)] = { name: 'ADMIN', email: EMAIL, area: 'INFOR' };
  return {
    'fa-users': users, 'fa-admins': adm, 'fa-diretores': {}, 'fa-facilitadores': {}, eventos: {}, turmas: {}, 'turmas-interesse': {}, 'turmas-config': {}, 'turmas-publico': {}, 'eventos-publico': {}, 'turmas-equipe': {},
    taxonomia: {
      meta: { cargaInicial: { feitaEm: '2026-10-01T09:00:00.000Z', feitaPor: EMAIL } },
      arquitetural: {},
      organizacional: {
        conceitos: { SQ: { nome: 'Squad Fictícia', camada: 'A', ordem: 1, ativo: true, situacaoDefinicao: 'em revisão' }, COE: { nome: 'CoE Fictício', camada: 'A', ordem: 2, ativo: true, situacaoDefinicao: 'em revisão' } },
        atributos: {
          ALCANCE: { nome: 'Alcance de atuação', grupo: 'alcance', tipoValor: 'lista', ordem: 1, ativo: true, valoresPermitidos: { v1: { texto: 'específica', ordem: 1 }, v2: { texto: 'transversal', ordem: 2 } } },
          BENEF: { nome: 'Beneficiário indireto', grupo: 'quem-recebe', tipoValor: 'texto', ordem: 2, ativo: true },
          FORMA: { nome: 'Forma de entrega', grupo: 'entrega', tipoValor: 'texto', ordem: 3, ativo: true },
          GOV: { nome: 'Governança', grupo: 'governanca', tipoValor: 'texto', ordem: 4, ativo: true }
        },
        perfis: { SQ: { ALCANCE: { estado: 'registrado', valor: 'transversal', papel: 'típico', origem: 'decisão' }, BENEF: { estado: 'não consta na fonte' }, FORMA: { estado: 'ainda não definido' } } },
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
  await page.waitForSelector('.tax-item[data-codigo="SQ"]', { timeout: 8000 });
  return { ctx, page, erros };
}
const aberta = (page) => page.evaluate(() => { const d = document.getElementById('taxAtributosRecolhivel'); return !!d && d.open; });
const resumo = (page) => page.evaluate(() => { const e = document.getElementById('taxAtributosResumo'); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; });
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const escritas = (page) => page.evaluate(() => (window.__ESCRITAS || []).length);
async function foto(page, nome) { if (!SHOTS) return; try { await page.locator('#taxSecAtributos').screenshot({ path: path.join(SHOTS, nome + '.png') }); } catch (e) { console.log('(foto ' + nome + ' não tirada: ' + e.message + ')'); } }
async function abreConceito(page, cod) {
  if (!(await page.locator('.tax-item[data-codigo="' + cod + '"]').isVisible())) await page.locator('.tax-detalhe [data-tax="voltar-lista"]').first().click();
  await page.click('.tax-item[data-codigo="' + cod + '"]');
  await esperarCondicao(page, (c) => { const t = document.querySelector('#taxCodigo'); return !!t && t.innerText.indexOf(c) !== -1 && !!document.getElementById('taxAtributosResumo') && !/carregando/.test(document.getElementById('taxAtributosResumo').textContent); }, cod, { descricao: 'detalhe de ' + cod });
}

(async () => {
  const browser = await chromium.launch();
  for (const [nomeTela, viewport, suf] of [['desktop', DESKTOP, 'desktop'], ['celular 375px', CELULAR, '375']]) {
    console.log('\n######## ' + nomeTela + ' ########');
    const { ctx, page, erros } = await abrir(browser, viewport);
    await abreConceito(page, 'SQ');

    console.log('\n== 1–2. Começa recolhida, com a contagem ==');
    afirma(!(await aberta(page)), 'a seção começa RECOLHIDA');
    afirma(await resumo(page) === 'Atributos / perfil — 2 definidos de 4', 'cabeçalho: "Atributos / perfil — 2 definidos de 4" (registrado + "não consta na fonte"; "ainda não definido" e sem registro não contam)', await resumo(page));
    afirma(await page.locator('#taxLegenda').isHidden() && await page.locator('.tax-atributo').first().isHidden() && await page.locator('[data-tax="editar-perfil"]').first().isHidden(), 'recolhida: explicação, atributos e "Editar" não aparecem');
    afirma(await page.evaluate(() => getComputedStyle(document.getElementById('taxAtributosResumo'), '::before').content.indexOf('▸') !== -1), 'o cabeçalho tem o indicador (▸)');
    await foto(page, 'atributos-recolhido-' + suf);

    console.log('\n== 3. Expandir e recolher ==');
    const e0 = await escritas(page);
    await page.click('#taxAtributosResumo');
    await esperarCondicao(page, () => document.getElementById('taxAtributosRecolhivel').open, null, { descricao: 'expandir' });
    afirma(await page.locator('#taxLegenda').isVisible() && /definidor/.test(await page.locator('#taxLegenda').innerText()) && /inferência/.test(await page.locator('#taxLegenda').innerText()), 'expandida: a explicação de Papel/Origem aparece');
    afirma(await page.locator('.tax-atributo').count() === 4 && /transversal/.test(await page.locator('.tax-atributo[data-atributo="ALCANCE"]').innerText()), 'expandida: os 4 atributos, com os valores');
    afirma(await page.locator('[data-tax="editar-perfil"]').count() === 4 && await page.locator('[data-tax="editar-perfil"][data-atributo="GOV"]').isVisible(), 'expandida: os botões "Editar" de sempre');
    await foto(page, 'atributos-aberto-' + suf);
    afirma(await larguraOk(page), 'expandida: sem rolagem horizontal');
    await page.click('#taxAtributosResumo');
    await esperarCondicao(page, () => !document.getElementById('taxAtributosRecolhivel').open, null, { descricao: 'recolher' });
    afirma(await page.locator('.tax-atributo').first().isHidden(), 'clicar de novo RECOLHE');
    afirma(await escritas(page) === e0, 'abrir e fechar não grava nada');

    console.log('\n== 4. Editar um atributo continua funcionando ==');
    await page.click('#taxAtributosResumo');
    await esperarCondicao(page, () => document.getElementById('taxAtributosRecolhivel').open, null, { descricao: 'expandir para editar' });
    await page.click('[data-tax="editar-perfil"][data-atributo="GOV"]');
    await page.waitForSelector('#taxFormPerfil', { timeout: 4000 });
    afirma(await aberta(page), 'com o formulário aberto, a seção continua expandida');
    await page.selectOption('#taxF_estado', 'registrado');
    await page.waitForSelector('#taxF_valor', { timeout: 4000 });
    await page.fill('#taxF_valor', 'Comitê fictício');
    await page.selectOption('#taxF_papel', 'observado');
    await page.selectOption('#taxF_origem', 'fonte');
    await page.click('[data-tax="salvar-edicao"]');
    await esperarCondicao(page, () => { const p = ((window.__CFG.__dbReal.taxonomia.organizacional.perfis || {}).SQ || {}).GOV; return !!p && p.valor === 'Comitê fictício'; }, null, { descricao: 'perfil gravado' });
    afirma(true, 'o atributo foi gravado (estado registrado, valor, papel, origem)');
    await esperarCondicao(page, () => /3 definidos de 4/.test((document.getElementById('taxAtributosResumo') || {}).textContent || '') && !document.getElementById('taxFormPerfil'), null, { descricao: 'contagem atualizada' });
    afirma(await aberta(page), 'depois de salvar, a seção continua expandida');
    afirma(await resumo(page) === 'Atributos / perfil — 3 definidos de 4', 'a contagem acompanha: "3 definidos de 4"');

    console.log('\n== 5. Trocar de conceito volta a recolher ==');
    await abreConceito(page, 'COE');
    afirma(!(await aberta(page)) && await resumo(page) === 'Atributos / perfil — 0 definidos de 4', 'outro conceito: recolhida, "0 definidos de 4"', await resumo(page));
    await abreConceito(page, 'SQ');
    afirma(!(await aberta(page)), 'voltar ao primeiro conceito: recolhida de novo');
    afirma(await larguraOk(page), 'sem rolagem horizontal');
    afirma(erros.length === 0, 'nenhum erro de JS (' + erros.length + ')');
    await ctx.close();
  }

  console.log('\n######## perfis lentos e recusados ########');
  {
    const { ctx, page, erros } = await abrir(browser, CELULAR, { delays: { 'taxonomia/organizacional/perfis': 4000 } });
    await page.click('.tax-item[data-codigo="SQ"]');
    await page.waitForSelector('#taxAtributosResumo', { timeout: 6000 });
    afirma(/Atributos \/ perfil — carregando…/.test(await resumo(page)), 'perfis lentos: "carregando…" (nunca "0 definidos")', await resumo(page));
    await esperarCondicao(page, () => /2 definidos de 4/.test((document.getElementById('taxAtributosResumo') || {}).textContent || ''), null, { limite: 10000, descricao: 'contagem depois da leitura lenta' });
    afirma(true, 'quando os perfis chegam: "2 definidos de 4"');
    afirma(erros.length === 0, 'nenhum erro de JS');
    await ctx.close();
  }
  {
    const { ctx, page, erros } = await abrir(browser, DESKTOP, { fail: ['taxonomia/organizacional/perfis'] });
    await page.click('.tax-item[data-codigo="SQ"]');
    await esperarCondicao(page, () => /indisponível agora/.test((document.getElementById('taxAtributosResumo') || {}).textContent || ''), null, { descricao: 'perfis recusados' });
    afirma(true, 'perfis recusados: "indisponível agora" (nunca "0 definidos")');
    afirma(erros.length === 0, 'nenhum erro de JS');
    await ctx.close();
  }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nOK — "Atributos / perfil" recolhível: começa fechado com "X definidos de N", expande e recolhe, edição continua gravando, troca de conceito recolhe, estados lento/recusado distintos; desktop e 375 px.');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
