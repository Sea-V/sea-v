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
    "public-profile.html",
    "verify-reference.html"
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
  let redirectingToLogin = false;
  const profileBootstrapDone = new Set();

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
    // This only matters if the Supabase "Confirm signup" email template
    // ever gets reverted to using {{ .ConfirmationURL }} (Supabase's own
    // auto-verifying link) instead of the token_hash link that points to
    // confirm-account.html. With the token_hash link (the current setup,
    // see SIGNUP-EMAIL-SETUP.md) this value is unused — .SiteURL and the
    // confirm-account.html link are controlled by the email template and
    // Supabase's Site URL setting, not by this parameter. ?confirmed=1 is
    // read by js/index.js to show the "email verified" modal.
    const emailRedirectTo = new URL("index.html?confirmed=1", window.location.href).href;
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { name: name || "" },
        emailRedirectTo
      }
    });
    if (error) throw error;

    // With email confirmation enabled, Supabase returns a fake user (empty identities)
    // instead of an error, to avoid email enumeration. Treat that as duplicate signup.
    if (
      data.user &&
      Array.isArray(data.user.identities) &&
      data.user.identities.length === 0
    ) {
      const duplicateErr = new Error("User already registered");
      duplicateErr.code = "user_already_registered";
      throw duplicateErr;
    }

    if (data.session) {
      await applySession(client, data.session);
    } else {
      currentUser = data.user || null;
    }
    return data;
  }

  async function resendConfirmationEmail(email) {
    const client = await waitForSupabase();
    // This only matters if the Supabase "Confirm signup" email template
    // ever gets reverted to using {{ .ConfirmationURL }} (Supabase's own
    // auto-verifying link) instead of the token_hash link that points to
    // confirm-account.html. With the token_hash link (the current setup,
    // see SIGNUP-EMAIL-SETUP.md) this value is unused — .SiteURL and the
    // confirm-account.html link are controlled by the email template and
    // Supabase's Site URL setting, not by this parameter. ?confirmed=1 is
    // read by js/index.js to show the "email verified" modal.
    const emailRedirectTo = new URL("index.html?confirmed=1", window.location.href).href;
    const { error } = await client.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo }
    });
    if (error) throw error;
  }

  function isPkceCrossDeviceError(err) {
    const msg = String(err?.message || err || "").toLowerCase();
    return (
      err?.code === "pkce_code_verifier_not_found" ||
      msg.includes("pkce code verifier")
    );
  }

  async function completeAuthFromUrl() {
    const client = await waitForSupabase();
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("[SEA-V] Email confirmation failed:", error);
        if (isPkceCrossDeviceError(error)) {
          window.history.replaceState({}, "", window.location.pathname);
          return { ok: false, emailConfirmed: true };
        }
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
    if (isPkceCrossDeviceError(err)) {
      return "Your email is confirmed. Log in with your email and password on this device.";
    }
    if (msg.includes("email not confirmed")) {
      return "Please confirm your email first — check your inbox and spam folder.";
    }
    if (msg.includes("invalid login credentials")) {
      return "Incorrect email or password.";
    }
    if (
      msg.includes("user already registered") ||
      msg.includes("email already") ||
      msg.includes("already been registered") ||
      err?.code === "user_already_registered" ||
      err?.code === "email_exists"
    ) {
      return "An account with this email already exists. Log in instead.";
    }
    if (msg.includes("row-level security") || msg.includes("row level security")) {
      return "Profile setup failed (database security policy). Run docs/schema-phase2-auth-trigger.sql in Supabase SQL Editor, then try logging in.";
    }
    return err?.message || "Something went wrong. Please try again.";
  }

  function clearSessionCaches() {
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

  async function logout() {
    const client = await waitForSupabase();
    const { error } = await client.auth.signOut();
    if (error) console.warn("[SEA-V] Sign out failed:", error);
    currentUser = null;
    clearSessionCaches();
  }

  async function requestPasswordReset(email) {
    const client = await waitForSupabase();
    const redirectTo = new URL("index.html", window.location.href).href;
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }

  // Every bucket that stores files under a `{userId}/...` path prefix.
  // Kept in sync with docs/schema-account-deletion.sql's bucket list.
  const USER_STORAGE_BUCKETS = [
    "achievement-files",
    "certificate-files",
    "hobbies-interest-photos",
    "onboard-experience-files",
    "payslip-files",
    "profile-photos",
    "reference-files",
    "seatime-files",
    "specialist-qualification-files",
    "tender-photos",
    "vessel-documents",
    "vessel-photos"
  ];

  // Supabase Storage's REST API only lists one folder level at a time, and
  // `.remove()` needs exact file paths (not folder prefixes) — so this walks
  // every nested folder under `prefix` to build the full flat list of files.
  // Folder entries come back from `.list()` with `id: null`; files have a
  // real id.
  async function listAllStorageFilePaths(client, bucket, prefix) {
    const paths = [];
    const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error) {
      console.warn(`[SEA-V] Could not list storage ${bucket}/${prefix}:`, error);
      return paths;
    }
    for (const entry of data || []) {
      const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) {
        paths.push(entryPath);
      } else {
        const nested = await listAllStorageFilePaths(client, bucket, entryPath);
        paths.push(...nested);
      }
    }
    return paths;
  }

  // Supabase blocks raw SQL `DELETE FROM storage.objects` ("Direct deletion
  // from storage tables is not allowed. Use the Storage API instead.") — a
  // SQL-only delete_own_account() RPC hit this on its very first statement,
  // which aborted the whole transaction and silently deleted nothing at all
  // (not the files, not the profile, not the login). Storage files have to
  // be removed here, client-side, through the Storage API before the RPC
  // touches the database rows.
  async function removeAllUserStorageFiles(client, userId) {
    for (const bucket of USER_STORAGE_BUCKETS) {
      try {
        const paths = await listAllStorageFilePaths(client, bucket, userId);
        if (!paths.length) continue;
        for (let i = 0; i < paths.length; i += 100) {
          const chunk = paths.slice(i, i + 100);
          const { error } = await client.storage.from(bucket).remove(chunk);
          if (error) {
            console.warn(`[SEA-V] Failed removing ${chunk.length} file(s) from ${bucket}:`, error);
          }
        }
      } catch (err) {
        console.warn(`[SEA-V] Storage cleanup failed for bucket ${bucket}:`, err);
      }
    }
  }

  async function deleteAccount() {
    const client = await waitForSupabase();
    const userId = getUserId();
    if (!userId) throw new Error("Not signed in.");

    await removeAllUserStorageFiles(client, userId);

    const { error } = await client.rpc("delete_own_account");
    if (error) {
      console.error("[SEA-V] delete_own_account RPC failed:", error);
      throw new Error(error.message || "Account deletion failed. Contact support to finish deletion.");
    }

    await logout();
  }

  async function ensureProfileRow(user, name = "") {
    if (!user?.id) return;
    if (profileBootstrapDone.has(user.id)) return;

    const client = await waitForSupabase();
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData.session) return;

    const profileId = String(user.id);
    const email = user.email || "";
    const updatedAt = new Date().toISOString();

    // Bootstrap-only: check whether a profile row already exists before
    // writing anything. `user.user_metadata.name` is only ever set at signup
    // time and goes stale the moment the user edits their name in
    // profile.html — this used to run an unconditional UPDATE on `name` on
    // every page load / session refresh (ensureProfileRow fires on every
    // INITIAL_SESSION auth event), which silently reverted any later name
    // change back to the signup-time value, or to "" for rows with no
    // metadata name at all (e.g. seeded directly in Supabase). Only create
    // the row if missing; if it already exists, keep `email` in sync but
    // never touch `name` again.
    const { data: existing, error: fetchError } = await client
      .from("profile")
      .select("id")
      .eq("id", profileId)
      .maybeSingle();

    if (fetchError) {
      console.warn("[SEA-V] Profile lookup failed:", fetchError);
      throw fetchError;
    }

    if (existing) {
      const { error: updateError } = await client
        .from("profile")
        .update({ email, updated_at: updatedAt })
        .eq("id", profileId);

      if (updateError) {
        console.warn("[SEA-V] Profile email sync failed:", updateError);
        throw updateError;
      }

      profileBootstrapDone.add(user.id);
      return;
    }

    const displayName = name || user.user_metadata?.name || "";
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

    profileBootstrapDone.add(user.id);
  }

  function redirectToLogin() {
    redirectingToLogin = true;
    document.documentElement.classList.add("auth-pending");
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
      } else if (confirmed.emailConfirmed) {
        sessionStorage.setItem(
          "seav_auth_notice",
          "Email confirmed — log in with your email and password."
        );
      } else if (confirmed.error) {
        sessionStorage.setItem(
          "seav_auth_notice",
          authErrorMessage(confirmed.error)
        );
        window.history.replaceState({}, "", window.location.pathname);
      }

      window.SeavSupabase.auth.onAuthStateChange(async (event, session) => {
        currentUser = session?.user || null;
        if (!currentUser && (event === "SIGNED_OUT" || event === "USER_DELETED")) {
          clearSessionCaches();
          document.dispatchEvent(new CustomEvent("seav:session-ended"));
          await enforceRouteAccess();
          return;
        }
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
      const page = currentPage();
      const redirectingFromAuthPage =
        (page === "index.html" || page === "signup.html") && isAuthenticated();
      if (!redirectingFromAuthPage && !redirectingToLogin) {
        document.documentElement.classList.remove("auth-pending");
      }
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
