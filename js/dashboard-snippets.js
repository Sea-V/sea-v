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

  function cardHead(title, moreHref, moreLabel) {
    const more = moreHref
      ? `<a class="dash-panel-more" href="${esc(moreHref)}">${esc(moreLabel)}</a>`
      : "";
    return `<div class="dash-panel-head"><strong class="dash-panel-title">${esc(title)}</strong>${more}</div>`;
  }

  function emptyCard(title, line, href, linkLabel) {
    return `${cardHead(title)}
      <small class="dash-panel-empty">${esc(line)}</small>
      <div class="dash-panel-foot"><a class="dash-panel-more" href="${esc(href)}">${esc(linkLabel)}</a></div>`;
  }

  function plural(n, one, many) {
    return `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;
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
    const end = to ? parseDay(to) : new Date();
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

  function dateRange(from, to, openLabel) {
    return [from ? formatDatePretty(from) : "", to ? formatDatePretty(to) : openLabel || ""]
      .filter(Boolean)
      .join(" to ");
  }

  // ---------------------------------------------------------------
  // Current vessel
  // ---------------------------------------------------------------

  async function renderVesselCard() {
    const vessels = window.SeavState?.vessels || [];
    const vessel = vessels.length ? window.SeavData.getCurrentVessel(vessels) : null;

    if (!vessel) {
      fill(
        "dashVesselCard",
        "vessel",
        null,
        `<div class="dash-panel-body">${emptyCard(
          "Current vessel",
          "Add your yacht to start your career record.",
          "dashboard.html?add=vessel",
          "Add a vessel"
        )}</div>`
      );
      return;
    }

    const bucket = window.SeavApiCore?.STORAGE_BUCKETS?.VESSEL_PHOTOS || "vessel-photos";
    if (window.SeavApiCore?.hydrateItemsFileField) {
      await window.SeavApiCore.hydrateItemsFileField([vessel], "photo", bucket);
      window.SeavState?.syncCache?.();
    }

    const isCurrent = window.SeavData.isVesselOpenEnded(vessel);
    const photoUrl =
      Seav.getFileDisplayUrl?.(vessel.photo, bucket) || vessel.photo?.url || vessel.photo?.dataUrl || "";
    const role = vessel.vessel_role || vessel.role;
    const since = isCurrent ? (vessel.from ? `since ${formatDatePretty(vessel.from)}` : "") : dateRange(vessel.from, vessel.to);

    const facts = [
      ["Time onboard", formatTimeOnboard(vessel.from, vessel.to)],
      ["Length", withUnit(vessel.vessel_length || vessel.length, "m")],
      ["Gross tonnage", vessel.gt],
      ["Flag", vessel.flag],
      ["IMO", vessel.imo],
      ["MMSI", vessel.mmsi]
    ].filter(([, value]) => String(value ?? "").trim());

    fill(
      "dashVesselCard",
      "vessel",
      vessel,
      `${photoUrl ? `<img class="dash-panel-photo" src="${esc(photoUrl)}" alt="${esc(vessel.name || "Vessel")}">` : ""}
      <div class="dash-panel-body">
        ${cardHead(isCurrent ? "Current vessel" : "Most recent vessel", "vessels.html", "Open")}
        <strong class="dash-panel-name">${esc(vessel.name || "Unnamed vessel")}</strong>
        <small class="dash-panel-sub">${esc([role, since].filter(Boolean).join(" · "))}</small>
        <dl class="dash-panel-facts">
          ${facts.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}
        </dl>
      </div>`
    );
  }

  // ---------------------------------------------------------------
  // Your next ticket
  // ---------------------------------------------------------------

  const TICKET_LIMIT = 2;

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
      return `<div class="dash-ticket">
        <strong class="dash-panel-name">${esc(entry.certGroupKey)}</strong>
        <span class="dash-ticket-bar" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><i style="width:${percent}%"></i></span>
        <small class="dash-panel-sub">${percent}%${entry.label ? ` · ${esc(entry.label)}` : ""}</small>
      </div>`;
    });

    fill(
      "dashTicketCard",
      "ticket",
      entries.map((entry) => [entry.certGroupKey, entry.percent, entry.label]),
      `${cardHead("Your next ticket", "achievements.html", "All milestones")}
      ${rows.join("")}
      <div class="dash-panel-foot"><small class="dash-panel-sub">Worked out from what you have logged. Guidance only: the MCA decides.</small></div>`
    );
  }

  // ---------------------------------------------------------------
  // Certificates
  // ---------------------------------------------------------------

  const CERT_ROW_LIMIT = 3;

  function renderCertCard() {
    const certs = (window.SeavState?.certs || []).filter(
      (cert) => window.SeavData?.isSavedCert?.(cert) ?? !!cert?.name
    );

    if (!certs.length) {
      fill(
        "dashCertCard",
        "certs",
        [],
        emptyCard(
          "Certificates",
          "Add your certificates and we will show what expires next.",
          "dashboard.html?add=certificate",
          "Add a certificate"
        )
      );
      return;
    }

    const isNoExpiry = window.SeavData?.isCertNoExpiry;
    const stateOf = (cert) => {
      const badge = String(getCertExpiryInfo(cert.expiry).badge || "").toLowerCase();
      if (badge === "expired") return "bad";
      if (badge === "expires soon") return "warn";
      return "";
    };

    const dated = certs
      .filter((cert) => !isNoExpiry?.(cert) && String(cert.expiry || "").trim())
      .sort((a, b) => String(a.expiry).localeCompare(String(b.expiry)));
    const expired = dated.filter((cert) => stateOf(cert) === "bad").length;
    const soon = dated.filter((cert) => stateOf(cert) === "warn").length;

    let headline = `<strong class="dash-panel-big">All in date</strong>`;
    if (expired) headline = `<strong class="dash-panel-big is-bad">${esc(plural(expired, "expired", "expired"))}</strong>`;
    else if (soon) headline = `<strong class="dash-panel-big is-warn">${soon} expiring soon</strong>`;
    if (!dated.length) headline = `<strong class="dash-panel-big">No expiry dates</strong>`;

    const rows = dated.slice(0, CERT_ROW_LIMIT).map((cert) => {
      const state = stateOf(cert);
      return `<li${state ? ` class="is-${state}"` : ""}><a href="certificates.html?focus=${encodeURIComponent(cert.id || "")}">
        <span class="dash-row-label">${esc(cert.name || "Certificate")}</span><b>${esc(formatDatePretty(cert.expiry))}</b></a></li>`;
    });

    fill(
      "dashCertCard",
      "certs",
      dated.map((cert) => [cert.id, cert.name, cert.expiry]).concat(certs.length),
      `${cardHead("Certificates", "certificates.html", `All ${certs.length}`)}
      ${headline}
      ${rows.length ? `<small class="dash-panel-sub dash-cert-caption">Next to expire</small><ul class="dash-rows dash-panel-foot">${rows.join("")}</ul>` : ""}`
    );
  }

  // ---------------------------------------------------------------
  // Sea time
  // ---------------------------------------------------------------

  function renderSeatimeCard() {
    const seatimes = window.SeavState?.seatimes || [];

    if (!seatimes.length) {
      fill(
        "dashSeatimeCard",
        "seatime",
        [],
        emptyCard(
          "Sea time",
          "Log your time on a yacht to count towards your next ticket.",
          "dashboard.html?add=seatime",
          "Log sea time"
        )
      );
      return;
    }

    const totals = getSeatimeTotals(seatimes);
    const latest = [...seatimes].sort((a, b) =>
      String(b.dateJoined || "").localeCompare(String(a.dateJoined || ""))
    )[0];
    const pending = seatimes.filter((entry) => entry.verificationStatus === "Pending Verification").length;
    const range = dateRange(latest.dateJoined, latest.dateLeft, "present");

    fill(
      "dashSeatimeCard",
      "seatime",
      [totals, range, pending, seatimes.length],
      `${cardHead("Sea time", "seatime.html", plural(seatimes.length, "entry", "entries"))}
      <strong class="dash-panel-big">${Number(totals.total).toLocaleString("en-GB")} <small>logged days</small></strong>
      <div class="dash-daytypes">
        <div><small>At sea</small><strong>${Number(totals.sea).toLocaleString("en-GB")}</strong></div>
        <div><small>Standby</small><strong>${Number(totals.standby).toLocaleString("en-GB")}</strong></div>
        <div><small>Yard</small><strong>${Number(totals.yard).toLocaleString("en-GB")}</strong></div>
        <div><small>On watch</small><strong>${Number(totals.watchkeeping).toLocaleString("en-GB")}</strong></div>
      </div>
      <ul class="dash-rows dash-panel-foot">
        ${range ? `<li><span class="dash-row-label">Latest entry</span><b>${esc(range)}</b></li>` : ""}
        ${pending ? `<li class="is-todo"><a href="seatime.html"><span class="dash-row-label">Awaiting verification</span><b>${pending}</b></a></li>` : ""}
      </ul>`
    );
  }

  // ---------------------------------------------------------------
  // Ready for your next job
  // ---------------------------------------------------------------

  function readyRow(href, label, value, todo) {
    return `<li${todo ? ' class="is-todo"' : ""}><a href="${esc(href)}"><span class="dash-row-label">${esc(label)}</span><b>${esc(value)}</b></a></li>`;
  }

  function renderReadyCard() {
    const profile = window.SeavState?.profile || {};
    const refs = window.SeavState?.refs || [];
    const seatimes = window.SeavState?.seatimes || [];

    const verified = refs.filter((ref) => getReferenceStatus(ref) === "Verified").length;
    const signed = seatimes.filter((entry) => entry.testimonialStatus === "Confirmed").length;
    const isPublic = !!profile.publicEnabled;
    const publicUrl = isPublic ? Seav.buildPublicProfileUrl?.(profile) : "";

    fill(
      "dashReadyCard",
      "ready",
      [verified, signed, isPublic, publicUrl],
      `${cardHead("Ready for your next job")}
      <ul class="dash-rows">
        ${readyRow("cv-generator.html", "Your CV", "Open", false)}
        ${readyRow(publicUrl || "profile.html", "Public profile", isPublic ? "Live" : "Turn on", !isPublic)}
        ${readyRow("references.html", "Verified references", verified ? String(verified) : "Ask a referee", !verified)}
        ${readyRow("seatime.html", "Captain's testimonials", signed ? `${signed} signed` : "Request", !signed)}
      </ul>`
    );
  }

  // ---------------------------------------------------------------
  // Your other records — pages without a card of their own
  // ---------------------------------------------------------------

  function renderRecordsCard() {
    const state = window.SeavState || {};
    const earned = window.SeavAchievementEngine?.getEarnedAchievementCodes?.();
    const rows = [
      ["vessels.html", "Vessels", (state.vessels || []).length],
      ["tenders.html", "Tenders", (state.tenders || []).length],
      ["onboard-experience.html", "Onboard experience", (state.onboardExperiences || []).length],
      ["achievements.html", "Milestones", earned ? earned.size : 0],
      ["hobbies-interests.html", "Interests", (state.hobbiesInterests || []).length],
      ["specialist-qualifications.html", "Specialist quals", (state.specialistQualifications || []).length],
      ["references.html", "References", (state.refs || []).length],
      ["land-experience.html", "Land-based", (state.landExperiences || []).length],
      ["payslips.html", "Payslips", (state.payslips || []).length]
    ];

    fill(
      "dashRecordsCard",
      "records",
      rows,
      `${cardHead("Your other records")}
      <ul class="dash-rows dash-rows--split">
        ${rows
          .map(
            ([href, label, count]) =>
              `<li${count ? "" : ' class="is-empty"'}><a href="${esc(href)}"><span class="dash-row-label">${esc(label)}</span><b>${count}</b></a></li>`
          )
          .join("")}
      </ul>`
    );
  }

  // ---------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------

  function passageSortDate(entry) {
    return entry.departureDate || entry.visitedDate || entry.arrivalDate || "";
  }

  async function renderNavigationCard() {
    const entries = window.SeavState?.navigationAreas || [];

    if (!entries.length) {
      fill(
        "dashNavigationCard",
        "navigation",
        [],
        emptyCard("Navigation", "Log a passage to build your track record.", "navigation.html", "Log a passage")
      );
      return;
    }

    const H = window.SeavNavigationHelpers;

    // normalizeNavEntry resolves a port named in free text back to its record,
    // which is what makes formatRouteLabel produce "Palma, Spain → Gibraltar"
    // rather than a bare country.
    const normalized = H?.normalizeNavEntry ? entries.map(H.normalizeNavEntry) : entries;
    const latest = [...normalized].sort((a, b) =>
      String(passageSortDate(b)).localeCompare(String(passageSortDate(a)))
    )[0];

    const countries = new Set();
    entries.forEach((entry) => {
      [entry.toCountry || entry.country, entry.fromCountry].forEach((c) => c && countries.add(c));
    });

    let nm = 0;
    try {
      nm = (await window.SeavNavigationPassage?.getEntriesDistance?.(normalized))?.nm || 0;
    } catch (err) {
      console.warn("[SEA-V] Dashboard passage distance failed:", err);
    }

    const route = H?.formatRouteLabel ? H.formatRouteLabel(latest) : "";
    const when = dateRange(latest.departureDate || latest.visitedDate, latest.arrivalDate);
    const countryLine = plural(countries.size, "country", "countries");
    const headline = nm
      ? `${Math.round(nm).toLocaleString("en-GB")} <small>NM across ${esc(countryLine)}</small>`
      : `${entries.length.toLocaleString("en-GB")} <small>${entries.length === 1 ? "passage" : "passages"} across ${esc(countryLine)}</small>`;

    fill(
      "dashNavigationCard",
      "navigation",
      [latest.id, latest.passageName, route, when, Math.round(nm), countries.size, entries.length],
      `${cardHead("Navigation", "navigation.html", `All ${plural(entries.length, "passage", "passages")}`)}
      <strong class="dash-panel-big">${headline}</strong>
      <div class="dash-panel-foot">
        <small class="dash-panel-sub">Last passage</small>
        <strong class="dash-panel-name">${esc(latest.passageName || route || "Passage")}</strong>
        <small class="dash-panel-sub">${esc(when)}</small>
      </div>`
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
  const NOTICE_LIMIT = 3;
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
      noticesRequest = Promise.resolve(cached.items);
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

  async function renderNoticesCard() {
    const head = cardHead("Latest from the MCA", NOTICES_ALL_URL, "All MGNs");
    const items = await loadNotices();

    if (!items.length) {
      fill(
        "dashNoticesCard",
        "notices",
        [],
        `${head}<small class="dash-panel-empty">The latest notices could not be loaded. They are always on GOV.UK.</small>`
      );
      return;
    }

    fill(
      "dashNoticesCard",
      "notices",
      items,
      `${head}
      <ul class="dash-links">
        ${items
          .map((item) => {
            const sub = [item.subject, item.date ? formatDatePretty(item.date) : ""].filter(Boolean).join(" · ");
            return linkRow(item.url, item.name, sub);
          })
          .join("")}
      </ul>`
    );
  }

  // ---------------------------------------------------------------
  // Regulations and guidance — all links checked 2026-11-05
  // ---------------------------------------------------------------

  const REGULATIONS = [
    ["https://www.ilo.org/international-labour-standards/maritime-labour-convention-2006", "MLC 2006", "Your rights at work, ILO"],
    ["https://www.gov.uk/government/publications/msn-1781-mf-amendment-3-the-merchant-shipping-regulations-1996-colreg", "COLREGs", "MSN 1781, Amendment 3"],
    ["https://www.gov.uk/government/publications/msn-1858-mf-amendment-2-uk-requirements-for-deck-officers-on-large-yachts-24m-and-over", "MSN 1858", "Deck officers on large yachts"],
    ["https://www.gov.uk/government/publications/red-ensign-group-yacht-code", "REG Yacht Code", "Red Ensign Group"],
    ["https://www.gov.uk/government/collections/active-marine-guidance-notes-mgns", "MGNs", "Marine Guidance Notes, MCA"],
    ["https://www.gov.uk/government/collections/merchant-shipping-notices-msns", "MSNs", "Merchant Shipping Notices, MCA"],
    ["https://www.gov.uk/government/collections/marine-information-notes-mins", "MINs", "Marine Information Notes, MCA"]
  ];

  // Lower-case flag as crew type it. A flag not listed simply adds no row.
  const FLAG_REGISTRIES = {
    "cayman islands": ["https://www.cishipping.com/", "Cayman Islands Shipping Registry"],
    "isle of man": ["https://www.iomshipregistry.com/", "Isle of Man Ship Registry"],
    "marshall islands": ["https://www.register-iri.com/", "Marshall Islands Registry"],
    bermuda: ["https://www.bermudashipping.bm/", "Bermuda Shipping and Maritime"],
    "united kingdom": ["https://www.gov.uk/government/organisations/maritime-and-coastguard-agency", "UK Maritime and Coastguard Agency"]
  };

  function linkRow(url, name, sub) {
    return `<li><a href="${esc(url)}" target="_blank" rel="noopener">
      <strong class="dash-link-name">${esc(name)}</strong>
      <small class="dash-panel-sub">${esc(sub)}</small></a></li>`;
  }

  function renderRegulationsCard() {
    const vessels = window.SeavState?.vessels || [];
    const flag = vessels.length ? window.SeavData.getCurrentVessel(vessels)?.flag : "";
    const registry = FLAG_REGISTRIES[String(flag || "").trim().toLowerCase()];
    const rows = registry ? [...REGULATIONS, [registry[0], registry[1], "Your yacht's flag"]] : REGULATIONS;

    fill(
      "dashRegulationsCard",
      "regulations",
      rows.length + String(registry?.[0]),
      `${cardHead("Regulations and guidance")}
      <ul class="dash-links dash-links--split">
        ${rows.map(([url, name, sub]) => linkRow(url, name, sub)).join("")}
      </ul>`
    );
  }

  window.SeavDashboardSnippets = {
    renderVesselCard,
    renderTicketCard,
    renderCertCard,
    renderSeatimeCard,
    renderReadyCard,
    renderRecordsCard,
    renderNavigationCard,
    renderNoticesCard,
    renderRegulationsCard
  };
})();
