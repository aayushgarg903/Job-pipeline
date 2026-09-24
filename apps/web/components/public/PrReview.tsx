"use client";
// Endorse / Request change / Not relevant, with an optional comment, through the reviewPr
// Server Action. The seal count moves at once (useOptimistic) and settles on the server's
// number when the page refreshes. One answer per employer: changing it moves the count.
import type { Lang } from "@ks/contracts";
import { Seal, formatNumber } from "@ks/ui";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState, useOptimistic } from "react";
import { reviewPrAction, type ReviewState } from "@/app/actions/public";

type Verdict = "endorse" | "change" | "irrelevant";
const VERDICTS: Verdict[] = ["endorse", "change", "irrelevant"];

export function PrReview({
  prId, endorsements, changeRequests, mine, myComment, lang, compact, detailHref,
}: {
  prId: string;
  endorsements: number; // server truth, including this employer's answer
  changeRequests: number;
  mine: Verdict | null;
  myComment: string | null;
  lang: Lang;
  compact: boolean;
  detailHref?: string;
}) {
  const t = useTranslations("public.prs.review");
  const [state, dispatch, pending] = useActionState<ReviewState, FormData>(reviewPrAction, { status: "idle" });
  const current = state.status === "ok" ? state.verdict : mine;
  const [view, apply] = useOptimistic({ e: endorsements, c: changeRequests, v: current }, (s, v: Verdict) => ({
    e: s.e + (v === "endorse" ? 1 : 0) - (s.v === "endorse" ? 1 : 0),
    c: s.c + (v === "change" ? 1 : 0) - (s.v === "change" ? 1 : 0),
    v,
  }));

  function act(fd: FormData) {
    const v = fd.get("verdict");
    if (v === "endorse" || v === "change" || v === "irrelevant") apply(v);
    dispatch(fd);
  }

  const n = (x: number) => formatNumber(x, lang);
  const legendId = `pr-${prId}-legend`;

  return (
    <section className="ks-stock grid gap-3 p-4" aria-labelledby={legendId}>
      <div className="flex flex-wrap items-center gap-4">
        <Seal count={view.e} label={t("sealLabel", { n: n(view.e) })} showLabel size={56} />
        <p className="m-0 text-sm text-ink-muted">{t("changes", { n: n(view.c) })}</p>
      </div>
      <form action={act} className="grid gap-3">
        <input type="hidden" name="prId" value={prId} />
        <h3 id={legendId} className="m-0 text-base font-semibold">
          {t("legend")}
        </h3>
        {!compact ? (
          <div className="ks-field">
            <label htmlFor={`pr-${prId}-comment`}>{t("comment")}</label>
            <p id={`pr-${prId}-hint`} className="ks-field__hint m-0">
              {t("commentHint")}
            </p>
            <textarea id={`pr-${prId}-comment`} name="comment" rows={3} maxLength={1000} defaultValue={myComment ?? ""} aria-describedby={`pr-${prId}-hint`} className="w-full" />
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby={legendId}>
          {VERDICTS.map((v) => (
            <button
              key={v}
              type="submit"
              name="verdict"
              value={v}
              disabled={pending}
              aria-pressed={view.v === v}
              className={`ks-btn ${v === "endorse" ? "" : "ks-btn--secondary"} min-h-11`}
            >
              {view.v === v ? <span aria-hidden="true">✓ </span> : null}
              {t(v)}
            </button>
          ))}
          {compact && detailHref ? (
            <Link href={detailHref} className="ks-btn ks-btn--ghost min-h-11">
              {t("comment")} →
            </Link>
          ) : null}
        </div>
        <p className="m-0 min-h-6 text-sm" role="status" aria-live="polite">
          {pending ? t("sending") : state.status === "error" ? t("error") : state.status === "ok" ? `${t("yours", { verdict: t(state.verdict) })} ${t("thanks")}` : view.v ? t("yours", { verdict: t(view.v) }) : ""}
        </p>
      </form>
    </section>
  );
}
