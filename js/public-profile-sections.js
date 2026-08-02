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
    isSuppressedAdditionalCert,
    isSavedCert,
    getSeatimeTotals,
    ONBOARD_SKILL_CATEGORIES,
    getOnboardSkillCategoryLabel,
    getOnboardSkillRatingLabel
  } = window.SeavData;

  const U = window.SeavPublicProfileUtils || {};
  const {
    LIMITS,
    truncate, setSectionCount, buildShowMoreButton,
    groupSeatimeByVessel, groupTendersByVessel, groupAchievementsByVessel, formatNm, getPublicVesselColor, buildPublicNavigationStats,
    getNavigationEndpointMarkers, hasPlottableNavigationData,
    formatExpiryShort,
    renderVerificationBadge, isReferenceVerified
  } = U;

  const Seav = window.Seav;

  const PP_NAV_TILE_URL =
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  const PP_NAV_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
  const HI_PHOTO_BUCKET =
    window.SeavApiCore?.STORAGE_BUCKETS?.HOBBIES_INTEREST_PHOTOS ||
    "hobbies-interest-photos";
  // No CERT_FILE_BUCKET here — the public certificate row never links to the
  // attachment file (see js/api.js's certificates PUBLIC_ARRAY_COLUMNS note).

  // Same star glyph as the editable rating widget in js/onboard-experience.js
  // (renderStarButtons) — kept as plain <span> markup here (no <button>, no
  // click handlers) since a stranger viewing a public profile must never be
  // able to interact with someone else's self-assessment.
  const PP_SKILL_STAR_PATH =
    "M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 17.77l-5.9 3.1 1.13-6.57L2.45 9.44l6.6-.96L12 2.5z";

  let ppNavigationChart = null;
  let ppNavigationLayer = null;
  let ppCountryHighlightLayer = null;

  // Whether the "Skills self-assessment" collapsible sub-block is open.
  // Just one boolean (not a per-category Set like the onboard-experience
  // vessel groups) since there's a single toggle for the whole sub-section.
  let ppOnboardSkillsExpanded = false;

  // Tracks which vessel groups are open in the onboard experience section
  // (keyed by vesselId, "" for "no vessel linked"). Kept in a Set rather
  // than read back from the DOM so expand state survives a full section
  // re-render — see the click handler and renderOnboardExperience below.
  const expandedOnboardVesselIds = new Set();

  function destroyPublicNavigationChart() {
    if (!ppNavigationChart) return;
    try {
      ppNavigationChart.remove();
    } catch (error) {
      console.warn("[SEA-V] Public nav chart cleanup:", error);
    }
    ppNavigationChart = null;
    ppNavigationLayer = null;
    ppCountryHighlightLayer = null;
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

    const H = window.SeavNavigationHelpers;
    if (H?.renderCountryHighlightLayer) {
      // navigationAreas here comes from the public loadPublicData() fetch —
      // camelCase-mapped but not run through H.normalizeNavEntry, so it never
      // gets the name-only port->country backfill that fixed the Iceland/
      // Greenland/Norway/UAE "blank country field" bug on the Navigation
      // page. Without normalizing here too, those same countries would drop
      // out of this overlay again even though the underlying data is fine.
      const normalizedAreas = H.normalizeNavEntry
        ? navigationAreas.map(H.normalizeNavEntry)
        : navigationAreas;
      H.renderCountryHighlightLayer(ppNavigationChart, normalizedAreas, ppCountryHighlightLayer).then(
        (layer) => {
          ppCountryHighlightLayer = layer;
        }
      );
    }

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
        weight: 2,
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

  // Empty-state block shown for a section with no data instead of hiding it
  // outright — every public-profile section is always rendered now (per
  // Jack's 2026-07-31 request) so the page itself teaches a visiting crew
  // member what to log to build out their profile. The CTA button only
  // renders for `isOwner` (the profile owner previewing their own page) —
  // a stranger viewing someone else's public profile has no use for a link
  // that would just dead-end at a login gate for them, and doesn't need
  // "add yours" copy directed at them.
  function buildEmptyState({ heading, body, ctaLabel, ctaHref, isOwner }) {
    return `
      <div class="public-cv-empty-state">
        <strong>${Seav.escapeHtml(heading)}</strong>
        <span>${Seav.escapeHtml(body)}</span>
        ${
          isOwner && ctaLabel && ctaHref
            ? `<a class="btn-blue public-cv-empty-cta" href="${Seav.escapeHtml(ctaHref)}">${Seav.escapeHtml(ctaLabel)}</a>`
            : ""
        }
      </div>
    `;
  }

  function buildVesselHighlights(vessel, onboardEntries) {
    return onboardEntries
      .filter((entry) => entry.vesselId === vessel.id && entry.status === "Signed Off")
      .slice(0, 3)
      .map((entry) => entry.title || getOnboardCategoryLabel(entry.category))
      .filter(Boolean);
  }

  // Vessel card markup lives in js/seav-cards.js. Every vessel on the public
  // profile gets the same rich "overview" treatment the dashboard reserves
  // for just the current vessel (buildVesselCardFull) rather than the
  // smaller dash-mini-card — vessel history is one of the more attractive
  // parts of a public profile, so it shouldn't look thinner for past boats.
  // References are filtered to verified-only here (buildVesselCardFull has
  // no concept of verification status) so the same privacy rule applied to
  // the References section itself also applies inside vessel cards.
  function buildVesselCard(v, seatimes, tenders, refs) {
    return window.SeavCards.buildVesselCardFull(v, {
      photoBucket: window.SeavApiCore?.STORAGE_BUCKETS?.VESSEL_PHOTOS || "vessel-photos",
      seatimes: seatimes || [],
      tenders: tenders || [],
      refs: (refs || []).filter(isReferenceVerified)
    });
  }

  function renderSeatime(seatimes, vessels, isOwner) {
    const box = document.getElementById("ppSeatimeSnippet");
    const section = document.getElementById("ppSeatimeSection");
    if (!box || !section) return;

    if (!seatimes.length) {
      box.innerHTML = buildEmptyState({
        heading: "No sea time logged yet",
        body:
          "Add your sea service records to show verifiable days at sea — essential for CoC progression and for employers to trust your experience.",
        ctaLabel: "Log sea time",
        ctaHref: "/seatime.html",
        isOwner
      });
      section.hidden = false;
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

  function renderVessels(vessels, seatimes, tenders, refs, isOwner) {
    const vesselBox = document.getElementById("ppVesselSnippet");
    const section = document.getElementById("ppVesselSection");
    if (!vesselBox) return;

    if (!vessels.length) {
      vesselBox.innerHTML = buildEmptyState({
        heading: "No vessel experience yet",
        body:
          "This is the anchor of your profile — add your vessels to show your career history, roles, and time onboard each ship.",
        ctaLabel: "Add a vessel",
        ctaHref: "/vessels.html",
        isOwner
      });
      setSectionCount("ppVesselCount", 0);
      if (section) section.hidden = false;
      return;
    }

    const sorted = [...vessels].sort((a, b) => {
      const da = a.from ? new Date(a.from) : new Date(0);
      const db = b.from ? new Date(b.from) : new Date(0);
      return db - da;
    });

    const visible = sorted.slice(0, LIMITS.vessels);
    const hidden = sorted.slice(LIMITS.vessels);
    const moreId = "ppVesselMore";

    // Full-width stack, not the small dash-mini-card-grid — every vessel now
    // gets the same wide "overview" card the dashboard reserves for just the
    // current vessel, so a 3-across grid would cramp it badly.
    vesselBox.innerHTML = `
      <div class="pp-vessel-full-list">
        ${visible
          .map((v) => buildVesselCard(v, seatimes, tenders, refs).replace(" data-pp-more-item", ""))
          .join("")}
      </div>
      ${
        hidden.length
          ? `<div class="public-cv-more-block pp-vessel-full-list" id="${moreId}" hidden>
              ${hidden.map((v) => buildVesselCard(v, seatimes, tenders, refs)).join("")}
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

  // Same collapsible per-vessel grouping as the Tenders page itself
  // (js/tenders.js buildTenderVesselGroups + .tender-vessel-group markup) —
  // reuses those exact CSS classes so it looks identical, just built from
  // groupTendersByVessel (js/public-profile-utils.js) since this page has no
  // getVessels()/getTenders() of its own to call the Tenders page's version.
  function buildTenderVesselGroupHtml(group, vessels, { open = false } = {}) {
    const tenderWord = group.tenders.length === 1 ? "tender" : "tenders";

    return `
      <details class="tender-vessel-group" data-pp-more-item${open ? " open" : ""}>
        <summary class="tender-vessel-group-summary">
          ${group.vesselColor ? `<span class="vessel-color-dot" style="background:${Seav.escapeHtml(group.vesselColor)}"></span>` : ""}
          <span class="tender-vessel-group-title">
            <strong>${Seav.escapeHtml(group.vesselName)}</strong>
            <small>${group.tenders.length} ${tenderWord}</small>
          </span>
          <span class="tender-vessel-group-count">${group.tenders.length}</span>
        </summary>
        <div class="tender-vessel-group-body">
          ${group.tenders.map((t) => buildTenderCard(t, vessels).replace(" data-pp-more-item", "")).join("")}
        </div>
      </details>
    `;
  }

  function renderTenders(tenders, vessels, isOwner) {
    const tenderBox = document.getElementById("ppTenderSnippet");
    const section = document.getElementById("ppTenderSection");
    if (!tenderBox || !section) return;

    if (!tenders.length) {
      tenderBox.innerHTML = buildEmptyState({
        heading: "No tenders logged yet",
        body:
          "Add tenders under a vessel to show your small-craft handling — a real differentiator for deck and interior crew.",
        ctaLabel: "Log a tender",
        ctaHref: "/tenders.html",
        isOwner
      });
      setSectionCount("ppTenderCount", 0);
      section.hidden = false;
      return;
    }

    const groups = groupTendersByVessel(tenders, vessels);

    // Paginate by vessel group (same unit as the Sea Time section's own
    // groupSeatimeByVessel-based show-more just above), not by raw tender —
    // splitting a single vessel's tenders across "visible" and "hidden"
    // would be a confusing show-more experience.
    const visible = groups.slice(0, LIMITS.tenders);
    const hidden = groups.slice(LIMITS.tenders);
    const moreId = "ppTenderMore";

    tenderBox.innerHTML = `
      <div class="tender-vessel-group-list">
        ${visible
          .map((g) => buildTenderVesselGroupHtml(g, vessels).replace(" data-pp-more-item", ""))
          .join("")}
      </div>
      ${
        hidden.length
          ? `<div class="public-cv-more-block tender-vessel-group-list" id="${moreId}" hidden>
              ${hidden.map((g) => buildTenderVesselGroupHtml(g, vessels)).join("")}
            </div>`
          : ""
      }
      ${hidden.length ? buildShowMoreButton(moreId, hidden.length, "vessels") : ""}
    `;

    setSectionCount("ppTenderCount", tenders.length);
    section.hidden = false;
  }

  async function renderNavigation(navigationAreas, vessels, distanceMap, isOwner) {
    const box = document.getElementById("ppNavigationSnippet");
    const section = document.getElementById("ppNavigationSection");
    if (!box || !section) return;

    destroyPublicNavigationChart();

    if (!navigationAreas.length) {
      box.innerHTML = buildEmptyState({
        heading: "No passages logged yet",
        body:
          "Add navigation entries to build a visual map of the routes, miles, and countries you've sailed.",
        ctaLabel: "Log a passage",
        ctaHref: "/navigation.html",
        isOwner
      });
      section.hidden = false;
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

  // Same grouping shape as the edit page's js/onboard-experience.js — one
  // collapsible row per vessel, most-recently-dated vessel first, entries
  // within a group sorted most-recent-first. A flat list of every entry got
  // hard to scan once there were several vessels' worth logged, same
  // complaint that drove the edit page's grouping.
  function groupOnboardEntriesByVessel(entries, vessels) {
    const groups = new Map();

    entries.forEach((entry) => {
      const vesselId = entry.vesselId || "";
      if (!groups.has(vesselId)) groups.set(vesselId, []);
      groups.get(vesselId).push(entry);
    });

    return [...groups.entries()]
      .map(([vesselId, groupEntries]) => {
        const vessel = (vessels || []).find((v) => v.id === vesselId);
        const sorted = [...groupEntries].sort((a, b) => {
          const da = a.dateFrom ? new Date(a.dateFrom) : new Date(0);
          const db = b.dateFrom ? new Date(b.dateFrom) : new Date(0);
          return db - da;
        });
        const latestTime = sorted[0]?.dateFrom ? new Date(sorted[0].dateFrom).getTime() : 0;

        return {
          vesselId,
          vesselName: vessel?.name || (vesselId ? "Unknown vessel" : "No vessel linked"),
          vesselColor: vesselId ? getPublicVesselColor(vesselId, vessels) : "",
          entries: sorted,
          latestTime
        };
      })
      .sort((a, b) => b.latestTime - a.latestTime);
  }

  // Note on toggle wiring: this does NOT use the page's generic
  // data-pp-expand / bindExpandToggles convention. That handler
  // unconditionally overwrites btn.textContent on every click (fine for
  // plain-text "Show more" buttons), which would destroy this button's two
  // child <span>s (vessel name + entry count) after the very first click.
  // Instead this uses a dedicated classList/aria-expanded/hidden toggle —
  // the same non-destructive pattern the edit page's onboard-experience.js
  // uses for its own vessel groups — wired up below via a delegated click
  // handler bound once when this script loads.
  function buildOnboardVesselGroup(group, vessels) {
    const groupKey = group.vesselId || "none";
    const groupId = `ppOnboardVessel-${Seav.escapeHtml(groupKey)}`;
    const isExpanded = expandedOnboardVesselIds.has(group.vesselId);
    const entryLabel = group.entries.length === 1 ? "entry" : "entries";

    // Row markup lives in js/seav-cards.js (shared with the dashboard
    // snippet). expandable: true adds a per-row "Details" toggle
    // (description, dates, hours, location onboard, attachment).
    // hideVesselName: true because the vessel is now the group heading —
    // repeating it on every row inside was redundant.
    const rows = group.entries
      .map((entry) =>
        window.SeavCards.buildOnboardRow(entry, vessels, {
          statusFallback: "—",
          expandable: true,
          hideVesselName: true
        })
      )
      .join("");

    return `
      <div class="public-onboard-vessel-group${isExpanded ? " is-expanded" : ""}">
        <button
          type="button"
          class="public-onboard-vessel-summary"
          data-toggle-onboard-vessel="${Seav.escapeHtml(group.vesselId)}"
          aria-expanded="${isExpanded ? "true" : "false"}"
          aria-controls="${groupId}"
        >
          <span class="public-onboard-vessel-name">
            ${group.vesselColor ? `<span class="vessel-color-dot" style="background:${Seav.escapeHtml(group.vesselColor)}"></span>` : ""}
            ${Seav.escapeHtml(group.vesselName)}
          </span>
          <span class="public-onboard-vessel-count">${group.entries.length} ${entryLabel}</span>
          <span class="public-onboard-vessel-chevron" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
        </button>
        <div class="list public-onboard-vessel-body" id="${groupId}"${isExpanded ? "" : " hidden"}>
          ${rows}
        </div>
      </div>
    `;
  }

  function renderOnboardExperience(onboardEntries, vessels, isOwner) {
    const box = document.getElementById("ppOperationsSnippet");
    const section = document.getElementById("ppOperationsSection");
    if (!box || !section) return;

    const entries = onboardEntries || [];

    if (!entries.length) {
      box.innerHTML = buildEmptyState({
        heading: "No onboard experience logged yet",
        body:
          "Add operations and familiarisations to show hands-on competence beyond your CoC.",
        ctaLabel: "Add onboard experience",
        ctaHref: "/onboard-experience.html",
        isOwner
      });
      setSectionCount("ppOnboardCount", 0);
      section.hidden = false;
      return;
    }

    const groups = groupOnboardEntriesByVessel(entries, vessels);

    box.innerHTML = `
      <div class="public-onboard-vessel-list">
        ${groups.map((group) => buildOnboardVesselGroup(group, vessels)).join("")}
      </div>
    `;

    setSectionCount("ppOnboardCount", entries.length);
    section.hidden = false;
  }

  function buildReadOnlyStars(rating) {
    const value = Number(rating) || 0;
    let html = "";
    for (let i = 1; i <= 5; i += 1) {
      const filled = i <= value;
      html += `<span class="public-onboard-skill-star${filled ? " is-filled" : ""}" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${PP_SKILL_STAR_PATH}"/></svg></span>`;
    }
    return html;
  }

  function buildSkillRow(entry) {
    const noteHtml = entry.note
      ? `<p class="public-onboard-skill-note">${Seav.escapeHtml(entry.note)}</p>`
      : "";

    return `
      <div class="public-onboard-skill-row">
        <div class="public-onboard-skill-row-top">
          <span class="public-onboard-skill-name">${Seav.escapeHtml(entry.skill)}</span>
          <div class="public-onboard-skill-row-right">
            <div class="public-onboard-skill-stars" role="img" aria-label="${Seav.escapeHtml(
              getOnboardSkillRatingLabel(entry.rating) || `${Number(entry.rating) || 0} out of 5`
            )}">
              ${buildReadOnlyStars(entry.rating)}
            </div>
            <span class="public-onboard-skill-row-label">${Seav.escapeHtml(
              getOnboardSkillRatingLabel(entry.rating)
            )}</span>
          </div>
        </div>
        ${noteHtml}
      </div>
    `;
  }

  function buildSkillCategoryGroup(category, items) {
    return `
      <div class="public-onboard-skill-group">
        <h4 class="public-onboard-skill-group-title">${Seav.escapeHtml(
          getOnboardSkillCategoryLabel(category)
        )}</h4>
        ${items.map(buildSkillRow).join("")}
      </div>
    `;
  }

  // Collapsible "Skills self-assessment" sub-section nested inside the
  // Onboard experience card — see #ppOnboardSkillsWrap in public-profile.html.
  // Hidden entirely (not an empty-state CTA) when the profile owner hasn't
  // rated any skills, since this is a bonus add-on to the main logbook above.
  function renderOnboardSkills(skillEntries) {
    const wrap = document.getElementById("ppOnboardSkillsWrap");
    const body = document.getElementById("ppOnboardSkillsBody");
    const toggle = document.getElementById("ppOnboardSkillsToggle");
    if (!wrap || !body || !toggle) return;

    const entries = skillEntries || [];

    if (!entries.length) {
      wrap.hidden = true;
      body.innerHTML = "";
      return;
    }

    const groups = ONBOARD_SKILL_CATEGORIES.map((cat) => ({
      category: cat.value,
      items: entries.filter((entry) => entry.category === cat.value)
    })).filter((group) => group.items.length);

    body.innerHTML = groups
      .map((group) => buildSkillCategoryGroup(group.category, group.items))
      .join("");

    setSectionCount("ppOnboardSkillsCount", entries.length);

    toggle.setAttribute("aria-expanded", ppOnboardSkillsExpanded ? "true" : "false");
    wrap.classList.toggle("is-expanded", ppOnboardSkillsExpanded);
    body.hidden = !ppOnboardSkillsExpanded;
    wrap.hidden = false;
  }

  // Single delegated toggle for the whole Skills sub-block (simpler than the
  // per-vessel-group Set used for onboard experience above — there's only
  // ever one collapsible region here).
  document.addEventListener("click", (e) => {
    const toggleBtn = e.target.closest("#ppOnboardSkillsToggle");
    if (!toggleBtn) return;
    e.preventDefault();

    const wrap = document.getElementById("ppOnboardSkillsWrap");
    const body = document.getElementById("ppOnboardSkillsBody");
    if (!wrap || !body) return;

    ppOnboardSkillsExpanded = !ppOnboardSkillsExpanded;
    toggleBtn.setAttribute("aria-expanded", ppOnboardSkillsExpanded ? "true" : "false");
    wrap.classList.toggle("is-expanded", ppOnboardSkillsExpanded);
    body.hidden = !ppOnboardSkillsExpanded;
  });

  // Delegated, bound once at script load — mirrors the edit page's own
  // [data-toggle-vessel-id] handler in js/onboard-experience.js. Reading
  // expand state back out of expandedOnboardVesselIds (rather than the DOM)
  // in buildOnboardVesselGroup means this survives the full-section
  // re-render that happens on every "seav:data-updated" event.
  document.addEventListener("click", (e) => {
    const toggleBtn = e.target.closest("[data-toggle-onboard-vessel]");
    if (!toggleBtn) return;
    e.preventDefault();

    const vesselKey = toggleBtn.getAttribute("data-toggle-onboard-vessel") || "";
    const group = toggleBtn.closest(".public-onboard-vessel-group");
    const body = group?.querySelector(".public-onboard-vessel-body");
    if (!group || !body) return;

    if (expandedOnboardVesselIds.has(vesselKey)) {
      expandedOnboardVesselIds.delete(vesselKey);
      group.classList.remove("is-expanded");
      toggleBtn.setAttribute("aria-expanded", "false");
      body.setAttribute("hidden", "");
    } else {
      expandedOnboardVesselIds.add(vesselKey);
      group.classList.add("is-expanded");
      toggleBtn.setAttribute("aria-expanded", "true");
      body.removeAttribute("hidden");
    }
  });

  function renderHobbiesInterests(entries, isOwner) {
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
      box.innerHTML = buildEmptyState({
        heading: "No hobbies or interests yet",
        body:
          "A few personal touches help owners and crew agencies get a sense of who you are, not just what you're qualified for.",
        ctaLabel: "Add hobbies & interests",
        ctaHref: "/hobbies-interests.html",
        isOwner
      });
      section.hidden = false;
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

  /**
   * Certificates section — kept deliberately simple to match every other
   * public-profile section (specialist quals, hobbies): one flat list of
   * small rows via window.SeavCards.buildCertRow, most urgent (expired /
   * expiring soon) first since that's what an employer scans for. This
   * replaces a much heavier expandable-accordion design that was never
   * actually wired into public-profile.html in the first place.
   */
  function renderCertificates(certs, isOwner) {
    const box = document.getElementById("ppCertSnippet");
    const section = document.getElementById("ppCertSection");
    if (!box || !section) return;

    const saved = (certs || []).filter(
      (cert) => isSavedCert(cert) && (cert.name || cert.code) && !isSuppressedAdditionalCert(cert)
    );

    if (!saved.length) {
      box.innerHTML = buildEmptyState({
        heading: "No certificates recorded yet",
        body:
          "Add your CoC and STCW certificates so recruiters can see your compliance status at a glance.",
        ctaLabel: "Add a certificate",
        ctaHref: "/certificates.html",
        isOwner
      });
      section.hidden = false;
      return;
    }

    const sorted = [...saved].sort((a, b) => {
      const infoA = getCertExpiryInfo(a.noExpiry ? "" : a.expiry);
      const infoB = getCertExpiryInfo(b.noExpiry ? "" : b.expiry);
      return infoA.sortValue - infoB.sortValue;
    });

    const visible = sorted.slice(0, LIMITS.certificates);
    const hidden = sorted.slice(LIMITS.certificates);
    const moreId = "ppCertMore";

    box.innerHTML = `
      <div class="public-cv-mini-list">
        ${visible.map((cert) => window.SeavCards.buildCertRow(cert).replace(" data-pp-more-item", "")).join("")}
        ${
          hidden.length
            ? `<div class="public-cv-more-block" id="${moreId}" hidden>
                ${hidden.map((cert) => window.SeavCards.buildCertRow(cert)).join("")}
              </div>`
            : ""
        }
      </div>
      ${hidden.length ? buildShowMoreButton(moreId, hidden.length, "certificates") : ""}
    `;

    setSectionCount("ppCertCount", saved.length);
    section.hidden = false;
  }

  function renderSpecialistQualifications(entries, isOwner) {
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
      box.innerHTML = buildEmptyState({
        heading: "No specialist qualifications yet",
        body:
          "Add courses like PDSD, ENG1, or tickets relevant to your role to stand out for specialist positions.",
        ctaLabel: "Add a qualification",
        ctaHref: "/specialist-qualifications.html",
        isOwner
      });
      section.hidden = false;
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

  function renderReferences(refs, vessels = [], isOwner) {
    const box = document.getElementById("ppRefSnippet");
    const section = document.getElementById("ppRefSection");
    if (!box || !section) return;

    const vesselMap = new Map((vessels || []).map((v) => [v.id, v.name || ""]));
    const verifiedRefs = refs.filter(isReferenceVerified);

    if (!verifiedRefs.length) {
      // "Pending" copy only ever runs for the owner's own preview — refs
      // includes unverified rows for everyone (see js/api.js's
      // PUBLIC_ARRAY_COLUMNS.sea_references, which doesn't filter by status),
      // so surfacing a pending count to a stranger would leak whether an
      // unconfirmed reference exists. Gating this on isOwner keeps that
      // detail visible only to the person it belongs to.
      const pendingCount = isOwner ? refs.length : 0;
      box.innerHTML = buildEmptyState({
        heading: pendingCount > 0 ? "References awaiting verification" : "No verified references yet",
        body:
          pendingCount > 0
            ? `${pendingCount} reference${pendingCount === 1 ? "" : "s"} awaiting verification — ${
                pendingCount === 1 ? "it'll" : "they'll"
              } appear here once confirmed.`
            : "Request a verification link from a previous captain or HOD — a verified reference is the strongest trust signal on your profile.",
        ctaLabel: "Manage references",
        ctaHref: "/references.html",
        isOwner
      });
      section.hidden = false;
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
      // verification.cocNumber arrives here as boolean `true` (never the
      // real number — the DB's verification_public generated column already
      // stripped it before this ever reached the client, see
      // docs/schema-public-profile-age-and-coc-redaction.sql). No partial
      // reveal: just note that a CoC was entered and is hidden.
      const cocNote = verification.cocNumber === true ? "★ CoC on file — hidden for privacy" : "";
      const verifierMeta = [
        verification.rank,
        cocNote,
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

  // Shared badge/title card markup for a single milestone. `hideVesselMeta`
  // is used inside a per-vessel group (see buildAchievementVesselGroupHtml)
  // where repeating the vessel name on every card would just restate the
  // group heading — description (or a generic fallback) is shown instead.
  function buildAchievementHighlightCard(item, isMoreItem = false, hideVesselMeta = false) {
    const vessel = !hideVesselMeta && item.vessel ? item.vessel : "";
    const title = item.title || "Milestone";
    const meta =
      vessel ||
      (item.description ? truncate(item.description, 70) : hideVesselMeta ? "Logged milestone" : "Career-wide milestone");
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
  }

  // Same collapsible per-vessel grouping as Tenders/Sea Time — only used for
  // manually-logged milestones, which always carry a vessel.
  function buildAchievementVesselGroupHtml(group, { open = false } = {}) {
    const word = group.items.length === 1 ? "milestone" : "milestones";

    return `
      <details class="achievement-vessel-group" data-pp-more-item${open ? " open" : ""}>
        <summary class="achievement-vessel-group-summary">
          ${group.vesselColor ? `<span class="vessel-color-dot" style="background:${Seav.escapeHtml(group.vesselColor)}"></span>` : ""}
          <span class="achievement-vessel-group-title">
            <strong>${Seav.escapeHtml(group.vesselName)}</strong>
            <small>${group.items.length} ${word}</small>
          </span>
          <span class="achievement-vessel-group-count">${group.items.length}</span>
        </summary>
        <div class="achievement-vessel-group-body">
          ${group.items.map((item) => buildAchievementHighlightCard(item, false, true)).join("")}
        </div>
      </details>
    `;
  }

  function renderAchievements(achievements, vessels, isOwner) {
    const box = document.getElementById("ppAchievementSnippet");
    const section = document.getElementById("ppAchievementSection");
    if (!box || !section) return;

    const approved = achievements.filter(
      (item) => item.status === "Verified" || (item.status !== "Declined" && item.autoAwarded)
    );
    if (!approved.length) {
      // This section has no static <h3> in the HTML (unlike the others) —
      // the header is normally built inline below along with the content, so
      // the empty state has to include it too rather than relying on markup
      // that isn't there.
      box.innerHTML = `
        <div class="dashboard-card-headline">
          <h3><span class="public-profile-section-icon" data-pp-icon="achievements" aria-hidden="true"></span>Milestones</h3>
        </div>
        ${buildEmptyState({
          heading: "No milestones yet",
          body:
            "Log career highlights, or keep using SEA-V — some milestones are awarded automatically as you build your record.",
          ctaLabel: "View milestones",
          ctaHref: "/achievements.html",
          isOwner
        })}
      `;
      // populateSectionIcons() in public-profile.js runs once after every
      // section has rendered and fills in every [data-pp-icon] element on
      // the page, including this one — no separate call needed here.
      section.hidden = false;
      return;
    }

    // Manually-logged milestones always carry a vessel (achievements.js
    // requires one on every manual entry, even "career-wide" ones), so they
    // group naturally by vessel like Tenders/Sea Time. Auto-awarded
    // milestones are system-detected career totals/badges and read better
    // as their own flat list, not folded into a specific vessel's group.
    const manual = approved.filter((item) => !item.autoAwarded);
    const auto = approved.filter((item) => item.autoAwarded);

    const groups = groupAchievementsByVessel(manual, vessels);
    const visibleGroups = groups.slice(0, LIMITS.achievementVesselGroups);
    const hiddenGroups = groups.slice(LIMITS.achievementVesselGroups);
    const groupMoreId = "ppAchievementGroupMore";

    const visibleAuto = auto.slice(0, LIMITS.achievements);
    const hiddenAuto = auto.slice(LIMITS.achievements);
    const autoMoreId = "ppAchievementAutoMore";

    box.innerHTML = `
      <div class="dashboard-card-headline">
        <h3><span class="public-profile-section-icon" data-pp-icon="achievements" aria-hidden="true"></span>Milestones</h3>
        <span class="public-profile-section-count" id="ppAchievementCount" hidden></span>
      </div>
      <p class="public-profile-section-note">Career highlights logged in SEA-V.</p>

      ${
        groups.length
          ? `
        <div class="achievement-vessel-group-list">
          ${visibleGroups
            .map((g) => buildAchievementVesselGroupHtml(g).replace(" data-pp-more-item", ""))
            .join("")}
        </div>
        ${
          hiddenGroups.length
            ? `<div class="public-cv-more-block achievement-vessel-group-list" id="${groupMoreId}" hidden>
                ${hiddenGroups.map((g) => buildAchievementVesselGroupHtml(g)).join("")}
              </div>
              ${buildShowMoreButton(groupMoreId, hiddenGroups.length, "vessels")}`
            : ""
        }
      `
          : ""
      }

      ${
        auto.length
          ? `
        <details class="achievement-vessel-group achievement-auto-block">
          <summary class="achievement-vessel-group-summary">
            <span class="achievement-vessel-group-title">
              <strong>Automatically tracked</strong>
              <small>System-detected career milestones</small>
            </span>
            <span class="achievement-vessel-group-count">${auto.length}</span>
          </summary>
          <div class="achievement-vessel-group-body">
            <div class="public-cv-highlight-list">
              ${visibleAuto.map((item) => buildAchievementHighlightCard(item)).join("")}
            </div>
            ${
              hiddenAuto.length
                ? `<div class="public-cv-more-block public-cv-highlight-list" id="${autoMoreId}" hidden>
                    ${hiddenAuto.map((item) => buildAchievementHighlightCard(item, true)).join("")}
                  </div>
                  ${buildShowMoreButton(autoMoreId, hiddenAuto.length, "highlights")}`
                : ""
            }
          </div>
        </details>
      `
          : ""
      }
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
    renderOnboardSkills,
    renderHobbiesInterests,
    renderCertificates,
    renderSpecialistQualifications,
    renderReferences,
    renderAchievements
  };
})();
