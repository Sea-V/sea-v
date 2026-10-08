// cert-reminders — daily certificate expiry digest (v579, 2026-10-08).
//
// Called once a day by pg_cron (docs/schema-cert-expiry-reminders.sql) with
// the Vault token in `x-seav-cron`. Deployed with verify_jwt = false because
// pg_cron has no user session; the token is the gate, checked through
// public.verify_cron_token (service_role only).
//
// POST {}                -> send what is due, log it
// POST {"dryRun": true}  -> send nothing, log nothing; return what WOULD be
//                           sent (recipients masked)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type DueRow = {
  user_id: string;
  email: string;
  first_name: string;
  certificate_id: string;
  cert_name: string;
  expiry_date: string;
  days_left: number;
  kind: "90" | "30";
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function esc(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function prettyDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[(m || 1) - 1]} ${y}`;
}

function daysText(n: number) {
  if (n <= 0) return "expires today";
  if (n === 1) return "expires tomorrow";
  return `expires in ${n} days`;
}

function maskEmail(email: string) {
  const [user, domain] = String(email).split("@");
  return `${(user || "").slice(0, 2)}***@${domain || ""}`;
}

const SITE = "https://www.sea-v.com";

function buildHtml(firstName: string, rows: DueRow[]) {
  const items = rows
    .map(
      (r) => `
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #e2e8f0;">
            <strong style="color:#0b1733; font-size:15px;">${esc(r.cert_name)}</strong><br />
            <span style="color:${r.days_left <= 30 ? "#b42318" : "#334155"}; font-size:13px;">
              ${esc(daysText(r.days_left))} · ${esc(prettyDate(r.expiry_date))}
            </span>
          </td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background-color:#f4f6f9; font-family: Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9; padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0;">
            <tr>
              <td style="background-color:#0b1c2e; padding:22px 32px; text-align:center; color:#5bbcff; font-size:22px; font-weight:800; letter-spacing:1px;">
                SEA-V
              </td>
            </tr>
            <tr>
              <td style="padding:30px 32px 8px;">
                <h1 style="margin:0 0 14px; color:#0b1733; font-size:20px; line-height:1.3;">
                  ${rows.length === 1 ? "A certificate is expiring soon" : `${rows.length} certificates are expiring soon`}
                </h1>
                <p style="margin:0 0 14px; color:#334155; font-size:15px; line-height:1.6;">
                  Hello${firstName ? ` ${esc(firstName)}` : ""}, from the dates saved in your SEA-V account:
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 30px;" align="center">
                <a href="${SITE}/certificates.html"
                   style="display:inline-block; padding:13px 30px; background-color:#2d7cff; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:999px;">
                  View your certificates
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 24px; border-top:1px solid #e2e8f0;">
                <p style="margin:0; color:#94a3b8; font-size:12px; line-height:1.6;">
                  You get this because you saved expiry dates in SEA-V. Already renewed? Update the date and we'll stop reminding you.
                  <a href="${SITE}/profile.html#reminders" style="color:#94a3b8;">Turn off expiry reminders</a>.
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

function buildText(firstName: string, rows: DueRow[]) {
  return [
    `Hello${firstName ? ` ${firstName}` : ""},`,
    "",
    "From the dates saved in your SEA-V account:",
    ...rows.map((r) => `- ${r.cert_name}: ${daysText(r.days_left)} (${prettyDate(r.expiry_date)})`),
    "",
    `View your certificates: ${SITE}/certificates.html`,
    "",
    "Already renewed? Update the date and we'll stop reminding you.",
    `Turn off expiry reminders: ${SITE}/profile.html#reminders`
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) return json({ error: "Server misconfigured" }, 500);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const token = req.headers.get("x-seav-cron") || "";
  const { data: tokenOk, error: tokenError } = await admin.rpc("verify_cron_token", { p_token: token });
  if (tokenError || tokenOk !== true) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dryRun === true;

  const { data, error } = await admin.rpc("due_cert_reminders");
  if (error) return json({ error: error.message }, 500);
  const rows = (data || []) as DueRow[];

  const byUser = new Map<string, DueRow[]>();
  for (const row of rows) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
    byUser.get(row.user_id)!.push(row);
  }

  if (dryRun) {
    return json({
      ok: true,
      dryRun: true,
      members: byUser.size,
      certificates: rows.length,
      preview: [...byUser.values()].map((list) => ({
        to: maskEmail(list[0].email),
        certificates: list.map((r) => ({ name: r.cert_name, expiry: r.expiry_date, daysLeft: r.days_left, kind: r.kind }))
      }))
    });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY") || "";
  if (!resendKey) return json({ error: "Email delivery not configured" }, 500);
  const from = Deno.env.get("REMINDER_FROM_EMAIL") || "SEA-V <reminders@sea-v.com>";

  let sent = 0;
  let failed = 0;
  for (const list of byUser.values()) {
    const first = list[0];
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [first.email],
        subject:
          list.length === 1
            ? `${list[0].cert_name} ${daysText(list[0].days_left)}`
            : `${list.length} of your certificates are expiring soon`,
        html: buildHtml(first.first_name, list),
        text: buildText(first.first_name, list)
      })
    });
    if (!res.ok) {
      failed += 1;
      continue;
    }
    sent += 1;
    await admin.rpc("log_cert_reminders", {
      p_rows: list.map((r) => ({
        user_id: r.user_id,
        certificate_id: r.certificate_id,
        kind: r.kind,
        expiry_date: r.expiry_date
      }))
    });
    // Resend's default limit is 2 requests a second.
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  return json({ ok: true, members: byUser.size, sent, failed });
});
