/**
 * 地震・津波・水害の割り込み判定
 * 実行: node tests/hazard.test.js
 */
var assert = require('assert');
require('../contents/registry.js');
var hazard = require('../contents/hazard/evaluate.js');
var foundation = require('../core/foundation.js');

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('OK  ' + name);
  } catch (e) {
    failed += 1;
    console.error('NG  ' + name);
    console.error('    ' + (e && e.message ? e.message : e));
  }
}

var NOW = Date.parse('2026-09-29T12:00:00+09:00');
var SITE = {
  warnArea: '270000',
  warnCity: '2710000',
  prefCode: '27',
  elevation: 3.2,
  expectedDepthM: null,
  shelterName: ''
};
var SETTINGS = hazard.settingsFrom({
  hazard: { minIntensity: '5弱', earthquakeVisibleMinutes: 30, faceMs: 4000 }
});

function quake(at, pref, maxi, city) {
  var row = { code: pref, maxi: maxi, city: city || [] };
  return { at: at, ttl: '震源・震度情報', int: [row] };
}

function linesOf(presentation) {
  return presentation.frames.map(function (frame) { return frame.lines.join(''); });
}

function textOf(presentation) {
  return linesOf(presentation).join('|');
}

test('震度5弱未満と対象外の地震は割り込まない', function () {
  var list = [
    quake('2026-09-29T11:50:00+09:00', '27', '4'),
    quake('2026-09-29T11:50:00+09:00', '08', '7'),
    quake('2026-09-29T10:00:00+09:00', '27', '6-')
  ];
  assert.deepStrictEqual(hazard.parseQuakes(list, SITE, SETTINGS, NOW), []);
});

test('設置市の震度が基準以上のときだけ地震を出す', function () {
  var list = [
    quake('2026-09-29T11:50:00+09:00', '27', '5-', [{ code: '2710000', maxi: '3' }]),
    quake('2026-09-29T11:40:00+09:00', '27', '4', [{ code: '2710000', maxi: '5+' }])
  ];
  var alerts = hazard.parseQuakes(list, SITE, SETTINGS, NOW);
  assert.strictEqual(alerts.length, 1);
  assert.strictEqual(alerts[0].intensity, '5強');
  var view = hazard.present(alerts, SITE, SETTINGS, '128');
  assert.strictEqual(textOf(view), '地震発生|震度5強');
  assert.ok(textOf(view).indexOf('海抜') < 0);
});

test('地震だけでは津波にも海抜にも切り替わらない', function () {
  var alerts = hazard.parseQuakes([
    quake('2026-09-29T11:55:00+09:00', '27', '5-')
  ], SITE, SETTINGS, NOW);
  var view = hazard.present(alerts, SITE, SETTINGS, '128');
  assert.strictEqual(view.kind, 'earthquake');
  assert.ok(textOf(view).indexOf('津波') < 0);
  assert.ok(textOf(view).indexOf('海抜') < 0);
});

test('津波警報は地震より優先し、注意報と文言を分ける', function () {
  var quakes = hazard.parseQuakes([
    quake('2026-09-29T11:55:00+09:00', '27', '5-')
  ], SITE, SETTINGS, NOW);
  var warnings = hazard.parseWarnings({
    areaTypes: [{ areas: [{ code: '2710000', warnings: [
      { code: '29', status: '発表' },
      { code: '11', status: '発表' }
    ] }] }]
  }, SITE, SETTINGS);
  var view = hazard.present(quakes.concat(warnings), SITE, SETTINGS, '128');
  assert.strictEqual(view.kind, 'tsunami-warning');
  assert.deepStrictEqual(linesOf(view), ['津波警報', 'すぐ避難', '海・川から離れる', '高い場所へ']);
  assert.strictEqual(view.sync, true);
  var advisory = hazard.present(warnings.filter(function (a) { return a.kind === 'tsunami-advisory'; }), SITE, SETTINGS, '128');
  assert.ok(textOf(advisory).indexOf('海から離れる') >= 0);
  assert.ok(textOf(advisory).indexOf('すぐ避難') < 0);
});

test('大津波警報が最優先で、128では海抜より行動を先にする', function () {
  var warnings = hazard.parseWarnings({
    areaTypes: [{ areas: [
      { code: '270000', warnings: [{ code: '34', status: '発表' }, { code: '11', status: '継続' }] },
      { code: '9999999', warnings: [{ code: '04', status: '発表' }] }
    ] }]
  }, SITE, SETTINGS);
  var view = hazard.present(warnings, SITE, SETTINGS, '128');
  assert.strictEqual(view.kind, 'tsunami-major');
  assert.ok(textOf(view).indexOf('海抜') < 0);
  assert.ok(textOf(view).indexOf('安全') < 0);
  assert.ok(textOf(view).indexOf('危険') < 0);
  var wide = hazard.present(warnings, SITE, SETTINGS, '256');
  assert.ok(linesOf(wide)[0].indexOf('大津波警報') >= 0);
  assert.ok(textOf(wide).indexOf('海抜3.2m') >= 0);
  assert.ok(textOf(wide).indexOf('海抜3.2m') > textOf(wide).indexOf('高い場所へ避難'));
});

