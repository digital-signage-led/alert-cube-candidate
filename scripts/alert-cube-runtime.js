/**
 * 既存サイネージ本体と AlertCubeCore の接続。
 * 現場名は site-config からのみ読む。
 */
(function (global) {
  'use strict';

  var Core = global.AlertCubeCore;
  var seasonMode_ = Core ? Core.WBGT_MODE : 'WBGT_MODE';
  var currentTempC_ = null;
  var currentWbgtValue_ = null;
  var lastDisasterWatch_ = { status: 'unknown', issued: false, items: [], updatedAt: 0 };
  var savedPlayback_ = null;
  var disasterInterruptActive_ = false;

  function siteCfg() {
    return global.SignageConfig || {};
  }

  function brandCfg() {
    return global.SIGNAGE_CONFIG || {};
  }

  function locationLabel() {
    var s = siteCfg();
    return (s.site && s.site.locationLabel)
      || (s.jma && s.jma.forecastLabel)
      || (s.jma && s.jma.warnCityLabel)
      || '';
  }

  function customerName() {
    var s = siteCfg();
    return (s.site && s.site.customer) || (brandCfg().logoAlt) || '';
  }

  function applyFixedShell() {
    var loc = locationLabel();
    var name = customerName();
    var brand = brandCfg();
    var titleBits = ['Alert Cube'];
    if (name) titleBits.push(name);
    if (loc) titleBits.push(loc);
    document.title = titleBits.join(' - ');
    if (loc) {
      document.querySelectorAll('.s2-loc, .s1-foot-co-txt, .ra-white-area').forEach(function (el) {
        if (el.classList.contains('s1-foot-co-txt') && name) return;
        el.textContent = loc;
      });
    }
    if (name) {
      document.querySelectorAll('.s1-wbgt-banner[alt], .s2-logo-face-img, .fc-logo-face-img, .d5-logo-face-img, .logo-img, .logo-corp-img').forEach(function (el) {
        if (el.tagName === 'IMG') el.alt = name;
      });
    }
    if (brand.logoSrc) {
      document.querySelectorAll('.s2-logo-face-img, .fc-logo-face-img, .d5-logo-face-img, .logo-img, .logo-corp-img').forEach(function (el) {
        if (el.getAttribute('src') !== brand.logoSrc) el.src = brand.logoSrc;
      });
    }
    if (brand.footBannerSrc) {
      document.querySelectorAll('.s1-wbgt-banner').forEach(function (el) {
        if (el.tagName === 'IMG' && el.getAttribute('src') !== brand.footBannerSrc) el.src = brand.footBannerSrc;
      });
    }
  }

  function injectPreloads() {
    var brand = brandCfg();
    [brand.logoSrc, brand.footBannerSrc].forEach(function (href) {
      if (!href) return;
      if (document.querySelector('link[rel="preload"][href="' + href + '"]')) return;
      var link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = href;
      document.head.appendChild(link);
    });
  }

  function paintLocalClock(root) {
    try {
      var now = Date.now();
      var fmt = new Intl.DateTimeFormat('ja-JP', {
        timeZone: (siteCfg().timeZone) || 'Asia/Tokyo',
        month: 'numeric',
        day: 'numeric',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        hourCycle: 'h23'
      });
      var parts = {};
      fmt.formatToParts(new Date(now)).forEach(function (p) { parts[p.type] = p.value; });
      var dateTxt = Number(parts.month) + '月' + Number(parts.day) + '日(' + String(parts.weekday || '').replace('曜日', '') + ')';
      var hh = String(parts.hour || '00').padStart(2, '0');
      var mm = String(parts.minute || '00').padStart(2, '0');
      var scope = root || document;
      scope.querySelectorAll('#scene1 .s1-bar-label').forEach(function (el) { el.textContent = dateTxt; });
      scope.querySelectorAll('#scene1 .clock-hm').forEach(function (el) {
        var hEl = el.querySelector('.clock-h');
        var mEl = el.querySelector('.clock-m');
        if (hEl) hEl.textContent = hh;
        if (mEl) mEl.textContent = mm;
      });
    } catch (_) {}
  }

  function setSeasonMode(mode) {
    if (mode === Core.TEMPERATURE_MODE || mode === Core.WBGT_MODE) seasonMode_ = mode;
    return seasonMode_;
  }

  function getSeasonMode() {
    return seasonMode_;
  }

  function isWbgtMode() {
    return seasonMode_ === Core.WBGT_MODE;
  }

  function applyApiSeasonFlag(apiInService, previewOffseason, jstParts) {
    var next = Core.resolveSeasonMode({
      apiInService: apiInService,
      previewOffseason: previewOffseason,
      currentMode: seasonMode_,
      jstParts: jstParts,
      seasonCfg: siteCfg().wbgt
    });
    var changed = next !== seasonMode_;
    seasonMode_ = next;
    return { mode: seasonMode_, changed: changed };
  }

  function setCurrentTemp(temp) {
    if (temp == null || temp === '') return currentTempC_;
    var n = Number(temp);
    if (Number.isFinite(n)) currentTempC_ = n;
    return currentTempC_;
  }

  function getCurrentTemp() {
    return currentTempC_;
  }

  function setCurrentWbgt(wbgt) {
    if (wbgt == null || wbgt === '') return currentWbgtValue_;
    var n = Number(wbgt);
    if (Number.isFinite(n)) currentWbgtValue_ = n;
    return currentWbgtValue_;
  }

  function getCurrentWbgt() {
    return currentWbgtValue_;
  }

  function resolvePaint(alertKey) {
    return Core.resolveBackground({
      seasonMode: seasonMode_,
      wbgt: currentWbgtValue_,
      temperature: currentTempC_,
      alertKey: alertKey || ''
    });
  }

  function capturePlayback(state) {
    savedPlayback_ = Core.capturePlayback(state);
    return savedPlayback_;
  }

  function takePlayback() {
    var s = savedPlayback_;
    savedPlayback_ = null;
    return s;
  }

  function peekPlayback() {
    return savedPlayback_;
  }

  function setDisasterInterrupt(on) {
    disasterInterruptActive_ = !!on;
  }

  function isDisasterInterrupt() {
    return disasterInterruptActive_;
  }

  function mergeDisaster(fetchOk, items) {
    lastDisasterWatch_ = Core.mergeDisasterWatch(lastDisasterWatch_, {
      fetchOk: fetchOk,
      items: items
    });
    return lastDisasterWatch_;
  }

  function disasterWatch() {
    return lastDisasterWatch_;
  }

  function cacheKey(point, city) {
    return 'alert_cube_state_v3_' + String(point || '') + '_' + String(city || '');
  }

  global.AlertCubeRuntime = {
    applyFixedShell: applyFixedShell,
    injectPreloads: injectPreloads,
    paintLocalClock: paintLocalClock,
    setSeasonMode: setSeasonMode,
    getSeasonMode: getSeasonMode,
    isWbgtMode: isWbgtMode,
    applyApiSeasonFlag: applyApiSeasonFlag,
    setCurrentTemp: setCurrentTemp,
    getCurrentTemp: getCurrentTemp,
    setCurrentWbgt: setCurrentWbgt,
    getCurrentWbgt: getCurrentWbgt,
    resolvePaint: resolvePaint,
    capturePlayback: capturePlayback,
    takePlayback: takePlayback,
    peekPlayback: peekPlayback,
    setDisasterInterrupt: setDisasterInterrupt,
    isDisasterInterrupt: isDisasterInterrupt,
    mergeDisaster: mergeDisaster,
    disasterWatch: disasterWatch,
    cacheKey: cacheKey,
    locationLabel: locationLabel,
    customerName: customerName
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      injectPreloads();
      applyFixedShell();
      paintLocalClock();
    });
  } else {
    injectPreloads();
    applyFixedShell();
    paintLocalClock();
  }
})(typeof window !== 'undefined' ? window : this);
