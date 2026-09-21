/**
 * 気象庁「気象警報・注意報の種類」に基づく一覧
 * https://www.jma.go.jp/jma/kishou/know/bosai/warning_kind.html
 *
 * 警戒レベル（2〜5）は 氾濫・大雨・土砂災害・高潮 のみ。
 */
(function (global) {
  'use strict';

  var CATS = {
    special: { key: 'special', label: '特別警報', count: 8, level: 5, color: '#111111', bar: '#333333', ink: '#ffffff' },
    danger: { key: 'danger', label: '危険警報', count: 4, level: 4, color: '#AB00AA', bar: '#7A0078', ink: '#ffffff' },
    warning: { key: 'warning', label: '警報', count: 8, level: 3, color: '#FA2900', bar: '#C82400', ink: '#ffffff' },
    advisory: { key: 'advisory', label: '注意報', count: 17, level: 2, color: '#F2E700', bar: '#CDB800', ink: '#1a1a1a' }
  };

  function item(kind, name, hasLevel, levelNum, lead, short) {
    return { kind: kind, name: name, hasLevel: !!hasLevel, levelNum: hasLevel ? levelNum : 0, lead: lead, short: short };
  }

  var CATALOG = {
    special: [
      item('flood', '氾濫特別警報', true, 5,
        '台風や集中豪雨等により河川の氾濫のおそれが著しく大きいときに発表します。',
        '河川の氾濫のおそれが著しく大きいときに発表'),
      item('rain', '大雨特別警報', true, 5,
        '浸水害のおそれが著しく大きい大雨が予想されるときに発表します。',
        '浸水害のおそれが著しく大きい大雨のときに発表'),
      item('landslide', '土砂災害特別警報', true, 5,
        '土砂崩れのおそれが著しく大きい大雨が予想されるときに発表します。',
        '土砂崩れのおそれが著しく大きい大雨のときに発表'),
      item('surge', '高潮特別警報', true, 5,
        '海面の異常上昇により浸水害のおそれが著しく大きいときに発表します。',
        '海面の異常上昇で浸水害のおそれが著しく大きいときに発表'),
      item('snow', '大雪特別警報', false, 0,
        '数十年に一度の降雪量となる大雪が予想されるときに発表します。',
        '数十年に一度の大雪が予想されるときに発表'),
      item('wind', '暴風特別警報', false, 0,
        '数十年に一度の強度の台風等により暴風が予想されるときに発表します。',
        '数十年に一度の暴風が予想されるときに発表'),
      item('blizzard', '暴風雪特別警報', false, 0,
        '数十年に一度の強度の台風等により雪を伴う暴風が予想されるときに発表します。',
        '数十年に一度の雪を伴う暴風が予想されるときに発表'),
      item('wave', '波浪特別警報', false, 0,
        '数十年に一度の強度の台風等により高波が予想されるときに発表します。',
        '数十年に一度の高波が予想されるときに発表')
    ],
    danger: [
      item('flood', '氾濫危険警報', true, 4,
        'まもなく氾濫危険水位を超える、または到達したときに発表します。',
        'まもなく氾濫危険水位を超える、または到達したときに発表'),
      item('rain', '大雨危険警報', true, 4,
        '大雨の危険度が基準に到達すると予想されるときに発表します。',
        '大雨の危険度が基準に到達すると予想されるときに発表'),
      item('landslide', '土砂災害危険警報', true, 4,
        'おおむね2時間先までに土砂災害の基準到達が予想されるときに発表します。',
        'おおむね2時間先までに基準到達が予想されるときに発表'),
      item('surge', '高潮危険警報', true, 4,
        'おおむね6時間前までに高潮の基準到達が予想されるときに発表します。',
        'おおむね6時間前までに基準到達が予想されるときに発表')
    ],
    warning: [
      item('flood', '氾濫警報', true, 3,
        '氾濫危険水位到達が見込まれる、または避難判断水位に到達し上昇が見込まれるときに発表します。',
        '氾濫危険水位到達が見込まれるときに発表'),
      item('rain', '大雨警報', true, 3,
        '大雨の基準到達が予想されるときに発表します。',
        '大雨の基準到達が予想されるときに発表'),
      item('landslide', '土砂災害警報', true, 3,
        'おおむね3〜6時間先に土砂災害危険警報の基準到達が予想されるときに発表します。',
        'おおむね3〜6時間先の基準到達が予想されるときに発表'),
      item('surge', '高潮警報', true, 3,
        'おおむね12時間前までに高潮危険警報の基準到達が予想されるときに発表します。',
        'おおむね12時間前までに基準到達が予想されるときに発表'),
      item('snow', '大雪警報', false, 0,
        '大雪により重大な災害のおそれがあるときに発表します。',
        '大雪により重大な災害のおそれがあるときに発表'),
      item('wind', '暴風警報', false, 0,
        '暴風により重大な災害のおそれがあるときに発表します。',
        '暴風により重大な災害のおそれがあるときに発表'),
      item('blizzard', '暴風雪警報', false, 0,
        '雪を伴う暴風により重大な災害のおそれがあるときに発表します。',
        '雪を伴う暴風により重大な災害のおそれがあるときに発表'),
      item('wave', '波浪警報', false, 0,
        '高波により重大な災害のおそれがあるときに発表します。',
        '高波により重大な災害のおそれがあるときに発表')
    ],
    advisory: [
      item('flood', '氾濫注意報', true, 2,
        '氾濫注意水位に到達し上昇が見込まれる、または避難判断水位に到達したが上昇が見込まれないときに発表します。',
        '氾濫注意水位に到達し上昇が見込まれるときに発表'),
      item('rain', '大雨注意報', true, 2,
        '大雨の基準到達が予想されるときに発表します。',
        '大雨の基準到達が予想されるときに発表'),
      item('landslide', '土砂災害注意報', true, 2,
        '土砂災害の基準到達が予想されるときに発表します。',
        '土砂災害の基準到達が予想されるときに発表'),
      item('surge', '高潮注意報', true, 2,
        'おおむね18時間前までに高潮危険警報の基準到達が予想されるときに発表します。',
        'おおむね18時間前までに基準到達が予想されるときに発表'),
      item('snow', '大雪注意報', false, 0,
        '大雪により災害のおそれがあるときに発表します。',
        '大雪により災害のおそれがあるときに発表'),
      item('wind', '強風注意報', false, 0,
        '強風により災害のおそれがあるときに発表します。',
        '強風により災害のおそれがあるときに発表'),
      item('snowdrift', '風雪注意報', false, 0,
        '雪を伴う強風により災害のおそれがあるときに発表します。',
        '雪を伴う強風により災害のおそれがあるときに発表'),
      item('wave', '波浪注意報', false, 0,
        '高波により災害のおそれがあるときに発表します。',
        '高波により災害のおそれがあるときに発表'),
      item('thunder', '雷注意報', false, 0,
        '落雷、急な強い雨、突風、降ひょうのおそれがあるときに発表します。',
        '落雷や急な強い雨、突風のおそれがあるときに発表'),
      item('fog', '濃霧注意報', false, 0,
        '濃い霧により見通しが悪くなり交通障害等のおそれがあるときに発表します。',
        '濃い霧による交通障害等のおそれがあるときに発表'),
      item('dry', '乾燥注意報', false, 0,
        '空気の乾燥により火災・延焼等の危険が大きいときに発表します。',
        '空気の乾燥により火災の危険が大きいときに発表'),
      item('avalanche', 'なだれ注意報', false, 0,
        'なだれにより人や建物の被害のおそれがあるときに発表します。',
        'なだれによる被害のおそれがあるときに発表'),
      item('ice', '着氷注意報', false, 0,
        '著しい着氷により電線の断線や船体着氷等のおそれがあるときに発表します。',
        '著しい着氷により電線断線等のおそれがあるときに発表'),
      item('snowacc', '着雪注意報', false, 0,
        '著しい着雪により電線の断線や鉄塔倒壊等のおそれがあるときに発表します。',
        '著しい着雪により電線断線等のおそれがあるときに発表'),
      item('snowmelt', '融雪注意報', false, 0,
        '融雪により土砂災害や浸水害のおそれがあるときに発表します。',
        '融雪により土砂災害や浸水害のおそれがあるときに発表'),
      item('frost', '霜注意報', false, 0,
        '霜により農作物や果実の被害のおそれがあるときに発表します。',
        '霜により農作物の被害のおそれがあるときに発表'),
      item('lowtemp', '低温注意報', false, 0,
        '低温により農作物被害や水道管凍結等のおそれがあるときに発表します。',
        '低温により農作物被害や凍結のおそれがあるときに発表')
    ]
  };

  var LEVEL_HAZARDS = ['flood', 'rain', 'landslide', 'surge'];

  function kindsMap_(catKey) {
    var rows = CATALOG[catKey] || [];
    var out = {};
    rows.forEach(function (row) {
      out[row.kind] = {
        name: row.name,
        hasLevel: row.hasLevel,
        levelNum: row.levelNum,
        short: row.short,
        lead: row.lead
      };
    });
    return out;
  }

  function kindOrder_(catKey) {
    return (CATALOG[catKey] || []).map(function (row) { return row.kind; });
  }

  global.JmaWarningKinds = {
    SOURCE_LABEL: '出典：気象庁「気象警報・注意報の種類」',
    SOURCE_URL: 'https://www.jma.go.jp/jma/kishou/know/bosai/warning_kind.html',
    CATS: CATS,
    CATALOG: CATALOG,
    LEVEL_HAZARDS: LEVEL_HAZARDS,
    CAT_ORDER: ['special', 'danger', 'warning', 'advisory'],
    kindsMap: kindsMap_,
    kindOrder: kindOrder_
  };
})(typeof window !== 'undefined' ? window : this);
