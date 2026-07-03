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
    await window.SeavApiCore.hydrateItemsFileField(refs, "attachment", REF_FILES_BUCKET);

    if (!window.SeavApiCore?.hydrateFileMeta) return refs;

    await Promise.all(
      refs.map(async (ref) => {
        const signatureImage = ref.verification?.signatureImage;
        if (!signatureImage?.path || signatureImage.url || signatureImage.dataUrl) return;
        const hydrated = await window.SeavApiCore.hydrateFileMeta(
          signatureImage,
          REF_FILES_BUCKET
        );
        if (hydrated) {
          ref.verification = { ...ref.verification, signatureImage: hydrated };
        }
      })
    );

    return refs;
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

  function getRefereeInitials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
    }
    return (parts[0]?.charAt(0) || "?").toUpperCase();
  }

  function truncateText(text, max = 140) {
    const value = String(text || "").trim();
    if (!value) return "";
    if (value.length <= max) return value;
    return `${value.slice(0, max).trim()}…`;
  }

  function getReferenceExcerpt(ref, verification) {
    if (verification.note) return verification.note;
    return ref.text || "";
  }

  function referenceMetaItem(label, valueHtml) {
    return `
      <div class="vessel-meta-item">
        <span class="vessel-meta-label">${Seav.escapeHtml(label)}</span>
        <span class="vessel-meta-value">${valueHtml}</span>
      </div>
    `;
  }

  function buildReferenceCard(r) {
    const refId = r.id || "";
    const refFileUrl = Seav.getFileDisplayUrl(r.attachment, REF_FILES_BUCKET);
    const hasFile = !!refFileUrl;

    const vessel = getVessels().find((v) => v.id === r.vesselId);
    const vesselLabel = vessel?.name || "";

    const verification = r.verification || {};
    const status = getReferenceStatus(r);
    const excerpt = getReferenceExcerpt(r, verification);
    const excerptLabel =
      verification.note && (status === "Verified" || status === "Declined")
        ? "Captain's confirmation"
        : "Reference";

    const canSend =
      !!r.email &&
      status !== "Verified" &&
      status !== "Declined" &&
      (status === "Draft" || status === "Sent for Verification");
    const sendLabel =
      status === "Sent for Verification" ? "New link" : "Share link";
    const storedVerifyLink = readStoredVerifyLink(refId);
    const showOpenLink =
      window.SeavConfig?.SHOW_DEV_VERIFY_LINK &&
      status === "Sent for Verification" &&
      !!storedVerifyLink;

    const statusValue =
      referenceStatusPill(status) ||
      `<span class="ref-meta-muted">Draft</span>`;

    const verificationDetail =
      status === "Verified"
        ? referenceStatusPill(status) || `<span class="ref-meta-muted">Verified</span>`
        : status === "Sent for Verification"
          ? "Awaiting referee"
          : status === "Declined"
            ? Seav.escapeHtml(verification.signatureName || r.name || "Declined")
            : "Not sent";

    const signatureValue = (() => {
      if (status !== "Verified") {
        return status === "Sent for Verification"
          ? `<span class="ref-meta-muted">Pending</span>`
          : `<span class="ref-meta-muted">—</span>`;
      }

      const sig = verification.signatureImage;
      const sigUrl = sig ? Seav.getFileDisplayUrl(sig, REF_FILES_BUCKET) : "";
      const name = Seav.escapeHtml(verification.signatureName || r.name || "—");

      if (sigUrl) {
        return `<div class="ref-signature-wrap ref-signature-wrap--meta"><div class="ref-signature-frame"><img class="seav-signature-display" src="${Seav.escapeHtml(sigUrl)}" alt="Referee signature" loading="lazy" /></div><span class="ref-signature-name">${name}</span></div>`;
      }

      if (verification.signatureName) return name;
      return `<span class="ref-meta-muted">—</span>`;
    })();

    const attachValue = hasFile
      ? `<a class="ref-meta-link" href="${Seav.escapeHtml(refFileUrl)}" target="_blank" rel="noopener">${Seav.escapeHtml(r.attachment?.filename || "View file")}</a>`
      : "—";

    const initials = getRefereeInitials(r.name);
    const titleLine = Seav.escapeHtml(r.title || "—");

    const rankValue =
      status === "Verified" || verification.rank
        ? Seav.escapeHtml(verification.rank || "—")
        : status === "Sent for Verification"
          ? "Pending"
          : "—";

    const cocValue =
      status === "Verified" && verification.cocNumber
        ? Seav.escapeHtml(maskCoc(verification.cocNumber))
        : "—";

    const signedValue = verification.signedAt
      ? Seav.escapeHtml(formatDatePretty(verification.signedAt))
      : "—";

    const excerptHtml = excerpt
      ? `“${Seav.escapeHtml(truncateText(excerpt))}”`
      : `<span class="ref-meta-muted">—</span>`;

    return `
    <article class="vessel-card ref-page-card">
      <div class="vessel-body">
        <div class="ref-card-head">
          <div class="ref-card-avatar" aria-hidden="true">${initials}</div>
          <div class="ref-card-head-text">
            <div class="ref-card-title-row">
              <h3 class="ref-card-title">${Seav.escapeHtml(r.name || "—")}</h3>
              ${statusValue}
            </div>
            <p class="ref-card-subtitle">${titleLine}</p>
          </div>
        </div>

        <div class="vessel-meta-grid">
          <div class="vessel-meta-item ref-meta-span-full">
            <span class="vessel-meta-label">${Seav.escapeHtml(excerptLabel)}</span>
            <span class="vessel-meta-value ref-meta-excerpt">${excerptHtml}</span>
          </div>

          ${referenceMetaItem("Verification", verificationDetail)}

          ${referenceMetaItem("Vessel", Seav.escapeHtml(vesselLabel || "—"))}
          ${referenceMetaItem("Your role", Seav.escapeHtml(r.role || "—"))}
          ${referenceMetaItem("Period", Seav.escapeHtml(r.period || "—"))}
          ${referenceMetaItem("Date", Seav.escapeHtml(formatDatePretty(r.date)))}

          ${referenceMetaItem("Referee email", Seav.escapeHtml(r.email || "—"))}
          ${referenceMetaItem("Rank", rankValue)}
          ${referenceMetaItem("CoC", cocValue)}

          ${referenceMetaItem("Signed", signedValue)}
          ${referenceMetaItem("Attachment", attachValue)}
          ${referenceMetaItem("Signature", signatureValue)}
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
                  "Copy link",
                  `data-open-verify-link="${Seav.escapeHtml(refId)}"`
                )
              : ""
          }${Seav.seavAction("delete", "Delete", `data-del-ref-id="${Seav.escapeHtml(refId)}"`)}`,
          "seav-actions--compact"
        )}
      </div>
    </article>
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

    try {
      await hydrateReferenceAttachments(sorted);
      window.SeavState?.syncCache?.();

      refsList.innerHTML = sorted.map((r) => buildReferenceCard(r)).join("");
      updateReferencesSummary(refs);
    } catch (err) {
      console.error("[SEA-V] References render failed:", err);
      refsList.innerHTML = `
      <div class="list-row">
        <div>
          <div class="list-title">Could not display references</div>
          <div class="list-sub">${Seav.escapeHtml(err?.message || "Refresh the page and try again.")}</div>
        </div>
      </div>
    `;
    }
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
          Seav.notify("error", "Email required", "Add the referee email before sharing a link.");
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
        }, {
          sub: "Preparing verification link",
          errorTitle: "Verification failed"
        });

        if (!sendResult) return;

        if (sendResult?.verifyUrl) {
          rememberVerifyLink(refId, sendResult.verifyUrl);
        }

        const vessel = getVessels().find((item) => item.id === ref.vesselId);
        const crewName = String(window.SeavState?.profile?.name || "").trim();

        if (sendResult?.verifyUrl) {
          window.SeavReferenceVerification.showVerifyLinkDialog(sendResult.verifyUrl, {
            refereeEmail: sendResult.refereeEmail || ref.email,
            refereeName: ref.name,
            crewName: crewName || "A SEA-V member",
            vesselName: vessel?.name || ""
          });
        }

        Seav.notify(
          "success",
          "Link ready",
          sendResult.message || "Copy the suggested email and send it from your own account."
        );

        try {
          if (window.Seav.app?.refreshAll) {
            await window.Seav.app.refreshAll();
          } else {
            await renderRefs();
          }
        } catch (refreshErr) {
          console.warn("[SEA-V] Refresh after verification send failed:", refreshErr);
          await renderRefs();
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
            "Click New link to generate a fresh verification link."
          );
          return;
        }
        if (window.SeavReferenceVerification?.showVerifyLinkDialog) {
          const ref = getRefs().find((item) => item.id === refId);
          const vessel = getVessels().find((item) => item.id === ref?.vesselId);
          const crewName = String(window.SeavState?.profile?.name || "").trim();
          window.SeavReferenceVerification.showVerifyLinkDialog(verifyUrl, {
            refereeEmail: ref?.email || "",
            refereeName: ref?.name || "",
            crewName: crewName || "A SEA-V member",
            vesselName: vessel?.name || ""
          });
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
          "Hard refresh this page (Cmd+Shift+R), then use Share link."
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