(function (global) {
  'use strict';
  function should() {
    return !global.AlertCubeContent || global.AlertCubeContent.isOn('disaster') || global.AlertCubeContent.isOn('warning');
  }
  var api = { should: should };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeServiceDisaster = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
