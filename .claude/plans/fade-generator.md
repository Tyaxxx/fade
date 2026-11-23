# Plan: Fade, a soft-gradient image generator

## 1. Goal

A browser-only web app that generates soft, blurred, organic multi-colour "fade" images with grain, in the style of `assets/examples/*.webp`: large overlapping colour blobs with no hard edges, smooth perceptual transitions (warm/cool mixes without mud), optional strong dark zones, and fine film grain. The work splits into two parts. **Generator** (`src/core/`): a pure TypeScript module with no DOM or React dependency, built and tested first. **Frontend** (`src/app/`): a React + Vite UI with settings on the left, a live preview on the right, and a download button. No server.

### Acceptance criteria

Generator (priority):
- [ ] `generate(params, { scale })` returns `{ width, height, data: Uint8ClampedArray }` (RGBA, alpha 255), deterministic: the same params give byte-identical output.
- [ ] Output visually matches the reference style (soft organic blobs, perceptual blending, grain). The implementer checks this by rendering sample PNGs and comparing them with `assets/examples/`.
- [ ] Inputs: palette (2–8 hex colours, so the colour count is the palette length), zone count (1–16), zone size, size variation, falloff curve (linear/smooth/gaussian) plus softness, global blur, grain (amount, size, mono/colour), dithering (default on), output width/height (16–8192 px).
- [ ] Independent seed streams `layout`, `shape`, `colors`, `grain`. Changing one stream, the palette or the grain never moves zones. Raising the zone count keeps existing zones where they were.
- [ ] Rendering at reduced `scale` looks the same as the full-size render, only smaller.
- [ ] A 3840×2160 render finishes in under about 2 s in Node (perf smoke test).
- [ ] Settings serialise to versioned JSON and parse back. Invalid JSON gives a clear error and no crash.

Frontend:
- [ ] Left panel holds all settings and the right stage holds the live preview, which updates while sliders are dragged without freezing the UI. Rendering happens in a Web Worker.
- [ ] Size: format presets (1:1, 4:5, 9:16, 16:9, phone wallpaper, desktop, 4K) plus custom W×H with a ratio lock. The aspect ratio shows next to the size.
- [ ] Colours: palette presets, add/remove swatches, hex input and a small colour picker per swatch, and a "random palette" action.
- [ ] Seed: Randomize (re-rolls unlocked streams only), per-stream lock toggles, copy seed code, paste/edit seed code.
- [ ] Download JPEG at full resolution with a quality setting, rendered in a worker. 4K does not freeze the UI and a progress/busy state is shown.
- [ ] Export settings as a `.json` download and import from a `.json` upload.
- [ ] Undo/redo (buttons plus Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z) and a history strip of clickable thumbnails.
- [ ] Responsive: below ~860 px wide the panel stacks under the preview. Keyboard focus is visible and controls are labelled.

## 2. Context

- Greenfield: `d:\dev_local\fade` holds only `assets/examples/` (9 reference images). It is not a git repo, so don't commit.
- Stack: Node 26 / npm 11, TypeScript (strict), Vite, React 19, Vitest. No Python.
- Reference style observed (all 13 images in `assets/examples/`):
  - 2–6 big soft blobs that often bleed off-frame, colours meeting in wide smooth transitions. No hard edges anywhere.
  - Shapes range from round glows to strongly elongated vertical/diagonal streaks ("abstract-59…", "abstract-blurred…orange-red-blue", "blur-color-background", "photo-1679…"), so elongation must reach about 4:1.
  - Many images are dark-dominant: black or deep navy covers 40–70% of the frame with a few bright glows ("abstract-59", "abstract-blurred…", "photo-1679…"). Dark areas are just dark palette colours with large zones.
  - Others are light/pastel: a near-white or cream glow in the middle fading to sky blue / peach / coral ("couleurs…pastel", "gradient-texture", "modern-orange"). These come from low contrast, high softness and a few large zones.
  - Recurring palette families: orange/teal/cream (sunset), violet/magenta/orange/cyan/blue (spectrum), red/blue/black, rainbow on black, pastel sky.
  - Grain varies a lot. None at all ("couleurs…pastel", "gradient-texture", "modern-orange"). Fine, monochrome, per-pixel ("360_F_2177…", "abstract-blurred…orange-red-blue"). **Coarse, rough "grunge" grain** ("dark-green-mint…rough-grunge-grain…"): clumpy 2–4 px specks plus faint low-frequency mottling, mostly visible in the dark areas. Grain controls must cover all three looks (see 3.1 step 8).
