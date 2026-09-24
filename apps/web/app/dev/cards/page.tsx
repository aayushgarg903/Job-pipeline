import { notFound } from "next/navigation";
// Design-system gallery: every @ks/ui component and state, in Daylight and Boardroom,
// in English and Marathi. Dev tooling: section headings are English on purpose;
// component copy comes from messages/{en,mr}.json.
import type { Lang } from "@ks/contracts";
import { CompareTable, MapWithTable, PlotChart, formatNumber, formatPercent } from "@ks/ui";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { toCompareItem, type Tr } from "@/lib/cards";
import { mhDistricts } from "@/lib/geo";
import { navGroups } from "@/lib/nav";
import { CardsSection } from "./CardsSection";
import { buildCards, chartSpecs, loadGallery, type GalleryData } from "./data";
import { DrawerStates, StepperDemo, Switchers } from "./Demos";
import { Primitives, Tokens } from "./PrimitivesSection";
import "./gallery.css";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/PageSkeleton";

export const metadata: Metadata = { title: "Design system gallery", robots: { index: false } };

function Block({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="ks-section">
      <h2 id={id} className="ks-section__title">{title}</h2>
      {children}
    </section>
  );
}

function DataViews({ d, t, lang, idPrefix }: { d: GalleryData; t: Tr; lang: Lang; idPrefix: string }) {
  const { dname, course } = buildCards(d, t, lang);
  const specs = chartSpecs(d, dname, lang);
  const chartL = t.raw("chart") as never;
  const rows = d.districts.map((s) => ({
    lgd: s.district.lgd,
    name: lang === "mr" ? s.district.nameMr : s.district.nameEn,
    value: s.mismatch,
    coverage: s.coverage,
    display: formatNumber(s.mismatch, lang, { maximumFractionDigits: 2 }),
    shortage: s.topShortage?.label ?? "—",
    postings: s.postings,
    coverageText: formatPercent(s.coverage, lang),
  }));
  const items = course.slice(0, 3).map(toCompareItem).filter((x) => x !== null);
  return (
    <div className="grid gap-8">
      <Block id={`${idPrefix}-compare`} title="CompareTable · difference highlighting and summary slot">
        <div data-theme-surface="table" className="ks-gallery-table">
          <CompareTable
            items={items}
            summary={lang === "mr" ? "नाशिकचा सौर अभ्यासक्रम 71% जणांना नोकरी देतो; फिटर अभ्यासक्रम 54%." : "The Nashik solar course places 71 of every 100 trainees; the Fitter course places 54, and teaches CNC at basic level only."}
            labels={t.raw("compareTable") as never}
          />
        </div>
      </Block>
      <Block id={`${idPrefix}-charts`} title="PlotChart · line + band, sorted bar, slope, dot matrix">
        <div className="grid gap-4 lg:grid-cols-2">
          <PlotChart title={lang === "mr" ? "सौर पीव्ही मागणी, राज्य" : "Solar PV demand, state"} summary={lang === "mr" ? "मागणी दोन वर्षांत वाढली आहे आणि पुढील दोन तिमाही वाढत राहील असा अंदाज आहे." : "Demand has climbed for two years and is forecast to keep rising for the next two quarters."} chart={specs.trend} labels={chartL} csvName="solar-trend" />
          <PlotChart title={lang === "mr" ? "सीएनसी प्रोग्रामिंग: कुठे सर्वात जास्त गरज" : "CNC programming: where the need is biggest"} summary={lang === "mr" ? "पुण्यात सर्वात मोठा तुटवडा आहे, सुमारे 930 लोक." : "Pune is short by the most people, about 930, far ahead of the next district."} chart={specs.bars} labels={chartL} csvName="cnc-by-district" />
          <PlotChart title={lang === "mr" ? "नाशिक: जागा आधी → नंतर" : "Nashik seats, before → after the plan"} summary={lang === "mr" ? "सौर जागा 40 वरून 100, फिटर 120 वरून 80, आणि नवा EV अभ्यासक्रम 40 जागांसह." : "Solar seats go from 40 to 100, Fitter from 120 to 80, and a new EV course opens with 40."} chart={specs.slope} labels={chartL} csvName="nashik-plan" />
          <PlotChart title={lang === "mr" ? "डेटा एंट्री अभ्यासक्रम: कौशल्य व्याप्ती" : "Data Entry course: skill coverage"} summary={lang === "mr" ? "आवश्यक तीनपैकी दोन कौशल्ये शिकवली जातात; पॉवर बीआय नाही." : "Two of the three must-have skills are taught; Power BI is missing. Filled dots are taught, rings are missing."} chart={specs.dots} labels={chartL} csvName="coverage" headers={{ row: "Skill", col: "Importance", covered: "Taught" }} />
        </div>
      </Block>
      <Block id={`${idPrefix}-map`} title="Choropleth + DataTable · 36 districts, hatched = low signal">
        <MapWithTable
          geo={mhDistricts}
          rows={rows}
          caption={t("map.legendTitle")}
          hrefTemplate="/districts/{lgd}"
          initialSort={{ key: "value", dir: "descending" }}
          lang={lang}
          mapLabels={t.raw("map") as never}
          tableLabels={t.raw("table") as never}
          columns={[
            { key: "name", header: t("fields.district") },
            { key: "value", header: t("fields.mismatch"), format: "decimal" },
            { key: "shortage", header: t("fields.shortage") },
            { key: "postings", header: lang === "mr" ? "जाहिराती" : "Job posts", format: "number" },
            { key: "coverage", header: t("fields.coverage"), format: "percent" },
          ]}
        />
      </Block>
    </div>
  );
}

