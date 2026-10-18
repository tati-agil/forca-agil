/* PADRÃO VISUAL OFICIAL — verificações reutilizáveis (docs/padrao-visual.md, §3-A e §5). Rodam na página real, sobre os
 * estilos CALCULADOS pelo navegador e com interação de teclado — nunca procurando classes ou textos no código-fonte.
 *
 *   const { verificarTela } = require('./padrao-visual-verificacoes');
 *   const problemas = await verificarTela(page, { escopo: '#page-avaliacoes', largura: 1280 });
 *   // [] = conforme; cada problema: { regra, detalhe }
 *
 * Regras (cada uma pega uma regressão real, sem reprovar diferença visual irrelevante):
 *   link-cor-do-navegador  link visível com a cor PADRÃO do navegador (azul/roxo no esquema claro, lilás/roxo no escuro):
 *                          sinal de que nenhuma regra do site dá cor ao link — e, depois de visitado, ele fica roxo.
 *   contraste              texto de link, botão, rótulo ou parágrafo com contraste < 4,5:1 (3:1 para texto grande) sobre
 *                          o fundo realmente pintado atrás dele (as camadas translúcidas são compostas).
 *   voltar-sem-navegacao   botão/link de retorno ("← …") sem o estilo de navegação (.avp-voltar-link, contorno ciano).
 *   amarelos-concorrentes  mais de uma ação principal (amarela, .btn--primary) no mesmo cartão/seção.
 *   botao-esticado         (só ≥ 1024 px) botão com mais de 420 px e mais de 60% da largura do contêiner — o tamanho
 *                          deve ser o do texto, como os demais botões do site.
 *   foco-invisivel         controle alcançado pelo Tab sem contorno (ou anel) visível.
 *   rolagem-lateral        (só ≤ 480 px) a página rola para os lados.
 * Fora do escopo das regras de cor: as exceções aprovadas do padrão (a folha clara do Mapa, .mfm-painel, e a Taxonomia,
 * .tax-ui), que têm os seus próprios testes. */

const CORES_PADRAO_DO_NAVEGADOR = ['rgb(0, 0, 238)', 'rgb(85, 26, 139)', 'rgb(158, 158, 255)', 'rgb(208, 173, 240)', 'rgb(0, 102, 204)'];
const FORA = '.mfm-painel, .mfm-detalhe, .tax-ui';

