/**
 * 通信 Retry。無限高速 Retry はしない。
 */
(function (global) {
  'use strict';
  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }
  function backoff(attempt) {
    if (global.AlertCubeFoundation) return global.AlertCubeFoundation.backoffMs(attempt);
    return Math.min(15000 * Math.pow(2, Math.min(attempt, 4)), 300000);
  }
  function run(task, opts) {
    var max = (opts && opts.maxAttempts) || 4;
    var n = 0;
    function once() {
      return Promise.resolve().then(task).catch(function (err) {
        n += 1;
        if (n >= max) throw err;
        var ms = backoff(n);
        if (global.AlertCubeLog) global.AlertCubeLog.warn('retry', 'wait ' + ms + 'ms attempt ' + n);
        return wait(ms).then(once);
      });
    }
    return once();
  }
  var api = { wait: wait, backoff: backoff, run: run };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeRetry = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
