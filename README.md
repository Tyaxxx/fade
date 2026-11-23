# Fade

Fade (shown in the app as **Fade Generator**) generates soft, grainy multi-colour gradient images in the browser. You pick a palette, shape the colour zones, add grain and blur, and download a full-resolution JPEG (up to 8K). Every image comes from a seed code, so the same settings always give the same pixels, and you can save and reload settings as a small JSON file.

Everything runs client-side: there is no server, and the app builds to a static site.

## Using the app

Settings are on the left, the live preview is on the right (stacked on phones).

- **Randomize** (or the `R` key) re-rolls every section that isn't locked. One undo brings the previous image back.
- **Sections.**
  - **Colours** is always open: the palette swatches (2 to 8) can be edited with a hex code or the colour picker, or replaced from the presets.
  - **Shape** covers the number of zones, their size and size variation, plus the fade curve (linear, smooth, gaussian) and softness.
  - **Texture** covers grain (None, Fine, Rough, or custom amount, size, and mono or colour) and blur.
  - **Format** sets the output size from presets (1:1, 4:5, 16:9, 9:16, phone, 4K…) or a custom width × height with a ratio lock.
  - **Seed** shows the seed code, which you can copy and paste to reproduce an image.
- **Lock and randomize per section.** Colours, Shape and Texture each have two icons in their header:
  - the **lock** keeps the section's settings and seeds when you use Randomize;
  - the **shuffle** icon re-rolls that section alone, even when it's locked.
- **Expand all / Collapse all** opens or closes every section at once.
- **Header icons:** undo (`Ctrl+Z`), redo (`Ctrl+Shift+Z` or `Ctrl+Y`; `Cmd` on Mac), import settings, export settings.
- **Download** (the round button under the preview) renders the full-size JPEG at the chosen quality in a background worker, so the preview stays responsive.

## Commands

```sh
npm install        # install dependencies
npm run dev        # start the dev server (Vite)
npm test           # run the unit and component tests (Vitest)
npm run lint       # ESLint
npm run typecheck  # TypeScript project build check
npm run build      # typecheck and build to dist/
npm run samples    # render tuning samples to out/samples/*.png (not part of npm test)
```

In PowerShell, if `npm` is blocked by the execution policy, use `npm.cmd` (e.g. `npm.cmd run dev`).

## Deploying

The app is hosted on GitHub Pages at <https://tyaxxx.github.io/fade/>. Every push to `main` triggers `.github/workflows/deploy.yml`, which runs the tests, builds and publishes `dist/`. Production builds use the `/fade/` base path (see `vite.config.ts`).

To publish local changes in one step (Windows):

```powershell
npm.cmd run deploy -- "What changed"
```

`scripts/deploy.ps1` runs the tests and build, commits all changes with that message, pushes, waits for the GitHub Pages run to finish and opens the live site. It stops without pushing if a test or the build fails.

## Project layout

- `src/core/` is the generator: pure TypeScript with no DOM or React imports, so it runs in workers, tests and Node alike. Its public interface is `src/core/index.ts` (`generate`, `normalizeParams`, palettes, seed codes, settings parsing).
- `src/app/` is the React UI.
  - `components/` holds the settings panel, its sections, the per-section lock/randomize actions and the stage.
  - `lib/` holds pure helpers (undo history, section randomize and locks, format presets, section summaries, settings file reading).
  - `render/` runs `generate` in Web Workers: one lane for the live preview, one for full-size exports, so an export never blocks the preview.
- `scripts/` holds the sample renderer used for visual tuning.

## Settings file format

Export settings writes JSON like this:

```json
{
  "app": "fade",
  "version": 1,
  "params": {
    "width": 1920,
    "height": 1080,
    "palette": ["#3a1a5e", "#d8357a", "#f5821f"],
    "zones": { "count": 6, "size": 0.5, "sizeVariation": 0.4 },
    "falloff": { "curve": "smooth", "softness": 0.7 },
    "blur": 0.25,
    "grain": { "amount": 0.2, "size": 0.8, "mode": "mono" },
    "dither": true,
    "seeds": { "layout": 1958215, "shape": 734221, "colors": 99172, "grain": 4311 }
  }
}
```

On import, missing or out-of-range values fall back to defaults or are clamped, so older and hand-edited files still load. Files over 100 KB are rejected without being read.

## Rendering pipeline

`generate(params, { scale })` in `src/core/generate.ts` turns parameters into RGBA bytes. It is deterministic: identical parameters give identical bytes. The preview uses a smaller `scale`; the export renders at full size.

**Normalize.** `normalizeParams` clamps every value to its limits and fills in defaults, so the rest of the pipeline can trust its input.

**Zone layout.** `layoutZones` places the colour zones (centre, radius, colour) using four independent seeded random streams: layout, shape, colours and grain. Per-zone values are hashed from their stream rather than drawn in sequence, so adding a zone doesn't move the existing ones. In the UI, each section's randomize re-rolls its own streams along with its settings: Colours re-rolls `colors`, Shape re-rolls `layout` and `shape`, Texture re-rolls `grain`. Locking a section keeps both, so you can, for example, keep the layout and try new colours. `layoutZones` returns a plain list of zones that `renderField` consumes, which is the seam for future animation (moving zones over time).

**Colour field.** `renderField` paints a low-resolution field (long edge at most 768 px) in the OKLab colour space, where blends between colours look even and don't go muddy. Coordinates are domain-warped with smooth noise so zone edges are organic, and each pixel blends the zones with soft weights set by the falloff curve and softness.

**Blur.** A box blur on the small field softens it further. Because it runs at low resolution, it is cheap at any output size.

**Upsample and convert.** The field is upsampled to the output size with bicubic interpolation, one row at a time, and converted from OKLab to sRGB.

**Grain.** Grain is added per pixel. Fine grain is per-pixel noise; larger grain sizes give clumped noise, with a little low-frequency mottle so it reads like film rather than digital noise. Mono grain changes brightness only; colour grain varies each channel.

**Dither and quantise.** Finally each channel is rounded to 8 bits. Before rounding, Fade adds dither: TPDF (triangular) noise of up to ±1 LSB per channel, with a mean of zero. This is smaller than one 8-bit step, so you can't see it at normal viewing, and any grain masks it completely. What it prevents is banding: without it, smooth grain-free gradients, especially dark ones, show visible steps or contour lines where many neighbouring pixels round to the same value. Dither is on by default and has no switch in the UI. To turn it off, set `"dither": false` in the `params` of a settings file and import it, or pass `dither: false` when calling `generate`. The setting is kept when you export settings again.
