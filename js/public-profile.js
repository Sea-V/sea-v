// /js/public-profile.js
(function () {
  "use strict";

  if (!window.Seav || !window.SeavAPI || !window.SeavData) {
    console.warn("[SEA-V] Public profile dependencies missing.");
    return;
  }

  const {
    KEYS,
    DEFAULT_PROFILE,
    MANDATORY_CERTS,
    RECOMMENDED_CERTS,
    getReferenceStatus,
    getCertExpiryInfo,
    isProfilePublic,
    formatDatePretty,
    getOnboardCategoryLabel,
    getHobbyInterestCategoryLabel,
    getSpecialistCategoryLabel,
    getSeatimeTotals
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

  const expandedPublicCertIds = new Set();
  let publicCertToggleBound = false;

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

  function getPublicCertTypeLabel(cert, template) {
    if (template && (MANDATORY_CERTS || []).some((item) => normalizeCode(item.code) === normalizeCode(template.code))) {
      return "Core compliance";
    }
    if (isMandatoryCert(cert)) return "Core compliance";
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

  function renderHeaderProfile(profile, vessels, metrics) {
    const avatar = document.getElementById("ppAvatar");
    const nameEl = document.getElementById("pp_name");
    const rankEl = document.getElementById("pp_rank");
    const taglineEl = document.getElementById("pp_tagline");
    const factsEl = document.getElementById("ppFactsInline");
    const bioEl = document.getElementById("pp_bio");
    const overviewWrap = document.getElementById("ppCareerOverview");
    const footerNote = document.getElementById("ppFooterNote");

    const rank = profile.rank || "";
    const qualification = profile.qualification || "";
    const displayName = profile.name || "Seafarer";

    if (nameEl) nameEl.textContent = displayName;
    document.title = `${displayName} · Yacht CV · SEA-V`;

    if (rankEl) {
      rankEl.textContent =
        qualification && rank
          ? `${rank} • ${qualification}`
          : rank || qualification || "—";
    }

    const tagline = buildCareerTagline(vessels);
    if (taglineEl) {
      taglineEl.textContent = tagline;
      taglineEl.hidden = !tagline;
    }

    if (factsEl) {
      const facts = [profile.nationality, profile.location, profile.availability].filter(
        Boolean
      );
      factsEl.textContent = facts.length ? facts.join(" • ") : "—";
    }

    if (bioEl && overviewWrap) {
      bioEl.textContent = profile.bio || "";
      overviewWrap.hidden = !profile.bio;
    }

    renderTrustStrip(metrics);

    if (footerNote) footerNote.hidden = false;

    if (avatar) {
      const photoUrl = profile.photo?.url || profile.photo?.dataUrl || "";
      if (photoUrl) {
        avatar.style.backgroundImage = `url(${photoUrl})`;
        avatar.style.backgroundSize = "cover";
        avatar.style.backgroundPosition = "center";
        avatar.style.backgroundRepeat = "no-repeat";
      } else {
        avatar.style.backgroundImage = "";
      }
    }
  }

  function buildVesselHighlights(vessel, onboardEntries) {
    return onboardEntries
      .filter((entry) => entry.vesselId === vessel.id && entry.status === "Signed Off")
      .slice(0, 3)
      .map((entry) => entry.title || getOnboardCategoryLabel(entry.category))
      .filter(Boolean);
  }

  function buildVesselCard(v, onboardEntries, seatimeGroups, highlight = false) {
    const role = getVesselRole(v);
    const type = getVesselType(v);
    const size = getVesselLength(v) || "—";
    const experience = getVesselExperience(v);
    const highlights = buildVesselHighlights(v, onboardEntries);
    const seatimeGroup = seatimeGroups.find((group) => group.vesselId === v.id);
    const metaParts = [role, type, size !== "—" ? `${size}` : "", v.flag, v.program, v.builder]
      .filter(Boolean)
      .map((part) => String(part).trim())
      .filter(Boolean);

    const photoUrl = v.photo?.url || v.photo?.dataUrl || "";

    return `
      <article class="public-cv-vessel-card${highlight ? " public-cv-vessel-card--highlight" : ""}" data-pp-more-item>
        <div class="public-cv-vessel-card-head">
          <div class="public-cv-vessel-card-title-wrap">
            ${
              photoUrl
                ? `<div class="public-cv-vessel-thumb" style="background-image:url(${Seav.escapeHtml(photoUrl)})" aria-hidden="true"></div>`
                : ""
            }
            <div>
              <h3 class="public-cv-vessel-card-name">${Seav.escapeHtml(v.name || "Yacht")}</h3>
              <p class="public-cv-vessel-card-dates">${Seav.escapeHtml(formatDates(v.from, v.to))}</p>
            </div>
          </div>
          ${
            seatimeGroup?.totals?.total
              ? `<span class="public-cv-vessel-card-days">${Seav.escapeHtml(String(seatimeGroup.totals.total))} days logged</span>`
              : ""
          }
        </div>
        ${
          metaParts.length
            ? `<p class="public-cv-vessel-card-meta">${Seav.escapeHtml(metaParts.join(" • "))}</p>`
            : ""
        }
        ${
          experience
            ? `<p class="public-cv-vessel-card-story">${Seav.escapeHtml(truncate(experience, 280))}</p>`
            : ""
        }
        ${
          highlights.length
            ? `<ul class="public-cv-vessel-card-highlights">${highlights
                .map((item) => `<li>${Seav.escapeHtml(item)}</li>`)
                .join("")}</ul>`
            : ""
        }
      </article>
    `;
  }

  function renderSeatime(seatimes, vessels) {
    const box = document.getElementById("ppSeatimeSnippet");
    const section = document.getElementById("ppSeatimeSection");
    if (!box || !section) return;

    if (!seatimes.length) {
      section.hidden = true;
      return;
    }

    const totals = getSeatimeTotals(seatimes);
    const groups = groupSeatimeByVessel(seatimes, vessels);
    const visibleGroups = groups.slice(0, LIMITS.seatimes);
    const hiddenGroups = groups.slice(LIMITS.seatimes);
    const moreId = "ppSeatimeMore";

    const buildGroupRow = (group) => {
      const vesselName = group.vessel?.name || "Vessel record";
      const topStatus = group.entries.find((entry) => entry.verificationStatus)?.verificationStatus;
      const capacity = group.entries.find((entry) => entry.capacityServed)?.capacityServed;

      return `
        <div class="public-cv-seatime-row" data-pp-more-item>
          <div class="public-cv-seatime-main">
            <span class="public-cv-seatime-vessel">${Seav.escapeHtml(vesselName)}</span>
            <span class="public-cv-seatime-meta">${Seav.escapeHtml(
              [
                capacity ? `Capacity: ${capacity}` : "",
                group.totals.watchkeeping ? `${group.totals.watchkeeping} watchkeeping days` : ""
              ]
                .filter(Boolean)
                .join(" • ")
            )}</span>
          </div>
          <div class="public-cv-seatime-stats">
            <span class="public-cv-seatime-days">${Seav.escapeHtml(String(group.totals.total))} days</span>
            ${renderVerificationBadge(topStatus)}
          </div>
        </div>
      `;
    };

    box.innerHTML = `
      <div class="public-cv-seatime-totals">
        <div class="public-cv-seatime-total"><span>${Seav.escapeHtml(String(totals.sea))}</span><small>Sea</small></div>
        <div class="public-cv-seatime-total"><span>${Seav.escapeHtml(String(totals.watchkeeping))}</span><small>Watchkeeping</small></div>
        <div class="public-cv-seatime-total"><span>${Seav.escapeHtml(String(totals.yard))}</span><small>Yard</small></div>
        <div class="public-cv-seatime-total"><span>${Seav.escapeHtml(String(totals.standby))}</span><small>Standby</small></div>
        <div class="public-cv-seatime-total public-cv-seatime-total--accent"><span>${Seav.escapeHtml(String(totals.total))}</span><small>Total</small></div>
      </div>
      <div class="public-cv-mini-list">
        ${visibleGroups.map((group) => buildGroupRow(group).replace(" data-pp-more-item", "")).join("")}
        ${
          hiddenGroups.length
            ? `<div class="public-cv-more-block" id="${moreId}" hidden>
                ${hiddenGroups.map(buildGroupRow).join("")}
              </div>`
            : ""
        }
      </div>
      ${hiddenGroups.length ? buildShowMoreButton(moreId, hiddenGroups.length, "records") : ""}
    `;

    section.hidden = false;
  }

  function renderVessels(vessels, onboardEntries, seatimes) {
    const vesselBox = document.getElementById("ppVesselSnippet");
    const section = document.getElementById("ppVesselSection");
    if (!vesselBox) return;

    if (!vessels.length) {
      vesselBox.innerHTML = `<div class="muted">No vessel experience added yet.</div>`;
      setSectionCount("ppVesselCount", 0);
      if (section) section.hidden = false;
      return;
    }

    const sorted = [...vessels].sort((a, b) => {
      const da = a.from ? new Date(a.from) : new Date(0);
      const db = b.from ? new Date(b.from) : new Date(0);
      return db - da;
    });

    const seatimeGroups = groupSeatimeByVessel(seatimes, vessels);
    const visible = sorted.slice(0, LIMITS.vessels);
    const hidden = sorted.slice(LIMITS.vessels);
    const moreId = "ppVesselMore";

    vesselBox.innerHTML = `
      <div class="public-cv-vessel-list">
        ${visible
          .map((v, index) =>
            buildVesselCard(v, onboardEntries, seatimeGroups, index === 0).replace(
              " data-pp-more-item",
              ""
            )
          )
          .join("")}
        ${
          hidden.length
            ? `<div class="public-cv-more-block" id="${moreId}" hidden>
                ${hidden
                  .map((v) => buildVesselCard(v, onboardEntries, seatimeGroups))
                  .join("")}
              </div>`
            : ""
        }
      </div>
      ${hidden.length ? buildShowMoreButton(moreId, hidden.length, "yachts") : ""}
    `;

    setSectionCount("ppVesselCount", sorted.length);
    if (section) section.hidden = false;
  }

  function formatNavigationRouteLabel(item) {
    const from = item.fromPort
      ? [item.fromPort, item.fromCountry].filter(Boolean).join(", ")
      : "";
    const to = [item.toPort || item.port, item.toCountry || item.country]
      .filter(Boolean)
      .join(", ");

    if (from && to) return `${from} → ${to}`;
    return to || from || "Passage";
  }

  function renderNavigation(navigationAreas) {
    const box = document.getElementById("ppNavigationSnippet");
    const section = document.getElementById("ppNavigationSection");
    if (!box || !section) return;

    if (!navigationAreas.length) {
      section.hidden = true;
      return;
    }

    const countries = [
      ...new Set(
        navigationAreas.flatMap((item) =>
          [item.fromCountry, item.toCountry, item.country].filter(Boolean)
        )
      )
    ].sort((a, b) => a.localeCompare(b));

    const ports = new Set(
      navigationAreas.flatMap((item) => {
        const labels = [];
        if (item.fromPort) {
          labels.push([item.fromPort, item.fromCountry].filter(Boolean).join(", "));
        }
        const arrival = [item.toPort || item.port, item.toCountry || item.country]
          .filter(Boolean)
          .join(", ");
        if (arrival) labels.push(arrival);
        return labels;
      })
    );

    const visibleCountries = countries.slice(0, LIMITS.navigationRegions);
    const hiddenCountries = countries.slice(LIMITS.navigationRegions);
    const moreId = "ppNavMore";

    const portEntries = [...navigationAreas]
      .filter(
        (item) =>
          item.fromPort ||
          item.toPort ||
          item.port ||
          item.fromCountry ||
          item.toCountry ||
          item.country
      )
      .sort((a, b) => {
        const da = a.visitedDate ? new Date(a.visitedDate) : new Date(0);
        const db = b.visitedDate ? new Date(b.visitedDate) : new Date(0);
        return db - da;
      });

    const visiblePorts = portEntries.slice(0, LIMITS.navigationPorts);
    const hiddenPorts = portEntries.slice(LIMITS.navigationPorts);
    const portsMoreId = "ppPortsMore";

    const summaryParts = [];
    const totalNm = computeNavigationTotalNm(navigationAreas);
    if (totalNm > 0) {
      summaryParts.push(`${formatNm(totalNm)} navigated`);
    }
    if (countries.length) {
      summaryParts.push(
        `${countries.length} ${countries.length === 1 ? "country" : "countries"}`
      );
    }
    if (ports.size) {
      summaryParts.push(
        `${ports.size} ${ports.size === 1 ? "port" : "ports"} logged`
      );
    }

    box.innerHTML = `
      ${
        summaryParts.length
          ? `<p class="public-cv-nav-summary">${Seav.escapeHtml(summaryParts.join(" • "))}</p>`
          : ""
      }
      <div class="public-cv-chip-row">
        ${visibleCountries
          .map(
            (country) =>
              `<span class="public-cv-chip public-cv-chip--soft">${Seav.escapeHtml(country)}</span>`
          )
          .join("")}
      </div>
      ${
        hiddenCountries.length
          ? `<div class="public-cv-chip-row public-cv-more-block" id="${moreId}" hidden>
              ${hiddenCountries
                .map(
                  (country) =>
                    `<span class="public-cv-chip public-cv-chip--soft" data-pp-more-item>${Seav.escapeHtml(country)}</span>`
                )
                .join("")}
            </div>
            ${buildShowMoreButton(moreId, hiddenCountries.length, "regions")}`
          : ""
      }
      ${
        visiblePorts.length
          ? `<div class="public-cv-port-list">
              ${visiblePorts
                .map((item) => {
                  const label = formatNavigationRouteLabel(item);
                  const dep = item.departureDate || item.visitedDate || "";
                  const arr = item.arrivalDate || "";
                  const when = dep && arr
                    ? `${formatExpiryShort(dep)} → ${formatExpiryShort(arr)}`
                    : dep || arr
                    ? formatExpiryShort(dep || arr)
                    : "";
                  return `
                    <div class="public-cv-port-row">
                      <span>${Seav.escapeHtml(label)}</span>
                      ${when ? `<span class="public-cv-port-when">${Seav.escapeHtml(when)}</span>` : ""}
                    </div>
                  `;
                })
                .join("")}
              ${
                hiddenPorts.length
                  ? `<div class="public-cv-more-block" id="${portsMoreId}" hidden>
                      ${hiddenPorts
                        .map((item) => {
                          const label = formatNavigationRouteLabel(item);
                          return `<div class="public-cv-port-row" data-pp-more-item><span>${Seav.escapeHtml(label)}</span></div>`;
                        })
                        .join("")}
                    </div>
                    ${buildShowMoreButton(portsMoreId, hiddenPorts.length, "ports")}`
                  : ""
              }
            </div>`
          : ""
      }
    `;

    section.hidden = false;
  }

  function buildOperationRow(entry, vessels) {
    const vessel = vessels.find((v) => v.id === entry.vesselId);
    const meta = [
      getOnboardCategoryLabel(entry.category),
      vessel?.name || null,
      entry.dateFrom ? formatExpiryShort(entry.dateFrom) : null
    ]
      .filter(Boolean)
      .join(" • ");

    const signoff = entry.signoff || {};
    const signoffLine =
      signoff.signatoryName || signoff.confirmed
        ? [
            signoff.signatoryName,
            signoff.signatoryRank,
            signoff.signedAt ? formatExpiryShort(signoff.signedAt) : null
          ]
            .filter(Boolean)
            .join(" • ")
        : "";

    return `
      <div class="public-cv-mini-row public-cv-mini-row--stacked" data-pp-more-item>
        <div class="public-cv-mini-main">
          <span class="public-cv-mini-title">${Seav.escapeHtml(entry.title || "Onboard operation")}</span>
          <span class="public-cv-mini-meta">${Seav.escapeHtml(meta)}</span>
          ${entry.description ? `<p class="public-cv-op-desc">${Seav.escapeHtml(truncate(entry.description, 160))}</p>` : ""}
          ${
            signoffLine
              ? `<p class="public-cv-signoff-line">Signed off by ${Seav.escapeHtml(signoffLine)}</p>`
              : ""
          }
        </div>
        ${renderVerificationBadge(entry.status, "Signed off")}
      </div>
    `;
  }

  function renderOperations(onboardEntries, vessels) {
    const box = document.getElementById("ppOperationsSnippet");
    const section = document.getElementById("ppOperationsSection");
    if (!box || !section) return;

    const signed = onboardEntries
      .filter((entry) => entry.status === "Signed Off")
      .sort((a, b) => {
        const da = a.dateFrom ? new Date(a.dateFrom) : new Date(0);
        const db = b.dateFrom ? new Date(b.dateFrom) : new Date(0);
        return db - da;
      });

    if (!signed.length) {
      section.hidden = true;
      return;
    }

    const visible = signed.slice(0, LIMITS.operations);
    const hidden = signed.slice(LIMITS.operations);
    const moreId = "ppOpsMore";

    box.innerHTML = `
      <div class="public-cv-mini-list">
        ${visible
          .map((entry) =>
            buildOperationRow(entry, vessels).replace(" data-pp-more-item", "")
          )
          .join("")}
        ${
          hidden.length
            ? `<div class="public-cv-more-block" id="${moreId}" hidden>
                ${hidden.map((entry) => buildOperationRow(entry, vessels)).join("")}
              </div>`
            : ""
        }
      </div>
      ${hidden.length ? buildShowMoreButton(moreId, hidden.length, "operations") : ""}
    `;

    section.hidden = false;
  }

  function renderHobbiesInterests(entries) {
    const box = document.getElementById("ppHobbiesSnippet");
    const section = document.getElementById("ppHobbiesSection");
    if (!box || !section) return;

    const published = entries
      .filter((entry) => entry.status === "Published")
      .sort((a, b) => {
        const da = a.dateFrom ? new Date(a.dateFrom) : new Date(a.updatedAt || 0);
        const db = b.dateFrom ? new Date(b.dateFrom) : new Date(b.updatedAt || 0);
        return db - da;
      });

    if (!published.length) {
      section.hidden = true;
      return;
    }

    const visible = published.slice(0, LIMITS.hobbies);
    const hidden = published.slice(LIMITS.hobbies);
    const moreId = "ppHobbiesMore";

    box.innerHTML = `
      <div class="public-cv-mini-list">
        ${visible
          .map((entry) => {
            const photos = (entry.photos || [])
              .map((photo) => photo?.url || photo?.dataUrl || "")
              .filter(Boolean)
              .slice(0, 3);
            const categoryLabel = getHobbyInterestCategoryLabel(entry.category);
            const photoHtml = photos.length
              ? `<div class="public-cv-hobby-photos">${photos
                  .map(
                    (url) =>
                      `<img src="${Seav.escapeHtml(url)}" alt="" class="public-cv-hobby-photo" loading="lazy" />`
                  )
                  .join("")}</div>`
              : "";

            return `
              <div class="public-cv-mini-row" data-pp-more-item>
                <div class="public-cv-mini-main">
                  <span class="public-cv-mini-title">${Seav.escapeHtml(entry.title || "—")}</span>
                  <span class="public-cv-mini-meta">${Seav.escapeHtml(categoryLabel)}</span>
                  ${entry.description ? `<p class="public-cv-hobby-desc">${Seav.escapeHtml(entry.description)}</p>` : ""}
                  ${photoHtml}
                </div>
              </div>
            `;
          })
          .join("")}
        ${
          hidden.length
            ? `<div class="public-cv-more-block" id="${moreId}" hidden>
                ${hidden
                  .map((entry) => {
                    const categoryLabel = getHobbyInterestCategoryLabel(entry.category);
                    return `
                      <div class="public-cv-mini-row" data-pp-more-item>
                        <div class="public-cv-mini-main">
                          <span class="public-cv-mini-title">${Seav.escapeHtml(entry.title || "—")}</span>
                          <span class="public-cv-mini-meta">${Seav.escapeHtml(categoryLabel)}</span>
                        </div>
                      </div>
                    `;
                  })
                  .join("")}
              </div>`
            : ""
        }
      </div>
      ${hidden.length ? buildShowMoreButton(moreId, hidden.length, "interests") : ""}
    `;

    section.hidden = false;
  }

  function getCertStatusPillClass(status) {
    const map = {
      "pp-pill-valid": "pill-valid",
      "pp-pill-warning": "pill-warning",
      "pp-pill-expired": "pill-expired",
      "pp-pill-missing": "pill-missing",
      "pp-pill-neutral": "pill-neutral",
      "pp-pill-pending": "pill-pending"
    };
    return map[status?.className] || "pill-neutral";
  }

  function buildPublicCertRow(cert, template) {
    const record = cert || null;
    const source = record || template;
    const status = getCertPublicStatus(record);
    const pillClass = getCertStatusPillClass(status);
    const displayTitle = record?.name || template?.name || source?.code || "Certificate";
    const code = record?.code || template?.code || "—";
    const expiryLabel = record?.expiry
      ? formatDatePretty(record.expiry)
      : record?.name
        ? "No expiry recorded"
        : "Not recorded";
    const statusLabel = status.badge || status.label || "Missing";
    const fileUrl = record?.attachment?.url || record?.attachment?.dataUrl || "";
    const hasFile = !!fileUrl;
    const expiryLine = record?.expiry ? `Expires ${expiryLabel}` : expiryLabel;
    const certKey = resolvePublicCertKey(record, template);
    const isExpanded = expandedPublicCertIds.has(certKey);
    const typeLabel = getPublicCertTypeLabel(record, template);

    return `
      <article class="cert-compact-card public-cv-cert-row${isExpanded ? " is-expanded" : ""}" data-pp-more-item>
        <button
          type="button"
          class="cert-compact-summary public-cv-cert-summary"
          aria-expanded="${isExpanded ? "true" : "false"}"
          data-pp-toggle-cert-id="${Seav.escapeHtml(certKey)}"
        >
          <div class="cert-compact-summary-left">
            <div class="cert-compact-title">${Seav.escapeHtml(displayTitle)}</div>
            <div class="cert-compact-sub">
              ${Seav.escapeHtml(code)} • ${Seav.escapeHtml(expiryLine)}${
                hasFile ? " • Document on file" : ""
              }
            </div>
          </div>
          <div class="cert-compact-summary-right">
            <span class="cert-status-pill ${pillClass}">${Seav.escapeHtml(statusLabel)}</span>
            <span class="cert-chevron" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </div>
        </button>

        <div class="cert-compact-body"${isExpanded ? "" : " hidden"}>
          <div class="cert-compact-detail-grid">
            <div class="cert-compact-detail-panel">
              <div class="cert-compact-detail-label">Certificate</div>
              <div class="cert-compact-detail-value">
                ${Seav.escapeHtml(record?.name || template?.name || "Not recorded")}<br>
                Code: ${Seav.escapeHtml(code)}
              </div>
            </div>
            <div class="cert-compact-detail-panel">
              <div class="cert-compact-detail-label">Expiry &amp; status</div>
              <div class="cert-compact-detail-value">
                ${Seav.escapeHtml(expiryLabel)}<br>
                ${Seav.escapeHtml(status.label || statusLabel)}
              </div>
            </div>
            <div class="cert-compact-detail-panel">
              <div class="cert-compact-detail-label">Type</div>
              <div class="cert-compact-detail-value">${Seav.escapeHtml(typeLabel)}</div>
            </div>
            <div class="cert-compact-detail-panel">
              <div class="cert-compact-detail-label">Attachment</div>
              <div class="cert-compact-detail-value">
                ${
                  hasFile
                    ? `<a class="cert-attachment-link" href="${Seav.escapeHtml(fileUrl)}" target="_blank" rel="noopener">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M12 3v10m0 0l3.5-3.5M12 13l-3.5-3.5M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        View certificate
                      </a>`
                    : record?.name
                      ? "No attachment uploaded"
                      : "Not recorded on profile"
                }
              </div>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function renderCertBlock(label, visibleHtml, hiddenHtml, moreId, moreLabel) {
    if (!visibleHtml.length && !hiddenHtml.length) return "";

    return `
      <div class="public-cv-cert-block">
        <div class="public-cv-cert-group-label">${Seav.escapeHtml(label)}</div>
        <div class="cert-compact-list">
          ${visibleHtml.join("")}
          ${
            hiddenHtml.length
              ? `<div class="cert-compact-list public-cv-more-block" id="${moreId}" hidden>
                  ${hiddenHtml.join("")}
                </div>
                ${buildShowMoreButton(moreId, hiddenHtml.length, moreLabel)}`
              : ""
          }
        </div>
      </div>
    `;
  }

  function renderCertificates(certs) {
    const box = document.getElementById("ppCertSnippet");
    const section = document.getElementById("ppCertSection");
    if (!box) return;

    const coreHtml = (MANDATORY_CERTS || []).map((template) =>
      buildPublicCertRow(findCertByCode(certs, template.code), template).replace(
        " data-pp-more-item",
        ""
      )
    );

    const rankHtml = (RECOMMENDED_CERTS || [])
      .map((template) => findCertByCode(certs, template.code))
      .filter((cert) => cert && cert.name)
      .map((cert) => buildPublicCertRow(cert, null).replace(" data-pp-more-item", ""));

    const additional = certs.filter(
      (cert) =>
        (cert.name || cert.code) &&
        !isMandatoryCert(cert) &&
        !isRecommendedCert(cert)
    );

    const visibleAdditional = additional
      .slice(0, LIMITS.additionalCerts)
      .map((cert) => buildPublicCertRow(cert, null).replace(" data-pp-more-item", ""));
    const hiddenAdditional = additional
      .slice(LIMITS.additionalCerts)
      .map((cert) => buildPublicCertRow(cert, null));

    const blocks = [
      renderCertBlock("Core", coreHtml, [], "", "certificates"),
      rankHtml.length
        ? renderCertBlock("Rank & role", rankHtml, [], "", "certificates")
        : "",
      visibleAdditional.length || hiddenAdditional.length
        ? renderCertBlock(
            "Additional",
            visibleAdditional,
            hiddenAdditional,
            "ppCertMoreAdditional",
            "certificates"
          )
        : ""
    ].filter(Boolean);

    box.innerHTML = blocks.length
      ? blocks.join("")
      : `<div class="muted">No certificates recorded yet.</div>`;

    const summaryEl = document.getElementById("ppCertSummary");
    if (summaryEl) {
      const summary = getCertComplianceSummary(certs);
      if (summary.total) {
        summaryEl.textContent = `${summary.valid}/${summary.total} core valid`;
        summaryEl.hidden = false;
      } else {
        summaryEl.hidden = true;
      }
    }

    if (section) section.hidden = false;
    bindExpandToggles(box);
  }

  function renderSpecialistQualifications(entries) {
    const box = document.getElementById("ppSpecialistSnippet");
    const section = document.getElementById("ppSpecialistSection");
    if (!box || !section) return;

    const sorted = entries
      .filter((entry) => entry.title)
      .sort((a, b) => {
        if (a.status === "Verified" && b.status !== "Verified") return -1;
        if (b.status === "Verified" && a.status !== "Verified") return 1;
        return 0;
      });

    if (!sorted.length) {
      section.hidden = true;
      return;
    }

    const visible = sorted.slice(0, LIMITS.specialist);
    const hidden = sorted.slice(LIMITS.specialist);
    const moreId = "ppSpecialistMore";

    const buildCard = (entry) => {
      const verified = entry.status === "Verified";
      const meta = [
        getSpecialistCategoryLabel(entry.category),
        entry.issuingBody,
        entry.dateObtained ? formatExpiryShort(entry.dateObtained) : null
      ]
        .filter(Boolean)
        .join(" • ");

      return `
        <div class="public-cv-mini-row public-cv-mini-row--stacked" data-pp-more-item>
          <div class="public-cv-mini-main">
            <span class="public-cv-mini-title">${Seav.escapeHtml(entry.title)}</span>
            ${meta ? `<span class="public-cv-mini-meta">${Seav.escapeHtml(meta)}</span>` : ""}
          </div>
          <span class="public-cv-mini-meta">
            <span class="public-cv-status-dot${verified ? " is-valid" : ""}" aria-hidden="true"></span>
            ${Seav.escapeHtml(entry.status || "Self-declared")}
          </span>
        </div>
      `;
    };

    box.innerHTML = `
      <div class="public-cv-mini-list">
        ${visible.map((entry) => buildCard(entry).replace(" data-pp-more-item", "")).join("")}
        ${
          hidden.length
            ? `<div class="public-cv-more-block" id="${moreId}" hidden>
                ${hidden.map(buildCard).join("")}
              </div>`
            : ""
        }
      </div>
      ${hidden.length ? buildShowMoreButton(moreId, hidden.length, "skills") : ""}
    `;

    section.hidden = false;
  }

  function renderReferences(refs) {
    const box = document.getElementById("ppRefSnippet");
    const section = document.getElementById("ppRefSection");
    if (!box || !section) return;

    const verifiedRefs = refs.filter(isReferenceVerified);

    if (!verifiedRefs.length) {
      section.hidden = true;
      return;
    }

    const sorted = [...verifiedRefs].sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(0);
      const db = b.date ? new Date(b.date) : new Date(0);
      return db - da;
    });

    const visible = sorted.slice(0, LIMITS.references);
    const hidden = sorted.slice(LIMITS.references);
    const moreId = "ppRefMore";

    const buildRef = (ref) => {
      const status = getReferenceStatus(ref);
      const verification = ref.verification || {};
      const verifierMeta = [
        verification.rank,
        verification.cocNumber ? `CoC ${verification.cocNumber}` : "",
        verification.signedAt ? formatExpiryShort(verification.signedAt) : ""
      ]
        .filter(Boolean)
        .join(" • ");

      return `
        <div class="public-cv-ref-block" data-pp-more-item>
          <div class="public-cv-ref-top">
            <div>
              <p class="public-cv-ref-name">${Seav.escapeHtml(ref.name || "Referee")}</p>
              <span class="public-cv-verify-badge is-trusted">Verified reference</span>
            </div>
            <span class="public-cv-status-dot is-valid" title="${Seav.escapeHtml(status)}" aria-label="${Seav.escapeHtml(status)}"></span>
          </div>
          <div class="public-cv-ref-meta">
            ${Seav.escapeHtml(ref.title || "—")}
            ${
              ref.vessel || ref.role || ref.period
                ? ` • ${Seav.escapeHtml([ref.vessel, ref.role, ref.period].filter(Boolean).join(" • "))}`
                : ""
            }
          </div>
          <div class="public-cv-ref-quote">“${Seav.escapeHtml(truncate(ref.text, 220))}”</div>
          ${
            verification.signatureName || verifierMeta
              ? `<p class="public-cv-signoff-line">Confirmed by ${Seav.escapeHtml(
                  [verification.signatureName, verifierMeta].filter(Boolean).join(" • ")
                )}</p>`
              : ""
          }
        </div>
      `;
    };

    box.innerHTML = `
      ${visible.map((ref) => buildRef(ref).replace(" data-pp-more-item", "")).join("")}
      ${
        hidden.length
          ? `<div class="public-cv-more-block" id="${moreId}" hidden>
              ${hidden.map(buildRef).join("")}
            </div>
            ${buildShowMoreButton(moreId, hidden.length, "references")}`
          : ""
      }
    `;

    section.hidden = false;
  }

  function renderAchievements(achievements) {
    const box = document.getElementById("ppAchievementSnippet");
    const section = document.getElementById("ppAchievementSection");
    if (!box || !section) return;

    const approved = achievements.filter((item) => item.status === "Approved");
    if (!approved.length) {
      section.hidden = true;
      return;
    }

    const visible = approved.slice(0, LIMITS.achievements);
    const hidden = approved.slice(LIMITS.achievements);
    const moreId = "ppAchievementMore";

    const buildHighlight = (item) => {
      const badgeUrl =
        window.SeavBadges?.resolveItemBadgeImage?.(item) ||
        item.badgeImage ||
        "";
      const witness = [item.witnessName, item.witnessPosition].filter(Boolean).join(" • ");
      const title = item.title || "Achievement";

      return `
        <article class="public-cv-highlight-card" data-pp-more-item>
          <div class="public-cv-highlight-badge" aria-hidden="true">
            ${
              badgeUrl
                ? `<img src="${Seav.escapeHtml(badgeUrl)}" alt="" />`
                : `<span class="public-cv-highlight-badge-fallback">${Seav.escapeHtml(title.slice(0, 1))}</span>`
            }
          </div>
          <div class="public-cv-highlight-body">
            <h3 class="public-cv-highlight-title">${Seav.escapeHtml(title)}</h3>
            ${item.description ? `<p class="public-cv-highlight-desc">${Seav.escapeHtml(item.description)}</p>` : ""}
            ${witness ? `<p class="public-cv-highlight-witness">${Seav.escapeHtml(witness)}</p>` : ""}
          </div>
        </article>
      `;
    };

    box.innerHTML = `
      <div class="public-cv-highlight-list">
        ${visible.map((item) => buildHighlight(item).replace(" data-pp-more-item", "")).join("")}
        ${
          hidden.length
            ? `<div class="public-cv-more-block public-cv-highlight-list" id="${moreId}" hidden>
                ${hidden.map(buildHighlight).join("")}
              </div>`
            : ""
        }
      </div>
      ${hidden.length ? buildShowMoreButton(moreId, hidden.length, "highlights") : ""}
    `;

    section.hidden = false;
  }

  async function loadProfile() {
    const params = new URLSearchParams(location.search);
    const profileId = params.get("p") || params.get("id");

    if (profileId) {
      const publicProfile = await SeavAPI.getPublicProfile(profileId);
      if (publicProfile) return { ...DEFAULT_PROFILE, ...publicProfile };
      return { ...DEFAULT_PROFILE, publicEnabled: false };
    }

    const profile = await SeavAPI.get(KEYS.PROFILE, DEFAULT_PROFILE);
    return { ...DEFAULT_PROFILE, ...profile };
  }

  async function loadPublicData(profileId, key) {
    if (profileId && SeavAPI.getArrayForUser) {
      return SeavAPI.getArrayForUser(key, profileId);
    }
    return SeavAPI.getArray(key);
  }

  async function refreshPublicProfileView() {
    const gate = document.getElementById("ppGate");
    const content = document.getElementById("ppContent");
    const loading = document.getElementById("ppLoading");

    try {
      const profile = await loadProfile();
      const isPublic = isProfilePublic(profile);

      if (loading) loading.hidden = true;

      if (!isPublic) {
        if (gate) gate.hidden = false;
        if (content) content.style.display = "none";
        return;
      }

      if (gate) gate.hidden = true;
      if (content) content.style.display = "block";

      const ownerId = profile.id;

      const [
        vessels,
        certs,
        refs,
        navigationAreas,
        onboardEntries,
        hobbyEntries,
        specialistEntries,
        achievements,
        seatimes
      ] = await Promise.all([
        loadPublicData(ownerId, KEYS.VESSELS),
        loadPublicData(ownerId, KEYS.CERTS),
        loadPublicData(ownerId, KEYS.REFS),
        loadPublicData(ownerId, KEYS.NAVIGATION_AREAS),
        loadPublicData(ownerId, KEYS.ONBOARD_EXPERIENCES),
        loadPublicData(ownerId, KEYS.HOBBIES_INTERESTS),
        loadPublicData(ownerId, KEYS.SPECIALIST_QUALIFICATIONS),
        loadPublicData(ownerId, KEYS.ACHIEVEMENTS),
        loadPublicData(ownerId, KEYS.SEATIMES)
      ]);

      const metrics = {
        seaDays: getSeatimeTotals(seatimes).sea,
        vessels: vessels.length,
        verifiedRefs: refs.filter(isReferenceVerified).length,
        signedOps: onboardEntries.filter((entry) => entry.status === "Signed Off").length,
        certSummary: getCertComplianceSummary(certs),
        navigationNm: computeNavigationTotalNm(navigationAreas)
      };

      renderHeaderProfile(profile, vessels, metrics);
      renderSeatime(seatimes, vessels);
      renderVessels(vessels, onboardEntries, seatimes);
      renderNavigation(navigationAreas);
      renderOperations(onboardEntries, vessels);
      renderHobbiesInterests(hobbyEntries);
      renderCertificates(certs);
      renderSpecialistQualifications(specialistEntries);
      renderReferences(refs);
      renderAchievements(achievements);

      bindExpandToggles(document.getElementById("ppContent"));
      renderSectionNav();
    } catch (err) {
      console.error("[SEA-V] Public profile render failed:", err);
      if (loading) loading.hidden = true;
      if (content) content.style.display = "none";
      if (gate) {
        gate.hidden = false;
        const title = gate.querySelector("h3");
        const message = gate.querySelector("p");
        if (title) title.textContent = "Could not load profile";
        if (message) {
          message.textContent =
            "Something went wrong loading this public profile. Refresh the page or try again later.";
        }
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindPublicCertToggles();
    refreshPublicProfileView();
  });
  document.addEventListener("seav:data-updated", refreshPublicProfileView);
})();
