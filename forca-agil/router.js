/* ============================================================
   Força Ágil — SPA Router (hash-based)
   ============================================================ */
(function () {
  'use strict';

  const PAGES   = ['home','turmas','conteudos','treinamento','repositorio','ajuda','admin','checkin'];
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
    const level = window.faAuth && window.faAuth.getAccessLevel ? window.faAuth.getAccessLevel() : 'guest';
    if (page === 'repositorio' && level === 'guest') {
      location.hash = '#home';
      showAccessMsg('Faça login para acessar o Repositório.');
      return;
    }
    if ((page === 'conteudos' || page === 'treinamento') && level === 'guest') {
      location.hash = '#home';
      showAccessMsg('Faça login para acessar esta área.');
      return;
    }
    if ((page === 'conteudos' || page === 'treinamento') && level === 'member') {
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

    if (page === 'admin') {
      const s = window.faAuth && window.faAuth.getSession();
      if (!s || !window.faAuth.isAdmin(s.email)) {
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

  window.faRouter = {
    navigate   : navigate,
    onPageInit : onPageInit,
    current    : function () { return current; },
    showAccessMsg: showAccessMsg
  };
})();
