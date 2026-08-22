// /js/seav-config.js — runtime configuration (load before other app scripts)
(function () {
  "use strict";

  const isLocal =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.protocol === "file:";

  window.SeavConfig = {
    /** Bump when deploying JS/CSS changes — keep HTML ?v= in sync (see scripts/patch-html-scripts.mjs). */
    ASSET_VERSION: 507,

    /** Bump when regenerating img/badges/*.svg (cache-bust on badge image URLs). */
    BADGE_ASSET_VERSION: 29,

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
     * Supabase Edge Function that sends the automated referee verification
     * email via Resend. This is the only send path — there is no manual
     * copy-paste fallback (a self-forwarded link doesn't hold the same
     * currency with a referee as a real email from SEA-V's own domain).
     */
    REFERENCE_VERIFICATION_FUNCTION_URL:
      "https://bnjtrwmwyulvmsautssd.supabase.co/functions/v1/reference-verification",

    /** Edge function is deployed and RESEND_API_KEY/REFERENCE_VERIFY_FROM_EMAIL secrets are set. */
    REFERENCE_VERIFICATION_USE_EDGE_EMAIL: true,

    /** Rewrite production verify URLs to localhost when testing locally. */
    SHOW_DEV_VERIFY_LINK: isLocal
  };
})();
