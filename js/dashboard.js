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

  const { DEFAULT_PROFILE } = window.SeavData;

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

  function getMissingProfileFields(profile) {
    return getProfileCompletionChecks(profile)
      .filter((check) => !check.done)
      .map((check) => check.label);
  }

  // A finished profile earns the tick beside the page title. What is missing
  // otherwise is a row in Needs attention.
  function updateProfileCompletion(profile) {
    const badge = document.getElementById("dashboardProfileCompleteBadge");
    if (badge) badge.hidden = getMissingProfileFields(profile || {}).length > 0;
  }

  async function renderDashboardSnippets() {
    const S = window.SeavDashboardSnippets;
    if (!S) return;

    const snippetRenderers = [
      S.renderVesselCard,
      () => S.renderAttentionCard(getMissingProfileFields(loadProfile())),
      S.renderTicketCard,
      S.renderRecordsCard,
      S.renderNoticesCard,
      S.renderRegulationsCard,
      () => window.SeavLastVisit?.render()
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
    // renderDashboardProfile() was called here until 2026-09-20. v516 deleted
    // the profile detail card, taking dashAvatar and all eleven dashProfile*
    // elements with it, so the function early-returned on every load. Its
    // avatar logic now lives in wireTopbarProfile() in js/core.js (the topbar
    // profile chip), which is what its "one place profile photo display logic
    // lives" comment was protecting. profileHasPhoto() below is NOT dead —
    // updateProfileCompletion's checklist uses it.
    updateProfileCompletion(loadProfile());
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

  // --- The topbar's + Add: open each domain's real Add modal in place
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
      pageUrl: "vessels.html",
      modalId: "vesselModal",
      scriptSrc: "js/vessels.js",
      globalName: "SeavVessels",
      initFn: "initVessels",
      openFn: "openAddVesselModal"
    },
    seatime: {
      pageUrl: "seatime.html",
      modalId: "seatimeModal",
      scriptSrc: "js/seatime.js",
      globalName: "SeavSeatime",
      initFn: "initSeatime",
      openFn: "openAddSeatimeModal"
    },
    certificate: {
      pageUrl: "certificates.html",
      modalId: "certModal",
      scriptSrc: "js/certificates.js",
      // certificates.js reads window.SeavCertIssuers for the Issuing authority
      // and Training provider lists. certificates.html ships that file; the
      // dashboard did not, so both dropdowns opened empty here (v522).
      deps: ["js/seav-cert-issuers.js"],
      globalName: "SeavCertificates",
      initFn: "init",
      openFn: "openAddModal"
    },
    onboard: {
      pageUrl: "onboard-experience.html",
      modalId: "oeModal",
      scriptSrc: "js/onboard-experience.js",
      // The modal's photo rows read saved photos through SeavPhotoStrip.
      deps: ["js/seav-photo-strip.js"],
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

      const version = window.SeavConfig?.ASSET_VERSION || "";

      // A lifted modal needs the same modules its own page loads, not just the
      // one that defines its API. Anything a page lists before its module and
      // the dashboard does not ship belongs in `deps`.
      function loadScriptOnce(src) {
        if (document.querySelector(`script[data-quick-action-dep="${src}"]`)) {
          return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = `${src}?v=${version}`;
          script.defer = true;
          script.dataset.quickActionDep = src;
          script.onload = resolve;
          script.onerror = () => reject(new Error(`Failed to load ${src}`));
          document.head.appendChild(script);
        });
      }

      if (!window[config.globalName]) {
        for (const dep of config.deps || []) {
          await loadScriptOnce(dep);
        }
        await loadScriptOnce(config.scriptSrc);
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

  // The topbar's + Add links to dashboard.html?add=<key> from any page, and opens
  // the same real form as the quick actions. Falls back to that form's own page.
  async function openAdd(key) {
    const config = QUICK_ACTION_MODALS[key];
    if (!config) return;
    try {
      await loadQuickActionModal(key);
      window[config.globalName][config.openFn]();
    } catch (err) {
      console.error(`[SEA-V] ${key} form failed, falling back to page navigation:`, err);
      window.location.href = config.pageUrl;
    }
  }

  function initAddLinks() {
    const params = new URLSearchParams(window.location.search);
    const wanted = params.get("add");
    if (wanted) {
      params.delete("add");
      const query = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (query ? `?${query}` : ""));
      openAdd(wanted);
    }
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a[href^='dashboard.html?add=']");
      if (!link) return;
      event.preventDefault();
      openAdd(new URL(link.href).searchParams.get("add"));
    });
  }

  // Pressing anywhere on a table row presses the row's link. The link stays a real
  // link, so the keyboard and opening in a new tab still work on it directly.
  function initRowPress() {
    document.querySelector(".dash-cards")?.addEventListener("click", (event) => {
      if (event.target.closest("a, button")) return;
      const row = event.target.closest(".dash-table tbody tr");
      row?.querySelector(":scope > td > a")?.click();
    });
  }

  function initDashboard() {
    const isDashboard = document.querySelector(".dash-cards");

    if (!isDashboard) return;

    const runRefresh = async () => {
      await refresh();
      await window.SeavGuide?.check();
    };

    populateDashboardCardIcons();
    initAddLinks();
    initRowPress();
    Seav.bindStateRefresh(runRefresh, { label: "Dashboard refresh" });
  }

  document.addEventListener("DOMContentLoaded", initDashboard);

  window.SeavDashboard = { refresh };
})();
