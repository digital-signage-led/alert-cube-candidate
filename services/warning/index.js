(function (global) {
  'use strict';
  function should() {
    return !global.AlertCubeContent || global.AlertCubeContent.shouldFetch('jma-warning');
  }
  var api = { should: should };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeServiceWarning = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
