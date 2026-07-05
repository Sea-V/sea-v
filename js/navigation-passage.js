// /js/navigation-passage.js — route building and recommended passages
(function () {
  "use strict";

  const H = window.SeavNavigationHelpers;
  if (!H) return;

  const {
    haversineNm, roundCoord, normalizeText, normalizeWaypointList, entryHasRoute, pathLengthNm,
    getVesselColor, getVesselName
  } = H;

  async function buildLegRoute(a, b) {
    const cacheKey = `${roundCoord(a.lat)},${roundCoord(a.lng)}|${roundCoord(b.lat)},${roundCoord(b.lng)}`;
    if (buildLegRoute._cache?.has(cacheKey)) {
      return buildLegRoute._cache.get(cacheKey);
    }

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

    if (!buildLegRoute._cache) {
      buildLegRoute._cache = new Map();
    }
    if (buildLegRoute._cache.size > 200) {
      buildLegRoute._cache.clear();
    }
    buildLegRoute._cache.set(cacheKey, coords);

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

  const entryRouteCache = new Map();
  const MAX_ENTRY_ROUTE_CACHE = 64;

  function buildEntryRouteKey(entry) {
    const wps = normalizeWaypointList(entry.waypoints);
    return [
      entry.id || "",
      roundCoord(entry.fromLat),
      roundCoord(entry.fromLng),
      roundCoord(entry.toLat),
      roundCoord(entry.toLng),
      wps.map((wp) => `${roundCoord(wp.lat)},${roundCoord(wp.lng)}`).join("|")
    ].join(";");
  }

  function trimEntryRouteCache() {
    if (entryRouteCache.size <= MAX_ENTRY_ROUTE_CACHE) return;
    const keys = [...entryRouteCache.keys()];
    keys.slice(0, keys.length - MAX_ENTRY_ROUTE_CACHE).forEach((key) => {
      entryRouteCache.delete(key);
    });
  }

  async function getEntryRoute(entry) {
    if (!entryHasRoute(entry)) return null;

    const key = buildEntryRouteKey(entry);
    if (entryRouteCache.has(key)) {
      return entryRouteCache.get(key);
    }

    const route = await buildRouteForEntry(entry);
    entryRouteCache.set(key, route);
    trimEntryRouteCache();
    return route;
  }

  function clearEntryRouteCache() {
    entryRouteCache.clear();
    if (buildLegRoute._cache) buildLegRoute._cache.clear();
  }

  async function buildPassagePaths(entries) {
    const routedEntries = entries.filter(entryHasRoute);

    const paths = await Promise.all(
      routedEntries.map(async (entry) => {
        const route = await getEntryRoute(entry);
        if (!route?.coords?.length) return null;

        return {
          coords: route.coords,
          color: getVesselColor(entry.vesselId),
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
        };
      })
    );

    return paths.filter(Boolean);
  }


  window.SeavNavigationPassage = {
    buildLegRoute,
    buildDirectLeg,
    buildRecommendedPassageWaypoints,
    buildRouteThroughAnchors,
    buildRouteForEntry,
    getEntryRoute,
    clearEntryRouteCache,
    buildPassagePaths,
    RECOMMENDED_PASSAGE_POINTS
  };
})();
