/* ============================================================
   EXPORTAÇÃO DAS REGRAS DOS MOTORES EM PDF (window.faExportacaoMotores / module.exports) — puro: sem banco, sem
   autenticação, sem DOM, sem relógio. Monta o documento (blocos de HTML para window.faPdfEmBlocos) a partir dos DADOS
   que a tela de cada motor já usa — as regras da versão em vigor, o texto vigente das perguntas, os nomes da Taxonomia
   e os itens de "Como este motor decide" —, nunca uma segunda descrição da lógica escrita aqui.

   É uma fotografia de consulta: não grava nada, não recalcula nenhuma avaliação e não muda versão nenhuma.

   cfg = {
     titulo, subtitulo?, slug (nome do arquivo),
     metadados: [[rótulo, valor], ...],             // versão, publicação, questionário, gerado em/por
     comoDecideHtml?: '<li>…</li>…',                 // itens já prontos da própria tela (HTML confiável)
     perguntas: [{ codigo, titulo, texto }],
     rotuloCampo(campo) → texto, rotuloValor(campo, valor) → texto,
     secoes: [{ titulo, intro?, regras: [{ ordem, codigo, resultado, detalhe?, condicao?, descricao?, fallback? }] }],
     notas?: [texto, ...]
   }
   ============================================================ */
