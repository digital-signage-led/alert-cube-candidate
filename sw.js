/* 固定素材キャッシュ。HTMLはネット優先、?v= 付きはキャッシュ優先
   事前キャッシュは全案件共通のコードだけ。案件ごとのロゴ・設定は、その案件を開いたときに1回だけ保存する */
var CACHE_NAME = 'alert-cube-sites-20261124-icing';
var PRECACHE = [
  './config/site-config.js?v=20260921-suminoe',
  './safety/version.js?v=20260921-suminoe',
  './contents/registry.js?v=20261111-wxtech-public',
  './contents/modules.js?v=20261111-wxtech-public',
  './contents/news/index.js?v=20261112-news-newest',
  './contents/boards/index.js?v=20261111-sato-boards',
  './contents/logo-scroll/index.js?v=20261117-meiban-lines',
  './contents/progress/index.js?v=20261005-progress-sheet',
  './contents/rain-radar/prefectures.js?v=20261005-rain-radar14',
  './contents/rain-radar/index.js?v=20261116-coast-map',
  './contents/ssc/index.js?v=20261110-densho-vib',
  './contents/eew/evaluate.js?v=20260929-eew1',
  './contents/hazard/evaluate.js?v=20260929-eew1',
  './contents/hazard/player.js?v=20260929-eew1',
  './data/jma-weather-icons.js?v=20260921-suminoe',
  './data/wxtech-icons.js?v=20261111-wxtech-public',
  './services/wxtech/index.js?v=20261112-wxtech-hold',
  './contents/short-forecast/index.js?v=20261112-short-prec',
  './data/jma-regions.js?v=20260921-suminoe',
  './core/foundation.js?v=20261124-icing',
  './services/densho/index.js?v=20261110-densho-vib',
  './services/remote.js?v=20261016-dm0002',
  './services/typhoon/index.js?v=20260921-suminoe',
  './safety/fallback.js?v=20260921-suminoe',
  './safety/retry.js?v=20260921-suminoe',
  './safety/rollback.js?v=20260921-suminoe',
  './scripts/alert-cube-core.js?v=20261110-wbgt-open',
  './scripts/alert-cube-runtime.js?v=20261029-ac0031-logo',
  './styles/fonts.css?v=20260921-webfont',
  './styles/white-hero.css?v=20260929-midband',
  './images/logo.svg?v=20260921-suminoe',
  './scripts/alert-cube-typhoon.js?v=20260921-suminoe',
  './scripts/jma-warning-kinds.js?v=20260921-suminoe',
  './scripts/warning-hero.js?v=20260921-suminoe',
  './styles/color-hero.css?v=20260921-suminoe'
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
      /* 初めての登録では読み直さない（開いた直後の再読み込みで表示が空になるのを防ぐ）。版の更新時だけ読み直す */
      var isUpdate = keys.some(function (key) { return key !== CACHE_NAME && key.indexOf('alert-cube-') === 0; });
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE_NAME) return caches.delete(key);
      })).then(function () { return isUpdate; });
    }).then(function (isUpdate) {
      return self.clients.claim().then(function () { return isUpdate; });
    }).then(function (isUpdate) {
      if (!isUpdate) return null;
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
        return Promise.all(clients.map(function (client) {
          if (!client.navigate) return null;
          return client.navigate(client.url);
        }));
      });
    })
  );
});

function isApiRequest_(url) {
  return /jma\.go\.jp|googleapis\.com|script\.google|timeapi\.io|worldtimeapi|r\.jina\.ai/.test(url.hostname);
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (isApiRequest_(url)) return;
  if (/\/sw\.js$/i.test(url.pathname)) return;

  if (/\/sites\/(?:index|AC-\d{4})\.json$/i.test(url.pathname)) {
    event.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) { return hit || Response.error(); });
      })
    );
    return;
  }

  var isHtml = url.pathname === '/' || /\.html$/i.test(url.pathname);
  if (isHtml) {
    event.respondWith(
      fetch(req.url, { cache: 'no-store', credentials: 'same-origin', redirect: 'follow' }).then(function (res) {
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
