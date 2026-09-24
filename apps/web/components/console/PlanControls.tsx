"use client";
// Plan knobs (seat budget, capex in ₹ lakh, and λ under "Advanced") and the sign form.
// Re-plan is a GET form, so a plan with its knobs is a shareable link and works without JS.
import Form from "next/form";
import { useActionState, useId, useState } from "react";
import { signPlan, type SignState } from "@/app/actions/console";

export interface PlanControlLabels {
  heading: string; seats: string; seatsHint: string; capex: string; capexHint: string; advanced: string;
  lambda: string; lambdaHint: string; replan: string; reset: string;
}

export function PlanControls({ action, seats, capexLakh, lambda, range, labels }: {
  action: string; seats: number; capexLakh: number; lambda: number; range: { min: number; max: number; step: number }; labels: PlanControlLabels;
}) {
  const id = useId();
  const [l, setL] = useState(lambda);
  return (
    <Form action={action} className="ks-stock grid gap-4 p-4" aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`} className="m-0 font-semibold">{labels.heading}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="ks-field">
          <label htmlFor={`${id}-seats`}>{labels.seats}</label>
          <input id={`${id}-seats`} name="seats" type="number" min={0} max={100000} step={10} inputMode="numeric" defaultValue={seats} />
          <span className="ks-field__hint">{labels.seatsHint}</span>
        </div>
        <div className="ks-field">
          <label htmlFor={`${id}-capex`}>{labels.capex}</label>
          <input id={`${id}-capex`} name="capex" type="number" min={0} max={100000} step={1} inputMode="decimal" defaultValue={capexLakh} />
          <span className="ks-field__hint">{labels.capexHint}</span>
        </div>
      </div>
      <details>
        <summary className="cursor-pointer font-semibold">{labels.advanced}</summary>
        <div className="ks-field mt-3">
          <label htmlFor={`${id}-lambda`}>
            {labels.lambda}: <output htmlFor={`${id}-lambda`} className="ks-mono">{l.toFixed(1)}</output>
          </label>
          <input
            id={`${id}-lambda`} name="lambda" type="range" min={range.min} max={range.max} step={range.step}
            value={l} onChange={(e) => setL(Number(e.target.value))}
          />
          <span className="ks-field__hint">{labels.lambdaHint}</span>
        </div>
      </details>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="ks-btn">{labels.replan}</button>
        <a href={action} className="ks-btn ks-btn--ghost">{labels.reset}</a>
      </div>
    </Form>
  );
}

export interface SignLabels {
  heading: string; intro: string; name: string; nameHint: string; submit: string; pending: string; demoBadge: string; download: string; signedBy: string;
}

const INITIAL: SignState = { status: "idle", demo: false, signedBy: null, signedAt: null, message: null, pdfHref: null };

export function PlanSign({ lgd, fy, knobs, labels }: {
  lgd: string; fy: string; knobs: { seats?: number; capex?: number; lambda?: number }; labels: SignLabels;
}) {
  const id = useId();
  const [state, action, pending] = useActionState(signPlan, INITIAL);
  return (
    <form action={action} className="ks-stock grid gap-3 p-4" aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`} className="m-0 font-semibold">{labels.heading}</h3>
      <p className="m-0">{labels.intro}</p>
      <input type="hidden" name="lgd" value={lgd} />
      <input type="hidden" name="fy" value={fy} />
      {knobs.seats !== undefined ? <input type="hidden" name="seats" value={knobs.seats} /> : null}
      {knobs.capex !== undefined ? <input type="hidden" name="capex" value={knobs.capex} /> : null}
      {knobs.lambda !== undefined ? <input type="hidden" name="lambda" value={knobs.lambda} /> : null}
      <div className="ks-field">
        <label htmlFor={`${id}-name`}>{labels.name}</label>
        <input id={`${id}-name`} name="name" required minLength={2} maxLength={80} autoComplete="name" />
        <span className="ks-field__hint">{labels.nameHint}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="ks-btn" disabled={pending}>{pending ? labels.pending : labels.submit}</button>
      </div>
      <div role="status" aria-live="polite">
        {state.status !== "idle" && state.message ? (
          <div className="grid gap-2">
            {state.status === "signed" && state.demo ? (
              <p className="m-0"><span className="ks-badge ks-badge--watch"><span className="ks-badge__glyph" aria-hidden="true">~</span>{labels.demoBadge}</span></p>
            ) : null}
            <p className="m-0">{state.message}</p>
            {state.signedBy ? <p className="m-0 text-sm">{labels.signedBy.replace("{name}", state.signedBy)}</p> : null}
            {state.pdfHref ? (
              <p className="m-0"><a href={state.pdfHref} className="ks-btn ks-btn--secondary" download>{labels.download}</a></p>
            ) : null}
          </div>
        ) : null}
      </div>
    </form>
  );
}
