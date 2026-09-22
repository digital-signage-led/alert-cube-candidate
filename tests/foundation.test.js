/**
 * 共通基盤テスト
 * 実行: node tests/foundation.test.js
 */
var assert = require('assert');
var core = require('../scripts/alert-cube-core.js');
var icons = require('../data/jma-weather-icons.js');
var registry = require('../contents/registry.js');
var foundation = require('../core/foundation.js');
var version = require('../safety/version.js');
var remote = require('../services/remote.js');
var modules = require('../contents/modules.js');
var typhoonSvc = require('../services/typhoon/index.js');
var rollback = require('../safety/rollback.js');

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

test('既存コア: 気温9段階は維持', function () {
  assert.strictEqual(core.temperatureBand(32).bg, '#D61914');
  assert.strictEqual(core.temperatureBand(-2).bg, '#7030A0');
});

test('既存コア: WBGT本番色は維持（プロンプト色へ置換しない）', function () {
  assert.strictEqual(core.wbgtBand(20).bg, '#3181BD');
  assert.strictEqual(core.wbgtBand(23).bg, '#67C1EA');
  assert.strictEqual(core.wbgtBand(26).bg, '#FFEE00');
  assert.strictEqual(core.wbgtBand(29).bg, '#F39800');
  assert.strictEqual(core.wbgtBand(32).bg, '#ED1A3D');
});

test('天気コード: 気象庁公式アイコンへ解決', function () {
  assert.strictEqual(icons.resolveFile('100').file, '100');
  assert.strictEqual(icons.resolveFile('414').file, '414');
  assert.strictEqual(icons.resolveFile(101).unknown, false);
});

test('天気コード: 別名は気象庁公式アイコンへ寄せる', function () {
  assert.strictEqual(icons.resolveFile('103').file, '102');
  assert.strictEqual(icons.resolveFile('450').file, '400');
});

test('天気コード: 未知でも停止せず fallback 100', function () {
  var r = icons.resolveFile('999');
  assert.strictEqual(r.file, '100');
  assert.strictEqual(r.unknown, true);
  assert.strictEqual(icons.href('not-a-code'), 'https://www.jma.go.jp/bosai/forecast/img/100.svg');
});

test('案件ID: 空は AC-0001、不正は fallback', function () {
  assert.strictEqual(foundation.resolveSiteId('').siteId, 'AC-0001');
  assert.strictEqual(foundation.resolveSiteId('?site=AC-0001').siteId, 'AC-0001');
  var bad = foundation.resolveSiteId('?site=osaka');
  assert.strictEqual(bad.siteId, 'AC-0001');
  assert.strictEqual(bad.valid, false);
});

test('設定Validation: 壊れても例外にしない', function () {
  var v = foundation.validateSiteConfig(null);
  assert.strictEqual(v.ok, false);
  var v2 = foundation.validateSiteConfig({ projectId: 'AC-0001', resolution: '512x128', contents: {} });
  assert.strictEqual(v2.ok, true);
});

test('ON/OFF: OFFはfetchしない。OFFは削除ではない', function () {
  var cfg = foundation.applyContentsDefaults({
    projectId: 'AC-0001',
    contents: { typhoon: { on: false }, weather: { on: true } }
  });
  assert.strictEqual(foundation.isContentOn(cfg, 'typhoon'), false);
  assert.strictEqual(foundation.isContentOn(cfg, 'weather'), true);
  assert.strictEqual(foundation.neededFetches(cfg).indexOf('jma-typhoon') >= 0, false);
  assert.strictEqual(foundation.neededFetches(cfg).indexOf('jma-forecast') >= 0, true);
  assert.ok(registry.byId('typhoon'));
});

test('安全系の明示OFFが季節より優先', function () {
  var cfg = foundation.applyContentsDefaults({
    contents: { warning: { on: false }, wbgt: { on: true } }
  });
  assert.strictEqual(foundation.isContentOn(cfg, 'warning', { hideSeasonal: false }), false);
  assert.strictEqual(foundation.isContentOn(cfg, 'wbgt', { hideSeasonal: false }), true);
});

