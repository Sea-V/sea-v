// /js/dashboard-last-visit.js
// "Since your last visit" (v617, Jack 2026-11-06): one line above the dashboard's
// cards, a button per change, gone when there is nothing new. Worked out in the
// browser from records the dashboard already holds. Text is escaped.
(function () {
  "use strict";

  // Per account: two people can use one browser.
  const sessionKey = () => `seav_last_visit:${window.SeavAuth?.getUserId?.() || "unknown"}`;
  // A tab left open this long counts as a new visit next time it refreshes.
  const VISIT_HOURS = 12;
  const EXPIRY_WARNING_DAYS = 90;
  const MS_PER_DAY = 86400000;

  const el = (id) => document.getElementById(id);
  const esc = (value) => window.Seav.escapeHtml(String(value ?? ""));

  const CLOCK = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.8V12l2.8 1.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  function readVisit() {
    try {
      const visit = JSON.parse(sessionStorage.getItem(sessionKey()) || "null");
      return visit && Date.now() - visit.at < VISIT_HOURS * 3600000 ? visit : null;
    } catch {
      return null;
    }
  }

  function writeVisit(visit) {
    try {
      sessionStorage.setItem(sessionKey(), JSON.stringify(visit));
    } catch {
      // Blocked storage: this page load still shows the line.
    }
    return visit;
  }

  let visitRequest = null;
  let visitLoadedAt = 0;

  // Read the previous visit once, then record this one. Keeping the old value for
  // the session means the line survives moving between pages and coming back.
  function loadVisit() {
    // A tab left open past the limit starts a new visit too, not only a reload.
    if (visitRequest && Date.now() - visitLoadedAt < VISIT_HOURS * 3600000) return visitRequest;
    visitLoadedAt = Date.now();
    const saved = readVisit();
    if (saved) {
      visitRequest = Promise.resolve(saved);
      return visitRequest;
    }
    visitRequest = window.SeavAPI.fetchLastVisit()
      .then((since) => {
        const now = new Date();
        window.SeavAPI.saveLastVisit(now.toISOString()).catch((err) => {
          console.warn("[SEA-V] Could not record this visit:", err);
        });
        return writeVisit({ since: since || "", at: now.getTime(), dismissed: false });
      })
      .catch((err) => {
        console.warn("[SEA-V] Could not read the last visit:", err);
        return { since: "", at: Date.now(), dismissed: true };
      });
    return visitRequest;
  }

  function after(iso, since) {
    return !!iso && new Date(iso).getTime() > new Date(since).getTime();
  }

  function counted(n, one, many) {
    return n === 1 ? one : `${n} ${many}`;
  }

  function certChanges(since, today) {
    const { isSavedCert, isCertNoExpiry, parseDateOnly } = window.SeavData;
    const start = new Date(since).getTime();
    // Calendar days, so a clock change between the dates cannot shift the answer.
    const shiftDays = (time, days) => {
      const date = new Date(time);
      date.setDate(date.getDate() + days);
      return date.getTime();
    };
    const certs = (window.SeavState?.certs || []).filter(
      (cert) => isSavedCert(cert) && !isCertNoExpiry?.(cert) && String(cert.expiry || "").trim()
    );
    let expired = 0;
    let soon = 0;
    certs.forEach((cert) => {
      const expiry = parseDateOnly(cert.expiry).getTime();
      if (Number.isNaN(expiry)) return;
      // A certificate is still valid on its expiry day: it expires as the next day starts.
      const expiredFrom = shiftDays(expiry, 1);
      const soonFrom = shiftDays(expiry, -EXPIRY_WARNING_DAYS);
      if (expiredFrom <= today && expiredFrom > start) expired += 1;
      else if (expiry >= today && soonFrom <= today && soonFrom > start) soon += 1;
    });
    return [
      expired ? { label: counted(expired, "Certificate expired", "certificates expired"), href: "certificates.html" } : null,
      soon ? { label: counted(soon, "Certificate expiring soon", "certificates expiring soon"), href: "certificates.html" } : null
    ];
  }

  const yachtRequests = new Map();

  async function yachtChange(since) {
    const vessels = window.SeavState?.vessels || [];
    const vessel = vessels.length ? window.SeavData.getCurrentVessel(vessels) : null;
    if (!vessel?.directory_id) return null;
    if (!yachtRequests.has(vessel.directory_id)) {
      yachtRequests.set(vessel.directory_id, window.SeavAPI.fetchVesselDirectoryHistory(vessel.directory_id).catch(() => []));
    }
    const rows = await yachtRequests.get(vessel.directory_id);
    // Not crew-sourced: that can be the blank their own save just filled in.
    return rows.some((row) => row.field !== "added" && row.source !== "crew" && after(row.created_at, since))
      ? { label: `${vessel.name || "Yacht"} details updated`, href: "vessels.html" }
      : null;
  }

  async function findChanges(since) {
    const state = window.SeavState || {};
    const S = window.SeavDashboardSnippets;
    const sinceDay = new Date(since).toISOString().slice(0, 10);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const seen = new Set(S.readSeenNotices());
    const notices = (await S.loadNotices()).filter((item) => item.date >= sinceDay && !seen.has(item.url)).length;

    const testimonials = (state.seatimes || []).filter((entry) => after(entry.testimonial?.answered_at, since));
    const signed = testimonials.filter((entry) => entry.testimonialStatus === "Confirmed").length;
    const refused = testimonials.filter((entry) => entry.testimonialStatus === "Declined").length;

    const answered = (state.refs || []).filter((ref) => after(ref.verification?.completedAt, since));
    const verified = answered.filter((ref) => window.SeavData.getReferenceStatus(ref) === "Verified").length;
    const declined = answered.filter((ref) => window.SeavData.getReferenceStatus(ref) === "Declined").length;

    // Awarded by SEA-V: a milestone they declared themselves is not news to them.
    const milestones = (state.achievements || []).filter(
      (item) => item.autoAwarded && item.status !== "Declined" && after(item.createdAt, since)
    ).length;

    return [
      notices ? { label: counted(notices, "New MCA notice", "new MCA notices"), href: "#dashNoticesCard" } : null,
      signed ? { label: counted(signed, "Testimonial confirmed", "testimonials confirmed"), href: "seatime.html" } : null,
      refused ? { label: counted(refused, "Testimonial declined", "testimonials declined"), href: "seatime.html" } : null,
      verified ? { label: counted(verified, "Reference verified", "references verified"), href: "references.html" } : null,
      declined ? { label: counted(declined, "Reference declined", "references declined"), href: "references.html" } : null,
      milestones ? { label: counted(milestones, "New milestone", "new milestones"), href: "achievements.html" } : null,
      ...certChanges(since, today.getTime()),
      await yachtChange(since)
    ].filter(Boolean);
  }

  function agoText(since) {
    const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const days = Math.round((startOfDay(new Date()) - startOfDay(new Date(since))) / MS_PER_DAY);
    if (days <= 0) return "Earlier today";
    return days === 1 ? "Yesterday" : `${days} days ago`;
  }

  let lastHtml = null;

  async function render() {
    const strip = el("dashSinceStrip");
    if (!strip) return;
    const visit = await loadVisit();
    const changes = visit.since && !visit.dismissed ? await findChanges(visit.since) : [];

    if (!changes.length) {
      strip.hidden = true;
      lastHtml = "";
      return;
    }

    const html = `
      <span class="dash-panel-heading">
        <span class="dash-panel-icon" aria-hidden="true">${CLOCK}</span>
        <strong class="dash-panel-title">Since your last visit</strong>
        <small class="dash-since-ago">${esc(agoText(visit.since))}</small>
      </span>
      <span class="dash-since-chips">
        ${changes.map((change) => `<a class="dash-since-chip" href="${esc(change.href)}">${esc(change.label)}</a>`).join("")}
      </span>
      <button type="button" class="dash-panel-more" data-since-dismiss><small>Got it</small></button>`;
    if (html !== lastHtml) {
      strip.innerHTML = html;
      lastHtml = html;
    }
    strip.hidden = false;
  }

  document.addEventListener("click", async (event) => {
    if (!event.target.closest?.("[data-since-dismiss]")) return;
    const visit = await loadVisit();
    visit.dismissed = true;
    writeVisit(visit);
    el("dashSinceStrip").hidden = true;
  });

  window.SeavLastVisit = { render };
})();
