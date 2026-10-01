/**
 * 緊急地震速報（警報）の対象判定。
 * 揺れの予測はしない。気象庁の警報電文（P2P地震情報が再配信するコード556）に
 * 載った地域と、案件の地域だけを比べる。予報・訓練・取消・時間切れは出さない。
 */
(function (global) {
  'use strict';

  var SOURCE_URL = 'https://api.p2pquake.net/v2/history?codes=556&limit=20';

  var PREF_NAME = {
    '01': '北海道', '02': '青森県', '03': '岩手県', '04': '宮城県', '05': '秋田県',
    '06': '山形県', '07': '福島県', '08': '茨城県', '09': '栃木県', '10': '群馬県',
    '11': '埼玉県', '12': '千葉県', '13': '東京都', '14': '神奈川県', '15': '新潟県',
    '16': '富山県', '17': '石川県', '18': '福井県', '19': '山梨県', '20': '長野県',
    '21': '岐阜県', '22': '静岡県', '23': '愛知県', '24': '三重県', '25': '滋賀県',
    '26': '京都府', '27': '大阪府', '28': '兵庫県', '29': '奈良県', '30': '和歌山県',
    '31': '鳥取県', '32': '島根県', '33': '岡山県', '34': '広島県', '35': '山口県',
    '36': '徳島県', '37': '香川県', '38': '愛媛県', '39': '高知県', '40': '福岡県',
    '41': '佐賀県', '42': '長崎県', '43': '熊本県', '44': '大分県', '45': '宮崎県',
    '46': '鹿児島県', '47': '沖縄県'
  };

  function targetFrom(cfg) {
    var jma = (cfg && cfg.jma) || {};
    var moe = (cfg && cfg.moe) || {};
    var warnArea = String(jma.warnArea || '');
    var prefCode = warnArea.slice(0, 2);
    return {
      prefCode: prefCode,
      prefName: PREF_NAME[prefCode] || '',
      alertArea: String(moe.alertArea || ''),
      cityLabel: String(jma.warnCityLabel || jma.forecastLabel || ''),
      warnArea: warnArea,
      warnCity: String(jma.warnCity || '')
    };
  }

  function coreName(name) {
    var s = String(name || '').replace(/\s/g, '');
    if (!s) return '';
    if (s.indexOf('北海道') === 0) return '北海道';
    return s.replace(/(都|府|県)$/u, '');
  }

  function samePref(a, b) {
    var left = coreName(a);
    var right = coreName(b);
    return !!(left && right && left === right);
  }

  function areaHits(area, target) {
    if (!area || !target) return false;
    var code = String(area.code || '');
    if (code && (code === target.warnCity || code === target.warnArea)) return true;
    var pref = String(area.pref || '');
    var name = String(area.name || '');
    var sitePref = target.prefName || target.alertArea;
    if (!samePref(pref, sitePref) && !samePref(name, sitePref)) return false;
    var city = target.cityLabel;
    if (!city) return true;
    if (!name || samePref(name, sitePref) || name === target.prefName || name === target.alertArea) return true;
    return name === city;
  }

  function parseJst(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return NaN;
    if (s.indexOf('T') >= 0) return Date.parse(s);
    var norm = s.replace(/\//g, '-').replace(' ', 'T');
    if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(norm)) norm += '+09:00';
    return Date.parse(norm);
  }

  function units(line) {
    var n = 0;
    String(line || '').split('').forEach(function (ch) {
      n += /[0-9A-Za-z.m-]/.test(ch) ? 0.58 : 1;
    });
    return Math.max(n, 1);
  }

  function linePx(text, linesInFrame) {
    var width = 248;
    var count = linesInFrame > 1 ? linesInFrame : 1;
    var byWidth = Math.floor(width / units(text));
    var gap = count > 1 ? 8 : 0;
    var byHeight = Math.floor((120 - gap * (count - 1)) / count / 1.05);
    var size = Math.min(byWidth, byHeight);
    if (size < 1) size = 1;
    return size;
  }

  function frames() {
    return [
      { lines: ['緊急地震速報', '強い揺れに警戒'], role: 'message' },
      { lines: ['身を守る'], role: 'message' }
    ];
  }

  function asList(json) {
    if (Array.isArray(json)) return json;
    if (json && typeof json === 'object') return [json];
    return [];
  }

  function parseReports(json, cfg, settings, now) {
    if (settings && settings.kinds && settings.kinds.eew === false) return [];
    var target = targetFrom(cfg);
    if (!target.prefName && !target.alertArea && !target.warnCity) return [];
    var windowMin = settings && Number(settings.eewVisibleMinutes);
    var windowMs = (Number.isFinite(windowMin) && windowMin > 0 ? windowMin : 3) * 60 * 1000;
    var clock = Number.isFinite(now) ? now : Date.now();
    var byEvent = {};
    asList(json).forEach(function (item) {
      if (!item || Number(item.code) !== 556 || item.test) return;
      var issue = item.issue || {};
      var eventId = String(issue.eventId || '');
      if (!eventId) return;
      var serial = Number(issue.serial || 0);
      var prev = byEvent[eventId];
      if (prev && serial <= prev.serial) return;
      byEvent[eventId] = { item: item, serial: serial };
    });
    var best = null;
    Object.keys(byEvent).forEach(function (eventId) {
      var item = byEvent[eventId].item;
      if (!item || item.cancelled) return;
      var issue = item.issue || {};
      var quake = item.earthquake || {};
      var at = parseJst(issue.time);
      if (!Number.isFinite(at)) return;
      if (clock - at > windowMs || at - clock > 5 * 60 * 1000) return;
      var areas = Array.isArray(item.areas) ? item.areas : [];
      var hit = false;
      areas.forEach(function (area) {
        if (areaHits(area, target)) hit = true;
      });
      if (!hit) return;
      var originAt = parseJst(quake.originTime);
      var alert = {
        id: 'eew:' + eventId,
        kind: 'eew',
        group: 'eew',
        genre: 'eew',
        at: at,
        originAt: Number.isFinite(originAt) ? originAt : at
      };
      if (!best || alert.at > best.at) best = alert;
    });
    return best ? [best] : [];
  }

  var api = {
    SOURCE_URL: SOURCE_URL,
    PREF_NAME: PREF_NAME,
    targetFrom: targetFrom,
    areaHits: areaHits,
    linePx: linePx,
    frames: frames,
    parseReports: parseReports
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeEewEvaluate = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
