// /js/achievement-engine.js
(function () {
  "use strict";

  if (!window.SeavAPI || !window.SeavData || !window.SeavBadges || !window.SeavState) {
    console.warn("[SEA-V] Achievement engine dependencies missing.");
    return;
  }

  const { KEYS, createId, totalQualifyingDays } = window.SeavData;
  const { listAchievements, getAchievementWithBadge } = window.SeavBadges;

  function getProfile() {
    return window.SeavState?.profile || {};
  }

  function getSeatimes() {
    return window.SeavState?.seatimes || [];
  }

  function getVessels() {
    return window.SeavState?.vessels || [];
  }

  function getTenders() {
    return window.SeavState?.tenders || [];
  }

  function getAchievements() {
    return window.SeavState?.achievements || [];
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function includesAny(value, terms) {
    const text = normalize(value);
    return terms.some((term) => text.includes(normalize(term)));
  }

  function getTotalSeaDays() {
    return getSeatimes().reduce((sum, item) => sum + totalQualifyingDays(item), 0);
  }

  function getTotalWatchkeepingDays() {
    return getSeatimes().reduce(
      (sum, item) => sum + Number(item.watchkeepingDays || 0),
      0
    );
  }

  function getVesselTypeCount() {
    const types = getVessels()
      .map((v) => normalize(v.type))
      .filter(Boolean);

    return new Set(types).size;
  }

  function parseMeters(value) {
    const match = String(value || "").match(/(\d+(\.\d+)?)/);
    return match ? Number(match[1]) : 0;
  }

  function hasLargeVessel(minMeters) {
    return getVessels().some((v) => {
      return parseMeters(v.length || v.size || v.name || v.desc) >= minMeters;
    });
  }

  function hasVesselType(value) {
    return getVessels().some((v) => {
      return normalize(v.type).includes(normalize(value)) ||
        normalize(v.program).includes(normalize(value)) ||
        normalize(v.desc).includes(normalize(value));
    });
  }

  function isTriggerMet(achievement) {
    const trigger = achievement.trigger || {};

    switch (trigger.type) {
      case "sea_days":
        return getTotalSeaDays() >= Number(trigger.minDays || 0);

      case "watchkeeping_days":
        return getTotalWatchkeepingDays() >= Number(trigger.minDays || 0);

      case "vessel_count":
        return getVessels().length >= Number(trigger.minCount || 0);

      case "vessel_type_count":
        return getVesselTypeCount() >= Number(trigger.minCount || 0);

      case "vessel_size":
        return hasLargeVessel(Number(trigger.minMeters || 0));

      case "vessel_type_match":
        return hasVesselType(trigger.value);

      case "tender_count":
        return getTenders().length >= Number(trigger.minCount || 0);

      case "rank_match":
        return includesAny(getProfile().rank, trigger.values || []);

      case "profile_or_manual":
        return normalize(getProfile()[trigger.field]).includes(normalize(trigger.contains));

      case "manual":
      default:
        return false;
    }
  }

  function hasAchievement(existing, code) {
    return existing.some((item) => item?.code === code);
  }

  function buildAutoAchievement(definition) {
    return {
      id: createId("achievement"),
      code: definition.code,
      title: definition.title,
      category: definition.category,
      dashboardSection: definition.dashboardSection || "",
      badgeKey: definition.badgeKey,
      badgeTier: definition.badge?.tier || "",
      badgeLabel: definition.badge?.label || "",
      badgeImage: definition.badge?.image || "",
      badgeLockedImage: definition.badge?.lockedImage || "",
      vesselId: "",
      vessel: "",
      date: new Date().toISOString().slice(0, 10),
      status: "Approved",
      witnessName: "",
      witnessPosition: "",
      witnessEmail: "",
      witnessCocNumber: "",
      description: definition.description || "Automatically awarded by SEA-V.",
      attachment: null,
      autoAwarded: true
    };
  }

  async function evaluateAutomaticAchievements() {
    const existing = getAchievements();
    const definitions = listAchievements();

    const autoDefinitions = definitions.filter((definition) => {
      return definition && definition.approvalRequired === false;
    });

    const newAchievements = [];

    for (const definition of autoDefinitions) {
      if (hasAchievement(existing, definition.code)) continue;
      if (!isTriggerMet(definition)) continue;

      const fullDefinition = getAchievementWithBadge(definition.code);
      if (!fullDefinition) continue;

      newAchievements.push(buildAutoAchievement(fullDefinition));
    }

    await Promise.all(
      newAchievements.map((achievement) => SeavAPI.upsertItemById(KEYS.ACHIEVEMENTS, achievement))
    );

    return {
      created: newAchievements.length,
      removed: 0,
      newAchievements
    };
  }

  async function runAchievementEvaluation() {
    const result = await evaluateAutomaticAchievements();

    if ((result?.created || 0) > 0) {
      document.dispatchEvent(new CustomEvent("seav:data-updated"));
    }

    if (result?.newAchievements?.length) {
      window.setTimeout(() => {
        window.SeavBadgeUnlock?.celebrate?.(result.newAchievements);
      }, 600);
    }

    return result;
  }

  function getProgressForDefinition(definition) {
    if (!definition) {
      return { current: 0, target: 1, percent: 0, label: "" };
    }

    const trigger = definition.trigger || { type: "manual" };

    switch (trigger.type) {
      case "sea_days": {
        const current = getTotalSeaDays();
        const target = Number(trigger.minDays || 0);
        return {
          current,
          target,
          percent: target ? Math.min(100, Math.round((current / target) * 100)) : 0,
          label: `${current} / ${target} qualifying days`
        };
      }
      case "watchkeeping_days": {
        const current = getTotalWatchkeepingDays();
        const target = Number(trigger.minDays || 0);
        return {
          current,
          target,
          percent: target ? Math.min(100, Math.round((current / target) * 100)) : 0,
          label: `${current} / ${target} watchkeeping days`
        };
      }
      case "vessel_count": {
        const current = getVessels().length;
        const target = Number(trigger.minCount || 0);
        return {
          current,
          target,
          percent: target ? Math.min(100, Math.round((current / target) * 100)) : 0,
          label: `${current} / ${target} vessels logged`
        };
      }
      case "vessel_type_count": {
        const current = getVesselTypeCount();
        const target = Number(trigger.minCount || 0);
        return {
          current,
          target,
          percent: target ? Math.min(100, Math.round((current / target) * 100)) : 0,
          label: `${current} / ${target} vessel types`
        };
      }
      case "vessel_size": {
        const minMeters = Number(trigger.minMeters || 0);
        const current = hasLargeVessel(minMeters) ? minMeters : 0;
        return {
          current,
          target: minMeters,
          percent: hasLargeVessel(minMeters) ? 100 : 0,
          label: hasLargeVessel(minMeters)
            ? `50m+ vessel logged`
            : `Log a ${minMeters}m+ vessel`
        };
      }
      case "vessel_type_match": {
        const matched = hasVesselType(trigger.value);
        return {
          current: matched ? 1 : 0,
          target: 1,
          percent: matched ? 100 : 0,
          label: matched ? "Vessel type matched" : `Log ${trigger.value || "matching"} experience`
        };
      }
      case "tender_count": {
        const current = getTenders().length;
        const target = Number(trigger.minCount || 0);
        return {
          current,
          target,
          percent: target ? Math.min(100, Math.round((current / target) * 100)) : 0,
          label: `${current} / ${target} tenders logged`
        };
      }
      case "rank_match":
      case "profile_or_manual": {
        const met = isTriggerMet(definition);
        return {
          current: met ? 1 : 0,
          target: 1,
          percent: met ? 100 : 0,
          label: met ? "Requirement met" : "Update profile or log manually"
        };
      }
      case "manual":
      default:
        return {
          current: 0,
          target: 1,
          percent: 0,
          label: "Log this milestone on a vessel"
        };
    }
  }

  function getNextMilestone() {
    const earnedCodes = new Set(getAchievements().map((item) => item.code).filter(Boolean));
    const candidates = listAchievements()
      .filter((definition) => definition.approvalRequired === false && !earnedCodes.has(definition.code))
      .map((definition) => ({
        definition,
        progress: getProgressForDefinition(definition)
      }))
      .filter((entry) => entry.progress.percent > 0 && entry.progress.percent < 100)
      .sort((a, b) => b.progress.percent - a.progress.percent);

    return candidates[0] || null;
  }

  window.SeavAchievementEngine = {
    evaluateAutomaticAchievements,
    runAchievementEvaluation,
    getProgressForDefinition,
    getNextMilestone
  };

  const ACHIEVEMENT_EVAL_PAGES = new Set([
    "dashboard.html",
    "achievements.html",
    "vessels.html",
    "seatime.html",
    "tenders.html",
    "profile.html"
  ]);

  function shouldRunAchievementEval() {
    const page = (location.pathname.split("/").pop() || "index.html")
      .split("?")[0]
      .split("#")[0]
      .toLowerCase();
    return ACHIEVEMENT_EVAL_PAGES.has(page);
  }

  let achievementEvalStarted = false;

  document.addEventListener("seav:state-ready", () => {
    if (!shouldRunAchievementEval()) return;
    if (achievementEvalStarted) return;
    achievementEvalStarted = true;
    runAchievementEvaluation();
  });
})();