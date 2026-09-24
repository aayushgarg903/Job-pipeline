// Courses, course health, one Curriculum PR and one training-plan input. All demo.
import type { Course, CourseHealth, CurriculumPr, PlanInput, PlanResult } from "@ks/contracts";
import { FOCUS, QUARTER } from "./base";

type C = Course & { health: CourseHealth };

const health = (courseId: string, h: Omit<CourseHealth, "courseId" | "quarter">): CourseHealth => ({ courseId, quarter: QUARTER, ...h });

export const COURSES: C[] = [
  {
    id: "nsk-iti-solar", institutionId: "iti-nashik", institutionName: "Govt. ITI Nashik", lgd: FOCUS.nashik,
    name: "Solar Technician (Electrical)", code: "CTS-SOLT", kind: "ITI", targetNco: "7411.0300", seats: 40, durationHours: 1200,
    skills: [
      { skillId: "solar-pv-installation", proficiency: 3, hours: 360, assessed: true },
      { skillId: "industrial-wiring", proficiency: 2, hours: 240, assessed: true },
      { skillId: "customer-communication", proficiency: 2, hours: 40, assessed: false },
    ],
    isDemo: true,
    health: health("nsk-iti-solar", {
      relevance: 88, outcomes: 74, currency: 81, validation: 70, total: 80, flags: ["HEALTHY"], placementRate: 0.71,
      missingSkills: ["drone-spraying"], decliningSkills: [], unassessedSkills: ["customer-communication"],
      explain: [
        "Nashik employers need about 140 more solar installers than local training produces.",
        "71 of every 100 trainees from the last batch had a job within six months.",
        "Talking with customers is taught but never assessed; 9 employers say it matters.",
      ],
    }),
  },
  {
    id: "nsk-iti-fitter", institutionId: "iti-nashik", institutionName: "Govt. ITI Nashik", lgd: FOCUS.nashik,
    name: "Fitter", code: "CTS-FITR", kind: "ITI", targetNco: "7223.0400", seats: 120, durationHours: 2400,
    skills: [
      { skillId: "tig-welding", proficiency: 2, hours: 180, assessed: true },
      { skillId: "cnc-programming", proficiency: 1, hours: 40, assessed: false },
    ],
    isDemo: true,
    health: health("nsk-iti-fitter", {
      relevance: 58, outcomes: 61, currency: 44, validation: 52, total: 55, flags: ["REVISE"], placementRate: 0.54,
      missingSkills: ["plc-automation"], decliningSkills: [], unassessedSkills: ["cnc-programming"],
      explain: [
        "Satpur and Ambad employers want CNC programming at working level; the course gives it 40 hours at basic level.",
        "54 of every 100 trainees found work within six months, below the district's 63.",
      ],
    }),
  },
  {
    id: "pune-iti-electrician", institutionId: "iti-pune", institutionName: "Govt. ITI Pune", lgd: FOCUS.pune,
    name: "Electrician", code: "CTS-ELEC", kind: "ITI", targetNco: "7411.0100", seats: 160, durationHours: 2400,
    skills: [
      { skillId: "industrial-wiring", proficiency: 3, hours: 520, assessed: true },
      { skillId: "plc-automation", proficiency: 2, hours: 120, assessed: true },
      { skillId: "ev-battery-maintenance", proficiency: 1, hours: 30, assessed: false },
    ],
    isDemo: true,
    health: health("pune-iti-electrician", {
      relevance: 79, outcomes: 77, currency: 69, validation: 64, total: 74, flags: ["HEALTHY"], placementRate: 0.77,
      missingSkills: [], decliningSkills: [], unassessedSkills: ["ev-battery-maintenance"],
      explain: ["77 of every 100 trainees were working within six months.", "EV battery work is growing fast in Chakan; the course touches it for 30 hours."],
    }),
  },
  {
    id: "pune-pmkvy-data", institutionId: "pmkvy-pune-07", institutionName: "PMKVY Centre, Hadapsar", lgd: FOCUS.pune,
    name: "Data Entry and Analysis", code: "SSC/Q2212", kind: "PMKVY", targetNco: "4132.0100", seats: 90, durationHours: 390,
    skills: [
      { skillId: "data-entry", proficiency: 2, hours: 120, assessed: true },
      { skillId: "spreadsheet-analysis", proficiency: 2, hours: 40, assessed: true },
      { skillId: "legacy-macros", proficiency: 2, hours: 6, assessed: true },
    ],
    isDemo: true,
    health: health("pune-pmkvy-data", {
      relevance: 42, outcomes: 48, currency: 30, validation: 55, total: 43, flags: ["REVISE", "OVERSUPPLIED"], placementRate: 0.39,
      missingSkills: ["power-bi"], decliningSkills: ["legacy-macros"], unassessedSkills: [],
      explain: [
        "Pune has about 930 more people trained for data entry than jobs that need it.",
        "312 Pune postings ask for Power BI; this course does not teach it.",
        "Demand for old spreadsheet macros fell 61% in a year.",
      ],
    }),
  },
  {
    id: "gad-iti-copa", institutionId: "iti-gadchiroli", institutionName: "Govt. ITI Gadchiroli", lgd: FOCUS.gadchiroli,
    name: "Computer Operator (COPA)", code: "CTS-COPA", kind: "ITI", targetNco: "4132.0100", seats: 80, durationHours: 1200,
    skills: [
      { skillId: "data-entry", proficiency: 2, hours: 300, assessed: true },
      { skillId: "tally-gst", proficiency: 1, hours: 60, assessed: true },
    ],
    isDemo: true,
    health: health("gad-iti-copa", {
      relevance: 36, outcomes: 41, currency: 57, validation: 20, total: 38, flags: ["OVERSUPPLIED"], placementRate: 0.31,
      missingSkills: ["tally-gst"], decliningSkills: [], unassessedSkills: [],
      explain: [
        "About 170 more people are trained for data entry than Gadchiroli employers can hire.",
        "We've only seen 23 job posts from Gadchiroli, so this leans on what 6 employers told us.",
      ],
    }),
  },
  {
    id: "gad-state-forest", institutionId: "mssds-gadchiroli", institutionName: "MSSDS Centre, Gadchiroli", lgd: FOCUS.gadchiroli,
    name: "Forest Produce Processing", code: "MSSDS/FPP-01", kind: "state", targetNco: "7515.0200", seats: 30, durationHours: 300,
    skills: [
      { skillId: "forest-produce-processing", proficiency: 2, hours: 180, assessed: true },
      { skillId: "food-safety-haccp", proficiency: 1, hours: 30, assessed: false },
    ],
    isDemo: true,
    health: health("gad-state-forest", {
      relevance: 82, outcomes: 66, currency: 75, validation: 60, total: 73, flags: ["HEALTHY"], placementRate: 0.62,
      missingSkills: [], decliningSkills: [], unassessedSkills: ["food-safety-haccp"],
      explain: ["Bamboo and mahua producer groups told us they need about 75 more trained people.", "Low signal: most of this comes from 6 employer conversations."],
    }),
  },
];

