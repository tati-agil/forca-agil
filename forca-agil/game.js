/* ============================================================
   Força Ágil — Gamificação "Sociedade Jedi"
   Autodiagnóstico (quiz) + Missões + XP + patentes, persistido.
   ============================================================ */
(function () {
  const STORE = 'fa-game-v1';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const DIMS = [
    'Valores e princípios ágeis',
    'Foco no cliente e no valor',
    'Fluxo de trabalho (Kanban / WIP)',
    'Colaboração e times auto-organizados',
    'Liderança servidora',
    'Métricas e melhoria contínua'
  ];
  const LEVELS = ['Já ouvi falar', 'Sei o que é', 'Domino', 'Ensino']; // 1..4

  const RANKS = [
    { name: 'Youngling', tag: '"Já ouvi falar"', sym: '#char-0', min: 0 },
    { name: 'Padawan',   tag: '"Sei o que é"',   sym: '#char-1', min: 25 },
    { name: 'Cavaleiro', tag: '"Domino"',        sym: '#char-2', min: 50 },
    { name: 'Mestre',    tag: '"Ensino"',        sym: '#char-3', min: 75 }
  ];

  const MISSIONS = [
    { id: 'gelo',    t: 'Quebre o gelo',     d: 'Apresente-se sem crachá — pratique a horizontalização.',      xp: 12 },
    { id: 'csd',     t: 'Monte a CSD',        d: 'Liste Certezas, Suposições e Dúvidas do seu desafio.',        xp: 12 },
    { id: 'forca',   t: 'Empunhe a Força',    d: 'Saiba explicar os 4 valores ágeis a um colega.',              xp: 14 },
    { id: 'sabre',   t: 'Acenda o sabre',     d: 'Facilite uma daily real — sem cobrança de status individual.', xp: 14 },
    { id: 'vieses',  t: 'Caçador de vieses',  d: 'Identifique um viés que afeta suas decisões.',                xp: 16 },
    { id: 'padawan', t: 'Treine um Padawan',  d: 'Ensine um conceito ágil para outra pessoa.',                  xp: 16 }
  ];

  const QUIZ_MAX = 30;

  // ---- State ----
  let state = { quiz: Array(DIMS.length).fill(null), missions: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved && Array.isArray(saved.quiz)) state = { quiz: saved.quiz, missions: saved.missions || {} };
  } catch (e) { /* ignore */ }
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} };

  let prevRankIdx = null;

  // ---- Compute ----
  function compute() {
    const answered = state.quiz.filter(v => v != null).length;
    const quizDone = answered === DIMS.length;
    let quizXP = 0;
    if (quizDone) {
      const sum = state.quiz.reduce((a, b) => a + b, 0); // 6..24
      quizXP = Math.round((sum - DIMS.length) / (DIMS.length * 3) * QUIZ_MAX);
    }
    const mDoneIds = MISSIONS.filter(m => state.missions[m.id]);
    const mXP = mDoneIds.reduce((a, m) => a + m.xp, 0);
    const xp = Math.min(100, quizXP + mXP);
    let rankIdx = 0;
    for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].min) rankIdx = i;
    return { xp, quizXP, mXP, quizDone, mDone: mDoneIds.length, rankIdx };
  }

  // ---- DOM refs ----
  const $ = (id) => document.getElementById(id);
  const hudAvatar = $('hudAvatar'), hudName = $('hudName'), hudTag = $('hudTag');
  const xpNow = $('xpNow'), xpNext = $('xpNext'), xpFill = $('xpFill');
  const badgeRow = $('badgeRow'), rankHud = $('rankHud');
  const guideMsg = $('guideMsg');
  const qList = $('qList'), quizResult = $('quizResult');
  const missionsEl = $('missions');

  // ---- Build quiz ----
  DIMS.forEach((dim, qi) => {
    const item = document.createElement('div');
    item.className = 'q-item';
    const label = document.createElement('div');
    label.className = 'q-label';
    label.textContent = (qi + 1) + '. ' + dim;
    const opts = document.createElement('div');
    opts.className = 'q-opts';
    LEVELS.forEach((lv, li) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'q-opt'; b.textContent = lv; b.dataset.q = qi; b.dataset.v = li + 1;
      b.addEventListener('click', () => {
        state.quiz[qi] = li + 1; save(); render();
      });
      opts.appendChild(b);
    });
    item.appendChild(label); item.appendChild(opts);
    qList.appendChild(item);
  });

  // ---- Build missions ----
  MISSIONS.forEach(m => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'mission'; btn.dataset.id = m.id;
    btn.innerHTML =
      '<span class="m-check"><svg viewBox="0 0 24 24"><use href="#i-check"/></svg></span>' +
      '<span class="m-body"><span class="m-title">' + m.t + '</span><span class="m-desc">' + m.d + '</span></span>' +
      '<span class="m-xp">+' + m.xp + ' XP</span>';
    btn.addEventListener('click', () => {
      state.missions[m.id] = !state.missions[m.id]; save(); render();
    });
    missionsEl.appendChild(btn);
  });

  // ---- Badges ----
  function badges(c) {
    const list = [];
    if (c.quizDone) list.push({ i: '#i-target', l: 'Mente Desperta' });
    if (c.mDone >= 1) list.push({ i: '#i-flag', l: 'Primeira Missão' });
    if (c.mDone >= 3) list.push({ i: '#i-chevron', l: 'Rebelde Ativo' });
    if (c.rankIdx >= 2) list.push({ i: '#i-saber', l: 'Cavaleiro' });
    if (c.mDone === MISSIONS.length && c.rankIdx === 3) list.push({ i: '#i-radiate', l: 'Mestre Jedi' });
    return list;
  }

  // ---- Guide messages ----
  function guideText(c, leveledUp) {
    if (leveledUp) return 'Patente desbloqueada: ' + RANKS[c.rankIdx].name + '! Continue cumprindo missões para evoluir ainda mais.';
    if (c.rankIdx === 3) return 'Você alcançou o posto de Mestre! Agora seu papel é formar novos Jedi e disseminar a mentalidade ágil pela Previ.';
    if (!c.quizDone) return 'Olá! Eu sou o PV-1. Comece pelo autodiagnóstico abaixo — escolha seu nível em cada dimensão para revelar sua patente inicial.';
    if (c.mDone === 0) return 'Autodiagnóstico concluído! Agora é hora da ação: cumpra missões de campo para ganhar XP e subir de patente.';
    return 'Bom trabalho! Faltam ' + (RANKS[c.rankIdx + 1].min - c.xp) + ' XP para virar ' + RANKS[c.rankIdx + 1].name + '. Siga em frente!';
  }

  // ---- Render ----
  function render() {
    const c = compute();

    // quiz selection state
    qList.querySelectorAll('.q-opt').forEach(b => {
      b.classList.toggle('sel', state.quiz[+b.dataset.q] === +b.dataset.v);
    });
    // missions state
    missionsEl.querySelectorAll('.mission').forEach(b => {
      b.classList.toggle('done', !!state.missions[b.dataset.id]);
    });

    // HUD
    hudAvatar.querySelector('use').setAttribute('href', RANKS[c.rankIdx].sym);
    hudName.textContent = RANKS[c.rankIdx].name;
    hudTag.textContent = RANKS[c.rankIdx].tag;
    xpNow.textContent = c.xp + ' XP';
    xpFill.style.width = c.xp + '%';
    xpNext.textContent = c.rankIdx < RANKS.length - 1
      ? 'Próxima: ' + RANKS[c.rankIdx + 1].name + ' · ' + RANKS[c.rankIdx + 1].min + ' XP'
      : 'Patente máxima alcançada';

    // ladder
    document.querySelectorAll('.char-card').forEach(card => {
      const i = +card.dataset.rank;
      card.classList.toggle('active', i === c.rankIdx);
      card.classList.toggle('locked', i > c.rankIdx);
    });

    // badges
    badgeRow.innerHTML = '';
    badges(c).forEach(bd => {
      const chip = document.createElement('span');
      chip.className = 'badge-chip';
      chip.innerHTML = '<svg viewBox="0 0 24 24"><use href="' + bd.i + '"/></svg>' + bd.l;
      badgeRow.appendChild(chip);
    });

    // level-up flash
    let leveledUp = false;
    if (prevRankIdx != null && c.rankIdx > prevRankIdx) {
      leveledUp = true;
      if (!reduce && rankHud) {
        rankHud.classList.remove('levelup'); void rankHud.offsetWidth; rankHud.classList.add('levelup');
      }
    }
    prevRankIdx = c.rankIdx;

    // guide
    if (guideMsg) guideMsg.textContent = guideText(c, leveledUp);

    // quiz result line
    if (quizResult) {
      quizResult.textContent = c.quizDone
        ? 'Autodiagnóstico completo · +' + c.quizXP + ' XP de base'
        : (state.quiz.filter(v => v != null).length + '/' + DIMS.length + ' dimensões respondidas');
    }
  }

  // ---- Buttons ----
  const quizCalc = $('quizCalc');
  if (quizCalc) quizCalc.addEventListener('click', () => {
    const c = compute();
    if (!c.quizDone) {
      quizResult.textContent = 'Responda todas as ' + DIMS.length + ' dimensões para revelar sua patente.';
      return;
    }
    if (!reduce && rankHud) { rankHud.classList.remove('levelup'); void rankHud.offsetWidth; rankHud.classList.add('levelup'); }
    quizResult.textContent = 'Patente revelada: ' + RANKS[c.rankIdx].name + ' · +' + c.quizXP + ' XP';
  });

  const resetGame = $('resetGame');
  if (resetGame) resetGame.addEventListener('click', () => {
    state = { quiz: Array(DIMS.length).fill(null), missions: {} };
    prevRankIdx = null; save(); render();
    if (guideMsg) guideMsg.textContent = 'Holocron reiniciado. Vamos começar de novo — faça o autodiagnóstico quando quiser!';
  });

  // init (prevRankIdx starts at computed so first load doesn't flash)
  prevRankIdx = compute().rankIdx;
  render();
})();
