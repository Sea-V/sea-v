// /js/public-profile-modern.js
// The optional "Modern" public profile layout (v595, Jack 2026-11-05: Current
// stays exactly as it is and stays the default; Modern is the crew member's
// choice, profile.public_layout, picked in Profile settings).
//
// Modern = bento tiles on top, career timeline below. It re-arranges the page's
// existing sections rather than rendering its own copies, so every record still
// comes from the same renderers and nothing can differ between the layouts
// except where it sits. On Current nothing in this file touches the DOM, and
// every rule in css/pages/public-profile-modern.css is gated on
// <html data-pp-layout="modern">.
(function () {
  "use strict";

  const LAYOUTS = ["current", "modern"];

  // ?layout=modern lets anyone compare the layouts on a real profile before
  // choosing. It changes only what that visitor sees, never what is saved.
  function resolveLayout(saved) {
    const asked = new URLSearchParams(location.search).get("layout");
    if (LAYOUTS.includes(asked)) return asked;
    return LAYOUTS.includes(saved) ? saved : "current";
  }

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // Moves the sections into place BEFORE they render: the Leaflet map measures
  // its container when it paints, and must paint in the tile it will stay in.
  function arrangeSections() {
    if (document.getElementById("ppmBento")) return;
    const top = document.querySelector("#ppContent .dash-top");
    const stack = document.querySelector("#ppContent .public-profile-stack");
    if (!top || !stack) return;

    const bento = make("div", "ppm-bento");
    bento.id = "ppmBento";
    const me = make("article", "ppm-tile ppm-me");
    me.id = "ppmMe";
    const yacht = make("article", "ppm-tile ppm-yacht");
    yacht.id = "ppmYacht";
    yacht.hidden = true;
    const pair = make("div", "ppm-pair");
    bento.append(me, yacht);
    const kpi = document.getElementById("ppKpiCard");
    if (kpi) bento.appendChild(kpi);
    ["ppNavigationSection", "ppCertSection"].forEach((id) => {
      const section = document.getElementById(id);
      if (section) pair.appendChild(section);
    });
    bento.appendChild(pair);
    top.parentNode.insertBefore(bento, top);

    // Milestones directly under the career; the rest keep their order.
    const vessels = document.getElementById("ppVesselSection");
    const milestones = document.getElementById("ppAchievementSection");
    if (vessels && milestones) vessels.after(milestones);
  }

  function setup(savedLayout) {
    if (resolveLayout(savedLayout) !== "modern") return false;
    document.documentElement.setAttribute("data-pp-layout", "modern");
    arrangeSections();
    return true;
  }

  function isModern() {
    return document.documentElement.getAttribute("data-pp-layout") === "modern";
  }

  function renderMe(profile, displayName, tagline) {
    const tile = document.getElementById("ppmMe");
    if (!tile) return;
    tile.textContent = "";

    const head = make("div", "ppm-me-head");
    const photoUrl =
      window.Seav?.getFileDisplayUrl?.(
        profile.photo,
        window.SeavApiCore?.STORAGE_BUCKETS?.PROFILE_PHOTOS || "profile-photos"
      ) ||
      profile.photo?.url ||
      "";
    if (photoUrl) {
      const photo = make("img", "ppm-me-photo");
      photo.src = photoUrl;
      photo.alt = `${displayName} profile photo`;
      head.appendChild(photo);
    }
    const title = make("div", "ppm-me-title");
    if (profile.rank) title.appendChild(make("strong", "ppm-me-rank", profile.rank));
    title.appendChild(make("h1", "ppm-me-name", displayName));
    if (tagline) title.appendChild(make("small", "ppm-me-tagline", tagline));
    head.appendChild(title);
    tile.appendChild(head);

    // Everything Current's profile card shows, so switching layout loses nothing.
    const facts = make("dl", "ppm-facts");
    [
      ["Current qualification", profile.qualification],
      ["Availability", profile.availability],
      ["Location", profile.location],
      ["Nationality", profile.nationality],
      ["Age", typeof profile.age === "number" ? String(profile.age) : ""],
      ["Passports held", profile.passportsHeld],
      ["Visas held", profile.visasHeld]
    ].forEach(([label, value]) => {
      if (!value) return;
      const row = make("div", "ppm-fact");
      row.append(make("dt", "", label), make("dd", "", value));
      facts.appendChild(row);
    });
    if (facts.children.length) tile.appendChild(facts);

    if (profile.bio) tile.appendChild(make("p", "ppm-me-bio", profile.bio));
  }

  function renderYacht(vessels) {
    const tile = document.getElementById("ppmYacht");
    const bento = document.getElementById("ppmBento");
    if (!tile || !bento) return;
    tile.textContent = "";
    tile.classList.remove("ppm-yacht--photo");

    const vessel = window.SeavData?.getCurrentVessel?.(vessels);
    tile.hidden = !vessel;
    bento.classList.toggle("ppm-bento--no-yacht", !vessel);
    if (!vessel) return;

    const isCurrent = window.SeavData?.isVesselOpenEnded?.(vessel);
    const photoUrl = window.Seav?.getFileDisplayUrl?.(
      vessel.photo,
      window.SeavApiCore?.STORAGE_BUCKETS?.VESSEL_PHOTOS || "vessel-photos"
    );
    if (photoUrl) {
      const photo = make("img", "ppm-yacht-photo");
      photo.src = photoUrl;
      photo.alt = `${vessel.name || "Vessel"} photo`;
      photo.addEventListener("error", () => {
        photo.remove();
        tile.classList.remove("ppm-yacht--photo");
      });
      tile.appendChild(photo);
      tile.classList.add("ppm-yacht--photo");
    }
    const caption = make("div", "ppm-yacht-caption");
    caption.append(
      make("strong", "ppm-yacht-label", isCurrent ? "Current yacht" : "Latest yacht"),
      make("strong", "ppm-yacht-name", vessel.name || "Unnamed Vessel")
    );
    // Length and GT are free text: "59" and "59m" both occur, so a unit is
    // only added to a bare number.
    const withUnit = (value, unit) => {
      const text = String(value || "").trim();
      return /^[\d.,]+$/.test(text) ? `${text} ${unit}` : text;
    };
    const meta = [
      String(vessel.vessel_role || vessel.role || "").trim(),
      withUnit(vessel.vessel_length || vessel.length, "m"),
      withUnit(vessel.gt, "GT"),
      String(vessel.flag || "").trim()
    ]
      .filter(Boolean)
      .join(" · ");
    if (meta) caption.appendChild(make("small", "ppm-yacht-meta", meta));
    tile.appendChild(caption);
  }

  function yearOf(dateText) {
    const match = String(dateText || "").match(/^\d{4}/);
    return match ? match[0] : "";
  }

  // The first year each role was held, oldest first. Roles are free text, so
  // they are matched ignoring case, and it only shows when there is a
  // progression to show.
  function renderRoleStrip(vessels) {
    const section = document.getElementById("ppVesselSection");
    const snippet = document.getElementById("ppVesselSnippet");
    if (!section || !snippet) return;
    document.getElementById("ppmRoles")?.remove();

    const seen = new Set();
    const roles = [];
    [...(vessels || [])]
      .filter((v) => yearOf(v.from))
      .sort((a, b) => String(a.from).localeCompare(String(b.from)))
      .forEach((v) => {
        const role = String(v.vessel_role || v.role || "").trim();
        const key = role.toLowerCase();
        if (!role || seen.has(key)) return;
        seen.add(key);
        roles.push({ role, year: yearOf(v.from) });
      });
    if (roles.length < 2) return;

    const strip = make("ol", "ppm-roles");
    strip.id = "ppmRoles";
    strip.setAttribute("aria-label", "Role progression");
    roles.forEach(({ role, year }) => {
      const item = make("li", "ppm-role");
      item.append(make("strong", "ppm-role-name", role), make("small", "ppm-role-year", `Since ${year}`));
      strip.appendChild(item);
    });
    snippet.parentNode.insertBefore(strip, snippet);
  }

  // The timeline's start years, as an attribute CSS draws beside each vessel.
  function markVesselYears(vessels) {
    const byId = new Map((vessels || []).map((v) => [String(v.id), v]));
    document.querySelectorAll("#ppVesselSnippet .pp-vessel-collapsible[data-vessel-id]").forEach((block) => {
      const year = yearOf(byId.get(block.getAttribute("data-vessel-id"))?.from);
      if (year) block.setAttribute("data-ppm-year", year);
    });
  }

  function render({ profile, vessels, displayName, tagline }) {
    if (!isModern()) return;
    renderMe(profile, displayName, tagline);
    renderYacht(vessels);
    renderRoleStrip(vessels);
    markVesselYears(vessels);
  }

  window.SeavPublicProfileModern = { setup, render };
})();
