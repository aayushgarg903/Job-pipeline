# Judge Q&A: 25 hard questions

> Answer in two or three sentences, then stop. If the judge wants more, they'll ask.
> Only use numbers from [Architecture.md §5](../Architecture.md) and name the source. If you don't know, say "we don't know yet, here's how we'll find out".
> The person who owns the area answers: Engine (A), Data (B), AI (C), Frontend (D/E), Domain (F).

---

## Data, bias and coverage

**1. Your job postings come from Pune and Mumbai. Aren't you just going to tell rural districts to train IT people?**
No, and that's the problem we designed around. Postings are one signal of six. The district backbone is Udyam MSME registrations, which carry an LGD district code and NIC activity code on every row, so every one of the 36 districts has native demand data. Where postings are thin, each signal shrinks toward its division's value, and the card is hatched and says "low signal, survey-weighted".

**2. How much data do you actually have for a district like Gadchiroli?**
Honestly, not much from postings, and the card says so with a count ("we've seen N job posts from here"). What it does have is Udyam registrations by NIC code and whatever local employers tell us in the survey. The coverage score (0 to 1) is shown on every district card, so an officer never mistakes a thin estimate for a solid one.

**3. Udyam is registrations, not hiring. How does a registration become demand for a skill?**
We take the change in registrations per district and NIC-5 code, multiply by employment per unit for that NIC, and map NIC to NCO-2015 occupations through a crosswalk, then to skills through the occupation's skill profile. The crosswalk is drafted with Gemini and reviewed by a person, and the reviewer is stored on each row. It's an approximation, which is why it's fused with surveys and postings rather than used alone.

**4. What about the informal sector? Most of Maharashtra's workers aren't on Udyam or job boards.**
That's true, and no public API covers it. That's why the employer survey and recorded industry consultations carry the most weight in rural districts, and why we're going through MCCIA, NIMA and ITI placement cells to reach small employers. We'd also say it plainly: informal hiring is the part we see least, and the coverage score reflects that.

