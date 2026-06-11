/* ============================================================
   Força Ágil — Gamificação "Sociedade Jedi"
   Autodiagnóstico + Missões com 3 desafios cada + XP + patentes
   ============================================================ */
(function () {
  const STORE = 'fa-game-v2';
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
    { name: 'Youngling', tag: '"Já ouvi falar"', sym: '#char-0', min: 0  },
    { name: 'Padawan',   tag: '"Sei o que é"',   sym: '#char-1', min: 25 },
    { name: 'Cavaleiro', tag: '"Domino"',         sym: '#char-2', min: 50 },
    { name: 'Mestre',    tag: '"Ensino"',         sym: '#char-3', min: 75 }
  ];

  // XP fixo por resposta certa dentro da missão
  const XP_PER_HIT = 4; // 3 perguntas × 4 XP = 12 XP máx por missão

  const MISSIONS = [
    {
      id: 'gelo',
      t: 'Quebre o gelo',
      d: 'Apresente-se sem crachá — pratique a horizontalização.',
      questions: [
        {
          q: 'Qual é o propósito principal de uma apresentação "sem crachá"?',
          opts: [
            'Economizar tempo na apresentação',
            'Criar segurança psicológica e igualdade entre os participantes',
            'Evitar exposição de dados pessoais',
            'É apenas uma formalidade da oficina'
          ],
          correct: 1
        },
        {
          q: 'O que significa "horizontalização" no contexto ágil?',
          opts: [
            'Reduzir o número de funcionários',
            'Trabalhar em escritório open space',
            'Diminuir barreiras hierárquicas para facilitar a colaboração',
            'Nivelar os salários da equipe'
          ],
          correct: 2
        },
        {
          q: 'Quando alguém se apresenta sem cargo numa reunião ágil, o que isso promove?',
          opts: [
            'Confusão sobre responsabilidades',
            'Conversas mais honestas e colaboração sem filtro de poder',
            'Falta de respeito entre os membros',
            'Perda de tempo desnecessária'
          ],
          correct: 1
        }
      ]
    },
    {
      id: 'csd',
      t: 'Monte a CSD',
      d: 'Liste Certezas, Suposições e Dúvidas do seu desafio.',
      questions: [
        {
          q: 'Para que serve a Matriz CSD?',
          opts: [
            'Documentar requisitos formais do projeto',
            'Mapear o que o time sabe, supõe e precisa validar sobre o problema',
            'Avaliar o desempenho individual dos membros',
            'Criar o backlog do produto'
          ],
          correct: 1
        },
        {
          q: 'O que vai na coluna "Suposições" da CSD?',
          opts: [
            'Fatos já confirmados por dados concretos',
            'Hipóteses que o time acredita serem verdade mas ainda não validou',
            'Perguntas que definitivamente não têm resposta',
            'Riscos mapeados no planejamento'
          ],
          correct: 1
        },
        {
          q: 'Qual é o benefício de identificar as "Dúvidas" na CSD?',
          opts: [
            'Mostrar que o time não está preparado',
            'Direcionar onde focar pesquisa e aprendizado antes de agir',
            'Justificar atrasos no projeto',
            'Transferir responsabilidade para outros times'
          ],
          correct: 1
        }
      ]
    },
    {
      id: 'forca',
      t: 'Empunhe a Força',
      d: 'Saiba explicar os 4 valores ágeis a um colega.',
      questions: [
        {
          q: 'Qual é o primeiro valor do Manifesto Ágil?',
          opts: [
            'Processos e ferramentas mais que indivíduos',
            'Documentação extensa mais que software funcionando',
            'Indivíduos e interações mais que processos e ferramentas',
            'Seguir um plano mais que responder a mudanças'
          ],
          correct: 2
        },
        {
          q: '"Colaboração com o cliente mais que negociação de contratos" significa:',
          opts: [
            'Não ter contratos formais com clientes',
            'Envolver o cliente continuamente ao longo do projeto, não só no início e fim',
            'O cliente decide tudo sem filtro da equipe',
            'Reduzir o valor cobrado no contrato'
          ],
          correct: 1
        },
        {
          q: 'Por que "responder a mudanças" é valorizado no ágil?',
          opts: [
            'Porque mudanças são sempre benéficas ao projeto',
            'Porque o plano inicial raramente reflete a realidade ao longo do tempo',
            'Porque planejamento não tem nenhum valor',
            'Porque clientes sempre mudam de ideia sem razão'
          ],
          correct: 1
        }
      ]
    },
    {
      id: 'sabre',
      t: 'Acenda o sabre',
      d: 'Facilite uma daily real — sem cobrança de status individual.',
      questions: [
        {
          q: 'Qual é o objetivo principal de uma daily de 15 minutos?',
          opts: [
            'Reportar status de cada tarefa para o gestor',
            'Sincronizar o time e identificar impedimentos coletivos',
            'Avaliar a produtividade individual de cada membro',
            'Planejar em detalhe as tarefas do dia'
          ],
          correct: 1
        },
        {
          q: 'O que caracteriza uma daily do "lado sombrio"?',
          opts: [
            'Durar exatamente 15 minutos sem exceção',
            'Ser realizada em pé para ser mais rápida',
            'Virar reunião de status onde cada um reporta para o gestor',
            'Ter somente três perguntas fixas'
          ],
          correct: 2
        },
        {
          q: 'Como facilitar uma daily saudável?',
          opts: [
            'Controlando o tempo de fala de cada pessoa',
            'Fazendo perguntas sobre bloqueios e oportunidades de colaboração',
            'Tomando notas para reportar à liderança depois',
            'Garantindo que todos falem exatamente o mesmo tempo'
          ],
          correct: 1
        }
      ]
    },
    {
      id: 'vieses',
      t: 'Caçador de vieses',
      d: 'Identifique um viés que afeta suas decisões.',
      questions: [
        {
          q: 'O que é um viés cognitivo?',
          opts: [
            'Um erro de sistema nos processos da empresa',
            'Um atalho mental que pode distorcer nossa percepção e decisões',
            'Uma opinião contrária à da maioria do time',
            'Uma falha técnica no produto desenvolvido'
          ],
          correct: 1
        },
        {
          q: 'O "viés de confirmação" faz com que a pessoa:',
          opts: [
            'Confie cegamente nas regras da empresa',
            'Busque apenas informações que confirmem o que já acredita',
            'Confirme todas as decisões do gestor sem questionar',
            'Documente tudo exaustivamente antes de agir'
          ],
          correct: 1
        },
        {
          q: 'Como times ágeis reduzem o impacto de vieses nas decisões?',
          opts: [
            'Delegando decisões para quem tem mais cargo hierárquico',
            'Usando dados, retrospectivas e diversidade de perspectivas',
            'Evitando discussões que possam gerar conflito no time',
            'Seguindo sempre o processo definido sem questionar'
          ],
          correct: 1
        }
      ]
    },
    {
      id: 'padawan',
      t: 'Treine um Padawan',
      d: 'Ensine um conceito ágil para outra pessoa.',
      questions: [
        {
          q: 'Por que ensinar um conceito ágil para outra pessoa consolida seu aprendizado?',
          opts: [
            'Porque você ganha reconhecimento e visibilidade na empresa',
            'Porque explicar obriga você a organizar e aprofundar o que sabe',
            'Porque reduz sua própria carga de trabalho',
            'Porque é obrigatório para obter certificação'
          ],
          correct: 1
        },
        {
          q: 'Qual é a melhor forma de explicar agilidade para um colega cético?',
          opts: [
            'Mostrar todos os frameworks e cerimônias de uma vez',
            'Começar com um problema real que ele já enfrenta e mostrar como o ágil ajuda',
            'Enviar um link com o Manifesto Ágil para ele ler',
            'Dizer que é uma obrigação da empresa adotar'
          ],
          correct: 1
        },
        {
          q: 'O que significa ser um "multiplicador" da Força Ágil?',
          opts: [
            'Fazer o trabalho de várias pessoas ao mesmo tempo',
            'Replicar e disseminar a mentalidade ágil para além da própria equipe',
            'Multiplicar o número de cerimônias no time',
            'Aumentar a velocidade das entregas a qualquer custo'
          ],
          correct: 1
        }
      ]
    }
  ];

  const QUIZ_MAX  = 15;  // autodiagnóstico: até 15 XP
  const MISS_MAX  = 35;  // missões: até 35 XP (18 respostas)
  const KYBER_MAX = 50;  // kyber game: até 50 XP (via firebase.js)

  // ---- State ----
  // missions agora armazena { answers: [null|idx, null|idx, null|idx] } por id
  let state = { quiz: Array(DIMS.length).fill(null), missions: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
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
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {}
    // salva missions XP separado para firebase.js ler
    try {
      const totalCorrect = MISSIONS.reduce((acc, m) => {
        const ms = state.missions[m.id];
        if (!ms || !ms.answers) return acc;
        return acc + ms.answers.filter((a, i) => a === m.questions[i].correct).length;
      }, 0);
      const totalQuestions = MISSIONS.reduce((acc, m) => acc + m.questions.length, 0);
      const mXP = Math.round(totalCorrect / totalQuestions * MISS_MAX);
      localStorage.setItem('fa-missions-xp', String(mXP));
    } catch(e) {}
    // XP salvo localmente — Firebase só sincroniza quando pessoa clicar "Revelar Patente"
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
    // kyberXP vem do localStorage (salvo por firebase.js após o game)
    const kyberXP = (() => { try { return parseInt(localStorage.getItem('fa-kyber-xp') || '0', 10) || 0; } catch(e) { return 0; } })();
    const xp   = Math.min(100, quizXP + mXP + kyberXP);
    let rankIdx = 0;
    for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].min) rankIdx = i;
    return { xp, quizXP, mXP, kyberXP, quizDone, mDone, rankIdx };
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
      const isOpen = wrap.classList.contains('open');
      // fecha todos
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

    // quiz
    qList.querySelectorAll('.q-opt').forEach(b => {
      b.classList.toggle('sel', state.quiz[+b.dataset.q] === +b.dataset.v);
    });

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

  const resetGame = $('resetGame');
  if (resetGame) resetGame.addEventListener('click', () => {
    state = { quiz: Array(DIMS.length).fill(null), missions: {} };
    MISSIONS.forEach(m => { state.missions[m.id] = { answers: Array(m.questions.length).fill(null) }; });
    prevRankIdx = null; save(); render();
    // fecha todos os painéis
    document.querySelectorAll('.mission-wrap').forEach(w => w.classList.remove('open'));
    // limpa feedbacks
    MISSIONS.forEach(m => {
      const wrap  = document.querySelector('.mission-wrap[data-id="' + m.id + '"]');
      if (!wrap) return;
      const panel = wrap.querySelector('.m-panel');
      if (panel) renderMissionPanel(m, panel);
    });
    if (guideMsg) guideMsg.textContent = 'Holocron reiniciado. Vamos começar de novo!';
  });

  prevRankIdx = compute().rankIdx;
  render();

  // expõe render globalmente para firebase.js atualizar HUD após kyber
  window.faGameRender = render;
})();
