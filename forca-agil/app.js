/* ============================================================
   Força Ágil — App UI interactions
   Nav, reveals, crawl, accordions, anchor navigation
   ============================================================ */
(function () {

  /* ---- Nav scroll + mobile toggle ---- */
  var nav    = document.querySelector('.nav');
  var onScr  = function () { nav && nav.classList.toggle('scrolled', window.scrollY > 40); };
  onScr();
  addEventListener('scroll', onScr, { passive: true });

  var toggle = document.querySelector('.nav-toggle');
  var links  = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () { links.classList.toggle('open'); });
    links.querySelectorAll('a, button').forEach(function (el) {
      el.addEventListener('click', function () { links.classList.remove('open'); });
    });
  }

  /* ---- Reveal on scroll (rAF-less scroll event, ultra-reliable) ---- */
  var reveals = [];
  function collectReveals() { reveals = Array.from(document.querySelectorAll('.reveal:not(.in)')); }
  function revealInView() {
    var vh = innerHeight || document.documentElement.clientHeight;
    for (var i = 0; i < reveals.length; i++) {
      var el = reveals[i];
      if (el.classList.contains('in')) continue;
      var r = el.getBoundingClientRect();
      if (r.top < vh * 1.05 && r.bottom > -80) el.classList.add('in');
    }
  }
  document.addEventListener('DOMContentLoaded', function () { collectReveals(); revealInView(); });
  addEventListener('scroll',  revealInView, { passive: true });
  addEventListener('resize',  revealInView);
  addEventListener('load', function () { collectReveals(); revealInView(); });
  /* Re-collect when a new page section becomes visible */
  window.addEventListener('hashchange', function () {
    setTimeout(function () { collectReveals(); revealInView(); }, 120);
  });

  /* ---- Opening crawl ---- */
  document.addEventListener('DOMContentLoaded', function () {
    var crawl   = document.querySelector('.crawl-content');
    var replay  = document.querySelector('.crawl-replay');
    var reduce  = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (crawl && !reduce) {
      var startCrawl = function () { crawl.classList.remove('run'); void crawl.offsetWidth; crawl.classList.add('run'); };
      var crawlIO = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { startCrawl(); crawlIO.disconnect(); } });
      }, { threshold: 0.4 });
      var cs = document.querySelector('.crawl-section');
      if (cs) crawlIO.observe(cs);
      if (replay) replay.addEventListener('click', startCrawl);
    } else if (replay) {
      replay.style.display = 'none';
    }
  });

  /* ---- Agenda accordions ---- */
  document.addEventListener('click', function (e) {
    var h = e.target.closest('.day-head');
    if (h) h.parentElement.classList.toggle('open');
  });

  /* ---- Yoda episode accordions ---- */
  document.addEventListener('click', function (e) {
    var h = e.target.closest('.yep-head');
    if (h) h.parentElement.classList.toggle('open');
  });

  /* ---- Nav anchor links (Ranking → gamificacao + scroll to leaderboard) ---- */
  document.addEventListener('click', function (e) {
    var link = e.target.closest('[data-anchor]');
    if (!link || !link.dataset.anchor) return;
    e.preventDefault();
    var page   = link.dataset.navPage || 'gamificacao';
    var anchor = link.dataset.anchor;
    if (window.faRouter) window.faRouter.navigate(page, { anchor: anchor });
  });

  /* ---- Hero entrance failsafe ---- */
  addEventListener('load', function () {
    setTimeout(function () {
      document.querySelectorAll('.hero-kicker,.hero-sub,.hero-meta,.hero-actions,.scroll-cue,.hero-title span')
        .forEach(function (el) { el.style.opacity = '1'; });
    }, 1400);
  });

  /* ---- "Conhecer a iniciativa" scroll ---- */
  document.addEventListener('DOMContentLoaded', function () {
    var knowBtn = document.getElementById('heroKnow');
    if (knowBtn) knowBtn.addEventListener('click', function (e) {
      e.preventDefault();
      var target = document.getElementById('o-que-e');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  /* ---- Content XP tracking (conteúdos page) ---- */
  var CONTENT_SECTIONS = ['galaxia','forca','arquetipos','sombrio','trilogia'];
  var XP_PER_SECTION   = 5;

  function initContentTracking() {
    var sess = window.faAuth && window.faAuth.getSession();
    if (!sess) return;

    var read = [];
    try { read = JSON.parse(localStorage.getItem('fa-content-read') || '[]'); } catch(e) {}

    CONTENT_SECTIONS.forEach(function (id) {
      var el = document.getElementById('content-' + id);
      if (!el) return;

      /* Mark already-read badge */
      var badge = document.getElementById('xp-badge-' + id);
      if (read.indexOf(id) !== -1) {
        if (badge) { badge.textContent = '✓ +' + XP_PER_SECTION + ' XP'; badge.classList.add('visible'); }
        return;
      }

      /* Observe for first read — requires 10s visible before awarding XP */
      var readTimer = null;
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            if (readTimer) return;
            readTimer = setTimeout(function () {
              obs.disconnect();
              read.push(id);
              try { localStorage.setItem('fa-content-read', JSON.stringify(read)); } catch(e2) {}
              var cur = parseInt(localStorage.getItem('fa-content-xp') || '0', 10) || 0;
              try { localStorage.setItem('fa-content-xp', String(cur + XP_PER_SECTION)); } catch(e3) {}
              if (window.faSyncPlayer) window.faSyncPlayer();
              if (badge) {
                badge.textContent = '✓ +' + XP_PER_SECTION + ' XP';
                badge.classList.add('visible');
              }
            }, 10000);
          } else {
            clearTimeout(readTimer);
            readTimer = null;
          }
        });
      }, { threshold: 0.6 });
      obs.observe(el);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (window.faRouter) {
      window.faRouter.onPageInit('conteudos', initContentTracking);
    }
    /* Also wire auth-change: if user logs in while on conteúdos, start tracking */
    window.addEventListener('fa-auth-change', function () {
      if (window.faRouter && window.faRouter.current() === 'conteudos') initContentTracking();
    });
  });

  /* ---- Turma interest buttons ---- */
  document.addEventListener('DOMContentLoaded', function () {
    function initTurmaInterest() {
      document.querySelectorAll('.btn--interest').forEach(function (btn) {
        var turmaKey = btn.dataset.turma;
        if (!turmaKey) return;

        /* Check if already registered */
        var sess = window.faAuth && window.faAuth.getSession();
        if (sess) checkInterestState(btn, turmaKey, sess.email);

        btn.addEventListener('click', function () {
          var s = window.faAuth && window.faAuth.getSession();
          if (!s) { if (window.faOpenAuthModal) window.faOpenAuthModal('register'); return; }
          registerInterest(btn, turmaKey, s);
        });
      });
    }

    function checkInterestState(btn, turmaKey, email) {
      var key = emailKey(email);
      firebase && firebase.database &&
        firebase.database().ref('turmas-interesse/' + turmaKey + '/' + key).once('value', function (snap) {
          if (snap.exists()) setDone(btn, turmaKey);
        });
    }

    function registerInterest(btn, turmaKey, sess) {
      if (btn.classList.contains('done')) return;
      var key   = emailKey(sess.email);
      var entry = { name: sess.name, email: sess.email, area: sess.area || '', date: new Date().toISOString() };
      firebase.database().ref('turmas-interesse/' + turmaKey + '/' + key).set(entry, function (err) {
        if (!err) setDone(btn, turmaKey);
        else showMsg(turmaKey, 'Erro ao registrar. Tente novamente.');
      });
    }

    function setDone(btn, turmaKey) {
      btn.textContent = '✓ Interesse registrado';
      btn.classList.add('done');
      btn.disabled = true;
      showMsg(turmaKey, 'Sua intenção foi registrada! Usaremos para dimensionar as turmas.');
    }

    function showMsg(turmaKey, msg) {
      var el = document.getElementById('intent-msg-' + turmaKey);
      if (el) el.textContent = msg;
    }

    function emailKey(e) {
      return (e || '').toLowerCase().replace(/[@.]/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64);
    }

    if (window.faRouter) window.faRouter.onPageInit('turmas', initTurmaInterest);
    window.addEventListener('fa-auth-change', function () {
      if (window.faRouter && window.faRouter.current() === 'turmas') initTurmaInterest();
    });
  });

})();
