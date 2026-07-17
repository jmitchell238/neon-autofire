'use strict';

function drawBackground(ctx, scroll, t) {
  // Deep space gradient
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#060914');
  g.addColorStop(0.5, '#0a1230');
  g.addColorStop(1, '#0b0a1c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Parallax stars
  ctx.save();
  for (let layer = 0; layer < 3; layer++) {
    const spd = 0.15 + layer * 0.25;
    const count = 28 + layer * 18;
    const alpha = 0.25 + layer * 0.2;
    ctx.globalAlpha = alpha;
    for (let i = 0; i < count; i++) {
      const seed = i * 97 + layer * 131;
      const x = ((seed * 37 + scroll * spd * 40) % (W + 20) + W + 20) % (W + 20) - 10;
      const y = PLAY.top + ((seed * 53) % PLAY_H);
      const r = layer === 2 ? 1.4 : 0.8;
      ctx.fillStyle = layer === 2 ? '#c4e0ff' : '#7aa2ff';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Nebula washes
  ctx.save();
  ctx.globalAlpha = 0.08;
  const nx = (scroll * 0.08) % (W + 200);
  ctx.fillStyle = '#3de7ff';
  ctx.beginPath();
  ctx.ellipse(W - (nx % W), PLAY.top + PLAY_H * 0.3, 120, 60, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff4fd8';
  ctx.beginPath();
  ctx.ellipse((nx * 0.7) % W, PLAY.top + PLAY_H * 0.7, 100, 50, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Playfield vignette borders
  ctx.strokeStyle = 'rgba(61, 231, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(PLAY.left + 0.5, PLAY.top + 0.5, PLAY_W - 1, PLAY_H - 1);

  // Subtle scanlines
  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.fillStyle = '#fff';
  for (let y = PLAY.top; y < PLAY.bottom; y += 3) {
    ctx.fillRect(PLAY.left, y, PLAY_W, 1);
  }
  ctx.restore();
}

function drawPlayer(ctx, p, t) {
  if (!p) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.facing);

  const flash = p.inv > 0 && Math.floor(t * 20) % 2 === 0;
  if (flash) ctx.globalAlpha = 0.35;

  // Engine glow
  const eg = ctx.createRadialGradient(-p.r - 4, 0, 0, -p.r - 4, 0, 18);
  eg.addColorStop(0, 'rgba(61, 231, 255, 0.7)');
  eg.addColorStop(1, 'rgba(61, 231, 255, 0)');
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.arc(-p.r - 2, 0, 16, 0, Math.PI * 2);
  ctx.fill();

  // Hull
  ctx.fillStyle = '#e8f4ff';
  ctx.strokeStyle = '#3de7ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.r + 4, 0);
  ctx.lineTo(-p.r * 0.7, p.r * 0.85);
  ctx.lineTo(-p.r * 0.35, 0);
  ctx.lineTo(-p.r * 0.7, -p.r * 0.85);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cockpit
  ctx.fillStyle = '#3de7ff';
  ctx.beginPath();
  ctx.arc(2, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawEnemy(ctx, e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.flash > 0) ctx.globalAlpha = 0.55;

  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, e.r * 1.6);
  g.addColorStop(0, e.color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, e.r * 1.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = e.color;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = e.flash > 0 ? 0.9 : 1;

  if (e.type === 'boss') {
    // Hex-ish boss
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
      const x = Math.cos(a) * e.r;
      const y = Math.sin(a) * e.r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1a0a20';
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'tank') {
    roundRectPath(ctx, -e.r, -e.r * 0.7, e.r * 2, e.r * 1.4, 5);
    ctx.fill();
    ctx.stroke();
  } else if (e.type === 'zig') {
    ctx.beginPath();
    ctx.moveTo(e.r, 0);
    ctx.lineTo(-e.r * 0.6, e.r);
    ctx.lineTo(-e.r * 0.2, 0);
    ctx.lineTo(-e.r * 0.6, -e.r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (e.type === 'swarm') {
    ctx.beginPath();
    ctx.arc(0, 0, e.r, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // drone / sniper diamond
    ctx.beginPath();
    ctx.moveTo(e.r, 0);
    ctx.lineTo(0, e.r * 0.75);
    ctx.lineTo(-e.r, 0);
    ctx.lineTo(0, -e.r * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // HP bar for tanks/bosses
  if (e.type === 'boss' || e.type === 'tank' || e.hp < e.maxHp * 0.95) {
    const bw = e.r * 2;
    const ratio = clamp(e.hp / e.maxHp, 0, 1);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(-bw / 2, -e.r - 8, bw, 3);
    ctx.fillStyle = ratio > 0.35 ? '#7dffa0' : '#ff6b8a';
    ctx.fillRect(-bw / 2, -e.r - 8, bw * ratio, 3);
  }

  ctx.restore();
}

function drawBullet(ctx, b) {
  ctx.save();
  ctx.fillStyle = b.color;
  ctx.shadowColor = b.color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fill();
  // trail
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.arc(b.x - b.vx * 0.012, b.y - b.vy * 0.012, b.r * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGem(ctx, g, t) {
  ctx.save();
  ctx.translate(g.x, g.y);
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

function drawPickup(ctx, p, t) {
  ctx.save();
  ctx.translate(p.x, p.y);
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

function drawOrbit(ctx, o) {
  if (o.x == null) return;
  ctx.save();
  ctx.fillStyle = '#ff4fd8';
  ctx.shadowColor = '#ff4fd8';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(o.x, o.y, o.size, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles(ctx) {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx, p, sc, best, wv) {
  // Top bar
  ctx.fillStyle = 'rgba(6, 10, 22, 0.72)';
  ctx.fillRect(0, 0, W, PLAY.top - 4);

  // Score
  ctx.fillStyle = '#eef2ff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(Math.floor(sc).toLocaleString(), 14, 22);

  ctx.fillStyle = '#94a0c2';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('BEST ' + Math.floor(best).toLocaleString(), 14, 40);

  // Wave
  ctx.textAlign = 'right';
  ctx.fillStyle = '#3de7ff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('WAVE ' + wv, W - 14, 22);
  ctx.fillStyle = '#94a0c2';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('LV ' + (p ? p.level : 1), W - 14, 40);

  // HP bar
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

    // XP bar
    const xy = by + 16;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(bx, xy, bw, 6);
    const xr = p.xpNext > 0 ? clamp(p.xp / p.xpNext, 0, 1) : 0;
    ctx.fillStyle = '#b8ff5a';
    ctx.fillRect(bx, xy, bw * xr, 6);
  }
}

function drawJoystick(ctx, stick) {
  // Virtual stick base (bottom-left)
  const cx = 72;
  const cy = H - 52;
  const br = 38;
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
  const ky = cy + stick.dy * (br - 14);
  ctx.globalAlpha = stick.active ? 0.85 : 0.4;
  ctx.fillStyle = '#3de7ff';
  ctx.beginPath();
  ctx.arc(kx, ky, 14, 0, Math.PI * 2);
  ctx.fill();
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
    // card
    ctx.fillStyle = 'rgba(12, 18, 40, 0.95)';
    ctx.strokeStyle = 'rgba(61, 231, 255, 0.45)';
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, 24, y, cardW, cardH, 14);
    ctx.fill();
    ctx.stroke();

    // icon bubble
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

    // number hint
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
  // Map client coords → stage
  const scale = rect.width / W;
  const y = (clientY - rect.top) / scale;
  const cardW = W - 48;
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
  // Menu backdrop ships / enemies floating
  const cx = W * 0.35;
  const cy = H * 0.55;
  drawPlayer(ctx, {
    x: cx + Math.sin(t * 0.8) * 10,
    y: cy + Math.cos(t * 0.6) * 14,
    r: PLAYER.r,
    facing: Math.sin(t * 0.5) * 0.2,
    inv: 0,
  }, t);

  const foes = [
    { x: W * 0.72, y: H * 0.42, type: 'drone', r: 12, color: '#ff6b8a', hp: 1, maxHp: 1, flash: 0 },
    { x: W * 0.78, y: H * 0.58, type: 'zig', r: 11, color: '#ffd23e', hp: 1, maxHp: 1, flash: 0 },
    { x: W * 0.65, y: H * 0.68, type: 'swarm', r: 8, color: '#7dffa0', hp: 1, maxHp: 1, flash: 0 },
  ];
  for (let i = 0; i < foes.length; i++) {
    const f = foes[i];
    f.x += Math.sin(t + i) * 0.3;
    f.y += Math.cos(t * 1.2 + i) * 0.2;
    drawEnemy(ctx, f);
  }

  // Fake bullets
  for (let i = 0; i < 5; i++) {
    const bx = cx + 30 + ((t * 80 + i * 28) % 160);
    const by = cy + Math.sin(t * 3 + i) * 6;
    drawBullet(ctx, { x: bx, y: by, r: 3.5, color: '#7af0ff', vx: 100, vy: 0 });
  }
}
