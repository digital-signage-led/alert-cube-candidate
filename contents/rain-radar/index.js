/**
 * 雨雲レーダー。
 * 台風情報と同じく 128×128 を4面に並べ、各面は現場を中心にした同じレーダー。
 * 背景は道路のない陸と海。降水タイルの明るい色が乗るように海は暗くする。
 * targetTimes の時刻数字は協定世界時。
 */
(function (global) {
  'use strict';

  var ZOOM = 4;
  var VIEW_W = 128;
  var VIEW_H = 128;
  var FACES = 4;
  var TILE = 256;
  var FRAME_MS = 1500;
  var MAX_AGE_MS = 30 * 60 * 1000;
  var OCEAN = '#0e2a4a';
  var LAND = '#efe6d2';
  var LAND_EDGE = '#c4b89a';
  var TIMES_URL = 'https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N2.json';
  var RADAR_URL = 'https://www.jma.go.jp/bosai/jmatile/data/nowc/{basetime}/none/{validtime}/surf/hrpns/{z}/{x}/{y}.png';
  /* 台風情報と同じ簡略海岸線。lon, lat */
  var LANDS = [
    [[143.82,44.12],[144.72,43.93],[145.37,44.33],[145.13,43.87],[145.14,43.66],[145.34,43.3],[145.83,43.39],[144.92,43],[143.97,42.88],[143.43,42.42],[143.24,42],[141.85,42.58],[141.41,42.55],[140.99,42.34],[140.71,42.56],[140.48,42.56],[140.33,42.29],[141.15,41.81],[140.66,41.82],[140.38,41.52],[140.09,41.43],[140,41.58],[140.11,41.91],[139.84,42.28],[139.86,42.58],[140.43,42.95],[140.39,43.3],[141.14,43.18],[141.37,43.28],[141.4,43.64],[141.76,44.48],[141.78,44.72],[141.58,45.16],[141.67,45.4],[141.98,45.48],[142.88,44.67],[143.76,44.13],[143.82,44.12]],
    [[141.23,41.37],[141.46,41.4],[141.43,40.72],[141.8,40.29],[141.98,39.43],[141.47,38.4],[140.96,38.15],[141,37.11],[140.57,36.23],[140.87,35.72],[140.46,35.51],[140.35,35.18],[139.84,34.91],[139.83,35.3],[140.1,35.59],[139.83,35.66],[139.68,35.15],[139.25,35.28],[138.84,34.62],[138.9,35.03],[138.72,35.12],[138.19,34.6],[137.06,34.58],[137.28,34.77],[136.87,34.73],[136.8,35.05],[136.53,34.68],[136.85,34.32],[136.33,34.18],[135.7,33.49],[135.13,34.01],[135.1,34.29],[135.42,34.62],[134.74,34.77],[133.14,34.3],[132.31,34.32],[132.15,33.84],[131.74,34.05],[130.92,33.98],[131,34.39],[131.35,34.41],[132.92,35.51],[135.17,35.75],[135.33,35.53],[135.9,35.61],[136.1,35.77],[136.07,36.12],[136.7,36.74],[136.84,37.38],[137.32,37.52],[136.9,37.12],[137.25,36.75],[138.32,37.22],[139.36,38.1],[139.8,38.88],[140.06,39.62],[139.74,39.92],[140.01,40.26],[139.97,40.67],[140.28,40.85],[140.39,41.23],[140.63,41.2],[140.75,40.83],[141.18,40.92],[141.2,41.24],[140.8,41.14],[140.89,41.48],[141.11,41.46],[141.23,41.37]],
    [[134.36,34.26],[134.64,34.23],[134.67,33.85],[134.74,33.82],[134.38,33.61],[134.18,33.25],[133.96,33.45],[133.63,33.51],[133.29,33.36],[132.87,32.75],[132.64,32.76],[132.71,32.9],[132.5,32.92],[132.43,33.06],[132.51,33.29],[132.41,33.33],[132.41,33.43],[132.03,33.34],[132.64,33.69],[132.78,33.99],[132.94,34.1],[133.13,33.93],[133.47,33.97],[133.63,34.07],[133.6,34.24],[133.95,34.35],[134.22,34.32],[134.36,34.26]],
    [[131.17,33.6],[131.7,33.6],[131.54,33.27],[131.9,33.25],[132,32.88],[131.66,32.47],[131.34,31.4],[131.07,31.44],[131.1,31.26],[130.69,31.02],[130.8,31.67],[130.66,31.72],[130.59,31.18],[130.2,31.29],[130.32,31.6],[130.19,32.09],[130.64,32.62],[130.24,33.18],[130.18,32.85],[130.34,32.7],[130.05,32.77],[129.77,32.57],[129.68,33.06],[129.99,32.85],[129.61,33.34],[129.84,33.32],[130.72,33.93],[131.06,33.67],[131.17,33.6]],
    [[138.34,37.82],[138.23,37.83],[138.32,37.97],[138.25,38.08],[138.5,38.32],[138.45,38.08],[138.58,38.07],[138.5,37.9],[138.34,37.82]],
    [[134.93,34.29],[134.82,34.2],[134.67,34.29],[134.96,34.54],[134.91,34.4],[134.93,34.29]]
  ];

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
    return { tiles: tiles, originX: originX, originY: originY };
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

  function drawLand(ctx, originX, originY) {
    ctx.fillStyle = LAND;
    ctx.strokeStyle = LAND_EDGE;
    ctx.lineWidth = 1;
    LANDS.forEach(function (ring) {
      ctx.beginPath();
      ring.forEach(function (pt, i) {
        var p = worldPixel(pt[1], pt[0], ZOOM);
        var x = p.x - originX;
        var y = p.y - originY;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
  }

  function paint(canvas, plan, radarImgs) {
    if (!canvas || !plan) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = OCEAN;
    ctx.fillRect(0, 0, w, h);
    drawLand(ctx, plan.originX, plan.originY);
    plan.tiles.forEach(function (tile, i) { drawTile(ctx, radarImgs[i], tile); });
    var cx = w / 2;
    var cy = h / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#d00000';
    ctx.stroke();
    var credit = '気象庁';
    ctx.font = '700 11px "Noto Sans JP", sans-serif';
    ctx.textBaseline = 'middle';
    var cw = ctx.measureText(credit).width;
    ctx.fillStyle = 'rgba(14,42,74,0.72)';
    ctx.fillRect(w - cw - 10, h - 16, cw + 10, 16);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(credit, w - cw - 5, h - 8);
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
      return { tiles: view.tiles, originX: view.originX, originY: view.originY, frames: frames };
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
        paint(canvas, plan, imgs);
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
    radarUrl: radarUrl,
    shellHtml: shellHtml,
    prepare: prepare,
    drawFrame: drawFrame,
    drawMessage: drawMessage
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeRainRadar = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
