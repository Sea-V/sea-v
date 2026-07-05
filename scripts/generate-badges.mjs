#!/usr/bin/env node
/**
 * Generates SEA-V achievement badges — modern flat-top hex badges.
 * Run: node scripts/generate-badges.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../img/badges");

const CX = 60;
const CY = 56;

/** Tier border gradients */
const TIERS = {
  bronze: { a: "#FDBA74", b: "#C2410C", c: "#FED7AA" },
  silver: { a: "#E2E8F0", b: "#64748B", c: "#F8FAFC" },
  gold: { a: "#FDE68A", b: "#D97706", c: "#FFFBEB" },
  platinum: { a: "#67E8F9", b: "#0891B2", c: "#ECFEFF" },
  default: { a: "#93C5FD", b: "#2563EB", c: "#EFF6FF" }
};

/** Category fills + icon accent (icon uses white + dark outline for sharp contrast) */
const CATEGORIES = {
  sea: { inner: ["#0C4A6E", "#0369A1"], accent: "#FFFFFF", glow: "#38BDF8" },
  vessel: { inner: ["#7C2D12", "#C2410C"], accent: "#FFFFFF", glow: "#FB923C" },
  passage: { inner: ["#581C87", "#7E22CE"], accent: "#FFFFFF", glow: "#C084FC" },
  ocean: { inner: ["#1E3A8A", "#1D4ED8"], accent: "#FFFFFF", glow: "#60A5FA" },
  polar: { inner: ["#164E63", "#0891B2"], accent: "#FFFFFF", glow: "#67E8F9" },
  watch: { inner: ["#312E81", "#4338CA"], accent: "#FFFFFF", glow: "#818CF8" },
  career: { inner: ["#14532D", "#15803D"], accent: "#FFFFFF", glow: "#4ADE80" },
  ops: { inner: ["#713F12", "#B45309"], accent: "#FFFFFF", glow: "#FBBF24" },
  helm: { inner: ["#0F2744", "#D97706"], accent: "#FFFFFF", glow: "#FBBF24" }
};

const ICON_OUTLINE = "#0F172A";

