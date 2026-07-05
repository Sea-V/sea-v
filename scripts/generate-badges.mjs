#!/usr/bin/env node
/**
 * Generates SEA-V achievement badges — modern gradient medallions.
 * Run: node scripts/generate-badges.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../img/badges");

/** Tier ring gradients (outer bezel) */
const TIERS = {
  bronze: { a: "#FDBA74", b: "#C2410C", c: "#FED7AA", ticks: 5 },
  silver: { a: "#E2E8F0", b: "#64748B", c: "#F8FAFC", ticks: 6 },
  gold: { a: "#FDE68A", b: "#D97706", c: "#FFFBEB", ticks: 8 },
  platinum: { a: "#67E8F9", b: "#0891B2", c: "#ECFEFF", ticks: 10 },
  default: { a: "#93C5FD", b: "#2563EB", c: "#EFF6FF", ticks: 6 }
};

/** Category inner disc + icon accent */
const CATEGORIES = {
  sea: { inner: ["#0C4A6E", "#0369A1"], accent: "#7DD3FC", glow: "#38BDF8" },
  vessel: { inner: ["#7C2D12", "#C2410C"], accent: "#FDBA74", glow: "#FB923C" },
  passage: { inner: ["#581C87", "#7E22CE"], accent: "#E9D5FF", glow: "#C084FC" },
  ocean: { inner: ["#1E3A8A", "#1D4ED8"], accent: "#FDE68A", glow: "#60A5FA" },
  polar: { inner: ["#164E63", "#0891B2"], accent: "#E0F2FE", glow: "#67E8F9" },
  watch: { inner: ["#312E81", "#4338CA"], accent: "#C7D2FE", glow: "#818CF8" },
  career: { inner: ["#14532D", "#15803D"], accent: "#BBF7D0", glow: "#4ADE80" },
  ops: { inner: ["#713F12", "#B45309"], accent: "#FEF3C7", glow: "#FBBF24" }
};

/** Large illustrated icons — centered in medallion */
const ICONS = {
  sea: `
    <path d="M34 52c6-4 12-4 18 0s12 4 18 0 12-4 18 0" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M30 58c6-3 12-3 18 0s12 3 18 0 12-3 18 0" stroke="currentColor" stroke-width="1.8" fill="none" opacity="0.55" stroke-linecap="round"/>
    <circle cx="60" cy="42" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
    <path d="M60 36v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>`,
  vessel: `
    <path d="M38 56h44l-6-14H44l-6 14z" fill="currentColor"/>
    <path d="M32 58c8-3 16-3 24 0s16 3 24 0" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M52 42h16v8H52z" fill="currentColor" opacity="0.45"/>
    <path d="M56 38h8v4h-8z" fill="currentColor" opacity="0.7"/>`,
  passage: `
    <circle cx="42" cy="46" r="4" fill="currentColor"/>
    <circle cx="78" cy="40" r="4" fill="currentColor"/>
    <path d="M46 45c12-8 24-8 30-6" stroke="currentColor" stroke-width="2.2" stroke-dasharray="4 3" fill="none" stroke-linecap="round"/>
    <path d="M54 52l6-8 6 5 8-10" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>`,
  ocean: `
    <circle cx="60" cy="48" r="18" stroke="currentColor" stroke-width="2" fill="none" opacity="0.35"/>
    <path d="M42 48c6-10 14-10 18 0s14 10 18 0" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M48 56h24l-4-8H52l-4 8z" fill="currentColor"/>`,
  polar: `
    <path d="M60 34l4 12h12l-9 7 3 12-10-7-10 7 3-12-9-7h12z" fill="currentColor"/>
    <path d="M44 58h32" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>`,
  watch: `
    <rect x="42" y="38" width="36" height="22" rx="3" stroke="currentColor" stroke-width="2" fill="none"/>
    <path d="M46 52h28" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
    <circle cx="60" cy="49" r="6" stroke="currentColor" stroke-width="1.8" fill="none"/>
    <path d="M60 46v4l2.5 1.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>`,
  career: `
    <path d="M48 38h24v6H48z" fill="currentColor" opacity="0.55"/>
    <path d="M44 44h32v6H44z" fill="currentColor" opacity="0.75"/>
    <path d="M40 50h40v6H40z" fill="currentColor"/>
    <path d="M54 56h12v4H54z" fill="currentColor" opacity="0.8"/>`,
  ops: `
    <circle cx="48" cy="48" r="8" stroke="currentColor" stroke-width="2" fill="none"/>
    <circle cx="72" cy="48" r="8" stroke="currentColor" stroke-width="2" fill="none"/>
    <path d="M54 48h12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M60 56v6M52 60h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`
};

