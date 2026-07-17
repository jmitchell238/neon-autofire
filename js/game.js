'use strict';

// ---- Run state --------------------------------------------------------------
let state = 'menu'; // menu | play | levelup | over
let score = 0;
let kills = 0;
let wave = 1;
let waveTimer = 0;
let spawnQueue = 0;
let scrollX = 0;
let time = 0;
let shake = 0;
let overReason = '';

// Player
let player = null;
// stats from upgrades
let stats = null;

// World pools
let bullets = [];
let enemies = [];
let gems = [];
let particles = [];
let pickups = [];
let eBullets = []; // enemy bullets
let orbits = [];

// Level-up UI choices
let levelChoices = [];

// Fire cadence
let fireCd = 0;
let eFireCd = 0;

function defaultStats() {
  return {
    damage: 12,
    fireRate: 4.2,     // shots / sec base
    spread: 0,         // extra angled shots each side (0 = single)
    multi: 0,          // extra parallel barrels
    pierce: 0,
    speedMul: 1,
    magnetMul: 1,
    orbit: 0,
    bulletSpeed: 420,
    bulletR: 4,
  };
}

function makePlayer() {
  return {
    x: PLAY.left + 70,
    y: (PLAY.top + PLAY.bottom) / 2,
    r: PLAYER.r,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    inv: 0,
    level: 1,
    xp: 0,
    xpNext: xpForLevel(1),
    facing: 0,
  };
}

function resetRun() {
  score = 0;
  kills = 0;
  wave = 1;
  waveTimer = 0.6;
  spawnQueue = 0;
  scrollX = 0;
  time = 0;
  shake = 0;
  overReason = '';
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
  stats = defaultStats();
  player = makePlayer();
  rebuildOrbits();
}

function startGame() {
  resetRun();
  state = 'play';
}

function endGame(reason) {
  if (state === 'over') return;
  state = 'over';
  overReason = reason || 'Hull breached!';
  sfxGameOver();
  recordGameEnd(score, wave, kills);
  burst(player.x, player.y, '#3de7ff', 28, 180);
  burst(player.x, player.y, '#ff4fd8', 18, 140);
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
  if (w >= 8 && roll < 0.08) return 'tank';
  if (w >= 4 && roll < 0.18) return 'sniper';
  if (w >= 3 && roll < 0.35) return 'zig';
  if (w >= 2 && roll < 0.5) return 'swarm';
  if (w >= 6 && roll < 0.62) return 'tank';
  return 'drone';
}

function spawnEnemy(type) {
  if (enemies.length >= MAX_ENEMIES) return;
  const def = ENEMIES[type] || ENEMIES.drone;
  const scale = 1 + (wave - 1) * 0.07;
  const y = rand(PLAY.top + def.r + 8, PLAY.bottom - def.r - 8);
  const e = {
    type,
    x: PLAY.right + def.r + rand(10, 80),
    y,
    r: def.r,
    hp: def.hp * scale,
    maxHp: def.hp * scale,
    speed: def.speed * (0.9 + Math.random() * 0.25),
    score: Math.floor(def.score * (1 + (wave - 1) * 0.05)),
    xp: def.xp,
    color: def.color,
    damage: def.damage,
    shoots: !!def.shoots,
    phase: Math.random() * Math.PI * 2,
    baseY: y,
    flash: 0,
  };
  enemies.push(e);
}

