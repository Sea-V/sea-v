// /js/navigation-state.js
(function () {
  "use strict";
  window.SeavNavigationState = {
    map: null,
    pathLayer: null,
    pointLayer: null,
    workingLayer: null,
    activeVesselFilter: "",
    resizeTimer: null,
    mapReady: false,
    pendingMapRefresh: false,
    refreshMapPromise: null,
    resizeListenerBound: false,
    userAdjustedView: false,
    initialBoundsFit: false,
    formBound: false,
    formWaypoints: [],
    formEndpointCoords: { from: null, to: null },
    pickMode: false,
    endpointPickRole: null,
    workingRouteToken: 0
  };
})();
