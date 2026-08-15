/* certif.js — Geração de certificados Força Ágil via Canvas
   Sistema de coordenadas = dimensões reais de cert-template.png (1448 × 1086).
   O template é o fundo fixo; apenas os 6 campos dinâmicos são sobrepostos. */

(function () {
  'use strict';

  var TEMPLATE_SRC = 'forca-agil/cert-template.png';

  /* Dimensões do template (lidas do PNG ao carregar) */
  var TW = 1448, TH = 1086;

  /* ── Campos dinâmicos — coordenadas no espaço 1448 × 1086 ─────────────
     Derivadas proporcionalmente das coordenadas de referência (1280 × 960)
     aplicando fator uniforme 1448/1280 ≈ 1.131.
     Ajuste fino de posição será feito na etapa seguinte.              */
  var CFG = {
    nomeParticipante: {
      x: 724, y: 419, maxWidth: 1041, align: 'center',
      size: 59, minSize: 30, weight: 'italic',
      color: '#FFFFFF', family: 'Georgia,"Times New Roman",serif'
    },
    nomeEvento: {
      x: 724, y: 563, maxWidth: 837, align: 'center',
      size: 32, minSize: 17, weight: 'bold', upper: true, spacing: 3.4,
      color: '#f5c542', family: '"Courier New",Courier,monospace'
    },
    identificacaoTurma: {
      x: 724, y: 600, maxWidth: 701, align: 'center',
      size: 22, minSize: 14, weight: 'normal',
      color: '#c9a84c', family: 'Georgia,"Times New Roman",serif'
    },
    periodoTurma: {
      x: 752, y: 674, maxWidth: 441, align: 'left',
      size: 19, minSize: 14, weight: 'normal',
      color: '#e8e0d0', family: 'Georgia,"Times New Roman",serif'
    },
    dataEmissao: {
      x: 1371, y: 1057, maxWidth: 430, align: 'right',
      size: 15, minSize: 11, weight: 'italic',
      color: '#b8940a', family: 'Georgia,"Times New Roman",serif'
    }
  };

  /* Badge hexagonal — bounds medidos na imagem 1448 × 1086 */
  var BADGE = {
    cx:  724,   /* centro horizontal                    */
    cy:  738,   /* centro vertical                      */
    bw:  370,   /* largura total da caixa               */
    bh:  110,   /* altura total da caixa                */
    cut:  18    /* tamanho do corte nos cantos          */
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
    var text = cfg.upper ? String(raw).toUpperCase() : String(raw);
    fitFont(ctx, text, cfg);
    ctx.fillStyle  = cfg.color;
    ctx.textAlign  = cfg.align;
    ctx.textBaseline = 'middle';
    if (cfg.spacing) {
      spacedText(ctx, text, cfg.x, cfg.y, cfg.spacing);
    } else {
      ctx.fillText(text, cfg.x, cfg.y);
    }
  }

  /* ── Badge hexagonal ─────────────────────────────────────────────────── */

  function hexPath(ctx, b) {
    var x = b.cx, y = b.cy, hw = b.bw / 2, hh = b.bh / 2, c = b.cut;
    ctx.beginPath();
    ctx.moveTo(x - hw + c, y - hh);
    ctx.lineTo(x + hw - c, y - hh);
    ctx.lineTo(x + hw,     y - hh + c);
    ctx.lineTo(x + hw,     y + hh - c);
    ctx.lineTo(x + hw - c, y + hh);
    ctx.lineTo(x - hw + c, y + hh);
    ctx.lineTo(x - hw,     y + hh - c);
    ctx.lineTo(x - hw,     y - hh + c);
    ctx.closePath();
  }

  function drawHexBadge(ctx, b, cargaHoraria) {
    /* 1. cobre o texto estático do template com fundo opaco */
    hexPath(ctx, b);
    var bg = ctx.createLinearGradient(b.cx, b.cy - b.bh / 2, b.cx, b.cy + b.bh / 2);
    bg.addColorStop(0, 'rgba(14,9,2,0.98)');
    bg.addColorStop(1, 'rgba(8,5,1,0.99)');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = '#c4900a';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    /* 2. "Xh" em dourado + " DE IMERSÃO EM AGILIDADE" em branco */
    var prefix = (cargaHoraria || '?') + 'h';
    var fixed  = '  DE IMERSÃO EM AGILIDADE';
    ctx.font = 'bold 31px "Courier New",Courier,monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    var pw = ctx.measureText(prefix).width;
    var fw = ctx.measureText(fixed).width;
    var sx = b.cx - (pw + fw) / 2;
    ctx.fillStyle = '#f5c542';
    ctx.fillText(prefix, sx, b.cy + 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(fixed, sx + pw, b.cy + 2);
  }

  /* ── Carregamento do template ────────────────────────────────────────── */

  var _templateImg  = null;
  var _loadPromise  = null;

  function loadTemplate() {
    if (_templateImg) return Promise.resolve(_templateImg);
    if (_loadPromise) return _loadPromise;
    _loadPromise = new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        /* dimensões reais do PNG — usadas como sistema de coordenadas */
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

      /* canvas tem EXATAMENTE o tamanho do template (× escala de exportação) */
      canvas.width  = TW * scale;
      canvas.height = TH * scale;
      ctx.scale(scale, scale);

      /* fundo: template original — imutável */
      ctx.drawImage(img, 0, 0, TW, TH);

      /* campos dinâmicos sobrepostos */
      drawFieldText(ctx, data.nomeParticipante,  CFG.nomeParticipante);
      drawFieldText(ctx, data.nomeEvento,         CFG.nomeEvento);
      drawFieldText(ctx, data.identificacaoTurma, CFG.identificacaoTurma);
      drawFieldText(ctx, data.periodoTurma,       CFG.periodoTurma);
      drawHexBadge(ctx, BADGE, data.cargaHoraria);
      if (data.dataEmissao) {
        drawFieldText(ctx, data.dataEmissao, CFG.dataEmissao);
      }
    });
  }

  /* ── API pública ─────────────────────────────────────────────────────── */

  function preview(canvasId, data) {
    var canvas = document.getElementById(canvasId || 'certPreviewCanvas');
    if (!canvas) return Promise.resolve();
    return draw(canvas, data, 1);
  }

  function download(data, filename) {
    var canvas = document.createElement('canvas');
    return draw(canvas, data, 2).then(function () {
      return new Promise(function (resolve) {
        canvas.toBlob(function (blob) {
          var url = URL.createObjectURL(blob);
          var a   = document.createElement('a');
          a.href     = url;
          a.download = (filename || 'certificado') + '.png';
          a.click();
          setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
          resolve();
        }, 'image/png');
      });
    });
  }

  function fmtDataEmissao(dateStr) {
    var meses = ['janeiro','fevereiro','março','abril','maio','junho',
                 'julho','agosto','setembro','outubro','novembro','dezembro'];
    var d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d)) return dateStr;
    return d.getDate() + ' de ' + meses[d.getMonth()] + ' de ' + d.getFullYear();
  }

  window.faCertif = {
    draw: draw, preview: preview, download: download,
    fmtDataEmissao: fmtDataEmissao,
    CFG: CFG, BADGE: BADGE
  };
})();
