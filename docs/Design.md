# Design.md — Kaushal Setu

> Design system and UX spec for **Kaushal Setu**, the labour-market intelligence and curriculum-alignment platform for SIH 2026, PS 26134 (Govt. of Maharashtra, DSEEI).
> Companion docs: [Architecture.md](./Architecture.md) · [Plan.md](./Plan.md)
> Built with the `ui-ux-pro-max` design intelligence. Design language: **Ledger & Card-stock, made human**. Its baseline recommendation for "government analytics dashboard" was *Minimalism & Swiss Style* with an *Enterprise Gateway* entry pattern. We keep that structure (grid, restraint, one accent, persona gateway) and replace its generic navy SaaS palette with the art direction below.

---

## 1. The idea: Ledger & Card-stock, made human

Every person, place and course in this system gets a **card**. It's the oldest way people introduce themselves: a small, well-made piece of paper that says who you are and what you do. When you want to understand the difference between two things that look the same on paper, you lay their cards side by side. That's the whole interaction model.

We keep the craft of fine card stock (bone paper, careful type, a watermark you have to look twice to see). We point all of it at **people**, not status:

| Craft idea | Becomes in the product |
|---|---|
| Everyone has a **card** | Every entity (district, course, skill, employer, candidate, plan) is a Card with one fixed anatomy. Learn it once, read everything. |
| Cards are **laid side by side** | **Compare on the Table**: put 2–4 cards down and the system points to exactly where they differ, in one plain sentence. |
| A **watermark** you notice on second look | Watermarks are honesty marks: `SPECIMEN` = demo data, a pressed **seal** = local employers endorsed it, `LAPSED` = the data is older than it should be. |
| Bone stock, careful type, hairline rules | Warm paper on a linen table. Calm, trustworthy, never flashy. |

### Humanize everything: the five rules
1. **People, not percentages.** Every headline number gets translated into people. Not "Gap: 0.31" but "About **140 people** in Nashik could be hired as solar technicians next year. Our ITIs will train **35**."
2. **Say who said it.** Evidence is shown as voices: "14 employers in Nashik told us solar PV is a must-have", "a posting from Chakan says: *'must know Fanuc controls'*". Quotes are real rows from the Evidence Drawer, never invented.
3. **Talk like a helpful district officer.** Short sentences, second person, plain Marathi and plain English. No jargon on the surface ("Mismatch Index" lives in the tooltip; the card says "How far training is from jobs").
4. **Be honest about what we don't know.** "We've only seen 23 job posts from Gadchiroli, so this leans on what 6 employers told us." Uncertainty is written as a sentence, not hidden in a chart.
5. **Every screen ends in a next step a human can take.** "Share this with the ITI principal" · "Ask 3 more employers" · "Sign the plan". No dead ends.

The candidate side is warmest of all: "Here's where your skills can take you in Nashik", never "Candidate readiness: 62%".
Illustrative personas in the demo are clearly labelled as examples; we never present an invented person as real.

**Tone:** a public ledger kept by people who care. No gradients, no glassmorphism, no emoji, no confetti. Motion only when something physically moves (a card being set down on the table).

**Anti-goals:** no luxury signalling, no corporate buzzwords, no AI-sounding filler ("unlock", "leverage", "insights at your fingertips"). If a sentence could appear on any SaaS landing page, rewrite it.

**Compliance:** the UI follows **GIGW 3.0** (Guidelines for Indian Government Websites):
- a bilingual header with correct State Emblem / Govt. of Maharashtra usage;
- accessibility statement, sitemap, feedback, and last-updated pages;
- WCAG 2.1 AA as the floor (§8 goes beyond it).

---

## 2. Tokens

### 2.1 Colour. Two materials: *table* and *stock*.

The page is the *table* and the cards are the *stock*. Stock is always light. The table is a mid linen in Daylight (default) and charcoal walnut in Boardroom. Boardroom also dims the stock slightly to cut glare.

