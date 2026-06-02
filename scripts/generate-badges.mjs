#!/usr/bin/env node
/**
 * Generates modern SEA-V achievement badge SVGs.
 * Run: node scripts/generate-badges.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../img/badges");

const TIERS = {
  bronze: { primary: "#cd7f32", glow: "#ffb86b", rim: "#e8a055" },
  silver: { primary: "#b8c9dc", glow: "#eef6ff", rim: "#d4e4f7" },
  gold: { primary: "#ffd25a", glow: "#ffe08a", rim: "#ffdf70" },
  platinum: { primary: "#72e4ff", glow: "#d7f4ff", rim: "#9ef0ff" },
  default: { primary: "#5bbcff", glow: "#72e4ff", rim: "#7ec8ff" }
};

/** Icon markup inside 48x48 centered group (use coordinates roughly -24..24) */
const ICONS = {
  sea_days: (n) => `
    <path d="M-20 10c6-8 12-8 20 0s14 8 20 0" stroke-width="2.2"/>
    <path d="M-20 16c6-6 12-6 20 0s14 6 20 0" stroke-width="1.6" opacity="0.55"/>
    <text x="0" y="-2" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="900" fill="currentColor" stroke="none">${n}</text>`,
  sea_year: (n) => `
    <circle cx="0" cy="-2" r="10" stroke-width="2"/>
    <path d="M0-12v4M0 6v4M-10-2h4M6-2h4" stroke-width="1.8"/>
    <text x="0" y="2" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="900" fill="currentColor" stroke="none">${n}</text>`,
  vessel_one: `<path d="M-16 8h32l-4-10H-12L-16 8z" stroke-width="2"/><path d="M-22 14c4-3 8-3 12 0s8 3 12 0 8 3 12 0" stroke-width="1.8"/>`,
  vessel_three: `<path d="M-18 10h12l-2-6H-16z M-2 8h12l-2-6H0z M14 10h12l-2-6H16z" stroke-width="1.6"/><path d="M-22 16c3-2 6-2 9 0" stroke-width="1.4" opacity="0.6"/>`,
  vessel_types: `<rect x="-16" y="-14" width="10" height="10" rx="2" stroke-width="1.8"/><rect x="-2" y="-14" width="10" height="10" rx="2" stroke-width="1.8"/><rect x="12" y="-14" width="10" height="10" rx="2" stroke-width="1.8"/><rect x="-9" y="0" width="10" height="10" rx="2" stroke-width="1.8"/><rect x="5" y="0" width="10" height="10" rx="2" stroke-width="1.8"/>`,
  yacht_large: `<path d="M-18 6h36l-5-12H-13L-18 6z" stroke-width="2"/><path d="M-8-6h16" stroke-width="1.6"/><path d="M-22 12c5-3 10-3 15 0s10 3 15 0" stroke-width="1.6"/>`,
  explorer: `<path d="M-16 8h32l-6-14H-10L-16 8z" stroke-width="2"/><path d="M-6-4l6-8 6 8" stroke-width="1.6"/><circle cx="14" cy="-8" r="2" fill="currentColor" stroke="none"/>`,
  commercial: `<rect x="-14" y="-8" width="28" height="16" rx="2" stroke-width="2"/><path d="M-10-8V-14h8v6M2-8V-16h8v8" stroke-width="1.6"/>`,
  passage: (nm) => `
    <circle cx="-12" cy="4" r="3" stroke-width="1.8"/>
    <circle cx="12" cy="-6" r="3" stroke-width="1.8"/>
    <path d="M-9 2c8-6 16-6 21-8" stroke-width="2" stroke-dasharray="3 2"/>
    <text x="0" y="18" text-anchor="middle" font-family="Arial,sans-serif" font-size="8" font-weight="800" fill="currentColor" stroke="none">${nm}</text>`,
  atlantic: `<path d="M-18 0c6-10 12-10 18 0M-18 6c6 10 12 10 18 0" stroke-width="1.8" opacity="0.5"/><text x="0" y="4" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="900" fill="currentColor" stroke="none">ATL</text>`,
  pacific: `<path d="M-20-4c8 0 8 16 0 16s-8-16 0-16" stroke-width="2"/><text x="0" y="4" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="900" fill="currentColor" stroke="none">PAC</text>`,
  polar: `<path d="M0-18L4-4h14L6 4l4 14-4-10H-6L-10 4l-14-8h14z" stroke-width="1.8" fill="none"/><circle cx="0" cy="0" r="3" fill="currentColor" stroke="none"/>`,
  watch_first: `<circle cx="0" cy="0" r="14" stroke-width="2"/><path d="M0-8v8l6 4" stroke-width="2"/>`,
  watch_100: `<circle cx="0" cy="0" r="14" stroke-width="2"/><path d="M0 0L0-10M0 0l8 5" stroke-width="2"/><text x="0" y="20" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="800" fill="currentColor" stroke="none">100</text>`,
  oow: `<path d="M-16 10h32M-12-10h24" stroke-width="2"/><circle cx="0" cy="0" r="5" stroke-width="1.8"/>`,
  bridge: `<path d="M-18 8h36M-14-8h28M-8-8v16M8-8v16" stroke-width="2"/><path d="M0-14L8-2H-8z" stroke-width="1.6"/>`,
  promotion: `<path d="M0 14V-6M0-6l-10 8M0-6l10 8" stroke-width="2.2"/>`,
  senior: `<path d="M0-14l4 10h12l-10 7 4 10-10-7-10 7 4-10-10-7h12z" stroke-width="1.8"/>`,
  officer: `<path d="M-16 10h32M-16 2h32M-16-6h32" stroke-width="2"/><rect x="-4" y="-14" width="8" height="6" rx="1" stroke-width="1.6"/>`,
  command: `<path d="M-8-12h16v8H-8z M-12 4h24v8H-12z" stroke-width="2"/><path d="M0-12V-18" stroke-width="2"/>`,
  tender: `<path d="M-14 6h28l-3-8H-11L-14 6z" stroke-width="2"/><path d="M-18 10c3-2 6-2 9 0s6 2 9 0" stroke-width="1.6"/>`,
  watersports: `<path d="M-20 8c5-6 10-6 15 0M-20 14c5-4 10-4 15 0" stroke-width="2"/><circle cx="0" cy="-6" r="4" stroke-width="1.8"/>`,
  crane: `<path d="M-16 12V-12h8v6h12" stroke-width="2"/><path d="M4-6v10M0 4h8" stroke-width="2"/><path d="M4 4l6 6" stroke-width="1.8"/>`,
  helicopter: `<ellipse cx="0" cy="-8" rx="16" ry="4" stroke-width="2"/><path d="M0-8v14M-6 6h12" stroke-width="2"/><path d="M-14-8h28" stroke-width="1.6" opacity="0.5"/>`
};

