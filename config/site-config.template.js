/**
 * 現場設定テンプレート
 * 企業名・ロゴ・現場名・観測点・面数はここだけを差し替える。
 * HTML / 共通エンジンへ案件名をハードコードしない。
 */
(function (global) {
  'use strict';

  var ASSET_V = '20260921-suminoe';

  var cfg = {
    site: {
      customer: '',
      rental: '',
      label: '',
      address: '',
      locationLabel: ''
    },
    faces: 4,
    profile: 'AC-512',
    moe: {
      gasUrl: '',
      point: '',
      fallbackPoint: '',
      pointName: '',
      alertArea: '',
      region: '',
      prefecture: ''
    },
    jma: {
      amedasPoint: '',
      amedasSupplementPoint: '',
      forecastArea: '',
      forecastLabel: '',
      forecastDetail: '',
      warnArea: '',
      warnCity: '',
      warnCityLabel: ''
    },
    wbgt: {
      seasonStart: { month: 4, day: 22 },
      seasonEnd: { month: 10, day: 22 }
    },
    geo: { lat: 0, lon: 0 },
    timeZone: 'Asia/Tokyo',
    refreshMs: 60000,
    footSource: '出典：気象庁・環境省データ',
    schedule: {
      enabled: false,
      weekStartsOn: 1,
      items: []
    }
  };

  global.SignageConfig = cfg;
  global.SIGNAGE_CONFIG = {
    logoSrc: './images/logo.svg?v=' + ASSET_V,
    logoAlt: '',
    logoPanelBg: '#ffffff',
    logoCorpSrc: './images/logo.svg?v=' + ASSET_V,
    footLogoSrc: './images/logo.svg?v=' + ASSET_V,
    footBannerSrc: './images/logo.svg?v=' + ASSET_V
  };
})(typeof window !== 'undefined' ? window : global);
