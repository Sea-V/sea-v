// /js/seav-config.js — runtime configuration (load before other app scripts)
(function () {
  "use strict";

  const isLocal =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.protocol === "file:";

  window.SeavConfig = {
    /** Bump when deploying JS/CSS changes — keep HTML ?v= in sync (see scripts/patch-html-scripts.mjs). */
    ASSET_VERSION: 54,

    /** Allow base64 dataUrl fallback when Supabase upload fails (local dev only). */
    ALLOW_DATAURL_FALLBACK: isLocal,

    /** Default signed URL lifetime (seconds). */
    SIGNED_URL_DEFAULT_SEC: 86400,

    /** Shorter TTL for sensitive document buckets. */
    SIGNED_URL_SENSITIVE_SEC: 3600,

    SENSITIVE_BUCKETS: new Set([
      "payslip-files",
      "certificate-files",
      "reference-files",
      "seatime-files",
      "vessel-documents"
    ]),

    /**
     * Supabase Edge Function URL for sending verification emails.
     * Leave empty to call RPC directly (dev: link copied to console on localhost).
     */
    REFERENCE_VERIFICATION_FUNCTION_URL:
      "https://bnjtrwmwyulvmsautssd.supabase.co/functions/v1/reference-verification",

    /** Show verification link in UI when email is not sent (localhost only). */
    SHOW_DEV_VERIFY_LINK: isLocal
  };
})();
