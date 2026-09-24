# Kaushal Setu

**SIH 2026 · PS 26134**. From the Govt. of Maharashtra, Maharashtra State Innovation Society, Dept. of Skills, Employment, Entrepreneurship & Innovation.

Kaushal Setu helps Maharashtra match what ITIs teach with what employers are hiring for. It listens to employers in all 36 districts through six signals:
- Udyam MSME registrations
- job postings
- employer surveys
- consultations
- tech trends
- placements

Everything it hears lands in one skill vocabulary (ESCO ⟷ NSQF ⟷ NCO-2015). From that it produces:

1. **Course Health cards**: courses that no longer match local demand, with the reason in plain words.
2. **Curriculum Pull Requests**: module-level fixes that local employers endorse.
3. **District Training Plans**: seats, trainers and equipment from an optimiser (HiGHS), signed by an officer as an A4 PDF.

Job-seekers get the same intelligence in Marathi at `/me`.

Docs: [Architecture](docs/Architecture.md) · [Plan](docs/Plan.md) · [Design](docs/Design.md) · [Pitch kit](docs/pitch/README.md)

## Layout

```
apps/web            Next.js 16 app (console for officials/institutes, employer survey, /me)
packages/contracts  shared types and ports (Readers, Writers, Extractor, Embedder)
packages/core       engine: demand index, gap, course health, curriculum PR, planner, forecast
packages/db         Drizzle schema (Postgres schema `ks`), readers, writers, seed, migrations
packages/ingest     source adapters (Udyam, JSearch, ESCO, OpenAlex), normalise, facts CLI
packages/ai         Gemini extraction with fallback chain, embeddings, grounded narration, eval
packages/ui         the card design system ("Ledger & Card-stock, made human")
legacy/             the original Python job-hunting pipeline, archived
```

## Run it

Requires Node ≥ 20.9 and pnpm 11.

```bash
pnpm install
cp .env.example .env                 # fill in; never commit .env
ln -s ../../.env apps/web/.env.local

# demo data only, no database needed
DATA_MODE=fixture pnpm dev           # http://localhost:3000

# live database
pnpm db:migrate && pnpm db:seed
pnpm ingest --source=all             # JSearch free tier: 200 req/month, the CLI caps usage
pnpm ingest facts
DATA_MODE=db pnpm dev
```

- **Officer actions** (signing plans, the review queue) need `/signin` with `CONSOLE_PASSCODE` from `.env`.
- **Checks:** `pnpm test` runs the unit tests, and `pnpm typecheck` runs strict TypeScript across all packages.
- **Scheduled ingest:** `.github/workflows/ingest.yml` runs it on a schedule. It needs repo secrets `DATABASE_URL`, `DATABASE_URL_SESSION`, `RAPIDAPI_KEY`, `DATA_GOV_IN_KEY` and `GEMINI_API_KEY`.

## Honest limits

- District-level ITI seats and placements are not public. Supply is estimated from state totals and labelled **estimated**, and the course/institute supply is demo data (SPECIMEN) until DSEEI shares records.
- On free tiers, Gemini flash models return 429 errors; the fallback chain answers with flash-lite models. JSearch allows 200 requests a month.
- Officer sign-in uses a shared passcode for the hackathon. The production path is Supabase Auth plus roles.
