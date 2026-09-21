(function (global) {
  'use strict';
  global.AlertCubeContentTyphoon = {
    id: 'typhoon',
    shouldLoad: function () { return !global.AlertCubeContent || global.AlertCubeContent.isOn('typhoon'); }
  };
})(typeof window !== 'undefined' ? window : this);
