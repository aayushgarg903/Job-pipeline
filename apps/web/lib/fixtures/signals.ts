// Evidence rows ("voices"), postings, radar terms, source health and outcome KPIs. All demo:
// quotes are illustrative rows written for the fixture, never attributed to real people.
import type { EvidenceRow, Posting, RadarTerm, SourceHealth } from "@ks/contracts";
import { FOCUS, QUARTERS } from "./base";

type EvidenceSeed = EvidenceRow & { lgd?: string; skillId?: string };

export const EVIDENCE: EvidenceSeed[] = [
  { lgd: FOCUS.nashik, skillId: "solar-pv-installation", kind: "posting", title: "Solar PV Technician, rooftop EPC firm (Sinnar)", detail: "Must be able to commission string inverters and read single-line diagrams on site.", source: "Job board (demo)", date: "2026-09-18", url: null },
  { lgd: FOCUS.nashik, skillId: "solar-pv-installation", kind: "survey", title: "Employer demand survey: agro-processing unit, Dindori", detail: "We are putting panels on every cold store. We need two people who can keep them running.", source: "Kaushal Setu employer survey (demo)", date: "2026-09-10", url: null },
  { lgd: FOCUS.nashik, skillId: "solar-pv-installation", kind: "consultation", title: "District skill committee meeting, Nashik", detail: "14 employers in the room called solar PV installation a must-have for new hires.", source: "DSC minutes (demo)", date: "2026-08-29", url: null },
  { lgd: FOCUS.nashik, skillId: "solar-pv-installation", kind: "dataset", title: "ITI seat capacity, Solar Technician trade", detail: "40 seats a year in Nashik district; 35 expected to complete.", source: "DGT seat data (demo resource)", date: "2026-07-01", url: null },
  { lgd: FOCUS.pune, skillId: "cnc-programming", kind: "posting", title: "CNC Setter-Operator, auto components (Chakan)", detail: "Must know Fanuc controls and be able to edit G-code for small batch changes.", source: "Job board (demo)", date: "2026-09-20", url: null },
  { lgd: FOCUS.pune, skillId: "cnc-programming", kind: "survey", title: "Employer demand survey: Tier-2 supplier, Bhosari", detail: "Freshers can run the machine. Very few can change the program when the drawing changes.", source: "Kaushal Setu employer survey (demo)", date: "2026-09-05", url: null },
  { lgd: FOCUS.pune, skillId: "power-bi", kind: "posting", title: "MIS Executive, logistics company (Hadapsar)", detail: "Build weekly Power BI dashboards from Excel and ERP exports.", source: "Job board (demo)", date: "2026-09-21", url: null },
  { lgd: FOCUS.pune, skillId: "power-bi", kind: "survey", title: "Employer demand survey: BPO, Kharadi", detail: "Excel alone is not enough now. Everyone asks for a dashboard.", source: "Kaushal Setu employer survey (demo)", date: "2026-08-30", url: null },
  { lgd: FOCUS.pune, skillId: "legacy-macros", kind: "dataset", title: "Postings mentioning legacy macros, Pune + Nashik", detail: "Down 61% year on year (demo series).", source: "Kaushal Setu posting index (demo)", date: "2026-09-24", url: null },
  { lgd: FOCUS.gadchiroli, skillId: "forest-produce-processing", kind: "consultation", title: "Meeting with bamboo and mahua producer groups, Aheri", detail: "We lose half the mahua value because nobody here can grade and pack it for buyers.", source: "Field consultation (demo)", date: "2026-09-12", url: null },
  { lgd: FOCUS.gadchiroli, skillId: "forest-produce-processing", kind: "udyam", title: "New food and forest-produce enterprises, 12 months", detail: "41 new registrations in Gadchiroli's forest-produce and food categories.", source: "Udyam registrations (demo extract)", date: "2026-09-01", url: null },
  { lgd: FOCUS.gadchiroli, kind: "dataset", title: "Posting coverage, Gadchiroli", detail: "Only 23 job posts seen this quarter, so this district's numbers lean on 6 employer conversations.", source: "Kaushal Setu coverage report (demo)", date: "2026-09-24", url: null },
  { kind: "cohort", title: "Last ITI cohort, six-month follow-up", detail: "Of 38 trainees reached by phone, 27 were working, 19 of them in the trade they trained for.", source: "Placement tracer (demo)", date: "2026-08-15", url: null },
];

export function evidenceFor(ref: { kind: string; id: string; skillId?: string }, lgdOf: (courseId: string) => string | null): EvidenceRow[] {
  const lgd = ref.kind === "district" ? ref.id : ref.kind === "course" ? lgdOf(ref.id) : ref.kind === "cell" ? ref.id : null;
  const skill = ref.kind === "skill" ? ref.id : ref.skillId;
  const hits = EVIDENCE.filter((e) => (!lgd || !e.lgd || e.lgd === lgd) && (!skill || !e.skillId || e.skillId === skill));
  return hits.map(({ lgd: _l, skillId: _s, ...row }) => row);
}

