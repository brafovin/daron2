// Parametric duck renderer + default configuration.
// Exposes: window.DUCK_DEFAULTS, window.SETTING_DEFAULTS, window.drawDuck

(function () {
  const DUCK_DEFAULTS = {
    bodyColor: '#ffd400',
    wingColor: '#e6b800',
    beakColor: '#ff8a00',
    eyeColor: '#101010',
    size: 'medium',     // 'small' | 'medium' | 'large'
    hat: 'none',        // 'none' | 'crown' | 'cap' | 'wizard'
    sunglasses: false,
    rider: true,
  };

  const SETTING_DEFAULTS = {
    difficulty: 'normal',
    theme: 'day',
  };

  const SIZE_SCALE = { small: 0.8, medium: 1.0, large: 1.25 };

  // Draw a duck centered at (x, y).
  // opts:
  //   wingPhase: number — radians, controls wing flap
  //   tilt: number — radians, body rotation
  //   facing: 1 | -1 — horizontal flip
  function drawDuck(ctx, x, y, config, opts = {}) {
    const cfg = Object.assign({}, DUCK_DEFAULTS, config || {});
    const scale = (SIZE_SCALE[cfg.size] || 1) * (opts.scale || 1);
    const tilt = opts.tilt || 0;
    const facing = opts.facing || 1;
    const wingPhase = opts.wingPhase || 0;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.scale(scale * facing, scale);

    // ----- Tail -----
    ctx.fillStyle = cfg.bodyColor;
    ctx.beginPath();
    ctx.moveTo(-44, -4);
    ctx.lineTo(-62, -16);
    ctx.lineTo(-58, 2);
    ctx.closePath();
    ctx.fill();

    // ----- Body -----
    ctx.fillStyle = cfg.bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, 44, 28, 0, 0, Math.PI * 2);
    ctx.fill();

    // body shading
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    ctx.beginPath();
    ctx.ellipse(0, 10, 40, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // ----- Head -----
    const headX = 30, headY = -22;
    ctx.fillStyle = cfg.bodyColor;
    ctx.beginPath();
    ctx.arc(headX, headY, 20, 0, Math.PI * 2);
    ctx.fill();

    // neck blend
    ctx.beginPath();
    ctx.moveTo(headX - 14, headY + 8);
    ctx.quadraticCurveTo(headX - 4, headY + 22, 18, -2);
    ctx.lineTo(8, 8);
    ctx.closePath();
    ctx.fill();

    // ----- Beak -----
    ctx.fillStyle = cfg.beakColor;
    ctx.beginPath();
    ctx.moveTo(headX + 14, headY - 2);
    ctx.lineTo(headX + 38, headY + 2);
    ctx.lineTo(headX + 14, headY + 8);
    ctx.closePath();
    ctx.fill();
    // beak line
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(headX + 16, headY + 3);
    ctx.lineTo(headX + 36, headY + 2);
    ctx.stroke();

    // ----- Eye -----
    if (!cfg.sunglasses) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(headX + 6, headY - 4, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = cfg.eyeColor;
      ctx.beginPath();
      ctx.arc(headX + 7, headY - 4, 2.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // sunglasses
      ctx.fillStyle = '#101010';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(headX - 4, headY - 8, 22, 8, 2)
                    : ctx.rect(headX - 4, headY - 8, 22, 8);
      ctx.fill();
      ctx.strokeStyle = '#101010';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(headX + 18, headY - 4);
      ctx.lineTo(headX + 22, headY - 6);
      ctx.stroke();
      // shine
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(headX + 1, headY - 7, 5, 2);
      ctx.fillRect(headX + 11, headY - 7, 4, 2);
    }

    // ----- Hat -----
    drawHat(ctx, headX, headY, cfg.hat);

    // ----- Wing (animated) -----
    const flap = Math.sin(wingPhase);          // -1..1
    const wingAngle = -0.25 + flap * 0.55;     // tilt
    const wingY = -2 + flap * 4;
    ctx.save();
    ctx.translate(-2, wingY);
    ctx.rotate(wingAngle);
    ctx.fillStyle = cfg.wingColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(2, 4, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ----- Rider (small person on the back) -----
    if (cfg.rider) drawRider(ctx, -8, -22, flap);

    // ----- Feet (only visible when not flapping much) -----
    ctx.fillStyle = cfg.beakColor;
    ctx.beginPath();
    ctx.ellipse(-8, 26, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(10, 26, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawHat(ctx, hx, hy, hat) {
    if (!hat || hat === 'none') return;
    ctx.save();
    if (hat === 'crown') {
      ctx.fillStyle = '#ffcf2b';
      ctx.beginPath();
      ctx.moveTo(hx - 14, hy - 18);
      ctx.lineTo(hx - 14, hy - 28);
      ctx.lineTo(hx - 8,  hy - 22);
      ctx.lineTo(hx - 2,  hy - 32);
      ctx.lineTo(hx + 4,  hy - 22);
      ctx.lineTo(hx + 10, hy - 32);
      ctx.lineTo(hx + 14, hy - 22);
      ctx.lineTo(hx + 14, hy - 18);
      ctx.closePath();
      ctx.fill();
      // gems
      ctx.fillStyle = '#e23';
      ctx.beginPath(); ctx.arc(hx - 8, hy - 21, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2bd';
      ctx.beginPath(); ctx.arc(hx + 4, hy - 21, 1.6, 0, Math.PI * 2); ctx.fill();
    } else if (hat === 'cap') {
      ctx.fillStyle = '#1a73d8';
      // brim
      ctx.beginPath();
      ctx.ellipse(hx + 8, hy - 16, 14, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // crown
      ctx.beginPath();
      ctx.arc(hx - 2, hy - 20, 12, Math.PI, 0);
      ctx.lineTo(hx + 10, hy - 16);
      ctx.lineTo(hx - 14, hy - 16);
      ctx.closePath();
      ctx.fill();
    } else if (hat === 'wizard') {
      ctx.fillStyle = '#3b1d8a';
      ctx.beginPath();
      ctx.moveTo(hx - 16, hy - 16);
      ctx.lineTo(hx + 14, hy - 16);
      ctx.lineTo(hx - 6,  hy - 42);
      ctx.closePath();
      ctx.fill();
      // brim
      ctx.beginPath();
      ctx.ellipse(hx - 1, hy - 16, 18, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // stars
      ctx.fillStyle = '#ffd400';
      ctx.beginPath(); ctx.arc(hx - 6, hy - 26, 1.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(hx - 1, hy - 32, 1.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawRider(ctx, rx, ry, flap) {
    ctx.save();
    // body
    ctx.fillStyle = '#3a4ad8';
    ctx.beginPath();
    ctx.ellipse(rx, ry + 8, 7, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // head
    ctx.fillStyle = '#f3c79b';
    ctx.beginPath();
    ctx.arc(rx, ry - 4, 6, 0, Math.PI * 2);
    ctx.fill();
    // helmet
    ctx.fillStyle = '#e23';
    ctx.beginPath();
    ctx.arc(rx, ry - 5, 6.5, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(rx - 6.5, ry - 6, 13, 2);
    // arms (holding reins, lift with flap)
    ctx.strokeStyle = '#3a4ad8';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(rx + 4, ry + 6);
    ctx.lineTo(rx + 16, ry + 2 + flap * 1.5);
    ctx.stroke();
    // reins to beak area
    ctx.strokeStyle = '#3a2a18';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(rx + 16, ry + 2 + flap * 1.5);
    ctx.lineTo(rx + 50, ry + 14);
    ctx.stroke();
    ctx.restore();
  }

  window.DUCK_DEFAULTS = DUCK_DEFAULTS;
  window.SETTING_DEFAULTS = SETTING_DEFAULTS;
  window.drawDuck = drawDuck;
})();