| Token | Boardroom (dark, opt-in) | Daylight (light, **default**) | Use |
|---|---|---|---|
| `--table` | `#141210` (charcoal walnut) | `#CFC8B8` (linen) | page background |
| `--table-raised` | `#1D1A17` | `#C4BCAA` | sidebars, trays |
| `--table-ink` | `#EFE8D8` | `#1C1A17` | text directly on table |
| `--table-muted` | `#A89F8F` | `#4A443B` | secondary text on table |
| `--stock-bone` | `#E3DBC8` | `#EFE8D8` | default card |
| `--stock-eggshell` | `#E8E1CF` | `#F2ECDC` | selected / focused card |
| `--stock-nimbus` | `#DEDAD0` | `#F4F3EE` | institutional cards (govt) |
| `--ink` | `#1C1A17` | `#1C1A17` | text on stock (12.6:1 dark-mode stock · 14.2:1 light) |
| `--ink-muted` | `#5E574C` | `#5E574C` | secondary on stock (5.2:1 · 5.8:1) |
| `--ink-faint` | `#756D60` | `#756D60` | hairlines and data marks, **non-text only** (3.7:1 · 4.2:1) |
| `--brass` | `#B8A27A` | `#8C6B2E` | single accent, **on the table only** (active nav, tray edge; 7.5:1 on dark table). On stock it is never the sole marker of a state. |
| `--signal-gap` | `#7A1F24` oxblood | same | shortage / obsolete / risk (7.4:1 · 8.4:1) |
| `--signal-ok` | `#2E4A3B` banker's green | same | healthy / placed (7.1:1 · 8.0:1) |
| `--signal-watch` | `#7A5A12` ochre | same | revise / watch (4.6:1 · 5.2:1) |

Rules:
- Put signals on **stock only**, and always pair them with a glyph plus a word (`▲ SHORTAGE`, `▼ OVERSUPPLY`). Never use colour alone.
- **Only one accent colour** (brass) appears on a screen. The three signal colours are semantic and never decorative.
- No pure white (`#FFF`) and no pure black. Paper is never white.
- Contrast figures are given as *dark-mode stock · light stock* and were re-measured on both. In Daylight, stock and table are close in luminance (1.4:1), so **every card also gets a 1px `--ink-muted` border**. Cards never separate from the page by shadow alone.
- Focus ring: a double ring, `2px var(--ink)` inside plus `2px var(--table-ink)` outside. That gives at least 12:1 against both stock and table in both themes. Always visible, never removed.
- **Theme default:** Daylight for every persona, and it is the theme used for projection and print. Boardroom is an opt-in toggle, and it is the dramatic version for the demo video.

### 2.2 Typography: engraved card lettering

Fine business cards use a light, widely tracked roman in small capitals. We build that from open fonts and add Devanagari, because Marathi is a first-class language here.

| Role | Latin | Devanagari (mr / hi) | Setting |
|---|---|---|---|
| **Card name / display** | Cormorant SC 500 | Tiro Devanagari Marathi | small caps, `letter-spacing: 0.18em`, **22–56px** (never below 22px: thin tracked caps smear on low-DPI office monitors and projectors) |
| **Card title line** | Cormorant Garamond 400 italic | Tiro Devanagari Marathi | 14–16px |
| **UI / body** | Inter 400/500/600 | Noto Sans Devanagari | 16px base, line-height 1.55 |
| **Figures / codes** | IBM Plex Mono 400/500 | — | `font-variant-numeric: tabular-nums`, uppercase codes tracked 0.08em |

Scale (px): 12 · 14 · 16 · 18 · 22 · 28 · 36 · 48 · 56. Body is never below 16px on mobile, and labels are never below 12px.
Load fonts with `next/font` (`display: swap`) and subset Devanagari. Preload Inter and Cormorant SC only.

