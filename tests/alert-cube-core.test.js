/**
 * アラートキューブ必須テスト（Node）
 * 実行: node tests/alert-cube-core.test.js
 */
var assert = require('assert');
var core = require('../scripts/alert-cube-core.js');

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

test('WBGT 20 → ほぼ安全・青', function () {
  var b = core.wbgtBand(20);
  assert.strictEqual(b.name, 'ほぼ安全');
  assert.strictEqual(b.colorName, '青');
  assert.strictEqual(b.bg, '#3181BD');
  assert.strictEqual(core.wbgtLevelIndex(20), 0);
});

test('WBGT 23 → 注意・水色', function () {
  var b = core.wbgtBand(23);
  assert.strictEqual(b.name, '注意');
  assert.strictEqual(b.colorName, '水色');
  assert.strictEqual(b.bg, '#67C1EA');
  assert.strictEqual(core.wbgtLevelIndex(23), 1);
});

test('WBGT 26 → 警戒・黄', function () {
  var b = core.wbgtBand(26);
  assert.strictEqual(b.name, '警戒');
  assert.strictEqual(b.colorName, '黄');
  assert.strictEqual(b.bg, '#FFEE00');
  assert.strictEqual(core.wbgtLevelIndex(26), 2);
});

test('WBGT 29 → 厳重警戒・橙', function () {
  var b = core.wbgtBand(29);
  assert.strictEqual(b.name, '厳重警戒');
  assert.strictEqual(b.colorName, '橙');
  assert.strictEqual(b.bg, '#F39800');
  assert.strictEqual(core.wbgtLevelIndex(29), 3);
});

test('WBGT 32 → 危険・赤', function () {
  var b = core.wbgtBand(32);
  assert.strictEqual(b.name, '危険');
  assert.strictEqual(b.colorName, '赤');
  assert.strictEqual(b.bg, '#ED1A3D');
  assert.strictEqual(core.wbgtLevelIndex(32), 4);
});

test('WBGT 境界 21/25/28/31', function () {
  assert.strictEqual(core.wbgtBand(20.9).name, 'ほぼ安全');
  assert.strictEqual(core.wbgtBand(21).name, '注意');
  assert.strictEqual(core.wbgtBand(24.9).name, '注意');
  assert.strictEqual(core.wbgtBand(25).name, '警戒');
  assert.strictEqual(core.wbgtBand(27.9).name, '警戒');
  assert.strictEqual(core.wbgtBand(28).name, '厳重警戒');
  assert.strictEqual(core.wbgtBand(30.9).name, '厳重警戒');
  assert.strictEqual(core.wbgtBand(31).name, '危険');
});

test('気温 32 → #D61914', function () {
  assert.strictEqual(core.temperatureBand(32).bg, '#D61914');
});
test('気温 29 → #FF7E00', function () {
  assert.strictEqual(core.temperatureBand(29).bg, '#FF7E00');
});
test('気温 26 → #FFBE2D', function () {
  assert.strictEqual(core.temperatureBand(26).bg, '#FFBE2D');
});
test('気温 23 → #FFD92D', function () {
  assert.strictEqual(core.temperatureBand(23).bg, '#FFD92D');
});
test('気温 18 → #E85A9B', function () {
  assert.strictEqual(core.temperatureBand(18).bg, '#E85A9B');
});
test('気温 12 → #36A852', function () {
  assert.strictEqual(core.temperatureBand(12).bg, '#36A852');
});
test('気温 7 → #55C7E8', function () {
  assert.strictEqual(core.temperatureBand(7).bg, '#55C7E8');
});
test('気温 3 → #3156B8', function () {
  assert.strictEqual(core.temperatureBand(3).bg, '#3156B8');
});
test('気温 -2 → #7030A0', function () {
  assert.strictEqual(core.temperatureBand(-2).bg, '#7030A0');
});

