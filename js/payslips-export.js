// /js/payslips-export.js
(function () {
  "use strict";
  const C = window.SeavPayslipsCore;
  if (!C || !window.Seav) return;
  const { getFilteredEntries, getVesselName } = C;
  const { getPayslipMonthLabel, normalizePayslipMonth } = window.SeavData;
  const Seav = window.Seav;

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
    const folderName = C.activeTaxYearFilter
      ? `sea-v-payslips-${safeFileName(C.activeTaxYearFilter)}`
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
    const suffix = C.activeTaxYearFilter ? safeFileName(C.activeTaxYearFilter) : "all";
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
    const suffix = C.activeTaxYearFilter ? safeFileName(C.activeTaxYearFilter) : "all";
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


  window.SeavPayslipsExport = {
    safeFileName, dataUrlToBlob, csvEscape, buildSummaryCsv, buildPayslipZip,
    notifyZipSkipped, downloadPayslipPack, downloadBlob, sharePayslipPack
  };
})();