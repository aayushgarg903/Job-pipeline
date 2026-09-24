"use client";
// Multi-step form (employer demand survey <= 6 min). Step indicator, Back, per-step validation,
// and autosave of every field to localStorage (wrapped in try/catch: storage can be blocked).
// All steps stay in one <form> so the final submit (e.g. a Server Action) gets every field.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { fill } from "./format";
import { Icon } from "./Icon";

export interface SurveyStep {
  id: string;
  title: string;
  description?: string;
  content: ReactNode;
}

export interface SurveyLabels {
  step: string; // "Step {n} of {total}"
  back: string;
  next: string;
  submit: string;
  saved: string;
  restored: string;
  steps: string; // aria-label for the indicator
}

export const SURVEY_LABELS_EN: SurveyLabels = {
  step: "Step {n} of {total}",
  back: "Back",
  next: "Next",
  submit: "Send answers",
  saved: "Saved on this device",
  restored: "We kept your earlier answers on this device.",
  steps: "Survey progress",
};

export interface SurveyStepperProps {
  /** Storage key; unique per survey. */
  storageKey: string;
  steps: SurveyStep[];
  /** Form action: a Server Action or URL. */
  action?: string | ((formData: FormData) => void | Promise<void>);
  onStepChange?: (index: number) => void;
  labels?: Partial<SurveyLabels>;
}

type Saved = { step: number; values: Record<string, string | string[]> };

function readSaved(key: string): Saved | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}
function writeSaved(key: string, s: Saved) {
  try {
    window.localStorage.setItem(key, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}
function clearSaved(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function collect(form: HTMLFormElement): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of new FormData(form).entries()) {
    if (typeof v !== "string") continue;
    const prev = out[k];
    out[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
  }
  return out;
}

function restore(form: HTMLFormElement, values: Record<string, string | string[]>) {
  for (const el of Array.from(form.elements)) {
    const input = el as HTMLInputElement;
    if (!input.name || !(input.name in values)) continue;
    const v = values[input.name]!;
    const list = Array.isArray(v) ? v : [v];
    if (input.type === "checkbox" || input.type === "radio") input.checked = list.includes(input.value);
    else if (input.type !== "file" && input.type !== "hidden") input.value = list[0] ?? "";
  }
}

export function SurveyStepper({ storageKey, steps, action, onStepChange, labels }: SurveyStepperProps) {
  const L = { ...SURVEY_LABELS_EN, ...labels };
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [index, setIndex] = useState(0);
  const [savedAt, setSavedAt] = useState(false);
  const [restored, setRestored] = useState(false);
  const moved = useRef(false);
  const uid = useId();
  const total = steps.length;
  const last = index === total - 1;

  useEffect(() => {
    const s = readSaved(storageKey);
    if (s && form.current) {
      restore(form.current, s.values);
      setIndex(Math.min(Math.max(0, s.step), total - 1));
      setRestored(Object.keys(s.values).length > 0);
    }
  }, [storageKey, total]);

  useEffect(() => {
    onStepChange?.(index);
    if (moved.current) heading.current?.focus();
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  function save(step = index) {
    if (!form.current) return;
    setSavedAt(writeSaved(storageKey, { step, values: collect(form.current) }));
  }

  function go(to: number) {
    moved.current = true;
    setIndex(to);
    save(to);
  }

  function next() {
    const fs = form.current?.querySelector<HTMLFieldSetElement>(`fieldset[data-step="${index}"]`);
    const invalid = fs ? Array.from(fs.querySelectorAll<HTMLInputElement>("input,select,textarea")).find((el) => !el.checkValidity()) : null;
    if (invalid) {
      invalid.reportValidity();
      return;
    }
    go(index + 1);
  }

  const step = steps[index]!;
  return (
    <form
      ref={form}
      className="ks-stepper ks-stock"
      action={action as never}
      onInput={() => save()}
      onChange={() => save()}
      onSubmit={() => clearSaved(storageKey)}
      aria-labelledby={`${uid}-title`}
      noValidate={false}
    >
      <ol className="ks-stepper__steps" aria-label={L.steps}>
        {steps.map((s, i) => (
          <li key={s.id} className="ks-stepper__dot" data-state={i < index ? "done" : i === index ? "current" : "todo"} aria-current={i === index ? "step" : undefined}>
            <span className="sr-only">{fill(L.step, { n: i + 1, total })}: </span>
            {s.title}
          </li>
        ))}
      </ol>
      <div>
        <p className="ks-stepper__count">{fill(L.step, { n: index + 1, total })}</p>
        <h2 id={`${uid}-title`} ref={heading} tabIndex={-1} className="ks-stepper__title">
          {step.title}
        </h2>
        {step.description ? <p className="ks-stepper__desc">{step.description}</p> : null}
        {restored && index === 0 ? <p className="ks-stepper__saved" role="status">{L.restored}</p> : null}
      </div>
      {steps.map((s, i) => (
        <fieldset key={s.id} data-step={i} hidden={i !== index} aria-labelledby={i === index ? `${uid}-title` : undefined}>
          {s.content}
        </fieldset>
      ))}
      <div className="ks-stepper__nav">
        {index > 0 ? (
          <button type="button" className="ks-btn ks-btn--secondary" onClick={() => go(index - 1)}>
            <Icon name="caret-left" size={18} />
            {L.back}
          </button>
        ) : (
          <span />
        )}
        <span className="ks-stepper__saved" aria-live="polite">
          {savedAt ? (
            <>
              <Icon name="check" size={14} /> {L.saved}
            </>
          ) : null}
        </span>
        {last ? (
          <button type="submit" className="ks-btn">
            {L.submit}
          </button>
        ) : (
          <button type="button" className="ks-btn" onClick={next}>
            {L.next}
            <Icon name="caret-right" size={18} />
          </button>
        )}
      </div>
    </form>
  );
}
