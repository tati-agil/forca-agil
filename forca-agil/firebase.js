/* ============================================================
   Força Ágil — Firebase
   Config, save score, ranking em tempo real.
   Depende de: firebase-app-compat.js + firebase-database-compat.js (CDN)
   e de kyber.js (gameState deve existir no escopo global)
   ============================================================ */

(function () {

  // ---- Config ----
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

  // ---- Helpers internos ----
  function saveLocal(entry) {
    try {
      var list = JSON.parse(localStorage.getItem('kyber-ranking') || '[]');
      list.push(entry);
      list.sort(function(a, b) { return b.score - a.score; });
      localStorage.setItem('kyber-ranking', JSON.stringify(list.slice(0, 10)));
    } catch (e) { /* ignore */ }
  }

  function renderRows(rankings, list) {
    list.innerHTML = '<h4>🏆 Top Heróis da Galáxia</h4>';
    var currentName = (typeof gameState !== 'undefined') ? gameState.playerName : '';
    rankings.forEach(function(e, i) {
      var row = document.createElement('div');
      row.className = 'rank-row' + (e.name === currentName ? ' highlight' : '');
      var tags = '';
      if (e.turma) tags += '<span class="rank-turma">' + e.turma + '</span>';
      if (e.area)  tags += '<span class="rank-area">'  + e.area  + '</span>';
      row.innerHTML =
        '<span class="rank-pos">#' + (i + 1) + '</span>' +
        '<span class="rank-name">' + e.name + tags + '</span>' +
        '<span class="rank-score">' + e.score + ' pts</span>';
      list.appendChild(row);
    });
  }

  // ---- Expõe globalmente para kyber.js chamar ----

  window.kyberFinishGame = function() {
    clearInterval(gameState.timerInterval);
    document.getElementById('kyber-challenge').style.display = 'none';

    var entry = {
      name:  gameState.playerName,
      area:  gameState.playerArea  || '',
      turma: gameState.playerTurma || '',
      score: gameState.totalScore,
      date:  new Date().toISOString()
    };

    // Tela de game over
    var go = document.getElementById('kyber-gameover');
    if (go) {
      go.style.display = 'block';
      var rankLabel = entry.score >= 20000 ? 'Mestre Jedi' :
                      entry.score >= 15000 ? 'Cavaleiro'   :
                      entry.score >= 8000  ? 'Padawan'     : 'Youngling';
      go.innerHTML =
        '<div class="gameover-content">' +
          '<h3>Missão Completa!</h3>' +
          '<div class="gameover-score">Pontuação final: <strong>' + entry.score + ' pts</strong></div>' +
          '<div class="gameover-rank">Patente: <strong>' + rankLabel + '</strong></div>' +
          '<div class="gameover-rank">Agente: <strong>' + entry.name + '</strong>' +
            (entry.turma ? ' · ' + entry.turma : '') +
            (entry.area  ? ' · ' + entry.area  : '') +
          '</div>' +
          '<div class="gameover-actions">' +
            '<button class="btn btn--primary" onclick="location.reload()">↺ Nova missão</button>' +
            '<a class="btn" href="#kyber">Ver ranking</a>' +
          '</div>' +
        '</div>';
    }

    // Salvar
    if (fbReady) {
      firebase.database().ref('rankings').push(entry)
        .then(function() { console.log('✅ Score salvo no Firebase'); })
        .catch(function(err) { console.warn('Firebase save error:', err); saveLocal(entry); });
    } else {
      saveLocal(entry);
    }

    kyberRenderRanking();
  };

  window.kyberRenderRanking = function() {
    var list = document.getElementById('kyber-leaderboard');
    if (!list) return;
    list.innerHTML = '<h4>🏆 Top Heróis da Galáxia</h4><p style="color:var(--ink-3);font-size:.9rem">Carregando…</p>';

    if (fbReady) {
      firebase.database().ref('rankings')
        .orderByChild('score').limitToLast(100)
        .on('value', function(snapshot) {
          var data = snapshot.val();
          var rankings = data ? Object.values(data) : [];
          rankings.sort(function(a, b) { return b.score - a.score; });
          renderRows(rankings.slice(0, 10), list);
        });
    } else {
      var local = JSON.parse(localStorage.getItem('kyber-ranking') || '[]');
      renderRows(local, list);
    }
  };

  // Carrega ranking assim que o DOM estiver pronto
  document.addEventListener('DOMContentLoaded', function() {
    kyberRenderRanking();
  });

})();
