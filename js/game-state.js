'use strict';

// Mutable state for one run. Domain behavior lives in the focused modules;
// this file only owns lifecycle and the collections shared by those systems.
let state = 'menu'; // menu | play | levelup | over
let score = 0;
let kills = 0;
let wave = 1;
let waveTimer = 0;
let spawnQueue = 0;
let scrollX = 0;
let cameraX = 0;
let time = 0;
let shake = 0;
let overReason = '';
let worldGenX = 0;

let player = null;
let stats = null;
let playerWeapon = null;

let platforms = [];
let bullets = [];
let enemies = [];
let gems = [];
let particles = [];
let pickups = [];
let eBullets = [];
let orbits = [];
let levelChoices = [];

let eFireCd = 0;
let jumpBuffered = 0;
let jumpHeld = false;

function defaultStats() {
  return {
    damage: 12,
    fireRate: 4.2,
    spread: 0,
    multi: 0,
    pierce: 0,
    speedMul: 1,
    magnetMul: 1,
    jumpMul: 1,
    orbit: 0,
    bulletSpeed: 420,
    bulletR: 4,
  };
}

function resetRun() {
  score = 0;
  kills = 0;
  wave = 1;
  waveTimer = 0.6;
  spawnQueue = 0;
  scrollX = 0;
  cameraX = 0;
  time = 0;
  shake = 0;
  overReason = '';
  worldGenX = 0;
  platforms = [];
  bullets = [];
  enemies = [];
  gems = [];
  particles = [];
  pickups = [];
  eBullets = [];
  orbits = [];
  levelChoices = [];
  eFireCd = 0;
  jumpBuffered = 0;
  jumpHeld = false;
  stats = defaultStats();
  player = makePlayer();
  playerWeapon = new PlayerWeaponSystem();
  rebuildOrbits();
  seedPlatforms();
}

function startGame() {
  resetRun();
  state = 'play';
}

function endGame(reason) {
  if (state === 'over') return;
  state = 'over';
  overReason = reason || 'Knocked out!';
  sfxGameOver();
  recordGameEnd(score, wave, kills);
  const cx = playerCx(player);
  const cy = playerCy(player);
  burst(cx, cy, '#3de7ff', 28, 180);
  burst(cx, cy, '#ff4fd8', 18, 140);
}
