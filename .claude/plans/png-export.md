# PNG export

## 1. Goal

Let users download the full-resolution image as PNG (lossless) in addition to JPEG. A compact JPEG / PNG choice sits next to the Download button in the stage bar. The quality slider only applies to JPEG. Export still runs in the export worker lane. The settings file format does not change.

Acceptance criteria
- [ ] A1 The stage bar shows a segmented radio group (accessible name "Export format") with options "JPEG" and "PNG". It defaults to JPEG and follows the existing `Segmented` ARIA radio pattern (arrow keys / Home / End, roving tabindex).
- [ ] A2 With PNG selected, the quality slider is `disabled` and dimmed, and keeps its place in the row: the width of the stage bar and the position of the Download button don't change when toggling. Its value is kept and comes back when JPEG is re-selected.
- [ ] A3 The Download button's `aria-label` and `data-tip` read "Download JPEG" / "Download PNG", and the sr-only status reads "Rendering JPEG…" / "Rendering PNG…" for the selected format.
- [ ] A4 A PNG download produces an `image/png` blob named `fade-<seed>-<W>x<H>.png`. JPEG output is unchanged: `image/jpeg` at the chosen quality, named `.jpg`.
- [ ] A5 The format is UI state only. It is not in `FadeParams` or the settings JSON (`serializeSettings` output is byte-identical to before), and older settings files import unchanged.
- [ ] A6 Export errors and worker crashes name the format ("Couldn't create the PNG at 8192 × 8192 px…"). The existing crash/respawn handling covers PNG with no new code.
- [ ] A7 At 390×844 the stage bar fits on one row (`[JPEG|PNG] Quality ──●── 92 (⤓)`) with no horizontal page scroll. Download stays a 40 px circle. At ≥ 861 px the existing layout holds.
- [ ] A8 README documents PNG export (intro, "Using the app", and a short "Export" note on encoding and size). All existing tests, lint, typecheck and build pass.

## 2. Context

- Stack: React 19 + Vite + TypeScript, Vitest (+ Testing Library, jsdom), ESLint. Commands: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` (use `npm.cmd` in PowerShell).
- Relevant files:
  - `src/app/render/protocol.ts`: `RenderRequest`/`RenderResponse` (`kind: 'jpeg'` with `quality`).
  - `src/app/render/render.worker.ts`: `generate` → `OffscreenCanvas.convertToBlob({ type: 'image/jpeg', quality })`; JPEG-specific error text.
  - `src/app/render/renderer.ts`: `Renderer.exportJpeg(params, quality)`, export lane with crash/respawn; `renderer.test.ts` uses a `FakeWorker` spawn seam.
  - `src/app/App.tsx`: `quality` state (0.92), `download()` builds the `.jpg` filename and calls `downloadBlob`.
  - `src/app/components/Stage.tsx`: stage bar (quality label/slider/output + icon Download button, status/alert messages).
  - `src/app/components/controls.tsx`: `Segmented<T>` (renders a visible `.field-label` + `.segmented` radiogroup inside `.field`).
  - `src/app/styles.css`: `.export`, `.quality`, `.range.compact`, `.quality-value`, `.download`, `.segmented`/`.segment`, phone block `@media (max-width: 860px)`.
  - `src/app/App.test.tsx` (fake `Renderer` with `exportJpeg: vi.fn`), `src/app/components/controls.test.tsx`.
- Conventions: named exports, tests next to code, `src/core` stays DOM/app-free (this feature doesn't touch it), sentence case, single-class CSS selectors with state via attributes, no new dependencies. Prior plan: `.claude/plans/ui-iteration-2.md` (icon buttons with tooltips, ≥ 40 px icon buttons at phone width, always-mounted status regions).

## 3. Design

### New module `src/app/lib/exportFormat.ts` (pure)
This is the one place that knows what "JPEG" and "PNG" mean, so the worker, App and Stage don't each switch on format strings.

```ts
export type ExportFormat = 'jpeg' | 'png';
/** What the export lane is asked to encode. Quality only exists for JPEG. */
export type ExportEncoding = { format: 'jpeg'; quality: number } | { format: 'png' };

