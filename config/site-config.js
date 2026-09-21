/**
 * 本番現場の last-good（AC-0001）
 * 4面 512×128。位置・社名・観測点は sites/AC-0001.json と揃える。
 * AC-0000 は内部テスト専用。このファイルをテスト案件にしない。
 * 観測: 大阪 62078 / 補完 堺 62091 / 予報・警報: 大阪府 270000・大阪市 2710000
 */
(function (global) {
  'use strict';

  var cfg = {
    projectId: 'AC-0001',
    schemaVersion: 1,
    releasePin: null,
    site: {
      customer: 'デジタルサイネージ',
      rental: 'デジタルサイネージ',
      label: '住之江区',
      address: '〒559-0066 大阪市住之江区新北島1-9-13',
      locationLabel: '住之江区'
    },
    moe: {
      gasUrl:
        'https://script.google.com/macros/s/AKfycbzSTsappgfJTaJruOBJsbnCXSTPkeTBp39CXpvoSZsPQ0mWGs4KjSonC8_eZ2b1EeUXTQ/exec',
      point: '62078',
      fallbackPoint: '62091',
      pointName: '大阪',
      alertArea: '大阪府',
      region: '07',
      prefecture: '62'
    },
    jma: {
      amedasPoint: '62078',
      amedasSupplementPoint: '62091',
      forecastArea: '270000',
      forecastDetail: '270010',
      forecastLabel: '大阪市',
      warnArea: '270000',
      warnCity: '2710000',
      warnCityLabel: '大阪市'
    },
    wbgt: {
      seasonStart: { month: 4, day: 22 },
      seasonEnd: { month: 10, day: 22 }
    },
    faces: 4,
    profile: 'AC-512',
    geo: { lat: 34.605184, lon: 135.470949 },
    timeZone: 'Asia/Tokyo',
    refreshMs: 60000,
    footSource: '出典：気象庁・環境省データ',
    schedule: {
      enabled: true,
      weekStartsOn: 1,
      items: [
        { work: '足場組立', sub: '' },
        { work: '外装工事', sub: '' },
        { work: '内装工事', sub: '' },
        { work: '仕上げ', sub: '' }
      ]
    },
    greeting: {
      enabled: false,
      title: '近隣の皆様へ',
      lines: ['工事期間中はご迷惑をおかけします', '安全第一で作業を進めてまいります'],
      foot: 'ご理解・ご協力をお願いいたします'
    }
  };

  global.SignageConfig = cfg;

  global.SIGNAGE_CONFIG = {
    logoSrc: './images/logo.svg?v=20260921-suminoe',
    logoAlt: cfg.site.customer || cfg.site.locationLabel,
    logoPanelBg: '#ffffff',
    logoCorpSrc: './images/logo.svg?v=20260921-suminoe',
    footLogoSrc: './images/logo.svg?v=20260921-suminoe',
    footBannerSrc: ''
  };
})(typeof window !== 'undefined' ? window : global);
