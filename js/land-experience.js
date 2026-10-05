// /js/land-experience.js
// Land-Based Experience (v572, Jack 2026-10-05): work ashore that crosses
// over to yachting, each role tagged with up to 4 qualities from
// SeavData.CREW_QUALITIES. Same shape as js/specialist-qualifications.js;
// the optional reference letter is private (no anon grant).
(function () {
  "use strict";

  if (!window.Seav || !window.SeavAPI || !window.SeavData || !window.SeavState) {
    console.warn("[SEA-V] Land-based experience dependencies missing.");
    return;
  }

  const { KEYS, createId, formatDatePretty } = window.SeavData;

  const STORAGE_KEY = KEYS.LAND_EXPERIENCES;
  const LE_FILE_BUCKET =
    window.SeavApiCore?.STORAGE_BUCKETS?.LAND_EXPERIENCE_FILES || "land-experience-files";
  const expandedIds = new Set();

  function getEntries() {
    return window.SeavState?.landExperiences || [];
  }

  function hasAttachment(attachment) {
    return (
      window.SeavApiCore?.hasStoredFile?.(attachment) ??
      !!(attachment?.url || attachment?.dataUrl || attachment?.path)
    );
  }

  function getAttachmentUrl(attachment) {
    return Seav.getFileDisplayUrl(attachment, LE_FILE_BUCKET);
  }

  async function ensureAttachmentsHydrated() {
    const entries = getEntries();
    if (!entries.length || !window.SeavApiCore?.hydrateItemsFileField) return;
    await window.SeavApiCore.hydrateItemsFileField(entries, "attachment", LE_FILE_BUCKET);
    window.SeavState?.syncCache?.();
  }

  function yearsBetween(from, to) {
    const start = window.SeavData.parseDateOnly?.(from) || (from ? new Date(from) : null);
    const end = to ? window.SeavData.parseDateOnly?.(to) || new Date(to) : new Date();
    if (!start || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return "";
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    if (months < 12) return `${Math.max(1, months)} month${months === 1 ? "" : "s"}`;
    const years = Math.floor(months / 12);
    return `${years} year${years === 1 ? "" : "s"}`;
  }

  function dateRangeText(entry) {
    const from = entry.dateFrom ? formatDatePretty(entry.dateFrom) : "";
    const to = entry.isCurrent ? "Present" : entry.dateTo ? formatDatePretty(entry.dateTo) : "";
    const span = entry.dateFrom ? yearsBetween(entry.dateFrom, entry.isCurrent ? "" : entry.dateTo) : "";
    return [from && to ? `${from} – ${to}` : from || to, span].filter(Boolean).join(" · ");
  }

  function renderKpis() {
    const row = document.getElementById("leKpiRow");
    if (!row) return;
    const entries = getEntries();
    const current = entries.filter((e) => e.isCurrent).length;
    const tagged = entries.filter((e) => (e.qualities || []).length).length;
    row.innerHTML = `
      <div class="sq-kpi-box">
        <div class="kpi-num">${entries.length}</div>
        <div class="kpi-label">Roles</div>
      </div>
      <div class="sq-kpi-box">
        <div class="kpi-num">${current}</div>
        <div class="kpi-label">Current</div>
      </div>
      <div class="sq-kpi-box">
        <div class="kpi-num">${tagged}</div>
        <div class="kpi-label">With qualities</div>
      </div>
    `;
  }

  function buildRow(entry) {
    const id = entry.id || "";
    const isExpanded = expandedIds.has(id);
    const fileUrl = getAttachmentUrl(entry.attachment);
    const hasFile = hasAttachment(entry.attachment);
    const title = [entry.role, entry.employer].filter(Boolean).join(" · ") || "Untitled role";
    const sub = [dateRangeText(entry), entry.location].filter(Boolean).join(" • ");

    return `
      <article class="sq-compact-card ui-card ui-card-hover${isExpanded ? " is-expanded" : ""}" data-le-id="${Seav.escapeHtml(id)}">
        <button type="button" class="sq-compact-summary" aria-expanded="${isExpanded ? "true" : "false"}"
          data-toggle-le-id="${Seav.escapeHtml(id)}">
          <div class="sq-compact-summary-left">
            <div class="sq-compact-title">${Seav.escapeHtml(title)}</div>
            ${sub ? `<div class="sq-compact-sub">${Seav.escapeHtml(sub)}</div>` : ""}
            ${window.SeavQualities?.tagsHtml(entry.qualities) || ""}
          </div>
          <div class="sq-compact-summary-right">
            <span class="sq-chevron" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
          </div>
        </button>

        <div class="sq-compact-body"${isExpanded ? "" : " hidden"}>
          <div class="sq-detail-grid">
            <div class="sq-detail-panel">
              <div class="sq-detail-label">Role</div>
              <div class="sq-detail-value">${Seav.escapeHtml(entry.role || "—")}<br>${Seav.escapeHtml(entry.employer || "—")}</div>
            </div>
            <div class="sq-detail-panel">
              <div class="sq-detail-label">Dates</div>
              <div class="sq-detail-value">${Seav.escapeHtml(dateRangeText(entry) || "—")}</div>
            </div>
            <div class="sq-detail-panel">
              <div class="sq-detail-label">Location</div>
              <div class="sq-detail-value">${Seav.escapeHtml(entry.location || "—")}</div>
            </div>
            <div class="sq-detail-panel">
              <div class="sq-detail-label">Reference letter (private)</div>
              <div class="sq-detail-value">
                ${
                  fileUrl
                    ? `<a class="sq-attachment-link" href="${Seav.escapeHtml(fileUrl)}" target="_blank" rel="noopener">View document</a>`
                    : hasFile
                      ? `<span class="muted">Loading document…</span>`
                      : "None uploaded"
                }
              </div>
            </div>
            ${
              entry.description
                ? `<div class="sq-detail-panel sq-detail-panel-full">
                    <div class="sq-detail-label">What you did</div>
                    <div class="sq-detail-value">${Seav.escapeHtml(entry.description)}</div>
                  </div>`
                : ""
            }
          </div>
          <div class="seav-actions seav-actions--compact">
            ${Seav.seavAction("edit", "Edit", `data-edit-land-id="${Seav.escapeHtml(id)}"`)}
            ${Seav.seavAction("delete", "Delete", `data-del-land-id="${Seav.escapeHtml(id)}"`)}
          </div>
        </div>
      </article>
    `;
  }

  function renderList() {
    const list = document.getElementById("leList");
    if (!list) return;
    // Current roles first, then most recent start date.
    const entries = [...getEntries()].sort((a, b) => {
      if (!!b.isCurrent !== !!a.isCurrent) return b.isCurrent ? 1 : -1;
      return String(b.dateFrom || "").localeCompare(String(a.dateFrom || ""));
    });
    if (!entries.length) {
      list.innerHTML = `
        <div class="list-row">
          <div>
            <div class="list-title">No land-based roles yet</div>
            <div class="list-sub">Hospitality, trades, outdoor work, teaching, care — anything ashore that shows how you work.</div>
          </div>
        </div>`;
      return;
    }
    list.innerHTML = entries.map(buildRow).join("");
  }

  function renderAttachmentHint(meta, { isNewSelection = false } = {}) {
    const hint = document.getElementById("leFileHint");
    const btn = document.getElementById("leFileBtn");
    if (isNewSelection) {
      if (hint) hint.textContent = `New file selected: ${meta?.filename || "file"} — click Save role to apply`;
      if (btn) btn.textContent = "Change file";
      return;
    }
    const url = meta ? getAttachmentUrl(meta) : "";
    if (hint) hint.textContent = url ? `Current file: ${meta?.filename || "uploaded"}` : "No file uploaded yet";
    if (btn) btn.textContent = url ? "Change file" : "Choose file";
  }

  function syncCurrent() {
    const current = !!document.getElementById("le_current")?.checked;
    const wrap = document.getElementById("le_to_wrap");
    if (wrap) wrap.hidden = current;
  }

  function readForm() {
    const isCurrent = !!document.getElementById("le_current")?.checked;
    return {
      id: document.getElementById("le_edit_id")?.value.trim() || "",
      role: document.getElementById("le_role")?.value.trim() || "",
      employer: document.getElementById("le_employer")?.value.trim() || "",
      location: document.getElementById("le_location")?.value.trim() || "",
      dateFrom: Seav.readDateTriplet("le_date_from"),
      dateTo: isCurrent ? "" : Seav.readDateTriplet("le_date_to"),
      isCurrent,
      description: document.getElementById("le_description")?.value.trim() || "",
      qualities: window.SeavQualities?.readPicker(document.getElementById("leQualities")) || [],
      file: document.getElementById("le_file")?.files?.[0] || null
    };
  }

  function fillForm(entry) {
    document.getElementById("le_edit_id").value = entry?.id || "";
    document.getElementById("le_role").value = entry?.role || "";
    document.getElementById("le_employer").value = entry?.employer || "";
    document.getElementById("le_location").value = entry?.location || "";
    document.getElementById("le_description").value = entry?.description || "";
    document.getElementById("le_current").checked = !!entry?.isCurrent;
    Seav.fillDateTriplet("le_date_from", entry?.dateFrom || "");
    Seav.fillDateTriplet("le_date_to", entry?.dateTo || "");
    const fileInput = document.getElementById("le_file");
    if (fileInput) fileInput.value = "";
    renderAttachmentHint(entry?.attachment || null);
    window.SeavQualities?.mountPicker(document.getElementById("leQualities"), entry?.qualities || []);
    syncCurrent();
  }

  async function refreshView() {
    try {
      await ensureAttachmentsHydrated();
    } catch (err) {
      console.warn("[SEA-V] Land-based experience hydration failed:", err);
    }
    renderKpis();
    window.SeavQualities?.renderStateSummary(document.getElementById("leQualitiesSummary"));
    renderList();
  }

  function initLandExperience() {
    if (!document.getElementById("leList") && !document.getElementById("leForm")) return;

    Seav.bindStateRefresh(() => refreshView(), { label: "Land-based experience refresh" });

    document.getElementById("le_current")?.addEventListener("change", syncCurrent);

    const fileInput = document.getElementById("le_file");
    const fileBtn = document.getElementById("leFileBtn");
    if (fileBtn && fileInput) {
      fileBtn.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", () => {
        const file = fileInput.files?.[0] || null;
        if (file) renderAttachmentHint({ filename: file.name }, { isNewSelection: true });
      });
    }

    const form = document.getElementById("leForm");
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = readForm();
      if (!formData.role) {
        Seav.notify("error", "Missing details", "Add the role you held.");
        return;
      }
      if (formData.dateFrom && formData.dateTo && formData.dateTo < formData.dateFrom) {
        Seav.notify("error", "Invalid dates", "The finish date must be on or after the start date.");
        return;
      }

      const existing = formData.id ? getEntries().find((item) => item.id === formData.id) || null : null;

      await Seav.withSaving(async () => {
        const entryId = formData.id || createId("land");
        const attachment =
          (await window.SeavUpload?.uploadToStorage({
            bucket: LE_FILE_BUCKET,
            entityId: entryId,
            file: formData.file,
            existingMeta: existing?.attachment || null,
            kind: "Reference letter"
          })) ?? existing?.attachment ?? null;
        if (formData.file && !attachment) return;

        const now = new Date().toISOString();
        await SeavAPI.upsertItemById(STORAGE_KEY, {
          id: entryId,
          role: formData.role,
          employer: formData.employer,
          location: formData.location,
          dateFrom: formData.dateFrom,
          dateTo: formData.dateTo,
          isCurrent: formData.isCurrent,
          description: formData.description,
          qualities: formData.qualities,
          attachment,
          createdAt: existing?.createdAt || now,
          updatedAt: now
        });

        form.reset();
        document.getElementById("le_edit_id").value = "";
        Seav.clearDateTriplet("le_date_from");
        Seav.clearDateTriplet("le_date_to");
        if (window.SeavModals?.closeAllModals) window.SeavModals.closeAllModals();
        Seav.notify("success", "Role saved", "Saved to your SEA-V profile.");

        if (window.Seav.app?.refreshAll) await window.Seav.app.refreshAll();
        else await refreshView();
      }, { sub: "Saving land-based role" });
    });

    document.addEventListener("click", async (e) => {
      const toggle = e.target.closest("[data-toggle-le-id]");
      if (toggle) {
        const id = toggle.getAttribute("data-toggle-le-id");
        if (expandedIds.has(id)) expandedIds.delete(id);
        else expandedIds.add(id);
        renderList();
        return;
      }

      const editBtn = e.target.closest("[data-edit-land-id]");
      if (editBtn) {
        const item = getEntries().find((entry) => entry.id === editBtn.getAttribute("data-edit-land-id"));
        if (!item) return;
        fillForm(item);
        Seav.mountDateFields();
        if (window.SeavModals?.openModal) window.SeavModals.openModal("leModal");
        return;
      }

      const delBtn = e.target.closest("[data-del-land-id]");
      if (delBtn) {
        const id = delBtn.getAttribute("data-del-land-id");
        const item = getEntries().find((entry) => entry.id === id);
        if (!item) return;
        const confirmed = await Seav.confirmDelete({
          itemLabel: "role",
          itemName: [item.role, item.employer].filter(Boolean).join(" at ") || "this role"
        });
        if (!confirmed) return;
        try {
          await SeavAPI.deleteItemById(STORAGE_KEY, id, { throwOnError: true });
        } catch {
          return; // SeavAPI has already shown "Delete failed".
        }
        expandedIds.delete(id);
        Seav.notify("success", "Deleted", "Role removed from your profile.");
        if (window.Seav.app?.refreshAll) await window.Seav.app.refreshAll();
        else await refreshView();
      }
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest('[data-open="leModal"]')) return;
      fillForm(null);
      Seav.mountDateFields();
    });
  }

  document.addEventListener("DOMContentLoaded", initLandExperience);
})();
