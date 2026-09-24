import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { PageSkeleton } from "@/components/PageSkeleton";
import { SignInForm } from "./SignInForm";

type Props = { searchParams: Promise<{ next?: string }> };

async function Body({ searchParams }: Props) {
  const t = await getTranslations("console.signin");
  const sp = await searchParams;
  const next = typeof sp.next === "string" && /^\/(?!\/)/.test(sp.next) ? sp.next : "/state";
  return (
    <div className="ks-stack" style={{ gap: 24 }}>
      <h1>{t("title")}</h1>
      <p>{t("intro")}</p>
      <SignInForm next={next} labels={{
        name: t("name"), passcode: t("passcode"), submit: t("submit"),
        errors: { invalid: t("errors.invalid"), wrong: t("errors.wrong"), disabled: t("errors.disabled"), slow: t("errors.slow") },
      }} />
    </div>
  );
}

export default function SignInPage(props: Props) {
  return <Suspense fallback={<PageSkeleton />}><Body {...props} /></Suspense>;
}
