// /js/cv-engine-render.js
(function () {
  "use strict";
  const M = window.SeavCvModel;
  if (!M) return;
  const {
    escapeHtml, splitParagraphs,
    getVesselRole, formatVesselSubline,
    formatProfileDob, splitProfileLines, splitProfileList, LOGO_SRC
  } = M;
  function renderBrandMark(showBranding) {
    if (!showBranding) return "";
    return `
      <div class="cv-brand-mark" title="Built with SEA-V">
        <img src="${escapeHtml(LOGO_SRC)}" alt="SEA-V" />
      </div>
    `;
  }

  function renderPhoto(photoUrl, className) {
    if (!photoUrl) return "";
    return `<div class="${className}"><img src="${escapeHtml(photoUrl)}" alt="" /></div>`;
  }

  function renderSeavSidebarBlock(title, bodyHtml) {
    if (!bodyHtml) return "";
    return `
      <section class="cv-seav-side-block">
        <h2 class="cv-seav-side-title">${escapeHtml(title)}</h2>
        <div class="cv-seav-side-body">${bodyHtml}</div>
      </section>
    `;
  }

  function renderSeavContact(profile) {
    const parts = [profile.phone, profile.email, profile.location].filter(Boolean);
    if (!parts.length) return "";
    return `<p class="cv-seav-contact-line">${parts
      .map((part) => `<span>${escapeHtml(part)}</span>`)
      .join("")}</p>`;
  }

  // Each line is tagged with what it actually is (Nationality/Passport/Visa)
  // so e.g. a British nationality + a British passport don't show up as two
  // unlabelled "British" lines with no indication of what either one means.
  function renderSeavNationality(profile) {
    const lines = [];
    if (profile.nationality) lines.push({ label: "Nationality", value: profile.nationality });
    splitProfileList(profile.passportsHeld).forEach((value) =>
      lines.push({ label: "Passport", value })
    );
    splitProfileLines(profile.visasHeld).forEach((value) =>
      lines.push({ label: "Visa", value })
    );
    if (!lines.length) return "";
    return lines
      .map(({ label, value }) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`)
      .join("");
  }

  function renderSeavExperience(vessels) {
    if (!vessels.length) {
      return `<p class="cv-empty-copy">Include at least one vessel in the CV editor.</p>`;
    }

    return vessels
      .map((vessel) => {
        const role = vessel.cvRole || getVesselRole(vessel);
        const subline = formatVesselSubline(vessel);
        const descriptionHtml = vessel.cvDescription
          ? splitParagraphs(vessel.cvDescription)
              .map((p) => `<p class="cv-seav-job-desc">${escapeHtml(p)}</p>`)
              .join("")
          : "";

        return `
          <article class="cv-seav-job">
            <h3 class="cv-seav-job-title">
              <span>${escapeHtml(vessel.dateRange)}</span>
              <span class="cv-seav-job-sep">|</span>
              <span>${escapeHtml(role || "Crew member")}</span>
              <span class="cv-seav-job-sep">|</span>
              <span>${escapeHtml(vessel.name || "Yacht")}</span>
            </h3>
            ${subline ? `<p class="cv-seav-job-subline">${escapeHtml(subline)}</p>` : ""}
            ${descriptionHtml}
          </article>
        `;
      })
      .join("");
  }

  function renderSeavReferences(references) {
    if (!references.length) return "";

    return `
      <section class="cv-seav-references">
        <h2 class="cv-seav-section-title">References</h2>
        <div class="cv-seav-ref-grid">
          ${references
            .map(
              (ref) => `
                <article class="cv-seav-ref">
                  <p class="cv-seav-ref-name">${escapeHtml(ref.name)}</p>
                  ${ref.detail ? `<p class="cv-seav-ref-detail">${escapeHtml(ref.detail)}</p>` : ""}
                  ${ref.email ? `<p class="cv-seav-ref-email">${escapeHtml(ref.email)}</p>` : ""}
                </article>
              `
            )
            .join("")}
        </div>
      </section>
    `;
  }

  function renderSeav(doc) {
    const { profile, sections } = doc;

    const certList =
      sections.showCerts && doc.certStrip.length
        ? `<ul class="cv-seav-plain-list">${doc.certStrip
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join("")}</ul>`
        : "";

    const specialistList =
      sections.showEducation && doc.specialistQualifications.length
        ? `<ul class="cv-seav-plain-list">${doc.specialistQualifications
            .map((item) => `<li>${escapeHtml(item.title)}</li>`)
            .join("")}</ul>`
        : "";

    const milestonesHtml =
      sections.showHighlights && doc.highlights.length
        ? `<p class="cv-seav-extra">${doc.highlights
            .map((line) => escapeHtml(line))
            .join("<br />")}</p>`
        : "";

    const dob = formatProfileDob(profile.dob);

    const sidebarHtml = [
      sections.showContact ? renderSeavSidebarBlock("Contact", renderSeavContact(profile)) : "",
      dob ? renderSeavSidebarBlock("Date of Birth", `<p>${escapeHtml(dob)}</p>`) : "",
      renderSeavSidebarBlock("Nationality & Visas", renderSeavNationality(profile)),
      profile.availability
        ? renderSeavSidebarBlock("Availability", `<p>${escapeHtml(profile.availability)}</p>`)
        : "",
      renderSeavSidebarBlock("Yacht Qualifications", certList),
      renderSeavSidebarBlock("Other Qualifications", specialistList),
      renderSeavSidebarBlock("Milestones", milestonesHtml)
    ].join("");

    const photoHtml = doc.photoUrl
      ? `<div class="cv-seav-photo-wrap">${renderPhoto(doc.photoUrl, "cv-seav-photo")}</div>`
      : "";

    return `
      ${renderBrandMark(sections.showSeavBranding)}
      <div class="cv-seav">
        <div class="cv-seav-layout">
          <aside class="cv-seav-sidebar">
            ${photoHtml}
            <div class="cv-seav-sidebar-inner">${sidebarHtml}</div>
          </aside>

          <div class="cv-seav-content">
            <header class="cv-seav-header">
              <h1 class="cv-seav-name">${escapeHtml(profile.name || "Your Name")}</h1>
              <p class="cv-seav-rank">${escapeHtml(doc.headline)}</p>
              <div class="cv-seav-summary">
                ${doc.summaryParagraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
              </div>
            </header>

            <section class="cv-seav-main">
              <h2 class="cv-seav-section-title">Yachting Experience</h2>
              ${renderSeavExperience(doc.vessels)}
            </section>

            ${sections.showReferences ? renderSeavReferences(doc.references) : ""}
          </div>
        </div>
      </div>
    `;
  }

  // =========================================================
  // "Shipshape" template — single column, plain & ATS-friendly.
  // Deliberately no photo, no colour accents, no tables/columns, so
  // resume-parsing software can read it cleanly.
  // =========================================================

  function buildPersonalDetailsLine(profile) {
    const parts = [];
    if (profile.nationality) parts.push(`Nationality: ${profile.nationality}`);
    splitProfileList(profile.passportsHeld).forEach((v) => parts.push(`Passport: ${v}`));
    splitProfileLines(profile.visasHeld).forEach((v) => parts.push(`Visa: ${v}`));
    const dob = formatProfileDob(profile.dob);
    if (dob) parts.push(`Date of Birth: ${dob}`);
    if (profile.availability) parts.push(`Availability: ${profile.availability}`);
    return parts;
  }

  function renderClassicExperience(vessels) {
    if (!vessels.length) {
      return `<p class="cv-empty-copy">Include at least one vessel in the CV editor.</p>`;
    }
    return vessels
      .map((vessel) => {
        const role = vessel.cvRole || getVesselRole(vessel);
        const subline = formatVesselSubline(vessel);
        const descriptionHtml = vessel.cvDescription
          ? splitParagraphs(vessel.cvDescription)
              .map((p) => `<p class="cv-classic-job-desc">${escapeHtml(p)}</p>`)
              .join("")
          : "";
        return `
          <article class="cv-classic-job">
            <h3 class="cv-classic-job-title">${escapeHtml(role || "Crew member")} — ${escapeHtml(
              vessel.name || "Yacht"
            )}</h3>
            <p class="cv-classic-job-dates">${escapeHtml(vessel.dateRange)}</p>
            ${subline ? `<p class="cv-classic-job-subline">${escapeHtml(subline)}</p>` : ""}
            ${descriptionHtml}
          </article>
        `;
      })
      .join("");
  }

  function renderClassicReferences(references) {
    if (!references.length) return "";
    return `
      <section class="cv-classic-section">
        <h2 class="cv-classic-section-title">References</h2>
        ${references
          .map((ref) => {
            const line = [ref.name, ref.detail, ref.email].filter(Boolean);
            return `<p class="cv-classic-ref"><strong>${escapeHtml(ref.name)}</strong>${
              ref.detail ? ` — ${escapeHtml(ref.detail)}` : ""
            }${ref.email ? ` — ${escapeHtml(ref.email)}` : ""}</p>`;
          })
          .join("")}
      </section>
    `;
  }

  function renderClassic(doc) {
    const { profile, sections } = doc;

    const contactParts = sections.showContact
      ? [profile.phone, profile.email, profile.location].filter(Boolean)
      : [];
    const detailsParts = buildPersonalDetailsLine(profile);

    const certLine =
      sections.showCerts && doc.certStrip.length
        ? `<p class="cv-classic-plain-line">${escapeHtml(doc.certStrip.join(", "))}</p>`
        : "";
    const specialistLine =
      sections.showEducation && doc.specialistQualifications.length
        ? `<p class="cv-classic-plain-line">${escapeHtml(
            doc.specialistQualifications.map((i) => i.title).join(", ")
          )}</p>`
        : "";
    const milestonesHtml =
      sections.showHighlights && doc.highlights.length
        ? `<p class="cv-classic-plain-line">${escapeHtml(doc.highlights.join(" · "))}</p>`
        : "";

    return `
      <div class="cv-classic">
        <header class="cv-classic-header">
          <h1 class="cv-classic-name">${escapeHtml(profile.name || "Your Name")}</h1>
          <p class="cv-classic-rank">${escapeHtml(doc.headline)}</p>
          ${contactParts.length ? `<p class="cv-classic-contact">${escapeHtml(contactParts.join("   |   "))}</p>` : ""}
          ${detailsParts.length ? `<p class="cv-classic-details">${escapeHtml(detailsParts.join("   |   "))}</p>` : ""}
        </header>

        <section class="cv-classic-section">
          <h2 class="cv-classic-section-title">Professional Summary</h2>
          ${doc.summaryParagraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
        </section>

        <section class="cv-classic-section">
          <h2 class="cv-classic-section-title">Yachting Experience</h2>
          ${renderClassicExperience(doc.vessels)}
        </section>

        ${
          certLine
            ? `<section class="cv-classic-section"><h2 class="cv-classic-section-title">Certifications</h2>${certLine}</section>`
            : ""
        }
        ${
          specialistLine
            ? `<section class="cv-classic-section"><h2 class="cv-classic-section-title">Specialist Qualifications</h2>${specialistLine}</section>`
            : ""
        }
        ${
          milestonesHtml
            ? `<section class="cv-classic-section"><h2 class="cv-classic-section-title">Milestones</h2>${milestonesHtml}</section>`
            : ""
        }

        ${sections.showReferences ? renderClassicReferences(doc.references) : ""}

        ${sections.showSeavBranding ? `<p class="cv-classic-brand">Built with SEA-V</p>` : ""}
      </div>
    `;
  }

  // =========================================================
  // "Tight Ship" template — dense single column, smaller type,
  // fits more onto fewer pages. Keeps the photo, drops the sidebar.
  // =========================================================

  function renderCompactExperience(vessels) {
    if (!vessels.length) {
      return `<p class="cv-empty-copy">Include at least one vessel in the CV editor.</p>`;
    }
    return vessels
      .map((vessel) => {
        const role = vessel.cvRole || getVesselRole(vessel);
        const subline = formatVesselSubline(vessel);
        const descriptionHtml = vessel.cvDescription
          ? splitParagraphs(vessel.cvDescription)
              .map((p) => `<p class="cv-compact-job-desc">${escapeHtml(p)}</p>`)
              .join("")
          : "";
        return `
          <article class="cv-compact-job">
            <h3 class="cv-compact-job-title">
              <span>${escapeHtml(vessel.dateRange)}</span> · <span>${escapeHtml(
                role || "Crew member"
              )}</span> · <span>${escapeHtml(vessel.name || "Yacht")}</span>
            </h3>
            ${subline ? `<p class="cv-compact-job-subline">${escapeHtml(subline)}</p>` : ""}
            ${descriptionHtml}
          </article>
        `;
      })
      .join("");
  }

  function renderCompactReferences(references) {
    if (!references.length) return "";
    return `
      <section class="cv-compact-section">
        <h2 class="cv-compact-section-title">References</h2>
        <div class="cv-compact-ref-grid">
          ${references
            .map(
              (ref) =>
                `<p class="cv-compact-ref"><strong>${escapeHtml(ref.name)}</strong>${
                  ref.detail ? ` — ${escapeHtml(ref.detail)}` : ""
                }${ref.email ? ` — ${escapeHtml(ref.email)}` : ""}</p>`
            )
            .join("")}
        </div>
      </section>
    `;
  }

  function renderCompact(doc) {
    const { profile, sections } = doc;

    const contactParts = sections.showContact
      ? [profile.phone, profile.email, profile.location].filter(Boolean)
      : [];
    const detailsParts = buildPersonalDetailsLine(profile);

    const certLine =
      sections.showCerts && doc.certStrip.length
        ? `<p class="cv-compact-plain-line">${escapeHtml(doc.certStrip.join(", "))}</p>`
        : "";
    const specialistLine =
      sections.showEducation && doc.specialistQualifications.length
        ? `<p class="cv-compact-plain-line">${escapeHtml(
            doc.specialistQualifications.map((i) => i.title).join(", ")
          )}</p>`
        : "";
    const milestonesHtml =
      sections.showHighlights && doc.highlights.length
        ? `<p class="cv-compact-plain-line">${escapeHtml(doc.highlights.join(" · "))}</p>`
        : "";

    const photoHtml = doc.photoUrl
      ? `<div class="cv-compact-photo"><img src="${escapeHtml(doc.photoUrl)}" alt="" /></div>`
      : "";

    return `
      <div class="cv-compact">
        <header class="cv-compact-header">
          ${photoHtml}
          <div class="cv-compact-head-text">
            <h1 class="cv-compact-name">${escapeHtml(profile.name || "Your Name")}</h1>
            <p class="cv-compact-rank">${escapeHtml(doc.headline)}</p>
            ${contactParts.length ? `<p class="cv-compact-contact">${escapeHtml(contactParts.join("  |  "))}</p>` : ""}
            ${detailsParts.length ? `<p class="cv-compact-details">${escapeHtml(detailsParts.join("  |  "))}</p>` : ""}
          </div>
        </header>

        <div class="cv-compact-summary">
          ${doc.summaryParagraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
        </div>

        <section class="cv-compact-section">
          <h2 class="cv-compact-section-title">Yachting Experience</h2>
          ${renderCompactExperience(doc.vessels)}
        </section>

        ${
          certLine
            ? `<section class="cv-compact-section"><h2 class="cv-compact-section-title">Certifications</h2>${certLine}</section>`
            : ""
        }
        ${
          specialistLine
            ? `<section class="cv-compact-section"><h2 class="cv-compact-section-title">Specialist Qualifications</h2>${specialistLine}</section>`
            : ""
        }
        ${
          milestonesHtml
            ? `<section class="cv-compact-section"><h2 class="cv-compact-section-title">Milestones</h2>${milestonesHtml}</section>`
            : ""
        }

        ${sections.showReferences ? renderCompactReferences(doc.references) : ""}

        ${sections.showSeavBranding ? `<p class="cv-compact-brand">Built with SEA-V</p>` : ""}
      </div>
    `;
  }

  function renderCvHtml(document) {
    if (document?.template === "classic") return renderClassic(document);
    if (document?.template === "compact") return renderCompact(document);
    return renderSeav(document);
  }

  window.SeavCvRender = {
    renderBrandMark,
    renderPhoto,
    renderSeavSidebarBlock,
    renderSeavContact,
    renderSeavNationality,
    renderSeavExperience,
    renderSeavReferences,
    renderSeav,
    renderClassic,
    renderCompact,
    renderCvHtml
  };
})();