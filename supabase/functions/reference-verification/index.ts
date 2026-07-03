import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type"
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmailHtml(data: Record<string, string>) {
  const crewName = escapeHtml(data.crew_name || "a SEA-V member");
  const refereeName = escapeHtml(data.referee_name || "there");
  const verifyUrl = escapeHtml(data.verify_url || "#");

  return `
    <div style="margin:0;padding:32px 16px;background:#0e1c2e;font-family:Arial,sans-serif;">
      <div style="max-width:520px;margin:0 auto;background:#132238;border:1px solid rgba(209,107,255,0.28);border-radius:20px;padding:28px 24px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5bbcff;">SEA-V Reference Verification</p>
        <p style="margin:0 0 18px;font-size:22px;line-height:1.3;font-weight:800;color:#ffffff;">Please verify this reference</p>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.86);">
          Hello ${refereeName},
        </p>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.86);">
          <strong style="color:#ffffff;">${crewName}</strong> has asked you to confirm a professional reference on SEA-V.
        </p>
        <p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.78);">
          Open the secure link below to confirm or decline. The link expires in 14 days and can only be used once.
        </p>
        <p style="margin:0 0 22px;text-align:center;">
          <a href="${verifyUrl}" style="display:inline-block;padding:13px 22px;background:#5bbcff;color:#0e1c2e;text-decoration:none;border-radius:999px;font-size:14px;font-weight:800;">
            Verify reference
          </a>
        </p>
        <p style="margin:0;font-size:12px;line-height:1.6;color:rgba(255,255,255,0.55);">
          If the button does not work, copy this URL into your browser:<br>
          <a href="${verifyUrl}" style="color:#9ddcff;word-break:break-all;">${verifyUrl}</a>
        </p>
      </div>
      <p style="max-width:520px;margin:16px auto 0;font-size:11px;line-height:1.5;color:rgba(255,255,255,0.45);text-align:center;">
        SEA-V — professional profiles for yacht crew
      </p>
    </div>
  `;
}

function buildEmailText(data: Record<string, string>) {
  const crewName = data.crew_name || "a SEA-V member";
  const refereeName = data.referee_name || "there";
  const verifyUrl = data.verify_url || "";

  return [
    `Hello ${refereeName},`,
    "",
    `${crewName} has asked you to verify a professional reference on SEA-V.`,
    "",
    "Open this secure link to confirm or decline (expires in 14 days, single use):",
    verifyUrl,
    "",
    "SEA-V — professional profiles for yacht crew"
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: "Server misconfigured" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const body = await req.json();
    const action = String(body?.action || "");
    const referenceId = String(body?.referenceId || "");

    if (action !== "send" || !referenceId) {
      return jsonResponse({ error: "Invalid request" }, 400);
    }

    const { data, error } = await supabase.rpc("request_reference_verification", {
      p_reference_id: referenceId
    });

    if (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    const verifyUrl = String(data?.verify_url || "");
    const refereeEmail = String(data?.referee_email || "");
    const payloadBase = {
      ok: true,
      refereeEmail,
      verifyUrl
    };

    const resendKey = Deno.env.get("RESEND_API_KEY") || "";
    const fromEmail =
      Deno.env.get("REFERENCE_VERIFY_FROM_EMAIL") ||
      "SEA-V <verify@sea-v.com>";

    if (!resendKey) {
      return jsonResponse({
        ...payloadBase,
        emailSent: false,
        message: "Verification link created. Email delivery is not configured on the server."
      });
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [refereeEmail],
        subject: `Verify a SEA-V reference for ${data.crew_name}`,
        html: buildEmailHtml(data),
        text: buildEmailText(data)
      })
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      return jsonResponse(
        {
          ...payloadBase,
          emailSent: false,
          error: `Email could not be sent: ${errText}`,
          message: "Verification link created, but the email could not be delivered. Share the link manually."
        },
        502
      );
    }

    return jsonResponse({
      ok: true,
      emailSent: true,
      refereeEmail,
      message: `Verification email sent to ${refereeEmail}`
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return jsonResponse({ error: message }, 500);
  }
});
