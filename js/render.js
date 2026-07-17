'use strict';

function drawBackground(ctx, cam, t) {
  // Neon city night sky
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a0618');
  g.addColorStop(0.45, '#12102e');
  g.addColorStop(1, '#1a0e28');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Stars
  ctx.save();
  for (let i = 0; i < 50; i++) {
    const seed = i * 97;
    const x = ((seed * 37 - cam * 0.08) % (W + 20) + W + 20) % (W + 20) - 10;
    const y = 20 + (seed * 53) % 200;
    ctx.globalAlpha = 0.25 + (i % 5) * 0.1;
    ctx.fillStyle = '#c4e0ff';
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  ctx.restore();

  // Parallax skyline
  ctx.save();
  const layers = [
    { spd: 0.15, col: '#15122e', h: 90 },
    { spd: 0.3, col: '#1c1840', h: 130 },
    { spd: 0.5, col: '#241e52', h: 160 },
  ];
  for (const layer of layers) {
    const baseY = GROUND_Y - layer.h + 20;
    ctx.fillStyle = layer.col;
    for (let i = -1; i < 8; i++) {
      const bw = 36 + ((i * 17) % 40);
      const bh = layer.h * (0.5 + ((i * 13) % 50) / 100);
      const x = ((i * 70 - cam * layer.spd) % (W + 80)) - 40;
      ctx.fillRect(x, GROUND_Y - bh, bw, bh + 4);
      // window lights
      if (layer.spd > 0.2) {
        ctx.fillStyle = i % 3 === 0 ? 'rgba(61,231,255,0.25)' : 'rgba(255,79,216,0.2)';
        for (let wy = 8; wy < bh - 10; wy += 12) {
          for (let wx = 4; wx < bw - 6; wx += 10) {
            if ((wx + wy + i) % 3 !== 0) ctx.fillRect(x + wx, GROUND_Y - bh + wy, 3, 4);
          }
        }
        ctx.fillStyle = layer.col;
      }
    }
  }
  ctx.restore();

  // Far ground strip under playfield
  ctx.fillStyle = '#0d0a1a';
  ctx.fillRect(0, GROUND_Y + 8, W, H - GROUND_Y);

  // Scanline soft
  ctx.save();
  ctx.globalAlpha = 0.025;
  ctx.fillStyle = '#fff';
  for (let y = PLAY.top; y < PLAY.bottom; y += 3) ctx.fillRect(0, y, W, 1);
  ctx.restore();
}

function drawPlatforms(ctx, cam) {
  for (const pl of platforms) {
    const x = pl.x - cam;
    if (x + pl.w < -10 || x > W + 10) continue;
    const y = pl.y;

    if (pl.ground) {
      // Street / ground slab
      const grd = ctx.createLinearGradient(0, y, 0, y + 28);
      grd.addColorStop(0, '#2a2458');
      grd.addColorStop(1, '#141028');
      ctx.fillStyle = grd;
      ctx.fillRect(x, y, pl.w, Math.max(pl.h, 20));
      // neon curb
      ctx.fillStyle = '#3de7ff';
      ctx.globalAlpha = 0.7;
      ctx.fillRect(x, y, pl.w, 3);
      ctx.globalAlpha = 1;
      // dashed road line
      ctx.strokeStyle = 'rgba(255,210,62,0.35)';
      ctx.setLineDash([10, 12]);
      ctx.beginPath();
      ctx.moveTo(x, y + 10);
      ctx.lineTo(x + pl.w, y + 10);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // Floating platform
      ctx.fillStyle = '#1e1848';
      roundRectPath(ctx, x, y, pl.w, pl.h + 4, 4);
      ctx.fill();
      ctx.fillStyle = '#ff4fd8';
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x, y, pl.w, 3);
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#3de7ff';
      ctx.fillRect(x + 2, y + 4, pl.w - 4, 2);
      ctx.globalAlpha = 1;
    }
  }
}

