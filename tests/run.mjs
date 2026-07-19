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
    'js/game-state.js',
    'js/effects.js',
    'js/world.js',
    'js/player.js',
    'js/enemies.js',
    'js/combat.js',
    'js/game-systems.js',
    'js/game.js',
  ];
  const code = files
    .map(rel => `// ---- ${rel} ----\n` + read(rel))
    .join('\n;\n');

  const exportFooter = `
    globalThis.__TEST__ = {
      GAME_VERSION, GAME_VERSION_LABEL, GAME_NAME,
      PlayerEntity, PlayerWeaponSystem, shotAngles, selectEnemyType, normalizeEnemyType,
      W, H, PLAY, PLAYER, ENEMIES, UPGRADES, WAVE, GROUND_Y, JUMP_SAFE, xpForLevel,
      maxJumpHeight, maxJumpAirTime, maxJumpDistance,
      state: () => state,
      setState: (s) => { state = s; },
      setWave: (value) => { wave = value; },
      setSpawnState: (queue, timer) => { spawnQueue = queue; waveTimer = timer; },
      setRandom: (fn) => { Math.random = fn; },
      score: () => score,
      kills: () => kills,
      wave: () => wave,
      player: () => player,
      playerWeapon: () => playerWeapon,
      stats: () => stats,
      bullets: () => bullets,
      enemies: () => enemies,
      gems: () => gems,
      particles: () => particles,
      pickups: () => pickups,
      enemyBullets: () => eBullets,
      orbits: () => orbits,
      platforms: () => platforms,
      cameraX: () => cameraX,
      setCameraX: (x) => { cameraX = x; },
      worldGenX: () => worldGenX,
      levelChoices: () => levelChoices,
      startGame, resetRun, startWave, spawnEnemy, firePlayer,
      updatePlay, applyUpgrade, addXp, openLevelUp, killEnemy,
      hurtPlayer, endGame, nearestEnemy, movePlayer, requestJump,
      setJumpHeld, seedPlatforms, generatePlatformsAhead,
      canReachPlatform, platformsChainReachable, jumpPeakHeight, makePlatform,
      clamp, dist, circleHit, defaultStats, lerp,
      save, storage: localStorage, recordGameEnd, defaultSave, loadSave, writeSave, persist,
      randInt, pick, shuffle, solidAt, burst, spark,
      shotAngles, createPlayerBullet, rebuildOrbits,
      selectEnemyType, pickEnemyType, normalizeEnemyType, createEnemy, spawnBoss,
      updateEnemy, enemyHitCircle, updateOrbits, updatePlayerBullets, updateEnemies,
      createEnemyBullet, updateEnemyWeapons, landCollectibleOnPlatforms,
      updateGems, updatePickups, updateParticles, updateWaves,
    };
  `;

  const sandbox = {
    console,
    Math: Object.create(Math),
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

  const context = vm.createContext(sandbox);
  for (const rel of files) {
    vm.runInContext(read(rel), context, { timeout: 5000, filename: path.join(root, rel) });
  }
  vm.runInContext(exportFooter, context, {
    timeout: 5000,
    filename: path.join(root, 'tests', '__exports__.js'),
  });
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
  assert(exists('js/sprites.js'), 'sprites.js exists');
  assert(exists('assets/sprites/player/Cyborg_idle.png'), 'player cyborg idle sprite');
  assert(exists('assets/sprites/enemies/Biker_run.png'), 'biker enemy sprite');
  assert(exists('assets/sprites/bg/city.png'), 'city background');
  assert(exists('assets/CREDITS.md'), 'asset credits file');
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

// -------------------- architecture boundaries --------------------
section('architecture');
{
  for (const file of ['game-state', 'effects', 'world', 'player', 'enemies', 'combat', 'game-systems']) {
    assert(exists(`js/${file}.js`), `${file} module exists`);
  }
  const G = loadGame();
  G.startGame();
  assert(G.player() instanceof G.PlayerEntity, 'run owns a PlayerEntity');
  assert(G.playerWeapon() instanceof G.PlayerWeaponSystem, 'run owns a PlayerWeaponSystem');
  assertEq(G.shotAngles(0, 0).length, 1, 'no spread creates one angle');
  const spread = G.shotAngles(0, 2);
  assertEq(spread.length, 5, 'spread two creates five angles');
  assert(Math.abs(spread[0] + spread[4]) < 1e-9, 'spread angles are symmetric');
  assertEq(G.selectEnemyType(1, 0.01), 'grunt', 'enemy selection honors wave gates');
  assertEq(G.normalizeEnemyType('drone'), 'grunt', 'legacy enemy alias normalized');
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
  assert(G.platforms().length >= 1, 'platforms seeded');
  assert(G.player().onGround === true, 'player starts on ground');
  assert(Math.abs(G.player().y - G.GROUND_Y) < 1, 'player feet on ground Y');

  // Force spawn
  G.spawnEnemy('drone');
  assert(G.enemies().length >= 1, 'spawned grunt (drone alias)');
  const e = G.enemies()[0];
  assert(e.hp > 0, 'enemy has hp');
  assert(e.x > G.cameraX() + 50, 'enemy spawns ahead of camera');

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

// -------------------- movement (platformer) --------------------
section('movement');
{
  const G = loadGame();
  G.startGame();
  const dt = 1 / 60;
  const x0 = G.player().x;
  for (let i = 0; i < 10; i++) G.movePlayer(dt, 1, 0, false);
  assert(G.player().x > x0, 'runs right');
  assert(G.player().onGround, 'still grounded after run');

  // Jump
  G.requestJump();
  G.setJumpHeld(true);
  G.movePlayer(dt, 0, 0, true);
  assert(G.player().vy < 0, 'jump launches upward');
  assert(!G.player().onGround, 'leaves ground on jump');

  // Fall back under gravity
  G.setJumpHeld(false);
  for (let i = 0; i < 120; i++) G.movePlayer(dt, 0, 0, false);
  assert(G.player().onGround, 'lands after jump');
  assert(Math.abs(G.player().y - G.GROUND_Y) < 2, 'lands near ground');
}

// -------------------- jump envelope + platform reachability --------------------
section('platform reachability');
{
  const G = loadGame();
  const peak = G.maxJumpHeight(1);
  const air = G.maxJumpAirTime(1);
  const dist = G.maxJumpDistance(1, 1);
  assert(peak > 70 && peak < 160, 'peak height in sensible range: ' + peak);
  assert(air > 0.4 && air < 1.2, 'air time sensible: ' + air);
  assert(dist > 90, 'horizontal jump distance > 90: ' + dist);

  const ground = G.makePlatform(0, G.GROUND_Y, 120);
  // Same height, short gap — reachable
  const near = G.makePlatform(120 + 40, G.GROUND_Y, 100);
  assert(G.canReachPlatform(ground, near, 1, 1), 'short same-height gap reachable');

  // Same height, huge gap — not reachable
  const far = G.makePlatform(120 + dist * 1.5, G.GROUND_Y, 100);
  assert(!G.canReachPlatform(ground, far, 1, 1), 'huge same-height gap unreachable');

  // Too high for single jump
  const sky = G.makePlatform(120 + 30, G.GROUND_Y - peak * 1.2, 100);
  assert(!G.canReachPlatform(ground, sky, 1, 1), 'over-peak platform unreachable');

  // Safe mild climb
  const step = G.makePlatform(120 + 36, G.GROUND_Y - peak * 0.4, 110);
  assert(G.canReachPlatform(ground, step, 1, 1), 'mild climb reachable');

  // Generated world must form a single-jump chain
  G.startGame();
  assert(G.platforms().length >= 3, 'seeded several platforms');
  assert(G.platformsChainReachable(G.platforms(), 1, 1),
    'seeded platforms form single-jump chain');

  // Force more generation ahead and re-check
  G.setCameraX(800);
  G.generatePlatformsAhead();
  assert(G.platformsChainReachable(G.platforms(), 1, 1),
    'extended generation still single-jump chain');

  // Stress: many random seeds via reset
  for (let i = 0; i < 12; i++) {
    G.startGame();
    G.setCameraX(200 + i * 350);
    G.generatePlatformsAhead();
    assert(G.platformsChainReachable(G.platforms(), 1, 1),
      'chain reachable after seed ' + i);
  }

  // Rejected layout helper
  const badChain = [
    G.makePlatform(0, G.GROUND_Y, 100),
    G.makePlatform(100 + dist * 2, G.GROUND_Y - peak, 100),
  ];
  assert(!G.platformsChainReachable(badChain, 1, 1), 'detects impossible chain');
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

// -------------------- focused domain systems --------------------
section('domain systems');
{
  const G = loadGame();
  G.startGame();
  G.setRandom(() => 0.25);

  assertEq(G.randInt(2, 4), 2, 'randInt lower deterministic bucket');
  assertEq(G.pick(['a', 'b', 'c']), 'a', 'pick deterministic item');
  const shuffled = G.shuffle([1, 2, 3]);
  assertEq(shuffled.length, 3, 'shuffle preserves items');
  assert(G.solidAt(G.player().x, G.player().y + 1, G.player().w, G.player().h), 'solidAt finds starter floor');
  assertEq(G.solidAt(-999, -999, 1, 1), null, 'solidAt misses empty space');

  const particleCount = G.particles().length;
  G.burst(10, 10, '#fff', 4, 100);
  G.spark(10, 10, '#fff');
  assert(G.particles().length >= particleCount + 5, 'burst and spark create particles');

  assertEq(G.normalizeEnemyType('sniper'), 'gunner', 'sniper alias');
  assertEq(G.normalizeEnemyType('tank'), 'brute', 'tank alias');
  assertEq(G.selectEnemyType(8, 0.01), 'brute', 'late-wave brute selection');
  assertEq(G.selectEnemyType(4, 0.1), 'gunner', 'gunner selection');
  assertEq(G.selectEnemyType(3, 0.2), 'hopper', 'hopper selection');
  assertEq(G.selectEnemyType(2, 0.4), 'flyer', 'flyer selection');

  const flyer = G.createEnemy('flyer', G.player().x + 100, 200, 1);
  G.enemies().push(flyer);
  G.updateEnemy(flyer, 1 / 60);
  assert(flyer.x < G.player().x + 100, 'flyer AI drifts toward player');
  const hopper = G.createEnemy('hopper', G.player().x + 80, G.GROUND_Y, 1);
  hopper.onGround = true;
  G.enemies().push(hopper);
  G.setRandom(() => 0);
  G.updateEnemy(hopper, 1 / 60);
  assert(hopper.vy < 0, 'hopper AI jumps');
  const boss = G.createEnemy('boss', G.player().x + 120, G.GROUND_Y, 1);
  G.updateEnemy(boss, 1 / 60);
  assert(Number.isFinite(boss.vx), 'boss pacing updates');
  assertEq(G.enemyHitCircle(boss).x, boss.x, 'enemy hit circle centered');

  G.enemies().length = 0;
  const lootBoss = G.createEnemy('boss', G.player().x + 20, G.GROUND_Y, 1);
  G.enemies().push(lootBoss);
  G.killEnemy(lootBoss, 0);
  assert(G.gems().length === 10, 'boss drops ten gems');
  assert(G.pickups().some(item => item.kind === 'heal'), 'boss guarantees heal pickup');
  const hpBefore = G.player().maxHp;
  G.applyUpgrade(G.UPGRADES.find(upgrade => upgrade.id === 'hp'));
  assert(G.player().maxHp === hpBefore + 25, 'armor upgrade changes max HP');

  G.setState('play');
  G.enemies().length = 0;
  G.bullets().length = 0;
  const target = G.createEnemy('grunt', G.player().x + 30, G.player().y, 1);
  target.hp = 999;
  G.enemies().push(target);
  G.bullets().push({ x: target.x, y: target.y - target.h / 2, vx: 0, vy: 0,
    r: 5, dmg: 10, pierce: 1, life: 1, color: '#fff' });
  G.updatePlayerBullets(1 / 60);
  assert(target.hp < 999 && G.bullets()[0].pierce === 0, 'piercing bullet damages and survives');
  G.bullets().push({ x: -999, y: 0, vx: 0, vy: 0, r: 1, dmg: 1, pierce: 0, life: 0, color: '#fff' });
  G.updatePlayerBullets(1 / 60);
  assert(!G.bullets().some(bullet => bullet.life <= 0), 'expired bullets pruned');

  G.enemies().length = 0;
  const contact = G.createEnemy('grunt', G.player().x, G.player().y, 1);
  G.enemies().push(contact);
  const hpAtContact = G.player().hp;
  G.player().inv = 0;
  G.updateEnemies(0, G.player().x, G.player().y - G.player().h / 2);
  assert(G.player().hp < hpAtContact, 'enemy contact damages player');

  G.enemies().length = 0;
  G.enemyBullets().length = 0;
  const gunner = G.createEnemy('gunner', G.player().x + 50, G.player().y, 1);
  G.enemies().push(gunner);
  G.player().inv = 0;
  G.updateEnemyWeapons(0.01, G.player().x, G.player().y - G.player().h / 2);
  assert(G.enemyBullets().length > 0, 'gunner creates enemy projectile');
  G.enemyBullets().push({ x: G.player().x, y: G.player().y - G.player().h / 2,
    vx: 0, vy: 0, r: 5, dmg: 1, life: 1, color: '#fff' });
  G.player().inv = 0;
  G.updateEnemyWeapons(0, G.player().x, G.player().y - G.player().h / 2);
  assert(G.player().inv > 0, 'enemy projectile collision damages player');

  G.gems().length = 0;
  G.gems().push({ x: G.player().x, y: G.player().y - G.player().h / 2,
    r: 5, xp: 1, vx: 0, vy: 0, life: 2 });
  assert(G.updateGems(1 / 60, G.player().x, G.player().y - G.player().h / 2), 'gem update remains in play');
  assertEq(G.gems().length, 0, 'nearby gem collected');

  G.pickups().length = 0;
  G.player().hp = Math.max(1, G.player().maxHp - 40);
  const hurtHp = G.player().hp;
  G.pickups().push({ x: G.player().x, y: G.player().y - G.player().h / 2,
    r: 9, kind: 'heal', life: 2, vy: 0 });
  G.updatePickups(0, G.player().x, G.player().y - G.player().h / 2);
  assert(G.player().hp > hurtHp, 'heal pickup restores HP');

  G.particles().push({ x: 0, y: 0, vx: 1, vy: 1, life: 0, max: 1 });
  G.updateParticles(1 / 60);
  assert(!G.particles().some(particle => particle.life <= 0), 'dead particles pruned');

  G.enemies().length = 0;
  G.setSpawnState(1, -1);
  G.setRandom(() => 0.5);
  G.updateWaves(0);
  assert(G.enemies().length === 1, 'wave system consumes spawn queue');
}

// -------------------- defensive and boundary paths --------------------
section('boundary paths');
{
  const G = loadGame();
  G.startGame();
  G.setRandom(() => 0.5);

  G.setWave(5);
  G.enemies().length = 0;
  G.startWave();
  assert(G.enemies().some(enemy => enemy.type === 'boss'), 'boss wave spawns boss');
  const falling = G.createEnemy('grunt', 0, G.PLAY.bottom + 200, 1);
  G.updateEnemy(falling, 0);
  assertEq(falling.y, G.GROUND_Y, 'fallen enemy respawns');

  G.enemies().length = 0;
  G.stats().orbit = 1;
  G.rebuildOrbits();
  const orbitTarget = G.createEnemy('grunt', G.player().x + 30, G.player().y, 1);
  orbitTarget.y = G.player().y - G.player().h / 2 + orbitTarget.h / 2;
  orbitTarget.hp = 0.1;
  G.enemies().push(orbitTarget);
  G.updateOrbits(0.01, G.player().x, G.player().y - G.player().h / 2);
  assertEq(G.enemies().length, 0, 'orbit collision kills enemy');

  const platform = G.platforms()[0];
  const item = { x: platform.x + 20, y: platform.y, vy: 10 };
  assert(G.landCollectibleOnPlatforms(item, 12), 'collectible lands on platform');
  assertEq(item.vy, 0, 'landed collectible stops falling');

  G.enemies().length = 0;
  G.setSpawnState(0, 1);
  const waveBefore = G.wave();
  G.updateWaves(0);
  assertEq(G.wave(), waveBefore + 1, 'empty completed wave advances');

  G.setState('play');
  G.setCameraX(100);
  G.player().x = 0;
  G.movePlayer(1 / 60, -1, 0, false);
  assert(G.player().x >= 124, 'player clamped to camera boundary');
  G.player().inv = 0;
  G.player().y = G.PLAY.bottom + 100;
  G.movePlayer(0, 0, 0, false);
  assertEq(G.player().y, G.GROUND_Y, 'fallen player respawns');

  const beforePlatforms = G.platforms().length;
  G.setCameraX(2000);
  G.generatePlatformsAhead(() => false);
  assert(G.platforms().length > beforePlatforms, 'platform generator defensive fallback executes');

  G.storage.setItem('neon-autofire-v1', JSON.stringify({ best: 42 }));
  assertEq(G.loadSave().best, 42, 'save loader merges stored data');
  const originalGet = G.storage.getItem;
  G.storage.getItem = () => { throw new Error('storage denied'); };
  assertEq(G.loadSave().best, 0, 'save loader recovers from storage failure');
  G.storage.getItem = originalGet;
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
