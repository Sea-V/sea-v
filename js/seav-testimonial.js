// /js/seav-testimonial.js — sea service testimonials on the Sea Time page (v579).
//
//   SeavTestimonial.statusHtml(entry)  -> small pill for the entry's row
//   SeavTestimonial.actionHtml(entry)  -> "Get captain's signature" /
//                                         "Print testimonial" button
// Clicks are delegated here. Requests go to edge function `sea-testimonial`
// with the member's access token; the captain answers on
// verify-testimonial.html. The confirmation itself is stored by the database
// (docs/schema-sea-service-testimonials.sql) and is read-only for members.
(function () {
  "use strict";

  const FUNCTION_URL = "https://bnjtrwmwyulvmsautssd.supabase.co/functions/v1/sea-testimonial";

  const esc = (v) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  function prettyDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    if (!m) return iso || "—";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
  }

  const STATUS = {
    Sent: { label: "Sent to captain", cls: "pill-warning" },
    Confirmed: { label: "Captain confirmed", cls: "pill-valid" },
    Declined: { label: "Captain declined", cls: "pill-expired" },
    Changed: { label: "Edited since confirmed", cls: "pill-warning" }
  };

  function statusHtml(entry) {
    const s = STATUS[entry?.testimonialStatus];
    if (!s) return "";
    const who = entry.testimonial?.master_name ? ` — ${entry.testimonial.master_name}` : "";
    return `<br><small class="cert-status-pill ${s.cls} seav-tst-pill" title="${esc(s.label + who)}">${esc(s.label)}</small>`;
  }

  function actionHtml(entry) {
    const id = esc(entry?.id || "");
    if (entry?.testimonialStatus === "Confirmed") {
      return `<button type="button" class="seav-action seav-action--secondary" data-tst-print="${id}">Print testimonial</button>`;
    }
    if (entry?.testimonialStatus === "Sent") {
      return `<button type="button" class="seav-action seav-action--secondary" data-tst-request="${id}">Send again</button>`;
    }
    if (!entry?.dateJoined || !entry?.dateLeft) return "";
    return `<button type="button" class="seav-action seav-action--secondary" data-tst-request="${id}">Get captain's signature</button>`;
  }

  function getEntry(id) {
    return (window.SeavState?.seatimes || []).find((s) => s.id === id) || null;
  }

  // ---------------------------------------------------------------- request
  async function sendRequest(seatimeId, masterName, masterEmail) {
    const client = window.SeavSupabase;
    const session = (await client?.auth.getSession())?.data?.session;
    if (!session?.access_token) throw new Error("Please sign in again.");
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: "request", seatimeId, masterName, masterEmail })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "The request could not be sent.");
    return body;
  }

  function openRequest(entry) {
    const modal = document.getElementById("tstModal");
    if (!modal) return;
    document.getElementById("tst_seatime_id").value = entry.id;
    document.getElementById("tstEntryLine").textContent = [
      entry.capacityServed,
      `${prettyDate(entry.dateJoined)} – ${prettyDate(entry.dateLeft)}`
    ]
      .filter(Boolean)
      .join(" · ");
    const last = entry.testimonial || {};
    document.getElementById("tst_master_name").value = last.master_name || "";
    document.getElementById("tst_master_email").value = last.master_email || "";
    window.SeavModals?.openModal?.("tstModal");
  }

  // ------------------------------------------------------------------ print
  function printTestimonial(entry) {
    const t = entry?.testimonial;
    if (!t || t.decision !== "confirmed") return;
    const crew = t.crew || {};
    const vessel = t.vessel || {};
    const logged = t.logged || {};
    const conf = t.confirmed || {};
    const row = (label, value) => (String(value ?? "").trim() ? `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>` : "");
    const dayRow = (label, key) => {
      const a = Number(logged[key] ?? 0);
      const b = Number(conf[key] ?? 0);
      return `<tr><th>${esc(label)}</th><td>${b}</td><td class="muted">${a === b ? "" : `logged ${a}`}</td></tr>`;
    };

    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Sea Service Testimonial — ${esc(crew.name || "")}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font: 13px/1.5 Arial, Helvetica, sans-serif; color: #0b1733; margin: 0; }
  h1 { font-size: 22px; margin: 0 0 2px; }
  h2 { font-size: 14px; margin: 22px 0 6px; padding-bottom: 4px; border-bottom: 2px solid #0b1c2e; text-transform: uppercase; letter-spacing: .04em; }
  .sub { color: #475569; margin: 0 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-weight: 600; color: #334155; width: 38%; padding: 5px 0; vertical-align: top; }
  td { padding: 5px 0; }
  .days th { width: 50%; }
  .muted { color: #64748b; font-size: 12px; }
  .sig { font: italic 24px Georgia, "Times New Roman", serif; margin: 10px 0 2px; }
  .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; margin-top: 8px; }
  .foot { margin-top: 26px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 8px; }
</style></head>
<body>
  <h1>Sea Service Testimonial</h1>
  <p class="sub">Confirmed online by the master on ${esc(prettyDate(String(t.answered_at || "").slice(0, 10)))} · prepared with SEA-V</p>

  <h2>Seafarer</h2>
  <table>${row("Name", crew.name)}${row("Date of birth", crew.dob ? prettyDate(crew.dob) : "")}${row("Nationality", crew.nationality)}${row("Discharge book", crew.discharge_book)}</table>

  <h2>Vessel</h2>
  <table>${row("Name", vessel.name)}${row("Type", vessel.type)}${row("Flag", vessel.flag)}${row("Official number", vessel.official_number)}${row("IMO", vessel.imo)}${row("Gross tonnage", vessel.gt)}${row("Length (m)", vessel.length)}${row("Propulsion (kW)", vessel.engine_kw)}</table>

  <h2>Service</h2>
  <table>${row("Capacity", conf.capacity)}${row("Joined", prettyDate(conf.date_joined))}${row("Left", prettyDate(conf.date_left))}</table>
  <table class="days" style="margin-top:6px">
    ${dayRow("Actual sea service (days)", "actual_sea")}
    ${dayRow("Standby service (days)", "standby")}
    ${dayRow("Yard service (days)", "yard")}
    ${dayRow("Watchkeeping (days)", "watchkeeping")}
  </table>

  <h2>Master's declaration</h2>
  <p>I confirm that, to the best of my knowledge, this sea service is correct, and that I was master of this vessel (or am authorised to sign for it) during this period.</p>
  <div class="box">
    <table>${row("Name", t.master_name)}${row("Position", t.master_rank)}${row("CoC", t.coc_grade)}${row("CoC number", t.coc_number)}${row("Email", t.master_email)}${row("Comment", t.comment)}</table>
    <p class="sig">${esc(t.signature || "")}</p>
    <p class="muted">Signed electronically by typing their name, ${esc(prettyDate(String(t.answered_at || "").slice(0, 10)))}</p>
  </div>

  <p class="foot">
    SEA-V record ${esc(entry.id)} · confirmed ${esc(String(t.answered_at || ""))}.<br>
    This testimonial was confirmed by the named master through a single-use link sent to their email address.
    SEA-V is not the MCA: for a Notice of Eligibility, large-yacht sea service must be verified by the PYA or
    Nautilus (MCA notice MIN 543) — attach or transfer these details to their testimonial form.
  </p>
  <script>window.addEventListener("load", function () { window.print(); });</${"script"}>
</body></html>`;

    const win = window.open("", "_blank");
    if (!win) {
      window.Seav?.notify?.("error", "Pop-up blocked", "Allow pop-ups for SEA-V to print the testimonial.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  // ------------------------------------------------------------------- wire
  function init() {
    document.addEventListener("click", (e) => {
      const req = e.target.closest("[data-tst-request]");
      if (req) {
        const entry = getEntry(req.getAttribute("data-tst-request"));
        if (entry) openRequest(entry);
        return;
      }
      const prt = e.target.closest("[data-tst-print]");
      if (prt) {
        const entry = getEntry(prt.getAttribute("data-tst-print"));
        if (entry) printTestimonial(entry);
      }
    });

    document.getElementById("tstForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("tst_seatime_id").value;
      const name = document.getElementById("tst_master_name").value.trim();
      const email = document.getElementById("tst_master_email").value.trim();
      if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        window.Seav.notify("error", "Add the captain's details", "Enter their name and a valid email address.");
        return;
      }
      await window.Seav.withSaving(
        async () => {
          await sendRequest(id, name, email);
          window.SeavModals?.closeAllModals?.();
          window.Seav.notify("success", "Request sent", `We emailed ${email}. You'll be told when they answer.`);
          if (window.Seav.app?.refreshAll) await window.Seav.app.refreshAll();
        },
        { sub: "Sending to your captain", rethrow: true }
      ).catch((err) => window.Seav.notify("error", "Could not send", err?.message || "Try again."));
    });
  }

  window.SeavTestimonial = { statusHtml, actionHtml, printTestimonial };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
