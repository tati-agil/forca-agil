/* ============================================================
   Força Ágil — Check-in por QR Code
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
    var hash = window.location.hash || '';
    var match = hash.match(/[?&]turma=([^&]+)/);
    return match ? match[1] : null;
  }

  function render(html) {
    var el = document.getElementById('checkinContent');
    if (el) el.innerHTML = html;
  }

  function doCheckin(turmaKey, sess) {
    var db  = firebase && firebase.database && firebase.database();
    if (!db) { render(msgError('Serviço indisponível.')); return; }

    var eKey    = emailKey(sess.email);
    var ref     = db.ref('turmas-interesse/' + turmaKey + '/' + eKey);
    var cfgRef  = db.ref('turmas-config/' + turmaKey + '/finalizada');

    render('<p class="loading-msg">Verificando…</p>');

    cfgRef.once('value', function (cfgSnap) {
      if (!cfgSnap.val()) {
        render(msgError('Esta turma ainda não está finalizada. O check-in será liberado no dia do evento.'));
        return;
      }
      ref.once('value', function (snap) {
        var val = snap.val();
        if (!val || val.removed) {
          render(msgError('Você não está inscrito nesta turma.'));
          return;
        }
        if (val.status === 'presente') {
          render(msgAlready(turmaKey));
          return;
        }
        if (val.status !== 'inscrito') {
          render(msgError('Seu status não permite check-in. Verifique com a organização.'));
          return;
        }
        ref.update({ status: 'presente', checkinAt: new Date().toISOString() }, function (err) {
          if (err) { render(msgError('Erro ao registrar presença. Tente novamente.')); return; }
          render(msgSuccess(turmaKey, sess.name));
        });
      });
    });
  }

  function msgSuccess(turmaKey, name) {
    return '<div class="checkin-box checkin-success">' +
      '<div class="checkin-icon">✓</div>' +
      '<h2>Presença confirmada com sucesso!</h2>' +
      '<p class="checkin-name">' + escHtml(name) + '</p>' +
      '<p class="checkin-turma">' + escHtml(TURMAS_LABELS[turmaKey] || turmaKey) + '</p>' +
    '</div>';
  }

  function msgAlready(turmaKey) {
    return '<div class="checkin-box checkin-already">' +
      '<div class="checkin-icon">✓</div>' +
      '<h2>Presença já registrada</h2>' +
      '<p class="checkin-turma">' + escHtml(TURMAS_LABELS[turmaKey] || turmaKey) + '</p>' +
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
      /* after login, retry */
      window.addEventListener('fa-auth-change', function onAuth() {
        var s = window.faAuth && window.faAuth.getSession && window.faAuth.getSession();
        if (s && window.faRouter && window.faRouter.current() === 'checkin') {
          window.removeEventListener('fa-auth-change', onAuth);
          doCheckin(turmaKey, s);
        }
      });
      /* login button */
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