async function verificarTela(page, opts) {
  opts = Object.assign({ escopo: '#page-avaliacoes', largura: 1280, focos: 14 }, opts || {});
  const problemas = await page.evaluate(({ escopo, largura, CORES, FORA }) => {
    const out = [];
    const raiz = document.querySelector(escopo);
    if (!raiz) return [{ regra: 'escopo', detalhe: 'não encontrado: ' + escopo }];
    const visivel = (e) => { const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false; if (e.checkVisibility && !e.checkVisibility()) return false; const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05; };
    const nome = (e) => (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '')) + ' "' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40) + '"';
    const fora = (e) => !!e.closest(FORA);
    /* ---- cor do link ---- */
    raiz.querySelectorAll('a[href]').forEach((a) => {
      if (!visivel(a) || fora(a)) return;
      const c = getComputedStyle(a).color;
      if (CORES.indexOf(c) !== -1) out.push({ regra: 'link-cor-do-navegador', detalhe: nome(a) + ' → ' + c });
    });
    /* ---- contraste ---- */
    const rgba = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const compor = (cima, baixo) => { const a = cima.a + baixo.a * (1 - cima.a); if (!a) return { r: 0, g: 0, b: 0, a: 0 }; return { r: (cima.r * cima.a + baixo.r * baixo.a * (1 - cima.a)) / a, g: (cima.g * cima.a + baixo.g * baixo.a * (1 - cima.a)) / a, b: (cima.b * cima.a + baixo.b * baixo.a * (1 - cima.a)) / a, a }; };
    const fundo = (e) => {
      const camadas = []; let n = e, comImagem = false;
      while (n && n.nodeType === 1) { const cs = getComputedStyle(n); const c = rgba(cs.backgroundColor); if (cs.backgroundImage && cs.backgroundImage !== 'none' && n !== document.body && n !== document.documentElement) comImagem = true; if (c && c.a > 0) { camadas.push(c); if (c.a >= 0.999) break; } n = n.parentElement; }
      let base = rgba(getComputedStyle(document.body).backgroundColor) || { r: 0, g: 0, b: 0, a: 1 }; if (base.a < 1) base = compor(base, { r: 3, g: 5, b: 13, a: 1 });
      for (let i = camadas.length - 1; i >= 0; i--) base = compor(camadas[i], base);
      return { cor: base, comImagem };
    };
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const contraste = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
    const textos = raiz.querySelectorAll('a[href], button, label, p, h2, h3, h4, h5, summary, .avp-ficha-meta, .mf-linha-nome, .mf-linha-situacao');
    textos.forEach((e) => {
      if (!visivel(e) || fora(e) || e.disabled || e.closest('[disabled]')) return;
      const proprio = Array.prototype.some.call(e.childNodes, (n) => n.nodeType === 3 && n.textContent.trim());
      if (!proprio) return;
      const cs = getComputedStyle(e); const cor = rgba(cs.color); if (!cor) return;
      const f = fundo(e); if (f.comImagem) return; /* gradiente ou imagem: a composição por cor não é confiável — não julga */
      const t = compor(cor, f.cor); const k = contraste(t, f.cor);
      const px = parseFloat(cs.fontSize), negrito = parseInt(cs.fontWeight, 10) >= 600;
      const minimo = px >= 24 || (px >= 18.66 && negrito) ? 3 : 4.5;
      if (k < minimo - 0.05) out.push({ regra: 'contraste', detalhe: nome(e) + ' → ' + k.toFixed(2) + ':1 (mínimo ' + minimo + ')' });
    });
    /* ---- hierarquia ---- */
    raiz.querySelectorAll('a, button').forEach((e) => {
      if (!visivel(e) || fora(e)) return;
      if (/^←/.test((e.textContent || '').trim()) && !e.classList.contains('avp-voltar-link')) out.push({ regra: 'voltar-sem-navegacao', detalhe: nome(e) });
    });
    const grupos = new Map();
    raiz.querySelectorAll('.btn--primary').forEach((b) => {
      if (!visivel(b) || fora(b)) return;
      const g = b.closest('.avp-form-card, .avp-inicio-cartao, .avp-trab-secao, details, section') || raiz;
      grupos.set(g, (grupos.get(g) || []).concat([b]));
    });
    grupos.forEach((bs) => { if (bs.length > 1) out.push({ regra: 'amarelos-concorrentes', detalhe: bs.map(nome).join(' + ') }); });
    if (largura >= 1024) raiz.querySelectorAll('.btn').forEach((b) => {
      if (!visivel(b) || fora(b)) return;
      const w = b.getBoundingClientRect().width, cw = b.parentElement.getBoundingClientRect().width;
      if (w > 420 && w > 0.6 * cw) out.push({ regra: 'botao-esticado', detalhe: nome(b) + ' → ' + Math.round(w) + ' px de ' + Math.round(cw) });
    });
    if (largura <= 480 && document.documentElement.scrollWidth > window.innerWidth + 1) out.push({ regra: 'rolagem-lateral', detalhe: document.documentElement.scrollWidth + ' px > ' + window.innerWidth });
    return out;
  }, { escopo: opts.escopo, largura: opts.largura, CORES: CORES_PADRAO_DO_NAVEGADOR, FORA });
  /* ---- foco por teclado (interação real: Tab) ---- */
  await page.evaluate((escopo) => { const r = document.querySelector(escopo); if (r && document.activeElement && !r.contains(document.activeElement)) { const t = document.createElement('span'); t.tabIndex = -1; r.prepend(t); t.focus(); t.remove(); } }, opts.escopo);
  for (let i = 0; i < opts.focos; i++) {
    await page.keyboard.press('Tab');
    const f = await page.evaluate(({ escopo, FORA }) => {
      const e = document.activeElement, raiz = document.querySelector(escopo);
      if (!e || !raiz || !raiz.contains(e) || e.closest(FORA)) return null;
      const cs = getComputedStyle(e);
      const contorno = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 1.5;
      const anel = cs.boxShadow && cs.boxShadow !== 'none';
      return contorno || anel ? null : (e.id ? '#' + e.id : e.tagName.toLowerCase()) + ' "' + (e.textContent || e.value || '').trim().slice(0, 30) + '"';
    }, { escopo: opts.escopo, FORA });
    if (f) problemas.push({ regra: 'foco-invisivel', detalhe: f });
  }
  return problemas;
}

module.exports = { verificarTela, CORES_PADRAO_DO_NAVEGADOR };
