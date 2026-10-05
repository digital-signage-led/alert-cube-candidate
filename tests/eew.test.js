/**
 * 緊急地震速報（警報）の対象判定と、地震情報・津波への遷移
 * 実行: node tests/eew.test.js
 */
var assert = require('assert');
require('../contents/registry.js');
var eew = require('../contents/eew/evaluate.js');
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
var OSAKA = {
  projectId: 'AC-0000',
  moe: { alertArea: '大阪府' },
  jma: { warnArea: '270000', warnCity: '2710000', warnCityLabel: '大阪市', forecastLabel: '大阪市' }
};
var SETTINGS = hazard.settingsFrom({
  hazard: { minIntensity: '5弱', earthquakeVisibleMinutes: 30, faceMs: 4000 }
});

function report(partial) {
  return Object.assign({
    code: 556,
    test: false,
    cancelled: false,
    earthquake: { originTime: '2026/09/29 11:59:40' },
    issue: { time: '2026/09/29 11:59:50', eventId: '20260929115940', serial: '1' },
    areas: [{ pref: '大阪府', name: '大阪市' }]
  }, partial || {});
}

function linesOf(presentation) {
  return presentation.frames.map(function (frame) { return frame.lines.slice(); });
}

test('256×128の文言は2画面だけで、行動は身を守る', function () {
  var view = hazard.present([hazard.previewAlert('eew')], OSAKA, SETTINGS, '128');
  assert.strictEqual(view.kind, 'eew');
  assert.strictEqual(view.layout, '256');
  assert.deepStrictEqual(linesOf(view), [
    ['緊急地震速報', '強い揺れに警戒'],
    ['身を守る']
  ]);
  assert.ok(view.faceMs <= 3000);
  assert.strictEqual(view.bg, '#FA2900');
  assert.strictEqual(view.ink, '#ffffff');
  var text = linesOf(view).join('');
  assert.ok(text.indexOf('落下物') < 0);
  assert.ok(text.indexOf('震度') < 0);
  assert.ok(eew.linePx('強い揺れに警戒', 2) >= 34);
  assert.ok(eew.linePx('緊急地震速報', 2) > eew.linePx('強い揺れに警戒', 2));
  assert.ok(eew.linePx('身を守る', 1) >= 60);
});

test('警報の対象地域だけに出し、予報や他県や取消は出さない', function () {
  var hit = eew.parseReports([report()], OSAKA, SETTINGS, NOW);
  assert.strictEqual(hit.length, 1);
  assert.strictEqual(hit[0].kind, 'eew');
  assert.deepStrictEqual(eew.parseReports([
    report({ areas: [{ pref: '京都府', name: '南部' }] })
  ], OSAKA, SETTINGS, NOW), []);
  assert.deepStrictEqual(eew.parseReports([
    report({ areas: [{ pref: '大阪府', name: '泉州' }] })
  ], OSAKA, SETTINGS, NOW), []);
  assert.deepStrictEqual(eew.parseReports([
    report({ cancelled: true })
  ], OSAKA, SETTINGS, NOW), []);
  assert.deepStrictEqual(eew.parseReports([
    report({ test: true })
  ], OSAKA, SETTINGS, NOW), []);
  assert.deepStrictEqual(eew.parseReports([
    report({ code: 551 })
  ], OSAKA, SETTINGS, NOW), []);
  assert.deepStrictEqual(eew.parseReports([
    report({ issue: { time: '2026/09/29 11:50:00', eventId: 'old', serial: '3' } })
  ], OSAKA, SETTINGS, NOW), []);
  assert.deepStrictEqual(eew.parseReports([
    report({ areas: [] })
  ], OSAKA, SETTINGS, NOW), []);
});

test('取消報が新しい場合は出さない', function () {
  var list = [
    report({ issue: { time: '2026/09/29 11:59:55', eventId: '20260929115940', serial: '2' }, cancelled: true }),
    report()
  ];
  assert.deepStrictEqual(eew.parseReports(list, OSAKA, SETTINGS, NOW), []);
});

