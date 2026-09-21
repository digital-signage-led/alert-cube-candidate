/**
 * 案件が参照する地域コードの置き場。案件ごとのコピーは禁止。
 * 値そのものは sites/AC-xxxx.json が持つ。
 */
(function (global) {
  'use strict';
  var api = {
    fromSite: function (cfg) {
      var jma = (cfg && cfg.jma) || {};
      return {
        amedasPoint: jma.amedasPoint || '',
        forecastArea: jma.forecastArea || '',
        forecastDetail: jma.forecastDetail || '',
        warnArea: jma.warnArea || '',
        warnCity: jma.warnCity || ''
      };
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeRegions = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
