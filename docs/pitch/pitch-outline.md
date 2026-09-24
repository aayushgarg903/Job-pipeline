# Pitch outline: Kaushal Setu (SIH 2026 idea submission)

> PS 26134 · Govt. of Maharashtra · Maharashtra State Innovation Society · Dept. of Skills, Employment, Entrepreneurship and Innovation (DSEEI)
> "Challenges in aligning skill development programs with industry requirements and emerging job market demands"
> Content only. Visual build follows [Design.md](../Design.md) (cards, bone stock on linen, Cormorant SC names, one brass accent, signals always glyph + word).

## How to read this file

- 12 slides. Each has: **on-slide text** (what the judge reads), **speaker notes** (what we say), **visual** (what the designer builds).
- Every number on a slide comes from [Architecture.md §5](../Architecture.md) with its source named. Anything marked **(illustrative)** is an example of how the product talks, not a measured figure. Say "for example" out loud when you present those.
- Anything shown from the product with demo data carries the `SPECIMEN` watermark. Do not crop it out of screenshots.

### Mapping to the SIH idea template

SIH's idea template usually asks for six blocks. If the portal forces the short format, collapse the deck like this:

| SIH template block | Slides in this deck | If compressed to 6 slides, use |
|---|---|---|
| Title | 1 | Slide 1 |
| Proposed solution / idea | 2, 3, 4, 5, 6, 7 | Slide 2 + slide 4 (with 5 to 7 as three small cards) |
| Technical approach | 4, 8, 9 | Slide 9 (stack) with the pipeline strip from slide 4 |
| Feasibility and viability | 11 | Slide 11 |
| Impact and benefits | 10 | Slide 10 |
| Research and references | 12 | Slide 12 |

---

## Slide 1. Title

**On-slide text**
- KAUSHAL SETU
- *A bridge between what Maharashtra's employers need and what its ITIs teach*
- SIH 2026 · PS 26134 · DSEEI, Govt. of Maharashtra
- Team [TEAM NAME] · [College], [City]

**Speaker notes**
"Kaushal Setu means skill bridge. We built a system that listens to employers across all 36 districts, checks every course against what it hears, and ends with a training plan a district officer can sign. Three minutes from now you'll see a Nashik electrician course get a concrete fix and a signed plan."

**Visual**
The Card Case from Design §4.1, closed, on linen. One nimbus-stock state card half slid out, name line "M A H A R A S H T R A" in Cormorant SC, provenance line "36 districts · 6 signals · as of [MON YY]". Nothing else on the slide.

---

## Slide 2. The problem, in people

**On-slide text**
- A trainee finishes an electrician course in Nashik. The solar installer who's hiring is two streets away. The course never taught solar PV. *(illustrative)*
- An employer in Chakan needs someone who knows Fanuc CNC controls. The nearest batch learned on a machine the plant retired. *(illustrative)*
- A district office sets next year's seats from last year's seats.
- Maharashtra youth unemployment: **10.8%** (2023-24, PLFS via MoSPI eSankhyiki)

**Speaker notes**
"The PS says courses are designed from broad or historical occupation categories and lag what industry needs. Here's what that looks like on the ground. Nobody in this chain is careless. The ITI principal has no signal telling them solar is now a must-have in Nashik. The employer has no channel to say so. The district office has no tool that turns demand into seats, trainers and equipment. The result shows up in one number from MoSPI: 10.8% of young people in Maharashtra who want work don't have it. We are not claiming to fix that number alone. We're fixing the part where training and jobs sit two streets apart and don't talk."

**Visual**
Three bone-stock cards side by side, each a person (Trainee, Employer, District officer), each with one sentence on the verdict line and "(example)" in the provenance line. Below them, one nimbus card with "10.8%" top-right and provenance "PLFS 2023-24 · MoSPI eSankhyiki". No stock photos of people.

---

## Slide 3. Why job postings alone mislead

