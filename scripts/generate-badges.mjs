#!/usr/bin/env node
/**
 * Generates SEA-V hex badges — Strava-style typography inside, page-colored
 * rings. Two text tiers only (hero + sub) — the category "tag" chip was
 * dropped because it's already shown as normal HTML text next to every badge
 * image (achievements.js's trophy tiles, the unlock modal, the recent feed),
 * so it was pure duplication and it was eating room that made the hero/sub
 * text shrink more than it needed to. Full words only now — no more
 * mid-word truncations like "COMMER" or "HELO" forced by cramped space.
 * Run: node scripts/generate-badges.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../img/badges");
const PAGE_COLORS_PATH = path.join(__dirname, "page-colors.json");
const PAGE_COLORS_JS = path.join(__dirname, "../js/seav-page-colors.js");
const BADGE_COPY_PATH = path.join(__dirname, "badge-copy.json");

const PAGES = JSON.parse(fs.readFileSync(PAGE_COLORS_PATH, "utf8"));
const BADGE_DEFS = JSON.parse(fs.readFileSync(BADGE_COPY_PATH, "utf8"));

const CX = 60;
const CY = 56;
const TEXT_CY = 56;
const MAX_TEXT_WIDTH = 54;
const TEXT = "#0F172A";
const FONT =
  "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";

function pageRing(page) {
  const [a, b, c] = page.ring;
  return { a, b, c };
}

function pageInner(page) {
  const [a, b, c] = page.ring;
  return { fill: [b, c], pill: [a, c] };
}

function esc(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function estimateWidth(text, fontSize, tracking = 0.4) {
  return text.length * (fontSize * 0.55 + tracking);
}

function fitFontSize(text, maxWidth, startSize, minSize = 8) {
  let size = startSize;
  while (size > minSize) {
    if (estimateWidth(text, size) <= maxWidth) return Math.round(size * 10) / 10;
    size -= 0.5;
  }
  return minSize;
}

// Only wraps if a line genuinely can't fit even at the minimum size — full
// words are kept together whenever possible instead of being abbreviated.
function wrapLines(text, maxCharsPerLine = 11) {
  const value = String(text).trim();
  if (!value) return [""];
  const words = value.split(" ");
  if (words.length === 1 || value.length <= maxCharsPerLine) return [value];

  const lines = [];
  let current = words[0];
  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;
    if (candidate.length <= maxCharsPerLine) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines.slice(0, 2);
}

function heroBaseSize(hero) {
  const h = String(hero);
  if (/^\d/.test(h)) {
    if (/m/i.test(h)) return 22;
    if (h.length <= 2) return 28;
    if (h.length <= 4) return 22;
    return 18;
  }
  if (h.length <= 5) return 17;
  if (h.length <= 8) return 14;
  return 12;
}

function heroTracking(hero) {
  const h = String(hero);
  if (h.length > 8) return 0.15;
  if (h.length > 5) return 0.3;
  if (/^\d/.test(h)) return 0.8;
  return 0.5;
}

function renderTypography({ hero, sub, theme }) {
  const heroLines = wrapLines(hero, 9);
  const subLines = wrapLines(sub, 12);

  let heroSize = heroBaseSize(heroLines[0]);
  for (const line of heroLines) {
    heroSize = Math.min(heroSize, fitFontSize(line, MAX_TEXT_WIDTH, heroSize, 9));
  }

  let subSize = 7.4;
  for (const line of subLines) {
    subSize = Math.min(subSize, fitFontSize(line, MAX_TEXT_WIDTH, 7.4, 6.4));
  }

  let heroLineH = Math.max(heroSize * 0.85, 9);
  let subLineH = 8.6;
  const gap = 4;

  let blockH = heroLines.length * heroLineH + gap + subLines.length * subLineH;
  const maxBlock = 40;
  if (blockH > maxBlock) {
    const scale = maxBlock / blockH;
    heroSize = Math.max(9, Math.round(heroSize * scale * 10) / 10);
    subSize = Math.max(6.4, Math.round(subSize * scale * 10) / 10);
    heroLineH = Math.max(heroSize * 0.85, 8);
    subLineH = 7.8;
    blockH = heroLines.length * heroLineH + gap + subLines.length * subLineH;
  }

  const topY = TEXT_CY - blockH / 2;
  const heroStartY = topY + heroSize * 0.78;
  const subStartY = heroStartY + (heroLines.length - 1) * heroLineH + gap + subSize * 0.72;
  const accentY = Math.min(subStartY + (subLines.length - 1) * subLineH + 4, 71.5);

  const heroTspans = heroLines
    .map(
      (line, i) =>
        `<tspan x="60" ${i === 0 ? `y="${heroStartY.toFixed(1)}"` : ""} dy="${i === 0 ? 0 : heroLineH.toFixed(1)}">${esc(line)}</tspan>`
    )
    .join("");

  const subTspans = subLines
    .map(
      (line, i) =>
        `<tspan x="60" ${i === 0 ? `y="${subStartY.toFixed(1)}"` : ""} dy="${i === 0 ? 0 : subLineH.toFixed(1)}">${esc(line)}</tspan>`
    )
    .join("");

  return `
  <g font-family="${FONT}" text-anchor="middle">
    <text font-size="${heroSize}" font-weight="900" letter-spacing="${heroTracking(hero)}" fill="${TEXT}">${heroTspans}</text>
    <text font-size="${subSize}" font-weight="700" letter-spacing="0.6" fill="${TEXT}">${subTspans}</text>
    <line x1="40" y1="${accentY.toFixed(1)}" x2="80" y2="${accentY.toFixed(1)}" stroke="${theme.sidebar}" stroke-width="1.6" stroke-linecap="round" opacity="0.4"/>
  </g>`;
}

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

function buildSvg({ file, tier, hero, sub, page, locked = false }) {
  const theme = PAGES[page] || PAGES.seatime;
  const ring = pageRing(theme);
  const inner = pageInner(theme);
  const uid = Math.random().toString(36).slice(2, 8);
  const outerHex = hexPath(CX, CY, 50);
  const innerHex = hexPath(CX, CY, 40);
  const clip = hexPath(CX, CY, 40);
  const textClip = hexPath(CX, CY, 38);

  const lockOverlay = locked
    ? `
  <path d="${innerHex}" fill="#F1F5F9" opacity="0.82"/>
  <text x="60" y="56" text-anchor="middle" font-family="${FONT}" font-size="10" font-weight="800" letter-spacing="1.2" fill="#64748B">LOCKED</text>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="${esc(`${hero} ${sub}`)}" data-source-page="${page}" data-tier="${tier}">
  <defs>
    <linearGradient id="ring-${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${ring.a}"/>
      <stop offset="50%" stop-color="${ring.b}"/>
      <stop offset="100%" stop-color="${ring.c}"/>
    </linearGradient>
    <radialGradient id="disc-${uid}" cx="38%" cy="32%" r="68%">
      <stop offset="0%" stop-color="${inner.fill[1]}"/>
      <stop offset="100%" stop-color="${inner.fill[0]}"/>
    </radialGradient>
    <linearGradient id="shine-${uid}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.24"/>
      <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="txt-${uid}">
      <path d="${textClip}"/>
    </clipPath>
    <filter id="sh-${uid}" x="-20%" y="-15%" width="140%" height="150%">
      <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#0F172A" flood-opacity="0.28"/>
    </filter>
  </defs>

  <g filter="url(#sh-${uid})">
    <path d="${outerHex}" fill="none" stroke="url(#ring-${uid})" stroke-width="5" stroke-linejoin="round"/>
    ${vertexTicks(uid)}
    <path d="${clip}" fill="url(#disc-${uid})"/>
    <path d="${clip}" fill="url(#shine-${uid})"/>
    <path d="${innerHex}" fill="none" stroke="#FFFFFF" stroke-opacity="0.16" stroke-width="1"/>
  </g>

  <g clip-path="url(#txt-${uid})">
  ${renderTypography({ hero, sub, theme })}
  </g>

  ${lockOverlay}
</svg>`;
}

function syncPageColorsJs() {
  const payload = { pages: PAGES };
  const body = `/* Auto-generated from scripts/page-colors.json — run scripts/generate-badges.mjs */\nwindow.SeavPageColors = ${JSON.stringify(payload, null, 2)};\n`;
  fs.writeFileSync(PAGE_COLORS_JS, body);
}

fs.mkdirSync(OUT, { recursive: true });
syncPageColorsJs();

for (const def of BADGE_DEFS) {
  fs.writeFileSync(path.join(OUT, `${def.file}.svg`), buildSvg(def));
}

fs.writeFileSync(
  path.join(OUT, "locked.svg"),
  buildSvg({
    file: "locked",
    tier: "silver",
    hero: "LOCKED",
    sub: "MILESTONE",
    page: "achievements",
    locked: true
  })
);

fs.writeFileSync(
  path.join(OUT, "default.svg"),
  buildSvg({
    file: "default",
    tier: "default",
    hero: "SEA-V",
    sub: "CREW BADGE",
    page: "achievements"
  })
);

console.log(`Generated ${BADGE_DEFS.length + 2} typographic hex badges in ${OUT}`);
