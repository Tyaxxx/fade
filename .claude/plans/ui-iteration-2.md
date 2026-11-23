# Plan: Fade Generator UI iteration 2

References: `.claude/plans/fade-generator.md` (architecture), `.claude/plans/ui-redesign.md` (design system "the index and the image": tokens, type, controls, section 3.4). This plan changes only what is listed here. The folder is a git repo with no commits: don't commit.

## 1. Goal

Act on the user's feedback. Use icon buttons for import, export and download. Add a one-click "expand all / collapse all" for the settings. Rename the app to "Fade Generator". Move locking and randomizing from seed streams to sections: each look section header gets a lock toggle and a "randomize this section" button, and the big Randomize button re-rolls every unlocked section. Fix the page scrolling into empty space. Finish the unfinished items from the last review (R1, R4–R10, phone hierarchy, nit). No new dependencies.

### Acceptance criteria

Feedback
- [ ] A1 Import settings, Export settings and Download JPEG are icon-only buttons. Each has an accessible name ("Import settings", "Export settings", "Download JPEG") and a visible tooltip with the same text on hover **and** on keyboard focus (`:focus-visible`). There is no visible button text. Download stays the only filled (primary) button on the stage. While exporting it shows a spinner in place of the icon, is `disabled` + `aria-busy="true"`, and an always-mounted `role="status"` region reads "Rendering JPEG…".
- [ ] A2 One button above the section index toggles all collapsible sections (Shape, Texture, Format, Seed). It reads "Expand all" when at least one is closed (one click opens all four) and "Collapse all" when all are open (one click closes all four). Individual section toggles still work, and the label follows their combined state.
- [ ] A3 (narrowed by the user) "Fade Generator" appears ONLY as the displayed header wordmark (`h1`) at the top of the UI. "fade" stays the internal project name everywhere else: package name, `<title>`, README heading, settings-file error messages, the JSON `"app": "fade"` tag and the `fade-` download filenames are all unchanged.
- [ ] A4 The Colours, Shape and Texture headers each have a lock toggle (`aria-pressed`, accessible name "Lock colours" / "Lock shape" / "Lock texture") and a randomize button ("Randomize colours" / "Randomize shape" / "Randomize texture"), using the mapping in 3.1. Format and Seed have neither.
- [ ] A5 A section's randomize button changes only that section's fields and seed streams (see 3.1) and is one undo step. It works even when the section is locked (a lock only protects against Randomize all).
- [ ] A6 The big Randomize button and the `R` key re-roll every unlocked section in one undo step. Locked sections, Format (width, height) and `dither` never change. With all three locked nothing changes and no history entry is added. The hint under the button names the kept sections ("Colours and texture kept").
- [ ] A7 The Seed section has no lock buttons. The seed code field (paste/apply) and "Copy seed" still work.
- [ ] A8 Lock state is UI state only. The settings file format is unchanged (`serializeSettings` output for the same params is byte-identical to before), and files exported before this change import unchanged.
- [ ] A9 Desktop (1440×900, 1024×768): with every section expanded, the Seed section open, a swatch popover open and the panel scrolled to the bottom, `document.documentElement.scrollHeight === innerHeight` and `scrollWidth === innerWidth`. The page itself cannot scroll, only the panel can. Phone (390×844): the page scrolls, and its end is the end of the panel content (no empty band below it).

