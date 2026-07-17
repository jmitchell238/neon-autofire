'use strict';

let audioCtx = null;

function ensureAudio() {
  if (save.muted) return null;
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function beep({ freq = 440, dur = 0.08, type = 'sine', gain = 0.04, slide = 0 } = {}) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function sfxShoot() {
  beep({ freq: 680, dur: 0.04, type: 'square', gain: 0.018, slide: -180 });
}

function sfxHit() {
  beep({ freq: 240, dur: 0.05, type: 'triangle', gain: 0.03, slide: -40 });
}

function sfxExplode(big) {
  beep({ freq: big ? 120 : 180, dur: big ? 0.28 : 0.12, type: 'sawtooth', gain: big ? 0.045 : 0.03, slide: -80 });
  if (big) setTimeout(() => beep({ freq: 90, dur: 0.2, type: 'triangle', gain: 0.03, slide: -30 }), 60);
}

function sfxPickup() {
  beep({ freq: 520, dur: 0.06, type: 'sine', gain: 0.035, slide: 200 });
}

function sfxLevelUp() {
  beep({ freq: 400, dur: 0.08, type: 'sine', gain: 0.04, slide: 120 });
  setTimeout(() => beep({ freq: 560, dur: 0.09, type: 'sine', gain: 0.04, slide: 100 }), 70);
  setTimeout(() => beep({ freq: 720, dur: 0.12, type: 'triangle', gain: 0.035 }), 150);
}

function sfxHurt() {
  beep({ freq: 160, dur: 0.14, type: 'sawtooth', gain: 0.04, slide: -60 });
}

function sfxGameOver() {
  beep({ freq: 280, dur: 0.18, type: 'sawtooth', gain: 0.035, slide: -100 });
  setTimeout(() => beep({ freq: 160, dur: 0.28, type: 'triangle', gain: 0.04, slide: -50 }), 120);
}

function sfxClick() {
  beep({ freq: 520, dur: 0.04, type: 'square', gain: 0.02 });
}

function sfxUpgrade() {
  beep({ freq: 480, dur: 0.07, type: 'sine', gain: 0.04, slide: 160 });
  setTimeout(() => beep({ freq: 720, dur: 0.1, type: 'triangle', gain: 0.03 }), 50);
}
