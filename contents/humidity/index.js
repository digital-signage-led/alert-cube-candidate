(function (global) {
  'use strict';
  global.AlertCubeContentHumidity = {
    id: 'humidity',
    shouldLoad: function () { return !global.AlertCubeContent || global.AlertCubeContent.isOn('humidity'); }
  };
})(typeof window !== 'undefined' ? window : this);
