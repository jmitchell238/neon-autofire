# Neon Autofire

Side-scrolling auto-shooter inspired by *Mr. Autofire* — steer your neon ship, weapons fire themselves, collect XP, and pick upgrades while waves of enemies pour in.

**Play:** https://jmitchell238.github.io/neon-autofire/

## Controls

| Input | Action |
|-------|--------|
| Drag / virtual stick | Move |
| WASD / Arrow keys | Move |
| 1 / 2 / 3 | Pick level-up upgrade |
| Esc | Menu |

Weapons **auto-aim and auto-fire** at the nearest enemy. You only fly.

## Features

- Side-scrolling neon arena with parallax stars
- Auto-fire combat with spread, multi-barrel, pierce, and orbit drones
- XP gems → level-up upgrade choices
- Escalating waves, snipers, tanks, and bosses
- Heal pickups, screen shake, Web Audio SFX
- Installable PWA + high-score save

## Stack

Static HTML/CSS/Canvas. No build step. Progress in `localStorage`.

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
