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

  if (!window.SeavState) {
    console.warn("[SEA-V] SeavState not found. Did you include js/state.js before dashboard.js?");
    return;
  }

  if (!window.SeavAPI) {
    console.warn("[SEA-V] SeavAPI not found. Did you include js/api.js before dashboard.js?");
    return;
  }

  const {
    DEFAULT_PROFILE,
    getSeatimeTotals,
    computeOowSeaService
  } = window.SeavData;

  function loadProfile() {
    return {
      ...DEFAULT_PROFILE,
      ...(window.SeavState?.profile || {}),
      id: window.SeavState?.profile?.id || DEFAULT_PROFILE.id
    };
  }

  async function ensureDashboardPhotosHydrated() {
    if (window.SeavState?.hydrateStoredFiles) {
      try {
        await window.SeavState.hydrateStoredFiles("dashboard.html");
      } catch (err) {
        console.warn("[SEA-V] Dashboard photo hydration failed:", err);
      }
    }
  }

  async function updateDayTypeKpis() {
    const kpiSea = document.getElementById("kpiSea");
    const kpiPort = document.getElementById("kpiPort");
    const kpiStandby = document.getElementById("kpiStandby");
    const kpiWatchkeeping = document.getElementById("kpiWatchkeeping");
    const kpiTotalDays = document.getElementById("kpiTotalDays");
    const kpiOowCapped = document.getElementById("kpiOowCapped");

    if (!kpiSea && !kpiPort && !kpiStandby && !kpiWatchkeeping && !kpiTotalDays && !kpiOowCapped) return;

    const seatimes = window.SeavState?.seatimes || [];
    const vessels = window.SeavState?.vessels || [];
    const totals = getSeatimeTotals(seatimes);

    if (kpiSea) kpiSea.textContent = String(totals.sea);
    if (kpiPort) kpiPort.textContent = String(totals.yard);
    if (kpiStandby) kpiStandby.textContent = String(totals.standby);
    if (kpiWatchkeeping) kpiWatchkeeping.textContent = String(totals.watchkeeping);
    if (kpiTotalDays) kpiTotalDays.textContent = String(totals.total);

    // 2026-08-05, Jack: the raw total above (sea+standby+yard+watchkeeping,
    // no caps) was labelled "Total Qualifying Service" but isn't actually
    // qualifying service under any MCA route — it was flagged as misleading.
    // This box adds the ALREADY-EXISTING, already-verified capped OOW
    // <3000GT figure (90-day yard cap, standby capped per entry, vessels
    // <15m excluded) alongside it rather than replacing the raw total,
    // since the raw total is still useful as "everything logged."
    if (kpiOowCapped) {
      const oow = computeOowSeaService(seatimes, vessels);
      kpiOowCapped.textContent = String(oow.totalQualifying15m);
    }
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
    if (dashProfileAvailability) dashProfileAvailability.textContent = profile.availability || "—";

    if (dashAvatar) {
      const profilePhotoUrl = Seav.getFileDisplayUrl(
        profile.photo,
        window.SeavApiCore?.STORAGE_BUCKETS?.PROFILE_PHOTOS || "profile-photos"
      );

      if (profilePhotoUrl) {
        const safeUrl = String(profilePhotoUrl).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        dashAvatar.style.backgroundImage = `url("${safeUrl}")`;
        dashAvatar.style.backgroundSize = "cover";
        dashAvatar.style.backgroundPosition = "center";
      } else {
        dashAvatar.style.backgroundImage = "";
      }
    }

    updateProfileCompletion(profile);
  }

  function profileHasPhoto(profile) {
    const photo = profile?.photo;
    if (window.SeavApiCore?.hasStoredFile?.(photo)) return true;
    return !!Seav.getFileDisplayUrl(
      photo,
      window.SeavApiCore?.STORAGE_BUCKETS?.PROFILE_PHOTOS || "profile-photos"
    );
  }

  function getProfileCompletionChecks(profile) {
    const p = profile || {};
    const has = (value) => value !== undefined && value !== null && String(value).trim() !== "";

    return [
      { label: "Name", done: has(p.name) },
      { label: "Rank", done: has(p.rank) },
      { label: "Qualification", done: has(p.qualification) },
      { label: "Nationality", done: has(p.nationality) },
      { label: "Date of Birth", done: has(p.dob) },
      { label: "Location", done: has(p.location) },
      { label: "Email", done: has(p.email) },
      { label: "Phone", done: has(p.phone) },
      { label: "Passports", done: has(p.passportsHeld) },
      { label: "Visas", done: has(p.visasHeld) },
      { label: "Career overview", done: has(p.bio) },
      { label: "Profile Photo", done: profileHasPhoto(p) }
    ];
  }

  function getProfileCompletion(profile) {
    const checks = getProfileCompletionChecks(profile);
    const completed = checks.filter((check) => check.done).length;
    return Math.round((completed / checks.length) * 100);
  }

  function getMissingProfileFields(profile) {
    return getProfileCompletionChecks(profile)
      .filter((check) => !check.done)
      .map((check) => check.label);
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
      S.renderVesselSnippet,
      S.renderSeatimeSnippet,
      S.renderNavigationSnippet,
      S.renderTenderSnippet,
      S.renderOnboardSnippet,
      S.renderSpecialistSnippet,
      S.renderCertSnippet,
      S.renderReferenceSnippet,
      S.renderHobbiesSnippet
    ];

    await Promise.all(
      snippetRenderers.map(async (renderSnippet) => {
        try {
          await renderSnippet();
        } catch (err) {
          console.error(
            "[SEA-V] Dashboard snippet render failed:",
            renderSnippet.name || "anonymous",
            err
          );
        }
      })
    );
  }

  async function refresh() {
    await ensureDashboardPhotosHydrated();
    await updateDayTypeKpis();
    await renderDashboardProfile();
    await renderDashboardSnippets();
  }

  // Same helper as js/public-profile.js's populateSectionIcons — reuses the
  // sidebar's SVG set (window.SeavIcons, js/core.js) for each card heading's
  // data-dash-icon span. No data dependency, safe to run immediately.
  function populateDashboardCardIcons() {
    document.querySelectorAll("[data-dash-icon]").forEach((el) => {
      const key = el.getAttribute("data-dash-icon");
      const svg = window.SeavIcons?.[key];
      if (svg) el.innerHTML = svg;
    });
  }

  // --- Dashboard quick actions: open each domain's real Add modal in place
  // instead of navigating to that page (Jack, 2026-08-08 -- crew onboard
  // mainly use these 4 quick actions; fewer full-page loads also suits a
  // future PWA, see project_seav_pwa_ios_app_plan). Nothing about any modal
  // or its save/validation/upload logic is duplicated here: this fetches
  // the owning page once, lifts its modal node into this page, and
  // lazy-loads that page's own JS to drive it -- same code, same page, just
  // opened without a navigation. If any step fails, it falls back to a
  // normal navigation to that page rather than leaving the button dead.
  // Proven first on "Add vessel" (v462/v463), then rolled out to the other
  // three quick actions once that pattern held up in real use.
  const QUICK_ACTION_MODALS = {
    vessel: {
      linkId: "dashAddVesselAction",
      labelId: "dashAddVesselActionLabel",
      pageUrl: "vessels.html",
      modalId: "vesselModal",
      scriptSrc: "js/vessels.js",
      globalName: "SeavVessels",
      initFn: "initVessels",
      openFn: "openAddVesselModal"
    },
    seatime: {
      linkId: "dashLogSeatimeAction",
      labelId: "dashLogSeatimeActionLabel",
      pageUrl: "seatime.html",
      modalId: "seatimeModal",
      scriptSrc: "js/seatime.js",
      globalName: "SeavSeatime",
      initFn: "initSeatime",
      openFn: "openAddSeatimeModal"
    },
    certificate: {
      linkId: "dashUploadCertAction",
      labelId: "dashUploadCertActionLabel",
      pageUrl: "certificates.html",
      modalId: "certModal",
      scriptSrc: "js/certificates.js",
      globalName: "SeavCertificates",
      initFn: "init",
      openFn: "openAddModal"
    },
    onboard: {
      linkId: "dashLogOnboardAction",
      labelId: "dashLogOnboardActionLabel",
      pageUrl: "onboard-experience.html",
      modalId: "oeModal",
      scriptSrc: "js/onboard-experience.js",
      globalName: "SeavOnboardExperience",
      initFn: "initOnboardExperience",
      openFn: "openAddModal"
    }
  };

  const quickActionLoadPromises = {};

  function loadQuickActionModal(key) {
    if (quickActionLoadPromises[key]) return quickActionLoadPromises[key];

    const config = QUICK_ACTION_MODALS[key];

    quickActionLoadPromises[key] = (async () => {
      if (!document.getElementById(config.modalId)) {
        const res = await fetch(config.pageUrl, { cache: "force-cache" });
        if (!res.ok) throw new Error(`Failed to fetch ${config.pageUrl}: ${res.status}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const modalEl = doc.getElementById(config.modalId);
        if (!modalEl) throw new Error(`${config.modalId} not found in ${config.pageUrl}`);
        document.body.appendChild(modalEl);

        // Two things core.js only ever wires ONCE, at this page's own
        // DOMContentLoaded, against the DOM as it existed then -- so a modal
        // injected afterwards misses both:
        // 1. mountDateFields() expands [data-date-field] placeholders (any
        //    date pickers in the form) into real year/month/day <select>s
        //    with options -- without this the date fields render but stay
        //    permanently empty.
        // 2. initModals()'s [data-close] scan wires the X button -- without
        //    this the X does nothing (the shared overlay's click-outside-
        //    to-close still works fine, since that listener isn't scoped to
        //    a specific modal).
        Seav.mountDateFields(modalEl);
        modalEl.querySelectorAll("[data-close]").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.preventDefault();
            window.SeavModals?.closeAllModals?.();
          });
        });
      }

      if (!window[config.globalName]) {
        const version = window.SeavConfig?.ASSET_VERSION || "";
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = `${config.scriptSrc}?v=${version}`;
          script.defer = true;
          script.onload = resolve;
          script.onerror = () => reject(new Error(`Failed to load ${config.scriptSrc}`));
          document.head.appendChild(script);
        });
      }

      const api = window[config.globalName];
      if (!api?.[config.initFn] || !api?.[config.openFn]) {
        throw new Error(`${config.globalName} API unavailable after load`);
      }

      api[config.initFn]();
    })().catch((err) => {
      quickActionLoadPromises[key] = null; // allow retry on next click
      throw err;
    });

    return quickActionLoadPromises[key];
  }

  function initDashboardQuickActionModal(key) {
    const config = QUICK_ACTION_MODALS[key];
    const link = document.getElementById(config.linkId);
    const label = document.getElementById(config.labelId);
    if (!link) return;

    const originalLabel = label ? label.textContent : "";

    link.addEventListener("click", async (e) => {
      e.preventDefault();

      if (label) label.textContent = "Loading…";
      link.setAttribute("aria-busy", "true");

      try {
        await loadQuickActionModal(key);
        window[config.globalName][config.openFn]();
      } catch (err) {
        console.error(`[SEA-V] ${key} quick action failed, falling back to page navigation:`, err);
        window.location.href = config.pageUrl;
        return;
      } finally {
        if (label) label.textContent = originalLabel;
        link.removeAttribute("aria-busy");
      }
    });
  }

  function initDashboardQuickActionModals() {
    Object.keys(QUICK_ACTION_MODALS).forEach(initDashboardQuickActionModal);
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

    populateDashboardCardIcons();
    initDashboardQuickActionModals();
    Seav.bindStateRefresh(runRefresh, { label: "Dashboard refresh" });
  }

  document.addEventListener("DOMContentLoaded", initDashboard);

  window.SeavDashboard = { refresh };
})();
