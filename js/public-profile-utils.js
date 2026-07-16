// /js/public-profile-utils.js — shared helpers for public profile
(function () {
  "use strict";

  if (!window.Seav || !window.SeavData) return;

  const {
    MANDATORY_CERTS,
    RECOMMENDED_CERTS,
    getReferenceStatus,
    getCertExpiryInfo,
    isCertNoExpiry,
    isRankRoleCert,
    formatDatePretty
  } = window.SeavData;

  const LIMITS = {
    vessels: 6,
    tenders: 6,
    navigationRegions: 10,
    navigationPorts: 8,
    seatimes: 6,
    operations: 5,
    hobbies: 3,
    references: 3,
    specialist: 5,
    achievements: 8,
    additionalCerts: 8,
    certificates: 6
  };

  const SECTION_NAV = [
    { id: "pp-section-overview", label: "Overview" },
    { id: "ppVesselSection", label: "Vessels" },
    { id: "ppTenderSection", label: "Tenders" },
    { id: "ppSeatimeSection", label: "Sea Time" },
    { id: "ppNavigationSection", label: "Navigation" },
    { id: "ppOperationsSection", label: "Onboard Experience" },
    { id: "ppSpecialistSection", label: "Specialist Qualifications" },
    { id: "ppCertSection", label: "Certificates" },
    { id: "ppRefSection", label: "References" },
    { id: "ppAchievementSection", label: "Milestones" },
    { id: "ppHobbiesSection", label: "Hobbies & Interests" }
  ];

  let sectionNavObserver = null;
  let publicCertToggleBound = false;
  const expandedPublicCertIds = new Set();

  const haversineNm = window.SeavData.haversineNm;
  const formatNm = window.SeavData.formatNm;

  function hasNavCoord(lat, lng) {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    return Number.isFinite(latNum) && Number.isFinite(lngNum) && !(latNum === 0 && lngNum === 0);
  }

  function normalizeNavWaypoints(value) {
    if (!Array.isArray(value)) return [];
    return value
      .map((wp) => ({
        lat: Number(wp?.lat),
        lng: Number(wp?.lng)
      }))
      .filter((wp) => hasNavCoord(wp.lat, wp.lng));
  }

  function normalizePortText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function findPublicPort(country, port) {
    const ports = window.SeavNavigationPorts?.PORTS || [];
    if (!country && !port) return null;
    const normCountry = normalizePortText(country);
    const normPort = normalizePortText(port);
    return (
      ports.find(
        (item) =>
          normalizePortText(item.country) === normCountry &&
          normalizePortText(item.port) === normPort
      ) || null
    );
  }

  function resolveNavPoint(lat, lng, country, port) {
    if (hasNavCoord(lat, lng)) return [Number(lat), Number(lng)];
    const found = findPublicPort(country, port);
    if (found && hasNavCoord(found.lat, found.lng)) return [Number(found.lat), Number(found.lng)];
    return null;
  }

  function getNavigationRouteCoords(entry) {
    const from = resolveNavPoint(
      entry.fromLat ?? entry.from_lat,
      entry.fromLng ?? entry.from_lng,
      entry.fromCountry || entry.from_country,
      entry.fromPort || entry.from_port
    );
    const to = resolveNavPoint(
      entry.toLat ?? entry.lat ?? entry.to_lat,
      entry.toLng ?? entry.lng ?? entry.to_lng,
      entry.toCountry || entry.to_country || entry.country,
      entry.toPort || entry.port
    );
    const waypoints = normalizeNavWaypoints(entry.waypoints);

    if (!from || !to) return [];
    if (from[0] === to[0] && from[1] === to[1] && !waypoints.length) return [];

    return [from, ...waypoints.map((wp) => [wp.lat, wp.lng]), to];
  }

  function getNavigationEndpointMarkers(entry) {
    const markers = [];
    const fromLabel = [entry.fromPort || entry.from_port, entry.fromCountry || entry.from_country]
      .filter(Boolean)
      .join(", ");
    const toLabel = [
      entry.toPort || entry.port,
      entry.toCountry || entry.to_country || entry.country
    ]
      .filter(Boolean)
      .join(", ");
    const from = resolveNavPoint(
      entry.fromLat ?? entry.from_lat,
      entry.fromLng ?? entry.from_lng,
      entry.fromCountry || entry.from_country,
      entry.fromPort || entry.from_port
    );
    const to = resolveNavPoint(
      entry.toLat ?? entry.lat ?? entry.to_lat,
      entry.toLng ?? entry.lng ?? entry.to_lng,
      entry.toCountry || entry.to_country || entry.country,
      entry.toPort || entry.port
    );

    if (from) markers.push({ coord: from, label: fromLabel || "Departure" });
    if (to) markers.push({ coord: to, label: toLabel || "Arrival" });
    return markers;
  }

  function hasPlottableNavigationData(entries) {
    return (entries || []).some((entry) => {
      if (getNavigationRouteCoords(entry).length >= 2) return true;
      return getNavigationEndpointMarkers(entry).length > 0;
    });
  }

  function getNavigationRouteDistance(coords) {
    let total = 0;
    for (let i = 1; i < coords.length; i += 1) {
      total += haversineNm(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
    }
    return total;
  }

  // Straight-line haversine understates real distance (it ignores land and
  // sea lanes), which is why this used to disagree with navigation.html's own
  // "Total NM". When js/navigation-passage.js is loaded, look up each entry's
  // routed distance (same calculation navigation.html's log list uses — see
  // js/navigation-list.js's buildDistanceMap) and prefer that; otherwise fall
  // back to the straight-line sum so nothing breaks if that script isn't
  // available. Build this once per profile load and reuse it for both the
  // "Miles navigated" trust-strip KPI and the Navigation section card so the
  // two numbers on the same page always agree.
  async function buildPublicDistanceMap(entries) {
    const distances = new Map();
    const P = window.SeavNavigationPassage;
    if (!P?.getEntryRoute) return distances;

    await Promise.all(
      (entries || []).map(async (entry) => {
        try {
          const route = await P.getEntryRoute(entry);
          if (route?.distanceNm) distances.set(entry.id, route.distanceNm);
        } catch (error) {
          console.warn("[SEA-V] Public profile routed distance failed:", error);
        }
      })
    );

    return distances;
  }

  function computeNavigationTotalNm(navigationAreas, distanceMap) {
    if (!Array.isArray(navigationAreas) || !navigationAreas.length) return 0;

    return navigationAreas.reduce((sum, entry) => {
      const routedNm = distanceMap?.get(entry.id);
      if (Number.isFinite(routedNm)) return sum + routedNm;
      const coords = getNavigationRouteCoords(entry);
      if (coords.length < 2) return sum;
      return sum + getNavigationRouteDistance(coords);
    }, 0);
  }

  function getPublicVesselName(vesselId, vessels) {
    if (!vesselId) return "Unassigned";
    return (vessels || []).find((v) => v.id === vesselId)?.name || "Unnamed vessel";
  }

  function getPublicVesselColor(vesselId, vessels) {
    return window.SeavData?.getVesselColor?.(vesselId, vessels) || "#64748b";
  }

  function buildPublicNavigationStats(entries, vessels, distanceMap) {
    const routeEntries = (entries || [])
      .map((entry) => ({ entry, coords: getNavigationRouteCoords(entry) }))
      .filter((item) => item.coords.length >= 2);
    const countries = new Set();
    const vesselMap = new Map();
    let totalNm = 0;

    routeEntries.forEach(({ entry, coords }) => {
      const routedNm = distanceMap?.get(entry.id);
      totalNm += Number.isFinite(routedNm) ? routedNm : getNavigationRouteDistance(coords);

      const fromCountry = entry.fromCountry || entry.from_country || "";
      const toCountry = entry.toCountry || entry.to_country || entry.country || "";
      if (fromCountry) countries.add(fromCountry);
      if (toCountry) countries.add(toCountry);

      const vesselId = entry.vesselId || entry.vessel_id || "";
      if (!vesselMap.has(vesselId)) {
        vesselMap.set(vesselId, {
          id: vesselId,
          name: getPublicVesselName(vesselId, vessels),
          passages: 0,
          countries: new Set()
        });
      }
      const vessel = vesselMap.get(vesselId);
      vessel.passages += 1;
      if (fromCountry) vessel.countries.add(fromCountry);
      if (toCountry) vessel.countries.add(toCountry);
    });

    const vesselRows = [...vesselMap.values()]
      .sort((a, b) => b.passages - a.passages || a.name.localeCompare(b.name))
      .slice(0, 4);

    return {
      routes: routeEntries,
      totalNm,
      countries: countries.size,
      vessels: vesselMap.size,
      vesselRows
    };
  }

  const { getVesselRole, getVesselType, getVesselLength, getVesselExperience } = window.SeavData;

  function isReferenceVerified(ref) {
    const status = getReferenceStatus(ref);
    if (/verified|approved|confirmed/i.test(status)) return true;
    return ref?.verification?.confirmed === true;
  }

  function isTrustedVerificationStatus(status) {
    return /verified|confirmed|approved|signed/i.test(String(status || ""));
  }

  function getCertComplianceSummary(certs) {
    const templates = MANDATORY_CERTS || [];
    let valid = 0;
    let attention = 0;

    templates.forEach((template) => {
      const cert = findSavedCertByCode(certs, template.code);
      const status = getCertPublicStatus(cert);
      if (status.badge === "Missing" || status.badge === "Expired") {
        attention += 1;
      } else if (status.badge === "Expires Soon") {
        attention += 1;
        valid += 1;
      } else if (cert?.name) {
        valid += 1;
      } else {
        attention += 1;
      }
    });

    return { valid, attention, total: templates.length };
  }

  function groupSeatimeByVessel(seatimes, vessels) {
    const vesselMap = new Map(vessels.map((v) => [v.id, v]));
    const groups = new Map();

    (seatimes || []).forEach((entry) => {
      const key = entry.vesselId || entry.id;
      if (!groups.has(key)) {
        groups.set(key, {
          vesselId: entry.vesselId,
          vessel: vesselMap.get(entry.vesselId) || null,
          entries: [],
          totals: { sea: 0, standby: 0, yard: 0, watchkeeping: 0, total: 0 }
        });
      }

      const group = groups.get(key);
      group.entries.push(entry);
      group.totals.sea += toNumber(entry.actualSeaServiceDays);
      group.totals.standby += toNumber(entry.standbyServiceDays);
      group.totals.yard += toNumber(entry.yardServiceDays);
      group.totals.watchkeeping += toNumber(entry.watchkeepingDays);
      group.totals.total +=
        toNumber(entry.actualSeaServiceDays) +
        toNumber(entry.standbyServiceDays) +
        toNumber(entry.yardServiceDays) +
        toNumber(entry.watchkeepingDays);
    });

    return [...groups.values()].sort((a, b) => b.totals.total - a.totals.total);
  }

  function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  function renderVerificationBadge(status, label) {
    const trusted = isTrustedVerificationStatus(status);
    return `
      <span class="public-cv-verify-badge${trusted ? " is-trusted" : ""}">
        ${Seav.escapeHtml(label || status || "Logged")}
      </span>
    `;
  }

  function normalizeCode(code) {
    return String(code || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");
  }

  function parseMeters(value) {
    const match = String(value || "").match(/(\d+(\.\d+)?)/);
    return match ? Number(match[1]) : 0;
  }

  function formatExpiryShort(expiry) {
    if (!expiry) return "";
    const date = new Date(expiry);
    if (Number.isNaN(date.getTime())) return expiry;
    return date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
  }

  function getComplianceClass(badge) {
    const map = {
      Valid: "pp-pill-valid",
      "Expires Soon": "pp-pill-warning",
      Expired: "pp-pill-expired",
      Missing: "pp-pill-missing",
      "On file": "pp-pill-neutral",
      "No Expiry": "pp-pill-neutral"
    };
    return map[badge] || "pp-pill-neutral";
  }

  function isMandatoryCert(cert) {
    if (!cert) return false;
    const codes = (MANDATORY_CERTS || []).map((item) => normalizeCode(item.code));
    return codes.includes(normalizeCode(cert.code));
  }

  function isRecommendedCert(cert) {
    if (typeof isRankRoleCert === "function") return isRankRoleCert(cert);
    if (!cert || isMandatoryCert(cert)) return false;
    const codes = (RECOMMENDED_CERTS || []).map((item) => normalizeCode(item.code));
    return codes.includes(normalizeCode(cert.code));
  }

  function findCertByCode(certs, code) {
    if (window.SeavData?.findCertByCode) {
      return window.SeavData.findCertByCode(certs, code);
    }
    const target = normalizeCode(code);
    return certs.find((cert) => normalizeCode(cert.code) === target) || null;
  }

  function findSavedCertByCode(certs, code) {
    if (window.SeavData?.findSavedCertByCode) {
      return window.SeavData.findSavedCertByCode(certs, code);
    }
    const cert = findCertByCode(certs, code);
    return window.SeavData?.isSavedCert?.(cert) ? cert : null;
  }

  function getCertPublicStatus(cert) {
    if (!cert || !cert.name) {
      return { badge: "Missing", label: "Not recorded", className: "pp-pill-missing" };
    }

    if (isCertNoExpiry(cert)) {
      return {
        badge: "No Expiry",
        label: "No expiry",
        className: "pp-pill-neutral"
      };
    }

    if (cert.expiry) {
      const info = getCertExpiryInfo(cert.expiry);
      return {
        badge: info.badge,
        label: formatExpiryShort(cert.expiry),
        className: getComplianceClass(info.badge)
      };
    }

    const hasFile = window.SeavApiCore?.hasStoredFile?.(cert.attachment) ??
      !!(cert.attachment?.url || cert.attachment?.dataUrl || cert.attachment?.path);
    return {
      badge: hasFile ? "On file" : "Recorded",
      label: hasFile ? "Document on file" : "Recorded",
      className: "pp-pill-neutral"
    };
  }

  function buildCareerTagline(vessels) {
    if (!vessels.length) return "";

    const parts = [];
    parts.push(
      `${vessels.length} vessel${vessels.length === 1 ? "" : "s"}`
    );

    const lengths = vessels
      .map((v) => parseMeters(getVesselLength(v)))
      .filter((n) => n > 0);

    if (lengths.length) {
      const max = Math.max(...lengths);
      parts.push(`up to ${max}m`);
    }

    const types = [...new Set(vessels.map((v) => getVesselType(v)).filter(Boolean))];
    if (types.length) {
      parts.push(types.slice(0, 2).join(" • "));
    }

    return parts.join(" • ");
  }

  function formatDates(from, to) {
    const start = from ? formatExpiryShort(from) || formatDatePretty(from) : "—";
    const end = to ? formatExpiryShort(to) || formatDatePretty(to) : "Present";
    return `${start} – ${end}`;
  }

  function truncate(text, max = 220) {
    return window.SeavData?.truncateText
      ? window.SeavData.truncateText(text, max)
      : String(text || "").trim().slice(0, max);
  }

  function setSectionCount(elementId, total) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (!total) {
      el.hidden = true;
      return;
    }
    el.textContent = String(total);
    el.hidden = false;
  }

  function buildShowMoreButton(targetId, hiddenCount, label) {
    if (hiddenCount <= 0) return "";
    const noun = hiddenCount === 1 ? label.replace(/s$/, "") : label;
    return `
      <button
        type="button"
        class="public-cv-show-more"
        data-pp-expand="${Seav.escapeHtml(targetId)}"
        data-pp-label="${Seav.escapeHtml(label)}"
        aria-expanded="false"
      >
        Show ${hiddenCount} more ${Seav.escapeHtml(noun)}
      </button>
    `;
  }

  function bindPublicCertToggles() {
    if (publicCertToggleBound) return;
    publicCertToggleBound = true;

    document.addEventListener("click", (event) => {
      const toggleBtn = event.target.closest("[data-pp-toggle-cert-id]");
      if (!toggleBtn) return;

      event.preventDefault();
      const certId = toggleBtn.getAttribute("data-pp-toggle-cert-id");
      const card = toggleBtn.closest(".cert-compact-card");
      const body = card?.querySelector(".cert-compact-body");
      if (!certId || !card || !body) return;

      if (expandedPublicCertIds.has(certId)) {
        expandedPublicCertIds.delete(certId);
        card.classList.remove("is-expanded");
        toggleBtn.setAttribute("aria-expanded", "false");
        body.setAttribute("hidden", "");
      } else {
        expandedPublicCertIds.add(certId);
        card.classList.add("is-expanded");
        toggleBtn.setAttribute("aria-expanded", "true");
        body.removeAttribute("hidden");
      }
    });
  }

  function resolvePublicCertKey(cert, template) {
    if (cert?.id) return cert.id;
    const code = cert?.code || template?.code || "unknown";
    return `pp-cert-${normalizeCode(code)}`;
  }

  function isPublicCertExpanded(certKey) {
    return expandedPublicCertIds.has(certKey);
  }

  function getPublicCertTypeLabel(cert, template) {
    if (template && (MANDATORY_CERTS || []).some((item) => normalizeCode(item.code) === normalizeCode(template.code))) {
      return "Minimum mandatory";
    }
    if (isMandatoryCert(cert)) return "Minimum mandatory";
    if (template && isRankRoleCert?.({ code: template.code })) {
      return "Rank & role";
    }
    if (isRecommendedCert(cert)) return "Rank & role";
    return "Additional";
  }

  function bindExpandToggles(root) {
    if (!root || root.dataset.ppExpandBound === "true") return;
    root.dataset.ppExpandBound = "true";

    root.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-pp-expand]");
      if (!btn) return;

      const target = document.getElementById(btn.getAttribute("data-pp-expand"));
      if (!target) return;

      // A fixed collapsed-state label (e.g. a single row's "Details" toggle)
      // opts out of the "Show N more <label>" counting below, which assumes
      // the panel holds a list of [data-pp-more-item] rows — not true for a
      // single-item detail panel.
      const collapsedLabel = btn.getAttribute("data-pp-collapsed-label");

      const isHidden = target.hasAttribute("hidden");
      if (isHidden) {
        target.removeAttribute("hidden");
        btn.setAttribute("aria-expanded", "true");
        btn.textContent = collapsedLabel ? "Hide details" : "Show less";
      } else {
        target.setAttribute("hidden", "");
        btn.setAttribute("aria-expanded", "false");
        if (collapsedLabel) {
          btn.textContent = collapsedLabel;
        } else {
          const count = target.querySelectorAll("[data-pp-more-item]").length;
          const label = btn.getAttribute("data-pp-label") || "items";
          btn.textContent = `Show ${count} more ${label}`;
        }
      }
    });
  }

  function getSectionNavOffset() {
    const topbar = document.querySelector(".public-profile-topbar");
    const nav = document.getElementById("ppSectionNav");
    const topbarHeight = topbar ? topbar.offsetHeight : 0;
    const navHeight = nav && !nav.hidden ? nav.offsetHeight : 0;
    return topbarHeight + navHeight + 12;
  }

  function scrollToSection(sectionId) {
    const target = document.getElementById(sectionId);
    if (!target) return;

    setActiveSectionNavLink(sectionId);

    if (typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const offset = getSectionNavOffset();
    const top = window.scrollY + target.getBoundingClientRect().top - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  function setActiveSectionNavLink(sectionId) {
    const nav = document.getElementById("ppSectionNav");
    if (!nav) return;

    nav.querySelectorAll("[data-pp-nav-target]").forEach((link) => {
      const isActive = link.getAttribute("data-pp-nav-target") === sectionId;
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function bindSectionNav() {
    const nav = document.getElementById("ppSectionNav");
    if (!nav) return;

    if (nav.dataset.ppNavBound !== "true") {
      nav.dataset.ppNavBound = "true";

      nav.addEventListener("click", (event) => {
        const link = event.target.closest("[data-pp-nav-target]");
        if (!link) return;
        event.preventDefault();
        scrollToSection(link.getAttribute("data-pp-nav-target"));
      });
    }

    if (sectionNavObserver) {
      sectionNavObserver.disconnect();
      sectionNavObserver = null;
    }

    if (!("IntersectionObserver" in window)) return;

    const visibleSections = SECTION_NAV.map(({ id }) => document.getElementById(id)).filter(Boolean);
    if (!visibleSections.length) return;

    sectionNavObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible.length) {
          setActiveSectionNavLink(visible[0].target.id);
        }
      },
      {
        root: null,
        rootMargin: `-${getSectionNavOffset()}px 0px -55% 0px`,
        threshold: [0, 0.15, 0.35, 0.6]
      }
    );

    visibleSections.forEach((section) => sectionNavObserver.observe(section));
  }

  function renderSectionNav() {
    const nav = document.getElementById("ppSectionNav");
    if (!nav) return;

    const visible = SECTION_NAV.filter(({ id }) => {
      const section = document.getElementById(id);
      return section && !section.hidden;
    });

    if (visible.length < 3) {
      nav.hidden = true;
      nav.innerHTML = "";
      return;
    }

    nav.innerHTML = visible
      .map(
        ({ id, label }) => `
          <a
            href="#${Seav.escapeHtml(id)}"
            class="public-profile-section-nav-link"
            data-pp-nav-target="${Seav.escapeHtml(id)}"
          >${Seav.escapeHtml(label)}</a>
        `
      )
      .join("");

    nav.hidden = false;
    bindSectionNav();
    setActiveSectionNavLink(visible[0].id);
  }

  function renderTrustStrip(metrics) {
    const strip = document.getElementById("ppTrustStrip");
    const kpiCard = document.getElementById("ppKpiCard");
    if (!strip) return;

    const items = [];

    if (metrics.seaDays > 0) {
      items.push({ value: String(metrics.seaDays), label: "Sea days logged" });
    }
    if (metrics.navigationNm > 0) {
      items.push({ value: formatNm(metrics.navigationNm), label: "Miles navigated" });
    }
    if (metrics.vessels > 0) {
      items.push({ value: String(metrics.vessels), label: "Vessels" });
    }
    if (metrics.verifiedRefs > 0) {
      items.push({ value: String(metrics.verifiedRefs), label: "Verified refs" });
    }
    if (metrics.signedOps > 0) {
      items.push({ value: String(metrics.signedOps), label: "Signed ops" });
    }

    if (!items.length) {
      strip.innerHTML = "";
      strip.hidden = true;
      if (kpiCard) kpiCard.hidden = true;
      return;
    }

    strip.innerHTML = items
      .map(
        (item) => `
          <div class="kpi-box">
            <div class="kpi-num">${Seav.escapeHtml(item.value)}</div>
            <div class="kpi-label">${Seav.escapeHtml(item.label)}</div>
          </div>
        `
      )
      .join("");

    strip.hidden = false;
    if (kpiCard) kpiCard.hidden = false;
  }


  window.SeavPublicProfileUtils = {
    LIMITS,
    haversineNm, formatNm, hasNavCoord, normalizeNavWaypoints,
    getNavigationRouteCoords, getNavigationRouteDistance, computeNavigationTotalNm,
    buildPublicDistanceMap,
    getNavigationEndpointMarkers, hasPlottableNavigationData,
    getPublicVesselName, getPublicVesselColor, buildPublicNavigationStats,
    getVesselRole, getVesselType, getVesselLength, getVesselExperience,
    isReferenceVerified, isTrustedVerificationStatus, getCertComplianceSummary,
    groupSeatimeByVessel, toNumber, renderVerificationBadge,
    normalizeCode, parseMeters, formatExpiryShort, getComplianceClass,
    isMandatoryCert, isRecommendedCert, findCertByCode, findSavedCertByCode, getCertPublicStatus,
    buildCareerTagline, formatDates, truncate, setSectionCount, buildShowMoreButton,
    bindPublicCertToggles, resolvePublicCertKey, getPublicCertTypeLabel, isPublicCertExpanded,
    bindExpandToggles, getSectionNavOffset, scrollToSection, setActiveSectionNavLink,
    bindSectionNav, renderSectionNav, renderTrustStrip
  };
})();
