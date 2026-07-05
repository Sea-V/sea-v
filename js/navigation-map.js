// /js/navigation-map.js
(function () {
  "use strict";
  const H = window.SeavNavigationHelpers;
  const P = window.SeavNavigationPassage;
  const S = window.SeavNavigationState;
  if (!H || !P || !S || !window.Seav) return;

  const Seav = window.Seav;
  const {
    getVesselColor, getVesselName, getVessels, loadNavEntries, hasCoord,
    formatNm, entryHasRoute, buildPassagePaths,
    roundCoord
  } = { ...H, buildPassagePaths: P.buildPassagePaths };
  const { MAP_TILE_URL, MAP_TILE_ATTRIBUTION, MAP_DEFAULT_VIEW } = H;

  function filterEntries(entries) {
    if (!S.activeVesselFilter) return entries;
    return entries.filter((entry) => entry.vesselId === S.activeVesselFilter);
  }

  function buildEndpointMarker(coord, role, options = {}) {
    const isStart = role === "departure" || role === "from";
    const marker = L.marker([coord.lat, coord.lng], {
      draggable: !!options.draggable,
      keyboard: false,
      icon: L.divIcon({
        className: `nav-endpoint-marker ${isStart ? "nav-start-marker" : "nav-finish-marker"}`,
        html: `<span>${isStart ? "S" : "F"}</span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      })
    });

    if (options.draggable && typeof options.onDrag === "function") {
      marker.on("dragend", () => {
        options.onDrag(marker.getLatLng());
      });
    }

    marker.bindTooltip(isStart ? "Departure start point" : "Arrival finish point", {
      direction: "top"
    });
    return marker;
  }

  function buildWaypointMarker(wp, index, options = {}) {
    const marker = L.marker([wp.lat, wp.lng], {
      draggable: !!options.draggable,
      keyboard: false,
      icon: L.divIcon({
        className: "nav-waypoint-marker",
        html: `<span>${index + 1}</span>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })
    });

    if (options.draggable && typeof options.onDrag === "function") {
      marker.on("dragend", () => {
        options.onDrag(marker.getLatLng());
      });
    }

    const label = wp.label ? `${index + 1}: ${wp.label}` : `Waypoint ${index + 1}`;
    marker.bindTooltip(label, { direction: "top" });
    return marker;
  }

  function buildSavedTrackLine(path) {
    const latlngs = (path.coords || []).map((point) => [point[0], point[1]]);
    if (latlngs.length < 2) return null;

    const color = path.color || getVesselColor(path.vesselId);
    const baseOpacity = 0.92;

    const halo = L.polyline(latlngs, {
      color: "#ffffff",
      weight: 7,
      opacity: 0.16,
      lineJoin: "round",
      lineCap: "round",
      interactive: false
    });

    const line = L.polyline(latlngs, {
      color,
      weight: 4,
      opacity: baseOpacity,
      lineJoin: "round",
      lineCap: "round"
    });

    line.bindPopup(buildPathPopup(path));
    line.bindTooltip(
      `${Seav.escapeHtml(getVesselName(path.vesselId))}: ${Seav.escapeHtml(path.fromPort || "")} → ${Seav.escapeHtml(path.toPort || "")}`,
      { sticky: true }
    );

    line.on("mouseover", () => {
      line.setStyle({ weight: 5.5, opacity: 1 });
    });
    line.on("mouseout", () => {
      line.setStyle({ weight: 4, opacity: baseOpacity });
    });

    return L.layerGroup([halo, line]);
  }

  function renderVesselLegend(entries) {
    const legend = document.getElementById("navVesselLegend");
    if (!legend) return;

    const vessels = new Map();
    entries.filter(entryHasRoute).forEach((entry) => {
      if (!entry.vesselId || vessels.has(entry.vesselId)) return;
      vessels.set(entry.vesselId, {
        id: entry.vesselId,
        name: getVesselName(entry.vesselId),
        color: getVesselColor(entry.vesselId)
      });
    });

    const sortedIds = (window.SeavData?.getSortedVesselOptions?.(getVessels()) || []).map(
      (v) => v.id
    );
    const rows = [...vessels.values()].sort((a, b) => {
      const ai = sortedIds.indexOf(a.id);
      const bi = sortedIds.indexOf(b.id);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.name.localeCompare(b.name);
    });
    if (!rows.length) {
      legend.innerHTML = "";
      legend.hidden = true;
      return;
    }

    legend.hidden = false;
    legend.innerHTML = rows
      .map(
        (vessel) => `
          <span class="navigation-vessel-legend-item">
            <i style="background:${Seav.escapeHtml(vessel.color)}"></i>
            <span>${Seav.escapeHtml(vessel.name)}</span>
          </span>
        `
      )
      .join("");
  }

  function buildMapPoints(entries) {
    const points = [];
    const seen = new Set();

    function addPoint(lat, lng, entry, role, label) {
      if (!hasCoord(lat, lng)) return;
      const key = `${lat.toFixed(4)}|${lng.toFixed(4)}|${role}`;
      if (seen.has(key)) return;
      seen.add(key);

      points.push({
        lat,
        lng,
        color: getVesselColor(entry.vesselId),
        entry,
        role,
        label
      });
    }

    entries.forEach((entry) => {
      addPoint(
        entry.fromLat,
        entry.fromLng,
        entry,
        "departure",
        `${entry.fromPort || "Departure"}${entry.fromCountry ? `, ${entry.fromCountry}` : ""}`
      );
      addPoint(
        entry.toLat,
        entry.toLng,
        entry,
        "arrival",
        `${entry.toPort || "Arrival"}${entry.toCountry ? `, ${entry.toCountry}` : ""}`
      );
    });

    return points;
  }

  function collectVisitedCountries(entries) {
    const countries = new Set();
    entries.forEach((entry) => {
      if (entry.fromCountry) countries.add(entry.fromCountry);
      if (entry.toCountry) countries.add(entry.toCountry);
    });
    return countries;
  }

  function buildNavigationStats(entries, paths) {
    const countries = collectVisitedCountries(entries);
    const ports = new Set();

    entries.forEach((entry) => {
      if (entry.fromCountry && entry.fromPort) {
        ports.add(`${entry.fromCountry}|${entry.fromPort}`);
      }
      if (entry.toCountry && entry.toPort) {
        ports.add(`${entry.toCountry}|${entry.toPort}`);
      }
    });

    const totalNm = paths.reduce((sum, path) => sum + Number(path.distanceNm || 0), 0);

    return {
      countries: countries.size,
      ports: ports.size,
      passages: paths.length,
      totalNm
    };
  }

  function renderStats(stats) {
    const countriesEl = document.getElementById("navStatCountries");
    const portsEl = document.getElementById("navStatPorts");
    const passagesEl = document.getElementById("navStatPassages");
    const milesEl = document.getElementById("navStatMiles");

    if (countriesEl) countriesEl.textContent = String(stats.countries);
    if (portsEl) portsEl.textContent = String(stats.ports);
    if (passagesEl) passagesEl.textContent = String(stats.passages);
    if (milesEl) milesEl.textContent = formatNm(stats.totalNm);
  }

  function fitMapToData(paths, points, options = {}) {
    if (!S.map) return;
    if (options.skipIfUserView && S.userAdjustedView) return;

    const coords = [];
    paths.forEach((path) => {
      (path.coords || []).forEach((point) => coords.push([point[0], point[1]]));
    });
    points.forEach((point) => coords.push([point.lat, point.lng]));

    if (!coords.length) return;

    try {
      const bounds = L.latLngBounds(coords);
      S.map.fitBounds(bounds, { padding: [44, 44], maxZoom: 9, animate: true });
    } catch (error) {
      console.warn("[SEA-V] Could not fit S.map bounds:", error);
    }
  }

  function formatDateRange(fromDate, toDate) {
    if (fromDate && toDate) return `${fromDate} → ${toDate}`;
    return fromDate || toDate || "";
  }

  function buildPathPopup(path) {
    const vessel = path.vesselName || "Vessel";
    const route = `${path.fromPort || "Departure"} → ${path.toPort || "Arrival"}`;
    const dates = formatDateRange(path.departureDate, path.arrivalDate);
    const lines = [
      path.passageName ? `<strong>${Seav.escapeHtml(path.passageName)}</strong>` : "",
      `<strong>${Seav.escapeHtml(vessel)}</strong>`,
      Seav.escapeHtml(route),
      dates ? Seav.escapeHtml(dates) : "",
      Seav.escapeHtml(formatNm(path.distanceNm))
    ].filter(Boolean);
    return `<div class="nav-map-popup">${lines.join("<br/>")}</div>`;
  }

  function buildPointPopup(point) {
    const entry = point.entry;
    const vesselName = getVesselName(entry.vesselId);
    const roleLabel =
      point.role === "departure"
        ? "Departure"
        : point.role === "arrival"
          ? "Arrival"
          : "Waypoint";
    const roleDate =
      point.role === "departure"
        ? entry.departureDate || entry.visitedDate || ""
        : point.role === "arrival"
          ? entry.arrivalDate || ""
          : "";
    const lines = [
      `<strong>${Seav.escapeHtml(roleLabel)}</strong>`,
      Seav.escapeHtml(point.label || ""),
      Seav.escapeHtml(vesselName),
      Seav.escapeHtml(roleDate),
      Seav.escapeHtml(entry.operationType || "")
    ].filter(Boolean);
    return `<div class="nav-map-popup">${lines.join("<br/>")}</div>`;
  }

  async function refreshMap() {
    if (!S.map) {
      S.pendingMapRefresh = true;
      return;
    }

    if (S.refreshMapPromise) return S.refreshMapPromise;

    S.refreshMapPromise = (async () => {
      const entries = filterEntries(await loadNavEntries());
      const paths = await buildPassagePaths(entries);
      const stats = buildNavigationStats(entries, paths);

      renderStats(stats);
      try {
        renderVesselLegend(entries);
      } catch (legendError) {
        console.warn("[SEA-V] Vessel legend render failed:", legendError);
      }

      if (S.pathLayer) S.pathLayer.clearLayers();
      if (S.pointLayer) S.pointLayer.clearLayers();

      paths.forEach((path) => {
        const track = buildSavedTrackLine(path);
        if (track) S.pathLayer.addLayer(track);
      });

      if (paths.length && !S.userAdjustedView && !S.initialBoundsFit) {
        fitMapToData(paths, []);
        S.initialBoundsFit = true;
      } else if (paths.length && S.activeVesselFilter) {
        fitMapToData(paths, [], { skipIfUserView: false });
      }
    })()
      .catch((error) => {
        console.warn("[SEA-V] Map refresh failed:", error);
      })
      .finally(() => {
        S.refreshMapPromise = null;
      });

    return S.refreshMapPromise;
  }

  function initNavigationMap() {
    const container = document.getElementById("navMap");
    if (!container || typeof L === "undefined") {
      console.warn("[SEA-V] Leaflet not available.");
      return;
    }

    if (S.map) {
      window.setTimeout(() => S.map.invalidateSize(), 100);
      return;
    }

    const mapMaxBounds = L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180));

    S.map = L.map(container, {
      center: [MAP_DEFAULT_VIEW.lat, MAP_DEFAULT_VIEW.lng],
      zoom: MAP_DEFAULT_VIEW.zoom,
      minZoom: 2,
      maxBounds: mapMaxBounds,
      maxBoundsViscosity: 1,
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true
    });

    L.tileLayer(MAP_TILE_URL, {
      attribution: MAP_TILE_ATTRIBUTION,
      subdomains: "abcd",
      maxZoom: 18,
      noWrap: true,
      bounds: mapMaxBounds,
      keepBuffer: 2,
      updateWhenIdle: true
    }).addTo(S.map);

    S.pathLayer = L.layerGroup().addTo(S.map);
    S.pointLayer = L.layerGroup().addTo(S.map);
    S.workingLayer = L.layerGroup().addTo(S.map);

    S.mapReady = true;

    S.map.on("dragend zoomend", () => {
      S.userAdjustedView = true;
    });

    S.map.on("click", (event) => {
      const form = window.SeavNavigationForm;
      if (S.endpointPickRole) {
        S.formEndpointCoords[S.endpointPickRole] = {
          lat: roundCoord(event.latlng.lat),
          lng: roundCoord(event.latlng.lng)
        };
        form?.renderEndpointStatus?.();
        form?.renderWorkingRoute?.();
        form?.setEndpointPickMode?.(null);
        return;
      }

      if (!S.pickMode) return;
      form?.addWaypoint?.(event.latlng.lat, event.latlng.lng);
    });

    window.setTimeout(() => {
      if (S.map) S.map.invalidateSize();
    }, 200);

    if (S.pendingMapRefresh) {
      S.pendingMapRefresh = false;
      refreshMap().catch((error) => {
        console.warn("[SEA-V] Pending map refresh failed:", error);
      });
    }

    if (!S.resizeListenerBound) {
      S.resizeListenerBound = true;
      window.addEventListener("resize", () => {
        if (!S.map) return;
        window.clearTimeout(S.resizeTimer);
        S.resizeTimer = window.setTimeout(() => S.map.invalidateSize(), 150);
      });
    }
  }


  window.SeavNavigationMap = {
    filterEntries, buildMapPoints, collectVisitedCountries, buildNavigationStats,
    renderStats, renderVesselLegend, fitMapToData, formatDateRange, buildPathPopup, buildPointPopup,
    buildEndpointMarker, buildWaypointMarker, buildSavedTrackLine,
    refreshMap, initNavigationMap
  };
})();
