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
      ${missing.map((m) => `<span class="pill">${Seav.escapeHtml(m)}</span>`).join(" ")}
    `;
  }
}


  async function renderDashboardSnippets() {
    const S = window.SeavDashboardSnippets;
    if (!S) return;

    const snippetRenderers = [
      S.renderSeatimeSnippet,
      S.renderCertSnippet,
      S.renderSpecialistSnippet,
      S.renderVesselSnippet,
      S.renderTenderSnippet,
      S.renderNavigationSnippet,
      S.renderReferenceSnippet,
      S.renderOnboardSnippet,
      S.renderHobbiesSnippet
    ];

    for (const renderSnippet of snippetRenderers) {
      try {
        await renderSnippet();
      } catch (err) {
        console.error("[SEA-V] Dashboard snippet render failed:", renderSnippet.name || "anonymous", err);
      }
    }
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
    document.addEventListener("seav:files-hydrated", runRefresh);
  }

  document.addEventListener("DOMContentLoaded", initDashboard);

  window.SeavDashboard = { refresh };
})();