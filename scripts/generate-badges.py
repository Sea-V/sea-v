#!/usr/bin/env python3
"""Generate modern gradient medallion badges. Mirrors scripts/generate-badges.mjs."""
import math
import os
import random
import string

OUT = os.path.join(os.path.dirname(__file__), "..", "img", "badges")

TIERS = {
    "bronze": {"a": "#FDBA74", "b": "#C2410C", "c": "#FED7AA", "ticks": 5},
    "silver": {"a": "#E2E8F0", "b": "#64748B", "c": "#F8FAFC", "ticks": 6},
    "gold": {"a": "#FDE68A", "b": "#D97706", "c": "#FFFBEB", "ticks": 8},
    "platinum": {"a": "#67E8F9", "b": "#0891B2", "c": "#ECFEFF", "ticks": 10},
    "default": {"a": "#93C5FD", "b": "#2563EB", "c": "#EFF6FF", "ticks": 6},
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
    ("sea-30-days", "default", "30", "DAYS AT SEA", "sea"),
    ("sea-100-days", "default", "100", "DAYS AT SEA", "sea"),
    ("sea-250-days", "silver", "250", "DAYS AT SEA", "sea"),
    ("sea-500-days", "gold", "500", "DAYS AT SEA", "sea"),
    ("sea-1-year", "gold", "1 YR", "SEA TIME", "sea"),
    ("sea-3-years", "platinum", "3 YR", "SEA TIME", "sea"),
    ("first-vessel-logged", "bronze", "1ST", "VESSEL", "vessel"),
    ("vessels-3-served", "silver", "3", "YACHTS", "vessel"),
    ("vessel-types-5", "gold", "5", "HULL TYPES", "vessel"),
    ("large-yacht-50m", "silver", "50m+", "SUPERYACHT", "vessel"),
    ("explorer-vessel", "silver", "EXP", "EXPLORER", "vessel"),
    ("commercial-vessel", "silver", "COM", "COMMERCIAL", "vessel"),
    ("offshore-100nm", "bronze", "100", "OFFSHORE NM", "passage"),
    ("passage-500nm", "silver", "500", "PASSAGE NM", "passage"),
    ("passage-1000nm", "gold", "1K", "PASSAGE NM", "passage"),
    ("atlantic-crossing", "gold", "ATL", "CROSSING", "ocean"),
    ("pacific-crossing", "platinum", "PAC", "CROSSING", "ocean"),
    ("polar-navigation", "platinum", "POLAR", "NAVIGATION", "polar"),
    ("first-watchkeeping", "bronze", "1ST", "WATCH", "watch"),
    ("watchkeeping-100-days", "gold", "100", "BRIDGE DAYS", "watch"),
    ("oow-level", "gold", "OOW", "DECK OFFICER", "watch"),
    ("bridge-leader", "platinum", "LEAD", "BRIDGE", "watch"),
    ("first-promotion", "silver", "UP", "PROMOTION", "career"),
    ("senior-crew", "gold", "SNR", "SENIOR CREW", "career"),
    ("officer-rank", "gold", "OFC", "OFFICER", "career"),
    ("command-experience", "platinum", "CMD", "COMMAND", "career"),
    ("tender-operations", "silver", "TDR", "TENDER OPS", "ops"),
    ("watersports-operations", "silver", "H2O", "WATERSPORTS", "ops"),
    ("crane-operations", "gold", "LIFT", "CRANE OPS", "ops"),
    ("helicopter-operations", "platinum", "HELO", "FLIGHT OPS", "ops"),
]


def uid():
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=6))


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


def tick_marks(tier, u):
    t = TIERS.get(tier, TIERS["default"])
    lines = []
    for i in range(t["ticks"]):
        angle = (i / t["ticks"]) * math.pi * 2 - math.pi / 2
        x1 = 60 + math.cos(angle) * 48
        y1 = 60 + math.sin(angle) * 48
        x2 = 60 + math.cos(angle) * 52
        y2 = 60 + math.sin(angle) * 52
        lines.append(
            f'    <line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" '
            f'stroke="url(#ring-{u})" stroke-width="2.2" stroke-linecap="round" opacity="0.85"/>'
        )
    return "\n".join(lines)


def build_svg(tier, main, label, cat, locked=False):
    t = TIERS.get(tier, TIERS["default"])
    c = CATEGORIES.get(cat, CATEGORIES["sea"])
    u = uid()
    icon = ICONS.get(cat, ICONS["sea"])
    main_size = main_font_size(main)
    label_size = label_font_size(label)
    lock = ""
    if locked:
        lock = """
  <circle cx="60" cy="60" r="38" fill="#F1F5F9" opacity="0.72"/>
  <g transform="translate(60,58)" stroke="#64748B" fill="none" stroke-width="2.2" stroke-linecap="round">
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
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.28"/>
      <stop offset="45%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <filter id="sh-{u}" x="-20%" y="-15%" width="140%" height="150%">
      <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#0F172A" flood-opacity="0.28"/>
    </filter>
    <filter id="glow-{u}" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <ellipse cx="60" cy="108" rx="28" ry="5" fill="#0F172A" opacity="0.12"/>

  <g filter="url(#sh-{u})">
    <circle cx="60" cy="60" r="52" fill="none" stroke="url(#ring-{u})" stroke-width="5.5"/>
{tick_marks(tier, u)}
    <circle cx="60" cy="60" r="42" fill="url(#disc-{u})"/>
    <circle cx="60" cy="60" r="42" fill="url(#shine-{u})"/>
    <circle cx="60" cy="60" r="42" fill="none" stroke="#FFFFFF" stroke-opacity="0.14" stroke-width="1"/>
  </g>

  <g color="{c['accent']}" filter="url(#glow-{u})" transform="translate(0,-2)">
    {icon}
  </g>

  <rect x="28" y="82" width="64" height="18" rx="9" fill="#0F172A" opacity="0.82"/>
  <rect x="29" y="83" width="62" height="16" rx="8" fill="{c['glow']}" opacity="0.95"/>
  <text x="60" y="94.5" text-anchor="middle"
    font-family="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    font-size="{main_size}" font-weight="800" letter-spacing="0.6"
    fill="#0F172A">{main}</text>

  <text x="60" y="108" text-anchor="middle"
    font-family="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    font-size="{label_size}" font-weight="700" letter-spacing="0.9"
    fill="#64748B">{label}</text>

  <circle cx="60" cy="22" r="4" fill="url(#ring-{u})"/>
  <path d="M60 18 L57 24 L63 24 Z" fill="#FFFFFF" opacity="0.9"/>

  {lock}
</svg>"""


def main():
    os.makedirs(OUT, exist_ok=True)
    for file, tier, main, label, cat in BADGE_DEFS:
        with open(os.path.join(OUT, f"{file}.svg"), "w", encoding="utf-8") as f:
            f.write(build_svg(tier, main, label, cat))
    with open(os.path.join(OUT, "locked.svg"), "w", encoding="utf-8") as f:
        f.write(build_svg("silver", "—", "LOCKED", "sea", locked=True))
    with open(os.path.join(OUT, "default.svg"), "w", encoding="utf-8") as f:
        f.write(build_svg("default", "SV", "SEA-V CREW", "sea"))
    print(f"Generated {len(BADGE_DEFS) + 2} modern medallion badges in {OUT}")


if __name__ == "__main__":
    main()