**5. Where's your supply data?**
State-level PMKVY, ITI, NAPS and CTS figures from data.gov.in, spread to districts using Udyam and district GDP weights. Every one of those numbers is labelled "estimated" on screen. They get replaced as real data arrives from institute CSV uploads (we're signing up at least two pilot institutes) and from DSEEI, where we've sent a formal request for district-wise ITI seats and placement tracer data.

**6. Your SDI and weights look arbitrary. Who decided postings are worth X and surveys Y?**
The fusion weights are fixed and published on the `/sources` page, so anyone can see and challenge them. Thin data is handled once, by empirical-Bayes shrinkage inside each signal, not by fiddling weights per district. If DSEEI wants different weights, changing them is a config change, and every card shows which signals it rests on.

**7. How do you know your demand numbers are right?**
For the posting signal we ask employers directly how many people they hired per online posting, which gives a ground-truth range for converting postings into hires. Forecasts are backtested against a seasonal-naive baseline, and short series show "insufficient history" instead of a line. The honest answer on overall accuracy is that it can only be checked against placements over time, which is why placement rate is tracked as a KPI and kept out of the demand number itself.

---

## Governance and curricula

**8. NCVT syllabi are set nationally by DGT. A state can't change them. So who approves your Curriculum PR?**
Right, and every PR carries a target with a named approver. A state course (MSBSVET / MSSDS) goes to the state board. An add-on or bridge module on top of an NCVT trade can be run by the ITI or its IMC. Anything that touches the NCVT trade itself becomes a formal recommendation to DGT or the relevant Sector Skill Council, with the evidence pack attached.

**9. Why would an ITI principal act on this?**
Because it's specific and it's backed by local voices: "add 30 hours of solar PV, 14 Nashik employers say it's a must-have" (illustrative) is something a principal can take to the IMC. And the PR doesn't only say what to teach. It also lists the trainer certifications and equipment the change needs, which is usually the real blocker.

**10. Does a district officer have time for this?**
The officer's job ends in one artifact: a District Training Plan they adjust and sign, printable on A4. Everything else is there to explain that plan when someone asks "why". We designed the screens around the next action ("sign the plan", "share with the ITI principal"), not around exploring charts.

**11. Your optimiser will just push seats toward whatever pays most.**
It maximises expected placements, not wages. Wage is a small secondary bonus that stops growing at 1.5 times the median wage, so it can't herd seats into urban IT. There's also a stability limit: an existing course can't move more than 30% up or down in a year, and equity reservations hold inside every course.

---

## AI and evaluation

**12. LLMs hallucinate. How do you stop Gemini inventing skills?**
Four ways. Output is schema-constrained, and every extracted skill must come with the evidence sentence it was read from. Anything below a confidence threshold goes to a human review queue instead of into the facts. And for the Curriculum PR, Gemini only writes the rationale text from numbers we computed, so it can't add a skill that isn't in the diff.

**13. How do you measure extraction quality?**
A golden set of 300 hand-labelled Maharashtra postings, English and some Marathi. CI reports skill precision, recall and F1, negation accuracy ("no experience in X needed") and district accuracy on every build. Our target is F1 ≥ 0.80. It's a target, not a result yet, and we'll show the real number at the finale whatever it is.

**14. What happens when Gemini is down?**
It happened during our own source audit: flash returned 503 "high demand". Extraction has retry, backoff and automatic fallback to a lighter model, and the queue is resumable. The dashboards don't call Gemini at all at view time; they read computed facts. On demo day we also run from a nightly snapshot.

**15. Prompt injection: a job posting could contain "ignore previous instructions".**
Job descriptions are treated as untrusted data. They're passed as data, not instructions, the output must match a schema, and the extraction step has no tool access. The worst an injected posting can do is get its own row rejected or sent to review.

---

## Privacy and security

**16. DPDP Act 2023. What personal data do you hold, and how is it protected?**
As little as we can. Candidates: district, skills, and a phone number only if they choose to save (for OTP). Consent is recorded and deletion is on request. Placement data is uploaded at cohort level, so we don't store individual trainee records at all. Employer survey respondents give a name and contact only for follow-up, with a separate opt-in before their organisation's name is shown on an endorsement.

**17. Who can see what?**
Row-level security in the database for every role: officials read everything and sign plans, institutes write only their own courses and cohorts, employers write only their own surveys and reviews, candidates see only their own profile. The UI gating is convenience. The database enforces it. Data is hosted in the Mumbai region.

---

## Cost, scale and sustainability

**18. What does this cost to run?**
For the pilot it runs inside free and entry tiers: Supabase, GitHub Actions for scheduled ingest, and free keys for data.gov.in, MoSPI and ESCO. The only metered AI cost is extraction, and we deduplicate every job description by hash before calling Gemini, so each unique posting is paid for once. We log every run, so we'll report the measured monthly cost rather than guess one here. The real cost is people: someone has to clear the review queue and run survey cycles.

**19. Can this scale to all of India?**
The hard parts are already national: LGD district codes, Udyam, NCO-2015, NSQF QPs, ESCO and PLFS all cover every state. What's state-specific is the place-name aliases, the language labels, the NIC-to-occupation crosswalk review, and the state course catalogue. So a new state is a data-onboarding project, not a rebuild. We'd prove Maharashtra first.

**20. What happens after the hackathon?**
The useful version lives with DSEEI, not with us. The code is one TypeScript monorepo with its tests, ingestion runs on scheduled jobs, and the fact tables rebuild themselves. What it needs to survive is an owner in the department, a survey cycle each quarter through the chambers and ITI IMCs, and the district data-sharing arrangement. We'd propose a pilot in the three demo districts (Pune, Nashik, Gadchiroli) with a hand-over plan.

---

## Competition and integration

**21. Why not just use Naukri?**
Naukri doesn't have a public API and its terms don't allow scraping, so we don't. More importantly, a job board tells you who's hiring in Pune IT this week. It doesn't tell a Latur food-processing unit's ITI what to teach, it doesn't know the ITI's seats, trainers or equipment, and it doesn't end in a plan anyone signs.

**22. How does this fit with Mahaswayam?**
Mahaswayam is DSEEI's own portal and it's the richest vacancy data in the state, but it has no public API, so we haven't touched it. It's on our data request to DSEEI. Every source in our system plugs in through the same adapter interface, so once there's an MoU, Mahaswayam vacancies become one more demand signal with its own weight, and candidates can be pointed back to Mahaswayam listings.

**23. Isn't this just another dashboard?**
A dashboard ends in a chart. This ends in three things a person signs off: a Course Health flag with its evidence, a Curriculum PR that employers endorse, and a District Training Plan an officer signs. And every number opens into the rows behind it.

---

## Integrity

**24. What happens when an employer games the survey, for example inflating hires so their preferred course gets more seats?**
Several things limit that. Employers are linked to a Udyam number, so one verified employer is one voice, and stated hires are checked against their Udyam size band and sector. Each signal is shrunk toward its division, so one loud response in a thin district moves the estimate only partly. A PR needs endorsements from several employers, not one. We will also add a per-employer cap on survey weight and outlier flags that send unusual responses to the review queue. Every response is stored with who gave it and when, so it can be audited.

**25. The demo shows specific numbers. Are they real?**
Anything built on demo data carries a SPECIMEN watermark, and those rows are excluded from official exports. Source row counts, like Udyam's 44.5M rows and Pune's 1.02M, are what we observed in our audit on 24 September. Survey counts and endorsements are real only once real employers respond, and the demo script says which is which on the day.
