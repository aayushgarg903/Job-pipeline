import { UiLink } from "@ks/ui";
import { getTranslations } from "next-intl/server";
import { routes } from "@/lib/routes";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  return (
    <footer className="ks-footer">
      <div className="ks-footer__inner">
        <ul className="ks-footer__links">
          <li><UiLink href={routes.accessibility()}>{t("accessibility")}</UiLink></li>
          <li><UiLink href={routes.feedback()}>{t("feedback")}</UiLink></li>
          <li><UiLink href={routes.lastUpdated()}>{t("lastUpdated")}</UiLink></li>
        </ul>
        <p className="ks-footer__note">{t("demoNote")}</p>
      </div>
    </footer>
  );
}
