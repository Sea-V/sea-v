#!/usr/bin/env python3
"""Generate hex badges from scripts/page-colors.json. Mirrors generate-badges.mjs."""
import json
import math
import os
import random
import string

ROOT = os.path.dirname(__file__)
OUT = os.path.join(ROOT, "..", "img", "badges")
PAGE_COLORS_PATH = os.path.join(ROOT, "page-colors.json")
PAGE_COLORS_JS = os.path.join(ROOT, "..", "js", "seav-page-colors.js")
BADGE_ICONS_PATH = os.path.join(ROOT, "badge-icons.json")

with open(PAGE_COLORS_PATH, encoding="utf-8") as f:
    PAGES = json.load(f)

with open(BADGE_ICONS_PATH, encoding="utf-8") as f:
    BADGE_ICONS = json.load(f)

CX, CY = 60, 56
ICON_OUTLINE = "#0F172A"
ICON_ACCENT = "#FFFFFF"

TIER_INNER = {
    "bronze": {
        "fill": ["#4a3020", "#7A4E2A"],
        "pill": ["#A0622E", "#CD7F32"],
        "pillText": "#FFF8F0",
    },
    "silver": {
        "fill": ["#3d4654", "#6B7788"],
        "pill": ["#8E99A8", "#C0C8D4"],
        "pillText": ICON_OUTLINE,
    },
    "gold": {
        "fill": ["#5c4510", "#9A7518"],
        "pill": ["#C8941A", "#E8BE3A"],
        "pillText": ICON_OUTLINE,
    },
    "platinum": {
        "fill": ["#1a3d4a", "#2A6B7A"],
        "pill": ["#5EC4D8", "#B9F2FF"],
        "pillText": ICON_OUTLINE,
    },
    "default": {
        "fill": ["#2e3a48", "#4A5868"],
        "pill": ["#64748B", "#94A3B8"],
        "pillText": "#F8FAFC",
    },
}


def page_ring(page):
    a, b, c = page["ring"]
    return a, b, c


def tier_inner(tier):
    return TIER_INNER.get(tier, TIER_INNER["default"])


BADGE_DEFS = [
    ("sea-30-days", "default", "30", "DAYS AT SEA", "sea", "seatime"),
    ("sea-100-days", "default", "100", "DAYS AT SEA", "sea", "seatime"),
    ("sea-250-days", "silver", "250", "DAYS AT SEA", "sea", "seatime"),
    ("sea-500-days", "gold", "500", "DAYS AT SEA", "sea", "seatime"),
    ("sea-1-year", "gold", "1 YR", "SEA TIME", "sea", "seatime"),
    ("sea-3-years", "platinum", "3 YR", "SEA TIME", "sea", "seatime"),
    ("first-vessel-logged", "bronze", "1ST", "VESSEL", "vessel", "vessels"),
    ("vessels-3-served", "silver", "3", "YACHTS", "vessel", "vessels"),
    ("vessel-types-5", "gold", "5", "HULL TYPES", "vessel", "vessels"),
    ("large-yacht-50m", "silver", "50m+", "SUPERYACHT", "vessel", "vessels"),
    ("explorer-vessel", "silver", "EXP", "EXPLORER", "vessel", "vessels"),
    ("commercial-vessel", "silver", "COM", "COMMERCIAL", "vessel", "vessels"),
    ("offshore-100nm", "bronze", "100", "OFFSHORE NM", "passage", "navigation"),
    ("passage-500nm", "silver", "500", "PASSAGE NM", "passage", "navigation"),
    ("passage-1000nm", "gold", "1K", "PASSAGE NM", "passage", "navigation"),
    ("atlantic-crossing", "gold", "ATL", "CROSSING", "ocean", "navigation"),
    ("pacific-crossing", "platinum", "PAC", "CROSSING", "ocean", "navigation"),
    ("polar-navigation", "platinum", "POLAR", "NAVIGATION", "polar", "navigation"),
    ("first-watchkeeping", "bronze", "1ST", "WATCH", "watch", "seatime"),
    ("watchkeeping-100-days", "gold", "100", "BRIDGE DAYS", "watch", "seatime"),
    ("oow-level", "gold", "OOW", "DECK OFFICER", "watch", "certificates"),
    ("bridge-leader", "platinum", "LEAD", "BRIDGE LEADER", "helm", "navigation"),
    ("first-promotion", "silver", "UP", "PROMOTION", "career", "profile"),
    ("senior-crew", "gold", "SNR", "SENIOR CREW", "career", "profile"),
    ("officer-rank", "gold", "OFC", "OFFICER", "career", "profile"),
    ("command-experience", "platinum", "CMD", "COMMAND", "career", "profile"),
    ("tender-operations", "silver", "TDR", "TENDER OPS", "ops", "tenders"),
    ("watersports-operations", "silver", "H2O", "WATERSPORTS", "ops", "onboard-experience"),
    ("crane-operations", "gold", "LIFT", "CRANE OPS", "ops", "specialist-qualifications"),
    ("helicopter-operations", "platinum", "HELO", "FLIGHT OPS", "ops", "specialist-qualifications"),
]


def uid():
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=6))


def hex_points(cx, cy, r, start_deg=-90):
    return [
        (cx + r * math.cos(math.radians(start_deg + i * 60)), cy + r * math.sin(math.radians(start_deg + i * 60)))
        for i in range(6)
    ]


def hex_path(cx, cy, r, start_deg=-90):
    pts = hex_points(cx, cy, r, start_deg)
    return "M " + " L ".join(f"{x:.2f} {y:.2f}" for x, y in pts) + " Z"