**Devanagari rules.** Devanagari has no small caps and no true italic, and tracking breaks conjuncts. So:
```css
:lang(mr), :lang(hi) { letter-spacing: 0; font-variant-caps: normal; font-style: normal; }
```
In Marathi, a card's name line switches to Tiro Devanagari Marathi at weight 500 and 1.1× size, and the title line uses weight instead of italic.

**Letterpress effect** (display type ≥ 22px on stock only, dark shadow only, since the white highlight blurs on light stock):
```css
.letterpress { color: var(--ink); text-shadow: 0 -1px 0 rgb(0 0 0 / .10); }
```
**Emboss** (seal and watermark): an inline SVG with `feDiffuseLighting` at 6% opacity. It has no text meaning; the meaning lives in the adjacent label and the `aria-label`.

### 2.3 Space, shape, depth

- Spacing uses a 4px base. Dashboard density: `4 8 12 16 24 32 48`.
- Radius is **2px** on cards (real card stock has a barely rounded die-cut) and 0 on tables and rules.
- Elevation has exactly **three levels**, like paper on a table:
  - `--lift-0` resting: `0 1px 0 rgb(0 0 0/.25)`
  - `--lift-1` picked up (hover or focus): `0 6px 18px -6px rgb(0 0 0/.45)`
  - `--lift-2` in hand (dragged or opened): `0 18px 40px -12px rgb(0 0 0/.55)`
- Paper grain: one 2 KB tiling noise PNG at 3% opacity on stock. It is disabled under `prefers-reduced-transparency` and in print.
- Hairline rules are `1px var(--ink-faint)`. Double rule (`3px double`) marks section ends, like a ledger.

### 2.4 Motion tokens

| Token | Value | Use |
|---|---|---|
| `--t-quick` | 140ms, `cubic-bezier(.2,0,0,1)` | hover lift, press |
| `--t-slide` | 320ms, spring (stiffness 380, damping 32) | card leaving the case, card to table |
| `--t-exit` | 200ms (≈ 0.6 × enter) | dismiss |
| stagger | 40ms per card, max 8 cards, then instant | grids |

Only `transform` and `opacity` animate. Under `prefers-reduced-motion`, every card renders in its final position with a 0ms crossfade. There are no parallax scroll effects. There is **no hover tilt**: rotated text rasterises blurry. Hover is lift-only (translateY −2px and `--lift-1`).

Library: **Motion** (`motion/react`) for the card-to-table layout animation only. Shared-element page transitions are cut for scope, and GSAP is not needed.

---

## 3. The Card: one anatomy for everything

Proportion is **1.75 : 1** (3.5″ × 2″, the business-card ratio) for the compact card and 1.75 : 2 for the expanded card. This is a **minimum** (`aspect-ratio` plus `min-height`, with height allowed to grow), so Marathi names (~20% taller) and 200% text zoom never clip. The layout follows a classic business card: code top-left, figure top-right, name centred in spaced capitals, title below, and a human sentence plus provenance across the bottom.

```
┌──────────────────────────────────────────────────────────┐
│ NCO 2512.0201                              SDI  78 ▲ 12  │  ← code (mono)            key figure + delta
│                                                          │
│                    D A T A   A N A L Y S T               │  ← name: Cormorant SC, tracked
│                   Pune · Proficiency: Intermediate       │  ← title: italic
│                                                          │
│        ▲ SHORTAGE   1,240 demand  ·  310 supply  (4.0×)  │  ← one-line verdict with glyph + word
│ ─────────────────────────────────────────────────────── │
│ 412 postings · 18 employers · 3 surveys      as of SEP 26 │  ← provenance line (always present)
└──────────────────────────────────────────────────────────┘
```

**Variants** (same anatomy, different stock and content):

| Card | Stock | Code (top-left) | Figure (top-right) | Verdict line |
|---|---|---|---|---|
| District | nimbus | LGD code | Mismatch Index | top shortage skill |
| Skill | bone | ESCO / NSQF id | Skill Demand Index + trend | shortage / balanced / oversupply |
| Course | bone | NCVT / QP code | Course Health 0–100 | HEALTHY · REVISE · OVERSUPPLIED · OBSOLETE |
| Employer | eggshell | Udyam / sector | validations given | open Curriculum PRs |
| Candidate | eggshell | anonymised id | readiness % | next best role |
| Training plan | nimbus | district · FY | expected placements | seats reallocated |
| Curriculum PR | bone | course · PR # | employer votes | proposed diff summary |

