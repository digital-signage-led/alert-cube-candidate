/**
 * 開発サーバー上の主要パスと JSON を確認する
 * node tests/check-paths.js http://127.0.0.1:3200/
 */
var http = require('http');
var { URL } = require('url');

var base = process.argv[2] || 'http://127.0.0.1:3200/';
var paths = [
  '/',
  '/index.html',
  '/index.html?offseason=1',
  '/index.html?site=AC-0001',
  '/index.html?site=AC-0002',
  '/index.html?site=AC-0000',
  '/index.html?site=bad',
  '/offseason.html',
  '/sw.js',
  '/config/site-config.js',
  '/scripts/alert-cube-core.js',
  '/scripts/alert-cube-runtime.js',
  '/scripts/alert-cube-typhoon.js',
  '/scripts/warning-hero.js',
  '/scripts/jma-warning-kinds.js',
  '/styles/white-hero.css',
  '/styles/color-hero.css',
  '/styles/fonts.css',
  '/images/logo.svg',
  '/safety/version.js',
  '/core/foundation.js',
  '/contents/registry.js',
  '/contents/modules.js',
  '/contents/index.html',
  '/contents/weather/index.js',
  '/contents/pressure/index.js',
  '/contents/typhoon/index.js',
  '/data/jma-regions.js',
  '/safety/fallback.js',
  '/safety/retry.js',
  '/safety/rollback.js',
  '/services/typhoon/index.js',
  '/404.html',
  '/.nojekyll',
  '/data/jma-weather-icons.js',
  '/services/remote.js',
  '/sites/AC-0001.json',
  '/sites/AC-0002.json',
  '/sites/AC-0000.json',
  '/sites/AC-0003.json',
  '/sites/AC-0004.json',
  '/sites/AC-0005.json',
  '/sites/AC-0006.json',
  '/sites/AC-0007.json',
  '/sites/AC-0008.json',
  '/sites/AC-0009.json',
  '/sites/AC-0010.json',
  '/assets/sites/AC-0010/logo_banner.png',
  '/sites/AC-0011.json',
  '/assets/sites/AC-0011/logo_banner.png',
  '/assets/sites/AC-0011/logo_mark.png',
  '/assets/sites/AC-0011/news.json',
  '/sites/AC-0012.json',
  '/sites/AC-0013.json',
  '/sites/AC-0014.json',
  '/assets/sites/AC-0014/logo_mark.png',
  '/assets/sites/AC-0014/logo_banner.png',
  '/sites/AC-0015.json',
  '/sites/AC-0016.json',
  '/sites/AC-0017.json',
  '/assets/sites/AC-0017/logo_foot.png',
  '/sites/AC-0018.json',
  '/assets/sites/AC-0018/logo_foot.png',
  '/sites/AC-0019.json',
  '/assets/sites/AC-0019/news.json',
  '/assets/sites/AC-0019/toda_logo_stack.png',
  '/assets/sites/AC-0019/toda_name_yoko.png',
  '/assets/sites/AC-0019/toda_bct_flow.png',
  '/assets/sites/AC-0019/toda_mark_tate.png',
  '/assets/sites/AC-0019/toda_bct_tate.png',
  '/assets/sites/AC-0019/eco_first.png',
  '/sites/AC-0020.json',
  '/assets/sites/AC-0020/logo_foot.png',
  '/sites/AC-0021.json',
  '/assets/sites/AC-0021/logo_mark.png',
  '/assets/sites/AC-0021/logo_wordmark.png',
  '/assets/sites/AC-0015/logo_banner.png',
  '/assets/sites/AC-0015/news.json',
  '/services/densho/index.js',
  '/assets/sites/AC-0012/logo_banner.png',
  '/assets/sites/AC-0012/logo_stack.png',
  '/assets/sites/AC-0012/news.json',
  '/assets/sites/AC-0008/logo_mark.png',
  '/assets/sites/AC-0008/logo_banner.png',
  '/assets/sites/AC-0009/logo_mark.png',
  '/assets/sites/AC-0009/logo_banner.png',
  '/assets/sites/AC-0009/news.json',
  '/assets/sites/AC-0007/logo_mark.png',
  '/assets/sites/AC-0007/logo_foot.png',
  '/assets/sites/AC-0007/logo_banner.png',
  '/assets/sites/AC-0007/news.json',
  '/assets/sites/AC-0006/logo_stack.png',
  '/assets/sites/AC-0006/logo_wide.png',
  '/assets/sites/AC-0006/news.json',
  '/assets/sites/AC-0005/logo_128.png',
  '/assets/sites/AC-0005/logo_foot.png',
  '/assets/sites/AC-0004/logo_stack.png',
  '/assets/sites/AC-0004/logo_wide.png',
  '/assets/sites/AC-0004/logo_foot.png',
  '/assets/sites/AC-0004/news.json',
  '/contents/news/index.js',
  '/contents/boards/index.js',
  '/contents/logo-scroll/index.js',
  '/contents/progress/index.js',
  '/contents/eew/evaluate.js',
  '/contents/hazard/evaluate.js',
  '/contents/hazard/player.js',
  '/services/hazard/index.js',
  '/assets/sites/AC-0002/eneos_logo.gif',
  '/assets/sites/AC-0002/eneos_lockup.png',
  '/sites/index.json'
];

function get(path) {
  return new Promise(function (resolve) {
    var url = new URL(path, base).href;
    var t0 = Date.now();
    var req = http.get(url, { headers: { Accept: '*/*' } }, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        var next = new URL(res.headers.location, url);
        if (res.headers.location.indexOf('?') < 0 && url.indexOf('?') >= 0) {
          next.search = new URL(url).search;
        }
        res.resume();
        return get(next.pathname + next.search).then(function (r) {
          r.path = path;
          r.redirected = true;
          resolve(r);
        });
      }
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        resolve({ path: path, status: res.statusCode, bytes: Buffer.concat(chunks).length, ms: Date.now() - t0 });
      });
    });
    req.on('error', function (e) {
      resolve({ path: path, status: 0, bytes: 0, ms: Date.now() - t0, error: String(e.message || e) });
    });
    req.setTimeout(10000, function () {
      req.destroy();
      resolve({ path: path, status: 0, bytes: 0, ms: Date.now() - t0, error: 'timeout' });
    });
  });
}

(async function () {
  var rows = [];
  for (var i = 0; i < paths.length; i++) rows.push(await get(paths[i]));
  var bad = rows.filter(function (r) { return r.status !== 200; });
  console.log(JSON.stringify({ ok: bad.length === 0, checked: rows.length, bad: bad, rows: rows }, null, 2));
  if (bad.length) process.exit(1);
})();