def main_font_size(main):
    n = len(main)
    if n >= 5:
        return 11
    if n == 4:
        return 12
    if n == 3:
        return 13
    return 15


def label_font_size(label):
    return 5.2 if len(label) > 12 else 5.8


def vertex_ticks(u):
    outer = hex_points(CX, CY, 48)
    inner = hex_points(CX, CY, 44)
    lines = []
    for i in range(6):
        lines.append(
            f'    <line x1="{inner[i][0]:.2f}" y1="{inner[i][1]:.2f}" '
            f'x2="{outer[i][0]:.2f}" y2="{outer[i][1]:.2f}" '
            f'stroke="url(#ring-{u})" stroke-width="2.4" stroke-linecap="round"/>'
        )
    return "\n".join(lines)


def render_icon(icon):
    return f"""
  <g shape-rendering="geometricPrecision">
    <g color="{ICON_OUTLINE}" opacity="0.38" transform="translate(0, 2)">{icon}</g>
    <g color="{ICON_ACCENT}" stroke="{ICON_OUTLINE}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke fill">{icon}</g>
  </g>"""


def build_svg(file, tier, main, label, page, locked=False):
    theme = PAGES.get(page, PAGES["seatime"])
    ra, rb, rc = page_ring(theme)
    inner = tier_inner(tier)
    u = uid()
    icon = BADGE_ICONS.get(file, BADGE_ICONS["default"])
    main_size = main_font_size(main)
    label_size = label_font_size(label)
    outer_hex = hex_path(CX, CY, 50)
    inner_hex = hex_path(CX, CY, 40)
    clip = hex_path(CX, CY, 40)
    lock = ""
    if locked:
        lock = f"""
  <path d="{inner_hex}" fill="#F1F5F9" opacity="0.78"/>
  <g transform="translate(60,54)" stroke="#64748B" fill="none" stroke-width="2.2" stroke-linecap="round">
    <rect x="-11" y="-4" width="22" height="18" rx="4" fill="#E2E8F0" stroke="#64748B"/>
    <path d="M-6 6v6a6 6 0 0 0 12 0v-6"/>
    <path d="M-14 -2h28"/>
  </g>"""
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" data-source-page="{page}" data-tier="{tier}">
  <defs>
    <linearGradient id="ring-{u}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{ra}"/>
      <stop offset="50%" stop-color="{rb}"/>
      <stop offset="100%" stop-color="{rc}"/>
    </linearGradient>
    <radialGradient id="disc-{u}" cx="38%" cy="32%" r="68%">
      <stop offset="0%" stop-color="{inner['fill'][1]}"/>
      <stop offset="100%" stop-color="{inner['fill'][0]}"/>
    </radialGradient>
    <linearGradient id="pill-{u}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="{inner['pill'][0]}"/>
      <stop offset="100%" stop-color="{inner['pill'][1]}"/>
    </linearGradient>
    <linearGradient id="shine-{u}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.22"/>
      <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <filter id="sh-{u}" x="-20%" y="-15%" width="140%" height="150%">
      <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#0F172A" flood-opacity="0.28"/>
    </filter>
  </defs>

  <g filter="url(#sh-{u})">
    <path d="{outer_hex}" fill="none" stroke="url(#ring-{u})" stroke-width="5" stroke-linejoin="round"/>
{vertex_ticks(u)}
    <path d="{clip}" fill="url(#disc-{u})"/>
    <path d="{clip}" fill="url(#shine-{u})"/>
    <path d="{inner_hex}" fill="none" stroke="#FFFFFF" stroke-opacity="0.14" stroke-width="1"/>
  </g>

{render_icon(icon)}

  <rect x="26" y="82" width="68" height="18" rx="4" fill="#0F172A" opacity="0.85"/>
  <rect x="27" y="83" width="66" height="16" rx="3" fill="url(#pill-{u})" opacity="0.98"/>
  <text x="60" y="94.5" text-anchor="middle"
    font-family="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    font-size="{main_size}" font-weight="800" letter-spacing="0.6"
    fill="{inner['pillText']}">{main}</text>

  <text x="60" y="108" text-anchor="middle"
    font-family="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    font-size="{label_size}" font-weight="700" letter-spacing="0.9"
    fill="{theme['sidebar']}">{label}</text>

  {lock}
</svg>"""


def sync_page_colors_js():
    payload = {"pages": PAGES, "tierInner": TIER_INNER}
    body = (
        "/* Auto-generated from scripts/page-colors.json — run scripts/generate-badges.py */\n"
        f"window.SeavPageColors = {json.dumps(payload, indent=2)};\n"
    )
    with open(PAGE_COLORS_JS, "w", encoding="utf-8") as f:
        f.write(body)


def main():
    os.makedirs(OUT, exist_ok=True)
    sync_page_colors_js()
    for file, tier, main, label, cat, page in BADGE_DEFS:
        with open(os.path.join(OUT, f"{file}.svg"), "w", encoding="utf-8") as f:
            f.write(build_svg(file, tier, main, label, page))
    with open(os.path.join(OUT, "locked.svg"), "w", encoding="utf-8") as f:
        f.write(build_svg("locked", "silver", "—", "LOCKED", "achievements", locked=True))
    with open(os.path.join(OUT, "default.svg"), "w", encoding="utf-8") as f:
        f.write(build_svg("default", "default", "SV", "SEA-V CREW", "achievements"))
    print(f"Generated {len(BADGE_DEFS) + 2} page-colored hex badges in {OUT}")


if __name__ == "__main__":
    main()
