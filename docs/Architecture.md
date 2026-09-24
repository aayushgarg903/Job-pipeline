# Architecture.md — Kaushal Setu

> Labour-market intelligence and curriculum-alignment platform for **SIH 2026 · PS 26134**
> (Govt. of Maharashtra · Maharashtra State Innovation Society · Dept. of Skills, Employment, Entrepreneurship & Innovation)
> Companion docs: [Design.md](./Design.md) · [Plan.md](./Plan.md) · API catalogue: §5

---

## 0. The problem, restated honestly

The PS asks for a *continuous, evidence-based mechanism that translates industry demand into course design, capacity planning, trainer development and candidate guidance*. It must do that **by role, skill, location and proficiency**, and it must end in **district-level training plans**.

Three things make this hard. Most submissions will miss all three.

1. **Job postings are a biased sensor.** Online postings over-represent Pune, Mumbai and white-collar IT. Maharashtra's workforce is mostly MSME, manufacturing, agri-processing and informal, and those employers rarely post online. A dashboard of scraped postings would *confidently* tell Gadchiroli it needs React developers. **Our answer: postings are one signal among six, fused with explicit weights, with a per-district coverage score that is always shown.**
2. **Demand and supply live in different vocabularies.** Employers write "need a CNC guy who knows Fanuc". Courses are specified as NCVT trades and NSQF Qualification Packs. Candidates describe themselves in Marathi. **Our answer: one canonical skill graph (ESCO skills ⟷ NSQF QPs ⟷ NCO-2015 occupations). Every source is mapped into it with Gemini embeddings plus human review.**
3. **Insight doesn't change curricula; workflow does.** A chart that says "Power BI is rising" changes nothing. **Our answer: the output is a *Curriculum Pull Request* that employers validate, and a *District Training Plan* produced by an optimiser under real constraints (seats, trainers, equipment). Both are exportable as signed PDFs that a district skill officer can act on.**

---

## 1. System at a glance

```
                  ┌──────────────────────── SIGNALS (demand) ─────────────────────────┐
 Job postings     │ JSearch /search-v2 · Adzuna IN · (Mahaswayam via DSEEI data MoU)   │
 Sector growth    │ Udyam (LGD+NIC, district!) · MoSPI PLFS/EC · MH district GDP       │
 Emerging tech    │ GitHub · Stack Exchange · OpenAlex · HN "Who is hiring" · Wikipedia │
 Employer voice   │ in-app surveys · consultation minutes (upload → extraction)         │
 Outcomes         │ placement records (institute upload / PMKVY / ITI tracer data)      │
                  └───────────────────────────────┬───────────────────────────────────┘
                                                  │  ingest (GitHub Actions cron)
 SUPPLY           ┌───────────────────────────────▼───────────────────────────────────┐
 ITI trades, seats│  1 RAW  (immutable JSON, source + fetched_at + hash)               │
 PMKVY / MSSDS    │  2 NORMALISE  location→LGD district · title→NCO · text→skills      │
 NSQF QPs (NQR)   │  3 SKILL GRAPH  ESCO ⟷ NSQF ⟷ NCO, pgvector, review queue          │
 Institutes       │  4 FACT TABLES  demand_fact / supply_fact (district×skill×prof×mo) │
                  │  5 ENGINE  SDI · Gap · Course Health · Radar · Forecast · Planner  │
                  └───────────────────────────────┬───────────────────────────────────┘
                                                  │ Server Components, "use cache", cacheTag
                  ┌───────────────────────────────▼───────────────────────────────────┐
                  │ Next.js 16 app  —  Official · Institute · Employer · Candidate     │
                  │ Cards, Compare, Curriculum PRs, Training Plans (PDF), Marathi      │
                  └────────────────────────────────────────────────────────────────────┘
```

