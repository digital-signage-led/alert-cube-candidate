(function (global) {
  'use strict';
  global.AlertCubeContentWbgt = {
    id: 'wbgt',
    shouldLoad: function () { return !global.AlertCubeContent || global.AlertCubeContent.isOn('wbgt'); }
  };
})(typeof window !== 'undefined' ? window : this);
