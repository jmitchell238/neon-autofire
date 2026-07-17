'use strict';

// ---- Run state --------------------------------------------------------------
let state = 'menu'; // menu | play | levelup | over
let score = 0;
let kills = 0;
let wave = 1;
let waveTimer = 0;
let spawnQueue = 0;
let scrollX = 0;       // visual parallax
let cameraX = 0;       // world → screen offset (worldX - cameraX = screenX)
let time = 0;
let shake = 0;
let overReason = '';
let worldGenX = 0;     // how far platforms have been generated

// Player
let player = null;
let stats = null;

// World
let platforms = [];    // {x,y,w,h} world coords; y is top of platform
let bullets = [];
let enemies = [];
let gems = [];
let particles = [];
let pickups = [];
let eBullets = [];
let orbits = [];
let levelChoices = [];

let fireCd = 0;
let eFireCd = 0;
let jumpBuffered = 0;
let jumpHeld = false;

function defaultStats() {
  return {
    damage: 12,
    fireRate: 4.2,
    spread: 0,
    multi: 0,
    pierce: 0,
    speedMul: 1,
    magnetMul: 1,
    jumpMul: 1,
    orbit: 0,
    bulletSpeed: 420,
    bulletR: 4,
  };
}

function makePlayer() {
  const ground = GROUND_Y;
  return {
    // center-bottom style: x center, y = feet
    x: 80,
    y: ground,
    w: PLAYER.w,
    h: PLAYER.h,
    vx: 0,
    vy: 0,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    inv: 0,
    level: 1,
    xp: 0,
    xpNext: xpForLevel(1),
    facing: 1,       // 1 right, -1 left (sprite)
    aim: 0,          // shoot angle
    onGround: true,
    coyote: 0,
    anim: 0,         // run cycle
    _owned: {},
  };
}

/** Player AABB helpers (x = center, y = feet) */
function playerTop(p) { return p.y - p.h; }
function playerLeft(p) { return p.x - p.w / 2; }
function playerRight(p) { return p.x + p.w / 2; }
function playerCx(p) { return p.x; }
function playerCy(p) { return p.y - p.h / 2; }

function resetRun() {
  score = 0;
  kills = 0;
  wave = 1;
  waveTimer = 0.6;
  spawnQueue = 0;
  scrollX = 0;
  cameraX = 0;
  time = 0;
  shake = 0;
  overReason = '';
  worldGenX = 0;
  platforms = [];
  bullets = [];
  enemies = [];
  gems = [];
  particles = [];
  pickups = [];
  eBullets = [];
  orbits = [];
  levelChoices = [];
  fireCd = 0;
  eFireCd = 0;
  jumpBuffered = 0;
  jumpHeld = false;
  stats = defaultStats();
  player = makePlayer();
  rebuildOrbits();
  seedPlatforms();
}

function startGame() {
  resetRun();
  state = 'play';
}

function endGame(reason) {
  if (state === 'over') return;
  state = 'over';
  overReason = reason || 'Knocked out!';
  sfxGameOver();
  recordGameEnd(score, wave, kills);
  const cx = playerCx(player);
  const cy = playerCy(player);
  burst(cx, cy, '#3de7ff', 28, 180);
  burst(cx, cy, '#ff4fd8', 18, 140);
}

// ---- Platforms --------------------------------------------------------------
function seedPlatforms() {
  platforms = [];
  // Long starter ground
  platforms.push({ x: -40, y: GROUND_Y, w: 520, h: 24, ground: true });
  worldGenX = 480;
  generatePlatformsAhead();
}

function generatePlatformsAhead() {
  const ahead = cameraX + W * 3 + 200;
  while (worldGenX < ahead && platforms.length < MAX_PLATFORMS) {
    const gap = rand(40, 110);
    const w = rand(70, 180);
    const kind = Math.random();
    let y;
    if (kind < 0.45) {
      y = GROUND_Y; // floor segment
    } else if (kind < 0.75) {
      y = GROUND_Y - rand(50, 120);
    } else {
      y = GROUND_Y - rand(120, 200);
    }
    y = clamp(y, PLAY.top + 80, GROUND_Y);
    platforms.push({
      x: worldGenX + gap,
      y,
      w,
      h: y >= GROUND_Y - 2 ? 24 : 14,
      ground: y >= GROUND_Y - 2,
    });
    worldGenX += gap + w;
  }
  // Prune far behind
  const minX = cameraX - 200;
  platforms = platforms.filter(p => p.x + p.w > minX);
}

