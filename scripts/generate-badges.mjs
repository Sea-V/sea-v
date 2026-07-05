#!/usr/bin/env node
/**
 * Generates SEA-V achievement badge SVGs — pastel retro hex (Strava-inspired).
 * Run: node scripts/generate-badges.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../img/badges");

/** Pastel enamel-pin palette per tier */
const TIERS = {
  bronze: {
    fillTop: "#fff1e8",
    fillBottom: "#ffd9c2",
    rim: "#e09a6a",
    rimLight: "#f5c9a8",
    icon: "#a65d32",
    dot: "#e8a878"
  },
  silver: {
    fillTop: "#f6f8fc",
    fillBottom: "#e3eaf5",
    rim: "#9eb3cc",
    rimLight: "#c8d6e8",
    icon: "#5a718a",
    dot: "#a8bdd4"
  },
  gold: {
    fillTop: "#fffbeb",
    fillBottom: "#fde68a",
    rim: "#d4a017",
    rimLight: "#f5d76e",
    icon: "#92680f",
    dot: "#e8c547"
  },
  platinum: {
    fillTop: "#ecfeff",
    fillBottom: "#bae6fd",
    rim: "#38bdf8",
    rimLight: "#7dd3fc",
    icon: "#0369a1",
    dot: "#67cddd"
  },
  default: {
    fillTop: "#eff8ff",
    fillBottom: "#dbeafe",
    rim: "#3b82f6",
    rimLight: "#93c5fd",
    icon: "#1d4ed8",
    dot: "#60a5fa"
  }
};

