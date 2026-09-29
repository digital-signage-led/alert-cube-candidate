(function (global) {
  'use strict';
  function should() {
    return !global.AlertCubeContent || global.AlertCubeContent.isOn('hazard');
  }
  var api = { should: should };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AlertCubeServiceHazard = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
