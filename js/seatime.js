// /js/seatime.js
(function () {
  "use strict";

  function updateDayTypeKpis() {
    const kpiSea = document.getElementById("kpiSea");
    const kpiPort = document.getElementById("kpiPort");
    const kpiStandby = document.getElementById("kpiStandby");
    const kpiTotalDays = document.getElementById("kpiTotalDays");

    if (!kpiSea && !kpiPort && !kpiStandby && !kpiTotalDays) return;

    const seatimes = Seav.load("seav_seatimes", []);
    let sea = 0, port = 0, standby = 0;

    seatimes.forEach(x => {
      const d = Number(x.days) || 0;
      const t = x.type || "Sea";
      if (t === "Sea") sea += d;
      else if (t === "Port") port += d;
      else if (t === "Standby") standby += d;
    });

    const total = sea + port + standby;

    if (kpiSea) kpiSea.textContent = String(sea);
    if (kpiPort) kpiPort.textContent = String(port);
    if (kpiStandby) kpiStandby.textContent = String(standby);
    if (kpiTotalDays) kpiTotalDays.textContent = String(total);
  }

  function renderSeatimes() {
    const seatimeBody = document.getElementById("seatimeBody");
    if (!seatimeBody) {
      updateDayTypeKpis();
      return;
    }

    const seatimes = Seav.load("seav_seatimes", []);
    if (seatimes.length === 0) {
      seatimeBody.innerHTML = `
        <tr>
          <td class="muted">—</td><td class="muted">—</td><td class="muted">—</td><td class="muted">—</td>
          <td class="muted">—</td><td class="muted">0</td><td><span class="pill">Prototype</span></td><td></td>
        </tr>
      `;
      updateDayTypeKpis();
      return;
    }

    seatimeBody.innerHTML = seatimes.map((x, idx) => `
      <tr>
        <td>${Seav.escapeHtml(x.vessel)}</td>
        <td>${Seav.escapeHtml(x.role)}</td>
        <td>${Seav.escapeHtml(x.from)}</td>
        <td>${Seav.escapeHtml(x.to)}</td>
        <td>${Seav.escapeHtml(x.type || "Sea")}</td>
        <td>${Number(x.days) || 0}</td>
        <td><span class="pill">${Seav.escapeHtml(x.status || "Logged")}</span></td>
        <td class="row-actions"><a href="#" data-del-seatime="${idx}">Delete</a></td>
      </tr>
    `).join("");

    updateDayTypeKpis();
  }

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

  function exportSeatimeCsv() {
    const seatimes = Seav.load("seav_seatimes", []);

    const rows = [
      ["Vessel", "Role", "From", "To", "Type", "Days", "Status"]
    ];

    seatimes.forEach(x => {
      rows.push([
        x.vessel || "",
        x.role || "",
        x.from || "",
        x.to || "",
        x.type || "Sea",
        Number(x.days) || 0,
        x.status || "Logged"
      ]);
    });

    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(`sea-time-export-${today}.csv`, rows);
  }

  function initSeatime() {
    // Only run on seatime page (table exists, form exists, or export button exists)
    if (
      !document.getElementById("seatimeBody") &&
      !document.getElementById("seatimeForm") &&
      !document.getElementById("btnExportSeatimeCsv")
    ) return;

    renderSeatimes();

    const exportBtn = document.getElementById("btnExportSeatimeCsv");
    if (exportBtn) {
      exportBtn.addEventListener("click", (e) => {
        e.preventDefault();
        exportSeatimeCsv();
      });
    }

    const seatimeForm = document.getElementById("seatimeForm");
    if (seatimeForm) {
      seatimeForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const vessel = document.getElementById("st_vessel")?.value.trim();
        const role = document.getElementById("st_role")?.value.trim();
        const from = document.getElementById("st_from")?.value;
        const to = document.getElementById("st_to")?.value;
        const status = document.getElementById("st_status")?.value || "Logged";
        const type = document.getElementById("st_type")?.value || "Sea";

        if (!vessel || !role || !from || !to) return;

        const d = Seav.daysBetween(from, to);
        const seatimes = Seav.load("seav_seatimes", []);
        seatimes.unshift({ vessel, role, from, to, days: d, status, type });
        Seav.save("seav_seatimes", seatimes);

        seatimeForm.reset();
        if (window.SeavModals?.closeAllModals) window.SeavModals.closeAllModals();

        renderSeatimes();

        // If dashboard module is loaded elsewhere, safe refresh
        if (window.SeavDashboard?.refresh) window.SeavDashboard.refresh();
      });
    }

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

  document.addEventListener("DOMContentLoaded", initSeatime);
})();