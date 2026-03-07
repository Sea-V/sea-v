// /js/dashboard.js
(function () {
  "use strict";

  // --- Guard: core.js must load first ---
  if (!window.Seav) {
    console.warn("[SEA-V] Seav core not found. Did you include ../js/core.js before dashboard.js?");
    return;
  }

  function updateDayTypeKpis() {
    const kpiSea = document.getElementById("kpiSea");
    const kpiPort = document.getElementById("kpiPort");
    const kpiStandby = document.getElementById("kpiStandby");
    const kpiTotalDays = document.getElementById("kpiTotalDays");

    if (!kpiSea && !kpiPort && !kpiStandby && !kpiTotalDays) return;

    const seatimes = Seav.load("seav_seatimes", []);
    let sea = 0, port = 0, standby = 0;

    seatimes.forEach(x => {
      const d = Number(x.days) || 0;
      const t = x.type || "Sea";
      if (t === "Sea") sea += d;
      else if (t === "Port") port += d;
      else if (t === "Standby") standby += d;
    });

    const total = sea + port + standby;

    if (kpiSea) kpiSea.textContent = String(sea);
    if (kpiPort) kpiPort.textContent = String(port);
    if (kpiStandby) kpiStandby.textContent = String(standby);
    if (kpiTotalDays) kpiTotalDays.textContent = String(total);
  }

  function renderDashboardProfile() {
    const dashAvatar = document.getElementById("dashAvatar");
    const dashProfileName = document.getElementById("dashProfileName");
    const dashProfileLine1 = document.getElementById("dashProfileLine1");
    const dashProfileLine2 = document.getElementById("dashProfileLine2");
    const dashProfileLine3 = document.getElementById("dashProfileLine3");
    const dashPublicProfileLink = document.getElementById("dashPublicProfileLink");
    const dashPublicProfileStatus = document.getElementById("dashPublicProfileStatus");

    if (!dashProfileName && !dashAvatar) return;

    const p = Seav.load("seav_profile", {
      name: "Demo User",
      rank: "",
      nationality: "",
      dob: "",
      location: "",
      email: "",
      phone: "",
      photo: null,
      publicEnabled: false
    });

    if (dashProfileName) dashProfileName.textContent = p.name || "Demo User";

if (dashProfileLine1) {
  dashProfileLine1.textContent = `${p.rank || "—"} • ${p.nationality || "—"}`;
}
if (dashProfileLine2) {
  dashProfileLine2.textContent = `${p.dob || "—"} • ${p.location || "—"}`;
}
if (dashProfileLine3) {
  dashProfileLine3.textContent = `${p.email || "—"} • ${p.phone || "—"}`;
}

    if (dashAvatar) {
      if (p.photo && p.photo.dataUrl) {
        dashAvatar.style.backgroundImage = `url(${p.photo.dataUrl})`;
        dashAvatar.style.backgroundSize = "cover";
        dashAvatar.style.backgroundPosition = "center";
      } else {
        dashAvatar.style.backgroundImage = "";
      }
    }

    if (dashPublicProfileLink && dashPublicProfileStatus) {
      if (p.publicEnabled) {
        dashPublicProfileLink.style.display = "inline";
        dashPublicProfileStatus.style.display = "none";
      } else {
        dashPublicProfileLink.style.display = "none";
        dashPublicProfileStatus.style.display = "inline";
        dashPublicProfileStatus.textContent = "Private";
      }
    }
  }

  function renderDashboardSnippets() {
    const dashSeatimeSnippet = document.getElementById("dashSeatimeSnippet");
    const dashCertSnippet = document.getElementById("dashCertSnippet");
    const dashVesselSnippet = document.getElementById("dashVesselSnippet");
    const dashRefSnippet = document.getElementById("dashRefSnippet");

    if (!dashSeatimeSnippet && !dashCertSnippet && !dashVesselSnippet && !dashRefSnippet) return;

    // Sea time (latest)
    if (dashSeatimeSnippet) {
      const seatimes = Seav.load("seav_seatimes", []);
      const x = seatimes[0];
      dashSeatimeSnippet.innerHTML = !x
        ? `<div class="muted">No sea time yet.</div>`
        : `
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Vessel</th><th>Role</th><th>From</th><th>To</th><th>Type</th><th>Days</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${Seav.escapeHtml(x.vessel)}</td>
                  <td>${Seav.escapeHtml(x.role)}</td>
                  <td>${Seav.escapeHtml(x.from)}</td>
                  <td>${Seav.escapeHtml(x.to)}</td>
                  <td>${Seav.escapeHtml(x.type || "Sea")}</td>
                  <td>${Number(x.days) || 0}</td>
                  <td><span class="pill">${Seav.escapeHtml(x.status || "Logged")}</span></td>
                </tr>
              </tbody>
            </table>
          </div>`;
    }

   // Certificates (latest / warning-focused)
if (dashCertSnippet) {
  const certs = Seav.load("seav_certs", []);

  if (!certs.length) {
    dashCertSnippet.innerHTML = `<div class="muted">No certificates yet.</div>`;
  } else {
    function getCertExpiryInfo(expiry) {
      if (window.SeavCerts?.getCertExpiryInfo) {
        return window.SeavCerts.getCertExpiryInfo(expiry);
      }

      if (!expiry) {
        return { label: "No Expiry", badge: "No Expiry" };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const exp = new Date(expiry);
      exp.setHours(0, 0, 0, 0);

      const diffMs = exp - today;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays < 0) return { label: "Expired", badge: "Expired" };
      if (diffDays <= 60) return { label: `Expires in ${diffDays} day${diffDays === 1 ? "" : "s"}`, badge: "Expires Soon" };
      return { label: `Valid for ${diffDays} day${diffDays === 1 ? "" : "s"}`, badge: "Valid" };
    }

    const sortedCerts = [...certs].sort((a, b) => {
      const aInfo = getCertExpiryInfo(a.expiry);
      const bInfo = getCertExpiryInfo(b.expiry);

      const aScore = aInfo.badge === "Expired" ? 0 : aInfo.badge === "Expires Soon" ? 1 : aInfo.badge === "Valid" ? 2 : 3;
      const bScore = bInfo.badge === "Expired" ? 0 : bInfo.badge === "Expires Soon" ? 1 : bInfo.badge === "Valid" ? 2 : 3;

      if (aScore !== bScore) return aScore - bScore;

      const aDate = a.expiry ? new Date(a.expiry) : new Date("9999-12-31");
      const bDate = b.expiry ? new Date(b.expiry) : new Date("9999-12-31");
      return aDate - bDate;
    });

    const c = sortedCerts[0];
    const expiryInfo = getCertExpiryInfo(c.expiry);
    const hasFile = !!(c.attachment && c.attachment.dataUrl);

    const attachHtml = hasFile
      ? `<div class="list-sub" style="margin-top:6px;">
           <a href="${c.attachment.dataUrl}" download="${Seav.escapeHtml(c.attachment.filename)}">Download attachment</a>
         </div>`
      : ``;

    dashCertSnippet.innerHTML = `
      <div class="list">
        <div class="list-row">
          <div style="min-width:0;">
            <div class="list-title">${Seav.escapeHtml(c.name)}</div>
            <div class="list-sub">
              Expiry: ${Seav.escapeHtml(c.expiry || "—")} • ${Seav.escapeHtml(expiryInfo.label)}
            </div>
            ${attachHtml}
          </div>
          <span class="pill">${Seav.escapeHtml(expiryInfo.badge)}</span>
        </div>
      </div>`;
  }
}

    // Vessels (current)
if (dashVesselSnippet) {
  const vessels = Seav.load("seav_vessels", []);

  if (!vessels.length) {
    dashVesselSnippet.innerHTML = `<div class="muted">No vessels yet.</div>`;
  } else {
    let currentIndex = vessels.findIndex(v => !v.to || !String(v.to).trim());

    if (currentIndex === -1) {
      currentIndex = vessels.reduce((latestIdx, vessel, idx, arr) => {
        const currentDate = vessel.to ? new Date(vessel.to) : new Date(0);
        const latestDate = arr[latestIdx].to ? new Date(arr[latestIdx].to) : new Date(0);
        return currentDate > latestDate ? idx : latestIdx;
      }, 0);
    }

    const v = vessels[currentIndex];

    const hasPhoto = !!(v.photo && v.photo.dataUrl);
    const photoHtml = hasPhoto
      ? `<img src="${v.photo.dataUrl}" alt="${Seav.escapeHtml(v.name)}" />`
      : `<div class="vessel-photo-fallback">No Photo</div>`;

    const flag = v.flag ? Seav.escapeHtml(v.flag) : "—";
    const gt = v.gt ? Seav.escapeHtml(v.gt) : "—";
    const from = v.from ? Seav.escapeHtml(v.from) : "—";
    const to = v.to ? Seav.escapeHtml(v.to) : "Present";
    const desc = v.desc ? Seav.escapeHtml(v.desc) : "";

    dashVesselSnippet.innerHTML = `
      <article class="vessel-card">
        <div class="vessel-photo">${photoHtml}</div>
        <div class="vessel-body">
          <h3 class="vessel-title">${Seav.escapeHtml(v.name)}</h3>
          <div class="vessel-meta">
            <span>Flag: ${flag}</span>
            <span>GT: ${gt}</span>
          </div>
          ${v.role ? `<div class="vessel-meta"><span>Role: ${Seav.escapeHtml(v.role)}</span></div>` : ``}
          ${v.type ? `<div class="vessel-meta"><span>Type: ${Seav.escapeHtml(v.type)}</span></div>` : ``}
          ${v.program ? `<div class="vessel-meta"><span>Program: ${Seav.escapeHtml(v.program)}</span></div>` : ``}
          ${desc ? `<div class="vessel-desc">${desc}</div>` : ``}
          <div class="vessel-foot">
            <div class="vessel-dates">${from} → ${to}</div>
          </div>
        </div>
      </article>`;
  }
}

    // References (latest)
    if (dashRefSnippet) {
      const refs = Seav.load("seav_refs", []);
      const r = refs[0];
      if (!r) {
        dashRefSnippet.innerHTML = `<div class="muted">No references yet.</div>`;
      } else {
        const hasFile = !!(r.attachment && r.attachment.dataUrl);
        const attachHtml = hasFile
          ? `<div class="row-actions" style="margin-top:10px;">
               <a href="${r.attachment.dataUrl}" download="${Seav.escapeHtml(r.attachment.filename)}">
                 Download attachment (${Seav.escapeHtml(r.attachment.filename)})
               </a>
             </div>`
          : ``;

        dashRefSnippet.innerHTML = `
          <div class="list">
            <div class="list-row">
              <div style="min-width:0;">
                <div class="list-title">${Seav.escapeHtml(r.name)} <span class="muted">(${Seav.escapeHtml(r.verified || "Pending")})</span></div>
                <div class="list-sub">${Seav.escapeHtml(r.title || "—")} • ${Seav.escapeHtml(r.date || "—")}</div>
                <div class="list-sub" style="text-transform:none;letter-spacing:0;line-height:1.5;margin-top:8px;color:rgba(255,255,255,0.78);font-weight:600;">
                  “${Seav.escapeHtml(r.text)}”
                </div>
                ${attachHtml}
              </div>
              <span class="pill">${Seav.escapeHtml(r.verified || "Pending")}</span>
            </div>
          </div>`;
      }
    }
  }

  function refresh() {
    updateDayTypeKpis();
    renderDashboardProfile();
    renderDashboardSnippets();
  }

  function initDashboard() {
    // Only run if we’re actually on dashboard
    const isDashboard =
      document.getElementById("dashSeatimeSnippet") ||
      document.getElementById("dashProfileName") ||
      document.getElementById("kpiTotalDays");

    if (!isDashboard) return;

    refresh();

    // If profile/seatime/etc is saved in another tab or page, dashboard updates automatically
    window.addEventListener("storage", (ev) => {
      if (!ev.key) return;
      if (ev.key.startsWith("seav_")) refresh();
    });
  }

  document.addEventListener("DOMContentLoaded", initDashboard);

  // Optional: allow other scripts to trigger a refresh
  window.SeavDashboard = { refresh };
})();