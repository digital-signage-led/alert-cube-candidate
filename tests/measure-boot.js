/**
 * 起動計測（ローカルサーバー前提）
 * node tests/measure-boot.js http://127.0.0.1:3200/
 */
var http = require('http');
var https = require('https');
var { URL } = require('url');

var base = process.argv[2] || 'http://127.0.0.1:3200/';

function get(url) {
  return new Promise(function (resolve, reject) {
    var u = new URL(url);
    var lib = u.protocol === 'https:' ? https : http;
    var t0 = Date.now();
    var req = lib.get(u, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        var buf = Buffer.concat(chunks);
        resolve({
          url: url,
          status: res.statusCode,
          bytes: buf.length,
          ms: Date.now() - t0,
          type: res.headers['content-type'] || ''
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, function () { req.destroy(new Error('timeout')); });
  });
}

async function main() {
  var html = await get(base);
  var text = '';
  var htmlRes = await new Promise(function (resolve, reject) {
    var u = new URL(base);
    http.get(u, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () { resolve(Buffer.concat(chunks).toString('utf8')); });
    }).on('error', reject);
  });
  text = htmlRes;
  var assets = [];
  var re = /(?:src|href)="(\.\/(?:config|scripts|styles|images|core|contents|data|sites|safety|services)\/[^"]+)"/g;
  var m;
  var seen = {};
  while ((m = re.exec(text))) {
    if (seen[m[1]]) continue;
    seen[m[1]] = true;
    assets.push(m[1]);
  }
  var rows = [html];
  for (var i = 0; i < assets.length; i++) {
    try {
      rows.push(await get(new URL(assets[i], base).href));
    } catch (e) {
      rows.push({ url: assets[i], status: 0, bytes: 0, ms: 0, error: String(e.message || e) });
    }
  }
  var totalBytes = rows.reduce(function (s, r) { return s + (r.bytes || 0); }, 0);
  console.log(JSON.stringify({
    base: base,
    htmlMs: html.ms,
    htmlBytes: html.bytes,
    assetCount: assets.length,
    requestCount: rows.length,
    totalBytes: totalBytes,
    rows: rows.map(function (r) {
      return { url: r.url, status: r.status, bytes: r.bytes, ms: r.ms, error: r.error || '' };
    })
  }, null, 2));
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
