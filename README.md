# Job-Hunting Pipeline & Career CRM

This is a 100% free, private, headless 24/7 job-hunting engine running on Python and GitHub Actions. It ingests public job feeds, evaluates job fit against your candidate profile using Google Gemini, stores high-match opportunities in a Notion database, and sends instant email notifications.

## Features

- **Automated Ingestion:** Fetches remote jobs from free sources (Remotive API, Arbeitnow API).
- **AI Evaluation:** Uses Gemini API to evaluate how well your profile matches the job description, calculating a match score (0-100), and generating a tailored cover letter and interview questions.
- **Notion CRM Sync:** Automatically adds jobs with a match score >= 75 to your Notion database, along with the AI insights.
- **Email Alerts:** Sends an instant HTML email alert for jobs with a match score >= 80.
- **24/7 Cloud Automation:** Runs automatically every 30 minutes via GitHub Actions.

## Setup Instructions

### 1. Configure Your Profile
Edit the `config/profile.json` file with your actual details. This file is used by the AI to evaluate your fit for each job.

### 2. Notion Integration Setup
1. Go to [Notion My Integrations](https://www.notion.so/my-integrations) and create a new integration. Get the **Internal Integration Secret** (`NOTION_TOKEN`).
2. Create a new full-page Database in Notion (e.g. named "Opportunities").
3. Add the following properties to the database:
   - `Job Title` (Type: Title)
   - `Company` (Type: Rich Text)
   - `Match Score` (Type: Number)
   - `Status` (Type: Select, add an option "Inbox")
   - `Missing Skills` (Type: Multi-select)
   - `URL` (Type: URL)
4. Share the database with your integration by clicking the `...` menu on the top right of the database page, selecting `Add connections`, and choosing your integration.
5. Get the **Database ID** from the URL (the string of characters between your workspace name and the `?v=` parameter): `https://www.notion.so/workspace/<DATABASE_ID>?v=...`.

### 3. Google Gemini Setup
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Generate an API Key (`GEMINI_API_KEY`).

### 4. Gmail Setup (For Email Alerts)
1. Ensure your Gmail account has 2-Step Verification enabled.
2. Go to your Google Account > Security > App passwords (you may need to search for it).
3. Generate an App password for this script (`GMAIL_APP_PASSWORD`). 
4. Your `GMAIL_SENDER` is your Gmail email address.

### 5. Local Testing
Copy `.env.example` to `.env` and fill in the values:
```bash
cp .env.example .env
pip install -r requirements.txt
python src/main.py
```

### 6. Deploy to GitHub Actions
1. Push this repository to GitHub.
2. In your repository, go to **Settings** > **Secrets and variables** > **Actions**.
3. Add the following **Repository Secrets**:
   - `GEMINI_API_KEY`
   - `NOTION_TOKEN`
   - `NOTION_DATABASE_ID`
   - `GMAIL_SENDER`
   - `GMAIL_APP_PASSWORD`
   - `NOTIFICATION_RECEIVER`
4. The workflow relies on committing back `data/seen_jobs.json`. Make sure your GitHub Actions have write permissions in your repository settings (Settings > Actions > General > Workflow permissions -> Read and write permissions).
5. You can trigger the workflow manually from the "Actions" tab or wait for the cron schedule (every 30 mins).
