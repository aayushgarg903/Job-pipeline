import os
import json
from dotenv import load_dotenv

from scraper import get_new_jobs, save_seen_jobs
from matcher import evaluate_job_fit
from notion_integration import add_to_notion
from notifier import send_email_alert

def load_profile():
    profile_path = os.path.join(os.path.dirname(__file__), "..", "config", "profile.json")
    try:
        with open(profile_path, "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading profile: {e}")
        return None

def main():
    # Load environment variables for local testing
    load_dotenv()
    
    print("Starting Job-Hunting Pipeline...")
    
    profile = load_profile()
    if not profile:
        print("Could not load profile. Exiting.")
        return
        
    print("Fetching new jobs...")
    new_jobs, seen_jobs = get_new_jobs()
    
    print(f"Found {len(new_jobs)} new jobs to evaluate.")
    
    for job in new_jobs:
        title = job.get('title', '').encode('ascii', 'ignore').decode()
        company = job.get('company', '').encode('ascii', 'ignore').decode()
        print(f"\nEvaluating: {title} at {company}...")
        match_result = evaluate_job_fit(job, profile)
        
        if not match_result:
            print("Failed to evaluate job fit.")
            continue
            
        score = match_result.get("match_score", 0)
        print(f"Match Score: {score}/100 - {match_result.get('recommendation')}")
        
        notion_url = None
        if score >= 75:
            print("Score >= 75: Saving to Notion...")
            notion_url = add_to_notion(job, match_result)
            if notion_url:
                print(f"Saved to Notion: {notion_url}")
                
        if score >= 80:
            print("Score >= 80: Sending email alert...")
            success = send_email_alert(job, match_result, notion_url)
            if success:
                print("Email alert sent successfully.")
                
        # Mark as seen to prevent re-processing
        seen_jobs.add(job["job_id"])
        save_seen_jobs(seen_jobs)
        
        # Respect Gemini free tier rate limit of 15 Requests Per Minute (1 request every 4 seconds, adding buffer)
        import time
        time.sleep(6)
        
    print("\nPipeline execution completed.")

if __name__ == "__main__":
    main()
