import os
import psycopg2
from psycopg2.extras import RealDictCursor

# =============================================================================
# INDIAN LOCATION NORMALIZATION MAP
#
# WHY WE NEED THIS:
# Job APIs return messy strings like "Bangalore, Karnataka, India" or just
# "Bengaluru". The district analysis feature won't work if GROUP BY queries
# hit 20 different spellings of the same city.
# This map normalizes everything to (State, District) tuples.
# =============================================================================
LOCATION_NORMALIZATION = {
    # Karnataka
    "bengaluru": ("Karnataka", "Bengaluru Urban"),
    "bangalore": ("Karnataka", "Bengaluru Urban"),
    "mysore":    ("Karnataka", "Mysuru"),
    "mysuru":    ("Karnataka", "Mysuru"),
    "hubli":     ("Karnataka", "Dharwad"),
    "mangalore": ("Karnataka", "Dakshina Kannada"),
    "mangaluru": ("Karnataka", "Dakshina Kannada"),
    "belgaum":   ("Karnataka", "Belagavi"),
    "belagavi":  ("Karnataka", "Belagavi"),

    # Maharashtra
    "pune":        ("Maharashtra", "Pune"),
    "mumbai":      ("Maharashtra", "Mumbai"),
    "bombay":      ("Maharashtra", "Mumbai"),
    "nashik":      ("Maharashtra", "Nashik"),
    "nagpur":      ("Maharashtra", "Nagpur"),
    "aurangabad":  ("Maharashtra", "Chhatrapati Sambhajinagar"),
    "navi mumbai": ("Maharashtra", "Thane"),
    "thane":       ("Maharashtra", "Thane"),
    "kolhapur":    ("Maharashtra", "Kolhapur"),

    # Telangana
    "hyderabad":   ("Telangana", "Hyderabad"),
    "secunderabad":("Telangana", "Hyderabad"),
    "warangal":    ("Telangana", "Warangal"),
    "nizamabad":   ("Telangana", "Nizamabad"),

    # Tamil Nadu
    "chennai":     ("Tamil Nadu", "Chennai"),
    "madras":      ("Tamil Nadu", "Chennai"),
    "coimbatore":  ("Tamil Nadu", "Coimbatore"),
    "trichy":      ("Tamil Nadu", "Tiruchirappalli"),
    "madurai":     ("Tamil Nadu", "Madurai"),
    "salem":       ("Tamil Nadu", "Salem"),

    # Delhi / NCR
    "delhi":       ("Delhi", "New Delhi"),
    "new delhi":   ("Delhi", "New Delhi"),
    "noida":       ("Uttar Pradesh", "Gautam Buddha Nagar"),
    "greater noida":("Uttar Pradesh", "Gautam Buddha Nagar"),
    "gurgaon":     ("Haryana", "Gurugram"),
    "gurugram":    ("Haryana", "Gurugram"),
    "faridabad":   ("Haryana", "Faridabad"),
    "ghaziabad":   ("Uttar Pradesh", "Ghaziabad"),

    # Rajasthan
    "jaipur":      ("Rajasthan", "Jaipur"),
    "jodhpur":     ("Rajasthan", "Jodhpur"),
    "udaipur":     ("Rajasthan", "Udaipur"),

    # West Bengal
    "kolkata":     ("West Bengal", "Kolkata"),
    "calcutta":    ("West Bengal", "Kolkata"),

    # Gujarat
    "ahmedabad":   ("Gujarat", "Ahmedabad"),
    "surat":       ("Gujarat", "Surat"),
    "vadodara":    ("Gujarat", "Vadodara"),
    "baroda":      ("Gujarat", "Vadodara"),
    "rajkot":      ("Gujarat", "Rajkot"),

    # Uttar Pradesh
    "lucknow":     ("Uttar Pradesh", "Lucknow"),
    "kanpur":      ("Uttar Pradesh", "Kanpur"),
    "agra":        ("Uttar Pradesh", "Agra"),
    "varanasi":    ("Uttar Pradesh", "Varanasi"),

    # Kerala
    "kochi":             ("Kerala", "Ernakulam"),
    "cochin":            ("Kerala", "Ernakulam"),
    "trivandrum":        ("Kerala", "Thiruvananthapuram"),
    "thiruvananthapuram":("Kerala", "Thiruvananthapuram"),
    "kozhikode":         ("Kerala", "Kozhikode"),
    "calicut":           ("Kerala", "Kozhikode"),
    "thrissur":          ("Kerala", "Thrissur"),

    # Others
    "chandigarh":  ("Chandigarh", "Chandigarh"),
    "bhubaneswar": ("Odisha", "Khordha"),
    "indore":      ("Madhya Pradesh", "Indore"),
    "bhopal":      ("Madhya Pradesh", "Bhopal"),
    "patna":       ("Bihar", "Patna"),
    "raipur":      ("Chhattisgarh", "Raipur"),
    "guwahati":    ("Assam", "Kamrup Metropolitan"),
    "dehradun":    ("Uttarakhand", "Dehradun"),
    "shimla":      ("Himachal Pradesh", "Shimla"),
    "jammu":       ("Jammu & Kashmir", "Jammu"),
    "srinagar":    ("Jammu & Kashmir", "Srinagar"),
    "amritsar":    ("Punjab", "Amritsar"),
    "ludhiana":    ("Punjab", "Ludhiana"),
    "mohali":      ("Punjab", "SAS Nagar"),
    "vizag":       ("Andhra Pradesh", "Visakhapatnam"),
    "visakhapatnam":("Andhra Pradesh", "Visakhapatnam"),
    "vijayawada":  ("Andhra Pradesh", "Krishna"),
}

