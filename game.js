// Side-scrolling duck flyer.
// Public API: window.Game.start(), window.Game.stop()

(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');

  // Logical resolution we draw into; CSS scales it to the viewport.
  const W = 960, H = 540;

  // Resize backing store to crisp DPR while keeping the logical world W x H.
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth || window.innerWidth;
    const cssH = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    // We render assuming a fixed virtual W x H. Compute scale to fit (contain).
    const scale = Math.min(canvas.width / W, canvas.height / H);
    state.viewScale = scale;
    state.viewOffsetX = (canvas.width - W * scale) / 2;
    state.viewOffsetY = (canvas.height - H * scale) / 2;
  }

  // ---------- Game state ----------
  const DIFF = {
    easy:   { gravity: 0.32, flap: -7.0, maxFall: 9,  scrollBase: 3.2, gapMin: 180, gapMax: 230, spawnMs: 1700 },
    normal: { gravity: 0.42, flap: -7.6, maxFall: 11, scrollBase: 4.0, gapMin: 150, gapMax: 200, spawnMs: 1450 },
    hard:   { gravity: 0.55, flap: -8.4, maxFall: 13, scrollBase: 5.0, gapMin: 130, gapMax: 170, spawnMs: 1150 },
  };

  const state = {
    running: false,
    raf: null,
    lastTs: 0,
    duck: { x: 220, y: H / 2, vy: 0, wingPhase: 0 },
    obstacles: [],
    rings: [],
    clouds: [],
    hills: 0,
    spawnTimer: 0,
    ringTimer: 0,
    score: 0,
    diff: DIFF.normal,
    theme: 'day',
    viewScale: 1,
    viewOffsetX: 0,
    viewOffsetY: 0,
  };

  // ---------- Input ----------
  function flap() {
    if (!state.running) return;
    state.duck.vy = state.diff.flap;
    state.duck.wingPhase = -Math.PI / 2;
  }

  function onKey(e) {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      flap();
    } else if (e.code === 'Escape') {
      if (state.running) {
        stop();
        window.GameState.showMenu();
      }
    }
  }

  function onPointer(e) {
    if (!state.running) return;
    // Only flap when clicking on canvas area, not menu buttons.
    const target = e.target;
    if (target === canvas) {
      e.preventDefault();
      flap();
    }
  }

  window.addEventListener('keydown', onKey);
  canvas.addEventListener('pointerdown', onPointer);
  window.addEventListener('resize', resizeCanvas);

  // ---------- World setup ----------
  function reset() {
    const cfg = window.GameState.state.settings;
    state.diff = DIFF[cfg.difficulty] || DIFF.normal;
    state.theme = cfg.theme || 'day';
    state.duck.x = 220;
    state.duck.y = H / 2;
    state.duck.vy = 0;
    state.duck.wingPhase = 0;
    state.obstacles.length = 0;
    state.rings.length = 0;
    state.clouds = makeClouds(8);
    state.spawnTimer = 600;
    state.ringTimer = 1200;
    state.score = 0;
    scoreEl.textContent = '0';
  }

  function makeClouds(n) {
    const arr = [];
    for (let i = 0; i < n; i++) {
      arr.push({
        x: Math.random() * W,
        y: 40 + Math.random() * (H * 0.55),
        r: 18 + Math.random() * 26,
        speed: 0.4 + Math.random() * 0.6,
      });
    }
    return arr;
  }

  // Pipe-pair obstacle (top & bottom cloud columns)
  function spawnObstacle() {
    const gap = state.diff.gapMin + Math.random() * (state.diff.gapMax - state.diff.gapMin);
    const minTop = 60;
    const maxTop = H - 120 - gap;
    const top = minTop + Math.random() * Math.max(40, maxTop - minTop);
    state.obstacles.push({
      x: W + 40,
      top,
      gap,
      width: 64,
      passed: false,
    });
  }

  function spawnRing() {
    const y = 100 + Math.random() * (H - 220);
    state.rings.push({ x: W + 40, y, r: 22, taken: false });
  }

  // ---------- Update ----------
  function update(dt) {
    const d = state.duck;
    d.vy = Math.min(d.vy + state.diff.gravity * (dt / 16.6), state.diff.maxFall);
    d.y += d.vy * (dt / 16.6);
    d.wingPhase += 0.32 * (dt / 16.6);

    // tilt for rendering
    d.tilt = Math.max(-0.4, Math.min(0.9, d.vy * 0.06));

    // floor / ceiling
    if (d.y < 30) { d.y = 30; d.vy = 0; }
    if (d.y > H - 30) {
      d.y = H - 30;
      gameOver();
      return;
    }

    const scroll = state.diff.scrollBase * (dt / 16.6);

    // Clouds (parallax)
    for (const c of state.clouds) {
      c.x -= c.speed * scroll * 0.5;
      if (c.x + c.r < -10) {
        c.x = W + c.r + Math.random() * 200;
        c.y = 40 + Math.random() * (H * 0.55);
        c.r = 18 + Math.random() * 26;
      }
    }

    state.hills = (state.hills - scroll * 0.25) % 240;

    // Obstacles
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnObstacle();
      state.spawnTimer = state.diff.spawnMs;
    }
    for (const o of state.obstacles) {
      o.x -= scroll;
      if (!o.passed && o.x + o.width < d.x - 30) {
        o.passed = true;
        addScore(1);
      }
    }
    state.obstacles = state.obstacles.filter(o => o.x + o.width > -10);

    // Rings (bonus +5)
    state.ringTimer -= dt;
    if (state.ringTimer <= 0) {
      spawnRing();
      state.ringTimer = 2200 + Math.random() * 1200;
    }
    for (const r of state.rings) {
      r.x -= scroll * 0.95;
    }
    state.rings = state.rings.filter(r => r.x + r.r > -10);

    // Collisions
    if (checkCollisions()) gameOver();
  }

  function checkCollisions() {
    const d = state.duck;
    const dr = 26;  // approx duck radius
    for (const o of state.obstacles) {
      if (d.x + dr < o.x || d.x - dr > o.x + o.width) continue;
      if (d.y - dr < o.top || d.y + dr > o.top + o.gap) return true;
    }
    for (const r of state.rings) {
      if (r.taken) continue;
      const dx = r.x - d.x, dy = r.y - d.y;
      if (Math.hypot(dx, dy) < r.r + 12) {
        r.taken = true;
        addScore(5);
      }
    }
    return false;
  }

  function addScore(n) {
    state.score += n;
    scoreEl.textContent = state.score;
  }

  // ---------- Render ----------
  function render() {
    // Reset transform & clear full backing buffer
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Letterbox fill (matches background)
    ctx.fillStyle = themeBackground(state.theme).bottom;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Scale to virtual world
    ctx.setTransform(state.viewScale, 0, 0, state.viewScale, state.viewOffsetX, state.viewOffsetY);

    drawBackground();
    drawHills();
    drawClouds();
    drawRings();
    drawObstacles();
    drawDuckSprite();
  }

  function themeBackground(theme) {
    if (theme === 'sunset') return { top: '#ffb36b', bottom: '#ffd9a8' };
    if (theme === 'night') return { top: '#0c1840', bottom: '#1f3170' };
    return { top: '#9fd6ff', bottom: '#dcefff' };
  }

  function drawBackground() {
    const t = themeBackground(state.theme);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, t.top);
    g.addColorStop(1, t.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    if (state.theme === 'night') {
      // stars
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 40; i++) {
        const x = (i * 137.5) % W;
        const y = (i * 53.7) % (H * 0.6);
        ctx.globalAlpha = 0.4 + ((i * 7) % 6) / 10;
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawHills() {
    ctx.fillStyle = state.theme === 'night' ? '#1a2a4f' :
                    state.theme === 'sunset' ? '#cf6b3d' : '#7ec27e';
    const offset = state.hills;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = -240; x <= W + 240; x += 60) {
      const px = x + offset;
      const py = H - 80 + Math.sin((x + offset) * 0.02) * 18;
      ctx.lineTo(px, py);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    // ground strip
    ctx.fillStyle = state.theme === 'night' ? '#0e1a3b' :
                    state.theme === 'sunset' ? '#a14f2a' : '#5fa75f';
    ctx.fillRect(0, H - 24, W, 24);
  }

  function drawClouds() {
    ctx.fillStyle = state.theme === 'night'
      ? 'rgba(255,255,255,0.15)'
      : 'rgba(255,255,255,0.85)';
    for (const c of state.clouds) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.arc(c.x + c.r * 0.8, c.y + 4, c.r * 0.8, 0, Math.PI * 2);
      ctx.arc(c.x - c.r * 0.7, c.y + 6, c.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawObstacles() {
    for (const o of state.obstacles) {
      // Top cloud-pillar
      drawCloudColumn(o.x, 0, o.width, o.top);
      // Bottom cloud-pillar
      drawCloudColumn(o.x, o.top + o.gap, o.width, H - 24 - (o.top + o.gap));
    }
  }

  function drawCloudColumn(x, y, w, h) {
    if (h <= 0) return;
    ctx.save();
    ctx.fillStyle = state.theme === 'night' ? '#3b4880' : '#ffffff';
    ctx.strokeStyle = state.theme === 'night' ? '#1f2858' : '#b9d6ee';
    ctx.lineWidth = 2;
    const r = 14;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.stroke();
    // bumps
    ctx.beginPath();
    ctx.arc(x + w * 0.3, y + 6, 10, 0, Math.PI * 2);
    ctx.arc(x + w * 0.7, y + 10, 12, 0, Math.PI * 2);
    ctx.arc(x + w * 0.3, y + h - 6, 10, 0, Math.PI * 2);
    ctx.arc(x + w * 0.7, y + h - 10, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function roundRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y,     x + w, y + h, r);
    c.arcTo(x + w, y + h, x,     y + h, r);
    c.arcTo(x,     y + h, x,     y,     r);
    c.arcTo(x,     y,     x + w, y,     r);
    c.closePath();
  }

  function drawRings() {
    for (const r of state.rings) {
      if (r.taken) continue;
      ctx.save();
      ctx.strokeStyle = '#ffd400';
      ctx.lineWidth = 5;
      ctx.shadowColor = 'rgba(255,212,0,0.7)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawDuckSprite() {
    window.drawDuck(ctx, state.duck.x, state.duck.y, window.GameState.state.duck, {
      wingPhase: state.duck.wingPhase,
      tilt: state.duck.tilt || 0,
    });
  }

  // ---------- Loop ----------
  function tick(ts) {
    if (!state.running) return;
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min(40, ts - state.lastTs);
    state.lastTs = ts;
    update(dt);
    if (!state.running) return;  // gameOver may have stopped us
    render();
    state.raf = requestAnimationFrame(tick);
  }

  function start() {
    reset();
    resizeCanvas();
    state.running = true;
    state.lastTs = 0;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = requestAnimationFrame(tick);
  }

  function stop() {
    state.running = false;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = null;
  }

  function gameOver() {
    if (!state.running) return;
    stop();
    window.GameState.setHiScore(state.score);
    // small delay so the final crash frame is visible
    render();
    setTimeout(() => window.GameState.showGameOver(state.score), 250);
  }

  window.Game = { start, stop };

  // initial canvas sizing for menu background
  resizeCanvas();
  // draw a calm sky behind the menu
  ctx.setTransform(state.viewScale, 0, 0, state.viewScale, state.viewOffsetX, state.viewOffsetY);
  drawBackground();
  drawHills();
})();
