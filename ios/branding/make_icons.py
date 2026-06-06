"""
Altis app-icon generator.

Authors three on-brand icon concepts as vector-like geometry in Pillow,
supersampled 4x for crisp anti-aliased edges, on the Altis palette
(slate ink #0f172a + teal accent #0d9488).

Outputs (in ios/branding/):
  icon_concept_a.png  "A-Frame"  — Altis monogram as a roof (brand mark)
  icon_concept_b.png  "Under One Roof" — roof + ascending cashflow bars + rain
  icon_concept_c.png  "Rain to Cash" — droplet holding a cash uptick
  contact_sheet.png   — all three large + an 80px legibility strip

  master_1024.png     — the chosen concept at 1024 (no alpha) for the App Store
"""
from PIL import Image, ImageDraw, ImageFont
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SS = 4                      # supersample factor
N = 1024                    # final icon size

# ---- palette ---------------------------------------------------------------
SLATE_TOP = (24, 34, 57)    # subtle top of background gradient
SLATE_BOT = (11, 17, 32)    # darker bottom — premium depth, still on-brand
WHITE = (248, 250, 252)     # slate-50 — primary shapes
TEAL = (13, 148, 136)       # teal-600 — brand accent
TEAL_500 = (20, 184, 166)
TEAL_400 = (45, 212, 191)   # pops on dark
TEAL_300 = (94, 234, 212)
TEAL_700 = (15, 118, 110)


def gradient_bg(size):
    """Vertical slate gradient, returned as an opaque RGB image."""
    top, bot = SLATE_TOP, SLATE_BOT
    col = Image.new("RGB", (1, size))
    px = col.load()
    for y in range(size):
        t = y / (size - 1)
        px[0, y] = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
    bg = col.resize((size, size))
    # soft radial highlight, upper-third, for depth
    glow = Image.new("L", (size, size), 0)
    gd = ImageDraw.Draw(glow)
    cx, cy, r = size * 0.5, size * 0.34, size * 0.62
    gd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=46)
    glow = glow.resize((size, size))
    light = Image.new("RGB", (size, size), (60, 78, 110))
    bg = Image.composite(light, bg, glow)
    return bg


def new_layer():
    return Image.new("RGBA", (N * SS, N * SS), (0, 0, 0, 0))


def s(v):
    return v * SS


def sl(seq):
    return [v * SS for v in seq]


def sp(points):
    return [(x * SS, y * SS) for (x, y) in points]


def round_line(dr, p0, p1, width, fill):
    """Line with rounded caps (Pillow lines are butt-capped)."""
    dr.line(sp([p0, p1]), fill=fill, width=int(s(width)))
    r = width / 2.0
    for (x, y) in (p0, p1):
        dr.ellipse(sl([x - r, y - r, x + r, y + r]), fill=fill)


def drop(dr, cx, cy, size, fill):
    """A teardrop: pointed top, round bottom."""
    rad = size * 0.5
    cyb = cy + size * 0.28
    dr.ellipse(sl([cx - rad, cyb - rad, cx + rad, cyb + rad]), fill=fill)
    apex = (cx, cy - size * 0.72)
    dr.polygon(sp([apex, (cx - rad * 0.92, cyb), (cx + rad * 0.92, cyb)]), fill=fill)


# ---- Concept A: "A-Frame" — Altis monogram as a roof -----------------------
def draw_a(dr):
    apex = (512, 250)
    bl, br = (324, 778), (700, 778)
    w = 122
    round_line(dr, apex, bl, w, WHITE)
    round_line(dr, apex, br, w, WHITE)
    # fuse apex cleanly
    r = w / 2
    dr.ellipse(sl([apex[0] - r, apex[1] - r, apex[0] + r, apex[1] + r]), fill=WHITE)
    # crossbar = cash baseline (teal)
    dr.rounded_rectangle(sl([398, 556, 626, 632]), radius=s(38), fill=TEAL)
    # weather cue: a single drop resting in the gable
    drop(dr, 512, 470, 132, TEAL_400)


