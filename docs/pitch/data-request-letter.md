# Data request letter to DSEEI / MSSDS

> Print on college letterhead. Sign by the team lead and countersign by the faculty mentor. Send by email and by post, and hand a copy at the MSSDS office if anyone on the team is in Mumbai.
> Replace everything in [brackets]. Attach Annexure A (the field list below) as a separate page so it can be forwarded to DVET or the data team on its own.

---

[College letterhead]

Ref: [College ref no.] / SIH-2026 / PS-26134 / [01]
Date: [DD Month 2026]

To,
The Commissioner,
Maharashtra State Skill Development Society (MSSDS),
Department of Skills, Employment, Entrepreneurship and Innovation (DSEEI),
Government of Maharashtra,
[Office address], Mumbai

Copy to:
1. The Director, Directorate of Vocational Education and Training (DVET), Mumbai
2. The Chief Executive Officer, Maharashtra State Innovation Society (MSInS), Mumbai

**Subject: Request for district-level skills data under a data-sharing arrangement, for Smart India Hackathon 2026, Problem Statement 26134**

Respected Sir / Madam,

We are a team of six students from [College], [City], working on Problem Statement 26134 of Smart India Hackathon 2026, "Challenges in aligning skill development programs with industry requirements and emerging job market demands", which your Department has set through MSInS.

Our project, **Kaushal Setu**, is a labour-market intelligence and curriculum-alignment platform. It brings together job postings, employer surveys, industry consultations, sector growth and placement outcomes for each of Maharashtra's 36 districts. For each district it produces three things an officer can act on: a health card for every ITI and skill course, suggested course changes that local employers review and endorse, and a District Training Plan for seats, trainers and equipment that the district office can adjust and sign.

We have built the demand side from public sources. The most useful of them is the Udyam MSME registration feed on data.gov.in, which gives district-level business activity for every district in the state. The supply side is where we need your help. The ITI, PMKVY and NAPS figures that are public today are at state level. So at present our district supply numbers are estimates, and our platform labels them "estimated" wherever they appear. District-level data from your Department would replace those estimates with real figures and make the training plans far more useful to district offices.

**We respectfully request the following, for the period FY 2022-23 to date, at district level** (the field list is in Annexure A):

1. **ITI trade seats:** sanctioned and filled seats by ITI, trade and year, for Government and private ITIs.
2. **Trainer register:** number of trainers by ITI and trade, with their certification (CITS or equivalent) and validity. Names are not needed.
3. **Equipment register:** major tools and equipment by ITI and trade, with quantity and working condition, as held against the DGT tool and equipment lists.
4. **Placement tracer data:** for each ITI, trade and passing year, the number passed out, placed at 3 and 6 months, and median starting wage if recorded. Cohort-level totals only.
5. **Mahaswayam vacancy data:** vacancies notified by district, sector and job role, with dates, and the skills or qualifications asked for where recorded. Employer identity is not needed.

Any subset is welcome. Even two or three districts would let us show real numbers. Our demonstration districts are **Pune, Nashik and Gadchiroli**, chosen to show a data-rich, a mixed and a thin-data district. Data for these three would make the most immediate difference.

**What we will give back**

- A **free district dashboard** for every district covered by the data: course health cards, skill gaps by role and proficiency, and a draft District Training Plan, in English and Marathi, printable on A4.
- A short **written summary for each district** covered, delivered to your office before the SIH finale.
- The **source code and documentation**, which the Department is free to host, adapt and run after the hackathon.
- Early access for a named officer of your choice to review the platform and correct anything that misrepresents how the Department works.

**How we will protect the data**

- **Aggregate only.** We ask for no personal data on trainees, trainers or job seekers. If a file contains any, we will not load it and will return or delete it.
- **Purpose-limited.** The data will be used only for this project and the SIH 2026 evaluation, in line with the Digital Personal Data Protection Act, 2023.
- **Access-controlled.** Data will be stored in a database hosted in India (Mumbai region), with row-level access control. Only two named team members will have direct access.
- **Clearly marked.** Wherever your data appears, it will be credited to the Department. No figure will be published outside the demo and the evaluation without your written consent.
- **Deleted on request.** We will delete all shared data within 7 days of the SIH 2026 results, or earlier if you ask, and confirm the deletion in writing, unless the Department asks us to continue under a further arrangement.
- We are happy to sign a **data-sharing undertaking or NDA** in the Department's format.

**Format and timing**

Excel or CSV in any layout is fine, and so are scanned registers if that is how the data is held. We will do the cleaning. It would help us most to receive the data by **[date, suggest 11 October 2026]**, so it can be part of the working prototype. We would also welcome a 20-minute meeting or call with the relevant officer to understand how the data is recorded, so that we read it correctly.

We are grateful to the Department for setting this problem. We have tried to build something a district skills office would actually use, and your data is what would make it trustworthy.

Thank you for your time and consideration.

Yours faithfully,

[Name]
Team Lead, Team [TEAM NAME]
[College], [City]
[Phone] · [Email]

[Name]
Faculty Mentor, [Department], [College]
[Phone] · [Email]

---

## Annexure A: fields requested

All at district level. No personal identifiers in any file.

| # | Dataset | Fields | Grain | Period |
|---|---|---|---|---|
| 1 | ITI trade seats | district, ITI name and code, Govt/private, trade (NCVT/SCVT code), sanctioned seats, filled seats, shifts/units | ITI × trade × year | FY 2022-23 to date |
| 2 | Trainer register | district, ITI code, trade, number of trainers, number CITS-certified, certification valid until (month/year), vacancies | ITI × trade | latest |
| 3 | Equipment register | district, ITI code, trade, item (as per DGT tool/equipment list), quantity, number in working condition, year procured | ITI × trade × item | latest |
| 4 | Placement tracer | district, ITI code, trade, passing year, passed out, placed at 3 months, placed at 6 months, self-employed, apprenticeship, median starting wage (if recorded) | ITI × trade × passing year | FY 2022-23 to date |
| 5 | Mahaswayam vacancies | district, sector, job role / title, number of vacancies, date notified, qualification or skills asked, salary range (if recorded) | vacancy (employer identity removed) | last 24 months |

## Annexure B: Marathi covering note (for the office inward register)

> विषय: स्मार्ट इंडिया हॅकेथॉन २०२६, समस्या क्रमांक २६१३४ साठी जिल्हास्तरीय कौशल्य माहितीची विनंती.
>
> महोदय / महोदया,
> आम्ही [College], [City] येथील विद्यार्थी असून विभागाने दिलेल्या समस्या क्रमांक २६१३४ वर "कौशल सेतू" हे व्यासपीठ तयार करत आहोत. ITI जागा, प्रशिक्षक व उपकरणे नोंदवही, प्लेसमेंट ट्रेसर माहिती आणि महास्वयम रिक्त पदांची माहिती जिल्हानिहाय, एकत्रित स्वरूपात (वैयक्तिक माहितीशिवाय) मिळावी अशी नम्र विनंती आहे. त्याबदल्यात संबंधित प्रत्येक जिल्ह्यासाठी मोफत डॅशबोर्ड, जिल्हा प्रशिक्षण आराखडा आणि सोर्स कोड विभागाला देऊ. माहिती फक्त या प्रकल्पासाठी वापरली जाईल, भारतात सुरक्षित ठेवली जाईल आणि निकालानंतर ७ दिवसांत हटवली जाईल. सविस्तर इंग्रजी पत्र व परिशिष्ट सोबत जोडले आहे.
>
> आपला / आपली विश्वासू,
> [Name], टीम [TEAM NAME]
