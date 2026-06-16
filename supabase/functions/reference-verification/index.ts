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

function buildEmailHtml(data: Record<string, string>) {
  const crewName = data.crew_name || "a SEA-V member";
  const refereeName = data.referee_name || "there";
  const verifyUrl = data.verify_url || "#";

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <p>Hello ${refereeName},</p>
      <p>
        <strong>${crewName}</strong> has asked you to verify a professional reference on SEA-V.
      </p>
      <p>
        Please open the secure link below to confirm or decline the reference.
        The link expires in 14 days and can only be used once.
      </p>
      <p>
        <a href="${verifyUrl}" style="display:inline-block;padding:12px 18px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;">
          Verify reference
        </a>
      </p>
      <p style="font-size:12px;color:#666;">
        If the button does not work, copy and paste this URL into your browser:<br>
        ${verifyUrl}
      </p>
      <p style="font-size:12px;color:#666;">SEA-V — professional profiles for yacht crew</p>
    </div>
  `;
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

    const resendKey = Deno.env.get("RESEND_API_KEY") || "";
    const fromEmail =
      Deno.env.get("REFERENCE_VERIFY_FROM_EMAIL") ||
      "SEA-V <verify@sea-v.com>";

    if (resendKey) {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [data.referee_email],
          subject: `Verify a SEA-V reference for ${data.crew_name}`,
          html: buildEmailHtml(data)
        })
      });

      if (!emailRes.ok) {
        const errText = await emailRes.text();
        return jsonResponse({ error: `Email failed: ${errText}` }, 502);
      }
    }

    if (!resendKey) {
      return jsonResponse(
        {
          error:
            "Email delivery is not configured. Set RESEND_API_KEY on the Edge Function."
        },
        503
      );
    }

    return jsonResponse({
      ok: true,
      emailSent: true,
      message: "Verification email sent"
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return jsonResponse({ error: message }, 500);
  }
});