const BADGE_DEFS = [
  { file: "sea-30-days", tier: "default", main: "30", label: "DAYS AT SEA", cat: "sea" },
  { file: "sea-100-days", tier: "default", main: "100", label: "DAYS AT SEA", cat: "sea" },
  { file: "sea-250-days", tier: "silver", main: "250", label: "DAYS AT SEA", cat: "sea" },
  { file: "sea-500-days", tier: "gold", main: "500", label: "DAYS AT SEA", cat: "sea" },
  { file: "sea-1-year", tier: "gold", main: "1 YR", label: "SEA TIME", cat: "sea" },
  { file: "sea-3-years", tier: "platinum", main: "3 YR", label: "SEA TIME", cat: "sea" },
  { file: "first-vessel-logged", tier: "bronze", main: "1ST", label: "VESSEL", cat: "vessel" },
  { file: "vessels-3-served", tier: "silver", main: "3", label: "YACHTS", cat: "vessel" },
  { file: "vessel-types-5", tier: "gold", main: "5", label: "HULL TYPES", cat: "vessel" },
  { file: "large-yacht-50m", tier: "silver", main: "50m+", label: "SUPERYACHT", cat: "vessel" },
  { file: "explorer-vessel", tier: "silver", main: "EXP", label: "EXPLORER", cat: "vessel" },
  { file: "commercial-vessel", tier: "silver", main: "COM", label: "COMMERCIAL", cat: "vessel" },
  { file: "offshore-100nm", tier: "bronze", main: "100", label: "OFFSHORE NM", cat: "passage" },
  { file: "passage-500nm", tier: "silver", main: "500", label: "PASSAGE NM", cat: "passage" },
  { file: "passage-1000nm", tier: "gold", main: "1K", label: "PASSAGE NM", cat: "passage" },
  { file: "atlantic-crossing", tier: "gold", main: "ATL", label: "CROSSING", cat: "ocean" },
  { file: "pacific-crossing", tier: "platinum", main: "PAC", label: "CROSSING", cat: "ocean" },
  { file: "polar-navigation", tier: "platinum", main: "POLAR", label: "NAVIGATION", cat: "polar" },
  { file: "first-watchkeeping", tier: "bronze", main: "1ST", label: "WATCH", cat: "watch" },
  { file: "watchkeeping-100-days", tier: "gold", main: "100", label: "BRIDGE DAYS", cat: "watch" },
  { file: "oow-level", tier: "gold", main: "OOW", label: "DECK OFFICER", cat: "watch" },
  { file: "bridge-leader", tier: "platinum", main: "LEAD", label: "BRIDGE", cat: "watch" },
  { file: "first-promotion", tier: "silver", main: "UP", label: "PROMOTION", cat: "career" },
  { file: "senior-crew", tier: "gold", main: "SNR", label: "SENIOR CREW", cat: "career" },
  { file: "officer-rank", tier: "gold", main: "OFC", label: "OFFICER", cat: "career" },
  { file: "command-experience", tier: "platinum", main: "CMD", label: "COMMAND", cat: "career" },
  { file: "tender-operations", tier: "silver", main: "TDR", label: "TENDER OPS", cat: "ops" },
  { file: "watersports-operations", tier: "silver", main: "H2O", label: "WATERSPORTS", cat: "ops" },
  { file: "crane-operations", tier: "gold", main: "LIFT", label: "CRANE OPS", cat: "ops" },
  { file: "helicopter-operations", tier: "platinum", main: "HELO", label: "FLIGHT OPS", cat: "ops" }
];

function mainFontSize(main) {
  const len = String(main).length;
  if (len >= 5) return 11;
  if (len === 4) return 12;
  if (len === 3) return 13;
  return 15;
}

function labelFontSize(label) {
  return label.length > 12 ? 5.2 : 5.8;
}