function solidAt(px, py, pw, ph) {
  // AABB vs platforms; py is feet bottom, top = py - ph
  const left = px - pw / 2;
  const right = px + pw / 2;
  const top = py - ph;
  const bottom = py;
  for (const pl of platforms) {
    if (right <= pl.x || left >= pl.x + pl.w) continue;
    if (bottom <= pl.y || top >= pl.y + pl.h) continue;
    return pl;
  }
  return null;
}

// ---- Particles --------------------------------------------------------------
function burst(x, y, color, n, speed) {
  for (let i = 0; i < n && particles.length < MAX_PARTICLES; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = rand(speed * 0.25, speed);
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: rand(0.25, 0.7),
      max: 0.7,
      r: rand(1.5, 3.5),
      color,
    });
  }
}

function spark(x, y, color) {
  if (particles.length >= MAX_PARTICLES) return;
  const a = Math.random() * Math.PI * 2;
  const s = rand(40, 120);
  particles.push({
    x, y,
    vx: Math.cos(a) * s,
    vy: Math.sin(a) * s,
    life: rand(0.12, 0.3),
    max: 0.3,
    r: rand(1, 2.2),
    color,
  });
}

// ---- Spawning ---------------------------------------------------------------
function waveEnemyBudget(w) {
  return Math.floor(WAVE.baseCount + w * WAVE.countRamp);
}

function pickEnemyType(w) {
  const roll = Math.random();
  if (w >= 8 && roll < 0.08) return 'brute';
  if (w >= 4 && roll < 0.18) return 'gunner';
  if (w >= 3 && roll < 0.35) return 'hopper';
  if (w >= 2 && roll < 0.55) return 'flyer';
  if (w >= 6 && roll < 0.65) return 'brute';
  return 'grunt';
}

function findSpawnPlatform(minWorldX) {
  let best = null;
  for (const pl of platforms) {
    if (pl.x + pl.w < minWorldX) continue;
    if (pl.x > minWorldX + W * 1.5) continue;
    if (!best || pl.x < best.x) best = pl;
  }
  return best;
}

function spawnEnemy(type) {
  if (enemies.length >= MAX_ENEMIES) return;
  // Map legacy names
  if (type === 'drone') type = 'grunt';
  if (type === 'zig') type = 'hopper';
  if (type === 'tank') type = 'brute';
  if (type === 'sniper') type = 'gunner';
  if (type === 'swarm') type = 'flyer';

  const def = ENEMIES[type] || ENEMIES.grunt;
  const scale = 1 + (wave - 1) * 0.07;
  const spawnX = cameraX + W + rand(20, 100);
  let x = spawnX;
  let y = GROUND_Y;

  if (def.fly) {
    y = rand(PLAY.top + 60, GROUND_Y - 80);
  } else {
    const pl = findSpawnPlatform(spawnX - 40);
    if (pl) {
      x = pl.x + rand(10, Math.max(12, pl.w - 10));
      y = pl.y;
    } else {
      x = spawnX;
      y = GROUND_Y;
    }
  }

  enemies.push({
    type,
    x,
    y, // feet
    w: def.w,
    h: def.h,
    r: Math.max(def.w, def.h) * 0.45, // for circle-ish collision convenience
    hp: def.hp * scale,
    maxHp: def.hp * scale,
    speed: def.speed * (0.9 + Math.random() * 0.25),
    score: Math.floor(def.score * (1 + (wave - 1) * 0.05)),
    xp: def.xp,
    color: def.color,
    damage: def.damage,
    shoots: !!def.shoots,
    fly: !!def.fly,
    hop: !!def.hop,
    phase: Math.random() * Math.PI * 2,
    baseY: y,
    flash: 0,
    vx: 0,
    vy: 0,
    onGround: !def.fly,
    facing: -1,
  });
}

