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

  const {
    KEYS,
    createId,
    getSortedVesselOptions,
    formatDatePretty,
    getReferenceStatus
  } = window.SeavData;
  const STORAGE_KEY = KEYS.REFS;
  const VERIFY_LINK_KEY_PREFIX = "seav_ref_verify_url_";
  const REF_FILES_BUCKET =
    window.SeavApiCore?.STORAGE_BUCKETS?.REFERENCE_FILES || "reference-files";

  function rememberVerifyLink(refId, verifyUrl) {
    if (!refId || !verifyUrl) return;
    try {
      sessionStorage.setItem(verifyLinkStorageKey(refId), verifyUrl);
    } catch (err) {
      console.warn("[SEA-V] Could not store verification link:", err);
    }
  }

  function readStoredVerifyLink(refId) {
    if (!refId) return "";
    try {
      return sessionStorage.getItem(verifyLinkStorageKey(refId)) || "";
    } catch {
      return "";
    }
  }

  function verifyLinkStorageKey(refId) {
    const userId = window.SeavAuth?.getUserId?.();
    return `${VERIFY_LINK_KEY_PREFIX}${userId ? `${userId}_` : ""}${refId}`;
  }

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

  async function hydrateReferenceAttachments(refs) {
    if (!window.SeavApiCore?.hydrateItemsFileField) return refs;
    return window.SeavApiCore.hydrateItemsFileField(
      refs,
      "attachment",
      REF_FILES_BUCKET
    );
  }

  function referenceStatusPill(status) {
    if (status === "Verified") {
      return `<span class="reference-verified-pill">Verified</span>`;
    }
    if (status === "Sent for Verification") {
      return `<span class="reference-sent-pill">Sent for verification</span>`;
    }
    if (status === "Declined") {
      return `<span class="reference-declined-pill">Declined</span>`;
    }
    if (status !== "Draft") {
      return `<span class="pill">${Seav.escapeHtml(status)}</span>`;
    }
    return "";
  }

  function buildVerificationBox(status, ref, verification) {
    if (status === "Verified") {
      const signedBy = verification.signatureName || ref.name || "—";
      return `
        Verified by: ${Seav.escapeHtml(signedBy)}<br>
        Rank: ${Seav.escapeHtml(verification.rank || "—")}
      `;
    }
    if (status === "Sent for Verification") {
      return `
        Pending confirmation<br>
        Sent to: ${Seav.escapeHtml(ref.email || "—")}
      `;
    }
    if (status === "Declined") {
      const signedBy = verification.signatureName || ref.name || "—";
      return `
        Declined by: ${Seav.escapeHtml(signedBy)}<br>
        ${verification.signedAt ? `Date: ${Seav.escapeHtml(formatDatePretty(verification.signedAt))}` : "Response recorded"}
      `;
    }
    if (ref.email) {
      return `
        Ready to send<br>
        Referee: ${Seav.escapeHtml(ref.email)}
      `;
    }
    return `Add referee email, save, then Send email.`;
  }

  function buildCertificationBox(status, verification) {
    if (status === "Verified") {
      return `
        CoC: ${Seav.escapeHtml(maskCoc(verification.cocNumber))}<br>
        Signed: ${Seav.escapeHtml(
          verification.signedAt ? formatDatePretty(verification.signedAt) : "—"
        )}
      `;
    }
    if (status === "Declined" && verification.note) {
      return `“${Seav.escapeHtml(verification.note)}”`;
    }
    return "—";
  }

  function buildReferenceCard(r) {
    const refId = r.id || "";
    const refFileUrl = Seav.getFileDisplayUrl(r.attachment, REF_FILES_BUCKET);
    const hasFile = !!refFileUrl;
    const attachLabel = r.attachment?.filename
      ? `Download (${Seav.escapeHtml(r.attachment.filename)})`
      : "Download attachment";

    const vessel = getVessels().find((v) => v.id === r.vesselId);
    const vesselLabel = vessel?.name || "";
    const hasServiceContext = !!(vesselLabel || r.role || r.period);

    const verification = r.verification || {};
    const status = getReferenceStatus(r);

    const canSend =
      !!r.email &&
      status !== "Verified" &&
      status !== "Declined" &&
      (status === "Draft" || status === "Sent for Verification");
    const sendLabel =
      status === "Sent for Verification" ? "Resend email" : "Send email";
    const storedVerifyLink = readStoredVerifyLink(refId);
    const showOpenLink =
      status === "Sent for Verification" && !!storedVerifyLink;

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
            ${referenceStatusPill(status)}
          </div>

          <div class="reference-modern-meta">
            ${Seav.escapeHtml(r.title || "—")} • ${formatDatePretty(r.date)}
          </div>

          ${
            hasServiceContext
              ? `<div class="reference-modern-meta" style="margin-top:6px;">
                  ${Seav.escapeHtml(vesselLabel || "—")} •
                  ${Seav.escapeHtml(r.role || "—")} •
                  ${Seav.escapeHtml(r.period || "—")}
                </div>`
              : ``
          }

          <div
            class="reference-modern-value reference-modern-quote"
          >
            “${Seav.escapeHtml(r.text)}”
          </div>

          ${
            status === "Verified" && verification.note
              ? `<div class="reference-verifier-note">
                  “${Seav.escapeHtml(verification.note)}”
                </div>`
              : ``
          }

          ${
            status === "Sent for Verification"
              ? `<div class="reference-pending-verify">
                  <strong>Waiting for referee confirmation.</strong>
                  ${
                    showOpenLink
                      ? ` Use <em>Open verify link</em> below to complete the test as the referee.`
                      : canSend
                        ? ` Click <em>Resend email</em> to generate a new link.`
                        : ` Add a referee email, save, then resend.`
                  }
                </div>`
              : ``
          }

          ${
            status === "Declined"
              ? `<div class="reference-declined-notice">
                  <strong>This reference was declined by the referee.</strong>
                  ${
                    verification.note
                      ? ` Note: “${Seav.escapeHtml(verification.note)}”`
                      : ``
                  }
                </div>`
              : ``
          }

        </div>

      </div>

      ${Seav.seavActions(
        `${Seav.seavAction("edit", "Edit", `data-edit-ref-id="${Seav.escapeHtml(refId)}"`)}${
          canSend
            ? Seav.seavAction(
                "secondary",
                sendLabel,
                `data-send-ref-id="${Seav.escapeHtml(refId)}"`
              )
            : ""
        }${
          showOpenLink
            ? Seav.seavAction(
                "secondary",
                "Open verify link",
                `data-open-verify-link="${Seav.escapeHtml(refId)}"`
              )
            : ""
        }${Seav.seavAction("delete", "Delete", `data-del-ref-id="${Seav.escapeHtml(refId)}"`)}`
      )}

    </div>

    <div class="reference-modern-grid">

      <div class="reference-modern-box">
        <div class="reference-modern-label">Attachment</div>
        <div class="reference-modern-value">
          ${
            hasFile
              ? `<a
                  class="reference-modern-attachment"
                  href="${Seav.escapeHtml(refFileUrl)}"
                  target="_blank"
                  rel="noopener"
                >${attachLabel}</a>`
              : `No attachment`
          }
        </div>
      </div>

      <div class="reference-modern-box">
        <div class="reference-modern-label">Verification</div>
        <div class="reference-modern-value">
          ${buildVerificationBox(status, r, verification)}
        </div>
      </div>

      <div class="reference-modern-box">
        <div class="reference-modern-label">Certification</div>
        <div class="reference-modern-value">
          ${buildCertificationBox(status, verification)}
        </div>
      </div>

    </div>

  </div>
`;
  }

  async function renderRefs() {
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
      updateReferencesSummary(refs);
      return;
    }

    const sorted = [...refs].sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(0);
      const db = b.date ? new Date(b.date) : new Date(0);
      return db - da;
    });

    await hydrateReferenceAttachments(sorted);
    window.SeavState?.syncCache?.();

    refsList.innerHTML = sorted.map((r) => buildReferenceCard(r)).join("");
    updateReferencesSummary(refs);
  }

  function updateReferencesSummary(refs) {
    const el = document.getElementById("refsSummary");
    if (!el) return;

    if (!refs.length) {
      el.textContent = "";
      return;
    }

    const verified = refs.filter((r) => getReferenceStatus(r) === "Verified").length;
    const pending = refs.filter(
      (r) => getReferenceStatus(r) === "Sent for Verification"
    ).length;
    const declined = refs.filter((r) => getReferenceStatus(r) === "Declined").length;

    const parts = [`${refs.length} reference${refs.length === 1 ? "" : "s"}`];
    if (verified) parts.push(`${verified} verified`);
    if (pending) parts.push(`${pending} pending`);
    if (declined) parts.push(`${declined} declined`);

    el.textContent = parts.join(" · ");
  }

  function clearFormFieldLocks() {
    ["rf_name", "rf_text", "rf_email"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.readOnly = false;
    });
  }

  function applyReferenceFormLocks(ref) {
    const status = getReferenceStatus(ref);
    const locked = status === "Verified" || status === "Declined";

    const nameField = document.getElementById("rf_name");
    const textField = document.getElementById("rf_text");
    const emailField = document.getElementById("rf_email");

    if (nameField) nameField.readOnly = locked;
    if (textField) textField.readOnly = locked;
    if (emailField) emailField.readOnly = locked;
  }

  async function renderFormAttachmentPreview(attachment) {
    const preview = document.getElementById("rf_attachment_preview");
    if (!preview) return;

    if (!attachment?.path && !attachment?.url && !attachment?.dataUrl) {
      preview.hidden = true;
      preview.innerHTML = "";
      return;
    }

    let hydrated = attachment;
    if (attachment?.path && window.SeavApiCore?.hydrateFileMeta) {
      hydrated = await window.SeavApiCore.hydrateFileMeta(
        attachment,
        REF_FILES_BUCKET
      );
    }

    const url = Seav.getFileDisplayUrl(hydrated, REF_FILES_BUCKET);
    const filename = attachment.filename || "View attachment";

    preview.hidden = false;
    preview.innerHTML = url
      ? `
        <span class="reference-form-attachment-label">Current attachment</span>
        <a
          class="reference-modern-attachment"
          href="${Seav.escapeHtml(url)}"
          target="_blank"
          rel="noopener"
        >${Seav.escapeHtml(filename)}</a>
      `
      : `<span class="muted">Attachment saved — preview unavailable</span>`;
  }

  async function fillReferenceForm(ref) {
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

  const statusField = document.getElementById("rf_status");
  if (statusField) {
    const status = getReferenceStatus(ref);
    statusField.value = status;
    const locked =
      status === "Verified" ||
      status === "Declined" ||
      status === "Sent for Verification";
    statusField.disabled = locked;
  }

  clearFormFieldLocks();
  applyReferenceFormLocks(ref);
  await renderFormAttachmentPreview(ref.attachment || null);

  if (window.SeavModals?.openModal) window.SeavModals.openModal("refModal");
}

function resetReferenceForm(form) {
  form.reset();

  const editId = document.getElementById("rf_edit_id");
  if (editId) editId.value = "";

  Seav.clearDateTriplet("rf_date");

  const statusField = document.getElementById("rf_status");
  if (statusField) {
    statusField.value = "Draft";
    statusField.disabled = false;
  }

  clearFormFieldLocks();
  const preview = document.getElementById("rf_attachment_preview");
  if (preview) {
    preview.hidden = true;
    preview.innerHTML = "";
  }
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
      !document.getElementById("refForm")
    ) return;

    const runRefresh = async () => {
      populateReferenceVesselOptions();
      await renderRefs();
    };

    Seav.bindStateRefresh(runRefresh, { label: "References refresh" });

    const refForm = document.getElementById("refForm");
    if (refForm) {
      refForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = readReferenceForm();
        if (!formData.name || !formData.text) {
          Seav.notify(
            "error",
            "Reference details missing",
            "Add the referee name and reference text before saving."
          );
          return;
        }

        const existingRef = formData.id
         ? getRefs().find((item) => item.id === formData.id) || null
         : null;

        if (
          existingRef &&
          (getReferenceStatus(existingRef) === "Verified" ||
            getReferenceStatus(existingRef) === "Sent for Verification" ||
            getReferenceStatus(existingRef) === "Declined")
        ) {
          formData.status = getReferenceStatus(existingRef);
        }

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
          await renderRefs();
        }
        }, { sub: "Saving reference" });
      });
    }

    document.addEventListener("click", async (e) => {
      const editBtn = e.target.closest("[data-edit-ref-id]");
      if (editBtn) {
        e.preventDefault();
        const refId = editBtn.getAttribute("data-edit-ref-id");
        const ref = getRefs().find((item) => item.id === refId);
        if (!ref) return;
        await fillReferenceForm(ref);
        return;
      }

      const sendBtn = e.target.closest("[data-send-ref-id]");
      if (sendBtn) {
        e.preventDefault();
        const refId = sendBtn.getAttribute("data-send-ref-id");
        const ref = getRefs().find((item) => item.id === refId);
        if (!ref) return;

        if (!ref.email) {
          Seav.notify("error", "Email required", "Add the referee email before sending.");
          return;
        }

        if (!window.SeavReferenceVerification?.sendRequest) {
          Seav.notify(
            "error",
            "Verification unavailable",
            "Reference verification is not loaded. Refresh and try again."
          );
          return;
        }

        let sendResult = null;
        await Seav.withSaving(async () => {
          sendResult = await window.SeavReferenceVerification.sendRequest(refId);

          Seav.notify(
            "success",
            sendResult.emailSent ? "Email sent" : "Verification requested",
            sendResult.message ||
              (sendResult.emailSent
                ? "The referee will receive a secure link by email."
                : "Use the verification link dialog to open the page as the referee.")
          );

          if (window.Seav.app?.refreshAll) {
            await window.Seav.app.refreshAll();
          } else {
            await renderRefs();
          }
        }, { sub: "Sending verification email" });

        if (sendResult?.verifyUrl) {
          rememberVerifyLink(refId, sendResult.verifyUrl);
        }

        if (sendResult?.verifyUrl && !sendResult.emailSent) {
          window.SeavReferenceVerification.showVerifyLinkDialog(sendResult.verifyUrl);
        }

        return;
      }

      const openLinkBtn = e.target.closest("[data-open-verify-link]");
      if (openLinkBtn) {
        e.preventDefault();
        const refId = openLinkBtn.getAttribute("data-open-verify-link");
        const verifyUrl = readStoredVerifyLink(refId);
        if (!verifyUrl) {
          Seav.notify(
            "info",
            "No saved link",
            "Click Resend email to generate a new verification link."
          );
          return;
        }
        if (window.SeavReferenceVerification?.showVerifyLinkDialog) {
          window.SeavReferenceVerification.showVerifyLinkDialog(verifyUrl);
        } else {
          window.open(verifyUrl, "_blank", "noopener");
        }
        return;
      }

      const legacyVerifyBtn = e.target.closest("[data-verify-ref-id]");
      if (legacyVerifyBtn) {
        e.preventDefault();
        Seav.notify(
          "info",
          "Page update required",
          "Hard refresh this page (Cmd+Shift+R), then use Send email — not Verify."
        );
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
          await renderRefs();
        }
      }
    });

  }

  document.addEventListener("DOMContentLoaded", initReferences);
})();