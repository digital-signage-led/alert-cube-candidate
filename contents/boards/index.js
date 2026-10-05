/**
 * 告知ボード。カードまたは列の面を横に流し、面ごとに1周完了で次の面へ進む。
 * 文言・色・ロゴは案件設定。会社名は持たない。
 */
(function (global) {
  'use strict';

  var TRI = '<svg class="kotei-triangle" viewBox="0 0 100 90" aria-hidden="true">' +
    '<polygon points="50,6 96,86 4,86" fill="#E31B23"/>' +
    '<text x="50" y="72" text-anchor="middle" fill="#fff" font-size="46" font-weight="800" font-family="Noto Sans JP,sans-serif">!</text>' +
    '</svg>';

  var PICT = {
    fall: '<svg class="kotei-pict" viewBox="0 0 64 64" aria-hidden="true">' +
      '<rect width="64" height="64" fill="#FFD400"/>' +
      '<path fill="#0A4EA3" d="M3 40h28v5H3zM7 45h5v14H7zM23 45h5v14h-5z"/>' +
      '<path fill="none" stroke="#0A4EA3" stroke-width="3" stroke-linecap="square" d="M9 47l16 10M25 47L9 57"/>' +
      '<g fill="#0A4EA3" transform="rotate(-38 42 30)">' +
      '<circle cx="42" cy="14" r="6"/>' +
      '<path d="M34 15h16v3.2H34z"/>' +
      '<rect x="38" y="20" width="8" height="13" rx="2"/>' +
      '<rect x="28" y="21" width="12" height="4" rx="1"/>' +
      '<rect x="46" y="22" width="11" height="4" rx="1"/>' +
      '<rect x="38" y="31" width="4.5" height="12" rx="1"/>' +
      '<rect x="44" y="31" width="4.5" height="10" rx="1"/>' +
      '</g>' +
      '<path fill="none" stroke="#E10600" stroke-width="2.4" stroke-linecap="round" d="M50 7c4 2 5 6 2 10"/>' +
      '<path fill="none" stroke="#E10600" stroke-width="2.4" stroke-linecap="round" d="M55 4c5 3 6 8 2 13"/>' +
      '</svg>',
    harness: '<svg class="kotei-pict" viewBox="0 0 64 64" aria-hidden="true">' +
      '<rect width="64" height="64" fill="#FFD400"/>' +
      '<circle cx="32" cy="5" r="2.6" fill="#0A4EA3"/>' +
      '<path fill="none" stroke="#0A4EA3" stroke-width="3" d="M32 8v8"/>' +
      '<circle cx="32" cy="22" r="6" fill="#0A4EA3"/>' +
      '<path fill="#0A4EA3" d="M23 30h18v14H23zM21 44h8v15h-8zM35 44h8v15h-8z"/>' +
      '<path fill="none" stroke="#FFD400" stroke-width="2.4" stroke-linecap="round" d="M32 16v16M25 36h14M28 34l4 8 4-8"/>' +
      '</svg>',
    opening: '<svg class="kotei-pict" viewBox="0 0 64 64" aria-hidden="true">' +
      '<rect width="64" height="64" fill="#FFD400"/>' +
      '<rect x="4" y="30" width="56" height="28" fill="#0A4EA3"/>' +
      '<rect x="22" y="38" width="20" height="14" fill="#FFD400"/>' +
      '<polygon points="12,8 46,4 52,18 18,22" fill="#0A4EA3"/>' +
      '</svg>',
    rail: '<svg class="kotei-pict" viewBox="0 0 64 64" aria-hidden="true">' +
      '<rect width="64" height="64" fill="#FFD400"/>' +
      '<path fill="#0A4EA3" d="M6 10h6v46H6zM52 10h6v46h-6zM6 10h52v6H6zM6 30h52v5H6z"/>' +
      '<circle cx="32" cy="24" r="5" fill="#0A4EA3"/>' +
      '<path fill="#0A4EA3" d="M27 30h10v16H27z"/>' +
      '</svg>'
  };

  function iconHtml(name) {
    return PICT[name] || TRI;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function phasesOf(cfg) {
    var list = cfg && Array.isArray(cfg.phases) ? cfg.phases : [];
    return list.filter(function (p) {
      return p && (p.layout === 'cards' || p.layout === 'columns' || p.layout === 'safety' || p.layout === 'posters');
    });
  }

  function lapsOf(cfg) {
    var n = Number(cfg && cfg.laps);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(4, Math.floor(n));
  }

  function speedOf(cfg) {
    var n = Number(cfg && cfg.speed);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  function lineHtml(text, cls) {
    if (text == null || text === '') return '';
    return '<div class="' + cls + '">' + escapeHtml(text) + '</div>';
  }

  function cardHtml(card) {
    var theme = card && card.theme === 'light' ? 'light' : 'dark';
    var c = card || {};
    return '<div class="kotei-card kotei-card-' + theme + '">' +
      '<div class="kotei-term-period"><span class="kotei-reiwa">' + escapeHtml(c.era || '') +
      '</span><span class="kotei-term-hl">' + escapeHtml(c.highlight || '') + '</span></div>' +
      lineHtml(c.title, 'kotei-term-title') +
      lineHtml(c.sub, 'kotei-term-sub') +
      '</div>';
  }

  function logoColHtml(col, logoSrc) {
    var src = (col && col.src) || logoSrc || '';
    return '<div class="kotei-col kotei-col-logo">' +
      (src ? '<img class="kotei-logo-img" src="' + escapeHtml(src) + '" alt="" decoding="sync">' : '') +
      (col && col.name ? '<div class="kotei-logo-name">' + escapeHtml(col.name) + '</div>' : '') +
      (col && col.en ? '<div class="kotei-logo-en">' + escapeHtml(col.en) + '</div>' : '') +
      '</div>';
  }

  function columnHtml(col, logoSrc) {
    var kind = col && col.kind;
    if (kind === 'logo') return logoColHtml(col, logoSrc);
    if (kind === 'alert') {
      var lines = Array.isArray(col.lines) ? col.lines : [];
      var label = lines.length > 1
        ? '<div class="kotei-warn-label-2">' + lines.map(function (t) {
          return '<span>' + escapeHtml(t) + '</span>';
        }).join('') + '</div>'
        : '<div class="kotei-warn-label">' + escapeHtml(lines[0] || '') + '</div>';
      return '<div class="kotei-col">' + label + TRI + '</div>';
    }
    if (kind === 'date') {
      return '<div class="kotei-col">' +
        lineHtml(col.era, 'kotei-date-reiwa') +
        lineHtml(col.md, 'kotei-date-md') +
        lineHtml(col.weekday, 'kotei-date-youbi') +
        '</div>';
    }
    if (kind === 'work') {
      var works = Array.isArray(col.lines) ? col.lines : [];
      var longCol = works.some(function (t) { return String(t).length > 4; });
      return '<div class="kotei-col">' +
        (col.note ? '<div class="kotei-work-small">' + escapeHtml(col.note) + '</div>' : '') +
        works.map(function (t) {
          var long = longCol ? ' kotei-work-line-long' : '';
          return '<div class="kotei-work-line' + long + '">' + escapeHtml(t) + '</div>';
        }).join('') +
        '</div>';
    }
    if (kind === 'message') {
      var msgs = Array.isArray(col.lines) ? col.lines : [];
      var wide = col.wide ? ' kotei-col-wide' : '';
      return '<div class="kotei-col' + wide + '">' +
        msgs.map(function (t) { return '<div class="kotei-safety-line">' + escapeHtml(t) + '</div>'; }).join('') +
        '</div>';
    }
    return '';
  }

  function safetyLineClass(card) {
    var size = card && card.lineSize;
    if (size === 'sm') return 'kotei-safety-line kotei-safety-line-sm';
    if (size === 'one') return 'kotei-safety-line kotei-safety-line-one';
    if (size === 'head') return 'kotei-safety-line kotei-safety-line-head';
    if (size === 'term') return 'kotei-safety-line kotei-safety-line-term';
    return 'kotei-safety-line';
  }

  function safetyCardHtml(card) {
    var c = card || {};
    var light = c.theme === 'light' ? ' kotei-col-light' : '';
    var date = c.date ? '<div class="kotei-safety-date">' + escapeHtml(c.date) + '</div>' : '';
    var line = c.line ? '<div class="' + safetyLineClass(c) + '">' + escapeHtml(c.line) + '</div>' : '';
    return '<div class="kotei-col kotei-col-safety' + light + '"><div class="kotei-safety-panel">' +
      '<div class="kotei-safety-badge">' + escapeHtml(c.badge || '') + '</div>' +
      '<div class="kotei-safety-hero">' +
      '<div class="kotei-safety-icon">' + iconHtml(c.icon) + '</div>' +
      '<div class="kotei-safety-hero-text">' + date + line + '</div>' +
      '</div></div></div>';
  }

  function safetySetHtml(phase, logoSrc) {
    var copies = Number(phase && phase.copies);
    if (!Number.isFinite(copies) || copies < 1) copies = 2;
    var html = '';
    for (var i = 0; i < copies; i++) html += safetyCardHtml(phase.card);
    if (phase && phase.logo) html += logoColHtml(phase.logo, logoSrc);
    return html;
  }

  function posterSources(phase) {
    var images = phase && Array.isArray(phase.images) ? phase.images : [];
    return images.filter(function (img) { return img && img.src; });
  }

  function postersHtml(phase) {
    var html = '';
    posterSources(phase).forEach(function (img) {
      html += '<div class="kotei-poster"><img src="' + escapeHtml(img.src) + '" alt="' + escapeHtml(img.alt || '') + '" decoding="sync"></div>';
    });
    return html;
  }

  function posterFaceCount(faces) {
    var n = Number(faces);
    if (!Number.isFinite(n) || n < 1) n = 4;
    return Math.min(8, Math.floor(n));
  }

  function posterRowHtml(img, faces, setClass) {
    var cell = '<div class="kotei-poster"><img src="' + escapeHtml(img.src) + '" alt="' + escapeHtml(img.alt || '') + '" decoding="sync"></div>';
    var html = '';
    for (var f = 0; f < faces; f++) html += cell;
    return '<div class="' + setClass + '">' + html + '</div>';
  }

  function posterSlideHtml(phase) {
    var images = posterSources(phase);
    if (!images.length) return { html: '', setWidth: 0 };
    var row = '<div class="kotei-set">' + images.map(function (img) {
      return '<div class="kotei-poster"><img src="' + escapeHtml(img.src) + '" alt="' + escapeHtml(img.alt || '') + '" decoding="sync"></div>';
    }).join('') + '</div>';
    return { html: row + row, setWidth: images.length * 128 };
  }

  function posterFrameHtml(phase, index, faces) {
    var images = posterSources(phase);
    var i = Number(index) || 0;
    if (!images.length || i < 0 || i >= images.length) return '';
    return posterRowHtml(images[i], posterFaceCount(faces), 'kotei-set');
  }

  function posterSwapHtml(phase, nextIndex, prevIndex, faces) {
    var images = posterSources(phase);
    var next = Number(nextIndex) || 0;
    if (!images.length || next < 0 || next >= images.length) return '';
    var n = posterFaceCount(faces);
    var prev = Number(prevIndex);
    var hasPrev = Number.isFinite(prev) && prev >= 0 && prev < images.length && prev !== next;
    var from = hasPrev ? posterRowHtml(images[prev], n, 'kotei-set') : (function () {
      var blank = '<div class="kotei-set kotei-blank">';
      for (var b = 0; b < n; b++) blank += '<div class="kotei-poster"></div>';
      return blank + '</div>';
    }());
    return '<div class="kotei-stage"><div class="kotei-reel">' + from +
      '<div class="kotei-seam" aria-hidden="true"></div>' +
      posterRowHtml(images[next], n, 'kotei-set') + '</div></div>';
  }

  function setWidthOf(phase) {
    var stated = Number(phase && phase.width);
    if (Number.isFinite(stated) && stated > 0) return stated;
    if (phase.layout === 'cards') return Math.max(256, (phase.cards || []).length * 256);
    if (phase.layout === 'posters') {
      var count = (phase.images || []).filter(function (img) { return img && img.src; }).length;
      return Math.max(128, count * 128);
    }
    if (phase.layout === 'safety') {
      var copies = Number(phase.copies);
      if (!Number.isFinite(copies) || copies < 1) copies = 2;
      return copies * 256 + (phase.logo ? 128 : 0);
    }
    return 512;
  }

  function buildPhaseHtml(phase, logoSrc) {
    if (!phase) return { html: '', setWidth: 0 };
    var inner = '';
    if (phase.layout === 'cards') {
      (phase.cards || []).forEach(function (card) { inner += cardHtml(card); });
    } else if (phase.layout === 'safety') {
      inner = safetySetHtml(phase, logoSrc);
    } else if (phase.layout === 'posters') {
      inner = postersHtml(phase);
    } else if (phase.layout === 'columns') {
      var cols = '';
      (phase.columns || []).forEach(function (col) { cols += columnHtml(col, logoSrc); });
      inner = cols;
    }
    if (!inner) return { html: '', setWidth: 0 };
    var set = '<div class="kotei-set">' + inner + '</div>';
    return { html: set + set, setWidth: setWidthOf(phase) };
  }

  var api = {
    id: 'boards',
    end: 'animation',
    phasesOf: phasesOf,
    lapsOf: lapsOf,
    speedOf: speedOf,
    buildPhaseHtml: buildPhaseHtml,
    posterFrameHtml: posterFrameHtml,
    posterSlideHtml: posterSlideHtml,
    posterSwapHtml: posterSwapHtml,
    shouldLoad: function () {
      return !global.AlertCubeContent || global.AlertCubeContent.isOn('boards');
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeBoards = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
