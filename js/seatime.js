// /js/seatime.js

(function () {
  "use strict";

    if (!window.SeavData) {
    console.warn("[SEA-V] SeavData not found. Did you include js/seav-data.js before seatime.js?");
    return;
  }

  const { toNumber, totalQualifyingDays, getSeatimeTotals } = window.SeavData;


  /* =========================================================
     KPI CALCULATION
     Updates sea service summary totals
  ========================================================= */

  function updateServiceKpis() {
    const kpiSea = document.getElementById("kpiSea");
    const kpiStandby = document.getElementById("kpiStandby");
    const kpiYard = document.getElementById("kpiYard");
    const kpiWatchkeeping = document.getElementById("kpiWatchkeeping");
    const kpiTotalDays = document.getElementById("kpiTotalDays");

    if (!kpiSea && !kpiStandby && !kpiYard && !kpiWatchkeeping && !kpiTotalDays) return;

       const seatimes = Seav.load("seav_seatimes", []);
    const totals = getSeatimeTotals(seatimes);

    if (kpiSea) kpiSea.textContent = String(totals.sea);
    if (kpiStandby) kpiStandby.textContent = String(totals.standby);
    if (kpiYard) kpiYard.textContent = String(totals.yard);
    if (kpiWatchkeeping) kpiWatchkeeping.textContent = String(totals.watchkeeping);
    if (kpiTotalDays) kpiTotalDays.textContent = String(totals.total);
  }

function renderSeatimes() {
  const seatimeBody = document.getElementById("seatimeBody");
  if (!seatimeBody) {
    updateServiceKpis();
    return;
  }

  const seatimes = Seav.load("seav_seatimes", []);

  if (seatimes.length === 0) {
    seatimeBody.innerHTML = `
<tr>
  <td class="muted">—</td>
  <td class="muted">—</td>
  <td class="muted">—</td>
  <td class="muted">—</td>
  <td class="muted">—</td>
  <td class="muted">0</td>
  <td class="muted">0</td>
  <td class="muted">0</td>
  <td class="muted">0</td>
  <td class="muted">0</td>
  <td><span class="pill">Prototype</span></td>
  <td class="muted">—</td>
  <td></td>
</tr>
`;
    updateServiceKpis();
    return;
  }

  seatimeBody.innerHTML = seatimes.map((x, idx) => {
    const flagGt = [
      x.flag || "—",
      x.gt ? `${Seav.escapeHtml(x.gt)} GT` : "—"
    ].join(" • ");

    const total = totalQualifyingDays(x);

const attachCell = x.attachment?.dataUrl
  ? `
    <div class="attach-actions">
      <a href="${x.attachment.dataUrl}" 
         download="${Seav.escapeHtml(x.attachment.filename)}"
         class="btn-ghost2 btn-attach">
         📄 Testimonial
      </a>
    </div>
  `
  : `<span class="muted">—</span>`;

    return `
      <tr>
        <td>${Seav.escapeHtml(x.vesselName || "—")}</td>
        <td>${flagGt}</td>
        <td>${Seav.escapeHtml(x.capacityServed || "—")}</td>
        <td>${Seav.escapeHtml(x.dateJoined || "—")}</td>
        <td>${Seav.escapeHtml(x.dateLeft || "—")}</td>
        <td>${toNumber(x.actualSeaServiceDays)}</td>
        <td>${toNumber(x.standbyServiceDays)}</td>
        <td>${toNumber(x.yardServiceDays)}</td>
        <td>${toNumber(x.watchkeepingDays)}</td>
        <td>${total}</td>
        <td><span class="pill">${Seav.escapeHtml(x.verificationStatus || "Logged")}</span></td>
        <td>${attachCell}</td>
       <td class="row-actions">
  <a href="#" data-edit-seatime="${idx}">Edit</a> •
  <a href="#" data-del-seatime="${idx}">Delete</a>
</td>
</tr>
`;
       }).join("");

  updateServiceKpis();
}

  /* =========================================================
     CSV EXPORT HELPERS
     Utility functions for export formatting and download
  ========================================================= */

  function csvEscape(value) {
    const str = String(value ?? "");
    return `"${str.replace(/"/g, '""')}"`;
  }

  function downloadCsv(filename, rows) {
    const csv = rows.map(row => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  /* =========================================================
     EXPORT SEA SERVICE CSV
     Builds and downloads the sea service export file
  ========================================================= */

  function exportSeatimeCsv() {
    const seatimes = Seav.load("seav_seatimes", []);

    const rows = [[
      "Vessel Name",
      "Flag",
      "Gross Tonnage (GT)",
      "IMO / Official Number",
      "Capacity Served",
      "Date Joined",
      "Date Left",
      "Actual Sea Service (Days)",
      "Standby Service (Days)",
      "Yard Service (Days)",
      "Watchkeeping Service (Days)",
      "Total Qualifying Service (Days)",
      "Verification Status",
      "Notes"
    ]];

    seatimes.forEach((x) => {
      rows.push([
        x.vesselName || "",
        x.flag || "",
        x.gt || "",
        x.imoOfficialNumber || "",
        x.capacityServed || "",
        x.dateJoined || "",
        x.dateLeft || "",
        toNumber(x.actualSeaServiceDays),
        toNumber(x.standbyServiceDays),
        toNumber(x.yardServiceDays),
        toNumber(x.watchkeepingDays),
        totalQualifyingDays(x),
        x.verificationStatus || "Logged",
        x.notes || ""
      ]);
    });

    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(`sea-service-export-${today}.csv`, rows);
  }

  function fillSeatimeForm(entry, idx) {
  document.getElementById("st_vessel").value = entry.vesselName || "";
  document.getElementById("st_flag").value = entry.flag || "";
  document.getElementById("st_gt").value = entry.gt || "";
  document.getElementById("st_imo").value = entry.imoOfficialNumber || "";
  document.getElementById("st_role").value = entry.capacityServed || "";
  document.getElementById("st_from").value = entry.dateJoined || "";
  document.getElementById("st_to").value = entry.dateLeft || "";
  document.getElementById("st_actual_sea").value = String(entry.actualSeaServiceDays ?? 0);
  document.getElementById("st_standby").value = String(entry.standbyServiceDays ?? 0);
  document.getElementById("st_yard").value = String(entry.yardServiceDays ?? 0);
  document.getElementById("st_watchkeeping").value = String(entry.watchkeepingDays ?? 0);
  document.getElementById("st_status").value = entry.verificationStatus || "Logged";
  document.getElementById("st_notes").value = entry.notes || "";

  const editIndex = document.getElementById("st_edit_index");
  if (editIndex) editIndex.value = String(idx);

  if (window.SeavModals?.openModal) {
    window.SeavModals.openModal("seatimeModal");
  }
}

  /* =========================================================
     INITIALISE SEA SERVICE MODULE
     Runs only if sea service page elements exist
  ========================================================= */

  function initSeatime() {
    if (
      !document.getElementById("seatimeBody") &&
      !document.getElementById("seatimeForm") &&
      !document.getElementById("btnExportSeatimeCsv")
    ) return;

    renderSeatimes();

    /* =========================================================
       EXPORT BUTTON
    ========================================================= */

    const exportBtn = document.getElementById("btnExportSeatimeCsv");
    if (exportBtn) {
      exportBtn.addEventListener("click", (e) => {
        e.preventDefault();
        exportSeatimeCsv();
      });
    }

    /* =========================================================
       ADD SEA SERVICE ENTRY
    ========================================================= */

    const seatimeForm = document.getElementById("seatimeForm");
    if (seatimeForm) {
      seatimeForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const vesselName = document.getElementById("st_vessel")?.value.trim();
        const flag = document.getElementById("st_flag")?.value.trim() || "";
        const gt = document.getElementById("st_gt")?.value.trim() || "";
        const imoOfficialNumber = document.getElementById("st_imo")?.value.trim() || "";
        const capacityServed = document.getElementById("st_role")?.value.trim();
        const dateJoined = document.getElementById("st_from")?.value;
        const dateLeft = document.getElementById("st_to")?.value;
        const actualSeaServiceDays = toNumber(document.getElementById("st_actual_sea")?.value);
        const standbyServiceDays = toNumber(document.getElementById("st_standby")?.value);
        const yardServiceDays = toNumber(document.getElementById("st_yard")?.value);
        const watchkeepingDays = toNumber(document.getElementById("st_watchkeeping")?.value);
        const verificationStatus = document.getElementById("st_status")?.value || "Logged";
        const notes = document.getElementById("st_notes")?.value.trim() || "";
        const file = document.getElementById("st_attachment")?.files?.[0] || null;
        const editIndexValue = document.getElementById("st_edit_index")?.value ?? "";

       let attachment = null;

       if (file) {

       const maxBytes = 2 * 1024 * 1024;

       if (file.size > maxBytes) {
       alert("Attachment too large. Please upload a file under 2MB.");
       return;
       }

       attachment = {
       filename: file.name,
       mime: file.type || "application/octet-stream",
       dataUrl: await Seav.readFileAsDataURL(file)
       };

        }

        if (!vesselName || !capacityServed || !dateJoined || !dateLeft) return;

const seatimes = Seav.load("seav_seatimes", []);

const isEdit = editIndexValue !== "";
const editIndex = isEdit ? Number(editIndexValue) : -1;

let existingAttachment = null;
if (isEdit && seatimes[editIndex]?.attachment) {
  existingAttachment = seatimes[editIndex].attachment;
}

const seatimeData = {
  vesselName,
  flag,
  gt,
  imoOfficialNumber,
  capacityServed,
  dateJoined,
  dateLeft,
  actualSeaServiceDays,
  standbyServiceDays,
  yardServiceDays,
  watchkeepingDays,
  verificationStatus,
  notes,
  attachment: attachment || existingAttachment
};

if (isEdit && editIndex >= 0 && editIndex < seatimes.length) {
  seatimes[editIndex] = seatimeData;
} else {
  seatimes.unshift(seatimeData);
}

Seav.save("seav_seatimes", seatimes);

seatimeForm.reset();
document.getElementById("st_edit_index").value = "";
document.getElementById("st_actual_sea").value = "0";
document.getElementById("st_standby").value = "0";
document.getElementById("st_yard").value = "0";
document.getElementById("st_watchkeeping").value = "0";

        if (window.SeavModals?.closeAllModals) window.SeavModals.closeAllModals();

        renderSeatimes();
        if (window.SeavDashboard?.refresh) window.SeavDashboard.refresh();
      });
    }

/* =========================================================
   SEA SERVICE TABLE ACTIONS
========================================================= */

document.addEventListener("click", (e) => {

 const editBtn = e.target.closest("[data-edit-seatime]");
if (editBtn) {
  e.preventDefault();

  const idx = Number(editBtn.getAttribute("data-edit-seatime"));
  const seatimes = Seav.load("seav_seatimes", []);
  const entry = seatimes[idx];

  if (!entry) return;

  fillSeatimeForm(entry, idx);
  return;
}

const st = e.target.closest("[data-del-seatime]");
if (!st) return;

e.preventDefault();
const idx = Number(st.getAttribute("data-del-seatime"));
const seatimes = Seav.load("seav_seatimes", []);
seatimes.splice(idx, 1);
Seav.save("seav_seatimes", seatimes);

renderSeatimes();
if (window.SeavDashboard?.refresh) window.SeavDashboard.refresh();
});

} // closes initSeatime()
  /* =========================================================
     PAGE LOAD INITIALISATION
  ========================================================= */

  document.addEventListener("DOMContentLoaded", initSeatime);

})();