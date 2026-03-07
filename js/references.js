// /js/references.js
(function () {
  "use strict";

  function maskCoc(coc) {
    const raw = String(coc || "").trim();
    if (!raw) return "—";
    if (raw.length <= 4) return raw;
    return `${"*".repeat(Math.max(0, raw.length - 4))}${raw.slice(-4)}`;
  }

  function renderRefs() {
    const refsList = document.getElementById("refsList");
    if (!refsList && !document.getElementById("refForm")) return;

    const refs = Seav.load("seav_refs", []);
    if (!refsList) return;

    if (refs.length === 0) {
      refsList.innerHTML = `
        <div class="list-row">
          <div>
            <div class="list-title">No references yet</div>
            <div class="list-sub">Add one from a Captain or Senior Officer.</div>
          </div>
          <span class="pill">Draft</span>
        </div>
      `;
      return;
    }

    refsList.innerHTML = refs.map((r, idx) => {
      const hasFile = !!(r.attachment && r.attachment.dataUrl);
      const attachHtml = hasFile
        ? `<div class="row-actions" style="margin-top:10px;">
             <a href="${r.attachment.dataUrl}" download="${Seav.escapeHtml(r.attachment.filename)}">
               Download attachment (${Seav.escapeHtml(r.attachment.filename)})
             </a>
           </div>`
        : `<div class="muted" style="margin-top:10px;font-size:12px;text-transform:uppercase;letter-spacing:0.6px;font-weight:800;">
             No attachment
           </div>`;

      const vesselLine = (r.vessel || r.role || r.period)
        ? `<div class="list-sub">${Seav.escapeHtml(r.vessel || "—")} • ${Seav.escapeHtml(r.role || "—")} • ${Seav.escapeHtml(r.period || "—")}</div>`
        : "";

      const verification = r.verification || {};
      const verifiedHtml = r.status === "Verified"
        ? `
          <div class="list-sub" style="margin-top:10px;text-transform:none;letter-spacing:0;line-height:1.5;">
            <strong>Verified by:</strong> ${Seav.escapeHtml(r.name || "—")}<br>
            <strong>Rank:</strong> ${Seav.escapeHtml(verification.rank || "—")}<br>
            <strong>CoC:</strong> ${Seav.escapeHtml(maskCoc(verification.cocNumber))}<br>
            <strong>Signed:</strong> ${Seav.escapeHtml(verification.signedAt || "—")}
          </div>
          ${verification.note ? `
            <div class="list-sub" style="margin-top:8px;text-transform:none;letter-spacing:0;line-height:1.5;color:rgba(255,255,255,0.78);font-weight:600;">
              “${Seav.escapeHtml(verification.note)}”
            </div>
          ` : ``}
        `
        : "";

      const canSend = !!r.email && (r.status === "Draft" || !r.status);
      const canVerify = r.status === "Draft" || r.status === "Sent for Verification" || !r.status;

      return `
        <div class="list-row">
          <div style="min-width:0;">
            <div class="list-title">
              ${Seav.escapeHtml(r.name)}
              <span class="muted">(${Seav.escapeHtml(r.status || "Draft")})</span>
            </div>

            <div class="list-sub">${Seav.escapeHtml(r.title || "—")} • ${Seav.escapeHtml(r.date || "—")}</div>
            ${vesselLine}

            <div class="list-sub" style="text-transform:none;letter-spacing:0;line-height:1.5;margin-top:8px;color:rgba(255,255,255,0.78);font-weight:600;">
              “${Seav.escapeHtml(r.text)}”
            </div>

            ${attachHtml}
            ${verifiedHtml}
          </div>

          <div class="row-actions" style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
            ${canSend ? `<a href="#" data-send-ref="${idx}">Send</a>` : ``}
            ${canVerify ? `<a href="#" data-verify-ref="${idx}">Verify</a>` : ``}
            <a href="#" data-del-ref="${idx}">Delete</a>
          </div>
        </div>
      `;
    }).join("");
  }

  function openVerifyModal(ref, idx) {
    const verification = ref.verification || {};

    document.getElementById("rv_index").value = String(idx);
    document.getElementById("rv_confirmed").checked = !!verification.confirmed;
    document.getElementById("rv_note").value = verification.note || "";
    document.getElementById("rv_rank").value = verification.rank || ref.title || "";
    document.getElementById("rv_coc").value = verification.cocNumber || "";
    document.getElementById("rv_signature").value = verification.signatureName || "";
    document.getElementById("rv_signed_at").value = verification.signedAt || "";

    if (window.SeavModals?.openModal) window.SeavModals.openModal("refVerifyModal");
  }

  function initReferences() {
    if (
      !document.getElementById("refsList") &&
      !document.getElementById("refForm") &&
      !document.getElementById("refVerifyForm")
    ) return;

    renderRefs();

    const refForm = document.getElementById("refForm");
    if (refForm) {
      refForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("rf_name")?.value.trim();
        const title = document.getElementById("rf_title")?.value.trim();
        const email = document.getElementById("rf_email")?.value.trim();
        const vessel = document.getElementById("rf_vessel")?.value.trim();
        const role = document.getElementById("rf_role")?.value.trim();
        const period = document.getElementById("rf_period")?.value.trim();
        const text = document.getElementById("rf_text")?.value.trim();
        const date = document.getElementById("rf_date")?.value || "";
        const status = document.getElementById("rf_status")?.value || "Draft";

        if (!name || !text) return;

        const file = document.getElementById("rf_file")?.files?.[0] || null;

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

        const refs = Seav.load("seav_refs", []);
        refs.unshift({
          id: `ref_${Date.now()}`,
          name,
          title,
          email,
          vessel,
          role,
          period,
          text,
          date,
          status,
          attachment,
          verification: {
            confirmed: false,
            note: "",
            rank: "",
            cocNumber: "",
            signatureName: "",
            signedAt: ""
          }
        });

        Seav.save("seav_refs", refs);

        refForm.reset();
        if (window.SeavModals?.closeAllModals) window.SeavModals.closeAllModals();

        renderRefs();
        if (window.SeavDashboard?.refresh) window.SeavDashboard.refresh();
      });
    }

    const verifyForm = document.getElementById("refVerifyForm");
    if (verifyForm) {
      verifyForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const idx = Number(document.getElementById("rv_index")?.value);
        const confirmed = !!document.getElementById("rv_confirmed")?.checked;
        const note = document.getElementById("rv_note")?.value.trim() || "";
        const rank = document.getElementById("rv_rank")?.value.trim() || "";
        const cocNumber = document.getElementById("rv_coc")?.value.trim() || "";
        const signatureName = document.getElementById("rv_signature")?.value.trim() || "";
        const signedAt = document.getElementById("rv_signed_at")?.value || "";

        const refs = Seav.load("seav_refs", []);
        if (!refs[idx]) return;

        refs[idx].verification = {
          confirmed,
          note,
          rank,
          cocNumber,
          signatureName,
          signedAt
        };

        refs[idx].status = confirmed ? "Verified" : "Declined";

        Seav.save("seav_refs", refs);

        verifyForm.reset();
        if (window.SeavModals?.closeAllModals) window.SeavModals.closeAllModals();

        renderRefs();
        if (window.SeavDashboard?.refresh) window.SeavDashboard.refresh();
      });
    }

    document.addEventListener("click", (e) => {
      const sendBtn = e.target.closest("[data-send-ref]");
      if (sendBtn) {
        e.preventDefault();
        const idx = Number(sendBtn.getAttribute("data-send-ref"));
        const refs = Seav.load("seav_refs", []);
        if (!refs[idx]) return;

        refs[idx].status = "Sent for Verification";
        Seav.save("seav_refs", refs);

        renderRefs();
        if (window.SeavDashboard?.refresh) window.SeavDashboard.refresh();
        return;
      }

      const verifyBtn = e.target.closest("[data-verify-ref]");
      if (verifyBtn) {
        e.preventDefault();
        const idx = Number(verifyBtn.getAttribute("data-verify-ref"));
        const refs = Seav.load("seav_refs", []);
        const ref = refs[idx];
        if (!ref) return;

        openVerifyModal(ref, idx);
        return;
      }

      const delBtn = e.target.closest("[data-del-ref]");
      if (delBtn) {
        e.preventDefault();
        const idx = Number(delBtn.getAttribute("data-del-ref"));
        const refs = Seav.load("seav_refs", []);
        refs.splice(idx, 1);
        Seav.save("seav_refs", refs);

        renderRefs();
        if (window.SeavDashboard?.refresh) window.SeavDashboard.refresh();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", initReferences);
})();