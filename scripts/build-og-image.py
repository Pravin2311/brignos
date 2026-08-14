#!/usr/bin/env python3
"""
Generates img/og-cover.png (1200x630) — the social share card for autoDNG.
Matches the site palette: near-black ground, lime accent, faint grid.
Usage: python scripts/build-og-image.py
"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1200, 630
BG = (9, 9, 11)
GRID = (255, 255, 255, 10)
LIME = (200, 240, 74)
TEXT = (237, 237, 238)
MUTED = (152, 152, 162)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "img", "og-cover.png")

FONT_DIRS = [r"C:\Windows\Fonts", "/usr/share/fonts", "/Library/Fonts"]
CANDIDATES = {
    "bold": ["segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf", "Helvetica.ttc"],
    "regular": ["segoeui.ttf", "arial.ttf", "DejaVuSans.ttf", "Helvetica.ttc"],
    "mono": ["consola.ttf", "cour.ttf", "DejaVuSansMono.ttf", "Menlo.ttc"],
}


def load(kind, size):
    for name in CANDIDATES[kind]:
        for d in FONT_DIRS:
            p = os.path.join(d, name)
            if os.path.exists(p):
                try:
                    return ImageFont.truetype(p, size)
                except OSError:
                    continue
    return ImageFont.load_default()


img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img, "RGBA")

# Faint 48px grid, same as the site background.
for x in range(0, W, 48):
    draw.line([(x, 0), (x, H)], fill=GRID, width=1)
for y in range(0, H, 48):
    draw.line([(0, y), (W, y)], fill=GRID, width=1)

# Lime glow anchored bottom-right, drawn on its own layer and blurred so the
# concentric steps composite into a smooth falloff instead of visible banding.
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gdraw = ImageDraw.Draw(glow)
for r in range(420, 0, -6):
    a = int(20 * (1 - r / 420) ** 1.6)
    gdraw.ellipse([W - 210 - r, H - 90 - r, W - 210 + r, H - 90 + r],
                  fill=(200, 240, 74, max(a, 0)))
glow = glow.filter(ImageFilter.GaussianBlur(70))
img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
draw = ImageDraw.Draw(img, "RGBA")

PAD = 84
draw.rectangle([0, 0, 10, H], fill=LIME)

f_eyebrow = load("mono", 22)
f_logo = load("bold", 78)
f_head = load("bold", 56)
f_sub = load("regular", 27)
f_chip = load("mono", 21)

y = 92
draw.text((PAD, y), "AUTODNG.COM", font=f_eyebrow, fill=LIME)
y += 52
draw.text((PAD, y), "auto", font=f_logo, fill=TEXT)
w_auto = draw.textlength("auto", font=f_logo)
draw.text((PAD + w_auto, y), "DNG", font=f_logo, fill=LIME)

y += 116
draw.text((PAD, y), "Name your startup.", font=f_head, fill=TEXT)
y += 68
draw.text((PAD, y), "Check the domain. Ship it.", font=f_head, fill=TEXT)

y += 86
draw.text((PAD, y), "AI brand naming, live domain checks, valuation",
          font=f_sub, fill=MUTED)
y += 38
draw.text((PAD, y), "and trademark screening — in one place.",
          font=f_sub, fill=MUTED)

# Feature chips along the bottom.
chips = ["7 naming agents", "Live RDAP", "Valuation", "TM risk"]
cx = PAD
cy = H - 84
for c in chips:
    tw = draw.textlength(c, font=f_chip)
    draw.rounded_rectangle([cx, cy, cx + tw + 34, cy + 46], radius=23,
                           fill=(24, 24, 30), outline=(255, 255, 255, 34))
    draw.text((cx + 17, cy + 11), c, font=f_chip, fill=MUTED)
    cx += tw + 34 + 14

os.makedirs(os.path.dirname(OUT), exist_ok=True)
img.save(OUT, "PNG", optimize=True)
print(f"wrote {OUT} ({os.path.getsize(OUT) // 1024} KB)")
