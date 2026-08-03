// /js/verify-reference.js — public referee verification page
(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const token = String(params.get("token") || "").trim();

  const els = {
    loading: document.getElementById("vrLoading"),
    error: document.getElementById("vrError"),
    errorText: document.getElementById("vrErrorText"),
    content: document.getElementById("vrContent"),
    metaGrid: document.getElementById("vrMetaGrid"),
    attachmentWrap: document.getElementById("vrAttachmentWrap"),
    attachmentBody: document.getElementById("vrAttachmentBody"),
    avatar: document.getElementById("vrAvatar"),
    intro: document.getElementById("vrIntro"),
    form: document.getElementById("vrForm"),
    referenceTextLabel: document.getElementById("vrReferenceTextLabel"),
    referenceText: document.getElementById("vrReferenceText"),
    confirmed: document.getElementById("vrConfirmed"),
    confirmedText: document.getElementById("vrConfirmedText"),
    note: document.getElementById("vrNote"),
    rank: document.getElementById("vrRank"),
    coc: document.getElementById("vrCoc"),
    signature: document.getElementById("vrSignature"),
    signaturePadMount: document.getElementById("vrSignaturePadMount"),
    confirmBtn: document.getElementById("vrConfirmBtn"),
    declineBtn: document.getElementById("vrDeclineBtn"),
    success: document.getElementById("vrSuccess"),
    successTitle: document.getElementById("vrSuccessTitle"),
    successText: document.getElementById("vrSuccessText"),
    expiry: document.getElementById("vrExpiry"),
    expiryWrap: document.getElementById("vrExpiryWrap")
  };

  let previewData = null;
  let submitting = false;
  let signaturePad = null;

  function initSignaturePad() {
    if (!els.signaturePadMount || !window.SeavSignaturePad?.mount) return;

    signaturePad?.destroy?.();
    signaturePad = window.SeavSignaturePad.mount(els.signaturePadMount, {
      height: 168,
      penColor: "#0b121c",
      penWidth: 2.6,
      background: "#ffffff",
      ariaLabel: "Draw your signature to confirm this reference"
    });

    requestAnimationFrame(() => {
      signaturePad?.refreshLayout?.();
    });
  }

  function escapeHtml(value) {
    if (window.Seav?.escapeHtml) return window.Seav.escapeHtml(value);
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showError(message) {
    if (els.loading) els.loading.hidden = true;
    if (els.content) els.content.hidden = true;
    if (els.success) els.success.hidden = true;
    if (els.error) els.error.hidden = false;
    if (els.errorText) els.errorText.textContent = message || "This link is invalid or has expired.";
  }

  function showSuccess(confirmed) {
    if (els.loading) els.loading.hidden = true;
    if (els.content) els.content.hidden = true;
    if (els.error) els.error.hidden = true;
    if (els.success) els.success.hidden = false;
    if (els.successTitle) {
      els.successTitle.textContent = confirmed
        ? "Reference verified"
        : "Reference declined";
    }
    if (els.successText) {
      els.successText.textContent = confirmed
        ? "Thank you. Your confirmation has been recorded on the crew member's SEA-V profile."
        : "Your response has been recorded. The crew member will see that this reference was declined.";
    }
  }

  function formatDatePretty(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function getInitials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
    }
    return (parts[0]?.charAt(0) || "?").toUpperCase();
  }

  function renderMetaItem(item) {
    const valueClass = item.excerpt ? "vessel-meta-value ref-meta-excerpt" : "vessel-meta-value";
    const spanClass = item.full ? "vessel-meta-item ref-meta-span-full" : "vessel-meta-item";
    const safeValue = escapeHtml(item.value);
    const value = item.excerpt ? `“${safeValue}”` : safeValue;

    return `
      <div class="${spanClass}">
        <span class="vessel-meta-label">${escapeHtml(item.label)}</span>
        <span class="${valueClass}">${value}</span>
      </div>
    `;
  }

  function renderMetaGrid(data) {
    if (!els.metaGrid) return;

    const items = [];

    // The crew member's own context/instructions for this request — not the
    // reference itself. The reference text doesn't exist yet at this point;
    // the referee writes it below, in the form.
    if (data.message_to_referee) {
      items.push({
        label: "Message from the crew member",
        value: data.message_to_referee,
        excerpt: true,
        full: true
      });
    }

    [
      { label: "Vessel", value: data.vessel_name },
      { label: "Role", value: data.crew_role },
      { label: "Period", value: data.service_period }
    ].forEach((item) => {
      if (item.value) items.push(item);
    });

    if (!items.length) {
      els.metaGrid.innerHTML = "";
      els.metaGrid.hidden = true;
      return;
    }

    els.metaGrid.hidden = false;
    els.metaGrid.classList.toggle(
      "verify-reference-meta-grid--quote-only",
      items.length === 1 && items[0].full
    );
    els.metaGrid.innerHTML = items.map(renderMetaItem).join("");
  }

  function renderIntro(data, attachmentProvided) {
    if (!els.intro) return;

    const refereeName = escapeHtml(data.referee_name || "Referee");
    const refereeTitle = String(data.referee_title || "").trim();
    const crewName = escapeHtml(data.crew_name || "SEA-V member");
    const titleBit = refereeTitle
      ? `, <span>${escapeHtml(refereeTitle)}</span>`
      : "";

    const ask = attachmentProvided
      ? `please confirm the attached reference for <strong>${crewName}</strong> is true`
      : `please write and confirm a reference for <strong>${crewName}</strong>`;

    els.intro.innerHTML = `<strong>${refereeName}</strong>${titleBit} — ${ask}.`;
  }

  // A crew member can attach an already-written reference letter/document
  // instead of asking the referee to type the whole thing out again. When
  // that attachment is present, the referee's job shifts from "write the
  // reference" to "confirm the attached one is accurate" — so the textarea
  // becomes an optional note instead of a required field, and the copy
  // around it changes to match. Without an attachment, nothing changes:
  // the referee still writes the reference themselves, same as before.
  function applyReferenceTextMode(attachmentProvided) {
    if (els.referenceTextLabel) {
      els.referenceTextLabel.textContent = attachmentProvided
        ? "Additional comments (optional)"
        : "Write the reference";
    }
    if (els.referenceText) {
      els.referenceText.required = !attachmentProvided;
      els.referenceText.placeholder = attachmentProvided
        ? "Add anything else you'd like to note about this crew member (optional)."
        : "Write your reference for this crew member — their role, the dates you knew them, and your assessment of their work.";
    }
    if (els.confirmedText) {
      els.confirmedText.textContent = attachmentProvided
        ? "I confirm the attached reference is true and approved by me."
        : "I confirm this reference is true and approved by me.";
    }
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  const REF_FILES_BUCKET =
    window.SeavApiCore?.STORAGE_BUCKETS?.REFERENCE_FILES || "reference-files";

  function hasAttachment(attachment) {
    if (!attachment || typeof attachment !== "object") return false;
    return !!(
      attachment.path ||
      attachment.filePath ||
      attachment.storagePath ||
      attachment.url ||
      attachment.dataUrl
    );
  }

  function getPublicSupabaseClient() {
    return window.SeavPublicSupabase || window.SeavSupabase || null;
  }

  function isImageAttachment(attachment, url) {
    const mime = String(attachment?.mime || attachment?.mimetype || "").toLowerCase();
    const name = String(attachment?.filename || attachment?.name || url || "").toLowerCase();
    if (mime.startsWith("image/")) return true;
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
  }

  async function resolveAttachmentUrl(attachment) {
    if (!hasAttachment(attachment)) return "";

    const normalized = {
      ...attachment,
      path: attachment.path || attachment.filePath || attachment.storagePath || null,
      bucket: attachment.bucket || REF_FILES_BUCKET
    };

    if (normalized.dataUrl) return normalized.dataUrl;
    if (normalized.url && !normalized.path) return normalized.url;

    const bucket = normalized.bucket;
    const client = getPublicSupabaseClient();

    if (window.SeavApiCore?.resolveStorageFileUrl) {
      const url = await window.SeavApiCore.resolveStorageFileUrl(
        normalized,
        bucket,
        window.SeavApiCore.signedUrlExpiry?.(bucket) ?? 3600,
        client
      );
      if (url) return url;
    }

    if (normalized.path && client) {
      const { data, error } = await client.storage
        .from(bucket)
        .createSignedUrl(normalized.path, 3600);
      if (!error && data?.signedUrl) return data.signedUrl;
      console.warn("[SEA-V] Verify reference attachment signed URL failed:", error);
    }

    return normalized.url || normalized.publicUrl || "";
  }

  async function renderAttachment(attachment) {
    if (!els.attachmentWrap || !els.attachmentBody) return;

    if (!hasAttachment(attachment)) {
      els.attachmentWrap.hidden = true;
      els.attachmentBody.innerHTML = "";
      return;
    }

    els.attachmentWrap.hidden = false;
    els.attachmentBody.innerHTML =
      '<p class="verify-reference-attachment-loading">Loading attachment…</p>';

    const filename = attachment.filename || attachment.name || "Reference attachment";
    const url = await resolveAttachmentUrl(attachment);

    if (!url) {
      els.attachmentBody.innerHTML = `
        <p class="verify-reference-attachment-missing">
          ${escapeHtml(filename)} could not be loaded. Ask the crew member to resend the verification link.
        </p>
      `;
      return;
    }

    const safeUrl = escapeHtml(url);
    const safeName = escapeHtml(filename);
    const openLabel = escapeHtml(`Open ${filename}`);

    if (isImageAttachment(attachment, url)) {
      els.attachmentBody.innerHTML = `
        <div class="verify-reference-attachment-preview">
          <img class="verify-reference-attachment-image" src="${safeUrl}" alt="${safeName}" loading="lazy" />
        </div>
        <a class="reference-modern-attachment verify-reference-attachment-open" href="${safeUrl}" target="_blank" rel="noopener">${openLabel}</a>
      `;
      return;
    }

    els.attachmentBody.innerHTML = `
      <a class="reference-modern-attachment verify-reference-attachment-open" href="${safeUrl}" target="_blank" rel="noopener">${openLabel}</a>
    `;
  }

  // Every other call on this page goes through window.SeavPublicSupabase,
  // created with persistSession:false specifically so a real referee (who
  // has no SEA-V account) can call these RPCs anonymously. That means
  // auth.uid() is always null inside complete_reference_verification*
  // regardless of whether the crew member who owns this reference is
  // logged into their own account elsewhere in the same browser — a
  // same-account self-signing guard added at the database level there can
  // never actually fire. The only place that can see "is this browser also
  // logged into the owning account" is window.SeavSupabase (the main
  // client, which does persist/detect sessions) — checked here, separately,
  // using an authenticated-only RPC so auth.uid() means something. This is
  // best-effort (a private/incognito window still bypasses it, same as the
  // DB guard would), but it catches the common case: testing the link
  // while still signed in as yourself.
  async function checkOwnSessionBlock() {
    try {
      if (!window.SeavSupabase?.auth?.getSession) return false;
      const { data } = await window.SeavSupabase.auth.getSession();
      if (!data?.session) return false;

      const { data: isOwn, error } = await window.SeavSupabase.rpc(
        "is_own_reference_verification_link",
        { p_token: token }
      );
      if (error) return false;
      return isOwn === true;
    } catch {
      return false;
    }
  }

  async function loadPreview() {
    if (!token) {
      showError("Missing verification token. Check the link in your email.");
      return;
    }

    if (!window.SeavReferenceVerification?.preview) {
      showError("Verification service unavailable.");
      return;
    }

    if (await checkOwnSessionBlock()) {
      showError(
        "You're signed into the SEA-V account this reference belongs to. To keep verification honest, it needs to be confirmed by your referee, not from the crew member's own device or account. Sign out, or open this link in a private/incognito window, and try again."
      );
      return;
    }

    try {
      previewData = await window.SeavReferenceVerification.preview(token);

      if (els.loading) els.loading.hidden = true;
      if (els.content) els.content.hidden = false;

      if (els.avatar) {
        els.avatar.textContent = getInitials(previewData.referee_name);
      }

      const attachmentProvided = hasAttachment(previewData.attachment);
      renderIntro(previewData, attachmentProvided);
      applyReferenceTextMode(attachmentProvided);
      renderMetaGrid(previewData);
      await renderAttachment(previewData.attachment);
      if (els.rank) {
        els.rank.value = previewData.referee_title || "";
      }
      if (els.signature && previewData.referee_name) {
        els.signature.placeholder = `Type your full name (${previewData.referee_name})`;
      }
      // "Reference date" is now the same day/month/year triplet as every
      // other date field on the site (js/core.js), not a raw <input
      // type="date">, so it's set/read via the shared prefix helpers
      // rather than a cached els.signedAt element reference.
      Seav.setDateTriplet("vr_signed_at", todayIso());

      initSignaturePad();

      const expiryLabel = formatDatePretty(previewData.expires_at);
      if (expiryLabel && els.expiry && els.expiryWrap) {
        els.expiry.textContent = expiryLabel;
        els.expiryWrap.hidden = false;
      }
    } catch (err) {
      showError(err?.message || "Could not load this verification request.");
    }
  }

  async function submitVerification(confirmed) {
    if (submitting || !token) return;
    submitting = true;

    const referenceText = els.referenceText?.value?.trim() || "";
    const attachmentProvided = hasAttachment(previewData?.attachment);
    if (confirmed && !attachmentProvided && !referenceText) {
      submitting = false;
      if (window.Seav?.notify) {
        Seav.notify("error", "Reference required", "Write the reference before confirming.");
      } else {
        alert("Please write the reference before confirming.");
      }
      return;
    }

    if (confirmed && els.confirmed && !els.confirmed.checked) {
      submitting = false;
      if (window.Seav?.notify) {
        Seav.notify("error", "Confirmation required", "Tick the box to confirm this reference.");
      } else {
        alert("Please confirm the reference before submitting.");
      }
      return;
    }

    const signatureName = els.signature?.value?.trim() || "";
    if (confirmed && !signatureName) {
      submitting = false;
      if (window.Seav?.notify) {
        Seav.notify("error", "Signature required", "Type your full name to confirm.");
      } else {
        alert("Please type your full name to confirm.");
      }
      return;
    }

    if (confirmed && signaturePad?.isEmpty?.()) {
      submitting = false;
      if (window.Seav?.notify) {
        Seav.notify("error", "Signature required", "Draw your signature in the box above.");
      } else {
        alert("Please draw your signature before confirming.");
      }
      return;
    }

    const payload = {
      confirmed,
      referenceText,
      note: els.note?.value?.trim() || "",
      rank: els.rank?.value?.trim() || "",
      cocNumber: els.coc?.value?.trim() || "",
      signatureName,
      signedAt: Seav.readDateTriplet("vr_signed_at") || todayIso()
    };

    if (els.confirmBtn) els.confirmBtn.disabled = true;
    if (els.declineBtn) els.declineBtn.disabled = true;

    try {
      if (confirmed && signaturePad && !signaturePad.isEmpty()) {
        const blob = await signaturePad.toBlob("image/png");
        if (!blob) {
          throw new Error("Could not export signature image.");
        }
        if (!window.SeavReferenceVerification?.uploadSignatureImage) {
          throw new Error("Signature upload is unavailable.");
        }
        payload.signatureImage = await window.SeavReferenceVerification.uploadSignatureImage(
          token,
          blob
        );
      }

      await window.SeavReferenceVerification.complete(token, payload);
      showSuccess(confirmed);
    } catch (err) {
      if (window.Seav?.notify) {
        Seav.notify("error", "Could not submit", err?.message || "Please try again.");
      } else {
        alert(err?.message || "Could not submit verification.");
      }
      if (els.confirmBtn) els.confirmBtn.disabled = false;
      if (els.declineBtn) els.declineBtn.disabled = false;
    } finally {
      submitting = false;
    }
  }

  function init() {
    if (els.form) {
      els.form.addEventListener("submit", (e) => {
        e.preventDefault();
        submitVerification(true);
      });
    }

    if (els.declineBtn) {
      els.declineBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const ok = window.confirm(
          "Decline this reference? The crew member will be notified on their profile."
        );
        if (ok) submitVerification(false);
      });
    }

    loadPreview();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
