/* certif.js — Geração de certificados Força Ágil via Canvas
   Resolução de referência: 1280 × 960 px (4:3).
   O template visual vem de cert-template.png; apenas os campos dinâmicos
   são desenhados por cima. */

(function () {
  'use strict';

  var W = 1280, H = 960;
  var TEMPLATE_SRC = 'forca-agil/cert-template.png';

  /* ── Coordenadas e estilos dos campos dinâmicos ─────────────────────── */
  var CFG = {
    nomeParticipante: {
      x: 640, y: 370, maxWidth: 920, align: 'center',
      size: 52, minSize: 26, weight: 'italic',
      color: '#FFFFFF', family: 'Georgia,"Times New Roman",serif'
    },
    nomeEvento: {
      x: 640, y: 498, maxWidth: 740, align: 'center',
      size: 28, minSize: 15, weight: 'bold', upper: true, spacing: 3,
      color: '#f5c542', family: '"Courier New",Courier,monospace'
    },
    identificacaoTurma: {
      x: 640, y: 530, maxWidth: 620, align: 'center',
      size: 19, minSize: 12, weight: 'normal',
      color: '#c9a84c', family: 'Georgia,"Times New Roman",serif'
    },
    periodoTurma: {
      x: 665, y: 596, maxWidth: 390, align: 'left',
      size: 17, minSize: 12, weight: 'normal',
      color: '#e8e0d0', family: 'Georgia,"Times New Roman",serif'
    },
    dataEmissao: {
      x: 1212, y: 935, maxWidth: 380, align: 'right',
      size: 13, minSize: 10, weight: 'italic',
      color: '#b8940a', family: 'Georgia,"Times New Roman",serif'
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
    var total = chars.reduce(function (s, c) { return s + ctx.measureText(c).width + spacing; }, 0) - spacing;
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
    var size = fitFont(ctx, text, cfg);
    ctx.font = cfg.weight + ' ' + size + 'px ' + cfg.family;
    ctx.fillStyle = cfg.color;
    ctx.textAlign = cfg.align;
    ctx.textBaseline = 'middle';
    if (cfg.spacing) {
      spacedText(ctx, text, cfg.x, cfg.y, cfg.spacing);
    } else {
      ctx.fillText(text, cfg.x, cfg.y);
    }
  }

  /* ── Placa hexagonal (carga horária) ────────────────────────────────── */

  function drawHexBadge(ctx, cx, cy, cargaHoraria) {
    var bw = 310, bh = 66, cut = 14;

    /* cobre o texto estático do template para redesenhar com o valor real */
    ctx.beginPath();
    ctx.moveTo(cx - bw / 2 + cut, cy - bh / 2);
    ctx.lineTo(cx + bw / 2 - cut, cy - bh / 2);
    ctx.lineTo(cx + bw / 2,        cy - bh / 2 + cut);
    ctx.lineTo(cx + bw / 2,        cy + bh / 2 - cut);
    ctx.lineTo(cx + bw / 2 - cut, cy + bh / 2);
    ctx.lineTo(cx - bw / 2 + cut, cy + bh / 2);
    ctx.lineTo(cx - bw / 2,        cy + bh / 2 - cut);
    ctx.lineTo(cx - bw / 2,        cy - bh / 2 + cut);
    ctx.closePath();
    var bg = ctx.createLinearGradient(cx, cy - bh / 2, cx, cy + bh / 2);
    bg.addColorStop(0, 'rgba(18,12,3,0.97)');
    bg.addColorStop(1, 'rgba(10,7,1,0.98)');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = '#c4900a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    /* texto: "Xh  DE IMERSÃO EM AGILIDADE" */
    var prefix = (cargaHoraria || '?') + 'h';
    var fixed  = '  DE IMERSÃO EM AGILIDADE';
    ctx.font = 'bold 27px "Courier New",Courier,monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    var pw = ctx.measureText(prefix).width;
    var fw = ctx.measureText(fixed).width;
    var startX = cx - (pw + fw) / 2;
    ctx.fillStyle = '#f5c542';
    ctx.fillText(prefix, startX, cy + 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(fixed, startX + pw, cy + 2);
  }

  /* ── Carregamento do template ────────────────────────────────────────── */

  var _templateImg = null;
  var _loadPromise = null;

  function loadTemplate() {
    if (_templateImg) return Promise.resolve(_templateImg);
    if (_loadPromise) return _loadPromise;
    _loadPromise = new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { _templateImg = img; resolve(img); };
      img.onerror = function () { reject(new Error('Falha ao carregar cert-template.png')); };
      img.src = TEMPLATE_SRC;
    });
    return _loadPromise;
  }

  /* ── Renderização principal ──────────────────────────────────────────── */

  function draw(canvas, data, scale) {
    scale = scale || 1;
    data = data || {};

    return loadTemplate().then(function (img) {
      var ctx = canvas.getContext('2d');
      canvas.width  = W * scale;
      canvas.height = H * scale;
      ctx.scale(scale, scale);

      /* background: imagem original do certificado */
      ctx.drawImage(img, 0, 0, W, H);

      /* campos dinâmicos sobrepostos */
      drawFieldText(ctx, data.nomeParticipante,  CFG.nomeParticipante);
      drawFieldText(ctx, data.nomeEvento,         CFG.nomeEvento);
      drawFieldText(ctx, data.identificacaoTurma, CFG.identificacaoTurma);
      drawFieldText(ctx, data.periodoTurma,       CFG.periodoTurma);
      drawHexBadge(ctx, W / 2, 648, data.cargaHoraria);

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
          var a = document.createElement('a');
          a.href = url;
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

  window.faCertif = { draw: draw, preview: preview, download: download, fmtDataEmissao: fmtDataEmissao, CFG: CFG };
})();
