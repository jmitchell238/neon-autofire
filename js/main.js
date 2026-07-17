'use strict';

const cv = document.getElementById('cv');
const stage = document.getElementById('stage');
let ctx = null;
let last = performance.now();

// Virtual stick (move) + jump button
const stick = {
  active: false,
  dx: 0,
  dy: 0,
  id: null,
  ox: 0,
  oy: 0,
  jumpDown: false,
  jumpId: null,
  jumpQueued: false,
};
const keys = Object.create(null);
const STICK_R = 40;
const JUMP_BTN = { x: W - 58, y: H - 52, r: 34 };

function setScreen(name) {
  document.querySelectorAll('.screen').forEach(el => {
    el.classList.toggle('hidden', el.dataset.screen !== name);
  });
  document.querySelectorAll('.play-chrome').forEach(el => {
    el.classList.toggle('hidden', name !== 'play' && name !== 'levelup');
  });
}

function updateMenuStats() {
  document.getElementById('statBest').textContent = String(save.best);
  document.getElementById('statGames').textContent = String(save.games);
  document.getElementById('statWave').textContent = String(save.bestWave);
  const muteBtn = document.getElementById('muteBtn');
  if (muteBtn) muteBtn.textContent = save.muted ? '🔇 Sound off' : '🔊 Sound on';
}

function showMenu() {
  state = 'menu';
  resetStick();
  updateMenuStats();
  setScreen('menu');
  if (window.__pendingReload) {
    window.__pendingReload = false;
    window.__reloaded = true;
    location.reload();
  }
}

function showPlay() {
  ensureAudio();
  startGame();
  startWave();
  resetStick();
  setScreen('play');
}

function showOver() {
  resetStick();
  setScreen('over');
  document.getElementById('overScore').textContent = String(Math.floor(score));
  document.getElementById('overBest').textContent = String(save.best);
  document.getElementById('overWave').textContent = String(wave);
  document.getElementById('overKills').textContent = String(kills);
  document.getElementById('overReason').textContent = overReason;
  const newBest = Math.floor(score) > 0 && Math.floor(score) >= save.best;
  document.getElementById('newBest').classList.toggle('hidden', !newBest);
  if (window.__pendingReload) {
    window.__pendingReload = false;
    window.__reloaded = true;
    location.reload();
  }
}

function resetStick() {
  stick.active = false;
  stick.dx = 0;
  stick.dy = 0;
  stick.id = null;
  stick.jumpDown = false;
  stick.jumpId = null;
  stick.jumpQueued = false;
  setJumpHeld(false);
}

function canvasRect() {
  return cv.getBoundingClientRect();
}

function clientToStage(clientX, clientY) {
  const rect = canvasRect();
  return {
    x: (clientX - rect.left) / (rect.width / W),
    y: (clientY - rect.top) / (rect.height / H),
  };
}

function hitJumpBtn(sx, sy) {
  return dist(sx, sy, JUMP_BTN.x, JUMP_BTN.y) <= JUMP_BTN.r + 8;
}

function keyboardAxis() {
  let x = 0, y = 0;
  if (keys.ArrowLeft || keys.a || keys.A) x -= 1;
  if (keys.ArrowRight || keys.d || keys.D) x += 1;
  if (keys.ArrowUp || keys.w || keys.W) y -= 1;
  if (keys.ArrowDown || keys.s || keys.S) y += 1;
  return { x, y };
}

function inputAxis() {
  const k = keyboardAxis();
  if (stick.active && Math.abs(stick.dx) > 0.05) {
    return {
      x: clamp(stick.dx + k.x * 0.35, -1, 1),
      y: clamp((stick.dy || 0) * 0.5 + k.y * 0.5, -1, 1),
    };
  }
  return k;
}

function wantJumpThisFrame() {
  const kJump = !!(keys[' '] || keys.ArrowUp || keys.w || keys.W || keys.Spacebar);
  if (kJump) setJumpHeld(true);
  else if (!stick.jumpDown) setJumpHeld(false);

  if (stick.jumpQueued) {
    stick.jumpQueued = false;
    return true;
  }
  // Keyboard edge: main also sets keys; request every frame while held is ok (buffer)
  return kJump;
}

// ---- Frame ------------------------------------------------------------------
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  const t = now / 1000;

  if (!ctx) ({ ctx } = resizeCanvas(cv));

  if (state === 'play') {
    const axis = inputAxis();
    updatePlay(dt, axis.x, axis.y, wantJumpThisFrame());
    if (state === 'over') showOver();
  }

  const cam = cameraX;

  ctx.save();
  if (shake > 0 && (state === 'play' || state === 'levelup')) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  if (state === 'menu') {
    drawIdleDecor(ctx, t);
  } else {
    drawBackground(ctx, cam, t);
    drawPlatforms(ctx, cam);
    for (const g of gems) drawGem(ctx, g, t, cam);
    for (const p of pickups) drawPickup(ctx, p, t, cam);
    for (const b of eBullets) drawBullet(ctx, b, cam);
    for (const e of enemies) drawEnemy(ctx, e, cam);
    for (const b of bullets) drawBullet(ctx, b, cam);
    for (const o of orbits) drawOrbit(ctx, o, cam);
    if (player) drawPlayer(ctx, player, t, cam);
    drawParticles(ctx, cam);
    drawHud(ctx, player, score, Math.max(save.best, Math.floor(score)), wave);
    if (state === 'play' || state === 'levelup') drawControls(ctx, stick);
  }

  if (state === 'levelup') {
    drawLevelUpOverlay(ctx, levelChoices);
  }

  ctx.restore();
  requestAnimationFrame(frame);
}

