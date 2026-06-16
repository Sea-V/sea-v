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
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const SETUP_CHECK_KEY = "seav_setup_checked_v1";
  const PAGE_LOADER_MIN_MS = 0;

  const FILE_HYDRATION_TABLES = [
    { stateKey: "seatimes", table: "seatimes" },
    { stateKey: "certs", table: "certificates" },
    { stateKey: "vessels", table: "vessels" },
    { stateKey: "refs", table: "sea_references" },
    { stateKey: "achievements", table: "achievements" },
    { stateKey: "tenders", table: "tenders" },
    { stateKey: "onboardExperiences", table: "onboard_experiences" },
    { stateKey: "hobbiesInterests", table: "hobbies_interests" },
    { stateKey: "specialistQualifications", table: "specialist_qualifications" },
    { stateKey: "payslips", table: "payslips" }
  ];

  const ALL_STATE_KEYS = [
    "profile",
    "seatimes",
    "certs",
    "vessels",
    "refs",
    "achievements",
    "navigationAreas",
    "tenders",
    "onboardExperiences",
    "hobbiesInterests",
    "specialistQualifications",
    "payslips"
  ];

  /** Profile + achievements power the sidebar on every app page. */
  const CORE_LOAD_KEYS = ["profile", "achievements"];

  const PAGE_LOAD_KEYS = {
    "dashboard.html": [
      "seatimes",
      "certs",
      "vessels",
      "refs",
      "navigationAreas",
      "tenders",
      "onboardExperiences",
      "hobbiesInterests",
      "specialistQualifications",
      "payslips"
    ],
    "profile.html": [],
    "cv-generator.html": [
      "seatimes",
      "certs",
      "vessels",
      "refs",
      "navigationAreas",
      "tenders",
      "onboardExperiences",
      "hobbiesInterests",
      "specialistQualifications"
    ],
    "vessels.html": ["vessels", "seatimes"],
    "seatime.html": ["seatimes", "vessels"],
    "certificates.html": ["certs"],
    "references.html": ["refs"],
    "achievements.html": ["seatimes", "vessels", "tenders"],
    "tenders.html": ["tenders", "vessels"],
    "navigation.html": ["navigationAreas", "vessels", "seatimes"],
    "onboard-experience.html": ["onboardExperiences", "vessels"],
    "hobbies-interests.html": ["hobbiesInterests"],
    "specialist-qualifications.html": ["specialistQualifications"],
    "payslips.html": ["payslips"]
  };

  const PAGE_FILE_HYDRATION_KEYS = {
    "dashboard.html": FILE_HYDRATION_TABLES.map((t) => t.stateKey),
    "profile.html": [],
    "cv-generator.html": ["vessels", "certs", "refs", "achievements"],
    "vessels.html": ["vessels"],
    "seatime.html": ["seatimes"],
    "certificates.html": ["certs"],
    "references.html": ["refs"],
    "achievements.html": ["achievements"],
    "tenders.html": ["tenders"],
    "navigation.html": [],
    "onboard-experience.html": ["onboardExperiences"],
    "hobbies-interests.html": ["hobbiesInterests"],
    "specialist-qualifications.html": ["specialistQualifications"],
    "payslips.html": ["payslips"]
  };

  function currentPageFile() {
    const part = location.pathname.split("/").pop();
    if (!part || part === "") return "dashboard.html";
    return part.split("?")[0].split("#")[0].toLowerCase();
  }

  function keysForPage(page = currentPageFile()) {
    const pageKeys = PAGE_LOAD_KEYS[page];
    const combined = pageKeys
      ? [...CORE_LOAD_KEYS, ...pageKeys]
      : ALL_STATE_KEYS;
    return [...new Set(combined)];
  }

  function deferredKeysForPage(page = currentPageFile()) {
    const immediate = new Set(keysForPage(page));
    return ALL_STATE_KEYS.filter((key) => !immediate.has(key));
  }

  function fileHydrationTablesForPage(page = currentPageFile()) {
    const allowed = new Set(
      PAGE_FILE_HYDRATION_KEYS[page] || FILE_HYDRATION_TABLES.map((t) => t.stateKey)
    );
    return FILE_HYDRATION_TABLES.filter((entry) => allowed.has(entry.stateKey));
  }

  async function fetchStateKey(key, userId) {
    switch (key) {
      case "profile":
        return window.SeavAPI.get(KEYS.PROFILE, DEFAULT_PROFILE);
      case "seatimes":
        return window.SeavAPI.getArray(KEYS.SEATIMES);
      case "certs":
        return window.SeavAPI.getArray(KEYS.CERTS);
      case "vessels":
        return window.SeavAPI.getArray(KEYS.VESSELS);
      case "refs":
        return window.SeavAPI.getArray(KEYS.REFS);
      case "achievements":
        return window.SeavAPI.getArray(KEYS.ACHIEVEMENTS);
      case "navigationAreas":
        return window.SeavAPI.getArray(KEYS.NAVIGATION_AREAS);
      case "tenders":
        return window.SeavAPI.getArray(KEYS.TENDERS);
      case "onboardExperiences":
        return window.SeavAPI.getArray(KEYS.ONBOARD_EXPERIENCES);
      case "hobbiesInterests":
        return window.SeavAPI.getArray(KEYS.HOBBIES_INTERESTS);
      case "specialistQualifications":
        return window.SeavAPI.getArray(KEYS.SPECIALIST_QUALIFICATIONS);
      case "payslips":
        return window.SeavAPI.getArray(KEYS.PAYSLIPS);
      default:
        return [];
    }
  }

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
      const loadAllKeys = options.allKeys === true;
      const skipFileHydration = options.skipFileHydration === true;

      if (!force) {
        const cached = readCachedData();
        if (cached) {
          this.data = applyData(cached);
          this.ready = true;
          if (!skipFileHydration) {
            queueBackgroundFileHydration(currentPageFile());
          }
          return this.data;
        }
      }

      let userId = await window.SeavAPI?.resolveAuthUserId?.() || window.SeavAuth?.getUserId?.() || null;
      if (!userId) {
        for (let attempt = 0; attempt < 4 && !userId; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 150));
          userId = await window.SeavAPI?.resolveAuthUserId?.() || window.SeavAuth?.getUserId?.() || null;
        }
      }

      if (!userId) {
        console.warn("[SEA-V] No active session — cannot load Supabase records.");
        this.ready = true;
        return this.data;
      }

      try {
      window.SeavAPI?.setBulkHydrateFiles?.(false);

      const page = currentPageFile();
      const loadKeys = loadAllKeys ? ALL_STATE_KEYS : keysForPage(page);
      const fetched = await Promise.all(loadKeys.map((key) => fetchStateKey(key, userId)));
      const snapshot = {};

      loadKeys.forEach((key, index) => {
        snapshot[key] = fetched[index];
      });

      window.SeavAPI?.setBulkHydrateFiles?.(true);

      this.data = applyData({
        ...this.data,
        profile: {
          ...(snapshot.profile || this.data.profile || {}),
          id: snapshot.profile?.id || userId || DEFAULT_PROFILE.id
        },
        seatimes: snapshot.seatimes ?? this.data.seatimes,
        certs: snapshot.certs ?? this.data.certs,
        vessels: snapshot.vessels ?? this.data.vessels,
        refs: snapshot.refs ?? this.data.refs,
        achievements: snapshot.achievements ?? this.data.achievements,
        navigationAreas: snapshot.navigationAreas ?? this.data.navigationAreas,
        tenders: snapshot.tenders ?? this.data.tenders,
        onboardExperiences: snapshot.onboardExperiences ?? this.data.onboardExperiences,
        hobbiesInterests: snapshot.hobbiesInterests ?? this.data.hobbiesInterests,
        specialistQualifications:
          snapshot.specialistQualifications ?? this.data.specialistQualifications,
        payslips: snapshot.payslips ?? this.data.payslips
      });

      writeCachedData(this.data);

      if (!skipFileHydration) {
        queueBackgroundFileHydration(loadAllKeys ? currentPageFile() : page);
      }

      if (!loadAllKeys) {
        queueDeferredPageLoads(page, userId);
      }
      } catch (loadErr) {
        window.SeavAPI?.setBulkHydrateFiles?.(true);
        console.error("[SEA-V] loadAll failed:", loadErr);
        if (window.SeavFeedback?.error) {
          window.SeavFeedback.error(
            "Records did not load",
            loadErr?.message || "Check the browser console (F12) and Supabase grants."
          );
        }
      }

      this.ready = true;
      return this.data;
    },

    async refresh() {
      clearCachedData();
      await this.loadAll({ force: true, allKeys: true });
      document.dispatchEvent(new CustomEvent("seav:data-updated"));
      return this.data;
    },

    updateCerts(certs) {
      this.data.certs = safeArray(certs);
      writeCachedData(this.data);
      document.dispatchEvent(new CustomEvent("seav:data-updated"));
      return this.data.certs;
    },

    patchData(partial) {
      if (!partial || typeof partial !== "object") return this.data;
      Object.keys(partial).forEach((key) => {
        if (key in this.data) {
          this.data[key] = partial[key];
        }
      });
      writeCachedData(this.data);
      return this.data;
    },

    syncCache() {
      writeCachedData(this.data);
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

  function clearStateCacheForAllUsers() {
    try {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith(CACHE_KEY_PREFIX)) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (err) {
      console.warn("[SEA-V] Could not clear state cache:", err);
    }
  }

  function isDataLikelyEmpty() {
    const profile = state.data.profile || {};
    const hasProfile =
      !!String(profile.name || "").trim() ||
      !!String(profile.email || "").trim() ||
      (profile.id && profile.id !== DEFAULT_PROFILE.id);
    const hasRecords =
      state.data.vessels.length > 0 ||
      state.data.seatimes.length > 0 ||
      state.data.certs.length > 0 ||
      state.data.refs.length > 0;
    return !hasProfile && !hasRecords;
  }

  let fileHydrationQueued = false;
  let deferredLoadQueued = false;

  async function loadDeferredKeys(page, userId) {
    const deferred = deferredKeysForPage(page);
    if (!deferred.length) return false;

    window.SeavAPI?.setBulkHydrateFiles?.(false);

    const results = await Promise.all(deferred.map((key) => fetchStateKey(key, userId)));
    const partial = {};
    deferred.forEach((key, index) => {
      partial[key] = results[index];
    });

    window.SeavAPI?.setBulkHydrateFiles?.(true);
    state.patchData(applyData({ ...state.data, ...partial }));
    document.dispatchEvent(new CustomEvent("seav:data-updated"));
    return true;
  }

  function queueDeferredPageLoads(page, userId) {
    const deferred = deferredKeysForPage(page);
    if (!deferred.length || deferredLoadQueued) return;
    deferredLoadQueued = true;

    const run = () => {
      loadDeferredKeys(page, userId)
        .catch((err) => {
          console.warn("[SEA-V] Background data load failed:", err);
        })
        .finally(() => {
          deferredLoadQueued = false;
        });
    };

    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(run, { timeout: 4000 });
    } else {
      window.setTimeout(run, 300);
    }
  }

  async function hydrateStoredFilesInBackground(page = currentPageFile()) {
    if (hydrateStoredFilesInBackground._running) {
      return hydrateStoredFilesInBackground._promise;
    }

    hydrateStoredFilesInBackground._running = true;
    hydrateStoredFilesInBackground._promise = (async () => {
      const core = window.SeavApiCore;
      if (!core?.hydrateArrayFiles) return false;

      let changed = false;

      for (const { stateKey, table } of fileHydrationTablesForPage(page)) {
        const items = state.data[stateKey];
        if (!Array.isArray(items) || !items.length) continue;

        const fields = core.ENTITY_FILE_FIELDS?.[table];
        if (!fields?.length) continue;

        const needsHydration = items.some((item) =>
          fields.some((cfg) => {
            if (cfg.isArray) {
              const files = item[cfg.field];
              return (
                Array.isArray(files) &&
                files.some((file) => file?.path && !file?.url && !file?.dataUrl)
              );
            }
            const file = item[cfg.field];
            return file?.path && !file?.url && !file?.dataUrl;
          })
        );

        if (!needsHydration) continue;

        state.data[stateKey] = await core.hydrateArrayFiles(items, table);
        changed = true;
      }

      const profilePhoto = state.data.profile?.photo;
      if (
        profilePhoto?.path &&
        !profilePhoto?.url &&
        !profilePhoto?.dataUrl &&
        core.hydrateProfilePhoto
      ) {
        state.data.profile = await core.hydrateProfilePhoto(state.data.profile);
        changed = true;
      }

      if (changed) {
        writeCachedData(state.data);
        document.dispatchEvent(new CustomEvent("seav:files-hydrated"));
        document.dispatchEvent(new CustomEvent("seav:data-updated"));
      }

      return changed;
    })();

    try {
      return await hydrateStoredFilesInBackground._promise;
    } finally {
      hydrateStoredFilesInBackground._running = false;
      hydrateStoredFilesInBackground._promise = null;
    }
  }

  function queueBackgroundFileHydration(page = currentPageFile()) {
    if (fileHydrationQueued) return;
    fileHydrationQueued = true;

    const run = () => {
      hydrateStoredFilesInBackground(page)
        .catch((err) => {
          console.warn("[SEA-V] Background file hydration failed:", err);
        })
        .finally(() => {
          fileHydrationQueued = false;
        });
    };

    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(run, { timeout: 3000 });
    } else {
      window.setTimeout(run, 150);
    }
  }

  async function ensureUserDataLoaded(force = false) {
    if (!(await shouldLoadUserData())) return state.data;
    if (ensureUserDataLoaded._pending) return ensureUserDataLoaded._pending;

    ensureUserDataLoaded._pending = (async () => {
      if (force && window.SeavAuth?.refreshSession) {
        await window.SeavAuth.refreshSession();
      }

      if (!force && state.ready && !isDataLikelyEmpty()) {
        queueBackgroundFileHydration(currentPageFile());
        return state.data;
      }

      if (force) {
        clearCachedData();
      }

      await state.loadAll({ force });

      return state.data;
    })();

    try {
      return await ensureUserDataLoaded._pending;
    } finally {
      ensureUserDataLoaded._pending = null;
    }
  }

  function shouldLoadAuthenticatedState() {
    const isAppPage = document.body.classList.contains("app-page");
    if (!isAppPage) return false;
    return window.SeavAuth?.isAuthenticated?.() === true;
  }

  async function hasSupabaseSession() {
    if (!window.SeavSupabase) return false;
    try {
      const { data } = await window.SeavSupabase.auth.getSession();
      return !!data.session?.user?.id;
    } catch {
      return false;
    }
  }

  async function shouldLoadUserData() {
    if (!document.body.classList.contains("app-page")) return false;
    if (shouldLoadAuthenticatedState()) return true;
    return await hasSupabaseSession();
  }

  window.SeavState = state;
  window.SeavState.ensureUserDataLoaded = ensureUserDataLoaded;
  window.SeavState.isDataLikelyEmpty = isDataLikelyEmpty;
  window.SeavState.clearStateCache = clearStateCacheForAllUsers;

  document.addEventListener("DOMContentLoaded", async () => {
    const isAppPage = document.body.classList.contains("app-page");

    if (isAppPage && window.SeavAuth?.whenReady) {
      await window.SeavAuth.whenReady();
    }

    const loadUserData = await shouldLoadUserData();
    let showedPageLoader = false;
    const pageLoaderStartedAt = Date.now();

    if (loadUserData && window.SeavFeedback?.showPageLoader) {
      window.SeavFeedback.showPageLoader(
        "Setting sail…",
        "Loading your career records"
      );
      showedPageLoader = true;
    }

    try {
      if (loadUserData) {
        await ensureUserDataLoaded(false);

        if (window.SeavConfig?.SHOW_DEV_VERIFY_LINK && !sessionStorage.getItem("seav_local_hint_shown")) {
          sessionStorage.setItem("seav_local_hint_shown", "1");
          window.SeavFeedback?.info?.(
            "Local dev",
            "Sign in with the same email as www.sea-v.com — your records live in Supabase, not on this computer."
          );
        }

        if (!sessionStorage.getItem(SETUP_CHECK_KEY)) {
          const runSetupCheck = () => {
            state.checkSetup().then((setupIssues) => {
              if (setupIssues.length) {
                document.dispatchEvent(
                  new CustomEvent("seav:setup-issues", { detail: { issues: setupIssues } })
                );
              } else {
                sessionStorage.setItem(SETUP_CHECK_KEY, "1");
              }
            });
          };

          if (typeof window.requestIdleCallback === "function") {
            window.requestIdleCallback(runSetupCheck, { timeout: 5000 });
          } else {
            window.setTimeout(runSetupCheck, 2000);
          }
        }

        if (isDataLikelyEmpty()) {
          document.dispatchEvent(new CustomEvent("seav:data-empty", { detail: { reason: "no-records" } }));
        }
      }
    } finally {
      if (showedPageLoader && window.SeavFeedback?.hidePageLoader) {
        const elapsed = Date.now() - pageLoaderStartedAt;
        const waitMs = Math.max(0, PAGE_LOADER_MIN_MS - elapsed);
        if (waitMs > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, waitMs));
        }
        window.SeavFeedback.hidePageLoader();
      }
    }

    document.dispatchEvent(new CustomEvent("seav:state-ready"));
    if (loadUserData) {
      document.dispatchEvent(new CustomEvent("seav:data-updated"));
    }
  });

  document.addEventListener("seav:session-active", () => {
    if (state.ready && !isDataLikelyEmpty()) return;
    ensureUserDataLoaded(true).catch((err) => {
      console.warn("[SEA-V] Session data reload failed:", err);
    });
  });

  window.addEventListener("storage", async (ev) => {
    if (!ev.key || !ev.key.startsWith("seav_")) return;
    if (ev.key.startsWith("seav_signed_url_v1:")) return;
    if (ev.key.startsWith("seav_celebrated_badge_codes")) return;
    if (ev.key === KEYS.CV_DRAFT) return;
    await state.refresh();
  });
})();