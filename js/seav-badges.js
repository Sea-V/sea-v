// /js/seav-badges.js
(function () {
  "use strict";

  const LOCKED_IMAGE = "img/badges/locked.svg";
  const DEFAULT_IMAGE = "img/badges/default.svg";

  const BADGES = {
sea_30_days: {
  key: "sea_30_days",
  label: "30 Days at Sea",
  fileName: "sea-30-days.svg",
  image: "img/badges/sea-30-days.svg",
  lockedImage: "img/badges/locked.svg",
  tier: "default"
},

sea_100_days: {
  key: "sea_100_days",
  label: "100 Days at Sea",
  fileName: "sea-100-days.svg",
  image: "img/badges/sea-100-days.svg",
  lockedImage: "img/badges/locked.svg",
  tier: "default"
},

sea_250_days: {
  key: "sea_250_days",
  label: "250 Days at Sea",
  fileName: "sea-250-days.svg",
  image: "img/badges/sea-250-days.svg",
  lockedImage: "img/badges/locked.svg",
  tier: "silver"
},

sea_500_days: {
  key: "sea_500_days",
  label: "500 Days at Sea",
  fileName: "sea-500-days.svg",
  image: "img/badges/sea-500-days.svg",
  lockedImage: "img/badges/locked.svg",
  tier: "gold"
},
sea_1_year: {
  key: "sea_1_year",
  label: "1 Year at Sea",
  fileName: "sea-1-year.svg",
  image: "img/badges/sea-1-year.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "gold"
},
sea_3_years: {
  key: "sea_3_years",
  label: "3 Years at Sea",
  fileName: "sea-3-years.svg",
  image: "img/badges/sea-3-years.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "platinum"
},

first_vessel_logged: {
  key: "first_vessel_logged",
  label: "First Vessel Logged",
  fileName: "first-vessel-logged.svg",
  image: "img/badges/first-vessel-logged.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "bronze"
},
vessels_3_served: {
  key: "vessels_3_served",
  label: "3 Vessels Served",
  fileName: "vessels-3-served.svg",
  image: "img/badges/vessels-3-served.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "silver"
},
vessel_types_5: {
  key: "vessel_types_5",
  label: "5 Vessel Types Experienced",
  fileName: "vessel-types-5.svg",
  image: "img/badges/vessel-types-5.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "gold"
},
large_yacht_50m: {
  key: "large_yacht_50m",
  label: "Large Yacht Experience",
  fileName: "large-yacht-50m.svg",
  image: "img/badges/large-yacht-50m.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "silver"
},
explorer_vessel: {
  key: "explorer_vessel",
  label: "Explorer Vessel Experience",
  fileName: "explorer-vessel.svg",
  image: "img/badges/explorer-vessel.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "silver"
},
commercial_vessel: {
  key: "commercial_vessel",
  label: "Commercial Vessel Experience",
  fileName: "commercial-vessel.svg",
  image: "img/badges/commercial-vessel.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "silver"
},

offshore_100nm: {
  key: "offshore_100nm",
  label: "First Offshore Passage",
  fileName: "offshore-100nm.svg",
  image: "img/badges/offshore-100nm.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "bronze"
},
passage_500nm: {
  key: "passage_500nm",
  label: "500nm Passage",
  fileName: "passage-500nm.svg",
  image: "img/badges/passage-500nm.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "silver"
},
passage_1000nm: {
  key: "passage_1000nm",
  label: "1000nm Passage",
  fileName: "passage-1000nm.svg",
  image: "img/badges/passage-1000nm.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "gold"
},
atlantic_crossing: {
  key: "atlantic_crossing",
  label: "Atlantic Crossing",
  fileName: "atlantic-crossing.svg",
  image: "img/badges/atlantic-crossing.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "gold"
},
pacific_crossing: {
  key: "pacific_crossing",
  label: "Pacific Crossing",
  fileName: "pacific-crossing.svg",
  image: "img/badges/pacific-crossing.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "platinum"
},
polar_navigation: {
  key: "polar_navigation",
  label: "Arctic / Polar Navigation",
  fileName: "polar-navigation.svg",
  image: "img/badges/polar-navigation.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "platinum"
},

first_watchkeeping: {
  key: "first_watchkeeping",
  label: "First Watchkeeping Logged",
  fileName: "first-watchkeeping.svg",
  image: "img/badges/first-watchkeeping.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "bronze"
},
watchkeeping_100_days: {
  key: "watchkeeping_100_days",
  label: "100 Watchkeeping Days",
  fileName: "watchkeeping-100-days.svg",
  image: "img/badges/watchkeeping-100-days.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "gold"
},
oow_level: {
  key: "oow_level",
  label: "Officer of the Watch",
  fileName: "oow-level.svg",
  image: "img/badges/oow-level.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "gold"
},
bridge_leader: {
  key: "bridge_leader",
  label: "Bridge Leader",
  fileName: "bridge-leader.svg",
  image: "img/badges/bridge-leader.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "platinum"
},

first_promotion: {
  key: "first_promotion",
  label: "First Promotion",
  fileName: "first-promotion.svg",
  image: "img/badges/first-promotion.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "silver"
},
senior_crew: {
  key: "senior_crew",
  label: "Senior Crew",
  fileName: "senior-crew.svg",
  image: "img/badges/senior-crew.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "gold"
},
officer_rank: {
  key: "officer_rank",
  label: "Officer Rank Achieved",
  fileName: "officer-rank.svg",
  image: "img/badges/officer-rank.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "gold"
},
command_experience: {
  key: "command_experience",
  label: "Command Experience",
  fileName: "command-experience.svg",
  image: "img/badges/command-experience.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "platinum"
},

tender_ops: {
  key: "tender_ops",
  label: "Tender Operations Specialist",
  fileName: "tender-operations.svg",
  image: "img/badges/tender-operations.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "silver"
},
watersports_ops: {
  key: "watersports_ops",
  label: "Watersports Operations",
  fileName: "watersports-operations.svg",
  image: "img/badges/watersports-operations.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "silver"
},
crane_ops: {
  key: "crane_ops",
  label: "Crane / Heavy Lift Ops",
  fileName: "crane-operations.svg",
  image: "img/badges/crane-operations.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "gold"
},
helicopter_ops: {
  key: "helicopter_ops",
  label: "Helicopter Operations",
  fileName: "helicopter-operations.svg",
  image: "img/badges/helicopter-operations.svg",
  lockedImage: LOCKED_IMAGE,
  tier: "platinum"
}
};

  const ACHIEVEMENTS = {
    sea_30_days: {
      code: "sea_30_days",
      title: "First 30 Days at Sea",
      category: "Sea Time",
      dashboardSection: "seatime",
      badgeKey: "sea_30_days",
      description: "Logged your first 30 qualifying days at sea.",
      approvalRequired: false,
      trigger: { type: "sea_days", minDays: 30 }
    },
    sea_100_days: {
      code: "sea_100_days",
      title: "100 Days at Sea",
      category: "Sea Time",
      dashboardSection: "seatime",
      badgeKey: "sea_100_days",
      description: "Logged 100 qualifying days at sea.",
      approvalRequired: false,
      trigger: { type: "sea_days", minDays: 100 }
    },
    sea_250_days: {
      code: "sea_250_days",
      title: "250 Days at Sea",
      category: "Sea Time",
      dashboardSection: "seatime",
      badgeKey: "sea_250_days",
      description: "Logged 250 qualifying days at sea.",
      approvalRequired: false,
      trigger: { type: "sea_days", minDays: 250 }
    },
    sea_500_days: {
      code: "sea_500_days",
      title: "500 Days at Sea",
      category: "Sea Time",
      dashboardSection: "seatime",
      badgeKey: "sea_500_days",
      description: "Logged 500 qualifying days at sea.",
      approvalRequired: false,
      trigger: { type: "sea_days", minDays: 500 }
    },
    sea_1_year: {
      code: "sea_1_year",
      title: "1 Year at Sea",
      category: "Sea Time",
      dashboardSection: "seatime",
      badgeKey: "sea_1_year",
      description: "Logged 365 qualifying days at sea.",
      approvalRequired: false,
      trigger: { type: "sea_days", minDays: 365 }
    },
    sea_3_years: {
      code: "sea_3_years",
      title: "3 Years at Sea",
      category: "Sea Time",
      dashboardSection: "seatime",
      badgeKey: "sea_3_years",
      description: "Logged 1095 qualifying days at sea.",
      approvalRequired: false,
      trigger: { type: "sea_days", minDays: 1095 }
    },

    first_vessel_logged: {
      code: "first_vessel_logged",
      title: "First Vessel Logged",
      category: "Vessel Experience",
      dashboardSection: "vessels",
      badgeKey: "first_vessel_logged",
      description: "Added your first vessel to your SEA-V profile.",
      approvalRequired: false,
      trigger: { type: "vessel_count", minCount: 1 }
    },
    vessels_3_served: {
      code: "vessels_3_served",
      title: "3 Vessels Served",
      category: "Vessel Experience",
      dashboardSection: "vessels",
      badgeKey: "vessels_3_served",
      description: "Logged experience across 3 vessels.",
      approvalRequired: false,
      trigger: { type: "vessel_count", minCount: 3 }
    },
    vessel_types_5: {
      code: "vessel_types_5",
      title: "5 Vessel Types Experienced",
      category: "Vessel Experience",
      dashboardSection: "vessels",
      badgeKey: "vessel_types_5",
      description: "Logged experience across 5 different vessel types.",
      approvalRequired: false,
      trigger: { type: "vessel_type_count", minCount: 5 }
    },
    large_yacht_50m: {
      code: "large_yacht_50m",
      title: "Large Yacht Experience",
      category: "Vessel Experience",
      dashboardSection: "vessels",
      badgeKey: "large_yacht_50m",
      description: "Logged experience on a vessel of 50 metres or larger.",
      approvalRequired: false,
      trigger: { type: "vessel_size", minMeters: 50 }
    },
    explorer_vessel: {
      code: "explorer_vessel",
      title: "Explorer Vessel Experience",
      category: "Vessel Experience",
      dashboardSection: "vessels",
      badgeKey: "explorer_vessel",
      description: "Logged experience on an explorer vessel.",
      approvalRequired: false,
      trigger: { type: "vessel_type_match", value: "explorer" }
    },
    commercial_vessel: {
      code: "commercial_vessel",
      title: "Commercial Vessel Experience",
      category: "Vessel Experience",
      dashboardSection: "vessels",
      badgeKey: "commercial_vessel",
      description: "Logged experience on a commercial vessel.",
      approvalRequired: false,
      trigger: { type: "vessel_type_match", value: "commercial" }
    },

    offshore_100nm: {
      code: "offshore_100nm",
      title: "First Offshore Passage",
      category: "Passage & Navigation",
      dashboardSection: "vessels",
      badgeKey: "offshore_100nm",
      description: "Completed an offshore passage of 100nm or more.",
      approvalRequired: true,
      trigger: { type: "manual" }
    },
    passage_500nm: {
      code: "passage_500nm",
      title: "500nm Passage",
      category: "Passage & Navigation",
      dashboardSection: "vessels",
      badgeKey: "passage_500nm",
      description: "Completed a passage of 500nm or more.",
      approvalRequired: true,
      trigger: { type: "manual" }
    },
    passage_1000nm: {
      code: "passage_1000nm",
      title: "1000nm Passage",
      category: "Passage & Navigation",
      dashboardSection: "vessels",
      badgeKey: "passage_1000nm",
      description: "Completed a passage of 1000nm or more.",
      approvalRequired: true,
      trigger: { type: "manual" }
    },
    atlantic_crossing: {
      code: "atlantic_crossing",
      title: "Atlantic Crossing",
      category: "Passage & Navigation",
      dashboardSection: "vessels",
      badgeKey: "atlantic_crossing",
      description: "Completed an Atlantic crossing.",
      approvalRequired: true,
      trigger: { type: "manual" }
    },
    pacific_crossing: {
      code: "pacific_crossing",
      title: "Pacific Crossing",
      category: "Passage & Navigation",
      dashboardSection: "vessels",
      badgeKey: "pacific_crossing",
      description: "Completed a Pacific crossing.",
      approvalRequired: true,
      trigger: { type: "manual" }
    },
    polar_navigation: {
      code: "polar_navigation",
      title: "Arctic / Polar Navigation",
      category: "Passage & Navigation",
      dashboardSection: "vessels",
      badgeKey: "polar_navigation",
      description: "Completed navigation or operations in polar waters.",
      approvalRequired: true,
      trigger: { type: "manual" }
    },

    first_watchkeeping: {
      code: "first_watchkeeping",
      title: "First Watchkeeping Logged",
      category: "Navigation & Watchkeeping",
      dashboardSection: "seatime",
      badgeKey: "first_watchkeeping",
      description: "Logged your first watchkeeping day.",
      approvalRequired: false,
      trigger: { type: "watchkeeping_days", minDays: 1 }
    },
    watchkeeping_100_days: {
      code: "watchkeeping_100_days",
      title: "100 Watchkeeping Days",
      category: "Navigation & Watchkeeping",
      dashboardSection: "seatime",
      badgeKey: "watchkeeping_100_days",
      description: "Logged 100 watchkeeping days.",
      approvalRequired: false,
      trigger: { type: "watchkeeping_days", minDays: 100 }
    },
    oow_level: {
      code: "oow_level",
      title: "Officer of the Watch",
      category: "Navigation & Watchkeeping",
      dashboardSection: "seatime",
      badgeKey: "oow_level",
      description: "Reached Officer of the Watch level or equivalent.",
      approvalRequired: true,
      trigger: {
        type: "profile_or_manual",
        field: "qualification",
        contains: "OOW"
      }
    },
    bridge_leader: {
      code: "bridge_leader",
      title: "Bridge Leader",
      category: "Navigation & Watchkeeping",
      dashboardSection: "profile",
      badgeKey: "bridge_leader",
      description: "Demonstrated bridge leadership or supervised navigation duties.",
      approvalRequired: true,
      trigger: { type: "manual" }
    },

    first_promotion: {
      code: "first_promotion",
      title: "First Promotion",
      category: "Career Progression",
      dashboardSection: "profile",
      badgeKey: "first_promotion",
      description: "Recorded your first promotion.",
      approvalRequired: true,
      trigger: { type: "manual" }
    },
    senior_crew: {
      code: "senior_crew",
      title: "Senior Crew",
      category: "Career Progression",
      dashboardSection: "profile",
      badgeKey: "senior_crew",
      description: "Reached a senior crew role.",
      approvalRequired: false,
      trigger: {
        type: "rank_match",
        values: ["bosun", "lead deckhand", "chief stew", "chief engineer"]
      }
    },
    officer_rank: {
      code: "officer_rank",
      title: "Officer Rank Achieved",
      category: "Career Progression",
      dashboardSection: "profile",
      badgeKey: "officer_rank",
      description: "Reached officer rank or equivalent.",
      approvalRequired: false,
      trigger: {
        type: "rank_match",
        values: ["officer", "chief officer", "second officer", "third officer", "oow"]
      }
    },
    command_experience: {
      code: "command_experience",
      title: "Command Experience",
      category: "Career Progression",
      dashboardSection: "profile",
      badgeKey: "command_experience",
      description: "Recorded command or acting command experience.",
      approvalRequired: true,
      trigger: {
        type: "rank_match",
        values: ["captain", "master", "relief captain", "acting captain"]
      }
    },

    tender_ops: {
      code: "tender_ops",
      title: "Tender Operations Specialist",
      category: "Operations & Special Skills",
      dashboardSection: "operations",
      badgeKey: "tender_ops",
      description: "Added tender operations experience.",
      approvalRequired: false,
      trigger: { type: "tender_count", minCount: 1 }
    },
    watersports_ops: {
      code: "watersports_ops",
      title: "Watersports Operations",
      category: "Operations & Special Skills",
      dashboardSection: "operations",
      badgeKey: "watersports_ops",
      description: "Recorded watersports operations experience.",
      approvalRequired: true,
      trigger: { type: "manual" }
    },
    crane_ops: {
      code: "crane_ops",
      title: "Crane / Heavy Lift Ops",
      category: "Operations & Special Skills",
      dashboardSection: "operations",
      badgeKey: "crane_ops",
      description: "Recorded crane or heavy lift operations experience.",
      approvalRequired: true,
      trigger: { type: "manual" }
    },
    helicopter_ops: {
      code: "helicopter_ops",
      title: "Helicopter Operations",
      category: "Operations & Special Skills",
      dashboardSection: "operations",
      badgeKey: "helicopter_ops",
      description: "Recorded helicopter operations or HLO experience.",
      approvalRequired: true,
      trigger: { type: "manual" }
    }
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

  function resolveBadgeImage(badgeKey, unlocked = true) {
    const badge = getBadge(badgeKey);
    if (!badge) return withBadgeCacheBust(DEFAULT_IMAGE);
    const path = unlocked ? badge.image : (badge.lockedImage || badge.image);
    return withBadgeCacheBust(path);
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