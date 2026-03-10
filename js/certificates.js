// /js/certificates.js
(function () {
  "use strict";

  if (!window.Seav) {
    console.warn("[SEA-V] Seav core not found. Did you include js/core.js before certificates.js?");
    return;
  }

  if (!window.SeavData) {
    console.warn("[SEA-V] SeavData not found. Did you include js/seav-data.js before certificates.js?");
    return;
  }

  const { getCertExpiryInfo } = window.SeavData;

  function renderCerts() {
    const certsList = document.getElementById("certsList");
    const certsTableBody = document.getElementById("certsTableBody");

    if (!certsList && !certsTableBody && !document.getElementById("certForm")) return;

    const certs = Seav.load("seav_certs", []);

    if (certsList) {
      if (certs.length === 0) {
        certsList.innerHTML = `
          <div class="list-row">
            <div>
              <div class="list-title">No certificates yet</div>
              <div class="list-sub">Add STCW, ENG1, etc.</div>
            </div>
            <span class="pill">Prototype</span>
          </div>
        `;
      } else {
        certsList.innerHTML = certs.map((c, idx) => {
          const hasFile = !!(c.attachment && c.attachment.dataUrl);
          const expiryInfo = getCertExpiryInfo(c.expiry);

          const fileHtml = hasFile
            ? `<div class="list-sub" style="margin-top:6px;">
                 <a href="${c.attachment.dataUrl}" download="${Seav.escapeHtml(c.attachment.filename)}">Download attachment</a>
               </div>`
            : `<div class="list-sub" style="margin-top:6px;">Attachment: —</div>`;

          return `
            <div class="list-row">
              <div style="min-width:0;">
                <div class="list-title">${Seav.escapeHtml(c.name)}</div>
                <div class="list-sub">
                  Expiry: ${Seav.escapeHtml(c.expiry || "—")} • ${Seav.escapeHtml(expiryInfo.label)}
                </div>
                ${fileHtml}
              </div>
              <div class="row-actions" style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
                <span class="${expiryInfo.statusClass}">${Seav.escapeHtml(expiryInfo.badge)}</span>
                <a href="#" data-del-cert="${idx}">Delete</a>
              </div>
            </div>
          `;
        }).join("");
      }
    }

    if (certsTableBody) {
      if (certs.length === 0) {
        certsTableBody.innerHTML = `
          <tr>
            <td class="muted">—</td>
            <td class="muted">—</td>
            <td><span class="pill">Prototype</span></td>
            <td class="muted">—</td>
            <td></td>
          </tr>
        `;
      } else {
        certsTableBody.innerHTML = certs.map((c, idx) => {
          const hasFile = !!(c.attachment && c.attachment.dataUrl);
          const expiryInfo = getCertExpiryInfo(c.expiry);

        const attachCell = hasFile
  ? `<a class="btn-blue btn-attach" href="${c.attachment.dataUrl}" download="${Seav.escapeHtml(c.attachment.filename)}">Download</a>`
  : `<span class="muted">—</span>`;

          return `
            <tr>
              <td>${Seav.escapeHtml(c.name)}</td>
              <td>${Seav.escapeHtml(c.expiry || "—")}</td>
              <td><span class="${expiryInfo.statusClass}">${Seav.escapeHtml(expiryInfo.badge)}</span></td>
              <td>${attachCell}</td>
              <td class="row-actions"><a href="#" data-del-cert="${idx}">Delete</a></td>
            </tr>
          `;
        }).join("");
      }
    }
  }

function emailCertificateSummary() {
  const certs = Seav.load("seav_certs", []);
  if (!certs.length) {
    throw new Error("No certificates available.");
  }

  const lines = certs.map((c, i) => {
    const expiryInfo = getCertExpiryInfo(c.expiry);
    return `${i + 1}. ${c.name || "Unnamed"} | Expiry: ${c.expiry || "—"} | Status: ${expiryInfo.badge}`;
  });

  const subject = encodeURIComponent("SEA-V Certificate Summary");
  const body = encodeURIComponent(
    `Please find my certificate summary below:\n\n${lines.join("\n")}\n\nAttachments should be added manually from the exported ZIP pack.`
  );

  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

async function shareAllCertificates() {
  const zipBlob = await buildCertificatesZip();
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
  const zipBlob = await buildCertificatesZip();
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
  const certs = Seav.load("seav_certs", []);
  if (!certs.length) {
    throw new Error("No certificates available.");
  }

  if (typeof JSZip === "undefined") {
    throw new Error("JSZip not loaded.");
  }

  const zip = new JSZip();
  const folder = zip.folder("sea-v-certificates");

  const csv = buildCertSummaryCsv(certs);
  folder.file("certificate-summary.csv", csv);
  folder.file("certificate-summary.json", JSON.stringify(certs, null, 2));

  certs.forEach((c, index) => {
    if (!c.attachment?.dataUrl) return;

    const blob = dataUrlToBlob(c.attachment.dataUrl);
    const certName = safeFileName(c.name || `certificate-${index + 1}`);
    const originalName = safeFileName(c.attachment.filename || "attachment");
    const fileName = `${String(index + 1).padStart(2, "0")}-${certName}-${originalName}`;

    folder.file(fileName, blob);
  });

  return zip.generateAsync({ type: "blob" });
}

function buildCertSummaryCsv(certs) {
  const rows = [
    ["Certificate", "Expiry", "Status", "Attachment"]
  ];

  certs.forEach((c) => {
    const expiryInfo = getCertExpiryInfo(c.expiry);
    rows.push([
      c.name || "",
      c.expiry || "",
      expiryInfo.badge || "",
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
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
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

  function initCertificates() {
   if (
  !document.getElementById("certForm") &&
  !document.getElementById("certsTableBody") &&
  !document.getElementById("certsList") &&
  !document.getElementById("btnDownloadAllCerts") &&
  !document.getElementById("btnShareAllCerts")
) return;

    renderCerts();

        const btnDownloadAll = document.getElementById("btnDownloadAllCerts");
    const btnShareAll = document.getElementById("btnShareAllCerts");
    const btnShareZip = document.getElementById("btnShareZipCerts");
    const btnEmailSummary = document.getElementById("btnEmailCertSummary");
    const btnDownloadZipFromModal = document.getElementById("btnDownloadZipFromModal");
    const certBulkMsg = document.getElementById("certBulkMsg");

    if (btnDownloadAll) {
      btnDownloadAll.addEventListener("click", async (e) => {
        e.preventDefault();

        try {
          await downloadAllCertificates();
          if (certBulkMsg) {
            certBulkMsg.textContent = "Certificate ZIP downloaded.";
          }
        } catch (err) {
          alert(err.message || "Could not download certificates.");
        }
      });
    }

    if (btnShareAll) {
      btnShareAll.addEventListener("click", (e) => {
        e.preventDefault();

        if (window.SeavModals?.openModal) {
          window.SeavModals.openModal("certShareModal");
        }
      });
    }

    if (btnShareZip) {
      btnShareZip.addEventListener("click", async (e) => {
        e.preventDefault();

        try {
          await shareAllCertificates();
          if (certBulkMsg) {
            certBulkMsg.textContent = "Certificate ZIP shared.";
          }
        } catch (err) {
          if (certBulkMsg) {
            certBulkMsg.textContent =
              err.message || "Share unavailable. ZIP downloaded instead.";
          }
        }
      });
    }

    if (btnEmailSummary) {
      btnEmailSummary.addEventListener("click", (e) => {
        e.preventDefault();

        try {
          emailCertificateSummary();
          if (certBulkMsg) {
            certBulkMsg.textContent =
              "Email draft opened. Add the exported ZIP manually if needed.";
          }
        } catch (err) {
          alert(err.message || "Could not open email summary.");
        }
      });
    }

    if (btnDownloadZipFromModal) {
      btnDownloadZipFromModal.addEventListener("click", async (e) => {
        e.preventDefault();

        try {
          await downloadAllCertificates();
          if (certBulkMsg) {
            certBulkMsg.textContent = "Certificate ZIP downloaded.";
          }
        } catch (err) {
          alert(err.message || "Could not download certificates.");
        }
      });
    }

    const certForm = document.getElementById("certForm");
    if (certForm) {
      certForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("ct_name")?.value.trim();
        const expiry = document.getElementById("ct_expiry")?.value || "";
        const status = document.getElementById("ct_status")?.value || "Valid";
        if (!name) return;

        const file = document.getElementById("ct_file")?.files?.[0] || null;

        let attachment = null;
        if (file) {
          const maxBytes = 2 * 1024 * 1024;
          if (file.size > maxBytes) {
            alert("Attachment too large. Please upload a file under 2MB for the prototype.");
            return;
          }
          attachment = {
            filename: file.name,
            mime: file.type || "application/octet-stream",
            dataUrl: await Seav.readFileAsDataURL(file),
          };
        }

        const certs = Seav.load("seav_certs", []);
        certs.unshift({ name, expiry, status, attachment });
        Seav.save("seav_certs", certs);

        certForm.reset();
        if (window.SeavModals?.closeAllModals) window.SeavModals.closeAllModals();

        renderCerts();
        if (window.SeavDashboard?.refresh) window.SeavDashboard.refresh();
      });
    }



    document.addEventListener("click", (e) => {
      const cf = e.target.closest("[data-del-cert]");
      if (!cf) return;

      e.preventDefault();
      const idx = Number(cf.getAttribute("data-del-cert"));
      const certs = Seav.load("seav_certs", []);
      certs.splice(idx, 1);
      Seav.save("seav_certs", certs);

      renderCerts();
      if (window.SeavDashboard?.refresh) window.SeavDashboard.refresh();
    });
  }

  document.addEventListener("DOMContentLoaded", initCertificates);

})();