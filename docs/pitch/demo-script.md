# Demo script: 6 minutes, word for word

> Follows [Plan.md §7](../Plan.md). One presenter drives, one presenter speaks. The speaker never touches the laptop.
> Numbers in `{braces}` are read **off the screen** on the day. The value after "e.g." is the placeholder from Plan §7, not a measured figure. If the screen shows a different number, say the screen's number.
> Anything showing demo data carries the `SPECIMEN` watermark. Point at it once (step 1) so judges know we aren't hiding it.

## Before you walk in (T minus 30 minutes)

- [ ] Demo mode **on** (serves the last good nightly snapshot). Confirm the freshness strip shows the snapshot date.
- [ ] Browser: one window, Daylight theme, zoom 110%, bookmarks bar hidden, notifications off.
- [ ] Tabs pre-opened in this order: `/` · `/state` · `/courses/[nashik-electrician]` · `/plans/[nashik-lgd]/2027` · `/radar` · `/me?lang=mr` (on the phone emulator, 375px).
- [ ] Nashik FY27 plan already solved once, so the re-run is served from cache.
- [ ] Signed PDF of the Nashik plan saved on the desktop as `nashik-fy27-plan.pdf`.
- [ ] Screenshot deck of every step in a second window (the last-resort fallback).
- [ ] Candidate Marathi text copied to the clipboard manager (below, step 7).
- [ ] Count the real employer endorsements on the Nashik PR. Write the number here: ____. If it's zero, use the SPECIMEN line in step 4.

## Timing

| Step | What | Clock |
|---|---|---|
| 1 | The Card Case | 0:00 to 0:35 |
| 2 | The map, and the honesty beat | 0:35 to 1:15 |
| 3 | Compare on the Table | 1:15 to 2:05 |
| 4 | Curriculum PR | 2:05 to 2:50 |
| 5 | District Training Plan | 2:50 to 3:50 |
| 6 | Radar (curated) | 3:50 to 4:25 |
| 7 | Candidate, in Marathi | 4:25 to 5:20 |
| 8 | Evidence | 5:20 to 5:50 |
| Close | One line | 5:50 to 6:00 |

If you are behind at 3:50, skip step 6 and say the one-line version: "There's also an early-warning radar for new technologies. Happy to show it in questions."

---

## Step 1. The Card Case (0:00 to 0:35)

**Click:** Tab `/`. Let the state card slide out. Wait for the four persona cards. Click **Official**.

**Say:**
"This is Kaushal Setu. Everything in it is a card: a district, a course, a skill, an employer, a plan. Right now it's tracking 36 districts, {N postings, e.g. 4,812} job postings this month, and {N employers, e.g. 27} employers who answered our survey. You'll see a watermark that says SPECIMEN on some cards. That means demo data. We'd rather you see it than wonder about it. Let's go in as a district official."

**Fallback (page slow or blank):**
"While that loads: the state card is showing the same thing our freshness strip shows, which is the last good data we have." Switch to the screenshot of step 1 and keep talking. Reload once in the background.

---

## Step 2. The map, and the honesty beat (0:35 to 1:15)

**Click:** `/state`. Hover Pune, then hover Gadchiroli so its tooltip shows.

**Say:**
"This map shows how far training is from jobs in each district. Darker means a bigger gap. Now look at Gadchiroli. It's hatched. That's the product telling you it doesn't know enough: we've seen very few job posts from there, so this estimate leans on Udyam business registrations and what local employers told us. Most dashboards would colour Gadchiroli in confidently from scraped postings and tell it to train React developers. We'd rather say 'low signal' out loud."

**Fallback (map fails to render):**
"The map is a view of this table." Click the **Table** toggle under the map and read Gadchiroli's row, including its coverage column. "Same data, same hatching flag, just as rows."

---

## Step 3. Compare on the Table (1:15 to 2:05)

**Click:** From Nashik's district card, open **Courses**. On the Nashik Electrician ITI course card press **Place on table**. Search "Electrician Pune", place that card too. Open the tray.

**Say:**
"Two ITI Electrician courses, same NCVT trade, one in Nashik and one in Pune. On paper they're identical. On the table, the system underlines where they differ and says it in one sentence." Read the sentence on screen. "Nashik doesn't cover solar PV installation or EV charging. {N employers, e.g. 14} employers in Nashik told us those are must-haves. That's a Nashik trainee finishing this course and not getting the solar job two streets away."