export const PRS: CurriculumPr[] = [
  {
    id: "pr-101", courseId: "pune-pmkvy-data", target: "add-on-module", status: "employer-validated",
    diff: [
      { op: "keep", module: "Module 2 — Data entry", skillId: "data-entry", hoursBefore: 120, hoursAfter: 120, reason: "Still asked for in 520 Pune postings." },
      { op: "drop", module: "Module 4 — Spreadsheet analysis", skillId: "legacy-macros", hoursBefore: 6, hoursAfter: 0, reason: "Demand down 61% in a year across Pune and Nashik." },
      { op: "add", module: "Module 4 — Spreadsheet analysis", skillId: "power-bi", hoursBefore: 0, hoursAfter: 10, reason: "312 postings; 11 employers call it a must-have." },
      { op: "resize", module: "Module 4 — Spreadsheet analysis", skillId: "spreadsheet-analysis", hoursBefore: 4, hoursAfter: 8, reason: "Pivot tables named in 188 postings." },
    ],
    rationale:
      "Pune employers keep asking for people who can turn a spreadsheet into a dashboard. This change drops 6 hours of old macros nobody hires for and adds 10 hours of Power BI, which 11 local employers called a must-have. Total course length grows by 8 hours.",
    endorsements: 4, changeRequests: 1, openedAt: "2026-09-02T10:00:00+05:30", adoptedAt: null,
    trainerDelta: [{ qualification: "Power BI certified trainer", count: 1 }],
    equipmentDelta: [{ item: "Power BI Pro licence (per seat)", qty: 30 }],
  },
];

