// /js/achievements.js
(function () {
  "use strict";

  if (!window.Seav) {
    console.warn("[SEA-V] Seav core not found. Did you include js/core.js before achievements.js?");
    return;
  }

  if (!window.SeavAPI) {
    console.warn("[SEA-V] SeavAPI not found. Did you include js/api.js before achievements.js?");
    return;
  }

  if (!window.SeavData) {
    console.warn("[SEA-V] SeavData not found. Did you include js/seav-data.js before achievements.js?");
    return;
  }

  if (!window.SeavBadges) {
    console.warn("[SEA-V] SeavBadges not found. Did you include js/seav-badges.js before achievements.js?");
    return;
  }

  if (!window.SeavState) {
    console.warn("[SEA-V] SeavState not found. Did you include js/state.js before achievements.js?");
    return;
  }

  const { KEYS, createId } = window.SeavData;
  const { listAchievements, getAchievementWithBadge } = window.SeavBadges;
  const STORAGE_KEY = KEYS.ACHIEVEMENTS;

  function getAchievements() {
    return window.SeavState?.achievements || [];
  }

  function getVessels() {
    return window.SeavState?.vessels || [];
  }

  function formatAchievementDate(date) {
    return date || "—";
  }

  function getBadgeImageForItem(item) {
    if (window.SeavBadges?.resolveItemBadgeImage) {
      return window.SeavBadges.resolveItemBadgeImage(item);
    }

    if (!item.badgeImage && !item.badgeKey) return "";
    return item.badgeImage || "";
  }

  function populateVesselOptions() {
    const select = document.getElementById("ach_vessel");
    if (!select) return;

    const currentValue = select.value;
    const vessels = getVessels();

    const sorted = [...vessels].sort((a, b) => {
      const da = a.from ? new Date(a.from) : new Date(0);
      const db = b.from ? new Date(b.from) : new Date(0);
      return db - da;
    });

    select.innerHTML = `
      <option value="">Choose from your vessel list</option>
      ${sorted
        .map((v) => `
         <option value="${Seav.escapeHtml(v.id || "")}">
          ${Seav.escapeHtml(v.name || "Unnamed Vessel")}
         </option>
       `)
        .join("")}
    `;

    if (currentValue) {
      select.value = currentValue;
    }
  }

  function buildBadgeHtml(item) {
    const badgeImage = getBadgeImageForItem(item);
    const tier = item.badgeTier || "default";
    const title = item.title || item.badgeLabel || "Achievement";
    const locked = item.status !== "Approved";

    if (!badgeImage) {
      return `<div class="vessel-photo-fallback">No Badge</div>`;
    }

    return `
      <div class="seav-badge-wrap tooltip-above ${locked ? "is-locked" : ""}" data-tier="${Seav.escapeHtml(tier)}">
        <img
          class="seav-badge"
          src="${Seav.escapeHtml(badgeImage)}"
          alt="${Seav.escapeHtml(title)}"
        />
        <span class="seav-badge-tooltip">
          <strong>${Seav.escapeHtml(title)}</strong>
          <span>${Seav.escapeHtml(item.category || "")}${item.status ? ` • ${Seav.escapeHtml(item.status)}` : ""}</span>
        </span>
      </div>
    `;
  }

  function buildAchievementCard(item) {
    const achievementId = item.id || "";
    const achievementFileUrl = item.attachment?.url || item.attachment?.dataUrl || "";
    const hasAttachment = !!achievementFileUrl;
    const badgeHtml = buildBadgeHtml(item);

    const attachmentHtml = hasAttachment
      ? `
        <div class="row-actions" style="margin-top:10px;">
          <a href="${Seav.escapeHtml(achievementFileUrl)}" target="_blank">
            Attachment
          </a>
        </div>
      `
      : ``;

    return `
      <article class="vessel-card achievement-card">
        <div class="vessel-photo achievement-photo">
          ${badgeHtml}
        </div>

        <div class="vessel-body">
          <h3 class="vessel-title achievement-title">${Seav.escapeHtml(item.title || "Untitled Achievement")}</h3>

          <div class="achievement-meta-grid">
            <div class="achievement-meta-item">
              <span class="achievement-meta-label">Category</span>
              <span class="achievement-meta-value">${Seav.escapeHtml(item.category || "—")}</span>
            </div>

            <div class="achievement-meta-item">
              <span class="achievement-meta-label">Vessel</span>
              <span class="achievement-meta-value">${Seav.escapeHtml(item.vessel || "—")}</span>
            </div>

            <div class="achievement-meta-item">
              <span class="achievement-meta-label">Date</span>
              <span class="achievement-meta-value">${Seav.escapeHtml(formatAchievementDate(item.date))}</span>
            </div>

            <div class="achievement-meta-item">
              <span class="achievement-meta-label">Status</span>
              <span class="achievement-meta-value">${Seav.escapeHtml(item.status || "Draft")}</span>
            </div>

            <div class="achievement-meta-item">
              <span class="achievement-meta-label">Witness</span>
              <span class="achievement-meta-value">${Seav.escapeHtml(item.witnessName || "—")}</span>
            </div>

            <div class="achievement-meta-item">
              <span class="achievement-meta-label">Position</span>
              <span class="achievement-meta-value">${Seav.escapeHtml(item.witnessPosition || "—")}</span>
            </div>

            <div class="achievement-meta-item">
              <span class="achievement-meta-label">CoC</span>
              <span class="achievement-meta-value">${Seav.escapeHtml(item.witnessCocNumber || "—")}</span>
            </div>

            <div class="achievement-meta-item">
              <span class="achievement-meta-label">Email</span>
              <span class="achievement-meta-value">${Seav.escapeHtml(item.witnessEmail || "—")}</span>
            </div>
          </div>

          ${
            item.description
              ? `<div class="vessel-desc achievement-desc">${Seav.escapeHtml(item.description)}</div>`
              : `<div class="muted achievement-desc">No supporting notes added.</div>`
          }

          ${attachmentHtml}

          ${item.autoAwarded ? `` : `
            ${Seav.seavActions(
              `${Seav.seavAction(
                "edit",
                "Edit",
                `data-edit-achievement-id="${Seav.escapeHtml(achievementId)}"`
              )}${Seav.seavAction(
                "delete",
                "Delete",
                `data-del-achievement-id="${Seav.escapeHtml(achievementId)}"`
              )}`,
              "seav-actions--compact"
            )}
          `}
          </div>
      </article>
    `;
  }

  function renderAchievementCatalog() {
    const mount = document.getElementById("achievementBadgeCatalog");
    if (!mount) return;

    const earnedCodes = new Set(
      getAchievements()
        .filter((item) => item.status === "Approved")
        .map((item) => item.code)
    );

    const definitions = listAchievements().sort((a, b) => {
      const cat = String(a.category || "").localeCompare(String(b.category || ""));
      if (cat !== 0) return cat;
      return String(a.title || "").localeCompare(String(b.title || ""));
    });

    mount.innerHTML = definitions
      .map((definition) => {
        const full = getAchievementWithBadge(definition.code);
        const badge = full?.badge;
        if (!badge) return "";

        const unlocked = earnedCodes.has(definition.code);
        const imagePath = unlocked
          ? window.SeavBadges.resolveBadgeImage(definition.badgeKey, true)
          : window.SeavBadges.resolveBadgeImage(definition.badgeKey, false);
        const tier = badge.tier || "default";

        return `
          <div
            class="seav-badge-wrap tooltip-above ${unlocked ? "" : "is-locked"}"
            data-tier="${Seav.escapeHtml(tier)}"
          >
            <img
              class="seav-badge"
              src="${Seav.escapeHtml(imagePath)}"
              alt="${Seav.escapeHtml(full.title || badge.label)}"
            />
            <span class="seav-badge-tooltip">
              <strong>${Seav.escapeHtml(full.title || badge.label)}</strong>
              <span>${Seav.escapeHtml(full.category || "")}${unlocked ? " • Earned" : " • Locked"}</span>
            </span>
          </div>
        `;
      })
      .join("");
  }

  function renderAchievements() {
    const list = document.getElementById("achievementsList");
    if (!list && !document.getElementById("achievementForm")) return;
    if (!list) return;

    const items = getAchievements();

    if (!items.length) {
      list.innerHTML = `
        <div class="list-row">
          <div>
            <div class="list-title">No achievements yet</div>
            <div class="list-sub">Select official SEA-V achievements and save them to your record.</div>
          </div>
          <span class="pill">No Badges</span>
        </div>
      `;
      return;
    }

    const sorted = [...items].sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(0);
      const db = b.date ? new Date(b.date) : new Date(0);
      return db - da;
    });

    list.innerHTML = sorted.map((item) => buildAchievementCard(item)).join("");
  }

  function populateAchievementOptions() {
    const select = document.getElementById("ach_code");
    if (!select) return;

    const currentValue = select.value;
    const achievements = listAchievements().filter((achievement) => {
  return achievement.approvalRequired === true;
});

    select.innerHTML = `
      <option value="">Pick the type of achievement</option>
      ${achievements
        .map(
          (achievement) =>
            `<option value="${Seav.escapeHtml(achievement.code)}">${Seav.escapeHtml(achievement.title)}</option>`
        )
        .join("")}
    `;

    if (currentValue) {
      select.value = currentValue;
    }
  }

  function updateAchievementBadgePreview() {
    const codeEl = document.getElementById("ach_code");
    const labelEl = document.getElementById("achBadgeLabel");
    const previewEl = document.getElementById("achBadgePreview");

    if (!codeEl || !labelEl || !previewEl) return;

    const selectedCode = codeEl.value;
    const definition = selectedCode ? getAchievementWithBadge(selectedCode) : null;

    if (!definition) {
      labelEl.textContent = "Select an achievement to view its assigned badge.";
      previewEl.innerHTML = `<span class="muted">No badge selected.</span>`;
      return;
    }

    labelEl.textContent = definition.badge?.label || "Assigned badge";

    if (definition.badge?.image) {
      const imagePath = definition.badge.image;
      previewEl.innerHTML = `
        <div class="seav-badge-wrap" data-tier="${Seav.escapeHtml(definition.badge.tier || "default")}" style="width:72px;height:72px;">
          <img
            class="seav-badge"
            src="${Seav.escapeHtml(imagePath)}"
            alt="${Seav.escapeHtml(definition.badge.label || "Badge")}"
          />
        </div>
      `;
    } else {
      previewEl.innerHTML = `
        <div class="dashboard-info-box" style="padding:10px 12px;">
          <span class="dashboard-info-value">
            ${Seav.escapeHtml(definition.badge?.label || "Assigned badge")}
          </span>
        </div>
      `;
    }
  }

  function readAchievementForm() {
    return {
      id: document.getElementById("ach_edit_index")?.value || "",
      code: document.getElementById("ach_code")?.value || "",
      vesselId: document.getElementById("ach_vessel")?.value || "",
      date: Seav.readDateTriplet("ach_date"),
      status: document.getElementById("ach_status")?.value || "Draft",
      witnessName: document.getElementById("ach_witness_name")?.value.trim() || "",
      witnessPosition: document.getElementById("ach_witness_position")?.value.trim() || "",
      witnessEmail: document.getElementById("ach_witness_email")?.value.trim() || "",
      witnessCocNumber: (document.getElementById("ach_witness_coc")?.value.trim() || "").toUpperCase(),
      description: document.getElementById("ach_description")?.value.trim() || "",
      file: document.getElementById("ach_file")?.files?.[0] || null
    };
  }

  function fillAchievementForm(item) {
    document.getElementById("ach_code").value = item.code || "";
    document.getElementById("ach_vessel").value = item.vesselId || "";
    Seav.setDateTriplet("ach_date", item.date || "");
    document.getElementById("ach_status").value = item.status || "Draft";
    document.getElementById("ach_witness_name").value = item.witnessName || "";
    document.getElementById("ach_witness_position").value = item.witnessPosition || "";
    document.getElementById("ach_witness_email").value = item.witnessEmail || "";
    document.getElementById("ach_witness_coc").value = item.witnessCocNumber || "";
    document.getElementById("ach_description").value = item.description || "";

    const editId = document.getElementById("ach_edit_index");
    if (editId) editId.value = item.id || "";

    updateAchievementBadgePreview();

    if (window.SeavModals?.openModal) {
      window.SeavModals.openModal("achievementModal");
    }
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
  if (!file) return existingAttachment || null;

  if (window.SeavSupabase) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = SeavAPI.buildStoragePath(achievementId, safeName);

    const { error } = await window.SeavSupabase.storage
      .from("achievement-files")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true
      });

    if (error) {
      console.error("[SEA-V] Achievement attachment upload failed:", error);
      Seav.notify("error", "Upload failed", "Achievement attachment upload failed. Please try again.");
      return existingAttachment || null;
    }

    return SeavAPI.buildUploadedFileMeta("achievement-files", filePath, file);
  }

  return await Seav.buildStoredFile(file, {
    fallback: existingAttachment || null,
    kind: "Attachment"
  });
}

  async function saveAchievementData(item) {
    await SeavAPI.upsertItemById(STORAGE_KEY, item);
  }

  function initAchievements() {
    if (
      !document.getElementById("achievementsList") &&
      !document.getElementById("achievementForm")
    ) return;

    const runRefresh = () => {
      populateVesselOptions();
      renderAchievementCatalog();
      renderAchievements();
    };

    populateAchievementOptions();
    updateAchievementBadgePreview();

    if (window.SeavState?.ready) {
      runRefresh();
    } else {
      document.addEventListener("seav:state-ready", runRefresh, { once: true });
    }

    const achievementSelect = document.getElementById("ach_code");
    if (achievementSelect) {
      achievementSelect.addEventListener("change", updateAchievementBadgePreview);
    }

    const cocInput = document.getElementById("ach_witness_coc");
    if (cocInput) {
      cocInput.addEventListener("input", () => {
        cocInput.value = cocInput.value.toUpperCase();
      });
    }

    const form = document.getElementById("achievementForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = readAchievementForm();
        if (!formData.code) return;

        if (formData.witnessEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.witnessEmail)) {
          Seav.notify("error", "Invalid email", "Please enter a valid witness email.");
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
          badgeKey: definition.badgeKey,
          badgeTier: definition.badge?.tier || "",
          badgeLabel: definition.badge?.label || "",
          badgeImage: definition.badge?.image || "",
          badgeLockedImage: definition.badge?.lockedImage || "",
          badgeFileName: definition.badge?.fileName || "",
          vesselId: formData.vesselId,
          vessel: getVessels().find((v) => v.id === formData.vesselId)?.name || "",
          date: formData.date,
          status: formData.status,
          witnessName: formData.witnessName,
          witnessPosition: formData.witnessPosition,
          witnessEmail: formData.witnessEmail,
          witnessCocNumber: formData.witnessCocNumber,
          description: formData.description,
          attachment
        };

        const shouldCelebrate =
          achievementData.status === "Approved" &&
          (!existingItem || existingItem.status !== "Approved");

        await saveAchievementData(achievementData);

        resetAchievementFormState();
        if (window.SeavModals?.closeAllModals) window.SeavModals.closeAllModals();

        Seav.notify("success", "Achievement recorded", "Career milestone saved to your record.");

        if (window.Seav.app?.refreshAll) {
          await window.Seav.app.refreshAll();
        } else {
          renderAchievements();
        }

        if (shouldCelebrate) {
          window.setTimeout(() => {
            window.SeavBadgeUnlock?.celebrate?.([achievementData]);
          }, 600);
        }
        }, { sub: "Saving achievement" });
      });
    }

    document.addEventListener("click", async (e) => {
      const editBtn = e.target.closest("[data-edit-achievement-id]");
      if (editBtn) {
        e.preventDefault();
        const achievementId = editBtn.getAttribute("data-edit-achievement-id");
        const item = getAchievements().find((entry) => entry.id === achievementId);

        if (item.autoAwarded) return;

        populateVesselOptions();
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
           itemLabel: "achievement"
         })
       ) {
         return;
       }

       await SeavAPI.deleteItemById(STORAGE_KEY, achievementId);

       if (window.Seav.app?.refreshAll) {
         await window.Seav.app.refreshAll();
       } else {
         renderAchievements();
       }
    }
    });

    document.addEventListener("seav:data-updated", runRefresh);
  }

  document.addEventListener("DOMContentLoaded", initAchievements);
})();