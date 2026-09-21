(function (global) {
  'use strict';
  global.AlertCubeContentDisaster = {
    id: 'disaster',
    shouldLoad: function () { return !global.AlertCubeContent || global.AlertCubeContent.isOn('disaster'); }
  };
})(typeof window !== 'undefined' ? window : this);
