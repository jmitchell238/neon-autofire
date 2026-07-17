'use strict';
// Sprite atlas loader + draw helpers (pixel art, no smoothing)

const SPRITE_MANIFEST = {
  // Player — CraftPix Cyborg (OGA-BY) 48×48 strips
  // Keep fps low so limbs stay readable (was blurring at 12–14)
  'player/idle':       { src: 'assets/sprites/player/Cyborg_idle.png',       fw: 48, fh: 48, frames: 4, fps: 4  },
  'player/run':        { src: 'assets/sprites/player/Cyborg_run.png',        fw: 48, fh: 48, frames: 6, fps: 6  },
  'player/jump':       { src: 'assets/sprites/player/Cyborg_jump.png',       fw: 48, fh: 48, frames: 4, fps: 5  },
  'player/runAttack':  { src: 'assets/sprites/player/Cyborg_run_attack.png', fw: 48, fh: 48, frames: 6, fps: 6  },
  'player/hurt':       { src: 'assets/sprites/player/Cyborg_hurt.png',       fw: 48, fh: 48, frames: 2, fps: 4  },
  'player/death':      { src: 'assets/sprites/player/Cyborg_death.png',      fw: 48, fh: 48, frames: 6, fps: 5  },
  'player/doublejump': { src: 'assets/sprites/player/Cyborg_doublejump.png', fw: 48, fh: 48, frames: 6, fps: 5  },

  // Enemies — Biker / Punk (same pack) + Cyber City yakuza (CC0, 64×64 grid 3×4)
  'enemy/biker/idle':  { src: 'assets/sprites/enemies/Biker_idle.png',  fw: 48, fh: 48, frames: 4, fps: 3  },
  'enemy/biker/run':   { src: 'assets/sprites/enemies/Biker_run.png',   fw: 48, fh: 48, frames: 6, fps: 5  },
  'enemy/biker/jump':  { src: 'assets/sprites/enemies/Biker_jump.png',  fw: 48, fh: 48, frames: 4, fps: 4  },
  'enemy/biker/hurt':  { src: 'assets/sprites/enemies/Biker_hurt.png',  fw: 48, fh: 48, frames: 2, fps: 4  },
  'enemy/biker/death': { src: 'assets/sprites/enemies/Biker_death.png', fw: 48, fh: 48, frames: 6, fps: 5  },

  'enemy/punk/idle':   { src: 'assets/sprites/enemies/Punk_idle.png',   fw: 48, fh: 48, frames: 4, fps: 3  },
  'enemy/punk/run':    { src: 'assets/sprites/enemies/Punk_run.png',    fw: 48, fh: 48, frames: 6, fps: 5  },
  'enemy/punk/jump':   { src: 'assets/sprites/enemies/Punk_jump.png',   fw: 48, fh: 48, frames: 4, fps: 4  },
  'enemy/punk/hurt':   { src: 'assets/sprites/enemies/Punk_hurt.png',   fw: 48, fh: 48, frames: 2, fps: 4  },
  'enemy/punk/death':  { src: 'assets/sprites/enemies/Punk_death.png',  fw: 48, fh: 48, frames: 6, fps: 5  },

  // Yakuza sheets: 192×256 → 3 cols × 4 rows of 64×64 (walk cycle row 0)
  'enemy/yakuza1':     { src: 'assets/sprites/enemies/yakuza1.png',     fw: 64, fh: 64, frames: 3, fps: 4, row: 0 },
  'enemy/yakuza2':     { src: 'assets/sprites/enemies/yakuza2.png',     fw: 64, fh: 64, frames: 3, fps: 4, row: 0 },
  'enemy/yakuza3':     { src: 'assets/sprites/enemies/yakuza3.png',     fw: 64, fh: 64, frames: 3, fps: 4, row: 0 },
  'enemy/yakuzaBoss':  { src: 'assets/sprites/enemies/yakuza_boss.png', fw: 64, fh: 64, frames: 3, fps: 3, row: 0 },

  // Environment
  'bg/city':           { src: 'assets/sprites/bg/city_2x.png' },
  'bg/city1x':         { src: 'assets/sprites/bg/city.png' },
  'tile/1':            { src: 'assets/sprites/tiles/tile_1.png' },
  'tile/2':            { src: 'assets/sprites/tiles/tile_2.png' },
  'tile/3':            { src: 'assets/sprites/tiles/tile_3.png' },
  'tile/platform':     { src: 'assets/sprites/tiles/platform_strip.png' },
  'tile/box':          { src: 'assets/sprites/tiles/box.png' },
  'tile/bg1':          { src: 'assets/sprites/tiles/BGTile_1.png' },
  'tile/bg2':          { src: 'assets/sprites/tiles/BGTile_3.png' },
  'fx/bullet':         { src: 'assets/sprites/fx/bullet.png' },
  'fx/gem':            { src: 'assets/sprites/fx/gem.png' },
  'fx/heal':           { src: 'assets/sprites/fx/heal.png' },
  'fx/orbit':          { src: 'assets/sprites/fx/orbit.png' },
};