Review leftovers
- [ ] R1 Windows Chrome/Edge (Chromium ≥ 121) shows the thin custom scrollbar with no ▲▼ arrow buttons on the panel and on the page (phone layout). Firefox still gets the thin `scrollbar-width` bar.
- [ ] R2 (done, keep) `summaries.test.ts` asserts `textureSummary(DEFAULT_PARAMS.grain) === 'Fine grain'`.
- [ ] R3 (done, keep) the default palette shows "Bloom" as the Colours summary (`PALETTES[0]`).
- [ ] R4 Moving focus out of an open swatch popover (Tab to an element outside it) closes the popover and commits exactly once.
- [ ] R5 When the preview lane gives up (`DEAD_ERROR`), the stage shows "The preview couldn't start. Reload the page.". A lane only gives up after 3 crashes **before its first successful reply**. Once a lane has worked, crashes always respawn it.
- [ ] R6 The `role="status"` regions in SeedSection, FileActions and Stage are always in the DOM (empty when idle), so the first message is announced.
- [ ] R7 The size fields' accessible names are "Width" and "Height" (the visible labels stay "W" and "H").
- [ ] R8 The stage readout doesn't repeat the ratio when the preset name already contains it ("Landscape 16:9  1920 × 1080 px", not "… 16:9" twice). Custom sizes and presets without a ratio in their name still show it.
- [ ] R9 The window `keydown` listener in `App.tsx` is attached once (not re-bound on every params change).
- [ ] R10 `.swatch-chip` has no unused `transition`.
- [ ] P1 Phone (≤ 860 px): Randomize sits directly under the image/stage bar as the full-width primary button (40 px). Download is a 40 px icon button, not full width. The `R` kbd hint is hidden on touch (`@media (hover: none)`).
- [ ] P2 The seed input has `autoComplete="off"`.

Quality floor (reviewer: `web-design-guidelines`, `design:design-critique`, `design:accessibility-review`)
- [ ] New icon buttons are ≥ 32×32 px on desktop and ≥ 40×40 px at phone width, and the header lock/randomize buttons are ≥ 28×28 px. Icon contrast is ≥ 3:1 (unlocked lock in `--ink-2`, locked in `--ink` on a `--fill` pill). The focus ring is visible on `:focus-visible`.
- [ ] Tooltips don't clip at panel edges, and they never cause page or panel overflow (see the A9 check).
- [ ] `prefers-reduced-motion` still removes all transitions (tooltip fade included).
- [ ] `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` pass.

## 2. Context

- Stack: React 19.3, Vite 8, TS 6 strict, Vitest 5 + jsdom + Testing Library, ESLint 10 with `eslint-plugin-react-hooks` 7, plain CSS in `src/app/styles.css` (tokens in `:root`). Icons are inline SVGs in `src/app/components/icons.tsx` (16 px grid, 1.5 stroke, `currentColor`, `aria-hidden`). Windows: use `npm.cmd …` in PowerShell, or the Bash tool.
- Files involved:
  - `src/app/App.tsx`: state (history reducer, `locks: SeedLocks`, quality, export), `randomize` = `randomizeSeeds(params.seeds, locks)`, and a keydown effect with `[randomize]` deps (R9).
  - `src/app/components/SettingsPanel.tsx`: `PanelHeader` (wordmark "Fade", undo/redo) and `SettingsPanel` (RandomizeButton, ColorsSection, index of Shape/Texture/Format/Seed, FileActions footer).
  - `src/app/components/controls.tsx`: `Section` (static, used by Colours) and `CollapsibleSection` (owns its `open` state), plus `NumberField` (R7).
  - `src/app/components/SeedSection.tsx`: lock buttons over `SEED_STREAMS`, seed code, copy, conditional `role="status"` note (R6), `keptHint`, `RandomizeButton`.
  - `src/app/components/ColorsSection.tsx`: "Random palette" icon button in the swatch row (`randomPalette(randomSeed(), palette.length)`).
  - `src/app/components/sections.tsx`: Shape, Texture, Format (W/H `NumberField`s).
  - `src/app/components/FileActions.tsx`: text buttons, conditional message `<p>`.
  - `src/app/components/Stage.tsx`: readout (name, dims, ratio), quality slider, text Download button, preview error copy.
  - `src/app/components/usePopover.ts`: no focusout handling (R4).
  - `src/app/render/renderer.ts`: `crashes` resets on success, so it counts *consecutive* crashes, not crashes before the first success (R5).
  - `src/core/seeds.ts` (`randomizeSeeds(seeds, locks, rng)`), `src/core/palettes.ts` (`randomPalette(seed, count)`, Bloom first), `src/core/params.ts` (`LIMITS`, `DEFAULT_PARAMS`), `src/core/settings.ts` (error strings, `APP = 'fade'`).
  - `index.html` (`<title>Fade</title>`), `README.md`.
