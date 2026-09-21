/* 固定素材キャッシュ。HTMLはネット優先、?v= 付きはキャッシュ優先 */
var CACHE_NAME = 'alert-cube-sites-20260921-ac0002-scroll1';
var PRECACHE = [
  './config/site-config.js?v=20260921-suminoe',
  './safety/version.js?v=20260921-suminoe',
  './safety/fallback.js?v=20260921-suminoe',
  './safety/retry.js?v=20260921-suminoe',
  './safety/rollback.js?v=20260921-suminoe',
  './contents/registry.js?v=20260921-suminoe',
  './contents/modules.js?v=20260921-suminoe',
  './data/jma-weather-icons.js?v=20260921-suminoe',
  './data/jma-regions.js?v=20260921-suminoe',
  './core/foundation.js?v=20260921-suminoe',
  './services/remote.js?v=20260921-suminoe',
  './services/typhoon/index.js?v=20260921-suminoe',
  './scripts/alert-cube-core.js?v=20260921-suminoe',
  './scripts/alert-cube-runtime.js?v=20260921-suminoe',
  './scripts/alert-cube-typhoon.js?v=20260921-suminoe',
  './scripts/jma-warning-kinds.js?v=20260921-suminoe',
  './scripts/warning-hero.js?v=20260921-suminoe',
  './styles/white-hero.css?v=20260921-suminoe',
  './styles/color-hero.css?v=20260921-suminoe',
  './styles/fonts.css?v=20260921-webfont',
  './images/logo.svg?v=20260921-suminoe',
  './sites/AC-0001.json',
  './sites/AC-0002.json',
  './sites/AC-0000.json',
  './assets/sites/AC-0002/eneos_logo.gif?v=20260921-ac0002-user1',
  './assets/sites/AC-0002/eneos_lockup.png?v=20260921-ac0002-user1',
  './images/jma-icons/100.svg',
  './images/jma-icons/101.svg',
  './images/jma-icons/102.svg',
  './images/jma-icons/104.svg',
  './images/jma-icons/110.svg',
  './images/jma-icons/112.svg',
  './images/jma-icons/115.svg',
  './images/jma-icons/200.svg',
  './images/jma-icons/201.svg',
  './images/jma-icons/202.svg',
  './images/jma-icons/204.svg',
  './images/jma-icons/210.svg',
  './images/jma-icons/212.svg',
  './images/jma-icons/215.svg',
  './images/jma-icons/300.svg',
  './images/jma-icons/301.svg',
  './images/jma-icons/302.svg',
  './images/jma-icons/303.svg',
  './images/jma-icons/308.svg',
  './images/jma-icons/311.svg',
  './images/jma-icons/313.svg',
  './images/jma-icons/314.svg',
  './images/jma-icons/400.svg',
  './images/jma-icons/401.svg',
  './images/jma-icons/402.svg',
  './images/jma-icons/403.svg',
  './images/jma-icons/406.svg',
  './images/jma-icons/411.svg',
  './images/jma-icons/413.svg',
  './images/jma-icons/414.svg'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE).catch(function () {});
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isApiRequest_(url) {
  return /jma\.go\.jp|googleapis\.com|script\.google|timeapi\.io|worldtimeapi/.test(url.hostname);
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (isApiRequest_(url)) return;

  var isHtml = url.pathname === '/' || /\.html$/i.test(url.pathname);
  if (isHtml) {
    event.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req);
      })
    );
    return;
  }

  var versioned = url.search.indexOf('v=') >= 0 || /\.(js|css|gif|png|svg|woff2)$/i.test(url.pathname);
  if (!versioned) return;

  event.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      });
    })
  );
});
