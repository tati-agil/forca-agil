/* Padrão Visual Oficial do Força Ágil (docs/padrao-visual.md) — proteção contra regressões, começando pela área de
 * Arquitetura Organizacional (tipografia, PR 1 da unificação). Mede os estilos CALCULADOS (critérios explícitos, sem
 * comparação de pixels, que falharia por diferença irrelevante de renderização) de todo texto visível dentro do
 * domínio — página Avaliação (#page-avaliacoes) e abas ADMIN › Avaliações e Mapa e ADMIN › Taxonomia — em várias
 * telas, no desktop e a 375 px:
 *   - identidade: fundo espacial presente (#sky com a nebulosa, #stars por cima) e campos de formulário escuros
 *     (nada de fundo branco);
 *   - nenhum texto abaixo do piso de leitura (0,8 rem = 12,8 px);
 *   - nenhum negrito sintético (Anton pedida acima do peso 400, o único que a fonte tem);
 *   - Space Mono só onde é identidade: botões, sobretítulo, códigos (sigla/código);
 *   - nenhum controle caindo na Arial padrão do navegador;
 *   - identidade preservada: título da página em Anton, títulos de seção na Oswald, botões na Space Mono;
 *   - fora do domínio nada muda (o Início do site mantém a fonte e o peso dos títulos de antes);
 *   - nenhuma rolagem lateral.
 * As fontes do Google não carregam no ambiente hermético: o que se mede é a fonte PEDIDA pelo CSS (a primeira da
 * pilha), não a desenhada. Firebase falso; nada é gravado. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { esperarSessaoAssentada, esperarCondicao } = require('./esperas');
const SJ = require('./semente-jornada');

const BASE = process.env.FA_BASE_URL || 'http://127.0.0.1:8811';
const FALSO = fs.readFileSync(path.join(__dirname, 'persistencia-firebase-real.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'firebase-falso.js'), 'utf8');
let falhas = 0;
function afirma(c, msg, det) { console.log((c ? '  ok    ' : '  FALHA ') + msg + (!c && det !== undefined ? ' → ' + JSON.stringify(det).slice(0, 600) : '')); if (!c) falhas++; }

const TELAS = [
  ['Início da Avaliação', '#arquitetura', '#avpInicioCartaoNatureza'],
  ['Lista P1–P16', '#arquitetura?av=lista', '.avp-act-ver'],
  ['Trabalhos', '#arquitetura?tr=1', '#avpTrabIrProdutos'],
  ['Lista O1–O9', '#arquitetura?po=lista', '#poNovoBtn'],
  ['Jornada', '#arquitetura?mf=catalogo', '.mf-item, #mfBusca'],
  ['ADMIN › Avaliações e Mapa', '#admin?arq=inicio', '#avpGrupoConfiguracao'],
  ['Motor P1–P16', '#admin?arq=motores', '#avpMotorArquitetural'],
  ['Questionário P1–P16', '#admin?arq=questionarios&q=p1p16', '#avpCfgTitulo'],
  ['Nova avaliação P1–P16 (formulário)', '#arquitetura?nova=1', '#avpfNome'],
  ['Usuários autorizados (formulário)', '#admin?arq=usuarios', '#avpUsuariosBusca']
];

async function abrir(browser, vp, hash) {
  const db = SJ.semente(); db['fa-admins'] = { [SJ.chave(SJ.ARQ)]: { email: SJ.ARQ, name: 'ADMIN' } };
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await ctx.addInitScript('window.__CFG = ' + JSON.stringify({ db, user: { email: SJ.ARQ, emailVerified: true, uid: 'u1' }, delayDefault: 5, persistenciaReal: true }) + ';');
  await page.route('**/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FALSO }));
  await page.route('**fonts.googleapis.com**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com**', (r) => r.abort());
  await page.goto(BASE + '/index.html' + hash, { waitUntil: 'domcontentloaded' });
  await esperarSessaoAssentada(page);
  return { ctx, page, erros };
}
/* todo texto visível dentro do contêiner do domínio que está na tela */
const medir = (page) => page.evaluate(() => {
  const raiz = document.querySelector('#page-avaliacoes:not([hidden]), #adminPanelArquitetura.active, #adminPanelTaxonomia.active');
  if (!raiz) return null;
  document.querySelectorAll('details').forEach((d) => { if (raiz.contains(d)) d.open = true; });
  const out = []; const vistos = new Set();
  const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const t = w.currentNode.textContent.trim(); if (t.length < 2) continue;
    const el = w.currentNode.parentElement; if (!el || vistos.has(el)) continue; vistos.add(el);
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden') continue;
    const identidade = !!el.closest('.btn, .avp-voltar-link, .eyebrow, code, kbd, samp, [class*="-sigla"], [class*="-codigo"]');
    out.push({ fam: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), px: parseFloat(cs.fontSize), w: Number(cs.fontWeight), identidade, tag: el.tagName.toLowerCase(), cls: String(el.className || '').split(' ')[0], txt: t.slice(0, 40) });
  }
  return out;
});
const larguraOk = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const esquemaRaiz = (page) => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
/* foco por teclado: percorre até n paradas de Tab dentro do domínio e devolve os controles cujo foco não aparece —
   nem contorno, nem sombra, nem mudança de borda/fundo em relação ao mesmo controle sem foco */