**On-slide text**
- Online postings describe Pune and Mumbai IT. Most of Maharashtra's work is MSME, manufacturing, agri-processing and informal. Those employers rarely post online.
- A postings-only dashboard would tell Gadchiroli it needs React developers.
- Our district backbone is **Udyam MSME registrations**: every row has an LGD district code, pincode and NIC-5 activity. **44.5M rows** nationally, **1.02M in Pune** alone (data.gov.in Udyam feed, checked 24 Sep 2026).
- Every district shows a **coverage score**. Thin data is hatched on the map and said out loud.

**Speaker notes**
"This is the slide we'd want you to remember. Most teams in this PS will scrape job postings and draw a heat map. Postings are a biased sensor. They're city-level at best, and they over-count white-collar metro jobs. When we audited public sources, only one gave us genuine district-level, continuously updated demand for Maharashtra: the Udyam MSME registration feed on data.gov.in. So Udyam is our backbone. Postings add skill detail and freshness. Employer surveys and consultations fill what neither can. And where we still don't know enough, the product says so. On the Gadchiroli card it reads: 'We've only seen a handful of job posts from here, so this leans on what local employers told us.' Honesty about coverage is a feature, not an apology."

**Visual**
Two district cards laid side by side (Compare on the Table, Design §4.2). Left: Pune, solid fill, provenance "postings · surveys · Udyam". Right: Gadchiroli, hatched, verdict line "Low signal. Survey-weighted." One oxblood hairline under the coverage field with the diff sentence. Small inset: the 36-district sepia choropleth with hatching.

---

## Slide 4. How it works

**On-slide text**
- **Six signals:** job postings · employer surveys · industry consultations · sector growth (Udyam) · emerging-tech trends · placement outcomes
- **One skill vocabulary:** ESCO skills ⟷ NSQF Qualification Packs ⟷ NCO-2015 occupations, so "CNC guy who knows Fanuc", an NCVT trade and a Marathi self-description land on the same skill
- **One engine:** demand by district, role, skill and proficiency, with honest uncertainty
- **Three outputs** a person can act on (next three slides)

**Speaker notes**
"Demand and supply speak different languages. Employers write informal job text. Courses are written as NCVT trades and NSQF Qualification Packs. Candidates describe themselves in Marathi. We map every source into one skill graph, using Gemini embeddings and a human review queue for anything below a confidence bar. Each signal is estimated per district and shrunk toward its division when data is thin. Then all six are converted into one unit, expected hires in the next 12 months, and fused with fixed, published weights. Placement outcomes are kept out of the demand number on purpose, so we don't grade courses against themselves."

**Visual**
A single horizontal strip of six small source cards on the left, feeding one skill card in the middle (name "C N C   P R O G R A M M I N G", code "ESCO · NSQF · NCO"), feeding three output cards on the right. Hairline arrows only. Caption under it in Inter: "Every number has rows behind it."

---

## Slide 5. Output 1 and 2: find the weak course, then propose the fix

**On-slide text**
- **Course Health card** (0 to 100) for every course: relevance to local demand, placement outcomes, currency of skills, employer validation
- Flags with evidence: `HEALTHY` · `REVISE` · `OVERSUPPLIED` · `OBSOLETE`
- **Curriculum Pull Request:** module-level edits within the NSQF hour budget. *+ Solar PV 30h · − legacy module · ~ resize* *(illustrative)*
- Local employers **endorse, request change, or mark not relevant**. Endorsements become seals on the card.

**Speaker notes**
"A chart that says 'solar is rising' changes nothing. So the output is a Curriculum Pull Request, borrowed from how software teams propose changes. It's a diff against the course: add this module, drop that one, resize this one, keeping total hours within 10% of the QP budget. Gemini writes only the rationale text, from numbers we computed. It can't invent a skill that isn't in the diff. And we know who can approve what. NCVT syllabi are set nationally by DGT, so a state ITI can't rewrite them. Every PR has a target and a named approver: a state course goes to the state board, an add-on module can be run by the ITI or its IMC, and anything touching an NCVT trade goes to DGT or the Sector Skill Council as a formal recommendation with the evidence pack attached."

