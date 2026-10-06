/**
 * 雨雲レーダー。
 * 台風情報と同じく 128×128 を4面に並べ、各面は現場を中心にした同じレーダー。
 * 下地は県の外形だけ。線は海岸の輪郭と県境。琵琶湖など内水面は海の色にしない。
 * 国土は雨の青・黄・赤が沈まない灰色。
 * targetTimes の時刻数字は協定世界時。
 */
(function (global) {
  'use strict';

  var ZOOM = 8;
  var VIEW_W = 128;
  var VIEW_H = 128;
  var DRAW_SCALE = 4;
  var FACES = 4;
  var TILE = 256;
  var FRAME_MS = 1500;
  var MAX_AGE_MS = 30 * 60 * 1000;
  var TIMES_URL = 'https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N2.json';
  var RADAR_URL = 'https://www.jma.go.jp/bosai/jmatile/data/nowc/{basetime}/none/{validtime}/surf/hrpns/{z}/{x}/{y}.png';
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
      html += '<div class="rr-face"><canvas class="rr-canvas" width="' + (VIEW_W * DRAW_SCALE) + '" height="' + (VIEW_H * DRAW_SCALE) + '"></canvas></div>';
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

  var RAIN_ALPHA = 128;

  function countRainPixels(data, width, height, step) {
    if (!data || !width || !height) return 0;
    var stride = step > 1 ? step : 1;
    var rain = 0;
    var y;
    var x;
    var i;
    for (y = 0; y < height; y += stride) {
      for (x = 0; x < width; x += stride) {
        i = (y * width + x) * 4 + 3;
        if (data[i] >= RAIN_ALPHA) rain += 1;
      }
    }
    return rain;
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

  function traceRing(ctx, ring, originX, originY) {
    var i;
    for (i = 0; i < ring.length; i++) {
      var p = worldPixel(ring[i][1], ring[i][0], ZOOM);
      var x = p.x - originX;
      var y = p.y - originY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function landRings(pref) {
    if (!pref) return [];
    if (pref.land) return pref.land;
    return Array.isArray(pref) ? pref : [];
  }

  function drawPrefectures(ctx, originX, originY) {
    var prefs = typeof AlertCubePrefectures !== 'undefined' ? AlertCubePrefectures : [];
    var land = 'rgb(' + LAND[0] + ',' + LAND[1] + ',' + LAND[2] + ')';
    var line = 'rgb(' + LINE[0] + ',' + LINE[1] + ',' + LINE[2] + ')';
    var pi;
    var ri;
    var rings;
    ctx.fillStyle = land;
    for (pi = 0; pi < prefs.length; pi++) {
      rings = landRings(prefs[pi]);
      for (ri = 0; ri < rings.length; ri++) {
        ctx.beginPath();
        traceRing(ctx, rings[ri], originX, originY);
        ctx.fill();
      }
      rings = prefs[pi] && prefs[pi].lakes || [];
      for (ri = 0; ri < rings.length; ri++) {
        ctx.beginPath();
        traceRing(ctx, rings[ri], originX, originY);
        ctx.fill();
      }
    }
    strokeBorders(ctx, prefs, originX, originY, line);
  }

  function borderKey(a, b) {
    return a < b ? a + '|' + b : b + '|' + a;
  }

  function strokeBorders(ctx, prefs, originX, originY, line) {
    var adj = Object.create(null);
    var xy = Object.create(null);
    var seen = Object.create(null);
    var pi;
    var ri;
    var rings;
    var i;
    var ring;
    function idOf(pt) {
      return pt[0] + ',' + pt[1];
    }
    function link(a, b) {
      var ia = idOf(a);
      var ib = idOf(b);
      if (ia === ib) return;
      var ek = borderKey(ia, ib);
      if (seen[ek]) return;
      seen[ek] = 1;
      if (!adj[ia]) adj[ia] = [];
      if (!adj[ib]) adj[ib] = [];
      adj[ia].push(ib);
      adj[ib].push(ia);
      xy[ia] = a;
      xy[ib] = b;
    }
    for (pi = 0; pi < prefs.length; pi++) {
      rings = landRings(prefs[pi]);
      for (ri = 0; ri < rings.length; ri++) {
        ring = rings[ri];
        for (i = 0; i < ring.length; i++) link(ring[i], ring[(i + 1) % ring.length]);
      }
    }
    var used = Object.create(null);
    ctx.beginPath();
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    Object.keys(adj).forEach(function (start) {
      adj[start].forEach(function (nb) {
        var e0 = borderKey(start, nb);
        if (used[e0]) return;
        var chain = [start, nb];
        used[e0] = 1;
        var prev = start;
        var cur = nb;
        var guard = 0;
        while (adj[cur] && adj[cur].length === 2 && guard < 100000) {
          var nxt = adj[cur][0] === prev ? adj[cur][1] : adj[cur][0];
          var ek = borderKey(cur, nxt);
          if (used[ek]) break;
          used[ek] = 1;
          chain.push(nxt);
          prev = cur;
          cur = nxt;
          guard += 1;
          if (cur === start) break;
        }
        if (adj[start] && adj[start].length === 2 && chain[chain.length - 1] !== start) {
          prev = chain[1];
          cur = start;
          guard = 0;
          while (adj[cur] && adj[cur].length === 2 && guard < 100000) {
            var nxt2 = adj[cur][0] === prev ? adj[cur][1] : adj[cur][0];
            var ek2 = borderKey(cur, nxt2);
            if (used[ek2]) break;
            used[ek2] = 1;
            chain.unshift(nxt2);
            prev = cur;
            cur = nxt2;
            guard += 1;
          }
        }
        var p0 = worldPixel(xy[chain[0]][1], xy[chain[0]][0], ZOOM);
        ctx.moveTo(p0.x - originX, p0.y - originY);
        for (i = 1; i < chain.length; i++) {
          var p = worldPixel(xy[chain[i]][1], xy[chain[i]][0], ZOOM);
          ctx.lineTo(p.x - originX, p.y - originY);
        }
      });
    });
    ctx.stroke();
  }

  var landCache = { key: '', canvas: null };

  function landCanvas(originX, originY) {
    var key = originX + ',' + originY;
    if (landCache.key === key && landCache.canvas) return landCache.canvas;
    if (typeof document === 'undefined') return null;
    var canvas = document.createElement('canvas');
    canvas.width = VIEW_W * DRAW_SCALE;
    canvas.height = VIEW_H * DRAW_SCALE;
    var ctx = canvas.getContext('2d');
    ctx.setTransform(DRAW_SCALE, 0, 0, DRAW_SCALE, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = 'rgb(' + OCEAN[0] + ',' + OCEAN[1] + ',' + OCEAN[2] + ')';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    drawPrefectures(ctx, originX, originY);
    landCache = { key: key, canvas: canvas };
    return canvas;
  }

  function paint(canvas, plan, radarImgs, label) {
    if (!canvas || !plan) return;
    var ctx = canvas.getContext('2d');
    var scale = canvas.width / VIEW_W || 1;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    var w = VIEW_W;
    var h = VIEW_H;
    ctx.clearRect(0, 0, w, h);
    var land = landCanvas(plan.originX, plan.originY);
    if (land) ctx.drawImage(land, 0, 0, w, h);
    else {
      ctx.fillStyle = 'rgb(' + OCEAN[0] + ',' + OCEAN[1] + ',' + OCEAN[2] + ')';
      ctx.fillRect(0, 0, w, h);
      drawPrefectures(ctx, plan.originX, plan.originY);
    }
    (radarImgs || []).forEach(function (img, i) { drawTile(ctx, img, plan.tiles[i]); });
    var cx = w / 2;
    var cy = h / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#d00000';
    ctx.stroke();
    ctx.font = '700 8px "Noto Sans JP", sans-serif';
    ctx.textBaseline = 'middle';
    if (label) {
      var tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(14,42,74,0.72)';
      ctx.fillRect(0, h - 11, tw + 4, 11);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, 2, h - 5.5);
    }
    var credit = '気象庁・地理院';
    var cw = ctx.measureText(credit).width;
    ctx.fillStyle = 'rgba(14,42,74,0.72)';
    ctx.fillRect(w - cw - 4, h - 11, cw + 4, 11);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(credit, w - cw - 2, h - 5.5);
  }

  function drawMessage(canvases, text) {
    canvasList(canvases).forEach(function (canvas) {
      if (!canvas) return;
      var ctx = canvas.getContext('2d');
      var scale = canvas.width / VIEW_W || 1;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = '#06284A';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 18px "Noto Sans JP", sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(text || '雨雲を取得できません', 8, VIEW_H / 2);
    });
  }

  function basemap(site) {
    var loc = locationOf(site);
    if (!loc) return null;
    var view = tilesForView(loc.lat, loc.lon, ZOOM, VIEW_W, VIEW_H);
    return {
      tiles: view.tiles,
      originX: view.originX,
      originY: view.originY,
      frames: []
    };
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
      return {
        tiles: view.tiles,
        originX: view.originX,
        originY: view.originY,
        frames: frames
      };
    }).catch(function () { return null; });
  }

  function loadImageCors(url) {
    return new Promise(function (resolve) {
      if (typeof Image === 'undefined') { resolve(null); return; }
      var img = new Image();
      var timer = setTimeout(function () { resolve(null); }, 6000);
      img.crossOrigin = 'anonymous';
      img.onload = function () { clearTimeout(timer); resolve(img); };
      img.onerror = function () { clearTimeout(timer); resolve(null); };
      img.src = url;
    });
  }

  function frameHasRain(plan, frame) {
    if (!plan || !frame || typeof document === 'undefined') return Promise.resolve(false);
    return Promise.all(plan.tiles.map(function (tile) {
      return loadImageCors(radarUrl(frame, tile));
    })).then(function (imgs) {
      var canvas = document.createElement('canvas');
      canvas.width = VIEW_W;
      canvas.height = VIEW_H;
      var ctx = canvas.getContext('2d');
      var i;
      for (i = 0; i < imgs.length; i++) {
        if (imgs[i]) drawTile(ctx, imgs[i], plan.tiles[i]);
      }
      var data;
      try {
        data = ctx.getImageData(0, 0, VIEW_W, VIEW_H).data;
      } catch (e) {
        return false;
      }
      return countRainPixels(data, VIEW_W, VIEW_H, 2) > 0;
    });
  }

  function viewHasRain(plan) {
    var frames = plan && plan.frames;
    if (!frames || !frames.length) return Promise.resolve(false);
    var index = 0;
    function next() {
      if (index >= frames.length) return Promise.resolve(false);
      var frame = frames[index];
      index += 1;
      return frameHasRain(plan, frame).then(function (rain) {
        if (rain) return true;
        return next();
      });
    }
    return next();
  }

  function loadFrame(plan, frame) {
    if (!frame) return Promise.resolve([]);
    if (frame.images) return Promise.resolve(frame.images);
    return Promise.all(plan.tiles.map(function (tile) {
      return loadImage(radarUrl(frame, tile));
    })).then(function (imgs) {
      if (imgs.some(Boolean)) frame.images = imgs;
      return imgs;
    });
  }

  function preload(plan) {
    if (!plan || !plan.frames) return Promise.resolve([]);
    return Promise.all(plan.frames.map(function (frame) {
      return loadFrame(plan, frame);
    }));
  }

  function drawFrame(canvases, plan, index) {
    if (!plan) return Promise.resolve();
    var frame = plan.frames && plan.frames[index];
    return loadFrame(plan, frame).then(function (imgs) {
      canvasList(canvases).forEach(function (canvas) {
        paint(canvas, plan, imgs, frame && frame.label);
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
    countRainPixels: countRainPixels,
    viewHasRain: viewHasRain,
    radarUrl: radarUrl,
    shellHtml: shellHtml,
    basemap: basemap,
    prepare: prepare,
    preload: preload,
    drawFrame: drawFrame,
    drawMessage: drawMessage
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeRainRadar = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
