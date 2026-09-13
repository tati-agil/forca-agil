/* ============================================================
   Força Ágil — Autodiagnóstico Likert (v3-quiz)
   Patente determinada pela pontuação 0-60 do quiz.

   Um treinamento pertence a um ou mais EVENTOS (nó "treinamentos" no
   Firebase, gerenciado na aba Treinamentos do painel). Quem está inscrita
   numa turma de qualquer um desses eventos tem acesso a ele — antes a página
   era liberada a qualquer pessoa "enrolled", o que só funcionava enquanto
   existia um treinamento único.

   O conteúdo (afirmações e patentes) continua no código, em game-data.js:
   o registro no banco aponta para um conjunto do catálogo pela conteudoKey.
   ============================================================ */
(function () {
  const STORE = 'fa-game-v3';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const CATALOGO = window.faGameConteudos ||
    (window.faGameData ? { jedi: window.faGameData } : {});

  /* Conteúdo ativo — trocado ao selecionar outro treinamento. */
  let BLOCOS = [], LEVELS = [], RANKS = [], TOTAL_AFIRM = 0, PONTO_MAX = 3;
  let state = { quiz: [], revealed: false };
  let DISPONIVEIS = [];
  let TREINO_ATIVO = null;
  /* Conteúdos criados no painel, lidos de treinamentos-conteudo/<treinoKey>. */
  let CONTEUDOS_BANCO = {};

  const CONTRATO = window.faTreinoConteudo || null;

  /* O conteúdo vem de dois lugares — do catálogo em código (conteudoKey) ou
     do banco, criado no painel (o treinamento sem conteudoKey). Os dois saem
     daqui pelo mesmo formato, passando pelo mesmo normalizador, para o resto
     da página não precisar saber de onde veio. */
  function conteudoDe(t) {
    const bruto = (t && t.conteudoKey)
      ? (CATALOGO[t.conteudoKey] || window.faGameData || {})
      : (CONTEUDOS_BANCO[t && t.key] || {});
    if (!CONTRATO) {
      return { BLOCOS: bruto.BLOCOS || [], LEVELS: bruto.LEVELS || [], RANKS: bruto.RANKS || [], PONTO_MAX: 3 };
    }
    /* O conteúdo do código já vem no formato final; o do banco usa nomes em
       minúsculas (blocos/levels/ranks) porque é assim que fica gravado. */
    return (t && t.conteudoKey)
      ? CONTRATO.normalizar({ blocos: bruto.BLOCOS, levels: bruto.LEVELS, ranks: bruto.RANKS })
      : CONTRATO.normalizar(bruto);
  }

  function aplicarConteudoResolvido(c) {
    BLOCOS = c.BLOCOS || [];
    LEVELS = c.LEVELS || [];
    RANKS  = c.RANKS  || [];
    PONTO_MAX = typeof c.PONTO_MAX === 'number' ? c.PONTO_MAX : Math.max(0, LEVELS.length - 1);
    TOTAL_AFIRM = BLOCOS.reduce((acc, b) => acc + ((b.afirmacoes || []).length), 0);
  }

  function aplicarConteudo(conteudoKey) {
    aplicarConteudoResolvido(conteudoDe({ conteudoKey: conteudoKey }));
  }

  function emailKey(email) {
    return (email || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
  }

  // ---- Progresso, guardado por treinamento -------------------------------
  /* Antes havia UM progresso por pessoa: com dois treinamentos, o segundo
     apagaria o primeiro. Agora a chave guarda um mapa treinamento → progresso.
     O formato antigo ({quiz, revealed} na raiz) continua sendo lido e vale
     como o progresso do treinamento ativo — é o que a pessoa já respondeu. */
  function lerTudo() {
    let v = null;
    try { v = JSON.parse((window.faStore || localStorage).getItem(STORE) || 'null'); } catch (e) {}
    if (!v || typeof v !== 'object') return { mapa: {}, legado: null };
    if (Array.isArray(v.quiz)) return { mapa: {}, legado: { quiz: v.quiz, revealed: !!v.revealed } };
    return { mapa: v, legado: null };
  }

  function normaliza(st) {
    const quiz = (st && Array.isArray(st.quiz)) ? st.quiz.slice(0, TOTAL_AFIRM) : [];
    while (quiz.length < TOTAL_AFIRM) quiz.push(null);
    return { quiz: quiz, revealed: !!(st && st.revealed) };
  }

  function carregarEstado() {
    const t = lerTudo();
    state = normaliza((TREINO_ATIVO && t.mapa[TREINO_ATIVO]) || t.legado);
  }

  function save() {
    const t = lerTudo();
    const mapa = t.mapa;
    const chave = TREINO_ATIVO || '_';
    /* Um progresso do formato antigo é do treinamento que a pessoa estava
       fazendo — preserva sob a chave dele em vez de sumir na primeira gravação. */
    if (t.legado && !mapa[chave]) mapa[chave] = t.legado;
    mapa[chave] = state;
    try { (window.faStore || localStorage).setItem(STORE, JSON.stringify(mapa)); } catch (e) {}
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
    return TOTAL_AFIRM > 0 && state.quiz.filter(v => v != null).length === TOTAL_AFIRM;
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
  /* Redesenhado a cada troca de treinamento: dois treinamentos podem apontar
     para conteúdos diferentes, com outras afirmações. */
  function buildQuiz() {
    if (!qList) return;
    qList.innerHTML = '';

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

      (bloco.afirmacoes || []).forEach((afirm, localIdx) => {
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

  /* A escada de patentes era HTML fixo no index.html, com os quatro nomes
     Jedi escritos à mão. Isso já estava errado no dia em que o treinamento
     deixou de ser um só: outro conteúdo mostrava as afirmações dele e a
     escada do Jedi. Agora ela sai dos dados do treinamento ativo — é o que
     também permite patente criada no painel. */
  function desenharEscada() {
    const trilha = document.getElementById('charLadder');
    if (!trilha) return;
    const assinatura = RANKS.map(r => r.id + '|' + r.name + '|' + r.sym).join('§');
    if (trilha.dataset.assinatura === assinatura) return;  /* nada mudou */
    trilha.dataset.assinatura = assinatura;
    trilha.innerHTML = RANKS.map((r, i) =>
      '<div class="char-card" data-rank="' + i + '" style="padding:12px 10px;min-width:120px;max-width:150px">' +
        '<div class="cc-fig"><svg viewBox="0 0 120 220" width="70" height="128"><use href="' + esc(r.sym || '#char-0') + '"/></svg></div>' +
        '<div class="cc-lvl" style="font-size:.6rem">PATENTE ' + (i + 1 < 10 ? '0' : '') + (i + 1) + '</div>' +
        '<div class="cc-name" style="font-size:.85rem">' + esc(r.name) + '</div>' +
        '<div class="cc-tag" style="font-size:.7rem">' + esc(r.tag || '') + '</div>' +
        '<div class="cc-lock"><svg width="14" height="14"><use href="#i-lock"/></svg></div>' +
      '</div>').join('');
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // ---- Render ----
  function render() {
    const done = quizDone();
    const answered = state.quiz.filter(v => v != null).length;
    const ri = diagRankIdx();
    const rank = RANKS[ri] || {};

    // quiz opts — marca selecionados
    qList && qList.querySelectorAll('.q-opt').forEach(b => {
      b.classList.toggle('sel', state.quiz[+b.dataset.q] === +b.dataset.v);
      b.disabled = done || state.revealed;
    });

    // HUD avatar
    if (hudAvatar) {
      const use = hudAvatar.querySelector('use');
      if (use) use.setAttribute('href', rank.sym || '#char-0');
    }
    if (hudName) hudName.textContent = rank.name || '';
    if (hudTag)  hudTag.textContent  = rank.tag || '';

    // ladder cards
    desenharEscada();
    document.querySelectorAll('.char-card').forEach(card => {
      const i = +card.dataset.rank;
      card.classList.toggle('active', i === ri);
      card.classList.toggle('locked', i > ri || !done);
    });

    // quiz result area
    if (quizResult) {
      if (state.revealed) {
        renderReveal(ri);
      } else if (done) {
        quizResult.innerHTML =
          '<div style="text-align:center;margin-top:12px">' +
          '<p style="font-family:var(--font-mono);font-size:.9rem;color:var(--accent);margin-bottom:16px">✓ ' + TOTAL_AFIRM + '/' + TOTAL_AFIRM + ' afirmações respondidas</p>' +
          '<button class="btn btn--primary" id="revelarBtn" style="display:block;margin:0 auto">Revelar minha Patente →</button>' +
          '</div>';
        const btn = document.getElementById('revelarBtn');
        if (btn) btn.addEventListener('click', () => {
          state.revealed = true;
          save();
          render();
        });
      } else {
        quizResult.textContent = answered + '/' + TOTAL_AFIRM + ' afirmações respondidas';
      }
    }
  }

  function renderReveal(ri) {
    const rank = RANKS[ri] || {};
    const score = diagScore();
    quizResult.innerHTML =
      '<div class="diag-result">' +
        '<svg class="diag-result-img" viewBox="0 0 120 220"><use href="' + (rank.sym || '#char-0') + '"/></svg>' +
        '<div class="diag-result-score">' + score + '<span>/' + (TOTAL_AFIRM * PONTO_MAX) + '</span></div>' +
        '<div class="diag-result-rank">' + rank.icon + ' ' + rank.name + ' — ' + rank.tag + '</div>' +
        '<div class="diag-result-desc">' + rank.desc + '</div>' +
        '<ul class="diag-result-carac">' + (rank.carac || []).map(c => '<li>' + c + '</li>').join('') + '</ul>' +
        '<div class="diag-result-proximo-titulo">Próximos passos:</div>' +
        '<ul class="diag-result-proximo">' + (rank.proximo || []).map(p => '<li>' + p + '</li>').join('') + '</ul>' +
        '<div class="diag-result-frase">' + rank.frase + '</div>' +
        '<p class="diag-result-lock">🔒 Resultado bloqueado. Para refazer, solicite ao admin o reset do seu progresso.</p>' +
      '</div>';
    if (!reduce && rankHud) {
      rankHud.classList.remove('levelup'); void rankHud.offsetWidth; rankHud.classList.add('levelup');
    }
  }

  // ---- Quais treinamentos esta pessoa pode fazer -------------------------
  /* Regra: está inscrita (confirmada) numa turma; a turma pertence a um
     evento; o treinamento está associado a esse evento. Admin vê todos,
     mesma regra da Avaliação — para conseguir revisar antes de liberar. */
  function carregarDisponiveis(cb) {
    const sess = window.faAuth && window.faAuth.getSession && window.faAuth.getSession();
    if (!sess || !window.firebase || !firebase.database) { cb([], false); return; }

    Promise.all([
      firebase.database().ref('treinamentos').once('value'),
      /* Conteúdo criado no painel. Vem junto porque a lista de treinamentos
         disponíveis depende dele: treinamento sem conteúdo utilizável não
         pode ser oferecido a quem vai responder. */
      firebase.database().ref('treinamentos-conteudo').once('value').catch(function () { return null; }),
    ]).then(function (res) {
      const tSnap = res[0];
      CONTEUDOS_BANCO = (res[1] && res[1].val && res[1].val()) || {};
      const todos = tSnap.val() || {};
      const lista = Object.keys(todos).map(function (k) {
        const t = todos[k] || {};
        return {
          key: k, nome: t.nome || k, conteudoKey: t.conteudoKey || '',
          eventos: t.eventos || {}, order: t.order || 0
        };
      }).sort(function (a, b) { return a.order - b.order; });

      /* Distingue "ainda não existe treinamento nenhum" de "existem, mas
         nenhum é dos eventos dela" — o primeiro caso não pode tirar acesso
         de quem já tinha. */
      if (!lista.length) { cb([], true); return; }

      /* Conteúdo pela metade não chega a quem responde. Um treinamento criado
         no painel nasce vazio — é assim que se cria — e entre criar e terminar
         de escrever as afirmações existe uma janela em que ele já está ligado
         a um evento. Oferecer ali é entregar um quiz sem pergunta, ou um
         resultado sem patente: a pessoa responde tudo e não recebe nada, sem
         nenhum erro na tela. O painel mostra exatamente o que falta. */
      const prontos = lista.filter(function (t) {
        if (!CONTRATO) return true;
        return !CONTRATO.problemas(conteudoDe(t)).length;
      });

      /* Admin vê todos, inclusive os que ainda não estão prontos: é quem
         precisa revisar antes de liberar — e é quem consegue consertar. */
      if (window.faAuth.isAdmin && window.faAuth.isAdmin(sess.email)) { cb(lista, false); return; }

      const uKey = emailKey(sess.email);
      firebase.database().ref('turmas-interesse').once('value').then(function (iSnap) {
        const interesse = iSnap.val() || {};
        const minhasTurmas = Object.keys(interesse).filter(function (tk) {
          const r = interesse[tk] && interesse[tk][uKey];
          return r && !r.removed && r.status === 'inscrito';
        });
        if (!minhasTurmas.length) { cb([], false); return; }

        firebase.database().ref('turmas').once('value').then(function (turSnap) {
          const turmas = turSnap.val() || {};
          const meusEventos = {};
          minhasTurmas.forEach(function (tk) {
            const ev = turmas[tk] && turmas[tk].eventoKey;
            if (ev) meusEventos[ev] = true;
          });
          cb(prontos.filter(function (t) {
            return Object.keys(t.eventos).some(function (ev) {
              return t.eventos[ev] && meusEventos[ev];
            });
          }), false);
        });
      });
    }).catch(function () { cb([], false); });
  }

  function setTreinoNavVisible(visible) {
    document.querySelectorAll('.nav-link-trein').forEach(function (el) { el.hidden = !visible; });
  }

  /* Seletor só aparece com mais de um treinamento — com um só ele é ruído,
     mesma regra dos filtros do painel. */
  function renderSeletor() {
    const box = $('treinamentoSeletor');
    if (!box) return;
    if (DISPONIVEIS.length < 2) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML =
      '<span class="treino-seletor-label">Treinamento:</span>' +
      '<select class="treino-seletor-select">' +
        DISPONIVEIS.map(function (t) {
          return '<option value="' + t.key + '"' + (t.key === TREINO_ATIVO ? ' selected' : '') + '>' +
            String(t.nome).replace(/[&<>"]/g, function (c) {
              return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
            }) + '</option>';
        }).join('') +
      '</select>';
    const sel = box.querySelector('.treino-seletor-select');
    sel.addEventListener('change', function () { selecionar(sel.value); });
  }

  function selecionar(key) {
    const t = DISPONIVEIS.filter(function (x) { return x.key === key; })[0];
    if (!t) return;
    TREINO_ATIVO = t.key;
    aplicarConteudoResolvido(conteudoDe(t));
    buildQuiz();
    carregarEstado();
    render();
    renderSeletor();
    avisarConteudoIncompleto(t);
  }

  /* O admin é o único que enxerga um treinamento ainda incompleto, e
     precisa saber POR QUE ele não chegou a ninguém — senão a conclusão
     natural é que o site está quebrado, e não que falta escrever o
     conteúdo. A mesma lista de problemas que o painel mostra. */
  function avisarConteudoIncompleto(t) {
    const box = $('treinoIncompleto');
    if (!box) return;
    const sess = window.faAuth && window.faAuth.getSession && window.faAuth.getSession();
    const isAdmin = !!(sess && window.faAuth.isAdmin && window.faAuth.isAdmin(sess.email));
    const faltas = (CONTRATO && isAdmin) ? CONTRATO.problemas(conteudoDe(t)) : [];
    if (!faltas.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML =
      '<strong>Este treinamento ainda não está pronto</strong> — só você, como admin, está vendo. ' +
      'Quem está inscrita não vê enquanto faltar: ' +
      '<ul class="treino-incompleto-lista">' +
        faltas.map(f => '<li>' + esc(f) + '</li>').join('') +
      '</ul>' +
      '<span class="treino-incompleto-onde">Painel Admin → aba Treinamentos → ✎ Editar conteúdo.</span>';
  }

  // ---- Welcome / sem acesso / conteúdo -----------------------------------
  function aplicarAcesso() {
    const welcome   = $('treinamento-welcome');
    const gameWrap  = $('treinamento');
    const semAcesso = $('treinamento-sem-acesso');
    const sess = window.faAuth && window.faAuth.getSession && window.faAuth.getSession();

    if (!sess) {
      setTreinoNavVisible(false);
      if (welcome)   welcome.hidden   = false;
      if (gameWrap)  gameWrap.hidden  = true;
      if (semAcesso) semAcesso.hidden = true;
      return;
    }
    if (welcome) welcome.hidden = true;

    const isAdmin = !!(window.faAuth.isAdmin && window.faAuth.isAdmin(sess.email));

    carregarDisponiveis(function (lista, semCadastro) {
      DISPONIVEIS = lista;

      /* Enquanto NENHUM treinamento estiver cadastrado, vale o comportamento
         anterior: quem é inscrita (ou admin) continua vendo o treinamento
         padrão. O registro no banco é criado quando um admin abre o painel —
         sem esta salvaguarda, entre o deploy e essa primeira abertura o
         Treinamento sumiria do site para todo mundo, inclusive para o admin
         que precisa justamente entrar no painel para resolver. */
      if (semCadastro) {
        const nivel = window.faAuth.getAccessLevel && window.faAuth.getAccessLevel();
        const podeLegado = isAdmin || nivel === 'enrolled';
        setTreinoNavVisible(podeLegado);
        if (!podeLegado) {
          if (gameWrap)  gameWrap.hidden  = true;
          if (semAcesso) semAcesso.hidden = false;
          return;
        }
        if (semAcesso) semAcesso.hidden = true;
        if (gameWrap)  gameWrap.hidden  = false;
        TREINO_ATIVO = null;
        aplicarConteudo((window.faGameData || {}).CONTEUDO_KEY || 'jedi');
        buildQuiz();
        carregarEstado();
        render();
        renderSeletor();
        return;
      }

      /* Admin enxerga o link sempre que existir treinamento cadastrado, mesmo
         não estando inscrita em turma nenhuma — é quem administra. */
      setTreinoNavVisible(isAdmin || lista.length > 0);
      if (!lista.length) {
        if (gameWrap)  gameWrap.hidden  = true;
        if (semAcesso) semAcesso.hidden = false;
        return;
      }
      if (semAcesso) semAcesso.hidden = true;
      if (gameWrap)  gameWrap.hidden  = false;
      const manter = TREINO_ATIVO && lista.some(function (t) { return t.key === TREINO_ATIVO; });
      selecionar(manter ? TREINO_ATIVO : lista[0].key);
    });
  }

  (function () {
    const jedBtn = document.getElementById('jedWelcomeBtn');
    if (jedBtn) jedBtn.addEventListener('click', function () {
      if (window.faOpenAuthModal) window.faOpenAuthModal('login');
    });
    aplicarAcesso();
    window.addEventListener('fa-auth-change', aplicarAcesso);
    if (window.faRouter && window.faRouter.onPageInit) {
      window.faRouter.onPageInit('treinamento', aplicarAcesso);
    }
  })();

  window.faGameRender = render;
  window.faGameReload = function () {
    carregarEstado();
    render();
  };
  /* Usado pelos testes: qual treinamento está sendo respondido agora. */
  window.faGameTreinamentoAtivo = function () { return TREINO_ATIVO; };
  /* Usado pelos testes: as patentes do conteúdo ativo, que são as que a
     escada tem que estar mostrando. */
  window.faGamePatentes = function () { return RANKS.slice(); };

  /* Primeira pintura antes da resposta do banco: sem treinamento resolvido
     ainda, usa o conteúdo padrão só para o DOM não nascer vazio. */
  aplicarConteudo((window.faGameData || {}).CONTEUDO_KEY || 'jedi');
  buildQuiz();
  carregarEstado();
  render();
})();