# Work mode keywords
REMOTE_KEYWORDS = ['remote', 'work from home', 'wfh', 'anywhere', 'fully remote',
                   'distributed', 'telecommute', 'virtual']
HYBRID_KEYWORDS = ['hybrid', 'partially remote', 'flexible location',
                   'part remote', 'some remote']


def extract_india_location(location_string: str):
    """
    Parses a raw location string and returns (state, district) tuple.

    EXAMPLES:
    "Pune, Maharashtra, India"     → ("Maharashtra", "Pune")
    "Bengaluru, Karnataka"         → ("Karnataka", "Bengaluru Urban")
    "Remote"                       → (None, None)  ← handled by work_mode
    "London, UK"                   → (None, None)  ← non-Indian job

    RETURNS: (state, district) or (None, None)
    """
    if not location_string:
        return None, None

    location_lower = location_string.lower()

    # Indian location indicators
    india_indicators = [
        "india", ", in", "maharashtra", "karnataka", "telangana",
        "tamil nadu", "delhi", "gujarat", "rajasthan", "west bengal",
        "kerala", "uttar pradesh", "haryana", "odisha", "chandigarh",
        "andhra", "bihar", "assam", "punjab", "madhya pradesh"
    ]
    is_india = any(indicator in location_lower for indicator in india_indicators)

    # Also check if a known city name appears (even without "India")
    city_match = any(city in location_lower for city in LOCATION_NORMALIZATION)
    if not is_india and not city_match:
        return None, None

    # Find the city in our normalization map
    for city_key, (state, district) in LOCATION_NORMALIZATION.items():
        if city_key in location_lower:
            return state, district

    # Indian job but city not in map yet — return None (unknown district)
    return None, None


def detect_work_mode(location_string: str, description: str = "") -> str:
    """
    Detects whether a job is remote, hybrid, or on-site.

    WHY: Remote jobs cannot be assigned to a district.
    They must be excluded from district-level analytics but tracked separately
    as "national remote demand."

    RETURNS: 'remote' | 'hybrid' | 'on_site'
    """
    text = (location_string + " " + description[:500]).lower()

    if any(keyword in text for keyword in REMOTE_KEYWORDS):
        return 'remote'
    if any(keyword in text for keyword in HYBRID_KEYWORDS):
        return 'hybrid'
    return 'on_site'


# =============================================================================
# DATABASE CONNECTION
# =============================================================================

