'use strict';

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.hypot(dx, dy);
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function randInt(a, b) {
  return Math.floor(rand(a, b + 1));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

function circleHit(ax, ay, ar, bx, by, br) {
  const r = ar + br;
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy <= r * r;
}

/** Letterbox canvas into the viewport; returns { ctx, scale, ox, oy }. */
function resizeCanvas(cv) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scale = Math.min(vw / W, vh / H);
  const cssW = Math.floor(W * scale);
  const cssH = Math.floor(H * scale);

  cv.style.width = cssW + 'px';
  cv.style.height = cssH + 'px';
  cv.width = Math.floor(W * dpr);
  cv.height = Math.floor(H * dpr);

  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;

  return { ctx, scale, dpr };
}
