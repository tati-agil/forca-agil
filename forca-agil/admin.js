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
    loadCadastrados();
    loadAdmins();
    if (window.faInitManual) window.faInitManual();
    if (window.faInitMapa) window.faInitMapa();
    if (window.faInitTestes) window.faInitTestes();
  }

  function migrateNameCase() {
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
  }

  /* Critério de presença mínima (0.75 = 75% dos dias) */
  var CRITERIO_PRESENCA = 0.75;

  const TURMAS_LIST = [
    { key: 't1', label: 'Turma 1 — Agosto',   dates: '11, 12, 18, 19 e 20',
      dias: ['2026-08-11','2026-08-12','2026-08-18','2026-08-19','2026-08-20'] },
    { key: 't2', label: 'Turma 2 — Setembro', dates: '9, 10, 11, 15 e 16',
      dias: ['2026-09-09','2026-09-10','2026-09-11','2026-09-15','2026-09-16'] },
    { key: 't3', label: 'Turma 3 — Novembro', dates: '17, 18, 19, 24 e 25',
      dias: ['2026-11-17','2026-11-18','2026-11-19','2026-11-24','2026-11-25'] }
  ];

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

    var db = firebase.database();
    db.ref('turmas-interesse').once('value', function (snapI) {
      db.ref('turmas-config').once('value', function (snapC) {
        db.ref('turmas-checkin').once('value', function (snapCk) {
          var data    = snapI.val()  || {};
          var config  = snapC.val()  || {};
          var checkin = snapCk.val() || {};
          c.innerHTML = '';

          /* global export buttons */
          var btnWrap = document.createElement('div');
          btnWrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px;';
          var exportBtn = document.createElement('button');
          exportBtn.className = 'btn btn--sm';
          exportBtn.innerHTML = '&#x2193; Estado atual';
          exportBtn.addEventListener('click', function () { exportAllInterests(data, config, checkin); });
          var csvBtn = document.createElement('button');
          csvBtn.className = 'btn btn--sm';
          csvBtn.innerHTML = '&#x2193; Histórico';
          csvBtn.addEventListener('click', function () { exportInterestLog(); });
          btnWrap.appendChild(exportBtn);
          btnWrap.appendChild(csvBtn);
          c.appendChild(btnWrap);

          TURMAS_LIST.forEach(function (t) {
            var cfg       = config[t.key] || {};
            var finalizada = !!cfg.finalizada;
            var diaAtivo  = cfg.diaAtivo || null;
            var all       = data[t.key] ? Object.values(data[t.key]) : [];
            var allByKey  = data[t.key] || {};
            var active    = all.filter(function (r) { return !r.removed; });
            var removed   = all.filter(function (r) { return r.removed; });
            var checkinT  = checkin[t.key] || {};

            var inscritos = active.filter(function (r) { return r.status === 'inscrito'; });
            var countLabel = finalizada
              ? inscritos.length + ' inscrito' + (inscritos.length !== 1 ? 's' : '')
              : active.length + ' interessado' + (active.length !== 1 ? 's' : '');

            var card = document.createElement('div');
            card.className = 'turma-admin-card';
            card.id = 'turma-card-' + t.key;
            card.style.background = '#1a2035';

            /* header */
            var hdr = document.createElement('div');
            hdr.className = 'turma-admin-header';
            hdr.style.background = '#1a2035';

            var checkinBadge = '';
            if (finalizada && diaAtivo) {
              checkinBadge = '<span class="turma-status-badge badge-checkin-aberto">CHECK-IN ABERTO · ' + fmtDia(diaAtivo) + '</span>';
            }

            hdr.innerHTML =
              '<div class="turma-admin-title">' +
                '<span class="turma-admin-name">' + esc(t.label) + '</span>' +
                '<span class="turma-admin-dates">(' + t.dates + ')</span>' +
                '<span class="turma-status-badge ' + (finalizada ? 'badge-finalizada' : 'badge-aberta') + '">' +
                  (finalizada ? 'FINALIZADA' : 'ABERTA') + '</span>' +
                '<span class="admin-badge">' + countLabel + '</span>' +
                checkinBadge +
              '</div>' +
              '<div class="turma-admin-actions" id="turma-actions-' + t.key + '"></div>';
            card.appendChild(hdr);

            /* action buttons — primary (sempre visível) + secondary (desktop inline, mobile em "...") */
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
              finBtn.textContent = 'Finalizar inscrição';
              finBtn.addEventListener('click', (function (tk, td) {
                return function () { finalizeTurma(tk, td); };
              })(t.key, allByKey));
              primaryWrap.appendChild(finBtn);
            } else {
              /* check-in abrir/fechar — sempre visível */
              if (!diaAtivo) {
                var sel = document.createElement('select');
                sel.className = 'checkin-dia-select';
                /* pré-selecionar o primeiro dia sem check-in; fallback: hoje ou primeiro */
                var firstUnused = t.dias.find(function (d) { return !checkinT[d] || Object.keys(checkinT[d]).length === 0; }) || todayISO();
                t.dias.forEach(function (d) {
                  var opt = document.createElement('option');
                  opt.value = d;
                  opt.textContent = fmtDia(d);
                  if (d === firstUnused) opt.selected = true;
                  sel.appendChild(opt);
                });
                var openBtn = document.createElement('button');
                openBtn.className = 'btn btn--sm btn--primary';
                openBtn.style.cssText = 'padding:6px 12px;box-shadow:none;font-size:.72rem';
                openBtn.textContent = 'Abrir check-in';
                openBtn.addEventListener('click', (function (tk, s) {
                  return function () { openCheckin(tk, s.value); };
                })(t.key, sel));
                primaryWrap.appendChild(sel);
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

              /* ações secundárias — ficam no menu "..." no mobile */
              var qrBtn = document.createElement('button');
              qrBtn.className = 'btn btn--sm';
              qrBtn.style.cssText = 'padding:6px 10px;font-size:.72rem';
              qrBtn.innerHTML = '&#x2318; QR';
              qrBtn.addEventListener('click', (function (tt) {
                return function () { openQrModal(tt); };
              })(t));
              var addBtn = document.createElement('button');
              addBtn.className = 'btn btn--sm';
              addBtn.style.cssText = 'padding:6px 10px;font-size:.72rem';
              addBtn.textContent = '＋ Participante';
              addBtn.addEventListener('click', (function (tk) {
                return function () { addParticipante(tk); };
              })(t.key));
              var reopenBtn = document.createElement('button');
              reopenBtn.className = 'btn btn--sm';
              reopenBtn.style.cssText = 'padding:6px 10px;font-size:.72rem';
              reopenBtn.textContent = '↺ Reabrir';
              reopenBtn.addEventListener('click', (function (tk, td) {
                return function () { reopenTurma(tk, td); };
              })(t.key, allByKey));
              var csvIndBtn = document.createElement('button');
              csvIndBtn.className = 'btn btn--sm';
              csvIndBtn.style.cssText = 'padding:6px 10px;font-size:.72rem';
              csvIndBtn.innerHTML = '&#x2193; CSV';
              csvIndBtn.addEventListener('click', (function (tt, a, f, ck) {
                return function () { exportTurmaCSV(tt, a, f, ck); };
              })(t, all, finalizada, checkinT));
              var certBtn = document.createElement('button');
              certBtn.className = 'btn btn--sm';
              certBtn.style.cssText = 'padding:6px 10px;font-size:.72rem';
              certBtn.innerHTML = '&#x1F4DC; Cert.';
              certBtn.addEventListener('click', (function (tt, ins, ck) {
                return function () { gerarCertificados(tt, ins, ck); };
              })(t, inscritos, checkinT));
              moreMenu.appendChild(qrBtn);
              moreMenu.appendChild(addBtn);
              moreMenu.appendChild(reopenBtn);
              moreMenu.appendChild(csvIndBtn);
              moreMenu.appendChild(certBtn);
            }

            /* CSV também disponível para turma aberta */
            if (!finalizada) {
              var csvOpenBtn = document.createElement('button');
              csvOpenBtn.className = 'btn btn--sm';
              csvOpenBtn.style.cssText = 'padding:6px 10px;font-size:.72rem';
              csvOpenBtn.innerHTML = '&#x2193; CSV';
              csvOpenBtn.addEventListener('click', (function (tt, a, f, ck) {
                return function () { exportTurmaCSV(tt, a, f, ck); };
              })(t, all, finalizada, checkinT));
              moreMenu.appendChild(csvOpenBtn);
            }

            moreBtn.addEventListener('click', function (e) {
              e.stopPropagation();
              moreMenu.classList.toggle('open');
            });
            document.addEventListener('click', function () { moreMenu.classList.remove('open'); });

            actWrap.appendChild(primaryWrap);
            actWrap.appendChild(moreBtn);
            actWrap.appendChild(moreMenu);

            /* body */
            var body = document.createElement('div');
            body.className = 'turma-admin-body';

            if (!active.length) {
              body.innerHTML = '<p class="admin-empty">Nenhum participante ativo.</p>';
            } else if (!finalizada) {
              body.appendChild(buildInteressadosTable(active, t.key));
            } else {
              body.appendChild(buildPresencaTable(t, inscritos, checkinT));
            }

            card.appendChild(body);
            c.appendChild(card);
          });
        });
      });
    });
  }

  /* Tabela simples de interessados (turma aberta) */
  function buildInteressadosTable(records, turmaKey) {
    var wrap = document.createElement('div');
    var tbl = '<table class="admin-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Área</th><th>Data registro</th><th></th></tr></thead><tbody>';
    records.forEach(function (r) {
      var ekey = emailKeyFromEmail(r.email);
      tbl += '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.email) + '</td><td>' +
        esc(r.area || '—') + '</td><td>' + fmtDate(r.date) + '</td>' +
        '<td><button class="ck-remove-btn" data-turma="' + esc(turmaKey) + '" data-ekey="' + esc(ekey) + '" data-name="' + esc(r.name) + '">Remover</button></td></tr>';
    });
    wrap.innerHTML = tbl + '</tbody></table>';
    wrap.addEventListener('click', function (e) {
      var btn = e.target.closest('.ck-remove-btn');
      if (!btn) return;
      var sess = window.faAuth && window.faAuth.getSession();
      adminConfirm('Remover ' + btn.dataset.name + ' da turma?\n\nEla sairá da lista de interessados.', function () {
        var updates = { removed: true, removedDate: new Date().toISOString() };
        if (sess) { updates.removedByAdmin = sess.email; updates.removedByAdminName = sess.name || sess.email; }
        firebase.database().ref('turmas-interesse/' + btn.dataset.turma + '/' + btn.dataset.ekey).update(updates, function (err) {
          if (!err) loadInterests();
        });
      });
    });
    return wrap;
  }

  /* Tabela de presença por dia (turma finalizada) */
  function buildPresencaTable(t, inscritos, checkinT) {
    var minDias = Math.ceil(t.dias.length * CRITERIO_PRESENCA);
    var wrap = document.createElement('div');
    wrap.style.overflowX = 'auto';

    var tbl = '<table class="admin-table presenca-table"><thead><tr>' +
      '<th>Nome</th><th>E-mail</th><th>Área</th>';
    t.dias.forEach(function (d) {
      tbl += '<th class="dia-th">' + fmtDia(d) + '</th>';
    });
    tbl += '<th>Freq.</th><th></th></tr></thead><tbody>';

    inscritos.forEach(function (r) {
      var eKey = emailKeyFromEmail(r.email);
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

      tbl += '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.email) + '</td><td>' +
        esc(r.area || '—') + '</td>' + cells.join('') +
        '<td><span class="' + freqClass + '">' + freq + '</span></td>' +
        '<td><button class="ck-remove-btn" data-turma="' + t.key + '" data-ekey="' + eKey + '" data-name="' + esc(r.name) + '">Remover</button></td></tr>';
    });

    tbl += '</tbody></table>';
    wrap.innerHTML = tbl;

    /* delegação de eventos para desfazer check-in, check-in manual e remoção */
    wrap.addEventListener('click', function (e) {
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
      var remBtn = e.target.closest('.ck-remove-btn');
      if (remBtn) {
        var sess2 = window.faAuth && window.faAuth.getSession();
        adminConfirm('Remover ' + remBtn.dataset.name + ' da turma?\n\nEla sairá da lista de inscritos.', function () {
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

  function buildRemovedTable(records) {
    var tbl = '<table class="admin-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Área</th><th>Data registro</th><th>Data remoção</th></tr></thead><tbody>';
    records.forEach(function (r) {
      tbl += '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.email) + '</td><td>' + esc(r.area || '—') +
        '</td><td>' + fmtDate(r.date) + '</td><td>' + fmtDate(r.removedDate) + '</td></tr>';
    });
    return tbl + '</tbody></table>';
  }

  function emailKeyFromEmail(email) {
    return (email || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
  }

  function getStatus(r, finalizada) {
    if (r.status === 'inscrito' || finalizada) return 'inscrito';
    return 'interessado';
  }

  /* ---- Check-in actions ---- */
  function openCheckin(turmaKey, dia) {
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
      '<p style="font-size:.95rem;line-height:1.6;color:var(--ink)">' + esc(mensagem) + '</p>' +
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
      '<p style="font-size:.95rem;line-height:1.6;color:var(--ink)">' + esc(mensagem) + '</p>' +
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

  /* ---- Adicionar participante manualmente (turma já finalizada) — modal visual ---- */
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
    box.style.cssText = 'max-width:440px;width:90%;padding:28px;display:flex;flex-direction:column;gap:16px';
    box.innerHTML =
      '<h3 style="font-size:1.1rem;font-family:var(--font-head);letter-spacing:.05em;color:var(--ink)">Adicionar Participante</h3>' +
      '<label class="auth-label">Nome<input type="text" id="addPartNome" placeholder="Nome completo" autocomplete="off" /></label>' +
      '<label class="auth-label">E-mail<input type="email" id="addPartEmail" placeholder="nome@previ.com.br" autocomplete="off" /></label>' +
      '<label class="auth-label">Área<select id="addPartArea" style="width:100%;padding:10px 12px;background:var(--panel-2);border:1px solid var(--line-strong);border-radius:6px;color:var(--ink);font-family:var(--font-body)">' +
        '<option value="">Selecione a área…</option>' + areasOptions +
      '</select></label>' +
      '<p id="addPartErr" style="color:var(--red,#ff3b30);font-size:.85rem;display:none"></p>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px">' +
        '<button class="btn admin-modal-cancel-btn">Cancelar</button>' +
        '<button class="btn btn--primary admin-modal-add-btn">Adicionar</button>' +
      '</div>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    var errEl = box.querySelector('#addPartErr');

    function closeModal() { document.body.removeChild(overlay); }

    box.querySelector('.admin-modal-cancel-btn').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });

    box.querySelector('.admin-modal-add-btn').addEventListener('click', function () {
      var name  = (box.querySelector('#addPartNome').value || '').trim();
      var email = (box.querySelector('#addPartEmail').value || '').trim().toLowerCase();
      var area  = (box.querySelector('#addPartArea').value || '').trim();

      errEl.style.display = 'none';
      if (!name) { errEl.textContent = 'Preencha o nome.'; errEl.style.display = ''; return; }
      if (!email) { errEl.textContent = 'Preencha o e-mail.'; errEl.style.display = ''; return; }
      if (!/@previ\.com\.br$/.test(email)) { errEl.textContent = 'Use um e-mail @previ.com.br.'; errEl.style.display = ''; return; }
      if (!area) { errEl.textContent = 'Selecione a área.'; errEl.style.display = ''; return; }

      var eKey = emailKeyFromEmail(email);
      var ref  = firebase.database().ref('turmas-interesse/' + turmaKey + '/' + eKey);
      ref.once('value', function (snap) {
        if (snap.val() && !snap.val().removed) {
          errEl.textContent = 'Este participante já está na turma.'; errEl.style.display = ''; return;
        }
        var adminName = sess ? (sess.name || sess.email) : 'Admin';
        ref.set({
          name: name, email: email, area: area,
          date: new Date().toISOString(),
          status: 'inscrito', addedByAdmin: true,
          addedByAdminName: adminName
        }, function (err) {
          if (err) { errEl.textContent = 'Erro ao adicionar. Tente novamente.'; errEl.style.display = ''; return; }
          closeModal();
          loadInterests();
        });
      });
    });
  }

  /* ---- Finalizar / Reabrir turma ---- */
  function finalizeTurma(turmaKey, turmaData) {
    adminConfirm('Finalizar inscrição da turma ' + turmaKey.toUpperCase() + '?\n\nTodos os interessados virarão inscritos e a turma será bloqueada para novos interessados.', function () {
      var updates = {};
      updates['turmas-config/' + turmaKey + '/finalizada'] = true;
      Object.keys(turmaData).forEach(function (eKey) {
        var r = turmaData[eKey];
        if (!r.removed && r.status !== 'presente') {
          updates['turmas-interesse/' + turmaKey + '/' + eKey + '/status'] = 'inscrito';
        }
      });
      firebase.database().ref().update(updates, function (err) {
        if (err) { adminAlert('Erro ao finalizar. Tente novamente.'); return; }
        loadInterests();
      });
    });
  }

  function reopenTurma(turmaKey, turmaData) {
    adminConfirm('Reabrir a turma ' + turmaKey.toUpperCase() + '?\n\nInscritos voltarão ao status interessado e novas inscrições serão permitidas.', function () {
      var updates = {};
      updates['turmas-config/' + turmaKey + '/finalizada'] = false;
      updates['turmas-config/' + turmaKey + '/diaAtivo']   = null;
      Object.keys(turmaData).forEach(function (eKey) {
        var r = turmaData[eKey];
        if (!r.removed && r.status === 'inscrito') {
          updates['turmas-interesse/' + turmaKey + '/' + eKey + '/status'] = 'interessado';
        }
      });
      firebase.database().ref().update(updates, function (err) {
        if (err) { adminAlert('Erro ao reabrir. Tente novamente.'); return; }
        loadInterests();
      });
    });
  }

  /* ---- QR Code modal ---- */
  function openQrModal(t) {
    var modal   = document.getElementById('qrModal');
    var canvas  = document.getElementById('qrCanvas');
    var turmaEl = document.getElementById('qrModalTurma');
    var urlEl   = document.getElementById('qrModalUrl');
    if (!modal || !canvas) return;
    var url = window.location.origin + window.location.pathname + '#checkin?turma=' + t.key;
    turmaEl.textContent = t.label + ' (' + t.dates + ')';
    urlEl.textContent   = url;
    if (typeof QRCode !== 'undefined') {
      QRCode.toCanvas(canvas, url, { width: 220, color: { dark: '#ffffff', light: '#0d1b2a' } }, function (err) {
        if (err) console.warn('QR error:', err);
      });
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
    var periodoInicio = new Date(t.dias[0] + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    var periodoFim = new Date(t.dias[t.dias.length - 1] + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    var cards = aprovados.map(function (r) {
      var eKey = emailKeyFromEmail(r.email);
      var diasPresente = t.dias.filter(function (d) { return checkinT[d] && checkinT[d][eKey]; }).length;
      var freq = Math.round((diasPresente / t.dias.length) * 100);
      return (
        '<div class="cert-page">' +
          '<div class="cert-box">' +
            '<div class="cert-header">' +
              '<div class="cert-logo">FORÇA ÁGIL</div>' +
              '<div class="cert-previ">Previ — Caixa de Previdência dos Funcionários do Banco do Brasil</div>' +
            '</div>' +
            '<div class="cert-title">CERTIFICADO DE PARTICIPAÇÃO</div>' +
            '<div class="cert-body">' +
              '<p>Certificamos que</p>' +
              '<div class="cert-nome">' + esc(r.name) + '</div>' +
              '<p>participou do programa de desenvolvimento ágil</p>' +
              '<div class="cert-turma">' + esc(t.label) + '</div>' +
              '<p>realizado no período de <strong>' + periodoInicio + '</strong> a <strong>' + periodoFim + '</strong>,<br>' +
              'com frequência de <strong>' + diasPresente + ' de ' + t.dias.length + ' encontros (' + freq + '%)</strong>.</p>' +
            '</div>' +
            '<div class="cert-footer">' +
              '<div class="cert-assinatura"><div class="cert-linha"></div><div>Coordenação Força Ágil</div></div>' +
              '<div class="cert-data">Emitido em ' + dataEmissao + '</div>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    var html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">' +
      '<title>Certificados — ' + esc(t.label) + '</title>' +
      '<style>' +
        'body{margin:0;padding:0;background:#f0f0f0;font-family:Georgia,serif;}' +
        '.cert-page{width:297mm;height:210mm;display:flex;align-items:center;justify-content:center;page-break-after:always;box-sizing:border-box;}' +
        '.cert-box{width:270mm;height:185mm;border:3px solid #b8960c;border-radius:8px;padding:12mm 16mm;box-sizing:border-box;background:#fff;display:flex;flex-direction:column;justify-content:space-between;position:relative;}' +
        '.cert-box::before{content:"";position:absolute;inset:6px;border:1px solid #d4af37;border-radius:4px;pointer-events:none;}' +
        '.cert-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6mm;}' +
        '.cert-logo{font-size:22pt;font-weight:700;letter-spacing:.08em;color:#0a1628;text-transform:uppercase;}' +
        '.cert-previ{font-size:7pt;color:#555;max-width:60%;text-align:right;line-height:1.5;}' +
        '.cert-title{font-size:18pt;letter-spacing:.2em;text-transform:uppercase;color:#b8960c;text-align:center;margin-bottom:8mm;font-family:Arial,sans-serif;font-weight:700;}' +
        '.cert-body{text-align:center;flex:1;display:flex;flex-direction:column;justify-content:center;gap:4mm;font-size:11pt;color:#222;line-height:1.8;}' +
        '.cert-nome{font-size:22pt;font-weight:700;color:#0a1628;letter-spacing:.03em;border-bottom:1px solid #d4af37;padding-bottom:3mm;margin:0 20mm;}' +
        '.cert-turma{font-size:14pt;font-style:italic;color:#b8960c;font-weight:700;}' +
        '.cert-footer{display:flex;justify-content:space-between;align-items:flex-end;margin-top:6mm;}' +
        '.cert-assinatura{text-align:center;font-size:9pt;color:#333;}' +
        '.cert-linha{border-top:1px solid #333;width:55mm;margin-bottom:2mm;}' +
        '.cert-data{font-size:9pt;color:#555;}' +
        '@media print{body{background:#fff;}.cert-page{width:100%;height:100vh;}}' +
      '</style></head><body>' + cards +
      '<script>window.onload=function(){window.print();}<\/script>' +
      '</body></html>';

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
      var st = getStatus(r, finalizada);
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
        var st = getStatus(r, finalizada);
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
              var acao = entry.action === 'registrado' ? 'Interesse registrado' : 'Interesse removido';
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

    const filterWrap = document.createElement('div');
    filterWrap.className = 'admin-colab-row';
    filterWrap.style.marginBottom = '16px';
    filterWrap.innerHTML = '<input id="cadastradosFiltro" type="text" placeholder="Filtrar por nome ou e-mail…" />';
    c.appendChild(filterWrap);

    const tbl = document.createElement('table');
    tbl.className = 'admin-table';
    tbl.innerHTML = '<thead><tr><th>Nome</th><th>E-mail</th><th>Área</th><th>Cadastro</th><th></th><th></th></tr></thead>';
    const tbody = document.createElement('tbody');

    function fillRows(filtered) {
      tbody.innerHTML = '';
      filtered.forEach(function (p) {
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + esc(p.name || '—') + '</td>' +
          '<td>' + esc(p.email || '—') + '</td>' +
          '<td>' + esc(p.area || '—') + '</td>' +
          '<td>' + fmtDate(p.createdAt) + '</td>' +
          '<td><button class="admin-del-btn admin-pwd-btn" data-key="' + esc(p._key) + '" data-email="' + esc(p.email || '') + '" data-name="' + esc(p.name || p.email) + '">Redefinir senha</button></td>' +
          '<td><button class="admin-del-btn admin-reset-btn" data-key="' + esc(p._key) + '" data-email="' + esc(p.email || '') + '" data-name="' + esc(p.name || p.email) + '">Resetar progresso</button></td>';
        tbody.appendChild(tr);
      });
    }
    fillRows(list);
    tbl.appendChild(tbody);
    c.appendChild(tbl);

    const filtroInput = document.getElementById('cadastradosFiltro');
    filtroInput.addEventListener('input', function () {
      const q = filtroInput.value.trim().toLowerCase();
      if (!q) { fillRows(list); return; }
      fillRows(list.filter(function (p) {
        return (p.name || '').toLowerCase().indexOf(q) !== -1 || (p.email || '').toLowerCase().indexOf(q) !== -1;
      }));
    });

    /* Delegação de eventos para resetar e redefinir senha */
    tbody.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      if (btn.classList.contains('admin-pwd-btn')) {
        handlePwdReset(btn);
        return;
      }
      if (btn.classList.contains('admin-reset-btn')) {
        const eKey   = btn.dataset.key;
        const email  = btn.dataset.email;
        const name   = btn.dataset.name;
        adminConfirm('Resetar TODO o progresso do jogo de ' + name + '?\n\nIsso apaga autodiagnóstico, missões, Kyber Game e patente. Essa ação não pode ser desfeita.', function () {
          const updates = {};
          updates['fa-progress/' + eKey]      = null;
          updates['fa-reset-signal/' + eKey]  = { at: firebase.database.ServerValue.TIMESTAMP };
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
    });
  }

  /* ---- Administradores ---- */
  function loadAdmins() {
    const c = document.getElementById('adminAdmins');
    if (!c) return;

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
          tbl.innerHTML = '<thead><tr><th>Nome</th><th>E-mail</th><th>Desde</th><th></th></tr></thead>';
          const tbody = document.createElement('tbody');
          dbList.forEach(function (p) {
            const tr = document.createElement('tr');
            tr.innerHTML =
              '<td>' + esc(p.name || '—') + '</td>' +
              '<td>' + esc(p.email || '—') + '</td>' +
              '<td>' + fmtDate(p.addedAt) + '</td>' +
              '<td><button class="admin-del-btn" data-key="' + esc(emailKey(p.email)) + '" data-name="' + esc(p.name || p.email) + '">Remover</button></td>';
            tbody.appendChild(tr);
          });
          tbl.appendChild(tbody);
          c.appendChild(tbl);

          tbody.addEventListener('click', function (e) {
            const btn = e.target.closest('.admin-del-btn');
            if (!btn) return;
            adminConfirm('Remover ' + btn.dataset.name + ' dos administradores?', function () {
              firebase.database().ref('fa-admins/' + btn.dataset.key).remove(function () { render(); });
            });
          });
        }

        /* Formulário de adição */
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
})();