async function focoInvisivel(page, n) {
  const vistos = [];
  /* começa no primeiro controle do domínio (no ADMIN, menu e abas vêm antes): foca por programa e volta um passo,
     para que o primeiro Tab já chegue a ele como foco de teclado */
  const temInicio = await page.evaluate(() => {
    const raiz = document.querySelector('#page-avaliacoes:not([hidden]), #adminPanelArquitetura.active, #adminPanelTaxonomia.active');
    const alvo = raiz && Array.from(raiz.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')).find((e) => !e.disabled && e.getBoundingClientRect().width > 0);
    if (!alvo) return false; alvo.focus(); return true;
  });
  if (temInicio) await page.keyboard.press('Shift+Tab');
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Tab');
    const f = await page.evaluate((i) => {
      const e = document.activeElement;
      if (!e || e === document.body || !e.closest('#page-avaliacoes, #adminPanelArquitetura, #adminPanelTaxonomia')) return null;
      const c = getComputedStyle(e);
      window.__pvFoco = window.__pvFoco || {};
      window.__pvFoco[i] = [c.outlineStyle, c.outlineWidth, c.boxShadow, c.borderTopColor, c.backgroundColor].join('|');
      e.setAttribute('data-pv-foco', i);
      return { i, el: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + '.' + String(e.className).split(' ')[0], contorno: (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0) || c.boxShadow !== 'none' };
    }, i);
    if (f) vistos.push(f);
  }
  const muda = await page.evaluate(() => {
    if (document.activeElement) document.activeElement.blur();
    const o = {};
    document.querySelectorAll('[data-pv-foco]').forEach((e) => { const c = getComputedStyle(e); const i = e.getAttribute('data-pv-foco'); o[i] = window.__pvFoco[i] !== [c.outlineStyle, c.outlineWidth, c.boxShadow, c.borderTopColor, c.backgroundColor].join('|'); });
    return o;
  });
  return { total: vistos.length, invisiveis: [...new Set(vistos.filter((f) => !f.contorno && !muda[f.i]).map((f) => f.el))] };
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [nome, vp] of [['desktop', { width: 1280, height: 900 }], ['375 px', { width: 375, height: 812 }]]) {
      console.log('\n######## ' + nome + ' ########');
      for (const [rotulo, hash, sel] of TELAS) {
        const r = await abrir(browser, vp, hash);
        await esperarCondicao(r.page, (s) => !!document.querySelector(s), sel, { limite: 20000, descricao: rotulo });
        await r.page.waitForTimeout(300);
        const t = await medir(r.page);
        afirma(Array.isArray(t) && t.length > 5, rotulo + ': textos do domínio medidos (' + (t ? t.length : 0) + ')');
        if (t) {
          const pequenos = t.filter((x) => x.px < 12.75);
          afirma(!pequenos.length, rotulo + ': nenhum texto abaixo de 12,8 px', pequenos.slice(0, 6));
          /* leitura confortável, não só o piso: rótulos de campo no tamanho auxiliar (0,86 rem) ou maior */
          const rotulos = t.filter((x) => x.tag === 'label' && x.px < 13.7);
          afirma(!rotulos.length, rotulo + ': rótulos de campo com 0,86 rem ou mais', rotulos.slice(0, 4));
          const sint = t.filter((x) => x.fam === 'Anton' && x.w > 400);
          afirma(!sint.length, rotulo + ': nenhum negrito sintético (Anton acima de 400)', sint);
          const mono = t.filter((x) => x.fam === 'Space Mono' && !x.identidade);
          afirma(!mono.length, rotulo + ': Space Mono só em botões, sobretítulo e códigos', mono.slice(0, 6));
          const arial = t.filter((x) => x.fam === 'Arial');
          afirma(!arial.length, rotulo + ': nenhum texto na Arial padrão do navegador', arial.slice(0, 4));
          const botoes = t.filter((x) => /^btn/.test(x.cls));
          if (botoes.length) afirma(botoes.every((x) => x.fam === 'Space Mono'), rotulo + ': botões continuam na Space Mono (identidade)', botoes.filter((x) => x.fam !== 'Space Mono').slice(0, 3));
        }
        afirma(await larguraOk(r.page), rotulo + ': sem rolagem lateral');
        /* identidade: fundo espacial e campos escuros (critérios explícitos, não pixels) */
        const id = await r.page.evaluate(() => {
          const sky = document.getElementById('sky'), stars = document.getElementById('stars');
          const lum = (c) => { const v = (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
          const raiz = document.querySelector('#page-avaliacoes:not([hidden]), #adminPanelArquitetura.active, #adminPanelTaxonomia.active');
          const campos = raiz ? Array.from(raiz.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select, textarea')).filter((e) => e.getBoundingClientRect().width > 0) : [];
          return {
            fundo: !!sky && /nebula\.jpg/.test(getComputedStyle(sky).backgroundImage) && getComputedStyle(sky).position === 'fixed',
            estrelas: !!stars && getComputedStyle(stars).position === 'fixed',
            camposClaros: campos.filter((e) => { const bg = getComputedStyle(e).backgroundColor; const a = (bg.match(/[\d.]+/g) || [])[3]; return !(a !== undefined && Number(a) < 0.3) && lum(bg) > 0.4; }).map((e) => e.id || e.tagName)
          };
        });
        afirma(id.fundo && id.estrelas, rotulo + ': fundo espacial intacto (nebulosa e estrelas)', id);
        afirma(!id.camposClaros.length, rotulo + ': nenhum campo de formulário com fundo claro', id.camposClaros);
        /* barra de rolagem da página no tema escuro (a barra pertence ao <html>) */
        afirma(await esquemaRaiz(r.page) === 'dark', rotulo + ': raiz da página com color-scheme escuro (barra de rolagem no tema)', await esquemaRaiz(r.page));
        const fo = await focoInvisivel(r.page, 25);
        afirma(fo.total > 0 && !fo.invisiveis.length, rotulo + ': foco por teclado visível em todos os controles percorridos (' + fo.total + ')', fo.invisiveis);
        if (hash === '#arquitetura') {
          const h1 = await r.page.evaluate(() => { const e = document.querySelector('#page-avaliacoes .page-hero h1'); const c = getComputedStyle(e); return { fam: c.fontFamily.split(',')[0].replace(/["']/g, ''), w: c.fontWeight }; });
          afirma(h1.fam === 'Anton' && h1.w === '400', 'título da página: Anton (identidade), no peso que a fonte tem', h1);
          const h3 = await r.page.evaluate(() => { const e = document.querySelector('#page-avaliacoes h3, #page-avaliacoes h4'); return e ? getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '') : null; });
          afirma(h3 === 'Oswald', 'títulos de seção: Oswald mantida (identidade)', h3);
        }
        afirma(r.erros.length === 0, rotulo + ': nenhum erro de página', r.erros);
        await r.ctx.close();
      }
      /* Taxonomia (admin geral): aba do ADMIN */
      {
        const r = await abrir(browser, vp, '#admin');
        await r.page.waitForSelector('.admin-tab-btn[data-panel="adminPanelTaxonomia"]', { timeout: 15000 });
        await r.page.click('.admin-tab-btn[data-panel="adminPanelTaxonomia"]');
        await esperarCondicao(r.page, () => !!document.querySelector('#adminPanelTaxonomia.active .tax-ui'), null, { limite: 15000, descricao: 'a Taxonomia' });
        await r.page.waitForTimeout(500);
        const t = await medir(r.page);
        afirma(t && !t.some((x) => x.fam === 'Arial'), 'Taxonomia: os itens da lista (botões) herdam a fonte, nada na Arial', t && t.filter((x) => x.fam === 'Arial').slice(0, 3));
        afirma(t && !t.some((x) => x.px < 12.75), 'Taxonomia: nenhum texto abaixo de 12,8 px', t && t.filter((x) => x.px < 12.75).slice(0, 4));
        const h1 = await r.page.evaluate(() => getComputedStyle(document.querySelector('.admin-hero h1')).fontWeight);
        afirma(h1 === '400', 'cabeçalho do ADMIN com aba da Arquitetura: sem negrito sintético', h1);
        afirma(await larguraOk(r.page), 'Taxonomia: sem rolagem lateral');
        afirma(await esquemaRaiz(r.page) === 'dark', 'Taxonomia: raiz da página com color-scheme escuro');
        const fo = await focoInvisivel(r.page, 25);
        afirma(fo.total > 0 && !fo.invisiveis.length, 'Taxonomia: foco por teclado visível em todos os controles percorridos (' + fo.total + ')', fo.invisiveis);
        await r.ctx.close();
      }
      /* fora do domínio, nada muda */
      {
        const r = await abrir(browser, vp, '#home');
        await r.page.waitForTimeout(800);
        const fora = await r.page.evaluate(() => {
          const b = getComputedStyle(document.body).fontFamily;
          const btn = document.querySelector('#page-home .btn, .page-section:not([hidden]) .btn');
          return { body: b, btn: btn ? { fam: getComputedStyle(btn).fontFamily.split(',')[0].replace(/["']/g, ''), fs: getComputedStyle(btn).fontSize, ls: getComputedStyle(btn).letterSpacing } : null };
        });
        afirma(/system-ui/.test(fora.body), 'fora do domínio: o corpo do site continua com a mesma fonte', fora.body);
        if (fora.btn) afirma(fora.btn.fam === 'Space Mono' && fora.btn.fs === '12.48px', 'fora do domínio: botões do site com o tamanho de antes (0,78 rem)', fora.btn);
        afirma(await esquemaRaiz(r.page) === 'normal', 'fora do domínio: a raiz da página continua sem color-scheme (o escuro vale só nas telas da Arquitetura)', await esquemaRaiz(r.page));
        await r.ctx.close();
      }
    }
  } catch (e) { console.error(e); falhas++; }
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
