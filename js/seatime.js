// /js/seatime.js

(function () {
  "use strict";

  /* =========================================================
     HELPERS
     Shared utility functions for numeric handling
  ========================================================= */

  function toNumber(val) {
    const n = Number(val);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  function totalQualifyingDays(entry) {
    return (
      toNumber(entry.actualSeaServiceDays) +
      toNumber(entry.standbyServiceDays) +
      toNumber(entry.yardServiceDays) +
      toNumber(entry.watchkeepingDays)
    );
  }

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
    let sea = 0;
    let standby = 0;
    let yard = 0;
    let watchkeeping = 0;

    seatimes.forEach((x) => {
      sea += toNumber(x.actualSeaServiceDays);
      standby += toNumber(x.standbyServiceDays);
      yard += toNumber(x.yardServiceDays);
      watchkeeping += toNumber(x.watchkeepingDays);
    });

    const total = sea + standby + yard + watchkeeping;

    if (kpiSea) kpiSea.textContent = String(sea);
    if (kpiStandby) kpiStandby.textContent = String(standby);
    if (kpiYard) kpiYard.textContent = String(yard);
    if (kpiWatchkeeping) kpiWatchkeeping.textContent = String(watchkeeping);
    if (kpiTotalDays) kpiTotalDays.textContent = String(total);
  }

  /* =========================================================
     RENDER SEA SERVICE TABLE
     Builds the visible sea service record table
  ========================================================= */

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
          <td></td>
        </tr>
      `;
      updateServiceKpis();
      return;
    }

    seatimeBody.innerHTML = seatimes.map((x, idx) => {
      const flagGt = [x.flag || "—", x.gt ? `${Seav.escapeHtml(x.gt)} GT` : "—"].join(" • ");
      const total = totalQualifyingDays(x);

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
          <td class="row-actions"><a href="#" data-del-seatime="${idx}">Delete</a></td>
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
      seatimeForm.addEventListener("submit", (e) => {
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

        if (!vesselName || !capacityServed || !dateJoined || !dateLeft) return;

        const seatimes = Seav.load("seav_seatimes", []);
        seatimes.unshift({
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
          notes
        });

        Seav.save("seav_seatimes", seatimes);

        seatimeForm.reset();
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
       DELETE SEA SERVICE ENTRY
    ========================================================= */

    document.addEventListener("click", (e) => {
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
  }

  /* =========================================================
     PAGE LOAD INITIALISATION
  ========================================================= */

  document.addEventListener("DOMContentLoaded", initSeatime);

})();