const ICONS = {
  sea: `
    <path d="M34 52c6-4 12-4 18 0s12 4 18 0 12-4 18 0" stroke="currentColor" stroke-width="2.8" fill="none" stroke-linecap="round"/>
    <path d="M30 58c6-3 12-3 18 0s12 3 18 0 12-3 18 0" stroke="currentColor" stroke-width="2.2" fill="none" opacity="0.7" stroke-linecap="round"/>
    <circle cx="60" cy="42" r="11" stroke="currentColor" stroke-width="2.6" fill="none"/>
    <path d="M60 35v7l5 3" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/>`,
  vessel: `
    <path d="M36 56h48l-7-16H43l-7 16z" fill="currentColor"/>
    <path d="M30 59c9-3 18-3 27 0s18 3 27 0" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M50 40h20v10H50z" fill="currentColor" opacity="0.55"/>
    <path d="M54 35h12v5H54z" fill="currentColor"/>`,
  passage: `
    <circle cx="40" cy="46" r="5" fill="currentColor"/>
    <circle cx="80" cy="40" r="5" fill="currentColor"/>
    <path d="M45 45c14-9 28-9 34-6" stroke="currentColor" stroke-width="2.6" stroke-dasharray="5 3" fill="none" stroke-linecap="round"/>
    <path d="M52 54l7-9 7 6 9-11" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  ocean: `
    <circle cx="60" cy="48" r="20" stroke="currentColor" stroke-width="2.4" fill="none" opacity="0.45"/>
    <path d="M40 48c7-11 16-11 20 0s16 11 20 0" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path d="M46 58h28l-5-10H51l-5 10z" fill="currentColor"/>`,
  polar: `
    <path d="M60 32l5 14h14l-11 8 4 14-12-8-12 8 4-14-11-8h14z" fill="currentColor"/>
    <path d="M42 60h36" stroke="currentColor" stroke-width="2" opacity="0.5"/>`,
  watch: `
    <rect x="40" y="36" width="40" height="24" rx="3" stroke="currentColor" stroke-width="2.6" fill="none"/>
    <path d="M44 52h32" stroke="currentColor" stroke-width="2" opacity="0.55"/>
    <circle cx="60" cy="48" r="7" stroke="currentColor" stroke-width="2.2" fill="none"/>
    <path d="M60 44v5l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>`,
  helm: `
    <g transform="translate(60,48)" shape-rendering="geometricPrecision">
      <circle r="28" fill="none" stroke="currentColor" stroke-width="3.5"/>
      <circle r="22" fill="none" stroke="currentColor" stroke-width="2.2" opacity="0.65"/>
      <g stroke="currentColor" stroke-width="3.2" fill="none">
        <line x1="0" y1="-24" x2="0" y2="24"/>
        <line x1="-24" y1="0" x2="24" y2="0"/>
        <line x1="-17" y1="-17" x2="17" y2="17"/>
        <line x1="17" y1="-17" x2="-17" y2="17"/>
      </g>
      <g fill="currentColor" stroke="currentColor" stroke-width="1.2">
        <circle cy="-28" r="3"/><circle cy="28" r="3"/>
        <circle cx="-28" r="3"/><circle cx="28" r="3"/>
        <circle cx="-20" cy="-20" r="3"/><circle cx="20" cy="-20" r="3"/>
        <circle cx="-20" cy="20" r="3"/><circle cx="20" cy="20" r="3"/>
      </g>
      <circle r="7" fill="${ICON_OUTLINE}" stroke="currentColor" stroke-width="2.4"/>
      <circle r="3" fill="currentColor"/>
    </g>`,
  career: `
    <path d="M46 36h28v7H46z" fill="currentColor" opacity="0.65"/>
    <path d="M42 43h36v7H42z" fill="currentColor" opacity="0.85"/>
    <path d="M38 50h44v7H38z" fill="currentColor"/>
    <path d="M52 57h16v5H52z" fill="currentColor"/>`,
  ops: `
    <circle cx="46" cy="48" r="9" stroke="currentColor" stroke-width="2.6" fill="none"/>
    <circle cx="74" cy="48" r="9" stroke="currentColor" stroke-width="2.6" fill="none"/>
    <path d="M53 48h14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    <path d="M60 58v7M50 63h20" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`
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
  {
    file: "bridge-leader",
    tier: "platinum",
    main: "LEAD",
    label: "BRIDGE LEADER",
    cat: "helm",
    split: true
  },
  { file: "first-promotion", tier: "silver", main: "UP", label: "PROMOTION", cat: "career" },
  { file: "senior-crew", tier: "gold", main: "SNR", label: "SENIOR CREW", cat: "career" },
  { file: "officer-rank", tier: "gold", main: "OFC", label: "OFFICER", cat: "career" },
  { file: "command-experience", tier: "platinum", main: "CMD", label: "COMMAND", cat: "career" },
  { file: "tender-operations", tier: "silver", main: "TDR", label: "TENDER OPS", cat: "ops" },
  { file: "watersports-operations", tier: "silver", main: "H2O", label: "WATERSPORTS", cat: "ops" },
  { file: "crane-operations", tier: "gold", main: "LIFT", label: "CRANE OPS", cat: "ops" },
  { file: "helicopter-operations", tier: "platinum", main: "HELO", label: "FLIGHT OPS", cat: "ops" }
];

function hexPoints(cx, cy, r, startDeg = -90) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = ((startDeg + i * 60) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}

function hexPath(cx, cy, r, startDeg = -90) {
  const pts = hexPoints(cx, cy, r, startDeg);
  return `M ${pts.map((p) => p.map((n) => n.toFixed(2)).join(" ")).join(" L ")} Z`;
}

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

function vertexTicks(uid) {
  const outer = hexPoints(CX, CY, 48);
  const inner = hexPoints(CX, CY, 44);
  return outer
    .map(
      (p, i) =>
        `<line x1="${inner[i][0].toFixed(2)}" y1="${inner[i][1].toFixed(2)}" x2="${p[0].toFixed(2)}" y2="${p[1].toFixed(2)}" stroke="url(#ring-${uid})" stroke-width="2.4" stroke-linecap="round"/>`
    )
    .join("\n    ");
}

