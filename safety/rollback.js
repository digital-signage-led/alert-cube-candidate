/**
 * コード Rollback。データ Fallback とは別。
 * 直前版の識別は version.previousReleaseId。
 */
(function (global) {
  'use strict';
  function info() {
    var ver = global.AlertCubeVersion && global.AlertCubeVersion.RELEASE;
    return {
      current: ver && ver.releaseId,
      previous: ver && ver.previousReleaseId,
      how: '直前リリースへ戻す'
    };
  }
  var api = { info: info };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeRollback = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
