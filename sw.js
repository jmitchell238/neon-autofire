// Bump with GAME_VERSION in js/config.js (MAJOR.MINOR.PATCH).
const CACHE = 'neon-autofire-1.3.001';

const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/save.js',
  './js/util.js',
  './js/audio.js',
  './js/sprites.js',
  './js/game-state.js',
  './js/effects.js',
  './js/world.js',
  './js/player.js',
  './js/enemies.js',
  './js/combat.js',
  './js/game-systems.js',
  './js/game.js',
  './js/render.js',
  './js/main.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './apple-touch-icon.png',
  './art/cover.jpg',
  // core sprites (service worker precache — keep list lean)
  './assets/sprites/player/Cyborg_idle.png',
  './assets/sprites/player/Cyborg_run.png',
  './assets/sprites/player/Cyborg_jump.png',
  './assets/sprites/player/Cyborg_run_attack.png',
  './assets/sprites/player/Cyborg_hurt.png',
  './assets/sprites/player/Cyborg_death.png',
  './assets/sprites/player/Cyborg_doublejump.png',
  './assets/sprites/player/logo.png',
  './assets/sprites/enemies/Biker_idle.png',
  './assets/sprites/enemies/Biker_run.png',
  './assets/sprites/enemies/Biker_jump.png',
  './assets/sprites/enemies/Biker_hurt.png',
  './assets/sprites/enemies/Biker_death.png',
  './assets/sprites/enemies/Punk_idle.png',
  './assets/sprites/enemies/Punk_run.png',
  './assets/sprites/enemies/Punk_jump.png',
  './assets/sprites/enemies/Punk_hurt.png',
  './assets/sprites/enemies/Punk_death.png',
  './assets/sprites/enemies/yakuza1.png',
  './assets/sprites/enemies/yakuza2.png',
  './assets/sprites/enemies/yakuza3.png',
  './assets/sprites/enemies/yakuza_boss.png',
  './assets/sprites/bg/city.png',
  './assets/sprites/bg/city_2x.png',
  './assets/sprites/tiles/tile_1.png',
  './assets/sprites/tiles/tile_2.png',
  './assets/sprites/tiles/tile_3.png',
  './assets/sprites/tiles/platform_strip.png',
  './assets/sprites/fx/bullet.png',
  './assets/sprites/fx/gem.png',
  './assets/sprites/fx/heal.png',
  './assets/sprites/fx/orbit.png',
];

function precacheAll(cache) {
  return Promise.allSettled(
    ASSETS.map(url =>
      cache.add(url).catch(err => console.warn('[sw] precache failed', url, err))
    )
  );
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(precacheAll).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING' || (e.data && e.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});

function sameOrigin(url) {
  try { return new URL(url).origin === self.location.origin; }
  catch { return false; }
}

function networkFirst(request) {
  return fetch(request, { cache: 'no-store' }).then(res => {
    if (res.ok && sameOrigin(request.url)) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(request, copy));
    }
    return res;
  }).catch(() => caches.match(request).then(hit => hit || Response.error()));
}

function cacheFirst(request) {
  return caches.match(request).then(hit => hit ||
    fetch(request).then(res => {
      if (res.ok && sameOrigin(request.url)) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(request, copy));
      }
      return res;
    }));
}

function isShellOrCode(url) {
  const path = new URL(url).pathname;
  if (path.endsWith('/sw.js')) return true;
  if (path.endsWith('.html') || path.endsWith('/')) return true;
  if (path.includes('/css/')) return true;
  if (path.includes('/js/')) return true;
  if (path.endsWith('manifest.webmanifest')) return true;
  return false;
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!sameOrigin(e.request.url)) return;

  if (e.request.mode === 'navigate' || isShellOrCode(e.request.url)) {
    e.respondWith(networkFirst(e.request));
    return;
  }

  e.respondWith(cacheFirst(e.request));
});
