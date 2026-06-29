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
    console.log('✅ Firebase inicializado!');
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
      if (window.faCleanRanking) window.faCleanRanking();
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

  // ---- Remove entrada do ranking se patente não foi publicada ----
  window.faCleanRanking = function() {
    if (!fbReady) return;
    const p = getPlayer();
    if (!p) return;
    const publicada = _st().getItem('fa-patente-publicada') === '1';
    if (!publicada) {
      const key = playerKey(p);
      if (key) firebase.database().ref('players/' + key).remove()
        .catch(function() {});
    }
  };

  // ---- Sync player record to Firebase ----
  window.faSyncPlayer = function() {
    const p = getPlayer();
    if (!p || !p.name) return;
    const gxp   = getGameXP();
    const cxp   = getContentXP();
    const rxp   = getRepoXP();
    const total = Math.min(100, gxp.xpQuiz + cxp + rxp);
    const entry = {
      name:      p.name,
      area:      p.area  || '',
      turma:     p.turma || '',
      xpQuiz:    gxp.xpQuiz,
      xpContent: cxp,
      xpRepo:    rxp,
      totalXP:   total,
      patente:   getRank(total),
      updatedAt: new Date().toISOString()
    };
    const key = playerKey(p);
    /* Só publica no ranking se a pessoa optou explicitamente por publicar (passo separado de revelar) */
    const publicada = _st().getItem('fa-patente-publicada') === '1';
    if (fbReady && publicada) {
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
    try { _st().setItem('fa-kyber-done', '1'); } catch(e) {}

    // converte score em XP (0–32)
    const kyberXP = Math.min(50, Math.round(gameState.totalScore / 20000 * 50));
    try { _st().setItem('fa-kyber-xp', String(kyberXP)); } catch(e) {}
    if (window.faSyncProgress) window.faSyncProgress();

    const p     = getPlayer() || { name: gameState.playerName || 'Agente', area: '', turma: '' };

    const go = document.getElementById('kyber-gameover');
    if (go) {
      const _state = (function() { try { return JSON.parse(_st().getItem('fa-game-v2') || 'null'); } catch(e) { return null; } })();
      const _autoDone = _state && _state.quiz && _state.quiz.filter(function(v){ return v != null; }).length === 6;
      const _missoesDone = _state && _state.missions && Object.keys(_state.missions).length === 6 &&
        Object.values(_state.missions).every(function(m){ return m && m.answers && m.answers.every(function(a){ return a !== null; }); });
      const _allDone = _autoDone && _missoesDone;

      go.style.display = 'block';
      go.innerHTML =
        '<div class="gameover-content">' +
          '<h3>Missão Completa!</h3>' +
          '<div class="gameover-score">Pontuação: <strong>' + gameState.totalScore + ' pts</strong></div>' +
          '<div class="gameover-rank">+' + kyberXP + ' pts Kyber</div>' +
          '<div class="gameover-rank" style="font-size:.85rem;opacity:.7">' + p.name + (p.turma ? ' · ' + p.turma : '') + '</div>' +
          '<div class="gameover-actions">' +
            (_allDone ? '<button class="btn btn--primary" onclick="var r=document.getElementById(\'revelarWrap\');if(r)r.scrollIntoView({behavior:\'smooth\',block:\'center\'})">Revelar minha Patente Final</button>' : '') +
          '</div>' +
        '</div>';
    }

    // Botão ver patente na escada
    const _verBtn = document.getElementById('kyberVerPatente');
    if (_verBtn) {
      _verBtn.addEventListener('click', function() {
        if (_allDone) {
          const l = document.getElementById('ladder');
          if (l) l.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          const msg = document.getElementById('kyberVerPatenteMsg');
          if (msg) msg.style.display = msg.style.display === 'none' ? 'block' : 'none';
        }
      });
    }

    // XP do kyber salvo localmente — Firebase sincroniza só ao clicar "Revelar Patente"
    window.kyberRenderRanking();

    setTimeout(function() {
      if (typeof window.faGameRender === 'function') window.faGameRender();
    }, 300);
  };

  // ---- Ranking ----
  window.kyberRenderRanking = function() {
    const list = document.getElementById('kyber-leaderboard');
    if (!list) return;
    list.innerHTML = '<h4>🏆 Resultado do Kyber Game</h4><p style="color:var(--ink-3);font-size:.9rem">Carregando…</p>';

    function renderRows(players) {
      list.innerHTML = '<h4>🏆 Ranking da Galáxia</h4>';
      let myEntry = null;
      try { myEntry = JSON.parse(localStorage.getItem('fa-my-entry') || 'null'); } catch(e) {}

      if (!players.length) {
        list.innerHTML += '<p style="color:var(--ink-3);font-size:.85rem">Nenhum agente registrado ainda.</p>';
        return;
      }
      players.forEach(function(e, i) {
        const isMe = myEntry && e.name === myEntry.name && e.area === myEntry.area;
        const row = document.createElement('div');
        row.className = 'rank-row' + (isMe ? ' highlight' : '');
        // patente visível só para a própria pessoa
        const patenteHtml = isMe
          ? '<span class="rank-patente" style="color:var(--accent);font-family:var(--font-mono);font-size:.75rem">' + (e.patente || '') + '</span>'
          : '';
        row.innerHTML =
          '<span class="rank-pos">#' + (i + 1) + '</span>' +
          '<span class="rank-name">' + e.name +
            (e.area ? '<span class="rank-area">' + e.area + '</span>' : '') +
          '</span>' +
          '<span class="rank-patente-col">' +
            rankSvg(e.patente || '') +
            patenteHtml +
            '<span class="rank-score">' + (e.totalXP || 0) + ' pts</span>' +
          '</span>';
        list.appendChild(row);
      });
    }

    if (fbReady) {
      firebase.database().ref('players')
        .orderByChild('totalXP').on('value', function(snapshot) {
          const data = snapshot.val();
          const players = data ? Object.values(data) : [];
          players.sort(function(a, b) { return (b.totalXP || 0) - (a.totalXP || 0); });
          renderRows(players.slice(0, 20));
        });
    } else {
      try {
        const mine = JSON.parse(localStorage.getItem('fa-my-entry') || 'null');
        renderRows(mine ? [mine] : []);
      } catch(e) { renderRows([]); }
    }
  };

  // ---- Kyber bloqueado se já jogou ----
  window.kyberAlreadyPlayed = function() {
    return _st().getItem('fa-kyber-done') === '1';
  };

  // ---- Exposto para testes: XP total (quiz + conteúdos + repositório) ----
  window.faGetTotalXP = function() {
    var gxp = getGameXP();
    return Math.min(100, gxp.xpQuiz + getContentXP() + getRepoXP());
  };

  // ---- Home ranking mini (top 5) ----
  window.faRenderHomeRanking = function() {
    const list = document.getElementById('homeRanking');
    if (!list) return;
    list.innerHTML = '<p style="color:var(--ink-3);font-size:.82rem">Carregando…</p>';
    if (!fbReady) {
      list.innerHTML = '<p style="color:var(--ink-3);font-size:.82rem">Seja o primeiro no ranking!</p>';
      return;
    }
    firebase.database().ref('players').orderByChild('totalXP').limitToLast(5)
      .on('value', function(snapshot) {
        const data = snapshot.val();
        list.innerHTML = '';
        if (!data) {
          list.innerHTML = '<p style="color:var(--ink-3);font-size:.82rem">Seja o primeiro no ranking!</p>';
          return;
        }
        const players = Object.values(data).sort(function(a,b) { return (b.totalXP||0) - (a.totalXP||0); });
        players.slice(0, 5).forEach(function(p, i) {
          const row = document.createElement('div');
          row.className = 'rank-row';
          row.innerHTML =
            '<span class="rank-pos">#' + (i+1) + '</span>' +
            '<span class="rank-name">' + escHtml(p.name || '—') +
              (p.area ? '<span class="rank-area">' + escHtml(p.area) + '</span>' : '') +
            '</span>' +
            '<span class="rank-patente-col">' +
              rankSvg(p.patente || getRank(p.totalXP || 0)) +
              '<span class="rank-score">' + (p.totalXP || 0) + ' pts</span>' +
            '</span>';
          list.appendChild(row);
        });
      });
  };

  // ---- Revelar Patente Final ----
  document.addEventListener('DOMContentLoaded', function() {
    kyberRenderRanking();

    const revelarBtn    = document.getElementById('revelarBtn');
    const revelarModal  = document.getElementById('revelarModal');
    const revelarModalOk= document.getElementById('revelarModalOk');

    function checkProgress() {
      try {
        const state = JSON.parse(_st().getItem('fa-game-v3') || 'null');
        const dims = (window.faGameData && window.faGameData.DIMS && window.faGameData.DIMS.length) || 12;
        const quizDone = state && state.quiz && state.quiz.filter(function(v){ return v != null; }).length === dims;
        return { quizDone: quizDone, allDone: quizDone };
      } catch(e) { return { quizDone: false, allDone: false }; }
    }

    function updateRevelarBtn() {
      if (!revelarBtn) return;
      const prog = checkProgress();
      if (prog.allDone) {
        revelarBtn.disabled = false;
        revelarBtn.style.opacity = '';
        revelarBtn.title = '';
        delete revelarBtn.dataset.locked;
        let hint = document.querySelector('.revelar-hint');
        if (hint) hint.innerHTML =
          '<span style="color:var(--accent)">✓ Quiz (autodiagnóstico)</span><br>Você completou o quiz! Revele sua patente.';
      } else {
        revelarBtn.disabled = false;
        revelarBtn.style.opacity = '0.45';
        revelarBtn.dataset.locked = '1';
        const hint = document.querySelector('.revelar-hint');
        if (hint) hint.innerHTML =
          '<span style="color:var(--ink-3)">✗ Quiz (autodiagnóstico)</span><br>Complete o quiz para revelar sua patente.';
      }
    }

    // ---- Pós-revelação: patente fixada, publicação no ranking é etapa separada e opcional ----
    function currentTotalEPatente() {
      const gxp = getGameXP();
      const cxp = getContentXP();
      const rxp = getRepoXP();
      const total = Math.min(100, gxp.xpQuiz + cxp + rxp);
      return { total: total, patente: getRank(total) };
    }

    function renderRevealedState() {
      const wrap = document.getElementById('revelarWrap');
      if (!wrap) return;
      const tp = currentTotalEPatente();
      const publicada = _st().getItem('fa-patente-publicada') === '1';
      const status = publicada ? '🌐 Publicada no ranking da galáxia!' : '🔒 Resultado privado — não publicado no ranking.';
      // Oculta botão e hint, preservando-os no DOM para testes e re-renders
      if (revelarBtn) revelarBtn.hidden = true;
      const hint = wrap.querySelector('.revelar-hint');
      if (hint) hint.hidden = true;
      // Atualiza ou cria o parágrafo de estado
      let msg = document.getElementById('revelarStateMsg');
      if (!msg) {
        msg = document.createElement('p');
        msg.id = 'revelarStateMsg';
        msg.style.cssText = 'font-family:var(--font-mono);font-size:.9rem;color:var(--accent);text-align:center;padding:24px';
        wrap.appendChild(msg);
      }
      msg.innerHTML = '✓ Patente revelada: <strong>' + tp.patente + ' · ' + tp.total + ' pts</strong><br>' +
        '<span style="color:var(--ink-3);font-size:.8rem">' + status + '</span>';
      msg.hidden = false;
    }

    function refreshRevelarUI() {
      if (_st().getItem('fa-patente-revealed') === '1') {
        renderRevealedState();
      } else {
        // Restaura botão e hint ao estado normal
        if (revelarBtn) revelarBtn.hidden = false;
        const wrap = document.getElementById('revelarWrap');
        const hint = wrap && wrap.querySelector('.revelar-hint');
        if (hint) hint.hidden = false;
        const msg = document.getElementById('revelarStateMsg');
        if (msg) msg.hidden = true;
        updateRevelarBtn();
      }
    }

    refreshRevelarUI();
    window.addEventListener('fa-player-registered', refreshRevelarUI);
    window.addEventListener('fa-auth-change', refreshRevelarUI);
    window.addEventListener('fa-progress-change', refreshRevelarUI);
    window.addEventListener('storage', refreshRevelarUI);

    function openRevelarModal() {
      const tp = currentTotalEPatente();
      const ranks = (window.faGameData && window.faGameData.RANKS) || [];
      const rank = ranks.find(function(r) { return r.name === tp.patente; }) || ranks[0];
      const charUse = document.getElementById('rmodalCharUse');
      const rankEl  = document.getElementById('rmodalRank');
      const check   = document.getElementById('revelarPublicarCheck');
      if (charUse && rank) charUse.setAttribute('href', rank.sym);
      if (rankEl) rankEl.textContent = tp.patente + ' · ' + tp.total + ' pts';
      if (check) check.checked = true;
      if (revelarModal) revelarModal.hidden = false;
      document.body.style.overflow = 'hidden';
    }

    function closeRevelarModal() {
      if (revelarModal) revelarModal.hidden = true;
      document.body.style.overflow = '';
    }

    if (revelarBtn) revelarBtn.addEventListener('click', function() {
      if (revelarBtn.dataset.locked === '1') {
        const hint = document.querySelector('.revelar-hint');
        if (hint) {
          hint.style.transition = 'color .2s';
          hint.style.color = 'var(--accent)';
          setTimeout(function() { hint.style.color = ''; }, 1200);
        }
        return;
      }
      const p = getPlayer();
      if (!p || !p.name) {
        const btn = document.getElementById('openRegister');
        if (btn) btn.click();
        return;
      }
      const prog = checkProgress();
      if (!prog.allDone) return;
      openRevelarModal();
    });

    if (revelarModal) revelarModal.addEventListener('click', function(e) {
      if (e.target === revelarModal) closeRevelarModal();
    });

    if (revelarModalOk) revelarModalOk.addEventListener('click', function() {
      const publicar = document.getElementById('revelarPublicarCheck');
      closeRevelarModal();
      try { _st().setItem('fa-patente-revealed', '1'); } catch(e) {}
      if (window.faSyncProgress) window.faSyncProgress();
      if (publicar && publicar.checked) {
        try { _st().setItem('fa-patente-publicada', '1'); } catch(e) {}
        if (window.faSyncProgress) window.faSyncProgress();
        window.faSyncPlayer();
      }
      renderRevealedState();
    });

    // Register home ranking with router
    if (window.faRouter) {
      window.faRouter.onPageInit('home', function() {
        window.faRenderHomeRanking && window.faRenderHomeRanking();
      });
      // Página de ranking completo
      window.faRouter.onPageInit('ranking', function() {
        const list = document.getElementById('rankingPageList');
        if (!list) return;
        list.innerHTML = '<p style="color:var(--ink-3);font-size:.9rem">Carregando…</p>';
        if (!fbReady) { list.innerHTML = '<p style="color:var(--ink-3)">Firebase indisponível.</p>'; return; }
        firebase.database().ref('players').orderByChild('totalXP')
          .on('value', function(snapshot) {
            const data = snapshot.val();
            list.innerHTML = '';
            if (!data) {
              list.innerHTML = '<p style="color:var(--ink-3)">Nenhum agente no ranking ainda.</p>';
              return;
            }
            const players = Object.values(data).sort(function(a,b){ return (b.totalXP||0)-(a.totalXP||0); });
            let myEntry = null;
            try { myEntry = JSON.parse(localStorage.getItem('fa-my-entry')||'null'); } catch(e){}
            players.forEach(function(p, i) {
              const isMe = myEntry && p.name === myEntry.name;
              const row = document.createElement('div');
              row.className = 'rank-row' + (isMe ? ' highlight' : '');
              row.innerHTML =
                '<span class="rank-pos">#' + (i+1) + '</span>' +
                '<span class="rank-name">' + escHtml(p.name||'—') +
                  (p.area ? '<span class="rank-area">' + escHtml(p.area) + '</span>' : '') +
                '</span>' +
                '<span class="rank-patente-col">' +
                  rankSvg(p.patente || getRank(p.totalXP || 0)) +
                  '<span class="rank-patente" style="color:var(--accent);font-family:var(--font-mono);font-size:.75rem">' + escHtml(p.patente || getRank(p.totalXP || 0)) + '</span>' +
                  '<span class="rank-score">' + (p.totalXP||0) + ' pts</span>' +
                '</span>';
              list.appendChild(row);
            });
          });
      });
    }
  });

})();
