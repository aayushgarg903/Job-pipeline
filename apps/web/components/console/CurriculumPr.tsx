// One Curriculum Pull Request (Design.md §4.3, Architecture §6.4): the PR card with its
// seal, the status lifecycle, who can merge it (target), the diff, and trainer/equipment deltas.
import type { Course, CurriculumPr as Pr, Lang, PrStatus } from "@ks/contracts";
import { Card, DiffBlock, formatDate, formatNumber, type CardLabels } from "@ks/ui";
import { templateNarrate } from "@ks/ai";
import type { Tr } from "@/lib/cards";

const LIFECYCLE: PrStatus[] = ["draft", "employer-validated", "approved", "adopted"];

export function CurriculumPr({ pr, course, t, lang, labels, skillLabels, asOf, districtName }: {
  pr: Pr; course: Course; t: Tr; lang: Lang; labels: Partial<CardLabels>; skillLabels: Record<string, string>; asOf: string; districtName: string;
}) {
  // The stored rationale is English; in Marathi we narrate the same diff with the grounded template.
  const add = pr.diff.find((l) => l.op === "add");
  const drop = pr.diff.find((l) => l.op === "drop");
  const name = (l: typeof add) => (l ? (l.skillId ? skillLabels[l.skillId] ?? l.module : l.module) : undefined);
  const rationale = lang === "en" ? pr.rationale : templateNarrate("pr-rationale", {
    course: course.name, district: districtName, skill: name(add), hoursAdded: add ? add.hoursAfter - add.hoursBefore : undefined,
    dropSkill: name(drop), hoursDropped: drop ? drop.hoursBefore - drop.hoursAfter : undefined,
  }, lang);
  const added = pr.diff.reduce((s, l) => s + Math.max(0, l.hoursAfter - l.hoursBefore), 0);
  const dropped = pr.diff.reduce((s, l) => s + Math.max(0, l.hoursBefore - l.hoursAfter), 0);
  const at = LIFECYCLE.indexOf(pr.status);
  const num = pr.id.replace(/\D/g, "");

  return (
    <article className="grid gap-4" aria-labelledby={`pr-${pr.id}`}>
      <Card
        variant="pr"
        code={num ? `${course.code} · PR #${num}` : `${course.code} · PR`}
        name={t(`console.course.pr.target.${pr.target}`)}
        title={t(`console.course.pr.status.${pr.status}`)}
        figure={{ label: t("console.course.pr.votes"), value: formatNumber(pr.endorsements, lang), evidenceTitle: t("console.course.pr.votesTitle") }}
        verdict={{ tone: "watch", glyph: "~", word: t("console.course.pr.hours", { added: formatNumber(added, lang), dropped: formatNumber(dropped, lang) }) }}
        human={rationale}
        endorsements={pr.endorsements}
        provenance={{
          sources: [
            { kind: "surveys", label: t("console.course.pr.endorsed"), n: pr.endorsements },
            { kind: "surveys", label: t("console.course.pr.changes"), n: pr.changeRequests },
          ],
          asOf, isDemo: course.isDemo, lapsed: false,
        }}
        lang={lang}
        labels={labels}
        headingLevel={3}
      />

      <div className="ks-stock grid gap-3 p-4">
        <h4 id={`pr-${pr.id}`} className="m-0 font-semibold">{t("console.course.pr.lifecycle")}</h4>
        <ol className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label={t("console.course.pr.lifecycle")}>
          {LIFECYCLE.map((s, i) => (
            <li key={s} aria-current={i === at ? "step" : undefined}
              className={`ks-mono rounded-[2px] border px-2 py-1 text-sm ${i === at ? "border-2 border-ink font-semibold" : "border-ink-faint"}`}>
              <span aria-hidden="true">{i < at ? "✓ " : i === at ? "● " : "○ "}</span>
              {t(`console.course.pr.status.${s}`)}
              {i === at ? <span className="sr-only"> ({t("console.course.pr.current")})</span> : null}
            </li>
          ))}
        </ol>
        <p className="m-0 text-sm">
          {t("console.course.pr.opened", { date: formatDate(pr.openedAt, lang) })}
          {pr.adoptedAt ? ` · ${t("console.course.pr.adopted", { date: formatDate(pr.adoptedAt, lang) })}` : ""}
        </p>
        <p className="m-0">{t(`console.course.pr.targetExplain.${pr.target}`)}</p>
        <p className="m-0 text-sm">
          {t("card.endorsed", { n: pr.endorsements })}
          {pr.changeRequests ? ` · ${t("console.course.pr.changeRequests", { n: pr.changeRequests })}` : ""}
        </p>
      </div>

      <DiffBlock lines={pr.diff} skillLabels={skillLabels} title={t("console.course.pr.diffTitle")} lang={lang} labels={t.raw("diff") as never} />

      {pr.trainerDelta.length || pr.equipmentDelta.length ? (
        <div className="ks-stock grid gap-2 p-4 md:grid-cols-2">
          <div>
            <h4 className="m-0 mb-1 font-semibold">{t("console.course.pr.trainers")}</h4>
            <ul className="m-0 pl-5">
              {pr.trainerDelta.map((d) => <li key={d.qualification}>{t("console.course.pr.trainerRow", { n: d.count, q: d.qualification })}</li>)}
              {!pr.trainerDelta.length ? <li>{t("console.course.pr.none")}</li> : null}
            </ul>
          </div>
          <div>
            <h4 className="m-0 mb-1 font-semibold">{t("console.course.pr.equipment")}</h4>
            <ul className="m-0 pl-5">
              {pr.equipmentDelta.map((d) => <li key={d.item}>{t("console.course.pr.equipmentRow", { n: d.qty, item: d.item })}</li>)}
              {!pr.equipmentDelta.length ? <li>{t("console.course.pr.none")}</li> : null}
            </ul>
          </div>
        </div>
      ) : null}
    </article>
  );
}
