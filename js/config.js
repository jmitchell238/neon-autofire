'use strict';
// Neon Autofire — tuning knobs (character platformer + auto-shooter)

// ---- Version (MAJOR.MINOR.PATCH) --------------------------------------------
// Keep CACHE in sw.js in sync: 'neon-autofire-' + GAME_VERSION
const GAME_VERSION = '1.3.002';
const GAME_VERSION_LABEL = 'v' + GAME_VERSION;
const GAME_NAME = 'Neon Autofire';

// Logical stage size (letterboxed) — portrait, mobile-first
const W = 390;
const H = 700;

// Play field (inside HUD chrome)
const PLAY = {
  left: 8,
  right: W - 8,
  top: 56,
  bottom: H - 110,
};
const PLAY_W = PLAY.right - PLAY.left;
const PLAY_H = PLAY.bottom - PLAY.top;

// World ground line (screen Y of solid floor top)
const GROUND_Y = PLAY.bottom - 18;

// Player — humanoid platformer (matches ~48px sprite @ 2.1×)
const PLAYER = {
  w: 26,
  h: 42,
  runSpeed: 220,
  maxHp: 100,
  invuln: 0.7,
  magnet: 80,
  gravity: 1550,
  jumpVel: -560,     // ~101px max height at base
  maxFall: 780,
  coyote: 0.12,      // seconds after leaving ledge
  jumpBuffer: 0.14,  // early jump press window
  airControl: 0.9,
};

// ---- Jump envelope (single jump only — used by level gen + tests) -----------
// Peak height: v² / (2g). Air time (same height): 2v/g. Horiz ≈ runSpeed * airTime.
function maxJumpHeight(jumpMul) {
  const v = Math.abs(PLAYER.jumpVel) * (jumpMul || 1);
  return (v * v) / (2 * PLAYER.gravity);
}
function maxJumpAirTime(jumpMul) {
  const v = Math.abs(PLAYER.jumpVel) * (jumpMul || 1);
  return (2 * v) / PLAYER.gravity;
}
function maxJumpDistance(jumpMul, speedMul) {
  return PLAYER.runSpeed * (speedMul || 1) * maxJumpAirTime(jumpMul);
}

// Safety margins for procedural platforms (no double-jump)
const JUMP_SAFE = {
  // Max rise (smaller Y) between consecutive platforms — fraction of peak height
  riseFrac: 0.62,
  // Max horizontal gap (edge → edge) when landing roughly same height
  gapFracSame: 0.62,
  // Tighter gap when climbing
  gapFracUp: 0.48,
  // Wider when dropping down
  gapFracDown: 0.78,
  // How far down is always ok (falling)
  maxDrop: 140,
  minGap: 18,
  minWidth: 96,
  maxWidth: 170,
};

// Camera: keep hero roughly here on screen
const CAM = {
  focusX: W * 0.32,
  lerp: 6,
};

// Combat
const MAX_BULLETS = 180;
const MAX_ENEMIES = 80;
const MAX_GEMS = 120;
const MAX_PARTICLES = 200;
const MAX_PICKUPS = 12;
const MAX_PLATFORMS = 48;

// XP curve
function xpForLevel(level) {
  return Math.floor(12 + level * 8 + level * level * 1.4);
}

// Enemy archetypes — ground/air creatures (not ships)
// fly: true = no gravity, free height; else walks on ground/platforms
const ENEMIES = {
  grunt:  { w: 24, h: 40, hp: 22,  speed: 55,  score: 10, xp: 2,  color: '#ff6b8a', damage: 12, fly: false },
  hopper: { w: 22, h: 38, hp: 16,  speed: 70,  score: 14, xp: 3,  color: '#ffd23e', damage: 10, fly: false, hop: true },
  brute:  { w: 36, h: 48, hp: 90,  speed: 32,  score: 35, xp: 6,  color: '#a78bfa', damage: 22, fly: false },
  flyer:  { w: 28, h: 36, hp: 20,  speed: 75,  score: 16, xp: 3,  color: '#3de7ff', damage: 12, fly: true },
  gunner: { w: 26, h: 42, hp: 32,  speed: 40,  score: 24, xp: 4,  color: '#7dffa0', damage: 14, fly: false, shoots: true },
  boss:   { w: 56, h: 64, hp: 520, speed: 28,  score: 400, xp: 40, color: '#ff4fd8', damage: 28, fly: false, shoots: true },
};

// Back-compat aliases used by older tests / spawn names
ENEMIES.drone = ENEMIES.grunt;
ENEMIES.zig = ENEMIES.hopper;
ENEMIES.tank = ENEMIES.brute;
ENEMIES.sniper = ENEMIES.gunner;
ENEMIES.swarm = ENEMIES.flyer;

// Level-up upgrades
const UPGRADES = [
  { id: 'dmg',    name: 'Hot Muzzle',    desc: '+20% bullet damage',    icon: '⚔', stack: true },
  { id: 'rate',   name: 'Rapid Fire',    desc: '+18% fire rate',        icon: '⚡', stack: true },
  { id: 'spread', name: 'Scattershot',   desc: '+1 projectile arc',     icon: '✦', stack: true, max: 5 },
  { id: 'speed',  name: 'Sprint Boots',  desc: '+12% run speed',        icon: '➤', stack: true },
  { id: 'hp',     name: 'Body Armor',    desc: '+25 max HP & heal 25',  icon: '♥', stack: true },
  { id: 'magnet', name: 'Loot Magnet',   desc: '+30% gem pull range',   icon: '◎', stack: true },
  { id: 'multi',  name: 'Twin Guns',     desc: 'Extra parallel barrel', icon: 'Ⅱ', stack: true, max: 3 },
  { id: 'pierce', name: 'Armor Piercer', desc: 'Bullets pierce +1',     icon: '⇀', stack: true, max: 4 },
  { id: 'orbit',  name: 'Orbit Drones',  desc: 'Orbiting plasma orbs',  icon: '◉', stack: true, max: 4 },
  { id: 'jump',   name: 'Spring Legs',   desc: '+12% jump height',      icon: '⇧', stack: true, max: 4 },
  { id: 'heal',   name: 'Medkit',        desc: 'Restore 40 HP',         icon: '+', stack: false },
];

// Wave spawn pacing
const WAVE = {
  baseInterval: 1.4,
  minInterval: 0.4,
  ramp: 0.04,
  baseCount: 3,
  countRamp: 0.55,
  bossEvery: 5,
};