function spawnBoss() {
  spawnEnemy('boss');
  const boss = enemies[enemies.length - 1];
  if (boss) {
    boss.x = cameraX + W + 40;
    boss.y = GROUND_Y;
    boss.hp = ENEMIES.boss.hp * (1 + (wave - 1) * 0.12);
    boss.maxHp = boss.hp;
  }
}

function startWave() {
  if (wave > 1 && wave % WAVE.bossEvery === 0) {
    spawnBoss();
    spawnQueue = Math.max(0, waveEnemyBudget(wave) - 1);
  } else {
    spawnQueue = waveEnemyBudget(wave);
  }
  waveTimer = Math.max(WAVE.minInterval, WAVE.baseInterval - (wave - 1) * WAVE.ramp);
}

// ---- Combat -----------------------------------------------------------------
function firePlayer() {
  if (!player) return;
  const cx = playerCx(player);
  const cy = playerCy(player) - 4;
  const target = nearestEnemy(cx, cy);
  let aim = player.facing > 0 ? 0 : Math.PI;
  if (target) {
    aim = angleTo(cx, cy, target.x, target.y - target.h / 2);
  }
  player.aim = aim;

  const barrels = 1 + stats.multi;
  const spreadN = stats.spread;
  const angles = [];

  if (spreadN === 0) {
    angles.push(aim);
  } else {
    const span = Math.min(0.9, 0.18 + spreadN * 0.12);
    const total = 1 + spreadN * 2;
    for (let i = 0; i < total; i++) {
      const t = total === 1 ? 0.5 : i / (total - 1);
      angles.push(aim - span + t * span * 2);
    }
  }

  const offsetStep = 8;
  for (let b = 0; b < barrels; b++) {
    const lat = (b - (barrels - 1) / 2) * offsetStep;
    const ox = Math.cos(aim + Math.PI / 2) * lat;
    const oy = Math.sin(aim + Math.PI / 2) * lat;
    for (const a of angles) {
      if (bullets.length >= MAX_BULLETS) break;
      bullets.push({
        x: cx + Math.cos(a) * 16 + ox,
        y: cy + Math.sin(a) * 16 + oy,
        vx: Math.cos(a) * stats.bulletSpeed,
        vy: Math.sin(a) * stats.bulletSpeed,
        r: stats.bulletR,
        dmg: stats.damage,
        pierce: stats.pierce,
        life: 1.4,
        color: '#7af0ff',
      });
    }
  }
  sfxShoot();
}

