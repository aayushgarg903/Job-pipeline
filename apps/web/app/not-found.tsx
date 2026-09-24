import { Button } from "@ks/ui";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/PageSkeleton";

async function NotFoundBody() {
  const t = await getTranslations("notFound");
  return (
    <article className="ks-stock mx-auto grid max-w-2xl gap-4 p-8">
      <h1 className="ks-page-title" style={{ color: "var(--ink)" }}>{t("title")}</h1>
      <p className="m-0 text-lg">{t("body")}</p>
      <p className="m-0">
        <Button href="/" icon="house">{t("home")}</Button>
      </p>
    </article>
  );
}

export default function NotFound() {
  return (
    <Suspense fallback={<PageSkeleton cards={1} />}>
      <NotFoundBody />
    </Suspense>
  );
}
