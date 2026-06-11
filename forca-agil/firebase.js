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
  function getKyberXP()   { return parseInt(localStorage.getItem('fa-kyber-xp')   || '0', 10) || 0; }
  function getContentXP() { return parseInt(localStorage.getItem('fa-content-xp') || '0', 10) || 0; }
  function getRepoXP()    { return parseInt(localStorage.getItem('fa-repo-xp')    || '0', 10) || 0; }

  function escHtml(s) {
    return String(s || '').replace(/[&<>"]/g, function(c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }

  // ---- Sync player record to Firebase ----
  window.faSyncPlayer = function() {
    var p = getPlayer();
    if (!p || !p.name) return;
    var gxp   = getGameXP();
    var kxp   = getKyberXP();
    var cxp   = getContentXP();
    var rxp   = getRepoXP();
    var total = Math.min(100, gxp.xpAuto + gxp.xpMissoes + kxp + cxp + rxp);
    var entry = {
      name:      p.name,
      area:      p.area  || '',
      turma:     p.turma || '',
      xpAuto:    gxp.xpAuto,
      xpMissoes: gxp.xpMissoes,
      xpKyber:   kxp,
      xpContent: cxp,
      xpRepo:    rxp,
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
    var kyberXP = Math.min(50, Math.round(gameState.totalScore / 20000 * 50));
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

    // XP do kyber salvo localmente — Firebase sincroniza só ao clicar "Revelar Patente"
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

  // ---- Home ranking mini (top 5) ----
  window.faRenderHomeRanking = function() {
    var list = document.getElementById('homeRanking');
    if (!list) return;
    list.innerHTML = '<p style="color:var(--ink-3);font-size:.82rem">Carregando…</p>';
    if (!fbReady) {
      list.innerHTML = '<p style="color:var(--ink-3);font-size:.82rem">Seja o primeiro no ranking!</p>';
      return;
    }
    firebase.database().ref('players').orderByChild('totalXP').limitToLast(5)
      .on('value', function(snapshot) {
        var data = snapshot.val();
        list.innerHTML = '';
        if (!data) {
          list.innerHTML = '<p style="color:var(--ink-3);font-size:.82rem">Seja o primeiro no ranking!</p>';
          return;
        }
        var players = Object.values(data).sort(function(a,b) { return (b.totalXP||0) - (a.totalXP||0); });
        players.slice(0, 5).forEach(function(p, i) {
          var row = document.createElement('div');
          row.className = 'rank-row';
          row.innerHTML =
            '<span class="rank-pos">#' + (i+1) + '</span>' +
            '<span class="rank-name">' + escHtml(p.name || '—') +
              (p.area ? '<span class="rank-area">' + escHtml(p.area) + '</span>' : '') +
            '</span>' +
            '<span class="rank-score">' + (p.totalXP || 0) + ' XP</span>';
          list.appendChild(row);
        });
      });
  };

  // ---- Revelar Patente Final ----
  document.addEventListener('DOMContentLoaded', function() {
    kyberRenderRanking();

    var revelarBtn    = document.getElementById('revelarBtn');
    var revelarConfirm= document.getElementById('revelarConfirm');
    var revelarOk     = document.getElementById('revelarOk');
    var revelarCancel = document.getElementById('revelarCancel');
    var revelarPatente= document.getElementById('revelarPatente');

    function checkProgress() {
      try {
        var state = JSON.parse(localStorage.getItem('fa-game-v2') || 'null');
        var autoDone = state && state.quiz && state.quiz.filter(function(v){ return v != null; }).length === 6;
        var missoesDone = state && state.missions && Object.keys(state.missions).length === 6 &&
          Object.values(state.missions).every(function(m) {
            return m && m.answers && m.answers.every(function(a){ return a !== null; });
          });
        var kyberDone = localStorage.getItem('fa-kyber-done') === '1';
        return { autoDone: autoDone, missoesDone: missoesDone, kyberDone: kyberDone,
                 allDone: autoDone && missoesDone && kyberDone };
      } catch(e) { return { autoDone: false, missoesDone: false, kyberDone: false, allDone: false }; }
    }

    function updateRevelarBtn() {
      if (!revelarBtn) return;
      var prog = checkProgress();
      if (prog.allDone) {
        revelarBtn.disabled = false;
        revelarBtn.style.opacity = '';
        revelarBtn.title = '';
        var hint = document.querySelector('.revelar-hint');
        if (hint) hint.innerHTML =
          '<span style="color:var(--accent)">✓ Autodiagnóstico</span> · ' +
          '<span style="color:var(--accent)">✓ Missões</span> · ' +
          '<span style="color:var(--accent)">✓ Kyber Game</span><br>Você completou as 3 etapas! Publique sua patente.';
      } else {
        revelarBtn.disabled = true;
        revelarBtn.style.opacity = '0.4';
        var hint = document.querySelector('.revelar-hint');
        if (hint) hint.innerHTML =
          (prog.autoDone ? '<span style="color:var(--accent)">✓' : '<span style="color:var(--ink-3)">✗') + ' Autodiagnóstico</span> · ' +
          (prog.missoesDone ? '<span style="color:var(--accent)">✓' : '<span style="color:var(--ink-3)">✗') + ' Missões</span> · ' +
          (prog.kyberDone ? '<span style="color:var(--accent)">✓' : '<span style="color:var(--ink-3)">✗') + ' Kyber Game</span><br>Complete as 3 etapas para revelar sua patente.';
      }
    }

    updateRevelarBtn();
    window.addEventListener('fa-player-registered', updateRevelarBtn);
    window.addEventListener('storage', updateRevelarBtn);

    if (revelarBtn) revelarBtn.addEventListener('click', function() {
      var p = getPlayer();
      if (!p || !p.name) {
        var btn = document.getElementById('openRegister');
        if (btn) btn.click();
        return;
      }
      var prog = checkProgress();
      if (!prog.allDone) return;
      var gxp   = getGameXP();
      var kxp   = getKyberXP();
      var cxp   = getContentXP();
      var rxp   = getRepoXP();
      var total = Math.min(100, gxp.xpAuto + gxp.xpMissoes + kxp + cxp + rxp);
      var patente = getRank(total);
      if (revelarPatente) revelarPatente.textContent = patente + ' · ' + total + ' XP';
      if (revelarConfirm) revelarConfirm.hidden = false;
    });

    if (revelarCancel) revelarCancel.addEventListener('click', function() {
      if (revelarConfirm) revelarConfirm.hidden = true;
    });

    if (revelarOk) revelarOk.addEventListener('click', function() {
      if (revelarConfirm) revelarConfirm.hidden = true;
      try { localStorage.setItem('fa-patente-revealed', '1'); } catch(e) {}
      window.faSyncPlayer();
      // troca botão por mensagem de confirmação
      var wrap = document.getElementById('revelarWrap');
      if (wrap) wrap.innerHTML =
        '<p style="font-family:var(--font-mono);font-size:.9rem;color:var(--accent);text-align:center;padding:24px">' +
        '✓ Patente publicada no ranking da galáxia!</p>';
      setTimeout(function() {
        var lb = document.getElementById('kyber-leaderboard');
        if (lb) lb.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 400);
    });

    // Register home ranking with router
    if (window.faRouter) {
      window.faRouter.onPageInit('home', function() {
        window.faRenderHomeRanking && window.faRenderHomeRanking();
      });
      // Página de ranking completo
      window.faRouter.onPageInit('ranking', function() {
        var list = document.getElementById('rankingPageList');
        if (!list) return;
        list.innerHTML = '<p style="color:var(--ink-3);font-size:.9rem">Carregando…</p>';
        if (!fbReady) { list.innerHTML = '<p style="color:var(--ink-3)">Firebase indisponível.</p>'; return; }
        firebase.database().ref('players').orderByChild('totalXP')
          .on('value', function(snapshot) {
            var data = snapshot.val();
            list.innerHTML = '';
            if (!data) {
              list.innerHTML = '<p style="color:var(--ink-3)">Nenhum agente no ranking ainda.</p>';
              return;
            }
            var players = Object.values(data).sort(function(a,b){ return (b.totalXP||0)-(a.totalXP||0); });
            var myEntry = null;
            try { myEntry = JSON.parse(localStorage.getItem('fa-my-entry')||'null'); } catch(e){}
            players.forEach(function(p, i) {
              var isMe = myEntry && p.name === myEntry.name;
              var row = document.createElement('div');
              row.className = 'rank-row' + (isMe ? ' highlight' : '');
              row.innerHTML =
                '<span class="rank-pos">#' + (i+1) + '</span>' +
                '<span class="rank-name">' + escHtml(p.name||'—') +
                  (p.area ? '<span class="rank-area">' + escHtml(p.area) + '</span>' : '') +
                '</span>' +
                (isMe ? '<span class="rank-patente" style="color:var(--accent);font-family:var(--font-mono);font-size:.75rem">' + escHtml(p.patente||'') + '</span>' : '') +
                '<span class="rank-score">' + (p.totalXP||0) + ' XP</span>';
              list.appendChild(row);
            });
          });
      });
    }
  });

})();
