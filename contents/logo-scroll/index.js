/**
 * スクローリング・ロゴ。画像を一定方向へ流し、指定周回の完了で終了する。
 * 画像URL・周回・速度は案件設定。会社名・地域は持たない。
 */
(function (global) {
  'use strict';

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function imagesOf(cfg) {
    var list = cfg && Array.isArray(cfg.images) ? cfg.images : [];
    return list.filter(function (img) {
      return img && String(img.src || '').trim();
    }).map(function (img) {
      var w = Number(img.panelWidth);
      return {
        src: String(img.src),
        alt: img.alt != null ? String(img.alt) : '',
        panelWidth: Number.isFinite(w) && w > 0 ? w : 0,
        wing: img.wing ? String(img.wing) : '',
        motion: img.motion === 'face-switch' ? 'face-switch' : (img.motion === 'icing-quad' ? 'icing-quad' : (img.motion === 'meidory' ? 'meidory' : (img.wing ? 'meibird' : ''))),
        base: img.base ? String(img.base) : '',
        with: img.with ? String(img.with) : '',
        faces: Number(img.faces) || 0,
        faceMs: Number(img.faceMs) || 0,
        parts: Array.isArray(img.parts) ? img.parts : []
      };
    });
  }

  function safeColor(value) {
    var s = String(value || '');
    return /^#[0-9A-Fa-f]{3,8}$/.test(s) ? s : '';
  }

  function panelBox(w, bg) {
    return 'width:' + w + 'px;flex:0 0 ' + w + 'px;' + (bg ? 'background:' + bg + ';' : '');
  }

  function panelWidthOf(cfg) {
    var w = Number(cfg && cfg.panelWidth);
    return Number.isFinite(w) && w > 0 ? w : 256;
  }

  function lapsOf(cfg) {
    var n = Number(cfg && cfg.laps);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(8, Math.floor(n));
  }

  function icingQuadHtml(img, w) {
    var parts = Array.isArray(img.parts) ? img.parts : [];
    var bits = parts.map(function (part) {
      if (!part || !part.src) return '';
      var anim = part.anim === 'drive' || part.anim === 'step' ? part.anim : '';
      var x = Number(part.x); var y = Number(part.y);
      if (!Number.isFinite(x)) x = 0;
      if (!Number.isFinite(y)) y = 0;
      var imgTag = '<img class="logo-icing-part' + (anim ? ' is-' + anim : '') + '" src="' + escapeHtml(part.src) + '" alt="" style="left:' + (anim ? (x - Math.floor(x / 128) * 128) : x) + 'px;top:' + y + 'px" decoding="sync">';
      if (!anim) return imgTag;
      var face = Math.floor(x / 128) * 128;
      if (face < 0) face = 0;
      return '<div class="logo-icing-cell" style="left:' + face + 'px">' + imgTag + '</div>';
    }).join('');
    return '<div class="logo-face-panel logo-icing" style="' + panelBox(w, '') + '">' +
      '<img class="logo-icing-base" src="' + escapeHtml(img.base || img.src) + '" alt="' + escapeHtml(img.alt) + '" decoding="sync">' +
      bits + '</div>';
  }

  function faceSwitchHtml(img, w) {
    var faces = Number(img.faces);
    if (!Number.isFinite(faces) || faces < 2) faces = 4;
    faces = Math.min(8, Math.floor(faces));
    var faceW = Math.max(1, Math.round(w / faces));
    var ms = Number(img.faceMs);
    if (!Number.isFinite(ms) || ms < 200) ms = 800;
    var size = w + 'px 128px';
    var cells = '';
    for (var i = 0; i < faces; i++) {
      var pos = (-i * faceW) + 'px 0';
      cells += '<div class="logo-switch-cell">' +
        '<div class="logo-switch-layer" style="background-image:url(\'' + escapeHtml(img.src) + '\');background-size:' + size + ';background-position:' + pos + '"></div>' +
        '<div class="logo-switch-layer is-next" style="background-image:url(\'' + escapeHtml(img.with) + '\');background-size:' + size + ';background-position:' + pos + '"></div>' +
        '</div>';
    }
    return '<div class="logo-face-switch" data-face-ms="' + Math.floor(ms) + '" style="' + panelBox(w, '#000000') + '">' + cells + '</div>';
  }

  function faceHtml(img, w, bg) {
    if (img.motion === 'face-switch' && img.with) return faceSwitchHtml(img, w);
    if (img.motion === 'icing-quad' && img.base) return icingQuadHtml(img, w);
    if (!img.wing) {
      return '<div class="logo-face-panel" style="' + panelBox(w, '') + '">' +
        '<img class="logo-face-img" src="' + escapeHtml(img.src) + '" alt="' + escapeHtml(img.alt) + '" decoding="sync">' +
        '</div>';
    }
    var motion = img.motion === 'meidory' ? ' wing-meidory' : ' wing-meibird';
    return '<div class="logo-face-panel logo-char" style="' + panelBox(w, bg) + '">' +
      '<img class="logo-face-img logo-wing' + motion + '" src="' + escapeHtml(img.wing) + '" alt="" decoding="sync">' +
      '<img class="logo-face-img logo-char-body" src="' + escapeHtml(img.src) + '" alt="' + escapeHtml(img.alt) + '" decoding="sync">' +
      '</div>';
  }

  function captionLines(cfg) {
    var cap = cfg && cfg.caption;
    var lines = cap && Array.isArray(cap.lines) ? cap.lines : [];
    return lines.filter(function (line) {
      return Array.isArray(line) && line.some(function (part) {
        return part && part.text != null && part.text !== '';
      });
    });
  }

  function captionWidthAt(cap, index) {
    var listed = cap && Array.isArray(cap.widths) ? Number(cap.widths[index]) : NaN;
    var w = Number.isFinite(listed) && listed > 0 ? listed : Number(cap && cap.width);
    if (!Number.isFinite(w) || w <= 0) w = 400;
    return w;
  }

  function lineBody(line) {
    var parts = Array.isArray(line) ? line : [];
    return parts.map(function (part) {
      if (!part || part.text == null || part.text === '') return '';
      var color = safeColor(part.color);
      return '<span' + (color ? ' style="color:' + color + '"' : '') + '>' + escapeHtml(part.text) + '</span>';
    }).join('');
  }

  function rowsHtml(line) {
    var parts = Array.isArray(line) ? line : [];
    var rows = [];
    var row = [];
    function pushRow() {
      if (row.length) rows.push(row);
      row = [];
    }
    parts.forEach(function (part) {
      if (part && part.br) {
        pushRow();
        return;
      }
      if (!part || part.text == null || part.text === '') return;
      row.push(part);
    });
    pushRow();
    return rows.map(function (one) {
      return '<span class="logo-cap-line">' + lineBody(one) + '</span>';
    }).join('');
  }

  function captionPanel(body, w, bg) {
    return '<div class="logo-face-panel logo-caption" style="' + panelBox(w, bg) + '"><p>' + body + '</p></div>';
  }

  function captionHtml(cfg, bg) {
    var lines = captionLines(cfg);
    if (!lines.length) return { html: '', width: 0 };
    var w = captionWidthAt(cfg && cfg.caption, 0);
    var body = lines.map(function (line) {
      return '<span class="logo-cap-line">' + lineBody(line) + '</span>';
    }).join('');
    return {
      html: '<div class="logo-face-panel logo-caption" style="' + panelBox(w, bg) + '"><p>' + body + '</p></div>',
      width: w
    };
  }

  function buildTrackHtml(cfg) {
    var images = imagesOf(cfg);
    var fallbackW = panelWidthOf(cfg);
    var bg = cfg && cfg.background ? String(cfg.background) : '';
    if (!images.length) return { html: '', setWidth: 0, panelCount: 0, switches: [] };
    var parts = [];
    var switches = [];
    var setWidth = 0;
    var cap = cfg && cfg.caption;
    var lines = captionLines(cfg);
    var split = !!(lines.length && cap && cap.place === 'split' && images.length >= 2);
    if (split) {
      images.forEach(function (img, i) {
        var w = img.panelWidth || fallbackW;
        setWidth += w;
        parts.push(faceHtml(img, w, bg));
        if (!lines[i]) return;
        var lw = captionWidthAt(cap, i);
        setWidth += lw;
        parts.push(captionPanel(rowsHtml(lines[i]), lw, bg));
      });
      for (var extra = images.length; extra < lines.length; extra++) {
        var ew = captionWidthAt(cap, extra);
        setWidth += ew;
        parts.push(captionPanel(rowsHtml(lines[extra]), ew, bg));
      }
    }
    var caption = split ? { html: '', width: 0 } : captionHtml(cfg, bg);
    var between = !!(caption.html && cap && cap.place === 'between' && images.length >= 2);
    if (!split) images.forEach(function (img, i) {
      if (img.motion === 'face-switch' && img.with) {
        switches.push(faceHtml(img, img.panelWidth || fallbackW, bg));
        return;
      }
      if (between && i === 1) {
        parts.push(caption.html);
        setWidth += caption.width;
      }
      var w = img.panelWidth || fallbackW;
      setWidth += w;
      parts.push(faceHtml(img, w, bg));
    });
    if (caption.html && !between) {
      parts.push(caption.html);
      setWidth += caption.width;
    }
    var one = parts.join('');
    return {
      html: one ? one + one : '',
      setWidth: setWidth,
      panelCount: images.length + (caption.html ? 1 : 0),
      switches: switches
    };
  }

  var api = {
    id: 'logo-scroll',
    end: 'animation',
    imagesOf: imagesOf,
    panelWidthOf: panelWidthOf,
    lapsOf: lapsOf,
    buildTrackHtml: buildTrackHtml,
    shouldLoad: function () {
      return !global.AlertCubeContent || global.AlertCubeContent.isOn('logo-scroll');
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeLogoScroll = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
