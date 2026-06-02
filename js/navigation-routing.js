// /js/navigation-routing.js — ocean-only passage paths for the globe
(function () {
  "use strict";

  const EARTH_RADIUS_NM = 3440.065;
  const HUB_SNAP_NM = 150;
  const PORT_HUB_SNAP_NM = 120;
  const PORT_PORT_MAX_NM = 95;
  const ENDPOINT_MAX_NM = 45;

  // Sea-lane hubs (open water / fairway nodes)
  const WAYPOINTS = [
    { id: "antibes", lat: 43.5804, lng: 7.1251 },
    { id: "nice", lat: 43.7102, lng: 7.262 },
    { id: "monaco", lat: 43.7384, lng: 7.4246 },
    { id: "cannes", lat: 43.5528, lng: 7.0174 },
    { id: "saint_tropez", lat: 43.2677, lng: 6.6407 },
    { id: "marseille", lat: 43.2965, lng: 5.3698 },
    { id: "toulon", lat: 43.1242, lng: 5.928 },
    { id: "bonifacio", lat: 41.387, lng: 9.159 },
    { id: "barcelona", lat: 41.3874, lng: 2.1686 },
    { id: "valencia", lat: 39.4699, lng: -0.3763 },
    { id: "palma", lat: 39.5696, lng: 2.6502 },
    { id: "ibiza", lat: 38.9067, lng: 1.4206 },
    { id: "genoa", lat: 44.4056, lng: 8.9463 },
    { id: "la_spezia", lat: 44.1025, lng: 9.8241 },
    { id: "naples", lat: 40.8518, lng: 14.2681 },
    { id: "palermo", lat: 38.1157, lng: 13.3615 },
    { id: "malta", lat: 35.8989, lng: 14.5146 },
    { id: "split", lat: 43.5081, lng: 16.4402 },
    { id: "dubrovnik", lat: 42.6507, lng: 18.0944 },
    { id: "venice", lat: 45.4408, lng: 12.3155 },
    { id: "corfu", lat: 39.6243, lng: 19.9217 },
    { id: "athens", lat: 37.942, lng: 23.646 },
    { id: "rhodes", lat: 36.4341, lng: 28.2176 },
    { id: "istanbul", lat: 41.0082, lng: 28.9784 },
    { id: "alexandria", lat: 31.2001, lng: 29.9187 },
    { id: "port_said", lat: 31.2653, lng: 32.3019 },
    { id: "suez", lat: 30.0, lng: 32.35 },
    { id: "limassol", lat: 34.7071, lng: 33.0226 },
    { id: "gibraltar", lat: 36.1408, lng: -5.3536 },
    { id: "lisbon", lat: 38.7223, lng: -9.1393 },
    { id: "porto", lat: 41.1579, lng: -8.6291 },
    { id: "brest", lat: 48.3904, lng: -4.4861 },
    { id: "channel", lat: 50.2, lng: -1.2 },
    { id: "southampton", lat: 50.9097, lng: -1.4044 },
    { id: "amsterdam", lat: 52.3676, lng: 4.9041 },
    { id: "rotterdam", lat: 51.9244, lng: 4.4777 },
    { id: "hamburg", lat: 53.5511, lng: 9.9937 },
    { id: "oslo", lat: 59.9139, lng: 10.7522 },
    { id: "bergen", lat: 60.3913, lng: 5.3221 },
    { id: "copenhagen", lat: 55.6761, lng: 12.5683 },
    { id: "le_havre", lat: 49.4944, lng: 0.1079 },
    { id: "cork", lat: 51.8503, lng: -8.2943 },
    { id: "dublin", lat: 53.3498, lng: -6.2603 },
    { id: "shetland", lat: 60.5, lng: -1.0 },
    { id: "faroes", lat: 62.0, lng: -6.8 },
    { id: "reykjavik", lat: 64.1466, lng: -21.9426 },
    { id: "akureyri", lat: 65.6835, lng: -18.1262 },
    { id: "nanortalik", lat: 60.1432, lng: -45.2408 },
    { id: "qaqortoq", lat: 60.7182, lng: -46.0354 },
    { id: "narsarsuaq", lat: 61.1609, lng: -45.4257 },
    { id: "davis_offshore", lat: 61.5, lng: -50.5 },
    { id: "paamiut", lat: 62.0117, lng: -49.6717 },
    { id: "nuuk", lat: 64.175, lng: -51.7389 },
    { id: "maniitsoq", lat: 65.4165, lng: -52.8983 },
    { id: "kangerlussuaq", lat: 67.0086, lng: -50.6897 },
    { id: "sisimiut", lat: 66.9393, lng: -53.6731 },
    { id: "aasiaat", lat: 68.7098, lng: -52.8699 },
    { id: "qasigiannguit", lat: 68.8194, lng: -51.1922 },
    { id: "ilulissat", lat: 69.2199, lng: -51.0986 },
    { id: "uummannaq", lat: 70.6747, lng: -52.1264 },
    { id: "upernavik", lat: 72.7869, lng: -56.1547 },
    { id: "qaanaaq", lat: 77.4674, lng: -69.2285 },
    { id: "kulusuk", lat: 65.5751, lng: -37.1453 },
    { id: "tasiilaq", lat: 65.6145, lng: -37.6365 },
    { id: "ittoqqortoormiit", lat: 70.4851, lng: -21.9669 },
    { id: "cape_farewell", lat: 59.75, lng: -43.5 },
    { id: "denmark_strait", lat: 64.0, lng: -28.0 },
    { id: "eg_offshore_mid", lat: 63.0, lng: -39.5 },
    { id: "eg_offshore_south", lat: 61.0, lng: -42.5 },
    { id: "azores", lat: 38.5, lng: -28.0 },
    { id: "canaries", lat: 28.1, lng: -15.4 },
    { id: "funchal", lat: 32.6669, lng: -16.9241 },
    { id: "miami", lat: 25.7617, lng: -80.1918 },
    { id: "fort_lauderdale", lat: 26.1224, lng: -80.1373 },
    { id: "nassau", lat: 25.0443, lng: -77.3504 },
    { id: "st_maarten", lat: 18.0425, lng: -63.0548 },
    { id: "st_barts", lat: 17.8963, lng: -62.8498 },
    { id: "nyc", lat: 40.6892, lng: -74.0445 },
    { id: "newport", lat: 41.4901, lng: -71.3128 },
    { id: "bermuda", lat: 32.3, lng: -64.75 },
    { id: "panama", lat: 9.0, lng: -79.6 },
    { id: "cartagena", lat: 10.391, lng: -75.4794 },
    { id: "cape_verde", lat: 16.5, lng: -24.0 },
    { id: "dakar", lat: 14.7167, lng: -17.4672 },
    { id: "durban", lat: -29.8587, lng: 31.0218 },
    { id: "mauritius", lat: -20.1609, lng: 57.5012 },
    { id: "galapagos", lat: -0.742, lng: -90.313 },
    { id: "acapulco", lat: 16.8531, lng: -99.8237 },
    { id: "hawaii", lat: 21.3069, lng: -157.8583 },
    { id: "los_angeles", lat: 33.7405, lng: -118.2775 },
    { id: "tokyo", lat: 35.6528, lng: 139.8395 },
    { id: "aden", lat: 12.8, lng: 45.0 },
    { id: "malacca", lat: 2.5, lng: 101.8 },
    { id: "singapore", lat: 1.3521, lng: 103.8198 },
    { id: "dubai", lat: 25.2048, lng: 55.2708 },
    { id: "mumbai", lat: 18.9388, lng: 72.8354 },
    { id: "cape_town", lat: -33.9249, lng: 18.4241 },
    { id: "sydney", lat: -33.8688, lng: 151.2093 },
    { id: "auckland", lat: -36.8509, lng: 174.7645 },
    { id: "ushuaia", lat: -54.8019, lng: -68.303 },
    { id: "punta_arenas", lat: -53.1638, lng: -70.9171 }
  ];

  const LINKS = [
    // French Riviera
    ["antibes", "nice"], ["nice", "monaco"], ["monaco", "cannes"], ["cannes", "antibes"],
    ["cannes", "saint_tropez"], ["saint_tropez", "toulon"], ["toulon", "marseille"],
    ["antibes", "marseille"], ["nice", "genoa"],
    // Western Med
    ["marseille", "bonifacio"], ["bonifacio", "barcelona"], ["bonifacio", "split"],
    ["barcelona", "valencia"], ["valencia", "palma"], ["barcelona", "palma"],
    ["palma", "ibiza"], ["ibiza", "barcelona"], ["gibraltar", "barcelona"],
    // Italy & Adriatic
    ["genoa", "la_spezia"], ["la_spezia", "naples"], ["naples", "palermo"],
    ["palermo", "malta"], ["genoa", "barcelona"], ["split", "dubrovnik"],
    ["dubrovnik", "corfu"], ["corfu", "athens"], ["venice", "split"],
    ["venice", "dubrovnik"], ["split", "bonifacio"],
    // Eastern Med
    ["malta", "athens"], ["athens", "rhodes"], ["rhodes", "limassol"],
    ["limassol", "alexandria"], ["alexandria", "port_said"], ["port_said", "suez"],
    ["athens", "istanbul"], ["istanbul", "limassol"],
    // Atlantic Europe
    ["lisbon", "porto"], ["lisbon", "gibraltar"], ["gibraltar", "malta"],
    ["gibraltar", "canaries"], ["porto", "brest"], ["brest", "le_havre"],
    ["le_havre", "channel"], ["brest", "channel"], ["channel", "southampton"],
    ["channel", "cork"], ["southampton", "cork"], ["cork", "dublin"],
    ["channel", "amsterdam"], ["amsterdam", "rotterdam"], ["rotterdam", "hamburg"],
    ["hamburg", "copenhagen"], ["copenhagen", "oslo"], ["hamburg", "oslo"],
    ["oslo", "bergen"], ["bergen", "shetland"], ["shetland", "faroes"],
    ["faroes", "reykjavik"], ["bergen", "reykjavik"], ["reykjavik", "akureyri"],
    ["reykjavik", "kulusuk"], ["reykjavik", "denmark_strait"],
    ["denmark_strait", "eg_offshore_mid"], ["eg_offshore_mid", "eg_offshore_south"],
    ["eg_offshore_south", "cape_farewell"], ["kulusuk", "eg_offshore_mid"],
    ["kulusuk", "tasiilaq"], ["tasiilaq", "ittoqqortoormiit"],
    ["cape_farewell", "nanortalik"], ["nanortalik", "qaqortoq"], ["qaqortoq", "narsarsuaq"],
    ["narsarsuaq", "davis_offshore"], ["davis_offshore", "paamiut"], ["davis_offshore", "nuuk"],
    ["nuuk", "maniitsoq"],
    ["maniitsoq", "sisimiut"], ["nuuk", "kangerlussuaq"],
    ["kangerlussuaq", "sisimiut"], ["sisimiut", "aasiaat"], ["aasiaat", "qasigiannguit"],
    ["qasigiannguit", "ilulissat"], ["ilulissat", "uummannaq"], ["uummannaq", "upernavik"],
    ["upernavik", "qaanaaq"], ["southampton", "shetland"], ["azores", "lisbon"], ["canaries", "funchal"],
    ["funchal", "azores"],
    // Transatlantic & US
    ["azores", "bermuda"], ["bermuda", "nyc"], ["nyc", "newport"],
    ["nyc", "miami"], ["bermuda", "miami"], ["miami", "fort_lauderdale"],
    ["fort_lauderdale", "nassau"], ["nassau", "miami"], ["miami", "st_maarten"],
    ["st_maarten", "st_barts"], ["st_maarten", "nassau"],
    // Americas & Panama-Pacific
    ["panama", "cartagena"], ["cartagena", "miami"], ["panama", "miami"],
    ["canaries", "cape_verde"], ["cape_verde", "dakar"],
    ["dakar", "cape_town"], ["cape_town", "durban"], ["durban", "mauritius"],
    ["mauritius", "malacca"], ["panama", "galapagos"], ["galapagos", "hawaii"],
    ["hawaii", "los_angeles"], ["hawaii", "tokyo"], ["panama", "acapulco"],
    ["acapulco", "los_angeles"],
    // Indian Ocean & Asia
    ["suez", "aden"], ["aden", "mumbai"], ["mumbai", "dubai"],
    ["dubai", "malacca"], ["malacca", "singapore"], ["singapore", "sydney"],
    ["sydney", "auckland"], ["cape_town", "funchal"], ["cape_town", "mumbai"],
    ["mauritius", "mumbai"], ["canaries", "cartagena"],
    // South America
    ["punta_arenas", "ushuaia"]
  ];

  const waypointById = new Map(WAYPOINTS.map((point) => [point.id, point]));
  const graph = new Map();

  function toRad(value) {
    return (value * Math.PI) / 180;
  }

  function haversineNm(lat1, lng1, lat2, lng2) {
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_NM * Math.asin(Math.sqrt(a));
  }

  function makePortId(country, port) {
    return `port_${country}_${port}`.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  }

  function ensureNode(id, lat, lng) {
    if (!waypointById.has(id)) {
      waypointById.set(id, { id, lat, lng, isPort: id.startsWith("port_") });
    }
    if (!graph.has(id)) graph.set(id, []);
  }

  function addGraphEdge(fromId, toId) {
    const from = waypointById.get(fromId);
    const to = waypointById.get(toId);
    if (!from || !to) return;

    const distance = haversineNm(from.lat, from.lng, to.lat, to.lng);
    if (!graph.has(fromId)) graph.set(fromId, []);
    if (!graph.has(toId)) graph.set(toId, []);

    const fromNeighbors = graph.get(fromId);
    if (!fromNeighbors.some((neighbor) => neighbor.id === toId)) {
      fromNeighbors.push({ id: toId, distance });
    }

    const toNeighbors = graph.get(toId);
    if (!toNeighbors.some((neighbor) => neighbor.id === fromId)) {
      toNeighbors.push({ id: fromId, distance });
    }
  }

  LINKS.forEach(([fromId, toId]) => addGraphEdge(fromId, toId));

  function registerPortNodes() {
    const ports = window.SeavNavigationPorts?.PORTS || [];
    const portNodes = [];

    ports.forEach(({ country, port, lat, lng }) => {
      const id = makePortId(country, port);
      ensureNode(id, lat, lng);
      portNodes.push({ id, lat, lng });

      const hubs = WAYPOINTS.map((hub) => ({
        ...hub,
        distance: haversineNm(lat, lng, hub.lat, hub.lng)
      }))
        .filter((hub) => hub.distance <= PORT_HUB_SNAP_NM)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3);

      hubs.forEach((hub) => addGraphEdge(id, hub.id));
    });

    for (let i = 0; i < portNodes.length; i += 1) {
      for (let j = i + 1; j < portNodes.length; j += 1) {
        const a = portNodes[i];
        const b = portNodes[j];
        const distance = haversineNm(a.lat, a.lng, b.lat, b.lng);
        if (distance <= PORT_PORT_MAX_NM) {
          addGraphEdge(a.id, b.id);
        }
      }
    }
  }

  registerPortNodes();

  const POLAR_NODE_IDS = new Set([
    "reykjavik", "akureyri", "faroes", "shetland", "bergen", "oslo", "copenhagen",
    "qaanaaq", "upernavik", "uummannaq", "ilulissat", "qasigiannguit", "aasiaat",
    "sisimiut", "kangerlussuaq", "maniitsoq", "nuuk", "paamiut", "narsarsuaq",
    "qaqortoq", "nanortalik", "kulusuk", "tasiilaq", "ittoqqortoormiit", "cape_farewell"
  ]);

  const SUEZ_NODE_IDS = new Set(["suez", "port_said", "alexandria", "aden"]);

  function isPolarDestination(lat, lng) {
    return lat >= 58 || (lat >= 55 && lng <= -12);
  }

  function prefersSouthernOceanRoute(fromLat, toLat, toLng) {
    if (fromLat < 30) return false;
    if (toLat <= 5) return true;
    if (toLng >= 95 && fromLat >= 35) return true;
    return false;
  }

  function pointInGreenlandLand(lat, lng) {
    if (lat < 59.5 || lat > 83) return false;
    if (lng < -58 || lng > -12) return false;
    if (lat < 61.5 && lng < -47) return false;
    if (lat < 60.8 && lng > -46) return false;
    return true;
  }

  function segmentCrossesGreenland(a, b) {
    for (let step = 1; step < 10; step += 1) {
      const t = step / 10;
      const lat = a[0] + (b[0] - a[0]) * t;
      const lng = a[1] + (b[1] - a[1]) * t;
      if (pointInGreenlandLand(lat, lng)) return true;
    }
    return false;
  }

  function pathCrossesGreenland(coords) {
    for (let i = 0; i < coords.length - 1; i += 1) {
      if (segmentCrossesGreenland(coords[i], coords[i + 1])) return true;
    }
    return false;
  }

  function pathLengthNm(coords) {
    let total = 0;
    for (let i = 1; i < coords.length; i += 1) {
      total += haversineNm(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
    }
    return total;
  }

  function dedupeCoords(coords) {
    const output = [];
    coords.forEach((coord) => {
      const prev = output[output.length - 1];
      if (!prev || prev[0] !== coord[0] || prev[1] !== coord[1]) {
        output.push(coord);
      }
    });
    return output;
  }

  function nearestNodes(lat, lng, { maxNm = HUB_SNAP_NM, count = 5, portsOnly = false } = {}) {
    const nodes = [];
    const unlimited = maxNm === null || maxNm === Infinity;

    waypointById.forEach((point) => {
      if (portsOnly && !point.isPort && !point.id.startsWith("port_")) return;
      const distance = haversineNm(lat, lng, point.lat, point.lng);
      if (unlimited || distance <= maxNm) {
        nodes.push({ ...point, distance });
      }
    });

    return nodes.sort((a, b) => a.distance - b.distance).slice(0, count);
  }

  function nodeRoutePenalty(nodeId, routeBias) {
    let penalty = 0;

    if (routeBias.southernPreferred) {
      if (SUEZ_NODE_IDS.has(nodeId)) penalty += 20000;
      if (nodeId === "cape_town") penalty -= 5000;
    }

    if (!routeBias.polarDestination && POLAR_NODE_IDS.has(nodeId)) {
      penalty += 20000;
    }

    return penalty;
  }

  function getRouteBias(fromLat, toLat, toLng) {
    return {
      southernPreferred: prefersSouthernOceanRoute(fromLat, toLat, toLng),
      polarDestination: isPolarDestination(toLat, toLng)
    };
  }

  function dijkstra(startId, endId, routeBias = getRouteBias(0, 0, 0)) {
    if (startId === endId) return [startId];

    const distances = new Map([[startId, 0]]);
    const previous = new Map();
    const unvisited = new Set(graph.keys());

    while (unvisited.size) {
      let current = null;
      let currentDistance = Infinity;

      unvisited.forEach((id) => {
        const distance = distances.get(id);
        if (distance !== undefined && distance < currentDistance) {
          current = id;
          currentDistance = distance;
        }
      });

      if (current === null) break;
      if (current === endId) break;
      unvisited.delete(current);

      (graph.get(current) || []).forEach((neighbor) => {
        if (!unvisited.has(neighbor.id)) return;
        const alt =
          currentDistance +
          neighbor.distance +
          nodeRoutePenalty(neighbor.id, routeBias);
        if (alt < (distances.get(neighbor.id) ?? Infinity)) {
          distances.set(neighbor.id, alt);
          previous.set(neighbor.id, current);
        }
      });
    }

    if (!previous.has(endId) && startId !== endId) return null;

    const path = [endId];
    let cursor = endId;
    while (previous.has(cursor)) {
      cursor = previous.get(cursor);
      path.unshift(cursor);
    }

    return path[0] === startId ? path : null;
  }

  function coordsFromNodePath(fromLat, fromLng, nodePath, toLat, toLng) {
    const coords = [];

    const firstNode = waypointById.get(nodePath[0]);
    const lastNode = waypointById.get(nodePath[nodePath.length - 1]);

    if (haversineNm(fromLat, fromLng, firstNode.lat, firstNode.lng) <= ENDPOINT_MAX_NM) {
      coords.push([fromLat, fromLng]);
    }

    nodePath.forEach((id) => {
      const point = waypointById.get(id);
      if (point) coords.push([point.lat, point.lng]);
    });

    if (haversineNm(toLat, toLng, lastNode.lat, lastNode.lng) <= ENDPOINT_MAX_NM) {
      coords.push([toLat, toLng]);
    }

    return dedupeCoords(coords);
  }

  function scoreNodePath(fromLat, fromLng, nodePath, toLat, toLng) {
    const coords = coordsFromNodePath(fromLat, fromLng, nodePath, toLat, toLng);
    const distanceNm = pathLengthNm(coords);
    let penalty = 0;
    const lastCoord = coords[coords.length - 1];
    const endGap = lastCoord
      ? haversineNm(toLat, toLng, lastCoord[0], lastCoord[1])
      : Infinity;

    if (endGap > ENDPOINT_MAX_NM) {
      penalty += 50000;
    }

    if (!isPolarDestination(toLat, toLng) && nodePath.some((id) => POLAR_NODE_IDS.has(id))) {
      penalty += 15000;
    }

    if (prefersSouthernOceanRoute(fromLat, toLat, toLng)) {
      if (nodePath.some((id) => SUEZ_NODE_IDS.has(id))) penalty += 15000;
      if (nodePath.includes("cape_town")) penalty -= 4000;
    }

    if (pathCrossesGreenland(coords)) {
      penalty += 25000;
    }

    return {
      nodePath,
      coords,
      distanceNm,
      score: distanceNm + penalty
    };
  }

  function findBestNodePath(fromLat, fromLng, toLat, toLng) {
    const routeBias = getRouteBias(fromLat, toLat, toLng);
    const candidateSets = [
      {
        startCandidates: nearestNodes(fromLat, fromLng, { maxNm: 8, count: 2, portsOnly: true }),
        endCandidates: nearestNodes(toLat, toLng, { maxNm: 8, count: 2, portsOnly: true })
      },
      {
        startCandidates: nearestNodes(fromLat, fromLng, { maxNm: HUB_SNAP_NM, count: 6 }),
        endCandidates: nearestNodes(toLat, toLng, { maxNm: 40, count: 6 })
      },
      {
        startCandidates: nearestNodes(fromLat, fromLng, { maxNm: null, count: 10 }),
        endCandidates: nearestNodes(toLat, toLng, { maxNm: null, count: 10 })
      }
    ];

    let best = null;

    candidateSets.forEach(({ startCandidates, endCandidates }) => {
      startCandidates.forEach((start) => {
        endCandidates.forEach((end) => {
          const nodePath = dijkstra(start.id, end.id, routeBias);
          if (!nodePath) return;

          const scored = scoreNodePath(fromLat, fromLng, nodePath, toLat, toLng);
          if (!best || scored.score < best.score) {
            best = scored;
          }
        });
      });
    });

    return best;
  }

  function buildGraphRoute(fromLat, fromLng, toLat, toLng) {
    const best = findBestNodePath(fromLat, fromLng, toLat, toLng);

    if (best?.coords?.length >= 2) {
      return {
        coords: best.coords,
        distanceNm: best.distanceNm ?? pathLengthNm(best.coords)
      };
    }

    // Last resort: keep the line short so it does not cut across continents.
    const start = nearestNodes(fromLat, fromLng, { maxNm: ENDPOINT_MAX_NM, count: 1 })[0];
    const end = nearestNodes(toLat, toLng, { maxNm: ENDPOINT_MAX_NM, count: 1 })[0];

    if (start && end && start.id !== end.id) {
      const routeBias = getRouteBias(fromLat, toLat, toLng);
      const nodePath = dijkstra(start.id, end.id, routeBias);
      if (nodePath) {
        const coords = coordsFromNodePath(fromLat, fromLng, nodePath, toLat, toLng);
        return { coords, distanceNm: pathLengthNm(coords) };
      }
    }

    const straightNm = haversineNm(fromLat, fromLng, toLat, toLng);
    const coords = dedupeCoords([
      [fromLat, fromLng],
      ...(start ? [[start.lat, start.lng]] : []),
      ...(end ? [[end.lat, end.lng]] : []),
      [toLat, toLng]
    ]);

    if (straightNm > 150 && coords.length <= 3) {
      console.warn("[SEA-V] No sea lane found — route may be incomplete.");
    }

    return {
      coords,
      distanceNm: pathLengthNm(coords)
    };
  }

  function buildSeaRoute(fromLat, fromLng, toLat, toLng) {
    return Promise.resolve(buildGraphRoute(fromLat, fromLng, toLat, toLng));
  }

  window.SeavNavigationRouting = {
    buildSeaRoute,
    pathLengthNm
  };
})();