export const EXPORT_FORMATS: readonly { value: ExportFormat; label: string }[]; // JPEG, PNG (Segmented options)
export function formatLabel(format: ExportFormat): string;          // 'JPEG' | 'PNG'
export function encodeOptions(e: ExportEncoding): ImageEncodeOptions; // { type: 'image/jpeg', quality } | { type: 'image/png' }
export function exportFilename(params: FadeParams, format: ExportFormat): string; // fade-<seed>-<W>x<H>.jpg|.png
```

`exportFilename` moves the filename logic out of `App.download` (it uses `encodeSeedCode`), so it can be unit-tested.

### Protocol + worker
- `RenderRequest` export variant: `{ id; kind: 'export'; params; encoding: ExportEncoding }`. Response: `{ id; ok: true; kind: 'export'; blob }`. Rename `'jpeg'` to `'export'`; both ends are internal, so there's no compatibility concern.
- Worker: `canvas.convertToBlob(encodeOptions(req.encoding))`. Error text: `` `Couldn't create the ${formatLabel(req.encoding.format)} at ${W} × ${H} px. Try a smaller size. (${detail})` ``. Importing `exportFormat.ts` into the worker is fine, because it's pure and only imports `src/core`.

### Renderer interface
Replace `exportJpeg(params, quality)` with `exportImage(params: FadeParams, encoding: ExportEncoding): Promise<Blob>`. It's the same lane, queue and crash handling; only the request shape changes. This is one method rather than `exportJpeg` + `exportPng`: the interface stays small, and the discriminated union makes "PNG with a quality" unrepresentable. Update the doc comment.

### App state
- New `const [format, setFormat] = useState<ExportFormat>('jpeg')`. It sits next to `quality`, as UI state only: not in history, not in settings JSON, not persisted (the app has no localStorage today).
- `download()` builds the encoding (`format === 'jpeg' ? { format, quality } : { format }`), calls `renderer.exportImage`, and names the file with `exportFilename(params, format)`. The format is captured at click time, so toggling during an export doesn't affect the running job. The toggle stays enabled while exporting.

