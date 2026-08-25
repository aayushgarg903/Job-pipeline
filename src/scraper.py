import json
import os
import requests
from datetime import datetime

DATA_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "seen_jobs.json")

def load_seen_jobs():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            try:
                return set(json.load(f))
            except json.JSONDecodeError:
                return set()
    return set()

def save_seen_jobs(seen_jobs):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, "w") as f:
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

def get_new_jobs():
    seen_jobs = load_seen_jobs()
    all_jobs = []
    all_jobs.extend(fetch_remotive_jobs())
    all_jobs.extend(fetch_arbeitnow_jobs())
    
    new_jobs = []
    for job in all_jobs:
        if job["job_id"] not in seen_jobs:
            new_jobs.append(job)
            
    return new_jobs, seen_jobs
