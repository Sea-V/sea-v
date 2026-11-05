// /js/dashboard-snippets.js — the dashboard's cards
(function () {
  "use strict";

  if (!window.Seav || !window.SeavState || !window.SeavData) {
    console.warn("[SEA-V] Dashboard card dependencies missing.");
    return;
  }

  const Seav = window.Seav;
  const { getCertExpiryInfo, getReferenceStatus, getSeatimeTotals, formatDatePretty } = window.SeavData;
  const esc = (value) => Seav.escapeHtml(String(value ?? ""));

  // js/core.js's bindStateRefresh reruns refresh() on EVERY "seav:data-updated"
  // app-wide. Fingerprints let a card skip a rebuild when nothing it reads
  // changed; without this the vessel <img> is recreated and flashes, worst on
  // Safari.
  const renderFingerprints = new Map();

  function skipUnchangedRender(key, fingerprint) {
    if (renderFingerprints.get(key) === fingerprint) return true;
    renderFingerprints.set(key, fingerprint);
    return false;
  }

  function fill(cardId, key, data, html) {
    const card = document.getElementById(cardId);
    if (!card || skipUnchangedRender(key, JSON.stringify(data))) return;
    card.innerHTML = html;
  }

  /**
   * Append a unit only when the stored value does not already carry one.
   * Vessel length is stored bare ("59") by some records and with text by others.
   */
  function withUnit(value, unit) {
    const text = String(value ?? "").trim();
    if (!text) return "";
    return /[a-z]/i.test(text) ? text : `${text} ${unit}`;
  }

  /**
   * "3 yrs 7 mos" / "8 mos" / "3 wks" for a vessel's service span.
   */
  function formatTimeOnboard(from, to) {
    if (!from) return "";
    // Local calendar days -- see parseDateOnly in js/seav-data.js.
    const parseDay = window.SeavData?.parseDateOnly || ((value) => new Date(value));
    const start = parseDay(from);
    // Capped at today: a contract ending next year has not been served yet.
    const planned = to ? parseDay(to) : new Date();
    const end = planned > new Date() ? new Date() : planned;
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

  // Today as the crew member's calendar shows it, for comparing with stored dates.
  function localToday() {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
  }

  function dateRange(from, to, openLabel) {
    return [from ? formatDatePretty(from) : "", to ? formatDatePretty(to) : openLabel || ""]
      .filter(Boolean)
      .join(" to ");
  }

  // ---------------------------------------------------------------
  // Card parts. Every card is a ruled header, then figures and tables, so a
  // title, a label and a number each have their own cell. Callers escape what
  // they pass in.
  // ---------------------------------------------------------------

  // One icon per card, in the same line weight as the menu's (window.SeavIcons).
  const line = (d) => `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="${d}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const CARD_ICONS = {
    "Needs attention": line("M12 4.5 20.5 19h-17L12 4.5ZM12 10v4.2M12 16.6v.1"),
    "Your records": line("M5 6.5h14M5 12h14M5 17.5h14"),
    "Latest from the MCA": line("M6.5 16.5v-5a5.5 5.5 0 0 1 11 0v5l1.5 1.5H5l1.5-1.5ZM10.5 20.5h3"),
    "Crew 101": window.SeavCrew101?.ICONS.book || "",
    "Your next ticket": window.SeavIcons?.achievements || "",
    "Certificates": window.SeavIcons?.certificates || "",
    "Sea time": window.SeavIcons?.seatime || "",
    "Navigation": window.SeavIcons?.navigation || "",
    "Current vessel": window.SeavIcons?.vessels || "",
    "Most recent vessel": window.SeavIcons?.vessels || ""
  };

  function cardTitle(title) {
    return `<span class="dash-panel-heading"><span class="dash-panel-icon" aria-hidden="true">${CARD_ICONS[title] || ""}</span><strong class="dash-panel-title">${esc(title)}</strong></span>`;
  }

  function cardHead(title, moreHref, moreLabel) {
    const more = moreHref
      ? `<a class="dash-panel-more" href="${esc(moreHref)}">${esc(moreLabel)}</a>`
      : "";
    return `<div class="dash-panel-head">${cardTitle(title)}${more}</div>`;
  }

  function emptyCard(title, line, href, linkLabel) {
    return `${cardHead(title)}
      <div class="dash-panel-body">
        <small class="dash-panel-empty">${esc(line)}</small>
        <a class="dash-panel-more" href="${esc(href)}">${esc(linkLabel)}</a>
      </div>`;
  }

  function figures(items) {
    return `<dl class="dash-figures">${items
      .map(
        ({ label, value, tone }) =>
          `<div${tone ? ` class="is-${tone}"` : ""}><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`
      )
      .join("")}</dl>`;
  }

  // columns: [{ label, num }]; rows: [{ cells: [html], tone }] or a raw <tr>.
  function table(columns, rows) {
    const head = columns
      .map((col) => `<th scope="col"${col.num ? ' class="is-num"' : ""}><small>${esc(col.label)}</small></th>`)
      .join("");
    const body = rows
      .map((row) => {
        if (typeof row === "string") return row;
        const cells = row.cells
          .map((cell, i) => `<td${columns[i]?.num ? ' class="is-num"' : ""}>${cell}</td>`)
          .join("");
        return `<tr${row.tone ? ` class="is-${row.tone}"` : ""}>${cells}</tr>`;
      })
      .join("");
    return `<table class="dash-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }

  function cellLink(href, label, external) {
    return `<a href="${esc(href)}"${external ? ' target="_blank" rel="noopener"' : ""}>${esc(label)}</a>`;
  }

  function number(value) {
    return Number(value || 0).toLocaleString("en-GB");
  }

  // ---------------------------------------------------------------
  // Current vessel — the whole photo, with the details over it
  // ---------------------------------------------------------------

  let vesselRenderToken = 0;

  async function renderVesselCard() {
    const renderToken = ++vesselRenderToken;
    const vessels = window.SeavState?.vessels || [];
    const vessel = vessels.length ? window.SeavData.getCurrentVessel(vessels) : null;
    const card = document.getElementById("dashVesselCard");

    if (!vessel) {
      card?.classList.remove("is-photo");
      fill(
        "dashVesselCard",
        "vessel",
        null,
        emptyCard(
          "Current vessel",
          "Add your yacht to start your career record.",
          "dashboard.html?add=vessel",
          "Add a vessel"
        )
      );
      return;
    }

    const bucket = window.SeavApiCore?.STORAGE_BUCKETS?.VESSEL_PHOTOS || "vessel-photos";
    if (window.SeavApiCore?.hydrateItemsFileField) {
      await window.SeavApiCore.hydrateItemsFileField([vessel], "photo", bucket);
      window.SeavState?.syncCache?.();
    }
    // A newer refresh started while the photo link was being signed: it draws instead.
    if (renderToken !== vesselRenderToken) return;

    // A contract with an end date still to come is the yacht they are on now.
    const isCurrent = window.SeavData.isVesselOpenEnded(vessel) || String(vessel.to) > localToday();
    const photoUrl =
      Seav.getFileDisplayUrl?.(vessel.photo, bucket) || vessel.photo?.url || vessel.photo?.dataUrl || "";
    const role = vessel.vessel_role || vessel.role;
    const since = isCurrent ? (vessel.from ? `since ${formatDatePretty(vessel.from)}` : "") : dateRange(vessel.from, vessel.to);

    const facts = [
      { label: "Time onboard", value: formatTimeOnboard(vessel.from, vessel.to) },
      { label: "Length", value: withUnit(vessel.vessel_length || vessel.length, "m") },
      { label: "Gross tonnage", value: vessel.gt },
      { label: "Flag", value: vessel.flag }
    ].filter((fact) => String(fact.value ?? "").trim());
    const numbers = [vessel.imo ? `IMO ${vessel.imo}` : "", vessel.mmsi ? `MMSI ${vessel.mmsi}` : ""]
      .filter(Boolean)
      .join(" · ");

    const before = card?.innerHTML;
    fill(
      "dashVesselCard",
      "vessel",
      vessel,
      `${photoUrl ? `<img class="dash-vessel-photo" src="${esc(photoUrl)}" alt="${esc(vessel.name || "Vessel")}">` : ""}
      <a class="dash-vessel-cover" href="vessels.html" tabindex="-1" aria-hidden="true"></a>
      <div class="dash-vessel-info">
        <div class="dash-vessel-top">
          ${cardTitle(isCurrent ? "Current vessel" : "Most recent vessel")}
          <a class="dash-panel-more" href="vessels.html">Open</a>
        </div>
        <div class="dash-vessel-id">
          <div>
            <strong class="dash-panel-name">${esc(vessel.name || "Unnamed vessel")}</strong>
            <small class="dash-panel-sub">${esc([role, since].filter(Boolean).join(" · "))}</small>
          </div>
          ${numbers ? `<small class="dash-panel-sub dash-vessel-numbers">${esc(numbers)}</small>` : ""}
        </div>
        ${facts.length ? figures(facts) : ""}
      </div>`
    );
    if (!card || card.innerHTML === before) return;

    // The card takes the photo's own shape, so none of the picture is cut off.
    card.classList.toggle("is-photo", !!photoUrl);
    const img = card.querySelector(".dash-vessel-photo");
    if (!img) return;
    const applyShape = () => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      card.style.setProperty("--dash-vessel-ratio", String(img.naturalWidth / img.naturalHeight));
    };
    img.addEventListener("error", () => {
      img.remove();
      card.classList.remove("is-photo");
    });
    if (img.complete) applyShape();
    else img.addEventListener("load", applyShape);
  }

  // ---------------------------------------------------------------
  // Needs attention — only what the crew member can act on, most urgent first.
  // One line per kind of gap, so it never becomes a list people stop reading.
  //
  // Any row can be cleared if it does not apply (Jack, 2026-11-06). A row carries a
  // key and a `mark`. A number returns if it grows: a new entry without a testimonial
  // brings that row back. Anything else returns when it changes: a renewed or newly
  // expired certificate is a new situation, not the one they cleared.
  // ---------------------------------------------------------------

  const ATTENTION_LIMIT = 6;
  // So a long list of certificates can never push every other kind of row out.
  const ATTENTION_CERT_LIMIT = 3;
  const COUNTED_ROWS = ["testimonial-declined", "testimonial-changed", "reference-declined", "profile-missing", "testimonial-unsigned"];

  let attentionCleared = null;
  let attentionShowAll = false;
  let attentionRequest = null;
  let attentionMissing = [];

  function loadAttentionCleared() {
    if (attentionCleared) return Promise.resolve(attentionCleared);
    attentionRequest = attentionRequest || window.SeavAPI.fetchAttentionCleared()
      .then((value) => {
        attentionCleared = value && typeof value === "object" && !Array.isArray(value) ? value : {};
        return attentionCleared;
      })
      .catch((err) => {
        attentionRequest = null;
        console.warn("[SEA-V] Cleared items could not be read:", err);
        return {};
      });
    return attentionRequest;
  }

  function isCleared(row, cleared) {
    if (!(row.key in cleared)) return false;
    return typeof row.mark === "number" ? row.mark <= Number(cleared[row.key]) : row.mark === cleared[row.key];
  }

  function attentionRow(href, label, status, tone, key, mark) {
    return { href, label, status, tone, key, mark };
  }

  function certAttentionRows() {
    const isNoExpiry = window.SeavData?.isCertNoExpiry;
    const certs = (window.SeavState?.certs || []).filter(
      (cert) =>
        (window.SeavData?.isSavedCert?.(cert) ?? !!cert?.name) &&
        !isNoExpiry?.(cert) &&
        String(cert.expiry || "").trim()
    );
    const withBadge = (badge) =>
      certs
        .filter((cert) => String(getCertExpiryInfo(cert.expiry).badge || "").toLowerCase() === badge)
        .sort((a, b) => String(a.expiry).localeCompare(String(b.expiry)));
    const row = (cert, word, tone) =>
      attentionRow(
        `certificates.html?focus=${encodeURIComponent(cert.id || "")}`,
        cert.name || "Certificate",
        `${word} ${formatDatePretty(cert.expiry)}`,
        tone,
        `cert:${cert.id}`,
        `${word}:${cert.expiry}`
      );
    return [
      ...withBadge("expired").map((cert) => row(cert, "Expired", "bad")),
      ...withBadge("expires soon").map((cert) => row(cert, "Expires", "warn"))
    ];
  }

  function allAttentionRows(profileMissing) {
    const state = window.SeavState || {};
    const seatimes = state.seatimes || [];
    const refs = state.refs || [];
    const today = localToday();

    const withTestimonial = (status) => seatimes.filter((entry) => entry.testimonialStatus === status).length;
    const refused = withTestimonial("Declined");
    const changed = withTestimonial("Changed");
    const unsigned = seatimes.filter(
      (entry) => !entry.testimonialStatus && entry.dateLeft && String(entry.dateLeft) <= today
    ).length;
    const declinedRefs = refs.filter((ref) => getReferenceStatus(ref) === "Declined").length;
    const verifiedRefs = refs.filter((ref) => getReferenceStatus(ref) === "Verified").length;
    const missing = (profileMissing || []).length;
    const entries = (n) => `${n} sea time ${n === 1 ? "entry" : "entries"}`;

    return [
      ...certAttentionRows(),
      ...(refused ? [attentionRow("seatime.html", `${entries(refused)} declined by the captain`, "Review", "bad", "testimonial-declined", refused)] : []),
      ...(changed ? [attentionRow("seatime.html", `${entries(changed)} edited since the captain signed`, "Send again", "warn", "testimonial-changed", changed)] : []),
      ...(declinedRefs ? [attentionRow("references.html", `${declinedRefs} ${declinedRefs === 1 ? "reference" : "references"} declined`, "Review", "bad", "reference-declined", declinedRefs)] : []),
      ...(missing ? [attentionRow("profile.html", `${missing} profile ${missing === 1 ? "field" : "fields"} missing`, "Complete", "todo", "profile-missing", missing)] : []),
      ...(unsigned ? [attentionRow("seatime.html", `${entries(unsigned)} without a captain's testimonial`, "Request", "todo", "testimonial-unsigned", unsigned)] : []),
      ...(!verifiedRefs && (state.vessels || []).length ? [attentionRow("references.html", "No verified references yet", "Ask a referee", "todo", "no-references", 1)] : [])
    ];
  }

  async function renderAttentionCard(profileMissing) {
    if (profileMissing) attentionMissing = profileMissing;
    const cleared = await loadAttentionCleared();
    const all = allAttentionRows(attentionMissing);
    lowerClearedCounts(all, cleared);
    const open = all.filter((row) => !isCleared(row, cleared));
    const hidden = all.length - open.length;
    const certs = open.filter((row) => row.key.startsWith("cert:"));
    const others = open.filter((row) => !row.key.startsWith("cert:"));
    const shown = attentionShowAll ? open : [...certs.slice(0, ATTENTION_CERT_LIMIT), ...others].slice(0, ATTENTION_LIMIT);
    const more = open.length - shown.length;

    const rows = shown.map((row) => ({
      tone: row.tone,
      cells: [
        cellLink(row.href, row.label),
        esc(row.status),
        `<button type="button" class="dash-clear" data-attention-clear="${esc(row.key)}" aria-label="${esc(`Clear: ${row.label}`)}"><small>Clear</small></button>`
      ]
    }));
    const foot = [
      more
        ? `<div class="dash-panel-note dash-attention-foot"><small>${more} more</small><button type="button" class="dash-panel-more" data-attention-all><small>Show all</small></button></div>`
        : "",
      hidden
        ? `<div class="dash-panel-note dash-attention-foot"><small>${hidden} cleared</small><button type="button" class="dash-panel-more" data-attention-restore><small>Show again</small></button></div>`
        : ""
    ].join("");

    fill(
      "dashAttentionCard",
      "attention",
      [rows, hidden, more],
      `${cardHead("Needs attention")}
      ${
        rows.length
          ? table([{ label: "Item" }, { label: "Action", num: true }, { label: "", num: true }], rows)
          : `<div class="dash-panel-body"><small class="dash-panel-empty">Nothing needs attention.</small></div>`
      }
      ${foot}`
    );
  }

  // A cleared count follows the real number down. Otherwise clearing 15, getting one
  // signed and adding a new entry reads 15 again, and the new entry stays hidden.
  function lowerClearedCounts(all, cleared) {
    if (cleared !== attentionCleared) return;
    // Zero only counts once the records behind it are here: a failed or late load
    // also reads as zero, and that must not undo what was cleared.
    const state = window.SeavState || {};
    const recordsHere = {
      "testimonial-declined": (state.seatimes || []).length,
      "testimonial-changed": (state.seatimes || []).length,
      "testimonial-unsigned": (state.seatimes || []).length,
      "reference-declined": (state.refs || []).length,
      "profile-missing": 1
    };
    let changed = false;
    const next = { ...cleared };
    COUNTED_ROWS.forEach((key) => {
      if (!(key in next)) return;
      const current = all.find((row) => row.key === key)?.mark || 0;
      if (current >= Number(next[key]) || (!current && !recordsHere[key])) return;
      if (current) next[key] = current;
      else delete next[key];
      changed = true;
    });
    if (!changed) return;
    attentionCleared = next;
    window.SeavAPI.saveAttentionCleared(next).catch((err) => {
      console.warn("[SEA-V] Cleared counts did not update:", err);
    });
  }

  async function saveAttentionCleared(next) {
    const previous = attentionCleared;
    attentionCleared = next;
    renderAttentionCard();
    try {
      await window.SeavAPI.saveAttentionCleared(next);
    } catch (err) {
      console.error("[SEA-V] Cleared items did not save:", err);
      attentionCleared = previous;
      renderAttentionCard();
      window.SeavFeedback?.error?.("That didn't save", "Check your connection and try again.");
    }
  }

  document.addEventListener("click", async (event) => {
    const clear = event.target.closest?.("[data-attention-clear]");
    if (clear) {
      const key = clear.getAttribute("data-attention-clear");
      const cleared = await loadAttentionCleared();
      // Saving after a failed read would overwrite everything cleared before.
      if (!attentionCleared) {
        window.SeavFeedback?.error?.("That didn't save", "Check your connection and try again.");
        return;
      }
      const all = allAttentionRows(attentionMissing);
      const row = all.find((item) => item.key === key);
      if (!row) return;
      // Only what is still on the list is kept, so the record stays small.
      const kept = Object.fromEntries(Object.entries(cleared).filter(([k]) => all.some((item) => item.key === k)));
      saveAttentionCleared({ ...kept, [key]: row.mark });
    } else if (event.target.closest?.("[data-attention-restore]")) {
      saveAttentionCleared({});
    } else if (event.target.closest?.("[data-attention-all]")) {
      attentionShowAll = true;
      renderAttentionCard();
    }
  });

  // ---------------------------------------------------------------
  // Your next ticket — the Milestones page keeps the detail
  // ---------------------------------------------------------------

  const TICKET_LIMIT = 2;

  // One short line on what is holding a ticket back: the requirement furthest
  // from done. The Milestones page keeps the full list.
  function ticketLeft(entry) {
    const needs = (window.SeavAchievementEngine?.getSubRequirements?.(entry.full) || []).filter(
      (need) => Number(need.current) < Number(need.target)
    );
    if (!needs.length) return entry.label || "";
    const need = needs.reduce((worst, row) =>
      Number(row.current) / Number(row.target) < Number(worst.current) / Number(worst.target) ? row : worst
    );
    const label = String(need.label).replace(/\s*\(since holding[^)]*\)/i, "");
    return need.unit ? `Left to do: ${label}, ${number(need.current)} of ${number(need.target)} ${need.unit}` : `Left to do: ${label}`;
  }

  function renderTicketCard() {
    const entries = (window.SeavAchievementEngine?.getInProgressMilestones?.() || []).slice(0, TICKET_LIMIT);

    if (!entries.length) {
      fill(
        "dashTicketCard",
        "ticket",
        [],
        emptyCard(
          "Your next ticket",
          "Log your sea time and certificates to see how close you are.",
          "achievements.html",
          "See your milestones"
        )
      );
      return;
    }

    const rows = entries.map((entry) => {
      const percent = Math.max(0, Math.min(100, Number(entry.percent) || 0));
      return `<a class="dash-ticket" href="achievements.html">
        <span class="dash-ticket-line"><strong class="dash-panel-name">${esc(entry.certGroupKey)}</strong><b>${percent}%</b></span>
        <span class="dash-ticket-bar" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><i style="width:${percent}%"></i></span>
        <small class="dash-panel-sub dash-ticket-left">${esc(ticketLeft(entry))}</small>
      </a>`;
    });

    fill(
      "dashTicketCard",
      "ticket",
      entries.map((entry) => [entry.certGroupKey, entry.percent, ticketLeft(entry)]),
      `${cardHead("Your next ticket", "achievements.html", "All milestones")}
      ${rows.join("")}
      <small class="dash-panel-note">Guidance only: the MCA decides.</small>`
    );
  }

  // ---------------------------------------------------------------
  // Your records — every page's total in one place
  // ---------------------------------------------------------------

  function renderRecordsCard() {
    const state = window.SeavState || {};
    const profile = state.profile || {};
    const earned = window.SeavAchievementEngine?.getEarnedAchievementCodes?.();
    const days = getSeatimeTotals(state.seatimes || []).total;
    const isPublic = !!profile.publicEnabled;
    const records = [
      ["vessels.html", "Vessels", number((state.vessels || []).length)],
      ["seatime.html", "Sea time", days ? `${number(days)} days` : "0"],
      ["certificates.html", "Certificates", number((state.certs || []).filter((cert) => window.SeavData?.isSavedCert?.(cert) ?? !!cert?.name).length)],
      ["navigation.html", "Passages", number((state.navigationAreas || []).length)],
      ["tenders.html", "Tenders", number((state.tenders || []).length)],
      ["onboard-experience.html", "Onboard experience", number((state.onboardExperiences || []).length)],
      ["achievements.html", "Milestones", number(earned ? earned.size : 0)],
      ["references.html", "References", number((state.refs || []).length)],
      ["specialist-qualifications.html", "Specialist quals", number((state.specialistQualifications || []).length)],
      ["land-experience.html", "Land-based", number((state.landExperiences || []).length)],
      ["hobbies-interests.html", "Interests", number((state.hobbiesInterests || []).length)],
      ["payslips.html", "Payslips", number((state.payslips || []).length)],
      ["cv-generator.html", "Your CV", "Open"],
      [(isPublic && Seav.buildPublicProfileUrl?.(profile)) || "#ppShare", "Public profile", isPublic ? "Live" : "Off"]
    ];

    // Two tables side by side, so each page is its own row to press.
    const half = Math.ceil(records.length / 2);
    const recordTable = (part) =>
      table(
        [{ label: "Page" }, { label: "Total", num: true }],
        part.map(([href, label, value]) => ({
          cells: [cellLink(href, label), esc(value)],
          tone: value === "0" ? "empty" : ""
        }))
      );

    fill(
      "dashRecordsCard",
      "records",
      records,
      `${cardHead("Your records")}
      <div class="dash-table-pair">${recordTable(records.slice(0, half))}${recordTable(records.slice(half))}</div>`
    );
  }

  // ---------------------------------------------------------------
  // Latest from the MCA — live from GOV.UK's public search API
  // ---------------------------------------------------------------

  const NOTICES_URL =
    "https://www.gov.uk/api/search.json?filter_organisations=maritime-and-coastguard-agency" +
    "&q=MGN+MSN+MIN&order=-public_timestamp&count=40&fields=title,link,public_timestamp";
  const NOTICES_ALL_URL = "https://www.gov.uk/government/collections/active-marine-guidance-notes-mgns";
  const NOTICES_CACHE_KEY = "seav_mca_notices";
  const NOTICES_MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const NOTICE_LIMIT = 5;
  // Which notices this device has opened, so a new one stands out.
  const NOTICES_SEEN_KEY = "seav_mca_notices_seen";
  // "MGN 199 (M) Amendment 1 Danger of interaction" -> name + subject.
  const NOTICE_TITLE = /^((?:MGN|MSN|MIN)\s*\d+\s*\(([^)]*)\)(?:\s*[-–]?\s*Amendment\s*\d+)?)\s*[:\-–]*\s*(.*)$/i;

  function readNoticesCache() {
    try {
      return JSON.parse(localStorage.getItem(NOTICES_CACHE_KEY) || "null");
    } catch {
      return null;
    }
  }

  // GOV.UK's reply is outside data: only numbered merchant notices on a
  // gov.uk path survive this, and everything is escaped when it is drawn.
  // "(F)" alone is fishing only, so it is no use to yacht crew.
  function parseNotices(results) {
    return (results || [])
      .map((item) => {
        const match = NOTICE_TITLE.exec(String(item?.title || "").trim());
        const link = String(item?.link || "");
        if (!match || !/m/i.test(match[2]) || !/^\/[a-z0-9/_-]+$/i.test(link)) return null;
        return {
          name: match[1].trim(),
          subject: match[3].trim(),
          url: `https://www.gov.uk${link}`,
          date: String(item.public_timestamp || "").slice(0, 10)
        };
      })
      .filter(Boolean)
      .slice(0, NOTICE_LIMIT);
  }

  let noticesRequest = null;

  // Asked once per page load and at most daily per device, because refresh()
  // reruns on every data update. A failed fetch falls back to the last good copy.
  function loadNotices() {
    if (noticesRequest) return noticesRequest;
    const cached = readNoticesCache();
    if (cached?.items?.length && Date.now() - cached.at < NOTICES_MAX_AGE_MS) {
      noticesRequest = Promise.resolve(cached.items.slice(0, NOTICE_LIMIT));
      return noticesRequest;
    }
    noticesRequest = fetch(NOTICES_URL, {
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: window.AbortSignal?.timeout?.(8000)
    })
      .then((res) => {
        if (!res.ok) throw new Error(`GOV.UK search ${res.status}`);
        return res.json();
      })
      .then((body) => {
        const items = parseNotices(body.results);
        if (!items.length) throw new Error("GOV.UK search returned no notices");
        try {
          localStorage.setItem(NOTICES_CACHE_KEY, JSON.stringify({ at: Date.now(), items }));
        } catch {
          // Private window or full storage: it just asks again next load.
        }
        return items;
      })
      .catch((err) => {
        console.warn("[SEA-V] MCA notices unavailable:", err);
        return cached?.items || [];
      });
    return noticesRequest;
  }

  function readSeenNotices() {
    try {
      const seen = JSON.parse(localStorage.getItem(NOTICES_SEEN_KEY) || "[]");
      return Array.isArray(seen) ? seen : [];
    } catch {
      return [];
    }
  }

  function markNoticesSeen(urls) {
    try {
      localStorage.setItem(NOTICES_SEEN_KEY, JSON.stringify([...new Set([...readSeenNotices(), ...urls])].slice(-100)));
    } catch {
      // Private window or full storage: the marker just stays on.
    }
    renderNoticesCard();
    window.SeavLastVisit?.render();
  }

  function wireNoticesCard(card, items) {
    if (card.dataset.wired) return;
    card.dataset.wired = "true";
    card.addEventListener("click", (event) => {
      if (event.target.closest("[data-notices-read]")) {
        markNoticesSeen(noticeItems.map((item) => item.url));
        return;
      }
      const link = event.target.closest(".dash-table a");
      if (link) markNoticesSeen([link.href]);
    });
    noticeItems = items;
  }

  let noticeItems = [];

  async function renderNoticesCard() {
    const items = await loadNotices();
    const allLink = `<a class="dash-panel-more" href="${esc(NOTICES_ALL_URL)}" target="_blank" rel="noopener">All MGNs</a>`;

    if (!items.length) {
      fill(
        "dashNoticesCard",
        "notices",
        [],
        `<div class="dash-panel-head">${cardTitle("Latest from the MCA")}${allLink}</div>
        <div class="dash-panel-body"><small class="dash-panel-empty">The latest notices could not be loaded. They are always on GOV.UK.</small></div>`
      );
      return;
    }

    const seen = new Set(readSeenNotices());
    const anyNew = items.some((item) => !seen.has(item.url));
    const card = document.getElementById("dashNoticesCard");
    if (card) wireNoticesCard(card, items);
    noticeItems = items;

    fill(
      "dashNoticesCard",
      "notices",
      items.map((item) => [item.url, item.name, item.subject, item.date, seen.has(item.url)]),
      `<div class="dash-panel-head">
        ${cardTitle("Latest from the MCA")}
        <span class="dash-panel-actions">
          ${anyNew ? `<button type="button" class="dash-panel-more" data-notices-read><small>Mark all as read</small></button>` : ""}
          ${allLink}
        </span>
      </div>
      ${table(
        [{ label: "Notice" }, { label: "Subject" }, { label: "Date", num: true }],
        items.map((item) => ({
          cells: [
            `${cellLink(item.url, item.name, true)}${seen.has(item.url) ? "" : `<small class="dash-new">New</small>`}`,
            esc(item.subject),
            esc(item.date ? formatDatePretty(item.date) : "")
          ]
        }))
      )}`
    );
  }

  // ---------------------------------------------------------------
  // Crew 101 — the guide's topics
  // ---------------------------------------------------------------

  function renderCrew101Card() {
    const C = window.SeavCrew101;
    if (!C || !document.getElementById("dashCrew101Card")) return;
    fill(
      "dashCrew101Card",
      "crew101",
      ["topics"],
      `${cardHead("Crew 101", "crew-101.html", "Open the guide")}
      ${table(
        [{ label: "Topic" }, { label: "Covers" }],
        C.TOPICS.map((topic) => ({ cells: [cellLink(`crew-101.html#${topic.id}`, topic.title), esc(topic.covers)] }))
      )}`
    );
  }

  window.SeavDashboardSnippets = {
    renderVesselCard,
    renderAttentionCard,
    renderTicketCard,
    renderRecordsCard,
    renderNoticesCard,
    renderCrew101Card,
    loadNotices,
    readSeenNotices
  };
})();