export const PLAN_INPUTS: PlanInput[] = [
  {
    lgd: FOCUS.nashik, fy: "FY27", seatBudget: 400, capexBudget: 6_000_000,
    trainerHoursAvailable: { "Solar PV trainer": 1800, "Fitter trainer": 4800, "EV trainer": 0 },
    trainerHireCost: { "Solar PV trainer": 540000, "Fitter trainer": 480000, "EV trainer": 600000 },
    hoursPerHiredTrainer: 1600,
    demandBySkill: { "solar-pv-installation": 175, "cnc-programming": 540, "ev-battery-maintenance": 90, "tig-welding": 260 },
    medianWage: 17500,
    courses: [
      { courseId: "nsk-iti-solar", name: "Solar Technician (Electrical)", isNew: false, seatsPrev: 40, batchSize: 20, maxBatches: 6, completionRate: 0.82, placementProb: 0.71, wage: 18500, trainerQualification: "Solar PV trainer", trainerHoursPerBatch: 900, equipmentSets: 2, equipmentCostPerSet: 450000, teaches: ["solar-pv-installation", "industrial-wiring"] },
      { courseId: "nsk-iti-fitter", name: "Fitter", isNew: false, seatsPrev: 120, batchSize: 20, maxBatches: 8, completionRate: 0.78, placementProb: 0.54, wage: 16000, trainerQualification: "Fitter trainer", trainerHoursPerBatch: 1200, equipmentSets: 6, equipmentCostPerSet: 250000, teaches: ["tig-welding", "cnc-programming"] },
      { courseId: "nsk-new-ev", name: "EV Battery Technician (new)", isNew: true, seatsPrev: 0, batchSize: 20, maxBatches: 3, completionRate: 0.8, placementProb: 0.66, wage: 19000, trainerQualification: "EV trainer", trainerHoursPerBatch: 800, equipmentSets: 0, equipmentCostPerSet: 700000, teaches: ["ev-battery-maintenance"] },
    ],
  },
];

export const SAVED_PLANS: Array<PlanResult & { lgd: string; fy: string; signedBy: string | null; signedAt: string | null }> = [
  {
    lgd: FOCUS.nashik, fy: "FY27", status: "optimal", objective: 412.6, expectedPlacements: 214,
    rows: [
      { courseId: "nsk-iti-solar", name: "Solar Technician (Electrical)", seatsPrev: 40, seats: 100, batches: 5, opened: true },
      { courseId: "nsk-iti-fitter", name: "Fitter", seatsPrev: 120, seats: 80, batches: 4, opened: true },
      { courseId: "nsk-new-ev", name: "EV Battery Technician (new)", seatsPrev: 0, seats: 40, batches: 2, opened: true },
    ],
    trainersToHire: { "Solar PV trainer": 2, "EV trainer": 1 },
    equipmentToBuy: { "nsk-iti-solar": 3, "nsk-new-ev": 2 },
    oversupplyBySkill: { "industrial-wiring": 12 },
    marginals: [
      { resource: "Solar PV trainer hours", deltaPlacements: 0.9, sentence: "Each extra solar trainer lets about 14 more people get placed." },
      { resource: "Capex", deltaPlacements: 0.02, sentence: "Another ₹10 lakh of equipment adds about 2 placements." },
    ],
    capexUsed: 2_750_000,
    signedBy: null, signedAt: null,
  },
];

