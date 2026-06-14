/* ============================================================
   Força Ágil — Auth Module
   Login + Cadastro com Firebase DB · @previ.com.br only
   ============================================================ */
(function () {
  'use strict';

  var ADMIN    = ['tatianefdirene@previ.com.br', 'danielfrazao@previ.com.br']; // super-admins fixos
  var _dbAdmins = []; // admins adicionais via Firebase
  var SESS_KEY = 'fa-session';

  function hashPwd(email, pwd) {
    return btoa(unescape(encodeURIComponent(email + '::' + pwd)));
  }
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
    } catch(err) { cb && cb(false); }
  }

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

  /* Pré-carrega admins do Firebase para isAdmin() continuar síncrono */
  waitDB(function () {
    firebase.database().ref('fa-admins').on('value', function (snap) {
      var data = snap.val() || {};
      _dbAdmins = Object.values(data).map(function (p) { return (p.email || '').toLowerCase(); });
    });
  });

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

  /* Expõe hashPwd para admin.js usar ao gerar senha temporária */
  window.faHashPwd = hashPwd;

  /* ---------- Login ---------- */
  function login(email, pwd, cb) {
    email = (email || '').trim().toLowerCase();
    if (!isPrevi(email)) return cb({ error: 'Use seu e-mail @previ.com.br.' });

    waitDB(function () {
      firebase.database().ref('fa-users/' + emailKey(email)).once('value', function (snap) {
        if (!snap.exists()) return cb({ error: 'E-mail ou senha inválidos.' });
        var u = snap.val();
        if (u.passwordHash !== hashPwd(email, pwd)) return cb({ error: 'E-mail ou senha inválidos.' });
        if (u.mustChangePassword) return cb({ mustChangePassword: true, email: u.email, name: u.name, area: u.area });
        var sess = { email: u.email, name: u.name, area: u.area };
        saveSession(sess);
        _afterLogin(sess);
        cb({ success: true, user: sess });
      });
    });
  }

  /* ---------- Forçar troca de senha ---------- */
  function showForceChangePwd(email, name, area) {
    var overlay = document.createElement('div');
    overlay.id = 'forcePwdOverlay';
    overlay.className = 'force-pwd-overlay';
    overlay.innerHTML =
      '<div class="force-pwd-box">' +
        '<div class="force-pwd-icon">🔐</div>' +
        '<h3 class="force-pwd-title">Defina sua senha</h3>' +
        '<p class="force-pwd-sub">Você está usando uma senha temporária. Crie uma senha pessoal para continuar.</p>' +
        '<label class="auth-label">Nova senha' +
          '<div class="pwd-wrap"><input type="password" id="forcePwd1" placeholder="Mínimo 8 caracteres" />' +
          '<button type="button" class="pwd-eye" data-target="forcePwd1" aria-label="Mostrar senha">👁</button></div>' +
        '</label>' +
        '<label class="auth-label">Confirmar senha' +
          '<div class="pwd-wrap"><input type="password" id="forcePwd2" placeholder="Repita a senha" />' +
          '<button type="button" class="pwd-eye" data-target="forcePwd2" aria-label="Mostrar senha">👁</button></div>' +
        '</label>' +
        '<p class="auth-err" id="forcePwdErr" hidden></p>' +
        '<button class="btn btn--primary w-full" id="forcePwdBtn">Definir senha →</button>' +
      '</div>';
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    document.getElementById('forcePwdBtn').addEventListener('click', function () {
      var p1  = document.getElementById('forcePwd1').value;
      var p2  = document.getElementById('forcePwd2').value;
      var err = document.getElementById('forcePwdErr');
      err.hidden = true;
      if (p1.length < 8) { err.textContent = 'Senha deve ter mínimo 8 caracteres.'; err.hidden = false; return; }
      if (p1 !== p2)     { err.textContent = 'As senhas não coincidem.'; err.hidden = false; return; }
      var btn = document.getElementById('forcePwdBtn');
      btn.disabled = true; btn.textContent = 'Salvando…';
      firebase.database().ref('fa-users/' + emailKey(email)).update({
        passwordHash: hashPwd(email, p1),
        mustChangePassword: null
      }, function (dbErr) {
        if (dbErr) {
          btn.disabled = false; btn.textContent = 'Definir senha →';
          document.getElementById('forcePwdErr').textContent = 'Erro ao salvar. Tente novamente.';
          document.getElementById('forcePwdErr').hidden = false;
          return;
        }
        overlay.remove();
        document.body.style.overflow = '';
        var sess = { email: email, name: name, area: area };
        saveSession(sess);
        _afterLogin(sess);
      });
    });
  }

  /* ---------- Store com escopo por usuário ---------- */
  function _storePrefix() {
    var sess = getSession();
    return sess && sess.email ? 'fa-u-' + emailKey(sess.email) + '-' : '';
  }
  var _GAME_KEYS = ['fa-game-v2','fa-missions-xp','fa-kyber-done','fa-kyber-xp',
                    'fa-patente-revealed','fa-content-read','fa-content-xp','fa-repo-xp',
                    'kyber-game-v1','kyber-ranking-v1'];
  window.faStore = {
    getItem: function(k) {
      try {
        var pre = _storePrefix();
        if (!pre) return localStorage.getItem(k);
        var val = localStorage.getItem(pre + k);
        // migração: se chave com prefixo não existe mas a antiga existe, migra
        if (val === null && _GAME_KEYS.indexOf(k) !== -1) {
          var old = localStorage.getItem(k);
          if (old !== null) { localStorage.setItem(pre + k, old); return old; }
        }
        return val;
      } catch(e) { return null; }
    },
    setItem:    function(k, v) { try { localStorage.setItem(_storePrefix() + k, v); } catch(e) {} },
    removeItem: function(k) { try { localStorage.removeItem(_storePrefix() + k); } catch(e) {} }
  };

  /* ---------- Logout ---------- */
  function logout() {
    clearSession();
    try { localStorage.removeItem('fa-player'); } catch(e) {}
    // Dados de jogo ficam no localStorage com prefixo do usuário — não apagar
    // Força esconder o perfil imediatamente, sem depender de eventos
    var profileEl = document.getElementById('navProfile');
    var ctaEl     = document.getElementById('navCta');
    var adminLink = document.getElementById('navAdmin');
    if (profileEl) profileEl.hidden = true;
    if (ctaEl)     ctaEl.hidden = false;
    var guestEl2 = document.getElementById('navGuest');
    if (guestEl2)  guestEl2.hidden = false;
    if (adminLink) adminLink.hidden = true;
    updateNavState();
    window.dispatchEvent(new CustomEvent('fa-auth-change', { detail: null }));
    if (window.faRouter) window.faRouter.navigate('home');
  }

  function _afterLogin(sess) {
    try { localStorage.setItem('fa-player', JSON.stringify({ name: sess.name, area: sess.area, turma: '' })); } catch(e) {}
    updateNavState();
    // Carrega progresso do Firebase antes de disparar fa-auth-change
    if (window.faLoadProgress) {
      window.faLoadProgress(sess.email, function() {
        window.dispatchEvent(new CustomEvent('fa-auth-change', { detail: sess }));
      });
    } else {
      window.dispatchEvent(new CustomEvent('fa-auth-change', { detail: sess }));
    }
  }

  /* ---------- Nav state ---------- */
  function updateNavState() {
    var sess      = getSession();
    var ctaEl     = document.getElementById('navCta');
    var profileEl = document.getElementById('navProfile');
    var adminLink = document.getElementById('navAdmin');
    var guestEl = document.getElementById('navGuest');
    if (guestEl)   guestEl.hidden = !!sess;
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

  /* Roda imediatamente para evitar flash de estado errado */
  if (document.readyState !== 'loading') {
    updateNavState();
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
    // Não fecha ao clicar fora — evita perda de formulário preenchido
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !modal || modal.hidden) return;
      // Só fecha com Esc se nenhum campo tiver conteúdo digitado
      var inputs = modal.querySelectorAll('input');
      var hasContent = Array.prototype.some.call(inputs, function(i) { return i.value.length > 0; });
      if (!hasContent) closeModal();
    });

    /* Botão Entrar → abre modal de login */
    var navLoginBtn = document.getElementById('navLogin');
    if (navLoginBtn) navLoginBtn.addEventListener('click', function (e) {
      e.preventDefault();
      var s = getSession();
      if (s) { if (window.faRouter) window.faRouter.navigate('gamificacao'); }
      else openModal('login');
    });

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
          else if (r.mustChangePassword) { closeModal(); showForceChangePwd(r.email, r.name, r.area); }
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
    if (lo) lo.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      logout();
    });

    /* Profile div → gamificacao */
    var np = document.getElementById('navProfile');
    if (np) np.addEventListener('click', function (e) {
      if (e.target.closest('#navLogout')) return;
      e.preventDefault();
      if (window.faRouter) window.faRouter.navigate('gamificacao');
    });

    /* Esqueci minha senha — exibe painel inline */
    var fp = document.getElementById('forgotPassword');
    if (fp) fp.addEventListener('click', function (e) {
      e.preventDefault();
      var lp = document.getElementById('auth-login');
      var fgp = document.getElementById('auth-forgot');
      if (lp && fgp) { lp.hidden = true; fgp.hidden = false; clearErrs(); }
    });

    /* Painel "Esqueci" — form de solicitação */
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
      waitDB(function () {
        firebase.database().ref('fa-users/' + emailKey(email)).once('value', function (snap) {
          btn.disabled = false; btn.textContent = 'Solicitar redefinição →';
          if (!snap.exists()) { err.textContent = 'E-mail não encontrado.'; err.hidden = false; return; }
          firebase.database().ref('fa-reset-requests/' + emailKey(email)).set({
            email: email, name: snap.val().name || email, requestedAt: new Date().toISOString()
          }, function () {
            ok.textContent = 'Solicitação enviada! O administrador irá redefinir sua senha em breve.';
            ok.hidden = false;
            forgotForm.reset();
          });
        });
      });
    });

    /* Painel "Esqueci" — link voltar */
    var backToLogin = document.getElementById('backToLogin');
    if (backToLogin) backToLogin.addEventListener('click', function (e) {
      e.preventDefault();
      document.getElementById('auth-forgot').hidden = true;
      document.getElementById('auth-login').hidden = false;
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

    /* Custom select — gerência */
    var cs = document.getElementById('regAreaSelect');
    if (cs) {
      var trigger = cs.querySelector('.cs-trigger');
      var list    = cs.querySelector('.cs-list');
      var hidden  = document.getElementById('regArea');
      trigger.addEventListener('click', function(e) { e.stopPropagation(); list.classList.toggle('open'); trigger.classList.toggle('open'); });
      list.querySelectorAll('li').forEach(function(li) {
        li.addEventListener('click', function() {
          hidden.value = li.dataset.val;
          trigger.textContent = li.dataset.val;
          trigger.classList.add('selected'); trigger.classList.remove('open');
          list.classList.remove('open');
        });
      });
      document.addEventListener('click', function() { list.classList.remove('open'); trigger.classList.remove('open'); });
    }

    window.faOpenAuthModal  = openModal;
    window.faCloseAuthModal = closeModal;
  });

  window.faAuth = { getSession: getSession, isAdmin: isAdmin, isPrevi: isPrevi, isColaborador: isColaborador, register: register, login: login, logout: logout };
})();
