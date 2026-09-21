(function (global) {
  'use strict';
  global.AlertCubeContentForecast = {
    id: 'forecast',
    shouldLoad: function () { return !global.AlertCubeContent || global.AlertCubeContent.isOn('forecast'); }
  };
})(typeof window !== 'undefined' ? window : this);
