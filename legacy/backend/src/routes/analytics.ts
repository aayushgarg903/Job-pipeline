import { Router } from 'express';
import { query } from '../db';

const router = Router();

// GET /api/analytics/dashboard-kpis
router.get('/dashboard-kpis', async (req, res) => {
  try {
    const jobsCount = await query('SELECT COUNT(*) FROM jobs');
    const skillsCount = await query('SELECT COUNT(DISTINCT skill_id) FROM job_skills');
    
    // Top demanded skill
    const topSkillQuery = `
      SELECT s.name, COUNT(js.job_id) as demand
      FROM job_skills js
      JOIN skills s ON js.skill_id = s.id
      GROUP BY s.id, s.name
      ORDER BY demand DESC
      LIMIT 1
    `;
    const topSkillResult = await query(topSkillQuery);
    
    res.json({
      total_jobs: parseInt(jobsCount.rows[0].count),
      unique_skills: parseInt(skillsCount.rows[0].count),
      top_skill: topSkillResult.rows.length > 0 ? topSkillResult.rows[0].name : 'N/A'
    });
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/analytics/top-skills
router.get('/top-skills', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    
    const result = await query(`
      SELECT s.name, COUNT(js.job_id) as job_count
      FROM job_skills js
      JOIN skills s ON js.skill_id = s.id
      GROUP BY s.id, s.name
      ORDER BY job_count DESC
      LIMIT $1
    `, [limit]);
    
    // Convert counts to percentages (mock total jobs calculation for UI purpose)
    const totalJobs = await query('SELECT COUNT(*) FROM jobs');
    const total = parseInt(totalJobs.rows[0].count) || 1; // avoid division by zero
    
    const skillsWithDemand = result.rows.map(row => ({
      name: row.name,
      count: parseInt(row.job_count),
      demand_percentage: Math.round((parseInt(row.job_count) / total) * 100)
    }));
    
    res.json(skillsWithDemand);
  } catch (error) {
    console.error('Error fetching top skills:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/analytics/roles
router.get('/roles', async (req, res) => {
  try {
    // We didn't add role to the jobs table explicitly in schema 01 (we mapped it but maybe we should add it? Oh wait, in python we extracted it but didn't save it to jobs table).
    // Let's modify the schema slightly in the future to save extracted role. For now we group by original title.
    const result = await query(`
      SELECT title, COUNT(id) as count
      FROM jobs
      GROUP BY title
      ORDER BY count DESC
      LIMIT 10
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
