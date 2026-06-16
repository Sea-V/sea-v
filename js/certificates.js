// /js/certificates.js — certificate library (core + render + page)
(function () {
  "use strict";

  if (!window.SeavData || !window.Seav) {
    console.warn("[SEA-V] certificates.js: SeavData or Seav not loaded.");
    return;
  }

  const Seav = window.Seav;
  const {
    KEYS,
    MANDATORY_CERTS,
    RECOMMENDED_CERTS,
    DEPRECATED_MANDATORY_CODES,
    createId,
    getCertExpiryInfo,
    isSuppressedAdditionalCert,
    isCertNoExpiry,
    renderMandatoryCertDetailHtml
  } = window.SeavData;

  const STORAGE_KEY = KEYS.CERTS;
  const CUSTOM_CODE = "__CUSTOM__";
  const expandedCertIds = new Set();

  function normalizeCode(value) {
    return String(value || "").trim().toUpperCase();
  }

  function normalizeName(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function getCerts() {
    return window.SeavState?.certs || [];
  }

  const mandatoryCodeSet = new Set((MANDATORY_CERTS || []).map((item) => normalizeCode(item.code)));
  const recommendedCodeSet = new Set((RECOMMENDED_CERTS || []).map((item) => normalizeCode(item.code)));
  const deprecatedMandatorySet = new Set((DEPRECATED_MANDATORY_CODES || []).map((code) => normalizeCode(code)));

  function isMandatoryCert(cert) {
    if (!cert) return false;
    if (deprecatedMandatorySet.has(normalizeCode(cert.code))) return false;
    return !!cert.isMandatory || mandatoryCodeSet.has(normalizeCode(cert.code));
  }

  function isRecommendedTemplate(cert) {
    if (!cert || isMandatoryCert(cert)) return false;
    if (recommendedCodeSet.has(normalizeCode(cert.code))) {
      return cert.isTemplate !== false;
    }
    return !!cert.isTemplate && recommendedCodeSet.has(normalizeCode(cert.code));
  }

  function getMandatoryCerts(certs) {
    return (certs || []).filter(isMandatoryCert);
  }

  function getRankRoleCerts(certs) {
    return (certs || []).filter(isRecommendedTemplate);
  }

  function getAdditionalCerts(certs) {
    return (certs || []).filter(
      (cert) =>
        !isMandatoryCert(cert) &&
        !isRecommendedTemplate(cert) &&
        !isSuppressedAdditionalCert(cert)
    );
  }

  function getCertCatalog() {
    return [
      ...(MANDATORY_CERTS || []).map((template) => ({
        code: template.code,
        name: template.name,
        isMandatory: true,
        isTemplate: true,
        group: "mandatory"
      })),
      ...(RECOMMENDED_CERTS || []).map((template) => ({
        code: template.code,
        name: template.name,
        isMandatory: false,
        isTemplate: true,
        group: "rank"
      })),
      {
        code: CUSTOM_CODE,
        name: "Custom certificate",
        isMandatory: false,
        isTemplate: false,
        group: "custom"
      }
    ];
  }

  function getAvailablePickerOptions(certs) {
    const taken = new Set((certs || []).map((cert) => normalizeCode(cert.code)).filter(Boolean));
    return getCertCatalog().filter(
      (item) => item.code === CUSTOM_CODE || !taken.has(normalizeCode(item.code))
    );
  }

  function findCatalogItem(code) {
    return (
      getCertCatalog().find((item) => normalizeCode(item.code) === normalizeCode(code)) || null
    );
  }

  function getDisplayStatus(cert) {
    const hasAttachment = !!(cert?.attachment?.url || cert?.attachment?.dataUrl);

    if (isCertNoExpiry(cert)) {
      return { label: "No Expiry", badge: "No Expiry", statusClass: "pill-neutral" };
    }

    if (!hasAttachment && !cert?.expiry) {
      return { label: "Missing", badge: "Missing", statusClass: "pill-missing" };
    }

    if (!cert?.expiry) {
      const status = String(cert?.status || "Pending");
      if (status.toLowerCase() === "valid") {
        return { label: "Valid", badge: "Valid", statusClass: "pill-valid" };
      }
      return {
        label: status || "Pending",
        badge: status || "Pending",
        statusClass: status.toLowerCase().includes("pending") ? "pill-pending" : "pill-neutral"
      };
    }

    const expiryInfo = getCertExpiryInfo(cert.expiry);
    return {
      ...expiryInfo,
      statusClass: String(expiryInfo.statusClass || "pill-neutral").replace(/^pill\s+/, "")
    };
  }

  function getCertExpiryLabel(cert) {
    if (isCertNoExpiry(cert)) return "No expiry";
    if (cert?.expiry) {
      const d = new Date(cert.expiry);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      }
    }
    return "No expiry recorded";
  }

  function sortCerts(items) {
    return [...items].sort((a, b) => {
      const score = (cert) => {
        const badge = String(getDisplayStatus(cert).badge || "").toLowerCase();
        if (badge.includes("missing")) return 0;
        if (badge.includes("expired")) return 1;
        if (badge.includes("expires soon")) return 2;
        if (badge.includes("pending")) return 3;
        if (badge.includes("valid")) return 4;
        if (badge.includes("no expiry")) return 5;
        return 6;
      };
      const diff = score(a) - score(b);
      if (diff !== 0) return diff;
      const aDate = a.expiry ? new Date(a.expiry) : new Date("9999-12-31");
      const bDate = b.expiry ? new Date(b.expiry) : new Date("9999-12-31");
      if (aDate - bDate !== 0) return aDate - bDate;
      return String(a.name || a.code || "").localeCompare(String(b.name || b.code || ""));
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

  function renderEmptyRow(message, statusLabel) {
    return `
      <div class="cert-compact-empty">
        <div class="cert-compact-empty-copy">${Seav.escapeHtml(message)}</div>
        <span class="cert-status-pill pill-neutral">${Seav.escapeHtml(statusLabel || "—")}</span>
      </div>
    `;
  }

  function buildCertRow(cert) {
    const certId = cert.id || "";
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
      ? "Minimum mandatory"
      : isRecommendedTemplate(cert)
        ? "Rank & role"
        : "Additional";

    return `
      <article class="cert-compact-card ui-card ui-card-hover ui-accent-gold${isExpanded ? " is-expanded" : ""}" data-cert-id="${Seav.escapeHtml(certId)}">
        <button type="button" class="cert-compact-summary" aria-expanded="${isExpanded ? "true" : "false"}" data-toggle-cert-id="${Seav.escapeHtml(certId)}">
          <div class="cert-compact-summary-left">
            <div class="cert-compact-title">${Seav.escapeHtml(displayTitle)}</div>
            <div class="cert-compact-sub">${Seav.escapeHtml(cert.code || "No code")} • ${Seav.escapeHtml(expiryMeta)}</div>
          </div>
          <div class="cert-compact-summary-right">
            <span class="cert-status-pill ${statusClass}">${Seav.escapeHtml(statusLabel)}</span>
            <span class="cert-chevron" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
          </div>
        </button>
        <div class="cert-compact-body"${isExpanded ? "" : " hidden"}>
          <div class="cert-compact-detail-grid">
            <div class="cert-compact-detail-panel">
              <div class="cert-compact-detail-label">Certificate</div>
              <div class="cert-compact-detail-value">${Seav.escapeHtml(cert.name || "—")}<br>Code: ${Seav.escapeHtml(cert.code || "—")}</div>
            </div>
            <div class="cert-compact-detail-panel">
              <div class="cert-compact-detail-label">Expiry & status</div>
              <div class="cert-compact-detail-value">${Seav.escapeHtml(expiryLabel)}<br>${Seav.escapeHtml(statusInfo.label || statusLabel)}</div>
            </div>
            <div class="cert-compact-detail-panel">
              <div class="cert-compact-detail-label">Type</div>
              <div class="cert-compact-detail-value">${Seav.escapeHtml(typeLabel)}</div>
            </div>
            <div class="cert-compact-detail-panel">
              <div class="cert-compact-detail-label">Attachment</div>
              <div class="cert-compact-detail-value">${
                hasFile
                  ? `<a class="cert-attachment-link" href="${Seav.escapeHtml(fileUrl)}" target="_blank" rel="noopener">Download certificate</a>`
                  : "No attachment uploaded"
              }</div>
            </div>
          </div>
          ${renderMandatoryCertDetailHtml(cert.code)}
          <div class="seav-actions seav-actions--compact">
            ${Seav.seavAction("edit", "Edit", `data-edit-cert-id="${Seav.escapeHtml(certId)}"`)}
            ${Seav.seavAction("delete", "Delete", `data-del-cert-id="${Seav.escapeHtml(certId)}"`)}
          </div>
        </div>
      </article>
    `;
  }

  function renderCerts() {
    const mandatoryMount = document.getElementById("mandatoryCertsMount");
    const rankRoleList = document.getElementById("rankRoleCertsList");
    const additionalList = document.getElementById("additionalCertsList");
    if (!mandatoryMount && !rankRoleList && !additionalList) return;

    const certs = getCerts();
    const mandatory = sortCerts(getMandatoryCerts(certs));
    const rankRole = sortCerts(getRankRoleCerts(certs));
    const additional = sortCerts(getAdditionalCerts(certs));

    if (mandatoryMount) {
      mandatoryMount.innerHTML = mandatory.length
        ? mandatory.map(buildCertRow).join("")
        : renderEmptyRow(
            "No mandatory certificates yet. Click Add Certificate, then choose ENG1, BST modules, or PSA.",
            "—"
          );
    }

    if (rankRoleList) {
      rankRoleList.innerHTML = rankRole.length
        ? rankRole.map(buildCertRow).join("")
        : renderEmptyRow(
            "No rank & role certificates yet. Add CoC, GMDSS, PDSD, or other role-specific certs.",
            "—"
          );
    }

    if (additionalList) {
      additionalList.innerHTML = additional.length
        ? additional.map(buildCertRow).join("")
        : renderEmptyRow("No additional certificates yet. Choose Custom certificate when adding.", "—");
    }
  }

  window.SeavCertificatesCore = {
    STORAGE_KEY,
    expandedCertIds,
    CUSTOM_CERT_PICKER_CODE: CUSTOM_CODE,
    getCerts,
    normalizeCode,
    normalizeName,
    isMandatoryCert,
    isRecommendedTemplate,
    getMandatoryCerts,
    getRankRoleCerts,
    getAdditionalCerts,
    getCertCatalog,
    getAvailableCertPickerOptions: getAvailablePickerOptions,
    findCatalogOption: findCatalogItem,
    syncCertExpiryFields,
    getCertExpiryLabel,
    getDisplayStatus,
    sortCerts
  };

  window.SeavCertificatesRender = { renderCerts, buildCertRow, renderEmptyRow };

  let selectedPickerCode = "";

  function populateCertPicker() {
    const list = document.getElementById("ct_cert_picker");
    if (!list) return;

    const options = getAvailablePickerOptions(getCerts());
    const groups = [
      { key: "mandatory", label: "Minimum mandatory" },
      { key: "rank", label: "Rank & role" },
      { key: "custom", label: "Other" }
    ];

    list.innerHTML = groups
      .map(({ key, label }) => {
        const items = options.filter((item) => item.group === key);
        if (!items.length) return "";

        const buttons = items
          .map((item) => {
            const isCustom = item.code === CUSTOM_CODE;
            const title = isCustom ? item.name : item.name;
            const sub = isCustom ? "Enter your own code and name" : item.code;
            return `
              <button
                type="button"
                class="cert-picker-btn${selectedPickerCode === item.code ? " is-selected" : ""}"
                data-picker-code="${Seav.escapeHtml(item.code)}"
              >
                <span class="cert-picker-btn-title">${Seav.escapeHtml(title)}</span>
                <span class="cert-picker-btn-sub">${Seav.escapeHtml(sub)}</span>
              </button>
            `;
          })
          .join("");

        return `
          <div class="cert-picker-group">
            <p class="cert-picker-group-label">${Seav.escapeHtml(label)}</p>
            <div class="cert-picker-group-list">${buttons}</div>
          </div>
        `;
      })
      .join("");

    if (!list.innerHTML.trim()) {
      list.innerHTML = `<p class="cert-picker-empty">All catalogue certificates are already in your library. Use Custom certificate to add another.</p>`;
    }
  }

  function setModalMode(mode) {
    const isAdd = mode === "add";
    const pickerWrap = document.getElementById("ct_picker_wrap");
    const detailsWrap = document.getElementById("ct_details_wrap");
    const customWrap = document.getElementById("ct_custom_wrap");
    const selectedWrap = document.getElementById("ct_selected_wrap");
    const modalTitle = document.getElementById("certModalTitle");

    if (modalTitle) modalTitle.textContent = isAdd ? "Add certificate" : "Edit certificate";
    if (pickerWrap) pickerWrap.hidden = !isAdd;
    if (detailsWrap) detailsWrap.hidden = isAdd && !selectedPickerCode;
    if (customWrap) customWrap.hidden = true;
    if (selectedWrap) selectedWrap.hidden = !isAdd || !selectedPickerCode;

    if (isAdd) {
      populateCertPicker();
    }
  }

  function applyPickerSelection(code) {
    selectedPickerCode = code || "";
    const item = findCatalogItem(code);
    const detailsWrap = document.getElementById("ct_details_wrap");
    const customWrap = document.getElementById("ct_custom_wrap");
    const selectedWrap = document.getElementById("ct_selected_wrap");
    const selectedLabel = document.getElementById("ct_selected_label");
    const codeEl = document.getElementById("ct_code");
    const nameEl = document.getElementById("ct_name");
    const isTemplateEl = document.getElementById("ct_is_template");
    const isMandatoryEl = document.getElementById("ct_is_mandatory");
    const pickerValue = document.getElementById("ct_picker_code");

    if (pickerValue) pickerValue.value = code || "";

    if (!item || item.code === CUSTOM_CODE) {
      if (codeEl) {
        codeEl.value = "";
        codeEl.disabled = false;
      }
      if (nameEl) {
        nameEl.value = "";
        nameEl.disabled = false;
      }
      if (isTemplateEl) isTemplateEl.value = "false";
      if (isMandatoryEl) isMandatoryEl.value = "false";
      if (customWrap) customWrap.hidden = false;
      if (selectedWrap) selectedWrap.hidden = true;
      if (detailsWrap) detailsWrap.hidden = false;
      populateCertPicker();
      return;
    }

    if (codeEl) {
      codeEl.value = item.code;
      codeEl.disabled = true;
    }
    if (nameEl) {
      nameEl.value = item.name;
      nameEl.disabled = true;
    }
    if (isTemplateEl) isTemplateEl.value = item.isTemplate ? "true" : "false";
    if (isMandatoryEl) isMandatoryEl.value = item.isMandatory ? "true" : "false";
    if (customWrap) customWrap.hidden = true;
    if (selectedLabel) selectedLabel.textContent = `${item.name} (${item.code})`;
    if (selectedWrap) selectedWrap.hidden = false;
    if (detailsWrap) detailsWrap.hidden = false;
    populateCertPicker();
  }

  function resetCertForm(form) {
    form.reset();
    selectedPickerCode = "";

    const editId = document.getElementById("ct_edit_id");
    const isTemplateEl = document.getElementById("ct_is_template");
    const isMandatoryEl = document.getElementById("ct_is_mandatory");
    const statusEl = document.getElementById("ct_status");
    const codeEl = document.getElementById("ct_code");
    const nameEl = document.getElementById("ct_name");
    const pickerValue = document.getElementById("ct_picker_code");

    if (editId) editId.value = "";
    if (isTemplateEl) isTemplateEl.value = "false";
    if (isMandatoryEl) isMandatoryEl.value = "false";
    if (statusEl) statusEl.value = "Missing";
    if (codeEl) codeEl.disabled = false;
    if (nameEl) nameEl.disabled = false;
    if (pickerValue) pickerValue.value = "";

    Seav.clearDateTriplet("ct_expiry");
    syncCertExpiryFields(false);
    setModalMode("add");
  }

  function fillCertForm(cert) {
    selectedPickerCode = "";
    document.getElementById("ct_edit_id").value = cert.id || "";
    document.getElementById("ct_is_template").value = cert.isTemplate ? "true" : "false";
    document.getElementById("ct_is_mandatory").value = cert.isMandatory ? "true" : "false";
    document.getElementById("ct_code").value = cert.code || "";
    document.getElementById("ct_code").disabled = !!cert.isTemplate;
    document.getElementById("ct_name").value = cert.name || "";
    document.getElementById("ct_name").disabled = !!cert.isTemplate;
    document.getElementById("ct_status").value = cert.status || "Missing";
    Seav.setDateTriplet("ct_expiry", cert.expiry || "");
    syncCertExpiryFields(isCertNoExpiry(cert));

    const customWrap = document.getElementById("ct_custom_wrap");
    if (customWrap) customWrap.hidden = false;

    setModalMode("edit");
    document.getElementById("ct_details_wrap").hidden = false;
    window.SeavModals?.openModal?.("certModal");
  }

  function readCertForm() {
    const editId = document.getElementById("ct_edit_id")?.value || "";
    const pickerCode = document.getElementById("ct_picker_code")?.value || selectedPickerCode || "";
    const catalogItem = !editId && pickerCode ? findCatalogItem(pickerCode) : null;
    const isCustom = catalogItem?.code === CUSTOM_CODE;
    const noExpiry = document.getElementById("ct_no_expiry")?.checked || false;

    let code = document.getElementById("ct_code")?.value.trim() || "";
    let name = document.getElementById("ct_name")?.value.trim() || "";
    let isTemplate = document.getElementById("ct_is_template")?.value === "true";
    let isMandatory = document.getElementById("ct_is_mandatory")?.value === "true";

    if (!editId && catalogItem && !isCustom) {
      code = catalogItem.code;
      name = catalogItem.name;
      isTemplate = catalogItem.isTemplate;
      isMandatory = catalogItem.isMandatory;
    }

    return {
      id: editId,
      pickerCode,
      isCustom,
      code,
      name,
      isTemplate,
      isMandatory,
      noExpiry,
      expiry: noExpiry ? "" : Seav.readDateTriplet("ct_expiry"),
      status: document.getElementById("ct_status")?.value || "Missing",
      file: document.getElementById("ct_file")?.files?.[0] || null
    };
  }

  async function buildCertAttachment(file, existingAttachment, certId) {
    return (
      window.SeavUpload?.uploadToStorage({
        bucket: "certificate-files",
        entityId: certId,
        file,
        existingMeta: existingAttachment,
        kind: "Certificate"
      }) ??
      existingAttachment ??
      null
    );
  }

  async function loadCertsFromSupabase() {
    if (!window.SeavAPI) return [];
    return window.SeavAPI.getArray(STORAGE_KEY);
  }

  function initCertificates() {
    if (!document.getElementById("mandatoryCertsMount")) return;

    const certForm = document.getElementById("certForm");
    let loaded = false;

    async function ensureCertsLoaded() {
      if (loaded) {
        renderCerts();
        return;
      }
      loaded = true;

      try {
        if (window.SeavState?.ready) {
          if (!getCerts().length) {
            const certs = await loadCertsFromSupabase();
            window.SeavState?.updateCerts?.(certs);
          }
        } else {
          document.addEventListener(
            "seav:state-ready",
            async () => {
              if (!getCerts().length) {
                const certs = await loadCertsFromSupabase();
                window.SeavState?.updateCerts?.(certs);
              }
              renderCerts();
            },
            { once: true }
          );
          return;
        }
        renderCerts();
      } catch (err) {
        console.error("[SEA-V] Certificate load failed:", err);
        Seav.notify("error", "Load failed", "Could not load your certificates from Supabase.");
      }
    }

    document.addEventListener("seav:state-ready", ensureCertsLoaded, { once: true });
    document.addEventListener("seav:data-updated", renderCerts);
    if (window.SeavState?.ready) ensureCertsLoaded();

    document.querySelectorAll('[data-open="certModal"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        if (certForm) resetCertForm(certForm);
      });
    });

    document.getElementById("ct_cert_picker")?.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-picker-code]");
      if (!btn) return;
      applyPickerSelection(btn.getAttribute("data-picker-code"));
    });

    document.getElementById("ct_change_picker")?.addEventListener("click", (event) => {
      event.preventDefault();
      selectedPickerCode = "";
      document.getElementById("ct_picker_code").value = "";
      document.getElementById("ct_details_wrap").hidden = true;
      document.getElementById("ct_selected_wrap").hidden = true;
      populateCertPicker();
    });

    document.getElementById("ct_no_expiry")?.addEventListener("change", (event) => {
      syncCertExpiryFields(event.target.checked);
    });

    certForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = readCertForm();

      if (!formData.id && !formData.pickerCode) {
        Seav.notify("error", "Choose a certificate", "Tap a certificate type above before saving.");
        return;
      }

      if (!formData.name) {
        Seav.notify("error", "Name required", "Enter the certificate name.");
        return;
      }

      const currentCerts = getCerts();
      const inputCode = normalizeCode(formData.code);
      const inputName = normalizeName(formData.name);
      const duplicate = currentCerts.find((cert) => {
        if (formData.id && cert.id === formData.id) return false;
        const certCode = normalizeCode(cert.code);
        const certName = normalizeName(cert.name);
        return (
          (inputCode && certCode && inputCode === certCode) ||
          (inputName && certName && inputName === certName)
        );
      });

      if (duplicate) {
        Seav.notify("error", "Already exists", "This certificate is already in your library.");
        return;
      }

      const existingCert = formData.id
        ? currentCerts.find((item) => item.id === formData.id) || null
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

        await window.SeavAPI.upsertItemById(STORAGE_KEY, {
          id: certId,
          code: formData.code,
          name: formData.name,
          expiry: formData.noExpiry ? "" : formData.expiry,
          status: finalStatus,
          attachment,
          noExpiry: !!formData.noExpiry,
          isMandatory: existingCert ? existingCert.isMandatory : formData.isMandatory,
          isTemplate: existingCert ? existingCert.isTemplate : formData.isTemplate
        });

        resetCertForm(certForm);
        window.SeavModals?.closeAllModals?.();
        Seav.notify("success", "Certificate saved", "Stored in your Supabase certificate library.");
        renderCerts();
      }, { sub: "Saving certificate" });
    });

    document.addEventListener("click", async (event) => {
      const toggleBtn = event.target.closest("[data-toggle-cert-id]");
      if (toggleBtn) {
        event.preventDefault();
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

      const editBtn = event.target.closest("[data-edit-cert-id]");
      if (editBtn) {
        event.preventDefault();
        const cert = getCerts().find((item) => item.id === editBtn.getAttribute("data-edit-cert-id"));
        if (cert) fillCertForm(cert);
        return;
      }

      const delBtn = event.target.closest("[data-del-cert-id]");
      if (!delBtn) return;

      event.preventDefault();
      const cert = getCerts().find((item) => item.id === delBtn.getAttribute("data-del-cert-id"));
      if (
        !Seav.confirmDelete({
          itemName: cert?.name || cert?.code || "",
          itemLabel: "certificate"
        })
      ) {
        return;
      }

      await window.SeavAPI.deleteItemById(STORAGE_KEY, delBtn.getAttribute("data-del-cert-id"));
      expandedCertIds.delete(delBtn.getAttribute("data-del-cert-id"));
      renderCerts();
    });

    const exportApi = window.SeavCertificatesExport;
    const bulkMsg = document.getElementById("certBulkMsg");

    document.getElementById("btnDownloadAllCerts")?.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        await exportApi?.downloadAllCertificates?.();
        if (bulkMsg) bulkMsg.textContent = "Certificate ZIP downloaded.";
      } catch (err) {
        Seav.notify("error", "Download failed", err.message || "Could not download certificates.");
      }
    });

    document.getElementById("btnShareAllCerts")?.addEventListener("click", (event) => {
      event.preventDefault();
      window.SeavModals?.openModal?.("certShareModal");
    });

    document.getElementById("btnShareZipCerts")?.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        await exportApi?.shareAllCertificates?.();
        if (bulkMsg) bulkMsg.textContent = "Certificate ZIP shared.";
      } catch (err) {
        if (bulkMsg) bulkMsg.textContent = err.message || "Share unavailable.";
      }
    });

    document.getElementById("btnEmailCertSummary")?.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        await exportApi?.emailCertificateSummary?.();
        if (bulkMsg) bulkMsg.textContent = "Email draft opened.";
      } catch (err) {
        Seav.notify("error", "Email failed", err.message || "Could not open email summary.");
      }
    });

    document.getElementById("btnDownloadZipFromModal")?.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        await exportApi?.downloadAllCertificates?.();
        if (bulkMsg) bulkMsg.textContent = "Certificate ZIP downloaded.";
      } catch (err) {
        Seav.notify("error", "Download failed", err.message || "Could not download certificates.");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", initCertificates);
})();
