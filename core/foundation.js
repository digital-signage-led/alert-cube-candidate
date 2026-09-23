/**
 * Alert Cube 共通基盤（起動・案件・設定・ON/OFF・隔離・Retry・ログ）
 * 案件専用処理はここにハードコードしない。デザイン値は持たない。
 */
(function (global) {
  'use strict';

  var DEFAULT_SITE = 'AC-0001';
  var SITE_RE = /^AC-[0-9]{4}$/i;
  var logs_ = [];
  var MAX_LOGS = 200;
  var lastGoodConfig_ = null;
  var catalog_ = null;

  var OPERABLE_STATUS = { test: 1, active: 1 };

  function normalizeStatus(status, siteId) {
    var s = status != null && status !== '' ? String(status).toLowerCase() : '';
    var id = String(siteId || '').toUpperCase();
    if (id === 'AC-0000') return s || 'test';
    return s || 'active';
  }

  function isStatusOperable(status, siteId) {
    var id = String(siteId || '').toUpperCase();
    var s = normalizeStatus(status, id);
    if (s === 'test') return id === 'AC-0000';
    return !!OPERABLE_STATUS[s] && s === 'active';
  }

  function catalogStatus(siteId) {
    var id = String(siteId || '').toUpperCase();
    var list = catalog_ && catalog_.sites;
    if (!list) return null;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].projectId || '').toUpperCase() === id) return list[i].status || null;
    }
    return null;
  }

  function loadCatalog() {
    if (typeof fetch !== 'function') {
      return Promise.resolve({ ok: false, reason: 'no-fetch' });
    }
    return fetch('./sites/index.json', { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (json) {
      catalog_ = json;
      return { ok: true, catalog: json };
    }).catch(function (err) {
      Log.warn('catalog', 'sites/index.json load failed', { err: String(err && err.message || err) });
      return { ok: false, reason: 'fetch', error: String(err && err.message || err) };
    });
  }

  function currentSiteId() {
    if (global.AlertCubeSite && global.AlertCubeSite.siteId) return global.AlertCubeSite.siteId;
    var cfg = currentConfig();
    return (cfg && cfg.projectId) || DEFAULT_SITE;
  }

  function currentStatus() {
    var id = currentSiteId();
    var cfg = currentConfig();
    var site = global.AlertCubeSite || {};
    return normalizeStatus((cfg && cfg.status) || site.status || catalogStatus(id), id);
  }

  function isCurrentOperable() {
    return isStatusOperable(currentStatus(), currentSiteId());
  }

  function contentDurationMs(id, fallback) {
    var cfg = currentConfig();
    var item = cfg && cfg.contents && cfg.contents[id];
    var n = item && item.durationMs != null ? Number(item.durationMs) : NaN;
    if (Number.isFinite(n) && n > 0) return n;
    return fallback;
  }

  function contentOrderOf(cfg) {
    var c = cfg || currentConfig();
    return (c && Array.isArray(c.contentOrder) && c.contentOrder.length) ? c.contentOrder.slice() : [];
  }

  function nowIso() {
    try { return new Date().toISOString(); } catch (_) { return String(Date.now()); }
  }

  function log(level, scope, message, extra) {
    var row = { t: nowIso(), level: level, scope: scope, message: String(message || ''), extra: extra || null };
    logs_.push(row);
    if (logs_.length > MAX_LOGS) logs_.shift();
    var line = '[AC ' + level + '][' + scope + '] ' + row.message;
    if (level === 'error') console.error(line, extra || '');
    else if (level === 'warn') console.warn(line, extra || '');
    else console.log(line, extra || '');
    return row;
  }

  var Log = {
    debug: function (s, m, e) { return log('debug', s, m, e); },
    info: function (s, m, e) { return log('info', s, m, e); },
    warn: function (s, m, e) { return log('warn', s, m, e); },
    error: function (s, m, e) { return log('error', s, m, e); },
    dump: function () { return logs_.slice(); }
  };

  function queryParams(search) {
    try {
      return new URLSearchParams(search || (global.location && global.location.search) || '');
    } catch (_) {
      return { get: function () { return null; } };
    }
  }

  function resolveSiteId(search) {
    var q = queryParams(search);
    var raw = q.get('site') || q.get('project') || q.get('ac');
    if (raw == null || raw === '') {
      return { siteId: DEFAULT_SITE, source: 'default', valid: true, raw: '' };
    }
    var id = String(raw).trim().toUpperCase();
    if (!SITE_RE.test(id)) {
      Log.warn('url', 'invalid site parameter, fallback ' + DEFAULT_SITE, { raw: raw });
      return { siteId: DEFAULT_SITE, source: 'invalid-fallback', valid: false, raw: raw };
    }
    return { siteId: id, source: 'query', valid: true, raw: raw };
  }

  function clone_(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function defaultContents(allOn) {
    var reg = global.AlertCubeRegistry;
    var out = {};
    if (!reg) return out;
    reg.CONTENTS.forEach(function (c) {
      out[c.id] = {
        on: c.existing ? !!allOn : false,
        durationMs: null
      };
    });
    return out;
  }

  function validateSiteConfig(cfg) {
    var errors = [];
    if (!cfg || typeof cfg !== 'object') return { ok: false, errors: ['config-missing'] };
    if (!cfg.projectId || !SITE_RE.test(String(cfg.projectId))) errors.push('projectId');
    if (!cfg.resolution && !(cfg.layout)) errors.push('resolution');
    if (!cfg.contents || typeof cfg.contents !== 'object') errors.push('contents');
    if (cfg.schemaVersion != null && Number(cfg.schemaVersion) > 1) {
      Log.warn('config', 'newer schemaVersion, reading compatible fields only', { v: cfg.schemaVersion });
    }
    return { ok: errors.length === 0, errors: errors };
  }

  function applyContentsDefaults(cfg) {
    var next = cfg || {};
    var base = defaultContents(true);
    var incoming = next.contents || {};
    Object.keys(base).forEach(function (id) {
      if (!incoming[id]) incoming[id] = base[id];
      else if (typeof incoming[id].on !== 'boolean') incoming[id].on = base[id].on;
    });
    next.contents = incoming;
    return next;
  }

  /**
   * 優先順位:
   * 1. 安全系の明示 ON/OFF
   * 2. 案件の明示 ON/OFF
   * 3. season.override
   * 4. 自動季節
   */
  function isContentOn(cfg, id, seasonState) {
    var reg = global.AlertCubeRegistry && global.AlertCubeRegistry.byId(id);
    var item = cfg && cfg.contents && cfg.contents[id];
    if (item && item.on === false) return false;
    if (!reg) return !!(item && item.on);
    if (!reg.existing) return false;
    if (item && item.on === false) return false;
    if (reg.safety && item && item.on === true) return true;
    if (reg.seasonal && seasonState && seasonState.hideSeasonal && item && item.on !== true) {
      return false;
    }
    if (item && typeof item.on === 'boolean') return item.on;
    return !!reg.existing;
  }

  function neededFetches(cfg, seasonState) {
    var reg = global.AlertCubeRegistry;
    var set = {};
    if (!reg) return [];
    reg.CONTENTS.forEach(function (c) {
      if (!isContentOn(cfg, c.id, seasonState)) return;
      (c.fetch || []).forEach(function (f) { set[f] = true; });
    });
    return Object.keys(set);
  }

  function isScene2PanelOn(cfg, panel, seasonState) {
    var id = global.AlertCubeRegistry ? global.AlertCubeRegistry.panelContentId(panel) : panel;
    if (panel === 'logo') return true;
    return isContentOn(cfg, id, seasonState);
  }

  function isolate(scope, fn, fallback) {
    try {
      return fn();
    } catch (err) {
      Log.error(scope, err && err.message ? err.message : err, { stack: err && err.stack });
      return typeof fallback === 'function' ? fallback(err) : fallback;
    }
  }

  function isolateAsync(scope, work) {
    try {
      return Promise.resolve(work()).catch(function (err) {
        Log.error(scope, err && err.message ? err.message : err);
        return { ok: false, isolated: true, error: String(err && err.message || err) };
      });
    } catch (err) {
      Log.error(scope, err && err.message ? err.message : err);
      return Promise.resolve({ ok: false, isolated: true, error: String(err && err.message || err) });
    }
  }

  function backoffMs(attempt) {
    var n = Math.max(0, Number(attempt) || 0);
    var ms = 15000 * Math.pow(2, Math.min(n, 4));
    return Math.min(ms, 300000);
  }

  function rememberGoodConfig(cfg) {
    if (cfg && validateSiteConfig(cfg).ok) {
      lastGoodConfig_ = clone_(cfg);
    }
    return lastGoodConfig_;
  }

  function lastGoodConfig() {
    return lastGoodConfig_ ? clone_(lastGoodConfig_) : null;
  }

  function toLegacySignageConfig(site) {
    if (!site) return null;
    return {
      projectId: site.projectId,
      schemaVersion: site.schemaVersion || 1,
      releasePin: site.releasePin || null,
      site: {
        customer: site.customer || '',
        rental: site.rental || '',
        label: site.siteName || '',
        address: site.location || '',
        locationLabel: site.siteName || site.location || ''
      },
      moe: site.moe || {},
      jma: site.jma || {},
      wbgt: site.wbgt || {
        seasonStart: { month: 4, day: 22 },
        seasonEnd: { month: 10, day: 22 }
      },
      faces: site.faces || 4,
      profile: site.layout || 'AC-512',
      geo: {
        lat: site.latitude,
        lon: site.longitude
      },
      timeZone: site.timeZone || 'Asia/Tokyo',
      refreshMs: (site.updateSettings && site.updateSettings.refreshMs) || 60000,
      footSource: site.footSource || '出典：気象庁・環境省データ',
      schedule: site.schedule || { enabled: false, weekStartsOn: 1, items: [] },
      greeting: site.greeting || { enabled: false },
      presentation: site.presentation || {},
      contents: site.contents,
      contentOrder: site.contentOrder,
      news: site.news || null,
      boards: site.boards || null,
      logoScroll: site.logoScroll || null,
      season: site.season,
      status: site.status || null
    };
  }

  function toLegacyBrand(site) {
    var logo = (site && site.logo) || {};
    var src = logo.src || './images/logo.svg?v=20260921-suminoe';
    return {
      logoSrc: src,
      logoAlt: (site && site.customer) || (site && site.siteName) || '',
      logoPanelBg: logo.panelBg || '#ffffff',
      logoCorpSrc: logo.corpSrc || src,
      footLogoSrc: logo.footSrc || src,
      footBannerSrc: logo.bannerSrc || '',
      logoWideSrc: logo.wideSrc || ''
    };
  }

  function mergeJsonOntoLegacy(json, legacy) {
    var base = legacy ? clone_(legacy) : {};
    if (!json) return applyContentsDefaults(base);
    if (json.site) base.site = Object.assign({}, base.site || {}, json.site);
    if (json.moe) base.moe = Object.assign({}, base.moe || {}, json.moe);
    if (json.jma) base.jma = Object.assign({}, base.jma || {}, json.jma);
    if (json.wbgt) base.wbgt = Object.assign({}, base.wbgt || {}, json.wbgt);
    if (json.geo) base.geo = Object.assign({}, base.geo || {}, json.geo);
    if (json.schedule) base.schedule = json.schedule;
    if (json.greeting) base.greeting = json.greeting;
    if (json.presentation) base.presentation = Object.assign({}, base.presentation || {}, json.presentation);
    if (json.news) base.news = json.news;
    if (json.boards) base.boards = json.boards;
    if (json.logoScroll) base.logoScroll = json.logoScroll;
    if (json.faces != null) base.faces = json.faces;
    if (json.profile || json.layout) base.profile = json.layout || json.profile;
    if (json.timeZone) base.timeZone = json.timeZone;
    if (json.updateSettings && json.updateSettings.refreshMs) base.refreshMs = json.updateSettings.refreshMs;
    if (json.projectId) base.projectId = json.projectId;
    if (json.schemaVersion) base.schemaVersion = json.schemaVersion;
    if (json.releasePin !== undefined) base.releasePin = json.releasePin;
    if (json.contents) base.contents = json.contents;
    if (json.contentOrder) base.contentOrder = json.contentOrder;
    if (json.status) base.status = json.status;
    if (json.season) base.season = json.season;
    if (json.customer != null && base.site) base.site.customer = json.customer;
    if (json.siteName && base.site) {
      base.site.label = json.siteName;
      base.site.locationLabel = json.siteName;
    }
    if (json.label && base.site) base.site.label = json.label;
    if (json.location && base.site) base.site.address = json.location;
    if (json.latitude != null) {
      base.geo = base.geo || {};
      base.geo.lat = json.latitude;
    }
    if (json.longitude != null) {
      base.geo = base.geo || {};
      base.geo.lon = json.longitude;
    }
    return applyContentsDefaults(base);
  }

  function copyOnto_(dest, src) {
    if (!dest || !src) return dest;
    Object.keys(dest).forEach(function (k) { delete dest[k]; });
    Object.keys(src).forEach(function (k) { dest[k] = src[k]; });
    return dest;
  }

  function applyToGlobals(siteOrLegacy, brand) {
    var legacy = siteOrLegacy && siteOrLegacy.moe ? siteOrLegacy : toLegacySignageConfig(siteOrLegacy);
    if (legacy) {
      if (global.SignageConfig) {
        copyOnto_(global.SignageConfig, legacy);
      } else {
        global.SignageConfig = legacy;
      }
      rememberGoodConfig(global.SignageConfig);
    }
    if (brand || siteOrLegacy) {
      var nextBrand = brand || toLegacyBrand(siteOrLegacy);
      if (global.SIGNAGE_CONFIG) {
        copyOnto_(global.SIGNAGE_CONFIG, nextBrand);
      } else {
        global.SIGNAGE_CONFIG = nextBrand;
      }
    }
    return global.SignageConfig || legacy;
  }

  function currentConfig() {
    return global.SignageConfig || lastGoodConfig() || null;
  }

  var Content = {
    isOn: function (id, seasonState) {
      return isContentOn(currentConfig(), id, seasonState);
    },
    panelOn: function (panel, seasonState) {
      return isScene2PanelOn(currentConfig(), panel, seasonState);
    },
    fetches: function (seasonState) {
      return neededFetches(currentConfig(), seasonState);
    },
    shouldFetch: function (name, seasonState) {
      return neededFetches(currentConfig(), seasonState).indexOf(name) >= 0;
    }
  };

  function bootSync() {
    var resolved = resolveSiteId();
    var legacy = global.SignageConfig || null;
    if (legacy) {
      legacy.projectId = legacy.projectId || resolved.siteId;
      applyContentsDefaults(legacy);
      rememberGoodConfig(legacy);
    }
    global.AlertCubeSite = resolved;
    Log.info('boot', 'site=' + resolved.siteId + ' source=' + resolved.source, {
      release: global.AlertCubeVersion && global.AlertCubeVersion.RELEASE
    });
    return resolved;
  }

  function loadSiteJson(siteId) {
    var path = './sites/' + siteId + '.json';
    if (typeof fetch !== 'function') {
      return Promise.resolve({ ok: false, reason: 'no-fetch', path: path });
    }
    return fetch(path, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (json) {
      var check = validateSiteConfig(json);
      if (!check.ok) {
        Log.warn('config', 'site json validation failed, keep last good', check.errors);
        return { ok: false, reason: 'invalid', errors: check.errors, json: json };
      }
      return { ok: true, json: json, path: path };
    }).catch(function (err) {
      Log.warn('config', 'site json load failed, keep last good', { siteId: siteId, err: String(err && err.message || err) });
      return { ok: false, reason: 'fetch', error: String(err && err.message || err) };
    });
  }

  function bootAsync() {
    var resolved = global.AlertCubeSite || bootSync();
    return loadCatalog().then(function () {
      return loadSiteJson(resolved.siteId);
    }).then(function (result) {
      var jsonStatus = result && result.json && result.json.status;
      resolved.status = normalizeStatus(jsonStatus || catalogStatus(resolved.siteId), resolved.siteId);
      resolved.operable = isStatusOperable(resolved.status, resolved.siteId);
      global.AlertCubeSite = resolved;
      if (result && result.ok && result.json) {
        var merged = mergeJsonOntoLegacy(result.json, global.SignageConfig);
        merged.status = resolved.status;
        applyToGlobals(merged, toLegacyBrand(result.json));
        if (global.AlertCubeRuntime && global.AlertCubeRuntime.applyFixedShell) {
          isolate('shell', function () { global.AlertCubeRuntime.applyFixedShell(); });
        }
        if (!resolved.operable) {
          Log.warn('lifecycle', resolved.siteId + ' status=' + resolved.status + ' — live fetch disabled');
        } else {
          Log.info('config', 'applied ' + resolved.siteId + ' status=' + resolved.status);
        }
      } else if (global.SignageConfig) {
        applyContentsDefaults(global.SignageConfig);
        Log.info('config', 'using last-known site-config.js');
      }
      return {
        site: resolved,
        config: currentConfig(),
        jsonOk: !!(result && result.ok),
        operable: resolved.operable
      };
    });
  }

  var api = {
    DEFAULT_SITE: DEFAULT_SITE,
    Log: Log,
    resolveSiteId: resolveSiteId,
    validateSiteConfig: validateSiteConfig,
    applyContentsDefaults: applyContentsDefaults,
    isContentOn: isContentOn,
    neededFetches: neededFetches,
    isScene2PanelOn: isScene2PanelOn,
    isolate: isolate,
    isolateAsync: isolateAsync,
    backoffMs: backoffMs,
    rememberGoodConfig: rememberGoodConfig,
    lastGoodConfig: lastGoodConfig,
    toLegacySignageConfig: toLegacySignageConfig,
    toLegacyBrand: toLegacyBrand,
    mergeJsonOntoLegacy: mergeJsonOntoLegacy,
    applyToGlobals: applyToGlobals,
    currentConfig: currentConfig,
    Content: Content,
    bootSync: bootSync,
    bootAsync: bootAsync,
    loadSiteJson: loadSiteJson,
    loadCatalog: loadCatalog,
    normalizeStatus: normalizeStatus,
    isStatusOperable: isStatusOperable,
    isCurrentOperable: isCurrentOperable,
    currentStatus: currentStatus,
    contentDurationMs: contentDurationMs,
    contentOrderOf: contentOrderOf
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeFoundation = api;
  global.AlertCubeLog = Log;
  global.AlertCubeContent = Content;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