async function GalleryPageBody() {
  const [en, mr, d] = await Promise.all([getTranslations({ locale: "en" }), getTranslations({ locale: "mr" }), loadGallery()]);
  const tEn = en as unknown as Tr;
  const tMr = mr as unknown as Tr;
  const evRows = d.evidence["487"] ?? [];
  return (
    <div className="ks-gallery">
      <header className="ks-page-head">
        <h1 className="ks-page-title">Design system gallery</h1>
        <p className="ks-page-lede">Every @ks/ui component and state. Daylight first, then Boardroom, then Marathi. Press T on a focused card to place it on the table.</p>
      </header>

      <Block id="tokens" title="Tokens and type"><Tokens /></Block>
      <Block id="cards-en" title="Cards · Daylight · English"><CardsSection d={d} t={tEn} lang="en" idPrefix="en" /></Block>
      <Block id="primitives" title="Buttons, badges, watermarks, seal, people figure, freshness, diff"><Primitives d={d} t={tEn} lang="en" /></Block>
      <Block id="overlays" title="Evidence drawer states and sheets">
        <DrawerStates rows={evRows} labels={en.raw("evidence") as never} lang="en" />
      </Block>
      <Block id="stepper" title="SurveyStepper · autosaves to this device"><StepperDemo labels={en.raw("survey") as never} /></Block>
      <Block id="switchers" title="LangSwitcher, ThemeToggle, PersonaRail"><Switchers lang="en" groups={navGroups((k) => en(`nav.${k}`))} /></Block>
      <DataViews d={d} t={tEn} lang="en" idPrefix="data-en" />

      <div data-theme="boardroom" className="ks-gallery-panel">
        <Block id="boardroom" title="Boardroom theme (opt-in)">
          <CardsSection d={d} t={tEn} lang="en" idPrefix="br" />
          <div className="mt-8"><Primitives d={d} t={tEn} lang="en" /></div>
        </Block>
      </div>

      <div lang="mr" className="ks-gallery-panel ks-gallery-panel--mr">
        <Block id="marathi" title="मराठी · Marathi (Devanagari runs about 20% taller)">
          <CardsSection d={d} t={tMr} lang="mr" idPrefix="mr" />
          <div className="mt-8"><Primitives d={d} t={tMr} lang="mr" /></div>
          <div className="mt-8"><DrawerStates rows={evRows} labels={mr.raw("evidence") as never} lang="mr" /></div>
          <DataViews d={d} t={tMr} lang="mr" idPrefix="data-mr" />
        </Block>
      </div>
    </div>
  );
}

export default function GalleryPage() {
  // Dev tooling only; the gallery never ships to a public deployment unless explicitly enabled.
  if (process.env.NODE_ENV === "production" && process.env.KS_SHOW_GALLERY !== "1") notFound();
  return (
    <Suspense fallback={<PageSkeleton cards={6} />}>
      <GalleryPageBody />
    </Suspense>
  );
}
