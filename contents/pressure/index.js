(function (global) {
  'use strict';
  global.AlertCubeContentPressure = {
    id: 'pressure',
    shouldLoad: function () { return !global.AlertCubeContent || global.AlertCubeContent.isOn('pressure'); }
  };
})(typeof window !== 'undefined' ? window : this);
