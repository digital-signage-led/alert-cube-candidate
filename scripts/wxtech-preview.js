/**
 * 静的サイトと WxTech 中継を同じ口で出す。
 * APIキーは環境変数 WXTECH_API_KEY か、gitignore 済みの .env だけから読む。
 * 応答・ログ・HTML には出さない。
 *
 * 取得間隔の初期値は 300000ms（暫定）。仕様書は5分刻みの予報と秒間50リクエストを書いており、
 * データの更新間隔は書いていない。
 */
var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');

var root = path.resolve(__dirname, '..');
var port = Number(process.env.PORT) || 3200;
var PROVISIONAL_REFRESH_MS = 300000;
var UPSTREAM = 'https://wxtech.weathernews.com/api/v1/ss1wx/kakuho';

function loadEnvFile() {
  var file = path.join(root, '.env');
  if (!fs.existsSync(file)) return;
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach(function (line) {
    var m = /^([A-Za-z0-9_]+)=(.*)$/.exec(line);
    if (!m || process.env[m[1]]) return;
    process.env[m[1]] = m[2];
  });
}

function refreshMs() {
  var n = Number(process.env.WXTECH_REFRESH_MS);
  if (!Number.isFinite(n) || n < 60000 || n > 3600000) return PROVISIONAL_REFRESH_MS;
  return Math.floor(n);
}

function cacheKey(lat, lon) {
  return (Math.round(lat * 10000) / 10000).toFixed(4) + ',' + (Math.round(lon * 10000) / 10000).toFixed(4);
}

loadEnvFile();
var cache = new Map();
var pending = new Map();

function freshHit(key) {
  var hit = cache.get(key);
  if (!hit) return null;
  if (hit.freshUntil <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.body;
}

function upstream(lat, lon) {
  var key = process.env.WXTECH_API_KEY || '';
  if (!key) return Promise.resolve({ ok: false, error: 'not-configured' });
  var target = UPSTREAM + '?lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lon);
  return new Promise(function (resolve) {
    var req = https.request(target, {
      method: 'GET',
      family: 4,
      timeout: 15000,
      headers: { 'X-API-Key': key, 'Accept': 'application/json' }
    }, function (res) {
      var chunks = [];
      res.on('data', function (chunk) { chunks.push(chunk); });
      res.on('end', function () {
        var text = Buffer.concat(chunks).toString('utf8');
        var json = null;
        try { json = JSON.parse(text); } catch (e) { json = null; }
        if (!json || res.statusCode !== 200 || (json.errors && json.errors.length)) {
          console.log('[wxtech] upstream', res.statusCode || 0);
          resolve({ ok: false, error: 'unavailable' });
          return;
        }
        var now = Date.now();
        var ms = refreshMs();
        var rows = json.wxdata && json.wxdata[0] && json.wxdata[0].data;
        console.log('[wxtech] upstream 200 slots', Array.isArray(rows) ? rows.length : 0);
        resolve({
          ok: true,
          fetchedAt: new Date(now).toISOString(),
          freshUntil: new Date(now + ms).toISOString(),
          refreshMs: ms,
          refreshBasis: 'provisional',
          requestId: json.requestId || '',
          wxdata: json.wxdata
        });
      });
    });
    req.on('timeout', function () { req.destroy(); });
    req.on('error', function () {
      console.log('[wxtech] upstream failed');
      resolve({ ok: false, error: 'unavailable' });
    });
    req.end();
  });
}

function forecast(lat, lon) {
  var key = cacheKey(lat, lon);
  var hit = freshHit(key);
  if (hit) return Promise.resolve(hit);
  if (pending.has(key)) return pending.get(key);
  var work = upstream(lat, lon).then(function (body) {
    pending.delete(key);
    if (body && body.ok) cache.set(key, { freshUntil: Date.parse(body.freshUntil), body: body });
    return body;
  });
  pending.set(key, work);
  return work;
}

var TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function send(res, status, body, type) {
  res.writeHead(status, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function serveStatic(reqPath, res) {
  var decoded = decodeURIComponent(reqPath.split('?')[0]);
  if (decoded === '/') decoded = '/index.html';
  var rel = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  var file = path.resolve(root, '.' + rel);
  if (file !== root && file.indexOf(root + path.sep) !== 0) {
    send(res, 403, 'forbidden');
    return;
  }
  var base = path.basename(file);
  if (base === '.env' || base.indexOf('.env.') === 0) {
    send(res, 404, 'not found');
    return;
  }
  fs.stat(file, function (err, stat) {
    if (err || !stat.isFile()) {
      send(res, 404, 'not found');
      return;
    }
    var type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
}

var server = http.createServer(function (req, res) {
  var parsed = new URL(req.url, 'http://127.0.0.1:' + port);
  if (req.method !== 'GET') {
    send(res, 405, 'method');
    return;
  }
  if (parsed.pathname === '/api/wxtech/kakuho') {
    var lat = Number(parsed.searchParams.get('lat'));
    var lon = Number(parsed.searchParams.get('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      send(res, 400, JSON.stringify({ ok: false, error: 'latlon' }), 'application/json; charset=utf-8');
      return;
    }
    forecast(lat, lon).then(function (body) {
      send(res, 200, JSON.stringify(body), 'application/json; charset=utf-8');
    });
    return;
  }
  serveStatic(parsed.pathname, res);
});

server.listen(port, '127.0.0.1', function () {
  console.log('[wxtech-preview] http://127.0.0.1:' + port + '/');
  console.log('[wxtech-preview] refreshMs', refreshMs(), 'basis provisional');
  if (!process.env.WXTECH_API_KEY) console.log('[wxtech-preview] WXTECH_API_KEY is not set');
});
