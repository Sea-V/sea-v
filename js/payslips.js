// /js/payslips.js
(function () {
  "use strict";

  if (!window.Seav || !window.SeavAPI || !window.SeavData || !window.SeavState) {
    console.warn("[SEA-V] Payslips dependencies missing.");
    return;
  }

  const {
    KEYS,
    createId,
    formatDatePretty,
    PAYSLIP_CURRENCIES,
    PAYSLIP_TAX_YEAR_MONTHS,
    getUkTaxYearOptions,
    inferUkTaxYear,
    normalizePayslipMonth,
    getPayslipMonthLabel,
    getPayslipMonthsLogged,
    inferPayslipMonthFromDate,
    formatMoneyAmount,
    getSortedVesselOptions
  } = window.SeavData;

  const STORAGE_KEY = KEYS.PAYSLIPS;
  const expandedPsIds = new Set();
  let activeTaxYearFilter = "";
  const activeYearMonthFilters = {};

  function getEntries() {
    return window.SeavState?.payslips || [];
  }

  function getFilteredEntries() {
    const entries = getEntries();
    if (!activeTaxYearFilter) return entries;
    return entries.filter((entry) => entry.taxYear === activeTaxYearFilter);
  }

  function getVesselName(vesselId) {
    if (!vesselId) return "";
    const vessel = (window.SeavState?.vessels || []).find((v) => v.id === vesselId);
    return vessel?.name || "";
  }

  function getTaxYearsForFilter() {
    const years = getUkTaxYearOptions();
    const loggedYears = [
      ...new Set(getEntries().map((entry) => entry.taxYear).filter(Boolean))
    ].filter((year) => !years.includes(year));

    return [...new Set([...years, ...loggedYears])].sort().reverse();
  }

  function getMonthFilterOptionsHtml(taxYear, selectedMonth = "") {
    const taken = getPayslipMonthsLogged(taxYear, getEntries());

    return `
      <option value="">All months</option>
      ${PAYSLIP_TAX_YEAR_MONTHS.map((month) => {
        const logged = taken.has(month.value);
        const label = getPayslipMonthLabel(month.value, taxYear);
        const status = logged ? "Logged" : "Missing";
        return `<option value="${Seav.escapeHtml(month.value)}"${
          selectedMonth === month.value ? " selected" : ""
        }>${Seav.escapeHtml(`${label} · ${status}`)}</option>`;
      }).join("")}
    `;
  }

  function filterEntriesForYear(entries, taxYear) {
    const monthFilter = activeYearMonthFilters[taxYear] || "";
    if (!monthFilter) return entries;

    return entries.filter(
      (entry) => normalizePayslipMonth(entry) === monthFilter
    );
  }

  function populateTaxYearOptions(selectId, includeAllOption = false) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const current = select.value || "";
    const allYears = getTaxYearsForFilter();

    select.innerHTML = includeAllOption
      ? `<option value="">All tax years</option>`
      : `<option value="">Which tax year is this for?</option>`;

    allYears.forEach((year) => {
      select.innerHTML += `<option value="${Seav.escapeHtml(year)}">${Seav.escapeHtml(
        year
      )}</option>`;
    });

    if (current) select.value = current;
  }

  function populateCurrencyOptions() {
    const select = document.getElementById("ps_currency");
    if (!select) return;

    const current = select.value || "GBP";
    select.innerHTML = PAYSLIP_CURRENCIES.map(
      (item) =>
        `<option value="${Seav.escapeHtml(item.value)}">${Seav.escapeHtml(item.label)}</option>`
    ).join("");
    select.value = current;
  }

  function populateMonthOptions(taxYear, excludeEntryId = null, preferredMonth = "") {
    const select = document.getElementById("ps_pay_month");
    const hint = document.getElementById("ps_month_hint");
    if (!select) return;

    const current = preferredMonth || select.value || "";

    if (!taxYear) {
      select.innerHTML = `<option value="">Pick a tax year first</option>`;
      select.disabled = true;
      if (hint) {
        hint.textContent =
          "One payslip per month, per tax year — logged months are removed from the list.";
      }
      return;
    }

    const taken = getPayslipMonthsLogged(taxYear, getEntries(), excludeEntryId);
    const available = PAYSLIP_TAX_YEAR_MONTHS.filter((month) => !taken.has(month.value));

    if (current && taken.has(current)) {
      const currentMonth = PAYSLIP_TAX_YEAR_MONTHS.find((month) => month.value === current);
      if (currentMonth && !available.some((month) => month.value === current)) {
        available.unshift(currentMonth);
      }
    }

    select.disabled = available.length === 0;

    if (!available.length) {
      select.innerHTML = `<option value="">All 12 months logged for ${Seav.escapeHtml(taxYear)}</option>`;
      if (hint) {
        hint.textContent = `All 12 months logged for ${taxYear}. Delete or edit an existing payslip to change a month.`;
      }
      return;
    }

    select.innerHTML = `
      <option value="">Which month does this payslip cover?</option>
      ${available
        .map(
          (month) =>
            `<option value="${Seav.escapeHtml(month.value)}">${Seav.escapeHtml(
              getPayslipMonthLabel(month.value, taxYear)
            )}</option>`
        )
        .join("")}
    `;

    if (current && available.some((month) => month.value === current)) {
      select.value = current;
    }

    if (hint) {
      const remaining = PAYSLIP_TAX_YEAR_MONTHS.length - taken.size;
      hint.textContent = `${taken.size} of 12 months logged for ${taxYear} — ${remaining} remaining.`;
    }
  }

  function populateVesselOptions() {
    const select = document.getElementById("ps_vessel");
    if (!select) return;

    const current = select.value || "";
    const options = getSortedVesselOptions(window.SeavState?.vessels || []);

    select.innerHTML = `
      <option value="">Link to a vessel if this pay relates to one</option>
      ${options
        .map(
          (v) =>
            `<option value="${Seav.escapeHtml(v.id)}">${Seav.escapeHtml(v.name)}</option>`
        )
        .join("")}
    `;
    if (current) select.value = current;
  }

  function renderKpis() {
    const row = document.getElementById("psKpiRow");
    if (!row) return;

    const entries = getFilteredEntries();
    const withFile = entries.filter(
      (entry) => entry.attachment?.url || entry.attachment?.dataUrl
    ).length;
    const taxYears = new Set(entries.map((entry) => entry.taxYear).filter(Boolean)).size;
    const totalNet = entries.reduce((sum, entry) => {
      const value = Number(entry.netAmount);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
    const currency = entries.find((entry) => entry.currency)?.currency || "GBP";

    const taxYear = activeTaxYearFilter || getFilteredEntries()[0]?.taxYear || "";
    const monthsLogged = taxYear
      ? getPayslipMonthsLogged(taxYear, getEntries()).size
      : "—";

    row.innerHTML = `
      <div class="ps-kpi-box">
        <div class="kpi-num">${entries.length}</div>
        <div class="kpi-label">Payslips logged</div>
      </div>
      <div class="ps-kpi-box">
        <div class="kpi-num">${withFile}</div>
        <div class="kpi-label">With PDF</div>
      </div>
      <div class="ps-kpi-box">
        <div class="kpi-num">${taxYear ? `${monthsLogged}/12` : taxYears || "—"}</div>
        <div class="kpi-label">${taxYear ? "Months this year" : "Tax years"}</div>
      </div>
      <div class="ps-kpi-box">
        <div class="kpi-num">${entries.length ? formatMoneyAmount(totalNet, currency) : "—"}</div>
        <div class="kpi-label">Net total (filtered)</div>
      </div>
    `;
  }

  function buildRow(entry) {
    const entryId = entry.id || "";
    const paymentDate = entry.paymentDate
      ? formatDatePretty(entry.paymentDate)
      : "—";
    const vesselName = getVesselName(entry.vesselId);
    const fileUrl = entry.attachment?.url || entry.attachment?.dataUrl || "";
    const hasFile = !!fileUrl;
    const isExpanded = expandedPsIds.has(entryId);
    const netLabel =
      entry.netAmount !== "" && entry.netAmount != null
        ? formatMoneyAmount(entry.netAmount, entry.currency)
        : entry.grossAmount !== "" && entry.grossAmount != null
          ? formatMoneyAmount(entry.grossAmount, entry.currency)
          : "—";

    const title =
      getPayslipMonthLabel(normalizePayslipMonth(entry), entry.taxYear) ||
      entry.payPeriod ||
      entry.employer ||
      "Payslip";
    const subParts = [
      entry.taxYear || "No tax year",
      paymentDate !== "—" ? `Paid ${paymentDate}` : null,
      entry.employer || null,
      vesselName || null
    ].filter(Boolean);

    return `
      <article class="ps-compact-card ui-card ui-card-hover ui-accent-bronze${
        isExpanded ? " is-expanded" : ""
      }" data-ps-id="${Seav.escapeHtml(entryId)}">

        <button
          type="button"
          class="ps-compact-summary"
          aria-expanded="${isExpanded ? "true" : "false"}"
          data-toggle-ps-id="${Seav.escapeHtml(entryId)}"
        >
          <div class="ps-compact-summary-left">
            <div class="ps-compact-title">${Seav.escapeHtml(title)}</div>
            <div class="ps-compact-sub">${Seav.escapeHtml(subParts.join(" • "))}</div>
          </div>
          <div class="ps-compact-summary-right">
            <span class="ps-amount-pill">${Seav.escapeHtml(netLabel)}</span>
            ${
              hasFile
                ? `<span class="ps-amount-pill ps-file-pill">PDF</span>`
                : `<span class="ps-amount-pill">No file</span>`
            }
            <span class="ps-chevron" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </div>
        </button>

        <div class="ps-compact-body"${isExpanded ? "" : " hidden"}>
          <div class="ps-detail-grid">
            <div class="ps-detail-panel">
              <div class="ps-detail-label">Pay details</div>
              <div class="ps-detail-value">
                Tax year: ${Seav.escapeHtml(entry.taxYear || "—")}<br>
                Month: ${Seav.escapeHtml(
                  getPayslipMonthLabel(normalizePayslipMonth(entry), entry.taxYear)
                )}<br>
                Paid: ${Seav.escapeHtml(paymentDate)}
              </div>
            </div>
            <div class="ps-detail-panel">
              <div class="ps-detail-label">Employer & vessel</div>
              <div class="ps-detail-value">
                ${Seav.escapeHtml(entry.employer || "—")}<br>
                ${Seav.escapeHtml(vesselName || "—")}
              </div>
            </div>
            <div class="ps-detail-panel">
              <div class="ps-detail-label">Amounts</div>
              <div class="ps-detail-value">
                Gross: ${Seav.escapeHtml(
                  entry.grossAmount !== "" && entry.grossAmount != null
                    ? formatMoneyAmount(entry.grossAmount, entry.currency)
                    : "—"
                )}<br>
                Net: ${Seav.escapeHtml(
                  entry.netAmount !== "" && entry.netAmount != null
                    ? formatMoneyAmount(entry.netAmount, entry.currency)
                    : "—"
                )}<br>
                ${Seav.escapeHtml(entry.currency || "GBP")}
              </div>
            </div>
            <div class="ps-detail-panel">
              <div class="ps-detail-label">Payslip file</div>
              <div class="ps-detail-value">
                ${
                  hasFile
                    ? `<a class="ps-attachment-link" href="${Seav.escapeHtml(fileUrl)}" target="_blank" rel="noopener">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M12 3v10m0 0l3.5-3.5M12 13l-3.5-3.5M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        View payslip
                      </a>`
                    : "No payslip file uploaded"
                }
              </div>
            </div>
            ${
              entry.notes
                ? `<div class="ps-detail-panel ps-detail-panel-full">
                    <div class="ps-detail-label">Notes</div>
                    <div class="ps-detail-value">${Seav.escapeHtml(entry.notes)}</div>
                  </div>`
                : ""
            }
          </div>

          <div class="seav-actions seav-actions--compact">
            ${Seav.seavAction("edit", "Edit", `data-edit-ps-id="${Seav.escapeHtml(entryId)}"`)}
            ${Seav.seavAction("delete", "Delete", `data-del-ps-id="${Seav.escapeHtml(entryId)}"`)}
          </div>
        </div>
      </article>
    `;
  }

  function renderList() {
    const list = document.getElementById("psList");
    if (!list) return;

    const entries = [...getFilteredEntries()].sort((a, b) => {
      const monthA = normalizePayslipMonth(a);
      const monthB = normalizePayslipMonth(b);
      const order = PAYSLIP_TAX_YEAR_MONTHS.map((month) => month.value);
      const ia = monthA ? order.indexOf(monthA) : 99;
      const ib = monthB ? order.indexOf(monthB) : 99;
      if (ia !== ib) return ia - ib;
      const da = a.paymentDate ? new Date(a.paymentDate) : new Date(0);
      const db = b.paymentDate ? new Date(b.paymentDate) : new Date(0);
      return db - da;
    });

    if (!entries.length) {
      list.innerHTML = `
        <div class="list-row">
          <div>
            <div class="list-title">No payslips logged yet</div>
            <div class="list-sub">
              Add payslips by tax year, then download a pack for your accountant.
            </div>
          </div>
          <span class="pill">Private</span>
        </div>
      `;
      return;
    }

    if (activeTaxYearFilter) {
      list.innerHTML = entries.map(buildRow).join("");
      return;
    }

    const grouped = new Map();
    entries.forEach((entry) => {
      const key = entry.taxYear || "Unassigned";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(entry);
    });

    list.innerHTML = [...grouped.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([year, items]) => {
        const filteredItems = filterEntriesForYear(items, year);
        const sortedItems = [...filteredItems].sort((a, b) => {
          const order = PAYSLIP_TAX_YEAR_MONTHS.map((month) => month.value);
          const ia = order.indexOf(normalizePayslipMonth(a));
          const ib = order.indexOf(normalizePayslipMonth(b));
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });
        const monthFilter = activeYearMonthFilters[year] || "";
        const monthFilterLabel = monthFilter
          ? getPayslipMonthLabel(monthFilter, year)
          : "";

        return `
          <div class="ps-year-group">
            <div class="ps-year-head">
              <h4 class="ps-year-label">Tax year ${Seav.escapeHtml(year)} · ${getPayslipMonthsLogged(year, getEntries()).size}/12 months</h4>
              <label class="ps-filter-label ps-filter-label--inline">
                Month
                <select data-ps-year-month-filter="${Seav.escapeHtml(year)}">
                  ${getMonthFilterOptionsHtml(year, monthFilter)}
                </select>
              </label>
            </div>
            ${
              sortedItems.length
                ? sortedItems.map(buildRow).join("")
                : `<div class="ps-month-empty">${
                    monthFilterLabel
                      ? `No payslip logged for ${Seav.escapeHtml(monthFilterLabel)}.`
                      : "No payslips logged for this tax year yet."
                  }</div>`
            }
          </div>
        `;
      })
      .join("");
  }

  function readForm() {
    const payMonth = document.getElementById("ps_pay_month")?.value || "";
    return {
      id: document.getElementById("ps_edit_id")?.value.trim() || "",
      taxYear: document.getElementById("ps_tax_year")?.value || "",
      payMonth,
      payPeriod: payMonth,
      paymentDate: Seav.readDateTriplet("ps_payment_date"),
      employer: document.getElementById("ps_employer")?.value.trim() || "",
      vesselId: document.getElementById("ps_vessel")?.value || "",
      grossAmount: document.getElementById("ps_gross")?.value.trim() || "",
      netAmount: document.getElementById("ps_net")?.value.trim() || "",
      currency: document.getElementById("ps_currency")?.value || "GBP",
      notes: document.getElementById("ps_notes")?.value.trim() || "",
      file: document.getElementById("ps_file")?.files?.[0] || null
    };
  }

  function fillForm(entry) {
    const entryId = entry?.id || "";
    const payMonth = entry ? normalizePayslipMonth(entry) : "";

    document.getElementById("ps_edit_id").value = entryId;
    document.getElementById("ps_tax_year").value = entry?.taxYear || activeTaxYearFilter || "";
    populateMonthOptions(entry?.taxYear || activeTaxYearFilter || "", entryId, payMonth);
    document.getElementById("ps_pay_month").value = payMonth;
    document.getElementById("ps_employer").value = entry?.employer || "";
    document.getElementById("ps_vessel").value = entry?.vesselId || "";
    document.getElementById("ps_gross").value =
      entry?.grossAmount !== "" && entry?.grossAmount != null ? entry.grossAmount : "";
    document.getElementById("ps_net").value =
      entry?.netAmount !== "" && entry?.netAmount != null ? entry.netAmount : "";
    document.getElementById("ps_currency").value = entry?.currency || "GBP";
    document.getElementById("ps_notes").value = entry?.notes || "";
    Seav.setDateTriplet("ps_payment_date", entry?.paymentDate || "");
    const fileInput = document.getElementById("ps_file");
    if (fileInput) fileInput.value = "";
  }

  async function buildAttachment(file, existing, entryId) {
    if (!file) return existing || null;

    if (window.SeavSupabase) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = SeavAPI.buildStoragePath(entryId, safeName);

      const { error } = await window.SeavSupabase.storage
        .from("payslip-files")
        .upload(filePath, file, { cacheControl: "3600", upsert: true });

      if (error) {
        console.error("[SEA-V] Payslip upload failed:", error);
        const hint = /row-level security|bucket not found|does not exist/i.test(
          error.message || ""
        )
          ? "Run docs/payslips-table.sql in Supabase (storage bucket + policies)."
          : error.message || "Please try again.";
        Seav.notify("error", "Upload failed", hint);
        return existing || null;
      }

      return SeavAPI.buildUploadedFileMeta("payslip-files", filePath, file);
    }

    return await Seav.buildStoredFile(file, {
      fallback: existing || null,
      kind: "Payslip"
    });
  }

  function safeFileName(name) {
    return String(name || "file")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80);
  }

  function dataUrlToBlob(dataUrl) {
    const parts = String(dataUrl).split(",");
    const mime = parts[0].match(/:(.*?);/)?.[1] || "application/octet-stream";
    const binary = atob(parts[1] || "");
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function csvEscape(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function buildSummaryCsv(entries) {
    const rows = [
      [
        "Tax Year",
        "Month",
        "Payment Date",
        "Employer",
        "Vessel",
        "Gross",
        "Net",
        "Currency",
        "Notes",
        "Attachment"
      ]
    ];

    entries.forEach((entry) => {
      rows.push([
        entry.taxYear || "",
        getPayslipMonthLabel(normalizePayslipMonth(entry), entry.taxYear),
        entry.paymentDate || "",
        entry.employer || "",
        getVesselName(entry.vesselId),
        entry.grossAmount ?? "",
        entry.netAmount ?? "",
        entry.currency || "GBP",
        entry.notes || "",
        entry.attachment?.filename || ""
      ]);
    });

    return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  }

  async function buildPayslipZip(entries) {
    if (!entries.length) {
      throw new Error("No payslips available for export.");
    }

    if (typeof JSZip === "undefined") {
      throw new Error("JSZip not loaded.");
    }

    const zip = new JSZip();
    const skipped = [];
    const folderName = activeTaxYearFilter
      ? `sea-v-payslips-${safeFileName(activeTaxYearFilter)}`
      : "sea-v-payslips";
    const folder = zip.folder(folderName);

    folder.file("payslip-summary.csv", buildSummaryCsv(entries));
    folder.file("payslip-summary.json", JSON.stringify(entries, null, 2));

    for (const [index, entry] of entries.entries()) {
      const attachment = entry.attachment || {};
      const fileUrl = attachment.url || "";
      const dataUrl = attachment.dataUrl || "";
      if (!fileUrl && !dataUrl) continue;

      let blob = null;
      const label =
        getPayslipMonthLabel(normalizePayslipMonth(entry), entry.taxYear) ||
        entry.payPeriod ||
        `Payslip ${index + 1}`;

      if (dataUrl) {
        blob = dataUrlToBlob(dataUrl);
      } else if (fileUrl) {
        try {
          const response = await fetch(fileUrl);
          if (!response.ok) {
            skipped.push(label);
            continue;
          }
          blob = await response.blob();
        } catch (err) {
          console.warn("[SEA-V] Payslip attachment fetch failed:", err);
          skipped.push(label);
          continue;
        }
      }

      if (!blob) {
        skipped.push(label);
        continue;
      }

      const period = safeFileName(label || `payslip-${index + 1}`);
      const originalName = safeFileName(attachment.filename || "payslip.pdf");
      const fileName = `${String(index + 1).padStart(2, "0")}-${period}-${originalName}`;
      folder.file(fileName, blob);
    }

    return {
      blob: await zip.generateAsync({ type: "blob" }),
      skipped
    };
  }

  function notifyZipSkipped(skipped, label = "ZIP export") {
    if (!skipped.length) return;
    Seav.notify(
      "info",
      "Some files were skipped",
      `${skipped.length} payslip file${skipped.length === 1 ? "" : "s"} could not be included in the ${label}. Refresh the page and try again. Skipped: ${skipped.slice(0, 3).join(", ")}${skipped.length > 3 ? "…" : ""}.`
    );
  }

  async function downloadPayslipPack() {
    const entries = getFilteredEntries();
    const { blob: zipBlob, skipped } = await buildPayslipZip(entries);
    notifyZipSkipped(skipped, "payslip pack");
    const suffix = activeTaxYearFilter ? safeFileName(activeTaxYearFilter) : "all";
    downloadBlob(zipBlob, `sea-v-payslips-${suffix}.zip`);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function sharePayslipPack() {
    const entries = getFilteredEntries();
    const { blob: zipBlob, skipped } = await buildPayslipZip(entries);
    notifyZipSkipped(skipped, "payslip pack");
    const suffix = activeTaxYearFilter ? safeFileName(activeTaxYearFilter) : "all";
    const filename = `sea-v-payslips-${suffix}.zip`;
    const zipFile = new File([zipBlob], filename, { type: "application/zip" });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [zipFile] })) {
      await navigator.share({
        title: "SEA-V Payslip Pack",
        text: "Payslip export from SEA-V",
        files: [zipFile]
      });
      return;
    }

    downloadBlob(zipBlob, filename);
    throw new Error("Direct share not available on this device/browser. ZIP downloaded instead.");
  }

  async function refreshView() {
    populateTaxYearOptions("psTaxYearFilter", true);
    populateTaxYearOptions("ps_tax_year", false);
    populateCurrencyOptions();
    populateVesselOptions();
    renderKpis();
    renderList();
  }

  function initPayslips() {
    if (!document.getElementById("psList") && !document.getElementById("psForm")) {
      return;
    }

    const filter = document.getElementById("psTaxYearFilter");
    if (filter) {
      filter.addEventListener("change", () => {
        activeTaxYearFilter = filter.value || "";
        Object.keys(activeYearMonthFilters).forEach((key) => {
          delete activeYearMonthFilters[key];
        });
        refreshView();
      });
    }

    document.addEventListener("change", (e) => {
      const monthFilter = e.target.closest("[data-ps-year-month-filter]");
      if (!monthFilter || activeTaxYearFilter) return;

      const taxYear = monthFilter.getAttribute("data-ps-year-month-filter") || "";
      if (!taxYear) return;

      activeYearMonthFilters[taxYear] = monthFilter.value || "";
      renderList();
    });

    const runRefresh = () => refreshView();

    if (window.SeavState?.ready) {
      runRefresh();
    } else {
      document.addEventListener("seav:state-ready", runRefresh, { once: true });
    }

    document.addEventListener("seav:data-updated", runRefresh);

    const downloadBtn = document.getElementById("btnDownloadPayslipPack");
    const shareBtn = document.getElementById("btnSharePayslipPack");
    const exportMsg = document.getElementById("psExportMsg");

    if (downloadBtn) {
      downloadBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          await downloadPayslipPack();
          if (exportMsg) {
            exportMsg.textContent = "Payslip pack downloaded for your accountant.";
          }
        } catch (err) {
          Seav.notify("error", "Download failed", err.message || "Could not download payslips.");
        }
      });
    }

    if (shareBtn) {
      shareBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          await sharePayslipPack();
          if (exportMsg) {
            exportMsg.textContent = "Payslip pack shared.";
          }
        } catch (err) {
          if (exportMsg) {
            exportMsg.textContent =
              err.message || "Share unavailable. ZIP downloaded instead.";
          }
        }
      });
    }

    const form = document.getElementById("psForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = readForm();
        if (!formData.taxYear) {
          Seav.notify("error", "Missing details", "Please select a tax year.");
          return;
        }
        if (!formData.payMonth) {
          Seav.notify("error", "Missing details", "Please select a month.");
          return;
        }

        const taken = getPayslipMonthsLogged(
          formData.taxYear,
          getEntries(),
          formData.id || null
        );
        if (taken.has(formData.payMonth)) {
          Seav.notify(
            "error",
            "Month already logged",
            `${getPayslipMonthLabel(formData.payMonth, formData.taxYear)} is already recorded for ${formData.taxYear}.`
          );
          return;
        }

        const existing = formData.id
          ? getEntries().find((item) => item.id === formData.id) || null
          : null;

        await Seav.withSaving(async () => {
        const entryId = formData.id || createId("payslip");
        const attachment = await buildAttachment(
          formData.file,
          existing?.attachment || null,
          entryId
        );
        if (formData.file && !attachment) return;

        const now = new Date().toISOString();

        await SeavAPI.upsertItemById(STORAGE_KEY, {
          id: entryId,
          taxYear: formData.taxYear,
          payPeriod: formData.payPeriod,
          paymentDate: formData.paymentDate,
          employer: formData.employer,
          vesselId: formData.vesselId,
          grossAmount: formData.grossAmount,
          netAmount: formData.netAmount,
          currency: formData.currency,
          notes: formData.notes,
          attachment,
          createdAt: existing?.createdAt || now,
          updatedAt: now
        });

        form.reset();
        document.getElementById("ps_edit_id").value = "";
        Seav.clearDateTriplet("ps_payment_date");
        if (window.SeavModals?.closeAllModals) window.SeavModals.closeAllModals();

        Seav.notify("success", "Payslip saved", "Record stored privately in SEA-V.");

        if (window.Seav.app?.refreshAll) {
          await window.Seav.app.refreshAll();
        } else {
          await refreshView();
        }
        }, { sub: "Saving payslip record" });
      });
    }

    document.getElementById("psForm")?.addEventListener("change", (e) => {
      const target = e.target;
      if (!target) return;

      if (target.id === "ps_tax_year") {
        const editId = document.getElementById("ps_edit_id")?.value.trim() || null;
        populateMonthOptions(target.value, editId);
        return;
      }

      if (!String(target.id || "").startsWith("ps_payment_date_")) return;

      const paymentDate = Seav.readDateTriplet("ps_payment_date");
      const taxYearSelect = document.getElementById("ps_tax_year");
      const monthSelect = document.getElementById("ps_pay_month");
      if (!paymentDate || !taxYearSelect) return;

      if (!taxYearSelect.value) {
        const inferredYear = inferUkTaxYear(paymentDate);
        if (inferredYear) {
          taxYearSelect.value = inferredYear;
          populateMonthOptions(inferredYear, document.getElementById("ps_edit_id")?.value || null);
        }
      }

      if (monthSelect && !monthSelect.value && taxYearSelect.value) {
        const inferredMonth = inferPayslipMonthFromDate(paymentDate, taxYearSelect.value);
        if (inferredMonth) {
          const taken = getPayslipMonthsLogged(
            taxYearSelect.value,
            getEntries(),
            document.getElementById("ps_edit_id")?.value || null
          );
          if (!taken.has(inferredMonth)) {
            monthSelect.value = inferredMonth;
          }
        }
      }
    });

    document.addEventListener("click", async (e) => {
      const toggleBtn = e.target.closest("[data-toggle-ps-id]");
      if (toggleBtn) {
        const entryId = toggleBtn.getAttribute("data-toggle-ps-id");
        if (expandedPsIds.has(entryId)) {
          expandedPsIds.delete(entryId);
        } else {
          expandedPsIds.add(entryId);
        }
        renderList();
        return;
      }

      const editBtn = e.target.closest("[data-edit-ps-id]");
      if (editBtn) {
        const entryId = editBtn.getAttribute("data-edit-ps-id");
        const item = getEntries().find((entry) => entry.id === entryId);
        if (!item) return;

        fillForm(item);
        populateTaxYearOptions("ps_tax_year", false);
        populateCurrencyOptions();
        populateVesselOptions();
        Seav.mountDateFields();
        populateMonthOptions(item.taxYear, item.id, normalizePayslipMonth(item));
        if (window.SeavModals?.openModal) window.SeavModals.openModal("psModal");
        return;
      }

      const delBtn = e.target.closest("[data-del-ps-id]");
      if (delBtn) {
        const entryId = delBtn.getAttribute("data-del-ps-id");
        const item = getEntries().find((entry) => entry.id === entryId);
        if (!item) return;

        const confirmed = await Seav.confirmDelete({
          itemLabel: "payslip",
          itemName:
            getPayslipMonthLabel(normalizePayslipMonth(item), item.taxYear) ||
            item.employer ||
            "this entry"
        });
        if (!confirmed) return;

        await SeavAPI.deleteItemById(STORAGE_KEY, entryId);
        expandedPsIds.delete(entryId);

        Seav.notify("success", "Deleted", "Payslip removed from your records.");

        if (window.Seav.app?.refreshAll) {
          await window.Seav.app.refreshAll();
        } else {
          await refreshView();
        }
      }
    });

    document.addEventListener("click", (e) => {
      const openBtn = e.target.closest('[data-open="psModal"]');
      if (!openBtn) return;

      fillForm(null);
      populateTaxYearOptions("ps_tax_year", false);
      if (activeTaxYearFilter) {
        document.getElementById("ps_tax_year").value = activeTaxYearFilter;
      }
      populateMonthOptions(document.getElementById("ps_tax_year")?.value || "", null);
      populateCurrencyOptions();
      populateVesselOptions();
      Seav.mountDateFields();
    });
  }

  document.addEventListener("DOMContentLoaded", initPayslips);
})();