function spawnBoss() {
  spawnEnemy('boss');
  const boss = enemies[enemies.length - 1];
  if (boss) {
    boss.x = PLAY.right + 50;
    boss.y = (PLAY.top + PLAY.bottom) / 2;
    boss.baseY = boss.y;
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
  const target = nearestEnemy(player.x, player.y);
  let aim = 0;
  if (target) {
    aim = angleTo(player.x, player.y, target.x, target.y);
  } else {
    aim = 0; // default right
  }
  player.facing = aim;

  const barrels = 1 + stats.multi;
  const spreadN = stats.spread;
  const angles = [];

  // base arc: center + left/right fans
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

  const offsetStep = 10;
  for (let b = 0; b < barrels; b++) {
    const lat = (b - (barrels - 1) / 2) * offsetStep;
    const ox = Math.cos(aim + Math.PI / 2) * lat;
    const oy = Math.sin(aim + Math.PI / 2) * lat;
    for (const a of angles) {
      if (bullets.length >= MAX_BULLETS) break;
      bullets.push({
        x: player.x + Math.cos(a) * (player.r + 4) + ox,
        y: player.y + Math.sin(a) * (player.r + 4) + oy,
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
    const d = dist(x, y, e.x, e.y);
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
      r: 34 + i * 4,
      dmg: 8 + stats.damage * 0.35,
      size: 6,
    });
  }
}

function killEnemy(e, idx) {
  score += e.score;
  kills += 1;
  burst(e.x, e.y, e.color, e.type === 'boss' ? 40 : 14, e.type === 'boss' ? 220 : 150);
  sfxExplode(e.type === 'boss');
  shake = Math.max(shake, e.type === 'boss' ? 10 : 3);

  // XP gems
  const n = e.type === 'boss' ? 10 : e.type === 'tank' ? 3 : 1;
  for (let i = 0; i < n; i++) {
    if (gems.length >= MAX_GEMS) break;
    gems.push({
      x: e.x + rand(-8, 8),
      y: e.y + rand(-8, 8),
      r: 5,
      xp: Math.max(1, Math.floor(e.xp / n) || 1),
      vx: rand(-40, 40),
      vy: rand(-40, 40),
      life: 12,
    });
  }

  // Occasional heal pickup
  if (e.type === 'boss' || (Math.random() < 0.06 && pickups.length < MAX_PICKUPS)) {
    pickups.push({
      x: e.x, y: e.y, r: 9, kind: 'heal', life: 10,
    });
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
  // Build 3 unique choices from upgrades, respecting max stacks
  const owned = player._owned || (player._owned = {});
  const pool = UPGRADES.filter(u => {
    if (u.id === 'heal') return player.hp < player.maxHp;
    const count = owned[u.id] || 0;
    if (u.max != null && count >= u.max) return false;
    return true;
  });
  shuffle(pool);
  levelChoices = pool.slice(0, 3);
  // Fallback if pool tiny
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
  // If still pending levels (multiple level-ups), open again; else resume
  if (player.xp >= player.xpNext) {
    // shouldn't happen due to while loop, but be safe
    openLevelUp();
  } else {
    state = 'play';
  }
}

function hurtPlayer(dmg) {
  if (!player || player.inv > 0) return;
  player.hp -= dmg;
  player.inv = PLAYER.invuln;
  shake = Math.max(shake, 6);
  sfxHurt();
  burst(player.x, player.y, '#ff4fd8', 10, 120);
  if (player.hp <= 0) {
    player.hp = 0;
    endGame('Hull breached!');
  }
}

// ---- Input-driven movement (called from main with stick vector) ------------
function movePlayer(dt, ix, iy) {
  if (!player || state !== 'play') return;
  const len = Math.hypot(ix, iy);
  let mx = 0, my = 0;
  if (len > 0.08) {
    mx = ix / Math.max(1, len);
    my = iy / Math.max(1, len);
    // allow soft clamp of stick magnitude
    const mag = Math.min(1, len);
    mx *= mag;
    my *= mag;
  }
  const spd = PLAYER.speed * stats.speedMul;
  player.x += mx * spd * dt;
  player.y += my * spd * dt;
  player.x = clamp(player.x, PLAY.left + player.r, PLAY.right - player.r);
  player.y = clamp(player.y, PLAY.top + player.r, PLAY.bottom - player.r);
}

// ---- Main update ------------------------------------------------------------
function updatePlay(dt, inputX, inputY) {
  if (state !== 'play') return;
  time += dt;
  scrollX += 60 * dt;
  if (shake > 0) shake = Math.max(0, shake - dt * 28);

  movePlayer(dt, inputX, inputY);
  if (player.inv > 0) player.inv -= dt;

  // Auto fire
  fireCd -= dt;
  const interval = 1 / Math.max(0.5, stats.fireRate);
  if (fireCd <= 0) {
    firePlayer();
    fireCd = interval;
  }

  // Orbits
  for (const o of orbits) {
    o.angle += dt * 2.4;
    const ox = player.x + Math.cos(o.angle) * o.r;
    const oy = player.y + Math.sin(o.angle) * o.r;
    o.x = ox;
    o.y = oy;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (circleHit(ox, oy, o.size, e.x, e.y, e.r)) {
        e.hp -= o.dmg * dt * 3;
        e.flash = 0.08;
        spark(ox, oy, '#ff4fd8');
        if (e.hp <= 0) killEnemy(e, i);
      }
    }
  }

  // Bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < PLAY.left - 20 || b.x > PLAY.right + 40 ||
        b.y < PLAY.top - 20 || b.y > PLAY.bottom + 20) {
      bullets.splice(i, 1);
      continue;
    }
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (!circleHit(b.x, b.y, b.r, e.x, e.y, e.r)) continue;
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

  // Enemy movement + contact
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.phase += dt;
    if (e.flash > 0) e.flash -= dt;

    if (e.type === 'zig') {
      e.x -= e.speed * dt;
      e.y = e.baseY + Math.sin(e.phase * 4) * 40;
    } else if (e.type === 'swarm') {
      e.x -= e.speed * dt;
      e.y += Math.sin(e.phase * 6 + e.x * 0.02) * 30 * dt;
    } else if (e.type === 'boss') {
      // Hold on right third, bob, drift slowly left then hold
      const targetX = PLAY.right - 70;
      if (e.x > targetX) e.x -= e.speed * dt;
      else e.x += Math.sin(e.phase * 0.7) * 12 * dt;
      e.y = e.baseY + Math.sin(e.phase * 1.2) * 50;
      e.y = clamp(e.y, PLAY.top + e.r, PLAY.bottom - e.r);
    } else if (e.type === 'sniper') {
      e.x -= e.speed * 0.7 * dt;
      // lightly track player Y
      e.y += (player.y - e.y) * 0.6 * dt;
    } else if (e.type === 'tank') {
      e.x -= e.speed * dt;
    } else {
      e.x -= e.speed * dt;
      // mild chase
      e.y += (player.y - e.y) * 0.35 * dt;
    }

    e.y = clamp(e.y, PLAY.top + e.r, PLAY.bottom - e.r);

    if (e.x < PLAY.left - e.r - 30) {
      enemies.splice(i, 1);
      continue;
    }

    if (circleHit(player.x, player.y, player.r * 0.85, e.x, e.y, e.r * 0.85)) {
      hurtPlayer(e.damage);
      // small knockback feel: flash enemy
      e.flash = 0.12;
    }
  }

  // Enemy shooting
  eFireCd -= dt;
  if (eFireCd <= 0) {
    eFireCd = Math.max(0.55, 1.4 - wave * 0.04);
    for (const e of enemies) {
      if (!e.shoots) continue;
      if (e.x > PLAY.right + 10) continue;
      if (Math.random() > (e.type === 'boss' ? 0.85 : 0.45)) continue;
      const a = angleTo(e.x, e.y, player.x, player.y);
      const shots = e.type === 'boss' ? 3 : 1;
      for (let s = 0; s < shots; s++) {
        const ang = a + (s - (shots - 1) / 2) * 0.18;
        eBullets.push({
          x: e.x, y: e.y,
          vx: Math.cos(ang) * (e.type === 'boss' ? 160 : 140),
          vy: Math.sin(ang) * (e.type === 'boss' ? 160 : 140),
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
    if (b.life <= 0 || b.x < PLAY.left - 20 || b.x > PLAY.right + 20 ||
        b.y < PLAY.top - 20 || b.y > PLAY.bottom + 20) {
      eBullets.splice(i, 1);
      continue;
    }
    if (circleHit(b.x, b.y, b.r, player.x, player.y, player.r * 0.9)) {
      hurtPlayer(b.dmg);
      eBullets.splice(i, 1);
      spark(b.x, b.y, b.color);
    }
  }

  // Gems
  const magnetR = PLAYER.magnet * stats.magnetMul;
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    g.life -= dt;
    g.vx *= 0.96;
    g.vy *= 0.96;
    const d = dist(g.x, g.y, player.x, player.y);
    if (d < magnetR) {
      const pull = (1 - d / magnetR) * 380;
      const a = angleTo(g.x, g.y, player.x, player.y);
      g.vx += Math.cos(a) * pull * dt;
      g.vy += Math.sin(a) * pull * dt;
    }
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    if (d < player.r + g.r + 4) {
      addXp(g.xp);
      score += 1;
      sfxPickup();
      gems.splice(i, 1);
      // if level-up opened, stop processing this frame cleanly
      if (state !== 'play') return;
      continue;
    }
    if (g.life <= 0) gems.splice(i, 1);
  }

  // Heal pickups
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.life -= dt;
    p.y += Math.sin(time * 4 + p.x) * 8 * dt;
    if (circleHit(p.x, p.y, p.r, player.x, player.y, player.r)) {
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

  // Survival score drip
  score += dt * 2;
}
