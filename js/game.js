'use strict';

// Thin application service: it defines update order, while each domain module
// owns its own behavior. Keeping this order explicit makes frame flow auditable.
function updatePlay(dt, inputX, inputY, wantJump) {
  if (state !== 'play') return;
  time += dt;
  scrollX = cameraX;
  if (shake > 0) shake = Math.max(0, shake - dt * 28);

  movePlayer(dt, inputX, inputY, wantJump);
  updateCamera(dt);
  generatePlatformsAhead();
  if (player.inv > 0) player.inv -= dt;

  playerWeapon.update(dt);
  const playerX = playerCx(player);
  const playerY = playerCy(player);
  updateOrbits(dt, playerX, playerY);
  updatePlayerBullets(dt);
  updateEnemies(dt, playerX, playerY);
  updateEnemyWeapons(dt, playerX, playerY);
  if (!updateGems(dt, playerX, playerY)) return;
  updatePickups(dt, playerX, playerY);
  updateParticles(dt);
  updateWaves(dt);

  score += dt * 2;
  score += Math.max(0, player.vx) * dt * 0.02;
}
