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

  var COLAB_SEED = [
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

  function initAdmin() {
    var sess = window.faAuth && window.faAuth.getSession();
    if (!sess || !window.faAuth.isAdmin(sess.email)) return;
    loadInterests();
    loadRepoAdmin();
    loadColaboradores();
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

  /* ---- Colaboradores ---- */
  function loadColaboradores() {
    var c = document.getElementById('adminColab');
    if (!c) return;

    function render() {
      firebase.database().ref('fa-colaboradores').once('value', function (snap) {
        var data = snap.val() || {};
        var list = Object.values(data).sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'pt'); });
        c.innerHTML = '';

        /* Header */
        var hdr = document.createElement('div');
        hdr.className = 'admin-colab-header';
        hdr.innerHTML =
          '<h4>Colaboradores <span class="admin-badge">' + list.length + '</span></h4>' +
          (list.length === 0
            ? '<button class="btn btn--primary admin-seed-btn">Importar lista inicial (' + COLAB_SEED.length + ' pessoas)</button>'
            : '');
        c.appendChild(hdr);

        if (list.length === 0) {
          c.querySelector('.admin-seed-btn').addEventListener('click', function () {
            var btn = c.querySelector('.admin-seed-btn');
            btn.disabled = true; btn.textContent = 'Importando…';
            var updates = {};
            COLAB_SEED.forEach(function (p) {
              updates['fa-colaboradores/' + emailKey(p.email)] = { email: p.email, name: p.name, addedAt: new Date().toISOString() };
            });
            firebase.database().ref().update(updates, function () { render(); });
          });
          c.innerHTML += '<p class="admin-empty">Nenhum colaborador cadastrado. Use o botão acima para importar a lista inicial.</p>';
          return;
        }

        /* Tabela */
        var tbl = document.createElement('table');
        tbl.className = 'admin-table';
        tbl.innerHTML = '<thead><tr><th>Nome</th><th>E-mail</th><th>Desde</th><th></th></tr></thead>';
        var tbody = document.createElement('tbody');
        list.forEach(function (p) {
          var tr = document.createElement('tr');
          tr.innerHTML =
            '<td>' + esc(p.name || '—') + '</td>' +
            '<td>' + esc(p.email || '—') + '</td>' +
            '<td>' + fmtDate(p.addedAt) + '</td>' +
            '<td><button class="admin-del-btn" data-key="' + esc(emailKey(p.email)) + '">Remover</button></td>';
          tr.querySelector('.admin-del-btn').addEventListener('click', function (e) {
            var key = e.target.dataset.key;
            if (!confirm('Remover ' + esc(p.name || p.email) + ' dos colaboradores?')) return;
            firebase.database().ref('fa-colaboradores/' + key).remove(function () { render(); });
          });
          tbody.appendChild(tr);
        });
        tbl.appendChild(tbody);
        c.appendChild(tbl);

        /* Formulário de adição */
        var form = document.createElement('div');
        form.className = 'admin-colab-form';
        form.innerHTML =
          '<h4 style="margin-top:32px">Adicionar colaborador</h4>' +
          '<div class="admin-colab-row">' +
            '<input id="colabEmail" type="email" placeholder="e-mail" />' +
            '<input id="colabName"  type="text"  placeholder="Nome completo" />' +
            '<button class="btn btn--primary" id="colabAddBtn">Adicionar</button>' +
          '</div>' +
          '<p id="colabMsg" style="margin-top:8px;font-size:.8rem;color:var(--cyan)"></p>';
        c.appendChild(form);

        document.getElementById('colabAddBtn').addEventListener('click', function () {
          var email = (document.getElementById('colabEmail').value || '').trim().toLowerCase();
          var name  = (document.getElementById('colabName').value  || '').trim();
          var msg   = document.getElementById('colabMsg');
          if (!email || !name) { msg.textContent = 'Preencha e-mail e nome.'; return; }
          var key = emailKey(email);
          firebase.database().ref('fa-colaboradores/' + key).set(
            { email: email, name: name, addedAt: new Date().toISOString() },
            function (err) {
              if (err) { msg.textContent = 'Erro ao salvar. Tente novamente.'; return; }
              document.getElementById('colabEmail').value = '';
              document.getElementById('colabName').value  = '';
              msg.textContent = name + ' adicionado(a).';
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