test('花粉・PM2.5 は未実装のまま OFF', function () {
  var cfg = foundation.applyContentsDefaults({ contents: {} });
  assert.strictEqual(foundation.isContentOn(cfg, 'pollen'), false);
  assert.strictEqual(foundation.isContentOn(cfg, 'pm25'), false);
  assert.strictEqual(registry.byId('pollen').existing, false);
});

test('障害隔離: 1コンテンツ例外で全体を止めない', function () {
  var out = foundation.isolate('typhoon', function () { throw new Error('boom'); }, 'held');
  assert.strictEqual(out, 'held');
  var ok = foundation.isolate('weather', function () { return 1; }, 0);
  assert.strictEqual(ok, 1);
});

test('Retry間隔は段階的で上限がある', function () {
  assert.ok(foundation.backoffMs(0) >= 15000);
  assert.ok(foundation.backoffMs(8) <= 300000);
  assert.ok(foundation.backoffMs(3) > foundation.backoffMs(1));
});

test('共通更新で案件設定を消さない merge', function () {
  var legacy = {
    projectId: 'AC-0001',
    site: { customer: 'KEEP', locationLabel: '南部平野部' },
    contents: { typhoon: { on: false } }
  };
  var merged = foundation.mergeJsonOntoLegacy({
    projectId: 'AC-0001',
    siteName: '南部平野部',
    contents: { typhoon: { on: false }, weather: { on: true } }
  }, legacy);
  assert.strictEqual(merged.site.customer, 'KEEP');
  assert.strictEqual(merged.contents.typhoon.on, false);
});

test('将来APIパスへ差し替え可能', function () {
  assert.strictEqual(remote.siteConfigUrl('AC-0000'), './sites/AC-0000.json');
  assert.strictEqual(
    remote.siteConfigUrl('AC-0000', { type: 'api', path: '/api/sites/{id}' }),
    '/api/sites/AC-0000'
  );
});

test('Release と直前版が記録されている', function () {
  assert.ok(version.RELEASE.releaseId);
  assert.ok(version.RELEASE.previousReleaseId);
});

test('コンテンツ契約に台風と気圧がある', function () {
  assert.ok(modules.MODULES.typhoon);
  assert.ok(modules.MODULES.pressure);
  assert.strictEqual(modules.MODULES.pollen.future, true);
});

test('台風サービスはOFFなら通信しない', function () {
  global.AlertCubeContent = { isOn: function (id) { return id !== 'typhoon'; } };
  assert.strictEqual(typhoonSvc.should(), false);
  global.AlertCubeContent = undefined;
});

test('Rollback情報に直前リリースがある', function () {
  assert.ok(rollback.info().previous);
  assert.ok(rollback.info().how);
});

test('気圧パネルは共通pressureに対応', function () {
  assert.strictEqual(registry.panelContentId('pres'), 'pressure');
  var cfg = foundation.applyContentsDefaults({ contents: { pressure: { on: false } } });
  assert.strictEqual(foundation.isScene2PanelOn(cfg, 'pres'), false);
  assert.strictEqual(foundation.isScene2PanelOn(cfg, 'temp'), true);
});

test('Project Lifecycle: test/active のみ通信可。ended/archived は停止', function () {
  assert.strictEqual(foundation.isStatusOperable('test', 'AC-0000'), true);
  assert.strictEqual(foundation.isStatusOperable('active', 'AC-0001'), true);
  assert.strictEqual(foundation.isStatusOperable('test', 'AC-0001'), false);
  assert.strictEqual(foundation.isStatusOperable('ended', 'AC-0001'), false);
  assert.strictEqual(foundation.isStatusOperable('archived', 'AC-0001'), false);
  assert.strictEqual(foundation.isStatusOperable('suspended', 'AC-0001'), false);
});