**States:** resting → picked up (hover/focus: `--lift-1`, eggshell stock) → **selected for compare** (2px `--ink` border + a ✓ check glyph + a "On table" label; `aria-pressed="true"`) → opened (crossfade into the detail page). Every state has a non-colour marker.
**Watermark states:** `SPECIMEN` (demo data, diagonal, 8% ink) · seal (employer-validated) · `LAPSED` (source past freshness SLA). Each watermark is repeated as text in the provenance line for screen readers.

**Evidence drawer:** every figure on a card is a button. Activating it opens a drawer from the right that lists the underlying rows (postings with the highlighted evidence sentence, survey responses, dataset + resource id + fetch date). This is the "why does it say that?" answer for judges and officials. No number anywhere in the product is a dead end.

---

## 4. Signature interactions

### 4.1 The Card Case (entry)
The landing page shows one closed card case. On load, the state card slides out (`--t-slide`, translateY + rotateX 8°→0°), followed by four persona cards: **Official · Institute · Employer · Candidate**. This is the *Enterprise Gateway* "I am a…" pattern the design search recommended, rendered as cards. Keyboard: arrow keys move between cards, Enter opens one. Reduced motion: the cards are simply there.

### 4.2 Compare on the Table
- Any card has a "Place on table" action (keyboard: `T`; touch: long-press menu, plus a visible button; **no drag-only path**).
- The table is a docked tray at the bottom holding up to 4 cards. Opening it lays the cards side by side.
- **Difference highlighting:** fields that differ beyond a threshold get an oxblood hairline underline, and a single sentence summarises the gap ("Course B covers 3 of the 5 skills Pune employers rank *Mandatory*; Course A covers 5."). This sentence is Gemini-drafted from computed diffs. It is never free-form and always cites fields.
- The tray state lives in the URL (`?table=course:123,course:456`), so a comparison can be shared as a link.

### 4.3 Curriculum Pull Request
A course's proposed revision is shown like a code diff, set in the card typography:
```
  MODULE 4 — Spreadsheet Analysis                       40h
- Lotus-style macros                                     6h   ▼ demand −61% YoY (Pune, Nashik)
+ Power BI dashboards                                    10h   ▲ 312 postings · 11 employers Mandatory
~ Excel Pivot Tables                                  4h → 8h
```
Employers review it in their inbox: **Endorse / Request change / Not relevant**, with an optional comment. Endorsements accumulate as seals on the course card.

### 4.4 District Dossier and map
The Maharashtra choropleth (36 districts) uses a single-hue sepia ramp with 5 classed steps, district outlines always drawn, and a labelled legend. The map is always paired with a sortable table of the same data (the a11y fallback), with keyboard focus moving district to district in table order. Clicking a district opens its dossier. The **coverage indicator** is required: districts with thin posting data show a hatched pattern and "low signal — survey-weighted", so rural districts are never shown with false confidence.

---

## 5. Information architecture and screens

Navigation: left rail on ≥1024px (icon + label), top bar with a menu sheet on mobile. Five primary destinations per persona at most. Language switcher (EN / मराठी; हिंदी later) sits in the top bar on every screen.

