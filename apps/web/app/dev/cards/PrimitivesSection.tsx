// Tokens, type, buttons, badges, honesty marks, the people figure, freshness and the PR diff.
import type { Lang } from "@ks/contracts";
import { Badge, Button, DiffBlock, FreshnessStrip, PeopleFigure, Seal, VERDICTS, Watermark, WatermarkText } from "@ks/ui";
import type { Tr } from "@/lib/cards";
import type { GalleryData } from "./data";

const SWATCHES = [
  ["--table", "table"], ["--table-raised", "table-raised"], ["--table-ink", "table-ink"], ["--table-muted", "table-muted"],
  ["--stock-bone", "stock-bone"], ["--stock-eggshell", "stock-eggshell"], ["--stock-nimbus", "stock-nimbus"],
  ["--ink", "ink"], ["--ink-muted", "ink-muted"], ["--ink-faint", "ink-faint (non-text)"], ["--brass", "brass (table only)"],
  ["--signal-gap", "signal-gap"], ["--signal-ok", "signal-ok"], ["--signal-watch", "signal-watch"],
  ["--ramp-1", "ramp-1"], ["--ramp-2", "ramp-2"], ["--ramp-3", "ramp-3"], ["--ramp-4", "ramp-4"], ["--ramp-5", "ramp-5"],
] as const;

export function Tokens() {
  return (
    <div className="grid gap-4">
      <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-4 lg:grid-cols-7">
        {SWATCHES.map(([v, name]) => (
          <li key={v} className="grid gap-1 text-xs">
            <span className="block h-10 border border-ink-muted" style={{ background: `var(${v})` }} aria-hidden="true" />
            <code className="font-mono">{name}</code>
          </li>
        ))}
      </ul>
      <div className="ks-stock grid gap-2 p-4">
        <p className="m-0 font-display text-5xl tracking-name letterpress" style={{ fontVariantCaps: "small-caps" }}>Nashik</p>
        <p className="m-0 font-display text-2xl tracking-name" style={{ fontVariantCaps: "small-caps" }}>Solar PV installation · 22px floor</p>
        <p className="m-0 font-serif text-base italic">Card title line, Cormorant Garamond italic</p>
        <p className="m-0 text-base">Body, Inter 16px / 1.55. Short sentences, second person, plain words.</p>
        <p className="m-0 font-mono text-sm tracking-code">NCO 7411.0300 · SDI 172 ▲ 19 · 1,240 / 310</p>
        <p className="m-0 font-deva text-2xl" lang="mr">नाशिक · सौर पीव्ही बसवणी</p>
        <p className="m-0 font-deva-sans text-base" lang="mr">नाशिकमध्ये पुढच्या वर्षी सुमारे 140 लोकांना नोकरी मिळू शकते.</p>
        <hr className="ks-rule-end" />
      </div>
    </div>
  );
}

export function Primitives({ d, t, lang }: { d: GalleryData; t: Tr; lang: Lang }) {
  const v = (k: keyof typeof VERDICTS) => ({ tone: VERDICTS[k].tone, glyph: VERDICTS[k].glyph });
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button icon="table">{t("card.placeOnTable")}</Button>
        <Button variant="secondary" icon="download">{t("chart.csv")}</Button>
        <Button variant="table">{t("tray.clear")}</Button>
        <Button variant="ghost">{t("shell.menu")}</Button>
        <Button size="sm" variant="secondary">{t("survey.back")}</Button>
        <Button size="lg" iconAfter="arrow-right">{t("home.official.cta")}</Button>
        <Button disabled>{t("survey.submit")}</Button>
      </div>
      <div className="ks-stock flex flex-wrap items-center gap-3 p-4">
        {(["SHORTAGE", "OVERSUPPLY", "BALANCED", "HEALTHY", "REVISE", "OVERSUPPLIED", "OBSOLETE"] as const).map((k) => (
          <Badge key={k} {...v(k)}>{t(`verdict.${k}`)}</Badge>
        ))}
        <Badge tone="gap" glyph="▲" solid>{t("verdict.SHORTAGE")}</Badge>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="ks-stock relative grid min-h-32 place-items-center p-4" style={{ containerType: "inline-size" }}>
          <Watermark kind="specimen" word={t("card.specimenWord")} srText={t("card.specimen")} />
          <WatermarkText kind="specimen">{t("card.specimen")}</WatermarkText>
        </div>
        <div className="ks-stock relative grid min-h-32 place-items-center p-4" style={{ containerType: "inline-size" }}>
          <Watermark kind="lapsed" word={t("card.lapsedWord")} srText={t("card.lapsed")} />
          <WatermarkText kind="lapsed">{t("card.lapsed")}</WatermarkText>
        </div>
        <div className="ks-stock grid min-h-32 place-items-center p-4">
          <Seal count={4} label={t("card.endorsed", { n: 4 })} showLabel size={56} />
        </div>
      </div>
      <div className="ks-stock p-6">
        <PeopleFigure
          value={140}
          unit={t("people.people")}
          approxLabel={t("people.approx")}
          sentence={lang === "mr" ? "नाशिकमध्ये पुढच्या वर्षी सौर तंत्रज्ञ म्हणून नोकरी मिळू शकते. आपल्या ITI 35 जणांना प्रशिक्षण देतील." : "in Nashik could be hired as solar technicians next year. Our ITIs will train 35."}
          source={lang === "mr" ? "1,310 जाहिराती · 14 नियोक्ते · सप्टें 26" : "1,310 job posts · 14 employers · Sep 26"}
          lang={lang}
          size="xl"
        />
      </div>
      <FreshnessStrip sources={d.sources} lang={lang} labels={t.raw("fresh") as never} />
      {d.pr ? (
        <DiffBlock
          lines={d.pr.diff}
          title={lang === "mr" ? "PR #101 · डेटा एंट्री आणि विश्लेषण" : "PR #101 · Data Entry and Analysis"}
          skillLabels={Object.fromEntries(d.skills.map((s) => [s.id, (lang === "mr" && s.labelMr) || s.labelEn]))}
          lang={lang}
          labels={t.raw("diff") as never}
        />
      ) : null}
    </div>
  );
}