- Conventions to establish (none exist): `src/core/**` must not import from `src/app/**`, `react` or DOM APIs. This is enforced by a separate `tsconfig.core.json` with `"lib": ["ES2023"]` (no `DOM`) and an ESLint `no-restricted-imports` rule. Use named exports, no barrel files except `src/core/index.ts` (the module's public interface). Tests live next to code as `*.test.ts(x)`.
- Scaffolding note: `npm create vite` will complain that the folder is not empty. Scaffold the `react-ts` template into a temp dir and copy it in, or write the few config files by hand.

## 3. Design

### 3.1 Generator module (`src/core/`): one deep module

Public interface (`src/core/index.ts`) is small on purpose:

```ts
export type FalloffCurve = 'linear' | 'smooth' | 'gaussian';
export type GrainMode = 'mono' | 'color';
export interface Seeds { layout: number; shape: number; colors: number; grain: number } // uint32 each
export interface FadeParams {
  width: number; height: number;            // output px, 16..8192
  palette: string[];                        // '#rrggbb', 2..8
  zones: { count: number; size: number; sizeVariation: number }; // count 1..16, size 0.1..1.5, var 0..1
  falloff: { curve: FalloffCurve; softness: number };           // softness 0..1
  blur: number;                             // 0..1 (fraction of short side, mapped internally)
  grain: { amount: number; size: number; mode: GrainMode };     // amount 0..1, size 0.5..6 output px (≤1 fine, ≥2.5 coarse/grunge)
  dither: boolean;
  seeds: Seeds;
}
export interface RenderedImage { width: number; height: number; data: Uint8ClampedArray }

export function generate(params: FadeParams, opts?: { scale?: number }): RenderedImage; // scale in (0,1], default 1
export function normalizeParams(input: unknown): FadeParams;      // clamps/fills defaults, never throws
export const DEFAULT_PARAMS: FadeParams;
export const LIMITS: {...};                                       // min/max per field, used by the UI
export function layoutZones(params: FadeParams): Zone[];          // animation seam, see 3.4
export const PALETTES: { id: string; name: string; colors: string[] }[];
export function randomPalette(seed: number, count: number): string[];
export function randomizeSeeds(seeds: Seeds, locks: Partial<Record<keyof Seeds, boolean>>, rng?: () => number): Seeds;
export function encodeSeedCode(seeds: Seeds): string;             // e.g. "3k9f-0a1b-zz12-8c7d" (base36)
export function decodeSeedCode(code: string): Seeds | null;
export function serializeSettings(p: FadeParams): string;         // {"app":"fade","version":1,"params":{...}}
export function parseSettings(json: string): { ok: true; params: FadeParams } | { ok: false; error: string };
```

`generate` is the deep part: everything below is internal and tested through `generate`, `layoutZones` and the settings/seed functions. Hidden pipeline, one internal file each:

1. **`rng.ts`**: `hash32(...ints)` (e.g. a murmur3 finalizer mix) and `mulberry32(seed)`. Per-zone values come from `hash32(seeds.layout, zoneIndex, k)`, **not** a sequential stream. That gives prefix stability (adding zone 6 doesn't move zones 1–5) and stream independence.
2. **`color.ts`**: hex ↔ sRGB ↔ linear ↔ **OKLab**. Blending happens in OKLab so warm/cool transitions stay clean (orange→cyan doesn't go grey-brown).
3. **`zones.ts`**: `layoutZones(params)`. Each zone gets a centre in normalised coords (x,y in roughly -0.15..1.15, so blobs can bleed off-frame like the references), radius = `size × (1 ± sizeVariation × jitter)`, an anisotropy (aspect 1..4, biased toward 1–2.5 so streaks are occasional) and a rotation (from the `shape` stream), plus a colour index. Colour assignment comes from the `colors` stream: a shuffled cycle through the palette, so every colour is used when count ≥ palette length. Coordinates are relative to the **short side**, so geometry is resolution-independent.
4. **`noise.ts`**: seeded 2D value or simplex noise with 2–3 octaves (`shape` stream). A fixed moderate domain warp makes blob edges organic. This is internal, not a user control, because warp is out of scope as a control.
5. **`field.ts`**: renders the colour field into a Float32 OKLab buffer at **field resolution** (long edge ≤ 1024, smaller if the output is smaller). For each pixel: warp the coords once (shared by all zones), then for each zone compute the elliptical normalised distance `d`, then `k = curve(d)` (linear `max(0,1-d)`, smooth `smoothstep`, gaussian `exp(-2.5 d²)`), plus a tiny floor `ε·exp(-d)` so every pixel is covered. Weights are `w = k^p`, where `p` comes from softness (softness 1 gives p≈1 for very mushy blends, softness 0 gives p≈8 for near-Voronoi, still soft). The pixel is `Σ w·lab / Σ w`.
6. **`blur.ts`**: separable box blur ×3 (approximates a gaussian) on the field buffer. Radius = `blur × shortSide × 0.1` in field px. Blurring at field res is cheap and resolution-independent.
7. **`resample.ts`**: bicubic (Catmull-Rom) upsample of the field to `width×scale × height×scale`, then OKLab to linear to sRGB float.
8. **`grain.ts`**: seeded noise from the `grain` stream, hashed on *output-space* integer coords so it is deterministic and resolution-stable. Values are roughly gaussian (sum of 2 uniforms). Mono adds the same value to R, G and B; colour uses independent values per channel. The amplitude is scaled by `amount` and is slightly stronger in midtones and shadows, matching the references where grain shows most in dark areas. **Size changes the character of the grain, not just its scale**, so one `size` control covers both looks:
   - `size ≤ 1`: a single per-pixel layer gives fine film grain.
   - `size > 1`: a clumped layer (value noise with cell = `size` px, *nearest/hard-edged* cells mixed with bilinear so specks stay crisp rather than blurry) is added to a weaker per-pixel layer (weight ~0.4) and a very faint low-frequency mottle (cell ≈ 12×size px, weight rising with size). Around size 3 this gives the rough grunge texture of the "dark-green-mint…rough-grunge-grain" reference instead of a smooth blotchy blur.
   - At `scale < 1` the grain cells are `max(1, size × scale)` render px so the preview approximates the look. The download is the source of truth.
   - Expose two named grain presets in the UI ("Fine": amount 0.25, size 0.8, mono; "Rough": amount 0.45, size 3, mono) as shortcuts that set the sliders.
9. **`dither.ts` + quantise**: when `dither` is on, add triangular-PDF noise of ±1 LSB (seeded, deterministic) before rounding to 8-bit. Write RGBA with alpha 255.
10. **`generate.ts`**: `normalizeParams`, then the pipeline above.

Why this shape: the field is low-frequency, so computing it at ≤1024 px and upsampling makes 4K/8K cost mostly O(pixels) cheap per-pixel work (resample, grain, dither) instead of zones × noise per output pixel. Preview and full res share the same field math, which gives scale consistency.

### 3.2 App-side pure modules (`src/app/lib/`)

- `formats.ts`: `FORMAT_PRESETS` (Square 2048², Portrait 4:5 1080×1350, Story 9:16 1080×1920, Landscape 16:9 1920×1080, Phone wallpaper 1290×2796, Desktop 2560×1440, 4K UHD 3840×2160) and `aspectLabel(w,h)` (gcd-reduced if both terms ≤ 32, otherwise the nearest common ratio prefixed "≈", otherwise `"1.85:1"` form), `resizeLocked(w,h,changed,value)`.
- `history.ts`: a pure reducer `{ past, present, future, draftBase }` with actions `update(params)` (live change, no entry), `commit()` (pushes `draftBase` if it differs), `set(params)` (update + commit, for discrete actions), `undo`, `redo`, `jumpTo(index)`. Capped at 40 entries. Sliders call `update` on input and `commit` on pointerup/keyup/blur. Text inputs commit on blur/Enter.

### 3.3 Rendering in workers (`src/app/render/`)

- `render.worker.ts` imports `generate`. Messages: `{ id, kind: 'image', params, scale }` replies with `{ id, image }` (buffer transferred), and `{ id, kind: 'jpeg', params, quality }` renders at scale 1, encodes with `OffscreenCanvas.convertToBlob({ type: 'image/jpeg', quality })` and replies `{ id, blob }`.
- `renderer.ts`: `createRenderer()` spawns **two** workers (preview+thumbnails, export) so a 4K export never blocks the preview. `renderPreview(params, scale)` is **latest-wins**: at most one job in flight plus one pending, stale results dropped. `renderThumb(params)` is queued, with an LRU cache keyed by `JSON.stringify(params)`. `exportJpeg(params, quality): Promise<Blob>`.
- `usePreview(params, stageSize)`: computes `scale = min(1, (stageLongEdge × dpr, capped at 1280) / outputLongEdge)`, calls `renderPreview` and draws the result to a `<canvas>` via `putImageData`. The canvas is CSS-scaled to fit with `object-fit: contain`-style sizing.

### 3.4 Animation extensibility (later, not built now)

Zone geometry lives only in `layoutZones` and the field is rendered from a `Zone[]`. A later animation feature can interpolate/drift zones over a looping phase (e.g. centre += r·(cos, sin)(2π·phase + hash)) and pass them to the same field renderer. Determinism and hashed per-zone values make loops reproducible. **Do not add a `phase` param now.**

### 3.5 UI

State lives in `App` via `useReducer(historyReducer)`, plus small `useState`s for locks, JPEG quality and busy flags. There is no global store and no new state library. Params changes during drag use `startTransition`/`useDeferredValue` only if profiling shows input lag. The worker already keeps the main thread free.

Components (`src/app/components/`): `SettingsPanel` (sections: `SizeSection`, `ColorsSection` with `Swatch`, `ZonesSection`, `FadeSection` (falloff curve segmented control plus softness), `GrainSection`, `FinishSection` (blur, dither), `SeedSection`, `FileSection` (export/import JSON)), `Stage` (preview canvas, size/ratio readout, Download button, quality), `HistoryStrip`, `Slider` (labelled range plus numeric readout, exposes `onChange`/`onCommit`), `Segmented`.

Visual direction (frontend-design pass, the implementer may refine):
- Concept: a **neutral colour-judging workspace**. The generated image is the only saturated thing on screen, so UI chrome stays achromatic and the stage sits on a mid-grey like photo/colour-grading tools, so colours are judged without bias. The bold element is the stage: the image fills it edge to edge with a thin white mat. Everything else is quiet.
- Tokens: panel `#E6E7E9`, panel ink `#1F2125`, muted ink `#6A6E75`, stage `#7D8085` (neutral 50% grey), mat `#FFFFFF`, focus ring `#2F6BFF`. One family only: **Instrument Sans** (via `@fontsource-variable/instrument-sans`, self-hosted) with `font-variant-numeric: tabular-nums` for values. Sentence-case section headings (no all-caps eyebrows), 13/15/20 px scale.
- Layout:
```
┌ panel 340px, scrolls ───┬ stage ─────────────────────────────────────┐
│ Fade      [Undo][Redo]  │                                             │
│ Size                    │      ┌───────── preview ─────────┐          │
│ Colours                 │      │                           │          │
│ Zones                   │      └───────────────────────────┘          │
│ Fade                    │  3840 × 2160 px, 16:9   Quality [Download]  │
│ Grain                   ├─────────────────────────────────────────────┤
│ Finish                  │ [thumb][thumb][thumb][current]…  history    │
│ Seed [Randomize] locks  │                                             │
│ Settings file           │                                             │
└─────────────────────────┴─────────────────────────────────────────────┘
```
- Copy: buttons "Randomize", "Download JPEG", "Export settings", "Import settings", "Copy seed". The import error reads like "This file isn't a Fade settings file (missing version)."
- Shortcuts: R randomize (when focus is not in a text input), Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z.
- Colour picker: `react-colorful` (`HexColorPicker`, ~2 KB, zero deps) in a popover per swatch, plus a hex text field validated on blur.

## 4. Steps

Generator first (steps 1–10). Each is a red→green vertical slice and can be verified independently with `npm test`.

1. **Scaffold**: `package.json` (scripts `dev`, `build` = `tsc -b && vite build`, `test` = `vitest run`, `lint` = `eslint .`, `typecheck` = `tsc -b --noEmit`), `vite.config.ts`, `tsconfig.json` (references), `tsconfig.app.json` (DOM, JSX), `tsconfig.core.json` (`src/core`, lib ES2023 only, no DOM), `eslint.config.js` (typescript-eslint, react-hooks, `no-restricted-imports` in `src/core`), `vitest.config.ts` (`environment: 'node'` default; `jsdom` via per-file `// @vitest-environment jsdom` for component tests), `index.html`, `src/main.tsx`, a placeholder `src/app/App.tsx`, and `.gitignore`. Verify: `npm run build`, `npm test` (empty pass), `npm run lint`.
2. `src/core/rng.ts` plus tests (determinism, distribution sanity in [0,1)).
3. `src/core/color.ts` plus tests (hex parse/format, sRGB↔OKLab round-trip within 1/255, known values such as white L≈1).
4. `src/core/params.ts`: `DEFAULT_PARAMS`, `LIMITS`, `normalizeParams` plus tests (clamping, bad hex dropped/fixed, palette length 2..8, integer dims).
5. `src/core/seeds.ts`: `randomizeSeeds`, `encodeSeedCode`, `decodeSeedCode` plus tests.
6. `src/core/zones.ts` (`layoutZones`) plus tests: deterministic, prefix-stable, unaffected by palette/colors/grain seeds/size in px, and colour indices cover the palette.
7. `src/core/noise.ts`, `field.ts`, `blur.ts`, `resample.ts`, then the `generate.ts` skeleton (field, resample, quantise) plus tests through `generate`.
8. `src/core/grain.ts`, `dither.ts`, wired into `generate` plus tests.
9. `src/core/palettes.ts` (6–8 presets sampled from the references, e.g. "Spectrum" violet→magenta→orange→cyan→blue, "Nightfall" navy/indigo/peach/cream/sky, "Prism" rainbow on black, "Sunset" teal/cream/orange/deep navy, "Neon night" black/blue/red/pale cyan, "Ember glow" black/amber/coral/sky, "Pastel sky" sky blue/white/peach/coral, "Golden hour" yellow/orange/cream/teal) and `randomPalette` (OKLCH: random base hue, spread hues, varied L with at least one dark and one light) plus tests. `src/core/settings.ts` (serialize/parse) plus tests. `src/core/index.ts` public exports.
10. **Visual tuning**: `scripts/samples.test.ts` run via `vitest.samples.config.ts` (`npm run samples`, excluded from `npm test`). It renders ~10 parameter sets (each preset palette, several seeds, 1600×900, plus a "Rough" grain set and a no-grain pastel set) to `out/samples/*.png` using a tiny PNG encoder built on Node's `zlib` (no deps). The implementer opens the PNGs with the Read tool, compares them with `assets/examples/` and tunes internal constants (warp strength, softness→p mapping, grain layer weights, radius/elongation range). It checks that it can get close to at least: a dark-dominant streak image, a pastel no-grain image, a sunset with rough grain, and a spectrum with fine grain. It then tunes `DEFAULT_PARAMS` until the outputs read as the same family. Add `out/` to `.gitignore`.
11. `src/app/lib/formats.ts` and `history.ts` plus tests.
12. `src/app/render/render.worker.ts`, `renderer.ts`, `usePreview.ts`. Verify manually in `npm run dev`.
13. UI components and `App.tsx` layout, `src/app/styles.css` (CSS custom properties for tokens, plain CSS, no CSS framework). Install `react-colorful` and `@fontsource-variable/instrument-sans`.
14. Wire actions: randomize with locks, random palette, copy seed (`navigator.clipboard.writeText`), seed code input, export/import JSON (Blob + `<a download>`, hidden `<input type=file accept="application/json">`), Download JPEG (busy state; filename `fade-<seedcode>-<w>x<h>.jpg`), undo/redo/shortcuts, history strip thumbnails.
15. Responsive layout, focus styles, `prefers-reduced-motion`, labels/aria. Then run `run` / browser verification: change settings, export 4K, import the JSON back, undo/redo.

## 5. Tests

Agreed seams: **(a)** the `src/core` public interface (`generate`, `layoutZones`, `normalizeParams`, seed and settings functions), **(b)** `src/app/lib` pure functions/reducer, **(c)** one jsdom smoke test of `App` with the renderer injected or faked. Worker internals and canvas are not unit-tested. They are verified in the browser.

Core cases (expected values from independent sources: literals, worked examples, properties, never a recomputation of the implementation):
- Determinism: two `generate` calls give identical bytes. A different `layout` seed gives different bytes.
- Shape/size contract: `data.length === w*h*4`, every alpha is 255, `scale: 0.25` gives `round(w/4)×round(h/4)`.
- Stream independence: `layoutZones` positions are unchanged when `colors`, `grain`, `palette`, `grain.*`, `blur`, `width/height` change. Prefix stability: zones of count 5 equal the first 5 of count 6.
- Colour fidelity: a single zone with a 2-colour palette, low softness, no grain/dither/blur. The pixel at the zone centre is within ΔE (OKLab) 0.03 of its assigned colour.
- Softness: higher softness gives a lower max neighbour-gradient / wider transition across a 2-zone line profile.
- Blur: `blur=0.5` lowers the variance of the Laplacian compared with `blur=0`.
- Grain: `amount=0` with dither off gives a smooth image (max |Δ| between adjacent pixels ≤ 2). `amount=0.5` raises high-frequency energy. `mono` gives R−G≈const per pixel compared with the no-grain render, while `color` does not. Coarse vs fine: with equal amount, `size=3` grain has higher spatial autocorrelation at lag 2 px (> 0.3) than `size=0.8` (< 0.1), so coarse grain really is clumpy and not just stronger.
- Dither: on a dark narrow-range gradient, `dither: true` gives no flat run longer than N px where `false` does (banding check), and the mean colour shift is ≤ 0.5 LSB.
- Scale consistency: a full render box-downsampled to 1/4 compared with `scale: 0.25` (grain 0, dither off) gives mean abs diff ≤ 3/255.
- Perf smoke: 3840×2160 renders in < 2000 ms in Node (generous bound, `test.timeout` 10 s).
- Seeds: encode/decode round-trip, decode of garbage gives `null`, `randomizeSeeds` keeps locked streams.
- Settings: serialise→parse round-trip equals the normalised params. Wrong `app`/`version`, non-JSON, or missing fields give `{ ok: false, error }` with a readable message. Out-of-range values are clamped (not rejected).
- `normalizeParams`: clamps every LIMIT, bad hex is dropped, palette padded to ≥ 2.

App lib: `aspectLabel(1920,1080)="16:9"`, `(1080,1350)="4:5"`, `(1290,2796)` starts with "≈", `resizeLocked` keeps the ratio. History: update without commit doesn't add an entry, commit adds one, undo/redo/jumpTo restore the exact params, redo is cleared after a new commit, cap 40.

Commands: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run samples` (visual), `npm run dev` (manual browser check).

## 6. Skills for the implementer

`tdd`, `codebase-design`, `frontend-design:frontend-design`, `vercel-react-best-practices`, `run` (plus `anthropic-skills:built-in-browser` for in-browser verification), `engineering:debug` if something misbehaves.

## 7. Risks & open questions

No BLOCKING questions.

- ASSUMED: number of colours = palette length (2–8). Changing the count adds a colour from `randomPalette` or drops the last one.
- ASSUMED: Randomize re-rolls unlocked seed streams only and never changes palette hex values. "Random palette" is a separate button. The `colors` stream controls colour→zone assignment.
- ASSUMED: dark/black areas are produced by dark palette colours (background colour is out of scope).
- ASSUMED: organic shape uses a fixed internal domain warp plus random elongation/rotation, with no user control (warp is out of scope as a control).
- ASSUMED: the field is computed at ≤ 1024 px and upsampled bicubically. Very low softness at 8K may look slightly soft, which fits the style. Revisit if tuning shows artefacts.
- ASSUMED: max output 8192×8192. Safari's canvas area limit (~16.7 MP) may make huge JPEG exports fail there. Show a clear error if `convertToBlob` throws.
- ASSUMED new deps: `react-colorful` (small picker the user asked for), `@fontsource-variable/instrument-sans` (self-hosted font), dev-only `jsdom` + `@testing-library/react` (one smoke test). Everything else is the standard Vite/React/Vitest/ESLint template.
- ASSUMED: grain at preview scale is approximated (cell size clamped to ≥ 1 render px). The download is the source of truth.
- Risk: matching the "style" is subjective. Step 10 (sample PNGs compared with references) is the mitigation; budget real time for tuning.
