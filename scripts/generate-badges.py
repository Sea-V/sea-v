#!/usr/bin/env python3
"""Generate Strava-style split-face hex badges. Mirrors scripts/generate-badges.mjs."""
import os
import random
import string

OUT = os.path.join(os.path.dirname(__file__), "..", "img", "badges")

TIERS = {
    "bronze": {"left": "#6D4C41", "right": "#FF7043", "top": "#FFAB91", "ink": "#FFFFFF", "motif": "#FFE0B2"},
    "silver": {"left": "#546E7A", "right": "#AB47BC", "top": "#CE93D8", "ink": "#FFFFFF", "motif": "#F3E5F5"},
    "gold": {"left": "#455A64", "right": "#FFA000", "top": "#FFD54F", "ink": "#FFFFFF", "motif": "#FFF8E1"},
    "platinum": {"left": "#37474F", "right": "#00ACC1", "top": "#4DD0E1", "ink": "#FFFFFF", "motif": "#E0F7FA"},
    "default": {"left": "#37474F", "right": "#1E88E5", "top": "#64B5F6", "ink": "#FFFFFF", "motif": "#E3F2FD"},
}

TOP_MOTIFS = {
    "sea": '<path d="M18 30c8-5 14-5 22 0s14 5 22 0" stroke="currentColor" stroke-width="2" fill="none" opacity="0.85"/><path d="M18 36c8-4 14-4 22 0s14 4 22 0" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.55"/>',
    "vessel": '<path d="M38 34h24l-3-8H41l-3 8z" fill="currentColor" opacity="0.9"/><path d="M34 38c4-2 8-2 12 0s8 2 12 0 8 2 12 0" stroke="currentColor" stroke-width="1.4" fill="none" opacity="0.7"/>',
    "passage": '<circle cx="42" cy="32" r="2.5" fill="currentColor"/><circle cx="78" cy="28" r="2.5" fill="currentColor"/><path d="M45 31c10-6 20-6 32-4" stroke="currentColor" stroke-width="1.8" stroke-dasharray="3 2" fill="none"/>',
    "mountain": '<path d="M30 38L48 22L62 34L78 18L90 38Z" fill="currentColor" opacity="0.85"/>',
    "polar": '<path d="M48 20L52 34H68L56 42L60 56L48 42L36 34H52Z" fill="currentColor" opacity="0.9"/>',
    "watch": '<circle cx="60" cy="32" r="9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M60 27v6l4 2" stroke="currentColor" stroke-width="1.8" fill="none"/>',
    "career": '<path d="M60 22v14M52 30h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M52 36l8-6 8 6" stroke="currentColor" stroke-width="1.8" fill="none"/>',
    "ops": '<rect x="44" y="24" width="32" height="14" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M48 31h24" stroke="currentColor" stroke-width="1.5"/>',
}

BADGE_DEFS = [
    ("sea-30-days", "default", "30", "DAYS", "SEA", "sea"),
    ("sea-100-days", "default", "100", "DAYS", "SEA", "sea"),
    ("sea-250-days", "silver", "250", "DAYS", "SEA", "sea"),
    ("sea-500-days", "gold", "500", "DAYS", "SEA", "sea"),
    ("sea-1-year", "gold", "1Y", "SEA", "TIME", "sea"),
    ("sea-3-years", "platinum", "3Y", "SEA", "TIME", "sea"),
    ("first-vessel-logged", "bronze", "1st", "YACHT", "VES", "vessel"),
    ("vessels-3-served", "silver", "3", "YACHT", "VES", "vessel"),
    ("vessel-types-5", "gold", "5", "TYPE", "VES", "vessel"),
    ("large-yacht-50m", "silver", "50m", "PLUS", "YACHT", "vessel"),
    ("explorer-vessel", "silver", "EXP", "HULL", "VES", "vessel"),
    ("commercial-vessel", "silver", "COM", "TRADE", "VES", "vessel"),
    ("offshore-100nm", "bronze", "100", "NM", "OFF", "passage"),
    ("passage-500nm", "silver", "500", "NM", "PASS", "passage"),
    ("passage-1000nm", "gold", "1K", "NM", "PASS", "passage"),
    ("atlantic-crossing", "gold", "ATL", "OCEAN", "XING", "mountain"),
    ("pacific-crossing", "platinum", "PAC", "OCEAN", "XING", "mountain"),
    ("polar-navigation", "platinum", "POL", "ICE", "NAV", "polar"),
    ("first-watchkeeping", "bronze", "1st", "W/K", "BRIDGE", "watch"),
    ("watchkeeping-100-days", "gold", "100", "W/K", "BRIDGE", "watch"),
    ("oow-level", "gold", "OOW", "DECK", "RANK", "watch"),
    ("bridge-leader", "platinum", "BRG", "LEAD", "DECK", "watch"),
    ("first-promotion", "silver", "UP", "RANK", "CREW", "career"),
    ("senior-crew", "gold", "SNR", "CREW", "RANK", "career"),
    ("officer-rank", "gold", "OFC", "RANK", "DECK", "career"),
    ("command-experience", "platinum", "CMD", "MASTER", "RANK", "career"),
    ("tender-operations", "silver", "TDR", "OPS", "DECK", "ops"),
    ("watersports-operations", "silver", "H2O", "OPS", "TOYS", "ops"),
    ("crane-operations", "gold", "LIFT", "OPS", "DECK", "ops"),
    ("helicopter-operations", "platinum", "HELO", "OPS", "FLIGHT", "ops"),
]