function drawPlayer(ctx, p, t, cam) {
  if (!p) return;
  const sx = p.x - cam;
  const feet = p.y;
  const top = feet - p.h;
  const cx = sx;
  const cy = top + p.h / 2;

  ctx.save();
  const flash = p.inv > 0 && Math.floor(t * 20) % 2 === 0;
  if (flash) ctx.globalAlpha = 0.35;

  ctx.translate(cx, cy);
  ctx.scale(p.facing || 1, 1);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, p.h / 2 - 2, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (run cycle)
  const swing = p.onGround ? Math.sin(p.anim * Math.PI * 2) * 0.45 : 0.55;
  ctx.strokeStyle = '#3de7ff';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  // back leg
  ctx.beginPath();
  ctx.moveTo(-3, 6);
  ctx.lineTo(-6 - swing * 8, 16);
  ctx.stroke();
  // front leg
  ctx.beginPath();
  ctx.moveTo(3, 6);
  ctx.lineTo(6 + swing * 8, 16);
  ctx.stroke();

  // Body
  const bodyG = ctx.createLinearGradient(-10, -12, 10, 12);
  bodyG.addColorStop(0, '#5b7cfa');
  bodyG.addColorStop(1, '#3de7ff');
  ctx.fillStyle = bodyG;
  roundRectPath(ctx, -9, -12, 18, 20, 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Head
  ctx.fillStyle = '#f0d5c0';
  ctx.beginPath();
  ctx.arc(0, -18, 8, 0, Math.PI * 2);
  ctx.fill();
  // Hair / cap
  ctx.fillStyle = '#ff4fd8';
  ctx.beginPath();
  ctx.arc(0, -20, 8, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-8, -22, 16, 5);

  // Eye
  ctx.fillStyle = '#1a1020';
  ctx.beginPath();
  ctx.arc(3, -18, 1.6, 0, Math.PI * 2);
  ctx.fill();

  // Arm + gun
  ctx.strokeStyle = '#f0d5c0';
  ctx.lineWidth = 3;
  const aim = (p.aim || 0) * (p.facing || 1);
  // Aim in local space (facing already scaled)
  let gunAng = p.aim || 0;
  if ((p.facing || 1) < 0) gunAng = Math.PI - gunAng;
  // Simpler: gun always points roughly at aim in world, draw in local with flip
  ctx.save();
  // Un-flip for aim so gun points correctly
  ctx.scale(p.facing || 1, 1);
  const ga = p.aim || 0;
  ctx.rotate(ga);
  // arm
  ctx.strokeStyle = '#f0d5c0';
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(12, -2);
  ctx.stroke();
  // blaster
  ctx.fillStyle = '#e8f4ff';
  ctx.strokeStyle = '#3de7ff';
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, 10, -6, 16, 8, 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#3de7ff';
  ctx.fillRect(24, -3, 6, 3);
  ctx.restore();

  // Magenta jacket stripe
  ctx.fillStyle = '#ff4fd8';
  ctx.fillRect(-9, -4, 18, 3);

  ctx.restore();
}

function drawEnemy(ctx, e, cam) {
  const sx = e.x - cam;
  if (sx < -60 || sx > W + 60) return;
  const cy = e.y - e.h / 2;

  ctx.save();
  ctx.translate(sx, cy);
  if (e.flash > 0) ctx.globalAlpha = 0.55;
  ctx.scale(e.facing || -1, 1);

  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, e.r * 1.8);
  g.addColorStop(0, e.color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.arc(0, 0, e.r * 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = e.flash > 0 ? 0.9 : 1;

  ctx.fillStyle = e.color;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5;

  if (e.type === 'boss') {
    // Big hulking figure
    roundRectPath(ctx, -e.w / 2, -e.h / 2, e.w, e.h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1a0a20';
    ctx.beginPath();
    ctx.arc(4, -e.h * 0.15, 8, 0, Math.PI * 2);
    ctx.fill();
    // horns
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.moveTo(-10, -e.h / 2);
    ctx.lineTo(-16, -e.h / 2 - 14);
    ctx.lineTo(-4, -e.h / 2 + 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(10, -e.h / 2);
    ctx.lineTo(16, -e.h / 2 - 14);
    ctx.lineTo(4, -e.h / 2 + 2);
    ctx.fill();
  } else if (e.type === 'brute' || e.type === 'tank') {
    roundRectPath(ctx, -e.w / 2, -e.h / 2, e.w, e.h, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1a1020';
    ctx.fillRect(-4, -6, 10, 6);
  } else if (e.type === 'flyer' || e.type === 'swarm') {
    // Bat-ish
    ctx.beginPath();
    ctx.ellipse(0, 0, e.w / 2, e.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const flap = Math.sin(e.phase * 10) * 8;
    ctx.beginPath();
    ctx.moveTo(-e.w / 2, 0);
    ctx.quadraticCurveTo(-e.w, -10 - flap, -e.w * 0.7, 8);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(e.w / 2, 0);
    ctx.quadraticCurveTo(e.w, -10 - flap, e.w * 0.7, 8);
    ctx.fill();
  } else if (e.type === 'hopper' || e.type === 'zig') {
    // Round hopper
    ctx.beginPath();
    ctx.ellipse(0, 2, e.w / 2, e.h / 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // ears
    ctx.beginPath();
    ctx.moveTo(-6, -e.h / 3);
    ctx.lineTo(-10, -e.h / 2 - 6);
    ctx.lineTo(-2, -e.h / 3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(6, -e.h / 3);
    ctx.lineTo(10, -e.h / 2 - 6);
    ctx.lineTo(2, -e.h / 3);
    ctx.fill();
  } else {
    // Grunt / gunner humanoid blob
    // legs
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-5, e.h / 4);
    ctx.lineTo(-6, e.h / 2);
    ctx.moveTo(5, e.h / 4);
    ctx.lineTo(6, e.h / 2);
    ctx.stroke();
    roundRectPath(ctx, -e.w / 2 + 2, -e.h / 2 + 4, e.w - 4, e.h * 0.55, 5);
    ctx.fillStyle = e.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // head
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(0, -e.h / 2 + 6, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1020';
    ctx.beginPath();
    ctx.arc(3, -e.h / 2 + 6, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // HP bar
  if (e.type === 'boss' || e.type === 'brute' || e.type === 'tank' || e.hp < e.maxHp * 0.95) {
    ctx.scale(e.facing || -1, 1); // unflip bar
    const bw = e.w;
    const ratio = clamp(e.hp / e.maxHp, 0, 1);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(-bw / 2, -e.h / 2 - 10, bw, 3);
    ctx.fillStyle = ratio > 0.35 ? '#7dffa0' : '#ff6b8a';
    ctx.fillRect(-bw / 2, -e.h / 2 - 10, bw * ratio, 3);
  }

  ctx.restore();
}

function drawBullet(ctx, b, cam) {
  const x = b.x - cam;
  ctx.save();
  ctx.fillStyle = b.color;
  ctx.shadowColor = b.color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.arc(x - b.vx * 0.012, b.y - b.vy * 0.012, b.r * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGem(ctx, g, t, cam) {
  const x = g.x - cam;
  ctx.save();
  ctx.translate(x, g.y);
  ctx.rotate(t * 3);
  ctx.fillStyle = '#b8ff5a';
  ctx.shadowColor = '#b8ff5a';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(0, -g.r);
  ctx.lineTo(g.r * 0.7, 0);
  ctx.lineTo(0, g.r);
  ctx.lineTo(-g.r * 0.7, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPickup(ctx, p, t, cam) {
  const x = p.x - cam;
  ctx.save();
  ctx.translate(x, p.y);
  const pulse = 1 + Math.sin(t * 6) * 0.12;
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#7dffa0';
  ctx.shadowColor = '#7dffa0';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(0, 0, p.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#062014';
  ctx.font = 'bold 12px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowBlur = 0;
  ctx.fillText('+', 0, 1);
  ctx.restore();
}

function drawOrbit(ctx, o, cam) {
  if (o.x == null) return;
  ctx.save();
  ctx.fillStyle = '#ff4fd8';
  ctx.shadowColor = '#ff4fd8';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(o.x - cam, o.y, o.size, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
  ctx.fillStyle = 'rgba(6, 10, 22, 0.72)';
  ctx.fillRect(0, 0, W, PLAY.top - 4);

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
  ctx.fillStyle = '#94a0c2';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('LV ' + (p ? p.level : 1), W - 14, 40);

  if (p) {
    const bx = 14;
    const by = H - 96;
    const bw = W - 28;
    const bh = 10;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(bx, by, bw, bh);
    const ratio = clamp(p.hp / p.maxHp, 0, 1);
    const hg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    hg.addColorStop(0, '#ff4fd8');
    hg.addColorStop(1, '#3de7ff');
    ctx.fillStyle = hg;
    ctx.fillRect(bx, by, bw * ratio, bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);

    const xy = by + 16;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(bx, xy, bw, 6);
    const xr = p.xpNext > 0 ? clamp(p.xp / p.xpNext, 0, 1) : 0;
    ctx.fillStyle = '#b8ff5a';
    ctx.fillRect(bx, xy, bw * xr, 6);
  }
}

function drawControls(ctx, stick) {
  // Move stick (bottom-left)
  const cx = 64;
  const cy = H - 48;
  const br = 36;
  ctx.save();
  ctx.globalAlpha = stick.active ? 0.55 : 0.28;
  ctx.fillStyle = 'rgba(20, 30, 55, 0.85)';
  ctx.strokeStyle = 'rgba(61, 231, 255, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, br, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const kx = cx + stick.dx * (br - 14);
  const ky = cy + clamp(stick.dy, -1, 1) * (br - 14) * 0.35; // mostly horizontal
  ctx.globalAlpha = stick.active ? 0.85 : 0.4;
  ctx.fillStyle = '#3de7ff';
  ctx.beginPath();
  ctx.arc(kx, ky, 13, 0, Math.PI * 2);
  ctx.fill();

  // Jump button (bottom-right)
  const jx = W - 58;
  const jy = H - 52;
  ctx.globalAlpha = stick.jumpDown ? 0.75 : 0.35;
  ctx.fillStyle = 'rgba(255, 79, 216, 0.35)';
  ctx.strokeStyle = 'rgba(255, 79, 216, 0.7)';
  ctx.beginPath();
  ctx.arc(jx, jy, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffc6ef';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.9;
  ctx.fillText('JUMP', jx, jy);
  ctx.restore();
}

function drawLevelUpOverlay(ctx, choices) {
  ctx.save();
  ctx.fillStyle = 'rgba(6, 10, 22, 0.72)';
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
    ctx.fillStyle = 'rgba(12, 18, 40, 0.95)';
    ctx.strokeStyle = 'rgba(61, 231, 255, 0.45)';
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
  // Fake platforms
  platforms = [
    { x: 20, y: GROUND_Y, w: 350, h: 24, ground: true },
    { x: 80, y: GROUND_Y - 90, w: 100, h: 14, ground: false },
    { x: 220, y: GROUND_Y - 150, w: 90, h: 14, ground: false },
  ];
  drawBackground(ctx, t * 30, t);
  drawPlatforms(ctx, 0);

  const hero = {
    x: 100 + Math.sin(t) * 8,
    y: GROUND_Y,
    w: PLAYER.w,
    h: PLAYER.h,
    facing: 1,
    aim: Math.sin(t * 0.7) * 0.3,
    inv: 0,
    onGround: true,
    anim: t * 2,
  };
  drawPlayer(ctx, hero, t, 0);

  const foes = [
    { x: 260, y: GROUND_Y, w: 20, h: 28, r: 12, type: 'grunt', color: '#ff6b8a', hp: 1, maxHp: 1, flash: 0, facing: -1, phase: t },
    { x: 310, y: GROUND_Y - 90, w: 18, h: 22, r: 11, type: 'hopper', color: '#ffd23e', hp: 1, maxHp: 1, flash: 0, facing: -1, phase: t },
    { x: 280, y: GROUND_Y - 160, w: 22, h: 18, r: 10, type: 'flyer', color: '#3de7ff', hp: 1, maxHp: 1, flash: 0, facing: -1, phase: t },
  ];
  for (const f of foes) drawEnemy(ctx, f, 0);

  for (let i = 0; i < 5; i++) {
    const bx = 130 + ((t * 80 + i * 28) % 140);
    const by = GROUND_Y - 22 + Math.sin(t * 3 + i) * 4;
    drawBullet(ctx, { x: bx, y: by, r: 3.5, color: '#7af0ff', vx: 100, vy: 0 }, 0);
  }
}
