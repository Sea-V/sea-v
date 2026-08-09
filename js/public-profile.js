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

  // Public profile shows a computed age, never the raw date of birth (dob
  // stays intact and full-precision in the private profile edit form — see
  // docs/schema-public-profile-age-and-coc-redaction.sql). profile.age comes
  // from the get_public_profile() RPC, which is the only path anon has to
  // this data at all now.
  function formatAgePublic(value) {
    return typeof value === "number" && Number.isFinite(value) ? `${value}` : "—";
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
      isProfilePublic
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
      const ageEl = document.getElementById("ppProfileAge");
      const passportsEl = document.getElementById("ppProfilePassports");
      const visasEl = document.getElementById("ppProfileVisas");
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
      if (ageEl) ageEl.textContent = formatAgePublic(profile.age);
      if (passportsEl) passportsEl.textContent = profile.passportsHeld || "—";
      if (visasEl) visasEl.textContent = profile.visasHeld || "—";

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

    // The /u/:username -> /public-profile.html?u=:username rule (netlify.toml/
    // vercel.json) is a server-side rewrite: the proxy fetches this static
    // file using the rewritten URL, but it never hands that rewritten query
    // string to the browser — window.location (and anything reading it, like
    // URLSearchParams) always reflects the URL actually typed/shared, i.e.
    // "/u/jack-sorrell" with NO query string at all. That's true of every
    // static host (Vercel/Netlify included) doing a query-string rewrite for
    // a plain HTML file, not something we misconfigured. So the username has
    // to be recovered from location.pathname directly — relying on ?u= alone
    // silently fell through to "no profileId", which made this page treat
    // every /u/<username> link (the one people actually share) as if no
    // profile was requested at all: the not-public gate for logged-out
    // visitors, or whichever account happened to be logged in for anyone
    // who was signed in in that browser.
    function getUsernameFromPrettyPath() {
      const match = location.pathname.match(/\/u\/([^/?#]+)\/?$/i);
      return match ? decodeURIComponent(match[1]) : null;
    }

    async function loadProfile() {
      const params = new URLSearchParams(location.search);
      // "u" (query form, or recovered from the /u/<username> pretty path)
      // is the clean link; "p"/"id" are the older raw-UUID link, kept
      // working for anything already shared. SeavAPI.getPublicProfile tries
      // all three column matches regardless of which param supplied the
      // value.
      const profileId =
        params.get("u") || getUsernameFromPrettyPath() || params.get("p") || params.get("id");

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

    // Only these three sections actually render a photo on the public
    // profile (vessel/tender photo, hobby photo gallery). Certificates,
    // references, onboard experience, specialist qualifications, payslips,
    // and sea time all carry a file/attachment field too, but this page
    // never displays it — no <img>, no download link, nothing. Before this
    // fix, every single one of those attachments still got hydrated into a
    // signed URL (one Supabase Storage API round-trip each) on every public
    // profile load, for no visible benefit — pure wasted latency that grows
    // with how much a crew member has logged. Skipping hydration for the
    // fields that are genuinely unused here was the main fix for "public
    // profile photos took ages to load."
    const PHOTO_RENDERING_KEYS = new Set([
      KEYS.VESSELS,
      KEYS.TENDERS,
      KEYS.HOBBIES_INTERESTS
    ]);

    async function loadPublicData(ownerUserId, key, profile) {
      if (!ownerUserId || !SeavAPI.getArrayForUser) return [];
      const useOwnerAccess = isOwnProfilePreview(ownerUserId, profile);
      const skipFiles = !PHOTO_RENDERING_KEYS.has(key);
      return SeavAPI.getArrayForUser(
        key,
        ownerUserId,
        useOwnerAccess ? { skipFiles } : { public: true, skipFiles }
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

        // Computed once and threaded into every section renderer below —
        // only the profile owner previewing their own public page gets the
        // empty-state "Add X" CTA buttons (see js/public-profile-sections.js
        // buildEmptyState). A stranger viewing this profile just sees the
        // plain guidance text, no dead-end edit links.
        const isOwner = isOwnProfilePreview(ownerId, profile);

        const [
          vessels,
          tenders,
          refs,
          navigationAreas,
          onboardEntries,
          onboardSkills,
          hobbyEntries,
          specialistEntries,
          achievements,
          seatimes,
          certs
        ] = await Promise.all([
          loadPublicData(ownerId, KEYS.VESSELS, profile),
          loadPublicData(ownerId, KEYS.TENDERS, profile),
          loadPublicData(ownerId, KEYS.REFS, profile),
          loadPublicData(ownerId, KEYS.NAVIGATION_AREAS, profile),
          loadPublicData(ownerId, KEYS.ONBOARD_EXPERIENCES, profile),
          loadPublicData(ownerId, KEYS.ONBOARD_SKILLS, profile),
          loadPublicData(ownerId, KEYS.HOBBIES_INTERESTS, profile),
          loadPublicData(ownerId, KEYS.SPECIALIST_QUALIFICATIONS, profile),
          loadPublicData(ownerId, KEYS.ACHIEVEMENTS, profile),
          loadPublicData(ownerId, KEYS.SEATIMES, profile),
          loadPublicData(ownerId, KEYS.CERTS, profile)
        ]);

        const navigationDistanceMap = await buildPublicDistanceMap(navigationAreas);

        // 2026-08-09, per Jack: sea time is now private-only — no longer
        // surfaced on the public profile (standalone Sea Time Totals
        // section, per-vessel Sea Time collapsible, or a "Sea days logged"
        // header stat). `seatimes` is still fetched above because the
        // Milestones section below derives certificate progress from it —
        // that only shows a progress bar/percent, never raw sea time data.
        const metrics = {
          vessels: vessels.length,
          verifiedRefs: refs.filter(isReferenceVerified).length,
          onboardOps: onboardEntries.length,
          navigationNm: computeNavigationTotalNm(navigationAreas, navigationDistanceMap)
        };

        renderHeaderProfile(profile, vessels, metrics);
        // Vessels is now the vessel-first spine — Tenders, Onboard
        // Experience, and References no longer render as their own
        // sections; that content lives inside each vessel's own card (see
        // js/seav-cards.js buildVesselCardFull), so renderVessels needs the
        // raw onboardEntries/achievements arrays too.
        sections.renderVessels(vessels, tenders, refs, isOwner, onboardEntries, achievements);
        await sections.renderNavigation(navigationAreas, vessels, navigationDistanceMap, isOwner);
        sections.renderOnboardSkills(onboardSkills, isOwner);
        sections.renderHobbiesInterests(hobbyEntries, isOwner);
        sections.renderSpecialistQualifications(specialistEntries, isOwner);
        sections.renderCertificates(certs, isOwner);
        sections.renderAchievements(achievements, vessels, isOwner, { seatimes, certs, navigationAreas });

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
