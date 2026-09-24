"use client";
// The employer demand survey (docs/pitch/employer-survey.md) on @ks/ui's SurveyStepper.
// SurveyStepper gives the step indicator, Back, per-step validity and autosave. This wrapper
// adds: inline validation on blur, an error summary, custom rules (consent, at least one
// skill), and submission through a Server Action with useActionState. We take over submit so
// a failed send never wipes the answers (React resets forms after a form action).
import type { Lang } from "@ks/contracts";
import { SurveyStepper, type SurveyStep } from "@ks/ui";
import { useLocale, useTranslations } from "next-intl";
import { startTransition, useActionState, useCallback, useEffect, useRef, useState, type FormEvent, type SyntheticEvent } from "react";
import { submitSurvey, type SurveyState } from "@/app/actions/public";
import { SURVEY_ROLES, SECTORS, RATIOS, WEEKS, roleByKey } from "./roles";
import { FIELD_STEP, UDYAM_PATTERN, type SurveyField } from "./survey-schema";
import { ErrorsContext, RadioGroup, SelectField, TextArea, TextField, fieldId, type Errors } from "./survey-fields";
import { SkillPicker, clearSkillPicker, type CatalogSkill } from "./SkillPicker";
import { SurveyThanks } from "./SurveyThanks";

const STORAGE = "ks-employer-survey-v1";
const SKILL_STORAGE = "ks-employer-survey-skills-v1";

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
const isControl = (el: EventTarget | null): el is Control =>
  el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;

type State = SurveyState | { status: "failed" };
const STEP_COUNT = 6;

async function send(prev: State, fd: FormData): Promise<State> {
  try {
    return await submitSurvey(prev.status === "failed" ? { status: "idle" } : prev, fd);
  } catch {
    return { status: "failed" };
  }
}

