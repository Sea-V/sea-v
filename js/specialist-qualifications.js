// /js/specialist-qualifications.js
(function () {
  "use strict";

  if (!window.Seav || !window.SeavAPI || !window.SeavData || !window.SeavState) {
    console.warn("[SEA-V] Specialist qualifications dependencies missing.");
    return;
  }

  const {
    KEYS,
    createId,
    formatDatePretty,
    SPECIALIST_QUALIFICATION_CATEGORIES,
    getSpecialistCategoryLabel
  } = window.SeavData;

  const STORAGE_KEY = KEYS.SPECIALIST_QUALIFICATIONS;
  const expandedSqIds = new Set();

  function getEntries() {
    return window.SeavState?.specialistQualifications || [];
  }

  function getStatusDisplay(status) {
    const map = {
      "Self-declared": { label: "Self-declared", className: "pill-pending" },
      Verified: { label: "Verified", className: "pill-valid" },
      Expired: { label: "Expired", className: "pill-expired" }
    };
    return map[status] || { label: status || "Self-declared", className: "pill-neutral" };
  }

  function populateCategoryOptions() {
    const select = document.getElementById("sq_category");
    if (!select) return;

    const current = select.value || "";
    select.innerHTML = `
      <option value="">Pick the type of qualification</option>
      ${SPECIALIST_QUALIFICATION_CATEGORIES.map(
        (item) =>
          `<option value="${Seav.escapeHtml(item.value)}">${Seav.escapeHtml(item.label)}</option>`
      ).join("")}
    `;
    if (current) select.value = current;
  }

  function renderKpis() {
    const row = document.getElementById("sqKpiRow");
    if (!row) return;

    const entries = getEntries();
    const verified = entries.filter((e) => e.status === "Verified").length;
    const withFile = entries.filter(
      (e) => e.attachment?.url || e.attachment?.dataUrl
    ).length;
    const categories = new Set(
      entries.map((e) => e.category).filter(Boolean)
    ).size;

    row.innerHTML = `
      <div class="sq-kpi-box">
        <div class="kpi-num">${entries.length}</div>
        <div class="kpi-label">Total logged</div>
      </div>
      <div class="sq-kpi-box">
        <div class="kpi-num">${verified}</div>
        <div class="kpi-label">Verified</div>
      </div>
      <div class="sq-kpi-box">
        <div class="kpi-num">${withFile}</div>
        <div class="kpi-label">With document</div>
      </div>
      <div class="sq-kpi-box">
        <div class="kpi-num">${categories}</div>
        <div class="kpi-label">Categories</div>
      </div>
    `;
  }

  function buildRow(entry) {
    const entryId = entry.id || "";
    const categoryLabel = getSpecialistCategoryLabel(entry.category);
    const statusInfo = getStatusDisplay(entry.status);
    const obtained = entry.dateObtained
      ? formatDatePretty(entry.dateObtained)
      : "—";
    const expiry = entry.expiry ? formatDatePretty(entry.expiry) : "No expiry";
    const fileUrl = entry.attachment?.url || entry.attachment?.dataUrl || "";
    const hasFile = !!fileUrl;
    const isExpanded = expandedSqIds.has(entryId);

    return `
      <article class="sq-compact-card ui-card ui-card-hover ui-accent-lavender${
        isExpanded ? " is-expanded" : ""
      }" data-sq-id="${Seav.escapeHtml(entryId)}">

        <button
          type="button"
          class="sq-compact-summary"
          aria-expanded="${isExpanded ? "true" : "false"}"
          data-toggle-sq-id="${Seav.escapeHtml(entryId)}"
        >
          <div class="sq-compact-summary-left">
            <div class="sq-compact-title">${Seav.escapeHtml(entry.title || "Untitled")}</div>
            <div class="sq-compact-sub">
              ${Seav.escapeHtml(categoryLabel)} • Obtained ${Seav.escapeHtml(obtained)}
            </div>
          </div>
          <div class="sq-compact-summary-right">
            <span class="sq-status-pill ${statusInfo.className}">
              ${Seav.escapeHtml(statusInfo.label)}
            </span>
            <span class="sq-chevron" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </div>
        </button>

        <div class="sq-compact-body"${isExpanded ? "" : " hidden"}>
          <div class="sq-detail-grid">
            <div class="sq-detail-panel">
              <div class="sq-detail-label">Qualification</div>
              <div class="sq-detail-value">
                ${Seav.escapeHtml(entry.title || "—")}<br>
                ${Seav.escapeHtml(entry.issuingBody || "—")}
              </div>
            </div>
            <div class="sq-detail-panel">
              <div class="sq-detail-label">Dates & status</div>
              <div class="sq-detail-value">
                Obtained: ${Seav.escapeHtml(obtained)}<br>
                Expiry: ${Seav.escapeHtml(expiry)}<br>
                ${Seav.escapeHtml(statusInfo.label)}
              </div>
            </div>
            <div class="sq-detail-panel">
              <div class="sq-detail-label">Category</div>
              <div class="sq-detail-value">${Seav.escapeHtml(categoryLabel)}</div>
            </div>
            <div class="sq-detail-panel">
              <div class="sq-detail-label">Attachment</div>
              <div class="sq-detail-value">
                ${
                  hasFile
                    ? `<a class="sq-attachment-link" href="${Seav.escapeHtml(fileUrl)}" target="_blank" rel="noopener">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M12 3v10m0 0l3.5-3.5M12 13l-3.5-3.5M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        View document
                      </a>`
                    : "No attachment uploaded"
                }
              </div>
            </div>
            ${
              entry.notes
                ? `<div class="sq-detail-panel sq-detail-panel-full">
                    <div class="sq-detail-label">Notes</div>
                    <div class="sq-detail-value">${Seav.escapeHtml(entry.notes)}</div>
                  </div>`
                : ""
            }
          </div>

          <div class="seav-actions seav-actions--compact">
            ${Seav.seavAction(
              "edit",
              "Edit",
              `data-edit-sq-id="${Seav.escapeHtml(entryId)}"`
            )}
            ${Seav.seavAction(
              "delete",
              "Delete",
              `data-del-sq-id="${Seav.escapeHtml(entryId)}"`
            )}
          </div>
        </div>
      </article>
    `;
  }

  function renderList() {
    const list = document.getElementById("sqList");
    if (!list) return;

    const entries = [...getEntries()].sort((a, b) => {
      const da = a.dateObtained ? new Date(a.dateObtained) : new Date(0);
      const db = b.dateObtained ? new Date(b.dateObtained) : new Date(0);
      return db - da;
    });

    if (!entries.length) {
      list.innerHTML = `
        <div class="list-row">
          <div>
            <div class="list-title">No specialist qualifications yet</div>
            <div class="list-sub">
              Add massage, yoga, fitness, water sports, languages, and other credentials.
            </div>
          </div>
          <span class="pill">Draft</span>
        </div>
      `;
      return;
    }

    list.innerHTML = entries.map(buildRow).join("");
  }

  function readForm() {
    return {
      id: document.getElementById("sq_edit_id")?.value.trim() || "",
      category: document.getElementById("sq_category")?.value || "",
      title: document.getElementById("sq_title")?.value.trim() || "",
      issuingBody: document.getElementById("sq_issuing_body")?.value.trim() || "",
      dateObtained: Seav.readDateTriplet("sq_date_obtained"),
      expiry: Seav.readDateTriplet("sq_expiry"),
      status: document.getElementById("sq_status")?.value || "Self-declared",
      notes: document.getElementById("sq_notes")?.value.trim() || "",
      file: document.getElementById("sq_file")?.files?.[0] || null
    };
  }

  function fillForm(entry) {
    document.getElementById("sq_edit_id").value = entry?.id || "";
    document.getElementById("sq_category").value = entry?.category || "";
    document.getElementById("sq_title").value = entry?.title || "";
    document.getElementById("sq_issuing_body").value = entry?.issuingBody || "";
    document.getElementById("sq_status").value = entry?.status || "Self-declared";
    document.getElementById("sq_notes").value = entry?.notes || "";
    Seav.setDateTriplet("sq_date_obtained", entry?.dateObtained || "");
    Seav.setDateTriplet("sq_expiry", entry?.expiry || "");
    const fileInput = document.getElementById("sq_file");
    if (fileInput) fileInput.value = "";
  }

  async function buildAttachment(file, existing, entryId) {
    return window.SeavUpload?.uploadToStorage({
      bucket: "specialist-qualification-files",
      entityId: entryId,
      file,
      existingMeta: existing,
      kind: "Qualification",
      errorHint: "Run docs/specialist-qualifications-table.sql in Supabase (storage bucket + policies)."
    }) ?? existing ?? null;
  }

  async function refreshView() {
    populateCategoryOptions();
    renderKpis();
    renderList();
  }

  function initSpecialistQualifications() {
    if (!document.getElementById("sqList") && !document.getElementById("sqForm")) {
      return;
    }

    populateCategoryOptions();

    const runRefresh = () => refreshView();

    Seav.bindStateRefresh(runRefresh, { label: "Specialist qualifications refresh" });

    const form = document.getElementById("sqForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = readForm();
        if (!formData.category || !formData.title) {
          Seav.notify(
            "error",
            "Missing details",
            "Please complete category and qualification title."
          );
          return;
        }

        const existing = formData.id
          ? getEntries().find((item) => item.id === formData.id) || null
          : null;

        await Seav.withSaving(async () => {
        const entryId = formData.id || createId("specialist");
        const attachment = await buildAttachment(
          formData.file,
          existing?.attachment || null,
          entryId
        );
        if (formData.file && !attachment) return;

        const now = new Date().toISOString();

        await SeavAPI.upsertItemById(STORAGE_KEY, {
          id: entryId,
          category: formData.category,
          title: formData.title,
          issuingBody: formData.issuingBody,
          dateObtained: formData.dateObtained,
          expiry: formData.expiry,
          status: formData.status,
          notes: formData.notes,
          attachment,
          createdAt: existing?.createdAt || now,
          updatedAt: now
        });

        form.reset();
        document.getElementById("sq_edit_id").value = "";
        Seav.clearDateTriplet("sq_date_obtained");
        Seav.clearDateTriplet("sq_expiry");
        if (window.SeavModals?.closeAllModals) window.SeavModals.closeAllModals();

        Seav.notify(
          "success",
          "Qualification saved",
          "Specialist credential saved to your SEA-V profile."
        );

        if (window.Seav.app?.refreshAll) {
          await window.Seav.app.refreshAll();
        } else {
          await refreshView();
        }
        }, { sub: "Saving specialist qualification" });
      });
    }

    document.addEventListener("click", async (e) => {
      const toggleBtn = e.target.closest("[data-toggle-sq-id]");
      if (toggleBtn) {
        const entryId = toggleBtn.getAttribute("data-toggle-sq-id");
        if (expandedSqIds.has(entryId)) {
          expandedSqIds.delete(entryId);
        } else {
          expandedSqIds.add(entryId);
        }
        renderList();
        return;
      }

      const editBtn = e.target.closest("[data-edit-sq-id]");
      if (editBtn) {
        const entryId = editBtn.getAttribute("data-edit-sq-id");
        const item = getEntries().find((entry) => entry.id === entryId);
        if (!item) return;

        fillForm(item);
        Seav.mountDateFields();
        if (window.SeavModals?.openModal) window.SeavModals.openModal("sqModal");
        return;
      }

      const delBtn = e.target.closest("[data-del-sq-id]");
      if (delBtn) {
        const entryId = delBtn.getAttribute("data-del-sq-id");
        const item = getEntries().find((entry) => entry.id === entryId);
        if (!item) return;

        const confirmed = await Seav.confirmDelete({
          itemLabel: "qualification",
          itemName: item.title || "this entry"
        });
        if (!confirmed) return;

        await SeavAPI.deleteItemById(STORAGE_KEY, entryId);
        expandedSqIds.delete(entryId);

        Seav.notify("success", "Deleted", "Qualification removed from your profile.");

        if (window.Seav.app?.refreshAll) {
          await window.Seav.app.refreshAll();
        } else {
          await refreshView();
        }
      }
    });

    document.addEventListener("click", (e) => {
      const openBtn = e.target.closest('[data-open="sqModal"]');
      if (!openBtn) return;

      fillForm(null);
      Seav.mountDateFields();
    });
  }

  document.addEventListener("DOMContentLoaded", initSpecialistQualifications);
})();