### Stage
- New props `format: ExportFormat; onFormat: (f: ExportFormat) => void` (alongside `quality`/`onQuality`).
- Export row order: `[Segmented JPEG|PNG] [label "Quality"] [slider] [value] [Download]`.
  - The visible slider label becomes "Quality" (saves width at 390 px; the format is visible right next to it). Keep the accessible name "JPEG quality" with `<label htmlFor="jpeg-quality"><span className="sr-only">JPEG </span>Quality</label>`; keep the input id.
  - PNG: the `<input type="range">` gets `disabled`. The label and `<output>` stay rendered (no layout jump) and get the dimmed style through an attribute on a wrapper: `<div className="quality-group" data-disabled={format === 'png' || undefined}>` wraps label + slider + output. CSS: `.quality-group[data-disabled] { opacity: .4 }` (disabled controls are exempt from contrast rules; it's still legible). The Download button's tooltip/name carries the format. No extra "lossless" text: it isn't needed and saves width.
  - Why disable rather than hide: `visibility: hidden` would leave an unexplained gap; disabled shows the setting exists but doesn't apply. `display: none` would make the row jump.
- Download `aria-label`/`data-tip`: `` `Download ${formatLabel(format)}` ``; status: `` `Rendering ${formatLabel(format)}…` ``. Track the format actually being rendered: if the user toggles mid-export, the status should still name the format in progress. Do this by keeping `exportingFormat: ExportFormat | null` in App instead of the `exporting: boolean` prop, or by passing both. Recommended: App replaces `exporting: boolean` with `exporting: ExportFormat | null`. Stage derives `busy = exporting !== null` and the status text from `exporting`, and the button label from `format`.

### Segmented: hidden-label support
`Segmented` always renders a visible label. Add one optional prop `hideLabel?: boolean`, which puts `className="sr-only"` on the label span, so `aria-labelledby` still names the group "Export format". The `.field` wrapper is a flex column; an absolutely positioned sr-only child takes no space, so no extra CSS is needed for the wrapper. Also add a `className` hook only if the implementer needs it for sizing; otherwise style through `.export .segmented` (descendant) or a new single class on a wrapper div in Stage, e.g. `<div className="format-choice">`, following the single-class selector convention. A single boolean prop is acceptable here (no prop sprawl). Don't build a compound component.

### Styles (`styles.css`)
- `.format-choice` (wrapper in the export row): `flex: none`. Segments keep the 28 px height (matches the panel; ≥ 24 px target, WCAG 2.5.8), with `min-width: 44px` per segment so the two pills are equal width and the row doesn't jump when the weight changes (`font-weight: 560` on the checked segment can shift text width, and a fixed min width absorbs it).
- `.quality-group { display: flex; align-items: center; gap: 10px; }`, `.quality-group[data-disabled] { opacity: .4 }`. At phone width, `.quality-group { flex: 1; min-width: 0 }` so `.range.compact { flex: 1 }` still stretches inside it.
- Check `.export` `gap: 10px`. At 390 px: 358 px content ≈ segmented ~96 + "Quality" ~50 + value 2ch + 40 px button + gaps, which leaves ~90 px of slider. If it overflows, the fallback is to hide the visible "Quality" text at ≤ 400 px (`.quality` becomes sr-only via a media query) rather than wrap.

### Data / schema
None. `FadeParams`, `settings.ts` and the settings JSON are untouched.

## 4. Steps

1. **`src/app/lib/exportFormat.ts` + `exportFormat.test.ts`** (test first). Types, `EXPORT_FORMATS`, `formatLabel`, `encodeOptions`, `exportFilename`. *Independently verifiable* with `npm test -- exportFormat`.
2. **Protocol + worker.** `protocol.ts`: the `'jpeg'` variant becomes `'export'` with `encoding: ExportEncoding`. `render.worker.ts`: use `encodeOptions`, format-aware error text.
3. **Renderer.** `renderer.ts`: `exportJpeg` → `exportImage(params, encoding)`, request `{ kind: 'export', encoding }`, accept `r.kind === 'export'`. Update `renderer.test.ts` calls and replies (`kind: 'export'`), and add a test that the posted request carries the encoding for both JPEG (with quality) and PNG (no quality). *Verifiable* with `npm test -- renderer`.
4. **Segmented `hideLabel`.** `controls.tsx` + a test in `controls.test.tsx` (the group is still named by the hidden label; the label has the `sr-only` class).
5. **App.** `format` state, `exporting: ExportFormat | null`, `download()` uses `exportImage` + `exportFilename`. Pass `format`/`onFormat` to Stage.
6. **Stage.** Format `Segmented` (`label="Export format"`, `hideLabel`, options `EXPORT_FORMATS`) in a `.format-choice` wrapper, `.quality-group` wrapper with `data-disabled`, the slider `disabled` for PNG, "Quality" label, format-aware button name/tooltip/status.
7. **CSS.** `.format-choice`, `.quality-group`, the phone-width rules (section 3).
8. **App tests.** Update the fake renderer (`exportImage`) and the existing 'Download JPEG' assertions; add the section 5 cases.
9. **README.** First paragraph: "download a full-resolution JPEG or PNG (up to 8K)". "Using the app": the Download bullet describes the JPEG/PNG choice, quality (JPEG only) and filenames. Add a short "Export" paragraph at the end of "Rendering pipeline": the full-size image is encoded in the export worker with `OffscreenCanvas.convertToBlob`; JPEG is lossy at the chosen quality; PNG is lossless, and because grain barely compresses, it is large (an 8K PNG can be ~100 MB+) and slower to encode; if the browser runs out of memory the export fails with a message and the worker restarts.
10. **Verify.** Run all commands (section 5). Then use the `run` skill + browser at 1440×900 and 390×844: toggle the format (keyboard arrows), confirm no row jump, download both formats at the default size, and check the file type/extension. Optionally export PNG at 8192×4608 to observe the time and size (note the result, but don't block on it).

## 5. Tests

Seams: `exportFormat.ts` (pure functions), `createRenderer(spawn)` with `FakeWorker` (protocol), `App` with the injected fake `Renderer` (UI + filename via a `downloadBlob` spy or `URL.createObjectURL` + anchor `download` attribute check, mirroring how existing tests observe downloads if any; otherwise spy `HTMLAnchorElement.prototype.click` and read `download`).

- A4 / `exportFormat.test.ts`: `encodeOptions({format:'jpeg',quality:0.8})` → `{type:'image/jpeg',quality:0.8}`; `encodeOptions({format:'png'})` → `{type:'image/png'}` (no `quality` key); `exportFilename(DEFAULT_PARAMS,'png')` ends with `-1920x1080.png` and starts with `fade-<encodeSeedCode(seeds)>`; `.jpg` for JPEG; `formatLabel`.
- A4/A6 / `renderer.test.ts`: `exportImage(p, {format:'png'})` posts `{kind:'export', encoding:{format:'png'}}` on the export lane and resolves with the replied blob; the JPEG case carries `quality`. Existing crash/respawn/dead tests keep passing with the new method name.
- A1 / `App.test.tsx`: a radiogroup named "Export format" with radios "JPEG" (checked) and "PNG".
- A2: clicking PNG makes the slider (`getByRole('slider')`) disabled; clicking JPEG re-enables it with the same value.
- A3: after selecting PNG, a button named "Download PNG" exists (and no "Download JPEG"); the tooltip `data-tip` matches; during export (a pending fake `exportImage` promise) the status reads "Rendering PNG…". Toggling to JPEG mid-export keeps the status "Rendering PNG…".
- A4: clicking Download with PNG calls `exportImage` with `(params, { format: 'png' })` and downloads `fade-…-1920x1080.png`; the JPEG path calls with `{ format: 'jpeg', quality: 0.92 }` and `.jpg`.
- A5: the existing settings tests stay green; no change to `settings.test.ts`. Optionally assert in App that toggling the format doesn't create an undo step (the Undo button stays disabled).
- Update the existing icon-only test list: 'Download JPEG' stays valid at the default.
- `controls.test.tsx`: `Segmented` with `hideLabel` is still found by `getByRole('radiogroup', { name })`.

Commands: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` (PowerShell: `npm.cmd …`).

## 6. Skills for the implementer

`tdd`, `vercel-react-best-practices`, `frontend-design:frontend-design`, `codebase-design`. Verify in a browser with `run` + `anthropic-skills:built-in-browser`. (Reviewer: `web-design-guidelines`, `design:accessibility-review`, `tdd`, `vercel-react-best-practices`.)

## 7. Risks & open questions

- ASSUMED: the format defaults to JPEG on every page load and is not persisted (UI state, like quality and locks). Nothing goes into the settings JSON, so files stay backward compatible.
- ASSUMED: PNG is exported as the browser encodes it (`image/png`, 8-bit RGBA, opaque), with no compression-level control (the `convertToBlob` API has none) and no metadata.
- ASSUMED: the slider is disabled (not hidden) for PNG, and its visible label is shortened to "Quality" to fit 390 px.
- ASSUMED: the renderer method is renamed `exportJpeg` → `exportImage(params, encoding)` and the protocol kind `'jpeg'` → `'export'` (internal only).
- RISK: memory and time at 8K. The RGBA buffer is ~150 MB at 8192×4608 (same as JPEG today), plus the PNG encoder's working memory; grainy output barely compresses, so files can be ~100 MB+, and encoding can take several seconds. The export lane already turns OOM/crash into "The export ran out of memory or crashed. Try a smaller size." and respawns the worker. Nothing new is needed; document it in the README.
- RISK: on some browsers `downloadBlob` revokes the object URL after 1 s. A very large PNG still downloads, because the browser has already started the navigation. If manual testing shows truncated 8K PNGs, increase the revoke delay (note it, don't pre-emptively change it).
- No BLOCKING questions.
