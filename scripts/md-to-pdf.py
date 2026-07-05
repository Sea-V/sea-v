#!/usr/bin/env python3
"""Convert markdown files to PDF (fpdf2 + markdown)."""

import re
import sys
from pathlib import Path

import markdown
from fpdf import FPDF


class SeaVPDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "I", 9)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, "SEA-V Website Plan", align="R", new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")


def normalize_for_pdf(text: str) -> str:
    replacements = {
        "\u2014": "-",  # em dash
        "\u2013": "-",  # en dash
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2026": "...",
        "\u2192": "->",
        "\u00b7": "-",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    return text


def md_to_html(text: str) -> str:
    text = normalize_for_pdf(text)
    html = markdown.markdown(
        text,
        extensions=["tables", "fenced_code", "nl2br"],
    )
    # fpdf2 write_html is picky — wrap bare content
    return f'<div style="font-family: Helvetica; font-size: 11pt; line-height: 1.5;">{html}</div>'


def convert_file(md_path: Path) -> Path:
    pdf_path = md_path.with_suffix(".pdf")
    text = md_path.read_text(encoding="utf-8")

    pdf = SeaVPDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()
    pdf.write_html(md_to_html(text))
    pdf.output(str(pdf_path))
    return pdf_path


def main():
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / "Desktop" / "SEA-V-Website-Plan"
    if not root.is_dir():
        print(f"Directory not found: {root}", file=sys.stderr)
        sys.exit(1)

    md_files = sorted(root.rglob("*.md"))
    if not md_files:
        print(f"No markdown files in {root}", file=sys.stderr)
        sys.exit(1)

    for md_path in md_files:
        try:
            pdf_path = convert_file(md_path)
            print(f"OK  {md_path.relative_to(root)} -> {pdf_path.name}")
        except Exception as exc:
            print(f"ERR {md_path}: {exc}", file=sys.stderr)
            sys.exit(1)

    print(f"\nConverted {len(md_files)} files in {root}")


if __name__ == "__main__":
    main()
