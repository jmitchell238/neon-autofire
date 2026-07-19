'use strict';

/** Peak jump height in world pixels (Y decreases upward). */
function jumpPeakHeight(jumpMul) {
  return maxJumpHeight(jumpMul || 1);
}

/** Return whether a full single jump can reach one platform from another. */
function canReachPlatform(from, to, jumpMul, speedMul) {
  if (!from || !to) return false;
  const jm = jumpMul || 1;
  const sm = speedMul || 1;
  const rise = from.y - to.y;
  const peak = jumpPeakHeight(jm);
  if (rise > peak * 0.92) return false;
  if (rise > peak * JUMP_SAFE.riseFrac) return false;
  if (rise < -JUMP_SAFE.maxDrop) return false;

  const gap = to.x - (from.x + from.w);
  if (gap <= 0) return true;

  const baseDist = maxJumpDistance(jm, sm);
  let gapFrac = JUMP_SAFE.gapFracSame;
  if (rise > 12) gapFrac = JUMP_SAFE.gapFracUp;
  else if (rise < -30) gapFrac = JUMP_SAFE.gapFracDown;
  if (rise > 0) {
    const t = clamp(rise / (peak * JUMP_SAFE.riseFrac), 0, 1);
    gapFrac *= lerp(1, 0.72, t);
  }
  return gap <= baseDist * gapFrac;
}

function platformsChainReachable(list, jumpMul, speedMul) {
  if (!list || list.length < 2) return true;
  const sorted = list.slice().sort((a, b) => a.x - b.x);
  for (let i = 1; i < sorted.length; i++) {
    if (!canReachPlatform(sorted[i - 1], sorted[i], jumpMul, speedMul)) return false;
  }
  return true;
}

function makePlatform(x, y, w) {
  const ground = y >= GROUND_Y - 2;
  return {
    x,
    y: clamp(y, PLAY.top + 90, GROUND_Y),
    w: Math.max(JUMP_SAFE.minWidth, w),
    h: ground ? 24 : 14,
    ground,
  };
}

function seedPlatforms() {
  platforms = [];
  platforms.push(makePlatform(-40, GROUND_Y, 560));
  worldGenX = platforms[0].x + platforms[0].w;
  generatePlatformsAhead();
}

function generatePlatformsAhead(reachability) {
  const canReach = reachability || canReachPlatform;
  const ahead = cameraX + W * 3 + 200;
  const peak = jumpPeakHeight(1);
  const maxRise = peak * JUMP_SAFE.riseFrac;
  const baseDist = maxJumpDistance(1, 1);

  while (worldGenX < ahead && platforms.length < MAX_PLATFORMS) {
    const prev = platforms[platforms.length - 1];
    let placed = null;

    for (let attempt = 0; attempt < 14 && !placed; attempt++) {
      const roll = Math.random();
      let rise = 0;
      if (roll < 0.38) rise = rand(-18, 18);
      else if (roll < 0.72) rise = rand(-50, maxRise * 0.75);
      else rise = rand(10, maxRise);

      let y;
      if (Math.random() < 0.28) {
        y = GROUND_Y;
        rise = prev.y - y;
      } else {
        y = prev.y - rise;
      }
      y = clamp(y, GROUND_Y - maxRise * 1.05, GROUND_Y);

      const riseActual = prev.y - y;
      let gapFrac = JUMP_SAFE.gapFracSame;
      if (riseActual > 12) gapFrac = JUMP_SAFE.gapFracUp;
      else if (riseActual < -30) gapFrac = JUMP_SAFE.gapFracDown;
      if (riseActual > 0) {
        const t = clamp(riseActual / maxRise, 0, 1);
        gapFrac *= lerp(1, 0.72, t);
      }
      const maxGap = baseDist * gapFrac;
      const gap = rand(JUMP_SAFE.minGap, Math.max(JUMP_SAFE.minGap + 8, maxGap));
      const candidate = makePlatform(
        prev.x + prev.w + gap,
        y,
        rand(JUMP_SAFE.minWidth, JUMP_SAFE.maxWidth)
      );
      if (canReach(prev, candidate, 1, 1)) placed = candidate;
    }

    if (!placed) {
      const gap = rand(JUMP_SAFE.minGap, Math.min(56, baseDist * 0.4));
      const y = Math.min(GROUND_Y, prev.y + rand(0, 24));
      placed = makePlatform(prev.x + prev.w + gap, y, rand(110, 160));
    }

    platforms.push(placed);
    worldGenX = placed.x + placed.w;
  }

  const minX = cameraX - 200;
  platforms = platforms.filter(p => p.x + p.w > minX);
}

function solidAt(px, py, pw, ph) {
  const left = px - pw / 2;
  const right = px + pw / 2;
  const top = py - ph;
  const bottom = py;
  for (const platform of platforms) {
    if (right <= platform.x || left >= platform.x + platform.w) continue;
    if (bottom <= platform.y || top >= platform.y + platform.h) continue;
    return platform;
  }
  return null;
}
