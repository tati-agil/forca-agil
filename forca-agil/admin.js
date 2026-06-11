/* ============================================================
   Força Ágil — Admin Module
   Área restrita: tatianefdirene@previ.com.br | danilfrazao@previ.com.br
   ============================================================ */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    if (window.faRouter) window.faRouter.onPageInit('admin', initAdmin);
    // Tab switching inside admin
    document.querySelectorAll('.admin-tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = btn.dataset.panel;
        document.querySelectorAll('.admin-tab-btn').forEach(function (b) { b.classList.remove('active'); });
        document.querySelectorAll('.admin-tab-panel').forEach(function (p) { p.classList.remove('active'); });
        btn.classList.add('active');
        var panel = document.getElementById(target);
        if (panel) panel.classList.add('active');
      });
    });
  });

  function initAdmin() {
    var sess = window.faAuth && window.faAuth.getSession();
    if (!sess || !window.faAuth.isAdmin(sess.email)) return;
    loadInterests();
    loadRepoAdmin();
  }

  /* ---- Interested per turma ---- */
  function loadInterests() {
    var c = document.getElementById('adminInterests');
    if (!c) return;
    c.innerHTML = '<p class="loading-msg">Carregando dados…</p>';

    firebase.database().ref('turmas-interesse').once('value', function (snap) {
      var data = snap.val() || {};
      c.innerHTML = '';

      var TURMAS = [
        { key: 't1', label: 'Turma 1 — Agosto (11·12·18·19·20)' },
        { key: 't2', label: 'Turma 2 — Setembro (09·10·11·15·16)' },
        { key: 't3', label: 'Turma 3 — Novembro (17·18·19·24·25)' }
      ];

      TURMAS.forEach(function (t) {
        var records = data[t.key] ? Object.values(data[t.key]) : [];
        var section = document.createElement('div');
        section.className = 'admin-section';
        section.innerHTML = '<h4>' + t.label + ' <span class="admin-badge">' + records.length + '</span></h4>';

        if (!records.length) {
          section.innerHTML += '<p class="admin-empty">Nenhum interesse registrado.</p>';
        } else {
          var tbl = '<table class="admin-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Área</th><th>Data</th></tr></thead><tbody>';
          records.forEach(function (r) {
            tbl += '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.email) + '</td><td>' + esc(r.area || '—') + '</td><td>' + fmtDate(r.date) + '</td></tr>';
          });
          tbl += '</tbody></table>';
          section.innerHTML += tbl;
        }
        c.appendChild(section);
      });
    });
  }

  /* ---- Repo items for admin ---- */
  function loadRepoAdmin() {
    var c = document.getElementById('adminRepo');
    if (!c) return;
    c.innerHTML = '<p class="loading-msg">Carregando repositório…</p>';

    firebase.database().ref('holocron').once('value', function (snap) {
      var data    = snap.val() || {};
      var entries = Object.entries(data);
      c.innerHTML = '';

      if (!entries.length) {
        c.innerHTML = '<p class="admin-empty">Repositório vazio.</p>';
        return;
      }

      var h4 = document.createElement('h4');
      h4.innerHTML = 'Itens no Repositório <span class="admin-badge">' + entries.length + '</span>';
      c.appendChild(h4);

      entries.forEach(function (e) {
        var key = e[0], item = e[1];
        var row = document.createElement('div');
        row.className = 'admin-repo-row';
        row.innerHTML =
          '<div class="admin-repo-info">' +
            '<span class="admin-repo-title">' + esc(item.title || '—') + '</span>' +
            '<span class="admin-repo-by">' + esc(item.authorName || '—') +
              (item.createdAt ? ' · ' + fmtDate(item.createdAt) : '') +
            '</span>' +
          '</div>' +
          '<button class="admin-del-btn" data-key="' + esc(key) + '">Deletar</button>';
        row.querySelector('.admin-del-btn').addEventListener('click', function () {
          if (!confirm('Deletar "' + esc(item.title || '') + '" do repositório?')) return;
          firebase.database().ref('holocron/' + key).remove(function (err) {
            if (!err) row.remove();
            else alert('Erro ao deletar. Tente novamente.');
          });
        });
        c.appendChild(row);
      });
    });
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
