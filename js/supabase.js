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
      flowType: "pkce"
    }
  });
})();
