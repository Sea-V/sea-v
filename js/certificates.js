// /js/certificates.js
(function () {
  "use strict";
  if (!window.Seav || !window.SeavAPI || !window.SeavData || !window.SeavState) return;
  const C = window.SeavCertificatesCore;
  const R = window.SeavCertificatesRender;
  const X = window.SeavCertificatesExport;
  if (!C || !R || !X) return;
  const {
    STORAGE_KEY, expandedCertIds, CUSTOM_CERT_PICKER_CODE, syncCertExpiryFields,
    getCerts, isMandatoryCert, isRecommendedTemplate, findCertByCode, getDisplayStatus,
    normalizeCode, normalizeName, getAvailableCertPickerOptions, findCatalogOption
  } = C;
  const { renderCerts } = R;
  const { emailCertificateSummary, shareAllCertificates, downloadAllCertificates } = X;
  const { createId, isCertNoExpiry } = window.SeavData;
  const Seav = window.Seav;
  function setCertModalMode(mode) {
    const pickerWrap = document.getElementById("ct_picker_wrap");
    const pickerEl = document.getElementById("ct_cert_picker");
    const codeWrap = document.getElementById("ct_code_wrap");
    const nameWrap = document.getElementById("ct_name_wrap");
    const isAdd = mode === "add";

    if (pickerWrap) pickerWrap.hidden = !isAdd;
    if (pickerEl) {
      pickerEl.required = isAdd;
      if (isAdd) pickerEl.value = "";
    }
    if (codeWrap) codeWrap.hidden = isAdd;
    if (nameWrap) nameWrap.hidden = isAdd;

    if (isAdd) {
      populateCertPicker();
    }
  }

  function populateCertPicker() {
    const select = document.getElementById("ct_cert_picker");
    if (!select) return;

    const options = getAvailableCertPickerOptions(getCerts());
    const groups = [
      { key: "mandatory", label: "Minimum mandatory" },
      { key: "rank", label: "Rank & role" },
      { key: "custom", label: "Other" }
    ];

    select.innerHTML = `<option value="">Choose a certificate…</option>`;

    groups.forEach(({ key, label }) => {
      const items = options.filter((option) => option.group === key);
      if (!items.length) return;

      const optgroup = document.createElement("optgroup");
      optgroup.label = label;

      items.forEach((option) => {
        const el = document.createElement("option");
        el.value = option.code;
        el.textContent =
          option.code === CUSTOM_CERT_PICKER_CODE
            ? option.name
            : `${option.name} (${option.code})`;
        optgroup.appendChild(el);
      });

      select.appendChild(optgroup);
    });
  }

  function applyCertPickerSelection(code) {
    const codeEl = document.getElementById("ct_code");
    const nameEl = document.getElementById("ct_name");
    const isTemplateEl = document.getElementById("ct_is_template");
    const isMandatoryEl = document.getElementById("ct_is_mandatory");
    const codeWrap = document.getElementById("ct_code_wrap");
    const nameWrap = document.getElementById("ct_name_wrap");

    if (!code) return;

    const catalogOption = findCatalogOption(code);
    if (!catalogOption || catalogOption.code === CUSTOM_CERT_PICKER_CODE) {
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
      if (codeWrap) codeWrap.hidden = false;
      if (nameWrap) nameWrap.hidden = false;
      return;
    }

    if (codeEl) {
      codeEl.value = catalogOption.code;
      codeEl.disabled = true;
    }
    if (nameEl) {
      nameEl.value = catalogOption.name;
      nameEl.disabled = true;
    }
    if (isTemplateEl) isTemplateEl.value = catalogOption.isTemplate ? "true" : "false";
    if (isMandatoryEl) isMandatoryEl.value = catalogOption.isMandatory ? "true" : "false";
    if (codeWrap) codeWrap.hidden = true;
    if (nameWrap) nameWrap.hidden = true;
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
    setCertModalMode("edit");

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
    setCertModalMode("add");
  }

  function readCertForm() {
    const noExpiry = document.getElementById("ct_no_expiry")?.checked || false;
    const editId = document.getElementById("ct_edit_id")?.value || "";
    const pickerCode = document.getElementById("ct_cert_picker")?.value || "";
    const catalogOption = !editId && pickerCode ? findCatalogOption(pickerCode) : null;
    const isCustomPick = catalogOption?.code === CUSTOM_CERT_PICKER_CODE;

    let code = document.getElementById("ct_code")?.value.trim() || "";
    let name = document.getElementById("ct_name")?.value.trim() || "";
    let isTemplate = document.getElementById("ct_is_template")?.value === "true";
    let isMandatory = document.getElementById("ct_is_mandatory")?.value === "true";

    if (!editId && catalogOption && !isCustomPick) {
      code = catalogOption.code;
      name = catalogOption.name;
      isTemplate = catalogOption.isTemplate;
      isMandatory = catalogOption.isMandatory;
    }

    return {
      id: editId,
      pickerCode,
      isCustomPick,
      isTemplate,
      isMandatory,
      code,
      name,
      noExpiry,
      expiry: noExpiry ? "" : Seav.readDateTriplet("ct_expiry"),
      status: document.getElementById("ct_status")?.value || "Missing",
      file: document.getElementById("ct_file")?.files?.[0] || null
    };
  }

  async function buildCertAttachment(file, existingAttachment, certId) {
    return window.SeavUpload?.uploadToStorage({
      bucket: "certificate-files",
      entityId: certId,
      file,
      existingMeta: existingAttachment,
      kind: "Certificate"
    }) ?? existingAttachment ?? null;
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

    const CERT_LOADER_LINES = [
      "Fetching your certificate library…",
      "Ready when you are"
    ];
    const CERT_LOADER_MIN_MS = 0;

    let certLoaderTimer = null;

    function showCertLoader() {
      if (!window.SeavFeedback?.showPageLoader) return;

      window.SeavFeedback.showPageLoader("Loading certificates…", CERT_LOADER_LINES[0]);
    }

    function hideCertLoader() {
      if (certLoaderTimer) {
        window.clearInterval(certLoaderTimer);
        certLoaderTimer = null;
      }
      window.SeavFeedback?.hidePageLoader?.();
    }

    const runRefresh = () => {
      renderCerts();
    };

    let initStarted = false;

    const initData = async () => {
      if (initStarted) return;
      initStarted = true;

      const loaderStartedAt = Date.now();
      showCertLoader();

      try {
        if (window.SeavState?.ready && !getCerts().length) {
          const certs = await SeavAPI.getArray(STORAGE_KEY);
          window.SeavState?.updateCerts?.(certs);
        }
        runRefresh();
      } catch (err) {
        console.error("[SEA-V] Certificate load failed:", err);
        Seav.notify(
          "error",
          "Load failed",
          "Could not load your certificates. Please refresh and try again."
        );
      } finally {
        const elapsed = Date.now() - loaderStartedAt;
        const waitMs = Math.max(0, CERT_LOADER_MIN_MS - elapsed);
        if (waitMs > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, waitMs));
        }
        hideCertLoader();
      }
    };

    document.addEventListener("seav:state-ready", initData, { once: true });
    if (window.SeavState?.ready) {
      initData();
    }

    const certForm = document.getElementById("certForm");

    document.querySelector('[data-open="certModal"]')?.addEventListener("click", () => {
      if (certForm) resetCertForm(certForm);
    });

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

    if (certForm) {
      const pickerEl = document.getElementById("ct_cert_picker");
      if (pickerEl) {
        pickerEl.addEventListener("change", (event) => {
          applyCertPickerSelection(event.target.value);
        });
      }

      const noExpiryEl = document.getElementById("ct_no_expiry");
      if (noExpiryEl) {
        noExpiryEl.addEventListener("change", (event) => {
          syncCertExpiryFields(event.target.checked);
        });
      }

      certForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = readCertForm();

        if (!formData.id && !formData.pickerCode) {
          Seav.notify("error", "Choose a certificate", "Select a certificate from the dropdown list.");
          return;
        }

        if (!formData.name) {
          Seav.notify("error", "Name required", "Enter the certificate name.");
          return;
        }

        const currentCerts = getCerts();

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
            code: formData.code,
            name: formData.name,
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

          renderCerts();
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

      if (window.SeavState?.updateCerts) {
        window.SeavState.updateCerts(window.SeavState.certs);
      }

      renderCerts();
    });

    document.addEventListener("seav:data-updated", runRefresh);
  }

  document.addEventListener("DOMContentLoaded", initCertificates);

})();
