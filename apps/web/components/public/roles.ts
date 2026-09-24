// Role catalogue shared by the employer survey (Q8, docs/pitch/employer-survey.md) and the
// job-seeker path. Roles are data, like district names, so both languages live here.
// NCO codes are the unit groups from the survey's lookup table; the 8-digit occupation is
// still to be confirmed against the NCO-2015 volume (the survey doc marks these "verify").
// `skills` are catalogue ids, most important first; the first one is the role's core skill.
import type { Lang, NcoCode, SkillId } from "@ks/contracts";

export interface Role {
  key: string;
  nco: NcoCode;
  en: string;
  mr: string;
  /** Plural phrase for people-sentences: "solar technicians" / "सोलर तंत्रज्ञ". */
  pluralEn: string;
  pluralMr: string;
  skills: SkillId[];
  /** Listed in the employer survey (Q8). Candidate-only roles are false. */
  survey: boolean;
}

const R = (key: string, nco: string, en: string, mr: string, pluralEn: string, pluralMr: string, skills: SkillId[], survey = true): Role => ({
  key, nco, en, mr, pluralEn, pluralMr, skills, survey,
});

export const ROLES: Role[] = [
  R("electrician", "7411.0100", "Electrician (wiring, maintenance)", "इलेक्ट्रिशियन (वायरिंग, देखभाल)", "electricians", "इलेक्ट्रिशियन", ["industrial-wiring", "plc-automation", "ev-battery-maintenance"]),
  R("solar", "7411.0300", "Solar PV installer / technician", "सोलर PV बसवणारा / तंत्रज्ञ", "solar technicians", "सोलर तंत्रज्ञ", ["solar-pv-installation", "industrial-wiring", "customer-communication"]),
  R("ev", "7412.0100", "EV technician / EV charging", "EV तंत्रज्ञ / EV चार्जिंग", "EV technicians", "EV तंत्रज्ञ", ["ev-battery-maintenance", "industrial-wiring", "plc-automation"]),
  R("electronics", "7421.0100", "Electronics mechanic / repair", "इलेक्ट्रॉनिक्स मेकॅनिक / दुरुस्ती", "electronics mechanics", "इलेक्ट्रॉनिक्स मेकॅनिक", ["industrial-wiring", "plc-automation"]),
  R("fitter", "7233.0100", "Fitter", "फिटर", "fitters", "फिटर", ["tig-welding", "cnc-programming"]),
  R("cnc", "7223.0400", "CNC operator / programmer", "CNC ऑपरेटर / प्रोग्रामर", "CNC operators", "CNC ऑपरेटर", ["cnc-programming", "plc-automation"]),
  R("machinist", "7223.0100", "Machinist / turner", "मशिनिस्ट / टर्नर", "machinists", "मशिनिस्ट", ["cnc-programming"]),
  R("welder", "7212.0100", "Welder", "वेल्डर", "welders", "वेल्डर", ["tig-welding"]),
  R("mv-mechanic", "7231.0100", "Motor vehicle mechanic", "मोटार वाहन मेकॅनिक", "motor mechanics", "मोटार मेकॅनिक", ["ev-battery-maintenance", "customer-communication"]),
  R("refrigeration", "7127.0100", "Refrigeration and AC technician / cold-chain", "रेफ्रिजरेशन व AC तंत्रज्ञ / कोल्ड-चेन", "AC and cold-chain technicians", "AC व कोल्ड-चेन तंत्रज्ञ", ["industrial-wiring", "customer-communication"]),
  R("food-operator", "8160.0100", "Food processing worker / machine operator", "अन्नप्रक्रिया कामगार / मशीन ऑपरेटर", "food processing workers", "अन्नप्रक्रिया कामगार", ["food-safety-haccp"]),
  R("food-safety", "7515.0100", "Food safety supervisor / quality checker", "अन्न सुरक्षा पर्यवेक्षक / गुणवत्ता तपासणी", "food safety checkers", "अन्न सुरक्षा तपासनीस", ["food-safety-haccp", "data-entry"]),
  R("warehouse", "4321.0100", "Warehouse associate / storekeeper", "गोदाम सहाय्यक / स्टोअरकीपर", "warehouse staff", "गोदाम सहाय्यक", ["data-entry", "tally-gst"]),
  R("forklift", "8344.0100", "Forklift operator", "फोर्कलिफ्ट ऑपरेटर", "forklift operators", "फोर्कलिफ्ट ऑपरेटर", []),
  R("logistics", "4323.0100", "Supply chain / logistics executive", "सप्लाय चेन / लॉजिस्टिक्स एक्झिक्युटिव्ह", "logistics executives", "लॉजिस्टिक्स एक्झिक्युटिव्ह", ["spreadsheet-analysis", "data-entry", "tally-gst"]),
  R("data-analyst", "2511.0100", "Data analyst", "डेटा विश्लेषक (डेटा ॲनालिस्ट)", "data analysts", "डेटा विश्लेषक", ["power-bi", "spreadsheet-analysis", "data-entry"]),
  R("customer-support", "4222.0100", "Customer support executive", "ग्राहक सेवा एक्झिक्युटिव्ह", "customer support staff", "ग्राहक सेवा कर्मचारी", ["customer-communication", "data-entry"]),
  R("gda", "5321.0100", "General Duty Assistant (GDA) / patient care", "जनरल ड्युटी असिस्टंट (GDA) / रुग्ण सेवा", "patient care assistants", "रुग्ण सेवा सहाय्यक", ["customer-communication"]),
  R("lab-tech", "3212.0100", "Lab technician", "लॅब तंत्रज्ञ", "lab technicians", "लॅब तंत्रज्ञ", ["data-entry"]),
  R("pharmacy", "3213.0100", "Pharmacy assistant", "फार्मसी सहाय्यक", "pharmacy assistants", "फार्मसी सहाय्यक", ["customer-communication", "data-entry"]),
  // Candidate-side roles that the fixture demand covers but the survey list does not name.
  R("data-entry", "4132.0100", "Data entry operator", "डेटा एंट्री ऑपरेटर", "data entry operators", "डेटा एंट्री ऑपरेटर", ["data-entry", "spreadsheet-analysis", "tally-gst"], false),
  R("accounts", "4311.0100", "Accounts assistant (Tally)", "लेखा सहाय्यक (टॅली)", "accounts assistants", "लेखा सहाय्यक", ["tally-gst", "spreadsheet-analysis", "data-entry"], false),
  R("farm-drone", "8341.0100", "Farm drone operator", "शेती ड्रोन चालक", "farm drone operators", "शेती ड्रोन चालक", ["drone-spraying"], false),
  R("forest-produce", "7515.0200", "Forest produce processor", "वनोपज प्रक्रिया कामगार", "forest produce processors", "वनोपज प्रक्रिया कामगार", ["forest-produce-processing", "food-safety-haccp"], false),
];

export const SURVEY_ROLES = ROLES.filter((r) => r.survey);
export const roleByKey = new Map(ROLES.map((r) => [r.key, r]));

export const roleName = (r: Role, lang: Lang) => (lang === "mr" ? r.mr : r.en);
export const rolePlural = (r: Role, lang: Lang) => (lang === "mr" ? r.pluralMr : r.pluralEn);

/** Q6 sector options, NIC-2008 divisions. Labels live in messages (public.survey.sectors.*). */
export const SECTORS = ["29", "28", "25", "27", "26", "10", "01", "35", "49-53", "62-63", "86", "other"] as const;

/** Q10 hires per online post -> midpoint of the range; "offline" -> null. */
export const RATIOS = { none: 0, lt1: 0.5, one: 1, two3: 2.5, four10: 7, gt10: 12, offline: null } as const;
/** Q15 weeks to full speed -> midpoint; "none" (haven't hired) -> null. */
export const WEEKS = { lt1: 0.5, w1to2: 1.5, w3to4: 3.5, w5to8: 6.5, w9to12: 10.5, gt12: 14, none: null } as const;
