// /js/tenders.js
(function () {
  "use strict";

  if (!window.Seav) {
    console.warn("[SEA-V] Seav core not found. Did you include js/core.js before tenders.js?");
    return;
  }

  if (!window.SeavAPI) {
    console.warn("[SEA-V] SeavAPI not found. Did you include js/api.js before tenders.js?");
    return;
  }

  if (!window.SeavData) {
    console.warn("[SEA-V] SeavData not found. Did you include js/seav-data.js before tenders.js?");
    return;
  }

  if (!window.SeavState) {
    console.warn("[SEA-V] SeavState not found. Did you include js/state.js before tenders.js?");
    return;
  }

 const {
  KEYS,
  createId,
  getSortedVesselOptions
} = window.SeavData;

  const STORAGE_KEY = KEYS.TENDERS;

  function getTenders() {
    return window.SeavState?.tenders || [];
  }

  function getVessels() {
    return window.SeavState?.vessels || [];
  }

function populateTenderVesselOptions() {
  const select = document.getElementById("td_vessel");
  if (!select) return;

  const currentValue = select.value || "";

  const vessels = getSortedVesselOptions(getVessels());

  select.innerHTML = `
    <option value="">Link to parent yacht, or leave blank</option>
    ${vessels
      .map(
        (v) =>
          `<option value="${Seav.escapeHtml(v.id)}">${Seav.escapeHtml(v.name)}</option>`
      )
      .join("")}
  `;

  if (currentValue) {
    select.value = currentValue;
  }
}

function getVesselNameForTender(tender) {
  if (!tender?.vesselId) return "Standalone / Chase";

  const vessel = getVessels().find((item) => item.id === tender.vesselId);
  return vessel?.name || "Unknown Vessel";
}

  const TENDER_PHOTO_BUCKET =
    window.SeavApiCore?.STORAGE_BUCKETS?.TENDER_PHOTOS || "tender-photos";

  // Mirrors the Vessels page's photo-thumb pattern (js/vessels.js
  // renderVesselPhotoThumb) — without this, td_photo was a bare
  // <input type="file"> that gave no indication a tender already had a
  // photo, so editing one looked like the photo field was empty.
  function renderTenderPhotoThumb(photoMeta, { isNewSelection = false } = {}) {
    const thumb = document.getElementById("tdPhotoThumb");
    const hint = document.getElementById("tdPhotoHint");
    const btn = document.getElementById("tdPhotoBtn");
    if (!thumb) return;

    const photoUrl = Seav.getFileDisplayUrl(photoMeta, TENDER_PHOTO_BUCKET);

    if (photoUrl) {
      const safeUrl = String(photoUrl).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      thumb.style.backgroundImage = `url("${safeUrl}")`;
    } else {
      thumb.style.backgroundImage = "";
    }

    if (hint) {
      if (isNewSelection) {
        hint.textContent = "New photo selected — click Save tender to apply";
      } else if (photoUrl) {
        hint.textContent = "Current photo";
      } else {
        hint.textContent = "No photo uploaded yet";
      }
    }

    if (btn) {
      btn.textContent = photoUrl ? "Change photo" : "Choose photo";
    }
  }

  async function hydrateTenderPhotos(tenders) {
    if (!window.SeavApiCore?.hydrateItemsFileField) return tenders;
    return window.SeavApiCore.hydrateItemsFileField(tenders, "photo", TENDER_PHOTO_BUCKET);
  }

  function buildTenderCard(tender) {
  const tenderId = tender.id || "";
  const photoUrl = Seav.getFileDisplayUrl(
    tender.photo,
    window.SeavApiCore?.STORAGE_BUCKETS?.TENDER_PHOTOS || "tender-photos"
  );
  const hasPhoto = !!photoUrl;

  const photoHtml = hasPhoto
    ? `<img src="${Seav.escapeHtml(photoUrl)}" alt="${Seav.escapeHtml(tender.name || "Tender")}" />`
    : `<div class="vessel-photo-fallback">No Photo</div>`;

  const vesselName = getVesselNameForTender(tender);
  const proficiency = window.SeavData?.getTenderProficiencyDisplay?.(tender.proficiencyLevel);
  const proficiencyValueHtml = proficiency
    ? `<span class="pill tender-proficiency-pill ${proficiency.className}">${Seav.escapeHtml(proficiency.label)}</span>`
    : "—";

  return `
    <article class="vessel-card">
      <div class="vessel-photo">${photoHtml}</div>

      <div class="vessel-body">
        <h3 class="vessel-title vessel-title-strong">
          ${Seav.escapeHtml(tender.name || "Unnamed Tender")}
        </h3>

        <div class="vessel-meta-grid">

          <div class="vessel-meta-item">
            <span class="vessel-meta-label">Vessel</span>
            <span class="vessel-meta-value">${Seav.escapeHtml(vesselName)}</span>
          </div>

          <div class="vessel-meta-item">
            <span class="vessel-meta-label">Type</span>
            <span class="vessel-meta-value">${Seav.escapeHtml(tender.type || "—")}</span>
          </div>

          <div class="vessel-meta-item">
            <span class="vessel-meta-label">Model</span>
            <span class="vessel-meta-value">${Seav.escapeHtml(tender.model || "—")}</span>
          </div>

          <div class="vessel-meta-item">
            <span class="vessel-meta-label">Length</span>
            <span class="vessel-meta-value">${Seav.escapeHtml(tender.length || "—")}</span>
          </div>

          <div class="vessel-meta-item">
            <span class="vessel-meta-label">Engine</span>
            <span class="vessel-meta-value">${Seav.escapeHtml(tender.engine || "—")}</span>
          </div>

          <div class="vessel-meta-item">
            <span class="vessel-meta-label">Capacity</span>
            <span class="vessel-meta-value">${Seav.escapeHtml(tender.capacity || "—")}</span>
          </div>

          <div class="vessel-meta-item">
            <span class="vessel-meta-label">Registration</span>
            <span class="vessel-meta-value">${Seav.escapeHtml(tender.reg || "—")}</span>
          </div>

          <div class="vessel-meta-item">
            <span class="vessel-meta-label">Proficiency</span>
            <span class="vessel-meta-value">${proficiencyValueHtml}</span>
          </div>

        </div>

        ${
          tender.desc
            ? `<div class="vessel-desc vessel-desc-soft">${Seav.escapeHtml(tender.desc)}</div>`
            : ``
        }

        ${Seav.seavActions(
          `${Seav.seavAction(
            "edit",
            "Edit",
            `data-edit-tender-id="${Seav.escapeHtml(tenderId)}"`
          )}${Seav.seavAction(
            "delete",
            "Delete",
            `data-del-tender-id="${Seav.escapeHtml(tenderId)}"`
          )}`,
          "seav-actions--compact"
        )}
      </div>
    </article>
  `;
}

  async function renderTenders() {
    const tendersGrid = document.getElementById("tendersGrid");
    if (!tendersGrid && !document.getElementById("tenderForm")) return;
    if (!tendersGrid) return;

    const tenders = getTenders();

    if (!tenders.length) {
      tendersGrid.innerHTML = `<p class="muted">No tenders added yet.</p>`;
      return;
    }

    await hydrateTenderPhotos(tenders);
    window.SeavState?.syncCache?.();

    tendersGrid.innerHTML = tenders.map((tender) => buildTenderCard(tender)).join("");
  }

  function fillTenderForm(tender) {
    document.getElementById("td_name").value = tender.name || "";
    document.getElementById("td_vessel").value = tender.vesselId || "";
    document.getElementById("td_proficiency").value = tender.proficiencyLevel || "";
    document.getElementById("td_type").value = tender.type || "";
    document.getElementById("td_model").value = tender.model || "";
    document.getElementById("td_length").value = tender.length || "";
    document.getElementById("td_engine").value = tender.engine || "";
    document.getElementById("td_capacity").value = tender.capacity || "";
    document.getElementById("td_reg").value = tender.reg || "";
    document.getElementById("td_desc").value = tender.desc || "";

    const editId = document.getElementById("td_edit_id");
    if (editId) editId.value = tender.id || "";

    renderTenderPhotoThumb(tender.photo || null, { isNewSelection: false });

    if (window.SeavModals?.openModal) {
      window.SeavModals.openModal("tenderModal");
    }
  }

  function resetTenderFormState() {
    const form = document.getElementById("tenderForm");
    if (form) form.reset();

    const editId = document.getElementById("td_edit_id");
    if (editId) editId.value = "";

    const vesselSelect = document.getElementById("td_vessel");
    if (vesselSelect) vesselSelect.value = "";

    const proficiencySelect = document.getElementById("td_proficiency");
    if (proficiencySelect) proficiencySelect.value = "";

    renderTenderPhotoThumb(null, { isNewSelection: false });
  }

function readTenderForm() {
  return {
    id: document.getElementById("td_edit_id")?.value || "",
    name: document.getElementById("td_name")?.value.trim(),
    vesselId: document.getElementById("td_vessel")?.value || "",
    proficiencyLevel: document.getElementById("td_proficiency")?.value || "",
    type: document.getElementById("td_type")?.value.trim() || "",
    model: document.getElementById("td_model")?.value.trim() || "",
    length: document.getElementById("td_length")?.value.trim() || "",
    engine: document.getElementById("td_engine")?.value.trim() || "",
    capacity: document.getElementById("td_capacity")?.value.trim() || "",
    reg: document.getElementById("td_reg")?.value.trim() || "",
    desc: document.getElementById("td_desc")?.value.trim() || "",
    file: document.getElementById("td_photo")?.files?.[0] || null
  };
}

  async function buildTenderPhoto(file, existingPhoto, tenderId) {
    return window.SeavUpload?.uploadToStorage({
      bucket: "tender-photos",
      entityId: tenderId,
      file,
      existingMeta: existingPhoto,
      kind: "Tender photo"
    }) ?? existingPhoto ?? null;
  }

  async function saveTenderData(tenderData) {
    await SeavAPI.upsertItemById(STORAGE_KEY, tenderData);
  }

  function initTenders() {
    if (
      !document.getElementById("tendersGrid") &&
      !document.getElementById("tenderForm")
    ) return;

    const runRefresh = () => {
      populateTenderVesselOptions();
      return renderTenders();
    };

    Seav.bindStateRefresh(runRefresh, { label: "Tenders refresh" });

    const tdPhotoInput = document.getElementById("td_photo");
    const tdPhotoBtn = document.getElementById("tdPhotoBtn");
    if (tdPhotoBtn && tdPhotoInput) {
      tdPhotoBtn.addEventListener("click", () => tdPhotoInput.click());
    }
    if (tdPhotoInput) {
      tdPhotoInput.addEventListener("change", () => {
        const file = tdPhotoInput.files?.[0] || null;
        if (file) {
          renderTenderPhotoThumb({ dataUrl: URL.createObjectURL(file) }, { isNewSelection: true });
        }
      });
    }

    const tenderForm = document.getElementById("tenderForm");
    if (tenderForm) {
      tenderForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = readTenderForm();
        if (!formData.name) return;

        const existingTender = formData.id
          ? getTenders().find((item) => item.id === formData.id) || null
          : null;

        await Seav.withSaving(async () => {
        const tenderId = formData.id || createId("tender");

        const photo = await buildTenderPhoto(
          formData.file,
          existingTender?.photo || null,
          tenderId
        );

        if (formData.file && !photo) return;

       const now = new Date().toISOString();

       const tenderData = {
        id: tenderId,
        name: formData.name,
        vesselId: formData.vesselId,
        type: formData.type,
        model: formData.model,
        length: formData.length,
        engine: formData.engine,
        capacity: formData.capacity,
        reg: formData.reg,
        proficiencyLevel: formData.proficiencyLevel,
        desc: formData.desc,
        photo,
        createdAt: existingTender?.createdAt || now,
        updatedAt: now
        };

        await saveTenderData(tenderData);

        resetTenderFormState();
        if (window.SeavModals?.closeAllModals) window.SeavModals.closeAllModals();

        Seav.notify("success", "Tender logged", "Added to your fleet overview.");

        if (window.Seav.app?.refreshAll) {
          await window.Seav.app.refreshAll();
        } else {
          renderTenders();
        }
        }, { sub: "Saving tender" });
      });
    }

    document.addEventListener("click", async (e) => {
      const editBtn = e.target.closest("[data-edit-tender-id]");
      if (editBtn) {
        e.preventDefault();
        populateTenderVesselOptions();
        const tenderId = editBtn.getAttribute("data-edit-tender-id");
        const tender = getTenders().find((item) => item.id === tenderId);
        if (!tender) return;
        fillTenderForm(tender);
        return;
      }

      const delBtn = e.target.closest("[data-del-tender-id]");
      if (delBtn) {
        e.preventDefault();
        const tenderId = delBtn.getAttribute("data-del-tender-id");
        const tender = getTenders().find((item) => item.id === tenderId);

        if (
          !Seav.confirmDelete({
            itemName: tender?.name || "",
            itemLabel: "tender"
          })
        ) {
          return;
        }

        await SeavAPI.deleteItemById(STORAGE_KEY, tenderId);

        if (window.Seav.app?.refreshAll) {
          await window.Seav.app.refreshAll();
        } else {
          renderTenders();
        }
      }
    });
  }

  document.addEventListener("DOMContentLoaded", initTenders);
})();