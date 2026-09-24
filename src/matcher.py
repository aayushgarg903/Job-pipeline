import os
import json
import hashlib
from typing import Optional
from google import genai
from bs4 import BeautifulSoup
from pydantic import BaseModel, Field
from tenacity import retry, stop_after_attempt, wait_exponential

# =============================================================================
# PYDANTIC SCHEMAS — Sprint 1 Upgrade
#
# WHY PYDANTIC?
# Gemini returns JSON text. Pydantic automatically validates that the JSON
# has all the right fields and types. If Gemini returns garbage (hallucination,
# missing fields, wrong types), Pydantic rejects it before it touches the DB.
# This is our first line of defence against AI hallucination.
# =============================================================================

class ExtractedSkill(BaseModel):
    """
    Represents ONE skill extracted from a job description.
    Every field has a purpose in our SIH platform:
    """
    name: str = Field(
        description="The skill name exactly as written, e.g. 'React', 'Docker', 'Python'"
    )
    required_status: str = Field(
        description=(
            "How the skill was mentioned. Use EXACTLY one of these values: "
            "'required' — the job says 'must have', 'required', 'mandatory', 'essential'. "
            "'preferred' — the job says 'preferred', 'nice to have', 'a plus', 'beneficial'. "
            "'optional' — the job says 'optional', 'bonus', 'good to have'. "
            "'not_required' — the job explicitly says 'NOT required', 'no experience needed', 'not mandatory'."
        )
    )
    proficiency: str = Field(
        description=(
            "Normalized proficiency level. Use EXACTLY one of: "
            "'basic' — for: familiarity, exposure, awareness, basic knowledge. "
            "'intermediate' — for: working knowledge, comfortable with, 1-3 years, experience with. "
            "'advanced' — for: strong experience, expert, proficient, 4+ years, deep knowledge."
        )
    )
    importance: str = Field(
        description="How critical is this skill to the role. Use EXACTLY one of: 'low', 'medium', 'high'"
    )
    confidence: float = Field(
        description=(
            "Your confidence that this skill was correctly extracted. Float from 0.0 to 1.0. "
            "1.0 = the skill is explicitly named. "
            "0.7 = implied but reasonable. "
            "0.5 = uncertain. "
            "Never go below 0.5 — if you are less sure than 50%, do not include the skill."
        )
    )
    evidence: str = Field(
        description=(
            "Copy the EXACT sentence or phrase from the job description that proves this skill. "
            "This is mandatory. It allows humans to verify every AI decision. "
            "Example: 'We require 3+ years of React experience.'"
        )
    )
    is_negated: bool = Field(
        description=(
            "Set TRUE if the job explicitly says this skill is NOT needed. "
            "Examples: 'Docker is NOT required', 'No Kubernetes experience needed', "
            "'We do not require AWS knowledge'. "
            "NEVER count a negated skill as demanded. This is critical for data quality."
        )
    )
    years_min: Optional[int] = Field(
        default=None,
        description="Minimum years of experience if mentioned. e.g., '3+ years' -> 3. Leave null if not mentioned."
    )
    years_max: Optional[int] = Field(
        default=None,
        description="Maximum years of experience if mentioned. e.g., '3-5 years' -> 5. Leave null if not mentioned."
    )


class JobExtraction(BaseModel):
    """One complete job analysis result."""
    job_id: str = Field(
        description="Copy the Job ID exactly as provided. This links the result back to the right job."
    )
    role: str = Field(
        description=(
            "The canonical job role. Normalize variations: "
            "'Full Stack Developer', 'Frontend Engineer', 'Data Scientist', "
            "'DevOps Engineer', 'Machine Learning Engineer', 'Backend Developer', etc. "
            "Do NOT use the raw job title. Identify the underlying role."
        )
    )
    experience_level: str = Field(
        description=(
            "Overall experience level of the role. Use EXACTLY one of: "
            "'entry' (0-2 years / fresher / junior / graduate). "
            "'mid' (2-5 years / mid-level / associate). "
            "'senior' (5+ years / senior / lead / staff). "
            "'unknown' if not clearly specified."
        )
    )
    work_mode: str = Field(
        description=(
            "How is the work done? Use EXACTLY one of: "
            "'remote' — fully remote, work from home, WFH, anywhere. "
            "'hybrid' — hybrid, part remote, some days in office. "
            "'on_site' — on-site, in-office, location required."
        )
    )
    skills: list[ExtractedSkill] = Field(
        description=(
            "ALL skills mentioned in the job. Include both technical and soft skills. "
            "Include skills mentioned as 'not required' (set is_negated=True for those). "
            "Each skill must have all 9 fields filled."
        )
    )


class BatchExtraction(BaseModel):
    """Container for multiple job extractions in one Gemini call."""
    extractions: list[JobExtraction] = Field(
        description="One JobExtraction per job in the batch. Must match job count exactly."
    )


# =============================================================================
# TEXT CLEANING
# =============================================================================

def clean_html(raw_html: str) -> str:
    """
    Strips HTML tags from job descriptions.
    WHY: APIs return job descriptions with <p>, <li>, <b> tags.
    Those tags confuse the AI and waste tokens.
    BeautifulSoup extracts just the text.
    """
    if not raw_html:
        return ""
    return BeautifulSoup(raw_html, "html.parser").get_text(separator=" ", strip=True)


