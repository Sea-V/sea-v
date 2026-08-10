// /js/reference-verification.js — reference verification (automated referee email only, no manual fallback)
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
        `Verification email sent to ${refereeEmail || "the referee"}.`,
      error: body.error || null
    };
  }

  // Automated email is the only supported path — a self-forwarded manual
  // link doesn't hold the same currency with a referee as a real email
  // arriving from SEA-V's own domain, so there is deliberately no
  // copy-paste/share-link fallback here. Any failure (missing config,
  // network error, Resend delivery failure, server not sending the email)
  // surfaces as a thrown error for the caller to show as a hard failure.
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

    if (!body.emailSent) {
      throw new Error(body.error || body.message || "Verification email could not be sent");
    }

    return normalizeSendResult(body);
  }

  async function sendRequest(referenceId) {
    if (!useEdgeEmail()) {
      throw new Error("Automated verification email is not configured. Contact SEA-V support.");
    }
    return sendViaEdgeFunction(referenceId);
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

  async function prepareSignatureUpload(token) {
    const client = window.SeavPublicSupabase || (await getClient());
    const { data, error } = await client.rpc("prepare_reference_verification_signature", {
      p_token: token
    });
    if (error) {
      throw new Error(error.message || error.details || "Could not prepare signature upload");
    }
    return data;
  }

  async function uploadSignatureImage(token, blob) {
    if (!blob) return null;

    const slot = await prepareSignatureUpload(token);
    const bucket = slot?.bucket || "reference-files";
    const path = slot?.path;
    if (!path) throw new Error("Could not allocate signature storage path");

    const client = window.SeavPublicSupabase || (await getClient());
    const { error } = await client.storage.from(bucket).upload(path, blob, {
      upsert: true,
      contentType: "image/png",
      cacheControl: "3600"
    });

    if (error) {
      throw new Error(error.message || "Could not upload signature");
    }

    return {
      bucket,
      path,
      filename: "signature.png",
      mime: "image/png",
      uploadedAt: new Date().toISOString()
    };
  }

  async function complete(token, payload) {
    const client = window.SeavPublicSupabase || (await getClient());
    const request = { token, payload };

    let { data, error } = await client.rpc("complete_reference_verification_v4", {
      p_request: request
    });

    if (error && /could not find the function|404|42883/i.test(String(error.message || ""))) {
      ({ data, error } = await client.rpc("complete_reference_verification_v3", {
        p_request: request
      }));

      if (error && /could not find the function|404|42883/i.test(String(error.message || ""))) {
        if (payload?.signatureImage) {
          throw new Error(
            "Drawn signatures require the verification signature SQL migration. Run docs/schema-reference-verification-signature.sql in Supabase."
          );
        }

        ({ data, error } = await client.rpc("complete_reference_verification_v2", {
          p_request: request
        }));

        if (error && /could not find the function|404|42883/i.test(String(error.message || ""))) {
          ({ data, error } = await client.rpc("complete_reference_verification", {
            p_token: token,
            p_payload: payload
          }));
        }
      }
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
    uploadSignatureImage
  };
})();
