// /js/certificates-export.js
(function () {
  "use strict";
  const C = window.SeavCertificatesCore;
  if (!C || !window.Seav) return;
  const { getCerts, getDisplayStatus, isMandatoryCert } = C;
  const Seav = window.Seav;
  async function emailCertificateSummary() {
    const certs = getCerts();
    if (!certs.length) {
      throw new Error("No certificates available.");
    }

    const lines = certs.map((c, i) => {
      const statusInfo = getDisplayStatus(c);
      return `${i + 1}. ${c.code || "—"} | ${c.name || "Unnamed"} | Expiry: ${c.expiry || "—"} | Status: ${statusInfo.badge || statusInfo.label}`;
    });

    const subject = encodeURIComponent("SEA-V Certificate Summary");
    const body = encodeURIComponent(
      `Please find my certificate summary below:\n\n${lines.join("\n")}\n\nCertificate files can be downloaded individually from SEA-V.`
    );

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  function notifyZipSkipped(skipped, label = "ZIP export") {
    if (!skipped.length) return;
    Seav.notify(
      "info",
      "Some files were skipped",
      `${skipped.length} attachment${skipped.length === 1 ? "" : "s"} could not be included in the ${label}. Refresh the page and try again, or download files individually. Skipped: ${skipped.slice(0, 3).join(", ")}${skipped.length > 3 ? "…" : ""}.`
    );
  }

  async function shareAllCertificates() {
    const { blob: zipBlob, skipped } = await buildCertificatesZip();
    notifyZipSkipped(skipped, "certificate pack");

    const zipFile = new File([zipBlob], "sea-v-certificates.zip", {
      type: "application/zip"
    });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [zipFile] })) {
      await navigator.share({
        title: "SEA-V Certificate Pack",
        text: "Certificate export from SEA-V",
        files: [zipFile]
      });
      return;
    }

    downloadBlob(zipBlob, "sea-v-certificates.zip");
    throw new Error("Direct share not available on this device/browser. ZIP downloaded instead.");
  }

  async function downloadAllCertificates() {
    const { blob: zipBlob, skipped } = await buildCertificatesZip();
    notifyZipSkipped(skipped, "certificate ZIP");
    downloadBlob(zipBlob, "sea-v-certificates.zip");
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

  async function buildCertificatesZip() {
    const certs = getCerts();
    if (!certs.length) {
      throw new Error("No certificates available.");
    }

    if (typeof JSZip === "undefined") {
      throw new Error("JSZip not loaded.");
    }

    const zip = new JSZip();
    const folder = zip.folder("sea-v-certificates");
    const skipped = [];

    const csv = buildCertSummaryCsv(certs);
    folder.file("certificate-summary.csv", csv);
    folder.file("certificate-summary.json", JSON.stringify(certs, null, 2));

    for (const [index, c] of certs.entries()) {
      const attachment = c.attachment || {};
      const fileUrl = attachment.url || "";
      const dataUrl = attachment.dataUrl || "";

      if (!fileUrl && !dataUrl) continue;

      let blob = null;
      const label = c.name || c.code || `Certificate ${index + 1}`;

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
          console.warn("[SEA-V] Certificate attachment fetch failed:", err);
          skipped.push(label);
          continue;
        }
      }

      if (!blob) {
        skipped.push(label);
        continue;
      }

      const certCode = safeFileName(c.code || `cert-${index + 1}`);
      const certName = safeFileName(c.name || `certificate-${index + 1}`);
      const originalName = safeFileName(attachment.filename || "attachment");
      const fileName = `${String(index + 1).padStart(2, "0")}-${certCode}-${certName}-${originalName}`;

      folder.file(fileName, blob);
    }

    return {
      blob: await zip.generateAsync({ type: "blob" }),
      skipped
    };
  }

  function buildCertSummaryCsv(certs) {
    const rows = [["Code", "Certificate", "Expiry", "Status", "Mandatory", "Attachment"]];

    certs.forEach((c) => {
      const statusInfo = getDisplayStatus(c);
      rows.push([
        c.code || "",
        c.name || "",
        c.expiry || "",
        statusInfo.badge || statusInfo.label || "",
        isMandatoryCert(c) ? "Yes" : "No",
        c.attachment?.filename || ""
      ]);
    });

    return rows
      .map((row) =>
        row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
  }

  function safeFileName(name) {
    return String(name || "file")
      .trim()
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, "-");
  }

  function dataUrlToBlob(dataUrl) {
    const parts = dataUrl.split(",");
    const meta = parts[0];
    const base64 = parts[1];
    const mimeMatch = meta.match(/data:(.*?);base64/);
    const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";

    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return new Blob([bytes], { type: mime });
  }


  window.SeavCertificatesExport = {
    emailCertificateSummary, notifyZipSkipped, shareAllCertificates, downloadAllCertificates,
    downloadBlob, buildCertificatesZip, buildCertSummaryCsv, safeFileName, dataUrlToBlob
  };
})();
