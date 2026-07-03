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

  const { KEYS, createId, totalQualifyingDays, formatDatePretty } = window.SeavData;
  const STORAGE_KEY = KEYS.VESSELS;

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

const EXPERIENCE_CLAMP_CHARS = 160;

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

  const needsToggle =
    text.length > EXPERIENCE_CLAMP_CHARS || text.split(/\n/).filter(Boolean).length > 3;

  return `
    <section class="vessel-experience-card${
      needsToggle ? " vessel-experience-card--clamp" : ""
    }" ${needsToggle ? 'data-expandable="true"' : ""}>
      <span class="vessel-panel-label">Experience onboard</span>
      <p class="vessel-experience-text">${Seav.escapeHtml(text)}</p>
      ${
        needsToggle
          ? `<button type="button" class="vessel-read-more" aria-expanded="false">Read more</button>`
          : ""
      }
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
  const role = v.vessel_role || v.role ? Seav.escapeHtml(v.vessel_role || v.role) : "—";
  const type = v.vessel_type || v.type ? Seav.escapeHtml(v.vessel_type || v.type) : "—";
  const program = v.program ? Seav.escapeHtml(v.program) : "—";
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
          </div>

          <div class="vessel-stats-grid">
            <div><span>GT</span><strong>${gt}</strong></div>
            <div><span>Length</span><strong>${length}</strong></div>
            <div><span>Build</span><strong>${builder}</strong></div>
          </div>
        </div>
      </div>

        <div class="vessel-experience-row">
        ${experienceHtml}

        <aside class="vessel-sea-card">
          <span class="vessel-panel-label">SEA agreement</span>
          ${
            seaUrl
              ? `<a class="vessel-doc-button" href="${Seav.escapeHtml(seaUrl)}" target="_blank" rel="noopener">View document</a>`
              : `<span class="vessel-doc-button vessel-doc-button--empty">Not uploaded</span>`
          }
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

function renderVessels() {
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
    desc: document.getElementById("vs_desc")?.value.trim() || "",
    from,
    to,
    role: document.getElementById("vs_role")?.value.trim() || "",
    type: document.getElementById("vs_type")?.value.trim() || "",
    program: document.getElementById("vs_program")?.value.trim() || "",
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
    kind: "Photo"
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
  vessel_role: formData.role,
  vessel_type: formData.type,
  program: formData.program,
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
  const readMoreBtn = e.target.closest(".vessel-read-more");
  if (readMoreBtn) {
    e.preventDefault();
    const card = readMoreBtn.closest(".vessel-experience-card");
    if (!card) return;
    const expanded = card.classList.toggle("is-expanded");
    readMoreBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
    readMoreBtn.textContent = expanded ? "Show less" : "Read more";
    return;
  }

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