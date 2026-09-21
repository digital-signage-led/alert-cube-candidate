(function (global) {
  'use strict';
  global.AlertCubeContentWarning = {
    id: 'warning',
    shouldLoad: function () { return !global.AlertCubeContent || global.AlertCubeContent.isOn('warning'); }
  };
})(typeof window !== 'undefined' ? window : this);
