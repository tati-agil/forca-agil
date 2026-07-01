/* ============================================================
   Força Ágil — Navegação assistida entre seções da Home
   ============================================================ */
(function () {
  'use strict';

  var SECTIONS = [
    { id: 'top',           label: 'Início' },
    { id: 'o-que-e',      label: 'O que é' },
    { id: 'como-funciona', label: 'Como funciona' },
    { id: 'jornada',      label: 'Jornada' },
    { id: 'cta',          label: 'Junte-se' }
  ];

  var currentIdx = 0;
  var dotBtns    = [];
  var observer   = null;
  var active     = false;

  /* ---- Helpers ---- */
  function getEl(id)   { return document.getElementById(id); }
  function sectionEls(){ return SECTIONS.map(function(s){ return getEl(s.id); }); }

  function scrollTo(idx) {
    var sections = sectionEls();
    var el = sections[idx];
    if (!el) return;
    currentIdx = idx;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    updateDots();
  }

  function updateDots() {
    dotBtns.forEach(function(btn, i) {
      btn.classList.toggle('hn-dot--active', i === currentIdx);
      btn.setAttribute('aria-current', i === currentIdx ? 'true' : 'false');
    });
  }

  /* ---- Build sidebar nav ---- */
  function buildNav() {
    if (getEl('homeNavSidebar')) return;

    var nav = document.createElement('nav');
    nav.id = 'homeNavSidebar';
    nav.setAttribute('aria-label', 'Seções da página inicial');
    nav.innerHTML = '';

    /* up arrow */
    var up = document.createElement('button');
    up.className = 'hn-arrow';
    up.setAttribute('aria-label', 'Seção anterior');
    up.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 12V4M3 9l5-5 5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    up.addEventListener('click', function() { if (currentIdx > 0) scrollTo(currentIdx - 1); });
    nav.appendChild(up);

    /* dots */
    dotBtns = [];
    SECTIONS.forEach(function(s, i) {
      var btn = document.createElement('button');
      btn.className = 'hn-dot';
      btn.setAttribute('aria-label', s.label);
      btn.setAttribute('title', s.label);
      btn.setAttribute('aria-current', 'false');
      btn.innerHTML = '<span class="hn-dot-label">' + s.label + '</span><span class="hn-dot-pip"></span>';
      btn.addEventListener('click', function() { scrollTo(i); });
      nav.appendChild(btn);
      dotBtns.push(btn);
    });

    /* down arrow */
    var down = document.createElement('button');
    down.className = 'hn-arrow';
    down.setAttribute('aria-label', 'Próxima seção');
    down.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 4v8M3 7l5 5 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    down.addEventListener('click', function() { if (currentIdx < SECTIONS.length - 1) scrollTo(currentIdx + 1); });
    nav.appendChild(down);

    document.body.appendChild(nav);
    updateDots();
  }

  function removeNav() {
    var nav = getEl('homeNavSidebar');
    if (nav) nav.remove();
    dotBtns = [];
  }

  /* ---- Continue buttons at bottom of each section ---- */
  function buildContinueButtons() {
    sectionEls().forEach(function(el, i) {
      if (!el) return;
      if (i === SECTIONS.length - 1) return; // last section: no "continue"
      if (el.querySelector('.hn-continue')) return;
      var btn = document.createElement('button');
      btn.className = 'hn-continue';
      btn.setAttribute('aria-label', 'Continuar para ' + SECTIONS[i + 1].label);
      btn.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 4v14M4 11l7 7 7-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      btn.addEventListener('click', function() { scrollTo(i + 1); });
      el.appendChild(btn);
    });
  }

  function removeContinueButtons() {
    document.querySelectorAll('.hn-continue').forEach(function(b) { b.remove(); });
  }

  /* ---- IntersectionObserver: track active section on scroll ---- */
  function initObserver() {
    if (observer) observer.disconnect();
    var sections = sectionEls().filter(Boolean);
    observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting && e.intersectionRatio >= 0.35) {
          var idx = SECTIONS.findIndex(function(s) { return s.id === e.target.id; });
          if (idx >= 0) { currentIdx = idx; updateDots(); }
        }
      });
    }, { threshold: 0.35 });
    sections.forEach(function(s) { observer.observe(s); });
  }

  /* ---- Keyboard navigation ---- */
  function onKey(e) {
    if (!active) return;
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentIdx < SECTIONS.length - 1) scrollTo(currentIdx + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentIdx > 0) scrollTo(currentIdx - 1);
    } else if (e.key === 'Enter') {
      /* Enter: advance only if no focusable element is focused */
      if (!document.activeElement || document.activeElement === document.body) {
        e.preventDefault();
        if (currentIdx < SECTIONS.length - 1) scrollTo(currentIdx + 1);
      }
    }
  }

  /* ---- Init / destroy lifecycle ---- */
  function init() {
    active = true;
    currentIdx = 0;
    buildNav();
    buildContinueButtons();
    initObserver();
  }

  function destroy() {
    active = false;
    removeNav();
    removeContinueButtons();
    if (observer) { observer.disconnect(); observer = null; }
  }

  document.addEventListener('keydown', onKey);

  /* Router integration */
  window.addEventListener('hashchange', function() {
    var page = (location.hash || '').replace(/^#\/?/, '') || 'home';
    if (page === 'home') { setTimeout(init, 80); }
    else { destroy(); }
  });

  document.addEventListener('DOMContentLoaded', function() {
    var page = (location.hash || '').replace(/^#\/?/, '') || 'home';
    if (page === 'home') init();
    window.addEventListener('fa-auth-change', function() {
      var p = (location.hash || '').replace(/^#\/?/, '') || 'home';
      if (p === 'home' && !active) init();
    });
  });

})();
