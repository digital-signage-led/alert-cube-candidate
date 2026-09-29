/**
 * 地震・津波・水害の緊急割り込み判定。
 * 画面文言は気象庁が公表している警報名と、津波・高潮・洪水の行動案内を短くしたもの。
 * 海抜・想定浸水深から安全や危険は判定しない。
 *
 * 津波の行動の出典（短縮）:
 * https://www.jma.go.jp/jma/kishou/know/bosai/tsunami.html
 * 高潮・洪水の警報名の出典:
 * https://www.jma.go.jp/jma/kishou/know/bosai/warning_kind.html
 */
(function (global) {
  'use strict';

  var DEFAULT_PRIORITY = {
    earthquake: 10,
    'inundation-warning': 15,
    'flood-advisory': 20,
    'surge-advisory': 25,
    'flood-warning': 30,
    'inundation-special': 35,
    'tsunami-advisory': 40,
    'surge-warning': 50,
    'tsunami-warning': 60,
    'surge-special': 75,
    'tsunami-major': 80
  };

  var DEFAULT_KINDS = {
    earthquake: true,
    tsunami: true,
    surge: true,
    flood: true,
    inundation: true
  };

  var WARN_CODE = {
    '29': { kind: 'tsunami-advisory', group: 'tsunami' },
    '11': { kind: 'tsunami-warning', group: 'tsunami' },
    '34': { kind: 'tsunami-major', group: 'tsunami' },
    '19': { kind: 'surge-advisory', group: 'surge' },
    '08': { kind: 'surge-warning', group: 'surge' },
    '09': { kind: 'surge-warning', group: 'surge' },
    '38': { kind: 'surge-special', group: 'surge' },
    '18': { kind: 'flood-advisory', group: 'flood' },
    '04': { kind: 'flood-warning', group: 'flood' },
    '03': { kind: 'inundation-warning', group: 'inundation' },
    '33': { kind: 'inundation-special', group: 'inundation' }
  };

  var MAJOR_KIND = {
    'tsunami-warning': true,
    'tsunami-major': true,
    'surge-special': true,
    'inundation-special': true
  };

  var RANK = { '1': 1, '2': 2, '3': 3, '4': 4, '5-': 5, '5+': 6, '6-': 7, '6+': 8, '7': 9 };

  function settingsFrom(cfg) {
    var hazard = (cfg && cfg.hazard) || {};
    var minutes = Number(hazard.earthquakeVisibleMinutes);
    var face = Number(hazard.faceMs);
    return {
      minIntensity: hazard.minIntensity || '5弱',
      earthquakeVisibleMinutes: Number.isFinite(minutes) && minutes > 0 ? minutes : 30,
      faceMs: Number.isFinite(face) ? Math.min(15000, Math.max(2000, face)) : 4000,
      priorities: Object.assign({}, DEFAULT_PRIORITY, hazard.priorities || {}),
      kinds: Object.assign({}, DEFAULT_KINDS, hazard.kinds || {})
    };
  }

  function siteFrom(cfg) {
    var jma = (cfg && cfg.jma) || {};
    var warnArea = String(jma.warnArea || '');
    var inundation = (cfg && cfg.inundation) || {};
    var evacuation = (cfg && cfg.evacuation) || {};
    return {
      warnArea: warnArea,
      warnCity: String(jma.warnCity || ''),
      prefCode: warnArea.slice(0, 2),
      elevation: cfg && cfg.elevation != null ? cfg.elevation : null,
      expectedDepthM: inundation.expectedDepthM != null ? inundation.expectedDepthM : null,
      shelterName: evacuation.shelterName || ''
    };
  }

  function canonIntensity(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return '';
    s = s
      .replace(/[０-９]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); })
      .replace(/弱/g, '-')
      .replace(/強/g, '+')
      .replace(/－/g, '-')
      .replace(/−/g, '-')
      .replace(/\s/g, '');
    if (RANK[s]) return s;
    return '';
  }

  function displayIntensity(canon) {
    return String(canon || '')
      .replace('5-', '5弱')
      .replace('5+', '5強')
      .replace('6-', '6弱')
      .replace('6+', '6強');
  }

  function rankOf(raw) {
    var canon = canonIntensity(raw);
    return canon ? RANK[canon] : 0;
  }

  function betterIntensity(a, b) {
    return rankOf(b) > rankOf(a) ? canonIntensity(b) : canonIntensity(a);
  }

  function pad2(code) {
    var s = String(code == null ? '' : code).replace(/^0+/, '');
    if (!s) return '';
    return s.length === 1 ? '0' + s : s;
  }

  function localIntensity(item, site) {
    var rows = item && Array.isArray(item.int) ? item.int : [];
    var pref = pad2(site && site.prefCode);
    var city = String((site && site.warnCity) || '');
    var cityHit = '';
    var prefHit = '';
    var citySeen = false;
    rows.forEach(function (row) {
      if (!row || pad2(row.code) !== pref) return;
      prefHit = betterIntensity(prefHit, row.maxi);
      (row.city || []).forEach(function (c) {
        if (!c || String(c.code) !== city) return;
        citySeen = true;
        cityHit = betterIntensity(cityHit, c.maxi);
      });
    });
    if (city && citySeen) return cityHit;
    return prefHit;
  }

  function parseQuakes(list, site, settings, now) {
    var items = Array.isArray(list) ? list : [];
    var windowMs = settings.earthquakeVisibleMinutes * 60 * 1000;
    var minRank = rankOf(settings.minIntensity);
    var byOrigin = {};
    if (!settings.kinds.earthquake || !minRank) return [];
    items.forEach(function (item) {
      var at = Date.parse(item && item.at);
      if (!Number.isFinite(at)) return;
      if (now - at > windowMs || at - now > 5 * 60 * 1000) return;
      var intensity = localIntensity(item, site);
      if (!intensity || rankOf(intensity) < minRank) return;
      var key = String(item.at);
      var prev = byOrigin[key];
      if (!prev || rankOf(intensity) > rankOf(prev.intensity)) {
        byOrigin[key] = {
          id: 'earthquake:' + key,
          kind: 'earthquake',
          group: 'earthquake',
          genre: 'quake',
          intensity: displayIntensity(intensity),
          at: at
        };
      }
    });
    return Object.keys(byOrigin).map(function (key) { return byOrigin[key]; });
  }

  function warningActive(status) {
    var text = String(status || '');
    if (!text || text.indexOf('解除') >= 0) return false;
    return true;
  }

  function areaHits(code, site, group, inPrefectureFile) {
    var value = String(code || '');
    if (!value) return false;
    if (value === site.warnCity || value === site.warnArea) return true;
    if (group === 'tsunami' && inPrefectureFile) return true;
    if ((group === 'surge') && site.prefCode && value.indexOf(site.prefCode) === 0) return true;
    return false;
  }

  function parseWarnings(warnJson, site, settings) {
    var found = {};
    var types = warnJson && warnJson.areaTypes;
    if (!types || !site) return [];
    types.forEach(function (areaType) {
      (areaType.areas || []).forEach(function (area) {
        (area.warnings || []).forEach(function (warning) {
          if (!warningActive(warning && warning.status)) return;
          var mapped = WARN_CODE[String(warning.code || '')];
          if (!mapped || !settings.kinds[mapped.group]) return;
          if (!areaHits(area.code, site, mapped.group, true)) return;
          found[mapped.kind] = {
            id: mapped.kind,
            kind: mapped.kind,
            group: mapped.group,
            genre: 'water'
          };
        });
      });
    });
    return Object.keys(found).map(function (key) { return found[key]; });
  }

  function formatMeters(value) {
    if (value == null || value === '') return '';
    var n = Number(value);
    if (!Number.isFinite(n)) return '';
    var rounded = Math.round(n * 10) / 10;
    var text = Math.abs(rounded % 1) < 0.001 ? String(Math.trunc(rounded)) : String(rounded);
    return text + 'm';
  }

  function frame(lines, role) {
    return { lines: lines, role: role || 'message' };
  }

  function actionFrames(kind, layout) {
    var wide = layout === '256';
    if (kind === 'earthquake') return null;
    if (kind === 'tsunami-advisory') {
      return wide
        ? [frame(['津波注意報', '発表中']), frame(['海から離れる'])]
        : [frame(['津波', '注意報']), frame(['海から', '離れる'])];
    }
    if (kind === 'tsunami-warning') {
      return wide
        ? [frame(['津波警報', '発表中']), frame(['海・川から離れる']), frame(['高い場所へ避難'])]
        : [frame(['津波', '警報']), frame(['すぐ', '避難']), frame(['海・川', 'から離れる']), frame(['高い', '場所へ'])];
    }
    if (kind === 'tsunami-major') {
      return wide
        ? [frame(['大津波警報', '発表中']), frame(['ただちに避難']), frame(['海・川から離れる']), frame(['高い場所へ避難'])]
        : [frame(['大津波', '警報']), frame(['ただちに', '避難']), frame(['海・川', 'から離れる']), frame(['高い', '場所へ'])];
    }
    if (kind === 'surge-advisory') {
      return wide
        ? [frame(['高潮注意報', '発表中']), frame(['海岸から離れる'])]
        : [frame(['高潮', '注意報']), frame(['海岸から', '離れる'])];
    }
    if (kind === 'surge-warning') {
      return wide
        ? [frame(['高潮警報', '発表中']), frame(['海岸から離れる'])]
        : [frame(['高潮', '警報']), frame(['海岸から', '離れる'])];
    }
    if (kind === 'surge-special') {
      return wide
        ? [frame(['高潮特別警報', '発表中']), frame(['ただちに避難']), frame(['海岸から離れる'])]
        : [frame(['高潮', '特別警報']), frame(['ただちに', '避難']), frame(['海岸から', '離れる'])];
    }
    if (kind === 'flood-advisory') {
      return wide
        ? [frame(['洪水注意報', '発表中']), frame(['川に近づかない'])]
        : [frame(['洪水', '注意報']), frame(['川に', '近づかない'])];
    }
    if (kind === 'flood-warning') {
      return wide
        ? [frame(['洪水警報', '発表中']), frame(['川から離れる'])]
        : [frame(['洪水', '警報']), frame(['川から', '離れる'])];
    }
    if (kind === 'inundation-warning') {
      return wide
        ? [frame(['大雨警報', '発表中']), frame(['浸水のおそれ'])]
        : [frame(['大雨', '警報']), frame(['浸水の', 'おそれ'])];
    }
    if (kind === 'inundation-special') {
      return wide
        ? [frame(['大雨特別警報', '発表中']), frame(['ただちに避難'])]
        : [frame(['大雨', '特別警報']), frame(['ただちに', '避難'])];
    }
    return null;
  }

  function paint(alert, site, settings, layout) {
    if (!alert) return null;
    var mode = layout === '256' ? '256' : '128';
    var frames = [];
    if (alert.kind === 'earthquake') {
      frames = [frame(['地震発生']), frame(['震度' + (alert.intensity || '')])];
    } else {
      frames = actionFrames(alert.kind, mode) || [];
    }
    if (!frames.length) return null;
    var major = !!MAJOR_KIND[alert.kind];
    if (alert.genre === 'water') {
      var meters = formatMeters(site && site.elevation);
      if (meters && !(mode === '128' && major)) {
        if (mode === '256') frames.push(frame(['現在地', '海抜' + meters], 'note'));
        else frames.push(frame(['海抜'], 'label'), frame([meters], 'value'));
      }
      var depth = formatMeters(site && site.expectedDepthM);
      if (depth && mode === '256') frames.push(frame(['想定浸水深', depth], 'note'));
      var shelter = String((site && site.shelterName) || '').trim();
      if (shelter && mode === '256' && shelter.length <= 12) {
        frames.push(frame(['避難場所', shelter], 'note'));
      }
    }
    var priority = Number(settings.priorities[alert.kind]) || 0;
    return {
      id: alert.id,
      kind: alert.kind,
      genre: alert.genre,
      priority: priority,
      layout: mode,
      sync: true,
      faceMs: settings.faceMs,
      bg: colorOf(alert.kind).bg,
      ink: colorOf(alert.kind).ink,
      frames: frames
    };
  }

  function colorOf(kind) {
    if (kind === 'tsunami-major' || kind === 'surge-special' || kind === 'inundation-special') {
      return { bg: '#000000', ink: '#ffffff' };
    }
    if (kind === 'earthquake' || kind === 'tsunami-warning' || kind === 'surge-warning' || kind === 'flood-warning' || kind === 'inundation-warning') {
      return { bg: '#FA2900', ink: '#ffffff' };
    }
    return { bg: '#F2E700', ink: '#1a1a1a' };
  }

  function pickAlert(alerts, settings) {
    var best = null;
    (alerts || []).forEach(function (alert) {
      if (!alert || !settings.kinds[alert.group]) return;
      var priority = Number(settings.priorities[alert.kind]) || 0;
      if (!best || priority > best.priority || (priority === best.priority && alert.at && (!best.at || alert.at > best.at))) {
        best = Object.assign({}, alert, { priority: priority });
      }
    });
    return best;
  }

  function present(alerts, site, settings, layout) {
    return paint(pickAlert(alerts, settings), site, settings, layout);
  }

  function resolveWatch(prev, input) {
    var previous = prev || { quakeAlerts: [], waterAlerts: [], presentation: null };
    if (!input || (input.quakeOk === false && input.warningOk === false)) {
      if (previous.presentation) {
        return {
          fetchOk: false,
          held: true,
          quakeAlerts: previous.quakeAlerts || [],
          waterAlerts: previous.waterAlerts || [],
          presentation: previous.presentation
        };
      }
      return { fetchOk: false, held: false, quakeAlerts: [], waterAlerts: [], presentation: null };
    }
    var quakeAlerts = input.quakeOk ? (input.quakeAlerts || []) : (previous.quakeAlerts || []);
    var waterAlerts = input.warningOk ? (input.waterAlerts || []) : (previous.waterAlerts || []);
    return {
      fetchOk: true,
      held: input.quakeOk === false || input.warningOk === false,
      quakeAlerts: quakeAlerts,
      waterAlerts: waterAlerts,
      presentation: present(quakeAlerts.concat(waterAlerts), input.site, input.settings, input.layout)
    };
  }

  function previewAlert(name) {
    var kind = String(name || '');
    if (kind === 'earthquake') {
      return { id: 'preview:earthquake', kind: 'earthquake', group: 'earthquake', genre: 'quake', intensity: '5弱' };
    }
    if (!actionFrames(kind, '128')) return null;
    var group = kind.split('-')[0];
    if (kind.indexOf('inundation') === 0) group = 'inundation';
    if (kind.indexOf('tsunami') === 0) group = 'tsunami';
    return { id: 'preview:' + kind, kind: kind, group: group, genre: 'water' };
  }

  var api = {
    DEFAULT_PRIORITY: DEFAULT_PRIORITY,
    settingsFrom: settingsFrom,
    siteFrom: siteFrom,
    canonIntensity: canonIntensity,
    displayIntensity: displayIntensity,
    rankOf: rankOf,
    parseQuakes: parseQuakes,
    parseWarnings: parseWarnings,
    formatMeters: formatMeters,
    present: present,
    resolveWatch: resolveWatch,
    previewAlert: previewAlert,
    actionFrames: actionFrames
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeHazardEvaluate = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
