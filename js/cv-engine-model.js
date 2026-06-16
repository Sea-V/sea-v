// /js/cv-engine.js
(function () {
  "use strict";

  if (!window.SeavData) {
    console.warn("[SEA-V] cv-engine requires seav-data.js");
    return;
  }

  const {
    KEYS,
    MANDATORY_CERTS,
    RECOMMENDED_CERTS,
    isSavedCert,
    formatDatePretty,
    getSpecialistCategoryLabel,
    getOnboardCategoryLabel
  } = window.SeavData;

  const LOGO_SRC = "img/logo.png";

  function normalizeCode(code) {
    return String(code || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");
  }

  function escapeHtml(str) {
    if (window.Seav?.escapeHtml) return window.Seav.escapeHtml(str);
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function formatCvDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return formatDatePretty(value) || value;
    return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }

  function formatCvDateRange(from, to) {
    const start = formatCvDate(from) || "—";
    const end = to ? formatCvDate(to) : "Present";
    return `${start} – ${end}`;
  }

  function formatYear(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      const match = String(value).match(/\d{4}/);
      return match ? match[0] : value;
    }
    return String(date.getFullYear());
  }

  function splitParagraphs(text) {
    return String(text || "")
      .split(/\n\s*\n/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function splitBullets(text) {
    return String(text || "")
      .split(/\n+/)
      .map((part) => part.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);
  }

  function sortByDateDesc(items, field) {
    return [...items].sort((a, b) => {
      const da = a[field] ? new Date(a[field]) : new Date(0);
      const db = b[field] ? new Date(b[field]) : new Date(0);
      return db - da;
    });
  }

  function compareVesselsChronologicalDesc(a, b) {
    const aCurrent = !a?.to;
    const bCurrent = !b?.to;
    if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;

    const aEnd = a?.to ? new Date(a.to) : new Date();
    const bEnd = b?.to ? new Date(b.to) : new Date();
    if (!Number.isNaN(aEnd.getTime()) && !Number.isNaN(bEnd.getTime()) && aEnd - bEnd !== 0) {
      return bEnd - aEnd;
    }

    const aStart = a?.from ? new Date(a.from) : new Date(0);
    const bStart = b?.from ? new Date(b.from) : new Date(0);
    return bStart - aStart;
  }

  function getVesselRole(vessel) {
    return String(vessel?.vessel_role || vessel?.role || "").trim();
  }

  function getVesselType(vessel) {
    return String(vessel?.vessel_type || vessel?.type || "").trim();
  }

  function formatVesselSize(vessel) {
    const parts = [];
    const length = vessel?.vessel_length || vessel?.length || vessel?.size || "";
    const gt = vessel?.gt || "";

    if (length) {
      const raw = String(length).trim();
      parts.push(/\bm|meter|metre/i.test(raw) ? raw : `${raw} m`);
    }

    if (gt) {
      const raw = String(gt).trim().replace(/,/g, "");
      if (/\bgt/i.test(raw)) {
        parts.push(raw);
      } else if (/^\d+(\.\d+)?$/.test(raw)) {
        parts.push(`${Number(raw).toLocaleString("en-GB")} GT`);
      } else {
        parts.push(`${raw} GT`);
      }
    }

    return parts.join(" · ");
  }

  function formatVesselMeta(vessel) {
    return [vessel?.program, vessel?.flag, getVesselType(vessel), formatVesselSize(vessel)]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(" · ");
  }

  function formatVesselSubline(vessel) {
    const length = vessel?.vessel_length || vessel?.length || "";
    const gt = vessel?.gt || "";
    const sizeParts = [];

    if (length) {
      const raw = String(length).trim();
      sizeParts.push(/\bft|m|meter|metre/i.test(raw) ? raw : `${raw} m`);
    }

    if (gt) {
      const raw = String(gt).trim().replace(/,/g, "");
      if (/\bgt/i.test(raw)) {
        sizeParts.push(raw);
      } else if (/^\d+(\.\d+)?$/.test(raw)) {
        sizeParts.push(`${Number(raw).toLocaleString("en-GB")} GT`);
      } else {
        sizeParts.push(`${raw} GT`);
      }
    }

    const lead = sizeParts.length === 2 ? `${sizeParts[0]} / ${sizeParts[1]}` : sizeParts.join(" ");
    const tail = [vessel?.builder, vessel?.program, vessel?.flag, getVesselType(vessel)]
      .map((part) => String(part || "").trim())
      .filter(Boolean);

    const combined = [lead, ...tail].filter(Boolean);
    if (!combined.length) return "";
    return `${combined.join(", ")}.`;
  }

  function formatProfileDob(value) {
    if (!value) return "";
    return formatCvDate(value) || formatDatePretty(value) || value;
  }

  function getReferenceItems(source) {
    return (source.refs || [])
      .filter((ref) => ref?.name)
      .slice(0, 8)
      .map((ref) => ({
        name: ref.name,
        detail: [ref.title, ref.role, ref.vessel].filter(Boolean).join(" | "),
        email: ref.email || ""
      }));
  }

  function splitProfileLines(value) {
    return String(value || "")
      .split(/\n+/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function certPriority(cert) {
    const code = normalizeCode(cert?.code || "");
    if (code === "STCW A-II/1") return 0;
    if (code === "ENG1") return 1;
    if (code === "PST") return 2;
    if (code === "FPFF") return 3;
    if (code === "EFA") return 4;
    if (code === "PSSR") return 5;
    if (code === "PSA") return 6;
    if (code === "GMDSS") return 7;
    if (code === "STCW A-VI/6-2") return 8;
    if (code === "STCW A-VI/3") return 9;
    if (code === "STCW A-VI/2") return 10;
    if (code === "STCW A-VI/4-1") return 11;
    if (MANDATORY_CERTS.some((item) => normalizeCode(item.code) === code)) return 12;
    return 9;
  }

  function getCertDisplayName(cert) {
    const savedName = String(cert?.name || "").trim();
    if (savedName) return savedName;

    const code = normalizeCode(cert?.code || "");
    const template = [...(MANDATORY_CERTS || []), ...(RECOMMENDED_CERTS || [])].find(
      (item) => normalizeCode(item.code) === code
    );
    if (template?.name) return template.name;

    return String(cert?.code || "").trim() || "Certificate";
  }

  function getPhotoUrl(profile) {
    const photo = profile?.photo;
    if (!photo) return "";
    if (typeof photo === "string") return photo.trim();
    return photo.url || photo.dataUrl || photo.publicUrl || "";
  }

  function buildCvSource(state) {
    const profile = state?.profile || {};
    const vessels = sortByDateDesc(state?.vessels || [], "from").sort(
      compareVesselsChronologicalDesc
    );
    const certs = (state?.certs || []).filter((cert) =>
      typeof isSavedCert === "function" ? isSavedCert(cert) : !!cert?.name
    );
    const specialist = sortByDateDesc(state?.specialistQualifications || [], "dateObtained");
    const onboard = state?.onboardExperiences || [];
    const achievements = state?.achievements || [];
    const navigation = state?.navigationAreas || [];
    const refs = state?.refs || [];

    return { profile, vessels, certs, specialist, onboard, achievements, navigation, refs };
  }

  function getVesselExperience(vessel) {
    return String(vessel?.experience_onboard || vessel?.desc || "").trim();
  }

  function buildAutoBullets(vessel, onboardEntries) {
    const bullets = [];

    onboardEntries
      .filter((entry) => entry.vesselId === vessel.id)
      .slice(0, 4)
      .forEach((entry) => {
        const label = entry.title || getOnboardCategoryLabel(entry.category);
        if (label) {
          bullets.push(entry.description ? `${label}: ${entry.description}` : label);
        }
      });

    if (!bullets.length) {
      const role = getVesselRole(vessel) || "crew member";
      bullets.push(`Served as ${role} aboard ${vessel.name || "yacht"}.`);
    }

    return bullets.slice(0, 5);
  }

  function getProfileCareerOverview(source) {
    return String(source?.profile?.bio || "").trim();
  }

  function buildFallbackSummary(source) {
    const bits = [];
    if (source.profile.rank) bits.push(source.profile.rank);
    if (source.profile.qualification) bits.push(source.profile.qualification);
    if (source.vessels.length) {
      bits.push(
        `${source.vessels.length} yacht${source.vessels.length === 1 ? "" : "s"} of experience`
      );
    }
    if (bits.length) {
      return `Experienced maritime professional — ${bits.join(" • ")}.`;
    }

    return "";
  }

  function buildAutoSummary(source) {
    const fromProfile = getProfileCareerOverview(source);
    if (fromProfile) return fromProfile;

    return buildFallbackSummary(source);
  }

  function normalizeOverviewText(text) {
    return String(text || "").trim().replace(/\s+/g, " ");
  }

  function shouldUseProfileCareerOverview(draft, source, profileOverview) {
    if (!profileOverview) return false;

    const currentSummary = String(draft?.summary ?? "").trim();
    const syncedBio = String(draft?.profileBioSynced ?? "").trim();

    if (!currentSummary) return true;
    if (normalizeOverviewText(currentSummary) === normalizeOverviewText(profileOverview)) return true;
    if (syncedBio && normalizeOverviewText(currentSummary) === normalizeOverviewText(syncedBio)) {
      return true;
    }
    if (draft?.profileBioSynced === undefined && profileOverview) return true;
    if (draft?.profileBioSynced === undefined && currentSummary === buildFallbackSummary(source)) {
      return true;
    }

    return false;
  }

  function buildAutoHeadline(source) {
    const { qualification, rank } = source.profile;
    if (qualification && rank) return `${rank} · ${qualification}`;
    return qualification || rank || "Maritime Professional";
  }

  function getDefaultSections() {
    return {
      showCerts: true,
      showEducation: true,
      showHighlights: true,
      showContact: true,
      showReferences: true,
      showSalary: false,
      showSeavBranding: true
    };
  }

  const CV_TEMPLATE = "seav";

  function createDefaultDraft(source, template = CV_TEMPLATE) {
    const vesselEntries = {};
    source.vessels.forEach((vessel) => {
      vesselEntries[vessel.id] = {
        included: true,
        includeBio: Boolean(getVesselExperience(vessel)),
        bullets: buildAutoBullets(vessel, source.onboard).join("\n")
      };
    });

    const profileOverview = getProfileCareerOverview(source);

    return {
      template: CV_TEMPLATE,
      summary: buildAutoSummary(source),
      profileBioSynced: profileOverview,
      headline: buildAutoHeadline(source),
      sections: getDefaultSections(),
      vessels: vesselEntries,
      vesselOrder: source.vessels.map((v) => v.id),
      updatedAt: new Date().toISOString()
    };
  }

  function syncDraftWithSource(draft, source) {
    const next = {
      ...draft,
      sections: { ...getDefaultSections(), ...(draft.sections || {}) },
      vessels: { ...(draft.vessels || {}) },
      vesselOrder: Array.isArray(draft.vesselOrder) ? [...draft.vesselOrder] : []
    };

    const sourceIds = new Set(source.vessels.map((v) => v.id));

    source.vessels.forEach((vessel) => {
      if (!next.vessels[vessel.id]) {
        next.vessels[vessel.id] = {
          included: true,
          includeBio: Boolean(getVesselExperience(vessel)),
          bullets: buildAutoBullets(vessel, source.onboard).join("\n")
        };
        next.vesselOrder.unshift(vessel.id);
      } else if (next.vessels[vessel.id].includeBio === undefined) {
        next.vessels[vessel.id].includeBio = Boolean(getVesselExperience(vessel));
      }
    });

    next.vesselOrder = next.vesselOrder.filter((id) => sourceIds.has(id));
    source.vessels.forEach((vessel) => {
      if (!next.vesselOrder.includes(vessel.id)) {
        next.vesselOrder.push(vessel.id);
      }
    });

    const vesselMap = new Map(source.vessels.map((v) => [v.id, v]));
    next.vesselOrder.sort((a, b) =>
      compareVesselsChronologicalDesc(vesselMap.get(a), vesselMap.get(b))
    );

    const profileOverview = getProfileCareerOverview(source);

    if (shouldUseProfileCareerOverview(draft, source, profileOverview)) {
      next.summary = profileOverview;
    } else if (!next.summary) {
      next.summary = buildAutoSummary(source);
    }

    if (profileOverview) {
      next.profileBioSynced = profileOverview;
    }

    if (!next.headline) next.headline = buildAutoHeadline(source);
    next.template = CV_TEMPLATE;

    return next;
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(KEYS.CV_DRAFT);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function saveDraft(draft) {
    const payload = { ...draft, updatedAt: new Date().toISOString() };
    localStorage.setItem(KEYS.CV_DRAFT, JSON.stringify(payload));
    return payload;
  }

  function resetDraftFromSource(source) {
    const draft = createDefaultDraft(source);
    return saveDraft(draft);
  }

  function getOrderedVessels(source, draft) {
    const order = draft.vesselOrder?.length
      ? draft.vesselOrder
      : source.vessels.map((v) => v.id);

    const map = new Map(source.vessels.map((v) => [v.id, v]));
    return order
      .map((id) => map.get(id))
      .filter(Boolean)
      .filter((vessel) => draft.vessels?.[vessel.id]?.included !== false)
      .sort(compareVesselsChronologicalDesc);
  }

  function getCertStrip(certs, maxCount = 8) {
    const seen = new Set();
    const items = [];

    certs.forEach((cert) => {
      const label = getCertDisplayName(cert);
      const key = normalizeCode(cert?.code || label);
      if (!label || seen.has(key)) return;
      seen.add(key);
      items.push({ cert, label });
    });

    return items
      .sort((a, b) => certPriority(a.cert) - certPriority(b.cert))
      .slice(0, maxCount)
      .map((item) => item.label);
  }

  function getSpecialistQualificationItems(source) {
    return source.specialist
      .filter((entry) => {
        const title = String(entry.title || getSpecialistCategoryLabel(entry.category) || "").trim();
        return title.length > 0;
      })
      .map((entry) => ({
        year: formatYear(entry.dateObtained),
        title: entry.title || getSpecialistCategoryLabel(entry.category) || "Qualification",
        org: entry.issuingBody || getSpecialistCategoryLabel(entry.category) || "",
        detail: entry.notes || ""
      }));
  }

  function getHighlightLines(source) {
    const seen = new Set();
    const lines = [];

    const addLine = (line) => {
      const text = String(line || "").trim();
      const key = text.toLowerCase();
      if (!text || seen.has(key)) return;
      seen.add(key);
      lines.push(text);
    };

    source.achievements
      .filter((item) => item.title)
      .slice(0, 4)
      .forEach((item) => addLine(item.title));

    source.navigation
      .filter((item) => item.country || item.port)
      .slice(0, 4)
      .forEach((item) => {
        const label = [item.port, item.country].filter(Boolean).join(", ");
        addLine(`Navigation: ${label}`);
      });

    return lines.slice(0, 6);
  }

  function buildCvDocument(source, draft) {
    const sections = { ...getDefaultSections(), ...(draft?.sections || {}) };
    const profile = source.profile;
    const vessels = getOrderedVessels(source, draft).map((vessel) => {
      const entry = draft?.vessels?.[vessel.id] || {};
      const customBullets = splitBullets(entry.bullets);
      const bullets = customBullets.length
        ? customBullets
        : buildAutoBullets(vessel, source.onboard);

      const experienceText = getVesselExperience(vessel);
      const includeBio = entry.includeBio !== false;

      return {
        ...vessel,
        cvRole: getVesselRole(vessel),
        cvMeta: formatVesselMeta(vessel),
        cvDescription: includeBio && experienceText ? experienceText : "",
        cvBullets: bullets.slice(0, 8),
        dateRange: formatCvDateRange(vessel.from, vessel.to)
      };
    });

    const summaryText = String(draft?.summary ?? "").trim() || buildAutoSummary(source);
    const headline =
      String(draft?.headline ?? "").trim() || buildAutoHeadline(source);

    return {
      profile,
      photoUrl: getPhotoUrl(profile),
      headline,
      summaryParagraphs: splitParagraphs(summaryText).length
        ? splitParagraphs(summaryText)
        : summaryText
          ? [summaryText]
          : ["Add a career overview in the CV editor."],
      certStrip: sections.showCerts ? getCertStrip(source.certs, 100) : [],
      specialistQualifications: sections.showEducation
        ? getSpecialistQualificationItems(source)
        : [],
      highlights: sections.showHighlights ? getHighlightLines(source) : [],
      references: sections.showReferences ? getReferenceItems(source) : [],
      vessels,
      sections
    };
  }


  window.SeavCvModel = {
    normalizeCode, escapeHtml, formatCvDate, formatCvDateRange, formatYear,
    splitParagraphs, splitBullets, sortByDateDesc, compareVesselsChronologicalDesc,
    getVesselRole, getVesselType, formatVesselSize, formatVesselMeta, formatVesselSubline,
    formatProfileDob, getReferenceItems, splitProfileLines, certPriority, getCertDisplayName,
    getPhotoUrl, buildCvSource, getVesselExperience, buildAutoBullets,
    getProfileCareerOverview, buildFallbackSummary, buildAutoSummary, normalizeOverviewText,
    shouldUseProfileCareerOverview, buildAutoHeadline, getDefaultSections,
    createDefaultDraft, syncDraftWithSource, loadDraft, saveDraft, resetDraftFromSource,
    getOrderedVessels, getCertStrip, getSpecialistQualificationItems, getHighlightLines,
    buildCvDocument, CV_TEMPLATE, LOGO_SRC
  };
})();