- Which seed stream drives what (from `src/core`): `layout` drives zone positions and size jitter (`zones.ts`). `shape` drives zone elongation and angle (`zones.ts`) and the field warp (`field.ts`). `colors` drives the palette-to-zone shuffle (`zones.ts`). `grain` drives the grain noise (`grain.ts`).
- Conventions: named exports, tests next to code, `src/core` has no DOM/app imports, sentence case, `SectionProps { params, onChange(next, live?), onCommit }`, single-class CSS selectors with state via attributes.

## 3. Design

### 3.1 Section → lock/randomize mapping (ASSUMED, explain to the user)

The user's mental model is "randomize the section's look", so each section randomize changes **both** the section's visible parameters and the seed streams behind them. "Random palette" already changed parameters, so this is consistent with what the user liked.

| Section | Lock + randomize? | Randomize changes | Seed streams re-rolled |
|---|---|---|---|
| Colours | yes | `palette` = `randomPalette(seed, palette.length)` (keeps the count, as today) | `colors` |
| Shape | yes | `zones.count` int 3–10, `zones.size` 0.5–1.1, `zones.sizeVariation` 0.2–0.8, `falloff.curve` any of 3, `falloff.softness` 0.4–0.95 | `layout`, `shape` |
| Texture | yes | `grain.amount` 0.05–0.45, `grain.size` 0.6–2.5, `grain.mode` mono 75% / colour 25%, `blur` 0–0.5 | `grain` |
| Format | no | never randomized: output size is a delivery choice, not a look | – |
| Seed | no | the section only shows/pastes the code. Re-rolling is covered by the three above | – |

- Ranges are a curated "pleasant" subset of `LIMITS` (around the defaults), so full random rarely produces mush. Values are rounded to the slider steps (2 decimals, grain size 1 decimal) so readouts look clean.
- `dither` and `width`/`height` are never touched.
- Randomize all = randomize every unlocked look in one `set` action, so it is one undo step. All locked → return the same params object, and App skips the dispatch.
- Behaviour change to flag: Randomize used to re-roll only seeds (zone count, grain and palette stayed). Now it changes everything that isn't locked, which is the user's "full random". To keep the old feel for a part, lock it.

### 3.2 Module: `src/app/lib/randomize.ts` (new, deep, pure)

```ts
export type Look = 'colors' | 'shape' | 'texture';
export const LOOKS: readonly Look[];
export type LookLocks = Record<Look, boolean>;
export const LOOK_LABELS: Record<Look, string>; // 'Colours' | 'Shape' | 'Texture'
/** Re-roll the given looks (fields + seed streams, see the plan table). Other fields untouched. Pure with an injected rng. */
export function randomizeLooks(params: FadeParams, looks: readonly Look[], rng: () => number = Math.random): FadeParams;
/** Looks not locked. */
export function unlockedLooks(locks: LookLocks): Look[];
```
- Implementation: uses `randomizeSeeds(params.seeds, lockAllExcept(streamsFor(looks)), rng)` from core for the streams, and `randomPalette(Math.floor(rng() * 2 ** 32), n)` for colours. `looks = []` returns `params` (same reference).
- The seam is the injected `rng`, so tests are deterministic with no `Math.random` mocking. Section buttons and Randomize all cross the same interface, giving one place for the ranges (locality). It lives in `app/lib` because "section" is a UI grouping. Core stays the generator and keeps `randomizeSeeds`/`randomPalette` unchanged.
- `keptHint(locks: LookLocks)` moves here (or stays next to `RandomizeButton`) and uses `LOOK_LABELS`: "Colours kept", "Colours and texture kept", "Everything kept, so nothing will change".

