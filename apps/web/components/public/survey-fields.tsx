"use client";
// Form fields for the employer survey with inline errors. Errors live in one context so the
// survey can show the same message under the field and in the error summary. Every control
// is at least 44px tall (the .ks-field styles) and every error is tied to its control with
// aria-describedby + aria-invalid.
import { createContext, useContext, type ReactNode } from "react";

export type Errors = Record<string, string>;
export const ErrorsContext = createContext<Errors>({});

const useError = (field: string) => useContext(ErrorsContext)[field];

export const errId = (field: string) => `sv-${field}-err`;
export const fieldId = (field: string) => `sv-${field}`;

function describedBy(field: string, hint: boolean, err: boolean) {
  return [hint ? `${fieldId(field)}-hint` : null, err ? errId(field) : null].filter(Boolean).join(" ") || undefined;
}

export function FieldError({ field }: { field: string }) {
  const msg = useError(field);
  return msg ? (
    <p id={errId(field)} className="m-0 text-sm font-medium text-signal-gap">
      <span aria-hidden="true">▲ </span>
      {msg}
    </p>
  ) : null;
}

export function Hint({ field, children }: { field: string; children?: ReactNode }) {
  return children ? <p id={`${fieldId(field)}-hint`} className="ks-field__hint m-0">{children}</p> : null;
}

interface InputProps {
  field: string;
  label: string;
  hint?: string;
  type?: "text" | "number";
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  autoComplete?: string;
  inputMode?: "numeric" | "text";
}

export function TextField({ field, label, hint, type = "text", required, maxLength, min, max, pattern, autoComplete, inputMode }: InputProps) {
  const err = useError(field);
  return (
    <div className="ks-field">
      <label htmlFor={fieldId(field)}>{label}</label>
      <Hint field={field}>{hint}</Hint>
      <input
        id={fieldId(field)}
        name={field}
        data-field={field}
        type={type}
        required={required}
        maxLength={maxLength}
        min={min}
        max={max}
        step={type === "number" ? 1 : undefined}
        pattern={pattern}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={err ? true : undefined}
        aria-describedby={describedBy(field, !!hint, !!err)}
        className="w-full"
      />
      <FieldError field={field} />
    </div>
  );
}

export function TextArea({ field, label, hint, maxLength }: { field: string; label: string; hint?: string; maxLength?: number }) {
  const err = useError(field);
  return (
    <div className="ks-field">
      <label htmlFor={fieldId(field)}>{label}</label>
      <Hint field={field}>{hint}</Hint>
      <textarea
        id={fieldId(field)}
        name={field}
        data-field={field}
        rows={4}
        maxLength={maxLength}
        aria-invalid={err ? true : undefined}
        aria-describedby={describedBy(field, !!hint, !!err)}
        className="w-full"
      />
      <FieldError field={field} />
    </div>
  );
}

export function SelectField({
  field, label, hint, options, placeholder, required, onChange,
}: {
  field: string;
  label: string;
  hint?: string;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  required?: boolean;
  onChange?: (v: string) => void;
}) {
  const err = useError(field);
  return (
    <div className="ks-field">
      <label htmlFor={fieldId(field)}>{label}</label>
      <Hint field={field}>{hint}</Hint>
      <select
        id={fieldId(field)}
        name={field}
        data-field={field}
        required={required}
        defaultValue=""
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        aria-invalid={err ? true : undefined}
        aria-describedby={describedBy(field, !!hint, !!err)}
        className="w-full"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <FieldError field={field} />
    </div>
  );
}

/** A radio group as a fieldset; each option is a full-width 44px row. */
export function RadioGroup({
  field, legend, hint, options, required, onChange, name, value,
}: {
  field: string;
  legend: string;
  hint?: string;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  onChange?: (v: string) => void;
  /** Defaults to `field`. */
  name?: string;
  /** Controlled value (optional). */
  value?: string;
}) {
  const err = useError(field);
  const n = name ?? field;
  return (
    <fieldset
      className="m-0 grid min-w-0 gap-1 border-0 p-0"
      aria-describedby={describedBy(field, !!hint, !!err)}
      aria-invalid={err ? true : undefined}
      id={fieldId(field)}
      tabIndex={-1}
    >
      <legend className="mb-1 p-0 font-medium">{legend}</legend>
      <Hint field={field}>{hint}</Hint>
      <div className="grid gap-1">
        {options.map((o) => (
          <label key={o.value} className="flex min-h-11 cursor-pointer items-center gap-3 border border-ink-faint px-3 py-2 has-[:checked]:border-ink has-[:checked]:bg-stock-eggshell">
            <input
              type="radio"
              name={n}
              value={o.value}
              data-field={field}
              required={required}
              className="size-5 shrink-0 accent-[var(--ink)]"
              {...(value !== undefined ? { checked: value === o.value, onChange: () => onChange?.(o.value) } : { onChange: () => onChange?.(o.value) })}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      <FieldError field={field} />
    </fieldset>
  );
}
