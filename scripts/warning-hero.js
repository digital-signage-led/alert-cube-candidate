/**
 * 512×128 3段ヒーロー（注意報・警報・危険警報・特別警報・避難情報）
 * 256px（2面）を1セットとして流し、1周で次へ。
 */
(function (global) {
  'use strict';

  var KINDS = [
    { key: 'flood', label: '氾濫' },
    { key: 'rain', label: '大雨' },
    { key: 'landslide', label: '土砂災害' },
    { key: 'surge', label: '高潮' }
  ];
  var LEVELS = [
    { group: 'l2', key: 'advisory', label: '注意報', lv: 2, cls: 'advisory', suffix: '注意報',
      bot: '避難行動・避難経路の確認\n（ハザードマップ等の再チェック）' },
    { group: 'l3', key: 'warning', label: '警報', lv: 3, cls: 'warning', suffix: '警報',
      bot: '高齢者や避難に時間のかかる人は避難' },
    { group: 'l4', key: 'danger', label: '危険警報', lv: 4, cls: 'danger', suffix: '危険警報',
      bot: '危険な場所から全員避難\n（自治体の「避難指示」相当）' },
    { group: 'l5', key: 'special', label: '特別警報', lv: 5, cls: 'special', suffix: '特別警報',
      bot: '命を守るための最善の行動をとる\n（すでに災害発生または切迫）' }
  ];
  var EVAC_ITEMS = [
    { group: 'evac', label: '避難情報', lv: 3, cls: 'warning', levelLabel: '警報',
      mid: 'レベル3高齢者等避難', bot: '高齢者や避難に時間のかかる人は避難', badge: '発表中', kind: 'evac3' },
    { group: 'evac', label: '避難情報', lv: 4, cls: 'danger', levelLabel: '危険警報',
      mid: 'レベル4避難指示', bot: '危険な場所から全員避難', badge: '発表中', kind: 'evac4' },
    { group: 'evac', label: '避難情報', lv: 5, cls: 'special', levelLabel: '特別警報',
      mid: 'レベル5緊急安全確保', bot: '命を守るための最善の行動をとる\n（すでに災害発生または切迫）', badge: '発表中', kind: 'evac5' }
  ];
  var CODE_MAP = {
    '10': { level: 'advisory', kind: 'rain' },
    '03': { level: 'warning', kind: 'rain' },
    '43': { level: 'danger', kind: 'rain' },
    '33': { level: 'special', kind: 'rain' },
    '18': { level: 'advisory', kind: 'flood' },
    '04': { level: 'warning', kind: 'flood' },
    '44': { level: 'danger', kind: 'flood' },
    '34': { level: 'special', kind: 'flood' },
    '29': { level: 'advisory', kind: 'landslide' },
    '09': { level: 'warning', kind: 'landslide' },
    '49': { level: 'danger', kind: 'landslide' },
    '39': { level: 'special', kind: 'landslide' },
    '19': { level: 'advisory', kind: 'surge' },
    '08': { level: 'warning', kind: 'surge' },
    '48': { level: 'danger', kind: 'surge' },
    '38': { level: 'special', kind: 'surge' }
  };

  function warnItems() {
    var out = [];
    for (var i = 0; i < KINDS.length; i++) {
      var kind = KINDS[i];
      for (var j = 0; j < LEVELS.length; j++) {
        var lv = LEVELS[j];
        out.push({
          group: lv.group,
          levelKey: lv.key,
          kind: kind.key,
          label: lv.label,
          lv: lv.lv,
          cls: lv.cls,
          levelLabel: lv.label,
          place: defaultPlace_(),
          issuedAt: new Date().toISOString(),
          mid: colorMidLabel_(lv.lv, kind.label),
          bot: lv.bot,
          badge: '発表中'
        });
      }
    }
    return out;
  }

  function levelDemoItems() {
    return warnItems().map(function (item) {
      return Object.assign({}, item, {
        demo: true,
        badge: 'デモ'
      });
    });
  }

  function demoItems() {
    return levelDemoItems();
  }

  function levelByKey(key) {
    return LEVELS.filter(function (lv) { return lv.key === key; })[0] || null;
  }

  function kindLabel(kindKey) {
    var row = KINDS.filter(function (k) { return k.key === kindKey; })[0];
    return row ? row.label : '';
  }

  function catalogRow(levelKey, kindKey) {
    var src = global.JmaWarningKinds;
    var rows = src && src.CATALOG && src.CATALOG[levelKey];
    if (!rows) return null;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].kind === kindKey) return rows[i];
    }
    return null;
  }

  function stripKindSuffix_(text) {
    return String(text || '')
      .replace(/^レベル[1-5]/, '')
      .replace(/危険警報$|特別警報$|注意報$|警報$/, '');
  }

  function pad2_(n) {
    n = Number(n) || 0;
    return n < 10 ? '0' + n : String(n);
  }

  function municipalityLabel_(name, code) {
    var n = String(name || '').trim();
    var c = String(code || '');
    var cfg = global.SignageConfig;
    var configured = (cfg && cfg.jma && cfg.jma.warnCityLabel)
      || (cfg && cfg.site && cfg.site.locationLabel)
      || '';
    var warnCity = (cfg && cfg.jma && cfg.jma.warnCity) || '';
    if (c && warnCity && String(c) === String(warnCity)) return configured;
    var city = n.match(/^(.*?市)/);
    if (city && /区/.test(n)) {
      var ku = n.match(/([^市]+区)$/);
      if (ku) return ku[1];
      return city[1];
    }
    if (/区$/.test(n) && n.indexOf('県') < 0) return n;
    if (/[市町村]$/.test(n) && n.indexOf('県') < 0) return n;
    return configured || n;
  }

  function defaultPlace_() {
    var cfg = global.SignageConfig;
    if (cfg && cfg.jma && cfg.jma.warnCityLabel) return municipalityLabel_(cfg.jma.warnCityLabel, cfg.jma.warnCity);
    var city = cfg && cfg.jma && cfg.jma.warnCity;
    return municipalityLabel_('', city || '');
  }

  function jstParts_(ms) {
    var d = new Date(ms);
    var utc = d.getTime() + d.getTimezoneOffset() * 60000;
    var jst = new Date(utc + 9 * 3600000);
    return {
      month: jst.getMonth() + 1,
      day: jst.getDate(),
      hour: jst.getHours(),
      minute: jst.getMinutes()
    };
  }

  function parseIssuedMs_(raw) {
    if (!raw) return NaN;
    var s = String(raw).trim();
    var ms = NaN;
    if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) ms = Date.parse(s);
    else if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s)) ms = Date.parse(s.replace(/\.\d+$/, '') + '+09:00');
    else ms = Date.parse(s);
    return ms;
  }

  function formatIssuedClock_(raw) {
    var ms = parseIssuedMs_(raw);
    if (!isFinite(ms)) ms = Date.now();
    var p = jstParts_(ms);
    return pad2_(p.hour) + ':' + pad2_(p.minute);
  }

  function stampPlaceTime_(item, place, issuedAt) {
    if (!item) return item;
    if (place) item.place = municipalityLabel_(place, '');
    if (!item.place) item.place = defaultPlace_();
    if (issuedAt) item.issuedAt = issuedAt;
    if (!item.issuedAt) item.issuedAt = new Date().toISOString();
    return item;
  }

  function colorTopLabel_(lv, kindKey, row) {
    return (lv && lv.label) ? lv.label : '';
  }

  function colorMidLabel_(lv, hazard) {
    var name = String(hazard || '');
    if (!name) return lv ? ('レベル' + lv) : '';
    return 'レベル' + lv + name;
  }

  function formatColorMid_(scene) {
    if (!scene) return '';
    var hazard = kindLabel(scene.kind);
    if (scene.lv && hazard) return colorMidLabel_(scene.lv, hazard);
    var body = stripKindSuffix_(scene.mid);
    var isEvac = scene.group === 'evac' || String(scene.kind || '').indexOf('evac') === 0;
    if (isEvac) {
      if (!body) {
        if (scene.lv === 3) body = '高齢者等避難';
        else if (scene.lv === 4) body = '避難指示';
        else if (scene.lv === 5) body = '緊急安全確保';
      }
      return scene.lv ? colorMidLabel_(scene.lv, body) : body;
    }
    return body;
  }

  function evacActionName_(lv) {
    if (lv === 5) return '緊急安全確保';
    if (lv === 4) return '避難指示';
    return '高齢者等避難';
  }

  function itemFromEvac(lvNum) {
    var n = Number(lvNum) || 0;
    var row = null;
    for (var i = 0; i < EVAC_ITEMS.length; i++) {
      if (EVAC_ITEMS[i].lv === n) row = EVAC_ITEMS[i];
    }
    if (!row) return null;
    var lv = levelByKey(n === 5 ? 'special' : n === 4 ? 'danger' : 'warning');
    return stampPlaceTime_({
      group: 'evac',
      levelKey: lv ? lv.key : row.cls,
      kind: row.kind,
      label: '避難情報',
      lv: row.lv,
      cls: row.cls,
      levelLabel: '避難情報',
      mid: colorMidLabel_(row.lv, evacActionName_(row.lv)),
      bot: row.bot,
      badge: '発表中'
    });
  }

  function itemFromLive(levelKey, kindKey) {
    var lv = levelByKey(levelKey);
    if (!lv) return null;
    var four = kindLabel(kindKey);
    if (!four) return null;
    var row = catalogRow(levelKey, kindKey);
    return stampPlaceTime_({
      group: lv.group,
      levelKey: lv.key,
      kind: kindKey,
      label: lv.label,
      lv: lv.lv,
      cls: lv.cls,
      levelLabel: colorTopLabel_(lv, kindKey, row),
      mid: formatColorMid_({
        kind: kindKey,
        lv: lv.lv,
        group: lv.group,
        mid: row ? row.name : (four + lv.suffix)
      }),
      bot: four ? lv.bot : ((row && row.short) || lv.bot),
      badge: '発表中'
    });
  }

  function liveMatchCodes(cityCode, areaCode) {
    var city = String(cityCode || '');
    var extra = {
      '1220410': ['1220400', '1210000', '120010'],
      '1220400': ['1220410', '1210000', '120010'],
      '1210000': ['1220400', '1220410', '120010'],
      '1310100': ['130010'],
      '4520100': ['450010', '450011', '450012', '4520400', '4520700', '4538200', '4538300'],
      '3410300': ['3410100', '340000']
    };
    var codes = [city];
    (extra[city] || []).forEach(function (c) {
      if (codes.indexOf(c) < 0) codes.push(c);
    });
    var area = String(areaCode || '');
    if (area && codes.indexOf(area) < 0) codes.push(area);
    return codes;
  }

  function statusActive_(st) {
    var s = String(st || '');
    if (!s || s.indexOf('解除') >= 0 || s.indexOf('なし') >= 0) return false;
    return s.indexOf('発表') >= 0 || s.indexOf('継続') >= 0;
  }

  function r8ItemsFromRecord_(rec) {
    var w = (rec && rec.warning) || rec || {};
    return [].concat(
      w.class20Items || [],
      w.class15Items || [],
      w.class15sItems || [],
      w.class10Items || []
    );
  }

  function normalizeWarningPayload_(raw) {
    if (!raw) return null;
    if (!Array.isArray(raw) && raw.areaTypes) return raw;
    var records = Array.isArray(raw) ? raw : [raw];
    var byArea = {};
    var latestDt = '';
    var headline = '';
    var headlineDt = '';
    records.forEach(function (rec) {
      if (!rec || typeof rec !== 'object') return;
      var dt = rec.reportDatetime || '';
      if (dt && (!latestDt || dt > latestDt)) latestDt = dt;
      var ht = rec.headlineText || '';
      if (ht && dt && (!headlineDt || dt > headlineDt)) {
        headline = ht;
        headlineDt = dt;
      }
      r8ItemsFromRecord_(rec).forEach(function (it) {
        var code = String(it.areaCode || it.code || '');
        if (!code) return;
        if (!byArea[code]) byArea[code] = { code: code, name: it.areaName || '', warnings: {} };
        if (it.areaName) byArea[code].name = it.areaName;
        (it.kinds || it.warnings || []).forEach(function (k) {
          var kc = String(k.code || '');
          if (!kc || kc === '-') return;
          var st = String(k.status || '');
          if (!statusActive_(st)) return;
          var prev = byArea[code].warnings[kc];
          if (!prev || (dt && (!prev.issuedAt || dt > prev.issuedAt))) {
            byArea[code].warnings[kc] = { code: kc, status: st, issuedAt: dt };
          }
        });
      });
    });
    var areas = Object.keys(byArea).map(function (code) {
      var a = byArea[code];
      return {
        code: a.code,
        name: a.name,
        warnings: Object.keys(a.warnings).map(function (c) { return a.warnings[c]; })
      };
    }).filter(function (a) { return a.warnings.length; });
    return {
      reportDatetime: latestDt,
      headlineText: headline,
      areaTypes: [{ areas: areas }]
    };
  }

  function parseLiveEntries(rawJson, cityCode, areaCode) {
    var warnJson = normalizeWarningPayload_(rawJson);
    var seen = {};
    var out = [];
    var codes = liveMatchCodes(cityCode, areaCode);
    var headline = String((warnJson && warnJson.headlineText) || '');
    var issuedAt = (warnJson && warnJson.reportDatetime) || '';
    var place = '';
    if (!warnJson || !warnJson.areaTypes) return out;
    var preferred = [];
    for (var ci = 0; ci < codes.length; ci++) {
      var hits = [];
      warnJson.areaTypes.forEach(function (at) {
        (at.areas || []).forEach(function (area) {
          if (String(area.code) === String(codes[ci])) hits.push(area);
        });
      });
      if (hits.length) {
        preferred = hits;
        break;
      }
    }
    preferred.forEach(function (area) {
        if (!place && area.name) place = municipalityLabel_(area.name, area.code);
        (area.warnings || []).forEach(function (w) {
          var st = String(w.status || '');
          if (!statusActive_(st)) return;
          var c = String(w.code || '');
          var base = CODE_MAP[c];
          if (!base) return;
          var levelKey = base.level;
          var kindKey = base.kind;
          if (c === '03' && headline.indexOf('危険') >= 0) levelKey = 'danger';
          if (c === '03' && headline.indexOf('土砂') >= 0) kindKey = 'landslide';
          var item = itemFromLive(levelKey, kindKey);
          if (!item) return;
          stampPlaceTime_(item, place, w.issuedAt || issuedAt);
          var key = item.levelKey + '|' + item.kind;
          if (seen[key]) return;
          seen[key] = true;
          out.push(item);
          if (c === '03' && headline.indexOf('土砂') >= 0 && kindKey === 'rain') {
            var extra = itemFromLive(levelKey, 'landslide');
            if (extra && !seen[extra.levelKey + '|landslide']) {
              stampPlaceTime_(extra, place, issuedAt);
              seen[extra.levelKey + '|landslide'] = true;
              out.push(extra);
            }
          }
        });
    });
    var order = { special: 0, danger: 1, warning: 2, advisory: 3 };
    var kindOrd = { rain: 0, landslide: 1, flood: 2, surge: 3 };
    out.sort(function (a, b) {
      var la = order[a.levelKey];
      var lb = order[b.levelKey];
      if (la !== lb) return la - lb;
      return (kindOrd[a.kind] || 9) - (kindOrd[b.kind] || 9);
    });
    return out;
  }

  function fetchLive(area, city) {
    var url = 'https://www.jma.go.jp/bosai/warning/data/r8/' + encodeURIComponent(area) + '.json?t=' + Date.now();
    return fetch(url, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('warning HTTP ' + res.status);
      return res.json();
    }).then(function (json) {
      return parseLiveEntries(json, city, area);
    });
  }

  var SPEED = 56;
  var UNIT_W = 256;

  function addTopPart_(parent, cls, text) {
    var el = document.createElement('span');
    el.className = cls;
    el.textContent = text;
    parent.appendChild(el);
    return el;
  }

  function makeTopSeg(scene) {
    var seg = document.createElement('div');
    seg.className = 'seg';
    var unit = document.createElement('div');
    unit.className = 'unit';
    addTopPart_(unit, 'top-place', (scene && scene.place) || defaultPlace_());
    addTopPart_(unit, 'top-label', (scene && scene.levelLabel) || '');
    addTopPart_(unit, 'top-time', formatIssuedClock_(scene && scene.issuedAt));
    var badge = document.createElement('span');
    badge.className = 'badge';
    badge.innerHTML = '<span>' + (scene.badge || '発表中') + '</span>';
    unit.appendChild(badge);
    seg.appendChild(unit);
    return seg;
  }

  function midChipLabel_(el) {
    if (!el) return '';
    var fill = el.querySelector('.mid-chip-fill');
    if (fill) return fill.textContent || '';
    return el.getAttribute('data-mid') || el.textContent || '';
  }

  function makeMidSeg(scene) {
    var seg = document.createElement('div');
    seg.className = 'seg';
    var chip = document.createElement('span');
    chip.className = 'mid-chip';
    var label = formatColorMid_(scene);
    chip.setAttribute('data-mid', label);
    var stroke = document.createElement('span');
    stroke.className = 'mid-chip-stroke';
    stroke.setAttribute('aria-hidden', 'true');
    stroke.textContent = label;
    var fill = document.createElement('span');
    fill.className = 'mid-chip-fill';
    fill.textContent = label;
    chip.appendChild(stroke);
    chip.appendChild(fill);
    seg.appendChild(chip);
    return seg;
  }

  function splitBot2_(text) {
    var s = String(text || '').replace(/\r/g, '').trim();
    if (!s) return s;
    if (s.indexOf('\n') >= 0) return s;
    if (s.length <= 11) return s;
    var avoid = ['おそれ', 'ときに', 'ための', 'などを', 'または'];
    function splitsWord(i) {
      for (var a = 0; a < avoid.length; a++) {
        var p = s.indexOf(avoid[a]);
        if (p >= 0 && i > p && i < p + avoid[a].length) return true;
      }
      return false;
    }
    var marks = 'のをにはがでと等）。、・';
    var best = Math.ceil(s.length / 2);
    var bestScore = 999;
    for (var i = 5; i <= s.length - 3; i++) {
      if (splitsWord(i)) continue;
      var score = Math.max(i, s.length - i);
      if (marks.indexOf(s.charAt(i - 1)) >= 0) score -= 1.2;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return s.slice(0, best) + '\n' + s.slice(best);
  }

  function longestLineLen_(text) {
    var parts = String(text || '').split('\n');
    var m = 1;
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].length > m) m = parts[i].length;
    }
    return m;
  }

  function pxByChars_(maxW, n, maxPx, extra) {
    extra = extra || 0;
    n = Math.max(1, n);
    var px = Math.floor((maxW - extra) / n);
    if (px > maxPx) px = maxPx;
    if (px < 10) px = 10;
    return px;
  }

  function elWide_(el) {
    if (!el) return 0;
    return Math.max(el.scrollWidth || 0, el.offsetWidth || 0);
  }

  function shrinkUntilFits_(el, maxW, maxH, minPx) {
    if (!el) return;
    var size = parseFloat(el.style.fontSize) || 16;
    var guard = 32;
    while (guard-- > 0) {
      var tooW = maxW > 0 && elWide_(el) > maxW + 0.5;
      var tooH = maxH > 0 && (el.scrollHeight || 0) > maxH + 0.5;
      if (!tooW && !tooH) return;
      if (size <= minPx) {
        el.style.letterSpacing = '0';
        el.style.fontSize = minPx + 'px';
        return;
      }
      size -= 0.5;
      el.style.fontSize = size + 'px';
      if (size <= minPx + 3) el.style.letterSpacing = '0';
    }
  }

  function fillBotLines(el, text) {
    while (el.firstChild) el.removeChild(el.firstChild);
    var parts = splitBot2_(text).split('\n');
    for (var i = 0; i < parts.length; i++) {
      if (i) el.appendChild(document.createElement('br'));
      el.appendChild(document.createTextNode(parts[i]));
    }
  }

  function makeBotSeg(scene) {
    var seg = document.createElement('div');
    seg.className = 'seg';
    var txt = document.createElement('span');
    txt.className = 'bot-txt';
    fillBotLines(txt, scene.bot);
    seg.appendChild(txt);
    return seg;
  }

  function fillTrack(track, makeSeg, scene) {
    track.style.transform = 'translate3d(0,0,0)';
    track.style.display = 'flex';
    track.style.flexDirection = 'row';
    track.style.flexWrap = 'nowrap';
    track.style.alignItems = 'center';
    track.style.height = '100%';
    track.style.width = 'max-content';
    while (track.firstChild) track.removeChild(track.firstChild);
    track.appendChild(makeSeg(scene));
  }

  function fitToWidth(el, maxW, maxPx) {
    if (!el) return;
    var isMid = el.classList.contains('mid-chip');
    var extra = isMid ? 2 : 0;
    var n = String(isMid ? midChipLabel_(el) : (el.textContent || '')).length || 1;
    var budget = Math.max(40, maxW - extra);
    var px = pxByChars_(budget, n, maxPx, 0);
    if (n >= 4) el.style.letterSpacing = '0';
    else el.style.letterSpacing = '0.02em';
    el.style.fontSize = px + 'px';
    el.style.lineHeight = '1';
    el.style.transform = 'none';
    el.style.width = 'auto';
    el.style.maxWidth = 'none';
    el.style.flex = '0 0 auto';
    el.style.overflow = 'visible';
    shrinkUntilFits_(el, budget, 0, 10);
    el.style.maxWidth = maxW + 'px';
  }

  function unitWidth_(unit) {
    if (!unit) return 0;
    return Math.ceil(Math.max(unit.scrollWidth || 0, unit.offsetWidth || 0));
  }

  function fitBot(el, maxH, maxW) {
    if (!el) return;
    el.style.whiteSpace = 'pre-line';
    el.style.width = 'auto';
    el.style.maxWidth = 'none';
    el.style.flex = '0 0 auto';
    el.style.overflow = 'visible';
    el.style.letterSpacing = '0';
    var n = longestLineLen_(el.textContent || '');
    var size = pxByChars_(maxW || 248, n, 18, 0);
    el.style.fontSize = size + 'px';
    el.style.lineHeight = '1.05';
    shrinkUntilFits_(el, maxW || 248, maxH || 38, 11);
  }

  function fitTopUnit_(unit, maxW) {
    if (!unit) return;
    var place = unit.querySelector('.top-place');
    var label = unit.querySelector('.top-label');
    var time = unit.querySelector('.top-time');
    var badge = unit.querySelector('.badge');
    var badgeTxt = badge ? badge.querySelector('span') : null;
    unit.style.overflow = 'visible';
    unit.style.maxWidth = 'none';
    unit.style.width = 'auto';
    unit.style.gap = '2px';
    var n = String((place && place.textContent) || '').length
      + String((label && label.textContent) || '').length
      + String((time && time.textContent) || '').length
      + String((badgeTxt && badgeTxt.textContent) || '').length;
    var size = pxByChars_(maxW - 12, Math.max(8, n), 22, 0);
    if (place) {
      place.style.fontSize = Math.max(14, size - 1) + 'px';
      place.style.letterSpacing = '0.01em';
    }
    if (label) {
      label.style.fontSize = size + 'px';
      label.style.letterSpacing = '0.01em';
      label.style.overflow = 'visible';
      label.style.maxWidth = 'none';
    }
    if (time) time.style.fontSize = Math.max(13, size - 2) + 'px';
    if (badgeTxt) badgeTxt.style.fontSize = Math.max(13, size - 3) + 'px';
    var guard = 24;
    while (unitWidth_(unit) > maxW && size > 12 && guard-- > 0) {
      size -= 1;
      unit.style.gap = '2px';
      if (place) place.style.fontSize = Math.max(12, size - 1) + 'px';
      if (label) label.style.fontSize = size + 'px';
      if (time) time.style.fontSize = Math.max(12, size - 2) + 'px';
      if (badgeTxt) badgeTxt.style.fontSize = Math.max(12, size - 3) + 'px';
      if (size <= 16) {
        if (place) place.style.letterSpacing = '0';
        if (label) label.style.letterSpacing = '0';
      }
    }
    unit.style.maxWidth = maxW + 'px';
    unit.style.overflow = 'hidden';
  }

  function canvasTextWidth(text, cssFont) {
    if (!canvasTextWidth._ctx) {
      var c = document.createElement('canvas');
      canvasTextWidth._ctx = c.getContext && c.getContext('2d');
    }
    var ctx = canvasTextWidth._ctx;
    if (!ctx) return 0;
    ctx.font = cssFont;
    return Math.ceil(ctx.measureText(String(text || '')).width);
  }

  function measureProbe(el) {
    if (!el) return 0;
    var host = document.getElementById('sceneWarnHero');
    var probe = el.cloneNode(true);
    probe.style.position = 'absolute';
    probe.style.left = '0';
    probe.style.top = '-9999px';
    probe.style.width = 'auto';
    probe.style.maxWidth = 'none';
    probe.style.minWidth = 'auto';
    probe.style.flex = 'none';
    probe.style.display = 'inline-flex';
    probe.style.whiteSpace = el.classList.contains('bot-txt') ? 'pre-line' : 'nowrap';
    probe.style.visibility = 'hidden';
    probe.style.transform = 'none';
    probe.style.overflow = 'visible';
    (host || document.body).appendChild(probe);
    var w = Math.ceil(Math.max(probe.scrollWidth || 0, probe.offsetWidth || 0));
    if (probe.parentNode) probe.parentNode.removeChild(probe);
    return w;
  }

  function measureMidWidth(mid) {
    var text = midChipLabel_(mid);
    var font = '900 42px "Noto Sans JP","Yu Gothic UI","Yu Gothic",Meiryo,sans-serif';
    var letter = 0;
    var stroke = 6;
    var cw = canvasTextWidth(text, font) + letter + stroke;
    var dw = measureProbe(mid) + stroke;
    return Math.max(cw, dw, 1);
  }

  function lockSegWidth(el, w) {
    el.style.boxSizing = 'border-box';
    el.style.width = w + 'px';
    el.style.minWidth = w + 'px';
    el.style.maxWidth = w + 'px';
    el.style.flex = '0 0 ' + w + 'px';
    el.style.overflow = 'hidden';
    el.style.paddingLeft = '4px';
    el.style.paddingRight = '4px';
    el.style.justifyContent = 'center';
    el.style.alignItems = 'center';
    el.style.textAlign = 'center';
  }

  function prepareTrack(track) {
    var first = track.children[0];
    if (!first) return 0;
    var innerW = UNIT_W - 8;
    var mid = first.querySelector('.mid-chip');
    var bot = first.querySelector('.bot-txt');
    var top = first.querySelector('.top-label');
    var unit = first.querySelector('.unit');
    var badge = first.querySelector('.badge');
    if (bot) {
      fitBot(bot, 38, innerW);
      bot.style.width = innerW + 'px';
      bot.style.maxWidth = innerW + 'px';
      bot.style.textAlign = 'center';
      bot.style.marginLeft = 'auto';
      bot.style.marginRight = 'auto';
      bot.style.overflow = 'hidden';
    }
    if (unit) {
      unit.style.justifyContent = 'center';
      unit.style.alignItems = 'center';
      unit.style.flexWrap = 'nowrap';
      unit.style.width = 'auto';
      unit.style.maxWidth = innerW + 'px';
      unit.style.flex = '0 0 auto';
      unit.style.marginLeft = 'auto';
      unit.style.marginRight = 'auto';
      fitTopUnit_(unit, innerW);
    }
    if (top) {
      top.style.flex = '0 0 auto';
      top.style.minWidth = '0';
      top.style.whiteSpace = 'nowrap';
      top.style.width = 'auto';
      top.style.maxWidth = 'none';
    }
    if (mid) {
      mid.style.fontWeight = '900';
      mid.style.transform = 'none';
      mid.style.display = 'flex';
      mid.style.justifyContent = 'center';
      mid.style.alignItems = 'center';
      mid.style.flex = '0 0 auto';
      mid.style.width = 'auto';
      mid.style.maxWidth = 'none';
      mid.style.marginLeft = 'auto';
      mid.style.marginRight = 'auto';
      mid.style.textAlign = 'center';
      mid.style.lineHeight = '1';
      fitToWidth(mid, innerW, 42);
      mid.style.width = innerW + 'px';
      mid.style.maxWidth = innerW + 'px';
      mid.style.overflow = 'hidden';
    }
    lockSegWidth(first, UNIT_W);
    while (track.children.length > 1) track.removeChild(track.lastChild);
    for (var i = 1; i < 4; i++) {
      if (first.parentNode) track.appendChild(first.cloneNode(true));
    }
    return UNIT_W;
  }

  var fontsReady_ = false;
  function afterLayout(cb) {
    function go() {
      requestAnimationFrame(function () {
        requestAnimationFrame(cb);
      });
    }
    if (fontsReady_ || !(document.fonts && document.fonts.load)) {
      go();
      return;
    }
    var done = false;
    function once() {
      if (done) return;
      done = true;
      fontsReady_ = true;
      go();
    }
    document.fonts.load('900 40px "Noto Sans JP"').then(once, once);
    setTimeout(once, 80);
  }

  function createPlayer(opts) {
    var hero = opts.hero;
    var topTrack = opts.topTrack;
    var midTrack = opts.midTrack;
    var botTrack = opts.botTrack;
    var onItem = opts.onItem || function () {};
    var onCycleEnd = opts.onCycleEnd || null;
    var items = (opts.items || []).slice();
    var itemIndex = 0;
    var playGen = 0;
    var rafId = 0;
    var holdId = 0;
    var cycles = Math.max(1, Number(opts.cycles) || 1);
    var cycleCount = 0;
    var holdStartMs = opts.holdStartMs != null ? Number(opts.holdStartMs) : 1000;
    var holdEndMs = opts.holdEndMs != null ? Number(opts.holdEndMs) : 1000;
    var needStartHold = true;

    function clearHold_() {
      if (holdId) {
        clearTimeout(holdId);
        holdId = 0;
      }
    }

    function applyTrackX_(loopWs, scrollX) {
      var x = Math.round(scrollX);
      [topTrack, midTrack, botTrack].forEach(function (track, i) {
        var w = loopWs[i];
        if (!track || !(w > 0)) return;
        track.style.transform = 'translate3d(' + (-(x % w)) + 'px,0,0)';
      });
    }

    function startSharedScroll(gen, loopWs) {
      if (rafId) cancelAnimationFrame(rafId);
      var scrollX = 0;
      var lastWall = Date.now();
      var oneLoop = loopWs[1] || UNIT_W;
      var waitStart = needStartHold ? holdStartMs : 0;
      needStartHold = false;
      var step = function () {
        if (gen !== playGen) return;
        var now = Date.now();
        var dt = (now - lastWall) / 1000;
        lastWall = now;
        if (!(dt > 0) || dt > 0.08) dt = 1 / 60;
        scrollX += SPEED * dt;
        while (oneLoop > 0 && scrollX >= oneLoop) {
          scrollX -= oneLoop;
          if (!advanceAfterLap_(gen, loopWs, scrollX)) return;
        }
        applyTrackX_(loopWs, scrollX);
        rafId = requestAnimationFrame(step);
      };
      applyTrackX_(loopWs, 0);
      function begin() {
        holdId = 0;
        if (gen !== playGen) return;
        lastWall = Date.now();
        rafId = requestAnimationFrame(step);
      }
      if (waitStart > 0) {
        clearHold_();
        holdId = setTimeout(begin, waitStart);
      } else {
        begin();
      }
    }

    function renderItem(index) {
      if (!items.length) return;
      var gen = ++playGen;
      itemIndex = ((index % items.length) + items.length) % items.length;
      var scene = items[itemIndex];
      hero.className = 'hero is-' + scene.cls + (scene.demo ? ' is-demo' : '');
      fillTrack(topTrack, makeTopSeg, scene);
      fillTrack(midTrack, makeMidSeg, scene);
      fillTrack(botTrack, makeBotSeg, scene);
      onItem(scene, itemIndex);
      afterLayout(function () {
        if (gen !== playGen) return;
        var loopWs = [prepareTrack(topTrack), prepareTrack(midTrack), prepareTrack(botTrack)];
        startSharedScroll(gen, loopWs);
      });
    }

    function advanceAfterLap_(gen, loopWs, scrollX) {
      var next = itemIndex + 1;
      if (next >= items.length) {
        cycleCount += 1;
        if (onCycleEnd && cycleCount >= cycles) {
          applyTrackX_(loopWs, scrollX);
          clearHold_();
          holdId = setTimeout(function () {
            holdId = 0;
            if (gen !== playGen) return;
            onCycleEnd();
          }, holdEndMs);
          return false;
        }
        next = 0;
      }
      if (next === itemIndex) return true;
      renderItem(next);
      return false;
    }

    return {
      setItems: function (next) { items = (next || []).slice(); itemIndex = 0; cycleCount = 0; },
      play: function (index) {
        cycleCount = 0;
        needStartHold = true;
        renderItem(index || 0);
      },
      stop: function () {
        playGen += 1;
        clearHold_();
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
      },
      items: function () { return items; }
    };
  }

  global.WarningHero = {
    KINDS: KINDS,
    LEVELS: LEVELS,
    EVAC_ITEMS: EVAC_ITEMS,
    GROUPS: [
      { id: 'l2', label: '注意報', lv: 2 },
      { id: 'l3', label: '警報', lv: 3 },
      { id: 'l4', label: '危険警報', lv: 4 },
      { id: 'l5', label: '特別警報', lv: 5 },
      { id: 'evac', label: '避難情報' }
    ],
    warnItems: warnItems,
    levelDemoItems: levelDemoItems,
    demoItems: demoItems,
    itemFromLive: itemFromLive,
    itemFromEvac: itemFromEvac,
    parseLiveEntries: parseLiveEntries,
    stampPlaceTime: stampPlaceTime_,
    fetchLive: fetchLive,
    createPlayer: createPlayer
  };
})(typeof window !== 'undefined' ? window : this);
