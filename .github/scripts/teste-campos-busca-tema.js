/* CAMPOS DE BUSCA E FILTRO NO TEMA ESCURO — o filtro da Avaliações Squad, a busca da Jornada do Mapa e o motivo do marcador
 * da Estrutura Organizacional Atual ficavam com o fundo branco do navegador (sem classe, fora do seletor do tema ou sem
 * type). Prova, no computador e a 375 px: fundo escuro; texto preenchido e placeholder com contraste ≥ 4,5:1; foco
 * visível; e os filtros continuam filtrando. Estrutura Atual com a gravação liberada: todos os controles nativos (campos
 * sem type, select, data, textarea, checkbox "Mostrar encerradas") no padrão escuro, inclusive desabilitado e somente
 * leitura. ADMIN › Acessos: só as permissões, sem o antigo controle de disponibilidade da Análise Organizacional
 * (Porta 2); só admin geral.
 * Firebase falso em persistência real; hermético; conteúdo fictício. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarCondicao, esperarSessaoAssentada } = require('./esperas');
const SJ = require('./semente-jornada');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
let falhas = 0;
function afirma(c, msg, det) { console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + JSON.stringify(det) : '')); if (!c) falhas++; }
const Q = '2026-10-01T09:00:00.000Z', quem = { name: 'Pessoa', email: SJ.ARQ };
const squad = (itemId, itemNome) => ({ itemId, itemNome, avaliacaoArquiteturalId: itemId, questionarioCodigo: 'ADEQUACAO_SQUAD', questionnaireContentVersion: 1, status: 'rascunho', criadoEm: Q, atualizadoEm: Q, criadoPor: quem, atualizadoPor: quem, respostas: { S2: { codigoPergunta: 'S2', resposta: 'nao', questionnaireContentVersion: 1, dataResposta: Q } }, excluido: false });

async function abrir(browser, vp, hash, o) {
  const db = SJ.semente();
  if (o && o.eaLiberada) db['estrutura-atual-config'] = { habilitacao: 'LIBERADO', motivo: 'semente', alteradoEm: 1, alteradoPor: { uid: 'x', email: SJ.ARQ }, auditoriaId: 'a0' };
  if (o && o.restrito) db['fa-admins'] = {};
  if (!(o && o.restrito)) db['fa-admins'] = { [SJ.chave(SJ.ARQ)]: { email: SJ.ARQ, name: 'ADMIN' } };
  db['avaliacoes-squad'] = { sA: squad('pAssess', 'Assessoria Previdenciária'), sB: squad('pCapec', 'Capec') };
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => { erros.push(String(e)); console.log('[PAGEERROR]', String(e)); });
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify({ db, user: { email: SJ.ARQ, emailVerified: true, uid: 'u1' }, delayDefault: 10, persistenciaReal: true }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
/* cores calculadas do campo: fundo (compondo transparências com os ancestrais), texto, placeholder, contorno no foco */
const medir = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s); if (!el) return null;
  const rgb = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => [c.r, c.g, c.b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  const sobre = (c, f) => ({ r: c.r * c.a + f.r * (1 - c.a), g: c.g * c.a + f.g * (1 - c.a), b: c.b * c.a + f.b * (1 - c.a), a: 1 });
  const fundo = (e) => { const pilha = []; for (let x = e; x; x = x.parentElement) { const c = rgb(getComputedStyle(x).backgroundColor); if (c && c.a > 0) { pilha.push(c); if (c.a >= 1) break; } } let f = { r: 4, g: 7, b: 15, a: 1 }; for (let i = pilha.length - 1; i >= 0; i--) f = sobre(pilha[i], f); return f; };
  const razao = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const f = fundo(el), cs = getComputedStyle(el), ph = getComputedStyle(el, '::placeholder');
  return { lumFundo: lum(f), texto: razao(sobre(rgb(cs.color), f), f), placeholder: razao(sobre(rgb(ph.color), f), f) };
}, sel);
async function focoVisivel(page, sel) {
  await page.focus(sel); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
  return page.evaluate((s) => { const e = document.querySelector(s); if (document.activeElement !== e) return false; const cs = getComputedStyle(e); return (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 1) || cs.borderColor !== getComputedStyle(document.body).color; }, sel);
}
async function conferir(page, sel, rotulo) {
  const m = await medir(page, sel);
  afirma(!!m && m.lumFundo < 0.1, rotulo + ': fundo escuro (não o branco do navegador)', m);
  afirma(!!m && m.placeholder >= 4.5, rotulo + ': placeholder legível (≥ 4,5:1)', m && m.placeholder.toFixed(2));
  afirma(await focoVisivel(page, sel), rotulo + ': foco visível');
}