---

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Web | **Next.js 16.3** (pin `^16.3.7`, the 2026-09-30 security release) · React 19.3 · Node ≥ 20.9 · Turbopack (default) · **Cache Components** `cacheComponents: true` (PPR by default) · `proxy.ts` (Node runtime) | Server Components keep heavy aggregates on the server. `"use cache"` + `cacheTag('district:27-521')` gives precise invalidation when ingestion lands. |
| UI | Tailwind CSS v4.3 · shadcn/ui (CLI v4, restyled, see Design.md) · Motion 13 (`motion/react`) · Phosphor | tokens in CSS variables; one Card primitive |
| Charts / maps | Observable Plot · d3-geo (36-district SVG) | engraved look, SVG-accessible, light; no WebGL needed for 36 polygons |
| i18n | next-intl (`en`, `mr`; `hi` later) | Marathi-first candidate flow |
| DB | **Supabase Postgres** + `pgvector` + `pg_trgm` + `pg_cron` | one managed box for relational data, vectors and schedules (a queue is unnecessary at our volume) |
| ORM | **Drizzle 0.45** + `postgres` 3.4 (`prepare: false`, pool size 1 on the 6543 transaction pooler; **migrations run over the 5432 session pooler**) | typed SQL, migrations in git; raw SQL for the heavy aggregates |
| Auth | Supabase Auth via `@supabase/ssr` 0.12 (`getClaims()` in `proxy.ts`, publishable key); roles in `app_metadata`; **RLS** on every table | institutes see their own courses; employers see only PRs routed to them |
| AI | Gemini via **AI SDK 7** (`ai` + `@ai-sdk/google`): `gemini-3.6-flash` for structured extraction, with automatic fallback to `gemini-3.1-flash-lite` on 503 (the `Output` API with Zod schemas); `gemini-embedding-2` (fallback `-001`) with `outputDimensionality: 768`, because pgvector HNSW caps at 2000 dimensions (if truncation isn't supported, store as `halfvec(3072)`) | the model id is stored on every extraction row, and changing models means a re-extraction job |
| Optimiser | **HiGHS** (WASM, `highs` npm) | the district training plan is an LP/MIP (§6.6) |
| Forecast | ETS/Holt–Winters in TS, with a seasonal-naive baseline | simple, explainable, always backtested (§6.5) |
| Jobs | **GitHub Actions cron** (free, long-running) → `packages/ingest` CLI; `pg_cron` for SQL rollups | no serverless timeouts; Vercel Hobby cron is only once a day |
| PDF | `@react-pdf/renderer` | training plans and course cards printable on A4 |
| Observability | `source_health_log` + `pipeline_run_log` tables (kept from the old repo), Sentry | the `/sources` page is built from these |
| Tests | Vitest (engine), Playwright (flows), golden-set eval for extraction | §9 |

### Repository layout (pnpm + Turborepo monorepo)

```
apps/web/                  Next.js 16 app
  app/(public)/            landing, candidate flow
  app/(console)/           state, districts, skills, courses, plans, radar, review, sources
  app/api/                 route handlers: ingest webhooks, revalidation, CSV/PDF export
  proxy.ts                 auth session refresh + role gating
packages/db/               Drizzle schema, migrations, seed (demo rows flagged is_demo)
packages/core/             PURE TS engine: scoring, gap, health, planner, forecast (no I/O, 100% unit-tested)
packages/ingest/           source adapters + normalise pipeline (CLI, run by Actions)
packages/ai/               prompts, Zod schemas, extraction + embedding clients, eval harness
packages/ui/               Card, CompareTray, EvidenceDrawer, Watermark… (Design.md §9)
legacy/                    the old Python pipeline, archived for reference
```

---

## 3. Data model (core)

The design rule is simple: **everything is a fact with provenance.** No number in the UI exists without rows that explain it.

```
geo_district(lgd_code PK, name_en, name_mr, division, geom, population, is_aspirational)
geo_alias(alias, lgd_code, source)            -- "Pimpri-Chinchwad"→Pune, "Navi Mumbai"→Thane/Raigad by pincode

occupation(nco_code PK, title, nsqf_level)    -- NCO-2015
skill(id PK, esco_uri, label_en, label_mr, kind[knowledge|skill|tool|transversal], embedding vector(768))  -- HNSW index
skill_alias(alias, skill_id, lang, source, confidence)
qualification(qp_code PK, title, nsqf_level, sector_ssc, hours, nco_code)  -- NQR / NSQF QPs
qp_skill(qp_code, skill_id, proficiency, hours)

source(id, kind, name, licence, freshness_sla_hours, weight_default)
raw_record(id, source_id, external_id, payload jsonb, content_hash, fetched_at)  -- immutable

posting(id, raw_id, title, employer_id, lgd_code, geo_confidence, nco_code, work_mode,
        exp_min, exp_max, salary_min, salary_max, posted_at, canonical_posting_id, is_duplicate)
posting_skill(posting_id, skill_id, requirement[required|preferred|optional],
              proficiency, evidence_sentence, negated, confidence, model_id, extracted_at)

employer(id, name, udyam_no, nic_code, lgd_code, size_band, verified)
udyam_fact(month, lgd_code, nic5, registrations, cumulative)        -- from the OGD Udyam feed
nic_nco_xwalk(nic5, nco_code, share, reviewed_by)               -- turns sector growth into occupation demand
survey_response(id, employer_id, lgd_code, nco_code, skill_id, importance, proficiency,
                expected_hires_12m, posting_to_hire_ratio, csat_recent_hires, weeks_to_productivity, collected_at)
consultation(id, lgd_code, sector, minutes_text, extracted jsonb, held_on)

institution(id, name, type[ITI|poly|PMKVY-TC|college], lgd_code, is_demo)
course(id, institution_id, qp_code|trade_code, name, seats, duration_h, is_demo)
course_skill(course_id, skill_id, proficiency, hours, module)
assessment_item(course_id, skill_id, method[theory|practical|viva|project], weight)   -- flags demanded-but-never-assessed skills
course_cohort(course_id, fy, enrolled, completed, placed_3m, placed_6m, median_wage)
trainer(id, institution_id, qp_codes[], certified_until)
equipment(id, institution_id, item_code, qty, condition)

-- analytical facts (materialised, rebuilt by the engine)
demand_fact(month, lgd_code, skill_id, proficiency, signal, value, n_obs)   -- signal ∈ 6 kinds
supply_fact(month, lgd_code, skill_id, proficiency, graduates_expected, placed_rate)
sdi(month, lgd_code, skill_id, proficiency, score, ci_low, ci_high, coverage)
course_health(course_id, month, relevance, placement, oversupply, obsolescence, validation, total, flag)

curriculum_pr(id, course_id, target[state-course|add-on-module|recommendation], diff jsonb, rationale jsonb,
              status[draft→employer-validated→approved→adopted], approver_body, opened_at, adopted_at)
pr_review(pr_id, employer_id, verdict[endorse|change|irrelevant], comment)
training_plan(id, lgd_code, fy, inputs jsonb, solution jsonb, objective, status, signed_by)
review_item(id, kind, ref_id, payload jsonb, status, decided_by)   -- low-confidence, unknown skill, dup
```

We reuse the good ideas from the existing `db/02_sprint1_migration.sql`: requirement level, `evidence_sentence`, `negated`, `confidence`, `model_id`, `description_hash`, the `is_demo` flag, and the source/pipeline health logs. They are ported into Drizzle, not thrown away.

---

## 4. Pipeline

**Stage 1: Fetch.** Each source is one adapter with the same interface:
`fetch(since) → RawRecord[]`, then `health()`. Adapters are rate-limit aware and resumable by cursor. Everything lands in `raw_record`, deduplicated on `(source, external_id)` and `content_hash`.

**Stage 2: Normalise.** Four steps:
1. **Location → LGD district.** Order of attempts: pincode (India Post API) → gazetteer alias → Nominatim → Gemini fallback. Each result carries a `geo_confidence`. Remote or unknown postings are kept but excluded from district facts.
2. **Title → NCO-2015.** Embedding nearest neighbour over NCO titles, re-ranked by Gemini, accepted if confidence ≥ 0.75, otherwise sent to `review_item`.
3. **Text → skills.** Gemini structured output (Zod) returns `{skill_text, requirement, proficiency, evidence_sentence, negated, years}`. Each `skill_text` is mapped to the canonical `skill` via exact alias → trigram → vector search (cosine ≥ 0.82). Anything else goes to the review queue as an *unknown skill candidate*. Deduplication by `description_hash` means we never pay twice for the same job description.
4. **Near-duplicate postings** (the same job on three boards) are found with MinHash over the description plus the same employer and district within 14 days. They collapse to `canonical_posting_id` and are counted once.

**Stage 3: Facts.** SQL rollups (scheduled by `pg_cron`, and also triggered at the end of each ingest run) rebuild `demand_fact`/`supply_fact` for the affected months. The ingest job then calls `POST /api/revalidate`, which runs `revalidateTag('district:<lgd>', 'max')` and `revalidateTag('skill:<id>', 'max')` (Next 16 requires the profile argument; this gives stale-while-revalidate). Only the affected cards refresh.

**Cadence:** postings every 6h · trends daily · OGD/Udyam weekly · surveys and placements on write (Server Action → `updateTag`).

---

## 5. Data sources (live-verified 2026-09-24)

"LIVE" means we got HTTP 200 with sensible data during the source audit. The full endpoint list, with resource IDs, is in `packages/ingest/sources.md` (to be created in M0).

**The key finding:** only **Udyam MSME registrations** give genuinely district-level, continuously updated Maharashtra demand through a public API. Every enterprise row carries an LGD district code, a pincode and a 5-digit NIC activity code, and the feed is 44.5M rows (Pune alone has 1.02M). Postings give us city level. Almost everything else is state level. The architecture is shaped around that fact:
- **Udyam is the district backbone.** We use NIC growth mapped through NIC→NCO→skill. The crosswalk is built once, then reviewed.
- **Postings add skill detail and freshness.**
- **Surveys and consultations** cover what neither of those can.
- **State-level supply figures** (PMKVY, ITI, NAPS) are apportioned to districts using Udyam and GDDP weights. They are **always labelled "estimated"** until DSEEI shares district data. That data request is an explicit ask in the pitch.

| Tier | Source | Feeds | Granularity | Auth / limits | Status |
|---|---|---|---|---|---|
| **1** | **JSearch** `GET /search-v2` (the old `/search` returns 404) | postings, with O*NET SOC codes | city + state, lat/lng | RapidAPI free: **200 req/month** | LIVE (Pune: 5 of 6 in-city; salary usually empty) |
| **1** | **data.gov.in: Udyam live feed** `8b68ae56-84cf-4728-a0a6-1be11028dea7` | sector growth, employer universe | **district (LGD) + pincode + NIC-5** | free personal key (the sample key is capped at 10 rows) | LIVE |
| **1** | **MoSPI eSankhyiki API** (PLFS, Economic Census, ASI, AISHE, NAS, IIP) | unemployment and wage priors by age, education, NCO; EC by district | state (PLFS) · district (EC) | none | LIVE (MH youth UR 2023-24: 10.8%) |
| **1** | **ESCO API** | skill taxonomy, occupation → essential/optional skills, multilingual | n/a | none | LIVE |
| **1** | **MH district GDP** (Economic Survey 2024-25, OpenCity CSV) | district growth weights | district | none (static) | LIVE |
| **1** | **India Post pincode API** + LGD (OGD resources / planemad dump) + datameet GeoJSON | geocoding, map | district | none | LIVE (GeoJSON is Census-2011, so reconcile to 36 LGD districts, e.g. Palghar) |
| **1** | **data.gov.in: PMKVY / NCS / ITI / NAPS / CTS** (`540faf36…`, `559e3da0…`, `63d81eb9…`, `d1e0d1fc…`, `7cc46a5e…`, `1144a2f5…`) | supply and placement baselines | state | free key | LIVE |
| **1** | **Gemini**: `gemini-3.6-flash` (fallback `gemini-3.1-flash-lite`), `gemini-embedding-2` | extraction, embeddings | n/a | key in `.env` | embeddings LIVE; flash returned 503 "high demand" during the audit, so **retry, backoff and model fallback are mandatory**. `gemini-2.5-flash` is closed to new users. |
| 2 | **Adzuna India** | postings + salary histograms | city | free key: 25/min, 250/day, 2,500/month | endpoint exists; untested with a key |
| 2 | **NQR / NSQF qualification packs** | QP → skills → hours → NSQF level | n/a | no API: one-time scrape of QP PDFs | site LIVE |
| 2 | **O*NET Web Services v2** | tasks and skills per SOC (joins JSearch `job_onet_soc`) | n/a | free registration | untested |
| 2 | GitHub search (with a token) · Stack Exchange · OpenAlex · arXiv · Crossref | Emerging-tech Radar | global / India | none or free key | LIVE (e.g. 122k GitHub users located in Pune) |
| 2 | Coursera catalogue (cache + our own semantic search) · SWAYAM/NPTEL (static import) | candidate course recommendations | n/a | none | Coursera listing LIVE; no search endpoint |
| 3 | HN Algolia "Who is hiring" · Wikipedia pageviews · npm / PyPI stats · dev.to | Radar colour | global | none | LIVE |
| 3 | World Bank API | national context | national | none | LIVE |
| 3 | Careerjet v4 · Jooble (500 requests, lifetime) · LinkedIn scrapers on RapidAPI | extra postings | city | partner keys | untested |
| — | Google Trends | — | — | unofficial endpoint returns 429; SerpAPI is paid | skipped |
| — | Lightcast Open Skills | — | — | nonprofit-only since April 2026 | skipped |
| — | NCS portal · Mahaswayam · Naukri · Apna · Indeed | — | — | **no public API**; scraping breaches their terms | **not scraped.** Mahaswayam and ITI district seat data are requested from DSEEI (the PS owner). |

**Quota maths.** JSearch's 200 req/month × ~10 jobs = ~2,000 postings/month, so it cannot be the backbone. Our budget:
- JSearch: **150 queries/month**, rotated over (6 focus sectors × 8 hero cities) query templates. 50 requests are held back for the demo.
- Adzuna: ~2,400 req/month at 50 results per page.
- Both feeds use cursor-based incremental fetches.
- Results are deduplicated by `description_hash` before any Gemini call.

**First-party sources, which carry the most weight in rural districts:** employer surveys, consultation minutes and placement uploads. No public API provides these.

---

## 6. The engine (`packages/core`): the actual intelligence

All pure functions, deterministic, unit-tested, and each one explains itself (it returns its contributing terms, not just a score).

### 6.1 Skill Demand Index (SDI)
We work at the grain of district *d*, occupation *o* (NCO), skill *s*, proficiency *p* and quarter *t*. Proficiency is **cumulative on both sides**. Demand "at p" means a hire needs **≥ p**, and supply "at p" means a course teaches to **≥ p**.

**Step 1: estimate each signal per district, shrinking it in its own units first.** For each signal *k* (postings, surveys, consultations, Udyam sector growth), with observation count `n_k` and rate `r_k`:
```
r̃_k(d) = ( n_k(d)·r_k(d) + m_k·r̃_k(division(d)) ) / ( n_k(d) + m_k )     -- same recursion division → state
```
`m_k` is a signal-specific prior strength, fitted by empirical Bayes. Each signal has its own `m_k` because 30 postings and 30 surveys carry different information. This single mechanism handles thin data, so **fusion weights are fixed** and there is no second "coverage shift" that would correct for thin data twice.

**Step 2: convert each signal to the same unit, expected hires in the next 12 months.**
- postings → hires uses a **posting-to-hire ratio** asked directly in the employer survey ("how many people did you hire per role you advertised online?"). It's reported as a range; that is our ground truth.
- Udyam: `Σ_nic Δregistrations(d,nic) · employment_per_unit(nic) · xwalk(nic→o)`. This is the only district-native signal in every district, so it anchors rural districts where postings are near zero.
- surveys: stated expected hires, reweighted by sector share of district employment (Economic Census).

**Step 3: fuse.**
```
hires(d,o,t) = Σ_k w_k · r̃_k(d,o,t)          w fixed, published on /sources, sums to 1
demand(d,o,s,≥p,t) = hires(d,o,t) · P(s at ≥p | o)   -- skill profile of o from postings + ESCO essential skills
coverage(d) = Σ_k w_k · n_k/(n_k+m_k)            0…1, drives the hatching on the map
```
**SDI is an absolute index,** not a percentile: `SDI = 100 · demand(d,s,t) / demand(state, s, base quarter 2026-Q4)`. It keeps its magnitude, so a skill can't "fall" merely because another rose. State rank is shown separately. Intervals come from a parametric bootstrap over each signal's posterior. Placement outcomes are **not** an SDI input; they belong to Course Health only, which avoids circularity.

### 6.2 Gap and Mismatch
```
supply(d,s,≥p) = Σ_d' M[d'→d] · Σ_{c in d'} seats_c · completion_c · teaches(c,s,≥p)
gap(d,s,p)   = demand(d,s,≥p) − supply(d,s,≥p)            ratio = demand / max(supply,1)
Mismatch(d)  = Σ_o |demand(d,o) − supply(d,o)| / Σ_o demand(d,o)     -- counted in PEOPLE per occupation, not summed over skills
```
- Migration and commuting are modelled **once**, by the spill-over matrix `M` (rows sum to 1, so Pune ITIs also serve Satara). `M` starts as a documented prior from Census-D migration tables and gets tuned with placement-location data. There is no separate out-migration term.
- The skill-level `gap` drives curricula. The occupation-level `Mismatch` drives seat planning. Summing over skills would count one hire several times.

### 6.3 Course Health (0–100) and flags
Each component is scored **0–100 on its own scale** and then weighted:

| Component | Weight | Measure (0–100) |
|---|---|---|
| Relevance | 35 | demand-weighted share of the target occupation's skills (at ≥ required p) the course teaches, in its catchment `M` |
| Outcomes | 30 | 6-month placement rate vs the trade's state median, **Beta-binomial shrunk** for small cohorts |
| Currency | 15 | 100 − hours-weighted share of course skills flagged *declining* (below) |
| Employer validation | 20 | Beta(2,2) prior (neutral 50) updated by endorsements and "change" requests |

- **Declining skill:** a Theil–Sen slope on **quarterly** SDI over ≥ 6 quarters is negative, with **Benjamini–Hochberg FDR q < 0.1 across all skills tested**, sustained for 2 consecutive quarters. This keeps false OBSOLETE flags low when hundreds of skills are tested.
- **Oversupply is a flag, not a score term.** It would double-penalise alongside Outcomes.

Flags, each with its evidence rows:
- **OBSOLETE**: Currency < 60
- **OVERSUPPLIED**: occupation ratio < 0.6 for 2 quarters
- **REVISE**: Relevance < 55
- **HEALTHY**: none of the above

We also track **assessment alignment**. Each course's assessment criteria (from the QP's Performance Criteria) are checked against the skills employers mark *Mandatory*. A skill that is taught but never assessed shows as a gap in the PR, which covers the PS's "assessment methods lag" point.

