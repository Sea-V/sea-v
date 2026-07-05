#!/usr/bin/env python3
"""Generate flat-top hex badges. Mirrors scripts/generate-badges.mjs."""
import math
import os
import random
import string

OUT = os.path.join(os.path.dirname(__file__), "..", "img", "badges")
CX, CY = 60, 56

TIERS = {
    "bronze": {"a": "#FDBA74", "b": "#C2410C", "c": "#FED7AA"},
    "silver": {"a": "#E2E8F0", "b": "#64748B", "c": "#F8FAFC"},
    "gold": {"a": "#FDE68A", "b": "#D97706", "c": "#FFFBEB"},
    "platinum": {"a": "#67E8F9", "b": "#0891B2", "c": "#ECFEFF"},
    "default": {"a": "#93C5FD", "b": "#2563EB", "c": "#EFF6FF"},
}

ICON_OUTLINE = "#0F172A"

CATEGORIES = {
    "sea": {"inner": ["#0C4A6E", "#0369A1"], "accent": "#FFFFFF", "glow": "#38BDF8"},
    "vessel": {"inner": ["#7C2D12", "#C2410C"], "accent": "#FFFFFF", "glow": "#FB923C"},
    "passage": {"inner": ["#581C87", "#7E22CE"], "accent": "#FFFFFF", "glow": "#C084FC"},
    "ocean": {"inner": ["#1E3A8A", "#1D4ED8"], "accent": "#FFFFFF", "glow": "#60A5FA"},
    "polar": {"inner": ["#164E63", "#0891B2"], "accent": "#FFFFFF", "glow": "#67E8F9"},
    "watch": {"inner": ["#312E81", "#4338CA"], "accent": "#FFFFFF", "glow": "#818CF8"},
    "career": {"inner": ["#14532D", "#15803D"], "accent": "#FFFFFF", "glow": "#4ADE80"},
    "ops": {"inner": ["#713F12", "#B45309"], "accent": "#FFFFFF", "glow": "#FBBF24"},
    "helm": {"inner": ["#0F2744", "#D97706"], "accent": "#FFFFFF", "glow": "#FBBF24"},
}

ICONS = {
    "sea": """
    <path d="M34 52c6-4 12-4 18 0s12 4 18 0 12-4 18 0" stroke="currentColor" stroke-width="2.8" fill="none" stroke-linecap="round"/>
    <path d="M30 58c6-3 12-3 18 0s12 3 18 0 12-3 18 0" stroke="currentColor" stroke-width="2.2" fill="none" opacity="0.7" stroke-linecap="round"/>
    <circle cx="60" cy="42" r="11" stroke="currentColor" stroke-width="2.6" fill="none"/>
    <path d="M60 35v7l5 3" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/>""",
    "vessel": """
    <path d="M36 56h48l-7-16H43l-7 16z" fill="currentColor"/>
    <path d="M30 59c9-3 18-3 27 0s18 3 27 0" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M50 40h20v10H50z" fill="currentColor" opacity="0.55"/>
    <path d="M54 35h12v5H54z" fill="currentColor"/>""",
    "passage": """
    <circle cx="40" cy="46" r="5" fill="currentColor"/>
    <circle cx="80" cy="40" r="5" fill="currentColor"/>
    <path d="M45 45c14-9 28-9 34-6" stroke="currentColor" stroke-width="2.6" stroke-dasharray="5 3" fill="none" stroke-linecap="round"/>
    <path d="M52 54l7-9 7 6 9-11" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>""",
    "ocean": """
    <circle cx="60" cy="48" r="20" stroke="currentColor" stroke-width="2.4" fill="none" opacity="0.45"/>
    <path d="M40 48c7-11 16-11 20 0s16 11 20 0" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path d="M46 58h28l-5-10H51l-5 10z" fill="currentColor"/>""",
    "polar": """
    <path d="M60 32l5 14h14l-11 8 4 14-12-8-12 8 4-14-11-8h14z" fill="currentColor"/>
    <path d="M42 60h36" stroke="currentColor" stroke-width="2" opacity="0.5"/>""",
    "watch": """
    <rect x="40" y="36" width="40" height="24" rx="3" stroke="currentColor" stroke-width="2.6" fill="none"/>
    <path d="M44 52h32" stroke="currentColor" stroke-width="2" opacity="0.55"/>
    <circle cx="60" cy="48" r="7" stroke="currentColor" stroke-width="2.2" fill="none"/>
    <path d="M60 44v5l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>""",
    "helm": f"""
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
      <circle r="7" fill="{ICON_OUTLINE}" stroke="currentColor" stroke-width="2.4"/>
      <circle r="3" fill="currentColor"/>
    </g>""",
    "career": """
    <path d="M46 36h28v7H46z" fill="currentColor" opacity="0.65"/>
    <path d="M42 43h36v7H42z" fill="currentColor" opacity="0.85"/>
    <path d="M38 50h44v7H38z" fill="currentColor"/>
    <path d="M52 57h16v5H52z" fill="currentColor"/>""",
    "ops": """
    <circle cx="46" cy="48" r="9" stroke="currentColor" stroke-width="2.6" fill="none"/>
    <circle cx="74" cy="48" r="9" stroke="currentColor" stroke-width="2.6" fill="none"/>
    <path d="M53 48h14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    <path d="M60 58v7M50 63h20" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>""",
}