(async () => {
  const browser = await chromium.launch();
  for (const [tag, vp] of [['desktop', { width: 1280, height: 900 }], ['375 px', { width: 375, height: 800 }]]) {
    console.log('\n######## ' + tag + ' ########');
    /* Avaliações Squad */
    let r = await abrir(browser, vp, '#arquitetura?sq=lista');
    await esperarCondicao(r.page, () => !!document.getElementById('sqFiltroTexto') && document.querySelectorAll('#avaliacoesSquad tbody tr, #avaliacoesSquad .sq-item, #avaliacoesSquad [data-key]').length >= 2, null, { limite: 15000, descricao: 'lista da Squad com o filtro' });
    await conferir(r.page, '#sqFiltroTexto', 'Squad');
    const antes = await r.page.evaluate(() => document.querySelector('#avaliacoesSquad').innerText);
    await r.page.fill('#sqFiltroTexto', 'Capec');
    await esperarCondicao(r.page, () => { const t = document.querySelector('#avaliacoesSquad').innerText; return /Capec/.test(t) && !/Assessoria Previdenciária/.test(t); }, null, { descricao: 'filtro da Squad aplicado' });
    const m = await medir(r.page, '#sqFiltroTexto');
    afirma(/Assessoria Previdenciária/.test(antes) && m.texto >= 4.5 && await r.page.inputValue('#sqFiltroTexto') === 'Capec', 'Squad: o filtro continua filtrando; texto preenchido legível (' + m.texto.toFixed(2) + ':1)');
    afirma(await r.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Squad: sem rolagem lateral');
    afirma(r.erros.length === 0, 'Squad: nenhum erro de JS');
    await r.ctx.close();
    /* Jornada do Mapa */
    r = await abrir(browser, vp, '#arquitetura?mf=catalogo');
    await esperarCondicao(r.page, () => !!document.getElementById('mfBusca') && !!document.querySelector('.mf-linha'), null, { limite: 15000, descricao: 'Jornada com a busca' });
    await conferir(r.page, '#mfBusca', 'Jornada do Mapa');
    await r.page.fill('#mfBusca', 'Capec');
    await esperarCondicao(r.page, () => document.querySelectorAll('#mfItens .mf-linha').length === 1, null, { descricao: 'busca da Jornada aplicada' });
    afirma((await medir(r.page, '#mfBusca')).texto >= 4.5, 'Jornada do Mapa: a busca continua filtrando; texto preenchido legível');
    afirma(r.erros.length === 0, 'Jornada: nenhum erro de JS');
    await r.ctx.close();
    /* Estrutura Organizacional Atual — motivo do marcador */
    r = await abrir(browser, vp, '#arquitetura?arq=estrutura-atual');
    const tem = await esperarCondicao(r.page, () => !!document.getElementById('eaMarcadorMotivo'), null, { limite: 15000, descricao: 'motivo do marcador da Estrutura Atual' }).then(() => true);
    const g0 = await r.page.evaluate(() => (window.__ESCRITAS || []).length); /* a página grava sozinha ao abrir (registro de acesso): conta só o que vem depois */
    if (tem) {
      await r.page.click('#eaMarcadorDet > summary'); /* 'Liberar a gravação': o formulário fica recolhido até a pessoa abrir */
      await r.page.waitForSelector('#eaMarcadorMotivo', { state: 'visible' });
      await conferir(r.page, '#eaMarcadorMotivo', 'Estrutura Atual (motivo)');
      await r.page.fill('#eaMarcadorMotivo', 'Motivo fictício');
      afirma((await medir(r.page, '#eaMarcadorMotivo')).texto >= 4.5, 'Estrutura Atual: texto preenchido legível');
    }
    afirma(await r.page.evaluate(() => (window.__ESCRITAS || []).length) === g0, 'Estrutura Atual: nada gravado (só digitado)');
    await r.ctx.close();
    /* Estrutura Atual com a gravação liberada: o formulário de unidade e os demais controles */
    r = await abrir(browser, vp, '#arquitetura?arq=estrutura-atual', { eaLiberada: true });
    await esperarCondicao(r.page, () => !!document.getElementById('eaNovaBtn') && !!document.getElementById('eaMostrarEncerradas'), null, { limite: 15000, descricao: 'Estrutura Atual liberada' });
    const chk = await r.page.evaluate(() => { const c = document.getElementById('eaMostrarEncerradas'), cs = getComputedStyle(c); return { accent: cs.accentColor, esquema: getComputedStyle(c.closest('.ea-tela')).colorScheme }; });
    afirma(chk.accent !== 'auto' && /dark/.test(chk.esquema), '"Mostrar encerradas": caixa no padrão do sistema (accent-color) e controles nativos no esquema escuro', chk);
    const g1 = await r.page.evaluate(() => (window.__ESCRITAS || []).length);
    await r.page.click('#eaNovaBtn'); await r.page.waitForSelector('#eaFormUnidade');
    const claros = await r.page.evaluate(() => {
      const lum = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return 1; const p = m[1].split(',').map(parseFloat); return (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) / 255; };
      return [...document.querySelectorAll('.ea-tela input:not([type=checkbox]):not([type=radio]), .ea-tela select, .ea-tela textarea')].filter((e) => e.offsetParent).map((e) => ({ id: e.id, l: lum(getComputedStyle(e).backgroundColor) })).filter((x) => x.l > 0.3);
    });
    afirma(claros.length === 0, 'formulário de unidade: nenhum campo, select ou data com fundo claro', claros);
    await conferir(r.page, '#eaNome', 'Estrutura Atual (Nome, campo sem type)');
    await r.page.fill('#eaNome', 'Unidade fictícia');
    afirma((await medir(r.page, '#eaNome')).texto >= 4.5, 'Estrutura Atual: Nome preenchido legível');
    const estados = await r.page.evaluate(() => { const e = document.getElementById('eaNome'); e.disabled = true; const d = getComputedStyle(e); const r1 = { opacidade: d.opacity, cursor: d.cursor }; e.disabled = false; e.readOnly = true; const ro = getComputedStyle(e).backgroundColor; e.readOnly = false; return { r1, ro }; });
    afirma(parseFloat(estados.r1.opacidade) < 1 && estados.r1.cursor === 'not-allowed' && /rgb/.test(estados.ro), 'Estrutura Atual: desabilitado e somente leitura com estados próprios', estados);
    afirma(await r.page.evaluate(() => (window.__ESCRITAS || []).length) === g1 && r.erros.length === 0, 'Estrutura Atual: nada gravado, nenhum erro de JS');
    await r.ctx.close();
    /* ADMIN › Acessos: só as permissões (a Porta 2 segue os perfis; não há mais controle de disponibilidade) */
    r = await abrir(browser, vp, '#arquitetura?arq=inicio');
    await esperarCondicao(r.page, () => !!document.getElementById('avpAdminAcessos') && !!document.getElementById('avpUsuariosBtn'), null, { limite: 15000, descricao: 'ADMIN › Acessos' });
    const ac = await r.page.evaluate(() => ({ titulo: document.getElementById('avpAdminAcessosTitulo').textContent, perm: !!document.querySelector('#avpAdminAcessos #avpUsuariosBtn'),
      disp: document.querySelectorAll('#anHabilitacao, #anHabilitacaoAdmin, #avpAcessosDisponibilidade, #avpDispPorta2').length, texto: document.getElementById('avpAdminAcessos').textContent }));
    afirma(ac.titulo === 'Acessos' && ac.perm && ac.disp === 0 && !/Disponibilidade/.test(ac.texto), 'Acessos: as permissões (Usuários autorizados), sem "Disponibilidade de funcionalidades"', ac);
    afirma(r.erros.length === 0, 'Acessos: nenhum erro de JS');
    await r.ctx.close();
    /* perfil restrito (Avaliação + Configuração): sem Acessos (só admin geral), como antes */
    r = await abrir(browser, vp, '#arquitetura?arq=inicio', { restrito: true });
    await esperarCondicao(r.page, () => !!document.getElementById('avpAdminMapa'), null, { limite: 15000, descricao: 'ADMIN do perfil restrito' });
    afirma(await r.page.locator('#avpAdminAcessos, #avpUsuariosBtn').count() === 0, 'perfil restrito: sem Acessos (só admin geral, como antes)');
    await r.ctx.close();
  }
  await browser.close();
  console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TUDO OK'));
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
