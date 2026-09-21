(function (global) {
  'use strict';
  global.AlertCubeContentWind = {
    id: 'wind',
    shouldLoad: function () { return !global.AlertCubeContent || global.AlertCubeContent.isOn('wind'); }
  };
})(typeof window !== 'undefined' ? window : this);
