// /js/seav-config.js — runtime configuration (load before other app scripts)
(function () {
  "use strict";

  const isLocal =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.protocol === "file:";

  window.SeavConfig = {
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
    ])
  };
})();
