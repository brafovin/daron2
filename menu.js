// Menu wiring: live preview + persistence.
// Exposes window.GameState with current duck/settings/highscore + helpers.

(function () {
  const STORAGE_KEY = 'duckGame.v1';

  const state = {
    duck: Object.assign({}, window.DUCK_DEFAULTS),
    settings: Object.assign({}, window.SETTING_DEFAULTS),
    hiscore: 0,
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.duck) Object.assign(state.duck, parsed.duck);
      if (parsed.settings) Object.assign(state.settings, parsed.settings);
      if (typeof parsed.hiscore === 'number') state.hiscore = parsed.hiscore;
    } catch (_) { /* ignore corrupt storage */ }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) { /* quota or disabled — ignore */ }
  }

  // ---------- Live preview ----------
  const preview = document.getElementById('preview');
  const pctx = preview.getContext('2d');
  let previewPhase = 0;
  let previewRAF = null;

  function renderPreview() {
    const w = preview.width, h = preview.height;
    pctx.clearRect(0, 0, w, h);
    // soft cloud behind
    pctx.fillStyle = 'rgba(255,255,255,0.55)';
    pctx.beginPath();
    pctx.ellipse(w * 0.5, h * 0.78, w * 0.42, 14, 0, 0, Math.PI * 2);
    pctx.fill();
    // duck
    window.drawDuck(pctx, w * 0.5, h * 0.55, state.duck, {
      wingPhase: previewPhase,
      tilt: Math.sin(previewPhase * 0.5) * 0.05,
      scale: 1.1,
    });
  }

  function previewLoop() {
    previewPhase += 0.18;
    renderPreview();
    previewRAF = requestAnimationFrame(previewLoop);
  }

  function startPreview() {
    if (previewRAF == null) previewLoop();
  }

  function stopPreview() {
    if (previewRAF != null) {
      cancelAnimationFrame(previewRAF);
      previewRAF = null;
    }
  }

  // ---------- Bind controls ----------
  function applyToInputs() {
    document.querySelectorAll('[data-cfg]').forEach((el) => {
      const key = el.dataset.cfg;
      const v = state.duck[key];
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = v;
    });
    document.querySelectorAll('[data-set]').forEach((el) => {
      const key = el.dataset.set;
      el.value = state.settings[key];
    });
    document.getElementById('hiscore').textContent = state.hiscore;
  }

  function bindControls() {
    document.querySelectorAll('[data-cfg]').forEach((el) => {
      el.addEventListener('input', () => {
        const key = el.dataset.cfg;
        state.duck[key] = el.type === 'checkbox' ? el.checked : el.value;
        save();
      });
    });
    document.querySelectorAll('[data-set]').forEach((el) => {
      el.addEventListener('change', () => {
        state.settings[el.dataset.set] = el.value;
        save();
      });
    });
  }

  // ---------- Menu visibility ----------
  const menuEl = document.getElementById('menu');
  const hudEl = document.getElementById('hud');
  const gameOverEl = document.getElementById('gameover');

  function showMenu() {
    menuEl.classList.remove('hidden');
    hudEl.classList.add('hidden');
    gameOverEl.classList.add('hidden');
    document.getElementById('hiscore').textContent = state.hiscore;
    startPreview();
  }

  function hideMenu() {
    menuEl.classList.add('hidden');
    hudEl.classList.remove('hidden');
    stopPreview();
  }

  function showGameOver(score) {
    document.getElementById('finalScore').textContent = score;
    document.getElementById('finalHi').textContent = state.hiscore;
    gameOverEl.classList.remove('hidden');
    hudEl.classList.add('hidden');
  }

  function hideGameOver() {
    gameOverEl.classList.add('hidden');
  }

  // ---------- Init ----------
  load();
  applyToInputs();
  bindControls();

  // Menu buttons wire to game.js via window.Game
  document.getElementById('play').addEventListener('click', () => {
    hideMenu();
    window.Game.start();
  });
  document.getElementById('backToMenu').addEventListener('click', () => {
    window.Game.stop();
    showMenu();
  });
  document.getElementById('again').addEventListener('click', () => {
    hideGameOver();
    hudEl.classList.remove('hidden');
    window.Game.start();
  });
  document.getElementById('toMenu').addEventListener('click', () => {
    hideGameOver();
    showMenu();
  });

  window.GameState = {
    state,
    save,
    showMenu,
    hideMenu,
    showGameOver,
    hideGameOver,
    setHiScore(v) {
      if (v > state.hiscore) {
        state.hiscore = v;
        save();
      }
    },
  };

  // start with menu visible & preview animating
  showMenu();
})();
