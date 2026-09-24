"use client";
// Client glue between Next and @ks/ui: next/link for UiLink, usePathname for the rail,
// router.refresh for the language switch, and the Compare provider + tray for every page.
import type { Lang } from "@ks/contracts";
import {
  CompareProvider, CompareTray, LangSwitcher, LinkProvider, PersonaMenu, PersonaRail, ThemeToggle,
  type CompareLabels, type CompareTableLabels, type CompareTrayLabels, type LinkLike, type NavGroup,
} from "@ks/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { resolveTableRefs } from "@/app/actions/table";

export function AppProviders({
  children, compareLabels, trayLabels, tableLabels,
}: {
  children: ReactNode;
  compareLabels: Partial<CompareLabels>;
  trayLabels: Partial<CompareTrayLabels>;
  tableLabels: Partial<CompareTableLabels>;
}) {
  return (
    <LinkProvider component={Link as unknown as LinkLike}>
      <CompareProvider labels={compareLabels}>
        {children}
        <CompareTray resolve={resolveTableRefs} labels={trayLabels} tableLabels={tableLabels} />
      </CompareProvider>
    </LinkProvider>
  );
}

export function NavRail({ groups, label }: { groups: NavGroup[]; label: string }) {
  const path = usePathname() ?? "/";
  return <PersonaRail groups={groups} currentPath={path} label={label} />;
}

export function TopTools({
  locale, groups, labels,
}: {
  locale: Lang;
  groups: NavGroup[];
  labels: { menu: string; closeMenu: string; nav: string; language: string; theme: { group: string; daylight: string; boardroom: string } };
}) {
  const router = useRouter();
  const path = usePathname() ?? "/";
  return (
    <div className="ks-topbar__tools">
      <LangSwitcher current={locale} label={labels.language} onChange={() => router.refresh()} />
      <ThemeToggle labels={labels.theme} />
      <PersonaMenu groups={groups} currentPath={path} label={labels.nav} menuLabel={labels.menu} closeLabel={labels.closeMenu} />
    </div>
  );
}
