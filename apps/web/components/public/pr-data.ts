// Loads everything a PR card needs: the course, its district name, readable skill labels, and
// (demo mode only) this employer's latest answer layered on top of the reader's counts.
import type { CurriculumPr, Lang } from "@ks/contracts";
import { getReaders } from "@/lib/readers";
import { DEMO_EMPLOYER_ID, demoReviewOverlay } from "@/lib/writers";

export async function loadPrViews(prs: CurriculumPr[], lang: Lang) {
  const r = await getReaders();
  const [skills, districts] = await Promise.all([r.searchSkills("", 500), r.districts()]);
  const skillLabels = Object.fromEntries(skills.map((s) => [s.id, lang === "mr" && s.labelMr ? s.labelMr : s.labelEn]));
  const dName = new Map(districts.map((d) => [d.district.lgd, lang === "mr" ? d.district.nameMr : d.district.nameEn]));
  return Promise.all(
    prs.map(async (pr) => {
      const [course, o] = await Promise.all([r.course(pr.courseId), demoReviewOverlay(pr.id, DEMO_EMPLOYER_ID)]);
      return {
        pr: { ...pr, endorsements: pr.endorsements + o.endorse, changeRequests: pr.changeRequests + o.change },
        course,
        districtName: course ? dName.get(course.lgd) ?? course.lgd : "",
        skillLabels,
        mine: { verdict: o.mine, comment: o.comment },
      };
    }),
  );
}