export function SurveyForm({ districts, catalog }: { districts: Array<{ lgd: string; name: string }>; catalog: CatalogSkill[] }) {
  const lang = (useLocale() === "mr" ? "mr" : "en") as Lang;
  const t = useTranslations("public.survey");
  const tBase = useTranslations("survey");
  const [state, dispatch, pending] = useActionState<State, FormData>(send, { status: "idle" });
  const [errors, setErrors] = useState<Errors>({});
  const [showSummary, setShowSummary] = useState(false);
  const [step, setStep] = useState(0);
  const [consent, setConsent] = useState("");
  const [sector, setSector] = useState("");
  const [role, setRole] = useState("");
  const focusFirst = useRef<Control | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  // Runs after SurveyStepper restored saved answers into the DOM: pick up the few values
  // that change what the form shows (consent note, "Other" boxes, suggested skills).
  useEffect(() => {
    const root = wrap.current;
    if (!root) return;
    const val = (sel: string) => root.querySelector<HTMLInputElement | HTMLSelectElement>(sel)?.value ?? "";
    const c = val('input[name="consent"]:checked');
    setConsent(c);
    root.querySelector<HTMLInputElement>('input[name="consent"][value="no"]')?.setCustomValidity(c === "no" ? t("errors.consent") : "");
    setSector(val('select[name="sector"]'));
    setRole(val('select[name="role"]'));
  }, [t]);

  useEffect(() => {
    if (state.status !== "ok") return;
    clearSkillPicker(SKILL_STORAGE);
    try {
      window.localStorage.removeItem(STORAGE);
    } catch {
      /* ignore */
    }
  }, [state.status]);

  const message = useCallback(
    (el: Control): string | null => {
      const v = el.validity;
      if (v.valid) return null;
      const field = el.dataset.field ?? el.name;
      if (field === "consent") return t("errors.consent");
      if (field === "skills") return t("errors.skills");
      if (v.valueMissing) return t("errors.required");
      if (v.badInput || v.typeMismatch || v.stepMismatch) return t("errors.number");
      if (v.rangeUnderflow || v.rangeOverflow) return t("errors.range");
      if (v.tooLong) return t("errors.tooLong");
      if (v.patternMismatch) return t("errors.pattern");
      return el.validationMessage || t("errors.required");
    },
    [t],
  );

  const setFieldError = (field: string, msg: string | null) =>
    setErrors((e) => {
      if ((e[field] ?? null) === msg) return e;
      const next = { ...e };
      if (msg) next[field] = msg;
      else delete next[field];
      return next;
    });

  // Inline validation: text fields and selects on blur; every change clears a fixed error.
  const onBlur = (e: SyntheticEvent) => {
    const el = e.target;
    if (!isControl(el) || el.type === "radio" || el.type === "hidden" || !(el.dataset.field ?? el.name)) return;
    if (el.dataset.field === "skills") return; // judged when leaving the step
    setFieldError(el.dataset.field ?? el.name, message(el));
  };
  const onChange = (e: SyntheticEvent) => {
    const el = e.target;
    if (!isControl(el)) return;
    const field = el.dataset.field ?? el.name;
    if (field && errors[field] && el.checkValidity()) setFieldError(field, null);
  };
  // Next / submit validity failures: show our message inline and in the summary, not the bubble.
  const onInvalid = (e: SyntheticEvent) => {
    const el = e.target;
    if (!isControl(el)) return;
    e.preventDefault();
    setFieldError(el.dataset.field ?? el.name, message(el));
    setShowSummary(true);
    if (!focusFirst.current) {
      focusFirst.current = el;
      requestAnimationFrame(() => {
        focusFirst.current?.focus();
        focusFirst.current = null;
      });
    }
  };

  const onSubmit = (e: FormEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation(); // keep the stepper from clearing its autosave until the server says yes
    if (step !== STEP_COUNT - 1 || pending) return;
    const fd = new FormData(e.target as HTMLFormElement);
    fd.set("lang", lang);
    startTransition(() => dispatch(fd));
  };

  // Server-side errors (e.g. a step skipped via restored answers) join the same summary.
  const serverErrors: Errors =
    state.status === "error"
      ? Object.fromEntries(Object.entries(state.errors).map(([k, code]) => [k, t(`errors.${code}`)]))
      : {};
  const allErrors = { ...serverErrors, ...errors };
  const errorList = Object.entries(allErrors) as Array<[SurveyField, string]>;

  if (state.status === "ok") return <SurveyThanks state={state} />;

  const opt = (keys: readonly string[], ns: string) => keys.map((k) => ({ value: k, label: t(`${ns}.${k}`) }));
  const roleOptions = [...SURVEY_ROLES.map((r) => ({ value: r.key, label: lang === "mr" ? r.mr : r.en })), { value: "other", label: t("roleOtherOption") }];

  const steps: SurveyStep[] = [
    {
      id: "consent", title: t("steps.consent.title"), description: t("steps.consent.desc"),
      content: (
        <>
          <ul className="m-0 grid list-none gap-2 border-l-2 border-ink-faint p-0 pl-3 text-base">
            {(["collect", "why", "show", "never", "keep", "rights"] as const).map((k) => (
              <li key={k}>{t(`consent.${k}`)}</li>
            ))}
          </ul>
          <RadioGroup
            field="consent" legend={t("consent.question")} required
            options={[{ value: "yes", label: t("consent.yes") }, { value: "no", label: t("consent.no") }]}
            onChange={(v) => {
              setConsent(v);
              // "No" is a valid answer but ends the survey: block Next with a clear reason.
              const no = document.querySelector<HTMLInputElement>('input[name="consent"][value="no"]');
              no?.setCustomValidity(v === "no" ? t("errors.consent") : "");
              setFieldError("consent", null);
            }}
          />
          {consent === "no" ? <p className="m-0 font-medium" role="status">{t("consent.noNote")}</p> : null}
        </>
      ),
    },
    {
      id: "org", title: t("steps.org.title"), description: t("steps.org.desc"),
      content: (
        <>
          <TextField field="employerName" label={t("fields.employerName")} required maxLength={160} autoComplete="organization" />
          <TextField field="udyam" label={t("fields.udyam")} hint={t("fields.udyamHint")} maxLength={24} pattern={UDYAM_PATTERN} />
          <SelectField field="lgd" label={t("fields.lgd")} placeholder={t("fields.choose")} required options={districts.map((d) => ({ value: d.lgd, label: d.name }))} />
          <SelectField field="sector" label={t("fields.sector")} placeholder={t("fields.choose")} required options={opt(SECTORS, "sectors")} onChange={setSector} />
          {sector === "other" ? <TextField field="sectorOther" label={t("fields.sectorOther")} required maxLength={120} /> : null}
        </>
      ),
    },
    {
      id: "role", title: t("steps.role.title"), description: t("steps.role.desc"),
      content: (
        <>
          <SelectField field="role" label={t("fields.role")} hint={t("fields.roleHint")} placeholder={t("fields.choose")} required options={roleOptions} onChange={setRole} />
          {role === "other" ? <TextField field="roleOther" label={t("fields.roleOther")} required maxLength={120} /> : null}
          <TextField field="hires" type="number" inputMode="numeric" label={t("fields.hires")} hint={t("fields.hiresHint")} required min={0} max={5000} />
          <RadioGroup field="ratio" legend={t("fields.ratio")} hint={t("fields.ratioHint")} required options={opt(Object.keys(RATIOS), "ratios")} />
        </>
      ),
    },
    {
      id: "skills", title: t("steps.skills.title"), description: t("steps.skills.desc"),
      content: <SkillPicker storageKey={SKILL_STORAGE} catalog={catalog} suggest={roleByKey.get(role)?.skills ?? []} lang={lang} invalid={!!allErrors.skills} />,
    },
    {
      id: "hires", title: t("steps.hires.title"), description: t("steps.hires.desc"),
      content: (
        <>
          <RadioGroup
            field="csat" legend={t("fields.csat")} hint={`${t("fields.csatLow")} · ${t("fields.csatHigh")}`} required
            options={[...["1", "2", "3", "4", "5"].map((n) => ({ value: n, label: n })), { value: "none", label: t("csatNone") }]}
          />
          <RadioGroup field="weeks" legend={t("fields.weeks")} required options={opt(Object.keys(WEEKS), "weeks")} />
        </>
      ),
    },
    {
      id: "comment", title: t("steps.comment.title"), description: t("steps.comment.desc"),
      content: (
        <>
          <TextArea field="comment" label={t("fields.comment")} maxLength={1000} />
          {state.status === "failed" ? <p className="m-0 font-medium text-signal-gap" role="alert">{t("errors.server")}</p> : null}
          {pending ? <p className="m-0" role="status">{t("sending")}</p> : null}
        </>
      ),
    },
  ];

  return (
    <ErrorsContext.Provider value={allErrors}>
      {(showSummary || state.status === "error") && errorList.length ? (
        <div role="alert" aria-labelledby="sv-summary" className="ks-stock mb-4 grid gap-2 border-2 border-signal-gap p-4" tabIndex={-1}>
          <h2 id="sv-summary" className="m-0 text-lg font-semibold">{t("errors.summaryTitle")}</h2>
          <p className="m-0">{t("errors.summaryIntro", { n: errorList.length })}</p>
          <ul className="m-0 grid gap-1 pl-5">
            {errorList.map(([field, msg]) => (
              <li key={field}>
                {FIELD_STEP[field] === step ? (
                  <a href={`#${fieldId(field)}`} className="underline">{msg}</a>
                ) : (
                  <span>{t("errors.onStep", { n: (FIELD_STEP[field] ?? 0) + 1 })} · {steps[FIELD_STEP[field] ?? 0]?.title}: {msg}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div ref={wrap} onBlurCapture={onBlur} onChangeCapture={onChange} onInvalidCapture={onInvalid} onSubmitCapture={onSubmit}>
        <SurveyStepper
          storageKey={STORAGE}
          steps={steps}
          onStepChange={setStep}
          labels={{ step: tBase.raw("step"), back: tBase("back"), next: tBase("next"), submit: tBase("submit"), saved: tBase("saved"), restored: tBase("restored"), steps: tBase("steps") }}
        />
      </div>
      <p className="mt-2 text-sm text-table-muted">{t("storageNote")}</p>
    </ErrorsContext.Provider>
  );
}
