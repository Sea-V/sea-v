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
  window.SeavPublicSupabase = window.supabase.createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  });

  window.SeavSupabaseConfig = {
    url: supabaseUrl,
    anonKey: supabaseKey
  };
})();
