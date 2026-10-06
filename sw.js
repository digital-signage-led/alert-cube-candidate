/* 固定素材キャッシュ。HTMLはネット優先、?v= 付きはキャッシュ優先 */
var CACHE_NAME = 'alert-cube-sites-20261006-ac0020-logo';
var PRECACHE = [
  './config/site-config.js?v=20260921-suminoe',
  './safety/version.js?v=20260921-suminoe',
  './safety/fallback.js?v=20260921-suminoe',
  './safety/retry.js?v=20260921-suminoe',
  './safety/rollback.js?v=20260921-suminoe',
  './contents/registry.js?v=20260929-eew1',
  './contents/modules.js?v=20260929-eew1',
  './contents/news/index.js?v=20260929-ac0019-news',
  './contents/boards/index.js?v=20261005-ac0009-slide',
  './contents/logo-scroll/index.js?v=20260923-ac0004',
  './contents/progress/index.js?v=20261005-progress-logo',
  './contents/eew/evaluate.js?v=20260929-eew1',
  './contents/hazard/evaluate.js?v=20260929-eew1',
  './contents/hazard/player.js?v=20260929-eew1',
  './services/hazard/index.js',
  './contents/index.html',
  './data/jma-weather-icons.js?v=20260921-suminoe',
  './data/jma-regions.js?v=20260921-suminoe',
  './core/foundation.js?v=20261006-ac0018-foot',
  './services/densho/index.js?v=20260929-densho-live',
  './services/remote.js?v=20260921-suminoe',
  './services/typhoon/index.js?v=20260921-suminoe',
  './scripts/alert-cube-core.js?v=20260929-i18n-off',
  './scripts/alert-cube-runtime.js?v=20261005-site-shell',
  './scripts/alert-cube-typhoon.js?v=20260921-suminoe',
  './scripts/jma-warning-kinds.js?v=20260921-suminoe',
  './scripts/warning-hero.js?v=20260921-suminoe',
  './styles/white-hero.css?v=20260929-midband',
  './styles/color-hero.css?v=20260921-suminoe',
  './styles/fonts.css?v=20260921-webfont',
  './images/logo.svg?v=20260921-suminoe',
  './sites/AC-0001.json',
  './sites/AC-0002.json',
  './sites/AC-0000.json',
  './sites/AC-0003.json',
  './assets/sites/AC-0003/tannan_logo_128.png?v=1',
  './assets/sites/AC-0003/tannan_logo.png?v=1',
  './sites/AC-0004.json',
  './sites/AC-0005.json',
  './sites/AC-0006.json',
  './sites/AC-0007.json',
  './sites/AC-0008.json',
  './sites/AC-0009.json',
  './sites/AC-0010.json',
  './assets/sites/AC-0010/logo_banner.png?v=1',
  './sites/AC-0011.json',
  './assets/sites/AC-0011/logo_banner.png?v=3',
  './assets/sites/AC-0011/logo_mark.png?v=3',
  './assets/sites/AC-0011/news.json',
  './sites/AC-0012.json',
  './sites/AC-0013.json',
  './assets/sites/AC-0013/news.json',
  './assets/sites/AC-0013/logo_mark.png?v=1',
  './assets/sites/AC-0013/logo_banner.png?v=2',
  './assets/sites/AC-0013/densho-latest.json',
  './sites/AC-0014.json',
  './assets/sites/AC-0014/logo_mark.png?v=1',
  './assets/sites/AC-0014/logo_banner.png?v=1',
  './sites/AC-0015.json',
  './sites/AC-0016.json',
  './assets/sites/AC-0016/logo_mark.png?v=1',
  './sites/AC-0017.json',
  './assets/sites/AC-0017/logo_foot.png?v=1',
  './sites/AC-0018.json',
  './assets/sites/AC-0018/logo_foot.png?v=1',
  './assets/sites/AC-0018/logo_mark.png?v=1',
  './sites/AC-0019.json',
  './assets/sites/AC-0019/news.json',
  './assets/sites/AC-0019/toda_logo_stack.png?v=1',
  './assets/sites/AC-0019/toda_name_yoko.png?v=1',
  './assets/sites/AC-0019/toda_bct_flow.png?v=1',
  './assets/sites/AC-0019/toda_mark_tate.png?v=1',
  './assets/sites/AC-0019/toda_bct_tate.png?v=1',
  './assets/sites/AC-0019/eco_first.png?v=1',
  './sites/AC-0020.json',
  './assets/sites/AC-0020/logo_foot.png?v=1',
  './assets/sites/AC-0020/logo_mark.png?v=1',
  './sites/AC-0021.json',
  './assets/sites/AC-0021/logo_mark.png?v=1',
  './assets/sites/AC-0021/logo_wordmark.png?v=1',
  './assets/sites/AC-0015/logo_banner.png?v=1',
  './assets/sites/AC-0015/news.json',
  './assets/sites/AC-0012/logo_banner.png?v=1',
  './assets/sites/AC-0012/logo_stack.png?v=1',
  './assets/sites/AC-0012/news.json',
  './assets/sites/AC-0008/logo_mark.png?v=2',
  './assets/sites/AC-0008/logo_banner.png?v=2',
  './assets/sites/AC-0009/logo_mark.png?v=1',
  './assets/sites/AC-0009/logo_banner.png?v=1',
  './assets/sites/AC-0009/safety_opening.png?v=1',
  './assets/sites/AC-0009/safety_lifeline.png?v=1',
  './assets/sites/AC-0009/safety_fall.png?v=1',
  './assets/sites/AC-0009/safety_harness.jpg?v=1',
  './assets/sites/AC-0009/news.json',
  './assets/sites/AC-0007/logo_mark.png?v=2',
  './assets/sites/AC-0007/logo_foot.png?v=2',
  './assets/sites/AC-0007/logo_banner.png?v=3',
  './assets/sites/AC-0007/news.json',
  './assets/sites/AC-0006/logo_stack.png?v=1',
  './assets/sites/AC-0006/logo_wide.png?v=1',
  './assets/sites/AC-0006/news.json',
  './assets/sites/AC-0005/logo_128.png?v=1',
  './assets/sites/AC-0005/logo_foot.png?v=1',
  './assets/sites/AC-0004/logo_stack.png?v=6',
  './assets/sites/AC-0004/logo_wide.png?v=3',
  './assets/sites/AC-0004/logo_foot.png?v=1',
  './assets/sites/AC-0004/news.json',
  './assets/sites/AC-0002/eneos_logo.gif?v=20260921-ac0002-user1',
  './assets/sites/AC-0002/eneos_lockup.png?v=20260921-ac0002-user1'
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
