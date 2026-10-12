/**
 * 環境クラウド（EDAM）騒音・振動の瞬時値。
 * API: {apiHost}/Json/SSCNumData/{idNum}?r={cacheBust}
 * RNSoVal … 騒音(dB) / RNShVal … 振動(dB)
 * ブラウザは EDAM を CORS で読めないことがある。そのときだけ gasUrl の中継を使う。
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
    var s = String(text || '').trim();
    if (!s || /^<!DOCTYPE/i.test(s) || /<html[\s>]/i.test(s)) throw new Error('html body');
    if (url.indexOf('allorigins.win/get') >= 0) {
      var wrap = JSON.parse(s);
      var inner = wrap.contents;
      return typeof inner === 'string' ? JSON.parse(inner) : inner;
    }
    return JSON.parse(s);
  }

  function rowFromPayload(data) {
    var row = null;
    if (Array.isArray(data) && data.length) row = data[0];
    else if (data && Array.isArray(data.data) && data.data.length) row = data.data[0];
    else if (data && data.Time != null) row = data;
    if (!row || typeof row !== 'object') throw new Error('empty');
    var vals = rowToValues(row);
    if (vals.noise == null && vals.vibration == null) throw new Error('SSC values missing');
    return vals;
  }

  function fetchJsonp(url, ms) {
    return new Promise(function (resolve, reject) {
      if (typeof document === 'undefined') {
        reject(new Error('JSONP unavailable'));
        return;
      }
      var cb = '_edamSscCb_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
      var sep = url.indexOf('?') >= 0 ? '&' : '?';
      var script = document.createElement('script');
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('JSONP timeout'));
      }, ms);
      function cleanup() {
        clearTimeout(timer);
        try { delete global[cb]; } catch (e) { global[cb] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }
      global[cb] = function (payload) {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(payload);
      };
      script.async = true;
      script.src = url + sep + 'callback=' + encodeURIComponent(cb);
      script.onerror = function () {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('JSONP load error'));
      };
      (document.head || document.documentElement).appendChild(script);
    });
  }

  function fetchViaGas(idNum, gasUrl) {
    var base = String(gasUrl || '').replace(/\/$/, '');
    if (!base) return Promise.reject(new Error('gasUrl empty'));
    var q = 'idNum=' + encodeURIComponent(idNum) + '&r=' + Date.now();
    var url = base + (base.indexOf('?') >= 0 ? '&' : '?') + q;
    return fetchWithTimeout(url, 12000).then(function (res) {
      return res.text().then(function (text) {
        if (!res.ok) throw new Error('GAS HTTP ' + res.status);
        return rowFromPayload(parsePayload(url, text));
      });
    }).catch(function () {
      return fetchJsonp(url, 12000).then(rowFromPayload);
    });
  }

  function dataUrl(idNum, options) {
    var bust = (options && options.cacheBust != null) ? options.cacheBust : Date.now();
    return apiBase(options) + '/' + idNum + '?r=' + bust;
  }

  function fetchDirect(idNum, options) {
    var direct = dataUrl(idNum, options);
    var enc = encodeURIComponent(direct);
    var proxyRaw = options.corsProxy;
    var proxy = (proxyRaw && proxyRaw !== 'off' && proxyRaw !== 'none') ? proxyRaw : '';
    var urls = [];
    if (proxy) {
      urls.push(proxy + enc);
      if (proxy.indexOf('allorigins.win/raw') >= 0) {
        urls.push('https://api.allorigins.win/get?url=' + enc);
      }
    }
    urls.push(direct);
    var i = 0;
    var lastErr = null;
    function next() {
      if (i >= urls.length) return Promise.reject(lastErr || new Error('EDAM SSC 取得不可'));
      var url = urls[i++];
      return fetchWithTimeout(url, 12000).then(function (res) {
        return res.text().then(function (text) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return rowFromPayload(parsePayload(url, text));
        });
      }).catch(function (err) {
        lastErr = err;
        return next();
      });
    }
    return next();
  }

  function fetchValues(idNum, options) {
    options = options || {};
    return fetchDirect(idNum, options).catch(function (err) {
      if (!options.gasUrl) throw err;
      return fetchViaGas(idNum, options.gasUrl);
    });
  }

  var api = {
    PENDING: PENDING,
    formatDb: formatDb,
    rowToValues: rowToValues,
    pendingValues: pendingValues,
    resolveId: resolveId,
    dataUrl: dataUrl,
    rowFromPayload: rowFromPayload,
    metaLine: metaLine,
    escapeHtml: escapeHtml,
    fetchValues: fetchValues
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.EdamSsc = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
