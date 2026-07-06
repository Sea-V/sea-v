// /js/public-profile.js
(function () {
  "use strict";

  async function waitForDependency(getter, maxMs = 8000) {
    const started = Date.now();
    while (Date.now() - started < maxMs) {
      const value = getter();
      if (value) return value;
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }
    return null;
  }

  async function waitForSupabase(maxMs = 8000) {
    return waitForDependency(() => window.SeavSupabase, maxMs);
  }

  function populateSectionIcons() {
    document.querySelectorAll("[data-pp-icon]").forEach((el) => {
      const key = el.getAttribute("data-pp-icon");
      const svg = window.SeavIcons?.[key];
      if (svg) el.innerHTML = svg;
    });
  }

  function showPublicProfileBootstrapError(message) {
    const loading = document.getElementById("ppLoading");
    const gate = document.getElementById("ppGate");
    const content = document.getElementById("ppContent");

    if (loading) loading.hidden = true;
    if (content) content.hidden = true;
    if (!gate) return;

    gate.hidden = false;
    const title = gate.querySelector("h3");
    const body = gate.querySelector("p");
    if (title) title.textContent = "Could not load profile";
    if (body) body.textContent = message;
  }

  async function initPublicProfilePage() {
    const Seav = await waitForDependency(() => window.Seav);
    const SeavAPI = await waitForDependency(() => window.SeavAPI);
    const SeavData = await waitForDependency(() => window.SeavData);
    const utils = await waitForDependency(() => window.SeavPublicProfileUtils);
    const sections = await waitForDependency(() => window.SeavPublicProfileSections);

    if (!Seav || !SeavAPI || !SeavData || !utils || !sections) {
      showPublicProfileBootstrapError(
        "SEA-V scripts did not load completely. Hard refresh the page (Cmd+Shift+R)."
      );
      return;
    }

    const {
      buildCareerTagline,
      renderTrustStrip,
      isReferenceVerified,
      computeNavigationTotalNm,
      buildPublicDistanceMap,
      bindExpandToggles,
      renderSectionNav
    } = utils;

    const {
      KEYS,
      DEFAULT_PROFILE,
      isProfilePublic,
      getSeatimeTotals
    } = SeavData;

    function getProfileOwnerUserId(profile) {
      const userId = profile?.userId || profile?.user_id;
      if (userId) return userId;
      const id = profile?.id;
      if (!id || id === "default-profile") return null;
      return id;
    }

    function wirePublicProfileNav() {
      const brand = document.querySelector(".public-profile-brand");
      if (!brand) return;
      const goDashboard = window.SeavAuth?.isAuthenticated?.() === true;
      brand.setAttribute("href", goDashboard ? "dashboard.html" : "index.html");
    }

    function renderHeaderProfile(profile, vessels, metrics) {
      const avatar = document.getElementById("ppAvatar");
      const nameEl = document.getElementById("pp_name");
      const taglineEl = document.getElementById("pp_tagline");
      const qualificationEl = document.getElementById("ppProfileQualification");
      const rankEl = document.getElementById("ppProfileRank");
      const availabilityEl = document.getElementById("ppProfileAvailability");
      const nationalityEl = document.getElementById("ppProfileNationality");
      const locationEl = document.getElementById("ppProfileLocation");
      const bioEl = document.getElementById("pp_bio");
      const overviewWrap = document.getElementById("ppCareerOverview");
      const footerNote = document.getElementById("ppFooterNote");
      const shellTitle = document.getElementById("ppShellTitle");

      const displayName = profile.name || "Seafarer";

      if (nameEl) nameEl.textContent = displayName;
      document.title = `${displayName} · Yacht CV · SEA-V`;
      if (shellTitle) shellTitle.textContent = `${displayName} — public profile`;

      if (qualificationEl) qualificationEl.textContent = profile.qualification || "—";
      if (rankEl) rankEl.textContent = profile.rank || "—";
      if (availabilityEl) availabilityEl.textContent = profile.availability || "—";
      if (nationalityEl) nationalityEl.textContent = profile.nationality || "—";
      if (locationEl) locationEl.textContent = profile.location || "—";

      const tagline = buildCareerTagline(vessels);
      if (taglineEl) {
        taglineEl.textContent = tagline;
        taglineEl.hidden = !tagline;
      }

      if (bioEl && overviewWrap) {
        bioEl.textContent = profile.bio || "";
        overviewWrap.hidden = !profile.bio;
      }

      renderTrustStrip(metrics);

      if (footerNote) footerNote.hidden = false;

      if (avatar) {
        const photoUrl =
          Seav.getFileDisplayUrl?.(
            profile.photo,
            window.SeavApiCore?.STORAGE_BUCKETS?.PROFILE_PHOTOS || "profile-photos"
          ) ||
          profile.photo?.url ||
          profile.photo?.dataUrl ||
          "";
        if (photoUrl) {
          const safeUrl = String(photoUrl).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
          avatar.style.backgroundImage = `url("${safeUrl}")`;
          avatar.style.backgroundSize = "cover";
          avatar.style.backgroundPosition = "center";
          avatar.style.backgroundRepeat = "no-repeat";
        } else {
          avatar.style.backgroundImage = "";
        }
      }
    }

    async function loadProfile() {
      const params = new URLSearchParams(location.search);
      const profileId = params.get("p") || params.get("id");

      if (profileId) {
        const publicProfile = await SeavAPI.getPublicProfile(profileId);
        if (publicProfile) return { ...DEFAULT_PROFILE, ...publicProfile };
        return { ...DEFAULT_PROFILE, publicEnabled: false };
      }

      if (window.SeavAuth?.isAuthenticated?.()) {
        const ownProfile = await SeavAPI.get(KEYS.PROFILE, DEFAULT_PROFILE);
        return { ...DEFAULT_PROFILE, ...ownProfile };
      }

      return { ...DEFAULT_PROFILE, publicEnabled: false };
    }

    function isOwnProfilePreview(ownerUserId, profile) {
      const authId = window.SeavAuth?.getUserId?.();
      if (!authId || !ownerUserId) return false;
      if (authId === ownerUserId) return true;
      if (profile?.userId === authId || profile?.user_id === authId) return true;
      if (profile?.id === authId) return true;
      return false;
    }

    async function loadPublicData(ownerUserId, key, profile) {
      if (!ownerUserId || !SeavAPI.getArrayForUser) return [];
      const useOwnerAccess = isOwnProfilePreview(ownerUserId, profile);
      return SeavAPI.getArrayForUser(
        key,
        ownerUserId,
        useOwnerAccess ? {} : { public: true }
      );
    }

    async function refreshPublicProfileView() {
      const gate = document.getElementById("ppGate");
      const content = document.getElementById("ppContent");
      const loading = document.getElementById("ppLoading");

      try {
        await waitForSupabase();

        const profile = await loadProfile();
        const isPublic = isProfilePublic(profile);

        if (loading) loading.hidden = true;

        if (!isPublic) {
          if (gate) gate.hidden = false;
          if (content) content.hidden = true;
          if (gate) {
            const title = gate.querySelector("h3");
            const message = gate.querySelector("p");
            if (title) title.textContent = "Profile not public";
            if (message) {
              message.textContent =
                "This profile is currently set to private. Ask the seafarer to enable their public profile on the SEA-V dashboard.";
            }
          }
          return;
        }

        if (gate) gate.hidden = true;
        if (content) content.hidden = false;

        const ownerId = getProfileOwnerUserId(profile);
        if (!ownerId) {
          throw new Error("Public profile owner id missing.");
        }

        const [
          vessels,
          tenders,
          refs,
          navigationAreas,
          onboardEntries,
          hobbyEntries,
          specialistEntries,
          achievements,
          seatimes
        ] = await Promise.all([
          loadPublicData(ownerId, KEYS.VESSELS, profile),
          loadPublicData(ownerId, KEYS.TENDERS, profile),
          loadPublicData(ownerId, KEYS.REFS, profile),
          loadPublicData(ownerId, KEYS.NAVIGATION_AREAS, profile),
          loadPublicData(ownerId, KEYS.ONBOARD_EXPERIENCES, profile),
          loadPublicData(ownerId, KEYS.HOBBIES_INTERESTS, profile),
          loadPublicData(ownerId, KEYS.SPECIALIST_QUALIFICATIONS, profile),
          loadPublicData(ownerId, KEYS.ACHIEVEMENTS, profile),
          loadPublicData(ownerId, KEYS.SEATIMES, profile)
        ]);

        const navigationDistanceMap = await buildPublicDistanceMap(navigationAreas);

        const metrics = {
          seaDays: getSeatimeTotals(seatimes).sea,
          vessels: vessels.length,
          verifiedRefs: refs.filter(isReferenceVerified).length,
          signedOps: onboardEntries.filter((entry) => entry.status === "Signed Off").length,
          navigationNm: computeNavigationTotalNm(navigationAreas, navigationDistanceMap)
        };

        renderHeaderProfile(profile, vessels, metrics);
        sections.renderSeatime(seatimes, vessels);
        sections.renderVessels(vessels, onboardEntries, seatimes);
        sections.renderTenders(tenders, vessels);
        await sections.renderNavigation(navigationAreas, vessels, navigationDistanceMap);
        sections.renderOnboardExperience(onboardEntries, vessels);
        sections.renderHobbiesInterests(hobbyEntries);
        sections.renderSpecialistQualifications(specialistEntries);
        sections.renderReferences(refs, vessels);
        sections.renderAchievements(achievements);

        bindExpandToggles(document.getElementById("ppContent"));
        renderSectionNav();
        populateSectionIcons();
      } catch (err) {
        console.error("[SEA-V] Public profile render failed:", err);
        if (loading) loading.hidden = true;
        if (content) content.hidden = true;
        if (gate) {
          gate.hidden = false;
          const title = gate.querySelector("h3");
          const message = gate.querySelector("p");
          if (title) title.textContent = "Could not load profile";
          if (message) {
            message.textContent =
              err?.message ||
              "Something went wrong loading this public profile. Refresh the page or try again later.";
          }
        }
      }
    }

    if (window.SeavAuth?.whenReady) {
      await window.SeavAuth.whenReady();
    }
    wirePublicProfileNav();
    await refreshPublicProfileView();

    document.addEventListener("seav:data-updated", refreshPublicProfileView);
  }

  document.addEventListener("DOMContentLoaded", () => {
    initPublicProfilePage().catch((err) => {
      console.error("[SEA-V] Public profile init failed:", err);
      showPublicProfileBootstrapError(
        "Could not start the public profile page. Hard refresh and try again."
      );
    });
  });
})();
