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
    getOnboardCategoryLabel,
    getSeatimeTotals,
    renderMandatoryCertDetailHtml,
    isSuppressedAdditionalCert
  } = window.SeavData;

  const LIMITS = {
    vessels: 6,
    navigationRegions: 10,
    navigationPorts: 8,
    seatimes: 6,
    operations: 5,
    hobbies: 3,
    references: 3,
    specialist: 5,
    achievements: 8,
    additionalCerts: 8
  };

  const SECTION_NAV = [
    { id: "pp-section-overview", label: "Overview" },
    { id: "ppCertSection", label: "Certificates" },
    { id: "ppVesselSection", label: "Yachts" },
    { id: "ppSeatimeSection", label: "Sea time" },
    { id: "ppRefSection", label: "References" },
    { id: "ppOperationsSection", label: "Operations" },
    { id: "ppNavigationSection", label: "Navigation" },
    { id: "ppSpecialistSection", label: "Skills" },
    { id: "ppAchievementSection", label: "Highlights" },
    { id: "ppHobbiesSection", label: "Interests" }
  ];

  let sectionNavObserver = null;
  let publicCertToggleBound = false;
  const expandedPublicCertIds = new Set();

  function haversineNm(lat1, lng1, lat2, lng2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const earthRadiusNm = 3440.065;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * earthRadiusNm * Math.asin(Math.sqrt(a));
  }

  function formatNm(value) {
    const miles = Number(value || 0);
    if (miles >= 1000) return `${Math.round(miles).toLocaleString()} NM`;
    if (miles >= 100) return `${Math.round(miles)} NM`;
    return `${Math.round(miles * 10) / 10} NM`;
  }

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

  function getNavigationRouteCoords(entry) {
    const fromLat = Number(entry.fromLat ?? entry.from_lat ?? 0);
    const fromLng = Number(entry.fromLng ?? entry.from_lng ?? 0);
    const toLat = Number(entry.toLat ?? entry.lat ?? entry.to_lat ?? 0);
    const toLng = Number(entry.toLng ?? entry.lng ?? entry.to_lng ?? 0);
    const waypoints = normalizeNavWaypoints(entry.waypoints);

    if (!hasNavCoord(fromLat, fromLng) || !hasNavCoord(toLat, toLng)) return [];
    if (fromLat === toLat && fromLng === toLng && !waypoints.length) return [];

    return [
      [fromLat, fromLng],
      ...waypoints.map((wp) => [wp.lat, wp.lng]),
      [toLat, toLng]
    ];
  }

  function getNavigationRouteDistance(coords) {
    let total = 0;
    for (let i = 1; i < coords.length; i += 1) {
      total += haversineNm(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
    }
    return total;
  }

  function computeNavigationTotalNm(navigationAreas) {
    if (!Array.isArray(navigationAreas) || !navigationAreas.length) return 0;

    return navigationAreas.reduce((sum, entry) => {
      const coords = getNavigationRouteCoords(entry);
      if (coords.length < 2) return sum;
      return sum + getNavigationRouteDistance(coords);
    }, 0);
  }

  function getVesselRole(v) {
    return v?.vessel_role || v?.role || "Crew";
  }

  function getVesselType(v) {
    return v?.vessel_type || v?.type || "";
  }

  function getVesselLength(v) {
    return v?.vessel_length || v?.length || v?.gt || "";
  }

  function getVesselExperience(v) {
    return String(v?.experience_onboard || v?.desc || "").trim();
  }

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
      const cert = findCertByCode(certs, template.code);
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
    if (!cert || isMandatoryCert(cert)) return false;
    const codes = (RECOMMENDED_CERTS || []).map((item) => normalizeCode(item.code));
    return codes.includes(normalizeCode(cert.code));
  }

  function findCertByCode(certs, code) {
    const target = normalizeCode(code);
    return certs.find((cert) => normalizeCode(cert.code) === target) || null;
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

    const hasFile = !!(cert.attachment?.url || cert.attachment?.dataUrl);
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
      `${vessels.length} yacht${vessels.length === 1 ? "" : "s"}`
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
    const raw = String(text || "").trim();
    if (raw.length <= max) return raw;
    return `${raw.slice(0, max).trim()}…`;
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
    if (template && (RECOMMENDED_CERTS || []).some((item) => normalizeCode(item.code) === normalizeCode(template.code))) {
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

      const isHidden = target.hasAttribute("hidden");
      if (isHidden) {
        target.removeAttribute("hidden");
        btn.setAttribute("aria-expanded", "true");
        btn.textContent = "Show less";
      } else {
        target.setAttribute("hidden", "");
        btn.setAttribute("aria-expanded", "false");
        const count = target.querySelectorAll("[data-pp-more-item]").length;
        const label = btn.getAttribute("data-pp-label") || "items";
        btn.textContent = `Show ${count} more ${label}`;
      }
    });
  }

  function getSectionNavOffset() {
    const topbar = document.querySelector(".public-cv-topbar");
    const nav = document.getElementById("ppSectionNav");
    const topbarHeight = topbar ? topbar.offsetHeight : 0;
    const navHeight = nav && !nav.hidden ? nav.offsetHeight : 0;
    return topbarHeight + navHeight + 12;
  }

  function scrollToSection(sectionId) {
    const target = document.getElementById(sectionId);
    if (!target) return;

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
    if (!nav || nav.dataset.ppNavBound === "true") return;
    nav.dataset.ppNavBound = "true";

    nav.addEventListener("click", (event) => {
      const link = event.target.closest("[data-pp-nav-target]");
      if (!link) return;
      event.preventDefault();
      scrollToSection(link.getAttribute("data-pp-nav-target"));
    });

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
            class="public-cv-section-nav-link"
            data-pp-nav-target="${Seav.escapeHtml(id)}"
          >${Seav.escapeHtml(label)}</a>
        `
      )
      .join("");

    nav.hidden = false;
    delete nav.dataset.ppNavBound;
    bindSectionNav();
    setActiveSectionNavLink(visible[0].id);
  }

  function renderTrustStrip(metrics) {
    const strip = document.getElementById("ppTrustStrip");
    if (!strip) return;

    const items = [];

    if (metrics.seaDays > 0) {
      items.push({ value: String(metrics.seaDays), label: "Sea days logged" });
    }
    if (metrics.navigationNm > 0) {
      items.push({ value: formatNm(metrics.navigationNm), label: "Miles navigated" });
    }
    if (metrics.vessels > 0) {
      items.push({ value: String(metrics.vessels), label: "Yachts" });
    }
    if (metrics.verifiedRefs > 0) {
      items.push({ value: String(metrics.verifiedRefs), label: "Verified refs" });
    }
    if (metrics.signedOps > 0) {
      items.push({ value: String(metrics.signedOps), label: "Signed ops" });
    }
    if (metrics.certSummary.total > 0) {
      items.push({
        value: `${metrics.certSummary.valid}/${metrics.certSummary.total}`,
        label: "Core certs valid"
      });
    }

    if (!items.length) {
      strip.hidden = true;
      strip.innerHTML = "";
      return;
    }

    strip.innerHTML = items
      .map(
        (item) => `
          <div class="public-cv-trust-stat">
            <span class="public-cv-trust-stat-value">${Seav.escapeHtml(item.value)}</span>
            <span class="public-cv-trust-stat-label">${Seav.escapeHtml(item.label)}</span>
          </div>
        `
      )
      .join("");

    strip.hidden = false;
  }


  window.SeavPublicProfileUtils = {
    LIMITS,
    haversineNm, formatNm, hasNavCoord, normalizeNavWaypoints,
    getNavigationRouteCoords, getNavigationRouteDistance, computeNavigationTotalNm,
    getVesselRole, getVesselType, getVesselLength, getVesselExperience,
    isReferenceVerified, isTrustedVerificationStatus, getCertComplianceSummary,
    groupSeatimeByVessel, toNumber, renderVerificationBadge,
    normalizeCode, parseMeters, formatExpiryShort, getComplianceClass,
    isMandatoryCert, isRecommendedCert, findCertByCode, getCertPublicStatus,
    buildCareerTagline, formatDates, truncate, setSectionCount, buildShowMoreButton,
    bindPublicCertToggles, resolvePublicCertKey, getPublicCertTypeLabel, isPublicCertExpanded,
    bindExpandToggles, getSectionNavOffset, scrollToSection, setActiveSectionNavLink,
    bindSectionNav, renderSectionNav, renderTrustStrip
  };
})();
