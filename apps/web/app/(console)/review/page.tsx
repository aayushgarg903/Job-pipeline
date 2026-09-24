// /review: the admin review queue as cards. Low-confidence extractions, unknown skills,
// duplicate postings and flagged survey answers, each with the sentence that triggered it
// and approve / reject Server Actions. Demo queue until a review reader exists.
import { Card, formatNumber, formatPercent } from "@ks/ui";
import type { Metadata } from "next";
import { Suspense } from "react";
import { NextStep, PageHead, Section, cardLabels, pageContext } from "@/components/console/common";
import { loadState } from "@/components/console/data";
import { REVIEW_QUEUE, type ReviewKind } from "@/components/console/review";
import { ReviewActions } from "@/components/console/ReviewActions";
import { getWriters } from "@/components/console/writers";
import { PageSkeleton } from "@/components/PageSkeleton";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Review queue" };

const KINDS: ReviewKind[] = ["low-confidence", "unknown-skill", "duplicate", "survey-outlier"];
const TONE = { "low-confidence": "watch", "unknown-skill": "gap", duplicate: "neutral", "survey-outlier": "watch" } as const;
const GLYPH = { "low-confidence": "?", "unknown-skill": "+", duplicate: "=", "survey-outlier": "!" } as const;

async function ReviewBody() {
  const [{ lang, t }, s, writers] = await Promise.all([pageContext(), loadState(), getWriters()]);
  const names = new Map(s.districts.map((d) => [d.district.lgd, lang === "mr" ? d.district.nameMr : d.district.nameEn]));
  const L = cardLabels(t);
  const actionLabels = t.raw("console.review.actions") as never;

  return (
    <>
      <PageHead title={t("console.review.title")} lede={t("console.review.lede", { n: REVIEW_QUEUE.length })} />
      {!writers ? <p className="ks-stock mb-6 max-w-[70ch] p-4">{t("console.review.demoNote")}</p> : null}

      {KINDS.map((kind) => {
        const items = REVIEW_QUEUE.filter((i) => i.kind === kind);
        if (!items.length) return null;
        return (
          <Section key={kind} id={`q-${kind}`} title={t(`console.review.kind.${kind}.title`, { n: items.length })} lede={t(`console.review.kind.${kind}.lede`)}>
            <div className="ks-card-grid">
              {items.map((i) => (
                <Card
                  key={i.id}
                  variant="pr"
                  code={`${i.id.toUpperCase()} · ${names.get(i.lgd) ?? i.lgd}`}
                  name={t(`console.review.kind.${kind}.name`)}
                  title={i.title}
                  figure={
                    i.confidence !== null
                      ? { label: t("console.review.confidence"), value: formatPercent(i.confidence, lang), evidenceTitle: i.title, evidence: [{ kind: "posting", title: i.title, detail: i.evidence, source: i.source, date: i.date, url: null }] }
                      : { label: t("console.review.rows"), value: formatNumber(i.count, lang), evidenceTitle: i.title, evidence: [{ kind: kind === "survey-outlier" ? "survey" : "posting", title: i.title, detail: i.evidence, source: i.source, date: i.date, url: null }] }
                  }
                  verdict={{ tone: TONE[kind], glyph: GLYPH[kind], word: t(`console.review.kind.${kind}.word`), text: i.proposal }}
                  human={<>&ldquo;{i.evidence}&rdquo;</>}
                  provenance={{ sources: [{ kind: kind === "survey-outlier" ? "surveys" : "postings", label: t("console.review.affected"), n: i.count }], asOf: i.date, isDemo: true, lapsed: false }}
                  lang={lang}
                  labels={L}
                >
                  <div className="mt-3">
                    <ReviewActions id={i.id} labels={actionLabels} />
                  </div>
                </Card>
              ))}
            </div>
          </Section>
        );
      })}

      <NextStep
        t={t}
        sentence={t("console.review.next")}
        actions={[
          { href: routes.sources(), label: t("console.review.openSources"), primary: true, icon: "database" },
          { href: routes.radar(), label: t("console.review.openRadar"), icon: "broadcast" },
        ]}
      />
    </>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<PageSkeleton cards={4} variant="pr" />}>
      <ReviewBody />
    </Suspense>
  );
}
