// One career path for a job seeker: the role, how many people get hired for it near them, the
// 1-3 skills to add, the nearest course with seats, and a free online starting point.
// Server component, no client JS.
import type { Lang, Provenance } from "@ks/contracts";
import { peopleSentence, roundPeople } from "@ks/core";
import { Card, formatNumber } from "@ks/ui";
import { getTranslations } from "next-intl/server";
import type { CareerPath } from "./candidate";
import { roleName, rolePlural } from "./roles";

export async function PathCard({
  path, index, total, districtName, labelOf, labelEnOf, provenance, lang,
}: {
  path: CareerPath;
  index: number;
  total: number;
  districtName: string;
  labelOf: (id: string) => string;
  labelEnOf: (id: string) => string;
  provenance: Provenance;
  lang: Lang;
}) {
  const t = await getTranslations();
  const n = (x: number) => formatNumber(x, lang);
  const sentence = peopleSentence({ gap: path.home, district: districtName, occupationLabel: rolePlural(path.role, lang), lang });
  const nearby = roundPeople(path.nearbyDemand);
  const c = path.course;
  const freeSkill = path.gaps[0] ?? path.role.skills[0]!;

  return (
    <Card
      variant="candidate"
      code={t("public.me.pathCode", { n: index + 1, total })}
      name={roleName(path.role, lang)}
      title={path.have.length ? t("public.me.have", { skills: path.have.map(labelOf).join(", ") }) : undefined}
      human={
        <>
          {sentence}
          {nearby > 0 && path.nearbyNames.length ? <> {t("public.me.nearby", { n: n(nearby), names: path.nearbyNames.join(", ") })}</> : null}
        </>
      }
      provenance={provenance}
      lang={lang}
      headingLevel={3}
      labels={{ asOf: t("card.asOf"), specimen: t("card.specimen"), specimenWord: t("card.specimenWord") }}
    >
      <div className="mt-3 grid gap-4 text-left">
        <section>
          <h4 className="m-0 mb-1 text-sm font-semibold uppercase tracking-wide">{t("public.me.toAdd")}</h4>
          {path.gaps.length ? (
            <ul className="m-0 grid gap-1 pl-5">
              {path.gaps.map((g) => (
                <li key={g}>{labelOf(g)}</li>
              ))}
            </ul>
          ) : (
            <p className="m-0">{t("public.me.haveAll")}</p>
          )}
        </section>
        <section>
          <h4 className="m-0 mb-1 text-sm font-semibold uppercase tracking-wide">{t("public.me.course")}</h4>
          {c ? (
            <p className="m-0">
              {t("public.me.courseLine", { course: c.course.name, institute: c.course.institutionName, district: c.districtName, seats: n(c.course.seats) })}{" "}
              <span className="text-ink-muted">{t(`public.me.courseWhere.${c.where}`)}</span>
            </p>
          ) : (
            <p className="m-0">{t("public.me.noCourse")}</p>
          )}
        </section>
        <section>
          <h4 className="m-0 mb-1 text-sm font-semibold uppercase tracking-wide">{t("public.me.free")}</h4>
          <p className="m-0">
            <a
              href={`https://swayam.gov.in/explorer?searchText=${encodeURIComponent(labelEnOf(freeSkill))}`}
              className="inline-flex min-h-11 items-center underline"
              rel="noopener noreferrer"
              target="_blank"
            >
              {t("public.me.freeLink", { skill: labelOf(freeSkill) })}
            </a>{" "}
            <span className="ks-mono border border-ink-faint px-1 text-xs uppercase">{t("public.me.example")}</span>
          </p>
          <p className="m-0 text-sm text-ink-muted">{t("public.me.freeNote")}</p>
        </section>
      </div>
    </Card>
  );
}
