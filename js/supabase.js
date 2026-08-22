// /js/supabase.js
(function () {
  "use strict";

  const supabaseUrl = "https://bnjtrwmwyulvmsautssd.supabase.co";
  const supabaseKey = "sb_publishable_eYgDr9RV-6YmD9QTjF7G_A_QfR5XPCx";

  if (!window.supabase) {
    console.error("[SEA-V] Supabase library not loaded.");
    return;
  }

  window.SeavSupabase = window.supabase.createClient(supabaseUrl, supabaseKey, {
    auth: {
      detectSessionInUrl: true,
      persistSession: true,
      // Implicit flow so email confirmation links work on any device (PKCE requires same browser).
      flowType: "implicit"
    }
  });

  // Public profile reads must remain anonymous even if the viewer is signed in.
  //
  // storageKey added 2026-08-22. Without it BOTH clients default to the same
  // project-derived key (sb-<ref>-auth-token), which is what produced the
  // console warning "Multiple GoTrueClient instances detected in the same
  // browser context ... under the same storage key" on every one of the 21
  // pages that load this file. persistSession:false is not enough on its own:
  // the instance still registers against that key and can contend with the
  // signed-in client's background token refresh.
  //
  // That contention is a plausible cause of the failure already recorded in
  // js/state.js -- a momentarily failed auth resolution making getArray()
  // return [], which then got written into the 5-minute cache and made whole
  // sections vanish until it expired. A distinct key removes the shared-state
  // path entirely. This client never reads or writes a session, so the key it
  // points at stays empty; the signed-in client's key is untouched, so nobody
  // is signed out by this change.
  window.SeavPublicSupabase = window.supabase.createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
      storageKey: "sb-seav-public-noauth"
    }
  });

  window.SeavSupabaseConfig = {
    url: supabaseUrl,
    anonKey: supabaseKey
  };
})();