**Fallback (tray won't open or compare sentence missing):**
"The comparison is shareable as a link, so here it is pre-loaded." Open the bookmarked `?table=course:…,course:…` URL. If that fails too, open the Nashik course page and scroll to the skill coverage dot matrix: "Filled dots are skills the course teaches, rings are skills local employers need that it doesn't. Solar PV and EV charging are rings."

---

## Step 4. Curriculum PR (2:05 to 2:50)

**Click:** On the Nashik course card, click **Open Curriculum PR**.

**Say:**
"So what do we do about it? We don't send the principal a chart. We send a Curriculum Pull Request, like a code change for a syllabus." Point at each line. "Add solar PV, 30 hours. Drop a legacy module local employers no longer ask for. Resize one. Total hours stay within 10% of the NSQF budget. Every line has its evidence next to it."

Then, depending on the count you wrote down before the demo:

- **If real endorsements exist:** "{N} Nashik employers have endorsed this. Those seals are real survey respondents who reviewed this diff."
- **If none yet:** "These seals are SPECIMEN. Real ones arrive as employers review the PR in their inbox."

Close the step with: "And we know who can merge it. This is an NCVT trade, so the syllabus itself is set by DGT. This PR is marked as an add-on module the ITI can run now, plus a formal recommendation to DGT with the evidence attached."

**Fallback (PR page errors, or Gemini rationale doesn't stream):**
"The rationale text is written by Gemini from the computed numbers, and it's slow today. The diff itself doesn't need it." Scroll to the diff block, which is computed without AI. If the whole page fails, show the step 4 screenshot.

---

## Step 5. District Training Plan (2:50 to 3:50)

**Click:** `/plans/[nashik]/2027`. Click **Run plan**. When it finishes, point at the slope chart, then the Trainers list, then the Equipment list. Click **Sign and export PDF**.

**Say:**
"Fixing one course isn't enough. The district has to decide seats for next year. This is Nashik's FY27 plan, from an optimiser that respects the real limits: the seat budget, how many trainer-hours each qualification has, how many equipment sets exist, and the capital budget. It maximises expected placements, not salaries, so it doesn't pour every seat into IT." Point at the slope chart. "Seats move from an oversupplied trade to EV and solar. No existing course swings more than 30% in a year, because an ITI can't absorb that." Point at the trainers list. "To do this, Nashik needs to certify these trainers and buy this equipment." Read the marginal re-solve line on screen, e.g. "one more certified trainer here adds about {N} expected placements. The officer changes what they disagree with, and signs." Click sign. "That PDF prints on A4 and goes in the file."

**Fallback (solver slow or errors):**
"The solver is taking longer than usual on this network. Here's the one I solved this morning, same inputs." Open `nashik-fy27-plan.pdf` from the desktop and walk the same three points on the PDF.

---

## Step 6. Radar, curated example (3:50 to 4:25)

**Click:** `/radar`. Click the **Battery management systems** term.

**Say:**
"One more thing districts need is warning. This is a curated example, not an automated model yet. Battery management systems: the global curves on GitHub and in research papers rose first. Pune postings are just starting to show it. And no Maharashtra course we track teaches it. That gap between the global curve and the local one is the time an ITI has to start a module before local employers are desperate for it."

**Fallback (GitHub or OpenAlex series missing):**
"The live series are rate-limited today, so this is the cached chart." If the page itself fails: "I'll skip this one and show it in questions." Move to step 7. You are now ahead of time.

---

## Step 7. Candidate, in Marathi (4:25 to 5:20)

**Click:** Switch to the phone emulator on `/me`. Confirm the header says मराठी. Paste into the skills box:

> मी ITI मधून इलेक्ट्रिशियन कोर्स केला आहे. घरगुती वायरिंग आणि मोटर रिवाइंडिंग येते. सोलर पॅनल बसवणे थोडे शिकले आहे. मी नाशिकमध्ये राहते.

Click **पुढे** (Next). Wait for three role cards. Tap the first one.

**Say:**
"Now the person all of this is for. This is an illustrative trainee in Nashik. She types, in Marathi, what she can do: house wiring, motor rewinding, a little solar panel fitting. No form, no account." Point at the cards. "Three roles she can reach nearby. The first one says she's two skills away from solar installer jobs in Nashik, and here's the nearest ITI batch with seats open, plus free SWAYAM modules for the rest. It never says 'readiness 62 percent'. It says where her skills can take her, and what to do next."

**Fallback (Gemini can't parse the text):**
"The AI that reads free text is overloaded, so let me pick the skills instead." Tap **निवडा** (choose skills) and tick: घरगुती वायरिंग, मोटर रिवाइंडिंग, सोलर पॅनल बसवणे. Same result cards appear, because ranking doesn't need AI. If the page fails entirely, show the step 7 screenshot.

---

## Step 8. Evidence (5:20 to 5:50)

**Click:** Back to the laptop. On the Nashik course card tap the figure "{N employers} Mandatory" for solar PV. The Evidence Drawer slides in. Scroll to one posting with its highlighted sentence and one survey row.

**Say:**
"Last thing, and it's the most important. Every number you've seen is a button. Tap it and you get the rows behind it." Read one highlighted evidence sentence off the screen. "That's the sentence the AI read. This row is an employer who told us solar PV is a must-have. Nothing here is a black box, and nothing is a number you have to take on trust."

**Fallback (drawer empty or errors):**
Open `/sources`. "Every source we use, when it was last fetched, and how many rows it gave us. Same principle: you can check us."

---

## Close (5:50 to 6:00)

**Say:**
"Six signals, one skill vocabulary, and three things a district office can act on: a health card for every course, a fix that local employers endorse, and a plan an officer can sign. Thank you."

Stop talking. Don't add a second close.

---

## If everything is down

Say this, once, calmly, and switch to the screenshot deck:

"Our live sources are down right now, so I'm going to walk you through the same flow from this morning's screenshots. The product has a demo mode for exactly this, and what you'll see is the same data it serves when the APIs are up."

Then run steps 1 to 8 on the screenshots, same words, same order.