function nearestEnemy(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const e of enemies) {
    const ex = e.x;
    const ey = e.y - e.h / 2;
    const d = dist(x, y, ex, ey);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function rebuildOrbits() {
  const n = stats.orbit;
  orbits = [];
  for (let i = 0; i < n; i++) {
    orbits.push({
      angle: (i / Math.max(1, n)) * Math.PI * 2,
      r: 30 + i * 5,
      dmg: 8 + stats.damage * 0.35,
      size: 6,
    });
  }
}

function killEnemy(e, idx) {
  score += e.score;
  kills += 1;
  const ex = e.x;
  const ey = e.y - e.h / 2;
  burst(ex, ey, e.color, e.type === 'boss' ? 40 : 14, e.type === 'boss' ? 220 : 150);
  sfxExplode(e.type === 'boss');
  shake = Math.max(shake, e.type === 'boss' ? 10 : 3);

  const n = e.type === 'boss' ? 10 : e.type === 'brute' || e.type === 'tank' ? 3 : 1;
  for (let i = 0; i < n; i++) {
    if (gems.length >= MAX_GEMS) break;
    gems.push({
      x: ex + rand(-8, 8),
      y: ey + rand(-8, 8),
      r: 5,
      xp: Math.max(1, Math.floor(e.xp / n) || 1),
      vx: rand(-40, 40),
      vy: rand(-120, -20),
      life: 12,
    });
  }

  if (e.type === 'boss' || (Math.random() < 0.06 && pickups.length < MAX_PICKUPS)) {
    pickups.push({ x: ex, y: ey, r: 9, kind: 'heal', life: 10, vy: 0 });
  }

  enemies.splice(idx, 1);
}

function addXp(amount) {
  player.xp += amount;
  while (player.xp >= player.xpNext) {
    player.xp -= player.xpNext;
    player.level += 1;
    player.xpNext = xpForLevel(player.level);
    openLevelUp();
  }
}

function openLevelUp() {
  const owned = player._owned || (player._owned = {});
  const pool = UPGRADES.filter(u => {
    if (u.id === 'heal') return player.hp < player.maxHp;
    const count = owned[u.id] || 0;
    if (u.max != null && count >= u.max) return false;
    return true;
  });
  shuffle(pool);
  levelChoices = pool.slice(0, 3);
  while (levelChoices.length < 3) {
    levelChoices.push(UPGRADES.find(u => u.id === 'dmg'));
  }
  state = 'levelup';
  sfxLevelUp();
}

function applyUpgrade(up) {
  if (!up || !player) return;
  const owned = player._owned || (player._owned = {});
  owned[up.id] = (owned[up.id] || 0) + 1;

  switch (up.id) {
    case 'dmg':    stats.damage *= 1.2; break;
    case 'rate':   stats.fireRate *= 1.18; break;
    case 'spread': stats.spread += 1; break;
    case 'speed':  stats.speedMul *= 1.12; break;
    case 'hp':
      player.maxHp += 25;
      player.hp = Math.min(player.maxHp, player.hp + 25);
      break;
    case 'magnet': stats.magnetMul *= 1.3; break;
    case 'multi':  stats.multi += 1; break;
    case 'pierce': stats.pierce += 1; break;
    case 'jump':   stats.jumpMul *= 1.12; break;
    case 'orbit':
      stats.orbit += 1;
      rebuildOrbits();
      break;
    case 'heal':
      player.hp = Math.min(player.maxHp, player.hp + 40);
      break;
  }
  sfxUpgrade();
  levelChoices = [];
  if (player.xp >= player.xpNext) openLevelUp();
  else state = 'play';
}

function hurtPlayer(dmg) {
  if (!player || player.inv > 0) return;
  player.hp -= dmg;
  player.inv = PLAYER.invuln;
  shake = Math.max(shake, 6);
  sfxHurt();
  burst(playerCx(player), playerCy(player), '#ff4fd8', 10, 120);
  if (player.hp <= 0) {
    player.hp = 0;
    endGame('Knocked out!');
  }
}

// ---- Jump request (from main) -----------------------------------------------
function requestJump() {
  jumpBuffered = PLAYER.jumpBuffer;
}

function setJumpHeld(held) {
  jumpHeld = held;
}

// ---- Movement (platformer) --------------------------------------------------
function movePlayer(dt, ix, iy, wantJump) {
  if (!player || state !== 'play') return;

  if (wantJump) requestJump();

  // Stick-up jump edge via main also sets buffer; treat strong up as jump
  if (iy < -0.55) requestJump();

  const spd = PLAYER.runSpeed * stats.speedMul;
  const control = player.onGround ? 1 : PLAYER.airControl;
  let mx = 0;
  if (Math.abs(ix) > 0.08) mx = clamp(ix, -1, 1);

  // Horizontal velocity toward target
  const targetVx = mx * spd;
  const accel = player.onGround ? 2800 : 1800;
  if (Math.abs(targetVx - player.vx) < accel * dt) player.vx = targetVx;
  else player.vx += Math.sign(targetVx - player.vx) * accel * dt * control;

  if (mx > 0.1) player.facing = 1;
  else if (mx < -0.1) player.facing = -1;

  // Jump
  if (jumpBuffered > 0) jumpBuffered -= dt;
  if (player.onGround) player.coyote = PLAYER.coyote;
  else player.coyote = Math.max(0, player.coyote - dt);

  if (jumpBuffered > 0 && player.coyote > 0) {
    player.vy = PLAYER.jumpVel * stats.jumpMul;
    player.onGround = false;
    player.coyote = 0;
    jumpBuffered = 0;
    sfxClick();
  }

  // Variable jump height: release cut
  if (!jumpHeld && player.vy < -80) {
    player.vy *= 0.55;
  }

  // Gravity
  player.vy += PLAYER.gravity * dt;
  if (player.vy > PLAYER.maxFall) player.vy = PLAYER.maxFall;

  // Integrate X
  player.x += player.vx * dt;
  // Soft world bounds (can't go far left of camera)
  const minX = cameraX + 24;
  if (player.x < minX) {
    player.x = minX;
    player.vx = Math.max(0, player.vx);
  }

  // Integrate Y + platform resolve
  player.onGround = false;
  player.y += player.vy * dt;

  // Land on platforms (forgiving snap — large dt must not tunnel through)
  if (player.vy >= 0) {
    for (const pl of platforms) {
      const left = playerLeft(player);
      const right = playerRight(player);
      if (right <= pl.x + 2 || left >= pl.x + pl.w - 2) continue;
      const prevFeet = player.y - player.vy * dt;
      const crossed = prevFeet <= pl.y + 6 && player.y >= pl.y;
      const resting = player.y >= pl.y - 2 && player.y <= pl.y + Math.max(pl.h + 10, 28);
      if (crossed || (resting && prevFeet <= pl.y + 20)) {
        player.y = pl.y;
        player.vy = 0;
        player.onGround = true;
        break;
      }
    }
  }

  // Head bump
  if (player.vy < 0) {
    for (const pl of platforms) {
      const left = playerLeft(player);
      const right = playerRight(player);
      const top = playerTop(player);
      if (right <= pl.x || left >= pl.x + pl.w) continue;
      if (top <= pl.y + pl.h && player.y - player.h / 2 > pl.y && player.y > pl.y) {
        // only if overlapping vertically with underside
        if (top < pl.y + pl.h && player.y > pl.y + pl.h) {
          player.y = pl.y + pl.h + player.h;
          player.vy = 0;
        }
      }
    }
  }

  // Fell into the void
  if (player.y > PLAY.bottom + 80) {
    hurtPlayer(25);
    // Respawn on nearest platform ahead of camera
    player.y = GROUND_Y;
    player.vy = 0;
    player.x = cameraX + CAM.focusX;
    player.inv = PLAYER.invuln;
  }

  // Run anim
  if (player.onGround && Math.abs(player.vx) > 20) {
    player.anim += dt * Math.abs(player.vx) * 0.08;
  } else if (!player.onGround) {
    player.anim = 0.25;
  } else {
    player.anim *= 0.9;
  }
}

function updateCamera(dt) {
  const target = player.x - CAM.focusX;
  cameraX = lerp(cameraX, target, 1 - Math.exp(-CAM.lerp * dt));
  if (cameraX < 0) cameraX = 0;
  // Don't let camera run away behind player too far
  if (player.x - cameraX < 40) cameraX = player.x - 40;
}

function worldToScreenX(wx) {
  return wx - cameraX;
}

// ---- Enemy physics ----------------------------------------------------------
function updateEnemy(e, dt) {
  e.phase += dt;
  if (e.flash > 0) e.flash -= dt;

  if (e.fly) {
    // Bob and drift left toward player
    e.x -= e.speed * dt * 0.7;
    e.y = e.baseY + Math.sin(e.phase * 3) * 28;
    e.y = clamp(e.y, PLAY.top + 50, GROUND_Y - 40);
    e.facing = player.x < e.x ? -1 : 1;
    return;
  }

  // Walk toward player
  const dir = player.x < e.x ? -1 : 1;
  e.facing = dir;
  e.vx = dir * e.speed;

  if (e.type === 'boss') {
    // Pace near player on ground
    const ideal = player.x + 90;
    e.vx = clamp(ideal - e.x, -e.speed, e.speed);
  }

  if (e.hop && e.onGround && Math.random() < 0.02) {
    e.vy = -380;
    e.onGround = false;
  }

  e.vy += PLAYER.gravity * dt;
  if (e.vy > PLAYER.maxFall) e.vy = PLAYER.maxFall;

  e.x += e.vx * dt;
  e.onGround = false;
  e.y += e.vy * dt;

  if (e.vy >= 0) {
    for (const pl of platforms) {
      if (e.x + e.w / 2 <= pl.x + 2 || e.x - e.w / 2 >= pl.x + pl.w - 2) continue;
      const prev = e.y - e.vy * dt;
      if (prev <= pl.y + 4 && e.y >= pl.y && e.y <= pl.y + pl.h + 10) {
        e.y = pl.y;
        e.vy = 0;
        e.onGround = true;
        break;
      }
    }
  }

  // Don't walk off into void forever — turn around near edges lightly
  if (e.onGround && e.type !== 'boss') {
    const probeX = e.x + e.facing * (e.w / 2 + 6);
    let solid = false;
    for (const pl of platforms) {
      if (probeX >= pl.x && probeX <= pl.x + pl.w && Math.abs(pl.y - e.y) < 6) {
        solid = true;
        break;
      }
    }
    if (!solid && Math.random() < 0.4) e.vx *= -1;
  }

  if (e.y > PLAY.bottom + 100) {
    e.y = GROUND_Y;
    e.x = cameraX + W + 40;
    e.vy = 0;
  }
}

function enemyHitCircle(e) {
  return { x: e.x, y: e.y - e.h / 2, r: e.r };
}

// ---- Main update ------------------------------------------------------------
function updatePlay(dt, inputX, inputY, wantJump) {
  if (state !== 'play') return;
  time += dt;
  scrollX = cameraX;
  if (shake > 0) shake = Math.max(0, shake - dt * 28);

  movePlayer(dt, inputX, inputY, wantJump);
  updateCamera(dt);
  generatePlatformsAhead();

  if (player.inv > 0) player.inv -= dt;

  // Auto fire
  fireCd -= dt;
  const interval = 1 / Math.max(0.5, stats.fireRate);
  if (fireCd <= 0) {
    firePlayer();
    fireCd = interval;
  }

  // Orbits
  const pcx = playerCx(player);
  const pcy = playerCy(player);
  for (const o of orbits) {
    o.angle += dt * 2.4;
    o.x = pcx + Math.cos(o.angle) * o.r;
    o.y = pcy + Math.sin(o.angle) * o.r;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      const hc = enemyHitCircle(e);
      if (circleHit(o.x, o.y, o.size, hc.x, hc.y, hc.r)) {
        e.hp -= o.dmg * dt * 3;
        e.flash = 0.08;
        spark(o.x, o.y, '#ff4fd8');
        if (e.hp <= 0) killEnemy(e, i);
      }
    }
  }

  // Bullets (world space)
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    const sx = worldToScreenX(b.x);
    if (b.life <= 0 || sx < -40 || sx > W + 60 || b.y < PLAY.top - 40 || b.y > PLAY.bottom + 40) {
      bullets.splice(i, 1);
      continue;
    }
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      const hc = enemyHitCircle(e);
      if (!circleHit(b.x, b.y, b.r, hc.x, hc.y, hc.r)) continue;
      e.hp -= b.dmg;
      e.flash = 0.1;
      sfxHit();
      spark(b.x, b.y, b.color);
      if (b.pierce > 0) {
        b.pierce -= 1;
        b.dmg *= 0.85;
      } else {
        bullets.splice(i, 1);
      }
      if (e.hp <= 0) killEnemy(e, j);
      break;
    }
  }

  // Enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    updateEnemy(e, dt);

    // Despawn far left
    if (e.x < cameraX - 120) {
      enemies.splice(i, 1);
      continue;
    }

    // Contact
    const hc = enemyHitCircle(e);
    if (circleHit(pcx, pcy, Math.min(player.w, player.h) * 0.35, hc.x, hc.y, hc.r * 0.85)) {
      hurtPlayer(e.damage);
      e.flash = 0.12;
      // Knockback
      player.vx += (player.x < e.x ? -1 : 1) * 120;
      player.vy = -180;
      player.onGround = false;
    }
  }

  // Enemy shooting
  eFireCd -= dt;
  if (eFireCd <= 0) {
    eFireCd = Math.max(0.55, 1.4 - wave * 0.04);
    for (const e of enemies) {
      if (!e.shoots) continue;
      if (worldToScreenX(e.x) > W + 20) continue;
      if (Math.random() > (e.type === 'boss' ? 0.85 : 0.4)) continue;
      const ex = e.x;
      const ey = e.y - e.h * 0.65;
      const a = angleTo(ex, ey, pcx, pcy);
      const shots = e.type === 'boss' ? 3 : 1;
      for (let s = 0; s < shots; s++) {
        const ang = a + (s - (shots - 1) / 2) * 0.18;
        eBullets.push({
          x: ex, y: ey,
          vx: Math.cos(ang) * (e.type === 'boss' ? 170 : 145),
          vy: Math.sin(ang) * (e.type === 'boss' ? 170 : 145),
          r: e.type === 'boss' ? 5 : 4,
          dmg: e.type === 'boss' ? 16 : 10,
          life: 3,
          color: e.color,
        });
      }
    }
  }

  for (let i = eBullets.length - 1; i >= 0; i--) {
    const b = eBullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    const sx = worldToScreenX(b.x);
    if (b.life <= 0 || sx < -30 || sx > W + 30 || b.y < 0 || b.y > H) {
      eBullets.splice(i, 1);
      continue;
    }
    if (circleHit(b.x, b.y, b.r, pcx, pcy, Math.min(player.w, player.h) * 0.38)) {
      hurtPlayer(b.dmg);
      eBullets.splice(i, 1);
      spark(b.x, b.y, b.color);
    }
  }

  // Gems (world, slight gravity)
  const magnetR = PLAYER.magnet * stats.magnetMul;
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    g.life -= dt;
    g.vy += 400 * dt;
    g.vx *= 0.98;
    const d = dist(g.x, g.y, pcx, pcy);
    if (d < magnetR) {
      const pull = (1 - d / magnetR) * 420;
      const a = angleTo(g.x, g.y, pcx, pcy);
      g.vx += Math.cos(a) * pull * dt;
      g.vy += Math.sin(a) * pull * dt;
    }
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    // land on platforms
    for (const pl of platforms) {
      if (g.x >= pl.x && g.x <= pl.x + pl.w && g.y >= pl.y && g.y <= pl.y + 12 && g.vy > 0) {
        g.y = pl.y;
        g.vy = 0;
        g.vx *= 0.8;
      }
    }
    if (d < 22) {
      addXp(g.xp);
      score += 1;
      sfxPickup();
      gems.splice(i, 1);
      if (state !== 'play') return;
      continue;
    }
    if (g.life <= 0) gems.splice(i, 1);
  }

  // Pickups
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.life -= dt;
    p.vy = (p.vy || 0) + 300 * dt;
    p.y += p.vy * dt;
    for (const pl of platforms) {
      if (p.x >= pl.x && p.x <= pl.x + pl.w && p.y >= pl.y - 4 && p.y <= pl.y + 10 && p.vy > 0) {
        p.y = pl.y - 4;
        p.vy = 0;
      }
    }
    if (circleHit(p.x, p.y, p.r, pcx, pcy, 18)) {
      if (p.kind === 'heal') {
        player.hp = Math.min(player.maxHp, player.hp + 30);
        sfxPickup();
        burst(p.x, p.y, '#7dffa0', 10, 90);
      }
      pickups.splice(i, 1);
      continue;
    }
    if (p.life <= 0) pickups.splice(i, 1);
  }

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // Waves
  waveTimer -= dt;
  if (spawnQueue > 0 && waveTimer <= 0) {
    spawnEnemy(pickEnemyType(wave));
    spawnQueue -= 1;
    waveTimer = Math.max(WAVE.minInterval, WAVE.baseInterval - (wave - 1) * WAVE.ramp) * rand(0.7, 1.15);
  }
  if (spawnQueue <= 0 && enemies.length === 0) {
    wave += 1;
    startWave();
  }

  // Distance + survival score
  score += dt * 2;
  score += Math.max(0, player.vx) * dt * 0.02;
}
