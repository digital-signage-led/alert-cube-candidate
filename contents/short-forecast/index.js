/**
 * 短時間予報。気象庁の4日間予報・観測・WBGTは置き換えない。
 * 通信が失敗しても、直前に出せた予報が残っていればそれを出す。
 * 出せる時刻が無いときは「取得できません」を面に出し、空にはしない。
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
  var anim = 0;
  var playing = 0;

  function wx() { return global.AlertCubeWxTech; }
  /* 430・600は気象庁のファイルに無い。不明コードを晴れ(100)へ落とさない。 */
  var JMA_FILE = { 100: '100', 200: '200', 300: '300', 400: '400', 430: '303', 600: '101' };
  if (typeof Image !== 'undefined') {
    ['100', '101', '200', '300', '303', '400'].forEach(function (file) {
      var img = new Image();
      img.src = 'https://www.jma.go.jp/bosai/forecast/img/' + file + '.svg';
    });
  }

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

  function hasSlots(model) {
    return !!(model && model.ok && model.slots && model.slots.length);
  }

  function fail(reason) {
    if (!hasSlots(view)) view = { ok: false, reason: reason || 'unavailable', slots: [] };
    settled = true;
    var list = waiters.splice(0, waiters.length);
    list.forEach(function (fn) { fn(view); });
  }

  var source = null;

  function accept(payload) {
    var api = wx();
    var next = api ? api.normalize(payload, Date.now()) : { ok: false, reason: 'unavailable', slots: [] };
    if (!hasSlots(next) && hasSlots(view)) {
      settled = true;
      var kept = waiters.splice(0, waiters.length);
      kept.forEach(function (fn) { fn(view); });
      return;
    }
    source = payload;
    view = next;
    if (view && payload && Number(payload.refreshMs) >= 60000) view.refreshMs = Number(payload.refreshMs);
    settled = true;
    var list = waiters.splice(0, waiters.length);
    list.forEach(function (fn) { fn(view); });
  }

  function current(nowMs) {
    var api = wx();
    if (source && api) return api.normalize(source, nowMs || Date.now());
    if (!view || !view.ok) return { ok: false, reason: (view && view.reason) || 'unavailable', slots: [] };
    return view;
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

  /* 天気が返った時刻だけ。降水量だけの時刻は面にしない。 */
  function returnedSlots(model) {
    if (!model || !model.ok || !model.slots) return [];
    return model.slots.filter(function (slot) {
      return !!iconFile(slot);
    });
  }

  var FACE_PX = 128;
  var SCROLL_PX = 3;

  /* 時刻は左へ流す。一段で止めない。 */
  function pageStarts(count) {
    var n = Math.max(0, Math.floor(Number(count) || 0));
    var starts = [];
    var i;
    for (i = 0; i < n; i++) starts.push(i);
    return starts;
  }

  function onePanel(slot, day, got) {
    return panel(slotTop(slot, day), slotBody(slot), got, precText(slot));
  }

  function stripHtml(slots, day, got, laps) {
    var html = '';
    var copies = Math.max(1, Math.floor(Number(laps) || 1));
    var c;
    var i;
    for (c = 0; c < copies; c++) {
      for (i = 0; i < slots.length; i++) html += onePanel(slots[i], day, got);
    }
    for (i = 0; i < FACES; i++) html += onePanel(slots[i % slots.length], day, got);
    return html;
  }

  function paintStrip(track, html, width) {
    if (!track) return;
    track.setAttribute('data-owned', '1');
    track.innerHTML = html;
    track.style.width = width + 'px';
    track.style.transition = 'none';
    track.style.transform = 'translate3d(0,0,0)';
  }

  function missFace() {
    return panel('予報', '<div class="d5-weather-row short-miss-row"><span class="short-miss">取得できません</span></div>', '', '');
  }

  function render(track, model) {
    var html = '';
    var i;
    var slots = returnedSlots(model);
    if (!slots.length) {
      for (i = 0; i < FACES; i++) html += missFace();
    } else {
      html = stripHtml(slots, slots[0].dateLabel, fetchLabel(model), 1);
    }
    paintStrip(track, html, (slots.length ? slots.length + FACES : FACES) * FACE_PX);
  }

  function stop() {
    playing += 1;
    if (frameTimer) clearTimeout(frameTimer);
    frameTimer = 0;
    if (anim) {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(anim);
      anim = 0;
    }
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
    var laps = Math.max(1, Math.floor(Number(o.laps) || 1));
    var day = slots[0].dateLabel;
    var got = fetchLabel(model);
    var distance = slots.length * laps * FACE_PX;
    var speed = Number(o.speed);
    if (!isFinite(speed) || speed <= 0) speed = SCROLL_PX;
    var moved = 0;
    paintStrip(track, stripHtml(slots, day, got, laps), distance + FACES * FACE_PX);
    if (o.onLayout) o.onLayout();
    function frame() {
      if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(tick);
      return setTimeout(tick, 16);
    }
    function tick() {
      if (token !== playing) return;
      moved = Math.min(distance, moved + speed);
      track.style.transition = 'none';
      track.style.transform = 'translate3d(' + (-moved) + 'px,0,0)';
      if (moved >= distance) {
        anim = 0;
        finish();
        return;
      }
      anim = frame();
    }
    anim = frame();
  }

  var api = {
    id: 'short-forecast',
    start: start,
    load: load,
    whenReady: whenReady,
    current: current,
    FACES: FACES,
    FRAME_MS: FRAME_MS,
    pageStarts: pageStarts,
    render: render,
    play: play,
    stop: stop,
    _accept: accept,
    _fail: fail
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeShortForecast = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
