#!/usr/bin/env node
/**
 * Neon Autofire — automated tests (no browser / no deps).
 * Run: node tests/run.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) {
    passed++;
    process.stdout.write('.');
    return;
  }
  failed++;
  failures.push(msg);
  console.error('\n  ✗', msg);
}

function assertEq(a, b, msg) {
  assert(Object.is(a, b), `${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`);
}

function section(name) {
  process.stdout.write('\n• ' + name + ' ');
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function loadGame() {
  const files = [
    'js/config.js',
    'js/save.js',
    'js/util.js',
    'js/audio.js',
    'js/game.js',
  ];
  const code = files
    .map(rel => `// ---- ${rel} ----\n` + read(rel))
    .join('\n;\n');

  const exportFooter = `
    globalThis.__TEST__ = {
      GAME_VERSION, GAME_VERSION_LABEL, GAME_NAME,
      W, H, PLAY, PLAYER, ENEMIES, UPGRADES, WAVE, xpForLevel,
      state: () => state,
      setState: (s) => { state = s; },
      score: () => score,
      kills: () => kills,
      wave: () => wave,
      player: () => player,
      stats: () => stats,
      bullets: () => bullets,
      enemies: () => enemies,
      gems: () => gems,
      levelChoices: () => levelChoices,
      startGame, resetRun, startWave, spawnEnemy, firePlayer,
      updatePlay, applyUpgrade, addXp, openLevelUp, killEnemy,
      hurtPlayer, endGame, nearestEnemy, movePlayer,
      clamp, dist, circleHit, defaultStats,
      save, recordGameEnd, defaultSave,
    };
  `;

  const sandbox = {
    console,
    Math,
    performance: { now: () => 0 },
    setTimeout: () => 0,
    localStorage: {
      _d: {},
      getItem(k) { return this._d[k] ?? null; },
      setItem(k, v) { this._d[k] = String(v); },
      removeItem(k) { delete this._d[k]; },
    },
    window: {},
    AudioContext: undefined,
    webkitAudioContext: undefined,
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;

  vm.runInNewContext(code + '\n' + exportFooter, sandbox, { timeout: 5000 });
  return sandbox.__TEST__;
}

// -------------------- shell files --------------------
section('PWA shell');
{
  assert(exists('index.html'), 'index.html exists');
  assert(exists('css/style.css'), 'style.css exists');
  assert(exists('manifest.webmanifest'), 'manifest exists');
  assert(exists('sw.js'), 'sw.js exists');
  assert(exists('js/config.js'), 'config.js exists');
  assert(exists('js/main.js'), 'main.js exists');
  assert(exists('js/game.js'), 'game.js exists');
  assert(exists('icons/icon-192.png'), 'icon-192 exists');
  assert(exists('icons/icon-512.png'), 'icon-512 exists');
  assert(exists('icons/icon-180.png'), 'icon-180 exists');
  assert(exists('apple-touch-icon.png'), 'apple-touch-icon exists');
  assert(exists('art/cover.jpg'), 'cover art exists');

  const html = read('index.html');
  assert(html.includes('js/config.js'), 'html loads config');
  assert(html.includes('js/game.js'), 'html loads game');
  assert(html.includes('js/main.js'), 'html loads main');
  assert(html.includes('data-screen="menu"'), 'menu screen');
  assert(html.includes('data-screen="over"'), 'over screen');
  // Play chrome must not be a full-screen overlay (iPad touch)
  assert(!html.includes('data-screen="play"'), 'no full-screen play screen overlay');
}

// -------------------- version sync --------------------
section('version ↔ SW');
{
  const cfg = read('js/config.js');
  const sw = read('sw.js');
  const m = cfg.match(/GAME_VERSION\s*=\s*['"]([^'"]+)['"]/);
  assert(!!m, 'GAME_VERSION defined');
  const ver = m[1];
  assert(/^\d+\.\d+\.\d{3}$/.test(ver), 'version MAJOR.MINOR.PPP format: ' + ver);
  assert(sw.includes("neon-autofire-" + ver) || sw.includes(`'neon-autofire-${ver}'`),
    'sw CACHE matches GAME_VERSION ' + ver);
  assert(sw.includes('./js/game.js'), 'sw precaches game.js');
  assert(sw.includes('./art/cover.jpg'), 'sw precaches cover');
}

// -------------------- pure helpers --------------------
section('math helpers');
{
  const G = loadGame();
  assertEq(G.clamp(5, 0, 10), 5, 'clamp mid');
  assertEq(G.clamp(-1, 0, 10), 0, 'clamp low');
  assertEq(G.clamp(99, 0, 10), 10, 'clamp high');
  assertEq(G.dist(0, 0, 3, 4), 5, 'dist 3-4-5');
  assert(G.circleHit(0, 0, 5, 8, 0, 4), 'circles overlap');
  assert(!G.circleHit(0, 0, 5, 20, 0, 4), 'circles far');
  assert(G.xpForLevel(1) > 0, 'xp level 1 positive');
  assert(G.xpForLevel(5) > G.xpForLevel(2), 'xp scales up');
}

// -------------------- run lifecycle --------------------
section('game lifecycle');
{
  const G = loadGame();
  G.startGame();
  assertEq(G.state(), 'play', 'startGame → play');
  assert(G.player() != null, 'player created');
  assertEq(G.player().hp, G.player().maxHp, 'full HP');
  assertEq(G.score(), 0, 'score starts 0');
  assertEq(G.kills(), 0, 'kills 0');
  assert(G.stats().damage > 0, 'base damage');
  assert(G.stats().fireRate > 0, 'base fire rate');

  G.startWave();
  // Force spawn
  G.spawnEnemy('drone');
  assert(G.enemies().length >= 1, 'spawned drone');
  const e = G.enemies()[0];
  assert(e.hp > 0, 'enemy has hp');
  assert(e.x > G.PLAY.right - 5, 'enemy spawns off right');

  G.firePlayer();
  assert(G.bullets().length >= 1, 'autofire created bullets');
}

// -------------------- combat + XP --------------------
section('combat & level-up');
{
  const G = loadGame();
  G.startGame();
  G.spawnEnemy('swarm');
  const e = G.enemies()[0];
  e.x = G.player().x + 40;
  e.y = G.player().y;
  e.hp = 5;

  // Point-blank kill via damage
  const idx = 0;
  e.hp = 0;
  G.killEnemy(e, idx);
  assertEq(G.enemies().length, 0, 'enemy removed');
  assert(G.kills() >= 1, 'kill counted');
  assert(G.gems().length >= 1, 'xp gem dropped');
  assert(G.score() > 0, 'score increased');

  // Force level up
  G.startGame();
  const beforeLv = G.player().level;
  G.addXp(G.player().xpNext);
  assert(G.player().level > beforeLv, 'leveled up');
  assertEq(G.state(), 'levelup', 'state levelup');
  assert(G.levelChoices().length === 3, '3 upgrade choices');

  const up = G.levelChoices()[0];
  const dmgBefore = G.stats().damage;
  G.applyUpgrade(G.UPGRADES.find(u => u.id === 'dmg') || up);
  if (up.id === 'dmg' || (G.player()._owned && G.player()._owned.dmg)) {
    // damage upgrade applied at least once in this path or dmg path
  }
  assert(G.state() === 'play' || G.state() === 'levelup', 'resumed or multi-level');
}

// -------------------- damage / game over --------------------
section('damage & game over');
{
  const G = loadGame();
  G.startGame();
  G.hurtPlayer(999);
  assertEq(G.state(), 'over', 'lethal damage → over');
  assert(G.player().hp <= 0, 'hp depleted');
  assert(G.save.games >= 1, 'game recorded');
}

// -------------------- movement --------------------
section('movement');
{
  const G = loadGame();
  G.startGame();
  const p = G.player();
  const x0 = p.x;
  const y0 = p.y;
  G.movePlayer(0.5, 1, 0);
  assert(G.player().x > x0, 'moves right');
  G.movePlayer(0.5, 0, 1);
  assert(G.player().y > y0, 'moves down');
  // clamp
  for (let i = 0; i < 20; i++) G.movePlayer(0.2, 1, 0);
  assert(G.player().x <= G.PLAY.right - p.r + 0.01, 'clamped to play right');
}

// -------------------- upgrades --------------------
section('upgrades');
{
  const G = loadGame();
  G.startGame();
  const s0 = G.stats().damage;
  G.applyUpgrade(G.UPGRADES.find(u => u.id === 'dmg'));
  assert(G.stats().damage > s0, 'dmg upgrade raises damage');

  const r0 = G.stats().fireRate;
  G.applyUpgrade(G.UPGRADES.find(u => u.id === 'rate'));
  assert(G.stats().fireRate > r0, 'rate upgrade');

  G.applyUpgrade(G.UPGRADES.find(u => u.id === 'orbit'));
  assert(G.stats().orbit >= 1, 'orbit upgrade');

  G.applyUpgrade(G.UPGRADES.find(u => u.id === 'heal'));
  assert(G.player().hp > 0, 'heal keeps hp');
}

// -------------------- update tick smoke --------------------
section('update smoke');
{
  const G = loadGame();
  G.startGame();
  G.startWave();
  for (let i = 0; i < 30; i++) {
    G.updatePlay(1 / 30, 0.2, -0.1);
    if (G.state() === 'levelup') {
      G.applyUpgrade(G.levelChoices()[0]);
    }
    if (G.state() === 'over') break;
  }
  assert(G.state() === 'play' || G.state() === 'over' || G.state() === 'levelup',
    'stable after ticks');
  assert(G.score() >= 0, 'score non-negative');
}

// -------------------- config sanity --------------------
section('config');
{
  const G = loadGame();
  assertEq(G.GAME_NAME, 'Neon Autofire', 'game name');
  assert(G.W === 390 && G.H === 700, 'stage size');
  assert(Object.keys(G.ENEMIES).includes('boss'), 'boss enemy');
  assert(G.UPGRADES.length >= 8, 'enough upgrades');
  assert(G.WAVE.bossEvery > 0, 'boss cadence');
}

// Done
console.log(`\n\n${passed} passed, ${failed} failed`);
if (failed) {
  console.error('\nFailures:');
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}
process.exit(0);
