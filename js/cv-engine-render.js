// /js/cv-engine-render.js
(function () {
  "use strict";
  const M = window.SeavCvModel;
  if (!M) return;
  const {
    escapeHtml, formatCvDate, formatCvDateRange, formatYear, splitParagraphs, splitBullets,
    getVesselRole, getVesselType, formatVesselSize, formatVesselMeta, formatVesselSubline,
    formatProfileDob, getPhotoUrl, getCertDisplayName, splitProfileLines, LOGO_SRC
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

  function renderBullets(items) {
    if (!items.length) return "";
    return `<ul class="cv-seav-bullets">${items
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("")}</ul>`;
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

  function renderSeavNationality(profile) {
    const lines = [];
    if (profile.nationality) lines.push(profile.nationality);
    splitProfileLines(profile.passportsHeld).forEach((line) => lines.push(line));
    splitProfileLines(profile.visasHeld).forEach((line) => lines.push(line));
    if (!lines.length) return "";
    return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
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
            ${renderBullets(vessel.cvBullets)}
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

    const extracurricular =
      sections.showHighlights && doc.highlights.length
        ? `<p class="cv-seav-extra">${doc.highlights
            .map((line) => escapeHtml(line))
            .join("<br />")}</p>`
        : "";

    const dob = formatProfileDob(profile.dob);
    const salaryLine =
      sections.showSalary && profile.salary
        ? renderSeavSidebarBlock("Salary", `<p>${escapeHtml(profile.salary)}</p>`)
        : "";

    const sidebarHtml = [
      sections.showContact ? renderSeavSidebarBlock("Contact", renderSeavContact(profile)) : "",
      dob ? renderSeavSidebarBlock("Date of Birth", `<p>${escapeHtml(dob)}</p>`) : "",
      renderSeavSidebarBlock("Nationality & Visas", renderSeavNationality(profile)),
      profile.availability
        ? renderSeavSidebarBlock("Availability", `<p>${escapeHtml(profile.availability)}</p>`)
        : "",
      salaryLine,
      renderSeavSidebarBlock("Yacht Qualifications", certList),
      renderSeavSidebarBlock("Other Qualifications", specialistList),
      renderSeavSidebarBlock("Extracurricular", extracurricular)
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

  function renderCvHtml(document) {
    return renderSeav(document);
  }

  window.SeavCvEngine = {
    CV_TEMPLATE,
    buildCvSource,
    getVesselExperience,
    getVesselRole,
    buildAutoBullets,
    buildAutoSummary,
    buildAutoHeadline,
    createDefaultDraft,
    syncDraftWithSource,
    loadDraft,
    saveDraft,
    resetDraftFromSource,
    buildCvDocument,
    renderCvHtml,
    getDefaultSections,
    formatCvDateRange
  };

  window.SeavCvRender = { renderBrandMark, renderPhoto, renderBullets, renderSeavSidebarBlock,
    renderSeavContact, renderSeavNationality, renderSeavExperience, renderSeavReferences,
    renderSeav, renderCvHtml };
})();