**Visual**
Left: a course card, code "NCVT · ELECTRICIAN", figure "54" top-right, verdict "◆ REVISE" in ochre with the word. Right: the DiffBlock from Design §4.3, set in card type, with + lines in banker's green and − lines in oxblood, each with its evidence note. Three embossed seals at the bottom labelled "Endorsed by local employers (SPECIMEN)".

---

## Slide 6. Output 3: the District Training Plan

**On-slide text**
- Seats, trainers and equipment for one district and one financial year, from an optimiser with real limits: seat budget, trainer-hours, equipment sets, capital budget
- Maximises **expected placements**, not wages. Wage is a small capped bonus, so seats don't herd into urban IT.
- Plain-language what-ifs: "+1 certified CNC trainer in Nashik → + N expected placements"
- A district officer adjusts it, signs it, and prints it on A4

**Speaker notes**
"This is where the PS asks for capacity planning, trainer development and equipment planning. The District Training Plan is a mixed-integer program solved with HiGHS. It respects seat budgets, trainer-hours by qualification, one equipment set per concurrent batch, and a capital budget. It can't swing an existing course by more than 30% in a year, because institutes can't absorb that. Equity reservations hold inside every course, and targeted goals like women-majority healthcare batches are an optional constraint. The officer sees seat shifts as a slope chart, the trainers to certify, and the equipment to buy. They change what they disagree with and sign. The signed PDF is the thing that goes into the file."

**Visual**
Training-plan card on nimbus stock, code "NASHIK · FY27", figure "expected placements" with an interval. Beside it, the PlanSlope chart (Design §6): oxblood lines for cuts, green for additions, labels at both ends. Under it, two small lists on bone stock: "Trainers to certify" and "Equipment to procure". A signature line at the bottom. All data SPECIMEN.

---

## Slide 7. The candidate path, in Marathi

