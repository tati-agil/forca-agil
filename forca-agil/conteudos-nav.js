/* ============================================================
   Força Ágil — Navegação lateral para página Conteúdos
   Reutiliza estilos .hn-* do home-nav
   ============================================================ */
(function () {
  'use strict';

  var SECTIONS = [
    { id: 'content-galaxia',    label: '01 · Mapa da Galáxia' },
    { id: 'content-forca',      label: '02 · Os 4 Valores' },
    { id: 'content-principios', label: '03 · Os 12 Princípios' },
    { id: 'content-yoda',       label: '04 · A Força do Ágil' },
    { id: 'content-arquetipos', label: '05 · Personagens' },
    { id: 'content-sombrio',    label: '06 · Lado Sombrio' },
    { id: 'content-trilogia',   label: '07 · A Trilogia' },
  ];

  var NAV_ID    = 'conteudosNavSidebar';
  var currentIdx = 0;
  var dotBtns    = [];
  var observer   = null;
  var active     = false;

  function getEl(id) { return document.getElementById(id); }

  function scrollTo(idx) {
    var el = getEl(SECTIONS[idx].id);
    if (!el) return;
    currentIdx = idx;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    updateDots();
  }

  function updateDots() {
    dotBtns.forEach(function (btn, i) {
      btn.classList.toggle('hn-dot--active', i === currentIdx);
      btn.setAttribute('aria-current', i === currentIdx ? 'true' : 'false');
    });
  }

  function buildContinueButtons() {
    SECTIONS.forEach(function (s, i) {
      if (i === SECTIONS.length - 1) return;
      var el = getEl(s.id);
      if (!el || el.querySelector('.hn-continue')) return;
      var btn = document.createElement('button');
      btn.className = 'hn-continue';
      btn.setAttribute('aria-label', 'Continuar para ' + SECTIONS[i + 1].label);
      btn.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 4v14M4 11l7 7 7-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      btn.addEventListener('click', function () { scrollTo(i + 1); });
      el.appendChild(btn);
    });
  }

  function removeContinueButtons() {
    SECTIONS.forEach(function (s) {
      var el = getEl(s.id);
      if (el) el.querySelectorAll('.hn-continue').forEach(function (b) { b.remove(); });
    });
  }

  function enableSnapScroll() {
    document.documentElement.style.scrollSnapType = 'y mandatory';
    SECTIONS.forEach(function (s) {
      var el = getEl(s.id);
      if (el) el.style.scrollSnapAlign = 'start';
    });
  }

  function disableSnapScroll() {
    document.documentElement.style.scrollSnapType = '';
    SECTIONS.forEach(function (s) {
      var el = getEl(s.id);
      if (el) el.style.scrollSnapAlign = '';
    });
  }

  function buildNav() {
    if (getEl(NAV_ID)) return;

    var nav = document.createElement('nav');
    nav.id = NAV_ID;
    nav.className = 'hn-sidebar';
    nav.setAttribute('aria-label', 'Seções de conteúdo');

    var up = document.createElement('button');
    up.className = 'hn-arrow';
    up.setAttribute('aria-label', 'Seção anterior');
    up.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 12V4M3 9l5-5 5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    up.addEventListener('click', function () { if (currentIdx > 0) scrollTo(currentIdx - 1); });
    nav.appendChild(up);

    dotBtns = [];
    SECTIONS.forEach(function (s, i) {
      var btn = document.createElement('button');
      btn.className = 'hn-dot';
      btn.setAttribute('aria-label', s.label);
      btn.setAttribute('title', s.label);
      btn.setAttribute('aria-current', 'false');
      btn.innerHTML = '<span class="hn-dot-label">' + s.label + '</span><span class="hn-dot-pip"></span>';
      btn.addEventListener('click', function () { scrollTo(i); });
      nav.appendChild(btn);
      dotBtns.push(btn);
    });

    var down = document.createElement('button');
    down.className = 'hn-arrow';
    down.setAttribute('aria-label', 'Próxima seção');
    down.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 4v8M3 7l5 5 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    down.addEventListener('click', function () { if (currentIdx < SECTIONS.length - 1) scrollTo(currentIdx + 1); });
    nav.appendChild(down);

    document.body.appendChild(nav);
    updateDots();
  }

  function removeNav() {
    var nav = getEl(NAV_ID);
    if (nav) nav.remove();
    dotBtns = [];
  }

  function initObserver() {
    if (observer) observer.disconnect();
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && e.intersectionRatio >= 0.2) {
          var idx = SECTIONS.findIndex(function (s) { return s.id === e.target.id; });
          if (idx >= 0) { currentIdx = idx; updateDots(); }
        }
      });
    }, { threshold: 0.2 });
    SECTIONS.forEach(function (s) {
      var el = getEl(s.id);
      if (el) observer.observe(el);
    });
  }

  function init() {
    active = true;
    currentIdx = 0;
    buildNav();
    buildContinueButtons();
    enableSnapScroll();
    initObserver();
  }

  function destroy() {
    active = false;
    removeNav();
    removeContinueButtons();
    disableSnapScroll();
    if (observer) { observer.disconnect(); observer = null; }
  }

  function onRoute() {
    var page = (location.hash || '').replace(/^#\/?/, '') || 'home';
    if (page === 'conteudos') { if (!active) init(); }
    else { if (active) destroy(); }
  }

  window.addEventListener('hashchange', onRoute);
  document.addEventListener('DOMContentLoaded', onRoute);

})();
