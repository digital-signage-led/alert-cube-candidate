/**
 * ニュースティッカー。日付と見出しを横に流し、指定周回で次へ進む。
 * 取得先・見出し・ロゴは案件設定。pageUrl があるときは公式ページの新着を読み、
 * 失敗時は JSON と直前の一覧を維持し、無ければ空を返す。
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
    if (!Number.isFinite(cap) || cap < 1) cap = 2;
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

  function decodeText(s) {
    return String(s == null ? '' : s)
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#0*39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  function formatNewsDate(raw) {
    var s = String(raw || '').trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return m[1] + '年' + m[2] + '月' + m[3] + '日';
    return s;
  }

  function cleanTitle(title) {
    return String(title || '').replace(/_NEW_$/i, '').replace(/\s+NEW$/i, '').trim();
  }

  function parseHtmlNews(html) {
    var items = [];
    var re = /data-switch=["']date["'][^>]*>([\s\S]*?)<\/div>[\s\S]{0,2000}?data-field=["']title["'][^>]*>([\s\S]*?)<\/span>/gi;
    var m;
    while ((m = re.exec(html))) {
      var title = cleanTitle(decodeText(m[2]));
      if (!title) continue;
      items.push({ date: formatNewsDate(decodeText(m[1])), title: title });
    }
    return items;
  }

  function parseMarkdownNews(md) {
    var items = [];
    var re = /(?:^|\n)\s*(\d{4}-\d{2}-\d{2})\s*\n+\s*\[([^\]]+)\]\([^)\n]+\)/g;
    var m;
    while ((m = re.exec(md))) {
      var title = cleanTitle(m[2]);
      if (!title) continue;
      items.push({ date: formatNewsDate(m[1]), title: title });
    }
    return items;
  }

  function parseJsonNews(text) {
    var data;
    try { data = JSON.parse(text); } catch (e) { return []; }
    var src = Array.isArray(data) ? data : [];
    var items = [];
    for (var i = 0; i < src.length; i++) {
      var row = src[i] || {};
      var title = row.title && typeof row.title === 'object' ? row.title.rendered : row.title;
      title = cleanTitle(decodeText(title));
      if (!title) continue;
      var date = formatNewsDate(String(row.date || '').slice(0, 10));
      items.push({ date: date, title: title });
    }
    return items;
  }

  function parseDatedLinks(md) {
    var items = [];
    var seen = {};
    function push(date, title) {
      title = cleanTitle(decodeText(title));
      if (!title || seen[title]) return;
      seen[title] = true;
      items.push({ date: date, title: title });
    }
    var linkRe = /\[([^\]]+)\]\((https?:[^)\s]+)\)/g;
    var m;
    while ((m = linkRe.exec(md))) {
      var text = m[1].replace(/\s+/g, ' ').trim();
      var end = text.match(/^(.*?)\s+(?:お知らせ|トピックス)\s+((?:20\d{2})年\d{2}月\d{2}日)$/);
      if (end) { push(end[2], end[1]); continue; }
      var start = text.match(/^(20\d{2})[./](\d{2})[./](\d{2})\s+\S+\s+(.+)$/);
      if (start) push(start[1] + '年' + start[2] + '月' + start[3] + '日', start[4]);
    }
    var outsideRe = /(20\d{2})[./](\d{2})[./](\d{2})(?:\[[^\]]{0,24}\]\([^)]+\))?\[([^\]]+)\]\(/g;
    while ((m = outsideRe.exec(md))) {
      push(m[1] + '年' + m[2] + '月' + m[3] + '日', m[4]);
    }
    return items;
  }

  function parseHtmlList(html) {
    var items = [];
    var re = /<time[^>]*>([^<]+)<\/time>[\s\S]{0,800}?news__item_content[^>]*>([\s\S]*?)<\/span>/gi;
    var m;
    while ((m = re.exec(html))) {
      var rawDate = decodeText(m[1]);
      var dotted = rawDate.match(/^(20\d{2})[./](\d{2})[./](\d{2})$/);
      var date = dotted ? (dotted[1] + '年' + dotted[2] + '月' + dotted[3] + '日') : formatNewsDate(rawDate);
      var title = cleanTitle(decodeText(m[2]));
      if (!title) continue;
      items.push({ date: date, title: title });
    }
    return items;
  }

  function parsePage(text, maxItems) {
    var raw = String(text || '').trim();
    var items = [];
    if (raw.charAt(0) === '[' || raw.charAt(0) === '{') items = parseJsonNews(raw);
    if (!items.length && /data-field=["']title["']/i.test(raw)) items = parseHtmlNews(raw);
    if (!items.length && /news__item_content/i.test(raw)) items = parseHtmlList(raw);
    if (!items.length) items = parseMarkdownNews(raw);
    if (!items.length) items = parseDatedLinks(raw);
    return normalizeItems({ items: items }, maxItems);
  }

  function pageFetchUrls(pageUrl) {
    var page = String(pageUrl || '').trim();
    if (!page) return [];
    var list = [page];
    if (/^https?:\/\//i.test(page)) list.push('https://r.jina.ai/' + page);
    return list;
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
        (logo ? '<span class="news-badge-logo-plate"><img class="news-badge-logo" src="' + escapeHtml(logo) + '" alt="" decoding="sync"></span>' : '') +
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
    parsePage: parsePage,
    pageFetchUrls: pageFetchUrls,
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
