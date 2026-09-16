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
  function setTile(tileId, { count, unit, last }) {
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

    return tile;
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

    setTile("dashSeatimeTile", {
      count: totals.total,
      unit: "days",
      // "Total logged days" is seatime.html's own KPI label, sentence case.
      last: `Total logged days · latest ${vesselNameFor(latest.vesselId)}${range ? `, ${range}` : ""}`
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
        last: "No certificates with expiry dates yet. Add expiry dates on the certificates page to track renewals here."
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

    setTile("dashCertTile", {
      count: certs.length,
      last: badge
        ? `${name} ${badge} — ${formatDatePretty(mostUrgent.expiry)}`
        : `Next renewal — ${name}, ${formatDatePretty(mostUrgent.expiry)}`
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
      setTile("dashVesselCountTile", {
        count: vessels.length,
        last: `Latest — ${latestJoined.name || "Unnamed vessel"}${joined ? `, joined ${joined}` : ""}`
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
      vessel.vessel_length || vessel.length,
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
        <div class="dash-vessel-scrim"></div>
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

    const latest = [...tenders].reverse()[0];
    const detail = [latest.make, latest.model, latest.length ? `${latest.length} m` : ""]
      .filter(Boolean)
      .join(" ");

    setTile("dashTenderTile", {
      count: tenders.length,
      last: `Latest — ${detail || latest.name || "Tender"}`
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

    setTile("dashNavigationTile", {
      count: entries.length,
      unit: entries.length === 1 ? "passage" : "passages",
      last: `Latest — ${title}`
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

    setTile("dashRefTile", {
      count: refs.length,
      last: [latest.name || "—", latest.title || "", statusLabel]
        .filter(Boolean)
        .join(" · ")
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

    setTile("dashSpecialistTile", {
      count: entries.length,
      last: `Latest — ${latest.name || latest.title || "Qualification"}`
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

    setTile("dashOnboardTile", {
      count: entries.length,
      last: `Latest — ${latest.title || latest.name || "Experience"}`
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

    const latest = [...payslips].sort((a, b) => {
      const da = a.periodEnd || a.date ? new Date(a.periodEnd || a.date) : new Date(0);
      const db = b.periodEnd || b.date ? new Date(b.periodEnd || b.date) : new Date(0);
      return db - da;
    })[0];

    const when = latest.periodEnd || latest.date;

    setTile("dashPayslipTile", {
      count: payslips.length,
      last: when ? `Latest — ${formatDatePretty(when)}` : "Latest payslip logged"
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

    const achievements = window.SeavState?.achievements || [];
    const earned = new Set(
      achievements
        .filter((item) => item && item.status !== "Declined" && item.code)
        .map((item) => item.code)
    ).size;
    const total = window.SeavBadges?.listAchievements?.().length || 0;

    if (countEl) {
      countEl.textContent = total ? `${earned} / ${total} earned` : `${earned} earned`;
    }

    const inProgress = (
      window.SeavAchievementEngine?.getInProgressMilestones?.() || []
    ).slice(0, DASH_MILESTONE_LIMIT);

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
