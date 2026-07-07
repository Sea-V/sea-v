// /js/dashboard-snippets.js — dashboard card renderers
(function () {
  "use strict";

  if (!window.Seav || !window.SeavState || !window.SeavData || !window.SeavCards) {
    console.warn("[SEA-V] Dashboard snippets dependencies missing.");
    return;
  }

  const Seav = window.Seav;
  const {
    totalQualifyingDays,
    getCertExpiryInfo,
    getReferenceStatus,
    formatDatePretty
  } = window.SeavData;

  const DASH_NAV_TILE_URL =
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  const DASH_NAV_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
  const DASH_NAV_WORLD_BOUNDS = [[-85, -180], [85, 180]];
  const DASH_NAV_MOUNT_RETRY_DELAYS = [900, 1800];

  let dashNavigationChart = null;
  let dashNavigationLayer = null;
  let dashNavigationRenderId = 0;

  function updateCardTitle(containerId, baseTitle, count) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const card = container.closest(".dash-card");
    if (!card) return;

    const heading = card.querySelector(".dashboard-card-headline h3, .dash-card > h3");
    if (!heading) return;

    heading.textContent = `${baseTitle} (${count})`;
  }

  const haversineNm = window.SeavData.haversineNm;
  const formatNm = window.SeavData.formatNm;

  async function renderSeatimeSnippet() {
    const dashSeatimeSnippet = document.getElementById("dashSeatimeSnippet");
    if (!dashSeatimeSnippet) return;

    const seatimes = window.SeavState?.seatimes || [];
    updateCardTitle("dashSeatimeSnippet", "Sea time", seatimes.length);

    if (!seatimes.length) {
      dashSeatimeSnippet.innerHTML = `<div class="muted">No sea service yet.</div>`;
      return;
    }

    const latestThree = [...seatimes]
      .sort((a, b) => {
        const da = a.dateJoined ? new Date(a.dateJoined) : new Date(0);
        const db = b.dateJoined ? new Date(b.dateJoined) : new Date(0);
        return db - da;
      })
      .slice(0, 3);

    dashSeatimeSnippet.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Vessel Name</th>
              <th>Flag / GT</th>
              <th>Capacity Served</th>
              <th>Date Joined</th>
              <th>Date Left</th>
              <th>Total Qualifying Service</th>
              <th>Verification Status</th>
            </tr>
          </thead>
          <tbody>
            ${latestThree.map((item) => {
              const flagGt = [
                item.flag ? Seav.escapeHtml(item.flag) : "—",
                item.gt ? `${Seav.escapeHtml(item.gt)} GT` : "—"
              ].join(" • ");

              return `
                <tr>
                  <td>${Seav.escapeHtml(
                  (window.SeavState?.vessels || []).find((v) => v.id === item.vesselId)?.name || "—"
                  )}</td>
                  <td>${flagGt}</td>
                  <td>${Seav.escapeHtml(item.capacityServed || "—")}</td>
                  <td>${Seav.escapeHtml(item.dateJoined || "—")}</td>
                  <td>${Seav.escapeHtml(item.dateLeft || "—")}</td>
                  <td>${totalQualifyingDays(item)}</td>
                  <td><span class="pill">${Seav.escapeHtml(item.verificationStatus || "Logged")}</span></td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

const DASH_CERT_WARNING_DAYS = 90;

function updateCertCardCompleteState(displayCount, attentionCount) {
  const container = document.getElementById("dashCertSnippet");
  const badge = document.getElementById("dashboardCertCompleteBadge");
  const card = container?.closest(".dash-card");
  const heading = card?.querySelector(".dashboard-card-headline h3, .dash-card > h3");

  if (heading) {
    heading.textContent =
      displayCount > 0 ? `Certificates (${displayCount})` : "Certificates";
  }

  if (badge) badge.hidden = attentionCount > 0;
}

async function renderCertSnippet() {
  const dashCertSnippet = document.getElementById("dashCertSnippet");
  if (!dashCertSnippet) return;

  const certs = (window.SeavState?.certs || []).filter(
    (cert) => window.SeavData?.isSavedCert?.(cert) ?? !!cert?.name
  );

  const isNoExpiry = window.SeavData?.isCertNoExpiry;
  const isExpiringOrExpired = window.SeavData?.isCertExpiringOrExpired;

  const expiryCerts = certs.filter((cert) => {
    if (isNoExpiry?.(cert)) return false;
    return !!String(cert.expiry || "").trim();
  });

  const attentionCerts = expiryCerts.filter((cert) =>
    isExpiringOrExpired?.(cert, DASH_CERT_WARNING_DAYS)
  );

  updateCertCardCompleteState(expiryCerts.length, attentionCerts.length);

  if (!expiryCerts.length) {
    dashCertSnippet.innerHTML = `
      <p class="dashboard-cert-attention-note muted">
        ${
          certs.length
            ? "No certificates with expiry dates yet. Add expiry dates on the certificates page to track renewals here."
            : "No certificates yet."
        }
      </p>
    `;
    return;
  }

  function getDashboardCertStatus(cert) {
    return getCertExpiryInfo(cert.expiry, { warningDays: DASH_CERT_WARNING_DAYS });
  }

  const sortedCerts = [...expiryCerts].sort((a, b) => {
    const aInfo = getDashboardCertStatus(a);
    const bInfo = getDashboardCertStatus(b);

    const score = (info) => {
      const badge = String(info.badge || "").toLowerCase();
      if (badge === "expired") return 0;
      if (badge === "expires soon") return 1;
      return 2;
    };

    const aScore = score(aInfo);
    const bScore = score(bInfo);

    if (aScore !== bScore) return aScore - bScore;

    const aDate = a.expiry ? new Date(a.expiry) : new Date("9999-12-31");
    const bDate = b.expiry ? new Date(b.expiry) : new Date("9999-12-31");
    return aDate - bDate;
  });

  dashCertSnippet.innerHTML = `
    <div class="list">
      ${sortedCerts
        .map((cert) => {
          const statusInfo = getDashboardCertStatus(cert);
          const expiryDisplay = cert.expiry ? formatDatePretty(cert.expiry) : "—";

          return `
            <div class="list-row">
              <div style="min-width:0;">
                <div class="list-title">
                  ${Seav.escapeHtml(cert.code || "—")} • ${Seav.escapeHtml(cert.name || "—")}
                </div>
                <div class="list-sub">
                  Expiry: ${Seav.escapeHtml(expiryDisplay)} • ${Seav.escapeHtml(statusInfo.label)}
                </div>
              </div>
              <span class="${statusInfo.statusClass}">${Seav.escapeHtml(statusInfo.badge)}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

 async function renderVesselSnippet() {
  const dashVesselSnippet = document.getElementById("dashVesselSnippet");
  if (!dashVesselSnippet) return;

  const vessels = window.SeavState?.vessels || [];
  updateCardTitle("dashVesselSnippet", "Vessels", vessels.length);

  if (!vessels.length) {
    dashVesselSnippet.innerHTML = `<div class="muted">No vessels yet.</div>`;
    return;
  }

  const latestThree = [...vessels]
    .sort((a, b) => {
      const da = a.from ? new Date(a.from) : new Date(0);
      const db = b.from ? new Date(b.from) : new Date(0);
      return db - da;
    })
    .slice(0, 3);

  const vesselPhotoBucket =
    window.SeavApiCore?.STORAGE_BUCKETS?.VESSEL_PHOTOS || "vessel-photos";
  if (window.SeavApiCore?.hydrateItemsFileField) {
    await window.SeavApiCore.hydrateItemsFileField(
      latestThree,
      "photo",
      vesselPhotoBucket
    );
    window.SeavState?.syncCache?.();
  }

  dashVesselSnippet.innerHTML = `
    <div class="dash-mini-card-grid">
      ${latestThree
        .map((vessel) =>
          window.SeavCards.buildVesselCard(vessel, { photoBucket: vesselPhotoBucket })
        )
        .join("")}
    </div>
  `;
}

async function renderTenderSnippet() {
  const dashTenderSnippet = document.getElementById("dashTenderSnippet");
  if (!dashTenderSnippet) return;

  const tenders = window.SeavState?.tenders || [];
  updateCardTitle("dashTenderSnippet", "Tenders", tenders.length);

  if (!tenders.length) {
    dashTenderSnippet.innerHTML = `<div class="muted">No tenders yet.</div>`;
    return;
  }

  const latestThree = [...tenders].slice().reverse().slice(0, 3);

  if (window.SeavApiCore?.hydrateItemsFileField) {
    await window.SeavApiCore.hydrateItemsFileField(
      latestThree,
      "photo",
      window.SeavApiCore.STORAGE_BUCKETS?.TENDER_PHOTOS || "tender-photos"
    );
    window.SeavState?.syncCache?.();
  }

  const tenderPhotoBucket =
    window.SeavApiCore?.STORAGE_BUCKETS?.TENDER_PHOTOS || "tender-photos";

  dashTenderSnippet.innerHTML = `
    <div class="dash-mini-card-grid">
      ${latestThree
        .map((tender) =>
          window.SeavCards.buildTenderCard(tender, window.SeavState?.vessels || [], {
            photoBucket: tenderPhotoBucket
          })
        )
        .join("")}
    </div>
  `;
}

function getDashboardVesselName(vesselId) {
  if (!vesselId) return "Unassigned";
  return (window.SeavState?.vessels || []).find((v) => v.id === vesselId)?.name || "Unnamed vessel";
}

function getDashboardVesselColor(vesselId) {
  return window.SeavData?.getVesselColor?.(vesselId) || "#64748b";
}

function hasDashboardCoord(lat, lng) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  return Number.isFinite(latNum) && Number.isFinite(lngNum) && !(latNum === 0 && lngNum === 0);
}

function normalizeDashboardWaypoints(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((wp) => ({
      lat: Number(wp?.lat),
      lng: Number(wp?.lng),
      label: wp?.label ? String(wp.label) : ""
    }))
    .filter((wp) => hasDashboardCoord(wp.lat, wp.lng));
}

function getDashboardRouteCoords(entry) {
  const normalized = window.SeavNavigationHelpers?.normalizeNavEntry
    ? window.SeavNavigationHelpers.normalizeNavEntry(entry)
    : entry;
  const fromLat = Number(normalized.fromLat ?? normalized.from_lat ?? 0);
  const fromLng = Number(normalized.fromLng ?? normalized.from_lng ?? 0);
  const toLat = Number(normalized.toLat ?? normalized.lat ?? normalized.to_lat ?? 0);
  const toLng = Number(normalized.toLng ?? normalized.lng ?? normalized.to_lng ?? 0);
  const waypoints = normalizeDashboardWaypoints(normalized.waypoints);

  if (!hasDashboardCoord(fromLat, fromLng) || !hasDashboardCoord(toLat, toLng)) return [];
  if (fromLat === toLat && fromLng === toLng && !waypoints.length) return [];

  return [
    [fromLat, fromLng],
    ...waypoints.map((wp) => [wp.lat, wp.lng]),
    [toLat, toLng]
  ];
}

function getDashboardRouteDistance(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i += 1) {
    total += haversineNm(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
  }
  return total;
}

// Straight-line haversine understates real distance (it ignores land and sea
// lanes), which is why this used to show a different "Total distance" than
// navigation.html. When js/navigation-passage.js is loaded, look up each
// entry's routed distance (same calculation navigation.html's own log list
// uses — see js/navigation-list.js's buildDistanceMap) and prefer that;
// otherwise fall back to the straight-line sum so nothing breaks if that
// script isn't available.
async function buildDashboardDistanceMap(entries) {
  const distances = new Map();
  const P = window.SeavNavigationPassage;
  if (!P?.getEntryRoute) return distances;

  await Promise.all(
    entries.map(async (entry) => {
      try {
        const route = await P.getEntryRoute(entry);
        if (route?.distanceNm) distances.set(entry.id, route.distanceNm);
      } catch (error) {
        console.warn("[SEA-V] Dashboard routed distance failed:", error);
      }
    })
  );

  return distances;
}

function buildDashboardNavigationStats(entries, distanceMap) {
  const routeEntries = entries
    .map((entry) => ({ entry, coords: getDashboardRouteCoords(entry) }))
    .filter((item) => item.coords.length >= 2);
  const countries = new Set();
  const vessels = new Map();
  let totalNm = 0;

  routeEntries.forEach(({ entry, coords }) => {
    const routedNm = distanceMap?.get(entry.id);
    totalNm += Number.isFinite(routedNm) ? routedNm : getDashboardRouteDistance(coords);

    const fromCountry = entry.fromCountry || entry.from_country || "";
    const toCountry = entry.toCountry || entry.to_country || entry.country || "";
    if (fromCountry) countries.add(fromCountry);
    if (toCountry) countries.add(toCountry);

    const vesselId = entry.vesselId || entry.vessel_id || "";
    if (!vessels.has(vesselId)) {
      vessels.set(vesselId, {
        id: vesselId,
        name: getDashboardVesselName(vesselId),
        passages: 0,
        countries: new Set()
      });
    }
    const vessel = vessels.get(vesselId);
    vessel.passages += 1;
    if (fromCountry) vessel.countries.add(fromCountry);
    if (toCountry) vessel.countries.add(toCountry);
  });

  const vesselRows = [...vessels.values()]
    .sort((a, b) => b.passages - a.passages || a.name.localeCompare(b.name))
    .slice(0, 4);

  return {
    routes: routeEntries,
    totalNm,
    countries: countries.size,
    vessels: vessels.size,
    vesselRows
  };
}

function destroyDashboardNavigationChart() {
  dashNavigationRenderId += 1;
  if (!dashNavigationChart) return;
  try {
    dashNavigationChart.remove();
  } catch (error) {
    console.warn("[SEA-V] Dashboard nav chart cleanup:", error);
  }
  dashNavigationChart = null;
  dashNavigationLayer = null;
}

// Leaflet computes its tile grid against the container size at map creation.
// On first dashboard load the snippet HTML can exist before the grid has been
// painted, so wait for a measurable chart before mounting or fitting the map.
function whenDashboardChartContainerReady(container, callback) {
  const attempt = () => {
    if (!container?.isConnected) return false;
    const rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      callback();
      return true;
    }
    return false;
  };

  if (attempt()) return;

  window.requestAnimationFrame(() => {
    if (attempt()) return;
    window.requestAnimationFrame(() => {
      if (attempt()) return;
      window.setTimeout(callback, 300);
    });
  });
}

function hasDashboardNavLoadedTiles(container) {
  return !!container?.querySelector?.(".leaflet-tile-loaded");
}

// Surfaces failures on-screen instead of only in devtools console — added
// after a Safari-only "map not loading" report we couldn't reproduce or
// diagnose from a partial console screenshot. Two variants: a destructive
// one for total init failure (container is unusable anyway), and an
// additive one for partial failures (e.g. tiles blocked) where the map
// object is still alive and routes/polylines may still be worth showing.
function replaceDashboardNavShellWithDiagnostic(message) {
  const shell = document.querySelector(
    "#dashNavigationSnippet .dashboard-navigation-chart-shell"
  );
  if (shell) {
    shell.innerHTML = `<div class="muted" style="padding:12px;">${Seav.escapeHtml(message)}</div>`;
  }
}

function appendDashboardNavDiagnostic(message) {
  const shell = document.querySelector(
    "#dashNavigationSnippet .dashboard-navigation-chart-shell"
  );
  if (!shell || shell.querySelector(".dash-nav-diag")) return;
  const diag = document.createElement("div");
  diag.className = "muted dash-nav-diag";
  diag.style.cssText = "padding:6px 4px 0; font-size:12px;";
  diag.textContent = message;
  shell.appendChild(diag);
}

function initDashboardNavigationChart(container) {
  if (dashNavigationChart || !container || typeof L === "undefined") return false;

  try {
    // Keep the dashboard preview to one world copy. Leaflet tile layers wrap by
    // default; noWrap + maxBounds prevents the repeated-world view while still
    // allowing normal pan/zoom inside the real map extent.
    dashNavigationChart = L.map(container, {
      center: [30, 0],
      zoom: 2,
      minZoom: 2,
      maxBounds: DASH_NAV_WORLD_BOUNDS,
      maxBoundsViscosity: 1,
      worldCopyJump: false,
      zoomControl: true,
      attributionControl: true,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: false,
      doubleClickZoom: true,
      boxZoom: false,
      keyboard: false,
      preferCanvas: true
    });

    const tileLayer = L.tileLayer(DASH_NAV_TILE_URL, {
      attribution: DASH_NAV_ATTRIBUTION,
      subdomains: "abcd",
      maxZoom: 18,
      noWrap: true,
      bounds: DASH_NAV_WORLD_BOUNDS,
      keepBuffer: 2,
      updateWhenIdle: true
    }).addTo(dashNavigationChart);

    // If every tile request errors out (network block, ad/content blocker,
    // CSP) the map div stays visibly blank even though Leaflet "loaded" fine
    // — from the user's side that looks identical to "the map isn't
    // loading." This makes that failure mode visible without needing
    // devtools open.
    let tilesLoaded = 0;
    let tileErrors = 0;
    tileLayer.on("load", () => {
      tilesLoaded += 1;
    });
    tileLayer.on("tileerror", () => {
      tileErrors += 1;
      if (tileErrors >= 4 && tilesLoaded === 0) {
        appendDashboardNavDiagnostic(
          "Map tiles failed to load (network or content blocker) — routes are still listed below."
        );
      }
    });

    dashNavigationLayer = L.layerGroup().addTo(dashNavigationChart);
    return true;
  } catch (error) {
    console.error("[SEA-V] Dashboard nav chart init failed:", error);
    destroyDashboardNavigationChart();
    replaceDashboardNavShellWithDiagnostic(`Map failed to load: ${error?.message || error}`);
    return false;
  }
}

async function renderNavigationSnippet() {
  const box = document.getElementById("dashNavigationSnippet");
  if (!box) return;

  const entries = window.SeavState?.navigationAreas || [];
  updateCardTitle("dashNavigationSnippet", "Navigation chart", entries.length);

  destroyDashboardNavigationChart();

  if (!entries.length) {
    box.innerHTML = `<div class="muted">No passages logged yet.</div>`;
    return;
  }

  let distanceMap;
  let stats;
  try {
    distanceMap = await buildDashboardDistanceMap(entries);
    stats = buildDashboardNavigationStats(entries, distanceMap);
  } catch (error) {
    // Surface the real reason on-screen. Previously a throw here (before any
    // map code even ran) left the card silently blank with only a console
    // log — indistinguishable from "map not loading" but with a totally
    // different cause and fix.
    box.innerHTML = `<div class="muted" style="padding:12px;">Navigation chart failed to load: ${Seav.escapeHtml(error?.message || String(error))}</div>`;
    throw error;
  }

  box.innerHTML = `
    <div class="dashboard-navigation-layout">
      <div class="dashboard-navigation-chart-shell">
        <div class="dashboard-navigation-chart" id="dashNavigationChart"></div>
      </div>
      <div class="dashboard-navigation-stats">
        <div class="dashboard-navigation-stat">
          <span>Total distance</span>
          <strong>${Seav.escapeHtml(formatNm(stats.totalNm))}</strong>
        </div>
        <div class="dashboard-navigation-stat">
          <span>Passages</span>
          <strong>${stats.routes.length}</strong>
        </div>
        <div class="dashboard-navigation-stat">
          <span>Countries</span>
          <strong>${stats.countries}</strong>
        </div>
        <div class="dashboard-navigation-stat">
          <span>Vessels</span>
          <strong>${stats.vessels}</strong>
        </div>
        <div class="dashboard-navigation-vessel-list">
          ${stats.vesselRows.length
            ? stats.vesselRows
                .map((row) => `
                  <div class="dashboard-navigation-vessel-row">
                    <i style="background:${Seav.escapeHtml(getDashboardVesselColor(row.id))}"></i>
                    <span>${Seav.escapeHtml(row.name)}</span>
                    <b>${row.passages} / ${row.countries.size} countries</b>
                  </div>
                `)
                .join("")
            : `<div class="muted">No vessel-linked passages yet.</div>`}
        </div>
      </div>
    </div>
    <div class="dashboard-navigation-foot">
      <span>${entries.length} passage${entries.length === 1 ? "" : "s"} logged</span>
      <a href="navigation.html">Manage passages</a>
    </div>
  `;

  const container = document.getElementById("dashNavigationChart");
  if (!container) return;

  // On a fresh login redirect (as opposed to a plain refresh of an
  // already-open dashboard), this render can fire before the Leaflet
  // <script> has actually finished loading — e.g. a slow/blocked first
  // fetch of the CDN script. A refresh "fixes" it purely because the
  // script is warm in cache by then. Rather than give up immediately,
  // poll briefly for `L` to show up and retry, so the map still appears
  // without the user needing to reload the page.
  if (typeof L === "undefined") {
    waitForLeaflet(() => {
      if (document.getElementById("dashNavigationChart") === container) {
        drawDashboardNavigationChart(container, stats);
      }
    });
    return;
  }

  drawDashboardNavigationChart(container, stats);
}

const DASH_NAV_LEAFLET_POLL_MS = 200;
const DASH_NAV_LEAFLET_POLL_ATTEMPTS = 25; // ~5s total

function waitForLeaflet(onReady, attemptsLeft = DASH_NAV_LEAFLET_POLL_ATTEMPTS) {
  if (typeof L !== "undefined") {
    onReady();
    return;
  }
  if (attemptsLeft <= 0) {
    // Leaflet never showed up (genuinely blocked/failed to load, not just slow) —
    // only now fall back to the static message, and only if this render pass'
    // chart container is still the one on screen (user hasn't navigated away
    // or triggered a fresh re-render in the meantime).
    const shell = document.querySelector(
      "#dashNavigationSnippet .dashboard-navigation-chart-shell"
    );
    if (shell) shell.innerHTML = `<div class="muted">Chart preview unavailable.</div>`;
    return;
  }
  window.setTimeout(() => waitForLeaflet(onReady, attemptsLeft - 1), DASH_NAV_LEAFLET_POLL_MS);
}

function drawDashboardNavigationChart(container, stats, retryAttempt = 0, renderId = ++dashNavigationRenderId) {
  whenDashboardChartContainerReady(container, () => {
    if (renderId !== dashNavigationRenderId) return;
    if (!initDashboardNavigationChart(container) || !dashNavigationLayer) return;

    dashNavigationLayer.clearLayers();

    const bounds = [];
    stats.routes.forEach(({ entry, coords }) => {
      const vesselId = entry.vesselId || entry.vessel_id || "";
      const color = getDashboardVesselColor(vesselId);
      const from = entry.fromPort || entry.from_port || "Departure";
      const to = entry.toPort || entry.to_port || entry.port || "Arrival";
      const line = L.polyline(coords, {
        color,
        weight: 4,
        opacity: 0.94,
        lineCap: "round",
        lineJoin: "round"
      });

      line.bindTooltip(`${Seav.escapeHtml(from)} → ${Seav.escapeHtml(to)}`, { sticky: true });
      line.bindPopup(
        `<strong>${Seav.escapeHtml(entry.passageName || entry.passage_name || getDashboardVesselName(vesselId))}</strong><br/>${Seav.escapeHtml(from)} → ${Seav.escapeHtml(to)}`
      );
      dashNavigationLayer.addLayer(line);

      coords.forEach((coord) => bounds.push(coord));
    });

    const settleDashboardChart = () => {
      if (!dashNavigationChart) return;
      dashNavigationChart.invalidateSize(true);
      if (bounds.length) {
        dashNavigationChart.fitBounds(L.latLngBounds(bounds), {
          padding: [52, 52],
          maxZoom: 9,
          animate: false
        });
      }
      dashNavigationChart.panInsideBounds(DASH_NAV_WORLD_BOUNDS, { animate: false });
    };

    settleDashboardChart();
    // Extra passes cover late layout shifts (web fonts, sibling cards resizing)
    // that can happen only on the first dashboard load.
    window.setTimeout(settleDashboardChart, 250);
    window.setTimeout(settleDashboardChart, 800);

    const retryDelay = DASH_NAV_MOUNT_RETRY_DELAYS[retryAttempt];
    if (retryDelay === undefined) return;

    window.setTimeout(() => {
      if (renderId !== dashNavigationRenderId) return;
      if (!container.isConnected || hasDashboardNavLoadedTiles(container)) return;

      // Cold first loads can leave Leaflet with no requested/painted tiles even
      // though the map object exists. Remount in-place instead of relying on a
      // manual browser refresh.
      destroyDashboardNavigationChart();
      drawDashboardNavigationChart(container, stats, retryAttempt + 1);
    }, retryDelay);
  });
}

  function truncateText(text, max = 140) {
    return window.SeavData?.truncateText
      ? window.SeavData.truncateText(text, max)
      : String(text || "").trim().slice(0, max);
  }

  async function renderReferenceSnippet() {
    const dashRefSnippet = document.getElementById("dashRefSnippet");
    if (!dashRefSnippet) return;

    const refs = window.SeavState?.refs || [];
    updateCardTitle("dashRefSnippet", "References", refs.length);

    if (!refs.length) {
      dashRefSnippet.innerHTML = `<div class="muted">No references yet.</div>`;
      return;
    }

    const latestThree = [...refs]
      .sort((a, b) => {
        const da = a.date ? new Date(a.date) : new Date(0);
        const db = b.date ? new Date(b.date) : new Date(0);
        return db - da;
      })
      .slice(0, 3);

    dashRefSnippet.innerHTML = `
      <div class="list">
        ${latestThree.map((ref) => {
          const status = getReferenceStatus(ref);
          const statusInfo = window.SeavData.getReferenceStatusDisplay(status);
          const quote = truncateText(ref.text, 140);
          return `
            <div class="list-row">
              <div style="min-width:0;">
                <div class="list-title">${Seav.escapeHtml(ref.name || "—")}</div>
                <div class="list-sub">${Seav.escapeHtml(ref.title || "—")} • ${Seav.escapeHtml(formatDatePretty(ref.date))}</div>
                ${
                  quote
                    ? `<div class="list-sub dash-ref-quote">“${Seav.escapeHtml(quote)}”</div>`
                    : ``
                }
              </div>
              <span class="${statusInfo.className}">${Seav.escapeHtml(statusInfo.label)}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

async function renderSpecialistSnippet() {
  const dashSpecialistSnippet = document.getElementById("dashSpecialistSnippet");
  if (!dashSpecialistSnippet) return;

  const entries = window.SeavState?.specialistQualifications || [];
  updateCardTitle("dashSpecialistSnippet", "Specialist qualifications", entries.length);

  if (!entries.length) {
    dashSpecialistSnippet.innerHTML = `<div class="muted">No specialist qualifications logged yet.</div>`;
    return;
  }

  const latest = [...entries]
    .sort((a, b) => {
      const da = a.dateObtained ? new Date(a.dateObtained) : new Date(0);
      const db = b.dateObtained ? new Date(b.dateObtained) : new Date(0);
      return db - da;
    })
    .slice(0, 4);

  const getLabel =
    window.SeavData?.getSpecialistCategoryLabel ||
    ((value) => value || "—");

  dashSpecialistSnippet.innerHTML = `
    <div class="list">
      ${latest
        .map((entry) => window.SeavCards.buildSpecialistRow(entry, { categoryLabel: getLabel }))
        .join("")}
    </div>
  `;
}

async function renderOnboardSnippet() {
  const dashOnboardSnippet = document.getElementById("dashOnboardSnippet");
  if (!dashOnboardSnippet) return;

  const entries = window.SeavState?.onboardExperiences || [];
  updateCardTitle("dashOnboardSnippet", "Onboard experience", entries.length);

  if (!entries.length) {
    dashOnboardSnippet.innerHTML = `<div class="muted">No onboard experience logged yet.</div>`;
    return;
  }

  const latest = [...entries]
    .sort((a, b) => {
      const da = a.dateFrom ? new Date(a.dateFrom) : new Date(0);
      const db = b.dateFrom ? new Date(b.dateFrom) : new Date(0);
      return db - da;
    })
    .slice(0, 4);

  const vessels = window.SeavState?.vessels || [];

  dashOnboardSnippet.innerHTML = `
    <div class="list">
      ${latest
        .map((entry) => window.SeavCards.buildOnboardRow(entry, vessels, { statusFallback: "Draft" }))
        .join("")}
    </div>
  `;
}

async function renderHobbiesSnippet() {
  const dashHobbiesSnippet = document.getElementById("dashHobbiesSnippet");
  if (!dashHobbiesSnippet) return;

  const entries = window.SeavState?.hobbiesInterests || [];
  updateCardTitle("dashHobbiesSnippet", "Hobbies & interests", entries.length);

  if (!entries.length) {
    dashHobbiesSnippet.innerHTML = `<div class="muted">No hobbies or interests logged yet.</div>`;
    return;
  }

  const latest = [...entries]
    .sort((a, b) => {
      const da = a.dateFrom ? new Date(a.dateFrom) : new Date(a.updatedAt || 0);
      const db = b.dateFrom ? new Date(b.dateFrom) : new Date(b.updatedAt || 0);
      return db - da;
    })
    .slice(0, 4);

  const getLabel =
    window.SeavData?.getHobbyInterestCategoryLabel ||
    ((value) => value || "—");

  dashHobbiesSnippet.innerHTML = `
    <div class="list">
      ${latest
        .map((entry) => window.SeavCards.buildHobbyRow(entry, { categoryLabel: getLabel }))
        .join("")}
    </div>
  `;
}


  window.SeavDashboardSnippets = {
    renderVesselSnippet,
    renderSeatimeSnippet,
    renderNavigationSnippet,
    renderTenderSnippet,
    renderOnboardSnippet,
    renderSpecialistSnippet,
    renderCertSnippet,
    renderReferenceSnippet,
    renderHobbiesSnippet
  };
})();
