/* ============================================================
   certif.js — Gerador de Certificados Força Ágil
   Versão: v1.0  |  Status: APROVADO PARA PRODUÇÃO
   ============================================================

   ARQUITETURA — DUAS CAMADAS
   ─────────────────────────────────────────────────────────────
   CAMADA 1 — TEMPLATE FIXO (cert-template-v2.png, 1448 × 1086)
     Imagem-base imutável. O sistema NÃO redesenha nenhum desses
     elementos — eles vêm diretamente do PNG:
       • fundo preto espacial, estrelas, galáxias, planeta
       • moldura dourada completa e ornamentos
       • logo FORÇA ÁGIL, logo PREVI, símbolo circular
       • "UMA GALÁXIA MAIS ÁGIL"
       • "CERTIFICADO DE PARTICIPAÇÃO"
       • "A Força reconhece que" / "concluiu sua jornada na"
       • ícone de calendário
       • badge/moldura da carga horária
       • "DE IMERSÃO EM AGILIDADE" (texto fixo, não dinâmico)
       • identificação e frase institucional inferior
       • símbolo central inferior
       • "QUE A AGILIDADE ESTEJA COM VOCÊ."
       • demais decorações aprovadas

   CAMADA 2 — CAMPOS DINÂMICOS (desenhados pelo sistema)
     Apenas 6 valores variáveis são sobrepostos ao template:
       1. nomeParticipante  — x:724  y:385  maxW:1041  size:55/28
       2. nomeEvento        — x:724  y:535  maxW:920   size:29/13
       3. identificacaoTurma— x:724  y:581  maxW:680   size:19/12
       4. periodoTurma      — x:598  y:658  maxW:400   size:24/13
       5. cargaHoraria      — x:613  y:757  maxW:160   size:48/24
                              sufixo fixo: "h" (o valor gravado é só o número)
       6. dataEmissao       — x:1055 y:922  maxW:360   size:19/10
                              prefixo fixo: "Emitido em "

   SISTEMA DE COORDENADAS
   ─────────────────────────────────────────────────────────────
     Canvas interno: 1448 × 1086 px (referência absoluta).
     NÃO usar viewport, largura do navegador ou componente pai.
     Responsividade = scale CSS único ao container completo.
     Proporção preservada: 4:3.

   REGRA DE TEXTOS LONGOS — por campo, independente
   ─────────────────────────────────────────────────────────────
     1. usar fonte padrão do campo
     2. medir largura real do texto (ctx.measureText)
     3. se > maxWidth → reduzir 0.5px e repetir
     4. parar ao atingir minSize (nunca abaixo)
     5. NÃO alterar outros campos

   EXPORTAÇÃO
   ─────────────────────────────────────────────────────────────
     PNG: resolução 2× (2896 × 2172), sem margens, proporção 4:3
     PDF: página customizada 864 × 648 pt (4:3), sem margens,
          certificado ocupa 100% da página

   TESTES DE REGRESSÃO — executar ao alterar qualquer campo
   ─────────────────────────────────────────────────────────────
     Curto:   ANA LIMA / SCRUM / Turma 1 / 11 ago 2026 / 8h
     Padrão:  ADRIANO CORREIA DE CAMARGO / FORÇA ÁGIL · JORNADA DE IMERSÃO
              Turma 1 — Agosto 2026 / 11,12,18,19 e 20 ago 2026 / 20h
     Longo:   MARIA EDUARDA ALBUQUERQUE DE OLIVEIRA SANTOS
     Pior:    todos os campos no limite máximo simultâneo

   REGRA FUNDAMENTAL — NÃO ALTERAR SEM VERSIONAMENTO
   ─────────────────────────────────────────────────────────────
     Qualquer mudança em template, coordenadas, fontes ou layout
     deve gerar versão v1.x ou v2.0 e executar checklist completo.
   ============================================================ */