| Route | Persona | Primary card(s) | Key widgets |
|---|---|---|---|
| `/` | all | State card, 4 persona cards | Card Case |
| `/state` | Official | District cards (36) | choropleth, rising skills, flag counts, freshness strip |
| `/districts/[lgd]` | Official, Institute | District card expanded | sector demand, gap table, courses in district, plan link |
| `/skills/[id]` | all | Skill card | trend (line), districts (bar), courses teaching it, emerging radar lag |
| `/courses/[id]` | Institute, Official | Course card | health breakdown, placement funnel, open Curriculum PRs |
| `/plans/[lgd]/[fy]` | Official | Training-plan card | seat reallocation (slope chart), trainer & equipment needs, PDF export |
| `/radar` | Official, Institute | Skill cards | emerging tech: global → India → Maharashtra lag (small multiples) |
| `/employer` | Employer | Employer card | demand survey (≤ 6 min), Curriculum PR inbox |
| `/me` | Candidate | Candidate card | "your next card": roles nearby, gap skills, nearest ITI course, free SWAYAM/NPTEL modules |
| `/review` | Admin | Review items as cards | low-confidence extractions, unknown skills, duplicate postings |
| `/sources` | all | Source cards | health, last fetch, row counts, licence, freshness SLA |

**Candidate flow is mobile-first** (≥ 375px, 44px targets, Marathi default where the browser locale is `mr`). It runs on low bandwidth: no map, cards only, and the page stays under 150 KB JS.

---

## 6. Data visualisation rules

| Question | Chart | Notes |
|---|---|---|
| How is demand for X changing? | line + 80% band | band = forecast interval; label "forecast" in-chart |
| Which districts need X most? | horizontal bar (sorted) | direct labels, no legend |
| Where is the gap? | choropleth + table | classed sepia ramp; hatched = low signal |
| Seats before → after plan | slope chart | oxblood for cuts, green for additions, labels at both ends |
| Skill coverage of course vs demand | dot matrix (skills × importance) | filled = covered, ring = missing |
| Emerging tech lag | small multiples, shared x-axis | global / India / MH series per term |

Ink-on-stock charts: data marks in `--ink`, gridlines in `--ink-faint` at 40%, one highlighted series in brass or a signal colour. Every chart has a one-sentence text summary (`aria-describedby`), a table toggle, and CSV export. Loading shows a skeleton card, never an empty axis frame. Library: **Observable Plot** for static and SVG charts (it matches the engraved look), and `d3-geo` SVG for the 36-district map (no WebGL needed).

---

## 7. Copy voice

- Short, declarative, numerate: "Pune needs 4× more data analysts than its institutes will graduate by March." Not "Unlock insights!"
- Every verdict carries a number and a source.
- Uncertainty is stated plainly: "Low signal: 23 postings. Weighted toward the employer survey."
- UI strings live in `messages/{en,mr}.json` from day one (`hi` later). No hard-coded copy.

---

## 8. Accessibility and quality gates (ship blockers)

- WCAG 2.2 AA: text contrast ≥ 4.5:1 (verified in §2.1), focus visible and never obscured by the compare tray, targets ≥ 24px (44px on the candidate flow).
- No drag-only interactions (§4.2). Watermarks and seals have text equivalents.
- Charts have text summaries and table alternatives. The map is keyboard-operable.
- `prefers-reduced-motion`, `prefers-contrast: more` (drops grain, thickens rules), and a print stylesheet (training plans must print cleanly on A4 for district offices).
- Performance: LCP < 2.0s on 4G for `/state`; CLS < 0.05 (cards reserve their aspect-ratio box); no layout-shifting hover.
- Test at 375 / 768 / 1024 / 1440, in both themes, and in Marathi, because Devanagari runs ~20% taller and must not clip card names.

---

## 9. Component inventory (shadcn/ui base, restyled)

`Card` (+ variants from §3) · `CardCase` · `CompareTray` · `EvidenceDrawer` (Sheet) · `Watermark` · `Seal` · `DiffBlock` · `Choropleth` · `PlotChart` · `DataTable` (TanStack, sortable, `aria-sort`) · `FreshnessStrip` · `LangSwitcher` · `PersonaRail` · `SurveyStepper` (autosave, step indicator, back nav) · `PlanSlope` · `SkeletonCard`.
Icons: **Phosphor** (thin weight, to match the hairline aesthetic), one weight throughout, `aria-hidden` when beside a label.
