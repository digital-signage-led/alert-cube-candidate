/**
 * ニュースティッカー。日付と見出しを横に流し、指定周回で次へ進む。
 * 取得先・見出し・ロゴは案件設定。失敗時は直前の一覧を維持し、無ければ空を返す。
 */
(function (global) {
  'use strict';

  var cache_ = {};

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function cacheKey(cfg) {
    return String((cfg && cfg.cacheKey) || 'news');
  }

  function normalizeItems(raw, maxItems) {
    var list = [];
    var src = raw && Array.isArray(raw.items) ? raw.items : (Array.isArray(raw) ? raw : []);
    var cap = Number(maxItems);
    if (!Number.isFinite(cap) || cap < 1) cap = 3;
    for (var i = 0; i < src.length && list.length < cap; i++) {
      var row = src[i] || {};
      var title = String(row.title || '').trim();
      if (!title) continue;
      list.push({ title: title, date: String(row.date || '').trim() });
    }
    return list;
  }

  function remember(cfg, items) {
    if (!items || !items.length) return itemsOf(cfg);
    cache_[cacheKey(cfg)] = items.slice();
    return cache_[cacheKey(cfg)];
  }

  function itemsOf(cfg) {
    var hit = cache_[cacheKey(cfg)];
    return hit ? hit.slice() : [];
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

  function buildTrackHtml(items, opts) {
    var rows = Array.isArray(items) ? items : [];
    if (!rows.length) return { html: '', setWidth: 0 };
    var logo = opts && opts.logoSrc ? String(opts.logoSrc) : '';
    var badge = opts && opts.badge != null ? String(opts.badge) : '';
    function badgeHtml() {
      if (!logo && !badge) return '';
      return '<div class="news-badge">' +
        (logo ? '<img class="news-badge-logo" src="' + escapeHtml(logo) + '" alt="" decoding="sync">' : '') +
        (badge ? '<span class="news-badge-label">' + escapeHtml(badge) + '</span>' : '') +
        '</div>';
    }
    function itemHtml(it) {
      return '<div class="news-item">' +
        (it.date ? '<span class="news-date">' + escapeHtml(it.date) + '</span>' : '') +
        '<span class="news-title">' + escapeHtml(it.title) + '</span>' +
        '</div>';
    }
    var inner = '';
    for (var i = 0; i < rows.length; i++) {
      inner += badgeHtml() + itemHtml(rows[i]);
      if (i < rows.length - 1) inner += '<span class="news-sep" aria-hidden="true">●</span>';
    }
    inner += '<span class="news-sep" aria-hidden="true">●</span>';
    var unit = '<div class="news-unit">' + inner + '</div>';
    return { html: unit + unit, setWidth: 0 };
  }

  var api = {
    id: 'news',
    end: 'animation',
    escapeHtml: escapeHtml,
    normalizeItems: normalizeItems,
    remember: remember,
    itemsOf: itemsOf,
    lapsOf: lapsOf,
    speedOf: speedOf,
    buildTrackHtml: buildTrackHtml,
    shouldLoad: function () {
      return !global.AlertCubeContent || global.AlertCubeContent.isOn('news');
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeNews = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
