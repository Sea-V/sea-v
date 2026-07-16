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
  }
];
