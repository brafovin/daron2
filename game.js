// Free-flight duck riding game on an open world map.
// Public API: window.Game.start(), window.Game.stop()

(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');

  // Virtual viewport
  const W = 960, H = 540;
  // World size
  const WW = 6000, WH = 2400;

  // Difficulty params
  const DIFF = {
    easy:   { gravity: 0.12, thrust: 0.55, maxVx: 6,  maxVy: 10, drag: 0.88 },
    normal: { gravity: 0.20, thrust: 0.65, maxVx: 8,  maxVy: 12, drag: 0.86 },
    hard:   { gravity: 0.30, thrust: 0.80, maxVx: 10, maxVy: 14, drag: 0.84 },
  };

  // Ground height at world X (deterministic hills)
  function groundY(wx) {
    return WH - 90
      - Math.sin(wx * 0.0017)        * 130
      - Math.sin(wx * 0.0045 + 1.2)  * 60
      - Math.sin(wx * 0.010  + 2.5)  * 28
      - Math.sin(wx * 0.021  + 0.8)  * 12;
  }

  const state = {
    running: false,
    raf: null,
    lastTs: 0,
    duck: { x: WW / 2, y: WH / 3, vx: 0, vy: 0, wingPhase: 0, facing: 1, tilt: 0 },
    cam: { x: WW / 2, y: WH / 3 },
    rings: [],
    trees: [],
    lakes: [],
    worldClouds: [],
    score: 0,
    diff: DIFF.normal,
    theme: 'day',
    viewScale: 1,
    viewOffsetX: 0,
    viewOffsetY: 0,
  };

  // ---------- Map generation (deterministic) ----------
  function generateMap() {
    state.trees.length = 0;
    state.lakes.length = 0;
    state.rings.length = 0;
    state.worldClouds.length = 0;

    for (let i = 0; i < 140; i++) {
      const x = 200 + (i * 43) % (WW - 400);
      state.trees.push({ x, y: groundY(x), h: 28 + (i * 7) % 34, type: i % 3 });
    }
    for (let i = 0; i < 14; i++) {
      const x = 500 + (i * 421) % (WW - 1000);
      state.lakes.push({ x, y: groundY(x) + 8, rx: 65 + (i * 13) % 85, ry: 16 + (i * 7) % 18 });
    }
    for (let i = 0; i < 55; i++) {
      const x = 400 + (i * 109) % (WW - 800);
      const y = Math.max(80, groundY(x) - 120 - (i * 89) % 550);
      state.rings.push({ x, y, r: 22, taken: false, respawnAt: 0 });
    }
    for (let i = 0; i < 40; i++) {
      state.worldClouds.push({
        x: (i * 151) % WW,
        y: 60  + (i * 83) % 340,
        r: 18  + (i * 11) % 42,
      });
    }
  }

  // ---------- Canvas resize ----------
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth  || innerWidth;
    const cssH = canvas.clientHeight || innerHeight;
    canvas.width  = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const scale = Math.min(canvas.width / W, canvas.height / H);
    state.viewScale   = scale;
    state.viewOffsetX = (canvas.width  - W * scale) / 2;
    state.viewOffsetY = (canvas.height - H * scale) / 2;
  }

  // ---------- Input ----------
  const keys = {};

  function onKey(e) {
    const down = e.type === 'keydown';
    const k = e.code;
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight',
         'KeyW','KeyA','KeyS','KeyD'].includes(k)) {
      e.preventDefault();
      keys[k] = down;
    }
    if (k === 'Escape' && down && state.running) {
      stop();
      window.GameState.showMenu();
    }
  }
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup',   onKey);

  function bindDpad() {
    document.querySelectorAll('[data-dir]').forEach(btn => {
      const map = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
      const code = map[btn.dataset.dir];
      function press(e)   { e.preventDefault(); keys[code] = true; }
      function release(e) { e.preventDefault(); keys[code] = false; }
      btn.addEventListener('pointerdown',   press,   { passive: false });
      btn.addEventListener('pointerup',     release, { passive: false });
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('pointerleave',  release);
    });
  }

  // ---------- Update ----------
  function update(dt) {
    const d    = state.duck;
    const diff = state.diff;
    const f    = dt / 16.67;
    const now  = performance.now();

    const up = keys['ArrowUp']    || keys['KeyW'] || keys['Space'];
    const dn = keys['ArrowDown']  || keys['KeyS'];
    const lt = keys['ArrowLeft']  || keys['KeyA'];
    const rt = keys['ArrowRight'] || keys['KeyD'];

    // Horizontal acceleration
    if (rt) { d.vx += diff.thrust * f; d.facing =  1; }
    if (lt) { d.vx -= diff.thrust * f; d.facing = -1; }
    d.vx = Math.max(-diff.maxVx, Math.min(diff.maxVx, d.vx));
    d.vx *= Math.pow(diff.drag, f);
    if (Math.abs(d.vx) < 0.05) d.vx = 0;

    // Vertical
    if (up) d.vy -= diff.thrust * 1.15 * f;
    if (dn) d.vy += diff.thrust * 0.70 * f;
    d.vy += diff.gravity * f;
    d.vy = Math.max(-diff.maxVy, Math.min(diff.maxVy, d.vy));
    d.vy *= Math.pow(diff.drag * 1.01, f);

    // Move
    d.x += d.vx * f;
    d.y += d.vy * f;

    // World horizontal bounds
    d.x = Math.max(60, Math.min(WW - 60, d.x));

    // Ground collision (soft land, no death)
    const gY = groundY(d.x) - 32;
    if (d.y > gY) {
      d.y  = gY;
      d.vy = d.vy > 1 ? -d.vy * 0.15 : 0;
    }
    // Sky ceiling
    if (d.y < 40) { d.y = 40; d.vy = Math.max(0, d.vy); }

    // Wing phase speeds up with movement
    d.wingPhase += (0.18 + Math.abs(d.vy) * 0.07 + Math.abs(d.vx) * 0.03) * f;

    // Body tilt
    const targetTilt = d.vy * 0.045 * d.facing;
    d.tilt += (targetTilt - d.tilt) * 0.10 * f;
    d.tilt  = Math.max(-0.45, Math.min(0.45, d.tilt));

    // Smooth camera follow
    const cam = state.cam;
    cam.x += (d.x - cam.x) * 0.09 * f;
    cam.y += (d.y - cam.y) * 0.09 * f;
    cam.x = Math.max(W / 2, Math.min(WW - W / 2, cam.x));
    cam.y = Math.max(H / 2, Math.min(WH - H / 2, cam.y));

    // Ring collection + timed respawn
    for (const r of state.rings) {
      if (r.taken) {
        if (now >= r.respawnAt) r.taken = false;
        continue;
      }
      if (Math.hypot(r.x - d.x, r.y - d.y) < r.r + 22) {
        r.taken = true;
        r.respawnAt = now + 6000;
        state.score++;
        scoreEl.textContent = state.score;
        window.GameState.setHiScore(state.score);
      }
    }
  }

  // World → screen helpers
  function sx(wx) { return wx - state.cam.x + W / 2; }
  function sy(wy) { return wy - state.cam.y + H / 2; }

  // ---------- Render ----------
  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(
      state.viewScale, 0, 0, state.viewScale,
      state.viewOffsetX, state.viewOffsetY
    );

    drawSky();
    drawWorldClouds();
    drawLakes();
    drawGround();
    drawTrees();
    drawRings();
    drawDuckSprite();
    drawMinimap();
  }

  function theme() {
    const t = state.theme;
    if (t === 'sunset') return {
      sky1: '#e8602a', sky2: '#ffd090', sky3: '#ffb06a',
      ground1: '#c45f38', ground2: '#964830',
      tree: '#3a1a08', cloud: 'rgba(255,210,160,.75)',
      water: '#c86828',
    };
    if (t === 'night') return {
      sky1: '#060c22', sky2: '#112060', sky3: '#1a2870',
      ground1: '#1c2c54', ground2: '#0e1a36',
      tree: '#0c1a34', cloud: 'rgba(160,190,255,.22)',
      water: '#1a3a80',
    };
    return {
      sky1: '#58a8f0', sky2: '#c4e4ff', sky3: '#a0ccee',
      ground1: '#62b462', ground2: '#449844',
      tree: '#286428', cloud: 'rgba(255,255,255,.88)',
      water: '#42aad8',
    };
  }

  function drawSky() {
    const c = theme();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, c.sky1);
    g.addColorStop(1, c.sky2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (state.theme === 'night') {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 70; i++) {
        const x = (i * 157.3) % W;
        const y = (i * 61.7)  % (H * 0.72);
        ctx.globalAlpha = 0.2 + ((i * 7) % 7) / 10;
        ctx.fillRect(x, y, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawWorldClouds() {
    const c = theme();
    ctx.fillStyle = c.cloud;
    for (const cl of state.worldClouds) {
      const scx = sx(cl.x), scy = sy(cl.y);
      if (scx < -cl.r * 3 || scx > W + cl.r * 3) continue;
      if (scy < -cl.r * 3 || scy > H + cl.r * 3) continue;
      ctx.beginPath();
      ctx.arc(scx,                   scy,     cl.r,        0, Math.PI * 2);
      ctx.arc(scx + cl.r * 0.80,    scy + 5, cl.r * 0.75, 0, Math.PI * 2);
      ctx.arc(scx - cl.r * 0.65,    scy + 7, cl.r * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawLakes() {
    const c = theme();
    for (const l of state.lakes) {
      const lx = sx(l.x), ly = sy(l.y);
      if (lx + l.rx < 0 || lx - l.rx > W) continue;
      ctx.fillStyle = c.water;
      ctx.beginPath();
      ctx.ellipse(lx, ly, l.rx, l.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.20)';
      ctx.beginPath();
      ctx.ellipse(lx - l.rx * .2, ly - l.ry * .2, l.rx * .38, l.ry * .28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGround() {
    const c    = theme();
    const left  = state.cam.x - W / 2 - 50;
    const right = state.cam.x + W / 2 + 50;
    const step  = 6;

    // Main terrain fill
    ctx.fillStyle = c.ground1;
    ctx.beginPath();
    ctx.moveTo(sx(left), H + 20);
    for (let x = left; x <= right; x += step) {
      ctx.lineTo(sx(x), sy(groundY(x)));
    }
    ctx.lineTo(sx(right), H + 20);
    ctx.closePath();
    ctx.fill();

    // Darker bottom strip
    ctx.fillStyle = c.ground2;
    ctx.beginPath();
    ctx.moveTo(sx(left), H + 20);
    for (let x = left; x <= right; x += step) {
      ctx.lineTo(sx(x), sy(groundY(x) + 22));
    }
    ctx.lineTo(sx(right), H + 20);
    ctx.closePath();
    ctx.fill();
  }

  function drawTrees() {
    const c = theme();
    for (const t of state.trees) {
      const tx = sx(t.x), ty = sy(t.y);
      if (tx < -50 || tx > W + 50 || ty > H + 20 || ty < -60) continue;
      const h = t.h;

      if (t.type === 0) {
        // Conifer
        ctx.fillStyle = c.tree;
        ctx.beginPath();
        ctx.moveTo(tx, ty - h);
        ctx.lineTo(tx + h * .44, ty);
        ctx.lineTo(tx - h * .44, ty);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(tx, ty - h * 1.35);
        ctx.lineTo(tx + h * .29, ty - h * .52);
        ctx.lineTo(tx - h * .29, ty - h * .52);
        ctx.closePath();
        ctx.fill();
      } else if (t.type === 1) {
        // Round tree
        ctx.fillStyle = c.tree;
        ctx.fillRect(tx - 3, ty - h * .55, 6, h * .55);
        ctx.beginPath();
        ctx.arc(tx, ty - h * .62, h * .46, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Palm
        ctx.strokeStyle = c.tree;
        ctx.lineWidth   = 4;
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo(tx + h * .15, ty - h * .5, tx, ty - h);
        ctx.stroke();
        for (let i = 0; i < 5; i++) {
          const ang = (i / 5) * Math.PI * 2 - 0.4;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(tx, ty - h);
          ctx.quadraticCurveTo(
            tx + Math.cos(ang) * h * .55, ty - h - Math.sin(ang) * h * .22,
            tx + Math.cos(ang) * h * .48, ty - h + 8
          );
          ctx.stroke();
        }
      }
    }
  }

  function drawRings() {
    for (const r of state.rings) {
      if (r.taken) continue;
      const rx = sx(r.x), ry = sy(r.y);
      if (rx < -40 || rx > W + 40 || ry < -40 || ry > H + 40) continue;
      ctx.save();
      ctx.strokeStyle  = '#ffd400';
      ctx.lineWidth    = 5;
      ctx.shadowColor  = 'rgba(255,212,0,.75)';
      ctx.shadowBlur   = 14;
      ctx.beginPath();
      ctx.arc(rx, ry, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawDuckSprite() {
    const d = state.duck;
    window.drawDuck(ctx, sx(d.x), sy(d.y), window.GameState.state.duck, {
      wingPhase: d.wingPhase,
      tilt:      d.tilt,
      facing:    d.facing,
    });
  }

  function drawMinimap() {
    const mw = 120, mh = 60;
    const mx = W - mw - 10, my = H - mh - 10;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(mx, my, mw, mh, 6) : ctx.rect(mx, my, mw, mh);
    ctx.fill();

    function mmX(wx) { return mx + (wx / WW) * mw; }
    function mmY(wy) { return my + (wy / WH) * mh; }

    // Rings
    ctx.fillStyle = '#ffd400';
    for (const r of state.rings) {
      if (!r.taken) ctx.fillRect(mmX(r.x) - 1, mmY(r.y) - 1, 2, 2);
    }

    // Viewport rect
    const vl = state.cam.x - W / 2, vt = state.cam.y - H / 2;
    ctx.strokeStyle = 'rgba(255,255,255,.45)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(mmX(vl), mmY(vt), (W / WW) * mw, (H / WH) * mh);

    // Duck dot
    const d = state.duck;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(mmX(d.x), mmY(d.y), 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---------- Loop ----------
  function tick(ts) {
    if (!state.running) return;
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min(50, ts - state.lastTs);
    state.lastTs = ts;
    update(dt);
    render();
    state.raf = requestAnimationFrame(tick);
  }

  function reset() {
    const cfg = window.GameState.state.settings;
    state.diff  = DIFF[cfg.difficulty] || DIFF.normal;
    state.theme = cfg.theme || 'day';
    const d = state.duck;
    d.x = WW / 2; d.y = WH / 3;
    d.vx = 0; d.vy = 0;
    d.wingPhase = 0; d.facing = 1; d.tilt = 0;
    state.cam.x = d.x; state.cam.y = d.y;
    state.score = 0;
    scoreEl.textContent = '0';
    for (const r of state.rings) r.taken = false;
    for (const k of Object.keys(keys)) keys[k] = false;
  }

  function start() {
    resizeCanvas();
    generateMap();
    reset();
    state.running = true;
    state.lastTs  = 0;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = requestAnimationFrame(tick);
  }

  function stop() {
    state.running = false;
    if (state.raf) { cancelAnimationFrame(state.raf); state.raf = null; }
    for (const k of Object.keys(keys)) keys[k] = false;
  }

  window.Game = { start, stop };
  window.addEventListener('resize', () => { resizeCanvas(); if (!state.running) renderIdle(); });

  function renderIdle() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, '#58a8f0'); g.addColorStop(1, '#c4e4ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  resizeCanvas();
  bindDpad();
  renderIdle();
})();
