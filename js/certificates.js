// /js/certificates.js
(function () {
  "use strict";

  if (!window.SeavData || !window.Seav || !window.SeavAPI) return;

  const Seav = window.Seav;
  const {
    KEYS,
    MANDATORY_CERTS,
    RECOMMENDED_CERTS,
    createId,
    getCertExpiryInfo
  } = window.SeavData;

  const STORAGE_KEY = KEYS.CERTS;
  const CUSTOM = "__CUSTOM__";

  function getCerts() {
    return window.SeavState?.certs || [];
  }

  function isSavedCert(cert) {
    if (!cert) return false;
    if (!cert.isTemplate) return true;
    const hasFile = !!(cert.attachment?.url || cert.attachment?.dataUrl);
    return !!(cert.expiry || cert.noExpiry || hasFile);
  }

  function getSavedCerts() {
    return getCerts().filter(isSavedCert);
  }

  function normCode(v) {
    return String(v || "").trim().toUpperCase();
  }

  function catalog() {
    return [
      ...(MANDATORY_CERTS || []).map((t) => ({
        code: t.code,
        name: t.name,
        isMandatory: true,
        isTemplate: true
      })),
      ...(RECOMMENDED_CERTS || []).map((t) => ({
        code: t.code,
        name: t.name,
        isMandatory: false,
        isTemplate: true
      })),
      { code: CUSTOM, name: "Other certificate", isMandatory: false, isTemplate: false }
    ];
  }

  function findCatalog(code) {
    return catalog().find((item) => normCode(item.code) === normCode(code)) || null;
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

  function formatExpiry(expiry) {
    if (!expiry) return "No expiry date";
    const d = new Date(expiry);
    if (Number.isNaN(d.getTime())) return expiry;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  function renderList() {
    const list = document.getElementById("certsList");
    const empty = document.getElementById("certsEmpty");
    if (!list) return;

    const certs = [...getSavedCerts()].sort((a, b) =>
      String(a.name || a.code || "").localeCompare(String(b.name || b.code || ""))
    );

    if (empty) empty.hidden = certs.length > 0;

    if (!certs.length) {
      list.innerHTML = "";
      return;
    }

    list.innerHTML = certs
      .map((cert) => {
        const status = statusFromCert(cert);
        const fileUrl = cert.attachment?.url || cert.attachment?.dataUrl || "";
        return `
          <article class="cert-row">
            <div class="cert-row-main">
              <div class="cert-row-title">${Seav.escapeHtml(cert.name || cert.code || "Certificate")}</div>
              <div class="cert-row-sub">${Seav.escapeHtml(cert.code || "—")} · Expires ${Seav.escapeHtml(formatExpiry(cert.expiry))}</div>
            </div>
            <span class="cert-status-pill ${Seav.escapeHtml(status.statusClass)}">${Seav.escapeHtml(status.badge)}</span>
            <div class="cert-row-actions">
              ${fileUrl ? `<a class="btn-ghost2" href="${Seav.escapeHtml(fileUrl)}" target="_blank" rel="noopener">View</a>` : ""}
              ${Seav.seavAction("edit", "Edit", `data-edit-cert-id="${Seav.escapeHtml(cert.id)}"`)}
              ${Seav.seavAction("delete", "Delete", `data-del-cert-id="${Seav.escapeHtml(cert.id)}"`)}
            </div>
          </article>
        `;
      })
      .join("");
  }

  function fillTypeSelect(currentCode) {
    const select = document.getElementById("ct_type");
    if (!select) return;

    const taken = takenCodes(getSavedCerts());
    const editCode = normCode(currentCode);

    select.innerHTML = `<option value="">Choose a certificate…</option>`;

    catalog().forEach((item) => {
      if (item.code !== CUSTOM && taken.has(normCode(item.code)) && normCode(item.code) !== editCode) {
        return;
      }
      const label = item.code === CUSTOM ? item.name : `${item.name} (${item.code})`;
      const opt = new Option(label, item.code);
      if (normCode(item.code) === editCode) opt.selected = true;
      select.appendChild(opt);
    });
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

    Seav.setDateTriplet("ct_expiry", cert.expiry || "");
    document.getElementById("ct_file").value = "";
    window.SeavModals?.openModal?.("certModal");
  }

  function readForm() {
    const editId = document.getElementById("ct_edit_id")?.value || "";
    const typeCode = document.getElementById("ct_type")?.value || "";
    const item = findCatalog(typeCode);
    const isCustom = typeCode === CUSTOM;
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
      expiry,
      noExpiry,
      isMandatory,
      isTemplate,
      file: document.getElementById("ct_file")?.files?.[0] || null
    };
  }

  async function uploadFile(file, existing, certId) {
    if (!file) return existing || null;
    return (
      window.SeavUpload?.uploadToStorage({
        bucket: "certificate-files",
        entityId: certId,
        file,
        existingMeta: existing,
        kind: "Certificate"
      }) ?? null
    );
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

  window.SeavCertificatesRender = { renderCerts: renderList };

  function runRefresh() {
    renderList();
  }

  function init() {
    if (!document.getElementById("certsList")) return;

    document.addEventListener("seav:state-ready", runRefresh, { once: true });
    document.addEventListener("seav:data-updated", renderList);
    if (window.SeavState?.ready) runRefresh();

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
        const attachment = await uploadFile(data.file, existing?.attachment || null, certId);
        if (data.file && !attachment) return;

        await window.SeavAPI.upsertItemById(STORAGE_KEY, {
          id: certId,
          code: data.code,
          name: data.name,
          expiry: data.noExpiry ? "" : data.expiry,
          status: computeStoredStatus(data.expiry, data.noExpiry),
          attachment: attachment || existing?.attachment || null,
          noExpiry: data.noExpiry,
          isMandatory: data.isMandatory,
          isTemplate: data.isTemplate
        });

        window.SeavModals?.closeAllModals?.();
        Seav.notify("success", "Saved", "Certificate added to your library.");
        renderList();
      }, { sub: "Saving certificate" });
    });

    document.addEventListener("click", async (e) => {
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
      renderList();
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
