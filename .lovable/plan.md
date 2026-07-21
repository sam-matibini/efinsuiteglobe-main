# Perfect Globe Coordinate Grid

## Goal
Replace the current logo with a mathematically precise wireframe globe — clean latitude parallels and longitude meridians rendered with true spherical projection — transparent background, then propagate to every logo/favicon asset.

## Approach

Draw the globe programmatically (not via image generation) so coordinates are geometrically exact and perfectly symmetric.

### 1. Generate master PNG with Python (Pillow, preinstalled)
- 1024×1024 fully transparent canvas, sphere radius R centered.
- **Parallels (latitude):** lines at −60°, −30°, 0°, +30°, +60°. Each is an ellipse with height `2R·cos(lat)` and vertical offset `R·sin(lat)`. Equator slightly thicker.
- **Meridians (longitude):** 12 lines every 30°. Each is an ellipse with width `2R·|cos(lon)|`, height `2R`, centered — thin near ±90°, full circle at 0°.
- **Outer silhouette:** stroked circle at exact radius R.
- Stroke color `#1e88e5` (brand blue), anti-aliased, 3–4px, equator/prime meridian slightly heavier for readability.
- Save master to `/tmp/globe-master.png`.

### 2. Fan out to all asset paths (ImageMagick resize from master)
- `src/assets/landing-logo.png`, `efinsuite-globe-logo.png`, `efinsuite-logo.png`, `brand-logo.png`, `logo.png` — 512×512
- `public/brand-logo.png` — 512×512
- `public/favicon-16x16.png`, `favicon-32x32.png`, `favicon-192x192.png`, `favicon-512x512.png`
- `public/apple-touch-icon.png` — 180×180
- `public/favicon.ico` — multi-size 16/32/48/64
- `public/favicon.png` — 32×32

### 3. No markup changes
`index.html` and every component import already point at these paths from prior work.

## Why programmatic
Image generation produced uneven meridian spacing and slightly ovalized shapes. Formula-driven rendering guarantees:
- Exact 30° angular spacing on meridians
- Correct spherical foreshortening on parallels
- Perfectly round silhouette
- Native PNG transparency (no background-removal artifacts)

## Out of scope
- No layout, sizing, or `index.html` changes
- No changes to any other visuals in the app
