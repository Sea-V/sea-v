// /js/schengen.js — Schengen days page (v579).
// The rules live in SeavData.computeSchengenDays / checkSchengenTrip
// (seav-data.js); this module only renders them and saves the member's own
// stays to profile.schengen_stays via SeavAPI.saveSchengenStays.
(function () {
  "use strict";

  const D = () => window.SeavData || {};
  const esc = (v) => window.Seav.escapeHtml(v);
  const pretty = (iso) => (iso ? D().formatDatePretty(iso) : "—");

  function getPassages() {
    return window.SeavState?.navigationAreas || [];
  }

  function getProfile() {
    return window.SeavState?.profile || {};
  }

  function getStays() {
    const stays = getProfile().schengenStays;
    return Array.isArray(stays) ? stays : [];
  }

  function compute() {
    return D().computeSchengenDays(getPassages(), getStays());
  }

  let lastResult = null;

  function renderStatus(result, exempt) {
    const el = document.getElementById("schStatus");
    if (!el) return;
    let tone = "ok";
    let title = `${result.left} days left`;
    let text = result.inToday
      ? `You are counted inside Schengen today. Staying without a break, your last day is ${pretty(result.canStayUntil)}.`
      : `You are counted outside Schengen today. Arriving today, you could stay until ${pretty(result.canStayUntil)}.`;

    if (result.overstays.length) {
      tone = "over";
      title = "Over the limit on your record";
      text = `Your logged days go past 90 in 180 from ${pretty(result.overstays[0])}. If that is not right, add the stays you spent outside Schengen.`;
    } else if (result.left <= 0) {
      tone = "over";
      title = "No days left";
      text = result.nextFreed ? `Your next day comes back on ${pretty(result.nextFreed)}.` : "";
    } else if (result.left <= 15) {
      tone = "warn";
    }
    if (exempt) tone = "ok";

    el.className = `sch-notice sch-notice--${tone}`;
    el.innerHTML = `<strong>${esc(title)}</strong><small>${esc(text)}</small>${
      result.lastStayOpen
        ? `<small>Counted as still in ${esc(result.lastStayOpen.country)} since ${esc(pretty(result.lastStayOpen.since))} — your last passage. Left since? Add a stay.</small>`
        : ""
    }`;
  }

  function renderKpis(result) {
    const row = document.getElementById("schKpiRow");
    if (!row) return;
    const box = (num, label) => `
      <div class="sq-kpi-box">
        <div class="kpi-num">${esc(num)}</div>
        <div class="kpi-label">${esc(label)}</div>
      </div>`;
    row.innerHTML = [
      box(String(result.used), "Days used (last 180)"),
      box(String(result.left), "Days left"),
      box(result.canStayUntil ? pretty(result.canStayUntil) : "—", result.inToday ? "Last day if you stay" : "Last day if you arrive today"),
      box(result.nextFreed ? pretty(result.nextFreed) : "—", "Next day back")
    ].join("");
  }

  function renderRuns(result) {
    const list = document.getElementById("schRuns");
    if (!list) return;
    if (!result.runs.length) {
      list.innerHTML = `
        <div class="list-row">
          <div>
            <div class="list-title">No Schengen days on record</div>
            <div class="list-sub">Log passages on the Navigation page, or add a stay, and they will be counted here.</div>
          </div>
        </div>`;
      return;
    }
    list.innerHTML = result.runs
      .slice(0, 40)
      .map(
        (run) => `
        <article class="sq-compact-card sch-run">
          <div class="sq-compact-summary">
            <div class="sq-compact-summary-left">
              <div class="sq-compact-title">${esc(run.from === run.to ? pretty(run.from) : `${pretty(run.from)} – ${pretty(run.to)}`)}</div>
              <div class="sq-compact-sub">${esc(run.countries.join(", ") || "Schengen area")}</div>
            </div>
            <div class="sq-compact-summary-right">
              <small class="sch-run-days">${run.days} day${run.days === 1 ? "" : "s"}</small>
              ${run.manual ? `<small class="sch-run-tag">Includes your stays</small>` : ""}
              ${run.portDays >= 30 ? `<small class="sch-run-tag sch-run-tag--assumed" title="No passage logged leaving port — if you flew home, add a stay">${run.portDays} days assumed in port</small>` : ""}
            </div>
          </div>
        </article>`
      )
      .join("");
  }

  function renderStays() {
    const list = document.getElementById("schStays");
    if (!list) return;
    const stays = [...getStays()].sort((a, b) => String(b.from).localeCompare(String(a.from)));
    if (!stays.length) {
      list.innerHTML = `
        <div class="list-row">
          <div>
            <div class="list-title">None yet</div>
            <div class="list-sub">Add one when your passages don't tell the whole story.</div>
          </div>
        </div>`;
      return;
    }
    list.innerHTML = stays
      .map(
        (stay) => `
        <article class="sq-compact-card sch-run" data-sch-stay="${esc(stay.id)}">
          <div class="sq-compact-summary">
            <div class="sq-compact-summary-left">
              <div class="sq-compact-title">${esc(`${pretty(stay.from)} – ${pretty(stay.to)}`)}</div>
              <div class="sq-compact-sub">${esc(stay.inSchengen ? "Inside Schengen" : "Outside Schengen")}${stay.note ? ` · ${esc(stay.note)}` : ""}</div>
            </div>
            <div class="seav-actions seav-actions--compact">
              ${window.Seav.seavAction("edit", "Edit", `data-edit-sch-id="${esc(stay.id)}"`)}
              ${window.Seav.seavAction("delete", "Delete", `data-del-sch-id="${esc(stay.id)}"`)}
            </div>
          </div>
        </article>`
      )
      .join("");
  }

  function render() {
    const icon = document.getElementById("schShellIcon");
    if (icon && !icon.innerHTML) icon.innerHTML = window.SeavIcons?.schengen || "";
    const result = compute();
    lastResult = result;
    const exempt = D().holdsFreeMovementPassport(getProfile());
    const exemptEl = document.getElementById("schExempt");
    if (exemptEl) exemptEl.hidden = !exempt;
    renderStatus(result, exempt);
    renderKpis(result);
    renderRuns(result);
    renderStays();
  }

  function openForm(stay) {
    document.getElementById("sch_edit_id").value = stay?.id || "";
    document.getElementById("schModalTitle").textContent = stay ? "Edit stay" : "Add a stay";
    document.getElementById("sch_in").value = stay?.inSchengen ? "in" : "out";
    document.getElementById("sch_note").value = stay?.note || "";
    window.Seav.fillDateTriplet("sch_from", stay?.from || "");
    window.Seav.fillDateTriplet("sch_to", stay?.to || "");
    window.SeavModals?.openModal?.("schModal");
  }

  async function saveStays(next, message) {
    await window.Seav.withSaving(
      async () => {
        await window.SeavAPI.saveSchengenStays(next);
        render();
        window.Seav.notify("success", message, "");
      },
      { sub: "Saving your stays" }
    );
  }

  function init() {
    if (!document.getElementById("schKpiRow")) return;

    window.Seav.bindStateRefresh(render, { label: "Schengen refresh" });

    document.getElementById("btnSchAdd")?.addEventListener("click", (e) => {
      e.preventDefault();
      openForm(null);
    });

    document.getElementById("schForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const from = window.Seav.readDateTriplet("sch_from");
      const to = window.Seav.readDateTriplet("sch_to") || from;
      if (!from) {
        window.Seav.notify("error", "Add the dates", "Pick at least the first day of the stay.");
        return;
      }
      if (to < from) {
        window.Seav.notify("error", "Check the dates", "The last day must be on or after the first.");
        return;
      }
      const id = document.getElementById("sch_edit_id").value || D().createId("stay");
      const stay = {
        id,
        from,
        to,
        inSchengen: document.getElementById("sch_in").value === "in",
        note: document.getElementById("sch_note").value.trim().slice(0, 80)
      };
      const next = [...getStays().filter((s) => s.id !== id), stay];
      window.SeavModals?.closeAllModals?.();
      await saveStays(next, "Stay saved");
    });

    document.getElementById("btnSchPlan")?.addEventListener("click", () => {
      const out = document.getElementById("schPlanResult");
      const from = window.Seav.readDateTriplet("sch_plan_from");
      const to = window.Seav.readDateTriplet("sch_plan_to");
      const check = lastResult && from && to ? D().checkSchengenTrip(lastResult, from, to) : null;
      if (!out) return;
      if (!check) {
        out.className = "sch-plan-result";
        out.textContent = "Pick the day you arrive and the day you leave.";
        return;
      }
      out.className = `sch-plan-result ${check.ok ? "is-ok" : "is-over"}`;
      out.textContent = check.ok
        ? `Fits — ${check.days} days, at most ${check.worst} of 90 used in any 180.`
        : `Too long — you would pass 90 days. Your last legal day on this trip would be ${pretty(check.lastLegalDay)}.`;
    });

    document.addEventListener("click", async (e) => {
      const editBtn = e.target.closest("[data-edit-sch-id]");
      if (editBtn) {
        const stay = getStays().find((s) => s.id === editBtn.getAttribute("data-edit-sch-id"));
        if (stay) openForm(stay);
        return;
      }
      const delBtn = e.target.closest("[data-del-sch-id]");
      if (delBtn) {
        const id = delBtn.getAttribute("data-del-sch-id");
        const confirmed = await window.Seav.confirmDelete({ itemLabel: "stay", itemName: "this stay" });
        if (!confirmed) return;
        await saveStays(getStays().filter((s) => s.id !== id), "Stay deleted");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
