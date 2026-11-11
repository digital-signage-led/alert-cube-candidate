/**
 * 短時間予報。気象庁の4日間予報・観測・WBGTは置き換えない。
 * 通信失敗、欠測、期限切れのときは直前の予報を残さない。
 */
(function (global) {
  'use strict';

  var FACES = 4;
  var FRAME_MS = 1500;
  var view = { ok: false, reason: 'empty', slots: [] };
  var settled = false;
  var waiters = [];
  var timer = 0;
  var frameTimer = 0;
  var playing = 0;

  function wx() { return global.AlertCubeWxTech; }
  /* 430・600は気象庁のファイルに無い。不明コードを晴れ(100)へ落とさない。 */
  var JMA_FILE = { 100: '100', 200: '200', 300: '300', 400: '400', 430: '303', 600: '101' };

  function siteOf() {
    return global.SignageConfig || global.SIGNAGE_CONFIG || {};
  }

  function enabled() {
    var cfg = siteOf();
    var item = cfg.contents && cfg.contents['short-forecast'];
    if (item && item.on === false) return false;
    if (global.AlertCubeContent && global.AlertCubeContent.isOn) return global.AlertCubeContent.isOn('short-forecast');
    return !!(item && item.on);
  }

  function coords() {
    var cfg = siteOf();
    var geo = cfg.geo || {};
    var lat = geo.lat != null ? Number(geo.lat) : Number(cfg.latitude);
    var lon = geo.lon != null ? Number(geo.lon) : Number(cfg.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat: lat, lon: lon };
  }

  function fail(reason) {
    view = { ok: false, reason: reason || 'unavailable', slots: [] };
    settled = true;
    var list = waiters.splice(0, waiters.length);
    list.forEach(function (fn) { fn(view); });
  }

  function accept(payload) {
    var api = wx();
    view = api ? api.normalize(payload, Date.now()) : { ok: false, reason: 'unavailable', slots: [] };
    if (view && payload && Number(payload.refreshMs) >= 60000) view.refreshMs = Number(payload.refreshMs);
    settled = true;
    var list = waiters.splice(0, waiters.length);
    list.forEach(function (fn) { fn(view); });
  }

  function current(nowMs) {
    var api = wx();
    if (!view || !view.ok || !api) return { ok: false, reason: (view && view.reason) || 'unavailable', slots: [] };
    return api.normalize({
      ok: true,
      fetchedAt: view.fetchedAt,
      freshUntil: view.freshUntil,
      wxdata: [{
        data: view.slots.map(function (slot) {
          return {
            date: new Date(slot.ms).toISOString(),
            wx: slot.wxOk ? slot.wx : -9999,
            prec: slot.precOk ? slot.prec : -9999
          };
        })
      }]
    }, nowMs || Date.now());
  }

  /* このPCの中継は /api。公開ページは10分ごとのスナップショット。キーはどちらにも出さない。 */
  function forecastUrl(pos) {
    var cfg = siteOf();
    var snap = cfg.wxtech && cfg.wxtech.snapshot;
    var host = '';
    try { host = global.location && global.location.hostname; } catch (e) { host = ''; }
    var local = host === '127.0.0.1' || host === 'localhost';
    if (snap && !local) {
      var base = String(snap);
      return base + (base.indexOf('?') >= 0 ? '&' : '?') + 't=' + Math.floor(Date.now() / 60000);
    }
    return '/api/wxtech/kakuho?lat=' + encodeURIComponent(pos.lat) + '&lon=' + encodeURIComponent(pos.lon);
  }

  function load() {
    if (!enabled()) return Promise.resolve(view);
    var pos = coords();
    if (!pos) {
      fail('unavailable');
      return Promise.resolve(view);
    }
    var url = forecastUrl(pos);
    return fetch(url, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('wxtech ' + res.status);
      return res.json();
    }).then(function (json) {
      accept(json);
      return view;
    }).catch(function () {
      fail('network');
      return view;
    });
  }

  function intervalMs() {
    var cfg = siteOf();
    var siteMs = cfg.wxtech && Number(cfg.wxtech.refreshMs);
    var serverMs = view && Number(view.refreshMs);
    var base = wx() ? wx().PROVISIONAL_REFRESH_MS : 300000;
    var wait = base;
    if (Number.isFinite(serverMs) && serverMs >= 60000) wait = serverMs;
    if (Number.isFinite(siteMs) && siteMs > wait) wait = siteMs;
    return wait;
  }

  function loop() {
    if (timer) clearTimeout(timer);
    load().then(function () {
      if (!enabled()) return;
      timer = setTimeout(loop, intervalMs());
    });
  }

  function start() {
    if (timer) clearTimeout(timer);
    if (!enabled()) return;
    loop();
  }

  function whenReady(fn, timeoutMs) {
    if (settled) { fn(current(Date.now())); return; }
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      fn(current(Date.now()));
    }
    waiters.push(finish);
    setTimeout(finish, timeoutMs || 8000);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function panel(top, body, got, prec) {
    return '<div class="d5-panel s2-strip">' +
      '<div class="s2-top-bar"><span class="s2-bar-label">' + esc(top) + '</span></div>' +
      '<div class="s2-body d5-body">' + body + '</div>' +
      '<div class="s2-foot short-foot"><span class="short-got">' + esc(got) + '</span><span class="d5-foot-txt short-prec">' + esc(prec) + '</span></div>' +
      '</div>';
  }

  function slotTop(slot, dayLabel) {
    if (slot.dateLabel === dayLabel) return slot.timeLabel;
    return slot.dateLabel + ' ' + slot.timeLabel;
  }

  function fetchLabel(model) {
    if (!model || !model.fetchedTimeLabel) return '';
    var day = model.slots && model.slots[0] && model.slots[0].dateLabel;
    if (model.fetchedDateLabel && day && model.fetchedDateLabel !== day) {
      return '取得' + model.fetchedDateLabel + ' ' + model.fetchedTimeLabel;
    }
    return '取得' + model.fetchedTimeLabel;
  }

  function iconFile(slot) {
    if (!slot || !slot.wxOk) return '';
    return JMA_FILE[slot.wx] || '';
  }

  function slotBody(slot) {
    var file = iconFile(slot);
    if (!file) return '';
    var src = 'https://www.jma.go.jp/bosai/forecast/img/' + file + '.svg';
    return '<div class="d5-weather-row"><span class="weather-icon-cell is-ready"><img class="weather-svg weather-icon-img" alt="" decoding="async" style="visibility:visible" src="' + src + '"></span></div>';
  }

  function precText(slot) {
    return slot && slot.precOk ? slot.precLabel : '';
  }

  /* 天気か降水量が返った時刻だけ。欠測の項目は空欄にし、取れない時刻は面にしない。 */
  function returnedSlots(model) {
    if (!model || !model.ok || !model.slots) return [];
    return model.slots.filter(function (slot) {
      return !!(iconFile(slot) || slot.precOk);
    });
  }

  function paintFaces(track, html) {
    if (!track) return;
    track.innerHTML = html;
    track.style.width = '512px';
    track.style.transform = 'none';
  }

  function render(track, model) {
    var html = '';
    var i;
    var slots = returnedSlots(model);
    if (slots.length) {
      var day = slots[0].dateLabel;
      var slot = slots[0];
      var face = panel(slotTop(slot, day), slotBody(slot), fetchLabel(model), precText(slot));
      for (i = 0; i < FACES; i++) html += face;
    }
    paintFaces(track, html);
  }

  function stop() {
    playing += 1;
    if (frameTimer) clearTimeout(frameTimer);
    frameTimer = 0;
  }

  function play(opts) {
    var o = opts || {};
    stop();
    var token = playing;
    var track = o.track;
    var model = current(Date.now());
    function finish() {
      if (token !== playing) return;
      if (o.onDone) o.onDone();
    }
    var slots = returnedSlots(model);
    if (!track || !slots.length) {
      render(track, model);
      if (o.onLayout) o.onLayout();
      frameTimer = setTimeout(finish, FRAME_MS * FACES);
      return;
    }
    var index = 0;
    var lapsLeft = Math.max(1, Math.floor(Number(o.laps) || 1));
    var day = slots[0].dateLabel;
    var got = fetchLabel(model);
    function show() {
      if (token !== playing) return;
      var slot = slots[index];
      var face = panel(slotTop(slot, day), slotBody(slot), got, precText(slot));
      var html = '';
      var i;
      for (i = 0; i < FACES; i++) html += face;
      paintFaces(track, html);
      if (o.onLayout) o.onLayout();
      frameTimer = setTimeout(function () {
        frameTimer = 0;
        if (token !== playing) return;
        index += 1;
        if (index < slots.length) {
          show();
          return;
        }
        lapsLeft -= 1;
        if (lapsLeft > 0) {
          index = 0;
          show();
          return;
        }
        finish();
      }, FRAME_MS);
    }
    show();
  }

  var api = {
    id: 'short-forecast',
    start: start,
    load: load,
    whenReady: whenReady,
    current: current,
    FACES: FACES,
    FRAME_MS: FRAME_MS,
    render: render,
    play: play,
    stop: stop,
    _accept: accept,
    _fail: fail
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeShortForecast = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
