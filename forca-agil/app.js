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
    const stage   = document.querySelector('.crawl-stage');
    const replay  = document.querySelector('.crawl-replay');
    const reduce  = matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (crawl && !reduce) {
      var paused = false;
      var skipped = false;

      const startCrawl = function () {
        skipped = false; paused = false;
        crawl.classList.remove('run', 'crawl-static');
        stage.classList.remove('crawl-stage--static');
        void crawl.offsetWidth;
        crawl.classList.add('run');
        crawl.style.animationPlayState = 'running';
        if (pauseBtn) pauseBtn.textContent = '⏸ Pausar';
        if (skipBtn)  skipBtn.textContent  = '≡ Ler texto';
      };

      /* pause / resume on stage click */
      const crawlBtns = document.querySelector('.crawl-btns');
      const pauseBtn = document.createElement('button');
      pauseBtn.className = 'btn crawl-pause';
      pauseBtn.textContent = '⏸ Pausar';
      pauseBtn.setAttribute('aria-label', 'Pausar ou retomar a abertura');
      if (crawlBtns) crawlBtns.prepend(pauseBtn); else stage.parentNode.insertBefore(pauseBtn, stage.nextSibling);

      pauseBtn.addEventListener('click', function () {
        if (skipped) return;
        paused = !paused;
        crawl.style.animationPlayState = paused ? 'paused' : 'running';
        pauseBtn.textContent = paused ? '▶ Continuar' : '⏸ Pausar';
      });

      stage.addEventListener('click', function () {
        if (skipped) return;
        paused = !paused;
        crawl.style.animationPlayState = paused ? 'paused' : 'running';
        pauseBtn.textContent = paused ? '▶ Continuar' : '⏸ Pausar';
      });

      /* skip: show static text */
      const skipBtn = document.createElement('button');
      skipBtn.className = 'btn crawl-skip';
      skipBtn.textContent = '≡ Ler texto';
      skipBtn.setAttribute('aria-label', 'Ver texto completo sem animação');
      if (crawlBtns) crawlBtns.prepend(skipBtn); else stage.parentNode.insertBefore(skipBtn, stage.nextSibling);

      skipBtn.addEventListener('click', function () {
        if (!skipped) {
          skipped = true; paused = false;
          crawl.classList.remove('run');
          crawl.classList.add('crawl-static');
          stage.classList.add('crawl-stage--static');
          crawl.style.animationPlayState = 'running';
          skipBtn.textContent = '✕ Fechar texto';
          pauseBtn.style.display = 'none';
        } else {
          startCrawl();
          pauseBtn.style.display = '';
        }
      });

      const crawlIO = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { startCrawl(); crawlIO.disconnect(); } });
      }, { threshold: 0.4 });
      const cs = document.querySelector('.crawl-section');
      if (cs) crawlIO.observe(cs);

      if (replay) replay.addEventListener('click', function () {
        pauseBtn.style.display = '';
        startCrawl();
      });

    } else if (replay) {
      replay.style.display = 'none';
    }
  });

  /* ---- Yoda episode accordions ---- */
  document.addEventListener('click', function (e) {
    var h = e.target.closest('.yep-head');
    if (h) h.parentElement.classList.toggle('open');
  });

  /* ---- Nav anchor links (scroll to element within page) ---- */
  document.addEventListener('click', function (e) {
    const link = e.target.closest('[data-anchor]');
    if (!link || !link.dataset.anchor) return;
    e.preventDefault();
    const page   = link.dataset.navPage || 'treinamento';
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
  const CONTENT_SECTIONS = ['galaxia','forca','principios','arquetipos','sombrio','trilogia'];
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
        if (badge) { badge.textContent = '✓ +' + XP_PER_SECTION + ' pts'; badge.classList.add('visible'); }
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
                badge.textContent = '✓ +' + XP_PER_SECTION + ' pts';
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

  /* ---- Galaxy map "ver mais" ---- */
  document.addEventListener('DOMContentLoaded', function () {
    var galaxyBtn = document.getElementById('galaxyMoreBtn');
    var galaxyExtra = document.getElementById('galaxyExtra');
    if (galaxyBtn && galaxyExtra) {
      galaxyBtn.addEventListener('click', function () {
        galaxyExtra.classList.add('visible');
        galaxyBtn.style.display = 'none';
        /* força reveals nos cards recém-visíveis */
        galaxyExtra.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
      });
    }

    var principlesBtn = document.getElementById('principlesMoreBtn');
    var principlesExtra = document.getElementById('principlesExtra');
    if (principlesBtn && principlesExtra) {
      principlesBtn.addEventListener('click', function () {
        principlesExtra.classList.add('visible');
        principlesBtn.style.display = 'none';
        /* força reveals nos princípios recém-visíveis */
        principlesExtra.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
      });
    }

  });

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
    const TURMAS_INFO = {
      t1: { label: 'TURMA 1', mes: 'Agosto', dates: '11, 12, 18, 19 e 20' },
      t2: { label: 'TURMA 2', mes: 'Setembro', dates: '9, 10, 11, 15 e 16' },
      t3: { label: 'TURMA 3', mes: 'Novembro', dates: '17, 18, 19, 24 e 25' }
    };

    function buildEnrolledCard(turmaKey) {
      var info = TURMAS_INFO[turmaKey] || { label: turmaKey.toUpperCase(), mes: '', dates: '' };
      var grid = document.querySelector('.turmas-grid');
      if (!grid) return;
      grid.innerHTML =
        '<div class="turma-card-new turma-card-enrolled reveal in">' +
          '<span class="tc-label">' + info.label + '</span>' +
          '<div class="tc-month">' + info.mes + ' — <span style="color:var(--cyan);font-weight:600">CONFIRMADA</span></div>' +
          '<div class="tc-dates">' + info.dates + '</div>' +
        '</div>';
    }

    function checkAllEnrollments(sess, cb) {
      /* Check if user is inscrito in any turma */
      var key = emailKey(sess.email);
      var turmas = ['t1','t2','t3'];
      var found = null;
      var done = 0;
      turmas.forEach(function (t) {
        firebase.database().ref('turmas-interesse/' + t + '/' + key).once('value', function (snap) {
          done++;
          var val = snap.val();
          if (val && !val.removed && val.status === 'inscrito') found = t;
          if (done === turmas.length) cb(found);
        });
      });
    }

    function initTurmaInterest() {
      var sess = window.faAuth && window.faAuth.getSession();
      if (sess) {
        checkAllEnrollments(sess, function (enrolledTurma) {
          if (enrolledTurma) {
            buildEnrolledCard(enrolledTurma);
            return;
          }
          initInterestButtons(sess);
        });
      } else {
        initInterestButtons(null);
      }
    }

    function initInterestButtons(sess) {
      document.querySelectorAll('.btn--interest').forEach(function (btn) {
        const turmaKey = btn.dataset.turma;
        if (!turmaKey) return;

        if (sess) checkInterestState(btn, turmaKey, sess.email);

        btn.addEventListener('click', function () {
          const s = window.faAuth && window.faAuth.getSession();
          if (!s) { showMsg(turmaKey, 'Faça login para registrar seu interesse.'); if (window.faOpenAuthModal) window.faOpenAuthModal('login'); return; }
          if (btn.dataset.state === 'done') removeInterest(btn, turmaKey, s);
          else registerInterest(btn, turmaKey, s);
        });
      });
    }

    function checkInterestState(btn, turmaKey, email) {
      const key = emailKey(email);
      if (!firebase || !firebase.database) return;
      /* check turma config (finalizada?) and user record in parallel */
      firebase.database().ref('turmas-config/' + turmaKey + '/finalizada').once('value', function (cfgSnap) {
        const finalizada = !!cfgSnap.val();
        firebase.database().ref('turmas-interesse/' + turmaKey + '/' + key).once('value', function (snap) {
          const val = snap.val();
          if (finalizada && (!val || val.removed)) {
            setBlocked(btn, turmaKey);
            return;
          }
          if (val && !val.removed) {
            if (val.status === 'presente')        setPresente(btn, turmaKey);
            else if (val.status === 'inscrito' || finalizada) setInscrito(btn, turmaKey);
            else setDone(btn, turmaKey);
          }
        });
      });
    }

    function registerInterest(btn, turmaKey, sess) {
      const key   = emailKey(sess.email);
      const now   = new Date().toISOString();
      const entry = { name: sess.name, email: sess.email, area: sess.area || '', date: now, removed: false, status: 'interessado' };
      firebase.database().ref('turmas-config/' + turmaKey + '/finalizada').once('value', function (cfgSnap) {
        if (cfgSnap.val()) { showMsg(turmaKey, 'Esta turma está encerrada para novas inscrições.'); return; }
        firebase.database().ref('turmas-interesse/' + turmaKey + '/' + key).set(entry, function (err) {
          if (err) { showMsg(turmaKey, 'Erro ao registrar. Tente novamente.'); return; }
          firebase.database().ref('turmas-interesse-log/' + turmaKey + '/' + key).push(
            { name: sess.name, email: sess.email, area: sess.area || '', action: 'registrado', date: now }
          );
          setDone(btn, turmaKey);
        });
      });
    }

    function removeInterest(btn, turmaKey, sess) {
      const key = emailKey(sess.email);
      const now = new Date().toISOString();
      firebase.database().ref('turmas-interesse/' + turmaKey + '/' + key).update({ removed: true, removedDate: now, status: 'removido' }, function (err) {
        if (err) { showMsg(turmaKey, 'Erro ao remover. Tente novamente.'); return; }
        firebase.database().ref('turmas-interesse-log/' + turmaKey + '/' + key).push(
          { name: sess.name, email: sess.email, area: sess.area || '', action: 'removido', date: now }
        );
        setInitial(btn, turmaKey);
      });
    }

    function setDone(btn, turmaKey) {
      btn.innerHTML = '<span class="btn-heart">&#x2661;</span>&nbsp; Remover interesse';
      btn.classList.remove('inscrito','presente','blocked');
      btn.classList.add('done');
      btn.dataset.state = 'done';
      btn.disabled = false;
      showMsg(turmaKey, 'Sua intenção foi registrada! Usaremos para dimensionar as turmas.');
    }

    function setInitial(btn, turmaKey) {
      btn.innerHTML = '<span class="btn-heart">&#x2661;</span>&nbsp; Tenho interesse';
      btn.classList.remove('done','inscrito','presente','blocked');
      btn.dataset.state = '';
      btn.disabled = false;
      showMsg(turmaKey, 'Interesse removido.');
    }

    function setInscrito(btn, turmaKey) {
      btn.innerHTML = '✓ Inscrita';
      btn.classList.remove('done','presente','blocked');
      btn.classList.add('inscrito');
      btn.dataset.state = 'inscrito';
      btn.disabled = true;
      showMsg(turmaKey, 'Você está inscrita nesta turma!');
    }

    function setPresente(btn, turmaKey) {
      btn.innerHTML = '✓ Presente';
      btn.classList.remove('done','inscrito','blocked');
      btn.classList.add('presente');
      btn.dataset.state = 'presente';
      btn.disabled = true;
      showMsg(turmaKey, 'Presença confirmada!');
    }

    function setBlocked(btn, turmaKey) {
      btn.innerHTML = 'Inscrições encerradas';
      btn.classList.remove('done','inscrito','presente');
      btn.classList.add('blocked');
      btn.dataset.state = 'blocked';
      btn.disabled = true;
      showMsg(turmaKey, '');
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
      if (window.faRouter && window.faRouter.current() === 'turmas') {
        /* Re-run full init (may switch to enrolled card) */
        var grid = document.querySelector('.turmas-grid');
        if (grid) {
          /* restore original cards if they were replaced */
          if (!grid.querySelector('.btn--interest') && !grid.querySelector('.turma-card-enrolled')) {
            /* already handled below */
          }
        }
        initTurmaInterest();
      }
    });
  });

  /* ---- "Saiba mais" XP: navega para Ajuda, abre pergunta XP e rola até ela ---- */
  document.addEventListener('DOMContentLoaded', function () {
    var saibaMais = document.getElementById('saibaMaisXP');
    if (!saibaMais) return;
    saibaMais.addEventListener('click', function (e) {
      e.preventDefault();
      if (window.faRouter) window.faRouter.navigate('ajuda');
      setTimeout(function () {
        var details = document.getElementById('faq-xp');
        if (details) {
          details.open = true;
          details.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);
    });
  });

})();
