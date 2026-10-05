/**
 * 工事進捗。上段の工事名と下段（ロゴ256px＋場所）は途切れなく流す。
 * 中央の文章は1周し終わってから次へ替え、最後の次は最初へ戻す。
 * 文言は案件設定のまま出し、ここでは書き換えない。
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

  function configOf(site) {
    var progress = (site && site.progress) || {};
    var raw = progress.progressMessages;
    var messages = [];
    if (Array.isArray(raw)) {
      raw.forEach(function (row) {
        var text = String(row == null ? '' : row);
        if (text.trim() === '') return;
        messages.push(text);
      });
    }
    var logo = progress.logo || (site && site.logo && (site.logo.bannerSrc || site.logo.wideSrc)) || '';
    return {
      title: String(progress.projectName == null ? '' : progress.projectName),
      location: String(progress.location == null ? '' : progress.location),
      logo: String(logo || ''),
      messages: messages
    };
  }

  function repeatHtml_(unit, copies) {
    var html = '';
    var n = copies > 1 ? copies : 2;
    for (var i = 0; i < n; i++) html += unit;
    return html;
  }

  function shellHtml(data) {
    var title = '<span class="pr-title">' + escapeHtml(data.title) + '</span>';
    var logo = data.logo
      ? '<span class="pr-logo-slot"><img src="' + escapeHtml(data.logo) + '" alt="" decoding="async"></span>'
      : '';
    var place = '<span class="pr-loc-slot">' + escapeHtml(data.location) + '</span>';
    var footUnit = '<span class="pr-foot-unit">' + logo + place + '</span>';
    return '<div class="pr-shell">' +
      '<div class="pr-top"><div class="pr-edge" id="progress-top-track">' + repeatHtml_(title, 4) + '</div></div>' +
      '<div class="pr-mid"><div class="pr-track" id="progress-track"></div></div>' +
      '<div class="pr-foot"><div class="pr-edge" id="progress-foot-track">' + repeatHtml_(footUnit, 4) + '</div></div>' +
      '</div>';
  }

  function trackHtml(message) {
    var unit = '<span class="pr-msg">' + escapeHtml(message) + '</span>';
    return unit + unit;
  }

  var api = { configOf: configOf, shellHtml: shellHtml, trackHtml: trackHtml };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeProgress = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
