/**
 * 気象庁 TELOPS 天気コード → 共有アイコン。
 * 実在 SVG は images/jma-icons/ の30種。無い番号は実在ファイルへ寄せる。
 * 未知コードは 100（晴れ）へ Fallback し、JS は止めない。
 */
(function (global) {
  'use strict';

  var ICON_DIR = 'images/jma-icons/';
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
    return ICON_DIR + r.file + '.svg';
  }

  var api = {
    PRESENT_FILES: PRESENT_FILES,
    ALIAS: ALIAS,
    FALLBACK_FILE: FALLBACK_FILE,
    pad: pad,
    resolveFile: resolveFile,
    href: href
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeWeatherIcons = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
