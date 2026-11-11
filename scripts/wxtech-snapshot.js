/**
 * 公開ページ用の短時間予報を1地点分書く。
 * APIキーは環境変数 WXTECH_API_KEY か、gitignore 済みの .env だけから読む。
 * 応答ファイル・ログには出さない。
 *
 * 公開ページの期限は45分。取得は10分ごとで、反映が遅れても1回分は残す。
 * 45分を過ぎたファイルは画面側で「取得できません」になる。
 */
var https = require('https');
var fs = require('fs');
var path = require('path');

var root = path.resolve(__dirname, '..');
var HOLD_MS = 45 * 60 * 1000;
var OUT = path.join(root, 'assets', 'demo', 'DM-0008', 'wxtech-latest.json');
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

loadEnvFile();

var site = JSON.parse(fs.readFileSync(path.join(root, 'demo', 'DM-0008.json'), 'utf8'));
var lat = Number(site.latitude);
var lon = Number(site.longitude);
var key = process.env.WXTECH_API_KEY || '';
if (!key || !Number.isFinite(lat) || !Number.isFinite(lon)) {
  console.log('[wxtech-snapshot] not configured');
  process.exit(1);
}

var target = UPSTREAM + '?lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lon);
var req = https.request(target, {
  method: 'GET',
  family: 4,
  timeout: 15000,
  headers: { 'X-API-Key': key, 'Accept': 'application/json' }
}, function (res) {
  var chunks = [];
  res.on('data', function (chunk) { chunks.push(chunk); });
  res.on('end', function () {
    var json = null;
    try { json = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { json = null; }
    var rows = json && json.wxdata && json.wxdata[0] && json.wxdata[0].data;
    if (!json || res.statusCode !== 200 || (json.errors && json.errors.length) || !Array.isArray(rows)) {
      console.log('[wxtech-snapshot] upstream', res.statusCode || 0);
      process.exit(1);
    }
    var now = Date.now();
    var body = {
      ok: true,
      fetchedAt: new Date(now).toISOString(),
      freshUntil: new Date(now + HOLD_MS).toISOString(),
      refreshMs: 600000,
      refreshBasis: 'published',
      wxdata: json.wxdata
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(body, null, 2) + '\n');
    console.log('[wxtech-snapshot] slots', rows.length);
    process.exit(0);
  });
});
req.on('timeout', function () { req.destroy(); });
req.on('error', function () {
  console.log('[wxtech-snapshot] upstream failed');
  process.exit(1);
});
req.end();
