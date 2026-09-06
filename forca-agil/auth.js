/* ============================================================
   Força Ágil — Auth Module
   Firebase Authentication (Email/Password) · @previ.com.br only
   ============================================================ */
(function () {
  'use strict';

  const ADMIN     = ['tatianefdirene@previ.com.br', 'danielfrazao@previ.com.br'];
  let _dbAdmins = [];
  let _dbDiretores = [];
  let _dbFacilitadores = [];
  let _session  = null;  // cache em memória — fonte de verdade: Firebase Auth
  let _authReady = false;
  let _accessLevel = 'member'; // 'member' | 'enrolled' (guest removido — login obrigatório)
  /* criarContaPorAdmin faz login como a conta nova (efeito colateral do
     createUserWithEmailAndPassword) e depois desloga e loga de volta como
     admin — três trocas de usuário do Firebase Auth em sequência, nenhuma
     delas uma sessão real. Sem essa trava, os dois onAuthStateChanged
     abaixo processavam cada uma como se fosse de verdade: a troca para
     null no meio disparava fa-auth-change com detail null, e o listener
     do router (fa-auth-change → forcarLogin) abria o modal de login por
     cima do painel admin, fechando sozinho segundos depois quando o login
     de volta como admin terminava — a sessão de admin nunca mudou de
     verdade, só um efeito colateral visível de implementação. */
  let _criandoConta = false;

  /* ---- Helpers ---- */
  function emailKey(e) {
    return (e || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
  }
  function isPrevi(e) { return /^[^\s@]+@previ\.com\.br$/i.test(e || ''); }

  /* Todo login é @previ.com.br — preenche o domínio ao focar um campo
     vazio, com o cursor antes do @, pra só faltar digitar o nome. Não
     mexe se o campo já tiver valor (autopreenchimento do navegador
     continua funcionando normal) e limpa antes de colar, pra
     "@previ.com.br" não virar prefixo de um e-mail colado de outro
     domínio. Volta a ficar vazio no blur se ninguém digitou nada.
     Exposta em window.faAuth pra outros módulos (ex: admin.js, no
     campo de e-mail de "+ Criar conta para colaboradora", criado
     dinamicamente depois deste arquivo já ter carregado) aplicarem o
     mesmo comportamento nos próprios campos de e-mail @previ.com.br. */
  function autoPreviDominio(input) {
    if (!input) return;
    input.addEventListener('focus', function () {
      if (input.value === '') {
        input.value = '@previ.com.br';
        /* input[type=email] não suporta setSelectionRange (lança
           InvalidStateError em todo navegador) — sem o try/catch o
           cursor fica parado no fim do texto em vez de antes do @. */
        try { input.setSelectionRange(0, 0); } catch (e) { /* sem suporte neste tipo de input */ }
      }
    });
    input.addEventListener('paste', function () {
      if (input.value === '@previ.com.br') input.value = '';
    });
    input.addEventListener('blur', function () {
      if (input.value === '@previ.com.br') input.value = '';
    });
  }
  function isAdmin(e) {
    const em = (e || '').toLowerCase();
    return ADMIN.indexOf(em) !== -1 || _dbAdmins.indexOf(em) !== -1;
  }
  /* Diretor é um perfil de baixo custo, gerenciado no painel (aba Diretores) —
     não altera nível de acesso (member/enrolled) nem passa pelas regras de
     conteúdos/treinamento. Serve só para decidir se a pessoa enxerga um
     evento marcado "restritoADiretores" na página Turmas. */
  function isDiretor(e) {
    return _dbDiretores.indexOf((e || '').toLowerCase()) !== -1;
  }
  /* Facilitador é o mesmo tipo de perfil que diretor — baixo custo,
     gerenciado no painel (aba Facilitadores), não altera nível de acesso
     nem regras de conteúdos/treinamento. Dá acesso à página #facilitador
     (ver router.js), junto com admin. */
  function isFacilitador(e) {
    return _dbFacilitadores.indexOf((e || '').toLowerCase()) !== -1;
  }
  function getSession() { return _session; }
  /* Admin tem acesso a tudo, mesmo sem estar pessoalmente inscrito numa turma —
     _accessLevel continua rastreando a inscrição real da pessoa por baixo */
  function getAccessLevel() {
    if (_session && isAdmin(_session.email)) return 'enrolled';
    return _accessLevel;
  }

  var _enrolledRefs = [];

  /* Enrolled só para quem foi confirmado pelo admin (status='inscrito' + confirmedByAdmin preenchido).
     Manifestar interesse (status='interessado') não concede acesso. */
  function isInscrito(val) { return !!(val && !val.removed && val.status === 'inscrito' && val.confirmedByAdmin); }

  /* Turmas não são mais fixas (t1/t2/t3) — a lista de chaves vem de turmas/ no Firebase,
     editável pelo admin (criar/excluir turma) */
  function checkEnrolledStatus(email, cb) {
    const key = emailKey(email);
    firebase.database().ref('turmas').once('value', function (turmasSnap) {
      var turmaKeys = Object.keys(turmasSnap.val() || {});
      if (!turmaKeys.length) { cb(false); return; }
      var found = false;
      var checked = 0;
      turmaKeys.forEach(function (t) {
        firebase.database().ref('turmas-interesse/' + t + '/' + key).once('value', function (snap) {
          checked++;
          if (isInscrito(snap.val())) found = true;
          if (checked === turmaKeys.length) cb(found);
        });
      });
    });
  }

  /* Observa em tempo real (finalizar/reabrir/remover turma) — evita exigir logout/login
     para o nível de acesso (Conteúdos/Treinamento Jedi) refletir a mudança */
  function watchEnrolledStatus(email, cb) {
    stopWatchingEnrolledStatus();
    const key = emailKey(email);
    firebase.database().ref('turmas').once('value', function (turmasSnap) {
      var turmaKeys = Object.keys(turmasSnap.val() || {});
      const vals = {};
      turmaKeys.forEach(function (t) {
        const ref = firebase.database().ref('turmas-interesse/' + t + '/' + key);
        const handler = function (snap) {
          vals[t] = snap.val();
          cb(turmaKeys.some(function (tt) { return isInscrito(vals[tt]); }));
        };
        ref.on('value', handler);
        _enrolledRefs.push({ ref: ref, handler: handler });
      });
    });
  }

  function stopWatchingEnrolledStatus() {
    _enrolledRefs.forEach(function (r) { r.ref.off('value', r.handler); });
    _enrolledRefs = [];
  }

  /* Se o nível de acesso não bater com o exigido pela página atual, tira a pessoa
     de lá na hora — cobre tanto mudança em tempo real (removida de uma turma
     enquanto navegava em Conteúdos) quanto a checagem inicial, já que a página
     pode ter sido aberta direto por link/hash (#conteudos, #repositorio etc.)
     antes da sessão terminar de carregar. */
  function enforceCurrentRouteAccess() {
    if (!window.faRouter) return;
    /* getAccessLevel() devolve 'enrolled' pra admin — mas isAdmin() só
       responde a verdade depois que a leitura de fa-admins volta. Antes
       disso, um admin que não está inscrito em turma nenhuma parece
       'member' e seria expulso de Conteúdos/Treinamento com um aviso
       que nem é verdade. Espera a lista antes de decidir; quando ela
       chega, esta função roda de novo. */
    if (!_adminsResolvidos) return;
    /* E a sessão também: a lista de admins costuma chegar antes dela, e
       sem sessão o getAccessLevel() responde 'member' pra qualquer um. */
    if (!_session) return;
    const page = window.faRouter.current();
    const level = getAccessLevel();
    if (page === 'repositorio' && !level) {
      location.hash = '#home';
      if (window.faRouter.showAccessMsg) {
        window.faRouter.showAccessMsg('Faça login para acessar o Repositório.');
      }
      return;
    }
    if ((page === 'conteudos' || page === 'treinamento') && level !== 'enrolled') {
      location.hash = '#home';
      if (window.faRouter.showAccessMsg) {
        window.faRouter.showAccessMsg('Esta área não está disponível para o seu nível de acesso.');
      }
    }
  }

  /* ---- Verifica se o usuário logado é admin (lê só o próprio registro) ----
     Esta leitura corre em PARALELO à resolução da sessão, e quem não está na
     lista fixa de super-admins só vira admin quando ela termina. Enquanto
     isso, isAdmin() responde false — e isso não pode ser confundido com "não
     é admin": o router usa essa resposta para decidir se expulsa alguém de
     #admin, e chegou a jogar admin de verdade pra #home num F5, reescrevendo
     a URL. Por isso existe isAdminReady(): "já dá pra confiar no false".
     Ao resolver, dispara fa-admin-ready pra quem já decidiu antes poder
     decidir de novo (mesmo padrão de fa-diretor-ready/fa-facilitador-ready). */
  var _adminsResolvidos = false;
  firebase.auth().onAuthStateChanged(function (user) {
    if (_criandoConta) return;
    if (!user) {
      _dbAdmins = [];
      _adminsResolvidos = true;
      return;
    }
    _adminsResolvidos = false;
    firebase.database().ref('fa-admins/' + emailKey(user.email)).once('value', function (snap) {
      const data = snap.val();
      _dbAdmins = data ? [(data.email || user.email).toLowerCase()] : [];
      _adminsResolvidos = true;
      window.dispatchEvent(new CustomEvent('fa-admin-ready'));
      updateNavState();
      /* Agora que dá pra confiar no isAdmin(), refaz a checagem de rota
         que foi adiada acima: quem é admin fica onde estava, quem não é
         (e não está inscrito) sai daqui. */
      enforceCurrentRouteAccess();
    });
  });
  function isAdminReady() { return _adminsResolvidos; }

  /* ---- Verifica se o usuário logado é diretor (lê só o próprio registro) ----
     Roda em paralelo à checagem de admin, e não bloqueia nada: enquanto não
     resolve, isDiretor() responde false (evento restrito fica invisível até
     confirmar o contrário). Ao resolver, dispara fa-diretor-ready para quem
     já tiver renderizado a página Turmas antes disso re-render. */
  firebase.auth().onAuthStateChanged(function (user) {
    if (_criandoConta) return;
    if (!user) { _dbDiretores = []; return; }
    firebase.database().ref('fa-diretores/' + emailKey(user.email)).once('value', function (snap) {
      const data = snap.val();
      _dbDiretores = data ? [(data.email || user.email).toLowerCase()] : [];
      window.dispatchEvent(new CustomEvent('fa-diretor-ready'));
    });
  });

  /* ---- Verifica se o usuário logado é facilitador (lê só o próprio registro) ----
     Mesmo padrão do diretor acima, e mesma corrida em aberto que já existe
     pro admin: se a pessoa abrir #facilitador direto (F5, link salvo) antes
     desta leitura terminar, router.js não sabe ainda que ela tem acesso e
     manda pra #home — igual já acontecia pra admin cadastrado via painel
     (não os dois fixos), então não é regressão, só o mesmo limite herdado.
     Chama updateNavState() ao resolver, pra revelar o link do menu assim
     que souber que a pessoa é facilitadora, e dispara fa-facilitador-ready
     caso outro código queira reagir no futuro (mesmo padrão de
     fa-diretor-ready, hoje sem nenhum listener próprio). */
  var _facilitadoresResolvidos = false;
  firebase.auth().onAuthStateChanged(function (user) {
    if (_criandoConta) return;
    if (!user) { _dbFacilitadores = []; _facilitadoresResolvidos = true; return; }
    _facilitadoresResolvidos = false;
    firebase.database().ref('fa-facilitadores/' + emailKey(user.email)).once('value', function (snap) {
      const data = snap.val();
      _dbFacilitadores = data ? [(data.email || user.email).toLowerCase()] : [];
      _facilitadoresResolvidos = true;
      window.dispatchEvent(new CustomEvent('fa-facilitador-ready'));
      updateNavState();
    });
  });
  /* Mesmo motivo do isAdminReady: o router precisa distinguir "não é
     facilitador" de "ainda não sei se é". */
  function isFacilitadorReady() { return _facilitadoresResolvidos; }

  /* ---- Firebase Auth — fonte de verdade de sessão ---- */
  firebase.auth().onAuthStateChanged(function (user) {
    if (_criandoConta) return;
    if (user) {
      /* Esta leitura não tinha tratamento de erro: se o banco não responde
         (rede bloqueando o domínio, proxy, 4G ruim), o callback nunca é
         chamado, fa-auth-ready nunca dispara e a pessoa fica presa numa
         tela preta. Sem o perfil não dá para revelar o site com segurança,
         mas dá para dizer o que aconteceu em vez de não dizer nada. */
      firebase.database().ref('fa-users/' + emailKey(user.email)).once('value', function (snap) {
        const profile = snap.val() || {};

        /* Conta bloqueada pelo admin → desloga e avisa */
        if (profile.blocked) {
          _session = null;
          _accessLevel = 'member';
          stopWatchingEnrolledStatus();
          updateNavState();
          firebase.auth().signOut().catch(function () {});
          window.dispatchEvent(new CustomEvent('fa-auth-change', { detail: { blocked: true } }));
          _authReady = true;
          window.dispatchEvent(new CustomEvent('fa-auth-ready', { detail: null }));
          return;
        }

        /* Só exige verificação de e-mail em contas novas que têm a flag emailVerificationRequired
           (contas antigas não têm essa flag e entram normalmente; adminApproved também isenta) */
        if (!user.emailVerified && profile.emailVerificationRequired && !profile.adminApproved) {
          _session = null;
          _accessLevel = 'member';
          stopWatchingEnrolledStatus();
          updateNavState();
          window.dispatchEvent(new CustomEvent('fa-auth-change', { detail: { unverified: true, email: user.email } }));
          _authReady = true;
          window.dispatchEvent(new CustomEvent('fa-auth-ready', { detail: null }));
          return;
        }

        _session = { email: user.email, name: profile.name || user.email, area: profile.area || '' };
        try { localStorage.setItem('fa-player', JSON.stringify({ name: _session.name, area: _session.area, turma: '' })); } catch (e) {}
        _accessLevel = 'member';
        checkEnrolledStatus(user.email, function (enrolled) {
          if (enrolled) _accessLevel = 'enrolled';
          updateNavState();
          enforceCurrentRouteAccess();
          /* fa-auth-ready só dispara depois que a sessão e o nível de acesso já estão
             definidos — evita o modal de login piscando para usuários já logados */
          _authReady = true;
          window.dispatchEvent(new CustomEvent('fa-auth-ready', { detail: _session }));
          if (window.faLoadProgress) {
            window.faLoadProgress(_session.email, function () {
              window.dispatchEvent(new CustomEvent('fa-auth-change', { detail: _session }));
            });
          } else {
            window.dispatchEvent(new CustomEvent('fa-auth-change', { detail: _session }));
          }
          watchEnrolledStatus(user.email, function (enrolledNow) {
            const newLevel = enrolledNow ? 'enrolled' : 'member';
            if (newLevel === _accessLevel) return;
            _accessLevel = newLevel;
            updateNavState();
            enforceCurrentRouteAccess();
          });
        });
      }, function (err) {
        /* Falha ao ler o perfil: libera a espera avisando, em vez de
           deixar a tela preta para sempre. */
        console.error('[auth] falha ao ler perfil', err);
        _session = null;
        _accessLevel = 'member';
        _authReady = true;
        window.dispatchEvent(new CustomEvent('fa-auth-ready', { detail: null }));
      });
    } else {
      _session = null;
      _accessLevel = 'member';
      stopWatchingEnrolledStatus();
      try { localStorage.removeItem('fa-player'); } catch (e) {}
      updateNavState();
      enforceCurrentRouteAccess();
      if (_authReady) {
        window.dispatchEvent(new CustomEvent('fa-auth-change', { detail: null }));
      }
      _authReady = true;
      window.dispatchEvent(new CustomEvent('fa-auth-ready', { detail: null }));
    }
  });

  /* ---- Store com escopo por usuário ---- */
  function _storePrefix() {
    return _session && _session.email ? 'fa-u-' + emailKey(_session.email) + '-' : '';
  }
  const _GAME_KEYS = ['fa-game-v2', 'fa-missions-xp', 'fa-kyber-done', 'fa-kyber-xp',
                    'fa-patente-revealed', 'fa-patente-publicada', 'fa-content-read', 'fa-content-xp', 'fa-repo-xp',
                    'kyber-game-v1', 'kyber-ranking-v1'];
  window.faStore = {
    getItem: function (k) {
      try {
        const pre = _storePrefix();
        if (!pre) return localStorage.getItem(k);
        let val = localStorage.getItem(pre + k);
        if (val === null && _GAME_KEYS.indexOf(k) !== -1) {
          const old = localStorage.getItem(k);
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
    const email = (data.email || '').trim().toLowerCase();
    const pwd   = (data.password || '');
    const name  = (data.name || '').trim().toUpperCase();
    const area  = (data.area || '').trim();

    if (!isPrevi(email)) return cb({ error: 'Use seu e-mail @previ.com.br.' });
    if (!/^\d{8,}$/.test(pwd)) return cb({ error: 'Senha deve conter apenas números e ter mínimo 8 dígitos.' });
    if (!name)           return cb({ error: 'Nome completo obrigatório.' });
    if (!area)           return cb({ error: 'Área/Setor obrigatório.' });

    firebase.auth().createUserWithEmailAndPassword(email, pwd)
      .then(function () {
        return firebase.database().ref('fa-users/' + emailKey(email)).set({
          email: email, name: name, area: area,
          optinTurmas: !!data.optinTurmas,
          emailVerificationRequired: true,
          createdAt: new Date().toISOString()
        });
      })
      .then(function () {
        /* Envia e-mail de verificação e desloga — acesso só após confirmar */
        const u = firebase.auth().currentUser;
        return (u ? u.sendEmailVerification() : Promise.resolve())
          .catch(function () {})
          .then(function () { return firebase.auth().signOut(); })
          .then(function () { cb({ success: true, needsVerification: true }); });
      })
      .catch(function (err) {
        let msg = 'Erro ao cadastrar. Tente novamente.';
        if (err.code === 'auth/email-already-in-use') msg = 'E-mail já cadastrado. Faça login.';
        if (err.code === 'auth/weak-password')        msg = 'Senha deve ter mínimo 6 caracteres.';
        if (err.code === 'auth/invalid-email')        msg = 'E-mail inválido.';
        cb({ error: msg });
      });
  }

  /* ---- Criar conta pelo admin (sem verificação de e-mail) ---- */
  function criarContaPorAdmin(data, adminPwd, cb) {
    const email     = (data.email || '').trim().toLowerCase();
    const name      = (data.name  || '').trim().toUpperCase();
    const area      = (data.area  || '').trim();
    const adminSess = _session;

    if (!isPrevi(email)) return cb({ error: 'Use e-mail @previ.com.br.' });
    if (!name)           return cb({ error: 'Nome completo obrigatório.' });
    if (!area)           return cb({ error: 'Área/Setor obrigatório.' });
    if (!adminPwd)       return cb({ error: 'Confirme sua senha de admin.' });
    if (!adminSess)      return cb({ error: 'Sessão admin não encontrada.' });

    _criandoConta = true;
    firebase.auth().createUserWithEmailAndPassword(email, '12345678')
      .then(function () {
        return firebase.database().ref('fa-users/' + emailKey(email)).set({
          email: email, name: name, area: area,
          adminApproved: true,
          createdByAdmin: adminSess.email,
          createdAt: new Date().toISOString()
        });
      })
      .then(function () { return firebase.auth().signOut(); })
      .then(function () {
        return firebase.auth().signInWithEmailAndPassword(adminSess.email, adminPwd);
      })
      .then(function () { _criandoConta = false; cb({ success: true }); })
      .catch(function (err) {
        _criandoConta = false;
        let msg = 'Erro ao criar conta. Tente novamente.';
        if (err.code === 'auth/email-already-in-use') msg = 'E-mail já cadastrado.';
        if (err.code === 'auth/wrong-password')       msg = 'Senha de admin incorreta.';
        if (err.code === 'auth/invalid-credential')   msg = 'Senha de admin incorreta.';
        cb({ error: msg });
      });
  }

  /* ---- Reenviar e-mail de verificação ---- */
  function resendVerification(cb) {
    const u = firebase.auth().currentUser;
    if (!u) return cb({ error: 'Faça login novamente para reenviar.' });
    u.sendEmailVerification()
      .then(function () { cb({ success: true }); })
      .catch(function (err) {
        let msg = 'Erro ao reenviar. Tente novamente.';
        if (err.code === 'auth/too-many-requests') msg = 'Aguarde alguns minutos antes de reenviar.';
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
        let msg = 'E-mail ou senha inválidos.';
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
        let msg = 'Erro ao enviar. Tente novamente.';
        cb({ error: msg });
      });
  }

  /* ---- Nav state ---- */
  function updateNavState() {
    const sess      = _session;
    const level     = getAccessLevel();
    const ctaEl     = document.getElementById('navCta');
    const heroJoin  = document.getElementById('heroJoin');
    const profileEl = document.getElementById('navProfile');
    const adminLink = document.getElementById('navAdmin');
    const guestEl   = document.getElementById('navGuest');
    if (guestEl)   guestEl.hidden   = !!sess;
    if (ctaEl)     ctaEl.hidden     = !!sess;
    if (heroJoin) {
      if (sess) {
        heroJoin.textContent = 'Ver turmas →';
        heroJoin.dataset.loggedIn = '1';
      } else {
        heroJoin.textContent = 'Juntar-se à Força →';
        delete heroJoin.dataset.loggedIn;
      }
    }
    if (profileEl) {
      profileEl.hidden = !sess;
      if (sess) {
        const nameEl   = profileEl.querySelector('.nav-profile-name');
        const avatarEl = profileEl.querySelector('.nav-profile-avatar');
        if (nameEl)   nameEl.textContent   = sess.name.split(' ')[0];
        if (avatarEl) avatarEl.textContent = sess.name.charAt(0).toUpperCase();
      }
    }
    if (adminLink) adminLink.hidden = !sess || !isAdmin((sess || {}).email);

    /* Nav links visibility by access level */
    document.querySelectorAll('.nav-link-member').forEach(function (el) {
      el.hidden = false;
    });
    document.querySelectorAll('.nav-link-enrolled').forEach(function (el) {
      el.hidden = (level !== 'enrolled');
    });
    document.querySelectorAll('.nav-link-facilitador').forEach(function (el) {
      el.hidden = !sess || !(isAdmin(sess.email) || isFacilitador(sess.email));
    });
  }

  if (document.readyState !== 'loading') updateNavState();

  /* ---- Modal UI ---- */
  document.addEventListener('DOMContentLoaded', function () {
    updateNavState();
    window.addEventListener('fa-auth-change', updateNavState);
    window.addEventListener('fa-progress-change', updateNavState);

    const modal    = document.getElementById('authModal');
    const closeBtn = document.getElementById('authClose');
    const tabs     = document.querySelectorAll('.auth-tab');
    const loginErr = document.getElementById('loginErr');
    const regErr   = document.getElementById('registerErr');

    ['loginEmail', 'regEmail', 'forgotEmail'].forEach(function (id) {
      autoPreviDominio(document.getElementById(id));
    });

    function openModal(tab) {
      if (!modal) return;
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      if (tab) switchTab(tab);
      const first = modal.querySelector('.auth-panel:not([hidden]) input');
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
        const el = document.getElementById(id);
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
      /* Modal forçado (login obrigatório, sem sessão) não pode fechar de
         jeito nenhum — o CSS esconde tudo, exceto #authModal, enquanto
         "aguardando-auth" está na página, então fechar aqui deixava a
         visitante numa tela preta sem nada pra clicar. */
      if (modal.classList.contains('modal-overlay--forced')) return;
      const inputs = modal.querySelectorAll('input');
      const hasContent = Array.prototype.some.call(inputs, function (i) { return i.value.length > 0; });
      if (!hasContent) closeModal();
    });

    /* Botão Entrar → abre modal */
    const navLoginBtn = document.getElementById('navLogin');
    if (navLoginBtn) navLoginBtn.addEventListener('click', function (e) {
      e.preventDefault();
      if (_session) { if (window.faRouter) window.faRouter.navigate('treinamento'); }
      else openModal('login');
    });

    /* CTA buttons */
    ['navCta', 'heroRegister', 'openRegister'].forEach(function (id) {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        if (_session) { if (window.faRouter) window.faRouter.navigate('treinamento'); }
        else openModal('register');
      });
    });

    /* heroJoin: "Juntar-se à Força" (deslogado) ou "Ver turmas" (logado) */
    const heroJoinBtn = document.getElementById('heroJoin');
    if (heroJoinBtn) {
      heroJoinBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (_session) { if (window.faRouter) window.faRouter.navigate('turmas'); }
        else openModal('register');
      });
    }

    const ctaLoginBtn = document.getElementById('ctaLogin');
    if (ctaLoginBtn) {
      ctaLoginBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (_session) { if (window.faRouter) window.faRouter.navigate('treinamento'); }
        else openModal('login');
      });
    }

    /* Login form */
    const lf = document.getElementById('loginForm');
    if (lf) lf.addEventListener('submit', function (e) {
      e.preventDefault(); clearErrs();
      const btn = lf.querySelector('[type=submit]');
      btn.disabled = true; btn.textContent = 'Aguarde…';
      login(
        document.getElementById('loginEmail').value,
        document.getElementById('loginPassword').value,
        function (r) {
          btn.disabled = false; btn.textContent = 'Entrar →';
          if (r.error) { if (loginErr) { loginErr.textContent = r.error; loginErr.hidden = false; } }
          else {
            /* O fa-auth-change cuida do painel de verificação se necessário */
            closeModal();
          }
        }
      );
    });

    /* Register form */
    const rf = document.getElementById('registerForm');
    if (rf) rf.addEventListener('submit', function (e) {
      e.preventDefault(); clearErrs();
      const terms = document.getElementById('regTerms');
      if (terms && !terms.checked) {
        if (regErr) { regErr.textContent = 'Aceite os termos para continuar.'; regErr.hidden = false; }
        return;
      }
      const pwd    = document.getElementById('regPassword').value;
      const pwdCfm = document.getElementById('regPasswordConfirm');
      if (pwdCfm && pwdCfm.value !== pwd) {
        if (regErr) { regErr.textContent = 'As senhas não coincidem.'; regErr.hidden = false; }
        return;
      }
      const emailVal = (document.getElementById('regEmail').value || '').trim().toLowerCase();
      if (!isPrevi(emailVal)) {
        if (regErr) { regErr.textContent = 'Use seu e-mail corporativo @previ.com.br.'; regErr.hidden = false; }
        return;
      }
      const btn = rf.querySelector('[type=submit]');
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
        else if (r.needsVerification) {
          /* Exibe painel de verificação de e-mail */
          document.querySelectorAll('.auth-panel').forEach(function (p) { p.hidden = true; });
          var vp = document.getElementById('auth-verificacao');
          if (vp) {
            vp.hidden = false;
            var dest = vp.querySelector('.verificacao-email-destino');
            if (dest) dest.textContent = emailVal;
          }
        } else { closeModal(); }
      });
    });

    /* Logout */
    const lo = document.getElementById('navLogout');
    if (lo) lo.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      logout();
    });

    /* Profile → treinamento */
    const np = document.getElementById('navProfile');
    if (np) np.addEventListener('click', function (e) {
      if (e.target.closest('#navLogout')) return;
      e.preventDefault();
      if (window.faRouter) window.faRouter.navigate('treinamento');
    });

    /* Esqueci minha senha — abre painel inline */
    const fp = document.getElementById('forgotPassword');
    if (fp) fp.addEventListener('click', function (e) {
      e.preventDefault();
      const lp  = document.getElementById('auth-login');
      const fgp = document.getElementById('auth-forgot');
      if (lp && fgp) { lp.hidden = true; fgp.hidden = false; clearErrs(); }
    });

    /* Painel esqueci — envia e-mail via Firebase Auth */
    const forgotForm = document.getElementById('forgotForm');
    if (forgotForm) forgotForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const email = (document.getElementById('forgotEmail').value || '').trim().toLowerCase();
      const err = document.getElementById('forgotErr');
      const ok  = document.getElementById('forgotOk');
      err.hidden = true; ok.hidden = true;
      if (!isPrevi(email)) { err.textContent = 'Use seu e-mail @previ.com.br.'; err.hidden = false; return; }
      const btn = forgotForm.querySelector('[type=submit]');
      btn.disabled = true; btn.textContent = 'Aguarde…';
      sendPasswordReset(email, function (r) {
        btn.disabled = false; btn.textContent = 'Enviar link →';
        if (r.error) { err.textContent = r.error; err.hidden = false; }
        else { ok.textContent = 'Se este e-mail estiver cadastrado, você receberá o link de redefinição em breve.'; ok.hidden = false; forgotForm.reset(); }
      });
    });

    /* Voltar ao login */
    const backToLogin = document.getElementById('backToLogin');
    if (backToLogin) backToLogin.addEventListener('click', function (e) {
      e.preventDefault();
      document.getElementById('auth-forgot').hidden = true;
      document.getElementById('auth-login').hidden  = false;
    });

    /* Painel de verificação de e-mail */
    const reenviarBtn = document.getElementById('reenviarVerificacao');
    if (reenviarBtn) reenviarBtn.addEventListener('click', function () {
      const errEl = document.getElementById('verificacaoErr');
      const okEl  = document.getElementById('verificacaoOk');
      if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
      if (okEl)  { okEl.hidden  = true; okEl.textContent  = ''; }
      reenviarBtn.disabled = true; reenviarBtn.textContent = 'Aguarde…';
      resendVerification(function (r) {
        reenviarBtn.disabled = false; reenviarBtn.textContent = 'Reenviar e-mail →';
        if (r.error) { if (errEl) { errEl.textContent = r.error; errEl.hidden = false; } }
        else { if (okEl) { okEl.textContent = 'E-mail reenviado! Verifique sua caixa de entrada.'; okEl.hidden = false; } }
      });
    });

    const verificacaoVoltar = document.getElementById('verificacaoVoltar');
    if (verificacaoVoltar) verificacaoVoltar.addEventListener('click', function (e) {
      e.preventDefault();
      firebase.auth().signOut().catch(function () {});
      document.querySelectorAll('.auth-panel').forEach(function (p) { p.hidden = true; });
      document.getElementById('auth-login').hidden = false;
      var loginTab = document.querySelector('.auth-tab[data-tab="login"]');
      if (loginTab) { document.querySelectorAll('.auth-tab').forEach(function (t) { t.classList.remove('active'); }); loginTab.classList.add('active'); }
    });

    /* Olhinho — mostrar/ocultar senha */
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('.pwd-eye');
      if (!btn) return;
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.textContent = input.type === 'password' ? '👁' : '🙈';
    });

    /* Switch links */
    const toLogin = document.getElementById('authToLogin');
    const toReg   = document.getElementById('authToRegister');
    if (toLogin) toLogin.addEventListener('click', function (e) { e.preventDefault(); switchTab('login'); });
    if (toReg)   toReg.addEventListener('click',   function (e) { e.preventDefault(); switchTab('register'); });

    /* Custom select — área */
    const cs = document.getElementById('regAreaSelect');
    if (cs) {
      const trigger   = cs.querySelector('.cs-trigger');
      const list      = cs.querySelector('.cs-list');
      const hidden    = document.getElementById('regArea');
      const searchInput = cs.querySelector('.cs-search');

      function openList() { list.classList.add('open'); trigger.classList.add('open'); if (searchInput) { searchInput.value = ''; filterItems(''); searchInput.focus(); } }
      function closeList() { list.classList.remove('open'); trigger.classList.remove('open'); }

      function filterItems(q) {
        const term = q.toLowerCase();
        list.querySelectorAll('li[data-val]').forEach(function (li) {
          if (!li.dataset.val) return; /* linha de busca */
          li.style.display = li.dataset.val.toLowerCase().includes(term) ? '' : 'none';
        });
      }

      trigger.addEventListener('click', function (e) { e.stopPropagation(); list.classList.contains('open') ? closeList() : openList(); });

      const searchWrap = cs.querySelector('.cs-search-wrap');
      if (searchWrap) searchWrap.addEventListener('click', function (e) { e.stopPropagation(); });

      if (searchInput) {
        searchInput.addEventListener('input', function () { filterItems(searchInput.value); });
        searchInput.addEventListener('click', function (e) { e.stopPropagation(); });
      }

      list.querySelectorAll('li[data-val]').forEach(function (li) {
        if (!li.dataset.val) return;
        li.addEventListener('click', function () {
          hidden.value = li.dataset.val;
          trigger.textContent = li.dataset.val;
          trigger.classList.add('selected'); closeList();
        });
      });

      document.addEventListener('click', function () { closeList(); });
    }

    window.faOpenAuthModal  = openModal;
    window.faCloseAuthModal = closeModal;
  });

  window.faAuth = {
    getSession: getSession, isAdmin: isAdmin, isDiretor: isDiretor, isFacilitador: isFacilitador, isPrevi: isPrevi,
    register: register, login: login,
    logout: logout, sendPasswordReset: sendPasswordReset,
    getAccessLevel: getAccessLevel,
    criarContaPorAdmin: criarContaPorAdmin,
    resendVerification: resendVerification,
    isAuthReady: function () { return _authReady; },
    isAdminReady: isAdminReady,
    isFacilitadorReady: isFacilitadorReady,
    autoPreviDominio: autoPreviDominio
  };
})();
