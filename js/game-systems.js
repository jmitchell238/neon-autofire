'use strict';

function updateOrbits(dt, playerX, playerY) {
  for (const orbit of orbits) {
    orbit.angle += dt * 2.4;
    orbit.x = playerX + Math.cos(orbit.angle) * orbit.r;
    orbit.y = playerY + Math.sin(orbit.angle) * orbit.r;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      const hitCircle = enemyHitCircle(enemy);
      if (!circleHit(orbit.x, orbit.y, orbit.size, hitCircle.x, hitCircle.y, hitCircle.r)) continue;
      enemy.hp -= orbit.dmg * dt * 3;
      enemy.flash = 0.08;
      spark(orbit.x, orbit.y, '#ff4fd8');
      if (enemy.hp <= 0) killEnemy(enemy, i);
    }
  }
}

function updatePlayerBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    const screenX = worldToScreenX(bullet.x);
    if (bullet.life <= 0 || screenX < -40 || screenX > W + 60 ||
        bullet.y < PLAY.top - 40 || bullet.y > PLAY.bottom + 40) {
      bullets.splice(i, 1);
      continue;
    }
    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];
      const hitCircle = enemyHitCircle(enemy);
      if (!circleHit(bullet.x, bullet.y, bullet.r, hitCircle.x, hitCircle.y, hitCircle.r)) continue;
      enemy.hp -= bullet.dmg;
      enemy.flash = 0.1;
      sfxHit();
      spark(bullet.x, bullet.y, bullet.color);
      if (bullet.pierce > 0) {
        bullet.pierce -= 1;
        bullet.dmg *= 0.85;
      } else {
        bullets.splice(i, 1);
      }
      if (enemy.hp <= 0) killEnemy(enemy, j);
      break;
    }
  }
}

function updateEnemies(dt, playerX, playerY) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    updateEnemy(enemy, dt);
    if (enemy.x < cameraX - 120) {
      enemies.splice(i, 1);
      continue;
    }
    const hitCircle = enemyHitCircle(enemy);
    if (!circleHit(playerX, playerY, Math.min(player.w, player.h) * 0.35,
      hitCircle.x, hitCircle.y, hitCircle.r * 0.85)) continue;
    hurtPlayer(enemy.damage);
    enemy.flash = 0.12;
    player.vx += (player.x < enemy.x ? -1 : 1) * 120;
    player.vy = -180;
    player.onGround = false;
  }
}

function createEnemyBullet(enemy, angle) {
  const speed = enemy.type === 'boss' ? 170 : 145;
  return {
    x: enemy.x,
    y: enemy.y - enemy.h * 0.65,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: enemy.type === 'boss' ? 5 : 4,
    dmg: enemy.type === 'boss' ? 16 : 10,
    life: 3,
    color: enemy.color,
  };
}

function updateEnemyWeapons(dt, playerX, playerY) {
  eFireCd -= dt;
  if (eFireCd <= 0) {
    eFireCd = Math.max(0.55, 1.4 - wave * 0.04);
    for (const enemy of enemies) {
      if (!enemy.shoots || worldToScreenX(enemy.x) > W + 20) continue;
      if (Math.random() > (enemy.type === 'boss' ? 0.85 : 0.4)) continue;
      const aim = angleTo(enemy.x, enemy.y - enemy.h * 0.65, playerX, playerY);
      const shotCount = enemy.type === 'boss' ? 3 : 1;
      for (let shot = 0; shot < shotCount; shot++) {
        const angle = aim + (shot - (shotCount - 1) / 2) * 0.18;
        eBullets.push(createEnemyBullet(enemy, angle));
      }
    }
  }

  for (let i = eBullets.length - 1; i >= 0; i--) {
    const bullet = eBullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    const screenX = worldToScreenX(bullet.x);
    if (bullet.life <= 0 || screenX < -30 || screenX > W + 30 || bullet.y < 0 || bullet.y > H) {
      eBullets.splice(i, 1);
      continue;
    }
    if (circleHit(bullet.x, bullet.y, bullet.r, playerX, playerY,
      Math.min(player.w, player.h) * 0.38)) {
      hurtPlayer(bullet.dmg);
      eBullets.splice(i, 1);
      spark(bullet.x, bullet.y, bullet.color);
    }
  }
}

function landCollectibleOnPlatforms(item, depth) {
  for (const platform of platforms) {
    if (item.x >= platform.x && item.x <= platform.x + platform.w &&
        item.y >= platform.y - 4 && item.y <= platform.y + depth && item.vy > 0) {
      item.y = platform.y - (depth > 10 ? 0 : 4);
      item.vy = 0;
      return true;
    }
  }
  return false;
}

function updateGems(dt, playerX, playerY) {
  const magnetRadius = PLAYER.magnet * stats.magnetMul;
  for (let i = gems.length - 1; i >= 0; i--) {
    const gem = gems[i];
    gem.life -= dt;
    gem.vy += 400 * dt;
    gem.vx *= 0.98;
    const distance = dist(gem.x, gem.y, playerX, playerY);
    if (distance < magnetRadius) {
      const pull = (1 - distance / magnetRadius) * 420;
      const angle = angleTo(gem.x, gem.y, playerX, playerY);
      gem.vx += Math.cos(angle) * pull * dt;
      gem.vy += Math.sin(angle) * pull * dt;
    }
    gem.x += gem.vx * dt;
    gem.y += gem.vy * dt;
    if (landCollectibleOnPlatforms(gem, 12)) gem.vx *= 0.8;

    if (distance < 22) {
      addXp(gem.xp);
      score += 1;
      sfxPickup();
      gems.splice(i, 1);
      if (state !== 'play') return false;
      continue;
    }
    if (gem.life <= 0) gems.splice(i, 1);
  }
  return true;
}

function updatePickups(dt, playerX, playerY) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const pickup = pickups[i];
    pickup.life -= dt;
    pickup.vy = (pickup.vy || 0) + 300 * dt;
    pickup.y += pickup.vy * dt;
    landCollectibleOnPlatforms(pickup, 10);
    if (circleHit(pickup.x, pickup.y, pickup.r, playerX, playerY, 18)) {
      if (pickup.kind === 'heal') {
        player.hp = Math.min(player.maxHp, player.hp + 30);
        sfxPickup();
        burst(pickup.x, pickup.y, '#7dffa0', 10, 90);
      }
      pickups.splice(i, 1);
      continue;
    }
    if (pickup.life <= 0) pickups.splice(i, 1);
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.96;
    particle.vy *= 0.96;
    if (particle.life <= 0) particles.splice(i, 1);
  }
}

function updateWaves(dt) {
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
}
