/**
 * 既存コンテンツの登録簿。Repository を正とする。
 * 未実装（花粉・PM2.5）は将来枠として OFF のまま残し、UI は作らない。
 */
(function (global) {
  'use strict';

  var CONTENTS = [
    { id: 'clock', label: '時刻', scene: 'scene1', fetch: [], existing: true, lifecycle: 'active' },
    { id: 'weather', label: '天気', scene: 'scene2', panel: 'weather', fetch: ['jma-forecast'], existing: true, lifecycle: 'active' },
    { id: 'temperature', label: '気温', scene: 'scene2', panel: 'temp', fetch: ['jma-amedas'], existing: true, lifecycle: 'active' },
    { id: 'rain', label: '降水量', scene: 'scene2', panel: 'rain', fetch: ['jma-amedas'], existing: true, lifecycle: 'active' },
    { id: 'wind', label: '風向風速', scene: 'scene2', panel: ['wdir', 'wind', 'gust'], fetch: ['jma-amedas'], existing: true, lifecycle: 'active' },
    { id: 'humidity', label: '湿度', scene: 'scene2', panel: 'humi', fetch: ['jma-amedas'], existing: true, lifecycle: 'active' },
    { id: 'pressure', label: '気圧', scene: 'scene2', panel: 'pres', fetch: ['jma-amedas'], existing: true, lifecycle: 'active' },
    { id: 'temp-range', label: '最高/最低', scene: 'scene2', panel: 'tmaxmin', fetch: ['jma-amedas'], existing: true, lifecycle: 'active' },
    { id: 'wbgt', label: 'WBGT/暑さ指数', scene: 'scene4', fetch: ['moe-wbgt'], existing: true, lifecycle: 'active', seasonal: 'summer' },
    { id: 'wbgt-i18n', label: '多言語WBGT', scene: 'scene3', fetch: ['moe-wbgt'], existing: true, lifecycle: 'active', seasonal: 'summer' },
    { id: 'forecast', label: '4日予報', scene: 'scene5', fetch: ['jma-forecast'], existing: true, lifecycle: 'active' },
    { id: 'warning', label: '警報・注意報', scene: 'sceneWarn', fetch: ['jma-warning'], existing: true, lifecycle: 'active', safety: true },
    { id: 'warning-hero', label: '警報情報', scene: 'sceneWarnHero', fetch: ['jma-warning'], existing: true, lifecycle: 'active', safety: true },
    { id: 'rain-nowcast', label: '雨雲・大雨', scene: 'sceneRainWarn', fetch: ['jma-nowc'], existing: true, lifecycle: 'active', safety: true },
    { id: 'typhoon', label: '台風', scene: 'sceneWarn', fetch: ['jma-typhoon'], existing: true, lifecycle: 'active', safety: true },
    { id: 'disaster', label: '防災割込', scene: 'sceneAlert', fetch: ['jma-warning', 'moe-heat'], existing: true, lifecycle: 'active', safety: true },
    { id: 'heat', label: '熱中症アラート', scene: 'sceneAlert', fetch: ['moe-heat'], existing: true, lifecycle: 'active', seasonal: 'summer', safety: true },
    { id: 'schedule', label: '工程表', scene: 'sceneSchedule', fetch: [], existing: true, lifecycle: 'active' },
    { id: 'pollen', label: '花粉', scene: null, fetch: ['pollen'], existing: false, lifecycle: 'retired', seasonal: 'spring' },
    { id: 'pm25', label: 'PM2.5', scene: null, fetch: ['pm25'], existing: false, lifecycle: 'retired', seasonal: 'spring-autumn-winter' }
  ];

  var BY_ID = {};
  CONTENTS.forEach(function (c) { BY_ID[c.id] = c; });

  var SCENE2_PANEL_TO_CONTENT = {
    weather: 'weather',
    temp: 'temperature',
    rain: 'rain',
    wdir: 'wind',
    wind: 'wind',
    humi: 'humidity',
    pres: 'pressure',
    tmaxmin: 'temp-range',
    wbgt: 'wbgt',
    gust: 'wind',
    logo: 'clock'
  };

  var api = {
    CONTENTS: CONTENTS,
    byId: function (id) { return BY_ID[id] || null; },
    existing: function () { return CONTENTS.filter(function (c) { return c.existing; }); },
    panelContentId: function (panel) { return SCENE2_PANEL_TO_CONTENT[panel] || panel; }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeRegistry = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
