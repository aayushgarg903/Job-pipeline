"use client";
// Client-only gallery demos: drawer states, sheet, stepper, switchers, rail.
import type { EvidenceRow, Lang } from "@ks/contracts";
import {
  Button, EvidenceDrawer, LangSwitcher, PersonaRail, Sheet, SurveyStepper, ThemeToggle,
  type EvidenceLabels, type NavGroup, type SurveyLabels,
} from "@ks/ui";
import { useState } from "react";

export function DrawerStates({ rows, labels, lang }: { rows: EvidenceRow[]; labels: Partial<EvidenceLabels>; lang: Lang }) {
  const [state, setState] = useState<null | "rows" | "loading" | "empty" | "error">(null);
  const [sheet, setSheet] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => setState("rows")}>Evidence · voices</Button>
      <Button variant="secondary" onClick={() => setState("loading")}>Evidence · loading</Button>
      <Button variant="secondary" onClick={() => setState("empty")}>Evidence · empty</Button>
      <Button variant="secondary" onClick={() => setState("error")}>Evidence · error</Button>
      <Button variant="table" onClick={() => setSheet(true)}>Sheet · bottom</Button>
      <EvidenceDrawer
        open={state !== null}
        onClose={() => setState(null)}
        title={lang === "mr" ? "नाशिकमध्ये हे अंतर का दिसते" : "Why Nashik shows this gap"}
        intro={lang === "mr" ? "14 नियोक्त्यांनी सौर पीव्ही आवश्यक असल्याचे सांगितले." : "14 employers in Nashik told us solar PV is a must-have."}
        rows={state === "empty" ? [] : rows}
        loading={state === "loading"}
        error={state === "error"}
        lang={lang}
        labels={labels}
      />
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Sheet" side="bottom" description="A bottom sheet on the table, as used by the Compare view.">
        <p>Esc, the close button or a click on the backdrop closes it. Focus returns to the button that opened it.</p>
      </Sheet>
    </div>
  );
}

export function StepperDemo({ labels }: { labels: Partial<SurveyLabels> }) {
  return (
    <SurveyStepper
      storageKey="ks-gallery-survey"
      labels={labels}
      steps={[
        {
          id: "who", title: "Who you are", description: "Two quick questions about your business.",
          content: (
            <>
              <div className="ks-field">
                <label htmlFor="g-name">Business name</label>
                <input id="g-name" name="employerName" required autoComplete="organization" />
              </div>
              <div className="ks-field">
                <label htmlFor="g-district">District</label>
                <select id="g-district" name="lgd" defaultValue="487">
                  <option value="490">Pune</option>
                  <option value="487">Nashik</option>
                  <option value="475">Gadchiroli</option>
                </select>
              </div>
            </>
          ),
        },
        {
          id: "need", title: "Who you need", description: "Roughly how many people will you hire in the next 12 months?",
          content: (
            <div className="ks-field">
              <label htmlFor="g-hires">People you expect to hire</label>
              <input id="g-hires" name="expectedHires12m" type="number" min={0} inputMode="numeric" required />
              <span className="ks-field__hint">A rough number is fine.</span>
            </div>
          ),
        },
        {
          id: "skills", title: "Skills that matter", description: "Tick what a new hire must be able to do.",
          content: (
            <fieldset className="ks-field">
              <legend>Must-have skills</legend>
              {["Solar PV installation", "Industrial electrical wiring", "Talking with customers"].map((s) => (
                <label key={s} className="flex items-center gap-2">
                  <input type="checkbox" name="skills" value={s} /> {s}
                </label>
              ))}
            </fieldset>
          ),
        },
      ]}
    />
  );
}

export function Switchers({ lang, groups }: { lang: Lang; groups: NavGroup[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
      <div className="flex flex-wrap items-start gap-3">
        <LangSwitcher current={lang} onChange={() => undefined} />
        <ThemeToggle />
      </div>
      <div className="ks-gallery-rail max-w-64">
        <PersonaRail groups={groups} currentPath="/state" label="Gallery rail" />
      </div>
    </div>
  );
}
