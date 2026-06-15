// /js/auth.js — Supabase Auth (Phase 2)
(function () {
  "use strict";

  const PUBLIC_PAGES = new Set([
    "index.html",
    "signup.html",
    "about.html",
    "contact.html",
    "privacy.html",
    "terms.html",
    "public-profile.html"
  ]);

  const PROTECTED_PAGES = new Set([
    "dashboard.html",
    "profile.html",
    "cv-generator.html",
    "vessels.html",
    "seatime.html",
    "certificates.html",
    "references.html",
    "achievements.html",
    "tenders.html",
    "navigation.html",
    "onboard-experience.html",
    "hobbies-interests.html",
    "specialist-qualifications.html",
    "payslips.html"
  ]);

  let currentUser = null;
  let ready = false;
  let initPromise = null;

  function currentPage() {
    const part = location.pathname.split("/").pop();
    if (!part || part === "") return "index.html";
    return part.split("?")[0].split("#")[0].toLowerCase();
  }

  function waitForSupabase(maxMs = 4000) {
    if (window.SeavSupabase) return Promise.resolve(window.SeavSupabase);

    return new Promise((resolve, reject) => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (window.SeavSupabase) {
          clearInterval(timer);
          resolve(window.SeavSupabase);
          return;
        }
        if (Date.now() - started >= maxMs) {
          clearInterval(timer);
          reject(new Error("[SEA-V] Supabase client not loaded."));
        }
      }, 50);
    });
  }

  function isProtectedPage(page = currentPage()) {
    if (PROTECTED_PAGES.has(page)) return true;
    if (PUBLIC_PAGES.has(page)) return false;
    return document.body?.classList.contains("app-page") === true;
  }

  function getUser() {
    return currentUser;
  }

  function getUserId() {
    return currentUser?.id || null;
  }

  function getUserEmail() {
    return currentUser?.email || "";
  }

  function isAuthenticated() {
    return !!currentUser;
  }

  async function refreshSession() {
    const client = await waitForSupabase();
    const { data, error } = await client.auth.getSession();
    if (error) {
      console.warn("[SEA-V] Session check failed:", error);
      currentUser = null;
      return null;
    }
    currentUser = data.session?.user || null;
    if (!currentUser) {
      const userResult = await client.auth.getUser();
      if (!userResult.error && userResult.data?.user) {
        currentUser = userResult.data.user;
      }
    }
    return data.session;
  }

  async function applySession(client, session) {
    if (!session?.access_token || !session?.refresh_token) return null;
    const { data, error } = await client.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    });
    if (error) throw error;
    currentUser = data.session?.user || data.user || null;
    if (currentUser) {
      document.dispatchEvent(new CustomEvent("seav:session-active"));
      try {
        await ensureProfileRow(currentUser);
      } catch (profileErr) {
        console.warn("[SEA-V] Profile bootstrap on session apply:", profileErr);
      }
    }
    return data.session;
  }

  async function loginWithPassword(email, password) {
    const client = await waitForSupabase();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.session) {
      await applySession(client, data.session);
    } else {
      currentUser = data.user || null;
    }
    return data;
  }

  async function signUpWithPassword({ email, password, name }) {
    const client = await waitForSupabase();
    const emailRedirectTo = new URL("index.html", window.location.href).href;
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { name: name || "" },
        emailRedirectTo
      }
    });
    if (error) throw error;
    if (data.session) {
      await applySession(client, data.session);
    } else {
      currentUser = data.user || null;
    }
    return data;
  }

  async function resendConfirmationEmail(email) {
    const client = await waitForSupabase();
    const emailRedirectTo = new URL("index.html", window.location.href).href;
    const { error } = await client.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo }
    });
    if (error) throw error;
  }

  async function completeAuthFromUrl() {
    const client = await waitForSupabase();
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("[SEA-V] Email confirmation failed:", error);
        return { ok: false, error };
      }
      window.history.replaceState({}, "", window.location.pathname);
      return { ok: true };
    }

    if (window.location.hash.includes("access_token")) {
      const { data, error } = await client.auth.getSession();
      if (error) {
        console.error("[SEA-V] Session from URL failed:", error);
        return { ok: false, error };
      }
      if (data.session) {
        window.history.replaceState({}, "", window.location.pathname + window.location.search);
        return { ok: true };
      }
    }

    return { ok: false };
  }

  function authErrorMessage(err) {
    const msg = String(err?.message || err || "").toLowerCase();
    if (msg.includes("email not confirmed")) {
      return "Please confirm your email first — check your inbox and spam folder.";
    }
    if (msg.includes("invalid login credentials")) {
      return "Incorrect email or password.";
    }
    if (msg.includes("user already registered")) {
      return "An account with this email already exists. Try logging in.";
    }
    if (msg.includes("row-level security") || msg.includes("row level security")) {
      return "Profile setup failed (database security policy). Run docs/schema-phase2-auth-trigger.sql in Supabase SQL Editor, then try logging in.";
    }
    return err?.message || "Something went wrong. Please try again.";
  }

  async function logout() {
    const client = await waitForSupabase();
    const { error } = await client.auth.signOut();
    if (error) console.warn("[SEA-V] Sign out failed:", error);
    currentUser = null;

    try {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith("seav_state_cache_v1_")) {
          sessionStorage.removeItem(key);
        }
      });
      sessionStorage.removeItem("seav_setup_checked_v1");
    } catch (cacheErr) {
      console.warn("[SEA-V] Session cache clear failed:", cacheErr);
    }
  }

  async function requestPasswordReset(email) {
    const client = await waitForSupabase();
    const redirectTo = new URL("index.html", window.location.href).href;
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }

  async function deleteAccount() {
    const client = await waitForSupabase();
    const userId = getUserId();
    if (!userId) throw new Error("Not signed in.");

    const { error } = await client.rpc("delete_own_account");
    if (error) {
      // Fallback: sign out if RPC not deployed (operator deletes via Supabase dashboard)
      console.warn("[SEA-V] delete_own_account RPC unavailable:", error);
      await logout();
      throw new Error(
        "Account deletion requires delete_own_account SQL in Supabase. You have been signed out — contact support to finish deletion."
      );
    }

    await logout();
  }

  async function ensureProfileRow(user, name = "") {
    if (!user?.id) return;

    const client = await waitForSupabase();
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData.session) return;

    const profileId = String(user.id);
    const displayName = name || user.user_metadata?.name || "";
    const email = user.email || "";
    const updatedAt = new Date().toISOString();

    const { data: updated, error: updateError } = await client
      .from("profile")
      .update({ name: displayName, email, updated_at: updatedAt })
      .eq("id", profileId)
      .select("id")
      .maybeSingle();

    if (updateError) {
      console.warn("[SEA-V] Profile update failed:", updateError);
      throw updateError;
    }

    if (updated) return;

    const { error: insertError } = await client.from("profile").insert([
      {
        id: profileId,
        user_id: user.id,
        name: displayName,
        email,
        public_enabled: false,
        updated_at: updatedAt
      }
    ]);

    if (insertError) {
      console.warn("[SEA-V] Profile insert failed:", insertError);
      throw insertError;
    }
  }

  function redirectToLogin() {
    const page = currentPage();
    const params = new URLSearchParams();
    if (isProtectedPage(page)) params.set("redirect", page);
    const query = params.toString();
    window.location.replace(query ? `index.html?${query}` : "index.html");
  }

  function redirectAfterLogin() {
    const params = new URLSearchParams(location.search);
    const target = params.get("redirect") || "dashboard.html";
    const safeTarget = PROTECTED_PAGES.has(target) ? target : "dashboard.html";
    window.location.replace(safeTarget);
  }

  async function enforceRouteAccess() {
    const page = currentPage();

    if (isProtectedPage(page)) {
      if (!isAuthenticated()) {
        redirectToLogin();
        return false;
      }
      return true;
    }

    if ((page === "index.html" || page === "signup.html") && isAuthenticated()) {
      redirectAfterLogin();
      return false;
    }

    return true;
  }

  async function initAuth() {
    document.documentElement.classList.add("auth-pending");

    try {
      if (location.protocol === "file:") {
        const message =
          "SEA-V must be served over HTTP (not opened as a file). Run: python3 -m http.server 8765 then open http://localhost:8765/index.html";
        console.error("[SEA-V]", message);
        if (window.SeavFeedback?.error) {
          window.SeavFeedback.error("Local server required", message);
        }
      }

      await waitForSupabase();
      await refreshSession();

      const confirmed = await completeAuthFromUrl();
      if (confirmed.ok) {
        await refreshSession();
        if (currentUser) {
          try {
            await ensureProfileRow(currentUser);
          } catch (profileErr) {
            console.warn("[SEA-V] Profile bootstrap after confirm:", profileErr);
          }
        }
      } else if (confirmed.error) {
        sessionStorage.setItem(
          "seav_auth_notice",
          authErrorMessage(confirmed.error)
        );
      }

      window.SeavSupabase.auth.onAuthStateChange(async (event, session) => {
        currentUser = session?.user || null;
        if (session?.user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
          document.dispatchEvent(new CustomEvent("seav:session-active"));
          try {
            await ensureProfileRow(session.user);
          } catch (profileErr) {
            console.warn("[SEA-V] Profile bootstrap on auth state:", profileErr);
          }
        }
      });

      await enforceRouteAccess();
    } catch (err) {
      console.error(err);
      if (isProtectedPage()) redirectToLogin();
    } finally {
      ready = true;
      document.documentElement.classList.remove("auth-pending");
      document.dispatchEvent(new CustomEvent("seav:auth-ready"));
    }
  }

  window.SeavAuth = {
    ready: () => ready,
    whenReady: () => initPromise || Promise.resolve(),
    getUser,
    getUserId,
    getUserEmail,
    isAuthenticated,
    refreshSession,
    loginWithPassword,
    signUpWithPassword,
    resendConfirmationEmail,
    completeAuthFromUrl,
    authErrorMessage,
    logout,
    requestPasswordReset,
    deleteAccount,
    ensureProfileRow,
    redirectAfterLogin,
    buildStoragePath(entityId, fileName) {
      const userId = getUserId();
      if (!userId) throw new Error("[SEA-V] Sign in required before uploading files.");
      const safeName = String(fileName || "file")
        .replace(/[^\w.\-()+ ]/g, "_")
        .slice(0, 120);
      return `${userId}/${entityId}/${Date.now()}-${safeName}`;
    }
  };

  initPromise = initAuth();
})();
