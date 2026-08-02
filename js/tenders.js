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
  getSortedVesselOptions,
  getVesselColor
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

  // Linking a vessel is optional here, so zero vessels doesn't block the
  // form -- just note it, since the "leave blank" option alone can read
  // like something's missing rather than like a deliberate choice.
  const note = document.getElementById("tdNoVesselNote");
  if (note) note.hidden = vessels.length > 0;
}

function getVesselNameForTender(tender) {
  if (!tender?.vesselId) return "Standalone / Chase";

  const vessel = getVessels().find((item) => item.id === tender.vesselId);
  return vessel?.name || "Unknown Vessel";
}

// Buckets tenders by their linked vessel so the Tenders page can render a
// collapsible group per vessel (same shape as Navigation's vessel-grouped
// passage log — see js/navigation-list.js buildVesselGroups). Tenders with
// no vesselId fall into a "Standalone / Chase" bucket, sorted last since it
// isn't a real vessel. Real vessel groups are ordered to match the vessel
// dropdown (getSortedVesselOptions — most recently active vessel first) so
// group order stays consistent with the rest of the app.
function buildTenderVesselGroups(tenders) {
  const groups = new Map();

  tenders.forEach((tender) => {
    const key = tender.vesselId || "";
    if (!groups.has(key)) {
      groups.set(key, {
        vesselId: key,
        vesselName: getVesselNameForTender(tender),
        // Same vessel-identity colour used on the Navigation page's passage
        // log and map legend (js/seav-data.js getVesselColor) — kept
        // consistent here so a vessel's colour matches everywhere it shows
        // up in a vessel dropdown/grouping across the app.
        vesselColor: key ? getVesselColor(key, getVessels()) : "",
        tenders: []
      });
    }
    groups.get(key).tenders.push(tender);
  });

  const vesselOrder = getSortedVesselOptions(getVessels()).map((v) => v.id);

  return [...groups.values()].sort((a, b) => {
    if (!a.vesselId && !b.vesselId) return 0;
    if (!a.vesselId) return 1;
    if (!b.vesselId) return -1;

    const ai = vesselOrder.indexOf(a.vesselId);
    const bi = vesselOrder.indexOf(b.vesselId);
    return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
  });
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

  // loading="lazy" so cards further down the (often vessel-grouped, multi-
  // tender) list don't all fetch their full-size photo the instant the page
  // loads — several of these photos are multiple MB (nothing resizes/
  // compresses an image before upload today), and fetching a handful of
  // them simultaneously on a slow connection is what was causing slow loads
  // and timeouts. The onerror fallback matches the same pattern already
  // used in seav-cards.js: a photo that fails to render (e.g. a HEIC file
  // uploaded before the auto-convert fix existed) swaps to a clean text
  // fallback instead of leaving the browser's native broken-image icon on
  // screen with no explanation.
  const safeAlt = Seav.escapeHtml(tender.name || "Tender");
  const photoHtml = hasPhoto
    ? `<img src="${Seav.escapeHtml(photoUrl)}" alt="${safeAlt}" loading="lazy" decoding="async"
        onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
       <div class="vessel-photo-fallback" style="display:none;">Photo unavailable</div>`
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

  // js/core.js's bindStateRefresh reruns this page's refresh on EVERY
  // "seav:data-updated" event app-wide, and photo hydration itself dispatches
  // that event once signed URLs resolve — so without a guard, every refresh
  // (including ones with nothing to do with tenders) tears down and recreates
  // every tender card's <img>, producing a visible flash/flicker even though
  // the resulting HTML is identical. Same root cause already fixed for
  // dashboard vessel/tender photos (js/dashboard-snippets.js) and the
  // onboard-experience list (js/onboard-experience.js) — mirroring that fix
  // here. Fingerprint is taken AFTER hydration so an already-cached signed
  // URL (unchanged) still compares equal and skips the rebuild.
  let lastRenderedFingerprint = null;

  async function renderTenders() {
    const tendersGrid = document.getElementById("tendersGrid");
    if (!tendersGrid && !document.getElementById("tenderForm")) return;
    if (!tendersGrid) return;

    const tenders = getTenders();

    if (!tenders.length) {
      tendersGrid.innerHTML = `<p class="muted">No tenders added yet.</p>`;
      lastRenderedFingerprint = null;
      return;
    }

    await hydrateTenderPhotos(tenders);
    window.SeavState?.syncCache?.();

    const fingerprint = JSON.stringify(tenders);
    if (fingerprint === lastRenderedFingerprint) return;
    lastRenderedFingerprint = fingerprint;

    const groups = buildTenderVesselGroups(tenders);

    tendersGrid.innerHTML = groups
      .map((group) => {
        const tenderWord = group.tenders.length === 1 ? "tender" : "tenders";

        return `
          <details class="tender-vessel-group">
            <summary class="tender-vessel-group-summary">
              ${group.vesselColor ? `<span class="vessel-color-dot" style="background:${Seav.escapeHtml(group.vesselColor)}"></span>` : ""}
              <span class="tender-vessel-group-title">
                <strong>${Seav.escapeHtml(group.vesselName)}</strong>
                <small>${group.tenders.length} ${tenderWord}</small>
              </span>
              <span class="tender-vessel-group-count">${group.tenders.length}</span>
            </summary>
            <div class="tender-vessel-group-body">
              ${group.tenders.map((tender) => buildTenderCard(tender)).join("")}
            </div>
          </details>
        `;
      })
      .join("");
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
      kind: "Tender photo",
      maxBytes: window.SeavUpload?.PHOTO_MAX_BYTES
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
      // Same HEIC guard as Profile/Vessels: a raw createObjectURL() on a
      // HEIC file can't be decoded by Chrome/Firefox/Edge, so route through
      // SeavUpload.buildPreviewUrl (the same conversion Save uses) instead
      // of showing a blank/broken thumbnail the instant it's picked.
      tdPhotoInput.addEventListener("change", async () => {
        const file = tdPhotoInput.files?.[0] || null;
        if (!file) return;

        if (!window.SeavUpload?.isHeicFile?.(file)) {
          renderTenderPhotoThumb({ dataUrl: URL.createObjectURL(file) }, { isNewSelection: true });
          return;
        }

        const hint = document.getElementById("tdPhotoHint");
        if (hint) hint.textContent = "Converting HEIC photo for preview…";
        const url = await window.SeavUpload.buildPreviewUrl(file);
        if (tdPhotoInput.files?.[0] !== file) return; // selection changed mid-conversion

        if (url) {
          renderTenderPhotoThumb({ dataUrl: url }, { isNewSelection: true });
        } else if (hint) {
          hint.textContent =
            "HEIC photo selected — preview unavailable, but Save will still try to convert it. If that fails, switch your camera to JPEG (\"Most Compatible\") and re-upload.";
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