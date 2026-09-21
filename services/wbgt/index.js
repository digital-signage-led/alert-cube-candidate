(function (global) {
  'use strict';
  function should() {
    return !global.AlertCubeContent || global.AlertCubeContent.shouldFetch('moe-wbgt') || global.AlertCubeContent.shouldFetch('moe-heat');
  }
  var api = { should: should };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeServiceWbgt = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
