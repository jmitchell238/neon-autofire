'use strict';

function drawBackground(ctx, cam, t) {
  // Night gradient base
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#07041a');
  g.addColorStop(0.55, '#120a2a');
  g.addColorStop(1, '#1a0c22');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Stars
  ctx.save();
  for (let i = 0; i < 40; i++) {
    const seed = i * 97;
    const x = ((seed * 37 - cam * 0.05) % (W + 20) + W + 20) % (W + 20) - 10;
    const y = 16 + (seed * 53) % 180;
    ctx.globalAlpha = 0.2 + (i % 5) * 0.12;
    ctx.fillStyle = '#d0e8ff';
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  ctx.restore();

  // Pixel city parallax (Cyber City CC0)
  const city = getSprite('bg/city') || getSprite('bg/city1x');
  if (city && city.ready) {
    const img = city.img;
    const scale = (GROUND_Y - PLAY.top - 20) / img.height;
    const cw = img.width * scale;
    const ch = img.height * scale;
    const y = GROUND_Y - ch + 8;
    const scroll = (cam * 0.35) % cw;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 0.85;
    for (let x = -scroll - cw; x < W + cw; x += cw) {
      ctx.drawImage(img, x, y, cw, ch);
    }
    // Darker near layer
    ctx.globalAlpha = 0.35;
    const scroll2 = (cam * 0.55) % cw;
    for (let x = -scroll2 - cw; x < W + cw; x += cw) {
      ctx.drawImage(img, x, y + 20, cw * 1.1, ch * 0.9);
    }
    ctx.restore();
  } else {
    // Fallback skyline
    ctx.fillStyle = '#1a1440';
    for (let i = -1; i < 10; i++) {
      const bw = 30 + (i * 17) % 40;
      const bh = 80 + (i * 23) % 100;
      const x = ((i * 55 - cam * 0.3) % (W + 80)) - 40;
      ctx.fillRect(x, GROUND_Y - bh, bw, bh);
    }
  }

  // Neon haze
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#3de7ff';
  ctx.fillRect(0, GROUND_Y - 40, W, 40);
  ctx.fillStyle = '#ff4fd8';
  ctx.fillRect(0, GROUND_Y - 12, W, 12);
  ctx.restore();

  // Below-ground fill
  ctx.fillStyle = '#0a0614';
  ctx.fillRect(0, GROUND_Y + 2, W, H - GROUND_Y);
}

function drawPlatforms(ctx, cam) {
  for (const pl of platforms) {
    const x = pl.x - cam;
    if (x + pl.w < -20 || x > W + 20) continue;
    const y = pl.y;

    if (pl.ground) {
      // Tiled sci-fi ground
      const th = Math.max(pl.h, 28);
      let drew = false;
      const tile = getSprite('tile/1');
      if (tile && tile.ready) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        const tw = 48;
        for (let px = 0; px < pl.w; px += tw) {
          const w = Math.min(tw, pl.w - px);
          ctx.drawImage(tile.img, 0, 0, tile.img.width * (w / tw), tile.img.height * 0.35,
            x + px, y, w, th);
        }
        ctx.restore();
        drew = true;
      }
      if (!drew) {
        ctx.fillStyle = '#2a2458';
        ctx.fillRect(x, y, pl.w, th);
      }
      // Neon curb
      ctx.fillStyle = '#3de7ff';
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x, y, pl.w, 3);
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#ff4fd8';
      ctx.fillRect(x, y + 3, pl.w, 2);
      ctx.globalAlpha = 1;
      // Road dashes
      ctx.fillStyle = 'rgba(255,210,62,0.4)';
      for (let dx = 8; dx < pl.w; dx += 22) {
        ctx.fillRect(x + dx, y + 12, 12, 2);
      }
    } else {
      // Floating platform
      const tile = getSprite('tile/2') || getSprite('tile/3') || getSprite('tile/1');
      if (tile && tile.ready) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tile.img, x, y - 2, pl.w, pl.h + 10);
        ctx.restore();
      } else {
        ctx.fillStyle = '#1e1848';
        roundRectPath(ctx, x, y, pl.w, pl.h + 6, 4);
        ctx.fill();
      }
      ctx.fillStyle = '#ff4fd8';
      ctx.globalAlpha = 0.9;
      ctx.fillRect(x, y, pl.w, 3);
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#3de7ff';
      ctx.fillRect(x + 2, y + 4, pl.w - 4, 2);
      ctx.globalAlpha = 1;
    }
  }
}

