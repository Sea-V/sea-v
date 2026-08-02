// /js/vessels.js
(function () {
  "use strict";

  if (!window.Seav) {
    console.warn("[SEA-V] Seav core not found. Did you include js/core.js before vessels.js?");
    return;
  }

  if (!window.SeavAPI) {
    console.warn("[SEA-V] SeavAPI not found. Did you include js/api.js before vessels.js?");
    return;
  }

  if (!window.SeavData) {
    console.warn("[SEA-V] SeavData not found. Did you include js/seav-data.js before vessels.js?");
    return;
  }

  if (!window.SeavState) {
    console.warn("[SEA-V] SeavState not found. Did you include js/state.js before vessels.js?");
    return;
  }

  const { KEYS, createId, totalQualifyingDays, formatDatePretty, PAYSLIP_CURRENCIES } = window.SeavData;
  const STORAGE_KEY = KEYS.VESSELS;

  /**
   * Vessel salary is stored as a single free-text column (no schema change),
   * but the form now splits it into a currency dropdown + amount input.
   * New saves are written as "<CURRENCY> <amount>" so they round-trip; older
   * free-text values (no recognised currency prefix) fall back to "OTHER"
   * with the full original text preserved in the amount field.
   */
  function parseVesselSalary(raw) {
    const str = String(raw || "").trim();
    if (!str) return { currency: "GBP", amount: "" };
    const match = str.match(/^(GBP|EUR|USD|CHF|AUD|NZD)\s*(.*)$/i);
    if (match) {
      return { currency: match[1].toUpperCase(), amount: match[2].trim() };
    }
    return { currency: "OTHER", amount: str };
  }

  // Onboard duties (Safety Officer, Safety Representative, Ship Security
  // Officer, Person in Charge of Medical Care) are stored as a single
  // comma-joined text column -- same convention as profile.passportsHeld /
  // profile.visasHeld -- so no schema change is needed to add more duties
  // later. The fixed checkboxes cover the roles the REG Yacht Code names
  // as mandatory appointments on commercial yachts; anything typed into
  // "Other duty" is appended as-is.
  const DUTY_CHECKBOX_IDS = [
    "vs_duty_safety_officer",
    "vs_duty_safety_rep",
    "vs_duty_sso",
    "vs_duty_medical"
  ];

  function fillDutiesCheckboxes(dutiesString) {
    const values = String(dutiesString || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    const knownValues = new Set();
    DUTY_CHECKBOX_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const isChecked = values.includes(el.value);
      el.checked = isChecked;
      if (isChecked) knownValues.add(el.value);
    });

    const otherEl = document.getElementById("vs_duty_other");
    if (otherEl) {
      const leftover = values.filter((v) => !knownValues.has(v));
      otherEl.value = leftover.join(", ");
    }
  }

  function readDutiesString() {
    const checked = DUTY_CHECKBOX_IDS
      .map((id) => document.getElementById(id))
      .filter((el) => el?.checked)
      .map((el) => el.value);

    const other = document.getElementById("vs_duty_other")?.value.trim() || "";

    return [...checked, ...(other ? [other] : [])].join(", ");
  }

  function resetDutiesCheckboxes() {
    DUTY_CHECKBOX_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.checked = false;
    });
    const otherEl = document.getElementById("vs_duty_other");
    if (otherEl) otherEl.value = "";
  }

  function populateVesselCurrencyOptions() {
    const select = document.getElementById("vs_salary_currency");
    if (!select || !PAYSLIP_CURRENCIES) return;

    const current = select.value || "GBP";
    select.innerHTML = PAYSLIP_CURRENCIES.map(
      (item) => `<option value="${Seav.escapeHtml(item.value)}">${Seav.escapeHtml(item.label)}</option>`
    ).join("");
    select.value = current;
  }

  function getVessels() {
    return window.SeavState?.vessels || [];
  }

  function getSeatimes() {
  return window.SeavState?.seatimes || [];
}

