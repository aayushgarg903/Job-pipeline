import os
import json
from google import genai
from bs4 import BeautifulSoup

def clean_html(raw_html):
    if not raw_html:
        return ""
    return BeautifulSoup(raw_html, "html.parser").get_text(separator=" ", strip=True)

def evaluate_job_fit(job, profile):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not found in environment variables.")
        return None
        
    client = genai.Client(api_key=api_key)
    
    # We use a model that supports JSON response formatting if available, or ask it nicely.
    # gemini-1.5-flash is fast and good at structured output.
    
    job_desc_clean = clean_html(job.get("description", ""))
    
    prompt = f"""
    You are an expert tech recruiter and career coach.
    Evaluate the following job opportunity against the candidate's profile.
    
    Candidate Profile:
    {json.dumps(profile, indent=2)}
    
    Job Title: {job.get('title')}
    Company: {job.get('company')}
    Job Description:
    {job_desc_clean[:5000]} # Truncated to avoid token limits just in case
    
    Return a JSON object strictly matching this schema:
    {{
        "match_score": <integer between 0 and 100 representing how well the profile matches the job>,
        "recommendation": <"Strong Match", "Potential", or "Skip">,
        "missing_skills": [<array of key skills mentioned in the job but missing in profile>],
        "cover_letter": <tailored, punchy 3-paragraph pitch as a string>,
        "interview_questions": [<array of top 3 behavioral/technical questions tailored to the role>]
    }}
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-3.5-flash-lite',
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        result = json.loads(response.text)
        return result
    except Exception as e:
        print(f"Error calling Gemini API for job {job.get('job_id')}: {e}")
        return None
