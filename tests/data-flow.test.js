/**
 * JMA / GAS / 天気アイコンを Repository 側から確認する。
 * GAS 内部は推測しない。返ってきた形だけを検証する。
 * 実行: node tests/data-flow.test.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var icons = require('../data/jma-weather-icons.js');
var site0 = require('../sites/AC-0000.json');
var site1 = require('../sites/AC-0001.json');
var lastGood = require('../config/site-config.js');

var passed = 0;
var failed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(function () {
      passed += 1;
      console.log('OK  ' + name);
    })
    .catch(function (e) {
      failed += 1;
      console.error('NG  ' + name);
      console.error('    ' + (e && e.message ? e.message : e));
    });
}

function fetchJson(url, ms) {
  var ctrl = new AbortController();
  var t = setTimeout(function () { ctrl.abort(); }, ms || 20000);
  return fetch(url, { cache: 'no-store', signal: ctrl.signal, redirect: 'follow' }).then(function (res) {
    clearTimeout(t);
    return res.text().then(function (text) {
      var json = null;
      try { json = JSON.parse(text); } catch (_) {}
      return { ok: res.ok, status: res.status, url: res.url, text: text, json: json };
    });
  }).catch(function (err) {
    clearTimeout(t);
    return { ok: false, status: 0, error: String(err && err.message || err), url: url, text: '', json: null };
  });
}

function iconFilesExist() {
  var dir = path.join(__dirname, '..', 'images', 'jma-icons');
  Object.keys(icons.PRESENT_FILES).forEach(function (code) {
    var p = path.join(dir, code + '.svg');
    assert.ok(fs.existsSync(p), 'missing ' + code + '.svg');
  });
  Object.keys(icons.ALIAS).forEach(function (code) {
    var mapped = icons.ALIAS[code];
    assert.ok(icons.PRESENT_FILES[mapped], 'alias ' + code + ' -> missing file ' + mapped);
  });
}

function lastGoodMatchesAc0001() {
  var g = global.SignageConfig || lastGood;
  assert.strictEqual(g.projectId, 'AC-0001');
  assert.strictEqual(g.moe.point, site1.moe.point);
  assert.strictEqual(g.moe.gasUrl, site1.moe.gasUrl);
  assert.strictEqual(g.jma.amedasPoint, site1.jma.amedasPoint);
  assert.strictEqual(g.jma.warnArea, site1.jma.warnArea);
  assert.strictEqual(g.site.locationLabel, site1.siteName);
  assert.strictEqual(g.schedule.items[0].work, site1.schedule.items[0].work);
}

function expectedGasShape(json) {
  if (!json || typeof json !== 'object') return { ok: false, reason: 'not-object' };
  if (json.source === 'moe-bundle' && json.wbgt) return { ok: true, kind: 'bundle' };
  if (json.current != null || json.wbgt != null || json.hourly || json.source === 'moe-wbgt') {
    return { ok: true, kind: 'wbgt' };
  }
  if (json.source === 'moe-alert') return { ok: true, kind: 'alert-only' };
  if (json.source === 'off-season' || json.inService === false) return { ok: true, kind: 'off-season' };
  return { ok: false, reason: 'unexpected-keys:' + Object.keys(json).slice(0, 12).join(',') };
}

function gasUrl(site, extra) {
  var u = new URL(site.moe.gasUrl);
  u.searchParams.set('point', site.moe.point);
  u.searchParams.set('pointName', site.moe.pointName);
  u.searchParams.set('region', site.moe.region);
  u.searchParams.set('prefecture', site.moe.prefecture);
  u.searchParams.set('alertArea', site.moe.alertArea);
  if (extra) {
    Object.keys(extra).forEach(function (k) { u.searchParams.set(k, extra[k]); });
  }
  return u.toString();
}

async function run() {
  await test('Weather Icon: 実在SVGとALIASに欠落なし', function () {
    iconFilesExist();
    assert.strictEqual(icons.resolveFile('999').file, '100');
    assert.strictEqual(icons.resolveFile('103').file, '102');
  });

  await test('AC-0001 last-good と sites/AC-0001.json は地点・工程が一致', function () {
    lastGoodMatchesAc0001();
  });

  await test('AC-0000 はテスト専用で工程が検証A、顧客名なし', function () {
    assert.strictEqual(site0.status, 'test');
    assert.strictEqual(site0.customer, '');
    assert.strictEqual(site0.schedule.items[0].work, '検証A');
    assert.strictEqual(site0.moe.point, site1.moe.point);
  });

  var jmaFc = await fetchJson('https://www.jma.go.jp/bosai/forecast/data/forecast/' + site1.jma.forecastArea + '.json');
  await test('Weather: JMA予報JSONを取得できる', function () {
    assert.ok(jmaFc.ok, 'HTTP ' + jmaFc.status + ' ' + (jmaFc.error || ''));
    assert.ok(Array.isArray(jmaFc.json), 'forecast is array');
    assert.ok(jmaFc.json[0] && (jmaFc.json[0].timeSeries || jmaFc.json[0].publishingOffice));
  });

  var jmaWarn = await fetchJson('https://www.jma.go.jp/bosai/warning/data/warning/' + site1.jma.warnArea + '.json');
  await test('Warning: JMA警報JSONを取得できる', function () {
    assert.ok(jmaWarn.ok, 'HTTP ' + jmaWarn.status + ' ' + (jmaWarn.error || ''));
    assert.ok(jmaWarn.json && (jmaWarn.json.areaTypes || jmaWarn.json.headlineText != null || jmaWarn.json.reportDatetime));
  });

  var jmaTy = await fetchJson('https://www.jma.go.jp/bosai/typhoon/data/targetTc.json');
  await test('Typhoon: JMA台風リストを取得できる（空配列も正常）', function () {
    assert.ok(jmaTy.ok, 'HTTP ' + jmaTy.status + ' ' + (jmaTy.error || ''));
    assert.ok(jmaTy.json == null || Array.isArray(jmaTy.json) || typeof jmaTy.json === 'object');
  });

  var gasPoint = await fetchJson(gasUrl(site1));
  var gasBundle = await fetchJson(gasUrl(site1, { type: 'bundle' }));
  await test('GAS: Endpointへ接続し Response を得られる', function () {
    assert.ok(gasPoint.ok || gasBundle.ok, 'point=' + gasPoint.status + ' bundle=' + gasBundle.status + ' err=' + (gasPoint.error || gasBundle.error || ''));
    var used = gasBundle.json || gasPoint.json;
    assert.ok(used, 'JSON parse failed. head=' + String(gasPoint.text || gasBundle.text).slice(0, 180));
    var shape = expectedGasShape(used);
    assert.ok(shape.ok, shape.reason);
    console.log('    GAS shape=' + shape.kind + ' keys=' + Object.keys(used).join(','));
  });

  await test('GAS 失敗時: 不正URLは ok=false になり Fallback 判定できる', function () {
    return fetchJson('https://script.google.com/macros/s/invalid-alert-cube-probe/exec', 8000).then(function (bad) {
      assert.strictEqual(bad.ok, false);
    });
  });

  console.log('');
  console.log(passed + ' passed, ' + failed + ' failed');
  if (failed) process.exit(1);
}

run();
