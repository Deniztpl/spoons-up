import type { RefObject } from "react";

type OpenStepsConfirmationProps = {
  openCount: number;
  isSaving: boolean;
  cancelButtonRef?: RefObject<HTMLButtonElement | null>;
  onCancel: () => void;
  onConfirm: () => void;
};

export function OpenStepsConfirmation({
  openCount,
  isSaving,
  cancelButtonRef,
  onCancel,
  onConfirm,
}: OpenStepsConfirmationProps) {
  return (
    <div
      role="group"
      aria-label="Confirm finishing with open steps"
      className="rounded-[10px] border border-accent/25 bg-accent/6 p-4"
    >
      <p className="text-[13.5px] font-semibold text-ink">
        {openCount} {openCount === 1 ? "step is" : "steps are"} not complete. Finish anyway?
      </p>
      <p className="mt-1 text-[13px] leading-5 text-ink-soft">
        They stay open under the finished item, and any plans for them are cleared.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isSaving}
          className="rounded-[9px] bg-accent px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"
          onClick={onConfirm}
        >
          {isSaving ? "Finishing…" : "Finish anyway"}
        </button>
        <button
          ref={cancelButtonRef}
          type="button"
          disabled={isSaving}
          className="rounded-[9px] border border-ink/14 bg-card px-3.5 py-2 text-[13px] font-medium text-ink-soft transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
