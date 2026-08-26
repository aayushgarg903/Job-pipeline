import json
import os
import requests
from datetime import datetime

DATA_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "seen_jobs.json")

def load_seen_jobs():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            try:
                return set(json.load(f))
            except json.JSONDecodeError:
                return set()
    return set()

def save_seen_jobs(seen_jobs):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(list(seen_jobs), f, indent=2)

def fetch_remotive_jobs():
    url = "https://remotive.com/api/remote-jobs"
    try:
        response = requests.get(url, params={"limit": 50})
        response.raise_for_status()
        data = response.json()
        jobs = []
        for job in data.get("jobs", []):
            jobs.append({
                "job_id": f"remotive_{job.get('id')}",
                "title": job.get("title", ""),
                "company": job.get("company_name", ""),
                "url": job.get("url", ""),
                "description": job.get("description", ""),
                "location": job.get("candidate_required_location", ""),
                "published_date": job.get("publication_date", "")
            })
        return jobs
    except Exception as e:
        print(f"Error fetching from Remotive: {e}")
        return []

def fetch_arbeitnow_jobs():
    url = "https://www.arbeitnow.com/api/job-board-api"
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        jobs = []
        for job in data.get("data", []):
            jobs.append({
                "job_id": f"arbeitnow_{job.get('slug')}",
                "title": job.get("title", ""),
                "company": job.get("company_name", ""),
                "url": job.get("url", ""),
                "description": job.get("description", ""),
                "location": job.get("location", ""),
                "published_date": str(job.get("created_at", ""))
            })
        return jobs
    except Exception as e:
        print(f"Error fetching from Arbeitnow: {e}")
        return []

def fetch_himalayas_jobs():
    url = "https://himalayas.app/jobs/api"
    try:
        response = requests.get(url, params={"limit": 50})
        response.raise_for_status()
        data = response.json()
        jobs = []
        for job in data.get("jobs", []):
            # Himalayas location is an array, we'll join it into a string for our filter
            locs = job.get("locationRestrictions", [])
            location_str = ", ".join(locs) if locs else "Remote"
            
            jobs.append({
                "job_id": f"himalayas_{job.get('guid', '').split('/')[-1]}",
                "title": job.get("title", ""),
                "company": job.get("companyName", ""),
                "url": job.get("applicationLink", ""),
                "description": job.get("description", ""),
                "location": location_str,
                "published_date": str(job.get("pubDate", ""))
            })
        return jobs
    except Exception as e:
        print(f"Error fetching from Himalayas: {e}")
        return []

def fetch_google_jobs(profile):
    api_key = os.getenv("RAPIDAPI_KEY")
    if not api_key:
        print("RAPIDAPI_KEY not set. Skipping Google Jobs (JSearch).")
        return []
        
    regions = profile.get("search_regions", ["Remote"])
    if not regions:
        regions = ["Remote"]
        
    state_file = os.path.join(os.path.dirname(__file__), "..", "data", "region_state.json")
    
    current_index = 0
    if os.path.exists(state_file):
        try:
            with open(state_file, "r") as f:
                state = json.load(f)
                current_index = state.get("current_index", 0)
        except:
            pass
            
    # Safety check if regions array changed length
    if current_index >= len(regions):
        current_index = 0
        
    target_region = regions[current_index]
    print(f"Rotating Search: Targeting region '{target_region}' this run.")
    
    # Save the next index for the next run
    next_index = (current_index + 1) % len(regions)
    os.makedirs(os.path.dirname(state_file), exist_ok=True)
    with open(state_file, "w") as f:
        json.dump({"current_index": next_index}, f)
        
    # Pick the top title to search, or a generic one
    titles = profile.get("target_titles", [])
    primary_title = titles[0] if titles else "Software Engineer"
    
    query = f"{primary_title} in {target_region}"
    url = "https://jsearch.p.rapidapi.com/search-v2"
    headers = {
        "x-rapidapi-key": api_key,
        "x-rapidapi-host": "jsearch.p.rapidapi.com"
    }
    
    try:
        response = requests.get(url, headers=headers, params={"query": query, "num_pages": "1", "date_posted": "week"})
        response.raise_for_status()
        data = response.json()
        
        jobs = []
        jobs_data = data.get("data", [])
        if isinstance(jobs_data, dict):
            jobs_data = jobs_data.get("jobs", [])
        for job in jobs_data:
            jobs.append({
                "job_id": f"jsearch_{job.get('job_id')}",
                "title": job.get("job_title", ""),
                "company": job.get("employer_name", ""),
                "url": job.get("job_apply_link", ""),
                "description": job.get("job_description", ""),
                "location": f"{job.get('job_city', '')} {job.get('job_state', '')} {job.get('job_country', '')}".strip(),
                "published_date": str(job.get("job_posted_at_datetime_utc", ""))
            })
        return jobs
    except Exception as e:
        print(f"Error fetching from Google Jobs (JSearch): {e}")
        return []

def is_valid_location(location_str, profile):
    if not location_str:
        return True
    loc = location_str.lower()
    
    # Get allowed locations dynamically from profile
    allowed_prefs = profile.get("location_preferences", [])
    allowed = [p.lower() for p in allowed_prefs]
    
    # Still keep some hardcoded reject rules for typical mismatches if the user is in India
    # (If your friend is elsewhere, they could even put restrictions in their profile!)
    restricted = ["us only", "usa only", "uk only", "europe only", "eu only", "americas only", "latam"]
    
    if any(r in loc for r in restricted):
        return False
        
    if any(a in loc for a in allowed):
        return True
        
    return False

def is_relevant_title(title, profile):
    """
    Drops jobs before hitting the AI if the title clearly doesn't match the target titles.
    """
    if not title:
        return False
        
    t = title.lower()
    target_titles = [tt.lower() for tt in profile.get("target_titles", [])]
    
    # A simple but effective check: see if any word from the target titles is in the job title.
    # We split target titles into keywords (e.g. "Java Developer" -> "java", "developer")
    # For backend roles, just checking if "java", "backend", "software", "apex" etc is in the title.
    
    target_keywords = set()
    for tt in target_titles:
        for word in tt.split():
            target_keywords.add(word)
            
    # Some words are too generic like "developer" or "engineer". We want to ensure 
    # it doesn't just match "Frontend Developer". So we can create a negative list too.
    reject_keywords = ["frontend", "react", "ios", "android", "sales", "marketing", "hr", "recruiter", "manager", "data engineer"]
    
    if any(r in t for r in reject_keywords):
        return False
        
    # If it contains any of our core keywords (like java, backend, software), keep it!
    # For your profile, 'software', 'java', 'backend', 'apex' are strong signals.
    if any(kw in t for kw in target_keywords):
        return True
        
    return False

def get_new_jobs(profile):
    seen_jobs = load_seen_jobs()
    all_jobs = []
    all_jobs.extend(fetch_remotive_jobs())
    all_jobs.extend(fetch_arbeitnow_jobs())
    all_jobs.extend(fetch_himalayas_jobs())
    all_jobs.extend(fetch_google_jobs(profile))
    
    new_jobs = []
    for job in all_jobs:
        # Check if seen
        if job["job_id"] in seen_jobs:
            continue
            
        # Pre-filtering: Location and Title
        valid_loc = is_valid_location(job["location"], profile)
        valid_title = is_relevant_title(job["title"], profile)
        
        if valid_loc and valid_title:
            new_jobs.append(job)
            
    return new_jobs, seen_jobs
