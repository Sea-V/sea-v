// /js/public-profile-sections.js — public CV section renderers
(function () {
  "use strict";

  if (!window.Seav || !window.SeavData) {
    console.warn("[SEA-V] Public profile sections dependencies missing.");
    return;
  }

  const {
    getOnboardCategoryLabel,
    getHobbyInterestCategoryLabel,
    getSpecialistCategoryLabel,
    getReferenceStatus,
    getCertExpiryInfo,
    isCertNoExpiry,
    renderMandatoryCertDetailHtml,
    isSuppressedAdditionalCert,
    isSavedCert,
    isRankRoleCert,
    MANDATORY_CERTS,
    getSeatimeTotals,
    formatDatePretty
  } = window.SeavData;

  const U = window.SeavPublicProfileUtils || {};
  const {
    LIMITS,
    getVesselRole, getVesselType, getVesselLength, getVesselExperience,
    formatDates, truncate, setSectionCount, buildShowMoreButton,
    groupSeatimeByVessel, formatNm, hasNavCoord, getNavigationRouteCoords,
    computeNavigationTotalNm,
    bindExpandToggles, getCertPublicStatus, findCertByCode, findSavedCertByCode, isMandatoryCert,
    isRecommendedCert, normalizeCode, formatExpiryShort, getComplianceClass,
    renderVerificationBadge, isReferenceVerified,
    resolvePublicCertKey, getPublicCertTypeLabel, isPublicCertExpanded
  } = U;

  const Seav = window.Seav;
  const escapeHtml = Seav.escapeHtml.bind(Seav);

  function buildVesselHighlights(vessel, onboardEntries) {
    return onboardEntries
      .filter((entry) => entry.vesselId === vessel.id && entry.status === "Signed Off")
      .slice(0, 3)
      .map((entry) => entry.title || getOnboardCategoryLabel(entry.category))
      .filter(Boolean);
  }

  function buildVesselCard(v, onboardEntries, seatimeGroups, highlight = false) {
    const role = getVesselRole(v);
    const type = getVesselType(v);
    const size = getVesselLength(v) || "—";
    const experience = getVesselExperience(v);
    const highlights = buildVesselHighlights(v, onboardEntries);
    const seatimeGroup = seatimeGroups.find((group) => group.vesselId === v.id);
    const metaParts = [role, type, size !== "—" ? `${size}` : "", v.flag, v.program, v.builder]
      .filter(Boolean)
      .map((part) => String(part).trim())
      .filter(Boolean);

    const photoUrl = v.photo?.url || v.photo?.dataUrl || "";

    return `
      <article class="public-cv-vessel-card${highlight ? " public-cv-vessel-card--highlight" : ""}" data-pp-more-item>
        <div class="public-cv-vessel-card-head">
          <div class="public-cv-vessel-card-title-wrap">
            ${
              photoUrl
                ? `<div class="public-cv-vessel-thumb" style="background-image:url(${Seav.escapeHtml(photoUrl)})" aria-hidden="true"></div>`
                : ""
            }
            <div>
              <h3 class="public-cv-vessel-card-name">${Seav.escapeHtml(v.name || "Yacht")}</h3>
              <p class="public-cv-vessel-card-dates">${Seav.escapeHtml(formatDates(v.from, v.to))}</p>
            </div>
          </div>
          ${
            seatimeGroup?.totals?.total
              ? `<span class="public-cv-vessel-card-days">${Seav.escapeHtml(String(seatimeGroup.totals.total))} days logged</span>`
              : ""
          }
        </div>
        ${
          metaParts.length
            ? `<p class="public-cv-vessel-card-meta">${Seav.escapeHtml(metaParts.join(" • "))}</p>`
            : ""
        }
        ${
          experience
            ? `<p class="public-cv-vessel-card-story">${Seav.escapeHtml(truncate(experience, 280))}</p>`
            : ""
        }
        ${
          highlights.length
            ? `<ul class="public-cv-vessel-card-highlights">${highlights
                .map((item) => `<li>${Seav.escapeHtml(item)}</li>`)
                .join("")}</ul>`
            : ""
        }
      </article>
    `;
  }

  function renderSeatime(seatimes, vessels) {
    const box = document.getElementById("ppSeatimeSnippet");
    const section = document.getElementById("ppSeatimeSection");
    if (!box || !section) return;

    if (!seatimes.length) {
      section.hidden = true;
      return;
    }

    const totals = getSeatimeTotals(seatimes);
    const groups = groupSeatimeByVessel(seatimes, vessels);
    const visibleGroups = groups.slice(0, LIMITS.seatimes);
    const hiddenGroups = groups.slice(LIMITS.seatimes);
    const moreId = "ppSeatimeMore";

    const buildGroupRow = (group) => {
      const vesselName = group.vessel?.name || "Vessel record";
      const topStatus = group.entries.find((entry) => entry.verificationStatus)?.verificationStatus;
      const capacity = group.entries.find((entry) => entry.capacityServed)?.capacityServed;

      return `
        <div class="public-cv-seatime-row" data-pp-more-item>
          <div class="public-cv-seatime-main">
            <span class="public-cv-seatime-vessel">${Seav.escapeHtml(vesselName)}</span>
            <span class="public-cv-seatime-meta">${Seav.escapeHtml(
              [
                capacity ? `Capacity: ${capacity}` : "",
                group.totals.watchkeeping ? `${group.totals.watchkeeping} watchkeeping days` : ""
              ]
                .filter(Boolean)
                .join(" • ")
            )}</span>
          </div>
          <div class="public-cv-seatime-stats">
            <span class="public-cv-seatime-days">${Seav.escapeHtml(String(group.totals.total))} days</span>
            ${renderVerificationBadge(topStatus)}
          </div>
        </div>
      `;
    };

    box.innerHTML = `
      <div class="public-cv-seatime-totals">
        <div class="public-cv-seatime-total"><span>${Seav.escapeHtml(String(totals.sea))}</span><small>Sea</small></div>
        <div class="public-cv-seatime-total"><span>${Seav.escapeHtml(String(totals.watchkeeping))}</span><small>Watchkeeping</small></div>
        <div class="public-cv-seatime-total"><span>${Seav.escapeHtml(String(totals.yard))}</span><small>Yard</small></div>
        <div class="public-cv-seatime-total"><span>${Seav.escapeHtml(String(totals.standby))}</span><small>Standby</small></div>
        <div class="public-cv-seatime-total public-cv-seatime-total--accent"><span>${Seav.escapeHtml(String(totals.total))}</span><small>Total</small></div>
      </div>
      <div class="public-cv-mini-list">
        ${visibleGroups.map((group) => buildGroupRow(group).replace(" data-pp-more-item", "")).join("")}
        ${
          hiddenGroups.length
            ? `<div class="public-cv-more-block" id="${moreId}" hidden>
                ${hiddenGroups.map(buildGroupRow).join("")}
              </div>`
            : ""
        }
      </div>
      ${hiddenGroups.length ? buildShowMoreButton(moreId, hiddenGroups.length, "records") : ""}
    `;

    section.hidden = false;
  }

  function renderVessels(vessels, onboardEntries, seatimes) {
    const vesselBox = document.getElementById("ppVesselSnippet");
    const section = document.getElementById("ppVesselSection");
    if (!vesselBox) return;

    if (!vessels.length) {
      vesselBox.innerHTML = `<div class="muted">No vessel experience added yet.</div>`;
      setSectionCount("ppVesselCount", 0);
      if (section) section.hidden = false;
      return;
    }

    const sorted = [...vessels].sort((a, b) => {
      const da = a.from ? new Date(a.from) : new Date(0);
      const db = b.from ? new Date(b.from) : new Date(0);
      return db - da;
    });

    const seatimeGroups = groupSeatimeByVessel(seatimes, vessels);
    const visible = sorted.slice(0, LIMITS.vessels);
    const hidden = sorted.slice(LIMITS.vessels);
    const moreId = "ppVesselMore";

    vesselBox.innerHTML = `
      <div class="public-cv-vessel-list">
        ${visible
          .map((v, index) =>
            buildVesselCard(v, onboardEntries, seatimeGroups, index === 0).replace(
              " data-pp-more-item",
              ""
            )
          )
          .join("")}
        ${
          hidden.length
            ? `<div class="public-cv-more-block" id="${moreId}" hidden>
                ${hidden
                  .map((v) => buildVesselCard(v, onboardEntries, seatimeGroups))
                  .join("")}
              </div>`
            : ""
        }
      </div>
      ${hidden.length ? buildShowMoreButton(moreId, hidden.length, "yachts") : ""}
    `;

    setSectionCount("ppVesselCount", sorted.length);
    if (section) section.hidden = false;
  }

  function formatNavigationRouteLabel(item) {
    const from = item.fromPort
      ? [item.fromPort, item.fromCountry].filter(Boolean).join(", ")
      : "";
    const to = [item.toPort || item.port, item.toCountry || item.country]
      .filter(Boolean)
      .join(", ");

    if (from && to) return `${from} → ${to}`;
    return to || from || "Passage";
  }

  function renderNavigation(navigationAreas) {
    const box = document.getElementById("ppNavigationSnippet");
    const section = document.getElementById("ppNavigationSection");
    if (!box || !section) return;

    if (!navigationAreas.length) {
      section.hidden = true;
      return;
    }

    const countries = [
      ...new Set(
        navigationAreas.flatMap((item) =>
          [item.fromCountry, item.toCountry, item.country].filter(Boolean)
        )
      )
    ].sort((a, b) => a.localeCompare(b));

    const ports = new Set(
      navigationAreas.flatMap((item) => {
        const labels = [];
        if (item.fromPort) {
          labels.push([item.fromPort, item.fromCountry].filter(Boolean).join(", "));
        }
        const arrival = [item.toPort || item.port, item.toCountry || item.country]
          .filter(Boolean)
          .join(", ");
        if (arrival) labels.push(arrival);
        return labels;
      })
    );

    const visibleCountries = countries.slice(0, LIMITS.navigationRegions);
    const hiddenCountries = countries.slice(LIMITS.navigationRegions);
    const moreId = "ppNavMore";

    const portEntries = [...navigationAreas]
      .filter(
        (item) =>
          item.fromPort ||
          item.toPort ||
          item.port ||
          item.fromCountry ||
          item.toCountry ||
          item.country
      )
      .sort((a, b) => {
        const da = a.visitedDate ? new Date(a.visitedDate) : new Date(0);
        const db = b.visitedDate ? new Date(b.visitedDate) : new Date(0);
        return db - da;
      });

    const visiblePorts = portEntries.slice(0, LIMITS.navigationPorts);
    const hiddenPorts = portEntries.slice(LIMITS.navigationPorts);
    const portsMoreId = "ppPortsMore";

    const summaryParts = [];
    const totalNm = computeNavigationTotalNm(navigationAreas);
    if (totalNm > 0) {
      summaryParts.push(`${formatNm(totalNm)} navigated`);
    }
    if (countries.length) {
      summaryParts.push(
        `${countries.length} ${countries.length === 1 ? "country" : "countries"}`
      );
    }
    if (ports.size) {
      summaryParts.push(
        `${ports.size} ${ports.size === 1 ? "port" : "ports"} logged`
      );
    }

    box.innerHTML = `
      ${
        summaryParts.length
          ? `<p class="public-cv-nav-summary">${Seav.escapeHtml(summaryParts.join(" • "))}</p>`
          : ""
      }
      <div class="public-cv-chip-row">
        ${visibleCountries
          .map(
            (country) =>
              `<span class="public-cv-chip public-cv-chip--soft">${Seav.escapeHtml(country)}</span>`
          )
          .join("")}
      </div>
      ${
        hiddenCountries.length
          ? `<div class="public-cv-chip-row public-cv-more-block" id="${moreId}" hidden>
              ${hiddenCountries
                .map(
                  (country) =>
                    `<span class="public-cv-chip public-cv-chip--soft" data-pp-more-item>${Seav.escapeHtml(country)}</span>`
                )
                .join("")}
            </div>
            ${buildShowMoreButton(moreId, hiddenCountries.length, "regions")}`
          : ""
      }
      ${
        visiblePorts.length
          ? `<div class="public-cv-port-list">
              ${visiblePorts
                .map((item) => {
                  const label = formatNavigationRouteLabel(item);
                  const dep = item.departureDate || item.visitedDate || "";
                  const arr = item.arrivalDate || "";
                  const when = dep && arr
                    ? `${formatExpiryShort(dep)} → ${formatExpiryShort(arr)}`
                    : dep || arr
                    ? formatExpiryShort(dep || arr)
                    : "";
                  return `
                    <div class="public-cv-port-row">
                      <span>${Seav.escapeHtml(label)}</span>
                      ${when ? `<span class="public-cv-port-when">${Seav.escapeHtml(when)}</span>` : ""}
                    </div>
                  `;
                })
                .join("")}
              ${
                hiddenPorts.length
                  ? `<div class="public-cv-more-block" id="${portsMoreId}" hidden>
                      ${hiddenPorts
                        .map((item) => {
                          const label = formatNavigationRouteLabel(item);
                          return `<div class="public-cv-port-row" data-pp-more-item><span>${Seav.escapeHtml(label)}</span></div>`;
                        })
                        .join("")}
                    </div>
                    ${buildShowMoreButton(portsMoreId, hiddenPorts.length, "ports")}`
                  : ""
              }
            </div>`
          : ""
      }
    `;

    section.hidden = false;
  }

  function buildOperationRow(entry, vessels) {
    const vessel = vessels.find((v) => v.id === entry.vesselId);
    const meta = [
      getOnboardCategoryLabel(entry.category),
      vessel?.name || null,
      entry.dateFrom ? formatExpiryShort(entry.dateFrom) : null
    ]
      .filter(Boolean)
      .join(" • ");

    const signoff = entry.signoff || {};
    const signoffLine =
      signoff.signatoryName || signoff.confirmed
        ? [
            signoff.signatoryName,
            signoff.signatoryRank,
            signoff.signedAt ? formatExpiryShort(signoff.signedAt) : null
          ]
            .filter(Boolean)
            .join(" • ")
        : "";

    return `
      <div class="public-cv-mini-row public-cv-mini-row--stacked" data-pp-more-item>
        <div class="public-cv-mini-main">
          <span class="public-cv-mini-title">${Seav.escapeHtml(entry.title || "Onboard operation")}</span>
          <span class="public-cv-mini-meta">${Seav.escapeHtml(meta)}</span>
          ${entry.description ? `<p class="public-cv-op-desc">${Seav.escapeHtml(truncate(entry.description, 160))}</p>` : ""}
          ${
            signoffLine
              ? `<p class="public-cv-signoff-line">Signed off by ${Seav.escapeHtml(signoffLine)}</p>`
              : ""
          }
        </div>
        ${renderVerificationBadge(entry.status, "Signed off")}
      </div>
    `;
  }

  function renderOperations(onboardEntries, vessels) {
    const box = document.getElementById("ppOperationsSnippet");
    const section = document.getElementById("ppOperationsSection");
    if (!box || !section) return;

    const signed = onboardEntries
      .filter((entry) => entry.status === "Signed Off")
      .sort((a, b) => {
        const da = a.dateFrom ? new Date(a.dateFrom) : new Date(0);
        const db = b.dateFrom ? new Date(b.dateFrom) : new Date(0);
        return db - da;
      });

    if (!signed.length) {
      section.hidden = true;
      return;
    }

    const visible = signed.slice(0, LIMITS.operations);
    const hidden = signed.slice(LIMITS.operations);
    const moreId = "ppOpsMore";

    box.innerHTML = `
      <div class="public-cv-mini-list">
        ${visible
          .map((entry) =>
            buildOperationRow(entry, vessels).replace(" data-pp-more-item", "")
          )
          .join("")}
        ${
          hidden.length
            ? `<div class="public-cv-more-block" id="${moreId}" hidden>
                ${hidden.map((entry) => buildOperationRow(entry, vessels)).join("")}
              </div>`
            : ""
        }
      </div>
      ${hidden.length ? buildShowMoreButton(moreId, hidden.length, "operations") : ""}
    `;

    section.hidden = false;
  }

  function renderHobbiesInterests(entries) {
    const box = document.getElementById("ppHobbiesSnippet");
    const section = document.getElementById("ppHobbiesSection");
    if (!box || !section) return;

    const published = entries
      .filter((entry) => entry.status === "Published")
      .sort((a, b) => {
        const da = a.dateFrom ? new Date(a.dateFrom) : new Date(a.updatedAt || 0);
        const db = b.dateFrom ? new Date(b.dateFrom) : new Date(b.updatedAt || 0);
        return db - da;
      });

    if (!published.length) {
      section.hidden = true;
      return;
    }

    const visible = published.slice(0, LIMITS.hobbies);
    const hidden = published.slice(LIMITS.hobbies);
    const moreId = "ppHobbiesMore";

    box.innerHTML = `
      <div class="public-cv-mini-list">
        ${visible
          .map((entry) => {
            const photos = (entry.photos || [])
              .map((photo) => photo?.url || photo?.dataUrl || "")
              .filter(Boolean)
              .slice(0, 3);
            const categoryLabel = getHobbyInterestCategoryLabel(entry.category);
            const photoHtml = photos.length
              ? `<div class="public-cv-hobby-photos">${photos
                  .map(
                    (url) =>
                      `<img src="${Seav.escapeHtml(url)}" alt="" class="public-cv-hobby-photo" loading="lazy" />`
                  )
                  .join("")}</div>`
              : "";

            return `
              <div class="public-cv-mini-row" data-pp-more-item>
                <div class="public-cv-mini-main">
                  <span class="public-cv-mini-title">${Seav.escapeHtml(entry.title || "—")}</span>
                  <span class="public-cv-mini-meta">${Seav.escapeHtml(categoryLabel)}</span>
                  ${entry.description ? `<p class="public-cv-hobby-desc">${Seav.escapeHtml(entry.description)}</p>` : ""}
                  ${photoHtml}
                </div>
              </div>
            `;
          })
          .join("")}
        ${
          hidden.length
            ? `<div class="public-cv-more-block" id="${moreId}" hidden>
                ${hidden
                  .map((entry) => {
                    const categoryLabel = getHobbyInterestCategoryLabel(entry.category);
                    return `
                      <div class="public-cv-mini-row" data-pp-more-item>
                        <div class="public-cv-mini-main">
                          <span class="public-cv-mini-title">${Seav.escapeHtml(entry.title || "—")}</span>
                          <span class="public-cv-mini-meta">${Seav.escapeHtml(categoryLabel)}</span>
                        </div>
                      </div>
                    `;
                  })
                  .join("")}
              </div>`
            : ""
        }
      </div>
      ${hidden.length ? buildShowMoreButton(moreId, hidden.length, "interests") : ""}
    `;

    section.hidden = false;
  }

  function getCertStatusPillClass(status) {
    const map = {
      "pp-pill-valid": "pill-valid",
      "pp-pill-warning": "pill-warning",
      "pp-pill-expired": "pill-expired",
      "pp-pill-missing": "pill-missing",
      "pp-pill-neutral": "pill-neutral",
      "pp-pill-pending": "pill-pending"
    };
    return map[status?.className] || "pill-neutral";
  }

  function buildPublicCertRow(cert, template) {
    const record = cert || null;
    const source = record || template;
    const status = getCertPublicStatus(record);
    const pillClass = getCertStatusPillClass(status);
    const displayTitle = record?.name || template?.name || source?.code || "Certificate";
    const code = record?.code || template?.code || "—";
    const expiryLabel = record?.expiry
      ? formatDatePretty(record.expiry)
      : record?.name
        ? "No expiry recorded"
        : "Not recorded";
    const statusLabel = status.badge || status.label || "Missing";
    const fileUrl = record?.attachment?.url || record?.attachment?.dataUrl || "";
    const hasFile = !!fileUrl;
    const expiryLine = record?.expiry ? `Expires ${expiryLabel}` : expiryLabel;
    const certKey = resolvePublicCertKey(record, template);
    const isExpanded = isPublicCertExpanded?.(certKey) === true;
    const typeLabel = getPublicCertTypeLabel(record, template);

    return `
      <article class="cert-compact-card public-cv-cert-row${isExpanded ? " is-expanded" : ""}" data-pp-more-item>
        <button
          type="button"
          class="cert-compact-summary public-cv-cert-summary"
          aria-expanded="${isExpanded ? "true" : "false"}"
          data-pp-toggle-cert-id="${Seav.escapeHtml(certKey)}"
        >
          <div class="cert-compact-summary-left">
            <div class="cert-compact-title">${Seav.escapeHtml(displayTitle)}</div>
            <div class="cert-compact-sub">
              ${Seav.escapeHtml(code)} • ${Seav.escapeHtml(expiryLine)}${
                hasFile ? " • Document on file" : ""
              }
            </div>
          </div>
          <div class="cert-compact-summary-right">
            <span class="cert-status-pill ${pillClass}">${Seav.escapeHtml(statusLabel)}</span>
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
                ${Seav.escapeHtml(record?.name || template?.name || "Not recorded")}<br>
                Code: ${Seav.escapeHtml(code)}
              </div>
            </div>
            <div class="cert-compact-detail-panel">
              <div class="cert-compact-detail-label">Expiry &amp; status</div>
              <div class="cert-compact-detail-value">
                ${Seav.escapeHtml(expiryLabel)}<br>
                ${Seav.escapeHtml(status.label || statusLabel)}
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
                        View certificate
                      </a>`
                    : record?.name
                      ? "No attachment uploaded"
                      : "Not recorded on profile"
                }
              </div>
            </div>
          </div>
          ${renderMandatoryCertDetailHtml(code)}
        </div>
      </article>
    `;
  }

  function renderCertBlock(label, visibleHtml, hiddenHtml, moreId, moreLabel) {
    if (!visibleHtml.length && !hiddenHtml.length) return "";

    return `
      <div class="public-cv-cert-block">
        <div class="public-cv-cert-group-label">${Seav.escapeHtml(label)}</div>
        <div class="cert-compact-list">
          ${visibleHtml.join("")}
          ${
            hiddenHtml.length
              ? `<div class="cert-compact-list public-cv-more-block" id="${moreId}" hidden>
                  ${hiddenHtml.join("")}
                </div>
                ${buildShowMoreButton(moreId, hiddenHtml.length, moreLabel)}`
              : ""
          }
        </div>
      </div>
    `;
  }

  function renderCertificates(certs) {
    const box = document.getElementById("ppCertSnippet");
    const section = document.getElementById("ppCertSection");
    if (!box) return;

    const mandatoryBlocks = (MANDATORY_CERTS || []).map((template) =>
      renderCertBlock(
        template.name,
        [
          buildPublicCertRow(findSavedCertByCode(certs, template.code), template).replace(
            " data-pp-more-item",
            ""
          )
        ],
        [],
        "",
        "certificates"
      )
    );

    const rankHtml = (certs || [])
      .filter((cert) => isSavedCert(cert) && isRecommendedCert(cert))
      .map((cert) => buildPublicCertRow(cert, null).replace(" data-pp-more-item", ""));

    const additional = (certs || []).filter(
      (cert) =>
        isSavedCert(cert) &&
        (cert.name || cert.code) &&
        !isMandatoryCert(cert) &&
        !isRecommendedCert(cert) &&
        !isSuppressedAdditionalCert(cert)
    );

    const visibleAdditional = additional
      .slice(0, LIMITS.additionalCerts)
      .map((cert) => buildPublicCertRow(cert, null).replace(" data-pp-more-item", ""));
    const hiddenAdditional = additional
      .slice(LIMITS.additionalCerts)
      .map((cert) => buildPublicCertRow(cert, null));

    const blocks = [
      ...mandatoryBlocks,
      rankHtml.length
        ? renderCertBlock("Rank & role", rankHtml, [], "", "certificates")
        : "",
      visibleAdditional.length || hiddenAdditional.length
        ? renderCertBlock(
            "Additional",
            visibleAdditional,
            hiddenAdditional,
            "ppCertMoreAdditional",
            "certificates"
          )
        : ""
    ].filter(Boolean);

    box.innerHTML = blocks.length
      ? blocks.join("")
      : `<div class="muted">No certificates recorded yet.</div>`;

    const summaryEl = document.getElementById("ppCertSummary");
    if (summaryEl) {
      const summary = getCertComplianceSummary(certs);
      if (summary.total) {
        summaryEl.textContent = `${summary.valid}/${summary.total} mandatory valid`;
        summaryEl.hidden = false;
      } else {
        summaryEl.hidden = true;
      }
    }

    if (section) section.hidden = false;
    bindExpandToggles(box);
  }

  function renderSpecialistQualifications(entries) {
    const box = document.getElementById("ppSpecialistSnippet");
    const section = document.getElementById("ppSpecialistSection");
    if (!box || !section) return;

    const sorted = entries
      .filter((entry) => entry.title)
      .sort((a, b) => {
        if (a.status === "Verified" && b.status !== "Verified") return -1;
        if (b.status === "Verified" && a.status !== "Verified") return 1;
        return 0;
      });

    if (!sorted.length) {
      section.hidden = true;
      return;
    }

    const visible = sorted.slice(0, LIMITS.specialist);
    const hidden = sorted.slice(LIMITS.specialist);
    const moreId = "ppSpecialistMore";

    const buildCard = (entry) => {
      const verified = entry.status === "Verified";
      const meta = [
        getSpecialistCategoryLabel(entry.category),
        entry.issuingBody,
        entry.dateObtained ? formatExpiryShort(entry.dateObtained) : null
      ]
        .filter(Boolean)
        .join(" • ");

      return `
        <div class="public-cv-mini-row public-cv-mini-row--stacked" data-pp-more-item>
          <div class="public-cv-mini-main">
            <span class="public-cv-mini-title">${Seav.escapeHtml(entry.title)}</span>
            ${meta ? `<span class="public-cv-mini-meta">${Seav.escapeHtml(meta)}</span>` : ""}
          </div>
          <span class="public-cv-mini-meta">
            <span class="public-cv-status-dot${verified ? " is-valid" : ""}" aria-hidden="true"></span>
            ${Seav.escapeHtml(entry.status || "Self-declared")}
          </span>
        </div>
      `;
    };

    box.innerHTML = `
      <div class="public-cv-mini-list">
        ${visible.map((entry) => buildCard(entry).replace(" data-pp-more-item", "")).join("")}
        ${
          hidden.length
            ? `<div class="public-cv-more-block" id="${moreId}" hidden>
                ${hidden.map(buildCard).join("")}
              </div>`
            : ""
        }
      </div>
      ${hidden.length ? buildShowMoreButton(moreId, hidden.length, "skills") : ""}
    `;

    section.hidden = false;
  }

  function renderReferences(refs) {
    const box = document.getElementById("ppRefSnippet");
    const section = document.getElementById("ppRefSection");
    if (!box || !section) return;

    const verifiedRefs = refs.filter(isReferenceVerified);

    if (!verifiedRefs.length) {
      section.hidden = true;
      return;
    }

    const sorted = [...verifiedRefs].sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(0);
      const db = b.date ? new Date(b.date) : new Date(0);
      return db - da;
    });

    const visible = sorted.slice(0, LIMITS.references);
    const hidden = sorted.slice(LIMITS.references);
    const moreId = "ppRefMore";

    const buildRef = (ref) => {
      const status = getReferenceStatus(ref);
      const verification = ref.verification || {};
      const verifierMeta = [
        verification.rank,
        verification.cocNumber ? `CoC ${verification.cocNumber}` : "",
        verification.signedAt ? formatExpiryShort(verification.signedAt) : ""
      ]
        .filter(Boolean)
        .join(" • ");

      return `
        <div class="public-cv-ref-block" data-pp-more-item>
          <div class="public-cv-ref-top">
            <div>
              <p class="public-cv-ref-name">${Seav.escapeHtml(ref.name || "Referee")}</p>
              <span class="public-cv-verify-badge is-trusted">Verified reference</span>
            </div>
            <span class="public-cv-status-dot is-valid" title="${Seav.escapeHtml(status)}" aria-label="${Seav.escapeHtml(status)}"></span>
          </div>
          <div class="public-cv-ref-meta">
            ${Seav.escapeHtml(ref.title || "—")}
            ${
              ref.vessel || ref.role || ref.period
                ? ` • ${Seav.escapeHtml([ref.vessel, ref.role, ref.period].filter(Boolean).join(" • "))}`
                : ""
            }
          </div>
          <div class="public-cv-ref-quote">“${Seav.escapeHtml(truncate(ref.text, 220))}”</div>
          ${
            verification.signatureName || verifierMeta
              ? `<p class="public-cv-signoff-line">Confirmed by ${Seav.escapeHtml(
                  [verification.signatureName, verifierMeta].filter(Boolean).join(" • ")
                )}</p>`
              : ""
          }
        </div>
      `;
    };

    box.innerHTML = `
      ${visible.map((ref) => buildRef(ref).replace(" data-pp-more-item", "")).join("")}
      ${
        hidden.length
          ? `<div class="public-cv-more-block" id="${moreId}" hidden>
              ${hidden.map(buildRef).join("")}
            </div>
            ${buildShowMoreButton(moreId, hidden.length, "references")}`
          : ""
      }
    `;

    section.hidden = false;
  }

  function renderAchievements(achievements) {
    const box = document.getElementById("ppAchievementSnippet");
    const section = document.getElementById("ppAchievementSection");
    if (!box || !section) return;

    const approved = achievements.filter((item) => item.status === "Approved");
    if (!approved.length) {
      section.hidden = true;
      return;
    }

    const visible = approved.slice(0, LIMITS.achievements);
    const hidden = approved.slice(LIMITS.achievements);
    const moreId = "ppAchievementMore";

    const buildHighlight = (item) => {
      const badgeUrl =
        window.SeavBadges?.resolveItemBadgeImage?.(item) ||
        item.badgeImage ||
        "";
      const witness = [item.witnessName, item.witnessPosition].filter(Boolean).join(" • ");
      const title = item.title || "Achievement";

      return `
        <article class="public-cv-highlight-card" data-pp-more-item>
          <div class="public-cv-highlight-badge" aria-hidden="true">
            ${
              badgeUrl
                ? `<img src="${Seav.escapeHtml(badgeUrl)}" alt="" />`
                : `<span class="public-cv-highlight-badge-fallback">${Seav.escapeHtml(title.slice(0, 1))}</span>`
            }
          </div>
          <div class="public-cv-highlight-body">
            <h3 class="public-cv-highlight-title">${Seav.escapeHtml(title)}</h3>
            ${item.description ? `<p class="public-cv-highlight-desc">${Seav.escapeHtml(item.description)}</p>` : ""}
            ${witness ? `<p class="public-cv-highlight-witness">${Seav.escapeHtml(witness)}</p>` : ""}
          </div>
        </article>
      `;
    };

    box.innerHTML = `
      <div class="public-cv-highlight-list">
        ${visible.map((item) => buildHighlight(item).replace(" data-pp-more-item", "")).join("")}
        ${
          hidden.length
            ? `<div class="public-cv-more-block public-cv-highlight-list" id="${moreId}" hidden>
                ${hidden.map(buildHighlight).join("")}
              </div>`
            : ""
        }
      </div>
      ${hidden.length ? buildShowMoreButton(moreId, hidden.length, "highlights") : ""}
    `;

    section.hidden = false;
  }


  window.SeavPublicProfileSections = {
    buildVesselHighlights,
    buildVesselCard,
    renderSeatime,
    renderVessels,
    formatNavigationRouteLabel,
    renderNavigation,
    buildOperationRow,
    renderOperations,
    renderHobbiesInterests,
    getCertStatusPillClass,
    buildPublicCertRow,
    renderCertBlock,
    renderCertificates,
    renderSpecialistQualifications,
    renderReferences,
    renderAchievements
  };
})();
