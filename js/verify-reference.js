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
    crewName: document.getElementById("vrCrewName"),
    refereeName: document.getElementById("vrRefereeName"),
    meta: document.getElementById("vrMeta"),
    referenceText: document.getElementById("vrReferenceText"),
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
    successText: document.getElementById("vrSuccessText")
  };

  let previewData = null;
  let submitting = false;

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

  function formatMeta(data) {
    const parts = [];
    if (data.vessel_name) parts.push(data.vessel_name);
    if (data.crew_role) parts.push(data.crew_role);
    if (data.service_period) parts.push(data.service_period);
    return parts.join(" • ") || "—";
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
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

      if (els.crewName) els.crewName.textContent = previewData.crew_name || "SEA-V member";
      if (els.refereeName) els.refereeName.textContent = previewData.referee_name || "Referee";
      if (els.meta) els.meta.textContent = formatMeta(previewData);
      if (els.referenceText) {
        els.referenceText.textContent = previewData.reference_text || "—";
      }
      if (els.rank) {
        els.rank.value = previewData.referee_title || "";
      }
      if (els.signedAt) {
        els.signedAt.value = todayIso();
      }
    } catch (err) {
      showError(err?.message || "Could not load this verification request.");
    }
  }

  async function submitVerification(confirmed) {
    if (submitting || !token) return;
    submitting = true;

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
