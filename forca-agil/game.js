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

  /* ── Histórico de resultados ────────────────────────────────────────
     "a própria pessoa precisa ter uma forma de fazer outra [rodada]" —
     relatado no uso real, contra a mensagem antiga ("resultado
     bloqueado, peça ao admin"). Refazer não pode custar o resultado
     anterior: cada revelação grava uma linha nova em
     fa-progress-historico/<eKey>/<treino>, e refazer só reabre o quiz
     — não apaga o que já foi revelado. */
  function emailAtual() {
    const p = getPlayer();
    if (p && p.email) return p.email;
    const sess = window.faAuth && window.faAuth.getSession && window.faAuth.getSession();
    return (sess && sess.email) || '';
  }
  function historicoPath() {
    const eKey = emailKey(emailAtual());
    if (!eKey) return null;
    return 'fa-progress-historico/' + eKey + '/' + (TREINO_ATIVO || '_');
  }
  function registrarHistorico(ri) {
    const path = historicoPath();
    if (!path || !window.firebase || !firebase.database) return;
    const rank = RANKS[ri] || {};
    /* push() sem valor + set() no ref filho, não push(valor): é o mesmo
       padrão do resto do site (ver aposta.js) — e o único que o Firebase
       falso dos testes sabe seguir. */
    const ref = firebase.database().ref(path).push();
    ref.set({
      score: diagScore(),
      totalMax: TOTAL_AFIRM * PONTO_MAX,
      rankName: rank.name || '',
      rankTag: rank.tag || '',
      respondidoEm: new Date().toISOString()
    }, function (e) { if (e) console.warn('registrarHistorico error:', e); });
  }
  function fmtDataHistorico(iso) {
    try {
      const d = new Date(iso);
      if (isNaN(d)) return '';
      return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }
  /* Lê e desenha por fora do render() geral: renderReveal já reconstrói o
     HTML do resultado a cada chamada, e esperar a leitura do banco para
     terminar de montar essa tela deixaria a patente sem aparecer por um
     instante. O histórico enche a área dele à parte, quando a leitura
     responder. */
  function carregarHistoricoEExibir() {
    const box = document.getElementById('diagHistorico');
    if (!box) return;
    const path = historicoPath();
    if (!path || !window.firebase || !firebase.database) { box.innerHTML = ''; return; }
    firebase.database().ref(path).once('value').then(function (snap) {
      const v = snap.val() || {};
      const itens = Object.keys(v).map(function (k) { return v[k]; })
        .sort(function (a, b) { return String(b.respondidoEm || '').localeCompare(String(a.respondidoEm || '')); });
      if (!itens.length) { box.innerHTML = ''; return; }
      box.innerHTML =
        '<p class="diag-historico-titulo">Seu histórico — ' + itens.length +
          (itens.length === 1 ? ' resultado' : ' resultados') + '</p>' +
        '<ul class="diag-historico-lista">' +
          itens.map(function (it) {
            return '<li>' +
              '<span class="diag-historico-data">' + esc(fmtDataHistorico(it.respondidoEm)) + '</span>' +
              '<span class="diag-historico-rank">' + esc(it.rankName || '') + '</span>' +
              '<span class="diag-historico-score">' + (it.score != null ? it.score : '—') + '/' + (it.totalMax != null ? it.totalMax : '—') + '</span>' +
            '</li>';
          }).join('') +
        '</ul>';
    }).catch(function () { box.innerHTML = ''; });
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

  /* ── Cartão do treinamento ────────────────────────────────────────
     Fechado por padrão, do mesmo peso visual do convite da Construção
     da Aposta logo acima (.convite-card) — antes este bloco era um
     banner grande, sempre expandido, ao lado de um convite pequeno e
     fechado: pareciam duas telas diferentes empilhadas. Ver a nota no
     HTML (index.html, dentro de #treinamento). */
  const treinoCard        = $('treinoCard');
  const treinoCardTitulo  = $('treinoCardTitulo');
  const treinoCardSub     = $('treinoCardSub');
  const treinoCardStatus  = $('treinoCardStatus');
  const treinoCardToggle  = $('treinoCardToggle');
  const treinoCardCorpo   = $('treinoCardCorpo');
  const treinoCardRecolher = $('treinoCardRecolher');
  let cardAberto = false;

  function abrirFecharCartao(aberto) {
    cardAberto = aberto;
    atualizarCartao();
    if (aberto && treinoCardCorpo) {
      treinoCardCorpo.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    } else if (!aberto && treinoCard) {
      treinoCard.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  }
  if (treinoCardToggle)   treinoCardToggle.addEventListener('click', function () { abrirFecharCartao(!cardAberto); });
  if (treinoCardRecolher) treinoCardRecolher.addEventListener('click', function () { abrirFecharCartao(false); });

  /* O nome do treinamento ativo, para o título do cartão — sem
     treinamento cadastrado (modo legado) ou treinamento não encontrado,
     mantém o "Sociedade Jedi" que já está escrito no HTML. */
  function nomeTreinoAtivo() {
    if (!TREINO_ATIVO) return '';
    const t = DISPONIVEIS.filter(function (x) { return x.key === TREINO_ATIVO; })[0];
    return t ? t.nome : '';
  }

  /* Resumo de uma linha: o que dá para saber sem abrir o cartão — a
     mesma função de "turma · ensaio" no convite da Aposta. */
  function statusResumoTreino() {
    if (!TOTAL_AFIRM) return '';
    if (state.revealed) {
      const rank = RANKS[diagRankIdx()] || {};
      return (rank.icon ? rank.icon + ' ' : '') + 'Patente revelada: ' + (rank.name || '—');
    }
    const answered = state.quiz.filter(function (v) { return v != null; }).length;
    if (answered >= TOTAL_AFIRM) return 'Pronto para revelar — todas as afirmações respondidas.';
    if (answered) return answered + '/' + TOTAL_AFIRM + ' afirmações respondidas';
    return 'Ainda não iniciado';
  }

  function atualizarCartao() {
    if (!treinoCard) return;
    const nome = nomeTreinoAtivo();
    if (treinoCardTitulo && nome) treinoCardTitulo.textContent = nome;
    if (treinoCardSub && TOTAL_AFIRM) {
      treinoCardSub.textContent = 'Responda as ' + TOTAL_AFIRM + ' afirmações e descubra sua patente.';
    }
    if (treinoCardStatus) treinoCardStatus.textContent = statusResumoTreino();
    if (treinoCardCorpo)  treinoCardCorpo.hidden = !cardAberto;
    if (treinoCardToggle) treinoCardToggle.textContent = cardAberto ? '← Recolher' : 'Abrir treinamento →';
  }

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

    atualizarCartao();

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
          registrarHistorico(ri);
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
        '<div class="diag-result-acoes">' +
          '<button type="button" class="btn btn--sm" id="refazerBtn">🔁 Refazer autodiagnóstico</button>' +
        '</div>' +
        '<div class="diag-historico" id="diagHistorico"><p class="diag-historico-carregando">Carregando seu histórico…</p></div>' +
      '</div>';
    if (!reduce && rankHud) {
      rankHud.classList.remove('levelup'); void rankHud.offsetWidth; rankHud.classList.add('levelup');
    }
    const refazerBtn = document.getElementById('refazerBtn');
    if (refazerBtn) refazerBtn.addEventListener('click', refazerDiagnostico);
    carregarHistoricoEExibir();
  }

  /* Refazer NÃO é resetar: o resultado que está na tela já foi gravado no
     histórico (na revelação); esta ação só reabre o quiz para uma rodada
     nova, sem tocar no que já foi respondido antes — é a diferença entre
     isto e "solicitar ao admin o reset do progresso", que apaga tudo.
     A confirmação é um modal próprio, não window.confirm — é a mesma
     linguagem visual do resto do site (adminConfirm no painel), em vez
     de um diálogo nativo do navegador. */
  function confirmarRefazer(cb) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';
    const box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:420px;width:90%;padding:26px;display:flex;flex-direction:column;gap:16px';
    box.innerHTML =
      '<p style="margin:0;font-size:.95rem;line-height:1.6;color:var(--ink)">Refazer o autodiagnóstico?</p>' +
      '<p style="margin:0;font-size:.84rem;color:var(--ink-3)">Suas respostas atuais serão substituídas por uma rodada nova. O resultado de agora já está no seu histórico.</p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px">' +
        '<button type="button" class="btn" id="refazerCancelar">Cancelar</button>' +
        '<button type="button" class="btn btn--primary" id="refazerConfirmar">Refazer</button>' +
      '</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function fechar() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
    box.querySelector('#refazerCancelar').addEventListener('click', fechar);
    box.querySelector('#refazerConfirmar').addEventListener('click', function () { fechar(); cb(); });
  }
  function refazerDiagnostico() {
    confirmarRefazer(function () {
      state = { quiz: new Array(TOTAL_AFIRM).fill(null), revealed: false };
      save();
      render();
      if (qList) qList.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
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
    /* Troca de conteúdo debaixo do cartão — fecha, para não deixar o
       corpo de um treinamento aberto sobre o resumo de outro. */
    cardAberto = false;
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
