#!/usr/bin/env node
/**
 * Generates SEA-V hex badges — Strava-style typography inside, page-colored rings.
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

function heroFontSize(hero) {
  const h = String(hero);
  if (/^\d/.test(h)) {
    if (h.length <= 2) return 38;
    if (h.length <= 3) return 32;
    return 26;
  }
  if (h.length <= 3) return 28;
  if (h.length <= 5) return 20;
  if (h.length <= 7) return 16;
  return 13;
}

function splitWords(text, maxLen = 11) {
  if (text.length <= maxLen) return [text];
  const words = text.split(" ");
  if (words.length >= 2) {
    const mid = Math.ceil(words.length / 2);
    return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
  }
  const mid = Math.ceil(text.length / 2);
  return [text.slice(0, mid), text.slice(mid)];
}

function renderTypography({ hero, sub, tag, theme }) {
  const heroLines = splitWords(hero, 9);
  const subLines = splitWords(sub, 13);
  const heroSize = heroFontSize(heroLines[0]);
  const heroLineH = heroSize * 0.92;
  const subSize = subLines.some((l) => l.length > 12) ? 7.6 : 8.8;
  const subLineH = 10.5;

  const heroBlockH = heroLines.length * heroLineH;
  const subBlockH = subLines.length * subLineH;
  const totalH = 8 + heroBlockH + 6 + subBlockH;
  const tagY = 50 - totalH / 2;
  const heroStartY = tagY + 10;
  const subStartY = heroStartY + heroBlockH + 6;
  const accentY = subStartY + subBlockH + 8;

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
    <text x="60" y="${tagY.toFixed(1)}" font-size="6.4" font-weight="800" letter-spacing="1.8" fill="${theme.sidebar}">${esc(tag)}</text>
    <text font-size="${heroSize}" font-weight="900" letter-spacing="${hero.length > 5 ? 0.5 : 1.2}" fill="${TEXT}">${heroTspans}</text>
    <text font-size="${subSize}" font-weight="700" letter-spacing="1.3" fill="${TEXT}" opacity="0.76">${subTspans}</text>
    <line x1="36" y1="${accentY.toFixed(1)}" x2="84" y2="${accentY.toFixed(1)}" stroke="${theme.sidebar}" stroke-width="2" stroke-linecap="round" opacity="0.42"/>
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

function buildSvg({ file, tier, hero, sub, tag, page, locked = false }) {
  const theme = PAGES[page] || PAGES.seatime;
  const ring = pageRing(theme);
  const inner = pageInner(theme);
  const uid = Math.random().toString(36).slice(2, 8);
  const outerHex = hexPath(CX, CY, 50);
  const innerHex = hexPath(CX, CY, 40);
  const clip = hexPath(CX, CY, 40);

  const lockOverlay = locked
    ? `
  <path d="${innerHex}" fill="#F1F5F9" opacity="0.82"/>
  <text x="60" y="58" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="800" letter-spacing="1.4" fill="#64748B">LOCKED</text>`
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

  ${renderTypography({ hero, sub, tag, theme })}

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
    tag: "SEA-V",
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
    tag: "ACHIEVEMENT",
    page: "achievements"
  })
);

console.log(`Generated ${BADGE_DEFS.length + 2} typographic hex badges in ${OUT}`);
