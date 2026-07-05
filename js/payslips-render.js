// /js/payslips-render.js
(function () {
  "use strict";
  const C = window.SeavPayslipsCore;
  if (!C || !window.Seav) return;
  const {
    getFilteredEntries, getVesselName, expandedPsIds, getEntries,
    filterEntriesForYear, activeYearMonthFilters, getMonthFilterOptionsHtml,
    hasStoredAttachment, getAttachmentUrl
  } = C;
  const {
    formatDatePretty, formatMoneyAmount, getPayslipMonthLabel, normalizePayslipMonth,
    PAYSLIP_TAX_YEAR_MONTHS, getPayslipMonthsLogged
  } = window.SeavData;
  const Seav = window.Seav;
  function buildRow(entry) {
    const entryId = entry.id || "";
    const paymentDate = entry.paymentDate
      ? formatDatePretty(entry.paymentDate)
      : "—";
    const vesselName = getVesselName(entry.vesselId);
    const fileUrl = getAttachmentUrl(entry.attachment);
    const hasFile = hasStoredAttachment(entry.attachment);
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
                  fileUrl
                    ? `<a class="ps-attachment-link" href="${Seav.escapeHtml(fileUrl)}" target="_blank" rel="noopener">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M12 3v10m0 0l3.5-3.5M12 13l-3.5-3.5M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        View payslip
                      </a>`
                    : hasFile
                      ? `<span class="muted">Loading payslip…</span>`
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

    if (C.activeTaxYearFilter) {
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


  window.SeavPayslipsRender = { buildRow, renderList };
})();