export const POSTINGS: Array<Posting & { skills: string[] }> = [
  { id: "p-1", title: "Solar PV Technician", employer: "Rooftop EPC firm (demo)", lgd: FOCUS.nashik, city: "Sinnar", nco: "7411.0300", postedAt: "2026-09-18", source: "Job board (demo)", url: null, skills: ["solar-pv-installation", "industrial-wiring"] },
  { id: "p-2", title: "Maintenance Electrician", employer: "Food park unit (demo)", lgd: FOCUS.nashik, city: "Dindori", nco: "7411.0100", postedAt: "2026-09-14", source: "Job board (demo)", url: null, skills: ["industrial-wiring", "solar-pv-installation"] },
  { id: "p-3", title: "CNC Setter-Operator", employer: "Auto components maker (demo)", lgd: FOCUS.pune, city: "Chakan", nco: "7223.0400", postedAt: "2026-09-20", source: "Job board (demo)", url: null, skills: ["cnc-programming"] },
  { id: "p-4", title: "MIS Executive", employer: "Logistics company (demo)", lgd: FOCUS.pune, city: "Hadapsar", nco: "4132.0100", postedAt: "2026-09-21", source: "Job board (demo)", url: null, skills: ["power-bi", "spreadsheet-analysis"] },
  { id: "p-5", title: "EV Service Technician", employer: "Two-wheeler dealership (demo)", lgd: FOCUS.pune, city: "Pimpri-Chinchwad", nco: "7411.0100", postedAt: "2026-09-19", source: "Job board (demo)", url: null, skills: ["ev-battery-maintenance", "industrial-wiring"] },
  { id: "p-6", title: "Accounts Assistant", employer: "Cooperative society (demo)", lgd: FOCUS.gadchiroli, city: "Gadchiroli", nco: "4132.0100", postedAt: "2026-09-09", source: "Job board (demo)", url: null, skills: ["tally-gst", "data-entry"] },
  { id: "p-7", title: "Quality Supervisor, forest produce", employer: "Producer company (demo)", lgd: FOCUS.gadchiroli, city: "Aheri", nco: "7515.0200", postedAt: "2026-09-03", source: "Job board (demo)", url: null, skills: ["forest-produce-processing", "food-safety-haccp"] },
];

const series = (key: string, start: number, growth: number) =>
  QUARTERS.map((period, i) => ({ period, value: Math.round(start * Math.pow(1 + growth, i) + ((key.length * (i + 3)) % 5)) }));

export const RADAR: RadarTerm[] = [
  { term: "Agrivoltaics", skillId: "solar-pv-installation", global: series("agv", 40, 0.14), mhPostings: series("agv-mh", 2, 0.22), coursesTeaching: 0, note: "Global work took off two years ago; Maharashtra postings are only now appearing, mostly in Nashik." },
  { term: "EV battery second life", skillId: "ev-battery-maintenance", global: series("evb", 55, 0.1), mhPostings: series("evb-mh", 6, 0.18), coursesTeaching: 1, note: "Pune postings follow the global curve with a lag of about four quarters." },
  { term: "Drone crop spraying", skillId: "drone-spraying", global: series("drn", 30, 0.09), mhPostings: series("drn-mh", 3, 0.2), coursesTeaching: 0, note: "No course in the state teaches it yet; farm-producer companies are asking." },
  { term: "Generative AI for small offices", skillId: null, global: series("gai", 20, 0.25), mhPostings: series("gai-mh", 1, 0.3), coursesTeaching: 0, note: "Early signal: a handful of Pune postings mention it alongside Excel." },
];

export const SOURCES: SourceHealth[] = [
  { id: "postings", name: "Job postings", kind: "postings", licence: "Terms of each board (demo)", lastFetchAt: "2026-09-24T05:40:00+05:30", rows: 18240, freshnessSlaHours: 24, ok: true, note: "Deduplicated across boards." },
  { id: "surveys", name: "Employer surveys", kind: "surveys", licence: "Collected by DSEEI (demo)", lastFetchAt: "2026-09-23T18:10:00+05:30", rows: 1184, freshnessSlaHours: 72, ok: true, note: "Six-minute survey, any device." },
  { id: "udyam", name: "Udyam registrations", kind: "udyam", licence: "Open Government Data (demo extract)", lastFetchAt: "2026-09-20T09:00:00+05:30", rows: 96412, freshnessSlaHours: 720, ok: true, note: "New enterprises by district and NIC code." },
  { id: "itiseats", name: "ITI seats and admissions", kind: "supply", licence: "DGT (demo)", lastFetchAt: "2026-07-01T10:00:00+05:30", rows: 2140, freshnessSlaHours: 2160, ok: true, note: "Refreshed once per admission cycle." },
  { id: "plfs", name: "PLFS wages", kind: "dataset", licence: "MoSPI, open data (demo)", lastFetchAt: "2026-02-14T10:00:00+05:30", rows: 312, freshnessSlaHours: 4320, ok: false, note: "Past its refresh window; wage figures may be out of date." },
  { id: "trends", name: "Global tech signals", kind: "trend", licence: "OpenAlex CC0 · GitHub (demo)", lastFetchAt: "2026-09-22T02:00:00+05:30", rows: 5230, freshnessSlaHours: 168, ok: true, note: "Feeds the emerging-skills radar." },
];

export const OUTCOMES = [
  { kpi: "Trainees placed within six months", baseline: 48, current: 57, unit: "per 100 trainees", note: "Across courses that adopted a Curriculum PR (demo)." },
  { kpi: "Seats moved to shortage trades", baseline: 0, current: 1240, unit: "seats", note: "From signed district plans, FY27 (demo)." },
  { kpi: "Employers who answered the survey", baseline: 0, current: 1184, unit: "employers", note: "Across 36 districts (demo)." },
  { kpi: "Courses flagged and reviewed", baseline: 0, current: 473, unit: "courses", note: "REVISE or OBSOLETE flags that an officer looked at (demo)." },
];
