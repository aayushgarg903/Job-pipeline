import json
import os
import requests
import aiohttp
import asyncio
from datetime import datetime
from tenacity import retry, stop_after_attempt, wait_exponential

from db import log_source_health, get_db_connection

DATA_FILE = os.path.join(os.path.dirname(__file__), "..", "data", os.getenv("SEEN_JOBS_FILE", "seen_jobs.json"))

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

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=2, max=15))
async def fetch_remotive_jobs(session):
    url = "https://remotive.com/api/remote-jobs"
    async with session.get(url, params={"limit": 100}) as response:
        response.raise_for_status()
        data = await response.json()
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
        return "remotive", jobs

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=2, max=15))
async def fetch_arbeitnow_jobs(session):
    url = "https://www.arbeitnow.com/api/job-board-api"
    async with session.get(url) as response:
        response.raise_for_status()
        data = await response.json()
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
        return "arbeitnow", jobs

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=2, max=15))
async def fetch_himalayas_jobs(session):
    url = "https://himalayas.app/jobs/api"
    async with session.get(url, params={"limit": 100}) as response:
        response.raise_for_status()
        data = await response.json()
        jobs = []
        for job in data.get("jobs", []):
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
        return "himalayas", jobs

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=2, max=15))
async def fetch_google_jobs(session):
    api_key = os.getenv("RAPIDAPI_KEY")
    if not api_key:
        print("RAPIDAPI_KEY not set. Skipping Google Jobs (JSearch).")
        return "jsearch", []
        
    # Rotate through Indian cities and roles for SIH dataset
    regions = ["Pune, Maharashtra", "Bangalore, Karnataka", "Hyderabad, Telangana", "Mumbai, Maharashtra", "Delhi, NCR"]
    roles = ["Software Engineer", "Full Stack Developer", "Data Scientist", "Cloud Engineer", "DevOps"]
    
    state_file = os.path.join(os.path.dirname(__file__), "..", "data", "region_state.json")
    
    current_index = 0
    if os.path.exists(state_file):
        try:
            with open(state_file, "r") as f:
                state = json.load(f)
                current_index = state.get("current_index", 0)
        except:
            pass
            
    if current_index >= (len(regions) * len(roles)):
        current_index = 0
        
    region_idx = current_index % len(regions)
    role_idx = (current_index // len(regions)) % len(roles)
    
    target_region = regions[region_idx]
    target_role = roles[role_idx]
    
    print(f"Rotating Search: Targeting role '{target_role}' in region '{target_region}' this run.")
    
    next_index = (current_index + 1) % (len(regions) * len(roles))
    os.makedirs(os.path.dirname(state_file), exist_ok=True)
    with open(state_file, "w") as f:
        json.dump({"current_index": next_index}, f)
        
    query = f"{target_role} in {target_region}"
    url = "https://jsearch.p.rapidapi.com/search-v2"
    headers = {
        "x-rapidapi-key": api_key,
        "x-rapidapi-host": "jsearch.p.rapidapi.com"
    }
    
    async with session.get(url, headers=headers, params={"query": query, "num_pages": "1", "date_posted": "week"}) as response:
        response.raise_for_status()
        data = await response.json()
        
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
                "location": f"{job.get('job_city', '')} {job.get('job_state', '')} {job.get('job_country', '')} {'Remote' if job.get('job_is_remote') else ''}".strip(),
                "published_date": str(job.get("job_posted_at_datetime_utc", ""))
            })
        return "jsearch", jobs


async def get_new_jobs():
    """
    Fetches all jobs across sources. Includes API failure retries and health logging.
    """
    seen_jobs = load_seen_jobs()
    all_jobs = []
    
    async with aiohttp.ClientSession() as session:
        # Fetch all sources concurrently
        tasks = [
            fetch_remotive_jobs(session),
            fetch_arbeitnow_jobs(session),
            fetch_himalayas_jobs(session),
            fetch_google_jobs(session)
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
    try:
        conn = get_db_connection()
    except Exception as e:
        print(f"[ERROR] Could not connect to DB for health logging: {e}")
        conn = None

    source_names = ["remotive", "arbeitnow", "himalayas", "jsearch"]

    for i, result in enumerate(results):
        source = source_names[i]
        
        if isinstance(result, Exception):
            print(f"[ERROR] Scraper {source} failed after retries: {result}")
            if conn:
                log_source_health(conn, source, "failed", 0, str(result))
        else:
            _, jobs = result
            all_jobs.extend(jobs)
            if conn:
                log_source_health(conn, source, "success", len(jobs))
                
    if conn:
        conn.close()
    
    new_jobs = []
    for job in all_jobs:
        if job["job_id"] in seen_jobs:
            continue
            
        if job["title"] and job["description"]:
            new_jobs.append(job)
            
    return new_jobs, seen_jobs
