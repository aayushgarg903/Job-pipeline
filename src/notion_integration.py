import os
from notion_client import Client
from bs4 import BeautifulSoup

def clean_html(raw_html):
    if not raw_html:
        return ""
    return BeautifulSoup(raw_html, "html.parser").get_text(separator="\n", strip=True)

def split_text(text, limit=2000):
    """Notion text block length limit is 2000 characters."""
    return [text[i:i+limit] for i in range(0, len(text), limit)]

def add_to_notion(job, match_result):
    notion_token = os.getenv("NOTION_TOKEN")
    database_id = os.getenv("NOTION_DATABASE_ID")
    
    if not notion_token or not database_id:
        print("Notion credentials not found in environment variables.")
        return None
        
    notion = Client(auth=notion_token)
    
    # Prepare properties
    properties = {
        "Name": {
            "title": [{"text": {"content": job.get("title", "")[:2000]}}]
        },
        "Company": {
            "rich_text": [{"text": {"content": job.get("company", "")[:2000]}}]
        },
        "Match Score": {
            "number": match_result.get("match_score", 0)
        },
        "Status": {
            "select": {"name": "Inbox"}
        },
        "URL": {
            "url": job.get("url") if job.get("url") and len(job.get("url")) < 2000 else None
        }
    }
    
    missing_skills = match_result.get("missing_skills", [])
    if missing_skills:
        # Notion multi-select options cannot contain commas, so we clean them
        safe_skills = [{"name": skill.replace(",", "")[:100]} for skill in missing_skills[:100]] # Limit to 100 max
        properties["Missing Skills"] = {"multi_select": safe_skills}
        
    # Prepare children (page body)
    children = []
    
    # AI Cover Letter
    children.append({
        "object": "block",
        "type": "heading_2",
        "heading_2": {"rich_text": [{"type": "text", "text": {"content": "📝 AI Cover Letter"}}]}
    })
    
    cover_letter = match_result.get("cover_letter", "No cover letter generated.")
    for chunk in split_text(cover_letter):
        children.append({
            "object": "block",
            "type": "paragraph",
            "paragraph": {"rich_text": [{"type": "text", "text": {"content": chunk}}]}
        })
        
    # Target Interview Questions
    children.append({
        "object": "block",
        "type": "heading_2",
        "heading_2": {"rich_text": [{"type": "text", "text": {"content": "🎯 Target Interview Questions"}}]}
    })
    
    questions = match_result.get("interview_questions", [])
    for q in questions:
        for chunk in split_text(q):
            children.append({
                "object": "block",
                "type": "bulleted_list_item",
                "bulleted_list_item": {"rich_text": [{"type": "text", "text": {"content": chunk}}]}
            })

    # Job Summary & Requirements
    children.append({
        "object": "block",
        "type": "heading_2",
        "heading_2": {"rich_text": [{"type": "text", "text": {"content": "📄 Job Summary & Requirements"}}]}
    })
    
    job_desc = clean_html(job.get("description", "No description available."))
    # Truncate Job description to avoid too many blocks/API limits (e.g. keeping first ~6000 chars)
    for chunk in split_text(job_desc[:6000]):
        children.append({
            "object": "block",
            "type": "paragraph",
            "paragraph": {"rich_text": [{"type": "text", "text": {"content": chunk}}]}
        })

    try:
        new_page = notion.pages.create(
            parent={"database_id": database_id},
            properties=properties,
            children=children[:100] # Notion limit is 100 blocks per request
        )
        return new_page.get("url")
    except Exception as e:
        print(f"Error saving to Notion for job {job.get('job_id')}: {e}")
        return None
