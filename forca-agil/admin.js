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

  function initAdmin() {
    var sess = window.faAuth && window.faAuth.getSession();
    if (!sess || !window.faAuth.isAdmin(sess.email)) return;
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
        return { key: key, label: t.label || key.toUpperCase(), dates: fmt.dates, dias: dias, order: t.order || 0, cmflexLink: t.cmflexLink || '', eventoKey: t.eventoKey || '' };
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
          try {
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
          globalBtnWrap.appendChild(newEventoBtn);
          globalBtnWrap.appendChild(exportBtn);
          globalBtnWrap.appendChild(exportLogBtn);
          c.appendChild(globalBtnWrap);

          /* ── Barra de filtro e expand/collapse ───────────────────────────── */
          var filterBar = document.createElement('div');
          filterBar.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:18px';
          var filterLabel = document.createElement('span');
          filterLabel.style.cssText = 'color:var(--ink-2);font-size:.82rem';
          filterLabel.textContent = 'Ver evento:';
          var filterSel = document.createElement('select');
          filterSel.style.cssText = 'background:var(--panel-2);border:1px solid var(--line-strong);border-radius:4px;color:var(--ink);padding:4px 8px;font-size:.82rem;cursor:pointer';
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
          expandAllBtn.style.cssText = 'padding:4px 10px;font-size:.72rem;margin-left:auto';
          expandAllBtn.textContent = '↕ Expandir tudo';
          var collapseAllBtn = document.createElement('button');
          collapseAllBtn.className = 'btn btn--sm';
          collapseAllBtn.style.cssText = 'padding:4px 10px;font-size:.72rem';
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
              var certBtn = document.createElement('button');
              certBtn.className = 'btn btn--sm';
              certBtn.style.cssText = 'padding:6px 10px;font-size:.72rem';
              certBtn.innerHTML = '&#x1F4DC; Cert.';
              certBtn.addEventListener('click', (function (tt, ins, ck) {
                return function () { gerarCertificados(tt, ins, ck); };
              })(t, inscritos, checkinT));
              var modeloBtn = document.createElement('button');
              modeloBtn.className = 'btn btn--sm';
              modeloBtn.style.cssText = 'padding:6px 10px;font-size:.72rem';
              modeloBtn.innerHTML = '&#x1F441; Modelo';
              modeloBtn.addEventListener('click', (function (tt) { return function () { previewCertificado(tt); }; })(t));
              moreMenu.appendChild(qrBtn);
              moreMenu.appendChild(reopenBtn);
              moreMenu.appendChild(certBtn);
              moreMenu.appendChild(modeloBtn);
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
              moreMenu.classList.toggle('open');
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
            evSection.style.cssText = 'border:1px solid var(--line-strong);border-radius:8px;margin-bottom:24px;overflow:hidden';
            evSection.setAttribute('data-ev-key', ev.key);

            /* cabeçalho do evento — clicável para expandir/recolher */
            var evHdr = document.createElement('div');
            evHdr.style.cssText = 'display:flex;align-items:center;gap:12px;padding:14px 18px;background:var(--panel-2);border-bottom:1px solid var(--line-strong);cursor:pointer;user-select:none';
            var evToggleIcon = document.createElement('span');
            evToggleIcon.className = 'ev-toggle-icon';
            evToggleIcon.style.cssText = 'color:var(--ink-2);font-size:.85rem;flex-shrink:0;transition:transform .15s';
            evToggleIcon.textContent = '▸';
            var evNome = document.createElement('span');
            evNome.style.cssText = 'flex:1;font-family:var(--font-head);letter-spacing:.06em;font-size:.9rem;color:var(--ink)';
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
            semEventoSection.style.cssText = 'border:1px solid rgba(255,165,0,.3);border-radius:8px;margin-bottom:24px;overflow:hidden';
            var semEventoHdr = document.createElement('div');
            semEventoHdr.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px 18px;background:var(--panel-2);border-bottom:1px solid rgba(255,165,0,.3)';
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
          } catch (err) {
            c.innerHTML = '<p style="color:#ff8080;padding:16px;font-family:monospace;font-size:.8rem">ERRO DE RENDERIZAÇÃO: ' + err.message + '<br>' + err.stack + '</p>';
          }
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

  /* ---- Certificados ---- */
  function previewCertificado(t) {
    var fakeInscritos = [{ name: 'Maria da Silva Santos', email: 'exemplo@previ.com.br' }];
    var fakeCheckin = {};
    t.dias.forEach(function (d) { fakeCheckin[d] = { 'exemplo_previ_com_br': true }; });
    gerarCertificados(t, fakeInscritos, fakeCheckin);
  }

  function gerarCertificados(t, inscritos, checkinT) {
    var minDias = Math.ceil(t.dias.length * CRITERIO_PRESENCA);
    var aprovados = inscritos.filter(function (r) {
      var eKey = emailKeyFromEmail(r.email);
      var diasPresente = t.dias.filter(function (d) { return checkinT[d] && checkinT[d][eKey]; }).length;
      return diasPresente >= minDias;
    });

    if (!aprovados.length) {
      adminAlert('Nenhum participante atingiu ' + Math.round(CRITERIO_PRESENCA * 100) + '% de presença nesta turma.');
      return;
    }

    var dataEmissao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    var diaInicio = new Date(t.dias[0] + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit' });
    var diaFim = new Date(t.dias[t.dias.length - 1] + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    var periodo = diaInicio + ' a ' + diaFim;

    var PREVI_B64 = 'data:image/png;base64,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';

    var CORNER = '<svg viewBox="0 0 70 70" xmlns="http://www.w3.org/2000/svg"><path d="M5 5 L30 5 M5 5 L5 30" stroke="#c9a84c" stroke-width="2" fill="none"/><path d="M5 5 C5 5 18 5 22 8 C26 11 26 20 26 20" stroke="#c9a84c" stroke-width="1" fill="none" opacity=".6"/><path d="M5 5 C5 5 5 18 8 22 C11 26 20 26 20 26" stroke="#c9a84c" stroke-width="1" fill="none" opacity=".6"/><circle cx="5" cy="5" r="2.5" fill="#c9a84c" opacity=".9"/><circle cx="30" cy="5" r="1.5" fill="#c9a84c" opacity=".5"/><circle cx="5" cy="30" r="1.5" fill="#c9a84c" opacity=".5"/></svg>';
    var SVG_LOGO = '<svg width="26" height="26" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="#c9a84c" stroke-width="1.6"/><path d="M16 7 L22 22 L16 18 L10 22 Z" fill="#c9a84c"/></svg>';
    var SVG_JEDI = '<svg width="32" height="32" viewBox="0 0 100 100" opacity=".9"><ellipse cx="50" cy="50" rx="8" ry="8" fill="#c9a84c"/><path d="M50 42 L50 10" stroke="#c9a84c" stroke-width="3" stroke-linecap="round"/><path d="M50 58 L50 90" stroke="#c9a84c" stroke-width="2" stroke-linecap="round" opacity=".6"/><path d="M50 28 C50 28 30 35 18 30 C10 26 8 18 8 18 C8 18 22 22 28 32 C32 38 50 42 50 42" fill="#c9a84c" opacity=".9"/><path d="M50 28 C50 28 70 35 82 30 C90 26 92 18 92 18 C92 18 78 22 72 32 C68 38 50 42 50 42" fill="#c9a84c" opacity=".9"/><path d="M50 52 C50 52 35 58 26 55 C20 52 18 45 18 45 C18 45 28 50 34 58 C38 63 50 58 50 58" fill="#c9a84c" opacity=".5"/><path d="M50 52 C50 52 65 58 74 55 C80 52 82 45 82 45 C82 45 72 50 66 58 C62 63 50 58 50 58" fill="#c9a84c" opacity=".5"/></svg>';
    var cards = aprovados.map(function (r) {
      var eKey = emailKeyFromEmail(r.email);
      var diasPresente = t.dias.filter(function (d) { return checkinT[d] && checkinT[d][eKey]; }).length;
      var horas = diasPresente * 4;
      return JSON.stringify({ name: r.name, horas: horas });
    });


    var BG_B64 = 'data:image/jpeg;base64,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vPMef8888whDDmU89PiDDDDD0888888804gAMYCroxgC2d/y70fYewg5ouSi0jag0pSOTYMutAtnMlm6skQPw88888888888888884wRFDDmU99a+DDDDDR88888sIIEAwrvKI4N31huUt2OYKeWISZ+idVMrUQvZOaS6m5WpyhlBxDKMHZ34088888888888848BDDDADU89oM/PDDDY088880sUUjkcg0nFUFRlQJdJybcw0k8+TZNJCcCj9V/KwYSi/XmuuWLebT8Bt2+U0888888888wBRDDDH8EU89I2wDDFJJ8880wE0rWtdqFNZrD6fvPj/vN7zzzjdBNNxtyuTscs7z/AAz5864/w2X+20Z5Hhg3uS+u/wD/AP7/AM67ywwzek0FPfZZURww88cfOJDO3ShNlrOMBW14zzwxzzy7ANlzwMVWsZs0k0wUSp5t1/PQHv8At/vBzP1AsFlSzEHDnWHVv1j2HRzddYhT31w+0VH1+fXU12hd1QaK7nF1mtXXZL7LDTgtHBJJFI/HYiX2DBG4k18kT1qOxLCI4II/ldu31E4J7Ar/AF/nPLEP1SqHBQc899hBBQxhzDVPTZtayQgQzzDTADjDBxBBBwCAASyy+KKGqSyyCCCiOwwAAAM1McpxNvbjyAQgyqCEWA89ZTzxhDTjTvMc99/9999999rDf/zjjDDDHDDX/wD/AP8A/wD/AN//APP/ADz+8/z/AP8Avf8A/wD/AP8A/wD333//AP8AffX/AH333333/wD99999/vLDDD3D/wDffffffPfffP/EAAL/2gAMAwEAAgADAAAAEB//AP8AP/v/APff/fSzffZfffff/edffffffbfecfdfYwz/AP2kAMN33333P31X333301X33333333333330/8A/wD/AM9//OMf8te05/8AR7u9Od7y5SSnCPyU62+SIeGe+9mah906+2+L214cvP51w8Tjw12w9jYOz+0w4UEEMJyV8m9Lb778UtRkQxLJjsBA985z3Qhzu2seBPNNFNZhRxBBNRHOu+m+OYsO+C+O29dqMi84I8Y2Cuc19V9tMuZuOOO88ueOOu+ONx18cKC+y++CwkJea9mEPC/tCZ2hQFVNR999hBDGCiOe+C8ue+8488+888Bt988NRBRFdxB8+68+y8++8+e++86y2+88lM8+0w84RhHH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';
    var certData = aprovados.map(function (r) {
      var eKey = emailKeyFromEmail(r.email);
      var diasPresente = t.dias.filter(function (d) { return checkinT[d] && checkinT[d][eKey]; }).length;
      return { name: r.name, horas: diasPresente * 4 };
    });

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
      '<style>*{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}' +
      'body{background:#000;}' +
      'canvas{display:block;width:297mm;height:210mm;page-break-after:always;}' +
      '@page{size:A4 landscape;margin:0;}' +
      '@media print{canvas{width:100%;height:100vh;}}</style>' +
      '</head><body>' +
      '<script>' +
      'var BG = new Image();' +
      'var certData = ' + JSON.stringify(certData) + ';' +
      'var turma = ' + JSON.stringify(t.label) + ';' +
      'var periodo = ' + JSON.stringify(periodo) + ';' +
      'var dataEmissao = ' + JSON.stringify(dataEmissao) + ';' +
      'BG.onload = function() {' +
      '  certData.forEach(function(p, idx) {' +
      '    var cv = document.createElement("canvas");' +
      '    cv.width = 2480; cv.height = 1754;' +
      '    cv.style.cssText = "display:block;width:297mm;height:210mm;page-break-after:always;";' +
      '    document.body.appendChild(cv);' +
      '    var c = cv.getContext("2d");' +
      '    var W = cv.width; var H = cv.height;' +
      '    c.drawImage(BG, 0, 0, W, H);' +
      '    c.fillStyle = "rgb(0,0,8)";' +
      '    c.fillRect(W*0.025, H*0.24, W*0.95, H*0.72);' +
      '    c.textAlign = "center";' +
      '    c.fillStyle = "#ffffff";' +
      '    c.font = "bold " + Math.round(H*0.056) + "px Times New Roman, Georgia, serif";' +
      '    c.fillText(p.name, W/2, H*0.415);' +
      '    c.fillStyle = "rgba(255,255,255,0.7)";' +
      '    c.font = "italic " + Math.round(H*0.022) + "px Georgia, serif";' +
      '    c.fillText("concluiu sua jornada na", W/2, H*0.525);' +
      '    c.fillStyle = "#c9a84c";' +
      '    c.font = Math.round(H*0.018) + "px Arial, sans-serif";' +
      '    c.letterSpacing = "0.1em";' +
      '    c.fillText("\\u25C6  OFICINA DE AGILIDADE ORGANIZACIONAL  \\u25C6", W/2, H*0.575);' +
      '    c.font = "italic bold " + Math.round(H*0.026) + "px Georgia, serif";' +
      '    c.fillText(turma, W/2, H*0.625);' +
      '    c.fillStyle = "rgba(255,255,255,0.85)";' +
      '    c.font = Math.round(H*0.019) + "px Arial, sans-serif";' +
      '    c.fillText(periodo, W/2, H*0.676);' +
      '    c.fillStyle = "#c9a84c";' +
      '    c.font = "bold " + Math.round(H*0.038) + "px Arial Black, Arial, sans-serif";' +
      '    c.fillText(p.horas + "h", W/2, H*0.735);' +
      '    c.font = Math.round(H*0.016) + "px Arial, sans-serif";' +
      '    c.fillText("DE IMMERS\\u00C3O EM AGILIDADE", W/2, H*0.765);' +
      '    c.fillStyle = "rgba(255,255,255,0.45)";' +
      '    c.font = Math.round(H*0.013) + "px Arial, sans-serif";' +
      '    c.textAlign = "right";' +
      '    c.fillText("Emitido em " + dataEmissao, W*0.945, H*0.915);' +
      '  });' +
      '  window.print();' +
      '};' +
      'BG.src = "' + BG_B64 + '";' +
      '<\/script></body></html>';

    var win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
    else { adminAlert('Permita pop-ups para gerar os certificados.'); }
  }

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
    hdr.innerHTML = 'Cadastrados <span class="admin-badge">' + list.length + '</span>';
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
      filtered.forEach(function (p) {
        var bloqueado = !!p.blocked;
        var precisaVerificacao = !!(p.emailVerificationRequired && !p.adminApproved);
        var emailBadge = precisaVerificacao
          ? '<span class="admin-badge" style="background:#78350f;color:#fde68a" title="Cadastro próprio — e-mail ainda não verificado">Pendente</span>'
          : '<span class="admin-badge" style="background:#14532d">Verificado</span>';
        var confirmBtn = precisaVerificacao
          ? '<td><button class="admin-del-btn admin-confirm-email-btn" data-key="' + esc(p._key) + '" data-name="' + esc(p.name || p.email) + '" title="Confirmar cadastro manualmente — libera o acesso sem precisar clicar no link de e-mail">Confirmar cadastro</button></td>'
          : '<td></td>';
        var tr = document.createElement('tr');
        if (bloqueado) tr.style.opacity = '0.55';
        tr.innerHTML =
          '<td>' + esc(p.name || '—') + '</td>' +
          '<td>' + esc(p.email || '—') + '</td>' +
          '<td>' + esc(p.area || '—') + '</td>' +
          '<td>' + fmtDate(p.createdAt) + '</td>' +
          '<td><span class="admin-badge" style="background:' + (bloqueado ? '#7f1d1d' : '#14532d') + '">' + (bloqueado ? 'Bloqueado' : 'Ativo') + '</span></td>' +
          '<td>' + emailBadge + '</td>' +
          '<td><button class="admin-del-btn admin-pwd-btn" data-key="' + esc(p._key) + '" data-email="' + esc(p.email || '') + '" data-name="' + esc(p.name || p.email) + '">Redefinir senha</button></td>' +
          '<td><button class="admin-del-btn admin-reset-btn" data-key="' + esc(p._key) + '" data-email="' + esc(p.email || '') + '" data-name="' + esc(p.name || p.email) + '">Resetar progresso</button></td>' +
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
