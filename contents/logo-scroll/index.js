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
        panelWidth: Number.isFinite(w) && w > 0 ? w : 0
      };
    });
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

  function buildTrackHtml(cfg) {
    var images = imagesOf(cfg);
    var fallbackW = panelWidthOf(cfg);
    if (!images.length) return { html: '', setWidth: 0, panelCount: 0 };
    var parts = [];
    var setWidth = 0;
    images.forEach(function (img) {
      var w = img.panelWidth || fallbackW;
      setWidth += w;
      parts.push(
        '<div class="logo-face-panel" style="width:' + w + 'px;flex:0 0 ' + w + 'px">' +
        '<img class="logo-face-img" src="' + escapeHtml(img.src) + '" alt="' + escapeHtml(img.alt) + '" decoding="sync">' +
        '</div>'
      );
    });
    var one = parts.join('');
    return { html: one + one, setWidth: setWidth, panelCount: images.length };
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
