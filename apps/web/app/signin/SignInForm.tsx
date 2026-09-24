"use client";
import { useActionState } from "react";
import { officerSignIn, type SignInState } from "@/app/actions/auth";

export interface SignInLabels { name: string; passcode: string; submit: string; errors: Record<NonNullable<SignInState["error"]>, string> }

export function SignInForm({ next, labels }: { next: string; labels: SignInLabels }) {
  const [state, action, pending] = useActionState(officerSignIn, { error: null });
  return (
    <form action={action} className="ks-stack" style={{ maxWidth: 420, gap: 16 }}>
      <input type="hidden" name="next" value={next} />
      <label className="ks-field">
        <span>{labels.name}</span>
        <input name="name" autoComplete="name" required minLength={2} maxLength={80} />
      </label>
      <label className="ks-field">
        <span>{labels.passcode}</span>
        <input name="passcode" type="password" autoComplete="current-password" required />
      </label>
      {state.error ? <p role="alert" style={{ color: "var(--signal-gap)" }}>{labels.errors[state.error]}</p> : null}
      <button className="ks-btn ks-btn--primary" type="submit" disabled={pending}>{labels.submit}</button>
    </form>
  );
}
