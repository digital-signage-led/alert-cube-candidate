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

test('起動はURLの案件だけ。別案件や全コンテンツ初期値では始めない', function () {
  var site7 = {
    projectId: 'AC-0007',
    resolution: '512x128',
    contents: { clock: { on: true }, schedule: { on: false } }
  };
  var site1 = {
    projectId: 'AC-0001',
    resolution: '512x128',
    contents: { clock: { on: true }, schedule: { on: true } }
  };
  var fromNet = foundation.chooseBootConfig('AC-0007', site7, site1);
  assert.strictEqual(fromNet.ready, true);
  assert.strictEqual(fromNet.source, 'network');
  assert.strictEqual(fromNet.json.projectId, 'AC-0007');
  var fromCache = foundation.chooseBootConfig('AC-0007', null, site7);
  assert.strictEqual(fromCache.ready, true);
  assert.strictEqual(fromCache.source, 'cache');
  assert.strictEqual(fromCache.json.projectId, 'AC-0007');
  var wrongCache = foundation.chooseBootConfig('AC-0007', null, site1);
  assert.strictEqual(wrongCache.ready, false);
  assert.strictEqual(wrongCache.source, 'waiting');
  var none = foundation.chooseBootConfig('AC-0007', null, null);
  assert.strictEqual(none.ready, false);
  var store = {};
  global.localStorage = {
    setItem: function (k, v) { store[k] = v; },
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; }
  };
  foundation.rememberSiteJson('AC-0007', site7);
  foundation.rememberSiteJson('AC-0007', site1);
  assert.strictEqual(foundation.readRememberedSiteJson('AC-0007').projectId, 'AC-0007');
  assert.strictEqual(foundation.readRememberedSiteJson('AC-0001'), null);
  delete global.localStorage;
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

test('Project Lifecycle: test/demo/active のみ通信可。ended/archived は停止', function () {
  assert.strictEqual(foundation.isStatusOperable('test', 'AC-0000'), true);
  assert.strictEqual(foundation.isStatusOperable('active', 'AC-0001'), true);
  assert.strictEqual(foundation.isStatusOperable('demo', 'AC-0008'), true);
  assert.strictEqual(foundation.isStatusOperable('demo', 'AC-0000'), false);
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
  var defaultSite = require('../sites/AC-0001.json');
  assert.strictEqual(index.defaultSite, 'AC-0001');
  assert.strictEqual(defaultSite.presentation.observationMode, 'scroll');
  assert.ok(index.testSites.indexOf('AC-0000') >= 0);
  assert.ok(index.productionSites.indexOf('AC-0001') >= 0);
  assert.ok(index.productionSites.indexOf('AC-0002') >= 0);
  assert.ok(index.productionSites.indexOf('AC-0003') >= 0);
  assert.ok(index.productionSites.indexOf('AC-0004') >= 0);
  assert.ok(index.productionSites.indexOf('AC-0005') >= 0);
  assert.ok(index.productionSites.indexOf('AC-0006') >= 0);
  assert.ok(index.productionSites.indexOf('AC-0007') >= 0);
  assert.ok(index.productionSites.indexOf('AC-0009') >= 0);
  assert.ok(index.productionSites.indexOf('AC-0010') >= 0);
  assert.ok(index.productionSites.indexOf('AC-0011') >= 0);
  assert.ok(index.productionSites.indexOf('AC-0012') >= 0);
  assert.ok(index.productionSites.indexOf('AC-0013') >= 0);
  assert.ok(index.productionSites.indexOf('AC-0015') >= 0);
  assert.ok(index.productionSites.indexOf('AC-0000') < 0);
  assert.ok(Array.isArray(index.demoSites));
  index.demoSites.forEach(function (id) {
    assert.ok(index.productionSites.indexOf(id) < 0, id + ' is both demo and production');
    assert.ok(index.testSites.indexOf(id) < 0, id + ' is both demo and test');
  });
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
  assert.deepStrictEqual(site.contentOrder, ['clock', 'observation', 'wbgt', 'wbgt-i18n', 'forecast']);
});

test('AC-0003 は但南建設の本番案件設定', function () {
  var site = require('../sites/AC-0003.json');
  assert.strictEqual(site.projectId, 'AC-0003');
  assert.strictEqual(site.status, 'active');
  assert.strictEqual(site.customer, '但南建設株式会社');
  assert.strictEqual(site.label, '但南建設');
  assert.strictEqual(site.siteName, '朝来市');
  assert.strictEqual(site.moe.point, '63201');
  assert.strictEqual(site.moe.fallbackPoint, '');
  assert.strictEqual(site.jma.amedasPoint, '63201');
  assert.strictEqual(site.jma.amedasSupplementPoint, '63518');
  assert.strictEqual(site.jma.warnCity, '2822500');
  assert.strictEqual(site.contents.heat.on, false);
  assert.strictEqual(site.contents.warning.on, true);
  assert.strictEqual(site.contents.typhoon.on, true);
  assert.strictEqual(site.contents.schedule.on, false);
  assert.strictEqual(site.contents['rain-nowcast'].on, true);
  assert.strictEqual(site.presentation.observationMode, 'scroll');
  var merged = foundation.mergeJsonOntoLegacy(site, { site: {} });
  assert.strictEqual(merged.site.locationLabel, '朝来市');
  assert.strictEqual(merged.site.label, '但南建設');
  assert.strictEqual(foundation.isContentOn(site, 'heat'), false);
  assert.strictEqual(foundation.isContentOn(site, 'wbgt'), true);
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
    if (c.id === 'heat') {
      assert.strictEqual(item.on, false, 'heat stays off');
      assert.strictEqual(foundation.isContentOn(site, c.id), false, 'heat isContentOn');
      return;
    }
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
  assert.strictEqual(site.presentation.observationMode, 'scroll');
  assert.deepStrictEqual(site.contentOrder, ['clock', 'observation', 'wbgt', 'wbgt-i18n', 'forecast', 'schedule', 'greeting']);
  assert.strictEqual(site.greeting.fill, 'body');
  assert.strictEqual(site.greeting.scrollLaps, 2);
  assert.strictEqual(site.greeting.lines[0], 'ここに文言');
  assert.strictEqual(site.contents.greeting.on, true);
  assert.deepStrictEqual(prod.contentOrder, ['clock', 'observation', 'wbgt', 'wbgt-i18n', 'forecast', 'schedule']);
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

test('AC-0004 は佐藤工業福山の本番設定で、共通コンテンツに社名を埋め込まない', function () {
  var fs = require('fs');
  var path = require('path');
  var site = require('../sites/AC-0004.json');
  assert.strictEqual(site.projectId, 'AC-0004');
  assert.strictEqual(site.status, 'active');
  assert.strictEqual(site.customer, '佐藤工業');
  assert.strictEqual(site.siteName, '福山市');
  assert.strictEqual(site.moe.point, '67401');
  assert.strictEqual(site.moe.region, '08');
  assert.strictEqual(site.moe.prefecture, '67');
  assert.strictEqual(site.moe.alertArea, '広島県');
  assert.strictEqual(site.jma.forecastArea, '340000');
  assert.strictEqual(site.jma.warnArea, '340000');
  assert.strictEqual(site.jma.warnCity, '3420700');
  assert.strictEqual(site.latitude, 34.4433);
  assert.strictEqual(site.longitude, 133.2486);
  assert.strictEqual(site.resolution, '512x128');
  assert.strictEqual(site.faces, 4);
  assert.strictEqual(site.presentation.sequence, 'contentOrder');
  assert.strictEqual(site.presentation.observationMode, 'scroll');
  assert.strictEqual(site.presentation.observationLaps, 2);
  assert.strictEqual(site.presentation.scrollSpeedPx, undefined);
  assert.strictEqual(site.news.speed, 1);
  assert.strictEqual(site.news.pageUrl, 'https://www.satokogyo.co.jp/news/');
  assert.strictEqual(site.news.maxItems, 2);
  assert.strictEqual(site.boards.speed, 1);
  assert.deepStrictEqual(site.contentOrder, ['warning', 'typhoon', 'clock', 'observation', 'wbgt', 'forecast', 'news', 'boards', 'wbgt-i18n']);
  assert.strictEqual(site.contents.observation.on, true);
  assert.strictEqual(site.contents.news.on, true);
  assert.strictEqual(site.contents.boards.on, true);
  assert.strictEqual(site.contents['logo-scroll'].on, false);
  assert.strictEqual(site.contents.heat.on, false);
  assert.strictEqual(site.contents.warning.on, true);
  assert.strictEqual(site.contents['warning-hero'].on, false);
  assert.strictEqual(site.contents['rain-nowcast'].on, true);
  assert.strictEqual(site.contents.typhoon.on, true);
  assert.ok(site.contentOrder.indexOf('logo-scroll') < 0);
  ['AC-0001', 'AC-0002', 'AC-0003'].forEach(function (id) {
    var other = require('../sites/' + id + '.json');
    assert.notStrictEqual(other.presentation && other.presentation.sequence, 'contentOrder');
    assert.strictEqual(other.contents.news.on, false);
    assert.strictEqual(other.contents.boards.on, false);
    assert.strictEqual(other.contents['logo-scroll'].on, false);
  });
  var news = require('../contents/news/index.js');
  var boards = require('../contents/boards/index.js');
  var logo = require('../contents/logo-scroll/index.js');
  var sample = './assets/sites/AC-EXAMPLE/mark.png';
  var newsHtml = news.buildTrackHtml(
    [{ date: '09/01', title: '確認用ニュース' }],
    { logoSrc: sample, badge: '新着情報' }
  ).html;
  var boardHtml = boards.buildPhaseHtml({
    layout: 'columns',
    columns: [
      { kind: 'message', lines: ['共通表示'] },
      { kind: 'logo', src: sample, name: '確認', en: 'EXAMPLE' }
    ]
  }, '').html;
  var logoHtml = logo.buildTrackHtml({
    laps: 1,
    panelWidth: 256,
    images: [{ src: sample, alt: 'example' }]
  }).html;
  [newsHtml, boardHtml, logoHtml].forEach(function (html) {
    assert.ok(html.indexOf(sample) >= 0);
    assert.ok(html.indexOf('佐藤') < 0);
    assert.ok(html.indexOf('sato') < 0);
    assert.ok(html.indexOf('福山') < 0);
    assert.ok(html.indexOf('67401') < 0);
  });
  assert.strictEqual(logo.lapsOf({ laps: 1 }), 1);
  assert.strictEqual(news.lapsOf({ laps: 1 }), 1);
  assert.strictEqual(boards.speedOf({ speed: 0.95 }), 0.95);
  ['contents/news/index.js', 'contents/boards/index.js', 'contents/logo-scroll/index.js'].forEach(function (rel) {
    var text = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
    assert.ok(text.indexOf('佐藤') < 0, rel);
    assert.ok(text.indexOf('福山') < 0, rel);
    assert.ok(text.indexOf('67401') < 0, rel);
  });
  var page = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(page.indexOf('function playlistHandoff_()') >= 0);
  assert.ok(page.indexOf('function playSceneNews()') >= 0);
  assert.ok(page.indexOf('function playSceneBoards()') >= 0);
  assert.ok(page.indexOf('function playSceneLogoScroll()') >= 0);
  assert.ok(page.indexOf('function startContentOrder_()') >= 0);
  assert.ok(page.indexOf("p.sequence === 'contentOrder'") >= 0);
  assert.ok(page.indexOf("if (id === 'observation') return observationInPlaylist_()") >= 0);
  var humStart = page.indexOf('function saturationVaporPressureHpa_');
  var humEnd = page.indexOf('function d5FootHtml_');
  assert.ok(humStart >= 0 && humEnd > humStart);
  var forecastHumidityPct_ = new Function(page.slice(humStart, humEnd) + '\nreturn forecastHumidityPct_;')();
  assert.strictEqual(forecastHumidityPct_(32, 21), 52);
  assert.strictEqual(forecastHumidityPct_(30, 20), 55);
  assert.strictEqual(forecastHumidityPct_(30, 30), null);
  assert.strictEqual(forecastHumidityPct_(null, 20), null);
});

test('AC-0005 はレイズネクスト摂津の4面本番設定', function () {
  var site = require('../sites/AC-0005.json');
  assert.strictEqual(site.projectId, 'AC-0005');
  assert.strictEqual(site.status, 'active');
  assert.strictEqual(site.customer, 'レイズネクスト');
  assert.strictEqual(site.label, 'レイズネクスト');
  assert.strictEqual(site.siteName, '摂津市');
  assert.strictEqual(site.faces, 4);
  assert.strictEqual(site.resolution, '512x128');
  assert.strictEqual(site.layout, 'AC-512');
  assert.strictEqual(site.moe.point, '62078');
  assert.strictEqual(site.moe.fallbackPoint, '');
  assert.strictEqual(site.moe.pointName, '大阪');
  assert.strictEqual(site.moe.region, '07');
  assert.strictEqual(site.moe.prefecture, '62');
  assert.strictEqual(site.moe.alertArea, '大阪府');
  assert.strictEqual(site.jma.amedasPoint, '62078');
  assert.strictEqual(site.jma.forecastArea, '270000');
  assert.strictEqual(site.jma.warnCity, '2722400');
  assert.strictEqual(site.latitude, 34.7774);
  assert.strictEqual(site.longitude, 135.5619);
  assert.strictEqual(site.presentation.sequence, 'contentOrder');
  assert.strictEqual(site.presentation.observationMode, 'scroll');
  assert.deepStrictEqual(site.contentOrder, ['warning', 'typhoon', 'clock', 'observation', 'wbgt', 'forecast', 'wbgt-i18n']);
  assert.strictEqual(site.contents.heat.on, false);
  assert.strictEqual(site.contents.warning.on, true);
  assert.strictEqual(site.contents['warning-hero'].on, false);
  assert.strictEqual(site.contents.typhoon.on, true);
  assert.strictEqual(site.contents.disaster.on, false);
  assert.strictEqual(site.contents['rain-nowcast'].on, true);
  assert.ok(site.logo.bannerSrc.indexOf('AC-0005/logo_foot.png') >= 0);
  assert.ok(site.logo.src.indexOf('AC-0005/logo_128.png') >= 0);
  var merged = foundation.mergeJsonOntoLegacy(site, { site: {} });
  assert.strictEqual(merged.site.locationLabel, '摂津市');
  assert.strictEqual(merged.site.label, 'レイズネクスト');
  assert.strictEqual(merged.faces, 4);
  assert.ok(foundation.validateSiteConfig(site).ok);
});

test('AC-0006 は錦建設広島市中区の通常版', function () {
  var site = require('../sites/AC-0006.json');
  assert.strictEqual(site.projectId, 'AC-0006');
  assert.strictEqual(site.status, 'active');
  assert.strictEqual(site.customer, '錦建設株式会社');
  assert.strictEqual(site.label, '錦建設');
  assert.strictEqual(site.siteName, '広島市中区');
  assert.strictEqual(site.faces, 4);
  assert.strictEqual(site.resolution, '512x128');
  assert.strictEqual(site.moe.point, '67437');
  assert.strictEqual(site.moe.pointName, '広島');
  assert.strictEqual(site.moe.alertArea, '広島県');
  assert.strictEqual(site.jma.amedasPoint, '67437');
  assert.strictEqual(site.jma.forecastArea, '340000');
  assert.strictEqual(site.jma.warnCity, '3410100');
  assert.strictEqual(site.presentation.sequence, 'contentOrder');
  assert.deepStrictEqual(site.contentOrder, ['warning', 'typhoon', 'clock', 'observation', 'wbgt', 'forecast', 'news', 'wbgt-i18n']);
  assert.strictEqual(site.contents.warning.on, true);
  assert.strictEqual(site.contents.typhoon.on, true);
  assert.strictEqual(site.contents.disaster.on, true);
  assert.strictEqual(site.contents.news.on, true);
  var news = require('../contents/news/index.js');
  assert.strictEqual(site.news.pageUrl, 'https://str-nishiki.co.jp/');
  assert.strictEqual(site.news.maxItems, 2);
  assert.ok(site.news.urls[0].indexOf('AC-0006/news.json') >= 0);
  var live = news.parsePage([
    '2026-09-25',
    '',
    '[令和8年度ひろしま企業健康宣言「健康づくり優良事業所」認定について](https://str-nishiki.co.jp/pages/1)_NEW_',
    '',
    '2026-09-02',
    '',
    '[優良建設工事表彰を受賞しました。](https://str-nishiki.co.jp/pages/1)',
    '',
    '2026-08-12',
    '',
    '[工事だより](https://str-nishiki.co.jp/pages/1)'
  ].join('\n'), 2);
  assert.strictEqual(live.length, 2);
  assert.strictEqual(live[0].date, '2026年09月25日');
  assert.strictEqual(live[0].title, '令和8年度ひろしま企業健康宣言「健康づくり優良事業所」認定について');
  assert.strictEqual(live[1].title, '優良建設工事表彰を受賞しました。');
  var htmlNews = news.parsePage(
    '<div data-switch="date"><span></span>2026-09-25</div>' +
    '<span data-field="title">健康宣言</span>' +
    '<div data-switch="date">2026-09-02</div>' +
    '<span data-field="title">表彰</span>',
    2
  );
  assert.strictEqual(htmlNews.length, 2);
  assert.strictEqual(htmlNews[0].title, '健康宣言');
  assert.deepStrictEqual(news.pageFetchUrls('https://str-nishiki.co.jp/'), [
    'https://str-nishiki.co.jp/',
    'https://r.jina.ai/https://str-nishiki.co.jp/'
  ]);
  assert.strictEqual(site.contents.boards.on, false);
  assert.ok(site.logo.src.indexOf('AC-0006/logo_stack.png') >= 0);
  assert.ok(site.logo.bannerSrc.indexOf('AC-0006/logo_wide.png') >= 0);
  assert.ok(foundation.validateSiteConfig(site).ok);
});

test('AC-0007 は佐々木建設北島町の4面本番設定', function () {
  var site = require('../sites/AC-0007.json');
  assert.strictEqual(site.projectId, 'AC-0007');
  assert.strictEqual(site.status, 'active');
  assert.strictEqual(site.customer, '佐々木建設株式会社');
  assert.strictEqual(site.label, '佐々木建設');
  assert.strictEqual(site.siteName, '北島町');
  assert.strictEqual(site.faces, 4);
  assert.strictEqual(site.resolution, '512x128');
  assert.strictEqual(site.moe.point, '71106');
  assert.strictEqual(site.moe.alertArea, '徳島県');
  assert.strictEqual(site.jma.amedasPoint, '71106');
  assert.strictEqual(site.jma.forecastArea, '360000');
  assert.strictEqual(site.jma.warnCity, '3640200');
  assert.strictEqual(site.presentation.sequence, 'contentOrder');
  assert.strictEqual(site.presentation.observationMode, 'scroll');
  assert.deepStrictEqual(site.contentOrder, ['warning', 'typhoon', 'clock', 'observation', 'wbgt', 'forecast', 'news', 'wbgt-i18n']);
  assert.strictEqual(site.contents.warning.on, true);
  assert.strictEqual(site.contents.typhoon.on, true);
  assert.strictEqual(site.contents.news.on, true);
  assert.strictEqual(site.news.pageUrl, 'https://www.ssk-con.co.jp/wp-json/wp/v2/posts?per_page=5&_fields=date,title');
  assert.strictEqual(site.news.maxItems, 2);
  assert.ok(site.logo.src.indexOf('AC-0007/logo_mark.png') >= 0);
  assert.ok(site.logo.bannerSrc.indexOf('AC-0007/logo_banner.png') >= 0);
  assert.ok(foundation.validateSiteConfig(site).ok);
});

test('AC-0008 は太陽建機レンタル名古屋市のデモ', function () {
  var site = require('../sites/AC-0008.json');
  var index = require('../sites/index.json');
  assert.strictEqual(site.projectId, 'AC-0008');
  assert.strictEqual(site.status, 'demo');
  assert.strictEqual(site.customer, '太陽建機レンタル株式会社');
  assert.strictEqual(site.label, '太陽建機レンタル');
  assert.strictEqual(site.projectName, 'デモ 太陽建機レンタル');
  assert.strictEqual(site.siteName, '名古屋市');
  assert.strictEqual(site.faces, 4);
  assert.strictEqual(site.resolution, '512x128');
  assert.strictEqual(site.moe.point, '51106');
  assert.strictEqual(site.moe.pointName, '名古屋');
  assert.strictEqual(site.moe.alertArea, '愛知県');
  assert.strictEqual(site.moe.region, '05');
  assert.strictEqual(site.moe.prefecture, '51');
  assert.strictEqual(site.jma.amedasPoint, '51106');
  assert.strictEqual(site.jma.forecastArea, '230000');
  assert.strictEqual(site.jma.forecastDetail, '230010');
  assert.strictEqual(site.jma.warnCity, '2310000');
  assert.strictEqual(site.jma.warnCityLabel, '名古屋市');
  assert.strictEqual(site.latitude, 35.1667);
  assert.strictEqual(site.longitude, 136.965);
  assert.ok(site.logo.src.indexOf('AC-0008/logo_mark.png') >= 0);
  assert.ok(site.logo.bannerSrc.indexOf('AC-0008/logo_banner.png') >= 0);
  assert.ok(index.demoSites.indexOf('AC-0008') >= 0);
  assert.ok(index.productionSites.indexOf('AC-0008') < 0);
  var merged = foundation.mergeJsonOntoLegacy(site, { site: {} });
  assert.strictEqual(merged.site.locationLabel, '名古屋市');
  assert.strictEqual(merged.site.label, '太陽建機レンタル');
  assert.strictEqual(merged.status, 'demo');
  assert.ok(foundation.validateSiteConfig(site).ok);
});

test('AC-0009 は大島組・米岡橋梁下部工の4面本番設定', function () {
  var site = require('../sites/AC-0009.json');
  var index = require('../sites/index.json');
  assert.strictEqual(site.projectId, 'AC-0009');
  assert.strictEqual(site.status, 'active');
  assert.strictEqual(site.customer, '株式会社大島組');
  assert.strictEqual(site.label, '大島組');
  assert.strictEqual(site.siteName, '米岡橋梁下部工');
  assert.strictEqual(site.location, '〒943-0104 新潟県上越市鶴町52');
  assert.strictEqual(site.memo, 'レンタルのニッケン上越営業');
  assert.strictEqual(site.faces, 4);
  assert.strictEqual(site.resolution, '512x128');
  assert.strictEqual(site.moe.point, '54651');
  assert.strictEqual(site.moe.pointName, '高田');
  assert.strictEqual(site.moe.alertArea, '新潟県');
  assert.strictEqual(site.moe.region, '06');
  assert.strictEqual(site.moe.prefecture, '54');
  assert.strictEqual(site.jma.amedasPoint, '54651');
  assert.strictEqual(site.jma.forecastArea, '150000');
  assert.strictEqual(site.jma.forecastDetail, '150031');
  assert.strictEqual(site.jma.warnCity, '1522200');
  assert.strictEqual(site.jma.warnCityLabel, '上越市');
  assert.strictEqual(site.latitude, 37.1292);
  assert.strictEqual(site.longitude, 138.3062);
  assert.strictEqual(site.contents.news.on, true);
  assert.strictEqual(site.news.pageUrl, 'https://www.ooshimagumi.com/wp-json/wp/v2/posts?per_page=5&_fields=date,title');
  assert.strictEqual(site.news.maxItems, 2);
  assert.ok(site.logo.src.indexOf('AC-0009/logo_mark.png') >= 0);
  assert.ok(site.logo.bannerSrc.indexOf('AC-0009/logo_banner.png') >= 0);
  assert.ok(index.productionSites.indexOf('AC-0009') >= 0);
  assert.ok(index.demoSites.indexOf('AC-0009') < 0);
  var merged = foundation.mergeJsonOntoLegacy(site, { site: {} });
  assert.strictEqual(merged.site.locationLabel, '米岡橋梁下部工');
  assert.strictEqual(merged.site.label, '大島組');
  assert.ok(foundation.validateSiteConfig(site).ok);
});

test('AC-0010 はフジケン長崎・諫早市永昌町の4面本番設定', function () {
  var site = require('../sites/AC-0010.json');
  var index = require('../sites/index.json');
  assert.strictEqual(site.projectId, 'AC-0010');
  assert.strictEqual(site.status, 'active');
  assert.strictEqual(site.customer, '有限会社フジケン長崎');
  assert.strictEqual(site.rental, 'レンタルはフジケン長崎へ');
  assert.strictEqual(site.label, 'フジケン長崎');
  assert.strictEqual(site.siteName, '諫早市永昌町');
  assert.strictEqual(site.location, '〒854-0072 長崎県諫早市永昌町５−２３');
  assert.strictEqual(site.faces, 4);
  assert.strictEqual(site.resolution, '512x128');
  assert.strictEqual(site.timeZone, 'Asia/Tokyo');
  assert.strictEqual(site.moe.point, '84496');
  assert.strictEqual(site.moe.pointName, '長崎');
  assert.strictEqual(site.moe.alertArea, '長崎県');
  assert.strictEqual(site.moe.region, '10');
  assert.strictEqual(site.moe.prefecture, '84');
  assert.strictEqual(site.jma.amedasPoint, '84496');
  assert.strictEqual(site.jma.forecastArea, '420000');
  assert.strictEqual(site.jma.forecastLabel, '諫早市');
  assert.strictEqual(site.jma.warnCity, '4220400');
  assert.strictEqual(site.latitude, 32.8842);
  assert.strictEqual(site.longitude, 130.0431);
  assert.strictEqual(site.contents.warning.on, true);
  assert.strictEqual(site.contents.typhoon.on, true);
  assert.strictEqual(site.contents.heat.on, false);
  assert.strictEqual(site.contents.greeting.on, true);
  assert.strictEqual(site.greeting.enabled, true);
  assert.strictEqual(site.greeting.lines[0], 'レンタルはフジケン長崎へ');
  assert.strictEqual(site.greeting.fill, 'body');
  assert.strictEqual(site.greeting.scrollLaps, 2);
  assert.strictEqual(site.logo.src, '');
  assert.ok(site.logo.bannerSrc.indexOf('AC-0010/logo_banner.png') >= 0);
  assert.strictEqual(site.presentation.observationTrailingLogo, false);
  assert.strictEqual(site.presentation.wording, 'public');
  assert.strictEqual(site.contents['logo-scroll'].on, true);
  assert.strictEqual(site.logoScroll.laps, 2);
  assert.strictEqual(site.logoScroll.images[0].panelWidth, 873);
  assert.ok(site.logoScroll.images[0].src.indexOf('AC-0010/logo_banner.png') >= 0);
  assert.deepStrictEqual(site.contentOrder, ['warning', 'typhoon', 'clock', 'observation', 'forecast', 'greeting', 'wbgt-i18n', 'logo-scroll', 'wbgt']);
  assert.ok(index.productionSites.indexOf('AC-0010') >= 0);
  assert.ok(index.demoSites.indexOf('AC-0010') < 0);
  var merged = foundation.mergeJsonOntoLegacy(site, { site: { rental: 'デジタルサイネージ' } });
  assert.strictEqual(merged.site.rental, 'レンタルはフジケン長崎へ');
  assert.strictEqual(merged.site.label, 'フジケン長崎');
  assert.strictEqual(merged.site.locationLabel, '諫早市永昌町');
  assert.strictEqual(foundation.toLegacyBrand(site).logoSrc, '');
  assert.ok(foundation.toLegacyBrand(site).footBannerSrc.indexOf('AC-0010/logo_banner.png') >= 0);
  assert.ok(foundation.toLegacyBrand({ customer: 'x' }).logoSrc.indexOf('logo.svg') >= 0);
  assert.ok(foundation.validateSiteConfig(site).ok);
});

test('AC-0011 は起産建設・博多区の4面本番設定', function () {
  var site = require('../sites/AC-0011.json');
  var index = require('../sites/index.json');
  assert.strictEqual(site.projectId, 'AC-0011');
  assert.strictEqual(site.status, 'active');
  assert.strictEqual(site.customer, '起産建設株式会社');
  assert.strictEqual(site.label, '起産建設');
  assert.strictEqual(site.siteName, '博多区');
  assert.strictEqual(site.location, '〒812-0041 福岡県福岡市博多区吉塚4丁目9-31');
  assert.strictEqual(site.faces, 4);
  assert.strictEqual(site.resolution, '512x128');
  assert.strictEqual(site.timeZone, 'Asia/Tokyo');
  assert.strictEqual(site.moe.point, '82182');
  assert.strictEqual(site.moe.pointName, '福岡');
  assert.strictEqual(site.moe.alertArea, '福岡県');
  assert.strictEqual(site.moe.region, '10');
  assert.strictEqual(site.moe.prefecture, '82');
  assert.strictEqual(site.jma.amedasPoint, '82182');
  assert.strictEqual(site.jma.forecastArea, '400000');
  assert.strictEqual(site.jma.forecastDetail, '400010');
  assert.strictEqual(site.jma.forecastLabel, '博多区');
  assert.strictEqual(site.jma.warnArea, '400000');
  assert.strictEqual(site.jma.warnCity, '4013000');
  assert.strictEqual(site.jma.warnCityLabel, '博多区');
  assert.strictEqual(site.contents.warning.on, true);
  assert.strictEqual(site.contents['warning-hero'].on, false);
  assert.strictEqual(site.contents.typhoon.on, true);
  assert.strictEqual(site.contents.disaster.on, true);
  assert.strictEqual(site.contents.heat.on, false);
  assert.strictEqual(site.contents.news.on, true);
  assert.strictEqual(site.news.pageUrl, 'https://kisan-k.co.jp/topics/');
  assert.strictEqual(site.news.maxItems, 2);
  assert.strictEqual(site.contents['wbgt-i18n'].on, true);
  assert.strictEqual(site.contents.wbgt.on, true);
  assert.strictEqual(site.contents.forecast.on, true);
  assert.strictEqual(site.presentation.observationLaps, 2);
  assert.strictEqual(site.presentation.observationTrailingLogo, true);
  assert.strictEqual(site.presentation.sequence, 'contentOrder');
  assert.strictEqual(site.presentation.wording, 'public');
  assert.ok(site.logo.src.indexOf('AC-0011/logo_mark.png') >= 0);
  assert.ok(site.logo.bannerSrc.indexOf('AC-0011/logo_banner.png') >= 0);
  assert.deepStrictEqual(site.contentOrder, ['warning', 'typhoon', 'clock', 'observation', 'forecast', 'wbgt-i18n', 'wbgt', 'news']);
  assert.ok(index.productionSites.indexOf('AC-0011') >= 0);
  assert.ok(index.demoSites.indexOf('AC-0011') < 0);
  var merged = foundation.mergeJsonOntoLegacy(site, { site: {} });
  assert.strictEqual(merged.site.locationLabel, '博多区');
  assert.strictEqual(merged.site.label, '起産建設');
  assert.ok(foundation.toLegacyBrand(site).logoSrc.indexOf('logo_mark.png') >= 0);
  assert.ok(foundation.toLegacyBrand(site).footBannerSrc.indexOf('logo_banner.png') >= 0);
  assert.ok(foundation.validateSiteConfig(site).ok);
});

test('AC-0012 は株式会社ヒカリ・丸亀市の4面本番設定', function () {
  var site = require('../sites/AC-0012.json');
  var index = require('../sites/index.json');
  assert.strictEqual(site.projectId, 'AC-0012');
  assert.strictEqual(site.status, 'active');
  assert.strictEqual(site.customer, '株式会社ヒカリ');
  assert.strictEqual(site.rental, '株式会社ヒカリ');
  assert.strictEqual(site.label, 'ヒカリ');
  assert.strictEqual(site.siteName, '丸亀市');
  assert.strictEqual(site.location, '〒763-0085 香川県丸亀市飯野町東分592-1');
  assert.strictEqual(site.memo, 'レンタルのニッケン。香川県立香川丸亀支援学校の表示をv2.0化');
  assert.strictEqual(site.faces, 4);
  assert.strictEqual(site.resolution, '512x128');
  assert.strictEqual(site.timeZone, 'Asia/Tokyo');
  assert.strictEqual(site.moe.point, '72111');
  assert.strictEqual(site.moe.pointName, '多度津');
  assert.strictEqual(site.moe.alertArea, '香川県');
  assert.strictEqual(site.moe.region, '09');
  assert.strictEqual(site.moe.prefecture, '72');
  assert.strictEqual(site.jma.amedasPoint, '72111');
  assert.strictEqual(site.jma.forecastArea, '370000');
  assert.strictEqual(site.jma.forecastLabel, '丸亀市');
  assert.strictEqual(site.jma.warnArea, '370000');
  assert.strictEqual(site.jma.warnCity, '3720200');
  assert.strictEqual(site.jma.warnCityLabel, '丸亀市');
  assert.strictEqual(site.latitude, 34.2915);
  assert.strictEqual(site.longitude, 133.825);
  assert.strictEqual(site.contents.warning.on, true);
  assert.strictEqual(site.contents['warning-hero'].on, false);
  assert.strictEqual(site.contents.typhoon.on, true);
  assert.strictEqual(site.contents.disaster.on, true);
  assert.strictEqual(site.contents.heat.on, false);
  assert.strictEqual(site.contents.news.on, true);
  assert.strictEqual(site.news.pageUrl, 'https://www.hikari-c.co.jp/');
  assert.strictEqual(site.news.maxItems, 2);
  assert.ok(site.news.urls[0].indexOf('AC-0012/news.json') >= 0);
  assert.strictEqual(site.contents.clock.on, true);
  assert.strictEqual(site.contents.observation.on, true);
  assert.strictEqual(site.contents.forecast.on, true);
  assert.strictEqual(site.contents['wbgt-i18n'].on, true);
  assert.strictEqual(site.contents.wbgt.on, true);
  assert.strictEqual(site.presentation.observationLaps, 2);
  assert.strictEqual(site.presentation.observationTrailingLogo, true);
  assert.strictEqual(site.presentation.sequence, 'contentOrder');
  assert.strictEqual(site.presentation.wording, 'public');
  assert.ok(site.logo.src.indexOf('AC-0012/logo_stack.png') >= 0);
  assert.ok(site.logo.bannerSrc.indexOf('AC-0012/logo_banner.png') >= 0);
  assert.deepStrictEqual(site.contentOrder, ['warning', 'typhoon', 'clock', 'observation', 'forecast', 'wbgt-i18n', 'wbgt', 'news']);
  var news = require('../contents/news/index.js');
  var hikari = news.parsePage(
    '<div class="news-area"><dl><dt>2026.9.26</dt><dd class="category">お知らせ</dd><dd class="title">ケアーズ日誌を更新しました</dd></dl>' +
    '<dl><dt>2026.9.11</dt><dd class="title">【フードドライブ】第22回 ～参画企業様より～</dd></dl>' +
    '<dl><dt>2026.9.11</dt><dd class="title">【フードドライブ】 第22回 寄贈してまいりました</dd></dl></div>' +
    '<div class="blog-area"><dl><dt>お陰様で10周年</dt><dd class="date">2026.9.11</dd></dl></div>',
    2
  );
  assert.strictEqual(hikari.length, 2);
  assert.strictEqual(hikari[0].date, '2026年09月26日');
  assert.strictEqual(hikari[0].title, 'ケアーズ日誌を更新しました');
  assert.strictEqual(hikari[1].title, '【フードドライブ】第22回 ～参画企業様より～');
  var hikariMd = news.parsePage('[2026.9.26 お知らせ ケアーズ日誌を更新しました](https://www.hikari-c.co.jp/news/info/entry-627.html)\n[2026.9.11 【フードドライブ】第22回 ～参画企業様より～](https://www.hikari-c.co.jp/news/entry-626.html)', 2);
  assert.strictEqual(hikariMd[0].title, 'ケアーズ日誌を更新しました');
  assert.strictEqual(hikariMd[0].date, '2026年09月26日');
  assert.ok(index.productionSites.indexOf('AC-0012') >= 0);
  assert.ok(index.demoSites.indexOf('AC-0012') < 0);
  var merged = foundation.mergeJsonOntoLegacy(site, { site: {} });
  assert.strictEqual(merged.site.locationLabel, '丸亀市');
  assert.strictEqual(merged.site.label, 'ヒカリ');
  assert.strictEqual(merged.site.rental, '株式会社ヒカリ');
  assert.ok(foundation.toLegacyBrand(site).logoSrc.indexOf('logo_stack.png') >= 0);
  assert.ok(foundation.toLegacyBrand(site).footBannerSrc.indexOf('logo_banner.png') >= 0);
  assert.ok(foundation.validateSiteConfig(site).ok);
});

test('AC-0013 は宮川興業・見守り伝書鳩の4面本番設定', function () {
  var densho = require('../services/densho/index.js');
  var news = require('../contents/news/index.js');
  var site = require('../sites/AC-0013.json');
  var index = require('../sites/index.json');
  assert.strictEqual(site.projectId, 'AC-0013');
  assert.strictEqual(site.status, 'active');
  assert.strictEqual(site.customer, '宮川興業株式会社');
  assert.strictEqual(site.siteName, '山本8号');
  assert.strictEqual(site.location, '広島県広島市安佐南区山本6丁目地内');
  assert.strictEqual(site.footSource, '出典：みまわり伝書鳩');
  assert.strictEqual(site.faces, 4);
  assert.strictEqual(site.resolution, '512x128');
  assert.strictEqual(site.latitude, 34.4366);
  assert.strictEqual(site.longitude, 132.4382);
  assert.ok(site.densho.apiUrl.indexOf('densho-bato.com') >= 0);
  assert.ok(site.densho.apiUrl.indexOf('pgn=miyagawa01') >= 0);
  assert.strictEqual(site.densho.dataIntervalSec, 600);
  assert.strictEqual(site.moe.gasUrl, '');
  assert.strictEqual(site.jma.amedasPoint, '');
  assert.strictEqual(site.jma.forecastArea, '340000');
  assert.strictEqual(site.contents.warning.on, true);
  assert.strictEqual(site.contents['warning-hero'].on, true);
  assert.strictEqual(site.contents['rain-nowcast'].on, true);
  assert.strictEqual(site.contents.typhoon.on, true);
  assert.strictEqual(site.contents.disaster.on, true);
  assert.strictEqual(site.contents.news.on, true);
  assert.strictEqual(site.contents.heat.on, false);
  assert.strictEqual(site.jma.warnCity, '3410500');
  assert.strictEqual(site.news.pageUrl, 'https://www.miyagawa-a2.co.jp/news/');
  assert.strictEqual(site.contents.forecast.on, true);
  assert.strictEqual(site.contents.wbgt.on, true);
  assert.strictEqual(site.presentation.observationTrailingLogo, true);
  assert.ok(site.logo.src.indexOf('AC-0013/logo_mark.png') >= 0);
  assert.strictEqual(site.logo.bannerSrc, '');
  assert.ok(site.densho.snapshotUrl.indexOf('densho-latest.json') >= 0);
  assert.ok(foundation.toLegacyBrand(site).logoSrc.indexOf('logo_mark.png') >= 0);
  assert.strictEqual(foundation.toLegacyBrand(site).footBannerSrc, '');
  assert.strictEqual(foundation.toLegacyBrand(site).hideFootMark, true);
  assert.deepStrictEqual(site.contentOrder, ['warning', 'warning-hero', 'typhoon', 'clock', 'observation', 'forecast', 'wbgt-i18n', 'wbgt', 'news']);
  assert.ok(index.productionSites.indexOf('AC-0013') >= 0);
  var merged = foundation.mergeJsonOntoLegacy(site, { site: {}, moe: {}, jma: {} });
  assert.strictEqual(merged.densho.pointName, '山本8号');
  assert.strictEqual(merged.footSource, '出典：みまわり伝書鳩');
  assert.strictEqual(merged.site.locationLabel, '山本8号');
  assert.strictEqual(merged.site.label, '宮川興業株式会社');
  var fetches = foundation.neededFetches(site);
  assert.ok(fetches.indexOf('densho-sensor') >= 0);
  assert.strictEqual(fetches.indexOf('jma-amedas'), -1);
  assert.strictEqual(fetches.indexOf('moe-wbgt'), -1);
  assert.ok(fetches.indexOf('jma-forecast') >= 0);
  assert.ok(fetches.indexOf('jma-warning') >= 0);
  assert.ok(fetches.indexOf('jma-typhoon') >= 0);
  assert.ok(fetches.indexOf('jma-nowc') >= 0);
  var miyagawaNews = news.parsePage('<li class="c-newslist__item"><dl><dt><span class="c-newslist__date"> 2026/9/01</span></dt><dd> 優良工事として表彰されました。 </dd></dl></li>', 2);
  assert.strictEqual(miyagawaNews[0].date, '2026年09月01日');
  assert.ok(miyagawaNews[0].title.indexOf('表彰') >= 0);
  var parsed = densho.parseLatest({
    term: [{
      name: '山本8号',
      data: [{
        date: '20260929142620',
        sea_level_pressure: 1011,
        sensu15xx: {
          temp: 22.3, humi: 78, rain: 0, rain_1h: 0,
          wind_dir: 90, wind_dir_str: '東', wind_speed: 0.2,
          max_wind_speed: 1.5, wbgt: 22, wbgt_str: '注意'
        }
      }]
    }]
  });
  assert.strictEqual(parsed.termName, '山本8号');
  assert.strictEqual(parsed.temp, 22.3);
  assert.strictEqual(parsed.windDirStr, '東');
  assert.strictEqual(parsed.obs.windDirection[0], 4);
  assert.strictEqual(parsed.obs.normalPressure[0], 1011);
  assert.strictEqual(parsed.wbgtSlots.length, 4);
  assert.strictEqual(parsed.wbgtSlots[0].wbgt, 22);
  var wrapped = densho.unwrapPayload({
    data: { content: JSON.stringify({ term: [{ name: '山本8号', data: [{ date: '20260929153620', sensu15xx: { temp: 22.4, humi: 80, rain: 0, wind_dir: 90, wind_dir_str: '東', wind_speed: 0.2, max_wind_speed: 1.2, wbgt: 22, wbgt_str: '注意' } }] }] }) }
  });
  assert.strictEqual(densho.parseLatest(wrapped).temp, 22.4);
  assert.ok(densho.readerUrl(site.densho.apiUrl).indexOf('https://r.jina.ai/https://densho-bato.com/') === 0);
  assert.strictEqual(parsed.wbgtSlots[0].levelIdx, 1);
  assert.strictEqual(parsed.wbgtSlots[3].hour, '現在');
  assert.strictEqual(parsed.observedAt.toISOString(), '2026-09-29T05:26:20.000Z');
  assert.strictEqual(densho.allowedApiUrl('https://densho-bato.com/member/get_json_data_latest?pgn=miyagawa01'), true);
  assert.strictEqual(densho.allowedApiUrl('https://example.com/latest'), false);
  assert.ok(foundation.validateSiteConfig(site).ok);
});

test('AC-0014 はレンタルのニッケン近江八幡の5面デモ', function () {
  var site = require('../sites/AC-0014.json');
  var index = require('../sites/index.json');
  assert.strictEqual(site.projectId, 'AC-0014');
  assert.strictEqual(site.status, 'demo');
  assert.strictEqual(site.customer, '株式会社レンタルのニッケン');
  assert.strictEqual(site.label, 'レンタルのニッケン');
  assert.strictEqual(site.siteName, '近江八幡市');
  assert.strictEqual(site.location, '滋賀県近江八幡市');
  assert.strictEqual(site.faces, 5);
  assert.strictEqual(site.resolution, '640x128');
  assert.strictEqual(site.layout, 'AC-640');
  assert.strictEqual(site.latitude, 35.1286);
  assert.strictEqual(site.longitude, 136.0978);
  assert.strictEqual(site.moe.point, '60131');
  assert.strictEqual(site.moe.pointName, '彦根');
  assert.strictEqual(site.moe.alertArea, '滋賀県');
  assert.strictEqual(site.moe.region, '07');
  assert.strictEqual(site.moe.prefecture, '60');
  assert.strictEqual(site.jma.amedasPoint, '60131');
  assert.strictEqual(site.jma.forecastArea, '250000');
  assert.strictEqual(site.jma.forecastDetail, '250010');
  assert.strictEqual(site.jma.forecastLabel, '近江八幡市');
  assert.strictEqual(site.jma.warnArea, '250000');
  assert.strictEqual(site.jma.warnCity, '2520400');
  assert.strictEqual(site.jma.warnCityLabel, '近江八幡市');
  assert.strictEqual(site.presentation.observationTrailingLogo, false);
  assert.ok(!site.presentation.previewAlerts);
  assert.strictEqual(site.contents.clock.on, true);
  assert.strictEqual(site.contents.observation.on, true);
  assert.strictEqual(site.contents.forecast.on, true);
  assert.strictEqual(site.contents['wbgt-i18n'].on, true);
  assert.strictEqual(site.contents.wbgt.on, true);
  assert.strictEqual(site.contents.warning.on, true);
  assert.strictEqual(site.contents.heat.on, true);
  assert.strictEqual(site.contents.typhoon.on, true);
  assert.strictEqual(site.rental, '無償');
  assert.ok(site.logo.src.indexOf('AC-0014/logo_mark.png') >= 0);
  assert.ok(site.logo.bannerSrc.indexOf('AC-0014/logo_banner.png') >= 0);
  assert.deepStrictEqual(site.contentOrder, ['warning', 'typhoon', 'clock', 'observation', 'forecast', 'wbgt-i18n', 'wbgt', 'heat']);
  assert.ok(index.demoSites.indexOf('AC-0014') >= 0);
  assert.ok(index.productionSites.indexOf('AC-0014') < 0);
  var merged = foundation.mergeJsonOntoLegacy(site, { site: {} });
  assert.strictEqual(merged.faces, 5);
  assert.strictEqual(merged.profile, 'AC-640');
  assert.strictEqual(merged.site.locationLabel, '近江八幡市');
  assert.strictEqual(merged.site.label, 'レンタルのニッケン');
  assert.strictEqual(merged.site.rental, '無償');
  assert.strictEqual(merged.status, 'demo');
  assert.ok(foundation.toLegacyBrand(site).logoSrc.indexOf('logo_mark.png') >= 0);
  assert.ok(foundation.toLegacyBrand(site).footBannerSrc.indexOf('logo_banner.png') >= 0);
  assert.ok(foundation.validateSiteConfig(site).ok);
});

test('AC-0015 は井原工業・四国中央市川之江の4面本番設定', function () {
  var site = require('../sites/AC-0015.json');
  var index = require('../sites/index.json');
  assert.strictEqual(site.projectId, 'AC-0015');
  assert.strictEqual(site.status, 'active');
  assert.strictEqual(site.customer, '井原工業株式会社');
  assert.strictEqual(site.rental, '井原工業株式会社');
  assert.strictEqual(site.label, '井原工業');
  assert.strictEqual(site.siteName, '川之江');
  assert.strictEqual(site.location, '愛媛県四国中央市川之江');
  assert.strictEqual(site.faces, 4);
  assert.strictEqual(site.resolution, '512x128');
  assert.strictEqual(site.timeZone, 'Asia/Tokyo');
  assert.strictEqual(site.latitude, 33.9817);
  assert.strictEqual(site.longitude, 133.5817);
  assert.strictEqual(site.elevation, 75);
  assert.strictEqual(site.moe.point, '73151');
  assert.strictEqual(site.moe.pointName, '四国中央');
  assert.strictEqual(site.moe.alertArea, '愛媛県');
  assert.strictEqual(site.moe.region, '09');
  assert.strictEqual(site.moe.prefecture, '73');
  assert.strictEqual(site.jma.amedasPoint, '73151');
  assert.strictEqual(site.jma.forecastArea, '380000');
  assert.strictEqual(site.jma.forecastDetail, '380020');
  assert.strictEqual(site.jma.forecastPoint, '73141');
  assert.strictEqual(site.jma.forecastLabel, '四国中央市');
  assert.strictEqual(site.jma.warnArea, '380000');
  assert.strictEqual(site.jma.warnCity, '3821300');
  assert.strictEqual(site.jma.warnCityLabel, '四国中央市');
  assert.strictEqual(site.contents.warning.on, true);
  assert.strictEqual(site.contents.typhoon.on, true);
  assert.strictEqual(site.contents.disaster.on, true);
  assert.strictEqual(site.contents['rain-nowcast'].on, true);
  assert.strictEqual(site.contents.heat.on, false);
  assert.strictEqual(site.contents.clock.on, true);
  assert.strictEqual(site.contents.observation.on, true);
  assert.strictEqual(site.contents.wbgt.on, true);
  assert.strictEqual(site.contents.forecast.on, true);
  assert.strictEqual(site.contents['wbgt-i18n'].on, true);
  assert.strictEqual(site.contents.news.on, true);
  assert.strictEqual(site.news.pageUrl.indexOf('api.cms.studiodesignapp.com/v2/search') >= 0, true);
  assert.strictEqual(site.news.maxItems, 2);
  assert.ok(site.news.urls[0].indexOf('AC-0015/news.json') >= 0);
  assert.strictEqual(site.presentation.observationTrailingLogo, false);
  assert.strictEqual(site.presentation.sequence, 'contentOrder');
  assert.strictEqual(site.logo.src, '');
  assert.ok(site.logo.bannerSrc.indexOf('AC-0015/logo_banner.png') >= 0);
  assert.deepStrictEqual(site.contentOrder, ['warning', 'typhoon', 'clock', 'observation', 'wbgt', 'forecast', 'news', 'wbgt-i18n']);
  var news = require('../contents/news/index.js');
  var ihara = news.parsePage(JSON.stringify([{
    document: {
      fields: {
        _meta: { mapValue: { fields: { publishedAt: { timestampValue: '2026-09-11T01:04:42+00:00' } } } },
        default: { mapValue: { fields: { title: { stringValue: '施工実績を更新しました。' } } } }
      }
    }
  }, {
    document: {
      fields: {
        _meta: { mapValue: { fields: { publishedAt: { timestampValue: '2026-07-13T23:25:02+00:00' } } } },
        default: { mapValue: { fields: { title: { stringValue: '独立行政法人水資源機構より「優良工事表彰」を受賞しました' } } } }
      }
    }
  }, {
    document: {
      fields: {
        _meta: { mapValue: { fields: { publishedAt: { timestampValue: '2025-12-08T06:45:25+00:00' } } } },
        default: { mapValue: { fields: { title: { stringValue: '愛媛労働局よりユースエール認定取得のお知らせ' } } } }
      }
    }
  }]), 2);
  assert.strictEqual(ihara.length, 2);
  assert.strictEqual(ihara[0].date, '2026年09月11日');
  assert.strictEqual(ihara[0].title, '施工実績を更新しました。');
  assert.strictEqual(ihara[1].date, '2026年07月14日');
  assert.strictEqual(ihara[1].title, '独立行政法人水資源機構より「優良工事表彰」を受賞しました');
  assert.ok(index.productionSites.indexOf('AC-0015') >= 0);
  assert.ok(index.demoSites.indexOf('AC-0015') < 0);
  var merged = foundation.mergeJsonOntoLegacy(site, { site: {} });
  assert.strictEqual(merged.site.locationLabel, '川之江');
  assert.strictEqual(merged.site.label, '井原工業');
  assert.strictEqual(merged.jma.forecastPoint, '73141');
  assert.strictEqual(merged.jma.warnCity, '3821300');
  assert.strictEqual(foundation.toLegacyBrand(site).logoSrc, '');
  assert.ok(foundation.toLegacyBrand(site).footBannerSrc.indexOf('logo_banner.png') >= 0);
  var fetches = foundation.neededFetches(site);
  assert.ok(fetches.indexOf('jma-warning') >= 0);
  assert.ok(fetches.indexOf('jma-typhoon') >= 0);
  assert.ok(fetches.indexOf('jma-amedas') >= 0);
  assert.ok(fetches.indexOf('jma-forecast') >= 0);
  assert.ok(fetches.indexOf('moe-wbgt') >= 0);
  assert.ok(foundation.validateSiteConfig(site).ok);
});

test('注意報・警報・特別警報と台風は全案件と新規テンプレートでオン', function () {
  var index = require('../sites/index.json');
  var tpl = require('../sites/_template.json');
  index.sites.forEach(function (row) {
    var site = require('../sites/' + row.projectId + '.json');
    if (site.densho && site.densho.apiUrl) return;
    assert.strictEqual(site.contents.warning.on, true, row.projectId + ' warning');
    assert.strictEqual(site.contents.typhoon.on, true, row.projectId + ' typhoon');
    if (site.presentation && site.presentation.sequence === 'contentOrder') {
      assert.ok(site.contentOrder.indexOf('warning') >= 0, row.projectId + ' order warning');
      assert.ok(site.contentOrder.indexOf('typhoon') >= 0, row.projectId + ' order typhoon');
      assert.ok(site.contentOrder.indexOf('warning') < site.contentOrder.indexOf('clock'), row.projectId + ' warning before clock');
    }
  });
  assert.strictEqual(tpl.contents.warning.on, true);
  assert.strictEqual(tpl.contents.typhoon.on, true);
  assert.strictEqual(tpl.contentOrder[0], 'warning');
  assert.strictEqual(tpl.contentOrder[1], 'typhoon');
});

test('熱中症警戒アラートは明示した案件以外と新規テンプレートでオフ', function () {
  var index = require('../sites/index.json');
  var tpl = require('../sites/_template.json');
  var heatOn = { 'AC-0014': true };
  index.sites.forEach(function (row) {
    var site = require('../sites/' + row.projectId + '.json');
    if (heatOn[row.projectId]) {
      assert.strictEqual(site.contents.heat.on, true, row.projectId + ' heat');
      assert.strictEqual(foundation.isContentOn(site, 'heat'), true, row.projectId + ' isContentOn heat');
      assert.ok(site.contentOrder.indexOf('heat') >= 0, row.projectId + ' order heat');
      return;
    }
    assert.strictEqual(site.contents.heat.on, false, row.projectId + ' heat');
    assert.strictEqual(foundation.isContentOn(site, 'heat'), false, row.projectId + ' isContentOn heat');
    if (Array.isArray(site.contentOrder)) {
      assert.ok(site.contentOrder.indexOf('heat') < 0, row.projectId + ' order heat');
    }
  });
  assert.strictEqual(tpl.contents.heat.on, false);
  assert.ok(tpl.contentOrder.indexOf('heat') < 0);
});

test('ニュースは各社の最新見出しを2件に揃える', function () {
  var news = require('../contents/news/index.js');
  var sato = news.parsePage('[＜協力会社のみなさまへ＞通報・相談窓口を設置しました お知らせ 2026年09月01日](https://www.satokogyo.co.jp/news/)\n[令和8年熊本地震へのお見舞いと対応について お知らせ 2026年08月07日](https://www.satokogyo.co.jp/news/)\n[古い記事 お知らせ 2026年07月01日](https://www.satokogyo.co.jp/news/)', 2);
  assert.strictEqual(sato.length, 2);
  assert.strictEqual(sato[0].date, '2026年09月01日');
  assert.strictEqual(sato[0].title, '＜協力会社のみなさまへ＞通報・相談窓口を設置しました');
  var ssk = news.parsePage(JSON.stringify([
    { date: '2026-07-16T19:16:30', title: { rendered: '富士インパルス株式会社  三好工場  増築工事　地鎮祭' } },
    { date: '2026-07-05T19:15:18', title: { rendered: 'アドプト・プログラム吉野川に参加' } },
    { date: '2026-06-19T19:19:23', title: { rendered: '佐々木建設安全衛生協力会通常総会・安全大会開催' } }
  ]), 2);
  assert.strictEqual(ssk.length, 2);
  assert.strictEqual(ssk[0].date, '2026年07月16日');
  assert.strictEqual(ssk[0].title, '富士インパルス株式会社 三好工場 増築工事 地鎮祭');
  var oshima = news.parsePage(JSON.stringify([
    { date: '2026-07-06T13:19:20', title: { rendered: 'オオシまガジン更新！' } },
    { date: '2026-07-06T13:18:26', title: { rendered: 'ホームページリニューアルのお知らせ' } }
  ]), 2);
  assert.strictEqual(oshima[0].title, 'オオシまガジン更新！');
  assert.strictEqual(oshima[1].title, 'ホームページリニューアルのお知らせ');
  var kisan = news.parsePage('[2026.9.28（仮称）SmAvCm新宮FM店新築工事の進捗状況【9/21-9/27】](https://kisan-k.co.jp/topics/a/)\n[2026.9.28（仮称）ジオガーデン中洲2丁目新築工事の進捗状況【9/21-9/26】](https://kisan-k.co.jp/topics/b/)\n[2026.9.24（仮称）古い進捗](https://kisan-k.co.jp/topics/c/)', 2);
  assert.strictEqual(kisan.length, 2);
  assert.strictEqual(kisan[0].date, '2026年09月28日');
  assert.strictEqual(kisan[0].title, '（仮称）SmAvCm新宮FM店新築工事の進捗状況【9/21-9/27】');
});

console.log('');
console.log(passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