const BADGE_DEFS = [
  { file: "sea-30-days", tier: "default", icon: ICONS.sea_days("30") },
  { file: "sea-100-days", tier: "default", icon: ICONS.sea_days("100") },
  { file: "sea-250-days", tier: "silver", icon: ICONS.sea_days("250") },
  { file: "sea-500-days", tier: "gold", icon: ICONS.sea_days("500") },
  { file: "sea-1-year", tier: "gold", icon: ICONS.sea_year("1Y") },
  { file: "sea-3-years", tier: "platinum", icon: ICONS.sea_year("3Y") },
  { file: "first-vessel-logged", tier: "bronze", icon: ICONS.vessel_one },
  { file: "vessels-3-served", tier: "silver", icon: ICONS.vessel_three },
  { file: "vessel-types-5", tier: "gold", icon: ICONS.vessel_types },
  { file: "large-yacht-50m", tier: "silver", icon: ICONS.yacht_large },
  { file: "explorer-vessel", tier: "silver", icon: ICONS.explorer },
  { file: "commercial-vessel", tier: "silver", icon: ICONS.commercial },
  { file: "offshore-100nm", tier: "bronze", icon: ICONS.passage("100nm") },
  { file: "passage-500nm", tier: "silver", icon: ICONS.passage("500") },
  { file: "passage-1000nm", tier: "gold", icon: ICONS.passage("1000") },
  { file: "atlantic-crossing", tier: "gold", icon: ICONS.atlantic },
  { file: "pacific-crossing", tier: "platinum", icon: ICONS.pacific },
  { file: "polar-navigation", tier: "platinum", icon: ICONS.polar },
  { file: "first-watchkeeping", tier: "bronze", icon: ICONS.watch_first },
  { file: "watchkeeping-100-days", tier: "gold", icon: ICONS.watch_100 },
  { file: "oow-level", tier: "gold", icon: ICONS.oow },
  { file: "bridge-leader", tier: "platinum", icon: ICONS.bridge },
  { file: "first-promotion", tier: "silver", icon: ICONS.promotion },
  { file: "senior-crew", tier: "gold", icon: ICONS.senior },
  { file: "officer-rank", tier: "gold", icon: ICONS.officer },
  { file: "command-experience", tier: "platinum", icon: ICONS.command },
  { file: "tender-operations", tier: "silver", icon: ICONS.tender },
  { file: "watersports-operations", tier: "silver", icon: ICONS.watersports },
  { file: "crane-operations", tier: "gold", icon: ICONS.crane },
  { file: "helicopter-operations", tier: "platinum", icon: ICONS.helicopter }
];

