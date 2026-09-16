// /js/dashboard-snippets.js — dashboard bento tile renderers
(function () {
  "use strict";

  if (!window.Seav || !window.SeavState || !window.SeavData || !window.SeavCards) {
    console.warn("[SEA-V] Dashboard snippets dependencies missing.");
    return;
  }

  const Seav = window.Seav;
  const {
    getCertExpiryInfo,
    getReferenceStatus,
    getSeatimeTotals,
    totalQualifyingDays,
    formatDatePretty
  } = window.SeavData;

  // v516: the dashboard is one screen of count tiles instead of eleven
  // stacked snippet cards. Each renderer below now writes a number and a
  // single "latest" line into its tile; the owning page keeps the full
  // history. Removed with the card stack: the three-row list builders, the
  // KPI band feeders, the Seafarer Awards grid and the Hobbies & interests
  // card (sidebar-only now — sixteen cells, career evidence first).
  //
  // Export names are unchanged so js/dashboard.js's renderer array keeps
  // working; only renderHobbiesSnippet was dropped and renderPayslipTile /
  // renderMilestoneTile added.

  // js/core.js's bindStateRefresh reruns the dashboard's full refresh() on
  // EVERY "seav:data-updated" event app-wide — not just changes to a given
  // tile's own data (background signed-URL re-hydration, a save on a
  // completely different page in another tab, etc.). renderFingerprints
  // tracks the last-rendered input per tile so a renderer can skip its
  // rebuild when nothing it actually depends on changed. This still matters
  // for the vessel tile, whose <img> would otherwise be torn down and
  // recreated on every unrelated refresh — a visible flash, worst on Safari.
  const renderFingerprints = new Map();

  function skipUnchangedRender(key, fingerprint) {
    if (renderFingerprints.get(key) === fingerprint) return true;
    renderFingerprints.set(key, fingerprint);
    return false;
  }

  /**
   * Write a count tile's number and supporting line.
   *
   * `last` is set with textContent, never innerHTML — every one of these
   * strings is user data (vessel names, referee names, port pairs), so the
   * escaping question is removed rather than answered per call site.
   */
  function setTile(tileId, { count, unit, last, sub, foot, stats }) {
    const tile = document.getElementById(tileId);
    if (!tile) return null;

    const numEl = tile.querySelector(".dash-tile-num");
    if (numEl) {
      // Thousands separator: sea time runs past 1,000 days quickly and
      // "1015 days" reads as a serial number.
      numEl.textContent =
        typeof count === "number" && Number.isFinite(count)
          ? count.toLocaleString("en-GB")
          : String(count);
      if (unit) {
        const unitEl = document.createElement("span");
        unitEl.className = "dash-tile-unit";
        unitEl.textContent = ` ${unit}`;
        numEl.appendChild(unitEl);
      }
    }

    const lastEl = tile.querySelector(".dash-tile-last");
    if (lastEl && typeof last === "string") lastEl.textContent = last;

    // The second detail line is optional: a tile hides it rather than
    // showing an empty row, so tiles with one fact do not look broken
    // next to tiles with two.
    const subEl = tile.querySelector(".dash-tile-sub");
    if (subEl) {
      const text = typeof sub === "string" ? sub : "";
      subEl.textContent = text;
      subEl.hidden = !text;
    }

    const footEl = tile.querySelector(".dash-tile-foot");
    if (footEl) {
      if (Array.isArray(stats)) {
        setStats(footEl, stats);
      } else if (typeof foot === "string") {
        footEl.textContent = foot;
      }
    }

    return tile;
  }

  /**
   * Render the footer's status breakdown.
   *
   * Each entry is { n, label, tone }. Zero-count entries are dropped rather
   * than printed, so a section with nothing to report leaves the row empty
   * and .dash-tile-foot:empty hides it — a new user sees a clean tile, not
   * "0 verified · 0 logged".
   *
   * Tones map to colours the app already uses for these states: ok = green,
   * warn = amber, bad = red, anything else neutral.
   */
  function setStats(footEl, stats) {
    footEl.textContent = "";

    const shown = stats.filter((stat) => stat && stat.n > 0).slice(0, DASH_STAT_LIMIT);
    if (!shown.length) return;

    shown.forEach((stat) => {
      const el = document.createElement("span");
      el.className = "dash-tile-stat" + (stat.tone ? ` dash-tile-stat--${stat.tone}` : "");
      const dot = document.createElement("i");
      el.appendChild(dot);
      el.appendChild(document.createTextNode(`${stat.n} ${stat.label}`));
      footEl.appendChild(el);
    });
  }

  // Two fit a half-width tile on one line; a third wraps and pushes the
  // footer into the body. Buckets are ordered most-urgent-first by each
  // renderer, so the two that survive are the two worth seeing.
  const DASH_STAT_LIMIT = 2;

  function countBy(list, fn) {
    const out = new Map();
    list.forEach((item) => {
      const key = fn(item);
      if (!key) return;
      out.set(key, (out.get(key) || 0) + 1);
    });
    return out;
  }

  /**
   * Append a unit only when the stored value does not already carry one.
   *
   * Vessel length is stored bare ("59") but tender length is stored with its
   * unit ("28 ft"), so a blanket append produced "59" on one tile and
   * "28 ft m" on the other. Both were visible in production.
   */
  function withUnit(value, unit) {
    const text = String(value ?? "").trim();
    if (!text) return "";
    return /[a-z]/i.test(text) ? text : `${text} ${unit}`;
  }

  function vesselNameFor(vesselId) {
    if (!vesselId) return "Unassigned";
    return (
      (window.SeavState?.vessels || []).find((v) => v.id === vesselId)?.name ||
      "Unnamed vessel"
    );
  }

  /**
   * "3 yrs 7 mos" / "8 mos" / "3 wks" for a vessel's service span.
   *
   * Written here rather than imported because the codebase has no shared
   * duration formatter — checked before adding this one. If a second caller
   * ever needs it, it should move to js/seav-data.js rather than be copied.
   */
  function formatTimeOnboard(from, to) {
    if (!from) return "";
    const start = new Date(from);
    const end = to ? new Date(to) : new Date();
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
    if (end < start) return "";

    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth()) -
      (end.getDate() < start.getDate() ? 1 : 0);

    if (months < 1) {
      const weeks = Math.max(1, Math.round((end - start) / (7 * 24 * 60 * 60 * 1000)));
      return `${weeks} ${weeks === 1 ? "wk" : "wks"}`;
    }

    const years = Math.floor(months / 12);
    const rem = months % 12;
    const parts = [];
    if (years) parts.push(`${years} ${years === 1 ? "yr" : "yrs"}`);
    if (rem) parts.push(`${rem} ${rem === 1 ? "mo" : "mos"}`);
    return parts.join(" ");
  }

  // ---------------------------------------------------------------
  // Sea time
  // ---------------------------------------------------------------

  async function renderSeatimeSnippet() {
    const seatimes = window.SeavState?.seatimes || [];
    const totals = getSeatimeTotals(seatimes);

    if (!seatimes.length) {
      setTile("dashSeatimeTile", { count: 0, unit: "days", last: "No sea service yet." });
      return;
    }

    const latest = [...seatimes].sort((a, b) => {
      const da = a.dateJoined ? new Date(a.dateJoined) : new Date(0);
      const db = b.dateJoined ? new Date(b.dateJoined) : new Date(0);
      return db - da;
    })[0];

    const range = [
      latest.dateJoined ? formatDatePretty(latest.dateJoined) : "",
      latest.dateLeft ? formatDatePretty(latest.dateLeft) : "Present"
    ]
      .filter(Boolean)
      .join(" → ");

    const qualifying = totalQualifyingDays ? totalQualifyingDays(latest) : null;
    const byStatus = countBy(seatimes, (e) => e.verificationStatus || "Logged");

    setTile("dashSeatimeTile", {
      count: totals.total,
      unit: "days",
      last: [vesselNameFor(latest.vesselId), range].filter(Boolean).join(" · "),
      // A just-opened or future-dated entry has no day breakdown yet, and
      // "0 qualifying days" on the newest record reads as a fault rather
      // than as an empty field. Show it only when there is something to show.
      sub: qualifying ? `${qualifying} qualifying days` : "",
      // Real statuses from getSeatimeVerificationDisplay: Verified,
      // Pending Verification, Logged.
      stats: [
        { n: byStatus.get("Verified") || 0, label: "verified", tone: "ok" },
        { n: byStatus.get("Pending Verification") || 0, label: "pending", tone: "warn" },
        { n: byStatus.get("Logged") || 0, label: "logged" }
      ]
      // Footer ("Total logged days") is static in the markup — it names what
      // the number counts, which "Sea time" alone does not say.
    });
  }

  // ---------------------------------------------------------------
  // Certificates
  // ---------------------------------------------------------------

  async function renderCertSnippet() {
    const certs = (window.SeavState?.certs || []).filter(
      (cert) => window.SeavData?.isSavedCert?.(cert) ?? !!cert?.name
    );

    if (!certs.length) {
      setTile("dashCertTile", { count: 0, last: "No certificates yet." });
      return;
    }

    const isNoExpiry = window.SeavData?.isCertNoExpiry;
    const expiryCerts = certs.filter((cert) => {
      if (isNoExpiry?.(cert)) return false;
      return !!String(cert.expiry || "").trim();
    });

    if (!expiryCerts.length) {
      setTile("dashCertTile", {
        count: certs.length,
        last: "No expiry dates recorded",
        sub: "Add them on the certificates page to track renewals"
      });
      return;
    }

    // Most urgent first, using the same badge vocabulary the certificates
    // page shows ("expired" / "expires soon") rather than a second wording
    // invented for the dashboard.
    const score = (cert) => {
      const badge = String(getCertExpiryInfo(cert.expiry).badge || "").toLowerCase();
      if (badge === "expired") return 0;
      if (badge === "expires soon") return 1;
      return 2;
    };

    const mostUrgent = [...expiryCerts].sort((a, b) => {
      const byScore = score(a) - score(b);
      if (byScore !== 0) return byScore;
      const da = a.expiry ? new Date(a.expiry) : new Date("9999-12-31");
      const db = b.expiry ? new Date(b.expiry) : new Date("9999-12-31");
      return da - db;
    })[0];

    const info = getCertExpiryInfo(mostUrgent.expiry);
    const name = mostUrgent.name || "Certificate";
    const badge = String(info.badge || "").trim();

    // getCertExpiryInfo returns Title Case badges ("Expires Soon"), which
    // read as part of the certificate's name mid-sentence: "ENG1 Medical
    // Certificate Expires Soon". Use the verb form instead.
    const verb = badge.toLowerCase() === "expired" ? "expired" : "expires";

    // Badges from getCertExpiryInfo: "Expired", "Expires Soon", "No Expiry",
    // anything else is current. Ordered most urgent first so the two that
    // survive DASH_STAT_LIMIT are the two that matter.
    const buckets = countBy(certs, (cert) => {
      if (isNoExpiry?.(cert)) return "none";
      if (!String(cert.expiry || "").trim()) return "none";
      const badge = String(getCertExpiryInfo(cert.expiry).badge || "").toLowerCase();
      if (badge === "expired") return "expired";
      if (badge === "expires soon") return "soon";
      return "valid";
    });

    setTile("dashCertTile", {
      count: certs.length,
      last: name,
      sub: `${verb === "expired" ? "Expired" : "Expires"} ${formatDatePretty(mostUrgent.expiry)}`,
      stats: [
        { n: buckets.get("expired") || 0, label: "expired", tone: "bad" },
        { n: buckets.get("soon") || 0, label: "expiring", tone: "warn" },
        { n: buckets.get("valid") || 0, label: "valid", tone: "ok" },
        { n: buckets.get("none") || 0, label: "no expiry" }
      ]
    });
  }

  // ---------------------------------------------------------------
  // Vessels — the 2x2 photo tile, plus the count tile
  // ---------------------------------------------------------------

  async function renderVesselSnippet() {
    const tile = document.getElementById("dashVesselTile");
    const vessels = window.SeavState?.vessels || [];

    setTile("dashVesselCountTile", {
      count: vessels.length,
      last: vessels.length ? "" : "No vessels yet."
    });

    if (!tile) return;

    if (!vessels.length) {
      tile.className = "dash-vessel dash-vessel-empty";
      tile.innerHTML = `
        <div class="dash-vessel-body">
          <span class="dash-vessel-eyebrow">Current vessel</span>
          <h3>No vessels yet</h3>
          <p>Add your first vessel to anchor your career record.</p>
        </div>
      `;
      return;
    }

    // Shared with the Public Profile's default-open dropdown and the Vessels
    // page — see getCurrentVessel() in js/seav-data.js. Written out separately
    // in each place before 2026-08-21, which is how three pages drift apart.
    const vessel = window.SeavData.getCurrentVessel(vessels);
    if (!vessel) return;

    const latestJoined = [...vessels].sort((a, b) => {
      const da = a.from ? new Date(a.from) : new Date(0);
      const db = b.from ? new Date(b.from) : new Date(0);
      return db - da;
    })[0];

    if (latestJoined) {
      const joined = latestJoined.from ? formatDatePretty(latestJoined.from) : "";
      const current = vessels.filter((v) => window.SeavData.isVesselOpenEnded(v)).length;

      setTile("dashVesselCountTile", {
        count: vessels.length,
        last: latestJoined.name || "Unnamed vessel",
        sub: joined ? `Joined ${joined}` : "",
        stats: [
          { n: current, label: "current", tone: "ok" },
          { n: vessels.length - current, label: "previous" }
        ]
      });
    }

    const vesselPhotoBucket =
      window.SeavApiCore?.STORAGE_BUCKETS?.VESSEL_PHOTOS || "vessel-photos";
    if (window.SeavApiCore?.hydrateItemsFileField) {
      await window.SeavApiCore.hydrateItemsFileField([vessel], "photo", vesselPhotoBucket);
      window.SeavState?.syncCache?.();
    }

    // Fingerprint taken after hydration so an already-cached signed URL
    // (unchanged) still compares equal and skips the rebuild — this is what
    // stops the vessel photo from flashing on every unrelated data refresh.
    if (skipUnchangedRender("vessel", JSON.stringify(vessel))) return;

    const isCurrent = window.SeavData.isVesselOpenEnded(vessel);
    const photoUrl =
      Seav.getFileDisplayUrl?.(vessel.photo, vesselPhotoBucket) ||
      vessel.photo?.url ||
      vessel.photo?.dataUrl ||
      "";

    const onboard = formatTimeOnboard(vessel.from, vessel.to);
    const meta = [
      vessel.vessel_role || vessel.role,
      withUnit(vessel.vessel_length || vessel.length, "m"),
      vessel.gt ? `${vessel.gt} GT` : "",
      vessel.flag,
      onboard ? `${onboard} aboard` : ""
    ]
      .filter(Boolean)
      .map((part) => Seav.escapeHtml(String(part)))
      .join(" · ");

    const contractType = window.SeavData?.getVesselContractType?.(vessel) || "";
    const seatimeCount = (window.SeavState?.seatimes || []).filter(
      (entry) => entry.vesselId === vessel.id
    ).length;

    const chips = [
      isCurrent ? `<span class="pill pill-current">Current</span>` : "",
      contractType ? `<span class="pill">${Seav.escapeHtml(contractType)}</span>` : "",
      seatimeCount
        ? `<span class="pill">${seatimeCount} sea time ${seatimeCount === 1 ? "entry" : "entries"}</span>`
        : ""
    ]
      .filter(Boolean)
      .join("");

    // No photo on file keeps the full 2x2 footprint: the ocean background
    // shows through a dashed edge instead of a grey box. The tile is the
    // composition's anchor — a text fallback in that slot reads as broken.
    tile.className = photoUrl ? "dash-vessel" : "dash-vessel dash-vessel-empty";

    const photoHtml = photoUrl
      ? `
        <img src="${Seav.escapeHtml(photoUrl)}" alt="${Seav.escapeHtml(vessel.name || "Vessel")}"
          onerror="this.remove();" />
        <div class="dash-vessel-scrim-bottom"></div>
      `
      : `<span class="dash-vessel-addphoto">Add a photo</span>`;

    tile.innerHTML = `
      ${photoHtml}
      <div class="dash-vessel-body">
        <span class="dash-vessel-eyebrow">${isCurrent ? "Current vessel" : "Most recent vessel"}</span>
        <h3>${Seav.escapeHtml(vessel.name || "Unnamed Vessel")}</h3>
        <p>${meta}</p>
        ${chips ? `<div class="dash-vessel-chips">${chips}</div>` : ""}
      </div>
    `;
  }

  // ---------------------------------------------------------------
  // Tenders
  // ---------------------------------------------------------------

  async function renderTenderSnippet() {
    const tenders = window.SeavState?.tenders || [];

    if (!tenders.length) {
      setTile("dashTenderTile", { count: 0, last: "No tenders yet." });
      return;
    }

    // Tenders carry no date of their own, so "latest" means most recently
    // added. createdAt is the only ordering the record actually has —
    // .reverse() on the state array was assuming an order nothing guarantees.
    const latest = [...tenders].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const db = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return db - da;
    })[0];

    // The record's fields are name / type / model / length — there is no
    // "make". Reading one produced undefined and pushed the model into the
    // headline, which is why an Axopar showed as "Cabin 28".
    // TENDER_PROFICIENCY_LEVELS: Familiarisation, Competent, Advanced,
    // Coxswain (displayed as "Proficient"). Anything at Coxswain or Advanced
    // counts as signed off; the rest is still working up.
    const byLevel = countBy(tenders, (t) => t.proficiencyLevel || "");
    const signedOff =
      (byLevel.get("Coxswain") || 0) + (byLevel.get("Advanced") || 0);
    const working =
      (byLevel.get("Competent") || 0) + (byLevel.get("Familiarisation") || 0);

    setTile("dashTenderTile", {
      count: tenders.length,
      last: latest.name || latest.model || "Tender",
      sub: [latest.model, withUnit(latest.length, "m")].filter(Boolean).join(" · "),
      stats: [
        { n: signedOff, label: "advanced", tone: "ok" },
        { n: working, label: "in training" }
      ]
    });
  }

  // ---------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------

  function passageSortDate(entry) {
    return entry.departureDate || entry.visitedDate || entry.arrivalDate || "";
  }

  function renderNavigationSnippet() {
    const entries = window.SeavState?.navigationAreas || [];

    if (!entries.length) {
      setTile("dashNavigationTile", { count: 0, unit: "passages", last: "No passages logged yet." });
      return;
    }

    const H = window.SeavNavigationHelpers;

    // normalizeNavEntry resolves a port named in free text back to its record,
    // which is what makes formatRouteLabel produce "Palma, Spain → Gibraltar"
    // rather than a bare country. Skipping it is the same bug already fixed
    // once on the Navigation page, where legacy entries lost their country
    // names.
    const latest = (H?.normalizeNavEntry ? entries.map(H.normalizeNavEntry) : entries)
      .slice()
      .sort((a, b) =>
        String(passageSortDate(b)).localeCompare(String(passageSortDate(a)))
      )[0];

    const route = H?.formatRouteLabel ? H.formatRouteLabel(latest) : "";
    const title = latest.passageName || route || "Passage";

    const when = passageSortDate(latest);

    const countries = new Set();
    const ports = new Set();
    entries.forEach((e) => {
      [e.toCountry || e.country, e.fromCountry].forEach((c) => c && countries.add(c));
      [e.toPort || e.port, e.fromPort].forEach((pt) => pt && ports.add(pt));
    });

    setTile("dashNavigationTile", {
      count: entries.length,
      last: title,
      sub: when ? formatDatePretty(when) : "",
      // Neutral, not a status: these are coverage figures, and colouring them
      // green would imply a pass/fail that does not exist.
      stats: [
        { n: countries.size, label: countries.size === 1 ? "country" : "countries" },
        { n: ports.size, label: ports.size === 1 ? "port" : "ports" }
      ]
    });
  }

  // ---------------------------------------------------------------
  // References
  // ---------------------------------------------------------------

  async function renderReferenceSnippet() {
    const refs = window.SeavState?.refs || [];

    if (!refs.length) {
      setTile("dashRefTile", { count: 0, last: "No references yet." });
      return;
    }

    const latest = [...refs].sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(0);
      const db = b.date ? new Date(b.date) : new Date(0);
      return db - da;
    })[0];

    const status = getReferenceStatus(latest);
    const statusLabel = window.SeavData.getReferenceStatusDisplay?.(status)?.label || "";

    // getReferenceStatus returns Verified / Declined / Sent for Verification
    // / Draft.
    const byRefStatus = countBy(refs, (ref) => getReferenceStatus(ref));

    setTile("dashRefTile", {
      count: refs.length,
      last: [latest.name || "—", latest.title || ""].filter(Boolean).join(", "),
      sub: statusLabel,
      stats: [
        { n: byRefStatus.get("Declined") || 0, label: "declined", tone: "bad" },
        { n: byRefStatus.get("Sent for Verification") || 0, label: "awaiting", tone: "warn" },
        { n: byRefStatus.get("Verified") || 0, label: "verified", tone: "ok" },
        { n: byRefStatus.get("Draft") || 0, label: "draft" }
      ]
    });
  }

  // ---------------------------------------------------------------
  // Specialist qualifications
  // ---------------------------------------------------------------

  async function renderSpecialistSnippet() {
    const entries = window.SeavState?.specialistQualifications || [];

    if (!entries.length) {
      setTile("dashSpecialistTile", {
        count: 0,
        last: "No specialist qualifications logged yet."
      });
      return;
    }

    const latest = [...entries].sort((a, b) => {
      const da = a.dateObtained ? new Date(a.dateObtained) : new Date(0);
      const db = b.dateObtained ? new Date(b.dateObtained) : new Date(0);
      return db - da;
    })[0];

    const sqCats = new Set(entries.map((e) => e.category).filter(Boolean));

    setTile("dashSpecialistTile", {
      count: entries.length,
      last: latest.name || latest.title || "Qualification",
      sub: latest.dateObtained ? formatDatePretty(latest.dateObtained) : "",
      stats: [{ n: sqCats.size, label: sqCats.size === 1 ? "category" : "categories" }]
    });
  }

  // ---------------------------------------------------------------
  // Onboard experience
  // ---------------------------------------------------------------

  async function renderOnboardSnippet() {
    const entries = window.SeavState?.onboardExperiences || [];

    if (!entries.length) {
      setTile("dashOnboardTile", {
        count: 0,
        last: "No onboard experience logged yet."
      });
      return;
    }

    const latest = [...entries].sort((a, b) => {
      const da = a.dateFrom ? new Date(a.dateFrom) : new Date(0);
      const db = b.dateFrom ? new Date(b.dateFrom) : new Date(0);
      return db - da;
    })[0];

    const cats = new Set(entries.map((e) => e.category).filter(Boolean));

    setTile("dashOnboardTile", {
      count: entries.length,
      last: latest.title || latest.name || "Experience",
      sub: latest.dateFrom ? formatDatePretty(latest.dateFrom) : "",
      stats: [{ n: cats.size, label: cats.size === 1 ? "category" : "categories" }]
    });
  }

  // ---------------------------------------------------------------
  // Payslips — no card on the old dashboard; new tile in v516
  // ---------------------------------------------------------------

  async function renderPayslipTile() {
    const payslips = window.SeavState?.payslips || [];

    if (!payslips.length) {
      setTile("dashPayslipTile", { count: 0, last: "No payslips yet." });
      return;
    }

    // The payslip record's date field is paymentDate — periodEnd and date do
    // not exist on it, so the old sort key was undefined on every row
    // (new Date(undefined) is NaN, which sorts nothing) and the date line
    // always fell through to a placeholder.
    const latest = [...payslips].sort((a, b) => {
      const da = a.paymentDate ? new Date(a.paymentDate) : new Date(0);
      const db = b.paymentDate ? new Date(b.paymentDate) : new Date(0);
      return db - da;
    })[0];

    const period = [latest.payPeriod, latest.taxYear].filter(Boolean).join(" · ");

    const withDoc = payslips.filter((ps) => !!ps.attachment).length;

    setTile("dashPayslipTile", {
      count: payslips.length,
      last: period || (latest.employer || "Latest payslip"),
      sub: latest.paymentDate ? `Paid ${formatDatePretty(latest.paymentDate)}` : "",
      stats: [
        { n: withDoc, label: "with document", tone: "ok" },
        { n: payslips.length - withDoc, label: "without", tone: "warn" }
      ]
    });
  }

  // ---------------------------------------------------------------
  // Milestones — progress toward the next certificates
  // ---------------------------------------------------------------

  const DASH_MILESTONE_LIMIT = 3;

  function renderMilestoneTile() {
    const rows = document.getElementById("dashMilestoneRows");
    const countEl = document.getElementById("dashMilestoneCount");
    if (!rows) return;

    const all = window.SeavAchievementEngine?.getInProgressMilestones?.() || [];
    const inProgress = all.slice(0, DASH_MILESTONE_LIMIT);

    // Counts how many are in progress, not how many are "earned".
    //
    // The earned/total fraction this used to show was wrong in production —
    // it read "38 / 26 earned". The numerator counted achievement RECORDS
    // (Seafarer Awards log one row per instance, so a crossing sailed three
    // times is three rows) while the denominator counted DEFINITIONS, and
    // progression milestones are computed by the engine rather than stored
    // as rows at all. The two numbers were never measuring the same thing,
    // so the fraction could and did exceed 1.
    //
    // There is no public API for a true earned count — getEarnedAchievementCodes
    // is private to js/achievements-engine.js. Rather than reconstruct it here
    // and risk a second wrong number, this reports what the tile actually
    // shows. If the fraction is wanted back, export that function first.
    if (countEl) {
      countEl.textContent = all.length
        ? `${all.length} in progress`
        : "";
    }

    if (!inProgress.length) {
      rows.innerHTML = `<div class="dash-tile-last">Nothing in progress right now.</div>`;
      return;
    }

    if (skipUnchangedRender("milestones", JSON.stringify(inProgress.map((e) => [e.certGroupKey, e.percent])))) {
      return;
    }

    // .ach-progress-bar is achievements.css's own component, so this tile and
    // the Milestones page it links to cannot render the same progress two
    // different ways. Only three rows fit a tile's 130px content box, and a
    // per-row caption does not — the detail stays on that page.
    rows.innerHTML = inProgress
      .map(
        (entry) => `
        <div class="dash-tile-milestone-row">
          <span class="dash-tile-milestone-name">${Seav.escapeHtml(entry.certGroupKey || "")}</span>
          <span class="dash-tile-milestone-percent">${Number(entry.percent) || 0}%</span>
          <span class="ach-progress-bar" role="progressbar"
            aria-valuenow="${Number(entry.percent) || 0}" aria-valuemin="0" aria-valuemax="100">
            <span style="width: ${Number(entry.percent) || 0}%"></span>
          </span>
        </div>
      `
      )
      .join("");
  }

  window.SeavDashboardSnippets = {
    renderVesselSnippet,
    renderSeatimeSnippet,
    renderNavigationSnippet,
    renderTenderSnippet,
    renderOnboardSnippet,
    renderSpecialistSnippet,
    renderCertSnippet,
    renderReferenceSnippet,
    renderPayslipTile,
    renderMilestoneTile
  };
})();
