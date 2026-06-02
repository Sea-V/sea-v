// /js/seatime.js
(function () {
  "use strict";

  if (!window.Seav) {
    console.warn("[SEA-V] Seav core not found. Did you include js/core.js before seatime.js?");
    return;
  }

  if (!window.SeavData) {
    console.warn("[SEA-V] SeavData not found. Did you include js/seav-data.js before seatime.js?");
    return;
  }

  if (!window.SeavAPI) {
    console.warn("[SEA-V] SeavAPI not found. Did you include js/api.js before seatime.js?");
    return;
  }

  if (!window.SeavState) {
    console.warn("[SEA-V] SeavState not found. Did you include js/state.js before seatime.js?");
    return;
  }

  const {
    KEYS,
    createId,
    toNumber,
    totalQualifyingDays,
    getSeatimeTotals,
    getSortedVesselOptions,
    formatDatePretty
  } = window.SeavData;

  const STORAGE_KEY = KEYS.SEATIMES;

  function getSeatimes() {
    return window.SeavState?.seatimes || [];
  }

  function getVessels() {
    return window.SeavState?.vessels || [];
  }

  function getVesselById(vesselId) {
    if (!vesselId) return null;
    return getVessels().find((v) => v.id === vesselId) || null;
  }

  function getDisplayVesselName(entry) {
    const vessel = getVesselById(entry.vesselId);
    return vessel?.name || "—";
  }

  function getSeatimeDayValue(entry, longKey, shortKey) {
  return toNumber(entry?.[longKey] ?? entry?.[shortKey] ?? 0);
}

  function updateServiceKpisFromData(seatimes) {
    const kpiSea = document.getElementById("kpiSea");
    const kpiStandby = document.getElementById("kpiStandby");
    const kpiYard = document.getElementById("kpiYard");
    const kpiWatchkeeping = document.getElementById("kpiWatchkeeping");
    const kpiTotalDays = document.getElementById("kpiTotalDays");

    if (!kpiSea && !kpiStandby && !kpiYard && !kpiWatchkeeping && !kpiTotalDays) return;

    const totals = getSeatimeTotals(seatimes);

    if (kpiSea) kpiSea.textContent = String(totals.sea);
    if (kpiStandby) kpiStandby.textContent = String(totals.standby);
    if (kpiYard) kpiYard.textContent = String(totals.yard);
    if (kpiWatchkeeping) kpiWatchkeeping.textContent = String(totals.watchkeeping);
    if (kpiTotalDays) kpiTotalDays.textContent = String(totals.total);
  }

  function renderSeatimeRows(seatimes) {
    const seatimeBody = document.getElementById("seatimeBody");
    if (!seatimeBody) return;

    if (!seatimes.length) {
      seatimeBody.innerHTML = `
        <tr class="seatime-empty-row">
          <td colspan="13">
            <div class="seatime-empty-state">
              <strong>No sea service entries yet</strong>
              <span>Add your first vessel engagement with joined/left dates and day breakdown.</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    seatimeBody.innerHTML = seatimes
      .map((x) => {
        const seatimeId = x.id || "";
        const linkedVessel = getVesselById(x.vesselId);

        const displayVesselName = getDisplayVesselName(x);
        const flag = x.flag || linkedVessel?.flag || "—";
        const gt = x.gt || linkedVessel?.gt || "";

        const flagGt = [
          flag ? Seav.escapeHtml(flag) : "—",
          gt ? `${Seav.escapeHtml(gt)} GT` : "—"
        ].join(" • ");

        const total = totalQualifyingDays(x);

        const attachmentUrl = x.attachment?.url || x.attachment?.dataUrl || "";

        const attachCell = attachmentUrl
          ? `<a class="seav-action seav-action--secondary seatime-testimonial-link" href="${Seav.escapeHtml(attachmentUrl)}" target="_blank" rel="noopener">View SST</a>`
          : `<span class="seatime-no-file">Not uploaded</span>`;

        return `
          <tr>
            <td>${Seav.escapeHtml(displayVesselName)}</td>
            <td>${flagGt}</td>
            <td>${Seav.escapeHtml(x.capacityServed || "—")}</td>
            <td>${formatDatePretty(x.dateJoined)}</td>
            <td>${x.dateLeft ? formatDatePretty(x.dateLeft) : "Present"}</td>
            <td>${getSeatimeDayValue(x, "actualSeaServiceDays", "actualSea")}</td>
            <td>${getSeatimeDayValue(x, "standbyServiceDays", "standby")}</td>
            <td>${getSeatimeDayValue(x, "yardServiceDays", "yard")}</td>
            <td>${getSeatimeDayValue(x, "watchkeepingDays", "watchkeeping")}</td>
            <td>${total}</td>
            <td><span class="pill">${Seav.escapeHtml(x.verificationStatus || "Logged")}</span></td>
            <td>${attachCell}</td>
            <td class="row-actions">
              <a
                class="seav-action seav-action--secondary"
                href="navigation.html?seatime=${encodeURIComponent(seatimeId)}"
              >Add passage plan</a>
              ${Seav.seavAction(
                "edit",
                "Edit",
                `data-edit-seatime-id="${Seav.escapeHtml(seatimeId)}"`
              )}
              ${Seav.seavAction(
                "delete",
                "Delete",
                `data-del-seatime-id="${Seav.escapeHtml(seatimeId)}"`
              )}
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderSeatimes() {
    const seatimes = [...getSeatimes()].sort((a, b) => {
      const aDate = a.dateJoined ? new Date(a.dateJoined) : new Date(0);
      const bDate = b.dateJoined ? new Date(b.dateJoined) : new Date(0);
      return bDate - aDate;
    });

    renderSeatimeRows(seatimes);
    updateServiceKpisFromData(seatimes);
  }

  function populateSeattimeVesselOptions() {
    const select = document.getElementById("st_vessel");
    if (!select || select.tagName !== "SELECT") return;

    const currentValue = select.value || "";
    const vessels = getSortedVesselOptions(getVessels());

    select.innerHTML = `
      <option value="">Choose from your vessel list</option>
      ${vessels
        .map((v) => `<option value="${Seav.escapeHtml(v.id)}">${Seav.escapeHtml(v.name)}</option>`)
        .join("")}
    `;

    if (currentValue) {
      select.value = currentValue;
    }
  }

  function csvEscape(value) {
    const str = String(value ?? "");
    return `"${str.replace(/"/g, '""')}"`;
  }

  function downloadCsv(filename, rows) {
    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
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
    const seatimes = getSeatimes();

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
      const linkedVessel = getVesselById(x.vesselId);

      rows.push([
        getDisplayVesselName(x),
        x.flag || linkedVessel?.flag || "",
        x.gt || linkedVessel?.gt || "",
        x.imoOfficialNumber || linkedVessel?.imoOfficialNumber || "",
        x.capacityServed || "",
        x.dateJoined || "",
        x.dateLeft || "",
        getSeatimeDayValue(x, "actualSeaServiceDays", "actualSea"),
        getSeatimeDayValue(x, "standbyServiceDays", "standby"),
        getSeatimeDayValue(x, "yardServiceDays", "yard"),
        getSeatimeDayValue(x, "watchkeepingDays", "watchkeeping"),
        totalQualifyingDays(x),
        x.verificationStatus || "Logged",
        x.notes || ""
      ]);
    });

    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(`sea-service-export-${today}.csv`, rows);
  }

  function fillSeatimeForm(entry) {
    populateSeattimeVesselOptions();

    const vesselField = document.getElementById("st_vessel");
    if (vesselField) {
      vesselField.value = entry.vesselId || "";
    }

    document.getElementById("st_flag").value = entry.flag || "";
    document.getElementById("st_gt").value = entry.gt || "";
    document.getElementById("st_imo").value = entry.imoOfficialNumber || "";
    document.getElementById("st_role").value = entry.capacityServed || "";
    Seav.setDateTriplet("st_date_joined", entry.dateJoined || "");
    Seav.setDateTriplet("st_date_left", entry.dateLeft || "");

    document.getElementById("st_actual_sea").value =
      entry.actualSeaServiceDays > 0 ? String(entry.actualSeaServiceDays) : "";
    document.getElementById("st_standby").value =
      entry.standbyServiceDays > 0 ? String(entry.standbyServiceDays) : "";
    document.getElementById("st_yard").value =
      entry.yardServiceDays > 0 ? String(entry.yardServiceDays) : "";
    document.getElementById("st_watchkeeping").value =
      entry.watchkeepingDays > 0 ? String(entry.watchkeepingDays) : "";
    document.getElementById("st_status").value = entry.verificationStatus || "Logged";
    document.getElementById("st_notes").value = entry.notes || "";

    const editId = document.getElementById("st_edit_index");
    if (editId) editId.value = entry.id || "";

    if (window.SeavModals?.openModal) {
      window.SeavModals.openModal("seatimeModal");
    }
  }

  function resetSeatimeForm(form) {
    form.reset();

    document.getElementById("st_edit_index").value = "";
    Seav.clearDateTriplet("st_date_joined");
    Seav.clearDateTriplet("st_date_left");
    document.getElementById("st_actual_sea").value = "";
    document.getElementById("st_standby").value = "";
    document.getElementById("st_yard").value = "";
    document.getElementById("st_watchkeeping").value = "";

    populateSeattimeVesselOptions();
  }

  function applyVesselDefaultsToForm(vesselId) {
    const vessel = getVesselById(vesselId);
    if (!vessel) return;

    const flagEl = document.getElementById("st_flag");
    const gtEl = document.getElementById("st_gt");
    const imoEl = document.getElementById("st_imo");

    if (flagEl) flagEl.value = vessel.flag || "";
    if (gtEl) gtEl.value = vessel.gt || "";
    if (imoEl) imoEl.value = vessel.imoOfficialNumber || vessel.imo || "";
  }

  function readSeatimeForm() {
    const vesselValue = document.getElementById("st_vessel")?.value || "";

    return {
      id: document.getElementById("st_edit_index")?.value || "",
      vesselId: vesselValue,
      flag: document.getElementById("st_flag")?.value.trim() || "",
      gt: document.getElementById("st_gt")?.value.trim() || "",
      imoOfficialNumber: document.getElementById("st_imo")?.value.trim() || "",
      capacityServed: document.getElementById("st_role")?.value.trim() || "",
      dateJoined: Seav.readDateTriplet("st_date_joined"),
      dateLeft: Seav.readDateTriplet("st_date_left"),
      actualSeaServiceDays: toNumber(document.getElementById("st_actual_sea")?.value),
      standbyServiceDays: toNumber(document.getElementById("st_standby")?.value),
      yardServiceDays: toNumber(document.getElementById("st_yard")?.value),
      watchkeepingDays: toNumber(document.getElementById("st_watchkeeping")?.value),
      verificationStatus: document.getElementById("st_status")?.value || "Logged",
      notes: document.getElementById("st_notes")?.value.trim() || "",
      file: document.getElementById("st_attachment")?.files?.[0] || null
    };
  }

  async function buildSeatimeAttachment(file, existingAttachment, seatimeId) {
  if (!file) return existingAttachment || null;

  if (window.SeavSupabase) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = SeavAPI.buildStoragePath(seatimeId, safeName);

    const { error } = await window.SeavSupabase.storage
      .from("seatime-files")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true
      });

    if (error) {
      console.error("[SEA-V] Seatime attachment upload failed:", error);
      Seav.notify("error", "Upload failed", "Seatime attachment upload failed. Please try again.");
      return existingAttachment || null;
    }

    return SeavAPI.buildUploadedFileMeta("seatime-files", filePath, file);
  }

  return await Seav.buildStoredFile(file, {
    fallback: existingAttachment || null,
    kind: "Attachment"
  });
}

  async function saveSeatimeData(seatimeData) {
    await SeavAPI.upsertItemById(STORAGE_KEY, seatimeData);
  }

  function initSeatime() {
    if (
      !document.getElementById("seatimeBody") &&
      !document.getElementById("seatimeForm") &&
      !document.getElementById("btnExportSeatimeCsv")
    ) return;

    const runRefresh = () => {
      populateSeattimeVesselOptions();
      renderSeatimes();
    };

    if (window.SeavState?.ready) {
      runRefresh();
    } else {
      document.addEventListener("seav:state-ready", runRefresh, { once: true });
    }

    const exportBtn = document.getElementById("btnExportSeatimeCsv");
    if (exportBtn) {
      exportBtn.addEventListener("click", (e) => {
        e.preventDefault();
        exportSeatimeCsv();
      });
    }

    const seatimeForm = document.getElementById("seatimeForm");
    const vesselSelect = document.getElementById("st_vessel");

    if (vesselSelect) {
      vesselSelect.addEventListener("change", () => {
        applyVesselDefaultsToForm(vesselSelect.value);
      });
    }

    if (seatimeForm) {
      seatimeForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = readSeatimeForm();

        if (
          !formData.vesselId ||
          !formData.capacityServed ||
          !formData.dateJoined ||
          !formData.dateLeft
        ) {
          Seav.notify(
            "error",
            "Missing details",
            "Select a vessel and complete capacity served, date joined, and date left."
          );
          return;
        }

        if (new Date(formData.dateLeft) < new Date(formData.dateJoined)) {
          Seav.notify(
            "error",
            "Invalid dates",
            "Date left must be on or after date joined."
          );
          return;
        }

        const existingEntry = formData.id
          ? getSeatimes().find((item) => item.id === formData.id) || null
          : null;

        await Seav.withSaving(async () => {
        const seatimeId = formData.id || createId("seatime");

        const attachment = await buildSeatimeAttachment(
          formData.file,
          existingEntry?.attachment || null,
          seatimeId
        );

        if (formData.file && !attachment) return;

        const now = new Date().toISOString();

        const seatimeData = {
          id: seatimeId,
          vesselId: formData.vesselId,
          flag: formData.flag,
          gt: formData.gt,
          imoOfficialNumber: formData.imoOfficialNumber,
          capacityServed: formData.capacityServed,
          dateJoined: formData.dateJoined,
          dateLeft: formData.dateLeft,
          actualSeaServiceDays: formData.actualSeaServiceDays,
          standbyServiceDays: formData.standbyServiceDays,
          yardServiceDays: formData.yardServiceDays,
          watchkeepingDays: formData.watchkeepingDays,
          verificationStatus: formData.verificationStatus,
          notes: formData.notes,
          attachment,
          createdAt: existingEntry?.createdAt || now,
          updatedAt: now
        };

        await saveSeatimeData(seatimeData);

        resetSeatimeForm(seatimeForm);

        if (window.SeavModals?.closeAllModals) {
          window.SeavModals.closeAllModals();
        }

        Seav.notify("success", "Sea time logged", "Your service record has been updated.");

        if (window.Seav.app?.refreshAll) {
          await window.Seav.app.refreshAll();
        } else {
          renderSeatimes();
        }
        }, { sub: "Saving sea time entry" });
      });
    }

    document.addEventListener("click", async (e) => {
      const editBtn = e.target.closest("[data-edit-seatime-id]");
      if (editBtn) {
        e.preventDefault();

        const seatimeId = editBtn.getAttribute("data-edit-seatime-id");
        const entry = getSeatimes().find((item) => item.id === seatimeId);

        if (!entry) return;

        fillSeatimeForm(entry);
        return;
      }

      const delBtn = e.target.closest("[data-del-seatime-id]");
      if (!delBtn) return;

      e.preventDefault();

      const seatimeId = delBtn.getAttribute("data-del-seatime-id");
      const entry = getSeatimes().find((item) => item.id === seatimeId);
      const vesselName = entry ? getDisplayVesselName(entry) : "this sea service entry";

      if (
        !Seav.confirmDelete({
          itemName: vesselName !== "—" ? vesselName : "",
          itemLabel: "sea service entry"
        })
      ) {
        return;
      }

      await SeavAPI.deleteItemById(STORAGE_KEY, seatimeId);

      if (window.Seav.app?.refreshAll) {
        await window.Seav.app.refreshAll();
      } else {
        renderSeatimes();
      }
    });

    document.addEventListener("seav:data-updated", runRefresh);
  }

  document.addEventListener("DOMContentLoaded", initSeatime);
})();