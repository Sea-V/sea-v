#!/usr/bin/env node
/**
 * Generates SEA-V achievement badges — Strava-style 3D split-face hex.
 * Run: node scripts/generate-badges.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../img/badges");

/** Split-face palettes: dark left + poppy right + bright top (Strava-inspired) */
const TIERS = {
  bronze: {
    left: "#6D4C41",
    right: "#FF7043",
    top: "#FFAB91",
    ink: "#FFFFFF",
    motif: "#FFE0B2"
  },
  silver: {
    left: "#546E7A",
    right: "#AB47BC",
    top: "#CE93D8",
    ink: "#FFFFFF",
    motif: "#F3E5F5"
  },
  gold: {
    left: "#455A64",
    right: "#FFA000",
    top: "#FFD54F",
    ink: "#FFFFFF",
    motif: "#FFF8E1"
  },
  platinum: {
    left: "#37474F",
    right: "#00ACC1",
    top: "#4DD0E1",
    ink: "#FFFFFF",
    motif: "#E0F7FA"
  },
  default: {
    left: "#37474F",
    right: "#1E88E5",
    top: "#64B5F6",
    ink: "#FFFFFF",
    motif: "#E3F2FD"
  }
};

const TOP_MOTIFS = {
  sea: `
    <path d="M18 30c8-5 14-5 22 0s14 5 22 0" stroke="currentColor" stroke-width="2" fill="none" opacity="0.85"/>
    <path d="M18 36c8-4 14-4 22 0s14 4 22 0" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.55"/>`,
  vessel: `
    <path d="M38 34h24l-3-8H41l-3 8z" fill="currentColor" opacity="0.9"/>
    <path d="M34 38c4-2 8-2 12 0s8 2 12 0 8 2 12 0" stroke="currentColor" stroke-width="1.4" fill="none" opacity="0.7"/>`,
  passage: `
    <circle cx="42" cy="32" r="2.5" fill="currentColor"/>
    <circle cx="78" cy="28" r="2.5" fill="currentColor"/>
    <path d="M45 31c10-6 20-6 32-4" stroke="currentColor" stroke-width="1.8" stroke-dasharray="3 2" fill="none"/>`,
  mountain: `
    <path d="M30 38L48 22L62 34L78 18L90 38Z" fill="currentColor" opacity="0.85"/>
    <path d="M48 22L52 38M62 34L66 38" stroke="#455A64" stroke-width="1" opacity="0.35"/>`,
  polar: `
    <path d="M48 20L52 34H68L56 42L60 56L48 42L36 34H52Z" fill="currentColor" opacity="0.9"/>`,
  watch: `
    <circle cx="60" cy="32" r="9" stroke="currentColor" stroke-width="2" fill="none"/>
    <path d="M60 27v6l4 2" stroke="currentColor" stroke-width="1.8" fill="none"/>`,
  career: `
    <path d="M60 22v14M52 30h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M52 36l8-6 8 6" stroke="currentColor" stroke-width="1.8" fill="none"/>`,
  ops: `
    <rect x="44" y="24" width="32" height="14" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/>
    <path d="M48 31h24" stroke="currentColor" stroke-width="1.5"/>`
};

const BADGE_DEFS = [
  { file: "sea-30-days", tier: "default", main: "30", side: "DAYS", sub: "SEA", motif: "sea" },
  { file: "sea-100-days", tier: "default", main: "100", side: "DAYS", sub: "SEA", motif: "sea" },
  { file: "sea-250-days", tier: "silver", main: "250", side: "DAYS", sub: "SEA", motif: "sea" },
  { file: "sea-500-days", tier: "gold", main: "500", side: "DAYS", sub: "SEA", motif: "sea" },
  { file: "sea-1-year", tier: "gold", main: "1Y", side: "SEA", sub: "TIME", motif: "sea" },
  { file: "sea-3-years", tier: "platinum", main: "3Y", side: "SEA", sub: "TIME", motif: "sea" },
  { file: "first-vessel-logged", tier: "bronze", main: "1st", side: "YACHT", sub: "VES", motif: "vessel" },
  { file: "vessels-3-served", tier: "silver", main: "3", side: "YACHT", sub: "VES", motif: "vessel" },
  { file: "vessel-types-5", tier: "gold", main: "5", side: "TYPE", sub: "VES", motif: "vessel" },
  { file: "large-yacht-50m", tier: "silver", main: "50m", side: "PLUS", sub: "YACHT", motif: "vessel" },
  { file: "explorer-vessel", tier: "silver", main: "EXP", side: "HULL", sub: "VES", motif: "vessel" },
  { file: "commercial-vessel", tier: "silver", main: "COM", side: "TRADE", sub: "VES", motif: "vessel" },
  { file: "offshore-100nm", tier: "bronze", main: "100", side: "NM", sub: "OFF", motif: "passage" },
  { file: "passage-500nm", tier: "silver", main: "500", side: "NM", sub: "PASS", motif: "passage" },
  { file: "passage-1000nm", tier: "gold", main: "1K", side: "NM", sub: "PASS", motif: "passage" },
  { file: "atlantic-crossing", tier: "gold", main: "ATL", side: "OCEAN", sub: "XING", motif: "mountain" },
  { file: "pacific-crossing", tier: "platinum", main: "PAC", side: "OCEAN", sub: "XING", motif: "mountain" },
  { file: "polar-navigation", tier: "platinum", main: "POL", side: "ICE", sub: "NAV", motif: "polar" },
  { file: "first-watchkeeping", tier: "bronze", main: "1st", side: "W/K", sub: "BRIDGE", motif: "watch" },
  { file: "watchkeeping-100-days", tier: "gold", main: "100", side: "W/K", sub: "BRIDGE", motif: "watch" },
  { file: "oow-level", tier: "gold", main: "OOW", side: "DECK", sub: "RANK", motif: "watch" },
  { file: "bridge-leader", tier: "platinum", main: "BRG", side: "LEAD", sub: "DECK", motif: "watch" },
  { file: "first-promotion", tier: "silver", main: "UP", side: "RANK", sub: "CREW", motif: "career" },
  { file: "senior-crew", tier: "gold", main: "SNR", side: "CREW", sub: "RANK", motif: "career" },
  { file: "officer-rank", tier: "gold", main: "OFC", side: "RANK", sub: "DECK", motif: "career" },
  { file: "command-experience", tier: "platinum", main: "CMD", side: "MASTER", sub: "RANK", motif: "career" },
  { file: "tender-operations", tier: "silver", main: "TDR", side: "OPS", sub: "DECK", motif: "ops" },
  { file: "watersports-operations", tier: "silver", main: "H2O", side: "OPS", sub: "TOYS", motif: "ops" },
  { file: "crane-operations", tier: "gold", main: "LIFT", side: "OPS", sub: "DECK", motif: "ops" },
  { file: "helicopter-operations", tier: "platinum", main: "HELO", side: "OPS", sub: "FLIGHT", motif: "ops" }
];

