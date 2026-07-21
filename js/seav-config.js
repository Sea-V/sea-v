// /js/seav-config.js — runtime configuration (load before other app scripts)
(function () {
  "use strict";

  const isLocal =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.protocol === "file:";

  window.SeavConfig = {
    /** Bump when deploying JS/CSS changes — keep HTML ?v= in sync (see scripts/patch-html-scripts.mjs). */
    ASSET_VERSION: 194,

    /** Bump when regenerating img/badges/*.svg (cache-bust on badge image URLs). */
    BADGE_ASSET_VERSION: 20,

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
     * Optional Supabase Edge Function for automated verification emails.
     * Leave empty (default) — crew share the link from their own email instead.
     */
    REFERENCE_VERIFICATION_FUNCTION_URL:
      "https://bnjtrwmwyulvmsautssd.supabase.co/functions/v1/reference-verification",

    /** Set true only if you deploy the edge function and want SEA-V to email referees. */
    REFERENCE_VERIFICATION_USE_EDGE_EMAIL: false,

    /** Rewrite production verify URLs to localhost when testing locally. */
    SHOW_DEV_VERIFY_LINK: isLocal
  };
})();
