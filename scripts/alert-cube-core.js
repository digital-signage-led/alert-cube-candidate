/**
 * アラートキューブ共通コア
 * WBGT期間判定・背景色・再生位置・防災状態を一元管理する。
 * 現場名・ロゴ・観測点は持たない（site-config 側）。
 *
 * WBGT色は環境省「熱中症予防情報サイト」の5段階配色を
 * 参考画像からWeb用に設定したもの。公式HEX公開は確認できていない。
 */
(function (global) {
  'use strict';

  var WBGT_MODE = 'WBGT_MODE';
  var TEMPERATURE_MODE = 'TEMPERATURE_MODE';

  /** 環境省5段階（参考画像ベース。公式HEXとしては未確認） */
  var WBGT_BANDS = [
    { min: 31, id: 'danger', name: '危険', colorName: '赤', bg: '#ED1A3D', bar: '#F24A64', ink: '#ffffff', guide: '運動は原則中止' },
    { min: 28, id: 'severe', name: '厳重警戒', colorName: '橙', bg: '#F39800', bar: '#FFB133', ink: '#ffffff', guide: '激しい運動は中止' },
    { min: 25, id: 'warning', name: '警戒', colorName: '黄', bg: '#FFEE00', bar: '#FFF44D', ink: '#1a1a1a', guide: '積極的に休息' },
    { min: 21, id: 'caution', name: '注意', colorName: '水色', bg: '#67C1EA', bar: '#85D0F0', ink: '#ffffff', guide: '積極的に水分補給' },
    { min: -99, id: 'almostSafe', name: 'ほぼ安全', colorName: '青', bg: '#3181BD', bar: '#4A96CC', ink: '#ffffff', guide: '適宜水分補給' }
  ];

  /** WBGT期間外の独自9段階 */
  var TEMP_BANDS = [
    { min: 31, id: 't-red', name: '赤', bg: '#D61914', bar: '#E94540', ink: '#ffffff' },
    { min: 28, id: 't-orange', name: 'オレンジ', bg: '#FF7E00', bar: '#FF9A38', ink: '#ffffff' },
    { min: 25, id: 't-amber', name: '黄橙', bg: '#FFBE2D', bar: '#FECD58', ink: '#1a1a1a' },
    { min: 21, id: 't-yellow', name: '黄色', bg: '#FFD92D', bar: '#FEE968', ink: '#1a1a1a' },
    { min: 15, id: 't-pink', name: 'ピンク', bg: '#E85A9B', bar: '#F07BB0', ink: '#ffffff' },
    { min: 10, id: 't-green', name: '緑', bg: '#36A852', bar: '#4FBE6A', ink: '#ffffff' },
    { min: 5, id: 't-cyan', name: '水色', bg: '#55C7E8', bar: '#78D4EE', ink: '#1a1a1a' },
    { min: 0, id: 't-blue', name: '濃い青', bg: '#3156B8', bar: '#4A6DC8', ink: '#ffffff' },
    { min: null, id: 't-violet', name: '紫', bg: '#7030A0', bar: '#8A4BB8', ink: '#ffffff' }
  ];

  var ALERT_COLORS = {
    special: { bg: '#000000', bar: '#333333', ink: '#ffffff' },
    danger: { bg: '#AB00AA', bar: '#7A0078', ink: '#ffffff' },
    warning: { bg: '#FA2900', bar: '#C82400', ink: '#ffffff' },
    advisory: { bg: '#F2E700', bar: '#CDB800', ink: '#1a1a1a' },
    heat: { bg: '#70006A', bar: '#8A0080', ink: '#ffffff' }
  };

  var DISASTER_SCENE_IDS = {
    sceneWarn: true,
    sceneWarnHero: true,
    sceneRainWarn: true,
    sceneAlert: true,
    sceneTyphoon: true
  };

  function bandByValue_(bands, value) {
    var n = Number(value);
    if (!Number.isFinite(n)) return null;
    for (var i = 0; i < bands.length; i++) {
      var min = bands[i].min;
      if (min == null || n >= min) return bands[i];
    }
    return bands[bands.length - 1];
  }

  function wbgtBand(value) {
    return bandByValue_(WBGT_BANDS, value);
  }

  function temperatureBand(value) {
    return bandByValue_(TEMP_BANDS, value);
  }

  function wbgtLevelIndex(value) {
    var band = wbgtBand(value);
    if (!band) return -1;
    if (band.id === 'danger') return 4;
    if (band.id === 'severe') return 3;
    if (band.id === 'warning') return 2;
    if (band.id === 'caution') return 1;
    return 0;
  }

  function temperatureLevelIndex(value) {
    var band = temperatureBand(value);
    if (!band) return -1;
    return TEMP_BANDS.indexOf(band);
  }

  function colorsFromBand_(band) {
    if (!band) return { bgColor: '#3181BD', barColor: '#4A96CC', ink: '#ffffff' };
    return { bgColor: band.bg, barColor: band.bar, ink: band.ink };
  }

  function mdToKey_(month, day) {
    return (Number(month) * 100) + Number(day);
  }

  function parseMd_(raw, fallbackMonth, fallbackDay) {
    if (raw && typeof raw === 'object' && raw.month != null) {
      return { month: Number(raw.month), day: Number(raw.day) };
    }
    if (typeof raw === 'string' && /^\d{1,2}-\d{1,2}$/.test(raw)) {
      var p = raw.split('-');
      return { month: Number(p[0]), day: Number(p[1]) };
    }
    return { month: fallbackMonth, day: fallbackDay };
  }

  /**
   * 環境省の提供期間は年によって前後する。
   * カレンダーは API の inService が不明なときの補助のみ。
   * 既定は近年の提供期間に近い 4/22〜10/22。
   */
  function isCalendarWbgtSeason(jstParts, seasonCfg) {
    var start = parseMd_(seasonCfg && (seasonCfg.start || seasonCfg.seasonStart), 4, 22);
    var end = parseMd_(seasonCfg && (seasonCfg.end || seasonCfg.seasonEnd), 10, 22);
    var now = mdToKey_(jstParts.month, jstParts.day);
    var a = mdToKey_(start.month, start.day);
    var b = mdToKey_(end.month, end.day);
    if (a <= b) return now >= a && now <= b;
    return now >= a || now <= b;
  }

  /**
   * 期間判定はここだけ。取得失敗ではモードを変えない。
   *
   * apiInService:
   *   true  = 環境省が提供中（WBGTモードへ）
   *   false = 環境省が提供期間外（気温モードへ）
   *   null  = 不明（失敗・欠測）。currentMode を維持。未初期化時のみカレンダー。
   */
  function resolveSeasonMode(input) {
    var preview = !!(input && input.previewOffseason);
    if (preview) return TEMPERATURE_MODE;

    var api = input && input.apiInService;
    if (api === true) return WBGT_MODE;
    if (api === false) return TEMPERATURE_MODE;

    if (input && input.currentMode === WBGT_MODE) return WBGT_MODE;
    if (input && input.currentMode === TEMPERATURE_MODE) return TEMPERATURE_MODE;

    if (input && input.jstParts) {
      return isCalendarWbgtSeason(input.jstParts, input.seasonCfg) ? WBGT_MODE : TEMPERATURE_MODE;
    }
    return WBGT_MODE;
  }

  function resolveBackground(input) {
    var alertKey = input && input.alertKey;
    if (alertKey) {
      var ac = ALERT_COLORS[alertKey];
      if (ac) {
        return {
          displayMode: 'alert-' + alertKey,
          levelIdx: -1,
          colors: { bgColor: ac.bg, barColor: ac.bar, ink: ac.ink },
          seasonMode: input.seasonMode || WBGT_MODE,
          source: 'disaster'
        };
      }
    }

    var seasonMode = input.seasonMode || WBGT_MODE;
    if (seasonMode === WBGT_MODE) {
      var wBand = wbgtBand(input.wbgt);
      if (!wBand) {
        return {
          displayMode: 'wbgt-hold',
          levelIdx: -1,
          colors: null,
          seasonMode: seasonMode,
          source: 'wbgt-missing'
        };
      }
      return {
        displayMode: 'wbgt',
        levelIdx: wbgtLevelIndex(input.wbgt),
        colors: colorsFromBand_(wBand),
        band: wBand,
        seasonMode: seasonMode,
        source: 'wbgt'
      };
    }

    var tBand = temperatureBand(input.temperature);
    if (!tBand) {
      return {
        displayMode: 'temp-hold',
        levelIdx: -1,
        colors: null,
        seasonMode: seasonMode,
        source: 'temp-missing'
      };
    }
    return {
      displayMode: 'temperature',
      levelIdx: temperatureLevelIndex(input.temperature),
      colors: colorsFromBand_(tBand),
      band: tBand,
      seasonMode: seasonMode,
      source: 'temperature'
    };
  }

  function isDarkInk(colors) {
    return !!(colors && colors.ink && colors.ink !== '#ffffff' && colors.ink !== '#fff');
  }

  function isDisasterSceneId(id) {
    return !!DISASTER_SCENE_IDS[id];
  }

  function capturePlayback(state) {
    if (!state || !state.sceneId || isDisasterSceneId(state.sceneId)) return null;
    return {
      sceneId: state.sceneId,
      capturedAt: state.capturedAt || Date.now(),
      remainingMs: state.remainingMs == null ? null : Number(state.remainingMs),
      langIdx: state.langIdx == null ? 0 : Number(state.langIdx),
      scrollX: state.scrollX == null ? 0 : Number(state.scrollX),
      extra: state.extra || null
    };
  }

  function fetchStatus(ok, reason) {
    return { ok: !!ok, reason: reason || (ok ? 'ok' : 'error') };
  }

  /**
   * 防災「発表なし」と「取得失敗」を分離する。
   * 失敗時は lastIssued を消さない。
   */
  function mergeDisasterWatch(prev, next) {
    var prevState = prev || { status: 'unknown', issued: false, items: [], updatedAt: 0 };
    if (!next || next.fetchOk === false) {
      return {
        status: 'error',
        issued: !!prevState.issued,
        items: prevState.items || [],
        updatedAt: prevState.updatedAt || 0,
        errorAt: Date.now(),
        held: true
      };
    }
    var items = Array.isArray(next.items) ? next.items : [];
    return {
      status: 'ok',
      issued: items.length > 0,
      items: items,
      updatedAt: Date.now(),
      held: false
    };
  }

  function typhoonShouldDisplay(info, site) {
    if (!info || info.fetchOk === false) return false;
    if (!info.exists) return false;
    if (!site) return false;
    if (info.affectsSite === true) return true;
    return false;
  }

  var api = {
    WBGT_MODE: WBGT_MODE,
    TEMPERATURE_MODE: TEMPERATURE_MODE,
    WBGT_BANDS: WBGT_BANDS,
    TEMP_BANDS: TEMP_BANDS,
    ALERT_COLORS: ALERT_COLORS,
    wbgtBand: wbgtBand,
    temperatureBand: temperatureBand,
    wbgtLevelIndex: wbgtLevelIndex,
    temperatureLevelIndex: temperatureLevelIndex,
    isCalendarWbgtSeason: isCalendarWbgtSeason,
    resolveSeasonMode: resolveSeasonMode,
    resolveBackground: resolveBackground,
    isDarkInk: isDarkInk,
    isDisasterSceneId: isDisasterSceneId,
    capturePlayback: capturePlayback,
    fetchStatus: fetchStatus,
    mergeDisasterWatch: mergeDisasterWatch,
    typhoonShouldDisplay: typhoonShouldDisplay
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.AlertCubeCore = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
