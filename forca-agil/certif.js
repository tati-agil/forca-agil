/* certif.js — Geração de certificados Força Ágil via Canvas
   Resolução de referência: 1280 × 960 px (4:3).
   Todos os campos dinâmicos são posicionados por coordenadas fixas (CFG).  */

(function () {
  'use strict';

  var W = 1280, H = 960;

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

  /* ── Utilitários ─────────────────────────────────────────────────────── */

  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = Math.imul(1664525, s) + 1013904223 >>> 0;
      return s / 0x100000000;
    };
  }

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
    /* simula letter-spacing para "center" */
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

  /* ── Background ─────────────────────────────────────────────────────── */

  function drawBackground(ctx) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0,   '#030508');
    g.addColorStop(0.5, '#070b15');
    g.addColorStop(1,   '#0c0905');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawStars(ctx, rand) {
    for (var i = 0; i < 320; i++) {
      var x = rand() * W, y = rand() * H;
      var r = rand() * 1.1 + 0.2;
      var a = rand() * 0.65 + 0.25;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')';
      ctx.fill();
    }
    for (var j = 0; j < 18; j++) {
      var bx = rand() * W, by = rand() * H * 0.65;
      ctx.beginPath();
      ctx.arc(bx, by, 1.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,248,220,0.95)';
      ctx.fill();
    }
  }

  function drawGalaxy(ctx) {
    var cx = W - 148, cy = 82;
    var g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 125);
    g.addColorStop(0,   'rgba(210,170,55,0.55)');
    g.addColorStop(0.3, 'rgba(175,135,38,0.22)');
    g.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, 125, 85, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy, 108, 58, -0.3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(215,175,55,0.13)';
    ctx.lineWidth = 16;
    ctx.stroke();
    ctx.restore();
  }

  function drawNebulaGlows(ctx) {
    /* Topo-centro: star burst dourado */
    var g1 = ctx.createRadialGradient(640, 163, 0, 640, 163, 65);
    g1.addColorStop(0,    'rgba(248,205,80,0.95)');
    g1.addColorStop(0.07, 'rgba(248,205,80,0.55)');
    g1.addColorStop(0.28, 'rgba(248,205,80,0.12)');
    g1.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(575, 98, 130, 130);

    ctx.beginPath();
    ctx.arc(640, 163, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff8e0';
    ctx.fill();

    /* raios da estrela */
    ctx.save();
    ctx.translate(640, 163);
    ctx.strokeStyle = 'rgba(255,238,140,0.55)';
    ctx.lineWidth = 0.9;
    for (var a = 0; a < 4; a++) {
      ctx.save();
      ctx.rotate(a * Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(0, -38);
      ctx.lineTo(0, 38);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    /* Inferior-esquerdo: nebulosa laranja */
    var g2 = ctx.createRadialGradient(185, 785, 15, 185, 785, 210);
    g2.addColorStop(0,   'rgba(195,115,18,0.38)');
    g2.addColorStop(0.4, 'rgba(170,85,10,0.13)');
    g2.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 590, 430, 370);
  }

  /* ── Borda ───────────────────────────────────────────────────────────── */

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawCorner(ctx, x, y, sx, sy) {
    var len = 30;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#d4a017';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx * len, 0); ctx.lineTo(0, 0); ctx.lineTo(0, sy * len);
    ctx.stroke();
    ctx.strokeStyle = '#f0c030';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx * 4, -3.5); ctx.lineTo(sx * 4, 3.5);
    ctx.moveTo(sx * 1.5, 0); ctx.lineTo(sx * 8, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawBorder(ctx) {
    var m = 22;
    ctx.strokeStyle = '#c49010';
    ctx.lineWidth = 2.2;
    roundRect(ctx, m, m, W - m * 2, H - m * 2, 4);
    ctx.stroke();

    var m2 = 31;
    ctx.strokeStyle = '#9a7008';
    ctx.lineWidth = 0.8;
    roundRect(ctx, m2, m2, W - m2 * 2, H - m2 * 2, 3);
    ctx.stroke();

    drawCorner(ctx, m + 9, m + 9,  1,  1);
    drawCorner(ctx, W - m - 9, m + 9, -1,  1);
    drawCorner(ctx, m + 9, H - m - 9,  1, -1);
    drawCorner(ctx, W - m - 9, H - m - 9, -1, -1);
  }

  /* ── Logo ────────────────────────────────────────────────────────────── */

  function drawLogo(ctx) {
    var cx = 78, cy = 68, cr = 28;

    /* círculo */
    var lg = ctx.createRadialGradient(cx - 6, cy - 6, 2, cx, cy, cr);
    lg.addColorStop(0, 'rgba(212,160,23,0.25)');
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fillStyle = lg;
    ctx.fill();
    ctx.strokeStyle = '#d4a017';
    ctx.lineWidth = 2;
    ctx.stroke();

    /* seta/ícone */
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#f5c542';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-10, 8); ctx.lineTo(0, -10); ctx.lineTo(10, 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -1, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#f5c542';
    ctx.fill();
    ctx.restore();

    /* textos */
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = 'bold 26px "Courier New",Courier,monospace';
    ctx.fillStyle = '#FFFFFF';
    var forcaW = ctx.measureText('FORÇA ').width;
    ctx.fillText('FORÇA ', 115, 58);
    ctx.fillStyle = '#f5c542';
    ctx.fillText('ÁGIL', 115 + forcaW, 58);

    ctx.font = '12px "Courier New",Courier,monospace';
    ctx.fillStyle = '#18c2ba';
    ctx.fillText('⬡ PREVI', 117, 80);
  }

  /* ── Texto fixo ──────────────────────────────────────────────────────── */

  function diamond(ctx, x, y, s, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = color;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.restore();
  }

  function burst(ctx, x, y, color) {
    ctx.save();
    ctx.translate(x, y);
    for (var i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 4);
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(0, -20); ctx.lineTo(0, 20);
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function drawFixedText(ctx) {
    ctx.textBaseline = 'middle';

    /* UMA GALÁXIA MAIS ÁGIL */
    ctx.font = '500 11px "Courier New",Courier,monospace';
    ctx.fillStyle = '#c49a10';
    ctx.textAlign = 'center';
    spacedText(ctx, '♦   UMA GALÁXIA MAIS ÁGIL   ♦', W / 2, 180, 1.8);

    /* CERTIFICADO DE PARTICIPAÇÃO */
    ctx.font = 'bold 48px "Courier New",Courier,monospace';
    ctx.fillStyle = '#FFFFFF';
    spacedText(ctx, 'CERTIFICADO DE PARTICIPAÇÃO', W / 2, 228, 3.5);

    /* A Força reconhece que */
    ctx.font = 'italic 20px Georgia,"Times New Roman",serif';
    ctx.fillStyle = '#c0b89a';
    ctx.textAlign = 'center';
    ctx.fillText('A Força reconhece que', W / 2, 315);

    /* linha fina abaixo do nome */
    ctx.beginPath();
    ctx.moveTo(100, 406); ctx.lineTo(W - 100, 406);
    ctx.strokeStyle = 'rgba(196,144,16,0.22)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    burst(ctx, W / 2, 406, '#c4900e');

    /* concluiu sua jornada na */
    ctx.font = 'italic 19px Georgia,"Times New Roman",serif';
    ctx.fillStyle = '#c0b89a';
    ctx.textAlign = 'center';
    ctx.fillText('concluiu sua jornada na', W / 2, 449);

    /* linha decorativa com diamantes */
    var ly = 474;
    ctx.beginPath();
    ctx.moveTo(125, ly); ctx.lineTo(W - 125, ly);
    ctx.strokeStyle = '#9a7010';
    ctx.lineWidth = 1;
    ctx.stroke();
    diamond(ctx, 116, ly, 7, '#d4a017');
    diamond(ctx, W - 116, ly, 7, '#d4a017');
  }

  /* ── Ícone de calendário ─────────────────────────────────────────────── */

  function drawCalendarIcon(ctx, x, y) {
    var s = 20;
    ctx.strokeStyle = '#f5c542';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x - s / 2, y - s / 2, s, s, 2) : ctx.rect(x - s / 2, y - s / 2, s, s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - s / 2, y - s / 2 + 7);
    ctx.lineTo(x + s / 2, y - s / 2 + 7);
    ctx.stroke();
    ctx.fillStyle = '#f5c542';
    [-6, 0, 6].forEach(function (dx) {
      [3, 8].forEach(function (dy) {
        ctx.beginPath();
        ctx.arc(x + dx, y - s / 2 + 7 + dy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }

  /* ── Placa hexagonal ─────────────────────────────────────────────────── */

  function drawHexBadge(ctx, cx, cy, cargaHoraria) {
    var bw = 310, bh = 66, cut = 14;

    /* traços laterais */
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = '#8a6810';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - bw / 2 - 62, cy); ctx.lineTo(cx - bw / 2 - 18, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + bw / 2 + 18, cy); ctx.lineTo(cx + bw / 2 + 62, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    diamond(ctx, cx - bw / 2 - 18, cy, 6, '#d4a017');
    diamond(ctx, cx + bw / 2 + 18, cy, 6, '#d4a017');

    /* fundo do badge */
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
    bg.addColorStop(0, 'rgba(28,20,4,0.92)');
    bg.addColorStop(1, 'rgba(18,12,2,0.95)');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = '#c4900a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    /* texto do badge: "Xh  DE IMERSÃO EM AGILIDADE" */
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

  /* ── Planeta / horizonte ─────────────────────────────────────────────── */

  function drawPlanetHorizon(ctx) {
    var cx = 640, cy = H + 30, rx = 530, ry = 180;

    /* corpo do planeta */
    var pg = ctx.createRadialGradient(cx, cy - 60, 8, cx, cy - 40, ry + 60);
    pg.addColorStop(0,   'rgba(205,135,28,0.88)');
    pg.addColorStop(0.3, 'rgba(165,105,18,0.65)');
    pg.addColorStop(0.7, 'rgba(80,48,8,0.28)');
    pg.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry + 70, 0, Math.PI, 0);
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.restore();

    /* linha de horizonte */
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0);
    ctx.strokeStyle = 'rgba(255,200,55,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    /* brilho atmosférico no horizonte */
    var hg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 220);
    hg.addColorStop(0,   'rgba(255,215,70,0.58)');
    hg.addColorStop(0.28,'rgba(240,170,38,0.22)');
    hg.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, 215, 55, 0, Math.PI, 0);
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.restore();

    /* gradiente de névoa na parte inferior */
    var ag = ctx.createLinearGradient(0, H - 220, 0, H);
    ag.addColorStop(0,   'rgba(0,0,0,0)');
    ag.addColorStop(0.35,'rgba(175,108,18,0.08)');
    ag.addColorStop(0.7, 'rgba(218,148,28,0.22)');
    ag.addColorStop(1,   'rgba(235,172,35,0.32)');
    ctx.fillStyle = ag;
    ctx.fillRect(0, H - 220, W, 220);
  }

  /* ── Seção inferior ──────────────────────────────────────────────────── */

  function drawForceSymbol(ctx, x, y) {
    var s = 23;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#d4a017';
    ctx.lineWidth = 1.8;
    var fill = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
    fill.addColorStop(0,   'rgba(212,160,23,0.22)');
    fill.addColorStop(1,   'rgba(212,160,23,0.05)');
    /* oval vertical */
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.68, s, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.stroke();
    /* oval horizontal */
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.32, 0, 0, Math.PI * 2);
    ctx.stroke();
    /* ovals diagonais */
    [-1, 1].forEach(function (sign) {
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.68, s, sign * Math.PI / 3, 0, Math.PI * 2);
      ctx.stroke();
    });
    /* ponto central */
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#f5c542';
    ctx.fill();
    ctx.restore();
  }

  function miniCircleLogo(ctx, cx, cy) {
    var cr = 22;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.strokeStyle = '#c4900a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#f5c542';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-7, 7); ctx.lineTo(0, -7); ctx.lineTo(7, 7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = '#f5c542';
    ctx.fill();
    ctx.restore();
  }

  function drawBottomSection(ctx) {
    var by = 800;

    /* esquerda */
    var lx = 200;
    miniCircleLogo(ctx, lx, by);
    ctx.font = 'bold 10.5px "Courier New",Courier,monospace';
    ctx.fillStyle = '#c0b88a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('COORDENAÇÃO FORÇA ÁGIL', lx, by + 30);
    ctx.font = '9.5px "Courier New",Courier,monospace';
    ctx.fillStyle = '#8a7538';
    ctx.fillText('PREVI', lx, by + 46);

    /* linha de assinatura */
    ctx.beginPath();
    ctx.moveTo(82, by + 16); ctx.lineTo(318, by + 16);
    ctx.strokeStyle = 'rgba(180,130,20,0.35)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    /* direita */
    var rx = W - 200;
    miniCircleLogo(ctx, rx, by);
    ctx.font = 'bold 10.5px "Courier New",Courier,monospace';
    ctx.fillStyle = '#c0b88a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('A AGILIDADE NOS MOVE.', rx, by + 30);
    ctx.fillText('A FORÇA NOS TRANSFORMA.', rx, by + 44);

    /* centro: símbolo da Força + tagline */
    drawForceSymbol(ctx, W / 2, 856);
    ctx.font = 'italic 13px Georgia,"Times New Roman",serif';
    ctx.fillStyle = '#c4900a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('QUE A AGILIDADE ESTEJA COM VOCÊ.', W / 2, 888);
  }

  /* ── Renderização principal ──────────────────────────────────────────── */

  function draw(canvas, data, scale) {
    scale = scale || 1;
    var ctx = canvas.getContext('2d');
    canvas.width  = W * scale;
    canvas.height = H * scale;
    ctx.scale(scale, scale);

    var rand = rng(42);
    data = data || {};

    drawBackground(ctx);
    drawStars(ctx, rand);
    drawGalaxy(ctx);
    drawNebulaGlows(ctx);
    drawBorder(ctx);
    drawLogo(ctx);
    drawFixedText(ctx);

    /* campos dinâmicos */
    drawFieldText(ctx, data.nomeParticipante,   CFG.nomeParticipante);
    drawFieldText(ctx, data.nomeEvento,          CFG.nomeEvento);
    drawFieldText(ctx, data.identificacaoTurma,  CFG.identificacaoTurma);
    drawCalendarIcon(ctx, 638, 596);
    drawFieldText(ctx, data.periodoTurma,        CFG.periodoTurma);
    drawHexBadge(ctx, W / 2, 648, data.cargaHoraria);

    drawPlanetHorizon(ctx);
    drawBottomSection(ctx);

    if (data.dataEmissao) {
      drawFieldText(ctx, 'Emitido em ' + data.dataEmissao, CFG.dataEmissao);
    }
  }

  /* ── API pública ─────────────────────────────────────────────────────── */

  function preview(canvasId, data) {
    var canvas = document.getElementById(canvasId || 'certPreviewCanvas');
    if (!canvas) return;
    draw(canvas, data, 1);
  }

  function download(data, filename) {
    var canvas = document.createElement('canvas');
    draw(canvas, data, 2); /* 2560 × 1920 para exportação */
    canvas.toBlob(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = (filename || 'certificado') + '.png';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    }, 'image/png');
  }

  function fmtDataEmissao(dateStr) {
    /* "2026-08-15" → "15 de agosto de 2026" */
    var meses = ['janeiro','fevereiro','março','abril','maio','junho',
                 'julho','agosto','setembro','outubro','novembro','dezembro'];
    var d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d)) return dateStr;
    return d.getDate() + ' de ' + meses[d.getMonth()] + ' de ' + d.getFullYear();
  }

  window.faCertif = { draw: draw, preview: preview, download: download, fmtDataEmissao: fmtDataEmissao, CFG: CFG };
})();
