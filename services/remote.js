/**
 * 通信共通。表示UIから分離。無限高速Retryはしない。
 */
(function (global) {
  'use strict';

  function timeoutPromise(ms, label) {
    return new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error((label || 'fetch') + ' timeout'));
      }, ms);
    });
  }

  function fetchJson(url, opts) {
    var ms = (opts && opts.timeoutMs) || 12000;
    var label = (opts && opts.label) || url;
    var work = fetch(url, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
    return Promise.race([work, timeoutPromise(ms, label)]);
  }

  function withBackoff(task, opts) {
    var attempt = 0;
    var maxAttempts = (opts && opts.maxAttempts) || 4;
    var foundation = global.AlertCubeFoundation;
    function run() {
      return Promise.resolve().then(task).catch(function (err) {
        attempt += 1;
        if (attempt >= maxAttempts) throw err;
        var wait = foundation ? foundation.backoffMs(attempt) : Math.min(15000 * attempt, 300000);
        if (global.AlertCubeLog) {
          global.AlertCubeLog.warn('retry', label_(opts) + ' attempt ' + attempt + ' wait ' + wait + 'ms');
        }
        return new Promise(function (resolve) { setTimeout(resolve, wait); }).then(run);
      });
    }
    return run();
  }

  function label_(opts) {
    return (opts && opts.label) || 'request';
  }

  /**
   * いまは静的 JSON。将来 /api/sites/{id} に差し替える入口。
   */
  function siteConfigUrl(siteId, source) {
    var src = source || { type: 'static', path: './sites/{id}.json' };
    if (src.type === 'api') {
      return String(src.path || '/api/sites/{id}').replace('{id}', siteId);
    }
    return String(src.path || './sites/{id}.json').replace('{id}', siteId);
  }

  var api = {
    fetchJson: fetchJson,
    withBackoff: withBackoff,
    siteConfigUrl: siteConfigUrl
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeServices = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
