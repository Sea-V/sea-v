// /js/navigation-helpers.js
(function () {
  "use strict";
  if (!window.Seav || !window.SeavAPI || !window.SeavState || !window.SeavData) return;
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

  function getCountryGeoNames() {
    return window.SeavNavigationPorts?.COUNTRY_GEO_NAMES || {};
  }

  const VESSEL_COLORS = window.SeavData?.VESSEL_COLORS || [
    "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2",
    "#be123c", "#4f46e5", "#0f766e", "#b45309", "#7c3aed", "#0284c7",
    "#65a30d", "#c026d3", "#b91c1c", "#0369a1"
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
    getPortList, getCountryList, getCountryGeoNames, roundCoord,
    getVessels, getSeatimes, getVesselName, getVesselColor, loadNavEntries,
    hasCoord, normalizeWaypointList, normalizeNavEntry, normalizeText, findPort,
    lookupPortByName, resolveNavEntryCoords,
    haversineNm, formatNm, formatRouteLabel, entryHasRoute, pathLengthNm
  };
})();
