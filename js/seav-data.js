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
      stcwRef: "STCW A-VI/1",
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
      stcwRef: "STCW A-VI/1",
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
      stcwRef: "STCW A-VI/1",
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
      stcwRef: "STCW A-VI/1",
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
        { code: "OOW YACHT", name: "Officer of the Watch (Yacht)" },
        { code: "CHIEF MATE Y", name: "Chief Mate Yacht (MCA)" },
        { code: "MASTER Y3000", name: "Master Yacht 3000GT (MCA)" },
        { code: "MASTER Y500", name: "Master Yacht 500GT (MCA)" },
        { code: "EDH", name: "Efficient Deck Hand (EDH)" },
        { code: "RFPNW", name: "Rating Forming Part of a Navigational Watch" },
        { code: "RFPEW", name: "Rating Forming Part of an Engineering Watch" },
        { code: "AEC", name: "Approved Engine Course (AEC)" },
        { code: "MEOL", name: "Motor Engineering Operational Level (MEOL)" },
        { code: "Y1", name: "Yacht Engineer Y1 (MCA)" },
        { code: "Y2", name: "Yacht Engineer Y2 (MCA)" },
        { code: "Y3", name: "Yacht Engineer Y3 (MCA)" },
        { code: "Y4", name: "Yacht Engineer Y4 (MCA)" }
      ]
    },
    {
      label: "Navigation, bridge & GMDSS",
      certs: [
        { code: "GMDSS GOC", name: "GMDSS General Operator's Certificate (GOC)" },
        { code: "GMDSS ROC", name: "GMDSS Restricted Operator's Certificate (ROC)" },
        { code: "ECDIS", name: "ECDIS Generic Training" },
        { code: "ARPA", name: "Radar / ARPA Operational" },
        { code: "HELM-O", name: "HELM Operational" },
        { code: "HELM-M", name: "HELM Management" },
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

  function getMandatoryCertTemplate(code) {
    return (
      MANDATORY_CERTS.find(
        (item) => normalizeCertCode(item.code) === normalizeCertCode(code)
      ) || null
    );
  }

  function getCertificateCatalogGroups() {
    return [
      {
        label: "Minimum mandatory (yacht crew)",
        isMandatory: true,
        certs: MANDATORY_CERTS.map((item) => ({
          code: item.code,
          name: item.name
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
      expiry: "",
      status: "Missing",
      attachment: null,
      isMandatory: false,
      isTemplate: false,
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

function getEmptySpecialistQualificationEntry() {
  return {
    id: createId("specialist"),
    category: "",
    title: "",
    issuingBody: "",
    dateObtained: "",
    expiry: "",
    status: "Self-declared",
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

  /* =========================================================
     CERTIFICATE HELPERS
  ========================================================= */

  function isCertNoExpiry(cert) {
    if (!cert) return false;
    if (cert.noExpiry) return true;
    return String(cert.status || "").trim().toLowerCase() === "no expiry";
  }

  function isCertExpiringOrExpired(cert, warningDays = 60) {
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
    const warningDays = options.warningDays ?? 60;

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

  /* =========================================================
     REFERENCE HELPERS
  ========================================================= */

  function getReferenceStatus(ref) {
    if (!ref) return "Draft";
    return ref.status || ref.verified || "Draft";
  }

  /* =========================================================
     PUBLIC API
  ========================================================= */

window.SeavData = {
  KEYS,
  MANDATORY_CERTS,
  RECOMMENDED_CERTS,
  CERT_CATALOG_GROUPS,
  getCertificateCatalogGroups,
  getCertificateCatalog,
  findCertificateCatalogItem,
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
  HOBBIES_INTEREST_CATEGORIES,
  getEmptyHobbyInterestEntry,
  getHobbyInterestCategoryLabel,
  SPECIALIST_QUALIFICATION_CATEGORIES,
  getEmptySpecialistQualificationEntry,
  getSpecialistCategoryLabel,
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
  getEmptyTenderEntry,
  toNumber,
  totalQualifyingDays,
  getSeatimeTotals,
  getCertExpiryInfo,
  isCertNoExpiry,
  isCertExpiringOrExpired,
  getCurrentVesselIndex,
  getVesselHistory,
  getSortedVesselOptions,
  getReferenceStatus,
  isProfilePublic,
  formatDatePretty
};
})();