// /js/seav-qualities.js
// Qualities that cross over to yachting (v572, Jack 2026-10-05: "skills and
// qualities that would cross over with yachting skills and qualities, like
// working in a team, hard labour or long hours, heavy lifting").
//
// One component for the three places a crew member tags them — interests,
// specialist qualifications and land-based roles:
//   SeavQualities.mountPicker(el, selected)  -> chip toggles, max 4
//   SeavQualities.readPicker(el)              -> ["teamwork", ...]
//   SeavQualities.tagsHtml(values)            -> read-only chips
//   SeavQualities.summaryHtml(lists)          -> the "Qualities ×n" strip
// The list itself is SeavData.CREW_QUALITIES (fixed, so tags can be counted).
(function () {
  "use strict";

  const esc = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const data = () => window.SeavData || {};

  function mountPicker(el, selected = []) {
    if (!el) return;
    const D = data();
    const chosen = new Set(D.normalizeQualities ? D.normalizeQualities(selected) : []);
    const max = D.MAX_QUALITIES || 4;
    el.classList.add("seav-quality-picker");
    el.setAttribute("role", "group");
    // v574: grouped under headings (Working style, Deck & practical...).
    const option = (item) => `
      <button type="button" class="seav-quality-option" data-quality="${esc(item.value)}"
        aria-pressed="${chosen.has(item.value) ? "true" : "false"}">${esc(item.label)}</button>`;
    const groups = D.CREW_QUALITY_GROUPS || [{ value: "", label: "" }];
    el.innerHTML = `
      ${groups
        .map((group) => {
          const items = (D.CREW_QUALITIES || []).filter((item) => !group.value || item.group === group.value);
          if (!items.length) return "";
          return `
            <div class="seav-quality-group">
              ${group.label ? `<small class="seav-quality-group-label">${esc(group.label)}</small>` : ""}
              <div class="seav-quality-options">${items.map(option).join("")}</div>
            </div>`;
        })
        .join("")}
      <small class="seav-quality-count" aria-live="polite"></small>
    `;
    updateCount(el, max);

    if (el.dataset.wired) return;
    el.dataset.wired = "1";
    el.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-quality]");
      if (!btn || !el.contains(btn)) return;
      const on = btn.getAttribute("aria-pressed") === "true";
      if (!on && readPicker(el).length >= max) {
        updateCount(el, max, true);
        return;
      }
      btn.setAttribute("aria-pressed", on ? "false" : "true");
      updateCount(el, max);
      // Lets forms that track "edited" (profile.js-style) notice a click.
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  function updateCount(el, max, full = false) {
    const count = readPicker(el).length;
    const note = el.querySelector(".seav-quality-count");
    if (note) {
      note.textContent = full
        ? `Up to ${max} — untick one to choose another.`
        : `${count} of ${max} chosen`;
      note.classList.toggle("is-full", full);
    }
    el.classList.toggle("is-at-max", count >= max);
  }

  function readPicker(el) {
    if (!el) return [];
    return [...el.querySelectorAll('[data-quality][aria-pressed="true"]')].map((btn) =>
      btn.getAttribute("data-quality")
    );
  }

  function tagsHtml(values, { className = "" } = {}) {
    const D = data();
    const list = D.normalizeQualities ? D.normalizeQualities(values) : [];
    if (!list.length) return "";
    return `<div class="seav-quality-tags ${esc(className)}">${list
      .map((value) => `<small class="seav-quality-tag">${esc(D.getQualityLabel(value))}</small>`)
      .join("")}</div>`;
  }

  // lists = { hobbiesInterests, specialistQualifications, landExperiences }
  function summaryHtml(lists, { title = "Skills & qualities", note = "" } = {}) {
    const D = data();
    const rows = D.collectCrewQualities ? D.collectCrewQualities(lists) : [];
    if (!rows.length) return "";
    return `
      <div class="seav-quality-summary">
        <div class="seav-quality-summary-head">
          <strong>${esc(title)}</strong>
          ${note ? `<small>${esc(note)}</small>` : ""}
        </div>
        <div class="seav-quality-tags">
          ${rows
            .map(
              (row) => `
                <small class="seav-quality-tag" title="${esc(
                  row.sources.map((s) => s.title).filter(Boolean).join(", ")
                )}">${esc(row.label)} <b>×${row.count}</b></small>`
            )
            .join("")}
        </div>
      </div>
    `;
  }

  // The strip on the interests / qualifications / land-based pages, from the
  // crew member's own records in SeavState. Hidden until something is tagged.
  function renderStateSummary(el) {
    if (!el) return;
    const S = window.SeavState || {};
    const html = summaryHtml(
      {
        hobbiesInterests: S.hobbiesInterests || [],
        specialistQualifications: S.specialistQualifications || [],
        landExperiences: S.landExperiences || []
      },
      { note: "Counted across your interests, qualifications and land-based roles" }
    );
    el.innerHTML = html;
    el.hidden = !html;
  }

  window.SeavQualities = { mountPicker, readPicker, tagsHtml, summaryHtml, renderStateSummary };
})();
