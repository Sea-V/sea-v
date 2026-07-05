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

CATEGORIES = {
    "sea": {"inner": ["#0C4A6E", "#0369A1"], "accent": "#7DD3FC", "glow": "#38BDF8"},
    "vessel": {"inner": ["#7C2D12", "#C2410C"], "accent": "#FDBA74", "glow": "#FB923C"},
    "passage": {"inner": ["#581C87", "#7E22CE"], "accent": "#E9D5FF", "glow": "#C084FC"},
    "ocean": {"inner": ["#1E3A8A", "#1D4ED8"], "accent": "#FDE68A", "glow": "#60A5FA"},
    "polar": {"inner": ["#164E63", "#0891B2"], "accent": "#E0F2FE", "glow": "#67E8F9"},
    "watch": {"inner": ["#312E81", "#4338CA"], "accent": "#C7D2FE", "glow": "#818CF8"},
    "career": {"inner": ["#14532D", "#15803D"], "accent": "#BBF7D0", "glow": "#4ADE80"},
    "ops": {"inner": ["#713F12", "#B45309"], "accent": "#FEF3C7", "glow": "#FBBF24"},
    "helm": {"inner": ["#0F2744", "#D97706"], "accent": "#FDE68A", "glow": "#FBBF24"},
}

ICONS = {
    "sea": """
    <path d="M34 52c6-4 12-4 18 0s12 4 18 0 12-4 18 0" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M30 58c6-3 12-3 18 0s12 3 18 0 12-3 18 0" stroke="currentColor" stroke-width="1.8" fill="none" opacity="0.55" stroke-linecap="round"/>
    <circle cx="60" cy="42" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
    <path d="M60 36v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>""",
    "vessel": """
    <path d="M38 56h44l-6-14H44l-6 14z" fill="currentColor"/>
    <path d="M32 58c8-3 16-3 24 0s16 3 24 0" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M52 42h16v8H52z" fill="currentColor" opacity="0.45"/>
    <path d="M56 38h8v4h-8z" fill="currentColor" opacity="0.7"/>""",
    "passage": """
    <circle cx="42" cy="46" r="4" fill="currentColor"/>
    <circle cx="78" cy="40" r="4" fill="currentColor"/>
    <path d="M46 45c12-8 24-8 30-6" stroke="currentColor" stroke-width="2.2" stroke-dasharray="4 3" fill="none" stroke-linecap="round"/>
    <path d="M54 52l6-8 6 5 8-10" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>""",
    "ocean": """
    <circle cx="60" cy="48" r="18" stroke="currentColor" stroke-width="2" fill="none" opacity="0.35"/>
    <path d="M42 48c6-10 14-10 18 0s14 10 18 0" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M48 56h24l-4-8H52l-4 8z" fill="currentColor"/>""",
    "polar": """
    <path d="M60 34l4 12h12l-9 7 3 12-10-7-10 7 3-12-9-7h12z" fill="currentColor"/>
    <path d="M44 58h32" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>""",
    "watch": """
    <rect x="42" y="38" width="36" height="22" rx="3" stroke="currentColor" stroke-width="2" fill="none"/>
    <path d="M46 52h28" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
    <circle cx="60" cy="49" r="6" stroke="currentColor" stroke-width="1.8" fill="none"/>
    <path d="M60 46v4l2.5 1.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>""",
    "helm": """
    <g transform="translate(60,50)" stroke-linecap="round">
      <circle r="26" fill="none" stroke="currentColor" stroke-width="3"/>
      <circle r="20" fill="none" stroke="currentColor" stroke-width="1.8" opacity="0.55"/>
      <g stroke="currentColor" stroke-width="2.6">
        <line x1="0" y1="-22" x2="0" y2="22"/>
        <line x1="-22" y1="0" x2="22" y2="0"/>
        <line x1="-15.6" y1="-15.6" x2="15.6" y2="15.6"/>
        <line x1="15.6" y1="-15.6" x2="-15.6" y2="15.6"/>
      </g>
      <g fill="currentColor" stroke="#FFFBEB" stroke-width="1">
        <circle cy="-25" r="2.8"/><circle cy="25" r="2.8"/>
        <circle cx="-25" r="2.8"/><circle cx="25" r="2.8"/>
        <circle cx="-17.7" cy="-17.7" r="2.6"/><circle cx="17.7" cy="-17.7" r="2.6"/>
        <circle cx="-17.7" cy="17.7" r="2.6"/><circle cx="17.7" cy="17.7" r="2.6"/>
      </g>
      <circle r="6" fill="#0F2744" stroke="currentColor" stroke-width="2"/>
      <circle r="2.5" fill="currentColor"/>
    </g>""",
    "career": """
    <path d="M48 38h24v6H48z" fill="currentColor" opacity="0.55"/>
    <path d="M44 44h32v6H44z" fill="currentColor" opacity="0.75"/>
    <path d="M40 50h40v6H40z" fill="currentColor"/>
    <path d="M54 56h12v4H54z" fill="currentColor" opacity="0.8"/>""",
    "ops": """
    <circle cx="48" cy="48" r="8" stroke="currentColor" stroke-width="2" fill="none"/>
    <circle cx="72" cy="48" r="8" stroke="currentColor" stroke-width="2" fill="none"/>
    <path d="M54 48h12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M60 56v6M52 60h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>""",
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
    pill_text = c["accent"] if split else "#0F172A"
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
    <filter id="glow-{u}" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <g filter="url(#sh-{u})">
    <path d="{outer_hex}" fill="none" stroke="url(#ring-{u})" stroke-width="5" stroke-linejoin="round"/>
{vertex_ticks(u)}
{inner_fill(u, c, split)}
    <path d="{inner_hex}" fill="none" stroke="#FFFFFF" stroke-opacity="0.14" stroke-width="1"/>
  </g>

  <g color="{c['accent']}" filter="url(#glow-{u})">
    {icon}
  </g>

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
