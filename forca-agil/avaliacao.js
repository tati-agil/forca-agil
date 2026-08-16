/* Força Ágil — Avaliação da Oficina */
(function () {
  'use strict';

  var EMOJIS = ['😡','😠','😞','😕','😐','😶','🙂','😊','😃','🤩','🚀'];

  var ORG_ITENS = [
    { key: 'planejamento', label: '📅 Organização e planejamento' },
    { key: 'horarios',     label: '⏰ Cumprimento dos horários' },
    { key: 'comunicacao',  label: '📢 Comunicação antes e durante' },
    { key: 'clareza',      label: '🧭 Clareza da programação' },
    { key: 'estrutura',    label: '🏫 Estrutura e ambiente' },
    { key: 'atividades',   label: '🎯 Organização das atividades' },
  ];

  var FAC_ITENS = [
    { key: 'clareza',   label: 'Clareza das explicações' },
    { key: 'dominio',   label: 'Domínio do assunto' },
    { key: 'duvidas',   label: 'Capacidade de responder dúvidas' },
    { key: 'interacao', label: 'Interação com os participantes' },
    { key: 'dinamicas', label: 'Condução das dinâmicas' },
    { key: 'pratica',   label: 'Conexão entre teoria e prática' },
  ];

  var TEMAS = [
    'Agilidade Organizacional','Scrum','Kanban','Lean','OKRs',
    'Liderança Ágil','Gestão de Produtos','Product Discovery',
    'Design Thinking','Lean Inception','Gestão da Mudança','Cultura Ágil',
    'Pensamento Sistêmico','Métricas e indicadores','Gestão de Portfólio',
    'Estratégia','IA aplicada à Agilidade',
  ];

  var MATERIAIS = [
    'E-books','Artigos','Vídeos','Templates','Canvas','Checklists',
    'Exemplos práticos','Cases da Previ','Guias passo a passo',
    'Apresentações','Jogos e dinâmicas','Trilhas de aprendizagem',
    'Cursos externos','Podcasts','Ferramentas digitais',
  ];

  var FERRAMENTAS = [
    'Jira','Azure DevOps','Trello','Miro','Mural','Microsoft Planner',
    'Power BI','ServiceNow','Microsoft Copilot','ChatGPT / IA',
    'Ferramentas de OKR','Ferramentas de Discovery',
  ];

  function emailKey(e) {
    return (e || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
  }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Builders de widget ── */

  function ratingHtml(fieldId) {
    var h = '<div class="aval-rating" data-field="' + fieldId + '" role="group">';
    for (var i = 0; i <= 10; i++) {
      h += '<button type="button" class="aval-rating-btn" data-val="' + i + '" title="' + i + ' — ' + EMOJIS[i] + '">' +
        '<span class="aval-rating-num">' + i + '</span>' +
        '<span class="aval-rating-emoji">' + EMOJIS[i] + '</span></button>';
    }
    h += '</div>';
    return h;
  }

  function checkgroupHtml(fieldId, items) {
    var h = '<div class="aval-checks" data-field="' + fieldId + '">';
    items.forEach(function (item) {
      h += '<label class="aval-check-chip"><input type="checkbox" value="' + esc(item) + '"><span>' + esc(item) + '</span></label>';
    });
    h += '</div>';
    return h;
  }

  function radioHtml(fieldId, opts) {
    var h = '<div class="aval-radios" data-field="' + fieldId + '">';
    opts.forEach(function (o) {
      h += '<label class="aval-radio"><input type="radio" name="aval_' + fieldId + '" value="' + esc(o.val) + '"><span>' + esc(o.label) + '</span></label>';
    });
    h += '</div>';
    return h;
  }

  function textareaHtml(fieldId, placeholder) {
    return '<textarea class="aval-textarea" data-field="' + fieldId + '" placeholder="' + esc(placeholder) + '" rows="3"></textarea>';
  }

  function textHtml(fieldId, placeholder) {
    return '<input type="text" class="aval-text" data-field="' + fieldId + '" placeholder="' + esc(placeholder) + '">';
  }

  function sectionHtml(num, icon, title, body) {
    return '<section class="aval-section">' +
      '<div class="aval-section-hdr">' +
        '<span class="aval-section-num">' + num + '</span>' +
        '<span class="aval-section-icon">' + icon + '</span>' +
        '<h3 class="aval-section-title">' + esc(title) + '</h3>' +
      '</div>' +
      '<div class="aval-section-body">' + body + '</div>' +
      '</section>';
  }

  function qHtml(label, content) {
    return '<div class="aval-question"><p class="aval-q-label">' + label + '</p>' + content + '</div>';
  }

  function subItemsHtml(prefix, items) {
    var h = '<div class="aval-subitems">';
    items.forEach(function (item) {
      h += '<div class="aval-subitem">' +
        '<span class="aval-subitem-label">' + esc(item.label) + '</span>' +
        ratingHtml(prefix + item.key) +
        '</div>';
    });
    h += '</div>';
    return h;
  }

  /* ── Construção do formulário ── */

  function buildFormHtml(turmaLabel) {
    var h = '<div class="aval-form-header">' +
      '<p class="aval-intro">Sua avaliação ajuda a Força Ágil a evoluir, melhorar as próximas oficinas e criar conteúdos cada vez mais úteis para o seu dia a dia.</p>' +
      '<div class="aval-turma-tag">Turma: <strong>' + esc(turmaLabel) + '</strong></div>' +
      '</div>';

    h += '<form id="avaliacaoForm" novalidate>';

    /* 1 — Nota geral */
    h += sectionHtml(1, '⭐', 'Avaliação geral da oficina',
      qHtml('De 0 a 10, qual nota você daria para a oficina?', ratingHtml('notaGeral'))
    );

    /* 2 — NPS */
    h += sectionHtml(2, '🎯', 'NPS — Você indicaria?',
      qHtml('De 0 a 10, quanto você indicaria esta Oficina para um colega?<br><small style="color:var(--ink-3)">0 = De jeito nenhum · 10 = Com certeza</small>', ratingHtml('npsNota')) +
      qHtml('O que fez você dar essa nota?', textareaHtml('npsMotivo', 'Conte-nos o motivo da sua avaliação...'))
    );

    /* 3 — Organização */
    h += sectionHtml(3, '🗓️', 'Organização',
      qHtml('Avaliação geral da organização (0 a 10)', ratingHtml('orgGeral')) +
      '<p class="aval-q-label" style="margin-top:20px">Como você avalia cada item:</p>' +
      subItemsHtml('org_', ORG_ITENS)
    );

    /* 4 — Conteúdo */
    h += sectionHtml(4, '🎓', 'Conteúdo',
      qHtml('O conteúdo apresentado foi relevante para você? (0 a 10)', ratingHtml('conteudoRelevancia')) +
      qHtml('O conteúdo foi aplicável ao seu trabalho? (0 a 10)', ratingHtml('conteudoAplicacao')) +
      qHtml('O nível de profundidade dos conteúdos foi:',
        radioHtml('conteudoProfundidade', [
          { val: 'muito_superficial', label: 'Muito superficial' },
          { val: 'superficial',       label: 'Superficial' },
          { val: 'adequado',          label: 'Adequado' },
          { val: 'profundo',          label: 'Profundo' },
          { val: 'muito_profundo',    label: 'Muito profundo' },
        ])
      ) +
      qHtml('Qual conteúdo você mais gostou?', textareaHtml('conteudoGostou', 'Conte aqui...')) +
      qHtml('Qual conteúdo você gostaria que fosse aprofundado?', textareaHtml('conteudoAprofundar', 'Conte aqui...'))
    );

    /* 5 — Facilitadores */
    h += sectionHtml(5, '🧑‍🏫', 'Facilitadores',
      qHtml('Avaliação geral dos facilitadores (0 a 10)', ratingHtml('facilitadoresNota')) +
      '<p class="aval-q-label" style="margin-top:20px">Como você avalia cada item:</p>' +
      subItemsHtml('fac_', FAC_ITENS) +
      qHtml('O que você mais gostou na condução da oficina?', textareaHtml('facilitadoresGostou', 'Conte aqui...'))
    );

    /* 6 — Dinâmicas */
    h += sectionHtml(6, '🎮', 'Dinâmicas e experiência',
      qHtml('As dinâmicas ajudaram você a compreender os conceitos? (0 a 10)', ratingHtml('dinamicasNota')) +
      qHtml('O equilíbrio entre teoria e prática foi:',
        radioHtml('dinamicasEquilibrio', [
          { val: 'muito_ruim', label: '😕 Muito ruim' },
          { val: 'ruim',       label: '😐 Ruim' },
          { val: 'adequado',   label: '🙂 Adequado' },
          { val: 'bom',        label: '😃 Bom' },
          { val: 'excelente',  label: '🚀 Excelente' },
        ])
      ) +
      qHtml('Qual atividade ou dinâmica mais marcou você?', textareaHtml('dinamicasMarcou', 'Conte aqui...'))
    );

    /* 7 — Aplicação prática */
    h += sectionHtml(7, '🚀', 'Aplicação prática',
      qHtml('Depois da oficina, você se sente mais preparado para aplicar conceitos de Agilidade? (0 a 10)', ratingHtml('aplicacaoPreparado')) +
      qHtml('O que você pretende aplicar no seu trabalho?', textareaHtml('aplicacaoPlanos', 'Conte aqui...')) +
      qHtml('Você já aplicou alguma coisa aprendida na oficina?',
        radioHtml('aplicacaoStatus', [
          { val: 'sim',         label: 'Sim' },
          { val: 'ainda_nao',   label: 'Ainda não' },
          { val: 'pretendo',    label: 'Pretendo aplicar' },
          { val: 'ja_aplicava', label: 'Já aplicava antes' },
        ])
      ) +
      qHtml('Se sim, o quê?', textareaHtml('aplicacaoOque', 'Conte aqui...'))
    );

    /* 8 — Temas */
    h += sectionHtml(8, '💡', 'Temas que você quer aprender',
      qHtml('Sobre quais temas de Agilidade você gostaria de aprender mais?', checkgroupHtml('temasDesejados', TEMAS)) +
      qHtml('Outro tema:', textHtml('temasOutro', 'Qual?'))
    );

    /* 9 — Materiais */
    h += sectionHtml(9, '🧰', 'Materiais e ferramentas',
      qHtml('Que materiais você gostaria de encontrar na Força Ágil?', checkgroupHtml('materiaisDesejados', MATERIAIS)) +
      qHtml('Existe algum material específico que você gostaria que disponibilizássemos?', textareaHtml('materiaisEspecifico', 'Conte o que você precisa...'))
    );

    /* 10 — Ferramentas */
    h += sectionHtml(10, '🛠️', 'Ferramentas de Agilidade',
      qHtml('Quais ferramentas você gostaria de aprender a utilizar?', checkgroupHtml('ferramentasDesejadas', FERRAMENTAS)) +
      qHtml('Existe alguma ferramenta que você gostaria de ver em uma próxima oficina?', textareaHtml('ferramentasEspecifica', 'Qual ferramenta e para quê?'))
    );

    /* 11 — Continuar */
    h += sectionHtml(11, '❤️', 'O que devemos continuar fazendo?',
      qHtml('O que você mais gostou na Oficina de Agilidade?', textareaHtml('continuar', 'Conte pra gente...'))
    );

    /* 12 — Melhorar */
    h += sectionHtml(12, '🔧', 'O que devemos melhorar?',
      qHtml('O que poderia ser melhor na próxima oficina?', textareaHtml('melhorar', 'Seja sincero. Toda crítica é bem-vinda.'))
    );

    /* 13 — Espaço aberto */
    h += sectionHtml(13, '💬', 'Espaço aberto',
      qHtml('Tem alguma coisa que não perguntamos e você gostaria de compartilhar?', textareaHtml('espacoAberto', 'Escreva sua mensagem...'))
    );

    /* Submit */
    h += '<div class="aval-submit-wrap">' +
      '<p class="aval-privacy">🔒 Suas respostas são confidenciais e utilizadas exclusivamente para melhoria das iniciativas da Força Ágil.</p>' +
      '<button type="submit" class="btn aval-submit-btn">ENVIAR MINHA AVALIAÇÃO →</button>' +
      '<p class="aval-submit-msg" id="avalSubmitMsg" hidden></p>' +
      '</div>';

    h += '</form>';
    return h;
  }

  /* ── Tela de agradecimento ── */

  function thanksHtml(turmasLabel) {
    return '<div class="aval-thanks">' +
      '<div class="aval-thanks-icon">🚀</div>' +
      '<h2 class="aval-thanks-title">Obrigado por fazer parte da Força Ágil!</h2>' +
      '<p class="aval-thanks-sub">Seu feedback será utilizado para:</p>' +
      '<ul class="aval-thanks-list">' +
        '<li>🎯 Melhorar as oficinas</li>' +
        '<li>📚 Criar novos conteúdos</li>' +
        '<li>🧰 Disponibilizar materiais e ferramentas</li>' +
        '<li>💡 Identificar novos temas</li>' +
        '<li>🌱 Evoluir continuamente a comunidade</li>' +
      '</ul>' +
      (turmasLabel ? '<p class="aval-thanks-turmas">Avaliação enviada para: <strong>' + esc(turmasLabel) + '</strong></p>' : '') +
    '</div>';
  }

  /* ── Coleta dos dados do formulário ── */

  function collectData(form) {
    var data = {};

    form.querySelectorAll('.aval-rating').forEach(function (w) {
      var active = w.querySelector('.aval-rating-btn.active');
      if (active) data[w.dataset.field] = parseInt(active.dataset.val, 10);
    });

    form.querySelectorAll('.aval-textarea, .aval-text').forEach(function (el) {
      var v = el.value.trim();
      if (v) data[el.dataset.field] = v;
    });

    form.querySelectorAll('.aval-radios').forEach(function (w) {
      var checked = w.querySelector('input[type="radio"]:checked');
      if (checked) data[w.dataset.field] = checked.value;
    });

    form.querySelectorAll('.aval-checks').forEach(function (w) {
      var vals = Array.from(w.querySelectorAll('input:checked')).map(function (cb) { return cb.value; });
      if (vals.length) data[w.dataset.field] = vals;
    });

    /* Agrupa sub-itens em objetos aninhados */
    var orgItens = {};
    ORG_ITENS.forEach(function (item) {
      var k = 'org_' + item.key;
      if (data[k] !== undefined) { orgItens[item.key] = data[k]; delete data[k]; }
    });
    if (Object.keys(orgItens).length) data.orgItens = orgItens;

    var facItens = {};
    FAC_ITENS.forEach(function (item) {
      var k = 'fac_' + item.key;
      if (data[k] !== undefined) { facItens[item.key] = data[k]; delete data[k]; }
    });
    if (Object.keys(facItens).length) data.facItens = facItens;

    return data;
  }

  /* ── Setup dos widgets de nota ── */

  function setupRatings(container) {
    container.querySelectorAll('.aval-rating').forEach(function (w) {
      w.querySelectorAll('.aval-rating-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          w.querySelectorAll('.aval-rating-btn').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          /* Aplica cor progressiva baseada no valor */
          w.dataset.selected = btn.dataset.val;
        });
      });
    });
  }

  /* ── Renderização principal ── */

  function renderForm(c, turma, done, uKey, userName, userEmail) {
    var noticeHtml = done.length
      ? '<div class="aval-notice">✅ Avaliação já enviada para: ' + done.map(function (t) { return '<strong>' + esc(t.label) + '</strong>'; }).join(', ') + '</div>'
      : '';

    c.innerHTML = noticeHtml + buildFormHtml(turma.label);
    setupRatings(c);

    var form = document.getElementById('avaliacaoForm');
    var msg  = document.getElementById('avalSubmitMsg');
    var btn  = form.querySelector('.aval-submit-btn');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      btn.disabled = true;
      btn.textContent = 'Enviando…';
      if (msg) msg.hidden = true;

      var data = collectData(form);
      data.timestamp  = new Date().toISOString();
      data.userName   = userName;
      data.userEmail  = userEmail;
      data.turmaKey   = turma.key;
      data.turmaLabel = turma.label;

      firebase.database().ref('avaliacoes/' + turma.key + '/' + uKey).set(data)
        .then(function () {
          c.innerHTML = thanksHtml(turma.label);
        })
        .catch(function (err) {
          console.error('[avaliacao] save error', err);
          btn.disabled = false;
          btn.textContent = 'ENVIAR MINHA AVALIAÇÃO →';
          if (msg) { msg.textContent = 'Erro ao salvar. Tente novamente.'; msg.style.color = 'var(--red)'; msg.hidden = false; }
        });
    });
  }

  /* ── Init ── */

  function init() {
    var c = document.getElementById('avaliacaoContent');
    if (!c) return;

    var session = window.faAuth && window.faAuth.getSession();
    if (!session) { c.innerHTML = '<p class="loading-msg">Faça login para acessar a avaliação.</p>'; return; }

    var userEmail = session.email;
    var uKey      = emailKey(userEmail);
    var userName  = session.displayName || userEmail;

    c.innerHTML = '<p class="loading-msg">Carregando…</p>';

    firebase.database().ref('turmas-interesse').once('value').then(function (snap) {
      var data = snap.val() || {};
      var confirmedKeys = [];

      Object.keys(data).forEach(function (turmaKey) {
        var entry = (data[turmaKey] || {})[uKey];
        if (entry && entry.status === 'inscrito' && entry.confirmedByAdmin) {
          confirmedKeys.push(turmaKey);
        }
      });

      if (!confirmedKeys.length) {
        c.innerHTML = '<div class="aval-empty"><p>Você ainda não está inscrito em nenhuma turma.<br>A avaliação fica disponível após confirmação pelo administrador.</p></div>';
        return;
      }

      /* Carrega labels das turmas e verifica avaliações já enviadas */
      return Promise.all(confirmedKeys.map(function (tk) {
        return Promise.all([
          firebase.database().ref('turmas/' + tk).once('value'),
          firebase.database().ref('avaliacoes/' + tk + '/' + uKey).once('value'),
        ]).then(function (results) {
          var turmaSnap = results[0];
          var avalSnap  = results[1];
          var tData = turmaSnap.val() || {};
          return { key: tk, label: tData.label || tk, evaluated: !!avalSnap.val() };
        });
      })).then(function (turmas) {
        var pending = turmas.filter(function (t) { return !t.evaluated; });
        var done    = turmas.filter(function (t) { return t.evaluated; });

        if (!pending.length) {
          /* Todas avaliadas */
          c.innerHTML = thanksHtml(done.map(function (t) { return t.label; }).join(', '));
          return;
        }

        /* Usa a primeira turma pendente (edge case: raramente mais de uma) */
        renderForm(c, pending[0], done, uKey, userName, userEmail);
      });
    }).catch(function (err) {
      console.error('[avaliacao]', err);
      c.innerHTML = '<p class="loading-msg" style="color:var(--red)">Erro ao carregar. Recarregue a página.</p>';
    });
  }

  if (window.faRouter && window.faRouter.onPageInit) {
    window.faRouter.onPageInit('avaliacao', init);
  }

  window.faAvaliacao = { init: init };
})();
