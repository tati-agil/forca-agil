/* ============================================================
   Força Ágil — Auth Module
   Firebase Authentication (Email/Password) · @previ.com.br only
   ============================================================ */
(function () {
  'use strict';

  var ADMIN     = ['tatianefdirene@previ.com.br', 'danielfrazao@previ.com.br'];
  var _dbAdmins = [];
  var _session  = null;  // cache em memória — fonte de verdade: Firebase Auth
  var _authReady = false;

  /* ---- Helpers ---- */
  function emailKey(e) {
    return (e || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
  }
  function isPrevi(e) { return /^[^\s@]+@previ\.com\.br$/i.test(e || ''); }
  function isAdmin(e) {
    var em = (e || '').toLowerCase();
    return ADMIN.indexOf(em) !== -1 || _dbAdmins.indexOf(em) !== -1;
  }
  function isColaborador(e, cb) {
    var key = emailKey(e || '');
    if (!key) { cb && cb(false); return; }
    try {
      firebase.database().ref('fa-colaboradores/' + key).once('value', function (snap) { cb && cb(snap.exists()); });
    } catch (err) { cb && cb(false); }
  }
  function getSession() { return _session; }

  /* ---- Carrega admins do Firebase ---- */
  firebase.database().ref('fa-admins').on('value', function (snap) {
    var data = snap.val() || {};
    _dbAdmins = Object.values(data).map(function (p) { return (p.email || '').toLowerCase(); });
  });

  /* ---- Firebase Auth — fonte de verdade de sessão ---- */
  firebase.auth().onAuthStateChanged(function (user) {
    if (user) {
      firebase.database().ref('fa-users/' + emailKey(user.email)).once('value', function (snap) {
        var profile = snap.val() || {};
        _session = { email: user.email, name: profile.name || user.email, area: profile.area || '' };
        try { localStorage.setItem('fa-player', JSON.stringify({ name: _session.name, area: _session.area, turma: '' })); } catch (e) {}
        updateNavState();
        if (window.faLoadProgress) {
          window.faLoadProgress(_session.email, function () {
            window.dispatchEvent(new CustomEvent('fa-auth-change', { detail: _session }));
          });
        } else {
          window.dispatchEvent(new CustomEvent('fa-auth-change', { detail: _session }));
        }
      });
    } else {
      _session = null;
      try { localStorage.removeItem('fa-player'); } catch (e) {}
      updateNavState();
      if (_authReady) {
        window.dispatchEvent(new CustomEvent('fa-auth-change', { detail: null }));
      }
    }
    _authReady = true;
  });

  /* ---- Store com escopo por usuário ---- */
  function _storePrefix() {
    return _session && _session.email ? 'fa-u-' + emailKey(_session.email) + '-' : '';
  }
  var _GAME_KEYS = ['fa-game-v2', 'fa-missions-xp', 'fa-kyber-done', 'fa-kyber-xp',
                    'fa-patente-revealed', 'fa-content-read', 'fa-content-xp', 'fa-repo-xp',
                    'kyber-game-v1', 'kyber-ranking-v1'];
  window.faStore = {
    getItem: function (k) {
      try {
        var pre = _storePrefix();
        if (!pre) return localStorage.getItem(k);
        var val = localStorage.getItem(pre + k);
        if (val === null && _GAME_KEYS.indexOf(k) !== -1) {
          var old = localStorage.getItem(k);
          if (old !== null) { localStorage.setItem(pre + k, old); return old; }
        }
        return val;
      } catch (e) { return null; }
    },
    setItem:    function (k, v) { try { localStorage.setItem(_storePrefix() + k, v); } catch (e) {} },
    removeItem: function (k)    { try { localStorage.removeItem(_storePrefix() + k); } catch (e) {} }
  };

  /* ---- Cadastro ---- */
  function register(data, cb) {
    var email = (data.email || '').trim().toLowerCase();
    var pwd   = (data.password || '');
    var name  = (data.name || '').trim().toUpperCase();
    var area  = (data.area || '').trim();

    if (!isPrevi(email)) return cb({ error: 'Use seu e-mail @previ.com.br.' });
    if (pwd.length < 8)  return cb({ error: 'Senha deve ter mínimo 8 caracteres.' });
    if (!name)           return cb({ error: 'Nome completo obrigatório.' });
    if (!area)           return cb({ error: 'Área/Setor obrigatório.' });

    firebase.auth().createUserWithEmailAndPassword(email, pwd)
      .then(function () {
        return firebase.database().ref('fa-users/' + emailKey(email)).set({
          email: email, name: name, area: area,
          optinTurmas: !!data.optinTurmas,
          createdAt: new Date().toISOString()
        });
      })
      .then(function () { cb({ success: true }); })
      .catch(function (err) {
        var msg = 'Erro ao cadastrar. Tente novamente.';
        if (err.code === 'auth/email-already-in-use') msg = 'E-mail já cadastrado. Faça login.';
        if (err.code === 'auth/weak-password')        msg = 'Senha deve ter mínimo 6 caracteres.';
        if (err.code === 'auth/invalid-email')        msg = 'E-mail inválido.';
        cb({ error: msg });
      });
  }

  /* ---- Login ---- */
  function login(email, pwd, cb) {
    email = (email || '').trim().toLowerCase();
    if (!isPrevi(email)) return cb({ error: 'Use seu e-mail @previ.com.br.' });

    firebase.auth().signInWithEmailAndPassword(email, pwd)
      .then(function () { cb({ success: true }); })
      .catch(function (err) {
        var msg = 'E-mail ou senha inválidos.';
        if (err.code === 'auth/too-many-requests') msg = 'Muitas tentativas. Tente novamente mais tarde.';
        cb({ error: msg });
      });
  }

  /* ---- Logout ---- */
  function logout() {
    _session = null;
    updateNavState();
    firebase.auth().signOut().then(function () {
      window.dispatchEvent(new CustomEvent('fa-auth-change', { detail: null }));
      if (window.faRouter) window.faRouter.navigate('home');
    });
  }

  /* ---- Redefinição de senha ---- */
  function sendPasswordReset(email, cb) {
    email = (email || '').trim().toLowerCase();
    if (!isPrevi(email)) return cb({ error: 'Use seu e-mail @previ.com.br.' });
    firebase.auth().sendPasswordResetEmail(email)
      .then(function () { cb({ success: true }); })
      .catch(function (err) {
        var msg = 'Erro ao enviar. Tente novamente.';
        if (err.code === 'auth/user-not-found') msg = 'E-mail não encontrado.';
        cb({ error: msg });
      });
  }

  /* ---- Nav state ---- */
  function updateNavState() {
    var sess      = _session;
    var ctaEl     = document.getElementById('navCta');
    var profileEl = document.getElementById('navProfile');
    var adminLink = document.getElementById('navAdmin');
    var guestEl   = document.getElementById('navGuest');
    if (guestEl)   guestEl.hidden   = !!sess;
    if (ctaEl)     ctaEl.hidden     = !!sess;
    if (profileEl) {
      profileEl.hidden = !sess;
      if (sess) {
        var nameEl   = profileEl.querySelector('.nav-profile-name');
        var avatarEl = profileEl.querySelector('.nav-profile-avatar');
        if (nameEl)   nameEl.textContent   = sess.name.split(' ')[0];
        if (avatarEl) avatarEl.textContent = sess.name.charAt(0).toUpperCase();
      }
    }
    if (adminLink) adminLink.hidden = !sess || !isAdmin((sess || {}).email);
  }

  if (document.readyState !== 'loading') updateNavState();

  /* ---- Modal UI ---- */
  document.addEventListener('DOMContentLoaded', function () {
    updateNavState();
    window.addEventListener('fa-auth-change', updateNavState);

    var modal    = document.getElementById('authModal');
    var closeBtn = document.getElementById('authClose');
    var tabs     = document.querySelectorAll('.auth-tab');
    var loginErr = document.getElementById('loginErr');
    var regErr   = document.getElementById('registerErr');

    function openModal(tab) {
      if (!modal) return;
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      if (tab) switchTab(tab);
      var first = modal.querySelector('.auth-panel:not([hidden]) input');
      if (first) setTimeout(function () { first.focus(); }, 60);
    }
    function closeModal() {
      if (modal) modal.hidden = true;
      document.body.style.overflow = '';
      clearErrs();
    }
    function clearErrs() {
      [loginErr, regErr].forEach(function (el) { if (el) { el.hidden = true; el.textContent = ''; } });
      ['forgotErr', 'forgotOk'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) { el.hidden = true; el.textContent = ''; }
      });
    }
    function switchTab(name) {
      tabs.forEach(function (t) { t.classList.toggle('active', t.dataset.tab === name); });
      document.querySelectorAll('.auth-panel').forEach(function (p) { p.hidden = p.id !== 'auth-' + name; });
      clearErrs();
    }

    tabs.forEach(function (t) { t.addEventListener('click', function () { switchTab(t.dataset.tab); }); });
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !modal || modal.hidden) return;
      var inputs = modal.querySelectorAll('input');
      var hasContent = Array.prototype.some.call(inputs, function (i) { return i.value.length > 0; });
      if (!hasContent) closeModal();
    });

    /* Botão Entrar → abre modal */
    var navLoginBtn = document.getElementById('navLogin');
    if (navLoginBtn) navLoginBtn.addEventListener('click', function (e) {
      e.preventDefault();
      if (_session) { if (window.faRouter) window.faRouter.navigate('gamificacao'); }
      else openModal('login');
    });

    /* CTA buttons */
    ['navCta', 'heroJoin', 'heroRegister', 'openRegister'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        if (_session) { if (window.faRouter) window.faRouter.navigate('gamificacao'); }
        else openModal('register');
      });
    });

    /* Login form */
    var lf = document.getElementById('loginForm');
    if (lf) lf.addEventListener('submit', function (e) {
      e.preventDefault(); clearErrs();
      var btn = lf.querySelector('[type=submit]');
      btn.disabled = true; btn.textContent = 'Aguarde…';
      login(
        document.getElementById('loginEmail').value,
        document.getElementById('loginPassword').value,
        function (r) {
          btn.disabled = false; btn.textContent = 'Entrar →';
          if (r.error) { if (loginErr) { loginErr.textContent = r.error; loginErr.hidden = false; } }
          else { closeModal(); }
        }
      );
    });

    /* Register form */
    var rf = document.getElementById('registerForm');
    if (rf) rf.addEventListener('submit', function (e) {
      e.preventDefault(); clearErrs();
      var terms = document.getElementById('regTerms');
      if (terms && !terms.checked) {
        if (regErr) { regErr.textContent = 'Aceite os termos para continuar.'; regErr.hidden = false; }
        return;
      }
      var pwd    = document.getElementById('regPassword').value;
      var pwdCfm = document.getElementById('regPasswordConfirm');
      if (pwdCfm && pwdCfm.value !== pwd) {
        if (regErr) { regErr.textContent = 'As senhas não coincidem.'; regErr.hidden = false; }
        return;
      }
      var emailVal = (document.getElementById('regEmail').value || '').trim().toLowerCase();
      if (!isPrevi(emailVal)) {
        if (regErr) { regErr.textContent = 'Use seu e-mail corporativo @previ.com.br.'; regErr.hidden = false; }
        return;
      }
      var btn = rf.querySelector('[type=submit]');
      btn.disabled = true; btn.textContent = 'Aguarde…';
      register({
        name:        document.getElementById('regName').value,
        email:       emailVal,
        password:    pwd,
        area:        document.getElementById('regArea').value,
        optinTurmas: !!(document.getElementById('regOptin') && document.getElementById('regOptin').checked)
      }, function (r) {
        btn.disabled = false; btn.textContent = 'Ativar a Força →';
        if (r.error) { if (regErr) { regErr.textContent = r.error; regErr.hidden = false; } }
        else { closeModal(); }
      });
    });

    /* Logout */
    var lo = document.getElementById('navLogout');
    if (lo) lo.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      logout();
    });

    /* Profile → gamificacao */
    var np = document.getElementById('navProfile');
    if (np) np.addEventListener('click', function (e) {
      if (e.target.closest('#navLogout')) return;
      e.preventDefault();
      if (window.faRouter) window.faRouter.navigate('gamificacao');
    });

    /* Esqueci minha senha — abre painel inline */
    var fp = document.getElementById('forgotPassword');
    if (fp) fp.addEventListener('click', function (e) {
      e.preventDefault();
      var lp  = document.getElementById('auth-login');
      var fgp = document.getElementById('auth-forgot');
      if (lp && fgp) { lp.hidden = true; fgp.hidden = false; clearErrs(); }
    });

    /* Painel esqueci — envia e-mail via Firebase Auth */
    var forgotForm = document.getElementById('forgotForm');
    if (forgotForm) forgotForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = (document.getElementById('forgotEmail').value || '').trim().toLowerCase();
      var err = document.getElementById('forgotErr');
      var ok  = document.getElementById('forgotOk');
      err.hidden = true; ok.hidden = true;
      if (!isPrevi(email)) { err.textContent = 'Use seu e-mail @previ.com.br.'; err.hidden = false; return; }
      var btn = forgotForm.querySelector('[type=submit]');
      btn.disabled = true; btn.textContent = 'Aguarde…';
      sendPasswordReset(email, function (r) {
        btn.disabled = false; btn.textContent = 'Enviar link →';
        if (r.error) { err.textContent = r.error; err.hidden = false; }
        else { ok.textContent = 'Link enviado! Verifique seu e-mail para redefinir a senha.'; ok.hidden = false; forgotForm.reset(); }
      });
    });

    /* Voltar ao login */
    var backToLogin = document.getElementById('backToLogin');
    if (backToLogin) backToLogin.addEventListener('click', function (e) {
      e.preventDefault();
      document.getElementById('auth-forgot').hidden = true;
      document.getElementById('auth-login').hidden  = false;
    });

    /* Olhinho — mostrar/ocultar senha */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.pwd-eye');
      if (!btn) return;
      var input = document.getElementById(btn.dataset.target);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.textContent = input.type === 'password' ? '👁' : '🙈';
    });

    /* Switch links */
    var toLogin = document.getElementById('authToLogin');
    var toReg   = document.getElementById('authToRegister');
    if (toLogin) toLogin.addEventListener('click', function (e) { e.preventDefault(); switchTab('login'); });
    if (toReg)   toReg.addEventListener('click',   function (e) { e.preventDefault(); switchTab('register'); });

    /* Custom select — área */
    var cs = document.getElementById('regAreaSelect');
    if (cs) {
      var trigger = cs.querySelector('.cs-trigger');
      var list    = cs.querySelector('.cs-list');
      var hidden  = document.getElementById('regArea');
      trigger.addEventListener('click', function (e) { e.stopPropagation(); list.classList.toggle('open'); trigger.classList.toggle('open'); });
      list.querySelectorAll('li').forEach(function (li) {
        li.addEventListener('click', function () {
          hidden.value = li.dataset.val;
          trigger.textContent = li.dataset.val;
          trigger.classList.add('selected'); trigger.classList.remove('open');
          list.classList.remove('open');
        });
      });
      document.addEventListener('click', function () { list.classList.remove('open'); trigger.classList.remove('open'); });
    }

    window.faOpenAuthModal  = openModal;
    window.faCloseAuthModal = closeModal;
  });

  window.faAuth = {
    getSession: getSession, isAdmin: isAdmin, isPrevi: isPrevi,
    isColaborador: isColaborador, register: register, login: login,
    logout: logout, sendPasswordReset: sendPasswordReset
  };
})();
