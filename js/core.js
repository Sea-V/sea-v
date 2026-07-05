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

  function buildYearOptionsHtml() {
    const now = getCurrentYear();
    const options = ['<option value="">Year</option>'];

    for (let year = now; year <= now + DATE_YEAR_FUTURE; year += 1) {
      options.push(`<option value="${year}">${year}</option>`);
    }

    for (let year = now - 1; year >= DATE_YEAR_MIN; year -= 1) {
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

  function clearDateTriplet(prefix) {
    setDateTriplet(prefix, "");
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

  function daysBetween(from, to) {
    const a = new Date(from);
    const b = new Date(to);
    const ms = b - a;
    if (Number.isNaN(ms)) return 0;
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
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
              src="img/logo.png?v=7"
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
            <a href="dashboard.html">Dashboard</a>
            <a href="#" data-open="contactInfoModal">Contact</a>
            <a href="#" data-open="aboutInfoModal">About</a>
          </nav>

          <a class="brand" href="dashboard.html">
            <img
              src="img/logo.png?v=7"
              class="seav-logo seav-logo--topbar"
              alt="SEA-V"
              width="34"
              height="34"
            />
          </a>

          <div class="nav-right">
            <a
              class="icon insta-link"
              href="https://instagram.com/seav_official"
              target="_blank"
              rel="noopener"
              aria-label="Instagram"
              title="Instagram"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M7.75 2C4.57 2 2 4.57 2 7.75v8.5C2 19.43 4.57 22 7.75 22h8.5C19.43 22 22 19.43 22 16.25v-8.5C22 4.57 19.43 2 16.25 2zm0 1.5h8.5c2.35 0 4.25 1.9 4.25 4.25v8.5c0 2.35-1.9 4.25-4.25 4.25h-8.5A4.25 4.25 0 0 1 3.5 16.25v-8.5C3.5 5.4 5.4 3.5 7.75 3.5M17.5 6.25a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10m0 1.5A3.5 3.5 0 1 1 8.5 12 3.5 3.5 0 0 1 12 8.5"/>
              </svg>
            </a>
          </div>
        </div>
      </header>
    `;
  }

  function renderSidebarLink(href, label, iconSvg, options = {}) {
    const target = options.newTab ? ' target="_blank" rel="noopener"' : "";
    const idAttr = options.id ? ` id="${options.id}"` : "";
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
  const iconLogout = `<svg viewBox="0 0 24 24" fill="none"><path d="M10 6H7.5A1.5 1.5 0 0 0 6 7.5v9A1.5 1.5 0 0 0 7.5 18H10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M13 8.5 16.5 12 13 15.5M9.5 12h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function renderAppSidebar() {
  return `
    <div class="dash-side-stack">
      <aside class="dash-sidebar">
        <h2 class="dash-title">My SEA-V</h2>

        <nav class="dash-nav" aria-label="Main">
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
              renderSidebarLink(
                "specialist-qualifications.html",
                "Specialist Qualifications",
                iconSpecialist
              )
            ].join("")
          )}

          ${renderSidebarGroup(
            "Documentation",
            [
              renderSidebarLink("certificates.html", "Certificates", iconCertificates),
              renderSidebarLink("references.html", "References", iconReferences),
              renderSidebarLink("payslips.html", "Payslips", iconPayslips)
            ].join(""),
            "dash-nav-group--documentation"
          )}

          ${renderSidebarGroup(
            "Highlights",
            [
              renderSidebarLink("achievements.html", "Achievements", iconAchievements),
              renderSidebarLink("hobbies-interests.html", "Hobbies &amp; Interests", iconHobbies)
            ].join("")
          )}

          ${renderSidebarGroup(
            "Tools",
            [
              renderSidebarLink("cv-generator.html", "CV Generator", iconCv),
              renderSidebarLink("public-profile.html", "Public Profile", iconPublicProfile, {
                id: "sidebarPublicProfileLink",
                newTab: true
              })
            ].join(""),
            "dash-nav-group--tools"
          )}
        </nav>

        <div class="dash-sidebar-footer">
          <a class="dash-link dash-logout" href="index.html" id="btnLogout">
            <span class="dash-icon" aria-hidden="true">${iconLogout}</span>
            <span>Logout</span>
          </a>
          <nav class="dash-sidebar-legal" aria-label="Legal">
            <a href="privacy.html">Privacy Policy</a>
            <span class="dash-sidebar-legal-sep" aria-hidden="true">·</span>
            <a href="terms.html">Terms of Use</a>
          </nav>
        </div>
      </aside>

      <aside class="dash-sidebar sidebar-badge-panel">
        <h3 class="sidebar-badge-title">Achievements</h3>
        <div class="sidebar-badge-grid" id="sidebarAchievements"></div>
      </aside>
    </div>
  `;
}

function resolveSidebarBadgeImage(item) {
  if (window.SeavBadges?.resolveItemBadgeImage) {
    return window.SeavBadges.resolveItemBadgeImage(item);
  }

  if (!item?.badgeImage || item.status === "Declined") return "";
  return String(item.badgeImage).replace(/\.png(\?.*)?$/i, ".svg$1");
}

function groupSidebarAchievements(records) {
  const groups = new Map();

  records.forEach((item) => {
    if (!item || item.status === "Declined") return;
    const key = item.code || item.id;
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
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

function renderSidebarAchievements() {
  const container = document.getElementById("sidebarAchievements");
  if (!container) return;

  const grouped = groupSidebarAchievements(window.SeavState?.achievements || [])
    .map((instances) => {
      const item = instances[0];
      const image = resolveSidebarBadgeImage({ ...item, status: "Approved" });
      return { instances, item, image };
    })
    .filter(({ image }) => !!image);

  if (!grouped.length) {
    container.innerHTML = `<div class="sidebar-badge-empty">No badges yet</div>`;
    return;
  }

  container.innerHTML = grouped
    .map(({ instances, item, image }) => {
      const tier = item.badgeTier || "default";
      const label = item.badgeLabel || item.title || "Achievement";
      const vessels = instances.map((entry) => entry.vessel).filter(Boolean);
      const meta =
        vessels.length > 1
          ? `${vessels.length} vessels: ${vessels.slice(0, 3).join(", ")}${vessels.length > 3 ? "…" : ""}`
          : vessels[0] || item.category || "Achievement";

      return `
    <div class="sidebar-badge-item seav-badge-wrap tooltip-above" data-tier="${window.Seav.escapeHtml(tier)}">
      <img
        class="seav-badge"
        src="${window.Seav.escapeHtml(image)}"
        alt="${window.Seav.escapeHtml(label)}"
      />
      ${instances.length > 1 ? `<span class="sidebar-badge-count">${instances.length}</span>` : ""}
      <span class="seav-badge-tooltip">
        <strong>${window.Seav.escapeHtml(item.title || label)}</strong>
        <span>${window.Seav.escapeHtml(meta)}</span>
      </span>
    </div>
  `;
    })
    .join("");
}

  function renderSharedModals() {
    return `
      <div class="modal-overlay" id="modalOverlay" hidden></div>

      <div class="modal" id="contactInfoModal" hidden>
        <div class="modal-card modal-card--blue">
          <div class="modal-head">
            <h3>Contact SEA-V</h3>
            <button type="button" class="modal-x" data-close>&times;</button>
          </div>

          <div class="modal-form">
            <p class="modal-intro">
              For product feedback, support, partnerships, or early access enquiries.
            </p>

            <label>Email
              <input type="text" value="admin@sea-v.com" readonly />
            </label>

            <label>Enquiries
              <textarea rows="4" readonly>Product feedback, support, partnerships, and early access.</textarea>
            </label>
          </div>
        </div>
      </div>

      <div class="modal" id="aboutInfoModal" hidden>
        <div class="modal-card modal-card--blue">
          <div class="modal-head">
            <h3>About SEA-V</h3>
            <button type="button" class="modal-x" data-close>&times;</button>
          </div>

          <div class="modal-form">
            <p class="modal-intro">
              SEA-V is a modern digital hub for seafarers — one place to record and share your maritime career.
            </p>

            <label>What it does
              <textarea rows="5" readonly>Track sea time, manage certificates, store vessel history, collect references, and build a professional maritime profile in one place.</textarea>
            </label>

            <label>Vision
              <textarea rows="4" readonly>Built to modernise how maritime careers are recorded, presented, and shared.</textarea>
            </label>
          </div>
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
      }
    }

  if (sidebarMount) {
  const sidebarType = document.body.dataset.sidebar || "";

  if (sidebarType === "app") {
    sidebarMount.innerHTML = renderAppSidebar();

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

  /* =========================================================
     SIDEBAR ACTIVE LINK
  ========================================================= */

  function setActiveSidebarLink() {
    const links = document.querySelectorAll(".dash-sidebar .dash-link");
    const topbarLinks = document.querySelectorAll(".app-topbar .nav-left a[href]");
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

  function resolvePublicProfileUrl() {
    const profileId = window.SeavState?.profile?.id || "";
    if (!profileId) return "public-profile.html";
    return `public-profile.html?p=${encodeURIComponent(profileId)}`;
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

  function initModals() {
    const overlay = document.getElementById("modalOverlay");

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
    readDateTriplet,
    clearDateTriplet,
    populateDatePartSelects,
    mountDateFields,
    daysBetween,
    readFileAsDataURL,
    buildStoredFile,
    setActiveSidebarLink,
    initModals,
    mountSharedLayout,
    getFileDisplayUrl,
    bindStateRefresh,
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