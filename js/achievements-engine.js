// /js/achievement-engine.js
(function () {
  "use strict";

  if (!window.SeavAPI || !window.SeavData || !window.SeavBadges || !window.SeavState) {
    console.warn("[SEA-V] Achievement engine dependencies missing.");
    return;
  }

  const {
    KEYS,
    createId,
    totalQualifyingDays,
    computeOowSeaService,
    isOowSeaTimeComplete: sharedIsOowSeaTimeComplete,
    computeYachtmasterOffshoreMiles,
    computeMaster200SeaService,
    seatimesGatedByCertIssueDate
  } = window.SeavData;
  const { listAchievements, getAchievementWithBadge } = window.SeavBadges;

  function getSeatimes() {
    return window.SeavState?.seatimes || [];
  }

  function getVessels() {
    return window.SeavState?.vessels || [];
  }

  // Only loaded on pages listed in js/state.js's PAGE_LOAD_KEYS (dashboard,
  // cv-generator, and achievements itself) — used for cert-date-gated
  // triggers (Master <200GT/<500GT), same lazy-load caveat as vessels.
  function getCerts() {
    return window.SeavState?.certs || [];
  }

  // Only loaded on pages listed in js/state.js's PAGE_LOAD_KEYS (dashboard,
  // cv-generator, navigation, and achievements itself) — same lazy-load
  // caveat as vessels, see PERMANENT_ONCE_EARNED_TRIGGERS below.
  function getNavigationEntries() {
    return window.SeavState?.navigationAreas || [];
  }

  function getAchievements() {
    return window.SeavState?.achievements || [];
  }

  function getTotalSeaDays() {
    return getSeatimes().reduce((sum, item) => sum + totalQualifyingDays(item), 0);
  }

  function parseMeters(value) {
    const match = String(value || "").match(/(\d+(\.\d+)?)/);
    return match ? Number(match[1]) : 0;
  }

  // --- Deck Progression / Career Path Milestones (MSN 1858 OOW Yachts <3000GT) helpers ---
  //
  // The actual pass/fail math now lives in js/seav-data.js's
  // computeOowSeaService()/isOowSeaTimeComplete() — shared with the Sea Time
  // page tracker (js/seatime.js) so the two surfaces can never disagree.
  // Standby is capped by BOTH "14 consecutive days at one time" AND "never
  // exceeds that voyage's own actual sea days" (MSN 1858 SS4.2); yard is
  // capped at 90 days as a running total across every qualifying entry, not
  // per entry. MSN 1858's 15m vessel-length threshold is fixed inside the
  // shared function (the regulation's own threshold, not a tunable), so the
  // minVesselMeters trigger param below is accepted for API compatibility
  // but not separately re-applied here.
  function getSeatimeVesselLengthMeters(entry) {
    const vessel = getVesselById(entry?.vesselId);
    return parseMeters(vessel?.vessel_length || vessel?.length || entry?.vesselLength);
  }

  function seatimesOnVesselsAtLeast(minMeters) {
    return getSeatimes().filter((entry) => getSeatimeVesselLengthMeters(entry) >= minMeters);
  }

  function getActualSeaDaysOnVessels() {
    return computeOowSeaService(getSeatimes(), getVessels()).totalActual15m;
  }

  // Per-entry estimate used only to pick a representative vessel/date for
  // display (resolveVesselContext) — the true pass/fail number comes from
  // getOowQualifyingDaysOnVessels() below, which applies the yard cap
  // globally rather than per entry. Mirrors the shared function's per-entry
  // standby cap (min of actual days, 14, and the logged standby value).
  function oowQualifyingDaysForEntry(entry) {
    const actual = Number(entry.actualSeaServiceDays || 0);
    const standbyCapped = Math.min(Number(entry.standbyServiceDays || 0), actual, 14);
    const yardCapped = Math.min(Number(entry.yardServiceDays || 0), 90);
    return { actual, other: Math.min(standbyCapped + yardCapped, 115) };
  }

  function getOowQualifyingDaysOnVessels() {
    return computeOowSeaService(getSeatimes(), getVessels()).totalQualifying15m;
  }

  function isOowSeaTimeComplete() {
    return sharedIsOowSeaTimeComplete(getSeatimes(), getVessels());
  }

  function seatimeEntryForFilteredThreshold(entries, targetDays, valueFn) {
    if (!entries.length) return null;
    let cumulative = 0;
    for (const entry of entries) {
      cumulative += valueFn(entry);
      if (cumulative >= targetDays) return entry;
    }
    return entries.reduce(
      (best, entry) => (valueFn(entry) > valueFn(best) ? entry : best),
      entries[0]
    );
  }

  function vesselContextFromRecord(vessel) {
    if (!vessel) {
      return { vesselId: "", vessel: "" };
    }
    return {
      vesselId: vessel.id || "",
      vessel: vessel.name || "Unnamed vessel"
    };
  }

  function getVesselById(vesselId) {
    if (!vesselId) return null;
    return getVessels().find((v) => v.id === vesselId) || null;
  }

  function vesselContextFromSeatimeEntry(entry) {
    if (!entry?.vesselId) {
      return { vesselId: "", vessel: "" };
    }
    const vessel = getVesselById(entry.vesselId);
    if (vessel) return vesselContextFromRecord(vessel);
    return {
      vesselId: entry.vesselId,
      vessel: entry.vesselName || entry.vessel || "Linked vessel"
    };
  }

  function sortSeatimesChronologically(entries) {
    return [...entries].sort((a, b) => {
      const da = a.dateJoined || a.from || a.createdAt || "";
      const db = b.dateJoined || b.from || b.createdAt || "";
      return String(da).localeCompare(String(db));
    });
  }

  function seatimesWithSeaDays() {
    return sortSeatimesChronologically(
      getSeatimes().filter((item) => totalQualifyingDays(item) > 0)
    );
  }

  function seatimeEntryForSeaDayThreshold(entries, targetDays) {
    if (!entries.length) return null;

    let cumulative = 0;
    for (const entry of entries) {
      cumulative += totalQualifyingDays(entry);
      if (cumulative >= targetDays) return entry;
    }

    return entries.reduce((best, entry) => {
      return totalQualifyingDays(entry) > totalQualifyingDays(best) ? entry : best;
    }, entries[0]);
  }

  function resolveVesselContext(definition) {
    const trigger = definition.trigger || {};

    switch (trigger.type) {
      case "sea_days": {
        const entries = seatimesWithSeaDays();
        const target = Number(trigger.minDays || 0);
        return vesselContextFromSeatimeEntry(
          seatimeEntryForSeaDayThreshold(entries, target)
        );
      }
      case "oow_actual_sea_days": {
        const entries = sortSeatimesChronologically(
          seatimesOnVesselsAtLeast(Number(trigger.minVesselMeters || 0))
        );
        return vesselContextFromSeatimeEntry(
          seatimeEntryForFilteredThreshold(
            entries,
            Number(trigger.minDays || 0),
            (entry) => Number(entry.actualSeaServiceDays || 0)
          )
        );
      }
      case "oow_qualifying_days": {
        const entries = sortSeatimesChronologically(
          seatimesOnVesselsAtLeast(Number(trigger.minVesselMeters || 0))
        );
        return vesselContextFromSeatimeEntry(
          seatimeEntryForFilteredThreshold(
            entries,
            Number(trigger.minDays || 0),
            (entry) => {
              const parts = oowQualifyingDaysForEntry(entry);
              return parts.actual + parts.other;
            }
          )
        );
      }
      case "oow_eligible": {
        const entries = seatimesWithSeaDays();
        return vesselContextFromSeatimeEntry(entries[entries.length - 1] || null);
      }
      case "yachtmaster_offshore_miles": {
        // Cosmetic attribution only (like oow_eligible above) — the pass/fail
        // is a career-wide mileage total, not tied to one passage, so this
        // just picks the most recent logged passage's vessel to show.
        const entries = [...getNavigationEntries()].sort((a, b) =>
          String(a.departureDate || a.visitedDate || "").localeCompare(
            String(b.departureDate || b.visitedDate || "")
          )
        );
        const last = entries[entries.length - 1] || null;
        if (!last?.vesselId) return { vesselId: "", vessel: "" };
        return vesselContextFromRecord(getVesselById(last.vesselId));
      }
      case "master_200gt_gated_sea_service": {
        const gated = seatimesGatedByCertIssueDate(getSeatimes(), getCerts(), trigger.gatingCertCode);
        if (!gated.held) return { vesselId: "", vessel: "" };
        const entries = sortSeatimesChronologically(gated.gatedEntries);
        return vesselContextFromSeatimeEntry(entries[entries.length - 1] || null);
      }
      default:
        return { vesselId: "", vessel: "" };
    }
  }

  function isTriggerMet(achievement) {
    const trigger = achievement.trigger || {};

    switch (trigger.type) {
      case "sea_days":
        return getTotalSeaDays() >= Number(trigger.minDays || 0);

      case "oow_actual_sea_days":
        return getActualSeaDaysOnVessels() >= Number(trigger.minDays || 0);

      case "oow_qualifying_days":
        return getOowQualifyingDaysOnVessels() >= Number(trigger.minDays || 0);

      case "oow_eligible":
        return isOowSeaTimeComplete();

      case "yachtmaster_offshore_miles":
        return computeYachtmasterOffshoreMiles(getNavigationEntries()).allMet;

      case "master_200gt_gated_sea_service":
        return computeMaster200SeaService(getSeatimes(), getCerts()).met;

      case "manual":
      default:
        return false;
    }
  }

  function hasAchievement(existing, code) {
    return existing.some((item) => item?.code === code);
  }

  function autoRecordScore(record) {
    let score = 0;
    if (record?.vesselId) score += 4;
    if (record?.vessel) score += 2;
    if (record?.date) score += 1;
    return score;
  }

  function buildAutoAchievement(definition) {
    const ctx = resolveVesselContext(definition);
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
      vesselId: ctx.vesselId,
      vessel: ctx.vessel,
      date: new Date().toISOString().slice(0, 10),
      status: "Verified",
      witnessName: "",
      witnessPosition: "",
      witnessEmail: "",
      witnessCocNumber: "",
      description: definition.description || "Automatically awarded by SEA-V.",
      attachment: null,
      autoAwarded: true
    };
  }

  // Vessels can legitimately be [] for a moment on page load — window.SeavState
  // lazy-loads most collections per page (see js/state.js's PAGE_LOAD_KEYS)
  // and only backfills vessels in the background on pages that don't need it
  // for their own UI (certificates.html, hobbies-interests.html, payslips.html,
  // etc). Without this, an OOW badge earned on the Sea Time page could get
  // silently revoked the next time achievement evaluation runs on an
  // unrelated page, purely because that page hadn't fetched vessels yet — not
  // because the sea-time requirement was actually un-met. Once earned, these
  // stay earned (matches how Strava/Garmin trophies behave — they don't get
  // taken back).
  const PERMANENT_ONCE_EARNED_TRIGGERS = new Set([
    "oow_actual_sea_days",
    "oow_qualifying_days",
    "oow_eligible",
    "yachtmaster_offshore_miles",
    "master_200gt_gated_sea_service"
  ]);

  async function evaluateAutomaticAchievements() {
    const existing = getAchievements();
    const definitions = listAchievements();

    const autoDefinitions = definitions.filter((definition) => {
      return definition && definition.approvalRequired === false;
    });

    const newAchievements = [];
    const removeIds = [];
    const refreshAchievements = [];

    for (const definition of autoDefinitions) {
      const met = isTriggerMet(definition);
      const autoRecords = existing.filter(
        (item) => item.code === definition.code && item.autoAwarded
      );

      if (met) {
        if (!hasAchievement(existing, definition.code)) {
          const fullDefinition = getAchievementWithBadge(definition.code);
          if (fullDefinition) {
            newAchievements.push(buildAutoAchievement(fullDefinition));
          }
        } else {
          const ctx = resolveVesselContext(definition);

          autoRecords.forEach((record) => {
            if (record.vesselId && record.vessel) return;
            if (!ctx.vesselId && !ctx.vessel) return;
            refreshAchievements.push({
              ...record,
              vesselId: ctx.vesselId,
              vessel: ctx.vessel
            });
          });

          if (autoRecords.length > 1) {
            const ranked = [...autoRecords].sort(
              (a, b) => autoRecordScore(b) - autoRecordScore(a)
            );
            ranked.slice(1).forEach((record) => {
              if (record.id && !removeIds.includes(record.id)) {
                removeIds.push(record.id);
              }
            });
          }
        }
      } else if (!PERMANENT_ONCE_EARNED_TRIGGERS.has(definition.trigger?.type)) {
        autoRecords.forEach((record) => {
          if (record.id) removeIds.push(record.id);
        });
      }
    }

    await Promise.all(
      removeIds.map((id) => SeavAPI.deleteItemById(KEYS.ACHIEVEMENTS, id))
    );

    await Promise.all(
      refreshAchievements.map((achievement) => SeavAPI.upsertItemById(KEYS.ACHIEVEMENTS, achievement))
    );

    await Promise.all(
      newAchievements.map((achievement) => SeavAPI.upsertItemById(KEYS.ACHIEVEMENTS, achievement))
    );

    return {
      created: newAchievements.length,
      removed: removeIds.length,
      refreshed: refreshAchievements.length,
      newAchievements
    };
  }

  async function runAchievementEvaluation() {
    const result = await evaluateAutomaticAchievements();

    if ((result?.created || 0) > 0 || (result?.removed || 0) > 0 || (result?.refreshed || 0) > 0) {
      suppressEvalOnUpdate = true;
      document.dispatchEvent(new CustomEvent("seav:data-updated"));
      window.setTimeout(() => {
        suppressEvalOnUpdate = false;
      }, 800);
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
      case "oow_actual_sea_days": {
        const target = Number(trigger.minDays || 0);
        const current = getActualSeaDaysOnVessels();
        return {
          current,
          target,
          percent: target ? Math.min(100, Math.round((current / target) * 100)) : 0,
          label: `${current} / ${target} actual sea days (${trigger.minVesselMeters}m+)`
        };
      }
      case "oow_qualifying_days": {
        const target = Number(trigger.minDays || 0);
        const current = getOowQualifyingDaysOnVessels();
        return {
          current,
          target,
          percent: target ? Math.min(100, Math.round((current / target) * 100)) : 0,
          label: `${current} / ${target} qualifying days (${trigger.minVesselMeters}m+)`
        };
      }
      case "oow_eligible": {
        const met = isOowSeaTimeComplete();
        return {
          current: met ? 1 : 0,
          target: 1,
          percent: met ? 100 : 0,
          label: met ? "OOW <3000GT sea-time requirements met" : "Complete the OOW sea-time milestones above"
        };
      }
      case "yachtmaster_offshore_miles": {
        // Two independent thresholds (total nm AND tidal nm) — the bar
        // reflects whichever one is further behind, same "weakest link"
        // approach as computeMasterSeaService's 12mo/6mo special path, so
        // the bar never shows 100% until both are actually met.
        const result = computeYachtmasterOffshoreMiles(getNavigationEntries());
        const totalPct = result.TARGET_NM
          ? Math.min(100, Math.round((result.totalNm / result.TARGET_NM) * 100))
          : 0;
        const tidalPct = result.TIDAL_TARGET_NM
          ? Math.min(100, Math.round((result.tidalNm / result.TIDAL_TARGET_NM) * 100))
          : 0;
        return {
          current: Math.round(result.totalNm),
          target: result.TARGET_NM,
          percent: Math.min(totalPct, tidalPct),
          label: `${Math.round(result.totalNm)} / ${result.TARGET_NM} NM (${Math.round(result.tidalNm)} / ${result.TIDAL_TARGET_NM} NM tidal)`
        };
      }
      case "master_200gt_gated_sea_service": {
        const result = computeMaster200SeaService(getSeatimes(), getCerts());
        if (!result.held) {
          return {
            current: 0,
            target: result.TARGET_MONTHS,
            percent: 0,
            label: "Hold RYA Yachtmaster Offshore first"
          };
        }
        const monthsRounded = Math.round(result.months * 10) / 10;
        return {
          current: monthsRounded,
          target: result.TARGET_MONTHS,
          percent: result.TARGET_MONTHS
            ? Math.min(100, Math.round((result.months / result.TARGET_MONTHS) * 100))
            : 0,
          label: `${monthsRounded} / ${result.TARGET_MONTHS} months' seagoing service (since holding Yachtmaster Offshore)`
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
    "profile.html",
    "navigation.html",
    "certificates.html",
    "hobbies-interests.html",
    "onboard-experience.html",
    "references.html",
    "specialist-qualifications.html",
    "payslips.html",
    "cv-generator.html"
  ]);

  function shouldRunAchievementEval() {
    if (!document.body.classList.contains("app-page")) return false;
    const page = (location.pathname.split("/").pop() || "index.html")
      .split("?")[0]
      .split("#")[0]
      .toLowerCase();
    return ACHIEVEMENT_EVAL_PAGES.has(page);
  }

  let evalTimer = null;
  let evalRunning = false;
  let suppressEvalOnUpdate = false;

  async function scheduleAchievementEvaluation() {
    if (!shouldRunAchievementEval()) return;

    clearTimeout(evalTimer);
    evalTimer = window.setTimeout(async () => {
      if (evalRunning) return;
      evalRunning = true;
      try {
        await runAchievementEvaluation();
      } catch (err) {
        console.warn("[SEA-V] Achievement evaluation failed:", err);
      } finally {
        evalRunning = false;
      }
    }, 450);
  }

  document.addEventListener("seav:state-ready", () => {
    scheduleAchievementEvaluation();
  });

  document.addEventListener("seav:data-updated", () => {
    if (suppressEvalOnUpdate) return;
    scheduleAchievementEvaluation();
  });
})();