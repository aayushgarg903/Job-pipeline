"use client";
// Navigation: left rail on >=1024px (icon + label); a "Menu" button opening a sheet below that.
import { useState } from "react";
import { Icon, type IconName } from "./Icon";
import { Sheet } from "./Sheet";
import { UiLink } from "./UiLink";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Also active on nested paths, e.g. /districts matches /districts/490. Default true. */
  prefix?: boolean;
}

export interface NavGroup {
  heading: string;
  items: NavItem[];
}

export interface PersonaRailProps {
  groups: NavGroup[];
  currentPath: string;
  label?: string;
  menuLabel?: string;
  closeLabel?: string;
}

export function isActive(item: NavItem, path: string): boolean {
  if (item.href === "/") return path === "/";
  return path === item.href || ((item.prefix ?? true) && path.startsWith(`${item.href}/`));
}

function Links({ groups, currentPath, onNavigate }: { groups: NavGroup[]; currentPath: string; onNavigate?: () => void }) {
  return (
    <>
      {groups.map((g) => (
        <div key={g.heading}>
          <p className="ks-rail__heading">{g.heading}</p>
          <ul className="ks-rail__group">
            {g.items.map((it) => (
              <li key={it.href}>
                <UiLink
                  href={it.href}
                  className="ks-rail__link"
                  aria-current={isActive(it, currentPath) ? "page" : undefined}
                  onClick={onNavigate}
                >
                  <Icon name={it.icon} size={20} />
                  {it.label}
                </UiLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

/** Desktop rail. Place inside the shell grid. */
export function PersonaRail({ groups, currentPath, label = "Main" }: PersonaRailProps) {
  return (
    <nav className="ks-rail" aria-label={label}>
      <Links groups={groups} currentPath={currentPath} />
    </nav>
  );
}

/** Mobile/tablet menu button + sheet. Place in the top bar. */
export function PersonaMenu({ groups, currentPath, label = "Main", menuLabel = "Menu", closeLabel = "Close menu" }: PersonaRailProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="ks-btn ks-btn--table ks-btn--sm ks-menu-btn" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <Icon name="list" size={18} />
        {menuLabel}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={menuLabel} side="left" closeLabel={closeLabel}>
        <nav className="ks-menu" aria-label={label}>
          <Links groups={groups} currentPath={currentPath} onNavigate={() => setOpen(false)} />
        </nav>
      </Sheet>
    </>
  );
}