function innerFill(uid, c, split) {
  const clip = hexPath(CX, CY, 40);
  if (split) {
    return `
    <clipPath id="hex-inner-${uid}"><path d="${clip}"/></clipPath>
    <g clip-path="url(#hex-inner-${uid})">
      <rect x="0" y="0" width="${CX}" height="120" fill="${c.inner[0]}"/>
      <rect x="${CX}" y="0" width="${CX}" height="120" fill="${c.inner[1]}"/>
    </g>`;
  }
  return `
    <path d="${clip}" fill="url(#disc-${uid})"/>
    <path d="${clip}" fill="url(#shine-${uid})"/>`;
}

/** Crisp icon: dark offset + white fill with dark outline — no blur filters */
function renderIcon(icon, accent = "#FFFFFF") {
  return `
  <g shape-rendering="geometricPrecision">
    <g color="${ICON_OUTLINE}" opacity="0.38" transform="translate(0, 2)">${icon}</g>
    <g color="${accent}" stroke="${ICON_OUTLINE}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke fill">${icon}</g>
  </g>`;
}

function buildSvg({ tier, main, label, cat, split = false, locked = false }) {
  const t = TIERS[tier] || TIERS.default;
  const c = CATEGORIES[cat] || CATEGORIES.sea;
  const uid = Math.random().toString(36).slice(2, 8);
  const icon = ICONS[cat] || ICONS.sea;
  const mainSize = mainFontSize(main);
  const labelSize = labelFontSize(label);
  const outerHex = hexPath(CX, CY, 50);
  const innerHex = hexPath(CX, CY, 40);
  const pillFill = split ? c.inner[0] : c.glow;
  const pillText = split ? "#FDE68A" : "#0F172A";

  const lockOverlay = locked
    ? `
  <path d="${innerHex}" fill="#F1F5F9" opacity="0.78"/>
  <g transform="translate(60,54)" stroke="#64748B" fill="none" stroke-width="2.2" stroke-linecap="round">
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
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.24"/>
      <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <filter id="sh-${uid}" x="-20%" y="-15%" width="140%" height="150%">
      <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#0F172A" flood-opacity="0.28"/>
    </filter>
  </defs>

  <g filter="url(#sh-${uid})">
    <path d="${outerHex}" fill="none" stroke="url(#ring-${uid})" stroke-width="5" stroke-linejoin="round"/>
    ${vertexTicks(uid)}
    ${innerFill(uid, c, split)}
    <path d="${innerHex}" fill="none" stroke="#FFFFFF" stroke-opacity="0.14" stroke-width="1"/>
  </g>

  ${renderIcon(icon, c.accent)}

  <rect x="26" y="82" width="68" height="18" rx="4" fill="#0F172A" opacity="0.85"/>
  <rect x="27" y="83" width="66" height="16" rx="3" fill="${pillFill}" opacity="0.96"/>
  <text x="60" y="94.5" text-anchor="middle"
    font-family="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    font-size="${mainSize}" font-weight="800" letter-spacing="0.6"
    fill="${pillText}">${main}</text>

  <text x="60" y="108" text-anchor="middle"
    font-family="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    font-size="${labelSize}" font-weight="700" letter-spacing="0.9"
    fill="#64748B">${label}</text>

  ${lockOverlay}
</svg>`;
}

fs.mkdirSync(OUT, { recursive: true });

for (const def of BADGE_DEFS) {
  fs.writeFileSync(path.join(OUT, `${def.file}.svg`), buildSvg(def));
}

fs.writeFileSync(
  path.join(OUT, "locked.svg"),
  buildSvg({ tier: "silver", main: "—", label: "LOCKED", cat: "sea", locked: true })
);

fs.writeFileSync(
  path.join(OUT, "default.svg"),
  buildSvg({ tier: "default", main: "SV", label: "SEA-V CREW", cat: "sea" })
);

console.log(`Generated ${BADGE_DEFS.length + 2} hex badges in ${OUT}`);
