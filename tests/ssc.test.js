/**
 * 環境クラウド SSC の値整形
 * 実行: node tests/ssc.test.js
 */
var assert = require('assert');
var ssc = require('../contents/ssc/index.js');

var passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log('OK  ' + name);
}

test('dB は小数1桁', function () {
  assert.strictEqual(ssc.formatDb(62), '62.0');
  assert.strictEqual(ssc.formatDb(61.26), '61.3');
  assert.strictEqual(ssc.formatDb(''), null);
  assert.strictEqual(ssc.formatDb(null), null);
});

test('SSCNumData の行を騒音・振動にする', function () {
  var vals = ssc.rowToValues({
    RNSoVal: 55.24,
    RNShVal: 40,
    Time: '20261006131900'
  });
  assert.strictEqual(vals.noise, '55.2');
  assert.strictEqual(vals.vibration, '40.0');
  assert.strictEqual(vals.time, '2026/10/06 13:19:00');
  assert.strictEqual(vals.pending, false);
});

test('取得 URL は SSCNumData/{idNum}?r=', function () {
  assert.strictEqual(
    ssc.dataUrl(2526, { cacheBust: '1' }),
    'https://www2.edam.ne.jp/Json/SSCNumData/2526?r=1'
  );
});

test('GAS の data 配列も騒音・振動にする', function () {
  var vals = ssc.rowFromPayload({
    source: 'edam-ssc',
    idNum: '2526',
    data: [{ RNSoVal: 64.3, RNShVal: 41.4, Time: '20261009091511' }]
  });
  assert.strictEqual(vals.noise, '64.3');
  assert.strictEqual(vals.vibration, '41.4');
  assert.strictEqual(vals.time, '2026/10/09 09:15:11');
});

test('LoID 未設定は 0。?sscId= が設定より先', function () {
  assert.strictEqual(ssc.resolveId({ idNum: null, loId: null }, { get: function () { return ''; } }), 0);
  assert.strictEqual(ssc.resolveId({ idNum: '738' }, null), 738);
  assert.strictEqual(ssc.resolveId({ idNum: '738' }, { get: function (k) { return k === 'sscId' ? '12' : ''; } }), 12);
});

test('未設定の下帯は取得中（URL設定待ち）', function () {
  var line = ssc.metaLine({ siteName: '中部作業所', sensorLabel: '騒音振動計' }, ssc.pendingValues(), false);
  assert.ok(line.indexOf('中部作業所／騒音振動計') === 0);
  var blank = ssc.metaLine({ siteName: '', sensorLabel: '騒音振動計' }, ssc.pendingValues(), false);
  assert.ok(blank.indexOf('騒音振動計') === 0);
  assert.ok(blank.indexOf('中部作業所') < 0);
  assert.ok(line.indexOf('取得中（URL設定待ち）') >= 0);
  assert.ok(line.indexOf('出典：環境クラウドサービス') >= 0);
});

console.log(passed + ' passed');
