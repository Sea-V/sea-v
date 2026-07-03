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
    confirmed: document.getElementById("vrConfirmed"),
    note: document.getElementById("vrNote"),
    rank: document.getElementById("vrRank"),
    coc: document.getElementById("vrCoc"),
    signature: document.getElementById("vrSignature"),
    signedAt: document.getElementById("vrSignedAt"),
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

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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

    if (data.reference_text) {
      items.push({
        label: "Reference",
        value: data.reference_text,
        excerpt: true,
        full: true
      });
    }

    [
      { label: "Vessel", value: data.vessel_name },
      { label: "Role", value: data.crew_role },
      { label: "Period", value: data.service_period },
      { label: "Reference date", value: formatDatePretty(data.reference_date) }
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

  function renderIntro(data) {
    if (!els.intro) return;

    const refereeName = escapeHtml(data.referee_name || "Referee");
    const refereeTitle = String(data.referee_title || "").trim();
    const crewName = escapeHtml(data.crew_name || "SEA-V member");
    const titleBit = refereeTitle
      ? `, <span>${escapeHtml(refereeTitle)}</span>`
      : "";

    els.intro.innerHTML = `<strong>${refereeName}</strong>${titleBit} — please confirm whether the reference below for <strong>${crewName}</strong> is accurate.`;
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

    if (isImageAttachment(attachment, url)) {
      els.attachmentBody.innerHTML = `
        <a class="verify-reference-attachment-link" href="${safeUrl}" target="_blank" rel="noopener">
          <img class="verify-reference-attachment-image" src="${safeUrl}" alt="${safeName}" loading="lazy" />
        </a>
        <a class="ref-meta-link verify-reference-attachment-open" href="${safeUrl}" target="_blank" rel="noopener">Open ${safeName}</a>
      `;
      return;
    }

    els.attachmentBody.innerHTML = `
      <a class="ref-meta-link verify-reference-attachment-open" href="${safeUrl}" target="_blank" rel="noopener">Open ${safeName}</a>
    `;
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

    try {
      previewData = await window.SeavReferenceVerification.preview(token);

      if (els.loading) els.loading.hidden = true;
      if (els.content) els.content.hidden = false;

      if (els.avatar) {
        els.avatar.textContent = getInitials(previewData.referee_name);
      }

      renderIntro(previewData);
      renderMetaGrid(previewData);
      await renderAttachment(previewData.attachment);
      if (els.rank) {
        els.rank.value = previewData.referee_title || "";
      }
      if (els.signature && previewData.referee_name) {
        els.signature.placeholder = `Type your full name (${previewData.referee_name})`;
      }
      if (els.signedAt) {
        els.signedAt.value = todayIso();
      }

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

    const payload = {
      confirmed,
      note: els.note?.value?.trim() || "",
      rank: els.rank?.value?.trim() || "",
      cocNumber: els.coc?.value?.trim() || "",
      signatureName,
      signedAt: els.signedAt?.value || todayIso()
    };

    if (els.confirmBtn) els.confirmBtn.disabled = true;
    if (els.declineBtn) els.declineBtn.disabled = true;

    try {
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
