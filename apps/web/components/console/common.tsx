// Shared bits for console pages: locale + translator (request-bound, never inside "use cache"),
// card label sets, label lookups, the page head, voices, and the next-step footer.
import type { EvidenceRow, Lang, Skill } from "@ks/contracts";
import { Button, formatDate, type CardLabels, type EvidenceLabels, type IconName } from "@ks/ui";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { Tr } from "@/lib/cards";

type Vals = Record<string, unknown> | undefined;
/** Numbers go in as plain Latin-digit strings: Marathi figures stay Latin (humanize.ts), and
 *  ICU plural selection still works because it coerces numeric strings. */
const latin = (v: Vals) => (v ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === "number" ? String(x) : x])) : v);

export async function pageContext() {
  const [locale, base] = await Promise.all([getLocale(), getTranslations()]);
  const lang: Lang = locale === "mr" ? "mr" : "en";
  const b = base as unknown as { (k: string, v?: Vals): string; rich(k: string, v?: Vals): ReactNode; raw(k: string): unknown };
  const t = Object.assign((key: string, values?: Vals) => b(key, latin(values)), {
    rich: (key: string, values?: Vals) => b.rich(key, latin(values)),
    raw: (key: string) => b.raw(key),
  }) as unknown as Tr;
  return { lang, t };
}

export function cardLabels(t: Tr): Partial<CardLabels> {
  return {
    asOf: t("card.asOf"), specimen: t("card.specimen"), specimenWord: t("card.specimenWord"), lapsed: t("card.lapsed"),
    lapsedWord: t("card.lapsedWord"), endorsed: t.raw("card.endorsed") as string, placeOnTable: t("card.placeOnTable"),
    onTable: t("card.onTable"), open: t("card.open"), why: t("card.why"),
  };
}

export const evidenceLabels = (t: Tr) => t.raw("evidence") as Partial<EvidenceLabels>;
export const chartLabels = (t: Tr) => t.raw("chart") as Record<string, string>;
export const tableLabels = (t: Tr) => t.raw("table") as Record<string, string>;

export function skillLabeler(skills: Skill[], lang: Lang) {
  const m = new Map(skills.map((s) => [s.id, lang === "mr" && s.labelMr ? s.labelMr : s.labelEn]));
  return (id: string) => m.get(id) ?? id;
}

export function PageHead({ title, lede, eyebrow }: { title: string; lede?: ReactNode; eyebrow?: string }) {
  return (
    <header className="ks-page-head">
      {eyebrow ? <p className="ks-mono text-sm text-table-muted">{eyebrow}</p> : null}
      <h1 className="ks-page-title">{title}</h1>
      {lede ? <p className="ks-page-lede">{lede}</p> : null}
    </header>
  );
}

export function Section({ id, title, children, lede }: { id: string; title: string; children: ReactNode; lede?: ReactNode }) {
  return (
    <section aria-labelledby={id} className="ks-section">
      <h2 id={id} className="ks-section__title">{title}</h2>
      {lede ? <p className="mb-3 max-w-[62ch] text-table-ink">{lede}</p> : null}
      {children}
    </section>
  );
}

/** Evidence rows as voices (Design.md rule 2): who said it, when, where from. */
export function Voices({ rows, lang, t, empty }: { rows: EvidenceRow[]; lang: Lang; t: Tr; empty: string }) {
  if (!rows.length) return <p className="ks-stock p-4">{empty}</p>;
  const quoted = new Set(["posting", "survey", "consultation"]);
  return (
    <ol className="ks-voices md:grid-cols-2">
      {rows.map((r, i) => (
        <li key={`${r.kind}-${i}`}>
          <figure className="ks-voice">
            <span className="ks-voice__kind">{t(`evidence.kinds.${r.kind}`)}</span>
            <p className="ks-voice__title">{r.title}</p>
            {r.detail ? (
              quoted.has(r.kind) ? (
                <blockquote className="ks-voice__quote"><p>{r.detail}</p></blockquote>
              ) : (
                <p className="ks-voice__detail">{r.detail}</p>
              )
            ) : null}
            <figcaption className="ks-voice__cite">
              <span>{r.source}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={r.date}>{formatDate(r.date, lang)}</time>
            </figcaption>
          </figure>
        </li>
      ))}
    </ol>
  );
}

export interface NextAction {
  href: string;
  label: string;
  icon?: IconName;
  primary?: boolean;
  download?: boolean;
}

/** Rule 5: every screen ends in a next step a human can take. */
export function NextStep({ t, sentence, actions, children }: { t: Tr; sentence: ReactNode; actions: NextAction[]; children?: ReactNode }) {
  return (
    <section aria-labelledby="next-step" className="ks-section">
      <hr className="ks-rule-end" />
      <div className="ks-stock grid gap-3 p-5">
        <h2 id="next-step" className="ks-section__title m-0">{t("console.common.nextStep")}</h2>
        <p className="m-0 max-w-[62ch]">{sentence}</p>
        {children}
        <div className="flex flex-wrap gap-2">
          {actions.map((a) =>
            a.download ? (
              <a key={a.href} href={a.href} className={a.primary ? "ks-btn" : "ks-btn ks-btn--secondary"} download>
                {a.label}
              </a>
            ) : (
              <Button key={a.href} href={a.href} variant={a.primary ? "primary" : "secondary"} iconAfter={a.icon ?? "arrow-right"}>
                {a.label}
              </Button>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

/** "every day" / "every 3 days" / "every 6 hours", from an SLA in hours. */
export function slaPhrase(hours: number, t: Tr): string {
  if (hours < 24) return t("console.common.everyHours", { n: hours });
  const days = Math.round(hours / 24);
  if (days % 30 === 0 && days >= 30) return t("console.common.everyMonths", { n: days / 30 });
  return t("console.common.everyDays", { n: days });
}
