'use strict';

/** Pure aiming helper: calculate the projectile arcs for one trigger event. */
function shotAngles(aim, spread) {
  if (spread === 0) return [aim];
  const span = Math.min(0.9, 0.18 + spread * 0.12);
  const total = 1 + spread * 2;
  return Array.from({ length: total }, (_, index) => {
    const t = total === 1 ? 0.5 : index / (total - 1);
    return aim - span + t * span * 2;
  });
}

/** Pure projectile factory. Mutation is confined to PlayerWeaponSystem.fire(). */
function createPlayerBullet(x, y, angle, lateralX, lateralY, weaponStats) {
  return {
    x: x + Math.cos(angle) * 16 + lateralX,
    y: y + Math.sin(angle) * 16 + lateralY,
    vx: Math.cos(angle) * weaponStats.bulletSpeed,
    vy: Math.sin(angle) * weaponStats.bulletSpeed,
    r: weaponStats.bulletR,
    dmg: weaponStats.damage,
    pierce: weaponStats.pierce,
    life: 1.4,
    color: '#7af0ff',
  };
}

class PlayerWeaponSystem {
  constructor() {
    this.cooldown = 0;
  }

  update(dt) {
    this.cooldown -= dt;
    if (this.cooldown > 0) return;
    this.fire();
    this.cooldown = 1 / Math.max(0.5, stats.fireRate);
  }

  fire() {
    if (!player) return;
    const x = playerCx(player);
    const y = playerCy(player) - 4;
    const target = nearestEnemy(x, y);
    const aim = target
      ? angleTo(x, y, target.x, target.y - target.h / 2)
      : player.facing > 0 ? 0 : Math.PI;
    player.aim = aim;

    const barrels = 1 + stats.multi;
    const angles = shotAngles(aim, stats.spread);
    for (let barrel = 0; barrel < barrels; barrel++) {
      const lateral = (barrel - (barrels - 1) / 2) * 8;
      const lateralX = Math.cos(aim + Math.PI / 2) * lateral;
      const lateralY = Math.sin(aim + Math.PI / 2) * lateral;
      for (const angle of angles) {
        if (bullets.length >= MAX_BULLETS) break;
        bullets.push(createPlayerBullet(x, y, angle, lateralX, lateralY, stats));
      }
    }
    sfxShoot();
  }
}

// Compatibility facade used by tests and any future UI/debug controls.
function firePlayer() {
  if (!playerWeapon) playerWeapon = new PlayerWeaponSystem();
  playerWeapon.fire();
}

function nearestEnemy(x, y) {
  let best = null;
  let bestDistance = Infinity;
  for (const enemy of enemies) {
    const distance = dist(x, y, enemy.x, enemy.y - enemy.h / 2);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = enemy;
    }
  }
  return best;
}

function rebuildOrbits() {
  const count = stats.orbit;
  orbits = Array.from({ length: count }, (_, index) => ({
    angle: (index / Math.max(1, count)) * Math.PI * 2,
    r: 30 + index * 5,
    dmg: 8 + stats.damage * 0.35,
    size: 6,
  }));
}

function killEnemy(enemy, index) {
  score += enemy.score;
  kills += 1;
  const x = enemy.x;
  const y = enemy.y - enemy.h / 2;
  burst(x, y, enemy.color, enemy.type === 'boss' ? 40 : 14, enemy.type === 'boss' ? 220 : 150);
  sfxExplode(enemy.type === 'boss');
  shake = Math.max(shake, enemy.type === 'boss' ? 4 : 1.5);

  const gemCount = enemy.type === 'boss' ? 10 : enemy.type === 'brute' || enemy.type === 'tank' ? 3 : 1;
  for (let i = 0; i < gemCount && gems.length < MAX_GEMS; i++) {
    gems.push({
      x: x + rand(-8, 8),
      y: y + rand(-8, 8),
      r: 5,
      xp: Math.max(1, Math.floor(enemy.xp / gemCount) || 1),
      vx: rand(-40, 40),
      vy: rand(-120, -20),
      life: 12,
    });
  }

  if (enemy.type === 'boss' || (Math.random() < 0.06 && pickups.length < MAX_PICKUPS)) {
    pickups.push({ x, y, r: 9, kind: 'heal', life: 10, vy: 0 });
  }
  enemies.splice(index, 1);
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
  const pool = UPGRADES.filter(upgrade => {
    if (upgrade.id === 'heal') return player.hp < player.maxHp;
    const count = owned[upgrade.id] || 0;
    return upgrade.max == null || count < upgrade.max;
  });
  shuffle(pool);
  levelChoices = pool.slice(0, 3);
  while (levelChoices.length < 3) levelChoices.push(UPGRADES.find(upgrade => upgrade.id === 'dmg'));
  state = 'levelup';
  sfxLevelUp();
}

function applyUpgrade(upgrade) {
  if (!upgrade || !player) return;
  const owned = player._owned || (player._owned = {});
  owned[upgrade.id] = (owned[upgrade.id] || 0) + 1;

  switch (upgrade.id) {
    case 'dmg': stats.damage *= 1.2; break;
    case 'rate': stats.fireRate *= 1.18; break;
    case 'spread': stats.spread += 1; break;
    case 'speed': stats.speedMul *= 1.12; break;
    case 'hp':
      player.maxHp += 25;
      player.hp = Math.min(player.maxHp, player.hp + 25);
      break;
    case 'magnet': stats.magnetMul *= 1.3; break;
    case 'multi': stats.multi += 1; break;
    case 'pierce': stats.pierce += 1; break;
    case 'jump': stats.jumpMul *= 1.12; break;
    case 'orbit':
      stats.orbit += 1;
      rebuildOrbits();
      break;
    case 'heal': player.hp = Math.min(player.maxHp, player.hp + 40); break;
  }
  sfxUpgrade();
  levelChoices = [];
  if (player.xp >= player.xpNext) openLevelUp();
  else state = 'play';
}

function hurtPlayer(damage) {
  if (!player || player.inv > 0) return;
  player.hp -= damage;
  player.inv = PLAYER.invuln;
  shake = Math.max(shake, 2.5);
  sfxHurt();
  burst(playerCx(player), playerCy(player), '#ff4fd8', 10, 120);
  if (player.hp <= 0) {
    player.hp = 0;
    endGame('Knocked out!');
  }
}