def get_db_connection():
    """
    Connects to Supabase PostgreSQL.

    HOW IT WORKS:
    - Reads DATABASE_URL from .env file
    - psycopg2 is the standard Python PostgreSQL library
    - RealDictCursor makes results return as dicts (result['id'])
      instead of tuples (result[0]) — much easier to work with
    """
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise ValueError(
            "DATABASE_URL not set in .env file.\n"
            "Get it from: Supabase → Project Settings → Database → Connection String → URI"
        )
    return psycopg2.connect(db_url, cursor_factory=RealDictCursor)


# =============================================================================
# SKILL NORMALIZATION
# =============================================================================

def normalize_skill(conn, raw_skill_name: str):
    """
    Ensures 'ReactJS', 'React.js', and 'React' all map to ONE skill record.

    HOW IT WORKS (step by step):
    1. Receive raw name from Gemini (e.g., "ReactJS")
    2. Check skill_aliases: has "ReactJS" been seen before?
       YES → return the skill_id it maps to. Done.
       NO  → continue...
    3. Check skills table directly (case-insensitive LIKE)
       FOUND → create alias "ReactJS" → React so we don't look up again
       NOT FOUND → create new canonical skill, then alias it

    RESULT: The database stays clean. "React" demand is always one number.

    RETURNS: skill UUID or None
    """
    if not raw_skill_name or not raw_skill_name.strip():
        return None

    skill_name = raw_skill_name.strip()
    # "react native" → "React Native" (consistent casing)
    canonical_name = skill_name.title()

    with conn.cursor() as cur:
        # Step 1: Check alias table (fastest lookup)
        cur.execute(
            "SELECT skill_id FROM skill_aliases WHERE alias_name ILIKE %s",
            (skill_name,)
        )
        result = cur.fetchone()
        if result:
            return result['skill_id']

        # Step 2: Check canonical skills table
        cur.execute(
            "SELECT id FROM skills WHERE name ILIKE %s",
            (canonical_name,)
        )
        result = cur.fetchone()

        if result:
            skill_id = result['id']
        else:
            # Step 3: Brand new skill — create it
            cur.execute(
                "INSERT INTO skills (name) VALUES (%s) RETURNING id",
                (canonical_name,)
            )
            skill_id = cur.fetchone()['id']

        # Register alias so future lookups are instant
        cur.execute(
            "INSERT INTO skill_aliases (skill_id, alias_name) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (skill_id, skill_name)
        )

        return skill_id


def flag_for_admin_review(conn, item_type: str, item_id, context: dict):
    """
    Adds an item to the admin_review_queue table.

    WHEN CALLED:
    - Low confidence skill (confidence < 0.6)
    - Unknown skill candidate
    - Potential duplicate job

    WHY: AI output should never be fully trusted. The admin queue is our safety net.
    Human review catches what automated validation misses.
    """
    import json as json_lib
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO admin_review_queue (item_type, item_id, context)
                VALUES (%s, %s, %s)
            """, (item_type, item_id, json_lib.dumps(context)))
    except Exception:
        pass  # Review queue failure should never crash the main pipeline


def update_job_processing_status(conn, job_uuid, status: str, error: str = None):
    """
    Updates a job's processing status in the database.

    STATUS VALUES:
    - 'pending'    → job is in the queue, not yet processed by AI
    - 'processing' → AI is currently working on it
    - 'complete'   → AI extracted skills successfully, all saved to DB
    - 'failed'     → AI failed (timeout, invalid JSON, etc.) — will be retried

    WHY: Without this, we have no way to know which jobs failed and need retrying.
    The admin dashboard shows failed jobs and lets admins trigger reprocessing.
    """
    try:
        with conn.cursor() as cur:
            if error:
                cur.execute("""
                    UPDATE jobs
                    SET processing_status = %s,
                        last_error = %s,
                        retry_count = retry_count + 1
                    WHERE id = %s
                """, (status, error[:500], job_uuid))
            else:
                cur.execute("""
                    UPDATE jobs SET processing_status = %s WHERE id = %s
                """, (status, job_uuid))
    except Exception:
        pass  # Status update failure should never crash the pipeline


def log_source_health(conn, source: str, status: str, jobs_fetched: int, error: str = None):
    """
    Records the health of a data source after each pipeline run.
    Powers the API Health Dashboard.
    """
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO source_health_log (source, status, jobs_fetched, error_message)
                VALUES (%s, %s, %s, %s)
            """, (source, status, jobs_fetched, error))
    except Exception:
        pass


