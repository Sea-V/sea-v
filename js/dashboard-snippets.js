// /js/dashboard-snippets.js — dashboard card renderers
(function () {
  "use strict";

  if (!window.Seav || !window.SeavState || !window.SeavData) {
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
  const DASH_NAV_COLORS = [
    "#2563eb",
    "#dc2626",
    "#16a34a",
    "#9333ea",
    "#ea580c",
    "#0891b2",
    "#be123c",
    "#4f46e5",
    "#0f766e",
    "#b45309",
    "#7c3aed",
    "#0284c7"
  ];

  let dashNavigationChart = null;
  let dashNavigationLayer = null;

  function updateCardTitle(containerId, baseTitle, count) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const card = container.closest(".dash-card");
    if (!card) return;

    const heading = card.querySelector(".dashboard-card-headline h3, .dash-card > h3");
    if (!heading) return;

    heading.textContent = `${baseTitle} (${count})`;
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

function updateCertCardCompleteState(attentionCount) {
  const container = document.getElementById("dashCertSnippet");
  const badge = document.getElementById("dashboardCertCompleteBadge");
  const card = container?.closest(".dash-card");
  const heading = card?.querySelector(".dashboard-card-headline h3, .dash-card > h3");

  if (heading) {
    heading.textContent =
      attentionCount > 0 ? `Certificates (${attentionCount})` : "Certificates";
  }

  if (badge) badge.hidden = attentionCount > 0;
}

async function renderCertSnippet() {
  const dashCertSnippet = document.getElementById("dashCertSnippet");
  if (!dashCertSnippet) return;

  const certs = (window.SeavState?.certs || []).filter(
    (cert) => window.SeavData?.isSavedCert?.(cert) ?? !!cert?.name
  );
  const isExpiringOrExpired = window.SeavData?.isCertExpiringOrExpired;
  const attentionCerts = certs.filter((cert) =>
    isExpiringOrExpired?.(cert, DASH_CERT_WARNING_DAYS)
  );

  updateCertCardCompleteState(attentionCerts.length);

  if (!attentionCerts.length) {
    dashCertSnippet.innerHTML = `
      <p class="dashboard-cert-attention-note muted">
        No certificates expiring within 3 months or already expired. Only certificates due for renewal appear here.
      </p>
    `;
    return;
  }

  function getDashboardCertStatus(cert) {
    return getCertExpiryInfo(cert.expiry, { warningDays: DASH_CERT_WARNING_DAYS });
  }

  const sortedCerts = [...attentionCerts].sort((a, b) => {
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
    <p class="dashboard-cert-attention-note muted">
      Showing certificates expiring within 3 months or already expired.
    </p>

    <div class="list">
      ${sortedCerts
        .map((cert) => {
          const statusInfo = getDashboardCertStatus(cert);
          const certFileUrl = cert.attachment?.url || cert.attachment?.dataUrl || "";
          const hasFile = !!certFileUrl;

          const attachHtml = hasFile
            ? `<div class="dash-cert-attachment">
               <a class="cert-attachment-link" href="${Seav.escapeHtml(certFileUrl)}" target="_blank" rel="noopener">
                 <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                   <path d="M12 3v10m0 0l3.5-3.5M12 13l-3.5-3.5M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                 </svg>
                 Download certificate
               </a>
             </div>`
            : ``;

          return `
            <div class="list-row">
              <div style="min-width:0;">
                <div class="list-title">
                  ${Seav.escapeHtml(cert.code || "—")} • ${Seav.escapeHtml(cert.name || "—")}
                </div>
                <div class="list-sub">
                  Expiry: ${Seav.escapeHtml(cert.expiry || "—")} • ${Seav.escapeHtml(statusInfo.label)}
                </div>
                ${attachHtml}
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

  dashVesselSnippet.innerHTML = `
    <div class="dash-mini-card-grid">
      ${latestThree.map((vessel) => {
        const photoUrl = vessel.photo?.url || vessel.photo?.dataUrl || "";
        const photoHtml = photoUrl
          ? `<img src="${Seav.escapeHtml(photoUrl)}" alt="${Seav.escapeHtml(vessel.name || "Vessel")}" />`
          : `<div class="dash-mini-fallback">No Photo</div>`;

        const name = Seav.escapeHtml(vessel.name || "Unnamed Vessel");
        const type = Seav.escapeHtml(vessel.vessel_type || vessel.type || "—");
        const flag = Seav.escapeHtml(vessel.flag || "—");
        const gt = Seav.escapeHtml(vessel.gt || "—");
        const role = Seav.escapeHtml(vessel.vessel_role || vessel.role || "—");
        const length = Seav.escapeHtml(vessel.vessel_length || vessel.length || "—");
        const from = vessel.from ? formatDatePretty(vessel.from) : "—";
        const to = vessel.to ? formatDatePretty(vessel.to) : "Present";

        return `
          <article class="dash-mini-card">
            <div class="dash-mini-photo">${photoHtml}</div>

            <div class="dash-mini-body">
              <div class="dash-mini-head">
                <div>
                  <h4>${name}</h4>
                  <p>${type} • ${flag}</p>
                </div>
                ${!vessel.to ? `<span class="dash-mini-status">Current</span>` : ``}
              </div>

              <div class="dash-mini-info-grid">
                <div>
                  <span>Role</span>
                  <strong>${role}</strong>
                </div>
                <div>
                  <span>GT</span>
                  <strong>${gt}</strong>
                </div>
                <div>
                  <span>Length</span>
                  <strong>${length}</strong>
                </div>
                <div>
                  <span>Dates</span>
                  <strong>${from} → ${to}</strong>
                </div>
              </div>
            </div>
          </article>
        `;
      }).join("")}
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

  dashTenderSnippet.innerHTML = `
    <div class="dash-mini-card-grid">
      ${latestThree.map((tender) => {
        const photoUrl = tender.photo?.url || tender.photo?.dataUrl || "";
        const photoHtml = photoUrl
          ? `<img src="${Seav.escapeHtml(photoUrl)}" alt="${Seav.escapeHtml(tender.name || "Tender")}" />`
          : `<div class="dash-mini-fallback">No Photo</div>`;

        const linkedVessel = (window.SeavState?.vessels || []).find(
          (v) => v.id === tender.vesselId
        );

        const name = Seav.escapeHtml(tender.name || "Unnamed Tender");
        const vesselName = Seav.escapeHtml(linkedVessel?.name || "Standalone / Chase");
        const type = Seav.escapeHtml(tender.type || "—");
        const model = Seav.escapeHtml(tender.model || "—");
        const length = Seav.escapeHtml(tender.length || "—");
        const engine = Seav.escapeHtml(tender.engine || "—");

        return `
          <article class="dash-mini-card">
            <div class="dash-mini-photo">${photoHtml}</div>

            <div class="dash-mini-body">
              <div class="dash-mini-head">
                <div>
                  <h4>${name}</h4>
                  <p>${vesselName}</p>
                </div>
              </div>

              <div class="dash-mini-info-grid">
                <div>
                  <span>Type</span>
                  <strong>${type}</strong>
                </div>
                <div>
                  <span>Model</span>
                  <strong>${model}</strong>
                </div>
                <div>
                  <span>Length</span>
                  <strong>${length}</strong>
                </div>
                <div>
                  <span>Engine</span>
                  <strong>${engine}</strong>
                </div>
              </div>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function getDashboardVesselName(vesselId) {
  if (!vesselId) return "Unassigned";
  return (window.SeavState?.vessels || []).find((v) => v.id === vesselId)?.name || "Unnamed vessel";
}

function getDashboardVesselColor(vesselId) {
  if (!vesselId) return "#64748b";
  const vessels = [...(window.SeavState?.vessels || [])].sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""))
  );
  const index = vessels.findIndex((v) => v.id === vesselId);
  if (index >= 0) return DASH_NAV_COLORS[index % DASH_NAV_COLORS.length];
  return DASH_NAV_COLORS[0];
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
  const fromLat = Number(entry.fromLat ?? entry.from_lat ?? 0);
  const fromLng = Number(entry.fromLng ?? entry.from_lng ?? 0);
  const toLat = Number(entry.toLat ?? entry.lat ?? entry.to_lat ?? 0);
  const toLng = Number(entry.toLng ?? entry.lng ?? entry.to_lng ?? 0);
  const waypoints = normalizeDashboardWaypoints(entry.waypoints);

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

function buildDashboardNavigationStats(entries) {
  const routeEntries = entries
    .map((entry) => ({ entry, coords: getDashboardRouteCoords(entry) }))
    .filter((item) => item.coords.length >= 2);
  const countries = new Set();
  const vessels = new Map();
  let totalNm = 0;

  routeEntries.forEach(({ entry, coords }) => {
    totalNm += getDashboardRouteDistance(coords);

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

function initDashboardNavigationChart(container) {
  if (dashNavigationChart || !container || typeof L === "undefined") return;

  dashNavigationChart = L.map(container, {
    center: [25, 0],
    zoom: 1,
    minZoom: 1,
    zoomControl: false,
    attributionControl: true,
    dragging: true,
    scrollWheelZoom: false
  });

  L.tileLayer(DASH_NAV_TILE_URL, {
    attribution: DASH_NAV_ATTRIBUTION,
    subdomains: "abcd",
    maxZoom: 18
  }).addTo(dashNavigationChart);

  dashNavigationLayer = L.layerGroup().addTo(dashNavigationChart);
}

async function renderNavigationSnippet() {
  const box = document.getElementById("dashNavigationSnippet");
  if (!box) return;

  const entries = window.SeavState?.navigationAreas || [];
  updateCardTitle("dashNavigationSnippet", "Navigation chart", entries.length);

  if (dashNavigationChart) {
    dashNavigationChart.remove();
    dashNavigationChart = null;
    dashNavigationLayer = null;
  }

  if (!entries.length) {
    box.innerHTML = `<div class="muted">No passages logged yet.</div>`;
    return;
  }

  const stats = buildDashboardNavigationStats(entries);

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
  if (!container || typeof L === "undefined") {
    box.innerHTML = `<div class="muted">Chart preview unavailable.</div>`;
    return;
  }

  initDashboardNavigationChart(container);
  if (!dashNavigationChart || !dashNavigationLayer) return;

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

  window.setTimeout(() => {
    dashNavigationChart.invalidateSize();
    if (bounds.length) {
      dashNavigationChart.fitBounds(L.latLngBounds(bounds), {
        padding: [52, 52],
        maxZoom: 2,
        animate: false
      });
    }
  }, 80);
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
          const refFileUrl = ref.attachment?.url || ref.attachment?.dataUrl || "";
          const hasFile = !!refFileUrl;
          const attachHtml = hasFile
          ? `<div class="row-actions" style="margin-top:10px;">
               <a href="${Seav.escapeHtml(refFileUrl)}" target="_blank">
               Download attachment${ref.attachment?.filename ? ` (${Seav.escapeHtml(ref.attachment.filename)})` : ""}
             </a>
          </div>`
        : ``;

          return `
            <div class="list-row">
              <div style="min-width:0;">
                <div class="list-title">${Seav.escapeHtml(ref.name)} <span class="muted">(${Seav.escapeHtml(getReferenceStatus(ref))})</span></div>
                <div class="list-sub">${Seav.escapeHtml(ref.title || "—")} • ${Seav.escapeHtml(ref.date || "—")}</div>
                <div class="list-sub" style="text-transform:none;letter-spacing:0;line-height:1.5;margin-top:8px;color:rgba(255,255,255,0.78);font-weight:600;">
                  “${Seav.escapeHtml(ref.text)}”
                </div>
                ${attachHtml}
              </div>
              <span class="pill">${Seav.escapeHtml(getReferenceStatus(ref))}</span>
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
        .map((entry) => {
          return `
            <div class="list-row">
              <div style="min-width:0;">
                <div class="list-title">${Seav.escapeHtml(entry.title || "—")}</div>
                <div class="list-sub">
                  ${Seav.escapeHtml(getLabel(entry.category))} • ${Seav.escapeHtml(entry.status || "Self-declared")}
                </div>
              </div>
              <span class="pill">${Seav.escapeHtml(entry.status || "Self-declared")}</span>
            </div>
          `;
        })
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

  const getLabel =
    window.SeavData?.getOnboardCategoryLabel ||
    ((value) => value || "—");

  dashOnboardSnippet.innerHTML = `
    <div class="list">
      ${latest
        .map((entry) => {
          const vessel = (window.SeavState?.vessels || []).find(
            (v) => v.id === entry.vesselId
          );
          return `
            <div class="list-row">
              <div style="min-width:0;">
                <div class="list-title">${Seav.escapeHtml(entry.title || "—")}</div>
                <div class="list-sub">
                  ${Seav.escapeHtml(vessel?.name || "—")} • ${Seav.escapeHtml(getLabel(entry.category))}
                  ${entry.isFamiliarisation ? " • Familiarisation" : ""}
                </div>
              </div>
              <span class="pill">${Seav.escapeHtml(entry.status || "Draft")}</span>
            </div>
          `;
        })
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
        .map((entry) => {
          const photoCount = (entry.photos || []).filter(
            (photo) => photo?.url || photo?.dataUrl
          ).length;
          return `
            <div class="list-row">
              <div style="min-width:0;">
                <div class="list-title">${Seav.escapeHtml(entry.title || "—")}</div>
                <div class="list-sub">
                  ${Seav.escapeHtml(getLabel(entry.category))}
                  ${photoCount ? ` • ${photoCount} photo${photoCount === 1 ? "" : "s"}` : ""}
                </div>
              </div>
              <span class="pill">${Seav.escapeHtml(entry.status || "Published")}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}


  window.SeavDashboardSnippets = {
    renderSeatimeSnippet,
    renderCertSnippet,
    renderVesselSnippet,
    renderTenderSnippet,
    renderNavigationSnippet,
    renderReferenceSnippet,
    renderSpecialistSnippet,
    renderOnboardSnippet,
    renderHobbiesSnippet
  };
})();
