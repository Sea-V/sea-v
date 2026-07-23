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
  const SEATIME_FILE_BUCKET =
    window.SeavApiCore?.STORAGE_BUCKETS?.SEATIME_FILES || "seatime-files";

  async function ensureSeatimeAttachmentsHydrated() {
    const seatimes = getSeatimes();
    if (!seatimes.length || !window.SeavApiCore?.hydrateItemsFileField) return;

    await window.SeavApiCore.hydrateItemsFileField(
      seatimes,
      "attachment",
      SEATIME_FILE_BUCKET
    );
    window.SeavState?.syncCache?.();
  }

  function getSeatimeAttachmentUrl(attachment) {
    return Seav.getFileDisplayUrl(attachment, SEATIME_FILE_BUCKET);
  }

  function hasSeatimeAttachment(attachment) {
    return (
      window.SeavApiCore?.hasStoredFile?.(attachment) ??
      !!getSeatimeAttachmentUrl(attachment)
    );
  }

  // Mirrors the Profile/Vessels upload-box pattern — previously st_attachment
  // was a bare <input type="file"> with no indication an entry already had a
  // testimonial attached before re-uploading.
  function renderSeatimeAttachmentHint(attachmentMeta, { isNewSelection = false } = {}) {
    const hint = document.getElementById("stAttachmentHint");
    const btn = document.getElementById("stAttachmentBtn");

    if (isNewSelection) {
      if (hint) {
        hint.textContent = attachmentMeta?.filename
          ? `New file selected: ${attachmentMeta.filename} — click Save service entry to apply`
          : "New file selected — click Save service entry to apply";
      }
      if (btn) btn.textContent = "Change file";
      return;
    }

    const docUrl = attachmentMeta ? getSeatimeAttachmentUrl(attachmentMeta) : "";
    const filename = attachmentMeta?.filename || "";

    if (hint) {
      hint.textContent = docUrl
        ? (filename ? `Current file: ${filename}` : "Current file uploaded")
        : "No file uploaded yet";
    }

    if (btn) {
      btn.textContent = docUrl ? "Change file" : "Choose file";
    }
  }

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

  function parseVesselLengthMeters(raw) {
    const match = String(raw || "").match(/(\d+(\.\d+)?)/);
    return match ? Number(match[1]) : 0;
  }

  function daysBetween(startIso, endIso) {
    const start = startIso ? new Date(startIso) : null;
    const end = endIso ? new Date(endIso) : new Date();
    if (!start || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    const ms = end - start;
    return ms > 0 ? Math.round(ms / 86400000) : 0;
  }

  /**
   * Guide-only OOW (Yachts <3000GT) II/1 eligibility tracker.
   * Figures verified against MCA MSN 1858 (M+F) Amendment 2 (18 May 2026),
   * section 3.3 — the current in-force requirement as of this build:
   *   - 36 months' onboard yacht service (any vessel size) since age 16
   *   - Within that, 365 days seagoing service on vessels 15m+ load line length:
   *       - minimum 250 days actual sea service
   *       - 115 days from any combination of actual/standby/yard, where
   *         standby never exceeds that voyage's actual sea days and yard
   *         service counts up to a max of 90 days total
   *   - TRB not required if 36 months' actual sea service on vessels 24m+
   * This works from each entry's day totals (not day-by-day consecutive
   * tracking), so it is a guide, not an official assessment.
   */
  function updateOowTracker(seatimes) {
    const monthsEl = document.getElementById("oowMonthsOnboard");
    const monthsBar = document.getElementById("oowMonthsBar");
    const monthsBox = document.getElementById("oowMonthsBox");
    const qualDaysEl = document.getElementById("oowQualifyingDays");
    const qualBar = document.getElementById("oowQualifyingBar");
    const qualBox = document.getElementById("oowQualifyingBox");
    const actualEl = document.getElementById("oowActualDays");
    const actualBar = document.getElementById("oowActualBar");
    const actualBox = document.getElementById("oowActualBox");
    const breakdownEl = document.getElementById("seatimeOowBreakdown");
    const statusEl = document.getElementById("seatimeOowStatus");
    const masterNoteEl = document.getElementById("seatimeOowMasterNote");

    if (!monthsEl && !qualDaysEl && !actualEl) return;

    const MONTHS_TARGET = 36;
    const QUALIFYING_TARGET = 365;
    const ACTUAL_MIN = 250;
    const YARD_CAP = 90;
    const TRB_EXEMPT_ACTUAL_DAYS = 1096; // ~36 months at 30.44 days/month

    let totalOnboardDays = 0;
    let totalActual15m = 0;
    let totalStandby15mCounted = 0;
    let totalYard15mRaw = 0;
    let totalActual24mPlus = 0;

    seatimes.forEach((entry) => {
      const vessel = getVesselById(entry.vesselId);
      const lengthM = parseVesselLengthMeters(
        vessel?.vessel_length || vessel?.length || entry.vesselLength
      );

      totalOnboardDays += daysBetween(entry.dateJoined, entry.dateLeft);

      const actual = toNumber(entry.actualSeaServiceDays);
      const standby = toNumber(entry.standbyServiceDays);
      const yard = toNumber(entry.yardServiceDays);

      if (lengthM >= 15) {
        totalActual15m += actual;
        // Standby can never exceed that voyage's own actual sea days.
        totalStandby15mCounted += Math.min(standby, actual);
        totalYard15mRaw += yard;
      }

      if (lengthM >= 24) {
        totalActual24mPlus += actual;
      }
    });

    const totalYard15mCounted = Math.min(totalYard15mRaw, YARD_CAP);
    const totalQualifying15m = totalActual15m + totalStandby15mCounted + totalYard15mCounted;
    const monthsOnboard = totalOnboardDays / 30.44;

    const monthsMet = monthsOnboard >= MONTHS_TARGET;
    const qualifyingMet = totalQualifying15m >= QUALIFYING_TARGET;
    const actualMet = totalActual15m >= ACTUAL_MIN;
    const allMet = monthsMet && qualifyingMet && actualMet;

    if (monthsEl) monthsEl.textContent = `${monthsOnboard.toFixed(1)} / ${MONTHS_TARGET} mo`;
    if (monthsBar) {
      monthsBar.style.width = `${Math.min(100, (monthsOnboard / MONTHS_TARGET) * 100)}%`;
    }
    if (monthsBox) monthsBox.classList.toggle("is-met", monthsMet);

    if (qualDaysEl) qualDaysEl.textContent = `${totalQualifying15m} / ${QUALIFYING_TARGET}`;
    if (qualBar) {
      qualBar.style.width = `${Math.min(100, (totalQualifying15m / QUALIFYING_TARGET) * 100)}%`;
    }
    if (qualBox) qualBox.classList.toggle("is-met", qualifyingMet);

    if (actualEl) actualEl.textContent = `${totalActual15m} / ${ACTUAL_MIN}`;
    if (actualBar) {
      actualBar.style.width = `${Math.min(100, (totalActual15m / ACTUAL_MIN) * 100)}%`;
    }
    if (actualBox) actualBox.classList.toggle("is-met", actualMet);

    if (statusEl) statusEl.hidden = !allMet;
    if (masterNoteEl) masterNoteEl.hidden = !allMet;

    if (breakdownEl) {
      const trbNote =
        totalActual24mPlus >= TRB_EXEMPT_ACTUAL_DAYS
          ? `Training Record Book exemption met — ${totalActual24mPlus} actual days logged on vessels 24m and over.`
          : `Training Record Book required unless you reach ~36 months of actual sea service on vessels 24m+ (${totalActual24mPlus} / ${TRB_EXEMPT_ACTUAL_DAYS} days so far).`;

      breakdownEl.innerHTML = `On vessels 15m and over: <strong>${totalActual15m}</strong> actual sea days, <strong>${totalStandby15mCounted}</strong> standby days counted, <strong>${totalYard15mCounted}</strong> of ${totalYard15mRaw} yard days counted (capped at ${YARD_CAP}). ${Seav.escapeHtml(trbNote)}`;
    }
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

        const attachmentUrl = getSeatimeAttachmentUrl(x.attachment);
        const hasAttachment = hasSeatimeAttachment(x.attachment);

        const attachCell = attachmentUrl
          ? `<a class="seav-action seav-action--secondary seatime-testimonial-link" href="${Seav.escapeHtml(attachmentUrl)}" target="_blank" rel="noopener">View SST</a>`
          : hasAttachment
            ? `<span class="seatime-no-file muted">Loading…</span>`
            : `<span class="seatime-no-file">Not uploaded</span>`;

        return `
          <tr>
            <td>${Seav.escapeHtml(displayVesselName)}</td>
            <td>${flagGt}</td>
            <td>${Seav.escapeHtml(x.capacityServed || "—")}</td>
            <td>${formatDatePretty(x.dateJoined)}${x.locationJoined ? `<br><small class="muted">${Seav.escapeHtml(x.locationJoined)}</small>` : ""}</td>
            <td>${x.dateLeft ? formatDatePretty(x.dateLeft) : "Present"}${x.locationLeft ? `<br><small class="muted">${Seav.escapeHtml(x.locationLeft)}</small>` : ""}</td>
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
    updateOowTracker(seatimes);
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
      "Location Signed On",
      "Date Left",
      "Location Signed Off",
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
        x.locationJoined || "",
        x.dateLeft || "",
        x.locationLeft || "",
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

    const locationJoinedEl = document.getElementById("st_location_joined");
    const locationLeftEl = document.getElementById("st_location_left");
    if (locationJoinedEl) locationJoinedEl.value = entry.locationJoined || "";
    if (locationLeftEl) locationLeftEl.value = entry.locationLeft || "";

    renderSeatimeAttachmentHint(entry.attachment || null, { isNewSelection: false });

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

    renderSeatimeAttachmentHint(null, { isNewSelection: false });

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
      locationJoined: document.getElementById("st_location_joined")?.value.trim() || "",
      locationLeft: document.getElementById("st_location_left")?.value.trim() || "",
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
    return window.SeavUpload?.uploadToStorage({
      bucket: "seatime-files",
      entityId: seatimeId,
      file,
      existingMeta: existingAttachment,
      kind: "Sea time attachment"
    }) ?? existingAttachment ?? null;
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

    const runRefresh = async () => {
      try {
        await ensureSeatimeAttachmentsHydrated();
      } catch (err) {
        console.warn("[SEA-V] Sea time attachment hydration failed:", err);
      }
      populateSeattimeVesselOptions();
      renderSeatimes();
    };

    Seav.bindStateRefresh(runRefresh, { label: "Sea time refresh" });

    const exportBtn = document.getElementById("btnExportSeatimeCsv");
    if (exportBtn) {
      exportBtn.addEventListener("click", (e) => {
        e.preventDefault();
        exportSeatimeCsv();
      });
    }

    const seatimeForm = document.getElementById("seatimeForm");
    const vesselSelect = document.getElementById("st_vessel");

    const stAttachmentInput = document.getElementById("st_attachment");
    const stAttachmentBtn = document.getElementById("stAttachmentBtn");
    if (stAttachmentBtn && stAttachmentInput) {
      stAttachmentBtn.addEventListener("click", () => stAttachmentInput.click());
    }
    if (stAttachmentInput) {
      stAttachmentInput.addEventListener("change", () => {
        const file = stAttachmentInput.files?.[0] || null;
        renderSeatimeAttachmentHint(file ? { filename: file.name } : null, { isNewSelection: !!file });
      });
    }

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
          locationJoined: formData.locationJoined,
          locationLeft: formData.locationLeft,
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

  }

  document.addEventListener("DOMContentLoaded", initSeatime);
})();