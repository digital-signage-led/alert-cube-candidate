(function (global) {
  'use strict';
  global.AlertCubeContentRain = {
    id: 'rain',
    shouldLoad: function () { return !global.AlertCubeContent || global.AlertCubeContent.isOn('rain'); }
  };
})(typeof window !== 'undefined' ? window : this);
