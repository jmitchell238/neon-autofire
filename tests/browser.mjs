#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const failures = [];
function assert(condition, message) {
  if (condition) { passed++; process.stdout.write('.'); }
  else { failures.push(message); console.error('\n  ✗', message); }
}

class FakeClassList {
  constructor() { this.values = new Set(); }
  toggle(name, force) {
    const enabled = force == null ? !this.values.has(name) : force;
    if (enabled) this.values.add(name); else this.values.delete(name);
    return enabled;
  }
  contains(name) { return this.values.has(name); }
}

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.style = {};
    this.dataset = {};
    this.classList = new FakeClassList();
    this.listeners = new Map();
    this.textContent = '';
  }
  addEventListener(type, callback) {
    const list = this.listeners.get(type) || [];
    list.push(callback);
    this.listeners.set(type, list);
  }
  dispatch(type, event = {}) {
    event.preventDefault ||= () => { event.defaultPrevented = true; };
    event.stopPropagation ||= () => {};
    for (const callback of this.listeners.get(type) || []) callback(event);
  }
  getBoundingClientRect() { return { left: 0, top: 0, width: 390, height: 700 }; }
  setPointerCapture() {}
}

function canvasContext() {
  const gradient = { addColorStop() {} };
  const methods = new Set([
    'save', 'restore', 'translate', 'scale', 'rotate', 'drawImage', 'fillRect',
    'strokeRect', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'ellipse',
    'quadraticCurveTo', 'arcTo', 'fill', 'stroke', 'fillText', 'strokeText', 'setTransform',
    'clearRect', 'rect', 'clip',
  ]);
  return new Proxy({
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    measureText: text => ({ width: String(text).length * 7 }),
  }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (methods.has(prop)) return () => {};
      return target[prop];
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
}

class FakeAudioContext {
  constructor() { this.currentTime = 0; this.state = 'suspended'; this.destination = {}; }
  resume() { this.state = 'running'; }
  createOscillator() {
    return {
      frequency: { setValueAtTime() {}, linearRampToValueAtTime() {} },
      connect() {}, start() {}, stop() {}, type: '',
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
    };
  }
}

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ids = [...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
const elements = new Map(ids.map(id => [id, new FakeElement(id)]));
const screens = ['screenMenu', 'screenOver'].map(id => elements.get(id));
screens[0].dataset.screen = 'menu';
screens[1].dataset.screen = 'over';
const playChrome = ['btnPauseMenu', 'playHint'].map(id => elements.get(id));
const ctx = canvasContext();
const canvas = elements.get('cv');
canvas.getContext = () => ctx;

const documentListeners = new Map();
const windowListeners = new Map();
const animationFrames = [];
let reloads = 0;
const workerListeners = new Map();
const registration = {
  waiting: { postMessage() {} },
  installing: null,
  update: () => Promise.resolve(),
  addEventListener(type, callback) { this[type] = callback; },
};

class FakeImage {
  constructor() { this.width = 192; this.height = 256; }
  set src(value) { this._src = value; queueMicrotask(() => this.onload?.()); }
  get src() { return this._src; }
}

const sandbox = {
  console,
  Math,
  URL,
  Promise,
  performance: { now: () => 1000 },
  innerWidth: 390,
  innerHeight: 700,
  devicePixelRatio: 1,
  Image: FakeImage,
  AudioContext: FakeAudioContext,
  webkitAudioContext: undefined,
  localStorage: {
    data: {},
    getItem(key) { return this.data[key] ?? null; },
    setItem(key, value) { this.data[key] = String(value); },
  },
  document: {
    hidden: false,
    getElementById: id => elements.get(id) || null,
    querySelectorAll(selector) {
      if (selector === '.screen') return screens;
      if (selector === '.play-chrome') return playChrome;
      return [];
    },
    addEventListener(type, callback) {
      const list = documentListeners.get(type) || []; list.push(callback); documentListeners.set(type, list);
    },
  },
  navigator: {
    serviceWorker: {
      controller: {},
      register: () => Promise.resolve(registration),
      addEventListener(type, callback) { workerListeners.set(type, callback); },
    },
  },
  location: {
    protocol: 'https:', hostname: 'localhost',
    reload() { reloads++; },
  },
  fetch: () => Promise.resolve({ ok: true, text: () => Promise.resolve("const GAME_VERSION = '1.3.000';") }),
  requestAnimationFrame(callback) { animationFrames.push(callback); return animationFrames.length; },
  setInterval() { return 1; },
  clearInterval() {},
  setTimeout(callback) { callback(); return 1; },
  addEventListener(type, callback) { windowListeners.set(type, callback); },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

const context = vm.createContext(sandbox);
const files = [
  'js/config.js', 'js/save.js', 'js/util.js', 'js/audio.js', 'js/sprites.js',
  'js/game-state.js', 'js/effects.js', 'js/world.js', 'js/player.js',
  'js/enemies.js', 'js/combat.js', 'js/game-systems.js', 'js/game.js',
  'js/render.js', 'js/main.js',
];
for (const rel of files) {
  vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), context, {
    filename: path.join(root, rel), timeout: 5000,
  });
}

const api = vm.runInContext(`({
  get stateValue() { return state; }, get playerValue() { return player; },
  get spritesReadyValue() { return spritesReady; }, get choices() { return levelChoices; },
  get platformsValue() { return platforms; }, get particlesValue() { return particles; },
  setState: value => { state = value; }, setSpritesReady: value => { spritesReady = value; },
  setAssetsLoaded: value => { assetsLoaded = value; }, setShake: value => { shake = value; },
  resetSpriteLoader: () => { spritesLoadPromise = null; spritesReady = false; for (const key of Object.keys(spriteCache)) delete spriteCache[key]; },
  startGame, startWave, spawnEnemy, openLevelUp, showMenu, showPlay, showOver,
  setScreen, updateMenuStats, applyVersionLabels, safeReloadForUpdate, registerSW, watchInstallingWorker,
  onPointerDown, onPointerMove, onPointerUp, onPointerCancel,
  onTouchStart, onTouchMove, onTouchEnd, touchClient, inputAxis, wantJumpThisFrame, frame, bootFrame,
  drawBackground, drawPlatforms, drawPlayer, drawEnemy, drawBullet, drawGem,
  drawPickup, drawOrbit, drawParticles, drawHud, drawControls,
  drawLevelUpOverlay, drawIdleDecor, drawLoading, levelUpHitTest,
  playerAnimKey, enemyAnimState, loadAllSprites, getSprite, animFrame, drawSprite,
  drawImageKey, drawImageTiled, enemySpriteKey, enemyUsesGrid,
  ensureAudio, beep, sfxShoot, sfxHit, sfxExplode, sfxPickup, sfxLevelUp,
  sfxHurt, sfxGameOver, sfxClick, sfxUpgrade, resizeCanvas,
  spriteCache, stick, keys,
})`, context);

await new Promise(resolve => setTimeout(resolve, 0));
await Promise.resolve();
console.log('\n• browser shell, sprites, audio, and rendering');

assert(api.spritesReadyValue, 'sprite manifest loads');
assert(api.getSprite('player/idle')?.ready, 'player sprite cached');
assert(api.animFrame({ fps: 4, frames: 4 }, 0.5, 1) === 2, 'animation frame calculation');
assert(api.enemySpriteKey('boss', 'run') === 'enemy/yakuzaBoss', 'boss sprite mapping');
assert(api.enemySpriteKey('hopper', 'jump') === 'enemy/punk/jump', 'hopper sprite mapping');
assert(api.enemyUsesGrid('flyer') && !api.enemyUsesGrid('grunt'), 'grid sprite classification');
assert(api.drawSprite(ctx, 'player/idle', 0, 10, 20, {}), 'sprite draws normally');
assert(api.drawSprite(ctx, 'player/idle', 1, 10, 20, { flip: true, alpha: 0.5 }), 'sprite draws flipped');
assert(api.drawImageKey(ctx, 'bg/city', 0, 0, 100, 100), 'full image draws');
assert(api.drawImageTiled(ctx, 'tile/1', 0, 0, 100, 20, 20, 20, 0), 'tiled image draws');
assert(!api.drawSprite(ctx, 'missing', 0, 0, 0), 'missing sprite falls back');

api.startGame();
api.startWave();
api.spawnEnemy('grunt');
api.spawnEnemy('flyer');
const p = api.playerValue;
api.drawBackground(ctx, 0, 0);
api.drawPlatforms(ctx, 0);
api.drawPlayer(ctx, p, 1, 0);
for (const type of ['grunt', 'hopper', 'brute', 'flyer', 'gunner', 'boss']) {
  const enemy = { type, x: 100, y: 400, w: 30, h: 40, r: 18, hp: 10, maxHp: 20,
    vx: 20, vy: 0, flash: 0, onGround: true, fly: type === 'flyer', facing: -1, color: '#fff' };
  api.drawEnemy(ctx, enemy, 0, 1);
}
api.drawBullet(ctx, { x: 20, y: 30, r: 4, color: '#fff', vx: 1 }, 0);
api.drawGem(ctx, { x: 20, y: 30, r: 5 }, 1, 0);
api.drawPickup(ctx, { x: 20, y: 30, r: 8, kind: 'heal' }, 1, 0);
api.drawOrbit(ctx, { x: 20, y: 30, size: 6 }, 0);
api.drawParticles(ctx, 0);
api.drawHud(ctx, p, 10, 20, 2);
api.drawControls(ctx, api.stick);
api.openLevelUp();
api.drawLevelUpOverlay(ctx, api.choices);
api.drawIdleDecor(ctx, 1);
api.drawLoading(ctx, 0.5);
assert(true, 'all render entry points execute');

assert(api.playerAnimKey({ hp: 0 }) === 'player/death', 'death animation state');
assert(api.playerAnimKey({ hp: 1, inv: 0.6 }) === 'player/hurt', 'hurt animation state');
assert(api.playerAnimKey({ hp: 1, inv: 0, onGround: false, vy: -1 }) === 'player/jump', 'jump animation state');
assert(api.enemyAnimState({ flash: 0.1 }) === 'hurt', 'enemy hurt animation state');
assert(api.enemyAnimState({ flash: 0, onGround: false, fly: false }) === 'jump', 'enemy jump state');

api.setState('menu');
api.showPlay();
assert(api.stateValue === 'play', 'play button flow starts game');
api.showMenu();
assert(api.stateValue === 'menu', 'menu flow resets screen');
api.setState('over');
api.showOver();
assert(!screens[1].classList.contains('hidden'), 'game-over screen shown');
elements.get('btnHow').dispatch('click');
elements.get('muteBtn').dispatch('click');
elements.get('muteBtn').dispatch('click');
assert(elements.get('versionTag').textContent.includes('1.3.000'), 'version labels applied');

api.ensureAudio();
api.beep({ freq: 100, slide: 20 });
api.sfxShoot(); api.sfxHit(); api.sfxExplode(false); api.sfxExplode(true);
api.sfxPickup(); api.sfxLevelUp(); api.sfxHurt(); api.sfxGameOver(); api.sfxClick(); api.sfxUpgrade();
assert(true, 'all audio entry points execute');

api.setState('play');
api.onPointerDown({ clientX: 350, clientY: 650, pointerId: 1, preventDefault() {} });
api.onPointerUp({ pointerId: 1 });
api.onPointerDown({ clientX: 50, clientY: 650, pointerId: 2, preventDefault() {} });
api.onPointerMove({ clientX: 80, clientY: 640, pointerId: 2, preventDefault() {} });
api.onPointerUp({ pointerId: 2 });
api.onPointerCancel();
assert(!api.stick.active && !api.stick.jumpDown, 'pointer controls reset cleanly');

api.onTouchStart({ changedTouches: [{ clientX: 40, clientY: 650, identifier: 3 }], preventDefault() {} });
api.onTouchMove({ changedTouches: [{ clientX: 70, clientY: 640, identifier: 3 }], preventDefault() {} });
api.onTouchEnd({ changedTouches: [{ identifier: 3 }] });
assert(!api.stick.active, 'touch movement lifecycle');

api.setState('menu');
api.frame(1033);
api.setState('play');
api.frame(1066);
api.setState('levelup');
api.frame(1099);
assert(animationFrames.length > 0, 'animation loop schedules frames');
assert(api.levelUpHitTest(300, canvas.getBoundingClientRect(), api.choices) >= -1, 'level-up hit testing executes');

api.setState('menu');
api.safeReloadForUpdate();
assert(reloads === 1, 'safe update reloads outside gameplay');
sandbox.__reloaded = false;
api.setState('play');
api.safeReloadForUpdate();
api.showMenu();
assert(reloads === 2, 'gameplay update defers reload until menu');

// Alternate render, input, UI, update, and boot branches.
const savedSprites = {};
for (const key of ['bg/city', 'bg/city1x', 'tile/1', 'tile/2', 'tile/3', 'fx/bullet', 'fx/gem', 'fx/heal', 'fx/orbit']) {
  savedSprites[key] = api.spriteCache[key];
  api.spriteCache[key] = { ready: false };
}
api.drawBackground(ctx, 0, 0);
api.drawPlatforms(ctx, 0);
api.drawBullet(ctx, { x: 1, y: 1, vx: 0, vy: 0, r: 2 }, 0);
api.drawGem(ctx, { x: 1, y: 1 }, 0, 0);
api.drawPickup(ctx, { x: 1, y: 1, r: 2 }, 0, 0);
api.drawOrbit(ctx, { x: 1, y: 1, size: 2 }, 0);
for (const [key, value] of Object.entries(savedSprites)) api.spriteCache[key] = value;
for (const variant of [
  { ...p, hp: 0 }, { ...p, hp: 10, inv: 0.6 },
  { ...p, hp: 10, inv: 0, onGround: false, vy: -300 },
  { ...p, hp: 10, inv: 0, onGround: false, vy: -20 },
  { ...p, hp: 10, inv: 0, onGround: false, vy: 100 },
  { ...p, hp: 10, inv: 0, onGround: false, vy: 300 },
]) api.drawPlayer(ctx, variant, 1, 0);
api.drawHud(ctx, { ...p, xp: 5, xpNext: 10 }, 1, 2, 3);
api.drawOrbit(ctx, {}, 0);
api.openLevelUp();
assert(api.levelUpHitTest(200, canvas.getBoundingClientRect(), api.choices) === 0, 'level-up hit selects first card');
assert(true, 'fallback render paths execute');

api.setState('play');
api.stick.active = true; api.stick.dx = 0.8; api.stick.dy = -0.4;
assert(api.inputAxis().x > 0, 'active stick contributes input axis');
api.stick.jumpQueued = true;
assert(api.wantJumpThisFrame(), 'queued touch jump consumed');
api.stick.id = 11; api.stick.ox = 0; api.stick.oy = 700;
api.onPointerMove({ clientX: 390, clientY: 0, pointerId: 11, preventDefault() {} });
assert(Math.hypot(api.stick.dx, api.stick.dy) <= 1.001, 'stick input normalized');

api.openLevelUp();
api.onPointerDown({ clientX: 100, clientY: 200, pointerId: 7, preventDefault() {} });
assert(api.stateValue === 'play', 'pointer selects level-up card');
api.openLevelUp();
api.onTouchStart({ changedTouches: [{ clientX: 100, clientY: 200, identifier: 8 }], preventDefault() {} });
assert(api.stateValue === 'play', 'touch selects level-up card');
api.setState('play');
api.onTouchStart({ changedTouches: [{ clientX: 350, clientY: 650, identifier: 9 }], preventDefault() {} });
api.onTouchEnd({ changedTouches: [{ identifier: 9 }] });
assert(!api.stick.jumpDown, 'touch jump lifecycle');
assert(api.touchClient({}) === null, 'touch helper handles empty event');

const keydown = windowListeners.get('keydown');
const keyup = windowListeners.get('keyup');
api.setState('menu');
keydown({ key: 'Enter', preventDefault() {} });
keydown({ key: ' ', preventDefault() {} });
keyup({ key: ' ' });
keydown({ key: 'Escape', preventDefault() {} });
assert(api.stateValue === 'menu', 'keyboard start, jump, and menu routes');
api.openLevelUp();
keydown({ key: '1', preventDefault() {} });
assert(api.stateValue === 'play', 'number key selects upgrade');
windowListeners.get('resize')();
elements.get('btnPlay').dispatch('click');
elements.get('btnRetry').dispatch('click');
elements.get('btnMenu').dispatch('click');
elements.get('btnPauseMenu').dispatch('click');
assert(true, 'all menu button handlers execute');

sandbox.__pendingReload = true;
sandbox.__reloaded = false;
api.setState('over');
api.showOver();
assert(reloads >= 3, 'game-over flow applies deferred reload');
const fakeWorker = { state: 'installed', postMessage() { this.posted = true; }, addEventListener(type, callback) { this.callback = callback; } };
api.watchInstallingWorker({ installing: fakeWorker });
fakeWorker.callback();
assert(fakeWorker.posted, 'installed service worker activates');
api.watchInstallingWorker({ installing: null });
api.setAssetsLoaded(false);
api.bootFrame(1200);
api.setAssetsLoaded(true);
api.bootFrame(1233);
assert(true, 'loading and loaded boot frames execute');
// Remaining fallback and browser lifecycle lines.
const floating = { x: 20, y: 300, w: 100, h: 14, ground: false };
api.platformsValue.push(floating);
const tileKeys = ['tile/1', 'tile/2', 'tile/3'];
const tileBackup = Object.fromEntries(tileKeys.map(key => [key, api.spriteCache[key]]));
for (const key of tileKeys) api.spriteCache[key] = { ready: false };
api.drawPlatforms(ctx, 0);
for (const key of tileKeys) api.spriteCache[key] = tileBackup[key];
const idleBackup = api.spriteCache['player/idle'];
api.spriteCache['player/idle'] = { ready: false };
api.drawPlayer(ctx, { ...p, hp: 10, inv: 0, onGround: true, vx: 0 }, 1, 0);
api.spriteCache['player/idle'] = idleBackup;
const enemyKeys = ['enemy/biker/run', 'enemy/biker/idle'];
const enemyBackup = Object.fromEntries(enemyKeys.map(key => [key, api.spriteCache[key]]));
for (const key of enemyKeys) api.spriteCache[key] = { ready: false };
api.drawEnemy(ctx, { type: 'grunt', x: 100, y: 400, w: 24, h: 40, r: 18,
  hp: 10, maxHp: 20, vx: 20, vy: 0, flash: 0, onGround: true, fly: false, facing: -1, color: '#fff' }, 0, 1);
for (const key of enemyKeys) api.spriteCache[key] = enemyBackup[key];
api.particlesValue.push({ x: 10, y: 10, r: 2, life: 0.5, max: 1, color: '#fff' });
api.drawParticles(ctx, 0);
api.setShake(3);
api.setState('play');
api.frame(1300);
for (const callback of documentListeners.get('visibilitychange') || []) callback();
windowListeners.get('focus')?.();
workerListeners.get('controllerchange')?.();
await Promise.resolve();
assert(true, 'shake, visibility, focus, and controller-change routes execute');

class FailingImage { set src(value) { queueMicrotask(() => this.onerror?.()); } }
const workingImage = sandbox.Image;
sandbox.Image = FailingImage;
api.resetSpriteLoader();
assert(!(await api.loadAllSprites()), 'sprite loader tolerates complete image failure');
sandbox.Image = workingImage;
console.log(`\n${passed} browser assertions passed, ${failures.length} failed`);
if (failures.length) process.exitCode = 1;
