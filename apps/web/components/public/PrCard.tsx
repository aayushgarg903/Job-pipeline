// One Curriculum PR for an employer: the PR card (course, where, status, rationale), the
// diff, what it needs (trainers, equipment), and the review panel with the seal. Server
// component; only PrReview is a client island.
import type { Course, CourseHealth, CurriculumPr, Lang } from "@ks/contracts";
import { Card, DiffBlock, formatNumber, type Tone } from "@ks/ui";
import { getTranslations } from "next-intl/server";
import { PrReview } from "./PrReview";

type Verdict = "endorse" | "change" | "irrelevant";

const STATUS_TONE: Record<CurriculumPr["status"], { tone: Tone; glyph: string }> = {
  draft: { tone: "watch", glyph: "~" },
  "employer-validated": { tone: "ok", glyph: "✓" },
  approved: { tone: "ok", glyph: "✓" },
  adopted: { tone: "ok", glyph: "✓" },
};

export async function PrCard({
  pr, course, districtName, skillLabels, lang, detail, mine, headingLevel = 2,
}: {
  pr: CurriculumPr;
  course: (Course & { health: CourseHealth | null }) | null;
  districtName: string;
  skillLabels: Record<string, string>;
  lang: Lang;
  /** Detail page: no link on the name, review panel open. */
  detail: boolean;
  mine: { verdict: Verdict | null; comment: string | null };
  headingLevel?: 2 | 3;
}) {
  const t = await getTranslations();
  const num = pr.id.replace(/\D/g, "") || pr.id;
  const st = STATUS_TONE[pr.status];
  const href = `/employer/prs/${encodeURIComponent(pr.id)}`;
  const rationaleLang = lang === "mr" ? "en" : undefined; // rationales are drafted in English today

  return (
    <div className="grid gap-3">
      <Card
        variant="pr"
        code={t("public.prs.code", { code: course?.code ?? pr.courseId, n: num })}
        name={course?.name ?? pr.courseId}
        title={t("public.prs.title2", { institute: course?.institutionName ?? "", district: districtName })}
        verdict={{ tone: st.tone, glyph: st.glyph, word: t(`public.prs.status.${pr.status}`) }}
        human={<span lang={rationaleLang}>{pr.rationale}</span>}
        provenance={{
          sources: [
            { kind: "surveys", label: t("prov.surveys"), n: pr.endorsements + pr.changeRequests },
          ],
          asOf: pr.openedAt,
          isDemo: course?.isDemo ?? true,
          lapsed: false,
        }}
        href={detail ? undefined : href}
        lang={lang}
        headingLevel={headingLevel}
        expanded={detail}
        labels={{ asOf: t("card.asOf"), specimen: t("card.specimen"), specimenWord: t("card.specimenWord"), open: t("card.open") }}
      >
        <div className="mt-3 grid gap-3 text-left">
          <DiffBlock
            lines={pr.diff}
            skillLabels={skillLabels}
            title={t("public.prs.diffTitle")}
            hideKeep={!detail}
            lang={lang}
            labels={{
              add: t("diff.add"), drop: t("diff.drop"), resize: t("diff.resize"), keep: t("diff.keep"), hours: t("diff.hours"),
              item: t("diff.item"), change: t("diff.change"), why: t("diff.why"), caption: t("diff.caption"),
            }}
          />
          {pr.trainerDelta.length || pr.equipmentDelta.length ? (
            <ul className="m-0 grid gap-1 pl-5 text-sm" lang={rationaleLang}>
              {pr.trainerDelta.map((d) => (
                <li key={`t-${d.qualification}`}>{t("public.prs.trainers", { n: formatNumber(d.count, lang), what: d.qualification })}</li>
              ))}
              {pr.equipmentDelta.map((d) => (
                <li key={`e-${d.item}`}>{t("public.prs.equipment", { n: formatNumber(d.qty, lang), what: d.item })}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </Card>
      <PrReview
        prId={pr.id}
        endorsements={pr.endorsements}
        changeRequests={pr.changeRequests}
        mine={mine.verdict}
        myComment={mine.comment}
        lang={lang}
        compact={!detail}
        detailHref={detail ? undefined : href}
      />
    </div>
  );
}
