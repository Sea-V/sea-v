// /js/seav-search.js
// Record search for the topbar search panel (v558, Jack 2026-09-30: "lets
// build the search function as all it does now is search the current pages").
//
// Two jobs:
//   1. SeavSearch.find(query) — searches the signed-in crew member's OWN
//      records, already loaded client-side in window.SeavState (every app
//      page loads its own keys first and the rest in the background via
//      state.js queueDeferredPageLoads). No extra Supabase queries, nothing
//      leaves the browser. The panel UI stays in js/core.js wireTopbarSearch.
//   2. Arrival focus — a result opens "<page>?focus=<id>". On that page this
//      module waits for the record to render, finds it by the id its edit
//      button already carries (data-edit-*-id), opens any <details> it sits
//      in, scrolls to it and rings it briefly, then drops ?focus from the URL
//      so a refresh does not repeat it.
//
// Recent: the last few opened results, kept in localStorage as a per-viewer
// convenience only (wrapped in try/catch; the panel works without it). Each is
// re-resolved against the live index before showing, so a deleted record
// quietly disappears instead of linking to nothing.
(function () {
  "use strict";

  const RECENT_KEY = "seav_search_recent";
  const RECENT_MAX = 5;
  const PER_GROUP = 5;
  const FOCUS_TIMEOUT_MS = 8000;
  const HIT_MS = 2600;

  // One entry per record type: where it lives, how it looks, what it says.
  // `accent` is a --page-* token (the sidebar colour of that page); `icon` a
  // key of window.SeavIcons from core.js.
  const SOURCES = [
    { key: "vessels", group: "Vessels", page: "vessels.html", icon: "vessels", accent: "--page-vessels" },
    { key: "seatimes", group: "Sea time", page: "seatime.html", icon: "seatime", accent: "--page-seatime" },
    { key: "certs", group: "Certificates", page: "certificates.html", icon: "certificates", accent: "--page-certificates" },
    { key: "navigationAreas", group: "Passages", page: "navigation.html", icon: "navigation", accent: "--page-navigation" },
    { key: "tenders", group: "Tenders", page: "tenders.html", icon: "tenders", accent: "--page-tenders" },
    { key: "refs", group: "References", page: "references.html", icon: "references", accent: "--page-references" },
    { key: "onboardExperiences", group: "Onboard experience", page: "onboard-experience.html", icon: "onboard", accent: "--page-onboard-experience" },
    { key: "achievements", group: "Milestones", page: "achievements.html", icon: "achievements", accent: "--page-achievements" },
    { key: "specialistQualifications", group: "Specialist qualifications", page: "specialist-qualifications.html", icon: "specialist", accent: "--page-specialist-qualifications" },
    { key: "hobbiesInterests", group: "Hobbies & interests", page: "hobbies-interests.html", icon: "hobbies", accent: "--page-hobbies-interests" },
    { key: "landExperiences", group: "Land-based experience", page: "land-experience.html", icon: "landExperience", accent: "--page-land-experience" },
    { key: "payslips", group: "Payslips", page: "payslips.html", icon: "payslips", accent: "--page-payslips" }
  ];

  // Attributes the pages already put on each record's edit button / card.
  const FOCUS_ATTRS = [
    "data-edit-vessel-id",
    "data-vessel-id",
    "data-edit-seatime-id",
    // v588: sea time edit buttons sit in the row's Actions menu (a
    // <template>), so the row carries the id itself.
    "data-seatime-id",
    "data-edit-cert-id",
    "data-cert-id",
    "data-edit-nav-id",
    "data-edit-tender-id",
    "data-edit-ref-id",
    "data-ref-id",
    "data-edit-oe-id",
    "data-edit-achievement-id",
    "data-edit-sq-id",
    "data-edit-land-id",
    "data-edit-hi-id",
    "data-edit-ps-id",
    "data-ps-id"
  ];

  const text = (value) => String(value == null ? "" : value).trim();

  const fold = (value) =>
    text(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");

  const prettyDate = (value) => {
    if (!value) return "";
    return window.SeavData?.formatDatePretty?.(value) || text(value);
  };

  const dateRange = (from, to) => {
    const start = prettyDate(from);
    if (!start) return "";
    return `${start} → ${to ? prettyDate(to) : "Present"}`;
  };

  const join = (...parts) => parts.map(text).filter(Boolean).join(" · ");

  // The pages' own label helpers (js/seav-data.js), so a result reads exactly
  // like its card: "Crane operations", not the stored code "crane".
  const label = (helper, value) => {
    const fn = window.SeavData?.[helper];
    return typeof fn === "function" ? fn(value) || text(value) : text(value);
  };

  const payslipTitle = (item) => {
    const D = window.SeavData;
    const month =
      D?.getPayslipMonthLabel && D?.normalizePayslipMonth
        ? D.getPayslipMonthLabel(D.normalizePayslipMonth(item), item.taxYear)
        : "";
    return month && month !== "—" ? `Payslip · ${month}` : "Payslip";
  };

  // record -> { title, sub, words[] } per source. `words` feeds matching
  // only; `title`/`sub` are what the row shows.
  function describe(sourceKey, item, vesselName) {
    switch (sourceKey) {
      case "vessels":
        return {
          title: item.name,
          sub: join(item.vessel_role, dateRange(item.from, item.to)),
          words: [item.vessel_role, item.vessel_type, item.builder, item.flag, item.program, item.imo]
        };
      case "seatimes":
        return {
          title: vesselName(item.vesselId) || "Sea service",
          sub: join(
            item.capacityServed,
            dateRange(item.dateJoined, item.dateLeft),
            item.actualSeaServiceDays ? `${item.actualSeaServiceDays} sea days` : ""
          ),
          words: [item.capacityServed, item.locationJoined, item.locationLeft, item.flag]
        };
      case "certs":
        return {
          title: item.name,
          sub: item.noExpiry || !item.expiry ? "No expiry" : `Expires ${prettyDate(item.expiry)}`,
          words: [item.code, item.issuingAuthority, item.trainingProvider, item.certificateNumber]
        };
      case "navigationAreas": {
        const from = item.fromPort || item.fromCountry;
        const to = item.toPort || item.port || item.country;
        return {
          title: item.passageName || join(from && to ? `${from} → ${to}` : from || to) || "Passage",
          sub: join(vesselName(item.vesselId), prettyDate(item.departureDate || item.visitedDate)),
          words: [item.fromPort, item.fromCountry, item.toPort, item.port, item.country, item.operationType]
        };
      }
      case "tenders":
        return {
          title: item.name || item.model || "Tender",
          sub: join(item.model !== item.name ? item.model : "", item.type, vesselName(item.vesselId)),
          words: [item.model, item.type, item.engine, item.reg]
        };
      case "refs":
        return {
          title: item.name || "Reference",
          sub: join(item.title, vesselName(item.vesselId), item.status),
          words: [item.title, item.role]
        };
      case "onboardExperiences":
        return {
          title: item.title,
          sub: join(label("getOnboardCategoryLabel", item.category), vesselName(item.vesselId)),
          words: [label("getOnboardCategoryLabel", item.category), item.locationOnboard, item.positionHeld, item.description]
        };
      case "achievements":
        return {
          title: item.title,
          sub: join(item.category, item.vessel || vesselName(item.vesselId)),
          words: [item.category, item.vessel, item.description]
        };
      case "specialistQualifications":
        return {
          title: item.title,
          sub: join(item.issuingBody, label("getSpecialistCategoryLabel", item.category)),
          words: [item.issuingBody, label("getSpecialistCategoryLabel", item.category), item.notes]
        };
      case "hobbiesInterests":
        return {
          title: item.title,
          sub: label("getHobbyInterestCategoryLabel", item.category),
          words: [
            label("getHobbyInterestCategoryLabel", item.category),
            item.description,
            ...(item.highlights || []).map((h) => h.title)
          ]
        };
      case "landExperiences":
        return {
          title: join(item.role, item.employer),
          sub: join(item.location, item.isCurrent ? "Current" : ""),
          words: [item.role, item.employer, item.location, item.description]
        };
      case "payslips":
        return {
          title: payslipTitle(item),
          sub: join(item.employer, vesselName(item.vesselId), item.taxYear ? `Tax year ${item.taxYear}` : ""),
          words: [item.employer, item.taxYear, item.currency, prettyDate(item.paymentDate)]
        };
      default:
        return null;
    }
  }

  function buildIndex() {
    const state = window.SeavState;
    if (!state) return [];
    const vessels = Array.isArray(state.vessels) ? state.vessels : [];
    const byId = new Map(vessels.map((v) => [v.id, v.name]));
    const vesselName = (id) => (id ? byId.get(id) || "" : "");
    const icons = window.SeavIcons || {};
    const index = [];

    SOURCES.forEach((source, sourceRank) => {
      const list = Array.isArray(state[source.key]) ? state[source.key] : [];
      const seenTitles = new Set();
      list.forEach((item) => {
        if (!item || !item.id) return;
        const d = describe(source.key, item, vesselName);
        if (!d || !text(d.title)) return;
        // Milestones can hold the same badge several times (one per vessel);
        // show it once.
        if (source.key === "achievements") {
          const titleKey = fold(d.title);
          if (seenTitles.has(titleKey)) return;
          seenTitles.add(titleKey);
        }
        index.push({
          id: `${source.key}:${item.id}`,
          group: source.group,
          sourceRank,
          title: text(d.title),
          sub: text(d.sub),
          href: `${source.page}?focus=${encodeURIComponent(item.id)}`,
          iconHtml: icons[source.icon] || "",
          accent: `var(${source.accent})`,
          foldTitle: fold(d.title),
          foldAll: fold([d.title, d.sub, ...(d.words || [])].join(" "))
        });
      });
    });

    return index;
  }

  // Every word of the query must appear somewhere in the record. Ranked:
  // title starts with the query > a title word starts with it > title
  // contains it > found elsewhere (details, place, issuer...).
  function score(entry, query, words) {
    if (!words.every((w) => entry.foldAll.includes(w))) return 0;
    if (entry.foldTitle.startsWith(query)) return 4;
    if (entry.foldTitle.split(/[\s\-–→·/()]+/).some((part) => part.startsWith(words[0]))) return 3;
    if (entry.foldTitle.includes(query)) return 2;
    return 1;
  }

  function find(rawQuery) {
    const query = fold(rawQuery);
    if (!query) return [];
    const words = query.split(/\s+/).filter(Boolean);
    const hits = [];
    buildIndex().forEach((entry) => {
      const s = score(entry, query, words);
      if (s) hits.push({ entry, s });
    });
    hits.sort((a, b) => b.s - a.s || a.entry.sourceRank - b.entry.sourceRank || a.entry.title.localeCompare(b.entry.title));

    // Keep groups in a stable order (best group first), capped per group.
    const groups = new Map();
    hits.forEach(({ entry }) => {
      if (!groups.has(entry.group)) groups.set(entry.group, []);
      const bucket = groups.get(entry.group);
      if (bucket.length < PER_GROUP) bucket.push(entry);
    });
    return [...groups].map(([group, items]) => ({ group, items }));
  }

  function readRecent() {
    try {
      const raw = window.localStorage.getItem(RECENT_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  // Recent ids re-resolved against the live index (deleted records drop out).
  function recent() {
    const ids = readRecent();
    if (!ids.length) return [];
    const byId = new Map(buildIndex().map((entry) => [entry.id, entry]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }

  function remember(entryId) {
    if (!entryId) return;
    try {
      const next = [entryId, ...readRecent().filter((id) => id !== entryId)].slice(0, RECENT_MAX);
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // Private window / blocked storage: Recent simply stays empty.
    }
  }

  /* ---------- arrival focus ---------- */

  function findRecordElement(id) {
    const selector = FOCUS_ATTRS.map((attr) => `[${attr}]`).join(",");
    return [...document.querySelectorAll(selector)].find((el) =>
      FOCUS_ATTRS.some((attr) => el.getAttribute(attr) === id)
    );
  }

  const cardFor = (anchor) =>
    anchor.closest("tr, article, .list-row, li, .ui-card, details") || anchor.parentElement || anchor;

  const isHidden = (el) => el.getClientRects().length === 0;

  // Open every native <details> around the record. Returns true if the card
  // is still hidden afterwards (a JS-driven collapse, e.g. payslip years).
  function openDetails(card) {
    let parent = card.tagName === "DETAILS" ? card : card.closest("details");
    while (parent) {
      parent.open = true;
      parent = parent.parentElement ? parent.parentElement.closest("details") : null;
    }
    return isHidden(card);
  }

  // A JS-driven section (payslip tax years today) is opened by a button with
  // aria-expanded="false" as a direct child of the section. Click the nearest
  // one; the page may re-render, so the caller looks the record up again.
  function clickCollapsedToggle(card) {
    for (let node = card.parentElement; node && node !== document.body; node = node.parentElement) {
      const toggle = node.querySelector(':scope > button[aria-expanded="false"]');
      if (toggle) {
        toggle.click();
        return true;
      }
    }
    return false;
  }

  function revealAndRing(card) {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    card.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    card.classList.add("seav-search-hit");
    window.setTimeout(() => card.classList.remove("seav-search-hit"), HIT_MS);
  }

  function clearFocusParam() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("focus");
      window.history.replaceState(window.history.state, "", url.toString());
    } catch {
      // Leaving the param is harmless.
    }
  }

  function focusFromUrl() {
    let id = "";
    try {
      id = new URLSearchParams(window.location.search).get("focus") || "";
    } catch {
      return;
    }
    if (!id) return;

    const started = Date.now();
    let toggles = 0;
    const attempt = () => {
      const el = findRecordElement(id);
      if (el) {
        const card = cardFor(el);
        if (openDetails(card) && toggles < 3 && clickCollapsedToggle(card)) {
          toggles += 1;
          window.setTimeout(attempt, 150);
          return;
        }
        clearFocusParam();
        // One frame so any list that is still settling has its final layout.
        window.requestAnimationFrame(() => revealAndRing(card));
        return;
      }
      if (Date.now() - started > FOCUS_TIMEOUT_MS) {
        clearFocusParam();
        return;
      }
      window.setTimeout(attempt, 200);
    };
    attempt();
  }

  // focusFromUrl is exposed for testing the arrival step in place.
  window.SeavSearch = { find, recent, remember, focusFromUrl };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", focusFromUrl);
  } else {
    focusFromUrl();
  }
})();
