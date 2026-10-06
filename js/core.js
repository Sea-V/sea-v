// /js/core.js
(function () {
  "use strict";

  /* =========================================================
     VERCEL WEB ANALYTICS
  ========================================================= */

  if (!document.querySelector('script[src="/_vercel/insights/script.js"]')) {
    window.va = window.va || function () {
      (window.vaq = window.vaq || []).push(arguments);
    };
    const analyticsScript = document.createElement("script");
    analyticsScript.defer = true;
    analyticsScript.src = "/_vercel/insights/script.js";
    document.head.appendChild(analyticsScript);
  }

  /* =========================================================
     UTILITIES
  ========================================================= */

  // Per-file cap (Supabase free tier allows up to 50 MB per object).
  const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /** Alias for templates — always escape user-controlled text. */
  function text(str) {
    return escapeHtml(str);
  }

  function seavAction(type, label, attrs = "") {
    const actionType = ["edit", "delete", "secondary"].includes(type) ? type : "secondary";
    return `<a href="#" class="seav-action seav-action--${actionType}" ${attrs}>${escapeHtml(label)}</a>`;
  }

  function seavActions(content, modifier = "") {
    const extra = modifier ? ` ${modifier}` : "";
    return `<div class="seav-actions${extra}">${content}</div>`;
  }

  function confirmDelete(options = {}) {
    const itemName = String(options.itemName || "").trim();
    const itemLabel = String(options.itemLabel || "entry").trim();

    const message = itemName
      ? `Are you sure you want to delete "${itemName}"?\n\nThis cannot be undone.`
      : options.message ||
        `Are you sure you want to delete this ${itemLabel}?\n\nThis cannot be undone.`;

    return window.confirm(message);
  }

  const DATE_YEAR_MIN = 1950;
  const DATE_YEAR_FUTURE = 15;

  function getCurrentYear() {
    return new Date().getFullYear();
  }

  // Plain chronological order (oldest at top, newest at bottom) — scrolling
  // up in the list means further into the past, scrolling down means further
  // into the future, matching how every other date picker on the web orders
  // years. This used to list the current year first, then jump up through
  // future years, then jump back down through past years, which read as a
  // random shuffle rather than a year list.
  function buildYearOptionsHtml() {
    const now = getCurrentYear();
    const options = ['<option value="">Year</option>'];

    for (let year = DATE_YEAR_MIN; year <= now + DATE_YEAR_FUTURE; year += 1) {
      options.push(`<option value="${year}">${year}</option>`);
    }

    return options.join("");
  }

  function ensureYearSelectOption(yearEl, year) {
    if (!yearEl || yearEl.tagName !== "SELECT") return;

    const value = String(year ?? "").trim();
    if (!value || !/^\d{4}$/.test(value)) return;

    const exists = Array.from(yearEl.options).some((option) => option.value === value);
    if (exists) return;

    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    yearEl.appendChild(option);
  }

  const DATE_MONTHS = [
    ["01", "January"],
    ["02", "February"],
    ["03", "March"],
    ["04", "April"],
    ["05", "May"],
    ["06", "June"],
    ["07", "July"],
    ["08", "August"],
    ["09", "September"],
    ["10", "October"],
    ["11", "November"],
    ["12", "December"]
  ];

  function splitIsoDate(isoDate) {
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      return { year: "", month: "", day: "" };
    }

    const [year, month, day] = isoDate.split("-");
    return { year, month, day };
  }

  function buildIsoDate(year, month, day) {
    const y = String(year ?? "").trim();
    const m = String(month ?? "").trim();
    const d = String(day ?? "").trim();

    if (!y || !m || !d) return "";
    if (!/^\d{4}$/.test(y) || !/^\d{2}$/.test(m) || !/^\d{2}$/.test(d)) return "";

    return `${y}-${m}-${d}`;
  }

  function setDateTriplet(prefix, isoDate) {
    const parts = splitIsoDate(isoDate);
    const yearEl = document.getElementById(`${prefix}_year`);
    const monthEl = document.getElementById(`${prefix}_month`);
    const dayEl = document.getElementById(`${prefix}_day`);

    if (yearEl) {
      ensureYearSelectOption(yearEl, parts.year);
      yearEl.value = parts.year;
    }
    if (monthEl) monthEl.value = parts.month;
    if (dayEl) dayEl.value = parts.day;
  }

  function readDateTriplet(prefix) {
    return buildIsoDate(
      document.getElementById(`${prefix}_year`)?.value,
      document.getElementById(`${prefix}_month`)?.value,
      document.getElementById(`${prefix}_day`)?.value
    );
  }

  function clearDateTriplet(prefix, { anchorYear = true } = {}) {
    setDateTriplet(prefix, "");

    // Anchor the year select on the current year instead of leaving it
    // blank. The list runs oldest (1950) at top through to the
    // furthest-future year at the bottom, so with nothing selected the
    // browser opens the dropdown at 1950 every time — every fresh date
    // field looks identical until you scroll ~75 rows down. Prefilling
    // just the year means it opens already sitting on "now", with past
    // years above and future years below, and day/month stay blank so
    // the field still isn't a complete date until those are chosen too.
    //
    // { anchorYear: false } skips the anchor, leaving the year blank.
    //
    // Added 2026-08-05 for the certificate expiry field, on the reasoning that
    // a genuinely-optional date (many certs never expire) shouldn't look
    // part-completed, and that a pre-set year risked a crew member creating an
    // expiry date just by picking day+month. REVERTED 2026-09-20, per Jack: a
    // blank year makes the browser open the dropdown at the TOP of the list,
    // so certificate expiry was the only date field on the site starting at
    // 1950, ~75 rows from "now". The scrolling cost beat the accidental-expiry
    // risk.
    //
    // NOTHING PASSES THIS TODAY — every date field anchors on the current
    // year. Kept because the option is sound for some future optional date,
    // but do not re-apply it to certificate expiry without asking: that round
    // trip is exactly what this note exists to prevent.
    if (!anchorYear) return;

    const yearEl = document.getElementById(`${prefix}_year`);
    if (yearEl) yearEl.value = String(getCurrentYear());
  }

  // Filling a form from a SAVED record: the saved date, or — when that date
  // was never entered — the same current-year anchor as a fresh field
  // (v575, Jack: editing a passage with no date "starts back at year and
  // goes from 1950"). setDateTriplet(prefix, "") still blanks everything,
  // which the certificate "does not expire" tickbox relies on.
  function fillDateTriplet(prefix, isoDate) {
    if (isoDate) setDateTriplet(prefix, isoDate);
    else clearDateTriplet(prefix);
  }

  function populateDatePartSelects(root = document) {
    root.querySelectorAll('select[data-date-part="year"]').forEach((select) => {
      if (select.dataset.datePopulated === "true") return;

      select.innerHTML = buildYearOptionsHtml();
      select.dataset.datePopulated = "true";
    });

    root.querySelectorAll('select[data-date-part="month"]').forEach((select) => {
      if (select.dataset.datePopulated === "true") return;

      select.innerHTML = `<option value="">Month</option>${DATE_MONTHS.map(
        ([value, label]) => `<option value="${value}">${label}</option>`
      ).join("")}`;
      select.dataset.datePopulated = "true";
    });

    root.querySelectorAll('select[data-date-part="day"]').forEach((select) => {
      if (select.dataset.datePopulated === "true") return;

      const dayOptions = ['<option value="">Day</option>'];
      for (let day = 1; day <= 31; day += 1) {
        const value = String(day).padStart(2, "0");
        dayOptions.push(`<option value="${value}">${value}</option>`);
      }

      select.innerHTML = dayOptions.join("");
      select.dataset.datePopulated = "true";
    });
  }

  function renderDateTripletMarkup(prefix, label, options = {}) {
    const requiredAttr = options.required ? "required" : "";
    const optionalSuffix = options.optional ? " (optional)" : "";

    return `
      <div class="modal-date-group">
        <span class="modal-date-label">${escapeHtml(label)}${optionalSuffix}</span>
        <div class="modal-date-row">
          <div class="modal-date-field">
            <span class="modal-date-field-label">Year</span>
            <select id="${escapeHtml(prefix)}_year" data-date-part="year" ${requiredAttr}></select>
          </div>
          <div class="modal-date-field">
            <span class="modal-date-field-label">Month</span>
            <select id="${escapeHtml(prefix)}_month" data-date-part="month" ${requiredAttr}></select>
          </div>
          <div class="modal-date-field">
            <span class="modal-date-field-label">Day</span>
            <select id="${escapeHtml(prefix)}_day" data-date-part="day" ${requiredAttr}></select>
          </div>
        </div>
      </div>
    `;
  }

  function mountDateFields(root = document) {
    root.querySelectorAll("[data-date-field]").forEach((mount) => {
      const prefix = mount.getAttribute("data-date-field");
      if (!prefix) return;

      const label = mount.getAttribute("data-date-label") || "Date";
      const required = mount.hasAttribute("data-date-required");
      const optional = mount.hasAttribute("data-date-optional");

      mount.outerHTML = renderDateTripletMarkup(prefix, label, { required, optional });
    });

    populateDatePartSelects(root);
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function buildStoredFile(file, options = {}) {
    const {
      maxBytes = MAX_UPLOAD_BYTES,
      fallback = null,
      kind = "file"
    } = options;

    if (!file) return fallback;

    if (file.size > maxBytes) {
      const msg = `${kind} too large. Please upload a file under ${Math.round(maxBytes / (1024 * 1024))}MB.`;
      if (window.SeavFeedback?.error) {
        window.SeavFeedback.error("File too large", msg);
      } else {
        alert(msg);
      }
      return null;
    }

    const allowDataUrl = window.SeavConfig?.ALLOW_DATAURL_FALLBACK === true;
    if (!allowDataUrl) {
      const msg = `${kind} upload requires a signed-in connection. Check your network and try again.`;
      if (window.SeavFeedback?.error) {
        window.SeavFeedback.error("Upload unavailable", msg);
      } else {
        alert(msg);
      }
      return fallback;
    }

    return {
      filename: file.name,
      mime: file.type || "application/octet-stream",
      size: file.size,
      storedAt: new Date().toISOString(),
      dataUrl: await readFileAsDataURL(file)
    };
  }

const app = {
  async refreshAll() {
    if (window.SeavState?.refresh) {
      await window.SeavState.refresh();
    }

    if (window.SeavAchievementEngine?.runAchievementEvaluation) {
      await window.SeavAchievementEngine.runAchievementEvaluation();
    }

    if (window.SeavDashboard?.refresh) {
      window.SeavDashboard.refresh();
    }
  },
};

  /* =========================================================
     SHARED LAYOUT TEMPLATES
  ========================================================= */

  function renderPublicTopbar(active = "") {
    return `
      <header class="topbar public-topbar">
        <div class="topbar-inner">
          <nav class="nav-left">
            <a href="index.html" ${active === "home" ? 'class="active"' : ""}>Home</a>
            <a href="contact.html" ${active === "contact" ? 'class="active"' : ""}>Contact</a>
            <a href="about.html" ${active === "about" ? 'class="active"' : ""}>About</a>
          </nav>

          <a class="brand" href="index.html">
            <img
              src="img/logo.png?v=10"
              class="seav-logo seav-logo--topbar"
              alt="SEA-V"
              width="34"
              height="34"
            />
          </a>

          <div class="nav-right">
            <a class="login" href="index.html">Login</a>
          </div>
        </div>
      </header>
    `;
  }

  function renderAppTopbar() {
    return `
      <header class="topbar app-topbar">
        <div class="topbar-inner">
          <nav class="nav-left" aria-label="Quick links">
            <button
              type="button"
              class="topbar-icon-btn topbar-menu-btn"
              id="topbarMenuBtn"
              aria-haspopup="true"
              aria-expanded="false"
              aria-controls="topbarMenuPanel"
              aria-label="Open menu"
              title="Menu"
            >
              <svg class="topbar-menu-bars" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <svg class="topbar-menu-close" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
            <a href="#" class="topbar-quick-link" data-open="contactInfoModal">Contact</a>
            <a href="#" class="topbar-quick-link" data-open="aboutInfoModal">About</a>
            <a href="#" class="topbar-quick-link" data-open="reportIssueModal">Report an issue</a>
            <div class="topbar-menu" id="topbarMenuPanel" hidden>
              ${renderAppNav()}
            </div>
          </nav>

          <a class="brand" href="dashboard.html">
            <img
              src="img/logo.png?v=10"
              class="seav-logo seav-logo--topbar"
              alt="SEA-V"
              width="34"
              height="34"
            />
          </a>

          <div class="nav-right">
            <button
              type="button"
              class="topbar-search"
              id="topbarSearchBtn"
              aria-haspopup="dialog"
              aria-label="Search (Ctrl or Command + K)"
              title="Search (⌘K)"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="2"/>
                <path d="M16 16l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <small class="topbar-search-label">Search</small>
              <kbd class="topbar-search-kbd" aria-hidden="true">⌘K</kbd>
            </button>

            <div class="notif-bell-wrap">
              <button
                type="button"
                class="icon notif-bell-btn"
                id="notifBellBtn"
                aria-label="Notifications"
                aria-haspopup="true"
                aria-expanded="false"
                title="Notifications"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3.5c-2.6 0-4.5 2-4.5 4.6v2.4c0 .7-.25 1.4-.7 2l-1.1 1.4c-.5.6-.05 1.6.75 1.6h11c.8 0 1.25-1 .75-1.6l-1.1-1.4c-.45-.6-.7-1.3-.7-2V8.1c0-2.6-1.9-4.6-4.5-4.6Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
                  <path d="M10 18.5a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                </svg>
                <span class="notif-bell-count" id="notifBellCount" hidden>0</span>
              </button>

              <div class="notif-bell-panel" id="notifBellPanel" hidden>
                <div class="notif-bell-panel-head">Notifications</div>
                <div class="notif-bell-panel-list" id="notifBellPanelList"></div>
              </div>
            </div>

            <div class="topbar-account">
              <button
                type="button"
                class="topbar-profile"
                id="topbarProfileLink"
                aria-haspopup="true"
                aria-expanded="false"
                aria-controls="topbarAccountPanel"
                aria-label="Account menu"
                title="Account menu"
              >
                <span class="topbar-profile-avatar" id="topbarProfileAvatar" aria-hidden="true"></span>
              </button>
              <div class="topbar-account-menu" id="topbarAccountPanel" hidden>
                ${renderAccountMenu()}
              </div>
            </div>
          </div>
        </div>
      </header>
    `;
  }

  function renderSidebarLink(href, label, iconSvg, options = {}) {
    const target = options.newTab ? ' target="_blank" rel="noopener"' : "";
    const idAttr = options.id ? ` id="${options.id}"` : "";

    if (options.disabled) {
      // Not-yet-built page: render as a non-navigating span so it can't be
      // clicked/tabbed into like a real link, but keeps the same visual
      // slot in the list so it reads as "on the roadmap" rather than missing.
      return `
        <span class="dash-link dash-link--disabled" aria-disabled="true" title="Coming soon"${idAttr}>
          <span class="dash-icon" aria-hidden="true">${iconSvg}</span>
          <span>${label} <span class="dash-link-soon">(Coming Soon)</span></span>
        </span>
      `;
    }

    return `
      <a class="dash-link" href="${href}"${idAttr}${target}>
        <span class="dash-icon" aria-hidden="true">${iconSvg}</span>
        <span>${label}</span>
      </a>
    `;
  }

  function renderSidebarGroup(label, linksHtml, extraClass = "") {
    const labelHtml = label ? `<p class="dash-nav-group-label">${label}</p>` : "";
    const bareClass = label ? "" : " dash-nav-group--bare";
    return `
      <div class="dash-nav-group${bareClass}${extraClass ? ` ${extraClass}` : ""}">
        ${labelHtml}
        ${linksHtml}
      </div>
    `;
  }

  const iconDashboard = `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8"/><path d="M12 8.5l2.8 2.8-4.2 4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const iconProfile = `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.2" stroke="currentColor" stroke-width="1.8"/><path d="M6.5 18.5c1.4-2.7 3.4-4 5.5-4s4.1 1.3 5.5 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  const iconCv = `<svg viewBox="0 0 24 24" fill="none"><rect x="6" y="4" width="12" height="16" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M9 8h6M9 11h6M9 14h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  const iconVessels = `<svg viewBox="0 0 24 24" fill="none"><path d="M6 14.5h12l-1.8-4.5H9.5L6 14.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 18c1.3-1 2.7-1 4 0s2.7 1 4 0 2.7-1 4 0 2.7 1 4 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  const iconSeatime = `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="11" r="4.5" stroke="currentColor" stroke-width="1.8"/><path d="M12 11V8.8M12 11l2 1.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 18c1.3-1 2.7-1 4 0s2.7 1 4 0 2.7-1 4 0 2.7 1 4 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  const iconTenders = `<svg viewBox="0 0 24 24" fill="none"><path d="M7 14.5h10l-1.2-2.8H9L7 14.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 18c1.2-.9 2.4-.9 3.6 0 1.2.9 2.4.9 3.6 0 1.2-.9 2.4-.9 3.6 0 1.2.9 2.4.9 3.6 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  const iconNavigation = `<svg viewBox="0 0 24 24" fill="none"><path d="M6 18l4-12 8 8-12 4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 10l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  const iconOnboard = `<svg viewBox="0 0 24 24" fill="none"><path d="M4 18c1.3-1 2.7-1 4 0s2.7 1 4 0 2.7-1 4 0 2.7 1 4 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8 14.5h8l-1.6-4H9.6L8 14.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 6v3M10 8h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  const iconAchievements = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 4.8l1.9 3.8 4.2.6-3 3 .7 4.2L12 14.8 8.2 16.4l.7-4.2-3-3 4.2-.6L12 4.8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
  const iconCertificates = `<svg viewBox="0 0 24 24" fill="none"><rect x="6.5" y="4.5" width="11" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M9 8h6M9 11h6M10 18.5l2-1.2 2 1.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const iconSpecialist = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l2.2 4.5 5 .7-3.6 3.5.9 5.2L12 14.8 7.5 17l.9-5.2L4.8 8.2l5-.7L12 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 19.5h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  const iconReferences = `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8"/><path d="M8.7 12.2l2.1 2.1 4.5-4.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const iconHobbies = `<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="6.5" width="16" height="12" rx="2.2" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12.5" r="3.2" stroke="currentColor" stroke-width="1.8"/><path d="M9 6.5l1.1-2.2h3.8L15 6.5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
  const iconPayslips = `<svg viewBox="0 0 24 24" fill="none"><circle cx="8.5" cy="15" r="3.8" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="11.5" r="3.8" stroke="currentColor" stroke-width="1.8"/><circle cx="15.5" cy="8" r="3.8" stroke="currentColor" stroke-width="1.8"/><path d="M15.5 6.6v2.8M14.2 8h2.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  const iconPublicProfile = `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8"/><path d="M4 12h16M12 4c2.2 2.8 3.2 5.7 3.2 8s-1 5.2-3.2 8M12 4c-2.2 2.8-3.2 5.7-3.2 8s1 5.2 3.2 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  const iconLandExperience = `<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="9.5" width="14" height="9" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M9 9.5V7.3A1.8 1.8 0 0 1 10.8 5.5h2.4A1.8 1.8 0 0 1 15 7.3v2.2" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M5 13.5h14" stroke="currentColor" stroke-width="1.8"/></svg>`;
  const iconLogout = `<svg viewBox="0 0 24 24" fill="none"><path d="M10 6H7.5A1.5 1.5 0 0 0 6 7.5v9A1.5 1.5 0 0 0 7.5 18H10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M13 8.5 16.5 12 13 15.5M9.5 12h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  // Reuse the same sidebar-nav icon set elsewhere on the site (e.g. the
  // public profile section headings) instead of duplicating SVG markup.
  window.SeavIcons = {
    dashboard: iconDashboard,
    profile: iconProfile,
    cv: iconCv,
    vessels: iconVessels,
    seatime: iconSeatime,
    tenders: iconTenders,
    navigation: iconNavigation,
    onboard: iconOnboard,
    achievements: iconAchievements,
    certificates: iconCertificates,
    specialist: iconSpecialist,
    references: iconReferences,
    hobbies: iconHobbies,
    payslips: iconPayslips,
    publicProfile: iconPublicProfile,
    landExperience: iconLandExperience
  };

/* v565 (Jack, 2026-10-03): no sidebar. Every section drops down from the
   topbar's three-bar button as ONE column (renderAppNav), and the account
   items (public profile, CV generator, settings, log out) drop down from the
   photo on the right (renderAccountMenu). The groups and links are the
   sidebar's, unchanged, so the active-page highlight, the Milestones id and
   the "Coming soon" item all carry over. Privacy / Terms (the old sidebar
   footer) and Contact / About / Report (hidden from the phone topbar) sit
   in the menu's footer. */
function renderAppNav() {
  return `
    <nav class="dash-nav topbar-menu-nav" aria-label="Main">
      ${renderSidebarGroup(
        "",
        [
          renderSidebarLink("dashboard.html", "Dashboard", iconDashboard),
          renderSidebarLink("profile.html", "Profile", iconProfile)
        ].join("")
      )}
      ${renderSidebarGroup(
        "Career",
        [
          renderSidebarLink("vessels.html", "Vessels", iconVessels),
          renderSidebarLink("seatime.html", "Sea Time", iconSeatime),
          renderSidebarLink("navigation.html", "Navigation", iconNavigation)
        ].join("")
      )}
      ${renderSidebarGroup(
        "Operations &amp; training",
        [
          renderSidebarLink("tenders.html", "Tenders", iconTenders),
          renderSidebarLink("onboard-experience.html", "Onboard Experience", iconOnboard),
          renderSidebarLink("specialist-qualifications.html", "Specialist Qualifications", iconSpecialist)
        ].join("")
      )}
      ${renderSidebarGroup(
        "Documentation",
        [
          renderSidebarLink("certificates.html", "Certificates", iconCertificates),
          renderSidebarLink("references.html", "References", iconReferences),
          renderSidebarLink("payslips.html", "Payslips", iconPayslips)
        ].join("")
      )}
      ${renderSidebarGroup(
        "Highlights",
        [
          renderSidebarLink("land-experience.html", "Land-Based Experience", iconLandExperience),
          renderSidebarLink("achievements.html", "Milestones", iconAchievements, {
            id: "sidebarAchievementsLink"
          }),
          renderSidebarLink("hobbies-interests.html", "Hobbies &amp; Interests", iconHobbies)
        ].join("")
      )}
    </nav>
    <div class="topbar-menu-foot">
      <a href="#" class="topbar-menu-foot-dup" data-open="contactInfoModal">Contact</a>
      <a href="#" class="topbar-menu-foot-dup" data-open="aboutInfoModal">About</a>
      <a href="#" class="topbar-menu-foot-dup" data-open="reportIssueModal">Report an issue</a>
      <a href="privacy.html">Privacy</a>
      <a href="terms.html">Terms</a>
    </div>
  `;
}

function renderAccountMenu() {
  const item = (href, label, sub, icon, options = {}) => `
    <a class="topbar-account-item${options.danger ? " is-danger" : ""}" href="${href}"${
      options.id ? ` id="${options.id}"` : ""
    }${options.newTab ? ' target="_blank" rel="noopener"' : ""}>
      <span class="topbar-account-icon" aria-hidden="true">${icon}</span>
      <span class="topbar-account-text">
        <strong>${label}</strong>
        ${sub ? `<small${options.subId ? ` id="${options.subId}"` : ""}>${sub}</small>` : ""}
      </span>
    </a>`;
  return `
    <div class="topbar-account-head">
      <span class="topbar-account-avatar" id="topbarAccountAvatar" aria-hidden="true"></span>
      <span class="topbar-account-text">
        <strong id="topbarAccountName">Your account</strong>
        <small id="topbarAccountRole"></small>
      </span>
    </div>
    ${item("public-profile.html", "Your public profile", "See it as employers do", iconPublicProfile, {
      id: "sidebarPublicProfileLink",
      newTab: true,
      subId: "topbarAccountPublicUrl"
    })}
    ${item("cv-generator.html", "CV generator", "Build, tailor and export your CV", iconCv)}
    ${item("profile.html", "Profile settings", "Personal details, photo, privacy", iconProfile)}
    <div class="topbar-account-sep" role="separator"></div>
    ${item("index.html", "Log out", "", iconLogout, { id: "btnLogout", danger: true })}
  `;
}

function groupSidebarAchievements(records) {
  const groups = new Map();

  // Cross-check against the live badge catalog, same as the private
  // Milestones page (js/achievements.js groupEarnedByCode) and the public
  // profile (js/public-profile-sections.js renderAchievements) — a crew
  // member's older records can still reference a badge code that was later
  // pruned from js/seav-badges.js (see
  // project_seav_badges_pruned_to_real_milestones). Without this check
  // those pruned badges rendered here as a generic "SEA-V / CREW BADGE"
  // placeholder instead of disappearing like they do everywhere else.
  //
  // 2026-08-05, per Jack: this list is now Seafarer Awards ONLY (manually
  // logged career moments — crossings etc). Earned Deck Progression badges
  // used to show here too, but Jack wants the Milestones widget to show
  // only what's currently in progress (see renderDashboardInProgress below)
  // plus these — showing an already-earned Deck Progression badge here as
  // well would just repeat what the in-progress list already summarized.
  records.forEach((item) => {
    if (!item || item.status === "Declined" || !item.code) return;
    const definition = window.SeavBadges?.getAchievement?.(item.code);
    if (!definition || definition.approvalRequired !== true) return;
    const key = item.code;
    groups.set(key, [...(groups.get(key) || []), item]);
  });

  return [...groups.values()].map((instances) => {
    const sorted = [...instances].sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(0);
      const db = b.date ? new Date(b.date) : new Date(0);
      return db - da;
    });
    return sorted;
  });
}

// Bigger "progress row" cards — same component the private Milestones page
// uses for Deck Progression (css/pages/achievements.css .ach-progress-row,
// already loaded globally via styles.css's @import) — instead of the old
// small hex-icon grid that only showed a title on hover (useless on mobile,
// no hover). Jack asked (2026-08-05) for badges "big enough to make a
// statement" that also show the progress bar, so this always renders a bar:
// 100% + an unlock summary for earned milestones, or the real in-progress
// percent (via achievements-engine.js) for anything not yet earned.
// 2026-08-22, per Jack: Seafarer Awards on the dashboard are the same card as
// on Milestones now, in a grid — they were full-width rows "taking the entire
// row up for no reason", each carrying a progress bar hardcoded to 100% that
// could never say anything.
//
// The markup comes from SeavCards.buildAwardTile (js/seav-cards.js), shared
// with the public profile, so one award looks like itself everywhere. The
// in-progress rows above (renderDashboardInProgress) are untouched and keep
// their bars — those are genuinely partial.
function buildDashboardMilestoneRow(instances) {
  return window.SeavCards?.buildAwardTile?.(instances[0], instances) || "";
}

function renderDashboardInProgress() {
  const mount = document.getElementById("dashNextMilestone");
  if (!mount) return;

  const inProgress = window.SeavAchievementEngine?.getInProgressMilestones?.() || [];
  if (!inProgress.length) {
    mount.hidden = true;
    mount.innerHTML = "";
    return;
  }

  mount.hidden = false;
  mount.innerHTML = inProgress
    .map((entry) => {
      const imagePath = window.SeavBadges.resolveBadgeImage(entry.full.badgeKey, false);
      return `
        <div class="ach-next-milestone">
          <div class="ach-next-badge">
            <img src="${window.Seav.escapeHtml(imagePath)}" alt="" />
          </div>
          <div class="ach-next-copy">
            <span class="ach-next-label">In progress</span>
            <strong>${window.Seav.escapeHtml(entry.certGroupKey)}</strong>
            <span class="ach-next-progress-label">${window.Seav.escapeHtml(entry.label || "")}</span>
            <div class="ach-progress-bar" role="progressbar" aria-valuenow="${entry.percent}" aria-valuemin="0" aria-valuemax="100">
              <span style="width: ${entry.percent}%"></span>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderSidebarAchievements() {
  const container = document.getElementById("sidebarAchievements");
  if (!container) return;

  renderDashboardInProgress();

  const grouped = groupSidebarAchievements(window.SeavState?.achievements || []);

  if (!grouped.length) {
    container.innerHTML = `<div class="sidebar-badge-empty">No Seafarer Achievements logged yet</div>`;
    return;
  }

  container.innerHTML = grouped.map(buildDashboardMilestoneRow).filter(Boolean).join("");
}

  function renderSharedModals() {
    return `
      <div class="modal-overlay" id="modalOverlay" hidden></div>

      <div class="modal" id="contactInfoModal" hidden>
        <div class="modal-card modal-card--blue">
          <div class="modal-head">
            <div class="modal-head-titles">
              <h3>Contact SEA-V</h3>
              <small>Questions, feedback or partnerships</small>
            </div>
            <button type="button" class="modal-x" data-close aria-label="Close">&times;</button>
          </div>

          <div class="modal-form">
            <p class="modal-intro">
              Product feedback, support, partnerships, or early access requests — we’d love to hear from you.
            </p>

            <a class="modal-info-box modal-info-box--link" href="mailto:admin@sea-v.com">
              <span class="modal-info-label">Email</span>
              <span class="modal-info-value">admin@sea-v.com</span>
            </a>

            <p class="modal-note">
              Something not working? <a href="#" data-open="reportIssueModal">Report an issue</a> — it goes straight to the SEA-V team.
            </p>

            <div class="dash-actions">
              <a class="btn-ghost2" href="contact.html" target="_blank" rel="noopener">Full contact page</a>
              <a class="btn-blue" href="mailto:admin@sea-v.com">Email us</a>
            </div>
          </div>
        </div>
      </div>

      <div class="modal" id="aboutInfoModal" hidden>
        <div class="modal-card modal-card--blue">
          <div class="modal-head">
            <div class="modal-head-titles">
              <h3>About SEA-V</h3>
              <small>Your yachting career, in one place</small>
            </div>
            <button type="button" class="modal-x" data-close aria-label="Close">&times;</button>
          </div>

          <div class="modal-form">
            <div class="modal-points">
              <div class="modal-point">
                <span class="modal-point-icon" aria-hidden="true">${iconSeatime}</span>
                <span class="modal-point-text">
                  <strong>Log it once</strong>
                  <small>Sea time, certificates, vessels and passages — with MCA progress worked out for you.</small>
                </span>
              </div>
              <div class="modal-point">
                <span class="modal-point-icon" aria-hidden="true">${iconCv}</span>
                <span class="modal-point-text">
                  <strong>A CV in minutes</strong>
                  <small>Built from your records. Tick what shows, then download it.</small>
                </span>
              </div>
              <div class="modal-point">
                <span class="modal-point-icon" aria-hidden="true">${iconReferences}</span>
                <span class="modal-point-text">
                  <strong>Verified, not just claimed</strong>
                  <small>References confirmed by the people who wrote them, and a public profile you control.</small>
                </span>
              </div>
            </div>

            <p class="modal-note">Free for crew, always · <a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a></p>

            <div class="dash-actions">
              <a class="btn-ghost2" href="#" data-open="contactInfoModal">Get in touch</a>
              <a class="btn-blue" href="about.html" target="_blank" rel="noopener">Read the full story</a>
            </div>
          </div>
        </div>
      </div>

      <div class="modal" id="reportIssueModal" hidden>
        <div class="modal-card modal-card--blue">
          <div class="modal-head">
            <div class="modal-head-titles">
              <h3>Report an issue</h3>
              <small>Goes straight to the SEA-V team</small>
            </div>
            <button type="button" class="modal-x" data-close aria-label="Close">&times;</button>
          </div>

          <form class="modal-form" id="reportIssueForm">
            <p class="modal-intro">
              Spotted a bug, missing a feature, or have an idea? This goes straight to the SEA-V team — no email needed.
            </p>

            <label>
              What's this about?
              <select id="ri_category" required>
                <option value="bug">Something's broken</option>
                <option value="missing">Something's missing</option>
                <option value="suggestion">Suggestion / idea</option>
              </select>
            </label>

            <label>
              Tell us more
              <textarea id="ri_message" rows="4" required placeholder="What happened, or what would you like to see?"></textarea>
            </label>

            <button class="btn-blue" type="submit">Send report</button>

            <p class="modal-footnote">
              We'll capture which page you're on automatically. This isn't a live chat — we won't reply here, but we do read every one.
            </p>
          </form>
        </div>
      </div>
    `;
  }

  /* =========================================================
     LAYOUT MOUNTING
  ========================================================= */

  function mountSharedLayout() {
    const topbarMount = document.getElementById("topbarMount");
    const sidebarMount = document.getElementById("sidebarMount");
    const sharedModalsMount = document.getElementById("sharedModalsMount");

    if (topbarMount) {
      const topbarType = document.body.dataset.topbar || "";
      const topbarActive = document.body.dataset.topbarActive || "";

      if (topbarType === "public") {
        topbarMount.innerHTML = renderPublicTopbar(topbarActive);
      } else if (topbarType === "app") {
        topbarMount.innerHTML = renderAppTopbar();
        wireTopbarProfile();
        wireTopbarSearch();
        wireTopbarMenus();
      }
    }

  if (sidebarMount) {
  const sidebarType = document.body.dataset.sidebar || "";

  if (sidebarType === "app") {
    // v565: no sidebar column — its sections live in the topbar Menu and
    // the account items in the photo menu (both rendered with the topbar).
    // These helpers now find their elements there.
    sidebarMount.hidden = true;

    renderSidebarAchievements();
    wireLogout();
    wireSidebarPublicProfile();

    document.addEventListener(
      "seav:state-ready",
      renderSidebarAchievements
    );

    document.addEventListener(
      "seav:data-updated",
      renderSidebarAchievements
    );
  }
}

    if (sharedModalsMount) {
      const useSharedModals = document.body.dataset.sharedModals || "";
      if (useSharedModals === "true") {
        sharedModalsMount.innerHTML = renderSharedModals();
      }
    }
  }

  // Small, unobtrusive build-version badge on every page (public and
  // logged-in) so it's possible to glance at a live page and confirm which
  // deploy is actually serving — no dev tools required. Reads
  // SeavConfig.ASSET_VERSION directly rather than duplicating the number
  // anywhere, so it can never drift out of sync with the real deployed
  // build. core.js runs on every page, so this needs no per-page HTML.
  function mountVersionBadge() {
    if (document.getElementById("seavVersionBadge")) return;

    const version = window.SeavConfig?.ASSET_VERSION;
    if (!version) return;

    const badge = document.createElement("div");
    badge.id = "seavVersionBadge";
    badge.className = "seav-version-badge";

    // <small>, not <span>: typography.css forces 14px !important on span,
    // which blew the 10px badge up to body size (v540).
    const versionLine = document.createElement("small");
    versionLine.className = "seav-version-badge-num";
    versionLine.textContent = `v${version}`;

    const copyrightLine = document.createElement("small");
    copyrightLine.className = "seav-version-badge-copyright";
    copyrightLine.textContent = `© ${new Date().getFullYear()} SEA-V`;

    badge.appendChild(versionLine);
    badge.appendChild(copyrightLine);
    document.body.appendChild(badge);
  }

  /* =========================================================
     SIDEBAR ACTIVE LINK
  ========================================================= */

  function setActiveSidebarLink() {
    // v565: the section links live in the topbar Menu now.
    const links = document.querySelectorAll(".topbar-menu .dash-link, .dash-sidebar .dash-link");
    const topbarLinks = document.querySelectorAll(".app-topbar .nav-left > a.topbar-quick-link[href]");
    if (!links.length && !topbarLinks.length) return;

    const currentFile = (location.pathname.split("/").pop() || "dashboard.html").toLowerCase();

    const hrefFile = (href) =>
      String(href || "")
        .split("#")[0]
        .split("?")[0]
        .split("/")
        .pop()
        .toLowerCase();

    links.forEach((a) => a.classList.remove("active"));
    topbarLinks.forEach((a) => a.classList.remove("active"));

    let matched = Array.from(links).find(
      (a) => hrefFile(a.getAttribute("href")) === currentFile
    );

    if (!matched) {
      matched =
        Array.from(links).find(
          (a) => hrefFile(a.getAttribute("href")) === "dashboard.html"
        ) || links[0];
    }

    if (matched) matched.classList.add("active");

    const matchedTopbar = Array.from(topbarLinks).find(
      (a) => hrefFile(a.getAttribute("href")) === currentFile
    );
    if (matchedTopbar) matchedTopbar.classList.add("active");
  }

  /**
   * Shared by the sidebar link (here) and the profile page's public-share
   * panel (js/profile.js resolvePublicShareUrl, moved from dashboard.js
   * 2026-08-08) so both always agree on the same URL shape. Prefers the
   * clean /u/<username> path (see the
   * netlify.toml/vercel.json rewrite to public-profile.html?u=<username>)
   * once a crew member has a username; falls back to the original
   * ?p=<uuid> link for profiles that don't have one yet.
   */
  function buildPublicProfileUrl(profile) {
    const username = String(profile?.username || "").trim();
    if (username) return `u/${encodeURIComponent(username)}`;

    const profileId = profile?.id || "";
    if (!profileId) return "public-profile.html";
    return `public-profile.html?p=${encodeURIComponent(profileId)}`;
  }

  function resolvePublicProfileUrl() {
    return buildPublicProfileUrl(window.SeavState?.profile);
  }

  /* Topbar profile chip — replaced the Instagram link (Jack, 2026-09-18).
     Reads window.SeavState.profile, the same source wireSidebarPublicProfile
     uses, so the topbar needs no data access of its own.

     Re-renders on BOTH events, and both matter:
       * seav:state-ready  — profile row arrives (name, photo path).
       * seav:data-updated — profile.photo starts life as a bare storage path
         and only becomes a signed URL after js/state.js's background file
         hydration, which dispatches this. Without it the chip would sit on
         the initials fallback for the whole session even for a crew member
         who has uploaded a photo.

     Falls back to initials in the same style as #refsList .ref-card-avatar.
     Since v556 the chip is the photo alone — the rank label beside it was
     removed at Jack's request. */
  function topbarProfileInitials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
    }
    return (parts[0]?.charAt(0) || "?").toUpperCase();
  }

  /* Topbar search (v556 pages, v558 records — Jack 2026-09-30). The Search
     button and Ctrl/⌘+K open a glass panel. With nothing typed it shows
     Recent (last opened results) and a hint of what it can find — NOT the
     page list (Jack, 2026-09-30: it only repeated the sidebar and pushed
     Recent down). Typing searches pages (a few, as a keyboard shortcut) AND
     the crew member's own records via js/seav-search.js (SeavSearch.find),
     grouped by type. A record result opens its page with ?focus=<id>, where
     seav-search.js scrolls to and rings that record. Pages are read from the
     rendered sidebar, so the list always matches the menu and skips "Coming
     soon" items (<span>s, not links). Built lazily on first open; every
     label goes in via textContent. */
  function wireTopbarSearch() {
    const button = document.getElementById("topbarSearchBtn");
    if (!button) return;

    const PAGE_LIMIT_WHEN_QUERY = 3;

    let root = null;
    let input = null;
    let list = null;
    let empty = null;
    let hint = null;
    let options = [];
    let optionEls = [];
    let active = 0;
    let lastFocus = null;

    const readPages = () => {
      const seen = new Set();
      return [...document.querySelectorAll("#sidebarMount a.dash-link[href]")]
        .filter((a) => !a.classList.contains("dash-logout"))
        .map((a) => {
          const icon = a.querySelector(".dash-icon");
          return {
            title: (a.querySelector("span:last-child")?.textContent || a.textContent).trim(),
            sub: "",
            href: a.getAttribute("href"),
            newTab: a.target === "_blank",
            iconHtml: icon ? icon.innerHTML : "",
            // Each sidebar icon is tinted by page CSS; carry the computed
            // colour so the panel shows the same accent.
            accent: icon ? window.getComputedStyle(icon).color : ""
          };
        })
        .filter((page) => {
          if (!page.title || seen.has(page.href)) return false;
          seen.add(page.href);
          return true;
        });
    };

    const setActive = (index) => {
      if (!optionEls.length) return;
      active = (index + optionEls.length) % optionEls.length;
      optionEls.forEach((li, i) => li.setAttribute("aria-selected", i === active ? "true" : "false"));
      const current = optionEls[active];
      input.setAttribute("aria-activedescendant", current.id);
      current.scrollIntoView({ block: "nearest" });
    };

    const buildSections = () => {
      const raw = input.value.trim();
      const query = raw.toLowerCase();
      const search = window.SeavSearch;
      const pages = readPages();

      if (!query) {
        const recent = search?.recent?.() || [];
        return recent.length ? [{ label: "Recent", items: recent }] : [];
      }

      const sections = [];
      const pageHits = pages
        .filter((p) => p.title.toLowerCase().includes(query))
        .slice(0, PAGE_LIMIT_WHEN_QUERY);
      if (pageHits.length) sections.push({ label: "Pages", items: pageHits });
      (search?.find?.(raw) || []).forEach((group) => {
        sections.push({ label: group.group, items: group.items });
      });
      return sections;
    };

    const buildRow = (item, index) => {
      const li = document.createElement("li");
      li.id = `seavSearchOption${index}`;
      li.setAttribute("role", "option");
      const link = document.createElement("a");
      link.href = item.href;
      link.tabIndex = -1;
      if (item.newTab) {
        link.target = "_blank";
        link.rel = "noopener";
      }
      const icon = document.createElement("span");
      icon.className = "seav-search-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = item.iconHtml || ""; // our own sidebar/SeavIcons SVG, not data
      if (item.accent) icon.style.setProperty("--seav-search-accent", item.accent);
      const words = document.createElement("span");
      words.className = "seav-search-text";
      const title = document.createElement("strong");
      title.textContent = item.title;
      words.append(title);
      if (item.sub) {
        const sub = document.createElement("small");
        sub.textContent = item.sub;
        words.append(sub);
      }
      link.append(icon, words);
      // Record results (they carry an index id) go into Recent.
      if (item.id) link.addEventListener("click", () => window.SeavSearch?.remember?.(item.id));
      li.append(link);
      li.addEventListener("mousemove", () => {
        if (active !== index) setActive(index);
      });
      return li;
    };

    const render = () => {
      const sections = buildSections();
      options = [];
      optionEls = [];
      list.textContent = "";
      sections.forEach((section) => {
        if (!section.items.length) return;
        const heading = document.createElement("li");
        heading.className = "seav-search-group";
        heading.setAttribute("role", "presentation");
        heading.textContent = section.label;
        list.append(heading);
        section.items.forEach((item) => {
          const li = buildRow(item, options.length);
          options.push(item);
          optionEls.push(li);
          list.append(li);
        });
      });

      const typed = input.value.trim();
      hint.hidden = Boolean(typed);
      empty.hidden = !typed || options.length > 0;
      if (!options.length) {
        if (typed) empty.querySelector("strong").textContent = `No results for “${typed}”`;
        input.removeAttribute("aria-activedescendant");
      } else {
        setActive(0);
      }
    };

    const close = () => {
      if (!root || root.hidden) return;
      root.hidden = true;
      button.setAttribute("aria-expanded", "false");
      if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    };

    const build = () => {
      root = document.createElement("div");
      root.className = "seav-search";
      root.hidden = true;
      root.innerHTML = `
        <div class="seav-search-backdrop" data-search-close></div>
        <div class="seav-search-panel" role="dialog" aria-modal="true" aria-label="Search">
          <div class="seav-search-field">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="2"/>
              <path d="M16 16l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <input type="search" class="seav-search-input" placeholder="Search your records and pages…"
              autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true"
              aria-controls="seavSearchList" aria-autocomplete="list" />
            <kbd>esc</kbd>
          </div>
          <div class="seav-search-body">
            <ul class="seav-search-list" id="seavSearchList" role="listbox" aria-label="Search results"></ul>
            <p class="seav-search-hint">
              <small>Search your vessels, sea time, certificates, passages, tenders, courses and more — or type a page name to jump there.</small>
            </p>
            <div class="seav-search-empty" hidden>
              <strong></strong>
              <small>Try a vessel, certificate, port, course or referee name.</small>
            </div>
          </div>
          <div class="seav-search-foot" aria-hidden="true">
            <small><kbd>↑</kbd><kbd>↓</kbd> move</small>
            <small><kbd>↵</kbd> open</small>
            <small><kbd>esc</kbd> close</small>
          </div>
        </div>
      `;
      document.body.append(root);
      input = root.querySelector(".seav-search-input");
      list = root.querySelector(".seav-search-list");
      empty = root.querySelector(".seav-search-empty");
      hint = root.querySelector(".seav-search-hint");

      root.addEventListener("click", (event) => {
        if (event.target.closest("[data-search-close]")) close();
      });
      input.addEventListener("input", render);
      root.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          setActive(active + 1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          setActive(active - 1);
        } else if (event.key === "Enter") {
          const link = optionEls[active]?.querySelector("a");
          if (link) {
            event.preventDefault();
            link.click();
          }
        } else if (event.key === "Tab") {
          // One focusable control; keep focus inside the dialog.
          event.preventDefault();
          input.focus();
        }
      });

      // Records still arriving (state.js loads other pages' data in the
      // background just after load): refresh the open results.
      document.addEventListener("seav:data-updated", () => {
        if (root && !root.hidden) render();
      });
    };

    const open = () => {
      if (!root) build();
      lastFocus = document.activeElement;
      input.value = "";
      root.hidden = false;
      button.setAttribute("aria-expanded", "true");
      render();
      input.focus();
    };

    button.addEventListener("click", open);
    document.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === "k") {
        event.preventDefault();
        if (root && !root.hidden) close();
        else open();
      }
    });
  }

  /* Topbar menus (v565). The three-bar button opens every section as one
     column; the photo opens the account menu. One open at a time; closes on
     Esc, a click outside, or choosing a link. The bars turn into a cross
     while the section menu is open. aria-expanded/aria-label follow the
     state for screen readers. */
  function wireTopbarMenus() {
    const pairs = [
      {
        button: document.getElementById("topbarMenuBtn"),
        panel: document.getElementById("topbarMenuPanel"),
        open: "Close menu",
        closed: "Open menu"
      },
      {
        button: document.getElementById("topbarProfileLink"),
        panel: document.getElementById("topbarAccountPanel"),
        open: "Close account menu",
        closed: null // set by wireTopbarProfile (carries the person's name)
      }
    ].filter((p) => p.button && p.panel);
    if (!pairs.length) return;

    const setOpen = (pair, open) => {
      pair.panel.hidden = !open;
      pair.button.setAttribute("aria-expanded", String(open));
      pair.button.classList.toggle("is-open", open);
      if (pair.open && open) pair.button.setAttribute("aria-label", pair.open);
      if (pair.closed && !open) pair.button.setAttribute("aria-label", pair.closed);
      if (!pair.closed && !open && pair.button.dataset.closedLabel) {
        pair.button.setAttribute("aria-label", pair.button.dataset.closedLabel);
      }
    };
    const closeAll = (except) => pairs.forEach((p) => p !== except && setOpen(p, false));

    pairs.forEach((pair) => {
      pair.button.addEventListener("click", (event) => {
        event.stopPropagation();
        const opening = pair.panel.hidden;
        closeAll(pair);
        setOpen(pair, opening);
        if (opening) {
          const first = pair.panel.querySelector("a[href]:not([aria-disabled='true'])");
          if (first && event.detail === 0) first.focus(); // keyboard opens move focus in
        }
      });
      pair.panel.addEventListener("click", (event) => {
        if (event.target.closest("a[href]")) setOpen(pair, false);
      });
    });

    document.addEventListener("click", (event) => {
      pairs.forEach((p) => {
        if (!p.panel.hidden && !p.panel.contains(event.target) && !p.button.contains(event.target)) {
          setOpen(p, false);
        }
      });
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      pairs.forEach((p) => {
        if (!p.panel.hidden) {
          setOpen(p, false);
          p.button.focus();
        }
      });
    });
  }

  function wireTopbarProfile() {
    const link = document.getElementById("topbarProfileLink");
    const avatar = document.getElementById("topbarProfileAvatar");
    if (!link || !avatar) return;

    // 2026-09-30 (v556), per Jack: the rank label beside the photo is gone —
    // the bar shows the photo only. The name still reaches screen readers
    // through the link's aria-label below.
    const update = () => {
      const profile = window.SeavState?.profile || {};

      const name = String(profile.name || "").trim();
      // v565: the photo opens the account menu.
      const label = name ? `Account menu — ${name}` : "Account menu";
      link.title = label;
      link.dataset.closedLabel = label;
      if (link.getAttribute("aria-expanded") !== "true") link.setAttribute("aria-label", label);

      // Account menu header: name and "rank · current yacht".
      const headName = document.getElementById("topbarAccountName");
      const headRole = document.getElementById("topbarAccountRole");
      if (headName) headName.textContent = name || "Your account";
      if (headRole) {
        const current = window.SeavData?.getCurrentVessel?.(window.SeavState?.vessels || []);
        headRole.textContent = [profile.rank, current?.name].filter(Boolean).join(" · ");
      }

      const photoUrl = getFileDisplayUrl(
        profile.photo,
        window.SeavApiCore?.STORAGE_BUCKETS?.PROFILE_PHOTOS || "profile-photos"
      );

      // The same face in the topbar and the account menu header.
      const avatars = [avatar, document.getElementById("topbarAccountAvatar")].filter(Boolean);
      if (photoUrl) {
        // Same escaping as js/dashboard.js's dashAvatar — a signed URL can
        // carry characters that would otherwise break out of the url("").
        const safeUrl = String(photoUrl).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        avatars.forEach((el) => {
          el.style.backgroundImage = `url("${safeUrl}")`;
          el.textContent = "";
          el.classList.add("has-photo");
        });
      } else {
        avatars.forEach((el) => {
          el.style.backgroundImage = "";
          el.textContent = topbarProfileInitials(name);
          el.classList.remove("has-photo");
        });
      }
    };

    update();
    document.addEventListener("seav:state-ready", update);
    document.addEventListener("seav:data-updated", update);
  }

  function wireSidebarPublicProfile() {
    const link = document.getElementById("sidebarPublicProfileLink");
    if (!link) return;

    const updateHref = () => {
      link.href = resolvePublicProfileUrl();
    };

    updateHref();
    document.addEventListener("seav:state-ready", updateHref);
    document.addEventListener("seav:data-updated", updateHref);
  }

  function wireLogout() {
    const logoutLink = document.getElementById("btnLogout");
    if (!logoutLink) return;

    logoutLink.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        await window.SeavAuth?.logout?.();
      } catch (err) {
        console.warn("[SEA-V] Logout failed:", err);
      }
      window.location.href = "index.html";
    });
  }

  function showSetupBanner(issues) {
    if (!Array.isArray(issues) || !issues.length) return;
    if (!document.body.classList.contains("app-page")) return;

    const target = document.querySelector(".dash-content");
    if (!target || document.getElementById("seavSetupBanner")) return;

    const banner = document.createElement("div");
    banner.id = "seavSetupBanner";
    banner.className = "seav-setup-banner";
    banner.innerHTML = `
      <strong>Supabase setup needed</strong>
      <ul>${issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")}</ul>
      <p>Run <code>docs/schema-full.sql</code> in Supabase, then <code>node scripts/test-supabase.mjs</code>.</p>
    `;
    target.prepend(banner);
  }

  function showDataEmptyBanner() {
    if (!document.body.classList.contains("app-page")) return;

    const target = document.querySelector(".dash-content");
    if (!target || document.getElementById("seavDataEmptyBanner")) return;

    const banner = document.createElement("div");
    banner.id = "seavDataEmptyBanner";
    banner.className = "seav-setup-banner";
    banner.innerHTML = `
      <strong>Your records did not load</strong>
      <p>SEA-V stores everything in your Supabase account. If this page looks empty, try reloading your data or signing in again with the same email you use on www.sea-v.com.</p>
      <p style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
        <button type="button" class="btn-blue" id="seavReloadDataBtn">Reload my data</button>
        <a class="btn-ghost2" href="index.html">Sign in again</a>
      </p>
    `;
    target.prepend(banner);

    banner.querySelector("#seavReloadDataBtn")?.addEventListener("click", async () => {
      if (window.SeavFeedback?.showPageLoader) {
        window.SeavFeedback.showPageLoader("Reloading…", "Fetching your Supabase records");
      }
      try {
        window.SeavState?.clearStateCache?.();
        await window.SeavState?.ensureUserDataLoaded?.(true);
        if (window.Seav.app?.refreshAll) {
          await window.Seav.app.refreshAll();
        }
        if (!window.SeavState?.isDataLikelyEmpty?.()) {
          banner.remove();
          Seav.notify("success", "Data loaded", "Your SEA-V records are visible again.");
        } else {
          Seav.notify(
            "info",
            "Still empty",
            "No records found for this account in Supabase. Check you are signed in with the correct email."
          );
        }
      } finally {
        window.SeavFeedback?.hidePageLoader?.();
      }
    });
  }

  function setActiveTopbarLink() {
    const links = document.querySelectorAll(".topbar .nav-left a[href], .topbar .nav-right a[href]");
    if (!links.length) return;

    const currentFile = (location.pathname.split("/").pop() || "dashboard.html").toLowerCase();

    const hrefFile = (href) =>
      String(href || "")
        .split("#")[0]
        .split("?")[0]
        .split("/")
        .pop()
        .toLowerCase();

    links.forEach((a) => a.classList.remove("active"));

    const matched = Array.from(links).find((a) => {
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http")) return false;
      return hrefFile(href) === currentFile;
    });

    if (matched) matched.classList.add("active");
  }

  /* =========================================================
     MODALS
  ========================================================= */

  /* v577 modal revamp (Jack, 2026-10-06, from the approved mockup). Every
     .modal-card gets, once:
     - its section's icon in the header (MODAL_ICONS, by modal id), drawn in
       the card's accent colour;
     - dialog semantics on the .modal (role, aria-modal, aria-labelledby);
     - a pinned Save bar (.modal-foot) at the end of the form: Cancel + the
       form's own Save button / actions row, MOVED, not copied, so every
       page's submit handling and ids are untouched. Cancel clicks the
       card's own X, so whatever that page does on close still runs.
     Runs at load and on any .modal added later (the dashboard lifts page
     modals in on demand). Styles: REVAMP block in css/components/modals.css. */
  const MODAL_ICONS = {
    vesselModal: "vessels",
    seatimeModal: "seatime",
    certModal: "certificates",
    certShareModal: "certificates",
    tenderModal: "tenders",
    oeModal: "onboard",
    refModal: "references",
    achievementModal: "achievements",
    trbModal: "achievements",
    psModal: "payslips",
    sqModal: "specialist",
    hiModal: "hobbies",
    leModal: "landExperience",
    contactInfoModal: "mail",
    aboutInfoModal: "info",
    reportIssueModal: "flag"
  };

  const MODAL_EXTRA_ICONS = {
    mail: `<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="6" width="17" height="12" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="m4.5 7.5 7.5 6 7.5-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.6v.01M11 11h1.3v5.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    flag: `<svg viewBox="0 0 24 24" fill="none"><path d="M6 20V4.5M6 5h10.5l-2 3.5 2 3.5H6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  };

  function enhanceModalCard(card) {
    if (!card || card.dataset.enhanced || card.classList.contains("email-confirmed-card")) return;
    card.dataset.enhanced = "1";

    const modal = card.closest(".modal");
    const head = card.querySelector(":scope > .modal-head");
    const title = head?.querySelector("h3");

    if (head && title && !head.querySelector(".modal-head-icon")) {
      const key = MODAL_ICONS[modal?.id];
      const svg = key ? window.SeavIcons?.[key] || MODAL_EXTRA_ICONS[key] : "";
      if (svg) {
        const icon = document.createElement("span");
        icon.className = "modal-head-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.innerHTML = svg; // our own icon set, not data
        head.insertBefore(icon, head.firstChild);
      }
    }

    if (modal && title && !modal.hasAttribute("role")) {
      if (!title.id) title.id = `${modal.id || "seav"}Title`;
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-labelledby", title.id);
    }

    const form = card.querySelector(":scope > .modal-form");
    if (!form || form.querySelector(".modal-foot")) return;
    const actions = [...form.children]
      .reverse()
      .find((el) => el.matches('button[type="submit"], .dash-actions, .seav-actions'));
    if (!actions) return;

    const foot = document.createElement("div");
    foot.className = "modal-foot";

    const hasOwnSecondary = actions.matches("button")
      ? false
      : !!actions.querySelector('button[type="button"], .btn-ghost2');
    if (form.tagName === "FORM" && !hasOwnSecondary) {
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "btn-ghost2 modal-cancel";
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", (event) => {
        event.preventDefault();
        const x = card.querySelector(".modal-x");
        if (x) x.click();
        else window.SeavModals?.closeAllModals?.();
      });
      foot.appendChild(cancel);
    }

    foot.appendChild(actions);
    form.appendChild(foot);
  }

  function enhanceModals(root = document) {
    root.querySelectorAll(".modal-card").forEach(enhanceModalCard);
  }

  function watchForNewModals() {
    if (!document.body || typeof window.MutationObserver === "undefined") return;
    new window.MutationObserver((mutations) => {
      mutations.forEach((m) =>
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (node.matches(".modal-card")) enhanceModalCard(node);
          else if (node.querySelector?.(".modal-card")) enhanceModals(node);
        })
      );
    }).observe(document.body, { childList: true });
  }

  function initModals() {
    const overlay = document.getElementById("modalOverlay");
    enhanceModals();
    watchForNewModals();

    function closeAllModals() {
      if (overlay) overlay.hidden = true;
      document.querySelectorAll(".modal").forEach((m) => {
        m.hidden = true;
      });
    }

    function openModal(id) {
      closeAllModals();
      const modal = document.getElementById(id);
      if (!modal) return;
      if (overlay) overlay.hidden = false;
      modal.hidden = false;
    }

    document.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        openModal(btn.getAttribute("data-open"));
      });
    });

    document.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        closeAllModals();
      });
    });

    if (overlay) {
      overlay.addEventListener("click", closeAllModals);
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAllModals();
    });

    return { openModal, closeAllModals };
  }

  /* =========================================================
     PUBLIC API
  ========================================================= */

  function getFileDisplayUrl(fileMeta, bucket = null) {
    const url = window.SeavApiCore?.getStoredFileDisplayUrl?.(fileMeta, bucket);
    if (url) return url;
    if (!fileMeta) return "";
    if (typeof fileMeta === "string") return fileMeta.trim();
    return fileMeta.url || fileMeta.dataUrl || fileMeta.publicUrl || "";
  }

  /**
   * Wire a page refresh to state-ready (once) and seav:data-updated.
   * Hydration dispatches data-updated, so file URLs refresh without a separate listener.
   */
  function bindStateRefresh(callback, options = {}) {
    const label = options.label || "State refresh";
    const run = () => {
      try {
        const result = callback();
        if (result && typeof result.then === "function") {
          result.catch((err) => {
            console.error(`[SEA-V] ${label} failed:`, err);
          });
        }
      } catch (err) {
        console.error(`[SEA-V] ${label} failed:`, err);
      }
    };

    if (window.SeavState?.ready) {
      run();
    } else {
      document.addEventListener("seav:state-ready", run, { once: true });
    }

    if (options.onDataUpdated !== false) {
      document.addEventListener("seav:data-updated", run);
    }
  }

  window.Seav = {
    app,
    MAX_UPLOAD_BYTES,
    escapeHtml,
    text,
    seavAction,
    seavActions,
    confirmDelete,
    splitIsoDate,
    buildIsoDate,
    setDateTriplet,
    fillDateTriplet,
    readDateTriplet,
    clearDateTriplet,
    populateDatePartSelects,
    mountDateFields,
    readFileAsDataURL,
    buildStoredFile,
    setActiveSidebarLink,
    initModals,
    mountSharedLayout,
    getFileDisplayUrl,
    bindStateRefresh,
    buildPublicProfileUrl,
    notify(type, title, message) {
      if (window.SeavFeedback?.[type]) {
        window.SeavFeedback[type](title, message);
        return;
      }
      alert(message ? `${title}\n\n${message}` : title);
    },
    async withSaving(task, options = {}) {
      if (window.SeavFeedback?.withSaving) {
        return window.SeavFeedback.withSaving(task, options);
      }
      return task();
    }
  };

  /* =========================================================
     APP INIT
  ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  mountSharedLayout();
  mountVersionBadge();
  mountDateFields();
  setActiveSidebarLink();
  setActiveTopbarLink();
  window.SeavModals = initModals();

  document.addEventListener("seav:setup-issues", (event) => {
    showSetupBanner(event.detail?.issues || []);
  });

  document.addEventListener("seav:data-empty", () => {
    showDataEmptyBanner();
  });

  document.addEventListener("seav:fetch-error", (event) => {
    const detail = event.detail || {};
    const table = detail.table || "table";
    const message = detail.message || "Permission denied";
    if (!document.body.classList.contains("app-page")) return;

    const target = document.querySelector(".dash-content");
    if (!target || document.getElementById("seavFetchErrorBanner")) return;

    const banner = document.createElement("div");
    banner.id = "seavFetchErrorBanner";
    banner.className = "seav-setup-banner";
    banner.innerHTML = `
      <strong>Could not load ${escapeHtml(table)}</strong>
      <p>${escapeHtml(message)}</p>
      <p>Run <code>docs/schema-grant-authenticated-read.sql</code> in Supabase SQL Editor, then click Reload my data.</p>
    `;
    target.prepend(banner);
  });

  function updateSidebarBadges() {
    renderSidebarAchievements();
  }

  if (window.SeavState?.ready) {
    updateSidebarBadges();
  } else {
    document.addEventListener("seav:state-ready", updateSidebarBadges, { once: true });
  }

  document.addEventListener("seav:data-updated", updateSidebarBadges);

  const footerYear = document.getElementById("footerYear");
  if (footerYear) {
    footerYear.textContent = new Date().getFullYear();
  }

  initLegalPage();
});

function initLegalPage() {
  if (!document.body.classList.contains("legal-page")) return;

  const tocLinks = document.querySelectorAll(".legal-toc a[href^='#']");
  const sections = [...document.querySelectorAll(".legal-section[id]")];
  if (!tocLinks.length || !sections.length) return;

  const setActive = (id) => {
    tocLinks.forEach((link) => {
      const match = link.getAttribute("href") === `#${id}`;
      link.classList.toggle("is-active", match);
    });
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length) {
          setActive(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.2, 0.5] }
    );
    sections.forEach((section) => observer.observe(section));
  }

  const hash = window.location.hash.replace("#", "");
  if (hash) setActive(hash);
}
})();