test('解除済みと他県の洪水では出さない', function () {
  var cleared = hazard.parseWarnings({
    areaTypes: [{ areas: [{ code: '2710000', warnings: [{ code: '11', status: '解除' }] }] }]
  }, SITE, SETTINGS);
  assert.deepStrictEqual(cleared, []);
  var otherCity = hazard.parseWarnings({
    areaTypes: [{ areas: [{ code: '2721000', warnings: [{ code: '04', status: '発表' }] }] }]
  }, SITE, SETTINGS);
  assert.deepStrictEqual(otherCity, []);
});

test('空の海抜と想定浸水深は0mとして出さない', function () {
  assert.strictEqual(hazard.formatMeters(null), '');
  assert.strictEqual(hazard.formatMeters(''), '');
  assert.strictEqual(hazard.formatMeters(0), '0m');
  var view = hazard.present([hazard.previewAlert('tsunami-warning')], SITE, SETTINGS, '256');
  assert.ok(textOf(view).indexOf('想定浸水深') < 0);
  assert.ok(textOf(view).indexOf('海抜3.2m') >= 0);
});

test('海抜と想定浸水深は別情報で、判定文を作らない', function () {
  var site = Object.assign({}, SITE, { expectedDepthM: 2, shelterName: '北岸公園' });
  var alert = hazard.previewAlert('flood-warning');
  var wide = hazard.present([alert], site, SETTINGS, '256');
  var text = textOf(wide);
  assert.ok(text.indexOf('海抜3.2m') >= 0);
  assert.ok(text.indexOf('想定浸水深2m') >= 0);
  assert.ok(text.indexOf('北岸公園') >= 0);
  assert.ok(text.indexOf('安全') < 0);
  assert.ok(text.indexOf('危険') < 0);
  assert.notStrictEqual(String(site.elevation), String(site.expectedDepthM));
  var small = hazard.present([alert], site, SETTINGS, '128');
  assert.ok(textOf(small).indexOf('想定浸水深') < 0);
  assert.ok(textOf(small).indexOf('北岸公園') < 0);
});

test('取得失敗は直前の緊急表示を維持し、解除確認で戻す', function () {
  var active = hazard.resolveWatch(null, {
    quakeOk: true,
    warningOk: true,
    quakeAlerts: [],
    waterAlerts: [hazard.previewAlert('tsunami-warning')],
    site: SITE,
    settings: SETTINGS,
    layout: '128'
  });
  assert.strictEqual(active.presentation.kind, 'tsunami-warning');
  var held = hazard.resolveWatch(active, { quakeOk: false, warningOk: false });
  assert.strictEqual(held.held, true);
  assert.strictEqual(held.presentation.kind, 'tsunami-warning');
  var cleared = hazard.resolveWatch(held, {
    quakeOk: true,
    warningOk: true,
    quakeAlerts: [],
    waterAlerts: [],
    site: SITE,
    settings: SETTINGS,
    layout: '128'
  });
  assert.strictEqual(cleared.presentation, null);
});

test('優先度は案件設定で入れ替えできる', function () {
  var custom = hazard.settingsFrom({
    hazard: { priorities: { 'tsunami-advisory': 90, 'tsunami-warning': 10 } }
  });
  var alerts = [
    hazard.previewAlert('tsunami-advisory'),
    hazard.previewAlert('tsunami-warning')
  ];
  assert.strictEqual(hazard.present(alerts, SITE, custom, '128').kind, 'tsunami-advisory');
});

test('未設定の本番案件はOFF、AC-0000だけON', function () {
  var prod = require('../sites/AC-0001.json');
  assert.strictEqual(foundation.isContentOn(prod, 'hazard'), false);
  var merged = foundation.mergeJsonOntoLegacy(prod, { site: {} });
  assert.strictEqual(merged.contents.hazard.on, false);
  var testSite = require('../sites/AC-0000.json');
  assert.strictEqual(testSite.contents.hazard.on, true);
  assert.strictEqual(testSite.elevation, 3.2);
  assert.strictEqual(testSite.inundation.expectedDepthM, null);
  var merged0 = foundation.mergeJsonOntoLegacy(testSite, { site: {} });
  assert.strictEqual(merged0.elevation, 3.2);
  assert.strictEqual(merged0.geo.lat, testSite.latitude);
  assert.strictEqual(merged0.geo.lon, testSite.longitude);
  assert.ok(merged0.hazard.priorities['tsunami-major'] > merged0.hazard.priorities['tsunami-warning']);
  assert.ok(merged0.hazard.priorities['tsunami-warning'] > merged0.hazard.priorities['tsunami-advisory']);
  assert.ok(merged0.hazard.priorities['tsunami-advisory'] > merged0.hazard.priorities.eew);
  assert.ok(merged0.hazard.priorities.eew > merged0.hazard.priorities.earthquake);
  assert.strictEqual(foundation.isContentOn(testSite, 'hazard'), true);
  assert.ok(testSite.contentOrder.indexOf('hazard') < 0);
});

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log(passed + ' passed');
