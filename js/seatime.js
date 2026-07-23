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

  // Per-user "I hold the OOW cert and want to see Master progress" tick box —
  // a local preference, not official data, so it lives in localStorage rather
  // than Supabase (mirrors js/badge-unlock.js's per-user storageKey pattern).
  const OOW_MASTER_CONFIRM_KEY = "seav_oow_master_confirmed";
  let latestOowAllMet = false;

  function getOowMasterConfirmStorageKey() {
    const userId = window.SeavAuth?.getUserId?.();
    return userId ? `${OOW_MASTER_CONFIRM_KEY}_${userId}` : OOW_MASTER_CONFIRM_KEY;
  }

  function isOowMasterConfirmed() {
    try {
      return localStorage.getItem(getOowMasterConfirmStorageKey()) === "1";
    } catch {
      return false;
    }
  }

  function setOowMasterConfirmed(value) {
    try {
      localStorage.setItem(getOowMasterConfirmStorageKey(), value ? "1" : "0");
    } catch {
      /* ignore storage errors (private browsing, quota, etc.) */
    }
  }

  // Grid hides as soon as eligibility is met (pill takes over) — independent
  // of the tick box, which only gates the separate Master section reveal.
  function applyOowMasterVisibility(allMet, confirmed) {
    const oowGrid = document.getElementById("seatimeOowGrid");
    const masterSection = document.getElementById("seatimeMasterSection");
    if (oowGrid) oowGrid.hidden = allMet;
    if (masterSection) masterSection.hidden = !confirmed;
  }

  function wireOowMasterConfirmCheckbox() {
    const confirmCheck = document.getElementById("seatimeOowConfirmCheck");
    if (!confirmCheck || confirmCheck.dataset.wired) return;
    confirmCheck.dataset.wired = "1";
    confirmCheck.addEventListener("change", () => {
      setOowMasterConfirmed(confirmCheck.checked);
      applyOowMasterVisibility(latestOowAllMet, latestOowAllMet && confirmCheck.checked);
    });
  }

  /**
   * Guide-only OOW (Yachts <3000GT) II/1 eligibility tracker.
   * Figures verified against MCA MSN 1858 (M+F) Amendment 2 (18 May 2026),
   * section 3.3 — the current in-force requirement as of this build:
   *   - 365 days seagoing service on vessels 15m+ load line length:
   *       - minimum 250 days actual sea service
   *       - 115 days from any combination of actual/standby/yard, where
   *         standby never exceeds that voyage's actual sea days and yard
   *         service counts up to a max of 90 days total
   * (Section 3.3 also requires 36 months' onboard yacht service of any size
   * since age 16 — that leg isn't shown as its own box, but is covered in
   * the "read more" dropdown below since it's rarely the limiting factor.)
   * This works from each entry's day totals (not day-by-day consecutive
   * tracking), so it is a guide, not an official assessment. Once met, the
   * boxes above are replaced by a status pill and a tick box lets the crew
   * confirm they hold the cert before the Master <3000GT tracker appears.
   */
  function updateOowTracker(seatimes) {
    const qualDaysEl = document.getElementById("oowQualifyingDays");
    const qualBar = document.getElementById("oowQualifyingBar");
    const qualBox = document.getElementById("oowQualifyingBox");
    const actualEl = document.getElementById("oowActualDays");
    const actualBar = document.getElementById("oowActualBar");
    const actualBox = document.getElementById("oowActualBox");
    const breakdownEl = document.getElementById("seatimeOowBreakdown");
    const statusEl = document.getElementById("seatimeOowStatus");
    const confirmWrap = document.getElementById("seatimeOowConfirmWrap");
    const confirmCheck = document.getElementById("seatimeOowConfirmCheck");

    if (!qualDaysEl && !actualEl) return;

    const QUALIFYING_TARGET = 365;
    const ACTUAL_MIN = 250;
    const YARD_CAP = 90;

    let totalActual15m = 0;
    let totalStandby15mCounted = 0;
    let totalYard15mRaw = 0;

    seatimes.forEach((entry) => {
      const vessel = getVesselById(entry.vesselId);
      const lengthM = parseVesselLengthMeters(
        vessel?.vessel_length || vessel?.length || entry.vesselLength
      );

      const actual = toNumber(entry.actualSeaServiceDays);
      const standby = toNumber(entry.standbyServiceDays);
      const yard = toNumber(entry.yardServiceDays);

      if (lengthM >= 15) {
        totalActual15m += actual;
        // Standby can never exceed that voyage's own actual sea days.
        totalStandby15mCounted += Math.min(standby, actual);
        totalYard15mRaw += yard;
      }
    });

    const totalYard15mCounted = Math.min(totalYard15mRaw, YARD_CAP);
    const totalQualifying15m = totalActual15m + totalStandby15mCounted + totalYard15mCounted;

    const qualifyingMet = totalQualifying15m >= QUALIFYING_TARGET;
    const actualMet = totalActual15m >= ACTUAL_MIN;
    const allMet = qualifyingMet && actualMet;
    latestOowAllMet = allMet;

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
    if (confirmWrap) confirmWrap.hidden = !allMet;

    wireOowMasterConfirmCheckbox();
    const confirmed = allMet && isOowMasterConfirmed();
    if (confirmCheck) confirmCheck.checked = confirmed;
    applyOowMasterVisibility(allMet, confirmed);

    if (breakdownEl) {
      breakdownEl.innerHTML = `On vessels 15m and over: <strong>${totalActual15m}</strong> actual sea days, <strong>${totalStandby15mCounted}</strong> standby days counted, <strong>${totalYard15mCounted}</strong> of ${totalYard15mRaw} yard days counted (capped at ${YARD_CAP}).`;
    }

    updateMasterTracker(seatimes);
  }

  /**
   * Guide-only Master (Yachts <3000GT) II/2 sea-service tracker — MSN 1858
   * Amendment 2, section 3.6(a): while serving as OOW <3000GT, 240 days
   * watchkeeping service on vessels 15m+, including either 12 months on
   * vessels 24m+ or 6 months on vessels 500GT+. Only this sea-service leg is
   * trackable from logged data — ancillary certs, the Master <500GT CoC/
   * Celestial Nav (or equivalent modules), and the oral exam are separate
   * requirements not covered here. (Section 3.6(a) also requires 24 months'
   * onboard service as a Deck Officer — that leg isn't shown as its own box,
   * matching the OOW tracker's 36-month box above.) Revealed once the OOW
   * tracker above is confirmed via its tick box.
   */
  function updateMasterTracker(seatimes) {
    const watchEl = document.getElementById("masterWatchkeeping");
    const watchBar = document.getElementById("masterWatchkeepingBar");
    const watchBox = document.getElementById("masterWatchkeepingBox");
    const specialEl = document.getElementById("masterSpecial");
    const specialLabelEl = document.getElementById("masterSpecialLabel");
    const specialBar = document.getElementById("masterSpecialBar");
    const specialBox = document.getElementById("masterSpecialBox");
    const breakdownEl = document.getElementById("seatimeMasterBreakdown");
    const statusEl = document.getElementById("seatimeMasterStatus");

    if (!watchEl && !specialEl) return;

    const WATCHKEEPING_TARGET = 240;
    const SPECIAL_24M_TARGET = 12;
    const SPECIAL_500GT_TARGET = 6;

    let totalWatchkeeping15m = 0;
    let totalOnboard24mDays = 0;
    let totalOnboard500gtDays = 0;

    seatimes.forEach((entry) => {
      const vessel = getVesselById(entry.vesselId);
      const lengthM = parseVesselLengthMeters(
        vessel?.vessel_length || vessel?.length || entry.vesselLength
      );
      const gt = parseVesselLengthMeters(vessel?.gt);
      const days = daysBetween(entry.dateJoined, entry.dateLeft);

      if (lengthM >= 15) {
        totalWatchkeeping15m += toNumber(entry.watchkeepingDays);
      }
      if (lengthM >= 24) totalOnboard24mDays += days;
      if (gt >= 500) totalOnboard500gtDays += days;
    });

    const months24m = totalOnboard24mDays / 30.44;
    const months500gt = totalOnboard500gtDays / 30.44;

    const watchMet = totalWatchkeeping15m >= WATCHKEEPING_TARGET;

    // Show whichever specialised-experience path is further along.
    const use500gtPath = months500gt / SPECIAL_500GT_TARGET > months24m / SPECIAL_24M_TARGET;
    const specialValue = use500gtPath ? months500gt : months24m;
    const specialTarget = use500gtPath ? SPECIAL_500GT_TARGET : SPECIAL_24M_TARGET;
    const specialMet = months24m >= SPECIAL_24M_TARGET || months500gt >= SPECIAL_500GT_TARGET;
    const allMasterMet = watchMet && specialMet;

    if (watchEl) watchEl.textContent = `${totalWatchkeeping15m} / ${WATCHKEEPING_TARGET}`;
    if (watchBar) {
      watchBar.style.width = `${Math.min(100, (totalWatchkeeping15m / WATCHKEEPING_TARGET) * 100)}%`;
    }
    if (watchBox) watchBox.classList.toggle("is-met", watchMet);

    if (specialEl) specialEl.textContent = `${specialValue.toFixed(1)} / ${specialTarget} mo`;
    if (specialLabelEl) {
      specialLabelEl.textContent = use500gtPath
        ? "Months on vessels 500GT+"
        : "Months on vessels 24m+";
    }
    if (specialBar) {
      specialBar.style.width = `${Math.min(100, (specialValue / specialTarget) * 100)}%`;
    }
    if (specialBox) specialBox.classList.toggle("is-met", specialMet);

    if (statusEl) statusEl.hidden = !allMasterMet;

    if (breakdownEl) {
      breakdownEl.innerHTML = `On vessels 15m and over: <strong>${totalWatchkeeping15m}</strong> watchkeeping days. Specialised experience: <strong>${months24m.toFixed(1)}</strong> months on 24m+ vessels, <strong>${months500gt.toFixed(1)}</strong> months on 500GT+ vessels.`;
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