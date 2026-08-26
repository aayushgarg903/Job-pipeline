import os
import json
from google import genai
from bs4 import BeautifulSoup
from pydantic import BaseModel, Field

class JobEvaluation(BaseModel):
    match_score: int = Field(description="Integer between 0 and 100 representing how well the profile matches the job")
    recommendation: str = Field(description="'Strong Match', 'Potential', or 'Skip'")
    ai_reasoning: str = Field(description="A 1-2 sentence explanation of why this job received the specific match score")
    missing_skills: list[str] = Field(description="Array of key skills mentioned in the job but missing in profile")
    cover_letter: str = Field(description="Tailored, punchy 3-paragraph pitch as a string")
    interview_questions: list[str] = Field(description="Array of top 3 behavioral/technical questions tailored to the role")

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
    
    job_desc_clean = clean_html(job.get("description", ""))
    
    prompt = f"""
    You are an expert tech recruiter and career coach.
    Evaluate the following job opportunity against the candidate's profile.
    
    Candidate Profile:
    {json.dumps(profile, indent=2)}
    
    Job Title: {job.get('title')}
    Company: {job.get('company')}
    Job Description:
    {job_desc_clean[:5000]}
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-3.5-flash-lite',
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=JobEvaluation
            )
        )
        result = json.loads(response.text)
        return result
    except Exception as e:
        print(f"Error calling Gemini API for job {job.get('job_id')}: {e}")
        return None