function mainFontSize(main) {
  const len = String(main).length;
  if (len >= 4) return 16;
  if (len === 3) return 20;
  return 26;
}

function buildSvg({ tier, main, side, sub, motif, locked = false }) {
  const t = TIERS[tier] || TIERS.default;
  const uid = Math.random().toString(36).slice(2, 8);
  const motifSvg = TOP_MOTIFS[motif] || TOP_MOTIFS.sea;
  const mainSize = mainFontSize(main);

  const lockOverlay = locked
    ? `
  <path d="M24 38 L60 48 L60 98 L24 78 Z" fill="#ECEFF1" opacity="0.55"/>
  <path d="M60 48 L96 38 L96 78 L60 98 Z" fill="#CFD8DC" opacity="0.65"/>
  <g transform="translate(60,66)" stroke="#78909C" fill="none" stroke-width="2" stroke-linecap="round">
    <rect x="-10" y="-7" width="20" height="16" rx="3"/>
    <path d="M-5 5v5a5 5 0 0 0 10 0v-5"/>
    <path d="M-12 1h24"/>
  </g>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img">
  <defs>
    <filter id="sh-${uid}" x="-15%" y="-10%" width="130%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#263238" flood-opacity="0.22"/>
    </filter>
  </defs>
  <g filter="url(#sh-${uid})">
    <!-- top face -->
    <path d="M24 38 L60 18 L96 38 L60 48 Z" fill="${t.top}"/>
    <g color="${t.motif}" transform="translate(0,0)">${motifSvg}</g>
    <!-- left face -->
    <path d="M24 38 L60 48 L60 98 L24 78 Z" fill="${t.left}"/>
    <!-- right face -->
    <path d="M60 48 L96 38 L96 78 L60 98 Z" fill="${t.right}"/>
    <!-- edge highlights -->
    <path d="M24 38 L60 18 L96 38" fill="none" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="1.2"/>
    <path d="M60 48 L60 98" fill="none" stroke="#000000" stroke-opacity="0.12" stroke-width="1"/>
  </g>
  <!-- vertical side label (left face) -->
  <text x="36" y="62" transform="rotate(-90 36 62)" text-anchor="middle"
    font-family="Arial,Helvetica,sans-serif" font-size="8" font-weight="800"
    letter-spacing="1.2" fill="${t.ink}" opacity="0.92">${side}</text>
  <text x="36" y="74" transform="rotate(-90 36 74)" text-anchor="middle"
    font-family="Arial,Helvetica,sans-serif" font-size="6.5" font-weight="700"
    letter-spacing="0.8" fill="${t.ink}" opacity="0.65">${sub}</text>
  <!-- main metric (right face) -->
  <text x="78" y="66" text-anchor="middle"
    font-family="Arial,Helvetica,sans-serif" font-size="${mainSize}" font-weight="900"
    fill="${t.ink}">${main}</text>
  <!-- SEA-V chevron mark -->
  <path d="M60 100 L54 106 L60 112 L66 106 Z" fill="${t.ink}" opacity="0.92"/>
  <path d="M60 104 L57 107 L63 107 Z" fill="${t.right}"/>
  ${lockOverlay}
</svg>`;
}

fs.mkdirSync(OUT, { recursive: true });

for (const def of BADGE_DEFS) {
  fs.writeFileSync(path.join(OUT, `${def.file}.svg`), buildSvg(def));
}

fs.writeFileSync(
  path.join(OUT, "locked.svg"),
  buildSvg({
    tier: "silver",
    main: "—",
    side: "LOCK",
    sub: "SEA-V",
    motif: "sea",
    locked: true
  })
);

fs.writeFileSync(
  path.join(OUT, "default.svg"),
  buildSvg({
    tier: "default",
    main: "SV",
    side: "SEA-V",
    sub: "CREW",
    motif: "sea"
  })
);

console.log(`Generated ${BADGE_DEFS.length + 2} Strava-style split hex badges in ${OUT}`);
