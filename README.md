# My Automated Job-Hunting Pipeline & Career CRM 🚀

Hey there! I'm a Software Engineer with a core strength in Backend Development (Java, Spring Boot) and Data Structures & Algorithms. I also love using AI and "vibe coding" to build full-stack solutions. 

I got tired of manually searching for jobs and tracking them, so **I built this 100% free, private, headless 24/7 job-hunting engine on my own.**

This project runs on Python and GitHub Actions. It automatically ingests public job feeds, evaluates how well I fit the roles using Google Gemini, stores the high-match opportunities in my personal Notion database, and even sends me instant email notifications so I never miss a great opportunity!

## 🌟 Why I Built This

Job hunting can be a repetitive and time-consuming process. As an engineer, I believe in automating the boring stuff. I wanted a system that:
- Works for me while I sleep.
- Understands my specific engineering profile and skills.
- Keeps my pipeline organized in Notion without manual data entry.
- Alerts me instantly when a highly relevant role is posted.

## ✨ Features I Implemented

- **Automated Job Ingestion:** The system fetches remote jobs from free sources like the Remotive API and Arbeitnow API.
- **AI-Powered Evaluation (Gemini):** I integrated the Google Gemini API to act as my personal recruiter. It evaluates how well my profile matches each job description, calculates a match score (0-100), and even drafts a tailored cover letter and interview questions for me.
- **Notion CRM Sync:** I built an integration with Notion so that any job with a match score >= 75 is automatically added to my database, complete with all AI insights.
- **Instant Email Alerts:** For top-tier jobs (match score >= 80), the system fires off an HTML email alert directly to my inbox.
- **24/7 Cloud Automation:** I deployed this on GitHub Actions to run automatically every 30 minutes. 

## 🛠️ Tech Stack Used

- **Language:** Python
- **APIs:** Google Gemini API, Notion API, Remotive API, Arbeitnow API
- **Automation:** GitHub Actions (Cron Jobs)
- **Other:** SMTP for Email Alerts

## 🚀 Setup Instructions (If You Want to Try My Setup)

### 1. Configure Your Profile
Edit the `config/profile.json` file with your actual details. The AI uses this file to evaluate your fit for each job.

### 2. Notion Integration Setup
1. Go to [Notion My Integrations](https://www.notion.so/my-integrations) and create a new integration. Get the **Internal Integration Secret** (`NOTION_TOKEN`).
2. Create a new full-page Database in Notion (e.g., named "Opportunities").
3. Add the following properties to the database:
   - `Job Title` (Type: Title)
   - `Company` (Type: Rich Text)
   - `Match Score` (Type: Number)
   - `Status` (Type: Select, add an option "Inbox")
   - `Missing Skills` (Type: Multi-select)
   - `URL` (Type: URL)
4. Share the database with your integration by clicking the `...` menu on the top right of the database page, selecting `Add connections`, and choosing your integration.
5. Get the **Database ID** from the URL: `https://www.notion.so/workspace/<DATABASE_ID>?v=...`.

### 3. Google Gemini Setup
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Generate an API Key (`GEMINI_API_KEY`).

### 4. Gmail Setup (For Email Alerts)
1. Ensure your Gmail account has 2-Step Verification enabled.
2. Go to your Google Account > Security > App passwords.
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
4. Make sure your GitHub Actions have write permissions in your repository settings to commit back `data/seen_jobs.json` (Settings > Actions > General > Workflow permissions -> Read and write permissions).
5. Trigger the workflow manually or wait for the cron schedule!

---
*Built with ❤️ by a Software Engineer who loves automating things.*

5. You can trigger the workflow manually from the "Actions" tab or wait for the cron schedule (every 30 mins).
