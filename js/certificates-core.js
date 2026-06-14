// /js/certificates-core.js
(function () {
  "use strict";
  if (!window.Seav || !window.SeavAPI || !window.SeavData || !window.SeavState) return;

  const {
    KEYS, MANDATORY_CERTS, RECOMMENDED_CERTS, DEPRECATED_MANDATORY_CODES,
    createId, getCertExpiryInfo, getMandatoryCertTemplate, isSuppressedAdditionalCert, isCertNoExpiry
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

    if (changed) {
      existing = await SeavAPI.getArray(STORAGE_KEY);
    }

    return { changed, certs: existing };
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


  window.SeavCertificatesCore = {
    STORAGE_KEY, expandedCertIds, MANDATORY_TYPE_LABEL,
    getCerts, normalizeCode, normalizeName, isMandatoryCert, isRecommendedTemplate,
    findCertByCode, getMandatoryCerts, getRankRoleCerts, getAdditionalCerts,
    syncCertificateTemplates, formatDatePretty, syncCertExpiryFields,
    getCertExpiryLabel, getDisplayStatus, sortCerts
  };
})();
