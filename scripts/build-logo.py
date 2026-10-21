"""
LESSON 18 — build-logo.py turns the logo into sharp vector files (SVG).

A JPG is made of pixels, so it goes blurry when it's enlarged. An SVG is
made of shapes, so it stays sharp at any size, from a browser tab to a
shop sign.

How the logo is rebuilt from images/brand/original-logo-source.jpg:
  • The marquise "A" mark is drawn from measurements: two arcs, an inner
    diamond, and the A's crossbar.
  • The letters are drawn from real font outlines. Each letter of the
    original was compared pixel by pixel against candidate fonts:
      AURANTIA                → Cormorant Garamond SemiBold (closest match)
      JEWELRY & ACCESSORIES   → Montserrat Regular
    Each letter is placed exactly where it sits in the original, so the
    spacing is Aurantia's own.

Run:  pip install fonttools brotli pillow numpy   then   python3 scripts/build-logo.py
Writes images/brand/logo-mark.svg, logo-wordmark.svg, logo-lockup.svg and
their "-teal" versions for light backgrounds.
"""
import pathlib
import numpy as np
from PIL import Image
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = pathlib.Path(__file__).resolve().parent.parent
BRAND = ROOT / "images" / "brand"
FONTS = ROOT / "assets" / "fonts"
SRC = BRAND / "original-logo-source.jpg"
SERIF = FONTS / "cormorant-garamond-latin-600-normal.woff2"
SANS = FONTS / "montserrat-latin-400-normal.woff2"

GOLD_STOPS = [(0, "#fcf0c6"), (0.28, "#f1d886"), (0.52, "#e2be62"), (0.68, "#c59f4a"), (0.84, "#e7c874"), (1, "#f8e6aa")]   # soft metallic gold
TEAL = "#01323d"
red = np.asarray(Image.open(SRC).convert("RGB")).astype(float)[..., 0]

# ---------- measuring the original ----------
def letter_boxes(box, thr):
    """Each letter's left/right edge, and the line's top and baseline, in the original."""
    x0, y0, x1, y1 = box
    m = red[y0:y1, x0:x1] > thr
    cols = m.any(axis=0)
    boxes, inside, start = [], False, 0
    for x, v in enumerate(cols):
        if v and not inside: inside, start = True, x
        if not v and inside:
            inside = False
            if x - start > 1: boxes.append((x0 + start, x0 + x))
    if inside: boxes.append((x0 + start, x0 + len(cols)))
    rows = np.nonzero(m.any(axis=1))[0]
    return boxes, y0 + rows.min(), y0 + rows.max() + 1

# ---------- drawing letters from a font ----------
def glyph_path(font, ch, left, right, cap_top, baseline):
    gs = font.getGlyphSet()
    name = font.getBestCmap()[ord(ch)]
    cap = font["OS/2"].sCapHeight or font["head"].unitsPerEm * 0.7
    s = (baseline - cap_top) / cap
    bp = BoundsPen(gs); gs[name].draw(bp)
    gx0, _, gx1, _ = bp.bounds
    pen = SVGPathPen(gs)
    # font units have y going up; SVG has y going down
    tp = TransformPen(pen, (s, 0, 0, -s, (left + right) / 2 - (gx0 + gx1) / 2 * s, baseline))
    gs[name].draw(tp)
    return pen.getCommands()

def line(font_path, text, box, thr):
    font = TTFont(str(font_path))
    boxes, top, bottom = letter_boxes(box, thr)
    chars = [c for c in text if c != " "]
    if len(boxes) != len(chars):
        raise SystemExit(f"Found {len(boxes)} letters for '{text}': adjust the threshold")
    return " ".join(glyph_path(font, ch, l, r, top, bottom) for ch, (l, r) in zip(chars, boxes)), (top, bottom)

# ---------- the mark ----------
def mark_paths(ox, oy):
    top, bot, cx, half = 13.0 + oy, 225.0 + oy, 80.0 + ox, 57.0
    mid = (top + bot) / 2
    h = (bot - top) / 2
    radius = (h * h + half * half) / (2 * half)          # circle through the 3 measured points
    cross = 89 + oy
    t = (cross - top) / (mid - top)
    xl, xr = cx - (half - 3) * t, cx + (half - 3) * t
    return (f'<path d="M{cx} {top} A{radius:.2f} {radius:.2f} 0 0 0 {cx} {bot} A{radius:.2f} {radius:.2f} 0 0 0 {cx} {top} Z"/>'
            f'<path d="M{cx} {top} L{cx - half + 3} {mid} L{cx} {bot} L{cx + half - 3} {mid} Z"/>'
            f'<path d="M{xl:.2f} {cross} L{xr:.2f} {cross}"/>'), (top, bot)

def grad(id_, y0, y1):
    stops = "".join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in GOLD_STOPS)
    # userSpaceOnUse so the perfectly flat crossbar still gets painted
    return f'<linearGradient id="{id_}" gradientUnits="userSpaceOnUse" x1="0" y1="{y0:.1f}" x2="0" y2="{y1:.1f}">{stops}</linearGradient>'

def save(name, view, parts, label):
    vx, vy, vw, vh = view
    for suffix, paint in (("", "gold"), ("-teal", "teal")):
        defs, body = [], []
        for i, (kind, d, (y0, y1)) in enumerate(parts):
            colour = TEAL
            if paint == "gold":
                defs.append(grad(f"g{i}", y0, y1)); colour = f"url(#g{i})"
            if kind == "stroke":
                body.append(f'<g fill="none" stroke="{colour}" stroke-width="5.2" stroke-linejoin="miter">{d}</g>')
            else:
                body.append(f'<path fill="{colour}" d="{d}"/>')
        (BRAND / f"{name}{suffix}.svg").write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vx:.1f} {vy:.1f} {vw:.1f} {vh:.1f}" role="img" aria-label="{label.replace("&", "&amp;")}">'
            f'<defs>{"".join(defs)}</defs>{"".join(body)}</svg>\n')

mark, mark_y = mark_paths(470, 715)
aurantia, a_y = line(SERIF, "AURANTIA", (165, 975, 945, 1068), 110)
jewelry, j_y = line(SANS, "JEWELRY & ACCESSORIES", (165, 1078, 945, 1114), 75)

save("logo-mark", (486, 721, 128, 226), [("stroke", mark, mark_y)], "Aurantia")
save("logo-wordmark", (176, a_y[0] - 3, 760, a_y[1] - a_y[0] + 6), [("fill", aurantia, a_y)], "Aurantia")
save("logo-lockup", (176, 721, 760, j_y[1] - 721 + 4),
     [("stroke", mark, mark_y), ("fill", aurantia, a_y), ("fill", jewelry, j_y)], "Aurantia — Jewelry & Accessories")
print("wrote logo SVGs to", BRAND)