### 6.4 Curriculum Pull Request generator
1. Compute `missing = top-demand skills for target NCO – course skills` and `stale = course skills with falling SDI`.
2. Look up the NSQF QP and its hour budget. Propose `+add / −drop / ~resize` module edits that keep total hours within ±10%.
3. Gemini writes the *rationale text only*, and only from the computed numbers (a grounded prompt, with numbers passed as structured input). It cannot invent a skill that isn't in the diff.
4. The PR is routed to employers in the course's district and sector who answered a survey in the last 12 months. Their endorse/change verdicts feed back into Course Health (validation) and into the skill weights.
5. **Who can merge (governance).** NCVT trade syllabi are set nationally by DGT, so a state ITI cannot rewrite them. A PR therefore has a **target**, and each target has a named approver in its record, which is what "merged" means:
   - `state-course`: MSBSVET / MSSDS courses. Approved by the state board.
   - `add-on-module`: short-term or bridge modules layered on an NCVT trade, which the ITI or IMC can run.
   - `recommendation`: a formal note to DGT or the relevant Sector Skill Council, attaching the evidence pack.
6. The PR also emits **trainer and equipment deltas**: new skills map to QP-required trainer certifications and equipment lists. That gives the trainer-development and equipment-planning outputs the PS asks for.

### 6.5 Forecast and the Emerging-tech Radar
- **Forecast:** 6-month forecast per (district-division, skill) series with enough history, using ETS against a seasonal-naive baseline, chosen by rolling-origin backtest (sMAPE). The UI shows a band, and a short series shows "insufficient history". We never extrapolate a thin series.
- **Radar:** for each candidate term, compute growth in global signals (GitHub repos/stars, SO questions, OpenAlex papers, Wikipedia views), then India postings, then Maharashtra postings. The **lag** between curves ("global surge 14 months ago, Pune postings rising, no MH course teaches it") is the early-warning signal that courses should start *before* the local demand spike. New terms enter via the unknown-skill review queue.

