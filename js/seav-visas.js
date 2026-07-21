// /js/seav-visas.js — shared visa reference data used by the profile
// page's "Visas Held" picker. Curated to the visa types maritime/yacht
// crew actually hold in practice (crew work visas, multi-entry visitor
// visas for common cruising/refit/registration regions, and working
// holiday visas), rather than a generic list of every visa on earth —
// keeps the dropdown short enough to actually scan.
(function () {
  "use strict";

  const VISA_TYPES = [
    "B1/B2 Visa (USA — Visitor)",
    "C1/D Visa (USA — Crew/Transit)",
    "Schengen Visa (Multiple Entry)",
    "UK Standard Visitor Visa",
    "UK Seafarer/Transit Visa",
    "Ireland Visitor Visa",
    "Australia ETA (Subclass 601)",
    "Australia Visitor Visa (Subclass 600)",
    "Australia Working Holiday Visa (417/462)",
    "New Zealand NZeTA",
    "New Zealand Working Holiday Visa",
    "Canada eTA",
    "Canada Visitor Visa",
    "UAE Visit Visa",
    "UAE Seafarer/Crew Visa",
    "Bahamas Entry Visa",
    "Cayman Islands Work Permit",
    "Turkey e-Visa",
    "Greece National Visa (D)",
    "Spain National Visa (D)",
    "Italy National Visa (D)",
    "Croatia D Visa",
    "Montenegro Visa",
    "India e-Visa",
    "Thailand Visa",
    "Indonesia Visa on Arrival",
    "Fiji Visa",
    "China Visa",
    "Hong Kong Visa",
    "Singapore Visa",
    "Brazil e-Visa",
    "Mexico Visa",
    "South Africa Visa",
    "Seychelles Visa",
    "Multiple Entry Business Visa",
    "Other Seafarer/Crew Visa"
  ];

  window.SeavVisas = { VISA_TYPES };
})();
