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

  function studioString_(node) {
    if (!node || typeof node !== 'object' || node.stringValue == null) return '';
    return String(node.stringValue);
  }

  function studioDate_(iso) {
    var s = String(iso || '');
    var ms = Date.parse(s);
    if (!Number.isFinite(ms)) return formatNewsDate(s.slice(0, 10));
    var parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(ms));
    return formatNewsDate(parts);
  }

  function parseStudioCms(text) {
    var data;
    try { data = JSON.parse(text); } catch (e) { return []; }
    if (!Array.isArray(data)) return [];
    var items = [];
    for (var i = 0; i < data.length; i++) {
      var fields = data[i] && data[i].document && data[i].document.fields;
      var body = fields && fields.default && fields.default.mapValue && fields.default.mapValue.fields;
      if (!body) continue;
      var title = cleanTitle(studioString_(body.title));
      if (!title) continue;
      var meta = fields._meta && fields._meta.mapValue && fields._meta.mapValue.fields;
      var published = meta && meta.publishedAt && meta.publishedAt.timestampValue;
      items.push({ date: studioDate_(published), title: title });
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
      if (start) { push(start[1] + '年' + start[2] + '月' + start[3] + '日', start[4]); continue; }
      var compact = text.match(/^(20\d{2})[./](\d{1,2})[./](\d{1,2})\s*(.+)$/);
      if (compact) {
        var month = ('0' + compact[2]).slice(-2);
        var day = ('0' + compact[3]).slice(-2);
        var title = compact[4].replace(/^(?:お知らせ|トピックス)\s+/, '');
        push(compact[1] + '年' + month + '月' + day + '日', title);
      }
    }
    var outsideRe = /(20\d{2})[./](\d{2})[./](\d{2})(?:\[[^\]]{0,24}\]\([^)]+\))?\[([^\]]+)\]\(/g;
    while ((m = outsideRe.exec(md))) {
      push(m[1] + '年' + m[2] + '月' + m[3] + '日', m[4]);
    }
    return items;
  }

  function parseDlNews(html) {
    var items = [];
    var seen = {};
    var re = /<dt>\s*(20\d{2})[./](\d{1,2})[./](\d{1,2})\s*<\/dt>[\s\S]{0,800}?class=["']title["'][^>]*>([\s\S]*?)<\/dd>/gi;
    var m;
    while ((m = re.exec(html))) {
      var title = cleanTitle(decodeText(m[4]));
      if (!title || seen[title]) continue;
      seen[title] = true;
      var month = ('0' + m[2]).slice(-2);
      var day = ('0' + m[3]).slice(-2);
      items.push({ date: m[1] + '年' + month + '月' + day + '日', title: title });
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

  function parseNewslist(html) {
    var items = [];
    var seen = {};
    var re = /c-newslist__date[^>]*>\s*(20\d{2})[./](\d{1,2})[./](\d{1,2})\s*<[\s\S]{0,800}?<dd>([\s\S]*?)<\/dd>/gi;
    var m;
    while ((m = re.exec(html))) {
      var title = cleanTitle(decodeText(m[4]));
      if (!title || seen[title]) continue;
      seen[title] = true;
      var month = ('0' + m[2]).slice(-2);
      var day = ('0' + m[3]).slice(-2);
      items.push({ date: m[1] + '年' + month + '月' + day + '日', title: title });
    }
    return items;
  }

  /** 戸田建設公式ニュース。PDFリンクは除く */
  function parseCmnNews(html) {
    var items = [];
    var seen = {};
    var re = /cmn-news__date">([\s\S]*?)<\/span>[\s\S]{0,1200}?cmn-news__title">([\s\S]*?)<\/h3>/gi;
    var m;
    while ((m = re.exec(html))) {
      var before = html.slice(Math.max(0, m.index - 800), m.index);
      var hrefs = before.match(/href="([^"]+)"/gi);
      var href = '';
      if (hrefs && hrefs.length) {
        var hm = hrefs[hrefs.length - 1].match(/href="([^"]+)"/i);
        href = hm ? hm[1] : '';
      }
      if (/\.pdf(\?|$)/i.test(href)) continue;
      var rawDate = decodeText(m[1]).replace(/\s+/g, '');
      var dm = rawDate.match(/^(20\d{2})[./](\d{1,2})[./](\d{1,2})$/);
      if (!dm) continue;
      var titleHtml = String(m[2] || '').replace(/<su[bp][^>]*>[\s\S]*?<\/su[bp]>/gi, '');
      var title = cleanTitle(decodeText(titleHtml)).replace(/&reg;|®/gi, '').replace(/\s+/g, ' ').trim();
      if (!title || /[（(]PDF/i.test(title) || seen[title]) continue;
      seen[title] = true;
      items.push({
        date: dm[1] + '年' + ('0' + dm[2]).slice(-2) + '月' + ('0' + dm[3]).slice(-2) + '日',
        title: title
      });
    }
    return items;
  }

  /** デジタルサイネージ公式の <dt><span class="date"> 形式 */
  function parseAccordionNews(html) {
    var items = [];
    var seen = {};
    var re = /<span class=["']date["']>\s*(20\d{2})年(\d{1,2})月(\d{1,2})日\s*<\/span>([\s\S]*?)<\/dt>/gi;
    var m;
    while ((m = re.exec(html))) {
      var title = cleanTitle(decodeText(m[4]));
      if (!title || seen[title]) continue;
      seen[title] = true;
      var month = ('0' + m[2]).slice(-2);
      var day = ('0' + m[3]).slice(-2);
      items.push({ date: m[1] + '年' + month + '月' + day + '日', title: title });
    }
    return items;
  }

  /** 日付の直後に見出しが続く本文。HTMLでもテキストでも読む */
  function parseJapaneseDateLead(text) {
    var src = String(text || '');
    var re = /(20\d{2})年(\d{1,2})月(\d{1,2})日/g;
    var marks = [];
    var m;
    while ((m = re.exec(src))) {
      marks.push({ index: m.index, end: re.lastIndex, y: m[1], mo: m[2], d: m[3] });
    }
    var items = [];
    var seen = {};
    for (var i = 0; i < marks.length; i++) {
      var stop = i + 1 < marks.length ? marks[i + 1].index : marks[i].end + 90;
      var title = cleanTitle(decodeText(src.slice(marks[i].end, stop))).replace(/^[\s:：|・]+/, '');
      title = title.split(/\s{2,}/)[0].trim();
      var sentence = title.indexOf('。');
      if (sentence >= 8) title = title.slice(0, sentence + 1);
      if (!title || seen[title]) continue;
      seen[title] = true;
      var month = ('0' + marks[i].mo).slice(-2);
      var day = ('0' + marks[i].d).slice(-2);
      items.push({ date: marks[i].y + '年' + month + '月' + day + '日', title: title });
    }
    return items;
  }

  var RFC822_MONTH = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  function rfc822NewsDate(raw) {
    var m = String(raw || '').match(/(\d{1,2})\s+([A-Za-z]{3})\s+(20\d{2})/);
    if (!m) return '';
    var month = RFC822_MONTH[m[2].toLowerCase()];
    if (!month) return '';
    return m[3] + '年' + month + '月' + ('0' + m[1]).slice(-2) + '日';
  }

  function unwrapCdata(s) {
    return String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  }

  /** NHKニュースRSS。見出しと発表日だけを残す。 */
  function parseRssItems(xml) {
    if (!/<rss[\s>]/i.test(xml) || !/<item[\s>]/i.test(xml)) return [];
    var items = [];
    var seen = {};
    var re = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
    var m;
    while ((m = re.exec(xml))) {
      var block = m[1];
      var title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      var pub = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
      if (!title || !pub) continue;
      var name = cleanTitle(decodeText(unwrapCdata(title[1])));
      var date = rfc822NewsDate(unwrapCdata(pub[1]));
      if (!name || !date || seen[name]) continue;
      seen[name] = true;
      items.push({ date: date, title: name, ms: Date.parse(unwrapCdata(pub[1])) || 0 });
    }
    return newestNews_(items);
  }

  /** ブラウザからRSSを直接読めないとき、中継が返す見出しとRFC822日付。 */
  function parseJinaRss(md) {
    if (!/### \[[^\]]+\]\(https?:/i.test(md)) return [];
    if (!/\d{1,2}\s+[A-Za-z]{3}\s+20\d{2}\s+\d{2}:\d{2}:\d{2}/.test(md)) return [];
    var items = [];
    var seen = {};
    var re = /### \[([^\]]+)\]\(https?:[^)]+\)[\s\S]*?(\d{1,2}\s+[A-Za-z]{3}\s+20\d{2}\s+\d{2}:\d{2}:\d{2})/g;
    var m;
    while ((m = re.exec(md))) {
      var title = cleanTitle(decodeText(m[1]));
      var date = rfc822NewsDate(m[2]);
      if (!title || !date || seen[title]) continue;
      seen[title] = true;
      items.push({ date: date, title: title, ms: Date.parse(m[2] + ' +0900') || 0 });
    }
    return newestNews_(items);
  }

  function newestNews_(items) {
    items.sort(function (a, b) { return (b.ms || 0) - (a.ms || 0); });
    var rows = [];
    for (var i = 0; i < items.length; i++) rows.push({ date: items[i].date, title: items[i].title });
    return rows;
  }

  function parsePage(text, maxItems) {
    var raw = String(text || '').trim();
    var items = [];
    if (/<rss[\s>]/i.test(raw)) items = parseRssItems(raw);
    if (!items.length && (raw.charAt(0) === '[' || raw.charAt(0) === '{')) items = parseJsonNews(raw);
    if (!items.length && raw.charAt(0) === '[') items = parseStudioCms(raw);
    if (!items.length && /data-field=["']title["']/i.test(raw)) items = parseHtmlNews(raw);
    if (!items.length && /news__item_content/i.test(raw)) items = parseHtmlList(raw);
    if (!items.length && /<dt>\s*20\d{2}[./]\d{1,2}[./]\d{1,2}/i.test(raw) && /class=["']title["']/i.test(raw)) items = parseDlNews(raw);
    if (!items.length && /c-newslist__date/i.test(raw)) items = parseNewslist(raw);
    if (!items.length && /cmn-news__article/i.test(raw)) items = parseCmnNews(raw);
    if (!items.length && /<span class=["']date["']/i.test(raw)) items = parseAccordionNews(raw);
    if (!items.length) items = parseMarkdownNews(raw);
    if (!items.length) items = parseDatedLinks(raw);
    if (!items.length) items = parseJapaneseDateLead(raw);
    if (!items.length) items = parseJinaRss(raw);
    return normalizeItems({ items: items }, maxItems);
  }

  function pageFetchUrls(pageUrl) {
    var page = String(pageUrl || '').trim();
    if (!page) return [];
    var list = [page];
    if (/^https?:\/\//i.test(page)) list.push('https://r.jina.ai/' + page);
    return list;
  }

  /** 公式ページの日付が30日より前なら、ニュースは出さない。 */
  var NEWS_FRESH_MS = 30 * 24 * 60 * 60 * 1000;

  function newsDateMs(date) {
    var s = String(date || '').trim();
    var m = s.match(/^(20\d{2})年(\d{1,2})月(\d{1,2})日/);
    if (!m) m = s.match(/^(20\d{2})-(\d{2})-(\d{2})/);
    if (!m) return null;
    var month = ('0' + m[2]).slice(-2);
    var day = ('0' + m[3]).slice(-2);
    var ms = Date.parse(m[1] + '-' + month + '-' + day + 'T12:00:00+09:00');
    return Number.isFinite(ms) ? ms : null;
  }

  function recentItems(items, nowMs, freshDays) {
    var now = Number.isFinite(nowMs) ? nowMs : Date.now();
    var limit = NEWS_FRESH_MS;
    if (freshDays === 0) limit = null;
    else if (freshDays != null && freshDays !== '') {
      var days = Number(freshDays);
      if (Number.isFinite(days) && days > 0) limit = days * 24 * 60 * 60 * 1000;
    }
    var rows = Array.isArray(items) ? items : [];
    var fresh = [];
    var i;
    for (i = 0; i < rows.length; i++) {
      var ms = newsDateMs(rows[i] && rows[i].date);
      if (ms == null) continue;
      if (ms - now > 36 * 60 * 60 * 1000) continue;
      if (limit != null && now - ms > limit) continue;
      fresh.push(rows[i]);
    }
    return fresh;
  }

  var TOPIC_LABEL = {
    domestic: '国内',
    overseas: '海外',
    construction: '建設',
    '国内': '国内',
    '海外': '海外',
    '建設': '建設'
  };
  var TOPIC_LICENSE = { official: true, permitted: true, 'public-domain': true, 'cc-by-sa-4.0': true };

  function topicPublishedMs(row) {
    var raw = row && (row.publishedAt || row.date) || '';
    var ms = Date.parse(String(raw));
    if (Number.isFinite(ms)) return ms;
    return newsDateMs(raw);
  }

  function topicFreshLimit(cfg) {
    var hours = cfg && cfg.freshHours != null ? Number(cfg.freshHours) : 48;
    if (hours === 0) return null;
    if (Number.isFinite(hours) && hours > 0) return hours * 60 * 60 * 1000;
    return 48 * 60 * 60 * 1000;
  }

  function interleaveTopics(rows) {
    var order = ['国内', '海外', '建設'];
    var buckets = { '国内': [], '海外': [], '建設': [] };
    var i;
    for (i = 0; i < rows.length; i++) buckets[rows[i].category].push(rows[i]);
    order.forEach(function (key) {
      buckets[key].sort(function (a, b) { return b.publishedMs - a.publishedMs; });
    });
    var depth = 0;
    for (i = 0; i < order.length; i++) {
      if (buckets[order[i]].length > depth) depth = buckets[order[i]].length;
    }
    var out = [];
    var step;
    var c;
    for (step = 0; step < depth; step++) {
      for (c = 0; c < order.length; c++) {
        if (buckets[order[c]][step]) out.push(buckets[order[c]][step]);
      }
    }
    return out;
  }

  /**
   * 国内・海外・建設。verified と許諾が揃った項目だけ残す。
   * 未確認、期限切れ、取得失敗の穴埋めは作らない。写真は許諾があるときだけ残す。
   */
  function publishableTopics(raw, cfg, nowMs) {
    var src = raw && Array.isArray(raw.items) ? raw.items : [];
    var now = Number.isFinite(nowMs) ? nowMs : Date.now();
    var limit = topicFreshLimit(cfg);
    var allowPreview = !!(cfg && cfg.allowPreview);
    var cap = Number(cfg && cfg.maxItems);
    if (!Number.isFinite(cap) || cap < 1) cap = 6;
    var seen = {};
    var rows = [];
    var i;
    for (i = 0; i < src.length; i++) {
      var row = src[i] || {};
      if (row.verified !== true) continue;
      var license = String(row.licenseStatus || '');
      if (license === 'preview') {
        if (!allowPreview) continue;
      } else if (!TOPIC_LICENSE[license]) continue;
      if (row.sensitive === true || row.kind === 'crime' || row.kind === 'incident') {
        if (row.editorialClearance !== true) continue;
      }
      var category = TOPIC_LABEL[String(row.category || '').trim()];
      if (!category) continue;
      var title = cleanTitle(decodeText(row.title));
      var sourceName = cleanTitle(decodeText(row.sourceName));
      if (!title || !sourceName) continue;
      var publishedMs = topicPublishedMs(row);
      if (publishedMs == null) continue;
      if (publishedMs - now > 36 * 60 * 60 * 1000) continue;
      if (limit != null && now - publishedMs > limit) continue;
      var id = String(row.id || row.sourceUrl || (category + '\n' + title));
      if (seen[id]) continue;
      seen[id] = true;
      var sourceUrl = String(row.sourceUrl || '');
      if (!/^https?:\/\//i.test(sourceUrl)) sourceUrl = '';
      var imageUrl = '';
      if (row.imageUrl && TOPIC_LICENSE[String(row.imageLicense || '')]) {
        imageUrl = String(row.imageUrl);
      }
      rows.push({
        id: id,
        category: category,
        title: title,
        sourceName: sourceName,
        sourceUrl: sourceUrl,
        date: studioDate_(new Date(publishedMs).toISOString()),
        publishedMs: publishedMs,
        imageUrl: imageUrl
      });
    }
    var mixed = interleaveTopics(rows);
    return mixed.slice(0, cap);
  }

  function textWidthUnits(ch) {
    return ch.charCodeAt(0) <= 0x7f ? 0.55 : 1;
  }

  function chunkByUnits(text, budget) {
    var chunks = [];
    var buf = '';
    var used = 0;
    var s = String(text || '');
    var i;
    for (i = 0; i < s.length; i++) {
      var w = textWidthUnits(s.charAt(i));
      if (buf && used + w > budget) {
        chunks.push(buf);
        buf = '';
        used = 0;
      }
      buf += s.charAt(i);
      used += w;
    }
    if (buf) chunks.push(buf);
    return chunks;
  }

  function buildFaceTrackHtml(items) {
    var rows = Array.isArray(items) ? items : [];
    if (!rows.length) return { html: '', setWidth: 0 };
    var inner = '';
    var i;
    for (i = 0; i < rows.length; i++) {
      var it = rows[i];
      inner += '<div class="news-item news-topic">' +
        '<span class="news-topic-cat" data-cat="' + escapeHtml(it.category) + '">' + escapeHtml(it.category) + '</span>' +
        '<span class="news-title">' + escapeHtml(it.title) + '</span>' +
        '<span class="news-topic-source">出典：' + escapeHtml(it.sourceName) + '</span>' +
        (it.imageUrl ? '<img class="news-topic-photo" src="' + escapeHtml(it.imageUrl) + '" alt="" decoding="sync">' : '') +
        '</div><span class="news-sep" aria-hidden="true">●</span>';
    }
    var unit = '<div class="news-unit">' + inner + '</div>';
    return { html: unit + unit, setWidth: 0 };
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
    function itemLogoHtml() {
      if (!opts || !opts.itemLogo || !logo) return '';
      return '<span class="news-badge-logo-plate"><img class="news-badge-logo" src="' + escapeHtml(logo) + '" alt="" decoding="sync"></span>';
    }
    function itemHtml(it) {
      return '<div class="news-item">' +
        itemLogoHtml() +
        (it.date ? '<span class="news-date">' + escapeHtml(it.date) + '</span>' : '') +
        '<span class="news-title">' + escapeHtml(it.title) + '</span>' +
        '</div>';
    }
    if (opts && opts.faceSafe) return buildFaceTrackHtml(rows);
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
    recentItems: recentItems,
    publishableTopics: publishableTopics,
    chunkByUnits: chunkByUnits,
    NEWS_FRESH_MS: NEWS_FRESH_MS,
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
