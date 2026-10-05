// /js/onboard-experience.js
(function () {
  "use strict";

  if (!window.Seav || !window.SeavAPI || !window.SeavData || !window.SeavState) {
    console.warn("[SEA-V] Onboard experience dependencies missing.");
    return;
  }

  const {
    KEYS,
    createId,
    getSortedVesselOptions,
    getVesselColor,
    formatDatePretty,
    ONBOARD_EXPERIENCE_CATEGORIES,
    getOnboardCategoryLabel,
    ONBOARD_SKILL_CATEGORIES,
    getOnboardSkillCategoryLabel,
    getOnboardSkillsForCategory,
    getOnboardSkillRatingLabel
  } = window.SeavData;

  const STORAGE_KEY = KEYS.ONBOARD_EXPERIENCES;
  const SKILL_STORAGE_KEY = KEYS.ONBOARD_SKILLS;
  const OE_FILE_BUCKET =
    window.SeavApiCore?.STORAGE_BUCKETS?.ONBOARD_EXPERIENCE_FILES ||
    "onboard-experience-files";
  // Captioned photos per entry (v536). The DB check constraint in
  // docs/schema-onboard-experiences-photos.sql enforces the same 4.
  const MAX_PHOTOS = 4;
  const PHOTO_LABEL_MAX = 40;
  const PHOTO_CAPTION_MAX = 80;
  const Photos = window.SeavPhotoStrip;
  const expandedOeIds = new Set();
  const expandedVesselIds = new Set();

  function getEntries() {
    return window.SeavState?.onboardExperiences || [];
  }

  function getVessels() {
    return window.SeavState?.vessels || [];
  }

  function formatDateRange(from, to) {
    const start = from ? formatDatePretty(from) : "—";
    const end = to ? formatDatePretty(to) : "Ongoing";
    return `${start} → ${end}`;
  }

  function populateCategoryOptions() {
    const select = document.getElementById("oe_category");
    if (!select) return;

    const current = select.value || "";
    select.innerHTML = `
      <option value="">What type of onboard work was this?</option>
      ${ONBOARD_EXPERIENCE_CATEGORIES.map(
        (item) =>
          `<option value="${Seav.escapeHtml(item.value)}">${Seav.escapeHtml(item.label)}</option>`
      ).join("")}
    `;
    if (current) select.value = current;
  }

  function populateVesselOptions() {
    const select = document.getElementById("oe_vessel");
    if (!select) return;

    const current = select.value || "";
    const vessels = getSortedVesselOptions(getVessels());

    select.innerHTML = `
      <option value="">Choose from your vessel list</option>
      ${vessels
        .map(
          (v) =>
            `<option value="${Seav.escapeHtml(v.id)}">${Seav.escapeHtml(v.name)}</option>`
        )
        .join("")}
    `;
    if (current) select.value = current;

    // Onboard experience requires a vessel to submit -- with zero vessels
    // the select is empty and the form can't be completed, so say so
    // plainly instead of letting the user hit a silent validation error.
    const notice = document.getElementById("oeNoVesselNotice");
    if (notice) notice.hidden = vessels.length > 0;
  }

  // 2026-08-09, per Jack: dropped the sign-off feature entirely -- this is
  // now a self-reported log (like the rest of a CV), not something needing
  // a senior officer's confirmation. KPI row swapped from
  // Total/Signed off/Not signed off/Familiarisations to a set that still
  // means something without a status concept: Total logged, Vessels
  // covered, Familiarisations, and Skills rated (pulls the Skills section's
  // count in too, tying the two halves of this page together).
  function renderKpis() {
    const row = document.getElementById("oeKpiRow");
    if (!row) return;

    const entries = getEntries();
    const vesselCount = new Set(entries.map((e) => e.vesselId).filter(Boolean)).size;
    const familiar = entries.filter((e) => e.isFamiliarisation).length;
    const skillsRated = getSkillEntries().length;

    row.innerHTML = `
      <div class="onboard-kpi-box">
        <div class="kpi-num">${entries.length}</div>
        <div class="kpi-label">Total logged</div>
      </div>
      <div class="onboard-kpi-box">
        <div class="kpi-num">${vesselCount}</div>
        <div class="kpi-label">Vessels</div>
      </div>
      <div class="onboard-kpi-box">
        <div class="kpi-num">${familiar}</div>
        <div class="kpi-label">Familiarisations</div>
      </div>
      <div class="onboard-kpi-box">
        <div class="kpi-num">${skillsRated}</div>
        <div class="kpi-label">Skills rated</div>
      </div>
    `;
  }

  function hasAttachment(attachment) {
    return (
      window.SeavApiCore?.hasStoredFile?.(attachment) ??
      !!(attachment?.url || attachment?.dataUrl || attachment?.path)
    );
  }

  function getAttachmentUrl(attachment) {
    return Seav.getFileDisplayUrl(attachment, OE_FILE_BUCKET);
  }

  async function hydrateAttachment(attachment) {
    if (!attachment || !hasAttachment(attachment)) return attachment || null;
    if (!attachment.path || !window.SeavApiCore?.hydrateFileMeta) return attachment;

    const hasDisplayUrl = !!getAttachmentUrl(attachment);
    if (
      !window.SeavApiCore?.storedFileNeedsHydration?.(attachment, OE_FILE_BUCKET) &&
      hasDisplayUrl
    ) {
      return attachment;
    }

    return window.SeavApiCore.hydrateFileMeta(attachment, OE_FILE_BUCKET);
  }

  async function ensureOnboardAttachmentsHydrated() {
    const entries = getEntries();
    if (!Array.isArray(entries) || !entries.length || !window.SeavApiCore?.hydrateItemsFileField) {
      return false;
    }

    // attachment AND photos (ENTITY_FILE_FIELDS.onboard_experiences), in
    // one batched signing call. Copied back in place: callers render straight
    // from the state array.
    const core = window.SeavApiCore;
    if (core.hydrateArrayFiles) {
      const hydrated = await core.hydrateArrayFiles(entries, "onboard_experiences");
      hydrated.forEach((item, i) => {
        if (item && entries[i] && item !== entries[i]) Object.assign(entries[i], item);
      });
    } else {
      await core.hydrateItemsFileField(entries, "attachment", OE_FILE_BUCKET);
    }
    window.SeavState?.syncCache?.();
    return true;
  }

  function renderAttachmentHint(attachmentMeta, { isNewSelection = false } = {}) {
    const hint = document.getElementById("oeFileHint");
    const btn = document.getElementById("oeFileBtn");

    if (isNewSelection) {
      if (hint) {
        hint.textContent = attachmentMeta?.filename
          ? `New file selected: ${attachmentMeta.filename} — click Save entry to apply`
          : "New file selected — click Save entry to apply";
      }
      if (btn) btn.textContent = "Change file";
      return;
    }

    const docUrl = attachmentMeta ? getAttachmentUrl(attachmentMeta) : "";
    const filename = attachmentMeta?.filename || attachmentMeta?.name || "";
    if (hint) {
      hint.textContent = docUrl
        ? (filename ? `Current file: ${filename}` : "Current file uploaded")
        : "No file uploaded yet";
    }
    if (btn) {
      btn.textContent = docUrl ? "Change file" : "Choose file";
    }
  }

  /* ---------- photo editor (modal) ----------
     editingPhotos is the modal's working copy: saved photos ({ stored }) and
     newly picked files ({ file, previewUrl }), each with its own label and
     caption. Nothing uploads until Save entry, so cancelling the modal
     leaves storage untouched. */
  let editingPhotos = [];
  let photoKeySeq = 0;

  function releasePhotoPreviews() {
    editingPhotos.forEach((photo) => {
      if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl);
    });
  }

  function setEditingPhotos(entry) {
    releasePhotoPreviews();
    const saved = entry && Photos ? Photos.getEntryPhotos(entry) : [];
    editingPhotos = saved.slice(0, MAX_PHOTOS).map((photo) => ({
      key: `p${(photoKeySeq += 1)}`,
      stored: photo,
      label: String(photo.label || ""),
      caption: String(photo.caption || "")
    }));
    renderPhotoEditor();
  }

  function renderPhotoEditor() {
    const rows = document.getElementById("oePhotoRows");
    const count = document.getElementById("oePhotoCount");
    const addBtn = document.getElementById("oePhotoAddBtn");
    if (count) count.textContent = `${editingPhotos.length} / ${MAX_PHOTOS}`;
    if (addBtn) addBtn.disabled = editingPhotos.length >= MAX_PHOTOS;
    if (!rows) return;

    rows.innerHTML = editingPhotos
      .map((photo) => {
        const src = photo.previewUrl || (photo.stored ? getAttachmentUrl(photo.stored) : "");
        const key = Seav.escapeHtml(photo.key);
        return `
          <div class="oe-photo-row" data-oe-photo-key="${key}">
            <span class="oe-photo-row-thumb">${src ? `<img src="${Seav.escapeHtml(src)}" alt="" />` : ""}</span>
            <div class="oe-photo-row-fields">
              <input type="text" data-oe-photo-field="label" maxlength="${PHOTO_LABEL_MAX}"
                value="${Seav.escapeHtml(photo.label)}" aria-label="Photo label"
                placeholder="Label, e.g. Tender launch" />
              <input type="text" data-oe-photo-field="caption" maxlength="${PHOTO_CAPTION_MAX}"
                value="${Seav.escapeHtml(photo.caption)}" aria-label="Photo description (optional)"
                placeholder="What it shows, e.g. Lifting the chase tender at anchor (optional)" />
            </div>
            <button type="button" class="oe-photo-row-remove" data-oe-photo-remove="${key}" aria-label="Remove photo">&times;</button>
          </div>
        `;
      })
      .join("");
  }

  async function addPhotoFiles(fileList) {
    const files = Array.from(fileList || []).filter((file) =>
      String(file.type || "").startsWith("image/") || window.SeavUpload?.isHeicFile?.(file)
    );
    const room = MAX_PHOTOS - editingPhotos.length;
    if (files.length > room) {
      Seav.notify(
        "error",
        "Photo limit reached",
        `You can add up to ${MAX_PHOTOS} photos per entry.`
      );
    }
    for (const file of files.slice(0, Math.max(room, 0))) {
      const previewUrl = (await window.SeavUpload?.buildPreviewUrl?.(file)) || "";
      editingPhotos.push({ key: `p${(photoKeySeq += 1)}`, file, previewUrl, label: "", caption: "" });
    }
    renderPhotoEditor();
    // New rows need a label before Save: put the cursor straight in it.
    const firstBlank = editingPhotos.find((photo) => !photo.label.trim());
    if (firstBlank) {
      document
        .querySelector(`[data-oe-photo-key="${firstBlank.key}"] [data-oe-photo-field="label"]`)
        ?.focus();
    }
  }

  // Uploads new files and returns the photos array to save, or null if any
  // upload failed (uploadToStorage has already told the person why).
  async function buildPhotosForSave(entryId) {
    const result = [];
    for (const photo of editingPhotos) {
      const text = { label: photo.label.trim(), caption: photo.caption.trim() };
      if (photo.stored) {
        result.push({ ...photo.stored, ...text });
        continue;
      }
      const uploaded = await window.SeavUpload?.uploadToStorage({
        bucket: OE_FILE_BUCKET,
        entityId: entryId,
        file: photo.file,
        existingMeta: null,
        kind: "Photo",
        maxBytes: window.SeavUpload?.PHOTO_MAX_BYTES,
        resizeImage: true
      });
      if (!uploaded) return null;
      const hydrated = await hydrateAttachment(uploaded);
      result.push({ ...(hydrated || uploaded), ...text });
    }
    return result;
  }

  // Photos render as the captioned strip (js/seav-photo-strip.js); the
  // attachment is now only ever a document (PDF), shown as one link.
  function renderAttachmentSection(attachment) {
    if (!hasAttachment(attachment)) return "";

    const fileUrl = getAttachmentUrl(attachment);
    const filename = attachment?.filename || attachment?.name || "Attachment";
    if (!fileUrl) {
      return `<div class="onboard-attachment-section onboard-attachment-section--file muted">Loading ${Seav.escapeHtml(filename)}…</div>`;
    }

    return `
      <div class="onboard-attachment-section onboard-attachment-section--file">
        <a class="onboard-attachment-link" href="${Seav.escapeHtml(fileUrl)}" target="_blank" rel="noopener">
          ${Seav.escapeHtml(filename)}
        </a>
      </div>
    `;
  }

  // Up to three tiny thumbnails beside the chevron, so a collapsed card
  // still says "there is photo evidence here" without taking any height.
  function renderSummaryThumbs(photos) {
    const urls = photos.map((photo) => getAttachmentUrl(photo)).filter(Boolean);
    if (!urls.length) return "";
    const shown = urls.slice(0, 3);
    const extra = urls.length - shown.length;
    return `
      <span class="oe-summary-thumbs" aria-label="${urls.length} photo${urls.length === 1 ? "" : "s"}">
        ${shown.map((url) => `<img src="${Seav.escapeHtml(url)}" alt="" loading="lazy" />`).join("")}
        ${extra > 0 ? `<small class="oe-summary-thumbs-more">+${extra}</small>` : ""}
      </span>
    `;
  }

  // Groups entries by vessel so the page shows one row per vessel instead of
  // every entry flattened together — with many entries across several
  // vessels that flat list became hard to scan. Each group is sorted
  // most-recent-first internally, and the groups themselves are ordered by
  // whichever vessel has the most recently dated entry.
  function groupEntriesByVessel(entries) {
    const groups = new Map();

    entries.forEach((entry) => {
      const vesselId = entry.vesselId || "";
      if (!groups.has(vesselId)) groups.set(vesselId, []);
      groups.get(vesselId).push(entry);
    });

    const vessels = getVessels();

    return [...groups.entries()]
      .map(([vesselId, groupEntries]) => {
        const vessel = vessels.find((v) => v.id === vesselId);
        const sorted = [...groupEntries].sort((a, b) => {
          const da = a.dateFrom ? new Date(a.dateFrom) : new Date(0);
          const db = b.dateFrom ? new Date(b.dateFrom) : new Date(0);
          return db - da;
        });
        const latestTime = sorted[0]?.dateFrom ? new Date(sorted[0].dateFrom).getTime() : 0;

        return {
          vesselId,
          vesselName: vessel?.name || (vesselId ? "Unknown vessel" : "No vessel linked"),
          // Same vessel-identity colour used on the Navigation page (js/seav-data.js
          // getVesselColor), kept consistent everywhere vessels are grouped.
          vesselColor: vesselId ? getVesselColor(vesselId, vessels) : "",
          entries: sorted,
          latestTime
        };
      })
      .sort((a, b) => b.latestTime - a.latestTime);
  }

  function renderEntryCard(entry) {
    const entryId = entry.id || "";
    const categoryLabel = getOnboardCategoryLabel(entry.category);
    const photos = Photos ? Photos.getEntryPhotos(entry) : [];
    const documentMeta = Photos ? Photos.getEntryDocument(entry) : entry.attachment;
    const photosHtml = Photos ? Photos.buildPhotoStrip(photos, { bucket: OE_FILE_BUCKET }) : "";
    const attachmentHtml = renderAttachmentSection(documentMeta);

        const familiarisationHtml = entry.isFamiliarisation
          ? `<span class="onboard-familiarisation-pill onboard-familiarisation-pill-compact">Familiarisation</span>`
          : "";

        const isExpanded = expandedOeIds.has(entryId);

        return `
          <article class="onboard-modern-card ui-card ui-card-hover ui-accent-coral${isExpanded ? " is-expanded" : ""}" data-oe-id="${Seav.escapeHtml(entryId)}">

            <button
              type="button"
              class="onboard-modern-summary"
              aria-expanded="${isExpanded ? "true" : "false"}"
              data-toggle-oe-id="${Seav.escapeHtml(entryId)}"
            >
              <div class="onboard-modern-summary-left">
                <div class="onboard-modern-title-block">
                  <h3 class="onboard-modern-name">${Seav.escapeHtml(entry.title || "Untitled")}</h3>
                  ${entry.positionHeld ? `<p class="onboard-modern-position">${Seav.escapeHtml(entry.positionHeld)}</p>` : ""}
                </div>
                ${familiarisationHtml}
              </div>
              <div class="onboard-modern-summary-right">
                ${renderSummaryThumbs(photos)}
                <span class="onboard-chevron" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </span>
              </div>
            </button>

            <div class="onboard-modern-body"${isExpanded ? "" : " hidden"}>
              <div class="onboard-modern-meta">
                ${Seav.escapeHtml(categoryLabel)}
              </div>

              <div class="onboard-modern-meta">
                ${Seav.escapeHtml(formatDateRange(entry.dateFrom, entry.dateTo))}
                ${entry.hours ? ` • ${Seav.escapeHtml(String(entry.hours))} hrs` : ""}
                ${entry.locationOnboard ? ` • ${Seav.escapeHtml(entry.locationOnboard)}` : ""}
              </div>

              <div class="onboard-modern-desc">${Seav.escapeHtml(entry.description || "")}</div>

              ${photosHtml}
              ${attachmentHtml}

              ${Seav.seavActions(
                `${Seav.seavAction(
                  "edit",
                  "Edit",
                  `data-edit-oe-id="${Seav.escapeHtml(entryId)}"`
                )}${Seav.seavAction(
                  "delete",
                  "Delete",
                  `data-del-oe-id="${Seav.escapeHtml(entryId)}"`
                )}`,
                "seav-actions--compact"
              )}
            </div>
          </article>
        `;
  }

  function renderVesselGroup(group) {
    const isExpanded = expandedVesselIds.has(group.vesselId);
    const entryLabel = group.entries.length === 1 ? "entry" : "entries";
    const statusMetaParts = [`${group.entries.length} ${entryLabel}`];

    return `
      <article class="onboard-vessel-group ui-card ui-accent-coral${isExpanded ? " is-expanded" : ""}" data-vessel-group-id="${Seav.escapeHtml(group.vesselId)}">

        <button
          type="button"
          class="onboard-vessel-summary"
          aria-expanded="${isExpanded ? "true" : "false"}"
          data-toggle-vessel-id="${Seav.escapeHtml(group.vesselId)}"
        >
          <div class="onboard-vessel-summary-left">
            <h3 class="onboard-vessel-name">
              ${group.vesselColor ? `<span class="vessel-color-dot" style="background:${Seav.escapeHtml(group.vesselColor)}"></span>` : ""}
              ${Seav.escapeHtml(group.vesselName)}
            </h3>
            <span class="onboard-vessel-meta">${Seav.escapeHtml(statusMetaParts.join(" • "))}</span>
          </div>
          <div class="onboard-vessel-summary-right">
            <span class="onboard-chevron" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </div>
        </button>

        <div class="onboard-vessel-body list"${isExpanded ? "" : " hidden"}>
          ${group.entries.map((entry) => renderEntryCard(entry)).join("")}
        </div>

      </article>
    `;
  }

  // js/core.js's bindStateRefresh reruns this page's refresh on EVERY
  // "seav:data-updated" event app-wide — not just changes to onboard
  // experience data. That event also fires for things with nothing to do
  // with this page (background signed-URL re-hydration for another table,
  // a save on a completely different page in another tab sharing this
  // session, etc.). Rebuilding list.innerHTML unconditionally on every one
  // of those tears down and recreates every vessel group and entry card —
  // including whichever one the user currently has expanded — producing a
  // visible flash/flicker even though the resulting HTML is identical.
  // Skip the rebuild entirely unless the data that actually feeds this
  // list (entries + vessel names) has changed since the last render.
  let lastRenderedFingerprint = null;

  function renderList() {
    const list = document.getElementById("oeList");
    if (!list) return;

    const entries = getEntries();
    const vessels = getVessels();
    const fingerprint = JSON.stringify({
      entries,
      vessels: vessels.map((v) => [v.id, v.name])
    });

    if (fingerprint === lastRenderedFingerprint) return;
    lastRenderedFingerprint = fingerprint;

    if (!entries.length) {
      list.innerHTML = `
        <div class="list-row">
          <div>
            <div class="list-title">No onboard experience yet</div>
            <div class="list-sub">Add familiarisations, paint work, crane ops, and other yacht skills.</div>
          </div>
          <span class="pill">Draft</span>
        </div>
      `;
      return;
    }

    const groups = groupEntriesByVessel(entries);
    list.innerHTML = groups.map((group) => renderVesselGroup(group)).join("");
  }

  function openEntryModal(entry) {
    populateVesselOptions();
    populateCategoryOptions();

    document.getElementById("oe_edit_id").value = entry?.id || "";
    document.getElementById("oe_vessel").value = entry?.vesselId || "";
    document.getElementById("oe_category").value = entry?.category || "";
    document.getElementById("oe_familiarisation").checked = !!entry?.isFamiliarisation;
    document.getElementById("oe_position").value = entry?.positionHeld || "";
    document.getElementById("oe_title").value = entry?.title || "";
    document.getElementById("oe_description").value = entry?.description || "";
    document.getElementById("oe_location").value = entry?.locationOnboard || "";
    document.getElementById("oe_hours").value =
      entry?.hours != null && entry.hours !== "" ? String(entry.hours) : "";
    Seav.fillDateTriplet("oe_date_from", entry?.dateFrom || "");
    Seav.fillDateTriplet("oe_date_to", entry?.dateTo || "");
    const fileInput = document.getElementById("oe_file");
    if (fileInput) fileInput.value = "";
    setEditingPhotos(entry || null);
    renderAttachmentHint(Photos ? Photos.getEntryDocument(entry) : entry?.attachment || null);

    if (window.SeavModals?.openModal) window.SeavModals.openModal("oeModal");
  }

  // Mirrors certificates.js's openAddModal() — the generic [data-open]
  // handler in core.js only opens the modal, it never resets the form, so
  // without this the "Add experience" button would keep showing whatever
  // was last loaded into the form by an edit.
  function openAddModal() {
    const form = document.getElementById("oeForm");
    if (!form) return;

    form.reset();
    document.getElementById("oe_edit_id").value = "";
    Seav.clearDateTriplet("oe_date_from");
    Seav.clearDateTriplet("oe_date_to");
    populateVesselOptions();
    populateCategoryOptions();
    setEditingPhotos(null);
    renderAttachmentHint(null);

    if (window.SeavModals?.openModal) window.SeavModals.openModal("oeModal");
  }

  function readEntryForm() {
    return {
      id: document.getElementById("oe_edit_id")?.value || "",
      vesselId: document.getElementById("oe_vessel")?.value || "",
      category: document.getElementById("oe_category")?.value || "",
      isFamiliarisation: !!document.getElementById("oe_familiarisation")?.checked,
      positionHeld: document.getElementById("oe_position")?.value.trim() || "",
      title: document.getElementById("oe_title")?.value.trim() || "",
      description: document.getElementById("oe_description")?.value.trim() || "",
      locationOnboard: document.getElementById("oe_location")?.value.trim() || "",
      dateFrom: Seav.readDateTriplet("oe_date_from"),
      dateTo: Seav.readDateTriplet("oe_date_to"),
      hours: Number(document.getElementById("oe_hours")?.value || 0),
      file: document.getElementById("oe_file")?.files?.[0] || null
    };
  }

  async function buildAttachment(file, existing, entryId) {
    return window.SeavUpload?.uploadToStorage({
      bucket: "onboard-experience-files",
      entityId: entryId,
      file,
      existingMeta: existing,
      kind: "Onboard experience",
      errorHint: "Run docs/onboard-experiences-table.sql in Supabase (storage bucket + policies)."
    }) ?? existing ?? null;
  }

  /* =========================================================
     SKILLS — self-assessed skills profile (Deck/Officer + Engineering)
     Separate from the logbook above: fast tap-to-rate, no vessel/dates.
     See docs/onboard-skills-table.sql. The skill picker also supports a
     free-text "not listed" entry (2026-08-09, per Jack) -- the DB column
     is already plain text with no catalog-only constraint, so this needed
     no schema change, just a UI path to type a name instead of picking one.
  ========================================================= */

  const STAR_PATH =
    "M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 17.77l-5.9 3.1 1.13-6.57L2.45 9.44l6.6-.96L12 2.5z";

  function getSkillEntries() {
    return window.SeavState?.onboardSkills || [];
  }

  function renderStarButtons(rating) {
    const value = Number(rating) || 0;
    let html = "";
    for (let i = 1; i <= 5; i += 1) {
      const filled = i <= value;
      html += `
        <button
          type="button"
          class="onboard-star-btn${filled ? " is-filled" : ""}"
          data-star-value="${i}"
          aria-label="${i} star${i > 1 ? "s" : ""}"
          aria-pressed="${filled ? "true" : "false"}"
        ><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}"/></svg></button>
      `;
    }
    return html;
  }

  function populateSkillCategoryOptions() {
    const select = document.getElementById("skillCategorySelect");
    if (!select) return;

    const current = select.value || "";
    select.innerHTML = `
      <option value="">Choose a category</option>
      ${ONBOARD_SKILL_CATEGORIES.map(
        (item) =>
          `<option value="${Seav.escapeHtml(item.value)}">${Seav.escapeHtml(item.label)}</option>`
      ).join("")}
    `;
    if (current) select.value = current;
  }

  const CUSTOM_SKILL_VALUE = "__custom__";

  // Shows/hides the free-text "skill not listed" input next to the
  // dropdown. 2026-08-09, per Jack: crew should be able to log training or
  // a skill that isn't in the preset catalog, not just pick from a fixed
  // list -- see docs/onboard-skills-table.sql, the `skill` column is plain
  // text with no catalog-only constraint, so this is UI-only.
  function setSkillCustomFieldVisible(visible) {
    const field = document.getElementById("skillCustomField");
    const input = document.getElementById("skillCustomName");
    if (!field) return;

    field.hidden = !visible;
    if (visible) {
      input?.focus();
    } else if (input) {
      input.value = "";
    }
  }

  function populateSkillNameOptions(category) {
    const select = document.getElementById("skillNameSelect");
    if (!select) return;

    if (!category) {
      select.innerHTML = `<option value="">Choose a category first</option>`;
      select.disabled = true;
      setSkillCustomFieldVisible(false);
      return;
    }

    const already = new Set(
      getSkillEntries()
        .filter((s) => s.category === category)
        .map((s) => s.skill.toLowerCase())
    );
    const available = getOnboardSkillsForCategory(category).filter(
      (skill) => !already.has(skill.toLowerCase())
    );

    // The catalog list can run dry (every preset skill for this category
    // already added), but the "not listed" option must always stay --
    // that's the whole point of it, and it's how someone logs a second
    // custom skill in the same category too.
    select.innerHTML = `
      <option value="">${
        available.length
          ? "Choose a skill"
          : `All ${Seav.escapeHtml(getOnboardSkillCategoryLabel(category))} skills added`
      }</option>
      ${available
        .map((skill) => `<option value="${Seav.escapeHtml(skill)}">${Seav.escapeHtml(skill)}</option>`)
        .join("")}
      <option value="${CUSTOM_SKILL_VALUE}">+ Add a skill not listed…</option>
    `;
    select.disabled = false;
    setSkillCustomFieldVisible(false);
  }

  function renderSkillRatingInput(rating) {
    const container = document.getElementById("skillRatingInput");
    if (!container) return;
    container.setAttribute("data-rating", String(rating));
    container.innerHTML = renderStarButtons(rating);
  }

  function groupSkillsByCategory(skills) {
    return ONBOARD_SKILL_CATEGORIES.map((cat) => ({
      category: cat.value,
      label: cat.label,
      items: skills.filter((s) => s.category === cat.value)
    })).filter((group) => group.items.length);
  }

  function renderSkillRow(entry) {
    const noteHtml = entry.note
      ? `<p class="onboard-skill-row-note">${Seav.escapeHtml(entry.note)}</p>`
      : "";

    return `
      <div class="onboard-skill-row">
        <div class="onboard-skill-row-top">
          <span class="onboard-skill-row-name">${Seav.escapeHtml(entry.skill)}</span>
          <div class="onboard-skill-row-right">
            <div class="onboard-skill-stars" data-skill-id="${Seav.escapeHtml(entry.id)}">
              ${renderStarButtons(entry.rating)}
            </div>
            <span class="onboard-skill-row-label">${Seav.escapeHtml(
              getOnboardSkillRatingLabel(entry.rating)
            )}</span>
            <button
              type="button"
              class="onboard-skill-remove"
              data-remove-skill-id="${Seav.escapeHtml(entry.id)}"
              aria-label="Remove ${Seav.escapeHtml(entry.skill)}"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>
        ${noteHtml}
      </div>
    `;
  }

  function renderSkillGroups() {
    const list = document.getElementById("skillGroupsList");
    if (!list) return;

    const skills = getSkillEntries();
    if (!skills.length) {
      list.innerHTML = `
        <p class="muted onboard-skill-empty">
          No skills rated yet — pick a category and skill above to get started.
        </p>
      `;
      return;
    }

    const groups = groupSkillsByCategory(skills);
    list.innerHTML = groups
      .map(
        (group) => `
          <div class="onboard-skill-group">
            <h4 class="onboard-skill-group-title">${Seav.escapeHtml(group.label)}</h4>
            <div class="onboard-skill-group-list">
              ${group.items.map(renderSkillRow).join("")}
            </div>
          </div>
        `
      )
      .join("");
  }

  async function addSkill() {
    const categorySelect = document.getElementById("skillCategorySelect");
    const skillSelect = document.getElementById("skillNameSelect");
    const customInput = document.getElementById("skillCustomName");
    const ratingInput = document.getElementById("skillRatingInput");
    const noteInput = document.getElementById("skillNoteInput");

    const category = categorySelect?.value || "";
    const isCustom = skillSelect?.value === CUSTOM_SKILL_VALUE;
    const skill = (isCustom ? customInput?.value : skillSelect?.value)?.trim() || "";
    const rating = Number(ratingInput?.getAttribute("data-rating") || 0);
    const note = noteInput?.value.trim() || "";

    if (!category) {
      Seav.notify("error", "Missing details", "Choose a category first.");
      return;
    }
    if (!skill) {
      Seav.notify(
        "error",
        "Missing details",
        isCustom ? "Type the name of the skill or training." : "Choose a skill first."
      );
      return;
    }
    if (!rating) {
      Seav.notify("error", "Missing rating", "Tap a star to set your level before adding.");
      return;
    }
    if (!note) {
      Seav.notify(
        "error",
        "Missing explanation",
        "Briefly explain how you know this skill before adding it."
      );
      return;
    }

    // Catalog picks can't collide (already filtered out of the dropdown by
    // populateSkillNameOptions), but a typed custom name can -- check
    // client-side for a friendly message instead of surfacing the DB's
    // unique(user_id, category, skill) constraint error.
    const alreadyAdded = getSkillEntries().some(
      (item) => item.category === category && item.skill.toLowerCase() === skill.toLowerCase()
    );
    if (alreadyAdded) {
      Seav.notify("error", "Already added", `${skill} is already on your skills profile.`);
      return;
    }

    await Seav.withSaving(
      async () => {
        const now = new Date().toISOString();
        await SeavAPI.upsertItemById(SKILL_STORAGE_KEY, {
          id: createId("skill"),
          category,
          skill,
          rating,
          note,
          createdAt: now,
          updatedAt: now
        });

        if (skillSelect) skillSelect.value = "";
        if (customInput) customInput.value = "";
        setSkillCustomFieldVisible(false);
        if (noteInput) noteInput.value = "";
        renderSkillRatingInput(0);
        populateSkillNameOptions(category);

        Seav.notify("success", "Skill added", `${skill} saved to your skills profile.`);

        if (window.Seav.app?.refreshAll) {
          await window.Seav.app.refreshAll();
        } else {
          await refreshView();
        }
      },
      { sub: "Saving skill" }
    );
  }

  async function updateSkillRating(skillId, rating) {
    const entry = getSkillEntries().find((item) => item.id === skillId);
    if (!entry) return;

    await Seav.withSaving(
      async () => {
        await SeavAPI.updateItemById(SKILL_STORAGE_KEY, skillId, { ...entry, rating });

        if (window.Seav.app?.refreshAll) {
          await window.Seav.app.refreshAll();
        } else {
          await refreshView();
        }
      },
      { sub: "Updating skill rating" }
    );
  }

  async function removeSkill(skillId) {
    const entry = getSkillEntries().find((item) => item.id === skillId);
    if (
      !Seav.confirmDelete({
        itemName: entry?.skill || "",
        itemLabel: "skill"
      })
    ) {
      return;
    }

    await SeavAPI.deleteItemById(SKILL_STORAGE_KEY, skillId);

    if (window.Seav.app?.refreshAll) {
      await window.Seav.app.refreshAll();
    } else {
      await refreshView();
    }
  }

  function initSkillsSection() {
    if (!document.getElementById("skillGroupsList")) return;

    populateSkillCategoryOptions();
    renderSkillRatingInput(0);

    const categorySelect = document.getElementById("skillCategorySelect");
    if (categorySelect) {
      categorySelect.addEventListener("change", () => {
        populateSkillNameOptions(categorySelect.value);
        renderSkillRatingInput(0);
      });
    }

    const skillSelect = document.getElementById("skillNameSelect");
    if (skillSelect) {
      skillSelect.addEventListener("change", () => {
        setSkillCustomFieldVisible(skillSelect.value === CUSTOM_SKILL_VALUE);
      });
    }

    const addBtn = document.getElementById("addSkillBtn");
    if (addBtn) {
      addBtn.addEventListener("click", (e) => {
        e.preventDefault();
        addSkill();
      });
    }

    document.addEventListener("click", (e) => {
      const starBtn = e.target.closest(".onboard-star-btn");
      if (starBtn) {
        e.preventDefault();
        const value = Number(starBtn.getAttribute("data-star-value") || 0);
        const container = starBtn.closest(".onboard-skill-stars");
        if (!container) return;

        const skillId = container.getAttribute("data-skill-id");
        if (skillId) {
          updateSkillRating(skillId, value);
        } else if (container.id === "skillRatingInput") {
          renderSkillRatingInput(value);
        }
        return;
      }

      const removeBtn = e.target.closest("[data-remove-skill-id]");
      if (removeBtn) {
        e.preventDefault();
        removeSkill(removeBtn.getAttribute("data-remove-skill-id"));
      }
    });
  }

  async function refreshView() {
    try {
      await ensureOnboardAttachmentsHydrated();
    } catch (err) {
      console.warn("[SEA-V] Onboard attachment hydration failed:", err);
    }

    populateVesselOptions();
    populateCategoryOptions();
    renderKpis();
    renderList();

    if (document.getElementById("skillGroupsList")) {
      const categorySelect = document.getElementById("skillCategorySelect");
      populateSkillNameOptions(categorySelect?.value || "");
      renderSkillGroups();
    }
  }

  // Guards against double-initialization when this file is lazy-loaded onto
  // a page other than onboard-experience.html (see Dashboard's "Log
  // onboard experience" quick action, js/dashboard.js) -- mirrors the same
  // guard added to js/vessels.js for the equivalent Add Vessel flow.
  // Checked AFTER the DOM-readiness guard below so an early call (before
  // the modal markup has actually landed in the DOM) doesn't block a
  // later, real init.
  let onboardExperienceInited = false;

  function initOnboardExperience() {
    if (onboardExperienceInited) return;
    if (!document.getElementById("oeList") && !document.getElementById("oeForm")) {
      return;
    }
    onboardExperienceInited = true;

    populateCategoryOptions();
    initSkillsSection();

    const runRefresh = () => refreshView();

    Seav.bindStateRefresh(runRefresh, { label: "Onboard experience refresh" });

    document.querySelectorAll('[data-open="oeModal"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        openAddModal();
      });
    });

    const oeFileInput = document.getElementById("oe_file");
    const oeFileBtn = document.getElementById("oeFileBtn");
    if (oeFileBtn && oeFileInput) {
      oeFileBtn.addEventListener("click", () => oeFileInput.click());
      oeFileInput.addEventListener("change", () => {
        const file = oeFileInput.files?.[0] || null;
        if (file) {
          renderAttachmentHint({ filename: file.name }, { isNewSelection: true });
        }
      });
    }

    const photoInput = document.getElementById("oe_photos");
    const photoAddBtn = document.getElementById("oePhotoAddBtn");
    if (photoAddBtn && photoInput) {
      photoAddBtn.addEventListener("click", () => photoInput.click());
      photoInput.addEventListener("change", async () => {
        await addPhotoFiles(photoInput.files);
        photoInput.value = "";
      });
    }

    const photoRows = document.getElementById("oePhotoRows");
    if (photoRows) {
      // Typing updates the working copy without re-rendering, so focus and
      // the caret stay where they are.
      photoRows.addEventListener("input", (e) => {
        const field = e.target.getAttribute("data-oe-photo-field");
        const key = e.target.closest("[data-oe-photo-key]")?.getAttribute("data-oe-photo-key");
        const photo = editingPhotos.find((item) => item.key === key);
        if (photo && field) {
          photo[field] = e.target.value;
          e.target.classList.remove("is-invalid");
        }
      });
      photoRows.addEventListener("click", (e) => {
        const key = e.target.closest("[data-oe-photo-remove]")?.getAttribute("data-oe-photo-remove");
        if (!key) return;
        const photo = editingPhotos.find((item) => item.key === key);
        if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl);
        editingPhotos = editingPhotos.filter((item) => item.key !== key);
        renderPhotoEditor();
      });
    }

    const form = document.getElementById("oeForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = readEntryForm();
        if (!formData.vesselId || !formData.category || !formData.title || !formData.description) {
          Seav.notify(
            "error",
            "Missing details",
            "Please complete vessel, category, title, and description."
          );
          return;
        }

        // Every photo needs a label (per Jack, 2026-09-27) -- it is what an
        // employer reads under the thumbnail.
        const unlabelled = editingPhotos.find((photo) => !photo.label.trim());
        if (unlabelled) {
          const input = document.querySelector(
            `[data-oe-photo-key="${unlabelled.key}"] [data-oe-photo-field="label"]`
          );
          input?.classList.add("is-invalid");
          input?.focus();
          Seav.notify("error", "Label your photos", "Give each photo a short label before saving.");
          return;
        }

        const existing = formData.id
          ? getEntries().find((item) => item.id === formData.id) || null
          : null;

        await Seav.withSaving(async () => {
        const entryId = formData.id || createId("onboard");
        const photos = await buildPhotosForSave(entryId);
        if (!photos) return;

        // attachment is the PDF slot only. An old image attachment has
        // already been moved into photos (getEntryDocument returns null for
        // it), so saving here clears it from `attachment`.
        let attachment = await buildAttachment(
          formData.file,
          Photos ? Photos.getEntryDocument(existing) : existing?.attachment || null,
          entryId
        );
        if (formData.file && !attachment) return;
        if (attachment) {
          attachment = await hydrateAttachment(attachment);
        }

        const now = new Date().toISOString();

        await SeavAPI.upsertItemById(STORAGE_KEY, {
          id: entryId,
          vesselId: formData.vesselId,
          category: formData.category,
          title: formData.title,
          positionHeld: formData.positionHeld,
          description: formData.description,
          locationOnboard: formData.locationOnboard,
          dateFrom: formData.dateFrom,
          dateTo: formData.dateTo,
          hours: formData.hours,
          isFamiliarisation: formData.isFamiliarisation,
          attachment,
          photos,
          createdAt: existing?.createdAt || now,
          updatedAt: now
        });

        form.reset();
        document.getElementById("oe_edit_id").value = "";
        Seav.clearDateTriplet("oe_date_from");
        Seav.clearDateTriplet("oe_date_to");
        setEditingPhotos(null);
        if (window.SeavModals?.closeAllModals) window.SeavModals.closeAllModals();

        Seav.notify(
          "success",
          "Experience logged",
          "Onboard work saved to your SEA-V profile."
        );

        if (window.Seav.app?.refreshAll) {
          await window.Seav.app.refreshAll();
        } else {
          await refreshView();
        }
        }, { sub: "Saving onboard experience" });
      });
    }

    document.addEventListener("click", async (e) => {
      const toggleVesselBtn = e.target.closest("[data-toggle-vessel-id]");
      if (toggleVesselBtn) {
        e.preventDefault();
        const vesselId = toggleVesselBtn.getAttribute("data-toggle-vessel-id") || "";
        const group = toggleVesselBtn.closest(".onboard-vessel-group");
        const body = group?.querySelector(".onboard-vessel-body");
        if (!group || !body) return;

        if (expandedVesselIds.has(vesselId)) {
          expandedVesselIds.delete(vesselId);
          group.classList.remove("is-expanded");
          toggleVesselBtn.setAttribute("aria-expanded", "false");
          body.setAttribute("hidden", "");
        } else {
          expandedVesselIds.add(vesselId);
          group.classList.add("is-expanded");
          toggleVesselBtn.setAttribute("aria-expanded", "true");
          body.removeAttribute("hidden");
        }
        return;
      }

      const toggleBtn = e.target.closest("[data-toggle-oe-id]");
      if (toggleBtn) {
        e.preventDefault();
        const entryId = toggleBtn.getAttribute("data-toggle-oe-id");
        const card = toggleBtn.closest(".onboard-modern-card");
        const body = card?.querySelector(".onboard-modern-body");
        if (!entryId || !card || !body) return;

        if (expandedOeIds.has(entryId)) {
          expandedOeIds.delete(entryId);
          card.classList.remove("is-expanded");
          toggleBtn.setAttribute("aria-expanded", "false");
          body.setAttribute("hidden", "");
        } else {
          expandedOeIds.add(entryId);
          card.classList.add("is-expanded");
          toggleBtn.setAttribute("aria-expanded", "true");
          body.removeAttribute("hidden");
        }
        return;
      }

      const editBtn = e.target.closest("[data-edit-oe-id]");
      if (editBtn) {
        e.preventDefault();
        const entry = getEntries().find(
          (item) => item.id === editBtn.getAttribute("data-edit-oe-id")
        );
        if (entry) openEntryModal(entry);
        return;
      }

      const delBtn = e.target.closest("[data-del-oe-id]");
      if (delBtn) {
        e.preventDefault();

        const deletedId = delBtn.getAttribute("data-del-oe-id");
        const entry = getEntries().find((item) => item.id === deletedId);

        if (
          !Seav.confirmDelete({
            itemName: entry?.title || "",
            itemLabel: "onboard experience entry"
          })
        ) {
          return;
        }

        await SeavAPI.deleteItemById(STORAGE_KEY, deletedId);
        expandedOeIds.delete(deletedId);

        if (window.Seav.app?.refreshAll) {
          await window.Seav.app.refreshAll();
        } else {
          await refreshView();
        }
      }
    });
  }

  window.SeavOnboardExperience = { initOnboardExperience, openAddModal };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initOnboardExperience);
  } else {
    initOnboardExperience();
  }
})();
