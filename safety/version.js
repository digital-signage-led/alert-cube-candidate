/**
 * Release / Rollback 識別。データFallbackとは別物。
 * 互換セット（HTML/CSS/JS/mapping/schema）を同一 releaseId で揃える。
 */
(function (global) {
  'use strict';

  var RELEASE = {
    product: 'alert-cube',
    releaseId: '20260921-suminoe',
    displayVersion: 'v2.1.0-suminoe',
    compat: 'v20',
    previousReleaseId: '20260921-amedas',
    schemaVersion: 1,
    builtAt: '2026-09-21T15:40:00+09:00',
    channel: 'development'
  };

  function cacheToken() {
    return RELEASE.releaseId;
  }

  function isPinned(siteCfg) {
    var pin = siteCfg && siteCfg.releasePin;
    return !!(pin && pin !== RELEASE.releaseId && pin !== RELEASE.displayVersion);
  }

  var api = {
    RELEASE: RELEASE,
    cacheToken: cacheToken,
    isPinned: isPinned
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeVersion = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
