// /js/seav-cert-issuers.js — shared reference data for the Certificates
// page's "Issuing authority" and "Training provider" dropdowns.
//
// Issuing authority = the body with regulatory/certifying ownership of the
// qualification (a flag administration, the RYA, a diving agency, etc.).
// Training provider = the specific school/centre that actually ran the
// course and signed the certificate — only really applicable to STCW/short
// courses; a CoC's issuing authority and "provider" are usually the same
// (the MCA), so this field is genuinely optional on the form.
//
// Both lists are curated to what yacht crew actually hold/attend in
// practice, not an exhaustive global register — each ends in "Other" so
// anything not listed can still be typed in manually (same pattern as
// js/seav-visas.js and the certificate type picker's "Other certificate").
(function () {
  "use strict";

  const OTHER = "Other";

  const ISSUING_AUTHORITIES = [
    "UK Maritime and Coastguard Agency (MCA)",
    "Royal Yachting Association (RYA)",
    "PADI",
    "SSI (Scuba Schools International)",
    "US Coast Guard (USCG)",
    "Malta Transport Authority",
    "Cayman Islands Maritime Authority",
    "Marshall Islands Maritime Administrator",
    "Bahamas Maritime Authority",
    "Isle of Man Ship Registry",
    "South African Maritime Safety Authority (SAMSA)",
    "Australian Maritime Safety Authority (AMSA)",
    "Maritime New Zealand",
    "Danish Maritime Authority (DMA)",
    OTHER
  ];

  const TRAINING_PROVIDERS = [
    "Warsash Maritime School / Warsash Superyacht Academy",
    "UKSA (UK Sailing Academy)",
    "South West Maritime Academy",
    "Bristol Maritime Academy",
    "Bluewater Yachting (Antibes / Palma)",
    "Institut Nautique",
    "SeaScope",
    "Zephyr Yachting",
    "Palma Sea School",
    "Nautipaula",
    "Maritime Professional Training (MPT)",
    "Professional Yacht Training",
    "Resolve Maritime Academy",
    "International Yacht Training (IYT Worldwide)",
    OTHER
  ];

  window.SeavCertIssuers = { OTHER, ISSUING_AUTHORITIES, TRAINING_PROVIDERS };
})();
