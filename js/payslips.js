// /js/payslips.js
(function () {
  "use strict";
  if (!window.Seav || !window.SeavAPI || !window.SeavData || !window.SeavState) return;
  const C = window.SeavPayslipsCore;
  const R = window.SeavPayslipsRender;
  const X = window.SeavPayslipsExport;
  if (!C || !R || !X) return;
  const {
    STORAGE_KEY, populateTaxYearOptions, populateCurrencyOptions,
    populateMonthOptions, populateVesselOptions, renderKpis,
    expandedPsIds, activeYearMonthFilters, getEntries
  } = C;
  const { renderList } = R;
  const { downloadPayslipPack, sharePayslipPack } = X;
  const {
    createId, normalizePayslipMonth, inferUkTaxYear, inferPayslipMonthFromDate,
    getPayslipMonthsLogged, getPayslipMonthLabel
  } = window.SeavData;
  const Seav = window.Seav;
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
    document.getElementById("ps_tax_year").value = entry?.taxYear || C.activeTaxYearFilter || "";
    populateMonthOptions(entry?.taxYear || C.activeTaxYearFilter || "", entryId, payMonth);
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
    return window.SeavUpload?.uploadToStorage({
      bucket: "payslip-files",
      entityId: entryId,
      file,
      existingMeta: existing,
      kind: "Payslip",
      errorHint: "Run docs/payslips-table.sql in Supabase (storage bucket + policies)."
    }) ?? existing ?? null;
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
        C.activeTaxYearFilter = filter.value || "";
        Object.keys(activeYearMonthFilters).forEach((key) => {
          delete activeYearMonthFilters[key];
        });
        refreshView();
      });
    }

    document.addEventListener("change", (e) => {
      const monthFilter = e.target.closest("[data-ps-year-month-filter]");
      if (!monthFilter || C.activeTaxYearFilter) return;

      const taxYear = monthFilter.getAttribute("data-ps-year-month-filter") || "";
      if (!taxYear) return;

      activeYearMonthFilters[taxYear] = monthFilter.value || "";
      renderList();
    });

    const runRefresh = () => refreshView();

    Seav.bindStateRefresh(runRefresh, { label: "Payslips refresh" });

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
        Seav.populateDatePartSelects(document.getElementById("psModal") || document);
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
      if (C.activeTaxYearFilter) {
        document.getElementById("ps_tax_year").value = C.activeTaxYearFilter;
      }
      populateMonthOptions(document.getElementById("ps_tax_year")?.value || "", null);
      populateCurrencyOptions();
      populateVesselOptions();
      Seav.populateDatePartSelects(document.getElementById("psModal") || document);
    });
  }

  document.addEventListener("DOMContentLoaded", initPayslips);

})();