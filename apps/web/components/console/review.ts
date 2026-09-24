// The admin review queue. The Readers port has no review-queue reader yet, so this is a
// clearly-labelled demo queue (isDemo = true, SPECIMEN watermark). Items mirror the three
// queues in Architecture §6.1/§6.5: low-confidence extractions, unknown skills, duplicates,
// plus survey answers flagged by the anti-gaming rule.
export type ReviewKind = "low-confidence" | "unknown-skill" | "duplicate" | "survey-outlier";

export interface ReviewItem {
  id: string;
  kind: ReviewKind;
  lgd: string;
  title: string; // what the item is about, in plain words
  evidence: string; // the exact sentence or row that triggered it
  source: string;
  date: string;
  confidence: number | null; // 0..1, extraction confidence when relevant
  proposal: string; // what approving will do
  count: number; // postings / rows affected
}

export const REVIEW_QUEUE: ReviewItem[] = [
  {
    id: "rv-1", kind: "low-confidence", lgd: "487", title: "Solar PV Technician, rooftop EPC firm (Sinnar)",
    evidence: "Candidate should handle BOS and string sizing on site.", source: "Job board (demo)", date: "2026-09-18",
    confidence: 0.54, proposal: "Map “string sizing” to Solar PV installation, working level.", count: 1,
  },
  {
    id: "rv-2", kind: "unknown-skill", lgd: "490", title: "“BESS commissioning” in 7 Pune job posts",
    evidence: "Experience in BESS commissioning and SCADA hand-over preferred.", source: "Job board (demo)", date: "2026-09-20",
    confidence: null, proposal: "Add “Battery storage commissioning” as a new skill and send it to the radar.", count: 7,
  },
  {
    id: "rv-3", kind: "duplicate", lgd: "490", title: "Two posts for “CNC Setter-Operator”, Chakan, 3 days apart",
    evidence: "Same employer, same title, same wording; one on each of two boards.", source: "Job board (demo)", date: "2026-09-21",
    confidence: 0.97, proposal: "Count these as one opening, not two.", count: 2,
  },
  {
    id: "rv-4", kind: "survey-outlier", lgd: "475", title: "Survey answer: 60 hires from a small enterprise, Gadchiroli",
    evidence: "Stated 60 hires in 12 months; businesses of this size usually hire 4 to 8.", source: "Kaushal Setu employer survey (demo)", date: "2026-09-12",
    confidence: null, proposal: "Keep the answer but cap its weight until the Udyam number is checked.", count: 1,
  },
  {
    id: "rv-5", kind: "low-confidence", lgd: "490", title: "MIS Executive, logistics company (Hadapsar)",
    evidence: "Knowledge of dashboards (PBI / Tableau) is a plus.", source: "Job board (demo)", date: "2026-09-21",
    confidence: 0.61, proposal: "Map “PBI” to Power BI dashboards, marked preferred.", count: 1,
  },
];
