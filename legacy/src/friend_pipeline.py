import os
import sys
import json
import asyncio
from dotenv import load_dotenv

from scraper import get_new_jobs, save_seen_jobs
from matcher import evaluate_jobs_batch
from notion_integration import add_to_notion

load_dotenv()

# Override the database ID with Sakshi's new database
os.environ["NOTION_DATABASE_ID"] = "3c98723f961581bf8629f96c0cef6c98"
os.environ["SEEN_JOBS_FILE"] = "friend_seen_jobs.json"

def load_profile(filename):
    profile_path = os.path.join(os.path.dirname(__file__), "..", "config", filename)
    with open(profile_path, "r") as f:
        return json.load(f)

async def run_for_friend():
    print("Loading friend profile...")
    profile = load_profile("friend_profile.json")
    
    print("Fetching new jobs...")
    new_jobs, seen_jobs = await get_new_jobs(profile)
    
    print(f"Found {len(new_jobs)} new jobs to evaluate.")
    
    batch_size = 5
    for i in range(0, len(new_jobs), batch_size):
        batch = new_jobs[i:i+batch_size]
        print(f"\nProcessing batch {i//batch_size + 1} of {(len(new_jobs) + batch_size - 1)//batch_size} ({len(batch)} jobs)...")
        
        # Call Gemini AI on the batch
        evaluations = evaluate_jobs_batch(batch, profile)
        
        for job in batch:
            job_id = job["job_id"]
            title = job.get('title', '').encode('ascii', 'ignore').decode()
            company = job.get('company', '').encode('ascii', 'ignore').decode()
            print(f"- {title} at {company}")
            
            match_result = evaluations.get(job_id)
            if not match_result:
                print("  Failed to evaluate.")
                continue
                
            score = match_result.get("match_score", 0)
            print(f"  Match Score: {score}/100 - {match_result.get('recommendation')}")
            
            if score >= 50:
                print("  Score >= 50: Saving to Notion...")
                notion_url = add_to_notion(job, match_result)
                if notion_url:
                    print(f"  Saved to Notion Database: {notion_url}")
            
            seen_jobs.add(job_id)
            
        save_seen_jobs(seen_jobs)
        
        # Sleep for Gemini free-tier limits, but now only ONCE per batch!
        import time
        time.sleep(6)
            
    print("Done!")

if __name__ == "__main__":
    asyncio.run(run_for_friend())
