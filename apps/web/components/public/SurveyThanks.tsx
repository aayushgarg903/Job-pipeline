"use client";
// Thank-you card: tells the employer, in people-terms, what their answer now feeds into,
// and ends with a next step (review course changes, or answer for another role).
import type { Lang } from "@ks/contracts";
import { formatNumber } from "@ks/ui";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { SurveyState } from "@/app/actions/public";
import { routes } from "@/lib/routes";

export function SurveyThanks({ state }: { state: Extract<SurveyState, { status: "ok" }> }) {
  const t = useTranslations("public");
  const lang = (useLocale() === "mr" ? "mr" : "en") as Lang;
  const f = state.facts;
  const n = (v: number) => formatNumber(v, lang);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  return (
    <article className="ks-card ks-card--employer" lang={lang === "mr" ? "mr" : undefined} aria-labelledby="sv-thanks">
      <div className="ks-card__head">
        <span className="ks-card__code">{t("survey.thanks.code")}</span>
      </div>
      <div className="ks-card__body grid gap-3 text-left">
        <h2 id="sv-thanks" ref={heading} tabIndex={-1} className="ks-card__name m-0 text-center outline-none">
          {t("survey.thanks.title")}
        </h2>
        <p className="m-0 text-lg">{t("survey.thanks.counted", { hires: n(f.hires), role: f.role, district: f.district })}</p>
        {f.sentence ? (
          <p className="m-0">
            {t("survey.thanks.others")} <em>{f.sentence}</em>
          </p>
        ) : null}
        <p className="m-0">{t("survey.thanks.skills", { skills: f.skills.join(", "), district: f.district, mustHave: n(f.mustHave) })}</p>
        <p className="m-0">
          {f.courses > 0
            ? t("survey.thanks.courses", { district: f.district, courses: n(f.courses), institutes: n(f.institutes) })
            : t("survey.thanks.coursesNone", { district: f.district })}
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Link href={`${routes.employer()}/prs`} className="ks-btn">
            {t("survey.thanks.next")}
          </Link>
          <a href={routes.employer()} className="ks-btn ks-btn--secondary">
            {t("survey.thanks.again")}
          </a>
        </div>
        <p className="m-0 text-sm text-ink-muted">{t("survey.thanks.rights")}</p>
      </div>
      <footer className="ks-card__prov">
        <span className="ks-card__prov-sources">{t("survey.thanks.reference", { id: state.id })}</span>
        {state.demo ? <span className="ks-card__prov-marks">{t("demo.writes")}</span> : null}
      </footer>
    </article>
  );
}
