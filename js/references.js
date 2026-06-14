// /js/references.js
(function () {
  "use strict";

  if (!window.Seav) {
    console.warn("[SEA-V] Seav core not found. Did you include js/core.js before references.js?");
    return;
  }

  if (!window.SeavAPI) {
    console.warn("[SEA-V] SeavAPI not found. Did you include js/api.js before references.js?");
    return;
  }

  if (!window.SeavData) {
    console.warn("[SEA-V] SeavData not found. Did you include js/seav-data.js before references.js?");
    return;
  }

  if (!window.SeavState) {
    console.warn("[SEA-V] SeavState not found. Did you include js/state.js before references.js?");
    return;
  }

  const { KEYS, createId, getSortedVesselOptions, formatDatePretty } = window.SeavData;
  const STORAGE_KEY = KEYS.REFS;

  function getRefs() {
    return window.SeavState?.refs || [];
  }

  function getVessels() {
    return window.SeavState?.vessels || [];
  }

  function maskCoc(coc) {
    const raw = String(coc || "").trim();
    if (!raw) return "—";
    if (raw.length <= 4) return raw;
    return `${"*".repeat(Math.max(0, raw.length - 4))}${raw.slice(-4)}`;
  }

  function populateReferenceVesselOptions() {
  const select = document.getElementById("rf_vessel");
  if (!select || select.tagName !== "SELECT") return;

  const currentValue = select.value || "";
  const vessels = getSortedVesselOptions(getVessels());

  select.innerHTML = `
    <option value="">Choose from your vessel list</option>
    ${vessels
      .map(
        (v) =>
          `<option value="${Seav.escapeHtml(v.id)}">${Seav.escapeHtml(v.name)}</option>`
      )
      .join("")}
  `;

  if (currentValue) {
    select.value = currentValue;
  }
}

  function renderRefs() {
    const refsList = document.getElementById("refsList");
    if (!refsList && !document.getElementById("refForm")) return;
    if (!refsList) return;

    const refs = getRefs();

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

    refsList.innerHTML = refs
      .map((r) => {
        const refId = r.id || "";
        const refFileUrl = r.attachment?.url || r.attachment?.dataUrl || "";
        const hasFile = !!refFileUrl;
        const attachHtml = hasFile
          ? `<div class="row-actions" style="margin-top:10px;">
              <a href="${Seav.escapeHtml(refFileUrl)}" target="_blank">
             Download attachment${r.attachment?.filename ? ` (${Seav.escapeHtml(r.attachment.filename)})` : ""}
            </a>
          </div>`
          : `<div class="muted" style="margin-top:10px;font-size:12px;text-transform:uppercase;letter-spacing:0.6px;font-weight:800;">
               No attachment
             </div>`;

       const vessel = getVessels().find((v) => v.id === r.vesselId);
       const vesselLabel = vessel?.name || "";

       const vesselLine =
          vesselLabel || r.role || r.period
         ? `<div class="list-sub">${Seav.escapeHtml(vesselLabel || "—")} • ${Seav.escapeHtml(r.role || "—")} • ${Seav.escapeHtml(r.period || "—")}</div>`
        : "";

        const verification = r.verification || {};
        const verifiedHtml =
          r.status === "Verified"
            ? `
          <div class="list-sub" style="margin-top:10px;text-transform:none;letter-spacing:0;line-height:1.5;">
            <strong>Verified by:</strong> ${Seav.escapeHtml(r.name || "—")}<br>
            <strong>Rank:</strong> ${Seav.escapeHtml(verification.rank || "—")}<br>
            <strong>CoC:</strong> ${Seav.escapeHtml(maskCoc(verification.cocNumber))}<br>
            <strong>Signed:</strong> ${Seav.escapeHtml(verification.signedAt || "—")}
          </div>
          ${
            verification.note
              ? `
            <div class="list-sub" style="margin-top:8px;text-transform:none;letter-spacing:0;line-height:1.5;color:rgba(255,255,255,0.78);font-weight:600;">
              “${Seav.escapeHtml(verification.note)}”
            </div>
          `
              : ``
          }
        `
            : "";

        const canSend = !!r.email && (r.status === "Draft" || !r.status);
        const canVerify = r.status === "Draft" || r.status === "Sent for Verification" || !r.status;

 return `
  <div class="reference-modern-card ui-card ui-card-hover ui-accent-purple">

    <div class="reference-modern-top">

      <div class="reference-modern-left">

        <div class="reference-avatar">
          ${(r.name || "?").charAt(0).toUpperCase()}
        </div>

        <div>

          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <h3 class="reference-modern-name">
              ${Seav.escapeHtml(r.name)}
            </h3>

            ${
              r.status === "Verified"
                ? `<span class="reference-verified-pill">Verified</span>`
                : ``
            }
          </div>

          <div class="reference-modern-meta">
            ${Seav.escapeHtml(r.title || "—")} • ${formatDatePretty(r.date)}
          </div>

          ${
            vesselLine
              ? `<div class="reference-modern-meta" style="margin-top:6px;">
                  ${Seav.escapeHtml(vesselLabel || "—")} •
                  ${Seav.escapeHtml(r.role || "—")} •
                  ${Seav.escapeHtml(r.period || "—")}
                </div>`
              : ``
          }

          <div
            class="reference-modern-value"
            style="margin-top:18px;font-style:italic;"
          >
            “${Seav.escapeHtml(r.text)}”
          </div>

        </div>

      </div>

      ${Seav.seavActions(
        `${Seav.seavAction("edit", "Edit", `data-edit-ref-id="${Seav.escapeHtml(refId)}"`)}${
          canSend
            ? Seav.seavAction("secondary", "Send", `data-send-ref-id="${Seav.escapeHtml(refId)}"`)
            : ""
        }${
          canVerify
            ? Seav.seavAction(
                "secondary",
                "Verify",
                `data-verify-ref-id="${Seav.escapeHtml(refId)}"`
              )
            : ""
        }${Seav.seavAction("delete", "Delete", `data-del-ref-id="${Seav.escapeHtml(refId)}"`)}`
      )}

    </div>

    <div class="reference-modern-grid">

<div class="reference-modern-box">
  <div class="reference-modern-label">
    Attachment
  </div>

  <div class="reference-modern-value">
    ${
      hasFile
        ? `
          <a
            class="reference-modern-attachment"
            href="${Seav.escapeHtml(refFileUrl)}"
            target="_blank"
          >
            Download Attachment
          </a>
        `
        : `No attachment`
    }
  </div>
</div>

      <div class="reference-modern-box">
        <div class="reference-modern-label">
          Verification
        </div>

        <div class="reference-modern-value">
          Verified by: ${Seav.escapeHtml(r.name || "—")}<br>
          Rank: ${Seav.escapeHtml(verification.rank || "—")}
        </div>
      </div>

      <div class="reference-modern-box">
        <div class="reference-modern-label">
          Certification
        </div>

        <div class="reference-modern-value">
          CoC: ${Seav.escapeHtml(maskCoc(verification.cocNumber))}<br>
          Signed: ${Seav.escapeHtml(verification.signedAt || "—")}
        </div>
      </div>

    </div>

  </div>
`;
      })
      .join("");
  }

  function openVerifyModal(ref) {
    const verification = ref.verification || {};

    document.getElementById("rv_index").value = ref.id || "";
    document.getElementById("rv_confirmed").checked = !!verification.confirmed;
    document.getElementById("rv_note").value = verification.note || "";
    document.getElementById("rv_rank").value = verification.rank || ref.title || "";
    document.getElementById("rv_coc").value = verification.cocNumber || "";
    document.getElementById("rv_signature").value = verification.signatureName || "";
    Seav.setDateTriplet("rv_signed_at", verification.signedAt || "");

    if (window.SeavModals?.openModal) window.SeavModals.openModal("refVerifyModal");
  }

function fillReferenceForm(ref) {
  const editId = document.getElementById("rf_edit_id");
  if (editId) editId.value = ref.id || "";

  document.getElementById("rf_name").value = ref.name || "";
  document.getElementById("rf_title").value = ref.title || "";
  document.getElementById("rf_email").value = ref.email || "";

  const vesselField = document.getElementById("rf_vessel");
  if (vesselField) {
    vesselField.value = ref.vesselId || "";
  }

  document.getElementById("rf_role").value = ref.role || "";
  document.getElementById("rf_period").value = ref.period || "";
  document.getElementById("rf_text").value = ref.text || "";
  Seav.setDateTriplet("rf_date", ref.date || "");
  document.getElementById("rf_status").value = ref.status || "Draft";

  if (window.SeavModals?.openModal) window.SeavModals.openModal("refModal");
}

function resetReferenceForm(form) {
  form.reset();

  const editId = document.getElementById("rf_edit_id");
  if (editId) editId.value = "";

  Seav.clearDateTriplet("rf_date");
}

function readReferenceForm() {
  const vesselValue = document.getElementById("rf_vessel")?.value || "";

  return {
    id: document.getElementById("rf_edit_id")?.value || "",
    name: document.getElementById("rf_name")?.value.trim(),
    title: document.getElementById("rf_title")?.value.trim() || "",
    email: document.getElementById("rf_email")?.value.trim() || "",
    vesselId: vesselValue,
    role: document.getElementById("rf_role")?.value.trim() || "",
    period: document.getElementById("rf_period")?.value.trim() || "",
    text: document.getElementById("rf_text")?.value.trim() || "",
    date: Seav.readDateTriplet("rf_date"),
    status: document.getElementById("rf_status")?.value || "Draft",
    file: document.getElementById("rf_file")?.files?.[0] || null
  };
}

  async function buildReferenceAttachment(file, existingAttachment, refId) {
    return window.SeavUpload?.uploadToStorage({
      bucket: "reference-files",
      entityId: refId,
      file,
      existingMeta: existingAttachment,
      kind: "Reference"
    }) ?? existingAttachment ?? null;
  }

  async function saveReferenceData(refData) {
    await SeavAPI.upsertItemById(STORAGE_KEY, refData);
  }

  function initReferences() {
    if (
      !document.getElementById("refsList") &&
      !document.getElementById("refForm") &&
      !document.getElementById("refVerifyForm")
    ) return;

    const runRefresh = () => {
  populateReferenceVesselOptions();
  renderRefs();
};

    if (window.SeavState?.ready) {
      runRefresh();
    } else {
      document.addEventListener("seav:state-ready", runRefresh, { once: true });
    }

    const refForm = document.getElementById("refForm");
    if (refForm) {
      refForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = readReferenceForm();
        if (!formData.name || !formData.text) return;

        const existingRef = formData.id
         ? getRefs().find((item) => item.id === formData.id) || null
         : null;

        await Seav.withSaving(async () => {
        const refId = formData.id || createId("ref");

       const attachment = await buildReferenceAttachment(
        formData.file,
        existingRef?.attachment || null,
        refId
     );
        if (formData.file && !attachment) return;

        const now = new Date().toISOString();

        await saveReferenceData({
        id: refId,
        name: formData.name,
        title: formData.title,
        email: formData.email,
        vesselId: formData.vesselId,
        role: formData.role,
        period: formData.period,
        text: formData.text,
        date: formData.date,
        status: formData.status,
        attachment,
        verification: existingRef?.verification || {
        confirmed: false,
        note: "",
        rank: "",
        cocNumber: "",
        signatureName: "",
        signedAt: ""
        },
        createdAt: existingRef?.createdAt || now,
        updatedAt: now
      });

        resetReferenceForm(refForm);
        if (window.SeavModals?.closeAllModals) window.SeavModals.closeAllModals();

        Seav.notify("success", "Reference saved", "Stored in your professional record.");

        if (window.Seav.app?.refreshAll) {
          await window.Seav.app.refreshAll();
        } else {
          renderRefs();
        }
        }, { sub: "Saving reference" });
      });
    }

    const verifyForm = document.getElementById("refVerifyForm");
    if (verifyForm) {
      verifyForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const refId = document.getElementById("rv_index")?.value || "";
        const confirmed = !!document.getElementById("rv_confirmed")?.checked;
        const note = document.getElementById("rv_note")?.value.trim() || "";
        const rank = document.getElementById("rv_rank")?.value.trim() || "";
        const cocNumber = document.getElementById("rv_coc")?.value.trim() || "";
        const signatureName = document.getElementById("rv_signature")?.value.trim() || "";
        const signedAt = Seav.readDateTriplet("rv_signed_at");

        const ref = getRefs().find((item) => item.id === refId);
        if (!ref) return;

        await Seav.withSaving(async () => {
        const updatedRef = {
          ...ref,
          verification: {
            confirmed,
            note,
            rank,
            cocNumber,
            signatureName,
            signedAt
          },
          status: confirmed ? "Verified" : "Declined"
        };

        await SeavAPI.updateItemById(STORAGE_KEY, refId, updatedRef);

        verifyForm.reset();
        if (window.SeavModals?.closeAllModals) window.SeavModals.closeAllModals();

        Seav.notify(
          "success",
          confirmed ? "Reference verified" : "Verification updated",
          confirmed
            ? "Officer confirmation saved to this reference."
            : "Reference verification status has been updated."
        );

        if (window.Seav.app?.refreshAll) {
          await window.Seav.app.refreshAll();
        } else {
          renderRefs();
        }
        }, { sub: "Saving reference verification" });
      });
    }

    document.addEventListener("click", async (e) => {
      const editBtn = e.target.closest("[data-edit-ref-id]");
      if (editBtn) {
        e.preventDefault();
        const refId = editBtn.getAttribute("data-edit-ref-id");
        const ref = getRefs().find((item) => item.id === refId);
        if (!ref) return;
        fillReferenceForm(ref);
        return;
      }

      const sendBtn = e.target.closest("[data-send-ref-id]");
      if (sendBtn) {
        e.preventDefault();
        const refId = sendBtn.getAttribute("data-send-ref-id");
        const ref = getRefs().find((item) => item.id === refId);
        if (!ref) return;

        const updatedRef = {
          ...ref,
          status: "Sent for Verification"
        };

        await SeavAPI.updateItemById(STORAGE_KEY, refId, updatedRef);

        if (window.Seav.app?.refreshAll) {
          await window.Seav.app.refreshAll();
        } else {
          renderRefs();
        }
        return;
      }

      const verifyBtn = e.target.closest("[data-verify-ref-id]");
      if (verifyBtn) {
        e.preventDefault();
        const refId = verifyBtn.getAttribute("data-verify-ref-id");
        const ref = getRefs().find((item) => item.id === refId);
        if (!ref) return;

        openVerifyModal(ref);
        return;
      }

      const delBtn = e.target.closest("[data-del-ref-id]");
      if (delBtn) {
        e.preventDefault();
        const refId = delBtn.getAttribute("data-del-ref-id");
        const ref = getRefs().find((item) => item.id === refId);

        if (
          !Seav.confirmDelete({
            itemName: ref?.name || "",
            itemLabel: "reference"
          })
        ) {
          return;
        }

        await SeavAPI.deleteItemById(STORAGE_KEY, refId);

        if (window.Seav.app?.refreshAll) {
          await window.Seav.app.refreshAll();
        } else {
          renderRefs();
        }
      }
    });

    document.addEventListener("seav:data-updated", runRefresh);
  }

  document.addEventListener("DOMContentLoaded", initReferences);
})();