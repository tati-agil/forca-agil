/* ============================================================
   Força Ágil — Admin Module
   Área restrita: tatianefdirene@previ.com.br | danilfrazao@previ.com.br
   ============================================================ */
(function () {
  'use strict';

  /* Painéis com conteúdo expansível */
  const EXPANDABLE_PANELS = ['adminPanelManual', 'adminPanelMapa', 'adminPanelTestes'];

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

    var secs = [];

    /* Manual: details.manual-section-group */
    panel.querySelectorAll('details.manual-section-group').forEach(function (det) {
      var summ = det.querySelector('summary.manual-section-header');
      if (!summ) return;
      var color = summ.style.color || 'var(--ink)';
      var label = (summ.firstChild && summ.firstChild.nodeType === 3 ? summ.firstChild.textContent : summ.textContent).trim();
      secs.push({ label: label, color: color, toggle: function () { det.open = !det.open; } });
    });

    /* Mapa: .mapa-page (top-level) */
    panel.querySelectorAll('.mapa-page').forEach(function (page) {
      var titleEl = page.querySelector('.mapa-page-title span');
      var label = titleEl ? titleEl.textContent.trim() : '';
      var color = page.style.getPropertyValue('--pc') || 'var(--ink)';
      secs.push({ label: label, color: color, toggle: function () { page.classList.toggle('open'); } });
    });

    /* Testes: .testes-group--collapsible */
    panel.querySelectorAll('.testes-group--collapsible').forEach(function (grp) {
      var labelEl = grp.querySelector('.testes-group-label');
      var color = labelEl ? labelEl.style.color : 'var(--ink)';
      var spanEl = labelEl ? labelEl.querySelector('span') : null;
      var label = spanEl ? spanEl.textContent.replace(/\(.*\)/, '').trim() : '';
      secs.push({ label: label, color: color, toggle: function () { grp.classList.toggle('open'); } });
    });

    if (!secs.length) return;

    var sep = document.createElement('span');
    sep.className = 'admin-expand-sep';
    bar.appendChild(sep);

    secs.forEach(function (sec) {
      var btn = document.createElement('button');
      btn.className = 'admin-expand-sec-btn';
      btn.textContent = sec.label;
      btn.style.setProperty('--sec-col', sec.color);
      btn.addEventListener('click', sec.toggle);
      bar.appendChild(btn);
    });
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

  const COLAB_SEED = [
    { email: 'luiz.spinelli@previ.com.br',      name: 'Luiz Antonio Fernandes Spinelli' },
    { email: 'mpl@previ.com.br',                name: 'Maira Prado Louvison' },
    { email: 'giselebatista@previ.com.br',       name: 'Gisele Batista de Souza' },
    { email: 'cris@previ.com.br',               name: 'Cristiane Toledo de Andrade' },
    { email: 'marcoagarcia@previ.com.br',        name: 'Marco Antonio Garcia Jorge' },
    { email: 'jusan@previ.com.br',              name: 'Marcelo Jusan Fernandes' },
    { email: 'tulioalves@previ.com.br',          name: 'Tulio Alves Ferreira Junior' },
    { email: 'ronicesar@previ.com.br',           name: 'Roni Cesar de Paulo Cruz Iracema' },
    { email: 'rodolfo@previ.com.br',             name: 'Rodolfo Credi Dio de Oliveira Goncalves' },
    { email: 'pedro.ferrari@capgemini.com',      name: 'Pedro Henrique Ferrari' },
    { email: 'vanisa.miksucas@montreal.com.br',  name: 'Vanisa Miksucas' },
    { email: 'caduh@previ.com.br',              name: 'Carlos Eduardo Schuch Pinto' },
    { email: 'tatianefdirene@previ.com.br',      name: 'Tatiane Faro Direne' },
    { email: 'danielfrazao@previ.com.br',        name: 'Daniel Frazão' }
  ];

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
    loadColaboradores();
    loadCadastrados();
    loadAdmins();
    if (window.faInitManual) window.faInitManual();
    if (window.faInitMapa) window.faInitMapa();
    if (window.faInitTestes) window.faInitTestes();
  }

  function migrateNameCase() {
    ['fa-colaboradores', 'fa-admins'].forEach(function (path) {
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
    { key: 't1', label: 'Turma 1 — Agosto',   dates: '11·12·18·19·20',
      dias: ['2026-08-11','2026-08-12','2026-08-18','2026-08-19','2026-08-20'] },
    { key: 't2', label: 'Turma 2 — Setembro', dates: '09·10·11·15·16',
      dias: ['2026-09-09','2026-09-10','2026-09-11','2026-09-15','2026-09-16'] },
    { key: 't3', label: 'Turma 3 — Novembro', dates: '17·18·19·24·25',
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

            /* header */
            var hdr = document.createElement('div');
            hdr.className = 'turma-admin-header';

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

            /* action buttons */
            var actWrap = hdr.querySelector('#turma-actions-' + t.key);
            if (!finalizada) {
              var finBtn = document.createElement('button');
              finBtn.className = 'btn btn--sm btn--primary';
              finBtn.textContent = 'Finalizar inscrição';
              finBtn.addEventListener('click', (function (tk, td) {
                return function () { finalizeTurma(tk, td); };
              })(t.key, allByKey));
              actWrap.appendChild(finBtn);
            } else {
              /* check-in abrir/fechar */
              if (!diaAtivo) {
                var sel = document.createElement('select');
                sel.className = 'checkin-dia-select';
                t.dias.forEach(function (d) {
                  var opt = document.createElement('option');
                  opt.value = d;
                  opt.textContent = fmtDia(d);
                  if (d === todayISO()) opt.selected = true;
                  sel.appendChild(opt);
                });
                var openBtn = document.createElement('button');
                openBtn.className = 'btn btn--sm btn--primary';
                openBtn.textContent = 'Abrir check-in';
                openBtn.addEventListener('click', (function (tk, s) {
                  return function () { openCheckin(tk, s.value); };
                })(t.key, sel));
                actWrap.appendChild(sel);
                actWrap.appendChild(openBtn);
              } else {
                var diaAtivoLabel = document.createElement('span');
                diaAtivoLabel.className = 'checkin-dia-aberto';
                diaAtivoLabel.textContent = 'Check-in aberto: ' + fmtDia(diaAtivo);
                var closeBtn2 = document.createElement('button');
                closeBtn2.className = 'btn btn--sm';
                closeBtn2.style.borderColor = 'rgba(255,80,80,.5)';
                closeBtn2.style.color = '#ff8080';
                closeBtn2.textContent = 'Fechar check-in';
                closeBtn2.addEventListener('click', (function (tk) {
                  return function () { closeCheckin(tk); };
                })(t.key));
                actWrap.appendChild(diaAtivoLabel);
                actWrap.appendChild(closeBtn2);
              }
              var qrBtn = document.createElement('button');
              qrBtn.className = 'btn btn--sm';
              qrBtn.innerHTML = '&#x2318; QR Code';
              qrBtn.addEventListener('click', (function (tt) {
                return function () { openQrModal(tt); };
              })(t));
              var reopenBtn = document.createElement('button');
              reopenBtn.className = 'btn btn--sm';
              reopenBtn.textContent = '↺ Reabrir turma';
              reopenBtn.addEventListener('click', (function (tk, td) {
                return function () { reopenTurma(tk, td); };
              })(t.key, allByKey));
              var addBtn = document.createElement('button');
              addBtn.className = 'btn btn--sm';
              addBtn.textContent = '＋ Participante';
              addBtn.addEventListener('click', (function (tk) {
                return function () { addParticipante(tk); };
              })(t.key));
              actWrap.appendChild(qrBtn);
              actWrap.appendChild(addBtn);
              actWrap.appendChild(reopenBtn);
            }
            var csvIndBtn = document.createElement('button');
            csvIndBtn.className = 'btn btn--sm';
            csvIndBtn.innerHTML = '&#x2193; CSV';
            csvIndBtn.addEventListener('click', (function (tt, a, f, ck) {
              return function () { exportTurmaCSV(tt, a, f, ck); };
            })(t, all, finalizada, checkinT));
            actWrap.appendChild(csvIndBtn);

            /* body */
            var body = document.createElement('div');
            body.className = 'turma-admin-body';

            if (!active.length) {
              body.innerHTML = '<p class="admin-empty">Nenhum participante ativo.</p>';
            } else if (!finalizada) {
              body.innerHTML = buildInteressadosTable(active);
            } else {
              body.appendChild(buildPresencaTable(t, inscritos, checkinT));
            }

            if (removed.length) {
              var removedTitle = document.createElement('p');
              removedTitle.className = 'turma-removed-title';
              removedTitle.textContent = 'Removidos (' + removed.length + ')';
              body.appendChild(removedTitle);
              body.innerHTML += buildRemovedTable(removed);
            }

            card.appendChild(body);
            c.appendChild(card);
          });
        });
      });
    });
  }

  /* Tabela simples de interessados (turma aberta) */
  function buildInteressadosTable(records) {
    var tbl = '<table class="admin-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Área</th><th>Data registro</th></tr></thead><tbody>';
    records.forEach(function (r) {
      tbl += '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.email) + '</td><td>' +
        esc(r.area || '—') + '</td><td>' + fmtDate(r.date) + '</td></tr>';
    });
    return tbl + '</tbody></table>';
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
          var badge = ck.source === 'admin'
            ? '<span class="ck-badge ck-adm" title="Registrado pelo admin">✓ adm</span>'
            : '<span class="ck-badge ck-qr"  title="Check-in via QR">✓ qr</span>';
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

    /* delegação de eventos para check-in manual e remoção */
    wrap.addEventListener('click', function (e) {
      var btn = e.target.closest('.ck-manual-btn');
      if (btn) {
        adminCheckin(btn.dataset.turma, btn.dataset.dia, btn.dataset.ekey, {
          name: btn.dataset.name, email: btn.dataset.email, area: btn.dataset.area
        });
        return;
      }
      var remBtn = e.target.closest('.ck-remove-btn');
      if (remBtn) {
        if (!confirm('Remover ' + remBtn.dataset.name + ' da turma?\n\nEla sairá da lista de inscritos.')) return;
        firebase.database().ref('turmas-interesse/' + remBtn.dataset.turma + '/' + remBtn.dataset.ekey).update({
          removed: true, removedDate: new Date().toISOString()
        }, function (err) {
          if (!err) loadInterests();
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
      if (err) { alert('Erro ao abrir check-in.'); return; }
      loadInterests();
    });
  }

  function closeCheckin(turmaKey) {
    firebase.database().ref('turmas-config/' + turmaKey + '/diaAtivo').set(null, function (err) {
      if (err) { alert('Erro ao fechar check-in.'); return; }
      loadInterests();
    });
  }

  function adminCheckin(turmaKey, dia, eKey, person) {
    var ref = firebase.database().ref('turmas-checkin/' + turmaKey + '/' + dia + '/' + eKey);
    ref.set({
      name: person.name, email: person.email, area: person.area || '',
      checkinAt: new Date().toISOString(), source: 'admin'
    }, function (err) {
      if (err) { alert('Erro ao registrar presença.'); return; }
      loadInterests();
    });
  }

  /* ---- Adicionar participante manualmente (turma já finalizada) ---- */
  function addParticipante(turmaKey) {
    var email = (prompt('E-mail do participante:') || '').trim().toLowerCase();
    if (!email) return;
    if (!/@previ\.com\.br$/.test(email)) { alert('Use um e-mail @previ.com.br.'); return; }
    var name  = (prompt('Nome completo:') || '').trim();
    if (!name) return;
    var area  = (prompt('Área (deixe em branco se não souber):') || '').trim();
    var eKey  = emailKeyFromEmail(email);
    var ref   = firebase.database().ref('turmas-interesse/' + turmaKey + '/' + eKey);
    ref.once('value', function (snap) {
      if (snap.val() && !snap.val().removed) {
        alert('Este participante já está na turma.'); return;
      }
      ref.set({
        name: name, email: email, area: area,
        date: new Date().toISOString(),
        status: 'inscrito', addedByAdmin: true
      }, function (err) {
        if (err) { alert('Erro ao adicionar participante.'); return; }
        loadInterests();
      });
    });
  }

  /* ---- Finalizar / Reabrir turma ---- */
  function finalizeTurma(turmaKey, turmaData) {
    if (!confirm('Finalizar inscrição da turma ' + turmaKey.toUpperCase() + '?\n\nTodos os interessados virarão inscritos e a turma será bloqueada para novos interessados.')) return;
    var updates = {};
    updates['turmas-config/' + turmaKey + '/finalizada'] = true;
    Object.keys(turmaData).forEach(function (eKey) {
      var r = turmaData[eKey];
      if (!r.removed && r.status !== 'presente') {
        updates['turmas-interesse/' + turmaKey + '/' + eKey + '/status'] = 'inscrito';
      }
    });
    firebase.database().ref().update(updates, function (err) {
      if (err) { alert('Erro ao finalizar. Tente novamente.'); return; }
      loadInterests();
    });
  }

  function reopenTurma(turmaKey, turmaData) {
    if (!confirm('Reabrir a turma ' + turmaKey.toUpperCase() + '?\n\nInscritos voltarão ao status interessado e novas inscrições serão permitidas.')) return;
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
      if (err) { alert('Erro ao reabrir. Tente novamente.'); return; }
      loadInterests();
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

  /* ---- CSV exports ---- */
  function exportTurmaCSV(t, all, finalizada, checkinT) {
    var minDias = Math.ceil(t.dias.length * CRITERIO_PRESENCA);
    var rows = [];
    all.forEach(function (r) {
      var eKey = emailKeyFromEmail(r.email);
      var st = r.removed ? 'Removido' : getStatus(r, finalizada);
      var row = [t.label, r.name||'', r.email||'', r.area||'', st,
        r.date ? new Date(r.date).toLocaleString('pt-BR') : ''];
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
    var headers = ['Turma','Nome','E-mail','Área','Status','Data Registro'];
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
      all.forEach(function (r) {
        var eKey = emailKeyFromEmail(r.email);
        var st = r.removed ? 'Removido' : getStatus(r, finalizada);
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
    firebase.database().ref('turmas-interesse-log').once('value', function (snap) {
      var data = snap.val() || {};
      var rows = [];
      TURMAS_LIST.forEach(function (t) {
        var turmaLog = data[t.key] || {};
        Object.values(turmaLog).forEach(function (userLog) {
          Object.values(userLog).forEach(function (entry) {
            rows.push([t.label, entry.name||'', entry.email||'', entry.area||'',
              entry.action === 'registrado' ? 'Adicionou' : 'Removeu',
              entry.date ? new Date(entry.date).toLocaleString('pt-BR') : '']);
          });
        });
      });
      toXls(['Turma','Nome','E-mail','Área','Tipo de Ação','Data'],
        rows, 'historico-interesse-' + new Date().toISOString().slice(0,10) + '.csv');
    });
  }

  function toXls(headers, rows, filename) {
    function csvCell(v) {
      var s = String(v == null ? '' : v).replace(/"/g, '""');
      return /["\n\r;]/.test(s) ? '"' + s + '"' : s;
    }
    var lines = ['sep=;', headers.map(csvCell).join(';')].concat(
      rows.map(function (row) { return row.map(csvCell).join(';'); })
    );
    var csvFilename = filename.replace(/\.xls$/i, '.csv');
    var raw = '﻿' + lines.join('\r\n'); // UTF-8 BOM para Excel reconhecer acentos
    var blob = new Blob([raw], { type: 'text/csv;charset=utf-8;' });
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
            if (!confirm('Restaurar "' + item.title + '" no repositório público?')) return;
            firebase.database().ref('fa-seeds-hidden/' + sk).remove(function () { loadRepoAdmin(); });
          } else {
            if (!confirm('Ocultar "' + item.title + '" do repositório público?')) return;
            firebase.database().ref('fa-seeds-hidden/' + sk).set(true, function () { loadRepoAdmin(); });
          }
        });

        row.querySelector('.admin-perm-del-btn').addEventListener('click', function () {
          if (!confirm('Deletar permanentemente "' + item.title + '"? Esta ação não pode ser desfeita.')) return;
          const updates = {};
          updates['fa-seeds-deleted/' + sk] = true;
          updates['fa-seeds-hidden/' + sk]  = true;
          firebase.database().ref().update(updates, function () { loadRepoAdmin(); });
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
              if (!confirm('Restaurar "' + (item.title || '') + '" no repositório público?')) return;
              firebase.database().ref('fa-holocron-hidden/' + key).remove(function () { loadRepoAdmin(); });
            } else {
              if (!confirm('Ocultar "' + (item.title || '') + '" do repositório público?')) return;
              firebase.database().ref('fa-holocron-hidden/' + key).set(true, function () { loadRepoAdmin(); });
            }
          });

          row.querySelector('.admin-perm-del-btn').addEventListener('click', function () {
            if (!confirm('Deletar "' + esc(item.title || '') + '" do repositório? Esta ação não pode ser desfeita.')) return;
            firebase.database().ref('holocron/' + key).remove(function (err) {
              if (!err) { firebase.database().ref('fa-holocron-hidden/' + key).remove(); row.remove(); }
              else alert('Erro ao deletar. Tente novamente.');
            });
          });

          userSec.appendChild(row);
        });
      }
    });
  }

  /* ---- Colaboradores ---- */
  function loadColaboradores() {
    const c = document.getElementById('adminColab');
    if (!c) return;
    c.innerHTML = '<p class="loading-msg">Carregando…</p>';

    firebase.database().ref('fa-colaboradores').once('value', function (snap) {
      const data = snap.val() || {};
      if (Object.keys(data).length === 0) {
        const updates = {};
        COLAB_SEED.forEach(function (p) {
          updates['fa-colaboradores/' + emailKey(p.email)] = { email: p.email, name: p.name, addedAt: new Date().toISOString() };
        });
        firebase.database().ref().update(updates, function () {
          firebase.database().ref('fa-colaboradores').once('value', function (s2) { renderColab(c, s2.val() || {}); });
        });
      } else {
        renderColab(c, data);
      }
    });
  }

  function handlePwdReset(btn) {
    const email = btn.dataset.email;
    const name  = btn.dataset.name;
    if (!confirm('Enviar e-mail de redefinição de senha para ' + name + ' (' + email + ')?')) return;
    firebase.auth().sendPasswordResetEmail(email)
      .then(function () {
        alert('E-mail enviado para ' + email + '.\n' + name + ' receberá o link em alguns minutos para definir uma nova senha.');
      })
      .catch(function (err) {
        if (err.code === 'auth/user-not-found') {
          alert(name + ' ainda não tem cadastro ativo. O colaborador precisa fazer o primeiro login no sistema antes de poder redefinir a senha.');
        } else {
          alert('Erro ao enviar: ' + err.message);
        }
      });
  }

  function renderColab(c, data) {
    const list = Object.values(data).sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'pt'); });
    c.innerHTML = '';

    /* Título */
    const hdr = document.createElement('h4');
    hdr.innerHTML = 'Colaboradores <span class="admin-badge">' + list.length + '</span>';
    c.appendChild(hdr);

    /* Busca */
    const searchWrap = document.createElement('div');
    searchWrap.className = 'admin-colab-row';
    searchWrap.style.marginBottom = '16px';
    searchWrap.innerHTML = '<input id="colabFiltro" type="text" placeholder="Filtrar por nome ou e-mail…" style="flex:1" />';
    c.appendChild(searchWrap);

    /* Tabela */
    const tbl = document.createElement('table');
    tbl.className = 'admin-table';
    tbl.innerHTML = '<thead><tr><th>Nome</th><th>E-mail</th><th>Desde</th><th></th></tr></thead>';
    const tbody = document.createElement('tbody');

    function fillRows(filtered) {
      tbody.innerHTML = '';
      filtered.forEach(function (p) {
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + esc(p.name || '—') + '</td>' +
          '<td>' + esc(p.email || '—') + '</td>' +
          '<td>' + fmtDate(p.addedAt) + '</td>' +
          '<td><button class="admin-del-btn" data-key="' + esc(emailKey(p.email)) + '" data-name="' + esc(p.name || p.email) + '">Remover</button></td>';
        tbody.appendChild(tr);
      });
    }

    fillRows(list);
    tbl.appendChild(tbody);
    c.appendChild(tbl);

    const filtroInput = document.getElementById('colabFiltro');
    filtroInput.addEventListener('input', function () {
      const q = filtroInput.value.trim().toLowerCase();
      fillRows(!q ? list : list.filter(function (p) {
        return (p.name || '').toLowerCase().indexOf(q) !== -1 || (p.email || '').toLowerCase().indexOf(q) !== -1;
      }));
    });

    /* Delegação de eventos para remover */
    tbody.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      if (btn.classList.contains('admin-del-btn')) {
        if (!confirm('Remover ' + btn.dataset.name + ' dos colaboradores?')) return;
        firebase.database().ref('fa-colaboradores/' + btn.dataset.key).remove(function () {
          firebase.database().ref('fa-colaboradores').once('value', function (s) { renderColab(c, s.val() || {}); });
        });
      }
    });

    /* Formulário de adição */
    const form = document.createElement('div');
    form.className = 'admin-colab-form';
    form.innerHTML =
      '<h4 style="margin-top:32px">Adicionar colaborador</h4>' +
      '<div class="admin-colab-row">' +
        '<input id="colabName"  type="text"  placeholder="Nome completo" />' +
        '<input id="colabEmail" type="email" placeholder="e-mail" />' +
        '<button class="btn btn--primary" id="colabAddBtn">Adicionar</button>' +
      '</div>' +
      '<p id="colabMsg" style="margin-top:8px;font-size:.8rem;color:var(--cyan)"></p>';
    c.appendChild(form);

    document.getElementById('colabAddBtn').addEventListener('click', function () {
      const name  = (document.getElementById('colabName').value  || '').trim().toUpperCase();
      const email = (document.getElementById('colabEmail').value || '').trim().toLowerCase();
      const msg   = document.getElementById('colabMsg');
      if (!name || !email) { msg.style.color = 'var(--accent)'; msg.textContent = 'Preencha nome e e-mail.'; return; }
      if (!/^[^\s@]+@previ\.com\.br$/i.test(email)) { msg.style.color = 'var(--accent)'; msg.textContent = 'Use um e-mail @previ.com.br.'; return; }
      firebase.database().ref('fa-colaboradores/' + emailKey(email)).set(
        { email: email, name: name, addedAt: new Date().toISOString() },
        function (err) {
          if (err) { msg.style.color = 'var(--accent)'; msg.textContent = 'Erro ao salvar.'; return; }
          document.getElementById('colabName').value  = '';
          document.getElementById('colabEmail').value = '';
          msg.style.color = 'var(--cyan)'; msg.textContent = name + ' adicionado(a).';
          firebase.database().ref('fa-colaboradores').once('value', function (s) { renderColab(c, s.val() || {}); });
        }
      );
    });
  }

  /* ---- Cadastrados (todos que fizeram cadastro, não só colaboradores) ---- */
  function loadCadastrados() {
    const c = document.getElementById('adminCadastrados');
    if (!c) return;
    c.innerHTML = '<p class="loading-msg">Carregando…</p>';

    Promise.all([
      firebase.database().ref('fa-users').once('value'),
      firebase.database().ref('players').once('value'),
      firebase.database().ref('fa-progress').once('value')
    ]).then(function (snaps) {
      const data     = snaps[0].val() || {};
      const players  = snaps[1].val() || {};
      const progress = snaps[2].val() || {};
      renderCadastrados(c, data, players, progress);
    });
  }

  function calcXPFromProgress(prog) {
    if (!prog) return 0;
    var xpAuto = 0;
    try {
      var g = JSON.parse(prog.fa_game_v2 || 'null');
      if (g && g.quiz) {
        var answered = g.quiz.filter(function (v) { return v != null; }).length;
        xpAuto = Math.round(answered / 6 * 20);
      }
    } catch (e) {}
    var xpMissoes = parseInt(prog.fa_missions_xp || '0', 10) || 0;
    var xpKyber   = parseInt(prog.fa_kyber_xp    || '0', 10) || 0;
    var xpContent = parseInt(prog.fa_content_xp  || '0', 10) || 0;
    var xpRepo    = parseInt(prog.fa_repo_xp     || '0', 10) || 0;
    return Math.min(100, xpAuto + xpMissoes + xpKyber + xpContent + xpRepo);
  }

  function renderCadastrados(c, data, players, progress) {
    players  = players  || {};
    progress = progress || {};
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
    tbl.innerHTML = '<thead><tr><th>Nome</th><th>E-mail</th><th>Área</th><th>Cadastro</th><th>XP</th><th></th><th></th></tr></thead>';
    const tbody = document.createElement('tbody');

    function fillRows(filtered) {
      tbody.innerHTML = '';
      filtered.forEach(function (p) {
        const player    = players[p._key] || {};
        const published = player.totalXP != null;
        const xpVal     = published ? player.totalXP : calcXPFromProgress(progress[p._key] || null);
        const xp        = xpVal > 0 ? xpVal + ' XP' : '—';
        const xpStyle   = published
          ? 'color:var(--accent);font-family:var(--font-mono);font-weight:700'
          : xpVal > 0
            ? 'color:var(--cyan);font-family:var(--font-mono);font-weight:700'
            : 'color:var(--ink-3);font-family:var(--font-mono)';
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + esc(p.name || '—') + '</td>' +
          '<td>' + esc(p.email || '—') + '</td>' +
          '<td>' + esc(p.area || '—') + '</td>' +
          '<td>' + fmtDate(p.createdAt) + '</td>' +
          '<td style="' + xpStyle + '">' + xp + '</td>' +
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
        if (!confirm('Resetar TODO o progresso do jogo de ' + btn.dataset.name + '?\n\nIsso apaga autodiagnóstico, missões, Kyber Game e patente. Essa ação não pode ser desfeita.')) return;
        const eKey   = btn.dataset.key;
        const email  = btn.dataset.email;
        const updates = {};
        updates['fa-progress/' + eKey]      = null;
        updates['fa-reset-signal/' + eKey]  = { at: firebase.database.ServerValue.TIMESTAMP };
        /* players usa key name__turma — buscar por email para deletar a entrada certa */
        firebase.database().ref('players').orderByChild('email').equalTo(email).once('value', function (snap) {
          snap.forEach(function (child) { updates['players/' + child.key] = null; });
          firebase.database().ref().update(updates, function (err) {
            if (err) { alert('Erro ao resetar. Tente novamente.'); return; }
            loadCadastrados();
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
            if (!confirm('Remover ' + btn.dataset.name + ' dos administradores?')) return;
            firebase.database().ref('fa-admins/' + btn.dataset.key).remove(function () { render(); });
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
    try { return new Date(d).toLocaleDateString('pt-BR'); } catch(e) { return '—'; }
  }
})();
