# @ks/ui

Design system for Kaushal Setu. "Ledger & Card-stock, made human" (docs/Design.md). React 19, no
`next` dependency. See every component live at `/dev/cards`.

## Setup (apps/web already does this)

```css
/* app/globals.css */
@import "tailwindcss";
@import "@ks/ui/styles.css";
@source "../../../packages/ui/src";
```

- Tokens (Design.md §2) are CSS variables. Daylight is the default; Boardroom is `[data-theme="boardroom"]`
  on `<html>` or on any subtree. Tailwind utilities exist only for the tokens: `bg-table`, `bg-stock-bone`,
  `text-ink`, `text-ink-muted`, `border-ink-faint`, `text-signal-gap`, `shadow-lift-1`, `font-display`,
  `font-deva`, `tracking-name`, and so on. The default Tailwind palette is removed on purpose.
- Fonts come from `next/font` as `--font-display --font-serif --font-sans --font-mono --font-deva --font-deva-sans`.
- Wrap the app in `<LinkProvider component={NextLink}>` so internal links use client navigation.
- Put `PREFS_BOOT_SCRIPT` in `<head>`. It applies the saved theme and `lang` before paint.
- **Copy:** components ship English defaults. Pass translated `labels` from `messages/{en,mr}.json`.
  Templates such as `"{n} rows"` are filled by the component, so pass them raw (`t.raw(...)`), not through `t()`.
- **Server/client:** files marked "use client" are client components. Everything else is server-safe.
  Import server-side helpers (`format`, `prefs`, `compareCore`) from the barrel `@ks/ui`. They live in plain
  modules, so servers receive real values rather than client references.

## Components

### Card *(server-safe)*
One anatomy for every entity: code (top left), figure (top right, always a button that opens the
EvidenceDrawer), name in tracked small caps, title, verdict (glyph + word), a human sentence, and a
provenance line. The aspect ratio is 1.75:1 as a minimum; the card grows for Marathi and for 200% zoom.
```tsx
<Card variant="district" code="LGD 487" name="Nashik" title="Nashik division"
  figure={{ label: "Gap", value: "0.41", evidence: rows /* or loadEvidence: serverAction */ }}
  verdict={{ tone: "gap", glyph: "▲", word: "Shortage", text: "Solar PV installation" }}
  human={<>About <b>140</b> people could be hired…</>}
  provenance={summary.provenance}          // isDemo -> SPECIMEN, lapsed -> LAPSED (visual + text)
  endorsements={4}                          // pressed seal
  href="/districts/487"
  compare={{ ref: "district:487", fields: [{ key: "gap", label: "People short", value: 140 }] }}
  lang="mr" labels={…} evidenceLabels={…} headingLevel={3} selected expanded />
```
- `variant`: `district | skill | course | employer | candidate | plan | pr`. The variant picks the stock (Design.md §3).
- States: resting; picked up (hover or focus, or `className="is-lifted"`); on the table (a 2px ink border,
  check glyph, "On table" label and `aria-pressed`, driven by the URL or forced with `selected`).
- `GatewayCard`: the whole card is one link (the landing Card Case). Props: `variant code name title human href cta lang`.
- `apps/web/lib/cards.tsx` builds Card props from contract types: `districtCard`, `courseCard`, `skillCard`.

### Watermark, WatermarkText, Seal *(server-safe)*
- `<Watermark kind="specimen" | "lapsed" word srText />` draws the diagonal honesty mark and adds sr-only
  text. Pass `srText={null}` when the text is already visible nearby.
- `<WatermarkText kind>` is the inline text equivalent, used in provenance lines.
- `<Seal count label showLabel size />` is an embossed seal (feDiffuseLighting at 6%). `label` becomes the `aria-label`.

### CompareProvider, CompareTray, CompareTable, TableToggle *(client)*
- `CompareProvider` keeps table state in the URL (`?table=course:1,course:2`, up to 4) through the History
  API. The `T` shortcut toggles the focused card, or opens the table when no card is focused. Every change
  is announced in a live region. Props: `max`, `param`, `labels`.
- `useCompare()` returns `{ refs, items, toggle, remove, clear, register, tableOpen, setTableOpen }`.
- `CompareTray` is the docked tray. It sets `--tray-h` so the tray never hides focused content.
  Props: `resolve?(refs)` (a Server Action for refs not on the page, e.g. `app/actions/table.ts`),
  `summarize?(refs)` (a Server Action returning the one-sentence diff), `summary`, `labels`, `tableLabels`.
- `CompareTable`: `items: CompareItem[]`, `summary?: ReactNode`, `threshold=0.15`, `onRemove`, `labels`.
  Differing fields get an oxblood hairline underline plus "(differs)" for screen readers.
- `TableToggle` is the visible "Place on table" button. Card renders it when `compare` is set.
- Server-safe: `parseTable(raw, max)`, `fieldDiffers(values, threshold)`, `TABLE_PARAM`, `TABLE_MAX`.