(function (raiz) {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var CSS = '' +
    '.pdf-doc{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;background:#ffffff;font-size:11px;line-height:1.5;padding:4px 6px}' +
    '.pdf-header{text-align:center;border-bottom:2px solid #16306a;padding-bottom:10px;margin-bottom:14px}' +
    '.pdf-header-marca{font-size:12px;letter-spacing:.08em;color:#16306a;text-transform:uppercase;margin:0}' +
    '.pdf-header-titulo{font-size:19px;margin:4px 0;color:#0e1f44}' +
    '.pdf-header-sub{font-size:11px;color:#444;margin:0}' +
    '.mx-bloco{page-break-inside:avoid;break-inside:avoid;margin:0 0 10px}' +
    '.mx-h2{font-size:14px;color:#16306a;border-bottom:1px solid #c9d3ea;padding-bottom:3px;margin:14px 0 8px}' +
    '.mx-meta{width:100%;border-collapse:collapse}.mx-meta td{padding:3px 6px;border:1px solid #dde3f0;vertical-align:top}.mx-meta td:first-child{width:34%;color:#444;background:#f4f6fb}' +
    '.mx-aviso{background:#fff8e1;border:1px solid #f0d78c;padding:6px 8px;border-radius:4px}' +
    '.mx-lista{margin:0;padding-left:18px}.mx-lista li{margin:0 0 4px}' +
    '.mx-perg{width:100%;border-collapse:collapse}.mx-perg td,.mx-perg th{padding:4px 6px;border:1px solid #dde3f0;vertical-align:top;text-align:left}.mx-perg th{background:#e8edf8}.mx-perg td:first-child{width:12%;font-weight:bold}' +
    '.mx-regra{border:1px solid #c9d3ea;border-left:4px solid #16306a;border-radius:4px;padding:6px 8px}' +
    '.mx-regra-topo{margin:0 0 4px}.mx-ordem{display:inline-block;min-width:22px;font-weight:bold;color:#16306a}.mx-codigo{color:#555;font-family:monospace}' +
    '.mx-resultado{font-weight:bold}.mx-detalhe{color:#555}.mx-cond{margin:2px 0 0}.mx-cond ul{margin:2px 0;padding-left:16px}.mx-cond li{margin:1px 0}' +
    '.mx-fallback{border-left-color:#888}.mx-nota{color:#333}';

  /* condição → frase: folha { campo, valor }; grupos all / any / atLeast-of / not (a mesma linguagem do motor) */
  function condicaoHtml(c, cfg) {
    if (!c || typeof c !== 'object') return '';
    var lista = function (xs) { return '<ul>' + xs.map(function (x) { return '<li>' + condicaoHtml(x, cfg) + '</li>'; }).join('') + '</ul>'; };
    if (Array.isArray(c.all)) return 'todas estas condições:' + lista(c.all);
    if (Array.isArray(c.any)) return 'pelo menos uma destas:' + lista(c.any);
    if (Array.isArray(c.of) && c.atLeast != null) return 'pelo menos ' + esc(c.atLeast) + ' destas:' + lista(c.of);
    if (c.not) return 'NÃO acontecer o seguinte: ' + condicaoHtml(c.not, cfg);
    var campo = c.campo || c.pergunta;
    if (campo) return '<strong>' + esc(cfg.rotuloCampo ? cfg.rotuloCampo(campo) : campo) + '</strong> = ' + esc(cfg.rotuloValor ? cfg.rotuloValor(campo, c.valor != null ? c.valor : c.equals) : (c.valor != null ? c.valor : c.equals));
    return esc(JSON.stringify(c));
  }
  /* campos usados por uma condição (para "perguntas que não entram em nenhuma regra") */
  function camposDe(c, saida) {
    saida = saida || [];
    if (!c || typeof c !== 'object') return saida;
    (c.all || c.any || c.of || []).forEach(function (x) { camposDe(x, saida); });
    if (c.not) camposDe(c.not, saida);
    var campo = c.campo || c.pergunta;
    if (campo && saida.indexOf(campo) === -1) saida.push(campo);
    return saida;
  }
  function regraHtml(r, cfg) {
    var corpo = r.condicao ? '<p class="mx-cond">Se ' + condicaoHtml(r.condicao, cfg) + '</p>'
      : '<p class="mx-cond">' + esc(r.descricao || (r.fallback ? 'Sempre que nenhuma regra anterior se aplicar.' : '')) + '</p>';
    return '<div class="mx-bloco mx-regra' + (r.fallback ? ' mx-fallback' : '') + '"><p class="mx-regra-topo"><span class="mx-ordem">' + esc(r.ordem) + '.</span> ' +
      '<span class="mx-resultado">→ ' + esc(r.resultado) + '</span>' + (r.detalhe ? ' <span class="mx-detalhe">(' + esc(r.detalhe) + ')</span>' : '') +
      (r.codigo ? ' <span class="mx-codigo">[' + esc(r.codigo) + ']</span>' : '') + '</p>' + corpo + '</div>';
  }
  /* blocos independentes (cada um cabe numa página; faPdfEmBlocos agrupa) */
  function atomos(cfg) {
    var a = [];
    a.push('<div class="mx-bloco"><table class="mx-meta">' + (cfg.metadados || []).map(function (m) { return '<tr><td>' + esc(m[0]) + '</td><td>' + esc(m[1]) + '</td></tr>'; }).join('') + '</table></div>');
    a.push('<div class="mx-bloco"><p class="mx-aviso">Fotografia das regras em vigor no momento da exportação, só para consulta: nada foi gravado, nenhuma avaliação foi recalculada e nenhuma versão mudou.</p></div>');
    if (cfg.comoDecideHtml) a.push('<div class="mx-bloco"><h2 class="mx-h2">Como este motor decide</h2><ul class="mx-lista">' + cfg.comoDecideHtml + '</ul></div>');
    var ps = cfg.perguntas || [];
    for (var i = 0; i < ps.length; i += 6) {
      a.push('<div class="mx-bloco">' + (i === 0 ? '<h2 class="mx-h2">Perguntas (texto vigente)</h2>' : '') + '<table class="mx-perg">' + (i === 0 ? '<tr><th>Código</th><th>Pergunta</th></tr>' : '') +
        ps.slice(i, i + 6).map(function (p) { return '<tr><td>' + esc(p.codigo) + '</td><td>' + (p.titulo ? '<strong>' + esc(p.titulo) + '</strong><br>' : '') + esc(p.texto || '') + '</td></tr>'; }).join('') + '</table></div>');
    }
    (cfg.secoes || []).forEach(function (s) {
      var regras = s.regras || [];
      a.push('<div class="mx-bloco"><h2 class="mx-h2">' + esc(s.titulo) + '</h2>' + (s.intro ? '<p class="mx-nota">' + esc(s.intro) + '</p>' : '') + (regras.length ? regraHtml(regras[0], cfg) : '') + '</div>');
      regras.slice(1).forEach(function (r) { a.push(regraHtml(r, cfg)); });
    });
    if ((cfg.notas || []).length) a.push('<div class="mx-bloco"><h2 class="mx-h2">Observações</h2><ul class="mx-lista">' + cfg.notas.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></div>');
    return a;
  }
  function documentoPdf(html, comCabecalho, cfg) {
    return '<div class="pdf-doc"><style>' + CSS + '</style>' + (comCabecalho ? '<div class="pdf-header"><p class="pdf-header-marca">PREVI · Força Ágil · A Floresta</p>' +
      '<h1 class="pdf-header-titulo">' + esc(cfg.titulo) + '</h1>' + (cfg.subtitulo ? '<p class="pdf-header-sub">' + esc(cfg.subtitulo) + '</p>' : '') + '</div>' : '') + html + '</div>';
  }
  function nomeArquivo(cfg, hojeIso) {
    return 'Regras_' + String(cfg.slug || 'motor').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + String(hojeIso || '').slice(0, 10) + '.pdf';
  }
  /* filtra itens <li> de "Como este motor decide" pelos rótulos (só a lógica — tira o que é sobre editar na tela) */
  function itensDeLogica(htmlItens, rotulos) {
    var itens = String(htmlItens || '').match(/<li>[\s\S]*?<\/li>/g) || [];
    return itens.filter(function (li) { return rotulos.some(function (r) { return li.indexOf('<strong>' + r) !== -1; }); }).join('');
  }
  /* gera o PDF com o motor de PDF do site (window.faPdfEmBlocos); cb(erro|null) */
  function gerarPdf(cfg, geradoEm, cb) {
    var P = typeof window !== 'undefined' ? window.faPdfEmBlocos : null;
    if (!P) { cb(new Error('Motor de PDF indisponível.')); return; }
    var at;
    try { at = atomos(cfg); } catch (e) { cb(e); return; }
    P.gerar({
      nomeArquivo: nomeArquivo(cfg, geradoEm),
      planejar: function (medidor) { return P.planejar([at], medidor, function (html) { return documentoPdf(html, false, cfg); }); },
      envolver: function (bloco, indice) { return documentoPdf(bloco, indice === 0, cfg); }
    }, function (erro) { cb(erro || null); });
  }

  var api = Object.freeze({ condicaoHtml: condicaoHtml, camposDe: camposDe, atomos: atomos, documentoPdf: documentoPdf, nomeArquivo: nomeArquivo, itensDeLogica: itensDeLogica, gerarPdf: gerarPdf });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (raiz) raiz.faExportacaoMotores = api;
})(typeof window !== 'undefined' ? window : null);