function playerAnimKey(p) {
  if (p.hp <= 0) return 'player/death';
  if (p.inv > 0.45) return 'player/hurt';
  if (!p.onGround) {
    if (p.vy < -40) return 'player/jump';
    return 'player/jump';
  }
  if (Math.abs(p.vx) > 30) return 'player/runAttack'; // always shooting while moving
  return 'player/idle';
}

function drawPlayer(ctx, p, t, cam) {
  if (!p) return;
  const key = playerAnimKey(p);
  const entry = getSprite(key) || getSprite('player/idle');
  const flash = p.inv > 0 && Math.floor(t * 20) % 2 === 0;
  const scale = 2.1;
  let frame = 0;
  if (entry && entry.meta) {
    if (key === 'player/jump') {
      // Map jump frames by vertical velocity
      if (p.vy < -200) frame = 0;
      else if (p.vy < 0) frame = 1;
      else if (p.vy < 200) frame = 2;
      else frame = 3;
    } else if (key === 'player/hurt') {
      frame = 0;
    } else if (key === 'player/death') {
      frame = Math.min(5, Math.floor((p._deathT || 0) * 8));
    } else {
      frame = animFrame(entry.meta, p.anim || t, 1);
    }
  }

  // Soft shadow
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(p.x - cam, p.y - 2, 14, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const ok = drawSprite(ctx, key, frame, p.x, p.y + 2, {
    scale,
    flip: (p.facing || 1) < 0,
    cam,
    alpha: flash ? 0.4 : 1,
  });

  if (!ok) {
    // Fallback stick figure
    ctx.save();
    ctx.translate(p.x - cam, p.y - p.h / 2);
    ctx.fillStyle = '#3de7ff';
    ctx.fillRect(-8, -14, 16, 22);
    ctx.fillStyle = '#f0d5c0';
    ctx.beginPath();
    ctx.arc(0, -18, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Muzzle flash when firing (cosmetic)
  if (p.onGround || true) {
    const aim = p.aim || 0;
    const mx = p.x + Math.cos(aim) * 28;
    const my = p.y - p.h * 0.55 + Math.sin(aim) * 18;
    if (Math.floor(t * 20) % 3 === 0) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#7af0ff';
      ctx.beginPath();
      ctx.arc(mx - cam, my, 3 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function enemyAnimState(e) {
  if (e.flash > 0.05) return 'hurt';
  if (!e.onGround && !e.fly) return 'jump';
  if (Math.abs(e.vx) > 10 || e.fly) return 'run';
  return 'idle';
}

function drawEnemy(ctx, e, cam, t) {
  const sx = e.x - cam;
  if (sx < -80 || sx > W + 80) return;

  const state = enemyAnimState(e);
  const key = enemySpriteKey(e.type, state);
  const grid = enemyUsesGrid(e.type);
  const scale = e.type === 'boss' ? 2.4 : grid ? 1.7 : 2.0;
  const entry = getSprite(key) || getSprite(enemySpriteKey(e.type, 'run')) || getSprite(enemySpriteKey(e.type, 'idle'));

  let frame = 0;
  if (entry && entry.meta) {
    frame = animFrame(entry.meta, (e.phase || t), e.type === 'boss' ? 0.8 : 1);
  }

  // Shadow
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(sx, e.y - 1, e.w * 0.45, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const alpha = e.flash > 0 ? 0.55 : 1;
  const flip = (e.facing || -1) > 0; // sheets face left-ish for yakuza; craftpix face right
  // CraftPix characters face RIGHT by default; flip when facing left
  const craftFlip = !grid && (e.facing || -1) < 0;
  const yakuzaFlip = grid && (e.facing || -1) > 0;

  const ok = drawSprite(ctx, key, frame, e.x, e.y + 2, {
    scale,
    flip: grid ? yakuzaFlip : craftFlip,
    cam,
    alpha,
  });

  if (!ok) {
    ctx.save();
    ctx.translate(sx, e.y - e.h / 2);
    ctx.fillStyle = e.color || '#ff6b8a';
    ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h);
    ctx.restore();
  }

  // HP bar
  if (e.type === 'boss' || e.type === 'brute' || e.type === 'tank' || e.hp < e.maxHp * 0.95) {
    const bw = Math.max(e.w, 28);
    const ratio = clamp(e.hp / e.maxHp, 0, 1);
    const bx = sx - bw / 2;
    const by = e.y - e.h * (scale / 2) - 12;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bx, by, bw, 4);
    ctx.fillStyle = ratio > 0.35 ? '#7dffa0' : '#ff6b8a';
    ctx.fillRect(bx, by, bw * ratio, 4);
  }
}

function drawBullet(ctx, b, cam) {
  const x = b.x - cam;
  const ok = drawImageKey(ctx, 'fx/bullet', x - 6, b.y - 6, 12, 12);
  if (!ok) {
    ctx.save();
    ctx.fillStyle = b.color || '#7af0ff';
    ctx.shadowColor = b.color || '#7af0ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    // glow trail
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#7af0ff';
    ctx.beginPath();
    ctx.arc(x - b.vx * 0.01, b.y - b.vy * 0.01, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawGem(ctx, g, t, cam) {
  const x = g.x - cam;
  const bob = Math.sin(t * 6 + g.x) * 2;
  ctx.save();
  ctx.translate(x, g.y + bob);
  ctx.rotate(t * 2);
  if (!drawImageKey(ctx, 'fx/gem', -10, -10, 20, 20)) {
    ctx.fillStyle = '#b8ff5a';
    ctx.shadowColor = '#b8ff5a';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(5, 0);
    ctx.lineTo(0, 6);
    ctx.lineTo(-5, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawPickup(ctx, p, t, cam) {
  const x = p.x - cam;
  const pulse = 1 + Math.sin(t * 6) * 0.1;
  ctx.save();
  ctx.translate(x, p.y);
  ctx.scale(pulse, pulse);
  if (!drawImageKey(ctx, 'fx/heal', -12, -12, 24, 24)) {
    ctx.fillStyle = '#7dffa0';
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawOrbit(ctx, o, cam) {
  if (o.x == null) return;
  if (!drawImageKey(ctx, 'fx/orbit', o.x - cam - 9, o.y - 9, 18, 18)) {
    ctx.save();
    ctx.fillStyle = '#ff4fd8';
    ctx.shadowColor = '#ff4fd8';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(o.x - cam, o.y, o.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawParticles(ctx, cam) {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x - cam, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx, p, sc, best, wv) {
  // Glass top bar
  ctx.fillStyle = 'rgba(6, 8, 20, 0.78)';
  ctx.fillRect(0, 0, W, PLAY.top - 2);
  ctx.fillStyle = 'rgba(61, 231, 255, 0.15)';
  ctx.fillRect(0, PLAY.top - 3, W, 2);

  ctx.fillStyle = '#eef2ff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(Math.floor(sc).toLocaleString(), 14, 22);

  ctx.fillStyle = '#94a0c2';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('BEST ' + Math.floor(best).toLocaleString(), 14, 40);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#3de7ff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('WAVE ' + wv, W - 14, 22);
  ctx.fillStyle = '#ff4fd8';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('LV ' + (p ? p.level : 1), W - 14, 40);

  if (p) {
    const bx = 14;
    const by = H - 96;
    const bw = W - 28;
    const bh = 11;
    // HP
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRectPath(ctx, bx, by, bw, bh, 4);
    ctx.fill();
    const ratio = clamp(p.hp / p.maxHp, 0, 1);
    const hg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    hg.addColorStop(0, '#ff4fd8');
    hg.addColorStop(1, '#3de7ff');
    ctx.fillStyle = hg;
    if (ratio > 0.01) {
      ctx.save();
      ctx.beginPath();
      roundRectPath(ctx, bx, by, bw * ratio, bh, 4);
      ctx.clip();
      ctx.fillRect(bx, by, bw * ratio, bh);
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    roundRectPath(ctx, bx + 0.5, by + 0.5, bw - 1, bh - 1, 4);
    ctx.stroke();

    // XP
    const xy = by + 16;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRectPath(ctx, bx, xy, bw, 7, 3);
    ctx.fill();
    const xr = p.xpNext > 0 ? clamp(p.xp / p.xpNext, 0, 1) : 0;
    ctx.fillStyle = '#b8ff5a';
    if (xr > 0.01) {
      ctx.save();
      roundRectPath(ctx, bx, xy, bw * xr, 7, 3);
      ctx.clip();
      ctx.fillRect(bx, xy, bw * xr, 7);
      ctx.restore();
    }
  }
}

function drawControls(ctx, stick) {
  const cx = 64;
  const cy = H - 48;
  const br = 36;
  ctx.save();
  ctx.globalAlpha = stick.active ? 0.6 : 0.32;
  ctx.fillStyle = 'rgba(12, 16, 36, 0.9)';
  ctx.strokeStyle = 'rgba(61, 231, 255, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, br, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const kx = cx + stick.dx * (br - 14);
  const ky = cy + clamp(stick.dy, -1, 1) * (br - 14) * 0.3;
  ctx.globalAlpha = stick.active ? 0.9 : 0.45;
  ctx.fillStyle = '#3de7ff';
  ctx.beginPath();
  ctx.arc(kx, ky, 13, 0, Math.PI * 2);
  ctx.fill();

  // Jump
  const jx = W - 58;
  const jy = H - 52;
  ctx.globalAlpha = stick.jumpDown ? 0.8 : 0.38;
  ctx.fillStyle = 'rgba(40, 12, 36, 0.9)';
  ctx.strokeStyle = 'rgba(255, 79, 216, 0.75)';
  ctx.beginPath();
  ctx.arc(jx, jy, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffc6ef';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.95;
  ctx.fillText('JUMP', jx, jy);
  ctx.restore();
}

function drawLevelUpOverlay(ctx, choices) {
  ctx.save();
  ctx.fillStyle = 'rgba(6, 8, 18, 0.78)';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#eef2ff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LEVEL UP!', W / 2, 120);
  ctx.fillStyle = '#94a0c2';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('Pick an upgrade', W / 2, 148);

  const cardW = W - 48;
  const cardH = 72;
  const startY = 190;
  const gap = 14;

  for (let i = 0; i < choices.length; i++) {
    const u = choices[i];
    const y = startY + i * (cardH + gap);
    ctx.fillStyle = 'rgba(14, 18, 42, 0.96)';
    ctx.strokeStyle = 'rgba(61, 231, 255, 0.5)';
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, 24, y, cardW, cardH, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(61, 231, 255, 0.15)';
    ctx.beginPath();
    ctx.arc(54, y + cardH / 2, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3de7ff';
    ctx.font = '18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(u.icon || '★', 54, y + cardH / 2 + 1);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#eef2ff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(u.name, 82, y + 28);
    ctx.fillStyle = '#94a0c2';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(u.desc, 82, y + 48);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(String(i + 1), W - 40, y + cardH / 2 + 1);
  }
  ctx.restore();
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function levelUpHitTest(clientY, rect, choices) {
  const scale = rect.width / W;
  const y = (clientY - rect.top) / scale;
  const cardH = 72;
  const startY = 190;
  const gap = 14;
  for (let i = 0; i < choices.length; i++) {
    const cy = startY + i * (cardH + gap);
    if (y >= cy && y <= cy + cardH) return i;
  }
  return -1;
}

function drawIdleDecor(ctx, t) {
  // Temporary platform list for menu preview (does not affect run state after startGame)
  const saved = platforms;
  platforms = [
    { x: 0, y: GROUND_Y, w: 400, h: 28, ground: true },
    { x: 70, y: GROUND_Y - 95, w: 110, h: 14, ground: false },
    { x: 210, y: GROUND_Y - 155, w: 100, h: 14, ground: false },
  ];
  drawBackground(ctx, t * 40, t);
  drawPlatforms(ctx, 0);
  platforms = saved;

  const hero = {
    x: 110 + Math.sin(t) * 6,
    y: GROUND_Y,
    w: PLAYER.w,
    h: PLAYER.h,
    facing: 1,
    aim: Math.sin(t * 0.7) * 0.25,
    inv: 0,
    onGround: true,
    anim: t * 2,
    vx: 40,
    vy: 0,
    hp: 100,
  };
  drawPlayer(ctx, hero, t, 0);

  const foes = [
    { x: 250, y: GROUND_Y, w: 22, h: 34, r: 14, type: 'grunt', color: '#ff6b8a', hp: 1, maxHp: 1, flash: 0, facing: -1, phase: t, vx: -30, onGround: true },
    { x: 300, y: GROUND_Y - 95, w: 20, h: 32, r: 12, type: 'hopper', color: '#ffd23e', hp: 1, maxHp: 1, flash: 0, facing: -1, phase: t + 1, vx: 0, onGround: true },
    { x: 270, y: GROUND_Y - 170, w: 24, h: 28, r: 12, type: 'flyer', color: '#3de7ff', hp: 1, maxHp: 1, flash: 0, facing: -1, phase: t + 2, vx: -20, onGround: false, fly: true },
  ];
  for (const f of foes) drawEnemy(ctx, f, 0, t);

  for (let i = 0; i < 5; i++) {
    const bx = 140 + ((t * 90 + i * 28) % 150);
    const by = GROUND_Y - 28 + Math.sin(t * 3 + i) * 3;
    drawBullet(ctx, { x: bx, y: by, r: 4, color: '#7af0ff', vx: 120, vy: 0 }, 0);
  }
}

function drawLoading(ctx, progress) {
  ctx.fillStyle = '#060914';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#eef2ff';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Loading neon city…', W / 2, H / 2 - 20);
  const bw = 200;
  const bx = (W - bw) / 2;
  const by = H / 2 + 10;
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(bx, by, bw, 8);
  ctx.fillStyle = '#3de7ff';
  ctx.fillRect(bx, by, bw * clamp(progress, 0, 1), 8);
}
