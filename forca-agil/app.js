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
  function closeMenu() {
    if (!links) return;
    links.classList.remove('open');
    if (toggle) toggle.classList.remove('open');
  }
  if (toggle && links) {
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = links.classList.toggle('open');
      toggle.classList.toggle('open', isOpen);
    });
    links.querySelectorAll('a, button').forEach(function (el) {
      el.addEventListener('click', closeMenu);
    });
    document.addEventListener('click', function (e) {
      if (!nav.contains(e.target)) closeMenu();
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

    /* Turmas não são mais fixas — vêm de turmas/ no Firebase, criadas/editadas/
       excluídas pelo admin. A inscrição oficial agora acontece fora do portal,
       no CMFlex: quando o admin encerra o interesse de uma turma, o card dela
       passa a orientar pro CMFlex — igual pra todo mundo, sem distinguir quem
       já foi confirmado como inscrito (não existe mais um card único de
       "turma confirmada" substituindo o grid inteiro). */
    var _turmasList = []; // [{ key, label, dias, cmflexLink, finalizada }]

    function loadTurmas(cb) {
      var db = firebase.database();
      db.ref('turmas').once('value', function (snap) {
        var val = snap.val() || {};
        db.ref('turmas-config').once('value', function (cfgSnap) {
          var cfg = cfgSnap.val() || {};
          _turmasList = Object.keys(val).map(function (key) {
            return {
              key: key,
              label: val[key].label || key.toUpperCase(),
              dias: val[key].dias || [],
              order: val[key].order || 0,
              cmflexLink: val[key].cmflexLink || '',
              finalizada: !!(cfg[key] && cfg[key].finalizada)
            };
          }).sort(function (a, b) { return a.order - b.order; });
          cb(_turmasList);
        });
      });
    }

    function renderTurmasGrid() {
      var grid = document.querySelector('.turmas-grid');
      if (!grid) return;
      if (!_turmasList.length) {
        grid.innerHTML = '<p style="opacity:.7">Nenhuma turma aberta no momento.</p>';
        return;
      }
      grid.innerHTML = _turmasList.map(function (t) {
        var fmt = window.faTurmasUtil.formatDias(t.dias);

        if (t.finalizada) {
          var cmflexBtn = t.cmflexLink
            ? '<a class="btn--cmflex" href="' + t.cmflexLink + '" target="_blank" rel="noopener">Ir para o CMFlex →</a>'
            : '<div class="turma-intent-msg">Link do CMFlex ainda não disponível — consulte a organização.</div>';
          return (
            '<div class="turma-card-new reveal in">' +
              '<span class="tc-label">' + t.label + '</span>' +
              '<div class="tc-month">' + fmt.mes + '</div>' +
              '<div class="tc-dates">' + fmt.dates + '</div>' +
              '<div class="turma-cmflex-msg"><strong>Faça sua inscrição no CMFlex</strong>As inscrições desta turma agora devem ser feitas diretamente no sistema oficial.</div>' +
              cmflexBtn +
            '</div>'
          );
        }

        return (
          '<div class="turma-card-new reveal in">' +
            '<span class="tc-label">' + t.label + '</span>' +
            '<div class="tc-month">' + fmt.mes + '</div>' +
            '<div class="tc-dates">' + fmt.dates + '</div>' +
            '<button class="btn--interest" data-turma="' + t.key + '"><span class="btn-heart">&#x2661;</span>&nbsp; Tenho interesse</button>' +
            '<div class="turma-intent-msg" id="intent-msg-' + t.key + '"></div>' +
          '</div>'
        );
      }).join('');
    }

    function initTurmaInterest() {
      var sess = window.faAuth && window.faAuth.getSession();
      loadTurmas(function () {
        renderTurmasGrid();
        initInterestButtons(sess);
      });
    }

    function initInterestButtons(sess) {
      document.querySelectorAll('.btn--interest').forEach(function (btn) {
        const turmaKey = btn.dataset.turma;
        if (!turmaKey) return;

        if (sess) checkInterestState(btn, turmaKey, sess.email);

        /* Evita empilhar listeners duplicados quando initTurmaInterest roda de novo
           (revisita à página Turmas ou login/logout) — o botão é o mesmo elemento DOM */
        if (btn.dataset.wired) return;
        btn.dataset.wired = '1';

        btn.addEventListener('click', function () {
          if (btn.dataset.state === 'inscrito') return; /* já é inscrita — botão fica desabilitado, só o admin pode desconfirmar */
          const s = window.faAuth && window.faAuth.getSession();
          if (!s) {
            showMsg(turmaKey, 'Faça login para registrar seu interesse.');
            if (window.faOpenAuthModal) window.faOpenAuthModal('login');
            return;
          }
          if (btn.dataset.state === 'done') removeInterest(btn, turmaKey, s);
          else registerInterest(btn, turmaKey, s);
        });
      });
    }

    function checkInterestState(btn, turmaKey, email) {
      const key = emailKey(email);
      if (!firebase || !firebase.database) return;
      firebase.database().ref('turmas-interesse/' + turmaKey + '/' + key).once('value', function (snap) {
        const val = snap.val();
        if (!val || val.removed) return;
        /* Quem já é inscrita não pode se autorremover pelo "Remover interesse" —
           só o admin confirma quem de fato saiu do CMFlex (botão "Desconfirmar").
           Sem essa trava, a pessoa podia derrubar sozinha o próprio acesso a
           Conteúdos/Treinamento mesmo continuando inscrita de verdade no CMFlex. */
        if (val.status === 'inscrito') setInscrito(btn, turmaKey);
        else setDone(btn, turmaKey);
      });
    }

    function registerInterest(btn, turmaKey, sess) {
      /* Desabilita imediatamente para evitar clique duplo disparar 2 gravações antes da resposta do Firebase */
      btn.disabled = true;
      const key   = emailKey(sess.email);
      const now   = new Date().toISOString();
      const entry = { name: sess.name, email: sess.email, area: sess.area || '', date: now, removed: false, status: 'interessado' };
      /* Checagem de segurança — o botão só existe se a turma não estava fechada
         no último carregamento da grade, mas a página pode estar aberta há um
         tempo e o admin ter encerrado o interesse nesse meio-tempo */
      firebase.database().ref('turmas-config/' + turmaKey + '/finalizada').once('value', function (cfgSnap) {
        if (cfgSnap.val()) { btn.disabled = false; showMsg(turmaKey, 'Esta turma está encerrada para novas inscrições.'); return; }
        firebase.database().ref('turmas-interesse/' + turmaKey + '/' + key).set(entry, function (err) {
          if (err) { btn.disabled = false; showMsg(turmaKey, 'Erro ao registrar. Tente novamente.'); return; }
          firebase.database().ref('turmas-interesse-log/' + turmaKey + '/' + key).push(
            { name: sess.name, email: sess.email, area: sess.area || '', action: 'registrado', date: now }
          );
          setDone(btn, turmaKey);
        });
      });
    }

    function removeInterest(btn, turmaKey, sess) {
      /* Desabilita imediatamente para evitar clique duplo disparar 2 gravações antes da resposta do Firebase */
      btn.disabled = true;
      const key = emailKey(sess.email);
      const now = new Date().toISOString();
      firebase.database().ref('turmas-interesse/' + turmaKey + '/' + key).update({ removed: true, removedDate: now, status: 'removido' }, function (err) {
        if (err) { btn.disabled = false; showMsg(turmaKey, 'Erro ao remover. Tente novamente.'); return; }
        firebase.database().ref('turmas-interesse-log/' + turmaKey + '/' + key).push(
          { name: sess.name, email: sess.email, area: sess.area || '', action: 'removido', date: now }
        );
        setInitial(btn, turmaKey);
      });
    }

    function setDone(btn, turmaKey) {
      btn.innerHTML = '<span class="btn-heart">&#x2661;</span>&nbsp; Remover interesse';
      btn.classList.add('done');
      btn.dataset.state = 'done';
      btn.disabled = false;
      showMsg(turmaKey, 'Sua intenção foi registrada! Usaremos para dimensionar as turmas.');
    }

    function setInscrito(btn, turmaKey) {
      btn.innerHTML = '<span class="btn-heart">&#x2713;</span>&nbsp; Inscrita';
      btn.classList.remove('done');
      btn.classList.add('inscrito');
      btn.dataset.state = 'inscrito';
      btn.disabled = true;
      showMsg(turmaKey, 'Você já é inscrita nesta turma. Só o admin pode alterar sua inscrição.');
    }

    function setInitial(btn, turmaKey) {
      btn.innerHTML = '<span class="btn-heart">&#x2661;</span>&nbsp; Tenho interesse';
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
