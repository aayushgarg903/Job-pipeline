// /me: the job-seeker path. Mobile-first (375px), no map, server-rendered: the form posts to a
// Server Action (works without JavaScript), which reads the text once and redirects here with
// only a district and skill ids in the URL. No login, nothing stored.
import type { Lang } from "@ks/contracts";
import { templateNarrate } from "@ks/ai";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { findPathsAction } from "@/app/actions/public";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PathCard } from "@/components/public/PathCard";
import { decodeHeld, rankPaths } from "@/components/public/candidate";
import { roleName } from "@/components/public/roles";
import { getReaders } from "@/lib/readers";

export const metadata: Metadata = { title: "Where can your skills take you? · तुमचे पुढचे कार्ड" };

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function MeBody({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const [t, locale, readers] = await Promise.all([getTranslations("public.me"), getLocale(), getReaders()]);
  const lang = (locale === "mr" ? "mr" : "en") as Lang;
  const [districts, catalog] = await Promise.all([readers.districts(), readers.searchSkills("", 500)]);
  const known = new Set(catalog.map((s) => s.id));
  const nameOf = (d: (typeof districts)[number]) => (lang === "mr" ? d.district.nameMr : d.district.nameEn);
  const options = districts.map((d) => ({ lgd: d.district.lgd, name: nameOf(d) })).sort((a, b) => a.name.localeCompare(b.name, lang));
  const byId = new Map(catalog.map((s) => [s.id, s]));
  const labelOf = (id: string) => {
    const s = byId.get(id);
    return s ? (lang === "mr" && s.labelMr ? s.labelMr : s.labelEn) : id;
  };
  const labelEnOf = (id: string) => byId.get(id)?.labelEn ?? id;

  const lgd = one(sp.d) ?? "";
  const home = districts.find((d) => d.district.lgd === lgd) ?? null;
  const via = one(sp.via);
  const err = one(sp.err);
  const held = decodeHeld(one(sp.s), known);
  const showResult = !!home && (via === "ai" || via === "words" || via === "none");
  const paths = showResult ? await rankPaths(readers, { lgd, held, lang, catalog }) : [];
  const top = paths[0];
  const narrative =
    showResult && home && top
      ? templateNarrate(
          "candidate-path",
          {
            district: home.district.nameEn, districtMr: home.district.nameMr,
            role: top.role.en, roleMr: top.role.mr,
            openings: top.home.demand || undefined,
            have: top.have.map(labelEnOf), haveMr: top.have.map(labelOf),
            gaps: top.gaps.map(labelEnOf), gapsMr: top.gaps.map(labelOf),
            course: top.course?.course.name, seats: top.course?.course.seats, institute: top.course?.course.institutionName,
          },
          lang,
        )
      : null;

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <header className="ks-page-head m-0">
        <p className="ks-mono m-0 text-sm text-table-muted">{t("code")}</p>
        <h1 className="ks-page-title text-[1.75rem] sm:text-[2.25rem]">{showResult && home ? t("resultTitle", { district: nameOf(home) }) : t("title")}</h1>
        {!showResult ? <p className="ks-page-lede">{t("lede")}</p> : null}
      </header>

      {showResult && home ? (
        <>
          <section aria-labelledby="me-understood" className="ks-stock grid gap-2 p-4">
            <h2 id="me-understood" className="m-0 text-base font-semibold">
              {t("understood")}
            </h2>
            {held.length ? (
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {held.map((h) => (
                  <li key={h.skillId} className="border border-ink-muted px-2 py-1">
                    {labelOf(h.skillId)} <span className="text-ink-muted">· {t(`level.${h.proficiency}`)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="m-0 text-sm text-ink-muted">{via === "ai" ? t("viaAi") : via === "words" ? t("viaWords") : t("viaNone")}</p>
          </section>

          {narrative ? <p className="m-0 max-w-[62ch] text-lg text-table-ink">{narrative}</p> : null}

          {paths.length ? (
            <ol className="m-0 grid list-none gap-6 p-0" aria-label={t("resultTitle", { district: nameOf(home) })}>
              {paths.map((p, i) => (
                <li key={p.role.key} aria-label={roleName(p.role, lang)}>
                  <PathCard path={p} index={i} total={paths.length} districtName={nameOf(home)} labelOf={labelOf} labelEnOf={labelEnOf} provenance={home.provenance} lang={lang} />
                </li>
              ))}
            </ol>
          ) : (
            <p className="ks-stock m-0 p-4">{t("noPaths", { district: nameOf(home) })}</p>
          )}
          <h2 className="ks-section__title m-0">{t("again")}</h2>
        </>
      ) : null}

      <form action={findPathsAction} className="ks-stock grid gap-4 p-4">
        <input type="hidden" name="lang" value={lang} />
        <div className="ks-field">
          <label htmlFor="me-text">{t("textLabel")}</label>
          <p id="me-text-hint" className="ks-field__hint m-0">
            {t("textHint")}
          </p>
          <textarea
            id="me-text" name="text" rows={4} required minLength={2} maxLength={600} placeholder={t("placeholder")}
            aria-describedby={err === "text" ? "me-text-hint me-text-err" : "me-text-hint"} aria-invalid={err === "text" ? true : undefined}
            className="w-full text-base"
          />
          {err === "text" ? <p id="me-text-err" className="m-0 font-medium text-signal-gap">▲ {t("errText")}</p> : null}
        </div>
        <div className="ks-field">
          <label htmlFor="me-lgd">{t("district")}</label>
          <select
            id="me-lgd" name="lgd" required defaultValue={home ? home.district.lgd : ""}
            aria-describedby={err === "district" ? "me-lgd-err" : undefined} aria-invalid={err === "district" ? true : undefined}
            className="w-full text-base"
          >
            <option value="" disabled>
              {t("choose")}
            </option>
            {options.map((o) => (
              <option key={o.lgd} value={o.lgd}>
                {o.name}
              </option>
            ))}
          </select>
          {err === "district" ? <p id="me-lgd-err" className="m-0 font-medium text-signal-gap">▲ {t("errDistrict")}</p> : null}
        </div>
        <button type="submit" className="ks-btn ks-btn--lg w-full justify-center sm:w-auto">
          {t("submit")}
        </button>
        <p className="m-0 text-sm text-ink-muted">{t("privacy")}</p>
      </form>
    </div>
  );
}

export default function MePage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<PageSkeleton cards={1} variant="candidate" />}>
      <MeBody searchParams={searchParams} />
    </Suspense>
  );
}
