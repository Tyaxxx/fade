# Plan: Fade UI/UX redesign, review fixes, dither docs

Architecture reference: `.claude/plans/fade-generator.md` (generator in `src/core/`, app in `src/app/`, renderer workers in `src/app/render/`). This plan changes only what is listed here.

## 1. Goal

Fix the five review findings (R1–R5), take the dither switch out of the UI but keep dithering in the generator and document it, and redesign the frontend so it looks sleek, quiet and modern and is easy to use. The settings panel stays on the left and the picture on the right. The history thumbnail strip goes away (undo/redo icon buttons stay). The OS scrollbars are replaced by thin, subtle ones. Advanced controls sit behind collapsible sections. Every existing feature keeps working. No new dependencies.

### Acceptance criteria

Fixes
- [ ] R1: Every picker edit made while a swatch popover is open becomes exactly one undo step when the popover closes, however it closes (pointer released inside or outside, keyboard edit then Escape, outside pointerdown, trigger toggle). One Ctrl+Z after a picker edit restores the previous colour and does not also undo an earlier change.
- [ ] R2: If a worker errors (`onerror` / `onmessageerror`), the in-flight job settles with an error (the export promise rejects with a readable message), the lane resets `busy`, starts a fresh worker and keeps processing the queue. The Download button comes back and shows the error.
- [ ] R3: A failed preview render shows a short, unobtrusive message in the stage bar (`role="status"`). It clears on the next successful frame.
- [ ] R4: The `Segmented` control follows the WAI-ARIA radio group pattern: one tab stop (roving `tabIndex`), Arrow Left/Up and Right/Down move and select with wrap-around, Home/End jump to the ends.
- [ ] R5: Importing a settings file over 100 KB is rejected without being read, with the message "This file is too large to be a Fade settings file (over 100 KB)."

Dither
- [ ] No dither control anywhere in the UI.
- [ ] `FadeParams.dither` stays in core with default `true`. `normalizeParams`, `serializeSettings` and `parseSettings` behave exactly as before, so JSON with `"dither": false` still turns it off and old files still import. Generator output bytes are unchanged.
- [ ] TSDoc on `FadeParams.dither` and in `src/core/dither.ts`, plus a root `README.md` with a "Rendering pipeline" section that explains dithering.

Redesign (the reviewer checks these with `web-design-guidelines`, `design:design-critique` and `design:accessibility-review`)
- [ ] The design follows the tokens and principles in section 3.4: one typeface, two text sizes, ink hierarchy through opacity, flat neutral ground, image as the only saturated element.
- [ ] By default only the Randomize action, Colours and the collapsed section headers (each showing a one-line summary) are visible in the panel. On a 1440×900 viewport the panel does not scroll in its default state.
- [ ] No default OS scrollbar shows anywhere (panel, page on mobile, popovers). Scroll areas stay scrollable by wheel, touch and keyboard, and the scrollbar becomes visible (thin, low contrast) on hover or focus inside.
- [ ] No history strip. Undo/redo are icon buttons with accessible names, `aria-keyshortcuts` and a tooltip ("Undo (Ctrl+Z)"), and they are disabled when unavailable. Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y still work.
- [ ] Stage states: before the first frame, a neutral placeholder at the image's aspect ratio. A preview error message (R3). During export, the Download button reads "Rendering…" with a spinner, is `aria-busy`, and the preview stays live. Export error shown inline (`role="alert"`).
- [ ] Every control has a visible or accessible label. Text contrast is ≥ 4.5:1 and UI component contrast (slider track/thumb, swatch outlines, focus ring) is ≥ 3:1. Pointer targets are ≥ 24×24 px (≥ 40 px for primary actions at phone width).
- [ ] Focus rings are visible but light (section 3.4), shown on `:focus-visible` only.
- [ ] `prefers-reduced-motion: reduce` turns off all transitions and the placeholder pulse.
- [ ] Responsive: at 390×844 the layout stacks (header, image, stage bar, panel) with no horizontal scroll, and everything is reachable. Also checked at 1024×768 and 1440×900.
- [ ] All existing functions still work: seed randomize/locks/copy/paste code, palette presets/hex/picker/add/remove/random palette, zones, falloff curve + softness, grain None/Fine/Rough + amount/size/type, blur, format presets + custom W×H + ratio lock + aspect label, JPEG quality + download, JSON export/import, undo/redo.
- [ ] `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` pass.

