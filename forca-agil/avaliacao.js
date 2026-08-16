/* Força Ágil — Avaliação da Oficina v2 (accordion + rascunho + progresso) */
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

  /* Definição das seções — pField = campo principal (verifica se seção foi respondida) */
  var SECS = [
    { id:'s1',  n:1,  icon:'⭐',   title:'O que você achou da Oficina?',       sub:'De 0 a 10, qual nota você daria para a oficina?',                        req:true,  pField:'notaGeral',           pType:'rating' },
    { id:'s2',  n:2,  icon:'🎯',   title:'NPS — Você indicaria?',              sub:'De 0 a 10, quanto você indicaria esta Oficina para um colega?',          req:true,  pField:'npsNota',             pType:'rating' },
    { id:'s3',  n:3,  icon:'🗓️',  title:'Organização da oficina',             sub:'Avalie a organização e estrutura da oficina.',                           req:true,  pField:'orgGeral',            pType:'rating' },
    { id:'s4',  n:4,  icon:'🎓',   title:'Conteúdo',                           sub:'Avalie o conteúdo apresentado e sua aplicabilidade.',                    req:true,  pField:'conteudoRelevancia',  pType:'rating' },
    { id:'s5',  n:5,  icon:'🧑‍🏫', title:'Facilitadores',                      sub:'Como você avalia os instrutores/facilitadores da oficina?',              req:true,  pField:'facilitadoresNota',   pType:'rating' },
    { id:'s6',  n:6,  icon:'🎮',   title:'Dinâmicas e experiência',            sub:'Avalie as dinâmicas, atividades e sua experiência geral.',               req:true,  pField:'dinamicasNota',       pType:'rating' },
    { id:'s7',  n:7,  icon:'🚀',   title:'Aplicação prática',                  sub:'Como você pretende aplicar o que aprendeu?',                            req:true,  pField:'aplicacaoPreparado',  pType:'rating' },
    { id:'s8',  n:8,  icon:'💡',   title:'Temas que você quer aprender',       sub:'Temas de Agilidade que você gostaria de aprender mais.',                 req:false, pField:'temasDesejados',      pType:'checks' },
    { id:'s9',  n:9,  icon:'🧰',   title:'Materiais e ferramentas',            sub:'Materiais e conteúdos que você gostaria de ter acesso.',                 req:false, pField:'materiaisDesejados',  pType:'checks' },
    { id:'s10', n:10, icon:'🛠️',  title:'Ferramentas de Agilidade',           sub:'Quais ferramentas você gostaria de aprender a utilizar?',                req:false, pField:'ferramentasDesejadas',pType:'checks' },
    { id:'s11', n:11, icon:'❤️',   title:'O que devemos continuar fazendo?',   sub:'O que você mais gostou na Oficina de Agilidade?',                        req:false, pField:'continuar',           pType:'text'   },
    { id:'s12', n:12, icon:'🔧',   title:'O que devemos melhorar?',            sub:'O que poderia ser melhor na próxima oficina?',                           req:false, pField:'melhorar',            pType:'text'   },
    { id:'s13', n:13, icon:'💬',   title:'Espaço aberto',                      sub:'Algo que não perguntamos e você gostaria de compartilhar.',              req:false, pField:'espacoAberto',        pType:'text'   },
  ];

  /* ── Helpers ── */

  function emailKey(e) {
    return (e||'').toLowerCase().replace(/[@.]/g,'_').replace(/[^a-z0-9_]/g,'').slice(0,64);
  }
  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Widget builders ── */

  function ratingHtml(fieldId) {
    var h = '<div class="aval-rating" data-field="' + fieldId + '">';
    for (var i = 0; i <= 10; i++) {
      h += '<button type="button" class="aval-rating-btn" data-val="' + i + '" title="' + i + '">' +
        '<span class="aval-rating-num">' + i + '</span>' +
        '<span class="aval-rating-emoji">' + EMOJIS[i] + '</span></button>';
    }
    h += '</div>';
    return h;
  }

  function ratingLabelsHtml() {
    return '<div class="aval-rating-labels"><span>Péssimo</span><span>Excepcional</span></div>';
  }

  function checkgroupHtml(fieldId, items) {
    var h = '<div class="aval-checks" data-field="' + fieldId + '">';
    items.forEach(function(item) {
      h += '<label class="aval-check-chip"><input type="checkbox" value="' + esc(item) + '"><span>' + esc(item) + '</span></label>';
    });
    h += '</div>';
    return h;
  }

  function radioHtml(fieldId, opts) {
    var h = '<div class="aval-radios" data-field="' + fieldId + '">';
    opts.forEach(function(o) {
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

  function qHtml(label, content) {
    return '<div class="aval-question"><p class="aval-q-label">' + label + '</p>' + content + '</div>';
  }

  function subItemsHtml(prefix, items) {
    var h = '<div class="aval-subitems">';
    items.forEach(function(item) {
      h += '<div class="aval-subitem"><span class="aval-subitem-label">' + esc(item.label) + '</span>' + ratingHtml(prefix + item.key) + '</div>';
    });
    h += '</div>';
    return h;
  }

  /* ── Conteúdo de cada seção ── */

  function sectionContent(sec) {
    switch (sec.id) {
      case 's1': return (
        qHtml('De 0 a 10, qual nota você daria para a oficina?', ratingHtml('notaGeral') + ratingLabelsHtml())
      );
      case 's2': return (
        qHtml('De 0 a 10, quanto você indicaria esta Oficina para um colega?<br><small style="color:var(--ink-3)">0 = De jeito nenhum · 10 = Com certeza</small>', ratingHtml('npsNota') + ratingLabelsHtml()) +
        qHtml('O que fez você dar essa nota?', textareaHtml('npsMotivo', 'Conte-nos o motivo da sua avaliação...'))
      );
      case 's3': return (
        qHtml('Avaliação geral da organização (0 a 10)', ratingHtml('orgGeral') + ratingLabelsHtml()) +
        '<p class="aval-q-label" style="margin-top:16px">Como você avalia cada item:</p>' +
        subItemsHtml('org_', ORG_ITENS)
      );
      case 's4': return (
        qHtml('O conteúdo apresentado foi relevante para você? (0 a 10)', ratingHtml('conteudoRelevancia') + ratingLabelsHtml()) +
        qHtml('O conteúdo foi aplicável ao seu trabalho? (0 a 10)', ratingHtml('conteudoAplicacao') + ratingLabelsHtml()) +
        qHtml('O nível de profundidade dos conteúdos foi:',
          radioHtml('conteudoProfundidade', [
            {val:'muito_superficial',label:'Muito superficial'},
            {val:'superficial',label:'Superficial'},
            {val:'adequado',label:'Adequado'},
            {val:'profundo',label:'Profundo'},
            {val:'muito_profundo',label:'Muito profundo'},
          ])
        ) +
        qHtml('Qual conteúdo você mais gostou?', textareaHtml('conteudoGostou','Conte aqui...')) +
        qHtml('Qual conteúdo você gostaria que fosse aprofundado?', textareaHtml('conteudoAprofundar','Conte aqui...'))
      );
      case 's5': return (
        qHtml('Avaliação geral dos facilitadores (0 a 10)', ratingHtml('facilitadoresNota') + ratingLabelsHtml()) +
        '<p class="aval-q-label" style="margin-top:16px">Como você avalia cada item:</p>' +
        subItemsHtml('fac_', FAC_ITENS) +
        qHtml('O que você mais gostou na condução da oficina?', textareaHtml('facilitadoresGostou','Conte aqui...'))
      );
      case 's6': return (
        qHtml('As dinâmicas ajudaram você a compreender os conceitos? (0 a 10)', ratingHtml('dinamicasNota') + ratingLabelsHtml()) +
        qHtml('O equilíbrio entre teoria e prática foi:',
          radioHtml('dinamicasEquilibrio', [
            {val:'muito_ruim',label:'😕 Muito ruim'},
            {val:'ruim',label:'😐 Ruim'},
            {val:'adequado',label:'🙂 Adequado'},
            {val:'bom',label:'😃 Bom'},
            {val:'excelente',label:'🚀 Excelente'},
          ])
        ) +
        qHtml('Qual atividade ou dinâmica mais marcou você?', textareaHtml('dinamicasMarcou','Conte aqui...'))
      );
      case 's7': return (
        qHtml('Depois da oficina, você se sente mais preparado para aplicar conceitos de Agilidade? (0 a 10)', ratingHtml('aplicacaoPreparado') + ratingLabelsHtml()) +
        qHtml('O que você pretende aplicar no seu trabalho?', textareaHtml('aplicacaoPlanos','Conte aqui...')) +
        qHtml('Você já aplicou alguma coisa aprendida na oficina?',
          radioHtml('aplicacaoStatus', [
            {val:'sim',label:'Sim'},
            {val:'ainda_nao',label:'Ainda não'},
            {val:'pretendo',label:'Pretendo aplicar'},
            {val:'ja_aplicava',label:'Já aplicava antes'},
          ])
        ) +
        qHtml('Se sim, o quê?', textareaHtml('aplicacaoOque','Conte aqui...'))
      );
      case 's8': return (
        qHtml('Sobre quais temas de Agilidade você gostaria de aprender mais?', checkgroupHtml('temasDesejados', TEMAS)) +
        qHtml('Outro tema:', textHtml('temasOutro','Qual?'))
      );
      case 's9': return (
        qHtml('Que materiais você gostaria de encontrar na Força Ágil?', checkgroupHtml('materiaisDesejados', MATERIAIS)) +
        qHtml('Existe algum material específico que você gostaria?', textareaHtml('materiaisEspecifico','Conte o que você precisa...'))
      );
      case 's10': return (
        qHtml('Quais ferramentas você gostaria de aprender a utilizar?', checkgroupHtml('ferramentasDesejadas', FERRAMENTAS)) +
        qHtml('Existe alguma ferramenta que você gostaria de ver em uma próxima oficina?', textareaHtml('ferramentasEspecifica','Qual ferramenta e para quê?'))
      );
      case 's11': return qHtml('O que você mais gostou na Oficina de Agilidade?', textareaHtml('continuar','Conte pra gente...'));
      case 's12': return qHtml('O que poderia ser melhor na próxima oficina?', textareaHtml('melhorar','Seja sincero. Toda crítica é bem-vinda.'));
      case 's13': return qHtml('Tem alguma coisa que não perguntamos e você gostaria de compartilhar?', textareaHtml('espacoAberto','Escreva sua mensagem...'));
      default: return '';
    }
  }

  /* ── Accordion HTML ── */

  function accHtml(sec, open) {
    var reqBadge = sec.req
      ? '<span class="aval-badge-req">Obrigatória</span>'
      : '<span class="aval-badge-opt">Opcional</span>';
    var footer = sec.req ? '' :
      '<div class="aval-section-footer">' +
        '<button type="button" class="aval-skip-btn" data-target="' + sec.id + '">Pular esta seção →</button>' +
      '</div>';

    return '<div class="aval-acc' + (open ? ' aval-acc--open' : '') + '" id="' + sec.id + '">' +
      '<div class="aval-acc-hdr">' +
        '<span class="aval-section-num">' + sec.n + '</span>' +
        '<span class="aval-section-icon">' + sec.icon + '</span>' +
        '<div class="aval-acc-hdr-text">' +
          '<span class="aval-section-title">' + esc(sec.title) + '</span>' +
          '<span class="aval-section-sub">' + esc(sec.sub) + '</span>' +
        '</div>' +
        '<div class="aval-acc-hdr-right">' +
          reqBadge +
          '<span class="aval-done-mark" hidden>✅</span>' +
          '<span class="aval-acc-arrow">' + (open ? '∧' : '∨') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="aval-acc-body"' + (open ? '' : ' style="display:none"') + '>' +
        '<div class="aval-section-body">' + sectionContent(sec) + '</div>' +
        footer +
      '</div>' +
    '</div>';
  }

  /* ── Formulário completo ── */

  function buildFormHtml(turmaLabel) {
    var h = '';

    /* Cabeçalho */
    h += '<div class="aval-form-header">' +
      '<div class="aval-header-meta">' +
        '<div class="aval-turma-tag">Turma: <strong>' + esc(turmaLabel) + '</strong></div>' +
        '<div class="aval-time-est">⏱ ~5 minutos</div>' +
      '</div>' +
    '</div>';

    /* Barra de progresso */
    h += '<div class="aval-progress-wrap">' +
      '<div class="aval-progress-bar"><div class="aval-progress-fill" id="avalProgressFill" style="width:0%"></div></div>' +
      '<span class="aval-progress-label" id="avalProgressLabel">0 de ' + SECS.length + ' seções respondidas</span>' +
    '</div>';

    h += '<form id="avaliacaoForm" novalidate>';

    SECS.forEach(function(sec, i) {
      h += accHtml(sec, i === 0);
    });

    /* Envio */
    h += '<div class="aval-submit-wrap">' +
      '<label class="aval-identify-label"><input type="checkbox" class="aval-identify-chk"> Quero me identificar nesta avaliação <span class="aval-identify-sub">(seu nome ficará visível para o admin)</span></label>' +
      '<p class="aval-privacy">🔒 Suas respostas são confidenciais e utilizadas exclusivamente para melhoria das iniciativas da Força Ágil.</p>' +
      '<button type="submit" class="btn aval-submit-btn">ENVIAR MINHA AVALIAÇÃO →</button>' +
      '<p class="aval-submit-msg" id="avalSubmitMsg" hidden></p>' +
    '</div>';

    h += '</form>';
    return h;
  }

  /* ── Tela de agradecimento ── */

  function thanksHtml(turmaLabel) {
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
      (turmaLabel ? '<p class="aval-thanks-turmas">Avaliação enviada para: <strong>' + esc(turmaLabel) + '</strong></p>' : '') +
    '</div>';
  }

  /* ── Acordeão: abrir/fechar seção ── */

  function openSection(container, id) {
    var acc = container.querySelector('#' + id);
    if (!acc) return;
    var body  = acc.querySelector('.aval-acc-body');
    var arrow = acc.querySelector('.aval-acc-arrow');
    if (body)  body.style.display = '';
    if (arrow) arrow.textContent = '∧';
    acc.classList.add('aval-acc--open');
    /* Scroll suave até a seção */
    setTimeout(function() { acc.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);
  }

  function closeSection(container, id) {
    var acc = container.querySelector('#' + id);
    if (!acc) return;
    var body  = acc.querySelector('.aval-acc-body');
    var arrow = acc.querySelector('.aval-acc-arrow');
    if (body)  body.style.display = 'none';
    if (arrow) arrow.textContent = '∨';
    acc.classList.remove('aval-acc--open');
  }

  function toggleSection(container, id) {
    var acc = container.querySelector('#' + id);
    if (!acc) return;
    if (acc.classList.contains('aval-acc--open')) {
      closeSection(container, id);
    } else {
      openSection(container, id);
    }
  }

  /* ── Progresso ── */

  function isSectionDone(container, sec) {
    if (sec.pType === 'rating') {
      var w = container.querySelector('.aval-rating[data-field="' + sec.pField + '"]');
      return w && !!w.querySelector('.aval-rating-btn.active');
    }
    if (sec.pType === 'checks') {
      var cg = container.querySelector('.aval-checks[data-field="' + sec.pField + '"]');
      return cg && cg.querySelector('input:checked');
    }
    if (sec.pType === 'text') {
      var ta = container.querySelector('[data-field="' + sec.pField + '"]');
      return ta && ta.value.trim().length > 0;
    }
    return false;
  }

  function updateProgress(container) {
    var done = 0;
    SECS.forEach(function(sec) {
      var isDone = isSectionDone(container, sec);
      /* Checkmark no cabeçalho */
      var acc = container.querySelector('#' + sec.id);
      if (acc) {
        var mark = acc.querySelector('.aval-done-mark');
        if (mark) mark.hidden = !isDone;
      }
      if (isDone) done++;
    });
    var pct = Math.round((done / SECS.length) * 100);
    var fill  = document.getElementById('avalProgressFill');
    var label = document.getElementById('avalProgressLabel');
    if (fill)  fill.style.width = pct + '%';
    if (label) label.textContent = done + ' de ' + SECS.length + ' seções respondidas';
  }

  /* ── Rascunho (localStorage) ── */

  function draftKey(turmaKey, uKey) {
    return 'fa_aval_' + turmaKey + '_' + uKey;
  }

  function saveDraft(container, turmaKey, uKey) {
    var raw = {};
    container.querySelectorAll('.aval-rating').forEach(function(w) {
      var active = w.querySelector('.aval-rating-btn.active');
      if (active) raw[w.dataset.field] = parseInt(active.dataset.val, 10);
    });
    container.querySelectorAll('.aval-textarea, .aval-text').forEach(function(el) {
      var v = el.value.trim();
      if (v) raw[el.dataset.field] = v;
    });
    container.querySelectorAll('.aval-radios').forEach(function(w) {
      var checked = w.querySelector('input[type="radio"]:checked');
      if (checked) raw[w.dataset.field] = checked.value;
    });
    container.querySelectorAll('.aval-checks').forEach(function(w) {
      var vals = Array.from(w.querySelectorAll('input:checked')).map(function(cb) { return cb.value; });
      if (vals.length) raw[w.dataset.field] = vals;
    });
    try { localStorage.setItem(draftKey(turmaKey, uKey), JSON.stringify(raw)); } catch(e) {}
  }

  function loadDraft(turmaKey, uKey) {
    try {
      var stored = localStorage.getItem(draftKey(turmaKey, uKey));
      return stored ? JSON.parse(stored) : null;
    } catch(e) { return null; }
  }

  function clearDraft(turmaKey, uKey) {
    try { localStorage.removeItem(draftKey(turmaKey, uKey)); } catch(e) {}
  }

  function restoreDraft(container, draft) {
    if (!draft) return;
    Object.keys(draft).forEach(function(field) {
      var val = draft[field];
      if (typeof val === 'number') {
        var w = container.querySelector('.aval-rating[data-field="' + field + '"]');
        if (w) {
          var btn = w.querySelector('[data-val="' + val + '"]');
          if (btn) { w.querySelectorAll('.aval-rating-btn').forEach(function(b){b.classList.remove('active');}); btn.classList.add('active'); }
        }
      }
      if (typeof val === 'string' && val) {
        var ta = container.querySelector('textarea[data-field="' + field + '"], input.aval-text[data-field="' + field + '"]');
        if (ta) ta.value = val;
        var radio = container.querySelector('input[name="aval_' + field + '"][value="' + val.replace(/"/g,'\\"') + '"]');
        if (radio) radio.checked = true;
      }
      if (Array.isArray(val)) {
        val.forEach(function(item) {
          var cb = container.querySelector('.aval-checks[data-field="' + field + '"] input[value="' + item.replace(/"/g,'\\"') + '"]');
          if (cb) cb.checked = true;
        });
      }
    });
    /* Abre seções já respondidas */
    SECS.forEach(function(sec) {
      if (isSectionDone(container, sec) && sec.id !== 's1') {
        var acc = container.querySelector('#' + sec.id);
        /* Não abre automaticamente — só marca como done */
        if (acc) {
          var mark = acc.querySelector('.aval-done-mark');
          if (mark) mark.hidden = false;
        }
      }
    });
  }

  /* ── Coleta de dados para submissão ── */

  function collectData(form) {
    var data = {};
    form.querySelectorAll('.aval-rating').forEach(function(w) {
      var active = w.querySelector('.aval-rating-btn.active');
      if (active) data[w.dataset.field] = parseInt(active.dataset.val, 10);
    });
    form.querySelectorAll('.aval-textarea, .aval-text').forEach(function(el) {
      var v = el.value.trim();
      if (v) data[el.dataset.field] = v;
    });
    form.querySelectorAll('.aval-radios').forEach(function(w) {
      var checked = w.querySelector('input[type="radio"]:checked');
      if (checked) data[w.dataset.field] = checked.value;
    });
    form.querySelectorAll('.aval-checks').forEach(function(w) {
      var vals = Array.from(w.querySelectorAll('input:checked')).map(function(cb){return cb.value;});
      if (vals.length) data[w.dataset.field] = vals;
    });
    /* Agrupa sub-itens */
    var orgItens = {};
    ORG_ITENS.forEach(function(item) {
      var k = 'org_' + item.key;
      if (data[k] !== undefined) { orgItens[item.key] = data[k]; delete data[k]; }
    });
    if (Object.keys(orgItens).length) data.orgItens = orgItens;
    var facItens = {};
    FAC_ITENS.forEach(function(item) {
      var k = 'fac_' + item.key;
      if (data[k] !== undefined) { facItens[item.key] = data[k]; delete data[k]; }
    });
    if (Object.keys(facItens).length) data.facItens = facItens;
    return data;
  }

  /* ── Setup dos interativos ── */

  function setupForm(c, turma, done, uKey, userName, userEmail) {
    var form = document.getElementById('avaliacaoForm');
    if (!form) return;

    var draftData = loadDraft(turma.key, uKey);

    /* Restaura rascunho */
    if (draftData) {
      restoreDraft(c, draftData);
      updateProgress(c);
    }

    var saveTimer = null;
    function scheduleSave() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function() { saveDraft(c, turma.key, uKey); updateProgress(c); }, 800);
    }

    /* ── Acordeão: clique no header ── */
    c.querySelectorAll('.aval-acc-hdr').forEach(function(hdr) {
      hdr.addEventListener('click', function() {
        var acc = hdr.closest('.aval-acc');
        if (!acc) return;
        toggleSection(c, acc.id);
      });
    });

    /* ── Rating buttons ── */
    c.querySelectorAll('.aval-rating').forEach(function(w) {
      var fieldId = w.dataset.field;
      w.querySelectorAll('.aval-rating-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          w.querySelectorAll('.aval-rating-btn').forEach(function(b){b.classList.remove('active');});
          btn.classList.add('active');
          scheduleSave();

          /* Auto-avança para próxima seção apenas no campo principal da seção */
          SECS.forEach(function(sec, idx) {
            if (sec.pField === fieldId && sec.pType === 'rating') {
              var next = SECS[idx + 1];
              if (next) {
                setTimeout(function() {
                  closeSection(c, sec.id);
                  openSection(c, next.id);
                }, 600);
              }
            }
          });
        });
      });
    });

    /* ── Inputs/radios/checkboxes ── */
    form.addEventListener('change', scheduleSave);
    form.addEventListener('input',  scheduleSave);

    /* ── Botões "Pular seção" ── */
    c.querySelectorAll('.aval-skip-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var secId = btn.dataset.target;
        var idx = SECS.findIndex(function(s){ return s.id === secId; });
        closeSection(c, secId);
        if (idx >= 0 && SECS[idx + 1]) openSection(c, SECS[idx + 1].id);
      });
    });

    /* ── Submit ── */
    var submitBtn = form.querySelector('.aval-submit-btn');
    var msg       = document.getElementById('avalSubmitMsg');

    form.addEventListener('submit', function(e) {
      e.preventDefault();

      /* Validação das seções obrigatórias */
      var missing = SECS.filter(function(s){ return s.req && !isSectionDone(c, s); });
      if (missing.length) {
        openSection(c, missing[0].id);
        if (msg) { msg.textContent = 'Responda todas as seções obrigatórias (1 a 7) antes de enviar.'; msg.style.color = 'var(--red)'; msg.hidden = false; }
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando…';
      if (msg) msg.hidden = true;

      var data        = collectData(form);
      data.timestamp  = new Date().toISOString();
      data.userEmail  = userEmail;
      data.turmaKey   = turma.key;
      data.turmaLabel = turma.label;
      var identChk    = form.querySelector('.aval-identify-chk');
      data.identificado = !!(identChk && identChk.checked);
      if (data.identificado) data.nomeExibido = userName;

      firebase.database().ref('avaliacoes/' + turma.key + '/' + uKey).set(data)
        .then(function() {
          clearDraft(turma.key, uKey);
          c.innerHTML = thanksHtml(turma.label);
        })
        .catch(function(err) {
          console.error('[avaliacao] save error', err);
          submitBtn.disabled = false;
          submitBtn.textContent = 'ENVIAR MINHA AVALIAÇÃO →';
          if (msg) { msg.textContent = 'Erro ao salvar. Tente novamente.'; msg.style.color = 'var(--red)'; msg.hidden = false; }
        });
    });
  }

  /* ── Renderização ── */

  function renderForm(c, turma, done, uKey, userName, userEmail) {
    var noticeHtml = done.length
      ? '<div class="aval-notice">✅ Avaliação já enviada para: ' + done.map(function(t){return '<strong>'+esc(t.label)+'</strong>';}).join(', ') + '</div>'
      : '';
    c.innerHTML = noticeHtml + buildFormHtml(turma.label);
    setupForm(c, turma, done, uKey, userName, userEmail);
  }

  /* ── Init ── */

  function init() {
    var c = document.getElementById('avaliacaoContent');
    if (!c) return;

    var session = window.faAuth && window.faAuth.getSession();
    if (!session) {
      c.innerHTML = '<p class="loading-msg">Carregando…</p>';
      window.addEventListener('fa-auth-ready', function onReady() {
        window.removeEventListener('fa-auth-ready', onReady);
        init();
      });
      return;
    }

    var isAdmin   = !!(window.faAuth.isAdmin && window.faAuth.isAdmin(session.email));
    var userEmail = session.email;
    var uKey      = emailKey(userEmail);
    var userName  = session.displayName || userEmail;

    c.innerHTML = '<p class="loading-msg">Carregando…</p>';

    firebase.database().ref('turmas-interesse').once('value').then(function(snap) {
      var data = snap.val() || {};
      var confirmedKeys = [];
      Object.keys(data).forEach(function(turmaKey) {
        var entry = (data[turmaKey] || {})[uKey];
        if (entry && entry.status === 'inscrito' && entry.confirmedByAdmin) confirmedKeys.push(turmaKey);
      });

      if (!confirmedKeys.length) {
        c.innerHTML = '<div class="aval-empty"><p>' +
          (isAdmin ? 'Nenhuma turma com inscrição confirmada encontrada.<br>O formulário aparece para inscritos confirmados quando a avaliação é liberada.'
                   : 'Você ainda não está inscrito em nenhuma turma.<br>A avaliação fica disponível após confirmação pelo administrador.') +
          '</p></div>';
        return;
      }

      return Promise.all(confirmedKeys.map(function(tk) {
        return Promise.all([
          firebase.database().ref('turmas/' + tk).once('value'),
          firebase.database().ref('avaliacoes/' + tk + '/' + uKey).once('value'),
        ]).then(function(res) {
          var tData = res[0].val() || {};
          return { key: tk, label: tData.label || tk, evaluated: !!res[1].val(), habilitada: !!tData.avaliacaoHabilitada };
        });
      })).then(function(turmas) {
        /* Admin sempre vê; inscrito só vê turmas com avaliação habilitada */
        var eligible = isAdmin ? turmas : turmas.filter(function(t){ return t.habilitada; });
        if (!eligible.length) {
          c.innerHTML = '<div class="aval-empty"><p>A avaliação ainda não foi liberada para a sua turma.<br>Assim que o administrador liberar, ela aparecerá aqui.</p></div>';
          return;
        }
        var pending = eligible.filter(function(t){ return !t.evaluated; });
        var done    = eligible.filter(function(t){ return t.evaluated; });
        if (!pending.length) { c.innerHTML = thanksHtml(done.map(function(t){return t.label;}).join(', ')); return; }
        renderForm(c, pending[0], done, uKey, userName, userEmail);
      });
    }).catch(function(err) {
      console.error('[avaliacao]', err);
      c.innerHTML = '<p class="loading-msg" style="color:var(--red)">Erro ao carregar. Recarregue a página.</p>';
    });
  }

  /* ── Visibilidade do link de navegação ── */

  function setAvalNavVisible(visible) {
    document.querySelectorAll('.nav-link-aval').forEach(function (el) {
      el.hidden = !visible;
    });
  }

  function checkNavVisibility() {
    var session = window.faAuth && window.faAuth.getSession();
    if (!session) { setAvalNavVisible(false); return; }

    /* Admin sempre vê */
    if (window.faAuth.isAdmin && window.faAuth.isAdmin(session.email)) {
      setAvalNavVisible(true);
      return;
    }

    var level = window.faAuth.getAccessLevel && window.faAuth.getAccessLevel();
    if (level !== 'enrolled') { setAvalNavVisible(false); return; }

    /* Enrolled: verifica se alguma turma confirmada tem avaliacaoHabilitada */
    var uKey = emailKey(session.email);
    firebase.database().ref('turmas-interesse').once('value').then(function (snap) {
      var data = snap.val() || {};
      var confirmedKeys = [];
      Object.keys(data).forEach(function (tk) {
        var entry = (data[tk] || {})[uKey];
        if (entry && entry.status === 'inscrito' && entry.confirmedByAdmin) confirmedKeys.push(tk);
      });
      if (!confirmedKeys.length) { setAvalNavVisible(false); return; }
      return Promise.all(confirmedKeys.map(function (tk) {
        return firebase.database().ref('turmas/' + tk + '/avaliacaoHabilitada').once('value').then(function (s) { return !!s.val(); });
      })).then(function (flags) {
        setAvalNavVisible(flags.some(Boolean));
      });
    }).catch(function () { setAvalNavVisible(false); });
  }

  /* Escuta mudanças de autenticação para atualizar visibilidade */
  window.addEventListener('fa-auth-ready',  checkNavVisibility);
  window.addEventListener('fa-auth-change', checkNavVisibility);
  /* Executa imediatamente caso auth já esteja pronto */
  if (document.readyState !== 'loading') checkNavVisibility();
  document.addEventListener('DOMContentLoaded', checkNavVisibility);

  if (window.faRouter && window.faRouter.onPageInit) window.faRouter.onPageInit('avaliacao', init);
  window.faAvaliacao = { init: init, checkNavVisibility: checkNavVisibility };

  /* polyfill Array.findIndex para o hook de auto-avance */
  if (!Array.prototype.findIndex) {
    Array.prototype.findIndex = function(fn) {
      for (var i = 0; i < this.length; i++) { if (fn(this[i], i)) return i; }
      return -1;
    };
  }
})();
