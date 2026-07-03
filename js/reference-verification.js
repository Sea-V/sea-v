// /js/reference-verification.js — reference verification (share link via personal email)
(function () {
  "use strict";

  async function getClient() {
    if (window.SeavAuth?.whenReady) {
      await window.SeavAuth.whenReady();
    }
    const client = window.SeavSupabase;
    if (!client) throw new Error("Supabase client not available");
    return client;
  }

  function functionUrl() {
    return String(window.SeavConfig?.REFERENCE_VERIFICATION_FUNCTION_URL || "").trim();
  }

  function useEdgeEmail() {
    return !!functionUrl() && window.SeavConfig?.REFERENCE_VERIFICATION_USE_EDGE_EMAIL === true;
  }

  function localizeVerifyUrl(url) {
    if (!url || !window.SeavConfig?.SHOW_DEV_VERIFY_LINK) return url;
    try {
      const parsed = new URL(url, window.location.origin);
      return `${window.location.origin}${parsed.pathname}${parsed.search}`;
    } catch {
      return url;
    }
  }

  function normalizeSendResult(body = {}, defaults = {}) {
    const verifyUrl = localizeVerifyUrl(body.verifyUrl || body.verify_url || defaults.verifyUrl || "");
    const refereeEmail = body.refereeEmail || body.referee_email || defaults.refereeEmail || "";
    const emailSent = !!body.emailSent;

    return {
      ok: body.ok !== false,
      emailSent,
      verifyUrl: verifyUrl || null,
      refereeEmail,
      message:
        body.message ||
        defaults.message ||
        (emailSent
          ? `Verification email sent to ${refereeEmail || "the referee"}.`
          : "Copy the suggested email and send it from your own account."),
      error: body.error || null
    };
  }

  function buildVerificationEmailDraft(options = {}) {
    const verifyUrl = String(options.verifyUrl || "").trim();
    const refereeName = String(options.refereeName || "there").trim() || "there";
    const refereeEmail = String(options.refereeEmail || "").trim();
    const crewName = String(options.crewName || "A SEA-V member").trim() || "A SEA-V member";
    const vesselName = String(options.vesselName || "").trim();

    const subject = `Reference verification request — ${crewName}`;
    const vesselLine = vesselName ? `\nVessel: ${vesselName}` : "";

    const body = [
      `Dear ${refereeName},`,
      "",
      `I am updating my professional profile on SEA-V and would be grateful if you could confirm the reference I have listed for you.${vesselLine}`,
      "",
      "Please open this secure one-time link to review the details and confirm or decline:",
      verifyUrl,
      "",
      "The link expires in 14 days and does not require a SEA-V account.",
      "",
      "Thank you,",
      crewName
    ].join("\n");

    const header = refereeEmail ? `To: ${refereeEmail}\nSubject: ${subject}\n\n` : `Subject: ${subject}\n\n`;

    return {
      subject,
      body,
      fullText: `${header}${body}`
    };
  }

  function showVerifyLinkDialog(verifyUrl, options = {}) {
    if (!verifyUrl) return;

    const existing = document.getElementById("seavVerifyLinkDialog");
    if (existing) existing.remove();

    const refereeEmail = options.refereeEmail || "";
    const draft = buildVerificationEmailDraft({
      verifyUrl,
      refereeEmail,
      refereeName: options.refereeName,
      crewName: options.crewName,
      vesselName: options.vesselName
    });

    const overlay = document.createElement("div");
    overlay.id = "seavVerifyLinkDialog";
    overlay.className = "modal seav-verify-link-dialog";
    overlay.style.zIndex = "13000";
    overlay.innerHTML = `
      <div class="modal-card modal-card--purple seav-verify-link-card">
        <div class="modal-head">
          <h3>Share with your referee</h3>
          <button type="button" class="modal-x" data-close-verify-link aria-label="Close">&times;</button>
        </div>
        <div class="modal-form seav-verify-link-form">
          <p class="modal-intro seav-verify-link-intro">
            For a personal touch, email your referee from your own account. Copy the message below, paste it into your email client, and send it to
            ${refereeEmail ? `<strong>${escapeHtml(refereeEmail)}</strong>` : "the referee"}.
          </p>

          <label class="seav-verify-link-field">
            Suggested email
            <textarea readonly id="seavVerifyEmailDraft" rows="12">${escapeHtml(draft.fullText)}</textarea>
          </label>

          <label class="seav-verify-link-field">
            Verification link only
            <input type="text" readonly id="seavVerifyLinkField" value="${escapeHtml(verifyUrl)}" />
          </label>

          <div class="seav-verify-link-actions">
            <button type="button" class="btn-blue" id="seavVerifyEmailCopy">Copy email</button>
            <button type="button" class="btn-ghost2" id="seavVerifyLinkCopy">Copy link</button>
            <a class="btn-ghost2" id="seavVerifyLinkOpen" target="_blank" rel="noopener">Preview link</a>
          </div>
        </div>
      </div>
    `;

    overlay.hidden = false;
    document.body.appendChild(overlay);

    const field = overlay.querySelector("#seavVerifyLinkField");
    const draftField = overlay.querySelector("#seavVerifyEmailDraft");

    const openLink = overlay.querySelector("#seavVerifyLinkOpen");
    if (openLink) openLink.href = verifyUrl;

    overlay.querySelector("[data-close-verify-link]")?.addEventListener("click", () => {
      overlay.remove();
    });

    overlay.querySelector("#seavVerifyEmailCopy")?.addEventListener("click", async () => {
      await copyText(draft.fullText, draftField, "Email copied", "Select the email text and copy it.");
    });

    overlay.querySelector("#seavVerifyLinkCopy")?.addEventListener("click", async () => {
      await copyText(verifyUrl, field, "Link copied", "Select the link and copy it.");
    });

    console.info("[SEA-V] Reference verification link:", verifyUrl);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function copyText(text, fieldEl, successTitle, fallbackDetail) {
    try {
      await navigator.clipboard.writeText(text);
      if (window.Seav?.notify) {
        Seav.notify("success", successTitle, "Paste into your email app.");
      }
    } catch {
      fieldEl?.focus?.();
      fieldEl?.select?.();
      if (window.Seav?.notify) {
        Seav.notify("info", "Copy manually", fallbackDetail);
      }
    }
  }

  async function sendViaRpc(referenceId) {
    const client = await getClient();
    const { data, error } = await client.rpc("request_reference_verification", {
      p_reference_id: referenceId
    });

    if (error) {
      throw new Error(error.message || error.details || "Verification request failed");
    }

    return normalizeSendResult(data, {
      verifyUrl: data?.verify_url,
      refereeEmail: data?.referee_email,
      message: "Send the suggested email from your own account."
    });
  }

  async function sendViaEdgeFunction(referenceId) {
    const client = await getClient();
    const session = (await client.auth.getSession())?.data?.session;
    if (!session?.access_token) {
      throw new Error("Sign in required to send verification email");
    }

    const res = await fetch(functionUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: window.SeavSupabaseConfig?.anonKey || ""
      },
      body: JSON.stringify({ action: "send", referenceId })
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (body.verifyUrl || body.verify_url) {
        return normalizeSendResult(body, { emailFailed: true });
      }
      throw new Error(body.error || body.message || "Failed to send verification email");
    }

    return normalizeSendResult(body);
  }

  async function sendRequest(referenceId) {
    if (!useEdgeEmail()) {
      return sendViaRpc(referenceId);
    }

    try {
      return await sendViaEdgeFunction(referenceId);
    } catch (err) {
      console.warn("[SEA-V] Edge verification email failed, using share-link flow:", err);
      const fallback = await sendViaRpc(referenceId);
      fallback.message = "Send the suggested email from your own account.";
      fallback.error = fallback.error || String(err?.message || "Automated email unavailable");
      return fallback;
    }
  }

  async function preview(token) {
    const client = window.SeavPublicSupabase || (await getClient());
    const { data, error } = await client.rpc("preview_reference_verification", {
      p_token: token
    });
    if (error) {
      throw new Error(error.message || error.details || "Could not load verification request");
    }
    return normalizePreviewData(data);
  }

  function normalizeAttachment(raw) {
    if (!raw) return null;
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        return null;
      }
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

    const path = raw.path || raw.filePath || raw.storagePath || "";
    const url = raw.url || raw.publicUrl || raw.signedUrl || "";
    const dataUrl = raw.dataUrl || "";

    if (!path && !url && !dataUrl) return null;

    return {
      ...raw,
      path: path || null,
      bucket: raw.bucket || "reference-files",
      filename: raw.filename || raw.name || null,
      url: url || null,
      dataUrl: dataUrl || null
    };
  }

  function normalizePreviewData(data) {
    if (!data || typeof data !== "object") return data;
    return {
      ...data,
      attachment: normalizeAttachment(data.attachment)
    };
  }

  async function complete(token, payload) {
    const client = window.SeavPublicSupabase || (await getClient());
    const request = { token, payload };

    let { data, error } = await client.rpc("complete_reference_verification_v2", {
      p_request: request
    });

    if (error && /could not find the function|404|42883/i.test(String(error.message || ""))) {
      ({ data, error } = await client.rpc("complete_reference_verification", {
        p_token: token,
        p_payload: payload
      }));
    }

    if (error) {
      throw new Error(error.message || error.details || "Verification submit failed");
    }
    return data;
  }

  window.SeavReferenceVerification = {
    sendRequest,
    preview,
    complete,
    showVerifyLinkDialog,
    buildVerificationEmailDraft
  };
})();
