// /js/seav-badges.js
(function () {
  "use strict";

  const LOCKED_IMAGE = "/img/badges/locked.svg";
  const DEFAULT_IMAGE = "/img/badges/default.svg";

  const BADGES = {
// Deck Progression (Career Path Milestones) — sourced from MSN 1858's real OOW Yachts <3000GT
// sea-time sub-requirements (replaces the old arbitrary 30/100/250/500-day,
// 1/3-year round-number badges — see js/achievements-engine.js for the
// trigger math behind each one).
oow_250_actual_days: {
  key: "oow_250_actual_days",
  label: "250 Actual Sea Days",
  fileName: "oow-250-actual-days.svg",
  image: "/img/badges/oow-250-actual-days.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "bronze"
},
oow_365_qualifying_days: {
  key: "oow_365_qualifying_days",
  label: "365 Qualifying Days Onboard",
  fileName: "oow-365-qualifying-days.svg",
  image: "/img/badges/oow-365-qualifying-days.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "silver"
},
oow_36_months_onboard: {
  key: "oow_36_months_onboard",
  label: "36 Months Onboard Yacht Service",
  fileName: "oow-36-months-onboard.svg",
  image: "/img/badges/oow-36-months-onboard.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "gold"
},
oow_3000gt_sea_time: {
  key: "oow_3000gt_sea_time",
  label: "OOW Yachts <3000GT — Sea Time Complete",
  fileName: "oow-3000gt-sea-time.svg",
  image: "/img/badges/oow-3000gt-sea-time.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "platinum"
},

yachtmaster_offshore: {
  key: "yachtmaster_offshore",
  label: "RYA Yachtmaster Offshore — Sea Miles",
  fileName: "yachtmaster-offshore.svg",
  image: "/img/badges/yachtmaster-offshore.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "gold"
},
master_200gt_sea_service: {
  key: "master_200gt_sea_service",
  label: "Master <200GT — Sea Service",
  fileName: "master-200gt-sea-service.svg",
  image: "/img/badges/master-200gt-sea-service.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "gold"
},
master_500gt_sea_service: {
  key: "master_500gt_sea_service",
  label: "Master <500GT — Sea Service",
  fileName: "master-500gt-sea-service.svg",
  image: "/img/badges/master-500gt-sea-service.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "platinum"
},
master_3000gt_sea_service: {
  key: "master_3000gt_sea_service",
  label: "Master <3000GT — Sea Service",
  fileName: "master-3000gt-sea-service.svg",
  image: "/img/badges/master-3000gt-sea-service.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "platinum"
},
chief_mate_3000gt_eligible: {
  key: "chief_mate_3000gt_eligible",
  label: "Chief Mate Yachts <3000GT — Eligible",
  fileName: "chief-mate-3000gt-eligible.svg",
  image: "/img/badges/chief-mate-3000gt-eligible.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "gold"
},
chief_mate_yachts_unlimited: {
  key: "chief_mate_yachts_unlimited",
  label: "Chief Mate Yachts Unlimited — CoC Prerequisite Met",
  fileName: "chief-mate-yachts-unlimited.svg",
  image: "/img/badges/chief-mate-yachts-unlimited.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "platinum"
},
master_yachts_unlimited: {
  key: "master_yachts_unlimited",
  label: "Master Yachts Unlimited — Sea Service",
  fileName: "master-yachts-unlimited.svg",
  image: "/img/badges/master-yachts-unlimited.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "platinum"
},

atlantic_crossing: {
  key: "atlantic_crossing",
  label: "Atlantic Crossing",
  fileName: "atlantic-crossing.svg",
  image: "/img/badges/atlantic-crossing.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "gold"
},
pacific_crossing: {
  key: "pacific_crossing",
  label: "Pacific Crossing",
  fileName: "pacific-crossing.svg",
  image: "/img/badges/pacific-crossing.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "platinum"
},
};

  const ACHIEVEMENTS = {
    // Deck Progression (Career Path Milestones) — each of these maps to a real MSN 1858 sea-time
    // sub-requirement for the OOW Yachts <3000GT Certificate of Competency
    // (see docs research: MSN 1858 SS3.3 & SS4.2), instead of an arbitrary
    // round number. See js/achievements-engine.js for the trigger math.
    yachtmaster_offshore: {
      code: "yachtmaster_offshore",
      title: "RYA Yachtmaster Offshore — Sea Miles",
      category: "Deck Progression",
      certGroup: "RYA Yachtmaster Offshore",
      dashboardSection: "navigation",
      sourcePage: "navigation",
      badgeKey: "yachtmaster_offshore",
      description: "Logged 2,500 qualifying miles, at least 1,250 of them in tidal waters — the sea-mile prerequisite for the RYA Yachtmaster Offshore exam, separate from any MCA Certificate of Competency.",
      approvalRequired: false,
      trigger: { type: "yachtmaster_offshore_miles" }
    },

    oow_250_actual_days: {
      code: "oow_250_actual_days",
      title: "250 Actual Sea Days",
      category: "Deck Progression",
      certGroup: "OOW Yachts <3000GT",
      dashboardSection: "seatime",
      sourcePage: "seatime",
      badgeKey: "oow_250_actual_days",
      description: "Logged 250 days of actual sea service on vessels 15m or over — one of the two sea-time components of the OOW Yachts <3000GT sea-service requirement (MSN 1858).",
      approvalRequired: false,
      trigger: { type: "oow_actual_sea_days", minDays: 250, minVesselMeters: 15 }
    },
    oow_365_qualifying_days: {
      code: "oow_365_qualifying_days",
      title: "365 Qualifying Days Onboard (≥15m)",
      category: "Deck Progression",
      certGroup: "OOW Yachts <3000GT",
      dashboardSection: "seatime",
      sourcePage: "seatime",
      badgeKey: "oow_365_qualifying_days",
      description: "Logged 365 qualifying days onboard vessels 15m or over — actual sea service plus standby/yard time — the vessel-size sea-time requirement for OOW Yachts <3000GT (MSN 1858).",
      approvalRequired: false,
      trigger: { type: "oow_qualifying_days", minDays: 365, minVesselMeters: 15 }
    },
    oow_36_months_onboard: {
      code: "oow_36_months_onboard",
      title: "36 Months Onboard Yacht Service",
      category: "Deck Progression",
      certGroup: "OOW Yachts <3000GT",
      dashboardSection: "seatime",
      sourcePage: "seatime",
      badgeKey: "oow_36_months_onboard",
      description: "Logged 36 months' total onboard yacht service since starting your sea career — the overall time requirement for OOW Yachts <3000GT (MSN 1858).",
      approvalRequired: false,
      trigger: { type: "sea_days", minDays: 1095 }
    },
    oow_3000gt_sea_time: {
      code: "oow_3000gt_sea_time",
      title: "OOW Yachts <3000GT — Sea Time Complete",
      category: "Deck Progression",
      certGroup: "OOW Yachts <3000GT",
      dashboardSection: "seatime",
      sourcePage: "seatime",
      badgeKey: "oow_3000gt_sea_time",
      description: "Met every sea-time requirement for OOW Yachts <3000GT: 250 actual sea days, 365 qualifying days on vessels 15m or over, and 36 months' total onboard yacht service (MSN 1858).",
      approvalRequired: false,
      trigger: { type: "oow_eligible" }
    },

    // 2026-08-05: these 5 titles (Master <200/500/3000GT, Master Yachts
    // Unlimited, RYA Yachtmaster Offshore) used to end in "— Sea Service
    // Complete" / "— Miles Complete". Jack reported the Master <500GT
    // milestone read as "Sea Service Complete" while it was only ~70%
    // done — because this exact title string is what's rendered as the
    // headline on the "Next up" in-progress card (achievements.js
    // renderNextMilestone / core.js renderDashboardNextMilestone) and on
    // not-yet-unlocked Deck Progression rows (buildProgressRow), with no
    // distinction from the truly-unlocked state other than a small
    // checkmark. Dropped "Complete"/"Miles Complete" from the title so it
    // no longer asserts completion while in progress — the checkmark +
    // "Unlocked" tooltip + earned-section placement already convey
    // completion once actually earned, so no information is lost.
    master_200gt_sea_service: {
      code: "master_200gt_sea_service",
      title: "Master <200GT — Sea Service",
      category: "Deck Progression",
      certGroup: "Master <200GT",
      dashboardSection: "seatime",
      sourcePage: "seatime",
      badgeKey: "master_200gt_sea_service",
      description: "Logged 6 months' seagoing service while holding RYA Yachtmaster Offshore — the sea-service requirement for Master (Code Vessel) <200GT (MSN 1858 §3.1). Only sea time logged after your Yachtmaster Offshore issue date counts.",
      approvalRequired: false,
      trigger: { type: "master_200gt_gated_sea_service", gatingCertCode: "RYA YMO" }
    },

    master_500gt_sea_service: {
      code: "master_500gt_sea_service",
      title: "Master <500GT — Sea Service",
      category: "Deck Progression",
      certGroup: "Master <500GT",
      dashboardSection: "seatime",
      sourcePage: "seatime",
      badgeKey: "master_500gt_sea_service",
      description: "Logged 12 months onboard as deck officer while holding OOW Yachts <3000GT, including 120 days' watchkeeping service on vessels 15m or over — the sea-service requirement for Master (Yacht) <500GT (MSN 1858 §3.5). Onboard months count only after your OOW <3000GT issue date; watchkeeping days count across your full sea time record.",
      approvalRequired: false,
      trigger: { type: "master_500gt_gated_sea_service", gatingCertCode: "OOW YACHT" }
    },

    master_3000gt_sea_service: {
      code: "master_3000gt_sea_service",
      title: "Master <3000GT — Sea Service",
      category: "Deck Progression",
      certGroup: "Master <3000GT",
      dashboardSection: "seatime",
      sourcePage: "seatime",
      badgeKey: "master_3000gt_sea_service",
      description: "Logged 240 watchkeeping days on vessels 15m or over, plus 12 months on 500GT+ vessels or 24 months on 24m+ vessels while holding OOW Yachts <3000GT — the sea-service requirement for Master (Yacht) <3000GT (MSN 1858 §3.6(a)). The 500GT+/24m+ months count only after your OOW <3000GT issue date; watchkeeping days count across your full sea time record.",
      approvalRequired: false,
      trigger: { type: "master_3000gt_gated_sea_service", gatingCertCode: "OOW YACHT" }
    },

    chief_mate_3000gt_eligible: {
      code: "chief_mate_3000gt_eligible",
      title: "Chief Mate Yachts <3000GT — Eligible",
      category: "Deck Progression",
      certGroup: "Chief Mate Yachts <3000GT",
      dashboardSection: "certificates",
      sourcePage: "certificates",
      badgeKey: "chief_mate_3000gt_eligible",
      description: "Holding your OOW Yachts <3000GT eligibility (sea time met or the certificate held) plus RYA Yachtmaster Ocean (or IYT Master of Yachts Unlimited) qualifies you for Chief Mate Yachts <3000GT (MSN 1858 §3.4) — no extra sea time is needed beyond OOW's own requirement, and it can be applied for alongside OOW itself. Ancillary safety courses and ENG1 are still required for the actual Certificate of Competency.",
      approvalRequired: false,
      trigger: { type: "chief_mate_3000_eligible" }
    },

    chief_mate_yachts_unlimited: {
      code: "chief_mate_yachts_unlimited",
      title: "Chief Mate Yachts Unlimited — CoC Prerequisite Met",
      category: "Deck Progression",
      certGroup: "Chief Mate Yachts Unlimited",
      dashboardSection: "certificates",
      sourcePage: "certificates",
      badgeKey: "chief_mate_yachts_unlimited",
      description: "Holding Master Yachts <3000GT meets the Certificate of Competency prerequisite for Chief Mate Yachts Unlimited (MSN 1858 §4.3(a)) — the new pathway letting yacht deck officers progress beyond 3000GT on yacht sea time alone, no Merchant Navy tickets required. Ancillary courses, 9 academic modules at an MCA-approved college, an MCA practical assessment, ENG1 and the oral exam are still required for the actual CoC.",
      approvalRequired: false,
      trigger: { type: "chief_mate_unlimited_direct" }
    },
    master_yachts_unlimited: {
      code: "master_yachts_unlimited",
      title: "Master Yachts Unlimited — Sea Service",
      category: "Deck Progression",
      certGroup: "Master Yachts Unlimited",
      dashboardSection: "seatime",
      sourcePage: "seatime",
      badgeKey: "master_yachts_unlimited",
      description: "Logged 6 months served in the Master capacity, including 3 months actual sea service, on vessels 500GT or over, while holding Master Yachts <3000GT — one of three routes to Master Yachts Unlimited (MSN 1858 Amendment 2, 2026); the other two need a Merchant Navy ticket not tracked here. Counted from your Sea Time entries' capacity-served field, so keep that accurate for entries where you served as Master.",
      approvalRequired: false,
      trigger: { type: "master_unlimited_master3000_route", gatingCertCode: "MASTER Y3000" }
    },

    atlantic_crossing: {
      code: "atlantic_crossing",
      title: "Atlantic Crossing",
      category: "Passage & Navigation",
      dashboardSection: "navigation",
      sourcePage: "navigation",
      badgeKey: "atlantic_crossing",
      description: "Completed an Atlantic crossing.",
      approvalRequired: true,
      trigger: { type: "manual" }
    },
    pacific_crossing: {
      code: "pacific_crossing",
      title: "Pacific Crossing",
      category: "Passage & Navigation",
      dashboardSection: "navigation",
      sourcePage: "navigation",
      badgeKey: "pacific_crossing",
      description: "Completed a Pacific crossing.",
      approvalRequired: true,
      trigger: { type: "manual" }
    },
  };

  function getAchievement(code) {
    return ACHIEVEMENTS[code] || null;
  }

  function getBadge(badgeKey) {
    return BADGES[badgeKey] || null;
  }

  function getAchievementWithBadge(code) {
    const achievement = getAchievement(code);
    if (!achievement) return null;

    const badge = getBadge(achievement.badgeKey);

    return {
      ...achievement,
      badge: badge || null
    };
  }

  function listAchievements() {
    return Object.values(ACHIEVEMENTS);
  }

  function listBadges() {
    return Object.values(BADGES);
  }

  function badgeAssetVersion() {
    return Number(window.SeavConfig?.BADGE_ASSET_VERSION ?? window.SeavConfig?.ASSET_VERSION ?? 1);
  }

  function normalizeBadgePath(imagePath) {
    if (!imagePath) return "";
    return String(imagePath).replace(/\.png(\?.*)?$/i, ".svg$1").split("?")[0];
  }

  function withBadgeCacheBust(imagePath) {
    const base = normalizeBadgePath(imagePath);
    if (!base) return "";
    return `${base}?v=${badgeAssetVersion()}`;
  }

  function resolveBadgeImage(badgeKey, _unlocked = true) {
    const badge = getBadge(badgeKey);
    if (!badge) return withBadgeCacheBust(DEFAULT_IMAGE);
    // Always show the real badge art — locked state is handled in CSS (grayscale/dim).
    return withBadgeCacheBust(badge.image);
  }

  function resolveItemBadgeImage(item) {
    if (!item) return "";

    const unlocked = item.status !== "Declined";

    if (item.badgeKey) {
      return resolveBadgeImage(item.badgeKey, unlocked);
    }

    if (!item.badgeImage) return "";

    const normalized = withBadgeCacheBust(item.badgeImage);

    if (!normalized) return "";

    return unlocked
      ? normalized
      : withBadgeCacheBust(item.badgeLockedImage || item.badgeImage);
  }

  window.SeavBadges = {
    BADGES,
    ACHIEVEMENTS,
    LOCKED_IMAGE,
    DEFAULT_IMAGE,
    getAchievement,
    getBadge,
    getAchievementWithBadge,
    listAchievements,
    listBadges,
    normalizeBadgePath,
    withBadgeCacheBust,
    resolveBadgeImage,
    resolveItemBadgeImage
  };
})();