/**
 * 共通コンテンツ契約。UIは index.html の既存デザインを使う。
 * ここに案件コピーは置かない。OFF は load / fetch しない。
 */
(function (global) {
  'use strict';

  var MODULES = {
    clock: { id: 'clock', fetch: [], scene: 'scene1' },
    weather: { id: 'weather', fetch: ['jma-forecast'], scene: 'scene2' },
    temperature: { id: 'temperature', fetch: ['jma-amedas'], scene: 'scene2' },
    rain: { id: 'rain', fetch: ['jma-amedas'], scene: 'scene2' },
    wind: { id: 'wind', fetch: ['jma-amedas'], scene: 'scene2' },
    humidity: { id: 'humidity', fetch: ['jma-amedas'], scene: 'scene2' },
    pressure: { id: 'pressure', fetch: ['jma-amedas'], scene: 'scene2' },
    'temp-range': { id: 'temp-range', fetch: ['jma-amedas'], scene: 'scene2' },
    wbgt: { id: 'wbgt', fetch: ['moe-wbgt'], scene: 'scene4' },
    'wbgt-i18n': { id: 'wbgt-i18n', fetch: ['moe-wbgt'], scene: 'scene3' },
    forecast: { id: 'forecast', fetch: ['jma-forecast'], scene: 'scene5' },
    warning: { id: 'warning', fetch: ['jma-warning'], scene: 'sceneWarn' },
    'warning-hero': { id: 'warning-hero', fetch: ['jma-warning'], scene: 'sceneWarnHero' },
    'rain-nowcast': { id: 'rain-nowcast', fetch: ['jma-nowc'], scene: 'sceneRainWarn' },
    typhoon: { id: 'typhoon', fetch: ['jma-typhoon'], scene: 'sceneWarn' },
    disaster: { id: 'disaster', fetch: ['jma-warning', 'moe-heat'], scene: 'sceneAlert' },
    heat: { id: 'heat', fetch: ['moe-heat'], scene: 'sceneAlert' },
    schedule: { id: 'schedule', fetch: [], scene: 'sceneSchedule' },
    pollen: { id: 'pollen', fetch: ['pollen'], scene: null, future: true },
    pm25: { id: 'pm25', fetch: ['pm25'], scene: null, future: true }
  };

  function isOn(id) {
    return !global.AlertCubeContent || global.AlertCubeContent.isOn(id);
  }

  function activeIds() {
    return Object.keys(MODULES).filter(function (id) {
      return isOn(id) && !MODULES[id].future;
    });
  }

  function activeFetches() {
    var set = {};
    activeIds().forEach(function (id) {
      (MODULES[id].fetch || []).forEach(function (f) { set[f] = true; });
    });
    return Object.keys(set);
  }

  var api = { MODULES: MODULES, isOn: isOn, activeIds: activeIds, activeFetches: activeFetches };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeContents = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
