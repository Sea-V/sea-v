#!/usr/bin/env python3
"""Generate typographic hex badges from scripts/page-colors.json + badge-copy.json."""
import json
import math
import os
import random
import string

ROOT = os.path.dirname(__file__)
OUT = os.path.join(ROOT, "..", "img", "badges")
PAGE_COLORS_PATH = os.path.join(ROOT, "page-colors.json")
PAGE_COLORS_JS = os.path.join(ROOT, "..", "js", "seav-page-colors.js")
BADGE_COPY_PATH = os.path.join(ROOT, "badge-copy.json")

with open(PAGE_COLORS_PATH, encoding="utf-8") as f:
    PAGES = json.load(f)

with open(BADGE_COPY_PATH, encoding="utf-8") as f:
    BADGE_DEFS = json.load(f)

CX, CY = 60, 56
TEXT = "#0F172A"
FONT = "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"


def esc(text):
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def page_ring(page):
    a, b, c = page["ring"]
    return a, b, c


def page_inner(page):
    a, b, c = page["ring"]
    return {"fill": [b, c], "pill": [a, c]}


def hero_font_size(hero):
    h = str(hero)
    if h and h[0].isdigit():
        if len(h) <= 2:
            return 38
        if len(h) <= 3:
            return 32
        return 26
    if len(h) <= 3:
        return 28
    if len(h) <= 5:
        return 20
    if len(h) <= 7:
        return 16
    return 13


def split_words(text, max_len=11):
    if len(text) <= max_len:
        return [text]
    words = text.split(" ")
    if len(words) >= 2:
        mid = math.ceil(len(words) / 2)
        return [" ".join(words[:mid]), " ".join(words[mid:])]
    mid = math.ceil(len(text) / 2)
    return [text[:mid], text[mid:]]


def render_typography(hero, sub, tag, theme):
    hero_lines = split_words(hero, 9)
    sub_lines = split_words(sub, 13)
    hero_size = hero_font_size(hero_lines[0])
    hero_line_h = hero_size * 0.92
    sub_size = 7.6 if any(len(l) > 12 for l in sub_lines) else 8.8
    sub_line_h = 10.5

    hero_block_h = len(hero_lines) * hero_line_h
    sub_block_h = len(sub_lines) * sub_line_h
    total_h = 8 + hero_block_h + 6 + sub_block_h
    tag_y = 50 - total_h / 2
    hero_start_y = tag_y + 10
    sub_start_y = hero_start_y + hero_block_h + 6
    accent_y = sub_start_y + sub_block_h + 8

    hero_tspans = []
    for i, line in enumerate(hero_lines):
        if i == 0:
            hero_tspans.append(
                f'<tspan x="60" y="{hero_start_y:.1f}">{esc(line)}</tspan>'
            )
        else:
            hero_tspans.append(
                f'<tspan x="60" dy="{hero_line_h:.1f}">{esc(line)}</tspan>'
            )

    sub_tspans = []
    for i, line in enumerate(sub_lines):
        if i == 0:
            sub_tspans.append(
                f'<tspan x="60" y="{sub_start_y:.1f}">{esc(line)}</tspan>'
            )
        else:
            sub_tspans.append(
                f'<tspan x="60" dy="{sub_line_h:.1f}">{esc(line)}</tspan>'
            )

    tracking = "0.5" if len(hero) > 5 else "1.2"
    sidebar = theme["sidebar"]

    return f"""
  <g font-family="{FONT}" text-anchor="middle">
    <text x="60" y="{tag_y:.1f}" font-size="6.4" font-weight="800" letter-spacing="1.8" fill="{sidebar}">{esc(tag)}</text>
    <text font-size="{hero_size}" font-weight="900" letter-spacing="{tracking}" fill="{TEXT}">{''.join(hero_tspans)}</text>
    <text font-size="{sub_size}" font-weight="700" letter-spacing="1.3" fill="{TEXT}" opacity="0.76">{''.join(sub_tspans)}</text>
    <line x1="36" y1="{accent_y:.1f}" x2="84" y2="{accent_y:.1f}" stroke="{sidebar}" stroke-width="2" stroke-linecap="round" opacity="0.42"/>
  </g>"""


def uid():
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=6))


def hex_points(cx, cy, r, start_deg=-90):
    return [
        (
            cx + r * math.cos(math.radians(start_deg + i * 60)),
            cy + r * math.sin(math.radians(start_deg + i * 60)),
        )
        for i in range(6)
    ]


def hex_path(cx, cy, r, start_deg=-90):
    pts = hex_points(cx, cy, r, start_deg)
    return "M " + " L ".join(f"{x:.2f} {y:.2f}" for x, y in pts) + " Z"


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


def build_svg(definition, locked=False):
    page = definition["page"]
    theme = PAGES.get(page, PAGES["seatime"])
    ra, rb, rc = page_ring(theme)
    inner = page_inner(theme)
    u = uid()
    hero = definition["hero"]
    sub = definition["sub"]
    tag = definition["tag"]
    tier = definition.get("tier", "default")

    outer_hex = hex_path(CX, CY, 50)
    inner_hex = hex_path(CX, CY, 40)
    clip = hex_path(CX, CY, 40)

    lock = ""
    if locked:
        lock = f"""
  <path d="{inner_hex}" fill="#F1F5F9" opacity="0.82"/>
  <text x="60" y="58" text-anchor="middle" font-family="{FONT}" font-size="11" font-weight="800" letter-spacing="1.4" fill="#64748B">LOCKED</text>"""

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="{esc(f'{hero} {sub}')}" data-source-page="{page}" data-tier="{tier}">
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
    <path d="{clip}" fill="url(#disc-{u})"/>
    <path d="{clip}" fill="url(#shine-{u})"/>
    <path d="{inner_hex}" fill="none" stroke="#FFFFFF" stroke-opacity="0.16" stroke-width="1"/>
  </g>
{render_typography(hero, sub, tag, theme)}
  {lock}
</svg>"""


def sync_page_colors_js():
    payload = {"pages": PAGES}
    body = (
        "/* Auto-generated from scripts/page-colors.json — run scripts/generate-badges.py */\n"
        f"window.SeavPageColors = {json.dumps(payload, indent=2)};\n"
    )
    with open(PAGE_COLORS_JS, "w", encoding="utf-8") as f:
        f.write(body)


def main():
    os.makedirs(OUT, exist_ok=True)
    sync_page_colors_js()
    for definition in BADGE_DEFS:
        with open(os.path.join(OUT, f"{definition['file']}.svg"), "w", encoding="utf-8") as f:
            f.write(build_svg(definition))
    with open(os.path.join(OUT, "locked.svg"), "w", encoding="utf-8") as f:
        f.write(
            build_svg(
                {
                    "file": "locked",
                    "tier": "silver",
                    "hero": "LOCKED",
                    "sub": "MILESTONE",
                    "tag": "SEA-V",
                    "page": "achievements",
                },
                locked=True,
            )
        )
    with open(os.path.join(OUT, "default.svg"), "w", encoding="utf-8") as f:
        f.write(
            build_svg(
                {
                    "file": "default",
                    "tier": "default",
                    "hero": "SEA-V",
                    "sub": "CREW BADGE",
                    "tag": "ACHIEVEMENT",
                    "page": "achievements",
                }
            )
        )
    print(f"Generated {len(BADGE_DEFS) + 2} typographic hex badges in {OUT}")


if __name__ == "__main__":
    main()
