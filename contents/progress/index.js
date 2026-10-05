/**
 * 工事進捗。
 * 画像があるときは、比率を保ったまま高さ128pxで横一列にし、1周流す。
 * 画像が無いときは、上段の工事名と下段（ロゴ256px＋場所）を途切れなく流し、
 * 中央の文章は1周し終わってから次へ替える。文言は案件設定のまま出す。
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
    var images = [];
    if (Array.isArray(progress.images)) {
      progress.images.forEach(function (row) {
        var src = row && typeof row === 'object' ? row.src : row;
        var text = String(src == null ? '' : src).trim();
        if (!text) return;
        var alt = row && typeof row === 'object' ? row.alt : '';
        images.push({ src: text, alt: String(alt == null ? '' : alt) });
      });
    }
    var logo = progress.logo || (site && site.logo && (site.logo.bannerSrc || site.logo.wideSrc)) || '';
    return {
      title: String(progress.projectName == null ? '' : progress.projectName),
      location: String(progress.location == null ? '' : progress.location),
      logo: String(logo || ''),
      messages: messages,
      images: images
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

  function setHtml(images) {
    var html = '<div class="pr-sheet-set">';
    (images || []).forEach(function (image) { html += frameHtml(image); });
    html += '</div>';
    return html;
  }

  function sheetHtml(images) {
    var set = setHtml(images);
    return '<div class="pr-sheet"><div class="pr-sheet-track" id="progress-track">' + set + set + '</div></div>';
  }

  function frameHtml(image) {
    var src = image && typeof image === 'object' ? image.src : image;
    var alt = image && typeof image === 'object' ? image.alt : '';
    return '<div class="pr-sheet-frame"><img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt || '') + '" decoding="sync"></div>';
  }

  var api = { configOf: configOf, shellHtml: shellHtml, trackHtml: trackHtml, sheetHtml: sheetHtml, frameHtml: frameHtml };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeProgress = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
