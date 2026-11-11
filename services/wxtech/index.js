/**
 * WxTech 1kmメッシュ短時間予報の整形。
 * 公式仕様（APIドキュメント Version 1.0.1）で確認したこと:
 * - GET https://wxtech.weathernews.com/api/v1/ss1wx/kakuho?lat&lon
 * - 認証は X-API-Key。秒間50リクエストまで。24時間365日、定期保守の記載なし
 * - wxdata[].data[] の date（ISO 8601、+09:00）、wx、prec
 * - 1時間先まで5分ごとの天気と降水量、3時間先まで10分ごとの降水量
 * - 天気コード 100晴れ 200くもり 300雨 400雪 430みぞれ 600うすぐもり
 * - 欠測は -9999
 * 仕様書に無いこと:
 * - 予報データの更新間隔。5分は予報の刻みであり、更新保証ではない
 * - 取得間隔の規定。WXTECH_REFRESH_MS の初期値5分は暫定
 */
(function (global) {
  'use strict';

  var MISSING = -9999;
  var WX_NAME = { 100: '晴れ', 200: 'くもり', 300: '雨', 400: '雪', 430: 'みぞれ', 600: 'うすぐもり' };
  var DOW = { Sun: '日', Mon: '月', Tue: '火', Wed: '水', Thu: '木', Fri: '金', Sat: '土' };
  var PROVISIONAL_REFRESH_MS = 300000;

  function unavailable(reason) {
    return { ok: false, reason: reason || 'unavailable', slots: [] };
  }

  function jstLabels(ms) {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tokyo',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23'
    }).formatToParts(new Date(ms));
    var map = {};
    parts.forEach(function (p) { if (p.type !== 'literal') map[p.type] = p.value; });
    var hour = String(map.hour || '').replace(/^24$/, '00');
    return {
      dateLabel: Number(map.month) + '/' + Number(map.day) + '（' + (DOW[map.weekday] || '') + '）',
      timeLabel: hour + ':' + map.minute
    };
  }

  function readNumber(value) {
    if (value == null || value === '') return null;
    var n = Number(value);
    if (!Number.isFinite(n) || n === MISSING) return null;
    return n;
  }

  function formatPrec(n) {
    var rounded = Math.round(n * 10) / 10;
    return (rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1)) + 'mm';
  }

  function normalize(payload, nowMs) {
    var now = Number(nowMs);
    if (!Number.isFinite(now)) now = Date.now();
    if (!payload || payload.ok === false) return unavailable('unavailable');
    if (Array.isArray(payload.errors) && payload.errors.length) return unavailable('unavailable');
    var freshUntil = payload.freshUntil ? Date.parse(payload.freshUntil) : NaN;
    var fetchedAt = payload.fetchedAt ? Date.parse(payload.fetchedAt) : NaN;
    if (!Number.isFinite(fetchedAt)) return unavailable('unavailable');
    var block = payload.wxdata && payload.wxdata[0];
    var rows = block && Array.isArray(block.data) ? block.data : null;
    if (!rows) return unavailable('unavailable');
    var parsed = [];
    rows.forEach(function (row) {
      if (!row) return;
      var ms = Date.parse(row.date);
      if (!Number.isFinite(ms)) return;
      var labels = jstLabels(ms);
      var wx = readNumber(row.wx);
      var prec = readNumber(row.prec);
      var known = wx != null && Object.prototype.hasOwnProperty.call(WX_NAME, wx);
      parsed.push({
        ms: ms,
        dateLabel: labels.dateLabel,
        timeLabel: labels.timeLabel,
        wx: known ? wx : null,
        wxName: known ? WX_NAME[wx] : '',
        wxOk: known,
        prec: prec,
        precOk: prec != null,
        precLabel: prec != null ? formatPrec(prec) : ''
      });
    });
    parsed.sort(function (a, b) { return a.ms - b.ms; });
    var visible = parsed.filter(function (row, i) {
      var prevStep = i > 0 ? row.ms - parsed[i - 1].ms : 0;
      var nextStep = parsed[i + 1] ? parsed[i + 1].ms - row.ms : prevStep;
      var step = nextStep > 0 ? nextStep : (prevStep > 0 ? prevStep : 5 * 60 * 1000);
      return now < row.ms + step;
    });
    if (!visible.length) return unavailable('expired');
    var fetched = jstLabels(fetchedAt);
    return {
      ok: true,
      reason: '',
      fetchedAt: new Date(fetchedAt).toISOString(),
      freshUntil: Number.isFinite(freshUntil) ? new Date(freshUntil).toISOString() : '',
      fetchedDateLabel: fetched.dateLabel,
      fetchedTimeLabel: fetched.timeLabel,
      refreshBasis: 'provisional',
      slots: visible
    };
  }

  var api = {
    MISSING: MISSING,
    WX_NAME: WX_NAME,
    PROVISIONAL_REFRESH_MS: PROVISIONAL_REFRESH_MS,
    jstLabels: jstLabels,
    normalize: normalize,
    formatPrec: formatPrec
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeWxTech = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