### EvidenceDrawer, FigureButton, Sheet *(client)*
- `Sheet`: a native modal `<dialog>` (focus trap, Esc, focus return) from `side="right" | "left" | "bottom"`.
  Props: `open onClose title description footer closeLabel lang`.
- `EvidenceDrawer`: `open onClose title intro rows: EvidenceRow[] | null loading error lang labels`. Rows show
  as voices. Posting, survey and consultation `detail` is set as a quote, with source, date and link.
- `FigureButton`: `label value delta? evidence? loadEvidence? evidenceTitle evidenceIntro`. Card uses it.

### DiffBlock *(server-safe)*
`<DiffBlock lines={pr.diff} skillLabels={{ id: label }} title hideKeep lang labels />`. It renders
`+ / − / ~` rows grouped by module, with `<ins>`/`<del>`, hours, and the reason sentence.

### Choropleth, DataTable, MapWithTable *(client)*
- `Choropleth`: `geo` (`public/geo/mh-districts.geo.json` via `lib/geo.ts`), `data: {lgd, name, value, coverage, display}[]`,
  `breaks?` (4 thresholds, default quintiles), `order?`, `selected`, `onSelect` or `hrefTemplate="/districts/{lgd}"`,
  `lowCoverage=0.4` (hatched), `labels`. It has one tab stop; arrow keys, Home and End move through `order`,
  and Enter selects. The legend is labelled.
- `DataTable`: `caption columns rows rowKey initialSort onOrderChange rowHref selectedKey lang labels`. Headers
  are sort buttons with `aria-sort`. Column `format`: `text | number | percent | people | decimal`. A
  `cell` renderer can only be passed from client code.
- `MapWithTable`: map plus table. Sorting the table re-orders map focus, and focusing a row highlights the district.

### PlotChart *(client)*
`<PlotChart title summary chart={spec} height csvName headers labels initialView />`. Plot loads lazily.
The summary is wired to the SVG through `aria-describedby`. It includes a "Show as table" toggle and CSV export.
Presets (`ChartSpec`):
- `lineBand` `{x, y, low, high, forecast}[]`: trend with an 80% band; forecast points are dashed and labelled.
- `barSorted` `{label, value, highlight}[]`: direct labels, no legend.
- `slope` `{label, before, after}[]` with `beforeLabel` and `afterLabel`: oxblood for cuts, green for additions.
- `dotMatrix` `{row, col, covered}[]` with `colOrder`: filled means taught, a ring means missing.

### PeopleFigure *(server-safe)*
`<PeopleFigure value={137} unit="people" sentence="…" approxLabel="about" source lang size align onTable />`.
It renders "≈140 people" (via `humanRound`), with "about" for screen readers.

### FreshnessStrip *(server-safe)*
`<FreshnessStrip sources={SourceHealth[]} lang labels />` shows a stock tag per source: ✓ when fresh,
LAPSED otherwise. `ok` comes from the reader; there is no `Date.now()`.

### LangSwitcher, ThemeToggle *(client)*
- `LangSwitcher`: `current`, `onChange` (pass `router.refresh`), `label`. Writes the `ks-locale` cookie.
- `ThemeToggle`: `labels`. Writes the `ks-theme` cookie and sets `data-theme`.

### PersonaRail, PersonaMenu *(client)*
`groups: NavGroup[]` (`{heading, items: {href, label, icon, prefix}[]}`), `currentPath`, `label`.
The rail shows at ≥1024px with a brass marker and `aria-current`. Below that, a menu button opens a sheet.

### SurveyStepper *(client)*
`<SurveyStepper storageKey steps={[{id, title, description, content}]} action={serverAction} labels />`.
It has a step indicator, Back, per-step `reportValidity`, and autosave to localStorage (in try/catch).
It restores saved answers on load and clears them on submit. All steps live in one `<form>`.

### Button, Badge, SkeletonCard, Icon, UiLink, CardCase
- `Button`: `variant primary | secondary | ghost | table`, `size sm | md | lg`, `icon`, `iconAfter`, `href`.
- `Badge`: `tone gap | ok | watch | neutral`, `glyph`, `solid`. `VERDICTS` maps course and demand flags to tone and glyph.
- `SkeletonCard`: `variant`, `label` (announced once), `expanded`. It reserves the card box.
- `Icon`: `name` (Phosphor, thin weight), `size`, `label`. It is `aria-hidden` unless a label is given.
- `CardCase`: a staggered CSS entry (off under reduced motion) with arrow-key roving over `[data-roving-item]`.

## Page rules for product pages (Next 16, Cache Components)
- Wrap each page's locale- or data-bound body in `<Suspense fallback={<PageSkeleton />}>` (in `apps/web/components`).
  The layout's boundary sits above the navigation scope, and dev validation flags pages without their own boundary.
- Readers (`getReaders()`) take primitives, so you can wrap them in `"use cache"`. Never read `cookies()` inside a cache scope.
