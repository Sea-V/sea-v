// /js/certificates-render.js
(function () {
  "use strict";
  const C = window.SeavCertificatesCore;
  if (!C || !window.Seav) return;
  const {
    expandedCertIds, MANDATORY_TYPE_LABEL, getCerts, isMandatoryCert, isRecommendedTemplate,
    findCertByCode, getRankRoleCerts, getAdditionalCerts, getCertExpiryLabel,
    getDisplayStatus, sortCerts
  } = C;
  const { MANDATORY_CERTS, renderMandatoryCertDetailHtml, isCertNoExpiry } = window.SeavData;
  const Seav = window.Seav;
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


  window.SeavCertificatesRender = { buildCertRow, renderEmptyRow, renderMandatorySections, renderCerts };
})();
