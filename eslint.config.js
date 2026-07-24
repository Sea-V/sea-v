import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        location: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        FormData: "readonly",
        FileReader: "readonly",
        Blob: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        CustomEvent: "readonly",
        IntersectionObserver: "readonly",
        ResizeObserver: "readonly",
        L: "readonly",
        topojson: "readonly",
        supabase: "readonly",
        alert: "readonly",
        confirm: "readonly",
        navigator: "readonly",
        atob: "readonly",
        btoa: "readonly",
        File: "readonly",
        JSZip: "readonly",
        Option: "readonly",
        Image: "readonly",
        DOMParser: "readonly",
        HTMLInputElement: "readonly",
        HTMLTextAreaElement: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        createImageBitmap: "readonly",
        // App globals assigned by earlier script tags (browser only).
        Seav: "readonly",
        SeavAPI: "readonly",
        SeavPublicSupabase: "readonly",
        SeavSupabase: "readonly",
        SeavSupabaseConfig: "readonly",
        SeavConfig: "readonly",
        SeavAuth: "readonly",
        SeavReferenceVerification: "readonly",
        SeavFeedback: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", ignoreRestSiblings: true }],
      "no-undef": "warn",
      "no-empty": "warn",
      "no-control-regex": "off"
    }
  },
  {
    // Build/test scripts run under Node, not the browser — they need their
    // own globals block instead of falling through to js.configs.recommended
    // with none at all. Previously every console.log/process.env/fetch call
    // in scripts/*.mjs showed as a "no-undef" error (93 of them across 5
    // files), all false positives that just drowned out any real lint signal
    // in this directory.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        fetch: "readonly",
        __dirname: "readonly",
        require: "readonly",
        module: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", ignoreRestSiblings: true }],
      "no-undef": "warn"
    }
  }
];