function buildSvg({ tier, icon, locked = false }) {
  const t = TIERS[tier] || TIERS.default;
  const uid = Math.random().toString(36).slice(2, 8);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img">
  <defs>
    <linearGradient id="bg-${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a1829"/>
      <stop offset="100%" stop-color="#152a42"/>
    </linearGradient>
    <linearGradient id="rim-${uid}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${t.glow}"/>
      <stop offset="100%" stop-color="${t.primary}"/>
    </linearGradient>
    <filter id="glow-${uid}" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="${t.primary}" flood-opacity="0.45"/>
    </filter>
  </defs>
  <path d="M60 6 L108 26 L108 74 L60 114 L12 74 L12 26 Z"
    fill="url(#bg-${uid})"
    stroke="url(#rim-${uid})"
    stroke-width="2.8"
    filter="url(#glow-${uid})"/>
  <path d="M60 14 L100 31 L100 71 L60 104 L20 71 L20 31 Z"
    fill="none"
    stroke="${t.primary}"
    stroke-width="1"
    opacity="0.22"/>
  <g transform="translate(60,56)" fill="none" stroke="${t.primary}" stroke-linecap="round" stroke-linejoin="round" color="${t.primary}">
    ${icon}
  </g>
  <circle cx="60" cy="100" r="3.5" fill="${t.primary}" opacity="0.85"/>
  ${locked ? `
  <rect width="120" height="120" rx="8" fill="#0a1522" opacity="0.72"/>
  <g transform="translate(60,58)" stroke="#8fa8c4" fill="none" stroke-width="2.2" stroke-linecap="round">
    <rect x="-11" y="-8" width="22" height="18" rx="3"/>
    <path d="M-6 6v6a6 6 0 0 0 12 0v-6"/>
    <path d="M-14-2h28"/>
  </g>` : ""}
</svg>`;
}

fs.mkdirSync(OUT, { recursive: true });

for (const def of BADGE_DEFS) {
  const svg = buildSvg(def);
  fs.writeFileSync(path.join(OUT, `${def.file}.svg`), svg);
}

fs.writeFileSync(
  path.join(OUT, "locked.svg"),
  buildSvg({ tier: "silver", icon: ICONS.vessel_one, locked: true }).replace(
    /<g transform="translate\(60,56\)"[\s\S]*?<\/g>/,
    ""
  )
);

fs.writeFileSync(
  path.join(OUT, "default.svg"),
  buildSvg({ tier: "default", icon: ICONS.vessel_one })
);

console.log(`Generated ${BADGE_DEFS.length + 2} badge SVGs in ${OUT}`);
