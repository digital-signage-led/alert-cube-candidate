(function (global) {
  'use strict';
  global.AlertCubeContentPollen = {
    id: 'pollen',
    existing: false,
    shouldLoad: function () { return false; }
  };
})(typeof window !== 'undefined' ? window : this);
