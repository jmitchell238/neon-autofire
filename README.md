# Neon Autofire

Side-scrolling **platformer shooter** inspired by *Mr. Autofire* — run and jump a neon hero through the city while guns auto-fire, collect XP, and pick upgrades as waves roll in.

**Play:** https://jmitchell238.github.io/neon-autofire/

## Controls

| Input | Action |
|-------|--------|
| Left stick / A D / ← → | Run |
| JUMP button / right tap / Space / W / ↑ | Jump |
| 1 / 2 / 3 | Pick level-up upgrade |
| Esc | Menu |

Weapons **auto-aim and auto-fire** at the nearest enemy. You run, jump, and stay alive.

## Features

- 2D platformer movement (gravity, coyote time, variable jump)
- Neon city platforms + parallax skyline
- Auto-fire combat with spread, multi-barrel, pierce, orbit drones
- XP gems → level-up upgrades (including spring legs)
- Ground grunts, hoppers, flyers, gunners, and bosses
- Heal pickups, screen shake, Web Audio SFX
- Installable PWA + high-score save

## Stack

Static HTML/CSS/Canvas. No build step. Progress in `localStorage`.

## Architecture

The runtime uses a hybrid object-oriented/functional design without a bundler:

- `game-state.js` owns run lifecycle and shared collections.
- `player.js` defines the stateful `PlayerEntity` and player movement.
- `combat.js` defines the stateful `PlayerWeaponSystem`; aiming and projectile creation are pure functions.
- `world.js` contains platform reachability and procedural generation.
- `enemies.js` contains enemy factories, wave spawning, and AI.
- `game-systems.js` updates projectiles, collisions, collectibles, effects, and waves.
- `game.js` is the thin frame-update orchestrator.
- `render.js` and `main.js` remain the rendering and browser-input boundaries.

Classic scripts are loaded in dependency order in `index.html`; tests load the same order in a Node VM.

## Pixel art credits

| Pack | Source | License |
|------|--------|---------|
| **3 Cyberpunk Characters** (Cyborg player, Biker/Punk enemies) | [OpenGameArt](https://opengameart.org/content/3-cyberpunk-characters) / [CraftPix freebie](https://craftpix.net/freebies/free-3-cyberpunk-characters-pixel-art/) | OGA-BY 3.0 |
| **Cyber City** (skyline + yakuza foes) | [OpenGameArt — Buch](https://opengameart.org/content/cyber-city) | CC0 |
| **Free Sci-Fi Platformer Tileset** | [OpenGameArt](https://opengameart.org/content/free-sci-fi-platformer-game-tileset) | CC0 |

See `assets/CREDITS.md` for the full attribution list.

## Versioning

- `GAME_VERSION` in `js/config.js` — `MAJOR.MINOR.PATCH` (patch zero-padded to 3 digits)
- Keep `CACHE` in `sw.js` in sync: `'neon-autofire-' + GAME_VERSION`

## Tests

```bash
node tests/all.mjs
node tests/coverage.mjs
```

The coverage gate requires 100% executable-line coverage, at least 80% branch coverage, and at least 95% function coverage across every file in `js/` plus `sw.js`.

## Local

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.
