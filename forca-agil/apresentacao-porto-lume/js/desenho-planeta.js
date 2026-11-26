/* Desenho PROVISÓRIO de um universo: mostra claramente o que aconteceu. Não é arte final. Usado pelo telão, pelo painel e pela comparação. */
(function (raiz) {
  var node = typeof module !== 'undefined' && module.exports;
  var R = node ? require('./regras.js') : raiz.REGRAS;
  var MARCAS = {
    farol: { consulta: 'Formulários orbitando sem resposta', lista: 'Caixas em órbita, muito bem organizadas', intencao: 'Naves desviadas do núcleo' },
    rede: { consulta: '212 pedidos de autorização nos postos', lista: 'Postos carimbados: falta a peça', intencao: 'Três postos pintados de laranja' },
    onda: { consulta: 'Instalações piscando, à espera de autorização', lista: 'Instalações desligadas: oscilação zero', intencao: 'Um terço do planeta fora da área atendida' }
  };
  /* cidades em posições fixas */
  var CID = []; var s = 7; var rnd = function () { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (var i = 0; i < 64; i++) { var a = rnd() * 6.283, d = Math.sqrt(rnd()) * 0.86; CID.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.92, f: rnd() * 6.28, k: rnd() }); }
  var POS = { abrigo: { x: -0.56, y: 0.2 }, nucleo: { x: 0, y: -0.02 }, estacoes: { x: 0.56, y: 0.26 }, porto: { x: 0.18, y: -0.62 } };

  function luz(c, u, t, r) {
    var e = u.estrategia; if (!e) return 0.06;
    var dc = Math.hypot(c.x, c.y), v;
    if (e === 'farol') v = dc < 0.42 ? 1 : 0.05;
    else if (e === 'rede') v = c.k < 0.78 ? 0.75 : 0.1;
    else v = c.k < 0.88 ? 0.45 + 0.55 * Math.abs(Math.sin(t * 2.2 + c.f)) : 0.1;
    if (r) {
      if (r.cristalApagado) v *= 0.55;
      if (r.caiu) {
        var q = POS[r.caiu], dq = Math.hypot(c.x - q.x, c.y - q.y), raio = r.grave ? 0.72 : 0.42;
        if (r.caiu === 'nucleo') { v *= r.grave ? 0.08 : 0.3; } else if (dq < raio) v *= 0.05;
      }
    }
    return v;
  }
  function tx(g, str, x, y, o) { o = o || {}; g.save(); g.font = o.font || '600 14px Oswald, Arial'; g.fillStyle = o.cor || '#eef3fb'; g.textAlign = o.al || 'center'; g.textBaseline = o.base || 'middle'; if (o.sombra !== false) { g.shadowColor = '#000'; g.shadowBlur = 6; } g.fillText(str, x, y); g.restore(); }

  function marca(g, u, cx, cy, r, t) {
    var e = u.estrategia, o = u.ordem1; if (!e || !o) return;
    var chave = e + '_' + o, k, ang, x, y;
    if (chave === 'farol_lista' || chave === 'farol_consulta') {
      for (k = 0; k < 9; k++) { ang = t * 0.35 + k * 6.283 / 9; x = cx + Math.cos(ang) * r * 1.22; y = cy + Math.sin(ang) * r * 0.42; if (Math.sin(ang) < 0 && Math.hypot(x - cx, y - cy) < r) continue;
        if (chave === 'farol_lista') { g.fillStyle = '#ffa63d'; g.fillRect(x - r * 0.05, y - r * 0.05, r * 0.1, r * 0.1); g.strokeStyle = '#5b3200'; g.lineWidth = 1; g.strokeRect(x - r * 0.05, y - r * 0.05, r * 0.1, r * 0.1); }
        else { g.fillStyle = '#eef3fb'; g.fillRect(x - r * 0.04, y - r * 0.055, r * 0.08, r * 0.11); g.fillStyle = '#7b8db0'; g.fillRect(x - r * 0.025, y - r * 0.03, r * 0.05, 1.5); g.fillRect(x - r * 0.025, y, r * 0.05, 1.5); } }
    }
    if (chave === 'farol_intencao') { for (k = 0; k < 4; k++) { var p = (t * 0.12 + k / 4) % 1; x = cx + (POS.nucleo.x + (0.8 - POS.nucleo.x) * p) * r * (k % 2 ? 1 : -1); y = cy + (-0.5 + k * 0.33) * r * p; g.save(); g.translate(x, y); g.rotate(k % 2 ? 0.2 : 2.9); g.fillStyle = '#7af0e8'; g.beginPath(); g.moveTo(r * 0.08, 0); g.lineTo(-r * 0.05, -r * 0.04); g.lineTo(-r * 0.05, r * 0.04); g.closePath(); g.fill(); g.restore(); } }
    if (chave === 'rede_consulta') { CID.forEach(function (c, i) { if (i % 3) return; x = cx + c.x * r; y = cy + c.y * r; g.strokeStyle = '#ff6b5e'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - r * 0.09); g.stroke(); g.fillStyle = '#ff6b5e'; g.fillRect(x, y - r * 0.09, r * 0.05, r * 0.03); }); }
    if (chave === 'rede_lista') { CID.forEach(function (c, i) { if (i % 4) return; x = cx + c.x * r; y = cy + c.y * r; g.fillStyle = '#eef3fb'; g.fillRect(x - r * 0.03, y - r * 0.04, r * 0.06, r * 0.08); g.strokeStyle = '#ff6b5e'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - r * 0.03, y - r * 0.04); g.lineTo(x + r * 0.03, y + r * 0.04); g.stroke(); }); }
    if (chave === 'rede_intencao') { [[-0.35, -0.42], [0.42, -0.2], [-0.1, 0.55]].forEach(function (q) { g.fillStyle = '#ff7a1a'; g.shadowColor = '#ff7a1a'; g.shadowBlur = r * 0.15; g.fillRect(cx + q[0] * r - r * 0.07, cy + q[1] * r - r * 0.07, r * 0.14, r * 0.14); g.shadowBlur = 0; }); }
    if (chave === 'onda_consulta') { var pisc = Math.sin(t * 12) > 0; [[-0.4, -0.3], [0.4, -0.35], [-0.2, 0.5], [0.35, 0.45]].forEach(function (q) { x = cx + q[0] * r; y = cy + q[1] * r; g.fillStyle = pisc ? '#ffa63d' : '#3a2a10'; g.beginPath(); g.arc(x, y, r * 0.06, 0, 6.283); g.fill(); tx(g, '?', x, y - r * 0.11, { font: '700 ' + Math.max(10, r * 0.12) + 'px Space Mono, monospace', cor: '#ffa63d' }); }); }
    if (chave === 'onda_lista') { [[-0.4, -0.3], [0.4, -0.35], [-0.2, 0.5], [0.35, 0.45]].forEach(function (q) { x = cx + q[0] * r; y = cy + q[1] * r; g.fillStyle = '#101726'; g.strokeStyle = '#ff6b5e'; g.lineWidth = 2; g.fillRect(x - r * 0.07, y - r * 0.07, r * 0.14, r * 0.14); g.strokeRect(x - r * 0.07, y - r * 0.07, r * 0.14, r * 0.14); g.beginPath(); g.moveTo(x - r * 0.07, y - r * 0.07); g.lineTo(x + r * 0.07, y + r * 0.07); g.moveTo(x + r * 0.07, y - r * 0.07); g.lineTo(x - r * 0.07, y + r * 0.07); g.stroke(); }); }
    if (chave === 'onda_intencao') { g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 6.283); g.clip(); g.fillStyle = 'rgba(0,0,0,.72)'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r * 1.02, -2.6, -2.6 + 2.09); g.closePath(); g.fill(); g.restore(); }
  }

  /* o: mostrar {luz, cristal, marca1, porto, hospital, divida, lugares, fragil, fichas, sinal, final} */
  function desenhar(g, cx, cy, r, u, o, t, opc) {
    opc = opc || {};
    var fim = o.final && u.estrategia && u.azul && u.dourada && R.ordemFinal(u);
    var res = fim ? R.resultado(u) : null;
    var sin = (o.sinal || fim) && u.azul && u.dourada && R.ordemFinal(u) ? R.aposSinal(u) : null;
    var grad = g.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
    grad.addColorStop(0, '#1d3f73'); grad.addColorStop(0.7, '#0c1f40'); grad.addColorStop(1, '#050b18');
    g.save(); g.fillStyle = grad; g.beginPath(); g.arc(cx, cy, r, 0, 6.283); g.fill();
    g.strokeStyle = (u.estrategia && R.ESTRATEGIAS[u.estrategia].cor) || '#27406f'; g.globalAlpha = 0.5; g.lineWidth = 2; g.stroke(); g.globalAlpha = 1;
    if (o.luz || o.final) CID.forEach(function (c) {
      var v = luz(c, u, t, res); var cor = (u.estrategia === 'rede' && c.k < 0.14 && Math.sin(t * 3 + c.f) > 0) ? '#ffa63d' : (u.estrategia ? R.ESTRATEGIAS[u.estrategia].cor : '#fff');
      g.globalAlpha = Math.max(0.04, v); g.fillStyle = cor; g.beginPath(); g.arc(cx + c.x * r, cy + c.y * r, Math.max(1.2, r * 0.018) * (0.7 + v * 0.9), 0, 6.283); g.fill();
    });
    g.globalAlpha = 1;
    if (res && res.reparo) { g.fillStyle = 'rgba(255,122,26,.75)'; for (var k = 0; k < 7; k++) g.fillRect(cx + POS[res.caiu].x * r + (k - 3) * r * 0.05, cy + POS[res.caiu].y * r + Math.sin(k * 2) * r * 0.08, r * 0.035, r * 0.035); }
    if (o.marca1 || o.final) marca(g, u, cx, cy, r, t);
    var fs = Math.max(11, r * 0.13);
    /* Porto Lume */
    if (o.porto || ((o.hospital || o.final) && R.temLotes(u))) {
      var ph = POS.porto, hx = cx + ph.x * r, hy = cy + ph.y * r, hosp = (o.hospital || o.final) && R.temLotes(u) ? R.hospital(u) : null;
      var hc = hosp ? R.HOSPITAL_COR[hosp] : (Math.sin(t * 5) > 0 ? '#ff6b5e' : '#ffd3cd');
      g.fillStyle = hc; g.fillRect(hx - r * 0.06, hy - r * 0.02, r * 0.12, r * 0.04); g.fillRect(hx - r * 0.02, hy - r * 0.06, r * 0.04, r * 0.12);
      tx(g, hosp ? 'PORTO LUME: ' + R.alas(u) + (R.alas(u) === 1 ? ' ALA' : ' ALAS') : 'PORTO LUME', hx, hy - r * 0.14, { font: '600 ' + fs * 0.75 + 'px Oswald, Arial', cor: hc });
    }
    /* Os três lugares */
    if (o.lugares || o.fichas || o.final) R.L.forEach(function (lug) {
      var q = POS[lug], x = cx + q.x * r, y = cy + q.y * r, raio = r * 0.14, st = res ? res.estados[lug] : null;
      var cor = st === 'caiu' ? '#ff6b5e' : st === 'caiu_grave' ? '#ff2d20' : st === 'danificado' ? '#ffa63d' : st === 'cristal' ? '#a884ff' : st === 'firme' ? '#62e28a' : '#b5c3dc';
      g.fillStyle = 'rgba(3,6,15,.82)'; g.strokeStyle = cor; g.lineWidth = st && st.indexOf('caiu') === 0 ? 4 : 2; g.beginPath(); g.arc(x, y, raio, 0, 6.283); g.fill(); g.stroke();
      tx(g, R.LUGARES[lug].toUpperCase(), x, y + raio + fs * 0.65, { font: '600 ' + fs * 0.8 + 'px Oswald, Arial', cor: cor });
      if (st === 'caiu' || st === 'caiu_grave') { g.strokeStyle = cor; g.lineWidth = 4; g.beginPath(); g.moveTo(x - raio * 0.55, y - raio * 0.55); g.lineTo(x + raio * 0.55, y + raio * 0.55); g.moveTo(x + raio * 0.55, y - raio * 0.55); g.lineTo(x - raio * 0.55, y + raio * 0.55); g.stroke(); }
      /* frágil e dívida */
      var dv = (o.divida || o.final) && R.pressoes(u)[lug], fr = (o.fragil || o.final) && R.fragil(u) === lug;
      if (fr && !res) { g.strokeStyle = 'rgba(255,107,94,' + (0.4 + 0.6 * Math.abs(Math.sin(t * 3))) + ')'; g.lineWidth = 4; g.beginPath(); g.arc(x, y, raio * 1.35, 0, 6.283); g.stroke(); }
      var lin = 0; if (fr) { tx(g, 'FRÁGIL', x, y - raio - fs * 0.7, { font: '700 ' + fs * 0.72 + 'px Space Mono, monospace', cor: '#ff6b5e' }); lin = 1; }
      if (dv) { tx(g, R.PRESSAO_TXT[dv], x, y - raio - fs * (0.7 + lin * 0.95), { font: '700 ' + fs * 0.66 + 'px Space Mono, monospace', cor: '#ffa63d' }); }
      /* fichas */
      if (o.fichas || o.final) {
        var az = (sin ? sin.azul : u.azul) === lug;
        var doLugar = sin ? sin.dourada === lug : u.dourada === lug;
        if (az) { g.fillStyle = '#4c9dff'; g.beginPath(); g.arc(x, y, raio * 0.55, 0, 6.283); g.fill(); }
        if (doLugar && !(sin && sin.moveuPara === lug && o.sinal && t % 4 < 1.4)) {
          var apag = sin && sin.danificado === lug;
          g.fillStyle = apag ? '#4a3d15' : '#f5c518'; if (!apag) { g.shadowColor = '#f5c518'; g.shadowBlur = r * 0.1; } g.beginPath(); g.arc(x, y, raio * 0.55, 0, 6.283); g.fill(); g.shadowBlur = 0;
        }
      }
      if (st === 'cristal') { g.fillStyle = '#a884ff'; g.beginPath(); g.moveTo(x, y - raio * 0.7); g.lineTo(x + raio * 0.45, y); g.lineTo(x, y + raio * 0.7); g.lineTo(x - raio * 0.45, y); g.closePath(); g.fill(); }
    });
    /* dourada voando */
    if (o.sinal && sin && sin.moveuDe) { var f0 = POS[sin.moveuDe], f1 = POS[sin.moveuPara], pr = Math.min(1, (t % 4) / 1.4), mx = cx + (f0.x + (f1.x - f0.x) * pr) * r, my = cy + (f0.y + (f1.y - f0.y) * pr) * r - Math.sin(pr * 3.14) * r * 0.3; if (t % 4 < 1.4) { g.fillStyle = '#f5c518'; g.shadowColor = '#f5c518'; g.shadowBlur = r * 0.2; g.beginPath(); g.arc(mx, my, r * 0.08, 0, 6.283); g.fill(); g.shadowBlur = 0; } }
    g.restore();
    /* cristal do universo */
    if (o.cristal || o.final) { var ap = res ? res.cristalApagado : false; cristal(g, cx + r * 0.92, cy - r * 0.88, r * 0.17, ap, t); }
    if (!opc.semTitulo) {
      tx(g, 'UNIVERSO ' + u.n, cx, cy - r - fs * 1.05, { font: '400 ' + fs * 1.4 + 'px Anton, Impact', cor: '#f5c518' });
      if (u.estrategia) tx(g, R.ESTRATEGIAS[u.estrategia].nome.toUpperCase() + (R.ordemFinal(u) && (o.marca1 || o.final || o.hospital) ? ' · ' + R.ORDENS[R.ordemFinal(u)].nome.toUpperCase() : ''), cx, cy + r + fs * 0.95, { font: '600 ' + fs + 'px Oswald, Arial', cor: R.ESTRATEGIAS[u.estrategia].cor });
    }
  }
  function cristal(g, x, y, r, apagado, t) {
    var p = 0.75 + 0.25 * Math.sin(t * 2.2);
    g.save(); g.translate(x, y);
    if (!apagado) { var h = g.createRadialGradient(0, 0, 0, 0, 0, r * 2.6); h.addColorStop(0, 'rgba(79,224,245,' + 0.55 * p + ')'); h.addColorStop(1, 'rgba(79,224,245,0)'); g.fillStyle = h; g.beginPath(); g.arc(0, 0, r * 2.6, 0, 6.283); g.fill(); }
    g.beginPath(); g.moveTo(0, -r * 1.25); g.lineTo(r * 0.62, -r * 0.3); g.lineTo(r * 0.42, r * 1.05); g.lineTo(-r * 0.42, r * 1.05); g.lineTo(-r * 0.62, -r * 0.3); g.closePath();
    g.fillStyle = apagado ? '#232a3a' : '#9ff3ff'; g.fill(); g.strokeStyle = apagado ? '#4a5570' : '#eaffff'; g.lineWidth = Math.max(1, r * 0.06); g.stroke();
    g.beginPath(); g.moveTo(0, -r * 1.25); g.lineTo(0, r * 1.05); g.moveTo(-r * 0.62, -r * 0.3); g.lineTo(r * 0.62, -r * 0.3); g.strokeStyle = apagado ? '#3a4560' : 'rgba(255,255,255,.7)'; g.stroke();
    g.restore();
  }
  /* K-99 provisório: a boca segue a fala */
  function k99(g, x, y, s, falando, t, humor) {
    g.save(); g.translate(x, y + Math.sin(t * 2) * s * 0.03);
    g.fillStyle = '#7f92b3'; g.fillRect(-s * 0.3, s * 0.42, s * 0.6, s * 0.5);
    g.fillStyle = '#b8c6e4'; g.beginPath(); g.moveTo(-s * 0.5, -s * 0.4); g.lineTo(s * 0.5, -s * 0.4); g.lineTo(s * 0.5, s * 0.36); g.lineTo(-s * 0.5, s * 0.36); g.closePath(); g.fill();
    g.strokeStyle = '#27406f'; g.lineWidth = s * 0.03; g.stroke();
    g.strokeStyle = '#7f92b3'; g.lineWidth = s * 0.04; g.beginPath(); g.moveTo(0, -s * 0.4); g.lineTo(0, -s * 0.66); g.stroke(); g.fillStyle = Math.sin(t * 7) > 0 ? '#ff6b5e' : '#ffa63d'; g.beginPath(); g.arc(0, -s * 0.7, s * 0.06, 0, 6.283); g.fill();
    g.fillStyle = '#0b1630'; [-0.22, 0.22].forEach(function (ex) { g.beginPath(); g.arc(ex * s, -s * 0.12, s * 0.12, 0, 6.283); g.fill(); });
    g.fillStyle = '#4fe0f5'; [-0.22, 0.22].forEach(function (ex) { var pis = (t % 3.7) < 0.12 ? 0.02 : 0.06; g.beginPath(); g.arc(ex * s + Math.sin(t * 0.7) * s * 0.03, -s * 0.12, s * pis, 0, 6.283); g.fill(); });
    g.fillStyle = '#0b1630'; g.fillRect(-s * 0.26, s * 0.12, s * 0.52, s * 0.14);
    g.fillStyle = '#62e28a'; for (var i = 0; i < 7; i++) { var h = falando ? (0.03 + 0.1 * Math.abs(Math.sin(t * 11 + i * 1.7))) : 0.012; g.fillRect((-0.24 + i * 0.07) * s, (0.19 - h / 2) * s, s * 0.05, h * s); }
    g.fillStyle = '#27406f'; g.font = '700 ' + s * 0.12 + 'px Space Mono, monospace'; g.textAlign = 'center'; g.fillText('K-99', 0, s * 0.72);
    g.restore();
  }
  var API = { desenhar: desenhar, cristal: cristal, k99: k99, tx: tx, MARCAS: MARCAS };
  if (node) module.exports = API; else raiz.PLANETA = API;
})(typeof window !== 'undefined' ? window : globalThis);
