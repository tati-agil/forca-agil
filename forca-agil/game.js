/* ============================================================
   Força Ágil — Gamificação "Sociedade Jedi"
   Autodiagnóstico + Missões com 3 desafios cada + XP + patentes
   Dados carregados de game-data.js via window.faGameData
   ============================================================ */
(function () {
  const STORE = 'fa-game-v2';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const { DIMS, LEVELS, RANKS, MISSIONS } = window.faGameData;

  // XP fixo por resposta certa dentro da missão
  const XP_PER_HIT = 4; // 3 perguntas × 4 XP = 12 XP máx por missão

  const QUIZ_MAX  = 15;  // autodiagnóstico: até 15 XP
  const MISS_MAX  = 35;  // missões: até 35 XP (18 respostas)
  const KYBER_MAX = 50;  // kyber game: até 50 XP (via firebase.js)

  // ---- State ----
  // missions agora armazena { answers: [null|idx, null|idx, null|idx] } por id
  let state = { quiz: Array(DIMS.length).fill(null), missions: {} };
  try {
    const saved = JSON.parse((window.faStore || localStorage).getItem(STORE) || 'null');
    if (saved && Array.isArray(saved.quiz)) state = { quiz: saved.quiz, missions: saved.missions || {} };
  } catch (e) { /* ignore */ }
  function getPlayer() {
    try { return JSON.parse(localStorage.getItem('fa-player') || 'null') || {}; } catch(e) { return {}; }
  }

  // Garante cadastro antes de qualquer interação — abre modal se não registrado
  function requirePlayer() {
    const p = getPlayer();
    if (p && p.name) return true;
    // dispara o modal de cadastro (definido em app.js)
    const btn = document.getElementById('openRegister');
    if (btn) btn.click();
    return false;
  }
  const save = () => {
    const st = window.faStore || localStorage;
    try { st.setItem(STORE, JSON.stringify(state)); } catch (e) {}
    // salva missions XP separado para firebase.js ler
    try {
      const totalCorrect = MISSIONS.reduce((acc, m) => {
        const ms = state.missions[m.id];
        if (!ms || !ms.answers) return acc;
        return acc + ms.answers.filter((a, i) => a === m.questions[i].correct).length;
      }, 0);
      const totalQuestions = MISSIONS.reduce((acc, m) => acc + m.questions.length, 0);
      const mXP = Math.round(totalCorrect / totalQuestions * MISS_MAX);
      st.setItem('fa-missions-xp', String(mXP));
    } catch(e) {}
    // Sincroniza progresso com Firebase para restaurar em outros browsers
    if (window.faSyncProgress) window.faSyncProgress();
  };

  // inicializa estado de missão se ainda não existe
  MISSIONS.forEach(m => {
    if (!state.missions[m.id]) state.missions[m.id] = { answers: Array(m.questions.length).fill(null) };
    // migração: formato antigo era boolean
    if (typeof state.missions[m.id] === 'boolean') {
      state.missions[m.id] = { answers: Array(m.questions.length).fill(null) };
    }
  });

  let prevRankIdx = null;

  // ---- Compute ----
  function missionXP(m) {
    const ms = state.missions[m.id];
    if (!ms || !ms.answers) return 0;
    return ms.answers.reduce((acc, ans, i) => {
      return acc + (ans === m.questions[i].correct ? XP_PER_HIT : 0);
    }, 0);
  }
  function missionDone(m) {
    const ms = state.missions[m.id];
    return ms && ms.answers && ms.answers.every(a => a !== null);
  }

  function compute() {
    const answered = state.quiz.filter(v => v != null).length;
    const quizDone = answered === DIMS.length;
    // 20 XP distribuídos pelas 6 dimensões respondidas
    const quizXP = Math.round(answered / DIMS.length * QUIZ_MAX);
    // missões: total de acertos / 18 * 48 XP
    const totalCorrect = MISSIONS.reduce((acc, m) => {
      const ms = state.missions[m.id];
      if (!ms || !ms.answers) return acc;
      return acc + ms.answers.filter((a, i) => a === m.questions[i].correct).length;
    }, 0);
    const totalQuestions = MISSIONS.reduce((acc, m) => acc + m.questions.length, 0);
    const mXP  = Math.round(totalCorrect / totalQuestions * MISS_MAX);
    const mDone = MISSIONS.filter(m => missionDone(m)).length;
    // kyberXP, contentXP e repoXP vêm do localStorage (salvos por firebase.js)
    const kyberXP = (() => { try { return parseInt((window.faStore || localStorage).getItem('fa-kyber-xp') || '0', 10) || 0; } catch(e) { return 0; } })();
    const contentXP = (() => { try { return parseInt((window.faStore || localStorage).getItem('fa-content-xp') || '0', 10) || 0; } catch(e) { return 0; } })();
    const repoXP = (() => { try { return parseInt((window.faStore || localStorage).getItem('fa-repo-xp') || '0', 10) || 0; } catch(e) { return 0; } })();
    const kyberDone = (window.faStore || localStorage).getItem('fa-kyber-done') === '1';
    const allDone = quizDone && mDone === MISSIONS.length && kyberDone;
    const xp   = Math.min(100, quizXP + mXP + kyberXP + contentXP + repoXP);
    let rankIdx = 0;
    for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].min) rankIdx = i;
    return { xp, quizXP, mXP, kyberXP, quizDone, mDone, kyberDone, allDone, rankIdx };
  }

  // ---- DOM refs ----
  const $ = (id) => document.getElementById(id);
  const hudAvatar = $('hudAvatar'), hudName = $('hudName'), hudTag = $('hudTag');
  const xpNow = $('xpNow'), xpNext = $('xpNext'), xpFill = $('xpFill');
  const badgeRow = $('badgeRow'), rankHud = $('rankHud');
  const guideMsg = $('guideMsg');
  const qList = $('qList'), quizResult = $('quizResult'), missionsResult = $('missionsResult');
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
      b.type = 'button'; b.className = 'q-opt'; b.textContent = lv;
      b.dataset.q = qi; b.dataset.v = li + 1;
      b.addEventListener('click', () => { if (!requirePlayer()) return; state.quiz[qi] = li + 1; save(); render(); });
      opts.appendChild(b);
    });
    item.appendChild(label); item.appendChild(opts);
    qList.appendChild(item);
  });

  // ---- Build missions ----
  MISSIONS.forEach(m => {
    // Wrapper
    const wrap = document.createElement('div');
    wrap.className = 'mission-wrap';
    wrap.dataset.id = m.id;

    // Header (clicável para expandir)
    const header = document.createElement('div');
    header.className = 'mission';
    header.dataset.id = m.id;
    const maxXP = m.questions.length * XP_PER_HIT;
    header.innerHTML =
      '<span class="m-check"><svg viewBox="0 0 24 24"><use href="#i-check"/></svg></span>' +
      '<span class="m-body">' +
        '<span class="m-title">' + m.t + '</span>' +
        '<span class="m-desc">'  + m.d  + '</span>' +
      '</span>' +
      '<span class="m-xp">+' + maxXP + ' XP</span>' +
      '<span class="m-chevron"><svg width="16" height="16" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';

    header.addEventListener('click', () => {
      if (!requirePlayer()) return;
      if (missionDone(m)) return; // missão concluída — não pode reabrir para responder
      const isOpen = wrap.classList.contains('open');
      document.querySelectorAll('.mission-wrap').forEach(w => w.classList.remove('open'));
      if (!isOpen) wrap.classList.add('open');
    });

    // Painel de desafios
    const panel = document.createElement('div');
    panel.className = 'm-panel';

    m.questions.forEach((qObj, qi) => {
      const qWrap = document.createElement('div');
      qWrap.className = 'm-question';
      qWrap.dataset.qi = qi;

      const qText = document.createElement('div');
      qText.className = 'm-q-text';
      qText.textContent = (qi + 1) + '. ' + qObj.q;
      qWrap.appendChild(qText);

      const optsWrap = document.createElement('div');
      optsWrap.className = 'm-q-opts';

      qObj.opts.forEach((optText, oi) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'm-q-opt';
        btn.dataset.qi = qi;
        btn.dataset.oi = oi;
        btn.textContent = optText;

        btn.addEventListener('click', () => {
          if (!requirePlayer()) return;
          const ms = state.missions[m.id];
          // já respondida — bloqueia
          if (ms.answers[qi] !== null) return;
          ms.answers[qi] = oi;
          save();
          renderMissionPanel(m, panel);
          render();
        });

        optsWrap.appendChild(btn);
      });

      qWrap.appendChild(optsWrap);

      // Área de feedback
      const fb = document.createElement('div');
      fb.className = 'm-q-feedback';
      fb.dataset.fbqi = qi;
      qWrap.appendChild(fb);

      panel.appendChild(qWrap);
    });

    wrap.appendChild(header);
    wrap.appendChild(panel);
    missionsEl.appendChild(wrap);

    // Render inicial do painel
    renderMissionPanel(m, panel);
  });

  // ---- Render painel de uma missão ----
  function renderMissionPanel(m, panel) {
    const ms = state.missions[m.id];
    m.questions.forEach((qObj, qi) => {
      const answered = ms.answers[qi] !== null;
      const chosen   = ms.answers[qi];
      const correct  = qObj.correct;

      // botões
      panel.querySelectorAll('[data-qi="' + qi + '"].m-q-opt').forEach(btn => {
        const oi = +btn.dataset.oi;
        btn.classList.remove('m-opt-correct', 'm-opt-wrong', 'm-opt-neutral');
        btn.disabled = answered;
        if (answered) {
          if (oi === correct)         btn.classList.add('m-opt-correct');
          else if (oi === chosen)     btn.classList.add('m-opt-wrong');
          else                        btn.classList.add('m-opt-neutral');
        }
      });

      // feedback
      const fb = panel.querySelector('[data-fbqi="' + qi + '"]');
      if (fb) {
        if (!answered) {
          fb.textContent = ''; fb.className = 'm-q-feedback';
        } else if (chosen === correct) {
          fb.textContent = '✓ Correto! +' + XP_PER_HIT + ' XP';
          fb.className = 'm-q-feedback m-fb-correct';
        } else {
          fb.textContent = '✗ Não foi dessa vez. A resposta certa era a opção ' + String.fromCharCode(65 + correct) + '.';
          fb.className = 'm-q-feedback m-fb-wrong';
        }
      }
    });
  }

  // ---- Badges ----
  function badges(c) {
    const list = [];
    if (c.quizDone)                               list.push({ i: '#i-target',  l: 'Mente Desperta'  });
    if (c.mDone >= 1)                             list.push({ i: '#i-flag',    l: 'Primeira Missão' });
    if (c.mDone >= 3)                             list.push({ i: '#i-chevron', l: 'Rebelde Ativo'   });
    if (c.rankIdx >= 2)                           list.push({ i: '#i-saber',   l: 'Cavaleiro'       });
    if (c.mDone === MISSIONS.length && c.rankIdx === 3) list.push({ i: '#i-radiate', l: 'Mestre Jedi' });
    return list;
  }

  // ---- Guide messages ----
  function guideText(c, leveledUp) {
    if (leveledUp) return 'Patente desbloqueada: ' + RANKS[c.rankIdx].name + '! Continue cumprindo missões para evoluir ainda mais.';
    if (c.rankIdx === 3) return 'Você alcançou o posto de Mestre! Agora seu papel é formar novos Jedi e disseminar a mentalidade ágil pela Previ.';
    if (!c.quizDone) return 'Olá! Eu sou o Previx. Comece pelo autodiagnóstico abaixo — escolha seu nível em cada dimensão para revelar sua patente inicial.';
    if (c.mDone === 0) return 'Autodiagnóstico concluído! Clique em uma missão para expandir os 3 desafios e ganhar XP.';
    if (c.rankIdx < RANKS.length - 1) return 'Bom trabalho! Faltam ' + (RANKS[c.rankIdx + 1].min - c.xp) + ' XP para virar ' + RANKS[c.rankIdx + 1].name + '. Siga em frente!';
    return 'Você alcançou o posto de Mestre! Parabéns, a Força Ágil está com você.';
  }

  // ---- Render geral ----
  function render() {
    const c = compute();

    // quiz — bloqueia após concluído
    qList.querySelectorAll('.q-opt').forEach(b => {
      b.classList.toggle('sel', state.quiz[+b.dataset.q] === +b.dataset.v);
      b.disabled = c.quizDone;
    });
    if (quizResult && c.quizDone) {
      let quizLock = document.getElementById('quizLockMsg');
      if (!quizLock) {
        quizLock = document.createElement('p');
        quizLock.id = 'quizLockMsg';
        quizLock.style.cssText = 'font-family:var(--font-mono);font-size:.7rem;color:var(--ink-3);margin-top:6px;';
        quizLock.textContent = '🔒 Autodiagnóstico concluído — não pode ser refeito.';
        quizResult.parentNode.insertBefore(quizLock, quizResult.nextSibling);
      }
    }

    // missões — header check + xp earned
    document.querySelectorAll('.mission-wrap').forEach(wrap => {
      const id = wrap.dataset.id;
      const m  = MISSIONS.find(x => x.id === id);
      if (!m) return;
      const done   = missionDone(m);
      const earned = missionXP(m);
      const header = wrap.querySelector('.mission');
      header.classList.toggle('done', done);
      // Atualiza XP exibido
      const xpSpan = header.querySelector('.m-xp');
      if (xpSpan) {
        const maxXP = m.questions.length * XP_PER_HIT;
        xpSpan.textContent = done
          ? earned + '/' + maxXP + ' XP ✓'
          : '+' + maxXP + ' XP';
      }
      // Mensagem de cadeado — aparece quando concluída
      let lockMsg = wrap.querySelector('.m-lock-msg');
      if (done) {
        if (!lockMsg) {
          lockMsg = document.createElement('p');
          lockMsg.className = 'm-lock-msg';
          lockMsg.style.cssText = 'font-family:var(--font-mono);font-size:.7rem;color:var(--ink-3);margin:2px 0 0 36px;';
          header.after(lockMsg);
        }
        lockMsg.textContent = '🔒 Missão concluída — não pode ser refeita. (' + earned + ' XP ganhos)';
      } else if (lockMsg) {
        lockMsg.remove();
      }
    });

    // HUD
    hudAvatar.querySelector('use').setAttribute('href', RANKS[c.rankIdx].sym);
    hudName.textContent = RANKS[c.rankIdx].name;
    hudTag.textContent  = RANKS[c.rankIdx].tag;
    xpNow.textContent   = c.xp + ' XP';
    xpFill.style.width  = c.xp + '%';
    xpNext.textContent  = c.rankIdx < RANKS.length - 1
      ? 'Próxima: ' + RANKS[c.rankIdx + 1].name + ' · ' + RANKS[c.rankIdx + 1].min + ' XP'
      : 'Patente máxima alcançada';

    // Aviso de patente provisória
    let hudProvisorio = document.getElementById('hudProvisorio');
    if (!hudProvisorio) {
      hudProvisorio = document.createElement('p');
      hudProvisorio.id = 'hudProvisorio';
      hudProvisorio.style.cssText = 'font-family:var(--font-mono);font-size:.65rem;color:var(--ink-3);margin-top:6px;opacity:.8;';
      rankHud && rankHud.querySelector('.rh-body') && rankHud.querySelector('.rh-body').appendChild(hudProvisorio);
    }
    if (hudProvisorio) {
      if (c.allDone) {
        hudProvisorio.textContent = '';
      } else {
        const faltam = [!c.quizDone && 'autodiagnóstico', c.mDone < MISSIONS.length && 'missões', !c.kyberDone && 'Kyber Game'].filter(Boolean);
        hudProvisorio.textContent = '⚠ Patente provisória — falta' + (faltam.length > 1 ? 'm' : '') + ': ' + faltam.join(', ') + '.';
      }
    }

    // ladder
    document.querySelectorAll('.char-card').forEach(card => {
      const i = +card.dataset.rank;
      card.classList.toggle('active',  i === c.rankIdx);
      card.classList.toggle('locked',  i > c.rankIdx);
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

    if (guideMsg) guideMsg.textContent = guideText(c, leveledUp);

    if (quizResult) {
      quizResult.textContent = c.quizDone
        ? 'Autodiagnóstico completo · +' + c.quizXP + ' XP de base'
        : (state.quiz.filter(v => v != null).length + '/' + DIMS.length + ' dimensões respondidas');
    }

    if (missionsResult) {
      const allMissionsDone = c.mDone === MISSIONS.length;
      missionsResult.textContent = allMissionsDone
        ? 'Missões de Campo completas · +' + c.mXP + ' XP'
        : (c.mDone + '/' + MISSIONS.length + ' missões concluídas');
    }
  }

  // ---- Botões ----
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

  prevRankIdx = compute().rankIdx;
  render();

  // expõe render globalmente para firebase.js atualizar HUD após kyber
  window.faGameRender = render;
  // recarrega o estado do localStorage/faStore (ex.: após reset do admin) e re-renderiza
  window.faGameReload = function () {
    try {
      const saved = JSON.parse((window.faStore || localStorage).getItem(STORE) || 'null');
      state = (saved && Array.isArray(saved.quiz)) ? { quiz: saved.quiz, missions: saved.missions || {} } : { quiz: Array(DIMS.length).fill(null), missions: {} };
    } catch (e) { state = { quiz: Array(DIMS.length).fill(null), missions: {} }; }
    MISSIONS.forEach(m => {
      if (!state.missions[m.id]) state.missions[m.id] = { answers: Array(m.questions.length).fill(null) };
    });
    render();
  };
})();
