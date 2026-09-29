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

  var ANNUAL_MODE = {
    WBGT_ACTIVE: 'WBGT_ACTIVE',
    WBGT_TEMP_ERROR: 'WBGT_TEMP_ERROR',
    TEMPERATURE_AUTUMN: 'TEMPERATURE_AUTUMN',
    TEMPERATURE_WINTER: 'TEMPERATURE_WINTER',
    TEMPERATURE_SPRING: 'TEMPERATURE_SPRING',
    UNKNOWN: 'UNKNOWN'
  };

  /** 15℃未満の季節色。WBGTの5色とは別。全案件はこの定義だけを見る。 */
  var SEASON_COLORS = {
    autumn: { bg: '#9A5A2E', bar: '#B56B3C', ink: '#FFFFFF', colorType: 'AUTUMN' },
    winter: { bg: '#EAF7FF', bar: '#D4EEF8', ink: '#102A43', colorType: 'WINTER' },
    spring: { bg: '#E85A9B', bar: '#F07BB0', ink: '#FFFFFF', colorType: 'SPRING' },
    cold: { bg: '#EAF7FF', bar: '#D4EEF8', ink: '#102A43', colorType: 'COLD' },
    freezing: { bg: '#7030A0', bar: '#8A4BB8', ink: '#FFFFFF', colorType: 'FREEZING' }
  };

  function wbgtColorById_(id) {
    for (var i = 0; i < WBGT_BANDS.length; i++) {
      if (WBGT_BANDS[i].id === id) return WBGT_BANDS[i];
    }
    return WBGT_BANDS[WBGT_BANDS.length - 1];
  }

  function paintFromWbgtId_(id, colorType) {
    var band = wbgtColorById_(id);
    var dark = id === 'caution' || id === 'warning';
    return {
      bg: band.bg,
      bar: band.bar,
      ink: dark ? '#1a1a1a' : '#FFFFFF',
      colorType: colorType,
      judgment: false,
      darkText: dark
    };
  }

  function paintFromSeason_(key) {
    var row = SEASON_COLORS[key];
    return {
      bg: row.bg,
      bar: row.bar,
      ink: row.ink,
      colorType: row.colorType,
      judgment: false,
      darkText: row.ink !== '#FFFFFF'
    };
  }

  /**
   * 表示してよい気温だけ返す。null / 非数 / 異常値は null。
   * 0℃境界は 0.1℃単位で丸めてから判定する。
   */
  function parseTemperature(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'string' && !/^-?\d+(\.\d+)?$/.test(String(value).trim())) return null;
    var n = typeof value === 'string' ? Number(String(value).trim()) : Number(value);
    if (!Number.isFinite(n) || n < -60 || n > 60) return null;
    return n;
  }

  function temperatureTenths_(value) {
    var n = parseTemperature(value);
    if (n == null) return null;
    return Math.round(n * 10);
  }

  /**
   * WBGT期間外の季節。日本時間の月日。
   * 12/1〜2月末=冬、3/1〜提供開始前日=春、それ以外の期間外=秋。
   */
  function climateSeason(jstParts, seasonCfg) {
    if (!jstParts || jstParts.month == null || jstParts.day == null) return null;
    var month = Number(jstParts.month);
    var day = Number(jstParts.day);
    if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
    var start = parseMd_(seasonCfg && (seasonCfg.start || seasonCfg.seasonStart), 4, 22);
    if (month === 12 || month === 1 || month === 2) return 'WINTER';
    if (month > 2 && mdToKey_(month, day) < mdToKey_(start.month, start.day)) return 'SPRING';
    return 'AUTUMN';
  }

  /**
   * 気温モードの色。15℃以上は既存WBGTの5色を再利用し、判定名は付けない。
   */
  function getTemperatureDisplayColor(temperature, season) {
    var tenths = temperatureTenths_(temperature);
    if (tenths == null) return null;
    if (tenths >= 310) return paintFromWbgtId_('danger', 'DANGER');
    if (tenths >= 280) return paintFromWbgtId_('severe', 'SEVERE');
    if (tenths >= 250) return paintFromWbgtId_('warning', 'WARNING');
    if (tenths >= 210) return paintFromWbgtId_('caution', 'CAUTION');
    if (tenths >= 150) return paintFromWbgtId_('almostSafe', 'SAFE');
    if (tenths >= 100) {
      if (season === 'WINTER') return paintFromSeason_('winter');
      if (season === 'SPRING') return paintFromSeason_('spring');
      return paintFromSeason_('autumn');
    }
    if (tenths >= 0) return paintFromSeason_('cold');
    return paintFromSeason_('freezing');
  }

  /**
   * 提供期間と取得成否を分ける。
   * fetchOk=false だけでは期間外にしない。
   * キャッシュが新しい間は WBGT_ACTIVE。期限切れだけ WBGT_TEMP_ERROR。
   */
  function resolveAnnualMode(input) {
    input = input || {};
    var seasonMode = resolveSeasonMode({
      apiInService: input.apiInService,
      previewOffseason: input.previewOffseason,
      currentMode: input.currentMode,
      jstParts: input.jstParts,
      seasonCfg: input.seasonCfg
    });
    if (seasonMode === TEMPERATURE_MODE) {
      var season = climateSeason(input.jstParts, input.seasonCfg);
      if (season === 'WINTER') return ANNUAL_MODE.TEMPERATURE_WINTER;
      if (season === 'SPRING') return ANNUAL_MODE.TEMPERATURE_SPRING;
      if (season === 'AUTUMN') return ANNUAL_MODE.TEMPERATURE_AUTUMN;
      return ANNUAL_MODE.UNKNOWN;
    }
    if (input.fetchOk === true || input.cacheFresh === true) return ANNUAL_MODE.WBGT_ACTIVE;
    if (input.fetchOk === false) return ANNUAL_MODE.WBGT_TEMP_ERROR;
    return ANNUAL_MODE.WBGT_ACTIVE;
  }

  /** 期間外（気温モード）は多言語を出さない。提供中の取得失敗では残す。 */
  function showsWbgtMultilingual(annualMode) {
    return String(annualMode || '').indexOf('TEMPERATURE_') !== 0;
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

  /** 防災「発表なし」と「取得失敗」を分離し、失敗時は古い発表を表示しない。 */
  function mergeDisasterWatch(prev, next) {
    if (!next || next.fetchOk === false) {
      return {
        status: 'error',
        issued: false,
        items: [],
        updatedAt: 0,
        errorAt: Date.now(),
        held: false
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
    ANNUAL_MODE: ANNUAL_MODE,
    SEASON_COLORS: SEASON_COLORS,
    WBGT_BANDS: WBGT_BANDS,
    TEMP_BANDS: TEMP_BANDS,
    ALERT_COLORS: ALERT_COLORS,
    wbgtBand: wbgtBand,
    temperatureBand: temperatureBand,
    wbgtLevelIndex: wbgtLevelIndex,
    temperatureLevelIndex: temperatureLevelIndex,
    isCalendarWbgtSeason: isCalendarWbgtSeason,
    resolveSeasonMode: resolveSeasonMode,
    resolveAnnualMode: resolveAnnualMode,
    climateSeason: climateSeason,
    showsWbgtMultilingual: showsWbgtMultilingual,
    parseTemperature: parseTemperature,
    getTemperatureDisplayColor: getTemperatureDisplayColor,
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