# ---- Concept B: "Under One Roof" — roof + ascending bars + rain ------------
def draw_b(dr):
    apex = (512, 196)
    le, re = (236, 452), (788, 452)
    t = 132
    poly = [le, apex, re, (re[0], re[1] + t), (apex[0], apex[1] + t), (le[0], le[1] + t)]
    dr.polygon(sp(poly), fill=WHITE)
    # eave caps rounded
    for (x, y) in (le, re):
        dr.ellipse(sl([x - t / 2, y, x + t / 2, y + t]), fill=WHITE)
    # rain between roof and bars
    drop(dr, 360, 556, 70, TEAL_400)
    drop(dr, 664, 588, 70, TEAL_400)
    # ascending cashflow bars
    base = 800
    bw, gap = 92, 34
    heights = [150, 214, 280, 348]
    shades = [TEAL_700, TEAL, TEAL_500, TEAL_400]
    total = len(heights) * bw + (len(heights) - 1) * gap
    x = 512 - total / 2
    for h, c in zip(heights, shades):
        dr.rounded_rectangle(sl([x, base - h, x + bw, base]), radius=s(20), fill=c)
        x += bw + gap


# ---- Concept C: "Rain to Cash" — droplet holding an uptick -----------------
def draw_c(dr):
    # thin roof line across the top
    apex = (512, 196)
    le, re = (322, 322), (702, 322)
    round_line(dr, le, apex, 34, WHITE)
    round_line(dr, apex, re, 34, WHITE)
    # side rain
    drop(dr, 300, 470, 92, TEAL_400)
    drop(dr, 724, 470, 92, TEAL_400)
    # big central droplet (teal)
    drop(dr, 512, 600, 360, TEAL)
    # cash uptick inside the droplet (white)
    pts = [(420, 690), (492, 626), (548, 668), (628, 566)]
    for i in range(len(pts) - 1):
        round_line(dr, pts[i], pts[i + 1], 30, WHITE)
    # arrowhead
    ah = pts[-1]
    dr.polygon(sp([(ah[0] + 6, ah[1] - 8), (ah[0] - 44, ah[1] + 2),
                   (ah[0] + 2, ah[1] + 48)]), fill=WHITE)


CONCEPTS = {
    "a": ("A-Frame", "Altis monogram as a roof", draw_a),
    "b": ("Under One Roof", "Roof · cashflow · weather", draw_b),
    "c": ("Rain to Cash", "Weather delays the cash", draw_c),
}


def render(concept, size=N):
    """Return an opaque RGB icon (full-bleed square, App-Store ready)."""
    bg = gradient_bg(size).convert("RGB")
    layer = new_layer()
    draw_fn = CONCEPTS[concept][2]
    draw_fn(ImageDraw.Draw(layer))
    layer = layer.resize((size, size), Image.LANCZOS)
    bg.paste(layer, (0, 0), layer)
    return bg


def rounded_preview(img, radius_frac=0.224):
    """Round corners (iOS-ish) for display only."""
    size = img.size[0]
    r = int(size * radius_frac)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size, size], radius=r, fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def _font(sz):
    for p in ("/System/Library/Fonts/Helvetica.ttc",
              "/System/Library/Fonts/Supplemental/Arial.ttf"):
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, sz)
            except Exception:
                pass
    return ImageFont.load_default()


def contact_sheet():
    keys = list(CONCEPTS.keys())
    tile = 360
    pad = 56
    label_h = 92
    strip = 96
    W = pad + len(keys) * (tile + pad)
    H = pad + label_h + tile + pad + strip + pad + 40
    sheet = Image.new("RGB", (W, H), (241, 245, 249))
    d = ImageDraw.Draw(sheet)
    title = _font(40)
    sub = _font(24)
    d.text((pad, 26), "Altis — app icon concepts", font=title, fill=(15, 23, 42))
    for i, k in enumerate(keys):
        name, tag, _ = CONCEPTS[k]
        x = pad + i * (tile + pad)
        y = pad + 56
        icon = rounded_preview(render(k, 512).resize((tile, tile), Image.LANCZOS))
        sheet.paste(icon, (x, y), icon)
        d.text((x + 4, y + tile + 14), f"{chr(65+i)}.  {name}", font=sub, fill=(15, 23, 42))
        d.text((x + 4, y + tile + 46), tag, font=_font(20), fill=(71, 85, 105))
        # legibility chip at 80px
        chip = rounded_preview(render(k, 256).resize((strip, strip), Image.LANCZOS))
        sheet.paste(chip, (x + 4, y + tile + 84), chip)
        d.text((x + strip + 18, y + tile + 96 + strip // 2 - 12),
               "actual home-screen size", font=_font(18), fill=(100, 116, 139))
    sheet.save(os.path.join(HERE, "contact_sheet.png"))


def main():
    os.makedirs(HERE, exist_ok=True)
    for k in CONCEPTS:
        render(k).save(os.path.join(HERE, f"icon_concept_{k}.png"))
    contact_sheet()
    print("wrote concepts + contact_sheet.png to", HERE)


if __name__ == "__main__":
    main()
