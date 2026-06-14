/* Força Ágil — Testes Automatizados de Regressão */
(function () {
  'use strict';

  var GROUPS = [
    {
      label: 'Firebase',
      tests: [
        {
          id: 'firebase-init',
          label: 'Firebase inicializado',
          run: function () {
            return typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0;
          }
        },
        {
          id: 'firebase-auth',
          label: 'Firebase Auth disponível',
          run: function () {
            return typeof firebase !== 'undefined' && typeof firebase.auth === 'function';
          }
        },
        {
          id: 'firebase-db',
          label: 'Firebase Database disponível',
          run: function () {
            return typeof firebase !== 'undefined' && typeof firebase.database === 'function';
          }
        },
        {
          id: 'firebase-db-read',
          label: 'Firebase Database acessível (leitura)',
          async: true,
          run: function () {
            return new Promise(function (resolve) {
              try {
                firebase.database().ref('fa-users').limitToFirst(1).once('value')
                  .then(function () { resolve(true); })
                  .catch(function () { resolve(false); });
                setTimeout(function () { resolve(false); }, 5000);
              } catch (e) { resolve(false); }
            });
          }
        }
      ]
    },
    {
      label: 'Autenticação',
      tests: [
        {
          id: 'auth-api',
          label: 'API faAuth disponível',
          run: function () {
            return typeof window.faAuth === 'object' && typeof window.faAuth.getSession === 'function';
          }
        },
        {
          id: 'auth-session',
          label: 'Sessão ativa (usuário logado)',
          run: function () {
            return window.faAuth && window.faAuth.getSession() !== null;
          }
        },
        {
          id: 'auth-is-admin',
          label: 'Usuário atual é admin',
          run: function () {
            return window.faAuth && window.faAuth.isAdmin() === true;
          }
        },
        {
          id: 'auth-email-previ',
          label: 'E-mail da sessão é @previ.com.br',
          run: function () {
            var s = window.faAuth && window.faAuth.getSession();
            return s && typeof s.email === 'string' && s.email.endsWith('@previ.com.br');
          }
        }
      ]
    },
    {
      label: 'Menu de Navegação',
      tests: [
        {
          id: 'menu-admin-visible',
          label: 'Link "Admin" visível para admin',
          run: function () {
            var el = document.getElementById('navAdmin');
            return el && !el.hidden && getComputedStyle(el).display !== 'none';
          }
        },
        {
          id: 'menu-profile-visible',
          label: 'Perfil do usuário visível (logado)',
          run: function () {
            var el = document.getElementById('navProfile');
            return el && !el.hidden && getComputedStyle(el).display !== 'none';
          }
        },
        {
          id: 'menu-guest-hidden',
          label: 'Botões Entrar/Cadastrar ocultos (logado)',
          run: function () {
            var el = document.getElementById('navGuest');
            return el && (el.hidden || getComputedStyle(el).display === 'none');
          }
        },
        {
          id: 'menu-logout-btn',
          label: 'Botão "Sair" presente no menu',
          run: function () {
            return !!document.getElementById('navLogout');
          }
        }
      ]
    },
    {
      label: 'Páginas',
      tests: [
        {
          id: 'page-inicio',
          label: 'Página Início: hero carregado',
          run: function () {
            return !!document.querySelector('.hero-title, .hero');
          }
        },
        {
          id: 'page-ranking',
          label: 'Página Ranking: container presente',
          run: function () {
            return !!document.getElementById('rankingPageList');
          }
        },
        {
          id: 'page-admin',
          label: 'Página Admin: painel carregado',
          run: function () {
            return !!document.getElementById('adminPanelInteresses');
          }
        },
        {
          id: 'page-hero-counter',
          label: 'Contador de agentes no hero presente',
          run: function () {
            return !!document.getElementById('heroAgentCount');
          }
        }
      ]
    },
    {
      label: 'Quiz Jedi & XP',
      tests: [
        {
          id: 'xp-store',
          label: 'faStore disponível',
          run: function () {
            return typeof window.faStore === 'object' && typeof window.faStore.getItem === 'function';
          }
        },
        {
          id: 'xp-load',
          label: 'faLoadProgress disponível',
          run: function () {
            return typeof window.faLoadProgress === 'function';
          }
        },
        {
          id: 'xp-save',
          label: 'faSaveProgress disponível',
          run: function () {
            return typeof window.faSaveProgress === 'function';
          }
        }
      ]
    },
    {
      label: 'Painel Admin',
      tests: [
        {
          id: 'admin-manual',
          label: 'faInitManual disponível',
          run: function () {
            return typeof window.faInitManual === 'function';
          }
        },
        {
          id: 'admin-mapa',
          label: 'faInitMapa disponível',
          run: function () {
            return typeof window.faInitMapa === 'function';
          }
        },
        {
          id: 'admin-tabs',
          label: 'Abas do Admin presentes (6 abas)',
          run: function () {
            return document.querySelectorAll('.admin-tab-btn').length >= 6;
          }
        },
        {
          id: 'admin-panel-manual',
          label: 'Painel Manual presente',
          run: function () {
            return !!document.getElementById('adminPanelManual');
          }
        },
        {
          id: 'admin-panel-mapa',
          label: 'Painel Mapa presente',
          run: function () {
            return !!document.getElementById('adminPanelMapa');
          }
        }
      ]
    }
  ];

  function runTests(onProgress, onDone) {
    var results = [];
    var allTests = [];
    GROUPS.forEach(function (g) {
      g.tests.forEach(function (t) {
        allTests.push({ group: g.label, test: t });
      });
    });

    var i = 0;
    function next() {
      if (i >= allTests.length) { onDone(results); return; }
      var item = allTests[i++];
      var t = item.test;
      function finish(passed, err) {
        results.push({ group: item.group, id: t.id, label: t.label, passed: passed, err: err || null });
        onProgress(results);
        setTimeout(next, 0);
      }
      try {
        if (t.async) {
          t.run().then(function (r) { finish(!!r); }).catch(function (e) { finish(false, e && e.message); });
        } else {
          finish(!!t.run());
        }
      } catch (e) {
        finish(false, e && e.message);
      }
    }
    next();
  }

  function render(container) {
    var html = '<div class="testes-wrap">';
    html += '<div class="testes-header">';
    html += '<p class="testes-desc">Verifica se os componentes essenciais estão funcionando. Execute antes de publicar alterações.</p>';
    html += '<button class="btn btn--primary" id="btnRunTestes">▶ Executar testes</button>';
    html += '</div>';
    html += '<div id="testesResultados"></div>';
    html += '</div>';
    container.innerHTML = html;

    document.getElementById('btnRunTestes').addEventListener('click', function () {
      var btn = this;
      btn.disabled = true;
      btn.textContent = '⏳ Executando…';
      var resultsEl = document.getElementById('testesResultados');
      resultsEl.innerHTML = '<p class="testes-running">Rodando testes…</p>';

      runTests(
        function (results) { renderResults(resultsEl, results, false); },
        function (results) {
          renderResults(resultsEl, results, true);
          btn.disabled = false;
          btn.textContent = '▶ Executar testes';
        }
      );
    });
  }

  function renderResults(el, results, done) {
    var passed = results.filter(function (r) { return r.passed; }).length;
    var total = results.length;
    var allPassed = done && passed === total;

    var html = '<div class="testes-summary ' + (done ? (allPassed ? 'ok' : 'fail') : 'running') + '">';
    if (done) {
      html += allPassed
        ? '✅ Todos os ' + total + ' testes passaram'
        : '❌ ' + (total - passed) + ' de ' + total + ' teste(s) falharam';
    } else {
      html += '⏳ ' + passed + ' / ' + total + ' passaram até agora…';
    }
    html += '</div>';

    /* Agrupa por grupo */
    var groups = {};
    results.forEach(function (r) {
      if (!groups[r.group]) groups[r.group] = [];
      groups[r.group].push(r);
    });

    Object.keys(groups).forEach(function (g) {
      html += '<div class="testes-group">';
      html += '<div class="testes-group-label">' + g + '</div>';
      groups[g].forEach(function (r) {
        html += '<div class="testes-row ' + (r.passed ? 'pass' : 'fail') + '">';
        html += '<span class="testes-icon">' + (r.passed ? '✅' : '❌') + '</span>';
        html += '<span class="testes-label">' + r.label + '</span>';
        if (!r.passed && r.err) html += '<span class="testes-err">' + r.err + '</span>';
        html += '</div>';
      });
      html += '</div>';
    });

    el.innerHTML = html;
  }

  window.faInitTestes = function () {
    var container = document.getElementById('adminPanelTestes');
    if (!container) return;
    render(container);
  };
})();
