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

  const VESSEL_COLORS = [
    "#2563eb", // ocean blue
    "#dc2626", // port red
    "#16a34a", // starboard green
    "#9333ea", // royal purple
    "#ea580c", // sunset orange
    "#0891b2", // deep cyan
    "#be123c", // raspberry
    "#4f46e5", // indigo
    "#0f766e", // teal
    "#b45309", // amber brown
    "#7c3aed", // violet
    "#0284c7", // sky blue
    "#65a30d", // olive
    "#c026d3", // magenta
    "#b91c1c", // deep red
    "#0369a1" // harbour blue
  ];

  let map = null;
  let pathLayer = null;
  let pointLayer = null;
  let workingLayer = null;
  let activeVesselFilter = "";
  let resizeTimer = null;
  let mapReady = false;
  let pendingMapRefresh = false;
  let refreshMapPromise = null;

  let formWaypoints = [];
  let formEndpointCoords = { from: null, to: null };
  let pickMode = false;
  let endpointPickRole = null;
  let workingRouteToken = 0;

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

  function getVesselColor(vesselId) {
    if (!vesselId) return "#64748b";

    const vessels = [...getVessels()].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""))
    );
    const index = vessels.findIndex((v) => v.id === vesselId);
    if (index >= 0) return VESSEL_COLORS[index % VESSEL_COLORS.length];

    let hash = 0;
    for (let i = 0; i < vesselId.length; i += 1) {
      hash = vesselId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return VESSEL_COLORS[Math.abs(hash) % VESSEL_COLORS.length];
  }

  async function loadNavEntries() {
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

    return {
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
    };
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

  function haversineNm(lat1, lng1, lat2, lng2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const earthRadiusNm = 3440.065;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * earthRadiusNm * Math.asin(Math.sqrt(a));
  }

  function formatNm(value) {
    const miles = Number(value || 0);
    if (miles >= 1000) return `${Math.round(miles).toLocaleString()} NM`;
    if (miles >= 100) return `${Math.round(miles)} NM`;
    return `${Math.round(miles * 10) / 10} NM`;
  }

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

  function pathLengthNm(coords) {
    let total = 0;
    for (let i = 1; i < coords.length; i += 1) {
      total += haversineNm(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
    }
    return total;
  }


  window.SeavNavigationHelpers = {
    STORAGE_KEY, MAP_TILE_URL, MAP_TILE_ATTRIBUTION, MAP_DEFAULT_VIEW,
    getPortList, getCountryList, getCountryGeoNames, roundCoord,
    getVessels, getSeatimes, getVesselName, getVesselColor, loadNavEntries,
    hasCoord, normalizeWaypointList, normalizeNavEntry, normalizeText, findPort,
    haversineNm, formatNm, formatRouteLabel, entryHasRoute, pathLengthNm
  };
})();
