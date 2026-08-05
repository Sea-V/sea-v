// /js/achievements.js
(function () {
  "use strict";

  if (!window.SeavData || !window.SeavBadges) {
    console.warn("[SEA-V] Achievements dependencies missing.");
    return;
  }

  const { KEYS, createId, formatDatePretty } = window.SeavData;
  const { listAchievements, getAchievementWithBadge } = window.SeavBadges;
  const STORAGE_KEY = KEYS.ACHIEVEMENTS;

  const TIER_RANK = { default: 0, bronze: 1, silver: 2, gold: 3, platinum: 4 };

  // Two permanent sections, Deck Progression always rendered above Seafarer
  // Awards — not a filter, both are always visible. "Deck Progression" (and
  // any future "Engineering Progression") are objectively calculated against
  // a real CoC sea-service threshold (MSN 1858 etc.) and rendered as a
  // stacked checklist with the progress bar staying visible even once met.
  // Everything else — vessel/passage/ops experience, rank self-reporting —
  // is a Seafarer Award and rendered as the trophy-grid showcase. Categories
  // stay fully dynamic; anything not listed here falls back to Seafarer
  // Awards so a future category never goes missing from the page.
  const CAREER_PATH_CATEGORIES = ["Deck Progression", "Engineering Progression"];

  // Deck Progression is grouped by certificate (not one flat list) — each
  // achievement's certGroup (js/seav-badges.js) says which cert it feeds
  // into, and this says what order those certs are actually earned in.
  // RYA Yachtmaster Offshore sits first because it's a prerequisite cert
  // for OOW <3000GT itself (MSN 1858 3.3(b)), not something earned after —
  // Jack confirmed this ordering 2026-08-04. Any definition whose certGroup
  // isn't listed here sorts to the end rather than disappearing, so a future
  // cert group never silently vanishes off the page.
  // Master <200GT only needs 6 months' seagoing service after Yachtmaster
  // Offshore (MSN 1858 §3.1), versus OOW <3000GT's 365 qualifying days +
  // 36 months onboard (§3.3) — both are gated on Yachtmaster Offshore, but
  // Master <200GT is reachable far sooner, so it sits above OOW <3000GT here.
  const DECK_CERT_GROUP_ORDER = [
    "RYA Yachtmaster Offshore",
    "Master <200GT",
    "OOW Yachts <3000GT",
    "Chief Mate Yachts <3000GT",
    "Master <500GT",
    "Master <3000GT",
    "Chief Mate Yachts Unlimited",
    "Master Yachts Unlimited"
  ];

  function certGroupRank(name) {
    const idx = DECK_CERT_GROUP_ORDER.indexOf(name);
    return idx === -1 ? DECK_CERT_GROUP_ORDER.length : idx;
  }

  function achievementActionAttrs(id) {
    const safeId = Seav.escapeHtml(id || "");
    return {
      edit: `data-edit-achievement-id="${safeId}"`,
      del: `data-del-achievement-id="${safeId}"`
    };
  }

  function achievementActionsHtml(id) {
    const attrs = achievementActionAttrs(id);
    return Seav.seavActions(
      `${Seav.seavAction("edit", "Edit", attrs.edit)}${Seav.seavAction("delete", "Delete", attrs.del)}`,
      "seav-actions--compact"
    );
  }

  function getAchievements() {
    return window.SeavState?.achievements || [];
  }

  function getVessels() {
    return window.SeavState?.vessels || [];
  }

  function isEarnedRecord(item) {
    if (!item || item.status === "Declined") return false;
    return true;
  }

  function groupEarnedByCode() {
    const groups = new Map();

    // Only count codes that still exist in the current badge catalog.
    // Crew who earned one of the 22 badges pruned in v380 still have those
    // achievement rows sitting in Supabase — without this filter they'd
    // keep inflating "Badges unlocked" / "Total moments" / "Top tier
    // earned" forever, even though the badge itself no longer renders
    // anywhere on the page. See project_seav_badges_pruned_to_real_milestones.
    const validCodes = new Set(listAchievements().map((definition) => definition.code));

    getAchievements()
      .filter(isEarnedRecord)
      .forEach((item) => {
        if (!item.code || !validCodes.has(item.code)) return;
        if (!groups.has(item.code)) groups.set(item.code, []);
        groups.get(item.code).push(item);
      });

    groups.forEach((items, code) => {
      items.sort((a, b) => {
        const da = a.date ? new Date(a.date) : new Date(0);
        const db = b.date ? new Date(b.date) : new Date(0);
        return db - da;
      });
      groups.set(code, items);
    });

    return groups;
  }

  function formatAchievementDate(date) {
    if (!date) return "—";
    return formatDatePretty(date) || date;
  }

  function getTierRank(tier) {
    return TIER_RANK[String(tier || "default").toLowerCase()] ?? 0;
  }

  function getHighestTier(earnedGroups) {
    let best = "default";
    earnedGroups.forEach((items) => {
      const tier = items[0]?.badgeTier || "default";
      if (getTierRank(tier) > getTierRank(best)) best = tier;
    });
    return best;
  }

  function populateVesselOptions() {
    const select = document.getElementById("ach_vessel");
    if (!select) return;

    const currentValue = select.value;
    const sorted = [...getVessels()].sort((a, b) => {
      const da = a.from ? new Date(a.from) : new Date(0);
      const db = b.from ? new Date(b.from) : new Date(0);
      return db - da;
    });

    select.innerHTML = `
      <option value="">Which yacht was this on?</option>
      ${sorted
        .map(
          (v) =>
            `<option value="${Seav.escapeHtml(v.id || "")}">${Seav.escapeHtml(v.name || "Unnamed vessel")}</option>`
        )
        .join("")}
    `;

    if (currentValue) select.value = currentValue;

    // Logging a milestone requires a vessel to submit -- with zero vessels
    // the select is empty and the form can't be completed, so say so
    // plainly instead of letting the user hit a silent validation error.
    const notice = document.getElementById("achNoVesselNotice");
    if (notice) notice.hidden = sorted.length > 0;
  }

  function populateAchievementOptions() {
    const select = document.getElementById("ach_code");
    if (!select) return;

    const currentValue = select.value;
    const manual = listAchievements()
      .filter((achievement) => achievement.approvalRequired === true)
      .sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));

    select.innerHTML = `
      <option value="">Choose a badge to log</option>
      ${manual
        .map(
          (achievement) =>
            `<option value="${Seav.escapeHtml(achievement.code)}">${Seav.escapeHtml(achievement.title)}</option>`
        )
        .join("")}
    `;

    if (currentValue) select.value = currentValue;
  }

  function updateAchievementBadgePreview() {
    const codeEl = document.getElementById("ach_code");
    const labelEl = document.getElementById("achBadgeLabel");
    const previewEl = document.getElementById("achBadgePreview");
    if (!codeEl || !labelEl || !previewEl) return;

    const definition = codeEl.value ? getAchievementWithBadge(codeEl.value) : null;

    if (!definition) {
      labelEl.textContent = "Pick a milestone to preview its badge.";
      previewEl.innerHTML = `<span class="muted">No badge selected.</span>`;
      return;
    }

    labelEl.textContent = definition.badge?.label || definition.title || "Badge";
    const imagePath = window.SeavBadges.resolveBadgeImage(definition.badgeKey, true);

    previewEl.innerHTML = `
      <div class="seav-badge-wrap ach-modal-badge" data-tier="${Seav.escapeHtml(definition.badge?.tier || "default")}">
        <img class="seav-badge" src="${Seav.escapeHtml(imagePath)}" alt="${Seav.escapeHtml(definition.title || "")}" />
      </div>
    `;
  }

  function renderKpis(earnedGroups) {
    const row = document.getElementById("achKpiRow");
    if (!row) return;

    const definitions = listAchievements();
    const unlockedCodes = earnedGroups.size;
    const totalCodes = definitions.length;
    const highestTier = getHighestTier(earnedGroups);
    const tierLabel =
      highestTier === "default" ? "—" : highestTier.charAt(0).toUpperCase() + highestTier.slice(1);

    // 2026-08-05: Jack asked to drop "Total moments" and "Categories" (low
    // signal, cluttered the row) and make the remaining two boxes bigger —
    // see .ach-kpi-row / .ach-kpi-box in achievements.css (now 2-box layout).
    row.innerHTML = `
      <div class="ach-kpi-box ach-kpi-box--hero">
        <div class="ach-kpi-ring" style="--ach-progress: ${totalCodes ? Math.round((unlockedCodes / totalCodes) * 100) : 0}%">
          <span class="ach-kpi-ring-value">${unlockedCodes}<small>/${totalCodes}</small></span>
        </div>
        <div class="ach-kpi-label">Badges unlocked</div>
      </div>
      <div class="ach-kpi-box ach-kpi-box--hero">
        <div class="kpi-num ach-kpi-tier" data-tier="${Seav.escapeHtml(highestTier)}">${Seav.escapeHtml(tierLabel)}</div>
        <div class="kpi-label">Top tier earned</div>
      </div>
    `;
  }

  function renderNextMilestone(_earnedGroups) {
    const mount = document.getElementById("achNextMilestone");
    if (!mount) return;

    const next = window.SeavAchievementEngine?.getNextMilestone?.();
    if (!next) {
      mount.hidden = true;
      return;
    }

    const full = getAchievementWithBadge(next.definition.code);
    const imagePath = window.SeavBadges.resolveBadgeImage(next.definition.badgeKey, false);

    mount.hidden = false;
    mount.innerHTML = `
      <div class="ach-next-badge">
        <img src="${Seav.escapeHtml(imagePath)}" alt="" />
      </div>
      <div class="ach-next-copy">
        <span class="ach-next-label">Next up</span>
        <strong>${Seav.escapeHtml(full?.title || next.definition.title || "Milestone")}</strong>
        <span class="ach-next-progress-label">${Seav.escapeHtml(next.progress.label || "")}</span>
        <div class="ach-progress-bar" role="progressbar" aria-valuenow="${next.progress.percent}" aria-valuemin="0" aria-valuemax="100">
          <span style="width: ${next.progress.percent}%"></span>
        </div>
      </div>
    `;
  }

  function buildInstanceRow(item) {
    const vesselLabel = item.vessel || "Unknown vessel";
    const dateLabel = formatAchievementDate(item.date);
    const canEdit = !item.autoAwarded;

    return `
      <li class="ach-instance-row">
        <div class="ach-instance-main">
          <span class="ach-instance-vessel">${Seav.escapeHtml(vesselLabel)}</span>
          <span class="ach-instance-date">${Seav.escapeHtml(dateLabel)}</span>
        </div>
        ${
          item.description
            ? `<p class="ach-instance-note">${Seav.escapeHtml(item.description)}</p>`
            : ""
        }
        ${
          canEdit
            ? achievementActionsHtml(item.id)
            : `<span class="ach-instance-auto pill pill-neutral">Auto-unlocked</span>`
        }
      </li>
    `;
  }

  function buildTrophyTile(definition, instances) {
    const full = getAchievementWithBadge(definition.code);
    if (!full) return "";

    const unlocked = instances.length > 0;
    const tier = full.badge?.tier || "default";
    const sourcePage = definition.sourcePage || "achievements";
    const imagePath = window.SeavBadges.resolveBadgeImage(definition.badgeKey, unlocked);
    const progress = window.SeavAchievementEngine?.getProgressForDefinition?.(definition) || {
      percent: unlocked ? 100 : 0,
      label: ""
    };

    const primary = instances[0];
    const vesselSummary =
      instances.length === 0
        ? ""
        : instances.length === 1
          ? primary.vessel
            ? `On ${primary.vessel}`
            : primary.autoAwarded
              ? "Career-wide milestone"
              : "Logged milestone"
          : `${instances.length} vessels`;

    const instanceList =
      instances.length <= 1
        ? ""
        : `
          <details class="ach-instances-details">
            <summary>${instances.length} unlocks — tap for vessels</summary>
            <ul class="ach-instance-list">
              ${instances.map((item) => buildInstanceRow(item)).join("")}
            </ul>
          </details>
        `;

    const singleMeta =
      instances.length === 1
        ? `
          <p class="ach-trophy-meta">
            ${primary.vessel ? `<span class="ach-trophy-vessel">${Seav.escapeHtml(primary.vessel)}</span>` : `<span class="ach-trophy-vessel ach-trophy-vessel--career">${primary.autoAwarded ? "Career-wide" : "—"}</span>`}
            <span class="ach-trophy-date">${Seav.escapeHtml(formatAchievementDate(primary.date))}</span>
          </p>
          ${
            primary.description && !primary.autoAwarded
              ? `<p class="ach-trophy-story">${Seav.escapeHtml(primary.description)}</p>`
              : ""
          }
          ${
            !primary.autoAwarded
              ? achievementActionsHtml(primary.id)
              : ""
          }
        `
        : instanceList;

    return `
      <article
        class="ach-trophy ${unlocked ? "is-unlocked" : "is-locked"}"
        data-tier="${Seav.escapeHtml(tier)}"
        data-source-page="${Seav.escapeHtml(sourcePage)}"
        data-category="${Seav.escapeHtml(definition.category || "")}"
      >
        <div class="ach-trophy-badge-wrap">
          ${unlocked ? `<span class="ach-trophy-glow" aria-hidden="true"></span>` : ""}
          ${instances.length > 1 ? `<span class="ach-trophy-count">×${instances.length}</span>` : ""}
          <img class="ach-trophy-badge" src="${Seav.escapeHtml(imagePath)}" alt="${Seav.escapeHtml(full.title || "")}" />
        </div>

        <h4 class="ach-trophy-title">${Seav.escapeHtml(full.title || "")}</h4>
        <p class="ach-trophy-category">${Seav.escapeHtml(definition.category || "")}</p>

        ${
          unlocked
            ? `<p class="ach-trophy-status ach-trophy-status--unlocked">${Seav.escapeHtml(vesselSummary)}</p>${singleMeta}`
            : `
              <p class="ach-trophy-hint">${Seav.escapeHtml(full.description || progress.label || "Keep building your record to unlock.")}</p>
              ${
                definition.approvalRequired
                  ? `<p class="ach-trophy-log-hint">Log manually when you earn this on a vessel.</p>`
                  : `
                    <div class="ach-progress-bar ach-progress-bar--compact" role="progressbar" aria-valuenow="${progress.percent}" aria-valuemin="0" aria-valuemax="100">
                      <span style="width: ${progress.percent}%"></span>
                    </div>
                    <span class="ach-trophy-progress-label">${Seav.escapeHtml(progress.label || "")}</span>
                  `
              }
            `
        }
      </article>
    `;
  }

  // Deck Progression is a checklist toward a real cert, not a collectible
  // showcase — so it's rendered as a stacked list of collapsible rows, one
  // per certificate, in catalog/ladder order.
  // 2026-08-05, per Jack (3rd pass on this section — see
  // [[project_seav_milestone_badge_clarity_fix]] for the full history):
  // the collapsed row must be as minimal as the Vessels page's own
  // collapsible history cards (js/vessels.js buildVesselCard /
  // .vessel-history-summary) — just a status dot, the cert title, and a
  // one-line status, nothing else. The badge image, description, and the
  // full requirement-by-requirement progress breakdown only appear once
  // the row is opened. Deliberately does NOT reuse the .ach-progress-row
  // class for the outer wrapper — that class (and its flex/padding layout)
  // is also used as-is by the Dashboard widget's plain <article> markup in
  // core.js's buildDashboardMilestoneRow, so changing its layout here would
  // have broken that unrelated surface. New .ach-milestone-row/-summary/
  // -dot/-summary-title/-detail classes handle the minimal shell; the
  // existing .ach-progress-row-badge/-desc/-check classes are reused
  // inside the opened detail panel only (those were already plain,
  // non-flex-container class selectors, safe to share).
  function formatReqNumber(value) {
    const num = Number(value) || 0;
    return Number.isInteger(num) ? String(num) : num.toFixed(1);
  }

  function formatReqValue(req) {
    if (req.target === 1) {
      return req.percent >= 100 ? "Met" : "Not yet";
    }
    const unit = req.unit ? ` ${req.unit}` : "";
    return `${formatReqNumber(req.current)} / ${formatReqNumber(req.target)}${unit}`;
  }

  function buildRequirementRow(req) {
    return `
      <li class="ach-req-row">
        <div class="ach-req-row-top">
          <span class="ach-req-label">${Seav.escapeHtml(req.label || "")}</span>
          <span class="ach-req-value">${Seav.escapeHtml(formatReqValue(req))}</span>
        </div>
        <div class="ach-progress-bar ach-progress-bar--compact" role="progressbar" aria-valuenow="${req.percent}" aria-valuemin="0" aria-valuemax="100">
          <span style="width: ${req.percent}%"></span>
        </div>
        ${req.note ? `<p class="ach-req-note">${Seav.escapeHtml(req.note)}</p>` : ""}
      </li>
    `;
  }

  // Shared minimal <details>/<summary> shell for every cert row — collapsed
  // state is just a status dot + title + one short status line (matching
  // js/vessels.js's buildVesselCard/.vessel-history-summary pattern
  // exactly, per Jack). Everything else — badge art, description, the
  // per-requirement progress breakdown — lives in the detail panel and
  // only renders once opened.
  function buildMinimalCertDropdown({
    tier,
    unlocked,
    unlockedTitle,
    title,
    subtitle,
    imagePath,
    description,
    subRequirements
  }) {
    return `
      <details class="ach-milestone-row ${unlocked ? "is-unlocked" : "is-locked"}" data-tier="${Seav.escapeHtml(tier)}">
        <summary class="ach-milestone-summary">
          <span class="ach-milestone-dot" aria-hidden="true"></span>
          <span class="ach-milestone-summary-title">
            <strong>${Seav.escapeHtml(title)}</strong>
            <small>${Seav.escapeHtml(subtitle)}</small>
          </span>
          ${
            unlocked
              ? `
                <div class="ach-progress-row-check" title="${Seav.escapeHtml(unlockedTitle)}" aria-label="${Seav.escapeHtml(unlockedTitle)}">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M7 12.5l3 3.5L17 8.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
              `
              : ""
          }
        </summary>
        <div class="ach-milestone-detail">
          <div class="ach-milestone-detail-head">
            <div class="ach-progress-row-badge">
              <img src="${Seav.escapeHtml(imagePath)}" alt="${Seav.escapeHtml(title)}" />
            </div>
            ${description ? `<p class="ach-progress-row-desc">${Seav.escapeHtml(description)}</p>` : ""}
          </div>
          <ul class="ach-req-list">
            ${subRequirements.map(buildRequirementRow).join("")}
          </ul>
        </div>
      </details>
    `;
  }

  function certRowSubtitle(unlocked, unlockDate, percent) {
    if (unlocked) return `Unlocked${unlockDate ? ` · ${formatAchievementDate(unlockDate)}` : ""}`;
    return percent > 0 ? `${percent}% complete` : "Not started";
  }

  function buildProgressRow(definition, instances) {
    const full = getAchievementWithBadge(definition.code);
    if (!full) return "";

    const unlocked = instances.length > 0;
    const tier = full.badge?.tier || "default";
    const imagePath = window.SeavBadges.resolveBadgeImage(definition.badgeKey, unlocked);
    const progress = window.SeavAchievementEngine?.getProgressForDefinition?.(definition) || {
      percent: unlocked ? 100 : 0,
      label: ""
    };
    const subRequirements = window.SeavAchievementEngine?.getSubRequirements?.(definition) || [];

    const primary = instances[0];
    const unlockedTitle = unlocked
      ? `Unlocked${primary?.date ? ` · ${formatAchievementDate(primary.date)}` : ""}`
      : "";

    return buildMinimalCertDropdown({
      tier,
      unlocked,
      unlockedTitle,
      title: full.title || "",
      subtitle: certRowSubtitle(unlocked, primary?.date, progress.percent),
      imagePath,
      description: full.description || "",
      subRequirements
    });
  }

  // 2026-08-05, per Jack — corrects the 2026-08-05 dropdown build above:
  // he asked for ONE dropdown PER CERTIFICATE, not one dropdown per
  // underlying catalog badge. A cert with a single catalog definition
  // already behaves this way via buildProgressRow (its own
  // getSubRequirements already returns every sub-part as its own row inside
  // one dropdown — e.g. RYA Yachtmaster Offshore opens to "Total qualifying
  // miles" + "Tidal-water miles"). The one cert that's actually split across
  // MULTIPLE catalog definitions is OOW Yachts <3000GT (250 actual days /
  // 365 qualifying days / 36 months onboard / a 4th "Sea Time Complete"
  // summary badge that's just the AND of the other three) — that one showed
  // as 4 separate single-row dropdown boxes instead of 1 dropdown with a
  // 3-row breakdown. Convention: the LAST definition in a multi-definition
  // group is treated as the "complete" summary badge (its own
  // getSubRequirements row would just re-derive "are the others all met",
  // so it's dropped) — its badge/title/earned-date represent the whole
  // cert row, and every OTHER definition in the group supplies this row's
  // requirement breakdown. This only changes how the Deck Progression list
  // on THIS page displays them — all underlying achievement records still
  // get earned/awarded individually exactly as before (badge-unlock
  // celebration, dashboard trophy case, etc. are untouched).
  function buildCertRow(certGroupKey, definitions, earnedGroups) {
    if (definitions.length === 1) {
      return buildProgressRow(definitions[0], earnedGroups.get(definitions[0].code) || []);
    }

    const primary = definitions[definitions.length - 1];
    const breakdownDefinitions = definitions.slice(0, -1);

    const full = getAchievementWithBadge(primary.code);
    if (!full) return "";

    const primaryInstances = earnedGroups.get(primary.code) || [];
    const unlocked = primaryInstances.length > 0;
    const tier = full.badge?.tier || "default";
    const imagePath = window.SeavBadges.resolveBadgeImage(primary.badgeKey, unlocked);

    const subProgresses = breakdownDefinitions.map(
      (definition) => window.SeavAchievementEngine?.getProgressForDefinition?.(definition) || { percent: 0 }
    );
    const percent = subProgresses.length
      ? Math.min(...subProgresses.map((p) => p.percent))
      : unlocked
        ? 100
        : 0;

    const subRequirements = breakdownDefinitions.flatMap(
      (definition) => window.SeavAchievementEngine?.getSubRequirements?.(definition) || []
    );

    const primaryRecord = primaryInstances[0];
    const unlockedTitle = unlocked
      ? `Unlocked${primaryRecord?.date ? ` · ${formatAchievementDate(primaryRecord.date)}` : ""}`
      : "";

    return buildMinimalCertDropdown({
      tier,
      unlocked,
      unlockedTitle,
      title: certGroupKey,
      subtitle: certRowSubtitle(unlocked, primaryRecord?.date, percent),
      imagePath,
      description: full.description || "",
      subRequirements
    });
  }

  function renderDeckProgression() {
    const mount = document.getElementById("achDeckProgressionList");
    if (!mount) return;

    const earnedGroups = groupEarnedByCode();
    const definitions = listAchievements().filter((definition) =>
      CAREER_PATH_CATEGORIES.includes(definition.category)
    );

    if (!definitions.length) {
      mount.innerHTML = `<div class="ach-empty">No progression milestones yet.</div>`;
      return;
    }

    // Group by certGroup (falls back to category for any definition that
    // doesn't set one yet), then order the groups by DECK_CERT_GROUP_ORDER —
    // catalog order within each group is preserved (that's already the
    // "earn these in order" sequence set in js/seav-badges.js).
    const groups = new Map();
    definitions.forEach((definition) => {
      const key = definition.certGroup || definition.category;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(definition);
    });

    const orderedKeys = [...groups.keys()].sort(
      (a, b) => certGroupRank(a) - certGroupRank(b)
    );

    // 2026-08-05, per Jack: flat list now, one dropdown per certificate —
    // no group-header wrapper, since the cert name IS the dropdown title
    // (see buildCertRow above).
    const rows = orderedKeys.map((key) => buildCertRow(key, groups.get(key), earnedGroups)).join("");

    mount.innerHTML = `<div class="ach-progress-list">${rows}</div>`;
  }

  function renderSeafarerAwards() {
    const grid = document.getElementById("achSeafarerAwardsGrid");
    if (!grid) return;

    const earnedGroups = groupEarnedByCode();
    const definitions = listAchievements()
      .filter((definition) => !CAREER_PATH_CATEGORIES.includes(definition.category))
      .sort((a, b) => {
        const aUnlocked = earnedGroups.has(a.code);
        const bUnlocked = earnedGroups.has(b.code);
        if (aUnlocked !== bUnlocked) return aUnlocked ? -1 : 1;

        const cat = String(a.category || "").localeCompare(String(b.category || ""));
        if (cat !== 0) return cat;
        return String(a.title || "").localeCompare(String(b.title || ""));
      });

    if (!definitions.length) {
      grid.innerHTML = `<div class="ach-empty">No badges here yet.</div>`;
      return;
    }

    grid.innerHTML = definitions
      .map((definition) => buildTrophyTile(definition, earnedGroups.get(definition.code) || []))
      .join("");
  }

  function renderPage() {
    const earnedGroups = groupEarnedByCode();
    renderKpis(earnedGroups);
    renderNextMilestone(earnedGroups);
    renderDeckProgression();
    renderSeafarerAwards();
  }

  function readAchievementForm() {
    return {
      id: document.getElementById("ach_edit_index")?.value || "",
      code: document.getElementById("ach_code")?.value || "",
      vesselId: document.getElementById("ach_vessel")?.value || "",
      date: Seav.readDateTriplet("ach_date"),
      description: document.getElementById("ach_description")?.value.trim() || "",
      file: document.getElementById("ach_file")?.files?.[0] || null
    };
  }

  function fillAchievementForm(item) {
    document.getElementById("ach_code").value = item.code || "";
    document.getElementById("ach_vessel").value = item.vesselId || "";
    Seav.setDateTriplet("ach_date", item.date || "");
    document.getElementById("ach_description").value = item.description || "";

    const editId = document.getElementById("ach_edit_index");
    if (editId) editId.value = item.id || "";

    updateAchievementBadgePreview();
    window.SeavModals?.openModal?.("achievementModal");
  }

  function resetAchievementFormState() {
    const form = document.getElementById("achievementForm");
    if (form) form.reset();

    const editId = document.getElementById("ach_edit_index");
    if (editId) editId.value = "";

    Seav.clearDateTriplet("ach_date");
    updateAchievementBadgePreview();
  }

  async function buildAchievementAttachment(file, existingAttachment, achievementId) {
    return (
      window.SeavUpload?.uploadToStorage({
        bucket: "achievement-files",
        entityId: achievementId,
        file,
        existingMeta: existingAttachment,
        kind: "Achievement"
      }) ?? existingAttachment ?? null
    );
  }

  function initAchievements() {
    if (!document.getElementById("achTrophyGrid") && !document.getElementById("achievementForm")) return;

    if (!window.Seav || !window.SeavAPI || !window.SeavData || !window.SeavBadges || !window.SeavState) {
      console.warn("[SEA-V] Achievements dependencies missing on init.");
      return;
    }

    populateAchievementOptions();
    populateVesselOptions();
    updateAchievementBadgePreview();

    const runRefresh = () => {
      populateVesselOptions();
      renderPage();
    };

    Seav.bindStateRefresh(runRefresh, { label: "Achievements refresh" });

    document.getElementById("ach_code")?.addEventListener("change", updateAchievementBadgePreview);

    const form = document.getElementById("achievementForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = readAchievementForm();
        if (!formData.code) {
          Seav.notify("error", "Pick a milestone", "Choose which badge you are logging.");
          return;
        }

        if (!formData.vesselId) {
          Seav.notify("error", "Pick a vessel", "Every milestone needs a yacht — even career-wide badges.");
          return;
        }

        const definition = getAchievementWithBadge(formData.code);
        if (!definition) return;

        const existingItem = formData.id
          ? getAchievements().find((item) => item.id === formData.id) || null
          : null;

        await Seav.withSaving(async () => {
          const achievementId = formData.id || createId("achievement");
          const attachment = await buildAchievementAttachment(
            formData.file,
            existingItem?.attachment || null,
            achievementId
          );
          if (formData.file && !attachment) return;

          const achievementData = {
            id: achievementId,
            code: definition.code,
            title: definition.title,
            category: definition.category,
            dashboardSection: definition.dashboardSection || "",
            badgeKey: definition.badgeKey,
            badgeTier: definition.badge?.tier || "",
            badgeLabel: definition.badge?.label || "",
            badgeImage: definition.badge?.image || "",
            badgeLockedImage: definition.badge?.lockedImage || "",
            badgeFileName: definition.badge?.fileName || "",
            vesselId: formData.vesselId,
            vessel: getVessels().find((v) => v.id === formData.vesselId)?.name || "",
            date: formData.date,
            status: "Verified",
            witnessName: "",
            witnessPosition: "",
            witnessEmail: "",
            witnessCocNumber: "",
            description: formData.description,
            attachment,
            autoAwarded: false
          };

          const isNew = !existingItem;

          await SeavAPI.upsertItemById(STORAGE_KEY, achievementData);

          resetAchievementFormState();
          window.SeavModals?.closeAllModals?.();

          Seav.notify("success", "Badge unlocked", `${definition.title} added to your trophy case.`);

          if (window.Seav.app?.refreshAll) {
            await window.Seav.app.refreshAll();
          } else {
            renderPage();
          }

          if (isNew) {
            window.setTimeout(() => {
              window.SeavBadgeUnlock?.celebrate?.([achievementData]);
            }, 500);
          }
        }, { sub: "Saving milestone" });
      });
    }

    document.addEventListener("click", async (e) => {
      const editBtn = e.target.closest("[data-edit-achievement-id]");
      if (editBtn) {
        e.preventDefault();
        const item = getAchievements().find((entry) => entry.id === editBtn.getAttribute("data-edit-achievement-id"));
        if (!item || item.autoAwarded) return;
        populateVesselOptions();
        populateAchievementOptions();
        fillAchievementForm(item);
        return;
      }

      const delBtn = e.target.closest("[data-del-achievement-id]");
      if (delBtn) {
        e.preventDefault();
        const achievementId = delBtn.getAttribute("data-del-achievement-id");
        const item = getAchievements().find((entry) => entry.id === achievementId);
        if (!item || item.autoAwarded) return;

        if (
          !Seav.confirmDelete({
            itemName: item.title || item.badgeLabel || "",
            itemLabel: "milestone"
          })
        ) {
          return;
        }

        await SeavAPI.deleteItemById(STORAGE_KEY, achievementId);

        if (window.Seav.app?.refreshAll) {
          await window.Seav.app.refreshAll();
        } else {
          renderPage();
        }
      }
    });
  }

  document.addEventListener("DOMContentLoaded", initAchievements);
})();
