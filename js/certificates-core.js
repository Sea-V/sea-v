// /js/certificates-core.js
(function () {
  "use strict";
  if (!window.SeavData) {
    console.warn("[SEA-V] SeavData not found. Did you include js/seav-data.js before certificates-core.js?");
    return;
  }

  const {
    KEYS, MANDATORY_CERTS, RECOMMENDED_CERTS, DEPRECATED_MANDATORY_CODES,
    getCertExpiryInfo, isSuppressedAdditionalCert, isCertNoExpiry
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

  const CUSTOM_CERT_PICKER_CODE = "__CUSTOM__";

  function getCertCatalog() {
    const mandatory = (MANDATORY_CERTS || []).map((template) => ({
      code: template.code,
      name: template.name,
      isMandatory: true,
      isTemplate: true,
      group: "mandatory"
    }));

    const recommended = (RECOMMENDED_CERTS || []).map((template) => ({
      code: template.code,
      name: template.name,
      isMandatory: false,
      isTemplate: true,
      group: "rank"
    }));

    return [
      ...mandatory,
      ...recommended,
      {
        code: CUSTOM_CERT_PICKER_CODE,
        name: "Custom certificate (enter details below)",
        isMandatory: false,
        isTemplate: false,
        group: "custom"
      }
    ];
  }

  function getAvailableCertPickerOptions(certs = getCerts()) {
    const existingCodes = new Set(
      (certs || []).map((cert) => normalizeCode(cert.code)).filter(Boolean)
    );

    return getCertCatalog().filter(
      (option) =>
        option.code === CUSTOM_CERT_PICKER_CODE ||
        !existingCodes.has(normalizeCode(option.code))
    );
  }

  function findCatalogOption(code) {
    return getCertCatalog().find((option) => normalizeCode(option.code) === normalizeCode(code)) || null;
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
    STORAGE_KEY, expandedCertIds, MANDATORY_TYPE_LABEL, CUSTOM_CERT_PICKER_CODE,
    getCerts, normalizeCode, normalizeName, isMandatoryCert, isRecommendedTemplate,
    findCertByCode, getMandatoryCerts, getRankRoleCerts, getAdditionalCerts,
    getCertCatalog, getAvailableCertPickerOptions, findCatalogOption,
    formatDatePretty, syncCertExpiryFields,
    getCertExpiryLabel, getDisplayStatus, sortCerts
  };
})();
