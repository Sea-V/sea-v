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

  // v588: shown as one quiet line under the status pill (a second pill
  // made the cell look stacked and busy).
  const STATUS = {
    Sent: { label: "Sent to captain", cls: "is-wait" },
    Confirmed: { label: "Captain confirmed", cls: "is-ok" },
    Declined: { label: "Captain declined", cls: "is-bad" },
    Changed: { label: "Edited since confirmed", cls: "is-wait" }
  };

  function statusHtml(entry) {
    const s = STATUS[entry?.testimonialStatus];
    if (!s) return "";
    const who = entry.testimonial?.master_name ? ` — ${entry.testimonial.master_name}` : "";
    return `<small class="seav-tst-line ${s.cls}" title="${esc(s.label + who)}">${esc(s.label)}</small>`;
  }

  // v588: an item for the row's Actions menu (js/seav-row-menu.js).
  function actionHtml(entry) {
    const id = esc(entry?.id || "");
    const item = (attr, label) =>
      `<button type="button" class="seav-row-menu-item" ${attr}="${id}">${label}</button>`;
    if (entry?.testimonialStatus === "Confirmed") return item("data-tst-print", "Print testimonial");
    if (entry?.testimonialStatus === "Sent") return item("data-tst-request", "Send to captain again");
    if (!entry?.dateJoined || !entry?.dateLeft) return "";
    return item("data-tst-request", "Get captain&#39;s signature");
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
    const answered = String(t.answered_at || "").slice(0, 10);
    const confirmedOn = prettyDate(answered);
    const ref = `SV-${String(entry.id || "").replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase()}-${answered.replace(/-/g, "")}`;
    const logo = `${location.origin}/img/logo.png`;

    // Days signed on, join and leave day both counted (as MSN 1858 does).
    const dayNum = (iso) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
      return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 : null;
    };
    const a0 = dayNum(conf.date_joined);
    const b0 = dayNum(conf.date_left);
    const signedOn = a0 != null && b0 != null && b0 >= a0 ? b0 - a0 + 1 : null;

    const item = (label, value) =>
      String(value ?? "").trim() ? `<div class="item"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>` : "";
    const figure = (label, key) => {
      const mine = Number(logged[key] ?? 0);
      const master = Number(conf[key] ?? 0);
      const corrected = mine !== master;
      return `<div class="fig${corrected ? " is-corrected" : ""}">
        <b>${master.toLocaleString("en-GB")}</b><span>${esc(label)}</span>
        ${corrected ? `<em>Master's figure · logged ${mine.toLocaleString("en-GB")}</em>` : ""}
      </div>`;
    };

    // v586: miles and owner / guest days. Testimonials confirmed before
    // v586 have neither key, so the row only shows when there is a figure.
    const hasExtras = ["miles", "owner_guest"].some((k) => Number(conf[k] || 0) > 0 || Number(logged[k] || 0) > 0);

    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Sea Service Testimonial — ${esc(crew.name || "")} — ${esc(ref)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  :root { --navy: #0b1c2e; --navy-2: #12283e; --brass: #b8954a; --ink: #0b1733; --muted: #5b6b7d; --rule: #dfe5ec; --soft: #f4f6f9; }
  body { margin: 0; font: 12.5px/1.5 -apple-system, "Segoe UI", Inter, Arial, sans-serif; color: var(--ink); background: #fff; }
  .page { width: 210mm; min-height: 297mm; margin: 0 auto; display: flex; flex-direction: column; background: #fff; }
  /* v586: one slim navy bar, logo at the CV generator's size (7.5mm). */
  header { background: var(--navy); color: #fff; padding: 9px 28px; display: flex; align-items: center; gap: 12px; }
  header img { width: 7.5mm; height: auto; display: block; }
  header h1 { margin: 0; font-size: 12px; letter-spacing: .16em; text-transform: uppercase; font-weight: 700; }
  header .meta { margin-left: auto; text-align: right; font-size: 10px; line-height: 1.4; color: #b7c6d6; letter-spacing: .04em; }
  header .meta b { color: #fff; font-weight: 600; }
  main { padding: 24px 28px 8px; flex: 1; }
  .hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; padding-bottom: 14px; border-bottom: 1px solid var(--rule); }
  .eyebrow { font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); font-weight: 700; }
  .hero h2 { margin: 2px 0 2px; font-size: 26px; line-height: 1.15; font-weight: 800; }
  .hero p { margin: 0; color: var(--muted); font-size: 13px; }
  .onboard { text-align: right; }
  .onboard b { display: block; font-size: 30px; font-weight: 800; line-height: 1; }
  .figs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0 6px; }
  .fig { background: var(--soft); border-top: 3px solid var(--navy); padding: 12px 12px 10px; border-radius: 2px; }
  .fig.is-corrected { border-top-color: var(--brass); }
  .fig b { display: block; font-size: 26px; line-height: 1.05; font-weight: 800; font-variant-numeric: tabular-nums; }
  .fig span { display: block; margin-top: 4px; font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); font-weight: 700; }
  .extras { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 0 0 6px; }
  .extras .fig { background: #fff; border: 1px solid var(--rule); border-top-width: 1px; padding: 9px 12px 8px; }
  .extras .fig b { font-size: 18px; }
  .extras-note { grid-column: 3 / -1; align-self: center; font-size: 10.5px; color: var(--muted); }
  .fig em { display: block; margin-top: 4px; font-style: normal; font-size: 10.5px; color: #8a6a26; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; margin-top: 18px; }
  h3 { margin: 0 0 8px; font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--navy); padding-bottom: 6px; border-bottom: 2px solid var(--navy); }
  dl { margin: 0; }
  .item { display: grid; grid-template-columns: 42% 1fr; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--rule); }
  dt { color: var(--muted); }
  dd { margin: 0; font-weight: 600; }
  .decl { margin-top: 22px; border: 1px solid var(--rule); border-left: 4px solid var(--navy); padding: 16px 18px; display: grid; grid-template-columns: 1fr auto; gap: 18px; align-items: center; }
  .decl p.statement { margin: 0 0 12px; font-size: 13px; }
  .sig { font: italic 30px/1.1 "Snell Roundhand", "Brush Script MT", "Segoe Script", Georgia, serif; color: var(--navy); margin: 4px 0 2px; }
  .sigline { border-top: 1px solid var(--ink); width: 70%; padding-top: 4px; font-size: 11px; color: var(--muted); }
  .decl dl { margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; column-gap: 18px; }
  .seal { width: 118px; height: 118px; }
  .comment { margin-top: 10px; padding: 10px 12px; background: var(--soft); border-radius: 2px; }
  footer { padding: 12px 28px 18px; border-top: 1px solid var(--rule); font-size: 10.5px; color: var(--muted); display: flex; gap: 18px; justify-content: space-between; }
  footer p { margin: 0; max-width: 72%; }
  footer .site { text-align: right; white-space: nowrap; }
  @media screen { body { background: #e9edf2; padding: 20px 0; } .page { box-shadow: 0 10px 40px rgba(11,28,46,.18); } }
</style></head>
<body>
<div class="page">
  <header>
    <img src="${esc(logo)}" alt="SEA-V">
    <h1>Sea Service Testimonial</h1>
    <div class="meta"><b>Confirmed by Master · ${esc(confirmedOn)}</b><br>Ref ${esc(ref)}</div>
  </header>

  <main>
    <section class="hero">
      <div>
        <div class="eyebrow">${esc(conf.capacity || "Sea service")}</div>
        <h2>${esc(vessel.name || "Vessel")}</h2>
        <p>${esc(prettyDate(conf.date_joined))} – ${esc(prettyDate(conf.date_left))}${vessel.flag ? ` · ${esc(vessel.flag)} flag` : ""}${vessel.gt ? ` · ${esc(vessel.gt)}` : ""}</p>
      </div>
      ${signedOn ? `<div class="onboard"><div class="eyebrow">Days signed on</div><b>${signedOn}</b></div>` : ""}
    </section>

    <section class="figs">
      ${figure("Actual sea service", "actual_sea")}
      ${figure("Standby service", "standby")}
      ${figure("Yard service", "yard")}
      ${figure("Watchkeeping", "watchkeeping")}
    </section>
    ${hasExtras ? `<section class="extras">
      ${figure("Nautical miles", "miles")}
      ${figure("Owner / guests onboard", "owner_guest")}
      <p class="extras-note">Recorded for the crew member's career history. Not part of MCA sea service.</p>
    </section>` : ""}

    <section class="cols">
      <div>
        <h3>Seafarer</h3>
        <dl>${item("Name", crew.name)}${item("Date of birth", crew.dob ? prettyDate(crew.dob) : "")}${item("Nationality", crew.nationality)}${item("Discharge book", crew.discharge_book)}${item("Capacity", conf.capacity)}</dl>
      </div>
      <div>
        <h3>Vessel</h3>
        <dl>${item("Name", vessel.name)}${item("Type", vessel.type)}${item("Flag", vessel.flag)}${item("Official number", vessel.official_number)}${item("IMO", vessel.imo)}${item("Gross tonnage", vessel.gt)}${item("Length (m)", vessel.length)}${item("Propulsion (kW)", vessel.engine_kw)}</dl>
      </div>
    </section>

    <section class="decl">
      <div>
        <h3>Master's declaration</h3>
        <p class="statement">I confirm that, to the best of my knowledge, the sea service above is correct, and that I was master of this vessel (or am authorised to sign for it) during this period.</p>
        <div class="sig">${esc(t.signature || "")}</div>
        <div class="sigline">Signed electronically · ${esc(confirmedOn)}</div>
        <dl>${item("Name", t.master_name)}${item("Position", t.master_rank)}${item("CoC", t.coc_grade)}${item("CoC number", t.coc_number)}${item("Email", t.master_email)}</dl>
        ${t.comment ? `<div class="comment"><strong>Comment.</strong> ${esc(t.comment)}</div>` : ""}
      </div>
      <svg class="seal" viewBox="0 0 120 120" aria-hidden="true">
        <defs><path id="sealArc" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0"/></defs>
        <circle cx="60" cy="60" r="57" fill="none" stroke="#b8954a" stroke-width="2"/>
        <circle cx="60" cy="60" r="35" fill="none" stroke="#b8954a" stroke-width="1"/>
        <text font-size="9.5" font-weight="700" letter-spacing="2.6" fill="#8a6a26" font-family="Arial, sans-serif">
          <textPath href="#sealArc">CONFIRMED BY MASTER · SEA-V ·</textPath>
        </text>
        <path d="M46 61 l9 9 l19 -21" fill="none" stroke="#0b1c2e" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="60" y="88" text-anchor="middle" font-size="8" fill="#5b6b7d" font-family="Arial, sans-serif">${esc(answered)}</text>
      </svg>
    </section>
  </main>

  <footer>
    <p>Confirmed by the named master through a single-use link sent to their email address. SEA-V is not the MCA:
      for a Notice of Eligibility, large-yacht sea service must be verified by the PYA or Nautilus (MCA notice MIN 543) —
      attach this record or transfer its details to their testimonial form.</p>
    <div class="site"><strong>sea-v.com</strong><br>Record ${esc(entry.id)}</div>
  </footer>
</div>
<script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 300); });</${"script"}>
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