def uid():
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=6))


def main_font_size(main):
    n = len(main)
    if n >= 4:
        return 16
    if n == 3:
        return 20
    return 26


def build_svg(tier, main, side, sub, motif, locked=False):
    t = TIERS.get(tier, TIERS["default"])
    u = uid()
    motif_svg = TOP_MOTIFS.get(motif, TOP_MOTIFS["sea"])
    main_size = main_font_size(main)
    lock = ""
    if locked:
        lock = """
  <path d="M24 38 L60 48 L60 98 L24 78 Z" fill="#ECEFF1" opacity="0.55"/>
  <path d="M60 48 L96 38 L96 78 L60 98 Z" fill="#CFD8DC" opacity="0.65"/>
  <g transform="translate(60,66)" stroke="#78909C" fill="none" stroke-width="2" stroke-linecap="round">
    <rect x="-10" y="-7" width="20" height="16" rx="3"/>
    <path d="M-5 5v5a5 5 0 0 0 10 0v-5"/>
    <path d="M-12 1h24"/>
  </g>"""
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img">
  <defs>
    <filter id="sh-{u}" x="-15%" y="-10%" width="130%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#263238" flood-opacity="0.22"/>
    </filter>
  </defs>
  <g filter="url(#sh-{u})">
    <path d="M24 38 L60 18 L96 38 L60 48 Z" fill="{t['top']}"/>
    <g color="{t['motif']}">{motif_svg}</g>
    <path d="M24 38 L60 48 L60 98 L24 78 Z" fill="{t['left']}"/>
    <path d="M60 48 L96 38 L96 78 L60 98 Z" fill="{t['right']}"/>
    <path d="M24 38 L60 18 L96 38" fill="none" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="1.2"/>
    <path d="M60 48 L60 98" fill="none" stroke="#000000" stroke-opacity="0.12" stroke-width="1"/>
  </g>
  <text x="36" y="62" transform="rotate(-90 36 62)" text-anchor="middle"
    font-family="Arial,Helvetica,sans-serif" font-size="8" font-weight="800"
    letter-spacing="1.2" fill="{t['ink']}" opacity="0.92">{side}</text>
  <text x="36" y="74" transform="rotate(-90 36 74)" text-anchor="middle"
    font-family="Arial,Helvetica,sans-serif" font-size="6.5" font-weight="700"
    letter-spacing="0.8" fill="{t['ink']}" opacity="0.65">{sub}</text>
  <text x="78" y="66" text-anchor="middle"
    font-family="Arial,Helvetica,sans-serif" font-size="{main_size}" font-weight="900"
    fill="{t['ink']}">{main}</text>
  <path d="M60 100 L54 106 L60 112 L66 106 Z" fill="{t['ink']}" opacity="0.92"/>
  <path d="M60 104 L57 107 L63 107 Z" fill="{t['right']}"/>
  {lock}
</svg>"""


def main():
    os.makedirs(OUT, exist_ok=True)
    for file, tier, main, side, sub, motif in BADGE_DEFS:
        with open(os.path.join(OUT, f"{file}.svg"), "w", encoding="utf-8") as f:
            f.write(build_svg(tier, main, side, sub, motif))
    with open(os.path.join(OUT, "locked.svg"), "w", encoding="utf-8") as f:
        f.write(build_svg("silver", "—", "LOCK", "SEA-V", "sea", locked=True))
    with open(os.path.join(OUT, "default.svg"), "w", encoding="utf-8") as f:
        f.write(build_svg("default", "SV", "SEA-V", "CREW", "sea"))
    print(f"Generated {len(BADGE_DEFS) + 2} Strava-style badges in {OUT}")


if __name__ == "__main__":
    main()
