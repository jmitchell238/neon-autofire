'use strict';

function burst(x, y, color, n, speed) {
  for (let i = 0; i < n && particles.length < MAX_PARTICLES; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = rand(speed * 0.25, speed);
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: rand(0.25, 0.7),
      max: 0.7,
      r: rand(1.5, 3.5),
      color,
    });
  }
}

function spark(x, y, color) {
  if (particles.length >= MAX_PARTICLES) return;
  const a = Math.random() * Math.PI * 2;
  const s = rand(40, 120);
  particles.push({
    x, y,
    vx: Math.cos(a) * s,
    vy: Math.sin(a) * s,
    life: rand(0.12, 0.3),
    max: 0.3,
    r: rand(1, 2.2),
    color,
  });
}
