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
   * Build the richer "vessel overview" card — the same visual treatment
   * js/vessels.js gives the dashboard's single current vessel — as a
   * read-only version any number of vessels can use. Used by the public
   * profile so every vessel gets that showcase treatment instead of the
   * smaller dash-mini-card above, since vessel history is one of the more
   * attractive parts of a public profile to recruiters/viewers.
   *
   * Deliberately omits Salary (private, per-vessel field) and the SEA
   * document panel (private employment contract) — neither belongs on a
   * public page — and has no Edit/Delete actions.
   *
   * options.seatimes / options.tenders / options.refs should be the full
   * arrays for this profile; they're filtered down to this vessel's id
   * here. Callers should pre-filter refs to verified-only before passing
   * them in (this function doesn't know about verification status).
   */
  function buildVesselCardFull(vessel, options = {}) {
    const photoBucket =
      options.photoBucket ||
      window.SeavApiCore?.STORAGE_BUCKETS?.VESSEL_PHOTOS ||
      "vessel-photos";

    const photoUrl = Seav.getFileDisplayUrl(vessel.photo, photoBucket);
    const name = Seav.escapeHtml(vessel.name || "Unnamed Vessel");
    const flag = Seav.escapeHtml(vessel.flag || "—");
    const gt = Seav.escapeHtml(vessel.gt || "—");
    const length = Seav.escapeHtml(vessel.vessel_length || vessel.length || "—");
    const builder = Seav.escapeHtml(vessel.builder || "—");
    const role = Seav.escapeHtml(vessel.vessel_role || vessel.role || "—");
    const type = Seav.escapeHtml(vessel.vessel_type || vessel.type || "—");
    const program = Seav.escapeHtml(vessel.program || "—");
    const experience = vessel.experience_onboard || vessel.desc || "";
    const from = vessel.from ? formatCardDate(vessel.from) : "—";
    const to = vessel.to ? formatCardDate(vessel.to) : "Present";
    const isCurrent = !vessel.to;

    const safeAlt = Seav.escapeHtml(`${vessel.name || "Vessel"} photo`);
    const photoHtml = photoUrl
      ? `<img src="${Seav.escapeHtml(photoUrl)}" alt="${safeAlt}" loading="lazy"
          onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
         <div class="vessel-photo-fallback" style="display:none;">Photo unavailable</div>`
      : `<div class="vessel-photo-fallback">No Photo</div>`;

    const totalDays = window.SeavData?.totalQualifyingDays || (() => 0);
    const seatimes = (options.seatimes || []).filter((s) => s.vesselId === vessel.id);
    const tenders = (options.tenders || []).filter((t) => t.vesselId === vessel.id);
    const refs = (options.refs || []).filter((r) => r.vesselId === vessel.id);

    const totalSeaDays = seatimes.reduce((sum, item) => sum + totalDays(item), 0);
    const latestSeatimes = seatimes.slice(0, 3);
    const latestTenders = tenders.slice(0, 3);
    const latestRefs = refs.slice(0, 3);

    // Public profile has no SEA document column (unlike the Vessels page
    // version of this row), so the shared 1fr/210px grid from vessels.css
    // would leave a 210px gap on the right — "--solo" makes the experience
    // card fill the whole row instead of only the first column.
    const experienceHtml = experience
      ? `
        <div class="vessel-experience-row vessel-experience-row--solo">
          <section class="vessel-experience-card">
            <span class="vessel-panel-label">Experience onboard</span>
            <p class="vessel-experience-text">${Seav.escapeHtml(experience)}</p>
          </section>
        </div>
      `
      : "";

    return `
      <article class="vessel-profile-card" data-pp-more-item>

        <div class="vessel-profile-top">

          <div class="vessel-image-card">
            ${photoHtml}
          </div>

          <div class="vessel-overview-card">
            <div class="vessel-overview-head">
              <div>
                <div class="vessel-section-label">ⓘ Vessel Overview</div>
                <h2>${name}</h2>
                <p>${type} • ${flag}</p>
              </div>

              ${isCurrent ? `<span class="vessel-current-badge">Current</span>` : ``}
            </div>

            <div class="vessel-main-grid">
              <div class="vessel-main-item">
                <span>Role Onboard</span>
                <strong>${role}</strong>
              </div>

              <div class="vessel-main-item">
                <span>Dates Onboard</span>
                <strong>${Seav.escapeHtml(from)} → ${Seav.escapeHtml(to)}</strong>
              </div>

              <div class="vessel-main-item">
                <span>Program</span>
                <strong>${program}</strong>
              </div>
            </div>

            <div class="vessel-stats-grid">
              <div><span>GT</span><strong>${gt}</strong></div>
              <div><span>Length</span><strong>${length}</strong></div>
              <div><span>Build</span><strong>${builder}</strong></div>
            </div>
          </div>
        </div>

        ${experienceHtml}

        <div class="vessel-linked-clean-grid">

          <section class="vessel-linked-clean-card sea-card">
            <h3>Sea Time</h3>

            ${
              latestSeatimes.length
                ? latestSeatimes.map((item) => `
                  <div class="vessel-linked-row">
                    <div>
                      <strong>${Seav.escapeHtml(item.capacityServed || "—")}</strong>
                      <span>${item.dateJoined ? formatCardDate(item.dateJoined) : "—"} → ${item.dateLeft ? formatCardDate(item.dateLeft) : "Present"}</span>
                    </div>
                    <b>${totalDays(item)} days</b>
                  </div>
                `).join("")
                : `<p>No linked sea time entries.</p>`
            }

            <div class="vessel-total-row">
              <span>Total Sea Time</span>
              <strong>${totalSeaDays} days</strong>
            </div>
          </section>

          <section class="vessel-linked-clean-card tender-card">
            <h3>Tenders</h3>

            ${
              latestTenders.length
                ? latestTenders.map((item) => `
                  <div class="vessel-linked-row">
                    <div>
                      <strong>${Seav.escapeHtml(item.name || "Unnamed Tender")}</strong>
                      <span>${Seav.escapeHtml(item.type || item.model || "Tender")}</span>
                    </div>
                  </div>
                `).join("")
                : `<p>No linked tenders.</p>`
            }
          </section>

          <section class="vessel-linked-clean-card reference-card">
            <h3>References</h3>

            ${
              latestRefs.length
                ? latestRefs.map((item) => `
                  <div class="vessel-linked-row">
                    <div>
                      <strong>${Seav.escapeHtml(item.name || "—")}</strong>
                      <span>${Seav.escapeHtml(item.title || "—")}</span>
                    </div>
                  </div>
                `).join("")
                : `<p>No linked references.</p>`
            }
          </section>

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
    // Sits alongside the status pill in .onboard-row-actions, NOT inline
    // inside the meta text line — a pill is a full 30px-tall element
    // (--pill-height), and stuffing one into a 12px text line was forcing
    // that whole row taller than every other dashboard list-row (certs,
    // hobbies, specialist quals, etc.), which don't have a second inline
    // pill. Living beside the status pill instead costs nothing extra:
    // the row's height is set by its tallest flex child either way, and
    // that was already the title+meta text block.
    const familiarisationHtml = entry.isFamiliarisation
      ? `<span class="onboard-familiarisation-pill">Familiarisation</span>`
      : "";

    // When entries are already grouped under a vessel heading (public profile's
    // grouped onboard-experience section), repeating the vessel name on every
    // row inside that group is redundant — same fix already applied to the
    // edit page's per-entry meta line when it moved to vessel grouping.
    const metaLine = [
      options.hideVesselName ? null : Seav.escapeHtml(vessel?.name || "—"),
      Seav.escapeHtml(getLabel(entry.category))
    ]
      .filter(Boolean)
      .join(" • ");

    if (!options.expandable) {
      return `
        <div class="list-row" data-pp-more-item>
          <div style="min-width:0;">
            <div class="list-title">${Seav.escapeHtml(entry.title || "—")}</div>
            <div class="list-sub">
              ${metaLine}
            </div>
          </div>
          <div class="onboard-row-actions">
            ${familiarisationHtml}
            <span class="pill">${Seav.escapeHtml(entry.status || statusFallback)}</span>
          </div>
        </div>
      `;
    }

    // Public-profile variant: adds a "Details" toggle revealing description,
    // dates/hours/location, and the attachment (photo or file link) — this
    // data was already fetched for public profiles (RLS/grants allow it for
    // Signed Off entries), it just wasn't rendered anywhere yet.
    const detailId = `ppOnboardDetail-${Seav.escapeHtml(String(entry.id || Math.random().toString(36).slice(2)))}`;

    const metaBits = [];
    if (entry.locationOnboard) metaBits.push(Seav.escapeHtml(entry.locationOnboard));
    if (entry.dateFrom || entry.dateTo) {
      const from = entry.dateFrom ? formatCardDate(entry.dateFrom) : "—";
      const to = entry.dateTo ? formatCardDate(entry.dateTo) : "Ongoing";
      metaBits.push(Seav.escapeHtml(`${from} → ${to}`));
    }
    if (entry.hours) metaBits.push(`${Seav.escapeHtml(String(entry.hours))} hrs logged`);

    const detailParts = [];
    if (entry.description) {
      detailParts.push(`<p class="onboard-detail-desc">${Seav.escapeHtml(entry.description)}</p>`);
    }
    if (metaBits.length) {
      detailParts.push(`<div class="onboard-detail-meta">${metaBits.join(" • ")}</div>`);
    }

    const attachmentUrl = entry.attachment?.url || "";
    if (attachmentUrl) {
      const isImage = (entry.attachment?.mime || "").startsWith("image/");
      detailParts.push(
        isImage
          ? `<img class="onboard-detail-photo" src="${Seav.escapeHtml(attachmentUrl)}" alt="${Seav.escapeHtml(entry.title || "Onboard experience photo")}" loading="lazy" />`
          : `<a class="onboard-detail-attachment" href="${Seav.escapeHtml(attachmentUrl)}" target="_blank" rel="noopener">${Seav.escapeHtml(entry.attachment?.filename || "View attachment")}</a>`
      );
    }

    const hasDetail = detailParts.length > 0;

    return `
      <div class="list-row" data-pp-more-item>
        <div style="min-width:0;">
          <div class="list-title">${Seav.escapeHtml(entry.title || "—")}</div>
          <div class="list-sub">
            ${metaLine}
          </div>
        </div>
        <div class="onboard-row-actions">
          ${familiarisationHtml}
          <span class="pill">${Seav.escapeHtml(entry.status || statusFallback)}</span>
          ${
            hasDetail
              ? `<button type="button" class="onboard-detail-toggle" data-pp-expand="${detailId}" aria-expanded="false" data-pp-collapsed-label="Details">Details</button>`
              : ""
          }
        </div>
      </div>
      ${hasDetail ? `<div class="onboard-detail-panel" id="${detailId}" hidden>${detailParts.join("")}</div>` : ""}
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
  // No status concept here — specialist qualifications sit outside the
  // yachting industry, so SEA-V (or an employer) has no realistic way to
  // verify them. A manual Self-declared/Verified/Expired field used to
  // imply a check that could never actually happen; removed entirely
  // rather than shown as a permanently-unverifiable badge.
  function buildSpecialistRow(entry, options = {}) {
    const getLabel =
      options.categoryLabel ||
      window.SeavData?.getSpecialistCategoryLabel ||
      ((value) => value || "—");
    const title = Seav.escapeHtml(entry.title || "—");

    if (options.variant === "public") {
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
        </div>
      `;
    }

    return `
      <div class="list-row">
        <div style="min-width:0;">
          <div class="list-title">${title}</div>
          <div class="list-sub">
            ${Seav.escapeHtml(getLabel(entry.category))}
          </div>
        </div>
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
    buildVesselCardFull,
    buildTenderCard,
    buildOnboardRow,
    buildSpecialistRow,
    buildHobbyRow,
    buildCertRow
  };
})();
