// /js/core.js
(function () {
  "use strict";

  /* =========================================================
     UTILITIES
  ========================================================= */

  function load(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function save(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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

  /* =========================================================
     SHARED LAYOUT TEMPLATES
  ========================================================= */

  function renderPublicTopbar(active = "") {
    return `
      <header class="topbar">
        <div class="topbar-inner">
          <nav class="nav-left">
            <a href="index.html" ${active === "home" ? 'class="active"' : ""}>Home</a>
            <a href="contact.html" ${active === "contact" ? 'class="active"' : ""}>Contact</a>
            <a href="about.html" ${active === "about" ? 'class="active"' : ""}>About</a>
          </nav>

          <a class="brand" href="index.html">
            <img src="img/logo.png" alt="SEA-V" />
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
    <header class="topbar">
      <div class="topbar-inner">
        <nav class="nav-left">
          <a href="dashboard.html">Home</a>
          <a href="#" data-open="contactInfoModal">Contact</a>
          <a href="#" data-open="aboutInfoModal">About</a>
        </nav>

        <a class="brand" href="dashboard.html">
          <img src="img/logo.png" alt="SEA-V" />
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

  function renderAppSidebar() {
    return `
      <aside class="dash-sidebar">
        <h2 class="dash-title">My SEA-V</h2>

        <a class="dash-link" href="dashboard.html">Dashboard</a>
        <a class="dash-link" href="profile.html">Profile</a>
        <a class="dash-link" href="seatime.html">Sea Time</a>
        <a class="dash-link" href="certificates.html">Certificates</a>
        <a class="dash-link" href="vessels.html">Vessels</a>
        <a class="dash-link" href="references.html">References</a>
        <a class="dash-link" href="navigation.html">Navigation</a>
        <a class="dash-link" href="settings.html">Settings</a>
        <a class="dash-link dash-logout" href="index.html">Logout</a>
      </aside>
    `;
  }

  function renderSharedModals() {
    return `
      <div class="modal-overlay" id="modalOverlay" hidden></div>

      <div class="modal" id="contactInfoModal" hidden>
        <div class="modal-card">
          <div class="modal-head">
            <h3>Contact SEA-V</h3>
            <button type="button" class="modal-x" data-close>&times;</button>
          </div>

          <div class="modal-form">
            <p class="muted">
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
        <div class="modal-card">
          <div class="modal-head">
            <h3>About SEA-V</h3>
            <button type="button" class="modal-x" data-close>&times;</button>
          </div>

          <div class="modal-form">
            <p class="muted">
              SEA-V is a modern digital hub for seafarers.
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

    let matched = Array.from(links).find(
      (a) => hrefFile(a.getAttribute("href")) === currentFile
    );

    if (!matched) {
      matched =
        Array.from(links).find(
          (a) => hrefFile(a.getAttribute("href")) === "dashboard.html"
        ) || links[0];
    }

    matched.classList.add("active");
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

  window.Seav = {
    load,
    save,
    escapeHtml,
    daysBetween,
    readFileAsDataURL,
    setActiveSidebarLink,
    initModals,
    mountSharedLayout,
  };

  /* =========================================================
     APP INIT
  ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

  mountSharedLayout();
  setActiveSidebarLink();
  window.SeavModals = initModals();

  /* Auto footer year */
  const footerYear = document.getElementById("footerYear");
  if (footerYear) {
    footerYear.textContent = new Date().getFullYear();
  }

});

})();
