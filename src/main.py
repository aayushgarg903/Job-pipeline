import os
import json
import requests
from dotenv import load_dotenv

from scraper import get_new_jobs, save_seen_jobs
from matcher import evaluate_job_fit
from notion_integration import add_to_notion
from notifier import send_email_alert

def check_job_validity(job):
    """
    Checks if the job link is accessible (not 404) and if the job description or page 
    asks for unwanted fees (like 99 rupees).
    """
    url = job.get("url")
    description = job.get("description", "").lower()
    
    # Common fee-related keywords to avoid scams or paid application forms
    fee_keywords = [
        "99 rupees", "₹99", "rs 99", "rs. 99", "inr 99", 
        "application fee", "registration fee", "pay to apply",
        "security deposit", "refundable deposit"
    ]
    
    # 1. Quick check in description
    if any(keyword in description for keyword in fee_keywords):
        print("Skipping: Found fee-related keyword in description.")
        return False
        
    if not url:
        return True
        
    # 2. Check the URL for 404 and also fetch its content for fee checking
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        # Timeout to prevent hanging on dead sites
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 404:
            print("Skipping: Job link returned 404 Not Found.")
            return False
            
        # If we successfully loaded the page, let's also scan its text for fee keywords
        if response.status_code == 200:
            page_text = response.text.lower()
            if any(keyword in page_text for keyword in fee_keywords):
                print("Skipping: Found fee-related keyword on the application page.")
                return False
                
    except requests.RequestException as e:
        print(f"Skipping: Could not access job link ({e}).")
        return False
        
    return True

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
    new_jobs, seen_jobs = get_new_jobs(profile)
    
    print(f"Found {len(new_jobs)} new jobs to evaluate.")
    
    for job in new_jobs:
        title = job.get('title', '').encode('ascii', 'ignore').decode()
        company = job.get('company', '').encode('ascii', 'ignore').decode()
        print(f"\nEvaluating: {title} at {company}...")
        
        if not check_job_validity(job):
            # Mark as seen so we don't keep re-checking a broken/paid link
            seen_jobs.add(job["job_id"])
            save_seen_jobs(seen_jobs)
            continue
            
        match_result = evaluate_job_fit(job, profile)
        
        if not match_result:
            print("Failed to evaluate job fit.")
            continue
            
        score = match_result.get("match_score", 0)
        print(f"Match Score: {score}/100 - {match_result.get('recommendation')}")
        
        notion_url = None
        if score >= 50:
            print("Score >= 50: Saving to Notion...")
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
