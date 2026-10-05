/**
 * 雨雲レーダー。
 * 台風情報と同じく 128×128 を4面に並べ、各面は現場を中心にした同じレーダー。
 * 下地は淡色地図の陸と海を単色にし、白地図の海岸と県境だけ重ねる。
 * 国土は雨の青・黄・赤が沈まない灰色。
 * targetTimes の時刻数字は協定世界時。
 */
(function (global) {
  'use strict';

  var ZOOM = 6;
  var VIEW_W = 128;
  var VIEW_H = 128;
  var FACES = 4;
  var TILE = 256;
  var FRAME_MS = 1500;
  var MAX_AGE_MS = 30 * 60 * 1000;
  var TIMES_URL = 'https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N2.json';
  var RADAR_URL = 'https://www.jma.go.jp/bosai/jmatile/data/nowc/{basetime}/none/{validtime}/surf/hrpns/{z}/{x}/{y}.png';
  var MAP_URL = 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png';
  var LINE_URL = 'https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png';
  var OCEAN = [79, 143, 191];
  var LAND = [186, 191, 196];
  var LINE = [92, 99, 107];

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

  function mapUrl(tile) {
    return MAP_URL.replace('{z}', tile.z).replace('{x}', tile.x).replace('{y}', tile.y);
  }

  function lineUrl(tile) {
    return LINE_URL.replace('{z}', tile.z).replace('{x}', tile.x).replace('{y}', tile.y);
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
      img.crossOrigin = 'anonymous';
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

  function isSeaPixel(r, g, b) {
    return b > 200 && b > r + 25 && g + 8 >= r;
  }

  function isInkPixel(r, g, b) {
    var max = r > g ? (r > b ? r : b) : (g > b ? g : b);
    var min = r < g ? (r < b ? r : b) : (g < b ? g : b);
    var y = (r + g + b) / 3;
    return y < 160 && max - min < 45;
  }

  function flattenBasemap(ctx, w, h) {
    var img = ctx.getImageData(0, 0, w, h);
    var d = img.data;
    var n = w * h;
    var kind = new Uint8Array(n);
    var i;
    var p;
    for (i = 0, p = 0; i < n; i++, p += 4) {
      if (isSeaPixel(d[p], d[p + 1], d[p + 2])) kind[i] = 1;
      else if (isInkPixel(d[p], d[p + 1], d[p + 2])) kind[i] = 3;
      else kind[i] = 2;
    }
    for (i = 0; i < n; i++) {
      if (kind[i] !== 3) continue;
      var x = i % w;
      var y = (i / w) | 0;
      var sea = false;
      var dy;
      var dx;
      for (dy = -3; dy <= 3 && !sea; dy++) {
        for (dx = -3; dx <= 3; dx++) {
          var nx = x + dx;
          var ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (kind[ny * w + nx] === 1) { sea = true; break; }
        }
      }
      kind[i] = sea ? 1 : 2;
    }
    for (i = 0, p = 0; i < n; i++, p += 4) {
      var rgb = kind[i] === 1 ? OCEAN : LAND;
      d[p] = rgb[0];
      d[p + 1] = rgb[1];
      d[p + 2] = rgb[2];
      d[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  function boundaryCanvas(img) {
    if (!img || !img.width) return null;
    if (img._acBoundary) return img._acBoundary;
    var c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    var sctx = c.getContext('2d');
    sctx.drawImage(img, 0, 0);
    var frame = sctx.getImageData(0, 0, c.width, c.height);
    var d = frame.data;
    var i;
    for (i = 0; i < d.length; i += 4) {
      var y = (d[i] + d[i + 1] + d[i + 2]) / 3;
      if (d[i + 3] > 16 && y < 170) {
        d[i] = LINE[0];
        d[i + 1] = LINE[1];
        d[i + 2] = LINE[2];
        d[i + 3] = 255;
      } else {
        d[i + 3] = 0;
      }
    }
    sctx.putImageData(frame, 0, 0);
    img._acBoundary = c;
    return c;
  }

  function paint(canvas, plan, radarImgs) {
    if (!canvas || !plan) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgb(' + OCEAN[0] + ',' + OCEAN[1] + ',' + OCEAN[2] + ')';
    ctx.fillRect(0, 0, w, h);
    plan.tiles.forEach(function (tile, i) { drawTile(ctx, plan.maps[i], tile); });
    try { flattenBasemap(ctx, w, h); } catch (e) { /* 画素が読めないときは淡色のまま */ }
    var lines = plan.lines || [];
    plan.tiles.forEach(function (tile, i) {
      try { drawTile(ctx, boundaryCanvas(lines[i]), tile); } catch (e) { /* 境界がなくても陸海は出す */ }
    });
    plan.tiles.forEach(function (tile, i) { drawTile(ctx, radarImgs[i], tile); });
    var cx = w / 2;
    var cy = h / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#d00000';
    ctx.stroke();
    var credit = '気象庁・地理院';
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
      return Promise.all([
        Promise.all(view.tiles.map(function (tile) { return loadImage(mapUrl(tile)); })),
        Promise.all(view.tiles.map(function (tile) { return loadImage(lineUrl(tile)); }))
      ]).then(function (pair) {
        return { tiles: view.tiles, maps: pair[0], lines: pair[1], frames: frames };
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
    mapUrl: mapUrl,
    lineUrl: lineUrl,
    radarUrl: radarUrl,
    shellHtml: shellHtml,
    prepare: prepare,
    drawFrame: drawFrame,
    drawMessage: drawMessage
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeRainRadar = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
