// /js/dashboard-snippets.js — dashboard card renderers
(function () {
  "use strict";

  if (!window.Seav || !window.SeavState || !window.SeavData || !window.SeavCards) {
    console.warn("[SEA-V] Dashboard snippets dependencies missing.");
    return;
  }

  const Seav = window.Seav;
  const {
    totalQualifyingDays,
    getCertExpiryInfo,
    getReferenceStatus,
    getSeatimeVerificationDisplay,
    formatDatePretty
  } = window.SeavData;

  // The Leaflet tile URL, attribution, world bounds, mount-retry delays and the
  // four chart/layer handles that used to live here went with the dashboard
  // mini-map on 2026-08-22. navigation.html keeps its own copies.

  // js/core.js's bindStateRefresh reruns the dashboard's full refresh() on
  // EVERY "seav:data-updated" event app-wide — not just changes to a given
  // card's own data (background signed-URL re-hydration, a save on a
  // completely different page in another tab, etc.). Every snippet renderer
  // below used to rebuild its card's innerHTML unconditionally on each of
  // those calls, tearing down and recreating <img> photo elements and (worse)
  // destroying/remounting the whole Leaflet navigation map every time — a
  // visible flash even though the result was identical, most noticeable on
  // Safari. renderFingerprints tracks the last-rendered input per card so a
  // renderer can skip its rebuild when nothing it actually depends on changed.
  const renderFingerprints = new Map();

  function skipUnchangedRender(key, fingerprint) {
    if (renderFingerprints.get(key) === fingerprint) return true;
    renderFingerprints.set(key, fingerprint);
    return false;
  }

  function vesselNameFingerprint() {
    return (window.SeavState?.vessels || []).map((v) => [v.id, v.name]);
  }

  // heading.textContent = "..." wipes ALL child nodes, including the
  // data-dash-icon <span> that populateDashboardCardIcons() already
  // populated with SVG on load. Detach-and-reattach the icon node around
  // the text rewrite instead of recreating it, so the icon survives every
  // title update (card counts refresh on every "seav:data-updated" event).
  function setHeadingText(heading, text) {
    const icon = heading.querySelector(".dashboard-card-icon");
    heading.textContent = text;
    if (icon) heading.prepend(icon);
  }

  // count === null renders the bare title with no "(N)" — for a card that
  // shows one specific record rather than the first N of a list, where a
  // total in the heading would just be confusing next to a single item.
  function updateCardTitle(containerId, baseTitle, count) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const card = container.closest(".dash-card");
    if (!card) return;

    const heading = card.querySelector(".dashboard-card-headline h3, .dash-card > h3");
    if (!heading) return;

    setHeadingText(heading, count === null ? baseTitle : `${baseTitle} (${count})`);
  }

  // haversineNm / formatNm were imported here only for the mini-map's
  // straight-chord distance. Removed with it 2026-08-22 — the passage rows
  // deliberately carry no distance, see renderNavigationSnippet.

  async function renderSeatimeSnippet() {
    const dashSeatimeSnippet = document.getElementById("dashSeatimeSnippet");
    if (!dashSeatimeSnippet) return;

    const seatimes = window.SeavState?.seatimes || [];
    updateCardTitle("dashSeatimeSnippet", "Sea time", seatimes.length);

    if (!seatimes.length) {
      dashSeatimeSnippet.innerHTML = `<div class="muted">No sea service yet.</div>`;
      return;
    }

    const latestThree = [...seatimes]
      .sort((a, b) => {
        const da = a.dateJoined ? new Date(a.dateJoined) : new Date(0);
        const db = b.dateJoined ? new Date(b.dateJoined) : new Date(0);
        return db - da;
      })
      .slice(0, 3);

    const fingerprint = JSON.stringify({ latestThree, vessels: vesselNameFingerprint() });
    if (skipUnchangedRender("seatime", fingerprint)) return;

    dashSeatimeSnippet.innerHTML = `
      <div class="dash-snippet-rows">
        ${latestThree.map((item) => {
          const flagGt = [
            item.flag ? Seav.escapeHtml(item.flag) : "—",
            item.gt ? `${Seav.escapeHtml(item.gt)} GT` : "—"
          ].join(" • ");
          const verificationDisplay = getSeatimeVerificationDisplay(item.verificationStatus || "Logged");
          const vesselName = Seav.escapeHtml(
            (window.SeavState?.vessels || []).find((v) => v.id === item.vesselId)?.name || "—"
          );
          const dateRange = `${Seav.escapeHtml(item.dateJoined || "—")} – ${Seav.escapeHtml(item.dateLeft || "Present")}`;

          return `
            <div class="dash-snippet-row">
              <div class="dash-snippet-row-main">
                <div class="dash-snippet-row-title">${vesselName}</div>
                <div class="dash-snippet-row-meta">${dateRange} • ${flagGt} • ${totalQualifyingDays(item)} qualifying days</div>
              </div>
              <span class="${Seav.escapeHtml(verificationDisplay.className)}">${Seav.escapeHtml(verificationDisplay.label)}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

function updateCertCardCompleteState(displayCount) {
  const container = document.getElementById("dashCertSnippet");
  const card = container?.closest(".dash-card");
  const heading = card?.querySelector(".dashboard-card-headline h3, .dash-card > h3");

  if (heading) {
    setHeadingText(heading, displayCount > 0 ? `Certificates (${displayCount})` : "Certificates");
  }
}

async function renderCertSnippet() {
  const dashCertSnippet = document.getElementById("dashCertSnippet");
  if (!dashCertSnippet) return;

  const certs = (window.SeavState?.certs || []).filter(
    (cert) => window.SeavData?.isSavedCert?.(cert) ?? !!cert?.name
  );

  const isNoExpiry = window.SeavData?.isCertNoExpiry;

  const expiryCerts = certs.filter((cert) => {
    if (isNoExpiry?.(cert)) return false;
    return !!String(cert.expiry || "").trim();
  });

  updateCertCardCompleteState(expiryCerts.length);

  if (!expiryCerts.length) {
    dashCertSnippet.innerHTML = `
      <p class="dashboard-cert-attention-note muted">
        ${
          certs.length
            ? "No certificates with expiry dates yet. Add expiry dates on the certificates page to track renewals here."
            : "No certificates yet."
        }
      </p>
    `;
    return;
  }

  function getDashboardCertStatus(cert) {
    return getCertExpiryInfo(cert.expiry);
  }

  const sortedCerts = [...expiryCerts].sort((a, b) => {
    const aInfo = getDashboardCertStatus(a);
    const bInfo = getDashboardCertStatus(b);

    const score = (info) => {
      const badge = String(info.badge || "").toLowerCase();
      if (badge === "expired") return 0;
      if (badge === "expires soon") return 1;
      return 2;
    };

    const aScore = score(aInfo);
    const bScore = score(bInfo);

    if (aScore !== bScore) return aScore - bScore;

    const aDate = a.expiry ? new Date(a.expiry) : new Date("9999-12-31");
    const bDate = b.expiry ? new Date(b.expiry) : new Date("9999-12-31");
    return aDate - bDate;
  });

  if (skipUnchangedRender("cert", JSON.stringify(sortedCerts))) return;

  dashCertSnippet.innerHTML = `
    <div class="dash-snippet-rows">
      ${sortedCerts
        .map((cert) => {
          const statusInfo = getDashboardCertStatus(cert);
          const expiryDisplay = cert.expiry ? formatDatePretty(cert.expiry) : "—";

          return `
            <div class="dash-snippet-row">
              <div class="dash-snippet-row-main">
                <div class="dash-snippet-row-title">
                  ${Seav.escapeHtml(cert.code || "—")} • ${Seav.escapeHtml(cert.name || "—")}
                </div>
                <div class="dash-snippet-row-meta">
                  Expiry: ${Seav.escapeHtml(expiryDisplay)} • ${Seav.escapeHtml(statusInfo.label)}
                </div>
              </div>
              <span class="${statusInfo.statusClass}">${Seav.escapeHtml(statusInfo.badge)}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

 // 2026-08-21, per Jack: the dashboard shows ONE vessel, not the latest
 // three. His reasoning: "dashboard should reflect current items and pages
 // can be used to access history" — a vessel is a state ("I am aboard X"),
 // unlike sea time / tenders / references, which are event streams where a
 // recent-3 list genuinely informs. Those cards are deliberately unchanged.
 //
 // Layout is the full .vessel-profile-card (SeavCards.buildVesselCardFull),
 // the same card the Vessels page and Public Profile use — Jack: "at least
 // we have one style and we stick to it". Not the .dash-mini-card grid,
 // which would have rendered a single card at a third width with two empty
 // columns beside it.
 //
 // Heading is honest about which of the two cases this is: "Current vessel"
 // only when the record is genuinely open-ended, otherwise "Most recent
 // vessel" — a departed crew member's dashboard must not read as though
 // they are still aboard. No "(N)" count: it would sit next to a single
 // card and imply that many are shown. The card headline's own "View all"
 // link is the path to history.
async function renderVesselSnippet() {
  const dashVesselSnippet = document.getElementById("dashVesselSnippet");
  if (!dashVesselSnippet) return;

  const vessels = window.SeavState?.vessels || [];

  if (!vessels.length) {
    updateCardTitle("dashVesselSnippet", "Vessels", 0);
    dashVesselSnippet.innerHTML = `<div class="muted">No vessels yet.</div>`;
    return;
  }

  // Shared with the Public Profile's default-open dropdown and the Vessels
  // page — see getCurrentVessel() in js/seav-data.js. Written out separately
  // in each place before today, which is how three pages drift apart.
  const vessel = window.SeavData.getCurrentVessel(vessels);
  if (!vessel) {
    updateCardTitle("dashVesselSnippet", "Vessels", vessels.length);
    dashVesselSnippet.innerHTML = `<div class="muted">No vessels yet.</div>`;
    return;
  }

  const isCurrent = window.SeavData.isVesselOpenEnded(vessel);
  updateCardTitle("dashVesselSnippet", isCurrent ? "Current vessel" : "Most recent vessel", null);

  const vesselPhotoBucket =
    window.SeavApiCore?.STORAGE_BUCKETS?.VESSEL_PHOTOS || "vessel-photos";
  if (window.SeavApiCore?.hydrateItemsFileField) {
    await window.SeavApiCore.hydrateItemsFileField(
      [vessel],
      "photo",
      vesselPhotoBucket
    );
    window.SeavState?.syncCache?.();
  }

  // Fingerprint taken after hydration so an already-cached signed URL
  // (unchanged) still compares equal and skips the rebuild — this is what
  // stops the vessel photo from flashing on every unrelated data refresh.
  if (skipUnchangedRender("vessel", JSON.stringify(vessel))) return;

  dashVesselSnippet.innerHTML = window.SeavCards.buildVesselCardFull(vessel, {
    photoBucket: vesselPhotoBucket,
    vesselColor: window.SeavData.getVesselColor(vessel.id, vessels)
  });
}

async function renderTenderSnippet() {
  const dashTenderSnippet = document.getElementById("dashTenderSnippet");
  if (!dashTenderSnippet) return;

  const tenders = window.SeavState?.tenders || [];
  updateCardTitle("dashTenderSnippet", "Tenders", tenders.length);

  if (!tenders.length) {
    dashTenderSnippet.innerHTML = `<div class="muted">No tenders yet.</div>`;
    return;
  }

  const latestThree = [...tenders].slice().reverse().slice(0, 3);

  if (window.SeavApiCore?.hydrateItemsFileField) {
    await window.SeavApiCore.hydrateItemsFileField(
      latestThree,
      "photo",
      window.SeavApiCore.STORAGE_BUCKETS?.TENDER_PHOTOS || "tender-photos"
    );
    window.SeavState?.syncCache?.();
  }

  const tenderPhotoBucket =
    window.SeavApiCore?.STORAGE_BUCKETS?.TENDER_PHOTOS || "tender-photos";

  if (skipUnchangedRender("tender", JSON.stringify(latestThree))) return;

  dashTenderSnippet.innerHTML = `
    <div class="dash-mini-card-grid">
      ${latestThree
        .map((tender) =>
          window.SeavCards.buildTenderCard(tender, window.SeavState?.vessels || [], {
            photoBucket: tenderPhotoBucket
          })
        )
        .join("")}
    </div>
  `;
}

function getDashboardVesselName(vesselId) {
  if (!vesselId) return "Unassigned";
  return (window.SeavState?.vessels || []).find((v) => v.id === vesselId)?.name || "Unnamed vessel";
}

function getDashboardVesselColor(vesselId) {
  return window.SeavData?.getVesselColor?.(vesselId) || "#64748b";
}

// 2026-08-22, per Jack: the dashboard no longer draws a chart. "i dont think
// we need the nav map on the dashboard, i think the last three passages logged
// will suffice as a reminder." This card is now the same shape as every other
// snippet — the three most recent records, title plus a meta line — and the
// aggregates (total distance, countries, per-vessel breakdown) live on
// navigation.html, where the full picture belongs.
//
// Removed with it: the Leaflet mini-map and ~530 lines of chart machinery
// (initDashboardNavigationChart, drawDashboardNavigationChart, the tile-load
// diagnostics, the container-ready and Leaflet-arrival polls, the country
// highlight layer, buildDashboardPassagePaths, buildDashboardNavigationStats,
// getDashboardRouteCoords/Distance and the waypoint normaliser). dashboard.html
// dropped the Leaflet CSS/JS and js/navigation-passage.js + navigation-routing.js
// at the same time — nothing else on the page used them.
//
// No distance on these rows, deliberately. The routed sea-lane figure needs
// navigation-passage.js + navigation-routing.js (34 KB) to compute, and the
// cheap straight-chord alternative disagrees with the number navigation.html
// shows for the same passage — the exact mismatch a comment on the old
// buildDashboardPassagePaths existed to explain. A reminder card does not need
// a number that can contradict its own detail page.

const DASH_NAV_LIMIT = 3;

function passageSortDate(entry) {
  return entry.departureDate || entry.visitedDate || entry.arrivalDate || "";
}

function renderNavigationSnippet() {
  const box = document.getElementById("dashNavigationSnippet");
  if (!box) return;

  const entries = window.SeavState?.navigationAreas || [];
  updateCardTitle("dashNavigationSnippet", "Navigation", entries.length);

  if (!entries.length) {
    box.innerHTML = `<div class="muted">No passages logged yet.</div>`;
    return;
  }

  const H = window.SeavNavigationHelpers;

  // normalizeNavEntry resolves a port named in free text back to its record,
  // which is what makes formatRouteLabel produce "Palma, Spain → Gibraltar"
  // rather than a bare country. Skipping it is the same bug already fixed once
  // on the Navigation page, where legacy entries lost their country names.
  const normalized = (H?.normalizeNavEntry ? entries.map(H.normalizeNavEntry) : entries)
    .slice()
    .sort((a, b) => String(passageSortDate(b)).localeCompare(String(passageSortDate(a))))
    .slice(0, DASH_NAV_LIMIT);

  if (skipUnchangedRender("navigation", JSON.stringify({ normalized, vessels: vesselNameFingerprint() }))) return;

  box.innerHTML = `
    <div class="list">
      ${normalized
        .map((entry) => {
          const route = H?.formatRouteLabel ? H.formatRouteLabel(entry) : "Passage";
          const title = entry.passageName || route;
          const vesselName = getDashboardVesselName(entry.vesselId || entry.vessel_id);
          const from = passageSortDate(entry);
          const to = entry.arrivalDate || "";
          const dates = from && to && from !== to ? `${from} → ${to}` : from || to || "";
          const meta = [
            // Only shown when a passage name is set — otherwise the route IS
            // the title and repeating it below reads as a rendering fault.
            entry.passageName ? route : "",
            vesselName,
            dates,
            entry.isTidal ? "Tidal waters" : ""
          ]
            .filter(Boolean)
            .map((part) => Seav.escapeHtml(String(part)))
            .join(" · ");

          return `
            <div class="list-row">
              <div style="min-width:0;">
                <div class="list-title">
                  <span class="navigation-log-color" style="background:${Seav.escapeHtml(
                    getDashboardVesselColor(entry.vesselId || entry.vessel_id)
                  )}"></span>
                  ${Seav.escapeHtml(title)}
                </div>
                <div class="list-sub">${meta}</div>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

  function truncateText(text, max = 140) {
    return window.SeavData?.truncateText
      ? window.SeavData.truncateText(text, max)
      : String(text || "").trim().slice(0, max);
  }

  async function renderReferenceSnippet() {
    const dashRefSnippet = document.getElementById("dashRefSnippet");
    if (!dashRefSnippet) return;

    const refs = window.SeavState?.refs || [];
    updateCardTitle("dashRefSnippet", "References", refs.length);

    if (!refs.length) {
      dashRefSnippet.innerHTML = `<div class="muted">No references yet.</div>`;
      return;
    }

    const latestThree = [...refs]
      .sort((a, b) => {
        const da = a.date ? new Date(a.date) : new Date(0);
        const db = b.date ? new Date(b.date) : new Date(0);
        return db - da;
      })
      .slice(0, 3);

    if (skipUnchangedRender("reference", JSON.stringify(latestThree))) return;

    dashRefSnippet.innerHTML = `
      <div class="dash-snippet-rows">
        ${latestThree.map((ref) => {
          const status = getReferenceStatus(ref);
          const statusInfo = window.SeavData.getReferenceStatusDisplay(status);
          const quote = truncateText(ref.text, 140);
          return `
            <div class="dash-snippet-row">
              <div class="dash-snippet-row-main">
                <div class="dash-snippet-row-title">${Seav.escapeHtml(ref.name || "—")}</div>
                <div class="dash-snippet-row-meta">${Seav.escapeHtml(ref.title || "—")} • ${Seav.escapeHtml(formatDatePretty(ref.date))}</div>
                ${
                  quote
                    ? `<div class="dash-snippet-row-quote">“${Seav.escapeHtml(quote)}”</div>`
                    : ``
                }
              </div>
              <span class="${statusInfo.className}">${Seav.escapeHtml(statusInfo.label)}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

async function renderSpecialistSnippet() {
  const dashSpecialistSnippet = document.getElementById("dashSpecialistSnippet");
  if (!dashSpecialistSnippet) return;

  const entries = window.SeavState?.specialistQualifications || [];
  updateCardTitle("dashSpecialistSnippet", "Specialist qualifications", entries.length);

  if (!entries.length) {
    dashSpecialistSnippet.innerHTML = `<div class="muted">No specialist qualifications logged yet.</div>`;
    return;
  }

  const latest = [...entries]
    .sort((a, b) => {
      const da = a.dateObtained ? new Date(a.dateObtained) : new Date(0);
      const db = b.dateObtained ? new Date(b.dateObtained) : new Date(0);
      return db - da;
    })
    .slice(0, 4);

  const getLabel =
    window.SeavData?.getSpecialistCategoryLabel ||
    ((value) => value || "—");

  if (skipUnchangedRender("specialist", JSON.stringify(latest))) return;

  dashSpecialistSnippet.innerHTML = `
    <div class="list">
      ${latest
        .map((entry) => window.SeavCards.buildSpecialistRow(entry, { categoryLabel: getLabel }))
        .join("")}
    </div>
  `;
}

async function renderOnboardSnippet() {
  const dashOnboardSnippet = document.getElementById("dashOnboardSnippet");
  if (!dashOnboardSnippet) return;

  const entries = window.SeavState?.onboardExperiences || [];
  updateCardTitle("dashOnboardSnippet", "Onboard experience", entries.length);

  if (!entries.length) {
    dashOnboardSnippet.innerHTML = `<div class="muted">No onboard experience logged yet.</div>`;
    return;
  }

  const latest = [...entries]
    .sort((a, b) => {
      const da = a.dateFrom ? new Date(a.dateFrom) : new Date(0);
      const db = b.dateFrom ? new Date(b.dateFrom) : new Date(0);
      return db - da;
    })
    .slice(0, 4);

  const vessels = window.SeavState?.vessels || [];

  if (skipUnchangedRender("onboard", JSON.stringify({ latest, vessels: vesselNameFingerprint() }))) {
    return;
  }

  dashOnboardSnippet.innerHTML = `
    <div class="list">
      ${latest
        .map((entry) => window.SeavCards.buildOnboardRow(entry, vessels))
        .join("")}
    </div>
  `;
}

async function renderHobbiesSnippet() {
  const dashHobbiesSnippet = document.getElementById("dashHobbiesSnippet");
  if (!dashHobbiesSnippet) return;

  const entries = window.SeavState?.hobbiesInterests || [];
  updateCardTitle("dashHobbiesSnippet", "Hobbies & interests", entries.length);

  if (!entries.length) {
    dashHobbiesSnippet.innerHTML = `<div class="muted">No hobbies or interests logged yet.</div>`;
    return;
  }

  const latest = [...entries]
    .sort((a, b) => {
      const da = a.dateFrom ? new Date(a.dateFrom) : new Date(a.updatedAt || 0);
      const db = b.dateFrom ? new Date(b.dateFrom) : new Date(b.updatedAt || 0);
      return db - da;
    })
    .slice(0, 4);

  const getLabel =
    window.SeavData?.getHobbyInterestCategoryLabel ||
    ((value) => value || "—");

  if (skipUnchangedRender("hobbies", JSON.stringify(latest))) return;

  dashHobbiesSnippet.innerHTML = `
    <div class="list">
      ${latest
        .map((entry) => window.SeavCards.buildHobbyRow(entry, { categoryLabel: getLabel }))
        .join("")}
    </div>
  `;
}


  window.SeavDashboardSnippets = {
    renderVesselSnippet,
    renderSeatimeSnippet,
    renderNavigationSnippet,
    renderTenderSnippet,
    renderOnboardSnippet,
    renderSpecialistSnippet,
    renderCertSnippet,
    renderReferenceSnippet,
    renderHobbiesSnippet
  };
})();
