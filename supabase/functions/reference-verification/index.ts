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

const LOGO_BASE64 =
  "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";

function buildEmailHtml(data: Record<string, string>) {
  const crewName = escapeHtml(data.crew_name || "a SEA-V member");
  const refereeName = escapeHtml(data.referee_name || "there");
  const verifyUrl = escapeHtml(data.verify_url || "#");

  return `<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background-color:#f4f6f9; font-family: Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9; padding: 32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0;">

            <!-- Header -->
            <tr>
              <td style="background-color:#0b1c2e; padding:28px 32px; text-align:center;">
                <img src="data:image/png;base64,${LOGO_BASE64}" width="160" height="42" alt="SEA-V" style="display:block; margin:0 auto; border:0;" />
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:36px 32px 8px;">
                <h1 style="margin:0 0 16px; color:#0b1733; font-size:21px; font-weight:700; line-height:1.3;">
                  Verify a reference request
                </h1>
                <p style="margin:0 0 16px; color:#334155; font-size:15px; line-height:1.6;">
                  Hello ${refereeName},
                </p>
                <p style="margin:0 0 16px; color:#334155; font-size:15px; line-height:1.6;">
                  <strong>${crewName}</strong> has listed you as a referee on SEA-V, the digital career
                  platform for yacht crew, and asked you to confirm a professional reference on their behalf.
                </p>
                <p style="margin:0 0 20px; color:#334155; font-size:15px; line-height:1.6;">
                  Continue below to review the details and confirm or decline. The link is single-use and
                  expires in 14 days.
                </p>
              </td>
            </tr>

            <!-- CTA button -->
            <tr>
              <td style="padding:8px 32px 32px;" align="center">
                <a href="${verifyUrl}"
                   style="display:inline-block; padding:14px 34px; background-color:#2d7cff; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:999px;">
                  Verify reference
                </a>
              </td>
            </tr>

            <!-- Fallback link -->
            <tr>
              <td style="padding:0 32px 28px;">
                <p style="margin:0 0 6px; color:#64748b; font-size:12.5px; line-height:1.6;">
                  If the button above doesn't work, copy and paste this link into your browser:
                </p>
                <p style="margin:0; word-break:break-all; color:#2d7cff; font-size:12.5px; line-height:1.6;">
                  ${verifyUrl}
                </p>
              </td>
            </tr>

            <!-- Security note -->
            <tr>
              <td style="padding:20px 32px 28px; border-top:1px solid #e2e8f0;">
                <p style="margin:0; color:#94a3b8; font-size:12px; line-height:1.6;">
                  This link is single-use and will expire for your security. If you weren't expecting this
                  request or don't recognize ${crewName}, you can safely ignore this email — no reference
                  will be recorded without your confirmation.
                </p>
              </td>
            </tr>

          </table>

          <!-- Footer -->
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="margin-top:20px;">
            <tr>
              <td align="center" style="padding: 0 32px;">
                <p style="margin:0; color:#94a3b8; font-size:11.5px; line-height:1.6;">
                  SEA-V — Maritime Career Platform for Yacht Crew<br />
                  <a href="https://www.sea-v.com" style="color:#94a3b8;">sea-v.com</a>
                  &nbsp;·&nbsp;
                  <a href="mailto:admin@sea-v.com" style="color:#94a3b8;">admin@sea-v.com</a>
                </p>
              </td>
            </tr>
          </table>

        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildEmailText(data: Record<string, string>) {
  const crewName = data.crew_name || "a SEA-V member";
  const refereeName = data.referee_name || "there";
  const verifyUrl = data.verify_url || "";

  return [
    `Hello ${refereeName},`,
    "",
    `${crewName} has listed you as a referee on SEA-V, the digital career platform for yacht crew, and asked you to confirm a professional reference on their behalf.`,
    "",
    "Open this secure link to review and confirm or decline (single-use, expires in 14 days):",
    verifyUrl,
    "",
    `If you weren't expecting this request or don't recognize ${crewName}, you can safely ignore this email — no reference will be recorded without your confirmation.`,
    "",
    "SEA-V — Maritime Career Platform for Yacht Crew",
    "sea-v.com"
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
          message: "The verification email could not be delivered. Try again, or contact SEA-V support."
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
