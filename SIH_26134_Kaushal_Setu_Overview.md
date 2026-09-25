# Kaushal Setu: Solving SIH Problem Statement 26134

## The Core Problem
Problem Statement 26134, presented by the Government of Maharashtra (Dept. of Skills, Employment, Entrepreneurship & Innovation), highlights a critical issue: the growing mismatch between the skills taught at Industrial Training Institutes (ITIs) and the actual, real-time demands of local employers. 

## What This Codebase Does
**Kaushal Setu** acts as an intelligent, automated bridge (Setu) between the classroom and the job market. Rather than relying on outdated syllabus revisions, the platform continuously listens to the labor market across all 36 districts of Maharashtra using 6 real-world signals:
1. **Udyam MSME Registrations**
2. **Live Job Postings** (scraped via JSearch)
3. **Employer Surveys**
4. **Industry Consultations**
5. **Tech Trends** (via OpenAlex)
6. **Placement Data**

All this data is ingested and mapped to a unified, standardized skill vocabulary (ESCO ⟷ NSQF ⟷ NCO-2015).

## Why It Is Highly Useful & Effective

This platform is incredibly useful because it uses Data Engineering and Generative AI (Gemini) to turn raw labor market data into highly actionable, automated outcomes for the government:

1. **Course Health Cards:** It automatically flags ITI courses that no longer align with local industry demands, explaining *why* the course is failing in plain, easy-to-understand language.
2. **Curriculum "Pull Requests":** It doesn't just point out problems; it automatically generates module-level fixes and curriculum updates that are directly endorsed by local employers.
3. **District Training Plans:** Using an advanced mathematical optimizer (HiGHS), it calculates the exact ideal allocation of training seats, trainers, and equipment needed for a given district. It can even generate an A4 PDF ready for a government official's signature.
4. **Job-Seeker Empowerment (`/me` portal):** It democratizes this data by giving job-seekers access to the exact same market intelligence in their local language (Marathi), guiding their career and upskilling choices.

---

## How It Works (Technical Architecture)

The platform is engineered as a highly scalable **monorepo** designed to handle messy real-world data and turn it into pristine analytics:

1. **Automated Data Ingestion (`packages/ingest`)**:
   - Automated scheduled jobs pull data from open government platforms and job boards.
   - Because raw job descriptions are messy and unstructured, the system funnels them into an AI pipeline rather than using brittle regex rules.
   
2. **AI & Standardization (`packages/ai`)**:
   - The system leverages the **Gemini AI API** to read raw job postings and extract concrete, standardized skills, job titles, and experience levels.
   - It seamlessly maps unstructured text to a formal international taxonomy (like ESCO - European Skills, Competences, Qualifications and Occupations).

3. **Core Engine & Optimizer (`packages/core`)**:
   - Once the data is structured, the core engine calculates a **Demand Index** and a **Course Health Score**.
   - *Example:* If an ITI is producing 500 welders but local industries only need 50, the health score drops and a warning is triggered.
   - For generating training plans, it uses **HiGHS** (a high-performance mathematical solver) to optimize the allocation of limited state resources (budget, trainers) to maximize the number of students who will actually get hired.

4. **Database Layer (`packages/db`)**:
   - All intelligence is stored in a highly scalable **PostgreSQL** database managed by **Supabase**.
   - **Drizzle ORM** ensures end-to-end type safety, meaning fewer bugs when the frontend asks the database for complex analytics.

5. **Interactive Dashboard (`apps/web`)**:
   - Built on **Next.js 16**, the frontend provides stunning, premium visualizations (using Framer Motion, D3, and Observable Plot).
   - Government officials get an intuitive dashboard where they can instantly identify skill gaps on a heat map of Maharashtra and approve curriculum updates with one click.

## The Ultimate Impact

For decades, updating a state-level curriculum has been a manual, multi-year process involving endless committees. By the time a new syllabus is introduced, industry needs have already moved on. 

**Kaushal Setu solves this latency.** It creates a dynamic, continuous feedback loop where local businesses passively dictate the syllabus through their actual hiring patterns, ensuring that Maharashtra's youth are always learning the skills that guarantee employment.
