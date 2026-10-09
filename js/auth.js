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
    "payslips.html",
    "land-experience.html",
    "admin.html"
  ]);

  let currentUser = null;
  let ready = false;
  let initPromise = null;
  let redirectingToLogin = false;
  // True on the login page while a signed-in member still owes the
  // two-step code (the page stays put and shows the code step).
  let mfaPending = false;
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

  /* ---------------------------------------------------------
     Two-step login (v579). Supabase TOTP factors: after the password a
     member with a VERIFIED factor is on an aal1 session and must enter a
     6-digit code to reach aal2. The database enforces it too
     (docs/schema-mfa-enforcement.sql) — this is the page side.
  --------------------------------------------------------- */
  async function needsSecondFactor() {
    const client = await waitForSupabase();
    if (!client.auth.mfa) return false;
    const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return false;
    return data.currentLevel === "aal1" && data.nextLevel === "aal2";
  }

  async function listTotpFactors() {
    const client = await waitForSupabase();
    const { data, error } = await client.auth.mfa.listFactors();
    if (error) throw error;
    return (data?.all || []).filter((f) => f.factor_type === "totp");
  }

  async function verifyLoginCode(code) {
    const client = await waitForSupabase();
    const factor = (await listTotpFactors()).find((f) => f.status === "verified");
    if (!factor) throw new Error("No authenticator app is set up on this account.");
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: String(code).trim() });
    if (error) throw error;
    await refreshSession();
  }

  // Starts setup: clears any half-finished attempt, returns the QR code
  // (an SVG data URL) and the text secret for typing in by hand.
  async function startTotpSetup() {
    const client = await waitForSupabase();
    for (const factor of await listTotpFactors()) {
      if (factor.status !== "verified") await client.auth.mfa.unenroll({ factorId: factor.id });
    }
    const { data, error } = await client.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `SEA-V ${new Date().toISOString().slice(0, 16)}`
    });
    if (error) throw error;
    return { factorId: data.id, qrCode: data.totp?.qr_code || "", secret: data.totp?.secret || "" };
  }

  async function confirmTotpSetup(factorId, code) {
    const client = await waitForSupabase();
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code: String(code).trim() });
    if (error) throw error;
    await refreshSession();
  }

  async function cancelTotpSetup(factorId) {
    const client = await waitForSupabase();
    if (factorId) await client.auth.mfa.unenroll({ factorId });
  }

  async function turnOffTotp() {
    const client = await waitForSupabase();
    for (const factor of await listTotpFactors()) {
      const { error } = await client.auth.mfa.unenroll({ factorId: factor.id });
      if (error) throw error;
    }
    await client.auth.refreshSession();
    await refreshSession();
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
    // The "Reset password" email template uses a custom token_hash link to
    // reset-password.html (mirroring confirm-account.html's signup flow)
    // instead of Supabase's own auto-verifying .ConfirmationURL, so this
    // redirectTo is a fallback only — unused as long as the template keeps
    // using {{ .TokenHash }}. See reset-password.js for the actual flow.
    const redirectTo = new URL("reset-password.html", window.location.href).href;
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }

  // Every bucket that stores files under a `{userId}/...` path prefix.
  // Kept in sync with docs/schema-account-deletion.sql's bucket list.
  const USER_STORAGE_BUCKETS = [
    "achievement-files",
    "certificate-files",
    "hobbies-interest-photos",
    "land-experience-files",
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

  // v579 "Download my data" (UK/EU GDPR right of access + portability).
  // Every table that holds a member's own rows, read with their own session
  // (RLS owner policies), plus every file in their folder of every bucket.
  // Deliberately left out: reference_verification_tokens (only one-way
  // hashes, no policies) and admin_users.
  const USER_EXPORT_TABLES = [
    "profile",
    "vessels",
    "seatimes",
    "certificates",
    "achievements",
    "navigation_areas",
    "onboard_experiences",
    "onboard_skills",
    "hobbies_interests",
    "specialist_qualifications",
    "land_experiences",
    "payslips",
    "sea_references",
    "tenders",
    "cv_drafts",
    "bug_reports",
    "cert_reminder_log"
  ];

  async function loadJsZip() {
    if (typeof window.JSZip !== "undefined") return window.JSZip;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Could not load the ZIP library."));
      document.head.appendChild(script);
    });
    return window.JSZip;
  }

  // Returns { blob, fileName, counts }. onProgress(text) is optional.
  async function exportMyData(onProgress = () => {}) {
    const client = await waitForSupabase();
    const userId = getUserId();
    if (!userId) throw new Error("Not signed in.");
    const JSZip = await loadJsZip();
    const zip = new JSZip();

    const data = {};
    const counts = {};
    const problems = [];
    for (const table of USER_EXPORT_TABLES) {
      onProgress(`Reading ${table.replace(/_/g, " ")}…`);
      const { data: rows, error } = await client.from(table).select("*").eq("user_id", userId);
      if (error) {
        problems.push(`${table}: ${error.message}`);
        continue;
      }
      data[table] = rows || [];
      counts[table] = (rows || []).length;
    }

    const user = getUser();
    data.account = {
      id: userId,
      email: user?.email || "",
      created_at: user?.created_at || "",
      last_sign_in_at: user?.last_sign_in_at || ""
    };

    let fileCount = 0;
    for (const bucket of USER_STORAGE_BUCKETS) {
      const paths = await listAllStorageFilePaths(client, bucket, userId);
      for (const path of paths) {
        onProgress(`Adding files (${fileCount + 1})…`);
        const { data: blob, error } = await client.storage.from(bucket).download(path);
        if (error || !blob) {
          problems.push(`${bucket}/${path}: ${error?.message || "download failed"}`);
          continue;
        }
        zip.file(`files/${bucket}/${path.slice(userId.length + 1)}`, await blob.arrayBuffer());
        fileCount += 1;
      }
    }
    counts.files = fileCount;

    const stamp = new Date().toISOString().slice(0, 10);
    zip.file("sea-v-data.json", JSON.stringify(data, null, 2));
    zip.file(
      "README.txt",
      [
        `Your SEA-V data, exported ${stamp}.`,
        "",
        "sea-v-data.json  every record in your account, grouped by section",
        "files/           every file you uploaded, in a folder per section",
        "",
        "Records: " + Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", "),
        problems.length ? `\nCould not include:\n${problems.join("\n")}` : "",
        "",
        "Questions or a data protection request: admin@sea-v.com"
      ].join("\n")
    );

    onProgress("Building the ZIP…");
    const blob = await zip.generateAsync({ type: "blob" });
    return { blob, fileName: `sea-v-my-data-${stamp}.zip`, counts, problems };
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
      // Signed in with the password but the two-step code is still owed:
      // back to the login page's code step (the database would refuse
      // every read anyway).
      if (await needsSecondFactor()) {
        redirectToLogin();
        return false;
      }
      return true;
    }

    if ((page === "index.html" || page === "signup.html") && isAuthenticated()) {
      // index.js shows the code step instead of redirecting.
      if (await needsSecondFactor()) {
        mfaPending = true;
        return true;
      }
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
        (page === "index.html" || page === "signup.html") && isAuthenticated() && !mfaPending;
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
    exportMyData,
    needsSecondFactor,
    listTotpFactors,
    verifyLoginCode,
    startTotpSetup,
    confirmTotpSetup,
    cancelTotpSetup,
    turnOffTotp,
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
