/* App interactions for Força Ágil */
(function () {
  // ---- Nav scroll state + mobile toggle ----
  const nav = document.querySelector('.nav');
  const onScroll = () => nav && nav.classList.toggle('scrolled', window.scrollY > 40);
  onScroll(); addEventListener('scroll', onScroll, { passive: true });

  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
    links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
  }

  // ---- Reveal on scroll (rAF/scroll based — reliable, never leaves content hidden) ----
  const reveals = [...document.querySelectorAll('.reveal')];
  const revealInView = () => {
    const vh = innerHeight || document.documentElement.clientHeight;
    for (const el of reveals) {
      if (el.classList.contains('in')) continue;
      const r = el.getBoundingClientRect();
      if (r.top < vh * 1.05 && r.bottom > -80) el.classList.add('in');
    }
  };
  revealInView();
  addEventListener('scroll', revealInView, { passive: true });
  addEventListener('resize', revealInView);
  addEventListener('load', revealInView);

  // ---- Hero letters split ----
  document.querySelectorAll('.hero-title [data-split]').forEach(line => {
    const txt = line.textContent; line.textContent = '';
    [...txt].forEach((ch, i) => {
      const s = document.createElement('span');
      s.textContent = ch === ' ' ? '\u00A0' : ch;
      s.style.animationDelay = (0.35 + i * 0.05) + 's';
      line.appendChild(s);
    });
  });

  // ---- Opening crawl ----
  const crawl = document.querySelector('.crawl-content');
  const replay = document.querySelector('.crawl-replay');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (crawl && !reduce) {
    const startCrawl = () => {
      crawl.classList.remove('run'); void crawl.offsetWidth; crawl.classList.add('run');
    };
    const crawlIO = new IntersectionObserver((es) => {
      es.forEach(e => { if (e.isIntersecting) { startCrawl(); crawlIO.disconnect(); } });
    }, { threshold: 0.4 });
    crawlIO.observe(document.querySelector('.crawl-section'));
    replay && replay.addEventListener('click', startCrawl);
  } else if (replay) {
    replay.style.display = 'none';
  }

  // ---- Jedi progression / self-diagnosis ----
  const ranks = document.querySelectorAll('.rank');
  const bar = document.querySelector('.rank-bar i');
  ranks.forEach((r, i) => {
    r.addEventListener('click', () => {
      ranks.forEach(x => x.classList.remove('active'));
      r.classList.add('active');
      if (bar) bar.style.width = ((i + 1) / ranks.length * 100) + '%';
    });
  });

  // ---- Agenda accordions ----
  document.querySelectorAll('.day-head').forEach(h => {
    h.addEventListener('click', () => h.parentElement.classList.toggle('open'));
  });

  // ---- Active nav link highlight ----
  const navA = [...document.querySelectorAll('.nav-links a[href^="#"]')];
  const map = new Map();
  navA.forEach(a => { const s = document.querySelector(a.getAttribute('href')); if (s) map.set(s, a); });
  const spy = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        navA.forEach(a => a.style.color = '');
        const a = map.get(e.target);
        if (a) a.style.color = 'var(--accent)';
      }
    });
  }, { threshold: 0.5 });
  // ---- Hero entrance failsafe: ensure visible even if CSS animations are frozen ----
  addEventListener('load', () => setTimeout(() => {
    document.querySelectorAll('.hero-kicker,.hero-sub,.hero-meta,.hero-actions,.scroll-cue,.hero-title span')
      .forEach(el => { el.style.opacity = '1'; });
  }, 1400));
  // ---- Modal de cadastro ----
  const PLAYER_KEY = 'fa-player';

  function getPlayer() {
    try { return JSON.parse(localStorage.getItem(PLAYER_KEY) || 'null'); } catch(e) { return null; }
  }
  function savePlayer(p) {
    try { localStorage.setItem(PLAYER_KEY, JSON.stringify(p)); } catch(e) {}
  }

  const modal   = document.getElementById('registerModal');
  const btnOpen = document.getElementById('openRegister');
  const btnClose= document.getElementById('modalClose');
  const btnSubmit=document.getElementById('reg-submit');
  const errMsg  = document.getElementById('reg-err');

  function openModal() {
    if (!modal) return;
    modal.hidden = false;
    document.getElementById('reg-name').focus();
  }
  function closeModal() { if (modal) modal.hidden = true; }

  function handleActivate() {
    var p = getPlayer();
    if (p && p.name) {
      var dest = document.getElementById('treinamento');
      if (dest) dest.scrollIntoView({ behavior: 'smooth' });
    } else {
      openModal();
    }
  }

  if (btnOpen) btnOpen.addEventListener('click', handleActivate);

  var heroBtn = document.getElementById('heroRegister');
  if (heroBtn) heroBtn.addEventListener('click', handleActivate);

  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (modal) modal.addEventListener('click', function(e) { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeModal(); });

  if (btnSubmit) btnSubmit.addEventListener('click', function() {
    var name  = (document.getElementById('reg-name').value || '').trim();
    var area  = (document.getElementById('reg-area').value || '').trim();
    if (!name || !area) {
      if (errMsg) errMsg.hidden = false;
      return;
    }
    if (errMsg) errMsg.hidden = true;
    var player = { name: name, area: area, turma: '' };
    savePlayer(player);
    closeModal();
    // notifica outros módulos
    window.dispatchEvent(new CustomEvent('fa-player-registered', { detail: player }));
    // rola para o game
    var dest = document.getElementById('treinamento') || document.getElementById('missao');
    if (dest) dest.scrollIntoView({ behavior: 'smooth' });
  });

  // Atualiza botão nav e info do kyber se já cadastrado
  function updateNavBtn() {
    var p = getPlayer();
    if (p && p.name) {
      if (btnOpen) btnOpen.textContent = '★' + p.name.split(' ')[0];
      var info = document.getElementById('kyber-player-info');
      if (info) info.textContent = '★' + p.name + (p.turma ? ' · ' + p.turma : '') + (p.area ? ' · ' + p.area : '');
    }
  }
  updateNavBtn();

  window.addEventListener('fa-player-registered', function(e) {
    if (btnOpen) btnOpen.textContent = '★' + e.detail.name.split(' ')[0];
    var info = document.getElementById('kyber-player-info');
    if (info) info.textContent = '★' + e.detail.name + (e.detail.turma ? ' · ' + e.detail.turma : '') + (e.detail.area ? ' · ' + e.detail.area : '');
  });

})();