const spriteCache = Object.create(null); // key → { img, meta, ready }
let spritesReady = false;
let spritesLoadPromise = null;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load ' + src));
    img.src = src;
  });
}

function loadAllSprites() {
  if (spritesLoadPromise) return spritesLoadPromise;
  const entries = Object.entries(SPRITE_MANIFEST);
  spritesLoadPromise = Promise.all(entries.map(async ([key, meta]) => {
    try {
      const img = await loadImage(meta.src);
      spriteCache[key] = { img, meta, ready: true };
    } catch (err) {
      console.warn('[sprites]', err.message);
      spriteCache[key] = { img: null, meta, ready: false };
    }
  })).then(() => {
    spritesReady = Object.values(spriteCache).some(s => s.ready);
    return spritesReady;
  });
  return spritesLoadPromise;
}

function getSprite(key) {
  return spriteCache[key] || null;
}

function animFrame(meta, time, speedMul) {
  const fps = (meta.fps || 8) * (speedMul || 1);
  const n = meta.frames || 1;
  return Math.floor(time * fps) % n;
}

/**
 * Draw a strip/grid sprite.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} key
 * @param {number} frame
 * @param {number} x  world/screen x of feet center
 * @param {number} y  world/screen y of feet
 * @param {object} opts { scale, flip, alpha, cam }
 */
function drawSprite(ctx, key, frame, x, y, opts) {
  opts = opts || {};
  const entry = spriteCache[key];
  if (!entry || !entry.ready || !entry.img) return false;

  const meta = entry.meta;
  const img = entry.img;
  const fw = meta.fw || img.width;
  const fh = meta.fh || img.height;
  const scale = opts.scale != null ? opts.scale : 2;
  const flip = !!opts.flip;
  const cam = opts.cam || 0;
  const sx = x - cam;
  const sy = y;
  const dw = fw * scale;
  const dh = fh * scale;
  const row = meta.row || 0;
  const col = frame % (meta.frames || 1);
  const srcX = col * fw;
  const srcY = row * fh;

  ctx.save();
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  ctx.imageSmoothingEnabled = false;

  if (flip) {
    ctx.translate(sx, sy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, srcX, srcY, fw, fh, -dw / 2, -dh, dw, dh);
  } else {
    ctx.drawImage(img, srcX, srcY, fw, fh, sx - dw / 2, sy - dh, dw, dh);
  }
  ctx.restore();
  return true;
}

/** Draw full image (bg/tiles) stretched or repeated. */
function drawImageKey(ctx, key, dx, dy, dw, dh) {
  const entry = spriteCache[key];
  if (!entry || !entry.ready || !entry.img) return false;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(entry.img, dx, dy, dw, dh);
  return true;
}

function drawImageTiled(ctx, key, x, y, w, h, tileW, tileH, cam) {
  const entry = spriteCache[key];
  if (!entry || !entry.ready || !entry.img) return false;
  const img = entry.img;
  const tw = tileW || 64;
  const th = tileH || 64;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const start = Math.floor((x - cam) / tw) * tw;
  for (let px = start; px < x - cam + w + tw; px += tw) {
    ctx.drawImage(img, 0, 0, img.width, img.height, px, y, tw, th);
  }
  ctx.restore();
  return true;
}

/** Enemy skin mapping from type → sprite prefix */
function enemySpriteKey(type, state) {
  // state: idle | run | jump | hurt | death
  if (type === 'boss') return 'enemy/yakuzaBoss';
  if (type === 'brute' || type === 'tank') return 'enemy/yakuza3';
  if (type === 'gunner' || type === 'sniper') return 'enemy/yakuza2';
  if (type === 'flyer' || type === 'swarm') return 'enemy/yakuza1';
  if (type === 'hopper' || type === 'zig') {
    return 'enemy/punk/' + (state || 'run');
  }
  // grunt / drone
  return 'enemy/biker/' + (state || 'run');
}

function enemyUsesGrid(type) {
  return type === 'boss' || type === 'brute' || type === 'tank' ||
    type === 'gunner' || type === 'sniper' || type === 'flyer' || type === 'swarm';
}
