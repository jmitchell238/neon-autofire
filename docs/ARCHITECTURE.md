# Architecture

Plain HTML, CSS and canvas with no build step. The scripts are plain `<script>` tags that share global scope, loaded in this order from `index.html`. The tests load them in the same order in a Node VM.

## Files

| File | Contents |
|------|----------|
| `js/config.js` | `GAME_VERSION` and tuning constants: stage size, player physics, jump height |
| `js/save.js` | High score and stats in localStorage |
| `js/util.js` | Math and random helpers, canvas resizing |
| `js/audio.js` | Sound effects |
| `js/sprites.js` | Loading the sprite sheets and drawing animation frames |
| `js/game-state.js` | Run state: score, kills, wave, camera, shared collections |
| `js/effects.js` | Bursts and sparks |
| `js/world.js` | Platform generation, and checking each platform can be reached with a jump |
| `js/player.js` | `PlayerEntity`: movement, jumping, camera follow |
| `js/enemies.js` | Enemy types, wave budgets, spawning, bosses, AI |
| `js/combat.js` | `PlayerWeaponSystem`, targeting, bullets, XP, level-up upgrades, taking damage |
| `js/game-systems.js` | Per-frame updates for bullets, enemies, enemy weapons, gems, pickups, particles and waves |
| `js/game.js` | `updatePlay()`, which runs one frame of play |
| `js/render.js` | Drawing the background, platforms, player, enemies, pickups and HUD |
| `js/main.js` | Screens, the frame loop, touch stick and keyboard input, service worker registration |
| `sw.js`, `manifest.webmanifest` | Offline cache and PWA install |

## Tests

| File | Covers |
|------|--------|
| `tests/all.mjs` | Runs the other suites |
| `tests/run.mjs` | Game logic, loaded in a Node VM |
| `tests/browser.mjs` | The page shell, sprites, audio and rendering, with stubbed browser APIs |
| `tests/service-worker.mjs` | The service worker |
| `tests/coverage.mjs` | The coverage thresholds in [DEVELOPMENT.md](DEVELOPMENT.md#tests) |

## Updates

`js/main.js` registers `sw.js` and checks for updates two ways:

- It calls `registration.update()` on load, when the tab regains focus, and every minute. A new service worker takes over as soon as it installs.
- Every two minutes, and whenever the tab becomes visible, it fetches `js/config.js` with caching disabled and compares `GAME_VERSION`.

Either way, the page reloads to pick up the new version, but not in the middle of a run. A pending reload happens at the next menu or game-over screen.
