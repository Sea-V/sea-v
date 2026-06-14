// /js/public-profile.js
(function () {
  "use strict";

  if (!window.Seav || !window.SeavAPI || !window.SeavData) {
    console.warn("[SEA-V] Public profile dependencies missing.");
    return;
  }

  const {
    KEYS,
    DEFAULT_PROFILE,
    MANDATORY_CERTS,
    RECOMMENDED_CERTS,
    getReferenceStatus,
    getCertExpiryInfo,
    isCertNoExpiry,
    isProfilePublic,
    formatDatePretty,
    getOnboardCategoryLabel,
    getHobbyInterestCategoryLabel,
    getSpecialistCategoryLabel,
    getSeatimeTotals,
    renderMandatoryCertDetailHtml,
    isSuppressedAdditionalCert
  } = window.SeavData;

  const U = () => window.SeavPublicProfileUtils;

  const expandedPublicCertIds = new Set();
  let publicCertToggleBound = false;

  const SECTION_NAV = [
    { id: "pp-section-overview", label: "Overview" },
    { id: "ppCertSection", label: "Certificates" },
    { id: "ppVesselSection", label: "Yachts" },
    { id: "ppSeatimeSection", label: "Sea time" },
    { id: "ppRefSection", label: "References" },
    { id: "ppOperationsSection", label: "Operations" },
    { id: "ppNavigationSection", label: "Navigation" },
    { id: "ppSpecialistSection", label: "Skills" },
    { id: "ppAchievementSection", label: "Highlights" },
    { id: "ppHobbiesSection", label: "Interests" }
  ];

  let sectionNavObserver = null;


  const LIMITS = U()?.LIMITS || {};
  function renderHeaderProfile(profile, vessels, metrics) {
    const avatar = document.getElementById("ppAvatar");
    const nameEl = document.getElementById("pp_name");
    const rankEl = document.getElementById("pp_rank");
    const taglineEl = document.getElementById("pp_tagline");
    const factsEl = document.getElementById("ppFactsInline");
    const bioEl = document.getElementById("pp_bio");
    const overviewWrap = document.getElementById("ppCareerOverview");
    const footerNote = document.getElementById("ppFooterNote");

    const rank = profile.rank || "";
    const qualification = profile.qualification || "";
    const displayName = profile.name || "Seafarer";

    if (nameEl) nameEl.textContent = displayName;
    document.title = `${displayName} · Yacht CV · SEA-V`;

    if (rankEl) {
      rankEl.textContent =
        qualification && rank
          ? `${rank} • ${qualification}`
          : rank || qualification || "—";
    }

    const tagline = buildCareerTagline(vessels);
    if (taglineEl) {
      taglineEl.textContent = tagline;
      taglineEl.hidden = !tagline;
    }

    if (factsEl) {
      const facts = [profile.nationality, profile.location, profile.availability].filter(
        Boolean
      );
      factsEl.textContent = facts.length ? facts.join(" • ") : "—";
    }

    if (bioEl && overviewWrap) {
      bioEl.textContent = profile.bio || "";
      overviewWrap.hidden = !profile.bio;
    }

    renderTrustStrip(metrics);

    if (footerNote) footerNote.hidden = false;

    if (avatar) {
      const photoUrl = profile.photo?.url || profile.photo?.dataUrl || "";
      if (photoUrl) {
        avatar.style.backgroundImage = `url(${photoUrl})`;
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

    const profile = await SeavAPI.get(KEYS.PROFILE, DEFAULT_PROFILE);
    return { ...DEFAULT_PROFILE, ...profile };
  }

  async function loadPublicData(profileId, key) {
    if (profileId && SeavAPI.getArrayForUser) {
      return SeavAPI.getArrayForUser(key, profileId);
    }
    return SeavAPI.getArray(key);
  }

  async function refreshPublicProfileView() {
    const gate = document.getElementById("ppGate");
    const content = document.getElementById("ppContent");
    const loading = document.getElementById("ppLoading");

    try {
      const profile = await loadProfile();
      const isPublic = isProfilePublic(profile);

      if (loading) loading.hidden = true;

      if (!isPublic) {
        if (gate) gate.hidden = false;
        if (content) content.style.display = "none";
        return;
      }

      if (gate) gate.hidden = true;
      if (content) content.style.display = "block";

      const ownerId = profile.id;

      const [
        vessels,
        certs,
        refs,
        navigationAreas,
        onboardEntries,
        hobbyEntries,
        specialistEntries,
        achievements,
        seatimes
      ] = await Promise.all([
        loadPublicData(ownerId, KEYS.VESSELS),
        loadPublicData(ownerId, KEYS.CERTS),
        loadPublicData(ownerId, KEYS.REFS),
        loadPublicData(ownerId, KEYS.NAVIGATION_AREAS),
        loadPublicData(ownerId, KEYS.ONBOARD_EXPERIENCES),
        loadPublicData(ownerId, KEYS.HOBBIES_INTERESTS),
        loadPublicData(ownerId, KEYS.SPECIALIST_QUALIFICATIONS),
        loadPublicData(ownerId, KEYS.ACHIEVEMENTS),
        loadPublicData(ownerId, KEYS.SEATIMES)
      ]);

      const metrics = {
        seaDays: getSeatimeTotals(seatimes).sea,
        vessels: vessels.length,
        verifiedRefs: refs.filter(isReferenceVerified).length,
        signedOps: onboardEntries.filter((entry) => entry.status === "Signed Off").length,
        certSummary: getCertComplianceSummary(certs),
        navigationNm: computeNavigationTotalNm(navigationAreas)
      };

      renderHeaderProfile(profile, vessels, metrics);
      window.SeavPublicProfileSections.renderSeatime(seatimes, vessels);
      window.SeavPublicProfileSections.renderVessels(vessels, onboardEntries, seatimes);
      window.SeavPublicProfileSections.renderNavigation(navigationAreas);
      window.SeavPublicProfileSections.renderOperations(onboardEntries, vessels);
      window.SeavPublicProfileSections.renderHobbiesInterests(hobbyEntries);
      window.SeavPublicProfileSections.renderCertificates(certs);
      window.SeavPublicProfileSections.renderSpecialistQualifications(specialistEntries);
      window.SeavPublicProfileSections.renderReferences(refs);
      window.SeavPublicProfileSections.renderAchievements(achievements);

      bindExpandToggles(document.getElementById("ppContent"));
      renderSectionNav();
    } catch (err) {
      console.error("[SEA-V] Public profile render failed:", err);
      if (loading) loading.hidden = true;
      if (content) content.style.display = "none";
      if (gate) {
        gate.hidden = false;
        const title = gate.querySelector("h3");
        const message = gate.querySelector("p");
        if (title) title.textContent = "Could not load profile";
        if (message) {
          message.textContent =
            "Something went wrong loading this public profile. Refresh the page or try again later.";
        }
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindPublicCertToggles();
    refreshPublicProfileView();
  });
  document.addEventListener("seav:data-updated", refreshPublicProfileView);
})();
