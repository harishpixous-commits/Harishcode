"""Replace every icon/favicon in the Harish Code tree, matching each original's size."""
import os
import glob
import numpy as np
from PIL import Image, ImageDraw

SRC = 'tmp/hc-src'
LOGO = 'tmp/hc-logo'
BG = (13, 13, 15)

mono = Image.open(os.path.join(LOGO, 'monogram-clean.png')).convert('RGBA')
mono_dense = Image.open(os.path.join(LOGO, 'monogram-dense.png')).convert('RGBA')
lock = Image.open(os.path.join(LOGO, 'brand-lockup.png')).convert('RGBA')

_cache = {}


def tile(size):
    """Dark rounded tile with the monogram, cached per size."""
    if size in _cache:
        return _cache[size]
    m = mono_dense if size <= 40 else mono
    ratio = 0.86 if size <= 32 else (0.84 if size <= 48 else 0.82)
    radius = 0.16 if size <= 24 else (0.19 if size <= 32 else (0.20 if size <= 48 else 0.225))

    gw = max(6, int(round(size * ratio)))
    gh = max(6, int(round(gw * m.size[1] / m.size[0])))
    if gh > size:
        gh = size
        gw = max(6, int(round(gh * m.size[0] / m.size[1])))

    ss = 8 if size <= 64 else 4
    g = m.resize((gw * ss, gh * ss), Image.LANCZOS)

    out = Image.new('RGBA', (size * ss, size * ss), (0, 0, 0, 0))
    mask = Image.new('L', (size * ss, size * ss), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size * ss - 1, size * ss - 1],
                                           radius=int(size * ss * radius), fill=255)
    out.paste(Image.new('RGBA', (size * ss, size * ss), BG + (255,)), (0, 0), mask)
    out.alpha_composite(g, ((size * ss - g.size[0]) // 2, (size * ss - g.size[1]) // 2))
    res = out.resize((size, size), Image.LANCZOS)
    _cache[size] = res
    return res


def flat(size, ss=4):
    """Full-bleed square plate (for favicons / iOS icons that expect a solid tile)."""
    canvas = Image.new('RGBA', (size * ss, size * ss), BG + (255,))
    gw = max(6, int(round(size * ss * 0.82)))
    gh = max(6, int(round(gw * mono.size[1] / mono.size[0])))
    m = mono_dense if size <= 40 else mono
    g = m.resize((gw, gh), Image.LANCZOS)
    canvas.alpha_composite(g, ((size * ss - gw) // 2, (size * ss - gh) // 2))
    return canvas.resize((size, size), Image.LANCZOS)


def write_tile(path, size):
    tile(size).save(path)


def write_flat(path, size):
    flat(size).save(path)


# ------------------------------------------------------------ resources/icons
idir = os.path.join(SRC, 'resources/icons')
changed = []

for f in sorted(glob.glob(os.path.join(idir, '*.png'))):
    name = os.path.basename(f)
    try:
        w, h = Image.open(f).size
    except Exception as e:
        print('skip', name, e)
        continue
    if w != h:
        # non-square: fit the tile to the smaller side on a transparent canvas
        t = tile(min(w, h))
        canvas = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        canvas.alpha_composite(t, ((w - t.size[0]) // 2, (h - t.size[1]) // 2))
        canvas.save(f)
    else:
        tile(w).save(f)
    changed.append('icons/' + name + ' -> ' + str(w) + 'x' + str(h))

# android
for f in sorted(glob.glob(os.path.join(idir, 'android/**/*.png'), recursive=True)):
    name = os.path.basename(f)
    w, h = Image.open(f).size
    if 'foreground' in name:
        # adaptive-icon foreground: monogram only, transparent
        ss = 4
        canvas = Image.new('RGBA', (w * ss, h * ss), (0, 0, 0, 0))
        gw = int(w * ss * 0.60)
        gh = int(gw * mono.size[1] / mono.size[0])
        g = mono.resize((gw, gh), Image.LANCZOS)
        canvas.alpha_composite(g, ((w * ss - gw) // 2, (h * ss - gh) // 2))
        canvas.resize((w, h), Image.LANCZOS).save(f)
    elif 'round' in name:
        # circular plate
        ss = 4
        m = Image.new('L', (w * ss, h * ss), 0)
        ImageDraw.Draw(m).ellipse([0, 0, w * ss - 1, h * ss - 1], fill=255)
        base = Image.new('RGBA', (w * ss, h * ss), (0, 0, 0, 0))
        base.paste(Image.new('RGBA', (w * ss, h * ss), BG + (255,)), (0, 0), m)
        gw = int(w * ss * 0.72)
        gh = int(gw * mono.size[1] / mono.size[0])
        g = mono.resize((gw, gh), Image.LANCZOS)
        base.alpha_composite(g, ((w * ss - gw) // 2, (h * ss - gh) // 2))
        base.resize((w, h), Image.LANCZOS).save(f)
    else:
        tile(w).save(f)
    changed.append('android/' + name + ' ' + str(w) + 'x' + str(h))

# ios: iOS icons are square plates, no rounding baked in
for f in sorted(glob.glob(os.path.join(idir, 'ios/*.png'))):
    w, h = Image.open(f).size
    flat(w).save(f)
    changed.append('ios/' + os.path.basename(f) + ' ' + str(w) + 'x' + str(h))

# icon.ico must keep its multi-resolution structure
ico = os.path.join(idir, 'icon.ico')
sizes = sorted(Image.open(ico).info.get('sizes', []))
if sizes:
    big = tile(256)
    big.save(ico, format='ICO', sizes=sizes)
    changed.append('icon.ico sizes=' + str(sizes))
print('icons dir updated:', len(changed), 'files')

# dock.png
dock = os.path.join(idir, 'dock.png')
if os.path.exists(dock):
    w, h = Image.open(dock).size
    t = tile(min(w, h))
    c = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    c.alpha_composite(t, ((w - t.size[0]) // 2, (h - t.size[1]) // 2))
    c.save(dock)

# ------------------------------------------------------------------ renderer
rdir = os.path.join(SRC, 'out/renderer')
r_changed = []

for f in sorted(glob.glob(os.path.join(rdir, '*.png'))):
    name = os.path.basename(f)
    w, h = Image.open(f).size
    if 'social-share' in name:
        # wide social card: lockup centred on the brand background
        card = Image.new('RGBA', (w, h), BG + (255,))
        lw = int(w * 0.70)
        lh = int(lw * lock.size[1] / lock.size[0])
        L = lock.resize((lw, lh), Image.LANCZOS)
        card.alpha_composite(L, ((w - lw) // 2, (h - lh) // 2))
        card.convert('RGB').save(f)
    else:
        flat(w).save(f)
    r_changed.append(name + ' ' + str(w) + 'x' + str(h))

# favicons .ico
for f in sorted(glob.glob(os.path.join(rdir, '*.ico'))):
    sizes = sorted(Image.open(f).info.get('sizes', []))
    if not sizes:
        sizes = [(16, 16), (32, 32), (48, 48)]
    tile(256).save(f, format='ICO', sizes=sizes)
    r_changed.append(os.path.basename(f) + ' ico ' + str(sizes))

# favicon svg: keep the file an .svg, embed the artwork
import base64
tile_png = os.path.join(LOGO, '_fav.png')
tile(256).save(tile_png)
with open(tile_png, 'rb') as fh:
    b64 = base64.b64encode(fh.read()).decode()

SVG = ('<svg xmlns="http://www.w3.org/2000/svg" version="1.1" '
       'xmlns:xlink="http://www.w3.org/1999/xlink" width="512" height="512">'
       '<image href="data:image/png;base64,' + b64 + '" x="0" y="0" width="512" height="512"/>'
       '</svg>')
for n in ['favicon.svg', 'favicon-v3.svg']:
    with open(os.path.join(rdir, n), 'w', encoding='utf-8') as fh:
        fh.write(SVG)
    r_changed.append(n)

print('renderer updated:', len(r_changed), 'files')
for x in r_changed:
    print('   ', x)

# ICNS for mac: leave as-is (not used on Windows), but keep a note
print('\nnote: icon.icns left untouched (macOS-only asset)')
