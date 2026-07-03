// /js/hobbies-interests.js
(function () {
  "use strict";

  if (!window.Seav || !window.SeavAPI || !window.SeavData || !window.SeavState) {
    console.warn("[SEA-V] Hobbies & interests dependencies missing.");
    return;
  }

  const {
    KEYS,
    createId,
    formatDatePretty,
    HOBBIES_INTEREST_CATEGORIES,
    getHobbyInterestCategoryLabel
  } = window.SeavData;

  const STORAGE_KEY = KEYS.HOBBIES_INTERESTS;
  const MAX_PHOTOS = 6;
  const expandedHiIds = new Set();
  let editingPhotos = [];

  function getEntries() {
    return window.SeavState?.hobbiesInterests || [];
  }

  function formatDateRange(from, to) {
    if (!from && !to) return "";
    const start = from ? formatDatePretty(from) : "—";
    const end = to ? formatDatePretty(to) : "Present";
    return `${start} → ${end}`;
  }

  function getPhotoUrl(photo) {
    return photo?.url || photo?.dataUrl || "";
  }

  function populateCategoryOptions() {
    const select = document.getElementById("hi_category");
    if (!select) return;

    const current = select.value || "";
    select.innerHTML = `
      <option value="">Pick a category for this interest</option>
      ${HOBBIES_INTEREST_CATEGORIES.map(
        (item) =>
          `<option value="${Seav.escapeHtml(item.value)}">${Seav.escapeHtml(item.label)}</option>`
      ).join("")}
    `;
    if (current) select.value = current;
  }

  function renderKpis() {
    const row = document.getElementById("hiKpiRow");
    if (!row) return;

    const entries = getEntries();
    const published = entries.filter((e) => e.status === "Published").length;
    const withPhotos = entries.filter((e) => (e.photos || []).length > 0).length;
    const categories = new Set(entries.map((e) => e.category).filter(Boolean)).size;

    row.innerHTML = `
      <div class="hi-kpi-box">
        <div class="kpi-num">${entries.length}</div>
        <div class="kpi-label">Total interests</div>
      </div>
      <div class="hi-kpi-box">
        <div class="kpi-num">${published}</div>
        <div class="kpi-label">Published</div>
      </div>
      <div class="hi-kpi-box">
        <div class="kpi-num">${withPhotos}</div>
        <div class="kpi-label">With photos</div>
      </div>
      <div class="hi-kpi-box">
        <div class="kpi-num">${categories}</div>
        <div class="kpi-label">Categories</div>
      </div>
    `;
  }

  function getStatusDisplay(status) {
    const map = {
      Published: { label: "Published", className: "pill-valid" },
      Draft: { label: "Draft", className: "pill-neutral" }
    };
    return map[status] || { label: status || "Published", className: "pill-neutral" };
  }

  function renderShowcaseGrid(photos) {
    const items = (photos || []).filter((photo) => getPhotoUrl(photo));
    if (!items.length) return "";

    const gridClass =
      items.length >= 3 ? "hi-showcase-grid hi-showcase-grid--hero" : "hi-showcase-grid";

    return `
      <div class="${gridClass}">
        ${items
          .map(
            (photo) => `
              <figure class="hi-showcase-photo">
                <img src="${Seav.escapeHtml(getPhotoUrl(photo))}" alt="" loading="lazy" />
              </figure>
            `
          )
          .join("")}
      </div>
    `;
  }

  function renderList() {
    const list = document.getElementById("hiList");
    if (!list) return;

    const entries = [...getEntries()].sort((a, b) => {
      const da = a.dateFrom ? new Date(a.dateFrom) : new Date(a.updatedAt || 0);
      const db = b.dateFrom ? new Date(b.dateFrom) : new Date(b.updatedAt || 0);
      return db - da;
    });

    if (!entries.length) {
      list.innerHTML = `
        <div class="list-row">
          <div>
            <div class="list-title">No hobbies or interests yet</div>
            <div class="list-sub">Add sport, travel, music, photography, and other passions with showcase photos.</div>
          </div>
          <span class="pill">Draft</span>
        </div>
      `;
      return;
    }

    list.innerHTML = entries
      .map((entry) => {
        const entryId = entry.id || "";
        const categoryLabel = getHobbyInterestCategoryLabel(entry.category);
        const status = entry.status || "Published";
        const statusInfo = getStatusDisplay(status);
        const photos = entry.photos || [];
        const photoCount = photos.filter((photo) => getPhotoUrl(photo)).length;
        const dateRange = formatDateRange(entry.dateFrom, entry.dateTo);
        const isExpanded = expandedHiIds.has(entryId);

        const photoPill = photoCount
          ? `<span class="hi-photo-count-pill">${photoCount} photo${photoCount === 1 ? "" : "s"}</span>`
          : "";

        return `
          <article class="hi-modern-card ui-card ui-card-hover ui-accent-fuchsia${isExpanded ? " is-expanded" : ""}" data-hi-id="${Seav.escapeHtml(entryId)}">

            <button
              type="button"
              class="hi-modern-summary"
              aria-expanded="${isExpanded ? "true" : "false"}"
              data-toggle-hi-id="${Seav.escapeHtml(entryId)}"
            >
              <div class="hi-modern-summary-left">
                <h3 class="hi-modern-name">${Seav.escapeHtml(entry.title || "Untitled")}</h3>
                ${photoPill}
              </div>
              <div class="hi-modern-summary-right">
                <span class="hi-status-pill ${statusInfo.className}">
                  ${Seav.escapeHtml(statusInfo.label)}
                </span>
                <span class="hi-chevron" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </span>
              </div>
            </button>

            <div class="hi-modern-body"${isExpanded ? "" : " hidden"}>
              <div class="hi-modern-meta">${Seav.escapeHtml(categoryLabel)}</div>
              ${dateRange ? `<div class="hi-modern-meta">${Seav.escapeHtml(dateRange)}</div>` : ""}
              <div class="hi-modern-desc">${Seav.escapeHtml(entry.description || "")}</div>
              ${renderShowcaseGrid(photos)}
              ${Seav.seavActions(
                `${Seav.seavAction(
                  "edit",
                  "Edit",
                  `data-edit-hi-id="${Seav.escapeHtml(entryId)}"`
                )}${Seav.seavAction(
                  "delete",
                  "Delete",
                  `data-del-hi-id="${Seav.escapeHtml(entryId)}"`
                )}`,
                "seav-actions--compact"
              )}
            </div>
          </article>
        `;
      })
      .join("");
  }

  function updatePhotoCount() {
    const countEl = document.getElementById("hiPhotoCount");
    if (countEl) {
      countEl.textContent = `${editingPhotos.length} / ${MAX_PHOTOS}`;
    }
  }

  function renderPhotoPreview() {
    const preview = document.getElementById("hiPhotoPreview");
    if (!preview) return;

    preview.innerHTML = editingPhotos
      .map(
        (photo, index) => `
          <div class="hi-modal-photo-thumb">
            <img src="${Seav.escapeHtml(getPhotoUrl(photo))}" alt="" />
            <button type="button" class="hi-modal-photo-remove" data-remove-hi-photo="${index}" aria-label="Remove photo">&times;</button>
          </div>
        `
      )
      .join("");

    updatePhotoCount();
  }

  function openEntryModal(entry) {
    populateCategoryOptions();
    editingPhotos = [...(entry?.photos || [])].filter((photo) => getPhotoUrl(photo));

    document.getElementById("hi_edit_id").value = entry?.id || "";
    document.getElementById("hi_category").value = entry?.category || "";
    document.getElementById("hi_status").value = entry?.status || "Published";
    document.getElementById("hi_title").value = entry?.title || "";
    document.getElementById("hi_description").value = entry?.description || "";
    Seav.setDateTriplet("hi_date_from", entry?.dateFrom || "");
    Seav.setDateTriplet("hi_date_to", entry?.dateTo || "");

    const fileInput = document.getElementById("hi_photos");
    if (fileInput) fileInput.value = "";

    renderPhotoPreview();

    if (window.SeavModals?.openModal) window.SeavModals.openModal("hiModal");
  }

  function readEntryForm() {
    return {
      id: document.getElementById("hi_edit_id")?.value || "",
      category: document.getElementById("hi_category")?.value || "",
      status: document.getElementById("hi_status")?.value || "Published",
      title: document.getElementById("hi_title")?.value.trim() || "",
      description: document.getElementById("hi_description")?.value.trim() || "",
      dateFrom: Seav.readDateTriplet("hi_date_from"),
      dateTo: Seav.readDateTriplet("hi_date_to"),
      files: Array.from(document.getElementById("hi_photos")?.files || [])
    };
  }

  async function buildPhoto(file, entryId) {
    if (!file) return null;
    return window.SeavUpload?.uploadToStorage({
      bucket: "hobbies-interest-photos",
      entityId: entryId,
      file,
      existingMeta: null,
      kind: "Photo",
      errorHint: "Run docs/hobbies-interests-table.sql in Supabase (storage bucket + policies)."
    });
  }

  async function buildPhotoGallery(files, existingPhotos, entryId) {
    const kept = [...(existingPhotos || [])];

    if (!files.length) return kept;

    const remaining = MAX_PHOTOS - kept.length;
    if (remaining <= 0) {
      Seav.notify(
        "error",
        "Photo limit reached",
        `You can add up to ${MAX_PHOTOS} photos per interest.`
      );
      return kept;
    }

    const uploads = [];
    for (const file of files.slice(0, remaining)) {
      const photo = await buildPhoto(file, entryId);
      if (photo) uploads.push(photo);
    }

    if (files.length > remaining) {
      Seav.notify(
        "info",
        "Some photos skipped",
        `Only ${remaining} more photo${remaining === 1 ? "" : "s"} could be added.`
      );
    }

    return [...kept, ...uploads].slice(0, MAX_PHOTOS);
  }

  async function refreshView() {
    populateCategoryOptions();
    renderKpis();
    renderList();
  }

  function initHobbiesInterests() {
    if (
      !document.getElementById("hiList") &&
      !document.getElementById("hiForm")
    ) {
      return;
    }

    populateCategoryOptions();

    const runRefresh = () => refreshView();

    Seav.bindStateRefresh(runRefresh, { label: "Hobbies refresh" });

    document.getElementById("hiOpenModal")?.addEventListener("click", (e) => {
      e.preventDefault();
      openEntryModal(null);
    });

    const form = document.getElementById("hiForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = readEntryForm();
        if (!formData.category || !formData.title || !formData.description) {
          Seav.notify(
            "error",
            "Missing details",
            "Please complete category, title, and description."
          );
          return;
        }

        const existing = formData.id
          ? getEntries().find((item) => item.id === formData.id) || null
          : null;

        await Seav.withSaving(async () => {
          const entryId = formData.id || createId("hobby");
          const beforeCount = editingPhotos.length;
          const photos = await buildPhotoGallery(formData.files, editingPhotos, entryId);

          if (formData.files.length && photos.length === beforeCount) {
            Seav.notify(
              "error",
              "Photos not uploaded",
              "Your text can still be saved, but the photos failed to upload. Run docs/hobbies-interests-table.sql in Supabase if you have not already."
            );
          }

          const now = new Date().toISOString();

          try {
            await SeavAPI.upsertItemById(STORAGE_KEY, {
              id: entryId,
              category: formData.category,
              title: formData.title,
              description: formData.description,
              dateFrom: formData.dateFrom,
              dateTo: formData.dateTo,
              status: formData.status,
              photos,
              createdAt: existing?.createdAt || now,
              updatedAt: now
            });
          } catch (err) {
            console.error("[SEA-V] Hobby save failed:", err);
            const hint =
              /does not exist|relation|schema cache/i.test(String(err?.message || err))
                ? "Run docs/hobbies-interests-table.sql in Supabase → SQL Editor, then try again."
                : err?.message || "Something went wrong. Check the browser console (F12).";
            Seav.notify("error", "Could not save", hint);
            throw err;
          }

          editingPhotos = [];
          form.reset();
          document.getElementById("hi_edit_id").value = "";
          Seav.clearDateTriplet("hi_date_from");
          Seav.clearDateTriplet("hi_date_to");
          renderPhotoPreview();
          if (window.SeavModals?.closeAllModals) window.SeavModals.closeAllModals();

          Seav.notify("success", "Interest saved", "Hobby saved to your SEA-V profile.");

          if (window.Seav.app?.refreshAll) {
            await window.Seav.app.refreshAll();
          } else {
            await refreshView();
          }
        }, { sub: "Saving hobby or interest" });
      });
    }

    document.addEventListener("click", async (e) => {
      const removeBtn = e.target.closest("[data-remove-hi-photo]");
      if (removeBtn) {
        e.preventDefault();
        const index = Number(removeBtn.getAttribute("data-remove-hi-photo"));
        if (Number.isNaN(index)) return;
        editingPhotos.splice(index, 1);
        renderPhotoPreview();
        return;
      }

      const toggleBtn = e.target.closest("[data-toggle-hi-id]");
      if (toggleBtn) {
        e.preventDefault();
        const entryId = toggleBtn.getAttribute("data-toggle-hi-id");
        const card = toggleBtn.closest(".hi-modern-card");
        const body = card?.querySelector(".hi-modern-body");
        if (!entryId || !card || !body) return;

        if (expandedHiIds.has(entryId)) {
          expandedHiIds.delete(entryId);
          card.classList.remove("is-expanded");
          toggleBtn.setAttribute("aria-expanded", "false");
          body.setAttribute("hidden", "");
        } else {
          expandedHiIds.add(entryId);
          card.classList.add("is-expanded");
          toggleBtn.setAttribute("aria-expanded", "true");
          body.removeAttribute("hidden");
        }
        return;
      }

      const editBtn = e.target.closest("[data-edit-hi-id]");
      if (editBtn) {
        e.preventDefault();
        const entry = getEntries().find(
          (item) => item.id === editBtn.getAttribute("data-edit-hi-id")
        );
        if (entry) openEntryModal(entry);
        return;
      }

      const delBtn = e.target.closest("[data-del-hi-id]");
      if (delBtn) {
        e.preventDefault();

        const deletedId = delBtn.getAttribute("data-del-hi-id");
        const entry = getEntries().find((item) => item.id === deletedId);

        if (
          !Seav.confirmDelete({
            itemName: entry?.title || "",
            itemLabel: "hobby or interest"
          })
        ) {
          return;
        }

        await SeavAPI.deleteItemById(STORAGE_KEY, deletedId);
        expandedHiIds.delete(deletedId);

        if (window.Seav.app?.refreshAll) {
          await window.Seav.app.refreshAll();
        } else {
          await refreshView();
        }
      }
    });
  }

  document.addEventListener("DOMContentLoaded", initHobbiesInterests);
})();
