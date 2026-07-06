// /js/seav-cards.js — shared read-only summary cards (dashboard + public profile)
//
// Single source of truth for the "mini card" markup shown on dashboard.html and
// public-profile.html. Both pages call these builders instead of keeping their
// own copies, so a field/layout change here shows up in both places automatically.
//
// Note: vessels.html has its own richer buildVesselCard() (js/vessels.js) with
// edit/delete actions and linked-record counts — that is a different, editable
// view and is intentionally not merged into this shared read-only card.
(function () {
  "use strict";

  if (!window.Seav) {
    console.warn("[SEA-V] Card renderer dependencies missing.");
    return;
  }

  const Seav = window.Seav;

  function formatCardDate(value) {
    return window.SeavData?.formatDatePretty ? window.SeavData.formatDatePretty(value) : value || "—";
  }

  function buildCardPhotoHtml(fileValue, bucket, altText) {
    const photoUrl =
      Seav.getFileDisplayUrl(fileValue, bucket) ||
      fileValue?.url ||
      fileValue?.dataUrl ||
      "";
    const hasPhoto = window.SeavApiCore?.hasStoredFile?.(fileValue) ?? !!photoUrl;

    if (photoUrl) {
      return `<img src="${Seav.escapeHtml(photoUrl)}" alt="${Seav.escapeHtml(altText)}" loading="lazy" />`;
    }
    return hasPhoto
      ? `<div class="dash-mini-fallback muted">Loading…</div>`
      : `<div class="dash-mini-fallback">No Photo</div>`;
  }

  /**
   * Build the shared read-only vessel summary card used on the dashboard
   * "Vessels" snippet and the public profile vessel section.
   */
  function buildVesselCard(vessel, options = {}) {
    const bucket =
      options.photoBucket ||
      window.SeavApiCore?.STORAGE_BUCKETS?.VESSEL_PHOTOS ||
      "vessel-photos";

    const photoHtml = buildCardPhotoHtml(vessel.photo, bucket, vessel.name || "Vessel");

    const name = Seav.escapeHtml(vessel.name || "Unnamed Vessel");
    const builder = Seav.escapeHtml(vessel.builder || "—");
    const flag = Seav.escapeHtml(vessel.flag || "—");
    const gt = Seav.escapeHtml(vessel.gt || "—");
    const role = Seav.escapeHtml(vessel.vessel_role || vessel.role || "—");
    const length = Seav.escapeHtml(vessel.vessel_length || vessel.length || "—");
    const from = vessel.from ? formatCardDate(vessel.from) : "—";
    const to = vessel.to ? formatCardDate(vessel.to) : "Present";

    return `
      <article class="dash-mini-card" data-pp-more-item>
        <div class="dash-mini-photo">${photoHtml}</div>

        <div class="dash-mini-body">
          <div class="dash-mini-head">
            <div>
              <h4>${name}</h4>
            </div>
            ${!vessel.to ? `<span class="dash-mini-status">Current</span>` : ``}
          </div>

          <div class="dash-mini-info-grid">
            <div>
              <span>Build</span>
              <strong>${builder}</strong>
            </div>
            <div>
              <span>Flag state</span>
              <strong>${flag}</strong>
            </div>
            <div>
              <span>Role</span>
              <strong>${role}</strong>
            </div>
            <div>
              <span>GT</span>
              <strong>${gt}</strong>
            </div>
            <div>
              <span>Length</span>
              <strong>${length}</strong>
            </div>
            <div>
              <span>Dates</span>
              <strong>${Seav.escapeHtml(from)} → ${Seav.escapeHtml(to)}</strong>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  /**
   * Build the shared read-only tender summary card used on the dashboard
   * "Tenders" snippet and the public profile tender section.
   */
  function buildTenderCard(tender, vessels, options = {}) {
    const bucket =
      options.photoBucket ||
      window.SeavApiCore?.STORAGE_BUCKETS?.TENDER_PHOTOS ||
      "tender-photos";

    const photoHtml = buildCardPhotoHtml(tender.photo, bucket, tender.name || "Tender");

    const linkedVessel = (vessels || []).find((v) => v.id === tender.vesselId);
    const name = Seav.escapeHtml(tender.name || "Unnamed Tender");
    const vesselName = Seav.escapeHtml(linkedVessel?.name || "Standalone / Chase");
    const type = Seav.escapeHtml(tender.type || "—");
    const proficiency = window.SeavData?.getTenderProficiencyDisplay?.(tender.proficiencyLevel);
    const proficiencyHtml = proficiency
      ? `<span class="pill tender-proficiency-pill ${proficiency.className}">${Seav.escapeHtml(proficiency.label)}</span>`
      : `<strong>—</strong>`;
    const model = Seav.escapeHtml(tender.model || "—");
    const length = Seav.escapeHtml(tender.length || "—");
    const engine = Seav.escapeHtml(tender.engine || "—");

    return `
      <article class="dash-mini-card" data-pp-more-item>
        <div class="dash-mini-photo">${photoHtml}</div>

        <div class="dash-mini-body">
          <div class="dash-mini-head">
            <div>
              <h4>${name}</h4>
            </div>
          </div>

          <div class="dash-mini-info-grid">
            <div>
              <span>Vessel</span>
              <strong>${vesselName}</strong>
            </div>
            <div>
              <span>Type</span>
              <strong>${type}</strong>
            </div>
            <div>
              <span>Model</span>
              <strong>${model}</strong>
            </div>
            <div>
              <span>Length</span>
              <strong>${length}</strong>
            </div>
            <div>
              <span>Engine</span>
              <strong>${engine}</strong>
            </div>
            <div class="dash-mini-info-cell dash-mini-info-cell--proficiency">
              <span>Proficiency</span>
              ${proficiencyHtml}
            </div>
          </div>
        </div>
      </article>
    `;
  }

  window.SeavCards = {
    buildVesselCard,
    buildTenderCard
  };
})();
