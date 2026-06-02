// /js/dashboard.js
(function () {
  "use strict";

  if (!window.Seav) {
    console.warn("[SEA-V] Seav core not found. Did you include js/core.js before dashboard.js?");
    return;
  }

  if (!window.SeavData) {
    console.warn("[SEA-V] SeavData not found. Did you include js/seav-data.js before dashboard.js?");
    return;
  }

  if (!window.SeavAPI) {
    console.warn("[SEA-V] SeavAPI not found. Did you include js/api.js before dashboard.js?");
    return;
  }

    if (!window.SeavState) {
    console.warn("[SEA-V] SeavState not found. Did you include js/state.js before dashboard.js?");
    return;
  }

const {
  DEFAULT_PROFILE,
  getSeatimeTotals,
  totalQualifyingDays,
  getCertExpiryInfo,
  getReferenceStatus
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

  function getBadgeTone(badgeTier) {
    switch (String(badgeTier || "").toLowerCase()) {
      case "bronze":
        return "badge-bronze";
      case "silver":
        return "badge-silver";
      case "gold":
        return "badge-gold";
      case "platinum":
        return "badge-platinum";
      default:
        return "badge-default";
    }
  }

  function getAchievementDashboardSection(achievement) {
    if (achievement?.dashboardSection) return achievement.dashboardSection;

    const definition = window.SeavBadges?.ACHIEVEMENTS?.[achievement?.code];
    return definition?.dashboardSection || "";
  }

  function getAchievementSection(a) {
  return a.dashboardSection || "";
}

  function loadProfile() {
    return {
      ...DEFAULT_PROFILE,
      ...(window.SeavState?.profile || {}),
      id: window.SeavState?.profile?.id || DEFAULT_PROFILE.id
    };
  }

  function updateCardTitle(containerId, baseTitle, count) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const card = container.closest(".dash-card");
    if (!card) return;

    const heading = card.querySelector(".dashboard-card-headline h3, .dash-card > h3");
    if (!heading) return;

    heading.textContent = `${baseTitle} (${count})`;
  }

async function updateDayTypeKpis() {
  const kpiSea = document.getElementById("kpiSea");
  const kpiPort = document.getElementById("kpiPort");
  const kpiStandby = document.getElementById("kpiStandby");
  const kpiWatchkeeping = document.getElementById("kpiWatchkeeping");
  const kpiTotalDays = document.getElementById("kpiTotalDays");

  if (!kpiSea && !kpiPort && !kpiStandby && !kpiWatchkeeping && !kpiTotalDays) return;

  const seatimes = window.SeavState?.seatimes || [];
  const totals = getSeatimeTotals(seatimes);

  if (kpiSea) kpiSea.textContent = String(totals.sea);
  if (kpiPort) kpiPort.textContent = String(totals.yard);
  if (kpiStandby) kpiStandby.textContent = String(totals.standby);
  if (kpiWatchkeeping) kpiWatchkeeping.textContent = String(totals.watchkeeping);
  if (kpiTotalDays) kpiTotalDays.textContent = String(totals.total);
}

function syncDashboardProfileHeights() {
  const left = document.querySelector(".dashboard-profile-left");
  const heading = document.querySelector(".dashboard-profile-heading");
  const wrap = document.getElementById("dashCareerOverviewWrap");
  if (!left || !heading) return;

  if (window.matchMedia("(max-width: 768px)").matches || wrap?.classList.contains("is-expanded")) {
    left.style.height = "";
    left.style.minHeight = "";
    return;
  }

  const headingHeight = heading.offsetHeight;
  left.style.height = `${headingHeight}px`;
  left.style.minHeight = `${headingHeight}px`;
}

function updateCareerOverviewClampState() {
  const wrap = document.getElementById("dashCareerOverviewWrap");
  const bioEl = document.getElementById("dashProfileBio");
  const readMoreBtn = document.getElementById("dashCareerReadMore");
  if (!wrap || !bioEl || !readMoreBtn) return;

  if (wrap.classList.contains("is-expanded")) {
    readMoreBtn.hidden = false;
    return;
  }

  syncDashboardProfileHeights();
  void wrap.offsetHeight;

  const text = bioEl.textContent.trim();
  if (!text || text === "—") {
    wrap.classList.remove("dashboard-bio-under--clamp");
    readMoreBtn.hidden = true;
    return;
  }

  wrap.classList.add("dashboard-bio-under--clamp");
  readMoreBtn.hidden = false;
  readMoreBtn.style.visibility = "hidden";

  void bioEl.offsetHeight;
  const overflows = bioEl.scrollHeight > bioEl.clientHeight + 1;

  readMoreBtn.style.visibility = "";
  readMoreBtn.hidden = !overflows;
}

function setupCareerOverviewToggle() {
  const wrap = document.getElementById("dashCareerOverviewWrap");
  const readMoreBtn = document.getElementById("dashCareerReadMore");
  if (!wrap || !readMoreBtn) return;

  wrap.classList.remove("is-expanded");
  readMoreBtn.setAttribute("aria-expanded", "false");
  readMoreBtn.textContent = "Read more";

  requestAnimationFrame(() => {
    syncDashboardProfileHeights();
    requestAnimationFrame(updateCareerOverviewClampState);
  });
}

function renderDashboardProfile() {
  const dashAvatar = document.getElementById("dashAvatar");
  const dashProfileName = document.getElementById("dashProfileName");
  const dashProfileRank = document.getElementById("dashProfileRank");
  const dashProfileQualification = document.getElementById("dashProfileQualification");
  const dashProfileNationality = document.getElementById("dashProfileNationality");
  const dashProfileDob = document.getElementById("dashProfileDob");
  const dashProfileLocation = document.getElementById("dashProfileLocation");
  const dashProfileEmail = document.getElementById("dashProfileEmail");
  const dashProfilePhone = document.getElementById("dashProfilePhone");
  const dashProfileBio = document.getElementById("dashProfileBio");
  const dashProfilePassportsHeld = document.getElementById("dashProfilePassportsHeld");
  const dashProfileVisasHeld = document.getElementById("dashProfileVisasHeld");
  const dashProfileSalary = document.getElementById("dashProfileSalary");
  const dashProfileAvailability = document.getElementById("dashProfileAvailability");

  if (!dashProfileName && !dashAvatar) return;

  const profile = loadProfile();

  function formatDob(value) {
    if (!value || !value.includes("-")) return "—";
    const parts = value.split("-");
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  if (dashProfileName) dashProfileName.textContent = profile.name || "Demo User";
  if (dashProfileRank) dashProfileRank.textContent = profile.rank || "—";
  if (dashProfileQualification) dashProfileQualification.textContent = profile.qualification || "—";
  if (dashProfileNationality) dashProfileNationality.textContent = profile.nationality || "—";
  if (dashProfileDob) dashProfileDob.textContent = formatDob(profile.dob);
  if (dashProfileLocation) dashProfileLocation.textContent = profile.location || "—";
  if (dashProfileEmail) dashProfileEmail.textContent = profile.email || "—";
  if (dashProfilePhone) dashProfilePhone.textContent = profile.phone || "—";
  const careerOverview = profile.bio || "—";
  if (dashProfileBio) dashProfileBio.textContent = careerOverview;
  setupCareerOverviewToggle();
  if (dashProfilePassportsHeld) dashProfilePassportsHeld.textContent = profile.passportsHeld || "—";
  if (dashProfileVisasHeld) dashProfileVisasHeld.textContent = profile.visasHeld || "—";
  if (dashProfileSalary) dashProfileSalary.textContent = profile.salary || "—";
  if (dashProfileAvailability) dashProfileAvailability.textContent = profile.availability || "—";

   if (dashAvatar) {
    const profilePhotoUrl = profile.photo?.url || profile.photo?.dataUrl || "";

   if (profilePhotoUrl) {
  dashAvatar.style.backgroundImage = `url(${profilePhotoUrl})`;
      dashAvatar.style.backgroundSize = "cover";
      dashAvatar.style.backgroundPosition = "center";
    } else {
      dashAvatar.style.backgroundImage = "";
    }
  }

  updateProfileCompletion(profile);
}


function getProfileCompletion(profile) {
  const fields = [
    profile.name,
    profile.rank,
    profile.qualification,
    profile.nationality,
    profile.dob,
    profile.location,
    profile.email,
    profile.phone,
    profile.passportsHeld,
    profile.visasHeld,
    profile.bio
  ];

  const completed = fields.filter((field) => {
    return field !== undefined && field !== null && String(field).trim() !== "";
  }).length;

  return Math.round((completed / fields.length) * 100);
}

function getMissingProfileFields(profile) {
  const checks = [
    { key: profile.name, label: "Name" },
    { key: profile.rank, label: "Rank" },
    { key: profile.qualification, label: "Qualification" },
    { key: profile.nationality, label: "Nationality" },
    { key: profile.dob, label: "Date of Birth" },
    { key: profile.location, label: "Location" },
    { key: profile.email, label: "Email" },
    { key: profile.phone, label: "Phone" },
    { key: profile.passportsHeld, label: "Passports" },
    { key: profile.visasHeld, label: "Visas" },
    { key: profile.bio, label: "Career overview" },
    { key: profile.photo?.url || profile.photo?.dataUrl, label: "Profile Photo" }
  ];

  return checks
    .filter(item => !item.key || String(item.key).trim() === "")
    .map(item => item.label);
}

function getProgressClass(percent) {
  if (percent < 30) return "progress-low";
  if (percent < 60) return "progress-mid";
  if (percent < 90) return "progress-good";
  return "progress-complete";
}

function updateProfileCompletion(profile) {
  const card = document.getElementById("profileCompletionCard");
  const badge = document.getElementById("dashboardProfileCompleteBadge");
  const fill = document.getElementById("profileProgressFill");
  const percentText = document.getElementById("profileProgressPercent");
  const missingBox = document.getElementById("profileProgressMissing");

  const percent = getProfileCompletion(profile || {});
  const missing = getMissingProfileFields(profile || {});
  const isComplete = missing.length === 0;

  if (isComplete) {
    if (card) card.hidden = true;
    if (badge) badge.hidden = false;
    return;
  }

  if (card) card.hidden = false;
  if (badge) badge.hidden = true;

  if (!fill || !percentText) return;

  fill.style.width = `${percent}%`;
  fill.className = `progress-fill ${getProgressClass(percent)}`;
  percentText.textContent = `${percent}%`;

  if (missingBox) {
    missingBox.innerHTML = `
      <span style="opacity:0.7;">Missing:</span>
      ${missing.map((m) => `<span class="pill">${m}</span>`).join(" ")}
    `;
  }
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

async function renderCertSnippet() {
  const dashCertSnippet = document.getElementById("dashCertSnippet");
  if (!dashCertSnippet) return;

  const certs = window.SeavState?.certs || [];
  const mandatoryCodes = (window.SeavData?.MANDATORY_CERTS || []).map((c) =>
    String(c.code || "").trim().toUpperCase()
  );

  const mandatoryCerts = certs.filter((cert) =>
    mandatoryCodes.includes(String(cert.code || "").trim().toUpperCase())
  );

  updateCardTitle("dashCertSnippet", "Core compliance", mandatoryCerts.length);

  if (!mandatoryCerts.length) {
    dashCertSnippet.innerHTML = `<div class="muted">No mandatory certificates found.</div>`;
    return;
  }

  function getDashboardCertStatus(cert) {
  const hasAttachment = !!(cert.attachment?.url || cert.attachment?.dataUrl);
    if (!hasAttachment && !cert.expiry) {
      return {
        label: "Missing",
        badge: "Missing",
        statusClass: "pill"
      };
    }

    if (!cert.expiry) {
      return {
        label: cert.status || "Pending",
        badge: cert.status || "Pending",
        statusClass: "pill"
      };
    }

    return getCertExpiryInfo(cert.expiry);
  }

  const sortedCerts = [...mandatoryCerts].sort((a, b) => {
    const aInfo = getDashboardCertStatus(a);
    const bInfo = getDashboardCertStatus(b);

    const score = (info) => {
      const badge = String(info.badge || "").toLowerCase();
      if (badge === "missing") return 0;
      if (badge === "expired") return 1;
      if (badge === "expires soon") return 2;
      if (badge === "pending") return 3;
      if (badge === "valid") return 4;
      return 5;
    };

    const aScore = score(aInfo);
    const bScore = score(bInfo);

    if (aScore !== bScore) return aScore - bScore;

    const aDate = a.expiry ? new Date(a.expiry) : new Date("9999-12-31");
    const bDate = b.expiry ? new Date(b.expiry) : new Date("9999-12-31");
    return aDate - bDate;
  });

  const total = mandatoryCerts.length;
  let missing = 0;
  let expired = 0;
  let expiringSoon = 0;
  let valid = 0;
  let pending = 0;

  sortedCerts.forEach((cert) => {
    const status = getDashboardCertStatus(cert).badge;

    if (status === "Missing") missing++;
    else if (status === "Expired") expired++;
    else if (status === "Expires Soon") expiringSoon++;
    else if (status === "Valid") valid++;
    else if (status === "Pending") pending++;
  });

  dashCertSnippet.innerHTML = `
    <div class="dashboard-info-grid" style="margin-bottom:12px;">
      <div class="dashboard-info-box">
        <span class="dashboard-info-label">Total</span>
        <span class="dashboard-info-value">${total}</span>
      </div>
      <div class="dashboard-info-box">
        <span class="dashboard-info-label">Valid</span>
        <span class="dashboard-info-value">${valid}</span>
      </div>
      <div class="dashboard-info-box">
        <span class="dashboard-info-label">Expiring</span>
        <span class="dashboard-info-value">${expiringSoon}</span>
      </div>
      <div class="dashboard-info-box">
        <span class="dashboard-info-label">Expired</span>
        <span class="dashboard-info-value">${expired}</span>
      </div>
      <div class="dashboard-info-box">
        <span class="dashboard-info-label">Missing</span>
        <span class="dashboard-info-value">${missing}</span>
      </div>
    </div>

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
        const from = vessel.from ? SeavData.formatDatePretty(vessel.from) : "—";
        const to = vessel.to ? SeavData.formatDatePretty(vessel.to) : "Present";

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

async function renderDashboardSnippets() {
  await renderSeatimeSnippet();
  await renderCertSnippet();
  await renderSpecialistSnippet();
  await renderVesselSnippet();
  await renderTenderSnippet();
  await renderNavigationSnippet();
  await renderReferenceSnippet();
  await renderOnboardSnippet();
  await renderHobbiesSnippet();
}

  async function refresh() {
    await updateDayTypeKpis();
    await renderDashboardProfile();
    await renderDashboardSnippets();
  }

  function initDashboard() {
    const isDashboard =
      document.getElementById("dashSeatimeSnippet") ||
      document.getElementById("dashProfileName") ||
      document.getElementById("kpiTotalDays");

    if (!isDashboard) return;

    const runRefresh = async () => {
      await refresh();
    };

    if (window.SeavState?.ready) {
      runRefresh();
    } else {
      document.addEventListener("seav:state-ready", runRefresh, { once: true });
    }

    document.addEventListener("seav:data-updated", runRefresh);

    document.getElementById("dashCareerReadMore")?.addEventListener("click", (event) => {
      const wrap = document.getElementById("dashCareerOverviewWrap");
      const btn = event.currentTarget;
      if (!wrap || !btn) return;

      const expanded = wrap.classList.toggle("is-expanded");
      btn.setAttribute("aria-expanded", expanded ? "true" : "false");
      btn.textContent = expanded ? "Show less" : "Read more";

      if (!expanded) {
        requestAnimationFrame(() => {
          syncDashboardProfileHeights();
          requestAnimationFrame(updateCareerOverviewClampState);
        });
      } else {
        syncDashboardProfileHeights();
      }
    });

    const profileHeading = document.querySelector(".dashboard-profile-heading");
    if (profileHeading && typeof ResizeObserver !== "undefined") {
      const profileLayoutObserver = new ResizeObserver(() => {
        updateCareerOverviewClampState();
      });
      profileLayoutObserver.observe(profileHeading);
    }
  }

  document.addEventListener("DOMContentLoaded", initDashboard);

  window.SeavDashboard = { refresh };
})();