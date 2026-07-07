// /js/certificates.js
(function () {
  "use strict";

  if (!window.SeavData || !window.Seav || !window.SeavAPI) return;

  const Seav = window.Seav;
  const {
    KEYS,
    MANDATORY_CERTS,
    RECOMMENDED_CERTS,
    getCertificateCatalogGroups,
    getCertificateCatalog,
    findCertificateCatalogItem,
    isSavedCert,
    createId,
    getCertExpiryInfo,
    formatDatePretty
  } = window.SeavData;

  const STORAGE_KEY = KEYS.CERTS;
  const CUSTOM = "__CUSTOM__";
  const expandedCertIds = new Set();
  const CERT_FILE_BUCKET =
    window.SeavApiCore?.STORAGE_BUCKETS?.CERTIFICATE_FILES || "certificate-files";

  function hasAttachment(meta) {
    return window.SeavApiCore?.hasStoredFile?.(meta) ??
      !!(meta?.url || meta?.dataUrl || meta?.path);
  }

  async function hydrateAttachment(meta) {
    if (!meta || !hasAttachment(meta)) return meta || null;
    if (!meta.path || !window.SeavApiCore?.hydrateFileMeta) return meta;

    const bucket = meta.bucket || CERT_FILE_BUCKET;
    const hasDisplayUrl = !!Seav.getFileDisplayUrl(meta, bucket);
    if (
      !window.SeavApiCore?.storedFileNeedsHydration?.(meta, bucket) &&
      hasDisplayUrl
    ) {
      return meta;
    }

    return window.SeavApiCore.hydrateFileMeta(meta, bucket);
  }

  async function ensureCertAttachmentsHydrated() {
    const certs = window.SeavState?.certs;
    if (!Array.isArray(certs) || !window.SeavApiCore?.hydrateFileMeta) return false;

    let changed = false;

    await Promise.all(
      certs.map(async (cert) => {
        const attachment = cert?.attachment;
        const bucket =
          attachment?.bucket ||
          window.SeavApiCore?.STORAGE_BUCKETS?.CERTIFICATE_FILES ||
          "certificate-files";
        if (!window.SeavApiCore?.storedFileNeedsHydration?.(attachment, bucket)) return;

        const hydrated = await hydrateAttachment(attachment);
        if (hydrated && hydrated !== attachment) {
          cert.attachment = hydrated;
          changed = true;
        }
      })
    );

    if (changed) {
      window.SeavState.syncCache?.();
    }

    return changed;
  }

  function getCerts() {
    return window.SeavState?.certs || [];
  }

  function getSavedCerts() {
    return getCerts().filter(isSavedCert);
  }

  function normCode(v) {
    return String(v || "").trim().toUpperCase();
  }

  function catalogGroups() {
    if (typeof getCertificateCatalogGroups === "function") {
      return getCertificateCatalogGroups();
    }
    return [
      {
        label: "Minimum mandatory (yacht crew)",
        isMandatory: true,
        certs: (MANDATORY_CERTS || []).map((t) => ({ code: t.code, name: t.name }))
      },
      {
        label: "Other certificates",
        certs: (RECOMMENDED_CERTS || []).map((t) => ({ code: t.code, name: t.name }))
      }
    ];
  }

  function catalogFlat() {
    if (typeof getCertificateCatalog === "function") {
      return getCertificateCatalog();
    }
    return catalogGroups().flatMap((group) =>
      (group.certs || []).map((cert) => ({
        code: cert.code,
        name: cert.name,
        isMandatory: !!group.isMandatory,
        isTemplate: true,
        group: group.label
      }))
    );
  }

  function lookupCatalogItem(code) {
    if (typeof findCertificateCatalogItem === "function") {
      return findCertificateCatalogItem(code);
    }
    const normalized = normCode(code);
    return (
      catalogFlat().find((item) => normCode(item.code) === normalized) || null
    );
  }

  function findCatalog(code) {
    if (normCode(code) === normCode(CUSTOM)) {
      return { code: CUSTOM, name: "Other certificate", isMandatory: false, isTemplate: false };
    }
    return lookupCatalogItem(code) || null;
  }

  function takenCodes(certs) {
    return new Set((certs || []).map((c) => normCode(c.code)).filter(Boolean));
  }

  function statusFromCert(cert) {
    if (cert.noExpiry || !cert.expiry) {
      return { label: "No expiry", badge: "No expiry", statusClass: "pill-neutral" };
    }
    const info = getCertExpiryInfo(cert.expiry);
    return {
      label: info.label || info.badge || "Valid",
      badge: info.badge || info.label || "Valid",
      statusClass: String(info.statusClass || "pill-neutral").replace(/^pill\s+/, "")
    };
  }

  function computeStoredStatus(expiry, noExpiry) {
    if (noExpiry || !expiry) return "No Expiry";
    return getCertExpiryInfo(expiry).badge || "Valid";
  }

  function expiryLabel(cert) {
    if (cert.noExpiry || !cert.expiry) return "No expiry";
    return formatDatePretty(cert.expiry) || "No expiry";
  }

  function issuedLabel(cert) {
    if (!cert.issued) return "Not recorded";
    return formatDatePretty(cert.issued) || "Not recorded";
  }

  function certTypeLabel(cert) {
    const item = findCatalog(cert?.code);
    if (item && item.code !== CUSTOM) return cert.code;
    return "Other";
  }

  function certCategoryLabel(cert) {
    const item = findCatalog(cert?.code);
    if (item?.group) return item.group;
    if ((MANDATORY_CERTS || []).some((t) => normCode(t.code) === normCode(cert?.code))) {
      return "Minimum mandatory";
    }
    return "Other";
  }

  function sortCerts(certs) {
    return [...certs].sort((a, b) => {
      const aTime = a.noExpiry || !a.expiry ? Infinity : new Date(a.expiry).getTime();
      const bTime = b.noExpiry || !b.expiry ? Infinity : new Date(b.expiry).getTime();
      if (aTime !== bTime) return aTime - bTime;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }

  function renderKpis() {
    const row = document.getElementById("certKpiRow");
    if (!row) return;

    const certs = getSavedCerts();
    const valid = certs.filter((c) => {
      const s = statusFromCert(c);
      return s.statusClass === "pill-valid" || s.statusClass === "pill-neutral";
    }).length;
    const expiring = certs.filter((c) => statusFromCert(c).statusClass === "pill-warning").length;
    const expired = certs.filter((c) => statusFromCert(c).statusClass === "pill-expired").length;

    row.innerHTML = `
      <div class="sq-kpi-box">
        <div class="kpi-num">${certs.length}</div>
        <div class="kpi-label">Total logged</div>
      </div>
      <div class="sq-kpi-box">
        <div class="kpi-num">${valid}</div>
        <div class="kpi-label">Valid / no expiry</div>
      </div>
      <div class="sq-kpi-box">
        <div class="kpi-num">${expiring}</div>
        <div class="kpi-label">Expiring soon</div>
      </div>
      <div class="sq-kpi-box">
        <div class="kpi-num">${expired}</div>
        <div class="kpi-label">Expired</div>
      </div>
    `;
  }

  function buildRow(cert) {
    const certId = cert.id || "";
    const status = statusFromCert(cert);
    const fileUrl = Seav.getFileDisplayUrl(cert.attachment, CERT_FILE_BUCKET);
    const hasFile = hasAttachment(cert.attachment);
    const fileLabel = cert.attachment?.filename || "View document";
    const isExpanded = expandedCertIds.has(certId);
    const typeLabel = certTypeLabel(cert);
    const categoryLabel = certCategoryLabel(cert);
    const expiry = expiryLabel(cert);

    return `
      <article class="cert-compact-card ui-card ui-card-hover ui-accent-gold${
        isExpanded ? " is-expanded" : ""
      }" data-cert-id="${Seav.escapeHtml(certId)}">

        <button
          type="button"
          class="cert-compact-summary"
          aria-expanded="${isExpanded ? "true" : "false"}"
          data-toggle-cert-id="${Seav.escapeHtml(certId)}"
        >
          <div class="cert-compact-summary-left">
            <div class="cert-compact-title">${Seav.escapeHtml(cert.name || "Certificate")}</div>
            <div class="cert-compact-sub">
              ${Seav.escapeHtml(typeLabel)} • Expiry ${Seav.escapeHtml(expiry)}
            </div>
          </div>
          <div class="cert-compact-summary-right">
            <span class="cert-status-pill ${Seav.escapeHtml(status.statusClass)}">
              ${Seav.escapeHtml(status.badge)}
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
                ${Seav.escapeHtml(typeLabel)}
              </div>
            </div>
            <div class="cert-compact-detail-panel">
              <div class="cert-compact-detail-label">Issued &amp; expiry</div>
              <div class="cert-compact-detail-value">
                Issued: ${Seav.escapeHtml(issuedLabel(cert))}<br>
                Expiry: ${Seav.escapeHtml(expiry)}<br>
                ${Seav.escapeHtml(status.label || status.badge)}
              </div>
            </div>
            <div class="cert-compact-detail-panel">
              <div class="cert-compact-detail-label">Type</div>
              <div class="cert-compact-detail-value">${Seav.escapeHtml(categoryLabel)}</div>
            </div>
            <div class="cert-compact-detail-panel">
              <div class="cert-compact-detail-label">Attachment</div>
              <div class="cert-compact-detail-value">
                ${
                  hasFile
                    ? fileUrl
                      ? `<a class="cert-attachment-link" href="${Seav.escapeHtml(fileUrl)}" target="_blank" rel="noopener">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M12 3v10m0 0l3.5-3.5M12 13l-3.5-3.5M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        View document
                      </a>`
                      : `<span class="muted">${Seav.escapeHtml(fileLabel)} uploaded</span>`
                    : "No attachment uploaded"
                }
              </div>
            </div>
          </div>

          <div class="seav-actions seav-actions--compact">
            ${Seav.seavAction("edit", "Edit", `data-edit-cert-id="${Seav.escapeHtml(certId)}"`)}
            ${Seav.seavAction("delete", "Delete", `data-del-cert-id="${Seav.escapeHtml(certId)}"`)}
          </div>
        </div>
      </article>
    `;
  }

  function renderList() {
    const list = document.getElementById("certsList");
    if (!list) return;

    const certs = sortCerts(getSavedCerts());

    if (!certs.length) {
      list.innerHTML = `
        <div class="list-row">
          <div>
            <div class="list-title">No certificates yet</div>
            <div class="list-sub">
              Add STCW, medical, and rank certificates from the dropdown.
            </div>
          </div>
          <span class="pill">Empty</span>
        </div>
      `;
      return;
    }

    list.innerHTML = certs.map(buildRow).join("");
  }

  function fillTypeSelect(currentCode) {
    const select = document.getElementById("ct_type");
    if (!select) return;

    const taken = takenCodes(getSavedCerts());
    const editCode = normCode(currentCode);

    select.innerHTML = `<option value="">Choose a certificate…</option>`;

    function appendOption(item) {
      if (item.code !== CUSTOM && taken.has(normCode(item.code)) && normCode(item.code) !== editCode) {
        return;
      }
      const label = `${item.name} (${item.code})`;
      const opt = new Option(label, item.code);
      if (normCode(item.code) === editCode) opt.selected = true;
      select.appendChild(opt);
    }

    catalogGroups().forEach((group) => {
      const available = (group.certs || []).filter(
        (item) =>
          !taken.has(normCode(item.code)) || normCode(item.code) === editCode
      );
      if (!available.length) return;

      const header = new Option(`— ${group.label} —`, "");
      header.disabled = true;
      select.appendChild(header);

      available.forEach((item) => appendOption(item));
    });

    if (!taken.has(normCode(CUSTOM)) || editCode === normCode(CUSTOM)) {
      const opt = new Option("Other certificate", CUSTOM);
      if (editCode === normCode(CUSTOM)) opt.selected = true;
      select.appendChild(opt);
    }
  }

  function onTypeChange() {
    const code = document.getElementById("ct_type")?.value || "";
    const nameWrap = document.getElementById("ct_name_wrap");
    const nameEl = document.getElementById("ct_name");
    const isCustom = code === CUSTOM;

    if (nameWrap) nameWrap.hidden = !isCustom;
    if (nameEl) nameEl.required = isCustom;

    if (!isCustom) {
      const item = findCatalog(code);
      if (nameEl && item) nameEl.value = item.name;
    } else if (nameEl) {
      nameEl.value = "";
    }
  }

  function openAddModal() {
    const form = document.getElementById("certForm");
    if (!form) return;

    form.reset();
    document.getElementById("ct_edit_id").value = "";
    document.getElementById("certModalTitle").textContent = "Add certificate";
    document.getElementById("ct_type_wrap").hidden = false;
    document.getElementById("ct_name_wrap").hidden = true;

    const nameEl = document.getElementById("ct_name");
    if (nameEl) nameEl.disabled = false;

    Seav.clearDateTriplet("ct_issued");
    Seav.clearDateTriplet("ct_expiry");
    fillTypeSelect("");
    onTypeChange();
    window.SeavModals?.openModal?.("certModal");
  }

  function openEditModal(cert) {
    document.getElementById("ct_edit_id").value = cert.id;
    document.getElementById("certModalTitle").textContent = "Edit certificate";
    document.getElementById("ct_type_wrap").hidden = true;
    document.getElementById("ct_name_wrap").hidden = false;

    const nameEl = document.getElementById("ct_name");
    if (nameEl) {
      nameEl.value = cert.name || "";
      nameEl.disabled = true;
      nameEl.required = true;
    }

    Seav.setDateTriplet("ct_issued", cert.issued || "");
    Seav.setDateTriplet("ct_expiry", cert.expiry || "");
    document.getElementById("ct_file").value = "";
    window.SeavModals?.openModal?.("certModal");
  }

  function readForm() {
    const editId = document.getElementById("ct_edit_id")?.value || "";
    const typeCode = document.getElementById("ct_type")?.value || "";
    const item = findCatalog(typeCode);
    const isCustom = typeCode === CUSTOM;
    const issued = Seav.readDateTriplet("ct_issued");
    const expiry = Seav.readDateTriplet("ct_expiry");
    const noExpiry = !expiry;

    let code = "";
    let name = "";
    let isMandatory = false;
    let isTemplate = false;

    if (editId) {
      const existing = getCerts().find((c) => c.id === editId);
      code = existing?.code || "";
      name = existing?.name || "";
      isMandatory = !!existing?.isMandatory;
      isTemplate = !!existing?.isTemplate;
    } else if (item && !isCustom) {
      code = item.code;
      name = item.name;
      isMandatory = item.isMandatory;
      isTemplate = item.isTemplate;
    } else {
      name = document.getElementById("ct_name")?.value.trim() || "";
      code = name ? name.slice(0, 24).toUpperCase().replace(/\s+/g, "_") : CUSTOM;
    }

    return {
      id: editId,
      code,
      name,
      issued,
      expiry,
      noExpiry,
      isMandatory,
      isTemplate,
      file: document.getElementById("ct_file")?.files?.[0] || null
    };
  }

  async function uploadFile(file, existing, certId) {
    if (!file) return existing || null;
    const uploaded =
      (await window.SeavUpload?.uploadToStorage({
        bucket: CERT_FILE_BUCKET,
        entityId: certId,
        file,
        existingMeta: existing,
        kind: "Certificate"
      })) ?? null;

    if (!uploaded) return existing || null;
    return hydrateAttachment(uploaded);
  }

  window.SeavCertificatesCore = {
    STORAGE_KEY,
    getCerts: getSavedCerts,
    normalizeCode: normCode,
    isMandatoryCert(cert) {
      return !!(MANDATORY_CERTS || []).find((t) => normCode(t.code) === normCode(cert?.code));
    },
    getDisplayStatus: statusFromCert
  };

  async function refreshView() {
    try {
      await ensureCertAttachmentsHydrated();
      renderKpis();
      renderList();
    } catch (err) {
      console.error("[SEA-V] certificates refresh failed:", err);
      renderKpis();
    }
  }

  window.SeavCertificatesRender = { renderCerts: refreshView };

  function init() {
    if (!document.getElementById("certsList")) return;

    Seav.bindStateRefresh(() => refreshView(), { label: "Certificates refresh" });

    document.querySelectorAll('[data-open="certModal"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        openAddModal();
      });
    });

    document.getElementById("ct_type")?.addEventListener("change", onTypeChange);

    document.getElementById("certForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = readForm();

      if (!data.id && !document.getElementById("ct_type")?.value) {
        Seav.notify("error", "Choose a certificate", "Pick one from the dropdown.");
        return;
      }

      if (!data.name) {
        Seav.notify("error", "Name required", "Enter the certificate name.");
        return;
      }

      const dup = getSavedCerts().find((c) => {
        if (data.id && c.id === data.id) return false;
        return (
          normCode(c.code) === normCode(data.code) ||
          String(c.name).trim().toLowerCase() === data.name.toLowerCase()
        );
      });
      if (dup) {
        Seav.notify("error", "Already added", "This certificate is already in your library.");
        return;
      }

      const existing = data.id ? getCerts().find((c) => c.id === data.id) : null;

      await Seav.withSaving(async () => {
        const ghost = !data.id
          ? getCerts().find(
              (c) => !isSavedCert(c) && normCode(c.code) === normCode(data.code)
            )
          : null;
        const certId = data.id || ghost?.id || createId("cert");
        let attachment = await uploadFile(data.file, existing?.attachment || null, certId);
        if (data.file && !attachment) return;
        if (!data.file && existing?.attachment) {
          attachment = await hydrateAttachment(existing.attachment);
        }

        await window.SeavAPI.upsertItemById(STORAGE_KEY, {
          id: certId,
          code: data.code,
          name: data.name,
          issued: data.issued,
          expiry: data.noExpiry ? "" : data.expiry,
          status: computeStoredStatus(data.expiry, data.noExpiry),
          attachment: attachment || existing?.attachment || null,
          noExpiry: data.noExpiry,
          isMandatory: data.isMandatory,
          isTemplate: data.isTemplate
        });

        window.SeavModals?.closeAllModals?.();
        Seav.notify("success", "Saved", "Certificate added to your library.");
        refreshView();
      }, { sub: "Saving certificate" });
    });

    document.addEventListener("click", async (e) => {
      const toggleBtn = e.target.closest("[data-toggle-cert-id]");
      if (toggleBtn) {
        const certId = toggleBtn.getAttribute("data-toggle-cert-id");
        if (expandedCertIds.has(certId)) expandedCertIds.delete(certId);
        else expandedCertIds.add(certId);
        renderList();
        return;
      }

      const editBtn = e.target.closest("[data-edit-cert-id]");
      if (editBtn) {
        e.preventDefault();
        const cert = getCerts().find((c) => c.id === editBtn.getAttribute("data-edit-cert-id"));
        if (cert) openEditModal(cert);
        return;
      }

      const delBtn = e.target.closest("[data-del-cert-id]");
      if (!delBtn) return;
      e.preventDefault();

      const cert = getCerts().find((c) => c.id === delBtn.getAttribute("data-del-cert-id"));
      if (!Seav.confirmDelete({ itemName: cert?.name || "", itemLabel: "certificate" })) return;

      await window.SeavAPI.deleteItemById(STORAGE_KEY, delBtn.getAttribute("data-del-cert-id"));
      expandedCertIds.delete(delBtn.getAttribute("data-del-cert-id"));
      refreshView();
    });

    const exportApi = window.SeavCertificatesExport;
    const bulkMsg = document.getElementById("certBulkMsg");

    document.getElementById("btnDownloadAllCerts")?.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await exportApi?.downloadAllCertificates?.();
      } catch (err) {
        Seav.notify("error", "Download failed", err.message || "Could not download.");
      }
    });

    document.getElementById("btnShareAllCerts")?.addEventListener("click", (e) => {
      e.preventDefault();
      window.SeavModals?.openModal?.("certShareModal");
    });

    document.getElementById("btnShareZipCerts")?.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await exportApi?.shareAllCertificates?.();
      } catch (err) {
        if (bulkMsg) bulkMsg.textContent = err.message || "Share unavailable.";
      }
    });

    document.getElementById("btnEmailCertSummary")?.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await exportApi?.emailCertificateSummary?.();
      } catch (err) {
        Seav.notify("error", "Email failed", err.message || "Could not open email.");
      }
    });

    document.getElementById("btnDownloadZipFromModal")?.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await exportApi?.downloadAllCertificates?.();
      } catch (err) {
        Seav.notify("error", "Download failed", err.message || "Could not download.");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