## 2. Context

- Stack: React 19, Vite 8, TypeScript 6 strict, Vitest 5 (+ jsdom, Testing Library for component tests via `// @vitest-environment jsdom`), ESLint 10, plain CSS with custom properties in `src/app/styles.css` (no CSS framework). Font: `@fontsource-variable/instrument-sans` (already installed). Picker: `react-colorful`. Not a git repo, so don't commit.
- Files touched:
  - `src/app/App.tsx`: state (history reducer, locks, quality, export state), keyboard shortcuts, layout.
  - `src/app/components/controls.tsx`: `Slider`, `Segmented`, `NumberField`, `Section`.
  - `src/app/components/sections.tsx`: `SizeSection`, `ZonesSection`, `FadeSection`, `GrainSection`, `FinishSection` (the dither checkbox is at line ~143).
  - `src/app/components/ColorsSection.tsx` (Swatch + popover, R1), `SeedSection.tsx`, `FileSection.tsx` (R5), `Stage.tsx`, `HistoryStrip.tsx` (to delete).
  - `src/app/render/renderer.ts` (R2, R3, remove thumbnails), `usePreview.ts` (R3), `protocol.ts` (unchanged).
  - `src/app/App.test.tsx` (expects the old section headings and the History nav, so it must be updated).
  - `src/core/params.ts`, `src/core/dither.ts` (TSDoc only).
- Conventions: named exports, tests next to code (`*.test.ts(x)`), `src/core` never imports from app/DOM, sentence-case copy, `SectionProps { params, onChange(next, live?), onCommit }` for sections (live slider changes only enter history on `onCommit`).
- Windows: PowerShell may block `npm.ps1` (execution policy). Use `npm.cmd run …` in PowerShell, or run from the Bash tool.

## 3. Design

### 3.1 Fixes: seams

