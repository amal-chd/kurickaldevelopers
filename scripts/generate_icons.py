"""
Generates Kurickal TMS app icons for iOS and Android.
Logo: K-house mark in #4472C4 on white (#FFFFFF) background.
Run: python3 scripts/generate_icons.py
"""

import math
import os
from PIL import Image, ImageDraw

# ── Brand colors ──────────────────────────────────────────────────────────────
LOGO_BLUE   = (68, 114, 196)   # #4472C4
WHITE       = (255, 255, 255)
TRANSPARENT = (0, 0, 0, 0)

# ── Draw the K-house logo onto a canvas of given size ─────────────────────────

def draw_logo(canvas_size: int, padding_ratio: float = 0.12) -> Image.Image:
    """
    Returns an RGBA image of the K-house logo with transparent background.
    The logo fills (1 - 2*padding_ratio) of the canvas.
    """
    img = Image.new("RGBA", (canvas_size, canvas_size), TRANSPARENT)
    draw = ImageDraw.Draw(img)

    pad  = int(canvas_size * padding_ratio)
    size = canvas_size - 2 * pad   # drawable area

    # Helper: map normalised [0,100] coords → pixel
    def px(v):  return pad + int(v / 100 * size)
    def py(v):  return pad + int(v / 100 * size)
    def p(x, y): return (px(x), py(y))

    blue = LOGO_BLUE + (255,)   # with alpha

    # ── 1. Left vertical bar ─────────────────────────────────────────────────
    bar = [p(14, 12), p(30, 12), p(30, 88), p(14, 88)]
    draw.polygon(bar, fill=blue)

    # ── 2. Upper diagonal arm (roof slope) ───────────────────────────────────
    upper = [p(30, 12), p(96, 12), p(66, 52), p(30, 52)]
    draw.polygon(upper, fill=blue)

    # ── 3. Lower diagonal arm ────────────────────────────────────────────────
    # Starts at the roof peak (right of bar, mid-height) and goes lower-right.
    # The left edge slopes outward, leaving white space for the window.
    lower = [p(30, 52), p(66, 52), p(96, 88), p(58, 88)]
    draw.polygon(lower, fill=blue)

    # ── 4. 2×2 window grid ───────────────────────────────────────────────────
    # Positioned in the white negative space between the bar's right edge
    # and the lower arm's diagonal left edge.
    sq_size = size * 0.095   # each square
    gap     = size * 0.028   # gap between squares
    # Anchor just right of the bar at y ≈ 63–83
    wx = pad + size * 0.315
    wy = pad + size * 0.635

    for row in range(2):
        for col in range(2):
            x0 = wx + col * (sq_size + gap)
            y0 = wy + row * (sq_size + gap)
            draw.rectangle(
                [x0, y0, x0 + sq_size, y0 + sq_size],
                fill=blue,
            )

    return img


def make_icon(size: int, bg_color=WHITE, padding_ratio=0.12) -> Image.Image:
    """Square icon: solid background + centred logo."""
    bg  = Image.new("RGBA", (size, size), bg_color + (255,))
    logo = draw_logo(size, padding_ratio=padding_ratio)
    bg.paste(logo, (0, 0), logo)
    return bg.convert("RGB")


def make_icon_rounded(size: int, corner_radius_ratio=0.22) -> Image.Image:
    """Rounded-rect version for Android adaptive background."""
    img = make_icon(size)
    # Apply rounded corners via mask
    r = int(size * corner_radius_ratio)
    mask = Image.new("L", (size, size), 0)
    md   = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
    result = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    result.paste(img, mask=mask)
    return result


# ── Output paths ──────────────────────────────────────────────────────────────

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

IOS_ICONS = [
    ("20x20@1x",    20,    "Icon-App-20x20@1x.png"),
    ("20x20@2x",    40,    "Icon-App-20x20@2x.png"),
    ("20x20@3x",    60,    "Icon-App-20x20@3x.png"),
    ("29x29@1x",    29,    "Icon-App-29x29@1x.png"),
    ("29x29@2x",    58,    "Icon-App-29x29@2x.png"),
    ("29x29@3x",    87,    "Icon-App-29x29@3x.png"),
    ("40x40@1x",    40,    "Icon-App-40x40@1x.png"),
    ("40x40@2x",    80,    "Icon-App-40x40@2x.png"),
    ("40x40@3x",    120,   "Icon-App-40x40@3x.png"),
    ("60x60@2x",    120,   "Icon-App-60x60@2x.png"),
    ("60x60@3x",    180,   "Icon-App-60x60@3x.png"),
    ("76x76@1x",    76,    "Icon-App-76x76@1x.png"),
    ("76x76@2x",    152,   "Icon-App-76x76@2x.png"),
    ("83.5x83.5@2x",167,   "Icon-App-83.5x83.5@2x.png"),
    ("1024x1024",   1024,  "Icon-App-1024x1024@1x.png"),
]

ANDROID_DENSITIES = [
    ("mipmap-mdpi",    48),
    ("mipmap-hdpi",    72),
    ("mipmap-xhdpi",   96),
    ("mipmap-xxhdpi",  144),
    ("mipmap-xxxhdpi", 192),
]

def main():
    # iOS icons
    ios_dir = os.path.join(BASE, "ios", "Runner", "Assets.xcassets",
                           "AppIcon.appiconset")
    print(f"Writing iOS icons → {ios_dir}")
    for _, px_size, filename in IOS_ICONS:
        icon = make_icon(px_size)
        icon.save(os.path.join(ios_dir, filename))
        print(f"  ✓ {filename}  ({px_size}×{px_size})")

    # Android icons
    android_res = os.path.join(BASE, "android", "app", "src", "main", "res")
    print(f"\nWriting Android icons → {android_res}")
    for density, px_size in ANDROID_DENSITIES:
        out_dir = os.path.join(android_res, density)
        os.makedirs(out_dir, exist_ok=True)
        # Standard launcher icon
        icon = make_icon(px_size)
        icon.save(os.path.join(out_dir, "ic_launcher.png"))
        # Round icon (Android 8+)
        rounded = make_icon_rounded(px_size)
        rounded.save(os.path.join(out_dir, "ic_launcher_round.png"))
        print(f"  ✓ {density}/ic_launcher.png  ({px_size}×{px_size})")

    # Flutter asset (hi-res for in-app use)
    asset_dir = os.path.join(BASE, "assets", "images")
    os.makedirs(asset_dir, exist_ok=True)
    logo_img  = draw_logo(1024, padding_ratio=0.0)  # full-bleed, no padding
    logo_img.save(os.path.join(asset_dir, "logo.png"))
    print(f"\n✓ assets/images/logo.png  (1024×1024, transparent BG)")

    print("\n✅  All icons generated successfully.")


if __name__ == "__main__":
    main()
