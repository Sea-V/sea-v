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

  function showVerifyLinkDialog(verifyUrl) {
    if (!verifyUrl) return;

    const existing = document.getElementById("seavVerifyLinkDialog");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "seavVerifyLinkDialog";
    overlay.className = "modal seav-verify-link-dialog";
    overlay.style.zIndex = "13000";
    overlay.innerHTML = `
      <div class="modal-card modal-card--purple" style="max-width:560px;">
        <div class="modal-head">
          <h3>Verification link</h3>
          <button type="button" class="modal-x" data-close-verify-link>&times;</button>
        </div>
        <div class="modal-form">
          <p class="modal-intro">
            Email is not configured yet. Open this link as the referee (incognito is fine):
          </p>
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

    if (error) throw error;
    const verifyUrl = localizeVerifyUrl(data?.verify_url || null);
    return {
      ok: true,
      message: "Verification link created",
      emailSent: false,
      verifyUrl,
      data
    };
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
      throw new Error(body.error || body.message || "Failed to send verification email");
    }

    return {
      ok: true,
      message: body.message || "Verification email sent",
      emailSent: !!body.emailSent,
      verifyUrl: localizeVerifyUrl(body.verifyUrl || null)
    };
  }

  async function sendRequest(referenceId) {
    const edgeUrl = functionUrl();
    const useEdge = edgeUrl && !window.SeavConfig?.SHOW_DEV_VERIFY_LINK;

    const result = useEdge
      ? await sendViaEdgeFunction(referenceId)
      : await sendViaRpc(referenceId);

    return result;
  }

  async function preview(token) {
    const client = await getClient();
    const { data, error } = await client.rpc("preview_reference_verification", {
      p_token: token
    });
    if (error) throw error;
    return data;
  }

  async function complete(token, payload) {
    const client = await getClient();
    const { data, error } = await client.rpc("complete_reference_verification", {
      p_token: token,
      p_payload: payload
    });
    if (error) throw error;
    return data;
  }

  window.SeavReferenceVerification = {
    sendRequest,
    preview,
    complete,
    showVerifyLinkDialog
  };
})();
