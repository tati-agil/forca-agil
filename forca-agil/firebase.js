/* ============================================================
   Força Ágil — Firebase
   Registro unificado: autodiagnóstico + missões + kyber game
   ============================================================ */
(function () {

  var firebaseConfig = {
    apiKey:      "AIzaSyAmnQTedd2eqL0d-3kMD2oWNeg0rwP6Lx0",
    authDomain:  "kyber-agil.firebaseapp.com",
    databaseURL: "https://kyber-agil-default-rtdb.firebaseio.com",
    projectId:   "kyber-agil"
  };

  var fbReady = false;
  try {
    firebase.initializeApp(firebaseConfig);
    fbReady = true;
    console.log('✅ Firebase inicializado!');
  } catch (err) {
    console.warn('⚠️ Firebase:', err.message);
  }

  // ---- Ranks ----
  var RANKS = [
    { name: 'Youngling', min: 0  },
    { name: 'Padawan',   min: 25 },
    { name: 'Cavaleiro', min: 50 },
    { name: 'Mestre',    min: 75 }
  ];
  function getRank(xp) {
    var r = RANKS[0];
    for (var i = 0; i < RANKS.length; i++) { if (xp >= RANKS[i].min) r = RANKS[i]; }
    return r.name;
  }

  // ---- Player helpers ----
  function getPlayer() {
    try { return JSON.parse(localStorage.getItem('fa-player') || 'null') || null; } catch(e) { return null; }
  }
  function sanitizeKey(str) {
    return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 40);
  }
  function playerKey(p) {
    return sanitizeKey(p.name) + '__' + sanitizeKey(p.turma);
  }

  // ---- XP helpers ----
  function getGameXP() {
    try {
      var s = JSON.parse(localStorage.getItem('fa-game-v2') || 'null');
      if (!s) return { xpAuto: 0, xpMissoes: 0 };
      var answered = (s.quiz || []).filter(function(v) { return v != null; }).length;
      var xpAuto   = Math.round(answered / 6 * 20);
      var xpMissoes = parseInt(localStorage.getItem('fa-missions-xp') || '0', 10) || 0;
      return { xpAuto: xpAuto, xpMissoes: xpMissoes };
    } catch(e) { return { xpAuto: 0, xpMissoes: 0 }; }
  }
  function getKyberXP() {
    return parseInt(localStorage.getItem('fa-kyber-xp') || '0', 10) || 0;
  }

  // ---- Sync player record to Firebase ----
  window.faSyncPlayer = function() {
    var p = getPlayer();
    if (!p || !p.name) return;
    var gxp   = getGameXP();
    var kxp   = getKyberXP();
    var total = Math.min(100, gxp.xpAuto + gxp.xpMissoes + kxp);
    var entry = {
      name:      p.name,
      area:      p.area  || '',
      turma:     p.turma || '',
      xpAuto:    gxp.xpAuto,
      xpMissoes: gxp.xpMissoes,
      xpKyber:   kxp,
      totalXP:   total,
      patente:   getRank(total),
      updatedAt: new Date().toISOString()
    };
    var key = playerKey(p);
    if (fbReady) {
      firebase.database().ref('players/' + key).set(entry)
        .catch(function(err) { console.warn('Firebase sync error:', err); });
    }
    try { localStorage.setItem('fa-my-entry', JSON.stringify(entry)); } catch(e) {}
  };

  // ---- Kyber Game finish (chamado por kyber.js) ----
  window.kyberFinishGame = function() {
    clearInterval(gameState.timerInterval);
    document.getElementById('kyber-challenge').style.display = 'none';

    // bloqueia replay
    try { localStorage.setItem('fa-kyber-done', '1'); } catch(e) {}

    // converte score em XP (0–32)
    var kyberXP = Math.min(32, Math.round(gameState.totalScore / 20000 * 32));
    try { localStorage.setItem('fa-kyber-xp', String(kyberXP)); } catch(e) {}

    var p     = getPlayer() || { name: gameState.playerName || 'Agente', area: '', turma: '' };
    var gxp   = getGameXP();
    var total = Math.min(100, gxp.xpAuto + gxp.xpMissoes + kyberXP);

    var go = document.getElementById('kyber-gameover');
    if (go) {
      go.style.display = 'block';
      go.innerHTML =
        '<div class="gameover-content">' +
          '<h3>Missão Completa!</h3>' +
          '<div class="gameover-score">Pontuação: <strong>' + gameState.totalScore + ' pts</strong></div>' +
          '<div class="gameover-rank">+' + kyberXP + ' XP Kyber · Patente: <strong>' + getRank(total) + '</strong></div>' +
          '<div class="gameover-rank" style="font-size:.85rem;opacity:.7">' + p.name + (p.turma ? ' · ' + p.turma : '') + '</div>' +
          '<div class="gameover-actions">' +
            '<a class="btn btn--primary" href="#arquetipos">Ver minha patente</a>' +
          '</div>' +
        '</div>';
    }

    window.faSyncPlayer();
    window.kyberRenderRanking();

    setTimeout(function() {
      if (typeof window.faGameRender === 'function') window.faGameRender();
    }, 300);
  };

  // ---- Ranking ----
  window.kyberRenderRanking = function() {
    var list = document.getElementById('kyber-leaderboard');
    if (!list) return;
    list.innerHTML = '<h4>🏆 Ranking da Galáxia</h4><p style="color:var(--ink-3);font-size:.9rem">Carregando…</p>';

    function renderRows(players) {
      list.innerHTML = '<h4>🏆 Ranking da Galáxia</h4>';
      var myEntry = null;
      try { myEntry = JSON.parse(localStorage.getItem('fa-my-entry') || 'null'); } catch(e) {}

      if (!players.length) {
        list.innerHTML += '<p style="color:var(--ink-3);font-size:.85rem">Nenhum agente registrado ainda.</p>';
        return;
      }
      players.forEach(function(e, i) {
        var isMe = myEntry && e.name === myEntry.name && e.area === myEntry.area;
        var row = document.createElement('div');
        row.className = 'rank-row' + (isMe ? ' highlight' : '');
        // patente visível só para a própria pessoa
        var patenteHtml = isMe
          ? '<span class="rank-patente" style="color:var(--accent);font-family:var(--font-mono);font-size:.75rem">' + (e.patente || '') + '</span>'
          : '';
        row.innerHTML =
          '<span class="rank-pos">#' + (i + 1) + '</span>' +
          '<span class="rank-name">' + e.name +
            (e.area ? '<span class="rank-area">' + e.area + '</span>' : '') +
          '</span>' +
          patenteHtml +
          '<span class="rank-score">' + (e.totalXP || 0) + ' XP</span>';
        list.appendChild(row);
      });
    }

    if (fbReady) {
      firebase.database().ref('players')
        .orderByChild('totalXP').on('value', function(snapshot) {
          var data = snapshot.val();
          var players = data ? Object.values(data) : [];
          players.sort(function(a, b) { return (b.totalXP || 0) - (a.totalXP || 0); });
          renderRows(players.slice(0, 20));
        });
    } else {
      try {
        var mine = JSON.parse(localStorage.getItem('fa-my-entry') || 'null');
        renderRows(mine ? [mine] : []);
      } catch(e) { renderRows([]); }
    }
  };

  // ---- Kyber bloqueado se já jogou ----
  window.kyberAlreadyPlayed = function() {
    return localStorage.getItem('fa-kyber-done') === '1';
  };

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', function() {
    kyberRenderRanking();
    setTimeout(window.faSyncPlayer, 800);
  });

  window.addEventListener('fa-player-registered', function() {
    setTimeout(window.faSyncPlayer, 300);
  });

})();
