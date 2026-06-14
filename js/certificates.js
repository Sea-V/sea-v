// /js/certificates.js
(function () {
  "use strict";

  if (!window.Seav) {
    console.warn("[SEA-V] Seav core not found. Did you include js/core.js before certificates.js?");
    return;
  }

  if (!window.SeavAPI) {
    console.warn("[SEA-V] SeavAPI not found. Did you include js/api.js before certificates.js?");
    return;
  }

  if (!window.SeavData) {
    console.warn("[SEA-V] SeavData not found. Did you include js/seav-data.js before certificates.js?");
    return;
  }

  if (!window.SeavState) {
    console.warn("[SEA-V] SeavState not found. Did you include js/state.js before certificates.js?");
    return;
  }

  const {
    KEYS,
    MANDATORY_CERTS,
    RECOMMENDED_CERTS,
    DEPRECATED_MANDATORY_CODES,
    createId,
    getCertExpiryInfo,
    renderMandatoryCertDetailHtml,
    getMandatoryCertTemplate,
    isSuppressedAdditionalCert,
    isCertNoExpiry
  } = window.SeavData;

  const STORAGE_KEY = KEYS.CERTS;
  const expandedCertIds = new Set();

  const mandatoryCodeSet = new Set(
    (MANDATORY_CERTS || []).map((item) => normalizeCode(item.code))
  );

  const recommendedCodeSet = new Set(
    (RECOMMENDED_CERTS || []).map((item) => normalizeCode(item.code))
  );

  const deprecatedMandatorySet = new Set(
    (DEPRECATED_MANDATORY_CODES || []).map((code) => normalizeCode(code))
  );

  function getCerts() {
    return window.SeavState?.certs || [];
  }

  function normalizeCode(value) {
    return String(value || "").trim().toUpperCase();
  }

  function normalizeName(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function isMandatoryCert(cert) {
    if (!cert) return false;
    if (deprecatedMandatorySet.has(normalizeCode(cert.code))) return false;
    return !!cert.isMandatory || mandatoryCodeSet.has(normalizeCode(cert.code));
  }

  function isRecommendedTemplate(cert) {
    if (!cert || isMandatoryCert(cert)) return false;
    return !!cert.isTemplate && recommendedCodeSet.has(normalizeCode(cert.code));
  }

  function findCertByCode(certs, code) {
    const target = normalizeCode(code);
    return certs.find((cert) => normalizeCode(cert.code) === target) || null;
  }

  const MANDATORY_TYPE_LABEL = "Minimum mandatory";

  function getMandatoryCerts(certs) {
    return certs.filter(isMandatoryCert);
  }

  function getRankRoleCerts(certs) {
    return certs.filter(isRecommendedTemplate);
  }

  function getAdditionalCerts(certs) {
    return certs.filter(
      (cert) =>
        !isMandatoryCert(cert) &&
        !isRecommendedTemplate(cert) &&
        !isSuppressedAdditionalCert(cert)
    );
  }

  async function syncCertificateTemplates() {
    let existing = await SeavAPI.getArray(STORAGE_KEY);
    let changed = false;

    for (const cert of existing) {
      const code = normalizeCode(cert.code);
      const template = getMandatoryCertTemplate(code);

      if (template && cert.name !== template.name) {
        await SeavAPI.updateItemById(STORAGE_KEY, cert.id, {
          ...cert,
          name: template.name
        });
        changed = true;
        continue;
      }

      if (mandatoryCodeSet.has(code) && !cert.isMandatory) {
        await SeavAPI.updateItemById(STORAGE_KEY, cert.id, {
          ...cert,
          isMandatory: true,
          isTemplate: true
        });
        changed = true;
        continue;
      }

      if (cert.isMandatory && deprecatedMandatorySet.has(code)) {
        await SeavAPI.updateItemById(STORAGE_KEY, cert.id, {
          ...cert,
          isMandatory: false,
          isTemplate: false
        });
        changed = true;
        continue;
      }

      if (isSuppressedAdditionalCert(cert)) {
        await SeavAPI.deleteItemById(STORAGE_KEY, cert.id);
        changed = true;
      }
    }

    if (changed) {
      existing = await SeavAPI.getArray(STORAGE_KEY);
    }

    for (const template of MANDATORY_CERTS) {
      const exists = existing.some(
        (cert) => normalizeCode(cert.code) === normalizeCode(template.code)
      );

      if (exists) continue;

      await SeavAPI.upsertItemById(STORAGE_KEY, {
        id: createId("cert"),
        code: template.code,
        name: template.name,
        expiry: "",
        status: "Missing",
        attachment: null,
        isMandatory: true,
        isTemplate: true
      });

      changed = true;
    }

    if (changed) {
      existing = await SeavAPI.getArray(STORAGE_KEY);
    }

    for (const template of RECOMMENDED_CERTS) {
      const exists = existing.some(
        (cert) => normalizeCode(cert.code) === normalizeCode(template.code)
      );

      if (exists) continue;

      await SeavAPI.upsertItemById(STORAGE_KEY, {
        id: createId("cert"),
        code: template.code,
        name: template.name,
        expiry: "",
        status: "Missing",
        attachment: null,
        isMandatory: false,
        isTemplate: true
      });

      changed = true;
    }

    return changed;
  }

  function formatDatePretty(dateStr) {
    if (!dateStr) return "—";

    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;

    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function syncCertExpiryFields(noExpiry) {
    const group = document.getElementById("ct_expiry_year")?.closest(".modal-date-group");
    const fields = ["ct_expiry_year", "ct_expiry_month", "ct_expiry_day"]
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    const statusEl = document.getElementById("ct_status");
    const noExpiryEl = document.getElementById("ct_no_expiry");

    if (noExpiryEl) noExpiryEl.checked = !!noExpiry;

    if (noExpiry) {
      Seav.clearDateTriplet("ct_expiry");
      fields.forEach((el) => {
        el.disabled = true;
      });
      if (group) group.classList.add("is-disabled");
      if (statusEl) {
        statusEl.value = "No Expiry";
        statusEl.disabled = true;
      }
      return;
    }

    fields.forEach((el) => {
      el.disabled = false;
    });
    if (group) group.classList.remove("is-disabled");
    if (statusEl) {
      statusEl.disabled = false;
      if (statusEl.value === "No Expiry") statusEl.value = "Pending";
    }
  }

  function getCertExpiryLabel(cert) {
    if (isCertNoExpiry(cert)) return "No expiry";
    if (cert?.expiry) return formatDatePretty(cert.expiry);
    return "No expiry recorded";
  }

  function getDisplayStatus(cert) {
    const hasAttachment = !!(cert?.attachment?.url || cert?.attachment?.dataUrl);

    if (isCertNoExpiry(cert)) {
      return {
        label: "No Expiry",
        badge: "No Expiry",
        statusClass: "pill-neutral"
      };
    }

    if (!hasAttachment && !cert?.expiry) {
      return {
        label: "Missing",
        badge: "Missing",
        statusClass: "pill-missing"
      };
    }

    if (!cert?.expiry) {
      const status = String(cert?.status || "Pending");
      if (status.toLowerCase() === "valid") {
        return {
          label: "Valid",
          badge: "Valid",
          statusClass: "pill-valid"
        };
      }

      return {
        label: status || "Pending",
        badge: status || "Pending",
        statusClass: status.toLowerCase().includes("pending")
          ? "pill-pending"
          : "pill-neutral"
      };
    }

    const expiryInfo = getCertExpiryInfo(cert.expiry);
    return {
      ...expiryInfo,
      statusClass: String(expiryInfo.statusClass || "pill-neutral").replace(/^pill\s+/, "")
    };
  }

  function sortCerts(items) {
    return [...items].sort((a, b) => {
      const aStatus = getDisplayStatus(a);
      const bStatus = getDisplayStatus(b);

      const score = (info) => {
        const badge = String(info.badge || info.label || "").toLowerCase();

        if (badge.includes("missing")) return 0;
        if (badge.includes("expired")) return 1;
        if (badge.includes("expires soon")) return 2;
        if (badge.includes("pending")) return 3;
        if (badge.includes("valid")) return 4;
        if (badge.includes("no expiry")) return 5;

        return 6;
      };

      const aScore = score(aStatus);
      const bScore = score(bStatus);
      if (aScore !== bScore) return aScore - bScore;

      const aDate = a.expiry ? new Date(a.expiry) : new Date("9999-12-31");
      const bDate = b.expiry ? new Date(b.expiry) : new Date("9999-12-31");
      const dateDiff = aDate - bDate;
      if (dateDiff !== 0) return dateDiff;

      return String(a.name || a.code || "").localeCompare(String(b.name || b.code || ""));
    });
  }

  function buildCertRow(cert, options = {}) {
    const certId = cert.id || "";
    const allowDelete = options.allowDelete !== false && !isMandatoryCert(cert);

    const fileUrl = cert.attachment?.url || cert.attachment?.dataUrl || "";
    const hasFile = !!fileUrl;
    const statusInfo = getDisplayStatus(cert);
    const statusLabel = statusInfo.badge || statusInfo.label || "Unknown";
    const statusClass = statusInfo.statusClass || "pill-neutral";

    const expiryLabel = getCertExpiryLabel(cert);
    const expiryMeta = isCertNoExpiry(cert)
      ? "No expiry"
      : cert.expiry
        ? `Expires ${expiryLabel}`
        : expiryLabel;
    const displayTitle = cert.name || cert.code || "Certificate";
    const isExpanded = expandedCertIds.has(certId);

    const typeLabel = isMandatoryCert(cert)
      ? MANDATORY_TYPE_LABEL
      : isRecommendedTemplate(cert)
        ? "Rank & role"
        : "Additional";

    return `
      <article class="cert-compact-card ui-card ui-card-hover ui-accent-gold${isExpanded ? " is-expanded" : ""}" data-cert-id="${Seav.escapeHtml(certId)}">

        <button
          type="button"
          class="cert-compact-summary"
          aria-expanded="${isExpanded ? "true" : "false"}"
          data-toggle-cert-id="${Seav.escapeHtml(certId)}"
        >
          <div class="cert-compact-summary-left">
            <div class="cert-compact-title">${Seav.escapeHtml(displayTitle)}</div>
            <div class="cert-compact-sub">
              ${Seav.escapeHtml(cert.code || "No code")} • ${Seav.escapeHtml(expiryMeta)}
            </div>
          </div>
          <div class="cert-compact-summary-right">
            <span class="cert-status-pill ${statusClass}">
              ${Seav.escapeHtml(statusLabel)}
            </span>
            <span class="cert-chevron" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </div>
        </button>

        <div class="cert-compact-body"${isExpanded ? "" : " hidden"}>
          <div class="cert-compact-detail-grid">
            <div class="cert-compact-detail-panel">
              <div class="cert-compact-detail-label">Certificate</div>
              <div class="cert-compact-detail-value">
                ${Seav.escapeHtml(cert.name || "—")}<br>
                Code: ${Seav.escapeHtml(cert.code || "—")}
              </div>
            </div>
            <div class="cert-compact-detail-panel">
              <div class="cert-compact-detail-label">Expiry & status</div>
              <div class="cert-compact-detail-value">
                ${Seav.escapeHtml(expiryLabel)}<br>
                ${Seav.escapeHtml(statusInfo.label || statusLabel)}
              </div>
            </div>
            <div class="cert-compact-detail-panel">
              <div class="cert-compact-detail-label">Type</div>
              <div class="cert-compact-detail-value">${Seav.escapeHtml(typeLabel)}</div>
            </div>
            <div class="cert-compact-detail-panel">
              <div class="cert-compact-detail-label">Attachment</div>
              <div class="cert-compact-detail-value">
                ${
                  hasFile
                    ? `<a class="cert-attachment-link" href="${Seav.escapeHtml(fileUrl)}" target="_blank" rel="noopener">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M12 3v10m0 0l3.5-3.5M12 13l-3.5-3.5M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Download certificate
                      </a>`
                    : "No attachment uploaded"
                }
              </div>
            </div>
          </div>

          ${renderMandatoryCertDetailHtml(cert.code)}

          <div class="seav-actions seav-actions--compact">
            ${Seav.seavAction(
              "edit",
              "Edit",
              `data-edit-cert-id="${Seav.escapeHtml(certId)}"`
            )}
            ${
              allowDelete
                ? Seav.seavAction(
                    "delete",
                    "Delete",
                    `data-del-cert-id="${Seav.escapeHtml(certId)}"`
                  )
                : ""
            }
          </div>
        </div>
      </article>
    `;
  }

  function renderEmptyRow(message, statusLabel = "Missing") {
    return `
      <div class="cert-compact-empty">
        <div class="cert-compact-empty-copy">${Seav.escapeHtml(message)}</div>
        <span class="cert-status-pill pill-neutral">${Seav.escapeHtml(statusLabel)}</span>
      </div>
    `;
  }

  function renderMandatorySections(certs) {
    const mount = document.getElementById("mandatoryCertsMount");
    if (!mount) return;

    const rows = (MANDATORY_CERTS || [])
      .map((template) => {
        const cert = findCertByCode(certs, template.code);
        return cert
          ? buildCertRow(cert, { allowDelete: false })
          : renderEmptyRow(`No record for ${template.name} yet.`);
      })
      .join("");

    mount.innerHTML = rows;
  }

  function renderCerts() {
    const rankRoleList = document.getElementById("rankRoleCertsList");
    const additionalList = document.getElementById("additionalCertsList");

    if (
      !document.getElementById("mandatoryCertsMount") &&
      !rankRoleList &&
      !additionalList &&
      !document.getElementById("certForm")
    ) {
      return;
    }

    const certs = getCerts();
    renderMandatorySections(certs);
    const rankRoleCerts = getRankRoleCerts(certs);
    const additionalCerts = getAdditionalCerts(certs);

    if (rankRoleList) {
      rankRoleList.innerHTML = rankRoleCerts.length
        ? sortCerts(rankRoleCerts).map((cert) => buildCertRow(cert, { allowDelete: false })).join("")
        : renderEmptyRow("Rank & role templates will appear after sync.", "—");
    }

    if (additionalList) {
      additionalList.innerHTML = additionalCerts.length
        ? sortCerts(additionalCerts).map((cert) => buildCertRow(cert)).join("")
        : renderEmptyRow("No additional certificates yet. Use Add certificate for extras.", "—");
    }
  }

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

  function fillCertForm(cert) {
    const editId = document.getElementById("ct_edit_id");
    const isTemplateEl = document.getElementById("ct_is_template");
    const isMandatoryEl = document.getElementById("ct_is_mandatory");
    const codeEl = document.getElementById("ct_code");
    const nameEl = document.getElementById("ct_name");
    const expiryEl = document.getElementById("ct_expiry_year");
    const statusEl = document.getElementById("ct_status");

    if (editId) editId.value = cert.id || "";
    if (isTemplateEl) isTemplateEl.value = cert.isTemplate ? "true" : "false";
    if (isMandatoryEl) isMandatoryEl.value = cert.isMandatory ? "true" : "false";

    if (codeEl) {
      codeEl.value = cert.code || "";
      codeEl.disabled = !!cert.isTemplate;
    }

    if (nameEl) {
      nameEl.value = cert.name || "";
      nameEl.disabled = !!cert.isTemplate;
    }

    if (expiryEl) {
      Seav.setDateTriplet("ct_expiry", cert.expiry || "");
    }
    if (statusEl) statusEl.value = cert.status || "Missing";

    syncCertExpiryFields(isCertNoExpiry(cert));

    if (window.SeavModals?.openModal) {
      window.SeavModals.openModal("certModal");
    }
  }

  function resetCertForm(form) {
    form.reset();

    const editId = document.getElementById("ct_edit_id");
    const isTemplateEl = document.getElementById("ct_is_template");
    const isMandatoryEl = document.getElementById("ct_is_mandatory");
    const statusEl = document.getElementById("ct_status");
    const codeEl = document.getElementById("ct_code");
    const nameEl = document.getElementById("ct_name");

    if (editId) editId.value = "";
    if (isTemplateEl) isTemplateEl.value = "false";
    if (isMandatoryEl) isMandatoryEl.value = "false";
    if (statusEl) statusEl.value = "Missing";

    if (codeEl) codeEl.disabled = false;
    if (nameEl) nameEl.disabled = false;

    Seav.clearDateTriplet("ct_expiry");
    syncCertExpiryFields(false);
  }

  function readCertForm() {
    const noExpiry = document.getElementById("ct_no_expiry")?.checked || false;

    return {
      id: document.getElementById("ct_edit_id")?.value || "",
      isTemplate: document.getElementById("ct_is_template")?.value === "true",
      isMandatory: document.getElementById("ct_is_mandatory")?.value === "true",
      code: document.getElementById("ct_code")?.value.trim() || "",
      name: document.getElementById("ct_name")?.value.trim(),
      noExpiry,
      expiry: noExpiry ? "" : Seav.readDateTriplet("ct_expiry"),
      status: document.getElementById("ct_status")?.value || "Missing",
      file: document.getElementById("ct_file")?.files?.[0] || null
    };
  }

  async function buildCertAttachment(file, existingAttachment, certId) {
    if (!file) return existingAttachment || null;

    if (window.SeavSupabase) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = SeavAPI.buildStoragePath(certId, safeName);

      const { error } = await window.SeavSupabase.storage
        .from("certificate-files")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true
        });

      if (error) {
        console.error("[SEA-V] Certificate upload failed:", error);
        Seav.notify("error", "Upload failed", "Certificate upload failed. Please try again.");
        return existingAttachment || null;
      }

    return SeavAPI.buildUploadedFileMeta("certificate-files", filePath, file);
    }

    return await Seav.buildStoredFile(file, {
      fallback: existingAttachment || null,
      kind: "Attachment"
    });
  }

  async function saveCertData(certData) {
    await SeavAPI.upsertItemById(STORAGE_KEY, certData);
  }

  function initCertificates() {
    if (
      !document.getElementById("certForm") &&
      !document.getElementById("mandatoryCertsMount") &&
      !document.getElementById("rankRoleCertsList") &&
      !document.getElementById("additionalCertsList") &&
      !document.getElementById("btnDownloadAllCerts") &&
      !document.getElementById("btnShareAllCerts")
    ) {
      return;
    }

    const runRefresh = () => {
      renderCerts();
    };

    const initData = async () => {
      await syncCertificateTemplates();

      if (window.SeavState?.refresh) {
        await window.SeavState.refresh();
      } else {
        runRefresh();
      }
    };

    if (window.SeavState?.ready) {
      initData();
    } else {
      document.addEventListener("seav:state-ready", initData, { once: true });
    }

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
          Seav.notify("error", "Download failed", err.message || "Could not download certificates.");
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
      btnEmailSummary.addEventListener("click", async (e) => {
        e.preventDefault();

        try {
          await emailCertificateSummary();
          if (certBulkMsg) {
            certBulkMsg.textContent =
              "Email draft opened. Add the exported ZIP manually if needed.";
          }
        } catch (err) {
          Seav.notify("error", "Email failed", err.message || "Could not open email summary.");
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
          Seav.notify("error", "Download failed", err.message || "Could not download certificates.");
        }
      });
    }

    const certForm = document.getElementById("certForm");
    if (certForm) {
      const noExpiryEl = document.getElementById("ct_no_expiry");
      if (noExpiryEl) {
        noExpiryEl.addEventListener("change", (event) => {
          syncCertExpiryFields(event.target.checked);
        });
      }

      certForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = readCertForm();
        if (!formData.name) return;

        const currentCerts = await SeavAPI.getArray(STORAGE_KEY);

        const inputCode = normalizeCode(formData.code);
        const inputName = normalizeName(formData.name);

        const duplicateCert = currentCerts.find((cert) => {
          if (formData.id && cert.id === formData.id) return false;

          const certCode = normalizeCode(cert.code);
          const certName = normalizeName(cert.name);

          if (inputCode && certCode && inputCode === certCode) return true;
          if (inputName && certName && inputName === certName) return true;

          if (inputCode && certName && inputCode === certName.toUpperCase()) return true;
          if (inputName && certCode && inputName.toUpperCase() === certCode) return true;

          return false;
        });

        if (duplicateCert) {
          Seav.notify("error", "Already exists", "This certificate already exists.");
          return;
        }

        const existingCert = formData.id
          ? getCerts().find((item) => item.id === formData.id) || null
          : null;

        await Seav.withSaving(async () => {
        const certId = formData.id || createId("cert");

        const attachment = await buildCertAttachment(
          formData.file,
          existingCert?.attachment || null,
          certId
        );
        if (formData.file && !attachment) return;

        const hasAttachment = !!(attachment?.url || attachment?.dataUrl);
        const finalStatus = formData.noExpiry
          ? "No Expiry"
          : formData.status === "Missing" && (formData.expiry || hasAttachment)
            ? "Pending"
            : formData.status;

        const certData = {
          id: certId,
          code: existingCert?.isTemplate ? existingCert.code : formData.code,
          name: existingCert?.isTemplate ? existingCert.name : formData.name,
          expiry: formData.noExpiry ? "" : formData.expiry,
          status: finalStatus,
          attachment,
          noExpiry: !!formData.noExpiry,
          isMandatory: existingCert ? existingCert.isMandatory : formData.isMandatory,
          isTemplate: existingCert ? existingCert.isTemplate : formData.isTemplate
        };

        await saveCertData(certData);

        resetCertForm(certForm);
        if (window.SeavModals?.closeAllModals) window.SeavModals.closeAllModals();

        Seav.notify(
          "success",
          "Certificate stowed",
          "Safely filed in your certificate library."
        );

        if (window.Seav.app?.refreshAll) {
          await window.Seav.app.refreshAll();
        } else {
          renderCerts();
        }
        }, { sub: "Saving certificate" });
      });
    }

    document.addEventListener("click", async (e) => {
      const toggleBtn = e.target.closest("[data-toggle-cert-id]");
      if (toggleBtn) {
        e.preventDefault();
        const certId = toggleBtn.getAttribute("data-toggle-cert-id");
        const card = toggleBtn.closest(".cert-compact-card");
        const body = card?.querySelector(".cert-compact-body");
        if (!certId || !card || !body) return;

        if (expandedCertIds.has(certId)) {
          expandedCertIds.delete(certId);
          card.classList.remove("is-expanded");
          toggleBtn.setAttribute("aria-expanded", "false");
          body.setAttribute("hidden", "");
        } else {
          expandedCertIds.add(certId);
          card.classList.add("is-expanded");
          toggleBtn.setAttribute("aria-expanded", "true");
          body.removeAttribute("hidden");
        }
        return;
      }

      const editBtn = e.target.closest("[data-edit-cert-id]");
      if (editBtn) {
        e.preventDefault();
        const certId = editBtn.getAttribute("data-edit-cert-id");
        const cert = getCerts().find((item) => item.id === certId);
        if (!cert) return;
        fillCertForm(cert);
        return;
      }

      const delBtn = e.target.closest("[data-del-cert-id]");
      if (!delBtn) return;

      e.preventDefault();
      const certId = delBtn.getAttribute("data-del-cert-id");
      const cert = getCerts().find((item) => item.id === certId);

      if (
        !Seav.confirmDelete({
          itemName: cert?.name || cert?.code || "",
          itemLabel: "certificate"
        })
      ) {
        return;
      }

      await SeavAPI.deleteItemById(STORAGE_KEY, certId);
      expandedCertIds.delete(certId);

      if (window.Seav.app?.refreshAll) {
        await window.Seav.app.refreshAll();
      } else {
        renderCerts();
      }
    });

    document.addEventListener("seav:data-updated", runRefresh);
  }

  document.addEventListener("DOMContentLoaded", initCertificates);
})();