test('気温境界値', function () {
  var cases = [
    [32.0, '#D61914'], [31.0, '#D61914'], [30.9, '#FF7E00'],
    [29.0, '#FF7E00'], [28.0, '#FF7E00'], [27.9, '#FFBE2D'],
    [25.0, '#FFBE2D'], [24.9, '#FFD92D'], [21.0, '#FFD92D'],
    [20.9, '#E85A9B'], [15.0, '#E85A9B'], [14.9, '#36A852'],
    [10.0, '#36A852'], [9.9, '#55C7E8'], [5.0, '#55C7E8'],
    [4.9, '#3156B8'], [0.0, '#3156B8'], [-0.1, '#7030A0'], [-2.0, '#7030A0']
  ];
  cases.forEach(function (row) {
    assert.strictEqual(core.temperatureBand(row[0]).bg, row[1], String(row[0]));
  });
});

test('WBGT期間終了 → 気温モード', function () {
  assert.strictEqual(core.resolveSeasonMode({ apiInService: false, currentMode: core.WBGT_MODE }), core.TEMPERATURE_MODE);
});

test('翌年WBGT開始 → WBGTモード', function () {
  assert.strictEqual(core.resolveSeasonMode({ apiInService: true, currentMode: core.TEMPERATURE_MODE }), core.WBGT_MODE);
});

test('WBGT取得失敗 → モード維持（気温へ落とさない）', function () {
  assert.strictEqual(core.resolveSeasonMode({ apiInService: null, currentMode: core.WBGT_MODE }), core.WBGT_MODE);
});

test('WBGT期間中は気温で背景判定しない', function () {
  var bg = core.resolveBackground({ seasonMode: core.WBGT_MODE, wbgt: 23, temperature: 3 });
  assert.strictEqual(bg.source, 'wbgt');
  assert.strictEqual(bg.colors.bgColor, '#67C1EA');
});

test('WBGT期間外はWBGT値で背景判定しない', function () {
  var bg = core.resolveBackground({ seasonMode: core.TEMPERATURE_MODE, wbgt: 32, temperature: 12 });
  assert.strictEqual(bg.source, 'temperature');
  assert.strictEqual(bg.colors.bgColor, '#36A852');
});

test('カレンダー: 夏はWBGT、冬は気温（API不明・未初期化時）', function () {
  assert.strictEqual(core.resolveSeasonMode({
    apiInService: null,
    jstParts: { month: 8, day: 1 }
  }), core.WBGT_MODE);
  assert.strictEqual(core.resolveSeasonMode({
    apiInService: null,
    jstParts: { month: 1, day: 15 }
  }), core.TEMPERATURE_MODE);
});

test('防災取得失敗で誤解除しない', function () {
  var prev = { status: 'ok', issued: true, items: [{ kind: 'rain' }], updatedAt: 1 };
  var next = core.mergeDisasterWatch(prev, { fetchOk: false });
  assert.strictEqual(next.issued, true);
  assert.strictEqual(next.held, true);
  assert.strictEqual(next.items[0].kind, 'rain');
});

test('防災発表なし（正常）は表示しない', function () {
  var next = core.mergeDisasterWatch({ issued: true, items: [{ kind: 'rain' }] }, { fetchOk: true, items: [] });
  assert.strictEqual(next.issued, false);
  assert.strictEqual(next.items.length, 0);
});

test('台風は対象地域のみ', function () {
  assert.strictEqual(core.typhoonShouldDisplay({ fetchOk: true, exists: true, affectsSite: false }, {}), false);
  assert.strictEqual(core.typhoonShouldDisplay({ fetchOk: true, exists: true, affectsSite: true }, { jma: {} }), true);
  assert.strictEqual(core.typhoonShouldDisplay({ fetchOk: false, exists: true, affectsSite: true }, { jma: {} }), false);
});

test('再生位置は防災シーンを保存しない', function () {
  assert.strictEqual(core.capturePlayback({ sceneId: 'sceneWarn' }), null);
  var saved = core.capturePlayback({ sceneId: 'scene2', langIdx: 0, scrollX: 128 });
  assert.strictEqual(saved.sceneId, 'scene2');
  assert.strictEqual(saved.scrollX, 128);
});

test('防災優先で背景は警報色', function () {
  var bg = core.resolveBackground({
    seasonMode: core.WBGT_MODE,
    wbgt: 20,
    temperature: 10,
    alertKey: 'warning'
  });
  assert.strictEqual(bg.source, 'disaster');
  assert.strictEqual(bg.colors.bgColor, '#FA2900');
});

console.log('');
console.log(passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