function tickMarks(tier, uid) {
  const t = TIERS[tier] || TIERS.default;
  const count = t.ticks;
  const marks = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const x1 = 60 + Math.cos(angle) * 48;
    const y1 = 60 + Math.sin(angle) * 48;
    const x2 = 60 + Math.cos(angle) * 52;
    const y2 = 60 + Math.sin(angle) * 52;
    marks.push(
      `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="url(#ring-${uid})" stroke-width="2.2" stroke-linecap="round" opacity="0.85"/>`
    );
  }
  return marks.join("\n    ");
}

function buildSvg({ tier, main, label, cat, locked = false }) {
  const t = TIERS[tier] || TIERS.default;
  const c = CATEGORIES[cat] || CATEGORIES.sea;
  const uid = Math.random().toString(36).slice(2, 8);
  const icon = ICONS[cat] || ICONS.sea;
  const mainSize = mainFontSize(main);
  const labelSize = labelFontSize(label);

  const lockOverlay = locked
    ? `
  <circle cx="60" cy="60" r="38" fill="#F1F5F9" opacity="0.72"/>
  <g transform="translate(60,58)" stroke="#64748B" fill="none" stroke-width="2.2" stroke-linecap="round">
    <rect x="-11" y="-4" width="22" height="18" rx="4" fill="#E2E8F0" stroke="#64748B"/>
    <path d="M-6 6v6a6 6 0 0 0 12 0v-6"/>
    <path d="M-14 -2h28"/>
  </g>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img">
  <defs>
    <linearGradient id="ring-${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${t.a}"/>
      <stop offset="50%" stop-color="${t.b}"/>
      <stop offset="100%" stop-color="${t.c}"/>
    </linearGradient>
    <radialGradient id="disc-${uid}" cx="38%" cy="32%" r="68%">
      <stop offset="0%" stop-color="${c.inner[1]}"/>
      <stop offset="100%" stop-color="${c.inner[0]}"/>
    </radialGradient>
    <linearGradient id="shine-${uid}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.28"/>
      <stop offset="45%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <filter id="sh-${uid}" x="-20%" y="-15%" width="140%" height="150%">
      <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#0F172A" flood-opacity="0.28"/>
    </filter>
    <filter id="glow-${uid}" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <ellipse cx="60" cy="108" rx="28" ry="5" fill="#0F172A" opacity="0.12"/>

  <g filter="url(#sh-${uid})">
    <circle cx="60" cy="60" r="52" fill="none" stroke="url(#ring-${uid})" stroke-width="5.5"/>
    ${tickMarks(tier, uid)}
    <circle cx="60" cy="60" r="42" fill="url(#disc-${uid})"/>
    <circle cx="60" cy="60" r="42" fill="url(#shine-${uid})"/>
    <circle cx="60" cy="60" r="42" fill="none" stroke="#FFFFFF" stroke-opacity="0.14" stroke-width="1"/>
  </g>

  <g color="${c.accent}" filter="url(#glow-${uid})" transform="translate(0,-2)">
    ${icon}
  </g>

  <rect x="28" y="82" width="64" height="18" rx="9" fill="#0F172A" opacity="0.82"/>
  <rect x="29" y="83" width="62" height="16" rx="8" fill="${c.glow}" opacity="0.95"/>
  <text x="60" y="94.5" text-anchor="middle"
    font-family="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    font-size="${mainSize}" font-weight="800" letter-spacing="0.6"
    fill="#0F172A">${main}</text>

  <text x="60" y="108" text-anchor="middle"
    font-family="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    font-size="${labelSize}" font-weight="700" letter-spacing="0.9"
    fill="#64748B">${label}</text>

  <circle cx="60" cy="22" r="4" fill="url(#ring-${uid})"/>
  <path d="M60 18 L57 24 L63 24 Z" fill="#FFFFFF" opacity="0.9"/>

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
    label: "LOCKED",
    cat: "sea",
    locked: true
  })
);

fs.writeFileSync(
  path.join(OUT, "default.svg"),
  buildSvg({
    tier: "default",
    main: "SV",
    label: "SEA-V CREW",
    cat: "sea"
  })
);

console.log(`Generated ${BADGE_DEFS.length + 2} modern medallion badges in ${OUT}`);
