// /js/navigation.js
(function () {
  "use strict";

  if (!window.Seav || !window.SeavAPI || !window.SeavState || !window.SeavData) {
    console.warn("[SEA-V] Navigation dependencies missing.");
    return;
  }

  const STORAGE_KEY = window.SeavData.KEYS.NAVIGATION_AREAS;

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

  const MAP_TILE_URL =
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  const MAP_TILE_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
  const MAP_DEFAULT_VIEW = { lat: 30, lng: 0, zoom: 2 };

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

  async function buildLegRoute(a, b) {
    let coords = null;

    if (window.SeavNavigationRouting?.buildSeaRoute) {
      const leg = await window.SeavNavigationRouting.buildSeaRoute(a.lat, a.lng, b.lat, b.lng);
      if (leg?.coords?.length >= 2) {
        coords = leg.coords.map((point) => [point[0], point[1]]);
      }
    }

    if (!coords) {
      coords = [
        [a.lat, a.lng],
        [b.lat, b.lng]
      ];
    }

    // Guarantee the leg starts and ends exactly on its anchors, so manually
    // placed waypoints are always visited even if they sit far from a sea lane.
    const first = coords[0];
    if (!first || first[0] !== a.lat || first[1] !== a.lng) {
      coords.unshift([a.lat, a.lng]);
    }
    const last = coords[coords.length - 1];
    if (!last || last[0] !== b.lat || last[1] !== b.lng) {
      coords.push([b.lat, b.lng]);
    }

    return coords;
  }

  function interpolateGreatCircle(a, b, fraction) {
    const toRad = Math.PI / 180;
    const toDeg = 180 / Math.PI;
    const lat1 = a.lat * toRad;
    const lon1 = a.lng * toRad;
    const lat2 = b.lat * toRad;
    const lon2 = b.lng * toRad;

    const d =
      2 *
      Math.asin(
        Math.sqrt(
          Math.sin((lat2 - lat1) / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
        )
      );
    if (!d) return [a.lat, a.lng];

    const A = Math.sin((1 - fraction) * d) / Math.sin(d);
    const B = Math.sin(fraction * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lon = Math.atan2(y, x);
    return [lat * toDeg, lon * toDeg];
  }

  // A direct leg connects two anchors exactly, following the great-circle so the
  // line looks natural on the chart. Manually placed waypoints use this so the
  // course always passes through every point in order.
  function buildDirectLeg(a, b) {
    const distanceNm = haversineNm(a.lat, a.lng, b.lat, b.lng);
    const segments = Math.max(1, Math.min(64, Math.round(distanceNm / 120)));

    if (segments <= 1) {
      return [
        [a.lat, a.lng],
        [b.lat, b.lng]
      ];
    }

    const coords = [];
    for (let i = 0; i <= segments; i += 1) {
      coords.push(interpolateGreatCircle(a, b, i / segments));
    }
    coords[0] = [a.lat, a.lng];
    coords[coords.length - 1] = [b.lat, b.lng];
    return coords;
  }

  const RECOMMENDED_PASSAGE_POINTS = {
    azores: { lat: 37.7412, lng: -25.6756, label: "Recommended: Azores approach" },
    bermuda: { lat: 32.3078, lng: -64.7505, label: "Recommended: Bermuda approach" },
    canaries: { lat: 28.4636, lng: -16.2518, label: "Recommended: Canary Islands staging" },
    capeVerde: { lat: 16.886, lng: -24.997, label: "Recommended: Cape Verde staging" },
    gibraltar: { lat: 36.1408, lng: -5.3536, label: "Recommended: Gibraltar Strait" },
    antigua: { lat: 17.0119, lng: -61.7717, label: "Recommended: Antigua / Leewards" },
    barbados: { lat: 13.0975, lng: -59.6167, label: "Recommended: Barbados landfall" },
    stLucia: { lat: 14.0758, lng: -60.9497, label: "Recommended: St Lucia landfall" },
    bvi: { lat: 18.4286, lng: -64.6185, label: "Recommended: BVI cruising corridor" },
    puertoRico: { lat: 18.3258, lng: -65.6524, label: "Recommended: Puerto Rico / Mona approach" },
    turks: { lat: 21.7739, lng: -72.2658, label: "Recommended: Turks and Caicos passage" },
    bahamas: { lat: 25.0443, lng: -77.3504, label: "Recommended: Bahamas banks approach" },
    cayman: { lat: 19.2866, lng: -81.3744, label: "Recommended: Cayman Sea corridor" },
    jamaica: { lat: 18.1796, lng: -76.4503, label: "Recommended: Jamaica north coast" },
    roatan: { lat: 16.3, lng: -86.53, label: "Recommended: Bay Islands approach" },
    sanBlas: { lat: 9.5667, lng: -78.95, label: "Recommended: San Blas / Guna Yala" },
    shelterBay: { lat: 9.3697, lng: -79.9486, label: "Recommended: Panama Canal approach" },
    bocas: { lat: 9.3402, lng: -82.2417, label: "Recommended: Bocas del Toro" },
    cartagena: { lat: 10.391, lng: -75.4794, label: "Recommended: Cartagena approach" },
    santaMarta: { lat: 11.2408, lng: -74.199, label: "Recommended: Santa Marta approach" },
    limon: { lat: 9.9907, lng: -83.0359, label: "Recommended: Costa Rica Caribbean coast" },
    papagayo: { lat: 10.6286, lng: -85.6556, label: "Recommended: Papagayo approach" },
    quepos: { lat: 9.4316, lng: -84.1614, label: "Recommended: Quepos / central Pacific" },
    golfito: { lat: 8.6386, lng: -83.1631, label: "Recommended: Golfo Dulce approach" },
    balboa: { lat: 8.9824, lng: -79.5199, label: "Recommended: Balboa / Panama Pacific" },
    grenada: { lat: 12.0028, lng: -61.7639, label: "Recommended: Grenada / southern Caribbean" },
    trinidad: { lat: 10.6817, lng: -61.6358, label: "Recommended: Trinidad weather staging" }
  };

  const CARIBBEAN_COUNTRIES = new Set([
    "anguilla",
    "antigua and barbuda",
    "aruba",
    "bahamas",
    "barbados",
    "belize",
    "bonaire",
    "british virgin islands",
    "cayman islands",
    "colombia",
    "cuba",
    "curacao",
    "dominica",
    "dominican republic",
    "grenada",
    "guadeloupe",
    "haiti",
    "honduras",
    "jamaica",
    "martinique",
    "mexico",
    "montserrat",
    "panama",
    "puerto rico",
    "st barts",
    "st kitts and nevis",
    "st lucia",
    "st maarten",
    "st vincent and the grenadines",
    "trinidad and tobago",
    "turks and caicos",
    "venezuela",
    "virgin islands (us)"
  ]);

  const CENTRAL_AMERICA_COUNTRIES = new Set([
    "belize",
    "costa rica",
    "guatemala",
    "honduras",
    "nicaragua",
    "panama"
  ]);

  function countryKey(value) {
    return normalizeText(value);
  }

  function isCaribbeanCountry(country) {
    return CARIBBEAN_COUNTRIES.has(countryKey(country));
  }

  function isCentralAmericaCountry(country) {
    return CENTRAL_AMERICA_COUNTRIES.has(countryKey(country));
  }

  function isAtlanticEuropeOrMed(country, lng) {
    const key = countryKey(country);
    return (
      lng > -20 &&
      [
        "france",
        "gibraltar",
        "italy",
        "monaco",
        "montenegro",
        "morocco",
        "portugal",
        "spain",
        "uk"
      ].includes(key)
    );
  }

  function pointWithDistance(point, from, to) {
    const fromNm = haversineNm(from.lat, from.lng, point.lat, point.lng);
    const toNm = haversineNm(point.lat, point.lng, to.lat, to.lng);
    return { ...point, fromNm, toNm, totalViaNm: fromNm + toNm };
  }

  function dedupeRecommendedPoints(points) {
    const seen = new Set();
    return points.filter((point) => {
      const key = `${roundCoord(point.lat)}|${roundCoord(point.lng)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function sortAndFilterRecommended(points, from, to, { maxDetourRatio = 1.8 } = {}) {
    const directNm = Math.max(1, haversineNm(from.lat, from.lng, to.lat, to.lng));
    return dedupeRecommendedPoints(points)
      .map((point) => pointWithDistance(point, from, to))
      .filter((point) => point.fromNm > 20 && point.toNm > 20)
      .filter((point) => point.totalViaNm <= directNm * maxDetourRatio)
      .sort((a, b) => a.fromNm - b.fromNm)
      .map(({ fromNm, toNm, totalViaNm, ...point }) => point);
  }

  function buildRecommendedPassageWaypoints(from, to, fromMeta, toMeta) {
    const fromIsEurope = isAtlanticEuropeOrMed(fromMeta.country, from.lng);
    const toIsEurope = isAtlanticEuropeOrMed(toMeta.country, to.lng);
    const fromIsCaribbean = isCaribbeanCountry(fromMeta.country);
    const toIsCaribbean = isCaribbeanCountry(toMeta.country);
    const fromIsCentralAmerica = isCentralAmericaCountry(fromMeta.country);
    const toIsCentralAmerica = isCentralAmericaCountry(toMeta.country);
    const candidates = [];

    if (fromIsEurope && toIsCaribbean) {
      candidates.push(
        RECOMMENDED_PASSAGE_POINTS.gibraltar,
        RECOMMENDED_PASSAGE_POINTS.canaries,
        RECOMMENDED_PASSAGE_POINTS.capeVerde,
        RECOMMENDED_PASSAGE_POINTS.barbados,
        RECOMMENDED_PASSAGE_POINTS.stLucia
      );
    } else if (fromIsCaribbean && toIsEurope) {
      candidates.push(
        RECOMMENDED_PASSAGE_POINTS.bermuda,
        RECOMMENDED_PASSAGE_POINTS.azores,
        RECOMMENDED_PASSAGE_POINTS.gibraltar
      );
    }

    if ((fromIsCaribbean && toIsCaribbean) || fromIsCentralAmerica || toIsCentralAmerica) {
      candidates.push(
        RECOMMENDED_PASSAGE_POINTS.bahamas,
        RECOMMENDED_PASSAGE_POINTS.turks,
        RECOMMENDED_PASSAGE_POINTS.puertoRico,
        RECOMMENDED_PASSAGE_POINTS.bvi,
        RECOMMENDED_PASSAGE_POINTS.antigua,
        RECOMMENDED_PASSAGE_POINTS.stLucia,
        RECOMMENDED_PASSAGE_POINTS.grenada,
        RECOMMENDED_PASSAGE_POINTS.trinidad,
        RECOMMENDED_PASSAGE_POINTS.jamaica,
        RECOMMENDED_PASSAGE_POINTS.cayman,
        RECOMMENDED_PASSAGE_POINTS.roatan,
        RECOMMENDED_PASSAGE_POINTS.cartagena,
        RECOMMENDED_PASSAGE_POINTS.santaMarta,
        RECOMMENDED_PASSAGE_POINTS.sanBlas,
        RECOMMENDED_PASSAGE_POINTS.shelterBay,
        RECOMMENDED_PASSAGE_POINTS.bocas,
        RECOMMENDED_PASSAGE_POINTS.limon
      );
    }

    if (fromMeta.country === "Costa Rica" || toMeta.country === "Costa Rica") {
      candidates.push(
        RECOMMENDED_PASSAGE_POINTS.papagayo,
        RECOMMENDED_PASSAGE_POINTS.quepos,
        RECOMMENDED_PASSAGE_POINTS.golfito,
        RECOMMENDED_PASSAGE_POINTS.limon
      );
    }

    if (fromMeta.country === "Panama" || toMeta.country === "Panama") {
      candidates.push(
        RECOMMENDED_PASSAGE_POINTS.shelterBay,
        RECOMMENDED_PASSAGE_POINTS.sanBlas,
        RECOMMENDED_PASSAGE_POINTS.bocas,
        RECOMMENDED_PASSAGE_POINTS.balboa
      );
    }

    if (fromMeta.country === "Colombia" || toMeta.country === "Colombia") {
      candidates.push(
        RECOMMENDED_PASSAGE_POINTS.cartagena,
        RECOMMENDED_PASSAGE_POINTS.santaMarta,
        RECOMMENDED_PASSAGE_POINTS.sanBlas,
        RECOMMENDED_PASSAGE_POINTS.jamaica
      );
    }

    return sortAndFilterRecommended(candidates, from, to).slice(0, 10);
  }

  async function buildRouteThroughAnchors(anchors) {
    const valid = anchors.filter(
      (anchor) => Number.isFinite(anchor?.lat) && Number.isFinite(anchor?.lng)
    );
    if (valid.length < 2) return null;

    // With manual waypoints the navigator is taking control of the course, so we
    // connect every anchor in sequence (departure -> wp1 -> ... -> arrival).
    // Without waypoints we still auto-route along sea lanes to dodge land.
    const useManualCourse = valid.length > 2;
    const coords = [];

    for (let i = 0; i < valid.length - 1; i += 1) {
      const legCoords = useManualCourse
        ? buildDirectLeg(valid[i], valid[i + 1])
        : await buildLegRoute(valid[i], valid[i + 1]);

      legCoords.forEach((point) => {
        const prev = coords[coords.length - 1];
        if (!prev || prev[0] !== point[0] || prev[1] !== point[1]) {
          coords.push([point[0], point[1]]);
        }
      });
    }

    return { coords, distanceNm: pathLengthNm(coords) };
  }

  async function buildRouteForEntry(entry) {
    if (!entryHasRoute(entry)) return null;

    const anchors = [
      { lat: entry.fromLat, lng: entry.fromLng },
      ...normalizeWaypointList(entry.waypoints),
      { lat: entry.toLat, lng: entry.toLng }
    ];

    return buildRouteThroughAnchors(anchors);
  }

  async function buildPassagePaths(entries) {
    const routedEntries = entries.filter(entryHasRoute);
    const paths = [];

    for (const entry of routedEntries) {
      const route = await buildRouteForEntry(entry);
      if (!route?.coords?.length) continue;

      const color = getVesselColor(entry.vesselId);
      paths.push({
        coords: route.coords,
        color,
        distanceNm: route.distanceNm,
        vesselId: entry.vesselId,
        vesselName: getVesselName(entry.vesselId),
        fromPort: entry.fromPort,
        toPort: entry.toPort,
        fromCountry: entry.fromCountry,
        toCountry: entry.toCountry,
        passageName: entry.passageName,
        visitedDate: entry.visitedDate,
        departureDate: entry.departureDate,
        arrivalDate: entry.arrivalDate
      });
    }

    return paths;
  }

  function filterEntries(entries) {
    if (!activeVesselFilter) return entries;
    return entries.filter((entry) => entry.vesselId === activeVesselFilter);
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
        size: role === "departure" ? 0.38 : 0.48,
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

  function fitMapToData(paths, points) {
    if (!map) return;

    const coords = [];
    paths.forEach((path) => {
      (path.coords || []).forEach((point) => coords.push([point[0], point[1]]));
    });
    points.forEach((point) => coords.push([point.lat, point.lng]));

    if (!coords.length) return;

    try {
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [44, 44], maxZoom: 9, animate: true });
    } catch (error) {
      console.warn("[SEA-V] Could not fit map bounds:", error);
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
    const roleLabel = point.role === "departure" ? "Departure" : "Arrival";
    const roleDate =
      point.role === "departure"
        ? entry.departureDate || entry.visitedDate || ""
        : entry.arrivalDate || "";
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
    if (!map) {
      pendingMapRefresh = true;
      return;
    }

    if (refreshMapPromise) return refreshMapPromise;

    refreshMapPromise = (async () => {
      const entries = filterEntries(await loadNavEntries());
      const paths = await buildPassagePaths(entries);
      const points = buildMapPoints(entries);
      const stats = buildNavigationStats(entries, paths);

      renderStats(stats);

      if (pathLayer) pathLayer.clearLayers();
      if (pointLayer) pointLayer.clearLayers();

      paths.forEach((path) => {
        const latlngs = (path.coords || []).map((point) => [point[0], point[1]]);
        if (latlngs.length < 2) return;

        const line = L.polyline(latlngs, {
          color: path.color,
          weight: 4,
          opacity: 0.94,
          lineJoin: "round",
          lineCap: "round"
        });
        line.bindPopup(buildPathPopup(path));
        line.bindTooltip(
          `${Seav.escapeHtml(path.fromPort || "")} → ${Seav.escapeHtml(path.toPort || "")}`,
          { sticky: true }
        );
        pathLayer.addLayer(line);
      });

      points.forEach((point) => {
        const marker = L.circleMarker([point.lat, point.lng], {
          radius: point.role === "departure" ? 5 : 7,
          color: "#ffffff",
          weight: 1.5,
          fillColor: point.color,
          fillOpacity: 0.95
        });
        marker.bindPopup(buildPointPopup(point));
        pointLayer.addLayer(marker);
      });

      if (paths.length || points.length) {
        fitMapToData(paths, points);
      }
    })()
      .catch((error) => {
        console.warn("[SEA-V] Map refresh failed:", error);
      })
      .finally(() => {
        refreshMapPromise = null;
      });

    return refreshMapPromise;
  }

  function initNavigationMap() {
    const container = document.getElementById("navMap");
    if (!container || typeof L === "undefined") {
      console.warn("[SEA-V] Leaflet not available.");
      return;
    }

    map = L.map(container, {
      center: [MAP_DEFAULT_VIEW.lat, MAP_DEFAULT_VIEW.lng],
      zoom: MAP_DEFAULT_VIEW.zoom,
      minZoom: 2,
      worldCopyJump: true,
      zoomControl: true,
      attributionControl: true
    });

    L.tileLayer(MAP_TILE_URL, {
      attribution: MAP_TILE_ATTRIBUTION,
      subdomains: "abcd",
      maxZoom: 19
    }).addTo(map);

    pathLayer = L.layerGroup().addTo(map);
    pointLayer = L.layerGroup().addTo(map);
    workingLayer = L.layerGroup().addTo(map);

    mapReady = true;

    map.on("click", (event) => {
      if (endpointPickRole) {
        formEndpointCoords[endpointPickRole] = {
          lat: roundCoord(event.latlng.lat),
          lng: roundCoord(event.latlng.lng)
        };
        renderEndpointStatus();
        renderWorkingRoute();
        setEndpointPickMode(null);
        return;
      }

      if (!pickMode) return;
      addWaypoint(event.latlng.lat, event.latlng.lng);
    });

    window.setTimeout(() => {
      if (map) map.invalidateSize();
    }, 200);

    refreshMap().then(() => {
      if (pendingMapRefresh) {
        pendingMapRefresh = false;
        refreshMap();
      }
      renderWorkingRoute();
    });

    window.addEventListener("resize", () => {
      if (!map) return;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => map.invalidateSize(), 150);
    });
  }

  function buildCountryOptions(selectedValue = "") {
    return getCountryList().map((country) => {
      const selected = country === selectedValue ? " selected" : "";
      return `<option value="${Seav.escapeHtml(country)}"${selected}>${Seav.escapeHtml(country)}</option>`;
    }).join("");
  }

  function buildPortOptions(country, selectedValue = "") {
    if (!country) {
      return `<option value="">Select country first</option>`;
    }

    const ports = getPortList().filter(
      (item) => normalizeText(item.country) === normalizeText(country)
    ).sort((a, b) => a.port.localeCompare(b.port));

    if (!ports.length) {
      return `<option value="">No ports listed for this country</option>`;
    }

    return (
      `<option value="">Select port / town</option>` +
      ports
        .map((item) => {
          const selected = item.port === selectedValue ? " selected" : "";
          return `<option value="${Seav.escapeHtml(item.port)}"${selected}>${Seav.escapeHtml(item.port)}</option>`;
        })
        .join("")
    );
  }

  function populateCountrySelect(selectEl, selectedValue = "") {
    if (!selectEl) return;

    const countries = getCountryList();
    if (!countries.length) {
      selectEl.innerHTML = `<option value="">Port list still loading…</option>`;
      selectEl.disabled = true;
      return;
    }

    selectEl.disabled = false;
    selectEl.innerHTML =
      `<option value="">Select country</option>` + buildCountryOptions(selectedValue);
  }

  function populatePortSelect(portSelect, country, selectedValue = "") {
    if (!portSelect) return;

    if (!country) {
      portSelect.innerHTML = `<option value="">Select country first (optional)</option>`;
      portSelect.disabled = true;
      return;
    }

    portSelect.innerHTML = buildPortOptions(country, selectedValue);
    portSelect.disabled = false;
  }

  function wireRouteSelects(countrySelect, portSelect) {
    if (!countrySelect || !portSelect) return;

    countrySelect.addEventListener("change", () => {
      populatePortSelect(portSelect, countrySelect.value, "");
    });
  }

  function populateVesselOptions() {
    const formSelect = document.getElementById("navVessel");
    const filterSelect = document.getElementById("navMapVesselFilter");
    const vessels = [...getVessels()].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""))
    );

    if (formSelect) {
      const currentValue = formSelect.value || "";
      formSelect.innerHTML = `
        <option value="">Choose from your vessel list</option>
        ${vessels
          .map(
            (v) =>
              `<option value="${Seav.escapeHtml(v.id)}">${Seav.escapeHtml(v.name || "Unnamed vessel")}</option>`
          )
          .join("")}
      `;
      if (currentValue) formSelect.value = currentValue;
    }

    if (filterSelect) {
      const currentFilter = filterSelect.value || "";
      filterSelect.innerHTML = `
        <option value="">All vessels</option>
        ${vessels
          .map(
            (v) =>
              `<option value="${Seav.escapeHtml(v.id)}">${Seav.escapeHtml(v.name || "Unnamed vessel")}</option>`
          )
          .join("")}
      `;
      filterSelect.value = currentFilter;
    }
  }

  function buildSeatimeLabel(entry) {
    const vesselName = getVesselName(entry.vesselId);
    const role = entry.capacityServed || "Sea time";
    const dates = formatDateRange(entry.dateJoined || "", entry.dateLeft || "") || "No dates";
    return `${vesselName} · ${role} · ${dates}`;
  }

  function getLinkedSeatimeIds(currentNavId = "") {
    return new Set(
      (window.SeavState?.navigationAreas || [])
        .filter((entry) => entry.id !== currentNavId)
        .map((entry) => entry.seatimeId || entry.seatime_id || "")
        .filter(Boolean)
    );
  }

  function populateSeatimeOptions(selectedValue = "") {
    const select = document.getElementById("navSeatime");
    if (!select) return;

    const selectedVesselId = document.getElementById("navVessel")?.value || "";
    const currentNavId = document.getElementById("nav_edit_id")?.value.trim() || "";
    const linkedSeatimeIds = getLinkedSeatimeIds(currentNavId);
    const seatimes = [...getSeatimes()].sort((a, b) => {
      const da = a.dateJoined ? new Date(a.dateJoined) : new Date(0);
      const db = b.dateJoined ? new Date(b.dateJoined) : new Date(0);
      return db - da;
    }).filter((entry) => {
      if (selectedVesselId && entry.vesselId !== selectedVesselId) return false;
      if (entry.id === selectedValue) return true;
      return !linkedSeatimeIds.has(entry.id);
    });

    select.innerHTML = `
      <option value="">${selectedVesselId ? "No linked sea time entry" : "Choose a vessel first, or select any unlinked entry"}</option>
      ${seatimes
        .map(
          (entry) =>
            `<option value="${Seav.escapeHtml(entry.id)}">${Seav.escapeHtml(buildSeatimeLabel(entry))}</option>`
        )
        .join("")}
    `;
    select.value = selectedValue || "";
  }

  function applySeatimeLink(seatimeId) {
    const entry = getSeatimes().find((item) => item.id === seatimeId);
    if (!entry) return;

    const vesselInput = document.getElementById("navVessel");
    if (vesselInput && entry.vesselId) vesselInput.value = entry.vesselId;
    populateSeatimeOptions(seatimeId);

    if (entry.dateJoined) Seav.setDateTriplet("navDepartureDate", entry.dateJoined);
    if (entry.dateLeft) Seav.setDateTriplet("navArrivalDate", entry.dateLeft);

    const passageNameInput = document.getElementById("navPassageName");
    if (passageNameInput && !passageNameInput.value.trim()) {
      passageNameInput.value = `${getVesselName(entry.vesselId)} passage plan`;
    }
  }

  function resetRouteForm() {
    const fromCountry = document.getElementById("navFromCountry");
    const fromPort = document.getElementById("navFromPort");
    const toCountry = document.getElementById("navToCountry");
    const toPort = document.getElementById("navToPort");

    populateCountrySelect(fromCountry);
    populateCountrySelect(toCountry);
    populatePortSelect(fromPort, "");
    populatePortSelect(toPort, "");
  }

  function setNavFormMode(editing) {
    const heading = document.querySelector(".navigation-form-section h3");
    const submitBtn = document.getElementById("navSubmitBtn");
    const cancelBtn = document.getElementById("navCancelEditBtn");

    if (heading) {
      heading.textContent = editing ? "Edit passage" : "Log a passage";
    }
    if (submitBtn) {
      submitBtn.textContent = editing ? "Save changes" : "Add passage to chart";
    }
    if (cancelBtn) {
      cancelBtn.hidden = !editing;
    }
  }

  function prefillFromSeatimeParam() {
    const params = new URLSearchParams(window.location.search);
    const seatimeId = params.get("seatime") || params.get("seatimeId") || "";
    if (!seatimeId) return;

    const entry = getSeatimes().find((item) => item.id === seatimeId);
    if (!entry) {
      Seav.notify("info", "Sea time not found", "That sea time entry could not be linked.");
      return;
    }

    const alreadyLinked = getLinkedSeatimeIds().has(seatimeId);
    if (alreadyLinked) {
      Seav.notify(
        "info",
        "Already linked",
        "That sea time entry already has a linked passage plan."
      );
      return;
    }

    applySeatimeLink(seatimeId);
    document.querySelector(".navigation-form-section")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function getEndpointLocationInput(role) {
    return document.getElementById(role === "from" ? "navFromLocation" : "navToLocation");
  }

  function readEndpointDetails(role) {
    const countryEl = document.getElementById(role === "from" ? "navFromCountry" : "navToCountry");
    const portSelectEl = document.getElementById(role === "from" ? "navFromPort" : "navToPort");
    const manualEl = getEndpointLocationInput(role);

    const manualName = manualEl?.value.trim() || "";
    const country = countryEl?.value.trim() || "";
    const portFromList = portSelectEl?.value.trim() || "";
    const portName = manualName || portFromList;

    return { country, portName, portFromList, manualName };
  }

  function resolveEndpointCoord(role, details) {
    const coord = getFormEndpointCoord(role);
    if (coord) return coord;

    if (details?.portFromList && details?.country) {
      const found = findPort(details.country, details.portFromList);
      if (found) return { lat: found.lat, lng: found.lng };
    }

    return null;
  }

  function syncLocationFromPort(role) {
    const portSelectEl = document.getElementById(role === "from" ? "navFromPort" : "navToPort");
    const manualEl = getEndpointLocationInput(role);
    const portFromList = portSelectEl?.value.trim() || "";
    if (portFromList && manualEl && !manualEl.value.trim()) {
      manualEl.value = portFromList;
    }
  }

  function cleanImportLabel(label) {
    const text = String(label || "").trim();
    if (!text) return "";
    if (/^RTZ waypoint \d+$/i.test(text)) return "";
    if (/^KML (waypoint|track point|point) \d+$/i.test(text)) return "";
    return text;
  }

  function defaultImportLocationName(point) {
    const cleaned = cleanImportLabel(point?.label);
    if (cleaned) return cleaned;
    if (!point) return "";
    return `${Number(point.lat).toFixed(4)}, ${Number(point.lng).toFixed(4)}`;
  }

  function splitImportedRoutePoints(points) {
    if (!points.length) {
      return { from: null, to: null, waypoints: [] };
    }
    if (points.length === 1) {
      return { from: points[0], to: { ...points[0] }, waypoints: [] };
    }

    return {
      from: points[0],
      to: points[points.length - 1],
      waypoints: points.length > 2 ? points.slice(1, -1) : []
    };
  }

  function applyImportedRoutePoints(points) {
    const { from, to, waypoints } = splitImportedRoutePoints(points);
    if (!from || !to) return false;

    formEndpointCoords.from = { lat: from.lat, lng: from.lng };
    formEndpointCoords.to = { lat: to.lat, lng: to.lng };
    formWaypoints = waypoints.map((wp) => ({
      lat: wp.lat,
      lng: wp.lng,
      label: cleanImportLabel(wp.label)
    }));

    const fromLocationInput = getEndpointLocationInput("from");
    const toLocationInput = getEndpointLocationInput("to");
    if (fromLocationInput) fromLocationInput.value = defaultImportLocationName(from);
    if (toLocationInput) toLocationInput.value = defaultImportLocationName(to);

    return true;
  }

  function getFormPortCoord(countryId, portId) {
    const country = document.getElementById(countryId)?.value.trim();
    const port = document.getElementById(portId)?.value.trim();
    if (!country || !port) return null;
    const found = findPort(country, port);
    return found ? { lat: found.lat, lng: found.lng } : null;
  }

  function getFormEndpointCoord(role) {
    const key = role === "from" ? "from" : "to";
    const selected =
      key === "from"
        ? getFormPortCoord("navFromCountry", "navFromPort")
        : getFormPortCoord("navToCountry", "navToPort");
    const adjusted = formEndpointCoords[key];

    if (adjusted && Number.isFinite(adjusted.lat) && Number.isFinite(adjusted.lng)) {
      return { lat: adjusted.lat, lng: adjusted.lng };
    }
    return selected;
  }

  function resetEndpointToPort(role) {
    const key = role === "from" ? "from" : "to";
    const coord =
      key === "from"
        ? getFormPortCoord("navFromCountry", "navFromPort")
        : getFormPortCoord("navToCountry", "navToPort");

    if (coord) {
      formEndpointCoords[key] = {
        lat: roundCoord(coord.lat),
        lng: roundCoord(coord.lng)
      };
    } else {
      formEndpointCoords[key] = null;
    }

    renderEndpointStatus();
    renderWorkingRoute();
  }

  function updateEndpointFromPort(role) {
    const portSelectEl = document.getElementById(role === "from" ? "navFromPort" : "navToPort");
    const portFromList = portSelectEl?.value.trim() || "";
    if (!portFromList) return;

    resetEndpointToPort(role);
  }

  function formatCoordLabel(coord) {
    if (!coord) return "No point selected.";
    return `${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}`;
  }

  function renderEndpointStatus() {
    const fromStatus = document.getElementById("navFromPointStatus");
    const toStatus = document.getElementById("navToPointStatus");
    const from = getFormEndpointCoord("from");
    const to = getFormEndpointCoord("to");

    if (fromStatus) {
      fromStatus.textContent = from
        ? `Green start (S): ${formatCoordLabel(from)}`
        : "Green start (S) — set from list, import, or pick on chart.";
    }
    if (toStatus) {
      toStatus.textContent = to
        ? `Red finish (F): ${formatCoordLabel(to)}`
        : "Red finish (F) — set from list, import, or pick on chart.";
    }
  }

  function buildEndpointMarker(role, coord) {
    const isStart = role === "from";
    const marker = L.marker([coord.lat, coord.lng], {
      draggable: true,
      keyboard: false,
      icon: L.divIcon({
        className: `nav-endpoint-marker ${isStart ? "nav-start-marker" : "nav-finish-marker"}`,
        html: `<span>${isStart ? "S" : "F"}</span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      })
    });

    marker.on("dragend", () => {
      const ll = marker.getLatLng();
      formEndpointCoords[role] = {
        lat: roundCoord(ll.lat),
        lng: roundCoord(ll.lng)
      };
      renderEndpointStatus();
      renderWorkingRoute();
    });

    marker.bindTooltip(isStart ? "Departure start point" : "Arrival finish point", {
      direction: "top"
    });
    return marker;
  }

  function renderWaypointList() {
    const list = document.getElementById("navWaypointList");
    const count = document.getElementById("navWaypointCount");
    if (count) count.textContent = String(formWaypoints.length);
    if (!list) return;

    if (!formWaypoints.length) {
      list.innerHTML =
        `<li class="navigation-waypoint-empty">No waypoints — the track routes automatically along sea lanes.</li>`;
      return;
    }

    list.innerHTML = formWaypoints
      .map((wp, index) => {
        return `
          <li class="navigation-waypoint-item">
            <span class="navigation-waypoint-index">${index + 1}</span>
            <span class="navigation-waypoint-coord">
              ${wp.label ? `<strong>${Seav.escapeHtml(wp.label)}</strong>` : ""}
              ${wp.lat.toFixed(4)}, ${wp.lng.toFixed(4)}
            </span>
            <span class="navigation-waypoint-buttons">
              <button type="button" data-wp-up="${index}" title="Move up"${index === 0 ? " disabled" : ""}>&uarr;</button>
              <button type="button" data-wp-down="${index}" title="Move down"${index === formWaypoints.length - 1 ? " disabled" : ""}>&darr;</button>
              <button type="button" data-wp-remove="${index}" title="Remove waypoint">&times;</button>
            </span>
          </li>
        `;
      })
      .join("");
  }

  async function renderWorkingRoute() {
    if (!map || !workingLayer) return;

    const token = (workingRouteToken += 1);
    workingLayer.clearLayers();

    const from = getFormEndpointCoord("from");
    const to = getFormEndpointCoord("to");

    if (from) workingLayer.addLayer(buildEndpointMarker("from", from));
    if (to) workingLayer.addLayer(buildEndpointMarker("to", to));
    renderEndpointStatus();

    formWaypoints.forEach((wp, index) => {
      const marker = L.marker([wp.lat, wp.lng], {
        draggable: true,
        keyboard: false,
        icon: L.divIcon({
          className: "nav-waypoint-marker",
          html: `<span>${index + 1}</span>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
      });

      marker.on("dragend", () => {
        const ll = marker.getLatLng();
        formWaypoints[index] = {
          ...formWaypoints[index],
          lat: roundCoord(ll.lat),
          lng: roundCoord(ll.lng)
        };
        renderWaypointList();
        renderWorkingRoute();
      });

      marker.bindTooltip(`Waypoint ${index + 1}`, { direction: "top" });
      workingLayer.addLayer(marker);
    });

    if (!from || !to) return;

    const route = await buildRouteThroughAnchors([
      from,
      ...formWaypoints.map((wp) => ({ lat: wp.lat, lng: wp.lng })),
      to
    ]);

    if (token !== workingRouteToken) return;
    if (!route?.coords?.length || route.coords.length < 2) return;

    const preview = L.polyline(
      route.coords.map((point) => [point[0], point[1]]),
      {
        color: "#b45309",
        weight: 3,
        opacity: 0.95,
        dashArray: "6 7",
        lineJoin: "round"
      }
    );
    workingLayer.addLayer(preview);
  }

  function addWaypoint(lat, lng, label) {
    const latNum = Number(lat);
    const lngNum = Number(lng);

    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      Seav.notify("error", "Invalid coordinates", "Enter numeric latitude and longitude.");
      return false;
    }
    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      Seav.notify(
        "error",
        "Out of range",
        "Latitude must be between -90 and 90, longitude between -180 and 180."
      );
      return false;
    }

    formWaypoints.push({ lat: roundCoord(latNum), lng: roundCoord(lngNum), label: label || "" });
    renderWaypointList();
    renderWorkingRoute();
    return true;
  }

  function applyRecommendedPassage() {
    const fromCountry = document.getElementById("navFromCountry")?.value.trim() || "";
    const fromPort = document.getElementById("navFromPort")?.value.trim() || "";
    const toCountry = document.getElementById("navToCountry")?.value.trim() || "";
    const toPort = document.getElementById("navToPort")?.value.trim() || "";
    const fromSelected = findPort(fromCountry, fromPort);
    const toSelected = findPort(toCountry, toPort);

    if (!fromSelected || !toSelected) {
      Seav.notify(
        "error",
        "Choose ports first",
        "Select the departure and arrival ports before generating a recommended passage."
      );
      return;
    }

    const from = getFormEndpointCoord("from") || {
      lat: fromSelected.lat,
      lng: fromSelected.lng
    };
    const to = getFormEndpointCoord("to") || {
      lat: toSelected.lat,
      lng: toSelected.lng
    };
    const recommended = buildRecommendedPassageWaypoints(
      from,
      to,
      fromSelected,
      toSelected
    );

    if (!recommended.length) {
      Seav.notify(
        "info",
        "No template found",
        "No recommended passage template exists for that route yet. You can still add waypoints manually."
      );
      return;
    }

    formWaypoints = recommended.map((point) => ({
      lat: roundCoord(point.lat),
      lng: roundCoord(point.lng),
      label: point.label || "Recommended waypoint"
    }));
    const panel = document.getElementById("navWaypointsPanel");
    if (panel) panel.open = true;
    renderWaypointList();
    renderWorkingRoute();
    Seav.notify(
      "success",
      "Recommended passage added",
      `${recommended.length} waypoint${recommended.length === 1 ? "" : "s"} added from standard maritime corridors.`
    );
  }

  function getXmlElementsByLocalName(root, localName) {
    return Array.from(root.getElementsByTagName("*")).filter(
      (el) => el.localName === localName
    );
  }

  function parseXmlRouteDocument(text) {
    const xml = new DOMParser().parseFromString(text, "application/xml");
    if (xml.getElementsByTagName("parsererror").length) {
      throw new Error("The route file is not valid XML.");
    }
    return xml;
  }

  function normalizeImportedPoints(points) {
    const normalized = [];
    points.forEach((point) => {
      const lat = roundCoord(point.lat);
      const lng = roundCoord(point.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

      const prev = normalized[normalized.length - 1];
      if (prev && prev.lat === lat && prev.lng === lng) return;

      normalized.push({
        lat,
        lng,
        label: point.label || ""
      });
    });
    return normalized;
  }

  function parseKmlCoordinateBlock(text, labelPrefix = "KML waypoint") {
    return String(text || "")
      .trim()
      .split(/\s+/)
      .map((token, index) => {
        const [lngRaw, latRaw] = token.split(",");
        const lat = Number(latRaw);
        const lng = Number(lngRaw);
        return {
          lat,
          lng,
          label: `${labelPrefix} ${index + 1}`
        };
      });
  }

  function parseKmlRoute(text) {
    const xml = parseXmlRouteDocument(text);
    const lineStrings = getXmlElementsByLocalName(xml, "LineString");
    const lineRoutes = lineStrings
      .map((line) => {
        const coords = getXmlElementsByLocalName(line, "coordinates")[0];
        return parseKmlCoordinateBlock(coords?.textContent || "");
      })
      .filter((points) => points.length);

    const tracks = getXmlElementsByLocalName(xml, "Track")
      .map((track) =>
        getXmlElementsByLocalName(track, "coord").map((coord, index) => {
          const [lngRaw, latRaw] = String(coord.textContent || "").trim().split(/\s+/);
          return {
            lat: Number(latRaw),
            lng: Number(lngRaw),
            label: `KML track point ${index + 1}`
          };
        })
      )
      .filter((points) => points.length);

    const candidateRoutes = [...lineRoutes, ...tracks].sort((a, b) => b.length - a.length);
    if (candidateRoutes.length) return normalizeImportedPoints(candidateRoutes[0]);

    const pointCoords = getXmlElementsByLocalName(xml, "Point")
      .flatMap((point, index) => {
        const coords = getXmlElementsByLocalName(point, "coordinates")[0];
        return parseKmlCoordinateBlock(coords?.textContent || "", `KML point ${index + 1}`);
      });
    return normalizeImportedPoints(pointCoords);
  }

  function getNumberAttr(el, names) {
    for (const name of names) {
      const value = Number(el?.getAttribute(name));
      if (Number.isFinite(value)) return value;
    }
    return NaN;
  }

  function parseRtzRoute(text) {
    const xml = parseXmlRouteDocument(text);
    const waypoints = getXmlElementsByLocalName(xml, "waypoint").map((waypoint, index) => {
      const position = getXmlElementsByLocalName(waypoint, "position")[0] || waypoint;
      return {
        lat: getNumberAttr(position, ["lat", "latitude", "Latitude", "LAT"]),
        lng: getNumberAttr(position, ["lon", "lng", "long", "longitude", "Longitude", "LON"]),
        label:
          waypoint.getAttribute("name") ||
          waypoint.getAttribute("id") ||
          `RTZ waypoint ${index + 1}`
      };
    });
    return normalizeImportedPoints(waypoints);
  }

  async function importRouteFile(file) {
    if (!file) return;

    const name = String(file.name || "").toLowerCase();
    const text = await file.text();
    let points = [];

    if (name.endsWith(".rtz")) {
      points = parseRtzRoute(text);
    } else if (name.endsWith(".kml")) {
      points = parseKmlRoute(text);
    } else {
      try {
        points = parseRtzRoute(text);
      } catch (error) {
        points = parseKmlRoute(text);
      }
      if (!points.length) points = parseKmlRoute(text);
    }

    if (!applyImportedRoutePoints(points)) {
      Seav.notify(
        "error",
        "No route points found",
        "The KML/RTZ file did not contain usable waypoint coordinates."
      );
      return;
    }

    const panel = document.getElementById("navWaypointsPanel");
    if (panel) panel.open = true;
    renderEndpointStatus();
    renderWaypointList();
    renderWorkingRoute();

    const waypointCount = formWaypoints.length;
    Seav.notify(
      "success",
      "Route imported",
      waypointCount
        ? `Start (S) and finish (F) set, with ${waypointCount} numbered waypoint${waypointCount === 1 ? "" : "s"}. Add location names if needed.`
        : "Start (S) and finish (F) set from the imported route. Add location names if needed."
    );
  }

  function removeWaypoint(index) {
    if (index < 0 || index >= formWaypoints.length) return;
    formWaypoints.splice(index, 1);
    renderWaypointList();
    renderWorkingRoute();
  }

  function moveWaypoint(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= formWaypoints.length) return;
    const [item] = formWaypoints.splice(index, 1);
    formWaypoints.splice(target, 0, item);
    renderWaypointList();
    renderWorkingRoute();
  }

  function setEndpointPickMode(role) {
    endpointPickRole = role === "from" || role === "to" ? role : null;

    const fromBtn = document.getElementById("navPickFromBtn");
    const toBtn = document.getElementById("navPickToBtn");
    const container = document.getElementById("navMap");

    if (fromBtn) fromBtn.classList.toggle("is-active", endpointPickRole === "from");
    if (toBtn) toBtn.classList.toggle("is-active", endpointPickRole === "to");

    if (endpointPickRole) {
      pickMode = false;
      const pickBtn = document.getElementById("navPickOnMapBtn");
      if (pickBtn) {
        pickBtn.textContent = "Pick on chart";
        pickBtn.classList.remove("is-active");
      }
    }

    if (container) {
      container.classList.toggle("is-picking", pickMode || !!endpointPickRole);
    }
  }

  function setPickMode(on) {
    pickMode = !!on;
    if (pickMode) setEndpointPickMode(null);

    const btn = document.getElementById("navPickOnMapBtn");
    const container = document.getElementById("navMap");

    if (btn) {
      btn.textContent = pickMode ? "Click the chart… (cancel)" : "Pick on chart";
      btn.classList.toggle("is-active", pickMode);
    }
    if (container) {
      container.classList.toggle("is-picking", pickMode || !!endpointPickRole);
    }
  }

  function clearNavEditForm() {
    const form = document.getElementById("navForm");
    const editIdInput = document.getElementById("nav_edit_id");

    form?.reset();
    if (editIdInput) editIdInput.value = "";
    const passageNameInput = document.getElementById("navPassageName");
    if (passageNameInput) passageNameInput.value = "";
    populateSeatimeOptions("");
    Seav.clearDateTriplet("navDepartureDate");
    Seav.clearDateTriplet("navArrivalDate");
    resetRouteForm();
    formWaypoints = [];
    formEndpointCoords = { from: null, to: null };
    setPickMode(false);
    setEndpointPickMode(null);
    getEndpointLocationInput("from") && (getEndpointLocationInput("from").value = "");
    getEndpointLocationInput("to") && (getEndpointLocationInput("to").value = "");
    renderEndpointStatus();
    renderWaypointList();
    renderWorkingRoute();
    setNavFormMode(false);
  }

  function fillNavForm(entry) {
    const fromCountry = document.getElementById("navFromCountry");
    const fromPort = document.getElementById("navFromPort");
    const toCountry = document.getElementById("navToCountry");
    const toPort = document.getElementById("navToPort");
    const vesselInput = document.getElementById("navVessel");
    const operationTypeInput = document.getElementById("navOperationType");
    const noteInput = document.getElementById("navNote");
    const passageNameInput = document.getElementById("navPassageName");
    const seatimeInput = document.getElementById("navSeatime");
    const editIdInput = document.getElementById("nav_edit_id");
    const normalized = normalizeNavEntry(entry || {});

    if (editIdInput) editIdInput.value = normalized.id || "";
    if (passageNameInput) passageNameInput.value = normalized.passageName || "";
    populateSeatimeOptions(normalized.seatimeId || "");
    populateCountrySelect(fromCountry, normalized.fromCountry);
    populatePortSelect(fromPort, normalized.fromCountry, normalized.fromPort);
    populateCountrySelect(toCountry, normalized.toCountry);
    populatePortSelect(toPort, normalized.toCountry, normalized.toPort);

    const fromLocationInput = getEndpointLocationInput("from");
    const toLocationInput = getEndpointLocationInput("to");
    if (fromLocationInput) fromLocationInput.value = normalized.fromPort || "";
    if (toLocationInput) toLocationInput.value = normalized.toPort || "";

    if (vesselInput) vesselInput.value = normalized.vesselId || "";
    if (seatimeInput) seatimeInput.value = normalized.seatimeId || "";
    if (operationTypeInput) operationTypeInput.value = normalized.operationType || "";
    if (noteInput) noteInput.value = normalized.note || "";
    Seav.setDateTriplet("navDepartureDate", normalized.departureDate || "");
    Seav.setDateTriplet("navArrivalDate", normalized.arrivalDate || "");

    formWaypoints = normalizeWaypointList(normalized.waypoints).map((wp) => ({
      lat: roundCoord(wp.lat),
      lng: roundCoord(wp.lng),
      label: wp.label || ""
    }));
    formEndpointCoords = {
      from: hasCoord(normalized.fromLat, normalized.fromLng)
        ? { lat: roundCoord(normalized.fromLat), lng: roundCoord(normalized.fromLng) }
        : null,
      to: hasCoord(normalized.toLat, normalized.toLng)
        ? { lat: roundCoord(normalized.toLat), lng: roundCoord(normalized.toLng) }
        : null
    };
    setPickMode(false);
    setEndpointPickMode(null);
    renderEndpointStatus();
    renderWaypointList();
    renderWorkingRoute();
    setNavFormMode(true);

    document.querySelector(".navigation-form-section")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  async function buildDistanceMap(entries) {
    const distances = new Map();

    await Promise.all(
      entries.filter(entryHasRoute).map(async (entry) => {
        const route = await buildRouteForEntry(entry);
        if (route?.distanceNm) {
          distances.set(entry.id, route.distanceNm);
        }
      })
    );

    return distances;
  }

  async function renderNavEntriesList() {
    const list = document.getElementById("navEntriesList");
    if (!list) return;

    const entries = await loadNavEntries();

    if (!entries.length) {
      list.innerHTML = `
        <div class="list-row">
          <div>
            <div class="list-title">No passages logged yet</div>
            <div class="list-sub">Log your first departure and arrival above to start your world chart.</div>
          </div>
        </div>
      `;
      return;
    }

    const distanceMap = await buildDistanceMap(entries);
    const sortDate = (entry) =>
      entry.departureDate || entry.visitedDate || entry.arrivalDate || "";
    const sorted = [...entries].sort((a, b) => {
      const da = sortDate(a) ? new Date(sortDate(a)) : new Date(0);
      const db = sortDate(b) ? new Date(sortDate(b)) : new Date(0);
      return db - da;
    });

    list.innerHTML = sorted
      .map((entry) => {
        const vesselName = getVesselName(entry.vesselId);
        const distanceNm = distanceMap.get(entry.id);
        const distanceText = distanceNm ? formatNm(distanceNm) : "";
        const dateText =
          formatDateRange(
            entry.departureDate || entry.visitedDate || "",
            entry.arrivalDate || ""
          ) || "—";

        const routeLabel = formatRouteLabel(entry);
        const title = entry.passageName || routeLabel;
        const linkedSeatime = entry.seatimeId
          ? getSeatimes().find((item) => item.id === entry.seatimeId)
          : null;

        return `
          <div class="list-row navigation-log-row">
            <div class="navigation-log-main">
              <div class="list-title">${Seav.escapeHtml(title)}</div>
              ${
                entry.passageName
                  ? `<div class="list-sub navigation-log-route">${Seav.escapeHtml(routeLabel)}</div>`
                  : ""
              }
              <div class="list-sub">
                ${Seav.escapeHtml(vesselName)} · ${Seav.escapeHtml(dateText)} · ${Seav.escapeHtml(entry.operationType || "—")}
              </div>
              ${
                linkedSeatime
                  ? `<div class="list-sub navigation-log-seatime">Linked sea time: ${Seav.escapeHtml(buildSeatimeLabel(linkedSeatime))}</div>`
                  : ""
              }
              ${
                distanceText
                  ? `<div class="navigation-log-leg">${Seav.escapeHtml(distanceText)}</div>`
                  : ""
              }
              ${
                entry.note
                  ? `<div class="list-sub navigation-log-note">${Seav.escapeHtml(entry.note)}</div>`
                  : ""
              }
            </div>
            <div class="seav-actions seav-actions--inline">
              ${Seav.seavAction("edit", "Edit", `data-edit-nav-id="${Seav.escapeHtml(entry.id)}"`)}
              ${Seav.seavAction("delete", "Delete", `data-del-nav-id="${Seav.escapeHtml(entry.id)}"`)}
            </div>
          </div>
        `;
      })
      .join("");
  }

  function initForm() {
    const form = document.getElementById("navForm");
    const fromCountry = document.getElementById("navFromCountry");
    const fromPort = document.getElementById("navFromPort");
    const toCountry = document.getElementById("navToCountry");
    const toPort = document.getElementById("navToPort");
    const vesselInput = document.getElementById("navVessel");
    const operationTypeInput = document.getElementById("navOperationType");
    const noteInput = document.getElementById("navNote");
    const filterSelect = document.getElementById("navMapVesselFilter");

    const cancelEditBtn = document.getElementById("navCancelEditBtn");

    if (!form || !fromCountry || !fromPort || !toCountry || !toPort) return;

    clearNavEditForm();
    populateVesselOptions();
    populateSeatimeOptions();
    wireRouteSelects(fromCountry, fromPort);
    wireRouteSelects(toCountry, toPort);

    fromCountry.addEventListener("change", () => {
      syncLocationFromPort("from");
    });
    fromPort.addEventListener("change", () => {
      syncLocationFromPort("from");
      updateEndpointFromPort("from");
    });
    toCountry.addEventListener("change", () => {
      syncLocationFromPort("to");
    });
    toPort.addEventListener("change", () => {
      syncLocationFromPort("to");
      updateEndpointFromPort("to");
    });

    if (!getCountryList().length) {
      window.setTimeout(() => {
        resetRouteForm();
      }, 150);
    }

    filterSelect?.addEventListener("change", async () => {
      activeVesselFilter = filterSelect.value || "";
      await refreshMap();
    });

    vesselInput?.addEventListener("change", () => {
      populateSeatimeOptions();
    });

    document.getElementById("navSeatime")?.addEventListener("change", (event) => {
      applySeatimeLink(event.currentTarget.value || "");
    });

    cancelEditBtn?.addEventListener("click", () => {
      clearNavEditForm();
      populateVesselOptions();
    });

    document.getElementById("navResetFromPointBtn")?.addEventListener("click", () => {
      resetEndpointToPort("from");
    });

    document.getElementById("navResetToPointBtn")?.addEventListener("click", () => {
      resetEndpointToPort("to");
    });

    document.getElementById("navPickFromBtn")?.addEventListener("click", () => {
      setEndpointPickMode(endpointPickRole === "from" ? null : "from");
    });

    document.getElementById("navPickToBtn")?.addEventListener("click", () => {
      setEndpointPickMode(endpointPickRole === "to" ? null : "to");
    });

    document.getElementById("navPickOnMapBtn")?.addEventListener("click", () => {
      setPickMode(!pickMode);
    });

    document.getElementById("navRecommendPassageBtn")?.addEventListener("click", () => {
      applyRecommendedPassage();
    });

    document.getElementById("navRouteFile")?.addEventListener("change", async (event) => {
      const input = event.currentTarget;
      const file = input?.files?.[0];
      try {
        await importRouteFile(file);
      } catch (error) {
        console.error("[SEA-V] Route import failed:", error);
        Seav.notify(
          "error",
          "Import failed",
          error?.message || "The KML/RTZ route could not be imported."
        );
      } finally {
        if (input) input.value = "";
      }
    });

    document.getElementById("navAddWaypointBtn")?.addEventListener("click", () => {
      const latEl = document.getElementById("navWaypointLat");
      const lngEl = document.getElementById("navWaypointLng");
      if (addWaypoint(latEl?.value, lngEl?.value)) {
        if (latEl) latEl.value = "";
        if (lngEl) lngEl.value = "";
      }
    });

    document.getElementById("navWaypointList")?.addEventListener("click", (event) => {
      const up = event.target.closest("[data-wp-up]");
      const down = event.target.closest("[data-wp-down]");
      const remove = event.target.closest("[data-wp-remove]");

      if (up) moveWaypoint(Number(up.getAttribute("data-wp-up")), -1);
      else if (down) moveWaypoint(Number(down.getAttribute("data-wp-down")), 1);
      else if (remove) removeWaypoint(Number(remove.getAttribute("data-wp-remove")));
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const editId = document.getElementById("nav_edit_id")?.value.trim() || "";
      const fromDetails = readEndpointDetails("from");
      const toDetails = readEndpointDetails("to");
      const vesselId = vesselInput?.value || "";
      const seatimeId = document.getElementById("navSeatime")?.value || "";
      const departureDate = Seav.readDateTriplet("navDepartureDate");
      const arrivalDate = Seav.readDateTriplet("navArrivalDate");
      const visitedDate = departureDate || arrivalDate;
      const operationType = operationTypeInput?.value || "";
      const note = noteInput?.value.trim() || "";
      const passageName =
        document.getElementById("navPassageName")?.value.trim() || "";

      if (!fromDetails.portName || !toDetails.portName) {
        Seav.notify(
          "error",
          "Missing locations",
          "Enter a departure and arrival location, or pick them from the port lists."
        );
        return;
      }

      const fromChartCoord = resolveEndpointCoord("from", fromDetails);
      const toChartCoord = resolveEndpointCoord("to", toDetails);

      if (!fromChartCoord || !toChartCoord) {
        Seav.notify(
          "error",
          "Missing chart points",
          "Set start and finish positions by importing RTZ/KML, picking on the chart, or choosing ports from the list."
        );
        return;
      }

      if (departureDate && arrivalDate && new Date(arrivalDate) < new Date(departureDate)) {
        Seav.notify(
          "error",
          "Check the dates",
          "Arrival date cannot be before the departure date."
        );
        return;
      }

      const entries = await loadNavEntries();
      const exists = entries.some(
        (entry) =>
          entry.id !== editId &&
          normalizeText(entry.fromPort) === normalizeText(fromDetails.portName) &&
          normalizeText(entry.toPort) === normalizeText(toDetails.portName) &&
          normalizeText(entry.fromCountry || "") === normalizeText(fromDetails.country || "") &&
          normalizeText(entry.toCountry || "") === normalizeText(toDetails.country || "") &&
          entry.vesselId === vesselId &&
          (entry.departureDate || entry.visitedDate || "") === (departureDate || "") &&
          (entry.arrivalDate || "") === (arrivalDate || "")
      );

      if (exists) {
        Seav.notify("info", "Already logged", "This passage is already on your chart.");
        return;
      }

      try {
        await Seav.withSaving(async () => {
        const existing = editId ? entries.find((entry) => entry.id === editId) || null : null;
        const payload = {
          id: editId || window.SeavData.createId("nav"),
          fromCountry: fromDetails.country,
          fromPort: fromDetails.portName,
          fromLat: fromChartCoord.lat,
          fromLng: fromChartCoord.lng,
          toCountry: toDetails.country,
          toPort: toDetails.portName,
          toLat: toChartCoord.lat,
          toLng: toChartCoord.lng,
          country: toDetails.country,
          port: toDetails.portName,
          lat: toChartCoord.lat,
          lng: toChartCoord.lng,
          vesselId,
          seatimeId,
          operationType,
          passageName,
          visitedDate,
          departureDate,
          arrivalDate,
          note,
          waypoints: formWaypoints.map((wp) => ({
            lat: wp.lat,
            lng: wp.lng,
            label: wp.label || ""
          }))
        };

        if (editId) {
          await SeavAPI.updateItemById(STORAGE_KEY, editId, {
            ...existing,
            ...payload,
            id: editId
          });
        } else {
          await SeavAPI.addItem(STORAGE_KEY, payload);
        }

        clearNavEditForm();
        populateVesselOptions();
        populateSeatimeOptions();

        if (window.SeavState?.refresh) {
          await window.SeavState.refresh();
        }

        await refreshMap();
        await renderNavEntriesList();

        Seav.notify(
          "success",
          editId ? "Passage updated" : "Passage logged",
          `${fromDetails.portName} → ${toDetails.portName} ${editId ? "updated on" : "added to"} your chart.`
        );

        if (window.Seav.app?.refreshAll) {
          await window.Seav.app.refreshAll();
        }
        }, { sub: editId ? "Updating navigation passage" : "Logging navigation passage" });
      } catch (error) {
        console.error("[SEA-V] Navigation passage save failed:", error);
        const detail =
          error?.message ||
          error?.error_description ||
          error?.hint ||
          "The passage could not be saved. Check your connection and database columns.";
        Seav.notify("error", "Save failed", detail);
      }
    });

    document.addEventListener("click", async (e) => {
      const editBtn = e.target.closest("[data-edit-nav-id]");
      if (editBtn) {
        e.preventDefault();

        const id = editBtn.getAttribute("data-edit-nav-id");
        const entries = await loadNavEntries();
        const entry = entries.find((item) => item.id === id);

        if (!entry) {
          Seav.notify("error", "Not found", "That passage could not be loaded.");
          return;
        }

        fillNavForm(entry);
        return;
      }

      const delBtn = e.target.closest("[data-del-nav-id]");
      if (!delBtn) return;

      e.preventDefault();

      const id = delBtn.getAttribute("data-del-nav-id");
      const entry = normalizeNavEntry(
        (window.SeavState?.navigationAreas || []).find((item) => item.id === id) || {}
      );
      const routeLabel = formatRouteLabel(entry);

      if (
        !Seav.confirmDelete({
          itemName: routeLabel,
          itemLabel: "navigation passage"
        })
      ) {
        return;
      }

      await SeavAPI.deleteItemById(STORAGE_KEY, id);

      if (document.getElementById("nav_edit_id")?.value.trim() === id) {
        clearNavEditForm();
        populateVesselOptions();
      }

      await refreshMap();
      await renderNavEntriesList();

      if (window.Seav.app?.refreshAll) {
        await window.Seav.app.refreshAll();
      }
    });
  }

  async function initNavigationData() {
    populateVesselOptions();
    populateSeatimeOptions();
    prefillFromSeatimeParam();
    await refreshMap();
    await renderNavEntriesList();
  }

  async function initNavigationPage() {
    initForm();
    try {
      initNavigationMap();
    } catch (error) {
      console.warn("[SEA-V] Map init failed:", error);
    }

    if (window.SeavState?.ready) {
      await initNavigationData();
      return;
    }

    document.addEventListener(
      "seav:state-ready",
      () => {
        initNavigationData().catch((error) => {
          console.warn("[SEA-V] Navigation refresh failed:", error);
        });
      },
      { once: true }
    );
  }

  document.addEventListener("DOMContentLoaded", () => {
    initNavigationPage();
  });

  document.addEventListener("seav:data-updated", async () => {
    populateVesselOptions();
    populateSeatimeOptions(document.getElementById("navSeatime")?.value || "");
    await refreshMap();
    await renderNavEntriesList();
  });
})();
