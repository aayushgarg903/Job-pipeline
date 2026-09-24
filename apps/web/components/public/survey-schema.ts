// Employer survey: FormData -> SurveyInput, validated with Zod 4 at the system boundary.
// Pure (no Next APIs), so the Server Action and the test script share it.
import type { SurveyInput } from "@ks/contracts";
import { z } from "zod";
import { RATIOS, SECTORS, WEEKS, roleByKey } from "./roles";

/** Error codes map to messages at public.survey.errors.* */
export type FieldError = "required" | "number" | "range" | "tooLong" | "pattern" | "consent" | "skills" | "unknown";
export type FieldErrors = Partial<Record<SurveyField, FieldError>>;
export type SurveyField =
  | "consent" | "employerName" | "udyam" | "lgd" | "sector" | "sectorOther" | "role" | "roleOther"
  | "hires" | "ratio" | "skills" | "csat" | "weeks" | "comment";

/** Which step each field lives on (0-based), for the error summary. */
export const FIELD_STEP: Record<SurveyField, number> = {
  consent: 0, employerName: 1, udyam: 1, lgd: 1, sector: 1, sectorOther: 1,
  role: 2, roleOther: 2, hires: 2, ratio: 2, skills: 3, csat: 4, weeks: 4, comment: 5,
};

export const MAX_SKILLS = 5;
export const UDYAM_PATTERN = "UDYAM-[A-Za-z]{2}-\\d{2}-\\d{7}";

const text = (max: number) => z.string().trim().max(max, "tooLong");
const Ratio = z.enum(Object.keys(RATIOS) as [keyof typeof RATIOS, ...Array<keyof typeof RATIOS>], { error: "required" });
const Weeks = z.enum(Object.keys(WEEKS) as [keyof typeof WEEKS, ...Array<keyof typeof WEEKS>], { error: "required" });

const Raw = z.object({
  consent: z.literal("yes", { error: "consent" }),
  employerName: text(160).min(2, "required"),
  udyam: z.union([z.literal(""), z.string().trim().regex(new RegExp(`^${UDYAM_PATTERN}$`), "pattern")]),
  lgd: z.string().regex(/^\d{2,4}$/, "required"),
  sector: z.enum(SECTORS, { error: "required" }),
  sectorOther: text(120),
  role: z.string().refine((k) => k === "other" || roleByKey.get(k)?.survey === true, "required"),
  roleOther: text(120),
  hires: z.string().trim().min(1, "required").regex(/^\d+$/, "number").transform(Number).pipe(z.number().int().min(0, "range").max(5000, "range")),
  ratio: Ratio,
  skills: z
    .array(z.object({ skillId: z.string().regex(/^[a-z0-9-]{2,80}$/), importance: z.enum(["mandatory", "preferred", "nice"]), proficiency: z.coerce.number().int().min(1).max(4) }))
    .min(1, "skills")
    .max(MAX_SKILLS, "skills"),
  csat: z.enum(["1", "2", "3", "4", "5", "none"], { error: "required" }),
  weeks: Weeks,
  comment: text(1000),
});

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};

/** Reads the form's field names (see SurveyForm) into the raw shape. */
export function readSurveyForm(fd: FormData) {
  const ids = [...new Set(fd.getAll("skill").filter((v): v is string => typeof v === "string" && !!v))];
  return {
    consent: str(fd, "consent"),
    employerName: str(fd, "employerName"),
    udyam: str(fd, "udyam").toUpperCase(),
    lgd: str(fd, "lgd"),
    sector: str(fd, "sector"),
    sectorOther: str(fd, "sectorOther"),
    role: str(fd, "role"),
    roleOther: str(fd, "roleOther"),
    hires: str(fd, "hires"),
    ratio: str(fd, "ratio"),
    skills: ids.map((skillId) => ({ skillId, importance: str(fd, `imp_${skillId}`), proficiency: str(fd, `prof_${skillId}`) })),
    csat: str(fd, "csat"),
    weeks: str(fd, "weeks"),
    comment: str(fd, "comment"),
  };
}

export type SurveyParse =
  | { ok: true; input: SurveyInput; roleKey: string }
  | { ok: false; errors: FieldErrors };

const KNOWN = new Set<string>(["required", "number", "range", "tooLong", "pattern", "consent", "skills"]);

export function parseSurvey(fd: FormData, known: { lgds: Set<string>; skillIds: Set<string> }): SurveyParse {
  const raw = readSurveyForm(fd);
  const res = Raw.safeParse(raw);
  const errors: FieldErrors = {};
  if (!res.success) {
    for (const issue of res.error.issues) {
      const field = String(issue.path[0] ?? "") as SurveyField;
      if (!(field in FIELD_STEP) || errors[field]) continue;
      errors[field] = (KNOWN.has(issue.message) ? issue.message : field === "skills" ? "skills" : "required") as FieldError;
    }
  }
  if (!errors.lgd && !known.lgds.has(raw.lgd)) errors.lgd = "required";
  if (raw.sector === "other" && raw.sectorOther.trim().length < 2) errors.sectorOther = "required";
  if (raw.role === "other" && raw.roleOther.trim().length < 2) errors.roleOther = "required";
  if (!errors.skills && raw.skills.some((s) => !known.skillIds.has(s.skillId))) errors.skills = "unknown";
  if (!res.success || Object.keys(errors).length) return { ok: false, errors };

  const v = res.data;
  const role = roleByKey.get(v.role);
  const ownWords = v.role === "other" ? `Role in their own words: ${v.roleOther}.` : "";
  const comment = [ownWords, v.comment].filter(Boolean).join(" ").trim();
  return {
    ok: true,
    roleKey: v.role,
    input: {
      employerName: v.employerName,
      lgd: v.lgd,
      // "other" roles go to the review queue: the NCO matcher maps the free text later.
      nco: role?.nco ?? "unmapped",
      sector: v.sector === "other" ? `other:${v.sectorOther}` : v.sector,
      expectedHires12m: v.hires,
      postingToHireRatio: RATIOS[v.ratio],
      csatRecentHires: v.csat === "none" ? null : (Number(v.csat) as 1 | 2 | 3 | 4 | 5),
      weeksToProductivity: WEEKS[v.weeks],
      skills: v.skills.map((s) => ({ skillId: s.skillId, importance: s.importance, proficiency: s.proficiency as 1 | 2 | 3 | 4 })),
      comment: comment || null,
    },
  };
}