test('市区が無い案件は府県が一致すれば対象', function () {
  var site = {
    moe: { alertArea: '北海道' },
    jma: { warnArea: '010000', warnCity: '', warnCityLabel: '', forecastLabel: '' }
  };
  var hit = eew.parseReports([
    report({ areas: [{ pref: '北海道道北', name: '上川地方北部' }] })
  ], site, SETTINGS, NOW);
  assert.strictEqual(hit.length, 1);
});

test('緊急地震速報のあと観測震度へ移り、津波が優先する', function () {
  var warning = eew.parseReports([report()], OSAKA, SETTINGS, NOW)[0];
  var only = hazard.present([warning], OSAKA, SETTINGS, '128');
  assert.strictEqual(only.kind, 'eew');
  var quake = {
    id: 'earthquake:1',
    kind: 'earthquake',
    group: 'earthquake',
    genre: 'quake',
    intensity: '5弱',
    at: Date.parse('2026-09-29T11:59:40+09:00')
  };
  var after = hazard.present([warning, quake], OSAKA, SETTINGS, '128');
  assert.strictEqual(after.kind, 'earthquake');
  assert.strictEqual(after.frames.map(function (frame) { return frame.lines.join(''); }).join('|'), '地震発生|震度5弱');
  var older = Object.assign({}, quake, { at: Date.parse('2026-09-29T11:20:00+09:00') });
  assert.strictEqual(hazard.present([warning, older], OSAKA, SETTINGS, '128').kind, 'eew');
  var tsunami = hazard.previewAlert('tsunami-warning');
  assert.strictEqual(hazard.present([warning, tsunami], OSAKA, SETTINGS, '128').kind, 'tsunami-warning');
  assert.strictEqual(hazard.present([warning, quake, tsunami], OSAKA, SETTINGS, '128').kind, 'tsunami-warning');
  var custom = hazard.settingsFrom({
    hazard: { priorities: { eew: 90, 'tsunami-warning': 10 } }
  });
  assert.strictEqual(hazard.present([warning, tsunami], OSAKA, custom, '128').kind, 'eew');
});

test('取得失敗は緊急表示を維持し、解除確認で通常へ戻す', function () {
  var warning = eew.parseReports([report()], OSAKA, SETTINGS, NOW);
  var active = hazard.resolveWatch(null, {
    quakeOk: true,
    warningOk: true,
    eewOk: true,
    quakeAlerts: [],
    waterAlerts: [],
    eewAlerts: warning,
    site: OSAKA,
    settings: SETTINGS,
    layout: '256'
  });
  assert.strictEqual(active.presentation.kind, 'eew');
  var held = hazard.resolveWatch(active, { quakeOk: false, warningOk: false, eewOk: false });
  assert.strictEqual(held.held, true);
  assert.strictEqual(held.presentation.kind, 'eew');
  var cleared = hazard.resolveWatch(held, {
    quakeOk: true,
    warningOk: true,
    eewOk: true,
    quakeAlerts: [],
    waterAlerts: [],
    eewAlerts: [],
    site: OSAKA,
    settings: SETTINGS,
    layout: '256'
  });
  assert.strictEqual(cleared.presentation, null);
});

test('未設定の本番案件はOFF、AC-0000だけON', function () {
  var prod = require('../sites/AC-0001.json');
  assert.strictEqual(foundation.isContentOn(prod, 'eew'), false);
  var merged = foundation.mergeJsonOntoLegacy(prod, { site: {} });
  assert.strictEqual(merged.contents.eew.on, false);
  var testSite = require('../sites/AC-0000.json');
  assert.strictEqual(testSite.contents.eew.on, true);
  assert.strictEqual(foundation.isContentOn(testSite, 'eew'), true);
  assert.ok(testSite.contentOrder.indexOf('eew') < 0);
  var template = require('../sites/_template.json');
  assert.strictEqual(template.contents.eew.on, false);
  assert.ok(SETTINGS.priorities['tsunami-advisory'] > SETTINGS.priorities.eew);
  assert.ok(SETTINGS.priorities.eew > SETTINGS.priorities.earthquake);
});

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log(passed + ' passed');
