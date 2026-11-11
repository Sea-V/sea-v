// Passport-stamp art for the 15 passage achievements (v635, Jack's pick
// 2026-11-12: "B · Passport stamps"). One colour, no tiers, no gradients.
// Writes img/badges/<file>.svg for these codes only; the ticket milestone
// files are left alone (they are no longer shown as medals).
//
// The ink is baked in as --accent-blue (#5bbcff). Light theme darkens it and
// self-declared / locked stamps are greyed in CSS (css/components/badges.css),
// so one file serves every state.
//
// Run: node scripts/generate-stamps.mjs, then bump BADGE_ASSET_VERSION.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const INK = "#5bbcff";

const ICONS = {
  ocean: '<path d="M2 9c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/>',
  meridian: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M5 8h14M5 16h14" opacity=".5"/>',
  equator: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c-3 3-3 15 0 18M12 3c3 3 3 15 0 18" opacity=".5"/>',
  polar: '<circle cx="12" cy="12" r="9"/><path d="M3.5 9h17"/><path d="M12 3l1.5 3"/>',
  polarSouth: '<circle cx="12" cy="12" r="9"/><path d="M3.5 15h17"/><path d="M12 21l1.5-3"/>',
  canal: '<path d="M6 3v18M18 3v18"/><path d="M6 9h12M6 15h12"/>',
  cape: '<path d="M3 18l6-9 3 4 3-6 6 11z"/><path d="M2 21h20"/>',
  strait: '<path d="M3 4c4 3 4 13 0 16"/><path d="M21 4c-4 3-4 13 0 16"/><path d="M12 5v14" stroke-dasharray="2 2.5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M12 6l2 6-2 6-2-6z"/>'
};

// code -> [file, ring text, centre mark, icon]
const STAMPS = {
  atlantic_crossing: ["atlantic-crossing.svg", "ATLANTIC CROSSING", "ATL", "ocean"],
  pacific_crossing: ["pacific-crossing.svg", "PACIFIC CROSSING", "PAC", "ocean"],
  indian_ocean_crossing: ["indian-ocean-crossing.svg", "INDIAN OCEAN CROSSING", "IND", "ocean"],
  equator_crossing: ["equator-crossing.svg", "EQUATOR CROSSING", "0°", "equator"],
  date_line_crossing: ["date-line-crossing.svg", "INTERNATIONAL DATE LINE", "180°", "meridian"],
  arctic_circle_crossing: ["arctic-circle-crossing.svg", "ARCTIC CIRCLE", "66°N", "polar"],
  antarctic_circle_crossing: ["antarctic-circle-crossing.svg", "ANTARCTIC CIRCLE", "66°S", "polarSouth"],
  panama_canal_transit: ["panama-canal-transit.svg", "PANAMA CANAL", "9°N", "canal"],
  suez_canal_transit: ["suez-canal-transit.svg", "SUEZ CANAL", "30°N", "canal"],
  corinth_canal_transit: ["corinth-canal-transit.svg", "CORINTH CANAL", "38°N", "canal"],
  cape_horn_rounding: ["cape-horn-rounding.svg", "CAPE HORN", "56°S", "cape"],
  good_hope_rounding: ["good-hope-rounding.svg", "CAPE OF GOOD HOPE", "34°S", "cape"],
  magellan_transit: ["magellan-transit.svg", "STRAIT OF MAGELLAN", "53°S", "strait"],
  drake_passage_crossing: ["drake-passage-crossing.svg", "DRAKE PASSAGE", "58°S", "strait"],
  northwest_passage_transit: ["northwest-passage-transit.svg", "NORTHWEST PASSAGE", "74°N", "compass"],
  // Fallback for an achievement with no art of its own (DEFAULT_IMAGE).
  default: ["default.svg", "SEA-V ACHIEVEMENT", "★", "compass"]
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

// A small fixed tilt per stamp, so a grid of them reads as stamped, not
// printed. Deterministic, so the files only change when the art does.
function tiltFor(code) {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 13) - 6;
}

function stampSvg(code, [, ring, mark, icon]) {
  const id = code.replace(/_/g, "-");
  // The top arc is about 140px long at r=45; shrink long names to fit it.
  const size = Math.min(10, 140 / (ring.length * 0.74)).toFixed(2);
  const markSize = mark.length > 3 ? 13 : 15;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 132 132" role="img" aria-label="${esc(ring)}" data-style="stamp">
  <defs>
    <path id="top-${id}" d="M 21 66 A 45 45 0 0 1 111 66"/>
    <path id="bot-${id}" d="M 13 66 A 53 53 0 0 0 119 66"/>
  </defs>
  <g transform="rotate(${tiltFor(code)} 66 66)" fill="none" stroke="${INK}">
    <circle cx="66" cy="66" r="62" stroke-width="2.6"/>
    <circle cx="66" cy="66" r="57" stroke-width="0.9"/>
    <circle cx="66" cy="66" r="36" stroke-width="1.2"/>
    <g transform="translate(50 40) scale(1.333)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[icon]}</g>
    <g fill="${INK}" stroke="none" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800">
      <text font-size="${size}" letter-spacing="1.4" text-anchor="middle"><textPath href="#top-${id}" startOffset="50%">${esc(ring)}</textPath></text>
      <text font-size="7" letter-spacing="2.2" text-anchor="middle"><textPath href="#bot-${id}" startOffset="50%">★ SEA-V ★</textPath></text>
      <text x="66" y="88" font-size="${markSize}" letter-spacing="0.6" text-anchor="middle">${esc(mark)}</text>
    </g>
  </g>
</svg>
`;
}

// LOCKED_IMAGE: an empty dashed stamp outline.
fs.writeFileSync(
  path.join(ROOT, "img/badges", "locked.svg"),
  `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 132 132" role="img" aria-label="Not earned yet" data-style="stamp">
  <circle cx="66" cy="66" r="62" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="6 6"/>
</svg>
`
);

let written = 0;
for (const [code, spec] of Object.entries(STAMPS)) {
  fs.writeFileSync(path.join(ROOT, "img/badges", spec[0]), stampSvg(code, spec));
  written += 1;
}
console.log(`Wrote ${written} stamp(s).`);