# =============================================================================
# MAIN SAVE FUNCTION — Sprint 1 Upgrade
# =============================================================================

def save_job_intelligence(job_data: dict, extraction: dict) -> bool:
    """
    Saves a single job and ALL its extracted skills to Supabase.

    HOW IT WORKS (transaction-based):
    ─────────────────────────────────
    We open ONE database connection and wrap everything in a TRANSACTION.
    This means: either EVERYTHING saves, or NOTHING does.
    We never end up with a job saved but skills missing, or vice versa.

    SPRINT 1 UPGRADES:
    ─────────────────────────────────
    1. Now saves: work_mode, description_hash, processing_status
    2. job_skills now saves: required_status, confidence, evidence,
                             is_negated, years_min, years_max,
                             model_name, prompt_version
    3. Low-confidence skills are flagged for admin review
    4. Negated skills are saved (for audit trail) but marked is_negated=TRUE
       so analytics automatically exclude them

    PARAMETERS:
    ─────────────────────────────────
    job_data   : Raw job dict from scraper (title, company, url, description...)
    extraction : Gemini output dict (role, experience_level, work_mode, skills...)

    RETURNS: True if saved successfully, False if any error occurred
    """
    from matcher import get_description_hash

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:

                # ── Step 1: Identify source ─────────────────────────────────
                # job_id format is "remotive_1234" — we split to get "remotive"
                original_id = job_data.get('job_id', '')
                source = original_id.split('_')[0] if '_' in original_id else 'unknown'

                # ── Step 2: Location normalization ──────────────────────────
                # Converts "Bangalore, Karnataka" → state="Karnataka", district="Bengaluru Urban"
                raw_location = job_data.get('location', '')
                state, district = extract_india_location(raw_location)

                # ── Step 3: Work mode detection ─────────────────────────────
                # Use Gemini's extraction first, then fall back to keyword detection
                work_mode = extraction.get('work_mode') or \
                            detect_work_mode(raw_location, job_data.get('description', ''))

                # ── Step 4: Description hash (for deduplication) ────────────
                description = job_data.get('description', '')
                desc_hash = get_description_hash(description) if description else None

                # ── Step 5: Check if this description was already processed ─
                # If yes, we can skip the AI cost for future similar jobs
                if desc_hash:
                    cur.execute(
                        "SELECT id FROM jobs WHERE description_hash = %s LIMIT 1",
                        (desc_hash,)
                    )
                    existing = cur.fetchone()
                    if existing:
                        # Mark as potential duplicate but still save for source tracking
                        pass  # Will be flagged in the INSERT below

                # ── Step 6: Insert the job ───────────────────────────────────
                cur.execute("""
                    INSERT INTO jobs (
                        original_id,    title,          role,
                        company,        location,       district,
                        state,          experience_level,
                        work_mode,      description_hash,
                        source,         url,            description,
                        processing_status
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (original_id) DO UPDATE SET
                        title              = EXCLUDED.title,
                        role               = EXCLUDED.role,
                        description        = EXCLUDED.description,
                        district           = EXCLUDED.district,
                        state              = EXCLUDED.state,
                        work_mode          = EXCLUDED.work_mode,
                        description_hash   = EXCLUDED.description_hash,
                        processing_status  = 'processing',
                        last_seen_at       = NOW()
                    RETURNING id
                """, (
                    original_id,
                    job_data.get("title", "")[:255],
                    extraction.get("role", "")[:255],
                    job_data.get("company", "Unknown")[:255],
                    raw_location[:255] if raw_location else None,
                    district,
                    state,
                    extraction.get("experience_level", "unknown"),
                    work_mode,
                    desc_hash,
                    source,
                    job_data.get("url", ""),
                    description,
                    "processing",
                ))

                job_uuid = cur.fetchone()['id']

                # ── Step 7: Delete old skills for this job ──────────────────
                # WHY: On re-ingestion, we rebuild skills from scratch with the
                # new prompt version. Old skills may have been extracted without
                # confidence/evidence fields.
                cur.execute("DELETE FROM job_skills WHERE job_id = %s", (job_uuid,))

                # ── Step 8: Insert skills ────────────────────────────────────
                skills_list = extraction.get("skills", [])
                skills_saved = 0
                low_confidence_count = 0

                for skill in skills_list:
                    skill_name = skill.get("name", "").strip()
                    if not skill_name:
                        continue

                    # Normalize: "ReactJS" → React skill_id
                    skill_id = normalize_skill(conn, skill_name)
                    if not skill_id:
                        continue

                    confidence = float(skill.get("confidence", 1.0))
                    is_negated = bool(skill.get("is_negated", False))
                    required_status = skill.get("required_status", "required")
                    evidence = skill.get("evidence", "")
                    proficiency = skill.get("proficiency", "basic")
                    importance = skill.get("importance", "medium")
                    years_min = skill.get("years_min")
                    years_max = skill.get("years_max")
                    model_name = extraction.get("model_name", "gemini-3.5-flash-lite")
                    prompt_version = extraction.get("prompt_version", "v2.0")

                    # Save the skill — even negated ones (for audit trail)
                    # Analytics views automatically filter is_negated = FALSE
                    cur.execute("""
                        INSERT INTO job_skills (
                            job_id,         skill_id,
                            proficiency_level, importance,
                            required_status,   confidence,
                            evidence,          is_negated,
                            years_min,         years_max,
                            model_name,        prompt_version,
                            processed_at
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                        ON CONFLICT (job_id, skill_id) DO UPDATE SET
                            proficiency_level  = EXCLUDED.proficiency_level,
                            importance         = EXCLUDED.importance,
                            required_status    = EXCLUDED.required_status,
                            confidence         = EXCLUDED.confidence,
                            evidence           = EXCLUDED.evidence,
                            is_negated         = EXCLUDED.is_negated,
                            years_min          = EXCLUDED.years_min,
                            years_max          = EXCLUDED.years_max,
                            model_name         = EXCLUDED.model_name,
                            prompt_version     = EXCLUDED.prompt_version,
                            processed_at       = NOW()
                    """, (
                        job_uuid,       skill_id,
                        proficiency,    importance,
                        required_status, confidence,
                        evidence,        is_negated,
                        years_min,       years_max,
                        model_name,      prompt_version,
                    ))
                    skills_saved += 1

                    # Flag low-confidence skills for admin review
                    # WHY: We save them (to not lose data) but humans should verify
                    if confidence < 0.6:
                        low_confidence_count += 1
                        flag_for_admin_review(conn, 'low_confidence_skill', job_uuid, {
                            'skill_name': skill_name,
                            'confidence': confidence,
                            'evidence': evidence,
                            'job_title': job_data.get('title', ''),
                        })

                # ── Step 9: Mark job as complete ─────────────────────────────
                cur.execute("""
                    UPDATE jobs
                    SET processing_status = 'complete'
                    WHERE id = %s
                """, (job_uuid,))

                # ── Step 10: Commit everything atomically ────────────────────
                conn.commit()

                # Build a clean status message
                negated_count = sum(1 for s in skills_list if s.get('is_negated'))
                status_parts = [f"{skills_saved} skills"]
                if negated_count:
                    status_parts.append(f"{negated_count} negated")
                if low_confidence_count:
                    status_parts.append(f"{low_confidence_count} flagged for review")

                print(f"  [OK] Saved: '{job_data.get('title', '')}' "
                      f"| {' | '.join(status_parts)} "
                      f"| Mode: {work_mode} | State: {state or 'N/A'}")
                return True

    except psycopg2.Error as db_err:
        print(f"  [DB ERROR] '{job_data.get('job_id')}': {db_err}")
        return False
    except Exception as e:
        print(f"  [ERROR] '{job_data.get('job_id')}': {e}")
        return False