// ---- Pointer ----------------------------------------------------------------
function onPointerDown(e) {
  if (state === 'levelup') {
    ensureAudio();
    const idx = levelUpHitTest(e.clientY, canvasRect(), levelChoices);
    if (idx >= 0 && levelChoices[idx]) {
      e.preventDefault();
      applyUpgrade(levelChoices[idx]);
      if (state === 'play') setScreen('play');
    }
    return;
  }
  if (state !== 'play') return;
  ensureAudio();
  const p = clientToStage(e.clientX, e.clientY);

  // Right half / jump button → jump
  if (hitJumpBtn(p.x, p.y) || p.x > W * 0.62) {
    stick.jumpDown = true;
    stick.jumpId = e.pointerId;
    stick.jumpQueued = true;
    setJumpHeld(true);
    e.preventDefault();
    try { stage.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
    return;
  }

  // Left / center → move stick
  stick.active = true;
  stick.id = e.pointerId;
  stick.ox = p.x;
  stick.oy = p.y;
  updateStickFromStage(p.x, p.y);
  e.preventDefault();
  try { stage.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
}

function updateStickFromStage(sx, sy) {
  let dx = (sx - stick.ox) / STICK_R;
  let dy = (sy - stick.oy) / STICK_R;
  const len = Math.hypot(dx, dy);
  if (len > 1) {
    dx /= len;
    dy /= len;
  }
  stick.dx = dx;
  stick.dy = dy;
}

function onPointerMove(e) {
  if (state !== 'play') return;
  if (stick.active && (stick.id == null || e.pointerId === stick.id)) {
    const p = clientToStage(e.clientX, e.clientY);
    updateStickFromStage(p.x, p.y);
    e.preventDefault();
  }
}

function onPointerUp(e) {
  if (stick.jumpId != null && e.pointerId === stick.jumpId) {
    stick.jumpDown = false;
    stick.jumpId = null;
    setJumpHeld(false);
  }
  if (stick.id != null && e.pointerId === stick.id) {
    stick.active = false;
    stick.dx = 0;
    stick.dy = 0;
    stick.id = null;
  }
  // If no id tracking matched, clear all
  if (!stick.active && !stick.jumpDown) {
    // ok
  }
}

function onPointerCancel() {
  resetStick();
}

function touchClient(e) {
  const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
  if (!t) return null;
  return { x: t.clientX, y: t.clientY, id: t.identifier };
}

function onTouchStart(e) {
  if (state === 'levelup') {
    const t = touchClient(e);
    if (!t) return;
    const idx = levelUpHitTest(t.y, canvasRect(), levelChoices);
    if (idx >= 0 && levelChoices[idx]) {
      e.preventDefault();
      applyUpgrade(levelChoices[idx]);
      if (state === 'play') setScreen('play');
    }
    return;
  }
  if (state !== 'play') return;
  // Multi-touch: process all new touches
  const touches = e.changedTouches || [];
  for (let i = 0; i < touches.length; i++) {
    const t = touches[i];
    const p = clientToStage(t.clientX, t.clientY);
    if (hitJumpBtn(p.x, p.y) || p.x > W * 0.62) {
      stick.jumpDown = true;
      stick.jumpId = t.identifier;
      stick.jumpQueued = true;
      setJumpHeld(true);
    } else if (!stick.active) {
      stick.active = true;
      stick.id = t.identifier;
      stick.ox = p.x;
      stick.oy = p.y;
      updateStickFromStage(p.x, p.y);
    }
  }
  e.preventDefault();
}

function onTouchMove(e) {
  if (state !== 'play' || !stick.active) return;
  const touches = e.changedTouches || [];
  for (let i = 0; i < touches.length; i++) {
    const t = touches[i];
    if (stick.id != null && t.identifier !== stick.id) continue;
    const p = clientToStage(t.clientX, t.clientY);
    updateStickFromStage(p.x, p.y);
  }
  e.preventDefault();
}

function onTouchEnd(e) {
  const touches = e.changedTouches || [];
  for (let i = 0; i < touches.length; i++) {
    const t = touches[i];
    if (stick.jumpId != null && t.identifier === stick.jumpId) {
      stick.jumpDown = false;
      stick.jumpId = null;
      setJumpHeld(false);
    }
    if (stick.id != null && t.identifier === stick.id) {
      stick.active = false;
      stick.dx = 0;
      stick.dy = 0;
      stick.id = null;
    }
  }
}

const ptrOpts = { passive: false };
stage.addEventListener('pointerdown', onPointerDown, ptrOpts);
stage.addEventListener('pointermove', onPointerMove, ptrOpts);
stage.addEventListener('pointerup', onPointerUp, ptrOpts);
stage.addEventListener('pointercancel', onPointerCancel, ptrOpts);
stage.addEventListener('touchstart', onTouchStart, ptrOpts);
stage.addEventListener('touchmove', onTouchMove, ptrOpts);
stage.addEventListener('touchend', onTouchEnd, ptrOpts);
stage.addEventListener('touchcancel', onPointerCancel, ptrOpts);

// Keyboard
addEventListener('keydown', e => {
  keys[e.key] = true;

  if (state === 'levelup') {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= levelChoices.length) {
      e.preventDefault();
      applyUpgrade(levelChoices[n - 1]);
      if (state === 'play') setScreen('play');
    }
    return;
  }

  if (state !== 'play') {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (state === 'menu' || state === 'over') showPlay();
    }
    return;
  }

  if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
    e.preventDefault();
    requestJump();
    setJumpHeld(true);
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    showMenu();
  }
});

