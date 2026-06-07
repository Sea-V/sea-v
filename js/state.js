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
  const CACHE_KEY_PREFIX = "seav_state_cache_v1_";
  const CACHE_TTL_MS = 3 * 60 * 1000;
  const SETUP_CHECK_KEY = "seav_setup_checked_v1";

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function cacheStorageKey() {
    const userId = window.SeavAuth?.getUserId?.();
    return userId ? `${CACHE_KEY_PREFIX}${userId}` : null;
  }

  function readCachedData() {
    const key = cacheStorageKey();
    if (!key) return null;

    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed?.savedAt || !parsed?.data) return null;
      if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;

      return parsed.data;
    } catch (err) {
      console.warn("[SEA-V] State cache read failed:", err);
      return null;
    }
  }

  function writeCachedData(data) {
    const key = cacheStorageKey();
    if (!key) return;

    try {
      sessionStorage.setItem(
        key,
        JSON.stringify({
          savedAt: Date.now(),
          data
        })
      );
    } catch (err) {
      console.warn("[SEA-V] State cache write failed:", err);
    }
  }

  function clearCachedData() {
    const key = cacheStorageKey();
    if (key) sessionStorage.removeItem(key);
  }

  function applyData(snapshot) {
    return {
      profile: { ...DEFAULT_PROFILE, ...(snapshot.profile || {}) },
      seatimes: safeArray(snapshot.seatimes),
      certs: safeArray(snapshot.certs),
      vessels: safeArray(snapshot.vessels),
      refs: safeArray(snapshot.refs),
      achievements: safeArray(snapshot.achievements),
      navigationAreas: safeArray(snapshot.navigationAreas),
      tenders: safeArray(snapshot.tenders),
      onboardExperiences: safeArray(snapshot.onboardExperiences),
      hobbiesInterests: safeArray(snapshot.hobbiesInterests),
      specialistQualifications: safeArray(snapshot.specialistQualifications),
      payslips: safeArray(snapshot.payslips)
    };
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

    async loadAll(options = {}) {
      const force = options.force === true;

      if (!force) {
        const cached = readCachedData();
        if (cached) {
          this.data = applyData(cached);
          this.ready = true;
          return this.data;
        }
      }

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

      this.data = applyData({
        profile: {
          ...(profile || {}),
          id: profile?.id || DEFAULT_PROFILE.id
        },
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
      });

      writeCachedData(this.data);
      this.ready = true;
      return this.data;
    },

    async refresh() {
      clearCachedData();
      await this.loadAll({ force: true });
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
    const hasWarmCache = loadUserData && !!readCachedData();

    if (loadUserData && !hasWarmCache && window.SeavFeedback?.showPageLoader) {
      window.SeavFeedback.showPageLoader(
        "Setting sail…",
        "Loading your career records"
      );
    }

    try {
      if (loadUserData) {
        await state.loadAll();

        if (!sessionStorage.getItem(SETUP_CHECK_KEY)) {
          const setupIssues = await state.checkSetup();
          if (setupIssues.length) {
            document.dispatchEvent(
              new CustomEvent("seav:setup-issues", { detail: { issues: setupIssues } })
            );
          } else {
            sessionStorage.setItem(SETUP_CHECK_KEY, "1");
          }
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