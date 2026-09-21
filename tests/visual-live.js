/**
 * ローカル Pages 相当で AC-0000 / AC-0001 をブラウザ確認する。
 * 実行: node tests/visual-live.js http://127.0.0.1:3200
 */
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var BASE = (process.argv[2] || 'http://127.0.0.1:3200').replace(/\/$/, '');
var outDir = path.join(__dirname, 'screenshots');

function ensureDir() {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
}

function launchBrowser() {
  try {
    return Promise.resolve(require('puppeteer'));
  } catch (_) {
    return import('puppeteer').then(function (m) { return m.default || m; }).catch(function () {
      throw new Error('puppeteer がありません。npx --yes puppeteer で入れてから再実行してください');
    });
  }
}

function collectMetrics(page) {
  return page.evaluate(function () {
    function box(sel) {
      var el = document.querySelector(sel);
      if (!el) return null;
      var r = el.getBoundingClientRect();
      var cs = getComputedStyle(el);
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        display: cs.display,
        font: cs.fontFamily,
        fontSize: cs.fontSize,
        color: cs.color,
        bg: cs.backgroundColor,
        overflow: cs.overflow
      };
    }
    var cfg = window.SignageConfig || {};
    return {
      siteId: (window.AlertCubeSite && window.AlertCubeSite.siteId) || cfg.projectId || '',
      status: cfg.status || '',
      location: (cfg.site && cfg.site.locationLabel) || '',
      customer: (cfg.site && cfg.site.customer) || '',
      schedule0: cfg.schedule && cfg.schedule.items && cfg.schedule.items[0] && cfg.schedule.items[0].work,
      logoSrc: (window.SIGNAGE_CONFIG && window.SIGNAGE_CONFIG.logoSrc) || '',
      bannerSrc: (window.SIGNAGE_CONFIG && window.SIGNAGE_CONFIG.footBannerSrc) || '',
      contentsOn: cfg.contents ? Object.keys(cfg.contents).filter(function (k) { return cfg.contents[k] && cfg.contents[k].on; }) : [],
      scene1: box('#scene1'),
      scene2: box('#scene2'),
      scene4: box('#scene4'),
      clock: box('#scene1 .clock-hm'),
      logo: box('.s2-logo-face-img, .s1-wbgt-banner'),
      body: { w: document.documentElement.clientWidth, h: document.documentElement.clientHeight }
    };
  });
}

