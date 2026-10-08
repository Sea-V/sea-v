// /js/verify-testimonial.js — the captain's page for a sea service
// testimonial (v579). No account and no Supabase client: every step goes
// through edge function `sea-testimonial` with the single-use link token.
(function () {
  "use strict";

  const FUNCTION_URL = "https://bnjtrwmwyulvmsautssd.supabase.co/functions/v1/sea-testimonial";
  const $ = (id) => document.getElementById(id);

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function prettyDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    if (!m) return iso || "—";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
  }

  async function call(payload) {
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Something went wrong. Please try again.");
    return body;
  }

  function show(state) {
    ["vtLoading", "vtError", "vtSuccess", "vtMain"].forEach((id) => {
      const el = $(id);
      if (el) el.hidden = id !== state;
    });
  }

  function fail(text) {
    $("vtErrorText").textContent = text;
    show("vtError");
  }

  function grid(el, items) {
    if (!el) return;
    el.innerHTML = items
      .filter(([, value]) => String(value ?? "").trim() !== "")
      .map(
        ([label, value]) => `
        <div class="vessel-meta-item">
          <span class="vessel-meta-label">${esc(label)}</span>
          <span class="vessel-meta-value">${esc(value)}</span>
        </div>`
      )
      .join("");
  }

  function render(data) {
    const crew = data.crew || {};
    const vessel = data.vessel || {};
    const svc = data.service || {};
    $("vtIntro").textContent = `${crew.name || "A crew member"} has asked you to confirm their sea service. Everything below comes from their SEA-V records.`;
    grid($("vtCrewGrid"), [
      ["Name", crew.name],
      ["Date of birth", crew.dob ? prettyDate(crew.dob) : ""],
      ["Nationality", crew.nationality],
      ["Discharge book", crew.discharge_book]
    ]);
    grid($("vtVesselGrid"), [
      ["Name", vessel.name],
      ["Type", vessel.type],
      ["Flag", vessel.flag],
      ["Official number", vessel.official_number],
      ["IMO", vessel.imo],
      ["Gross tonnage", vessel.gt],
      ["Length (m)", vessel.length],
      ["Propulsion (kW)", vessel.engine_kw]
    ]);
    grid($("vtServiceGrid"), [
      ["Capacity", svc.capacity],
      ["Joined", prettyDate(svc.date_joined)],
      ["Left", prettyDate(svc.date_left)]
    ]);
    $("vt_actual_sea").value = svc.actual_sea ?? 0;
    $("vt_standby").value = svc.standby ?? 0;
    $("vt_yard").value = svc.yard ?? 0;
    $("vt_watchkeeping").value = svc.watchkeeping ?? 0;
    $("vt_master_name").value = data.master_name || "";
    show("vtMain");
  }

  function done(title, text) {
    $("vtSuccessTitle").textContent = title;
    $("vtSuccessText").textContent = text;
    show("vtSuccess");
  }

  async function init() {
    const token = new URLSearchParams(location.search).get("token") || "";
    if (!token) {
      fail("This link is incomplete. Open it again from the email you received.");
      return;
    }

    let data;
    try {
      data = await call({ action: "preview", token });
    } catch (err) {
      fail(err.message);
      return;
    }
    if (data.state === "used") return fail("This testimonial has already been answered.");
    if (data.state === "expired") return fail("This link has expired. Ask the crew member to send a new request.");
    if (data.state !== "open") return fail("This link is not valid. Open it again from the email you received.");
    render(data);

    const notify = (kind, title, text) =>
      window.Seav?.notify ? window.Seav.notify(kind, title, text) : window.alert(`${title}\n${text || ""}`);

    $("vtForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("vt_master_name").value.trim();
      const signature = $("vt_signature").value.trim();
      if (!name || !signature) {
        notify("error", "Add your name and signature", "Type your full name in both boxes.");
        return;
      }
      if (!$("vt_confirm").checked) {
        notify("error", "Tick the confirmation", "Tick the box to confirm the service is correct.");
        return;
      }
      $("vtConfirmBtn").disabled = true;
      try {
        await call({
          action: "complete",
          token,
          response: {
            decision: "confirm",
            master_name: name,
            master_rank: $("vt_master_rank").value.trim(),
            coc_grade: $("vt_coc_grade").value.trim(),
            coc_number: $("vt_coc_number").value.trim(),
            comment: $("vt_comment").value.trim(),
            signature,
            figures: {
              actual_sea: $("vt_actual_sea").value,
              standby: $("vt_standby").value,
              yard: $("vt_yard").value,
              watchkeeping: $("vt_watchkeeping").value
            }
          }
        });
        done("Thank you — sea service confirmed", "The crew member has been told, and can now print the completed testimonial.");
      } catch (err) {
        $("vtConfirmBtn").disabled = false;
        notify("error", "Could not confirm", err.message);
      }
    });

    $("vtDeclineBtn").addEventListener("click", () => {
      $("vtDeclineBox").hidden = false;
      $("vt_decline_reason").focus();
    });

    $("vtDeclineSend").addEventListener("click", async () => {
      $("vtDeclineSend").disabled = true;
      try {
        await call({
          action: "complete",
          token,
          response: {
            decision: "decline",
            master_name: $("vt_master_name").value.trim(),
            decline_reason: $("vt_decline_reason").value.trim()
          }
        });
        done("Request declined", "The crew member has been told. Nothing was confirmed.");
      } catch (err) {
        $("vtDeclineSend").disabled = false;
        notify("error", "Could not send", err.message);
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