function getTenders() {
  return window.SeavState?.tenders || [];
}

function getRefs() {
  return window.SeavState?.refs || [];
}

function buildExperienceSection(experience) {
  const text = String(experience || "").trim();

  if (!text) {
    return `
      <section class="vessel-experience-card vessel-experience-card--empty">
        <span class="vessel-panel-label">Experience onboard</span>
        <p class="vessel-experience-text">No onboard experience notes added yet.</p>
      </section>
    `;
  }

  // Always shown in full on the Current Vessel card — no read-more clamp.
  return `
    <section class="vessel-experience-card">
      <span class="vessel-panel-label">Experience onboard</span>
      <p class="vessel-experience-text">${Seav.escapeHtml(text)}</p>
    </section>
  `;
}

function buildVesselCard(v, options = {}) {
  const isCompact = !!options.compact;
  const vesselId = v.id || "";

  const photoUrl = Seav.getFileDisplayUrl(
    v.photo,
    window.SeavApiCore?.STORAGE_BUCKETS?.VESSEL_PHOTOS || "vessel-photos"
  );
  const seaUrl = Seav.getFileDisplayUrl(
    v.sea_attachment || v.seaAttachment,
    window.SeavApiCore?.STORAGE_BUCKETS?.VESSEL_DOCUMENTS || "vessel-documents"
  );

  const vesselName = Seav.escapeHtml(v.name || "Unnamed Vessel");
  const flag = v.flag ? Seav.escapeHtml(v.flag) : "—";
  const gt = v.gt ? Seav.escapeHtml(v.gt) : "—";
  const length = v.vessel_length || v.length ? Seav.escapeHtml(v.vessel_length || v.length) : "—";
  const builder = v.builder ? Seav.escapeHtml(v.builder) : "—";
  const imo = v.imo ? Seav.escapeHtml(v.imo) : "";
  const mmsi = v.mmsi ? Seav.escapeHtml(v.mmsi) : "";
  const role = v.vessel_role || v.role ? Seav.escapeHtml(v.vessel_role || v.role) : "—";
  const type = v.vessel_type || v.type ? Seav.escapeHtml(v.vessel_type || v.type) : "—";
  const program = v.program ? Seav.escapeHtml(v.program) : "—";
  const salary = v.salary ? Seav.escapeHtml(v.salary) : "—";
  const leavePackage = v.leave_package ? Seav.escapeHtml(v.leave_package) : "";
  const additionalDuties = v.additional_duties ? Seav.escapeHtml(v.additional_duties) : "";
  const experience = v.experience_onboard || v.desc || "";
  const experienceHtml = buildExperienceSection(experience);
  const from = v.from ? formatDatePretty(v.from) : "—";
  const to = v.to ? formatDatePretty(v.to) : "Present";
  const dateLine = `${from} → ${to}`;

  const photoHtml = photoUrl
    ? `<img src="${Seav.escapeHtml(photoUrl)}" alt="${vesselName}" />`
    : `<div class="vessel-photo-fallback">No Photo</div>`;

  const linkedSeatimes = getSeatimes().filter((item) => item.vesselId === v.id);
  const linkedTenders = getTenders().filter((item) => item.vesselId === v.id);
  const linkedRefs = getRefs().filter((item) => item.vesselId === v.id);

  const totalSeaDays = linkedSeatimes.reduce((sum, item) => {
    return sum + totalQualifyingDays(item);
  }, 0);

  const latestSeatimes = [...linkedSeatimes].slice(0, 3);
  const latestTenders = [...linkedTenders].slice(0, 3);
  const latestRefs = [...linkedRefs].slice(0, 3);

  if (isCompact) {
    return `
      <article class="vessel-card-compact">
        <div class="vessel-history-photo">
          ${photoHtml}
        </div>

        <div class="vessel-history-body">
          <div class="vessel-history-head">
            <span class="vessel-history-label">Previous vessel</span>
            <h3>${vesselName}</h3>
          </div>

          <div class="vessel-history-info-grid">
            <div>
              <span>Build</span>
              <strong>${builder}</strong>
            </div>

            <div>
              <span>Flag state</span>
              <strong>${flag}</strong>
            </div>

            <div>
              <span>Role</span>
              <strong>${role}</strong>
            </div>

            <div>
              <span>GT</span>
              <strong>${gt}</strong>
            </div>

            <div>
              <span>Length</span>
              <strong>${length}</strong>
            </div>

            <div>
              <span>Dates</span>
              <strong>${dateLine}</strong>
            </div>

            ${imo ? `<div><span>IMO</span><strong>${imo}</strong></div>` : ""}
            ${mmsi ? `<div><span>MMSI</span><strong>${mmsi}</strong></div>` : ""}
            ${additionalDuties ? `<div><span>Onboard duties</span><strong>${additionalDuties}</strong></div>` : ""}
          </div>

          <div class="vessel-history-counts">
            <span>Sea time ${linkedSeatimes.length}</span>
            <span>Tenders ${linkedTenders.length}</span>
            <span>References ${linkedRefs.length}</span>
          </div>

          <div class="seav-actions seav-actions--compact">
            ${Seav.seavAction(
              "edit",
              "Edit",
              `data-edit-vessel-id="${Seav.escapeHtml(vesselId)}"`
            )}
            ${Seav.seavAction(
              "delete",
              "Delete",
              `data-del-vessel-id="${Seav.escapeHtml(vesselId)}"`
            )}
          </div>
        </div>
      </article>
    `;
  }

  return `
    <article class="vessel-profile-card">

      <div class="vessel-profile-top">

        <div class="vessel-image-card">
          ${photoHtml}
        </div>

        <div class="vessel-overview-card">
          <div class="vessel-overview-head">
            <div>
              <div class="vessel-section-label">ⓘ Vessel Overview</div>
              <h2>${vesselName}</h2>
              <p>${type} • ${flag}</p>
            </div>

            <span class="vessel-current-badge">Current</span>
          </div>

          <div class="vessel-main-grid">
            <div class="vessel-main-item">
              <span>Role Onboard</span>
              <strong>${role}</strong>
            </div>

            <div class="vessel-main-item">
              <span>Dates Onboard</span>
              <strong>${dateLine}</strong>
            </div>

            <div class="vessel-main-item">
              <span>Program</span>
              <strong>${program}</strong>
            </div>

            <div class="vessel-main-item">
              <span>Salary</span>
              <strong>${salary}</strong>
            </div>

            ${
              leavePackage
                ? `<div class="vessel-main-item"><span>Leave / rotation</span><strong>${leavePackage}</strong></div>`
                : ""
            }
          </div>

          <div class="vessel-stats-grid">
            <div><span>GT</span><strong>${gt}</strong></div>
            <div><span>Length</span><strong>${length}</strong></div>
            <div><span>Build</span><strong>${builder}</strong></div>
            ${imo ? `<div><span>IMO</span><strong>${imo}</strong></div>` : ""}
            ${mmsi ? `<div><span>MMSI</span><strong>${mmsi}</strong></div>` : ""}
            ${additionalDuties ? `<div><span>Onboard duties</span><strong>${additionalDuties}</strong></div>` : ""}
          </div>
        </div>
      </div>

        <div class="vessel-experience-row">
        ${experienceHtml}

        <aside class="vessel-sea-card">
          <span class="vessel-panel-label">Seafarer Employment Agreement</span>
          ${
            seaUrl
              ? `<a class="vessel-doc-button" href="${Seav.escapeHtml(seaUrl)}" target="_blank" rel="noopener">View document</a>`
              : `<span class="vessel-doc-button vessel-doc-button--empty">Not uploaded</span>`
          }
          <p class="vessel-sea-note">Your Seafarer Employment Agreement (SEA) is the signed contract between you and the vessel's employer, covering pay, leave, and repatriation. You should have this signed before joining the vessel, or as soon as possible once onboard.</p>
        </aside>
      </div>

      <div class="vessel-linked-clean-grid">

        <section class="vessel-linked-clean-card sea-card">
          <h3>Sea Time</h3>

          ${
            latestSeatimes.length
              ? latestSeatimes.map((item) => `
                <div class="vessel-linked-row">
                  <div>
                    <strong>${Seav.escapeHtml(item.capacityServed || "—")}</strong>
                    <span>${item.dateJoined ? formatDatePretty(item.dateJoined) : "—"} → ${item.dateLeft ? formatDatePretty(item.dateLeft) : "Present"}</span>
                  </div>
                  <b>${totalQualifyingDays(item)} days</b>
                </div>
              `).join("")
              : `<p>No linked sea time entries.</p>`
          }

          <div class="vessel-total-row">
            <span>Total Sea Time</span>
            <strong>${totalSeaDays} days</strong>
          </div>
        </section>

        <section class="vessel-linked-clean-card tender-card">
          <h3>Tenders</h3>

          ${
            latestTenders.length
              ? latestTenders.map((item) => `
                <div class="vessel-linked-row">
                  <div>
                    <strong>${Seav.escapeHtml(item.name || "Unnamed Tender")}</strong>
                    <span>${Seav.escapeHtml(item.type || item.model || "Tender")}</span>
                  </div>
                  <b>›</b>
                </div>
              `).join("")
              : `<p>No linked tenders.</p>`
          }
        </section>

        <section class="vessel-linked-clean-card reference-card">
          <h3>References</h3>

          ${
            latestRefs.length
              ? latestRefs.map((item) => `
                <div class="vessel-linked-row">
                  <div>
                    <strong>${Seav.escapeHtml(item.name || "—")}</strong>
                    <span>${Seav.escapeHtml(item.title || "—")} • ${Seav.escapeHtml(item.status || "Draft")}</span>
                  </div>
                  <b>›</b>
                </div>
              `).join("")
              : `<p>No linked references.</p>`
          }
        </section>

      </div>

      ${Seav.seavActions(
        `${Seav.seavAction(
          "edit",
          "Edit",
          `data-edit-vessel-id="${Seav.escapeHtml(vesselId)}"`
        )}${Seav.seavAction(
          "delete",
          "Delete",
          `data-del-vessel-id="${Seav.escapeHtml(vesselId)}"`
        )}`
      )}

    </article>
  `;
}

  const VESSEL_PHOTO_BUCKET =
    window.SeavApiCore?.STORAGE_BUCKETS?.VESSEL_PHOTOS || "vessel-photos";
  const VESSEL_DOC_BUCKET =
    window.SeavApiCore?.STORAGE_BUCKETS?.VESSEL_DOCUMENTS || "vessel-documents";

  // Mirrors the Profile page's photo-thumb pattern — previously vs_photo/vs_sea
  // were bare <input type="file"> controls with no indication a file already
  // existed, which read as empty even when editing a vessel that had one.
  function renderVesselPhotoThumb(photoMeta, { isNewSelection = false } = {}) {
    const thumb = document.getElementById("vsPhotoThumb");
    const hint = document.getElementById("vsPhotoHint");
    const btn = document.getElementById("vsPhotoBtn");
    if (!thumb) return;

    const photoUrl = Seav.getFileDisplayUrl(photoMeta, VESSEL_PHOTO_BUCKET);

    if (photoUrl) {
      const safeUrl = String(photoUrl).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      thumb.style.backgroundImage = `url("${safeUrl}")`;
    } else {
      thumb.style.backgroundImage = "";
    }

    if (hint) {
      if (isNewSelection) {
        hint.textContent = "New photo selected — click Save vessel to apply";
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

  function renderVesselSeaHint(attachmentMeta, { isNewSelection = false } = {}) {
    const hint = document.getElementById("vsSeaHint");
    const btn = document.getElementById("vsSeaBtn");

    if (isNewSelection) {
      if (hint) {
        hint.textContent = attachmentMeta?.filename
          ? `New file selected: ${attachmentMeta.filename} — click Save vessel to apply`
          : "New file selected — click Save vessel to apply";
      }
      if (btn) btn.textContent = "Change file";
      return;
    }

    const docUrl = attachmentMeta ? Seav.getFileDisplayUrl(attachmentMeta, VESSEL_DOC_BUCKET) : "";
    const filename = attachmentMeta?.filename || "";

    if (hint) {
      hint.textContent = docUrl
        ? (filename ? `Current document: ${filename}` : "Current document uploaded")
        : "No document uploaded yet";
    }

    if (btn) {
      btn.textContent = docUrl ? "Change file" : "Choose file";
    }
  }

  async function hydrateVesselFiles(vessels) {
    if (!window.SeavApiCore?.hydrateItemsFileField || !vessels.length) return vessels;
    await window.SeavApiCore.hydrateItemsFileField(vessels, "photo", VESSEL_PHOTO_BUCKET);
    await window.SeavApiCore.hydrateItemsFileField(
      vessels,
      "sea_attachment",
      VESSEL_DOC_BUCKET
    );
    return vessels;
  }

async function renderVessels() {
  const currentVesselCard = document.getElementById("currentVesselCard");
  const vesselsGrid = document.getElementById("vesselsGrid");

  if (!currentVesselCard && !vesselsGrid && !document.getElementById("vesselForm")) return;

  const vessels = getVessels();

  if (!vessels.length) {
    if (currentVesselCard) {
      currentVesselCard.innerHTML = `<p class="muted">No current vessel added yet.</p>`;
    }

    if (vesselsGrid) {
      vesselsGrid.innerHTML = `<p class="muted">No vessel history yet.</p>`;
    }

    return;
  }

  await hydrateVesselFiles(vessels);
  window.SeavState?.syncCache?.();

  const sortedVessels = [...vessels].sort((a, b) => {
    const da = a.from ? new Date(a.from) : new Date(0);
    const db = b.from ? new Date(b.from) : new Date(0);
    return db - da;
  });

  const current =
    sortedVessels.find((v) => !v.to) ||
    sortedVessels[0];

  const history = sortedVessels.filter((v) => v.id !== current.id);

  if (currentVesselCard) {
    currentVesselCard.innerHTML = buildVesselCard(current);
  }

  if (!vesselsGrid) return;

  if (!history.length) {
    vesselsGrid.innerHTML = `<p class="muted">No vessel history yet.</p>`;
    return;
  }

  vesselsGrid.innerHTML = history
    .map((v) => buildVesselCard(v, { compact: true }))
    .join("");
}

function fillVesselForm(vessel) {
  document.getElementById("vs_name").value = vessel.name || "";
  document.getElementById("vs_flag").value = vessel.flag || "";
  document.getElementById("vs_gt").value = vessel.gt || "";

  document.getElementById("vs_length").value =
    vessel.vessel_length || vessel.length || "";

  document.getElementById("vs_builder").value = vessel.builder || "";

  const imoEl = document.getElementById("vs_imo");
  const mmsiEl = document.getElementById("vs_mmsi");
  if (imoEl) imoEl.value = vessel.imo || "";
  if (mmsiEl) mmsiEl.value = vessel.mmsi || "";

  document.getElementById("vs_desc").value =
    vessel.experience_onboard || vessel.desc || "";

  Seav.setDateTriplet("vs_date_from", vessel.from || "");
  document.getElementById("vs_current").checked = !vessel.to;
  Seav.setDateTriplet("vs_date_to", vessel.to || "");

  const toWrap = document.getElementById("vs_to_wrap");
  if (toWrap) {
    toWrap.style.display = !vessel.to ? "none" : "";
  }

  const roleEl = document.getElementById("vs_role");
  const typeEl = document.getElementById("vs_type");
  const programEl = document.getElementById("vs_program");
  const builderEl = document.getElementById("vs_builder");

  if (roleEl) roleEl.value = vessel.vessel_role || vessel.role || "";
  if (typeEl) typeEl.value = vessel.vessel_type || vessel.type || "";
  if (programEl) programEl.value = vessel.program || "";
  if (builderEl) builderEl.value = vessel.builder || "";

  populateVesselCurrencyOptions();
  const parsedSalary = parseVesselSalary(vessel.salary);
  const salaryCurrencyEl = document.getElementById("vs_salary_currency");
  const salaryAmountEl = document.getElementById("vs_salary_amount");
  if (salaryCurrencyEl) salaryCurrencyEl.value = parsedSalary.currency;
  if (salaryAmountEl) salaryAmountEl.value = parsedSalary.amount;

  const leavePackageEl = document.getElementById("vs_leave_package");
  if (leavePackageEl) leavePackageEl.value = vessel.leave_package || "";

  fillDutiesCheckboxes(vessel.additional_duties || "");

  renderVesselPhotoThumb(vessel.photo || null, { isNewSelection: false });
  renderVesselSeaHint(vessel.sea_attachment || vessel.seaAttachment || null, { isNewSelection: false });

  const editId = document.getElementById("vs_edit_index");
  if (editId) editId.value = vessel.id || "";

  const modal = document.getElementById("vesselModal");

  if (window.SeavModals?.openModal) {
    window.SeavModals.openModal("vesselModal");
  } else if (modal) {
    modal.hidden = false;
  }
}

function resetVesselFormState() {
  const form = document.getElementById("vesselForm");
  if (form) form.reset();

  const editId = document.getElementById("vs_edit_index");
  if (editId) editId.value = "";

  Seav.clearDateTriplet("vs_date_from");
  Seav.clearDateTriplet("vs_date_to");

  const currentBox = document.getElementById("vs_current");
  if (currentBox) currentBox.checked = false;

  const toWrap = document.getElementById("vs_to_wrap");
  if (toWrap) {
    toWrap.style.display = "";
  }

  populateVesselCurrencyOptions();
  const salaryCurrencyEl = document.getElementById("vs_salary_currency");
  if (salaryCurrencyEl) salaryCurrencyEl.value = "GBP";

  resetDutiesCheckboxes();

  renderVesselPhotoThumb(null, { isNewSelection: false });
  renderVesselSeaHint(null, { isNewSelection: false });
}

function readVesselForm() {
  const from = Seav.readDateTriplet("vs_date_from");
  const isCurrent = !!document.getElementById("vs_current")?.checked;
  const to = isCurrent ? "" : Seav.readDateTriplet("vs_date_to");

  return {
    id: document.getElementById("vs_edit_index")?.value || "",
    name: document.getElementById("vs_name")?.value.trim(),
    flag: document.getElementById("vs_flag")?.value.trim() || "",
    gt: document.getElementById("vs_gt")?.value.trim() || "",
    length: document.getElementById("vs_length")?.value.trim() || "",
    builder: document.getElementById("vs_builder")?.value.trim() || "",
    imo: document.getElementById("vs_imo")?.value.trim() || "",
    mmsi: document.getElementById("vs_mmsi")?.value.trim() || "",
    desc: document.getElementById("vs_desc")?.value.trim() || "",
    from,
    to,
    role: document.getElementById("vs_role")?.value.trim() || "",
    type: document.getElementById("vs_type")?.value.trim() || "",
    program: document.getElementById("vs_program")?.value.trim() || "",
    salary: (() => {
      const amount = document.getElementById("vs_salary_amount")?.value.trim() || "";
      if (!amount) return "";
      const currency = document.getElementById("vs_salary_currency")?.value || "GBP";
      return currency === "OTHER" ? amount : `${currency} ${amount}`;
    })(),
    leavePackage: document.getElementById("vs_leave_package")?.value.trim() || "",
    additionalDuties: readDutiesString(),
    file: document.getElementById("vs_photo")?.files?.[0] || null,
    seaFile: document.getElementById("vs_sea")?.files?.[0] || null
  };
}

async function buildVesselPhoto(file, existingPhoto, vesselId) {
  return window.SeavUpload?.uploadToStorage({
    bucket: "vessel-photos",
    entityId: vesselId,
    file,
    existingMeta: existingPhoto,
    kind: "Photo",
    maxBytes: window.SeavUpload?.PHOTO_MAX_BYTES
  }) ?? existingPhoto ?? null;
}

async function buildSeaAttachment(file, existingAttachment, vesselId) {
  return window.SeavUpload?.uploadToStorage({
    bucket: "vessel-documents",
    entityId: vesselId,
    file,
    existingMeta: existingAttachment,
    kind: "SEA document"
  }) ?? existingAttachment ?? null;
}

async function saveVesselData(vesselData) {
  await SeavAPI.upsertItemById(STORAGE_KEY, vesselData);

  if (window.SeavState?.refresh) {
    await window.SeavState.refresh();
  }

  if (window.SeavAchievementEngine?.runAchievementEvaluation) {
    await window.SeavAchievementEngine.runAchievementEvaluation();
  }

  renderVessels();

  document.dispatchEvent(new CustomEvent("seav:data-updated"));
}

  function initVessels() {
    if (
      !document.getElementById("currentVesselCard") &&
      !document.getElementById("vesselsGrid") &&
      !document.getElementById("vesselForm")
    ) return;

    const runRefresh = () => {
      renderVessels();
    };

    Seav.bindStateRefresh(runRefresh, { label: "Vessels refresh" });

    const vesselForm = document.getElementById("vesselForm");
    const currentCheckbox = document.getElementById("vs_current");
    const toWrap = document.getElementById("vs_to_wrap");

    populateVesselCurrencyOptions();

    const vsPhotoInput = document.getElementById("vs_photo");
    const vsPhotoBtn = document.getElementById("vsPhotoBtn");
    if (vsPhotoBtn && vsPhotoInput) {
      vsPhotoBtn.addEventListener("click", () => vsPhotoInput.click());
    }
    if (vsPhotoInput) {
      // A raw createObjectURL() on a HEIC file can't be decoded by Chrome/
      // Firefox/Edge, so the thumbnail would go blank/broken the instant a
      // HEIC photo was picked — well before Save's real HEIC->JPEG
      // conversion ever runs. Routing through SeavUpload.buildPreviewUrl
      // (same conversion Save uses) keeps this preview honest.
      vsPhotoInput.addEventListener("change", async () => {
        const file = vsPhotoInput.files?.[0] || null;
        if (!file) return;

        if (!window.SeavUpload?.isHeicFile?.(file)) {
          renderVesselPhotoThumb({ dataUrl: URL.createObjectURL(file) }, { isNewSelection: true });
          return;
        }

        const hint = document.getElementById("vsPhotoHint");
        if (hint) hint.textContent = "Converting HEIC photo for preview…";
        const url = await window.SeavUpload.buildPreviewUrl(file);
        if (vsPhotoInput.files?.[0] !== file) return; // selection changed mid-conversion

        if (url) {
          renderVesselPhotoThumb({ dataUrl: url }, { isNewSelection: true });
        } else if (hint) {
          hint.textContent =
            "HEIC photo selected — preview unavailable, but Save will still try to convert it. If that fails, switch your camera to JPEG (\"Most Compatible\") and re-upload.";
        }
      });
    }

    const vsSeaInput = document.getElementById("vs_sea");
    const vsSeaBtn = document.getElementById("vsSeaBtn");
    if (vsSeaBtn && vsSeaInput) {
      vsSeaBtn.addEventListener("click", () => vsSeaInput.click());
    }
    if (vsSeaInput) {
      vsSeaInput.addEventListener("change", () => {
        const file = vsSeaInput.files?.[0] || null;
        renderVesselSeaHint(file ? { filename: file.name } : null, { isNewSelection: !!file });
      });
    }

    if (currentCheckbox && toWrap) {
    const syncEndDateVisibility = () => {
    toWrap.style.display = currentCheckbox.checked ? "none" : "";
  };

  currentCheckbox.addEventListener("change", syncEndDateVisibility);
  syncEndDateVisibility();
}
   if (vesselForm) {
  vesselForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = readVesselForm();
    if (!formData.name) {
      Seav.notify("error", "Vessel name required", "Add a vessel name before saving.");
      return;
    }

    const existingVessel = formData.id
      ? getVessels().find((item) => item.id === formData.id) || null
      : null;

    await Seav.withSaving(async () => {
    const vesselId = formData.id || createId("vessel");

    const photo = await buildVesselPhoto(
      formData.file,
      existingVessel?.photo || null,
      vesselId
    );

    const seaAttachment = await buildSeaAttachment(
  formData.seaFile,
  existingVessel?.sea_attachment || existingVessel?.seaAttachment || null,
  vesselId
);

    const vesselData = {
  id: vesselId,
  name: formData.name,
  flag: formData.flag,
  gt: formData.gt,
  vessel_length: formData.length,
  builder: formData.builder,
  imo: formData.imo,
  mmsi: formData.mmsi,
  vessel_role: formData.role,
  vessel_type: formData.type,
  program: formData.program,
  salary: formData.salary,
  leave_package: formData.leavePackage,
  additional_duties: formData.additionalDuties,
  experience_onboard: formData.desc,
  from: formData.from,
  to: formData.to,
  photo: photo || existingVessel?.photo || null,
  sea_attachment: seaAttachment || existingVessel?.sea_attachment || existingVessel?.seaAttachment || null
};

      await saveVesselData(vesselData);

      resetVesselFormState();

      if (window.SeavModals?.closeAllModals) {
        window.SeavModals.closeAllModals();
      } else {
        const modal = document.getElementById("vesselModal");
        if (modal) modal.hidden = true;
      }

      Seav.notify("success", "Vessel logged", "Added to your fleet record.");
    }, { sub: "Saving vessel" }).catch((err) => {
      console.error("[SEA-V] Vessel save failed:", err);
      Seav.notify("error", "Vessel not saved", "Something went wrong. Check the browser console (F12).");
    });
  });
}

    document.addEventListener("click", async (e) => {
  const editBtn = e.target.closest("[data-edit-vessel-id]");
  if (editBtn) {
    e.preventDefault();

    const vesselId = editBtn.getAttribute("data-edit-vessel-id");
    const vessel = getVessels().find((item) => item.id === vesselId);

    if (!vessel) return;

    fillVesselForm(vessel);
    return;
  }

  const delBtn = e.target.closest("[data-del-vessel-id]");
  if (delBtn) {
    e.preventDefault();

    const vesselId = delBtn.getAttribute("data-del-vessel-id");
    const vessel = getVessels().find((item) => item.id === vesselId);

    if (
      !Seav.confirmDelete({
        itemName: vessel?.name || "",
        itemLabel: "vessel"
      })
    ) {
      return;
    }

    await SeavAPI.deleteItemById(STORAGE_KEY, vesselId);

    renderVessels();
    document.dispatchEvent(new CustomEvent("seav:data-updated"));
  }
});

  }

  document.addEventListener("DOMContentLoaded", initVessels);
})();