const ICONS = {
  sea_days: (n) => `
    <path d="M-20 10c6-8 12-8 20 0s14 8 20 0" stroke-width="2.4"/>
    <path d="M-20 16c6-6 12-6 20 0s14 6 20 0" stroke-width="1.8" opacity="0.45"/>
    <text x="0" y="-2" text-anchor="middle" font-family="Georgia,serif" font-size="14" font-weight="700" fill="currentColor" stroke="none">${n}</text>`,
  sea_year: (n) => `
    <circle cx="0" cy="-2" r="11" stroke-width="2.2"/>
    <path d="M0-13v4M0 7v4M-11-2h4M7-2h4" stroke-width="1.8"/>
    <text x="0" y="2" text-anchor="middle" font-family="Georgia,serif" font-size="10" font-weight="700" fill="currentColor" stroke="none">${n}</text>`,
  vessel_one: `<path d="M-16 8h32l-4-10H-12L-16 8z" stroke-width="2.2" fill="currentColor" fill-opacity="0.12"/><path d="M-22 14c4-3 8-3 12 0s8 3 12 0 8 3 12 0" stroke-width="1.8"/>`,
  vessel_three: `<path d="M-18 10h12l-2-6H-16z M-2 8h12l-2-6H0z M14 10h12l-2-6H16z" stroke-width="1.8" fill="currentColor" fill-opacity="0.1"/><path d="M-22 16c3-2 6-2 9 0" stroke-width="1.5" opacity="0.5"/>`,
  vessel_types: `<rect x="-16" y="-14" width="10" height="10" rx="2" stroke-width="1.8" fill="currentColor" fill-opacity="0.08"/><rect x="-2" y="-14" width="10" height="10" rx="2" stroke-width="1.8" fill="currentColor" fill-opacity="0.08"/><rect x="12" y="-14" width="10" height="10" rx="2" stroke-width="1.8" fill="currentColor" fill-opacity="0.08"/><rect x="-9" y="0" width="10" height="10" rx="2" stroke-width="1.8" fill="currentColor" fill-opacity="0.08"/><rect x="5" y="0" width="10" height="10" rx="2" stroke-width="1.8" fill="currentColor" fill-opacity="0.08"/>`,
  yacht_large: `<path d="M-18 6h36l-5-12H-13L-18 6z" stroke-width="2.2" fill="currentColor" fill-opacity="0.12"/><path d="M-8-6h16" stroke-width="1.6"/><path d="M-22 12c5-3 10-3 15 0s10 3 15 0" stroke-width="1.6"/>`,
  explorer: `<path d="M-16 8h32l-6-14H-10L-16 8z" stroke-width="2.2" fill="currentColor" fill-opacity="0.1"/><path d="M-6-4l6-8 6 8" stroke-width="1.6"/><circle cx="14" cy="-8" r="2.2" fill="currentColor" stroke="none"/>`,
  commercial: `<rect x="-14" y="-8" width="28" height="16" rx="2" stroke-width="2.2" fill="currentColor" fill-opacity="0.1"/><path d="M-10-8V-14h8v6M2-8V-16h8v8" stroke-width="1.6"/>`,
  passage: (nm) => `
    <circle cx="-12" cy="4" r="3.2" stroke-width="1.8" fill="currentColor" fill-opacity="0.15"/>
    <circle cx="12" cy="-6" r="3.2" stroke-width="1.8" fill="currentColor" fill-opacity="0.15"/>
    <path d="M-9 2c8-6 16-6 21-8" stroke-width="2.2" stroke-dasharray="4 3"/>
    <text x="0" y="18" text-anchor="middle" font-family="Georgia,serif" font-size="8" font-weight="700" fill="currentColor" stroke="none">${nm}</text>`,
  atlantic: `<path d="M-18 0c6-10 12-10 18 0M-18 6c6 10 12 10 18 0" stroke-width="1.8" opacity="0.45"/><text x="0" y="4" text-anchor="middle" font-family="Georgia,serif" font-size="11" font-weight="700" fill="currentColor" stroke="none">ATL</text>`,
  pacific: `<path d="M-20-4c8 0 8 16 0 16s-8-16 0-16" stroke-width="2.2"/><text x="0" y="4" text-anchor="middle" font-family="Georgia,serif" font-size="10" font-weight="700" fill="currentColor" stroke="none">PAC</text>`,
  polar: `<path d="M0-18L4-4h14L6 4l4 14-4-10H-6L-10 4l-14-8h14z" stroke-width="1.8" fill="currentColor" fill-opacity="0.08"/><circle cx="0" cy="0" r="3" fill="currentColor" stroke="none"/>`,
  watch_first: `<circle cx="0" cy="0" r="14" stroke-width="2.2" fill="currentColor" fill-opacity="0.08"/><path d="M0-8v8l6 4" stroke-width="2.2"/>`,
  watch_100: `<circle cx="0" cy="0" r="14" stroke-width="2.2" fill="currentColor" fill-opacity="0.08"/><path d="M0 0L0-10M0 0l8 5" stroke-width="2.2"/><text x="0" y="20" text-anchor="middle" font-family="Georgia,serif" font-size="9" font-weight="700" fill="currentColor" stroke="none">100</text>`,
  oow: `<path d="M-16 10h32M-12-10h24" stroke-width="2.2"/><circle cx="0" cy="0" r="5" stroke-width="1.8" fill="currentColor" fill-opacity="0.12"/>`,
  bridge: `<path d="M-18 8h36M-14-8h28M-8-8v16M8-8v16" stroke-width="2.2"/><path d="M0-14L8-2H-8z" stroke-width="1.6" fill="currentColor" fill-opacity="0.1"/>`,
  promotion: `<path d="M0 14V-6M0-6l-10 8M0-6l10 8" stroke-width="2.4"/>`,
  senior: `<path d="M0-14l4 10h12l-10 7 4 10-10-7-10 7 4-10-10-7h12z" stroke-width="1.8" fill="currentColor" fill-opacity="0.1"/>`,
  officer: `<path d="M-16 10h32M-16 2h32M-16-6h32" stroke-width="2.2"/><rect x="-4" y="-14" width="8" height="6" rx="1" stroke-width="1.6" fill="currentColor" fill-opacity="0.12"/>`,
  command: `<path d="M-8-12h16v8H-8z M-12 4h24v8H-12z" stroke-width="2.2" fill="currentColor" fill-opacity="0.1"/><path d="M0-12V-18" stroke-width="2"/>`,
  tender: `<path d="M-14 6h28l-3-8H-11L-14 6z" stroke-width="2.2" fill="currentColor" fill-opacity="0.12"/><path d="M-18 10c3-2 6-2 9 0s6 2 9 0" stroke-width="1.6"/>`,
  watersports: `<path d="M-20 8c5-6 10-6 15 0M-20 14c5-4 10-4 15 0" stroke-width="2.2"/><circle cx="0" cy="-6" r="4" stroke-width="1.8" fill="currentColor" fill-opacity="0.12"/>`,
  crane: `<path d="M-16 12V-12h8v6h12" stroke-width="2.2"/><path d="M4-6v10M0 4h8" stroke-width="2"/><path d="M4 4l6 6" stroke-width="1.8"/>`,
  helicopter: `<ellipse cx="0" cy="-8" rx="16" ry="4" stroke-width="2.2"/><path d="M0-8v14M-6 6h12" stroke-width="2.2"/><path d="M-14-8h28" stroke-width="1.6" opacity="0.45"/>`
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
    <linearGradient id="fill-${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${t.fillTop}"/>
      <stop offset="100%" stop-color="${t.fillBottom}"/>
    </linearGradient>
    <linearGradient id="rim-${uid}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${t.rimLight}"/>
      <stop offset="100%" stop-color="${t.rim}"/>
    </linearGradient>
    <pattern id="grain-${uid}" width="6" height="6" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="0.65" fill="${t.rim}" opacity="0.07"/>
      <circle cx="4" cy="4" r="0.55" fill="${t.rim}" opacity="0.05"/>
    </pattern>
    <filter id="shadow-${uid}" x="-20%" y="-10%" width="140%" height="150%">
      <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#1e3a5f" flood-opacity="0.18"/>
    </filter>
  </defs>
  <path d="M60 6 L108 26 L108 74 L60 114 L12 74 L12 26 Z"
    fill="url(#fill-${uid})"
    stroke="url(#rim-${uid})"
    stroke-width="3"
    filter="url(#shadow-${uid})"/>
  <path d="M60 6 L108 26 L108 74 L60 114 L12 74 L12 26 Z"
    fill="url(#grain-${uid})"
    stroke="none"/>
  <path d="M60 14 L100 31 L100 71 L60 104 L20 71 L20 31 Z"
    fill="none"
    stroke="${t.rim}"
    stroke-width="1.2"
    opacity="0.35"/>
  <g transform="translate(60,56)" fill="none" stroke="${t.icon}" stroke-linecap="round" stroke-linejoin="round" color="${t.icon}">
    ${icon}
  </g>
  <circle cx="60" cy="100" r="4" fill="${t.dot}" opacity="0.9"/>
  ${locked ? `
  <path d="M60 6 L108 26 L108 74 L60 114 L12 74 L12 26 Z" fill="#eef2f7" opacity="0.82"/>
  <g transform="translate(60,58)" stroke="#8fa3bc" fill="none" stroke-width="2.2" stroke-linecap="round">
    <rect x="-11" y="-8" width="22" height="18" rx="3"/>
    <path d="M-6 6v6a6 6 0 0 0 12 0v-6"/>
    <path d="M-14-2h28"/>
  </g>` : ""}
</svg>`;
}

fs.mkdirSync(OUT, { recursive: true });

for (const def of BADGE_DEFS) {
  fs.writeFileSync(path.join(OUT, `${def.file}.svg`), buildSvg(def));
}

fs.writeFileSync(
  path.join(OUT, "locked.svg"),
  buildSvg({ tier: "silver", icon: "", locked: true })
);

fs.writeFileSync(
  path.join(OUT, "default.svg"),
  buildSvg({ tier: "default", icon: ICONS.vessel_one })
);

console.log(`Generated ${BADGE_DEFS.length + 2} pastel retro badge SVGs in ${OUT}`);
