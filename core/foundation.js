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

  var OPERABLE_STATUS = { test: 1, demo: 1, active: 1 };

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
    if (s === 'demo') return SITE_RE.test(id) && id !== 'AC-0000';
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
      var on = false;
      if (c.existing && c.defaultOn !== false) on = !!allOn;
      out[c.id] = { on: on, durationMs: null };
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
    if (reg.defaultOn === false) return false;
    return !!reg.existing;
  }

  function denshoLive_(cfg) {
    return !!(cfg && cfg.densho && cfg.densho.apiUrl);
  }

  function neededFetches(cfg, seasonState) {
    var reg = global.AlertCubeRegistry;
    var set = {};
    if (!reg) return [];
    reg.CONTENTS.forEach(function (c) {
      if (!isContentOn(cfg, c.id, seasonState)) return;
      (c.fetch || []).forEach(function (f) { set[f] = true; });
    });
    var names = Object.keys(set);
    if (!denshoLive_(cfg)) return names;
    var wantsSensor = names.indexOf('jma-amedas') >= 0 || names.indexOf('moe-wbgt') >= 0;
    names = names.filter(function (name) {
      return name !== 'jma-amedas' && name !== 'moe-wbgt';
    });
    if (wantsSensor) names.push('densho-sensor');
    return names;
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
      densho: site.densho || null,
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
      clockFoot: site.clockFoot || '',
      schedule: site.schedule || { enabled: false, weekStartsOn: 1, items: [] },
      greeting: site.greeting || { enabled: false },
      presentation: site.presentation || {},
      contents: site.contents,
      contentOrder: site.contentOrder,
      edamSsc: site.edamSsc || null,
      news: site.news || null,
      boards: site.boards || null,
      progress: site.progress || null,
      logoScroll: site.logoScroll || null,
      brandScroll: site.brandScroll || null,
      elevation: site.elevation != null ? site.elevation : null,
      inundation: site.inundation || null,
      evacuation: site.evacuation || null,
      hazard: site.hazard || null,
      season: site.season,
      status: site.status || null
    };
  }

  function toLegacyBrand(site) {
    var logo = (site && site.logo) || {};
    var src = logo.src != null ? String(logo.src) : './images/logo.svg?v=20260921-suminoe';
    return {
      logoSrc: src,
      contentLogoSrc: String(logo.endSrc || '').trim() || src,
      logoAlt: (site && site.customer) || (site && site.siteName) || '',
      logoPanelBg: logo.panelBg || '#ffffff',
      logoPanelFollow: logo.panelFollow || '',
      logoCorpSrc: logo.corpSrc || src,
      footLogoSrc: (logo.footSrc === '' && !String(logo.bannerSrc || '').trim()) ? '' : (logo.footSrc || src),
      hideFootMark: logo.footSrc === '' && !String(logo.bannerSrc || '').trim() && !!String(src || '').trim(),
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
    if (json.densho) base.densho = Object.assign({}, base.densho || {}, json.densho);
    if (json.wbgt) base.wbgt = Object.assign({}, base.wbgt || {}, json.wbgt);
    if (json.geo) base.geo = Object.assign({}, base.geo || {}, json.geo);
    if (json.schedule) base.schedule = json.schedule;
    if (json.greeting) base.greeting = json.greeting;
    if (json.presentation) base.presentation = Object.assign({}, base.presentation || {}, json.presentation);
    if (json.edamSsc) base.edamSsc = json.edamSsc;
    if (json.news) base.news = json.news;
    if (json.boards) base.boards = json.boards;
    if (json.progress) base.progress = json.progress;
    if (json.logoScroll) base.logoScroll = json.logoScroll;
    if (json.brandScroll) base.brandScroll = json.brandScroll;
    if (json.faces != null) base.faces = json.faces;
    if (json.profile || json.layout) base.profile = json.layout || json.profile;
    if (json.timeZone) base.timeZone = json.timeZone;
    if (json.footSource) base.footSource = json.footSource;
    if (json.clockFoot != null) base.clockFoot = json.clockFoot;
    if (json.updateSettings && json.updateSettings.refreshMs) base.refreshMs = json.updateSettings.refreshMs;
    if (json.projectId) base.projectId = json.projectId;
    if (json.schemaVersion) base.schemaVersion = json.schemaVersion;
    if (json.releasePin !== undefined) base.releasePin = json.releasePin;
    if (json.contents) base.contents = json.contents;
    if (json.contentOrder) base.contentOrder = json.contentOrder;
    if (json.status) base.status = json.status;
    if (json.season) base.season = json.season;
    if (json.customer != null && base.site) base.site.customer = json.customer;
    if (json.rental != null && base.site) base.site.rental = json.rental;
    if (json.siteName && base.site) {
      base.site.label = json.siteName;
      base.site.locationLabel = json.siteName;
    }
    if (json.label && base.site) base.site.label = json.label;
    if (json.location && base.site) base.site.address = json.location;
    if (json.elevation !== undefined) base.elevation = json.elevation;
    if (json.inundation) base.inundation = json.inundation;
    if (json.evacuation) base.evacuation = json.evacuation;
    if (json.hazard) base.hazard = json.hazard;
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

  var SITE_CACHE_PREFIX = 'alertcube.site.v1.';

  function sameSiteJson_(siteId, json) {
    if (!json || !validateSiteConfig(json).ok) return false;
    return String(json.projectId || '').toUpperCase() === String(siteId || '').toUpperCase();
  }

  function chooseBootConfig(siteId, networkJson, rememberedJson) {
    if (sameSiteJson_(siteId, networkJson)) return { ready: true, source: 'network', json: networkJson };
    if (sameSiteJson_(siteId, rememberedJson)) return { ready: true, source: 'cache', json: rememberedJson };
    return { ready: false, source: 'waiting', json: null };
  }

  function rememberSiteJson(siteId, json) {
    try {
      if (!sameSiteJson_(siteId, json) || !global.localStorage) return;
      global.localStorage.setItem(SITE_CACHE_PREFIX + String(siteId).toUpperCase(), JSON.stringify(json));
    } catch (_) {}
  }

  function readRememberedSiteJson(siteId) {
    try {
      if (!global.localStorage) return null;
      var raw = global.localStorage.getItem(SITE_CACHE_PREFIX + String(siteId).toUpperCase());
      if (!raw) return null;
      var json = JSON.parse(raw);
      return sameSiteJson_(siteId, json) ? json : null;
    } catch (_) {
      return null;
    }
  }

  function bootSync() {
    var resolved = resolveSiteId();
    resolved.configReady = false;
    var legacy = global.SignageConfig || null;
    if (legacy && String(legacy.projectId || '').toUpperCase() === resolved.siteId) {
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
    resolved.configReady = false;
    return Promise.all([loadCatalog(), loadSiteJson(resolved.siteId)]).then(function (parts) {
      return parts[1];
    }).then(function (result) {
      var networkJson = result && result.ok ? result.json : null;
      var chosen = chooseBootConfig(resolved.siteId, networkJson, readRememberedSiteJson(resolved.siteId));
      global.AlertCubeSite = resolved;
      if (!chosen.ready) {
        resolved.configReady = false;
        resolved.configSource = 'waiting';
        resolved.operable = false;
        Log.warn('config', resolved.siteId + ' is not available; holding until that site file loads');
        return {
          site: resolved,
          config: currentConfig(),
          jsonOk: false,
          operable: false,
          configReady: false
        };
      }
      if (chosen.source === 'network') rememberSiteJson(resolved.siteId, chosen.json);
      resolved.status = normalizeStatus(chosen.json.status || catalogStatus(resolved.siteId), resolved.siteId);
      resolved.operable = isStatusOperable(resolved.status, resolved.siteId);
      resolved.configReady = true;
      resolved.configSource = chosen.source;
      var merged = mergeJsonOntoLegacy(chosen.json, global.SignageConfig);
      merged.status = resolved.status;
      applyToGlobals(merged, toLegacyBrand(chosen.json));
      if (global.AlertCubeRuntime && global.AlertCubeRuntime.applyFixedShell) {
        isolate('shell', function () { global.AlertCubeRuntime.applyFixedShell(); });
      }
      if (!resolved.operable) {
        Log.warn('lifecycle', resolved.siteId + ' status=' + resolved.status + ' — live fetch disabled');
      } else {
        Log.info('config', 'applied ' + resolved.siteId + ' status=' + resolved.status + ' via ' + chosen.source);
      }
      return {
        site: resolved,
        config: currentConfig(),
        jsonOk: chosen.source === 'network',
        operable: resolved.operable,
        configReady: true
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
    chooseBootConfig: chooseBootConfig,
    rememberSiteJson: rememberSiteJson,
    readRememberedSiteJson: readRememberedSiteJson,
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
