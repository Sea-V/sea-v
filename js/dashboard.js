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

  const { DEFAULT_PROFILE, getSeatimeTotals, KEYS } = window.SeavData;

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
    syncDashboardPublicToggle(profile);
  }

  function syncDashboardPublicToggle(profile) {
    const checkbox = document.getElementById("dashPublicEnabled");
    if (!checkbox) return;
    checkbox.checked = !!(profile || loadProfile()).publicEnabled;
  }

  function initDashboardPublicToggle() {
    const checkbox = document.getElementById("dashPublicEnabled");
    if (!checkbox) return;

    syncDashboardPublicToggle();

    checkbox.addEventListener("change", async () => {
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

        Seav.notify(
          "success",
          "Public profile updated",
          updated.publicEnabled
            ? "Your public profile is visible to anyone with your link."
            : "Your public profile is hidden."
        );
      } catch (err) {
        checkbox.checked = previous;
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

  function initDashboard() {
    const isDashboard =
      document.getElementById("dashSeatimeSnippet") ||
      document.getElementById("dashProfileName") ||
      document.getElementById("kpiTotalDays");

    if (!isDashboard) return;

    const runRefresh = async () => {
      await refresh();
    };

    initDashboardPublicToggle();
    Seav.bindStateRefresh(runRefresh, { label: "Dashboard refresh" });
  }

  document.addEventListener("DOMContentLoaded", initDashboard);

  window.SeavDashboard = { refresh };
})();