BADGE_DEFS = [
    ("sea-30-days", "default", "30", "DAYS AT SEA", "sea", False),
    ("sea-100-days", "default", "100", "DAYS AT SEA", "sea", False),
    ("sea-250-days", "silver", "250", "DAYS AT SEA", "sea", False),
    ("sea-500-days", "gold", "500", "DAYS AT SEA", "sea", False),
    ("sea-1-year", "gold", "1 YR", "SEA TIME", "sea", False),
    ("sea-3-years", "platinum", "3 YR", "SEA TIME", "sea", False),
    ("first-vessel-logged", "bronze", "1ST", "VESSEL", "vessel", False),
    ("vessels-3-served", "silver", "3", "YACHTS", "vessel", False),
    ("vessel-types-5", "gold", "5", "HULL TYPES", "vessel", False),
    ("large-yacht-50m", "silver", "50m+", "SUPERYACHT", "vessel", False),
    ("explorer-vessel", "silver", "EXP", "EXPLORER", "vessel", False),
    ("commercial-vessel", "silver", "COM", "COMMERCIAL", "vessel", False),
    ("offshore-100nm", "bronze", "100", "OFFSHORE NM", "passage", False),
    ("passage-500nm", "silver", "500", "PASSAGE NM", "passage", False),
    ("passage-1000nm", "gold", "1K", "PASSAGE NM", "passage", False),
    ("atlantic-crossing", "gold", "ATL", "CROSSING", "ocean", False),
    ("pacific-crossing", "platinum", "PAC", "CROSSING", "ocean", False),
    ("polar-navigation", "platinum", "POLAR", "NAVIGATION", "polar", False),
    ("first-watchkeeping", "bronze", "1ST", "WATCH", "watch", False),
    ("watchkeeping-100-days", "gold", "100", "BRIDGE DAYS", "watch", False),
    ("oow-level", "gold", "OOW", "DECK OFFICER", "watch", False),
    ("bridge-leader", "platinum", "LEAD", "BRIDGE LEADER", "helm", True),
    ("first-promotion", "silver", "UP", "PROMOTION", "career", False),
    ("senior-crew", "gold", "SNR", "SENIOR CREW", "career", False),
    ("officer-rank", "gold", "OFC", "OFFICER", "career", False),
    ("command-experience", "platinum", "CMD", "COMMAND", "career", False),
    ("tender-operations", "silver", "TDR", "TENDER OPS", "ops", False),
    ("watersports-operations", "silver", "H2O", "WATERSPORTS", "ops", False),
    ("crane-operations", "gold", "LIFT", "CRANE OPS", "ops", False),
    ("helicopter-operations", "platinum", "HELO", "FLIGHT OPS", "ops", False),
]


def uid():
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=6))


def hex_points(cx, cy, r, start_deg=-90):
    pts = []
    for i in range(6):
        a = math.radians(start_deg + i * 60)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


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