async function openPage(browser, url) {
  var page = await browser.newPage();
  await page.setViewport({ width: 512, height: 128, deviceScaleFactor: 1 });
  page.on('pageerror', function (err) {
    page.__pageErrors = (page.__pageErrors || []).concat([String(err && err.message || err)]);
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(function () {
    return !!(window.SignageConfig && window.AlertCubeSite && window.AlertCubeSite.siteId);
  }, { timeout: 30000 });
  await new Promise(function (r) { setTimeout(r, 2500); });
  return page;
}

function sameLayout(a, b, label) {
  if (!a || !b) throw new Error(label + ' missing box');
  assert.strictEqual(a.x, b.x, label + '.x');
  assert.strictEqual(a.y, b.y, label + '.y');
  assert.strictEqual(a.w, b.w, label + '.w');
  assert.strictEqual(a.h, b.h, label + '.h');
  assert.strictEqual(a.font, b.font, label + '.font');
  assert.strictEqual(a.fontSize, b.fontSize, label + '.fontSize');
}

async function run() {
  ensureDir();
  var puppeteer = await launchBrowser();
  var browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  var passed = 0;
  var failed = 0;
  function ok(name) { passed += 1; console.log('OK  ' + name); }
  function ng(name, e) { failed += 1; console.error('NG  ' + name); console.error('    ' + (e && e.message ? e.message : e)); }

  var pDefault;
  var p0001;
  var p0000;
  var p0002;
  var pGust;
  try {
    pDefault = await openPage(browser, BASE + '/');
    p0001 = await openPage(browser, BASE + '/?site=AC-0001');
    p0000 = await openPage(browser, BASE + '/?site=AC-0000');
    p0002 = await openPage(browser, BASE + '/?site=AC-0002');
    pGust = await openPage(browser, BASE + '/?site=AC-0001&only=s2');

    var mDef = await collectMetrics(pDefault);
    var m1 = await collectMetrics(p0001);
    var m0 = await collectMetrics(p0000);
    var m2 = await collectMetrics(p0002);

    await pDefault.screenshot({ path: path.join(outDir, 'local-default.png') });
    await p0001.screenshot({ path: path.join(outDir, 'local-AC-0001.png') });
    await p0000.screenshot({ path: path.join(outDir, 'local-AC-0000.png') });
    await p0002.screenshot({ path: path.join(outDir, 'local-AC-0002.png') });

    try {
      assert.strictEqual(mDef.siteId, 'AC-0001');
      assert.strictEqual(m1.siteId, 'AC-0001');
      assert.strictEqual(m1.location, '住之江区');
      assert.strictEqual(m1.customer, 'デジタルサイネージ');
      assert.strictEqual(m1.schedule0, '足場組立');
      ok('AC-0001 / は JSON 適用後も本番 last-good と同じ案件');
    } catch (e) { ng('AC-0001 案件適用', e); }

    try {
      assert.strictEqual(m0.siteId, 'AC-0000');
      assert.strictEqual(m0.location, '内部テスト');
      assert.strictEqual(m0.customer, '');
      assert.strictEqual(m0.schedule0, '検証A');
      ok('AC-0000 はスナップショットではなく sites/AC-0000.json を表示する');
    } catch (e) { ng('AC-0000 スナップショット修正', e); }

    try {
      assert.strictEqual(m2.siteId, 'AC-0002');
      assert.strictEqual(m2.location, '磯子区');
      assert.strictEqual(m2.customer, 'エネオス株式会社');
      assert.strictEqual(m2.schedule0, undefined);
      assert.ok(m2.logoSrc.indexOf('assets/sites/AC-0002/eneos_logo.gif') >= 0);
      assert.ok(m2.bannerSrc.indexOf('assets/sites/AC-0002/eneos_lockup.png') >= 0);
      assert.ok(m2.contentsOn.indexOf('schedule') < 0);
      assert.ok(m2.contentsOn.indexOf('typhoon') < 0);
      ok('旧ENEOS磯子案件をAC-0002のV2.0設定として適用');
    } catch (e) { ng('AC-0002 案件適用', e); }

    try {
      sameLayout(mDef.scene1, m1.scene1, 'scene1 default vs AC-0001');
      sameLayout(mDef.clock, m1.clock, 'clock default vs AC-0001');
      assert.strictEqual(mDef.body.w, 512);
      assert.strictEqual(mDef.body.h, 128);
      ok('Visual: / と /?site=AC-0001 のレイアウト一致');
    } catch (e) { ng('Visual AC-0001 self', e); }

    try {
      sameLayout(m0.scene1, m1.scene1, 'scene1 AC-0000 vs AC-0001');
      sameLayout(m0.clock, m1.clock, 'clock AC-0000 vs AC-0001');
      assert.strictEqual(m0.body.w, m1.body.w);
      assert.strictEqual(m0.body.h, m1.body.h);
      ok('Visual: AC-0000 と AC-0001 は位置・サイズ・Fontを共有（文言差のみ）');
    } catch (e) { ng('Visual layout share', e); }

    try {
      var existing = ['clock', 'weather', 'temperature', 'rain', 'wind', 'humidity', 'pressure', 'temp-range', 'wbgt', 'wbgt-i18n', 'forecast', 'warning', 'warning-hero', 'rain-nowcast', 'typhoon', 'disaster', 'heat', 'schedule'];
      existing.forEach(function (id) {
        assert.ok(m0.contentsOn.indexOf(id) >= 0, 'AC-0000 missing ON ' + id);
      });
      assert.ok(m0.contentsOn.indexOf('pollen') < 0);
      assert.ok(m0.contentsOn.indexOf('pm25') < 0);
      ok('AC-0000 全 active Content が ON（未実装はOFF）');
    } catch (e) { ng('AC-0000 contents', e); }

    try {
      assert.ok(!(p0000.__pageErrors && p0000.__pageErrors.length), 'AC-0000 pageerror ' + (p0000.__pageErrors || []).join('; '));
      assert.ok(!(p0001.__pageErrors && p0001.__pageErrors.length), 'AC-0001 pageerror ' + (p0001.__pageErrors || []).join('; '));
      assert.ok(!(p0002.__pageErrors && p0002.__pageErrors.length), 'AC-0002 pageerror ' + (p0002.__pageErrors || []).join('; '));
      ok('ブラウザ例外なし');
    } catch (e) { ng('pageerror', e); }

    try {
      var gust = await pGust.evaluate(function () {
        var idx = window.scene2TypesOn_().indexOf('gust');
        window.paintScene2Type_(idx);
        var panel = document.querySelector('#scene2 [data-s2="gust"]');
        return {
          count: document.querySelectorAll('#scene2 [data-s2="gust"]').length,
          label: panel && panel.querySelector('.s2-bar-label') && panel.querySelector('.s2-bar-label').textContent
        };
      });
      assert.strictEqual(gust.count, 4);
      assert.strictEqual(gust.label, '最大瞬間風速');
      ok('旧本番の最大瞬間風速を共通気象コンテンツとして表示');
    } catch (e) { ng('最大瞬間風速', e); }

    try {
      await p0001.evaluate(function () { window.persistSignageStateCache_(); });
      await p0000.evaluate(function () { window.persistSignageStateCache_(); });
      await p0002.evaluate(function () { window.persistSignageStateCache_(); });
      var cacheKeys = await p0001.evaluate(function () {
        return Object.keys(localStorage).filter(function (key) {
          return key.indexOf('alert_cube_signage_state_v2_') === 0;
        });
      });
      assert.ok(cacheKeys.some(function (key) { return key.indexOf('_AC-0001_') >= 0; }));
      assert.ok(cacheKeys.some(function (key) { return key.indexOf('_AC-0000_') >= 0; }));
      assert.ok(cacheKeys.some(function (key) { return key.indexOf('_AC-0002_') >= 0; }));
      ok('Last Known Good表示データを案件ID単位で分離');
    } catch (e) { ng('案件別表示キャッシュ', e); }

    console.log('');
    console.log(JSON.stringify({ default: mDef, ac0001: m1, ac0000: m0, ac0002: m2 }, null, 2));
  } finally {
    await browser.close();
  }
  console.log('');
  console.log(passed + ' passed, ' + failed + ' failed');
  if (failed) process.exit(1);
}

run().catch(function (e) {
  console.error(e);
  process.exit(1);
});
