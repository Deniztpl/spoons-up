import type { RefObject } from "react";

type JournalDeleteConfirmationProps = {
  itemTitle: string;
  stepCount: number;
  isDeleting: boolean;
  cancelButtonRef: RefObject<HTMLButtonElement | null>;
  onCancel: () => void;
  onDelete: () => void;
};

export function JournalDeleteConfirmation({
  itemTitle,
  stepCount,
  isDeleting,
  cancelButtonRef,
  onCancel,
  onDelete,
}: JournalDeleteConfirmationProps) {
  return (
    <div
      role="group"
      aria-label="Confirm item deletion"
      className="rounded-[10px] border border-danger/25 bg-danger-soft p-4"
    >
      <p className="break-words text-[13.5px] font-semibold text-ink">Delete “{itemTitle}”?</p>
      <p className="mt-1 text-[13px] leading-5 text-danger">
        {stepCount > 0
          ? `Its ${stepCount === 1 ? "step is" : `${stepCount} steps are`} deleted with it. `
          : ""}
        This can't be undone.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isDeleting}
          className="rounded-[9px] bg-danger px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-danger/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:cursor-wait disabled:opacity-60"
          onClick={onDelete}
        >
          {isDeleting ? "Deleting…" : "Delete item"}
        </button>
        <button
          ref={cancelButtonRef}
          type="button"
          disabled={isDeleting}
          className="rounded-[9px] border border-ink/14 bg-card px-3.5 py-2 text-[13px] font-medium text-ink-soft transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
