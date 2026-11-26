/* Guardiões da Força: Missão Porto Lume — apresentação do Episódio IV (treinamento do tipo apresentação, só admins; ver game-data.js).
   Igual à versão de oficina de 08/11 (CONSOLIDADO_FINAL_v3); só o script, antes dentro do HTML, veio para cá por causa da CSP.
   Aberta direto pelo endereço: volta para o Treinamento, onde o acesso é conferido. */
if (window.top === window.self) location.replace('/index.html#treinamento');
else
/* Um botão: AVANÇAR. Nada avança sozinho. Áudio só começa depois de um comando. */
(function () {
  var M = window.MISSAO, D = window.FALAS, PL = window.PLANETA, cv = document.getElementById('c'), g = cv.getContext('2d'), W = 1920, H = 1080, C = M.CENAS;
  var registroFalhas = [], geracao = 0, aguardando = false, passo = 0, tPasso = -1, ultimoCmd = -1e9, ultimoFn = null, atual = null, tK = null, semAnim = true, fimVoz = -1000, sons = {}, ouvidas = {}, i = 0, leg = null, audio = null, fila = [], tocando = false, falando = false, ini = 0, relogio = null, erroAudio = 0, comandos = 0;
  var est = []; var se = 11, rnd = function () { se = (se * 16807) % 2147483647; return se / 2147483647; }; for (var k = 0; k < 260; k++) est.push({ x: rnd() * W, y: rnd() * H, r: rnd() * 1.6 + 0.3, f: rnd() * 6 });
  var h = parseInt(location.hash.slice(1), 10); if (h >= 0 && h < C.length) i = h;
  var LUZES = []; (function () { var q = 77, rn = function () { q = (q * 16807) % 2147483647; return q / 2147483647; }; for (var n = 0; n < 90; n++) { var an = rn() * 6.283, d = Math.sqrt(rn()) * 0.9; LUZES.push({ x: Math.cos(an) * d, y: Math.sin(an) * d, f: rn() * 6, t: 3 + rn() * 4.5, apaga: n % 8 === 0 ? 9999 : 13 + rn() * 13 }); } })();
  var tx = function (s, x, y, o) { PL.tx(g, s, x, y, o); };
  function quebra(s, l, f) { g.save(); g.font = f; var p = String(s).split(' '), o = [], a = ''; p.forEach(function (w) { var n = a ? a + ' ' + w : w; if (g.measureText(n).width > l && a) { o.push(a); a = w; } else a = n; }); if (a) o.push(a); g.restore(); return o; }
  function bloco(s, x, y, l, f, lh, op) { var q = quebra(s, l, f); q.forEach(function (ln, n) { tx(ln, x, y + n * lh, Object.assign({ font: f }, op || {})); }); return q.length; }
  function fundo(t, d) { g.fillStyle = '#03060f'; g.fillRect(0, 0, W, H); var n = g.createRadialGradient(W * 0.3, H * 0.3, 0, W * 0.3, H * 0.3, 1000); n.addColorStop(0, 'rgba(27,58,124,.35)'); n.addColorStop(1, 'rgba(3,6,15,0)'); g.fillStyle = n; g.fillRect(0, 0, W, H); est.forEach(function (e) { g.globalAlpha = (0.3 + 0.6 * Math.abs(Math.sin(t * 0.6 + e.f))) * (d || 1); g.fillStyle = '#eef3fb'; g.beginPath(); g.arc(e.x, e.y, e.r, 0, 6.283); g.fill(); }); g.globalAlpha = 1; }
  /* K-99: convencido, flutuando, com prancheta e carimbo. Só desenho, sem imagem externa. */
  function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function K99(x, y, u, t, falar, carimbo, espera) {
    /* u = altura aproximada em pixels */
    var e = u / 100, flut = Math.sin(t * 1.7) * 3.2, inc = Math.sin(t * 0.9) * 0.035 + (falar ? Math.sin(t * 9) * 0.012 : 0);
    g.save(); g.translate(x, y + flut * e); g.rotate(inc); g.scale(e, e); g.lineJoin = 'round';
    /* propulsor */
    var ch = 12 + Math.sin(t * 24) * 3 + Math.sin(t * 11) * 2; var fg = g.createLinearGradient(0, 40, 0, 44 + ch * 1.6); fg.addColorStop(0, 'rgba(159,243,255,.95)'); fg.addColorStop(1, 'rgba(79,224,245,0)'); g.fillStyle = fg; g.beginPath(); g.moveTo(-10, 40); g.quadraticCurveTo(0, 44 + ch * 2, 10, 40); g.closePath(); g.fill();
    g.save(); g.translate(0, 64); g.scale(1, 0.28); var chao = g.createRadialGradient(0, 0, 1, 0, 0, 28); chao.addColorStop(0, 'rgba(79,224,245,.3)'); chao.addColorStop(1, 'rgba(79,224,245,0)'); g.fillStyle = chao; g.beginPath(); g.arc(0, 0, 28, 0, 6.283); g.fill(); g.restore();
    /* braço de trás: prancheta */
    g.save(); g.translate(-24, 8); g.rotate(-0.25 + Math.sin(t * 1.3) * 0.06); g.strokeStyle = '#7f92b3'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-14, 11); g.stroke(); g.translate(-23, 4); g.rotate(-0.1); g.fillStyle = '#8a6a3f'; rr(-11, -13, 22, 30, 2); g.fill(); g.fillStyle = '#f4f7fc'; rr(-9, -9, 18, 24, 1); g.fill(); g.fillStyle = '#c1c9d8'; g.fillRect(-7, -5, 14, 1.6); g.fillRect(-7, -1, 14, 1.6); g.fillRect(-7, 3, 9, 1.6); if (!espera) { g.strokeStyle = '#2bb673'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(3, 8); g.lineTo(5, 11); g.lineTo(9, 5); g.stroke(); } g.fillStyle = '#5a6a8a'; g.fillRect(-4, -15, 8, 4); g.restore();
    /* corpo */
    var cg = g.createLinearGradient(-22, 0, 22, 0); cg.addColorStop(0, '#6f83a8'); cg.addColorStop(0.45, '#e6edf8'); cg.addColorStop(1, '#7c90b4'); g.fillStyle = cg; rr(-22, -4, 44, 44, 16); g.fill(); g.strokeStyle = '#27406f'; g.lineWidth = 1.6; g.stroke();
    /* peito: placar */
    g.fillStyle = '#0b1630'; rr(-14, 4, 28, 17, 3); g.fill(); g.strokeStyle = '#4fe0f5'; g.lineWidth = 0.8; g.stroke(); g.fillStyle = espera ? '#5b6f93' : '#62e28a'; g.font = '700 10px "Space Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(espera ? '– – –' : '100%', 0, 13);
    g.fillStyle = '#142a5c'; rr(-13, 26, 26, 9, 2); g.fill(); g.fillStyle = '#f5c518'; g.font = '700 6.8px "Space Mono", monospace'; g.fillText('K-99', 0, 31);
    /* braço da frente: carimbo levantado */
    var ba = carimbo ? -1.2 + Math.abs(Math.sin(t * 3.4)) * 1.1 : -0.75 + Math.sin(t * 1.9) * 0.12; g.save(); g.translate(24, 8); g.rotate(ba); g.strokeStyle = '#7f92b3'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.lineTo(15, 0); g.stroke(); g.translate(19, 0); g.fillStyle = '#c0392b'; rr(-3.5, -7, 7, 10, 1.5); g.fill(); g.fillStyle = '#7b1f15'; g.fillRect(-5, 3, 10, 3); g.restore();
    /* pescoço e cabeça */
    g.fillStyle = '#5b6f93'; g.fillRect(-7, -9, 14, 7);
    var hg = g.createLinearGradient(0, -48, 0, -6); hg.addColorStop(0, '#f4f7fc'); hg.addColorStop(1, '#94a7c8'); g.fillStyle = hg; rr(-30, -50, 60, 43, 15); g.fill(); g.strokeStyle = '#27406f'; g.lineWidth = 1.8; g.stroke();
    g.fillStyle = '#5b6f93'; rr(-35, -36, 6, 14, 2); g.fill(); rr(29, -36, 6, 14, 2); g.fill();
    /* antena */
    var pi = Math.sin(t * 5) > 0.2; g.strokeStyle = '#5b6f93'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(8, -50); g.quadraticCurveTo(10 + Math.sin(t * 2) * 2, -60, 14 + Math.sin(t * 2) * 3, -65); g.stroke(); var ax = 14 + Math.sin(t * 2) * 3; if (pi) { g.shadowColor = '#ff6b5e'; g.shadowBlur = 8; } g.fillStyle = pi ? '#ff6b5e' : '#a33'; g.beginPath(); g.arc(ax, -67, 3.4, 0, 6.283); g.fill(); g.shadowBlur = 0;
    /* visor */
    g.fillStyle = '#06101f'; rr(-25, -44, 50, 30, 10); g.fill(); g.strokeStyle = 'rgba(79,224,245,.5)'; g.lineWidth = 1; g.stroke();
    /* olhos, com piscada; o esquerdo meio fechado: convencido */
    var pisc = (t % 4.3) < 0.13 ? 0.08 : 1, olhar = Math.sin(t * 0.7) * 1.6; g.shadowColor = '#4fe0f5'; g.shadowBlur = 7; g.fillStyle = '#7af0e8';
    g.save(); g.translate(-11 + olhar, -32); g.scale(1, pisc * 0.72); g.beginPath(); g.arc(0, 0, 6.2, 0, 6.283); g.fill(); g.restore();
    g.save(); g.translate(11 + olhar, -32); g.scale(1, pisc); g.beginPath(); g.arc(0, 0, 6.2, 0, 6.283); g.fill(); g.restore(); g.shadowBlur = 0;
    /* pálpebra e sobrancelha erguida */
    g.strokeStyle = '#7af0e8'; g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(-18, -38.5); g.lineTo(-5, -37); g.stroke(); g.beginPath(); g.moveTo(5, -42); g.quadraticCurveTo(11, -45.5 + Math.sin(t * 1.5), 18, -42); g.stroke();
    /* boca: sorriso de lado; quando fala, barras */
    g.strokeStyle = '#62e28a'; g.fillStyle = '#62e28a';
    if (falar) { for (var b = 0; b < 7; b++) { var alt = 1.2 + Math.abs(Math.sin(t * 16 + b * 1.5)) * 5; g.fillRect(-11 + b * 3.3, -19.5 - alt / 2, 2.2, alt); } }
    else { g.lineWidth = 2; g.beginPath(); g.moveTo(-9, -20); g.quadraticCurveTo(3, -16, 12, -22); g.stroke(); }
    g.restore();
  }
  function balao(x, y, w, txt) { var f = '600 38px Oswald, Arial', q = quebra(txt, w - 50, f), h = q.length * 48 + 36; g.fillStyle = 'rgba(244,247,252,.97)'; rr(x, y, w, h, 20); g.fill(); g.beginPath(); g.moveTo(x + 44, y + h - 2); g.lineTo(x + 18, y + h + 30); g.lineTo(x + 90, y + h - 2); g.closePath(); g.fill(); q.forEach(function (l, n) { tx(l, x + w / 2, y + 38 + n * 48, { font: f, cor: '#0b1630', sombra: false }); }); }
  var cl = function (x) { return Math.max(0, Math.min(1, x)); }, sai = function (x) { x = cl(x); return 1 - (1 - x) * (1 - x) * (1 - x); };
  /* voz terminou há quantos segundos; enquanto fala, negativo */
  var dVoz = function (t) { return fimVoz === null ? -1 : t - fimVoz; };
  function somUma(k, n) { if (sons[k] || semAnim) return; sons[k] = 1; sfx(n); }
  function entrada(t0, dv, fn) { var p = semAnim ? 1 : sai((dv - t0) / 0.45); if (p <= 0) return; g.save(); g.globalAlpha = p; g.translate(0, (1 - p) * 70); fn(); g.restore(); }
  var T = {
    titulo: function (c, t) { fundo(t); tx(c.a, W / 2, 440, { font: '400 130px Anton, Impact', cor: '#f5c518' }); tx(c.b, W / 2, 610, { font: '600 66px Oswald, Arial', cor: '#7af0e8' }); },
    crise: function (c, t) {
      fundo(t); var cx = W / 2, cy = 490, r = 340, dt = t - ini;
      /* halo: enfraquece enquanto as luzes caem */
      var q = Math.max(0, Math.min(1, 1 - (dt - 12) / 14)), a = g.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.35); a.addColorStop(0, 'rgba(79,224,245,' + (0.08 + 0.3 * q) + ')'); a.addColorStop(1, 'rgba(79,224,245,0)'); g.fillStyle = a; g.fillRect(0, 0, W, H);
      PL.desenhar(g, cx, cy, r, { n: 0, estrategia: null }, {}, t, { semTitulo: 1 });
      /* as cidades apagam uma a uma, piscando antes de cair */
      LUZES.forEach(function (l) { var x = cx + l.x * r, y = cy + l.y * r, falta = l.apaga - dt, v = falta > 2 ? 0.75 + 0.25 * Math.sin(t * 2 + l.f) : falta > 0 ? (Math.sin(t * (14 + l.f)) > 0 ? 1 : 0.15) : 0.07; g.globalAlpha = v; g.fillStyle = falta > 2 ? '#f5c518' : falta > 0 ? '#ffa63d' : '#5b6a86'; if (v > 0.5) { g.shadowColor = g.fillStyle; g.shadowBlur = 16; } g.beginPath(); g.arc(x, y, l.t, 0, 6.283); g.fill(); g.shadowBlur = 0; }); g.globalAlpha = 1;
      /* onda de falha cruzando o planeta */
      var pr = (dt % 6) / 6; if (dt > 12) { g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 6.283); g.clip(); g.strokeStyle = 'rgba(255,59,48,' + (0.55 * (1 - pr)) + ')'; g.lineWidth = 7; g.beginPath(); g.arc(cx, cy, pr * r * 1.05, 0, 6.283); g.stroke(); g.restore(); }
      /* Porto Lume */
      var hx = cx + 0.18 * r, hy = cy - 0.55 * r, pu = 0.5 + 0.5 * Math.sin(t * 5); g.strokeStyle = 'rgba(255,59,48,' + (0.3 + 0.7 * pu) + ')'; g.lineWidth = 4; g.beginPath(); g.arc(hx, hy, 26 + pu * 16, 0, 6.283); g.stroke(); g.fillStyle = '#ff3b30'; g.fillRect(hx - 18, hy - 5, 36, 10); g.fillRect(hx - 5, hy - 18, 10, 36); tx('PORTO LUME', hx, hy - 58, { font: '600 34px Oswald, Arial', cor: '#eaf1ff' });
      tx(c.a, W / 2, 62, { font: '400 76px Anton, Impact', cor: '#f5c518' }); if (dt > 12 && Math.sin(t * 4) > -0.4) tx('ENERGIA EM QUEDA', W / 2, 138, { font: '600 42px Oswald, Arial', cor: '#ff3b30' });
      var ace = LUZES.filter(function (l) { return l.apaga > dt; }).length; tx('REGIÕES COM LUZ: ' + Math.round(ace / LUZES.length * 100) + '%', 1640, 500, { font: '600 34px Oswald, Arial', cor: ace > 12 ? '#b8c6e4' : '#ff3b30' });
    },
    k99: function (c, t) { fundo(t, 0.7); if (c.id === 'k99' && !semAnim && tocando && !ouvidas.F15) { tx('O CONSELHO APRESENTA', W / 2, 400, { font: '400 92px Anton, Impact', cor: '#f5c518' }); var pts = Math.floor(t * 2) % 4; tx('.'.repeat(pts) || ' ', W / 2, 520, { font: '400 92px Anton, Impact', cor: '#f5c518' }); tK = null; return; } if (c.id === 'k99' && !semAnim && tK === null) tK = t; var ent = c.id === 'k99' && !semAnim ? sai((t - tK) / 1.2) : 1, temP = (c.painel || []).some(function (l) { return l[2] === undefined || !tocando || (typeof l[2] === 'number' ? t - ini >= l[2] : ouvidas[l[2]]); }), alvo = temP ? 540 : W / 2, x = alvo + Math.sin(t * 0.8) * 34 - (1 - ent) * 1400, y = 520 - (1 - ent) * 260; K99(x, y, 620, t + ini, falando, c.id === 'cafe_fim' || c.id === 'balanco'); (c.painel || []).forEach(function (l, n) { if (l[2] !== undefined && tocando && !(typeof l[2] === 'number' ? t - ini >= l[2] : ouvidas[l[2]])) return; var a = c.painel.length, hh = a > 2 ? 170 : 200, yy = 170 + n * (hh + 22) + hh / 2; var ruim = l[3] ? l[3] === 'ruim' : n === a - 1; g.fillStyle = 'rgba(12,21,40,.92)'; g.strokeStyle = ruim ? '#ff3b30' : '#7ee2a8'; g.lineWidth = 3; rr(1080, yy - hh / 2, 700, hh, 14); g.fill(); g.stroke(); tx(l[0], 1430, yy - hh * 0.25, { font: '700 28px Space Mono, monospace', cor: '#b8c6e4' }); tx(l[1], 1430, yy + hh * 0.13, { font: '400 72px Anton, Impact', cor: ruim ? '#ff3b30' : '#7ee2a8' }); }); },
    cafe: function (c, t) { fundo(t, 0.5); var ap = tPasso < 0 ? 1 : sai((t - tPasso) / 0.3);
      if (passo === 0) bloco('K-99 ACABA DE RECEBER UMA NOVA ORDEM.', 1260, 330, 1000, '400 92px Anton, Impact', 112, { cor: '#f5c518' });
      else { g.save(); if (passo === 1) g.globalAlpha = ap; tx('A ORDEM', 1260, 130, { font: '400 72px Anton, Impact', cor: '#f5c518' }); bloco('“' + M.ORDEM_CAFE + '”', 1260, 280, 1060, '600 84px Oswald, Arial', 110, { cor: '#eaf1ff' }); g.restore(); }
      K99(400, 600, 620, t, false, false, passo < 2);
      if (passo === 2) { if (ap < 1) { var bri = g.createRadialGradient(400, 680, 0, 400, 680, 230); bri.addColorStop(0, 'rgba(126,226,168,' + (0.55 * (1 - ap)) + ')'); bri.addColorStop(1, 'rgba(126,226,168,0)'); g.fillStyle = bri; g.fillRect(170, 450, 460, 460); } g.save(); g.globalAlpha = ap; balao(800, 800, 760, 'Eu não interpreto. Eu cumpro.'); g.restore(); } },
    porto: function (c, t) {
      fundo(t, 0.6); var dt = semAnim ? 99 : t - ini; if (dt < 1.2 && !semAnim && Math.random() < 0.3) { g.fillStyle = 'rgba(255,59,48,.18)'; g.fillRect(0, 0, W, H); }
      tx('EMERGÊNCIA EM PORTO LUME', W / 2, 90, { font: '400 84px Anton, Impact', cor: Math.sin(t * 4) > -0.4 ? '#ff3b30' : '#ffa39b' });
      [['HOSPITAL PRECISA DE', '300', 'CAIXAS', 3.2], ['TEMOS APENAS', '100', 'CAIXAS', 7.2], ['TAMBÉM PEDEM AJUDA', 'ABRIGO', 'E ESTAÇÕES', 10]].forEach(function (l, n) {
        entrada(l[3], dt, function () { var x = 110 + n * 580; if (dt >= l[3]) somUma('p' + n, 'confirma'); g.fillStyle = 'rgba(12,21,40,.92)'; g.strokeStyle = '#8fa0c4'; g.lineWidth = 3; rr(x, 230, 540, 480, 14); g.fill(); rr(x, 230, 540, 480, 14); g.stroke(); tx(l[0], x + 270, 300, { font: '600 40px Oswald, Arial', cor: '#b8c6e4' }); if (n === 2) { tx(l[1], x + 270, 441, { font: '400 88px Anton, Impact', cor: '#eaf1ff' }); tx('E', x + 270, 522, { font: '600 40px Oswald, Arial', cor: '#b8c6e4' }); tx(l[2].replace(/^E /, ''), x + 270, 603, { font: '400 88px Anton, Impact', cor: '#eaf1ff' }); } else { tx(l[1], x + 270, 460, { font: '400 170px Anton, Impact', cor: n === 0 ? '#ff3b30' : '#f6be7b' }); tx(l[2], x + 270, 620, { font: '600 46px Oswald, Arial', cor: '#b8c6e4' }); } });
      });
    },
    planos: function (c, t) {
      fundo(t, 0.45); var dt = semAnim ? 99 : t - ini; tx('CADA MESA ESCOLHE UM PLANO', W / 2, 80, { font: '400 72px Anton, Impact', cor: '#f5c518' });
      var xs = [130, 760, 1140, 1520], y0 = 200, lh = 150, ls = [['', 'PLANO A', 'PLANO B', 'PLANO C'], ['Hospital', 60, 20, 20], ['Abrigo', 20, 60, 20], ['Estações', 20, 20, 60], ['Total', 100, 100, 100]];
      g.fillStyle = 'rgba(12,21,40,.9)'; g.strokeStyle = '#8fa0c4'; g.lineWidth = 3; rr(90, 170, 1740, 780, 14); g.fill(); g.fillStyle = '#16306a'; rr(90, 170, 1740, 140, 14); g.fill(); g.fillRect(90, 170 + 14, 1740, 140 - 14); rr(90, 170, 1740, 780, 14); g.stroke();
      var EXPL = { Hospital: 'Atende pacientes em situação crítica', Abrigo: 'Acolhe as famílias afetadas', 'Estações': 'Sustentam a comunicação e parte da logística das entregas' };
      ls.forEach(function (lin, n) { var y = y0 + n * lh + 40, ex = EXPL[lin[0]]; if (lin[0]) tx(String(lin[0]), xs[0], ex ? y - 26 : y, { al: 'left', font: '600 52px Oswald, Arial', cor: n === 4 ? '#8fa0c4' : '#b8c6e4' }); if (ex) quebra(ex, 520, '600 28px Oswald, Arial').forEach(function (l, q) { tx(l, xs[0], y + 26 + q * 32, { al: 'left', font: '600 28px Oswald, Arial', cor: '#8fa0c4' }); }); if (n < 4) { g.strokeStyle = 'rgba(120,160,220,.16)'; g.lineWidth = 2; g.beginPath(); g.moveTo(110, y + lh / 2); g.lineTo(1810, y + lh / 2); g.stroke(); } });
      [0, 1, 2].forEach(function (j) { var t0 = 0.5 + j * 1.1; entrada(t0, dt, function () { if (dt >= t0) somUma('pl' + j, 'confirma'); ls.forEach(function (lin, n) { var y = y0 + n * lh + 40, v = lin[j + 1], mx = n > 0 && n < 4 && v === 60; tx(String(v), xs[j + 1], y, { font: n === 0 ? '600 52px Oswald, Arial' : mx ? '400 104px Anton, Impact' : n === 4 ? '600 60px Oswald, Arial' : '600 70px Oswald, Arial', cor: mx ? '#f5c518' : n === 0 ? '#eaf1ff' : n === 4 ? '#b8c6e4' : '#eaf1ff' }); }); }); });
    },
    cartoes: function (c, t) {
      var dv = dVoz(t), mostrar = semAnim || dv >= 0;
      if (!mostrar) {
        if (c.urgente && c.etiquetas && c.etiquetas[atual]) { fundo(t, 0.6); tx(c.aviso, W / 2, 46, { font: '600 38px Oswald, Arial', cor: '#7af0e8' }); tx(c.etiquetas[atual], W / 2, 118, { font: '400 66px Anton, Impact', cor: '#f5c518' }); K99(W / 2 + Math.sin(t * 2.2) * 26, 515, 440, t, falando, atual === 'P_R_AUT'); }
        else if (c.urgente) { /* alerta em tela cheia, sem mostrar nada das consequências */
          var dt = t - ini, tr = dt < 2.2 ? (2.2 - dt) * 7 : 0; g.save(); g.translate((Math.random() - 0.5) * tr, (Math.random() - 0.5) * tr); fundo(t, 0.5); var pul = 0.5 + 0.5 * Math.sin(t * 6); g.fillStyle = 'rgba(255,59,48,' + (0.1 + 0.16 * pul) + ')'; g.fillRect(-40, -40, W + 80, H + 80); g.strokeStyle = 'rgba(255,59,48,' + (0.5 + 0.5 * pul) + ')'; g.lineWidth = 18; g.strokeRect(24, 24, W - 48, H - 48);
          tx('ATENÇÃO', W / 2, 240, { font: '600 68px Oswald, Arial', cor: '#b8c6e4' }); var es = sai(dt / 0.9); tx('MAIS 200 FAMÍLIAS', W / 2, 440, { font: '400 ' + Math.round(90 + 60 * es) + 'px Anton, Impact', cor: '#ff3b30' }); tx('CHEGARAM AO ABRIGO', W / 2, 620, { font: '400 ' + Math.round(60 + 30 * es) + 'px Anton, Impact', cor: '#eaf1ff' }); g.restore();
        } else { /* K-99 trabalhando, sem revelar o resultado */
          fundo(t, 0.6); K99(W / 2 + Math.sin(t * 2.2) * 40, 520, 620, t, falando, true); var pt = Math.floor(t * 2) % 4; tx('PROCESSANDO' + '.'.repeat(pt), 330, 300, { al: 'left', font: '700 40px Space Mono, monospace', cor: '#7af0e8' }); if (0) tx('', 0, 0, { font: '700 54px Space Mono, monospace', cor: '#7af0e8' });
        }
        return;
      }
      fundo(t, 0.5); var cw = c.k99 ? 420 : 580, cp = c.k99 ? 440 : 600, cx0 = c.k99 ? 40 : 70, cf = c.k99 ? '600 44px Oswald, Arial' : '600 52px Oswald, Arial', clh = c.k99 ? 60 : 70; tx(c.titulo, c.k99 ? 680 : W / 2, 80, { font: '400 76px Anton, Impact', cor: c.urgente ? (Math.sin(t * 4) > -0.4 ? '#ff3b30' : '#ffa39b') : '#f5c518' }); if (c.urgente) tx('PROCURE SEU PLANO E SUA ESCOLHA', W / 2, 150, { font: '600 38px Oswald, Arial', cor: '#7af0e8' }); if (c.k99) { K99(1660, 560, 520, t, false, true); balao(1440, 110, 440, 'Eficiência impecável.'); /* abaixo dos botões VOLTAR e AVANÇAR */ }
      if (c.urgente) entrada(3.3, dv, function () { g.fillStyle = 'rgba(12,21,40,.96)'; g.strokeStyle = '#8fa0c4'; g.lineWidth = 3; rr(70, 880, 1780, 110, 14); g.fill(); rr(70, 880, 1780, 110, 14); g.stroke(); var sa = M.SEM_AUTONOMIA, ix = sa.indexOf(':'); tx(sa.slice(0, ix), W / 2, 910, { font: '600 32px Oswald, Arial', cor: '#b8c6e4' }); tx(sa.slice(ix + 2), W / 2, 958, { font: '600 46px Oswald, Arial', cor: '#eaf1ff' }); });
      M.PLANOS.forEach(function (p, n) { var t0 = 0.3 + n * 1.0; entrada(t0, dv, function () { if (dv >= t0) somUma('c' + n, 'confirma'); var x = cx0 + n * cp; g.fillStyle = 'rgba(12,21,40,.94)'; g.strokeStyle = '#8fa0c4'; g.lineWidth = 3; rr(x, 180, cw, 660, 14); g.fill(); g.fillStyle = '#16306a'; rr(x, 180, cw, 124, 14); g.fill(); g.fillRect(x, 180 + 14, cw, 124 - 14); rr(x, 180, cw, 660, 14); g.stroke(); tx(p.nome, x + cw / 2, 244, { font: '600 60px Oswald, Arial', cor: p.cor }); if (c.urgente) { bloco(c.itens[n], x + cw / 2, 340, cw - 60, '600 44px Oswald, Arial', 56, { cor: '#eaf1ff' }); g.strokeStyle = 'rgba(120,160,220,.16)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 40, 610); g.lineTo(x + cw - 40, 610); g.stroke(); tx('QUEM DEU AUTONOMIA', x + cw / 2, 655, { font: '600 32px Oswald, Arial', cor: '#b8c6e4' }); M.COM_AUTONOMIA[n].split('. ').forEach(function (l, k) { tx(l, x + cw / 2, 715 + k * 58, { font: '600 46px Oswald, Arial', cor: '#eaf1ff' }); }); } else bloco(c.itens[n], x + cw / 2, 390, cw - 70, cf, clh, { cor: '#eaf1ff' }); }); });
    },
    pedido: function (c, t) {
      var dv = dVoz(t); fundo(t, 0.6);
      if (!semAnim && dv < 0) { K99(W / 2 + Math.sin(t * 2.2) * 26, 470, 560, t, falando, false); return; }
      tx('O K-99 PEDE AUTONOMIA', 1250, 110, { font: '400 76px Anton, Impact', cor: '#f5c518' }); K99(350, 560, 500, t, false, false);
      [['DAR AUTONOMIA', 'Ele pode remanejar até 20 caixas diante de uma emergência.', '#eaf1ff'], ['EXIGIR AUTORIZAÇÃO', 'Ele precisa consultar os Guardiões antes de alterar a distribuição.', '#eaf1ff']].forEach(function (o, n) { entrada(0.3 + n * 0.8, dv, function () { var x = 650 + n * 610; g.fillStyle = 'rgba(12,21,40,.94)'; g.strokeStyle = '#8fa0c4'; g.lineWidth = 3; rr(x, 220, 590, 560, 14); g.fill(); g.fillStyle = '#16306a'; rr(x, 220, 590, 150, 14); g.fill(); g.fillRect(x, 220 + 14, 590, 150 - 14); rr(x, 220, 590, 560, 14); g.stroke(); bloco(o[0], x + 295, 300, 530, '600 54px Oswald, Arial', 64, { cor: o[2] }); bloco(o[1], x + 295, 480, 500, '600 46px Oswald, Arial', 62, { cor: '#b8c6e4' }); }); });
    },
    domino: function (c, t) {
      var dv = dVoz(t); fundo(t, 0.6);
      if (!semAnim && atual === 'P_NEUTRA' && dv < 0) { K99(W / 2 + Math.sin(t * 2.2) * 26, 470, 560, t, falando, false); return; }
      tx('AS ENTREGAS DEPENDEM DAS ESTAÇÕES', W / 2, 74, { font: '400 72px Anton, Impact', cor: '#f5c518' });
      /* a corrente: Estações, entregas, pessoas. A luz percorre e falha. */
      var el = ['ESTAÇÕES', 'ENTREGAS', 'HOSPITAL E ABRIGO'], fase = (t % 3) / 3; el.forEach(function (e, n) { var x = 170 + n * 560, ac = !semAnim && fase * 3 >= n && fase * 3 < n + 1; g.fillStyle = ac ? 'rgba(246,190,123,.22)' : 'rgba(12,21,40,.94)'; g.strokeStyle = ac ? '#f6be7b' : '#8fa0c4'; g.lineWidth = 3; rr(x, 140, 460, 100, 14); g.fill(); rr(x, 140, 460, 100, 14); g.stroke(); tx(e, x + 230, 190, { font: '600 44px Oswald, Arial', cor: '#eaf1ff' }); if (n < 2) tx('→', x + 510, 190, { font: '600 64px Oswald, Arial', cor: '#f6be7b' }); });
      if (!semAnim && dv < 0) return;
      M.PLANOS.forEach(function (p, n) { var t0 = 0.3 + n * 0.9; entrada(t0, dv, function () { if (dv >= t0) somUma('d' + n, 'confirma'); var x = 70 + n * 600; g.fillStyle = 'rgba(12,21,40,.94)'; g.strokeStyle = '#8fa0c4'; g.lineWidth = 3; rr(x, 280, 580, 620, 14); g.fill(); g.fillStyle = '#16306a'; rr(x, 280, 580, 124, 14); g.fill(); g.fillRect(x, 280 + 14, 580, 124 - 14); rr(x, 280, 580, 620, 14); g.stroke(); tx(p.nome, x + 290, 344, { font: '600 56px Oswald, Arial', cor: p.cor }); bloco(M.DOMINO[n], x + 290, 450, 520, '600 54px Oswald, Arial', 72, { cor: '#eaf1ff' }); }); });
    },
    mestre: function (c, t) { fundo(t, 0.8); var cr = semAnim ? 1 : sai((t - ini) / 4), n = g.createRadialGradient(W / 2, 450, 0, W / 2, 450, 620); n.addColorStop(0, 'rgba(159,243,255,' + cr * (0.28 + 0.1 * Math.sin(t)) + ')'); n.addColorStop(1, 'rgba(159,243,255,0)'); g.fillStyle = n; g.fillRect(0, 0, W, H); g.save(); g.globalAlpha = cr; PL.cristal(g, W / 2, 440, 130, false, t); g.restore(); },
    silencio: function (c, t) { fundo(t, 0.6); tx('AVENTURA CONCLUÍDA', W / 2, 330, { font: '600 48px Oswald, Arial', cor: '#f5c518' }); tx('MISSÃO PORTO LUME', W / 2, 470, { font: '400 76px Anton, Impact', cor: '#8fa0c4' }); tx('Agora, a conversa continua entre os Guardiões.', W / 2, 620, { font: '600 60px Oswald, Arial', cor: '#eaf1ff' }); tx('Roda de conversa', W / 2, 730, { font: '600 36px Oswald, Arial', cor: '#8fa0c4' }); }
  };
  function legenda() { if (!leg) return; var f = '600 42px Oswald, Arial', q = quebra(leg.txt, 1640, f), hh = q.length * 54 + 68, y0 = H - hh - 16; g.fillStyle = 'rgba(3,6,15,.93)'; g.fillRect(90, y0, W - 180, hh); g.strokeStyle = 'rgba(120,160,220,.34)'; g.lineWidth = 2; g.strokeRect(90, y0, W - 180, hh); tx(leg.quem, W / 2, y0 + 26, { font: '600 28px Oswald, Arial', cor: leg.quem === 'K-99' ? '#7af0e8' : '#f5c518' }); q.forEach(function (l, n) { tx(l, W / 2, y0 + 72 + n * 54, { font: f }); }); }
  function discreto() { g.fillStyle = tocando ? '#f6be7b' : '#3b5f3f'; g.beginPath(); g.arc(W - 22, H - 22, 7, 0, 6.283); g.fill(); }
  /* selo MISSÃO EM GRUPO: canto superior esquerdo, sempre igual, sem animação e sem som. --cyan-soft sobre o painel do site. */
  function seloGrupo() { var x = 40, y = 30, w = 410, h = 66; g.save(); g.fillStyle = 'rgba(12,21,40,.88)'; rr(x, y, w, h, 14); g.fill(); g.strokeStyle = 'rgba(122,240,232,.55)'; g.lineWidth = 2; rr(x, y, w, h, 14); g.stroke();
    g.fillStyle = '#7af0e8'; [[x + 34, 0.82], [x + 80, 0.82], [x + 57, 1]].forEach(function (p) { var e = p[1], cx = p[0], cy = y + 25; g.beginPath(); g.arc(cx, cy, 8.5 * e, 0, 6.283); g.fill(); g.beginPath(); g.arc(cx, cy + 27 * e, 15 * e, Math.PI, 0); g.fill(); });
    tx('MISSÃO EM GRUPO', x + 112, y + h / 2 + 1, { al: 'left', font: '600 36px Oswald, Arial', cor: '#7af0e8' }); g.restore(); }
  /* onde as mesas trabalham juntas: a conversa sobre a ordem, a escolha do plano, a decisão sobre a autonomia e a roda */
  function emGrupo(c, t) { return (c.id === 'cafe' && passo === 1) || c.id === 'planos' || (c.id === 'pedido' && (semAnim || dVoz(t) >= 0)) || c.id === 'fim'; }
  function quadro() { var t = performance.now() / 1000, c = C[i]; T[c.tela](c, t); if (emGrupo(c, t)) seloGrupo(); legenda(); discreto(); tx((i + 1) + '/' + C.length, 14, 1058, { al: 'left', font: '600 26px Oswald, Arial', cor: '#8fa0c4' }); if (!semAnim) { var fd = 1 - (t - ini) / 0.55; if (fd > 0) { g.fillStyle = 'rgba(0,0,0,' + fd + ')'; g.fillRect(0, 0, W, H); } } requestAnimationFrame(quadro); }
  function paraAudio() { geracao++; aguardando = false; if (audio) { audio.onended = null; audio.onerror = null; audio.pause(); audio = null; } clearTimeout(relogio); tocando = false; falando = false; leg = null; fila = []; }
  function sfx(n) { if (!n) return; try { var a = new Audio('audio/sfx/' + n + '.mp3'); a.volume = 0.7; a.play().catch(function () {}); } catch (e) {} }
  /* Uma fala por vez. A próxima só começa depois do fim real da anterior.
     - O relógio de segurança só começa quando o áudio REALMENTE começa a tocar ('playing').
     - Quando o relógio vence, confere se o áudio ainda avança: se avança, espera mais; se parou de avançar por 4 s, tenta tocar de novo uma vez; se continuar parado por mais 6 s, é travamento.
     - Áudio que não começa em 30 s (arquivo lento, como na primeira leitura de uma pasta do OneDrive), que dá erro ou que trava: a legenda fica pelo tempo de leitura e a sequência segue.
     - Cada troca de tela muda a "geração": chamadas atrasadas da tela anterior são ignoradas. */
  function proxima() {
    var ger = geracao;
    if (!fila.length) { tocando = false; falando = false; leg = null; fimVoz = performance.now() / 1000; return; }
    var id = fila.shift(), x = D.falas[id], feito = false, falhou = false, comecou = false, ultimo = -1, parado = 0, retentou = false; ouvidas[id] = 1; atual = id; leg = x; falando = x.quem === 'K-99'; tocando = true;
    /* rede de segurança: nunca duas vozes. No fluxo normal a anterior já terminou e isto não faz nada. */
    if (audio && !audio.paused && !audio.ended) { audio.onended = null; audio.onerror = null; audio.pause(); }
    var a = new Audio('audio/falas/' + id + '.mp3'); audio = a;
    var vale = function () { return ger === geracao && audio === a && !feito; };
    var fim = function () { if (!vale()) return; feito = true; clearTimeout(relogio); if (C[i].pausas && fila.length) relogio = setTimeout(function () { if (ger !== geracao || audio !== a) return; tocando = false; falando = false; aguardando = true; }, 300); else relogio = setTimeout(function () { if (ger === geracao) proxima(); }, 300); };
    /* sem áudio, a legenda continua na tela pelo tempo de leitura: a facilitadora lê em voz alta */
    var falha = function (motivo) { if (!vale() || falhou) return; falhou = true; erroAudio++; registroFalhas.push({ fala: id, motivo: String(motivo && motivo.name || motivo || "erro"), tempo: Math.round(a.currentTime || 0) }); clearTimeout(relogio); a.onended = null; try { a.pause(); } catch (e) {} relogio = setTimeout(function () { if (ger !== geracao) return; feito = false; fim(); }, x.txt.length * 70 + 1500); };
    var vigia = function () { if (!vale()) return; if (a.ended) return fim(); var t = a.currentTime || 0; if (t > ultimo + 0.05) { ultimo = t; parado = 0; } else parado++;
      if (parado >= 4 && !retentou) { retentou = true; parado = 0; var q = a.play(); if (q && q.catch) q.catch(function () {}); }
      else if (parado >= 6 && retentou) return falha(t < 0.05 ? "não avançou do início" : "travou no meio");
      relogio = setTimeout(vigia, 1000); };
    a.onended = fim; a.onerror = function () { falha("arquivo com erro"); };
    a.addEventListener('playing', function () { if (!vale() || comecou) return; comecou = true; clearTimeout(relogio); relogio = setTimeout(vigia, 1000); });
    var p = a.play(); if (p && p.catch) p.catch(function (e) { falha("play recusado: " + (e && e.name)); });
    relogio = setTimeout(function () { if (!comecou) falha("não começou em 30 s"); }, 30000);
  }
  function entra(tocar) { passo = 0; tPasso = -1; atual = null; tK = null; ouvidas = {}; sons = {}; paraAudio(); ini = performance.now() / 1000; var c = C[i]; fimVoz = tocar && c.falas && c.falas.length ? null : tocar ? ini : -1000; semAnim = !tocar; try { history.replaceState(null, '', '#' + i); } catch (e) {} if (tocar) { sfx(c.sfx); fila = (c.falas || []).slice(); if (fila.length) { tocando = true; relogio = setTimeout(proxima, c.sfx ? 700 : 150); } } }
  function voltar() { if (C[i].etapas && passo > 0) { passo--; tPasso = -1; return; } if (i > 0) { i--; entra(false); if (C[i].etapas) passo = C[i].etapas - 1; } }
  function avancar() { if (tocando) return; if (aguardando) { aguardando = false; comandos++; proxima(); return; } if (C[i].etapas && passo < C[i].etapas - 1) { passo++; tPasso = performance.now() / 1000; comandos++; return; } if (i < C.length - 1) { i++; comandos++; entra(true); } }
  /* um acionamento = um comando: ignora tecla segurada e o repique do passador */
  function cmd(fn) { var a = performance.now(); if (fn === ultimoFn && a - ultimoCmd < 120) return; ultimoFn = fn; ultimoCmd = a; fn(); }
  addEventListener('keydown', function (e) {
    var k = e.key; var nav = k === 'PageDown' || k === 'ArrowRight' || k === ' ' || k === 'Enter' || k === 'PageUp' || k === 'ArrowLeft'; if (nav && e.repeat) { e.preventDefault(); return; }
    if (k === 'PageDown' || k === 'ArrowRight' || k === ' ' || k === 'Enter') { e.preventDefault(); cmd(avancar); }
    else if (k === 'PageUp' || k === 'ArrowLeft') { e.preventDefault(); cmd(voltar); }
    else if (k === 'r' || k === 'R') { e.preventDefault(); entra(true); }
    else if (k === 'Escape' || k === 's' || k === 'S') { e.preventDefault(); paraAudio(); if (fimVoz === null) fimVoz = performance.now() / 1000; }
    else if (k === 'f' || k === 'F') { e.preventDefault(); if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(function () {}); }
  });
  addEventListener('click', function (e) { if (e.target && (e.target.id === 'botao' || e.target.id === 'voltarB')) return; cmd(avancar); });
  var botao = document.getElementById('botao'), mouseT = null;
  botao.onclick = function () { cmd(avancar); botao.blur(); };
  var voltarB = document.getElementById('voltarB'); voltarB.onclick = function () { cmd(voltar); voltarB.blur(); };
  addEventListener('mousemove', function () { document.body.classList.add('mouse'); clearTimeout(mouseT); mouseT = setTimeout(function () { document.body.classList.remove('mouse'); }, 3000); });
  setInterval(function () { var fim = i === C.length - 1; document.getElementById('voltarB').style.display = i === 0 ? 'none' : ''; botao.disabled = tocando || fim; botao.style.display = fim ? 'none' : ''; botao.textContent = tocando ? 'FALA TOCANDO' : 'AVANÇAR'; }, 150);
  function aj() { var e = Math.min(innerWidth / W, innerHeight / H); cv.style.width = W * e + 'px'; cv.style.height = H * e + 'px'; } addEventListener('resize', aj); aj();
  document.fonts.ready.then(function () { requestAnimationFrame(quadro); });
  window.GK = { falhas: function () { return registroFalhas.slice(); }, grupo: function () { return emGrupo(C[i], performance.now() / 1000); }, aguardando: function () { return aguardando; }, passo: function () { return passo; }, revelou: function () { return semAnim || fimVoz !== null; }, i: function () { return i; }, tocando: function () { return tocando; }, leg: function () { return leg; }, comandos: function () { return comandos; }, erros: function () { return erroAudio; }, total: C.length };
})();
