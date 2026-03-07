// /js/certificates.js
(function () {
  "use strict";

  function getCertExpiryInfo(expiry) {
    if (!expiry) {
      return {
        label: "No Expiry",
        badge: "No Expiry",
        sortValue: 999999,
        statusClass: "pill",
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const exp = new Date(expiry);
    exp.setHours(0, 0, 0, 0);

    const diffMs = exp - today;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        label: "Expired",
        badge: "Expired",
        sortValue: diffDays,
        statusClass: "pill",
      };
    }

    if (diffDays <= 60) {
      return {
        label: `Expires in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
        badge: "Expires Soon",
        sortValue: diffDays,
        statusClass: "pill",
      };
    }

    return {
      label: `Valid for ${diffDays} day${diffDays === 1 ? "" : "s"}`,
      badge: "Valid",
      sortValue: diffDays,
      statusClass: "pill",
    };
  }

  function renderCerts() {
    const certsList = document.getElementById("certsList");
    const certsTableBody = document.getElementById("certsTableBody");

    if (!certsList && !certsTableBody && !document.getElementById("certForm")) return;

    const certs = Seav.load("seav_certs", []);

    if (certsList) {
      if (certs.length === 0) {
        certsList.innerHTML = `
          <div class="list-row">
            <div>
              <div class="list-title">No certificates yet</div>
              <div class="list-sub">Add STCW, ENG1, etc.</div>
            </div>
            <span class="pill">Prototype</span>
          </div>
        `;
      } else {
        certsList.innerHTML = certs.map((c, idx) => {
          const hasFile = !!(c.attachment && c.attachment.dataUrl);
          const expiryInfo = getCertExpiryInfo(c.expiry);

          const fileHtml = hasFile
            ? `<div class="list-sub" style="margin-top:6px;">
                 <a href="${c.attachment.dataUrl}" download="${Seav.escapeHtml(c.attachment.filename)}">Download attachment</a>
               </div>`
            : `<div class="list-sub" style="margin-top:6px;">Attachment: —</div>`;

          return `
            <div class="list-row">
              <div style="min-width:0;">
                <div class="list-title">${Seav.escapeHtml(c.name)}</div>
                <div class="list-sub">
                  Expiry: ${Seav.escapeHtml(c.expiry || "—")} • ${Seav.escapeHtml(expiryInfo.label)}
                </div>
                ${fileHtml}
              </div>
              <div class="row-actions" style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
                <span class="${expiryInfo.statusClass}">${Seav.escapeHtml(expiryInfo.badge)}</span>
                <a href="#" data-del-cert="${idx}">Delete</a>
              </div>
            </div>
          `;
        }).join("");
      }
    }

    if (certsTableBody) {
      if (certs.length === 0) {
        certsTableBody.innerHTML = `
          <tr>
            <td class="muted">—</td>
            <td class="muted">—</td>
            <td><span class="pill">Prototype</span></td>
            <td class="muted">—</td>
            <td></td>
          </tr>
        `;
      } else {
        certsTableBody.innerHTML = certs.map((c, idx) => {
          const hasFile = !!(c.attachment && c.attachment.dataUrl);
          const expiryInfo = getCertExpiryInfo(c.expiry);

          const attachCell = hasFile
            ? `<a href="${c.attachment.dataUrl}" download="${Seav.escapeHtml(c.attachment.filename)}">Download</a>`
            : `<span class="muted">—</span>`;

          return `
            <tr>
              <td>${Seav.escapeHtml(c.name)}</td>
              <td>${Seav.escapeHtml(c.expiry || "—")}</td>
              <td><span class="${expiryInfo.statusClass}">${Seav.escapeHtml(expiryInfo.badge)}</span></td>
              <td>${attachCell}</td>
              <td class="row-actions"><a href="#" data-del-cert="${idx}">Delete</a></td>
            </tr>
          `;
        }).join("");
      }
    }
  }

  function initCertificates() {
    if (!document.getElementById("certForm") && !document.getElementById("certsTableBody") && !document.getElementById("certsList")) return;

    renderCerts();

    const certForm = document.getElementById("certForm");
    if (certForm) {
      certForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("ct_name")?.value.trim();
        const expiry = document.getElementById("ct_expiry")?.value || "";
        const status = document.getElementById("ct_status")?.value || "Valid";
        if (!name) return;

        const file = document.getElementById("ct_file")?.files?.[0] || null;

        let attachment = null;
        if (file) {
          const maxBytes = 2 * 1024 * 1024;
          if (file.size > maxBytes) {
            alert("Attachment too large. Please upload a file under 2MB for the prototype.");
            return;
          }
          attachment = {
            filename: file.name,
            mime: file.type || "application/octet-stream",
            dataUrl: await Seav.readFileAsDataURL(file),
          };
        }

        const certs = Seav.load("seav_certs", []);
        certs.unshift({ name, expiry, status, attachment });
        Seav.save("seav_certs", certs);

        certForm.reset();
        if (window.SeavModals?.closeAllModals) window.SeavModals.closeAllModals();

        renderCerts();
        if (window.SeavDashboard?.refresh) window.SeavDashboard.refresh();
      });
    }

    document.addEventListener("click", (e) => {
      const cf = e.target.closest("[data-del-cert]");
      if (!cf) return;

      e.preventDefault();
      const idx = Number(cf.getAttribute("data-del-cert"));
      const certs = Seav.load("seav_certs", []);
      certs.splice(idx, 1);
      Seav.save("seav_certs", certs);

      renderCerts();
      if (window.SeavDashboard?.refresh) window.SeavDashboard.refresh();
    });
  }

  document.addEventListener("DOMContentLoaded", initCertificates);

  // Optional shared helper for dashboard
  window.SeavCerts = {
    getCertExpiryInfo,
  };
})();