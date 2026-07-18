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
    formatDatePretty,
    ONBOARD_EXPERIENCE_CATEGORIES,
    getOnboardCategoryLabel
  } = window.SeavData;

  const STORAGE_KEY = KEYS.ONBOARD_EXPERIENCES;
  const OE_FILE_BUCKET =
    window.SeavApiCore?.STORAGE_BUCKETS?.ONBOARD_EXPERIENCE_FILES ||
    "onboard-experience-files";
  const expandedOeIds = new Set();
  const expandedVesselIds = new Set();

  function getEntries() {
    return window.SeavState?.onboardExperiences || [];
  }

  function getVessels() {
    return window.SeavState?.vessels || [];
  }

  function maskCoc(coc) {
    const raw = String(coc || "").trim();
    if (!raw) return "—";
    if (raw.length <= 4) return raw;
    return `${"*".repeat(Math.max(0, raw.length - 4))}${raw.slice(-4)}`;
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
  }

  function renderKpis() {
    const row = document.getElementById("oeKpiRow");
    if (!row) return;

    const entries = getEntries();
    const signed = entries.filter((e) => e.status === "Signed Off").length;
    const pending = entries.filter(
      (e) => e.status === "Pending Sign-off" || e.status === "Draft"
    ).length;
    const familiar = entries.filter((e) => e.isFamiliarisation).length;

    row.innerHTML = `
      <div class="onboard-kpi-box">
        <div class="kpi-num">${entries.length}</div>
        <div class="kpi-label">Total logged</div>
      </div>
      <div class="onboard-kpi-box">
        <div class="kpi-num">${signed}</div>
        <div class="kpi-label">Signed off</div>
      </div>
      <div class="onboard-kpi-box">
        <div class="kpi-num">${pending}</div>
        <div class="kpi-label">Awaiting sign-off</div>
      </div>
      <div class="onboard-kpi-box">
        <div class="kpi-num">${familiar}</div>
        <div class="kpi-label">Familiarisations</div>
      </div>
    `;
  }

  function getStatusDisplay(status) {
    const map = {
      Draft: { label: "Draft", className: "pill-neutral" },
      "Pending Sign-off": { label: "Pending sign-off", className: "pill-pending" },
      "Signed Off": { label: "Signed off", className: "pill-valid" },
      Declined: { label: "Declined", className: "pill-expired" }
    };
    return map[status] || { label: status || "Draft", className: "pill-neutral" };
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

    await window.SeavApiCore.hydrateItemsFileField(entries, "attachment", OE_FILE_BUCKET);
    window.SeavState?.syncCache?.();
    return true;
  }

  function isImageAttachment(attachment, url) {
    const mime = String(attachment?.mime || attachment?.mimetype || "").toLowerCase();
    const name = String(attachment?.filename || attachment?.name || url || "").toLowerCase();
    if (mime.startsWith("image/")) return true;
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
  }

  function renderAttachmentSection(attachment) {
    if (!hasAttachment(attachment)) return "";

    const fileUrl = getAttachmentUrl(attachment);
    if (!fileUrl) {
      return `
        <div class="onboard-attachment-section">
          <div class="onboard-signoff-label">Photo</div>
          <div class="onboard-attachment-preview onboard-attachment-preview--loading muted">
            Loading photo…
          </div>
        </div>
      `;
    }

    const filename = attachment?.filename || attachment?.name || "Attachment";
    const safeUrl = Seav.escapeHtml(fileUrl);
    const safeName = Seav.escapeHtml(filename);

    if (isImageAttachment(attachment, fileUrl)) {
      return `
        <div class="onboard-attachment-section">
          <div class="onboard-signoff-label">Photo</div>
          <div class="onboard-attachment-preview">
            <img
              class="onboard-attachment-image"
              src="${safeUrl}"
              alt="${safeName}"
              loading="lazy"
            />
          </div>
          <a class="onboard-attachment-link" href="${safeUrl}" target="_blank" rel="noopener">
            Open full size
          </a>
        </div>
      `;
    }

    return `
      <div class="onboard-attachment-section onboard-attachment-section--file">
        <div class="onboard-signoff-label">Attachment</div>
        <a class="onboard-attachment-link" href="${safeUrl}" target="_blank" rel="noopener">
          Download ${safeName}
        </a>
      </div>
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
        const pendingCount = sorted.filter(
          (e) => e.status === "Pending Sign-off" || e.status === "Draft" || !e.status
        ).length;
        const signedCount = sorted.filter((e) => e.status === "Signed Off").length;

        return {
          vesselId,
          vesselName: vessel?.name || (vesselId ? "Unknown vessel" : "No vessel linked"),
          entries: sorted,
          latestTime,
          pendingCount,
          signedCount
        };
      })
      .sort((a, b) => b.latestTime - a.latestTime);
  }

  function renderEntryCard(entry) {
    const entryId = entry.id || "";
    const categoryLabel = getOnboardCategoryLabel(entry.category);
    const status = entry.status || "Draft";
    const statusInfo = getStatusDisplay(status);
    const signoff = entry.signoff || {};
    const attachmentHtml = renderAttachmentSection(entry.attachment);

        const signoffHtml =
          status === "Signed Off"
            ? `
          <div class="onboard-signoff-grid">
            <div class="onboard-signoff-panel">
              <div class="onboard-signoff-label">Signed off by</div>
              <div class="onboard-signoff-value">
                ${Seav.escapeHtml(signoff.signatoryName || signoff.signatureName || "—")}<br>
                Rank: ${Seav.escapeHtml(signoff.signatoryRank || "—")}
              </div>
            </div>
            <div class="onboard-signoff-panel">
              <div class="onboard-signoff-label">Certification</div>
              <div class="onboard-signoff-value">
                CoC: ${Seav.escapeHtml(maskCoc(signoff.cocNumber))}<br>
                Signed: ${Seav.escapeHtml(signoff.signedAt || "—")}
              </div>
            </div>
            ${
              signoff.note
                ? `
            <div class="onboard-signoff-panel onboard-signoff-panel-full">
              <div class="onboard-signoff-label">Sign-off note</div>
              <div class="onboard-signoff-value onboard-signoff-quote">
                “${Seav.escapeHtml(signoff.note)}”
              </div>
            </div>
            `
                : ""
            }
          </div>
        `
            : "";

        const canSignoff =
          status === "Draft" || status === "Pending Sign-off" || !status;

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
                <h3 class="onboard-modern-name">${Seav.escapeHtml(entry.title || "Untitled")}</h3>
                ${familiarisationHtml}
              </div>
              <div class="onboard-modern-summary-right">
                <span class="onboard-status-pill ${statusInfo.className}">
                  ${Seav.escapeHtml(statusInfo.label)}
                </span>
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

              ${attachmentHtml}

              ${signoffHtml}

              ${Seav.seavActions(
                `${
                  canSignoff
                    ? Seav.seavAction(
                        "secondary",
                        "Senior sign-off",
                        `data-signoff-oe-id="${Seav.escapeHtml(entryId)}"`
                      )
                    : ""
                }${Seav.seavAction(
                  "edit",
                  "Edit",
                  `data-edit-oe-id="${Seav.escapeHtml(entryId)}"`
                )}${
                  status === "Draft"
                    ? Seav.seavAction(
                        "secondary",
                        "Request sign-off",
                        `data-pending-oe-id="${Seav.escapeHtml(entryId)}"`
                      )
                    : ""
                }${Seav.seavAction(
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
    if (group.pendingCount) statusMetaParts.push(`${group.pendingCount} awaiting sign-off`);
    if (group.signedCount) statusMetaParts.push(`${group.signedCount} signed off`);

    return `
      <article class="onboard-vessel-group ui-card ui-accent-coral${isExpanded ? " is-expanded" : ""}" data-vessel-group-id="${Seav.escapeHtml(group.vesselId)}">

        <button
          type="button"
          class="onboard-vessel-summary"
          aria-expanded="${isExpanded ? "true" : "false"}"
          data-toggle-vessel-id="${Seav.escapeHtml(group.vesselId)}"
        >
          <div class="onboard-vessel-summary-left">
            <h3 class="onboard-vessel-name">${Seav.escapeHtml(group.vesselName)}</h3>
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
    document.getElementById("oe_status").value = entry?.status || "Draft";
    document.getElementById("oe_familiarisation").checked = !!entry?.isFamiliarisation;
    document.getElementById("oe_title").value = entry?.title || "";
    document.getElementById("oe_description").value = entry?.description || "";
    document.getElementById("oe_location").value = entry?.locationOnboard || "";
    document.getElementById("oe_hours").value =
      entry?.hours != null && entry.hours !== "" ? String(entry.hours) : "";
    Seav.setDateTriplet("oe_date_from", entry?.dateFrom || "");
    Seav.setDateTriplet("oe_date_to", entry?.dateTo || "");

    if (window.SeavModals?.openModal) window.SeavModals.openModal("oeModal");
  }

  function openSignoffModal(entry) {
    const signoff = entry.signoff || {};

    document.getElementById("oe_signoff_id").value = entry.id || "";
    document.getElementById("oe_so_confirmed").checked = !!signoff.confirmed;
    document.getElementById("oe_so_name").value = signoff.signatoryName || "";
    document.getElementById("oe_so_rank").value = signoff.signatoryRank || "";
    document.getElementById("oe_so_email").value = signoff.signatoryEmail || "";
    document.getElementById("oe_so_coc").value = signoff.cocNumber || "";
    document.getElementById("oe_so_signature").value = signoff.signatureName || "";
    Seav.setDateTriplet("oe_so_signed_at", signoff.signedAt || "");
    document.getElementById("oe_so_note").value = signoff.note || "";

    if (window.SeavModals?.openModal) window.SeavModals.openModal("oeSignoffModal");
  }

  function readEntryForm() {
    return {
      id: document.getElementById("oe_edit_id")?.value || "",
      vesselId: document.getElementById("oe_vessel")?.value || "",
      category: document.getElementById("oe_category")?.value || "",
      status: document.getElementById("oe_status")?.value || "Draft",
      isFamiliarisation: !!document.getElementById("oe_familiarisation")?.checked,
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
  }

  function initOnboardExperience() {
    if (
      !document.getElementById("oeList") &&
      !document.getElementById("oeForm") &&
      !document.getElementById("oeSignoffForm")
    ) {
      return;
    }

    populateCategoryOptions();

    const runRefresh = () => refreshView();

    Seav.bindStateRefresh(runRefresh, { label: "Onboard experience refresh" });

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

        const existing = formData.id
          ? getEntries().find((item) => item.id === formData.id) || null
          : null;

        await Seav.withSaving(async () => {
        const entryId = formData.id || createId("onboard");
        let attachment = await buildAttachment(
          formData.file,
          existing?.attachment || null,
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
          description: formData.description,
          locationOnboard: formData.locationOnboard,
          dateFrom: formData.dateFrom,
          dateTo: formData.dateTo,
          hours: formData.hours,
          isFamiliarisation: formData.isFamiliarisation,
          status: formData.status,
          signoff: existing?.signoff || {
            confirmed: false,
            note: "",
            signatoryName: "",
            signatoryRank: "",
            signatoryEmail: "",
            cocNumber: "",
            signatureName: "",
            signedAt: ""
          },
          attachment,
          createdAt: existing?.createdAt || now,
          updatedAt: now
        });

        form.reset();
        document.getElementById("oe_edit_id").value = "";
        Seav.clearDateTriplet("oe_date_from");
        Seav.clearDateTriplet("oe_date_to");
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

    const signoffForm = document.getElementById("oeSignoffForm");
    if (signoffForm) {
      signoffForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const entryId = document.getElementById("oe_signoff_id")?.value || "";
        const entry = getEntries().find((item) => item.id === entryId);
        if (!entry) return;

        const confirmed = !!document.getElementById("oe_so_confirmed")?.checked;

        await Seav.withSaving(async () => {
        const updated = {
          ...entry,
          signoff: {
            confirmed,
            note: document.getElementById("oe_so_note")?.value.trim() || "",
            signatoryName: document.getElementById("oe_so_name")?.value.trim() || "",
            signatoryRank: document.getElementById("oe_so_rank")?.value.trim() || "",
            signatoryEmail: document.getElementById("oe_so_email")?.value.trim() || "",
            cocNumber: document.getElementById("oe_so_coc")?.value.trim() || "",
            signatureName: document.getElementById("oe_so_signature")?.value.trim() || "",
            signedAt: Seav.readDateTriplet("oe_so_signed_at")
          },
          status: confirmed ? "Signed Off" : "Declined"
        };

        await SeavAPI.updateItemById(STORAGE_KEY, entryId, updated);

        signoffForm.reset();
        if (window.SeavModals?.closeAllModals) window.SeavModals.closeAllModals();

        Seav.notify(
          "success",
          "Sign-off recorded",
          confirmed
            ? "Senior crew confirmation saved to this entry."
            : "Sign-off status updated on this entry."
        );

        if (window.Seav.app?.refreshAll) {
          await window.Seav.app.refreshAll();
        } else {
          await refreshView();
        }
        }, { sub: "Recording senior sign-off" });
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

      const signoffBtn = e.target.closest("[data-signoff-oe-id]");
      if (signoffBtn) {
        e.preventDefault();
        const entry = getEntries().find(
          (item) => item.id === signoffBtn.getAttribute("data-signoff-oe-id")
        );
        if (entry) openSignoffModal(entry);
        return;
      }

      const pendingBtn = e.target.closest("[data-pending-oe-id]");
      if (pendingBtn) {
        e.preventDefault();
        const entryId = pendingBtn.getAttribute("data-pending-oe-id");
        const entry = getEntries().find((item) => item.id === entryId);
        if (!entry) return;

        await SeavAPI.updateItemById(STORAGE_KEY, entryId, {
          ...entry,
          status: "Pending Sign-off"
        });

        if (window.Seav.app?.refreshAll) {
          await window.Seav.app.refreshAll();
        } else {
          await refreshView();
        }
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

  document.addEventListener("DOMContentLoaded", initOnboardExperience);
})();
