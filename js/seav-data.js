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
    LAND_EXPERIENCES: "seav_land_experiences",
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

  // v572 "personal side" (Jack, 2026-10-05): qualities that cross over to
  // yachting, picked (max 4) on an interest, a specialist qualification or
  // a land-based role, and counted into the profile's "Qualities" strip.
  // FIXED list so the tags stay countable — add here, never free text.
  // v574 (Jack: "add more skills that would be relevant to yachting"): 49
  // values in five groups; the picker shows the group headings. Values are
  // the stored keys — NEVER rename or remove one (saved rows reference
  // them; normalizeQualities drops unknown values). Labels can change.
  const CREW_QUALITY_GROUPS = [
    { value: "style", label: "Working style" },
    { value: "physical", label: "Physical & outdoors" },
    { value: "deck", label: "Deck & practical" },
    { value: "guest", label: "Guest & hospitality" },
    { value: "tech", label: "Tech & admin" }
  ];
  const CREW_QUALITIES = [
    { value: "teamwork", label: "Teamwork", group: "style" },
    { value: "long_hours", label: "Long hours", group: "style" },
    { value: "early_starts", label: "Early starts", group: "style" },
    { value: "endurance", label: "Endurance", group: "style" },
    { value: "resilience", label: "Resilience", group: "style" },
    { value: "calm_pressure", label: "Calm under pressure", group: "style" },
    { value: "leadership", label: "Leadership", group: "style" },
    { value: "teaching", label: "Teaching others", group: "style" },
    { value: "attention_detail", label: "Attention to detail", group: "style" },
    { value: "discretion", label: "Discretion", group: "style" },
    { value: "safety", label: "Safety-minded", group: "style" },
    { value: "adaptability", label: "Adaptability", group: "style" },
    { value: "initiative", label: "Initiative", group: "style" },
    { value: "reliability", label: "Reliability", group: "style" },
    { value: "communication", label: "Communication", group: "style" },
    { value: "problem_solving", label: "Problem solving", group: "style" },
    { value: "positive_attitude", label: "Positive attitude", group: "style" },
    { value: "close_quarters", label: "Living in close quarters", group: "style" },
    { value: "heavy_lifting", label: "Heavy lifting", group: "physical" },
    { value: "outdoors", label: "Working outdoors in all weather", group: "physical" },
    { value: "working_height", label: "Working at height", group: "physical" },
    { value: "water_confidence", label: "Water confidence", group: "physical" },
    { value: "fitness", label: "Physical fitness", group: "physical" },
    { value: "boat_handling", label: "Boat handling", group: "deck" },
    { value: "tender_driving", label: "Tender & RIB driving", group: "deck" },
    { value: "ropework", label: "Ropework & knots", group: "deck" },
    { value: "mechanical", label: "Engines & mechanical", group: "deck" },
    { value: "electrical", label: "Electrical", group: "deck" },
    { value: "carpentry", label: "Carpentry & joinery", group: "deck" },
    { value: "painting_varnishing", label: "Painting & varnishing", group: "deck" },
    { value: "detailing", label: "Detailing & cleaning", group: "deck" },
    { value: "fibreglass", label: "Fibreglass & gelcoat repair", group: "deck" },
    { value: "diving", label: "Diving", group: "deck" },
    { value: "water_toys", label: "Water toys & watersports", group: "deck" },
    { value: "fishing", label: "Fishing", group: "deck" },
    { value: "guest_service", label: "Guest service", group: "guest" },
    { value: "silver_service", label: "Silver service", group: "guest" },
    { value: "wine_cocktails", label: "Wine & cocktails", group: "guest" },
    { value: "cooking", label: "Cooking", group: "guest" },
    { value: "housekeeping", label: "Housekeeping & laundry", group: "guest" },
    { value: "floristry", label: "Floristry & table styling", group: "guest" },
    { value: "event_planning", label: "Event planning", group: "guest" },
    { value: "childcare", label: "Childcare", group: "guest" },
    { value: "wellness", label: "Wellness & massage", group: "guest" },
    { value: "it_av", label: "IT & AV systems", group: "tech" },
    { value: "photo_video", label: "Photography & video", group: "tech" },
    { value: "admin_accounts", label: "Admin & accounts", group: "tech" },
    { value: "second_language", label: "Second language", group: "tech" }
  ];
  const MAX_QUALITIES = 4;
  const MAX_HIGHLIGHTS = 8;

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

  /* Yacht certificate catalog — grouped for dropdown; also drives RECOMMENDED_CERTS.
   * Reorganized 2026-08-04 into an 18-category taxonomy mirroring real
   * STCW/MLC/ISPS/MCA structure (per Jack's review), replacing the old
   * flatter 11-group layout. "Minimum mandatory (yacht crew)" (see
   * MANDATORY_CERTS above) is untouched — it drives real is_mandatory
   * behavior, not just a display label. Kept in sync with the live
   * Supabase certificate_catalog table (migration
   * reorganize_certificate_catalog_18_categories) — see
   * docs/certificate-catalog.sql for the DB-side seed/reference copy. */
  const CERT_CATALOG_GROUPS = [
    {
      // ENG1 itself is mandatory (see MANDATORY_CERTS) — this is only the
      // less common equivalent-medical route.
      label: "Medical certification (additional)",
      certs: [
        { code: "STCW ML5", name: "ML5 / ENG1 Equivalent Medical" }
      ]
    },
    {
      label: "Identity & seafarer documents",
      certs: [
        { code: "PASSPORT", name: "Passport / Seafarer Identity Document" },
        { code: "DISCHARGE_BOOK", name: "Seaman's Discharge Book" },
        { code: "SEAMAN_BOOK", name: "Seaman's Book / CDC" },
        { code: "VISA_B1B2", name: "US B1/B2 Visa (crew)" }
      ]
    },
    {
      label: "Mandatory Basic Safety (STCW) — combined certificate",
      certs: [
        { code: "STCW BST", name: "STCW Basic Safety Training (Full BST)", stcwRef: "STCW A-VI/1" }
      ]
    },
    {
      // PSA (Security Awareness) is already mandatory — see MANDATORY_CERTS
      // above. These two are role/vessel-conditional (ISPS Code vessel
      // and/or assigned security duties — MSN 1858 footnote 6), not
      // universally mandatory, so they stay in the optional catalog.
      label: "Security (STCW)",
      certs: [
        { code: "STCW A-VI/6-2", name: "Proficiency in Designated Security Duties (PDSD)" },
        { code: "STCW A-VI/5", name: "Ship Security Officer (SSO)" }
      ]
    },
    {
      label: "Certificates of Competency — Deck",
      certs: [
        { code: "STCW A-II/1", name: "Certificate of Competency (Deck CoC)" },
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
        // Required for officers without a UK CoC serving on UK/Red-Ensign
        // flagged yachts (REG Code / MCA MSN 1867) — distinct from holding
        // a national CoC, which they keep and carry alongside this.
        { code: "UK CEC", name: "UK Certificate of Equivalent Competency (CEC)" }
      ]
    },
    {
      label: "Certificates of Competency — Engineering",
      certs: [
        { code: "STCW A-III/1", name: "Certificate of Competency (Engineering CoC)" },
        { code: "STCW A-III/6", name: "Electro-Technical Officer CoC" },
        // Current MCA "Small Vessel" engineer officer structure (MIN 524,
        // 2021) — replaced the old Y1-4 ticket system below as the route to
        // a new CoC, though many working engineers still hold a legacy
        // Y-ticket, so those stay listed too.
        { code: "EOOW SV", name: "Engineer Officer of the Watch — Small Vessel <3000GT (MCA)" },
        { code: "CE SV500", name: "Chief Engineer (Small Vessel) <500GT (MCA)" },
        { code: "CE SV3000", name: "Chief Engineer (Small Vessel) <3000GT (MCA)" },
        { code: "Y1", name: "Yacht Engineer Y1 (MCA, legacy)" },
        { code: "Y2", name: "Yacht Engineer Y2 (MCA, legacy)" },
        { code: "Y3", name: "Yacht Engineer Y3 (MCA, legacy)" },
        { code: "Y4", name: "Yacht Engineer Y4 (MCA, legacy)" }
      ]
    },
    {
      label: "Ratings",
      certs: [
        // Distinct from the generic RFPNW/RFPEW watch-rating certs below —
        // the REG Code specifically calls out a Yacht Rating Certificate
        // (STCW A-II/4) as the yacht-specific version some employers require.
        { code: "YACHT RATING", name: "Yacht Rating Certificate", stcwRef: "STCW A-II/4" },
        { code: "EDH", name: "Efficient Deck Hand (EDH)" },
        { code: "RFPNW", name: "Rating Forming Part of a Navigational Watch" },
        { code: "RFPEW", name: "Rating Forming Part of an Engineering Watch" }
      ]
    },
    {
      label: "Engineering qualifications",
      certs: [
        { code: "AEC", name: "Approved Engine Course (AEC)" },
        { code: "MEOL", name: "Marine Engine Operators License (MEOL)" }
      ]
    },
    {
      // MCA/IAMI written-exam and academic modules that feed into the deck
      // CoCs above — distinct from the CoC itself (you sit these BEFORE
      // being issued the Certificate of Competency), and distinct from a
      // certificate someone can actually use onboard. Previously untracked
      // in SEA-V entirely; sourced from MSN 1858 (M+F) Amendment 2 sections
      // 3.3–3.6 (OOW/Chief Mate/Master <3000GT) and 4.3 (Chief Mate Yachts
      // Unlimited) — see the "SEA-V Deck Certificate Module Requirements"
      // research spreadsheet for full sourcing detail per module.
      label: "Professional examination modules (MCA yacht)",
      certs: [
        { code: "NAV RADAR OOW", name: "Navigation and Radar (OOW Yachts)" },
        { code: "GEN SHIP KNOW", name: "General Ship Knowledge (OOW Yachts)" },
        { code: "SEAMANSHIP MET MY", name: "Seamanship and Meteorology (Master Yachts)" },
        { code: "STABILITY MY", name: "Stability (Master Yachts)" },
        { code: "BUSINESS LAW MY", name: "Business and Law (Master Yachts)" },
        { code: "NAV RADAR ARPA MY", name: "Navigation, Radar and ARPA Simulator (Master Yachts)" },
        { code: "CELESTIAL NAV", name: "Celestial Navigation (MCA professional exam)" },
        // Chief Mate Yachts Unlimited's 9 MCA-approved nautical college
        // academic modules (MSN 1858 §4.3), plus its separate practical
        // assessment — none of these existed in the catalog before.
        { code: "APPLIED MET", name: "Applied Marine Meteorology" },
        { code: "MGT PASSAGE PLAN", name: "Management Level Passage Planning" },
        { code: "MGT BRIDGE OPS", name: "Management of Bridge Operations" },
        { code: "MGT YACHT OPS", name: "Management of Yacht Operations" },
        { code: "MARINE ENG SYS", name: "Marine Engineering Systems" },
        { code: "MARINE VESSELS SM", name: "Marine Vessels — Structures and Maintenance" },
        { code: "SHIP STABILITY TPA", name: "Ship Stability: Theory and Practical Application" },
        { code: "SHIPBOARD MGT", name: "Shipboard Management" },
        { code: "SHIPMASTERS LAW", name: "Shipmaster's Law and Business" },
        { code: "CM NAV STAB ASSESS", name: "MCA Assessment: Chief Mate Navigation and Stability (Yacht Unlimited)" }
      ]
    },
    {
      label: "Navigation & communications",
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
        { code: "BRM", name: "Bridge Resource Management" },
        { code: "GMDSS", name: "GMDSS (legacy code — use GOC/ROC if possible)" }
      ]
    },
    {
      label: "Advanced STCW",
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
      label: "Passenger operations",
      certs: [
        { code: "STCW CROWD", name: "Crowd Management Training" },
        { code: "STCW CRISIS", name: "Crisis Management & Human Behaviour" },
        { code: "STCW PASS SAF", name: "Passenger Safety, Cargo Safety & Hull Integrity" }
      ]
    },
    {
      label: "Refresher training",
      certs: [
        { code: "PST UPDATE", name: "Personal Survival Techniques — Update" },
        { code: "FPFF UPDATE", name: "Fire Prevention & Fire Fighting — Update" },
        { code: "AFF UPDATE", name: "Advanced Fire Fighting — Update" },
        { code: "PSCRB UPDATE", name: "Survival Craft & Rescue Boats — Update" },
        { code: "FRB UPDATE", name: "Fast Rescue Boats — Update" }
      ]
    },
    {
      label: "RYA & recreational qualifications",
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
        { code: "WAKE INSTR", name: "Wakeboard / Tow Sports Instructor" },
        { code: "KITE L1", name: "Kitesurfing / Wing Instructor Level 1" }
      ]
    },
    {
      // International Yacht Training (IYT) — a separate awarding body from
      // RYA covering much of the same deck ground (Yachtmaster tiers,
      // powerboat, bareboat/flotilla skippering) plus its own professional
      // "Master of Yachts" CoC-track certificates that RYA doesn't offer
      // directly. Added 2026-08-08 after a real gap report: a crew member's
      // IYT Master of Yachts 200 and Small Powerboat & RIB Master ("Power
      // Level 2") had nowhere to go in the Certificates/Current Qualification
      // dropdowns. Sourced from iytworld.com's official Recreational and
      // Superyacht "Course Levels" pages; engineering-track entries are
      // IYT's actual full engineering offering (it does not run a parallel
      // Y4-Y1-style ladder the way MCA does — most working engineers still
      // hold MCA/Merchant Navy tickets, IYT mainly covers the entry bridge).
      label: "IYT & alternative professional qualifications",
      certs: [
        { code: "IYT MOY COASTAL", name: "IYT Master of Yachts Coastal / Mate 200 Tons" },
        { code: "IYT MOY LTD", name: "IYT Master of Yachts Limited 200GT" },
        { code: "IYT MOY UNLTD", name: "IYT Master of Yachts Unlimited 200GT" },
        { code: "IYT MOY INSHORE", name: "IYT Master of Yachts Inshore <80GT" },
        { code: "IYT SY CREW", name: "IYT Superyacht Crew" },
        { code: "IYT PB2", name: "IYT Small Powerboat & RIB Master (MCA Recognised)" },
        { code: "IYT YMC", name: "IYT Yachtmaster Coastal" },
        { code: "IYT YMO", name: "IYT Yachtmaster Offshore" },
        { code: "IYT YMOCEAN", name: "IYT Yachtmaster Ocean" },
        { code: "IYT BAREBOAT", name: "IYT International Bareboat Skipper" },
        { code: "IYT FLOTILLA", name: "IYT International Flotilla Skipper" },
        { code: "IYT SRC", name: "IYT Marine Communications (VHF/SRC)" },
        { code: "IYT ENG GRADE1", name: "IYT Boat Engineer Grade 1" },
        { code: "IYT ENG TRANSITION", name: "IYT Transition to Yacht Marine Engineering" }
      ]
    },
    {
      label: "Diving qualifications",
      certs: [
        { code: "PADI OW", name: "PADI Open Water Diver" },
        { code: "PADI AOW", name: "PADI Advanced Open Water" },
        { code: "PADI RESCUE", name: "PADI Rescue Diver" },
        { code: "PADI DM", name: "PADI Divemaster" },
        { code: "PADI INSTR", name: "PADI Dive Instructor" }
      ]
    },
    {
      label: "Hospitality qualifications",
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
      label: "Health & compliance",
      certs: [
        { code: "YELLOW FEVER", name: "Yellow Fever Vaccination Certificate" },
        { code: "DRUG TEST", name: "Drug & Alcohol Test Certificate" }
      ]
    }
  ];

  const RECOMMENDED_CERTS = CERT_CATALOG_GROUPS.flatMap((group) => group.certs || []);

  /* Public profile “Rank & role” — catalog groups only (not full dropdown
   * catalog). Updated 2026-08-04 for the 18-category reorg — this is the
   * same set of certs as before (Identity, STCW basic/combined training,
   * CoC/rank/MCA, Navigation/bridge/GMDSS, Advanced STCW, Passenger STCW),
   * just split across more, more specific group labels now. Deliberately
   * excludes "Professional examination modules" (exam passes, not
   * something someone "holds" as a rank credential) and "Medical
   * certification (additional)" (wasn't in the original set either). */
  const RANK_ROLE_GROUP_LABELS = new Set([
    "Identity & seafarer documents",
    "Mandatory Basic Safety (STCW) — combined certificate",
    "Security (STCW)",
    "Certificates of Competency — Deck",
    "Certificates of Competency — Engineering",
    "Ratings",
    "Engineering qualifications",
    "Navigation & communications",
    "Advanced STCW",
    "Passenger operations"
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
        // minSortOrder tracks the lowest sort_order seen for this group,
        // used below to order GROUPS the same intentional way sort_order
        // orders certs within a group (was previously alphabetical by
        // label, which scrambled the deliberate STCW/MLC/ISPS/MCA-mirroring
        // category order from the 2026-08-04 catalog reorg).
        groups.set(label, { label, isMandatory: false, certs: [], minSortOrder: Number(row.sort_order || 0) });
      }
      const group = groups.get(label);
      if (row.is_mandatory) group.isMandatory = true;
      group.minSortOrder = Math.min(group.minSortOrder, Number(row.sort_order || 0));
      group.certs.push({ code: row.code, name: row.name, stcwRef: row.stcw_ref || "" });
    }

    const result = [...groups.values()];
    result.sort((a, b) => {
      if (a.isMandatory && !b.isMandatory) return -1;
      if (!a.isMandatory && b.isMandatory) return 1;
      return a.minSortOrder - b.minSortOrder;
    });
    result.forEach((group) => delete group.minSortOrder);
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

  // v579 (GDPR, Jack 2026-10-08: "eng1 can show but no details"): a medical
  // FITNESS certificate is health data. The public profile shows that one is
  // held, never its dates or valid/expired status. Training courses with
  // "medical" in the name (Medical First Aid, Medical Care) are not health
  // data and are left alone.
  function isMedicalFitnessCert(cert) {
    const code = String(cert?.code || "").trim().toUpperCase();
    if (code === "ENG1" || code === "STCW ML5") return true;
    const text = `${cert?.name || ""} ${code}`;
    if (/first aid|medical care/i.test(text)) return false;
    return /\beng\s?1\b|\bml5\b|medical (fitness|certificate)|seafarer medical|\bmedical\b$/i.test(text.trim());
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

function getQualityLabel(value) {
  return CREW_QUALITIES.find((item) => item.value === value)?.label || "";
}

// Known values only, unique, max 4 — anything else (a removed quality, a
// hand-edited row) is dropped rather than shown as raw text.
function normalizeQualities(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .map((value) => String(value || "").trim())
    .filter((value) => getQualityLabel(value) && !seen.has(value) && seen.add(value))
    .slice(0, MAX_QUALITIES);
}

// Self-declared achievements inside an interest: {title, year}, max 8.
function normalizeHighlights(list) {
  return (Array.isArray(list) ? list : [])
    .map((item) => ({
      title: String(item?.title || "").trim().slice(0, 120),
      year: String(item?.year || "").trim().slice(0, 9)
    }))
    .filter((item) => item.title)
    .slice(0, MAX_HIGHLIGHTS);
}

// Categories were saved both as the value ("sport_fitness") and as the
// label ("Sport & fitness") — the same category could appear twice. Reads
// map either form to the value (v572).
function normalizeCategoryValue(list, raw) {
  const key = String(raw || "").trim().toLowerCase();
  if (!key) return "";
  const hit = (list || []).find(
    (item) => item.value.toLowerCase() === key || item.label.toLowerCase() === key
  );
  return hit ? hit.value : String(raw).trim();
}

// The profile's "Qualities" strip: every quality across interests,
// specialist qualifications and land-based roles, with how many items show
// it, most-shown first (ties keep CREW_QUALITIES order).
function collectCrewQualities({ hobbiesInterests = [], specialistQualifications = [], landExperiences = [] } = {}) {
  const counts = new Map();
  const add = (items, kind) =>
    (items || []).forEach((item) =>
      normalizeQualities(item?.qualities).forEach((value) => {
        const row = counts.get(value) || { value, label: getQualityLabel(value), count: 0, sources: [] };
        row.count += 1;
        row.sources.push({ kind, title: item.title || item.role || "" });
        counts.set(value, row);
      })
    );
  add(hobbiesInterests, "interest");
  add(specialistQualifications, "qualification");
  add(landExperiences, "land");
  const order = CREW_QUALITIES.map((item) => item.value);
  return [...counts.values()].sort((a, b) => b.count - a.count || order.indexOf(a.value) - order.indexOf(b.value));
}

function getEmptyLandExperienceEntry() {
  return {
    id: createId("land"),
    role: "",
    employer: "",
    location: "",
    dateFrom: "",
    dateTo: "",
    isCurrent: false,
    description: "",
    qualities: [],
    attachment: null,
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

// "YYYY-MM-DD" -> that calendar day at LOCAL midnight (v538).
//
// new Date("2025-03-01") is UTC midnight, which is still 28 Feb anywhere
// west of the UK: every date displayed a day early, certificates expired a
// day early, a payslip dated 6 April fell into the previous tax year, and
// calendar-month durations could lose a month. Jack was on PDT (UTC-7) when
// this was fixed. Anything that is not a plain date (a full ISO timestamp,
// a Date) behaves exactly as new Date() always did.
//
// Deliberately NOT used by the sea-time day counts (daysBetweenDates and
// friends): those subtract two dates and round, so the result is already
// timezone-independent, and changing them could move badge totals.
function parseDateOnly(value) {
  if (value instanceof Date) return new Date(value.getTime());
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Date(value);
}

function inferUkTaxYear(dateStr) {
  if (!dateStr) return "";
  const date = parseDateOnly(dateStr);
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
  const date = parseDateOnly(dateStr);
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

  // Watchkeeping is NOT added: watchkeeping days are sea days spent on
  // watch, already inside actualSeaServiceDays, so adding them counted those
  // days twice (Simon Lindström's report, 2026-08-29; fixed v565 — Jack's
  // total read 1,313 for 1,197 real days). Watchkeeping stays its own
  // figure, used where MSN 1858 asks for it.
  function totalQualifyingDays(entry) {
    return (
      toNumber(entry.actualSeaServiceDays) +
      toNumber(entry.standbyServiceDays) +
      toNumber(entry.yardServiceDays)
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

  // GT is free text (vessels.gt) and people write thousands separators:
  // parseLengthMeters read the live "2,205 GT" as 2 and "1,906 GT" as 1,
  // dropping those yachts out of every 500GT Master path (2026-09-26 audit).
  // Kept separate from length on purpose -- a length of "49,9" may be a
  // decimal comma, but a tonnage essentially never has a fractional part
  // written with one. Commas, spaces and apostrophes are grouping; a dot is
  // grouping only when exactly three digits follow it ("2.500" -> 2500,
  // "499.5" -> 499.5).
  function parseGrossTonnage(raw) {
    const match = String(raw || "").match(/\d[\d,.' ]*/);
    if (!match) return 0;
    const cleaned = match[0]
      .trim()
      .replace(/[,' ]/g, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "");
    const value = parseFloat(cleaned);
    return Number.isFinite(value) ? value : 0;
  }

  function findVesselById(vessels, vesselId) {
    if (!vesselId) return null;
    return (vessels || []).find((v) => v.id === vesselId) || null;
  }

  function getEntryVesselLengthMeters(entry, vessels) {
    const vessel = findVesselById(vessels, entry?.vesselId);
    return parseLengthMeters(vessel?.vessel_length || vessel?.length || entry?.vesselLength);
  }

  // The vessel's GT wins; the GT typed on the Sea Time entry is the
  // fallback when the vessel has none (v572 — the entry's own GT used to be
  // shown in the table but ignored by every calculation).
  function getEntryVesselGt(entry, vessels) {
    const vessel = findVesselById(vessels, entry?.vesselId);
    return parseGrossTonnage(vessel?.gt) || parseGrossTonnage(entry?.gt);
  }

  // 2026-08-05, per Jack: a future-dated Sea Time entry (a contract logged
  // ahead of time, e.g. joining next month) used to count its FULL length
  // toward onboard-days progress the moment it was saved, even though none
  // of that time had actually been served yet. `end` is now capped at
  // today whenever the entry's own end date (or the "still onboard"
  // default) falls in the future, so only days already elapsed count —
  // a not-yet-started entry contributes 0, then accrues day by day as it's
  // actually lived through. Every caller (computeMasterSeaService,
  // computeMaster500/3000SeaService, computeMasterUnlimitedSeaService)
  // gets this for free with no per-caller change.
  function daysBetweenDates(startIso, endIso) {
    const start = startIso ? new Date(startIso) : null;
    const rawEnd = endIso ? new Date(endIso) : new Date();
    const today = new Date();
    const end = rawEnd > today ? today : rawEnd;
    if (!start || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    const ms = end - start;
    return ms > 0 ? Math.round(ms / 86400000) : 0;
  }

  // Onboard yacht service, MSN 1858 §4.2: "the time spent signed on a yacht,
  // irrespective of the vessel activity". Signed on covers BOTH the joining
  // and the leaving day, so this is daysBetweenDates + 1 (v572; it used to
  // drop the last day of every contract). Still clipped to today for an
  // open or future-dated entry. Use this for onboard service only — the
  // 0..1 window apportionment below keeps daysBetweenDates.
  function signedOnDays(startIso, endIso) {
    const start = startIso ? new Date(startIso) : null;
    if (!start || Number.isNaN(start.getTime())) return 0;
    const rawEnd = endIso ? new Date(endIso) : new Date();
    const today = new Date();
    const end = rawEnd > today ? today : rawEnd;
    if (Number.isNaN(end.getTime()) || end < start) return 0;
    return Math.round((end - start) / 86400000) + 1;
  }

  // MSN 1858 §3.5(b) / §3.6(a): Master service counts only "onboard yacht
  // service as a deck officer" while serving as OOW. Read from the entry's
  // "Capacity served", falling back to the vessel's role. Trainee / cadet
  // officers are NOT counted (no certificate of their own yet), nor are
  // engineers, bosuns or interior roles. Free text, so a best-effort match.
  const DECK_OFFICER_ROLE_MATCH =
    /\b(master|captain|skipper|chief officer|chief mate|first officer|first mate|second officer|second mate|2nd officer|2nd mate|third officer|third mate|3rd officer|3rd mate|officer of the watch|oow|deck officer|mate)\b/i;
  const NOT_DECK_OFFICER_MATCH = /\b(trainee|cadet|engineer|eto|electro|bosun|boatswain|purser|steward|stewardess|chef|cook)\b/i;

  // v571, Jack: "add dropdown for the position onboard ... this will avoid
  // issues if misspelling happens and goes unnoticed". ONE list for the Sea
  // Time "Capacity served" and the vessel "Role on vessel" selects. Each
  // position says whether it is a deck officer role (Master <500/<3000GT
  // service, MSN 1858 §3.5/3.6) and whether it is the Master role (Master
  // Unlimited), so the maths reads a flag instead of guessing from
  // spelling. Free text saved before v571 is kept as a "(saved earlier)"
  // option and still matched by the regexes below.
  const SEAFARER_POSITIONS = [
    {
      group: "Deck",
      roles: [
        { label: "Captain", deckOfficer: true, master: true },
        { label: "Relief Captain", deckOfficer: true, master: true },
        { label: "Chief Officer", deckOfficer: true },
        { label: "First Officer", deckOfficer: true },
        { label: "Second Officer", deckOfficer: true },
        { label: "Third Officer", deckOfficer: true },
        { label: "Officer of the Watch (OOW)", deckOfficer: true },
        { label: "Mate", deckOfficer: true },
        { label: "Trainee Officer" },
        { label: "Bosun" },
        { label: "Lead Deckhand" },
        { label: "Deckhand" },
        { label: "Junior Deckhand" },
        { label: "Deck / Engineer" },
        { label: "Deck / Stew" }
      ]
    },
    {
      group: "Engineering",
      roles: [
        { label: "Chief Engineer" },
        { label: "Second Engineer" },
        { label: "Third Engineer" },
        { label: "Engineer" },
        { label: "Junior Engineer" },
        { label: "ETO (Electro-Technical Officer)" },
        { label: "AV/IT Officer" }
      ]
    },
    {
      group: "Interior",
      roles: [
        { label: "Purser" },
        { label: "Chief Stew" },
        { label: "Head of Housekeeping" },
        { label: "Second Stew" },
        { label: "Third Stew" },
        { label: "Stew" },
        { label: "Junior Stew" },
        { label: "Sole Stew" },
        { label: "Laundry" }
      ]
    },
    {
      group: "Galley",
      roles: [
        { label: "Head Chef" },
        { label: "Sous Chef" },
        { label: "Sole Chef" },
        { label: "Crew Chef" },
        { label: "Cook" }
      ]
    },
    {
      group: "Other",
      roles: [
        { label: "Spa / Beauty Therapist" },
        { label: "Dive Instructor" },
        { label: "Water Sports Instructor" },
        { label: "Nanny" },
        { label: "Security" },
        { label: "Other" }
      ]
    }
  ];

  function findSeafarerPosition(label) {
    const key = String(label || "").trim().toLowerCase();
    if (!key) return null;
    for (const group of SEAFARER_POSITIONS) {
      const hit = group.roles.find((role) => role.label.toLowerCase() === key);
      if (hit) return hit;
    }
    return null;
  }

  // <option>s for a position <select>. A saved value that is not in the
  // list (free text from before v571) is kept as its own first option so
  // opening an old record never silently blanks it.
  function getPositionOptionsHtml(current, { placeholder = "Select position" } = {}) {
    const esc = (v) =>
      String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const value = String(current || "").trim();
    const known = findSeafarerPosition(value);
    const selected = known ? known.label : value;
    const legacy =
      value && !known
        ? `<option value="${esc(value)}" selected>${esc(value)} (saved earlier)</option>`
        : "";
    const groups = SEAFARER_POSITIONS.map(
      (group) =>
        `<optgroup label="${esc(group.group)}">${group.roles
          .map(
            (role) =>
              `<option value="${esc(role.label)}"${role.label === selected ? " selected" : ""}>${esc(role.label)}</option>`
          )
          .join("")}</optgroup>`
    ).join("");
    return `<option value=""${value ? "" : " selected"}>${esc(placeholder)}</option>${legacy}${groups}`;
  }

  function getEntryRole(entry, vessels) {
    const own = String(entry?.capacityServed || "").trim();
    if (own) return own;
    const vessel = findVesselById(vessels, entry?.vesselId);
    return String(vessel?.vessel_role || vessel?.role || "").trim();
  }

  function servedAsDeckOfficer(entry, vessels) {
    const role = getEntryRole(entry, vessels);
    const known = findSeafarerPosition(role);
    if (known) return !!known.deckOfficer;
    return DECK_OFFICER_ROLE_MATCH.test(role) && !NOT_DECK_OFFICER_MATCH.test(role);
  }

  // Master Unlimited's "served in the Master capacity". Before v571 only
  // the word "master" matched, so an entry saved as "Captain" never counted.
  function servedAsMasterRole(entry) {
    const role = String(entry?.capacityServed || "").trim();
    const known = findSeafarerPosition(role);
    if (known) return !!known.master;
    return MASTER_CAPACITY_MATCH.test(role) && !/\b(trainee|cadet)\b/i.test(role);
  }

  const OOW_QUALIFYING_TARGET = 365;
  const OOW_ACTUAL_MIN = 250;
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
   * of actual/standby/yard for the rest. Standby can never exceed that
   * entry's own actual sea days (MSN 1858 5.2: "under no circumstances can
   * your total standby service exceed your actual seagoing service") — that
   * part is still enforced below. Yard service counts up to a maximum of 90
   * days total (a running total across every logged entry, not per entry).
   *
   * 2026-08-05, per Jack: the MCA's separate "14 consecutive days at one
   * time" standby sub-cap is deliberately NOT applied here. That wording
   * caps each stand-down period following a single voyage, but a SEA-V Sea
   * Time entry is one row per whole signed-on/signed-off contract (which
   * may bundle several distinct voyages and their own separate stand-down
   * periods) — SEA-V has no per-voyage breakdown to apply a per-voyage cap
   * against. Jack's call: treat the entry's submitted standby total the
   * same way a PYA/Nautilus portal or a training/navigation booklet does —
   * trust what the crew member enters for that already-signed-off
   * testimonial period, on the assumption it reflects a testimonial the
   * MCA has (or would) accept as submitted.
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
      totalStandby15mCounted += Math.min(standby, actual);
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

  /**
   * MSN 1858 SS3.3's 36-month total onboard yacht service (any vessel size,
   * since age 16).
   *
   * 2026-08-16 correction. This previously summed totalQualifyingDays() —
   * actual + standby + yard + watchkeeping — across every entry, which
   * inflated the figure two ways at once:
   *
   *   1. Watchkeeping days are kept WHILE at sea, so they are already inside
   *      actualSeaServiceDays. Adding them again double-counted that time.
   *   2. It ignored the 90-day yard cap, so a long refit could push a crew
   *      member over 36 months on yard time alone.
   *
   * On Jack's own demo data that read 1269 days (786 + 131 + 264 + 88) and
   * unlocked the badge, while the Sea Time page's own capped OOW-qualifying
   * figure was 1007 — i.e. the badge said "36 months met" when it wasn't.
   *
   * "Onboard yacht service" is a DURATION of service onboard, not a total of
   * service-type buckets, so it is now measured from each entry's signed-on /
   * signed-off dates — the same daysBetweenDates() basis computeMasterSeaService()
   * already uses for its own onboard-months math. Entries with no usable dates
   * fall back to actual + standby + yard (watchkeeping deliberately excluded,
   * being a subset of actual sea service).
   */
  function computeOow36MonthsOnboard(seatimes) {
    const totalDays = (seatimes || []).reduce((sum, entry) => {
      const dated = signedOnDays(entry.dateJoined, entry.dateLeft);
      if (dated > 0) return sum + dated;
      return (
        sum +
        toNumber(entry.actualSeaServiceDays) +
        toNumber(entry.standbyServiceDays) +
        toNumber(entry.yardServiceDays)
      );
    }, 0);

    return {
      totalDays,
      target: OOW_36_MONTHS_TARGET_DAYS,
      met: totalDays >= OOW_36_MONTHS_TARGET_DAYS
    };
  }

  /**
   * MSN 1858 SS4.1: "At least 6 months of the qualifying seagoing service must
   * have been performed within the 5 years immediately preceding the MCA's
   * receipt of your application."
   *
   * Added 2026-08-16 — nothing implemented this before, so a crew member whose
   * entire career ended a decade ago still showed as having met the OOW sea
   * time requirement.
   *
   * "Seagoing service" follows SS4.2 and this file's existing reading of it
   * (see computeMaster200SeaService below): actual + standby + yard, with
   * standby capped at that entry's own actual sea days per SS5.2. Entries that
   * straddle the 5-year boundary are pro-rated by the fraction of the contract
   * that falls inside the window — SEA-V stores one row per signed-on/off
   * period, not per voyage, so a proportional split is the most accurate
   * apportionment the data supports.
   */
  /**
   * How much of one Sea Time entry falls inside a date window, as a 0..1
   * factor. Added 2026-08-16.
   *
   * WHY THIS EXISTS. A SEA-V Sea Time entry is one row per signed-on /
   * signed-off period, carrying whole-contract TOTALS in
   * actualSeaServiceDays / standbyServiceDays / yardServiceDays /
   * watchkeepingDays. Those buckets have no internal dates, so anything that
   * needs "only the part of this contract inside a window" cannot simply clip
   * them the way seatimesGatedByCertIssueDate() clips dateJoined.
   *
   * That gap was a live over-award. MSN 1858 SS3.1(b) requires 6 months'
   * seagoing service WHILE HOLDING RYA Yachtmaster Offshore (or IYT Master of
   * Yachts Limited). computeMaster200SeaService summed the gated entries'
   * buckets in full, so a 12-month contract with the certificate issued
   * halfway through contributed all 300 of its seagoing days rather than the
   * ~150 served while holding it — 9.86 months against a 6-month target, when
   * the true figure was ~4.9. The badge awarded on service that did not
   * qualify.
   *
   * Pro-rating is an approximation: 120 watchkeeping days concentrated in a
   * contract's first month get spread evenly across it. It is the most
   * accurate apportionment the stored data supports — the alternative is
   * asking crew to split entries at certificate dates, which is worse for
   * them and barely more accurate. Date-derived figures (daysBetweenDates on
   * clipped entries) are already exact and must NOT be apportioned again.
   */
  function apportionEntryToWindow(entry, fromIso, toIso) {
    const joined = entry?.dateJoined ? new Date(entry.dateJoined) : null;
    if (!joined || Number.isNaN(joined.getTime())) return 1;

    const today = new Date();
    const rawLeft = entry?.dateLeft ? new Date(entry.dateLeft) : today;
    if (Number.isNaN(rawLeft.getTime())) return 1;
    const left = rawLeft > today ? today : rawLeft;

    const from = fromIso ? new Date(fromIso) : null;
    const toRaw = toIso ? new Date(toIso) : today;
    const to = toRaw > today ? today : toRaw;

    const windowStart = from && !Number.isNaN(from.getTime()) && from > joined ? from : joined;
    const windowEnd = !Number.isNaN(to.getTime()) && to < left ? to : left;

    const contractMs = left - joined;
    if (contractMs <= 0) return windowStart <= windowEnd ? 1 : 0;

    const overlapMs = windowEnd - windowStart;
    if (overlapMs <= 0) return 0;

    return Math.min(1, overlapMs / contractMs);
  }

  const OOW_RECENCY_WINDOW_YEARS = 5;
  const OOW_RECENCY_MIN_DAYS = 183;

  function computeOowRecentSeagoingService(seatimes, vessels, now) {
    const today = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
    const cutoff = new Date(today);
    cutoff.setFullYear(cutoff.getFullYear() - OOW_RECENCY_WINDOW_YEARS);

    let recentDays = 0;

    (seatimes || []).forEach((entry) => {
      if (getEntryVesselLengthMeters(entry, vessels) < 15) return;

      const joined = entry.dateJoined ? new Date(entry.dateJoined) : null;
      const rawLeft = entry.dateLeft ? new Date(entry.dateLeft) : today;
      if (!joined || Number.isNaN(joined.getTime()) || Number.isNaN(rawLeft.getTime())) return;

      const left = rawLeft > today ? today : rawLeft;
      if (left < cutoff) return;

      const actual = toNumber(entry.actualSeaServiceDays);
      const seagoing =
        actual + Math.min(toNumber(entry.standbyServiceDays), actual) + toNumber(entry.yardServiceDays);
      if (seagoing <= 0) return;

      recentDays += seagoing * apportionEntryToWindow(entry, cutoff.toISOString(), null);
    });

    recentDays = Math.round(recentDays);

    return {
      recentDays,
      target: OOW_RECENCY_MIN_DAYS,
      windowYears: OOW_RECENCY_WINDOW_YEARS,
      cutoff: cutoff.toISOString().slice(0, 10),
      met: recentDays >= OOW_RECENCY_MIN_DAYS
    };
  }

  function isOowSeaTimeComplete(seatimes, vessels) {
    return (
      computeOowSeaService(seatimes, vessels).allMet &&
      computeOow36MonthsOnboard(seatimes).met &&
      // MSN 1858 SS4.1 recency condition — added 2026-08-16.
      computeOowRecentSeagoingService(seatimes, vessels).met
    );
  }

  /**
   * Master Yachts <3000GT sea-service progress — MSN 1858 (M+F) Amendment 2,
   * section 3.6(a): while holding OOW <3000GT, 240 days watchkeeping service
   * on vessels 15m+, including either 12 months on vessels 24m+ or 6 months
   * on vessels 500GT+.
   */
  /*
   * `certs` added 2026-08-16 and OPTIONAL for backwards compatibility. When
   * supplied, watchkeeping is gated to service performed while holding OOW
   * Yachts <3000GT, exactly as computeMaster3000SeaService does — so the Sea
   * Time page tracker and the Master badge can no longer show two different
   * watchkeeping totals for the same person. Omit `certs` and the old ungated
   * behaviour is preserved, but the two surfaces will disagree again.
   *
   * Not holding the certificate at all means zero qualifying watchkeeping, not
   * "all of it" — service before the ticket is service before the ticket.
   */
  function computeMasterSeaService(seatimes, vessels, certs) {
    const gate = certs
      ? seatimesGatedByCertIssueDate(seatimes, certs, MASTER_3000GT_GATING_CERT_CODE)
      : null;

    let totalWatchkeeping15m = 0;
    let totalOnboard24mDays = 0;
    let totalOnboard500gtDays = 0;

    (seatimes || []).forEach((entry) => {
      const lengthM = getEntryVesselLengthMeters(entry, vessels);
      const gt = getEntryVesselGt(entry, vessels);
      const days = daysBetweenDates(entry.dateJoined, entry.dateLeft);

      if (lengthM >= 15) {
        const wk = toNumber(entry.watchkeepingDays);
        if (!gate) totalWatchkeeping15m += wk;
        else if (gate.held) {
          totalWatchkeeping15m += wk * apportionEntryToWindow(entry, gate.issuedDate, null);
        }
      }
      if (lengthM >= 24) totalOnboard24mDays += days;
      if (gt >= 500) totalOnboard500gtDays += days;
    });

    totalWatchkeeping15m = Math.round(totalWatchkeeping15m);

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
      watchkeepingGated: !!gate,
      watchkeepingGateHeld: gate ? gate.held : null,
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
   * this filters Sea Time entries down to the portion served on/after it.
   *
   * `held: false` (issued date missing or unparsable) means the gate can't
   * open at all yet — there's no "while holding X" if X isn't held — and
   * callers should treat that as 0% progress, not "0 qualifying days so
   * far out of however many logged."
   *
   * 2026-08-05, per Jack: an entry is now CLIPPED, not excluded outright,
   * when it started before the issue date but ran past it — e.g. a
   * 6.5-month contract that began 9 days before the cert arrived used to
   * lose the entire 6.5 months, not just the 9 days that genuinely
   * shouldn't count. Every entry returned in `gatedEntries` whose original
   * `dateJoined` predates the issue date gets its `dateJoined` overwritten
   * with the cert's issue date (a shallow copy — the original seatime
   * record is untouched), so every existing caller's
   * `daysBetweenDates(entry.dateJoined, entry.dateLeft)` math already
   * produces the correctly-clipped day count with no per-caller changes.
   * Entries that ended entirely before the issue date are still excluded —
   * none of that time was served while holding the cert.
   */
  /*
   * `certCode` accepts a single code OR an array of codes (2026-08-16). Several
   * MSN 1858 tiers name more than one acceptable prerequisite — SS3.1(b) allows
   * "RYA Yachtmaster Offshore OR IYT Master of Yachts Limited" — and passing a
   * single code silently locked out everyone holding the alternative. When more
   * than one is held the EARLIEST issue date wins, since the crew member's
   * qualifying clock legitimately started the moment the first of them was held.
   */
  function seatimesGatedByCertIssueDate(seatimes, certs, certCode) {
    const codes = Array.isArray(certCode) ? certCode : [certCode];

    const issuedIso = codes
      .map((code) => findSavedCertByCode(certs, code)?.issued || null)
      .filter((iso) => iso && !Number.isNaN(new Date(iso).getTime()))
      .sort((a, b) => new Date(a) - new Date(b))[0] || null;

    const issuedDate = issuedIso ? new Date(issuedIso) : null;

    if (!issuedDate || Number.isNaN(issuedDate.getTime())) {
      return { held: false, issuedDate: null, gatedEntries: [] };
    }

    const cert = { issued: issuedIso };

    const gatedEntries = (seatimes || [])
      .filter((entry) => {
        const joined = entry.dateJoined ? new Date(entry.dateJoined) : null;
        if (!joined || Number.isNaN(joined.getTime())) return false;
        const left = entry.dateLeft ? new Date(entry.dateLeft) : new Date();
        return !Number.isNaN(left.getTime()) && left >= issuedDate;
      })
      .map((entry) => {
        const joined = new Date(entry.dateJoined);
        return joined < issuedDate ? { ...entry, dateJoined: cert.issued } : entry;
      });

    return { held: true, issuedDate: cert.issued, gatedEntries };
  }

  // MSN 1858 3.1(b): Master (Code Vessel) <200GT / OOW Yachts <500GT
  // (150nm-from-safe-haven variant) requires 6 months' SEAGOING service
  // while holding RYA Yachtmaster Offshore. "Seagoing service" (3.1's own
  // term, defined generally in 4.2) is actual + stand-by + yard service —
  // deliberately NOT the same figure as "onboard yacht service" (which also
  // counts watchkeeping/other time) used elsewhere in this file. Standby
  // is still capped at that entry's own actual sea days (MSN 1858 5.2) but,
  // same as computeOowSeaService above, NOT at 14 days per entry (2026-08-05,
  // per Jack — see that function's comment for the full reasoning). Yard has
  // no cap here (the 90-day yard cap is specific to OOW <3000GT's own
  // 115-day sub-clause, not a general rule).
  const MASTER_200GT_TARGET_MONTHS = 6;
  const MASTER_200GT_GATING_CERT_CODE = "RYA YMO";
  // MSN 1858 SS3.1(b) accepts "RYA Yachtmaster Offshore OR IYT Master of Yachts
  // Limited". IYT MOY LTD was already in the certificate catalog but was not
  // accepted by this gate, so IYT-route crew could never unlock the badge no
  // matter how much qualifying service they logged. Same class of bug as the
  // v466 Chief Mate fix; swept for here on 2026-08-16.
  const MASTER_200GT_GATING_CERT_CODES = [MASTER_200GT_GATING_CERT_CODE, "IYT MOY LTD"];

  function computeMaster200SeaService(seatimes, certs) {
    const gated = seatimesGatedByCertIssueDate(seatimes, certs, MASTER_200GT_GATING_CERT_CODES);

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

    // MSN 1858 SS3.1(b) — "while holding". Iterates the ORIGINAL entries, not
    // gated.gatedEntries: those have had dateJoined rewritten to the issue
    // date, so apportioning them against the same date would always return a
    // factor of 1. apportionEntryToWindow() returns 0 for contracts that ended
    // before the certificate, which reproduces the gate's own exclusion.
    // Standby is capped at that entry's own actual sea days per SS5.2, applied
    // AFTER apportionment so the cap tracks the qualifying portion.
    let totalDays = 0;
    (seatimes || []).forEach((entry) => {
      const factor = apportionEntryToWindow(entry, gated.issuedDate, null);
      if (factor <= 0) return;

      const actual = toNumber(entry.actualSeaServiceDays) * factor;
      const standby = Math.min(toNumber(entry.standbyServiceDays) * factor, actual);
      const yard = toNumber(entry.yardServiceDays) * factor;
      totalDays += actual + standby + yard;
    });
    totalDays = Math.round(totalDays);

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
  // service as a deck officer on vessels 15m or over, plus 120 days'
  // watchkeeping service on vessels 15m+, while holding OOW Yachts <3000GT.
  // "Onboard service" here means calendar days aboard (dateJoined→dateLeft),
  // not the actual+standby+yard "seagoing service" figure used for Master
  // <200GT — same distinction MSN 1858 draws between 3.1's and 3.5/3.6's
  // requirements.
  //
  // 2026-08-05 history: the watchkeeping sub-requirement was removed
  // entirely for a few hours, then restored same-day at Jack's request in a
  // different form. The original version date-gated watchkeeping days to
  // only count sea time logged after the OOW <3000GT cert's issue date,
  // which read much lower (e.g. 29 days) than the ungated watchkeeping
  // total shown on the Sea Time page's own Master <3000GT tracker (e.g. 88
  // days) — both figures were independently correct for what they
  // measured, but showing two different "watchkeeping days" numbers for
  // the same person eroded trust in the milestone. Jack asked to remove it,
  // then asked to bring it back but with the numbers made to match instead.
  // So watchkeepingDays below is deliberately NOT gated by cert-issue-date
  // — it sums the same way, across the crew member's full sea time record,
  // as `computeMasterSeaService`'s `totalWatchkeeping15m` (the Sea Time
  // page's own tracker), so this milestone's number always agrees with
  // that one. The onboard-months requirement stays gated as before (only
  // counts sea time logged after the OOW <3000GT issue date) — Jack only
  // asked for watchkeeping days to be reconciled, not the onboard figure.
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
        onboardMet: false,
        watchkeepingDays: 0,
        watchkeepingMet: false,
        met: false,
        ONBOARD_TARGET_MONTHS: MASTER_500GT_ONBOARD_TARGET_MONTHS,
        WATCHKEEPING_TARGET: MASTER_500GT_WATCHKEEPING_TARGET,
        GATING_CERT_CODE: MASTER_500GT_GATING_CERT_CODE
      };
    }

    // "as a deck officer" (v572): deckhand / bosun time after the OOW issue
    // date used to count here too.
    let onboardDays = 0;
    gated.gatedEntries.forEach((entry) => {
      const lengthM = getEntryVesselLengthMeters(entry, vessels);
      if (lengthM >= 15 && servedAsDeckOfficer(entry, vessels)) {
        onboardDays += signedOnDays(entry.dateJoined, entry.dateLeft);
      }
    });

    // GATED as of 2026-08-16 — reversing the 2026-08-05 decision recorded
    // above. MSN 1858 SS3.5(b) reads "12 months' onboard yacht service as a
    // deck officer ... including 120 days' watchkeeping service ... while
    // holding an OOW yachts <3000GT". The watchkeeping days sit inside the
    // same sentence, under the same "while holding" condition, as the onboard
    // months beside them — gating one and not the other split a single
    // requirement in half.
    //
    // The original objection was real: the gated figure (~29 days) disagreed
    // with the Sea Time page tracker (~88), and two different numbers for the
    // same thing eroded trust. That is now fixed the other way round —
    // computeMasterSeaService() takes certs and gates the tracker identically,
    // so both surfaces show one number and it is the one the MCA would count.
    let watchkeepingDays = 0;
    (seatimes || []).forEach((entry) => {
      if (getEntryVesselLengthMeters(entry, vessels) < 15) return;
      watchkeepingDays +=
        toNumber(entry.watchkeepingDays) * apportionEntryToWindow(entry, gated.issuedDate, null);
    });
    watchkeepingDays = Math.round(watchkeepingDays);

    const onboardMonths = onboardDays / DAYS_PER_MONTH;
    const onboardMet = onboardMonths >= MASTER_500GT_ONBOARD_TARGET_MONTHS;
    const watchkeepingMet = watchkeepingDays >= MASTER_500GT_WATCHKEEPING_TARGET;

    return {
      held: true,
      issuedDate: gated.issuedDate,
      onboardDays,
      onboardMonths,
      onboardMet,
      watchkeepingDays,
      watchkeepingMet,
      met: onboardMet && watchkeepingMet,
      ONBOARD_TARGET_MONTHS: MASTER_500GT_ONBOARD_TARGET_MONTHS,
      WATCHKEEPING_TARGET: MASTER_500GT_WATCHKEEPING_TARGET,
      GATING_CERT_CODE: MASTER_500GT_GATING_CERT_CODE
    };
  }

  // MSN 1858 3.6(a): Master (Yacht) <3000GT requires 240 days' watchkeeping
  // service on vessels 15m+, plus the same 24m-or-500GT special-experience
  // math as the ungated `computeMasterSeaService` above (that function
  // backs the Sea Time page's own tracker), while holding OOW <3000GT.
  //
  // 2026-08-05 history: the watchkeeping sub-requirement was removed
  // entirely for a few hours, then restored same-day at Jack's request in a
  // different form. §3.6(a)'s "while holding OOW <3000GT" language means
  // the special-experience months should only count sea time logged after
  // the OOW <3000GT cert's issue date, and that gating originally applied
  // to watchkeeping days too — but the gated watchkeeping total read much
  // lower (e.g. 29 days) than the ungated watchkeeping total shown on the
  // Sea Time page's own Master <3000GT tracker (e.g. 88 days). Both figures
  // were independently correct for what they measured, but showing two
  // different "watchkeeping days" numbers for the same person eroded trust
  // in the milestone. Jack asked to remove it, then asked to bring it back
  // but with the numbers made to match instead. So totalWatchkeeping15m
  // below is deliberately NOT gated by cert-issue-date — it's computed the
  // exact same way as `computeMasterSeaService`'s field of the same name
  // (the Sea Time page's own tracker), so this milestone's number always
  // agrees with that one. The 24m/500GT special-experience path stays
  // gated as before — Jack only asked for watchkeeping days to be
  // reconciled, not the special-experience figures. This remains a
  // separate function (not a change to computeMasterSeaService's
  // signature/behaviour) so the already-shipped Sea Time page tracker is
  // untouched — this one backs the Milestones achievement only.
  const MASTER_3000GT_GATING_CERT_CODE = "OOW YACHT";
  // §3.6(a) "a minimum of 24 months' onboard yacht service as a Deck
  // Officer ... all of this service on vessels of 15 metres or over" — never
  // checked before v572 (only the 240 watchkeeping days and the 24m/500GT
  // special experience were).
  const MASTER_3000GT_ONBOARD_TARGET_MONTHS = 24;

  function computeMaster3000SeaService(seatimes, certs, vessels) {
    const gated = seatimesGatedByCertIssueDate(seatimes, certs, MASTER_3000GT_GATING_CERT_CODE);

    if (!gated.held) {
      return {
        held: false,
        issuedDate: null,
        totalWatchkeeping15m: 0,
        watchMet: false,
        totalOnboard24mDays: 0,
        totalOnboard500gtDays: 0,
        months24m: 0,
        months500gt: 0,
        use500gtPath: false,
        specialValue: 0,
        specialTarget: MASTER_SPECIAL_24M_TARGET_MONTHS,
        specialMet: false,
        onboardDays: 0,
        onboardMonths: 0,
        onboardMet: false,
        ONBOARD_TARGET_MONTHS: MASTER_3000GT_ONBOARD_TARGET_MONTHS,
        allMasterMet: false,
        WATCHKEEPING_TARGET: MASTER_WATCHKEEPING_TARGET,
        GATING_CERT_CODE: MASTER_3000GT_GATING_CERT_CODE
      };
    }

    let totalOnboard24mDays = 0;
    let totalOnboard500gtDays = 0;
    let onboardDays = 0;

    gated.gatedEntries.forEach((entry) => {
      if (!servedAsDeckOfficer(entry, vessels)) return;
      const lengthM = getEntryVesselLengthMeters(entry, vessels);
      const gt = getEntryVesselGt(entry, vessels);
      const days = signedOnDays(entry.dateJoined, entry.dateLeft);

      if (lengthM >= 15) onboardDays += days;
      if (lengthM >= 24) totalOnboard24mDays += days;
      if (gt >= 500) totalOnboard500gtDays += days;
    });
    const onboardMonths = onboardDays / DAYS_PER_MONTH;
    const onboardMet = onboardMonths >= MASTER_3000GT_ONBOARD_TARGET_MONTHS;

    // GATED as of 2026-08-16 — same reasoning as computeMaster500SeaService
    // above. MSN 1858 SS3.6(a): 240 days' watchkeeping service while holding
    // OOW yachts <3000GT.
    let totalWatchkeeping15m = 0;
    (seatimes || []).forEach((entry) => {
      if (getEntryVesselLengthMeters(entry, vessels) < 15) return;
      totalWatchkeeping15m +=
        toNumber(entry.watchkeepingDays) * apportionEntryToWindow(entry, gated.issuedDate, null);
    });
    totalWatchkeeping15m = Math.round(totalWatchkeeping15m);
    const watchMet = totalWatchkeeping15m >= MASTER_WATCHKEEPING_TARGET;

    const months24m = totalOnboard24mDays / DAYS_PER_MONTH;
    const months500gt = totalOnboard500gtDays / DAYS_PER_MONTH;
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
      watchMet,
      totalOnboard24mDays,
      totalOnboard500gtDays,
      months24m,
      months500gt,
      use500gtPath,
      specialValue,
      specialTarget,
      specialMet,
      onboardDays,
      onboardMonths,
      onboardMet,
      ONBOARD_TARGET_MONTHS: MASTER_3000GT_ONBOARD_TARGET_MONTHS,
      allMasterMet: onboardMet && watchMet && specialMet,
      WATCHKEEPING_TARGET: MASTER_WATCHKEEPING_TARGET,
      GATING_CERT_CODE: MASTER_3000GT_GATING_CERT_CODE
    };
  }

  // MSN 1858 3.4: Chief Mate Yachts <3000GT needs NO extra sea time beyond
  // OOW <3000GT's own requirement — it "can be applied for at the same time
  // as OOW", per the regulation's own wording. Requirements are: (a) hold
  // an OOW <3000GT CoC OR have met all of OOW's own 3.3 requirements, (b)
  // hold RYA Yachtmaster Ocean (or IYT Master of Yachts Unlimited), plus
  // ancillary courses and ENG1 (not tracked here — see the cert-module
  // research spreadsheet). Checks the OOW condition two ways since SEA-V
  // doesn't track OOW's academic modules yet: either the saved OOW YACHT
  // certificate is held, or the OOW sea-time milestone itself is met.
  //
  // 2026-08-08: the IYT equivalence this comment always claimed was never
  // actually wired up — only RYA YMOCEAN was checked. Fixed after Jack
  // confirmed to also accept IYT MOY UNLTD (IYT Master of Yachts Unlimited
  // 200GT), now that IYT is in the certificate catalog.
  const CHIEF_MATE_3000_YACHTMASTER_OCEAN_CODE = "RYA YMOCEAN";
  const CHIEF_MATE_3000_YACHTMASTER_OCEAN_ALT_CODE = "IYT MOY UNLTD";
  const CHIEF_MATE_3000_OOW_CERT_CODE = "OOW YACHT";

  function computeChiefMate3000Eligibility(seatimes, vessels, certs) {
    const oowSeaTimeMet = isOowSeaTimeComplete(seatimes, vessels);
    const oowCertHeld = !!findSavedCertByCode(certs, CHIEF_MATE_3000_OOW_CERT_CODE);
    const yachtmasterOceanCert =
      findSavedCertByCode(certs, CHIEF_MATE_3000_YACHTMASTER_OCEAN_CODE) ||
      findSavedCertByCode(certs, CHIEF_MATE_3000_YACHTMASTER_OCEAN_ALT_CODE);
    const yachtmasterOceanHeld = !!yachtmasterOceanCert;
    const oowMet = oowSeaTimeMet || oowCertHeld;

    return {
      oowMet,
      oowSeaTimeMet,
      oowCertHeld,
      yachtmasterOceanHeld,
      yachtmasterOceanCertCode: yachtmasterOceanCert?.code || null,
      yachtmasterOceanIssuedDate: yachtmasterOceanCert?.issued || null,
      met: oowMet && yachtmasterOceanHeld
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
  const MASTER_CAPACITY_MATCH = /\b(master|captain)\b/i;

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

    // v572: a contract that started before the Master <3000GT issue date
    // used to bring ALL its actual sea days; now only the share after it,
    // apportioned the same way as the other "while holding" figures.
    let onboardDays = 0;
    let actualSeaDays = 0;
    (seatimes || []).forEach((original) => {
      const gt = getEntryVesselGt(original, vessels);
      const servedAsMaster = servedAsMasterRole(original);
      if (gt < MASTER_UNLIMITED_MIN_GT || !servedAsMaster) return;
      const entry = gated.gatedEntries.find((g) => g.id === original.id);
      if (!entry) return;
      onboardDays += signedOnDays(entry.dateJoined, entry.dateLeft);
      actualSeaDays += toNumber(original.actualSeaServiceDays) * apportionEntryToWindow(original, gated.issuedDate, null);
    });
    actualSeaDays = Math.round(actualSeaDays);

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

    // Watchkeeping is a part of sea time, not extra to it (see
    // totalQualifyingDays).
    totals.total = totals.sea + totals.standby + totals.yard;

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

  const d = parseDateOnly(dateStr);
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

    const exp = parseDateOnly(cert.expiry);
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

    const exp = parseDateOnly(expiry);
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

  // 2026-08-05 fix, Jack: this used to fall back to "most recent by `to`
  // date" whenever no vessel was open-ended (e.g. a single vessel that
  // already has a leave date set), which wrongly treated a departed vessel
  // as current. Returns -1 — genuinely "no current vessel" — instead of
  // guessing. Same root cause as the js/vessels.js renderVessels() fix;
  // this pair (getCurrentVesselIndex/getVesselHistory) has no live callers
  // today but is part of the exported public API, so it's fixed too rather
  // than left as a landmine for whoever reaches for it next.
  function getCurrentVesselIndex(vessels) {
    if (!Array.isArray(vessels) || !vessels.length) return -1;
    return vessels.findIndex((v) => !v.to || !String(v.to).trim());
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

  // RYA: Yachtmaster Offshore sea time and miles count only "on yachts up to
  // 500gt". Jack, 2026-10-04: apply it strictly, and count passages with no
  // vessel linked (a friend's boat, a sailing-school yacht — exactly the
  // small-boat miles Yachtmaster is about). A vessel with no GT entered also
  // counts; one over 500GT does not. Without a vessels list (old callers)
  // nothing is filtered.
  const YACHTMASTER_MAX_GT = 500;

  function isYachtmasterEligibleVessel(vesselId, vessels, entryGt) {
    if (!Array.isArray(vessels)) return true;
    if (!vesselId) return true;
    const vessel = findVesselById(vessels, vesselId);
    const gt = parseGrossTonnage(vessel?.gt) || parseGrossTonnage(entryGt);
    return !gt || gt <= YACHTMASTER_MAX_GT;
  }

  function computeYachtmasterOffshoreMiles(navigationEntries, vessels) {
    let totalNm = 0;
    let tidalNm = 0;

    (navigationEntries || []).forEach((entry) => {
      if (!isYachtmasterEligibleVessel(entry?.vesselId, vessels)) return;
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

  /* RYA Yachtmaster Offshore exam pre-requisites (rya.org.uk, checked
     2026-10-04), as one checklist. Sea time from Sea Time entries, passages
     from Navigation, certificates from Certificates:
       - 50 days at sea in the last 10 years on yachts up to 500gt, at least
         half on vessels under 24m (the RYA's "half in tidal waters" cannot be
         derived from Sea Time entries and is not checked);
       - 2,500 miles on yachts up to 500gt, half in tidal waters;
       - 5 passages over 60 miles, incl. 2 overnight and 2 as skipper
         ("overnight" = arrives on a later date than it left — passages have
         dates, not times);
       - 5 days as skipper on vessels under 24m (days of passages logged
         with role Skipper on a vessel under 24m or with no vessel/length);
       - a VHF / SRC (or higher GMDSS) certificate and a first aid
         certificate. */
  const YM_OFFSHORE_SEA_DAYS = 50;
  const YM_OFFSHORE_WINDOW_YEARS = 10;
  const YM_OFFSHORE_LONG_PASSAGE_NM = 60;
  const YM_OFFSHORE_LONG_PASSAGES = 5;
  const YM_OFFSHORE_OVERNIGHT = 2;
  const YM_OFFSHORE_SKIPPER_PASSAGES = 2;
  const YM_OFFSHORE_SKIPPER_DAYS = 5;
  const YM_SMALL_VESSEL_M = 24;
  const YM_RADIO_CODES = ["RYA SRC", "IYT SRC", "GMDSS ROC", "GMDSS GOC", "GMDSS"];
  const YM_FIRST_AID_CODES = ["EFA", "STCW A-VI/4-1", "STCW A-VI/4-2"];

  function passageDateSpan(entry) {
    const dep = entry?.departureDate || entry?.visitedDate || "";
    const arr = entry?.arrivalDate || "";
    if (!dep) return { days: 0, overnight: false };
    if (!arr) return { days: 1, overnight: false };
    const d = Math.round((new Date(arr) - new Date(dep)) / 86400000);
    if (Number.isNaN(d) || d < 0) return { days: 1, overnight: false };
    return { days: d + 1, overnight: d >= 1, nights: d };
  }

  function holdsAnyCert(certs, codes) {
    return codes.some((code) => !!findSavedCertByCode(certs, code));
  }

  function computeYachtmasterOffshoreChecklist(seatimes, vessels, navigationEntries, certs) {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - YM_OFFSHORE_WINDOW_YEARS);
    const cutoffIso = cutoff.toISOString().slice(0, 10);

    let seaDays = 0;
    let seaDaysSmall = 0;
    (seatimes || []).forEach((entry) => {
      if (!isYachtmasterEligibleVessel(entry?.vesselId, vessels, entry?.gt)) return;
      const days = toNumber(entry.actualSeaServiceDays) * apportionEntryToWindow(entry, cutoffIso, null);
      seaDays += days;
      const lengthM = getEntryVesselLengthMeters(entry, vessels);
      if (!lengthM || lengthM < YM_SMALL_VESSEL_M) seaDaysSmall += days;
    });
    seaDays = Math.round(seaDays);
    seaDaysSmall = Math.round(seaDaysSmall);

    const miles = computeYachtmasterOffshoreMiles(navigationEntries, vessels);

    let longPassages = 0;
    let overnight = 0;
    let asSkipper = 0;
    let skipperDays = 0;
    (navigationEntries || []).forEach((entry) => {
      if (!isYachtmasterEligibleVessel(entry?.vesselId, vessels)) return;
      const span = passageDateSpan(entry);
      const isSkipper = entry?.passageRole === "Skipper";
      if (isSkipper) {
        const vessel = findVesselById(vessels, entry?.vesselId);
        const lengthM = parseLengthMeters(vessel?.vessel_length || vessel?.length);
        if (!lengthM || lengthM < YM_SMALL_VESSEL_M) skipperDays += span.days;
      }
      if (getPassageDistanceNm(entry) <= YM_OFFSHORE_LONG_PASSAGE_NM) return;
      longPassages += 1;
      if (span.overnight) overnight += 1;
      if (isSkipper) asSkipper += 1;
    });

    const radioHeld = holdsAnyCert(certs, YM_RADIO_CODES);
    const firstAidHeld = holdsAnyCert(certs, YM_FIRST_AID_CODES);

    const rows = [
      { key: "seaDays", label: `Days at sea on yachts up to 500GT (last ${YM_OFFSHORE_WINDOW_YEARS} years)`, current: seaDays, target: YM_OFFSHORE_SEA_DAYS, unit: "days" },
      { key: "seaDaysSmall", label: "…of which on vessels under 24m", current: seaDaysSmall, target: YM_OFFSHORE_SEA_DAYS / 2, unit: "days" },
      { key: "miles", label: "Miles on yachts up to 500GT", current: Math.round(miles.totalNm), target: miles.TARGET_NM, unit: "NM" },
      { key: "tidal", label: "…of which in tidal waters", current: Math.round(miles.tidalNm), target: miles.TIDAL_TARGET_NM, unit: "NM" },
      { key: "longPassages", label: `Passages over ${YM_OFFSHORE_LONG_PASSAGE_NM} NM`, current: longPassages, target: YM_OFFSHORE_LONG_PASSAGES, unit: "" },
      { key: "overnight", label: "…of which overnight", current: overnight, target: YM_OFFSHORE_OVERNIGHT, unit: "" },
      { key: "asSkipper", label: "…of which as skipper", current: asSkipper, target: YM_OFFSHORE_SKIPPER_PASSAGES, unit: "" },
      { key: "skipperDays", label: "Days as skipper on vessels under 24m", current: skipperDays, target: YM_OFFSHORE_SKIPPER_DAYS, unit: "days" },
      { key: "radio", label: "VHF / SRC radio certificate (or GMDSS)", current: radioHeld ? 1 : 0, target: 1, unit: "" },
      { key: "firstAid", label: "First aid certificate", current: firstAidHeld ? 1 : 0, target: 1, unit: "" }
    ].map((row) => ({
      ...row,
      met: row.current >= row.target,
      percent: row.target ? Math.min(100, Math.round((row.current / row.target) * 100)) : 0
    }));

    return { rows, met: rows.every((row) => row.met), metCount: rows.filter((row) => row.met).length };
  }

  /* RYA Yachtmaster Ocean: hold Yachtmaster Offshore or OOW Yachts <3000GT,
     plus one qualifying ocean passage within 10 years: non-stop 600 NM+,
     200 NM+ more than 50 NM from land (self-declared per passage), at least
     96 hours (4+ days between departure and arrival dates — passages have
     no times), as skipper or in charge of a watch. Celestial sights are not
     tracked. */
  const YM_OCEAN_MIN_NM = 600;
  const YM_OCEAN_MIN_DAYS = 4;
  const YM_OCEAN_PREREQ_CODES = ["RYA YMO", "IYT YMO", "OOW YACHT"];

  function computeYachtmasterOceanPassage(navigationEntries, certs) {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - YM_OFFSHORE_WINDOW_YEARS);
    const prereqHeld = holdsAnyCert(certs, YM_OCEAN_PREREQ_CODES);

    let passage = null;
    let best = null;
    (navigationEntries || []).forEach((entry) => {
      const nm = getPassageDistanceNm(entry);
      const span = passageDateSpan(entry);
      const dep = new Date(entry?.departureDate || entry?.visitedDate || "");
      const checks = {
        distance: nm >= YM_OCEAN_MIN_NM,
        offshore: !!entry?.oceanOffshore,
        duration: (span.nights || 0) >= YM_OCEAN_MIN_DAYS,
        role: entry?.passageRole === "Skipper" || entry?.passageRole === "Watch leader",
        recent: !Number.isNaN(dep.getTime()) && dep >= cutoff
      };
      const score = Object.values(checks).filter(Boolean).length;
      if (score === 5 && !passage) passage = { entry, nm, checks };
      if (!best || score > best.score || (score === best.score && nm > best.nm)) best = { entry, nm, checks, score };
    });

    return {
      prereqHeld,
      passage,
      closest: passage || best,
      met: prereqHeld && !!passage,
      MIN_NM: YM_OCEAN_MIN_NM,
      MIN_DAYS: YM_OCEAN_MIN_DAYS
    };
  }

  /* =========================================================
     MILESTONE PROGRESS (pure, context-parameterized)
     2026-08-05, per Jack: the Dashboard widget and Public Profile page both
     need to show real progress-toward-a-certificate numbers, but neither
     page loads window.SeavState (that's the private app's state store —
     public-profile.html deliberately never loads js/state.js or
     js/achievements-engine.js, it fetches its own local seatimes/vessels/
     certs/navigationAreas arrays instead, see js/public-profile.js). Rather
     than hand-duplicate achievements-engine.js's getProgressForDefinition
     switch statement a second time in js/public-profile-sections.js — which
     is exactly the "two calculations for the same thing" pattern that
     caused the watchkeeping-days confusion Jack hit earlier this session
     (see project_seav_milestone_badge_clarity_fix.md v396/v397) — the
     switch lives here ONCE, as a pure function over explicit args, and
     achievements-engine.js's getProgressForDefinition() is now a thin
     wrapper around it (passing window.SeavState-derived context). Any
     future change to a milestone's target/label belongs here, not in
     achievements-engine.js.
  ========================================================= */

  /* =========================================================
     GEOGRAPHIC CROSSINGS — derived from logged passages, 2026-08-16.

     Every one of these is a fact about a route the crew member has already
     logged on the Navigation page, so it is computed rather than claimed. A
     self-declared "I crossed the Equator" and a passage whose track runs from
     9°N to 17°S are not the same evidence, and verification depth is the gap
     the market audit names as SEA-V's weakest point.

     ONLY the four unambiguous tests live here. Canal transits, cape roundings
     and ocean crossings stay manual: a spike over the 50 real passages showed
     proximity alone over-detects badly — five passages sat inside a box around
     the Panama Canal, but only three had points at BOTH Colón and Balboa, so
     "near the canal" awarded two transits that never happened. Those need
     agreed definitions before they can be trusted to a rule.

     Validation, same spike: on real data these tests independently agreed with
     names crew had typed themselves — "Arctic Expedition – Tromsø to Svalbard"
     detected as Arctic, "Pacific Crossing – Panama to Tahiti" as Equator.
     ========================================================= */

  const ARCTIC_CIRCLE_LAT = 66.5634;
  const ANTARCTIC_CIRCLE_LAT = -66.5634;

  /**
   * Every fixed point of a passage, in order: departure, waypoints, arrival.
   * Waypoints alone aren't enough — 7 of the 50 logged passages have none, and
   * the endpoints still carry a usable track for them.
   */
  function passagePoints(entry) {
    const points = [];
    const push = (lat, lng) => {
      const la = Number(lat);
      const ln = Number(lng);
      if (Number.isFinite(la) && Number.isFinite(ln) && (la !== 0 || ln !== 0)) {
        points.push({ lat: la, lng: ln });
      }
    };

    push(entry?.fromLat, entry?.fromLng);
    (Array.isArray(entry?.waypoints) ? entry.waypoints : []).forEach((w) =>
      push(w?.lat, w?.lng)
    );
    push(entry?.toLat ?? entry?.lat, entry?.toLng ?? entry?.lng);

    return points;
  }

  function passageCrossesGeo(entry, geo) {
    const points = passagePoints(entry);
    if (points.length < 2) return false;

    const lats = points.map((p) => p.lat);

    switch (geo) {
      case "equator":
        return Math.min(...lats) < 0 && Math.max(...lats) > 0;

      case "arctic_circle":
        return Math.max(...lats) >= ARCTIC_CIRCLE_LAT;

      case "antarctic_circle":
        return Math.min(...lats) <= ANTARCTIC_CIRCLE_LAT;

      // A track that crosses the antimeridian shows up as a jump of more than
      // 180° between consecutive points, because longitude wraps at ±180. A
      // vessel cannot legitimately travel half the globe between two fixes.
      case "date_line":
        return points.some((p, i) => {
          if (i === 0) return false;
          return Math.abs(p.lng - points[i - 1].lng) > 180;
        });

      default:
        return false;
    }
  }

  /**
   * The earliest passage that crosses `geo`, or null. Earliest rather than
   * latest so the badge dates from when it was actually first achieved.
   */
  function findGeoCrossingPassage(navigationEntries, geo) {
    return (
      [...(navigationEntries || [])]
        .filter((entry) => passageCrossesGeo(entry, geo))
        .sort((a, b) =>
          String(a?.departureDate || a?.visitedDate || "").localeCompare(
            String(b?.departureDate || b?.visitedDate || "")
          )
        )[0] || null
    );
  }

  function computeGeoCrossing(navigationEntries, geo) {
    const passage = findGeoCrossingPassage(navigationEntries, geo);
    return {
      met: !!passage,
      passage,
      passageName:
        passage?.passageName ||
        [passage?.fromPort, passage?.toPort].filter(Boolean).join(" → ") ||
        "",
      date: passage?.departureDate || passage?.visitedDate || ""
    };
  }

  /* =========================================================
     MILESTONE CERTIFICATE PREREQUISITES  (Phase 1 — display only)

     Sea time is only half of what a Certificate of Competency needs. Every
     tier also requires ancillary safety courses, academic/exam modules and
     a prerequisite ticket, none of which SEA-V read anywhere before
     2026-08-16.

     PHASE 1 IS DELIBERATELY DISPLAY-ONLY. Nothing here feeds isTriggerMet()
     — no badge locks or unlocks differently because of it. It only adds rows
     to the requirement breakdown already rendered on achievements.html. That
     way an error in this table shows a crew member a wrong checklist rather
     than wrongly withholding a badge they have earned.

     Source: 'SEA-V Deck Certificate Module Requirements.xlsx' (Ancillary
     Courses Matrix + Academic Modules Matrix), cross-checked against MSN
     1858 Am.2 and the gov.uk deck-officer guidance, 2026-08-16.

     Entry shape:
       code            single catalog code that satisfies it
       anyOf           array — any ONE of these satisfies it (e.g. RYA or IYT)
       label           crew-facing wording
       heldForMonths   must have been ISSUED at least N months ago
       optional        listed as 'Opt' in the matrix — shown, never counted
       conditional     text; requirement depends on the vessel, not the tier
     ========================================================= */

  const STCW_BASIC_FOUR = [
    { code: "PST", label: "Personal Survival Techniques (A-VI/1-1)" },
    { code: "FPFF", label: "Fire Prevention & Fire Fighting (A-VI/1-2)" },
    { code: "EFA", label: "Elementary First Aid (A-VI/1-3)" },
    { code: "PSSR", label: "Personal Safety & Social Responsibility (A-VI/1-4)" }
  ];

  const PSCRB = { code: "STCW A-VI/2", label: "Survival Craft & Rescue Boats (A-VI/2)" };
  const AFF = { code: "STCW A-VI/3", label: "Advanced Fire Fighting (A-VI/3)" };
  const MED_FIRST_AID = { code: "STCW A-VI/4-1", label: "Medical First Aid (A-VI/4-1)" };
  const MED_CARE = { code: "STCW A-VI/4-2", label: "Medical Care (A-VI/4-2)" };
  const ECDIS_REQ = { code: "ECDIS", label: "ECDIS generic training" };
  const GOC = { code: "GMDSS GOC", label: "GMDSS General Operator's Certificate" };
  const ENG1_REQ = { code: "ENG1", label: "ENG1 medical fitness certificate" };
  const SECURITY_COND = {
    code: "STCW A-VI/6-2",
    label: "Designated Security Duties",
    conditional: "Required only on ISPS-registered vessels"
  };

  /* The Training Record Book is an OOW requirement on MSF 4343, but it is not
     a certificate — there is nothing to upload and no catalog code. It is a
     status the crew member keeps on their profile (profile.trbStatus, saved
     from the TRB form). Moved here from the Sea Time page 2026-08-16, per
     Jack: it belongs with the OOW progression it feeds, not with sea time.

     Kept as a status rather than converted to a manual on/off badge so
     "submitted to MCA, awaiting return" stays expressible — a boolean would
     have thrown that away. */
  const TRB_PREREQUISITE_STATES = {
    completed: { state: "held", note: "Completed" },
    submitted_to_mca: { state: "warn", note: "Submitted to the MCA — awaiting return" },
    in_progress: { state: "warn", note: "In progress" },
    not_started: { state: "miss", note: "Not started" }
  };

  const MILESTONE_PREREQUISITES = {
    // RYA ticket, not an MCA CoC — RYA's own exam prerequisites.
    yachtmaster_offshore: [
      {
        anyOf: ["RYA SRC", "IYT SRC", "GMDSS ROC", "GMDSS GOC"],
        label: "Marine radio operator's certificate (SRC or higher)"
      },
      { anyOf: ["EFA", "STCW A-VI/4-1"], label: "First aid certificate" }
    ],

    // MSN 1858 3.3. EDH's 18-month rule is the only relative-timing rule in
    // the ladder; in force since 01/01/2017.
    oow_3000gt_sea_time: [
      { anyOf: ["RYA YMO", "IYT MOY LTD"], label: "Yachtmaster Offshore or IYT MoY Limited" },
      { code: "EDH", label: "Efficient Deck Hand", heldForMonths: 18 },
      ...STCW_BASIC_FOUR,
      PSCRB,
      ECDIS_REQ,
      GOC,
      { code: "HELM-O", label: "HELM (operational)" },
      { code: "NAV RADAR OOW", label: "Navigation & Radar (OOW yachts) module" },
      { code: "GEN SHIP KNOW", label: "General Ship Knowledge (OOW yachts) module" },
      { trb: true, label: "Training Record Book (MCA-approved)" },
      ENG1_REQ,
      SECURITY_COND
    ],

    // MSN 1858 3.4 — no extra sea time, but AFF / Medical First Aid /
    // HELM(M) all start at this tier. Medical Care does NOT.
    chief_mate_3000gt_eligible: [
      { code: "OOW YACHT", label: "OOW Yachts <3000GT" },
      { anyOf: ["RYA YMOCEAN", "IYT MOY UNLTD"], label: "Yachtmaster Ocean or IYT MoY Unlimited" },
      ...STCW_BASIC_FOUR,
      PSCRB,
      AFF,
      MED_FIRST_AID,
      ECDIS_REQ,
      GOC,
      { code: "HELM-M", label: "HELM (management)" },
      ENG1_REQ,
      SECURITY_COND
    ],

    // MSN 1858 3.1. EDH is explicitly NOT required at this tier and ECDIS is
    // optional — both recorded so neither gets added later by analogy.
    master_200gt_sea_service: [
      { anyOf: ["RYA YMO", "IYT MOY LTD"], label: "Yachtmaster Offshore or IYT MoY Limited" },
      ...STCW_BASIC_FOUR,
      PSCRB,
      { anyOf: ["GMDSS ROC", "GMDSS GOC"], label: "GMDSS operator's certificate (ROC or GOC)" },
      { ...ECDIS_REQ, optional: true },
      ENG1_REQ,
      SECURITY_COND
    ],

    // MSN 1858 3.5 — Medical Care starts here. 5 academic modules.
    master_500gt_sea_service: [
      { code: "OOW YACHT", label: "OOW Yachts <3000GT" },
      ...STCW_BASIC_FOUR,
      PSCRB,
      AFF,
      MED_FIRST_AID,
      MED_CARE,
      ECDIS_REQ,
      GOC,
      { code: "HELM-M", label: "HELM (management)" },
      { code: "SEAMANSHIP MET MY", label: "Seamanship & Meteorology module" },
      { code: "STABILITY MY", label: "Stability module" },
      { code: "BUSINESS LAW MY", label: "Business & Law module" },
      { code: "NAV RADAR ARPA MY", label: "Navigation, Radar & ARPA Simulator module" },
      { code: "CELESTIAL NAV", label: "Celestial Navigation exam" },
      ENG1_REQ,
      SECURITY_COND
    ],

    // MSN 1858 3.6 — same ancillaries and modules as <500GT. Holding
    // MASTER Y500 satisfies the four Master-Yachts modules automatically
    // (matrix 'Y*'), which is why they are listed via anyOf against it.
    master_3000gt_sea_service: [
      { code: "OOW YACHT", label: "OOW Yachts <3000GT" },
      ...STCW_BASIC_FOUR,
      PSCRB,
      AFF,
      MED_FIRST_AID,
      MED_CARE,
      ECDIS_REQ,
      GOC,
      { code: "HELM-M", label: "HELM (management)" },
      { anyOf: ["MASTER Y500", "SEAMANSHIP MET MY"], label: "Seamanship & Meteorology module" },
      { anyOf: ["MASTER Y500", "STABILITY MY"], label: "Stability module" },
      { anyOf: ["MASTER Y500", "BUSINESS LAW MY"], label: "Business & Law module" },
      { anyOf: ["MASTER Y500", "NAV RADAR ARPA MY"], label: "Navigation, Radar & ARPA Simulator module" },
      { code: "CELESTIAL NAV", label: "Celestial Navigation exam" },
      ENG1_REQ,
      SECURITY_COND
    ],

    // MSN 1858 Am.2 4.3 — NAEST(M) and the 9 management modules start here.
    chief_mate_yachts_unlimited: [
      { code: "MASTER Y3000", label: "Master Yachts <3000GT" },
      ...STCW_BASIC_FOUR,
      PSCRB,
      AFF,
      MED_FIRST_AID,
      MED_CARE,
      ECDIS_REQ,
      GOC,
      { code: "HELM-M", label: "HELM (management)" },
      { code: "NAEST-M", label: "NAEST (management)" },
      { code: "APPLIED MET", label: "Applied Marine Meteorology" },
      { code: "MGT PASSAGE PLAN", label: "Management Level Passage Planning" },
      { code: "MGT BRIDGE OPS", label: "Management of Bridge Operations" },
      { code: "MGT YACHT OPS", label: "Management of Yacht Operations" },
      { code: "MARINE ENG SYS", label: "Marine Engineering Systems" },
      { code: "MARINE VESSELS SM", label: "Marine Vessels & Ship Management" },
      { code: "SHIP STABILITY TPA", label: "Ship Stability (TPA)" },
      { code: "SHIPBOARD MGT", label: "Shipboard Management" },
      { code: "SHIPMASTERS LAW", label: "Shipmaster's Law" },
      { code: "CM NAV STAB ASSESS", label: "Chief Mate Navigation & Stability assessment" },
      ENG1_REQ,
      SECURITY_COND
    ],

    // MSN 1858 Am.2 4.4 — no separate academic modules; inherits Chief Mate
    // Unlimited's, so holding that certificate covers them.
    master_yachts_unlimited: [
      { code: "MASTER Y3000", label: "Master Yachts <3000GT" },
      ...STCW_BASIC_FOUR,
      PSCRB,
      AFF,
      MED_FIRST_AID,
      MED_CARE,
      ECDIS_REQ,
      GOC,
      { code: "HELM-M", label: "HELM (management)" },
      { code: "NAEST-M", label: "NAEST (management)" },
      ENG1_REQ,
      SECURITY_COND
    ]
  };

  function prettyDate(iso) {
    if (!iso) return "";
    const d = parseDateOnly(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function addMonths(iso, months) {
    const d = parseDateOnly(iso);
    if (Number.isNaN(d.getTime())) return null;
    d.setMonth(d.getMonth() + Number(months || 0));
    return d;
  }

  /**
   * Evaluates one milestone's certificate prerequisites into rows matching the
   * shape js/achievements.js's buildRequirementRow() already renders
   * ({label, current, target, percent, note}) — target 1 renders as
   * "Met" / "Not yet", so no new UI is needed.
   */
  /**
   * Returns STRUCTURED DATA, not requirement rows (changed 2026-08-16).
   *
   * The first cut reused buildRequirementRow(), which draws a progress bar.
   * Jack's objection was right: a bar says "you are accumulating toward a
   * target", which is true of sea time and meaningless for a certificate you
   * either hold or you don't — 0% and 100% are the only values it can ever
   * take. Certificates now render as their own block (a collapsed summary
   * with a segmented meter, opening to a list grouped by state), so this
   * returns the facts and js/achievements.js decides how to draw them.
   *
   *   { total, held, items: [{ label, state, note, required }] }
   *
   * state: "held" | "warn" (expiring, or held but not yet long enough)
   *      | "exp" (expired) | "miss" (not held)
   */
  function computeMilestonePrerequisites(code, certs, profile) {
    const list = MILESTONE_PREREQUISITES[code] || [];
    if (!list.length) return null;

    const today = new Date();

    const items = list.map((req) => {
      // Not every requirement is a certificate. The TRB is a status on the
      // crew member's profile, so it resolves from there and carries an
      // `action` the UI turns into an edit affordance. 2026-08-16.
      if (req.trb) {
        const key = String(profile?.trbStatus || "not_started");
        const resolved = TRB_PREREQUISITE_STATES[key] || TRB_PREREQUISITE_STATES.not_started;
        return {
          label: req.label,
          state: resolved.state,
          note: resolved.note,
          required: true,
          action: "trb"
        };
      }

      const codes = req.anyOf || [req.code];
      const held = codes
        .map((c) => findSavedCertByCode(certs, c))
        .filter(Boolean)
        .sort((a, b) => new Date(a.issued || 0) - new Date(b.issued || 0))[0] || null;

      const row = {
        label: req.label,
        state: "miss",
        note: "",
        // Conditional rows depend on the vessel rather than the certificate
        // tier; optional rows are 'Opt' in the source matrix. Both are shown
        // but never counted, and never sit in the meter.
        required: !req.conditional && !req.optional
      };

      if (!held) {
        // Optional and conditional rows are shown but never counted (see the
        // tally below), so they are reported honestly as not held rather than
        // marked "Met" — saying a crew member holds something they don't is
        // the one thing this table must never do. 2026-08-16, per Jack.
        row.note = req.optional
          ? "Optional at this level — not required"
          : req.conditional
            ? `${req.conditional} — not on your Certificates page`
            : "Not on your Certificates page yet";
        return row;
      }

      // Expired certificates do not satisfy a requirement.
      const expired =
        !held.noExpiry && held.expiry && parseDateOnly(held.expiry) < today;
      if (expired) {
        row.state = "exp";
        row.note = `Expired ${prettyDate(held.expiry)} — renew before applying`;
        return row;
      }

      // MSN's only relative-timing rule (EDH, 18 months). Held, valid, but
      // not yet held for long enough: report the date it starts to count.
      if (req.heldForMonths && held.issued) {
        const eligibleFrom = addMonths(held.issued, req.heldForMonths);
        if (eligibleFrom && eligibleFrom > today) {
          row.state = "warn";
          row.note =
            `Held since ${prettyDate(held.issued)}. Must be held ${req.heldForMonths} months — counts from ${prettyDate(eligibleFrom.toISOString())}`;
          return row;
        }
      }

      const expiringSoon =
        !held.noExpiry && held.expiry &&
        (parseDateOnly(held.expiry) - today) / 86400000 <= 90;

      row.state = expiringSoon ? "warn" : "held";
      row.note = expiringSoon
        ? `Expires ${prettyDate(held.expiry)} — renew before applying`
        : held.issued
          ? `Issued ${prettyDate(held.issued)}`
          : "Held";
      return row;
    });

    const required = items.filter((row) => row.required);

    return {
      items,
      total: required.length,
      held: required.filter((row) => row.state === "held").length
    };
  }

  /* v582 (Jack, 2026-10-09: "if you upload a cert that is in milestone it
     should automatically complete that section"). Holding a CoC completes
     its Deck Progression group AND the groups the MCA requires before it
     (MSN 1858): e.g. OOW <3000GT also completes Yachtmaster Offshore;
     Chief Mate <3000GT also completes OOW and Yachtmaster Ocean; a higher
     Master ticket covers the smaller-vessel Master groups. Expired
     certificates count — the ticket was still earned. Matched by catalogue
     code (findSavedCertByCode), so a custom-typed certificate name does not
     count. Groups key = the badges' certGroup (js/seav-badges.js). */
  const CERT_GROUP_COMPLETED_BY = {
    "RYA Yachtmaster Offshore": [
      "RYA YMO", "IYT YMO", "RYA YMOCEAN", "IYT YMOCEAN", "OOW YACHT", "MASTER Y200",
      "CHIEF MATE Y", "MASTER Y500", "MASTER Y3000", "CHIEF MATE Y UNLTD", "MASTER Y UNLTD"
    ],
    "RYA Yachtmaster Ocean": [
      "RYA YMOCEAN", "IYT YMOCEAN", "CHIEF MATE Y", "MASTER Y3000", "CHIEF MATE Y UNLTD", "MASTER Y UNLTD"
    ],
    "Master <200GT": ["MASTER Y200", "MASTER Y500", "MASTER Y3000", "MASTER Y UNLTD"],
    "OOW Yachts <3000GT": [
      "OOW YACHT", "CHIEF MATE Y", "MASTER Y500", "MASTER Y3000", "CHIEF MATE Y UNLTD", "MASTER Y UNLTD"
    ],
    "Chief Mate Yachts <3000GT": ["CHIEF MATE Y", "MASTER Y3000", "CHIEF MATE Y UNLTD", "MASTER Y UNLTD"],
    "Master <500GT": ["MASTER Y500", "MASTER Y3000", "MASTER Y UNLTD"],
    "Master <3000GT": ["MASTER Y3000", "MASTER Y UNLTD"],
    "Chief Mate Yachts Unlimited": ["CHIEF MATE Y UNLTD", "MASTER Y UNLTD"],
    "Master Yachts Unlimited": ["MASTER Y UNLTD"]
  };

  // The saved certificate that completes this group, or null.
  function certCompletingGroup(certGroup, certs) {
    const codes = CERT_GROUP_COMPLETED_BY[certGroup];
    if (!codes) return null;
    for (const code of codes) {
      const cert = findSavedCertByCode(certs, code);
      if (cert) return cert;
    }
    return null;
  }

  function computeMilestoneProgress(definition, context) {
    if (!definition) {
      return { current: 0, target: 1, percent: 0, label: "" };
    }

    const heldCert = certCompletingGroup(definition.certGroup, context?.certs || []);
    if (heldCert) {
      return { current: 1, target: 1, percent: 100, label: `Certificate held — ${heldCert.name || heldCert.code}` };
    }

    const seatimes = context?.seatimes || [];
    const vessels = context?.vessels || [];
    const certs = context?.certs || [];
    const navigationEntries = context?.navigationAreas || [];
    const trigger = definition.trigger || { type: "manual" };

    switch (trigger.type) {
      case "sea_days": {
        // Same figure the unlock check uses (achievements-engine.js
        // getTotalSeaDays). This bar still summed totalQualifyingDays -- the
        // pre-v481 formula that double-counts watchkeeping and ignores the yard
        // cap -- so it could read "1200 / 1095, 100%" on a locked badge.
        // Fixed 2026-09-26 audit.
        const current = computeOow36MonthsOnboard(seatimes).totalDays;
        const target = Number(trigger.minDays || 0);
        return {
          current,
          target,
          percent: target ? Math.min(100, Math.round((current / target) * 100)) : 0,
          label: `${current} / ${target} qualifying days`
        };
      }
      case "oow_actual_sea_days": {
        const target = Number(trigger.minDays || 0);
        const current = computeOowSeaService(seatimes, vessels).totalActual15m;
        return {
          current,
          target,
          percent: target ? Math.min(100, Math.round((current / target) * 100)) : 0,
          label: `${current} / ${target} actual sea days (${trigger.minVesselMeters}m+)`
        };
      }
      case "oow_qualifying_days": {
        const target = Number(trigger.minDays || 0);
        const current = computeOowSeaService(seatimes, vessels).totalQualifying15m;
        return {
          current,
          target,
          percent: target ? Math.min(100, Math.round((current / target) * 100)) : 0,
          label: `${current} / ${target} qualifying days (${trigger.minVesselMeters}m+)`
        };
      }
      case "oow_eligible": {
        const met = isOowSeaTimeComplete(seatimes, vessels);
        return {
          current: met ? 1 : 0,
          target: 1,
          percent: met ? 100 : 0,
          label: met
            ? "OOW <3000GT sea-time requirements met"
            : (() => {
                const recent = computeOowRecentSeagoingService(seatimes, vessels);
                return recent.met
                  ? "Complete the OOW sea-time milestones above"
                  : `Complete the OOW sea-time milestones above, including ${recent.target} seagoing days in the last ${recent.windowYears} years (${recent.recentDays} so far)`;
              })()
        };
      }
      case "yachtmaster_offshore_ready": {
        const result = computeYachtmasterOffshoreChecklist(seatimes, vessels, navigationEntries, certs);
        return {
          current: result.metCount,
          target: result.rows.length,
          percent: Math.round((result.metCount / result.rows.length) * 100),
          label: `${result.metCount} / ${result.rows.length} Yachtmaster Offshore requirements met`
        };
      }
      case "yachtmaster_ocean_passage": {
        const result = computeYachtmasterOceanPassage(navigationEntries, certs);
        const done = (result.prereqHeld ? 1 : 0) + (result.passage ? 1 : 0);
        return {
          current: done,
          target: 2,
          percent: done * 50,
          label: result.passage
            ? `Qualifying passage: ${result.passage.entry.passageName || "logged passage"} (${Math.round(result.passage.nm)} NM)`
            : "No qualifying ocean passage logged yet"
        };
      }
      case "yachtmaster_offshore_miles": {
        const result = computeYachtmasterOffshoreMiles(navigationEntries, vessels);
        const totalPct = result.TARGET_NM
          ? Math.min(100, Math.round((result.totalNm / result.TARGET_NM) * 100))
          : 0;
        const tidalPct = result.TIDAL_TARGET_NM
          ? Math.min(100, Math.round((result.tidalNm / result.TIDAL_TARGET_NM) * 100))
          : 0;
        return {
          current: Math.round(result.totalNm),
          target: result.TARGET_NM,
          percent: Math.min(totalPct, tidalPct),
          label: `${Math.round(result.totalNm)} / ${result.TARGET_NM} NM (${Math.round(result.tidalNm)} / ${result.TIDAL_TARGET_NM} NM tidal)`
        };
      }
      case "master_200gt_gated_sea_service": {
        const result = computeMaster200SeaService(seatimes, certs);
        if (!result.held) {
          return {
            current: 0,
            target: result.TARGET_MONTHS,
            percent: 0,
            label: "Hold RYA Yachtmaster Offshore first"
          };
        }
        const monthsRounded = Math.round(result.months * 10) / 10;
        return {
          current: monthsRounded,
          target: result.TARGET_MONTHS,
          percent: result.TARGET_MONTHS
            ? Math.min(100, Math.round((result.months / result.TARGET_MONTHS) * 100))
            : 0,
          label: `${monthsRounded} / ${result.TARGET_MONTHS} months' seagoing service (since holding Yachtmaster Offshore)`
        };
      }
      case "master_500gt_gated_sea_service": {
        const result = computeMaster500SeaService(seatimes, certs, vessels);
        if (!result.held) {
          return {
            current: 0,
            target: result.ONBOARD_TARGET_MONTHS,
            percent: 0,
            label: "Hold OOW Yachts <3000GT first"
          };
        }
        const onboardMonthsRounded = Math.round(result.onboardMonths * 10) / 10;
        const onboardPct = result.ONBOARD_TARGET_MONTHS
          ? Math.min(100, Math.round((result.onboardMonths / result.ONBOARD_TARGET_MONTHS) * 100))
          : 0;
        const watchPct = result.WATCHKEEPING_TARGET
          ? Math.min(100, Math.round((result.watchkeepingDays / result.WATCHKEEPING_TARGET) * 100))
          : 0;
        return {
          current: onboardMonthsRounded,
          target: result.ONBOARD_TARGET_MONTHS,
          percent: Math.min(onboardPct, watchPct),
          label: `${onboardMonthsRounded} / ${result.ONBOARD_TARGET_MONTHS} months onboard (${result.watchkeepingDays} / ${result.WATCHKEEPING_TARGET} watchkeeping days) — since holding OOW <3000GT`
        };
      }
      case "master_3000gt_gated_sea_service": {
        const result = computeMaster3000SeaService(seatimes, certs, vessels);
        if (!result.held) {
          return {
            current: 0,
            target: result.WATCHKEEPING_TARGET,
            percent: 0,
            label: "Hold OOW Yachts <3000GT first"
          };
        }
        const watchPct = result.WATCHKEEPING_TARGET
          ? Math.min(100, Math.round((result.totalWatchkeeping15m / result.WATCHKEEPING_TARGET) * 100))
          : 0;
        const specialPct = result.specialTarget
          ? Math.min(100, Math.round((result.specialValue / result.specialTarget) * 100))
          : 0;
        const specialLabel = result.use500gtPath ? "months on 500GT+ vessels" : "months on 24m+ vessels";
        const onboardPct = result.ONBOARD_TARGET_MONTHS
          ? Math.min(100, Math.round((result.onboardMonths / result.ONBOARD_TARGET_MONTHS) * 100))
          : 0;
        return {
          current: result.totalWatchkeeping15m,
          target: result.WATCHKEEPING_TARGET,
          percent: Math.min(watchPct, specialPct, onboardPct),
          label: `${result.onboardMonths.toFixed(1)} / ${result.ONBOARD_TARGET_MONTHS} months as a deck officer, ${result.totalWatchkeeping15m} / ${result.WATCHKEEPING_TARGET} watchkeeping days (${result.specialValue.toFixed(1)} / ${result.specialTarget} ${specialLabel}) — since holding OOW <3000GT`
        };
      }
      case "chief_mate_unlimited_direct": {
        const result = computeChiefMateUnlimitedEligibility(certs);
        return {
          current: result.met ? 1 : 0,
          target: 1,
          percent: result.met ? 100 : 0,
          label: result.met
            ? "Master Yachts <3000GT held — Chief Mate Yachts Unlimited eligibility met"
            : "Hold the Master Yachts <3000GT Certificate of Competency to qualify directly"
        };
      }
      case "chief_mate_3000_eligible": {
        const result = computeChiefMate3000Eligibility(seatimes, vessels, certs);
        const missing = [];
        if (!result.oowMet) missing.push("OOW <3000GT eligibility");
        if (!result.yachtmasterOceanHeld) missing.push("RYA Yachtmaster Ocean (or IYT Master of Yachts Unlimited)");
        return {
          current: result.met ? 1 : 0,
          target: 1,
          percent: result.met ? 100 : 0,
          label: result.met
            ? "OOW <3000GT eligible and Yachtmaster Ocean / Master of Yachts Unlimited held"
            : `Still need: ${missing.join(" and ")}`
        };
      }
      case "master_unlimited_master3000_route": {
        const result = computeMasterUnlimitedSeaService(seatimes, certs, vessels);
        if (!result.held) {
          return {
            current: 0,
            target: result.ONBOARD_TARGET_MONTHS,
            percent: 0,
            label: "Hold Master Yachts <3000GT first"
          };
        }
        const onboardMonthsRounded = Math.round(result.onboardMonths * 10) / 10;
        const actualSeaMonthsRounded = Math.round(result.actualSeaMonths * 10) / 10;
        const onboardPct = result.ONBOARD_TARGET_MONTHS
          ? Math.min(100, Math.round((result.onboardMonths / result.ONBOARD_TARGET_MONTHS) * 100))
          : 0;
        const actualSeaPct = result.ACTUAL_SEA_TARGET_MONTHS
          ? Math.min(100, Math.round((result.actualSeaMonths / result.ACTUAL_SEA_TARGET_MONTHS) * 100))
          : 0;
        return {
          current: onboardMonthsRounded,
          target: result.ONBOARD_TARGET_MONTHS,
          percent: Math.min(onboardPct, actualSeaPct),
          label: `${onboardMonthsRounded} / ${result.ONBOARD_TARGET_MONTHS} months as Master on 500GT+ vessels (${actualSeaMonthsRounded} / ${result.ACTUAL_SEA_TARGET_MONTHS} months actual sea) — since holding Master <3000GT`
        };
      }
      case "manual":
      default:
        return {
          current: 0,
          target: 1,
          percent: 0,
          label: "Log this milestone on a vessel"
        };
    }
  }

  // Groups Deck Progression catalog definitions by certGroup (a cert split
  // across multiple catalog definitions — currently only OOW Yachts
  // <3000GT's 4 — collapses to ONE entry, same "last definition = complete
  // summary, others = breakdown, weakest-link percent" convention as
  // js/achievements.js's buildCertRow), then returns only the groups that
  // are NOT yet earned and have real progress (percent > 0), sorted
  // closest-to-complete first. Used by the Dashboard widget and Public
  // Profile's simplified "what am I currently working toward" list — the
  // private Milestones page keeps its own full earned+locked+in-progress
  // list untouched (js/achievements.js, not this function).
  function getInProgressCertGroups({ definitions, earnedCodes, context } = {}) {
    const defs = definitions || [];
    const earned = earnedCodes instanceof Set ? earnedCodes : new Set(earnedCodes || []);

    const groups = new Map();
    defs.forEach((definition) => {
      const key = definition.certGroup || definition.category;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(definition);
    });

    const results = [];
    groups.forEach((groupDefs, key) => {
      const primary = groupDefs[groupDefs.length - 1];
      if (earned.has(primary.code)) return;
      // v582: a held certificate completes the group — not "in progress".
      if (certCompletingGroup(key, context?.certs || [])) return;

      const progresses = groupDefs.map((d) => computeMilestoneProgress(d, context));
      const percent = progresses.length ? Math.min(...progresses.map((p) => p.percent)) : 0;
      if (percent <= 0) return;

      const weakest = progresses.reduce((worst, p) => (p.percent < worst.percent ? p : worst), progresses[0]);

      results.push({
        certGroupKey: key,
        primaryCode: primary.code,
        percent,
        label: weakest.label
      });
    });

    return results.sort((a, b) => b.percent - a.percent);
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

  /**
   * The one vessel that represents "where this crew member is now" — used by
   * the Dashboard's single-vessel card, the Public Profile's default-open
   * dropdown, and the Vessels page's default-open card. Added 2026-08-21;
   * before that the same rule was written out separately in each place, which
   * is exactly how three pages end up disagreeing about which boat is current.
   *
   * Rule: the most recently joined vessel with no end date. If nothing is
   * open-ended (the crew member is between jobs) it falls back to the most
   * recently joined vessel overall, so the answer is never empty for someone
   * with any history at all. A record with no start date sorts last rather
   * than winning on a missing value.
   *
   * Returns null for an empty list. Callers that need to know WHICH of the
   * two cases they got should test isVesselOpenEnded() themselves — a closed
   * record means "most recent", not "current", and labels must say so.
   *
   * NOT the same as getCurrentVesselIndex() above, despite the name: that one
   * deliberately returns -1 rather than guessing when nothing is open-ended
   * (2026-08-05 fix). This one is for UI that must always show something and
   * labels the fallback honestly. Don't collapse them into one.
   */
  function getCurrentVessel(vesselsInput) {
    const vessels = (vesselsInput || []).filter(Boolean);
    if (!vessels.length) return null;

    const byJoinedDesc = [...vessels].sort((a, b) => {
      const da = a.from ? new Date(a.from) : new Date(0);
      const db = b.from ? new Date(b.from) : new Date(0);
      return db - da;
    });

    return byJoinedDesc.find(isVesselOpenEnded) || byJoinedDesc[0] || null;
  }

  // A blank-but-present end date ("", "   ") means the same as no end date —
  // matches getCurrentVesselIndex's own test rather than a bare !v.to.
  function isVesselOpenEnded(v) {
    return !v?.to || !String(v.to).trim();
  }

  /**
   * Contract types for a vessel engagement, in rough order of how common
   * they are in yachting. Added 2026-08-21 per Jack.
   *
   * Source vocabulary is Yotspot's own job-search "Position Type" filter
   * (yotspot.com/job-search.html), so the words match what crew already see
   * when they look for work. Three deliberate deviations:
   *   - "Contract" is spelled out as "Fixed-term contract" — a value of
   *     "Contract" under a field labelled "Contract type" reads as a bug.
   *   - "Relief" is added. Covering someone else's leave is an everyday
   *     yachting engagement and is neither daywork nor temporary; Yotspot
   *     has no equivalent because it lists vacancies, not service history.
   *   - "Freelance" is added for the same reason.
   *
   * Single-select by design (Jack, 2026-08-21). A permanent rotational job
   * is genuinely both, but the rotation detail already has a home in the
   * vessel's Leave / rotation field, so the crew member picks the primary
   * contract shape here and the ratio lives there.
   *
   * Order matters — it is the render order of the <select>. Append new
   * values rather than reordering: saved records store the label itself.
   */
  const VESSEL_CONTRACT_TYPES = [
    "Permanent",
    "Rotational",
    "Fixed-term contract",
    "Seasonal",
    "Temporary",
    "Relief",
    "Daywork",
    "Freelance",
    "Delivery",
    "Sail racing",
    "Internship / cadetship",
    "Part-time"
  ];

  function getVesselContractType(v) {
    return String(v?.contract_type || v?.contractType || "").trim();
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

  // Single source of truth for the Current/Previous vessel pill — was
  // previously two near-identical copies of this HTML string, one in
  // js/vessels.js (private Vessels page card) and one in js/seav-cards.js
  // (public profile / dashboard card). Both callers render the exact same
  // markup for isCurrent, so this keeps them from silently drifting apart.
  // Public profile has never shown a "Previous" pill (a non-current vessel
  // there just gets no badge) — pass { includePrevious: false } to match
  // that existing behavior instead of changing it.
  function buildCurrentBadge(isCurrent, options = {}) {
    const includePrevious = options.includePrevious !== false;
    if (isCurrent) return `<span class="vessel-current-badge">Current</span>`;
    return includePrevious ? `<span class="vessel-current-badge">Previous</span>` : "";
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
  certCompletingGroup,
  parseDateOnly,
  KEYS,
  MANDATORY_CERTS,
  RECOMMENDED_CERTS,
  RANK_ROLE_GROUP_LABELS,
  CERT_CATALOG_GROUPS,
  getCertificateCatalogGroups,
  getCertificateCatalog,
  setCertificateCatalogFromDb,
  findCertificateCatalogItem,
  isMedicalFitnessCert,
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
  CREW_QUALITIES,
  CREW_QUALITY_GROUPS,
  MAX_QUALITIES,
  MAX_HIGHLIGHTS,
  getQualityLabel,
  normalizeQualities,
  normalizeHighlights,
  normalizeCategoryValue,
  collectCrewQualities,
  getEmptyLandExperienceEntry,
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
  computeOowRecentSeagoingService,
  SEAFARER_POSITIONS,
  findSeafarerPosition,
  getPositionOptionsHtml,
  isOowSeaTimeComplete,
  computeMasterSeaService,
  seatimesGatedByCertIssueDate,
  computeMaster200SeaService,
  computeMaster500SeaService,
  computeMaster3000SeaService,
  computeChiefMate3000Eligibility,
  computeChiefMateUnlimitedEligibility,
  computeMasterUnlimitedSeaService,
  computeYachtmasterOffshoreMiles,
  computeYachtmasterOffshoreChecklist,
  computeYachtmasterOceanPassage,
  computeMilestoneProgress,
  computeMilestonePrerequisites,
  computeGeoCrossing,
  passageCrossesGeo,
  MILESTONE_PREREQUISITES,
  getInProgressCertGroups,
  getSeatimeVerificationDisplay,
  getCertExpiryInfo,
  isCertNoExpiry,
  isCertExpiringOrExpired,
  getCurrentVesselIndex,
  getVesselHistory,
  getSortedVesselOptions,
  getVesselColor,
  getCurrentVessel,
  VESSEL_CONTRACT_TYPES,
  getVesselContractType,
  isVesselOpenEnded,
  getVesselRole,
  getVesselType,
  getVesselLength,
  getVesselExperience,
  buildCurrentBadge,
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