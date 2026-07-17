'use strict';
// Neon Autofire — tuning knobs

// ---- Version (MAJOR.MINOR.PATCH) --------------------------------------------
// Shown in the UI as "Neon Autofire vMAJOR.MINOR.PPP" (patch zero-padded to 3 digits).
// Keep CACHE in sw.js in sync: 'neon-autofire-' + GAME_VERSION
const GAME_VERSION = '1.0.000';
const GAME_VERSION_LABEL = 'v' + GAME_VERSION;
const GAME_NAME = 'Neon Autofire';

// Logical stage size (letterboxed to fit screen) — portrait, mobile-first
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

// Player
const PLAYER = {
  r: 16,
  speed: 220,
  maxHp: 100,
  invuln: 0.55,
  magnet: 70,
};

// Combat
const MAX_BULLETS = 180;
const MAX_ENEMIES = 80;
const MAX_GEMS = 120;
const MAX_PARTICLES = 200;
const MAX_PICKUPS = 12;

// XP curve: xp needed for next level
function xpForLevel(level) {
  return Math.floor(12 + level * 8 + level * level * 1.4);
}

// Enemy archetypes
const ENEMIES = {
  drone:  { r: 12, hp: 18,  speed: 70,  score: 10, xp: 2,  color: '#ff6b8a', damage: 12 },
  zig:    { r: 11, hp: 14,  speed: 95,  score: 14, xp: 3,  color: '#ffd23e', damage: 10 },
  tank:   { r: 20, hp: 80,  speed: 40,  score: 35, xp: 6,  color: '#a78bfa', damage: 20 },
  sniper: { r: 13, hp: 28,  speed: 55,  score: 22, xp: 4,  color: '#3de7ff', damage: 14, shoots: true },
  swarm:  { r: 8,  hp: 8,   speed: 120, score: 6,  xp: 1,  color: '#7dffa0', damage: 8  },
  boss:   { r: 36, hp: 500, speed: 35,  score: 400, xp: 40, color: '#ff4fd8', damage: 28, shoots: true },
};

// Level-up upgrade definitions
const UPGRADES = [
  { id: 'dmg',    name: 'Hot Muzzle',   desc: '+20% bullet damage',   icon: '⚔', stack: true },
  { id: 'rate',   name: 'Rapid Fire',   desc: '+18% fire rate',       icon: '⚡', stack: true },
  { id: 'spread', name: 'Scattershot',  desc: '+1 projectile arc',    icon: '✦', stack: true, max: 5 },
  { id: 'speed',  name: 'Thrusters',    desc: '+12% move speed',      icon: '➤', stack: true },
  { id: 'hp',     name: 'Shield Core',  desc: '+25 max HP & heal 25', icon: '♥', stack: true },
  { id: 'magnet', name: 'Loot Magnet',  desc: '+30% gem pull range',  icon: '◎', stack: true },
  { id: 'multi',  name: 'Twin Guns',    desc: 'Extra parallel barrel',icon: 'Ⅱ', stack: true, max: 3 },
  { id: 'pierce', name: 'Overcharge',   desc: 'Bullets pierce +1',    icon: '⇀', stack: true, max: 4 },
  { id: 'orbit',  name: 'Orbit Drones', desc: 'Orbiting plasma orbs', icon: '◉', stack: true, max: 4 },
  { id: 'heal',   name: 'Nano Repair',  desc: 'Restore 40 HP',        icon: '+', stack: false },
];

// Wave spawn pacing
const WAVE = {
  baseInterval: 1.35,
  minInterval: 0.38,
  ramp: 0.04,          // interval shrink per wave
  baseCount: 3,
  countRamp: 0.55,
  bossEvery: 5,
};
