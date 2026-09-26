// /js/seav-config.js — runtime configuration (load before other app scripts)
(function () {
  "use strict";

  /* Built once here so the Navigation page and the public profile can never
     drift apart on tile URL or key. Matches CARTO's own documented form
     exactly: bare host, no {s} subdomain placeholder, key as a query param.
     No {r} — Leaflet only substitutes that when detectRetina is set, which we
     never set, so it has always resolved to an empty string. */
  function cartoTileUrl(style, key) {
    const base = `https://basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}.png`;
    return key ? `${base}?key=${encodeURIComponent(key)}` : base;
  }

  const isLocal =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.protocol === "file:";

  window.SeavConfig = {
    /** Bump when deploying JS/CSS changes — keep HTML ?v= in sync (see scripts/patch-html-scripts.mjs). */
    ASSET_VERSION: 531,

    /** Bump when regenerating img/badges/*.svg (cache-bust on badge image URLs). */
    BADGE_ASSET_VERSION: 30,

    /**
     * CARTO basemap key — 2026-09-13.
     *
     * CARTO began requiring a key for the raster basemaps at
     * basemaps.cartocdn.com; unkeyed tiles render with an "API KEY REQUIRED"
     * watermark repeated across the map. Free tier, 5M tile requests a month,
     * which this will never approach.
     *
     * Public by design. It ships in client-side JS and is visible to anyone
     * who views source — that is how every browser basemap key works, and is
     * NOT the same class of thing as the Resend key. CARTO's condition is that
     * it is not reused across unrelated projects, so it belongs to SEA-V only.
     *
     * THE RASTER BASEMAPS ARE BEING RETIRED. CARTO's own guidance is to move
     * to their vector basemaps. This unblocks the watermark today; it is not
     * the long-term answer.
     */
    CARTO_BASEMAP_KEY: "cb1_3iw7_1_e5868442b93b80c7e149a70a",

    /** Full Leaflet tile URL, key included. Read this, not the key. */
    get CARTO_TILE_URL() {
      return cartoTileUrl("voyager", this.CARTO_BASEMAP_KEY);
    },

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
