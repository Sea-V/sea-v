// /js/certificates.js
(function () {
  "use strict";
  if (!window.Seav || !window.SeavAPI || !window.SeavData || !window.SeavState) return;
  const C = window.SeavCertificatesCore;
  const R = window.SeavCertificatesRender;
  const X = window.SeavCertificatesExport;
  if (!C || !R || !X) return;
  const {
    STORAGE_KEY, expandedCertIds, syncCertificateTemplates, syncCertExpiryFields,
    getCerts, isMandatoryCert, isRecommendedTemplate, findCertByCode, getDisplayStatus, normalizeCode, normalizeName
  } = C;
  const { renderCerts } = R;
  const { emailCertificateSummary, shareAllCertificates, downloadAllCertificates } = X;
  const { createId, isCertNoExpiry } = window.SeavData;
  const Seav = window.Seav;
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
      "Safety first — muster your compliance records",
      "Checking ENG1, BST modules, and STCW status…",
      "All present and accounted for",
      "Preparing your certificate library for inspection"
    ];
    const CERT_LOADER_MIN_MS = 500;

    let certLoaderTimer = null;

    function showCertLoader() {
      if (!window.SeavFeedback?.showPageLoader) return;

      window.SeavFeedback.showPageLoader(
        "Loading certificates…",
        CERT_LOADER_LINES[0]
      );

      let lineIndex = 0;
      certLoaderTimer = window.setInterval(() => {
        lineIndex = (lineIndex + 1) % CERT_LOADER_LINES.length;
        const subEl = document.querySelector(".seav-page-loader-sub");
        if (subEl) subEl.textContent = CERT_LOADER_LINES[lineIndex];
      }, 2400);
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

    const initData = async () => {
      const loaderStartedAt = Date.now();
      showCertLoader();

      try {
        const { certs } = await syncCertificateTemplates();

        if (window.SeavState?.updateCerts) {
          window.SeavState.updateCerts(certs);
        } else if (window.SeavState?.data) {
          window.SeavState.data.certs = certs;
          runRefresh();
        }
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
