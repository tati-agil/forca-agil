/* ============================================================
   Força Ágil — Firebase
   Registro unificado: autodiagnóstico + missões + kyber game
   ============================================================ */
(function () {

  const firebaseConfig = {
    apiKey:      "AIzaSyAmnQTedd2eqL0d-3kMD2oWNeg0rwP6Lx0",
    authDomain:  "kyber-agil.firebaseapp.com",
    databaseURL: "https://kyber-agil-default-rtdb.firebaseio.com",
    projectId:   "kyber-agil"
  };

  let fbReady = false;
  try {
    firebase.initializeApp(firebaseConfig);
    fbReady = true;
  } catch (err) {
    console.warn('⚠️ Firebase:', err.message);
  }

  // ---- Ranks ----
  const RANKS = [
    { name: 'Youngling', min: 0  },
    { name: 'Padawan',   min: 25 },
    { name: 'Cavaleiro', min: 50 },
    { name: 'Mestre',    min: 75 }
  ];
  const RANK_SYMS = { Youngling: '#char-0', Padawan: '#char-1', Cavaleiro: '#char-2', Mestre: '#char-3' };
  function rankSvg(patente) {
    var sym = RANK_SYMS[patente] || '#char-0';
    return '<svg class="rank-char-img" viewBox="0 0 120 220" width="24" height="44" aria-hidden="true"><use href="' + sym + '"/></svg>';
  }
  function getRank(xp) {
    let r = RANKS[0];
    for (let i = 0; i < RANKS.length; i++) { if (xp >= RANKS[i].min) r = RANKS[i]; }
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
  function _st() { return window.faStore || localStorage; }
  function getGameXP() {
    try {
      const s = JSON.parse(_st().getItem('fa-game-v3') || 'null');
      if (!s) return { xpQuiz: 0 };
      const xpQuiz = (s.quiz || []).reduce(function(sum, v) { return sum + (v != null ? +v : 0); }, 0);
      return { xpQuiz: xpQuiz };
    } catch(e) { return { xpQuiz: 0 }; }
  }
  function getKyberXP()   { return parseInt(_st().getItem('fa-kyber-xp')   || '0', 10) || 0; }
  function getContentXP() { return parseInt(_st().getItem('fa-content-xp') || '0', 10) || 0; }
  function getRepoXP()    { return parseInt(_st().getItem('fa-repo-xp')    || '0', 10) || 0; }

  function escHtml(s) {
    return String(s || '').replace(/[&<>"]/g, function(c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }

  // ---- Sync progress to Firebase (para restaurar em qualquer browser) ----
  const _PROGRESS_KEYS = ['fa-game-v3',
                        'fa-patente-revealed','fa-patente-publicada','fa-content-read','fa-content-xp','fa-repo-xp'];
  window.faSyncProgress = function() {
    if (!fbReady) return;
    let p = getPlayer();
    if (!p || !p.email) {
      const sess = window.faAuth && window.faAuth.getSession && window.faAuth.getSession();
      if (!sess || !sess.email) return;
      p = sess;
    }
    const st = _st();
    const data = { updatedAt: new Date().toISOString() };
    _PROGRESS_KEYS.forEach(function(k) {
      var v = st.getItem(k);
      if (v !== null) data[k.replace(/-/g, '_')] = v;
    });
    const eKey = (p.email || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
    firebase.database().ref('fa-progress/' + eKey).set(data)
      .catch(function(e) { console.warn('faSyncProgress error:', e); });
    window.dispatchEvent(new CustomEvent('fa-progress-change'));
  };

  // ---- Load progress from Firebase on login ----
  var _progressWatchRef = null;
  var _resetSignalRef   = null;
  window.faLoadProgress = function(email, cb) {
    if (!fbReady) { if (cb) cb(); return; }
    const eKey = (email || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);

    /* Desativa listeners anteriores (troca de conta) */
    if (_progressWatchRef) { try { _progressWatchRef.off(); } catch(e) {} }
    if (_resetSignalRef)   { try { _resetSignalRef.off();   } catch(e) {} }

    const ref = firebase.database().ref('fa-progress/' + eKey);
    _progressWatchRef = ref;

    /* Leitura única do progresso ao fazer login */
    ref.once('value', function(snap) {
      const data = snap.val();
      if (data && window.faStore) {
        _PROGRESS_KEYS.forEach(function(k) {
          const fk = k.replace(/-/g, '_');
          if (data[fk] != null) window.faStore.setItem(k, data[fk]);
        });
      } else if (!data && window.faStore) {
        _PROGRESS_KEYS.forEach(function(k) {
          window.faStore.removeItem(k);
          try { localStorage.removeItem(k); } catch(e) {}
        });
      }
      if (cb) cb();

      /* Agora inicia listener de sinal de reset (nó separado — mais confiável) */
      var signalInitialDone = false;
      const signalRef = firebase.database().ref('fa-reset-signal/' + eKey);
      _resetSignalRef = signalRef;
      signalRef.on('value', function(sigSnap) {
        if (!signalInitialDone) { signalInitialDone = true; return; } // ignora leitura inicial
        if (sigSnap.val() !== null) {
          /* Admin resetou — limpa localStorage e recarrega */
          if (window.faStore) {
            _PROGRESS_KEYS.forEach(function(k) {
              window.faStore.removeItem(k);
              try { localStorage.removeItem(k); } catch(e) {}
            });
          }
          window.location.reload();
        }
      });
    }, function() { if (cb) cb(); });
  };

  // ---- Ranking foi removido — mantido como no-op para não quebrar chamadas existentes (app.js, repo.js) ----
  window.faSyncPlayer = function() {};

  // ---- Exposto para testes: XP total (quiz + conteúdos + repositório) ----
  window.faGetTotalXP = function() {
    var gxp = getGameXP();
    return Math.min(100, gxp.xpQuiz + getContentXP() + getRepoXP());
  };

  // (Ranking, Kyber Game e o modal "Revelar Patente" com opção de publicar
  // foram removidos — v3 usa apenas o fluxo simples em game.js, sem publicar nada.)

})();
