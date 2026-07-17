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
node tests/run.mjs
```

## Local

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.
