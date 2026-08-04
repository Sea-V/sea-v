// /js/seav-data.js
(function () {
  "use strict";

  /* =========================================================
     STORAGE KEYS
  ========================================================= */

  const KEYS = {
    PROFILE: "seav_profile",
    SEATIMES: "seav_seatimes",
    CERTS: "seav_certs",
    VESSELS: "seav_vessels",
    REFS: "seav_refs",
    NAVIGATION_AREAS: "seav_navigation_areas",
    ACHIEVEMENTS: "seav_achievements",
    TENDERS: "seav_tenders",
    ONBOARD_EXPERIENCES: "seav_onboard_experiences",
    ONBOARD_SKILLS: "seav_onboard_skills",
    HOBBIES_INTERESTS: "seav_hobbies_interests",
    SPECIALIST_QUALIFICATIONS: "seav_specialist_qualifications",
    PAYSLIPS: "seav_payslips",
    CV_DRAFT: "seav_cv_draft"
  };

  const PAYSLIP_CURRENCIES = [
    { value: "GBP", label: "GBP (£)" },
    { value: "EUR", label: "EUR (€)" },
    { value: "USD", label: "USD ($)" },
    { value: "CHF", label: "CHF" },
    { value: "AUD", label: "AUD" },
    { value: "NZD", label: "NZD" },
    { value: "OTHER", label: "Other" }
  ];

  /* UK tax year months (April → March) */
  const PAYSLIP_TAX_YEAR_MONTHS = [
    { value: "04", label: "April" },
    { value: "05", label: "May" },
    { value: "06", label: "June" },
    { value: "07", label: "July" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
    { value: "01", label: "January" },
    { value: "02", label: "February" },
    { value: "03", label: "March" }
  ];

  const SPECIALIST_QUALIFICATION_CATEGORIES = [
    { value: "wellness", label: "Wellness" },
    { value: "fitness", label: "Fitness" },
    { value: "water_sports", label: "Water sports" },
    { value: "hospitality", label: "Hospitality" },
    { value: "medical", label: "Medical" },
    { value: "languages", label: "Languages" },
    { value: "other", label: "Other" }
  ];

  const HOBBIES_INTEREST_CATEGORIES = [
    { value: "sport_fitness", label: "Sport & fitness" },
    { value: "water_sports", label: "Water sports" },
    { value: "outdoors", label: "Outdoors & adventure" },
    { value: "travel", label: "Travel & culture" },
    { value: "music", label: "Music & performance" },
    { value: "arts", label: "Arts & creativity" },
    { value: "food", label: "Food & cooking" },
    { value: "photography", label: "Photography & film" },
    { value: "volunteering", label: "Volunteering & community" },
    { value: "other", label: "Other interest" }
  ];

  const TENDER_PROFICIENCY_LEVELS = [
    { value: "Familiarisation", label: "Familiarisation" },
    { value: "Competent", label: "Competent" },
    { value: "Advanced", label: "Advanced" },
    { value: "Coxswain", label: "Proficient" }
  ];

  const ONBOARD_EXPERIENCE_CATEGORIES = [
    { value: "familiarisation", label: "Vessel familiarisation" },
    { value: "paint_finish", label: "Paint & finishing" },
    { value: "varnish", label: "Varnishing / teak work" },
    { value: "crane", label: "Crane / heavy lift" },
    { value: "deck", label: "Deck operations" },
    { value: "engineering", label: "Engineering / technical" },
    { value: "interior", label: "Interior / galley support" },
    { value: "safety", label: "Safety drills / emergency" },
    { value: "water_toys", label: "Water toys / chase boat" },
    { value: "other", label: "Other onboard skill" }
  ];

  /* =========================================================
     CERTIFICATE LIBRARY
  ========================================================= */

  /* Minimum mandatory — universal baseline for yacht crew */
  const MANDATORY_CERTS = [
    {
      code: "ENG1",
      name: "ENG1 Medical Certificate",
      summary:
        "MCA-approved medical fitness certificate required before joining any vessel."
    },
    {
      code: "PST",
      name: "Personal Survival Techniques (PST)",
      stcwRef: "STCW A-VI/1-1",
      summary:
        "Core BST module — survival at sea, lifejackets, liferafts, and abandon-ship procedures.",
      topics: [
        "Survival at sea",
        "Lifejackets and immersion suits",
        "Liferaft launching and boarding",
        "Abandon ship procedures",
        "Cold water survival techniques"
      ]
    },
    {
      code: "FPFF",
      name: "Fire Prevention and Fire Fighting (FPFF)",
      stcwRef: "STCW A-VI/1-2",
      summary:
        "Core BST module — fire prevention, equipment, and practical firefighting drills.",
      topics: [
        "Causes of fire onboard",
        "Fire prevention measures",
        "Fire extinguishers and firefighting equipment",
        "Breathing apparatus",
        "Practical firefighting exercises in smoke-filled environments"
      ]
    },
    {
      code: "EFA",
      name: "Elementary First Aid (EFA)",
      stcwRef: "STCW A-VI/1-3",
      summary:
        "Core BST module — emergency first response and casualty care at sea.",
      topics: [
        "CPR",
        "Bleeding control",
        "Shock treatment",
        "Casualty assessment",
        "Basic medical emergencies at sea"
      ]
    },
    {
      code: "PSSR",
      name: "Personal Safety and Social Responsibilities (PSSR)",
      stcwRef: "STCW A-VI/1-4",
      summary:
        "Core BST module — safe working practices, pollution prevention, and teamwork onboard.",
      topics: [
        "Safe working practices",
        "Accident prevention",
        "Pollution prevention",
        "Emergency procedures",
        "Teamwork and human relations onboard"
      ]
    },
    {
      code: "PSA",
      name: "Proficiency in Security Awareness (PSA)",
      stcwRef: "STCW A-VI/6-1",
      summary:
        "Usually completed alongside BST for yacht crew — maritime security awareness and reporting.",
      topics: [
        "Maritime security threats",
        "Anti-piracy awareness",
        "Restricted areas",
        "Security reporting procedures"
      ]
    }
  ];

  /* Yacht certificate catalog — grouped for dropdown; also drives RECOMMENDED_CERTS */
  const CERT_CATALOG_GROUPS = [
    {
      label: "Identity & seafarer records",
      certs: [
        { code: "PASSPORT", name: "Passport / Seafarer Identity Document" },
        { code: "DISCHARGE_BOOK", name: "Seaman's Discharge Book" },
        { code: "SEAMAN_BOOK", name: "Seaman's Book / CDC" },
        { code: "VISA_B1B2", name: "US B1/B2 Visa (crew)" }
      ]
    },
    {
      label: "STCW basic & combined training",
      certs: [
        { code: "STCW BST", name: "STCW Basic Safety Training (Full BST)" },
        { code: "STCW A-VI/6-2", name: "Proficiency in Designated Security Duties (PDSD)" },
        { code: "STCW A-VI/5", name: "Ship Security Officer (SSO)" }
      ]
    },
    {
      label: "CoC, rank & MCA yacht qualifications",
      certs: [
        { code: "STCW A-II/1", name: "Certificate of Competency (Deck CoC)" },
        { code: "STCW A-III/1", name: "Certificate of Competency (Engineering CoC)" },
        { code: "STCW A-III/6", name: "Electro-Technical Officer CoC" },
        { code: "MASTER Y200", name: "Master (Code Vessel) <200GT (MCA)" },
        { code: "OOW YACHT", name: "Officer of the Watch (Yacht) <3000GT (MCA)" },
        { code: "CHIEF MATE Y", name: "Chief Mate (Yacht) <3000GT (MCA)" },
        { code: "MASTER Y500", name: "Master (Yacht) <500GT (MCA)" },
        { code: "MASTER Y3000", name: "Master (Yacht) <3000GT (MCA)" },
        // New MCA top-tier deck CoCs (MSN 1858 Amendment 2, launched 18 May
        // 2026) — let yacht-career deck officers progress past 3000GT
        // without needing cargo-ship sea time first.
        { code: "CHIEF MATE Y UNLTD", name: "Chief Mate Unlimited (Yacht) (MCA)" },
        { code: "MASTER Y UNLTD", name: "Master Unlimited (Yacht) (MCA)" },
        // Current MCA "Small Vessel" engineer officer structure (MIN 524,
        // 2021) — replaced the old Y1-4 ticket system below as the route to
        // a new CoC, though many working engineers still hold a legacy
        // Y-ticket, so those stay listed too.
        { code: "EOOW SV", name: "Engineer Officer of the Watch — Small Vessel <3000GT (MCA)" },
        { code: "CE SV500", name: "Chief Engineer (Small Vessel) <500GT (MCA)" },
        { code: "CE SV3000", name: "Chief Engineer (Small Vessel) <3000GT (MCA)" },
        { code: "EDH", name: "Efficient Deck Hand (EDH)" },
        { code: "RFPNW", name: "Rating Forming Part of a Navigational Watch" },
        { code: "RFPEW", name: "Rating Forming Part of an Engineering Watch" },
        { code: "AEC", name: "Approved Engine Course (AEC)" },
        { code: "MEOL", name: "Marine Engine Operators License (MEOL)" },
        { code: "Y1", name: "Yacht Engineer Y1 (MCA, legacy)" },
        { code: "Y2", name: "Yacht Engineer Y2 (MCA, legacy)" },
        { code: "Y3", name: "Yacht Engineer Y3 (MCA, legacy)" },
        { code: "Y4", name: "Yacht Engineer Y4 (MCA, legacy)" },
        // Required for officers without a UK CoC serving on UK/Red-Ensign
        // flagged yachts (REG Code / MCA MSN 1867) — distinct from holding
        // a national CoC, which they keep and carry alongside this.
        { code: "UK CEC", name: "UK Certificate of Equivalent Competency (CEC)" },
        // Distinct from the generic RFPNW/RFPEW watch-rating certs above —
        // the REG Code specifically calls out a Yacht Rating Certificate
        // (STCW II/4) as the yacht-specific version some employers require.
        { code: "YACHT RATING", name: "Yacht Rating Certificate", stcwRef: "STCW II/4" }
      ]
    },
    {
      label: "Navigation, bridge & GMDSS",
      certs: [
        { code: "GMDSS GOC", name: "GMDSS General Operator's Certificate (GOC)", stcwRef: "STCW A-IV/2" },
        { code: "GMDSS ROC", name: "GMDSS Restricted Operator's Certificate (ROC)", stcwRef: "STCW A-IV/2" },
        { code: "ECDIS", name: "ECDIS Generic Training", stcwRef: "STCW A-II/1, A-II/2" },
        { code: "ARPA", name: "Radar / ARPA Operational" },
        { code: "HELM-O", name: "HELM Operational", stcwRef: "STCW A-II/1" },
        { code: "HELM-M", name: "HELM Management", stcwRef: "STCW A-II/2" },
        { code: "NAEST-O", name: "NAEST Operational" },
        { code: "NAEST-M", name: "NAEST Management" },
        { code: "BTM", name: "Bridge Team Management" },
        { code: "BRM", name: "Bridge Resource Management" }
      ]
    },
    {
      label: "Advanced STCW (safety & medical)",
      certs: [
        { code: "STCW A-VI/4-1", name: "Medical First Aid (STCW A-VI/4-1)" },
        { code: "STCW A-VI/4-2", name: "Medical Care (STCW A-VI/4-2)" },
        { code: "STCW A-VI/3", name: "Advanced Fire Fighting (AFF)" },
        { code: "STCW A-VI/2", name: "Proficiency in Survival Craft & Rescue Boats (PSCRB)" },
        { code: "STCW A-VI/2-2", name: "Fast Rescue Boats (FRB)" },
        { code: "STCW HV", name: "High Voltage Training" }
      ]
    },
    {
      label: "Passenger / large-yacht STCW",
      certs: [
        { code: "STCW CROWD", name: "Crowd Management Training" },
        { code: "STCW CRISIS", name: "Crisis Management & Human Behaviour" },
        { code: "STCW PASS SAF", name: "Passenger Safety, Cargo Safety & Hull Integrity" }
      ]
    },
    {
      label: "STCW refresher / update courses",
      certs: [
        { code: "PST UPDATE", name: "Personal Survival Techniques — Update" },
        { code: "FPFF UPDATE", name: "Fire Prevention & Fire Fighting — Update" },
        { code: "AFF UPDATE", name: "Advanced Fire Fighting — Update" },
        { code: "PSCRB UPDATE", name: "Survival Craft & Rescue Boats — Update" },
        { code: "FRB UPDATE", name: "Fast Rescue Boats — Update" }
      ]
    },
    {
      label: "Interior, galley & hospitality",
      certs: [
        { code: "SHIPS COOK", name: "Ship's Cook Certificate (MCA)" },
        { code: "FOOD HYGIENE", name: "Food Hygiene Level 2 / 3" },
        { code: "HACCP", name: "HACCP / Food Safety Management" },
        { code: "WSET", name: "WSET Wine & Spirits Education" },
        { code: "BARISTA", name: "Barista / Coffee Service Certificate" },
        { code: "SILVER SVC", name: "Silver Service / Butler Training" }
      ]
    },
    {
      label: "RYA, watersports & diving",
      certs: [
        { code: "RYA PB2", name: "RYA Powerboat Level 2" },
        { code: "RYA SRC", name: "RYA Short Range Certificate (VHF)" },
        { code: "RYA DAY", name: "RYA Day Skipper" },
        { code: "RYA COASTAL", name: "RYA Coastal Skipper" },
        { code: "RYA YMC", name: "RYA Yachtmaster Coastal" },
        { code: "RYA YMO", name: "RYA Yachtmaster Offshore" },
        { code: "RYA YMOCEAN", name: "RYA Yachtmaster Ocean" },
        { code: "RYA PWC", name: "RYA Personal Watercraft Proficiency (Jet Ski)" },
        { code: "RYA WC", name: "RYA Windsurfing / Watercraft Instructor" },
        { code: "PADI OW", name: "PADI Open Water Diver" },
        { code: "PADI AOW", name: "PADI Advanced Open Water" },
        { code: "PADI RESCUE", name: "PADI Rescue Diver" },
        { code: "PADI DM", name: "PADI Divemaster" },
        { code: "PADI INSTR", name: "PADI Dive Instructor" },
        { code: "WAKE INSTR", name: "Wakeboard / Tow Sports Instructor" },
        { code: "KITE L1", name: "Kitesurfing / Wing Instructor Level 1" }
      ]
    },
    {
      label: "Other common yacht documents",
      certs: [
        { code: "YELLOW FEVER", name: "Yellow Fever Vaccination Certificate" },
        { code: "DRUG TEST", name: "Drug & Alcohol Test Certificate" },
        { code: "STCW ML5", name: "ML5 / ENG1 Equivalent Medical" },
        { code: "GMDSS", name: "GMDSS (legacy code — use GOC/ROC if possible)" }
      ]
    }
  ];

  const RECOMMENDED_CERTS = CERT_CATALOG_GROUPS.flatMap((group) => group.certs || []);

  /* Public profile “Rank & role” — catalog groups only (not full dropdown catalog) */
  const RANK_ROLE_GROUP_LABELS = new Set([
    "Identity & seafarer records",
    "STCW basic & combined training",
    "CoC, rank & MCA yacht qualifications",
    "Navigation, bridge & GMDSS",
    "Advanced STCW (safety & medical)",
    "Passenger / large-yacht STCW"
  ]);

  const RANK_ROLE_LEGACY_CODES = new Set(["GMDSS"]);

  /* Legacy mandatory codes demoted on sync (frontend + optional SQL migration) */
  const DEPRECATED_MANDATORY_CODES = [
    "PASSPORT",
    "STCW A-II/1",
    "GMDSS",
    "STCW A-VI/4-1",
    "STCW A-VI/1",
    "STCW A-VI/6-1"
  ];

  function normalizeCertCode(value) {
    return String(value || "").trim().toUpperCase();
  }

  let certificateCatalogDbRows = null;

  function setCertificateCatalogFromDb(rows) {
    if (!Array.isArray(rows) || !rows.length) return;
    certificateCatalogDbRows = rows;
  }

  function buildCatalogGroupsFromDb(rows) {
    const groups = new Map();
    const sorted = [...rows].sort(
      (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)
    );

    for (const row of sorted) {
      const label =
        String(row.category || "Other certificates").trim() || "Other certificates";
      if (!groups.has(label)) {
        groups.set(label, { label, isMandatory: false, certs: [] });
      }
      const group = groups.get(label);
      if (row.is_mandatory) group.isMandatory = true;
      group.certs.push({ code: row.code, name: row.name, stcwRef: row.stcw_ref || "" });
    }

    const result = [...groups.values()];
    result.sort((a, b) => {
      if (a.isMandatory && !b.isMandatory) return -1;
      if (!a.isMandatory && b.isMandatory) return 1;
      return String(a.label).localeCompare(String(b.label));
    });
    return result;
  }

  function getMandatoryCertTemplate(code) {
    return (
      MANDATORY_CERTS.find(
        (item) => normalizeCertCode(item.code) === normalizeCertCode(code)
      ) || null
    );
  }

  function getCertificateCatalogGroups() {
    if (certificateCatalogDbRows?.length) {
      return buildCatalogGroupsFromDb(certificateCatalogDbRows);
    }

    return [
      {
        label: "Minimum mandatory (yacht crew)",
        isMandatory: true,
        certs: MANDATORY_CERTS.map((item) => ({
          code: item.code,
          name: item.name,
          stcwRef: item.stcwRef || ""
        }))
      },
      ...CERT_CATALOG_GROUPS
    ];
  }

  function getCertificateCatalog() {
    return getCertificateCatalogGroups().flatMap((group) =>
      (group.certs || []).map((cert) => ({
        code: cert.code,
        name: cert.name,
        stcwRef: cert.stcwRef || "",
        isMandatory: !!group.isMandatory,
        isTemplate: true,
        group: group.label
      }))
    );
  }

  function findCertificateCatalogItem(code) {
    const normalized = normalizeCertCode(code);
    return (
      getCertificateCatalog().find(
        (item) => normalizeCertCode(item.code) === normalized
      ) || null
    );
  }

  function isSavedCert(cert) {
    if (!cert) return false;
    if (cert.name && String(cert.name).trim()) {
      if (!cert.isTemplate) return true;
      const hasFile =
        window.SeavApiCore?.hasStoredFile?.(cert.attachment) ??
        !!(cert.attachment?.url || cert.attachment?.dataUrl || cert.attachment?.path);
      if (cert.expiry || cert.noExpiry || hasFile) return true;
    }
    return false;
  }

  function getSavedCertificates(certs) {
    return (certs || []).filter(isSavedCert);
  }

  function findCertByCode(certs, code) {
    const target = normalizeCertCode(code);
    return (certs || []).find((item) => normalizeCertCode(item.code) === target) || null;
  }

  function findSavedCertByCode(certs, code) {
    const cert = findCertByCode(certs, code);
    return isSavedCert(cert) ? cert : null;
  }

  // Powers the profile page's "Current Qualification" dropdown — deliberately
  // narrower than isRankRoleCert (which also covers STCW basic/combined
  // training, GMDSS, ECDIS/bridge courses, etc. for the public profile's
  // "Rank & role" section). This should only match an actual command/
  // engineering rank ticket (a CoC), never a medical, safety, security, or
  // ancillary course cert — e.g. ENG1 is a fitness certificate, not a rank.
  //
  // Matches on the cert's NAME rather than a fixed code whitelist. Real saved
  // cert rows don't reliably carry the exact catalog codes above — seed/
  // demo data and certs a crew member free-typed on the Certificates page
  // commonly use their own codes (e.g. "CHIEF_MATE_3000", "PWO_Y") even
  // though the name is clearly a real CoC. Matching the human-readable name
  // is what stays robust against that drift.
  const CURRENT_QUALIFICATION_NAME_PATTERN =
    /\b(master|chief mate|officer of the watch|certificate of competency|electro-technical officer|yachtmaster|day skipper|coastal skipper|powerboat level ?2|chief engineer|yacht engineer y[1-4]|eoow)\b/i;

  function isCurrentQualificationCert(cert) {
    if (!cert) return false;
    const name = String(cert.name || "").trim();
    if (!name) return false;
    return CURRENT_QUALIFICATION_NAME_PATTERN.test(name);
  }

  /* =========================================================
     USERNAME HELPERS (public profile vanity link, e.g. /u/daniel-whitfield)
  ========================================================= */

  // Obvious top-level routes/terms that would be a confusing or misleading
  // username even though they'd pass the format check below.
  const USERNAME_RESERVED = new Set([
    "admin", "api", "app", "dashboard", "profile", "login", "logout",
    "signup", "signin", "index", "about", "contact", "privacy", "terms",
    "support", "help", "null", "undefined", "test", "demo", "sea-v", "seav"
  ]);

  // Mirrors the DB check constraint in docs/schema-username.sql
  // (profile_username_format): lowercase letters/digits/hyphens, 3-30
  // chars, no leading/trailing/consecutive hyphens.
  const USERNAME_FORMAT_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

  /** Turns free text (typically profile.name) into a clean username candidate. */
  function slugifyUsername(value) {
    const slug = String(value || "")
      .normalize("NFKD")
      .replace(new RegExp("[\\u0300-\\u036f]", "g"), "") // strip combining accents (e.g. é -> e)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30)
      .replace(/-+$/g, ""); // slice() can leave a trailing hyphen mid-word
    return slug;
  }

  /** True if `value` could be saved as a username as-is (already slug-shaped). */
  function isValidUsername(value) {
    const v = String(value || "");
    if (v.length < 3 || v.length > 30) return false;
    if (!USERNAME_FORMAT_PATTERN.test(v)) return false;
    if (USERNAME_RESERVED.has(v)) return false;
    return true;
  }

  function isRankRoleCert(cert) {
    if (!cert) return false;
    const mandatoryCodes = MANDATORY_CERTS.map((item) => normalizeCertCode(item.code));
    if (mandatoryCodes.includes(normalizeCertCode(cert.code))) return false;

    const item = findCertificateCatalogItem(cert.code);
    if (item && RANK_ROLE_GROUP_LABELS.has(item.group)) return true;
    return RANK_ROLE_LEGACY_CODES.has(normalizeCertCode(cert.code));
  }

  /* Legacy / duplicate rows hidden from Additional certificates */
  function isSuppressedAdditionalCert(cert) {
    if (!cert) return true;

    const code = normalizeCertCode(cert.code);
    const name = String(cert.name || "").trim().toLowerCase();

    if (DEPRECATED_MANDATORY_CODES.includes(code)) return true;

    if (getMandatoryCertTemplate(code) && !cert.isMandatory) return true;

    if (/basic safety training|\(\s*bst\s*\)|\bbst\b/.test(name)) return true;

    if (/security awareness|proficiency in security awareness/.test(name) && code !== "PSA") {
      return true;
    }

    return false;
  }

  function renderMandatoryCertDetailHtml(code) {
    const template = getMandatoryCertTemplate(code);
    if (!template) return "";

    const stcwLine = template.stcwRef
      ? `<p class="cert-module-guide-intro">STCW reference: ${template.stcwRef}</p>`
      : "";
    const summaryLine = template.summary
      ? `<p class="cert-module-guide-intro">${template.summary}</p>`
      : "";
    const topicsHtml = (template.topics || []).length
      ? `<ul class="cert-module-guide-topics">${(template.topics || [])
          .map((topic) => `<li>${topic}</li>`)
          .join("")}</ul>`
      : "";

    if (!stcwLine && !summaryLine && !topicsHtml) return "";

    return `
      <div class="cert-module-guide">
        <div class="cert-module-guide-head">
          ${summaryLine}
          ${stcwLine}
        </div>
        ${topicsHtml}
      </div>
    `;
  }

  /* =========================================================
     ID HELPERS
  ========================================================= */

  function createId(prefix = "item") {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /* =========================================================
     DEFAULT SHAPES
  ========================================================= */

const DEFAULT_PROFILE = {
  id: "default-profile",
  publicEnabled: false,
  name: "",
  rank: "",
  qualification: "",
  nationality: "",
  dob: "",
  location: "",
  email: "",
  phone: "",
  availability: "Available Immediately",
  passportsHeld: "",
  visasHeld: "",
  salary: "",
  bio: "",
  photo: null
};

function getEmptySeatimeEntry() {
  return {
    id: createId("seatime"),
    vesselId: "",
    vesselName: "",
    flag: "",
    gt: "",
    imoOfficialNumber: "",
    capacityServed: "",
    dateJoined: "",
    dateLeft: "",
    actualSeaServiceDays: 0,
    standbyServiceDays: 0,
    yardServiceDays: 0,
    watchkeepingDays: 0,
    verificationStatus: "Logged",
    notes: "",
    attachment: null,
    createdAt: "",
    updatedAt: ""
  };
}

  function getEmptyVesselEntry() {
    return {
      id: createId("vessel"),
      name: "",
      flag: "",
      gt: "",
      builder: "",
      imoOfficialNumber: "",
      type: "",
      role: "",
      program: "",
      desc: "",
      from: "",
      to: "",
      photo: null
    };
  }

  function getEmptyReferenceEntry() {
    return {
      id: createId("ref"),
      name: "",
      title: "",
      email: "",
      vesselId: "",
      vessel: "",
      role: "",
      period: "",
      text: "",
      date: "",
      status: "Draft",
      attachment: null,
      verification: {
        confirmed: false,
        note: "",
        rank: "",
        cocNumber: "",
        signatureName: "",
        signedAt: ""
      }
    };
  }

  function getEmptyCertificateEntry() {
    return {
      id: createId("cert"),
      code: "",
      name: "",
      issued: "",
      expiry: "",
      status: "Missing",
      attachment: null,
      isMandatory: false,
      isTemplate: false,
      showOnCv: true,
      noExpiry: false
    };
  }

  function getEmptyAchievementEntry() {
    return {
      id: createId("achievement"),
      code: "",
      title: "",
      category: "",
      vesselId: "",
      vessel: "",
      date: "",
      status: "Draft",
      witnessName: "",
      witnessPosition: "",
      witnessEmail: "",
      witnessCocNumber: "",
      description: "",
      attachment: null
    };
  }


function getEmptyOnboardExperienceEntry() {
  return {
    id: createId("onboard"),
    vesselId: "",
    category: "",
    title: "",
    description: "",
    locationOnboard: "",
    positionHeld: "",
    dateFrom: "",
    dateTo: "",
    hours: 0,
    isFamiliarisation: false,
    status: "Draft",
    signoff: {
      confirmed: false,
      note: "",
      signatoryName: "",
      signatoryRank: "",
      signatoryEmail: "",
      cocNumber: "",
      signatureName: "",
      signedAt: ""
    },
    attachment: null,
    createdAt: "",
    updatedAt: ""
  };
}

function getOnboardCategoryLabel(value) {
  const match = ONBOARD_EXPERIENCE_CATEGORIES.find(
    (item) => item.value === value
  );
  return match?.label || value || "—";
}

/* =========================================================
   ONBOARD SKILLS — self-assessed skills profile
   Deck/Officer, Engineering, and Bridge Equipment (scope expanded with
   Jack 2026-08-02 after a full review against the Yotspot source list —
   nothing trimmed, everything reviewed added). Separate from the dated/
   signed-off Onboard Experience logbook above: this is a fast tap-to-rate
   skills snapshot, no vessel/dates/sign-off.
   "Navigation and radar systems" moved out of Engineering into the new
   Bridge Equipment category, broken into its actual instruments
   (radar/ARPA, ECDIS, GPS, etc) instead of one vague line.
========================================================= */

const ONBOARD_SKILL_CATEGORIES = [
  { value: "deck", label: "Deck / Officer" },
  { value: "engineering", label: "Engineering" },
  { value: "bridge", label: "Bridge Equipment" }
];

const ONBOARD_SKILL_CATALOG = {
  deck: [
    "General repairs and maintenance",
    "Teak deck care",
    "Painting",
    "Varnishing",
    "Carpentry",
    "Filling and fairing",
    "Rigging",
    "Whipping and splicing",
    "Line handling",
    "Docking and mooring",
    "Anchor handling",
    "Crane operation",
    "Tender maintenance",
    "Tender driving",
    "Small boat handling",
    "Piloting and manoeuvring",
    "Sail handling and trimming",
    "Sail repairs",
    "Watchkeeping (navigation and seamanship)",
    "Passage planning and chart work",
    "COLREGs and navigation rules",
    "Underwater maintenance",
    "Scuba diving and water sports",
    "Crew management and leadership",
    "Safety and emergency response",
    "Firefighting systems and drills",
    "Ship security",
    "ISM / ISPS management and procedures",
    "Helicopter operations",
    "Helicopter refuelling"
  ],
  engineering: [
    "Diesel engines",
    "Diesel-electric propulsion",
    "Mechanical systems",
    "Generators and alternators",
    "Electrical systems",
    "High voltage systems and safety",
    "Hydraulic systems",
    "Electro-hydraulic controls",
    "Refrigeration",
    "Air conditioning",
    "Water makers",
    "Water and waste treatment",
    "Ballast systems",
    "Plumbing systems",
    "Gearboxes",
    "Steering gear",
    "Propeller systems",
    "Bow thruster",
    "Stabilisers",
    "Dynamic positioning systems",
    "Automation and control systems (PLC/SCADA)",
    "AV and IT",
    "Cybersecurity",
    "Planned maintenance software (AMOS, IDEA, TRITON etc)",
    "Fuel cell systems",
    "Biodiesel fuel",
    "Solar power",
    "Gas fuel / tri-fuel systems"
  ],
  bridge: [
    "Radar / ARPA",
    "ECDIS",
    "GPS / GNSS",
    "AIS",
    "Autopilot",
    "Gyrocompass and magnetic compass",
    "Echo sounder / depth sounder",
    "Speed log",
    "VHF radio and GMDSS",
    "Satellite communications (VSAT / FleetBroadband)",
    "Chart plotter",
    "Voyage data recorder (VDR)",
    "Bridge navigational watch alarm system (BNWAS)",
    "Weather routing and forecasting tools",
    "CCTV and bridge monitoring systems"
  ]
};

const ONBOARD_SKILL_RATING_LABELS = {
  1: "Novice",
  2: "Some experience",
  3: "Competent",
  4: "Very good",
  5: "Proficient"
};

function getOnboardSkillCategoryLabel(value) {
  const match = ONBOARD_SKILL_CATEGORIES.find((item) => item.value === value);
  return match?.label || value || "—";
}

function getOnboardSkillsForCategory(category) {
  return ONBOARD_SKILL_CATALOG[category] || [];
}

function getOnboardSkillRatingLabel(rating) {
  return ONBOARD_SKILL_RATING_LABELS[toNumber(rating)] || "";
}

function getEmptyOnboardSkillEntry() {
  return {
    id: createId("skill"),
    category: "",
    skill: "",
    rating: 0,
    note: "",
    createdAt: "",
    updatedAt: ""
  };
}

function getEmptyHobbyInterestEntry() {
  return {
    id: createId("hobby"),
    category: "",
    title: "",
    description: "",
    dateFrom: "",
    dateTo: "",
    status: "Published",
    photos: [],
    createdAt: "",
    updatedAt: ""
  };
}

function getHobbyInterestCategoryLabel(value) {
  const match = HOBBIES_INTEREST_CATEGORIES.find((item) => item.value === value);
  return match?.label || value || "—";
}

// Single source of truth for hobby/interest status color — was previously
// copy-pasted in js/hobbies-interests.js (edit page); the dashboard snippet
// used a flat unstyled pill regardless of Published vs Draft.
function getHobbyInterestStatusDisplay(status) {
  const map = {
    Published: { label: "Published", className: "pill-valid" },
    Draft: { label: "Draft", className: "pill-neutral" }
  };
  return map[status] || { label: status || "Published", className: "pill-neutral" };
}

function getEmptySpecialistQualificationEntry() {
  return {
    id: createId("specialist"),
    category: "",
    title: "",
    issuingBody: "",
    dateObtained: "",
    expiry: "",
    notes: "",
    attachment: null,
    createdAt: "",
    updatedAt: ""
  };
}

function getSpecialistCategoryLabel(value) {
  const match = SPECIALIST_QUALIFICATION_CATEGORIES.find(
    (item) => item.value === value
  );
  return match?.label || value || "—";
}

function getEmptyPayslipEntry() {
  return {
    id: createId("payslip"),
    taxYear: "",
    payPeriod: "",
    paymentDate: "",
    employer: "",
    vesselId: "",
    grossAmount: "",
    netAmount: "",
    currency: "GBP",
    notes: "",
    attachment: null,
    createdAt: "",
    updatedAt: ""
  };
}

function getUkTaxYearOptions(count = 8) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  let startYear = m > 3 || (m === 3 && d >= 6) ? y : y - 1;

  const options = [];
  for (let i = 0; i < count; i += 1) {
    const sy = startYear - i;
    options.push(`${sy}/${String(sy + 1).slice(-2)}`);
  }
  return options;
}

function inferUkTaxYear(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";

  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const startYear = m > 3 || (m === 3 && d >= 6) ? y : y - 1;
  return `${startYear}/${String(startYear + 1).slice(-2)}`;
}

function parseTaxYearStartYear(taxYear) {
  const match = String(taxYear || "").match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

function normalizePayslipMonth(entry) {
  const raw = String(entry?.payMonth || entry?.payPeriod || "").trim();
  if (/^(0[1-9]|1[0-2])$/.test(raw)) return raw;

  const lower = raw.toLowerCase();
  for (const month of PAYSLIP_TAX_YEAR_MONTHS) {
    if (lower.includes(month.label.toLowerCase())) return month.value;
  }
  return "";
}

function getPayslipMonthLabel(payMonth, taxYear) {
  const month = PAYSLIP_TAX_YEAR_MONTHS.find((item) => item.value === payMonth);
  if (!month) {
    return payMonth || "—";
  }

  const startYear = parseTaxYearStartYear(taxYear);
  if (!startYear) return month.label;

  const calendarYear = Number(payMonth) >= 4 ? startYear : startYear + 1;
  return `${month.label} ${calendarYear}`;
}

function getPayslipMonthsLogged(taxYear, entries = [], excludeEntryId = null) {
  const taken = new Set();
  entries.forEach((entry) => {
    if (!entry || entry.taxYear !== taxYear) return;
    if (excludeEntryId && entry.id === excludeEntryId) return;
    const month = normalizePayslipMonth(entry);
    if (month) taken.add(month);
  });
  return taken;
}

function inferPayslipMonthFromDate(dateStr, taxYear) {
  if (!dateStr || !taxYear) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";

  const monthValue = String(date.getMonth() + 1).padStart(2, "0");
  const inferredTaxYear = inferUkTaxYear(dateStr);
  if (inferredTaxYear !== taxYear) return "";
  return monthValue;
}

function formatMoneyAmount(value, currency = "GBP") {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency === "OTHER" ? "GBP" : currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  } catch {
    return num.toFixed(2);
  }
}

function getTenderProficiencyLabel(value) {
  const match = TENDER_PROFICIENCY_LEVELS.find((item) => item.value === value);
  return match?.label || value || "—";
}

function getTenderProficiencyDisplay(level) {
  // Medal-style progression: no medal yet -> bronze -> silver -> gold,
  // so the four proficiency levels read as increasing skill at a glance
  // (Advanced and Proficient used to both be plain green and looked identical).
  const classNames = {
    Familiarisation: "pill-neutral",
    Competent: "tender-proficiency-pill--bronze",
    Advanced: "tender-proficiency-pill--silver",
    Coxswain: "tender-proficiency-pill--gold"
  };
  const label = getTenderProficiencyLabel(level);
  if (!level || label === "—") return null;
  return {
    label,
    className: classNames[level] || "pill-neutral"
  };
}

function getEmptyTenderEntry() {
  return {
    id: createId("tender"),
    vesselId: "",
    vesselName: "",
    name: "",
    type: "",
    model: "",
    length: "",
    engine: "",
    capacity: "",
    reg: "",
    proficiencyLevel: "",
    desc: "",
    photo: null,
    createdAt: "",
    updatedAt: ""
  };
}

  /* =========================================================
     VALUE HELPERS
  ========================================================= */

  function toNumber(val) {
    const n = Number(val);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  function totalQualifyingDays(entry) {
    return (
      toNumber(entry.actualSeaServiceDays) +
      toNumber(entry.standbyServiceDays) +
      toNumber(entry.yardServiceDays) +
      toNumber(entry.watchkeepingDays)
    );
  }

  /* =========================================================
     DECK CAREER PROGRESSION — shared MSN 1858 sea-service math
     Single source of truth used by BOTH the Sea Time page tracker
     (js/seatime.js) and the OOW/Master achievement badges
     (js/achievements-engine.js), so the two surfaces can never disagree.
     Previously each file computed this independently and had drifted:
     seatime.js capped standby only by "that voyage's own actual sea days";
     achievements-engine.js capped standby only at a flat 14 days. MSN 1858
     SS4.2 actually requires BOTH caps at once ("a maximum of 14 consecutive
     days may be counted at one time, but on no occasion may a period of
     standby service exceed that of the previous voyage") — this version
     applies both.
  ========================================================= */

  function parseLengthMeters(raw) {
    const match = String(raw || "").match(/(\d+(\.\d+)?)/);
    return match ? Number(match[1]) : 0;
  }

  function findVesselById(vessels, vesselId) {
    if (!vesselId) return null;
    return (vessels || []).find((v) => v.id === vesselId) || null;
  }

  function getEntryVesselLengthMeters(entry, vessels) {
    const vessel = findVesselById(vessels, entry?.vesselId);
    return parseLengthMeters(vessel?.vessel_length || vessel?.length || entry?.vesselLength);
  }

  function getEntryVesselGt(entry, vessels) {
    const vessel = findVesselById(vessels, entry?.vesselId);
    return parseLengthMeters(vessel?.gt);
  }

  function daysBetweenDates(startIso, endIso) {
    const start = startIso ? new Date(startIso) : null;
    const end = endIso ? new Date(endIso) : new Date();
    if (!start || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    const ms = end - start;
    return ms > 0 ? Math.round(ms / 86400000) : 0;
  }

  const OOW_QUALIFYING_TARGET = 365;
  const OOW_ACTUAL_MIN = 250;
  const OOW_STANDBY_PER_ENTRY_CAP = 14;
  const OOW_YARD_TOTAL_CAP = 90;
  const OOW_36_MONTHS_TARGET_DAYS = 1095;
  const MASTER_WATCHKEEPING_TARGET = 240;
  const MASTER_SPECIAL_24M_TARGET_MONTHS = 12;
  const MASTER_SPECIAL_500GT_TARGET_MONTHS = 6;
  const DAYS_PER_MONTH = 30.44;

  /**
   * OOW Yachts <3000GT sea-service progress — MSN 1858 (M+F) Amendment 2,
   * section 3.3: 365 days seagoing service on vessels 15m+ load line length,
   * made up of a minimum of 250 days actual sea service plus any combination
   * of actual/standby/yard for the rest, where standby is capped at 14
   * consecutive days AND can never exceed that voyage's own actual sea days,
   * and yard service counts up to a maximum of 90 days total (as a running
   * total across every logged entry, not per entry).
   */
  function computeOowSeaService(seatimes, vessels) {
    let totalActual15m = 0;
    let totalStandby15mCounted = 0;
    let totalYard15mRaw = 0;

    (seatimes || []).forEach((entry) => {
      if (getEntryVesselLengthMeters(entry, vessels) < 15) return;

      const actual = toNumber(entry.actualSeaServiceDays);
      const standby = toNumber(entry.standbyServiceDays);
      const yard = toNumber(entry.yardServiceDays);

      totalActual15m += actual;
      totalStandby15mCounted += Math.min(standby, actual, OOW_STANDBY_PER_ENTRY_CAP);
      totalYard15mRaw += yard;
    });

    const totalYard15mCounted = Math.min(totalYard15mRaw, OOW_YARD_TOTAL_CAP);
    const totalQualifying15m = totalActual15m + totalStandby15mCounted + totalYard15mCounted;
    const actualMet = totalActual15m >= OOW_ACTUAL_MIN;
    const qualifyingMet = totalQualifying15m >= OOW_QUALIFYING_TARGET;

    return {
      totalActual15m,
      totalStandby15mCounted,
      totalYard15mRaw,
      totalYard15mCounted,
      totalQualifying15m,
      actualMet,
      qualifyingMet,
      allMet: actualMet && qualifyingMet,
      ACTUAL_MIN: OOW_ACTUAL_MIN,
      QUALIFYING_TARGET: OOW_QUALIFYING_TARGET,
      YARD_CAP: OOW_YARD_TOTAL_CAP
    };
  }

  /** MSN 1858 SS3.3's 36-month total onboard yacht service (any vessel size, since age 16). */
  function computeOow36MonthsOnboard(seatimes) {
    const totalDays = (seatimes || []).reduce(
      (sum, entry) => sum + totalQualifyingDays(entry),
      0
    );
    return {
      totalDays,
      target: OOW_36_MONTHS_TARGET_DAYS,
      met: totalDays >= OOW_36_MONTHS_TARGET_DAYS
    };
  }

  function isOowSeaTimeComplete(seatimes, vessels) {
    return (
      computeOowSeaService(seatimes, vessels).allMet &&
      computeOow36MonthsOnboard(seatimes).met
    );
  }

  /**
   * Master Yachts <3000GT sea-service progress — MSN 1858 (M+F) Amendment 2,
   * section 3.6(a): while holding OOW <3000GT, 240 days watchkeeping service
   * on vessels 15m+, including either 12 months on vessels 24m+ or 6 months
   * on vessels 500GT+.
   */
  function computeMasterSeaService(seatimes, vessels) {
    let totalWatchkeeping15m = 0;
    let totalOnboard24mDays = 0;
    let totalOnboard500gtDays = 0;

    (seatimes || []).forEach((entry) => {
      const lengthM = getEntryVesselLengthMeters(entry, vessels);
      const gt = getEntryVesselGt(entry, vessels);
      const days = daysBetweenDates(entry.dateJoined, entry.dateLeft);

      if (lengthM >= 15) totalWatchkeeping15m += toNumber(entry.watchkeepingDays);
      if (lengthM >= 24) totalOnboard24mDays += days;
      if (gt >= 500) totalOnboard500gtDays += days;
    });

    const months24m = totalOnboard24mDays / DAYS_PER_MONTH;
    const months500gt = totalOnboard500gtDays / DAYS_PER_MONTH;
    const watchMet = totalWatchkeeping15m >= MASTER_WATCHKEEPING_TARGET;
    const use500gtPath =
      months500gt / MASTER_SPECIAL_500GT_TARGET_MONTHS >
      months24m / MASTER_SPECIAL_24M_TARGET_MONTHS;
    const specialValue = use500gtPath ? months500gt : months24m;
    const specialTarget = use500gtPath
      ? MASTER_SPECIAL_500GT_TARGET_MONTHS
      : MASTER_SPECIAL_24M_TARGET_MONTHS;
    const specialMet =
      months24m >= MASTER_SPECIAL_24M_TARGET_MONTHS ||
      months500gt >= MASTER_SPECIAL_500GT_TARGET_MONTHS;

    return {
      totalWatchkeeping15m,
      totalOnboard24mDays,
      totalOnboard500gtDays,
      months24m,
      months500gt,
      watchMet,
      use500gtPath,
      specialValue,
      specialTarget,
      specialMet,
      allMasterMet: watchMet && specialMet,
      WATCHKEEPING_TARGET: MASTER_WATCHKEEPING_TARGET
    };
  }

  /**
   * Cert-date gating — several upper-tier deck CoCs (Master <200GT, Master
   * <500GT) require sea time earned WHILE ALREADY HOLDING a specific
   * prerequisite certificate (e.g. RYA Yachtmaster Offshore for Master
   * <200GT per MSN 1858 3.1(b); OOW <3000GT for Master <500GT per 3.5(b)) —
   * not just sea time logged at any point in a crew member's career.
   * Certificates already store an `issued` date (js/certificates.js), so
   * this filters Sea Time entries to only those starting on/after it.
   *
   * `held: false` (issued date missing or unparsable) means the gate can't
   * open at all yet — there's no "while holding X" if X isn't held — and
   * callers should treat that as 0% progress, not "0 qualifying days so
   * far out of however many logged."
   */
  function seatimesGatedByCertIssueDate(seatimes, certs, certCode) {
    const cert = findSavedCertByCode(certs, certCode);
    const issuedDate = cert?.issued ? new Date(cert.issued) : null;

    if (!issuedDate || Number.isNaN(issuedDate.getTime())) {
      return { held: false, issuedDate: null, gatedEntries: [] };
    }

    const gatedEntries = (seatimes || []).filter((entry) => {
      const joined = entry.dateJoined ? new Date(entry.dateJoined) : null;
      return joined && !Number.isNaN(joined.getTime()) && joined >= issuedDate;
    });

    return { held: true, issuedDate: cert.issued, gatedEntries };
  }

  // MSN 1858 3.1(b): Master (Code Vessel) <200GT / OOW Yachts <500GT
  // (150nm-from-safe-haven variant) requires 6 months' SEAGOING service
  // while holding RYA Yachtmaster Offshore. "Seagoing service" (3.1's own
  // term, defined generally in 4.2) is actual + stand-by + yard service —
  // deliberately NOT the same figure as "onboard yacht service" (which also
  // counts watchkeeping/other time) used elsewhere in this file. Standby
  // still gets the universal 4.2 per-entry cap; yard has no cap here (the
  // 90-day yard cap is specific to OOW <3000GT's own 115-day sub-clause,
  // not a general rule).
  const MASTER_200GT_TARGET_MONTHS = 6;
  const MASTER_200GT_GATING_CERT_CODE = "RYA YMO";

  function computeMaster200SeaService(seatimes, certs) {
    const gated = seatimesGatedByCertIssueDate(seatimes, certs, MASTER_200GT_GATING_CERT_CODE);

    if (!gated.held) {
      return {
        held: false,
        issuedDate: null,
        totalDays: 0,
        months: 0,
        met: false,
        TARGET_MONTHS: MASTER_200GT_TARGET_MONTHS,
        GATING_CERT_CODE: MASTER_200GT_GATING_CERT_CODE
      };
    }

    let totalDays = 0;
    gated.gatedEntries.forEach((entry) => {
      const actual = toNumber(entry.actualSeaServiceDays);
      const standby = Math.min(toNumber(entry.standbyServiceDays), actual, OOW_STANDBY_PER_ENTRY_CAP);
      const yard = toNumber(entry.yardServiceDays);
      totalDays += actual + standby + yard;
    });

    const months = totalDays / DAYS_PER_MONTH;

    return {
      held: true,
      issuedDate: gated.issuedDate,
      totalDays,
      months,
      met: months >= MASTER_200GT_TARGET_MONTHS,
      TARGET_MONTHS: MASTER_200GT_TARGET_MONTHS,
      GATING_CERT_CODE: MASTER_200GT_GATING_CERT_CODE
    };
  }

  // MSN 1858 3.5(b): Master (Yacht) <500GT requires 12 months' onboard
  // service as a deck officer, including 120 days' watchkeeping service, on
  // vessels 15m or over, while holding OOW Yachts <3000GT. "Onboard service"
  // here means calendar days aboard (dateJoined→dateLeft), not the
  // actual+standby+yard "seagoing service" figure used for Master <200GT —
  // same distinction MSN 1858 draws between 3.1's and 3.5/3.6's requirements.
  const MASTER_500GT_ONBOARD_TARGET_MONTHS = 12;
  const MASTER_500GT_WATCHKEEPING_TARGET = 120;
  const MASTER_500GT_GATING_CERT_CODE = "OOW YACHT";

  function computeMaster500SeaService(seatimes, certs, vessels) {
    const gated = seatimesGatedByCertIssueDate(seatimes, certs, MASTER_500GT_GATING_CERT_CODE);

    if (!gated.held) {
      return {
        held: false,
        issuedDate: null,
        onboardDays: 0,
        onboardMonths: 0,
        watchkeepingDays: 0,
        onboardMet: false,
        watchkeepingMet: false,
        met: false,
        ONBOARD_TARGET_MONTHS: MASTER_500GT_ONBOARD_TARGET_MONTHS,
        WATCHKEEPING_TARGET: MASTER_500GT_WATCHKEEPING_TARGET,
        GATING_CERT_CODE: MASTER_500GT_GATING_CERT_CODE
      };
    }

    let onboardDays = 0;
    let watchkeepingDays = 0;
    gated.gatedEntries.forEach((entry) => {
      const lengthM = getEntryVesselLengthMeters(entry, vessels);
      if (lengthM >= 15) {
        onboardDays += daysBetweenDates(entry.dateJoined, entry.dateLeft);
        watchkeepingDays += toNumber(entry.watchkeepingDays);
      }
    });

    const onboardMonths = onboardDays / DAYS_PER_MONTH;
    const onboardMet = onboardMonths >= MASTER_500GT_ONBOARD_TARGET_MONTHS;
    const watchkeepingMet = watchkeepingDays >= MASTER_500GT_WATCHKEEPING_TARGET;

    return {
      held: true,
      issuedDate: gated.issuedDate,
      onboardDays,
      onboardMonths,
      watchkeepingDays,
      onboardMet,
      watchkeepingMet,
      met: onboardMet && watchkeepingMet,
      ONBOARD_TARGET_MONTHS: MASTER_500GT_ONBOARD_TARGET_MONTHS,
      WATCHKEEPING_TARGET: MASTER_500GT_WATCHKEEPING_TARGET,
      GATING_CERT_CODE: MASTER_500GT_GATING_CERT_CODE
    };
  }

  // MSN 1858 3.6(a): Master (Yacht) <3000GT requires the same 240
  // watchkeeping-days / 24m-or-500GT special-experience math as the
  // ungated `computeMasterSeaService` above (that function backs the Sea
  // Time page's own tracker), but §3.6(a)'s "while holding OOW <3000GT"
  // language means only sea time logged after the OOW <3000GT issue date
  // should count. This is a separate function (not a change to
  // computeMasterSeaService's signature/behaviour) so the already-shipped
  // Sea Time page tracker is untouched — this one backs the Milestones
  // achievement only. Same regulation, same math, correctly gated.
  const MASTER_3000GT_GATING_CERT_CODE = "OOW YACHT";

  function computeMaster3000SeaService(seatimes, certs, vessels) {
    const gated = seatimesGatedByCertIssueDate(seatimes, certs, MASTER_3000GT_GATING_CERT_CODE);

    if (!gated.held) {
      return {
        held: false,
        issuedDate: null,
        totalWatchkeeping15m: 0,
        totalOnboard24mDays: 0,
        totalOnboard500gtDays: 0,
        months24m: 0,
        months500gt: 0,
        watchMet: false,
        use500gtPath: false,
        specialValue: 0,
        specialTarget: MASTER_SPECIAL_24M_TARGET_MONTHS,
        specialMet: false,
        allMasterMet: false,
        WATCHKEEPING_TARGET: MASTER_WATCHKEEPING_TARGET,
        GATING_CERT_CODE: MASTER_3000GT_GATING_CERT_CODE
      };
    }

    let totalWatchkeeping15m = 0;
    let totalOnboard24mDays = 0;
    let totalOnboard500gtDays = 0;

    gated.gatedEntries.forEach((entry) => {
      const lengthM = getEntryVesselLengthMeters(entry, vessels);
      const gt = getEntryVesselGt(entry, vessels);
      const days = daysBetweenDates(entry.dateJoined, entry.dateLeft);

      if (lengthM >= 15) totalWatchkeeping15m += toNumber(entry.watchkeepingDays);
      if (lengthM >= 24) totalOnboard24mDays += days;
      if (gt >= 500) totalOnboard500gtDays += days;
    });

    const months24m = totalOnboard24mDays / DAYS_PER_MONTH;
    const months500gt = totalOnboard500gtDays / DAYS_PER_MONTH;
    const watchMet = totalWatchkeeping15m >= MASTER_WATCHKEEPING_TARGET;
    const use500gtPath =
      months500gt / MASTER_SPECIAL_500GT_TARGET_MONTHS >
      months24m / MASTER_SPECIAL_24M_TARGET_MONTHS;
    const specialValue = use500gtPath ? months500gt : months24m;
    const specialTarget = use500gtPath
      ? MASTER_SPECIAL_500GT_TARGET_MONTHS
      : MASTER_SPECIAL_24M_TARGET_MONTHS;
    const specialMet =
      months24m >= MASTER_SPECIAL_24M_TARGET_MONTHS ||
      months500gt >= MASTER_SPECIAL_500GT_TARGET_MONTHS;

    return {
      held: true,
      issuedDate: gated.issuedDate,
      totalWatchkeeping15m,
      totalOnboard24mDays,
      totalOnboard500gtDays,
      months24m,
      months500gt,
      watchMet,
      use500gtPath,
      specialValue,
      specialTarget,
      specialMet,
      allMasterMet: watchMet && specialMet,
      WATCHKEEPING_TARGET: MASTER_WATCHKEEPING_TARGET,
      GATING_CERT_CODE: MASTER_3000GT_GATING_CERT_CODE
    };
  }

  // MSN 1858 Amendment 2 (2026) — the new "Yacht Unlimited" pathway lets
  // yacht deck officers progress beyond 3000GT on yacht sea time alone.
  // Each rung has two routes: one via a Merchant Navy (non-yacht) ticket
  // SEA-V doesn't catalog or track at all (OOW Unlimited / Chief Mate
  // Unlimited / SMEOL), and a "direct" yacht-only route. Only the direct
  // routes are trackable here — the Merchant Navy routes are simply
  // unreachable in SEA-V until Merchant Navy ticket tracking is added.

  // Chief Mate Yachts Unlimited, direct route: genuinely HOLDING the
  // Master Yachts <3000GT Certificate of Competency qualifies on its own —
  // no extra sea time beyond what's already logged for Master <3000GT
  // itself. Deliberately checks the saved CERTIFICATE (the exam/oral has
  // actually happened), not just the Master <3000GT sea-time milestone
  // above being met — those are two different things.
  const CHIEF_MATE_UNLIMITED_GATING_CERT_CODE = "MASTER Y3000";

  function computeChiefMateUnlimitedEligibility(certs) {
    const cert = findSavedCertByCode(certs, CHIEF_MATE_UNLIMITED_GATING_CERT_CODE);
    return {
      held: !!cert,
      issuedDate: cert?.issued || null,
      met: !!cert,
      GATING_CERT_CODE: CHIEF_MATE_UNLIMITED_GATING_CERT_CODE
    };
  }

  // Master Yachts Unlimited, via-Master-<3000GT route: while holding Master
  // Yachts <3000GT, 6 months served in the MASTER capacity (incl. 3 months
  // actual sea) on vessels 500GT or over. "Served in the Master capacity"
  // is read from each Sea Time entry's free-text `capacityServed` field
  // (case-insensitive whole-word match on "master") — Sea Time has no
  // structured rank field, so this is best-effort text matching against
  // whatever the crew member typed, not a guaranteed-accurate rank record.
  // Two other Master Yachts Unlimited routes exist (via Chief Mate Yachts
  // Unlimited or OOW Unlimited) but both need a Merchant Navy ticket SEA-V
  // doesn't track — not represented here.
  const MASTER_UNLIMITED_GATING_CERT_CODE = "MASTER Y3000";
  const MASTER_UNLIMITED_ONBOARD_TARGET_MONTHS = 6;
  const MASTER_UNLIMITED_ACTUAL_SEA_TARGET_MONTHS = 3;
  const MASTER_UNLIMITED_MIN_GT = 500;
  const MASTER_CAPACITY_MATCH = /\bmaster\b/i;

  function computeMasterUnlimitedSeaService(seatimes, certs, vessels) {
    const gated = seatimesGatedByCertIssueDate(seatimes, certs, MASTER_UNLIMITED_GATING_CERT_CODE);

    if (!gated.held) {
      return {
        held: false,
        issuedDate: null,
        onboardDays: 0,
        onboardMonths: 0,
        actualSeaDays: 0,
        actualSeaMonths: 0,
        onboardMet: false,
        actualSeaMet: false,
        met: false,
        ONBOARD_TARGET_MONTHS: MASTER_UNLIMITED_ONBOARD_TARGET_MONTHS,
        ACTUAL_SEA_TARGET_MONTHS: MASTER_UNLIMITED_ACTUAL_SEA_TARGET_MONTHS,
        GATING_CERT_CODE: MASTER_UNLIMITED_GATING_CERT_CODE
      };
    }

    let onboardDays = 0;
    let actualSeaDays = 0;
    gated.gatedEntries.forEach((entry) => {
      const gt = getEntryVesselGt(entry, vessels);
      const servedAsMaster = MASTER_CAPACITY_MATCH.test(entry.capacityServed || "");
      if (gt >= MASTER_UNLIMITED_MIN_GT && servedAsMaster) {
        onboardDays += daysBetweenDates(entry.dateJoined, entry.dateLeft);
        actualSeaDays += toNumber(entry.actualSeaServiceDays);
      }
    });

    const onboardMonths = onboardDays / DAYS_PER_MONTH;
    const actualSeaMonths = actualSeaDays / DAYS_PER_MONTH;
    const onboardMet = onboardMonths >= MASTER_UNLIMITED_ONBOARD_TARGET_MONTHS;
    const actualSeaMet = actualSeaMonths >= MASTER_UNLIMITED_ACTUAL_SEA_TARGET_MONTHS;

    return {
      held: true,
      issuedDate: gated.issuedDate,
      onboardDays,
      onboardMonths,
      actualSeaDays,
      actualSeaMonths,
      onboardMet,
      actualSeaMet,
      met: onboardMet && actualSeaMet,
      ONBOARD_TARGET_MONTHS: MASTER_UNLIMITED_ONBOARD_TARGET_MONTHS,
      ACTUAL_SEA_TARGET_MONTHS: MASTER_UNLIMITED_ACTUAL_SEA_TARGET_MONTHS,
      GATING_CERT_CODE: MASTER_UNLIMITED_GATING_CERT_CODE
    };
  }

  function getSeatimeTotals(entries) {
    const totals = {
      sea: 0,
      standby: 0,
      yard: 0,
      watchkeeping: 0,
      total: 0
    };

    (entries || []).forEach((entry) => {
      totals.sea += toNumber(entry.actualSeaServiceDays);
      totals.standby += toNumber(entry.standbyServiceDays);
      totals.yard += toNumber(entry.yardServiceDays);
      totals.watchkeeping += toNumber(entry.watchkeepingDays);
    });

    totals.total =
      totals.sea +
      totals.standby +
      totals.yard +
      totals.watchkeeping;

    return totals;
  }

  // Single source of truth for the Sea Time verification-status pill —
  // was previously just `<span class="pill">${status}</span>` in both
  // js/seatime.js and js/dashboard-snippets.js, which meant the pill got
  // the shared .pill base styling (outline only, no fill) with no color
  // at all. Dedicated classes mirror the same pattern already used for
  // reference-verified-pill/reference-sent-pill/reference-declined-pill
  // (css/pages/seatime.css has the actual color rules; css/components/
  // pills.css lists these class names in the shared pill base selector
  // for the shape/white-text/shadow that every pill gets).
  function getSeatimeVerificationDisplay(status) {
    const map = {
      Verified: { label: "Verified", className: "seatime-verified-pill" },
      "Pending Verification": {
        label: "Pending Verification",
        className: "seatime-pending-pill"
      },
      Logged: { label: "Logged", className: "seatime-logged-pill" }
    };
    return map[status] || map.Logged;
  }

  function isProfilePublic(profile) {
    if (!profile) return false;

    const value = profile.publicEnabled ?? profile.isPublic ?? profile.public_enabled;

    if (value === true || value === 1) return true;
    if (value === false || value === 0 || value === null || value === undefined) return false;

    const text = String(value).trim().toLowerCase();
    return text === "true" || text === "t" || text === "yes" || text === "1";
  }

  function formatDatePretty(dateStr) {
  if (!dateStr) return "—";

  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;

  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

  /**
   * Shared text-truncation helper — was independently copy-pasted (with
   * slightly different default lengths) in dashboard-snippets.js,
   * public-profile-utils.js (as `truncate`), and references.js. Each caller
   * still passes its own `max`, so behavior/output is unchanged; only the
   * duplicated logic is centralized.
   */
  function truncateText(text, max = 140) {
    const value = String(text || "").trim();
    if (!value) return "";
    if (value.length <= max) return value;
    return `${value.slice(0, max).trim()}…`;
  }

  /* =========================================================
     CERTIFICATE HELPERS
  ========================================================= */

  function isCertNoExpiry(cert) {
    if (!cert) return false;
    if (cert.noExpiry) return true;
    return String(cert.status || "").trim().toLowerCase() === "no expiry";
  }

  function isCertExpiringOrExpired(cert, warningDays = 90) {
    if (!cert || isCertNoExpiry(cert) || !cert.expiry) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const exp = new Date(cert.expiry);
    if (Number.isNaN(exp.getTime())) return false;
    exp.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
    return diffDays <= warningDays;
  }

  function getCertExpiryInfo(expiry, options = {}) {
    const warningDays = options.warningDays ?? 90;

    if (!expiry) {
      return {
        label: "No Expiry",
        badge: "No Expiry",
        sortValue: 999999,
        statusClass: "pill pill-neutral"
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const exp = new Date(expiry);
    exp.setHours(0, 0, 0, 0);

    const diffMs = exp - today;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        label: "Expired",
        badge: "Expired",
        sortValue: diffDays,
        statusClass: "pill pill-expired"
      };
    }

    if (diffDays <= warningDays) {
      return {
        label: `Expires in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
        badge: "Expires Soon",
        sortValue: diffDays,
        statusClass: "pill pill-warning"
      };
    }

    return {
      label: `Valid for ${diffDays} day${diffDays === 1 ? "" : "s"}`,
      badge: "Valid",
      sortValue: diffDays,
      statusClass: "pill pill-valid"
    };
  }

  /* =========================================================
     VESSEL HELPERS
  ========================================================= */

  function getCurrentVesselIndex(vessels) {
    if (!Array.isArray(vessels) || !vessels.length) return -1;

    let currentIndex = vessels.findIndex((v) => !v.to || !String(v.to).trim());

    if (currentIndex !== -1) return currentIndex;

    currentIndex = vessels.reduce((latestIdx, vessel, idx, arr) => {
      const currentDate = vessel.to ? new Date(vessel.to) : new Date(0);
      const latestDate = arr[latestIdx].to ? new Date(arr[latestIdx].to) : new Date(0);
      return currentDate > latestDate ? idx : latestIdx;
    }, 0);

    return currentIndex;
  }

  function getVesselHistory(vessels) {
    if (!Array.isArray(vessels) || !vessels.length) return [];

    const currentIndex = getCurrentVesselIndex(vessels);

    return vessels
      .map((v, idx) => ({ ...v, _originalIndex: idx }))
      .filter((_, idx) => idx !== currentIndex)
      .sort((a, b) => {
        const da = a.from ? new Date(a.from) : new Date(0);
        const db = b.from ? new Date(b.from) : new Date(0);
        return db - da;
      });
  }

function getSortedVesselOptions(vessels = []) {
  return [...(vessels || [])]
    .sort((a, b) => {
      const da = a.from ? new Date(a.from) : new Date(0);
      const db = b.from ? new Date(b.from) : new Date(0);
      return db - da;
    })
    .map((v) => ({
      id: v.id || "",
      name: v.name || "Unnamed Vessel"
    }));
}

  // Same muted jewel-tone family as the rest of the app (moderate
  // saturation, medium-dark lightness — no stock saturated primaries), but
  // hues are spaced using a golden-angle sequence (~137.5° apart) instead of
  // picked from other pages' accents. That previous approach clustered
  // several colors within 10-15° of each other (three near-identical blues,
  // three near-identical teals/greens, three near-identical golds), so with
  // more than a couple of vessels the nav-map lines became hard to tell
  // apart. Golden-angle spacing guarantees every prefix of this list (i.e.
  // the common case of 2-6 vessels) stays maximally spread around the hue
  // wheel, not just the full set of 13. Keep in sync with the fallback copy
  // in navigation-helpers.js.
  const VESSEL_COLORS = [
    "#2f70b1", // ocean blue
    "#b12f4a", // crimson
    "#2fb13a", // emerald green
    "#602fb1", // violet
    "#b1862f", // amber gold
    "#2fb1ac", // teal
    "#b12f91", // magenta
    "#6bb12f", // lime green
    "#2f45b1", // indigo
    "#b1402f", // rust orange
    "#2fb166", // jade green
    "#8c2fb1", // purple
    "#b1b12f"  // olive
  ];

  function getVesselColor(vesselId, vesselsInput) {
    if (!vesselId) return "#64748b";

    const vessels = vesselsInput ?? window.SeavState?.vessels ?? [];
    const sorted = getSortedVesselOptions(vessels);
    const index = sorted.findIndex((v) => v.id === vesselId);
    if (index >= 0) return VESSEL_COLORS[index % VESSEL_COLORS.length];

    let hash = 0;
    for (let i = 0; i < vesselId.length; i += 1) {
      hash = vesselId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return VESSEL_COLORS[Math.abs(hash) % VESSEL_COLORS.length];
  }

  /* =========================================================
     NAVIGATION DISTANCE HELPERS
     Single source of truth for the great-circle distance math —
     was previously copy-pasted (identically) in navigation-helpers.js,
     navigation-routing.js, dashboard-snippets.js, and public-profile-utils.js.
  ========================================================= */

  const EARTH_RADIUS_NM = 3440.065;

  function haversineNm(lat1, lng1, lat2, lng2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_NM * Math.asin(Math.sqrt(a));
  }

  function formatNm(value) {
    const miles = Number(value || 0);
    if (miles >= 1000) return `${Math.round(miles).toLocaleString()} NM`;
    if (miles >= 100) return `${Math.round(miles)} NM`;
    return `${Math.round(miles * 10) / 10} NM`;
  }

  function pathLengthNm(coords) {
    let total = 0;
    for (let i = 1; i < coords.length; i += 1) {
      total += haversineNm(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
    }
    return total;
  }

  function hasPassageCoord(lat, lng) {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    return Number.isFinite(latNum) && Number.isFinite(lngNum) && !(latNum === 0 && lngNum === 0);
  }

  // Quick straight-line (great-circle) distance for a single logged passage —
  // deliberately NOT the routed sea-lane distance (SeavNavigationPassage /
  // navigation-routing.js's Dijkstra engine). That engine is heavy (a ~100+
  // node graph + land-avoidance heuristics) and only loaded on navigation.html
  // and the dashboard/public profile. Achievement evaluation runs on every
  // app page, so this stays cheap and dependency-free — it only needs the raw
  // navigation entry, which window.SeavState already loads everywhere. A
  // straight line is always a slight underestimate of the real route, so it
  // never over-awards a distance badge.
  function getPassageDistanceNm(entry) {
    if (!entry) return 0;
    const fromLat = Number(entry.fromLat ?? entry.from_lat ?? 0);
    const fromLng = Number(entry.fromLng ?? entry.from_lng ?? 0);
    const toLat = Number(entry.toLat ?? entry.lat ?? entry.to_lat ?? 0);
    const toLng = Number(entry.toLng ?? entry.lng ?? entry.to_lng ?? 0);
    const waypoints = Array.isArray(entry.waypoints)
      ? entry.waypoints
          .map((wp) => [Number(wp?.lat), Number(wp?.lng)])
          .filter(([lat, lng]) => hasPassageCoord(lat, lng))
      : [];

    if (!hasPassageCoord(fromLat, fromLng) || !hasPassageCoord(toLat, toLng)) return 0;
    if (fromLat === toLat && fromLng === toLng && !waypoints.length) return 0;

    return pathLengthNm([[fromLat, fromLng], ...waypoints, [toLat, toLng]]);
  }

  // RYA Yachtmaster Offshore exam prerequisite (rya.org.uk): 2,500 qualifying
  // miles, at least half of it (1,250 miles) in tidal waters. Tidal/non-tidal
  // is the per-passage navIsTidal self-declared flag (js/navigation-helpers.js
  // normalizeNavEntry). Same 2500/1250 figures as the Navigation page's stat
  // box (js/navigation-map.js buildNavigationStats), but summed here with the
  // cheap getPassageDistanceNm() straight-line distance instead of the
  // routed sea-lane distance the map uses — so this total can read slightly
  // lower than the Navigation page's mile counter for the same passages.
  // That's the same deliberate "never over-award" tradeoff getPassageDistanceNm
  // itself documents; it's an underestimate, not a bug.
  const YACHTMASTER_OFFSHORE_TARGET_NM = 2500;
  const YACHTMASTER_OFFSHORE_TIDAL_TARGET_NM = 1250;

  function computeYachtmasterOffshoreMiles(navigationEntries) {
    let totalNm = 0;
    let tidalNm = 0;

    (navigationEntries || []).forEach((entry) => {
      const nm = getPassageDistanceNm(entry);
      totalNm += nm;
      if (entry?.isTidal) tidalNm += nm;
    });

    const totalMet = totalNm >= YACHTMASTER_OFFSHORE_TARGET_NM;
    const tidalMet = tidalNm >= YACHTMASTER_OFFSHORE_TIDAL_TARGET_NM;

    return {
      totalNm,
      tidalNm,
      totalMet,
      tidalMet,
      allMet: totalMet && tidalMet,
      TARGET_NM: YACHTMASTER_OFFSHORE_TARGET_NM,
      TIDAL_TARGET_NM: YACHTMASTER_OFFSHORE_TIDAL_TARGET_NM
    };
  }

  /* =========================================================
     VESSEL FIELD ACCESSORS
     Vessel records are saved with prefixed field names (vessel_type,
     vessel_length, vessel_role, experience_onboard — see js/vessels.js's
     submit handler) but a couple of un-prefixed legacy names (type, length,
     role, desc) are kept as fallbacks for any older records saved before the
     rename. Single source of truth — was duplicated inline in
     public-profile-utils.js and, with the WRONG field names entirely, in
     js/achievements-engine.js (see below).
  ========================================================= */

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

  /* =========================================================
     REFERENCE HELPERS
  ========================================================= */

  function getReferenceStatus(ref) {
    if (!ref) return "Draft";
    const raw = ref.status || ref.verified || "Draft";
    const value = String(raw).trim().toLowerCase();
    if (value === "verified") return "Verified";
    if (value === "declined") return "Declined";
    if (value.startsWith("sent")) return "Sent for Verification";
    return String(raw).trim() || "Draft";
  }

  // Single source of truth for reference status pills — was previously
  // copy-pasted in js/references.js (edit page) and js/dashboard-snippets.js
  // with slightly different label text ("Sent for verification" vs "Sent
  // for Verification"). `visible: false` means the edit page's card hides
  // the pill for that status; callers can ignore it if they want to always
  // show something (the dashboard snippet does, for a quick-glance Draft tag).
  function getReferenceStatusDisplay(status) {
    const map = {
      Verified: { label: "Verified", className: "reference-verified-pill" },
      "Sent for Verification": {
        label: "Sent for verification",
        className: "reference-sent-pill"
      },
      Declined: { label: "Declined", className: "reference-declined-pill" }
    };
    if (map[status]) return { ...map[status], visible: true };
    // "Draft" is the stored value (unchanged, used throughout the app) but
    // crew now see it labeled "Unverified" everywhere it's displayed, to
    // match the simplified rf_status dropdown (references.html).
    if (status === "Draft") return { label: "Unverified", className: "pill pill-neutral", visible: false };
    return { label: status || "Unverified", className: "pill", visible: true };
  }

  /* =========================================================
     PUBLIC API
  ========================================================= */

window.SeavData = {
  KEYS,
  MANDATORY_CERTS,
  RECOMMENDED_CERTS,
  RANK_ROLE_GROUP_LABELS,
  CERT_CATALOG_GROUPS,
  getCertificateCatalogGroups,
  getCertificateCatalog,
  setCertificateCatalogFromDb,
  findCertificateCatalogItem,
  isSavedCert,
  isCurrentQualificationCert,
  slugifyUsername,
  isValidUsername,
  getSavedCertificates,
  findCertByCode,
  findSavedCertByCode,
  isRankRoleCert,
  DEPRECATED_MANDATORY_CODES,
  getMandatoryCertTemplate,
  renderMandatoryCertDetailHtml,
  isSuppressedAdditionalCert,
  createId,
  DEFAULT_PROFILE,
  getEmptySeatimeEntry,
  getEmptyVesselEntry,
  getEmptyReferenceEntry,
  getEmptyCertificateEntry,
  getEmptyAchievementEntry,
  ONBOARD_EXPERIENCE_CATEGORIES,
  getEmptyOnboardExperienceEntry,
  getOnboardCategoryLabel,
  ONBOARD_SKILL_CATEGORIES,
  getOnboardSkillCategoryLabel,
  getOnboardSkillsForCategory,
  getOnboardSkillRatingLabel,
  getEmptyOnboardSkillEntry,
  HOBBIES_INTEREST_CATEGORIES,
  getEmptyHobbyInterestEntry,
  getHobbyInterestCategoryLabel,
  SPECIALIST_QUALIFICATION_CATEGORIES,
  getEmptySpecialistQualificationEntry,
  getSpecialistCategoryLabel,
  getHobbyInterestStatusDisplay,
  PAYSLIP_CURRENCIES,
  PAYSLIP_TAX_YEAR_MONTHS,
  getEmptyPayslipEntry,
  getUkTaxYearOptions,
  inferUkTaxYear,
  normalizePayslipMonth,
  getPayslipMonthLabel,
  getPayslipMonthsLogged,
  inferPayslipMonthFromDate,
  formatMoneyAmount,
  TENDER_PROFICIENCY_LEVELS,
  getTenderProficiencyLabel,
  getTenderProficiencyDisplay,
  getEmptyTenderEntry,
  toNumber,
  totalQualifyingDays,
  getSeatimeTotals,
  parseLengthMeters,
  daysBetweenDates,
  computeOowSeaService,
  computeOow36MonthsOnboard,
  isOowSeaTimeComplete,
  computeMasterSeaService,
  seatimesGatedByCertIssueDate,
  computeMaster200SeaService,
  computeMaster500SeaService,
  computeMaster3000SeaService,
  computeChiefMateUnlimitedEligibility,
  computeMasterUnlimitedSeaService,
  computeYachtmasterOffshoreMiles,
  getSeatimeVerificationDisplay,
  getCertExpiryInfo,
  isCertNoExpiry,
  isCertExpiringOrExpired,
  getCurrentVesselIndex,
  getVesselHistory,
  getSortedVesselOptions,
  getVesselColor,
  getVesselRole,
  getVesselType,
  getVesselLength,
  getVesselExperience,
  haversineNm,
  formatNm,
  pathLengthNm,
  getPassageDistanceNm,
  getReferenceStatus,
  getReferenceStatusDisplay,
  isProfilePublic,
  formatDatePretty,
  truncateText
};
})();