import os
import sys
import json
from dotenv import load_dotenv

from scraper import get_new_jobs, save_seen_jobs
from matcher import evaluate_job_fit
from notion_integration import add_to_notion

load_dotenv()

# Override the database ID with Sakshi's new database
os.environ["NOTION_DATABASE_ID"] = "3c98723f961581bf8629f96c0cef6c98"
os.environ["SEEN_JOBS_FILE"] = "friend_seen_jobs.json"

def load_profile(filename):
    profile_path = os.path.join(os.path.dirname(__file__), "..", "config", filename)
    with open(profile_path, "r") as f:
        return json.load(f)

def run_for_friend():
    print("Loading friend profile...")
    profile = load_profile("friend_profile.json")
    
    print("Fetching new jobs...")
    new_jobs, seen_jobs = get_new_jobs(profile)
    
    print(f"Found {len(new_jobs)} new jobs to evaluate.")
    
    for job in new_jobs:
        title = job.get('title', '').encode('ascii', 'ignore').decode()
        company = job.get('company', '').encode('ascii', 'ignore').decode()
        print(f"\nEvaluating: {title} at {company}...")
        
        match_result = evaluate_job_fit(job, profile)
        if not match_result:
            continue
            
        score = match_result.get("match_score", 0)
        print(f"Match Score: {score}/100 - {match_result.get('recommendation')}")
        
        if score >= 50:
            print("Score >= 50: Saving to Notion...")
            notion_url = add_to_notion(job, match_result)
            if notion_url:
                print(f"Saved to Notion Database: {notion_url}")
            
        seen_jobs.add(job["job_id"])
        
        # Respect Gemini free tier rate limit
        import time
        time.sleep(6)
            
    save_seen_jobs(seen_jobs)
    print("Done!")

if __name__ == "__main__":
    run_for_friend()
