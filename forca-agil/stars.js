/* Starfield — layered parallax stars + occasional shooting star.
   Pure canvas, respects reduced motion. */
(function () {
  const canvas = document.getElementById('stars');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W, H, DPR, stars = [], shooters = [], scrollY = 0;

  function accent() {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    return v || '#f5c518';
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.width = innerWidth * DPR;
    H = canvas.height = innerHeight * DPR;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    build();
  }

  function densityFactor() {
    const d = document.documentElement.dataset.stars || 'normal';
    return d === 'calmo' ? 0.55 : d === 'denso' ? 1.7 : 1;
  }

  function build() {
    const count = Math.min(560, Math.floor((innerWidth * innerHeight) / 2600 * densityFactor()));
    stars = [];
    for (let i = 0; i < count; i++) {
      const layer = Math.random();
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        z: 0.3 + layer * 1.7,            // depth → size + parallax
        r: (0.3 + layer * 1.3) * DPR,
        base: 0.25 + Math.random() * 0.75,
        tw: Math.random() * Math.PI * 2, // twinkle phase
        ts: 0.6 + Math.random() * 1.8,   // twinkle speed
        hue: Math.random() < 0.16        // some tinted stars
      });
    }
  }

  function spawnShooter() {
    if (reduce) return;
    const fromLeft = Math.random() < 0.5;
    shooters.push({
      x: fromLeft ? -40 : W + 40,
      y: Math.random() * H * 0.5,
      vx: (fromLeft ? 1 : -1) * (6 + Math.random() * 5) * DPR,
      vy: (2 + Math.random() * 2.4) * DPR,
      life: 0, max: 60 + Math.random() * 30
    });
  }

  let t = 0;
  function frame() {
    t += 0.016;
    ctx.clearRect(0, 0, W, H);
    const a = accent();
    for (const s of stars) {
      const tw = reduce ? 1 : (0.6 + 0.4 * Math.sin(t * s.ts + s.tw));
      const py = (s.y - scrollY * DPR * 0.04 * s.z) % H;
      const y = py < 0 ? py + H : py;
      ctx.globalAlpha = s.base * tw;
      ctx.beginPath();
      ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.hue ? a : '#dfe8ff';
      ctx.fill();
      if (s.z > 1.4 && !reduce) {
        ctx.globalAlpha = s.base * tw * 0.25;
        ctx.beginPath(); ctx.arc(s.x, y, s.r * 3, 0, Math.PI * 2);
        ctx.fillStyle = s.hue ? a : '#9fb8ff'; ctx.fill();
      }
    }
    // shooters
    for (let i = shooters.length - 1; i >= 0; i--) {
      const sh = shooters[i];
      sh.x += sh.vx; sh.y += sh.vy; sh.life++;
      const fade = 1 - sh.life / sh.max;
      const len = 16 * DPR;
      const grad = ctx.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * 3, sh.y - sh.vy * 3);
      grad.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = 1; ctx.strokeStyle = grad; ctx.lineWidth = 1.6 * DPR;
      ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(sh.x - sh.vx * 3, sh.y - sh.vy * 3); ctx.stroke();
      if (sh.life > sh.max || sh.x < -80 || sh.x > W + 80) shooters.splice(i, 1);
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  addEventListener('fa-stars-change', build);
  addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });
  resize();
  if (!reduce) {
    setInterval(() => { if (Math.random() < 0.5) spawnShooter(); }, 4200);
    frame();
  } else {
    // single static paint
    frame(); cancelAnimationFrame; 
  }
})();
