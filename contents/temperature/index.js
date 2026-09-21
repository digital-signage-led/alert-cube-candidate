(function (global) {
  'use strict';
  global.AlertCubeContentTemperature = {
    id: 'temperature',
    shouldLoad: function () { return !global.AlertCubeContent || global.AlertCubeContent.isOn('temperature'); }
  };
})(typeof window !== 'undefined' ? window : this);
