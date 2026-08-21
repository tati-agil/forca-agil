/* ============================================================
   Força Ágil — SPA Router (hash-based)
   ============================================================ */
(function () {
  'use strict';

  const PAGES   = ['home','turmas','conteudos','treinamento','repositorio','avaliacao','minha-area','ajuda','admin','checkin'];
  const inits   = {};
  let current = null;

  function route() {
    let h = (location.hash || '').replace(/^#\/?/, '').split('?')[0] || 'home';
    return PAGES.indexOf(h) !== -1 ? h : 'home';
  }

  function navigate(page, opts) {
    if (page === 'ranking') page = 'home';

    if (page === 'admin') {
      const s = window.faAuth && window.faAuth.getSession();
      if (!s || !window.faAuth.isAdmin(s.email)) { location.hash = '#home'; return; }
    }

    /* Access control */
    const level = window.faAuth && window.faAuth.getAccessLevel ? window.faAuth.getAccessLevel() : 'member';
    if ((page === 'conteudos' || page === 'treinamento' || page === 'avaliacao') && level === 'member') {
      location.hash = '#home';
      showAccessMsg('Disponível após confirmação em uma turma.');
      return;
    }

    location.hash = '#' + page;
    if (opts && opts.anchor) {
      setTimeout(function () {
        var el = document.getElementById(opts.anchor);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 160);
    }
  }

  function showAccessMsg(msg) {
    var existing = document.getElementById('fa-access-msg');
    if (existing) existing.remove();
    var el = document.createElement('div');
    el.id = 'fa-access-msg';
    el.style.cssText = 'position:fixed;top:72px;left:50%;transform:translateX(-50%);background:#1a2035;border:1px solid rgba(26,178,174,.4);color:#7af0e8;padding:12px 24px;border-radius:8px;font-size:.875rem;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.4)';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.remove(); }, 3500);
  }

  function show(page) {

    /* Só verifica acesso admin depois que o Firebase terminou de resolver a sessão —
       sem isso, F5 em #admin redireciona para home porque _session ainda é null. */
    if (page === 'admin' && window.faAuth && window.faAuth.isAuthReady && window.faAuth.isAuthReady()) {
      const s = window.faAuth.getSession();
      if (!s || !window.faAuth.isAdmin(s.email)) {
        page = 'home';
        history.replaceState(null, '', '#home');
      }
    }

    /* Reforça o controle de acesso também para navegação por hash direto
       (endereço digitado, link salvo, voltar/avançar do navegador) — não só
       quando o usuário clica no menu (que passa por navigate()). Só aplica
       quando a sessão já terminou de carregar, pra não expulsar por engano
       alguém legítimo enquanto o Firebase ainda está resolvendo a sessão
       (nesse caso, quem corrige é o enforceCurrentRouteAccess em auth.js). */
    if (page !== 'home' && window.faAuth && window.faAuth.isAuthReady && window.faAuth.isAuthReady()) {
      const level = window.faAuth.getAccessLevel ? window.faAuth.getAccessLevel() : 'member';
      const blocked = (page === 'conteudos' || page === 'treinamento' || page === 'avaliacao') && level !== 'enrolled';
      if (blocked) {
        page = 'home';
        history.replaceState(null, '', '#home');
      }
    }

    document.querySelectorAll('.page-section').forEach(function (el) { el.hidden = true; });

    const el = document.getElementById('page-' + page);
    if (el) {
      el.hidden = false;
      window.scrollTo({ top: 0, behavior: 'auto' });
      // Força elementos já revelados a aparecerem sem transição (evita re-trigger ao sair de display:none)
      el.querySelectorAll('.reveal').forEach(function (r) {
        r.style.transition = 'none';
        r.classList.add('in');
        // Re-habilita transição após o browser pintar o frame
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { r.style.transition = ''; });
        });
      });
    }

    document.querySelectorAll('[data-nav-page]').forEach(function (a) {
      a.classList.toggle('nav-active', a.dataset.navPage === page);
    });

    if (inits[page] && page !== current) {
      try { inits[page](); } catch (e) { console.warn('Page init error:', page, e); }
    }
    current = page;

    setTimeout(function () { window.dispatchEvent(new Event('scroll')); }, 80);
  }

  function onPageInit(page, fn) {
    inits[page] = fn;
    // If this page is already shown, run init immediately
    if (current === page) {
      try { fn(); } catch (e) { console.warn('Page init (late) error:', page, e); }
    }
  }

  window.addEventListener('hashchange', function () { show(route()); });
  document.addEventListener('DOMContentLoaded', function () { show(route()); });

  function forcarLogin() {
    var modal = document.getElementById('authModal');
    if (!modal || !modal.hidden) return;
    modal.hidden = false;
    modal.classList.add('modal-overlay--forced');
    document.body.style.overflow = 'hidden';
    var loginTab = modal.querySelector('[data-tab="login"]');
    if (loginTab) loginTab.click();
    var closeBtn = document.getElementById('authClose');
    if (closeBtn) closeBtn.style.display = 'none';
  }

  function revelarSite() {
    document.body.classList.remove('aguardando-auth');
    document.body.style.overflow = '';
    var modal = document.getElementById('authModal');
    if (modal) { modal.hidden = true; modal.classList.remove('modal-overlay--forced'); }
    var closeBtn = document.getElementById('authClose');
    if (closeBtn) closeBtn.style.display = '';
    show(route());
  }

  function mostrarMsgBloqueio() {
    var modal = document.getElementById('authModal');
    if (!modal) return;
    modal.hidden = false;
    modal.classList.add('modal-overlay--forced');
    document.body.style.overflow = 'hidden';
    document.querySelectorAll('.auth-panel').forEach(function (p) { p.hidden = true; });
    document.querySelectorAll('.auth-tab').forEach(function (t) { t.classList.remove('active'); });
    var bp = document.getElementById('auth-bloqueado');
    if (bp) bp.hidden = false;
    var closeBtn = document.getElementById('authClose');
    if (closeBtn) closeBtn.style.display = 'none';
  }

  function mostrarVerificacaoEmail(email) {
    var modal = document.getElementById('authModal');
    if (!modal) return;
    modal.hidden = false;
    modal.classList.add('modal-overlay--forced');
    document.body.style.overflow = 'hidden';
    document.querySelectorAll('.auth-panel').forEach(function (p) { p.hidden = true; });
    document.querySelectorAll('.auth-tab').forEach(function (t) { t.classList.remove('active'); });
    var vp = document.getElementById('auth-verificacao');
    if (vp) {
      vp.hidden = false;
      var dest = vp.querySelector('.verificacao-email-destino');
      if (dest) dest.textContent = email || '';
    }
    var closeBtn = document.getElementById('authClose');
    if (closeBtn) closeBtn.style.display = 'none';
  }

  /* Carga inicial: auth terminou de verificar sessão */
  var _authResolveu = false;
  window.addEventListener('fa-auth-ready', function (e) {
    _authResolveu = true;
    if (_timerSocorro) { clearTimeout(_timerSocorro); _timerSocorro = null; }
    if (!e.detail) { forcarLogin(); return; }
    if (e.detail.unverified) { mostrarVerificacaoEmail(e.detail.email); return; }
    revelarSite();
  });

  /* ══════════════════════════════════════════════════════════════════
     DIAGNÓSTICO DE CONEXÃO

     Quando a rede corporativa bloqueia o serviço, a pessoa só sabe que
     "não funciona" — o que não dá para levar à TI. Este teste diz QUAL
     endereço está barrado, em português, com o texto pronto para ser
     encaminhado a quem libera.

     Os endereços testados são os mesmos que o site já declara como
     permitidos na sua política de segurança; nenhum dado sai daqui.
     ══════════════════════════════════════════════════════════════════ */
  function diagnosticarConexao(saida, botao) {
    if (!saida) return;
    botao.disabled = true;
    botao.textContent = 'Testando…';
    saida.hidden = false;
    saida.innerHTML = '<p class="auth-diag-linha">Verificando os três endereços de que o site precisa…</p>';

    /* O SDK vem de gstatic: se não carregou, "firebase" nem existe */
    var sdkOk = (typeof firebase !== 'undefined');

    function testar(url) {
      /* no-cors: só interessa saber se a rede DEIXA sair, não a resposta */
      return Promise.race([
        fetch(url, { mode: 'no-cors', cache: 'no-store' }).then(function () { return true; }).catch(function () { return false; }),
        new Promise(function (r) { setTimeout(function () { r(false); }, 8000); })
      ]);
    }

    /* O banco de dados não conversa por requisições comuns: ele abre uma
       conexão permanente (WebSocket). Proxy corporativo costuma deixar
       passar o endereço e barrar JUSTAMENTE esse tipo de conexão — daí
       um teste de endereço dar tudo certo e o site travar mesmo assim.
       Este é o teste que separa os dois casos. */
    function testarWebSocket() {
      return new Promise(function (resolve) {
        var ws, pronto = false;
        function fim(ok) { if (!pronto) { pronto = true; try { ws && ws.close(); } catch (e) {} resolve(ok); } }
        try { ws = new WebSocket('wss://kyber-agil-default-rtdb.firebaseio.com/.ws?v=5'); }
        catch (e) { return resolve(false); }
        ws.onopen = function () { fim(true); };
        ws.onerror = function () { fim(false); };
        ws.onclose = function () { fim(false); };
        setTimeout(function () { fim(false); }, 8000);
      });
    }

    Promise.all([
      testar('https://identitytoolkit.googleapis.com/'),
      testar('https://kyber-agil-default-rtdb.firebaseio.com/.json?shallow=true'),
      testarWebSocket()
    ]).then(function (res) {
      var itens = [
        { nome: 'Carregamento do sistema', dominio: 'www.gstatic.com', ok: sdkOk },
        { nome: 'Login e senha',           dominio: 'identitytoolkit.googleapis.com', ok: res[0] },
        { nome: 'Dados do site',           dominio: 'kyber-agil-default-rtdb.firebaseio.com', ok: res[1] },
        { nome: 'Conexão permanente com o banco (WebSocket)', dominio: 'wss://kyber-agil-default-rtdb.firebaseio.com', ok: res[2] }
      ];
      var bloqueados = itens.filter(function (i) { return !i.ok; });

      var h = itens.map(function (i) {
        return '<p class="auth-diag-linha">' + (i.ok ? '✅' : '❌') + ' ' + i.nome +
               ' <span class="auth-diag-dom">' + i.dominio + '</span></p>';
      }).join('');

      if (!bloqueados.length) {
        h += '<p class="auth-diag-conc">Os três endereços responderam. Se ainda assim não entrar, ' +
             'pode ser lentidão momentânea — recarregue a página.</p>';
      } else {
        h += '<p class="auth-diag-conc">Sua rede está bloqueando ' +
             (bloqueados.length === 1 ? 'este endereço' : 'estes endereços') +
             '. Encaminhe o texto abaixo para a equipe de TI:</p>' +
             '<textarea class="auth-diag-txt" readonly rows="4">' +
             'O site forca-agil.previ.com.br precisa de acesso aos endereços abaixo, que estão bloqueados nesta rede:\n' +
             bloqueados.map(function (i) { return '- ' + i.dominio; }).join('\n') +
             '\n\nSão os servidores de autenticação e banco de dados usados pelo site.</textarea>';
      }
      saida.innerHTML = h;
      botao.disabled = false;
      botao.textContent = 'Testar de novo';
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     REDE DE SEGURANÇA — tela preta quando o Firebase não responde.

     Enquanto a autenticação não resolve, o body inteiro fica escondido
     (class "aguardando-auth"). Isso pressupõe que o Firebase SEMPRE
     responde. Quando ele não responde — rede corporativa bloqueando o
     domínio, proxy, 4G ruim, servidor fora do ar — o evento nunca
     chega, nada nunca é revelado e a pessoa fica olhando uma tela
     preta sem explicação e sem conseguir nem tentar entrar.

     Passados 10 segundos sem resposta, mostramos a tela de login assim
     mesmo, com um aviso do que está acontecendo. Se o Firebase
     responder depois, o fluxo normal segue e o aviso some.
     ══════════════════════════════════════════════════════════════════ */
  var _timerSocorro = setTimeout(function () {
    if (_authResolveu) return;
    forcarLogin();
    var modal = document.getElementById('authModal');
    if (!modal) return;
    if (document.getElementById('authSemConexao')) return;
    var aviso = document.createElement('div');
    aviso.id = 'authSemConexao';
    aviso.className = 'auth-sem-conexao';
    aviso.innerHTML =
      '<strong>Demorando para conectar</strong>' +
      'Não conseguimos falar com o servidor. Você pode tentar entrar assim mesmo — ' +
      'se não funcionar, verifique sua conexão e recarregue a página.' +
      '<button type="button" class="auth-diag-btn">Testar conexão</button>' +
      '<div class="auth-diag-saida" hidden></div>';
    var caixa = modal.querySelector('.modal-box') || modal.firstElementChild || modal;
    caixa.insertBefore(aviso, caixa.firstChild);
    aviso.querySelector('.auth-diag-btn').addEventListener('click', function () {
      diagnosticarConexao(aviso.querySelector('.auth-diag-saida'), this);
    });
  }, 10000);

  /* Login/logout em tempo real */
  window.addEventListener('fa-auth-change', function (e) {
    if (!e.detail) { forcarLogin(); return; }
    if (e.detail.blocked)    { mostrarMsgBloqueio(); return; }
    if (e.detail.unverified) { mostrarVerificacaoEmail(e.detail.email); return; }
    revelarSite();
  });

  window.faRouter = {
    navigate   : navigate,
    onPageInit : onPageInit,
    current    : function () { return current; },
    showAccessMsg: showAccessMsg
  };
})();
