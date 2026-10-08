// sea-testimonial — sea service testimonials confirmed online (v579, 2026-10-08).
//
// One function, three actions (docs/schema-sea-service-testimonials.sql):
//   request  — a signed-in member asks a captain to confirm one sea time
//              entry. Needs the member's access token (Authorization:
//              Bearer); two-step login is enforced here, then the
//              service-role RPC creates the link and Resend emails it.
//   preview  — the captain's page reads the testimonial by its link token.
//   complete — the captain confirms (optionally correcting the day counts)
//              or declines; the member is emailed the outcome.
// Deployed with verify_jwt = false because the captain is never signed in;
// every action authenticates itself (member JWT, or the single-use token).
// The RPCs are service_role only — nothing new is callable over the API.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function prettyDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m) return String(iso || "");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const part = token.split(".")[1] || "";
    const padded = part.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((part.length + 3) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return {};
  }
}

function emailShell(title: string, bodyHtml: string, footerHtml: string) {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background-color:#f4f6f9; font-family: Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9; padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0;">
            <tr>
              <td style="background-color:#0b1c2e; padding:22px 32px; text-align:center; color:#5bbcff; font-size:22px; font-weight:800; letter-spacing:1px;">SEA-V</td>
            </tr>
            <tr>
              <td style="padding:30px 32px 10px;">
                <h1 style="margin:0 0 14px; color:#0b1733; font-size:20px; line-height:1.3;">${esc(title)}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 24px; border-top:1px solid #e2e8f0;">
                <p style="margin:0; color:#94a3b8; font-size:12px; line-height:1.6;">${footerHtml}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

const P = 'style="margin:0 0 14px; color:#334155; font-size:15px; line-height:1.6;"';
const BUTTON = (href: string, label: string) => `
  <p style="margin:22px 0 8px; text-align:center;">
    <a href="${esc(href)}" style="display:inline-block; padding:13px 30px; background-color:#2d7cff; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:999px;">${esc(label)}</a>
  </p>`;

async function sendEmail(to: string, subject: string, html: string, text: string) {
  const key = Deno.env.get("RESEND_API_KEY") || "";
  if (!key) return false;
  const from = Deno.env.get("REFERENCE_VERIFY_FROM_EMAIL") || "SEA-V <verify@sea-v.com>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, text })
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) return json({ error: "Server misconfigured" }, 500);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "");

  try {
    // ---------------------------------------------------------------- request
    if (action === "request") {
      const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: userData, error: userError } = await admin.auth.getUser(jwt);
      const user = userData?.user;
      if (userError || !user) return json({ error: "Please sign in again." }, 401);

      // Two-step login: an enrolled member must be on a code-verified session.
      const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId: user.id });
      const hasVerified = (factors?.factors || []).some((f: { status: string }) => f.status === "verified");
      if (hasVerified && decodeJwtPayload(jwt).aal !== "aal2") {
        return json({ error: "Enter your two-step login code first." }, 403);
      }

      const { data, error } = await admin.rpc("testimonial_request", {
        p_user_id: user.id,
        p_seatime_id: String(body?.seatimeId || ""),
        p_master_name: String(body?.masterName || ""),
        p_master_email: String(body?.masterEmail || "")
      });
      if (error) return json({ error: error.message }, 400);

      const d = data as Record<string, string>;
      const dates = `${prettyDate(d.date_joined)} – ${prettyDate(d.date_left)}`;
      const html = emailShell(
        "Please confirm a crew member's sea service",
        `<p ${P}>Hello ${esc(d.master_name)},</p>
         <p ${P}><strong>${esc(d.crew_name)}</strong> has asked you to confirm their sea service${d.vessel_name ? ` on <strong>${esc(d.vessel_name)}</strong>` : ""}, ${esc(dates)}.</p>
         <p ${P}>The testimonial is filled in from their records. You can correct the day counts, add your CoC details, and confirm or decline. It takes about two minutes.</p>
         ${BUTTON(d.verify_url, "Review the testimonial")}
         <p style="margin:12px 0 0; color:#64748b; font-size:12.5px; line-height:1.6; word-break:break-all;">Or paste this link: ${esc(d.verify_url)}</p>`,
        `This link is single-use and expires in 14 days. If you don't recognise ${esc(d.crew_name)}, ignore this email — nothing is recorded without your confirmation.
         ${esc(d.crew_name)} gave SEA-V your name and email address; we use them only for this request.
         <a href="https://www.sea-v.com/privacy.html#referees" style="color:#94a3b8;">How we handle your details</a>.
         SEA-V is not the MCA: for a Notice of Eligibility, large-yacht sea service is verified by the PYA or Nautilus.`
      );
      const text = [
        `Hello ${d.master_name},`,
        "",
        `${d.crew_name} has asked you to confirm their sea service${d.vessel_name ? ` on ${d.vessel_name}` : ""}, ${dates}.`,
        "You can correct the day counts, add your CoC details, and confirm or decline.",
        "",
        `Review the testimonial (single-use, expires in 14 days): ${d.verify_url}`,
        "",
        `${d.crew_name} gave SEA-V your name and email address; we use them only for this request: https://www.sea-v.com/privacy.html#referees`
      ].join("\n");

      const emailSent = await sendEmail(d.master_email, `${d.crew_name} asks you to confirm their sea service`, html, text);
      if (!emailSent) {
        return json({ error: "The email could not be sent. Try again, or contact SEA-V support." }, 502);
      }
      return json({ ok: true, emailSent: true, masterEmail: d.master_email });
    }

    // ---------------------------------------------------------------- preview
    if (action === "preview") {
      const { data, error } = await admin.rpc("testimonial_preview", { p_token: String(body?.token || "") });
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }

    // --------------------------------------------------------------- complete
    if (action === "complete") {
      const { data, error } = await admin.rpc("testimonial_complete", {
        p_token: String(body?.token || ""),
        p_response: body?.response || {}
      });
      if (error) return json({ error: error.message }, 400);

      // Tell the member (best effort — the answer is already saved).
      const result = data as { decision: string; user_id: string; crew_name: string };
      try {
        const { data: member } = await admin.auth.admin.getUserById(result.user_id);
        const to = member?.user?.email;
        if (to && !/@sea-v-demo\.com$/i.test(to)) {
          const confirmed = result.decision === "confirmed";
          const title = confirmed ? "Your sea service was confirmed" : "Your captain declined a sea service request";
          const line = confirmed
            ? "Your captain confirmed your sea service testimonial. You can print the completed testimonial from the Sea Time page."
            : "Your captain declined to confirm one of your sea time entries. Their reason, if they gave one, is on the Sea Time page.";
          await sendEmail(
            to,
            title,
            emailShell(title, `<p ${P}>${esc(line)}</p>${BUTTON("https://www.sea-v.com/seatime.html", "Open Sea Time")}`, "SEA-V — Maritime Career Platform for Yacht Crew"),
            `${line}\n\nhttps://www.sea-v.com/seatime.html`
          );
        }
      } catch (_err) {
        // the captain's answer is saved either way
      }
      return json({ ok: true, decision: result.decision });
    }

    return json({ error: "Invalid request" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
