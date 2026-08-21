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

    /* Chegou aqui depois de o site ter limpado uma sessão presa: explica
       por que está pedindo login de novo, senão parece que "deslogou
       sozinho" — e some do caminho na próxima vez. */
    var limpou = false;
    try { limpou = sessionStorage.getItem('fa-sessao-limpa') === '1'; } catch (e) {}
    if (limpou && !document.getElementById('authSessaoLimpa')) {
      try { sessionStorage.removeItem('fa-sessao-limpa'); } catch (e) {}
      var nota = document.createElement('div');
      nota.id = 'authSessaoLimpa';
      nota.className = 'auth-sem-conexao';
      nota.innerHTML = '<strong>Entre novamente</strong>' +
        'Sua sessão anterior não pôde ser renovada nesta rede, então ela foi encerrada. ' +
        'É só entrar de novo — nada do seu histórico foi perdido.';
      var cx = modal.querySelector('.modal-box') || modal.firstElementChild || modal;
      cx.insertBefore(nota, cx.firstChild);
    }
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
  /* Quanto tempo cada peça levou para carregar. Os arquivos do Firebase vêm
     de fora do site (gstatic); num proxy que inspeciona tráfego, baixá-los
     pode levar mais tempo do que o site inteiro. */
  function medirTempos() {
    var linhas = [];
    function seg(ms) { return (Math.round(ms / 100) / 10).toString().replace('.', ',') + 's'; }

    try {
      var recursos = performance.getEntriesByType('resource') || [];
      var deFora = recursos.filter(function (r) { return r.name.indexOf('gstatic.com') !== -1; });
      if (deFora.length) {
        var maisLento = deFora.reduce(function (a, b) { return a.duration > b.duration ? a : b; });
        var somaFora = deFora.reduce(function (s, r) { return s + r.duration; }, 0);
        linhas.push(['Baixar o sistema (arquivos externos)', seg(somaFora) +
          ' — ' + deFora.length + ' arquivo' + (deFora.length !== 1 ? 's' : '') +
          ', o mais lento levou ' + seg(maisLento.duration)]);
      }
      var doSite = recursos.filter(function (r) { return r.name.indexOf(location.host) !== -1; });
      if (doSite.length) {
        var somaSite = doSite.reduce(function (s, r) { return s + r.duration; }, 0);
        linhas.push(['Baixar o site em si', seg(somaSite) + ' — ' + doSite.length + ' arquivos']);
      }
      var nav = (performance.getEntriesByType('navigation') || [])[0];
      if (nav) linhas.push(['Página pronta', seg(nav.domContentLoadedEventEnd)]);
    } catch (e) { /* navegador sem essas medições — segue sem elas */ }

    linhas.push(['Tempo até este teste', seg(performance.now())]);
    linhas.push(['Servidor respondeu a autenticação?', _authResolveu ? 'sim' : 'ainda não']);

    /* Estado interno: se o sistema carregou mas não foi inicializado, ou se
       existe sessão guardada esperando renovação, o travamento é aqui e não
       na rede. */
    try {
      var temApp = (typeof firebase !== 'undefined' && firebase.apps) ? firebase.apps.length : 0;
      linhas.push(['Sistema iniciado', temApp ? 'sim' : 'NÃO — o site não conseguiu iniciar o Firebase']);
      if (temApp && firebase.auth) {
        var u = firebase.auth().currentUser;
        linhas.push(['Sessão guardada neste navegador', u ? ('sim — ' + u.email) : 'nenhuma']);
      }
    } catch (e) {
      linhas.push(['Sistema iniciado', 'erro ao verificar: ' + (e.message || e)]);
    }

    var erros = (window.__faErros || []);
    if (erros.length) {
      linhas.push(['Erros do site', erros.length + ' — listados abaixo']);
    } else {
      linhas.push(['Erros do site', 'nenhum']);
    }

    var h = linhas.map(function (l) {
      return '<p class="auth-diag-linha">⏱ ' + l[0] + '<span class="auth-diag-dom">' + l[1] + '</span></p>';
    }).join('');

    if (erros.length) {
      h += '<textarea class="auth-diag-txt" readonly rows="4">' +
           erros.slice(0, 6).map(function (e) {
             return '[' + e.tipo + '] ' + e.msg + (e.onde ? '  (' + e.onde + ')' : '');
           }).join('\n') + '</textarea>';
    }
    return h;
  }

  /* O Firebase guarda a sessão no armazenamento do navegador. Se esse
     armazenamento estiver bloqueado por política da máquina, ou travar sem
     dar erro, a verificação de quem está logado NUNCA termina — os
     endereços respondem, a rede está boa, e mesmo assim o site não sai da
     espera. É o padrão que estamos vendo. */
  function testarArmazenamento() {
    var resultados = [];

    try {
      localStorage.setItem('__fa_teste', '1');
      localStorage.removeItem('__fa_teste');
      resultados.push(['Memória do navegador (localStorage)', true, 'disponível']);
    } catch (e) {
      resultados.push(['Memória do navegador (localStorage)', false, 'bloqueado: ' + (e.name || 'erro')]);
    }

    resultados.push(['Cookies', !!navigator.cookieEnabled, navigator.cookieEnabled ? 'habilitados' : 'desabilitados']);

    return new Promise(function (resolve) {
      if (!window.indexedDB) {
        resultados.push(['Banco local (IndexedDB)', false, 'não existe neste navegador']);
        return resolve(resultados);
      }
      var respondeu = false;
      function fim(ok, obs) {
        if (respondeu) return;
        respondeu = true;
        resultados.push(['Banco local (IndexedDB)', ok, obs]);
        resolve(resultados);
      }
      try {
        var req = indexedDB.open('__fa_teste', 1);
        req.onsuccess = function () { try { req.result.close(); indexedDB.deleteDatabase('__fa_teste'); } catch (e) {} fim(true, 'disponível'); };
        req.onerror   = function () { fim(false, 'bloqueado'); };
        req.onblocked = function () { fim(false, 'travado'); };
        /* Travar sem responder é o caso mais perigoso: não dá erro nenhum */
        setTimeout(function () { fim(false, 'não respondeu em 5s — travado'); }, 5000);
      } catch (e) {
        fim(false, 'bloqueado: ' + (e.name || 'erro'));
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     SESSÃO PRESA — limpar e entrar de novo.

     Confirmado em campo: dentro da rede da Previ, quem já tinha sessão
     guardada trava; em janela anônima o site abre normalmente; e quem
     limpa os cookies passa a conseguir entrar. Ou seja, a sessão
     guardada não consegue ser renovada e a espera nunca termina.

     Isto apaga o que o Firebase guarda deste site — a sessão e mais
     nada. Não mexe em dado do servidor: a pessoa só precisa entrar de
     novo. É o mesmo que "limpar os cookies", só que restrito ao que
     interessa e sem a pessoa precisar saber fazer.
     ══════════════════════════════════════════════════════════════════ */
  function limparArmazenamentoAuth() {
    try { if (typeof firebase !== 'undefined' && firebase.auth) firebase.auth().signOut(); } catch (e) {}
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf('firebase:') === 0 || k.indexOf('firebaseLocalStorage') !== -1) localStorage.removeItem(k);
      });
    } catch (e) {}
    try {
      Object.keys(sessionStorage).forEach(function (k) {
        if (k.indexOf('firebase:') === 0) sessionStorage.removeItem(k);
      });
    } catch (e) {}
    try { indexedDB.deleteDatabase('firebaseLocalStorageDb'); } catch (e) {}
  }

  function limparSessaoPresa(botao) {
    if (botao) { botao.disabled = true; botao.textContent = 'Limpando…'; }
    limparArmazenamentoAuth();
    try { sessionStorage.setItem('fa-sessao-limpa', '1'); } catch (e) {}
    /* Pequena folga para o navegador concluir as remoções antes de recarregar */
    setTimeout(function () { location.reload(); }, 500);
  }

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
      /* Endereço SEPARADO, usado para renovar a sessão de quem já está
         logado. Se ele estiver barrado e o outro não, quem nunca entrou
         consegue usar o site e quem já tinha sessão fica travado — que é
         exatamente o quadro observado. */
      testar('https://securetoken.googleapis.com/'),
      testar('https://kyber-agil-default-rtdb.firebaseio.com/.json?shallow=true'),
      testarWebSocket()
    ]).then(function (res) {
      var itens = [
        { nome: 'Carregamento do sistema', dominio: 'www.gstatic.com', ok: sdkOk },
        { nome: 'Login e senha',           dominio: 'identitytoolkit.googleapis.com', ok: res[0] },
        { nome: 'Renovar sessão de quem já entrou', dominio: 'securetoken.googleapis.com', ok: res[1] },
        { nome: 'Dados do site',           dominio: 'kyber-agil-default-rtdb.firebaseio.com', ok: res[2] },
        { nome: 'Conexão permanente com o banco (WebSocket)', dominio: 'wss://kyber-agil-default-rtdb.firebaseio.com', ok: res[3] }
      ];
      var bloqueados = itens.filter(function (i) { return !i.ok; });

      var h = itens.map(function (i) {
        return '<p class="auth-diag-linha">' + (i.ok ? '✅' : '❌') + ' ' + i.nome +
               ' <span class="auth-diag-dom">' + i.dominio + '</span></p>';
      }).join('');

      if (!bloqueados.length) {
        /* Nada bloqueado e o site travou assim mesmo → o problema é tempo,
           não acesso. Mostra quanto demorou cada peça, que é o que permite
           dizer se a lentidão está em baixar o sistema ou em conversar com
           o servidor. */
        h += '<p class="auth-diag-conc">Nenhum endereço está bloqueado. ' +
             'Veja quanto tempo cada parte levou:</p>';
        h += medirTempos();
        h += '<p class="auth-diag-conc">E se o navegador deixa o site guardar a sessão:</p>' +
             '<div class="auth-diag-armaz">verificando…</div>';
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

      var alvo = saida.querySelector('.auth-diag-armaz');
      if (alvo) {
        testarArmazenamento().then(function (res) {
          var bloq = res.filter(function (r) { return !r[1]; });
          alvo.innerHTML = res.map(function (r) {
            return '<p class="auth-diag-linha">' + (r[1] ? '✅' : '❌') + ' ' + r[0] +
                   '<span class="auth-diag-dom">' + r[2] + '</span></p>';
          }).join('') + (bloq.length
            ? '<p class="auth-diag-conc">É esta a causa: sem poder guardar a sessão, o site não consegue ' +
              'confirmar quem você é e fica esperando para sempre. Costuma ser política de segurança da máquina ' +
              'ou do navegador. Encaminhe para a TI:</p>' +
              '<textarea class="auth-diag-txt" readonly rows="4">' +
              'No site forca-agil.previ.com.br, o navegador está impedindo o armazenamento local, o que trava o login.\n' +
              'Itens bloqueados: ' + bloq.map(function (r) { return r[0]; }).join(', ') + '\n' +
              'Navegador: ' + navigator.userAgent + '\n' +
              'Pedido: permitir armazenamento local (cookies, localStorage e IndexedDB) para este endereço.</textarea>'
            : '<p class="auth-diag-conc">O armazenamento está liberado. Se mesmo assim não entrar, ' +
              'me avise com esta tela — a causa está em outro ponto.</p>');
        });
      }
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

    /* Primeira vez que trava: limpa a sessão presa e recarrega sozinho.
       A pessoa não precisa saber que existe "limpar cookies" — o site se
       recupera e mostra a tela de login normalmente. Só faz isso UMA vez
       por aba: se travar de novo depois de limpo, o problema é outro e
       aí mostramos o aviso e o diagnóstico em vez de recarregar em laço. */
    var jaTentou = false;
    try { jaTentou = sessionStorage.getItem('fa-sessao-limpa') === '1'; } catch (e) {}
    if (!jaTentou) {
      var temSessaoGuardada = false;
      try {
        temSessaoGuardada = Object.keys(localStorage).some(function (k) { return k.indexOf('firebase:') === 0; });
      } catch (e) {}
      /* Sem sessão guardada não há o que limpar — cair no aviso é mais útil */
      if (temSessaoGuardada) { limparSessaoPresa(null); return; }
    }

    forcarLogin();
    var modal = document.getElementById('authModal');
    if (!modal) return;
    if (document.getElementById('authSemConexao')) return;
    var aviso = document.createElement('div');
    aviso.id = 'authSemConexao';
    aviso.className = 'auth-sem-conexao';
    aviso.innerHTML =
      '<strong>Não conseguimos retomar sua sessão</strong>' +
      'Isso costuma acontecer quando a sessão guardada neste navegador não pôde ser ' +
      'renovada — em rede corporativa é comum. O caminho mais rápido é limpar essa ' +
      'sessão e entrar de novo.' +
      '<div class="auth-diag-acoes">' +
        '<button type="button" class="auth-limpar-btn">Limpar sessão e entrar de novo</button>' +
        '<button type="button" class="auth-diag-btn">Testar conexão</button>' +
      '</div>' +
      '<div class="auth-diag-saida" hidden></div>';
    var caixa = modal.querySelector('.modal-box') || modal.firstElementChild || modal;
    caixa.insertBefore(aviso, caixa.firstChild);
    aviso.querySelector('.auth-diag-btn').addEventListener('click', function () {
      diagnosticarConexao(aviso.querySelector('.auth-diag-saida'), this);
    });
    aviso.querySelector('.auth-limpar-btn').addEventListener('click', function () {
      limparSessaoPresa(this);
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
