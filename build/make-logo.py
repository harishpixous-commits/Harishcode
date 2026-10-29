"""Build the Harish Code icon set from the supplied logo art."""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = 'C:/Users/haris/AppData/Local/Temp/freebuff-desktop-pastes/paste-1793134773883-1248.png'
OUT = 'tmp/hc-logo'
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- 1. monogram
src = Image.open(SRC).convert('RGB')
arr = np.asarray(src).astype(np.float32)

# monogram occupies (344,297)-(935,787); a little padding keeps the glow
x0, y0, x1, y1 = 330, 285, 950, 800
crop = arr[y0:y1, x0:x1]

# The art is light-on-black, i.e. premultiplied. Unpremultiply to recover RGBA.
alpha = crop.max(axis=2)                       # luminance == coverage
a = np.clip(alpha / 255.0, 0, 1)
with np.errstate(divide='ignore', invalid='ignore'):
    rgb = np.where(a[..., None] > 1e-6, crop / np.maximum(a[..., None], 1e-6), 255.0)
rgb = np.clip(rgb, 0, 255)

# Hard-clean the far corners so no residual background survives.
rgba = np.dstack([rgb, alpha]).astype(np.uint8)
mono_full = Image.fromarray(rgba, 'RGBA')

# tighten to the true alpha bounds
bbox = mono_full.getchannel('A').point(lambda v: 255 if v > 14 else 0).getbbox()
mono = mono_full.crop(bbox)
print('monogram trimmed to', mono.size)

# A denser version for tiny sizes: pulls the faint glow up so 16px stays readable.
ma = np.asarray(mono).astype(np.float32)
dense_a = np.clip((ma[..., 3] / 255.0) ** 0.72 * 255, 0, 255)
dense = np.dstack([ma[..., :3], dense_a]).astype(np.uint8)
mono_dense = Image.fromarray(dense, 'RGBA')

mono.save(os.path.join(OUT, 'monogram.png'))
mono_dense.save(os.path.join(OUT, 'monogram-dense.png'))

# ------------------------------------------------------------------- 2. tiles
BG = (13, 13, 15)


def rounded_mask(size, radius_ratio=0.225, ss=4):
    s = size * ss
    m = Image.new('L', (s, s), 0)
    d = ImageDraw.Draw(m)
    r = int(s * radius_ratio)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=r, fill=255)
    return m.resize((size, size), Image.LANCZOS)


def make_tile(size, glyph_ratio=0.80):
    """Dark rounded tile with the monogram centred."""
    m = mono_dense if size <= 40 else mono
    # 4x supersample the glyph for crisp small sizes
    gw = max(8, int(size * glyph_ratio))
    gh = max(8, int(round(gw * m.size[1] / m.size[0])))
    g = m.resize((gw * 4, gh * 4), Image.LANCZOS)

    tile = Image.new('RGBA', (size * 4, size * 4), (0, 0, 0, 0))
    mask = rounded_mask(size, ss=4).resize((size * 4, size * 4), Image.LANCZOS)
    bg = Image.new('RGBA', (size * 4, size * 4), BG + (255,))
    tile.paste(bg, (0, 0), mask)
    tile.alpha_composite(g, ((size * 4 - g.size[0]) // 2, (size * 4 - g.size[1]) // 2))
    return tile.resize((size, size), Image.LANCZOS)


ICON_SIZES = [16, 24, 32, 48, 64, 96, 128, 180, 192, 256, 512, 1024]
tiles = {}
for s in ICON_SIZES:
    t = make_tile(s)
    tiles[s] = t
    t.save(os.path.join(OUT, 'tile-%d.png' % s))
print('built tiles:', ICON_SIZES)

# favicon: full-bleed square like the original (no rounding, the browser masks it)
fv = Image.new('RGBA', (512, 512), BG + (255,))
g = mono.resize((int(512 * 0.80), int(512 * 0.80 * mono.size[1] / mono.size[0])), Image.LANCZOS)
fv.alpha_composite(g, ((512 - g.size[0]) // 2, (512 - g.size[1]) // 2))
fv.save(os.path.join(OUT, 'favicon-512.png'))
print('done')
