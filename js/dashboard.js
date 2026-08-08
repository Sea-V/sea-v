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
    computeOowSeaService,
    KEYS,
    slugifyUsername,
    isValidUsername
  } = window.SeavData;

  function loadProfile() {
    return {
      ...DEFAULT_PROFILE,
      ...(window.SeavState?.profile || {}),
      id: window.SeavState?.profile?.id || DEFAULT_PROFILE.id
    };
  }

  // Safety net for the 2026-08-07 Mia Bailey data-loss incident (root
  // cause and full fix in js/profile.js). The username-save button and
  // public-profile toggle below both save the ENTIRE profile row (spread
  // loadProfile() + override one field) -- if SeavState hasn't actually
  // finished loading the real profile yet, loadProfile() silently returns
  // DEFAULT_PROFILE, and saving would wipe every other field back to
  // blank. Both controls are wired up before bindStateRefresh runs, so
  // this can be clicked in that window on a slow connection. Block the
  // save rather than risk it.
  function isProfileReadyToSave() {
    return !!(window.SeavState?.ready && window.SeavState?.profile?.id);
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
    syncDashboardPublicPanel(profile);
  }

  function resolveDashboardPublicProfileUrl() {
    const profile = loadProfile();
    const path = Seav.buildPublicProfileUrl?.(profile) || "public-profile.html";
    return new URL(path, window.location.href).href;
  }

  async function copyDashboardPublicProfileLink() {
    const url = resolveDashboardPublicProfileUrl();

    try {
      await navigator.clipboard.writeText(url);
      Seav.notify("success", "Link copied", "Share your public profile with employers and recruiters.");
      return;
    } catch (err) {
      console.warn("[SEA-V] Dashboard public link clipboard copy failed:", err);
    }

    const urlEl = document.getElementById("dashPublicLinkUrl");
    if (urlEl) {
      urlEl.focus();
      urlEl.select?.();
    }

    Seav.notify("info", "Copy manually", "Select the link and copy it.");
  }

  function syncDashboardPublicPanel(profile) {
    const currentProfile = profile || loadProfile();
    const checkbox = document.getElementById("dashPublicEnabled");
    const sharePanel = document.getElementById("dashPublicShare");
    const statusEl = document.getElementById("dashPublicStatus");
    const hintEl = document.getElementById("dashPublicLinkHint");
    const linkWrap = document.getElementById("dashPublicLinkWrap");
    const urlEl = document.getElementById("dashPublicLinkUrl");
    const openEl = document.getElementById("dashPublicLinkOpen");
    const usernameInput = document.getElementById("dashPublicSlug");

    if (checkbox) {
      checkbox.checked = !!currentProfile.publicEnabled;
    }

    const enabled = !!currentProfile.publicEnabled;
    const url = resolveDashboardPublicProfileUrl();

    if (sharePanel) {
      sharePanel.classList.toggle("is-live", enabled);
    }

    if (statusEl) {
      statusEl.textContent = enabled ? "Live" : "Private";
      statusEl.classList.toggle("is-live", enabled);
      statusEl.classList.toggle("is-private", !enabled);
    }

    if (hintEl) {
      hintEl.hidden = enabled;
    }

    if (linkWrap) {
      linkWrap.hidden = !enabled;
    }

    if (urlEl) {
      urlEl.value = url;
      urlEl.title = url;
    }

    if (openEl) {
      openEl.href = url;
    }

    // QR is grouped with the link row and always visible while the panel is
    // live (no separate toggle/expand step) — just keep it regenerated
    // against the current url on every sync (renderDashboardProfile can
    // re-run from any seav:data-updated event, not just a public-link
    // change), so a slug change never leaves a stale code showing. No need
    // to explicitly blank it when going private: linkWrap.hidden above
    // already hides the whole group, QR included.
    if (enabled) {
      renderDashboardPublicQr(url);
    }

    // Don't clobber the field mid-edit — only sync it in from the saved
    // profile when the user isn't actively typing in it.
    if (usernameInput && document.activeElement !== usernameInput) {
      usernameInput.value = currentProfile.username || "";
    }
  }

  function setUsernameHint(message, isError) {
    const hintEl = document.getElementById("dashPublicSlugHint");
    if (!hintEl) return;
    hintEl.textContent = message || "";
    hintEl.classList.toggle("is-error", !!isError);
  }

  function initDashboardPublicUsername() {
    const input = document.getElementById("dashPublicSlug");
    const saveBtn = document.getElementById("dashPublicSlugSave");
    if (!input || !saveBtn) return;

    saveBtn.addEventListener("click", async () => {
      if (!isProfileReadyToSave()) {
        setUsernameHint("Still loading your profile — try again in a moment.", true);
        return;
      }

      const cleaned = slugifyUsername ? slugifyUsername(input.value) : input.value.trim().toLowerCase();
      input.value = cleaned;

      if (!cleaned) {
        setUsernameHint("Enter a username first.", true);
        return;
      }

      if (isValidUsername && !isValidUsername(cleaned)) {
        setUsernameHint("3-30 characters: lowercase letters, numbers, and hyphens only.", true);
        return;
      }

      const profile = loadProfile();
      if (cleaned === (profile.username || "")) {
        setUsernameHint("That's already your username.", false);
        return;
      }

      const updated = { ...profile, username: cleaned };

      try {
        await Seav.withSaving(async () => {
          await SeavAPI.save(KEYS.PROFILE, updated);
          if (window.SeavState?.refresh) {
            await window.SeavState.refresh();
          } else if (window.SeavState?.data) {
            window.SeavState.data.profile = updated;
          }
        }, { sub: "Updating your public link" });

        syncDashboardPublicPanel(updated);
        setUsernameHint("Saved — your link is updated.", false);
        Seav.notify("success", "Username saved", `Your public link is now /u/${cleaned}.`);
      } catch (err) {
        console.error("[SEA-V] Username save failed:", err);
        const message =
          err?.code === "USERNAME_TAKEN"
            ? err.message
            : err?.message || "Could not save username. Try again.";
        setUsernameHint(message, true);
        Seav.notify("error", "Could not save username", message);
      }
    });
  }

  // QR code for the public profile link -- lets a crew member hand their
  // profile to someone in person (a dock, a crew agency desk) by having
  // them scan it, instead of only being able to send a message. Generated
  // entirely client-side via qrcodejs (js/dashboard.html script tag): no
  // third-party "QR image API" is called, so the profile URL is never sent
  // anywhere just to render the code. Regenerated on every open (not
  // cached) so it always reflects the current username/slug.
  function renderDashboardPublicQr(url) {
    const canvasHost = document.getElementById("dashPublicQrCanvas");
    if (!canvasHost || !url) return;

    if (typeof window.QRCode !== "function") {
      // Library still loading (it's deferred) -- try again shortly rather
      // than silently leaving the panel blank.
      window.setTimeout(() => renderDashboardPublicQr(url), 200);
      return;
    }

    // Generated at a higher pixel size than it's displayed (see
    // .dashboard-public-share-qr-canvas in css/pages/dashboard.css, which
    // renders it at ~76px) so a shared/saved copy still scans and prints
    // cleanly, not just a small on-screen preview.
    canvasHost.innerHTML = "";
    new window.QRCode(canvasHost, {
      text: url,
      width: 168,
      height: 168,
      colorDark: "#0b1c2e",
      colorLight: "#ffffff",
      correctLevel: window.QRCode.CorrectLevel.M
    });
  }

  // The QR is small and always visible now (grouped with the link row —
  // see dashboard.html), so there's no toggle/expand step left to wire.
  // Tapping the code itself shares (or downloads, as a fallback) the QR
  // image via js/seav-share.js's shareCanvasImage — the QR is already a
  // canvas, so this skips seav-share's off-screen-render/html2canvas
  // pipeline entirely and just shares the canvas that's already on screen.
  function initDashboardPublicQr() {
    const shareBtn = document.getElementById("dashPublicQrShare");
    if (!shareBtn) return;

    shareBtn.addEventListener("click", async () => {
      if (shareBtn.disabled) return;
      const canvas = document.querySelector("#dashPublicQrCanvas canvas");
      if (!canvas) {
        Seav.notify("error", "QR code not ready", "Give it a second and try again.");
        return;
      }

      shareBtn.disabled = true;
      try {
        const profile = loadProfile();
        const url = resolveDashboardPublicProfileUrl();
        await window.SeavShare?.shareCanvasImage?.(canvas, {
          filenameBase: `seav-profile-qr-${(profile.username || "career").toLowerCase()}`,
          shareText: `Scan to view my SEA-V career profile: ${url}`,
          linkUrl: url
        });
      } finally {
        shareBtn.disabled = false;
      }
    });
  }

  // Collapsed by default (see dashboard.html comment) — a plain
  // expand/collapse chevron, not tied to saved state, since this is just
  // reducing header clutter, not a preference worth persisting.
  function expandDashboardPublicDetails() {
    const toggleBtn = document.getElementById("dashPublicShareToggle");
    const details = document.getElementById("dashPublicShareDetails");
    if (!toggleBtn || !details) return;

    toggleBtn.setAttribute("aria-expanded", "true");
    toggleBtn.setAttribute("aria-label", "Hide your public link");
    details.hidden = false;
  }

  function initDashboardPublicDetailsToggle() {
    const toggleBtn = document.getElementById("dashPublicShareToggle");
    const details = document.getElementById("dashPublicShareDetails");
    if (!toggleBtn || !details) return;

    toggleBtn.addEventListener("click", () => {
      const expanded = toggleBtn.getAttribute("aria-expanded") === "true";
      const next = !expanded;
      toggleBtn.setAttribute("aria-expanded", String(next));
      toggleBtn.setAttribute("aria-label", next ? "Hide your public link" : "Show your public link");
      details.hidden = !next;
    });
  }

  function initDashboardPublicToggle() {
    const checkbox = document.getElementById("dashPublicEnabled");
    const copyBtn = document.getElementById("dashPublicLinkCopy");
    const shareImageBtn = document.getElementById("dashPublicShareImage");
    if (!checkbox) return;

    syncDashboardPublicPanel();
    initDashboardPublicUsername();
    initDashboardPublicDetailsToggle();
    initDashboardPublicQr();

    copyBtn?.addEventListener("click", () => {
      copyDashboardPublicProfileLink();
    });

    shareImageBtn?.addEventListener("click", async () => {
      if (shareImageBtn.disabled) return;
      shareImageBtn.disabled = true;
      try {
        await window.SeavShare?.shareProfile?.();
      } finally {
        shareImageBtn.disabled = false;
      }
    });

    checkbox.addEventListener("change", async () => {
      if (!isProfileReadyToSave()) {
        checkbox.checked = !checkbox.checked;
        Seav.notify(
          "error",
          "Still loading",
          "Your profile hasn't finished loading yet — try again in a moment."
        );
        return;
      }

      const previous = !checkbox.checked;
      const profile = loadProfile();
      const updated = { ...profile, publicEnabled: checkbox.checked };

      try {
        await Seav.withSaving(async () => {
          await SeavAPI.save(KEYS.PROFILE, updated);
          if (window.SeavState?.refresh) {
            await window.SeavState.refresh();
          } else if (window.SeavState?.data) {
            window.SeavState.data.profile = updated;
          }
        }, { sub: "Updating public profile" });

        syncDashboardPublicPanel(updated);

        // Turning visibility on is exactly the moment someone wants their
        // link — auto-expand so it's not hidden behind the chevron right
        // when it becomes useful. Turning it off doesn't collapse it back;
        // no need to yank the panel shut if they're actively looking at it.
        if (updated.publicEnabled) {
          expandDashboardPublicDetails();
        }

        Seav.notify(
          "success",
          "Public profile updated",
          updated.publicEnabled
            ? "Your public profile is visible to anyone with your link."
            : "Your public profile is hidden."
        );
      } catch (err) {
        checkbox.checked = previous;
        syncDashboardPublicPanel(profile);
        console.error("[SEA-V] Dashboard public profile toggle failed:", err);
        Seav.notify("error", "Could not update public profile", err?.message || "Try again.");
      }
    });
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

  // --- "Add vessel" quick action: opens the real Add Vessel modal in place
  // instead of navigating to vessels.html (Jack, 2026-08-08 -- crew onboard
  // mainly use the 4 quick actions; fewer full-page loads also suits a
  // future PWA, see project_seav_pwa_ios_app_plan). Nothing about the modal
  // or its save/validation/upload logic is duplicated here: this fetches
  // vessels.html once, lifts its #vesselModal node into this page, and
  // lazy-loads js/vessels.js to drive it -- same code, same page, just
  // opened without a navigation. If any step fails, it falls back to a
  // normal navigation to vessels.html rather than leaving the button dead.
  let vesselModalLoadPromise = null;

  function loadVesselModalOnDashboard() {
    if (vesselModalLoadPromise) return vesselModalLoadPromise;

    vesselModalLoadPromise = (async () => {
      if (!document.getElementById("vesselModal")) {
        const res = await fetch("vessels.html", { cache: "force-cache" });
        if (!res.ok) throw new Error(`Failed to fetch vessels.html: ${res.status}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const modalEl = doc.getElementById("vesselModal");
        if (!modalEl) throw new Error("vesselModal not found in vessels.html");
        document.body.appendChild(modalEl);

        // Two things core.js only ever wires ONCE, at this page's own
        // DOMContentLoaded, against the DOM as it existed then -- so a modal
        // injected afterwards misses both:
        // 1. mountDateFields() expands [data-date-field] placeholders (the
        //    Start/End date pickers) into real year/month/day <select>s
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

      if (!window.SeavVessels) {
        const version = window.SeavConfig?.ASSET_VERSION || "";
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = `js/vessels.js?v=${version}`;
          script.defer = true;
          script.onload = resolve;
          script.onerror = () => reject(new Error("Failed to load js/vessels.js"));
          document.head.appendChild(script);
        });
      }

      if (!window.SeavVessels?.initVessels || !window.SeavVessels?.openAddVesselModal) {
        throw new Error("SeavVessels API unavailable after load");
      }

      window.SeavVessels.initVessels();
    })().catch((err) => {
      vesselModalLoadPromise = null; // allow retry on next click
      throw err;
    });

    return vesselModalLoadPromise;
  }

  function initDashboardAddVesselQuickAction() {
    const link = document.getElementById("dashAddVesselAction");
    const label = document.getElementById("dashAddVesselActionLabel");
    if (!link) return;

    const originalLabel = label ? label.textContent : "";

    link.addEventListener("click", async (e) => {
      e.preventDefault();

      if (label) label.textContent = "Loading…";
      link.setAttribute("aria-busy", "true");

      try {
        await loadVesselModalOnDashboard();
        window.SeavVessels.openAddVesselModal();
      } catch (err) {
        console.error("[SEA-V] Add vessel quick action failed, falling back to page navigation:", err);
        window.location.href = "vessels.html";
        return;
      } finally {
        if (label) label.textContent = originalLabel;
        link.removeAttribute("aria-busy");
      }
    });
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
    initDashboardPublicToggle();
    initDashboardAddVesselQuickAction();
    Seav.bindStateRefresh(runRefresh, { label: "Dashboard refresh" });
  }

  document.addEventListener("DOMContentLoaded", initDashboard);

  window.SeavDashboard = { refresh };
})();