def inner_fill(u, c, split):
    clip = hex_path(CX, CY, 40)
    if split:
        return f"""
    <clipPath id="hex-inner-{u}"><path d="{clip}"/></clipPath>
    <g clip-path="url(#hex-inner-{u})">
      <rect x="0" y="0" width="{CX}" height="120" fill="{c['inner'][0]}"/>
      <rect x="{CX}" y="0" width="{CX}" height="120" fill="{c['inner'][1]}"/>
    </g>"""
    return f"""
    <path d="{clip}" fill="url(#disc-{u})"/>
    <path d="{clip}" fill="url(#shine-{u})"/>"""


def render_icon(icon, accent="#FFFFFF"):
    return f"""
  <g shape-rendering="geometricPrecision">
    <g color="{ICON_OUTLINE}" opacity="0.38" transform="translate(0, 2)">{icon}</g>
    <g color="{accent}" stroke="{ICON_OUTLINE}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke fill">{icon}</g>
  </g>"""


def build_svg(tier, main, label, cat, split=False, locked=False):
    t = TIERS.get(tier, TIERS["default"])
    c = CATEGORIES.get(cat, CATEGORIES["sea"])
    u = uid()
    icon = ICONS.get(cat, ICONS["sea"])
    main_size = main_font_size(main)
    label_size = label_font_size(label)
    outer_hex = hex_path(CX, CY, 50)
    inner_hex = hex_path(CX, CY, 40)
    pill_fill = c["inner"][0] if split else c["glow"]
    pill_text = "#FDE68A" if split else "#0F172A"
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
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img">
  <defs>
    <linearGradient id="ring-{u}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{t['a']}"/>
      <stop offset="50%" stop-color="{t['b']}"/>
      <stop offset="100%" stop-color="{t['c']}"/>
    </linearGradient>
    <radialGradient id="disc-{u}" cx="38%" cy="32%" r="68%">
      <stop offset="0%" stop-color="{c['inner'][1]}"/>
      <stop offset="100%" stop-color="{c['inner'][0]}"/>
    </radialGradient>
    <linearGradient id="shine-{u}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.24"/>
      <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <filter id="sh-{u}" x="-20%" y="-15%" width="140%" height="150%">
      <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#0F172A" flood-opacity="0.28"/>
    </filter>
  </defs>

  <g filter="url(#sh-{u})">
    <path d="{outer_hex}" fill="none" stroke="url(#ring-{u})" stroke-width="5" stroke-linejoin="round"/>
{vertex_ticks(u)}
{inner_fill(u, c, split)}
    <path d="{inner_hex}" fill="none" stroke="#FFFFFF" stroke-opacity="0.14" stroke-width="1"/>
  </g>

{render_icon(icon, c['accent'])}

  <rect x="26" y="82" width="68" height="18" rx="4" fill="#0F172A" opacity="0.85"/>
  <rect x="27" y="83" width="66" height="16" rx="3" fill="{pill_fill}" opacity="0.96"/>
  <text x="60" y="94.5" text-anchor="middle"
    font-family="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    font-size="{main_size}" font-weight="800" letter-spacing="0.6"
    fill="{pill_text}">{main}</text>

  <text x="60" y="108" text-anchor="middle"
    font-family="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    font-size="{label_size}" font-weight="700" letter-spacing="0.9"
    fill="#64748B">{label}</text>

  {lock}
</svg>"""


def main():
    os.makedirs(OUT, exist_ok=True)
    for file, tier, main, label, cat, split in BADGE_DEFS:
        with open(os.path.join(OUT, f"{file}.svg"), "w", encoding="utf-8") as f:
            f.write(build_svg(tier, main, label, cat, split))
    with open(os.path.join(OUT, "locked.svg"), "w", encoding="utf-8") as f:
        f.write(build_svg("silver", "—", "LOCKED", "sea", locked=True))
    with open(os.path.join(OUT, "default.svg"), "w", encoding="utf-8") as f:
        f.write(build_svg("default", "SV", "SEA-V CREW", "sea"))
    print(f"Generated {len(BADGE_DEFS) + 2} hex badges in {OUT}")


if __name__ == "__main__":
    main()