test('durationMs 未指定は fallback を使う', function () {
  foundation.applyToGlobals({
    projectId: 'AC-0001',
    resolution: '512x128',
    contents: { weather: { on: true } }
  });
  assert.strictEqual(foundation.contentDurationMs('weather', 2800), 2800);
});

test('DEFAULT_SITE は本番 AC-0001、AC-0000 はテスト', function () {
  assert.strictEqual(foundation.DEFAULT_SITE, 'AC-0001');
  var index = require('../sites/index.json');
  assert.strictEqual(index.defaultSite, 'AC-0001');
  assert.ok(index.testSites.indexOf('AC-0000') >= 0);
  assert.ok(index.productionSites.indexOf('AC-0001') >= 0);
  assert.ok(index.productionSites.indexOf('AC-0002') >= 0);
  assert.ok(index.productionSites.indexOf('AC-0000') < 0);
});

test('AC-0002 はENEOS磯子の独立した本番案件設定', function () {
  var site = require('../sites/AC-0002.json');
  assert.strictEqual(site.projectId, 'AC-0002');
  assert.strictEqual(site.status, 'active');
  assert.strictEqual(site.customer, 'エネオス株式会社');
  assert.strictEqual(site.moe.point, '46106');
  assert.strictEqual(site.jma.warnCity, '1410012');
  assert.strictEqual(site.contents.schedule.on, false);
  assert.strictEqual(site.contents.typhoon.on, true);
  assert.strictEqual(site.presentation.observationMode, 'scroll');
});

test('AC-0000 は内部テスト・全共通Contents ON、未実装はOFF', function () {
  var site = require('../sites/AC-0000.json');
  assert.strictEqual(site.projectId, 'AC-0000');
  assert.strictEqual(site.status, 'test');
  assert.strictEqual(site.customer, '');
  assert.ok(foundation.validateSiteConfig(site).ok);
  registry.CONTENTS.forEach(function (c) {
    var item = site.contents[c.id];
    assert.ok(item, 'missing contents.' + c.id);
    if (c.existing) {
      assert.strictEqual(item.on, true, c.id + ' should be on for AC-0000');
      assert.strictEqual(foundation.isContentOn(site, c.id), true, c.id + ' isContentOn');
    } else {
      assert.strictEqual(item.on, false, c.id + ' should stay off');
      assert.strictEqual(foundation.isContentOn(site, c.id), false, c.id + ' isContentOn');
    }
  });
  assert.strictEqual(foundation.isScene2PanelOn(site, 'pres'), true);
  assert.ok(site.schedule && site.schedule.enabled);
  assert.ok(site.schedule.items && site.schedule.items.length > 0);
  var prod = require('../sites/AC-0001.json');
  assert.strictEqual(prod.projectId, 'AC-0001');
  assert.strictEqual(prod.status, 'active');
  assert.strictEqual(prod.customer, 'デジタルサイネージ');
  assert.strictEqual(prod.location, '〒559-0066 大阪市住之江区新北島1-9-13');
});

test('applyToGlobals: 既存 SignageConfig 参照を置き換えず中身を更新する', function () {
  var held = {
    projectId: 'AC-0001',
    site: { locationLabel: '住之江区' },
    moe: { point: '62078' },
    schedule: { enabled: true, items: [{ work: '足場組立', sub: '' }] }
  };
  global.SignageConfig = held;
  var next = foundation.mergeJsonOntoLegacy({
    projectId: 'AC-0000',
    siteName: '内部テスト',
    moe: { point: '62078', gasUrl: 'https://example.test/exec' },
    schedule: { enabled: true, items: [{ work: '検証A', sub: '内部確認' }] },
    contents: { clock: { on: true } },
    resolution: '512x128'
  }, held);
  foundation.applyToGlobals(next);
  assert.strictEqual(global.SignageConfig, held);
  assert.strictEqual(held.projectId, 'AC-0000');
  assert.strictEqual(held.site.locationLabel, '内部テスト');
  assert.strictEqual(held.schedule.items[0].work, '検証A');
});

console.log('');
console.log(passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
