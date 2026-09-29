/**
 * 見守り伝書鳩の最新JSONと、宮川興業の公式ニュースを同じ端末へ返す。
 * ブラウザはこれらのサイトを直接読めないため、表示確認はこの口を使う。
 * 転送先は densho-bato.com と www.miyagawa-a2.co.jp の /news だけ。
 */
var http = require('http');
var https = require('https');
var densho = require('../services/densho/index.js');

var port = Number(process.env.DENSHO_PROXY_PORT) || 3213;

function allowedNewsPageUrl(raw) {
  var u;
  try { u = new URL(String(raw || '')); } catch (e) { return false; }
  if (u.protocol !== 'https:' || u.username || u.password) return false;
  if (u.hostname !== 'www.miyagawa-a2.co.jp') return false;
  return u.pathname === '/news' || u.pathname.indexOf('/news/') === 0;
}

var server = http.createServer(function (req, res) {
  var url = new URL(req.url, 'http://127.0.0.1:' + port);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  var newsPage = url.pathname === '/page';
  if (url.pathname !== '/densho' && url.pathname !== '/api/densho/latest' && !newsPage) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }
  var src = url.searchParams.get('src') || '';
  if (newsPage ? !allowedNewsPageUrl(src) : !densho.allowedApiUrl(src)) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(newsPage ? '公式ニュース以外は転送しない' : 'densho-bato.com 以外は転送しない');
    return;
  }
  https.get(src, function (upstream) {
    var chunks = [];
    upstream.on('data', function (chunk) { chunks.push(chunk); });
    upstream.on('end', function () {
      var body = Buffer.concat(chunks);
      var type = newsPage
        ? (upstream.headers['content-type'] || 'text/html; charset=utf-8')
        : 'application/json; charset=utf-8';
      res.writeHead(upstream.statusCode || 502, {
        'Content-Type': type,
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(body);
    });
  }).on('error', function (err) {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(String(err && err.message || err));
  });
});

server.listen(port, '127.0.0.1', function () {
  console.log('[densho-proxy] http://127.0.0.1:' + port + '/densho');
});
