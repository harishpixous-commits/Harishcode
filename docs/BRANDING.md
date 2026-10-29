# Harish Code — Brand Guide

## The mark

The Harish Code monogram is an **HC** ligature cut from brushed metal on a dark
rounded plate. The `H` and the `C` interlock; a `< />` code glyph sits inside the
`C` counter.

| Variant | File | Notes |
| --- | --- | --- |
| Full monogram (plate) | `assets/logo-tile-1024.png` | Square, safe for app tiles |
| Mark, no plate edge | `assets/logo-mark-256.png` | For dark surfaces |
| Small mark | `assets/logo-mark-32.png` | Bolder glyph, tuned for 16–32 px |
| Lockup (mark + wordmark) | `assets/logo-lockup.png` | 1164×200, aspect 5.82 |
| Monochrome | `assets/monogram-mono.png` | Silver on transparent |

**Clear space** — leave at least 12% of the mark's width on every side.
Do not rotate, recolour, or place the silver-on-transparent variant on a light
background.

## Colour

The identity is intentionally monochrome so it reads on any surface.

| Token | Value | Use |
| --- | --- | --- |
| Plate | `#0d0d0d` | Rounded-square background |
| Silver low | `#9a9a9a` | Monogram shadow face |
| Silver high | `#e8e8e8` | Monogram highlight face |
| Accent (UI) | inherited | Never hard-code; use theme tokens |

## Typography

- UI: **Inter**
- Code: **IBM Plex Mono**

The wordmark uses Inter Bold at `-0.01em` tracking, all caps.

## In-app marks

Every in-app logo is **inline SVG using `currentColor`**, never a raster image.
This makes the mark follow the active theme automatically.

```svg
<svg viewBox="0 0 16 16" fill="none">
  <rect x="1" y="1" width="14" height="14" rx="3.8"
        stroke="currentColor" stroke-width="1.4" fill="none"/>
  <text x="8" y="11.4" text-anchor="middle" font-size="7.4"
        font-weight="800" fill="currentColor">HC</text>
</svg>
```

### Where the mark appears

| Surface | Implementation |
| --- | --- |
| New-session screen | `<text>` wordmark `HARISH CODE` in `var(--icon-base)` |
| Settings → Models provider avatar | HC rounded-square mark (SVG above) |
| Settings → About | `HARISH CODE` wordmark + decorative brush |
| Window / taskbar | Embedded `.ico` generated from `logo-mark-256.png` |
| Tray / installer | `logo-mark-32.png` / `logo-tile-1024.png` |

### Rules

1. The mark is always `currentColor` or one of the two silver tones — never a
   third-party brand colour.
2. Minimum rendered size is **16 px**; below that use `logo-mark-32.png`, which
   has a heavier glyph tuned for small sizes.
3. The provider avatar mark is an **outline** so it does not become a solid
   black block on light themes.
4. Decorative artwork sits at `opacity: .2` in `gray` so it never competes with
   content.
