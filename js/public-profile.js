// /js/public-profile.js
(function () {
  "use strict";

  function toNumber(val) {
    const n = Number(val);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  function totalQualifyingDays(entry) {
    return (
      toNumber(entry.actualSeaServiceDays) +
      toNumber(entry.standbyServiceDays) +
      toNumber(entry.yardServiceDays) +
      toNumber(entry.watchkeepingDays)
    );
  }

  function updateKpis() {
    const kpiSea = document.getElementById("kpiSea");
    const kpiPort = document.getElementById("kpiPort");
    const kpiStandby = document.getElementById("kpiStandby");
    const kpiTotalDays = document.getElementById("kpiTotalDays");

    const seatimes = Seav.load("seav_seatimes", []);
    let sea = 0;
    let port = 0;
    let standby = 0;
    let watchkeeping = 0;

seatimes.forEach((x) => {
  sea += Number(x.actualSeaServiceDays) || 0;
  port += Number(x.yardServiceDays) || 0;
  standby += Number(x.standbyServiceDays) || 0;
  watchkeeping += Number(x.watchkeepingDays) || 0;
});

const total = sea + port + standby + watchkeeping;

    if (kpiSea) kpiSea.textContent = String(sea);
    if (kpiPort) kpiPort.textContent = String(port);
    if (kpiStandby) kpiStandby.textContent = String(standby);
    if (kpiTotalDays) kpiTotalDays.textContent = String(total);
  }

  function renderHeaderProfile(p) {
    const nameEl = document.getElementById("pp_name");
    const rankEl = document.getElementById("pp_rank");
    const natEl = document.getElementById("pp_nationality");
    const locationEl = document.getElementById("pp_location");
    const bioEl = document.getElementById("pp_bio");
    const avatar = document.getElementById("ppAvatar");

    if (nameEl) nameEl.textContent = p.name || "Demo User";
    if (rankEl) rankEl.textContent = `Rank: ${p.rank || "—"}`;
    if (natEl) natEl.textContent = `Nationality: ${p.nationality || "—"}`;
    if (locationEl) locationEl.textContent = `Location: ${p.location || "—"}`;
    if (bioEl) bioEl.textContent = p.bio || "Professional maritime profile.";

    if (avatar) {
      if (p.photo && p.photo.dataUrl) {
        avatar.style.backgroundImage = `url(${p.photo.dataUrl})`;
        avatar.style.backgroundSize = "cover";
        avatar.style.backgroundPosition = "center";
      } else {
        avatar.style.backgroundImage = "";
      }
    }
  }

  function renderSnippets() {
    const seatBox = document.getElementById("ppSeatimeSnippet");
    const certBox = document.getElementById("ppCertSnippet");
    const vesselBox = document.getElementById("ppVesselSnippet");
    const refBox = document.getElementById("ppRefSnippet");

    // Latest seatime
    if (seatBox) {
      const seatimes = Seav.load("seav_seatimes", []);
      const x = seatimes[0];

      if (!x) {
        seatBox.innerHTML = `<div class="muted">No sea time yet.</div>`;
      } else {
        const totalDays = totalQualifyingDays(x);

        seatBox.innerHTML = `
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Vessel</th>
                  <th>Role</th>
                  <th>Date Joined</th>
                  <th>Date Left</th>
                  <th>Total Days</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${Seav.escapeHtml(x.vesselName || "—")}</td>
                  <td>${Seav.escapeHtml(x.capacityServed || "—")}</td>
                  <td>${Seav.escapeHtml(x.dateJoined || "—")}</td>
                  <td>${Seav.escapeHtml(x.dateLeft || "—")}</td>
                  <td>${totalDays}</td>
                  <td><span class="pill">${Seav.escapeHtml(x.verificationStatus || "Logged")}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
      }
    }

    // Latest cert
    if (certBox) {
      const certs = Seav.load("seav_certs", []);
      const c = certs[0];

      if (!c) {
        certBox.innerHTML = `<div class="muted">No certificates yet.</div>`;
      } else {
        const hasFile = !!(c.attachment && c.attachment.dataUrl);
        const attachHtml = hasFile
          ? `<div class="list-sub" style="margin-top:6px;">
               <a href="${c.attachment.dataUrl}" download="${Seav.escapeHtml(c.attachment.filename)}">Download attachment</a>
             </div>`
          : ``;

        certBox.innerHTML = `
          <div class="list">
            <div class="list-row">
              <div style="min-width:0;">
                <div class="list-title">${Seav.escapeHtml(c.name)}</div>
                <div class="list-sub">Expiry: ${Seav.escapeHtml(c.expiry || "—")} • Status: ${Seav.escapeHtml(c.status || "Valid")}</div>
                ${attachHtml}
              </div>
              <span class="pill">${Seav.escapeHtml(c.status || "Valid")}</span>
            </div>
          </div>
        `;
      }
    }

    // Latest vessel
    if (vesselBox) {
      const vessels = Seav.load("seav_vessels", []);
      const v = vessels[0];

      if (!v) {
        vesselBox.innerHTML = `<div class="muted">No vessels yet.</div>`;
      } else {
        const hasPhoto = !!(v.photo && v.photo.dataUrl);
        const photoHtml = hasPhoto
          ? `<img src="${v.photo.dataUrl}" alt="${Seav.escapeHtml(v.name)}" />`
          : `<div class="vessel-photo-fallback">No Photo</div>`;

        const flag = v.flag ? Seav.escapeHtml(v.flag) : "—";
        const gt = v.gt ? Seav.escapeHtml(v.gt) : "—";
        const from = v.from ? Seav.escapeHtml(v.from) : "—";
        const to = v.to ? Seav.escapeHtml(v.to) : "—";
        const desc = v.desc ? Seav.escapeHtml(v.desc) : "";

        vesselBox.innerHTML = `
          <article class="vessel-card">
            <div class="vessel-photo">${photoHtml}</div>
            <div class="vessel-body">
              <h3 class="vessel-title">${Seav.escapeHtml(v.name)}</h3>
              <div class="vessel-meta">
                <span>Flag: ${flag}</span>
                <span>GT: ${gt}</span>
              </div>
              ${desc ? `<div class="vessel-desc">${desc}</div>` : ``}
              <div class="vessel-foot">
                <div class="vessel-dates">${from} → ${to}</div>
              </div>
            </div>
          </article>
        `;
      }
    }

    // Latest reference
    if (refBox) {
      const refs = Seav.load("seav_refs", []);
      const r = refs[0];

      if (!r) {
        refBox.innerHTML = `<div class="muted">No references yet.</div>`;
      } else {
        const hasFile = !!(r.attachment && r.attachment.dataUrl);
        const attachHtml = hasFile
          ? `<div class="row-actions" style="margin-top:10px;">
               <a href="${r.attachment.dataUrl}" download="${Seav.escapeHtml(r.attachment.filename)}">
                 Download attachment (${Seav.escapeHtml(r.attachment.filename)})
               </a>
             </div>`
          : ``;

        refBox.innerHTML = `
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
          </div>
        `;
      }
    }
  }

  function initPublicProfile() {
    const gate = document.getElementById("ppGate");
    const content = document.getElementById("ppContent");

    const p = Seav.load("seav_profile", null);

    if (!p) {
      if (gate) gate.hidden = false;
      if (content) content.style.display = "none";
      return;
    }

    if (!p.publicEnabled) {
      if (gate) gate.hidden = false;
      if (content) content.style.display = "none";
      return;
    }

    if (gate) gate.hidden = true;
    if (content) content.style.display = "block";

    renderHeaderProfile(p);
    updateKpis();
    renderSnippets();
  }

  document.addEventListener("DOMContentLoaded", initPublicProfile);
})();