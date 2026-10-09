# Development

## Running locally

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080.

## Tests

```bash
node tests/all.mjs
node tests/coverage.mjs
```

`coverage.mjs` fails unless `js/` and `sw.js` have 100% line coverage, at least 80% branch coverage and at least 95% function coverage.

## Versioning

`GAME_VERSION` in `js/config.js` is `MAJOR.MINOR.PATCH` with a three-digit patch. When you bump it, set `CACHE` in `sw.js` to `'neon-autofire-' + GAME_VERSION`.
