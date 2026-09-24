// @ks/ui barrel. Client components carry "use client" in their own files, so importing
// from here in a Server Component is fine. Server-safe helpers live in plain modules
// (format, prefs, compareCore) so servers get real values, not client references.

// Server-safe components
export { Badge, VERDICTS, type BadgeProps, type Tone } from "./Badge";
export { Button, buttonClass, type ButtonProps, type ButtonVariant, type ButtonSize } from "./Button";
export { Card, GatewayCard, CARD_LABELS_EN, provenanceSources, type CardProps, type CardVariant, type CardFigure, type CardVerdict, type CardLabels, type GatewayCardProps } from "./Card";
export { DiffBlock, DIFF_LABELS_EN, type DiffBlockProps, type DiffLabels } from "./DiffBlock";
export { FreshnessStrip, FRESHNESS_LABELS_EN, type FreshnessStripProps, type FreshnessLabels } from "./FreshnessStrip";
export { Icon, type IconName, type IconProps } from "./Icon";
export { PeopleFigure, type PeopleFigureProps } from "./PeopleFigure";
export { Seal, type SealProps } from "./Seal";
export { SkeletonCard, type SkeletonCardProps } from "./SkeletonCard";
export { Watermark, WatermarkText, type WatermarkProps, type WatermarkKind } from "./Watermark";

// Client components
export { CardCase, type CardCaseProps } from "./CardCase";
export { Choropleth, type ChoroplethProps, type ChoroplethDatum, type ChoroplethLabels, type DistrictGeo, type DistrictFeature } from "./Choropleth";
export { CompareProvider, useCompare, useOptionalCompare, type CompareProviderProps, type CompareLabels } from "./Compare";
export { CompareTable, type CompareTableProps, type CompareTableLabels } from "./CompareTable";
export { CompareTray, type CompareTrayProps, type CompareTrayLabels } from "./CompareTray";
export { DataTable, type DataTableProps, type DataColumn, type ColumnFormat, type SortDir, type DataTableLabels } from "./DataTable";
export { EvidenceDrawer, type EvidenceDrawerProps, type EvidenceLabels } from "./EvidenceDrawer";
export { FigureButton, type FigureButtonProps, type FigureDelta } from "./FigureButton";
export { LangSwitcher, setLocaleCookie, type LangSwitcherProps } from "./LangSwitcher";
export { MapWithTable, type MapWithTableProps, type DistrictRow } from "./MapWithTable";
export { PersonaRail, PersonaMenu, type PersonaRailProps, type NavGroup, type NavItem } from "./PersonaRail";
export { PlotChart, type PlotChartProps, type PlotChartLabels, type ChartSpec } from "./PlotChart";
export { Sheet, type SheetProps } from "./Sheet";
export { SurveyStepper, type SurveyStepperProps, type SurveyStep, type SurveyLabels } from "./SurveyStepper";
export { TableToggle, type TableToggleProps } from "./TableToggle";
export { ThemeToggle, type ThemeToggleProps } from "./ThemeToggle";
export { LinkProvider, UiLink, type LinkLike, type UiLinkProps } from "./UiLink";

// Server-safe helpers
export { parseTable, fieldDiffers, TABLE_PARAM, TABLE_MAX, type CompareItem, type CompareField } from "./compareCore";
export { fill, formatAsOf, formatDate, formatDateTime, formatNumber, formatPercent, humanRound, intlLocale, isApprox } from "./format";
export { LOCALE_COOKIE, THEME_COOKIE, PREFS_BOOT_SCRIPT, type Theme } from "./prefs";
