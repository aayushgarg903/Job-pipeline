import os
import asyncio
import time
from dotenv import load_dotenv

from scraper import get_new_jobs, save_seen_jobs
from matcher import extract_jobs_batch, get_description_hash
from db import save_job_intelligence, get_db_connection, log_source_health

async def main():
    load_dotenv()

    print("=" * 60)
    print("  Labour Market Intelligence Pipeline — Sprint 1")
    print("=" * 60)

    # ── Step 1: Fetch jobs from all sources ─────────────────────
    print("\n[1/3] Fetching jobs from all data sources...")
    new_jobs, seen_jobs = await get_new_jobs()
    total_fetched = len(new_jobs)
    print(f"      Found {total_fetched} new jobs to process.\n")

    if not new_jobs:
        print("No new jobs to process. Exiting.")
        return

    # Pipeline run stats
    jobs_saved = 0
    jobs_failed = 0
    jobs_skipped = 0

    # ── Step 2: Check for cached descriptions (save AI cost) ────
    # If a job description was already processed (same hash in DB),
    # we skip calling Gemini and mark it as duplicate.
    jobs_to_process = []
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            for job in new_jobs:
                desc = job.get('description', '')
                if not desc:
                    jobs_skipped += 1
                    continue
                desc_hash = get_description_hash(desc)
                cur.execute(
                    "SELECT id FROM jobs WHERE description_hash = %s LIMIT 1",
                    (desc_hash,)
                )
                if cur.fetchone():
                    # Same description already processed — skip Gemini call
                    jobs_skipped += 1
                    seen_jobs.add(job['job_id'])
                else:
                    jobs_to_process.append(job)
        conn.close()
    except Exception as e:
        print(f"[WARNING] Could not check description cache: {e}")
        jobs_to_process = new_jobs

    print(f"[2/3] Processing {len(jobs_to_process)} jobs "
          f"({jobs_skipped} skipped — already cached)\n")

    # ── Step 3: Extract intelligence in batches ──────────────────
    batch_size = 5
    total_batches = (len(jobs_to_process) + batch_size - 1) // batch_size

    for i in range(0, len(jobs_to_process), batch_size):
        batch = jobs_to_process[i:i+batch_size]
        batch_num = i // batch_size + 1
        print(f"--- Batch {batch_num}/{total_batches} ({len(batch)} jobs) ---")

        # Call Gemini for this batch
        extractions = extract_jobs_batch(batch)

        for job in batch:
            job_id = job["job_id"]
            # Safe ASCII print (Windows terminal fix)
            title   = job.get('title', '').encode('ascii', 'ignore').decode()
            company = job.get('company', '').encode('ascii', 'ignore').decode()
            print(f"  Job: {title[:60]} @ {company[:30]}")

            extraction = extractions.get(job_id)

            if not extraction:
                print(f"       [SKIP] Gemini extraction failed — will retry next run")
                # Do NOT mark as seen → will be retried in next pipeline run
                jobs_failed += 1
                continue

            role = extraction.get('role', 'Unknown')
            skill_count = len(extraction.get('skills', []))
            work_mode = extraction.get('work_mode', 'on_site')
            print(f"       Role: {role} | Skills: {skill_count} | Mode: {work_mode}")

            # Save to Supabase
            success = save_job_intelligence(job, extraction)

            if success:
                seen_jobs.add(job_id)
                jobs_saved += 1
            else:
                jobs_failed += 1

        # Save progress after every batch
        # WHY: If the script crashes mid-run, we don't re-process successful batches
        save_seen_jobs(seen_jobs)

        # Respect Gemini free-tier rate limit (60 requests/min)
        # We send 1 request per batch of 5 jobs, so 6s wait keeps us safe
        if i + batch_size < len(jobs_to_process):
            print(f"  [Rate limit] Waiting 6 seconds before next batch...")
            time.sleep(6)

    # ── Final Summary ────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  PIPELINE COMPLETE")
    print("=" * 60)
    print(f"  Total fetched  : {total_fetched}")
    print(f"  Saved to DB    : {jobs_saved}")
    print(f"  Skipped (cache): {jobs_skipped}")
    print(f"  Failed         : {jobs_failed}")
    print(f"\n  Check Supabase Table Editor to see your data!")
    print(f"  URL: https://supabase.com/dashboard/project/tphganbjblurihgpfcek/editor")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
