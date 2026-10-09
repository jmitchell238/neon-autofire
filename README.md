# Neon Autofire

A side-scrolling platformer shooter inspired by Mr. Autofire. Run and jump through a neon city while your guns fire on their own, collect XP, and pick an upgrade each time you level up.

Play at https://jmitchell238.github.io/neon-autofire/

## Controls

| Input | Action |
|-------|--------|
| Left stick / A D / ← → | Run |
| JUMP button / right tap / Space / W / ↑ | Jump |
| 1 / 2 / 3 | Pick level-up upgrade |
| Esc | Menu |

Weapons aim and fire at the nearest enemy automatically. Your job is to move and stay alive.

## Features

- Platformer movement with coyote time and variable jump height
- Neon city platforms and a parallax skyline
- Weapon upgrades: spread shot, extra barrels, piercing, orbiting drones
- XP gems that level you up, with a choice of upgrades each time (including spring legs)
- Grunts, hoppers, flyers, gunners and bosses
- Health pickups, screen shake, Web Audio sound effects
- Installable PWA with a saved high score

## Code

Plain HTML, CSS and canvas with no build step. Progress is saved in localStorage.


| File | Contents |
|------|----------|
| `game-state.js` | Run state and shared collections |
| `player.js` | `PlayerEntity` and movement |
| `combat.js` | `PlayerWeaponSystem`, aiming, projectiles |
| `world.js` | Level generation and platform reachability |
| `enemies.js` | Enemy types, wave spawning, AI |
| `game-systems.js` | Projectiles, collisions, pickups, effects, waves |
| `game.js` | Per-frame update |
| `render.js` | Drawing |
| `main.js` | Browser input and setup |

The scripts are plain `<script>` tags loaded in order in `index.html`. The tests load them in the same order in a Node VM.

## Pixel art credits

| Pack | Source | License |
|------|--------|---------|
| 3 Cyberpunk Characters (Cyborg player, Biker/Punk enemies) | [OpenGameArt](https://opengameart.org/content/3-cyberpunk-characters) / [CraftPix freebie](https://craftpix.net/freebies/free-3-cyberpunk-characters-pixel-art/) | OGA-BY 3.0 |
| Cyber City (skyline, yakuza enemies) | [OpenGameArt — Buch](https://opengameart.org/content/cyber-city) | CC0 |
| Free Sci-Fi Platformer Tileset | [OpenGameArt](https://opengameart.org/content/free-sci-fi-platformer-game-tileset) | CC0 |

Full attribution is in `assets/CREDITS.md`.

## Versioning

`GAME_VERSION` in `js/config.js` is `MAJOR.MINOR.PATCH` with a three-digit patch. When you bump it, set `CACHE` in `sw.js` to `'neon-autofire-' + GAME_VERSION`.

## Tests

```bash
node tests/all.mjs
node tests/coverage.mjs
```

`coverage.mjs` fails unless `js/` and `sw.js` have 100% line coverage, at least 80% branch coverage and at least 95% function coverage.

## Running locally

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080.
