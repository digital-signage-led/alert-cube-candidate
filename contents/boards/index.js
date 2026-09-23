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
      return p && (p.layout === 'cards' || p.layout === 'columns' || p.layout === 'safety');
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
      '<div class="kotei-safety-icon">' + TRI + '</div>' +
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

  function setWidthOf(phase) {
    var stated = Number(phase && phase.width);
    if (Number.isFinite(stated) && stated > 0) return stated;
    if (phase.layout === 'cards') return Math.max(256, (phase.cards || []).length * 256);
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
    shouldLoad: function () {
      return !global.AlertCubeContent || global.AlertCubeContent.isOn('boards');
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeBoards = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
