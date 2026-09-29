/**
 * 地震・水害の緊急割り込み表示。
 * 通常シーンは止めない。発表中だけ content-area の上に出し、解除確認後に外す。
 * 取得失敗のあいだは直前の緊急表示を維持し、真っ黒にはしない。
 */
(function (global) {
  'use strict';

  var Eval = function () { return global.AlertCubeHazardEvaluate; };
  var QUAKE_URL = 'https://www.jma.go.jp/bosai/quake/data/list.json';
  var started_ = false;
  var timer_ = 0;
  var busy_ = false;
  var watch_ = null;
  var faceTimer_ = 0;
  var faceIndex_ = 0;

  function cfg() {
    return global.SignageConfig || {};
  }

  function query() {
    try { return new URLSearchParams(global.location && global.location.search || ''); }
    catch (_) { return { get: function () { return null; } }; }
  }

  function previewAllowed() {
    var status = '';
    if (global.AlertCubeFoundation && global.AlertCubeFoundation.currentStatus) {
      status = global.AlertCubeFoundation.currentStatus();
    } else {
      status = cfg().status || '';
    }
    return String(status).toLowerCase() === 'test';
  }

  function layoutOf() {
    var q = String(query().get('hazardFace') || '');
    if (q === '256') return '256';
    var resolution = String(cfg().resolution || cfg().profile || '');
    return resolution.indexOf('256') === 0 ? '256' : '128';
  }

  function contentOn() {
    return !global.AlertCubeContent || global.AlertCubeContent.isOn('hazard');
  }

  function injectStyle() {
    if (document.getElementById('hazard-style')) return;
    var style = document.createElement('style');
    style.id = 'hazard-style';
    style.textContent = [
      '#sceneHazard{display:none;position:absolute;left:0;top:0;width:512px;height:128px;z-index:40;overflow:hidden;pointer-events:none;}',
      '#sceneHazard.hz-on{display:flex;flex-direction:row;}',
      '#sceneHazard .hz-band{position:absolute;left:0;top:50%;width:100%;height:104px;margin-top:-52px;background:#000;z-index:1;}',
      '#sceneHazard .hz-face{position:relative;z-index:2;width:128px;height:128px;flex:0 0 128px;box-sizing:border-box;overflow:hidden;font-family:"Noto Sans JP",sans-serif;font-weight:900;text-align:center;background:transparent;}',
      '#sceneHazard .hz-face.hz-wide{width:256px;flex-basis:256px;}',
      '#sceneHazard .hz-copy{position:absolute;left:0;top:50%;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;width:100%;height:104px;margin-top:-52px;overflow:hidden;}',
      '#sceneHazard .hz-line{max-width:100%;color:#fff;white-space:nowrap;letter-spacing:0;line-height:1;}'
    ].join('');
    document.head.appendChild(style);
  }

  function rootEl() {
    var area = document.querySelector('.content-area');
    if (!area) return null;
    var root = document.getElementById('sceneHazard');
    if (root) return root;
    injectStyle();
    root = document.createElement('div');
    root.id = 'sceneHazard';
    root.setAttribute('role', 'status');
    area.appendChild(root);
    return root;
  }

  function hide() {
    if (faceTimer_) { clearInterval(faceTimer_); faceTimer_ = 0; }
    var root = document.getElementById('sceneHazard');
    if (!root) return;
    root.className = '';
    root.removeAttribute('data-key');
    root.innerHTML = '';
  }

  function units(line) {
    var n = 0;
    String(line || '').split('').forEach(function (ch) {
      n += /[0-9A-Za-z.m-]/.test(ch) ? 0.58 : 1;
    });
    return Math.max(n, 1);
  }

  function fontPx(frame, wide) {
    var lines = frame.lines || [];
    var longest = 1;
    lines.forEach(function (line) {
      var n = units(line);
      if (n > longest) longest = n;
    });
    var width = wide ? 244 : 120;
    var size = Math.floor(width / longest);
    var max = frame.role === 'value' ? (wide ? 84 : 64) : (lines.length > 1 ? (wide ? 48 : 42) : (wide ? 64 : 52));
    if (size > max) size = max;
    if (size < 22) size = 22;
    return size;
  }

  function fitLine(el) {
    var size = Number(el.getAttribute('data-size')) || 32;
    var guard = 16;
    while (el.scrollWidth > el.clientWidth + 1 && size > 22 && guard > 0) {
      size -= 1;
      guard -= 1;
      el.style.fontSize = size + 'px';
    }
  }

  function bandHeightFor(frame, wide) {
    var size = fontPx(frame, wide);
    var count = (frame.lines || []).length || 1;
    var gap = 8;
    var block = size * count + gap * (count - 1);
    return Math.min(116, Math.round(block + 8));
  }

  function uniformBandHeight(presentation) {
    var wide = presentation.layout === '256';
    var h = 0;
    (presentation.frames || []).forEach(function (frame) {
      var n = bandHeightFor(frame, wide);
      if (n > h) h = n;
    });
    return h || 104;
  }

  function applyBand(root, h) {
    var band = root.querySelector('.hz-band');
    if (band) {
      band.style.height = h + 'px';
      band.style.marginTop = (-h / 2) + 'px';
    }
    root.querySelectorAll('.hz-copy').forEach(function (copy) {
      copy.style.height = h + 'px';
      copy.style.marginTop = (-h / 2) + 'px';
    });
  }

  function paint(root, presentation) {
    var frame = presentation.frames[faceIndex_ % presentation.frames.length];
    var wide = presentation.layout === '256';
    var size = fontPx(frame, wide);
    root.querySelectorAll('.hz-copy').forEach(function (copy) {
      copy.innerHTML = '';
      (frame.lines || []).forEach(function (line) {
        var node = document.createElement('div');
        node.className = 'hz-line';
        node.setAttribute('data-size', String(size));
        node.style.fontSize = size + 'px';
        node.textContent = line;
        copy.appendChild(node);
        fitLine(node);
      });
    });
    applyBand(root, root._bandH || uniformBandHeight(presentation));
  }

  function show(presentation) {
    var root = rootEl();
    if (!root || !presentation || !presentation.frames || !presentation.frames.length) {
      hide();
      return;
    }
    injectStyle();
    var key = presentation.layout + '|' + presentation.kind + '|' + presentation.frames.map(function (frame) {
      return (frame.lines || []).join('/');
    }).join('|');
    var wide = presentation.layout === '256';
    var count = wide ? 2 : 4;
    if (root.getAttribute('data-key') !== key) {
      if (faceTimer_) clearInterval(faceTimer_);
      faceIndex_ = 0;
      root.innerHTML = '';
      var band = document.createElement('div');
      band.className = 'hz-band';
      root.appendChild(band);
      var i;
      for (i = 0; i < count; i++) {
        var face = document.createElement('div');
        face.className = 'hz-face' + (wide ? ' hz-wide' : '');
        var copy = document.createElement('div');
        copy.className = 'hz-copy';
        face.appendChild(copy);
        root.appendChild(face);
      }
      root.setAttribute('data-key', key);
      root._bandH = uniformBandHeight(presentation);
      faceTimer_ = setInterval(function () {
        var current = root._presentation;
        if (!current || !current.frames || !current.frames.length) return;
        faceIndex_ = (faceIndex_ + 1) % current.frames.length;
        paint(root, current);
      }, presentation.faceMs || 4000);
    }
    root._presentation = presentation;
    root.className = 'hz-on' + (presentation.ink === '#ffffff' ? '' : ' hz-ink-dark');
    root.style.background = presentation.bg;
    root.style.color = presentation.ink;
    paint(root, presentation);
  }

  function fetchJson(url) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 8000) : null;
    return fetch(url, ctrl ? { cache: 'no-store', signal: ctrl.signal } : { cache: 'no-store' }).then(function (res) {
      if (timer) clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }

  function tick() {
    var evaluate = Eval();
    if (!evaluate || !contentOn()) {
      watch_ = null;
      hide();
      return;
    }
    if (busy_) return;
    var site = evaluate.siteFrom(cfg());
    var settings = evaluate.settingsFrom(cfg());
    var layout = layoutOf();
    var previewName = previewAllowed() ? String(query().get('hazardPreview') || '') : '';
    if (previewName === 'off') {
      watch_ = null;
      hide();
      return;
    }
    if (previewName) {
      var sample = evaluate.previewAlert(previewName);
      watch_ = {
        fetchOk: true,
        presentation: sample ? evaluate.present([sample], site, settings, layout) : null
      };
      show(watch_.presentation);
      return;
    }
    var area = site.warnArea;
    busy_ = true;
    Promise.all([
      fetchJson(QUAKE_URL).then(function (json) { return { ok: true, json: json }; }).catch(function () { return { ok: false }; }),
      area
        ? fetchJson('https://www.jma.go.jp/bosai/warning/data/warning/' + area + '.json').then(function (json) { return { ok: true, json: json }; }).catch(function () { return { ok: false }; })
        : Promise.resolve({ ok: false })
    ]).then(function (pair) {
      var now = Date.now();
      watch_ = evaluate.resolveWatch(watch_, {
        quakeOk: pair[0].ok,
        warningOk: pair[1].ok,
        quakeAlerts: pair[0].ok ? evaluate.parseQuakes(pair[0].json, site, settings, now) : [],
        waterAlerts: pair[1].ok ? evaluate.parseWarnings(pair[1].json, site, settings) : [],
        site: site,
        settings: settings,
        layout: layout
      });
      show(watch_.presentation);
    }).catch(function () {
      watch_ = evaluate.resolveWatch(watch_, { quakeOk: false, warningOk: false });
      show(watch_ && watch_.presentation);
    }).then(function () { busy_ = false; });
  }

  function start() {
    if (started_) return;
    started_ = true;
    var boot = function () {
      tick();
      var ms = Number(cfg().refreshMs);
      if (!Number.isFinite(ms) || ms < 30000) ms = 60000;
      timer_ = setInterval(tick, ms);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }

  var api = { start: start, tick: tick };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeHazard = api;
})(typeof window !== 'undefined' ? window : this);
