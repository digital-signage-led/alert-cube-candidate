/**
 * 見守り伝書鳩（現地センサー）の最新JSONを観測値と暑さ指数へ変換する。
 * 気象庁・環境省の取得とは別ソース。予報や警報はここでは作らない。
 */
(function (global) {
  'use strict';

  var WIND_STEP = 22.5;

  function finite_(value) {
    if (value == null || value === '') return null;
    var n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function pair_(value) {
    var n = finite_(value);
    return n == null ? null : [n];
  }

  function windCodeFromDegrees(deg) {
    var n = finite_(deg);
    if (n == null) return null;
    var turn = ((n % 360) + 360) % 360;
    return Math.round(turn / WIND_STEP) % 16;
  }

  /** 長い語を先に見る。「警戒」が「厳重警戒」に重ならないようにする。 */
  function levelFromLabel(label) {
    var text = String(label || '');
    var rows = [
      ['厳重警戒', 3],
      ['ほぼ安全', 0],
      ['注意', 1],
      ['警戒', 2],
      ['危険', 4]
    ];
    for (var i = 0; i < rows.length; i++) {
      if (text.indexOf(rows[i][0]) >= 0) return rows[i][1];
    }
    return null;
  }

  function levelFromWbgt(wbgt) {
    if (wbgt == null) return null;
    if (wbgt >= 31) return 4;
    if (wbgt >= 28) return 3;
    if (wbgt >= 25) return 2;
    if (wbgt >= 21) return 1;
    return 0;
  }

  function parseObservedAt(dateStr) {
    var s = String(dateStr || '').trim();
    if (s.length < 14) return null;
    var iso = s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8) + 'T' +
      s.slice(8, 10) + ':' + s.slice(10, 12) + ':' + s.slice(12, 14) + '+09:00';
    var d = new Date(iso);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  function parseLatest(json) {
    var terms = json && (json.term || json['学期']);
    var term = terms && terms[0];
    var rows = term && (term.data || term['データ']);
    var row = rows && rows[0];
    var sensu = row && row.sensu15xx;
    if (!term || !row || !sensu) throw new Error('Densho data empty');
    var pressure = row.sea_level_pressure != null ? row.sea_level_pressure : row.atmos;
    var wbgt = finite_(sensu.wbgt);
    var level = levelFromLabel(sensu.wbgt_str);
    if (level == null) level = levelFromWbgt(wbgt);
    var current = {
      wbgt: wbgt,
      levelIdx: level == null ? 0 : level,
      hour: '現在'
    };
    var slots = wbgt == null ? null : [0, 1, 2, 3].map(function () {
      return { wbgt: current.wbgt, levelIdx: current.levelIdx, hour: '現在' };
    });
    return {
      termName: String(term.name || '').trim(),
      observedAt: parseObservedAt(row.date || row['日付']),
      windDirStr: String(sensu.wind_dir_str || '').trim(),
      temp: finite_(sensu.temp),
      obs: {
        temp: pair_(sensu.temp),
        humidity: pair_(sensu.humi),
        precipitation10m: pair_(sensu.rain),
        precipitation1h: pair_(sensu.rain_1h),
        wind: pair_(sensu.wind_speed),
        windDirection: (function () {
          var code = windCodeFromDegrees(sensu.wind_dir);
          return code == null ? null : [code];
        })(),
        gust: pair_(sensu.max_wind_speed),
        normalPressure: pair_(pressure)
      },
      extra: {
        uvIndex: finite_(sensu.uvi),
        illuminance: finite_(sensu.illumi),
        cumTemp: finite_(sensu.cumtemp),
        rain1h: finite_(sensu.rain_1h),
        rain24h: finite_(sensu.rain_24h)
      },
      wbgtSlots: slots
    };
  }

  function allowedApiUrl(url) {
    try {
      var u = new URL(String(url || ''));
      return u.protocol === 'https:' && u.hostname === 'densho-bato.com';
    } catch (_) {
      return false;
    }
  }

  /** 公開ページは densho-bato.com を直接読めない。中継の本文を元のJSONに戻す。 */
  function readerUrl(apiUrl) {
    if (!allowedApiUrl(apiUrl)) return '';
    return 'https://r.jina.ai/' + apiUrl;
  }

  function unwrapPayload(data) {
    var packed = data && data.data;
    var raw = packed && (packed.content || packed.text);
    if (typeof raw !== 'string') return data;
    var trimmed = raw.trim();
    if (trimmed.charAt(0) !== '{' && trimmed.charAt(0) !== '[') return data;
    return JSON.parse(trimmed);
  }

  function formatDbText(raw) {
    if (raw == null || String(raw).trim() === '') return null;
    var n = Number(raw);
    if (!Number.isFinite(n)) return null;
    var rounded = Math.round(n * 10) / 10;
    return (Math.abs(rounded % 1) < 1e-9)
      ? String(Math.round(rounded)) + '.0'
      : String(rounded);
  }

  function stampLabel(dateStr) {
    var s = String(dateStr || '');
    if (s.length < 14) return '';
    return s.slice(0, 4) + '/' + s.slice(4, 6) + '/' + s.slice(6, 8) +
      ' ' + s.slice(8, 10) + ':' + s.slice(10, 12) + ':' + s.slice(12, 14);
  }

  function parseSignage(json) {
    var block = json && (json.signage_data || json);
    var values = block && block.values;
    if (!block || !Array.isArray(values)) throw new Error('Densho signage empty');
    var noise = null;
    var vibration = null;
    var termName = '';
    var sensorLabel = '';
    var noiseMetric = '';
    var vibMetric = '';
    values.forEach(function (row) {
      if (!row || (row.type && row.type !== 'data')) return;
      var equip = String(row.meas_equip || '');
      var val = formatDbText(row.value1);
      if (!equip || val == null) return;
      if (equip.indexOf('振動') >= 0) {
        if (vibration != null) return;
        vibration = val;
        vibMetric = String(row.value_name || '').trim();
        if (!termName) termName = String(row.name || '').trim();
        return;
      }
      if (equip.indexOf('騒音') >= 0) {
        if (noise != null) return;
        noise = val;
        termName = String(row.name || '').trim();
        sensorLabel = String(row.distinguished_name || '').trim();
        noiseMetric = String(row.value_name || '').trim();
      }
    });
    if (!termName) termName = String(block.term_name || '').trim();
    return {
      termName: termName,
      sensorLabel: sensorLabel || (vibration != null && noise == null ? '振動計' : '騒音計'),
      noiseMetric: noiseMetric,
      vibMetric: vibMetric,
      noise: noise,
      vibration: vibration,
      time: stampLabel(block.data_date),
      message: String(block.message || '').trim(),
      pending: noise == null && vibration == null
    };
  }

  function mergeSignage(parts) {
    var out = {
      termName: '', sensorLabel: '', noiseMetric: '', vibMetric: '',
      noise: null, vibration: null, time: '', message: '', pending: true
    };
    (parts || []).forEach(function (part) {
      if (!part) return;
      if (part.noise != null && out.noise == null) {
        out.noise = part.noise;
        out.noiseMetric = part.noiseMetric || '';
        if (part.sensorLabel) out.sensorLabel = part.sensorLabel;
      }
      if (part.vibration != null && out.vibration == null) {
        out.vibration = part.vibration;
        out.vibMetric = part.vibMetric || '';
      }
      if (!out.termName && part.termName) out.termName = part.termName;
      if (!out.time && part.time) out.time = part.time;
      if (!out.message && part.message) out.message = part.message;
    });
    if (!out.sensorLabel) out.sensorLabel = out.noise != null ? '騒音計' : '振動計';
    out.pending = out.noise == null && out.vibration == null;
    return out;
  }

  var api = {
    parseLatest: parseLatest,
    parseObservedAt: parseObservedAt,
    levelFromLabel: levelFromLabel,
    windCodeFromDegrees: windCodeFromDegrees,
    allowedApiUrl: allowedApiUrl,
    readerUrl: readerUrl,
    unwrapPayload: unwrapPayload,
    parseSignage: parseSignage,
    mergeSignage: mergeSignage,
    formatDbText: formatDbText
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeDensho = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
