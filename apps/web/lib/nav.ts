// Navigation model. Labels come from messages (nav.*); at most five destinations per persona.
// Parameterised pages (/districts/[lgd], /skills/[id], /courses/[id], /plans/[lgd]/[fy]) are
// reached from cards; see lib/routes.ts for their builders.
import type { NavGroup } from "@ks/ui";
import { routes } from "./routes";

type T = (key: string) => string;

export function navGroups(t: T): NavGroup[] {
  return [
    {
      heading: t("groups.start"),
      items: [{ href: routes.home(), label: t("home"), icon: "house", prefix: false }],
    },
    {
      heading: t("groups.officials"),
      items: [
        { href: routes.state(), label: t("state"), icon: "map" },
        { href: routes.radar(), label: t("radar"), icon: "broadcast" },
        { href: routes.outcomes(), label: t("outcomes"), icon: "target" },
      ],
    },
    {
      heading: t("groups.employers"),
      items: [{ href: routes.employer(), label: t("employer"), icon: "briefcase" }],
    },
    {
      heading: t("groups.candidates"),
      items: [{ href: routes.me(), label: t("me"), icon: "user" }],
    },
    {
      heading: t("groups.data"),
      items: [
        { href: routes.sources(), label: t("sources"), icon: "database" },
        { href: routes.review(), label: t("review"), icon: "eye" },
      ],
    },
  ];
}
