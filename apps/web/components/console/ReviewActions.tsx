"use client";
// Approve / reject one review item through a Server Action. The result (including "demo, not
// saved") is announced in a live region; the buttons stay until a decision is recorded.
import { useActionState } from "react";
import { resolveReviewItem, type ReviewState } from "@/app/actions/console";

const INITIAL: ReviewState = { status: "idle", decision: null, demo: false, message: null };

export function ReviewActions({ id, labels }: { id: string; labels: { approve: string; reject: string; pending: string; demo: string } }) {
  const [state, action, pending] = useActionState(resolveReviewItem, INITIAL);
  const done = state.status === "done";
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      {!done ? (
        <div className="flex flex-wrap gap-2">
          <button type="submit" name="decision" value="approve" className="ks-btn ks-btn--sm" disabled={pending}>
            <span aria-hidden="true">✓ </span>{labels.approve}
          </button>
          <button type="submit" name="decision" value="reject" className="ks-btn ks-btn--secondary ks-btn--sm" disabled={pending}>
            <span aria-hidden="true">✕ </span>{labels.reject}
          </button>
          {pending ? <span className="text-sm">{labels.pending}</span> : null}
        </div>
      ) : null}
      <p role="status" aria-live="polite" className="m-0 text-sm">
        {state.message ? (
          <>
            {state.demo ? <span className="ks-badge ks-badge--watch mr-2"><span className="ks-badge__glyph" aria-hidden="true">~</span>{labels.demo}</span> : null}
            {state.message}
          </>
        ) : null}
      </p>
    </form>
  );
}
