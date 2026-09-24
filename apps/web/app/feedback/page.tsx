import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/PageSkeleton";

async function FeedbackPageBody() {
  const t = await getTranslations("pages.feedback");
  return (
    <article className="max-w-3xl">
      <header className="ks-page-head">
        <h1 className="ks-page-title">{t("title")}</h1>
        <p className="ks-page-lede">{t("lede")}</p>
      </header>
      <div className="ks-stock grid gap-4 p-6 text-base">
        <p className="m-0">{t("p1")}</p>
        <p className="m-0">{t("p2")}</p>
      </div>
    </article>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={<PageSkeleton cards={1} />}>
      <FeedbackPageBody />
    </Suspense>
  );
}