### 3.3 State and components

- **App** owns `locks: LookLocks` (replaces `SeedLocks`, default all false) and two callbacks: `randomizeAll()` → `randomizeLooks(params, unlockedLooks(locks))`, and `randomizeLook(look)` → `randomizeLooks(params, [look])`. Both dispatch `set` only if the result `!== params`.
- **R9**: read the latest `randomize` in the keydown handler with `useEffectEvent` (React 19.2+, supported by react-hooks 7). Fallback: a ref updated in `useLayoutEffect`. The effect deps become `[]`.
- **Section header actions (composition, no booleans)**: `Section` and `CollapsibleSection` gain an optional `actions?: ReactNode` slot rendered after the title row. New `LookActions({ look, locked, onToggleLock, onRandomize })` in `components/LookActions.tsx` renders the two icon buttons:
  - lock: `aria-pressed={locked}`, `aria-label="Lock {label lowercased}"`, tooltip "Keep {label} when randomizing all" / "{Label} locked". The aria-label stays fixed (state is carried by `aria-pressed`). Icon: `LockIcon open={!locked}`.
  - randomize: `aria-label="Randomize {label}"`, tooltip the same, `ShuffleIcon`.
  - Sections receive it as `actions={<LookActions … />}`. SettingsPanel builds these from `locks` and the callbacks, so `ShapeSection`/`TextureSection`/`ColorsSection` gain only an `actions?: ReactNode` prop passed through.
