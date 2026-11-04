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

  async function refresh() {
    if (window.SeavState?.hydrateStoredFiles) {
      try {
        await window.SeavState.hydrateStoredFiles("dashboard.html");
      } catch (err) {
        console.warn("[SEA-V] Dashboard photo hydration failed:", err);
      }
    }
    await window.SeavDashboardHome?.render();
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

  // Log time fills in the yacht and its dates when the next step named one.
  function prefillSeatime(vessel) {
    const select = document.getElementById("st_vessel");
    if (select && vessel?.id) {
      select.value = vessel.id;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (vessel?.from) Seav.fillDateTriplet("st_date_joined", vessel.from);
    if (vessel?.to) Seav.fillDateTriplet("st_date_left", vessel.to);
  }

  // Opens a real Add form in place; if anything fails, goes to its page instead
  // of leaving the button dead.
  async function openAdd(key, options = {}) {
    const config = QUICK_ACTION_MODALS[key];
    if (!config) return;
    try {
      await loadQuickActionModal(key);
      window[config.globalName][config.openFn]();
      if (key === "seatime") prefillSeatime(options.vessel);
    } catch (err) {
      console.error(`[SEA-V] ${key} form failed, falling back to page navigation:`, err);
      window.location.href = config.pageUrl;
    }
  }

  // The topbar's + Add links here as dashboard.html?add=<key> from any page.
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

  function initDashboard() {
    if (!document.getElementById("homeShell")) return;
    initAddLinks();
    Seav.bindStateRefresh(refresh, { label: "Home refresh" });
  }

  document.addEventListener("DOMContentLoaded", initDashboard);

  window.SeavDashboard = { refresh, openAdd };
})();
