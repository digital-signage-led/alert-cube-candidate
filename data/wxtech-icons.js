/**
 * WxTech の天気コード用アイコン。仕様書のサンプル画像は本番利用不可のため、自作する。
 * 100晴れ 200くもり 300雨 400雪 430みぞれ 600うすぐもり。それ以外は空文字。
 */
(function (global) {
  'use strict';

  function svg(inner) {
    return '<svg class="weather-svg weather-icon-img" viewBox="0 0 64 64" aria-hidden="true">' + inner + '</svg>';
  }
  function sun() {
    return '<circle cx="32" cy="32" r="9" fill="#f0b429"/>' +
      '<g fill="none" stroke="#f0b429" stroke-width="3" stroke-linecap="round">' +
      '<path d="M32 10v7M32 47v7M10 32h7M47 32h7M16 16l5 5M43 43l5 5M48 16l-5 5M21 43l-5 5"/>' +
      '</g>';
  }
  function cloud(fill) {
    return '<g fill="' + fill + '" stroke="#5d6b7a" stroke-width="2">' +
      '<circle cx="26" cy="36" r="10"/><circle cx="38" cy="34" r="12"/><circle cx="32" cy="28" r="9"/>' +
      '<rect x="18" y="34" width="28" height="12" rx="6"/>' +
      '</g>';
  }
  var MARK = {
    100: svg(sun()),
    200: svg(cloud('#d5dbe3')),
    300: svg(cloud('#d5dbe3') +
      '<g fill="#2f86d6"><circle cx="24" cy="52" r="2.2"/><circle cx="32" cy="54" r="2.2"/><circle cx="40" cy="52" r="2.2"/></g>'),
    400: svg(cloud('#e7edf4') +
      '<g fill="none" stroke="#f7fbff" stroke-width="2" stroke-linecap="round">' +
      '<path d="M22 50l4 4M26 50l-4 4M30 49l4 4M34 49l-4 4M40 50l4 4M44 50l-4 4"/>' +
      '</g>'),
    430: svg(cloud('#d5dbe3') +
      '<circle cx="24" cy="53" r="2.2" fill="#2f86d6"/>' +
      '<path d="M38 49l3 3M41 49l-3 3" fill="none" stroke="#f7fbff" stroke-width="2" stroke-linecap="round"/>'),
    600: svg(sun() + cloud('#eef2f6'))
  };

  function markup(code) {
    return MARK[code] || '';
  }

  var api = { markup: markup };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeWxTechIcons = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