def get_description_hash(description: str) -> str:
    """
    Creates a unique fingerprint for a job description.

    WHY: If the same job appears on LinkedIn AND Naukri with different IDs,
    they'll have the same description hash. We detect this BEFORE calling
    Gemini — saving API cost and preventing duplicate skill data in our DB.

    HOW: SHA-256 hash of the lowercased, stripped text. Returns first 32 chars.
    """
    clean = description.lower().strip()
    return hashlib.sha256(clean.encode()).hexdigest()[:32]


# =============================================================================
# MAIN EXTRACTION FUNCTION
# =============================================================================

# Current prompt version — increment this when you change the prompt
# WHY: Stored in the DB so we know which extractions to reprocess after upgrades.
PROMPT_VERSION = "v2.0"
MODEL_NAME = "gemini-3.5-flash-lite"

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=5, max=30))
def extract_jobs_batch(jobs: list) -> dict:
    """
    Sends a batch of jobs to Gemini and gets back structured intelligence.

    HOW IT WORKS:
    1. Clean each job description (strip HTML, truncate)
    2. Build a detailed prompt with explicit examples
    3. Call Gemini with a structured response schema (Pydantic)
    4. Validate the response (Pydantic rejects invalid output)
    5. Return a dictionary: {job_id -> extraction_dict}

    WHY BATCHING?
    Sending 5 jobs in one call is much cheaper and faster than 5 separate calls.
    We batch up to 5 jobs per Gemini request.

    RETURNS:
    A dict where keys are job_ids and values are extraction dicts.
    Returns empty dict if the entire batch fails (jobs will be retried).
    """
    if not jobs:
        return {}

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("[ERROR] GEMINI_API_KEY not found. Add it to your .env file.")
        return {}

    client = genai.Client(api_key=api_key)

    # Build the job text for the prompt
    jobs_text = ""
    for idx, job in enumerate(jobs):
        job_desc_clean = clean_html(job.get("description", ""))
        jobs_text += f"\n\n{'='*50}\n"
        jobs_text += f"JOB {idx + 1} OF {len(jobs)}\n"
        jobs_text += f"Job ID: {job.get('job_id')}\n"
        jobs_text += f"Title: {job.get('title')}\n"
        jobs_text += f"Company: {job.get('company')}\n"
        jobs_text += f"Location: {job.get('location', 'Not specified')}\n"
        # 5000 chars per job max to stay within token limits
        jobs_text += f"Description:\n{job_desc_clean[:5000]}\n"

    prompt = f"""
You are an expert Labour Market Intelligence analyst for the Indian government's
Skill India programme. Your job is to extract STRUCTURED data from job descriptions
to help identify skill gaps in education and training.

CRITICAL RULES (breaking any of these corrupts our government data):

RULE 1 — NEGATION DETECTION:
If a job says "Docker is NOT required" or "no Kubernetes experience needed" —
set is_negated = TRUE. These skills must NEVER be counted as market demand.
Examples of negated skills:
- "Docker is not required" → is_negated: true
- "No prior experience with AWS needed" → is_negated: true
- "We do not expect knowledge of Kubernetes" → is_negated: true

RULE 2 — REQUIRED vs PREFERRED:
"React is required" and "React is preferred" are VERY different.
- "Must have", "required", "mandatory", "essential" → required_status: "required"
- "Preferred", "nice to have", "a plus", "beneficial", "ideal" → required_status: "preferred"
- "Optional", "bonus", "good to have" → required_status: "optional"
- Any negation → required_status: "not_required"

RULE 3 — EVIDENCE IS MANDATORY:
For every skill, copy the EXACT sentence from the description into `evidence`.
This allows government auditors to verify every AI decision.
Example: evidence: "We require 3+ years of React experience in a commercial project."

RULE 4 — CONFIDENCE SCORING:
- 1.0 = skill is explicitly named (e.g., "Experience with React is required")
- 0.8 = skill is clearly implied (e.g., "You will build React components daily")
- 0.6 = skill is mentioned but context is unclear
- NEVER include a skill you are less than 60% confident about

RULE 5 — DO NOT INVENT:
If a skill is not mentioned in the description, do not include it.
If you are not sure about the required_status, use "preferred" not "required".
When in doubt, lower the confidence score.

NOW ANALYZE THESE {len(jobs)} JOB(S):

{jobs_text}
"""

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=BatchExtraction
            )
        )

        result = json.loads(response.text)

        # Build job_id -> extraction dictionary
        ext_dict = {}
        for ext in result.get("extractions", []):
            ext["model_name"] = MODEL_NAME
            ext["prompt_version"] = PROMPT_VERSION
            ext_dict[ext["job_id"]] = ext

        return ext_dict

    except json.JSONDecodeError as e:
        print(f"[ERROR] Gemini returned invalid JSON for batch of {len(jobs)} jobs: {e}")
        return {}
    except Exception as e:
        print(f"[ERROR] Gemini API call failed for batch of {len(jobs)} jobs: {e}")
        return {}
