#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const failures = [];
function assert(condition, message) {
  if (condition) { passed++; process.stdout.write('.'); }
  else { failures.push(message); console.error('\n  ✗', message); }
}

const handlers = new Map();
const stored = new Map();
const deleted = [];
const cache = {
  add: url => { stored.set(url, { ok: true, url }); return Promise.resolve(); },
  put: (request, response) => { stored.set(request.url || request, response); return Promise.resolve(); },
};
const sandbox = {
  console,
  URL,
  Promise,
  Response,
  self: {
    location: { origin: 'https://example.test' },
    clients: { claim: () => Promise.resolve() },
    skipWaiting() { this.skipped = true; },
    addEventListener(type, callback) { handlers.set(type, callback); },
  },
  caches: {
    open: () => Promise.resolve(cache),
    keys: () => Promise.resolve(['old-cache', 'neon-autofire-1.3.000']),
    delete: key => { deleted.push(key); return Promise.resolve(true); },
    match: request => Promise.resolve(stored.get(request.url || request)),
  },
  fetch: request => Promise.resolve({
    ok: true,
    url: request.url || request,
    clone() { return this; },
  }),
};
sandbox.globalThis = sandbox;
const context = vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), context, {
  filename: path.join(root, 'sw.js'), timeout: 5000,
});
const api = vm.runInContext('({ precacheAll, sameOrigin, networkFirst, cacheFirst, isShellOrCode })', context);

console.log('\n• service worker');
assert(handlers.has('install') && handlers.has('activate') && handlers.has('fetch'), 'all lifecycle handlers registered');
assert(api.sameOrigin('https://example.test/game.js'), 'same-origin URL accepted');
assert(!api.sameOrigin('https://other.test/game.js'), 'cross-origin URL rejected');
assert(!api.sameOrigin('not a url'), 'invalid URL rejected');
assert(api.isShellOrCode('https://example.test/') && api.isShellOrCode('https://example.test/js/game.js'), 'shell/code recognized');
assert(!api.isShellOrCode('https://example.test/icon.png'), 'asset recognized');

let installPromise;
handlers.get('install')({ waitUntil(promise) { installPromise = promise; } });
await installPromise;
assert(sandbox.self.skipped, 'install precaches and skips waiting');
assert(stored.has('./index.html') && stored.has('./js/game.js'), 'core shell precached');

let activatePromise;
handlers.get('activate')({ waitUntil(promise) { activatePromise = promise; } });
await activatePromise;
assert(deleted.includes('old-cache') && !deleted.includes('neon-autofire-1.3.000'), 'activation removes only stale caches');

sandbox.self.skipped = false;
handlers.get('message')({ data: 'SKIP_WAITING' });
assert(sandbox.self.skipped, 'string skip-waiting message handled');
sandbox.self.skipped = false;
handlers.get('message')({ data: { type: 'SKIP_WAITING' } });
assert(sandbox.self.skipped, 'object skip-waiting message handled');

function fetchEvent(url, options = {}) {
  let responsePromise;
  handlers.get('fetch')({
    request: { method: options.method || 'GET', mode: options.mode || 'cors', url },
    respondWith(promise) { responsePromise = promise; },
  });
  return responsePromise;
}

assert(fetchEvent('https://other.test/a.js') === undefined, 'cross-origin requests ignored');
assert(fetchEvent('https://example.test/a.js', { method: 'POST' }) === undefined, 'non-GET requests ignored');
assert(await fetchEvent('https://example.test/', { mode: 'navigate' }), 'navigation uses network strategy');
assert(await fetchEvent('https://example.test/js/game.js'), 'code uses network strategy');
assert(await fetchEvent('https://example.test/icon.png'), 'asset uses cache strategy');

stored.set('https://example.test/cached.png', { ok: true, cached: true });
const cached = await api.cacheFirst({ url: 'https://example.test/cached.png' });
assert(cached.cached, 'cache-first returns an existing cache hit');

console.log(`\n${passed} service-worker assertions passed, ${failures.length} failed`);
if (failures.length) process.exitCode = 1;
