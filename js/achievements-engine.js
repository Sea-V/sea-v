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
    computeMaster500SeaService,
    computeMaster3000SeaService,
    computeChiefMate3000Eligibility,
    computeChiefMateUnlimitedEligibility,
    computeMasterUnlimitedSeaService,
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
      case "master_200gt_gated_sea_service":
      case "master_500gt_gated_sea_service":
      case "master_3000gt_gated_sea_service":
      case "master_unlimited_master3000_route": {
        const gated = seatimesGatedByCertIssueDate(getSeatimes(), getCerts(), trigger.gatingCertCode);
        if (!gated.held) return { vesselId: "", vessel: "" };
        const entries = sortSeatimesChronologically(gated.gatedEntries);
        return vesselContextFromSeatimeEntry(entries[entries.length - 1] || null);
      }
      case "chief_mate_unlimited_direct":
      case "chief_mate_3000_eligible": {
        // Cosmetic attribution only (like oow_eligible above) — eligibility
        // is "do you hold the cert," not tied to any one Sea Time entry.
        const entries = seatimesWithSeaDays();
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

      case "master_500gt_gated_sea_service":
        return computeMaster500SeaService(getSeatimes(), getCerts(), getVessels()).met;

      case "master_3000gt_gated_sea_service":
        return computeMaster3000SeaService(getSeatimes(), getCerts(), getVessels()).allMasterMet;

      case "chief_mate_unlimited_direct":
        return computeChiefMateUnlimitedEligibility(getCerts()).met;

      case "chief_mate_3000_eligible":
        return computeChiefMate3000Eligibility(getSeatimes(), getVessels(), getCerts()).met;

      case "master_unlimited_master3000_route":
        return computeMasterUnlimitedSeaService(getSeatimes(), getCerts(), getVessels()).met;

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
    "master_200gt_gated_sea_service",
    "master_500gt_gated_sea_service",
    "master_3000gt_gated_sea_service",
    "chief_mate_unlimited_direct",
    "chief_mate_3000_eligible",
    "master_unlimited_master3000_route"
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
      case "master_500gt_gated_sea_service": {
        // Two-threshold "weakest link" bar (onboard months AND watchkeeping
        // days) — same approach as yachtmaster_offshore_miles, so the bar
        // never shows 100% until both are actually met. Watchkeeping days
        // are deliberately NOT date-gated (2026-08-05, per Jack — see
        // computeMaster500SeaService in seav-data.js): they're computed the
        // same all-career way as the Sea Time page's own Master <3000GT
        // tracker, so this number always matches what's shown there. Only
        // the onboard-months figure stays gated to sea time logged after
        // the OOW <3000GT issue date.
        const result = computeMaster500SeaService(getSeatimes(), getCerts(), getVessels());
        if (!result.held) {
          return {
            current: 0,
            target: result.ONBOARD_TARGET_MONTHS,
            percent: 0,
            label: "Hold OOW Yachts <3000GT first"
          };
        }
        const onboardMonthsRounded = Math.round(result.onboardMonths * 10) / 10;
        const onboardPct = result.ONBOARD_TARGET_MONTHS
          ? Math.min(100, Math.round((result.onboardMonths / result.ONBOARD_TARGET_MONTHS) * 100))
          : 0;
        const watchPct = result.WATCHKEEPING_TARGET
          ? Math.min(100, Math.round((result.watchkeepingDays / result.WATCHKEEPING_TARGET) * 100))
          : 0;
        return {
          current: onboardMonthsRounded,
          target: result.ONBOARD_TARGET_MONTHS,
          percent: Math.min(onboardPct, watchPct),
          label: `${onboardMonthsRounded} / ${result.ONBOARD_TARGET_MONTHS} months onboard (${result.watchkeepingDays} / ${result.WATCHKEEPING_TARGET} watchkeeping days) — since holding OOW <3000GT`
        };
      }
      case "master_3000gt_gated_sea_service": {
        // Same weakest-link approach as the Sea Time page's own Master
        // <3000GT tracker: watchkeeping days AND the faster of the two
        // special-experience paths (24m+ or 500GT+ vessels) both have to
        // clear before the bar reads 100%. Watchkeeping days are
        // deliberately NOT date-gated (2026-08-05, per Jack — see
        // computeMaster3000SeaService in seav-data.js): they're computed
        // the exact same way as that Sea Time page tracker, so this number
        // always matches what's shown there. Only the special-experience
        // figures stay gated to sea time logged after the OOW <3000GT
        // issue date.
        const result = computeMaster3000SeaService(getSeatimes(), getCerts(), getVessels());
        if (!result.held) {
          return {
            current: 0,
            target: result.WATCHKEEPING_TARGET,
            percent: 0,
            label: "Hold OOW Yachts <3000GT first"
          };
        }
        const watchPct = result.WATCHKEEPING_TARGET
          ? Math.min(100, Math.round((result.totalWatchkeeping15m / result.WATCHKEEPING_TARGET) * 100))
          : 0;
        const specialPct = result.specialTarget
          ? Math.min(100, Math.round((result.specialValue / result.specialTarget) * 100))
          : 0;
        const specialLabel = result.use500gtPath ? "months on 500GT+ vessels" : "months on 24m+ vessels";
        return {
          current: result.totalWatchkeeping15m,
          target: result.WATCHKEEPING_TARGET,
          percent: Math.min(watchPct, specialPct),
          label: `${result.totalWatchkeeping15m} / ${result.WATCHKEEPING_TARGET} watchkeeping days (${result.specialValue.toFixed(1)} / ${result.specialTarget} ${specialLabel}) — since holding OOW <3000GT`
        };
      }
      case "chief_mate_unlimited_direct": {
        const result = computeChiefMateUnlimitedEligibility(getCerts());
        return {
          current: result.met ? 1 : 0,
          target: 1,
          percent: result.met ? 100 : 0,
          label: result.met
            ? "Master Yachts <3000GT held — Chief Mate Yachts Unlimited eligibility met"
            : "Hold the Master Yachts <3000GT Certificate of Competency to qualify directly"
        };
      }
      case "chief_mate_3000_eligible": {
        const result = computeChiefMate3000Eligibility(getSeatimes(), getVessels(), getCerts());
        const missing = [];
        if (!result.oowMet) missing.push("OOW <3000GT eligibility");
        if (!result.yachtmasterOceanHeld) missing.push("RYA Yachtmaster Ocean");
        return {
          current: result.met ? 1 : 0,
          target: 1,
          percent: result.met ? 100 : 0,
          label: result.met
            ? "OOW <3000GT eligible and RYA Yachtmaster Ocean held"
            : `Still need: ${missing.join(" and ")}`
        };
      }
      case "master_unlimited_master3000_route": {
        // Same weakest-link approach as the other gated Master milestones —
        // months-as-Master AND actual-sea-months both have to clear.
        const result = computeMasterUnlimitedSeaService(getSeatimes(), getCerts(), getVessels());
        if (!result.held) {
          return {
            current: 0,
            target: result.ONBOARD_TARGET_MONTHS,
            percent: 0,
            label: "Hold Master Yachts <3000GT first"
          };
        }
        const onboardMonthsRounded = Math.round(result.onboardMonths * 10) / 10;
        const actualSeaMonthsRounded = Math.round(result.actualSeaMonths * 10) / 10;
        const onboardPct = result.ONBOARD_TARGET_MONTHS
          ? Math.min(100, Math.round((result.onboardMonths / result.ONBOARD_TARGET_MONTHS) * 100))
          : 0;
        const actualSeaPct = result.ACTUAL_SEA_TARGET_MONTHS
          ? Math.min(100, Math.round((result.actualSeaMonths / result.ACTUAL_SEA_TARGET_MONTHS) * 100))
          : 0;
        return {
          current: onboardMonthsRounded,
          target: result.ONBOARD_TARGET_MONTHS,
          percent: Math.min(onboardPct, actualSeaPct),
          label: `${onboardMonthsRounded} / ${result.ONBOARD_TARGET_MONTHS} months as Master on 500GT+ vessels (${actualSeaMonthsRounded} / ${result.ACTUAL_SEA_TARGET_MONTHS} months actual sea) — since holding Master <3000GT`
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

  // 2026-08-05: Jack asked for the Milestones page (private page only — NOT
  // the dashboard widget or public profile) to show each milestone's
  // individual requirements as their own separate progress bars inside a
  // dropdown, instead of one blended "weakest link" bar. This mirrors
  // getProgressForDefinition's switch above requirement-by-requirement
  // (same underlying compute*() calls, called a second time — cheap pure
  // functions over already-loaded state, not worth sharing/caching) but
  // returns an array of { label, current, target, percent, unit, note }
  // instead of one combined object. Every case returns at least one entry,
  // even single-requirement milestones, so achievements.js can render every
  // milestone the same dropdown way.
  function getSubRequirements(definition) {
    if (!definition) return [];

    const trigger = definition.trigger || { type: "manual" };

    switch (trigger.type) {
      case "sea_days": {
        const current = getTotalSeaDays();
        const target = Number(trigger.minDays || 0);
        return [
          {
            label: "Qualifying sea days",
            current,
            target,
            unit: "days",
            percent: target ? Math.min(100, Math.round((current / target) * 100)) : 0
          }
        ];
      }
      case "oow_actual_sea_days": {
        const target = Number(trigger.minDays || 0);
        const current = getActualSeaDaysOnVessels();
        return [
          {
            label: `Actual sea days (${trigger.minVesselMeters}m+ vessels)`,
            current,
            target,
            unit: "days",
            percent: target ? Math.min(100, Math.round((current / target) * 100)) : 0
          }
        ];
      }
      case "oow_qualifying_days": {
        const target = Number(trigger.minDays || 0);
        const current = getOowQualifyingDaysOnVessels();
        return [
          {
            label: `Qualifying days (${trigger.minVesselMeters}m+ vessels)`,
            current,
            target,
            unit: "days",
            percent: target ? Math.min(100, Math.round((current / target) * 100)) : 0
          }
        ];
      }
      case "oow_eligible": {
        const met = isOowSeaTimeComplete();
        return [
          {
            label: "OOW <3000GT sea-time requirements",
            current: met ? 1 : 0,
            target: 1,
            percent: met ? 100 : 0
          }
        ];
      }
      case "yachtmaster_offshore_miles": {
        const result = computeYachtmasterOffshoreMiles(getNavigationEntries());
        const totalPct = result.TARGET_NM
          ? Math.min(100, Math.round((result.totalNm / result.TARGET_NM) * 100))
          : 0;
        const tidalPct = result.TIDAL_TARGET_NM
          ? Math.min(100, Math.round((result.tidalNm / result.TIDAL_TARGET_NM) * 100))
          : 0;
        return [
          {
            label: "Total qualifying miles",
            current: Math.round(result.totalNm),
            target: result.TARGET_NM,
            unit: "NM",
            percent: totalPct
          },
          {
            label: "Tidal-water miles",
            current: Math.round(result.tidalNm),
            target: result.TIDAL_TARGET_NM,
            unit: "NM",
            percent: tidalPct
          }
        ];
      }
      case "master_200gt_gated_sea_service": {
        const result = computeMaster200SeaService(getSeatimes(), getCerts());
        if (!result.held) {
          return [
            {
              label: "Months' seagoing service (since holding Yachtmaster Offshore)",
              current: 0,
              target: result.TARGET_MONTHS,
              unit: "months",
              percent: 0,
              note: "Hold RYA Yachtmaster Offshore first"
            }
          ];
        }
        const monthsRounded = Math.round(result.months * 10) / 10;
        return [
          {
            label: "Months' seagoing service (since holding Yachtmaster Offshore)",
            current: monthsRounded,
            target: result.TARGET_MONTHS,
            unit: "months",
            percent: result.TARGET_MONTHS
              ? Math.min(100, Math.round((result.months / result.TARGET_MONTHS) * 100))
              : 0
          }
        ];
      }
      case "master_500gt_gated_sea_service": {
        const result = computeMaster500SeaService(getSeatimes(), getCerts(), getVessels());
        if (!result.held) {
          return [
            {
              label: "Months onboard as deck officer (since holding OOW <3000GT)",
              current: 0,
              target: result.ONBOARD_TARGET_MONTHS,
              unit: "months",
              percent: 0,
              note: "Hold OOW Yachts <3000GT first"
            },
            {
              label: "Watchkeeping days on vessels 15m+",
              current: 0,
              target: result.WATCHKEEPING_TARGET,
              unit: "days",
              percent: 0,
              note: "Hold OOW Yachts <3000GT first"
            }
          ];
        }
        const onboardMonthsRounded = Math.round(result.onboardMonths * 10) / 10;
        return [
          {
            label: "Months onboard as deck officer (since holding OOW <3000GT)",
            current: onboardMonthsRounded,
            target: result.ONBOARD_TARGET_MONTHS,
            unit: "months",
            percent: result.ONBOARD_TARGET_MONTHS
              ? Math.min(100, Math.round((result.onboardMonths / result.ONBOARD_TARGET_MONTHS) * 100))
              : 0
          },
          {
            label: "Watchkeeping days on vessels 15m+",
            current: result.watchkeepingDays,
            target: result.WATCHKEEPING_TARGET,
            unit: "days",
            percent: result.WATCHKEEPING_TARGET
              ? Math.min(100, Math.round((result.watchkeepingDays / result.WATCHKEEPING_TARGET) * 100))
              : 0
          }
        ];
      }
      case "master_3000gt_gated_sea_service": {
        const result = computeMaster3000SeaService(getSeatimes(), getCerts(), getVessels());
        if (!result.held) {
          return [
            {
              label: "Watchkeeping days on vessels 15m+",
              current: 0,
              target: result.WATCHKEEPING_TARGET,
              unit: "days",
              percent: 0,
              note: "Hold OOW Yachts <3000GT first"
            },
            {
              label: "Special experience (since holding OOW <3000GT)",
              current: 0,
              target: result.specialTarget,
              unit: "months",
              percent: 0,
              note: "Hold OOW Yachts <3000GT first"
            }
          ];
        }
        const specialLabel = result.use500gtPath ? "Months on 500GT+ vessels" : "Months on 24m+ vessels";
        return [
          {
            label: "Watchkeeping days on vessels 15m+",
            current: result.totalWatchkeeping15m,
            target: result.WATCHKEEPING_TARGET,
            unit: "days",
            percent: result.WATCHKEEPING_TARGET
              ? Math.min(100, Math.round((result.totalWatchkeeping15m / result.WATCHKEEPING_TARGET) * 100))
              : 0
          },
          {
            label: `${specialLabel} (since holding OOW <3000GT)`,
            current: Math.round(result.specialValue * 10) / 10,
            target: result.specialTarget,
            unit: "months",
            percent: result.specialTarget
              ? Math.min(100, Math.round((result.specialValue / result.specialTarget) * 100))
              : 0
          }
        ];
      }
      case "chief_mate_unlimited_direct": {
        const result = computeChiefMateUnlimitedEligibility(getCerts());
        return [
          {
            label: "Master Yachts <3000GT certificate held",
            current: result.met ? 1 : 0,
            target: 1,
            percent: result.met ? 100 : 0
          }
        ];
      }
      case "chief_mate_3000_eligible": {
        const result = computeChiefMate3000Eligibility(getSeatimes(), getVessels(), getCerts());
        return [
          {
            label: "OOW <3000GT eligibility (sea time met or cert held)",
            current: result.oowMet ? 1 : 0,
            target: 1,
            percent: result.oowMet ? 100 : 0
          },
          {
            label: "RYA Yachtmaster Ocean held",
            current: result.yachtmasterOceanHeld ? 1 : 0,
            target: 1,
            percent: result.yachtmasterOceanHeld ? 100 : 0
          }
        ];
      }
      case "master_unlimited_master3000_route": {
        const result = computeMasterUnlimitedSeaService(getSeatimes(), getCerts(), getVessels());
        if (!result.held) {
          return [
            {
              label: "Months as Master on 500GT+ vessels (since holding Master <3000GT)",
              current: 0,
              target: result.ONBOARD_TARGET_MONTHS,
              unit: "months",
              percent: 0,
              note: "Hold Master Yachts <3000GT first"
            },
            {
              label: "Actual sea months",
              current: 0,
              target: result.ACTUAL_SEA_TARGET_MONTHS,
              unit: "months",
              percent: 0,
              note: "Hold Master Yachts <3000GT first"
            }
          ];
        }
        const onboardMonthsRounded = Math.round(result.onboardMonths * 10) / 10;
        const actualSeaMonthsRounded = Math.round(result.actualSeaMonths * 10) / 10;
        return [
          {
            label: "Months as Master on 500GT+ vessels (since holding Master <3000GT)",
            current: onboardMonthsRounded,
            target: result.ONBOARD_TARGET_MONTHS,
            unit: "months",
            percent: result.ONBOARD_TARGET_MONTHS
              ? Math.min(100, Math.round((result.onboardMonths / result.ONBOARD_TARGET_MONTHS) * 100))
              : 0
          },
          {
            label: "Actual sea months",
            current: actualSeaMonthsRounded,
            target: result.ACTUAL_SEA_TARGET_MONTHS,
            unit: "months",
            percent: result.ACTUAL_SEA_TARGET_MONTHS
              ? Math.min(100, Math.round((result.actualSeaMonths / result.ACTUAL_SEA_TARGET_MONTHS) * 100))
              : 0
          }
        ];
      }
      case "manual":
      default:
        return [
          {
            label: definition.description || "Manually logged milestone",
            current: 0,
            target: 1,
            percent: 0
          }
        ];
    }
  }

  // 2026-08-05, per Jack: brand-new crew members with zero logged sea time
  // used to see no "Next up" card at all (every milestone sits at 0%, and
  // this used to require percent > 0 to qualify) — right when a nudge
  // would help most. Now includes 0%-progress candidates too. Ties at 0%
  // resolve via the stable sort keeping js/seav-badges.js's catalog order,
  // which already lists the ungated RYA Yachtmaster Offshore milestone
  // before every cert-gated Master/Chief Mate one — so a total newcomer
  // gets a real, immediately-workable "next" step, not a milestone that's
  // blocked on a certificate they don't hold yet (those still separately
  // read 0% but sort later in the catalog, same as before).
  function getNextMilestone() {
    const earnedCodes = new Set(getAchievements().map((item) => item.code).filter(Boolean));
    const candidates = listAchievements()
      .filter((definition) => definition.approvalRequired === false && !earnedCodes.has(definition.code))
      .map((definition) => ({
        definition,
        progress: getProgressForDefinition(definition)
      }))
      .filter((entry) => entry.progress.percent < 100)
      .sort((a, b) => b.progress.percent - a.progress.percent);

    return candidates[0] || null;
  }

  window.SeavAchievementEngine = {
    evaluateAutomaticAchievements,
    runAchievementEvaluation,
    getProgressForDefinition,
    getSubRequirements,
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