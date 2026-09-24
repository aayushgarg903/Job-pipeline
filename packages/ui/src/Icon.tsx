// Phosphor icons, thin weight, one weight throughout. Server-safe (SSR build of Phosphor).
// Icons are referenced by name so server components can pass them to client ones.
import {
  ArrowDown, ArrowRight, ArrowUp, ArrowsDownUp, Briefcase, Broadcast, Buildings, CaretDown,
  CaretLeft, CaretRight, CaretUp, ChartLine, Check, CheckCircle, ClipboardText, Compass, Database,
  DownloadSimple, Eye, Factory, FileText, GraduationCap, Handshake, House, Info, List,
  MagnifyingGlass, MapTrifold, Minus, Moon, Plus, Quotes, Rows, Scales, Seal, SealCheck, Stack,
  Student, Sun, Table, Target, Translate, User, Warning, X,
} from "@phosphor-icons/react/dist/ssr";
import type { ComponentType } from "react";

const ICONS = {
  "arrow-down": ArrowDown, "arrow-right": ArrowRight, "arrow-up": ArrowUp, sort: ArrowsDownUp,
  briefcase: Briefcase, broadcast: Broadcast, buildings: Buildings, "caret-down": CaretDown,
  "caret-left": CaretLeft, "caret-right": CaretRight, "caret-up": CaretUp, chart: ChartLine,
  check: Check, "check-circle": CheckCircle, clipboard: ClipboardText, compass: Compass,
  database: Database, download: DownloadSimple, eye: Eye, factory: Factory, file: FileText,
  graduation: GraduationCap, handshake: Handshake, house: House, info: Info, list: List,
  search: MagnifyingGlass, map: MapTrifold, minus: Minus, moon: Moon, plus: Plus, quotes: Quotes,
  rows: Rows, scales: Scales, seal: Seal, "seal-check": SealCheck, stack: Stack, student: Student,
  sun: Sun, table: Table, target: Target, translate: Translate, user: User, warning: Warning, x: X,
} satisfies Record<string, ComponentType<{ size?: number | string; weight?: "thin" }>>;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  size?: number;
  /** Give a label only when the icon stands alone. Beside a text label it stays aria-hidden. */
  label?: string;
  className?: string;
}

export function Icon({ name, size = 20, label, className }: IconProps) {
  const C = ICONS[name];
  return (
    <C
      size={size}
      weight="thin"
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable="false"
    />
  );
}
