/* ============================================================
   Força Ágil — Check-in por QR Code (por dia)
   ============================================================ */
(function () {
  'use strict';

  const TURMAS_LABELS = {
    t1: 'Turma 1 — Agosto (11·12·18·19·20)',
    t2: 'Turma 2 — Setembro (09·10·11·15·16)',
    t3: 'Turma 3 — Novembro (17·18·19·24·25)'
  };

  function emailKey(e) {
    return (e || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
  }

  function getTurmaFromHash() {
    var hash  = window.location.hash || '';
    var match = hash.match(/[?&]turma=([^&]+)/);
    return match ? match[1] : null;
  }

  function render(html) {
    var el = document.getElementById('checkinContent');
    if (el) el.innerHTML = html;
  }

  function doCheckin(turmaKey, sess) {
    var db   = firebase && firebase.database && firebase.database();
    if (!db) { render(msgError('Serviço indisponível.')); return; }

    var eKey    = emailKey(sess.email);
    var cfgRef  = db.ref('turmas-config/' + turmaKey);
    var inscRef = db.ref('turmas-interesse/' + turmaKey + '/' + eKey);

    render('<p class="loading-msg">Verificando…</p>');

    cfgRef.once('value', function (cfgSnap) {
      var cfg = cfgSnap.val() || {};

      if (!cfg.finalizada) {
        render(msgError('Esta turma ainda não teve as inscrições finalizadas.'));
        return;
      }
      if (!cfg.diaAtivo) {
        render(msgError('O check-in não está aberto no momento. Aguarde a organização abrir o check-in do dia.'));
        return;
      }

      var diaAtivo = cfg.diaAtivo;

      inscRef.once('value', function (snap) {
        var val = snap.val();
        if (!val || val.removed || val.status !== 'inscrito') {
          render(msgError('Você não está inscrita nesta turma.'));
          return;
        }

        /* verifica se já fez check-in neste dia */
        db.ref('turmas-checkin/' + turmaKey + '/' + diaAtivo + '/' + eKey).once('value', function (ckSnap) {
          if (ckSnap.val()) {
            render(msgAlready(turmaKey, diaAtivo));
            return;
          }

          /* registra check-in */
          db.ref('turmas-checkin/' + turmaKey + '/' + diaAtivo + '/' + eKey).set({
            name: sess.name, email: sess.email, area: sess.area || '',
            checkinAt: new Date().toISOString(), source: 'qr'
          }, function (err) {
            if (err) { render(msgError('Erro ao registrar presença. Tente novamente.')); return; }
            render(msgSuccess(turmaKey, diaAtivo, sess.name));
          });
        });
      });
    });
  }

  function fmtDia(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function msgSuccess(turmaKey, dia, name) {
    return '<div class="checkin-box checkin-success">' +
      '<div class="checkin-icon">✓</div>' +
      '<h2>Presença confirmada com sucesso!</h2>' +
      '<p class="checkin-name">' + escHtml(name) + '</p>' +
      '<p class="checkin-turma">' + escHtml(TURMAS_LABELS[turmaKey] || turmaKey) + '</p>' +
      '<p class="checkin-dia">Dia: ' + fmtDia(dia) + '</p>' +
    '</div>';
  }

  function msgAlready(turmaKey, dia) {
    return '<div class="checkin-box checkin-already">' +
      '<div class="checkin-icon">✓</div>' +
      '<h2>Presença já registrada</h2>' +
      '<p class="checkin-turma">' + escHtml(TURMAS_LABELS[turmaKey] || turmaKey) + '</p>' +
      '<p class="checkin-dia">Dia: ' + fmtDia(dia) + '</p>' +
    '</div>';
  }

  function msgError(msg) {
    return '<div class="checkin-box checkin-error">' +
      '<div class="checkin-icon">!</div>' +
      '<p>' + escHtml(msg) + '</p>' +
      '<button class="btn btn--primary" onclick="faRouter&&faRouter.navigate(\'home\')">Voltar ao início</button>' +
    '</div>';
  }

  function msgLogin(turmaKey) {
    return '<div class="checkin-box">' +
      '<h2>Check-in — ' + escHtml(TURMAS_LABELS[turmaKey] || turmaKey) + '</h2>' +
      '<p>Faça login para registrar sua presença.</p>' +
      '<button class="btn btn--primary" id="checkinLoginBtn">Entrar</button>' +
    '</div>';
  }

  function escHtml(s) {
    return String(s || '').replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function initCheckin() {
    var turmaKey = getTurmaFromHash();
    if (!turmaKey || !TURMAS_LABELS[turmaKey]) {
      render(msgError('QR Code inválido ou turma não encontrada.'));
      return;
    }

    var sess = window.faAuth && window.faAuth.getSession && window.faAuth.getSession();
    if (!sess) {
      render(msgLogin(turmaKey));
      window.addEventListener('fa-auth-change', function onAuth() {
        var s = window.faAuth && window.faAuth.getSession && window.faAuth.getSession();
        if (s && window.faRouter && window.faRouter.current() === 'checkin') {
          window.removeEventListener('fa-auth-change', onAuth);
          doCheckin(turmaKey, s);
        }
      });
      document.addEventListener('click', function onBtn(e) {
        if (e.target && e.target.id === 'checkinLoginBtn') {
          document.removeEventListener('click', onBtn);
          if (window.faOpenAuthModal) window.faOpenAuthModal('login');
        }
      });
      return;
    }

    doCheckin(turmaKey, sess);
  }

  if (window.faRouter) {
    window.faRouter.onPageInit('checkin', initCheckin);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      window.faRouter && window.faRouter.onPageInit('checkin', initCheckin);
    });
  }
})();
