/* ============================================================
   Força Ágil — Autodiagnóstico Likert (v3-quiz)
   Patente determinada pela pontuação 0-60 do quiz.
   ============================================================ */
(function () {
  const STORE = 'fa-game-v3';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const { BLOCOS, LEVELS, RANKS } = window.faGameData;
  const TOTAL_AFIRM = BLOCOS.reduce((acc, b) => acc + b.afirmacoes.length, 0);
  const DIAG_MAX = TOTAL_AFIRM * 3; // 60

  // ---- State ----
  let state = { quiz: Array(TOTAL_AFIRM).fill(null), revealed: false };
  try {
    const saved = JSON.parse((window.faStore || localStorage).getItem(STORE) || 'null');
    if (saved && Array.isArray(saved.quiz) && saved.quiz.length === TOTAL_AFIRM) {
      state = { quiz: saved.quiz, revealed: !!saved.revealed };
    }
  } catch (e) {}

  function save() {
    try { (window.faStore || localStorage).setItem(STORE, JSON.stringify(state)); } catch (e) {}
    if (window.faSyncProgress) window.faSyncProgress();
  }

  function getPlayer() {
    try { return JSON.parse(localStorage.getItem('fa-player') || 'null') || {}; } catch(e) { return {}; }
  }
  function requirePlayer() {
    const p = getPlayer();
    if (p && p.name) return true;
    const btn = document.getElementById('openRegister');
    if (btn) btn.click();
    return false;
  }

  // ---- Compute ----
  function diagScore() {
    return state.quiz.reduce((acc, v) => acc + (v != null ? v : 0), 0);
  }
  function diagRankIdx() {
    const score = diagScore();
    let idx = 0;
    for (let i = 0; i < RANKS.length; i++) if (score >= RANKS[i].minDiag) idx = i;
    return idx;
  }
  function quizDone() {
    return state.quiz.filter(v => v != null).length === TOTAL_AFIRM;
  }

  // ---- DOM refs ----
  const $ = id => document.getElementById(id);
  const qList       = $('qList');
  const quizResult  = $('quizResult');
  const rankHud     = $('rankHud');
  const hudName     = $('hudName');
  const hudTag      = $('hudTag');
  const hudAvatar   = $('hudAvatar');

  // ---- Build quiz por blocos ----
  if (qList) {
    const scaleHint = document.createElement('div');
    scaleHint.className = 'q-scale-hint';
    scaleHint.innerHTML = LEVELS.map((lv, i) => '<span>' + i + ' = ' + lv + '</span>').join('');
    qList.appendChild(scaleHint);

    let globalIdx = 0;
    BLOCOS.forEach(bloco => {
      const blocoEl = document.createElement('div');
      blocoEl.className = 'q-bloco';
      const blocoTitle = document.createElement('div');
      blocoTitle.className = 'q-bloco-title';
      blocoTitle.textContent = bloco.icon + ' ' + bloco.label;
      blocoEl.appendChild(blocoTitle);

      bloco.afirmacoes.forEach((afirm, localIdx) => {
        const qi = globalIdx++;
        const item = document.createElement('div');
        item.className = 'q-item';

        const label = document.createElement('div');
        label.className = 'q-label';
        label.textContent = (localIdx + 1) + '. ' + afirm;

        const opts = document.createElement('div');
        opts.className = 'q-opts q-opts--likert';
        LEVELS.forEach((lv, li) => {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'q-opt'; b.title = lv;
          b.dataset.q = qi; b.dataset.v = li;
          b.innerHTML = '<span class="q-opt-num">' + li + '</span><span class="q-opt-lbl">' + lv + '</span>';
          b.addEventListener('click', () => {
            if (!requirePlayer()) return;
            if (state.revealed) return;
            state.quiz[qi] = li;
            save();
            render();
          });
          opts.appendChild(b);
        });

        item.appendChild(label);
        item.appendChild(opts);
        blocoEl.appendChild(item);
      });
      qList.appendChild(blocoEl);
    });
  }

  // ---- Render ----
  function render() {
    const done = quizDone();
    const answered = state.quiz.filter(v => v != null).length;
    const ri = diagRankIdx();
    const rank = RANKS[ri];

    // quiz opts — marca selecionados
    qList && qList.querySelectorAll('.q-opt').forEach(b => {
      b.classList.toggle('sel', state.quiz[+b.dataset.q] === +b.dataset.v);
      b.disabled = state.revealed;
    });

    // HUD avatar
    if (hudAvatar) {
      const use = hudAvatar.querySelector('use');
      if (use) use.setAttribute('href', rank.sym || '#char-0');
    }
    if (hudName) hudName.textContent = rank.name;
    if (hudTag)  hudTag.textContent  = rank.tag;

    // ladder cards
    document.querySelectorAll('.char-card').forEach(card => {
      const i = +card.dataset.rank;
      card.classList.toggle('active', i === ri);
      card.classList.toggle('locked', i > ri || !done);
    });

    // quiz result area
    if (quizResult) {
      if (done) {
        renderReveal(ri);
      } else {
        quizResult.textContent = answered + '/' + TOTAL_AFIRM + ' afirmações respondidas';
      }
    }
  }

  function renderReveal(ri) {
    const rank = RANKS[ri];
    const score = diagScore();
    quizResult.innerHTML =
      '<div class="diag-result">' +
        '<svg class="diag-result-img" viewBox="0 0 120 220"><use href="' + (rank.sym || '#char-0') + '"/></svg>' +
        '<div class="diag-result-score">' + score + '<span>/60</span></div>' +
        '<div class="diag-result-rank">' + rank.icon + ' ' + rank.name + ' — ' + rank.tag + '</div>' +
        '<div class="diag-result-desc">' + rank.desc + '</div>' +
        '<ul class="diag-result-carac">' +
          rank.carac.map(c => '<li>' + c + '</li>').join('') +
        '</ul>' +
        '<div class="diag-result-proximo-titulo">Próximos passos:</div>' +
        '<ul class="diag-result-proximo">' +
          rank.proximo.map(p => '<li>' + p + '</li>').join('') +
        '</ul>' +
        '<div class="diag-result-frase">' + rank.frase + '</div>' +
        '<p style="font-family:var(--font-mono);font-size:.7rem;color:var(--ink-3);margin-top:10px">🔒 Autodiagnóstico concluído — não pode ser refeito.</p>' +
      '</div>';
    if (!reduce && rankHud) {
      rankHud.classList.remove('levelup'); void rankHud.offsetWidth; rankHud.classList.add('levelup');
    }
  }

  // ---- Welcome screen vs game content ----
  (function () {
    var welcome  = document.getElementById('treinamento-welcome');
    var gameWrap = document.getElementById('treinamento');
    function updateVisibility() {
      var sess = window.faAuth && window.faAuth.getSession && window.faAuth.getSession();
      if (welcome)  welcome.hidden  = !!sess;
      if (gameWrap) gameWrap.hidden = !sess;
    }
    updateVisibility();
    window.addEventListener('fa-auth-change', updateVisibility);
    var jedBtn = document.getElementById('jedWelcomeBtn');
    if (jedBtn) jedBtn.addEventListener('click', function () {
      if (window.faOpenAuthModal) window.faOpenAuthModal('login');
    });
  })();

  window.faGameRender = render;
  window.faGameReload = function () {
    try {
      const saved = JSON.parse((window.faStore || localStorage).getItem(STORE) || 'null');
      state = (saved && Array.isArray(saved.quiz) && saved.quiz.length === TOTAL_AFIRM)
        ? { quiz: saved.quiz, revealed: !!saved.revealed }
        : { quiz: Array(TOTAL_AFIRM).fill(null), revealed: false };
    } catch (e) { state = { quiz: Array(TOTAL_AFIRM).fill(null), revealed: false }; }
    render();
  };

  render();
})();