addEventListener('keyup', e => {
  keys[e.key] = false;
  if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
    setJumpHeld(false);
  }
});

addEventListener('resize', () => {
  ({ ctx } = resizeCanvas(cv));
});

// ---- UI ---------------------------------------------------------------------
document.getElementById('btnPlay').addEventListener('click', () => {
  sfxClick();
  showPlay();
});
document.getElementById('btnHow').addEventListener('click', () => {
  sfxClick();
  document.getElementById('howPanel').classList.toggle('hidden');
});
document.getElementById('btnRetry').addEventListener('click', () => {
  sfxClick();
  showPlay();
});
document.getElementById('btnMenu').addEventListener('click', () => {
  sfxClick();
  showMenu();
});
document.getElementById('btnPauseMenu').addEventListener('click', e => {
  e.stopPropagation();
  sfxClick();
  showMenu();
});
document.getElementById('muteBtn').addEventListener('click', () => {
  save.muted = !save.muted;
  persist();
  updateMenuStats();
  sfxClick();
});

function applyVersionLabels() {
  const label = GAME_NAME + ' ' + GAME_VERSION_LABEL;
  const tag = document.getElementById('versionTag');
  const menu = document.getElementById('versionMenu');
  const over = document.getElementById('versionOver');
  if (tag) tag.textContent = label;
  if (menu) menu.textContent = label + ' · PWA ready';
  if (over) over.textContent = label;
}

function safeReloadForUpdate() {
  if (window.__reloaded) return;
  if (state === 'play' || state === 'levelup') {
    window.__pendingReload = true;
    return;
  }
  window.__reloaded = true;
  location.reload();
}

function activateWaitingWorker(reg) {
  if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
}

function watchInstallingWorker(reg) {
  const worker = reg.installing;
  if (!worker) return;
  worker.addEventListener('statechange', () => {
    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
      worker.postMessage({ type: 'SKIP_WAITING' });
    }
  });
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (!(location.protocol === 'https:' || location.hostname === 'localhost' ||
        location.hostname === '127.0.0.1')) return;

  navigator.serviceWorker.register('./sw.js').then(reg => {
    activateWaitingWorker(reg);
    if (reg.installing) watchInstallingWorker(reg);
    reg.addEventListener('updatefound', () => watchInstallingWorker(reg));

    const checkForUpdate = () => { reg.update().catch(() => {}); };
    checkForUpdate();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkForUpdate();
    });
    window.addEventListener('focus', checkForUpdate);
    setInterval(checkForUpdate, 60 * 1000);

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      safeReloadForUpdate();
    });
  }).catch(err => console.warn('[sw] register failed', err));

  function checkRemoteVersion() {
    if (state === 'play' || state === 'levelup') return;
    fetch('js/config.js', { cache: 'no-store' })
      .then(r => r.ok ? r.text() : '')
      .then(text => {
        const m = text.match(/GAME_VERSION\s*=\s*['"]([^'"]+)['"]/);
        if (m && m[1] && m[1] !== GAME_VERSION) safeReloadForUpdate();
      })
      .catch(() => {});
  }
  checkRemoteVersion();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkRemoteVersion();
  });
  setInterval(checkRemoteVersion, 2 * 60 * 1000);
}

let assetsLoaded = false;

applyVersionLabels();
updateMenuStats();
setScreen('menu');
registerSW();
({ ctx } = resizeCanvas(cv));

function bootFrame(now) {
  if (!ctx) ({ ctx } = resizeCanvas(cv));
  if (!assetsLoaded) {
    drawLoading(ctx, 0.4);
    requestAnimationFrame(bootFrame);
    return;
  }
  last = now;
  frame(now);
}

loadAllSprites()
  .then(() => { assetsLoaded = true; })
  .catch(() => { assetsLoaded = true; });

requestAnimationFrame(bootFrame);