/* ============================================================
   Força Ágil — Admin Module
   Área restrita: tatianefdirene@previ.com.br | danilfrazao@previ.com.br
   ============================================================ */
(function () {
  'use strict';

  /* Painéis com conteúdo expansível */
  const EXPANDABLE_PANELS = [];

  function activePanel() {
    return document.querySelector('.admin-tab-panel.active');
  }

  function expandAll(panel) {
    /* details elements (Manual) */
    panel.querySelectorAll('details').forEach(function (d) { d.open = true; });
    /* class-based (Mapa: mapa-page / arch-section / mapa-level; Testes: testes-group--collapsible) */
    panel.querySelectorAll('.mapa-page, .arch-section, .mapa-level, .testes-group--collapsible').forEach(function (el) {
      el.classList.add('open');
    });
  }

  function collapseAll(panel) {
    panel.querySelectorAll('details').forEach(function (d) { d.open = false; });
    panel.querySelectorAll('.mapa-page, .arch-section, .mapa-level, .testes-group--collapsible').forEach(function (el) {
      el.classList.remove('open');
    });
  }

  function buildSectionButtons(panel) {
    const bar = document.getElementById('adminExpandBar');
    if (!bar) return;
    bar.querySelectorAll('.admin-expand-sec-btn, .admin-expand-sep').forEach(function (b) { b.remove(); });
  }

  function updateExpandBar(panelId) {
    const bar = document.getElementById('adminExpandBar');
    if (!bar) return;
    const isExpandable = EXPANDABLE_PANELS.indexOf(panelId) !== -1;
    bar.classList.toggle('visible', isExpandable);
    if (isExpandable) {
      var panel = document.getElementById(panelId);
      if (panel) setTimeout(function () { buildSectionButtons(panel); }, 50);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (window.faRouter) window.faRouter.onPageInit('admin', initAdmin);

    /* Tab switching inside admin */
    document.querySelectorAll('.admin-tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const target = btn.dataset.panel;
        document.querySelectorAll('.admin-tab-btn').forEach(function (b) { b.classList.remove('active'); });
        document.querySelectorAll('.admin-tab-panel').forEach(function (p) { p.classList.remove('active'); });
        btn.classList.add('active');
        const panel = document.getElementById(target);
        if (panel) panel.classList.add('active');
        updateExpandBar(target);
      });
    });

    /* Expandir / Recolher tudo */
    const expandBtn   = document.getElementById('adminExpandAll');
    const collapseBtn = document.getElementById('adminCollapseAll');
    if (expandBtn)   expandBtn.addEventListener('click',   function () { const p = activePanel(); if (p) expandAll(p); });
    if (collapseBtn) collapseBtn.addEventListener('click', function () { const p = activePanel(); if (p) collapseAll(p); });
  });

  function emailKey(e) {
    return (e || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
  }

  const SUPER_ADMINS = ['tatianefdirene@previ.com.br', 'danielfrazao@previ.com.br'];
  window.faSuperAdmins = SUPER_ADMINS;

  var _aguardandoAuth = false;

  function initAdmin() {
    var sess = window.faAuth && window.faAuth.getSession();
    /* Ao abrir #admin direto (link salvo, F5, endereço digitado), o router
       dispara este init ANTES do Firebase resolver a sessão. Sem esperar o
       fa-auth-ready, a função retornava em silêncio e o painel inteiro ficava
       preso nos "Carregando…" estáticos do HTML, sem erro no console. */
    if (!sess) {
      if (_aguardandoAuth) return;
      _aguardandoAuth = true;
      window.addEventListener('fa-auth-ready', function onReady() {
        window.removeEventListener('fa-auth-ready', onReady);
        _aguardandoAuth = false;
        initAdmin();
      });
      return;
    }
    if (!window.faAuth.isAdmin(sess.email)) return;
    migrateNameCase();
    loadInterests();
    loadRepoAdmin();
    loadEspera();
    loadCadastrados();
    loadAdmins();
    if (window.faInitManual) window.faInitManual();
    if (window.faInitMapa) window.faInitMapa();
    if (window.faInitTestes) window.faInitTestes();
    if (window.faInitPedidos) window.faInitPedidos();
    if (window.faInitDashboard) window.faInitDashboard();
    initCertificados();
  }

  function migrateNameCase() {
    /* fa-admins: estrutura plana { key: { name, email } } */
    ['fa-admins'].forEach(function (path) {
      firebase.database().ref(path).once('value', function (snap) {
        const data = snap.val() || {};
        const updates = {};
        Object.entries(data).forEach(function (entry) {
          const key = entry[0], p = entry[1];
          const newName  = (p.name  || '').toUpperCase();
          const newEmail = (p.email || '').toLowerCase();
          if (p.name !== newName || p.email !== newEmail) {
            updates[path + '/' + key + '/name']  = newName;
            updates[path + '/' + key + '/email'] = newEmail;
          }
        });
        if (Object.keys(updates).length) firebase.database().ref().update(updates);
      });
    });

    /* turmas-interesse: estrutura { turmaKey: { eKey: { name, email } } } */
    firebase.database().ref('turmas-interesse').once('value', function (snap) {
      const data = snap.val() || {};
      const updates = {};
      Object.entries(data).forEach(function (tEntry) {
        const turmaKey = tEntry[0], pessoas = tEntry[1] || {};
        Object.entries(pessoas).forEach(function (pEntry) {
          const eKey = pEntry[0], p = pEntry[1];
          if (!p || typeof p !== 'object') return;
          const newName = (p.name || '').toUpperCase();
          if (p.name && p.name !== newName) {
            updates['turmas-interesse/' + turmaKey + '/' + eKey + '/name'] = newName;
          }
        });
      });
      if (Object.keys(updates).length) firebase.database().ref().update(updates);
    });
  }

  /* Critério de presença mínima (0.75 = 75% dos dias) */
  var CRITERIO_PRESENCA = 0.75;

  /* Turmas não são mais fixas — vêm de turmas/ no Firebase, editável pelo admin
     (criar, excluir, adicionar/remover datas). loadTurmasList() repopula isto
     antes de qualquer tela do admin que precise da lista. */
  var TURMAS_LIST = [];

  function loadTurmasList(cb) {
    firebase.database().ref('turmas').once('value', function (snap) {
      var val = snap.val() || {};
      TURMAS_LIST = Object.keys(val).map(function (key) {
        var t = val[key] || {};
        var dias = (t.dias || []).slice().sort();
        var fmt = window.faTurmasUtil.formatDias(dias);
        return { key: key, label: t.label || key.toUpperCase(), dates: fmt.dates, dias: dias, order: t.order || 0, cmflexLink: t.cmflexLink || '', eventoKey: t.eventoKey || '', avaliacaoHabilitada: !!t.avaliacaoHabilitada };
      }).sort(function (a, b) { return a.order - b.order; });
      cb();
    });
  }

  /* Eventos — entidade que agrupa turmas. Armazena nome e carga horária
     para que múltiplas turmas do mesmo evento compartilhem esses dados. */
  var EVENTOS_LIST = [];

  function loadEventosList(cb) {
    firebase.database().ref('eventos').once('value', function (snap) {
      var val = snap.val() || {};
      EVENTOS_LIST = Object.keys(val).map(function (key) {
        var e = val[key] || {};
        return { key: key, nome: e.nome || '', cargaHoraria: e.cargaHoraria || '20', percentualMinimo: Number(e.percentualMinimo || 75), order: e.order || 0 };
      }).sort(function (a, b) { return a.order - b.order; });
      cb();
    });
  }

  function eventoLabel(key) {
    var ev = EVENTOS_LIST.filter(function (x) { return x.key === key; })[0];
    return ev ? ev.nome : key;
  }

  function turmaLabel(key) {
    var t = TURMAS_LIST.filter(function (x) { return x.key === key; })[0];
    return t ? t.label : key;
  }

  function fmtDia(iso) {
    /* "2026-08-11" → "11/08" */
    var p = iso.split('-');
    return p[2] + '/' + p[1];
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  /* ---- Turmas tab ---- */
  function loadInterests() {
    var c = document.getElementById('adminInterests');
    if (!c) return;
    c.innerHTML = '<p class="loading-msg">Carregando dados…</p>';

    loadTurmasList(function () {
    loadEventosList(function () {
    var db = firebase.database();
    db.ref('turmas-interesse').once('value', function (snapI) {
      db.ref('turmas-config').once('value', function (snapC) {
        db.ref('turmas-checkin').once('value', function (snapCk) {
          var data    = snapI.val()  || {};
          var config  = snapC.val()  || {};
          var checkin = snapCk.val() || {};
          c.innerHTML = '';

          /* ── Botões globais ────────────────────────────────────────────── */
          var globalBtnWrap = document.createElement('div');
          globalBtnWrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px';
          var newEventoBtn = document.createElement('button');
          newEventoBtn.className = 'btn btn--sm btn--primary';
          newEventoBtn.innerHTML = '+ Novo evento';
          newEventoBtn.addEventListener('click', function () { openEventoFormModal(null); });
          var exportBtn = document.createElement('button');
          exportBtn.className = 'btn btn--sm';
          exportBtn.innerHTML = '&#x2193; Estado atual';
          exportBtn.addEventListener('click', function () { exportAllInterests(data, config, checkin); });
          var exportLogBtn = document.createElement('button');
          exportLogBtn.className = 'btn btn--sm';
          exportLogBtn.innerHTML = '&#x2193; Histórico';
          exportLogBtn.addEventListener('click', function () { exportInterestLog(); });
          var qrAcessoBtn = document.createElement('a');
          qrAcessoBtn.className = 'btn btn--sm';
          qrAcessoBtn.innerHTML = '&#x2193; QR de acesso ao site';
          qrAcessoBtn.href = 'forca-agil/assets/qrcode-acesso.png';
          qrAcessoBtn.download = 'forca-agil-qrcode.png';
          qrAcessoBtn.title = 'Baixa o QR Code (com o logotipo da Força Ágil) que leva para forca-agil.previ.com.br — use em cartazes, slides ou materiais impressos';
          globalBtnWrap.appendChild(newEventoBtn);
          globalBtnWrap.appendChild(exportBtn);
          globalBtnWrap.appendChild(exportLogBtn);
          globalBtnWrap.appendChild(qrAcessoBtn);
          c.appendChild(globalBtnWrap);

          /* ── Barra de filtro e expand/collapse ───────────────────────────── */
          var filterBar = document.createElement('div');
          filterBar.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:18px;width:100%;box-sizing:border-box;min-width:0';
          var filterLabel = document.createElement('span');
          filterLabel.style.cssText = 'color:var(--ink-2);font-size:.82rem;white-space:nowrap;flex-shrink:0';
          filterLabel.textContent = 'Ver evento:';
          var filterSel = document.createElement('select');
          filterSel.style.cssText = 'background:var(--panel-2);border:1px solid var(--line-strong);border-radius:4px;color:var(--ink);padding:4px 8px;font-size:.82rem;cursor:pointer;max-width:240px;min-width:0;flex-shrink:1';
          var allOpt = document.createElement('option');
          allOpt.value = ''; allOpt.textContent = 'Todos';
          filterSel.appendChild(allOpt);
          EVENTOS_LIST.forEach(function (ev) {
            var opt = document.createElement('option');
            opt.value = ev.key; opt.textContent = ev.nome;
            filterSel.appendChild(opt);
          });
          var expandAllBtn = document.createElement('button');
          expandAllBtn.className = 'btn btn--sm';
          expandAllBtn.style.cssText = 'padding:4px 10px;font-size:.72rem;margin-left:auto;white-space:nowrap;flex-shrink:0';
          expandAllBtn.textContent = '↕ Expandir tudo';
          var collapseAllBtn = document.createElement('button');
          collapseAllBtn.className = 'btn btn--sm';
          collapseAllBtn.style.cssText = 'padding:4px 10px;font-size:.72rem;white-space:nowrap;flex-shrink:0';
          collapseAllBtn.textContent = '↕ Recolher tudo';
          filterBar.appendChild(filterLabel);
          filterBar.appendChild(filterSel);
          filterBar.appendChild(expandAllBtn);
          filterBar.appendChild(collapseAllBtn);
          c.appendChild(filterBar);

          if (!EVENTOS_LIST.length) {
            var noEventoMsg = document.createElement('p');
            noEventoMsg.className = 'admin-empty';
            noEventoMsg.textContent = 'Nenhum evento cadastrado. Clique em "+ Novo evento" para começar.';
            c.appendChild(noEventoMsg);
          }

          /* ── Função auxiliar: constrói e retorna o card de uma turma ───── */
          function buildTurmaCard(t) {
            var cfg        = config[t.key] || {};
            var finalizada = !!cfg.finalizada;
            var encerrada  = !!cfg.encerrada;
            var diaAtivo   = cfg.diaAtivo || null;
            var all        = data[t.key] ? Object.values(data[t.key]) : [];
            var active     = all.filter(function (r) { return !r.removed; });
            var removed    = all.filter(function (r) { return r.removed; });
            var checkinT   = checkin[t.key] || {};
            var inscritos    = active.filter(function (r) { return r.status === 'inscrito'; });
            var interessados = active.filter(function (r) { return r.status !== 'inscrito'; });
            var countLabel   = interessados.length + ' interessado' + (interessados.length !== 1 ? 's' : '') +
              ' · ' + inscritos.length + ' confirmado' + (inscritos.length !== 1 ? 's' : '');

            var card = document.createElement('div');
            card.className = 'turma-admin-card';
            card.id = 'turma-card-' + t.key;
            card.style.background = '#1a2035';

            var hdr = document.createElement('div');
            hdr.className = 'turma-admin-header';
            hdr.style.background = '#1a2035';

            var checkinBadge = '';
            if (finalizada && diaAtivo) {
              checkinBadge = '<span class="turma-status-badge badge-checkin-aberto">CHECK-IN ABERTO · ' + fmtDia(diaAtivo) + '</span>';
            }
            hdr.innerHTML =
              '<div class="turma-admin-title" style="cursor:pointer;user-select:none">' +
                '<span class="turma-toggle-icon" style="color:var(--ink-2);font-size:.8rem;flex-shrink:0;margin-right:6px">▸</span>' +
                '<span class="turma-admin-name">' + esc(t.label) + '</span>' +
                '<span class="turma-admin-dates">(' + t.dates + ')</span>' +
                '<span class="turma-status-badge ' + (finalizada ? 'badge-finalizada' : 'badge-aberta') + '">' +
                  (finalizada ? 'INTERESSE ENCERRADO' : 'ABERTA') + '</span>' +
                '<span class="admin-badge">' + countLabel + '</span>' +
                checkinBadge +
              '</div>' +
              '<div class="turma-admin-actions" id="turma-actions-' + t.key + '"></div>';
            card.appendChild(hdr);

            var actWrap = hdr.querySelector('#turma-actions-' + t.key);
            var primaryWrap = document.createElement('div');
            primaryWrap.className = 'taa-primary';
            var moreBtn = document.createElement('button');
            moreBtn.className = 'btn btn--sm taa-more-btn';
            moreBtn.innerHTML = '&#x22EF;';
            moreBtn.setAttribute('aria-label', 'Mais ações');
            var moreMenu = document.createElement('div');
            moreMenu.className = 'taa-dropdown';

            if (!finalizada) {
              var finBtn = document.createElement('button');
              finBtn.className = 'btn btn--sm btn--primary';
              finBtn.style.cssText = 'padding:6px 12px;box-shadow:none;font-size:.72rem';
              finBtn.textContent = 'Encerrar interesse';
              finBtn.addEventListener('click', (function (tk) {
                return function () { finalizeTurma(tk); };
              })(t.key));
              primaryWrap.appendChild(finBtn);
            } else {
              if (!diaAtivo) {
                var dSel = document.createElement('select');
                dSel.className = 'checkin-dia-select';
                var firstUnused = t.dias.find(function (d) { return !checkinT[d] || Object.keys(checkinT[d]).length === 0; }) || todayISO();
                t.dias.forEach(function (d) {
                  var opt = document.createElement('option');
                  opt.value = d; opt.textContent = fmtDia(d);
                  if (d === firstUnused) opt.selected = true;
                  dSel.appendChild(opt);
                });
                var openBtn = document.createElement('button');
                openBtn.className = 'btn btn--sm btn--primary';
                openBtn.style.cssText = 'padding:6px 12px;box-shadow:none;font-size:.72rem';
                openBtn.textContent = 'Abrir check-in';
                openBtn.addEventListener('click', (function (tk, s) {
                  return function () { openCheckin(tk, s.value); };
                })(t.key, dSel));
                primaryWrap.appendChild(dSel);
                primaryWrap.appendChild(openBtn);
              } else {
                var diaAtivoLabel = document.createElement('span');
                diaAtivoLabel.className = 'checkin-dia-aberto';
                diaAtivoLabel.textContent = fmtDia(diaAtivo);
                var closeBtn2 = document.createElement('button');
                closeBtn2.className = 'btn btn--sm';
                closeBtn2.style.cssText = 'padding:6px 10px;font-size:.72rem;border-color:rgba(255,80,80,.5);color:#ff8080';
                closeBtn2.textContent = 'Fechar check-in';
                closeBtn2.addEventListener('click', (function (tk) {
                  return function () { closeCheckin(tk); };
                })(t.key));
                primaryWrap.appendChild(diaAtivoLabel);
                primaryWrap.appendChild(closeBtn2);
              }
              var qrBtn = document.createElement('button');
              qrBtn.className = 'btn btn--sm';
              qrBtn.style.cssText = 'padding:6px 10px;font-size:.72rem';
              qrBtn.innerHTML = '&#x2318; QR';
              qrBtn.addEventListener('click', (function (tt) { return function () { openQrModal(tt); }; })(t));
              var reopenBtn = document.createElement('button');
              reopenBtn.className = 'btn btn--sm';
              reopenBtn.style.cssText = 'padding:6px 10px;font-size:.72rem';
              reopenBtn.textContent = '↺ Reabrir';
              reopenBtn.addEventListener('click', (function (tk) { return function () { reopenTurma(tk); }; })(t.key));
              moreMenu.appendChild(qrBtn);
              moreMenu.appendChild(reopenBtn);
            }

            var addBtn = document.createElement('button');
            addBtn.className = 'btn btn--sm';
            addBtn.style.cssText = 'padding:6px 10px;font-size:.72rem';
            addBtn.textContent = '＋ Participante';
            addBtn.addEventListener('click', (function (tk) { return function () { addParticipante(tk); }; })(t.key));
            moreMenu.appendChild(addBtn);

            var csvTurmaBtn = document.createElement('button');
            csvTurmaBtn.className = 'btn btn--sm';
            csvTurmaBtn.style.cssText = 'padding:6px 10px;font-size:.72rem';
            csvTurmaBtn.innerHTML = '&#x2193; CSV';
            csvTurmaBtn.addEventListener('click', (function (tt, a, f, ck) {
              return function () { exportTurmaCSV(tt, a, f, ck); };
            })(t, all, finalizada, checkinT));
            moreMenu.appendChild(csvTurmaBtn);

            var avalBtn = document.createElement('button');
            avalBtn.className = 'btn btn--sm';
            avalBtn.style.cssText = 'padding:6px 10px;font-size:.72rem;' + (t.avaliacaoHabilitada ? 'border-color:rgba(26,178,174,.5);color:var(--cyan)' : 'border-color:rgba(245,197,66,.4);color:var(--accent)');
            avalBtn.textContent = t.avaliacaoHabilitada ? '🔒 Encerrar avaliação' : '📋 Liberar avaliação';
            avalBtn.addEventListener('click', (function (tk, tl, habilitada) {
              return function () {
                var msg = habilitada
                  ? 'Encerrar a avaliação da turma "' + tl + '"?\n\nOs inscritos não verão mais a aba Avaliação.'
                  : 'Liberar a avaliação da turma "' + tl + '"?\n\nOs inscritos confirmados passarão a ver a aba Avaliação.';
                adminConfirm(msg, function () {
                  firebase.database().ref('turmas/' + tk + '/avaliacaoHabilitada').set(!habilitada, function (err) {
                    if (!err) loadInterests();
                  });
                });
              };
            })(t.key, t.label, t.avaliacaoHabilitada));
            moreMenu.appendChild(avalBtn);

            if (finalizada && !encerrada) {
              var encerrarBtn = document.createElement('button');
              encerrarBtn.className = 'btn btn--sm';
              encerrarBtn.style.cssText = 'padding:6px 10px;font-size:.72rem;border-color:rgba(255,165,0,.4);color:#ffb347';
              encerrarBtn.textContent = '✓ Encerrar turma';
              encerrarBtn.addEventListener('click', (function (tk, tl) {
                return function () {
                  adminConfirm('Marcar a turma "' + tl + '" como encerrada?\n\nO card público passará a exibir "Turma realizada" — sem botão de inscrição.', function () {
                    var db = firebase.database();
                    db.ref('turmas-config/' + tk + '/dataConclusao').once('value', function (snap) {
                      var updates = {};
                      updates['turmas-config/' + tk + '/encerrada'] = true;
                      if (!snap.val()) updates['turmas-config/' + tk + '/dataConclusao'] = todayISO();
                      db.ref().update(updates, function (err) {
                        if (err) { adminAlert('Erro ao encerrar. Tente novamente.'); return; }
                        loadInterests();
                      });
                    });
                  });
                };
              })(t.key, t.label));
              moreMenu.appendChild(encerrarBtn);
            }

            var editTurmaBtn = document.createElement('button');
            editTurmaBtn.className = 'btn btn--sm';
            editTurmaBtn.style.cssText = 'padding:6px 10px;font-size:.72rem';
            editTurmaBtn.innerHTML = '&#x270E; Editar turma';
            editTurmaBtn.addEventListener('click', (function (tt) { return function () { openTurmaFormModal(tt); }; })(t));
            moreMenu.appendChild(editTurmaBtn);

            var delTurmaBtn = document.createElement('button');
            delTurmaBtn.className = 'btn btn--sm';
            delTurmaBtn.style.cssText = 'padding:6px 10px;font-size:.72rem;border-color:rgba(255,80,80,.5);color:#ff8080';
            delTurmaBtn.innerHTML = '&#x1F5D1; Excluir turma';
            delTurmaBtn.addEventListener('click', (function (tt, act, rem) {
              return function () { deleteTurma(tt, act, rem); };
            })(t, active, removed));
            moreMenu.appendChild(delTurmaBtn);

            moreBtn.addEventListener('click', function (e) {
              e.stopPropagation();
              var willOpen = !moreMenu.classList.contains('open');
              moreMenu.classList.toggle('open');
              if (willOpen) {
                /* Abre pra cima se não houver espaço suficiente embaixo
                   (ex: card perto do rodapé da página) */
                moreMenu.classList.remove('taa-dropdown--up');
                var rect = moreMenu.getBoundingClientRect();
                var espacoEmbaixo = window.innerHeight - rect.bottom;
                if (espacoEmbaixo < 0) moreMenu.classList.add('taa-dropdown--up');
              }
            });
            document.addEventListener('click', function () { moreMenu.classList.remove('open'); });

            actWrap.appendChild(primaryWrap);
            actWrap.appendChild(moreBtn);
            actWrap.appendChild(moreMenu);

            var body = document.createElement('div');
            body.className = 'turma-admin-body';
            if (!active.length) {
              body.innerHTML = '<p class="admin-empty">Nenhum participante ativo.</p>';
            } else {
              body.appendChild(buildParticipantesTable(t, active, checkinT, finalizada));
            }
            if (removed.length) {
              var removedSection = document.createElement('div');
              removedSection.className = 'turma-removed-accordion';
              var removedHdr = document.createElement('button');
              removedHdr.className = 'turma-removed-toggle';
              removedHdr.type = 'button';
              removedHdr.setAttribute('aria-expanded', 'false');
              var labelSpan = document.createElement('span');
              labelSpan.textContent = finalizada
                ? 'Removidos (' + removed.length + ') — histórico de presença preservado'
                : 'Removidos (' + removed.length + ')';
              var iconSpan = document.createElement('span');
              iconSpan.className = 'turma-removed-icon';
              iconSpan.setAttribute('aria-hidden', 'true');
              iconSpan.textContent = '▸';
              removedHdr.appendChild(iconSpan);
              removedHdr.appendChild(labelSpan);
              var removedBody = document.createElement('div');
              removedBody.className = 'turma-removed-body';
              removedBody.hidden = true;
              removedBody.appendChild(finalizada ? buildRemovedPresencaTable(t, removed, checkinT) : buildRemovedInteressadosTable(removed));
              removedHdr.addEventListener('click', function () {
                var expanded = removedHdr.getAttribute('aria-expanded') === 'true';
                removedHdr.setAttribute('aria-expanded', String(!expanded));
                iconSpan.textContent = expanded ? '▸' : '▾';
                removedBody.hidden = expanded;
              });
              removedSection.appendChild(removedHdr);
              removedSection.appendChild(removedBody);
              body.appendChild(removedSection);
            }
            body.style.display = 'none';
            card.appendChild(body);
            var titleDiv = hdr.querySelector('.turma-admin-title');
            var turmaToggleIcon = hdr.querySelector('.turma-toggle-icon');
            titleDiv.addEventListener('click', function () {
              var collapsed = body.style.display === 'none';
              body.style.display = collapsed ? '' : 'none';
              turmaToggleIcon.textContent = collapsed ? '▾' : '▸';
            });
            return card;
          }

          /* ── Renderizar eventos com turmas agrupadas ────────────────────── */
          EVENTOS_LIST.forEach(function (ev) {
            var turmasEvento = TURMAS_LIST.filter(function (t) { return t.eventoKey === ev.key; });

            var evSection = document.createElement('div');
            /* overflow:visible — não pode ser hidden: os cards de turma dentro
               têm menu "⋯" posicionado absoluto, que corta se um ancestral
               qualquer clipar o conteúdo. Arredondamento replicado no header/
               body abaixo em vez de depender do clip (mesmo motivo do fix em
               .turma-admin-card). */
            evSection.style.cssText = 'border:1px solid var(--line-strong);border-radius:8px;margin-bottom:24px;overflow:visible';
            evSection.setAttribute('data-ev-key', ev.key);

            /* cabeçalho do evento — clicável para expandir/recolher */
            var evHdr = document.createElement('div');
            evHdr.style.cssText = 'display:flex;align-items:center;gap:12px;padding:14px 18px;background:var(--panel-2);border-bottom:1px solid var(--line-strong);cursor:pointer;user-select:none;border-radius:8px 8px 0 0';
            var evToggleIcon = document.createElement('span');
            evToggleIcon.className = 'ev-toggle-icon';
            evToggleIcon.style.cssText = 'color:var(--ink-2);font-size:.85rem;flex-shrink:0;transition:transform .15s';
            evToggleIcon.textContent = '▸';
            var evNome = document.createElement('span');
            evNome.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-head);letter-spacing:.06em;font-size:.9rem;color:var(--ink)';
            evNome.textContent = ev.nome;
            var evMeta = document.createElement('span');
            evMeta.style.cssText = 'color:var(--ink-2);font-size:.85rem;white-space:nowrap';
            evMeta.textContent = ev.cargaHoraria + 'h · ' + turmasEvento.length + ' turma' + (turmasEvento.length !== 1 ? 's' : '');
            var evEditBtn = document.createElement('button');
            evEditBtn.className = 'btn btn--sm';
            evEditBtn.style.cssText = 'padding:4px 10px;font-size:.72rem';
            evEditBtn.innerHTML = '&#x270E; Editar evento';
            evEditBtn.addEventListener('click', function (e) { e.stopPropagation(); openEventoFormModal(ev); });
            var evNewTurmaBtn = document.createElement('button');
            evNewTurmaBtn.className = 'btn btn--sm btn--primary';
            evNewTurmaBtn.style.cssText = 'padding:4px 10px;font-size:.72rem';
            evNewTurmaBtn.innerHTML = '+ Nova turma';
            evNewTurmaBtn.addEventListener('click', function (e) { e.stopPropagation(); openTurmaFormModal(null, ev.key); });
            evHdr.appendChild(evToggleIcon);
            evHdr.appendChild(evNome);
            evHdr.appendChild(evMeta);
            evHdr.appendChild(evEditBtn);
            evHdr.appendChild(evNewTurmaBtn);
            evSection.appendChild(evHdr);

            /* turmas do evento — começa recolhido */
            var turmasWrap = document.createElement('div');
            turmasWrap.className = 'ev-turmas-wrap';
            turmasWrap.style.cssText = 'padding:16px;display:none;flex-direction:column;gap:16px';
            evHdr.addEventListener('click', function () {
              var collapsed = turmasWrap.style.display === 'none';
              turmasWrap.style.display = collapsed ? 'flex' : 'none';
              evToggleIcon.textContent = collapsed ? '▾' : '▸';
            });
            if (!turmasEvento.length) {
              var tEmpty = document.createElement('p');
              tEmpty.className = 'admin-empty';
              tEmpty.style.marginBottom = '0';
              tEmpty.textContent = 'Nenhuma turma neste evento. Clique em "+ Nova turma" para criar.';
              turmasWrap.appendChild(tEmpty);
            } else {
              turmasEvento.forEach(function (t) { turmasWrap.appendChild(buildTurmaCard(t)); });
            }
            evSection.appendChild(turmasWrap);
            c.appendChild(evSection);
          });

          /* ── Turmas sem evento ──────────────────────────────────────────── */
          var semEvento = TURMAS_LIST.filter(function (t) { return !t.eventoKey; });
          if (semEvento.length) {
            var semEventoSection = document.createElement('div');
            semEventoSection.style.cssText = 'border:1px solid rgba(255,165,0,.3);border-radius:8px;margin-bottom:24px;overflow:visible';
            var semEventoHdr = document.createElement('div');
            semEventoHdr.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px 18px;background:var(--panel-2);border-bottom:1px solid rgba(255,165,0,.3);border-radius:8px 8px 0 0';
            semEventoHdr.innerHTML = '<span style="color:#ffb347;font-size:.8rem;font-family:var(--font-head);letter-spacing:.08em">⚠ TURMAS SEM EVENTO</span>' +
              '<span style="color:var(--ink-2);font-size:.82rem;flex:1">Edite cada turma e vincule a um evento.</span>';
            semEventoSection.appendChild(semEventoHdr);
            var semEventoWrap = document.createElement('div');
            semEventoWrap.style.cssText = 'padding:16px;display:flex;flex-direction:column;gap:16px';
            semEvento.forEach(function (t) { semEventoWrap.appendChild(buildTurmaCard(t)); });
            semEventoSection.appendChild(semEventoWrap);
            c.appendChild(semEventoSection);
          }

          /* ── Callbacks: filtro e expand/collapse ─────────────────────────── */
          function setEvExpanded(evSec, expanded) {
            var tw = evSec.querySelector('.ev-turmas-wrap');
            var icon = evSec.querySelector('.ev-toggle-icon');
            if (tw) tw.style.display = expanded ? 'flex' : 'none';
            if (icon) icon.textContent = expanded ? '▾' : '▸';
          }
          function setTurmaExpanded(cardEl, expanded) {
            var b = cardEl.querySelector('.turma-admin-body');
            var icon = cardEl.querySelector('.turma-toggle-icon');
            if (b) b.style.display = expanded ? '' : 'none';
            if (icon) icon.textContent = expanded ? '▾' : '▸';
          }
          expandAllBtn.addEventListener('click', function () {
            Array.from(c.querySelectorAll('[data-ev-key]')).forEach(function (sec) { setEvExpanded(sec, true); });
            Array.from(c.querySelectorAll('.turma-admin-card')).forEach(function (cd) { setTurmaExpanded(cd, true); });
          });
          collapseAllBtn.addEventListener('click', function () {
            Array.from(c.querySelectorAll('[data-ev-key]')).forEach(function (sec) { setEvExpanded(sec, false); });
            Array.from(c.querySelectorAll('.turma-admin-card')).forEach(function (cd) { setTurmaExpanded(cd, false); });
          });
          filterSel.addEventListener('change', function () {
            var chosen = filterSel.value;
            Array.from(c.querySelectorAll('[data-ev-key]')).forEach(function (sec) {
              var matches = !chosen || sec.getAttribute('data-ev-key') === chosen;
              sec.style.display = matches ? '' : 'none';
              if (matches && chosen) setEvExpanded(sec, true);
            });
          });
        });
      });
    });
    });
    });
  }

  /* Tabela única de participantes — usada em qualquer estado da turma (aberta
     ou com interesse encerrado). Confirmar/Desconfirmar/Adicionar/Remover não
     dependem de a turma estar encerrada: a inscrição real acontece no CMFlex,
     que não espera o portal fechar a captação de interesse. As colunas de
     presença/frequência só aparecem quando finalizada, porque o check-in em
     si (abrir dia, escanear QR) continua exclusivo de turma com interesse
     encerrado. */
  function buildParticipantesTable(t, records, checkinT, finalizada) {
    var minDias = Math.ceil(t.dias.length * CRITERIO_PRESENCA);
    var wrap = document.createElement('div');
    wrap.className = 'table-scroll-wrap';

    var tbl = '<table class="admin-table' + (finalizada ? ' presenca-table' : '') + '"><thead><tr>' +
      '<th>Nome</th><th>E-mail</th><th>Área</th><th>Status</th>';
    if (finalizada) {
      t.dias.forEach(function (d) { tbl += '<th class="dia-th">' + fmtDia(d) + '</th>'; });
      tbl += '<th>Freq.</th>';
    } else {
      tbl += '<th>Data registro</th>';
    }
    tbl += '<th></th></tr></thead><tbody>';

    records.forEach(function (r) {
      var eKey = emailKeyFromEmail(r.email);
      var isInscrito = r.status === 'inscrito';
      var motivoBadge = '';
      if (!isInscrito && r.motivoNaoConfirmado) {
        var motivoLabel = r.motivoNaoConfirmado === 'sem_vagas' ? 'Sem vagas'
          : r.motivoNaoConfirmado === 'ja_participou' ? 'Já participou'
          : 'Substituída';
        var motivoCls = r.motivoNaoConfirmado === 'sem_vagas' ? 'motivo-sem-vagas'
          : r.motivoNaoConfirmado === 'ja_participou' ? 'motivo-ja-participou'
          : 'motivo-substituida';
        motivoBadge = '<span class="motivo-badge ' + motivoCls + '">' + motivoLabel + '</span>';
      }
      var statusCell = '<td><span class="status-badge ' + (isInscrito ? 'status-inscrito">Inscrito' : 'status-interessado">Interessado') + '</span>' + motivoBadge + '</td>';

      var midCells;
      if (finalizada) {
        if (!isInscrito) {
          midCells = t.dias.map(function () { return '<td class="dia-cell">—</td>'; }).join('') + '<td>—</td>';
        } else {
          var diasPresente = 0;
          var cells = t.dias.map(function (d) {
            var ck = checkinT[d] && checkinT[d][eKey];
            if (ck) {
              diasPresente++;
              var ra = 'data-turma="' + t.key + '" data-dia="' + d + '" data-ekey="' + eKey + '" data-name="' + esc(r.name) + '"';
              var badge = ck.source === 'admin'
                ? '<button class="ck-badge ck-adm ck-undo-btn" title="Remover presença (admin)" ' + ra + '>✓ adm</button>'
                : '<button class="ck-badge ck-qr ck-undo-btn" title="Remover presença (QR)" ' + ra + '>✓ qr</button>';
              return '<td class="dia-cell">' + badge + '</td>';
            }
            /* botão para registrar retroativo */
            return '<td class="dia-cell"><button class="ck-manual-btn" ' +
              'data-turma="' + t.key + '" data-dia="' + d + '" ' +
              'data-ekey="' + eKey + '" data-name="' + esc(r.name) + '" ' +
              'data-email="' + esc(r.email) + '" data-area="' + esc(r.area || '') + '"' +
              '>—</button></td>';
          });
          var freq = diasPresente + '/' + t.dias.length;
          var atingiu = diasPresente >= minDias;
          var freqClass = atingiu ? 'freq-ok' : 'freq-nok';
          midCells = cells.join('') + '<td><span class="' + freqClass + '">' + freq + '</span></td>';
        }
      } else {
        midCells = '<td>' + fmtDate(r.date) + '</td>';
      }

      var motivoSel = '';
      if (!isInscrito) {
        var mv = r.motivoNaoConfirmado || '';
        motivoSel = '<select class="motivo-sel" data-turma="' + t.key + '" data-ekey="' + eKey + '" title="Justificativa">' +
          '<option value="">Justificar…</option>' +
          '<option value="sem_vagas"'    + (mv === 'sem_vagas'    ? ' selected' : '') + '>Sem vagas</option>' +
          '<option value="substituida"'  + (mv === 'substituida'  ? ' selected' : '') + '>Substituída</option>' +
          '<option value="ja_participou"'+ (mv === 'ja_participou'? ' selected' : '') + '>Já participou</option>' +
          '</select>';
      }
      var actionBtn = isInscrito
        ? '<button class="cf-unconfirm-btn" data-turma="' + t.key + '" data-ekey="' + eKey + '" data-name="' + esc(r.name) + '" data-email="' + esc(r.email) + '" data-area="' + esc(r.area || '') + '">Desconfirmar</button>'
        : motivoSel + '<button class="cf-confirm-btn" data-turma="' + t.key + '" data-ekey="' + eKey + '" data-name="' + esc(r.name) + '" data-email="' + esc(r.email) + '" data-area="' + esc(r.area || '') + '">Confirmar</button>';

      var dateOriginal = r.date || new Date().toISOString();
      tbl += '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.email) + '</td><td>' +
        esc(r.area || '—') + '</td>' + statusCell + midCells +
        '<td class="turma-row-actions">' + actionBtn +
          '<button class="ck-espera-btn" data-turma="' + t.key + '" data-ekey="' + eKey + '" data-name="' + esc(r.name) + '" data-email="' + esc(r.email) + '" data-area="' + esc(r.area || '') + '" data-date="' + esc(dateOriginal) + '" title="Mover para lista de espera preservando a data original">→ Espera</button>' +
          '<button class="ck-remove-btn" data-turma="' + t.key + '" data-ekey="' + eKey + '" data-name="' + esc(r.name) + '">Remover</button>' +
        '</td></tr>';
    });

    tbl += '</tbody></table>';
    wrap.innerHTML = tbl;

    /* seletor de motivo para interessados */
    wrap.addEventListener('change', function (e) {
      var sel = e.target.closest('.motivo-sel');
      if (!sel) return;
      var val = sel.value;
      var ref = firebase.database().ref('turmas-interesse/' + sel.dataset.turma + '/' + sel.dataset.ekey + '/motivoNaoConfirmado');
      if (val) {
        ref.set(val, function (err) { if (!err) loadInterests(); });
      } else {
        ref.remove(function (err) { if (!err) loadInterests(); });
      }
    });

    /* delegação de eventos: confirmar/desconfirmar, desfazer check-in, check-in manual, remoção */
    wrap.addEventListener('click', function (e) {
      var confirmBtn = e.target.closest('.cf-confirm-btn');
      if (confirmBtn) {
        confirmarInscrito(confirmBtn.dataset.turma, confirmBtn.dataset.ekey, { name: confirmBtn.dataset.name, email: confirmBtn.dataset.email, area: confirmBtn.dataset.area });
        return;
      }
      var unconfirmBtn = e.target.closest('.cf-unconfirm-btn');
      if (unconfirmBtn) {
        desconfirmarInscrito(unconfirmBtn.dataset.turma, unconfirmBtn.dataset.ekey, { name: unconfirmBtn.dataset.name, email: unconfirmBtn.dataset.email, area: unconfirmBtn.dataset.area });
        return;
      }
      var undoBtn = e.target.closest('.ck-undo-btn');
      if (undoBtn) {
        adminConfirm('Remover presença de ' + undoBtn.dataset.name + ' em ' + fmtDia(undoBtn.dataset.dia) + '?', function () {
          firebase.database().ref('turmas-checkin/' + undoBtn.dataset.turma + '/' + undoBtn.dataset.dia + '/' + undoBtn.dataset.ekey).remove(function (err) {
            if (err) { adminAlert('Erro ao remover presença.'); return; }
            loadInterests();
          });
        });
        return;
      }
      var btn = e.target.closest('.ck-manual-btn');
      if (btn) {
        adminCheckin(btn.dataset.turma, btn.dataset.dia, btn.dataset.ekey, {
          name: btn.dataset.name, email: btn.dataset.email, area: btn.dataset.area
        });
        return;
      }
      var esperaBtn = e.target.closest('.ck-espera-btn');
      if (esperaBtn) {
        var person = { name: esperaBtn.dataset.name, email: esperaBtn.dataset.email, area: esperaBtn.dataset.area, date: esperaBtn.dataset.date };
        adminConfirm(
          'Mover ' + person.name + ' para a lista de espera?\n\nEla sairá desta turma. A data original de interesse (' + fmtDate(person.date) + ') será preservada.',
          function () { migrarParaEspera(esperaBtn.dataset.turma, esperaBtn.dataset.ekey, person); }
        );
        return;
      }
      var remBtn = e.target.closest('.ck-remove-btn');
      if (remBtn) {
        var sess2 = window.faAuth && window.faAuth.getSession();
        adminConfirm('Remover ' + remBtn.dataset.name + ' da turma?\n\nEla sairá da lista.', function () {
          var updates = { removed: true, removedDate: new Date().toISOString() };
          if (sess2) { updates.removedByAdmin = sess2.email; updates.removedByAdminName = sess2.name || sess2.email; }
          firebase.database().ref('turmas-interesse/' + remBtn.dataset.turma + '/' + remBtn.dataset.ekey).update(updates, function (err) {
            if (!err) loadInterests();
          });
        });
      }
    });

    return wrap;
  }

  /* Removidos de uma turma ainda aberta — só leitura, com o motivo quando houver */
  function buildRemovedInteressadosTable(records) {
    var wrap = document.createElement('div');
    wrap.className = 'table-scroll-wrap';
    var tbl = '<table class="admin-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Área</th><th>Data remoção</th><th>Motivo</th></tr></thead><tbody>';
    records.forEach(function (r) {
      tbl += '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.email) + '</td><td>' +
        esc(r.area || '—') + '</td><td>' + fmtDate(r.removedDate) + '</td><td>' + esc(r.removedReason || 'Removida pelo admin') + '</td></tr>';
    });
    wrap.innerHTML = tbl + '</tbody></table>';
    return wrap;
  }

  /* Tabela de removidos — só leitura, com o histórico de presença preservado
     (os registros em turmas-checkin não são apagados ao remover alguém da turma) */
  function buildRemovedPresencaTable(t, removed, checkinT) {
    var minDias = Math.ceil(t.dias.length * CRITERIO_PRESENCA);
    var wrap = document.createElement('div');
    wrap.className = 'table-scroll-wrap';

    var tbl = '<table class="admin-table presenca-table"><thead><tr>' +
      '<th>Nome</th><th>E-mail</th><th>Área</th><th>Data remoção</th><th>Motivo</th>';
    t.dias.forEach(function (d) {
      tbl += '<th class="dia-th">' + fmtDia(d) + '</th>';
    });
    tbl += '<th>Freq.</th></tr></thead><tbody>';

    removed.forEach(function (r) {
      var eKey = emailKeyFromEmail(r.email);
      var diasPresente = 0;
      var cells = t.dias.map(function (d) {
        var ck = checkinT[d] && checkinT[d][eKey];
        if (ck) {
          diasPresente++;
          var badge = ck.source === 'admin'
            ? '<span class="ck-badge ck-adm" title="Registrado pelo admin">✓ adm</span>'
            : '<span class="ck-badge ck-qr" title="Registrado pelo próprio QR Code">✓ qr</span>';
          return '<td class="dia-cell">' + badge + '</td>';
        }
        return '<td class="dia-cell">—</td>';
      });

      var freq = diasPresente + '/' + t.dias.length;
      var atingiu = diasPresente >= minDias;
      var freqClass = atingiu ? 'freq-ok' : 'freq-nok';

      tbl += '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.email) + '</td><td>' +
        esc(r.area || '—') + '</td><td>' + fmtDate(r.removedDate) + '</td><td>' + esc(r.removedReason || 'Removida pelo admin') + '</td>' + cells.join('') +
        '<td><span class="' + freqClass + '">' + freq + '</span></td></tr>';
    });

    tbl += '</tbody></table>';
    wrap.innerHTML = tbl;
    return wrap;
  }

  function emailKeyFromEmail(email) {
    return (email || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
  }

  function getStatus(r) {
    return r.status === 'inscrito' ? 'inscrito' : 'interessado';
  }

  /* ---- Check-in actions ---- */
  function openCheckin(turmaKey, dia) {
    var partes = dia.split('-');
    var diaLabel = partes[2] + '/' + partes[1] + '/' + partes[0];
    var hoje = todayISO();
    var aviso = dia !== hoje
      ? '\n\n⚠️ ATENÇÃO: este dia (' + diaLabel + ') é diferente de hoje (' + hoje.split('-').reverse().join('/') + ')!'
      : '';
    if (!confirm('Abrir check-in para o dia ' + diaLabel + '?' + aviso)) return;
    firebase.database().ref('turmas-config/' + turmaKey + '/diaAtivo').set(dia, function (err) {
      if (err) { adminAlert('Erro ao abrir check-in.'); return; }
      loadInterests();
    });
  }

  function closeCheckin(turmaKey) {
    firebase.database().ref('turmas-config/' + turmaKey + '/diaAtivo').set(null, function (err) {
      if (err) { adminAlert('Erro ao fechar check-in.'); return; }
      loadInterests();
    });
  }

  function adminCheckin(turmaKey, dia, eKey, person) {
    var ref = firebase.database().ref('turmas-checkin/' + turmaKey + '/' + dia + '/' + eKey);
    ref.set({
      name: person.name, email: person.email, area: person.area || '',
      checkinAt: new Date().toISOString(), source: 'admin'
    }, function (err) {
      if (err) { adminAlert('Erro ao registrar presença.'); return; }
      loadInterests();
    });
  }

  /* ---- Helpers: modais visuais (substituem confirm/alert/prompt nativos) ---- */
  var AREAS_LIST = ['ASJUR','AUDIT','CONIN','GABIN','GEBEN','GECAP','GECAT','GECON',
    'GEINT','GEPAR','GEPRO','GERAI','GERAT','GEROP','GESOP','GETHO','INFOR','OUVIR','PNSEG','SECEX'];

  function adminAlert(mensagem, callbackOk) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:420px;width:90%;padding:28px;display:flex;flex-direction:column;gap:18px';
    box.innerHTML =
      '<p style="font-size:.95rem;line-height:1.6;color:var(--ink);white-space:pre-line">' + esc(mensagem) + '</p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px">' +
        '<button class="btn btn--primary admin-modal-ok-btn">OK</button>' +
      '</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function closeAlert() { document.body.removeChild(overlay); if (callbackOk) callbackOk(); }
    box.querySelector('.admin-modal-ok-btn').addEventListener('click', closeAlert);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeAlert(); });
  }

  function adminConfirm(mensagem, callbackSim) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:420px;width:90%;padding:28px;display:flex;flex-direction:column;gap:18px';
    box.innerHTML =
      '<p style="font-size:.95rem;line-height:1.6;color:var(--ink);white-space:pre-line">' + esc(mensagem) + '</p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px">' +
        '<button class="btn admin-modal-cancel-btn">Cancelar</button>' +
        '<button class="btn btn--primary admin-modal-confirm-btn">Confirmar</button>' +
      '</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function closeConfirm() { document.body.removeChild(overlay); }
    box.querySelector('.admin-modal-cancel-btn').addEventListener('click', closeConfirm);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeConfirm(); });
    box.querySelector('.admin-modal-confirm-btn').addEventListener('click', function () {
      closeConfirm();
      if (callbackSim) callbackSim();
    });
  }

  /* ---- Adicionar participante manualmente (turma aberta ou com interesse
     encerrado) — modal visual. O admin escolhe o status na hora: Interessada
     (uso típico: alguém que avisou o interesse fora do site) ou Inscrita
     (uso típico: alguém que já se inscreveu direto no CMFlex). */
  function addParticipante(turmaKey) {
    var sess = window.faAuth && window.faAuth.getSession();
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';

    var areasOptions = AREAS_LIST.map(function (a) {
      return '<option value="' + a + '">' + a + '</option>';
    }).join('');

    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:460px;width:90%;padding:28px;display:flex;flex-direction:column;gap:14px';
    box.innerHTML =
      '<h3 style="font-size:1.1rem;font-family:var(--font-head);letter-spacing:.05em;color:var(--ink)">Adicionar Participante</h3>' +

      /* busca */
      '<div id="addPartSearchWrap">' +
        '<label class="auth-label" style="margin:0">Buscar pelo nome ou e-mail' +
          '<input type="text" id="addPartSearch" placeholder="Digite para buscar…" autocomplete="off" />' +
        '</label>' +
        '<ul id="addPartResults" style="margin:4px 0 0;padding:0;list-style:none;max-height:180px;overflow-y:auto;border:1px solid var(--line-strong);border-radius:6px;background:var(--panel-2);display:none"></ul>' +
      '</div>' +

      /* pessoa selecionada */
      '<div id="addPartSelected" style="display:none;background:rgba(255,255,255,.05);border:1px solid var(--accent);border-radius:8px;padding:10px 14px;font-size:.88rem;line-height:1.5">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
          '<div id="addPartSelectedInfo"></div>' +
          '<button id="addPartClearSel" style="background:none;border:none;color:var(--ink-3);font-size:.85rem;cursor:pointer;padding:0 0 0 8px;white-space:nowrap">✕ Trocar</button>' +
        '</div>' +
      '</div>' +

      /* aviso quando não encontrar */
      '<p style="font-size:.8rem;color:var(--ink-3);margin:0">Não encontrou a pessoa? Peça que ela faça o cadastro no site primeiro — após isso, ela aparecerá aqui na busca.</p>' +

      '<label class="auth-label" style="margin:0">Status<select id="addPartStatus" style="width:100%;padding:10px 12px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink);font-family:var(--font-body)">' +
        '<option value="">Selecione o status…</option>' +
        '<option value="interessado">Interessada</option>' +
        '<option value="inscrito">Inscrita</option>' +
      '</select></label>' +

      '<p id="addPartErr" style="color:var(--red,#ff3b30);font-size:.85rem;display:none;margin:0"></p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px">' +
        '<button class="btn admin-modal-cancel-btn">Cancelar</button>' +
        '<button class="btn btn--primary admin-modal-add-btn">Adicionar</button>' +
      '</div>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    var errEl       = box.querySelector('#addPartErr');
    var searchInput = box.querySelector('#addPartSearch');
    var resultsList = box.querySelector('#addPartResults');
    var selectedDiv = box.querySelector('#addPartSelected');
    var selectedInfo= box.querySelector('#addPartSelectedInfo');
    var clearSelBtn = box.querySelector('#addPartClearSel');

    var allUsers = [];   /* carregados do Firebase */
    var selected = null; /* { name, email, area } */

    firebase.database().ref('fa-users').once('value', function (snap) {
      var data = snap.val() || {};
      allUsers = Object.values(data).filter(function (u) { return u.email && u.name; });
    });

    function selectUser(u) {
      selected = u;
      selectedInfo.innerHTML = '<strong>' + esc(u.name) + '</strong><br>' + esc(u.email) + ' · ' + esc(u.area || '—');
      selectedDiv.style.display = '';
      resultsList.style.display = 'none';
      searchInput.value = '';
      showManual(false);
      box.querySelector('#addPartStatus').focus();
    }

    clearSelBtn.addEventListener('click', function () {
      selected = null;
      selectedDiv.style.display = 'none';
      searchInput.value = '';
      searchInput.focus();
    });

    searchInput.addEventListener('input', function () {
      var q = searchInput.value.trim().toLowerCase();
      if (!q) { resultsList.style.display = 'none'; return; }
      var matches = allUsers.filter(function (u) {
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      }).slice(0, 8);
      resultsList.innerHTML = '';
      if (!matches.length) {
        var li = document.createElement('li');
        li.style.cssText = 'padding:10px 14px;font-size:.83rem;color:var(--ink-3)';
        li.textContent = 'Nenhum cadastro encontrado.';
        resultsList.appendChild(li);
      } else {
        matches.forEach(function (u) {
          var li = document.createElement('li');
          li.style.cssText = 'padding:9px 14px;font-size:.83rem;cursor:pointer;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:2px';
          li.innerHTML = '<span style="color:var(--ink);font-weight:600">' + esc(u.name) + '</span>' +
            '<span style="color:var(--ink-3);font-size:.78rem">' + esc(u.email) + ' · ' + esc(u.area || '—') + '</span>';
          li.addEventListener('mouseenter', function () { li.style.background = 'rgba(255,255,255,.06)'; });
          li.addEventListener('mouseleave', function () { li.style.background = ''; });
          li.addEventListener('click', function () { selectUser(u); });
          resultsList.appendChild(li);
        });
      }
      resultsList.style.display = '';
    });

    function closeModal() { document.body.removeChild(overlay); }

    box.querySelector('.admin-modal-cancel-btn').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });

    box.querySelector('.admin-modal-add-btn').addEventListener('click', function () {
      var name, email, area;

      if (!selected) {
        errEl.textContent = 'Busque e selecione uma pessoa da lista.';
        errEl.style.display = ''; return;
      }
      name  = selected.name.toUpperCase();
      email = selected.email.toLowerCase();
      area  = selected.area || '';

      var status = (box.querySelector('#addPartStatus').value || '').trim();

      errEl.style.display = 'none';
      if (!status) { errEl.textContent = 'Selecione o status.'; errEl.style.display = ''; return; }

      var eKey = emailKeyFromEmail(email);
      var ref  = firebase.database().ref('turmas-interesse/' + turmaKey + '/' + eKey);
      ref.once('value', function (snap) {
        if (snap.val() && !snap.val().removed) {
          errEl.textContent = 'Este participante já está na turma.'; errEl.style.display = ''; return;
        }

        function save(overlaps) {
          var adminName = sess ? (sess.name || sess.email) : 'Admin';
          var updates = {};
          updates['turmas-interesse/' + turmaKey + '/' + eKey] = {
            name: name, email: email, area: area,
            date: new Date().toISOString(),
            status: status, addedByAdmin: true,
            addedByAdminName: adminName
          };
          var now = new Date().toISOString();
          overlaps.forEach(function (o) {
            updates['turmas-interesse/' + o.turma + '/' + o.eKey + '/removed'] = true;
            updates['turmas-interesse/' + o.turma + '/' + o.eKey + '/removedDate'] = now;
            updates['turmas-interesse/' + o.turma + '/' + o.eKey + '/removedReason'] = 'Inscrita automaticamente na turma "' + turmaLabel(turmaKey) + '"';
          });
          firebase.database().ref().update(updates, function (err) {
            if (err) { errEl.textContent = 'Erro ao adicionar. Tente novamente.'; errEl.style.display = ''; return; }
            closeModal();
            loadInterests();
          });
        }

        /* Adicionar direto como Inscrita exige a mesma exclusividade que o
           "Confirmar" já garante — ninguém pode ficar inscrita em mais de
           uma turma. Como "Interessada" não tem esse limite, só checa
           sobreposição quando o status escolhido é "inscrito". */
        if (status === 'inscrito') {
          checkOutrasTurmas(turmaKey, [eKey], function (overlaps) {
            if (!overlaps.length) { save(overlaps); return; }
            var lista = overlaps.map(function (o) { return '• já está inscrita na "' + turmaLabel(o.turma) + '"'; }).join('\n');
            adminConfirm(
              'Adicionar ' + name + ' como Inscrita em "' + turmaLabel(turmaKey) + '"?\n\n' +
              'Ela já é inscrita em outra turma. Se continuar, essa outra inscrição será removida automaticamente (ninguém pode ficar inscrita em mais de uma):\n\n' + lista,
              function () { save(overlaps); }
            );
          });
        } else {
          save([]);
        }
      });
    });
  }

  /* ---- Criar / Editar evento ---- */
  function openEventoFormModal(existing) {
    var isEdit = !!existing;
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';

    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:420px;width:90%;padding:28px;display:flex;flex-direction:column;gap:16px';
    box.innerHTML =
      '<h3 style="font-size:1.1rem;font-family:var(--font-head);letter-spacing:.05em;color:var(--ink)">' + (isEdit ? 'Editar Evento' : 'Novo Evento') + '</h3>' +
      '<label class="auth-label">Nome do evento<input type="text" id="eventoFormNome" placeholder="Ex: FORÇA ÁGIL · JORNADA DE IMERSÃO" autocomplete="off" /></label>' +
      '<label class="auth-label" style="flex-direction:row;align-items:center;gap:10px">Carga horária<input type="number" id="eventoFormCarga" placeholder="20" min="1" max="999" style="width:80px" /><span style="opacity:.7">horas</span></label>' +
      '<label class="auth-label" style="flex-direction:row;align-items:center;gap:10px">Frequência mínima p/ certificado<input type="number" id="eventoFormPercentual" placeholder="75" min="1" max="100" style="width:80px" /><span style="opacity:.7">%</span></label>' +
      '<p id="eventoFormErr" style="color:var(--red,#ff3b30);font-size:.85rem;display:none"></p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px">' +
        '<button class="btn admin-modal-cancel-btn">Cancelar</button>' +
        '<button class="btn btn--primary admin-modal-save-btn">' + (isEdit ? 'Salvar' : 'Criar evento') + '</button>' +
      '</div>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    var nomeInput       = box.querySelector('#eventoFormNome');
    var cargaInput      = box.querySelector('#eventoFormCarga');
    var percentualInput = box.querySelector('#eventoFormPercentual');
    var errEl           = box.querySelector('#eventoFormErr');

    nomeInput.value       = isEdit ? existing.nome : '';
    cargaInput.value      = isEdit ? existing.cargaHoraria : '20';
    percentualInput.value = isEdit ? (existing.percentualMinimo || '75') : '75';

    function closeModal() { document.body.removeChild(overlay); }
    box.querySelector('.admin-modal-cancel-btn').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });

    box.querySelector('.admin-modal-save-btn').addEventListener('click', function () {
      var nome       = (nomeInput.value || '').trim();
      var carga      = (cargaInput.value || '').trim();
      var percentual = (percentualInput.value || '75').trim();
      errEl.style.display = 'none';
      if (!nome) { errEl.textContent = 'Dê um nome ao evento.'; errEl.style.display = ''; return; }
      if (!carga || isNaN(Number(carga)) || Number(carga) < 1) {
        errEl.textContent = 'Informe a carga horária (mín. 1 hora).'; errEl.style.display = ''; return;
      }
      if (!percentual || isNaN(Number(percentual)) || Number(percentual) < 1 || Number(percentual) > 100) {
        errEl.textContent = 'Frequência mínima deve ser entre 1 e 100%.'; errEl.style.display = ''; return;
      }
      var eventData = { nome: nome, cargaHoraria: carga, percentualMinimo: percentual };
      if (isEdit) {
        firebase.database().ref('eventos/' + existing.key).update(eventData, function (err) {
          if (err) { errEl.textContent = 'Erro ao salvar. Tente novamente.'; errEl.style.display = ''; return; }
          closeModal();
          loadInterests();
        });
      } else {
        eventData.order = Date.now();
        eventData.createdAt = new Date().toISOString();
        firebase.database().ref('eventos').push().set(eventData, function (err) {
          if (err) { errEl.textContent = 'Erro ao criar. Tente novamente.'; errEl.style.display = ''; return; }
          closeModal();
          loadInterests();
        });
      }
    });
  }

  /* ---- Criar / Editar turma — modal com nome + datas dos encontros ---- */
  function openTurmaFormModal(existing, defaultEventoKey) {
    var isEdit = !!existing;
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';

    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'max-width:460px;width:90%;padding:28px;display:flex;flex-direction:column;gap:16px;max-height:85vh;overflow:auto';
    var eventoOpts = '<option value="">— sem evento —</option>' +
      EVENTOS_LIST.map(function (ev) {
        return '<option value="' + esc(ev.key) + '">' + esc(ev.nome) + ' (' + ev.cargaHoraria + 'h)</option>';
      }).join('');

    box.innerHTML =
      '<h3 style="font-size:1.1rem;font-family:var(--font-head);letter-spacing:.05em;color:var(--ink)">' + (isEdit ? 'Editar Turma' : 'Nova Turma') + '</h3>' +
      '<label class="auth-label">Evento<select id="turmaFormEvento" style="padding:8px 10px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink);font-family:var(--font-body);width:100%">' + eventoOpts + '</select></label>' +
      '<label class="auth-label">Nome da turma<input type="text" id="turmaFormLabel" placeholder="Ex: Turma 4 — Janeiro" autocomplete="off" /></label>' +
      '<label class="auth-label">Link do CMFlex <span style="opacity:.6;font-weight:400">(opcional)</span><input type="url" id="turmaFormCmflex" placeholder="https://..." autocomplete="off" /></label>' +
      '<div>' +
        '<span class="auth-label" style="display:block;margin-bottom:8px">Datas dos encontros</span>' +
        '<div id="turmaDatesList" style="display:flex;flex-direction:column;gap:8px;"></div>' +
        '<button type="button" class="btn btn--sm" id="turmaAddDateBtn" style="margin-top:8px">+ Adicionar data</button>' +
      '</div>' +
      '<p id="turmaFormErr" style="color:var(--red,#ff3b30);font-size:.85rem;display:none"></p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px">' +
        '<button class="btn admin-modal-cancel-btn">Cancelar</button>' +
        '<button class="btn btn--primary admin-modal-save-btn">' + (isEdit ? 'Salvar' : 'Criar turma') + '</button>' +
      '</div>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    var eventoSel   = box.querySelector('#turmaFormEvento');
    var labelInput  = box.querySelector('#turmaFormLabel');
    var cmflexInput = box.querySelector('#turmaFormCmflex');
    var datesList   = box.querySelector('#turmaDatesList');
    var errEl       = box.querySelector('#turmaFormErr');

    eventoSel.value   = isEdit ? (existing.eventoKey || '') : (defaultEventoKey || '');
    labelInput.value  = isEdit ? existing.label : '';
    cmflexInput.value = isEdit ? (existing.cmflexLink || '') : '';

    function addDateRow(value) {
      var row = document.createElement('div');
      row.className = 'turma-date-row';
      row.style.cssText = 'display:flex;gap:8px;align-items:center;';
      row.innerHTML =
        '<input type="date" style="flex:1;padding:8px 10px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink);font-family:var(--font-body)" />' +
        '<button type="button" class="btn btn--sm turma-date-remove" style="padding:6px 10px">✕</button>';
      row.querySelector('input').value = value || '';
      row.querySelector('.turma-date-remove').addEventListener('click', function () { row.remove(); });
      datesList.appendChild(row);
    }

    if (isEdit && existing.dias.length) {
      existing.dias.forEach(function (d) { addDateRow(d); });
    } else {
      addDateRow('');
    }

    box.querySelector('#turmaAddDateBtn').addEventListener('click', function () { addDateRow(''); });

    function closeModal() { document.body.removeChild(overlay); }
    box.querySelector('.admin-modal-cancel-btn').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });

    box.querySelector('.admin-modal-save-btn').addEventListener('click', function () {
      var label = (labelInput.value || '').trim();
      var cmflexLink = (cmflexInput.value || '').trim();
      var dias = Array.prototype.map.call(datesList.querySelectorAll('input[type=date]'), function (i) { return i.value; })
        .filter(Boolean).sort();

      errEl.style.display = 'none';
      if (!label) { errEl.textContent = 'Dê um nome pra turma.'; errEl.style.display = ''; return; }
      if (!dias.length) { errEl.textContent = 'Adicione pelo menos uma data.'; errEl.style.display = ''; return; }

      var data = { label: label, dias: dias, cmflexLink: cmflexLink, eventoKey: eventoSel.value || '' };
      if (isEdit) {
        firebase.database().ref('turmas/' + existing.key).update(data, function (err) {
          if (err) { errEl.textContent = 'Erro ao salvar. Tente novamente.'; errEl.style.display = ''; return; }
          closeModal();
          loadInterests();
        });
      } else {
        data.order = Date.now();
        data.createdAt = new Date().toISOString();
        firebase.database().ref('turmas').push().set(data, function (err) {
          if (err) { errEl.textContent = 'Erro ao criar. Tente novamente.'; errEl.style.display = ''; return; }
          closeModal();
          loadInterests();
        });
      }
    });
  }

  /* ---- Excluir turma — apaga a turma e todos os dados ligados a ela ---- */
  function deleteTurma(t, active, removed) {
    var msg = 'Excluir a turma "' + t.label + '"?\n\nIsso apaga permanentemente a turma e todos os dados ligados a ela';
    if (active.length || removed.length) {
      msg += ' — incluindo ' + active.length + ' participante' + (active.length !== 1 ? 's' : '') + ' ativo' + (active.length !== 1 ? 's' : '') +
        (removed.length ? ' e ' + removed.length + ' removido' + (removed.length !== 1 ? 's' : '') : '') + ', presenças e histórico';
    }
    msg += '.\n\nEssa ação não pode ser desfeita.';
    adminConfirm(msg, function () {
      var updates = {};
      updates['turmas/' + t.key] = null;
      updates['turmas-interesse/' + t.key] = null;
      updates['turmas-config/' + t.key] = null;
      updates['turmas-checkin/' + t.key] = null;
      updates['turmas-interesse-log/' + t.key] = null;
      firebase.database().ref().update(updates, function (err) {
        if (err) { adminAlert('Erro ao excluir. Tente novamente.'); return; }
        loadInterests();
      });
    });
  }

  /* ---- Finalizar / Reabrir turma ---- */

  /* Verifica se algum dos candidatos a inscrito também está interessado (não removido)
     em outra turma — precisa saber ANTES de finalizar, para avisar o admin */
  /* Só existe conflito de verdade quando a pessoa já é Inscrita em outra
     turma — interesse (status "interessado") em quantas turmas quiser não é
     problema, então não entra aqui. Ao confirmar/adicionar como Inscrita
     numa turma, só a inscrição já existente em outra é removida. */
  function checkOutrasTurmas(turmaKey, candidatos, cb) {
    var outras = TURMAS_LIST.map(function (t) { return t.key; }).filter(function (k) { return k !== turmaKey; });
    var pending = candidatos.length * outras.length;
    if (!pending) { cb([]); return; }
    var overlaps = [];
    outras.forEach(function (t) {
      candidatos.forEach(function (eKey) {
        firebase.database().ref('turmas-interesse/' + t + '/' + eKey).once('value', function (snap) {
          pending--;
          var val = snap.val();
          if (val && !val.removed && val.status === 'inscrito') overlaps.push({ eKey: eKey, name: val.name || eKey, turma: t });
          if (pending === 0) cb(overlaps);
        });
      });
    });
  }

  /* Encerrar interesse só fecha a captação pro público e libera check-in/certificados —
     não promove mais ninguém a inscrito automaticamente. A inscrição oficial agora
     acontece no CMFlex, fora do portal; quem de fato se inscreveu lá é confirmado
     manualmente, pessoa por pessoa (ver confirmarInscrito). */
  function finalizeTurma(turmaKey) {
    adminConfirm(
      'Encerrar o interesse da turma "' + turmaLabel(turmaKey) + '"?\n\n' +
      'O card público vai parar de aceitar novo interesse e passa a orientar as pessoas pra se inscreverem no CMFlex. ' +
      'Ninguém vira inscrita automaticamente — você confirma cada pessoa manualmente depois, quando souber que ela se inscreveu de fato no CMFlex.',
      function () {
        firebase.database().ref('turmas-config/' + turmaKey + '/finalizada').set(true, function (err) {
          if (err) { adminAlert('Erro ao encerrar. Tente novamente.'); return; }
          loadInterests();
        });
      }
    );
  }

  function reopenTurma(turmaKey) {
    adminConfirm('Reabrir o interesse da turma "' + turmaLabel(turmaKey) + '"?\n\nO card volta a aceitar novas manifestações de interesse. Quem já foi confirmado como inscrito continua inscrito.', function () {
      var updates = {};
      updates['turmas-config/' + turmaKey + '/finalizada'] = false;
      updates['turmas-config/' + turmaKey + '/diaAtivo']   = null;
      firebase.database().ref().update(updates, function (err) {
        if (err) { adminAlert('Erro ao reabrir. Tente novamente.'); return; }
        loadInterests();
      });
    });
  }

  /* ---- Confirmar / Desconfirmar inscrição no CMFlex (por pessoa) ---- */
  function confirmarInscrito(turmaKey, eKey, pessoa) {
    checkOutrasTurmas(turmaKey, [eKey], function (overlaps) {
      var msg = 'Confirmar que ' + pessoa.name + ' se inscreveu no CMFlex para "' + turmaLabel(turmaKey) + '"?\n\nEla passa a ter acesso a Conteúdos, Treinamento Jedi e pode registrar presença.';
      if (overlaps.length) {
        var lista = overlaps.map(function (o) { return '• já está inscrita na "' + turmaLabel(o.turma) + '"'; }).join('\n');
        msg += '\n\nEla já é inscrita em outra turma. Se continuar, essa outra inscrição será removida automaticamente (ninguém pode ficar inscrita em mais de uma):\n\n' + lista;
      }
      adminConfirm(msg, function () {
        var sess = window.faAuth && window.faAuth.getSession();
        var updates = {};
        updates['turmas-interesse/' + turmaKey + '/' + eKey + '/status'] = 'inscrito';
        updates['turmas-interesse/' + turmaKey + '/' + eKey + '/confirmedByAdmin'] = sess ? sess.email : null;
        updates['turmas-interesse/' + turmaKey + '/' + eKey + '/confirmedByAdminName'] = sess ? (sess.name || sess.email) : null;
        updates['turmas-interesse/' + turmaKey + '/' + eKey + '/confirmedDate'] = new Date().toISOString();
        var now = new Date().toISOString();
        overlaps.forEach(function (o) {
          updates['turmas-interesse/' + o.turma + '/' + o.eKey + '/removed'] = true;
          updates['turmas-interesse/' + o.turma + '/' + o.eKey + '/removedDate'] = now;
          updates['turmas-interesse/' + o.turma + '/' + o.eKey + '/removedReason'] = 'Inscrita automaticamente na turma "' + turmaLabel(turmaKey) + '"';
        });
        firebase.database().ref().update(updates, function (err) {
          if (err) { adminAlert('Erro ao confirmar. Tente novamente.'); return; }
          firebase.database().ref('turmas-interesse-log/' + turmaKey + '/' + eKey).push({
            name: pessoa.name, email: pessoa.email, area: pessoa.area || '',
            action: 'confirmado', date: now,
            adminName: sess ? (sess.name || sess.email) : 'Admin'
          });
          loadInterests();
        });
      });
    });
  }

  function desconfirmarInscrito(turmaKey, eKey, pessoa) {
    adminConfirm('Desconfirmar a inscrição de ' + pessoa.name + ' em "' + turmaLabel(turmaKey) + '"?\n\nEla perde na hora o acesso a Conteúdos, Treinamento Jedi e não poderá mais registrar presença. Continua como interessada na turma.', function () {
      var sess = window.faAuth && window.faAuth.getSession();
      var now = new Date().toISOString();
      var updates = {};
      updates['turmas-interesse/' + turmaKey + '/' + eKey + '/status'] = 'interessado';
      updates['turmas-interesse/' + turmaKey + '/' + eKey + '/confirmedByAdmin'] = null;
      updates['turmas-interesse/' + turmaKey + '/' + eKey + '/confirmedByAdminName'] = null;
      updates['turmas-interesse/' + turmaKey + '/' + eKey + '/confirmedDate'] = null;
      firebase.database().ref().update(updates, function (err) {
        if (err) { adminAlert('Erro ao desconfirmar. Tente novamente.'); return; }
        firebase.database().ref('turmas-interesse-log/' + turmaKey + '/' + eKey).push({
          name: pessoa.name, email: pessoa.email, area: pessoa.area || '',
          action: 'desconfirmado', date: now,
          adminName: sess ? (sess.name || sess.email) : 'Admin'
        });
        loadInterests();
      });
    });
  }

  /* ---- QR Code modal ---- */
  function openQrModal(t) {
    var modal   = document.getElementById('qrModal');
    var canvas  = document.getElementById('qrCanvas');
    var errEl   = document.getElementById('qrModalError');
    var turmaEl = document.getElementById('qrModalTurma');
    var urlEl   = document.getElementById('qrModalUrl');
    if (!modal || !canvas) return;
    var url = window.location.origin + window.location.pathname + '#checkin?turma=' + t.key;
    turmaEl.textContent = t.label + ' (' + t.dates + ')';
    urlEl.textContent   = url;
    canvas.hidden = false;
    if (errEl) errEl.hidden = true;
    if (typeof QRCode !== 'undefined') {
      QRCode.toCanvas(canvas, url, { width: 220, color: { dark: '#ffffff', light: '#0d1b2a' } }, function (err) {
        if (err) {
          console.warn('QR error:', err);
          canvas.hidden = true;
          if (errEl) errEl.hidden = false;
        }
      });
    } else {
      /* Biblioteca externa (CDN) não carregou — evita deixar o quadro em branco sem explicação */
      canvas.hidden = true;
      if (errEl) errEl.hidden = false;
    }
    modal.hidden = false;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var closeBtn = document.getElementById('qrModalClose');
    var modal    = document.getElementById('qrModal');
    if (closeBtn && modal) {
      closeBtn.addEventListener('click', function () { modal.hidden = true; });
      modal.addEventListener('click', function (e) { if (e.target === modal) modal.hidden = true; });
    }
  });

  /* ---- CSV exports ---- */
  function exportTurmaCSV(t, all, finalizada, checkinT) {
    var minDias = Math.ceil(t.dias.length * CRITERIO_PRESENCA);
    var rows = [];
    /* MUDANÇA 1: exportar apenas não-removidos */
    var active = all.filter(function (r) { return r.removed !== true; });
    active.forEach(function (r) {
      var eKey = emailKeyFromEmail(r.email);
      var st = getStatus(r);
      var addedBy = r.addedByAdmin === true ? (r.addedByAdminName || 'Admin') : '';
      var row = [t.label, r.name||'', r.email||'', r.area||'', st,
        r.date ? new Date(r.date).toLocaleString('pt-BR') : '', addedBy];
      if (finalizada) {
        var diasPresente = 0;
        t.dias.forEach(function (d) {
          var ck = checkinT[d] && checkinT[d][eKey];
          row.push(ck ? (ck.source === 'admin' ? 'adm' : 'qr') : '');
          if (ck) diasPresente++;
        });
        row.push(diasPresente + '/' + t.dias.length);
        row.push(diasPresente >= minDias ? 'Sim' : 'Não');
      }
      rows.push(row);
    });
    var headers = ['Turma','Nome','E-mail','Área','Status','Data Registro','Adicionado por'];
    if (finalizada) {
      t.dias.forEach(function (d) { headers.push(fmtDia(d)); });
      headers.push('Frequência', 'Atingiu critério (' + Math.round(CRITERIO_PRESENCA * 100) + '%)');
    }
    toXls(headers, rows, 'turma-' + t.key + '-' + new Date().toISOString().slice(0,10) + '.csv');
  }

  function exportAllInterests(data, config, checkin) {
    var rows = [];
    TURMAS_LIST.forEach(function (t) {
      var finalizada = !!(config[t.key] && config[t.key].finalizada);
      var checkinT   = checkin[t.key] || {};
      var all = data[t.key] ? Object.values(data[t.key]) : [];
      /* MUDANÇA 1: exportar apenas não-removidos */
      var active = all.filter(function (r) { return r.removed !== true; });
      active.forEach(function (r) {
        var eKey = emailKeyFromEmail(r.email);
        var st = getStatus(r);
        var diasPresente = 0;
        t.dias.forEach(function (d) { if (checkinT[d] && checkinT[d][eKey]) diasPresente++; });
        rows.push([t.label, r.name||'', r.email||'', r.area||'', st,
          r.date ? new Date(r.date).toLocaleString('pt-BR') : '',
          finalizada ? diasPresente + '/' + t.dias.length : '']);
      });
    });
    toXls(['Turma','Nome','E-mail','Área','Status','Data Registro','Frequência'],
      rows, 'turmas-estado-' + new Date().toISOString().slice(0,10) + '.csv');
  }

  function exportInterestLog() {
    var db = firebase.database();
    db.ref('turmas-interesse-log').once('value', function (snapLog) {
      db.ref('turmas-interesse').once('value', function (snapI) {
        var logData      = snapLog.val() || {};
        var interestData = snapI.val()   || {};
        var rows = [];

        function fmtData(iso) { if (!iso) return ''; var d = new Date(iso); return d.toLocaleDateString('pt-BR'); }
        function fmtHora(iso) { if (!iso) return ''; var d = new Date(iso); return d.toLocaleTimeString('pt-BR'); }

        TURMAS_LIST.forEach(function (t) {
          var entries = [];

          /* Ações de usuário (log) */
          var turmaLog = logData[t.key] || {};
          Object.values(turmaLog).forEach(function (userLog) {
            Object.values(userLog).forEach(function (entry) {
              var ACAO_LABELS = {
                registrado: 'Interesse registrado', removido: 'Interesse removido',
                confirmado: 'Confirmado como inscrita', desconfirmado: 'Desconfirmado (voltou a interessada)'
              };
              var acao = ACAO_LABELS[entry.action] || entry.action;
              var origem = entry.adminName ? 'Admin — ' + entry.adminName : 'Participante';
              entries.push({ ts: entry.date || '', row: [t.label, entry.name||'', entry.email||'', entry.area||'', fmtData(entry.date), fmtHora(entry.date), acao, origem] });
            });
          });

          /* Ações do admin lidas diretamente de turmas-interesse (add e remove) */
          var turmaI = interestData[t.key] || {};
          Object.values(turmaI).forEach(function (r) {
            if (r.addedByAdmin && r.addedByAdminName) {
              entries.push({ ts: r.date || '', row: [t.label, r.name||'', r.email||'', r.area||'', fmtData(r.date), fmtHora(r.date), 'Adicionado pelo admin', 'Admin — ' + r.addedByAdminName] });
            }
            if (r.removed && r.removedByAdminName) {
              entries.push({ ts: r.removedDate || '', row: [t.label, r.name||'', r.email||'', r.area||'', fmtData(r.removedDate), fmtHora(r.removedDate), 'Removido pelo admin', 'Admin — ' + r.removedByAdminName] });
            }
          });

          entries.sort(function (a, b) { return (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0); });
          entries.forEach(function (e) { rows.push(e.row); });
        });

        toXls(['Turma','Nome','E-mail','Área','Data','Hora','Ação','Origem'],
          rows, 'historico-' + new Date().toISOString().slice(0,10) + '.csv');
      });
    });
  }

  function toXls(headers, rows, filename) {
    function csvCell(v) {
      var s = String(v == null ? '' : v).replace(/"/g, '""');
      return /["\n\r;]/.test(s) ? '"' + s + '"' : s;
    }
    var lines = [headers.map(csvCell).join(';')].concat(
      rows.map(function (row) { return row.map(csvCell).join(';'); })
    );
    var csvFilename = filename.replace(/\.xls$/i, '.csv');
    /* BOM UTF-8 (﻿) garante que Excel abra com encoding correto e em modo editável */
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = csvFilename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 100);
  }
  window.faToXls = toXls;

  const REPO_SEEDS = [
    { type: 'doc',   title: 'The Scrum Guide',                       url: 'https://scrumguides.org/',                                                                                                                                              desc: '' },
    { type: 'video', title: 'Agile Product Ownership in a Nutshell', url: 'https://www.youtube.com/results?search_query=agile+product+ownership+in+a+nutshell+kniberg',                                                                           desc: '' },
    { type: 'video', title: 'O que é Agilidade? (busca)',            url: 'https://www.youtube.com/results?search_query=o+que+%C3%A9+agilidade+business+agility',                                                                                  desc: '' },
    { type: 'tool',  title: 'OKR — Objetivos e Key Results',         url: 'https://www.youtube.com/results?search_query=como+escrever+okr+objetivo+key+results',                                                                                   desc: '' },
    { type: 'tool',  title: 'Design Thinking & Duplo Diamante',      url: 'https://www.youtube.com/results?search_query=duplo+diamante+design+thinking',                                                                                            desc: '' },
    { type: 'book',  title: 'Team OKR em Ação',                      url: 'https://caroli.org/livro/team-okr/',                                                                                                                                      desc: '' },
    { type: 'book',  title: 'O Poder da Simplicidade no Mundo Ágil — Susanne Andrade', url: 'https://susanneandrade.com.br/livros-2',                                                                                                               desc: 'Indicado por Maira Prado.' },
    { type: 'video', title: 'MBA em Liderança Exponencial e Transformação Digital (Udemy)', url: 'https://www.udemy.com/course/xba-em-lideranca-exponencial-e-transformacao-digital/',                                                              desc: 'Indicado por Vanisa Miksucas.' },
    { type: 'book',  title: 'Kanban: Mudança Evolucionária de Sucesso — David J. Anderson', url: 'https://shop.leankanban.com/collections/kanban-mudanca-evolucionaria-de-sucesso-para-seu-negocio-de-tecnologia-david-j-anderson-portuguese/david-anderson', desc: 'Indicado por Pedro Ferrari.' },
    { type: 'video', title: 'Fome de Poder — Processos (Lean com analogias a Star Wars)', url: 'https://www.youtube.com/watch?v=8Xt63PHuMqU',                                                                                                      desc: 'Indicado por Daniel Frazão.' },
    { type: 'video', title: 'Desdobramento de OKR na prática',       url: 'https://www.youtube.com/watch?v=jP35UFXDnzA',                                                                                                                            desc: 'Indicado por Rodolfo Credi.' }
  ];

  const TYPE_LABEL = { doc: 'documento', video: 'vídeo', book: 'livro', tool: 'ferramenta', link: 'link' };

  function seedKey(url) {
    return (url || '').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 80);
  }

  /* ---- Repo items for admin ---- */
  function loadRepoAdmin() {
    const c = document.getElementById('adminRepo');
    if (!c) return;
    c.innerHTML = '<p class="loading-msg">Carregando repositório…</p>';

    Promise.all([
      firebase.database().ref('fa-seeds-hidden').once('value'),
      firebase.database().ref('fa-seeds-deleted').once('value'),
      firebase.database().ref('fa-holocron-hidden').once('value'),
      firebase.database().ref('holocron').once('value')
    ]).then(function (snaps) {
      const hidden      = snaps[0].val() || {};
      const deleted     = snaps[1].val() || {};
      const hiddenHolo  = snaps[2].val() || {};
      const holoData    = snaps[3].val() || {};
      const fbEntries   = Object.entries(holoData);

      c.innerHTML = '';

      const visibleSeeds = REPO_SEEDS.filter(function (s) { return !deleted[seedKey(s.url)]; });
      const total = visibleSeeds.length + fbEntries.length;
      const h4 = document.createElement('h4');
      h4.innerHTML = 'Todos os conteúdos <span class="admin-badge">' + total + '</span>';
      c.appendChild(h4);

      /* Seeds curados */
      const seedSec = document.createElement('div');
      seedSec.innerHTML = '<p style="font-size:.75rem;color:var(--ink-3);margin:16px 0 8px;text-transform:uppercase;letter-spacing:.1em">Curados (seed)</p>';
      c.appendChild(seedSec);

      visibleSeeds.forEach(function (item) {
        const sk  = seedKey(item.url);
        const isHidden = !!hidden[sk];
        const row = document.createElement('div');
        row.className = 'admin-repo-row';
        if (isHidden) row.style.opacity = '.45';

        const by = (function () {
          var m = (item.desc || '').match(/Indicado por ([^.]+)/);
          return m ? ' · Indicado por ' + esc(m[1].trim()) : '';
        })();

        const actionBtns = isHidden
          ? '<button class="admin-del-btn admin-restore-btn">Restaurar</button>'
          : '<button class="admin-del-btn admin-hide-btn">Ocultar</button>';

        row.innerHTML =
          '<div class="admin-repo-info">' +
            '<span class="admin-repo-title">' + esc(item.title) + '</span>' +
            '<span class="admin-repo-by">curado · ' + esc(TYPE_LABEL[item.type] || item.type) + by + (isHidden ? ' · <em>oculto</em>' : '') + '</span>' +
          '</div>' +
          '<div style="display:flex;gap:6px">' + actionBtns + '<button class="admin-del-btn admin-perm-del-btn">Deletar</button></div>';

        row.querySelector('.admin-hide-btn, .admin-restore-btn').addEventListener('click', function () {
          if (isHidden) {
            adminConfirm('Restaurar "' + item.title + '" no repositório público?', function () {
              firebase.database().ref('fa-seeds-hidden/' + sk).remove(function () { loadRepoAdmin(); });
            });
          } else {
            adminConfirm('Ocultar "' + item.title + '" do repositório público?', function () {
              firebase.database().ref('fa-seeds-hidden/' + sk).set(true, function () { loadRepoAdmin(); });
            });
          }
        });

        row.querySelector('.admin-perm-del-btn').addEventListener('click', function () {
          adminConfirm('Deletar permanentemente "' + item.title + '"? Esta ação não pode ser desfeita.', function () {
            const updates = {};
            updates['fa-seeds-deleted/' + sk] = true;
            updates['fa-seeds-hidden/' + sk]  = true;
            firebase.database().ref().update(updates, function () { loadRepoAdmin(); });
          });
        });

        seedSec.appendChild(row);
      });

      /* Itens enviados por usuários */
      const userSec = document.createElement('div');
      userSec.innerHTML = '<p style="font-size:.75rem;color:var(--ink-3);margin:24px 0 8px;text-transform:uppercase;letter-spacing:.1em">Enviados por usuários</p>';
      c.appendChild(userSec);

      if (!fbEntries.length) {
        userSec.innerHTML += '<p class="admin-empty">Nenhum item enviado ainda.</p>';
      } else {
        fbEntries.forEach(function (e) {
          const key = e[0], item = e[1];
          const isHiddenHolo = !!hiddenHolo[key];
          const row = document.createElement('div');
          row.className = 'admin-repo-row';
          if (isHiddenHolo) row.style.opacity = '.45';

          row.innerHTML =
            '<div class="admin-repo-info">' +
              '<span class="admin-repo-title">' + esc(item.title || '—') + (isHiddenHolo ? ' <em style="color:var(--ink-3);font-size:.78rem">(oculto)</em>' : '') + '</span>' +
              '<span class="admin-repo-by">' + esc(item.authorName || '—') + (item.createdAt ? ' · ' + fmtDate(item.createdAt) : '') + '</span>' +
            '</div>' +
            '<div style="display:flex;gap:6px">' +
              (isHiddenHolo
                ? '<button class="admin-del-btn admin-restore-btn" data-key="' + esc(key) + '">Restaurar</button>'
                : '<button class="admin-del-btn admin-hide-btn" data-key="' + esc(key) + '">Ocultar</button>') +
              '<button class="admin-del-btn admin-perm-del-btn" data-key="' + esc(key) + '">Deletar</button>' +
            '</div>';

          row.querySelector('.admin-hide-btn, .admin-restore-btn').addEventListener('click', function () {
            if (isHiddenHolo) {
              adminConfirm('Restaurar "' + (item.title || '') + '" no repositório público?', function () {
                firebase.database().ref('fa-holocron-hidden/' + key).remove(function () { loadRepoAdmin(); });
              });
            } else {
              adminConfirm('Ocultar "' + (item.title || '') + '" do repositório público?', function () {
                firebase.database().ref('fa-holocron-hidden/' + key).set(true, function () { loadRepoAdmin(); });
              });
            }
          });

          row.querySelector('.admin-perm-del-btn').addEventListener('click', function () {
            adminConfirm('Deletar "' + esc(item.title || '') + '" do repositório? Esta ação não pode ser desfeita.', function () {
              firebase.database().ref('holocron/' + key).remove(function (err) {
                if (!err) { firebase.database().ref('fa-holocron-hidden/' + key).remove(); row.remove(); }
                else adminAlert('Erro ao deletar. Tente novamente.');
              });
            });
          });

          userSec.appendChild(row);
        });
      }
    });
  }

  function handlePwdReset(btn) {
    const email = btn.dataset.email;
    const name  = btn.dataset.name;
    adminConfirm('Enviar e-mail de redefinição de senha para ' + name + ' (' + email + ')?', function () {
      firebase.auth().sendPasswordResetEmail(email)
        .then(function () {
          adminAlert('E-mail enviado para ' + email + '.\n' + name + ' receberá o link em alguns minutos para definir uma nova senha.');
        })
        .catch(function (err) {
          if (err.code === 'auth/user-not-found') {
            adminAlert(name + ' ainda não tem cadastro ativo. A pessoa precisa fazer o primeiro login no sistema antes de poder redefinir a senha.');
          } else {
            adminAlert('Erro ao enviar: ' + err.message);
          }
        });
    });
  }

  /* ---- Lista de Espera ---- */
  function loadEspera() {
    var c = document.getElementById('adminEspera');
    if (!c) return;
    c.innerHTML = '<p class="loading-msg">Carregando…</p>';
    firebase.database().ref('fa-espera').once('value').then(function (snap) {
      renderEspera(c, snap.val() || {});
    });
  }

  function renderEspera(c, data) {
    var list = Object.entries(data)
      .map(function (e) { return Object.assign({ _key: e[0] }, e[1]); })
      .filter(function (p) { return !p.removed; })
      .sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); });

    c.innerHTML = '';
    var hdr = document.createElement('h4');
    hdr.innerHTML = 'Lista de Espera <span class="admin-badge">' + list.length + '</span>';
    c.appendChild(hdr);

    if (!list.length) {
      c.insertAdjacentHTML('beforeend', '<p class="admin-empty">Nenhuma pessoa na lista de espera.</p>');
      return;
    }

    /* carrega turmas disponíveis para o dropdown "Mover para turma" */
    firebase.database().ref('turmas').once('value', function (tSnap) {
      firebase.database().ref('turmas-config').once('value', function (cfgSnap) {
        var turmasVal = tSnap.val() || {};
        var cfgVal    = cfgSnap.val() || {};
        var turmaOpts = Object.keys(turmasVal).map(function (k) {
          var cfg = cfgVal[k] || {};
          return { key: k, label: turmasVal[k].label || k.toUpperCase(), encerrada: !!(cfg.encerrada) };
        }).filter(function (t) { return !t.encerrada; });

        var optsHtml = '<option value="">Selecione a turma…</option>' +
          turmaOpts.map(function (t) { return '<option value="' + esc(t.key) + '">' + esc(t.label) + '</option>'; }).join('');
        var semTurmas = !turmaOpts.length;

        var wrap = document.createElement('div');
        wrap.className = 'table-scroll-wrap';
        var table = document.createElement('table');
        table.className = 'admin-table';
        table.innerHTML =
          '<thead><tr>' +
            '<th>Nome</th><th>E-mail</th><th>Área</th><th>Data</th><th>Ações</th>' +
          '</tr></thead>';
        var tbody = document.createElement('tbody');

        list.forEach(function (p) {
          var tr = document.createElement('tr');
          var dataFmt = p.date ? p.date.slice(0, 10) : '—';
          tr.innerHTML =
            '<td>' + esc(p.name || '—') + '</td>' +
            '<td>' + esc(p.email || '—') + '</td>' +
            '<td>' + esc(p.area || '—') + '</td>' +
            '<td>' + dataFmt + '</td>' +
            '<td></td>';

          var tdAcoes = tr.querySelector('td:last-child');
          tdAcoes.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap';

          /* Select turma */
          if (semTurmas) {
            tdAcoes.insertAdjacentHTML('beforeend', '<span style="font-size:.75rem;color:var(--ink-3)">Sem turmas abertas</span>');
          } else {
            var sel = document.createElement('select');
            sel.className = 'admin-status-btn';
            sel.style.cssText = 'padding:5px 8px;font-size:.75rem;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink);cursor:pointer';
            sel.innerHTML = optsHtml;
            tdAcoes.appendChild(sel);

            var moverBtn = document.createElement('button');
            moverBtn.className = 'btn btn--sm btn--primary';
            moverBtn.style.cssText = 'padding:5px 10px;font-size:.75rem';
            moverBtn.textContent = 'Mover para turma';
            moverBtn.addEventListener('click', (function (person, selectEl) {
              return function () {
                var turmaKey = selectEl.value;
                if (!turmaKey) { adminAlert('Selecione uma turma primeiro.'); return; }
                var turmaLabel = selectEl.options[selectEl.selectedIndex].text;
                adminConfirm(
                  'Mover ' + person.name + ' para a turma ' + turmaLabel + ' como Inscrita?',
                  function () { moverParaTurma(person, turmaKey); }
                );
              };
            })(p, sel));
            tdAcoes.appendChild(moverBtn);
          }

          /* Remover da lista */
          var remBtn = document.createElement('button');
          remBtn.className = 'btn btn--sm';
          remBtn.style.cssText = 'padding:5px 10px;font-size:.75rem';
          remBtn.textContent = 'Remover da lista';
          remBtn.addEventListener('click', (function (person) {
            return function () {
              adminConfirm('Remover ' + person.name + ' da lista de espera?', function () {
                firebase.database().ref('fa-espera/' + person._key).update({ removed: true, removedDate: new Date().toISOString() }, function (err) {
                  if (err) { adminAlert('Erro ao remover. Tente novamente.'); return; }
                  loadEspera();
                });
              });
            };
          })(p));
          tdAcoes.appendChild(remBtn);

          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        wrap.appendChild(table);
        c.appendChild(wrap);
      });
    });
  }

  function migrarParaEspera(turmaKey, eKey, person) {
    var sess = window.faAuth && window.faAuth.getSession();
    var now  = new Date().toISOString();
    var updates = {};
    /* Remove da turma (soft-delete) */
    updates['turmas-interesse/' + turmaKey + '/' + eKey + '/removed']            = true;
    updates['turmas-interesse/' + turmaKey + '/' + eKey + '/removedDate']        = now;
    updates['turmas-interesse/' + turmaKey + '/' + eKey + '/removedReason']      = 'Movida para lista de espera';
    updates['turmas-interesse/' + turmaKey + '/' + eKey + '/movedToEspera']      = true;
    updates['turmas-interesse/' + turmaKey + '/' + eKey + '/removedByAdmin']     = sess ? sess.email : null;
    updates['turmas-interesse/' + turmaKey + '/' + eKey + '/removedByAdminName'] = sess ? (sess.name || sess.email) : null;
    /* Adiciona à lista de espera preservando a data original de interesse */
    updates['fa-espera/' + eKey] = {
      name: person.name, email: person.email, area: person.area || '',
      date: person.date,          /* data original — não a data de migração */
      migratedAt: now,
      migratedFrom: turmaKey,
      removed: false
    };
    firebase.database().ref().update(updates, function (err) {
      if (err) { adminAlert('Erro ao migrar. Tente novamente.'); return; }
      loadInterests();
      loadEspera();
    });
  }

  function moverParaTurma(person, turmaKey) {
    var sess = window.faAuth && window.faAuth.getSession();
    var eKey = emailKeyFromEmail(person.email);
    var now  = new Date().toISOString();
    var updates = {};
    updates['turmas-interesse/' + turmaKey + '/' + eKey] = {
      name: person.name, email: person.email, area: person.area || '',
      date: now, removed: false, status: 'inscrito',
      confirmedByAdmin: sess ? sess.email : null,
      confirmedByAdminName: sess ? (sess.name || sess.email) : null,
      confirmedDate: now,
      fromEspera: true
    };
    updates['fa-espera/' + person._key + '/removed']     = true;
    updates['fa-espera/' + person._key + '/removedDate'] = now;
    updates['fa-espera/' + person._key + '/movedToTurma'] = turmaKey;
    firebase.database().ref().update(updates, function (err) {
      if (err) { adminAlert('Erro ao mover. Tente novamente.'); return; }
      loadEspera();
      loadInterests();
    });
  }

  /* ---- Cadastrados (todos que fizeram cadastro) ---- */
  function loadCadastrados() {
    const c = document.getElementById('adminCadastrados');
    if (!c) return;
    c.innerHTML = '<p class="loading-msg">Carregando…</p>';

    firebase.database().ref('fa-users').once('value').then(function (snap) {
      renderCadastrados(c, snap.val() || {});
    });
  }

  function renderCadastrados(c, data) {
    const list = Object.entries(data)
      .map(function (entry) { return Object.assign({ _key: entry[0] }, entry[1]); })
      .sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'pt'); });
    c.innerHTML = '';

    const hdr = document.createElement('h4');
    hdr.innerHTML = 'Cadastrados <span class="admin-badge" id="cadastradosBadge">' + list.length + '</span>';
    c.appendChild(hdr);

    /* ---- Criar conta pelo admin ---- */
    const criarBox = document.createElement('div');
    criarBox.className = 'admin-criar-conta-box';
    criarBox.innerHTML =
      '<details class="admin-details">' +
      '<summary>+ Criar conta para colaboradora</summary>' +
      '<div class="admin-criar-conta-form">' +
      '<p style="font-size:.8rem;color:var(--text-muted);margin-bottom:12px">A conta é criada com senha padrão <strong>12345678</strong>. A pessoa deve trocar pelo "Esqueci minha senha".</p>' +
      '<div class="admin-field-row">' +
      '<label class="admin-field-label">Nome completo<input type="text" id="criarNome" placeholder="Nome completo" /></label>' +
      '<label class="admin-field-label">E-mail @previ.com.br<input type="email" id="criarEmail" placeholder="nome@previ.com.br" /></label>' +
      '<label class="admin-field-label">Área / Setor<input type="text" id="criarArea" placeholder="Ex: GETHO" /></label>' +
      '<label class="admin-field-label">Sua senha (confirmação)<input type="password" id="criarAdminPwd" placeholder="Sua senha de admin" /></label>' +
      '</div>' +
      '<p class="admin-msg" id="criarMsg" style="margin-top:8px" hidden></p>' +
      '<button type="button" class="btn btn--sm" id="criarContaBtn">Criar conta</button>' +
      '</div>' +
      '</details>';
    c.appendChild(criarBox);

    document.getElementById('criarContaBtn').addEventListener('click', function () {
      const btn  = this;
      const msg  = document.getElementById('criarMsg');
      msg.hidden = true; msg.style.color = '';
      btn.disabled = true; btn.textContent = 'Aguarde…';
      window.faAuth.criarContaPorAdmin(
        {
          name:  document.getElementById('criarNome').value,
          email: document.getElementById('criarEmail').value,
          area:  document.getElementById('criarArea').value
        },
        document.getElementById('criarAdminPwd').value,
        function (r) {
          btn.disabled = false; btn.textContent = 'Criar conta';
          if (r.error) {
            msg.textContent = r.error; msg.style.color = 'var(--danger, #f87171)'; msg.hidden = false;
          } else {
            msg.textContent = 'Conta criada com sucesso! Senha padrão: 12345678'; msg.style.color = 'var(--accent)'; msg.hidden = false;
            document.getElementById('criarNome').value = '';
            document.getElementById('criarEmail').value = '';
            document.getElementById('criarArea').value = '';
            document.getElementById('criarAdminPwd').value = '';
            loadCadastrados();
          }
        }
      );
    });

    /* ---- Filtros de status + busca ---- */
    var statusFiltro = 'ativos';
    const controlsWrap = document.createElement('div');
    controlsWrap.className = 'admin-colab-row';
    controlsWrap.style.cssText = 'margin-bottom:12px;gap:8px;flex-wrap:wrap;align-items:center;';
    controlsWrap.innerHTML =
      '<div class="admin-status-btns">' +
      '<button class="admin-status-btn active" data-status="ativos">Ativos</button>' +
      '<button class="admin-status-btn" data-status="bloqueados">Bloqueados</button>' +
      '<button class="admin-status-btn" data-status="todos">Todos</button>' +
      '</div>' +
      '<input id="cadastradosFiltro" type="text" placeholder="Filtrar por nome ou e-mail…" style="flex:1;min-width:180px" />';
    c.appendChild(controlsWrap);

    const tbl = document.createElement('table');
    tbl.className = 'admin-table';
    tbl.innerHTML = '<thead><tr><th>Nome</th><th>E-mail</th><th>Área</th><th>Cadastro</th><th>Status</th><th>E-mail</th><th></th><th></th><th></th></tr></thead>';
    const tbody = document.createElement('tbody');

    function applyFilters() {
      const q = (document.getElementById('cadastradosFiltro').value || '').trim().toLowerCase();
      var filtered = list.filter(function (p) {
        var bloqueado = !!p.blocked;
        if (statusFiltro === 'ativos'     && bloqueado)  return false;
        if (statusFiltro === 'bloqueados' && !bloqueado) return false;
        if (!q) return true;
        return (p.name || '').toLowerCase().indexOf(q) !== -1 || (p.email || '').toLowerCase().indexOf(q) !== -1;
      });
      tbody.innerHTML = '';
      var badgeEl = document.getElementById('cadastradosBadge');
      if (badgeEl) badgeEl.textContent = filtered.length;
      filtered.forEach(function (p) {
        var bloqueado = !!p.blocked;
        var precisaVerificacao = !!(p.emailVerificationRequired && !p.adminApproved);
        var emailBadge = precisaVerificacao
          ? '<span class="admin-badge" style="background:rgba(245,197,66,.18);color:var(--accent)" title="Cadastro próprio — e-mail ainda não verificado">Pendente</span>'
          : '<span class="admin-badge" style="background:rgba(26,178,174,.18);color:var(--cyan)">Verificado</span>';
        var confirmBtn = precisaVerificacao
          ? '<td><button class="admin-del-btn admin-confirm-email-btn" data-key="' + esc(p._key) + '" data-name="' + esc(p.name || p.email) + '" title="Confirmar cadastro manualmente — libera o acesso sem precisar clicar no link de e-mail">Confirmar</button></td>'
          : '<td></td>';
        var tr = document.createElement('tr');
        if (bloqueado) tr.style.opacity = '0.55';
        tr.innerHTML =
          '<td>' + esc(p.name || '—') + '</td>' +
          '<td>' + esc(p.email || '—') + '</td>' +
          '<td>' + esc(p.area || '—') + '</td>' +
          '<td>' + fmtDate(p.createdAt) + '</td>' +
          '<td><span class="admin-badge" style="background:' + (bloqueado ? 'rgba(255,59,48,.18)' : 'rgba(26,178,174,.18)') + ';color:' + (bloqueado ? 'var(--red)' : 'var(--cyan)') + '">' + (bloqueado ? 'Bloqueado' : 'Ativo') + '</span></td>' +
          '<td>' + emailBadge + '</td>' +
          '<td><button class="admin-del-btn admin-pwd-btn" data-key="' + esc(p._key) + '" data-email="' + esc(p.email || '') + '" data-name="' + esc(p.name || p.email) + '" title="Redefinir senha">Redef. senha</button></td>' +
          '<td><button class="admin-del-btn admin-reset-btn" data-key="' + esc(p._key) + '" data-email="' + esc(p.email || '') + '" data-name="' + esc(p.name || p.email) + '" title="Resetar progresso">Resetar</button></td>' +
          '<td><button class="admin-del-btn admin-block-btn" data-key="' + esc(p._key) + '" data-name="' + esc(p.name || p.email) + '" data-blocked="' + (bloqueado ? '1' : '0') + '">' + (bloqueado ? 'Desbloquear' : 'Bloquear') + '</button></td>' +
          confirmBtn;
        tbody.appendChild(tr);
      });
    }
    applyFilters();
    tbl.appendChild(tbody);
    var tblWrap = document.createElement('div');
    tblWrap.className = 'table-scroll-wrap';
    tblWrap.appendChild(tbl);
    c.appendChild(tblWrap);

    /* Filtro por status */
    controlsWrap.querySelectorAll('.admin-status-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        controlsWrap.querySelectorAll('.admin-status-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        statusFiltro = btn.dataset.status;
        applyFilters();
      });
    });

    /* Busca por texto */
    document.getElementById('cadastradosFiltro').addEventListener('input', applyFilters);

    /* Delegação de eventos */
    tbody.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;

      if (btn.classList.contains('admin-pwd-btn')) {
        handlePwdReset(btn);
        return;
      }

      if (btn.classList.contains('admin-reset-btn')) {
        const eKey  = btn.dataset.key;
        const email = btn.dataset.email;
        const name  = btn.dataset.name;
        adminConfirm('Resetar TODO o progresso do jogo de ' + name + '?\n\nIsso apaga autodiagnóstico e patente. Essa ação não pode ser desfeita.', function () {
          const updates = {};
          updates['fa-progress/' + eKey]     = null;
          updates['fa-reset-signal/' + eKey] = { at: firebase.database.ServerValue.TIMESTAMP };
          firebase.database().ref('players').orderByChild('email').equalTo(email).once('value', function (snap) {
            snap.forEach(function (child) { updates['players/' + child.key] = null; });
            firebase.database().ref().update(updates, function (err) {
              if (err) { adminAlert('Erro ao resetar. Tente novamente.'); return; }
              loadCadastrados();
            });
          });
        });
        return;
      }

      if (btn.classList.contains('admin-block-btn')) {
        const eKey     = btn.dataset.key;
        const name     = btn.dataset.name;
        const blocking = btn.dataset.blocked === '0';
        const msg      = blocking
          ? 'Bloquear ' + name + '?\n\nA pessoa não conseguirá mais acessar o portal.'
          : 'Desbloquear ' + name + '?\n\nA pessoa voltará a conseguir acessar o portal.';
        adminConfirm(msg, function () {
          firebase.database().ref('fa-users/' + eKey + '/blocked').set(blocking ? true : null, function (err) {
            if (err) { adminAlert('Erro ao atualizar. Tente novamente.'); return; }
            loadCadastrados();
          });
        });
        return;
      }

      if (btn.classList.contains('admin-confirm-email-btn')) {
        const eKey = btn.dataset.key;
        const name = btn.dataset.name;
        adminConfirm(
          'Confirmar cadastro de ' + name + ' manualmente?\n\nO acesso ao portal será liberado sem que ela precise clicar no link de e-mail.',
          function () {
            var sess = window.faAuth && window.faAuth.getSession();
            var updates = {};
            updates['fa-users/' + eKey + '/adminApproved']           = true;
            updates['fa-users/' + eKey + '/approvedByAdmin']         = sess ? sess.email : null;
            updates['fa-users/' + eKey + '/approvedByAdminName']     = sess ? (sess.name || sess.email) : null;
            updates['fa-users/' + eKey + '/approvedAt']              = new Date().toISOString();
            firebase.database().ref().update(updates, function (err) {
              if (err) { adminAlert('Erro ao confirmar. Tente novamente.'); return; }
              loadCadastrados();
            });
          }
        );
        return;
      }
    });
  }

  /* ---- Administradores ---- */
  function loadAdmins() {
    const c = document.getElementById('adminAdmins');
    if (!c) return;

    const sess = window.faAuth && window.faAuth.getSession();
    const souSuperAdmin = !!(sess && SUPER_ADMINS.indexOf((sess.email || '').toLowerCase()) !== -1);

    function render() {
      firebase.database().ref('fa-admins').once('value', function (snap) {
        const data = snap.val() || {};
        const dbList = Object.values(data).sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'pt'); });
        c.innerHTML = '';

        /* Aviso sobre super-admins fixos */
        const info = document.createElement('p');
        info.className = 'admin-empty';
        info.style.marginBottom = '20px';
        info.innerHTML = '<b>Super-admins fixos</b> (não removíveis via painel): ' +
          SUPER_ADMINS.map(function (e) { return esc(e); }).join(', ');
        c.appendChild(info);

        const hdr = document.createElement('h4');
        hdr.innerHTML = 'Administradores adicionais <span class="admin-badge">' + dbList.length + '</span>';
        c.appendChild(hdr);

        if (!dbList.length) {
          const empty = document.createElement('p');
          empty.className = 'admin-empty';
          empty.textContent = 'Nenhum administrador adicional cadastrado.';
          c.appendChild(empty);
        } else {
          const tbl = document.createElement('table');
          tbl.className = 'admin-table';
          tbl.innerHTML = '<thead><tr><th>Nome</th><th>E-mail</th><th>Desde</th>' + (souSuperAdmin ? '<th></th>' : '') + '</tr></thead>';
          const tbody = document.createElement('tbody');
          dbList.forEach(function (p) {
            const tr = document.createElement('tr');
            tr.innerHTML =
              '<td>' + esc(p.name || '—') + '</td>' +
              '<td>' + esc(p.email || '—') + '</td>' +
              '<td>' + fmtDate(p.addedAt) + '</td>' +
              (souSuperAdmin ? '<td><button class="admin-del-btn" data-key="' + esc(emailKey(p.email)) + '" data-name="' + esc(p.name || p.email) + '">Remover</button></td>' : '');
            tbody.appendChild(tr);
          });
          tbl.appendChild(tbody);
          const admTblWrap = document.createElement('div');
          admTblWrap.className = 'table-scroll-wrap';
          admTblWrap.appendChild(tbl);
          c.appendChild(admTblWrap);

          if (souSuperAdmin) {
            tbody.addEventListener('click', function (e) {
              const btn = e.target.closest('.admin-del-btn');
              if (!btn) return;
              adminConfirm('Remover ' + btn.dataset.name + ' dos administradores?', function () {
                firebase.database().ref('fa-admins/' + btn.dataset.key).remove(function () { render(); });
              });
            });
          }
        }

        if (!souSuperAdmin) {
          const aviso = document.createElement('p');
          aviso.className = 'admin-empty';
          aviso.style.marginTop = '20px';
          aviso.textContent = 'Só tatianefdirene e danielfrazao podem adicionar ou remover administradores.';
          c.appendChild(aviso);
          return;
        }

        /* Formulário de adição — só para super-admins */
        const form = document.createElement('div');
        form.className = 'admin-colab-form';
        form.innerHTML =
          '<h4 style="margin-top:32px">Adicionar administrador</h4>' +
          '<div class="admin-colab-row">' +
            '<input id="adminName"  type="text"  placeholder="Nome completo" />' +
            '<input id="adminEmail" type="email" placeholder="e-mail" />' +
            '<button class="btn btn--primary" id="adminAddBtn">Adicionar</button>' +
          '</div>' +
          '<p id="adminMsg" style="margin-top:8px;font-size:.8rem;color:var(--cyan)"></p>';
        c.appendChild(form);

        document.getElementById('adminAddBtn').addEventListener('click', function () {
          const name  = (document.getElementById('adminName').value  || '').trim().toUpperCase();
          const email = (document.getElementById('adminEmail').value || '').trim().toLowerCase();
          const msg   = document.getElementById('adminMsg');
          if (!name || !email) { msg.style.color = 'var(--accent)'; msg.textContent = 'Preencha nome e e-mail.'; return; }
          if (!/^[^\s@]+@previ\.com\.br$/i.test(email)) { msg.style.color = 'var(--accent)'; msg.textContent = 'Use um e-mail @previ.com.br.'; return; }
          firebase.database().ref('fa-admins/' + emailKey(email)).set(
            { email: email, name: name, addedAt: new Date().toISOString() },
            function (err) {
              if (err) { msg.style.color = 'var(--accent)'; msg.textContent = 'Erro ao salvar.'; return; }
              document.getElementById('adminName').value  = '';
              document.getElementById('adminEmail').value = '';
              msg.style.color = 'var(--cyan)'; msg.textContent = name + ' adicionado(a) como administrador(a).';
              render();
            }
          );
        });
      }, function (err) {
        console.error('[admin] erro ao carregar fa-admins', err);
        c.innerHTML = '<p class="loading-msg" style="color:var(--red)">Erro ao carregar administradores. Recarregue a página ou verifique sua conexão.</p>';
      });
    }

    render();
  }

  /* ---- Helpers ---- */
  function esc(s) {
    return String(s || '').replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmtDate(d) {
    if (!d) return '—';
    try {
      var dt = new Date(d);
      return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch(e) { return '—'; }
  }

  /* ── Certificados ────────────────────────────────────────────────────── */

  function initCertificados() {
    if (!window.faCertif) return;

    var certif     = window.faCertif;
    var selEv      = document.getElementById('certEventoSelect');
    var sel        = document.getElementById('certTurmaSelect');
    var infoEl     = document.getElementById('certInfoDisplay');
    var wrap       = document.getElementById('certParticipantesWrap');
    var listEl     = document.getElementById('certParticipantesList');
    var hint       = document.getElementById('certPreviewHint');
    var dlTodos    = document.getElementById('certBaixarTodos');
    var dlTodosPDF = document.getElementById('certBaixarTodosPDF');

    if (!sel) return;

    /* estado carregado do Firebase para a turma selecionada */
    var _evento          = null;  /* { key, nome, cargaHoraria, percentualMinimo } */
    var _dataConclusao   = null;  /* 'YYYY-MM-DD' ou null */
    var _encerrada       = false; /* turma concluída → emissão habilitada */
    var _checkinTurma    = {};    /* { [dia]: { [emailKey]: true } } */
    var _diasTurma       = [];    /* array de ISO dates da turma */

    var MESES = ['janeiro','fevereiro','março','abril','maio','junho',
                 'julho','agosto','setembro','outubro','novembro','dezembro'];

    function fmtData(iso) {
      if (!iso) return '';
      var d = new Date(iso + 'T12:00:00');
      return isNaN(d) ? iso : d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear();
    }

    var TOOLTIP_BLOQUEADO = 'Disponível após a conclusão da turma.';

    function updatePreviaBanner(turmaKey) {
      var banner = document.getElementById('certPreviaBanner');
      if (!banner) return;
      if (!turmaKey) { banner.style.display = 'none'; return; }
      if (_encerrada) { banner.style.display = 'none'; return; }
      banner.style.cssText = 'background:rgba(255,165,0,.1);border:1px solid rgba(255,165,0,.45);border-radius:6px;padding:12px 16px;margin-bottom:14px;text-align:center;display:block';
      banner.innerHTML =
        '<div style="font-family:var(--font-head);letter-spacing:.08em;font-size:.8rem;color:#ffb347;margin-bottom:6px">PRÉVIA DO CERTIFICADO — TURMA AINDA NÃO CONCLUÍDA</div>' +
        '<div style="font-size:.78rem;color:var(--ink-2)">Visualização administrativa para conferência. O certificado só poderá ser emitido após a conclusão da turma.</div>';
    }

    function updateLoteButtons() {
      if (dlTodos)    { dlTodos.disabled    = !_encerrada; dlTodos.title    = _encerrada ? '' : TOOLTIP_BLOQUEADO; }
      if (dlTodosPDF) { dlTodosPDF.disabled = !_encerrada; dlTodosPDF.title = _encerrada ? '' : TOOLTIP_BLOQUEADO; }
    }

    function updateInfoDisplay(turmaKey) {
      if (!infoEl) return;
      if (!turmaKey) { infoEl.style.display = 'none'; return; }
      var parts = [];
      if (_evento && _evento.nome) {
        parts.push('<strong>' + esc(_evento.nome) + '</strong>');
        parts.push(_evento.cargaHoraria + 'h');
      } else {
        parts.push('<span style="color:var(--amber,#ffb347)">⚠ Turma sem evento vinculado — vincule um evento na aba Turmas</span>');
      }
      if (_dataConclusao) {
        parts.push('Concluída em ' + fmtData(_dataConclusao));
      } else {
        parts.push('<span style="color:var(--amber,#ffb347)">⚠ Turma ainda não encerrada — data de emissão não definida</span>');
      }
      infoEl.style.cssText = 'padding:10px 14px;background:var(--panel-2);border-radius:6px;font-size:.88rem;color:var(--ink-2);margin-bottom:16px;display:flex;flex-wrap:wrap;gap:8px;align-items:center';
      infoEl.innerHTML = parts.join('<span style="opacity:.4">·</span>');
    }

    /* popular seletor de eventos */
    function populateEventoSelect() {
      if (!selEv) return;
      selEv.innerHTML = '<option value="">— selecionar evento —</option>';
      EVENTOS_LIST.forEach(function (ev) {
        var opt = document.createElement('option');
        opt.value = ev.key;
        opt.textContent = ev.nome || ev.key;
        selEv.appendChild(opt);
      });
    }

    /* popular seletor de turmas filtrado pelo evento */
    function populateTurmaSelect(eventoKey) {
      sel.innerHTML = '';
      var turmasFiltradas = eventoKey
        ? TURMAS_LIST.filter(function (t) { return t.eventoKey === eventoKey; })
        : [];
      if (!turmasFiltradas.length) {
        var ph = document.createElement('option');
        ph.value = '';
        ph.textContent = eventoKey ? '— nenhuma turma neste evento —' : '— selecione um evento primeiro —';
        sel.appendChild(ph);
        sel.disabled = true;
        return;
      }
      var ph = document.createElement('option');
      ph.value = '';
      ph.textContent = '— selecionar turma —';
      sel.appendChild(ph);
      turmasFiltradas.forEach(function (t) {
        var opt = document.createElement('option');
        opt.value = t.key;
        opt.textContent = t.label + (t.dates ? '  (' + t.dates + ')' : '');
        sel.appendChild(opt);
      });
      sel.disabled = false;
    }

    function initSelects() {
      populateEventoSelect();
      populateTurmaSelect('');
    }

    if (EVENTOS_LIST.length && TURMAS_LIST.length) {
      initSelects();
    } else if (TURMAS_LIST.length) {
      loadEventosList(initSelects);
    } else {
      loadTurmasList(function () {
        loadEventosList(initSelects);
      });
    }

    if (selEv) {
      selEv.addEventListener('change', function () {
        /* resetar estado da turma ao trocar evento */
        _evento        = null;
        _dataConclusao = null;
        _encerrada     = false;
        _checkinTurma  = {};
        _diasTurma     = [];
        sel.value      = '';
        if (infoEl) infoEl.style.display = 'none';
        updatePreviaBanner('');
        updateLoteButtons();
        if (wrap) wrap.style.display = 'none';
        if (hint) hint.style.display = '';
        populateTurmaSelect(selEv.value);
      });
    }

    function buildData(participant, turma) {
      return {
        nomeParticipante:   participant.name || '',
        nomeEvento:         _evento ? (_evento.nome || '') : '',
        identificacaoTurma: turma.label,
        periodoTurma:       turma.dates || '',
        cargaHoraria:       _evento ? (_evento.cargaHoraria || '20') : '20',
        dataEmissao:        fmtData(_dataConclusao)
      };
    }

    function renderPreview(participant, turma) {
      var data = buildData(participant, turma);
      certif.preview('certPreviewCanvas', data);
      if (hint) hint.style.display = 'none';
    }

    function renderLista(turma, inscritos) {
      if (!wrap || !listEl) return;
      wrap.style.display = '';
      var title = document.getElementById('certListTitle');
      if (title) title.textContent = 'Participantes inscritos — ' + turma.label + ' (' + inscritos.length + ')';

      /* garantir que hint esteja visível até alguém ser selecionado */
      if (hint) {
        hint.textContent = 'Selecione um participante para visualizar a prévia do certificado.';
        hint.style.display = '';
      }

      listEl.innerHTML = '';
      if (!inscritos.length) {
        listEl.innerHTML = '<p class="cert-empty">Nenhum participante inscrito nesta turma.</p>';
        return;
      }

      var minPct = _evento ? (_evento.percentualMinimo || 75) : 75;

      inscritos.forEach(function (p) {
        var freq      = calcFreq(p.email);              /* null se sem dias cadastrados */
        var atingiu   = freq === null || !_encerrada || freq >= minPct;
        var tooltipBloq = !_encerrada
          ? TOOLTIP_BLOQUEADO
          : 'Frequência insuficiente (' + freq + '% < ' + minPct + '% exigido).';

        var row = document.createElement('div');
        row.className = 'cert-participant-row';

        var nameSpan = document.createElement('span');
        nameSpan.className = 'cert-p-name';
        nameSpan.textContent = p.name || p.email;

        /* badge de frequência (só quando encerrada e há dias cadastrados) */
        if (_encerrada && freq !== null) {
          var freqBadge = document.createElement('span');
          freqBadge.style.cssText = 'font-size:.72rem;font-family:var(--font-mono);padding:2px 7px;border-radius:4px;white-space:nowrap;' +
            (atingiu
              ? 'background:rgba(80,200,100,.15);color:#6dbd7a;border:1px solid rgba(80,200,100,.3)'
              : 'background:rgba(255,80,80,.13);color:#e05c5c;border:1px solid rgba(255,80,80,.28)');
          freqBadge.textContent = freq + '%';
          freqBadge.title = (atingiu ? 'Frequência suficiente' : 'Frequência abaixo do mínimo') + ' (' + minPct + '% exigido)';
          row.appendChild(nameSpan);
          row.appendChild(freqBadge);
        } else {
          row.appendChild(nameSpan);
        }

        var btnPrev = document.createElement('button');
        btnPrev.className = 'btn btn--sm cert-btn-prev';
        btnPrev.textContent = '👁 Prévia';
        btnPrev.addEventListener('click', function () {
          document.querySelectorAll('.cert-participant-row').forEach(function (r) { r.classList.remove('cert-active'); });
          row.classList.add('cert-active');
          renderPreview(p, turma);
        });

        var btnDl = document.createElement('button');
        btnDl.className = 'btn btn--sm cert-btn-dl';
        btnDl.textContent = '⬇ PNG';
        if (_encerrada && atingiu) {
          btnDl.addEventListener('click', function () {
            certif.download(buildData(p, turma), 'certificado_' + (p.name || p.email).replace(/\s+/g, '_').toLowerCase());
          });
        } else {
          btnDl.disabled = true;
          btnDl.title = tooltipBloq;
        }

        var btnPdf = document.createElement('button');
        btnPdf.className = 'btn btn--sm cert-btn-dl';
        btnPdf.textContent = '⬇ PDF';
        if (_encerrada && atingiu) {
          btnPdf.addEventListener('click', function () {
            certif.downloadPDF(buildData(p, turma), 'certificado_' + (p.name || p.email).replace(/\s+/g, '_').toLowerCase());
          });
        } else {
          btnPdf.disabled = true;
          btnPdf.title = tooltipBloq;
        }

        row.appendChild(btnPrev);
        row.appendChild(btnDl);
        row.appendChild(btnPdf);
        listEl.appendChild(row);
      });
      /* sem auto-seleção — usuário escolhe o participante */
    }

    /* calcula frequência de um participante (0–100) */
    function calcFreq(email) {
      if (!_diasTurma.length) return null;
      var eKey = email.replace(/\./g, ',');
      var presentes = _diasTurma.filter(function (d) {
        return _checkinTurma[d] && _checkinTurma[d][eKey];
      }).length;
      return Math.round((presentes / _diasTurma.length) * 100);
    }

    function loadInscritos(turmaKey, cb) {
      firebase.database().ref('turmas-interesse/' + turmaKey).once('value', function (snap) {
        var val = snap.val() || {};
        var inscritos = Object.values(val).filter(function (r) {
          return r && !r.removed && r.status === 'inscrito';
        }).sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'pt-BR'); });
        cb(inscritos);
      });
    }

    function loadEventoParaTurma(turma, cb) {
      _evento = null;
      if (!turma.eventoKey) { cb(); return; }
      var ev = EVENTOS_LIST.filter(function (e) { return e.key === turma.eventoKey; })[0];
      if (ev) { _evento = ev; cb(); return; }
      firebase.database().ref('eventos/' + turma.eventoKey).once('value', function (snap) {
        var v = snap.val();
        _evento = v ? { key: turma.eventoKey, nome: v.nome || '', cargaHoraria: v.cargaHoraria || '20' } : null;
        cb();
      });
    }

    sel.addEventListener('change', function () {
      var key = sel.value;
      _evento        = null;
      _dataConclusao = null;
      _encerrada     = false;
      _checkinTurma  = {};
      _diasTurma     = [];
      updateInfoDisplay(key);
      updatePreviaBanner(key);
      updateLoteButtons();

      if (!key) {
        if (wrap) wrap.style.display = 'none';
        if (hint) hint.style.display = '';
        return;
      }

      var turma = TURMAS_LIST.filter(function (t) { return t.key === key; })[0];
      if (!turma) return;

      _diasTurma = turma.dias || [];

      var pending = 3;
      function done() {
        pending--;
        if (pending > 0) return;
        updateInfoDisplay(key);
        updatePreviaBanner(key);
        updateLoteButtons();
        loadInscritos(key, function (inscritos) { renderLista(turma, inscritos); });
      }

      loadEventoParaTurma(turma, done);
      firebase.database().ref('turmas-config/' + key).once('value', function (snap) {
        var cfg = snap.val() || {};
        _dataConclusao = cfg.dataConclusao || null;
        _encerrada     = !!cfg.encerrada;
        done();
      });
      firebase.database().ref('turmas-checkin/' + key).once('value', function (snap) {
        _checkinTurma = snap.val() || {};
        done();
      });
    });

    /* baixar todos — apenas participantes que atingiram o percentual mínimo */
    function baixarTodos(usePDF) {
      if (!_encerrada) return;
      var key = sel.value;
      if (!key) { alert('Selecione uma turma primeiro.'); return; }
      var turma = TURMAS_LIST.filter(function (t) { return t.key === key; })[0];
      if (!turma) return;
      var minPct = _evento ? (_evento.percentualMinimo || 75) : 75;
      loadInscritos(key, function (inscritos) {
        var elegiveis = inscritos.filter(function (p) {
          var freq = calcFreq(p.email);
          return freq === null || freq >= minPct;
        });
        if (!elegiveis.length) { adminAlert('Nenhum participante atingiu o percentual mínimo de ' + minPct + '% de presença.'); return; }
        var i = 0;
        function next() {
          if (i >= elegiveis.length) return;
          var p = elegiveis[i++];
          var slug = (p.name || p.email).replace(/\s+/g, '_').toLowerCase();
          if (usePDF) certif.downloadPDF(buildData(p, turma), 'certificado_' + slug);
          else certif.download(buildData(p, turma), 'certificado_' + slug);
          setTimeout(next, 800);
        }
        next();
      });
    }

    if (dlTodos)    dlTodos.addEventListener('click',    function () { baixarTodos(false); });
    if (dlTodosPDF) dlTodosPDF.addEventListener('click', function () { baixarTodos(true); });
  }

})();