(function () {
  'use strict';

  var TEMPLATE_SRC = 'forca-agil/cert-template-v2.png';

  /* Dimensões do template (lidas do PNG ao carregar) */
  var TW = 1448, TH = 1086;

  /* ── CFG — layout final aprovado ────────────────────────────────────────
     Coordenadas medidas no template real 1448×1086.
     badge: x=473–909, cy=738 | calendário: x=556, cy=665               */
  var CFG = {
    nomeParticipante: {
      x: 724, y: 385, maxWidth: 1041, align: 'center',
      size: 55, minSize: 28, weight: 'italic',
      color: '#FFFFFF', family: 'Georgia,"Times New Roman",serif'
    },
    nomeEvento: {
      x: 724, y: 535, maxWidth: 920, align: 'center',
      size: 29, minSize: 13, weight: 'bold', upper: true, spacing: 3,
      color: '#f5c542', family: '"Courier New",Courier,monospace'
    },
    identificacaoTurma: {
      x: 724, y: 581, maxWidth: 680, align: 'center',
      size: 19, minSize: 12, weight: 'normal',
      color: '#c9a84c', family: 'Georgia,"Times New Roman",serif'
    },
    periodoTurma: {
      x: 598, y: 658, maxWidth: 400, align: 'left',
      size: 24, minSize: 13, weight: 'normal',
      color: '#e8e0d0', family: 'Georgia,"Times New Roman",serif'
    },
    cargaHoraria: {
      x: 613, y: 757, maxWidth: 160, align: 'center',
      size: 48, minSize: 24, weight: 'bold',
      color: '#f5c542', family: '"Courier New",Courier,monospace',
      suffix: 'h'  /* valor vem só como número ("20"); o "h" é do layout */
    },
    /* "Emitido em" removido do template v2; frase completa renderizada como campo dinâmico */
    dataEmissao: {
      x: 1055, y: 922, maxWidth: 360, align: 'left',
      size: 19, minSize: 10, weight: 'italic',
      color: '#c9a030', family: 'Georgia,"Times New Roman",serif',
      prefix: 'Emitido em '
    }
  };

  /* ── Utilitários de texto ────────────────────────────────────────────── */

  function fitFont(ctx, text, cfg) {
    var size = cfg.size;
    ctx.font = cfg.weight + ' ' + size + 'px ' + cfg.family;
    while (ctx.measureText(text).width > cfg.maxWidth && size > cfg.minSize) {
      size -= 0.5;
      ctx.font = cfg.weight + ' ' + size + 'px ' + cfg.family;
    }
    return size;
  }

  function spacedText(ctx, text, x, y, spacing) {
    var chars = text.split('');
    var total = chars.reduce(function (s, c) {
      return s + ctx.measureText(c).width + spacing;
    }, 0) - spacing;
    var cx = x - total / 2;
    chars.forEach(function (c) {
      var cw = ctx.measureText(c).width;
      ctx.fillText(c, cx, y);
      cx += cw + spacing;
    });
  }

  function drawFieldText(ctx, raw, cfg) {
    if (!raw) return;
    var text = (cfg.prefix || '') + (cfg.upper ? String(raw).toUpperCase() : String(raw)) + (cfg.suffix || '');
    fitFont(ctx, text, cfg);
    ctx.fillStyle    = cfg.color;
    ctx.textAlign    = cfg.align;
    ctx.textBaseline = 'middle';
    if (cfg.spacing) {
      spacedText(ctx, text, cfg.x, cfg.y, cfg.spacing);
    } else {
      ctx.fillText(text, cfg.x, cfg.y);
    }
  }

  /* ── Carregamento do template ────────────────────────────────────────── */

  var _templateImg  = null;
  var _loadPromise  = null;

  function loadTemplate() {
    if (_templateImg) return Promise.resolve(_templateImg);
    if (_loadPromise)  return _loadPromise;
    _loadPromise = new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        TW = img.naturalWidth;
        TH = img.naturalHeight;
        _templateImg = img;
        resolve(img);
      };
      img.onerror = function () {
        reject(new Error('Falha ao carregar ' + TEMPLATE_SRC));
      };
      img.src = TEMPLATE_SRC;
    });
    return _loadPromise;
  }

  /* ── Renderização ────────────────────────────────────────────────────── */

  function draw(canvas, data, scale) {
    scale = scale || 1;
    data  = data  || {};

    return loadTemplate().then(function (img) {
      var ctx = canvas.getContext('2d');

      canvas.width  = TW * scale;
      canvas.height = TH * scale;
      ctx.scale(scale, scale);

      ctx.drawImage(img, 0, 0, TW, TH);

      drawFieldText(ctx, data.nomeParticipante,  CFG.nomeParticipante);
      drawFieldText(ctx, data.nomeEvento,         CFG.nomeEvento);
      drawFieldText(ctx, data.identificacaoTurma, CFG.identificacaoTurma);
      drawFieldText(ctx, data.periodoTurma,       CFG.periodoTurma);
      drawFieldText(ctx, data.cargaHoraria,       CFG.cargaHoraria);
      if (data.dataEmissao) {
        drawFieldText(ctx, data.dataEmissao, CFG.dataEmissao);
      }
    });
  }

  /* ── Exportação PNG (2× resolução) ──────────────────────────────────── */

  function download(data, filename) {
    var canvas = document.createElement('canvas');
    return draw(canvas, data, 2).then(function () {
      return new Promise(function (resolve) {
        canvas.toBlob(function (blob) {
          _triggerDownload(blob, (filename || 'certificado') + '.png');
          resolve();
        }, 'image/png');
      });
    });
  }

  /* ── Exportação PDF (A4 landscape, imagem JPEG embutida) ────────────── */

  function downloadPDF(data, filename) {
    var canvas = document.createElement('canvas');
    return draw(canvas, data, 2).then(function () {
      var blob = _canvasToPDFBlob(canvas);
      _triggerDownload(blob, (filename || 'certificado') + '.pdf');
    });
  }

  function _triggerDownload(blob, name) {
    var url = URL.createObjectURL(blob);
    var a   = document.createElement('a');
    a.href     = url;
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 15000);
  }

  /* Gera PDF minimal com a imagem do canvas embutida como JPEG (DCTDecode).
     Página customizada 864 × 648 pt (proporção 4:3 = exata do certificado). */
  function _canvasToPDFBlob(canvas) {
    var jpegUrl = canvas.toDataURL('image/jpeg', 0.93);
    var imgB64  = jpegUrl.split(',')[1];
    var imgU8   = _b64ToU8(imgB64);
    var iw = canvas.width, ih = canvas.height;

    /* página customizada 4:3 em pontos — certificado ocupa 100% da página */
    var PW = 864, PH = 648;
    var sc = Math.min(PW / iw, PH / ih);
    var dw = (iw * sc).toFixed(3);
    var dh = (ih * sc).toFixed(3);
    var ox = ((PW - iw * sc) / 2).toFixed(3);
    var oy = ((PH - ih * sc) / 2).toFixed(3);

    /* content stream: posiciona e renderiza a imagem */
    var cs  = 'q ' + dw + ' 0 0 ' + dh + ' ' + ox + ' ' + oy + ' cm /Im1 Do Q\n';
    var csU8 = _strToU8(cs);

    var hdr = _strToU8('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

    var o1 = _strToU8('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    var o2 = _strToU8('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
    var o3 = _strToU8('3 0 obj\n<< /Type /Page /Parent 2 0 R' +
      ' /MediaBox [0 0 ' + PW.toFixed(2) + ' ' + PH.toFixed(2) + ']' +
      ' /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>\nendobj\n');
    var o4 = _strToU8('4 0 obj\n<< /Length ' + csU8.length + ' >>\nstream\n' +
      cs + 'endstream\nendobj\n');
    var o5h = _strToU8('5 0 obj\n<< /Type /XObject /Subtype /Image' +
      ' /Width ' + iw + ' /Height ' + ih +
      ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode' +
      ' /Length ' + imgU8.length + ' >>\nstream\n');
    var o5f = _strToU8('\nendstream\nendobj\n');

    /* offsets para a xref table */
    var off = [0, 0, 0, 0, 0, 0];
    off[1] = hdr.length;
    off[2] = off[1] + o1.length;
    off[3] = off[2] + o2.length;
    off[4] = off[3] + o3.length;
    off[5] = off[4] + o4.length;
    var xrefOff = off[5] + o5h.length + imgU8.length + o5f.length;

    var xref = _strToU8(
      'xref\n0 6\n' +
      '0000000000 65535 f \n' +
      _pad10(off[1]) + ' 00000 n \n' +
      _pad10(off[2]) + ' 00000 n \n' +
      _pad10(off[3]) + ' 00000 n \n' +
      _pad10(off[4]) + ' 00000 n \n' +
      _pad10(off[5]) + ' 00000 n \n'
    );
    var trailer = _strToU8(
      'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xrefOff + '\n%%EOF\n'
    );

    /* montar buffer final */
    var total = hdr.length + o1.length + o2.length + o3.length + o4.length +
                o5h.length + imgU8.length + o5f.length + xref.length + trailer.length;
    var buf = new Uint8Array(total);
    var pos = 0;
    [hdr, o1, o2, o3, o4, o5h, imgU8, o5f, xref, trailer].forEach(function (part) {
      buf.set(part, pos); pos += part.length;
    });

    return new Blob([buf], { type: 'application/pdf' });
  }

  function _strToU8(s) {
    var u = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xFF;
    return u;
  }

  function _b64ToU8(b64) { return _strToU8(atob(b64)); }

  function _pad10(n) { return ('0000000000' + n).slice(-10); }

  /* ── Utilitário de formatação de data ───────────────────────────────── */

  function fmtDataEmissao(dateStr) {
    var meses = ['janeiro','fevereiro','março','abril','maio','junho',
                 'julho','agosto','setembro','outubro','novembro','dezembro'];
    var d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d)) return dateStr;
    return d.getDate() + ' de ' + meses[d.getMonth()] + ' de ' + d.getFullYear();
  }

  /* ── API pública ─────────────────────────────────────────────────────── */

  window.faCertif = {
    draw:            draw,
    preview:         function (canvasId, data) {
      var canvas = document.getElementById(canvasId || 'certPreviewCanvas');
      if (!canvas) return Promise.resolve();
      return draw(canvas, data, 1);
    },
    download:        download,
    downloadPDF:     downloadPDF,
    fmtDataEmissao:  fmtDataEmissao,
    CFG:             CFG
  };
})();
