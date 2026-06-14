/* Operação Kyber Ágil — Minigame com Timer, Pontuação e Ranking */
(function () {
  const STORE_KEY = 'kyber-game-v1';
  const STORE_RANK = 'kyber-ranking-v1';
  const TIME_LIMIT = 30; // segundos
  const MAX_CHALLENGES = 25;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let gameState = {
    currentChallenge: 0,
    totalScore: 0,
    answered: false,
    selectedOption: null,
    timeLeft: TIME_LIMIT,
    timerRunning: false,
    playerName: null,
    gameOver: false
  };

  let rankings = [];

  function _st() { return window.faStore || localStorage; }

  // Load rankings from localStorage
  function loadRankings() {
    try {
      rankings = JSON.parse(_st().getItem(STORE_RANK) || '[]');
    } catch (e) {
      rankings = [];
    }
  }

  function saveRankings() {
    try {
      _st().setItem(STORE_RANK, JSON.stringify(rankings));
    } catch (e) {}
  }

  function saveGameState() {
    try {
      _st().setItem(STORE_KEY, JSON.stringify(gameState));
    } catch (e) {}
  }

  function loadGameState() {
    try {
      const saved = JSON.parse(_st().getItem(STORE_KEY) || 'null');
      if (saved) gameState = saved;
    } catch (e) {}
  }

  // DOM refs
  const kyberArena = document.getElementById('kyber-arena');
  const kyberChallenge = document.getElementById('kyber-challenge');
  const kyberSituation = document.getElementById('kyber-situation');
  const kyberContext = document.getElementById('kyber-context');
  const kyberOptions = document.getElementById('kyber-options');
  const kyberTimer = document.getElementById('kyber-timer');
  const kyberScore = document.getElementById('kyber-score');
  const kyberProgress = document.getElementById('kyber-progress');
  const kyberFeedback = document.getElementById('kyber-feedback');
  const kyberRanking = document.getElementById('kyber-ranking');
  const kyberStartBtn = document.getElementById('kyber-start');
  const kyberNextBtn = document.getElementById('kyber-next');
  const kyberFinishBtn = document.getElementById('kyber-finish');
  const kyberNameInput = document.getElementById('kyber-player-name');
  const kyberLeaderboard = document.getElementById('kyber-leaderboard');
  const kyberGameOver = document.getElementById('kyber-gameover');

  if (!kyberArena || !kyberChallenge) return;

  loadGameState();
  loadRankings();

  // Ordem embaralhada das questões — gerada uma vez por sessão
  let challengeOrder = [];
  function shuffleChallenges() {
    challengeOrder = KYBER_CHALLENGES.map((_, i) => i).sort(() => Math.random() - 0.5);
  }

  // Start game
  function startGame() {
    if (!kyberNameInput || !kyberNameInput.value.trim()) {
      alert('Digite seu nome, Agente da Resistência!');
      return;
    }
    gameState.playerName = kyberNameInput.value.trim();
    gameState.currentChallenge = 0;
    gameState.totalScore = 0;
    gameState.gameOver = false;
    shuffleChallenges();
    kyberArena.classList.add('active');
    showChallenge();
  }

  // Show challenge
  function showChallenge() {
    if (gameState.currentChallenge >= MAX_CHALLENGES) {
      finishGame();
      return;
    }

    gameState.answered = false;
    gameState.selectedOption = null;
    gameState.timeLeft = TIME_LIMIT;
    saveGameState();

    const ch = KYBER_CHALLENGES[challengeOrder[gameState.currentChallenge]];
    kyberSituation.textContent = ch.situation;
    kyberContext.textContent = ch.context;
    kyberProgress.textContent = `Desafio ${gameState.currentChallenge + 1}/${MAX_CHALLENGES}`;
    kyberScore.textContent = `Pontuação: ${gameState.totalScore} pts`;

    // Embaralha alternativas aleatoriamente
    const shuffled = ch.options.slice().sort(() => Math.random() - 0.5);

    kyberOptions.innerHTML = '';
    shuffled.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'kyber-option';
      btn.innerHTML = `<span class="opt-letter">${String.fromCharCode(65 + idx)}</span><span class="opt-text">${opt.text}</span>`;
      btn.addEventListener('click', () => answerQuestion(idx, opt));
      kyberOptions.appendChild(btn);
    });

    kyberFeedback.innerHTML = '';
    kyberFeedback.classList.remove('correct', 'wrong');
    kyberTimer.textContent = gameState.timeLeft + 's';
    kyberTimer.classList.remove('warning', 'danger');
    kyberNextBtn.style.display = 'none';

    startTimer();
  }

  // Timer logic
  let timerInterval = null;
  function startTimer() {
    if (reduce) return;
    gameState.timerRunning = true;
    timerInterval = setInterval(() => {
      gameState.timeLeft--;
      kyberTimer.textContent = gameState.timeLeft + 's';

      if (gameState.timeLeft <= 10) kyberTimer.classList.add('warning');
      if (gameState.timeLeft <= 5) kyberTimer.classList.add('danger');

      if (gameState.timeLeft <= 0) {
        clearInterval(timerInterval);
        if (!gameState.answered) timeoutQuestion();
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    gameState.timerRunning = false;
  }

  // Answer question
  function answerQuestion(idx, option) {
    if (gameState.answered) return;
    gameState.answered = true;
    gameState.selectedOption = idx;
    stopTimer();

    const speedBonus = Math.max(0, (gameState.timeLeft / TIME_LIMIT) * 500);
    const points = option.correct ? Math.round(1000 * (gameState.timeLeft / TIME_LIMIT)) : 0;

    gameState.totalScore += points;
    saveGameState();

    // Feedback
    kyberFeedback.classList.add(option.correct ? 'correct' : 'wrong');
    kyberFeedback.innerHTML = `
      <div class="fb-result">${option.correct ? '✓ CORRETO' : '✗ ERRADO'}</div>
      <div class="fb-points">${points > 0 ? '+' + points + ' XP' : '0 XP'}</div>
      <div class="fb-agile">${option.agile}</div>
    `;

    // Highlight options — usa o texto da opção correta para identificar posição após embaralhamento
    document.querySelectorAll('.kyber-option').forEach((btn, i) => {
      if (i === idx) btn.classList.add(option.correct ? 'selected-correct' : 'selected-wrong');
      else if (btn.querySelector('.opt-text').textContent === KYBER_CHALLENGES[challengeOrder[gameState.currentChallenge]].options.find(o => o.correct).text) {
        btn.classList.add('correct-answer');
      }
    });

    kyberScore.textContent = `Pontuação: ${gameState.totalScore} pts`;
    kyberNextBtn.style.display = 'inline-block';
  }

  function timeoutQuestion() {
    gameState.answered = true;
    gameState.totalScore += 0;
    saveGameState();

    kyberFeedback.classList.add('wrong');
    kyberFeedback.innerHTML = `
      <div class="fb-result">⏱ TEMPO ESGOTADO</div>
      <div class="fb-points">0 XP</div>
      <div class="fb-agile">O Império te rastreou. Rápida decisão é essencial na agilidade!</div>
    `;

    const correctText = KYBER_CHALLENGES[challengeOrder[gameState.currentChallenge]].options.find(o => o.correct).text;
    document.querySelectorAll('.kyber-option').forEach((btn) => {
      if (btn.querySelector('.opt-text').textContent === correctText) btn.classList.add('correct-answer');
    });

    kyberScore.textContent = `Pontuação: ${gameState.totalScore} pts`;
    kyberNextBtn.style.display = 'inline-block';
  }

  // Next challenge
  function nextChallenge() {
    gameState.currentChallenge++;
    if (gameState.currentChallenge >= MAX_CHALLENGES) {
      finishGame();
    } else {
      showChallenge();
    }
  }

  // Finish game & add to ranking
  function finishGame() {
    gameState.gameOver = true;
    stopTimer();
    saveGameState();

    // Add to ranking
    const entry = {
      name: gameState.playerName,
      score: gameState.totalScore,
      timestamp: new Date().toISOString()
    };
    rankings.push(entry);
    rankings.sort((a, b) => b.score - a.score);
    rankings = rankings.slice(0, 10); // Top 10
    saveRankings();

    // Show results
    kyberChallenge.style.display = 'none';
    kyberGameOver.style.display = 'block';

    const finalRank = rankings.findIndex(r => r.name === gameState.playerName && r.score === gameState.totalScore) + 1;
    kyberGameOver.innerHTML = `
      <div class="gameover-content">
        <h3>🎖 MISSÃO CONCLUÍDA</h3>
        <p class="gameover-score">Sua pontuação final: <strong>${gameState.totalScore} pts</strong></p>
        <p class="gameover-rank">Posição no ranking: <strong>#${finalRank}</strong></p>
        <button class="btn btn--primary" onclick="location.reload()">Tentar Novamente</button>
      </div>
    `;

    renderLeaderboard();
  }

  // Render leaderboard
  function renderLeaderboard() {
    if (!kyberLeaderboard) return;
    kyberLeaderboard.innerHTML = '<h4>🏆 Resultado do Kyber Game</h4>';
    rankings.slice(0, 10).forEach((entry, i) => {
      const row = document.createElement('div');
      row.className = 'rank-row';
      if (entry.name === gameState.playerName) row.classList.add('highlight');
      row.innerHTML = `
        <span class="rank-pos">#${i + 1}</span>
        <span class="rank-name">${entry.name}</span>
        <span class="rank-score">${entry.score} pts</span>
      `;
      kyberLeaderboard.appendChild(row);
    });
  }

  // Event listeners
  if (kyberStartBtn) kyberStartBtn.addEventListener('click', startGame);
  if (kyberNextBtn) kyberNextBtn.addEventListener('click', nextChallenge);

  // Initial render
  renderLeaderboard();
})();
