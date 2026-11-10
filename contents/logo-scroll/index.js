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
        motion: img.motion === 'meidory' ? 'meidory' : (img.wing ? 'meibird' : '')
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

  function faceHtml(img, w, bg) {
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

  function captionHtml(cfg, bg) {
    var cap = cfg && cfg.caption;
    var lines = cap && Array.isArray(cap.lines) ? cap.lines : [];
    if (!lines.length) return { html: '', width: 0 };
    var w = Number(cap.width);
    if (!Number.isFinite(w) || w <= 0) w = 400;
    var body = lines.map(function (line) {
      var parts = Array.isArray(line) ? line : [];
      var spans = parts.map(function (part) {
        if (!part || part.text == null || part.text === '') return '';
        var color = safeColor(part.color);
        return '<span' + (color ? ' style="color:' + color + '"' : '') + '>' + escapeHtml(part.text) + '</span>';
      }).join('');
      return '<span class="logo-cap-line">' + spans + '</span>';
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
    if (!images.length) return { html: '', setWidth: 0, panelCount: 0 };
    var parts = [];
    var setWidth = 0;
    images.forEach(function (img) {
      var w = img.panelWidth || fallbackW;
      setWidth += w;
      parts.push(faceHtml(img, w, bg));
    });
    var caption = captionHtml(cfg, bg);
    if (caption.html) {
      parts.push(caption.html);
      setWidth += caption.width;
    }
    var one = parts.join('');
    return { html: one + one, setWidth: setWidth, panelCount: images.length + (caption.html ? 1 : 0) };
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