- **Header markup** (a button can't be nested in a button): `CollapsibleSection` becomes `<section><div class="section-head-row"><h2 class="section-heading"><button class="section-toggle">title · summary · chevron</button></h2>{actions && <div class="section-actions">{actions}</div>}</div><div body/></section>`. The row is flex. The toggle is `flex: 1; min-width: 0` and the actions are `flex: none; gap: 2px`. Static `Section` puts `actions` at the end of `.section-head` (after the summary). Order on screen: `Shape ……… 6 zones ⌄  [lock][shuffle]`.
- **Controlled collapse (A2)**: `CollapsibleSection` becomes controlled: `{ open: boolean; onToggle: () => void }`, with no internal state (one explicit variant, no `defaultOpen` boolean). `SettingsPanel` owns `const [open, setOpen] = useState<Record<SectionId, boolean>>(ALL_CLOSED)` where `SectionId = 'shape' | 'texture' | 'format' | 'seed'`, and passes `open`/`onToggle` to each section (sections forward them to `CollapsibleSection`). An `ExpandAllButton` sits in a slim row above the index: a quiet 12 px text button right-aligned with a 12 px double-chevron icon, labelled "Expand all" if any section is closed and "Collapse all" otherwise. It has `aria-controls` listing the four body ids if they're easy to get (otherwise skip). Colours stays always open (ASSUMED).
- **ColorsSection**: remove the shuffle button from the swatch row (it moves to the header as "Randomize colours" via `actions`, which now also re-rolls the `colors` stream). The add tile stays.
- **SeedSection**: delete the locks group, the `SeedLocks` type, `STREAM_LABELS` and the `locks`/`onToggleLock` props. The `role="status"` note is always mounted (`<p id="seed-note" className="note" role="status">{note}</p>`, with `aria-describedby` always set, harmless when empty). The input gets `autoComplete="off"`. `RandomizeButton`/`keptHint` take `LookLocks`.
- **Header and FileActions (A1)**: `PanelHeader({ history, children })` renders `h1` "Fade Generator", the undo/redo group, then `children` (App passes `<FileActions params onImport />`). FileActions renders a `role="group" aria-label="Settings file"` with two `icon-btn`s (ImportIcon, ExportIcon) plus the hidden file input, and two always-mounted message `<p>`s (`role="status"` for success, `role="alert"` for errors, each empty when unused). The header becomes `flex-wrap: wrap`. The messages take `flex-basis: 100%` (a 12 px line under the header row). A 1 px `--rule` vertical gap or 8 px spacing separates the history and file groups. The footer goes away.
- **Download (A1)**: in Stage, `<button class="primary-btn icon-only download" aria-label="Download JPEG" data-tip="Download JPEG" aria-busy disabled>` with `DownloadIcon` or the spinner. It's a 36 px filled circle (40 px at phone width). `.stage-messages` gets an always-mounted `role="status"` that reads "Rendering JPEG…" while exporting (the preview error shares it or has a separate always-mounted `<p role="status">`).
- **Tooltips**: one CSS tooltip for icon buttons, driven by `data-tip` (text) and optional `data-tip-pos="top"`. `.has-tip { position: relative }` plus `.has-tip::after { content: attr(data-tip); position: absolute; … }` shown on `:hover` and `:focus-visible` with an opacity fade (`--fast`), 12 px, `--primary` background and `--on-primary` text, 6 px radius, `white-space: nowrap`, `pointer-events: none`. Tooltips go below in the header and above in the stage bar and section headers, and they're right-aligned (`right: 0`) for the rightmost buttons so they don't clip. Remove `title` from these buttons to avoid a double tooltip. Keep `aria-label` (the tooltip is `::after` text, which isn't announced, so no duplication). Apply to undo/redo too for consistency. Skip on `(hover: none)`. The host must be `position: relative` (see 3.5: never leave an absolute box without a positioned ancestor).
- **New icons** in `icons.tsx` (same 16 px style): `DownloadIcon` (arrow down into a tray), `ImportIcon` (document with an arrow pointing in), `ExportIcon` (document with an arrow pointing out). Import and Export must not look like Download. `ExpandAllIcon` / `CollapseAllIcon` (double chevrons, 12 px).
- **Phone hierarchy (P1)**: move `<RandomizeButton>` out of `SettingsPanel` to be a direct child of `.app`, so CSS can place it. Desktop grid: `grid-template-rows: auto auto minmax(0,1fr)`, with header in row 1, `.randomize` in row 2 and `.panel` in row 3 (column 1, same padding and `border-right`), and the stage in column 2, rows 1–3. Phone (flex column): header (sticky) → stage (order 1) → randomize (order 2, full width, 40 px, padding 0 16px 16px) → panel (order 3). The download icon button sits on the quality row, so the export row is `[JPEG quality ─────●─ 92] [⤓]`. `@media (hover: none) { .primary-btn kbd { display: none } }`.

### 3.4 Review leftovers

- **R1 scrollbars** (`styles.css`): Chromium ≥ 121 ignores `::-webkit-scrollbar*` when `scrollbar-width`/`scrollbar-color` are set. So:
  ```css
  .scroll { overflow-y: auto; scrollbar-gutter: stable; }
  .scroll::-webkit-scrollbar { width: 8px; height: 8px; }
  .scroll::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
  .scroll::-webkit-scrollbar-track, .scroll::-webkit-scrollbar-corner { background: transparent; }
  .scroll::-webkit-scrollbar-thumb { background: transparent; border: 2px solid transparent; border-radius: 999px; background-clip: padding-box; }
  .scroll:hover::-webkit-scrollbar-thumb, .scroll:focus-within::-webkit-scrollbar-thumb { background-color: rgba(0,0,0,.28); }
  /* same webkit rules for html (page scroll in the phone layout), thumb always rgba(0,0,0,.28) */
  @supports not selector(::-webkit-scrollbar) {
    .scroll { scrollbar-width: thin; scrollbar-color: transparent transparent; }
    .scroll:hover, .scroll:focus-within { scrollbar-color: rgba(0,0,0,.28) transparent; }
    html { scrollbar-width: thin; scrollbar-color: rgba(0,0,0,.28) transparent; }
  }
  ```
  Remove the top-level `html { scrollbar-width; scrollbar-color }`.
- **R4** `usePopover.ts`: while open, add a `focusout` listener on `rootRef.current`. If `e.relatedTarget` is a Node outside the root, call `close()` (no focus restore). A null `relatedTarget` (focus going to the body or a pointer click elsewhere) is left to the existing `pointerdown` handler.
- **R5** `renderer.ts`: add `let succeeded = false`, set true in `onmessage`. In `fail`: `if (!succeeded && crashes >= MAX_CRASHES) dead = true; else worker = start();`. Drop the `crashes = 0` reset (or keep it, it doesn't matter once `succeeded`). `Stage.tsx`: `error === DEAD_ERROR` → "The preview couldn't start. Reload the page.", otherwise the current copy. Keep `title={error}`.
- **R6** always-mounted live regions: SeedSection and FileActions as above. Stage is already fine.
- **R7** `NumberField`: add an optional `ariaLabel?: string`, set on the `<input aria-label>` (the visible `W`/`H` is a prefix of the name, which satisfies WCAG 2.5.3). `FormatSection` passes `"Width"`/`"Height"`.
- **R8** `src/app/lib/formats.ts`: add `stageReadout(width, height): { name: string; dims: string; ratio: string | null }`. `ratio` is null when the matched preset name contains `aspectLabel(w,h)`. `Stage` renders the ratio span only when it's non-null.
- **R10** delete `transition: transform …` from `.swatch-chip`.

### 3.5 Empty-scroll bug: root cause

`.sr-only` is `position: absolute` and **no ancestor in the panel is positioned**. So its containing block is the initial containing block, and neither `.panel`'s `overflow: auto` nor `.app`'s `overflow: hidden` clips it: overflow only clips descendants whose containing block is inside the clipping element. The element sits at its static position in the panel's (taller, scrollable) content, so it extends the **document's** scrollable area below the 100svh `.app`, which is the empty space. The trigger is the `Seed code` label in the Seed section (`SeedSection.tsx`, `<label className="sr-only" htmlFor="seed-code">`), which renders once the user opens Seed. That is exactly what the user did to use the locks. The swatch popover is safe (`.swatch` is `position: relative`). The new CSS tooltips would add more cases.

Fix:
1. `.panel { position: relative; }` and `.app { position: relative; }`, so every absolutely positioned descendant has a containing block inside a clipping scroller.
2. Every new absolutely positioned element (tooltips) gets a positioned host (`.has-tip { position: relative }`).
3. Guard at desktop only: `@media (min-width: 861px) { html, body { overflow: hidden; } }`. The desktop `.app` is exactly the viewport and scrolls internally. At ≥ 400% zoom the phone layout (page scroll) takes over, so content stays reachable.
4. Verify in the browser (step 9) with the A9 script. If `scrollHeight` is still larger, run the finder below and fix the element it reports instead of adding more guards:
   ```js
   [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.bottom > innerHeight + 1 && getComputedStyle(e).position === 'absolute'; })
   ```

## 4. Steps

Use red→green on every step that has a test. Run `npm test` after each step. Steps 1–5 can each be verified on their own.

1. **Randomize module.** New `src/app/lib/randomize.ts` + `randomize.test.ts` (cases in section 5). No UI yet.
2. **Renderer R5.** `renderer.ts` (`succeeded`) + `renderer.test.ts` case. `Stage.tsx` dead-error copy.
3. **Popover R4.** `usePopover.ts` focusout. Add a case to `ColorsSection.test.tsx`.
4. **Formats R8 + NumberField R7.** `stageReadout` in `formats.ts` + `formats.test.ts`. Wire it into `Stage.tsx`. `NumberField` `ariaLabel`, used in `FormatSection`.
5. **Rename A3 (narrowed).** Only the `SettingsPanel.tsx` header wordmark becomes "Fade Generator" (and the `App.test.tsx` heading assertion). Leave `index.html`, `README.md`, error strings and `APP` unchanged.
6. **Icons + tooltip CSS.** `icons.tsx`: Download, Import, Export, ExpandAll, CollapseAll. In `styles.css`, add `.has-tip` tooltip rules, `.primary-btn.icon-only` (36/40 px circle) and `.section-head-row`/`.section-actions`.
7. **Sections: controlled collapse, actions slot, locks.** `controls.tsx` (`Section`/`CollapsibleSection` `actions` slot, controlled `open`/`onToggle`). New `components/LookActions.tsx`. `sections.tsx`/`SeedSection.tsx`/`ColorsSection.tsx` take `open`/`onToggle`/`actions` as needed. Remove the seed locks and the colour row shuffle. Add `autoComplete="off"` and the always-mounted note. `SettingsPanel.tsx`: open-state record, `ExpandAllButton`, `LookActions` wiring. `App.tsx`: `LookLocks`, `randomizeAll`/`randomizeLook`, `useEffectEvent` keydown (R9), and `RandomizeButton` as an `.app` child.
8. **Header file actions + Download icon (A1).** `FileActions.tsx` icon group + always-mounted messages, rendered as `PanelHeader` children. `Stage.tsx` icon Download + "Rendering JPEG…" status.
9. **CSS layout + bugs.** `styles.css`: R1 scrollbar block, R10, scroll-bug fix (3.5), desktop grid rows for `.randomize`, phone order/sizes (P1), `(hover: none)` kbd hide, and remove the `.file-actions`/footer, `.locks`/`.lock` and `.download { min-width }` rules.
10. **Tests and checks.** Update `App.test.tsx` (section 5). Run all commands. Then use the `run` skill + `anthropic-skills:built-in-browser` at 1440×900, 1024×768 and 390×844: run the A9 script (all sections expanded, Seed open, popover open, panel scrolled to the end), take screenshots of the default and expanded states, check the tooltips on hover and on Tab focus, run the export spinner, import an exported JSON plus a JSON exported before this change (any `{"app":"fade","version":1,"params":{…}}`), lock Colours and press R several times, and use keyboard-only navigation through the headers. Scrollbar arrows: check in Edge/Chrome on Windows.

## 5. Tests

Seams (all already agreed, plus one new): **(a)** `randomizeLooks` with injected `rng` (new, pure), **(b)** App/components through Testing Library in jsdom, **(c)** pure `app/lib` helpers (`stageReadout`), **(d)** `createRenderer` through its `spawn` fake, **(e)** existing core tests unchanged. CSS, layout, scroll and tooltips are verified in the browser (step 10), not in jsdom.

- `randomize.test.ts` (use a seeded rng, e.g. `mulberry32` from core internals via a local LCG in the test):
  - `['colors']` changes `palette` (same length) and `seeds.colors`, and leaves zones, falloff, grain, blur, the other seeds, width, height and dither deep-equal.
  - `['shape']` changes only zones/falloff/`seeds.layout`/`seeds.shape`. `['texture']` changes only grain/blur/`seeds.grain`.
  - Every output is within the 3.1 ranges and `LIMITS` across 200 rng seeds. `zones.count` is an integer and numbers are rounded to their step.
  - `[]` returns the same reference. `unlockedLooks({colors:true, shape:false, texture:true})` gives `['shape']`.
  - `keptHint`: "Colours kept", "Colours and texture kept", the all-locked text, and null when none are locked.
- `renderer.test.ts` (R5): one successful preview reply, then 3 crashes, then a further preview still posts to a newly spawned worker and isn't failed with `DEAD_ERROR`. The existing "dead after 3 crashes with no success" case stays.
- `ColorsSection.test.tsx` (R4): open swatch 1, edit with the keyboard, `fireEvent.focusOut(popoverElement, { relatedTarget: someOutsideButton })`. The popover is gone, and one Ctrl+Z restores the colour.
- `formats.test.ts` (R8): `stageReadout(1920,1080)` → name "Landscape 16:9", ratio null. `(2560,1440)` → "Desktop", "16:9". `(1000,700)` → "Custom", "10:7".
- `App.test.tsx`:
  - The heading is "Fade Generator".
  - The icon buttons "Import settings", "Export settings" and "Download JPEG" are found by role+name and contain no visible text (`textContent.trim() === ''`).
  - Expand all: clicking "Expand all" sets all four toggles to `aria-expanded="true"` and the button now reads "Collapse all". Clicking it collapses all four. After expand-all, collapsing Shape by hand turns the label back to "Expand all".
  - Per-section: "Randomize texture" changes the Texture summary or the seed code's 4th group but not the Colours summary ("Bloom"), the Shape summary or the size readout, and one Undo restores the seed code.
  - Locks: press "Lock colours" (`aria-pressed="true"`), the hint reads "Colours kept", then click Randomize. The Colours summary stays "Bloom", the colours group of the seed code (3rd) is unchanged, the layout group (1st) changes, and the size readout is unchanged. Undo/Redo round-trip as in the existing test.
  - Lock all three, Randomize → Undo stays disabled.
  - The Seed section has no "Keep when randomizing" group, and the seed code paste still applies (existing behaviour).
  - `R` key: pressing `r` on `window` randomizes. Pressing it after a slider change still uses fresh params (guards the R9 refactor).
  - The size fields are found by `getByRole('textbox', { name: 'Width' })` / `'Height'`.
  - The `role="status"` regions exist before any message (`getAllByRole('status')` includes the seed and file ones once Seed is expanded).
- Keep green: `summaries.test.ts` (R2, R3), `settings.test.ts` round-trip (A8: `serializeSettings(DEFAULT_PARAMS)` unchanged), `seeds.test.ts`.

Commands (PowerShell: `npm.cmd …`): `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run dev` for the browser.

## 6. Skills for the implementer

`frontend-design:frontend-design`, `vercel-react-best-practices`, `vercel-composition-patterns`, `codebase-design`, `tdd`, `run` + `anthropic-skills:built-in-browser` (step 10), `engineering:debug` if the scroll bug doesn't yield to 3.5.

Reviewer: `web-design-guidelines`, `design:design-critique`, `design:accessibility-review`, `vercel-react-best-practices`, `tdd`.

## 7. Risks & open questions

No BLOCKING questions.

- ASSUMED (most important, report it to the user): section randomize, and therefore Randomize all, changes the section's **parameters and seeds** within curated ranges (table 3.1), not just seeds. Randomize all therefore now changes zone count, grain, palette, etc. unless locked. Alternative if the user dislikes it: seeds-only for Shape/Texture (one-line change inside `randomizeLooks`).
- ASSUMED: Format and Seed get no lock or randomize. Size is never randomized.
- ASSUMED: a section's own randomize button works even when the section is locked. The lock only shields it from Randomize all.
- ASSUMED: Colours stays always open and is not part of expand/collapse all. Locks and open states aren't persisted across reloads, and locks aren't saved in settings files.
- ASSUMED: Colours randomize keeps the current colour count (as "Random palette" did).
- ASSUMED: import/export move from the panel footer into the header, next to undo/redo, as icons. Their messages show as one 12 px line under the header.
- ASSUMED: package name, `"app": "fade"` in JSON, and the `fade-` filename prefix stay (compatibility). Only user-visible naming changes.
- Risk: the CSS `::after` tooltip may clip at the panel's left/right edge. Use `right: 0` alignment for the rightmost buttons and check in the browser. If it gets fiddly, fall back to native `title` (already the convention) and note the deviation.
- Risk: `useEffectEvent` lint support. If `eslint-plugin-react-hooks` 7 flags it, use the ref pattern.
- Risk: the desktop `overflow: hidden` guard on html/body could hide a real overflow bug in the future. The step-10 A9 script is the real check, and the guard is a backstop.