**On-slide text**
- "तुमची कौशल्ये तुम्हाला नाशिकमध्ये कुठे नेऊ शकतात" *(Here's where your skills can take you in Nashik)*
- A trainee types her skills in Marathi. She gets 3 role cards nearby, the gap skills, and the nearest course with a seat. *(illustrative persona)*
- Free SWAYAM / NPTEL modules for the gap
- No account to explore. OTP only if she saves. Phone and district, nothing more.

**Speaker notes**
"The same intelligence goes to candidates, in their language, on a phone, on a slow connection. No map, cards only, under 150 KB of JavaScript. She types something like 'मी ITI मधून इलेक्ट्रिशियन कोर्स केला आहे, वायरिंग येते, सोलर थोडं शिकले'. We map that to canonical skills and rank roles by demand in her home and commutable districts times how much of the role she already covers. We never show 'readiness 62%'. We show 'You're two skills away from solar installer jobs in Nashik. Here's the nearest ITI batch with seats.' ESCO has no Marathi labels, so we translate the top ~800 skills with Gemini and have a person review them."

**Visual**
A phone frame (375px) showing three eggshell candidate cards in Devanagari (Tiro Devanagari Marathi name lines, no tracking), each with a role, a "2 skills away" verdict, and "nearest seat" line. EN / मराठी switch visible in the top bar.

---

## Slide 8. Data sources we actually hit

**On-slide text**
- **Live-verified 24 Sep 2026:** Udyam feed (data.gov.in) · MoSPI eSankhyiki (PLFS, Economic Census) · ESCO API · MH district GDP (Economic Survey 2024-25) · India Post pincode + LGD · data.gov.in PMKVY / NCS / ITI / NAPS / CTS · JSearch `/search-v2` · GitHub, Stack Exchange, OpenAlex
- **Limits we plan around:** JSearch free tier is 200 requests/month; Adzuna 2,500/month
- **Not scraped:** Naukri, Apna, NCS portal, Mahaswayam. No public API, and scraping breaches their terms.
- **Asked for:** district ITI seats, placement tracer data, Mahaswayam vacancies, from DSEEI

**Speaker notes**
"Every source on this slide returned real data during our audit on 24 September. We're also honest about limits. JSearch's free tier is 200 requests a month, roughly 2,000 postings, which is exactly why postings can't be the backbone. Supply data is the hard part: PMKVY, ITI and NAPS figures on data.gov.in are state-level. We spread them to districts using Udyam and district GDP weights and label every one of them 'estimated' until DSEEI shares district data. We've written that request. It's in our field kit, and it's the one thing that would make this system most accurate fastest."

**Visual**
A grid of small source cards (Design `/sources` page), each with a status word: `LIVE`, `LIMITED`, `REQUESTED`, `NOT SCRAPED`, plus the glyph. Provenance line on each: granularity (district / city / state).

---

## Slide 9. Technical approach and stack

**On-slide text**
- **Web:** Next.js 16 · React 19 · Tailwind v4 · next-intl (English, Marathi) · Observable Plot + d3-geo 36-district map
- **Data:** Supabase Postgres (Mumbai region) + pgvector + pg_cron · Drizzle · row-level security for every role
- **AI:** Gemini structured extraction with schema-checked output and model fallback · Gemini embeddings for skill matching
- **Engine:** pure TypeScript, unit-tested: demand index, gap, Course Health, ETS forecast · HiGHS optimiser for the plan
- **Jobs:** GitHub Actions cron ingest · every fact stores source, fetch time and hash

**Speaker notes**
"One language end to end, TypeScript, because a six-person team can't maintain two stacks. The engine is pure functions with no I/O, fully unit-tested, and every function returns its contributing terms, not just a score. That's what powers the Evidence Drawer: tap any number and see the rows. Gemini does two jobs only: turn messy text into structured skills, with the evidence sentence it came from, and write rationale text from numbers we computed. Every extraction stores the model id and a confidence, and anything below the bar goes to a human review queue instead of into the facts. Hosting is in Mumbai. Roles are enforced in the database, not just the UI."

**Visual**
The pipeline from Architecture §1 redrawn as five stacked nimbus cards: RAW → NORMALISE → SKILL GRAPH → FACT TABLES → ENGINE, with the app card on top. Tech names in IBM Plex Mono on each card's code line.

---

## Slide 10. Impact: measured against the PS's own outcomes

**On-slide text**
| The PS expects | We track | From |
|---|---|---|
| Stronger placement rates | 6-month placement rate by course, district, state | cohort uploads |
| Reduced mismatch | "How far training is from jobs" (Mismatch Index) trend | engine |
| Improved employer satisfaction | employer rating of recent ITI/PMKVY hires (1 to 5) + weeks to productivity | every survey cycle |
| Timely course revision | median days from PR opened to merged; share of flagged courses with an open PR | PR log |
| Better equipment and trainer planning | trainer and equipment gaps closed vs plan | plan vs uploads |
| Clearer career pathways | candidate paths generated → course enrolments (opt-in) | candidate flow |

**Speaker notes**
"We took the expected outcomes line from the PS and made each one a number with a baseline. Two of them come straight from the employer survey: how satisfied employers are with recent ITI and PMKVY hires, and how many weeks a new hire takes to become productive. That second one is how we cover the PS's 'productivity standards'. We're not putting targets on this slide, because we don't have baselines yet and we won't invent them. What we commit to is that every KPI shows a before and after on the state page and on every district card, from the first survey cycle."

**Visual**
Six small KPI cards in a 3×2 grid, each with the PS phrase as its title line (italic) and "baseline: first survey cycle" in the provenance line. No fake numbers in the figure slot: it reads "BASELINE PENDING" in small caps until the first survey cycle lands.

---

## Slide 11. Feasibility, risks, and what we do about them

**On-slide text**
- **Built on what exists:** every Tier-1 source returned data in our audit; the stack runs on free and entry tiers for the pilot
- **Risk: few postings outside Pune and Mumbai.** Udyam backbone, shrinkage to division, surveys, and the coverage score shown on every card
- **Risk: no public district supply data.** Labelled estimates, institute uploads, formal request to DSEEI
- **Risk: AI extracts a skill that isn't there.** Evidence sentence required, confidence gate, 300-posting golden set in CI, target F1 ≥ 0.80
- **Risk: API down on demo day.** Nightly snapshot and a demo mode that serves the last good facts

**Speaker notes**
"Feasibility first: this isn't a design on paper. We audited every source before writing a line of the architecture, and the ones marked live returned real Maharashtra data. Then the risks, in the order we worry about them. Thin rural data is the biggest, and it's why the whole design is coverage-aware. Supply data is second. Without DSEEI's district numbers, supply is an estimate, and it says 'estimated' on the card. AI hallucination is third. We make the model quote the sentence it read, drop anything low-confidence into a review queue, and measure extraction against 300 hand-labelled Maharashtra postings on every build. Our target is F1 of 0.80. We'll show you the real number at the finale, whatever it is."

**Visual**
Risk register from Plan §5 as a column of five cards. Each: risk name on the name line, likelihood and impact as small caps in the code slot, mitigation as the verdict line. Signal colours with words: `HIGH`, `MED`.

---

## Slide 12. Team, plan, and references

**On-slide text**
- **Six people, one owner per part:** Engine · Data and ingest · AI and skill graph · Frontend · Candidate flow, Marathi and PDF · Domain and pitch (surveys, ITI data)
- **Six weeks from 28 Sep:** foundations → demand live → supply and alignment → the workflow (surveys, PRs, plans) → candidates and radar → hardening
- **Already moving:** employer survey to MCCIA, NIMA and ITI placement cells (target 25 responses by 18 Oct, 50 by early Nov) · data request to DSEEI · 2 pilot institutes
- **References:** see list below

**Speaker notes**
"We split the work so no two people own the same package. The most important role on the team isn't technical: it's the person running real employer surveys and talking to ITI placement cells. Our demo depends on real responses, and we'd rather show you 25 real employer voices than 2,500 scraped postings. The ask we're making of DSEEI is on the last line: share district ITI seats, placement tracer data and Mahaswayam vacancy data under a hackathon data-sharing arrangement, and in return every district gets this dashboard free."

**Visual**
Six eggshell person cards in a row, each with the role on the name line and "[Name]" on the title line. Under them, a six-segment milestone strip (M0 to M5) as hairline-ruled ledger columns. References in 12px Inter at the bottom, or on a backup slide if they don't fit.

### Research and references (for the slide or backup)

1. Problem statement 26134, SIH 2026. Govt. of Maharashtra, MSInS, DSEEI.
2. Udyam Registration live feed, data.gov.in, resource `8b68ae56-84cf-4728-a0a6-1be11028dea7`. Row counts as observed 24 Sep 2026.
3. Periodic Labour Force Survey (PLFS) 2023-24, via MoSPI eSankhyiki API. Maharashtra youth unemployment rate 10.8%.
4. MoSPI Economic Census (district establishment counts), via eSankhyiki.
5. ESCO (European Skills, Competences, Qualifications and Occupations) API, skill and occupation taxonomy.
6. National Classification of Occupations 2015 (NCO-2015), Ministry of Labour and Employment.
7. National Qualifications Register (NQR) and NSQF Qualification Packs, NCVET.
8. DGT / NCVT trade syllabi and tool and equipment lists.
9. Maharashtra Economic Survey 2024-25, district domestic product (via OpenCity CSV).
10. data.gov.in datasets for PMKVY, NCS, ITI, NAPS and CTS (state level).
11. Local Government Directory (LGD) codes; India Post pincode API; datameet district GeoJSON.
12. Digital Personal Data Protection Act, 2023.
13. Guidelines for Indian Government Websites (GIGW 3.0).
14. HiGHS open-source linear and mixed-integer optimisation solver.
