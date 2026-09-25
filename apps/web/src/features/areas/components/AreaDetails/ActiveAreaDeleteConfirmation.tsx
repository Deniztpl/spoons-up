import { useEffect, useRef } from "react";

type ActiveAreaDeleteConfirmationProps = {
  id: string;
  areaName: string;
  habitCount: number | null;
  isSaving: boolean;
  onCancel: () => void;
  onDelete: () => void;
};

export function ActiveAreaDeleteConfirmation({
  id,
  areaName,
  habitCount,
  isSaving,
  onCancel,
  onDelete,
}: ActiveAreaDeleteConfirmationProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Focus the safe action first.
  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  return (
    <div
      id={id}
      role="group"
      aria-label="Confirm area deletion"
      className="absolute right-0 top-[38px] z-20 flex w-[250px] flex-col gap-[9px] rounded-[11px] border border-danger/30 bg-card p-3.5 shadow-[0_10px_26px_rgb(28_43_33/0.14)]"
    >
      <p className="text-[13.5px] font-medium">Delete “{areaName}”?</p>
      <p className="text-xs leading-[1.45] text-ink-soft">{deleteWarning(habitCount)}</p>
      <div className="flex justify-end gap-2 pt-0.5">
        <button
          ref={cancelButtonRef}
          type="button"
          disabled={isSaving}
          className="rounded-lg border border-ink/14 bg-card px-3 py-[7px] text-[12.5px] font-medium text-ink-soft transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isSaving}
          className="rounded-lg bg-danger px-3 py-[7px] text-[12.5px] font-medium text-white transition hover:bg-danger/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:cursor-wait disabled:opacity-60"
          onClick={onDelete}
        >
          {isSaving ? "Deleting..." : "Delete area"}
        </button>
      </div>
    </div>
  );
}

// TODO(slice-3): include goals in this warning.
function deleteWarning(habitCount: number | null) {
  const lost =
    habitCount === null
      ? "The area and everything in it"
      : habitCount === 0
        ? "The area"
        : `The area, its ${habitCount} ${habitCount === 1 ? "habit" : "habits"} and all of their check-off history`;
  return `${lost} will be permanently deleted. This can't be undone. Archive it instead if you might want it back.`;
}