### 6.6 District Training Plan (optimiser)
A mixed-integer program per district and financial year, solved with HiGHS. Every term is linear and the units are explicit.
```
sets        C courses (existing C⁰ ∪ candidates C⁺), Q trainer qualifications, S skills
variables   b_c ∈ ℤ≥0   batches of course c              x_c ∈ ℤ≥0  seats (trainees)
            y_c ∈ {0,1} open candidate course c ∈ C⁺       o_s ≥ 0    oversupplied completers of skill s
            t_q ∈ ℤ≥0   trainers of qualification q hired/certified    e_c ∈ ℤ≥0 equipment sets procured for c
maximise    Σ_c x_c·π_c·p⁰_c·(1 + α·min(wage_c/wage_med, 1.5))  −  λ·Σ_s o_s  −  μ·(Σ_q κ_q·t_q + Σ_c ε_c·e_c)
            π = completion rate; p⁰ = placement prob. at CURRENT supply (exogenous; saturation is handled by o_s,
            so it is not counted twice); wage enters only as a capped secondary bonus (α ≈ 0.2), so the objective is
            expected placements and doesn't herd seats into urban IT; μ = placements per ₹ lakh (policy parameter)
subject to  x_c ≤ B_c·b_c                                  seats fit in batches (B_c = batch size)
            Σ_c x_c ≤ SeatBudget
            b_c ≤ Bmax_c·y_c                    ∀c∈C⁺      candidate courses only if opened
            Σ_{c needs q} b_c·H_c ≤ Hours_q + H_hire·t_q  ∀q  trainer-hours (H_c = trainer hours per batch)
            b_c ≤ E_c + e_c                                 one equipment set per concurrent batch
            Σ_q κ_q·t_q + Σ_c ε_c·e_c ≤ CapexBudget
            o_s ≥ Σ_c x_c·π_c·teaches(c,s) − demand_s        ∀s   (linearised max(0,·))
            0.7·x_c,prev ≤ x_c ≤ 1.3·x_c,prev   ∀c∈C⁰ with x_c,prev>0   stability (new courses bounded by Bmax only)
```
- **Equity** (women, SC/ST, PwD): admissions reservation is a fixed per-course share, so it holds inside every x_c automatically. For *targeted* goals, e.g. women-majority batches in healthcare, we add group variables `x_c = Σ_g x_{c,g}` with `Σ_c x_{c,g} ≥ floor_g·Σ_c x_c` as an optional constraint set.
- **"Shadow prices"**: MIP has no duals. We report **marginal re-solves** instead ("+1 certified CNC trainer in Nashik → +38 expected placements"), computed by re-solving with each binding resource incremented by one.
- **Where trainer and equipment data comes from:** trainer requirements come from the NSQF QP "Trainer Prerequisites". Equipment comes from DGT/NCVT syllabus tool & equipment lists. We **hand-curate these for the top 40 trades** in the 6 focus sectors, and institute uploads report stock.

