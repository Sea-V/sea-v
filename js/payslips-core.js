// /js/payslips-core.js
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
  const PS_FILE_BUCKET =
    window.SeavApiCore?.STORAGE_BUCKETS?.PAYSLIP_FILES || "payslip-files";
  const expandedPsIds = new Set();
  let activeTaxYearFilter = "";
  const activeYearMonthFilters = {};

  function hasStoredAttachment(attachment) {
    return (
      window.SeavApiCore?.hasStoredFile?.(attachment) ??
      !!(attachment?.url || attachment?.dataUrl || attachment?.path)
    );
  }

  function getAttachmentUrl(attachment) {
    return window.Seav?.getFileDisplayUrl?.(attachment, PS_FILE_BUCKET) || "";
  }

  async function ensurePayslipAttachmentsHydrated() {
    const entries = getEntries();
    if (!entries.length || !window.SeavApiCore?.hydrateItemsFileField) return;

    await window.SeavApiCore.hydrateItemsFileField(
      entries,
      "attachment",
      PS_FILE_BUCKET
    );
    window.SeavState?.syncCache?.();
  }

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
    const withFile = entries.filter((entry) => hasStoredAttachment(entry.attachment)).length;
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


  window.SeavPayslipsCore = {
    STORAGE_KEY, expandedPsIds, PS_FILE_BUCKET,
    get activeTaxYearFilter() { return activeTaxYearFilter; },
    set activeTaxYearFilter(v) { activeTaxYearFilter = v; },
    activeYearMonthFilters,
    getEntries, getFilteredEntries, getVesselName, getTaxYearsForFilter,
    getMonthFilterOptionsHtml, filterEntriesForYear, populateTaxYearOptions,
    populateCurrencyOptions, populateMonthOptions, populateVesselOptions, renderKpis,
    hasStoredAttachment, getAttachmentUrl, ensurePayslipAttachmentsHydrated
  };
})();