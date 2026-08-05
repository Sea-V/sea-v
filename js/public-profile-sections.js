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
    formatNm, getPublicVesselColor, buildPublicNavigationStats,
    getNavigationEndpointMarkers, hasPlottableNavigationData,
    formatExpiryShort, renderVerificationBadge,
    isReferenceVerified
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
  let ppOnboardSkillsExpanded = false;

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
  //
  // 2026-08-05, per Jack: this card only ever renders the vessel's own
  // overview now (photo/stats/experience) — its linked records (sea time,
  // tenders, references, onboard experience, Seafarer Awards) render as
  // separate collapsibles directly below it instead, see
  // buildVesselLinkedSections() below. Jack's own words: "the single [sea
  // time] collapsable, onboard experience below the vessel, reference
  // collapsable section below the vessel, the awards collapsable below the
  // vessel, in the rows that they were in before" — a same-day correction to
  // the compact merged-grid version this function used to build.
  function buildVesselCard(v, vessels) {
    return window.SeavCards.buildVesselCardFull(v, {
      photoBucket: window.SeavApiCore?.STORAGE_BUCKETS?.VESSEL_PHOTOS || "vessel-photos",
      vesselColor: getPublicVesselColor(v.id, vessels || [])
    });
  }

  // Generic collapsible shell for one vessel's linked-record section (Sea
  // Time / Tenders / Onboard Experience / References / Awards). Reuses the
  // exact same tender-vessel-group CSS the Tenders page's own per-vessel
  // grouping already established (css/pages/tenders.css) rather than
  // inventing a new component — the visual "row" Jack asked to keep is this
  // one: a colored-dot-free summary line (dot already shown once, on the
  // vessel card above) with a title + count, expanding to the section's own
  // row/card list. Hidden entirely (returns "") when this vessel has none of
  // that record type — no empty "Sea Time (0)" clutter under every vessel.
  // `stackedBody` disables the base .tender-vessel-group-body's 3-column
  // grid (built for the Tenders page's own mini-cards) — Sea Time rows,
  // onboard rows, reference quote blocks, and award cards are already
  // full-width flex-column lists in their own right, so nesting one of
  // those single wrapper elements inside a 3-col grid would just squeeze
  // it into the first column at a third of the width. Tenders keeps the
  // grid (its cards were designed for exactly that 3-across layout).
  function buildVesselSectionGroup(label, bodyHtml, count, stackedBody = false) {
    if (!count) return "";
    return `
      <details class="tender-vessel-group vessel-linked-section-group" data-pp-more-item>
        <summary class="tender-vessel-group-summary">
          <span class="tender-vessel-group-title">
            <strong>${Seav.escapeHtml(label)}</strong>
          </span>
          <span class="tender-vessel-group-count">${count}</span>
        </summary>
        <div class="tender-vessel-group-body${stackedBody ? " vessel-linked-section-body--stack" : ""}">
          ${bodyHtml}
        </div>
      </details>
    `;
  }

  function buildVesselSeatimeSection(vesselSeatimes) {
    if (!vesselSeatimes.length) return "";
    const totalDays = window.SeavData?.totalQualifyingDays || (() => 0);
    const formatDate = window.SeavData.formatDatePretty;

    const rows = vesselSeatimes
      .map(
        (entry) => `
          <div class="public-cv-seatime-row">
            <div class="public-cv-seatime-main">
              <span class="public-cv-seatime-vessel">${Seav.escapeHtml(entry.capacityServed || "Sea time entry")}</span>
              <span class="public-cv-seatime-meta">${Seav.escapeHtml(
                `${entry.dateJoined ? formatDate(entry.dateJoined) : "—"} → ${entry.dateLeft ? formatDate(entry.dateLeft) : "Present"}`
              )}</span>
            </div>
            <div class="public-cv-seatime-stats">
              <span class="public-cv-seatime-days">${Seav.escapeHtml(String(totalDays(entry)))} days</span>
              ${renderVerificationBadge(entry.verificationStatus)}
            </div>
          </div>
        `
      )
      .join("");

    return buildVesselSectionGroup("Sea Time", `<div class="public-cv-mini-list">${rows}</div>`, vesselSeatimes.length, true);
  }

  function buildVesselTenderSection(vesselTenders, vessels) {
    if (!vesselTenders.length) return "";
    const rows = vesselTenders
      .map((t) => window.SeavCards.buildTenderCard(t, vessels).replace(" data-pp-more-item", ""))
      .join("");
    return buildVesselSectionGroup("Tenders", rows, vesselTenders.length);
  }

  function buildVesselOnboardSection(vesselOnboard, vessels) {
    if (!vesselOnboard.length) return "";
    const rows = vesselOnboard
      .map((entry) =>
        window.SeavCards.buildOnboardRow(entry, vessels, {
          statusFallback: "—",
          expandable: true,
          hideVesselName: true
        })
      )
      .join("");
    return buildVesselSectionGroup("Onboard Experience", `<div class="list">${rows}</div>`, vesselOnboard.length, true);
  }

  // Read-only reference "quote card" — same visual language the old
  // top-level References section used (public-cv-ref-block), just without
  // repeating the vessel name in the meta line since it's already the
  // heading one level up now. CoC numbers stay redacted (verification.cocNumber
  // arrives as boolean `true`, never the real number — stripped server-side
  // by the verification_public generated column) per the reinstated privacy
  // rule (see project_seav_public_profile_pii_reversal memory).
  function buildReferenceQuoteBlock(ref) {
    const status = getReferenceStatus(ref);
    const verification = ref.verification || {};
    const cocNote = verification.cocNumber === true ? "★ CoC on file — hidden for privacy" : "";
    const verifierMeta = [
      verification.rank,
      cocNote,
      verification.signedAt ? formatExpiryShort(verification.signedAt) : ""
    ]
      .filter(Boolean)
      .join(" • ");

    return `
      <div class="public-cv-ref-block">
        <div class="public-cv-ref-top">
          <div>
            <p class="public-cv-ref-name">${Seav.escapeHtml(ref.name || "Referee")}</p>
            <span class="public-cv-verify-badge is-trusted">Verified reference</span>
          </div>
          <span class="public-cv-status-dot is-valid" title="${Seav.escapeHtml(status)}" aria-label="${Seav.escapeHtml(status)}"></span>
        </div>
        <div class="public-cv-ref-meta">
          ${Seav.escapeHtml(ref.title || "—")}
          ${ref.role || ref.period ? ` • ${Seav.escapeHtml([ref.role, ref.period].filter(Boolean).join(" • "))}` : ""}
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
  }

  function buildVesselReferenceSection(vesselRefs) {
    if (!vesselRefs.length) return "";
    const rows = vesselRefs.map(buildReferenceQuoteBlock).join("");
    return buildVesselSectionGroup("References", rows, vesselRefs.length, true);
  }

  // Shared badge/title card markup for a single Seafarer Award. hideVesselMeta
  // is always true here — nested one level under the vessel already, so
  // repeating the vessel name on every card would just restate the group
  // heading above it; description (or a generic fallback) is shown instead.
  function buildAchievementHighlightCard(item, hideVesselMeta = true) {
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
      <article class="public-cv-highlight-card">
        <span class="public-cv-highlight-badge">${badgeInner}</span>
        <div class="public-cv-highlight-body">
          <p class="public-cv-highlight-title">${Seav.escapeHtml(title)}</p>
          <p class="public-cv-highlight-desc">${Seav.escapeHtml(meta)}</p>
        </div>
      </article>
    `;
  }

  function buildVesselAwardsSection(vesselAwards) {
    if (!vesselAwards.length) return "";
    const rows = vesselAwards.map((item) => buildAchievementHighlightCard(item, true)).join("");
    return buildVesselSectionGroup("Awards", `<div class="public-cv-highlight-list">${rows}</div>`, vesselAwards.length, true);
  }

  // Composes the five per-vessel collapsibles that render below a vessel's
  // own card — see the doc comment on buildVesselCard above for why these
  // moved out of the card's own grid. Order matches Jack's own listed order:
  // sea time, onboard experience, references, awards (tenders slotted in
  // alongside sea time as the other "logbook" record type).
  function buildVesselLinkedSections(vessel, seatimes, tenders, refs, onboardEntries, achievements, vessels) {
    const vesselSeatimes = (seatimes || []).filter((s) => s.vesselId === vessel.id);
    const vesselTenders = (tenders || []).filter((t) => t.vesselId === vessel.id);
    const vesselRefs = (refs || []).filter((r) => r.vesselId === vessel.id);
    const vesselOnboard = (onboardEntries || []).filter((e) => e.vesselId === vessel.id);
    const vesselAwards = (achievements || []).filter((a) => a.vesselId === vessel.id);

    const sectionsHtml = [
      buildVesselSeatimeSection(vesselSeatimes),
      buildVesselTenderSection(vesselTenders, vessels),
      buildVesselOnboardSection(vesselOnboard, vessels),
      buildVesselReferenceSection(vesselRefs),
      buildVesselAwardsSection(vesselAwards)
    ]
      .filter(Boolean)
      .join("");

    return sectionsHtml ? `<div class="pp-vessel-linked-sections">${sectionsHtml}</div>` : "";
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

    // 2026-08-05, per Jack: per-vessel sea time detail now lives inside
    // each vessel's own card (see js/seav-cards.js buildVesselCardFull) —
    // this strip is just the career-wide rollup, so it's the one thing here
    // that genuinely isn't vessel-specific and leads into the vessel list.
    const totals = getSeatimeTotals(seatimes);

    box.innerHTML = `
      <div class="kpi-row-grid kpi-row-grid-5 public-profile-seatime-kpis">
        <div class="kpi-box"><div class="kpi-num">${Seav.escapeHtml(String(totals.sea))}</div><div class="kpi-label">Actual sea service</div></div>
        <div class="kpi-box"><div class="kpi-num">${Seav.escapeHtml(String(totals.yard))}</div><div class="kpi-label">Yard service</div></div>
        <div class="kpi-box"><div class="kpi-num">${Seav.escapeHtml(String(totals.standby))}</div><div class="kpi-label">Standby service</div></div>
        <div class="kpi-box"><div class="kpi-num">${Seav.escapeHtml(String(totals.watchkeeping))}</div><div class="kpi-label">Watchkeeping</div></div>
        <div class="kpi-box"><div class="kpi-num">${Seav.escapeHtml(String(totals.total))}</div><div class="kpi-label">Total qualifying service</div></div>
      </div>
    `;

    section.hidden = false;
  }

  // Catch-all card for records that carry no vesselId at all (a standalone
  // chase tender, an unlinked onboard entry, a career-wide manual award, a
  // reference logged without a vessel, or a stray sea time record) — these
  // have nowhere to live once every linked-record type moves under its
  // vessel. Reuses the exact same five per-vessel collapsibles a real
  // vessel gets (buildVesselSeatimeSection etc.) so it reads as one more
  // entry in the list, just without a photo/stats header. Omitted entirely
  // when there's nothing unattached to show.
  function buildUnattachedCard(orphanSeatimes, orphanTenders, orphanOnboard, orphanAchievements, orphanRefs, vessels) {
    const hasAny =
      orphanSeatimes.length ||
      orphanTenders.length ||
      orphanOnboard.length ||
      orphanAchievements.length ||
      orphanRefs.length;
    if (!hasAny) return "";

    const sectionsHtml = [
      buildVesselSeatimeSection(orphanSeatimes),
      buildVesselTenderSection(orphanTenders, vessels),
      buildVesselOnboardSection(orphanOnboard, vessels),
      buildVesselReferenceSection(orphanRefs),
      buildVesselAwardsSection(orphanAchievements)
    ]
      .filter(Boolean)
      .join("");

    return `
      <details class="vessel-history-collapsible">
        <summary class="vessel-history-summary">
          <span class="vessel-history-summary-title">
            <strong>Other</strong>
            <small>Not linked to a specific vessel</small>
          </span>
        </summary>
        <div class="vessel-history-collapsible-body">
          <div class="pp-vessel-linked-sections">
            ${sectionsHtml}
          </div>
        </div>
      </details>
    `;
  }

  function renderVessels(vessels, seatimes, tenders, refs, isOwner, onboardEntries, achievements) {
    const vesselBox = document.getElementById("ppVesselSnippet");
    const section = document.getElementById("ppVesselSection");
    if (!vesselBox) return;

    const vesselIds = new Set((vessels || []).map((v) => v.id));
    const signedOnboard = (onboardEntries || []).filter((e) => e.status === "Signed Off");
    const manualAchievements = (achievements || []).filter(
      (item) =>
        !item.autoAwarded &&
        (item.status === "Verified" || item.status !== "Declined") &&
        (!item.code || !window.SeavBadges?.getAchievement || !!window.SeavBadges.getAchievement(item.code))
    );
    const verifiedRefs = (refs || []).filter(isReferenceVerified);

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

    // Per Jack's 2026-08-05 correction: each vessel's card is followed
    // immediately by its own Sea Time / Tenders / Onboard Experience /
    // References / Awards collapsibles — not merged into the card's own
    // grid. Wrapping both in one block keeps them together as a single
    // pagination + "show more" unit.
    const buildBlock = (v) => `
      <div class="pp-vessel-block" data-pp-more-item>
        ${buildVesselCard(v, vessels)}
        ${buildVesselLinkedSections(v, seatimes, tenders, verifiedRefs, signedOnboard, manualAchievements, vessels)}
      </div>
    `;

    const unattachedHtml = buildUnattachedCard(
      (seatimes || []).filter((s) => !s.vesselId || !vesselIds.has(s.vesselId)),
      (tenders || []).filter((t) => !t.vesselId || !vesselIds.has(t.vesselId)),
      signedOnboard.filter((e) => !e.vesselId || !vesselIds.has(e.vesselId)),
      manualAchievements.filter((a) => !a.vesselId || !vesselIds.has(a.vesselId)),
      verifiedRefs.filter((r) => !r.vesselId || !vesselIds.has(r.vesselId)),
      vessels
    );

    // Full-width stack, not the small dash-mini-card-grid — every vessel now
    // gets the same wide "overview" card the dashboard reserves for just the
    // current vessel, so a 3-across grid would cramp it badly. The "Other"
    // catch-all always renders after the visible list, never gated behind
    // "Show more vessels" — it isn't part of the vessel pagination unit.
    vesselBox.innerHTML = `
      <div class="pp-vessel-full-list">
        ${visible.map((v) => buildBlock(v).replace(" data-pp-more-item", "")).join("")}
      </div>
      ${
        hidden.length
          ? `<div class="public-cv-more-block pp-vessel-full-list" id="${moreId}" hidden>
              ${hidden.map((v) => buildBlock(v)).join("")}
            </div>`
          : ""
      }
      ${hidden.length ? buildShowMoreButton(moreId, hidden.length, "vessels") : ""}
      ${unattachedHtml ? `<div class="pp-vessel-full-list pp-vessel-unattached">${unattachedHtml}</div>` : ""}
    `;

    setSectionCount("ppVesselCount", sorted.length);
    if (section) section.hidden = false;
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

  // Compact in-progress card for the public profile — badge + title + short
  // line, plus a real progress bar underneath, since "how far along" is the
  // whole point of this list. certGroupKey is used as the title (not the raw
  // achievement title) so a cert split across multiple catalog definitions
  // — currently only OOW Yachts <3000GT — reads as one certificate, not
  // its internal sub-badge name.
  function buildInProgressHighlightCard(entry) {
    const title = entry.certGroupKey;
    const imagePath = window.SeavBadges?.resolveBadgeImage?.(entry.full.badgeKey, false) || "";
    const initial = Seav.escapeHtml((title || "M").trim().charAt(0).toUpperCase() || "M");
    const badgeInner = imagePath
      ? `<img src="${Seav.escapeHtml(imagePath)}" alt="" loading="lazy" />`
      : `<span class="public-cv-highlight-badge-fallback">${initial}</span>`;

    return `
      <article class="public-cv-highlight-card public-cv-inprogress-card">
        <span class="public-cv-highlight-badge">${badgeInner}</span>
        <div class="public-cv-highlight-body">
          <p class="public-cv-highlight-title">${Seav.escapeHtml(title)}</p>
          <p class="public-cv-highlight-desc">${Seav.escapeHtml(entry.label || "")}</p>
          <div class="ach-progress-bar" role="progressbar" aria-valuenow="${entry.percent}" aria-valuemin="0" aria-valuemax="100">
            <span style="width: ${entry.percent}%"></span>
          </div>
        </div>
      </article>
    `;
  }

  // 2026-08-05, per Jack: the public profile's Milestones section no longer
  // shows every earned Deck Progression badge — just what's currently being
  // worked toward (window.SeavData.getInProgressCertGroups(), the same pure
  // function the Dashboard widget uses via achievements-engine.js — see
  // js/seav-data.js) plus Seafarer Awards. public-profile.html never loads
  // achievements-engine.js or window.SeavState (it fetches its own local
  // seatimes/vessels/certs/navigationAreas, see js/public-profile.js), so
  // this calls the shared seav-data.js function directly with that locally-
  // fetched data — same source of truth, no duplicated calculation logic.
  // `context` = { seatimes, certs, navigationAreas } (vessels is already a
  // separate param every other section here takes).
  function renderAchievements(achievements, vessels, isOwner, context) {
    const box = document.getElementById("ppAchievementSnippet");
    const section = document.getElementById("ppAchievementSection");
    if (!box || !section) return;

    // Cross-check against the live badge catalog, same as the private
    // Milestones page (js/achievements.js groupEarnedByCode) — a crew
    // member's older records can still reference a badge code that was
    // later pruned from js/seav-badges.js (see
    // project_seav_badges_pruned_to_real_milestones). Without this check
    // those pruned badges would keep showing here even though they no
    // longer appear anywhere on the private dashboard.
    const approved = achievements.filter(
      (item) =>
        (item.status === "Verified" || (item.status !== "Declined" && item.autoAwarded)) &&
        (!item.code || !window.SeavBadges?.getAchievement || !!window.SeavBadges.getAchievement(item.code))
    );

    const earnedCodes = new Set(approved.map((item) => item.code).filter(Boolean));
    const deckDefinitions = (window.SeavBadges?.listAchievements?.() || []).filter(
      (definition) => definition.approvalRequired === false
    );
    const inProgress = (
      window.SeavData?.getInProgressCertGroups?.({
        definitions: deckDefinitions,
        earnedCodes,
        context: {
          seatimes: context?.seatimes || [],
          vessels: vessels || [],
          certs: context?.certs || [],
          navigationAreas: context?.navigationAreas || []
        }
      }) || []
    )
      .map((entry) => ({ ...entry, full: window.SeavBadges?.getAchievementWithBadge?.(entry.primaryCode) }))
      .filter((entry) => entry.full);

    // 2026-08-05, per Jack: Seafarer Awards (manual, always vessel-linked
    // achievements — crossings etc.) now live inside each vessel's own card
    // (see js/seav-cards.js buildVesselCardFull) instead of grouped here a
    // second time. This section is just the career-wide "what's currently
    // being worked toward" list — nothing here is tied to one vessel, so it
    // stays in the Credentials zone rather than moving into a vessel card.
    if (!inProgress.length) {
      // This section has no static <h3> in the HTML (unlike the others) —
      // the header is normally built inline below along with the content, so
      // the empty state has to include it too rather than relying on markup
      // that isn't there.
      box.innerHTML = `
        <div class="dashboard-card-headline">
          <h3><span class="public-profile-section-icon" data-pp-icon="achievements" aria-hidden="true"></span>Milestones</h3>
        </div>
        ${buildEmptyState({
          heading: "No milestones in progress",
          body:
            "Career-wide certificate progress will show up here once there's sea time or navigation logged toward it.",
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

    const visibleInProgress = inProgress.slice(0, LIMITS.achievements);
    const hiddenInProgress = inProgress.slice(LIMITS.achievements);
    const inProgressMoreId = "ppAchievementInProgressMore";

    box.innerHTML = `
      <div class="dashboard-card-headline">
        <h3><span class="public-profile-section-icon" data-pp-icon="achievements" aria-hidden="true"></span>Milestones</h3>
        <span class="public-profile-section-count" id="ppAchievementCount" hidden></span>
      </div>
      <p class="public-profile-section-note">What this crew member is currently working toward — a badge shows progress made, not that the qualification is held. Seafarer Awards (crossings, etc.) are shown under the vessel they were earned on.</p>

      <div class="public-cv-highlight-list">
        ${visibleInProgress.map((entry) => buildInProgressHighlightCard(entry)).join("")}
      </div>
      ${
        hiddenInProgress.length
          ? `<div class="public-cv-more-block public-cv-highlight-list" id="${inProgressMoreId}" hidden>
              ${hiddenInProgress.map((entry) => buildInProgressHighlightCard(entry)).join("")}
            </div>
            ${buildShowMoreButton(inProgressMoreId, hiddenInProgress.length, "highlights")}`
          : ""
      }
    `;

    setSectionCount("ppAchievementCount", inProgress.length);
    section.hidden = false;
  }


  window.SeavPublicProfileSections = {
    buildVesselHighlights,
    buildVesselCard,
    renderSeatime,
    renderVessels,
    renderNavigation,
    renderOnboardSkills,
    renderHobbiesInterests,
    renderCertificates,
    renderSpecialistQualifications,
    renderAchievements
  };
})();
