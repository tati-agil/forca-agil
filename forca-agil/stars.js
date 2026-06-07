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
    const speed = (7 + Math.random() * 6);
    const big = Math.random() < 0.35;
    shooters.push({
      x: fromLeft ? -60 : W + 60,
      y: Math.random() * H * 0.62,
      vx: (fromLeft ? 1 : -1) * speed * DPR,
      vy: (2.4 + Math.random() * 2.8) * DPR,
      life: 0, max: 70 + Math.random() * 40,
      len: (big ? 6.5 : 4) + Math.random() * 2,   // tail length multiplier
      w: (big ? 2.6 : 1.6),                         // tail width
      tint: Math.random() < 0.3                     // accent-tinted meteor
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
    // shooters / meteors
    for (let i = shooters.length - 1; i >= 0; i--) {
      const sh = shooters[i];
      sh.x += sh.vx; sh.y += sh.vy; sh.life++;
      const fade = 1 - sh.life / sh.max;
      const tx = sh.x - sh.vx * sh.len, ty = sh.y - sh.vy * sh.len;
      const headCol = sh.tint ? a : '#ffffff';
      const tailCol = sh.tint ? a : '255,255,255';
      // tail
      const grad = ctx.createLinearGradient(sh.x, sh.y, tx, ty);
      grad.addColorStop(0, `rgba(255,255,255,${0.95 * fade})`);
      grad.addColorStop(0.25, `rgba(${sh.tint ? '245,197,24' : '200,220,255'},${0.6 * fade})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = 1; ctx.strokeStyle = grad; ctx.lineWidth = sh.w * DPR; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(tx, ty); ctx.stroke();
      // glowing head
      const hg = ctx.createRadialGradient(sh.x, sh.y, 0, sh.x, sh.y, sh.w * 4 * DPR);
      hg.addColorStop(0, `rgba(255,255,255,${0.95 * fade})`);
      hg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(sh.x, sh.y, sh.w * 4 * DPR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = headCol; ctx.beginPath(); ctx.arc(sh.x, sh.y, sh.w * 0.9 * DPR, 0, Math.PI * 2); ctx.fill();
      if (sh.life > sh.max || sh.x < -120 || sh.x > W + 120) shooters.splice(i, 1);
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  addEventListener('fa-stars-change', build);
  addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });
  resize();
  if (!reduce) {
    // meteor shower — frequent streaks; occasional double
    setInterval(() => {
      if (Math.random() < 0.7) spawnShooter();
      if (Math.random() < 0.25) setTimeout(spawnShooter, 300);
    }, 1700);
    spawnShooter();
    frame();
  } else {
    // single static paint
    frame(); cancelAnimationFrame; 
  }
})();
