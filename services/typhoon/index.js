/**
 * 台風取得の入口。正本は scripts/alert-cube-typhoon.js。
 * 案件ごとのコピーは置かない。
 */
(function (global) {
  'use strict';
  function should() {
    return !global.AlertCubeContent || global.AlertCubeContent.isOn('typhoon');
  }
  function load(siteCfg) {
    if (!should()) return Promise.resolve({ skipped: true, fetchOk: true, exists: false, items: [] });
    if (!global.AlertCubeTyphoon) return Promise.resolve({ fetchOk: false, message: 'typhoon-module-missing' });
    var run = global.AlertCubeFoundation && global.AlertCubeFoundation.isolateAsync
      ? global.AlertCubeFoundation.isolateAsync('typhoon', function () { return global.AlertCubeTyphoon.load(siteCfg); })
      : global.AlertCubeTyphoon.load(siteCfg);
    return Promise.resolve(run);
  }
  var api = { should: should, load: load };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeServiceTyphoon = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