The output is a Training Plan card. It shows seat reallocations (slope chart), trainers to certify, equipment to procure, and expected placements with an interval. A human officer adjusts it and signs it, and the signed version is a PDF. Marginal re-solves are shown in plain language.

### 6.7 Candidate pathway
The candidate enters skills (text or voice in Marathi → Gemini → canonical skills). We rank reachable NCO roles by `SDI in home and commutable districts × skill overlap`. For the best 3 we show the gap skills, the nearest course that closes them (seats available), and free SWAYAM/NPTEL modules. No account is needed to explore; saving requires OTP login.

### 6.8 Outcome KPIs: did it work?
The PS lists expected outcomes. Each one is a tracked KPI with a baseline, shown before and after on `/state` and on each district card:

| PS outcome | KPI | Source |
|---|---|---|
| Stronger placement rates | 6-month placement rate by course, district and state | `course_cohort` |
| Reduced mismatch | Mismatch Index trend (§6.2) | engine |
| Improved employer satisfaction | **Employer CSAT** (1–5) on graduate job-readiness, plus **time-to-productivity** in weeks (this covers the PS's "productivity standards") | the survey asks both, each cycle |
| Timely course revision | median **days from PR opened → merged**; share of REVISE/OBSOLETE courses with an open PR | `curriculum_pr` |
| Better equipment and trainer planning | trainer and equipment gaps closed vs plan | `training_plan` vs uploads |
| Clearer career pathways | candidate paths generated → course enrolments (opt-in follow-up) | `/me` |

---

## 7. Next.js 16 application design

- **Rendering:** `cacheComponents: true`. Page shells are static. Data cards are async Server Components wrapped in `<Suspense>` with skeleton cards. Aggregate readers use `"use cache"`, `cacheLife('hours')`, and `cacheTag(...)` keyed by district and skill.
- **Cache boundary rule:** a `"use cache"` scope cannot read `cookies()`/`headers()`, even through a helper. So all public aggregates (`packages/db/readers/*`) take primitive arguments and use a *cookie-free* DB connection. Authenticated reads (Supabase client) stay outside the cache in thin wrappers. The default cache is in-memory per instance and is keyed by build ID. That's fine for aggregates that are cheap to recompute; the facts tables are the real cache.
- **Async request APIs:** always `await params` / `searchParams`. Use the `PageProps<'/districts/[lgd]'>` helpers.
- **Mutations:** Server Actions for surveys, PR reviews and plan edits, validated with Zod 4. They call `updateTag()` (Server-Action-only) so the author sees their own write immediately.
- **`proxy.ts`** (replaces `middleware.ts`; Node runtime): refreshes the Supabase session with `getClaims()`, forwards the `Cache-Control` headers from `setAll` so a CDN never caches one user's session and serves it to another, and gates `(console)` routes by role. Authorisation is still enforced by RLS in the database. The proxy is convenience, not security.
- **Route handlers:** `/api/revalidate` (HMAC-signed, called by ingest), `/api/export/[kind]` (CSV/PDF).
- **`after()`:** used for analytics and audit logging after the response is sent.
- **Streaming AI:** candidate "explain my path" and the PR rationale stream via the AI SDK, always from computed inputs.
- **Performance budgets:** `/state` LCP < 2.0s on 4G and < 170 KB JS. The candidate flow is < 150 KB JS. Maps are dynamic imports.

---

## 8. Security, privacy and governance

- **Secrets** stay in `.env` (local) and GitHub/Vercel encrypted env. Never in the repo. The service-role key is used only in `packages/ingest`, never shipped to the browser. Rotate the credentials that were shared in chat before any public demo.
- **RLS** policies per role: `official` (read all, sign plans), `institute` (read all aggregates, write only its own courses/cohorts), `employer` (write its own surveys/reviews), `candidate` (its own profile), `admin` (review queue).
- **DPDP Act 2023:** candidate PII is minimised (district plus skills; phone only for OTP), consent is recorded, and deletion is on request. Placement uploads are aggregated to cohort level. No individual trainee records are stored.
- **Integrity:** `is_demo` rows render a `SPECIMEN` watermark and are excluded from official exports. Every AI extraction stores its model id and confidence, and extractions below the confidence threshold never enter facts until reviewed.
- **Prompt injection:** job descriptions are untrusted input. They are passed as data, the output is schema-constrained, and no tool access is granted.
- **Source terms:** we respect robots and ToS. Portals without an API (Naukri, Apna, Mahaswayam) are not scraped without permission. We state this openly to the judges.

---

## 9. Quality and evaluation

- **Extraction golden set:** 300 hand-labelled Maharashtra postings (EN plus some Marathi). CI reports skill P/R/F1, negation accuracy and district accuracy. Target F1 ≥ 0.80.
- **Engine unit tests:** property tests for SDI (monotonic in demand; shrinkage bounded), a planner feasibility test and constraint satisfaction, and forecast backtests.
- **Playwright flows:** official → district → plan → PDF; employer → survey → PR review; candidate (mr) → path.
- **Data-quality checks** after every run: row deltas, null rates, share of postings geocoded, source freshness vs SLA. A breach marks cards as LAPSED.

---

## 10. Deployment

- **Web:** Vercel (region `bom1`, Mumbai; Fluid compute with the pool registered via `attachDatabasePool`) or any Node 20.9+ host. **DB:** the existing Supabase project (ap-south-1).
- **Ingest:** GitHub Actions cron workflows (they replace the old paused ones) running `pnpm ingest --source=<name>`.
- **Environments:** `local` (Supabase CLI + seed) · `preview` (per-PR, seeded demo data, SPECIMEN everywhere) · `prod`.
- **Demo resilience:** a nightly `pg_dump` snapshot and a "demo mode" that serves the last good facts if a source API is down on judging day.
