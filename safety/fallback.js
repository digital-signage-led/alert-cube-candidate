/**
 * データ障害用 Fallback。コード Rollback とは別。
 */
(function (global) {
  'use strict';
  var PREFIX = 'alert_cube_lkg_data_';

  function key(point, city) {
    return PREFIX + String(point || '') + '_' + String(city || '');
  }

  function save(point, city, payload) {
    try {
      localStorage.setItem(key(point, city), JSON.stringify({
        savedAt: Date.now(),
        payload: payload
      }));
    } catch (_) {}
  }

  function load(point, city, maxAgeMs) {
    try {
      var raw = localStorage.getItem(key(point, city));
      if (!raw) return { ok: false, reason: 'empty' };
      var row = JSON.parse(raw);
      var age = Date.now() - (row.savedAt || 0);
      var max = maxAgeMs == null ? 7 * 24 * 60 * 60 * 1000 : maxAgeMs;
      if (age > max) return { ok: false, reason: 'stale', savedAt: row.savedAt, payload: row.payload };
      return { ok: true, stale: false, savedAt: row.savedAt, payload: row.payload };
    } catch (err) {
      return { ok: false, reason: 'error', error: String(err && err.message || err) };
    }
  }

  var api = { save: save, load: load, key: key };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeFallback = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
