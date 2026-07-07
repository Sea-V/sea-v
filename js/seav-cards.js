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
      // A recorded photo can still fail to actually render in the browser
      // (e.g. a HEIC file uploaded before the auto-convert fix, on a browser
      // with no HEIC support) — that shows the native broken-image icon with
      // no useful information. Swap to a clean text fallback instead of
      // leaving that on screen.
      const safeAlt = Seav.escapeHtml(altText || "Photo unavailable");
      return `
        <img src="${Seav.escapeHtml(photoUrl)}" alt="${safeAlt}" loading="lazy"
          onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
        <div class="dash-mini-fallback" style="display:none;">${safeAlt}</div>
      `;
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

  /**
   * Build the shared read-only onboard-experience list row used on the
   * dashboard "Onboard experience" snippet and the public profile section.
   * `options.statusFallback` preserves each page's own default label when
   * an entry has no status set ("Draft" on the dashboard, "—" on public).
   */
  function buildOnboardRow(entry, vessels, options = {}) {
    const getLabel = window.SeavData?.getOnboardCategoryLabel || ((value) => value || "—");
    const vessel = (vessels || []).find((v) => v.id === entry.vesselId);
    const statusFallback = options.statusFallback ?? "—";
    // Same green pill used on the onboard-experience edit page (js/onboard-experience.js)
    // — was plain unstyled text here before, which is why it didn't match.
    const familiarisationHtml = entry.isFamiliarisation
      ? ` <span class="onboard-familiarisation-pill">Familiarisation</span>`
      : "";

    return `
      <div class="list-row" data-pp-more-item>
        <div style="min-width:0;">
          <div class="list-title">${Seav.escapeHtml(entry.title || "—")}</div>
          <div class="list-sub">
            ${Seav.escapeHtml(vessel?.name || "—")} • ${Seav.escapeHtml(getLabel(entry.category))}${familiarisationHtml}
          </div>
        </div>
        <span class="pill">${Seav.escapeHtml(entry.status || statusFallback)}</span>
      </div>
    `;
  }

  /**
   * Build the shared specialist-qualification row used on the dashboard
   * "Specialist qualifications" snippet and the public profile section.
   *
   * The two pages have genuinely different visual designs (dashboard: flat
   * list-row + status pill; public: stacked mini-row + status dot), so this
   * keeps both exact layouts via `options.variant` rather than forcing one
   * page to change its look — only the underlying data logic (status lookup,
   * category label, meta line) is shared.
   */
  function buildSpecialistRow(entry, options = {}) {
    const getLabel =
      options.categoryLabel ||
      window.SeavData?.getSpecialistCategoryLabel ||
      ((value) => value || "—");
    const statusInfo = window.SeavData.getSpecialistQualificationStatusDisplay(entry.status);
    const title = Seav.escapeHtml(entry.title || "—");

    if (options.variant === "public") {
      // Status coloring lives in seav-data.js (shared with the dashboard
      // snippet and the edit page) — translate its pill class to a dot class
      // so all three surfaces agree on which statuses are green/blue/red.
      const DOT_CLASS_BY_PILL = {
        "pill-valid": "is-valid",
        "pill-pending": "is-pending",
        "pill-expired": "is-expired"
      };
      const dotClass = DOT_CLASS_BY_PILL[statusInfo.className] || "";
      const meta = [
        getLabel(entry.category),
        entry.issuingBody,
        entry.dateObtained && options.formatExpiry ? options.formatExpiry(entry.dateObtained) : null
      ]
        .filter(Boolean)
        .join(" • ");

      return `
        <div class="public-cv-mini-row public-cv-mini-row--stacked"${options.moreAttr ? " data-pp-more-item" : ""}>
          <div class="public-cv-mini-main">
            <span class="public-cv-mini-title">${title}</span>
            ${meta ? `<span class="public-cv-mini-meta">${Seav.escapeHtml(meta)}</span>` : ""}
          </div>
          <span class="public-cv-mini-meta">
            <span class="public-cv-status-dot${dotClass ? ` ${dotClass}` : ""}" aria-hidden="true"></span>
            ${Seav.escapeHtml(statusInfo.label)}
          </span>
        </div>
      `;
    }

    return `
      <div class="list-row">
        <div style="min-width:0;">
          <div class="list-title">${title}</div>
          <div class="list-sub">
            ${Seav.escapeHtml(getLabel(entry.category))} • ${Seav.escapeHtml(statusInfo.label)}
          </div>
        </div>
        <span class="pill ${statusInfo.className}">${Seav.escapeHtml(statusInfo.label)}</span>
      </div>
    `;
  }

  /**
   * Build the shared hobbies & interests row used on the dashboard snippet
   * and the public profile section.
   *
   * The public "show more" (hidden) list previously used a second, thinner
   * copy of this template that silently dropped the description and photos
   * — a real content bug caused by the same kind of template duplication
   * this module exists to prevent (vessel/tender cards already render full
   * detail for both visible and hidden items; this brings hobbies in line).
   */
  function buildHobbyRow(entry, options = {}) {
    const getLabel =
      options.categoryLabel ||
      window.SeavData?.getHobbyInterestCategoryLabel ||
      ((value) => value || "—");
    const categoryLabel = getLabel(entry.category);
    const title = Seav.escapeHtml(entry.title || "—");

    if (options.variant === "public") {
      const bucket =
        options.photoBucket ||
        window.SeavApiCore?.STORAGE_BUCKETS?.HOBBIES_INTEREST_PHOTOS ||
        "hobbies-interest-photos";
      const photos = (entry.photos || [])
        .map((photo) => Seav.getFileDisplayUrl(photo, bucket))
        .filter(Boolean)
        .slice(0, 3);
      const photoHtml = photos.length
        ? `<div class="public-cv-hobby-photos">${photos
            .map((url) => `<img src="${Seav.escapeHtml(url)}" alt="" class="public-cv-hobby-photo" loading="lazy" />`)
            .join("")}</div>`
        : "";

      return `
        <div class="public-cv-mini-row" data-pp-more-item>
          <div class="public-cv-mini-main">
            <span class="public-cv-mini-title">${title}</span>
            <span class="public-cv-mini-meta">${Seav.escapeHtml(categoryLabel)}</span>
            ${entry.description ? `<p class="public-cv-hobby-desc">${Seav.escapeHtml(entry.description)}</p>` : ""}
            ${photoHtml}
          </div>
        </div>
      `;
    }

    const photoCount = (entry.photos || []).filter(
      (photo) =>
        window.SeavApiCore?.hasStoredFile?.(photo) ??
        !!(photo?.url || photo?.dataUrl || photo?.path)
    ).length;
    const statusInfo = window.SeavData.getHobbyInterestStatusDisplay(entry.status);

    return `
      <div class="list-row">
        <div style="min-width:0;">
          <div class="list-title">${title}</div>
          <div class="list-sub">
            ${Seav.escapeHtml(categoryLabel)}
            ${photoCount ? ` • ${photoCount} photo${photoCount === 1 ? "" : "s"}` : ""}
          </div>
        </div>
        <span class="pill ${statusInfo.className}">${Seav.escapeHtml(statusInfo.label)}</span>
      </div>
    `;
  }

  /**
   * Build the public-profile certificate row. Deliberately just a single
   * flat, simple row (no accordion/expand, no attachment link) to match
   * every other public-profile section (specialist quals, hobbies) — the
   * previous certificates section design was a much heavier expandable
   * card that never actually got wired into public-profile.html at all.
   * Expiry is the lead fact since that's what an employer scans for first;
   * issue date (if recorded) is a secondary, optional detail.
   */
  function buildCertRow(cert) {
    const title = Seav.escapeHtml(cert?.name || cert?.code || "Certificate");
    const expiry = cert?.noExpiry ? "" : cert?.expiry || "";
    const info = window.SeavData.getCertExpiryInfo(expiry);
    const formatDate = window.SeavData.formatDatePretty;

    const DOT_CLASS_BY_PILL = {
      "pill pill-valid": "is-valid",
      "pill pill-warning": "is-pending",
      "pill pill-expired": "is-expired"
    };
    const dotClass = DOT_CLASS_BY_PILL[info.statusClass] || "";

    const expiryMeta = expiry
      ? `${info.badge === "Expired" ? "Expired" : "Expires"} ${formatDate(expiry)}`
      : "No expiry";
    const issuedMeta = cert?.issued ? `Issued ${formatDate(cert.issued)}` : "";
    const meta = [expiryMeta, issuedMeta].filter(Boolean).join(" • ");

    return `
      <div class="public-cv-mini-row" data-pp-more-item>
        <div class="public-cv-mini-main">
          <span class="public-cv-mini-title">${title}</span>
          <span class="public-cv-mini-meta">${Seav.escapeHtml(meta)}</span>
        </div>
        <span class="public-cv-mini-meta">
          <span class="public-cv-status-dot${dotClass ? ` ${dotClass}` : ""}" aria-hidden="true"></span>
          ${Seav.escapeHtml(info.badge)}
        </span>
      </div>
    `;
  }

  window.SeavCards = {
    buildVesselCard,
    buildTenderCard,
    buildOnboardRow,
    buildSpecialistRow,
    buildHobbyRow,
    buildCertRow
  };
})();
