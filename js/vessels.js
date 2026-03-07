// /js/vessels.js
(function () {
  "use strict";

  function renderVessels() {
    const currentVesselCard = document.getElementById("currentVesselCard");
    const vesselsGrid = document.getElementById("vesselsGrid");

    if (!currentVesselCard && !vesselsGrid && !document.getElementById("vesselForm")) return;

    const vessels = Seav.load("seav_vessels", []);

    function buildVesselCard(v, idx) {
      const hasPhoto = !!(v.photo && v.photo.dataUrl);
      const photoHtml = hasPhoto
        ? `<img src="${v.photo.dataUrl}" alt="${Seav.escapeHtml(v.name)}" />`
        : `<div class="vessel-photo-fallback">No Photo</div>`;

      const flag = v.flag ? Seav.escapeHtml(v.flag) : "—";
      const gt = v.gt ? Seav.escapeHtml(v.gt) : "—";
      const from = v.from ? Seav.escapeHtml(v.from) : "—";
      const to = v.to ? Seav.escapeHtml(v.to) : "Present";
      const desc = v.desc ? Seav.escapeHtml(v.desc) : "";

      return `
        <article class="vessel-card">
          <div class="vessel-photo">${photoHtml}</div>
          <div class="vessel-body">
            <h3 class="vessel-title">${Seav.escapeHtml(v.name)}</h3>
            <div class="vessel-meta">
              <span>Flag: ${flag}</span>
              <span>GT: ${gt}</span>
            </div>
            ${v.role ? `<div class="vessel-meta"><span>Role: ${Seav.escapeHtml(v.role)}</span></div>` : ``}
            ${v.type ? `<div class="vessel-meta"><span>Type: ${Seav.escapeHtml(v.type)}</span></div>` : ``}
            ${v.program ? `<div class="vessel-meta"><span>Program: ${Seav.escapeHtml(v.program)}</span></div>` : ``}
            ${desc ? `<div class="vessel-desc">${desc}</div>` : ``}
            <div class="vessel-foot">
              <div class="vessel-dates">${from} → ${to}</div>
              <div class="row-actions">
                <a href="#" data-edit-vessel="${idx}">Edit</a>
                <a href="#" data-del-vessel="${idx}">Delete</a>
              </div>
            </div>
          </div>
        </article>
      `;
    }

    if (vessels.length === 0) {
      if (currentVesselCard) {
        currentVesselCard.innerHTML = `<p class="muted">No current vessel added yet.</p>`;
      }

      if (vesselsGrid) {
        vesselsGrid.innerHTML = `<p class="muted">No vessel history yet.</p>`;
      }

      return;
    }

    // =========================
    // Pick current vessel
    // 1. Prefer vessel with no "to" date
    // 2. Otherwise use vessel with latest "to" date
    // =========================
    let currentIndex = vessels.findIndex(v => !v.to || !String(v.to).trim());

    if (currentIndex === -1) {
      currentIndex = vessels.reduce((latestIdx, vessel, idx, arr) => {
        const currentDate = vessel.to ? new Date(vessel.to) : new Date(0);
        const latestDate = arr[latestIdx].to ? new Date(arr[latestIdx].to) : new Date(0);
        return currentDate > latestDate ? idx : latestIdx;
      }, 0);
    }

    const current = vessels[currentIndex];

    // =========================
    // Build vessel history
    // Exclude current vessel, then sort by "from" newest first
    // =========================
    const history = vessels
      .map((v, idx) => ({ ...v, _originalIndex: idx }))
      .filter((_, idx) => idx !== currentIndex)
      .sort((a, b) => {
        const da = a.from ? new Date(a.from) : new Date(0);
        const db = b.from ? new Date(b.from) : new Date(0);
        return db - da;
      });

    if (currentVesselCard) {
      currentVesselCard.innerHTML = buildVesselCard(current, currentIndex);
    }

    if (vesselsGrid) {
      if (history.length === 0) {
        vesselsGrid.innerHTML = `<p class="muted">No vessel history yet.</p>`;
      } else {
        vesselsGrid.innerHTML = history
          .map((v) => buildVesselCard(v, v._originalIndex))
          .join("");
      }
    }
  }

  function fillVesselForm(vessel, idx) {
    document.getElementById("vs_name").value = vessel.name || "";
    document.getElementById("vs_flag").value = vessel.flag || "";
    document.getElementById("vs_gt").value = vessel.gt || "";
    document.getElementById("vs_desc").value = vessel.desc || "";
    document.getElementById("vs_from").value = vessel.from || "";
    document.getElementById("vs_to").value = vessel.to || "";

    const roleEl = document.getElementById("vs_role");
    const typeEl = document.getElementById("vs_type");
    const programEl = document.getElementById("vs_program");

    if (roleEl) roleEl.value = vessel.role || "";
    if (typeEl) typeEl.value = vessel.type || "";
    if (programEl) programEl.value = vessel.program || "";

    const editIndex = document.getElementById("vs_edit_index");
    if (editIndex) editIndex.value = String(idx);

    if (window.SeavModals?.openModal) window.SeavModals.openModal("vesselModal");
  }

  function resetVesselFormState() {
    const form = document.getElementById("vesselForm");
    if (form) form.reset();

    const editIndex = document.getElementById("vs_edit_index");
    if (editIndex) editIndex.value = "";
  }

  function initVessels() {
    if (
      !document.getElementById("currentVesselCard") &&
      !document.getElementById("vesselsGrid") &&
      !document.getElementById("vesselForm")
    ) return;

    renderVessels();

    const vesselForm = document.getElementById("vesselForm");
    if (vesselForm) {
      vesselForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("vs_name")?.value.trim();
        const flag = document.getElementById("vs_flag")?.value.trim() || "";
        const gt = document.getElementById("vs_gt")?.value.trim() || "";
        const desc = document.getElementById("vs_desc")?.value.trim() || "";
        const from = document.getElementById("vs_from")?.value || "";
        const to = document.getElementById("vs_to")?.value || "";
        const role = document.getElementById("vs_role")?.value.trim() || "";
        const type = document.getElementById("vs_type")?.value.trim() || "";
        const program = document.getElementById("vs_program")?.value.trim() || "";
        const editIndexValue = document.getElementById("vs_edit_index")?.value ?? "";

        if (!name) return;

        const file = document.getElementById("vs_photo")?.files?.[0] || null;

        let vessels = Seav.load("seav_vessels", []);
        let existingPhoto = null;

        const isEdit = editIndexValue !== "";
        const editIndex = isEdit ? Number(editIndexValue) : -1;

        if (isEdit && vessels[editIndex]?.photo) {
          existingPhoto = vessels[editIndex].photo;
        }

        let photo = existingPhoto;
        if (file) {
          const maxBytes = 2 * 1024 * 1024;
          if (file.size > maxBytes) {
            alert("Photo too large. Please upload an image under 2MB for the prototype.");
            return;
          }
          photo = {
            filename: file.name,
            mime: file.type || "application/octet-stream",
            dataUrl: await Seav.readFileAsDataURL(file),
          };
        }

        const vesselData = { name, flag, gt, role, type, program, desc, from, to, photo };

        if (isEdit && editIndex >= 0 && editIndex < vessels.length) {
          vessels[editIndex] = vesselData;
        } else {
          vessels.unshift(vesselData);
        }

        Seav.save("seav_vessels", vessels);

        resetVesselFormState();
        if (window.SeavModals?.closeAllModals) window.SeavModals.closeAllModals();

        renderVessels();
        if (window.SeavDashboard?.refresh) window.SeavDashboard.refresh();
      });
    }

    document.addEventListener("click", (e) => {
      const editBtn = e.target.closest("[data-edit-vessel]");
      if (editBtn) {
        e.preventDefault();
        const idx = Number(editBtn.getAttribute("data-edit-vessel"));
        const vessels = Seav.load("seav_vessels", []);
        const vessel = vessels[idx];
        if (!vessel) return;
        fillVesselForm(vessel, idx);
        return;
      }

      const delBtn = e.target.closest("[data-del-vessel]");
      if (delBtn) {
        e.preventDefault();
        const idx = Number(delBtn.getAttribute("data-del-vessel"));
        const vessels = Seav.load("seav_vessels", []);
        vessels.splice(idx, 1);
        Seav.save("seav_vessels", vessels);

        renderVessels();
        if (window.SeavDashboard?.refresh) window.SeavDashboard.refresh();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", initVessels);
})();