"use server";
// Server Actions for the public pages (employer survey, Curriculum PR review, job-seeker path).
// Every input is validated with Zod at this boundary. The job-seeker action stores nothing:
// it reads the text once, then redirects with only skill ids and a district in the URL.
import type { Lang, Skill } from "@ks/contracts";
import { peopleSentence } from "@ks/core";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { encodeHeld, readSkills } from "@/components/public/candidate";
import { roleByKey, rolePlural } from "@/components/public/roles";
import { parseSurvey, type FieldErrors } from "@/components/public/survey-schema";
import { getReaders } from "@/lib/readers";
import { DEMO_EMPLOYER_ID, getWriters, writersAreDemo } from "@/lib/writers";

const LangSchema = z.enum(["en", "mr"]).catch("en");
const langOf = (fd: FormData): Lang => LangSchema.parse(fd.get("lang"));

async function catalog(): Promise<Skill[]> {
  return (await getReaders()).searchSkills("", 500);
}

// ---------------------------------------------------------------- skill search (survey)
const Query = z.string().trim().max(60);

export async function searchSkillsAction(q: string): Promise<Array<Pick<Skill, "id" | "labelEn" | "labelMr">>> {
  const parsed = Query.safeParse(q);
  if (!parsed.success || !parsed.data) return [];
  const rows = await (await getReaders()).searchSkills(parsed.data, 8);
  return rows.map(({ id, labelEn, labelMr }) => ({ id, labelEn, labelMr }));
}

// ---------------------------------------------------------------- employer survey
export interface ThanksFacts {
  district: string;
  role: string;
  hires: number;
  skills: string[]; // must-have first
  mustHave: number;
  courses: number;
  institutes: number;
  othersDemand: number | null; // people other employers there expect to hire with the core skill
  sentence: string | null; // peopleSentence for the core skill, in the survey language
}

export type SurveyState =
  | { status: "idle" }
  | { status: "error"; errors: FieldErrors }
  | { status: "ok"; id: string; demo: boolean; facts: ThanksFacts };

export async function submitSurvey(_prev: SurveyState, fd: FormData): Promise<SurveyState> {
  const lang = langOf(fd);
  const readers = await getReaders();
  const [districts, skills] = await Promise.all([readers.districts(), catalog()]);
  const parsed = parseSurvey(fd, { lgds: new Set(districts.map((d) => d.district.lgd)), skillIds: new Set(skills.map((s) => s.id)) });
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  const { input, roleKey } = parsed;
  const { id } = await (await getWriters()).submitSurvey(input);
  updateTag(`district:${input.lgd}`);

  // What this answer feeds into, in people-terms.
  const d = districts.find((x) => x.district.lgd === input.lgd)!;
  const dName = lang === "mr" ? d.district.nameMr : d.district.nameEn;
  const role = roleByKey.get(roleKey);
  const label = new Map(skills.map((s) => [s.id, lang === "mr" && s.labelMr ? s.labelMr : s.labelEn]));
  const order = { mandatory: 0, preferred: 1, nice: 2 } as const;
  const sorted = [...input.skills].sort((a, b) => order[a.importance] - order[b.importance]);
  const [cells, courses] = await Promise.all([readers.districtCells(input.lgd, 100), readers.courses({ lgd: input.lgd, limit: 200 })]);
  const core = cells.find((c) => c.skillId === (role?.skills[0] ?? sorted[0]?.skillId)) ?? cells.find((c) => c.skillId === sorted[0]?.skillId);
  return {
    status: "ok",
    id,
    demo: await writersAreDemo(),
    facts: {
      district: dName,
      role: role ? (lang === "mr" ? role.mr : role.en) : fd.get("roleOther")?.toString() ?? "",
      hires: input.expectedHires12m,
      skills: sorted.map((s) => label.get(s.skillId) ?? s.skillId),
      mustHave: input.skills.filter((s) => s.importance === "mandatory").length,
      courses: courses.length,
      institutes: new Set(courses.map((c) => c.institutionId)).size,
      othersDemand: core ? core.demand : null,
      sentence: core && role ? peopleSentence({ gap: core, district: dName, occupationLabel: rolePlural(role, lang), lang }) : null,
    },
  };
}

// ---------------------------------------------------------------- Curriculum PR review
const Review = z.object({
  prId: z.string().regex(/^[\w-]{1,80}$/),
  verdict: z.enum(["endorse", "change", "irrelevant"]),
  comment: z.string().trim().max(1000).transform((s) => s || null),
});

export type ReviewState =
  | { status: "idle" }
  | { status: "error"; code: "invalid" | "missing" | "failed" }
  | { status: "ok"; verdict: "endorse" | "change" | "irrelevant"; demo: boolean };

export async function reviewPrAction(_prev: ReviewState, fd: FormData): Promise<ReviewState> {
  const parsed = Review.safeParse({ prId: fd.get("prId"), verdict: fd.get("verdict"), comment: fd.get("comment") ?? "" });
  if (!parsed.success) return { status: "error", code: "invalid" };
  const pr = await (await getReaders()).pr(parsed.data.prId);
  if (!pr) return { status: "error", code: "missing" };
  try {
    await (await getWriters()).reviewPr({ ...parsed.data, employerId: DEMO_EMPLOYER_ID });
  } catch (err) {
    console.error("[reviewPr]", err instanceof Error ? err.message : err);
    return { status: "error", code: "failed" };
  }
  updateTag(`pr:${pr.id}`);
  updateTag(`course:${pr.courseId}`);
  refresh();
  return { status: "ok", verdict: parsed.data.verdict, demo: await writersAreDemo() };
}

// ---------------------------------------------------------------- job-seeker path
const Candidate = z.object({
  text: z.string().trim().max(600),
  lgd: z.string().regex(/^\d{2,4}$/),
});

/** Reads the text once, then redirects to the result. Nothing is stored anywhere. */
export async function findPathsAction(fd: FormData): Promise<void> {
  const lang = langOf(fd);
  const parsed = Candidate.safeParse({ text: fd.get("text") ?? "", lgd: fd.get("lgd") ?? "" });
  if (!parsed.success) redirect(`/me?err=${fd.get("lgd") ? "text" : "district"}`);
  const { text, lgd } = parsed.data;
  const readers = await getReaders();
  if (!(await readers.district(lgd))) redirect("/me?err=district");
  if (text.length < 2) redirect(`/me?err=text&d=${lgd}`);
  const { skills, via } = await readSkills(text, lang, await catalog());
  const q = new URLSearchParams({ d: lgd, via });
  if (skills.length) q.set("s", encodeHeld(skills));
  redirect(`/me?${q}`);
}
