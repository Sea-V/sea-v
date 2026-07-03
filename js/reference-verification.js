// /js/reference-verification.js — email reference verification (RPC + optional Edge Function)
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
    const message =
      body.message ||
      defaults.message ||
      (emailSent
        ? refereeEmail
          ? `Verification email sent to ${refereeEmail}.`
          : "Verification email sent."
        : "Verification link created.");

    return {
      ok: body.ok !== false,
      emailSent,
      verifyUrl: verifyUrl || null,
      refereeEmail,
      message,
      error: body.error || null
    };
  }

  function showVerifyLinkDialog(verifyUrl, options = {}) {
    if (!verifyUrl) return;

    const existing = document.getElementById("seavVerifyLinkDialog");
    if (existing) existing.remove();

    const refereeEmail = options.refereeEmail || "";
    const emailFailed = !!options.emailFailed;
    const intro = emailFailed
      ? `The email could not be delivered${refereeEmail ? ` to ${refereeEmail}` : ""}. Share this secure link with the referee instead:`
      : refereeEmail
        ? `Email is not configured yet. Share this secure link with ${refereeEmail} (incognito is fine):`
        : "Email is not configured yet. Open this link as the referee (incognito is fine):";

    const overlay = document.createElement("div");
    overlay.id = "seavVerifyLinkDialog";
    overlay.className = "modal seav-verify-link-dialog";
    overlay.style.zIndex = "13000";
    overlay.innerHTML = `
      <div class="modal-card modal-card--purple" style="max-width:560px;">
        <div class="modal-head">
          <h3>${emailFailed ? "Share verification link" : "Verification link"}</h3>
          <button type="button" class="modal-x" data-close-verify-link>&times;</button>
        </div>
        <div class="modal-form">
          <p class="modal-intro">${intro}</p>
          <input type="text" readonly id="seavVerifyLinkField" />
          <div class="verify-reference-actions">
            <button type="button" class="btn-blue" id="seavVerifyLinkCopy">Copy link</button>
            <a class="btn-ghost2" id="seavVerifyLinkOpen" target="_blank" rel="noopener">Open link</a>
          </div>
        </div>
      </div>
    `;

    overlay.hidden = false;
    document.body.appendChild(overlay);

    const field = overlay.querySelector("#seavVerifyLinkField");
    if (field) field.value = verifyUrl;

    const openLink = overlay.querySelector("#seavVerifyLinkOpen");
    if (openLink) openLink.href = verifyUrl;

    overlay.querySelector("[data-close-verify-link]")?.addEventListener("click", () => {
      overlay.remove();
    });

    overlay.querySelector("#seavVerifyLinkCopy")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(verifyUrl);
        if (window.Seav?.notify) {
          Seav.notify("success", "Copied", "Verification link copied.");
        }
      } catch {
        field?.select?.();
        if (window.Seav?.notify) {
          Seav.notify("info", "Copy manually", "Select the link and copy it.");
        }
      }
    });

    console.info("[SEA-V] Reference verification link:", verifyUrl);
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
      message: data?.referee_email
        ? `Verification link ready for ${data.referee_email}.`
        : "Verification link created."
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
    const edgeUrl = functionUrl();
    const useEdge = edgeUrl && !window.SeavConfig?.SHOW_DEV_VERIFY_LINK;

    if (!useEdge) {
      return sendViaRpc(referenceId);
    }

    try {
      return await sendViaEdgeFunction(referenceId);
    } catch (err) {
      console.warn("[SEA-V] Edge verification email failed, trying RPC fallback:", err);
      try {
        const fallback = await sendViaRpc(referenceId);
        if (!fallback.emailSent) {
          fallback.message =
            fallback.message ||
            "Email service unavailable. Share the verification link with the referee manually.";
          fallback.error = fallback.error || String(err?.message || "Email service unavailable");
        }
        return fallback;
      } catch (rpcErr) {
        throw rpcErr;
      }
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
    return data;
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
    showVerifyLinkDialog
  };
})();
