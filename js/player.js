'use strict';

class PlayerEntity {
  constructor() {
    this.x = 80;
    this.y = GROUND_Y;
    this.w = PLAYER.w;
    this.h = PLAYER.h;
    this.vx = 0;
    this.vy = 0;
    this.hp = PLAYER.maxHp;
    this.maxHp = PLAYER.maxHp;
    this.inv = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNext = xpForLevel(1);
    this.facing = 1;
    this.aim = 0;
    this.onGround = true;
    this.coyote = 0;
    this.anim = 0;
    this._owned = {};
  }
}

function makePlayer() { return new PlayerEntity(); }

function playerTop(p) { return p.y - p.h; }
function playerLeft(p) { return p.x - p.w / 2; }
function playerRight(p) { return p.x + p.w / 2; }
function playerCx(p) { return p.x; }
function playerCy(p) { return p.y - p.h / 2; }

function requestJump() {
  jumpBuffered = PLAYER.jumpBuffer;
}

function setJumpHeld(held) {
  jumpHeld = held;
}

function movePlayer(dt, ix, iy, wantJump) {
  if (!player || state !== 'play') return;
  if (wantJump) requestJump();
  if (iy < -0.55) requestJump();

  const speed = PLAYER.runSpeed * stats.speedMul;
  const control = player.onGround ? 1 : PLAYER.airControl;
  const moveX = Math.abs(ix) > 0.08 ? clamp(ix, -1, 1) : 0;
  const targetVx = moveX * speed;
  const accel = player.onGround ? 2800 : 1800;
  if (Math.abs(targetVx - player.vx) < accel * dt) player.vx = targetVx;
  else player.vx += Math.sign(targetVx - player.vx) * accel * dt * control;

  if (moveX > 0.1) player.facing = 1;
  else if (moveX < -0.1) player.facing = -1;

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
  if (!jumpHeld && player.vy < -80) player.vy *= 0.55;

  player.vy = Math.min(PLAYER.maxFall, player.vy + PLAYER.gravity * dt);
  player.x += player.vx * dt;
  const minX = cameraX + 24;
  if (player.x < minX) {
    player.x = minX;
    player.vx = Math.max(0, player.vx);
  }

  player.onGround = false;
  player.y += player.vy * dt;
  if (player.vy >= 0) {
    for (const platform of platforms) {
      const left = playerLeft(player);
      const right = playerRight(player);
      if (right <= platform.x + 2 || left >= platform.x + platform.w - 2) continue;
      const prevFeet = player.y - player.vy * dt;
      const crossed = prevFeet <= platform.y + 6 && player.y >= platform.y;
      const resting = player.y >= platform.y - 2 &&
        player.y <= platform.y + Math.max(platform.h + 10, 28);
      if (crossed || (resting && prevFeet <= platform.y + 20)) {
        player.y = platform.y;
        player.vy = 0;
        player.onGround = true;
        break;
      }
    }
  }

  if (player.vy < 0) {
    for (const platform of platforms) {
      const left = playerLeft(player);
      const right = playerRight(player);
      const top = playerTop(player);
      if (right <= platform.x || left >= platform.x + platform.w) continue;
      if (top <= platform.y + platform.h && player.y - player.h / 2 > platform.y &&
          player.y > platform.y && top < platform.y + platform.h &&
          player.y > platform.y + platform.h) {
        player.y = platform.y + platform.h + player.h;
        player.vy = 0;
      }
    }
  }

  if (player.y > PLAY.bottom + 80) {
    hurtPlayer(25);
    player.y = GROUND_Y;
    player.vy = 0;
    player.x = cameraX + CAM.focusX;
    player.inv = PLAYER.invuln;
  }

  if (player.onGround && Math.abs(player.vx) > 20) {
    player.anim += dt * (Math.abs(player.vx) / PLAYER.runSpeed);
  } else if (!player.onGround) {
    player.anim += dt * 0.35;
  } else {
    player.anim += dt * 0.5;
  }
}

function updateCamera(dt) {
  const target = player.x - CAM.focusX;
  cameraX = lerp(cameraX, target, 1 - Math.exp(-CAM.lerp * dt));
  if (cameraX < 0) cameraX = 0;
  if (player.x - cameraX < 40) cameraX = player.x - 40;
}

function worldToScreenX(worldX) {
  return worldX - cameraX;
}
