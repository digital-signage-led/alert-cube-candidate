/**
 * 気象データ取得。表示UIからは分離。OFFなら呼ばない。
 */
(function (global) {
  'use strict';
  var JMA_FORECAST = 'https://www.jma.go.jp/bosai/forecast/data/forecast/';
  var JMA_AMEDAS = 'https://www.jma.go.jp/bosai/amedas/data/map/';

  function should() {
    return !global.AlertCubeContent || global.AlertCubeContent.shouldFetch('jma-amedas') || global.AlertCubeContent.shouldFetch('jma-forecast');
  }

  function forecastUrl(area) {
    return JMA_FORECAST + encodeURIComponent(area) + '.json';
  }

  var api = { should: should, forecastUrl: forecastUrl, JMA_AMEDAS: JMA_AMEDAS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeServiceWeather = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
