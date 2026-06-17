/* ============================================================
   Força Ágil — App UI interactions
   Nav, reveals, crawl, accordions, anchor navigation
   ============================================================ */
(function () {

  /* ---- Nav scroll + mobile toggle ---- */
  const nav    = document.querySelector('.nav');
  const onScr  = function () { nav && nav.classList.toggle('scrolled', window.scrollY > 40); };
  onScr();
  addEventListener('scroll', onScr, { passive: true });

  const toggle = document.querySelector('.nav-toggle');
  const links  = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () { links.classList.toggle('open'); });
    links.querySelectorAll('a, button').forEach(function (el) {
      el.addEventListener('click', function () { links.classList.remove('open'); });
    });
  }

  /* ---- Reveal on scroll (rAF-less scroll event, ultra-reliable) ---- */
  let reveals = [];
  function collectReveals() { reveals = Array.from(document.querySelectorAll('.reveal:not(.in)')); }
  function revealInView() {
    const vh = innerHeight || document.documentElement.clientHeight;
    for (let i = 0; i < reveals.length; i++) {
      const el = reveals[i];
      if (el.classList.contains('in')) continue;
      const r = el.getBoundingClientRect();
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
    const crawl   = document.querySelector('.crawl-content');
    const replay  = document.querySelector('.crawl-replay');
    const reduce  = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (crawl && !reduce) {
      const startCrawl = function () { crawl.classList.remove('run'); void crawl.offsetWidth; crawl.classList.add('run'); };
      const crawlIO = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { startCrawl(); crawlIO.disconnect(); } });
      }, { threshold: 0.4 });
      const cs = document.querySelector('.crawl-section');
      if (cs) crawlIO.observe(cs);
      if (replay) replay.addEventListener('click', startCrawl);
    } else if (replay) {
      replay.style.display = 'none';
    }
  });

  /* ---- Agenda accordions — só colaboradores e admins podem expandir ---- */
  function updateAgendaAccess() {
    const agenda = document.querySelector('.agenda');
    if (!agenda) return;
    const sess = window.faAuth && window.faAuth.getSession();
    if (!sess) { agenda.classList.remove('agenda--unlocked'); return; }
    const isAdmin = window.faAuth.isAdmin && window.faAuth.isAdmin(sess.email);
    if (isAdmin) { agenda.classList.add('agenda--unlocked'); return; }
    window.faAuth.isColaborador(sess.email, function (ok) {
      agenda.classList.toggle('agenda--unlocked', ok);
    });
  }
  updateAgendaAccess();
  window.addEventListener('fa-auth-change', updateAgendaAccess);

  document.addEventListener('click', function (e) {
    const h = e.target.closest('.day-head');
    if (!h) return;
    const agenda = h.closest('.agenda');
    if (!agenda || !agenda.classList.contains('agenda--unlocked')) return;
    h.parentElement.classList.toggle('open');
  });

  /* ---- Yoda episode accordions ---- */
  document.addEventListener('click', function (e) {
    var h = e.target.closest('.yep-head');
    if (h) h.parentElement.classList.toggle('open');
  });

  /* ---- Nav anchor links (Ranking → gamificacao + scroll to leaderboard) ---- */
  document.addEventListener('click', function (e) {
    const link = e.target.closest('[data-anchor]');
    if (!link || !link.dataset.anchor) return;
    e.preventDefault();
    const page   = link.dataset.navPage || 'gamificacao';
    const anchor = link.dataset.anchor;
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
    const knowBtn = document.getElementById('heroKnow');
    if (knowBtn) knowBtn.addEventListener('click', function (e) {
      e.preventDefault();
      var target = document.getElementById('o-que-e');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });

  });

  /* ---- Content XP tracking (conteúdos page) ---- */
  const CONTENT_SECTIONS = ['galaxia','forca','arquetipos','sombrio','trilogia'];
  const XP_PER_SECTION   = 5;

  function initContentTracking() {
    const sess = window.faAuth && window.faAuth.getSession();
    if (!sess) return;

    const _ast = window.faStore || localStorage;
    let read = [];
    try { read = JSON.parse(_ast.getItem('fa-content-read') || '[]'); } catch(e) {}

    CONTENT_SECTIONS.forEach(function (id) {
      const el = document.getElementById('content-' + id);
      if (!el) return;

      /* Mark already-read badge */
      const badge = document.getElementById('xp-badge-' + id);
      if (read.indexOf(id) !== -1) {
        if (badge) { badge.textContent = '✓ +' + XP_PER_SECTION + ' XP'; badge.classList.add('visible'); }
        return;
      }

      /* Observe for first read — requires 10s visible before awarding XP */
      let readTimer = null;
      const obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            if (readTimer) return;
            readTimer = setTimeout(function () {
              obs.disconnect();
              read.push(id);
              try { _ast.setItem('fa-content-read', JSON.stringify(read)); } catch(e2) {}
              const cur = parseInt(_ast.getItem('fa-content-xp') || '0', 10) || 0;
              try { _ast.setItem('fa-content-xp', String(cur + XP_PER_SECTION)); } catch(e3) {}
              if (window.faSyncPlayer) window.faSyncPlayer();
              if (window.faSyncProgress) window.faSyncProgress();
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
        const turmaKey = btn.dataset.turma;
        if (!turmaKey) return;

        const sess = window.faAuth && window.faAuth.getSession();
        if (sess) checkInterestState(btn, turmaKey, sess.email);

        btn.addEventListener('click', function () {
          const s = window.faAuth && window.faAuth.getSession();
          if (!s) { if (window.faOpenAuthModal) window.faOpenAuthModal('register'); return; }
          if (btn.dataset.state === 'done') removeInterest(btn, turmaKey, s);
          else registerInterest(btn, turmaKey, s);
        });
      });
    }

    function checkInterestState(btn, turmaKey, email) {
      const key = emailKey(email);
      firebase && firebase.database &&
        firebase.database().ref('turmas-interesse/' + turmaKey + '/' + key).once('value', function (snap) {
          const val = snap.val();
          if (val && !val.removed) setDone(btn, turmaKey);
        });
    }

    function registerInterest(btn, turmaKey, sess) {
      const key   = emailKey(sess.email);
      const now   = new Date().toISOString();
      const entry = { name: sess.name, email: sess.email, area: sess.area || '', date: now, removed: false };
      firebase.database().ref('turmas-interesse/' + turmaKey + '/' + key).set(entry, function (err) {
        if (err) { showMsg(turmaKey, 'Erro ao registrar. Tente novamente.'); return; }
        firebase.database().ref('turmas-interesse-log/' + turmaKey + '/' + key).push(
          { name: sess.name, email: sess.email, area: sess.area || '', action: 'registrado', date: now }
        );
        setDone(btn, turmaKey);
      });
    }

    function removeInterest(btn, turmaKey, sess) {
      const key = emailKey(sess.email);
      const now = new Date().toISOString();
      firebase.database().ref('turmas-interesse/' + turmaKey + '/' + key).update({ removed: true, removedDate: now }, function (err) {
        if (err) { showMsg(turmaKey, 'Erro ao remover. Tente novamente.'); return; }
        firebase.database().ref('turmas-interesse-log/' + turmaKey + '/' + key).push(
          { name: sess.name, email: sess.email, area: sess.area || '', action: 'removido', date: now }
        );
        setInitial(btn, turmaKey);
      });
    }

    function setDone(btn, turmaKey) {
      btn.textContent = 'Remover interesse';
      btn.classList.add('done');
      btn.dataset.state = 'done';
      btn.disabled = false;
      showMsg(turmaKey, 'Sua intenção foi registrada! Usaremos para dimensionar as turmas.');
    }

    function setInitial(btn, turmaKey) {
      btn.textContent = 'Tenho interesse';
      btn.classList.remove('done');
      btn.dataset.state = '';
      btn.disabled = false;
      showMsg(turmaKey, 'Interesse removido.');
    }

    function showMsg(turmaKey, msg) {
      const el = document.getElementById('intent-msg-' + turmaKey);
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
