/**
 * 環境クラウド（EDAM）騒音・振動の瞬時値。
 * API: {apiHost}/Json/SSCNumData/{idNum}
 * RNSoVal … 騒音(dB) / RNShVal … 振動(dB)
 * idNum が空のときは取得せず、画面側は「取得中」のままにする。
 */
(function (global) {
  'use strict';

  var DEFAULT_HOST = 'https://www2.edam.ne.jp';
  var DEFAULT_PATH = '/Json/SSCNumData';
  var PENDING = '取得中';

  function apiBase(options) {
    var host = String((options && options.apiHost) || DEFAULT_HOST).replace(/\/$/, '');
    var path = (options && options.apiPath) || DEFAULT_PATH;
    return host + path;
  }

  function formatDb(raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    var n = Number(raw);
    if (!isFinite(n)) return null;
    var rounded = Math.round(n * 10) / 10;
    return (Math.abs(rounded % 1) < 1e-9)
      ? String(Math.round(rounded)) + '.0'
      : String(rounded);
  }

  function parseTimeLabel(timeStr) {
    var s = String(timeStr || '');
    if (s.length >= 14) {
      return s.slice(0, 4) + '/' + s.slice(4, 6) + '/' + s.slice(6, 8)
        + ' ' + s.slice(8, 10) + ':' + s.slice(10, 12) + ':' + s.slice(12, 14);
    }
    return '';
  }

  function rowToValues(row) {
    row = row || {};
    var noise = formatDb(row.RNSoVal != null ? row.RNSoVal : row.SoVal);
    var vibration = formatDb(row.RNShVal != null ? row.RNShVal : row.ShVal);
    return {
      noise: noise,
      vibration: vibration,
      time: parseTimeLabel(row.Time),
      pending: noise == null && vibration == null,
      raw: row
    };
  }

  function pendingValues() {
    return { noise: null, vibration: null, time: PENDING, pending: true };
  }

  function positiveId(raw) {
    var n = parseInt(String(raw == null ? '' : raw), 10);
    return (isFinite(n) && n > 0) ? n : 0;
  }

  function resolveId(cfg, query) {
    var fromQuery = '';
    if (query && typeof query.get === 'function') {
      fromQuery = query.get('sscId') || query.get('ssc') || '';
    } else if (query) {
      fromQuery = query.sscId || query.ssc || '';
    }
    var qid = positiveId(fromQuery);
    if (qid) return qid;
    cfg = cfg || {};
    var raw = (cfg.idNum != null && cfg.idNum !== '') ? cfg.idNum : cfg.loId;
    return positiveId(raw);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function metaLine(cfg, vals, ready) {
    cfg = cfg || {};
    vals = vals || pendingValues();
    var site = String(cfg.siteName || '').trim();
    var sensor = cfg.sensorLabel || '騒音振動計';
    var pending = !!vals.pending || (vals.noise == null && vals.vibration == null);
    var t = pending ? (ready ? PENDING : (PENDING + '（URL設定待ち）')) : (vals.time || '--');
    var n = vals.noise != null ? (vals.noise + 'dB') : PENDING;
    var v = vals.vibration != null ? (vals.vibration + 'dB') : PENDING;
    return (site ? site + '／' : '') + sensor + '／騒音 ' + n + '／振動 ' + v + '／' + t + '／出典：環境クラウドサービス';
  }

  function fetchWithTimeout(url, ms) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, ms);
    return fetch(url, { cache: 'no-store', signal: ctrl.signal }).then(function (res) {
      clearTimeout(timer);
      return res;
    }, function (err) {
      clearTimeout(timer);
      throw err;
    });
  }

  function parsePayload(url, text) {
    if (url.indexOf('allorigins.win/get') >= 0) {
      var wrap = JSON.parse(text);
      var inner = wrap.contents;
      return typeof inner === 'string' ? JSON.parse(inner) : inner;
    }
    return JSON.parse(text);
  }

  function fetchValues(idNum, options) {
    options = options || {};
    var direct = apiBase(options) + '/' + idNum + '?r=' + Date.now();
    var enc = encodeURIComponent(direct);
    var proxy = options.corsProxy !== 'off' && options.corsProxy !== 'none'
      ? (options.corsProxy || 'https://api.allorigins.win/raw?url=')
      : '';
    var urls = [direct];
    if (proxy) {
      urls.push(proxy + enc);
      urls.push('https://api.allorigins.win/get?url=' + enc);
    }
    var i = 0;
    var lastErr = null;
    function next() {
      if (i >= urls.length) return Promise.reject(lastErr || new Error('EDAM SSC 取得不可'));
      var url = urls[i++];
      return fetchWithTimeout(url, 12000).then(function (res) {
        return res.text().then(function (text) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          var data = parsePayload(url, text);
          if (!Array.isArray(data) || !data.length) throw new Error('empty');
          return rowToValues(data[0]);
        });
      }).catch(function (err) {
        lastErr = err;
        return next();
      });
    }
    return next();
  }

  var api = {
    PENDING: PENDING,
    formatDb: formatDb,
    rowToValues: rowToValues,
    pendingValues: pendingValues,
    resolveId: resolveId,
    metaLine: metaLine,
    escapeHtml: escapeHtml,
    fetchValues: fetchValues
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.EdamSsc = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
