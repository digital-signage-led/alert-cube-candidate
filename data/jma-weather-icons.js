/**
 * 気象庁 TELOPS 天気コード → Alert Cube V2.0 共通アイコン。
 * 気象庁の最新コードだけを入力に使い、旧配布SVGは表示に使用しない。
 */
(function (global) {
  'use strict';

  var FALLBACK_FILE = '100';

  var PRESENT_FILES = {
    '100': 1, '101': 1, '102': 1, '104': 1, '110': 1, '112': 1, '115': 1,
    '200': 1, '201': 1, '202': 1, '204': 1, '210': 1, '212': 1, '215': 1,
    '300': 1, '301': 1, '302': 1, '303': 1, '308': 1, '311': 1, '313': 1, '314': 1,
    '400': 1, '401': 1, '402': 1, '403': 1, '406': 1, '411': 1, '413': 1, '414': 1
  };

  var ALIAS = {
    '103': '102', '105': '104', '106': '102', '107': '102', '108': '102',
    '111': '110', '113': '112', '114': '112', '116': '115', '117': '115',
    '118': '112', '119': '112', '120': '102', '121': '102', '122': '112',
    '123': '100', '124': '100', '125': '112', '126': '112', '127': '112',
    '128': '112', '130': '100', '131': '100', '132': '101', '140': '102',
    '160': '104', '170': '104', '181': '115',
    '203': '202', '205': '204', '206': '202', '207': '202', '208': '202',
    '209': '200', '211': '210', '213': '212', '214': '212', '216': '215',
    '217': '215', '218': '212', '219': '212', '220': '202', '221': '202',
    '222': '212', '223': '201', '224': '212', '225': '212', '226': '212',
    '228': '215', '229': '215', '230': '215', '231': '200', '240': '202',
    '250': '204', '260': '204', '270': '204', '281': '215',
    '304': '300', '306': '300', '309': '303', '315': '314', '316': '311',
    '317': '313', '320': '311', '321': '313', '322': '303', '323': '311',
    '324': '311', '325': '311', '326': '314', '327': '314', '328': '300',
    '329': '300', '340': '400', '350': '300', '361': '411', '371': '413',
    '405': '400', '407': '406', '409': '403',
    '420': '411', '421': '413', '422': '414', '423': '414', '425': '400',
    '426': '400', '427': '400', '450': '400'
  };

  var unknownLogged_ = {};

  function pad(code) {
    var s = String(code == null ? '' : code).trim();
    if (!/^\d{1,3}$/.test(s)) return '';
    return s.padStart(3, '0');
  }

  function resolveFile(code) {
    var c = pad(code);
    if (!c) return { file: FALLBACK_FILE, unknown: true, code: String(code == null ? '' : code) };
    var mapped = ALIAS[c] || c;
    if (PRESENT_FILES[mapped]) return { file: mapped, unknown: false, code: c };
    return { file: FALLBACK_FILE, unknown: true, code: c };
  }

  function href(code, logUnknown) {
    var r = resolveFile(code);
    if (r.unknown && logUnknown !== false && !unknownLogged_[r.code]) {
      unknownLogged_[r.code] = true;
      if (global.AlertCubeLog) {
        global.AlertCubeLog.warn('weather-code', 'unknown weather code → fallback 100', { code: r.code });
      }
    }
    return svgDataUrl(r.file);
  }

  var KIND_BY_FILE = {
    '100': 'clear', '101': 'partly', '102': 'showers', '104': 'sunSnow',
    '110': 'partly', '112': 'showers', '115': 'sunSnow',
    '200': 'cloud', '201': 'partly', '202': 'rain', '204': 'snow',
    '210': 'partly', '212': 'rain', '215': 'snow',
    '300': 'rain', '301': 'showers', '302': 'rain', '303': 'sleet',
    '308': 'storm', '311': 'showers', '313': 'rain', '314': 'sleet',
    '400': 'snow', '401': 'sunSnow', '402': 'snow', '403': 'heavySnow',
    '406': 'heavySnow', '411': 'sunSnow', '413': 'snow', '414': 'heavySnow'
  };

  function cloud_(dark) {
    var fill = dark ? '#64748B' : '#E8EEF5';
    var stroke = dark ? '#334155' : '#7C8CA0';
    return '<path d="M28 65h47c10 0 17-7 17-16s-7-16-17-16c-3-11-12-18-24-18-13 0-23 9-25 21-10 1-18 8-18 17 0 7 7 12 20 12Z" fill="' + fill + '" stroke="' + stroke + '" stroke-width="4" stroke-linejoin="round"/>';
  }

  function sun_() {
    return '<g fill="none" stroke="#F59E0B" stroke-width="5" stroke-linecap="round">' +
      '<path d="M31 9v8M31 55v8M5 36h8M49 36h8M12 17l6 6M44 49l6 6M50 17l-6 6M18 49l-6 6"/>' +
      '</g><circle cx="31" cy="36" r="13" fill="#FFD54A" stroke="#F59E0B" stroke-width="4"/>';
  }

  function rain_(heavy) {
    var drops = heavy
      ? '<path d="M24 73l-5 12M42 73l-5 12M60 73l-5 12M78 73l-5 12" />'
      : '<path d="M31 73l-5 11M53 73l-5 11M75 73l-5 11" />';
    return '<g fill="none" stroke="#1687D9" stroke-width="5" stroke-linecap="round">' + drops + '</g>';
  }

  function snow_(heavy) {
    var marks = heavy
      ? [[24,78],[43,72],[62,80],[80,72]]
      : [[32,77],[55,72],[76,79]];
    return marks.map(function (p) {
      return '<g stroke="#42BCEB" stroke-width="3" stroke-linecap="round">' +
        '<path d="M' + (p[0] - 5) + ' ' + p[1] + 'h10M' + p[0] + ' ' + (p[1] - 5) + 'v10' +
        'M' + (p[0] - 4) + ' ' + (p[1] - 4) + 'l8 8M' + (p[0] + 4) + ' ' + (p[1] - 4) + 'l-8 8"/></g>';
    }).join('');
  }

  function svgMarkup(kind) {
    var body = '';
    if (kind === 'clear') body = '<g transform="translate(19 12)">' + sun_() + '</g>';
    else if (kind === 'partly') body = sun_() + '<g transform="translate(8 12) scale(.88)">' + cloud_(false) + '</g>';
    else if (kind === 'showers') body = sun_() + '<g transform="translate(7 10) scale(.9)">' + cloud_(false) + '</g>' + rain_(false);
    else if (kind === 'sunSnow') body = sun_() + '<g transform="translate(7 10) scale(.9)">' + cloud_(false) + '</g>' + snow_(false);
    else if (kind === 'cloud') body = cloud_(false);
    else if (kind === 'rain') body = cloud_(false) + rain_(false);
    else if (kind === 'snow') body = cloud_(false) + snow_(false);
    else if (kind === 'sleet') body = cloud_(false) + rain_(false) + snow_(false);
    else if (kind === 'storm') body = cloud_(true) + rain_(true) + '<path d="M52 61 42 77h10l-5 14 18-22H55l7-8Z" fill="#FFD54A" stroke="#B7791F" stroke-width="2"/>';
    else if (kind === 'heavySnow') body = cloud_(true) + snow_(true);
    else body = sun_();
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-hidden="true">' + body + '</svg>';
  }

  var dataUrlCache_ = {};
  function svgDataUrl(code) {
    var r = resolveFile(code);
    var kind = KIND_BY_FILE[r.file] || 'clear';
    if (!dataUrlCache_[kind]) {
      dataUrlCache_[kind] = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgMarkup(kind));
    }
    return dataUrlCache_[kind];
  }

  var api = {
    PRESENT_FILES: PRESENT_FILES,
    ALIAS: ALIAS,
    FALLBACK_FILE: FALLBACK_FILE,
    pad: pad,
    resolveFile: resolveFile,
    href: href,
    svgDataUrl: svgDataUrl,
    kind: function (code) {
      var r = resolveFile(code);
      return KIND_BY_FILE[r.file] || 'clear';
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeWeatherIcons = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
