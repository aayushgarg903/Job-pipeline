# Plan.md — Kaushal Setu

> Build plan for SIH 2026 · PS 26134. Read [Architecture.md](./Architecture.md) for the *what* and [Design.md](./Design.md) for the *look*.
> Dates assume a start of **Mon 28 Sep 2026**. Adjust them to the official SIH idea-submission and finale dates once they are announced.

---

## 1. What we're building (one paragraph for the pitch)

**Kaushal Setu** turns six streams of labour-market evidence into three things a Maharashtra district office can act on. The streams are job postings, employer surveys, industry consultations, sector growth, emerging-tech trends and placement outcomes. The outputs are:
1. a **Course Health card** for every course, flagging obsolete and oversupplied ones;
2. **Curriculum Pull Requests**: concrete module-level edits that local employers endorse;
3. an optimised **District Training Plan**: seats, trainers and equipment, printable and signable.

Candidates get the same intelligence as a Marathi-first "next card" career path.
The differentiators are: coverage-aware fusion (we don't pretend postings describe rural districts), a single ESCO⟷NSQF⟷NCO skill graph, and a workflow that ends in a signed plan rather than a chart.

---

## 2. Decisions already made

| Decision | Chosen | Rejected, and why |
|---|---|---|
| Framework | Next.js 16 monorepo (TS end-to-end) | keeping the Python pipeline: two languages and two deploys for a 6-person hackathon team. Its logic is ported, and the code is kept in `legacy/`. |
| DB | existing Supabase project + pgvector/pg_cron | separate vector DB or queue: more moving parts, no gain at this scale |
| Scheduler | GitHub Actions cron | Vercel cron: function timeouts during long ingests |
| Demand sensor | fused 6 signals with coverage weighting | postings-only: biased to metros and IT |
| Taxonomy | ESCO skills + NSQF QPs + NCO-2015 | free-text skills: impossible to compare supply with demand |
| Planner | HiGHS LP/MIP | heuristic ranking: can't respect trainer and equipment constraints |
| Design | the "card" system (Design.md) | generic SaaS dashboard |

---

## 3. Team (SIH team of 6)

| Role | Owns | Primary paths |
|---|---|---|
| **A: Lead / Engine** | SDI, gap, health, planner, forecast | `packages/core` |
| **B: Data / Ingest** | adapters, geocoding, dedup, facts SQL | `packages/ingest`, `packages/db` |
| **C: AI** | extraction prompts, embeddings, skill graph, golden-set eval | `packages/ai` |
| **D: Frontend lead** | Card system, compare tray, charts, map | `packages/ui`, `apps/web/(console)` |
| **E: Frontend / i18n** | candidate flow, employer survey, Marathi, PDF | `apps/web/(public)`, `messages/` |
| **F: Domain / Pitch** | employer surveys (real ones!), ITI data, pitch deck, demo script | `docs/`, `data/seed/` |

Rule: one owner per package. Shared files (`package.json`, lockfile, `drizzle` migrations) are edited only by A or B.

---

## 4. Milestones

### M0: Foundations (Week 1 · 28 Sep → 4 Oct)
- [ ] Rotate the DB password and the Gemini and RapidAPI keys (they were shared in chat, and the RapidAPI key is **hardcoded in the committed `test_loc.py` on GitHub**). Delete `test_loc.py`. Put the new keys in GitHub Actions secrets and Vercel env.
- [ ] Register free keys: **data.gov.in** (personal key; the sample key is capped at 10 rows), **Adzuna**, **O*NET v2**, a GitHub token, a Stack Exchange key.
- [ ] Send DSEEI a formal data request: district-wise ITI trade seats, placement tracer data, Mahaswayam vacancies. None of it is public, and asking for it is part of the pitch.
- [ ] Fix `.gitignore` (it is partly UTF-16, so the `node_modules`/`data` rules are silently broken).
- [ ] Move the Python pipeline to `legacy/`. Scaffold the pnpm + Turborepo monorepo with `apps/web` (Next 16, `cacheComponents: true`), `packages/{db,core,ingest,ai,ui}`.
- [ ] Drizzle schema from Architecture §3. Port the good columns from `db/02_sprint1_migration.sql`. Enable `vector`, `pg_trgm`, `pg_cron`.
- [ ] Load geography: 36 MH districts (LGD codes, en/mr names, GeoJSON), plus the pincode→district table.
- [ ] Load taxonomy: NCO-2015, ESCO skills (English only; **ESCO has no Marathi labels**, so we translate the top ~800 skills ourselves with Gemini, then review), NSQF QPs for the 6 target sectors (§6).
- [ ] **Start the employer survey now** (F): a Google Form mirror of the in-app survey goes out to MSMEs in Pune, Nashik and Chh. Sambhajinagar via MCCIA, NIMA and ITI placement cells. The target is ≥ 25 responses by 18 Oct, because demo steps 3–4 depend on them.
- [ ] **Institute data-sharing** (F + A): sign up ≥ 2 real institutes (one ITI, one PMKVY TC) to share courses, cohorts, placements, trainers and equipment by **11 Oct**. If that doesn't happen, the supply side runs on SPECIMEN data and we say so.
- [ ] Design tokens + `Card` primitive + Storybook-style `/dev/cards` page.
- **Exit:** `pnpm dev` shows real district cards with SPECIMEN watermarks. CI (typecheck, lint, test) is green. The survey is live, and institute outreach has started.

### M1: Demand signal live (Week 2 · 5 → 11 Oct)
- [ ] Adapters: **Udyam (data.gov.in)**, JSearch `/search-v2` (150 req/month budget), Adzuna IN, MoSPI eSankhyiki (PLFS + EC), with health logging and cursors.
- [ ] NIC-5 → NCO-2015 → skill crosswalk for the 6 focus sectors (Gemini-drafted, human-reviewed). This makes Udyam growth a district skill-demand signal.
- [ ] Normalise: location→LGD (pincode→alias→Nominatim→LLM), title→NCO, skills extraction (Gemini structured output), MinHash dedup.
- [ ] Golden set v1: 150 labelled postings. Eval script in CI.
- [ ] `demand_fact` rollups plus `/api/revalidate` with `revalidateTag`.
- [ ] Screens: `/state` (choropleth + district cards), `/skills/[id]`.
- **Exit:** Udyam growth facts for all 36 districts. ≥ 2,500 de-duplicated Maharashtra postings (JSearch + Adzuna quotas allow ~4k/month), ≥ 85% geocoded to a district, extraction F1 ≥ 0.75.

### M2: Supply and alignment (Week 3 · 12 → 18 Oct)
- [ ] Supply ingest: PMKVY / ITI / NAPS / CTS (data.gov.in, **state level**), apportioned to districts by Udyam + GDDP weights and **labelled "estimated"**. Institute CSV upload (template provided) replaces the estimates as real data arrives.
- [ ] Course→skill mapping via QP, with institute override.
- [ ] Engine: SDI with shrinkage + CI, Gap/Mismatch, Course Health + flags. 100% unit-tested.
- [ ] Screens: `/districts/[lgd]`, `/courses/[id]`, **Compare on the Table**, Evidence Drawer.
- **Exit:** every course card has a health score whose Evidence Drawer lists its rows. Pune vs Gadchiroli comparison works.

### M3: The workflow (Week 4 · 19 → 25 Oct)
- [ ] Employer survey (≤ 6 min, autosave, en/mr) and consultation-minutes upload → extraction.
- [ ] Curriculum PR generator + employer inbox (endorse / change / irrelevant) feeding validation.
- [ ] District Training Plan: HiGHS model, trainer and equipment deltas, slope chart, signed PDF.
- [ ] Sector growth (Udyam by district) and placement signals fused into SDI with coverage weights.
- **Exit:** the end-to-end demo script (§7) runs without manual DB edits.

### M4: Intelligence and candidates (Week 5 · 26 Oct → 1 Nov)
- [ ] Emerging-tech Radar, **curated**: global series (GitHub, Stack Exchange, OpenAlex; years of history exist) for ~20 hand-picked terms, overlaid on the MH postings collected so far. The full automated lag model is in §8.
- [ ] Forecast only on **Udyam registrations**, which have history since 2020. Posting-based forecasts wait until ≥ 24 months of postings exist.
- [ ] Candidate flow `/me`: Marathi-first, **text** skills → top-3 roles → gap → nearest course + SWAYAM/NPTEL.
- [ ] `/outcomes` KPI cards (Architecture §6.8).
- [ ] `/review` queue and `/sources` health page.
- **Exit:** Lighthouse ≥ 90 (a11y, perf) on `/state` and `/me`. Golden set v2 (300) F1 ≥ 0.80.

### M5: Hardening and pitch (Week 6 · 2 → 8 Nov, then freeze)
- [ ] Employer surveys wave 2: push to **≥ 50 responses**, plus 2 recorded industry consultations (F owns). This is our strongest credibility asset.
- [ ] Demo mode (last-good snapshot), print stylesheet, OG card images.
- [ ] Security pass: RLS tests per role, secret scan, prompt-injection tests on extraction.
- [ ] Pitch deck + 3-minute video + judge Q&A sheet (bias, data rights, scale, cost).
- **Exit:** feature freeze. Only fixes after this.

---

## 5. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Few MH postings outside Pune/Mumbai | High | High | coverage weighting + shrinkage + surveys; show it honestly as a feature |
| JSearch free tier is only 200 req/month; Adzuna 2,500 | Certain | Med | Udyam is the district backbone, not postings; query-template rotation; `description_hash` cache; nightly snapshot |
| Gemini flash 503 "high demand" (seen during the audit) | High | Med | retry + backoff + fallback to `gemini-3.1-flash-lite`; the extraction queue is resumable |
| No public district-level supply data (ITI seats, placements) | Certain | High | apportioned estimates, clearly labelled; institute uploads; DSEEI data request |
| data.gov.in resources stale or rate-limited | Med | Med | resource IDs already verified (Architecture §5); personal key; local mirror of pulled slices |
| Gemini hallucinated skills | Med | High | evidence sentence required, confidence gate, golden-set CI, review queue |
| NSQF QP data hard to parse | Med | Med | start with 6 sectors (§6) and hand-curate the top 40 QPs |
| Scope creep | High | High | this plan is the scope; anything new goes to §8 "Later" |
| Keys leaked (they were pasted in chat) | Happened | High | rotate in M0 |
| Demo-day API outage | Med | High | demo mode serves the snapshot; the demo script uses a cached district |

---

## 6. Scope guard: focus sectors for the demo

These six sectors cover most of Maharashtra's formal and semi-formal skilled hiring, and they are where both the data and the ITI supply exist:
1. **Automotive & capital goods** (Pune–Chakan, Aurangabad/Chh. Sambhajinagar, Nashik): CNC, fitter, welding, EV
2. **IT-ITeS & data** (Pune, Mumbai, Navi Mumbai): data analyst, cloud, support
3. **Electronics & electrical** (Pune, Nagpur): electrician, solar PV installer, EV technician
4. **Logistics & warehousing** (Bhiwandi/Thane, Nagpur MIHAN): warehouse ops, supply-chain executive
5. **Food processing & agri** (Nashik, Kolhapur, Latur): food-safety supervisor, cold-chain
6. **Healthcare** (statewide): GDA, lab technician, pharmacy assistant

Hero districts for the demo: **Pune** (rich data), **Nashik** (mixed), **Gadchiroli** (thin data, aspirational district). That trio shows the coverage story.

---

## 7. The demo script (what the judges see, ~6 minutes)

1. **The Card Case.** The state card slides out. "36 districts, 4,812 postings this month, 27 employers surveyed." Open the Official persona.
2. **The map.** The Mismatch Index choropleth. Gadchiroli is hatched ("low signal, survey-weighted"). This is the honesty beat.
3. **Compare on the Table.** Pull two "Electrician" ITI course cards, Nashik vs Pune. The difference is highlighted: Nashik doesn't cover solar PV and EV charging, which 14 local employers rank *Mandatory*.
4. **Curriculum PR.** Open the generated diff (+Solar PV 30h, −legacy module, ~resize). Show 3 real employer endorsements (seals).
5. **Training Plan.** Run the Nashik FY27 plan. Seats shift from an oversupplied trade to EV and solar. Show the trainer certifications and equipment list, then sign it as a PDF.
6. **Radar (curated example).** "Battery management systems": a global surge in GitHub and papers, first Pune postings appearing, and no MH course teaches it yet. That's the early warning.
7. **Candidate, in Marathi.** A trainee in Nashik types her skills. She gets 3 role cards, a gap and the nearest seat.
8. **Evidence.** Tap any number and the drawer shows the postings, with the evidence sentence highlighted. "Nothing here is a black box."

---

## 8. Later (explicitly out of scope for SIH)

Automated Radar lag model · posting-based forecasting · Hindi UI · Marathi voice input · OG card images · pgmq queues · MapLibre pan/zoom maps · shared-element page transitions · WhatsApp bot for candidates · Mahaswayam integration (requires MoU) · wage forecasting · trainer marketplace · state-level budget optimiser across districts · offline Android app.

---

## 9. Definition of done (every PR)

Typecheck, lint and tests green · engine changes include unit tests · UI changes checked at 375/1024 in both themes and in Marathi · no secrets in the diff · any new number in the UI has an Evidence Drawer path · any new source has a `source` row with a licence and a freshness SLA.
