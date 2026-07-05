// /js/achievements.js
(function () {
  "use strict";

  if (!window.Seav || !window.SeavAPI || !window.SeavData || !window.SeavBadges || !window.SeavState) {
    console.warn("[SEA-V] Achievements dependencies missing.");
    return;
  }

  const { KEYS, createId, formatDatePretty } = window.SeavData;
  const { listAchievements, getAchievementWithBadge } = window.SeavBadges;
  const STORAGE_KEY = KEYS.ACHIEVEMENTS;

  const TIER_RANK = { default: 0, bronze: 1, silver: 2, gold: 3, platinum: 4 };
  let activeCategory = "all";

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

    getAchievements()
      .filter(isEarnedRecord)
      .forEach((item) => {
        if (!item.code) return;
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

  function getUniqueCategories() {
    const order = [];
    listAchievements().forEach((definition) => {
      const cat = definition.category || "Other";
      if (!order.includes(cat)) order.push(cat);
    });
    return order;
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
    const totalMoments = [...earnedGroups.values()].reduce((sum, items) => sum + items.length, 0);
    const highestTier = getHighestTier(earnedGroups);
    const tierLabel =
      highestTier === "default" ? "—" : highestTier.charAt(0).toUpperCase() + highestTier.slice(1);

    row.innerHTML = `
      <div class="ach-kpi-box ach-kpi-box--hero">
        <div class="ach-kpi-ring" style="--ach-progress: ${totalCodes ? Math.round((unlockedCodes / totalCodes) * 100) : 0}%">
          <span class="ach-kpi-ring-value">${unlockedCodes}<small>/${totalCodes}</small></span>
        </div>
        <div class="ach-kpi-label">Badges unlocked</div>
      </div>
      <div class="ach-kpi-box">
        <div class="kpi-num">${totalMoments}</div>
        <div class="kpi-label">Total moments</div>
      </div>
      <div class="ach-kpi-box">
        <div class="kpi-num ach-kpi-tier" data-tier="${Seav.escapeHtml(highestTier)}">${Seav.escapeHtml(tierLabel)}</div>
        <div class="kpi-label">Top tier earned</div>
      </div>
      <div class="ach-kpi-box">
        <div class="kpi-num">${getUniqueCategories().length}</div>
        <div class="kpi-label">Categories</div>
      </div>
    `;
  }

  function renderNextMilestone(earnedGroups) {
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

  function renderCategoryTabs() {
    const mount = document.getElementById("achCategoryTabs");
    if (!mount) return;

    const categories = getUniqueCategories();

    mount.innerHTML = `
      <button type="button" class="ach-tab ${activeCategory === "all" ? "is-active" : ""}" data-ach-category="all">All</button>
      ${categories
        .map(
          (category) =>
            `<button type="button" class="ach-tab ${activeCategory === category ? "is-active" : ""}" data-ach-category="${Seav.escapeHtml(category)}">${Seav.escapeHtml(category)}</button>`
        )
        .join("")}
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
            ? Seav.seavActions(
                `${Seav.seavAction("edit", "Edit", `data-edit-achievement-id="${Seav.escapeHtml(item.id || "")}"`)}${Seav.seavAction(
                  "delete",
                  "Delete",
                  `data-del-achievement-id="${Seav.escapeHtml(item.id || "")}"`
                )}`,
                "seav-actions--compact"
              )
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
            : "Career milestone"
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
            ${primary.vessel ? `<span class="ach-trophy-vessel">${Seav.escapeHtml(primary.vessel)}</span>` : ""}
            <span class="ach-trophy-date">${Seav.escapeHtml(formatAchievementDate(primary.date))}</span>
          </p>
          ${
            primary.description && !primary.autoAwarded
              ? `<p class="ach-trophy-story">${Seav.escapeHtml(primary.description)}</p>`
              : ""
          }
          ${
            !primary.autoAwarded
              ? Seav.seavActions(
                  `${Seav.seavAction("edit", "Edit", `data-edit-achievement-id="${Seav.escapeHtml(primary.id || "")}"`)}${Seav.seavAction(
                    "delete",
                    "Delete",
                    `data-del-achievement-id="${Seav.escapeHtml(primary.id || "")}"`
                  )}`,
                  "seav-actions--compact"
                )
              : ""
          }
        `
        : instanceList;

    return `
      <article
        class="ach-trophy ${unlocked ? "is-unlocked" : "is-locked"}"
        data-tier="${Seav.escapeHtml(tier)}"
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

  function renderTrophyCase() {
    const grid = document.getElementById("achTrophyGrid");
    if (!grid) return;

    const earnedGroups = groupEarnedByCode();
    const definitions = listAchievements().sort((a, b) => {
      const aUnlocked = earnedGroups.has(a.code);
      const bUnlocked = earnedGroups.has(b.code);
      if (aUnlocked !== bUnlocked) return aUnlocked ? -1 : 1;

      const cat = String(a.category || "").localeCompare(String(b.category || ""));
      if (cat !== 0) return cat;
      return String(a.title || "").localeCompare(String(b.title || ""));
    });

    const filtered =
      activeCategory === "all"
        ? definitions
        : definitions.filter((definition) => definition.category === activeCategory);

    if (!filtered.length) {
      grid.innerHTML = `<div class="ach-empty">No badges in this category yet.</div>`;
      return;
    }

    grid.innerHTML = filtered
      .map((definition) => buildTrophyTile(definition, earnedGroups.get(definition.code) || []))
      .join("");
  }

  function renderRecentFeed() {
    const section = document.getElementById("achRecentSection");
    const feed = document.getElementById("achRecentFeed");
    if (!section || !feed) return;

    const recent = getAchievements()
      .filter(isEarnedRecord)
      .sort((a, b) => {
        const da = a.date ? new Date(a.date) : new Date(a.createdAt || 0);
        const db = b.date ? new Date(b.date) : new Date(b.createdAt || 0);
        return db - da;
      })
      .slice(0, 8);

    if (!recent.length) {
      section.hidden = true;
      return;
    }

    section.hidden = false;
    feed.innerHTML = recent
      .map((item) => {
        const imagePath =
          window.SeavBadges.resolveItemBadgeImage({ ...item, status: "Approved" }) ||
          window.SeavBadges.resolveBadgeImage(item.badgeKey, true);

        return `
          <article class="ach-recent-item">
            <img class="ach-recent-badge" src="${Seav.escapeHtml(imagePath)}" alt="" />
            <div class="ach-recent-copy">
              <strong>${Seav.escapeHtml(item.title || "Achievement")}</strong>
              <span>${Seav.escapeHtml(item.vessel || "Career milestone")} · ${Seav.escapeHtml(formatAchievementDate(item.date))}</span>
            </div>
            ${item.autoAwarded ? `<span class="pill pill-neutral">Auto</span>` : `<span class="pill pill-valid">Logged</span>`}
          </article>
        `;
      })
      .join("");
  }

  function renderPage() {
    const earnedGroups = groupEarnedByCode();
    renderKpis(earnedGroups);
    renderNextMilestone(earnedGroups);
    renderCategoryTabs();
    renderTrophyCase();
    renderRecentFeed();
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

    populateAchievementOptions();
    populateVesselOptions();
    updateAchievementBadgePreview();

    const runRefresh = () => {
      populateVesselOptions();
      renderPage();
    };

    Seav.bindStateRefresh(runRefresh, { label: "Achievements refresh" });

    document.getElementById("ach_code")?.addEventListener("change", updateAchievementBadgePreview);

    document.getElementById("achCategoryTabs")?.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-ach-category]");
      if (!tab) return;
      activeCategory = tab.getAttribute("data-ach-category") || "all";
      renderCategoryTabs();
      renderTrophyCase();
    });

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
            status: "Approved",
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
