/**
 * 台風情報（通年監視・対象地域のみ表示）
 * 存在だけでは全現場へ出さない。site-config の地域と照合する。
 * 無い情報は作らない。
 */
(function (global) {
  'use strict';

  var JMA_TYPHOON_BASE = 'https://www.jma.go.jp/bosai/typhoon/data';
  var lastOk_ = { fetchOk: true, exists: false, affectsSite: false, items: [], updatedAt: 0 };
  var lastError_ = null;

  function fetchJson_(url) {
    return fetch(url, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  function typhoonNo_(num) {
    var s = String(num || '');
    if (/^\d{4}$/.test(s)) return String(Number(s.slice(2)));
    if (/^\d+$/.test(s)) return String(Number(s));
    return '';
  }

  function siteNeedles_(site) {
    var cfg = site || {};
    var jma = cfg.jma || {};
    var moe = cfg.moe || {};
    var loc = cfg.site || {};
    var list = [
      loc.locationLabel,
      loc.label,
      loc.address,
      jma.warnCityLabel,
      jma.forecastLabel,
      moe.alertArea,
      moe.pointName
    ];
    return list.map(function (s) { return String(s || '').trim(); }).filter(function (s) {
      return s && s !== '（表示地名）' && s !== '（市町村名）' && s !== '（都道府県）';
    });
  }

  function textHasNeedle_(text, needles) {
    var t = String(text || '');
    if (!t) return false;
    for (var i = 0; i < needles.length; i++) {
      var n = needles[i];
      if (n && t.indexOf(n) >= 0) return true;
      if (n && n.length >= 2 && t.indexOf(n.replace(/[都道府県市区町村]$/, '')) >= 0) {
        if (n.length >= 3) return true;
      }
    }
    return false;
  }

  function collectText_(node, acc) {
    if (node == null) return;
    if (typeof node === 'string' || typeof node === 'number') {
      acc.push(String(node));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(function (x) { collectText_(x, acc); });
      return;
    }
    if (typeof node === 'object') {
      Object.keys(node).forEach(function (k) {
        if (k === 'en') return;
        collectText_(node[k], acc);
      });
    }
  }

  function rowAffectsSite_(spec, forecast, needles) {
    var acc = [];
    collectText_(spec, acc);
    collectText_(forecast, acc);
    return textHasNeedle_(acc.join(' '), needles);
  }

  function summarizeRow_(spec, id) {
    var title = (spec || []).find(function (x) { return x && x.part === 'title'; }) || {};
    var analysis = (spec || []).find(function (x) {
      return x && x.part && x.part.en === 'Analysis';
    }) || {};
    var no = typhoonNo_(title.typhoonNumber || id);
    var nameJp = (title.name && title.name.jp) || '';
    var issued = title.datetime || title.reportDateTime || analysis.datetime || '';
    var loc = analysis.location || '';
    var parts = [];
    if (no) parts.push('台風第' + no + '号' + (nameJp ? '「' + nameJp + '」' : ''));
    else if (nameJp) parts.push(nameJp);
    var item = {
      number: no,
      name: nameJp || '',
      issuedAt: issued || '',
      location: loc || '',
      targetText: ''
    };
    var line = parts.join('');
    if (issued) line += (line ? '　' : '') + String(issued);
    if (loc) line += (line ? '　' : '') + loc;
    item.text = line;
    return item;
  }

  function emptyOk_() {
    return { fetchOk: true, exists: false, affectsSite: false, items: [], updatedAt: Date.now() };
  }

  function loadTyphoon(siteCfg) {
    var needles = siteNeedles_(siteCfg);
    return fetchJson_(JMA_TYPHOON_BASE + '/targetTc.json').then(function (targets) {
      var list = Array.isArray(targets) ? targets : (targets && targets.tropicalCyclone ? [targets] : []);
      if (!list.length) {
        lastOk_ = emptyOk_();
        lastError_ = null;
        return lastOk_;
      }
      return Promise.all(list.map(function (tc) {
        var id = tc.tropicalCyclone || tc;
        if (typeof id !== 'string') return null;
        return Promise.all([
          fetchJson_(JMA_TYPHOON_BASE + '/' + id + '/spec.json').catch(function () { return []; }),
          fetchJson_(JMA_TYPHOON_BASE + '/' + id + '/forecast.json').catch(function () { return []; })
        ]).then(function (pair) {
          var spec = pair[0] || [];
          var forecast = pair[1] || [];
          var item = summarizeRow_(spec, id);
          item.affectsSite = needles.length ? rowAffectsSite_(spec, forecast, needles) : false;
          return item;
        });
      })).then(function (rows) {
        var items = (rows || []).filter(Boolean);
        var affecting = items.filter(function (it) { return it.affectsSite; });
        lastOk_ = {
          fetchOk: true,
          exists: items.length > 0,
          affectsSite: affecting.length > 0,
          items: affecting,
          updatedAt: Date.now()
        };
        lastError_ = null;
        return lastOk_;
      });
    }).catch(function (err) {
      lastError_ = { fetchOk: false, message: String(err && err.message || err), at: Date.now() };
      return {
        fetchOk: false,
        exists: lastOk_.exists,
        affectsSite: lastOk_.affectsSite,
        items: lastOk_.items,
        updatedAt: lastOk_.updatedAt,
        held: true
      };
    });
  }

  function lastResult() {
    if (lastError_) {
      return {
        fetchOk: false,
        exists: lastOk_.exists,
        affectsSite: lastOk_.affectsSite,
        items: lastOk_.items,
        updatedAt: lastOk_.updatedAt,
        held: true
      };
    }
    return lastOk_;
  }

  global.AlertCubeTyphoon = {
    load: loadTyphoon,
    last: lastResult
  };
})(typeof window !== 'undefined' ? window : this);
