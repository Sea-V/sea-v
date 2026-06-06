// /js/state.js
(function () {
  "use strict";

  if (!window.SeavAPI) {
    console.warn("[SEA-V] SeavAPI not found. Did you include js/api.js before state.js?");
    return;
  }

  if (!window.SeavData) {
    console.warn("[SEA-V] SeavData not found. Did you include js/seav-data.js before state.js?");
    return;
  }

  const { KEYS, DEFAULT_PROFILE } = window.SeavData;

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  const state = {
    ready: false,

    data: {
      profile: { ...DEFAULT_PROFILE },
      seatimes: [],
      certs: [],
      vessels: [],
      refs: [],
      achievements: [],
      navigationAreas: [],
      tenders: [],
      onboardExperiences: [],
      hobbiesInterests: [],
      specialistQualifications: [],
      payslips: []
    },

    async loadAll() {
      const [
        profile,
        seatimes,
        certs,
        vessels,
        refs,
        achievements,
        navigationAreas,
        tenders,
        onboardExperiences,
        hobbiesInterests,
        specialistQualifications,
        payslips
      ] = await Promise.all([
        SeavAPI.get(KEYS.PROFILE, DEFAULT_PROFILE),
        SeavAPI.getArray(KEYS.SEATIMES),
        SeavAPI.getArray(KEYS.CERTS),
        SeavAPI.getArray(KEYS.VESSELS),
        SeavAPI.getArray(KEYS.REFS),
        SeavAPI.getArray(KEYS.ACHIEVEMENTS),
        SeavAPI.getArray(KEYS.NAVIGATION_AREAS),
        SeavAPI.getArray(KEYS.TENDERS),
        SeavAPI.getArray(KEYS.ONBOARD_EXPERIENCES),
        SeavAPI.getArray(KEYS.HOBBIES_INTERESTS),
        SeavAPI.getArray(KEYS.SPECIALIST_QUALIFICATIONS),
        SeavAPI.getArray(KEYS.PAYSLIPS)
      ]);

      this.data.profile = {
        ...DEFAULT_PROFILE,
        ...(profile || {}),
        id: profile?.id || DEFAULT_PROFILE.id
      };

      this.data.seatimes = safeArray(seatimes);
      this.data.certs = safeArray(certs);
      this.data.vessels = safeArray(vessels);
      this.data.refs = safeArray(refs);
      this.data.achievements = safeArray(achievements);
      this.data.navigationAreas = safeArray(navigationAreas);
      this.data.tenders = safeArray(tenders);
      this.data.onboardExperiences = safeArray(onboardExperiences);
      this.data.hobbiesInterests = safeArray(hobbiesInterests);
      this.data.specialistQualifications = safeArray(specialistQualifications);
      this.data.payslips = safeArray(payslips);

      this.ready = true;
      return this.data;
    },

    async refresh() {
      await this.loadAll();
      document.dispatchEvent(new CustomEvent("seav:state-ready"));
      document.dispatchEvent(new CustomEvent("seav:data-updated"));
      return this.data;
    },

    get profile() {
      return this.data.profile;
    },

    get seatimes() {
      return this.data.seatimes;
    },

    get certs() {
      return this.data.certs;
    },

    get vessels() {
      return this.data.vessels;
    },

    get refs() {
      return this.data.refs;
    },

    get achievements() {
      return this.data.achievements;
    },

    get navigationAreas() {
      return this.data.navigationAreas;
    },

    get tenders() {
      return this.data.tenders;
    },

    get onboardExperiences() {
      return this.data.onboardExperiences;
    },

    get hobbiesInterests() {
      return this.data.hobbiesInterests;
    },

    get specialistQualifications() {
      return this.data.specialistQualifications;
    },

    get payslips() {
      return this.data.payslips;
    },

    async checkSetup() {
      const issues = [];

      if (!window.SeavSupabase) {
        issues.push("Supabase client not loaded — check CDN and js/supabase.js.");
        return issues;
      }

      const checks = [
        { table: "profile", hint: "Run docs/schema-full.sql" },
        { table: "vessels", hint: "Run docs/schema-full.sql" },
        { table: "hobbies_interests", hint: "Run docs/schema-full.sql" }
      ];

      for (const check of checks) {
        const { error } = await window.SeavSupabase.from(check.table).select("id").limit(1);
        if (error) {
          issues.push(`${check.table}: ${error.message} (${check.hint})`);
        }
      }

      return issues;
    }
  };

  window.SeavState = state;

  function shouldLoadAuthenticatedState() {
    const isAppPage = document.body.classList.contains("app-page");
    if (!isAppPage) return false;
    return window.SeavAuth?.isAuthenticated?.() === true;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const isAppPage = document.body.classList.contains("app-page");

    if (isAppPage && window.SeavAuth?.whenReady) {
      await window.SeavAuth.whenReady();
    }

    const loadUserData = shouldLoadAuthenticatedState();

    if (loadUserData && window.SeavFeedback?.showPageLoader) {
      window.SeavFeedback.showPageLoader(
        "Setting sail…",
        "Loading your career records"
      );
    }

    try {
      if (loadUserData) {
        await state.loadAll();
        const setupIssues = await state.checkSetup();
        if (setupIssues.length) {
          document.dispatchEvent(
            new CustomEvent("seav:setup-issues", { detail: { issues: setupIssues } })
          );
        }
      }
    } finally {
      if (loadUserData && window.SeavFeedback?.hidePageLoader) {
        window.SeavFeedback.hidePageLoader();
      }
    }

    document.dispatchEvent(new CustomEvent("seav:state-ready"));
    if (loadUserData) {
      document.dispatchEvent(new CustomEvent("seav:data-updated"));
    }
  });

  window.addEventListener("storage", async (ev) => {
    if (!ev.key || !ev.key.startsWith("seav_")) return;
    await state.refresh();
  });
})();