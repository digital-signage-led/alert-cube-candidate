(function (global) {
  'use strict';
  global.AlertCubeContentWeather = {
    id: 'weather',
    shouldLoad: function () { return !global.AlertCubeContent || global.AlertCubeContent.isOn('weather'); }
  };
})(typeof window !== 'undefined' ? window : this);
