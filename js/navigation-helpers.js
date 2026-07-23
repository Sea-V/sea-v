// /js/navigation-helpers.js
(function () {
  "use strict";
  // window.SeavState is optional here (every use below already guards it with
  // ?.) — the public profile page loads this file too (for routed navigation
  // distance via SeavNavigationPassage) but never loads js/state.js, since it
  // has no live editable state, only read-only public data.
  if (!window.Seav || !window.SeavAPI || !window.SeavData) return;
  const STORAGE_KEY = window.SeavData.KEYS.NAVIGATION_AREAS;
  const MAP_TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  const MAP_TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
  const MAP_DEFAULT_VIEW = { lat: 30, lng: 0, zoom: 2 };

  function getPortList() {
    return window.SeavNavigationPorts?.PORTS || [];
  }

  function getCountryList() {
    const listed = window.SeavNavigationPorts?.COUNTRIES;
    if (Array.isArray(listed) && listed.length) return listed;
    return [...new Set(getPortList().map((item) => item.country))].sort();
  }

  function getCountryIsoNumeric() {
    return window.SeavNavigationPorts?.COUNTRY_ISO_NUMERIC || {};
  }

  // Fallback only (used if js/seav-data.js somehow isn't loaded) — keep this
  // in sync with the canonical VESSEL_COLORS in seav-data.js.
  const VESSEL_COLORS = window.SeavData?.VESSEL_COLORS || [
    "#2f70b1", "#b12f4a", "#2fb13a", "#602fb1", "#b1862f", "#2fb1ac",
    "#b12f91", "#6bb12f", "#2f45b1", "#b1402f", "#2fb166", "#8c2fb1",
    "#b1b12f"
  ];

  function getVesselColor(vesselId) {
    if (window.SeavData?.getVesselColor) {
      return window.SeavData.getVesselColor(vesselId);
    }
    if (!vesselId) return "#64748b";

    let hash = 0;
    for (let i = 0; i < vesselId.length; i += 1) {
      hash = vesselId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return VESSEL_COLORS[Math.abs(hash) % VESSEL_COLORS.length];
  }

  function roundCoord(value) {
    return Math.round(Number(value) * 10000) / 10000;
  }

  function getVessels() {
    return window.SeavState?.vessels || [];
  }

  function getSeatimes() {
    return window.SeavState?.seatimes || [];
  }

  function getVesselName(vesselId) {
    if (!vesselId) return "Unassigned";
    return getVessels().find((v) => v.id === vesselId)?.name || "Unnamed vessel";
  }

  async function loadNavEntries() {
    if (window.SeavState?.ready) {
      return (window.SeavState.navigationAreas || []).map(normalizeNavEntry);
    }

    try {
      const raw = await SeavAPI.getArray(STORAGE_KEY);
      return raw.map(normalizeNavEntry);
    } catch (error) {
      console.warn("[SEA-V] Navigation fetch failed, using cached state:", error);
      return (window.SeavState?.navigationAreas || []).map(normalizeNavEntry);
    }
  }

  function hasCoord(lat, lng) {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    return Number.isFinite(latNum) && Number.isFinite(lngNum) && !(latNum === 0 && lngNum === 0);
  }

  function normalizeWaypointList(value) {
    if (!Array.isArray(value)) return [];
    return value
      .map((wp) => ({
        lat: Number(wp?.lat),
        lng: Number(wp?.lng),
        label: wp?.label ? String(wp.label) : ""
      }))
      .filter((wp) => Number.isFinite(wp.lat) && Number.isFinite(wp.lng));
  }

  function normalizeNavEntry(entry) {
    const toCountry = entry.toCountry || entry.country || "";
    const toPort = entry.toPort || entry.port || "";
    const toLat = Number(entry.toLat ?? entry.lat ?? 0);
    const toLng = Number(entry.toLng ?? entry.lng ?? 0);
    const fromCountry = entry.fromCountry || "";
    const fromPort = entry.fromPort || "";
    const fromLat = Number(entry.fromLat || 0);
    const fromLng = Number(entry.fromLng || 0);

    const departureDate = entry.departureDate || entry.visitedDate || "";
    const arrivalDate = entry.arrivalDate || "";

    return resolveNavEntryCoords({
      ...entry,
      passageName: entry.passageName || "",
      seatimeId: entry.seatimeId || "",
      fromCountry,
      fromPort,
      fromLat,
      fromLng,
      toCountry,
      toPort,
      toLat,
      toLng,
      departureDate,
      arrivalDate,
      visitedDate: entry.visitedDate || departureDate || arrivalDate || "",
      waypoints: normalizeWaypointList(entry.waypoints),
      isTidal: !!entry.isTidal,
      country: toCountry,
      port: toPort,
      lat: toLat,
      lng: toLng
    });
  }

  function normalizeText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function findPort(country, port) {
    return getPortList().find(
      (item) =>
        normalizeText(item.country) === normalizeText(country) &&
        normalizeText(item.port) === normalizeText(port)
    );
  }

  function lookupPortByName(name, country = "") {
    const trimmed = String(name || "").trim();
    if (!trimmed) return null;

    if (country) {
      const exact = findPort(country, trimmed);
      if (exact) return exact;
    }

    return (
      getPortList().find((item) => normalizeText(item.port) === normalizeText(trimmed)) || null
    );
  }

  function resolveNavEntryCoords(entry) {
    const resolved = { ...entry };

    if (!hasCoord(resolved.fromLat, resolved.fromLng) && resolved.fromPort) {
      const found = lookupPortByName(resolved.fromPort, resolved.fromCountry);
      if (found) {
        resolved.fromLat = found.lat;
        resolved.fromLng = found.lng;
        if (!resolved.fromCountry) resolved.fromCountry = found.country;
      }
    }

    if (!hasCoord(resolved.toLat, resolved.toLng) && resolved.toPort) {
      const found = lookupPortByName(resolved.toPort, resolved.toCountry);
      if (found) {
        resolved.toLat = found.lat;
        resolved.toLng = found.lng;
        if (!resolved.toCountry) resolved.toCountry = found.country;
      }
    }

    // Some legacy/free-text entries already have lat/lng (e.g. resolved via a
    // geocoder when the port was typed) but never got a country saved. The
    // coord-backfill branches above skip these since hasCoord() is already
    // true, so country would otherwise stay blank forever and the entry
    // would silently drop out of the country-highlight map. Always try a
    // name-only port lookup for country, independent of coord state.
    if (!resolved.fromCountry && resolved.fromPort) {
      const found = lookupPortByName(resolved.fromPort);
      if (found) resolved.fromCountry = found.country;
    }

    if (!resolved.toCountry && resolved.toPort) {
      const found = lookupPortByName(resolved.toPort);
      if (found) resolved.toCountry = found.country;
    }

    return resolved;
  }

  const haversineNm = window.SeavData.haversineNm;
  const formatNm = window.SeavData.formatNm;

  function formatRouteLabel(entry) {
    const from = entry.fromPort
      ? `${entry.fromPort}${entry.fromCountry ? `, ${entry.fromCountry}` : ""}`
      : "";
    const to = entry.toPort
      ? `${entry.toPort}${entry.toCountry ? `, ${entry.toCountry}` : ""}`
      : "";

    if (from && to) return `${from} → ${to}`;
    if (to) return to;
    if (from) return from;
    return "Passage";
  }

  function entryHasRoute(entry) {
    const hasWaypoints = normalizeWaypointList(entry.waypoints).length > 0;
    return (
      hasCoord(entry.fromLat, entry.fromLng) &&
      hasCoord(entry.toLat, entry.toLng) &&
      (hasWaypoints || entry.fromLat !== entry.toLat || entry.fromLng !== entry.toLng)
    );
  }

  const pathLengthNm = window.SeavData.pathLengthNm;

  window.SeavNavigationHelpers = {
    STORAGE_KEY, MAP_TILE_URL, MAP_TILE_ATTRIBUTION, MAP_DEFAULT_VIEW,
    getPortList, getCountryList, getCountryIsoNumeric, roundCoord,
    getVessels, getSeatimes, getVesselName, getVesselColor, loadNavEntries,
    hasCoord, normalizeWaypointList, normalizeNavEntry, normalizeText, findPort,
    lookupPortByName, resolveNavEntryCoords,
    haversineNm, formatNm, formatRouteLabel, entryHasRoute, pathLengthNm
  };
})();
