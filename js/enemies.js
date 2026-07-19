'use strict';

function waveEnemyBudget(currentWave) {
  return Math.floor(WAVE.baseCount + currentWave * WAVE.countRamp);
}

function selectEnemyType(currentWave, roll) {
  if (currentWave >= 8 && roll < 0.08) return 'brute';
  if (currentWave >= 4 && roll < 0.18) return 'gunner';
  if (currentWave >= 3 && roll < 0.35) return 'hopper';
  if (currentWave >= 2 && roll < 0.55) return 'flyer';
  if (currentWave >= 6 && roll < 0.65) return 'brute';
  return 'grunt';
}

function pickEnemyType(currentWave) {
  return selectEnemyType(currentWave, Math.random());
}

function findSpawnPlatform(minWorldX) {
  let best = null;
  for (const platform of platforms) {
    if (platform.x + platform.w < minWorldX) continue;
    if (platform.x > minWorldX + W * 1.5) continue;
    if (!best || platform.x < best.x) best = platform;
  }
  return best;
}

function normalizeEnemyType(type) {
  const aliases = { drone: 'grunt', zig: 'hopper', tank: 'brute', sniper: 'gunner', swarm: 'flyer' };
  return aliases[type] || type;
}

function createEnemy(type, x, y, scale) {
  const def = ENEMIES[type] || ENEMIES.grunt;
  return {
    type, x, y,
    w: def.w,
    h: def.h,
    r: Math.max(def.w, def.h) * 0.45,
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
  };
}

function spawnEnemy(requestedType) {
  if (enemies.length >= MAX_ENEMIES) return;
  const type = normalizeEnemyType(requestedType);
  const def = ENEMIES[type] || ENEMIES.grunt;
  const scale = 1 + (wave - 1) * 0.07;
  const spawnX = cameraX + W + rand(20, 100);
  let x = spawnX;
  let y = GROUND_Y;

  if (def.fly) {
    y = rand(PLAY.top + 60, GROUND_Y - 80);
  } else {
    const platform = findSpawnPlatform(spawnX - 40);
    if (platform) {
      const minX = Math.max(platform.x + 10, cameraX + W + 20);
      const maxX = platform.x + platform.w - 10;
      if (minX <= maxX) {
        x = rand(minX, maxX);
        y = platform.y;
      }
    }
  }
  enemies.push(createEnemy(type, x, y, scale));
}

function spawnBoss() {
  spawnEnemy('boss');
  const boss = enemies[enemies.length - 1];
  if (!boss) return;
  boss.x = cameraX + W + 40;
  boss.y = GROUND_Y;
  boss.hp = ENEMIES.boss.hp * (1 + (wave - 1) * 0.12);
  boss.maxHp = boss.hp;
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

function updateEnemy(enemy, dt) {
  enemy.phase += dt;
  if (enemy.flash > 0) enemy.flash -= dt;

  if (enemy.fly) {
    enemy.x -= enemy.speed * dt * 0.7;
    enemy.y = clamp(enemy.baseY + Math.sin(enemy.phase * 3) * 28, PLAY.top + 50, GROUND_Y - 40);
    enemy.facing = player.x < enemy.x ? -1 : 1;
    return;
  }

  const direction = player.x < enemy.x ? -1 : 1;
  enemy.facing = direction;
  enemy.vx = direction * enemy.speed;
  if (enemy.type === 'boss') {
    const ideal = player.x + 90;
    enemy.vx = clamp(ideal - enemy.x, -enemy.speed, enemy.speed);
  }
  if (enemy.hop && enemy.onGround && Math.random() < 0.02) {
    enemy.vy = -380;
    enemy.onGround = false;
  }

  enemy.vy = Math.min(PLAYER.maxFall, enemy.vy + PLAYER.gravity * dt);
  enemy.x += enemy.vx * dt;
  enemy.onGround = false;
  enemy.y += enemy.vy * dt;

  if (enemy.vy >= 0) {
    for (const platform of platforms) {
      if (enemy.x + enemy.w / 2 <= platform.x + 2 ||
          enemy.x - enemy.w / 2 >= platform.x + platform.w - 2) continue;
      const previousY = enemy.y - enemy.vy * dt;
      if (previousY <= platform.y + 4 && enemy.y >= platform.y &&
          enemy.y <= platform.y + platform.h + 10) {
        enemy.y = platform.y;
        enemy.vy = 0;
        enemy.onGround = true;
        break;
      }
    }
  }

  if (enemy.onGround && enemy.type !== 'boss') {
    const probeX = enemy.x + enemy.facing * (enemy.w / 2 + 6);
    const hasFloor = platforms.some(platform =>
      probeX >= platform.x && probeX <= platform.x + platform.w && Math.abs(platform.y - enemy.y) < 6
    );
    if (!hasFloor && Math.random() < 0.4) enemy.vx *= -1;
  }

  if (enemy.y > PLAY.bottom + 100) {
    enemy.y = GROUND_Y;
    enemy.x = cameraX + W + 40;
    enemy.vy = 0;
  }
}

function enemyHitCircle(enemy) {
  return { x: enemy.x, y: enemy.y - enemy.h / 2, r: enemy.r };
}
