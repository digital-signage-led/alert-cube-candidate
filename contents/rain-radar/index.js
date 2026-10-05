/**
 * 雨雲レーダー。
 * 台風情報と同じく 128×128 を4面に並べ、各面は現場を中心にした同じレーダー。
 * targetTimes の時刻数字は協定世界時。画面に出す時刻は日本時間。
 */
(function (global) {
  'use strict';

  var ZOOM = 8;
  var VIEW_W = 128;
  var VIEW_H = 128;
  var FACES = 4;
  var TILE = 256;
  var FRAME_MS = 1500;
  var MAX_AGE_MS = 30 * 60 * 1000;
  var TIMES_URL = 'https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N2.json';
  var RADAR_URL = 'https://www.jma.go.jp/bosai/jmatile/data/nowc/{basetime}/none/{validtime}/surf/hrpns/{z}/{x}/{y}.png';
  var MAP_URL = 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png';

  function locationOf(site) {
    var geo = (site && site.geo) || {};
    var lat = geo.lat != null ? Number(geo.lat) : Number(site && site.latitude);
    var lon = geo.lon != null ? Number(geo.lon) : Number(site && site.longitude);
    if (!isFinite(lat) || !isFinite(lon)) return null;
    return { lat: lat, lon: lon };
  }

  function worldPixel(lat, lon, z) {
    var n = Math.pow(2, z);
    var x = (lon + 180) / 360 * n * TILE;
    var latRad = lat * Math.PI / 180;
    var y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n * TILE;
    return { x: x, y: y };
  }

  function tilesForView(lat, lon, z, w, h) {
    var p = worldPixel(lat, lon, z);
    var originX = p.x - w / 2;
    var originY = p.y - h / 2;
    var n = Math.pow(2, z);
    var x0 = Math.floor(originX / TILE);
    var x1 = Math.floor((originX + w - 1) / TILE);
    var y0 = Math.floor(originY / TILE);
    var y1 = Math.floor((originY + h - 1) / TILE);
    var tiles = [];
    var ty;
    var tx;
    for (ty = y0; ty <= y1; ty++) {
      if (ty < 0 || ty >= n) continue;
      for (tx = x0; tx <= x1; tx++) {
        tiles.push({
          z: z,
          x: ((tx % n) + n) % n,
          y: ty,
          left: Math.round(tx * TILE - originX),
          top: Math.round(ty * TILE - originY)
        });
      }
    }
    return { tiles: tiles };
  }

  function parseUtcMs(s) {
    var t = String(s || '');
    if (!/^\d{14}$/.test(t)) return null;
    return Date.UTC(
      Number(t.slice(0, 4)), Number(t.slice(4, 6)) - 1, Number(t.slice(6, 8)),
      Number(t.slice(8, 10)), Number(t.slice(10, 12)), Number(t.slice(12, 14))
    );
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function labelOf(validtime) {
    var ms = parseUtcMs(validtime);
    if (ms == null) return '';
    var jst = new Date(ms + 9 * 60 * 60 * 1000);
    return pad2(jst.getUTCHours()) + ':' + pad2(jst.getUTCMinutes());
  }

  function selectFrames(times, nowMs) {
    if (!Array.isArray(times) || !times.length || nowMs == null) return null;
    var base = parseUtcMs(times[0].basetime);
    if (base == null) return null;
    var age = nowMs - base;
    if (age > MAX_AGE_MS || age < -5 * 60 * 1000) return null;
    var frames = [];
    times.forEach(function (row) {
      if (!row || !row.basetime || !row.validtime) return;
      var at = parseUtcMs(row.validtime);
      if (at == null) return;
      frames.push({
        basetime: String(row.basetime),
        validtime: String(row.validtime),
        at: at,
        label: labelOf(row.validtime)
      });
    });
    frames.sort(function (a, b) { return a.at - b.at; });
    return frames.length ? frames : null;
  }

  function mapUrl(tile) {
    return MAP_URL.replace('{z}', tile.z).replace('{x}', tile.x).replace('{y}', tile.y);
  }

  function radarUrl(frame, tile) {
    return RADAR_URL
      .replace('{basetime}', frame.basetime)
      .replace('{validtime}', frame.validtime)
      .replace('{z}', tile.z)
      .replace('{x}', tile.x)
      .replace('{y}', tile.y);
  }

  function shellHtml() {
    var html = '<div class="rr-faces">';
    var i;
    for (i = 0; i < FACES; i++) {
      html += '<div class="rr-face"><canvas class="rr-canvas" width="' + VIEW_W + '" height="' + VIEW_H + '"></canvas></div>';
    }
    return html + '</div>';
  }

  function canvasList(canvases) {
    if (!canvases) return [];
    if (typeof canvases.length === 'number' && !canvases.getContext) {
      var list = [];
      var i;
      for (i = 0; i < canvases.length; i++) list.push(canvases[i]);
      return list;
    }
    return [canvases];
  }

  function loadImage(url, attempt) {
    return new Promise(function (resolve) {
      if (typeof Image === 'undefined') { resolve(null); return; }
      var done = false;
      function finish(img) {
        if (done) return;
        done = true;
        resolve(img || null);
      }
      var img = new Image();
      var timer = setTimeout(function () {
        img.onload = null;
        img.onerror = null;
        img.src = '';
        if (attempt) finish(null);
        else loadImage(url, 1).then(finish);
      }, 6000);
      img.onload = function () { clearTimeout(timer); finish(img); };
      img.onerror = function () {
        clearTimeout(timer);
        if (attempt) finish(null);
        else loadImage(url, 1).then(finish);
      };
      img.src = url;
    });
  }

  function drawTile(ctx, img, tile) {
    if (!img) return;
    try { ctx.drawImage(img, tile.left, tile.top); } catch (e) { /* 1枚失敗でも面は出す */ }
  }

  function paint(canvas, tiles, mapImgs, radarImgs, label) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#d5e3ea';
    ctx.fillRect(0, 0, w, h);
    tiles.forEach(function (tile, i) { drawTile(ctx, mapImgs[i], tile); });
    tiles.forEach(function (tile, i) { drawTile(ctx, radarImgs[i], tile); });
    var cx = w / 2;
    var cy = h / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#d00000';
    ctx.stroke();
    var text = '雨雲 ' + (label || '');
    ctx.font = '700 16px "Noto Sans JP", sans-serif';
    ctx.textBaseline = 'middle';
    var tw = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(6,40,74,0.88)';
    ctx.fillRect(0, 0, Math.ceil(tw) + 16, 28);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 8, 14);
    var credit = '気象庁・地理院';
    ctx.font = '700 11px "Noto Sans JP", sans-serif';
    var cw = ctx.measureText(credit).width;
    ctx.fillStyle = 'rgba(255,255,255,0.86)';
    ctx.fillRect(w - cw - 12, h - 18, cw + 12, 18);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillText(credit, w - cw - 6, h - 9);
  }

  function drawMessage(canvases, text) {
    canvasList(canvases).forEach(function (canvas) {
      if (!canvas) return;
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#06284A';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 18px "Noto Sans JP", sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(text || '雨雲を取得できません', 8, canvas.height / 2);
    });
  }

  function prepare(site, nowMs) {
    var loc = locationOf(site);
    if (!loc || typeof fetch !== 'function') return Promise.resolve(null);
    var view = tilesForView(loc.lat, loc.lon, ZOOM, VIEW_W, VIEW_H);
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
    return fetch(TIMES_URL, ctrl ? { cache: 'no-store', signal: ctrl.signal } : { cache: 'no-store' }).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) throw new Error('nowc times ' + res.status);
      return res.json();
    }).then(function (times) {
      var frames = selectFrames(times, nowMs);
      if (!frames) return null;
      return Promise.all(view.tiles.map(function (tile) {
        return loadImage(mapUrl(tile));
      })).then(function (maps) {
        return { tiles: view.tiles, maps: maps, frames: frames };
      });
    }).catch(function () { return null; });
  }

  function drawFrame(canvases, plan, index) {
    var frame = plan && plan.frames && plan.frames[index];
    if (!frame) return Promise.resolve();
    var ready = frame.images
      ? Promise.resolve(frame.images)
      : Promise.all(plan.tiles.map(function (tile) {
        return loadImage(radarUrl(frame, tile));
      })).then(function (imgs) {
        frame.images = imgs;
        return imgs;
      });
    return ready.then(function (imgs) {
      canvasList(canvases).forEach(function (canvas) {
        paint(canvas, plan.tiles, plan.maps, imgs, frame.label);
      });
    });
  }

  var api = {
    ZOOM: ZOOM,
    VIEW_W: VIEW_W,
    VIEW_H: VIEW_H,
    FACES: FACES,
    FRAME_MS: FRAME_MS,
    locationOf: locationOf,
    worldPixel: worldPixel,
    tilesForView: tilesForView,
    parseUtcMs: parseUtcMs,
    labelOf: labelOf,
    selectFrames: selectFrames,
    mapUrl: mapUrl,
    radarUrl: radarUrl,
    shellHtml: shellHtml,
    prepare: prepare,
    drawFrame: drawFrame,
    drawMessage: drawMessage
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeRainRadar = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
