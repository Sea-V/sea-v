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

  /* ---------------------------------------------------------------
     Certificate prerequisites block — 2026-08-16.

     Deliberately NOT buildRequirementRow(). A progress bar means "you are
     accumulating toward a target"; a certificate is held or it isn't, so the
     bar could only ever read 0% or 100%. This draws state instead of
     progress: a collapsed summary carrying a segmented meter (one segment per
     required certificate, coloured by state), opening to a list grouped by
     what the crew member can act on.

     CLOSED BY DEFAULT, per Jack — the milestone stays short, and the meter in
     the summary already says whether anything needs attention without opening
     it. The meter lives INSIDE <summary> for exactly that reason: a <details>
     hides every child except the summary when closed.

     No blue anywhere in here. Blue stays the language of sea time, so the two
     halves of a milestone never read as the same kind of measure.
     --------------------------------------------------------------- */

  const CERT_STATE_ICON = {
    held: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 12.5l4 4L18 8" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    warn: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 7v6M12 16.5v.5" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>`,
    exp: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 7v6M12 16.5v.5" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>`,
    miss: ""
  };

  function buildCertItem(item) {
    const inner = `
      <span class="ach-cert-ico is-${Seav.escapeHtml(item.state)}">${CERT_STATE_ICON[item.state] || ""}</span>
      <span class="ach-cert-name">${Seav.escapeHtml(item.label || "")}</span>
      <small class="ach-cert-note">${Seav.escapeHtml(item.note || "")}</small>
    `;

    // Rows the crew member can act on directly — currently only the Training
    // Record Book, which is a profile status rather than an upload, so there
    // is nowhere else to change it now the Sea Time panel is gone.
    if (item.action === "trb") {
      return `
        <li class="ach-cert-item ach-cert-item--action">
          <button type="button" class="ach-cert-action" data-open-trb aria-label="Update Training Record Book status">
            ${inner}
            <span class="ach-cert-edit">Update</span>
          </button>
        </li>
      `;
    }

    return `<li class="ach-cert-item">${inner}</li>`;
  }

  function buildCertGroup(title, dotClass, mutedClass, items) {
    if (!items.length) return "";
    return `
      <div class="ach-cert-group ${mutedClass}">
        <div class="ach-cert-group-head">
          <span class="ach-cert-group-dot ${dotClass}" aria-hidden="true"></span>
          <span class="ach-cert-group-title">${Seav.escapeHtml(title)} · ${items.length}</span>
        </div>
        <ul class="ach-cert-list">${items.map(buildCertItem).join("")}</ul>
      </div>
    `;
  }

  function buildPrerequisitesBlock(prerequisites) {
    if (!prerequisites || !prerequisites.items?.length) return "";

    const items = prerequisites.items;
    const required = items.filter((i) => i.required);

    const attention = required.filter((i) => i.state === "exp" || i.state === "warn");
    const toObtain = required.filter((i) => i.state === "miss");
    const held = required.filter((i) => i.state === "held");
    const notRequired = items.filter((i) => !i.required);

    // One segment per REQUIRED certificate — optional and vessel-conditional
    // items are shown in the list but never counted, so they never sit here.
    const meter = required
      .map((i) => `<i class="is-${Seav.escapeHtml(i.state)}"></i>`)
      .join("");

    const outstanding = required.length - held.length;
    const summaryLabel = outstanding
      ? `${outstanding} of ${required.length} certificates or courses still outstanding`
      : "All required certificates and courses held";

    return `
      <details class="ach-certs">
        <summary class="ach-certs-summary" aria-label="${Seav.escapeHtml(summaryLabel)}">
          <span class="ach-certs-head">
            <svg class="ach-certs-chev" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="ach-certs-title">Certificates &amp; courses</span>
            <span class="ach-certs-count">${held.length} / ${required.length}</span>
          </span>
          <span class="ach-certs-meter" aria-hidden="true">${meter}</span>
        </summary>
        <div class="ach-certs-body">
          ${buildCertGroup("Needs attention", "is-att", "", attention)}
          ${buildCertGroup("Still to obtain", "is-no", "is-muted", toObtain)}
          ${buildCertGroup("Held", "is-ok", "is-muted", held)}
          ${buildCertGroup("Not required at this level", "is-no", "is-muted", notRequired)}
        </div>
      </details>
    `;
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
    subRequirements,
    prerequisites,
    readiness = "progress"
  }) {
    return `
      <details class="ach-milestone-row is-${Seav.escapeHtml(readiness)} ${
        unlocked ? "is-unlocked" : "is-locked"
      }" data-tier="${Seav.escapeHtml(tier)}">
        <summary class="ach-milestone-summary">
          <span class="ach-milestone-dot" aria-hidden="true"></span>
          <span class="ach-milestone-summary-title">
            <strong>${Seav.escapeHtml(title)}</strong>
            <small>${Seav.escapeHtml(subtitle)}</small>
          </span>
          ${
            readiness === "ready"
              ? `
                <div class="ach-progress-row-check" title="${Seav.escapeHtml(unlockedTitle)}" aria-label="${Seav.escapeHtml(unlockedTitle)}">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M7 12.5l3 3.5L17 8.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
              `
              : readiness === "sea-time"
                ? `
                <div class="ach-progress-row-part" title="Sea time met — certificates outstanding" aria-label="Sea time met, certificates outstanding">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 4a8 8 0 100 16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
                    <path d="M12 4a8 8 0 010 16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="2 3" opacity="0.5"/>
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
          ${buildPrerequisitesBlock(prerequisites)}
        </div>
      </details>
    `;
  }

  /* ---------------------------------------------------------------
     Readiness — 2026-08-16.

     The green tick used to mean "an achievement record exists", which in
     practice meant "sea time met". That over-claimed: MSN 1858 sea time is
     only half of a Certificate of Competency, and a crew member with 1007
     qualifying days and no ENG1 is not ready to apply for anything.

     The badge itself is NOT gated on certificates, deliberately. Sea time
     met IS a real achievement and permanent-once-earned protects it (see
     PERMANENT_ONCE_EARNED_TRIGGERS in js/achievements-engine.js) — taking a
     badge away because a prerequisite table is wrong would be worse than the
     problem being fixed, and that table was corrected three times on the day
     it was written. So the RECORD still means "sea time met" and the TICK
     now means "ready to apply", which are two different facts.

       "ready"     sea time met AND every required certificate held
       "sea-time"  sea time met, certificates outstanding
       "progress"  sea time not yet met

     Milestones with no prerequisites declared (geographic crossings, manual
     awards) behave exactly as before: unlocked means ready.
     --------------------------------------------------------------- */
  function certRowReadiness(unlocked, prerequisites) {
    if (!unlocked) return "progress";
    if (!prerequisites || !prerequisites.total) return "ready";
    return prerequisites.held >= prerequisites.total ? "ready" : "sea-time";
  }

  function certRowSubtitle(unlocked, unlockDate, percent, readiness, prerequisites) {
    if (readiness === "sea-time") {
      const outstanding = prerequisites.total - prerequisites.held;
      return `Sea time met · ${outstanding} certificate${outstanding === 1 ? "" : "s"} outstanding`;
    }
    if (unlocked) {
      return `${prerequisites && prerequisites.total ? "Ready to apply" : "Unlocked"}${
        unlockDate ? ` · ${formatAchievementDate(unlockDate)}` : ""
      }`;
    }
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
    const prerequisites = window.SeavAchievementEngine?.getPrerequisites?.(definition) || null;
    const readiness = certRowReadiness(unlocked, prerequisites);

    const primary = instances[0];
    const unlockedTitle = unlocked
      ? `Unlocked${primary?.date ? ` · ${formatAchievementDate(primary.date)}` : ""}`
      : "";

    return buildMinimalCertDropdown({
      tier,
      unlocked,
      unlockedTitle,
      title: full.title || "",
      subtitle: certRowSubtitle(unlocked, primary?.date, progress.percent, readiness, prerequisites),
      imagePath,
      description: full.description || "",
      subRequirements,
      prerequisites,
      readiness
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

    // The summary definition's own sea-time row is dropped (it only re-derives
    // "are the other three met") but its PREREQUISITE rows are not — those
    // describe the certificate as a whole, not any one sub-milestone, and are
    // declared against the summary code. Without this the entire OOW <3000GT
    // prerequisite list was computed and then silently discarded, so the
    // Milestones page showed certificate requirements under single-definition
    // certs like Master <200GT and none at all under OOW. Jack spotted it
    // 2026-08-16.
    const subRequirements = [
      ...breakdownDefinitions.flatMap(
        (definition) => window.SeavAchievementEngine?.getSubRequirements?.(definition) || []
      )
    ];

    // Prerequisites belong to the certificate as a whole, so they come from
    // the summary definition — the one buildCertRow drops from the sea-time
    // breakdown because its row would only re-derive "are the others met".
    const prerequisites = window.SeavAchievementEngine?.getPrerequisites?.(primary) || null;
    const readiness = certRowReadiness(unlocked, prerequisites);

    const primaryRecord = primaryInstances[0];
    const unlockedTitle = unlocked
      ? `Unlocked${primaryRecord?.date ? ` · ${formatAchievementDate(primaryRecord.date)}` : ""}`
      : "";

    return buildMinimalCertDropdown({
      tier,
      unlocked,
      unlockedTitle,
      title: certGroupKey,
      subtitle: certRowSubtitle(unlocked, primaryRecord?.date, percent, readiness, prerequisites),
      imagePath,
      description: full.description || "",
      subRequirements,
      prerequisites,
      readiness
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
            // Manually claimed badges are self-declared: the crew member picks
            // them, there is no approval queue, and the optional evidence upload
            // is never read by anything. Writing "Verified" here — the same
            // status the computed badges get — made an unchecked claim
            // indistinguishable from a calculated one in the database, on a
            // platform whose whole proposition is verification. 2026-08-16.
            status: "Self-declared",
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

    /* Training Record Book — moved here from the Sea Time page 2026-08-16.
       Same three profile fields, same save path; only the location changed.

       The whole profile object is spread before saving because
       mapProfileToSupabase upserts the entire row — saving a bare
       { trbStatus } would blank every other profile field. That trap is
       inherited from the original implementation and is the reason this
       reads longer than it looks like it should. */
    function fillTrbForm() {
      const profile = window.SeavState?.profile || {};
      const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value || "";
      };
      set("trb_status", profile.trbStatus || "not_started");
      set("trb_target_qualification", profile.trbTargetQualification);
      set("trb_notes", profile.trbNotes);
    }

    async function saveTrbForm() {
      const existingProfile = window.SeavState?.profile || {};
      const value = (id) => document.getElementById(id)?.value?.trim() || "";

      const updatedProfile = {
        ...existingProfile,
        trbStatus: document.getElementById("trb_status")?.value || "not_started",
        trbTargetQualification: value("trb_target_qualification"),
        trbNotes: value("trb_notes")
      };

      await Seav.withSaving(async () => {
        await window.SeavAPI.save(KEYS.PROFILE, updatedProfile);
        // window.SeavState.profile is a read-only getter — patchData() is the
        // public way to update the in-memory snapshot after a save.
        window.SeavState?.patchData?.({ profile: updatedProfile });
        window.SeavModals?.closeAllModals?.();
        renderPage();
        Seav.notify("success", "Training Record Book saved", "Your TRB status is up to date.");
      }, { sub: "Saving Training Record Book" });
    }

    const trbForm = document.getElementById("trbForm");
    if (trbForm) {
      trbForm.addEventListener("submit", (e) => {
        e.preventDefault();
        saveTrbForm();
      });
    }

    document.addEventListener("click", async (e) => {
      const trbBtn = e.target.closest("[data-open-trb]");
      if (trbBtn) {
        e.preventDefault();
        e.stopPropagation();
        fillTrbForm();
        window.SeavModals?.openModal?.("trbModal");
        return;
      }

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
