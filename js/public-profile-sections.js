// /js/public-profile-sections.js — public CV section renderers
(function () {
  "use strict";

  if (!window.Seav || !window.SeavData || !window.SeavCards) {
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
    formatDatePretty,
    getTenderProficiencyDisplay
  } = window.SeavData;

  const U = window.SeavPublicProfileUtils || {};
  const {
    LIMITS,
    getVesselRole, getVesselType, getVesselLength, getVesselExperience,
    formatDates, truncate, setSectionCount, buildShowMoreButton,
    groupSeatimeByVessel, formatNm, getPublicVesselColor, buildPublicNavigationStats,
    getNavigationEndpointMarkers, hasPlottableNavigationData,
    bindExpandToggles, getCertPublicStatus, findCertByCode, findSavedCertByCode, isMandatoryCert,
    isRecommendedCert, normalizeCode, formatExpiryShort, getComplianceClass,
    renderVerificationBadge, isReferenceVerified, getCertComplianceSummary,
    resolvePublicCertKey, getPublicCertTypeLabel, isPublicCertExpanded
  } = U;

  const Seav = window.Seav;
  const escapeHtml = Seav.escapeHtml.bind(Seav);

  const PP_NAV_TILE_URL =
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  const PP_NAV_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
  const HI_PHOTO_BUCKET =
    window.SeavApiCore?.STORAGE_BUCKETS?.HOBBIES_INTEREST_PHOTOS ||
    "hobbies-interest-photos";
  const CERT_FILE_BUCKET =
    window.SeavApiCore?.STORAGE_BUCKETS?.CERTIFICATE_FILES || "certificate-files";

  let ppNavigationChart = null;
  let ppNavigationLayer = null;

  function destroyPublicNavigationChart() {
    if (!ppNavigationChart) return;
    try {
      ppNavigationChart.remove();
    } catch (error) {
      console.warn("[SEA-V] Public nav chart cleanup:", error);
    }
    ppNavigationChart = null;
    ppNavigationLayer = null;
  }

  function waitForLeaflet(maxMs = 10000) {
    return new Promise((resolve) => {
      const started = Date.now();
      const tick = () => {
        if (typeof L !== "undefined") {
          resolve(true);
          return;
        }
        if (Date.now() - started >= maxMs) {
          resolve(false);
          return;
        }
        window.setTimeout(tick, 50);
      };
      tick();
    });
  }

  function whenChartContainerReady(container, callback) {
    const attempt = () => {
      if (!container?.isConnected) return false;
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        callback();
        return true;
      }
      return false;
    };

    if (attempt()) return;

    window.requestAnimationFrame(() => {
      if (attempt()) return;
      window.requestAnimationFrame(() => {
        if (attempt()) return;
        window.setTimeout(callback, 300);
      });
    });
  }

  function settlePublicNavigationChart(bounds) {
    if (!ppNavigationChart) return;

    ppNavigationChart.invalidateSize(true);

    if (bounds.length) {
      ppNavigationChart.fitBounds(L.latLngBounds(bounds), {
        padding: [52, 52],
        maxZoom: 5,
        animate: false
      });
    } else {
      ppNavigationChart.setView([25, 0], 2, { animate: false });
    }
  }

  function paintPublicNavigationChart(stats, vessels, navigationAreas) {
    if (!ppNavigationChart || !ppNavigationLayer) return;

    ppNavigationLayer.clearLayers();
    const bounds = [];
    const routedEntryIds = new Set();

    stats.routes.forEach(({ entry, coords }) => {
      routedEntryIds.add(entry.id);
      const vesselId = entry.vesselId || entry.vessel_id || "";
      const color = getPublicVesselColor(vesselId, vessels);
      const from = entry.fromPort || entry.from_port || "Departure";
      const to = entry.toPort || entry.to_port || entry.port || "Arrival";
      const line = L.polyline(coords, {
        color,
        weight: 4,
        opacity: 0.94,
        lineCap: "round",
        lineJoin: "round"
      });

      line.bindTooltip(`${from} → ${to}`, { sticky: true });
      ppNavigationLayer.addLayer(line);
      coords.forEach((coord) => bounds.push(coord));
    });

    navigationAreas.forEach((entry) => {
      if (routedEntryIds.has(entry.id)) return;

      const vesselId = entry.vesselId || entry.vessel_id || "";
      const color = getPublicVesselColor(vesselId, vessels);
      getNavigationEndpointMarkers(entry).forEach(({ coord, label }) => {
        const marker = L.circleMarker(coord, {
          radius: 6,
          color,
          fillColor: color,
          fillOpacity: 0.88,
          weight: 2
        });
        marker.bindTooltip(label, { sticky: true });
        ppNavigationLayer.addLayer(marker);
        bounds.push(coord);
      });
    });

    whenChartContainerReady(ppNavigationChart.getContainer(), () => {
      settlePublicNavigationChart(bounds);
      window.setTimeout(() => settlePublicNavigationChart(bounds), 250);
    });
  }

  function mountPublicNavigationMap(container, stats, vessels, navigationAreas) {
    if (!container || typeof L === "undefined") return false;

    destroyPublicNavigationChart();
    container.replaceChildren();

    try {
      ppNavigationChart = L.map(container, {
        center: [25, 0],
        zoom: 2,
        minZoom: 1,
        zoomControl: true,
        attributionControl: true,
        dragging: true,
        scrollWheelZoom: false,
        preferCanvas: true
      });

      L.tileLayer(PP_NAV_TILE_URL, {
        attribution: PP_NAV_ATTRIBUTION,
        subdomains: "abcd",
        maxZoom: 18
      }).addTo(ppNavigationChart);

      ppNavigationLayer = L.layerGroup().addTo(ppNavigationChart);
      paintPublicNavigationChart(stats, vessels, navigationAreas);
      return true;
    } catch (error) {
      console.error("[SEA-V] Public nav chart init failed:", error);
      destroyPublicNavigationChart();
      return false;
    }
  }

  function buildNavigationFallbackList(navigationAreas) {
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
      })
      .slice(0, LIMITS.navigationPorts);

    if (!portEntries.length) {
      return `<div class="muted">Passages logged — add port coordinates in SEA-V to show the chart.</div>`;
    }

    return `
      <div class="public-cv-port-list">
        ${portEntries
          .map((item) => {
            const from = item.fromPort
              ? [item.fromPort, item.fromCountry].filter(Boolean).join(", ")
              : "";
            const to = [item.toPort || item.port, item.toCountry || item.country]
              .filter(Boolean)
              .join(", ");
            const label = from && to ? `${from} → ${to}` : to || from || "Passage";
            return `<div class="public-cv-port-row"><span>${Seav.escapeHtml(label)}</span></div>`;
          })
          .join("")}
      </div>
    `;
  }

  function schedulePublicNavigationChartPaint(container, stats, vessels, navigationAreas) {
    whenChartContainerReady(container, () => {
      mountPublicNavigationMap(container, stats, vessels, navigationAreas);
    });
  }

  function buildVesselHighlights(vessel, onboardEntries) {
    return onboardEntries
      .filter((entry) => entry.vesselId === vessel.id && entry.status === "Signed Off")
      .slice(0, 3)
      .map((entry) => entry.title || getOnboardCategoryLabel(entry.category))
      .filter(Boolean);
  }

  // Vessel card markup lives in js/seav-cards.js (shared with the dashboard
  // snippet) — this wrapper just keeps the existing call signature used below.
  function buildVesselCard(v, _onboardEntries, _seatimeGroups) {
    return window.SeavCards.buildVesselCard(v, {
      photoBucket: window.SeavApiCore?.STORAGE_BUCKETS?.VESSEL_PHOTOS || "vessel-photos"
    });
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
      <div class="kpi-row-grid kpi-row-grid-5 public-profile-seatime-kpis">
        <div class="kpi-box"><div class="kpi-num">${Seav.escapeHtml(String(totals.sea))}</div><div class="kpi-label">Actual sea service</div></div>
        <div class="kpi-box"><div class="kpi-num">${Seav.escapeHtml(String(totals.yard))}</div><div class="kpi-label">Yard service</div></div>
        <div class="kpi-box"><div class="kpi-num">${Seav.escapeHtml(String(totals.standby))}</div><div class="kpi-label">Standby service</div></div>
        <div class="kpi-box"><div class="kpi-num">${Seav.escapeHtml(String(totals.watchkeeping))}</div><div class="kpi-label">Watchkeeping</div></div>
        <div class="kpi-box"><div class="kpi-num">${Seav.escapeHtml(String(totals.total))}</div><div class="kpi-label">Total qualifying service</div></div>
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
      <div class="dash-mini-card-grid">
        ${visible
          .map((v) => buildVesselCard(v, onboardEntries, seatimeGroups).replace(" data-pp-more-item", ""))
          .join("")}
      </div>
      ${
        hidden.length
          ? `<div class="public-cv-more-block dash-mini-card-grid" id="${moreId}" hidden>
              ${hidden.map((v) => buildVesselCard(v, onboardEntries, seatimeGroups)).join("")}
            </div>`
          : ""
      }
      ${hidden.length ? buildShowMoreButton(moreId, hidden.length, "vessels") : ""}
    `;

    setSectionCount("ppVesselCount", sorted.length);
    if (section) section.hidden = false;
  }

  // Tender card markup lives in js/seav-cards.js (shared with the dashboard
  // snippet) — this wrapper just keeps the existing call signature used below.
  function buildTenderCard(tender, vessels) {
    return window.SeavCards.buildTenderCard(tender, vessels, {
      photoBucket: window.SeavApiCore?.STORAGE_BUCKETS?.TENDER_PHOTOS || "tender-photos"
    });
  }

  function renderTenders(tenders, vessels) {
    const tenderBox = document.getElementById("ppTenderSnippet");
    const section = document.getElementById("ppTenderSection");
    if (!tenderBox || !section) return;

    if (!tenders.length) {
      section.hidden = true;
      setSectionCount("ppTenderCount", 0);
      return;
    }

    const sorted = [...tenders].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const db = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return db - da;
    });

    const visible = sorted.slice(0, LIMITS.tenders);
    const hidden = sorted.slice(LIMITS.tenders);
    const moreId = "ppTenderMore";

    tenderBox.innerHTML = `
      <div class="dash-mini-card-grid">
        ${visible
          .map((t) => buildTenderCard(t, vessels).replace(" data-pp-more-item", ""))
          .join("")}
      </div>
      ${
        hidden.length
          ? `<div class="public-cv-more-block dash-mini-card-grid" id="${moreId}" hidden>
              ${hidden.map((t) => buildTenderCard(t, vessels)).join("")}
            </div>`
          : ""
      }
      ${hidden.length ? buildShowMoreButton(moreId, hidden.length, "tenders") : ""}
    `;

    setSectionCount("ppTenderCount", sorted.length);
    section.hidden = false;
  }

  async function renderNavigation(navigationAreas, vessels, distanceMap) {
    const box = document.getElementById("ppNavigationSnippet");
    const section = document.getElementById("ppNavigationSection");
    if (!box || !section) return;

    destroyPublicNavigationChart();

    if (!navigationAreas.length) {
      section.hidden = true;
      return;
    }

    const stats = buildPublicNavigationStats(navigationAreas, vessels, distanceMap);
    const canPlotMap = hasPlottableNavigationData(navigationAreas);

    box.innerHTML = `
      <div class="dashboard-navigation-layout">
        <div class="dashboard-navigation-chart-shell">
          <div class="dashboard-navigation-chart" id="ppNavigationChart"></div>
          ${
            !canPlotMap
              ? `<div class="public-profile-navigation-map-note muted">Passage ports logged — map shows once coordinates are available.</div>`
              : ""
          }
        </div>
        <div class="dashboard-navigation-stats">
          <div class="dashboard-navigation-stat">
            <span>Total distance</span>
            <strong>${Seav.escapeHtml(formatNm(stats.totalNm))}</strong>
          </div>
          <div class="dashboard-navigation-stat">
            <span>Passages</span>
            <strong>${Seav.escapeHtml(String(stats.routes.length))}</strong>
          </div>
          <div class="dashboard-navigation-stat">
            <span>Countries</span>
            <strong>${Seav.escapeHtml(String(stats.countries))}</strong>
          </div>
          <div class="dashboard-navigation-stat">
            <span>Vessels</span>
            <strong>${Seav.escapeHtml(String(stats.vessels))}</strong>
          </div>
          <div class="dashboard-navigation-vessel-list">
            ${
              stats.vesselRows.length
                ? stats.vesselRows
                    .map(
                      (row) => `
                  <div class="dashboard-navigation-vessel-row">
                    <i style="background:${Seav.escapeHtml(getPublicVesselColor(row.id, vessels))}"></i>
                    <span>${Seav.escapeHtml(row.name)}</span>
                    <b>${row.passages} / ${row.countries.size} countries</b>
                  </div>
                `
                    )
                    .join("")
                : `<div class="muted">No vessel-linked passages yet.</div>`
            }
          </div>
        </div>
      </div>
      <div class="dashboard-navigation-foot">
        <span>${navigationAreas.length} passage${navigationAreas.length === 1 ? "" : "s"} logged</span>
      </div>
    `;

    section.hidden = false;

    const leafletReady = await waitForLeaflet();
    const container = document.getElementById("ppNavigationChart");
    if (!leafletReady || !container) {
      const chartShell = box.querySelector(".dashboard-navigation-chart-shell");
      if (chartShell) {
        chartShell.innerHTML = `<div class="dashboard-navigation-chart public-profile-navigation-fallback">${buildNavigationFallbackList(navigationAreas)}<p class="muted" style="margin-top:10px;">Map unavailable — passage list shown instead.</p></div>`;
      }
      return;
    }

    schedulePublicNavigationChartPaint(container, stats, vessels, navigationAreas);
  }

  function renderOnboardExperience(onboardEntries, vessels) {
    const box = document.getElementById("ppOperationsSnippet");
    const section = document.getElementById("ppOperationsSection");
    if (!box || !section) return;

    const entries = [...(onboardEntries || [])].sort((a, b) => {
      const da = a.dateFrom ? new Date(a.dateFrom) : new Date(0);
      const db = b.dateFrom ? new Date(b.dateFrom) : new Date(0);
      return db - da;
    });

    if (!entries.length) {
      section.hidden = true;
      setSectionCount("ppOnboardCount", 0);
      return;
    }

    const visible = entries.slice(0, LIMITS.operations);
    const hidden = entries.slice(LIMITS.operations);
    const moreId = "ppOnboardMore";

    // Row markup lives in js/seav-cards.js (shared with the dashboard snippet).
    const buildRow = (entry) => window.SeavCards.buildOnboardRow(entry, vessels, { statusFallback: "—" });

    box.innerHTML = `
      <div class="list">
        ${visible.map((entry) => buildRow(entry).replace(" data-pp-more-item", "")).join("")}
        ${
          hidden.length
            ? `<div class="public-cv-more-block" id="${moreId}" hidden>
                <div class="list">${hidden.map(buildRow).join("")}</div>
              </div>`
            : ""
        }
      </div>
      ${hidden.length ? buildShowMoreButton(moreId, hidden.length, "entries") : ""}
    `;

    setSectionCount("ppOnboardCount", entries.length);
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

    const buildRow = (entry) =>
      window.SeavCards.buildHobbyRow(entry, {
        variant: "public",
        categoryLabel: getHobbyInterestCategoryLabel,
        photoBucket: HI_PHOTO_BUCKET
      });

    box.innerHTML = `
      <div class="public-cv-mini-list">
        ${visible.map((entry) => buildRow(entry).replace(" data-pp-more-item", "")).join("")}
        ${
          hidden.length
            ? `<div class="public-cv-more-block" id="${moreId}" hidden>
                ${hidden.map(buildRow).join("")}
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
    const fileUrl = record?.attachment
      ? Seav.getFileDisplayUrl(record.attachment, CERT_FILE_BUCKET)
      : "";
    const hasFile =
      window.SeavApiCore?.hasStoredFile?.(record?.attachment) ?? !!fileUrl;
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

    const buildCard = (entry, moreAttr) =>
      window.SeavCards.buildSpecialistRow(entry, {
        variant: "public",
        categoryLabel: getSpecialistCategoryLabel,
        formatExpiry: formatExpiryShort,
        moreAttr
      });

    box.innerHTML = `
      <div class="public-cv-mini-list">
        ${visible.map((entry) => buildCard(entry, false)).join("")}
        ${
          hidden.length
            ? `<div class="public-cv-more-block" id="${moreId}" hidden>
                ${hidden.map((entry) => buildCard(entry, true)).join("")}
              </div>`
            : ""
        }
      </div>
      ${hidden.length ? buildShowMoreButton(moreId, hidden.length, "skills") : ""}
    `;

    section.hidden = false;
  }

  function renderReferences(refs, vessels = []) {
    const box = document.getElementById("ppRefSnippet");
    const section = document.getElementById("ppRefSection");
    if (!box || !section) return;

    const vesselMap = new Map((vessels || []).map((v) => [v.id, v.name || ""]));
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
      const vesselName = ref.vessel || vesselMap.get(ref.vesselId) || "";
      const maskedCoc = verification.cocNumber
        ? (() => {
            const raw = String(verification.cocNumber).trim();
            if (raw.length <= 4) return raw;
            return `${"*".repeat(Math.max(0, raw.length - 4))}${raw.slice(-4)}`;
          })()
        : "";
      const verifierMeta = [
        verification.rank,
        maskedCoc ? `CoC ${maskedCoc}` : "",
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
              vesselName || ref.role || ref.period
                ? ` • ${Seav.escapeHtml([vesselName, ref.role, ref.period].filter(Boolean).join(" • "))}`
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

    const approved = achievements.filter(
      (item) => item.status === "Approved" || (item.status !== "Declined" && item.autoAwarded)
    );
    if (!approved.length) {
      section.hidden = true;
      return;
    }

    const visible = approved.slice(0, LIMITS.achievements);
    const hidden = approved.slice(LIMITS.achievements);
    const moreId = "ppAchievementMore";

    const buildHighlightCard = (item, isMoreItem = false) => {
      const vessel = item.vessel ? item.vessel : "";
      const title = item.title || "Milestone";
      const meta =
        vessel ||
        (item.description ? truncate(item.description, 70) : "Career-wide milestone");
      const imagePath = window.SeavBadges?.resolveItemBadgeImage?.(item) || "";
      const initial = Seav.escapeHtml((title || "M").trim().charAt(0).toUpperCase() || "M");
      const badgeInner = imagePath
        ? `<img src="${Seav.escapeHtml(imagePath)}" alt="" loading="lazy" />`
        : `<span class="public-cv-highlight-badge-fallback">${initial}</span>`;

      return `
        <article class="public-cv-highlight-card"${isMoreItem ? " data-pp-more-item" : ""}>
          <span class="public-cv-highlight-badge">${badgeInner}</span>
          <div class="public-cv-highlight-body">
            <p class="public-cv-highlight-title">${Seav.escapeHtml(title)}</p>
            <p class="public-cv-highlight-desc">${Seav.escapeHtml(meta)}</p>
          </div>
        </article>
      `;
    };

    box.innerHTML = `
      <div class="dashboard-card-headline">
        <h3><span class="public-profile-section-icon" data-pp-icon="achievements" aria-hidden="true"></span>Milestones</h3>
        <span class="public-profile-section-count" id="ppAchievementCount" hidden></span>
      </div>
      <p class="public-profile-section-note">Career highlights logged in SEA-V.</p>
      <div class="public-cv-highlight-list">
        ${visible.map((item) => buildHighlightCard(item)).join("")}
      </div>
      ${
        hidden.length
          ? `<div class="public-cv-more-block public-cv-highlight-list" id="${moreId}" hidden>
              ${hidden.map((item) => buildHighlightCard(item, true)).join("")}
            </div>`
          : ""
      }
      ${hidden.length ? buildShowMoreButton(moreId, hidden.length, "highlights") : ""}
    `;

    setSectionCount("ppAchievementCount", approved.length);
    section.hidden = false;
  }


  window.SeavPublicProfileSections = {
    buildVesselHighlights,
    buildVesselCard,
    renderSeatime,
    renderVessels,
    renderTenders,
    renderNavigation,
    renderOnboardExperience,
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