**R2/R3: renderer worker seam.** `createRenderer(spawn: () => WorkerLike = defaultSpawn)`, where `WorkerLike = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'>` and `defaultSpawn` does the current `new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module' })`. That gives two adapters (real worker, test fake), so the seam is real. Inside `createLane(spawn)`:
- `onerror` / `onmessageerror` call `fail(message)`: take the in-flight job (track `current: Job | undefined` rather than only the `waiting` map), resolve it with `{ id, ok: false, error }`, set `busy = false`, `terminate()` the old worker and `spawn()` a new one (an OOM may have killed it, and respawning is always safe), re-attach handlers, then `pump()`. Call `event.preventDefault()` on the ErrorEvent so it doesn't surface as an uncaught error.
- Error copy for export: "The export ran out of memory or crashed. Try a smaller size." (keep the worker's own `error` string when the worker replied `ok:false`, as now).

Interface change:
```ts
renderPreview(params: FadeParams, scale: number, onImage: (image: RenderedImage) => void, onError?: (message: string) => void): void;
// renderThumb is removed (no history thumbnails any more).
```
`usePreview` returns `{ ready: boolean; error: string | null }`. It sets the error on failure and clears it on the next image. `Stage` shows the error as "Preview failed. Change a setting to try again." with the detail in `title`.

**R1: one popover module.** `src/app/components/usePopover.ts`:
```ts
function usePopover(opts: { onClose?: () => void }): {
  open: boolean; toggle(): void; close(opts?: { restoreFocus?: boolean }): void;
  rootRef: RefObject<HTMLDivElement | null>; triggerRef: RefObject<HTMLButtonElement | null>;
};
```
All close paths (outside `pointerdown`, Escape, trigger toggle, explicit `close()`) go through one `close` that calls `onClose` exactly once per open→closed transition. `Swatch` passes `onClose: onCommit`. While the popover is open, also listen for document `pointerup` and call `onCommit` (the commit is idempotent in the reducer, because `commit` with no diff is a no-op). That turns each completed drag into its own step even if the popover stays open. Keyboard edits in `react-colorful` are committed on close. Drop the popover's `onPointerUp`. This hook is also the only popover used by the redesigned swatch (the hex field moves inside it), so R1 is fixed at a single point.

**R4: Segmented.** Keep `role="radiogroup"`/`role="radio"`. Use roving `tabIndex` (checked option is 0, others -1; if none is checked, the first is 0), an `onKeyDown` on the group for Arrow keys/Home/End that calls `onChange` and moves focus to the new option (refs array). `value` may be `T | null` (needed for the grain preset row, see 3.3).

**R5: settings file.** Add `MAX_SETTINGS_BYTES = 100_000` and `readSettingsFile(file: Blob): Promise<ParseResult>` in `src/app/lib/settingsFile.ts`. It checks `file.size` before `file.text()` and otherwise delegates to `parseSettings`. `FileSection` calls it.

### 3.2 Dither

No behaviour change in core. Remove the checkbox (and `FinishSection`, see 3.3). TSDoc on `FadeParams.dither`: "Adds triangular-PDF noise of ±1 LSB per channel before 8-bit rounding, which breaks up banding in smooth, grain-free gradients. Invisible at normal viewing, and mostly redundant when grain > 0. Default true. Not exposed in the UI. Set `"dither": false` in a settings file (or params) to turn it off." Expand the comment in `src/core/dither.ts` the same way (it documents the inlined TPDF step in `generate.ts`'s `shadeRow`; reference that function). Imported files keep their `dither` value and it round-trips through export, so there is no UI indicator (ASSUMED).

### 3.3 Information architecture (progressive disclosure)

The panel reads like an index list: each row is a section title on the left and its current value on the right. That is the cargo cue (see 3.4). Clicking a row expands it.

```
┌ panel 320px ───────────────────────┬ stage (flat, same ground) ─────────────────┐
│ Fade                     [↶] [↷]   │                                             │
│                                    │                                             │
│ [ Randomize               R ]      │        ┌─────────────────────────┐         │
│   2 streams kept                   │        │                         │         │
│                                    │        │   image, no mat, flat   │         │
│ Colours                  Spectrum  │        │                         │         │
│ (●)(●)(●)(●)(●) (+)   [shuffle]    │        └─────────────────────────┘         │
│ ▭▭▭▭  ▭▭▭▭   (preset strips, 4/row)│                                             │
│ ────────────────────────────────── │ Landscape  1920 × 1080 px  16:9             │
│ Shape                     6 zones ⌄│            JPEG 92 [──●─]  [Download JPEG]  │
│ Texture                Fine grain ⌄│                                             │
│ Format                       16:9 ⌄│                                             │
│ Seed            3k9f-0a1b-zz12-… ⌄│                                             │
│                                    │                                             │
│ Export settings · Import settings  │  (footer: two text buttons, no middot char) │
└────────────────────────────────────┴─────────────────────────────────────────────┘
```

- **Header**: wordmark "Fade" (body size, weight 600, like a cargo home link) and undo/redo icon buttons.
- **Randomize**: the primary creative action, a full-width button with `<kbd>R</kbd>`. When locks are active, a muted line underneath reads "Layout and grain kept" (built from the locked stream names), so users understand why some parts don't change while the lock toggles sit in the collapsed Seed section.
- **Colours** (always open): swatches are 28 px circles with a 1 px inner outline (`inset 0 0 0 1px rgba(0,0,0,.12)`) so light colours read. Click opens a popover holding the `HexColorPicker`, the hex field and "Remove colour". The hex inputs no longer clutter the panel. Then an add tile (+, disabled at 8) and a "Random palette" icon button with a visible tooltip and accessible name. Presets are a 4-column grid of 20 px gradient strips. The name goes in `aria-label`/`title`, the active one gets a 1.5 px ink outline, and its name shows as the section's summary ("Custom" otherwise).
- **Shape** (collapsed, summary "6 zones"): Count, Size, Size variation, Falloff (Segmented), Softness.
- **Texture** (collapsed, summary "No grain" / "Fine grain" / "Rough grain" / "Custom grain"): Grain Segmented None/Fine/Rough (value is the matching preset or `null`), Amount, Size, Type (Mono/Colour), Blur. This replaces `GrainSection` + `FinishSection`.
- **Format** (collapsed, summary aspect label): preset select, W × H fields with the ratio lock. The stage bar repeats the preset name, px size and ratio as a read-only readout.
- **Seed** (collapsed, summary seed code, truncated with ellipsis): lock toggles ("Keep when randomizing"), seed code field, "Copy seed".
- **Footer**: "Export settings" and "Import settings" as quiet text buttons, plus the status/error note.
- Collapsed/expanded state lives in each section's local state (not persisted, ASSUMED). Default: all collapsible sections closed.

**History decision**: no strip and no popover. Undo/redo icon buttons with shortcuts cover the real need, which is stepping back after an experiment. The user said history doesn't need to be shown. Thumbnails also cost worker time that competed with the live preview, and a popover would bring back the same visual noise for a rarely used feature. Removing them deletes `HistoryStrip.tsx`, `renderThumb`, the thumb cache, `imageToDataUrl` and the `thumbQueue`, which makes the renderer simpler. Keep the reducer's `jumpTo` action and its tests (unused but harmless, and cheap to bring back a popover later), ASSUMED.

### 3.4 Visual direction

**Cargo community research** (fetched `cargo.site/community`, then pulled the raw HTML/CSS of monicamueller.ch, matthewvla.ch, kasperquaink.nl, formatspace.org, felixdelandre.com, giuliazanzarella.com, vukdragojevic.com, tamszeyy.com). Concrete cues found:
1. **One text size does almost everything.** Body and navigation are about 1.1–1.2 rem on nearly every site. Hierarchy comes from position and weight, not a scale of sizes. Only one large display size (4–5 rem) is used, rarely.
2. **Tight leading and slight negative tracking**: line-height 1.1–1.2, letter-spacing -0.01em (monicamueller.ch on a Swiss grotesk, Suisse Intl).
3. **Ink hierarchy by opacity**: text colours are `rgba(0,0,0,.85)`, `.75`, `.4` (and the reverse on dark, `#e8e8e8` / `rgba(255,255,255,.85)` / `#8a8a8a`) rather than many named greys.
4. **Flat neutral grounds**: `#e5e5e5`, `#b2b2b2`, `#000`. No shadows, no cards, no gradients in the chrome. The work is the only colour.
5. **Text as control**: navigation and filters are plain words ("All, Editorial, Identity", "about", "Menu", "Filter"). Toggles are typographic (a "+/–" expander, "Top ↑"). Links are undecorated (`text-decoration: none`) and selected state is shown by full versus faded ink.
6. **Index lists**: project lists are single columns of "title … category/year" rows separated by 1 px `currentColor` rules.
7. **Motion is opacity only**, 100–222 ms ease-in-out. Nothing slides.
8. **Scrollbars hidden**: Cargo's fixed scroll panes use `scrollbar-width: none` / `::-webkit-scrollbar { display: none }`. We take the idea but keep a thin bar on hover/focus for accessibility.

**Concept: "the index and the image".** The panel is a quiet typographic index of settings on the same flat ground as the stage. There's no panel colour change, and only one hairline divides them. The generated image is the single bold, saturated element, placed flat with generous space around it like a work on a portfolio page. The earlier mid-grey stage with a white mat is dropped: it read as "tool chrome". A light neutral ground still avoids colour bias.

Tokens (replace the `:root` block in `styles.css`):
| Token | Value | Use |
|---|---|---|
| `--ground` | `#e4e4e4` | page, panel and stage (one flat ground) |
| `--ink` | `rgba(0,0,0,.88)` | primary text, icons, selected state |
| `--ink-2` | `rgba(0,0,0,.6)` | labels, summaries, values (≈5.3:1 on ground) |
| `--ink-3` | `rgba(0,0,0,.32)` | disabled and decorative only (never body text) |
| `--rule` | `rgba(0,0,0,.12)` | hairlines, swatch outline, slider track |
| `--fill` | `rgba(0,0,0,.06)` | hover fills, placeholder, input background |
| `--surface` | `#f4f4f4` | popover and input surface |
| `--primary` / `--on-primary` | `#000` / `#fff` | Randomize and Download (the only filled buttons) |
| `--focus` | `#5b8cff` | focus ring: 2 px, offset 2 px, `:focus-visible` only |
| `--danger` | `#b3261e` | error text (≥ 4.5:1 on ground) |
| radii | 999 px (buttons, swatches, slider thumb) / 6 px (popover, inputs) / 2 px (image) | radius signals the kind of element |

Type: Instrument Sans Variable only (already bundled, a clean grotesk close to the Suisse-style faces in the research, so no new font dependency). Two sizes: **14 px** for everything (labels, values, buttons, headings at weight 560) and **12 px** for meta (stage readout secondary, notes, kbd). Line-height 1.25 in the panel, letter-spacing -0.01em, `font-variant-numeric: tabular-nums` on values and dimensions. Sentence case, no all caps, no eyebrows, no middot separators, no arrows appended to buttons.

Controls:
- **Section row**: a full-width `<button aria-expanded aria-controls>` with the title (ink, 560) on the left, the summary (ink-2) right-aligned, and a 12 px chevron that rotates 180° (150 ms). Rows are 40 px tall, separated by a `--rule` hairline. The body uses the `hidden` attribute when collapsed (no height animation).
- **Slider**: label on the left and value on the right on one line, then a 2 px `--rule` track with the filled part in `--ink` (via `background: linear-gradient` driven by a `--pct` custom property set inline) and a 14 px `--ink` circle thumb (24 px hit area through a transparent border/`padding` on the input height). Webkit and Firefox thumb/track pseudo-elements are both styled. Keep the native `<input type="range">` for accessibility.
- **Segmented**: text options inside a `--fill` pill track. The selected option sits on a `--surface` pill with ink text and the others use ink-2. 28 px tall.
- **NumberField / hex / seed inputs**: `--fill` background, no border, 6 px radius, ink text, a `--rule` inset outline on hover, and the focus ring on focus.
- **Buttons**: primary is filled black, 999 px radius, 36 px tall (40 px at phone width). Quiet buttons are text-only in ink-2 that turns ink on hover. Icon buttons are 32 px circles with a `--fill` background on hover.
- **Popover** (swatch): `--surface`, 6 px radius, `0 8px 24px rgba(0,0,0,.12)` (the only shadow in the UI, because it floats). Opacity fades in over 120 ms. Positioned below the swatch and clamped inside the panel.
- **Tooltips**: native `title` plus `aria-label`/`aria-keyshortcuts` (no tooltip library).
- **Icons**: hand-drawn inline SVGs in `src/app/components/icons.tsx` (undo, redo, plus, shuffle, lock, unlock, chevron, close, link). 1.5 px stroke and `currentColor`. They replace the inline SVGs scattered in components.

Scrollbars (global, in `styles.css`):
```css
.scroll { overflow-y: auto; scrollbar-width: thin; scrollbar-color: transparent transparent; scrollbar-gutter: stable; }
.scroll:hover, .scroll:focus-within { scrollbar-color: rgba(0,0,0,.28) transparent; }
.scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.scroll::-webkit-scrollbar-track { background: transparent; }
.scroll::-webkit-scrollbar-thumb { background: transparent; border-radius: 999px; border: 2px solid transparent; background-clip: padding-box; }
.scroll:hover::-webkit-scrollbar-thumb, .scroll:focus-within::-webkit-scrollbar-thumb { background-color: rgba(0,0,0,.28); }
html { scrollbar-width: thin; scrollbar-color: rgba(0,0,0,.28) transparent; } /* page scroll on mobile */
```
Apply `.scroll` to the panel. The progressive-disclosure layout means it rarely needs to scroll anyway. The panel is not made focusable itself (its contents are), so keyboard scrolling follows focus.

Stage:
- The image is centred with `padding: clamp(16px, 4vw, 56px)`, no mat, 2 px radius, no shadow.
- **Loading**: before the first frame, a `--fill` block at the exact output aspect ratio with a slow opacity pulse (1.6 s). The first frame fades in once (200 ms opacity). Live updates don't fade.
- **Stage bar** (bottom, 12/14 px): on the left the preset name or "Custom", then the px size (ink) and aspect label (ink-2). On the right "JPEG quality" as a compact 96 px slider with its value, then Download. Errors (preview: `role="status"`, export: `role="alert"`) take a line below in `--danger` at 12 px.

Motion: only opacity and the chevron rotation, 120–200 ms `ease-out`, all in response to user actions except the placeholder pulse. Under `prefers-reduced-motion: reduce`, set `transition: none` and `animation: none` globally.

Responsive (`@media (max-width: 860px)`): a single column with page scroll (no inner scroll pane). The header (wordmark + undo/redo) is sticky at the top on `--ground`, then the stage with the image limited to `max-height: 60svh`, then the stage bar (wraps, Download full width at 40 px), then the panel sections. Width 100%, no horizontal overflow, swatch popover clamped to the viewport.

Self-check against the generic defaults (frontend-design): this is not cream+serif, dark+acid accent, the SaaS card kit or a monospace-label tool. The one risk is broadsheet hairlines. Rules are used only between index rows, where they carry structure (one row = one section), never as decoration, and corners are not uniformly zero (pills and circles for controls). The bold element is the image alone.

### 3.5 Component API (composition)

- `Section` keeps a plain static variant (used by Colours). Add an explicit `CollapsibleSection({ title, summary, children })` variant in `controls.tsx` (rather than a `collapsible` boolean on `Section`, per `patterns-explicit-variants`). Each instance owns its open state.
- `SettingsPanel` (new, `components/SettingsPanel.tsx`) composes header, Randomize, `ColorsSection`, `ShapeSection`, `TextureSection`, `FormatSection`, `SeedSection`, `FileActions`. `App` passes `section` props, locks and actions, and owns no layout detail beyond `<SettingsPanel/>` + `<Stage/>`.
- Rename/regroup in `sections.tsx`: `ZonesSection` + `FadeSection` become `ShapeSection`, `GrainSection` + `FinishSection` become `TextureSection`, and `SizeSection` becomes `FormatSection`. Summaries are computed from params by small pure functions exported from `src/app/lib/summaries.ts` (`shapeSummary`, `textureSummary`, `paletteName`), which are unit-tested.
- `SeedSection` loses the Randomize button (moved to the panel top, `RandomizeButton` in `SeedSection.tsx` or `SettingsPanel.tsx`, with the "kept" hint).
- `FileSection` becomes `FileActions` (footer, no `Section` wrapper). `downloadBlob` stays exported from it.

## 4. Steps

Each step ends with `npm test` green. Steps 1–6 can each be verified on their own. Use red→green for every step that has a test.

1. **R2 + R3 renderer.** `renderer.ts`: `createRenderer(spawn = defaultSpawn)`, `WorkerLike`, `current` job tracking, `fail()` (resolve with error, `busy=false`, respawn, pump), `preventDefault` on ErrorEvent, `onError` argument to `renderPreview`, remove `renderThumb`/thumb queue/`imageToDataUrl`/`THUMB_*`. `usePreview.ts` returns `{ ready, error }`. New `src/app/render/renderer.test.ts` (jsdom) with a fake worker (see Tests). Since `renderThumb` is gone, delete `HistoryStrip.tsx` and its usage in `App.tsx` in this step (step 9 finishes the header).
2. **R4 Segmented.** `controls.tsx`: roving tabindex + keyboard handling, `value: T | null`. New `src/app/components/controls.test.tsx`.
3. **R1 popover.** New `src/app/components/usePopover.ts`. Refactor `Swatch` in `ColorsSection.tsx` to use it (`onClose: onCommit`, document `pointerup` commit while open, remove the popover's `onPointerUp`). Test in `ColorsSection.test.tsx` through the App history (see Tests).
4. **R5 import size.** New `src/app/lib/settingsFile.ts` (`MAX_SETTINGS_BYTES`, `readSettingsFile`) + `settingsFile.test.ts`. Use it in `FileSection.tsx`.
5. **Dither.** Remove the checkbox from `sections.tsx` (blur stays where it is until step 10). Add TSDoc to `src/core/params.ts` (`dither` field) and `src/core/dither.ts`. No logic change. Existing core tests must stay green.
6. **README.** Create `README.md` at the root: what Fade is (one paragraph). Commands (`npm install`, `npm run dev`, `test`, `lint`, `typecheck`, `build`, `samples`) with the note "In PowerShell, if `npm` is blocked by the execution policy, use `npm.cmd` (e.g. `npm.cmd run dev`)". Project layout (`src/core` is the pure, DOM-free generator, which is the public interface in `src/core/index.ts`; `src/app` holds React UI, `lib` pure helpers and `render` workers). Settings JSON format (`{"app":"fade","version":1,"params":{…}}`). **Rendering pipeline**: one short paragraph per stage (normalize params → zone layout from seeded streams → colour field in OKLab at ≤ 1024 px with domain warp and falloff/softness weighting → box blur → bicubic upsample to output and OKLab→sRGB → grain (fine vs clumped + mottle) → dither + 8-bit quantise). Dithering paragraph: TPDF noise of ±1 LSB per channel before rounding, why it's invisible (smaller than one 8-bit step and masked by any grain), what it prevents (visible banding/contouring in smooth, grain-free gradients, especially dark ones), and how to turn it off (`"dither": false` in the settings JSON params, or `dither: false` when calling `generate`; default on, no UI switch). Use `engineering:documentation`-style plain prose. Keep it under ~120 lines.
7. **Tokens and base CSS.** Rewrite `src/app/styles.css`: new `:root` tokens, base type, `:focus-visible`, `.scroll` scrollbar rules, `html` scrollbar, reduced-motion block, `.sr-only`. Delete styles for removed elements (history, thumbs, mat, checkbox). Keep selector specificity flat (single-class selectors, state through attributes such as `[aria-pressed='true']`, `[aria-expanded='true']`), so section/control rules don't fight.
8. **Icons and controls.** New `src/app/components/icons.tsx`. Restyle `Slider` (set `--pct` inline), `Segmented`, `NumberField`. Add `CollapsibleSection`. Replace the inline SVGs in components with icons.
9. **Panel restructure.** New `src/app/lib/summaries.ts` + `summaries.test.ts`. `sections.tsx`: `ShapeSection`, `TextureSection` (grain preset Segmented with `null` for custom, amount, size, type, blur), `FormatSection`. New `SettingsPanel.tsx` with header (wordmark + undo/redo icon buttons with `aria-label`, `title`, `aria-keyshortcuts`, disabled states), Randomize + kept hint, sections, `FileActions` footer. Colours redesign: circle swatches, popover with picker + hex + remove, add tile, random palette icon button, preset strip grid, preset name summary. `SeedSection`: no Randomize. Slim down `App.tsx` to state + shortcuts + `<SettingsPanel/>` + `<Stage/>`.
10. **Stage.** `Stage.tsx`: remove the mat, add the placeholder at the aspect ratio, first-frame fade, preview error line (R3), stage bar layout with preset name/size/ratio, compact quality slider, Download states, export error.
11. **Responsive and motion.** The `@media (max-width: 860px)` layout (sticky header, `60svh` image, full-width Download), popover viewport clamp, reduced motion.
12. **Tests and checks.** Update `App.test.tsx` (new structure, see Tests). Run all commands. Then use the `run` skill + `anthropic-skills:built-in-browser`: check at 1440×900, 1024×768 and 390×844 with screenshots. Walk the full feature list from the acceptance criteria. Check the scrollbar on Windows Chrome/Edge (the user's platform) and Firefox if available, check keyboard-only use of the panel, export 4K, and import the exported JSON. Compare against the visual direction and remove one thing that doesn't earn its place.

## 5. Tests

Seams (extending those agreed in the previous plan): **(a)** `createRenderer` through its `spawn` seam (new, because a fake worker is the only way to test R2/R3), **(b)** components through Testing Library in jsdom (`Segmented`, App-level history behaviour for R1), **(c)** pure `src/app/lib` functions (`readSettingsFile`, summaries), **(d)** existing core and lib tests unchanged. CSS/visuals, responsiveness and scrollbars are verified in the browser (step 12), not in jsdom.

Cases:
- R2 (`renderer.test.ts`, fake `WorkerLike` that records `postMessage` and lets the test fire `onmessage`/`onerror`): `exportJpeg` rejects with a readable message when the worker fires `onerror`. After the error, a second `exportJpeg` is posted to a newly spawned worker and resolves when that worker replies (spawn called twice, old worker terminated). The same holds for `onmessageerror`.
- R3: `renderPreview` with a worker reply `{ ok:false, error }` calls `onError` with that message and not `onImage`. A preview job in flight when the worker errors also calls `onError`, and the next preview still renders.
- R4 (`controls.test.tsx`): only the checked radio has `tabIndex=0`. ArrowRight from the last option selects the first (calls `onChange`, focus moves). Home/End work. With `value=null` the first option is the tab stop.
- R1 (App-level, jsdom): open swatch 1, change the colour with `fireEvent.keyDown` (arrow keys) on the `HexColorPicker`'s `role="slider"` (react-colorful has no text input), then press Escape. One `Ctrl+Z` restores the original swatch colour. A second change via a different control is a separate undo step. Also: change, then outside `pointerdown` closes and commits. Assert through visible values (the hex field in the popover / swatch `aria-label` with the hex), not reducer internals.
- R5 (`settingsFile.test.ts`): a `Blob` of 100 001 bytes gives `{ ok:false, error }` containing "too large" (and `text()` is never needed). A valid small settings blob gives `{ ok:true }`. Invalid JSON keeps the existing message.
- Dither: existing core tests (`grain.test.ts` dither band test, `params.test.ts` dither boolean, settings round-trip) stay green unchanged. App test: no element with an accessible name matching /dither/i.
- Summaries (`summaries.test.ts`): `textureSummary` gives "No grain" for amount 0, "Fine grain" for the Fine preset values, "Rough grain" for Rough, and "Custom grain" otherwise. `shapeSummary` gives "6 zones" and "1 zone". `paletteName` gives the preset name or "Custom".
- App smoke (`App.test.tsx`, update): heading "Fade". Section buttons Colours/Shape/Texture/Format/Seed exist and Shape is `aria-expanded="false"` by default. Expanding Shape reveals the "Count" slider. No `navigation` named History. Undo/Redo buttons found by accessible name. The existing randomize/lock/undo/redo test (the Layout lock now lives inside the expanded Seed section, so expand it first) and the format preset test (expand Format) still pass.

Commands (PowerShell: `npm.cmd …`): `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, then `npm run dev` for browser verification.

## 6. Skills for the implementer

`frontend-design:frontend-design`, `vercel-react-best-practices`, `vercel-composition-patterns`, `codebase-design`, `tdd`, `run` + `anthropic-skills:built-in-browser` (step 12), `engineering:documentation` (README, step 6), `engineering:debug` if something misbehaves.

Reviewer: `web-design-guidelines`, `design:design-critique`, `design:accessibility-review`, `vercel-react-best-practices`, `tdd`.

## 7. Risks & open questions

No BLOCKING questions.

- ASSUMED: no history popover. Undo/redo buttons + shortcuts only. `jumpTo` stays in the reducer for a possible later popover.
- ASSUMED: light theme only (flat `#e4e4e4` ground). A dark theme is not requested. The tokens make it easy to add later.
- ASSUMED: keep Instrument Sans (already bundled, close to the grotesks seen on the cargo sites). No new font dependency.
- ASSUMED: collapsible section state is not persisted across reloads. All collapsible sections start closed.
- ASSUMED: an imported `"dither": false` is honoured silently, with no UI indicator, and survives export.
- ASSUMED: scrollbars are thin and transparent until hover/focus-within rather than fully hidden like Cargo's, for discoverability and accessibility. On touch devices native overlay scrollbars apply anyway.
- Risk: `react-colorful` keyboard interaction in jsdom for the R1 test. If arrow keys on its `role="slider"` don't fire `onChange` in jsdom, test R1 at the `usePopover` seam instead (`onClose` called once for each close path) plus a manual browser check.
- Risk: `scrollbar-color` on hover doesn't animate and differs a little between Chromium and Firefox. Acceptable.
- Risk: `ErrorEvent` from a module worker that fails to load (e.g. a bad URL) also triggers respawn. Cap respawns (e.g. 3 consecutive failures without a successful reply), then reject immediately with "The renderer couldn't start. Reload the page." to avoid a loop.
