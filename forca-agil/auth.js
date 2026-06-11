/* ============================================================
   Força Ágil — Auth Module
   Login + Cadastro com Firebase DB · @previ.com.br only
   ============================================================ */
(function () {
  'use strict';

  var ADMIN    = ['tatianefdirene@previ.com.br', 'danilfrazao@previ.com.br'];
  var SESS_KEY = 'fa-session';

  function hashPwd(email, pwd) {
    return btoa(unescape(encodeURIComponent(email + '::' + pwd)));
  }
  function emailKey(e) {
    return (e || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
  }
  function isPrevi(e) { return /^[^\s@]+@previ\.com\.br$/i.test(e || ''); }
  function isAdmin(e) { return ADMIN.indexOf((e || '').toLowerCase()) !== -1; }

  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESS_KEY) || 'null'); } catch(e) { return null; }
  }
  function saveSession(u)  { try { localStorage.setItem(SESS_KEY, JSON.stringify(u)); } catch(e) {} }
  function clearSession()  { try { localStorage.removeItem(SESS_KEY); } catch(e) {} }

  function waitDB(cb, n) {
    n = n || 0;
    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) return cb();
    if (n > 80) return cb(new Error('Firebase timeout'));
    setTimeout(function () { waitDB(cb, n + 1); }, 200);
  }

  /* ---------- Register ---------- */
  var _registering = false;
  function register(data, cb) {
    if (_registering) return;
    _registering = true;
    var email = (data.email || '').trim().toLowerCase();
    var pwd   = (data.password || '');
    var name  = (data.name || '').trim().toUpperCase();
    var area  = (data.area || '').trim();

    if (!isPrevi(email))  return cb({ error: 'Use seu e-mail @previ.com.br.' });
    if (pwd.length < 8)   return cb({ error: 'Senha deve ter mínimo 8 caracteres.' });
    if (!name)            return cb({ error: 'Nome completo obrigatório.' });
    if (!area)            return cb({ error: 'Área/Setor obrigatório.' });

    waitDB(function () {
      var ref = firebase.database().ref('fa-users/' + emailKey(email));
      ref.once('value', function (snap) {
        if (snap.exists()) { _registering = false; return cb({ error: 'E-mail já cadastrado. Faça login.' }); }
        var user = {
          email: email, name: name, area: area,
          passwordHash: hashPwd(email, pwd),
          optinTurmas: !!data.optinTurmas,
          createdAt: new Date().toISOString()
        };
        ref.set(user, function (err) {
          _registering = false;
          if (err) return cb({ error: 'Erro no servidor. Tente novamente.' });
          var sess = { email: email, name: name, area: area };
          saveSession(sess);
          _afterLogin(sess);
          cb({ success: true, user: sess });
        });
      });
    });
  }

  /* ---------- Login ---------- */
  function login(email, pwd, cb) {
    email = (email || '').trim().toLowerCase();
    if (!isPrevi(email)) return cb({ error: 'Use seu e-mail @previ.com.br.' });

    waitDB(function () {
      firebase.database().ref('fa-users/' + emailKey(email)).once('value', function (snap) {
        if (!snap.exists()) return cb({ error: 'E-mail não encontrado. Faça seu cadastro.' });
        var u = snap.val();
        if (u.passwordHash !== hashPwd(email, pwd)) return cb({ error: 'Senha incorreta.' });
        var sess = { email: u.email, name: u.name, area: u.area };
        saveSession(sess);
        _afterLogin(sess);
        cb({ success: true, user: sess });
      });
    });
  }

  /* ---------- Logout ---------- */
  function logout() {
    clearSession();
    try { localStorage.removeItem('fa-player'); } catch(e) {}
    // Força esconder o perfil imediatamente, sem depender de eventos
    var profileEl = document.getElementById('navProfile');
    var ctaEl     = document.getElementById('navCta');
    var adminLink = document.getElementById('navAdmin');
    if (profileEl) profileEl.hidden = true;
    if (ctaEl)     ctaEl.hidden = false;
    if (adminLink) adminLink.hidden = true;
    updateNavState();
    window.dispatchEvent(new CustomEvent('fa-auth-change', { detail: null }));
    if (window.faRouter) window.faRouter.navigate('home');
  }

  function _afterLogin(sess) {
    try { localStorage.setItem('fa-player', JSON.stringify({ name: sess.name, area: sess.area, turma: '' })); } catch(e) {}
    updateNavState();
    window.dispatchEvent(new CustomEvent('fa-auth-change', { detail: sess }));
  }

  /* ---------- Nav state ---------- */
  function updateNavState() {
    var sess      = getSession();
    var ctaEl     = document.getElementById('navCta');
    var profileEl = document.getElementById('navProfile');
    var adminLink = document.getElementById('navAdmin');
    if (ctaEl)     ctaEl.hidden = !!sess;
    if (profileEl) {
      profileEl.hidden = !sess;
      if (sess) {
        var nameEl = profileEl.querySelector('.nav-profile-name');
        if (nameEl) nameEl.textContent = sess.name.split(' ')[0];
        var avatarEl = profileEl.querySelector('.nav-profile-avatar');
        if (avatarEl) avatarEl.textContent = sess.name.charAt(0).toUpperCase();
      }
    }
    if (adminLink) adminLink.hidden = !sess || !isAdmin((sess || {}).email);
  }

  /* ---------- Modal UI ---------- */
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
    }
    function switchTab(name) {
      tabs.forEach(function (t) { t.classList.toggle('active', t.dataset.tab === name); });
      document.querySelectorAll('.auth-panel').forEach(function (p) {
        p.hidden = p.id !== 'auth-' + name;
      });
      clearErrs();
    }

    tabs.forEach(function (t) { t.addEventListener('click', function () { switchTab(t.dataset.tab); }); });
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal && !modal.hidden) closeModal(); });

    /* CTA buttons → open register or go to game */
    ['navCta', 'heroJoin', 'heroRegister', 'openRegister'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var s = getSession();
        if (s) {
          if (window.faRouter) window.faRouter.navigate('gamificacao');
        } else {
          openModal('register');
        }
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
        else { closeModal(); /* fica na página atual — não redireciona */ }
      });
    });

    /* Logout */
    var lo = document.getElementById('navLogout');
    if (lo) lo.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); logout(); });

    /* Profile div → gamificacao */
    var np = document.getElementById('navProfile');
    if (np) np.addEventListener('click', function (e) {
      if (!e.target.closest('#navLogout')) {
        e.preventDefault();
        if (window.faRouter) window.faRouter.navigate('gamificacao');
      }
    });

    /* Forgot password */
    var fp = document.getElementById('forgotPassword');
    if (fp) fp.addEventListener('click', function (e) {
      e.preventDefault();
      alert('Para redefinir sua senha, entre em contato:\ntatianefdirene@previ.com.br');
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

    /* Switch link: "já tenho conta" / "criar conta" */
    var toLogin = document.getElementById('authToLogin');
    var toReg   = document.getElementById('authToRegister');
    if (toLogin) toLogin.addEventListener('click', function (e) { e.preventDefault(); switchTab('login'); });
    if (toReg)   toReg.addEventListener('click',   function (e) { e.preventDefault(); switchTab('register'); });

    window.faOpenAuthModal  = openModal;
    window.faCloseAuthModal = closeModal;
  });

  window.faAuth = { getSession: getSession, isAdmin: isAdmin, isPrevi: isPrevi, register: register, login: login, logout: logout };
})();
